from __future__ import annotations

import asyncio
import json
import logging
from datetime import date
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langchain_openai import ChatOpenAI

from config import (
    OPENROUTER_API_KEY,
    RESEARCH_MAX_ITERATIONS,
    RESEARCH_MODEL,
    WEB_SEARCH_ENABLED,
    WEB_READ_MAX_PAGES,
)
from models import (
    AnalyzeDecision,
    CompiledReport,
    PlanSearchOutput,
    SearchQuery,
    WebSearchQuery,
)
import db
import web

logger = logging.getLogger(__name__)


# ── State ─────────────────────────────────────────────────────────────

class ResearchState(TypedDict):
    original_query: str
    filters: dict[str, Any]
    found_article_ids: list[int]
    read_summaries: dict[int, dict[str, Any]]
    queries_tried: list[str]
    iteration: int
    report: dict[str, Any] | None
    top_articles: list[dict[str, Any]] | None
    search_log: list[dict[str, Any]]
    # Web search state
    web_search_results: list[dict[str, Any]]
    web_page_summaries: dict[str, dict[str, Any]]
    urls_tried: list[str]
    web_available: bool
    # Event queue reference (set externally before invoke)
    _event_queue: asyncio.Queue | None
    # Internal keys passed between nodes
    _planned_db_searches: list[Any]
    _planned_web_searches: list[Any]
    _decision: str
    _new_angles: list[str]


def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=RESEARCH_MODEL,
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.3,
        max_tokens=4096,
    )


async def _emit(state: ResearchState, event_type: str, data: dict[str, Any]) -> None:
    q = state.get("_event_queue")
    if q:
        await q.put({"event": event_type, "data": data})


async def _stream_llm(state: ResearchState, node: str, prompt: str) -> str:
    """Stream LLM output, emitting progress events with accumulated text."""
    llm = _get_llm()
    accumulated = ""
    async for chunk in llm.astream(prompt):
        token = chunk.content or ""
        if token:
            accumulated += token
            await _emit(state, "progress", {"node": node, "text": accumulated})
    return accumulated


# ── Nodes ─────────────────────────────────────────────────────────────

async def check_web_availability(state: ResearchState) -> dict[str, Any]:
    """Probe SearXNG + webreader health at startup."""
    if not WEB_SEARCH_ENABLED:
        logger.info("Web search disabled by config")
        return {"web_available": False}

    searxng_ok, webreader_ok = await asyncio.gather(
        web.check_searxng_health(),
        web.check_webreader_health(),
    )
    available = searxng_ok and webreader_ok
    logger.info(
        "Web availability: searxng=%s webreader=%s → %s",
        searxng_ok, webreader_ok, available,
    )
    return {"web_available": available}


