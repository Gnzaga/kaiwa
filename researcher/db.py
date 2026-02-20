from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import asyncpg
import httpx

from config import DATABASE_URL, EMBEDDER_URL


_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


# ── Table Creation ────────────────────────────────────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS research_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    query TEXT NOT NULL,
    filters JSONB,
    status TEXT NOT NULL DEFAULT 'running',
    report JSONB,
    articles JSONB,
    search_log JSONB,
    events JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_research_tasks_user
    ON research_tasks(user_id, created_at DESC);
"""


async def ensure_table() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(CREATE_TABLE_SQL)


# ── Task CRUD ─────────────────────────────────────────────────────────

async def create_task(
    task_id: str,
    query: str,
    filters: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO research_tasks (id, user_id, query, filters, status, created_at)
            VALUES ($1, $2, $3, $4, 'running', NOW())
            """,
            task_id,
            user_id,
            query,
            json.dumps(filters) if filters else None,
        )


async def update_task_complete(
    task_id: str,
    report: dict[str, Any],
    articles: list[dict[str, Any]],
    search_log: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE research_tasks
            SET status = 'complete',
                report = $2,
                articles = $3,
                search_log = $4,
                events = $5,
                completed_at = NOW()
            WHERE id = $1
            """,
            task_id,
            json.dumps(report),
            json.dumps(articles),
            json.dumps(search_log),
            json.dumps(events),
        )


async def update_task_error(task_id: str, error: str) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE research_tasks
            SET status = 'error', error = $2, completed_at = NOW()
            WHERE id = $1
            """,
            task_id,
            error,
        )


async def get_task(task_id: str) -> dict[str, Any] | None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM research_tasks WHERE id = $1", task_id
        )
        if row is None:
            return None
        return _row_to_dict(row)


async def list_tasks(limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, query, filters, status, error, created_at, completed_at
            FROM research_tasks
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit,
            offset,
        )
        return [_row_to_dict(r) for r in rows]


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    d: dict[str, Any] = {}
    for key, val in row.items():
        if isinstance(val, datetime):
            d[key] = val.isoformat()
        elif isinstance(val, str) and key in ("filters", "report", "articles", "search_log", "events"):
            try:
                d[key] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                d[key] = val
        else:
            d[key] = val
    return d


# ── Search Functions ──────────────────────────────────────────────────

TSVECTOR = """
to_tsvector('english',
    COALESCE(a.translated_title, '') || ' ' ||
    COALESCE(a.translated_content, '') || ' ' ||
    COALESCE(a.summary_tldr, ''))
"""


def _build_filter_clause(
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    params: list[Any] | None = None,
) -> str:
    """Build WHERE clause fragments for filters. Appends to params list."""
    if params is None:
        params = []
    clauses: list[str] = []
    if region:
        params.append(region)
        clauses.append(f"f.region_id = ${len(params)}")
    if date_from:
        params.append(date_from)
        clauses.append(f"a.published_at >= ${len(params)}::timestamptz")
    if date_to:
        params.append(date_to)
        clauses.append(f"a.published_at <= ${len(params)}::timestamptz")
    return " AND ".join(clauses)


