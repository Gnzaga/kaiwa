from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langchain_openai import ChatOpenAI

from config import OPENROUTER_API_KEY, RESEARCH_MAX_ITERATIONS, RESEARCH_MODEL
from models import AnalyzeDecision, CompiledReport, PlanSearchOutput, SearchQuery
import db

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
    # Event queue reference (set externally before invoke)
    _event_queue: asyncio.Queue | None


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


# ── Nodes ─────────────────────────────────────────────────────────────

async def plan_search(state: ResearchState) -> dict[str, Any]:
    """LLM decides which search queries to run."""
    iteration = state["iteration"] + 1
    llm = _get_llm()

    already_tried = state["queries_tried"]
    found_count = len(state["found_article_ids"])
    summaries_preview = ""
    if state["read_summaries"]:
        items = list(state["read_summaries"].values())[:10]
        summaries_preview = "\n".join(
            f"- [{s.get('feed_region_id', '?')}] {s.get('translated_title') or s.get('original_title', '?')}: {s.get('summary_tldr', 'no summary')}"
            for s in items
        )

    prompt = f"""You are a research assistant for a Japanese media intelligence platform.
The user asked: "{state['original_query']}"

Filters: {json.dumps(state['filters'])}
Iteration: {iteration}/{RESEARCH_MAX_ITERATIONS}
Articles found so far: {found_count}
Queries already tried: {json.dumps(already_tried)}

{f"Summaries of articles found so far:\n{summaries_preview}" if summaries_preview else "No articles found yet."}

Generate 1-3 search queries to find relevant articles. Use different angles and phrasings.
Each query should specify a search mode: "keyword", "semantic", or "hybrid".
Prefer "hybrid" for broad queries and "keyword" for specific terms.

Respond with ONLY a JSON object (no markdown):
{{"searches": [{{"query": "...", "mode": "hybrid", "region": null}}], "reasoning": "..."}}
"""

    resp = await llm.ainvoke(prompt)
    content = resp.content.strip()
    # Parse JSON from response (handle markdown code blocks)
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
        plan = PlanSearchOutput(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("Failed to parse plan_search output: %s — %s", e, content[:200])
        plan = PlanSearchOutput(
            searches=[SearchQuery(query=state["original_query"], mode="hybrid")],
            reasoning="Fallback to original query",
        )

    new_queries = [s.query for s in plan.searches if s.query not in already_tried]
    if not new_queries and iteration == 1:
        new_queries = [state["original_query"]]
        plan.searches = [SearchQuery(query=state["original_query"], mode="hybrid")]

    return {
        "iteration": iteration,
        "queries_tried": already_tried + new_queries,
        "search_log": state["search_log"] + [
            {"iteration": iteration, "planned": [s.model_dump() for s in plan.searches], "reasoning": plan.reasoning}
        ],
        "_planned_searches": plan.searches,
    }


async def execute_searches(state: ResearchState) -> dict[str, Any]:
    """Run the planned search queries against the database."""
    planned: list[SearchQuery] = state.get("_planned_searches", [])
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

        if sq.mode == "keyword":
            results = await db.keyword_search(sq.query, 50, region, date_from, date_to, exclude)
        elif sq.mode == "semantic":
            results = await db.semantic_search(sq.query, 50, region, date_from, date_to, exclude)
        else:
            results = await db.hybrid_search(sq.query, 50, region, date_from, date_to, exclude)

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


async def read_summaries(state: ResearchState) -> dict[str, Any]:
    """Fetch summaries for newly found articles."""
    existing = state["read_summaries"]
    new_ids = [aid for aid in state["found_article_ids"] if aid not in existing]

    if new_ids:
        await _emit(state, "status", {"type": "reading", "count": len(new_ids)})
        fetched = await db.get_article_summaries(new_ids)
        merged = {**existing, **fetched}
        return {"read_summaries": merged}

    return {}


async def analyze_and_decide(state: ResearchState) -> dict[str, Any]:
    """LLM reviews findings and decides whether to expand or compile."""
    llm = _get_llm()
    iteration = state["iteration"]
    summaries = state["read_summaries"]

    await _emit(state, "status", {"type": "analyzing", "iteration": iteration})

    summary_text = "\n".join(
        f"[ID:{aid}] [{s.get('feed_region_id', '?')}] {s.get('translated_title') or s.get('original_title', '?')}\n  TLDR: {s.get('summary_tldr', 'N/A')}\n  Tags: {s.get('summary_tags', [])}\n  Sentiment: {s.get('summary_sentiment', '?')}"
        for aid, s in list(summaries.items())[:40]
    )

    prompt = f"""You are a research assistant analyzing articles about: "{state['original_query']}"

Iteration {iteration}/{RESEARCH_MAX_ITERATIONS}. Articles reviewed: {len(summaries)}.
Queries tried: {json.dumps(state['queries_tried'])}

Article summaries:
{summary_text}

Decide whether to:
1. "expand" - search for more articles with new angles (if important aspects are missing)
2. "compile" - enough information gathered, produce the final report

{"You MUST choose 'compile' as this is the last iteration." if iteration >= RESEARCH_MAX_ITERATIONS else ""}
{"Consider compiling — you have a good number of articles." if len(summaries) >= 20 else ""}

Respond with ONLY a JSON object (no markdown):
{{"action": "expand" or "compile", "reasoning": "...", "new_angles": ["query1", "query2"]}}
"""

    resp = await llm.ainvoke(prompt)
    content = resp.content.strip()
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
    llm = _get_llm()
    summaries = state["read_summaries"]

    summary_text = "\n".join(
        f"[ID:{aid}] [{s.get('feed_region_id', '?')}] {s.get('translated_title') or s.get('original_title', '?')}\n  TLDR: {s.get('summary_tldr', 'N/A')}\n  Tags: {json.dumps(s.get('summary_tags', []))}\n  Sentiment: {s.get('summary_sentiment', '?')}\n  Source: {s.get('feed_source_name', '?')}\n  Published: {s.get('published_at', '?')}"
        for aid, s in list(summaries.items())[:50]
    )

    prompt = f"""You are a research analyst producing a comprehensive report about: "{state['original_query']}"

Based on {len(summaries)} articles from various sources and regions, produce a structured report.

Article data:
{summary_text}

Produce a JSON report with:
- "summary": A comprehensive 2-4 paragraph overview synthesizing key themes across all articles
- "key_findings": Array of 3-7 bullet-point findings (strings)
- "regional_perspectives": Object mapping region codes to 1-2 sentence perspectives (e.g. {{"jp": "...", "us": "..."}})
- "tags": Array of relevant topic tags
- "sentiment": Overall sentiment ("positive", "negative", "neutral", "mixed")
- "top_articles": Array of the 10-15 most relevant articles, each with {{"article_id": int, "relevance_reason": "why this article matters"}}

Respond with ONLY a JSON object (no markdown):
"""

    resp = await llm.ainvoke(prompt)
    content = resp.content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
        report = CompiledReport(**parsed)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("Failed to parse compile_report output: %s", e)
        report = CompiledReport(
            summary=f"Research on \"{state['original_query']}\" found {len(summaries)} relevant articles.",
            key_findings=[f"Found {len(summaries)} articles across multiple sources."],
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

    graph.add_node("plan_search", plan_search)
    graph.add_node("execute_searches", execute_searches)
    graph.add_node("read_summaries", read_summaries)
    graph.add_node("analyze_and_decide", analyze_and_decide)
    graph.add_node("compile_report", compile_report)

    graph.add_edge(START, "plan_search")
    graph.add_edge("plan_search", "execute_searches")
    graph.add_edge("execute_searches", "read_summaries")
    graph.add_edge("read_summaries", "analyze_and_decide")
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
        "_event_queue": event_queue,
    }

    result = await research_graph.ainvoke(initial_state)
    return result
