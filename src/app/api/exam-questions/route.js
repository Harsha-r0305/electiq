import { handler } from '@/lib/route';
import { int, str, oneOf } from '@/lib/validate';
import { httpError } from '@/lib/errors';

// Browse anonymously shared exam questions (ISA1, ISA2, ESA)
export const GET = handler(null, async ({ query, db }) => {
  const params = [];
  const where = [];

  if (query.q) {
    params.push(query.q);
    where.push(`veq.question_tsv @@ websearch_to_tsquery('english', $${params.length})`);
  }

  if (query.course) {
    const courseId = int(query.course, 'Course', { min: 1, optional: true });
    if (courseId) {
      params.push(courseId);
      where.push(`veq.course_id = $${params.length}`);
    }
  }

  if (query.type) {
    let t = query.type;
    if (t === 'ISA 1') t = 'ISA1';
    if (t === 'ISA 2') t = 'ISA2';
    if (['ISA1', 'ISA2', 'ESA'].includes(t)) {
      params.push(t);
      where.push(`veq.exam_type = $${params.length}`);
    }
  }

  const offset = query.offset ? int(query.offset, 'Offset', { min: 0, optional: true }) ?? 0 : 0;
  params.push(offset);
  const offsetParam = params.length;

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT
      veq.exam_question_id,
      veq.course_id,
      c.title AS elective_name,
      c.elective_slot,
      c.vertical,
      veq.exam_type,
      veq.term,
      veq.question_text,
      veq.marks,
      veq.topic,
      veq.difficulty,
      veq.answer_text,
      veq.year,
      veq.semester,
      veq.created_at,
      sp.senior_code AS contributor_code
    FROM v_exam_questions veq
    JOIN courses c ON c.course_id = veq.course_id
    LEFT JOIN senior_profiles sp ON sp.student_id = veq.contributor_id
    ${whereClause}
    ORDER BY veq.difficulty ASC, veq.exam_question_id ASC
    LIMIT 100 OFFSET $${offsetParam}
  `;

  return db(async (c) => (await c.query(sql, params)).rows);
});

// Share questions for an enrolled course
export const POST = handler(['student', 'senior'], async ({ session, body, db }) => {
  const enrollmentId = int(body.enrollment_id, 'Enrollment', { min: 1 });
  let examType = body.exam_type;
  if (examType === 'ISA 1') examType = 'ISA1';
  if (examType === 'ISA 2') examType = 'ISA2';
  examType = oneOf(examType, 'Exam type', ['ISA1', 'ISA2', 'ESA']);

  if (!Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 10) {
    throw httpError(400, 'Must provide between 1 and 10 questions.');
  }

  const cleanQuestions = body.questions.map((q, idx) => {
    const prefix = `Question ${idx + 1}`;
    const text = str(q.text, `${prefix} text`, { min: 10, max: 800 });
    const marks = q.marks !== undefined && q.marks !== null && q.marks !== ''
      ? int(q.marks, `${prefix} marks`, { min: 1, max: 100 })
      : null;
    const topic = q.topic ? str(q.topic, `${prefix} topic`, { max: 100, optional: true }) : null;
    const difficulty = q.difficulty !== undefined && q.difficulty !== null && q.difficulty !== ''
      ? int(q.difficulty, `${prefix} difficulty`, { min: 1, max: 5 })
      : 3;
    return { text, marks, topic, difficulty };
  });

  return db(async (c) => {
    const enrCheck = await c.query(`
      SELECT e.enrollment_id
      FROM enrollments e
      JOIN students s ON s.student_id = e.student_id
      WHERE e.enrollment_id = $1 AND s.user_id = $2
    `, [enrollmentId, session.uid]);

    if (enrCheck.rows.length === 0) {
      throw httpError(403, 'You can only share exam questions for courses in which you are enrolled.');
    }

    await c.query('CALL sp_share_exam_questions($1, $2, $3::jsonb)', [
      enrollmentId,
      examType,
      JSON.stringify(cleanQuestions),
    ]);
    return { ok: true, shared: cleanQuestions.length };
  });
});

export const dynamic = 'force-dynamic';
