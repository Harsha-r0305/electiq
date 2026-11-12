// Seed rich synthetic data for Senior Explorer:
// - Detailed CGPA, electives, extra prep, internships, projects, publications, hackathons, interview prep
// - Market trends data (role demand across quarters)
// Also seed detailed data for senior1 specifically.

import pg from 'pg';
import bcrypt from 'bcryptjs';

const c = new pg.Client({ connectionString: process.env.OWNER_DATABASE_URL });
await c.connect();

const q = async (sql, params = []) => {
  const r = await c.query(sql, params);
  return r.rows;
};

console.log('Seeding rich senior data...');

// Get all seniors with their student_id and senior_code
const seniors = await q(`
  SELECT sp.student_id, sp.senior_code, s.name, s.batch_year, s.dept_id,
         (SELECT MAX(p.package_lpa) FROM placements p WHERE p.student_id = sp.student_id AND p.type = 'full_time') AS pkg
  FROM senior_profiles sp
  JOIN students s ON s.student_id = sp.student_id
  ORDER BY sp.student_id
`);
console.log(`Found ${seniors.length} seniors.`);

// Get all companies and job_roles
const companies = await q('SELECT company_id, name, tier FROM companies');
const roles = await q('SELECT role_id, title FROM job_roles');
const courses = await q('SELECT course_id, title, is_elective, elective_slot, vertical FROM courses WHERE is_elective = true');

const companyMap = Object.fromEntries(companies.map(c => [c.name, c]));
const roleMap = Object.fromEntries(roles.map(r => [r.title, r]));

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
const rng = createSeededRandom(987654321);

function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}
function rnd(min, max) { return min + rng() * (max - min); }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }

// ----- Update senior profile headlines and advice -----
const HEADLINES = [
  'Software Engineer @ Google | Competitive Programming Enthusiast',
  'ML Engineer @ NVIDIA | Deep Learning & Computer Vision',
  'Backend Engineer @ Microsoft | Distributed Systems',
  'Data Engineer @ Amazon | Big Data & Real-time Pipelines',
  'Full Stack Developer @ Flipkart | React + Node.js',
  'Quantitative Analyst @ Goldman Sachs | Algorithms & Finance',
  'Cloud Solutions Architect @ AWS | Kubernetes & Serverless',
  'Security Engineer @ Cisco | Penetration Testing & Cryptography',
  'AI Research Intern → FTE @ DeepMind | NLP & Transformers',
  'Systems Engineer @ Intel | VLSI & Chip Design',
  'DevOps Engineer @ Infosys | CI/CD & Microservices',
  'Product Manager @ Swiggy | Tech + Product Strategy',
  'Robotics Engineer @ Bosch | ROS & Autonomous Systems',
  'Blockchain Developer @ Polygon | Web3 & Smart Contracts',
  'IoT Engineer @ Siemens | Edge Computing & Embedded Systems',
];

const ADVICE = [
  'Start DSA early. Do at least 300 problems on LeetCode before campus placements. Focus on patterns, not just solutions.',
  'Your CGPA matters for shortlisting. Maintain above 8.0 and do at least 2 internships before final year.',
  'Pick electives that build real skills, not just for easy grades. Senior Explorer helped me choose right.',
  'Mock interviews are crucial. I did 50+ mock interviews on Pramp and InterviewBit before the real ones.',
  'Build projects that solve real problems. Interviewers love when you can explain the "why" of your project.',
  'Network actively. LinkedIn cold messages work. I got my internship through a senior connection.',
  'Certifications help. AWS, GCP, or Azure certifications open doors especially for cloud roles.',
  'Focus on communication skills as much as technical skills. Many students fail HR rounds due to poor articulation.',
  'Read research papers in your domain. Even understanding 2-3 papers per month builds depth.',
  'Contribute to open source. Even small PRs on popular repos make your profile stand out.',
];

