# AI-Powered Semantic Elective Search ("Discover Electives with AI")

> **Verification status:** the database layer, API, UI and tests were run end-to-end, but in an environment
> that could not download the `all-MiniLM-L6-v2` weights. The tests there used a clearly labelled **test stub**
> (`EMBEDDING_ALLOW_STUB=1`, hashed bag-of-words, *not* semantic). **Search quality with the real model has not
> been measured.** Run `npm run test:semantic` on your machine after generating real embeddings.

## 1. Why embeddings
A student types a sentence ("build intelligent chatbots and language models"). Keyword matching only finds courses containing those exact words. An embedding turns text into a vector so that texts with similar *meaning* land close together, letting "chatbots" match courses about NLP, LLMs and transformers.

## 2. Why all-MiniLM-L6-v2
Small (~90 MB), fast on CPU, runs locally (no paid API, no key), good general-purpose sentence similarity, 384-dimension output (small index). The same model embeds courses and queries.

## 3. What is embedded
Per active course, one text built from: title, vertical (area), a description, topics, skills taught (real, from `course_skills`) and learning outcomes. Stored in `course_embeddings.content`.

**Important – supplementary data is synthetic.** The curriculum contains no descriptions/topics/outcomes. `scripts/generate_supplementary_data.py` derives them deterministically from the real title, vertical and linked skills and stores them in `course_supplementary_info` with `is_synthetic = true` and a `source` string. They are *not* university-approved; the UI labels the description "Auto-generated summary, not official course text." Replace them with real syllabus text whenever you have it, then re-run the embedding script.

## 4. Why 384 dimensions
It is the fixed output size of all-MiniLM-L6-v2. The column is `VECTOR(384)` so a wrong-sized vector is rejected by the database.

## 5. How embeddings are generated
`scripts/generate_embeddings.py` loads the model once, builds each course text, hashes it, and embeds only courses that are new, changed (hash differs) or embedded with another model. Vectors are L2-normalised. It upserts on `course_id` (no duplicates) and prints `generated / updated / skipped`. It is a separate step – nothing is embedded per search except the student's one query.

## 6. Storage
`db/12_vector_search.sql` creates `course_embeddings(id, course_id UNIQUE FK ON DELETE CASCADE, content, content_hash, embedding VECTOR(384), model_name, created_at, updated_at)`. It is idempotent and does not touch existing tables.

## 7. Why cosine similarity
Direction, not length, carries meaning in sentence embeddings; cosine ignores length. With normalised vectors it equals the dot product. pgvector's `<=>` is cosine *distance*; similarity = `1 - distance`.

## 8. HNSW
`CREATE INDEX … USING hnsw (embedding vector_cosine_ops)` builds a layered proximity graph so nearest-neighbour search does not scan every row. It is approximate but fast; with 50 courses a sequential scan would also be instant, the index matters as the catalogue grows. Needs pgvector ≥ 0.5.0.

## 9–10. Query → results
1. `POST /api/semantic-search {query, limit}` (login required; 3–500 chars; limit 1–20).
2. The route calls the local embedding service (`/embed`) to get the 384-d normalised query vector.
3. PostgreSQL ranks: `ORDER BY embedding <=> $1::vector LIMIT $n` (parameterised; vectors are never loaded into JavaScript), electives only, only embeddings from the same `model_name`.
4. Results below `SEMANTIC_MIN_SIMILARITY` (default 0.25) are dropped so unrelated queries return an empty state instead of weak "recommendations".
5. The UI shows similarity as `round(cosine × 100)%`. This is the raw cosine score, **not** a probability. MiniLM scores for good matches are typically well below 100%, so don't expect 90%+.

## 11. Install and run
```bash
# 1. pgvector on the PostgreSQL server (once)
#    Ubuntu: sudo apt install postgresql-16-pgvector | macOS: brew install pgvector | Docker: pgvector/pgvector:pg16
# 2. migrations (creates the vector tables; prints install steps if pgvector is missing)
npm run db:setup && npm run db:seed
# 3. Python deps + embeddings (first run downloads the model, ~90 MB, then works offline)
pip install -r embedding_service/requirements.txt
npm run db:vector            # needs OWNER_DATABASE_URL in your environment
# 4. start the embedding service (keep running)
npm run embed:serve          # http://127.0.0.1:8001  (GET /health)
# 5. start the app
npm run dev
```
Environment variables: `EMBEDDING_SERVICE_URL`, `EMBEDDING_SERVICE_TOKEN` (optional, set the same value for the service and Next.js), `SEMANTIC_MIN_SIMILARITY`. See `.env.example`. If the service is down the API returns HTTP 503 with the start command; if pgvector is missing, `db:setup` says so and shows install steps – no other search technique is substituted.

## 12. Tests and limitations
`npm run test:semantic` checks: pgvector enabled; every course has a 384-d, unit-norm embedding; single model; HNSW index; duplicate rejection; synthetic provenance; auth; empty/short/long query and bad limit rejected; ranking sorted and limited; only electives; nonsense query returns nothing; API top hit equals a direct pgvector query.

Limitations: real-model relevance not measured here; supplementary text is auto-generated so ranking quality is bounded by it; the 0.25 threshold is a starting point to tune after you inspect real scores; the model is English-oriented; if a course's skills change you must re-run `npm run db:vector`.
