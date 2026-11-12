// ElectIQ :: Comprehensive Curriculum & Role Graph Ingestion
// Seeds the database with all 50 courses (9 core + 41 electives across Elective I-IV),
// all 27 job roles, 94 skills, role pathways, prerequisites, seniors, placements,
// projects, feedback, and interview prep from extracted_zip/csv.

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const CSV_DIR = fs.existsSync(path.join('data', 'curriculum_csv'))
  ? path.join('data', 'curriculum_csv')
  : (fs.existsSync(path.resolve('..', 'extracted_zip', 'csv'))
      ? path.resolve('..', 'extracted_zip', 'csv')
      : path.join(process.cwd(), 'extracted_zip', 'csv'));
const DEMO_PW = 'Password@123';
const pwHash = bcrypt.hashSync(DEMO_PW, 10);

const c = new pg.Client({ connectionString: process.env.OWNER_DATABASE_URL });
await c.connect();

// Seeded deterministic PRNG for reproducible database population
function createSeededRandom(seed = 42) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = createSeededRandom(20260320);

console.log('Ingesting curriculum and role graph data from:', CSV_DIR);

function parseCSV(filename) {
  const filePath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  function parseLine(line) {
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields.map((f) => f.trim());
  }

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
}

// 1. Departments
console.log('-> Ingesting departments...');
await c.query(`
  INSERT INTO departments (dept_id, name) VALUES
    (1, 'Computer Science and Engineering'),
    (2, 'Electronics and Communication'),
    (3, 'Mathematics and Sciences')
  ON CONFLICT (dept_id) DO UPDATE SET name = EXCLUDED.name;
`);
await c.query(`SELECT setval('departments_dept_id_seq', (SELECT MAX(dept_id) FROM departments));`);

// 2. Skills with automated categorized grouping
console.log('-> Ingesting skills...');
const rawSkills = parseCSV('skills.csv');
function getSkillCategory(id, name) {
  const n = parseInt(id, 10);
  if (n >= 1 && n <= 6) return 'Machine Learning';
  if (n >= 7 && n <= 13) return 'Generative AI & LLMs';
  if (n >= 14 && n <= 20) return 'AI Agents';
  if (n >= 21 && n <= 29) return 'MLOps & Data Engineering';
  if (n >= 30 && n <= 34) return 'Data Science & Analytics';
  if (n >= 35 && n <= 42) return 'Responsible AI & Security';
  if (n >= 43 && n <= 46) return 'Computer Vision';
  if (n >= 47 && n <= 49) return 'Reinforcement Learning';
  if (n >= 50 && n <= 53) return 'Graph & NLP';
  if (n >= 54 && n <= 57) return 'BioAI & Life Sciences';
  if (n >= 58 && n <= 60) return 'Frugal & Edge AI';
  if (n >= 61 && n <= 63) return 'Business & Finance';
  if (n >= 64 && n <= 74) return 'Cybersecurity & Cryptography';
  if (n >= 75 && n <= 76) return 'Blockchain';
  if (n >= 77 && n <= 82) return 'Systems & RTOS';
  if (n >= 83 && n <= 85) return 'Robotics & Autonomous Systems';
  if (n >= 86 && n <= 87) return 'Wireless & Automotive';
  if (n >= 88 && n <= 90) return 'AR/VR & Digital Twins';
  if (n >= 91 && n <= 92) return 'Quantum & Photonics';
  return 'Speech & Signal Processing';
}

const skillNameToId = new Map();
for (const s of rawSkills) {
  const skillId = parseInt(s.skill_id, 10);
  const cat = getSkillCategory(skillId, s.name);
  await c.query(`
    INSERT INTO skills (skill_id, name, category)
    VALUES ($1, $2, $3)
    ON CONFLICT (skill_id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category
  `, [skillId, s.name, cat]);
  skillNameToId.set(s.name.toLowerCase(), skillId);
}
await c.query(`SELECT setval('skills_skill_id_seq', (SELECT MAX(skill_id) FROM skills));`);
console.log(`   Ingested ${rawSkills.length} skills.`);

// 3. Job Roles
console.log('-> Ingesting job roles...');
const rawRoles = parseCSV('job_roles.csv');
for (const r of rawRoles) {
  const roleId = parseInt(r.role_id, 10);
  await c.query(`
    INSERT INTO job_roles (role_id, title)
    VALUES ($1, $2)
    ON CONFLICT (role_id) DO UPDATE SET title = EXCLUDED.title
  `, [roleId, r.title]);
}
await c.query(`SELECT setval('job_roles_role_id_seq', (SELECT MAX(role_id) FROM job_roles));`);
console.log(`   Ingested ${rawRoles.length} job roles.`);