const INTERVIEW_STRATEGIES = [
  'I followed the "4-month plan": Month 1 - DSA basics, Month 2 - Advanced DS + DP, Month 3 - System Design, Month 4 - Mock interviews and company-specific prep.',
  'Focused entirely on FAANG preparation: NeetCode 150, System Design Primer, and 50 behavioral questions from Amazon Leadership Principles.',
  'Three-pronged approach: coding contests on Codeforces (for speed), LeetCode mediums (for interviews), and 1 system design problem daily.',
  'Company-specific prep: studied past interview questions from Glassdoor and InterviewBit for each company I applied to.',
  'Resume-driven preparation: built 3 strong projects first, then prepared to explain every line of code in those projects.',
];

const DSA_STRATEGIES = [
  'Started with Striver A-Z DSA sheet. Completed all 450 problems over 3 months. Focused on understanding patterns.',
  'Used NeetCode roadmap. Went topic by topic: Arrays → Binary Search → Linked Lists → Trees → Graphs → DP.',
  'Solved 100 easy problems first to build confidence, then moved to mediums. Never attempted hards until comfortable with mediums.',
  'Participated in weekly LeetCode contests. Rating above 1800 got me direct OA shortlists from some companies.',
  'Focused on the top 25 patterns: sliding window, two pointers, monotonic stack, BFS/DFS, etc. Each pattern has 10 problems.',
];

const PLATFORMS = [
  'LeetCode', 'Codeforces', 'HackerRank', 'CodeChef', 'GeeksForGeeks', 'InterviewBit', 'Pramp', 'AlgoExpert'
];
const CERT_PLATFORMS = [
  'Coursera', 'edX', 'Udemy', 'AWS Training', 'Google Cloud Skills', 'Microsoft Learn', 'DataCamp', 'fast.ai'
];
const CERT_COURSES = [
  'Deep Learning Specialization (Andrew Ng)',
  'AWS Solutions Architect Associate',
  'Google Cloud Professional Data Engineer',
  'Full Stack Web Development Bootcamp',
  'Machine Learning with Python',
  'Kubernetes for Developers',
  'Blockchain Development on Ethereum',
  'Natural Language Processing Specialization',
  'Computer Vision with OpenCV',
  'Data Structures and Algorithms in Python',
];

const HACKATHON_EVENTS = [
  { name: 'Smart India Hackathon', organizer: 'Ministry of Education', role_status: 'won', position: '1st Place' },
  { name: 'IEEE Xtreme Programming', organizer: 'IEEE', role_status: 'won', position: 'Top 100 Globally' },
  { name: 'HackMIT', organizer: 'MIT', role_status: 'participated', position: 'Participant' },
  { name: 'PESU Hackathon', organizer: 'PES University', role_status: 'won', position: '2nd Place' },
  { name: 'Google HashCode', organizer: 'Google', role_status: 'won', position: 'Top 500 Globally' },
  { name: 'Flipkart GRiD', organizer: 'Flipkart', role_status: 'participated', position: 'Finalist' },
  { name: 'Microsoft Imagine Cup', organizer: 'Microsoft', role_status: 'won', position: 'National Finalist' },
  { name: 'ACM ICPC', organizer: 'ACM', role_status: 'participated', position: 'Regionalist' },
  { name: 'Solve for Tomorrow', organizer: 'Samsung', role_status: 'won', position: 'State Winner' },
  { name: 'Myntra HackerRamp', organizer: 'Myntra', role_status: 'participated', position: 'Top 10' },
];

const PUBLICATIONS = [
  { title: 'Efficient Graph Neural Networks for Link Prediction in Social Networks', venue: 'IEEE ICML 2025', type: 'conference', topic: 'Graph Neural Networks' },
  { title: 'Federated Learning for Privacy-Preserving Healthcare Analytics', venue: 'ACM CCS 2025', type: 'conference', topic: 'Federated Learning' },
  { title: 'Real-time Anomaly Detection in IoT Sensor Networks', venue: 'IEEE IoTJ', type: 'journal', topic: 'IoT & Anomaly Detection' },
  { title: 'Quantum-Classical Hybrid Algorithms for Optimization Problems', venue: 'arXiv preprint', type: 'preprint', topic: 'Quantum Computing' },
  { title: 'Explainable AI for Credit Risk Assessment in Microfinance', venue: 'AAAI 2025 Workshop', type: 'workshop', topic: 'Explainable AI' },
  { title: 'Secure Multi-Party Computation for Collaborative ML', venue: 'IEEE S&P 2025', type: 'conference', topic: 'Privacy-Preserving ML' },
  { title: 'Lightweight Deep Learning for Edge Inference on Microcontrollers', venue: 'ACM SenSys', type: 'conference', topic: 'Edge Computing' },
  { title: 'Automated Curriculum Learning for Reinforcement Learning Agents', venue: 'NeurIPS 2025 Workshop', type: 'workshop', topic: 'Reinforcement Learning' },
];

