// Seeds realistic sample data (deterministic) from data/*.csv. Usage: npm run db:seed
// Demo logins (password for ALL seeded users: Password@123)
//   admin@electiq.dev | faculty1@electiq.dev | senior1@electiq.dev | student1@electiq.dev
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const DEMO_PASSWORD = 'Password@123';
const c = new pg.Client({ connectionString: process.env.OWNER_DATABASE_URL });
await c.connect();

// ---------- deterministic randomness ----------
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(2026);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const q = async (sql, p = []) => (await c.query(sql, p)).rows;

// ---------- CSV Ingestion & Validation ----------
function loadCSV(filename) {
  const filePath = path.join(process.cwd(), 'data', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[CSV Missing] Required data file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  function parseCSVLine(line) {
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

  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let idx = 1; idx < lines.length; idx++) {
    const values = parseCSVLine(lines[idx]);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    rows.push({ _row: idx + 1, ...row });
  }
  return rows;
}

console.log('Loading and validating CSV files from data/...');

// 1. Departments
const rawDepts = loadCSV('departments.csv');
const DEPTS = [];
for (const r of rawDepts) {
  if (!r.name || r.name.length < 2) {
    throw new Error(`[CSV Validation Error] departments.csv:${r._row} - department name must be at least 2 chars.`);
  }
  DEPTS.push(r.name);
}

// 2. Skills
const rawSkills = loadCSV('skills.csv');
const SKILLS_MAP = {};
const ALL_SKILLS_SET = new Set();
for (const r of rawSkills) {
  if (!r.name || !r.category) {
    throw new Error(`[CSV Validation Error] skills.csv:${r._row} - name and category are required.`);
  }
  if (!SKILLS_MAP[r.category]) SKILLS_MAP[r.category] = [];
  SKILLS_MAP[r.category].push(r.name);
  ALL_SKILLS_SET.add(r.name);
}

// 3. Courses
const rawCourses = loadCSV('courses.csv');
const COURSES_MAP = {};
for (const r of rawCourses) {
  if (!r.code || r.code.length < 3) throw new Error(`[CSV Validation Error] courses.csv:${r._row} - invalid course code: ${r.code}`);
  if (!r.title) throw new Error(`[CSV Validation Error] courses.csv:${r._row} - missing title for course: ${r.code}`);
  if (!DEPTS.includes(r.department)) throw new Error(`[CSV Validation Error] courses.csv:${r._row} - unknown department "${r.department}" for course: ${r.code}`);
  const credits = parseInt(r.credits, 10);
  if (isNaN(credits) || credits < 1 || credits > 10) throw new Error(`[CSV Validation Error] courses.csv:${r._row} - credits must be 1-10 for: ${r.code}`);
  const semester = parseInt(r.semester, 10);
  if (isNaN(semester) || semester < 1 || semester > 8) throw new Error(`[CSV Validation Error] courses.csv:${r._row} - semester must be 1-8 for: ${r.code}`);
  if (!['foundation', 'intermediate', 'advanced'].includes(r.level)) throw new Error(`[CSV Validation Error] courses.csv:${r._row} - level must be foundation/intermediate/advanced for: ${r.code}`);

  COURSES_MAP[r.code] = {
    code: r.code,
    title: r.title,
    department: r.department,
    credits,
    semester,
    level: r.level,
    facultyIdx: parseInt(r.faculty_idx, 10) || 0,
    trueDifficulty: parseFloat(r.true_difficulty) || 3.0,
    gradeBonus: parseFloat(r.grade_bonus) || 0.0,
    prereqs: [],
    skills: [],
  };
}

// 4. Prerequisites
const rawPrereqs = loadCSV('prerequisites.csv');
for (const r of rawPrereqs) {
  if (!COURSES_MAP[r.course_code]) throw new Error(`[CSV Validation Error] prerequisites.csv:${r._row} - course_code not found in courses.csv: ${r.course_code}`);
  if (!COURSES_MAP[r.prereq_code]) throw new Error(`[CSV Validation Error] prerequisites.csv:${r._row} - prereq_code not found in courses.csv: ${r.prereq_code}`);
  if (r.course_code === r.prereq_code) throw new Error(`[CSV Validation Error] prerequisites.csv:${r._row} - self-referencing prerequisite forbidden: ${r.course_code}`);
  COURSES_MAP[r.course_code].prereqs.push(r.prereq_code);
}

// 5. Course Skills
const rawCourseSkills = loadCSV('course_skills.csv');
for (const r of rawCourseSkills) {
  if (!COURSES_MAP[r.course_code]) throw new Error(`[CSV Validation Error] course_skills.csv:${r._row} - course_code not found: ${r.course_code}`);
  if (!ALL_SKILLS_SET.has(r.skill_name)) throw new Error(`[CSV Validation Error] course_skills.csv:${r._row} - skill_name not found: ${r.skill_name}`);
  const depth = parseInt(r.depth, 10);
  if (isNaN(depth) || depth < 1 || depth > 5) throw new Error(`[CSV Validation Error] course_skills.csv:${r._row} - depth must be 1-5 for ${r.course_code}`);
  COURSES_MAP[r.course_code].skills.push({ name: r.skill_name, depth });
}

// 6. Roles
const rawRoles = loadCSV('roles.csv');
const ROLES_SET = new Set();
for (const r of rawRoles) {
  if (!r.title) throw new Error(`[CSV Validation Error] roles.csv:${r._row} - role title is required.`);
  ROLES_SET.add(r.title);
}

// 7. Role Skills
const rawRoleSkills = loadCSV('role_skills.csv');
const ROLES_MAP = {};
for (const title of ROLES_SET) ROLES_MAP[title] = [];
for (const r of rawRoleSkills) {
  if (!ROLES_SET.has(r.role_title)) throw new Error(`[CSV Validation Error] role_skills.csv:${r._row} - unknown role_title: ${r.role_title}`);
  if (!ALL_SKILLS_SET.has(r.skill_name)) throw new Error(`[CSV Validation Error] role_skills.csv:${r._row} - unknown skill_name: ${r.skill_name}`);
  const imp = parseInt(r.importance, 10);
  if (isNaN(imp) || imp < 1 || imp > 5) throw new Error(`[CSV Validation Error] role_skills.csv:${r._row} - importance must be 1-5`);
  ROLES_MAP[r.role_title].push({ name: r.skill_name, importance: imp });
}

// 8. Companies
const rawCompanies = loadCSV('companies.csv');
const COMPANIES = [];
for (const r of rawCompanies) {
  if (!r.name || !r.sector) throw new Error(`[CSV Validation Error] companies.csv:${r._row} - name and sector are required.`);
  const tier = parseInt(r.tier, 10);
  const ctc = parseFloat(r.ctc_lpa);
  if (isNaN(tier) || tier < 1 || tier > 5) throw new Error(`[CSV Validation Error] companies.csv:${r._row} - tier must be 1-5`);
  if (isNaN(ctc) || ctc <= 0) throw new Error(`[CSV Validation Error] companies.csv:${r._row} - ctc_lpa must be > 0`);
  COMPANIES.push([r.name, r.sector, tier, ctc]);
}

// 9. Interview Questions
const rawQuestions = loadCSV('interview_questions.csv');
const QUESTIONS = {};
for (const r of rawQuestions) {
  if (!COURSES_MAP[r.course_code]) throw new Error(`[CSV Validation Error] interview_questions.csv:${r._row} - unknown course_code: ${r.course_code}`);
  if (!r.question_text || r.question_text.length < 10) throw new Error(`[CSV Validation Error] interview_questions.csv:${r._row} - question_text must be >= 10 chars`);
  if (!QUESTIONS[r.course_code]) QUESTIONS[r.course_code] = [];
  QUESTIONS[r.course_code].push(r.question_text);
}

// 10. Exam Question Templates
const rawExamTemplates = loadCSV('exam_question_templates.csv');
const EXAM_TEMPLATES = [];
for (const r of rawExamTemplates) {
  if (!r.template || r.template.length < 10) throw new Error(`[CSV Validation Error] exam_question_templates.csv:${r._row} - invalid template`);
  const marks = parseInt(r.marks, 10) || 5;
  const diff = parseInt(r.difficulty, 10) || 3;
  EXAM_TEMPLATES.push({ template: r.template, marks, diff, topicPattern: r.topic_pattern || 'General' });
}

console.log(`✓ All 10 CSV catalogs validated: ${DEPTS.length} depts, ${rawCourses.length} courses, ${ALL_SKILLS_SET.size} skills, ${ROLES_SET.size} roles, ${COMPANIES.length} companies.`);

// ---------- insert reference data ----------
console.log('Seeding reference data...');
const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

const deptIdMap = {};
for (const d of DEPTS) {
  const row = (await q('INSERT INTO departments(name) VALUES ($1) RETURNING dept_id', [d]))[0];
  deptIdMap[d] = row.dept_id;
}

const mkUser = async (email, role) => (await q('INSERT INTO users(email,password_hash,role) VALUES ($1,$2,$3) RETURNING user_id', [email, hash, role]))[0].user_id;
await mkUser('admin@electiq.dev', 'admin');

const FACULTY = [
  ['Dr. Nagasundari S', 0], ['Dr. Kavitha R', 0], ['Dr. Prakash M', 0],
  ['Dr. Anitha K', 0], ['Dr. Suresh B', 0], ['Dr. Meera V', 1],
  ['Dr. Harish T', 2], ['Dr. Lakshmi N', 0]
];
const facId = [];
for (let i = 0; i < FACULTY.length; i++) {
  const uid = await mkUser(`faculty${i + 1}@electiq.dev`, 'faculty');
  const deptName = DEPTS[FACULTY[i][1]] || DEPTS[0];
  facId.push((await q('INSERT INTO faculty(user_id,dept_id,name,designation) VALUES ($1,$2,$3,$4) RETURNING faculty_id', [uid, deptIdMap[deptName], FACULTY[i][0], i < 3 ? 'Professor' : 'Associate Professor']))[0].faculty_id);
}

const skillId = {};
for (const [cat, names] of Object.entries(SKILLS_MAP)) {
  for (const n of names) {
    skillId[n] = (await q('INSERT INTO skills(name,category) VALUES ($1,$2) RETURNING skill_id', [n, cat]))[0].skill_id;
  }
}

const course = {}; // code -> {id, ...meta}
for (const cMeta of Object.values(COURSES_MAP)) {
  const fIdx = cMeta.facultyIdx % facId.length;
  const id = (await q('INSERT INTO courses(code,title,dept_id,faculty_id,credits,semester,level) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING course_id', [
    cMeta.code, cMeta.title, deptIdMap[cMeta.department], facId[fIdx], cMeta.credits, cMeta.semester, cMeta.level
  ]))[0].course_id;

  course[cMeta.code] = {
    id,
    title: cMeta.title,
    sem: cMeta.semester,
    level: cMeta.level,
    diff: cMeta.trueDifficulty,
    bonus: cMeta.gradeBonus,
    prereqs: cMeta.prereqs,
    skills: cMeta.skills.map((s) => s.name),
  };
}

// Insert prerequisites and skills
for (const cMeta of Object.values(COURSES_MAP)) {
  for (const p of cMeta.prereqs) {
    if (course[p]) {
      await q('INSERT INTO course_prerequisites(course_id,prereq_id) VALUES ($1,$2)', [course[cMeta.code].id, course[p].id]);
    }
  }
  for (const s of cMeta.skills) {
    if (skillId[s.name]) {
      await q('INSERT INTO course_skills(course_id,skill_id,depth) VALUES ($1,$2,$3)', [course[cMeta.code].id, skillId[s.name], s.depth]);
    }
  }
}

// Learning Resources
for (const [code, meta] of Object.entries(course)) {
  const rs = [
    ['video', `${meta.title}: NPTEL lecture series`, 'https://nptel.ac.in'],
    ['notes', `${meta.title}: lecture notes compiled by seniors`, null],
    ['practice', `Practice problem set for ${meta.title}`, null]
  ];
  if (rnd() < 0.7) rs.push(['book', `Recommended textbook for ${meta.title}`, null]);
  if (rnd() < 0.4) rs.push(['video', `${meta.title}: crash course on YouTube`, 'https://www.youtube.com']);
  for (const [t, ti, u] of rs) await q('INSERT INTO resources(course_id,type,title,url) VALUES ($1,$2,$3,$4)', [meta.id, t, ti, u]);
}

// Roles & Role Skills
const roleId = {};
for (const [title, skList] of Object.entries(ROLES_MAP)) {
  roleId[title] = (await q('INSERT INTO job_roles(title) VALUES ($1) RETURNING role_id', [title]))[0].role_id;
  for (const s of skList) {
    if (skillId[s.name]) {
      await q('INSERT INTO role_skills(role_id,skill_id,importance) VALUES ($1,$2,$3)', [roleId[title], skillId[s.name], s.importance]);
    }
  }
}

// Companies
const companyId = {};
for (const [n, sector] of COMPANIES) {
  companyId[n] = (await q('INSERT INTO companies(name,sector) VALUES ($1,$2) RETURNING company_id', [n, sector]))[0].company_id;
}

// Market demand
const hot = { MLOps: 9.4, 'LLM Engineering': 9.6, Kubernetes: 8.8, Docker: 8.6, 'Cloud Computing': 9.0, Python: 9.5, SQL: 9.0, 'System Design': 8.4, 'Machine Learning': 9.0, 'Deep Learning': 8.2, 'REST APIs': 8.5, 'Data Structures': 8.8, React: 8.0, 'Node.js': 7.8, Spark: 7.4, 'Big Data': 7.5, NLP: 8.0 };
for (const [n, id] of Object.entries(skillId)) {
  const base = hot[n] ?? clamp(4 + rnd() * 3, 3, 7);
  await q('INSERT INTO market_demand(skill_id,year,postings_count,demand_score) VALUES ($1,2025,$2,$3)', [id, Math.round(base * 310 + rnd() * 400), clamp(base - 0.4 - rnd() * 0.5, 1, 10).toFixed(1)]);
  await q('INSERT INTO market_demand(skill_id,year,postings_count,demand_score) VALUES ($1,2026,$2,$3)', [id, Math.round(base * 380 + rnd() * 500), clamp(base, 1, 10).toFixed(1)]);
}

// Faculty reviews
const COMMENTS = ['Core to the curriculum and strongly tied to current industry needs.', 'Good scope in research and industry; students should pair it with a project.', 'Relevant today, but the syllabus should add more applied case studies.', 'High future scope; the demand for this skill is growing year on year.'];
for (const [code, meta] of Object.entries(course)) {
  const fIdx = (COURSES_MAP[code]?.facultyIdx ?? 0) % facId.length;
  await q('INSERT INTO faculty_reviews(faculty_id,course_id,relevance,future_scope,comment) VALUES ($1,$2,$3,$4,$5)', [facId[fIdx], meta.id, 3 + Math.floor(rnd() * 3), 3 + Math.floor(rnd() * 3), pick(COMMENTS)]);
}

// ---------- students & synthetic generation ----------
console.log('Seeding students, enrollments and feedback (this takes a few seconds)...');
const TRACKS = {
  ai: ['UE24CS302', 'UE24CS303', 'UE24CS304', 'UE24CS305', 'UE24CS306', 'UE24CS307'].filter((c) => course[c]),
  sys: ['UE24CS309', 'UE24CS310', 'UE24CS312', 'UE24CS313', 'UE24CS314', 'UE24CS203'].filter((c) => course[c]),
  data: ['UE24CS308', 'UE24CS315', 'UE24CS311', 'UE24CS316', 'UE24CS317', 'UE24CS301'].filter((c) => course[c])
};
const FIRST = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Karthik', 'Ishita', 'Vihaan', 'Sneha', 'Arjun', 'Meghana', 'Nikhil', 'Pooja', 'Rahul', 'Kavya', 'Siddharth', 'Neha', 'Varun', 'Aditi', 'Harsha', 'Shreya', 'Tarun', 'Divya', 'Manoj', 'Riya', 'Akash', 'Lavanya', 'Sanjay', 'Bhavana', 'Pranav', 'Nandini'];
const LAST = ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Gowda', 'Patel', 'Rao', 'Menon', 'Kulkarni', 'Hegde', 'Bhat', 'Shetty', 'Naidu', 'Joshi', 'Pillai', 'Das'];
const COHORTS = [[2025, 30, 'senior'], [2026, 40, 'senior'], [2027, 25, 'student'], [2028, 15, 'student']];
const PROGRESS = { 2025: 8, 2026: 8, 2027: 6, 2028: 4 };
const termOf = (batch, sem) => `${batch - 4 + Math.floor((sem - 1) / 2)}-${sem % 2 ? 'ODD' : 'EVEN'}`;
const FB_OPEN = { low: ['Very manageable course.', 'Light workload and a relaxed exam.'], mid: ['Moderate difficulty if you keep up with the assignments.', 'Fair exams and steady weekly work.'], high: ['Tough course, expect to spend serious time on problem sets.', 'The exam is hard and the pace is fast.'] };
const FB_RES = ['The recorded lectures and lecture notes were enough to prepare.', 'Practice problems on the recommended platforms helped a lot.', 'Read the textbook chapters before the lectures; it makes class far easier.', 'Seniors\' notes and past papers were the most useful resources.'];
const FB_OUT = ['This topic came up in my interview, so revise it properly.', 'The project gave me something concrete to talk about in interviews.', 'Not asked directly in interviews, but the fundamentals help everywhere.', 'It helped me land my internship.', 'Pair it with regular practice and the assignments become easy.'];

const PLATFORMS = {
  Algorithms: [['practice', 'LeetCode'], ['practice', 'CodeChef'], ['practice', 'Codeforces']],
  'AI and ML': [['course', 'Coursera'], ['practice', 'Kaggle'], ['course', 'fast.ai']],
  Data: [['practice', 'HackerRank'], ['certification', 'Databricks Academy'], ['practice', 'StrataScratch']],
  Systems: [['certification', 'AWS Cloud Practitioner'], ['certification', 'Azure Fundamentals'], ['course', 'Linux Foundation']],
  Security: [['practice', 'TryHackMe'], ['practice', 'Hack The Box'], ['certification', 'CompTIA Security+']],
  Web: [['course', 'freeCodeCamp'], ['practice', 'Frontend Mentor'], ['course', 'The Odin Project']],
  Programming: [['practice', 'HackerRank'], ['course', 'NPTEL']],
  Engineering: [['certification', 'ISTQB Foundation'], ['course', 'Udemy']],
  Mathematics: [['course', 'MIT OpenCourseWare'], ['course', 'NPTEL']],
};

let studentNo = 0, seniorNo = 0, juniorNo = 0;
const seniors = [];
const questionBank = Object.fromEntries(Object.entries(QUESTIONS).map(([k, v]) => [k, [...v]]));
const firstDeptId = Object.values(deptIdMap)[0];

for (const [batch, count, role] of COHORTS) {
  for (let i = 0; i < count; i++) {
    studentNo++;
    const isSenior = role === 'senior';
    const n = isSenior ? ++seniorNo : ++juniorNo;
    const email = `${isSenior ? 'senior' : 'student'}${n}@electiq.dev`;
    const uid = await mkUser(email, role);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const srn = `PES${batch - 4}${String(studentNo).padStart(4, '0')}`;
    const sid = (await q('INSERT INTO students(user_id,srn,name,dept_id,batch_year) VALUES ($1,$2,$3,$4,$5) RETURNING student_id', [uid, srn, name, firstDeptId, batch]))[0].student_id;

    const ability = n === 1 && !isSenior ? 7.0 : clamp(7.4 + gauss() * 1.0, 5.2, 9.6);
    const track = n === 1 && !isSenior ? 'ai' : pick(Object.keys(TRACKS));
    const progress = n === 1 && !isSenior ? 5 : PROGRESS[batch];
    const done = new Map(); // code -> grade

    for (let sem = 1; sem <= progress; sem++) {
      const isCurrent = sem === progress;
      const term = termOf(batch, sem);
      const semCourses = Object.entries(course).filter(([, m]) => m.sem === sem);

      for (const [code, m] of semCourses) {
        if (n === 1 && !isSenior && sem === 5 && code !== 'UE24CS302') continue;
        if (m.level !== 'foundation' && !TRACKS[track].includes(code) && rnd() > 0.45) continue;
        const prereqsSatisfied = m.prereqs.every((p) => done.has(p) && done.get(p) >= 6);
        if (!prereqsSatisfied) continue;

        if (isCurrent && !isSenior) {
          await q("INSERT INTO enrollments(student_id,course_id,term,status) VALUES ($1,$2,$3,'enrolled')", [sid, m.id, term]);
          continue;
        }

        const grade = clamp(Math.round((ability + m.bonus + gauss() * 0.7) * 2) / 2, 4.0, 10.0);
        done.set(code, grade);
        const postedAt = `${batch - 4 + Math.floor(sem / 2)}-${sem % 2 ? '12' : '05'}-20 18:00:00+00`;
        const eid = (await q("INSERT INTO enrollments(student_id,course_id,term,status,grade_points,grade_posted_at) VALUES ($1,$2,$3,'completed',$4,$5) RETURNING enrollment_id", [sid, m.id, term, grade, postedAt]))[0].enrollment_id;

        if (isSenior && rnd() < 0.42) {
          const diff = clamp(Math.round(m.diff + (8.5 - grade) * 0.4 + gauss() * 0.4), 1, 5);
          const work = clamp(Math.round(diff * 0.8 + rnd() * 1.2), 1, 5);
          const use = clamp(Math.round(2 + grade * 0.3 + (m.level === 'advanced' ? 0.6 : 0) + gauss() * 0.4), 1, 5);
          const band = diff <= 2 ? 'low' : diff >= 4 ? 'high' : 'mid';
          const text = `${pick(FB_OPEN[band])} ${pick(FB_RES)} ${pick(FB_OUT)}`;
          await q('INSERT INTO feedback(enrollment_id,difficulty,workload,usefulness,review_text) VALUES ($1,$2,$3,$4,$5)', [eid, diff, work, use, text]);
        }

        if (isSenior && m.skills.length > 0 && rnd() < 0.35) {
          const cat = (await q('SELECT category FROM skills WHERE skill_id=$1', [skillId[m.skills[0]]]))[0]?.category;
          const [type, platform] = pick(PLATFORMS[cat] ?? PLATFORMS.Programming);
          await q('INSERT INTO extra_activities(student_id,course_id,type,platform,hours_spent) VALUES ($1,$2,$3,$4,$5)', [sid, m.id, type, platform, Math.round((20 + rnd() * 120) * 2) / 2]);
        }
      }
    }

    if (isSenior) {
      const grades = [...done.values()];
      const cgpa = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : 7.0;
      const mySkills = new Set([...done.keys()].flatMap((c) => course[c].skills));
      seniors.push({ sid, batch, cgpa, done, mySkills, n });
    }
  }
}

// ---------- placements ----------
console.log('Seeding placements and interview questions...');
const roleSkillsMap = {};
for (const [title, skList] of Object.entries(ROLES_MAP)) {
  roleSkillsMap[title] = skList.map((x) => [x.name, x.importance]);
}
const tierCompanies = (t) => COMPANIES.filter((x) => x[2] === t);

for (const s of seniors) {
  if (rnd() < 0.1) continue; // ~10% unplaced
  const adv = [...s.done.entries()].filter(([code, g]) => course[code].level === 'advanced' && g >= 8).length;
  const strength = s.cgpa + adv * 0.35 + gauss() * 0.5;
  const tier = strength >= 9.7 ? 1 : strength >= 9.0 ? 2 : strength >= 8.3 ? 3 : strength >= 7.4 ? 4 : 5;
  const overlap = (r) => roleSkillsMap[r].reduce((a, [n, w]) => a + (s.mySkills.has(n) ? w : 0), 0) + rnd() * 2;
  const role = Object.keys(ROLES_MAP).sort((a, b) => overlap(b) - overlap(a))[0];
  const comp = pick(tierCompanies(tier));
  const pkg = Math.round((comp[3] * (0.85 + rnd() * 0.3)) * 4) / 4;
  const pid = (await q("INSERT INTO placements(student_id,company_id,role_id,type,package_lpa,year) VALUES ($1,$2,$3,'full_time',$4,$5) RETURNING placement_id", [s.sid, companyId[comp[0]], roleId[role], pkg, s.batch]))[0].placement_id;

  if (rnd() < 0.7) {
    const ic = pick(tierCompanies(Math.min(5, tier + 1)));
    await q("INSERT INTO placements(student_id,company_id,role_id,type,package_lpa,year) VALUES ($1,$2,$3,'internship',$4,$5) ON CONFLICT DO NOTHING", [s.sid, companyId[ic[0]], roleId[role], Math.round((3 + rnd() * 6) * 2) / 2, s.batch - 1]);
  }

  // interview questions for courses this senior completed
  for (const [code] of shuffle([...s.done.entries()]).slice(0, 6)) {
    const pool = questionBank[code];
    if (pool && pool.length && rnd() < 0.6) {
      const text = pool[Math.floor(rnd() * pool.length)];
      await q('INSERT INTO interview_questions(course_id,placement_id,question_text,round,difficulty) VALUES ($1,$2,$3,$4,$5)', [course[code].id, pid, text, pick(['technical', 'technical', 'coding', 'hr-technical']), 2 + Math.floor(rnd() * 3)]);
    }
  }
}

// Ensure every question in the question bank appears at least once
for (const [code, pool] of Object.entries(questionBank)) {
  for (const text of pool) {
    const exists = (await q('SELECT 1 FROM interview_questions WHERE question_text=$1', [text])).length;
    if (!exists && course[code]) {
      await q('INSERT INTO interview_questions(course_id,question_text,round,difficulty) VALUES ($1,$2,$3,$4)', [course[code].id, text, 'technical', 3]);
    }
  }
}

// ---------- exam questions (ISA1, ISA2, ESA) ----------
console.log('Seeding exam questions from templates...');
const enrs = await q(
  `SELECT e.enrollment_id, e.course_id, e.status, c.code, c.title
     FROM enrollments e
     JOIN courses c ON c.course_id = e.course_id`
);

const courseSkillNames = {};
for (const [code, meta] of Object.entries(course)) {
  courseSkillNames[meta.id] = meta.skills;
}

for (const e of enrs) {
  const skills = courseSkillNames[e.course_id] || ['Core Principles', 'Applied Systems'];
  const sA = skills[0] || 'Core Theory';
  const sB = skills[1] || skills[0] || 'System Design';

  let examTypes = [];
  if (e.status === 'completed' && rnd() < 0.40) {
    examTypes = rnd() < 0.5 ? ['ISA1'] : rnd() < 0.8 ? ['ISA1', 'ISA2'] : ['ISA1', 'ESA'];
  } else if (e.status === 'enrolled' && rnd() < 0.55) {
    examTypes = ['ISA1'];
  }

  for (const et of examTypes) {
    for (let i = 0; i < 2; i++) {
      const tmplObj = EXAM_TEMPLATES[(i * 3 + Math.floor(rnd() * EXAM_TEMPLATES.length)) % EXAM_TEMPLATES.length];
      const s1 = i === 0 ? sA : sB;
      const s2 = i === 0 ? sB : sA;
      const qText = tmplObj.template
        .replace(/{skill1}/g, s1)
        .replace(/{skill2}/g, s2)
        .replace(/{title}/g, e.title);
      const marks = tmplObj.marks || pick([2, 5, 5, 8, 10]);
      const diff = tmplObj.diff || (2 + Math.floor(rnd() * 4));
      const topic = i === 0 ? sA : sB;

      await q(
        `INSERT INTO exam_questions(enrollment_id, course_id, exam_type, question_text, marks, topic, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [e.enrollment_id, e.course_id, et, qText, marks, topic, diff]
      );
    }
  }
}

// ---------- demo helpers: ungraded enrollments for senior1 (grade-gating demo) ----------
const s1 = seniors.find((x) => x.n === 1);
if (s1) {
  const untaken = Object.entries(course).filter(([code]) => !s1.done.has(code) && course[code].level !== 'foundation').slice(0, 2);
  for (const [code] of untaken) {
    await q("INSERT INTO enrollments(student_id,course_id,term,status) VALUES ($1,$2,'2026-ODD','enrolled')", [s1.sid, course[code].id]);
  }
}

const counts = await q("SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM courses) courses, (SELECT count(*) FROM enrollments) enrollments, (SELECT count(*) FROM feedback) feedback, (SELECT count(*) FROM placements) placements, (SELECT count(*) FROM interview_questions) questions, (SELECT count(*) FROM exam_questions) exam_questions");
console.log('Seed complete:', counts[0]);
console.log('Demo logins (password Password@123): admin@electiq.dev, faculty1@electiq.dev, senior1@electiq.dev, student1@electiq.dev');
await c.end();
