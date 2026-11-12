// Mirrors PostgreSQL into Neo4j.  Usage: npm run sync-graph   (add --seed-graph-owned on first run)
import pg from 'pg';
import { syncGraph } from '../src/lib/graph-sync.mjs';
import { closeGraph } from '../src/lib/neo.mjs';

const seedGraphOwned = process.argv.includes('--seed-graph-owned');
const c = new pg.Client({ connectionString: process.env.OWNER_DATABASE_URL });
await c.connect();
try {
  const r = await syncGraph(c, { seedGraphOwned });
  console.log('Neo4j synchronized:', r, seedGraphOwned ? '(graph-owned links seeded)' : '');
} catch (e) {
  console.error('Could not reach Neo4j. Is it running, and are NEO4J_* values in .env correct?\n', e.message);
  process.exitCode = 1;
} finally { await c.end(); await closeGraph(); }