const PROJECT_TEMPLATES = [
  { title: 'Traffic Prediction System using LSTM', brief: 'Built a time-series prediction model to forecast city traffic density using LSTM networks trained on 2 years of Bengaluru traffic data. Achieved 92% accuracy with 15-minute forecasts.', tech_stack: 'Python, TensorFlow, Kafka, Grafana', outcome: 'Deployed as a REST API serving 500 requests/day during internship' },
  { title: 'P2P File Sharing with BitTorrent Protocol', brief: 'Implemented a BitTorrent-compatible peer-to-peer file sharing system from scratch. Includes tracker server, peer discovery, and piece-level verification.', tech_stack: 'Go, gRPC, SHA-256, TCP/UDP', outcome: 'Successfully transferred 10GB files across 20 peers in lab tests' },
  { title: 'Smart Attendance System using Face Recognition', brief: 'College attendance automation using real-time face detection and recognition. Used FaceNet embeddings with MTCNN for detection, deployed on Raspberry Pi 4.', tech_stack: 'Python, OpenCV, FaceNet, Flask, SQLite, Raspberry Pi', outcome: 'Deployed in 3 labs, 95% detection accuracy' },
  { title: 'Decentralized Voting Application', brief: 'Ethereum-based voting dApp with zero-knowledge proof voter verification. Smart contracts ensure tamper-proof vote counting with full auditability.', tech_stack: 'Solidity, Hardhat, React, ethers.js, zk-SNARKs', outcome: 'Successfully ran student council elections for 3000 students' },
  { title: 'Real-time Stock Trading Simulator', brief: 'Paper trading platform with algorithmic trading bot support. Features real market data via WebSocket, portfolio analytics, and backtesting engine.', tech_stack: 'Python, FastAPI, React, Redis, PostgreSQL, Alpaca API', outcome: 'Simulated 10,000 trades with accurate P&L tracking' },
  { title: 'Medical Image Segmentation for Brain Tumors', brief: 'U-Net based segmentation model for MRI brain tumor delineation. Achieved 0.89 Dice coefficient on BraTS 2024 dataset using attention gates.', tech_stack: 'Python, PyTorch, MONAI, nibabel, SimpleITK', outcome: 'Published as conference paper; achieved top-20 on BraTS leaderboard' },
  { title: 'Kubernetes Cluster Auto-scaler', brief: 'Custom Horizontal Pod Autoscaler for ML inference workloads based on GPU utilization and request queue depth rather than CPU/memory.', tech_stack: 'Go, Kubernetes API, Prometheus, NVIDIA DCGM', outcome: '40% cost reduction on cloud GPU instances at startup internship' },
  { title: 'Sign Language Recognition System', brief: 'Real-time Indian Sign Language recognition using MediaPipe hand landmarks + LSTM classifier. Supports 60 ISL gestures with 88% accuracy.', tech_stack: 'Python, MediaPipe, TensorFlow, OpenCV, Tkinter', outcome: 'Demonstrated at Smart India Hackathon, won 2nd place' },
];

const RESOURCES = [
  'Cracking the Coding Interview (Gayle McDowell)',
  'Introduction to Algorithms (CLRS)',
  'Designing Data-Intensive Applications (Kleppmann)',
  'Clean Code (Robert Martin)',
  'The Algorithm Design Manual (Skiena)',
  'Deep Learning (Goodfellow, Bengio, Courville)',
  'System Design Interview Vol. 1 & 2 (Alex Xu)',
  'Competitive Programmer\'s Handbook',
];

// ---- Seed rich data for each senior ----
let totalExtraPrep = 0, totalHackathons = 0, totalPubs = 0, totalProjects = 0, totalInterviewPrep = 0;

