import { handler } from '@/lib/route';

export const GET = handler(['faculty'], async ({ session, db }) => {
  return await db(async (c) => {
    // 1. Faculty profile details
    const facRes = await c.query(`
      SELECT f.faculty_id, f.name, f.designation, d.dept_id, d.name AS dept_name
      FROM faculty f
      JOIN departments d ON d.dept_id = f.dept_id
      WHERE f.user_id = $1
    `, [session.uid]);
    const faculty = facRes.rows[0];
    if (!faculty) return { error: 'Faculty profile not found' };
    const fid = faculty.faculty_id;

    // 2. Assigned courses with summary statistics
    const coursesRes = await c.query(`
      SELECT c.course_id, c.code, c.title, c.semester, c.level, c.credits, c.is_active,
             COALESCE(enr.total_enrolled, 0) AS enrollment_count,
             COALESCE(enr.completed_count, 0) AS completed_count,
             s.avg_difficulty, s.avg_workload, s.avg_usefulness, s.feedback_count,
             fr.relevance, fr.future_scope, fr.comment AS faculty_comment,
             s.placed_students, s.avg_package
      FROM courses c
      JOIN v_course_summary s ON s.course_id = c.course_id
      LEFT JOIN faculty_reviews fr ON fr.course_id = c.course_id AND fr.faculty_id = $1
      LEFT JOIN (
        SELECT course_id,
               COUNT(*) AS total_enrolled,
               COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
        FROM enrollments
        GROUP BY course_id
      ) enr ON enr.course_id = c.course_id
      WHERE c.faculty_id = $1
      ORDER BY c.semester, c.code
    `, [fid]);
    const assignedCourses = coursesRes.rows;

    // 3. For each course, fetch prerequisites, what it unlocks, skills taught (with depth), and resources
    const courseIds = assignedCourses.map(c => c.course_id);
    let prereqMap = {};
    let unlocksMap = {};
    let skillsMap = {};
    let resourcesMap = {};
    let placementMap = {};
    let feedbackMap = {};

    if (courseIds.length > 0) {
      // Prerequisites
      const prereqsRes = await c.query(`
        SELECT cp.course_id, p.course_id AS prereq_id, p.code, p.title
        FROM course_prerequisites cp
        JOIN courses p ON p.course_id = cp.prereq_id
        WHERE cp.course_id = ANY($1)
      `, [courseIds]);
      prereqsRes.rows.forEach(r => {
        if (!prereqMap[r.course_id]) prereqMap[r.course_id] = [];
        prereqMap[r.course_id].push({ course_id: r.prereq_id, code: r.code, title: r.title });
      });

      // What this course unlocks (where prereq_id = course_id)
      const unlocksRes = await c.query(`
        SELECT cp.prereq_id AS course_id, c.course_id AS unlocked_id, c.code, c.title
        FROM course_prerequisites cp
        JOIN courses c ON c.course_id = cp.course_id
        WHERE cp.prereq_id = ANY($1)
      `, [courseIds]);
      unlocksRes.rows.forEach(r => {
        if (!unlocksMap[r.course_id]) unlocksMap[r.course_id] = [];
        unlocksMap[r.course_id].push({ course_id: r.unlocked_id, code: r.code, title: r.title });
      });

      // Skills taught with depth (1-3) & market demand
      const skillsRes = await c.query(`
        SELECT cs.course_id, s.skill_id, s.name, s.category, cs.depth,
               COALESCE(md.demand_score, 0) AS demand_score,
               COALESCE(md.postings_count, 0) AS postings_count
        FROM course_skills cs
        JOIN skills s ON s.skill_id = cs.skill_id
        LEFT JOIN LATERAL (
          SELECT demand_score, postings_count
          FROM market_demand m
          WHERE m.skill_id = s.skill_id
          ORDER BY year DESC LIMIT 1
        ) md ON TRUE
        WHERE cs.course_id = ANY($1)
        ORDER BY cs.depth DESC, md.demand_score DESC
      `, [courseIds]);
      skillsRes.rows.forEach(r => {
        if (!skillsMap[r.course_id]) skillsMap[r.course_id] = [];
        skillsMap[r.course_id].push(r);
      });

      // Resources attached (read-only)
      const resRes = await c.query(`
        SELECT r.course_id, r.resource_id, r.type, r.title, r.url
        FROM resources r
        WHERE r.course_id = ANY($1)
      `, [courseIds]);
      resRes.rows.forEach(r => {
        if (!resourcesMap[r.course_id]) resourcesMap[r.course_id] = [];
        resourcesMap[r.course_id].push(r);
      });

      // Placement relevance (aggregate only): top companies and roles
      const placeDetailsRes = await c.query(`
        SELECT vp.course_id,
               c.name AS company_name,
               jr.title AS role_title,
               COUNT(*) AS placed_count,
               ROUND(AVG(vp.package_lpa), 2) AS avg_pkg
        FROM v_course_placements vp
        JOIN placements p ON p.placement_id = vp.placement_id
        JOIN companies c ON c.company_id = p.company_id
        JOIN job_roles jr ON jr.role_id = p.role_id
        WHERE vp.course_id = ANY($1) AND vp.type = 'full_time'
        GROUP BY vp.course_id, c.name, jr.title
        ORDER BY placed_count DESC
      `, [courseIds]);
      placeDetailsRes.rows.forEach(r => {
        if (!placementMap[r.course_id]) placementMap[r.course_id] = [];
        if (placementMap[r.course_id].length < 5) {
          placementMap[r.course_id].push(r);
        }
      });

      // Anonymized feedback list on my courses
      const fbRes = await c.query(`
        SELECT f.feedback_id, e.course_id, f.difficulty, f.workload, f.usefulness,
               f.review_text, f.created_at, e.term, s.batch_year
        FROM feedback f
        JOIN enrollments e ON e.enrollment_id = f.enrollment_id
        JOIN students s ON s.student_id = e.student_id
        WHERE e.course_id = ANY($1) AND f.is_hidden = false
        ORDER BY f.created_at DESC
      `, [courseIds]);
      fbRes.rows.forEach(r => {
        if (!feedbackMap[r.course_id]) feedbackMap[r.course_id] = [];
        feedbackMap[r.course_id].push(r);
      });
    }

    // 4. Department Averages for Peer Comparison
    const deptAvgRes = await c.query(`
      SELECT 
        ROUND(AVG(s.avg_difficulty), 2) AS dept_avg_difficulty,
        ROUND(AVG(s.avg_usefulness), 2) AS dept_avg_usefulness,
        ROUND(AVG(s.avg_package), 2) AS dept_avg_package
      FROM v_course_summary s
      WHERE s.dept_id = $1
    `, [faculty.dept_id]);
    const deptAvg = deptAvgRes.rows[0] ?? {
      dept_avg_difficulty: 3.0,
      dept_avg_usefulness: 3.5,
      dept_avg_package: 14.0
    };

    // 5. Pending actions: courses without a rating
    const unratedCourses = assignedCourses.filter(c => !c.relevance || !c.future_scope);

    // Combine courses with their enriched details
    const coursesEnriched = assignedCourses.map(course => ({
      ...course,
      prerequisites: prereqMap[course.course_id] || [],
      unlocks: unlocksMap[course.course_id] || [],
      skills: skillsMap[course.course_id] || [],
      resources: resourcesMap[course.course_id] || [],
      topPlacements: placementMap[course.course_id] || [],
      feedback: feedbackMap[course.course_id] || []
    }));

    return {
      faculty,
      pendingActions: {
        unratedCount: unratedCourses.length,
        unratedCourses: unratedCourses.map(c => ({ course_id: c.course_id, code: c.code, title: c.title }))
      },
      courses: coursesEnriched,
      peerComparison: deptAvg
    };
  });
});

export const dynamic = 'force-dynamic';

