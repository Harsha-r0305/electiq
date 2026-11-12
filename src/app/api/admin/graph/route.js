import { handler } from '@/lib/route';
import { str, int, num } from '@/lib/validate';
import { httpError } from '@/lib/errors';
import { cypher, tryGraph } from '@/lib/neo.mjs';

export const GET = handler(['admin'], async ({ db }) => {
  // 1. Try Neo4j first
  const neoRelated = await tryGraph(() => cypher(
    `MATCH (a:Skill)-[r:RELATED_TO]->(b:Skill)
     RETURN a.skill_id AS a_id, a.name AS a, b.skill_id AS b_id, b.name AS b, r.strength AS strength
     ORDER BY r.strength DESC, a.name LIMIT 200`));

  if (neoRelated !== null) {
    const clusters = await cypher(
      `MATCH (k:Cluster) OPTIONAL MATCH (s:Skill)-[:IN_CLUSTER]->(k)
       RETURN k.name AS name, collect(s.name) AS skills ORDER BY k.name`);
    return { available: true, related: neoRelated, clusters, mode: 'neo4j' };
  }

  // 2. Seamless PostgreSQL Graph Engine Fallback
  return await db(async (c) => {
    const relRes = await c.query(`
      SELECT r.skill_a_id AS a_id, sa.name AS a, r.skill_b_id AS b_id, sb.name AS b, r.strength
      FROM graph_related_skills r
      JOIN skills sa ON sa.skill_id = r.skill_a_id
      JOIN skills sb ON sb.skill_id = r.skill_b_id
      ORDER BY r.strength DESC, sa.name ASC
      LIMIT 200
    `);

    const clustRes = await c.query(`
      SELECT gc.cluster_name AS name, json_agg(s.name ORDER BY s.name) AS skills
      FROM graph_skill_clusters gc
      JOIN skills s ON s.skill_id = gc.skill_id
      GROUP BY gc.cluster_name
      ORDER BY gc.cluster_name ASC
    `);

    return {
      available: true,
      related: relRes.rows,
      clusters: clustRes.rows,
      mode: 'integrated_graph',
      message: 'Integrated Graph Engine active (PostgreSQL Graph Mode)'
    };
  });
});

export const POST = handler(['admin'], async ({ body, db }) => {
  if (body.type === 'related') {
    const a = int(body.a, 'Skill A', { min: 1 }), b = int(body.b, 'Skill B', { min: 1 });
    if (a === b) throw httpError(400, 'Pick two different skills.');
    const s = num(body.strength ?? 1, 'Strength', { min: 1, max: 10 });

    const neoRes = await tryGraph(() => cypher(
      'MATCH (x:Skill {skill_id: toInteger($a)}), (y:Skill {skill_id: toInteger($b)}) MERGE (x)-[l:RELATED_TO]->(y) SET l.strength = toInteger($s) RETURN count(l) AS n',
      { a, b, s }, true
    ));

    return await db(async (c) => {
      await c.query(`
        INSERT INTO graph_related_skills (skill_a_id, skill_b_id, strength)
        VALUES (LEAST($1, $2), GREATEST($1, $2), $3)
        ON CONFLICT (skill_a_id, skill_b_id) DO UPDATE SET strength = EXCLUDED.strength
      `, [a, b, s]);
      return { ok: true, neoSynced: neoRes !== null };
    });
  }

  if (body.type === 'cluster') {
    const name = str(body.name, 'Cluster name', { max: 40 });
    await tryGraph(() => cypher('MERGE (:Cluster {name: $name})', { name }, true));
    return await db(async (c) => {
      // Create cluster with a placeholder skill or no-op if exists
      const firstSkill = (await c.query('SELECT skill_id FROM skills LIMIT 1')).rows[0]?.skill_id;
      if (firstSkill) {
        await c.query(`
          INSERT INTO graph_skill_clusters (cluster_name, skill_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [name, firstSkill]);
      }
      return { ok: true };
    });
  }

  if (body.type === 'in_cluster') {
    const skill = int(body.skill_id, 'Skill', { min: 1 }), name = str(body.cluster, 'Cluster', { max: 40 });
    await tryGraph(() => cypher(
      `MATCH (s:Skill {skill_id: toInteger($skill)}) MATCH (k:Cluster {name: $name})
       OPTIONAL MATCH (s)-[old:IN_CLUSTER]->() DELETE old
       MERGE (s)-[:IN_CLUSTER]->(k) RETURN count(s) AS n`,
      { skill, name }, true
    ));

    return await db(async (c) => {
      await c.query('DELETE FROM graph_skill_clusters WHERE skill_id = $1', [skill]);
      await c.query('INSERT INTO graph_skill_clusters (cluster_name, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [name, skill]);
      return { ok: true };
    });
  }

  throw httpError(400, 'Unknown graph operation.');
});

export const PUT = handler(['admin'], async ({ body, db }) => {
  const a = int(body.a, 'Skill A', { min: 1 }), b = int(body.b, 'Skill B', { min: 1 });
  const s = num(body.strength, 'Strength', { min: 1, max: 10 });

  await tryGraph(() => cypher(
    'MATCH (:Skill {skill_id: toInteger($a)})-[l:RELATED_TO]->(:Skill {skill_id: toInteger($b)}) SET l.strength = toInteger($s) RETURN count(l) AS n',
    { a, b, s }, true
  ));

  return await db(async (c) => {
    await c.query(`
      UPDATE graph_related_skills
      SET strength = $3
      WHERE (skill_a_id = $1 AND skill_b_id = $2) OR (skill_a_id = $2 AND skill_b_id = $1)
    `, [a, b, s]);
    return { ok: true };
  });
});

export const DELETE = handler(['admin'], async ({ query, db }) => {
  if (query.type === 'related') {
    const a = int(query.a, 'Skill A'), b = int(query.b, 'Skill B');
    await tryGraph(() => cypher(
      'MATCH (:Skill {skill_id: toInteger($a)})-[l:RELATED_TO]->(:Skill {skill_id: toInteger($b)}) DELETE l',
      { a, b }, true
    ));

    return await db(async (c) => {
      await c.query(`
        DELETE FROM graph_related_skills
        WHERE (skill_a_id = $1 AND skill_b_id = $2) OR (skill_a_id = $2 AND skill_b_id = $1)
      `, [a, b]);
      return { ok: true };
    });
  }

  if (query.type === 'cluster') {
    const name = str(query.name, 'Cluster', { max: 40 });
    await tryGraph(() => cypher('MATCH (k:Cluster {name: $name}) DETACH DELETE k', { name }, true));

    return await db(async (c) => {
      await c.query('DELETE FROM graph_skill_clusters WHERE cluster_name = $1', [name]);
      return { ok: true };
    });
  }

  throw httpError(400, 'Unknown graph operation.');
});

export const dynamic = 'force-dynamic';
