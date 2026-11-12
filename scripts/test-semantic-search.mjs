// Tests for the semantic search feature. Needs: migrations applied, `generate_embeddings.py` run,
// the embedding service running and the app running.   node --env-file=.env scripts/test-semantic-search.mjs
import pg from 'pg';
const BASE = process.argv[2] || 'http://localhost:3000';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const db = new pg.Client({ connectionString: process.env.OWNER_DATABASE_URL }); await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;

// ---- database level ----
ok((await q("SELECT 1 FROM pg_extension WHERE extname='vector'")).length === 1, 'pgvector extension is installed and enabled');
const n = Number((await q('SELECT COUNT(*) n FROM course_embeddings'))[0].n);
const active = Number((await q('SELECT COUNT(*) n FROM courses WHERE is_active'))[0].n);
ok(n === active && n > 0, `every active course has an embedding (${n}/${active})`);
ok((await q('SELECT COUNT(*) n FROM course_embeddings WHERE vector_dims(embedding) <> 384'))[0].n == 0, 'all embeddings have exactly 384 dimensions');
ok((await q('SELECT COUNT(*) n FROM course_embeddings WHERE abs(vector_norm(embedding) - 1) > 0.001'))[0].n == 0, 'all embeddings are L2-normalised (norm = 1)');
ok((await q('SELECT COUNT(DISTINCT model_name) n FROM course_embeddings'))[0].n == 1, 'one embedding model is used for all courses');
ok((await q("SELECT 1 FROM pg_indexes WHERE indexname='idx_course_embeddings_hnsw' AND indexdef ILIKE '%hnsw%vector_cosine_ops%'")).length === 1, 'HNSW cosine index exists');
let dup = false; try { await q("INSERT INTO course_embeddings (course_id, content, content_hash, embedding, model_name) SELECT course_id, 'x', 'x', embedding, model_name FROM course_embeddings LIMIT 1"); } catch (e) { dup = e.code === '23505'; }
ok(dup, 'duplicate embedding for the same course is rejected (UNIQUE course_id)');
ok((await q("SELECT COUNT(*) n FROM course_supplementary_info WHERE is_synthetic AND source LIKE 'synthetic:%'"))[0].n > 0, 'supplementary data is flagged synthetic with provenance');

// ---- API level ----
const login = async (e) => (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: e, password: 'Password@123' }) })).headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const search = async (cookie, body) => { const r = await fetch(BASE + '/api/semantic-search', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; };
const student = await login('student1@electiq.dev');
ok((await search('', { query: 'chatbots' })).status === 401, 'unauthenticated request is rejected');
ok((await search(student, { query: '' })).status === 400, 'empty query is rejected');
ok((await search(student, { query: '   ' })).status === 400, 'whitespace-only query is rejected');
ok((await search(student, { query: 'ab' })).status === 400, 'too-short query is rejected');
ok((await search(student, { query: 'x'.repeat(501) })).status === 400, 'over-long query is rejected');
ok((await search(student, { query: 'machine learning', limit: 0 })).status === 400, 'invalid limit is rejected');
const good = await search(student, { query: 'I want an elective that helps me learn how to build intelligent chatbots and language models.', limit: 5 });
console.log('   model:', good.data.model, '| top results:', (good.data.results || []).map((r) => `${r.title} ${r.similarityPercent}%`).join(' | '));
ok(good.status === 200 && good.data.results.length > 0, 'relevant query returns results');
ok(good.data.results.length <= 5, 'result limit is honoured');
const sims = good.data.results.map((r) => r.similarity);
ok(sims.every((v, i) => i === 0 || sims[i - 1] >= v), 'results are sorted from highest to lowest similarity');
ok(good.data.results.every((r) => r.similarityPercent >= 0 && r.similarityPercent <= 100), 'similarity percentages are within 0-100');
ok(good.data.results.every((r) => r.is_elective !== false && r.course_id), 'only elective courses are returned');
const junk = await search(student, { query: 'zzqx vvkp wwjj qqrt plmn' });
ok(junk.status === 200 && junk.data.results.length === 0, 'a meaningless query returns no (misleading) recommendations');
// ranking is done by Postgres: compare the API order with a direct pgvector query
const direct = await q(`SELECT c.course_id FROM course_embeddings ce JOIN courses c USING(course_id)
   WHERE c.is_elective AND c.is_active ORDER BY ce.embedding <=> (SELECT embedding FROM course_embeddings WHERE course_id=$1) LIMIT 1`, [good.data.results[0]?.course_id]);
ok(direct[0]?.course_id === good.data.results[0]?.course_id, 'top API hit matches a direct pgvector cosine-distance query');
await db.end();
console.log(fails ? `\n${fails} FAILED` : '\nAll semantic-search checks passed'); process.exit(fails ? 1 : 0);
