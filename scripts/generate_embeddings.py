#!/usr/bin/env python3
"""
Generate / refresh course embeddings (all-MiniLM-L6-v2, 384 dims, L2-normalised) into course_embeddings.

Run it once after seeding, and again whenever course text or skills change:
    python scripts/generate_embeddings.py [--force]

Unchanged courses (same content hash AND same model) are skipped, so re-running is cheap and never
creates duplicates (UNIQUE(course_id) + upsert). Embedding is NOT done at search time.
"""
import argparse, hashlib, os, sys
import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "embedding_service"))
from backend import load_model, DIM  # same loader as the search service

def course_text(title, vertical, description, topics, skills, outcomes):
    parts = [f"Course: {title}."]
    if vertical and vertical != "core": parts.append(f"Area: {vertical}.")
    if description: parts.append(description)
    if topics: parts.append("Topics: " + ", ".join(topics) + ".")
    if skills: parts.append("Skills: " + ", ".join(skills) + ".")
    if outcomes: parts.append("Outcomes: " + " ".join(outcomes))
    return " ".join(parts)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--force", action="store_true", help="re-embed even if unchanged")
    args = ap.parse_args()
    url = os.environ.get("OWNER_DATABASE_URL")
    if not url: sys.exit("Set OWNER_DATABASE_URL (see .env.example)")
    model, MODEL_NAME = load_model()  # local model, no API key

    conn = psycopg2.connect(url); cur = conn.cursor()
    cur.execute("""
      SELECT c.course_id, c.title, c.vertical, si.description, si.topics,
             COALESCE(NULLIF(si.skills_taught, '{}'),
                      ARRAY(SELECT s.name FROM course_skills cs JOIN skills s USING (skill_id) WHERE cs.course_id = c.course_id)),
             si.learning_outcomes, ce.content_hash, ce.model_name
      FROM courses c
      LEFT JOIN course_supplementary_info si ON si.course_id = c.course_id
      LEFT JOIN course_embeddings ce ON ce.course_id = c.course_id
      WHERE c.is_active ORDER BY c.course_id""")
    rows = cur.fetchall()
    todo, skipped = [], 0
    for cid, title, vert, desc, topics, skills, outcomes, old_hash, old_model in rows:
        text = course_text(title, vert, desc, topics or [], skills or [], outcomes or [])
        h = hashlib.sha256(text.encode()).hexdigest()
        if not args.force and old_hash == h and old_model == MODEL_NAME: skipped += 1; continue
        todo.append((cid, text, h, old_hash is not None))
    created = updated = 0
    if todo:
        vecs = model.encode([t[1] for t in todo], normalize_embeddings=True, batch_size=32)
        for (cid, text, h, existed), v in zip(todo, vecs):
            assert len(v) == DIM
            cur.execute("""INSERT INTO course_embeddings (course_id, content, content_hash, embedding, model_name)
                           VALUES (%s,%s,%s,%s::vector,%s)
                           ON CONFLICT (course_id) DO UPDATE SET content=EXCLUDED.content, content_hash=EXCLUDED.content_hash,
                             embedding=EXCLUDED.embedding, model_name=EXCLUDED.model_name, updated_at=now()""",
                        (cid, text, h, "[" + ",".join(f"{x:.8f}" for x in v) + "]", MODEL_NAME))
            updated += existed; created += (not existed)
    conn.commit(); conn.close()
    print(f"embeddings ({MODEL_NAME}, {DIM}-d): generated={created} updated={updated} skipped={skipped}")

if __name__ == "__main__":
    main()
