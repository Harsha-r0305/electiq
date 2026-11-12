import { handler } from '@/lib/route';
import { cypher, tryGraph } from '@/lib/neo.mjs';

export const GET = handler(['admin'], async ({ db }) => {
  return await db(async (c) => {
    // 1. Department dashboard
    const deptRes = await c.query('SELECT * FROM v_department_dashboard ORDER BY department');

    // 2. System totals
    const userRolesRes = await c.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role');
    const userTotals = {};
    userRolesRes.rows.forEach(r => { userTotals[r.role] = parseInt(r.count, 10); });

    const coursesCount = (await c.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active FROM courses')).rows[0];
    const enrCount = (await c.query('SELECT COUNT(*) AS total FROM enrollments')).rows[0]?.total;
    const fbCount = (await c.query('SELECT COUNT(*) AS total FROM feedback')).rows[0]?.total;
    const pubSeniorCount = (await c.query("SELECT COUNT(*) AS total FROM senior_profiles WHERE status = 'published'")).rows[0]?.total;

    // 3. Pending queue: flagged reports and entity requests
    const flaggedRes = await c.query(`
      SELECT mr.report_id, mr.content_type, mr.content_id, mr.reason, mr.created_at, mr.status,
             u.email AS reporter_email, u.role AS reporter_role
      FROM moderation_reports mr
      JOIN users u ON u.user_id = mr.reporter_id
      WHERE mr.status = 'pending'
      ORDER BY mr.created_at DESC
      LIMIT 10
    `);

    const requestsRes = await c.query(`
      SELECT er.request_id, er.type, er.name, er.details, er.created_at,
             sp.senior_code
      FROM entity_requests er
      JOIN students s ON s.student_id = er.student_id
      LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
      WHERE er.status = 'pending'
      ORDER BY er.created_at DESC
      LIMIT 10
    `);

    // 4. Senior profiles waiting for admin approval (the main review queue)
    const pendingSeniorsRes = await c.query(`
      SELECT sp.senior_code, COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS display_name,
             sp.status, sp.submitted_at, sp.headline
      FROM senior_profiles sp
      WHERE sp.status IN ('submitted', 'under_review', 'faculty_approved')
      ORDER BY sp.submitted_at ASC NULLS LAST
      LIMIT 10
    `);

    // 5. Recent audit log entries
    const auditRes = await c.query(`
      SELECT a.log_id, a.user_id, a.action, a.table_name, a.row_pk, a.logged_at,
             u.email AS user_email, u.role AS user_role
      FROM audit_log a
      LEFT JOIN users u ON u.user_id = a.user_id
      ORDER BY a.logged_at DESC
      LIMIT 8
    `);

    // 6. Graph sync status: PostgreSQL to Neo4j / Integrated Graph sync
    // Honest default: Neo4j counts as unreachable until a real query succeeds.
    let neo4jStatus = { reachable: false, pgCourses: parseInt(coursesCount.total, 10), neoCourses: null, mismatch: false, engine: 'Neo4j not connected (using PostgreSQL graph fallback)' };
    try {
      const records = await tryGraph(() => cypher('MATCH (c:Course) RETURN count(c) AS c'));
      if (records && records[0]) {
        const neoCourseCount = records[0].c;
        neo4jStatus.reachable = true;
        neo4jStatus.neoCourses = neoCourseCount;
        neo4jStatus.mismatch = neoCourseCount !== parseInt(coursesCount.total, 10);
        neo4jStatus.engine = 'Neo4j Active (Port 7687)';
      }
    } catch {}

    return {
      departments: deptRes.rows,
      totals: {
        users: userTotals,
        courses: {
          total: parseInt(coursesCount.total, 10),
          active: parseInt(coursesCount.active, 10)
        },
        enrollments: parseInt(enrCount || 0, 10),
        feedback: parseInt(fbCount || 0, 10),
        publishedSeniors: parseInt(pubSeniorCount || 0, 10)
      },
      pendingQueue: {
        flaggedReports: flaggedRes.rows,
        pendingSeniors: pendingSeniorsRes.rows,
        entityRequests: requestsRes.rows,
        totalPending: flaggedRes.rows.length + requestsRes.rows.length + pendingSeniorsRes.rows.length
      },
      stalenessAlert: null,
      recentAudit: auditRes.rows,
      graphSync: neo4jStatus
    };
  });
});

export const dynamic = 'force-dynamic';
