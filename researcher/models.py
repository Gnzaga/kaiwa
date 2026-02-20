from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Request / Response ────────────────────────────────────────────────

class ResearchRequest(BaseModel):
    query: str
    filters: SearchFilters | None = None


class SearchFilters(BaseModel):
    region: str | None = None
    date_from: str | None = None
    date_to: str | None = None


class ResearchTaskResponse(BaseModel):
    id: str
    status: str
    query: str


class ResearchTaskFull(BaseModel):
    id: str
    query: str
    filters: dict[str, Any] | None = None
    status: str
    report: dict[str, Any] | None = None
    articles: list[dict[str, Any]] | None = None
    search_log: list[dict[str, Any]] | None = None
    error: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None


# ── SSE Events ────────────────────────────────────────────────────────

class SSESearching(BaseModel):
    type: str = "searching"
    query: str
    mode: str
    iteration: int


class SSEFound(BaseModel):
    type: str = "found"
    query: str
    new_articles: int
    total: int


class SSEReading(BaseModel):
    type: str = "reading"
    count: int


class SSEAnalyzing(BaseModel):
    type: str = "analyzing"
    iteration: int


class SSEExpanding(BaseModel):
    type: str = "expanding"
    reasoning: str
    new_queries: list[str]


class SSEResult(BaseModel):
    type: str = "result"
    report: dict[str, Any]
    articles: list[dict[str, Any]]


class SSEError(BaseModel):
    type: str = "error"
    message: str


# ── Agent State ───────────────────────────────────────────────────────

class SearchQuery(BaseModel):
    query: str
    mode: str = "hybrid"  # keyword | semantic | hybrid
    region: str | None = None


class WebSearchQuery(BaseModel):
    query: str
    language: str = "en"


class PlanSearchOutput(BaseModel):
    # New format: separate db/web searches
    db_searches: list[SearchQuery] = Field(default_factory=list)
    web_searches: list[WebSearchQuery] = Field(default_factory=list)
    reasoning: str
    # Backward compat: if LLM outputs old "searches" key, map to db_searches
    searches: list[SearchQuery] | None = Field(default=None, exclude=True)

    def __init__(self, **data):
        # If old format "searches" key is present, map to db_searches
        if "searches" in data and "db_searches" not in data:
            data["db_searches"] = data.pop("searches")
        super().__init__(**data)


class AnalyzeDecision(BaseModel):
    action: str  # "expand" | "compile"
    reasoning: str
    new_angles: list[str] = Field(default_factory=list)


class ArticleRanking(BaseModel):
    article_id: int
    relevance_reason: str


class WebSourceReference(BaseModel):
    url: str
    title: str
    relevance_reason: str = ""


class CompiledReport(BaseModel):
    summary: str
    key_findings: list[str]
    regional_perspectives: dict[str, str] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    sentiment: str = "neutral"
    top_articles: list[ArticleRanking] = Field(default_factory=list)
    web_sources: list[WebSourceReference] = Field(default_factory=list)