for (let i = 0; i < seniors.length; i++) {
  const sr = seniors[i];
  const sid = sr.student_id;

  // Update headline and advice
  await q(`UPDATE senior_profiles SET headline = $2, advice_for_juniors = $3 WHERE student_id = $1`, [
    sid, HEADLINES[i % HEADLINES.length], ADVICE[i % ADVICE.length]
  ]);

  // 1. Extra preparation (certifications, online courses)
  const numPrep = rndInt(1, 4);
  for (let j = 0; j < numPrep; j++) {
    const course = pick(CERT_COURSES);
    const platform = pick(CERT_PLATFORMS);
    const relCourse = courses.length > 0 ? pick(courses) : null;
    const targetCourseId = relCourse?.course_id || (courses[0]?.course_id);
    if (!targetCourseId) continue;
    await q(`
      INSERT INTO extra_activities (student_id, course_id, type, platform, hours_spent, title, certificate_obtained)
      VALUES ($1, $2, 'online_course', $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [sid, targetCourseId, platform, rndInt(20, 120), course, rng() > 0.4]);
    totalExtraPrep++;
  }

  // Add coding practice
  const codePlatform = pick(PLATFORMS);
  const defaultCourseId = courses[0]?.course_id;
  if (defaultCourseId) {
  await q(`
    INSERT INTO extra_activities (student_id, course_id, type, platform, hours_spent, title, certificate_obtained)
    VALUES ($1, $2, 'coding_practice', $3, $4, $5, false)
    ON CONFLICT DO NOTHING
  `, [sid, defaultCourseId, codePlatform, rndInt(50, 300), `${codePlatform} - ${rndInt(100, 500)} problems solved`]);
  }
  totalExtraPrep++;

  // 2. Hackathons / achievements
  if (rng() > 0.3) {
    const hack = pick(HACKATHON_EVENTS);
    const existing = await q('SELECT achievement_id FROM achievements WHERE student_id = $1 AND event_name = $2', [sid, hack.name]);
    if (existing.length === 0) {
      await q(`
        INSERT INTO achievements (student_id, event_name, role_status, position, organizer, project_presented, year)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [sid, hack.name, hack.role_status, hack.position, hack.organizer,
          pick(PROJECT_TEMPLATES).title, rndInt(sr.batch_year - 1, sr.batch_year)]);
      totalHackathons++;
    }
  }

  // 3. Publications (for ~25% of seniors)
  if (rng() > 0.75) {
    const pub = pick(PUBLICATIONS);
    const existing = await q('SELECT pub_id FROM publications WHERE student_id = $1 AND title = $2', [sid, pub.title]);
    if (existing.length === 0) {
      await q(`
        INSERT INTO publications (student_id, title, venue, type, year, status, topic)
        VALUES ($1, $2, $3, $4, $5, 'published', $6)
      `, [sid, pub.title, pub.venue, pub.type, rndInt(sr.batch_year - 1, sr.batch_year), pub.topic]);
      totalPubs++;
    }
  }

  // 4. Projects (ensure at least 1 project per senior)
  const existingProjects = await q('SELECT project_id FROM projects WHERE student_id = $1', [sid]);
  if (existingProjects.length === 0) {
    const proj = pick(PROJECT_TEMPLATES);
    const relCourse = courses.length > 0 ? pick(courses) : null;
    await q(`
      INSERT INTO projects (student_id, course_id, title, brief, problem_statement, tech_stack, outcome, is_completed, helped_in_placement)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
    `, [sid, relCourse?.course_id || null, proj.title, proj.brief,
        `Problem: ${proj.brief.split('.')[0]}`, proj.tech_stack, proj.outcome]);
    totalProjects++;
  }

  // 5. Interview Prep
  const existingPrep = await q('SELECT prep_id FROM interview_prep WHERE student_id = $1', [sid]);
  if (existingPrep.length === 0) {
    const strategy = pick(INTERVIEW_STRATEGIES);
    const dsaStrategy = pick(DSA_STRATEGIES);
    const platform1 = pick(PLATFORMS);
    const platform2 = pick(PLATFORMS.filter(p => p !== platform1));
    const resource1 = pick(RESOURCES);
    const resource2 = pick(RESOURCES.filter(r => r !== resource1));
    await q(`
      INSERT INTO interview_prep (student_id, strategy, weeks, resources, tips, dsa_strategy, 
                                   languages_used, core_subjects_revised, mock_interviews, 
                                   platforms_used, hr_prep, company_prep, mistakes_to_avoid)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      sid, strategy, rndInt(8, 24),
      `${resource1}, ${resource2}`,
      ADVICE[rndInt(0, ADVICE.length - 1)],
      dsaStrategy,
      pick(['Python, C++', 'Java, Python', 'C++, Java', 'Python', 'Java, Go']),
      pick(['DBMS, OS, CN, OOP', 'OS, DBMS, Compiler Design', 'CN, OS, OOP', 'DBMS, OS, TOC']),
      rndInt(10, 50),
      `${platform1}, ${platform2}`,
      'Practiced STAR format answers for all behavioral questions. Prepared 20 stories from university projects and internships.',
      `Studied the company\'s engineering blog. Practiced ${pick(['3', '5', '8', '10'])} company-specific problems daily for 2 weeks before the interview.`,
      'Don\'t neglect soft skills. Many candidates fail HR rounds. Practice explaining your projects to non-technical people.',
    ]);
    totalInterviewPrep++;
  }

  // 6. Add internship placements for some seniors if they don't have one
  const existingInternship = await q("SELECT placement_id FROM placements WHERE student_id = $1 AND type = 'internship'", [sid]);
  if (existingInternship.length === 0 && rng() > 0.4) {
    const company = pick(companies);
    const role = pick(roles);
    await q(`
      INSERT INTO placements (student_id, company_id, role_id, type, package_lpa, year, 
                               stipend_monthly, duration_months, location, tech_stack, 
                               work_description, ppo_received)
      VALUES ($1, $2, $3, 'internship', NULL, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING
    `, [
      sid, company.company_id, role.role_id,
      rndInt(sr.batch_year - 1, sr.batch_year),
      rndInt(20000, 60000),
      rndInt(2, 6),
      pick(['Bengaluru', 'Hyderabad', 'Mumbai', 'Delhi', 'Remote']),
      pick(['Python, Django, PostgreSQL', 'Java, Spring Boot, Kafka', 'React, Node.js, MongoDB', 'Go, Kubernetes, GCP', 'C++, CUDA, TensorRT']),
      `Worked on ${pick(['backend microservices', 'frontend features', 'ML model optimization', 'DevOps automation', 'data pipeline development'])} for the ${pick(['core product', 'enterprise', 'consumer', 'platform'])} team.`,
      rng() > 0.6,
    ]);
  }
}

