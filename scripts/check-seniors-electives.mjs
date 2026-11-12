import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.OWNER_DATABASE_URL });

async function check() {
  const c = await pool.connect();
  const res = await c.query(`
    SELECT e.*, c.title, c.is_elective, c.elective_slot
    FROM senior_profiles sp
    JOIN enrollments e ON e.student_id = sp.student_id
    JOIN courses c ON c.course_id = e.course_id
    WHERE sp.senior_code = 'S-8F5503'
  `);
  console.log('S-8F5503 enrollments:', res.rows);
  c.release();
  pool.end();
}
check();
