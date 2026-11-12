import { handler } from '@/lib/route';

export const GET = handler(['student', 'senior'], async ({ session, db }) => {
  return await db(async (c) => {
    // 1. Student identity & department
    const studentRes = await c.query(`
      SELECT s.student_id, s.srn, s.name, s.batch_year, d.name AS department, d.dept_id
      FROM students s
      JOIN departments d ON d.dept_id = s.dept_id
      WHERE s.user_id = $1
    `, [session.uid]);
    const student = studentRes.rows[0];
    if (!student) return { error: 'Student record not found' };

    // 2. Current CGPA from v_student_cgpa
    const cgpaRes = await c.query(`
      SELECT cgpa, courses_graded
      FROM v_student_cgpa
      WHERE student_id = $1
    `, [student.student_id]);
    const cgpaInfo = cgpaRes.rows[0] ?? { cgpa: null, courses_graded: 0 };

    // 3. Enrollments list (RLS strictly enforced)
    const enrollmentsRes = await c.query(`
      SELECT e.enrollment_id, c.course_id, c.code, c.title, c.credits, c.semester, c.level,
             e.term, e.status, e.grade_points, e.grade_posted_at
      FROM enrollments e
      JOIN courses c ON c.course_id = e.course_id
      WHERE e.student_id = $1
      ORDER BY e.term DESC, c.code
    `, [student.student_id]);
    const enrollments = enrollmentsRes.rows;

    // 4. Calculate total completed credits from completed enrollments with posted grades
    let completedCredits = 0;
    for (const e of enrollments) {
      if (e.status === 'completed' && e.grade_points !== null) {
        completedCredits += Number(e.credits) || 0;
      }
    }

    // 5. Dynamic Academic Standing
    let academicStanding = {
      rank: null,
      total: null,
      percentile: null,
      label: 'Not Ranked Yet'
    };
    if (cgpaInfo.cgpa !== null) {
      try {
        const standingRes = await c.query('SELECT * FROM fn_get_student_academic_standing($1)', [student.student_id]);
        if (standingRes.rows.length > 0 && standingRes.rows[0].standing_label) {
          const row = standingRes.rows[0];
          academicStanding = {
            rank: row.dept_rank ? Number(row.dept_rank) : null,
            total: row.total_students ? Number(row.total_students) : null,
            percentile: row.pct_rank ? Number(row.pct_rank) : null,
            label: row.standing_label
          };
        }
      } catch (err) {
        academicStanding = {
          rank: null,
          total: null,
          percentile: null,
          label: Number(cgpaInfo.cgpa) >= 8.5 ? "Top 10% Academic Standing • Dean's Honor List" : (Number(cgpaInfo.cgpa) >= 7.5 ? "Top 25% Academic Standing" : "Good Standing")
        };
      }
    }

    // 6. Semester-wise grade trend
    // Group completed enrollments by term to compute term GPA
    const termMap = {};
    for (const e of enrollments) {
      if (e.status === 'completed' && e.grade_points !== null) {
        if (!termMap[e.term]) {
          termMap[e.term] = { term: e.term, totalWeighted: 0, totalCredits: 0, courses: 0 };
        }
        const cr = Number(e.credits) || 4;
        termMap[e.term].totalWeighted += Number(e.grade_points) * cr;
        termMap[e.term].totalCredits += cr;
        termMap[e.term].courses += 1;
      }
    }

    // Sort terms (e.g. 2024-ODD, 2025-EVEN, 2025-ODD, etc.)
    const termOrder = (t) => {
      const [year, sem] = t.split('-');
      return parseInt(year, 10) * 10 + (sem === 'EVEN' ? 2 : 1);
    };

    const gradeTrend = Object.values(termMap)
      .sort((a, b) => termOrder(a.term) - termOrder(b.term))
      .map((t) => ({
        term: t.term,
        gpa: Number((t.totalWeighted / (t.totalCredits || 1)).toFixed(2)),
        credits: t.totalCredits,
        courses: t.courses
      }));

    return {
      student,
      cgpa: cgpaInfo.cgpa ? Number(cgpaInfo.cgpa) : null,
      coursesGraded: Number(cgpaInfo.courses_graded) || 0,
      completedCredits,
      academicStanding,
      gradeTrend,
      enrollments
    };
  });
});

export const dynamic = 'force-dynamic';

