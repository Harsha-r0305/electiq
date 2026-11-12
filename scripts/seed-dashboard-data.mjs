// Seeds dashboard data: senior profiles, publications, hackathons, interview prep,
// role demands, returned items, designer config.
import pg from 'pg';

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
const rng = createSeededRandom(1048576);

console.log('Seeding role dashboard data...');

// 1. Get all students with role = 'senior'
const seniors = (await c.query(`
  SELECT s.student_id, s.srn, s.name, s.batch_year, s.dept_id
  FROM students s
  JOIN users u ON u.user_id = s.user_id
  WHERE u.role = 'senior'
  ORDER BY s.student_id
`)).rows;

console.log(`Found ${seniors.length} seniors.`);

// 2. Ensure each senior has a senior_profile
for (let i = 0; i < seniors.length; i++) {
  const s = seniors[i];
  const code = `SNR-${s.batch_year}-${String(i + 1).padStart(3, '0')}`;
  const headlines = [
    'Incoming Software Engineer @ Google | Graph AI Enthusiast',
    'ML Systems Engineer @ NVIDIA | Passionate about distributed computing',
    'Full Stack Engineer @ Swiggy | Open source contributor',
    'Backend Engineer @ Razorpay | High-concurrency payment pipelines',
    'Cloud Solutions Engineer @ Microsoft | Kubernetes & Distributed DBs',
    'Quantitative Analyst @ Goldman Sachs | Algorithms & Financial Modeling',
    'Data Platform Engineer @ Flipkart | Real-time stream processing',
    'Systems Software Engineer @ Cisco | Networking & Kernel optimizations'
  ];
  const headline = headlines[i % headlines.length];

  await c.query(`
    INSERT INTO senior_profiles (
      student_id, senior_code, status, consent, headline, linkedin_url,
      profile_views, prep_views
    ) VALUES ($1, $2, 'published', true, $3, $4, $5, $6)
    ON CONFLICT (student_id) DO UPDATE
    SET senior_code = EXCLUDED.senior_code,
        headline = EXCLUDED.headline,
        linkedin_url = EXCLUDED.linkedin_url,
        profile_views = EXCLUDED.profile_views,
        prep_views = EXCLUDED.prep_views
  `, [
    s.student_id,
    code,
    headline,
    `https://linkedin.com/in/${code.toLowerCase()}`,
    Math.floor(25 + rng() * 80),
    Math.floor(10 + rng() * 40)
  ]);
}

// 3. Make sure we have placements covering all 5 tiers:
// 50+ LPA, 35-50 LPA, 20-35 LPA, 12-20 LPA, 5-12 LPA.
const google = (await c.query("SELECT company_id FROM companies WHERE name = 'Google'")).rows[0]?.company_id ?? 1;
const nvidia = (await c.query("SELECT company_id FROM companies WHERE name = 'NVIDIA'")).rows[0]?.company_id ?? 2;
const msft = (await c.query("SELECT company_id FROM companies WHERE name = 'Microsoft'")).rows[0]?.company_id ?? 3;
const swiggy = (await c.query("SELECT company_id FROM companies WHERE name = 'Swiggy'")).rows[0]?.company_id ?? 8;
const zoho = (await c.query("SELECT company_id FROM companies WHERE name = 'Zoho'")).rows[0]?.company_id ?? 11;
const roles = (await c.query("SELECT role_id, title FROM job_roles")).rows;
const sdeRole = roles.find(r => r.title.toLowerCase().includes('software') || r.title.toLowerCase().includes('engineer'))?.role_id ?? roles[0]?.role_id ?? 1;
const mlRole = roles.find(r => r.title.toLowerCase().includes('machine') || r.title.toLowerCase().includes('learning'))?.role_id ?? roles[0]?.role_id ?? 1;