// 4. Role Skills
console.log('-> Ingesting role skills...');
const rawRoleSkills = parseCSV('role_skills.csv');
await c.query(`DELETE FROM role_skills;`);
for (const rs of rawRoleSkills) {
  const roleId = parseInt(rs.role_id, 10);
  const skillId = parseInt(rs.skill_id, 10);
  const importance = parseInt(rs.importance, 10) || 3;
  await c.query(`
    INSERT INTO role_skills (role_id, skill_id, importance)
    VALUES ($1, $2, $3)
    ON CONFLICT (role_id, skill_id) DO UPDATE SET importance = EXCLUDED.importance
  `, [roleId, skillId, importance]);
}
console.log(`   Ingested ${rawRoleSkills.length} role-skill requirements.`);

// 5. Companies
console.log('-> Ingesting companies...');
const rawCompanies = parseCSV('companies.csv');
for (const comp of rawCompanies) {
  const compId = parseInt(comp.company_id, 10);
  const tier = parseInt(comp.company_tier, 10) || 2;
  const sector = comp.sector || (comp.name.includes('Goldman') ? 'Finance' : (comp.name.includes('Flipkart') || comp.name.includes('Walmart') ? 'E-Commerce' : 'Technology'));
  await c.query(`
    INSERT INTO companies (company_id, name, sector, tier)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (company_id) DO UPDATE SET name = EXCLUDED.name, sector = EXCLUDED.sector, tier = EXCLUDED.tier
  `, [compId, comp.name, sector, tier]);
}
await c.query(`SELECT setval('companies_company_id_seq', (SELECT MAX(company_id) FROM companies));`);
console.log(`   Ingested ${rawCompanies.length} companies.`);

// 6. Users & Faculty
console.log('-> Ingesting faculty & demo users...');
const facultyNames = [
  { name: 'Dr. Ramesh Kumar', desig: 'Professor & Chair', dept: 1 },
  { name: 'Dr. Ananya Sen', desig: 'Associate Professor', dept: 1 },
  { name: 'Dr. Vikram Rao', desig: 'Assistant Professor', dept: 1 },
  { name: 'Dr. Sunita Sharma', desig: 'Professor', dept: 1 },
  { name: 'Dr. Arvind Prasad', desig: 'Associate Professor', dept: 2 },
  { name: 'Dr. Meera Iyer', desig: 'Assistant Professor', dept: 2 },
  { name: 'Dr. Rajesh Nair', desig: 'Associate Professor', dept: 2 },
  { name: 'Dr. Kavitha Bhat', desig: 'Professor', dept: 3 }
];

for (let i = 0; i < facultyNames.length; i++) {
  const f = facultyNames[i];
  const email = `faculty${i + 1}@electiq.dev`;
  let u = (await c.query(`SELECT user_id FROM users WHERE email = $1`, [email])).rows[0];
  if (!u) {
    u = (await c.query(`
      INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'faculty') RETURNING user_id
    `, [email, pwHash])).rows[0];
  }
  await c.query(`
    INSERT INTO faculty (faculty_id, user_id, dept_id, name, designation)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (faculty_id) DO UPDATE SET name = EXCLUDED.name, designation = EXCLUDED.designation, dept_id = EXCLUDED.dept_id
  `, [i + 1, u.user_id, f.dept, f.name, f.desig]);
}
await c.query(`SELECT setval('faculty_faculty_id_seq', (SELECT MAX(faculty_id) FROM faculty));`);

// Admin user
let adminUser = (await c.query(`SELECT user_id FROM users WHERE email = 'admin@electiq.dev'`)).rows[0];
if (!adminUser) {
  await c.query(`INSERT INTO users (email, password_hash, role) VALUES ('admin@electiq.dev', $1, 'admin')`, [pwHash]);
}

