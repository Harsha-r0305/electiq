import { handler } from '@/lib/route';
import { str, int, oneOf } from '@/lib/validate';

// Interview question bank (full-text search). Seniors can add questions.
export const GET = handler(null, async ({ query, db }) => {
  const q = (query.q ?? '').trim().slice(0, 100);
  const params = [];
  const where = [];
  if (q) { params.push(q); where.push(`iq.question_tsv @@ websearch_to_tsquery('english', $${params.length})`); }
  if (query.course) { params.push(Number(query.course)); where.push(`iq.course_id = $${params.length}`); }
  const rank = q ? `ts_rank(iq.question_tsv, websearch_to_tsquery('english', $1)) DESC,` : '';
  return db(async (c) => (await c.query(
    `SELECT iq.question_id, iq.question_text, iq.round, iq.difficulty, c.code, c.title
       FROM interview_questions iq JOIN courses c ON c.course_id = iq.course_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${rank} iq.difficulty DESC, iq.question_id DESC LIMIT 60`, params)).rows);
});

export const POST = handler(['senior'], async ({ body, db }) => {
  const course = int(body.course_id, 'Course', { min: 1 });
  const text = str(body.text, 'Question', { min: 10, max: 600 });
  const round = oneOf(body.round ?? 'technical', 'Round', ['technical', 'coding', 'hr-technical', 'managerial']);
  const diff = int(body.difficulty ?? 3, 'Difficulty', { min: 1, max: 5 });
  const placement = int(body.placement_id, 'Placement', { min: 1, optional: true });
  return db(async (c) => {
    await c.query('INSERT INTO interview_questions(course_id, placement_id, question_text, round, difficulty) VALUES ($1,$2,$3,$4,$5)', [course, placement, text, round, diff]);
    return { ok: true };
  });
});

export const dynamic = 'force-dynamic';
