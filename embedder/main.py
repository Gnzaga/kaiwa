from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

model: SentenceTransformer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    model = SentenceTransformer("all-MiniLM-L6-v2")
    yield
    model = None


app = FastAPI(title="kaiwa-embedder", lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    if not req.texts:
        return EmbedResponse(embeddings=[])
    embeddings = model.encode(req.texts, normalize_embeddings=True)
    return EmbedResponse(embeddings=embeddings.tolist())


@app.get("/health")
async def health():
    return {"status": "ok", "model": "all-MiniLM-L6-v2", "dimensions": 384}