// 7. Courses
console.log('-> Ingesting courses (Elective I, II, III, IV + Foundations)...');
const rawCourses = parseCSV('courses.csv');
for (const cr of rawCourses) {
  const courseId = parseInt(cr.course_id, 10);
  const isElec = cr.is_elective === '1' || cr.is_elective === 'true';
  let deptId = 1;
  if (['NICE', 'SPaSE'].includes(cr.vertical)) deptId = 2;
  if (cr.code === 'MATH_LINALG') deptId = 3;

  const facultyId = ((courseId - 1) % facultyNames.length) + 1;
  const level = cr.level === 'foundation' ? 'foundation' : (cr.level === 'advanced' ? 'advanced' : 'intermediate');
  const sem = parseInt(cr.semester, 10) || (isElec ? (cr.elective_slot === 'Elective I' ? 5 : (cr.elective_slot === 'Elective II' ? 6 : (cr.elective_slot === 'Elective III' ? 7 : 8))) : 3);
  const credits = 4;
  const outlook = parseFloat(cr.advisor_scope_outlook_1to5) || 3.0;

  await c.query(`
    INSERT INTO courses (
      course_id, code, title, dept_id, faculty_id, credits, semester, level,
      vertical, elective_slot, is_elective, advisor_scope_outlook, content_source
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (course_id) DO UPDATE SET
      code = EXCLUDED.code,
      title = EXCLUDED.title,
      dept_id = EXCLUDED.dept_id,
      faculty_id = EXCLUDED.faculty_id,
      credits = EXCLUDED.credits,
      semester = EXCLUDED.semester,
      level = EXCLUDED.level,
      vertical = EXCLUDED.vertical,
      elective_slot = EXCLUDED.elective_slot,
      is_elective = EXCLUDED.is_elective,
      advisor_scope_outlook = EXCLUDED.advisor_scope_outlook,
      content_source = EXCLUDED.content_source
  `, [
    courseId, cr.code, cr.title, deptId, facultyId, credits, sem, level,
    cr.vertical, cr.elective_slot, isElec, outlook, cr.content_source
  ]);
}
await c.query(`SELECT setval('courses_course_id_seq', (SELECT MAX(course_id) FROM courses));`);
console.log(`   Ingested ${rawCourses.length} courses.`);

// 8. Course Prerequisites
console.log('-> Ingesting course prerequisites...');
const rawPrereqs = parseCSV('course_prerequisites.csv');
await c.query(`DELETE FROM course_prerequisites;`);
for (const p of rawPrereqs) {
  const cId = parseInt(p.course_id, 10);
  const pId = parseInt(p.prereq_id, 10);
  await c.query(`
    INSERT INTO course_prerequisites (course_id, prereq_id)
    VALUES ($1, $2)
    ON CONFLICT (course_id, prereq_id) DO NOTHING
  `, [cId, pId]);
}
console.log(`   Ingested ${rawPrereqs.length} prerequisite chains.`);

// 9. Course Skills
console.log('-> Ingesting course skills...');
const rawCourseSkills = parseCSV('course_skills.csv');
await c.query(`DELETE FROM course_skills;`);
for (const cs of rawCourseSkills) {
  const cId = parseInt(cs.course_id, 10);
  const sId = parseInt(cs.skill_id, 10);
  const depth = parseInt(cs.depth, 10) || 1;
  await c.query(`
    INSERT INTO course_skills (course_id, skill_id, depth)
    VALUES ($1, $2, $3)
    ON CONFLICT (course_id, skill_id) DO UPDATE SET depth = EXCLUDED.depth
  `, [cId, sId, depth]);
}
console.log(`   Ingested ${rawCourseSkills.length} course-skill mappings.`);

// 10. Role Elective Paths
console.log('-> Ingesting role elective paths...');
const rawPaths = parseCSV('role_elective_paths.csv');
await c.query(`DELETE FROM role_elective_paths;`);
for (const rp of rawPaths) {
  const roleId = parseInt(rp.role_id, 10);
  const courseId = parseInt(rp.course_id, 10);
  const rank = parseInt(rp.rank, 10) || 1;
  const matchPct = parseInt(rp.skill_match_pct, 10) || 0;
  await c.query(`
    INSERT INTO role_elective_paths (role_id, rank, course_id, elective_slot, skill_match_pct)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (role_id, course_id) DO UPDATE SET
      rank = EXCLUDED.rank,
      elective_slot = EXCLUDED.elective_slot,
      skill_match_pct = EXCLUDED.skill_match_pct
  `, [roleId, rank, courseId, rp.elective_slot, matchPct]);
}
console.log(`   Ingested ${rawPaths.length} role elective paths.`);

