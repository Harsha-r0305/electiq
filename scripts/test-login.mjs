import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  const c = await pool.connect();
  try {
    console.log('Connected to DATABASE_URL as:', (await c.query('SELECT current_user, session_user')).rows[0]);
    const res = await c.query('SELECT * FROM fn_get_login($1)', ['student1@electiq.dev']);
    console.log('fn_get_login result:', res.rows[0]);
  } catch (err) {
    console.error('Error with DATABASE_URL:', err.message, err.code);
  } finally {
    c.release();
    pool.end();
  }
}
test();

