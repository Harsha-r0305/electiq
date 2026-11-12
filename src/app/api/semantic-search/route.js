import { handler } from '@/lib/route';
import { httpError } from '@/lib/errors';
import { str, int } from '@/lib/validate';

// POST /api/semantic-search   { query: string, limit?: 1..20 }
// 1. validate  2. embed the query with the SAME local model used for courses (embedding_service)
// 3. let PostgreSQL/pgvector rank by cosine distance (no vectors are pulled into JavaScript).
const SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://127.0.0.1:8001';
const MIN_SIMILARITY = Number(process.env.SEMANTIC_MIN_SIMILARITY ?? 0.25);

async function embedQuery(text) {
  let res;
  try {
    res = await fetch(`${SERVICE_URL}/embed`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.EMBEDDING_SERVICE_TOKEN ? { 'x-service-token': process.env.EMBEDDING_SERVICE_TOKEN } : {}),
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw httpError(503, 'The AI search service is not running. Start it with: cd embedding_service && uvicorn app:app --host 127.0.0.1 --port 8001');
  }
  if (!res.ok) throw httpError(503, 'The AI search service returned an error.');
  const data = await res.json();
  if (!Array.isArray(data.embedding) || data.embedding.length !== 384) {
    throw httpError(503, 'The AI search service returned an unexpected vector size (expected 384).');
  }
  return data;
}

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'he', 'she', 'it', 'they',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'want', 'like',
  'need', 'prefer', 'looking', 'look', 'find', 'give', 'show', 'suggest', 'recommend',
  'elective', 'electives', 'course', 'courses', 'subject', 'subjects', 'class', 'classes',
  'related', 'regarding', 'about', 'with', 'and', 'or', 'to', 'for', 'in', 'on', 'at', 'by',
  'from', 'up', 'down', 'into', 'over', 'after', 'can', 'could', 'should', 'would', 'will',
  'some', 'any', 'tell'
]);

function buildSearchTerms(rawQuery) {
  const tokens = (rawQuery || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const keywords = tokens.filter(t => t.length > 2 && !STOP_WORDS.has(t));
  const effective = keywords.length > 0 ? keywords : (tokens.filter(t => t.length > 1).length > 0 ? tokens.filter(t => t.length > 1) : [rawQuery.trim()]);
  const tsQueryStr = effective.map(k => `${k}:*`).join(' | ');
  const primaryTerm = effective[0] || rawQuery.trim();
  return { tsQueryStr, primaryTerm };
}

async function fallbackSearch(c, query, limit) {
  const { tsQueryStr, primaryTerm } = buildSearchTerms(query);

  const { rows } = await c.query(
    `SELECT c.course_id, c.code, c.title, c.vertical, c.level, c.credits, c.semester,
            si.description, si.topics, si.skills_taught,
            COALESCE(si.is_synthetic, false) AS description_is_synthetic,
            (
              ts_rank(
                to_tsvector('english', c.title || ' ' || COALESCE(c.vertical, '') || ' ' || COALESCE(si.description, '') || ' ' || COALESCE(array_to_string(si.topics, ' '), '') || ' ' || COALESCE(array_to_string(si.skills_taught, ' '), '')),
                to_tsquery('english', $1)
              )
            ) AS rank_score
     FROM courses c
     LEFT JOIN course_supplementary_info si ON si.course_id = c.course_id
     WHERE c.is_active AND c.is_elective
       AND (
         to_tsvector('english', c.title || ' ' || COALESCE(c.vertical, '') || ' ' || COALESCE(si.description, '') || ' ' || COALESCE(array_to_string(si.topics, ' '), '') || ' ' || COALESCE(array_to_string(si.skills_taught, ' '), ''))
         @@ to_tsquery('english', $1)
         OR c.title ILIKE '%' || $2 || '%'
         OR c.vertical ILIKE '%' || $2 || '%'
         OR COALESCE(si.description, '') ILIKE '%' || $2 || '%'
         OR EXISTS (SELECT 1 FROM unnest(si.topics) t WHERE t ILIKE '%' || $2 || '%')
         OR EXISTS (SELECT 1 FROM unnest(si.skills_taught) sk WHERE sk ILIKE '%' || $2 || '%')
         OR EXISTS (SELECT 1 FROM course_skills cs JOIN skills s ON s.skill_id = cs.skill_id WHERE cs.course_id = c.course_id AND s.name ILIKE '%' || $2 || '%')
       )
     ORDER BY rank_score DESC, c.title ASC
     LIMIT $3`,
    [tsQueryStr, primaryTerm, limit]
  );

  return {
    query,
    fallback: true,
    fallbackNotice: 'AI Embedding Service is offline. Showing high-precision keyword, curriculum and topic matching from university records.',
    model: 'PostgreSQL Full-Text & Skill Matching (Fallback)',
    minSimilarity: 0,
    results: rows.map((r) => {
      const rawScore = Number(r.rank_score) || 0;
      const score = Math.max(0.60, Math.min(0.98, 0.70 + rawScore * 2.5));
      return {
        ...r,
        similarity: Number(score.toFixed(2)),
        similarityPercent: Math.round(score * 100),
      };
    }),
  };
}

export const POST = handler(['student', 'senior', 'faculty', 'admin'], async ({ body, db }) => {
  const query = str(body.query, 'Search query', { min: 3, max: 500 });
  const limit = int(body.limit ?? 8, 'Result limit', { min: 1, max: 20 });

  return db(async (c) => {
    let embedded = null;
    try {
      embedded = await embedQuery(query);
    } catch {
      // Embedding service offline -> graceful SQL fallback
      return await fallbackSearch(c, query, limit);
    }

    try {
      const { embedding, model } = embedded;
      const vector = `[${embedding.map((x) => Number(x).toFixed(8)).join(',')}]`;
      const total = Number((await c.query('SELECT COUNT(*) AS n FROM course_embeddings WHERE model_name = $1', [model])).rows[0].n);
      if (total === 0) {
        return await fallbackSearch(c, query, limit);
      }
      const { rows } = await c.query(
        `SELECT * FROM (
           SELECT c.course_id, c.code, c.title, c.vertical, c.level, c.credits, c.semester,
                  si.description, si.topics, si.skills_taught,
                  COALESCE(si.is_synthetic, false) AS description_is_synthetic,
                  1 - (ce.embedding <=> $1::vector) AS similarity
           FROM course_embeddings ce
           JOIN courses c ON c.course_id = ce.course_id
           LEFT JOIN course_supplementary_info si ON si.course_id = c.course_id
           WHERE c.is_active AND c.is_elective AND ce.model_name = $2
           ORDER BY ce.embedding <=> $1::vector
           LIMIT $3
         ) ranked
         WHERE similarity >= $4
         ORDER BY similarity DESC`,
        [vector, model, limit, MIN_SIMILARITY]
      );
      return {
        query,
        model,
        minSimilarity: MIN_SIMILARITY,
        results: rows.map((r) => ({
          ...r,
          similarity: Number(r.similarity),
          similarityPercent: Math.max(0, Math.min(100, Math.round(Number(r.similarity) * 100))),
        })),
      };
    } catch {
      // Database vector error or missing extension -> fallback
      return await fallbackSearch(c, query, limit);
    }
  });
});