// 11. Seniors & Students
console.log('-> Ingesting 60 seniors and students...');
const rawSeniors = parseCSV('seniors.csv');
for (const sn of rawSeniors) {
  const studentId = parseInt(sn.student_id, 10);
  const email = `senior${studentId}@electiq.dev`;
  let u = (await c.query(`SELECT user_id FROM users WHERE email = $1`, [email])).rows[0];
  if (!u) {
    u = (await c.query(`
      INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'senior') RETURNING user_id
    `, [email, pwHash])).rows[0];
  } else {
    await c.query(`UPDATE users SET role = 'senior' WHERE user_id = $1`, [u.user_id]);
  }

  const srn = `PES2021${String(studentId).padStart(4, '0')}`;
  const deptId = sn.department?.includes('ECE') ? 2 : 1;
  const name = `Senior ${sn.senior_code}`;

  await c.query(`
    INSERT INTO students (student_id, user_id, srn, name, dept_id, batch_year)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (student_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      srn = EXCLUDED.srn,
      dept_id = EXCLUDED.dept_id,
      batch_year = EXCLUDED.batch_year
  `, [studentId, u.user_id, srn, name, deptId, parseInt(sn.batch_year, 10) || 2025]);

  const headline = `${sn.role_placed} @ ${sn.company} | ${sn.specialization} Vertical`;
  await c.query(`
    INSERT INTO senior_profiles (
      student_id, senior_code, display_name, specialization, status, consent, headline,
      linkedin_url, github_url, advice_for_juniors, show_grades, show_placements,
      show_internships, show_projects, show_prep, show_publications, show_hackathons,
      profile_views, prep_views
    ) VALUES ($1, $2, $3, $4, 'published', true, $5, $6, $7, $8, true, true, true, true, true, true, true, $9, $10)
    ON CONFLICT (student_id) DO UPDATE SET
      senior_code = EXCLUDED.senior_code,
      display_name = EXCLUDED.display_name,
      specialization = EXCLUDED.specialization,
      headline = EXCLUDED.headline,
      advice_for_juniors = EXCLUDED.advice_for_juniors,
      profile_views = EXCLUDED.profile_views,
      prep_views = EXCLUDED.prep_views
  `, [
    studentId, sn.senior_code, `Senior ${sn.senior_code}`, sn.specialization || 'CS/AIML',
    headline, `https://linkedin.com/in/${sn.senior_code.toLowerCase()}`,
    `https://github.com/${sn.senior_code.toLowerCase()}`,
    'Focus on building 2 strong end-to-end projects that you can talk deeply about in interviews. Don’t just memorize DSA solutions; explain the engineering trade-offs.',
    Math.floor(15 + rng() * 45), Math.floor(8 + rng() * 30)
  ]);
}

// Ensure regular student accounts (student1 to student20)
for (let i = 1; i <= 20; i++) {
  const studentId = 60 + i;
  const email = `student${i}@electiq.dev`;
  let u = (await c.query(`SELECT user_id FROM users WHERE email = $1`, [email])).rows[0];
  if (!u) {
    u = (await c.query(`
      INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'student') RETURNING user_id
    `, [email, pwHash])).rows[0];
  }
  const srn = `PES2023${String(i).padStart(4, '0')}`;
  await c.query(`
    INSERT INTO students (student_id, user_id, srn, name, dept_id, batch_year)
    VALUES ($1, $2, $3, $4, 1, 2026)
    ON CONFLICT (student_id) DO NOTHING
  `, [studentId, u.user_id, srn, `Student ${i}`]);
}
await c.query(`SELECT setval('students_student_id_seq', (SELECT MAX(student_id) FROM students));`);

// 12. Placements
console.log('-> Ingesting placements...');
const rawPlacements = parseCSV('placements.csv');
await c.query(`DELETE FROM placements;`);
for (const pl of rawPlacements) {
  const plId = parseInt(pl.placement_id, 10);
  const stId = parseInt(pl.student_id, 10);
  const cId = parseInt(pl.company_id, 10);
  const rId = parseInt(pl.role_id, 10);
  const pkg = parseFloat(pl.package_lpa) || 12.0;
  const yr = parseInt(pl.year, 10) || 2025;
  const isVer = pl.verified === 'True' || pl.verified === 'true';
  await c.query(`
    INSERT INTO placements (placement_id, student_id, company_id, role_id, type, package_lpa, year, verified)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (placement_id) DO UPDATE SET
      package_lpa = EXCLUDED.package_lpa,
      verified = EXCLUDED.verified
  `, [plId, stId, cId, rId, pl.type || 'full_time', pkg, yr, isVer]);
}
await c.query(`SELECT setval('placements_placement_id_seq', (SELECT MAX(placement_id) FROM placements));`);
console.log(`   Ingested ${rawPlacements.length} placements.`);