async def keyword_search(
    query: str,
    limit: int = 50,
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    exclude_ids: set[int] | None = None,
) -> list[dict[str, Any]]:
    pool = await get_pool()
    params: list[Any] = [query]
    fts_cond = f"{TSVECTOR} @@ plainto_tsquery('english', $1)"

    filter_parts = _build_filter_clause(region, date_from, date_to, params)
    where = fts_cond
    if filter_parts:
        where += f" AND {filter_parts}"
    if exclude_ids:
        params.append(list(exclude_ids))
        where += f" AND a.id != ALL(${len(params)}::int[])"

    params.append(limit)
    sql = f"""
    SELECT a.id, a.original_title, a.translated_title, a.published_at,
           a.summary_tldr, a.summary_tags, a.summary_sentiment,
           a.original_url, a.image_url, a.source_language,
           f.source_name AS feed_source_name, f.region_id AS feed_region_id,
           ts_rank({TSVECTOR}, plainto_tsquery('english', $1)) AS rank
    FROM articles a
    LEFT JOIN feeds f ON a.feed_id = f.id
    WHERE {where}
    ORDER BY rank DESC
    LIMIT ${len(params)}
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
    return [_search_row(r) for r in rows]


async def _get_embedding(text: str) -> list[float] | None:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{EMBEDDER_URL}/embed",
                json={"texts": [text]},
            )
            resp.raise_for_status()
            return resp.json()["embeddings"][0]
    except Exception:
        return None


async def semantic_search(
    query: str,
    limit: int = 50,
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    exclude_ids: set[int] | None = None,
) -> list[dict[str, Any]]:
    embedding = await _get_embedding(query)
    if embedding is None:
        return await keyword_search(query, limit, region, date_from, date_to, exclude_ids)

    pool = await get_pool()
    vector_str = "[" + ",".join(str(v) for v in embedding) + "]"
    params: list[Any] = [vector_str]

    filter_parts = _build_filter_clause(region, date_from, date_to, params)
    where = "a.embedding IS NOT NULL"
    if filter_parts:
        where += f" AND {filter_parts}"
    if exclude_ids:
        params.append(list(exclude_ids))
        where += f" AND a.id != ALL(${len(params)}::int[])"

    params.append(limit)
    sql = f"""
    SELECT a.id, a.original_title, a.translated_title, a.published_at,
           a.summary_tldr, a.summary_tags, a.summary_sentiment,
           a.original_url, a.image_url, a.source_language,
           f.source_name AS feed_source_name, f.region_id AS feed_region_id,
           a.embedding <=> $1::vector AS distance
    FROM articles a
    LEFT JOIN feeds f ON a.feed_id = f.id
    WHERE {where}
    ORDER BY distance ASC
    LIMIT ${len(params)}
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
    return [_search_row(r) for r in rows]


async def hybrid_search(
    query: str,
    limit: int = 50,
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    exclude_ids: set[int] | None = None,
) -> list[dict[str, Any]]:
    """Reciprocal Rank Fusion of keyword + semantic results."""
    import asyncio

    kw_results, sem_results = await asyncio.gather(
        keyword_search(query, 100, region, date_from, date_to, exclude_ids),
        semantic_search(query, 100, region, date_from, date_to, exclude_ids),
    )

    scores: dict[int, float] = {}
    article_map: dict[int, dict[str, Any]] = {}

    for idx, art in enumerate(kw_results):
        rrf = 1.0 / (60 + idx)
        scores[art["id"]] = scores.get(art["id"], 0) + rrf
        article_map[art["id"]] = art

    for idx, art in enumerate(sem_results):
        rrf = 1.0 / (60 + idx)
        scores[art["id"]] = scores.get(art["id"], 0) + rrf
        article_map[art["id"]] = art

    sorted_ids = sorted(scores, key=lambda aid: scores[aid], reverse=True)[:limit]
    return [article_map[aid] for aid in sorted_ids]


async def get_article_summaries(article_ids: list[int]) -> dict[int, dict[str, Any]]:
    """Fetch summary fields for a list of article IDs."""
    if not article_ids:
        return {}
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.id, a.translated_title, a.original_title, a.published_at,
                   a.summary_tldr, a.summary_bullets, a.summary_tags,
                   a.summary_sentiment, a.original_url, a.image_url,
                   a.source_language,
                   f.source_name AS feed_source_name, f.region_id AS feed_region_id
            FROM articles a
            LEFT JOIN feeds f ON a.feed_id = f.id
            WHERE a.id = ANY($1::int[])
            """,
            article_ids,
        )
    result: dict[int, dict[str, Any]] = {}
    for r in rows:
        d = _search_row(r)
        # Parse bullets if stored as JSON string
        if isinstance(d.get("summary_bullets"), str):
            try:
                d["summary_bullets"] = json.loads(d["summary_bullets"])
            except (json.JSONDecodeError, TypeError):
                pass
        if isinstance(d.get("summary_tags"), str):
            try:
                d["summary_tags"] = json.loads(d["summary_tags"])
            except (json.JSONDecodeError, TypeError):
                pass
        result[d["id"]] = d
    return result


def _search_row(row: asyncpg.Record) -> dict[str, Any]:
    d: dict[str, Any] = {}
    for key, val in row.items():
        if isinstance(val, datetime):
            d[key] = val.isoformat()
        else:
            d[key] = val
    return d