console.log(`Extra prep records added: ${totalExtraPrep}`);
console.log(`Hackathon records added: ${totalHackathons}`);
console.log(`Publication records added: ${totalPubs}`);
console.log(`Project records added: ${totalProjects}`);
console.log(`Interview prep records added: ${totalInterviewPrep}`);

// ======= SPECIAL: Enrich senior1 with detailed data =======
console.log('\nEnriching senior1 (S-056AA0) with detailed data...');
const s1 = seniors[0];

// Update senior1's profile
await q(`
  UPDATE senior_profiles 
  SET headline = $2,
      specialization = $3,
      advice_for_juniors = $4,
      linkedin_url = $5,
      github_url = $6
  WHERE student_id = $1
`, [
  s1.student_id,
  'Software Engineer @ Google | Competitive Programmer | Graph AI Researcher',
  'Artificial Intelligence & Machine Learning',
  'Focus on fundamentals. I spent 6 months doing nothing but DSA and system design. Got 3 FAANG offers. The key is depth over breadth—understand why algorithms work, not just how to code them. Also, your elective choices matter. I chose ML and Deep Learning electives which directly helped in Google interviews.',
  `https://linkedin.com/in/senior-${s1.senior_code.toLowerCase()}`,
  `https://github.com/senior-${s1.senior_code.toLowerCase()}`,
]);

// Get senior1's exact CGPA from enrollments
const s1cgpa = await q(`
  SELECT ROUND(AVG(grade_points)::numeric, 2) AS cgpa, COUNT(*) AS courses
  FROM enrollments 
  WHERE student_id = $1 AND grade_points IS NOT NULL
`, [s1.student_id]);
console.log(`Senior1 CGPA: ${s1cgpa[0].cgpa} (from ${s1cgpa[0].courses} courses)`);