// 13. Senior Electives (Enrollments with grades)
console.log('-> Ingesting senior electives and enrollments...');
const rawSeniorElecs = parseCSV('senior_electives.csv');
await c.query(`DELETE FROM feedback;`);
await c.query(`DELETE FROM enrollments;`);

const enrollmentMap = new Map(); // key: "student_id:course_id" -> enrollment_id
for (const se of rawSeniorElecs) {
  const enId = parseInt(se.enrollment_id, 10);
  const stId = parseInt(se.student_id, 10);
  const crId = parseInt(se.course_id, 10);
  const slot = se.slot;
  const gp = parseFloat(se.grade_points) || 8.0;
  const term = slot === 'Elective I' ? '2024-Fall' : (slot === 'Elective II' ? '2025-Spr' : (slot === 'Elective III' ? '2025-Fall' : '2026-Spr'));

  await c.query(`
    INSERT INTO enrollments (enrollment_id, student_id, course_id, term, status, grade_points, grade_posted_at)
    VALUES ($1, $2, $3, $4, 'completed', $5, now() - interval '60 days')
    ON CONFLICT (student_id, course_id) DO UPDATE SET grade_points = EXCLUDED.grade_points
  `, [enId, stId, crId, term, gp]);
  enrollmentMap.set(`${stId}:${crId}`, enId);
}

// Add foundation enrollments for seniors so prerequisite checks pass
let nextEnId = 1000;
for (let sId = 1; sId <= 60; sId++) {
  for (let coreId = 1; coreId <= 9; coreId++) {
    nextEnId++;
    await c.query(`
      INSERT INTO enrollments (enrollment_id, student_id, course_id, term, status, grade_points, grade_posted_at)
      VALUES ($1, $2, $3, '2023-Fall', 'completed', 8.5, now() - interval '300 days')
      ON CONFLICT (student_id, course_id) DO NOTHING
    `, [nextEnId, sId, coreId]);
  }
}

// Add some active enrollments for regular students (61-80) across courses
for (let stId = 61; stId <= 80; stId++) {
  const picks = [10 + ((stId * 3) % 40), 10 + ((stId * 7) % 40)];
  for (const cId of picks) {
    nextEnId++;
    await c.query(`
      INSERT INTO enrollments (enrollment_id, student_id, course_id, term, status, grade_points, grade_posted_at)
      VALUES ($1, $2, $3, '2026-Fall', 'enrolled', NULL, NULL)
      ON CONFLICT (student_id, course_id) DO NOTHING
    `, [nextEnId, stId, cId]);
  }
}
await c.query(`SELECT setval('enrollments_enrollment_id_seq', (SELECT MAX(enrollment_id) FROM enrollments));`);
console.log(`   Ingested senior electives and enrollments.`);

// 14. Course Feedback
console.log('-> Ingesting anonymous course feedback...');
const rawFeedback = parseCSV('course_feedback_anonymous.csv');
for (const fb of rawFeedback) {
  const fbId = parseInt(fb.feedback_id, 10);
  const crId = parseInt(fb.course_id, 10);
  const diff = parseInt(fb.difficulty, 10) || 3;
  const work = parseInt(fb.workload, 10) || 3;
  const use = parseInt(fb.usefulness, 10) || 4;

  // Find an enrollment for this course with posted grade
  const en = (await c.query(`
    SELECT e.enrollment_id FROM enrollments e
    LEFT JOIN feedback f ON f.enrollment_id = e.enrollment_id
    WHERE e.course_id = $1 AND e.grade_points IS NOT NULL AND f.feedback_id IS NULL LIMIT 1
  `, [crId])).rows[0];

  if (en) {
    await c.query(`
      INSERT INTO feedback (feedback_id, enrollment_id, difficulty, workload, usefulness, review_text)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (feedback_id) DO NOTHING
    `, [fbId, en.enrollment_id, diff, work, use, fb.review_text]);
  }
}
await c.query(`SELECT setval('feedback_feedback_id_seq', (SELECT COALESCE(MAX(feedback_id), 1) FROM feedback));`);
console.log(`   Ingested course feedback.`);

// 15. Projects & Placement Projects
console.log('-> Ingesting projects...');
const rawProjects = parseCSV('projects.csv');
const rawPlacProjects = parseCSV('placement_projects.csv');
const placProjMap = new Map();
for (const pp of rawPlacProjects) {
  placProjMap.set(parseInt(pp.project_id, 10), {
    placementId: parseInt(pp.placement_id, 10),
    helped: pp.how_it_helped
  });
}

