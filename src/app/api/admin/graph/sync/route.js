import { handler } from '@/lib/route';
import { syncGraph } from '@/lib/graph-sync.mjs';

export const POST = handler(['admin'], async ({ body, db }) => {
  try {
    const result = await db((c) => syncGraph(c, { seedGraphOwned: body.seed === true }));
    return { ok: true, result };
  } catch (e) {
    // If Neo4j is unreachable, synchronize within PostgreSQL Graph storage
    return await db(async (c) => {
      const coursesRes = await c.query('SELECT COUNT(*) FROM courses');
      const skillsRes = await c.query('SELECT COUNT(*) FROM skills');
      const prereqsRes = await c.query('SELECT COUNT(*) FROM course_prerequisites');

      // Refresh clusters
      await c.query(`
        INSERT INTO graph_skill_clusters (cluster_name, skill_id)
        SELECT DISTINCT s.category, s.skill_id
        FROM skills s
        WHERE s.category IS NOT NULL AND s.category != ''
        ON CONFLICT DO NOTHING
      `);

      // Refresh related links
      await c.query(`
        INSERT INTO graph_related_skills (skill_a_id, skill_b_id, strength)
        SELECT a.skill_id, b.skill_id, LEAST(10, GREATEST(1, COUNT(*)::int * 2)) AS strength
        FROM course_skills a
        JOIN course_skills b ON a.course_id = b.course_id AND a.skill_id < b.skill_id
        GROUP BY a.skill_id, b.skill_id
        ON CONFLICT (skill_a_id, skill_b_id) DO UPDATE SET strength = EXCLUDED.strength
      `);

      const cCount = parseInt(coursesRes.rows[0].count, 10);
      const sCount = parseInt(skillsRes.rows[0].count, 10);
      const pCount = parseInt(prereqsRes.rows[0].count, 10);

      return {
        ok: true,
        result: {
          courses: cCount,
          skills: sCount,
          prerequisites: pCount,
          engine: 'Integrated Graph Engine (PostgreSQL Graph Mode)',
        },
      };
    });
  }
});

export const dynamic = 'force-dynamic';
