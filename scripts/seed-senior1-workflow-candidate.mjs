import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.OWNER_DATABASE_URL });

async function seedSenior1() {
  const c = await pool.connect();
  try {
    console.log('Seeding candidate senior1 for approval workflow...');

    // 1. Update senior1 student batch_year and enrollments to produce exactly 8.72 CGPA
    await c.query(`UPDATE students SET batch_year = 2025 WHERE student_id = 1`);

    // Let's set grades across the 13 enrollments so AVG is 8.72:
    // Core (9 courses): 8.6, 8.8, 8.5, 8.7, 8.9, 8.6, 8.8, 8.5, 8.6
    // Electives (4 courses):
    // Elective I (course 19): 9.0
    // Elective II (course 28): 8.5
    // Elective III (course 30): 9.0
    // Elective IV (course 43): 8.8
    // Total sum = (8.6+8.8+8.5+8.7+8.9+8.6+8.8+8.5+8.6) + (9.0+8.5+9.0+8.8) = 77.9 + 35.3 = 113.2 / 13 = 8.707 -> let's tweak slightly for exact 8.72:
    // 13 * 8.72 = 113.36 -> sum = 113.36 -> 113.4
    await c.query(`
      UPDATE enrollments SET grade_points = 8.7 WHERE student_id = 1 AND course_id = 1;
      UPDATE enrollments SET grade_points = 8.8 WHERE student_id = 1 AND course_id = 2;
      UPDATE enrollments SET grade_points = 8.6 WHERE student_id = 1 AND course_id = 3;
      UPDATE enrollments SET grade_points = 8.7 WHERE student_id = 1 AND course_id = 4;
      UPDATE enrollments SET grade_points = 8.7 WHERE student_id = 1 AND course_id = 5;
      UPDATE enrollments SET grade_points = 8.8 WHERE student_id = 1 AND course_id = 6;
      UPDATE enrollments SET grade_points = 8.7 WHERE student_id = 1 AND course_id = 7;
      UPDATE enrollments SET grade_points = 8.6 WHERE student_id = 1 AND course_id = 8;
      UPDATE enrollments SET grade_points = 8.7 WHERE student_id = 1 AND course_id = 9;
      UPDATE enrollments SET grade_points = 9.0 WHERE student_id = 1 AND course_id = 19;
      UPDATE enrollments SET grade_points = 8.5 WHERE student_id = 1 AND course_id = 28;
      UPDATE enrollments SET grade_points = 9.0 WHERE student_id = 1 AND course_id = 30;
      UPDATE enrollments SET grade_points = 8.6 WHERE student_id = 1 AND course_id = 43;
    `);

    // 2. Ensure senior_profile exists with status 'draft' or 'submitted'
    await c.query(`
      UPDATE senior_profiles
      SET status = 'draft',
          consent = true,
          display_name = 'Senior 1 (SDE @ Google)',
          headline = 'Incoming Software Development Engineer @ Google | AI & Systems Enthusiast',
          specialization = 'Distributed Systems & Applied Machine Learning',
          advice_for_juniors = 'Master DSA patterns on LeetCode early (focus on graphs, DP, trees). Build end-to-end full stack projects with measurable scale. Pick electives that challenge you technically rather than just easy grades. Mock interviews on Pramp and NeetCode were game changers.',
          linkedin_url = 'https://linkedin.com/in/senior1-electiq',
          github_url = 'https://github.com/senior1-google',
          show_grades = true,
          show_placements = true,
          show_internships = true,
          show_projects = true,
          show_prep = true,
          show_publications = true,
          show_hackathons = true,
          submitted_at = NULL,
          published_at = NULL,
          reviewed_by = NULL,
          review_notes = NULL,
          faculty_reviewed_by = NULL,
          faculty_notes = NULL,
          faculty_reviewed_at = NULL
      WHERE student_id = 1
    `);

    // 3. Update placement: Google 42 LPA SDE
    // Get Google company_id and SDE role_id
    const googleRes = await c.query("SELECT company_id FROM companies WHERE name ILIKE '%Google%' LIMIT 1");
    let googleId = googleRes.rows[0]?.company_id;
    if (!googleId) {
      const insC = await c.query("INSERT INTO companies (name, tier) VALUES ('Google', 1) RETURNING company_id");
      googleId = insC.rows[0].company_id;
    }

    const sdeRes = await c.query("SELECT role_id FROM job_roles WHERE title ILIKE '%Software Development Engineer%' OR title ILIKE '%Software Engineer%' LIMIT 1");
    let sdeId = sdeRes.rows[0]?.role_id || 1;

    // Check if placement exists for student 1
    const pRes = await c.query("SELECT placement_id FROM placements WHERE student_id = 1 AND type = 'full_time'");
    if (pRes.rows.length > 0) {
      await c.query(`
        UPDATE placements
        SET company_id = $1, role_id = $2, package_lpa = 42.0, year = 2025,
            location = 'Bangalore, India', is_remote = false,
            tech_stack = 'C++, Go, Kubernetes, Spanner, Bazel, TensorFlow',
            work_description = 'Software Development Engineer on Google Core Systems Infrastructure team.',
            ppo_received = true, placement_mode = 'on_campus',
            verified = false, verification_status = 'pending',
            evidence_text = 'Offer Letter Reference: GOOG-IN-2025-SDE-99812 verified by Campus Placement Cell.',
            verified_by = NULL, verified_at = NULL, review_notes = NULL
        WHERE placement_id = $3
      `, [googleId, sdeId, pRes.rows[0].placement_id]);
    } else {
      await c.query(`
        INSERT INTO placements (student_id, company_id, role_id, type, package_lpa, year, location, is_remote, tech_stack, work_description, ppo_received, placement_mode, verified, verification_status, evidence_text)
        VALUES (1, $1, $2, 'full_time', 42.0, 2025, 'Bangalore, India', false, 'C++, Go, Kubernetes, Spanner, Bazel, TensorFlow', 'Software Development Engineer on Google Core Systems Infrastructure team.', true, 'on_campus', false, 'pending', 'Offer Letter Reference: GOOG-IN-2025-SDE-99812 verified by Campus Placement Cell.')
      `, [googleId, sdeId]);
    }

    // 4. Internship: Google Summer Intern
    const internRes = await c.query("SELECT placement_id FROM placements WHERE student_id = 1 AND type = 'internship'");
    if (internRes.rows.length === 0) {
      await c.query(`
        INSERT INTO placements (student_id, company_id, role_id, type, duration_months, stipend_monthly, year, location, is_remote, tech_stack, work_description, ppo_received, placement_mode, verified, verification_status, evidence_text)
        VALUES (1, $1, $2, 'internship', 6, 125000, 2024, 'Bangalore / Hybrid', false, 'Go, Kubernetes, Cloud Pub/Sub', 'Engineered an asynchronous high-throughput event streamer reducing pipeline latency by 34%. Earned PPO.', true, 'on_campus', false, 'pending', 'Summer Internship Completion Certificate #G-INT-883')
      `, [googleId, sdeId]);
    }

    // 5. Elective feedback for senior1's electives (set to pending moderation)
    const enrolls = await c.query(`
      SELECT e.enrollment_id, e.course_id, c.title, c.elective_slot
      FROM enrollments e
      JOIN courses c ON c.course_id = e.course_id
      WHERE e.student_id = 1 AND c.is_elective = true
    `);

    for (const enr of enrolls.rows) {
      const fbCheck = await c.query('SELECT feedback_id FROM feedback WHERE enrollment_id = $1', [enr.enrollment_id]);
      if (fbCheck.rows.length === 0) {
        await c.query(`
          INSERT INTO feedback (enrollment_id, difficulty, workload, usefulness, review_text, placement_help, extra_prep_needed, recommended_resources, advice_for_juniors, is_verified, moderation_status)
          VALUES ($1, 4, 4, 5, $2, true, 'DSA and high concurrency concepts', 'Official documentation and Stanford CS229 / CS224N lecture notes', 'Complete all hands-on assignments before deadlines; directly helps in technical rounds.', false, 'pending')
        `, [enr.enrollment_id, `Highly rigorous course for ${enr.title}. The programming assignments directly mirrored real-world production architectures.`]);
      } else {
        await c.query(`
          UPDATE feedback
          SET difficulty = 4, workload = 4, usefulness = 5,
              review_text = $1,
              placement_help = true,
              extra_prep_needed = 'DSA and high concurrency concepts',
              recommended_resources = 'Official documentation and Stanford CS229 / CS224N lecture notes',
              advice_for_juniors = 'Complete all hands-on assignments before deadlines; directly helps in technical rounds.',
              is_verified = false,
              moderation_status = 'pending'
          WHERE feedback_id = $2
        `, [`Highly rigorous course for ${enr.title}. The programming assignments directly mirrored real-world production architectures.`, fbCheck.rows[0].feedback_id]);
      }
    }

    // 6. Recruiter Interview Questions for all 4 electives
    const placementId = (await c.query("SELECT placement_id FROM placements WHERE student_id = 1 AND type = 'full_time'")).rows[0].placement_id;

    // Delete existing interview questions for this placement so we cleanly seed fresh, realistic ones
    await c.query("DELETE FROM interview_questions WHERE placement_id = $1", [placementId]);

    const sampleQuestions = [
      {
        course_id: 19, // Speech and Natural Language Processing (Elective I)
        round: 'Technical Round 1',
        difficulty: 4,
        text: 'Explain the Transformer self-attention mathematical formulation $Attention(Q,K,V) = softmax(QK^T / \\sqrt{d_k})V$. Why is the $\\sqrt{d_k}$ scaling factor required to prevent vanishing gradients in softmax?'
      },
      {
        course_id: 19,
        round: 'Technical Round 2',
        difficulty: 4,
        text: 'How do Rotary Position Embeddings (RoPE) and FlashAttention-2 optimize long-context LLM token processing compared to standard quadratic self-attention?'
      },
      {
        course_id: 28, // Quantum Entanglement (Elective II)
        round: 'Technical Round 2',
        difficulty: 5,
        text: 'Explain Shor algorithm for integer factorization and how quantum Fourier transforms achieve exponential speedup over classical sieve methods.'
      },
      {
        course_id: 28,
        round: 'Technical Round 1',
        difficulty: 4,
        text: 'What is the difference between decoherence time $T_1$ and dephasing time $T_2$ in superconducting qubits, and how does surface code error correction mitigate phase flips?'
      },
      {
        course_id: 30, // LLM Applications & Optimization (Elective III)
        round: 'System Design Round',
        difficulty: 5,
        text: 'Design a high-throughput LLM serving infrastructure supporting continuous batching, PagedAttention, KV-cache quantization (FP8), and speculative decoding for 20,000 queries per second.'
      },
      {
        course_id: 30,
        round: 'Technical Round 2',
        difficulty: 4,
        text: 'Compare LoRA, QLoRA, and full parameter fine-tuning. How does rank decomposition $W + \\frac{\\alpha}{r}BA$ maintain gradient flow while training only 0.2% of model weights?'
      },
      {
        course_id: 43, // Foundations of Frugal AI (Elective IV)
        round: 'Technical Round 2',
        difficulty: 4,
        text: 'Describe post-training quantization techniques: AWQ vs GPTQ. How does activation-aware weight protection prevent catastrophic perplexity degradation on 4-bit INT models?'
      },
      {
        course_id: 43,
        round: 'Technical Round 1',
        difficulty: 4,
        text: 'How do structured pruning and knowledge distillation differ when compressing a 14B parameter transformer down to a 1.5B edge model for on-device deployment?'
      },
      {
        course_id: 19,
        round: 'Managerial & Leadership Round',
        difficulty: 3,
        text: 'Tell me about a time you identified a critical production latency bottleneck during a group project. How did you diagnose it, communicate trade-offs, and align the team on the solution?'
      }
    ];

    for (const q of sampleQuestions) {
      await c.query(`
        INSERT INTO interview_questions (placement_id, course_id, round, difficulty, question_text, is_verified)
        VALUES ($1, $2, $3, $4, $5, true)
      `, [placementId, q.course_id, q.round, q.difficulty, q.text]);
    }

    // 7. Projects
    await c.query("DELETE FROM projects WHERE student_id = 1");
    await c.query(`
      INSERT INTO projects (student_id, course_id, title, brief, problem_statement, tech_stack, repo_link, live_demo_link, outcome, helped_in_placement, is_completed, moderation_status)
      VALUES
      (1, 30, 'Distributed Speculative LLM Inference Engine', 'High-speed speculative decoding engine running on Triton and PyTorch with continuous batching.', 'Standard auto-regressive generation is memory-bandwidth bound. We built a draft-verify pipeline that increased token throughput by 2.8x.', 'Python, C++, Triton, PyTorch, CUDA, vLLM, Docker', 'https://github.com/senior1-google/speculative-inference', 'https://inference.senior1.dev', 'Achieved 2.8x speedup on Llama-3-70B; open-sourced with 450+ GitHub stars.', true, true, 'pending'),
      (1, 19, 'Neural Multilingual Translation & Alignment', 'Low-resource speech translation system fine-tuned on Indic corpora with sub-word BPE tokenization.', 'Low-resource languages suffer from out-of-vocabulary tokens and translation hallucinations.', 'PyTorch, Hugging Face, Fairseq, Weights & Biases', 'https://github.com/senior1-google/indic-translator', 'https://translator.senior1.dev', 'Published evaluation metrics beating commercial baseline by 3.2 BLEU points.', true, true, 'pending')
    `);

    // 8. Research Publications
    await c.query("DELETE FROM publications WHERE student_id = 1");
    await c.query(`
      INSERT INTO publications (student_id, title, venue, type, year, status, topic, doi, abstract, moderation_status)
      VALUES (1, 'Scalable Vector Quantization for Efficient Edge LLM Inference', 'IEEE International Conference on Big Data and Systems (BDS 2025)', 'conference', 2025, 'published', 'Quantization & Model Compression', '10.1109/BDS.2025.109823', 'We propose an activation-aware non-uniform vector quantization scheme that compresses 16-bit float transformer weights to 3.5 bits per parameter with negligible loss in validation perplexity.', 'pending')
    `);

    // 9. Achievements & Hackathons
    await c.query("DELETE FROM achievements WHERE student_id = 1");
    await c.query(`
      INSERT INTO achievements (student_id, event_name, role_status, position, organizer, project_presented, year, moderation_status)
      VALUES
      (1, 'Smart India Hackathon (SIH 2024)', 'won', '1st Place Winner (National)', 'Ministry of Education & AICTE', 'AI-Driven Disaster Resource Allocation Grid', 2024, 'pending'),
      (1, 'Google AI Agents Hackathon 2025', 'won', 'Global Runner-Up (Top 3)', 'Google Cloud', 'Autonomous Code Review & Security Remediation Agent', 2025, 'pending')
    `);

    // 10. Extra Preparation
    await c.query("DELETE FROM extra_activities WHERE student_id = 1");
    await c.query(`
      INSERT INTO extra_activities (student_id, course_id, type, platform, hours_spent, title, skills_covered, certificate_obtained, moderation_status)
      VALUES
      (1, 30, 'coding_practice', 'LeetCode', 280, 'LeetCode Knight (Rating 2120) · 450+ Problems Solved', 'Graphs, Dynamic Programming, Segment Trees, Trie, Monotonic Stack', false, 'pending'),
      (1, 30, 'online_course', 'Coursera / DeepLearning.AI', 95, 'Deep Learning & LLM Specialization by Andrew Ng', 'Transformer Architectures, Backprop, Attention, RLHF, Fine-tuning', true, 'pending'),
      (1, 19, 'online_course', 'Educative / GitHub', 60, 'Grokking the System Design Interview & System Design Primer', 'Consistent Hashing, CAP Theorem, Rate Limiters, Distributed Cache', true, 'pending')
    `);

    // 11. Interview Preparation
    await c.query("DELETE FROM interview_prep WHERE student_id = 1");
    await c.query(`
      INSERT INTO interview_prep (student_id, strategy, weeks, resources, tips, dsa_strategy, languages_used, core_subjects_revised, mock_interviews, platforms_used, hr_prep, company_prep, mistakes_to_avoid, moderation_status)
      VALUES (
        1,
        'Structured 14-week roadmap: Weeks 1-6 focused on foundational and advanced DSA patterns (Sliding Window, Binary Search, Trees, Graphs, DP). Weeks 7-10 covered low-level and high-level System Design (Scalability, Sharding, Microservices, Caching). Weeks 11-14 were dedicated to full-length timed mock interviews and core CS fundamentals.',
        14,
        'NeetCode 150, System Design Primer (Donne Martin), Alex Xu System Design Vol 1 & 2, Striver SDE Sheet, Stanford CS229 / CS224N',
        'Always communicate your thought process aloud before typing code. Write test cases with edge cases (empty input, duplicates, large bounds) before the interviewer asks.',
        'Solved 450+ LeetCode problems (150 Easy, 240 Medium, 60 Hard). Maintained a spreadsheet documenting every tricky problem and reviewed it every Sunday.',
        'C++, Python, Go, SQL',
        'Operating Systems (Processes, Threads, Virtual Memory, Locks), Computer Networks (TCP/IP, HTTP/3, DNS), Database Systems (Indexing, B+ Trees, ACID, Transactions)',
        'Completed 32 peer mock interviews on Pramp and 6 mock interviews with verified alumni working at Google and Microsoft.',
        'LeetCode, Codeforces, Pramp, InterviewBit, GeeksForGeeks',
        'Prepared STAR method stories for all 10 common behavioral questions (conflict resolution, technical failure, leadership, innovation).',
        'Researched Google Core engineering philosophy, read past Google interview experiences on LeetCode Discuss, and reviewed Google cloud architecture whitepapers.',
        '1. Never write code in silence; continuous communication is 50% of the evaluation. 2. Do not assume inputs are within standard ranges without clarifying. 3. Avoid premature optimization—state the brute force first, then optimize.',
        'pending'
      )
    `);

    // 12. Exam Questions (Submitted by senior1, pending faculty review)
    await c.query("DELETE FROM exam_questions WHERE contributor_id = 1");
    await c.query(`
      INSERT INTO exam_questions (contributor_id, course_id, exam_type, year, semester, marks, question_text, answer_text, topic, difficulty, status)
      VALUES
      (1, 19, 'ISA1', 2024, 7, 10, 'Derive the byte-pair encoding (BPE) vocabulary construction algorithm for a given corpus. Explain how subword tokenization resolves the out-of-vocabulary (OOV) dilemma.', '1. Initialize vocabulary with individual characters and end-of-word tokens. 2. Iteratively count most frequent adjacent pairs. 3. Merge most frequent pair and add to vocabulary. 4. Terminate at target vocabulary size. 5. Show OOV resolution by decomposing rare words into sub-word tokens.', 'BPE, Tokenization, OOV Mitigation', 3, 'pending'),
      (1, 30, 'ESA', 2024, 8, 15, 'Compare PagedAttention with traditional contiguous KV cache allocation in LLM serving engines. Calculate the memory fragmentation percentage saved for a batch of 64 concurrent requests.', '1. Explain contiguous allocation physical memory waste due to static reservation. 2. Define PagedAttention virtual memory mapping (page table, non-contiguous physical blocks). 3. Show dynamic allocation on token generation. 4. Numerical calculation showing reduction from ~60-80% fragmentation down to <4%.', 'PagedAttention, vLLM, Memory Fragmentation, KV Cache', 4, 'pending')
    `);

    console.log('Successfully seeded candidate senior1 with Google 42 LPA, 4 electives, and rich contributions!');
  } finally {
    c.release();
    pool.end();
  }
}
seedSenior1();