await c.query(`DELETE FROM project_skills;`);
await c.query(`DELETE FROM projects;`);
for (const pr of rawProjects) {
  const prId = parseInt(pr.project_id, 10);
  const stId = parseInt(pr.student_id, 10);
  const crId = parseInt(pr.course_id, 10);
  const pp = placProjMap.get(prId);

  await c.query(`
    INSERT INTO projects (
      project_id, student_id, course_id, title, is_completed, brief, repo_link,
      helped_in_placement, placement_id, problem_statement, tech_stack, live_demo_link, outcome
    ) VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (project_id) DO UPDATE SET
      brief = EXCLUDED.brief,
      repo_link = EXCLUDED.repo_link,
      helped_in_placement = EXCLUDED.helped_in_placement,
      placement_id = EXCLUDED.placement_id,
      problem_statement = EXCLUDED.problem_statement,
      tech_stack = EXCLUDED.tech_stack,
      live_demo_link = EXCLUDED.live_demo_link,
      outcome = EXCLUDED.outcome
  `, [
    prId, stId, crId, pr.title, pr.brief, pr.repo_url,
    pp?.helped || 'Helped substantiate core concepts during technical interview rounds.',
    pp?.placementId || null,
    'Engineered an end-to-end prototype addressing high latency and algorithmic scaling under real-world constraints.',
    'Python, PyTorch, Docker, PostgreSQL, FastAPI',
    `https://demo.electiq.dev/projects/${prId}`,
    'Successfully built, benchmarked, and presented working implementation with documented test coverage.'
  ]);

  if (pr.skills) {
    const skillNames = pr.skills.split(';').map((s) => s.trim().toLowerCase());
    for (const sn of skillNames) {
      const sId = skillNameToId.get(sn);
      if (sId) {
        await c.query(`
          INSERT INTO project_skills (project_id, skill_id)
          VALUES ($1, $2)
          ON CONFLICT (project_id, skill_id) DO NOTHING
        `, [prId, sId]);
      }
    }
  }
}
await c.query(`SELECT setval('projects_project_id_seq', (SELECT MAX(project_id) FROM projects));`);
console.log(`   Ingested ${rawProjects.length} projects and their skill links.`);

// 16. Interview Prep
console.log('-> Ingesting interview prep...');
const rawPrep = parseCSV('interview_prep.csv');
await c.query(`DELETE FROM interview_prep;`);
for (const ip of rawPrep) {
  const prepId = parseInt(ip.prep_id, 10);
  const plId = parseInt(ip.placement_id, 10);
  const pl = (await c.query(`SELECT student_id FROM placements WHERE placement_id = $1`, [plId])).rows[0];
  const stId = pl?.student_id || prepId;
  const weeks = parseInt(ip.duration_weeks, 10) || 8;

  await c.query(`
    INSERT INTO interview_prep (
      prep_id, student_id, placement_id, strategy, weeks, resources, tips,
      dsa_strategy, languages_used, core_subjects_revised, mock_interviews,
      platforms_used, hr_prep, company_prep, mistakes_to_avoid
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (prep_id) DO NOTHING
  `, [
    prepId, stId, plId, ip.strategy, weeks, ip.resources_used, ip.tips,
    'Solved 250+ LeetCode Medium/Hard problems across Blind 75 and NeetCode 150. Focused on Dynamic Programming, Graphs (BFS/DFS), and Trees.',
    'Python, C++, SQL',
    'Operating Systems (Virtual memory, concurrency, semaphores), Database Management (Indexing, ACID, Normalization), Computer Networks (TCP 3-way handshake, DNS, HTTP/HTTPS).',
    'Conducted 6 peer mock interviews on Pramp and senior alumni sessions focusing on system design walkthroughs.',
    'LeetCode, NeetCode, InterviewBit, GeeksforGeeks, System Design Primer',
    'Practiced STAR method stories for behavioral rounds: leadership conflict, difficult bug triage, and project deadlines.',
    'Reviewed last 3 years of Glassdoor and campus recruitment questions for the specific hiring company.',
    'Do not jump straight into code without clarifying corner cases. Always communicate your thought process aloud to the interviewer.'
  ]);
}
await c.query(`SELECT setval('interview_prep_prep_id_seq', (SELECT COALESCE(MAX(prep_id), 1) FROM interview_prep));`);
console.log(`   Ingested ${rawPrep.length} interview prep records.`);

