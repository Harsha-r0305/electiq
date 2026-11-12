import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.OWNER_DATABASE_URL });

async function enrichElectives() {
  console.log('--- Starting Comprehensive Elective Enrichment ---');

  // 1. Fetch core courses
  const coreRes = await pool.query("SELECT course_id, code, title FROM courses WHERE is_elective = false");
  const coreMap = {};
  coreRes.rows.forEach(c => { coreMap[c.code] = c.course_id; });
  console.log('Core course map:', coreMap);

  // 2. Fetch all 41 electives
  const electivesRes = await pool.query("SELECT course_id, code, title, vertical, elective_slot FROM courses WHERE is_elective = true ORDER BY course_id");
  const electives = electivesRes.rows;
  console.log(`Found ${electives.length} electives.`);

  // 3. Fetch faculty
  const facultyRes = await pool.query("SELECT faculty_id, name, dept_id FROM faculty");
  const facultyList = facultyRes.rows;

  // 4. Clean and reseed prerequisites
  console.log('Seeding prerequisites for all electives...');
  for (const el of electives) {
    const t = el.title.toLowerCase();
    const prereqCodes = [];

    // Realistic foundation prereqs based on domain
    if (t.includes('ml') || t.includes('machine learning') || t.includes('deep learning') || t.includes('ai') || t.includes('analytics') || t.includes('reinforcement')) {
      prereqCodes.push('ML_CORE', 'PROG', 'MATH_LINALG');
      if (t.includes('big data') || t.includes('systems') || t.includes('agentops')) {
        prereqCodes.push('DBMS');
      }
    } else if (t.includes('crypto') || t.includes('security') || t.includes('forensics') || t.includes('threat') || t.includes('blockchain') || t.includes('block chain')) {
      prereqCodes.push('CYBER_BASICS', 'COMPNET', 'DSA');
    } else if (t.includes('robot') || t.includes('autonomous') || t.includes('vehicle') || t.includes('rtos') || t.includes('real time')) {
      prereqCodes.push('OS', 'COA', 'PROG', 'MATH_LINALG');
    } else if (t.includes('wireless') || t.includes('5g') || t.includes('iot') || t.includes('internet of things') || t.includes('cloud')) {
      prereqCodes.push('COMPNET', 'OS', 'CYBER_BASICS');
    } else if (t.includes('quantum') || t.includes('photonics') || t.includes('digital twin')) {
      prereqCodes.push('MATH_LINALG', 'COA', 'PROG');
    } else if (t.includes('image') || t.includes('speech') || t.includes('ar') || t.includes('vr') || t.includes('augmented')) {
      prereqCodes.push('MATH_LINALG', 'PROG', 'DSA');
    } else {
      prereqCodes.push('DSA', 'PROG', 'MATH_LINALG');
    }

    for (const code of prereqCodes) {
      const pId = coreMap[code];
      if (pId) {
        await pool.query(`
          INSERT INTO course_prerequisites (course_id, prereq_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [el.course_id, pId]);
      }
    }
  }

  // 5. Seed Resources for each elective
  console.log('Seeding learning resources for all electives...');
  await pool.query('DELETE FROM resources');

  for (const el of electives) {
    const t = el.title;
    const lower = t.toLowerCase();
    const resources = [];

    if (lower.includes('machine learning') || lower.includes('ml') || lower.includes('analytics')) {
      resources.push(
        { type: 'book', title: 'Pattern Recognition and Machine Learning (Christopher Bishop)', url: 'https://www.microsoft.com/en-us/research/people/cmbishop/prml-book/' },
        { type: 'video', title: 'Stanford CS229: Machine Learning Video Lectures & Syllabus', url: 'https://cs229.stanford.edu/' },
        { type: 'notes', title: 'Scikit-Learn, PyTorch and ML Engineering Best Practices Guide', url: 'https://pytorch.org/tutorials/' },
        { type: 'practice', title: 'Modern Machine Learning Paradigms: Benchmark Projects & Kaggle Datasets', url: 'https://kaggle.com' }
      );
    } else if (lower.includes('deep learning') || lower.includes('reinforcement') || lower.includes('llm') || lower.includes('agent')) {
      resources.push(
        { type: 'book', title: 'Deep Learning (Ian Goodfellow, Yoshua Bengio, Aaron Courville)', url: 'https://www.deeplearningbook.org/' },
        { type: 'video', title: 'Hugging Face LLM Course & Fine-Tuning Transformers', url: 'https://huggingface.co/learn' },
        { type: 'notes', title: 'OpenAI & Anthropic Prompt Engineering and Agent Architecture Guide', url: 'https://platform.openai.com/docs' },
        { type: 'practice', title: 'Attention Is All You Need & Transformer Implementations from Scratch', url: 'https://github.com' }
      );
    } else if (lower.includes('security') || lower.includes('crypto') || lower.includes('threat') || lower.includes('forensics')) {
      resources.push(
        { type: 'book', title: 'Applied Cryptography: Protocols, Algorithms, and Source Code (Bruce Schneier)', url: 'https://www.schneier.com/books/applied_cryptography/' },
        { type: 'notes', title: 'NIST Computer Security Resource Center & Incident Handling Guide', url: 'https://csrc.nist.gov/' },
        { type: 'video', title: 'MIT 6.857: Network and Computer Security Lectures', url: 'https://courses.csail.mit.edu/6.857/' },
        { type: 'practice', title: 'MITRE ATT&CK Framework, CTF Challenges & Threat Intelligence Labs', url: 'https://attack.mitre.org/' }
      );
    } else if (lower.includes('robot') || lower.includes('autonomous') || lower.includes('rtos') || lower.includes('vehicle')) {
      resources.push(
        { type: 'book', title: 'Probabilistic Robotics (Sebastian Thrun, Wolfram Burgard, Dieter Fox)', url: 'https://www.probabilistic-robotics.org/' },
        { type: 'notes', title: 'ROS 2 (Robot Operating System) Official Galactic/Humble Documentation', url: 'https://docs.ros.org/en/humble/' },
        { type: 'video', title: 'FreeRTOS Real-Time Kernel Concepts & Practical Porting Tutorial', url: 'https://www.freertos.org/' },
        { type: 'practice', title: 'Modern SLAM & Trajectory Simulation in Gazebo & Webots', url: 'https://gazebosim.org' }
      );
    } else if (lower.includes('cloud') || lower.includes('iot') || lower.includes('big data') || lower.includes('wireless')) {
      resources.push(
        { type: 'book', title: 'Designing Data-Intensive Applications (Martin Kleppmann)', url: 'https://dataintensive.net/' },
        { type: 'notes', title: 'Cloud Native Computing Foundation (CNCF) Architecture Playbook', url: 'https://www.cncf.io/' },
        { type: 'video', title: 'Distributed Systems & Cloud Infrastructure Engineering (MIT 6.824)', url: 'https://pdos.csail.mit.edu/6.824/' },
        { type: 'practice', title: 'Delta Lake, Apache Iceberg & Kafka Streaming Hands-on Labs', url: 'https://iceberg.apache.org/' }
      );
    } else {
      resources.push(
        { type: 'book', title: `Foundations and Advanced Principles of ${t} (Standard University Reference)`, url: 'https://ocw.mit.edu' },
        { type: 'notes', title: 'Official Academic Syllabus, Lab Manual & Standard Operating Protocols', url: 'https://pes.edu' },
        { type: 'video', title: 'National Programme on Technology Enhanced Learning (NPTEL) Lectures', url: 'https://nptel.ac.in' },
        { type: 'practice', title: 'State-of-the-Art Research Surveys & IEEE Benchmark Implementations', url: 'https://ieeexplore.ieee.org' }
      );
    }

    for (const r of resources) {
      await pool.query(`
        INSERT INTO resources (course_id, added_by, type, title, url)
        VALUES ($1, 1, $2, $3, $4)
      `, [el.course_id, r.type, r.title, r.url]);
    }
  }

  // 6. Seed Faculty Reviews for all 41 electives
  console.log('Seeding faculty reviews for all electives...');
  await pool.query('DELETE FROM faculty_reviews');

  for (let i = 0; i < electives.length; i++) {
    const el = electives[i];
    const fac1 = facultyList[i % facultyList.length];
    const fac2 = facultyList[(i + 3) % facultyList.length];

    const comment1 = `${el.title} is a cornerstone of our curriculum. Students who thoroughly complete the weekly programming laboratories and engage with current research papers gain an immediate competitive advantage during tier-1 campus placements.`;
    const comment2 = `High industrial relevance. The course connects foundational mathematical formulations directly with practical deployment constraints. Highly recommended for students aiming for advanced systems engineering and research roles.`;

    await pool.query(`
      INSERT INTO faculty_reviews (faculty_id, course_id, relevance, future_scope, comment)
      VALUES
        ($1, $2, 5, 5, $3),
        ($4, $2, 4, 5, $5)
    `, [fac1.faculty_id, el.course_id, comment1, fac2.faculty_id, comment2]);
  }

  // 7. Expand course skills so every elective has 6-8 rich skills mapped with realistic depth
  console.log('Expanding course skills for all electives...');
  const allSkillsRes = await pool.query("SELECT skill_id, name, category FROM skills");
  const allSkills = allSkillsRes.rows;
  const skillByName = {};
  allSkills.forEach(s => { skillByName[s.name.toLowerCase()] = s.skill_id; });

  // Helper to get or insert skill
  async function ensureSkill(name, category) {
    const key = name.toLowerCase();
    if (skillByName[key]) return skillByName[key];
    const res = await pool.query(`
      INSERT INTO skills (name, category)
      VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category
      RETURNING skill_id
    `, [name, category]);
    const sid = res.rows[0].skill_id;
    skillByName[key] = sid;
    return sid;
  }

  // Domain skills definitions
  const domainSkills = {
    ml: [
      ['Python Programming', 'Programming'],
      ['Mathematical Optimization', 'Mathematics'],
      ['Linear Algebra', 'Mathematics'],
      ['Scikit-Learn', 'Frameworks'],
      ['PyTorch Deep Learning', 'Frameworks'],
      ['Statistical Hypothesis Testing', 'Mathematics'],
      ['Model Evaluation & Tuning', 'Methodology'],
      ['Feature Engineering', 'Data Engineering']
    ],
    deep_learning: [
      ['Neural Network Architectures', 'AI/ML'],
      ['Backpropagation & Autograd', 'Mathematics'],
      ['PyTorch Framework', 'Frameworks'],
      ['Computer Vision / CNNs', 'AI/ML'],
      ['Transformer Attention Mechanisms', 'AI/ML'],
      ['GPU Accelerated Inference', 'Systems'],
      ['Distributed Model Training', 'Systems'],
      ['Hyperparameter Optimization', 'Methodology']
    ],
    nlp_llm: [
      ['Transformers Architecture', 'AI/ML'],
      ['Prompt Engineering & Evaluation', 'Methodology'],
      ['Retrieval-Augmented Generation (RAG)', 'AI/ML'],
      ['Vector Embeddings & Search', 'Data Engineering'],
      ['Quantization & PEFT/LoRA', 'Systems'],
      ['AgentOps & Multi-Agent Systems', 'Methodology'],
      ['Hugging Face Libraries', 'Frameworks'],
      ['LangChain / LlamaIndex', 'Frameworks']
    ],
    security: [
      ['Applied Cryptography', 'Security'],
      ['Public Key Infrastructure (PKI)', 'Security'],
      ['Threat Modeling & MITRE ATT&CK', 'Security'],
      ['Network Packet Inspection', 'Security'],
      ['Penetration Testing & Exploits', 'Security'],
      ['Digital Forensics & Incident Response', 'Security'],
      ['Secure Code Auditing', 'Security'],
      ['SIEM & SOC Operations', 'Security']
    ],
    robotics_systems: [
      ['Robot Operating System (ROS 2)', 'Robotics'],
      ['Kinematics & Dynamics', 'Mathematics'],
      ['Sensor Fusion & Kalman Filtering', 'Robotics'],
      ['Simultaneous Localization & Mapping (SLAM)', 'Robotics'],
      ['Real-Time Kernel Design', 'Systems'],
      ['C++ Embedded Systems', 'Programming'],
      ['Hardware-Software Co-Design', 'Hardware'],
      ['Autonomous Trajectory Planning', 'Robotics']
    ],
    cloud_systems: [
      ['Distributed Systems Architecture', 'Systems'],
      ['Containerization & Docker', 'DevOps'],
      ['Kubernetes Orchestration', 'DevOps'],
      ['Delta Lake & Data Warehousing', 'Data Engineering'],
      ['Kafka Event Streaming', 'Data Engineering'],
      ['Cloud Security & IAM', 'Security'],
      ['Microservices API Design', 'Architecture'],
      ['ACID Transaction Protocols', 'Data Engineering']
    ]
  };

  for (const el of electives) {
    const t = el.title.toLowerCase();
    let targetGroup = 'ml';
    if (t.includes('llm') || t.includes('agent') || t.includes('prompt') || t.includes('speech')) {
      targetGroup = 'nlp_llm';
    } else if (t.includes('deep learning') || t.includes('image') || t.includes('reinforcement')) {
      targetGroup = 'deep_learning';
    } else if (t.includes('security') || t.includes('crypto') || t.includes('forensics') || t.includes('threat') || t.includes('blockchain')) {
      targetGroup = 'security';
    } else if (t.includes('robot') || t.includes('autonomous') || t.includes('vehicle') || t.includes('rtos') || t.includes('photonics') || t.includes('quantum')) {
      targetGroup = 'robotics_systems';
    } else if (t.includes('cloud') || t.includes('big data') || t.includes('iot') || t.includes('wireless') || t.includes('twin')) {
      targetGroup = 'cloud_systems';
    }

    const skillsToAssign = domainSkills[targetGroup];
    for (let j = 0; j < skillsToAssign.length; j++) {
      const [sName, sCat] = skillsToAssign[j];
      const sId = await ensureSkill(sName, sCat);
      const depth = j < 3 ? 3 : j < 6 ? 2 : 1;
      await pool.query(`
        INSERT INTO course_skills (course_id, skill_id, depth)
        VALUES ($1, $2, $3)
        ON CONFLICT (course_id, skill_id) DO UPDATE SET depth = EXCLUDED.depth
      `, [el.course_id, sId, depth]);
    }
  }

  // 8. Verify counts
  const finalResCount = await pool.query('SELECT count(*) FROM resources');
  const finalFacCount = await pool.query('SELECT count(*) FROM faculty_reviews');
  const finalPrereqCount = await pool.query('SELECT count(*) FROM course_prerequisites');
  const finalSkillCount = await pool.query('SELECT count(*) FROM course_skills');

  console.log('--- ENRICHMENT COMPLETED SUCCESSFULLY ---');
  console.log(`Resources in DB: ${finalResCount.rows[0].count}`);
  console.log(`Faculty reviews in DB: ${finalFacCount.rows[0].count}`);
  console.log(`Course prerequisites in DB: ${finalPrereqCount.rows[0].count}`);
  console.log(`Course skills mapped in DB: ${finalSkillCount.rows[0].count}`);

  await pool.end();
}

enrichElectives().catch(console.error);
