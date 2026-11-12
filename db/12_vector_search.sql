-- ElectIQ :: 12_vector_search.sql  (AI-powered semantic elective search)
-- Idempotent. Requires the pgvector extension to be installed on the PostgreSQL server.
-- (Numbered 12 because 06 is already used by 06_curriculum_roles.sql.)
CREATE EXTENSION IF NOT EXISTS vector;

-- Supplementary course information. The curriculum data has no descriptions/topics/outcomes, so this
-- table holds GENERATED text. Every row is flagged synthetic and carries its provenance.
-- It is NOT university-approved information and must not be presented as such.
CREATE TABLE IF NOT EXISTS course_supplementary_info (
  id                  SERIAL PRIMARY KEY,
  course_id           INT NOT NULL UNIQUE REFERENCES courses(course_id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  topics              TEXT[] NOT NULL DEFAULT '{}',
  skills_taught       TEXT[] NOT NULL DEFAULT '{}',
  learning_outcomes   TEXT[] NOT NULL DEFAULT '{}',
  keywords            TEXT[] NOT NULL DEFAULT '{}',
  is_synthetic        BOOLEAN NOT NULL DEFAULT true,
  source              TEXT NOT NULL,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_embeddings (
  id            SERIAL PRIMARY KEY,
  course_id     INT NOT NULL UNIQUE REFERENCES courses(course_id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  embedding     VECTOR(384) NOT NULL,
  model_name    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approximate nearest-neighbour index for cosine distance (needs pgvector >= 0.5.0)
CREATE INDEX IF NOT EXISTS idx_course_embeddings_hnsw
  ON course_embeddings USING hnsw (embedding vector_cosine_ops);

GRANT SELECT ON course_embeddings, course_supplementary_info TO app_student, app_senior, app_faculty, app_admin;