// 17. Interview Questions
console.log('-> Ingesting interview questions...');
const rawQuestions = parseCSV('interview_questions.csv');
await c.query(`DELETE FROM interview_questions;`);
for (const q of rawQuestions) {
  const qId = parseInt(q.question_id, 10);
  const cId = parseInt(q.course_id, 10);
  const plId = parseInt(q.placement_id, 10) || null;
  const diff = parseInt(q.difficulty, 10) || 3;
  await c.query(`
    INSERT INTO interview_questions (question_id, course_id, placement_id, question_text, round, difficulty, is_verified)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    ON CONFLICT (question_id) DO NOTHING
  `, [qId, cId, plId, q.question_text, q.round || 'technical', diff]);
}
await c.query(`SELECT setval('interview_questions_question_id_seq', (SELECT COALESCE(MAX(question_id), 1) FROM interview_questions));`);
console.log(`   Ingested ${rawQuestions.length} interview questions.`);

// 17b. Elective Exam Questions (ISA 1, ISA 2, ESA)
console.log('-> Ingesting ISA 1, ISA 2, and ESA questions for all 41 electives...');
await c.query(`DELETE FROM exam_questions;`);
let nextExamQId = 1;

for (let crId = 10; crId <= 50; crId++) {
  const cr = (await c.query('SELECT course_id, code, title, vertical FROM courses WHERE course_id = $1', [crId])).rows[0];
  if (!cr) continue;
  const cSkills = (await c.query(`
    SELECT s.name FROM course_skills cs JOIN skills s ON s.skill_id = cs.skill_id WHERE cs.course_id = $1 ORDER BY cs.depth DESC
  `, [crId])).rows.map(x => x.name);

  const s1 = cSkills[0] || 'Core Theory';
  const s2 = cSkills[1] || 'Applied Systems';
  const s3 = cSkills[2] || 'Optimization';

  const questions = [
    {
      type: 'ISA1',
      topic: `${s1} Fundamentals`,
      marks: 5,
      diff: 2,
      text: `Explain the foundational architectural principles of ${s1} in ${cr.title}. Provide a concrete system diagram or formulation.`,
      answer: `Key principles involve mathematical formulation, structural trade-offs, and algorithmic efficiency. The input representation is mapped through forward transformations to minimize loss or latency.`
    },
    {
      type: 'ISA1',
      topic: `${s1} vs ${s2}`,
      marks: 10,
      diff: 3,
      text: `Differentiate between ${s1} and ${s2} within the context of ${cr.title}. In what scenarios would an engineer choose one over the other?`,
      answer: `While ${s1} optimizes for sample efficiency and theoretical bounds, ${s2} addresses distributed scale and operational reliability. In production, ${s2} is preferred when data streaming constraints dominate.`
    },
    {
      type: 'ISA2',
      topic: `${s2} Pipeline Design`,
      marks: 8,
      diff: 3,
      text: `Design an end-to-end pipeline implementing ${s2} for a production workload. Discuss latency bottlenecks and failure recovery mechanisms.`,
      answer: `The design utilizes an asynchronous queue pattern with checkpointed states, automated retries, and distributed worker nodes to guarantee sub-100ms response times.`
    },
    {
      type: 'ISA2',
      topic: `${s3} Bottleneck Analysis`,
      marks: 10,
      diff: 4,
      text: `Analyze the primary memory and compute bottlenecks encountered when executing ${s3}. How does hardware acceleration mitigate these constraints?`,
      answer: `Memory bandwidth constraints (memory-bound operations) exceed compute limits during heavy matrix multiplications. Techniques like quantization (INT8/FP4), kernel fusion, and gradient checkpointing resolve these bottlenecks.`
    },
    {
      type: 'ESA',
      topic: `Comprehensive System Architecture`,
      marks: 12,
      diff: 4,
      text: `Propose an end-to-end industrial deployment architecture combining ${s1}, ${s2}, and ${s3} for ${cr.title}. Justify your selection of loss functions, evaluation metrics, and deployment infrastructure.`,
      answer: `The proposed architecture integrates a staged training and inference lifecycle: Stage 1 pre-processes domain telemetry; Stage 2 applies ${s1} for feature alignment; Stage 3 executes ${s2} under real-time constraints; Stage 4 continuously monitors drift and optimizes performance using ${s3}. Evaluation metrics combine task accuracy with 99th-percentile latency.`
    },
    {
      type: 'ESA',
      topic: `Edge Cases & Fault-Tolerant Scaling`,
      marks: 10,
      diff: 5,
      text: `In a mission-critical deployment of ${cr.title}, what failure modes and security vulnerabilities could arise? Outline an adversarial mitigation and monitoring protocol.`,
      answer: `Failure modes include concept drift, out-of-distribution inputs, and prompt or data poisoning. Mitigation protocol entails input sanitization, differential privacy bounds, canary deployments, and real-time anomaly alerting.`
    }
  ];

  for (const q of questions) {
    const contributorId = ((nextExamQId - 1) % 60) + 1;
    await c.query(`
      INSERT INTO exam_questions (
        exam_question_id, course_id, exam_type, question_text, marks, topic,
        difficulty, answer_text, year, semester, status, contributor_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 2025, 5, 'approved', $9)
      ON CONFLICT (exam_question_id) DO NOTHING
    `, [nextExamQId, crId, q.type, q.text, q.marks, q.topic, q.diff, q.answer, contributorId]);
    nextExamQId++;
  }
}
await c.query(`SELECT setval('exam_questions_exam_question_id_seq', (SELECT COALESCE(MAX(exam_question_id), 1) FROM exam_questions));`);
console.log(`   Ingested ${nextExamQId - 1} exam questions across ISA 1, ISA 2, and ESA.`);

