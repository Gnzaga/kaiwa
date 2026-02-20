from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from playwright.async_api import Browser, async_playwright
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from readabilipy import simple_json_from_html_string

from config import (
    MAX_CONCURRENT_PAGES,
    MAX_CONTENT_LENGTH,
    OPENROUTER_API_KEY,
    PAGE_LOAD_TIMEOUT_MS,
    RESEARCH_MODEL,
)

logger = logging.getLogger(__name__)

browser: Browser | None = None
_semaphore: asyncio.Semaphore = asyncio.Semaphore(MAX_CONCURRENT_PAGES)
_playwright_ctx = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global browser, _playwright_ctx
    _playwright_ctx = await async_playwright().start()
    browser = await _playwright_ctx.chromium.launch(
        args=["--no-sandbox", "--disable-dev-shm-usage"],
    )
    logger.info("Playwright browser launched")
    yield
    if browser:
        await browser.close()
    if _playwright_ctx:
        await _playwright_ctx.stop()
    logger.info("Playwright browser closed")


app = FastAPI(title="kaiwa-webreader", lifespan=lifespan)


# ── Models ────────────────────────────────────────────────────────────


class ReadRequest(BaseModel):
    url: str
    query: str


class BatchReadRequest(BaseModel):
    urls: list[ReadRequest]


class ReadResult(BaseModel):
    url: str
    title: str | None = None
    summary: str | None = None
    key_points: list[str] = []
    extracted_length: int = 0
    success: bool = True
    error: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────


def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=RESEARCH_MODEL,
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.2,
        max_tokens=2048,
    )


async def _extract_page(url: str) -> tuple[str | None, str]:
    """Navigate to URL with Playwright and extract readable content."""
    async with _semaphore:
        if not browser:
            raise RuntimeError("Browser not initialized")
        page = await browser.new_page()
        try:
            await page.goto(url, timeout=PAGE_LOAD_TIMEOUT_MS, wait_until="networkidle")
            html = await page.content()
        finally:
            await page.close()

    article = simple_json_from_html_string(html, use_readability=True)
    title = article.get("title")
    # readabilipy returns plain_text as list of dicts with "text" key
    plain_content = article.get("plain_text") or []
    if isinstance(plain_content, list):
        text = "\n".join(p.get("text", "") for p in plain_content if isinstance(p, dict))
    else:
        text = str(plain_content)

    if len(text) > MAX_CONTENT_LENGTH:
        text = text[:MAX_CONTENT_LENGTH] + "\n\n[Content truncated]"

    return title, text


async def _summarize(url: str, query: str, title: str | None, content: str) -> ReadResult:
    """LLM-summarize extracted page content."""
    if not content.strip():
        return ReadResult(url=url, title=title, success=True, summary="Page had no extractable content.")

    llm = _get_llm()
    prompt = f"""You are summarizing a web page for a research query.

Research query: "{query}"
Page URL: {url}
Page title: {title or "Unknown"}

Page content:
{content}

Extract the key information relevant to the research query. Respond with ONLY a JSON object:
{{"summary": "1-2 paragraph summary of relevant content", "key_points": ["point 1", "point 2", "point 3"]}}
"""
    try:
        resp = await llm.ainvoke(prompt)
        text = resp.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        import json
        parsed = json.loads(text)
        return ReadResult(
            url=url,
            title=title,
            summary=parsed.get("summary", ""),
            key_points=parsed.get("key_points", []),
            extracted_length=len(content),
            success=True,
        )
    except Exception as e:
        logger.warning("LLM summarize failed for %s: %s", url, e)
        # Return raw truncated content as fallback
        return ReadResult(
            url=url,
            title=title,
            summary=content[:500] + "..." if len(content) > 500 else content,
            extracted_length=len(content),
            success=True,
        )


async def _read_single(req: ReadRequest) -> ReadResult:
    """Full pipeline: navigate → extract → summarize."""
    try:
        title, content = await _extract_page(req.url)
        return await _summarize(req.url, req.query, title, content)
    except Exception as e:
        logger.error("Failed to read %s: %s", req.url, e)
        return ReadResult(url=req.url, success=False, error=str(e))


# ── Routes ────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "browser": browser is not None}


@app.post("/read", response_model=ReadResult)
async def read_page(req: ReadRequest):
    return await _read_single(req)


@app.post("/read/batch", response_model=list[ReadResult])
async def read_batch(req: BatchReadRequest):
    tasks = [_read_single(r) for r in req.urls]
    return await asyncio.gather(*tasks)
