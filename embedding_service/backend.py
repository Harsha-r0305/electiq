"""Single place that loads the embedding model, shared by the service and scripts/generate_embeddings.py,
so queries and courses are always embedded by the SAME model."""
import os

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
DIM = 384

def load_model():
    """Returns (model, model_name). Real all-MiniLM-L6-v2 unless EMBEDDING_ALLOW_STUB=1 (automated tests only)."""
    if os.environ.get("EMBEDDING_ALLOW_STUB") == "1":
        import hashlib, math, re
        class _Stub:  # deterministic hashed bag-of-words. NOT a semantic model.
            def encode(self, texts, normalize_embeddings=True, **_):
                out = []
                for t in texts:
                    v = [0.0] * DIM
                    for w in re.findall(r"[a-z0-9]+", t.lower()):
                        v[int(hashlib.md5(w.encode()).hexdigest(), 16) % DIM] += 1.0
                    n = math.sqrt(sum(x * x for x in v)) or 1.0
                    out.append([x / n for x in v])
                return out
        return _Stub(), "TEST-STUB-hashed-bow"
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(MODEL_NAME)
    assert model.get_sentence_embedding_dimension() == DIM, "model dimension mismatch"
    return model, MODEL_NAME