// Update senior1's student name
await q(`UPDATE students SET name = $2 WHERE student_id = $1`, [s1.student_id, 'Aarav Sharma']);

// Additional extra prep for senior1
const s1preps = [
  ['online_course', 'Coursera', 60, 'Deep Learning Specialization (Andrew Ng) - 5 Courses', true],
  ['online_course', 'MIT OpenCourseWare', 40, '6.006 Introduction to Algorithms', false],
  ['coding_practice', 'LeetCode', 280, 'LeetCode Premium - 350 problems solved, contest rating 2050+', false],
  ['online_course', 'Google', 30, 'Google Machine Learning Crash Course', true],
  ['coding_practice', 'Codeforces', 150, 'Codeforces - Expert rating (1600+)', false],
];

for (const [type, platform, hours, title, cert] of s1preps) {
  await q(`
    INSERT INTO extra_activities (student_id, course_id, type, platform, hours_spent, title, certificate_obtained)
    VALUES ($1, NULL, $2, $3, $4, $5, $6)
    ON CONFLICT DO NOTHING
  `, [s1.student_id, type, platform, hours, title, cert]);
}
console.log('Added extra prep for senior1');

// Update senior1's interview prep
await q(`
  UPDATE interview_prep SET
    strategy = $2, weeks = $3, resources = $4, tips = $5, dsa_strategy = $6,
    languages_used = $7, core_subjects_revised = $8, mock_interviews = $9,
    platforms_used = $10, hr_prep = $11, company_prep = $12, mistakes_to_avoid = $13
  WHERE student_id = $1
`, [
  s1.student_id,
  'I followed a strict 20-week plan. Weeks 1-6: DSA fundamentals. Weeks 7-12: Advanced DS (Graphs, DP, Tries). Weeks 13-16: System Design (designed 15 systems). Weeks 17-20: Mock interviews daily + company-specific prep.',
  20,
  'Cracking the Coding Interview, Designing Data-Intensive Applications, System Design Interview Vol. 1 & 2, NeetCode 150 (all problems twice)',
  'Never miss a day. Even 30 minutes is better than zero. I solved at least 2 problems every single day for 5 months. Build systems daily—think about how WhatsApp, Uber, YouTube would be designed.',
  'Completed Striver A-Z DSA sheet (450 problems). Then did NeetCode 150 twice. Participated in 30 LeetCode weekly contests to build speed. Focus on patterns: sliding window, two pointers, monotonic stack, BFS/DFS, DP are the most important.',
  'Python (interviews), C++ (competitive programming)',
  'OS: process scheduling, memory management, deadlocks. DBMS: transactions, ACID, indexing, SQL optimization. CN: TCP/IP, HTTP, load balancing. OOP: SOLID principles, design patterns.',
  45,
  'LeetCode Premium, Codeforces, NeetCode.io, Pramp (10 mock interviews), Interviewing.io (5 sessions)',
  'Prepared 25 STAR format stories from projects and internship. Practiced with a friend who was also preparing—gave each other brutal feedback.',
  'Spent 2 weeks specifically on Google: studied "Thinking in Systems", Google Engineering blog, practiced on past Google questions. Prepared for every round format: coding + system design + behavioral + Googleyness.',
  'Don\'t skip system design. Many candidates over-index on coding and neglect system design which carries equal weight at Google. Also—don\'t LIE on your resume. Interviewers deep-dive every bullet point.',
]);
console.log('Updated senior1 interview prep');

// Update senior1 hackathon
await q(`
  INSERT INTO achievements (student_id, event_name, role_status, position, organizer, project_presented, year)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT DO NOTHING
`, [
  s1.student_id,
  'Smart India Hackathon 2024',
  'won',
  '1st Place - Software Edition',
  'Ministry of Education, Govt. of India',
  'AI-powered Traffic Congestion Prediction System',
  2024,
]);

await q(`
  INSERT INTO achievements (student_id, event_name, role_status, position, organizer, project_presented, year)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT DO NOTHING
`, [
  s1.student_id,
  'Google HashCode 2024',
  'won',
  'Top 300 Globally (Team of 4)',
  'Google',
  'Optimization Challenge',
  2024,
]);
console.log('Added hackathons for senior1');

