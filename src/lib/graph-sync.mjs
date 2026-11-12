// Mirrors PostgreSQL master data into Neo4j (idempotent MERGE). PostgreSQL stays authoritative
// for courses, skills, roles, prerequisites, course-skill and role-skill links.
// Neo4j OWNS: (:Skill)-[:RELATED_TO]->(:Skill) and (:Skill)-[:IN_CLUSTER]->(:Cluster).
import { cypher } from './neo.mjs';

export async function ensureGraphSchema() {
  const stmts = [
    'CREATE CONSTRAINT course_id_unique IF NOT EXISTS FOR (c:Course) REQUIRE c.course_id IS UNIQUE',
    'CREATE CONSTRAINT skill_id_unique IF NOT EXISTS FOR (s:Skill) REQUIRE s.skill_id IS UNIQUE',
    'CREATE CONSTRAINT role_id_unique IF NOT EXISTS FOR (r:Role) REQUIRE r.role_id IS UNIQUE',
    'CREATE CONSTRAINT cluster_name_unique IF NOT EXISTS FOR (k:Cluster) REQUIRE k.name IS UNIQUE',
    'CREATE INDEX skill_name_idx IF NOT EXISTS FOR (s:Skill) ON (s.name)',
  ];
  for (const s of stmts) await cypher(s, {}, true);
}

export async function syncGraph(pgClient, { seedGraphOwned = false } = {}) {
  const q = async (sql) => (await pgClient.query(sql)).rows;
  const courses = await q('SELECT course_id, code, title, level, vertical, elective_slot FROM courses');
  const skills = await q('SELECT skill_id, name, category FROM skills');
  const roles = await q('SELECT role_id, title FROM job_roles');
  const prereq = await q('SELECT course_id, prereq_id FROM course_prerequisites');
  const teaches = await q('SELECT course_id, skill_id, depth FROM course_skills');
  const requires = await q('SELECT role_id, skill_id, importance FROM role_skills');

  await ensureGraphSchema();
  await cypher('UNWIND $rows AS r MERGE (c:Course {course_id: toInteger(r.course_id)}) SET c.code = r.code, c.title = r.title, c.level = r.level, c.vertical = r.vertical, c.elective_slot = r.elective_slot', { rows: courses }, true);
  await cypher('UNWIND $rows AS r MERGE (s:Skill {skill_id: toInteger(r.skill_id)}) SET s.name = r.name, s.category = r.category', { rows: skills }, true);
  await cypher('UNWIND $rows AS r MERGE (x:Role {role_id: toInteger(r.role_id)}) SET x.title = r.title', { rows: roles }, true);
  await cypher('UNWIND $rows AS r MATCH (a:Course {course_id: toInteger(r.prereq_id)}), (b:Course {course_id: toInteger(r.course_id)}) MERGE (a)-[:PREREQUISITE_OF]->(b)', { rows: prereq }, true);
  await cypher('UNWIND $rows AS r MATCH (c:Course {course_id: toInteger(r.course_id)}), (s:Skill {skill_id: toInteger(r.skill_id)}) MERGE (c)-[t:TEACHES]->(s) SET t.depth = toInteger(r.depth)', { rows: teaches }, true);
  await cypher('UNWIND $rows AS r MATCH (x:Role {role_id: toInteger(r.role_id)}), (s:Skill {skill_id: toInteger(r.skill_id)}) MERGE (x)-[q:REQUIRES]->(s) SET q.importance = toInteger(r.importance)', { rows: requires }, true);

  // Remove mirrored nodes/relationships that no longer exist in PostgreSQL
  await cypher('MATCH (c:Course) WHERE NOT c.course_id IN [i IN $ids | toInteger(i)] DETACH DELETE c', { ids: courses.map((x) => x.course_id) }, true);
  await cypher('MATCH (s:Skill) WHERE NOT s.skill_id IN [i IN $ids | toInteger(i)] DETACH DELETE s', { ids: skills.map((x) => x.skill_id) }, true);
  await cypher('MATCH (x:Role) WHERE NOT x.role_id IN [i IN $ids | toInteger(i)] DETACH DELETE x', { ids: roles.map((x) => x.role_id) }, true);
  await cypher('MATCH (a:Course)-[r:PREREQUISITE_OF]->(b:Course) WHERE NOT (toString(a.course_id) + ":" + toString(b.course_id)) IN $keys DELETE r',
    { keys: prereq.map((x) => `${x.prereq_id}:${x.course_id}`) }, true);
  await cypher('MATCH (c:Course)-[r:TEACHES]->(s:Skill) WHERE NOT (toString(c.course_id) + ":" + toString(s.skill_id)) IN $keys DELETE r',
    { keys: teaches.map((x) => `${x.course_id}:${x.skill_id}`) }, true);
  await cypher('MATCH (x:Role)-[r:REQUIRES]->(s:Skill) WHERE NOT (toString(x.role_id) + ":" + toString(s.skill_id)) IN $keys DELETE r',
    { keys: requires.map((x) => `${x.role_id}:${x.skill_id}`) }, true);

  if (seedGraphOwned) {
    // Initial content for the data only Neo4j owns. ON CREATE keeps later edits intact.
    await cypher('UNWIND $rows AS r MERGE (k:Cluster {name: r.category}) WITH r, k MATCH (s:Skill {skill_id: toInteger(r.skill_id)}) WHERE NOT (s)-[:IN_CLUSTER]->() MERGE (s)-[:IN_CLUSTER]->(k)', { rows: skills }, true);
    const pairs = await q('SELECT a.skill_id AS a, b.skill_id AS b, COUNT(*)::int AS strength FROM course_skills a JOIN course_skills b ON a.course_id = b.course_id AND a.skill_id < b.skill_id GROUP BY a.skill_id, b.skill_id');
    await cypher('UNWIND $rows AS r MATCH (x:Skill {skill_id: toInteger(r.a)}), (y:Skill {skill_id: toInteger(r.b)}) MERGE (x)-[l:RELATED_TO]->(y) ON CREATE SET l.strength = toInteger(r.strength)', { rows: pairs }, true);
  }
  return { courses: courses.length, skills: skills.length, roles: roles.length, prerequisites: prereq.length, teaches: teaches.length, requires: requires.length };
}
