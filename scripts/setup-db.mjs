// Creates the schema, routines, roles, grants and RLS policies.  Usage: npm run db:setup
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.OWNER_DATABASE_URL;
const appPw = process.env.APP_LOGIN_PASSWORD;
if (!url || !appPw) {
  console.error('Set OWNER_DATABASE_URL and APP_LOGIN_PASSWORD in .env first.');
  process.exit(1);
}
const c = new pg.Client({ connectionString: url });
await c.connect();
// Order matters: 02_logic.sql references columns added by 06/07/08, and 06/07/08 GRANT to roles,
// so roles (00) and the column-adding migrations run before the views/functions in 02.
const MIGRATIONS = [
  '00_roles.sql', '01_schema.sql', '06_curriculum_roles.sql', '07_enhanced_experience.sql',
  '08_full_approval_workflow.sql', '02_logic.sql', '03_security.sql', '04_dashboard_roles.sql',
  '05_rls_policies.sql', '09_fix_permissions_and_sync.sql', '10_grant_all_permissions.sql', '11_publish_gate_and_fixes.sql',
  '13_security_hardening.sql',
];
for (const f of MIGRATIONS) {
  console.log('Running', f);
  await c.query(fs.readFileSync(path.join('db', f), 'utf8'));
}

// Semantic search needs pgvector. Everything else works without it, so a missing extension is reported
// loudly (with install steps) instead of aborting the whole setup or silently using another search method.
try {
  console.log('Running 12_vector_search.sql');
  await c.query(fs.readFileSync(path.join('db', '12_vector_search.sql'), 'utf8'));
} catch (e) {
  if (/extension "vector" is not available|could not open extension control file/i.test(e.message)) {
    console.error(`
!! pgvector is NOT installed on this PostgreSQL server, so AI semantic search is NOT enabled.
   Install it, then re-run \`npm run db:setup\`:
     Ubuntu/Debian : sudo apt install postgresql-<version>-pgvector
     macOS (brew)  : brew install pgvector
     Windows       : https://github.com/pgvector/pgvector#windows  (build or use the prebuilt binaries)
     Docker        : use the image pgvector/pgvector:pg16
   Then: CREATE EXTENSION vector;  (done automatically by db/12_vector_search.sql)
`);
  } else throw e;
}
const { rows } = await c.query("SELECT format('ALTER ROLE app_login PASSWORD %L', $1::text) AS sql", [appPw]);
await c.query(rows[0].sql);
console.log('Database ready. Next: npm run db:seed');
await c.end();
