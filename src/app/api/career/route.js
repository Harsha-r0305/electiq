import { handler } from '@/lib/route';
import { int } from '@/lib/validate';
import { cypher, tryGraph } from '@/lib/neo.mjs';
import { httpError } from '@/lib/errors';

// Career path simulator & Role Graph generator:
// Role -> required skills -> electives that teach them (Slots I-IV) + prerequisite chains.
export const GET = handler(null, async ({ query, db }) => {
  const roleId = int(query.role, 'Role', { min: 1 });

  const data = await db(async (c) => {
    // 1. Role metadata & market demand
    const role = (await c.query('SELECT role_id, title FROM job_roles WHERE role_id = $1', [roleId])).rows[0];
    if (!role) throw httpError(404, 'Role not found.');

    const demand = (await c.query(`
      SELECT postings_count, demand_score, avg_salary_lpa, trend_indicator, year, quarter
      FROM role_demand
      WHERE role_id = $1
      ORDER BY year DESC, quarter DESC LIMIT 1
    `, [roleId])).rows[0] || null;

    // 2. Required skills with electives teaching them
    const skills = (await c.query(
      `SELECT s.skill_id, s.name, s.category, rs.importance,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'course_id', cr.course_id,
                  'code', cr.code,
                  'title', cr.title,
                  'slot', cr.elective_slot,
                  'vertical', cr.vertical,
                  'depth', cs.depth
                ) ORDER BY cs.depth DESC)
                FROM course_skills cs
                JOIN courses cr ON cr.course_id = cs.course_id
                WHERE cs.skill_id = s.skill_id AND cr.is_elective = true
              ), '[]'::json) AS taught_by,
              g.demand_score, g.uncovered
         FROM role_skills rs
         JOIN skills s ON s.skill_id = rs.skill_id
         LEFT JOIN v_skill_gap g ON g.skill_id = s.skill_id
        WHERE rs.role_id = $1
        ORDER BY rs.importance DESC, s.name`,
      [roleId]
    )).rows;

    const coverage = (await c.query('SELECT fn_skill_coverage($1) AS pct', [roleId])).rows[0].pct;

    // 3. Pre-computed role elective paths from seed/optimization
    const paths = (await c.query(
      `SELECT rp.rank, rp.skill_match_pct, c.course_id, c.code, c.title, rp.elective_slot, c.vertical
         FROM role_elective_paths rp
         JOIN courses c ON c.course_id = rp.course_id
        WHERE rp.role_id = $1
        ORDER BY rp.rank`,
      [roleId]
    )).rows;

    // 4. Fallback or baseline SQL ranking of matching courses
    const sqlCourses = (await c.query(
      `SELECT c.course_id, c.code, c.title, c.elective_slot, c.vertical,
              array_agg(DISTINCT s.name) AS covers,
              SUM(rs.importance * cs.depth)::int AS score,
              COALESCE((SELECT array_agg(p.title) FROM course_prerequisites cp JOIN courses p ON p.course_id = cp.prereq_id WHERE cp.course_id = c.course_id), '{}') AS take_first
         FROM role_skills rs
         JOIN course_skills cs ON cs.skill_id = rs.skill_id
         JOIN courses c ON c.course_id = cs.course_id
         JOIN skills s ON s.skill_id = rs.skill_id
        WHERE rs.role_id = $1 AND c.is_elective = true
        GROUP BY c.course_id, c.code, c.title, c.elective_slot, c.vertical
        ORDER BY score DESC LIMIT 12`,
      [roleId]
    )).rows;

    return { role, demand, skills, coverage, paths, sqlCourses };
  });

  // Try Neo4j graph traversal if active
  let graphCourses = await tryGraph(() => cypher(
    `MATCH (r:Role {role_id: toInteger($roleId)})-[q:REQUIRES]->(s:Skill)<-[t:TEACHES]-(c:Course)
     WHERE c.elective_slot IN ['Elective I', 'Elective II', 'Elective III', 'Elective IV']
     WITH c, collect(DISTINCT s.name) AS covers, sum(q.importance * t.depth) AS score
     ORDER BY score DESC LIMIT 12
     OPTIONAL MATCH (pre:Course)-[:PREREQUISITE_OF*1..3]->(c)
     RETURN c.course_id AS course_id, c.code AS code, c.title AS title,
            c.elective_slot AS elective_slot, c.vertical AS vertical,
            covers, score,
            [x IN collect(DISTINCT pre.code) WHERE x IS NOT NULL] AS take_first
     ORDER BY score DESC`,
    { roleId }
  ));

  const source = graphCourses ? 'neo4j' : 'postgresql-graph';
  const courses = graphCourses || data.sqlCourses;

  // Compute 4-slot recommended pathway (best course for Elective I, II, III, IV)
  const SLOTS = ['Elective I', 'Elective II', 'Elective III', 'Elective IV'];
  const recommendedTrack = SLOTS.map((slot) => {
    // Check paths first
    const fromPath = data.paths.find((p) => p.elective_slot === slot);
    if (fromPath) {
      const match = courses.find((c) => c.course_id === fromPath.course_id);
      return {
        slot,
        course_id: fromPath.course_id,
        code: fromPath.code,
        title: fromPath.title,
        vertical: fromPath.vertical,
        match_pct: fromPath.skill_match_pct,
        covers: match?.covers || [],
        take_first: match?.take_first || []
      };
    }
    // Otherwise pick best scored course in this slot
    const inSlot = courses.filter((c) => c.elective_slot === slot);
    if (inSlot.length > 0) {
      const top = inSlot[0];
      return {
        slot,
        course_id: top.course_id,
        code: top.code,
        title: top.title,
        vertical: top.vertical,
        score: top.score,
        covers: top.covers || [],
        take_first: top.take_first || []
      };
    }
    return { slot, course: null };
  });

  // Construct visual Role Graph (nodes & links)
  const nodes = [
    { id: `role_${roleId}`, label: data.role.title, type: 'role', r: 34 }
  ];
  const links = [];
  const addedNodes = new Set([`role_${roleId}`]);

  // Skill nodes & role-skill links
  for (const s of data.skills) {
    const sId = `skill_${s.skill_id}`;
    if (!addedNodes.has(sId)) {
      addedNodes.add(sId);
      nodes.push({
        id: sId,
        label: s.name,
        type: 'skill',
        importance: s.importance,
        category: s.category,
        r: 10 + s.importance * 3
      });
    }
    links.push({
      source: `role_${roleId}`,
      target: sId,
      type: 'REQUIRES',
      weight: s.importance
    });
  }

  // Course nodes & course-skill links
  for (const c of courses.slice(0, 8)) {
    const cId = `course_${c.course_id}`;
    if (!addedNodes.has(cId)) {
      addedNodes.add(cId);
      nodes.push({
        id: cId,
        label: c.title,
        title: c.title,
        type: 'course',
        slot: c.elective_slot,
        vertical: c.vertical,
        score: c.score,
        r: 22
      });
    }
    // Link to covered skills
    for (const skillName of (c.covers || [])) {
      const sObj = data.skills.find((x) => x.name === skillName);
      if (sObj) {
        links.push({
          source: cId,
          target: `skill_${sObj.skill_id}`,
          type: 'TEACHES'
        });
      }
    }
    // Prerequisite links
    for (const preTitle of (c.take_first || [])) {
      const pId = `prereq_${preTitle.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (!addedNodes.has(pId)) {
        addedNodes.add(pId);
        nodes.push({
          id: pId,
          label: preTitle,
          type: 'prereq',
          r: 16
        });
      }
      links.push({
        source: pId,
        target: cId,
        type: 'PREREQUISITE_OF'
      });
    }
  }

  return {
    role: data.role,
    demand: data.demand,
    skills: data.skills,
    coverage: data.coverage,
    paths: data.paths,
    courses,
    recommendedTrack,
    graph: { nodes, links },
    source
  };
});

export const dynamic = 'force-dynamic';