if (seniors.length >= 2) {
  // Give senior 1 (or 2) a 52 LPA placement if not present
  await c.query(`
    INSERT INTO placements (student_id, company_id, role_id, type, package_lpa, year, verified)
    VALUES ($1, $2, $3, 'full_time', 52.00, 2025, true)
    ON CONFLICT (student_id, company_id, type, year) DO UPDATE SET package_lpa = 52.00, verified = true
  `, [seniors[0].student_id, google, sdeRole]);
}
if (seniors.length >= 3) {
  // Give senior 2 a 38.5 LPA placement
  await c.query(`
    INSERT INTO placements (student_id, company_id, role_id, type, package_lpa, year, verified)
    VALUES ($1, $2, $3, 'full_time', 38.50, 2025, true)
    ON CONFLICT (student_id, company_id, type, year) DO UPDATE SET package_lpa = 38.50, verified = true
  `, [seniors[1].student_id, nvidia, mlRole]);
}
if (seniors.length >= 4) {
  // Give senior 3 a 28.0 LPA placement
  await c.query(`
    INSERT INTO placements (student_id, company_id, role_id, type, package_lpa, year, verified)
    VALUES ($1, $2, $3, 'full_time', 28.00, 2025, true)
    ON CONFLICT (student_id, company_id, type, year) DO UPDATE SET package_lpa = 28.00, verified = true
  `, [seniors[2].student_id, swiggy, sdeRole]);
}
if (seniors.length >= 5) {
  // Give senior 4 a 16.5 LPA placement (fills the 12-20 LPA tier!)
  await c.query(`
    INSERT INTO placements (student_id, company_id, role_id, type, package_lpa, year, verified)
    VALUES ($1, $2, $3, 'full_time', 16.50, 2025, true)
    ON CONFLICT (student_id, company_id, type, year) DO UPDATE SET package_lpa = 16.50, verified = true
  `, [seniors[3].student_id, zoho, sdeRole]);
}

// 4. Update project details with briefs, repo links, and how they helped
const projects = (await c.query('SELECT project_id, title FROM projects')).rows;
for (const p of projects) {
  await c.query(`
    UPDATE projects
    SET brief = $1,
        repo_link = $2,
        helped_in_placement = $3,
        is_completed = true
    WHERE project_id = $4
  `, [
    `Built an end-to-end production pipeline for ${p.title} with high availability, unit tests, and CI/CD integration.`,
    `https://github.com/electiq-alumni/${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    'The interviewer spent 20 minutes deep-diving into system architecture tradeoffs and concurrency bottlenecks.',
    p.project_id
  ]);
}

// 5. Seed Publications
await c.query('DELETE FROM publications');
if (seniors.length > 0) {
  const samplePubs = [
    { sid: seniors[0].student_id, title: 'Scalable Graph Indexing for Complex Query Answering', venue: 'IEEE ICDE', type: 'Conference', year: 2024, link: 'https://doi.org/10.1109/icde.2024' },
    { sid: seniors[0].student_id, title: 'Adaptive Pruning in Multi-Hop Recommendation Networks', venue: 'ACM SIGKDD Workshop', type: 'Workshop', year: 2024, link: 'https://doi.org/10.1145/kdd.2024' },
    { sid: seniors[1]?.student_id ?? seniors[0].student_id, title: 'Low-Latency Inference Engines for Distributed Transformers', venue: 'NeurIPS MLSys Workshop', type: 'Conference', year: 2024, link: 'https://arxiv.org/abs/2401.0001' },
    { sid: seniors[2]?.student_id ?? seniors[0].student_id, title: 'Fault-Tolerant Distributed Consensus in Edge Clusters', venue: 'IEEE Transactions on Cloud Computing', type: 'Journal', year: 2023, link: 'https://doi.org/10.1109/tcc.2023' }
  ];
  for (const pub of samplePubs) {
    await c.query(`
      INSERT INTO publications (student_id, title, venue, type, year, link)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [pub.sid, pub.title, pub.venue, pub.type, pub.year, pub.link]);
  }
}

// 6. Seed Achievements / Hackathons
await c.query('DELETE FROM achievements');
if (seniors.length > 0) {
  const sampleAchievements = [
    { sid: seniors[0].student_id, event_name: 'Smart India Hackathon 2024', role_status: 'won', position: '1st Place (National Winner)', year: 2024 },
    { sid: seniors[0].student_id, event_name: 'HackMIT 2023', role_status: 'finalist', position: 'Top 10 Global Finalist', year: 2023 },
    { sid: seniors[1]?.student_id ?? seniors[0].student_id, event_name: 'Kaggle Grandmaster Challenge', role_status: 'won', position: 'Rank 1 Gold Medalist', year: 2024 },
    { sid: seniors[2]?.student_id ?? seniors[0].student_id, event_name: 'ETHIndia Web3 Hackathon', role_status: 'won', position: 'Best Track Project', year: 2023 },
    { sid: seniors[3]?.student_id ?? seniors[0].student_id, event_name: 'ACM-ICPC Asia Regionals', role_status: 'finalist', position: 'Rank 24', year: 2023 }
  ];
  for (const a of sampleAchievements) {
    await c.query(`
      INSERT INTO achievements (student_id, event_name, role_status, position, year)
      VALUES ($1, $2, $3, $4, $5)
    `, [a.sid, a.event_name, a.role_status, a.position, a.year]);
  }
}

