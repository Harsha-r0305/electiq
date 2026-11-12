import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.OWNER_DATABASE_URL });

async function run() {
  const c = await pool.connect();
  try {
    const s = await c.query("SELECT student_id, senior_code FROM senior_profiles WHERE senior_code = 'S-61063A'");
    console.log('Senior S-61063A:', s.rows[0]);
    if (!s.rows[0]) return;
    const sid = s.rows[0].student_id;
    const prep = await c.query('SELECT * FROM interview_prep WHERE student_id = $1', [sid]);
    console.log('interview_prep count for S-61063A:', prep.rows.length);
    console.log('interview_prep record:', prep.rows[0]);
    const q = await c.query(`
      SELECT iq.*, c.title AS elective_name, c.elective_slot
      FROM interview_questions iq
      JOIN placements p ON p.placement_id = iq.placement_id
      JOIN courses c ON c.course_id = iq.course_id
      WHERE p.student_id = $1
    `, [sid]);
    console.log('interview_questions count for S-61063A:', q.rows.length);
  } finally {
    c.release();
    await pool.end();
  }
}

run().catch(console.error);