// Update senior1 publication
await q(`
  INSERT INTO publications (student_id, title, venue, type, year, status, topic, abstract)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  ON CONFLICT DO NOTHING
`, [
  s1.student_id,
  'Scalable Graph Neural Networks for Real-time Recommendation Systems',
  'ACM SIGKDD 2025',
  'conference',
  2025,
  'published',
  'Graph Neural Networks, Recommendation Systems',
  'We propose ScaleGNN, a novel framework for real-time graph neural network inference on dynamic graphs. Our approach achieves 3.2x speedup over baseline GNN systems while maintaining 98.5% recommendation accuracy on the Amazon product graph dataset.',
]);
console.log('Added publication for senior1');

// Add senior1 project
const existP = await q('SELECT project_id FROM projects WHERE student_id = $1 AND title LIKE $2', [
  s1.student_id, '%Traffic%'
]);
if (existP.length === 0) {
  await q(`
    INSERT INTO projects (student_id, course_id, title, brief, problem_statement, tech_stack, 
                           repo_link, outcome, is_completed, helped_in_placement)
    VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, true, true)
  `, [
    s1.student_id,
    'AI Traffic Prediction System (Smart India Hackathon Winner)',
    'Built an LSTM-based traffic forecasting system for Bengaluru using 3 years of GPS and sensor data. The model predicts congestion 30 minutes ahead with 94% accuracy across 50 road segments.',
    'Bengaluru suffers from severe traffic congestion costing ₹35,000 crore annually. Existing systems only react to congestion, not predict it.',
    'Python, TensorFlow, LSTM, Kafka, Redis, Grafana, FastAPI, React',
    'https://github.com/senior-code/traffic-prediction',
    'Won 1st place at Smart India Hackathon 2024. System deployed as a pilot by BBMP for 3 months. 94% prediction accuracy on test data.',
  ]);
}

// Ensure at least 4 seniors in the Below 5 LPA tier
const below5Packages = [4.5, 4.2, 3.8, 4.8];
for (let b = 0; b < below5Packages.length; b++) {
  const targetSid = seniors[seniors.length - 1 - b].student_id;
  await q(`
    UPDATE placements
    SET package_lpa = $1
    WHERE student_id = $2 AND type = 'full_time'
  `, [below5Packages[b], targetSid]);
}
console.log('Ensured seniors in Below 5 LPA tier');
// Update market trends with richer quarterly data
const jobRoles = await q('SELECT role_id, title FROM job_roles ORDER BY role_id');

// Define market data for key roles
const MARKET_DATA = {
  'Software Development Engineer': { base_postings: 45000, demand: 9.2, salary: 22, trend: 'rising' },
  'Machine Learning Engineer': { base_postings: 32000, demand: 9.5, salary: 28, trend: 'rising' },
  'Data Scientist': { base_postings: 28000, demand: 8.8, salary: 24, trend: 'rising' },
  'DevOps / Site Reliability Engineer': { base_postings: 22000, demand: 8.5, salary: 20, trend: 'rising' },
  'Backend Engineer': { base_postings: 38000, demand: 9.0, salary: 21, trend: 'stable' },
  'Frontend Engineer': { base_postings: 25000, demand: 7.8, salary: 18, trend: 'stable' },
  'Cloud Solutions Architect': { base_postings: 15000, demand: 8.6, salary: 32, trend: 'rising' },
  'Cybersecurity Engineer': { base_postings: 18000, demand: 8.9, salary: 26, trend: 'rising' },
  'Data Engineer': { base_postings: 20000, demand: 8.3, salary: 22, trend: 'rising' },
  'Embedded Systems Engineer': { base_postings: 12000, demand: 7.2, salary: 15, trend: 'stable' },
  'Robotics Engineer': { base_postings: 8000, demand: 7.8, salary: 20, trend: 'rising' },
  'Blockchain Developer': { base_postings: 6000, demand: 7.0, salary: 22, trend: 'stable' },
  'Computer Vision Engineer': { base_postings: 14000, demand: 8.5, salary: 26, trend: 'rising' },
  'NLP / AI Research Scientist': { base_postings: 10000, demand: 9.0, salary: 35, trend: 'rising' },
  'Full Stack Developer': { base_postings: 30000, demand: 8.2, salary: 18, trend: 'stable' },
  'Mobile App Developer': { base_postings: 18000, demand: 7.5, salary: 16, trend: 'stable' },
  'Product Manager (Tech)': { base_postings: 12000, demand: 7.9, salary: 28, trend: 'rising' },
  'Quantitative Analyst': { base_postings: 5000, demand: 7.5, salary: 42, trend: 'stable' },
  'IoT Systems Engineer': { base_postings: 9000, demand: 7.3, salary: 16, trend: 'rising' },
  'Chip Design Engineer': { base_postings: 7000, demand: 7.6, salary: 18, trend: 'rising' },
};