// 7. Seed Interview Preparation
await c.query('DELETE FROM interview_prep');
for (let i = 0; i < Math.min(seniors.length, 6); i++) {
  const sid = seniors[i].student_id;
  const p = (await c.query('SELECT placement_id FROM placements WHERE student_id = $1 LIMIT 1', [sid])).rows[0];
  await c.query(`
    INSERT INTO interview_prep (student_id, placement_id, strategy, weeks, resources, tips)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    sid,
    p?.placement_id ?? null,
    'Daily LeetCode medium/hard practice, followed by mock interviews focusing on OS concurrency and system design fundamentals.',
    12,
    'NeetCode 150, Designing Data-Intensive Applications (Kleppmann), ElectIQ course feedback and review bank.',
    'Do not jump into coding before clarifying requirements and time/space constraints with the interviewer. Think aloud!'
  ]);
}

// 8. Seed Role Demand Data (Market and Industry Trends)
await c.query('DELETE FROM role_demand');
const allRoles = (await c.query('SELECT role_id, title FROM job_roles')).rows;
const quarters = ['2026-Q1', '2026-Q2', '2026-Q3'];

for (const r of allRoles) {
  let basePostings = 1200 + Math.floor(rng() * 2500);
  let baseDemand = 7.0 + rng() * 2.5;
  let baseSalary = 16.0 + rng() * 12.0;

  for (let qIdx = 0; qIdx < quarters.length; qIdx++) {
    const qStr = quarters[qIdx];
    const postings = Math.round(basePostings * (1 + qIdx * 0.12));
    const demand = Math.min(10.0, Number((baseDemand + qIdx * 0.3).toFixed(1)));
    const salary = Number((baseSalary + qIdx * 0.8).toFixed(2));
    const trend = qIdx === 2 ? (demand > 8.5 ? 'rising' : 'stable') : 'rising';

    await c.query(`
      INSERT INTO role_demand (
        role_id, year, quarter, postings_count, demand_score,
        avg_salary_lpa, trend_indicator, source_name, source_link
      ) VALUES ($1, 2026, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (role_id, year, quarter) DO NOTHING
    `, [
      r.role_id,
      qStr,
      postings,
      demand,
      salary,
      trend,
      'LinkedIn Economic Graph & NASSCOM Campus Hiring Pulse',
      'https://economicgraph.linkedin.com'
    ]);
  }
}

// 9. Seed pending notices & prompts for Senior 1 (matches 2.1 specifications)
if (seniors.length > 0) {
  const sid = seniors[0].student_id;
  await c.query('DELETE FROM returned_items WHERE student_id = $1', [sid]);
  await c.query(`
    INSERT INTO returned_items (student_id, content_type, content_id, admin_reason, status)
    VALUES 
      ($1, 'project', 1, 'Please add a concrete brief detailing the architecture and your individual contribution.', 'open'),
      ($1, 'placement', 1, 'Please verify the final accepted base package breakdown.', 'open')
  `, [sid]);

  // Seed sample moderation report
  const adminUser = (await c.query("SELECT user_id FROM users WHERE role = 'admin' LIMIT 1")).rows[0]?.user_id;
  const studentUser = (await c.query("SELECT user_id FROM users WHERE role = 'student' LIMIT 1")).rows[0]?.user_id;
  if (adminUser && studentUser) {
    await c.query('DELETE FROM moderation_reports');
    await c.query(`
      INSERT INTO moderation_reports (reporter_id, content_type, content_id, reason, status)
      VALUES 
        ($1, 'feedback', 1, 'Outdated review referring to syllabus from 2021 before semester restructuring.', 'pending'),
        ($1, 'interview_question', 2, 'Question duplicate of standard two-sum LeetCode prompt.', 'pending')
    `, [studentUser]);
  }
}

console.log('Role dashboard data seeded successfully!');
await c.end();