async def plan_search(state: ResearchState) -> dict[str, Any]:
    """LLM decides which DB and web search queries to run."""
    iteration = state["iteration"] + 1
    today = date.today().isoformat()
    web_available = state.get("web_available", False)

    already_tried = state["queries_tried"]
    found_count = len(state["found_article_ids"])
    web_results_count = len(state.get("web_search_results", []))

    summaries_preview = ""
    if state["read_summaries"]:
        items = list(state["read_summaries"].values())[:10]
        summaries_preview = "\n".join(
            f"- [{s.get('feed_region_id', '?')}] {s.get('translated_title') or s.get('original_title', '?')}: {s.get('summary_tldr', 'no summary')}"
            for s in items
        )

    web_preview = ""
    if state.get("web_page_summaries"):
        items = list(state["web_page_summaries"].values())[:5]
        web_preview = "\n".join(
            f"- [WEB] {s.get('title', '?')}: {s.get('summary', 'no summary')[:100]}"
            for s in items
        )

    web_instructions = ""
    if web_available:
        web_instructions = """
You also have access to WEB SEARCH via SearXNG. Use web searches when:
- The query asks about recent events or "today" / "this week" / current developments
- Few or no articles were found in the database
- Broader context would help (background, international reactions, etc.)

Include web searches in your plan as "web_searches" — each with a "query" and optional "language" (default "en").
"""

    prompt = f"""You are a research assistant for a Japanese media intelligence platform.
Today's date: {today}

The user asked: "{state['original_query']}"

Filters: {json.dumps(state['filters'])}
Iteration: {iteration}/{RESEARCH_MAX_ITERATIONS}
DB articles found so far: {found_count}
Web results found so far: {web_results_count}
Queries already tried: {json.dumps(already_tried)}

{f"Summaries of DB articles found so far:\n{summaries_preview}" if summaries_preview else "No DB articles found yet."}
{f"\nWeb source summaries:\n{web_preview}" if web_preview else ""}
{web_instructions}
Generate 1-3 DATABASE search queries to find relevant articles. Use different angles and phrasings.
Each query should specify a search mode: "keyword", "semantic", or "hybrid".
Prefer "hybrid" for broad queries and "keyword" for specific terms.

Respond with ONLY a JSON object (no markdown):
{{"db_searches": [{{"query": "...", "mode": "hybrid", "region": null}}], {'"web_searches": [{"query": "...", "language": "en"}], ' if web_available else ''}"reasoning": "..."}}
"""

    await _emit(state, "status", {"type": "planning", "iteration": iteration})

    content = (await _stream_llm(state, "planning", prompt)).strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
        plan = PlanSearchOutput(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("Failed to parse plan_search output: %s — %s", e, content[:200])
        plan = PlanSearchOutput(
            db_searches=[SearchQuery(query=state["original_query"], mode="hybrid")],
            reasoning="Fallback to original query",
        )

    new_queries = [s.query for s in plan.db_searches if s.query not in already_tried]
    new_queries += [s.query for s in plan.web_searches if s.query not in already_tried]
    if not new_queries and iteration == 1:
        new_queries = [state["original_query"]]
        plan.db_searches = [SearchQuery(query=state["original_query"], mode="hybrid")]

    return {
        "iteration": iteration,
        "queries_tried": already_tried + new_queries,
        "search_log": state["search_log"] + [
            {
                "iteration": iteration,
                "db_planned": [s.model_dump() for s in plan.db_searches],
                "web_planned": [s.model_dump() for s in plan.web_searches],
                "reasoning": plan.reasoning,
            }
        ],
        "_planned_db_searches": plan.db_searches,
        "_planned_web_searches": plan.web_searches if web_available else [],
    }


async def execute_db_searches(state: ResearchState) -> dict[str, Any]:
    """Run the planned DB search queries."""
    planned: list[SearchQuery] = state.get("_planned_db_searches", [])
    logger.info("execute_db_searches: %d planned queries", len(planned))
    filters = state["filters"]
    exclude = set(state["found_article_ids"])
    new_ids: list[int] = []

    for sq in planned:
        await _emit(state, "status", {
            "type": "searching",
            "query": sq.query,
            "mode": sq.mode,
            "iteration": state["iteration"],
        })

        region = sq.region or filters.get("region")
        date_from = filters.get("date_from")
        date_to = filters.get("date_to")

        try:
            if sq.mode == "keyword":
                results = await db.keyword_search(sq.query, 50, region, date_from, date_to, exclude)
            elif sq.mode == "semantic":
                results = await db.semantic_search(sq.query, 50, region, date_from, date_to, exclude)
            else:
                results = await db.hybrid_search(sq.query, 50, region, date_from, date_to, exclude)
            logger.info("DB search '%s' (%s): %d results", sq.query, sq.mode, len(results))
        except Exception as e:
            logger.error("DB search '%s' (%s) failed: %s", sq.query, sq.mode, e)
            results = []

        batch_ids = [r["id"] for r in results if r["id"] not in exclude]
        new_ids.extend(batch_ids)
        exclude.update(batch_ids)

        await _emit(state, "status", {
            "type": "found",
            "query": sq.query,
            "new_articles": len(batch_ids),
            "total": len(exclude),
        })

    all_ids = state["found_article_ids"] + new_ids
    return {"found_article_ids": all_ids}


async def execute_web_searches(state: ResearchState) -> dict[str, Any]:
    """Run planned web searches via SearXNG."""
    planned: list[WebSearchQuery] = state.get("_planned_web_searches", [])
    if not planned:
        return {"web_search_results": state.get("web_search_results", [])}

    logger.info("execute_web_searches: %d planned queries", len(planned))
    existing_results = list(state.get("web_search_results", []))
    seen_urls = {r["url"] for r in existing_results}

    for wsq in planned:
        await _emit(state, "status", {
            "type": "web_searching",
            "query": wsq.query,
        })

        results = await web.searxng_search(wsq.query, language=wsq.language)
        new_results = [r for r in results if r["url"] not in seen_urls]
        existing_results.extend(new_results)
        seen_urls.update(r["url"] for r in new_results)

        await _emit(state, "status", {
            "type": "web_found",
            "query": wsq.query,
            "new_results": len(new_results),
            "total": len(existing_results),
        })

    return {"web_search_results": existing_results}


async def read_sources(state: ResearchState) -> dict[str, Any]:
    """Fetch DB article summaries and read top web pages."""
    updates: dict[str, Any] = {}

    # 1. DB article summaries
    existing_summaries = state["read_summaries"]
    new_ids = [aid for aid in state["found_article_ids"] if aid not in existing_summaries]
    if new_ids:
        await _emit(state, "status", {"type": "reading", "count": len(new_ids)})
        fetched = await db.get_article_summaries(new_ids)
        updates["read_summaries"] = {**existing_summaries, **fetched}

    # 2. Web page reading via webreader
    web_results = state.get("web_search_results", [])
    existing_web = state.get("web_page_summaries", {})
    urls_tried = set(state.get("urls_tried", []))

    # Select top unread URLs
    urls_to_read = []
    for r in web_results:
        url = r["url"]
        if url not in existing_web and url not in urls_tried:
            urls_to_read.append({"url": url, "query": state["original_query"]})
        if len(urls_to_read) >= WEB_READ_MAX_PAGES:
            break

    if urls_to_read:
        await _emit(state, "status", {
            "type": "web_reading",
            "count": len(urls_to_read),
        })

        page_results = await web.read_web_pages(urls_to_read)
        new_urls_tried = [u["url"] for u in urls_to_read]

        await _emit(state, "status", {
            "type": "web_read",
            "count": len([r for r in page_results.values() if r.get("success")]),
            "total": len(urls_to_read),
        })

        updates["web_page_summaries"] = {**existing_web, **page_results}
        updates["urls_tried"] = list(urls_tried) + new_urls_tried

    return updates


async def analyze_and_decide(state: ResearchState) -> dict[str, Any]:
    """LLM reviews findings and decides whether to expand or compile."""
    today = date.today().isoformat()
    iteration = state["iteration"]
    summaries = state["read_summaries"]
    web_summaries = state.get("web_page_summaries", {})

    await _emit(state, "status", {"type": "analyzing", "iteration": iteration})

    summary_text = "\n".join(
        f"[ID:{aid}] [{s.get('feed_region_id', '?')}] {s.get('translated_title') or s.get('original_title', '?')}\n  TLDR: {s.get('summary_tldr', 'N/A')}\n  Tags: {s.get('summary_tags', [])}\n  Sentiment: {s.get('summary_sentiment', '?')}"
        for aid, s in list(summaries.items())[:40]
    )

    web_text = ""
    if web_summaries:
        web_items = [
            f"[WEB: {url}] {s.get('title', '?')}\n  Summary: {s.get('summary', 'N/A')}"
            for url, s in list(web_summaries.items())[:10]
            if s.get("success", False)
        ]
        if web_items:
            web_text = "\n\nWeb source summaries:\n" + "\n".join(web_items)

    prompt = f"""You are a research assistant analyzing articles about: "{state['original_query']}"
Today's date: {today}

Iteration {iteration}/{RESEARCH_MAX_ITERATIONS}. DB articles reviewed: {len(summaries)}. Web pages read: {len(web_summaries)}.
Queries tried: {json.dumps(state['queries_tried'])}

Article summaries:
{summary_text}
{web_text}

Decide whether to:
1. "expand" - search for more articles with new angles (if important aspects are missing)
2. "compile" - enough information gathered, produce the final report

{"You MUST choose 'compile' as this is the last iteration." if iteration >= RESEARCH_MAX_ITERATIONS else ""}
{"Consider compiling — you have a good number of sources." if len(summaries) + len(web_summaries) >= 20 else ""}

Respond with ONLY a JSON object (no markdown):
{{"action": "expand" or "compile", "reasoning": "...", "new_angles": ["query1", "query2"]}}
"""

    content = (await _stream_llm(state, "analyzing", prompt)).strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
        decision = AnalyzeDecision(**parsed)
    except (json.JSONDecodeError, Exception):
        decision = AnalyzeDecision(action="compile", reasoning="Parse error, compiling with available data")

    if iteration >= RESEARCH_MAX_ITERATIONS:
        decision.action = "compile"

    if decision.action == "expand":
        await _emit(state, "status", {
            "type": "expanding",
            "reasoning": decision.reasoning,
            "new_queries": decision.new_angles,
        })

    return {"_decision": decision.action, "_new_angles": decision.new_angles}


async def compile_report(state: ResearchState) -> dict[str, Any]:
    """LLM produces the final structured report."""
    today = date.today().isoformat()
    summaries = state["read_summaries"]
    web_summaries = state.get("web_page_summaries", {})

    summary_text = "\n".join(
        f"[ID:{aid}] [{s.get('feed_region_id', '?')}] {s.get('translated_title') or s.get('original_title', '?')}\n  TLDR: {s.get('summary_tldr', 'N/A')}\n  Tags: {json.dumps(s.get('summary_tags', []))}\n  Sentiment: {s.get('summary_sentiment', '?')}\n  Source: {s.get('feed_source_name', '?')}\n  Published: {s.get('published_at', '?')}"
        for aid, s in list(summaries.items())[:50]
    )

    web_text = ""
    if web_summaries:
        web_items = [
            f"[WEB: {url}] {s.get('title', '?')}\n  Summary: {s.get('summary', 'N/A')}\n  Key points: {json.dumps(s.get('key_points', []))}"
            for url, s in list(web_summaries.items())[:10]
            if s.get("success", False)
        ]
        if web_items:
            web_text = "\n\nWeb sources:\n" + "\n".join(web_items)

    web_source_instruction = ""
    if web_summaries:
        web_source_instruction = """- "web_sources": Array of relevant web sources, each with {"url": "...", "title": "...", "relevance_reason": "why this source matters"}"""

    prompt = f"""You are a research analyst producing a comprehensive report about: "{state['original_query']}"
Today's date: {today}

Based on {len(summaries)} database articles and {len(web_summaries)} web sources, produce a structured report.

Article data:
{summary_text}
{web_text}

Produce a JSON report with:
- "summary": A comprehensive 2-4 paragraph overview synthesizing key themes across all sources
- "key_findings": Array of 3-7 bullet-point findings (strings)
- "regional_perspectives": Object mapping region codes to 1-2 sentence perspectives (e.g. {{"jp": "...", "us": "..."}})
- "tags": Array of relevant topic tags
- "sentiment": Overall sentiment ("positive", "negative", "neutral", "mixed")
- "top_articles": Array of the 10-15 most relevant DB articles, each with {{"article_id": int, "relevance_reason": "why this article matters"}}
{web_source_instruction}

Respond with ONLY a JSON object (no markdown):
"""

    await _emit(state, "status", {"type": "compiling"})

    content = (await _stream_llm(state, "compiling", prompt)).strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
        report = CompiledReport(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("Failed to parse compile_report output: %s", e)
        report = CompiledReport(
            summary=f"Research on \"{state['original_query']}\" found {len(summaries)} relevant articles and {len(web_summaries)} web sources.",
            key_findings=[f"Found {len(summaries)} articles and {len(web_summaries)} web sources."],
            tags=[],
        )

    report_dict = report.model_dump()

    # Build article list with full metadata for top articles
    top_ids = [a.article_id for a in report.top_articles]
    reason_map = {a.article_id: a.relevance_reason for a in report.top_articles}

    articles_list: list[dict[str, Any]] = []
    for aid in top_ids:
        if aid in summaries:
            art = {**summaries[aid], "relevance_reason": reason_map.get(aid, "")}
            articles_list.append(art)

    # If LLM didn't rank enough, add remaining by order found
    if len(articles_list) < 10:
        for aid, s in summaries.items():
            if aid not in {a["id"] for a in articles_list}:
                articles_list.append({**s, "relevance_reason": ""})
            if len(articles_list) >= 15:
                break

    await _emit(state, "result", {
        "report": report_dict,
        "articles": articles_list,
    })

    return {"report": report_dict, "top_articles": articles_list}


# ── Routing ───────────────────────────────────────────────────────────

def should_expand_or_compile(state: ResearchState) -> str:
    decision = state.get("_decision", "compile")
    if decision == "expand":
        return "plan_search"
    return "compile_report"


# ── Graph ─────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(ResearchState)

    graph.add_node("check_web_availability", check_web_availability)
    graph.add_node("plan_search", plan_search)
    graph.add_node("execute_db_searches", execute_db_searches)
    graph.add_node("execute_web_searches", execute_web_searches)
    graph.add_node("read_sources", read_sources)
    graph.add_node("analyze_and_decide", analyze_and_decide)
    graph.add_node("compile_report", compile_report)

    graph.add_edge(START, "check_web_availability")
    graph.add_edge("check_web_availability", "plan_search")
    # Fan-out: plan_search → both execute nodes in parallel
    graph.add_edge("plan_search", "execute_db_searches")
    graph.add_edge("plan_search", "execute_web_searches")
    # Fan-in: both execute nodes → read_sources
    graph.add_edge("execute_db_searches", "read_sources")
    graph.add_edge("execute_web_searches", "read_sources")
    graph.add_edge("read_sources", "analyze_and_decide")
    graph.add_conditional_edges(
        "analyze_and_decide",
        should_expand_or_compile,
        {"plan_search": "plan_search", "compile_report": "compile_report"},
    )
    graph.add_edge("compile_report", END)

    return graph.compile()


research_graph = build_graph()


async def run_research(
    query: str,
    filters: dict[str, Any] | None = None,
    event_queue: asyncio.Queue | None = None,
) -> ResearchState:
    """Execute the research graph and return the final state."""
    initial_state: ResearchState = {
        "original_query": query,
        "filters": filters or {},
        "found_article_ids": [],
        "read_summaries": {},
        "queries_tried": [],
        "iteration": 0,
        "report": None,
        "top_articles": None,
        "search_log": [],
        # Web search state
        "web_search_results": [],
        "web_page_summaries": {},
        "urls_tried": [],
        "web_available": False,
        # Internal keys
        "_event_queue": event_queue,
        "_planned_db_searches": [],
        "_planned_web_searches": [],
        "_decision": "",
        "_new_angles": [],
    }

    result = await research_graph.ainvoke(initial_state)
    return result