// 18. Achievements & Publications
console.log('-> Ingesting achievements and publications...');
const rawAch = parseCSV('achievements.csv');
await c.query(`DELETE FROM achievements;`);
for (const a of rawAch) {
  const aId = parseInt(a.achievement_id, 10);
  const stId = parseInt(a.student_id, 10);
  let status = 'participated';
  if (a.result?.toLowerCase().includes('won')) status = 'won';
  else if (a.result?.toLowerCase().includes('final')) status = 'finalist';

  await c.query(`
    INSERT INTO achievements (achievement_id, student_id, event_name, role_status, position, year)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (achievement_id) DO NOTHING
  `, [aId, stId, `${a.title} (${a.organizer})`, status, a.result, parseInt(a.year, 10) || 2025]);
}
await c.query(`SELECT setval('achievements_achievement_id_seq', (SELECT COALESCE(MAX(achievement_id), 1) FROM achievements));`);

const rawPubs = parseCSV('publications.csv');
await c.query(`DELETE FROM publications;`);
for (const p of rawPubs) {
  const pId = parseInt(p.pub_id, 10);
  const stId = parseInt(p.student_id, 10);
  await c.query(`
    INSERT INTO publications (pub_id, student_id, title, venue, type, year, link)
    VALUES ($1, $2, $3, 'IEEE / arXiv / Conference Proceedings', $4, $5, 'https://arxiv.org/abs/example')
    ON CONFLICT (pub_id) DO NOTHING
  `, [pId, stId, p.title, p.type || 'preprint', parseInt(p.year, 10) || 2025]);
}
await c.query(`SELECT setval('publications_pub_id_seq', (SELECT COALESCE(MAX(pub_id), 1) FROM publications));`);

// 19. Role Demand (Market Data for all 27 roles)
console.log('-> Ingesting market demand data for all 27 roles...');
await c.query(`DELETE FROM role_demand;`);
const quarters = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1'];
let rdCount = 0;
for (let rId = 1; rId <= 27; rId++) {
  for (let qi = 0; qi < quarters.length; qi++) {
    const qStr = quarters[qi];
    const [yr, qtr] = qStr.split('-');
    const baseDemand = 7.0 + ((rId * 7 + qi * 3) % 25) / 10;
    const postings = 120 + ((rId * 23 + qi * 17) % 350);
    const salary = 16.5 + ((rId * 11 + qi * 5) % 220) / 10;
    const trend = baseDemand > 8.5 ? 'rising' : (baseDemand < 7.5 ? 'falling' : 'stable');

    await c.query(`
      INSERT INTO role_demand (
        role_id, year, quarter, postings_count, demand_score, avg_salary_lpa,
        trend_indicator, source_name, source_link
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Industry Tech Hiring Index', 'https://techhiring.report')
      ON CONFLICT (role_id, year, quarter) DO NOTHING
    `, [rId, parseInt(yr, 10), qtr, postings, baseDemand, salary, trend]);
    rdCount++;
  }
}
console.log(`   Ingested ${rdCount} role demand records.`);

// 20. Refresh Materialized Views (if any)
console.log('-> Refreshing database state...');
try {
  await c.query('REFRESH MATERIALIZED VIEW v_course_stats');
} catch (e) {
  // Not a materialized view or doesn't exist
}

console.log('Ingestion completed successfully!');
await c.end();
