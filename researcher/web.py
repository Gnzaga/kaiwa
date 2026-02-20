"""HTTP clients for SearXNG web search and webreader services."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config import SEARXNG_URL, WEBREADER_URL, WEB_SEARCH_MAX_RESULTS, WEB_READ_MAX_PAGES

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


# ── Health Checks ─────────────────────────────────────────────────────


async def check_searxng_health() -> bool:
    """Probe SearXNG availability."""
    if not SEARXNG_URL:
        return False
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            resp = await client.get(f"{SEARXNG_URL}/healthz")
            return resp.status_code == 200
    except Exception as e:
        logger.warning("SearXNG health check failed: %s", e)
        return False


async def check_webreader_health() -> bool:
    """Probe webreader availability."""
    if not WEBREADER_URL:
        return False
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            resp = await client.get(f"{WEBREADER_URL}/health")
            return resp.status_code == 200
    except Exception as e:
        logger.warning("Webreader health check failed: %s", e)
        return False


# ── SearXNG Search ────────────────────────────────────────────────────


async def searxng_search(
    query: str,
    max_results: int | None = None,
    language: str = "en",
) -> list[dict[str, Any]]:
    """Search SearXNG and return normalized results.

    Returns list of {url, title, content, engine, score}.
    """
    if not SEARXNG_URL:
        return []

    limit = max_results or WEB_SEARCH_MAX_RESULTS
    params = {
        "q": query,
        "format": "json",
        "language": language,
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(f"{SEARXNG_URL}/search", params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("SearXNG search failed for '%s': %s", query, e)
        return []

    results = data.get("results", [])[:limit]
    return [
        {
            "url": r.get("url", ""),
            "title": r.get("title", ""),
            "content": r.get("content", ""),
            "engine": r.get("engine", ""),
            "score": r.get("score", 0),
        }
        for r in results
        if r.get("url")
    ]


# ── Web Reader ────────────────────────────────────────────────────────


async def read_web_pages(
    urls_with_queries: list[dict[str, str]],
    max_pages: int | None = None,
) -> dict[str, dict[str, Any]]:
    """Send URLs to webreader for extraction + summarization.

    Args:
        urls_with_queries: list of {"url": "...", "query": "..."}
        max_pages: override for WEB_READ_MAX_PAGES

    Returns:
        dict mapping URL → {title, summary, key_points, extracted_length, success, error}
    """
    if not WEBREADER_URL:
        return {}

    limit = max_pages or WEB_READ_MAX_PAGES
    batch = urls_with_queries[:limit]

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=5.0)) as client:
            resp = await client.post(
                f"{WEBREADER_URL}/read/batch",
                json={"urls": batch},
            )
            resp.raise_for_status()
            results = resp.json()
    except Exception as e:
        logger.error("Webreader batch read failed: %s", e)
        return {}

    return {
        r["url"]: r
        for r in results
        if isinstance(r, dict) and r.get("url")
    }
