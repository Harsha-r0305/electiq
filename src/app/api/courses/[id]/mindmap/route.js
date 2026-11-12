import { handler } from '@/lib/route';
import { int } from '@/lib/validate';
import { cypher, tryGraph } from '@/lib/neo.mjs';

// Skill mind-map. Taught skills and project-tagged skills come from PostgreSQL;
// related skills (RELATED_TO, up to 2 hops) and clusters come from Neo4j (or PostgreSQL co-occurrence fallback).
export const GET = handler(null, async ({ params, db }) => {
  const id = int(params.id, 'Course id', { min: 1 });
  const sql = await db(async (c) => ({
    course: (await c.query('SELECT code, title, elective_slot, vertical FROM courses WHERE course_id = $1', [id])).rows[0],
    taught: (await c.query('SELECT s.skill_id, s.name, s.category, cs.depth FROM course_skills cs JOIN skills s ON s.skill_id = cs.skill_id WHERE cs.course_id = $1 ORDER BY cs.depth DESC', [id])).rows,
    fromProjects: (await c.query(
      `SELECT s.skill_id, s.name, s.category, COUNT(*)::int AS projects
         FROM projects p JOIN project_skills ps ON ps.project_id = p.project_id JOIN skills s ON s.skill_id = ps.skill_id
        WHERE p.course_id = $1 GROUP BY s.skill_id, s.name, s.category ORDER BY projects DESC`, [id])).rows,
  }));

  let related = await tryGraph(() => cypher(
    `MATCH (c:Course {course_id: toInteger($id)})-[:TEACHES]->(s:Skill)-[r:RELATED_TO*1..2]-(o:Skill)
     WHERE NOT (c)-[:TEACHES]->(o)
     OPTIONAL MATCH (o)-[:IN_CLUSTER]->(k:Cluster)
     RETURN o.skill_id AS skill_id, o.name AS name, k.name AS cluster, min(size(r)) AS hops,
            count(DISTINCT s) AS links
     ORDER BY hops, links DESC LIMIT 12`, { id }));

  const graphAvailable = related !== null;
  if (!related || related.length === 0) {
    // PostgreSQL co-occurrence fallback: skills that appear in other courses alongside this course's skills or share categories
    related = await db(async (c) => (await c.query(
      `SELECT o.skill_id, o.name, o.category AS cluster, 1 AS hops, COUNT(DISTINCT other_cs.course_id)::int AS links
         FROM course_skills cs
         JOIN course_skills other_cs ON other_cs.skill_id = cs.skill_id AND other_cs.course_id <> $1
         JOIN course_skills o_cs ON o_cs.course_id = other_cs.course_id
         JOIN skills o ON o.skill_id = o_cs.skill_id
        WHERE cs.course_id = $1
          AND NOT EXISTS (SELECT 1 FROM course_skills x WHERE x.course_id = $1 AND x.skill_id = o.skill_id)
        GROUP BY o.skill_id, o.name, o.category
        ORDER BY links DESC, o.name LIMIT 12`, [id])).rows);
  }

  return { ...sql, related: related ?? [], graphAvailable };
});

export const dynamic = 'force-dynamic';
