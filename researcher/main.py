from __future__ import annotations

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

import db
from agent import run_research
from models import ResearchRequest, ResearchTaskResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Track active research streams: task_id -> asyncio.Queue
_active_streams: dict[str, asyncio.Queue] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.ensure_table()
    logger.info("research_tasks table ensured")
    yield
    await db.close_pool()


app = FastAPI(title="kaiwa-researcher", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "kaiwa-researcher"}


@app.get("/health/detailed")
async def health_detailed():
    import web
    searxng_ok, webreader_ok = await asyncio.gather(
        web.check_searxng_health(),
        web.check_webreader_health(),
    )
    return {
        "status": "ok",
        "service": "kaiwa-researcher",
        "web_search": searxng_ok,
        "web_reader": webreader_ok,
    }


@app.post("/research")
async def create_research(req: ResearchRequest):
    task_id = f"res_{uuid.uuid4().hex[:12]}"
    filters = req.filters.model_dump() if req.filters else None

    await db.create_task(task_id, req.query, filters)

    event_queue: asyncio.Queue = asyncio.Queue()
    _active_streams[task_id] = event_queue

    asyncio.create_task(_run_research_task(task_id, req.query, filters, event_queue))

    return ResearchTaskResponse(id=task_id, status="running", query=req.query)


async def _run_research_task(
    task_id: str,
    query: str,
    filters: dict[str, Any] | None,
    event_queue: asyncio.Queue,
) -> None:
    events_log: list[dict[str, Any]] = []
    try:
        # Wrap the queue to also log events
        logging_queue: asyncio.Queue = asyncio.Queue()

        async def _proxy_events():
            while True:
                evt = await logging_queue.get()
                if evt.get("event") != "progress":
                    events_log.append(evt)
                await event_queue.put(evt)
                if evt.get("event") == "done":
                    break

        proxy_task = asyncio.create_task(_proxy_events())

        result = await run_research(query, filters, logging_queue)

        report = result.get("report") or {}
        articles = result.get("top_articles") or []
        search_log = result.get("search_log") or []

        await logging_queue.put({"event": "done", "data": {}})
        await proxy_task

        await db.update_task_complete(task_id, report, articles, search_log, events_log)
    except Exception as e:
        logger.exception("Research task %s failed", task_id)
        error_msg = str(e)
        await event_queue.put({"event": "status", "data": {"type": "error", "message": error_msg}})
        await event_queue.put({"event": "done", "data": {}})
        await db.update_task_error(task_id, error_msg)
    finally:
        _active_streams.pop(task_id, None)


@app.get("/research/{task_id}/stream")
async def stream_research(task_id: str):
    queue = _active_streams.get(task_id)

    if queue is None:
        # Task might be complete already — check DB
        task = await db.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")

        # Replay events from DB if available
        async def replay_events():
            events = task.get("events") or []
            for evt in events:
                yield {
                    "event": evt.get("event", "status"),
                    "data": json.dumps(evt.get("data", {})),
                }
            if task["status"] == "complete" and task.get("report"):
                yield {
                    "event": "result",
                    "data": json.dumps({
                        "report": task["report"],
                        "articles": task.get("articles", []),
                    }),
                }
            yield {"event": "done", "data": "{}"}

        return EventSourceResponse(replay_events())

    async def event_generator():
        while True:
            evt = await queue.get()
            event_type = evt.get("event", "status")
            data = evt.get("data", {})
            yield {"event": event_type, "data": json.dumps(data)}
            if event_type == "done":
                break

    return EventSourceResponse(event_generator())


@app.get("/research/{task_id}")
async def get_research(task_id: str):
    task = await db.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["status"] == "running":
        return JSONResponse(
            status_code=202,
            content={"id": task_id, "status": "running", "query": task["query"]},
        )

    return task


@app.get("/research")
async def list_research(limit: int = 20, offset: int = 0):
    tasks = await db.list_tasks(limit, offset)
    return {"data": tasks}
