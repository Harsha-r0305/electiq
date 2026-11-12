import neo4j from 'neo4j-driver';

let driver;
let downUntil = 0;
const getDriver = () => (driver ??= neo4j.driver(
  process.env.NEO4J_URI ?? 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', process.env.NEO4J_PASSWORD ?? ''),
  { connectionTimeout: 2500, maxTransactionRetryTime: 3000 },
));

// Convert neo4j Integer values to plain numbers, recursively.
export function plain(v) {
  if (neo4j.isInt(v)) return v.toNumber();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

export async function cypher(query, params = {}, write = false) {
  const session = getDriver().session({ defaultAccessMode: write ? neo4j.session.WRITE : neo4j.session.READ });
  try {
    const res = await session.run(query, params);
    return res.records.map((r) => plain(r.toObject()));
  } finally { await session.close(); }
}

// Returns null instead of throwing when Neo4j is unreachable (circuit breaker: 15 s).
export async function tryGraph(fn) {
  if (Date.now() < downUntil) return null;
  try { return await fn(); } catch (e) {
    downUntil = Date.now() + 15000;
    console.warn('[neo4j] unavailable:', e.message);
    return null;
  }
}
export async function closeGraph() { if (driver) await driver.close(); driver = undefined; }
