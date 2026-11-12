import { handler } from '@/lib/route';

const SALARY_RANGES = [
  { id: 'above_50', label: 'Above 50 LPA', min: 50.0, max: null },
  { id: '30_50', label: '30–50 LPA', min: 30.0, max: 50.0 },
  { id: '20_30', label: '20–30 LPA', min: 20.0, max: 30.0 },
  { id: '15_20', label: '15–20 LPA', min: 15.0, max: 20.0 },
  { id: '12_15', label: '12–15 LPA', min: 12.0, max: 15.0 },
  { id: '8_12', label: '8–12 LPA', min: 8.0, max: 12.0 },
  { id: '5_8', label: '5–8 LPA', min: 5.0, max: 8.0 },
  { id: 'below_5', label: 'Below 5 LPA', min: 0.0, max: 5.0 },
];

export const GET = handler(['student', 'admin', 'faculty', 'senior'], async ({ query, db }) => {
  return await db(async (c) => {
    // 1. Calculate dynamic counts for all 8 salary ranges from placements.package_lpa
    const rangeCountsRes = await c.query(`
      SELECT
        COUNT(*) FILTER (WHERE p.package_lpa >= 50.0) AS above_50,
        COUNT(*) FILTER (WHERE p.package_lpa >= 30.0 AND p.package_lpa < 50.0) AS r_30_50,
        COUNT(*) FILTER (WHERE p.package_lpa >= 20.0 AND p.package_lpa < 30.0) AS r_20_30,
        COUNT(*) FILTER (WHERE p.package_lpa >= 15.0 AND p.package_lpa < 20.0) AS r_15_20,
        COUNT(*) FILTER (WHERE p.package_lpa >= 12.0 AND p.package_lpa < 15.0) AS r_12_15,
        COUNT(*) FILTER (WHERE p.package_lpa >= 8.0 AND p.package_lpa < 12.0) AS r_8_12,
        COUNT(*) FILTER (WHERE p.package_lpa >= 5.0 AND p.package_lpa < 8.0) AS r_5_8,
        COUNT(*) FILTER (WHERE p.package_lpa < 5.0) AS below_5,
        COUNT(*) AS total_seniors
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      LEFT JOIN LATERAL (
        SELECT MAX(package_lpa) AS package_lpa
        FROM placements
        WHERE student_id = sp.student_id AND type = 'full_time'
          AND verified = true AND COALESCE(verification_status, 'verified') = 'verified'
      ) p ON TRUE
      WHERE sp.status = 'published' AND (sp.consent IS NULL OR sp.consent = true)
    `);

    const rRow = rangeCountsRes.rows[0] || {};
    const rangeCounts = {
      all: parseInt(rRow.total_seniors || 0, 10),
      above_50: parseInt(rRow.above_50 || 0, 10),
      '30_50': parseInt(rRow.r_30_50 || 0, 10),
      '20_30': parseInt(rRow.r_20_30 || 0, 10),
      '15_20': parseInt(rRow.r_15_20 || 0, 10),
      '12_15': parseInt(rRow.r_12_15 || 0, 10),
      '8_12': parseInt(rRow.r_8_12 || 0, 10),
      '5_8': parseInt(rRow.r_5_8 || 0, 10),
      below_5: parseInt(rRow.below_5 || 0, 10),
    };

    // 2. Build filters
    const conditions = ["sp.status = 'published'", "(sp.consent IS NULL OR sp.consent = true)"];
    const params = [];
    let idx = 1;

    // Salary range filter
    const selectedRange = query.salary_range || query.tier;
    if (selectedRange && selectedRange !== 'all') {
      const matched = SALARY_RANGES.find((r) => r.id === selectedRange);
      if (matched) {
        if (matched.min !== null && matched.max !== null) {
          conditions.push(`pl.package_lpa >= $${idx++} AND pl.package_lpa < $${idx++}`);
          params.push(matched.min, matched.max);
        } else if (matched.min !== null) {
          conditions.push(`pl.package_lpa >= $${idx++}`);
          params.push(matched.min);
        } else if (matched.max !== null) {
          conditions.push(`pl.package_lpa < $${idx++}`);
          params.push(matched.max);
        }
      }
    }

    // Company filter
    if (query.company) {
      conditions.push(`cmp.name ILIKE $${idx++}`);
      params.push(`%${query.company}%`);
    }

    // Job role filter
    if (query.role) {
      conditions.push(`jr.title ILIKE $${idx++}`);
      params.push(`%${query.role}%`);
    }

    // Graduation year filter
    if (query.batch_year) {
      conditions.push(`s.batch_year = $${idx++}`);
      params.push(parseInt(query.batch_year, 10));
    }

    // Department filter
    if (query.dept_id) {
      conditions.push(`s.dept_id = $${idx++}`);
      params.push(parseInt(query.dept_id, 10));
    }

    // CGPA filters
    if (query.min_cgpa) {
      conditions.push(`s_cgpa.cgpa >= $${idx++}`);
      params.push(parseFloat(query.min_cgpa));
    }
    if (query.max_cgpa) {
      conditions.push(`s_cgpa.cgpa <= $${idx++}`);
      params.push(parseFloat(query.max_cgpa));
    }

    // Elective filter (search by course title or id)
    if (query.elective) {
      conditions.push(`EXISTS (
        SELECT 1 FROM enrollments e
        JOIN courses c ON c.course_id = e.course_id
        WHERE e.student_id = sp.student_id
          AND c.is_elective = true
          AND (c.title ILIKE $${idx} OR c.course_id::text = $${idx})
      )`);
      params.push(`%${query.elective}%`);
      idx++;
    }

    // Publications or hackathon filter
    if (query.has_publications === 'true') {
      conditions.push(`(SELECT COUNT(*) FROM publications pub WHERE pub.student_id = sp.student_id) > 0`);
    }
    if (query.won_hackathon === 'true') {
      conditions.push(`(SELECT COUNT(*) FROM achievements ach WHERE ach.student_id = sp.student_id AND ach.role_status = 'won') > 0`);
    }

    // Sorting
    let orderBy = 'pl.package_lpa DESC NULLS LAST, s_cgpa.cgpa DESC NULLS LAST';
    if (query.sort === 'cgpa') {
      orderBy = 's_cgpa.cgpa DESC NULLS LAST, pl.package_lpa DESC NULLS LAST';
    } else if (query.sort === 'package') {
      orderBy = 'pl.package_lpa DESC NULLS LAST, s_cgpa.cgpa DESC NULLS LAST';
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const seniorsSql = `
      SELECT
        sp.student_id,
        sp.senior_code,
        COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS display_name,
        COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS student_name,
        sp.headline,
        sp.specialization,
        sp.advice_for_juniors,
        d.name AS dept_name,
        s.batch_year,
        CASE WHEN sp.show_grades THEN ROUND(COALESCE(s_cgpa.cgpa, sp.cgpa)::numeric, 2) END AS cgpa,
        pl.package_lpa AS highest_package_lpa,
        CASE
          WHEN pl.package_lpa >= 50.00 THEN '50+ LPA'
          WHEN pl.package_lpa >= 35.00 THEN '35-50 LPA'
          WHEN pl.package_lpa >= 20.00 THEN '20-35 LPA'
          WHEN pl.package_lpa >= 12.00 THEN '12-20 LPA'
          WHEN pl.package_lpa >= 5.00 THEN '5-12 LPA'
          ELSE 'Below 5 LPA'
        END AS tier_name,
        cmp.name AS company_name,
        cmp.tier AS company_tier,
        jr.title AS role_title,
        pl.location AS job_location,
        pl.ppo_received,
        COALESCE(el.elective_list, '[]'::json) AS electives,
        COALESCE(counts.internships, 0) AS internship_count,
        COALESCE(counts.projects, 0) AS project_count,
        COALESCE(counts.papers, 0) AS paper_count,
        COALESCE(counts.hackathons, 0) AS hackathon_wins
      FROM senior_profiles sp
      JOIN students s ON s.student_id = sp.student_id
      JOIN departments d ON d.dept_id = s.dept_id
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(e.grade_points)::numeric, 2) AS cgpa
        FROM enrollments e
        WHERE e.student_id = sp.student_id AND e.grade_points IS NOT NULL
      ) s_cgpa ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          p.package_lpa,
          p.company_id,
          p.role_id,
          p.location,
          p.ppo_received
        FROM placements p
        WHERE p.student_id = sp.student_id AND p.type = 'full_time'
          AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'
        ORDER BY p.package_lpa DESC NULLS LAST
        LIMIT 1
      ) pl ON TRUE
      LEFT JOIN companies cmp ON cmp.company_id = pl.company_id
      LEFT JOIN job_roles jr ON jr.role_id = pl.role_id
      LEFT JOIN LATERAL (
        SELECT
          json_agg(json_build_object('course_id', c.course_id, 'title', c.title, 'vertical', c.vertical) ORDER BY c.title) AS elective_list
        FROM enrollments e
        JOIN courses c ON c.course_id = e.course_id
        WHERE e.student_id = sp.student_id AND c.is_elective = true
      ) el ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          (SELECT COUNT(*) FROM placements WHERE student_id = sp.student_id AND type = 'internship' AND verified = true) AS internships,
          (SELECT COUNT(*) FROM projects WHERE student_id = sp.student_id AND COALESCE(moderation_status,'approved') = 'approved') AS projects,
          (SELECT COUNT(*) FROM publications WHERE student_id = sp.student_id AND COALESCE(moderation_status,'approved') = 'approved') AS papers,
          (SELECT COUNT(*) FROM achievements WHERE student_id = sp.student_id AND role_status = 'won' AND COALESCE(moderation_status,'approved') = 'approved') AS hackathons
      ) counts ON TRUE
      ${whereClause}
      ORDER BY ${orderBy}
    `;

    const seniorsRes = await c.query(seniorsSql, params);

    return {
      salaryRanges: SALARY_RANGES,
      rangeCounts,
      seniors: seniorsRes.rows,
    };
  });
});

export const dynamic = 'force-dynamic';
