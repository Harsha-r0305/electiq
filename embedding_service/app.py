"""
Local embedding service for ElectIQ. Loads all-MiniLM-L6-v2 ONCE and serves 384-d, L2-normalised vectors.
No paid API, no API key. Start:   uvicorn app:app --host 127.0.0.1 --port 8001   (from embedding_service/)
"""
import os
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from backend import load_model, DIM

TOKEN = os.environ.get("EMBEDDING_SERVICE_TOKEN")  # optional shared secret
model, MODEL_NAME = load_model()

app = FastAPI(title="ElectIQ embedding service")

class Req(BaseModel):
    text: str = Field(min_length=1, max_length=2000)

@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_NAME, "dimensions": DIM}

@app.post("/embed")
def embed(req: Req, x_service_token: str | None = Header(default=None)):
    if TOKEN and x_service_token != TOKEN:
        raise HTTPException(status_code=401, detail="bad token")
    v = model.encode([req.text], normalize_embeddings=True)[0]
    v = [float(x) for x in v]
    return {"embedding": v, "model": MODEL_NAME, "dimensions": len(v)}
