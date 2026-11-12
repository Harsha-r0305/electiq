import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.OWNER_DATABASE_URL;
const appPw = process.env.APP_LOGIN_PASSWORD;

async function run() {
  const c = new pg.Client({ connectionString: url });
  await c.connect();

  const files = [
    '02_logic.sql',
    '03_security.sql',
    '04_dashboard_roles.sql',
    '05_rls_policies.sql',
    '07_enhanced_experience.sql'
  ];

  for (const f of files) {
    console.log('Running', f, '...');
    try {
      const sql = fs.readFileSync(path.join('db', f), 'utf8');
      await c.query(sql);
      console.log('  ->', f, 'OK');
    } catch (e) {
      console.error('Error in', f, ':', e.message);
    }
  }

  // Set password for app_login
  try {
    const { rows } = await c.query("SELECT format('ALTER ROLE app_login PASSWORD %L', $1::text) AS sql", [appPw]);
    await c.query(rows[0].sql);
    console.log('Password set for app_login');
  } catch (e) {
    console.error('Error setting app_login password:', e.message);
  }

  await c.end();
}

run();

