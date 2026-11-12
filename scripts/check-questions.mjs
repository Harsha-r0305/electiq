import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.OWNER_DATABASE_URL });

async function check() {
  const c = await pool.connect();
  const res = await c.query(`
    SELECT iq.*, c.title, c.elective_slot
    FROM interview_questions iq
    JOIN courses c ON c.course_id = iq.course_id
    JOIN placements p ON p.placement_id = iq.placement_id
    WHERE p.student_id = 31
  `);
  console.log('S-8F5503 interview_questions:', res.rows);
  c.release();
  pool.end();
}
check();