const QUARTERS = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'];

// Delete existing role_demand data and re-seed
await q('DELETE FROM role_demand');

const sources = [
  { name: 'LinkedIn Economic Graph', link: 'https://linkedin.com/jobs' },
  { name: 'NASSCOM Report 2026', link: 'https://nasscom.in' },
  { name: 'Naukri Hiring Outlook', link: 'https://naukri.com/trends' },
];

for (const role of jobRoles) {
  const data = MARKET_DATA[role.title] || {
    base_postings: rndInt(5000, 20000),
    demand: rnd(6.5, 8.5),
    salary: rndInt(15, 28),
    trend: pick(['rising', 'stable', 'falling']),
  };

  for (let qi = 0; qi < QUARTERS.length; qi++) {
    const quarter = QUARTERS[qi];
    const growthFactor = data.trend === 'rising' ? 1 + qi * 0.05 : data.trend === 'falling' ? 1 - qi * 0.03 : 1 + (rng() - 0.5) * 0.05;
    const postings = Math.round(data.base_postings * growthFactor * (0.9 + rng() * 0.2));
    const demandScore = Math.min(10, Math.max(5, data.demand + (qi * 0.1 * (data.trend === 'rising' ? 1 : data.trend === 'falling' ? -1 : 0)) + (rng() - 0.5) * 0.3));
    const salaryLpa = data.salary + qi * (data.trend === 'rising' ? 0.3 : 0) + (rng() - 0.5) * 1;
    const src = pick(sources);
    // Use the last quarter's trend_indicator
    const trend = qi === QUARTERS.length - 1 ? data.trend : (rng() > 0.7 ? pick(['rising', 'stable']) : 'stable');

    await q(`
      INSERT INTO role_demand (role_id, year, quarter, postings_count, demand_score, avg_salary_lpa, trend_indicator, source_name, source_link)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      role.role_id,
      parseInt(quarter.split('-')[0]),
      quarter,
      postings,
      parseFloat(demandScore.toFixed(1)),
      parseFloat(salaryLpa.toFixed(1)),
      trend,
      src.name,
      src.link,
    ]);
  }
}
console.log(`Market trends seeded for ${jobRoles.length} roles across ${QUARTERS.length} quarters`);

// Update system settings for market data freshness
await q(`
  INSERT INTO system_settings (key, value, updated_at) VALUES ('market_data_quarter', '2026-Q3', NOW())
  ON CONFLICT (key) DO UPDATE SET value = '2026-Q3', updated_at = NOW()
`);
await q(`
  INSERT INTO system_settings (key, value, updated_at) VALUES ('market_data_source', 'LinkedIn Economic Graph & NASSCOM', NOW())
  ON CONFLICT (key) DO UPDATE SET value = 'LinkedIn Economic Graph & NASSCOM', updated_at = NOW()
`);
console.log('Updated market data freshness labels');

const finalCounts = await q(`
  SELECT
    (SELECT COUNT(*) FROM extra_activities) extra_activities,
    (SELECT COUNT(*) FROM achievements) hackathons,
    (SELECT COUNT(*) FROM publications) publications,
    (SELECT COUNT(*) FROM projects) projects,
    (SELECT COUNT(*) FROM interview_prep) interview_prep,
    (SELECT COUNT(*) FROM role_demand) role_demand
`);
console.log('\nFinal counts:', finalCounts[0]);
console.log('\nRich synthetic data seeding complete!');
await c.end();
