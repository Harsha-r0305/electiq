-- ElectIQ :: 02_logic.sql
-- Helper functions, triggers, views, functions and stored procedures.

-- ====================== Session helpers (identity set by the API per transaction) ======================
CREATE FUNCTION fn_current_user_id() RETURNS INT
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::int $$;

CREATE FUNCTION fn_current_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.role', true), '') $$;

CREATE FUNCTION fn_current_student_id() RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT student_id FROM students WHERE user_id = fn_current_user_id() $$;

CREATE FUNCTION fn_current_faculty_id() RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT faculty_id FROM faculty WHERE user_id = fn_current_user_id() $$;

-- ====================== Triggers ======================
-- 1) Reviews are only allowed after the grade is posted
CREATE FUNCTION trg_feedback_requires_grade() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g NUMERIC;
BEGIN
  SELECT grade_points INTO g FROM enrollments WHERE enrollment_id = NEW.enrollment_id;
  IF g IS NULL THEN
    RAISE EXCEPTION 'Feedback not allowed: the grade for this enrollment has not been posted yet'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER feedback_requires_grade BEFORE INSERT ON feedback
  FOR EACH ROW EXECUTE FUNCTION trg_feedback_requires_grade();

-- 2) Prerequisite cycles are impossible (recursive check)
CREATE FUNCTION trg_prevent_prereq_cycle() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE up AS (
      SELECT prereq_id FROM course_prerequisites WHERE course_id = NEW.prereq_id
      UNION
      SELECT cp.prereq_id FROM course_prerequisites cp JOIN up ON cp.course_id = up.prereq_id
    )
    SELECT 1 FROM up WHERE prereq_id = NEW.course_id
  ) THEN
    RAISE EXCEPTION 'Circular prerequisite rejected: course % already depends on course %',
      NEW.prereq_id, NEW.course_id USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prevent_prereq_cycle BEFORE INSERT OR UPDATE ON course_prerequisites
  FOR EACH ROW EXECUTE FUNCTION trg_prevent_prereq_cycle();

-- 3) Audit trail: the ONLY writer of audit_log
CREATE FUNCTION trg_audit_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o JSONB; n JSONB; pk TEXT;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN o := to_jsonb(OLD) - 'password_hash'; END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN n := to_jsonb(NEW) - 'password_hash'; END IF;
  pk := COALESCE(n, o) ->> TG_ARGV[0];
  INSERT INTO audit_log(user_id, action, table_name, row_pk, old_value, new_value)
  VALUES (fn_current_user_id(), TG_OP, TG_TABLE_NAME, pk, o, n);
  RETURN NULL;
END $$;
CREATE TRIGGER audit_enrollments AFTER INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION trg_audit_changes('enrollment_id');
CREATE TRIGGER audit_feedback    AFTER INSERT OR UPDATE OR DELETE ON feedback
  FOR EACH ROW EXECUTE FUNCTION trg_audit_changes('feedback_id');
CREATE TRIGGER audit_placements  AFTER INSERT OR UPDATE OR DELETE ON placements
  FOR EACH ROW EXECUTE FUNCTION trg_audit_changes('placement_id');
CREATE TRIGGER audit_users       AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION trg_audit_changes('user_id');

-- ====================== Views ======================
CREATE VIEW v_student_cgpa AS
SELECT s.student_id,
       ROUND(SUM(e.grade_points * c.credits) / NULLIF(SUM(c.credits), 0), 2) AS cgpa,
       COUNT(e.enrollment_id) AS courses_graded
FROM students s
LEFT JOIN enrollments e ON e.student_id = s.student_id
     AND e.status = 'completed' AND e.grade_points IS NOT NULL
LEFT JOIN courses c ON c.course_id = e.course_id
GROUP BY s.student_id;

-- Feedback without any student identity
CREATE VIEW v_course_feedback AS
SELECT f.feedback_id, e.course_id, f.difficulty, f.workload, f.usefulness,
       f.review_text, f.review_tsv, f.created_at, s.batch_year
FROM feedback f
JOIN enrollments e ON e.enrollment_id = f.enrollment_id
JOIN students s ON s.student_id = e.student_id;

-- A placement counts toward every course the student completed with a posted grade
CREATE VIEW v_course_placements AS
SELECT e.course_id, p.placement_id, p.student_id, p.type, p.package_lpa, p.year
FROM placements p
JOIN enrollments e ON e.student_id = p.student_id
WHERE e.status = 'completed' AND e.grade_points IS NOT NULL;

CREATE VIEW v_faculty_reviews AS
SELECT fr.course_id, f.name AS faculty_name, fr.relevance, fr.future_scope, fr.comment
FROM faculty_reviews fr JOIN faculty f ON f.faculty_id = fr.faculty_id;

CREATE VIEW v_course_preparation AS
SELECT course_id, type, platform, COUNT(*) AS seniors, ROUND(AVG(hours_spent), 1) AS avg_hours
FROM extra_activities
GROUP BY course_id, type, platform;

CREATE VIEW v_course_summary AS
SELECT c.course_id, c.code, c.title, c.credits, c.semester, c.level, c.is_active,
       d.dept_id, d.name AS department, f.name AS faculty_name,
       fb.feedback_count, fb.avg_difficulty, fb.avg_workload, fb.avg_usefulness,
       COALESCE(r.resource_count, 0) AS resource_count,
       COALESCE(pl.placed_students, 0) AS placed_students,
       pl.avg_package,
       fr.avg_relevance, fr.avg_future_scope,
       c.vertical, c.elective_slot, c.is_elective, c.advisor_scope_outlook, c.content_source
FROM courses c
JOIN departments d ON d.dept_id = c.dept_id
LEFT JOIN faculty f ON f.faculty_id = c.faculty_id
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS feedback_count,
         ROUND(AVG(x.difficulty), 2) AS avg_difficulty,
         ROUND(AVG(x.workload), 2) AS avg_workload,
         ROUND(AVG(x.usefulness), 2) AS avg_usefulness
  FROM v_course_feedback x WHERE x.course_id = c.course_id) fb ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS resource_count FROM resources x WHERE x.course_id = c.course_id) r ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(DISTINCT x.placement_id) AS placed_students,
         ROUND(AVG(x.package_lpa), 2) AS avg_package
  FROM v_course_placements x WHERE x.course_id = c.course_id AND x.type = 'full_time') pl ON TRUE
LEFT JOIN LATERAL (
  SELECT ROUND(AVG(x.relevance), 2) AS avg_relevance,
         ROUND(AVG(x.future_scope), 2) AS avg_future_scope
  FROM faculty_reviews x WHERE x.course_id = c.course_id) fr ON TRUE;

CREATE VIEW v_course_comparison AS
SELECT s.*,
       (SELECT COUNT(*) FROM course_skills cs WHERE cs.course_id = s.course_id) AS skill_count,
       (SELECT string_agg(sk.name, ', ' ORDER BY cs.depth DESC, sk.name)
          FROM course_skills cs JOIN skills sk ON sk.skill_id = cs.skill_id
         WHERE cs.course_id = s.course_id) AS skills
FROM v_course_summary s;

CREATE VIEW v_placement_analytics AS
SELECT c.course_id, c.code, c.title, d.name AS department,
       COUNT(DISTINCT vp.placement_id) FILTER (WHERE vp.type = 'full_time')  AS fulltime_count,
       COUNT(DISTINCT vp.placement_id) FILTER (WHERE vp.type = 'internship') AS internship_count,
       MIN(vp.package_lpa) FILTER (WHERE vp.type = 'full_time') AS min_package,
       ROUND(AVG(vp.package_lpa) FILTER (WHERE vp.type = 'full_time'), 2) AS avg_package,
       MAX(vp.package_lpa) FILTER (WHERE vp.type = 'full_time') AS max_package,
       RANK() OVER (PARTITION BY c.dept_id
                    ORDER BY AVG(vp.package_lpa) FILTER (WHERE vp.type = 'full_time') DESC NULLS LAST) AS dept_rank
FROM courses c
JOIN departments d ON d.dept_id = c.dept_id
LEFT JOIN v_course_placements vp ON vp.course_id = c.course_id
GROUP BY c.course_id, c.code, c.title, d.name, c.dept_id;

CREATE VIEW v_department_dashboard AS
SELECT d.dept_id, d.name AS department,
       (SELECT COUNT(*) FROM students s WHERE s.dept_id = d.dept_id) AS students,
       (SELECT COUNT(*) FROM courses c WHERE c.dept_id = d.dept_id) AS courses,
       (SELECT COUNT(*) FROM enrollments e JOIN courses c ON c.course_id = e.course_id
         WHERE c.dept_id = d.dept_id) AS enrollments,
       (SELECT ROUND(AVG(e.grade_points), 2) FROM enrollments e JOIN courses c ON c.course_id = e.course_id
         WHERE c.dept_id = d.dept_id) AS avg_grade,
       (SELECT COUNT(DISTINCT p.placement_id) FROM placements p JOIN students s ON s.student_id = p.student_id
         WHERE s.dept_id = d.dept_id AND p.type = 'full_time') AS fulltime_placements,
       (SELECT ROUND(AVG(p.package_lpa), 2) FROM placements p JOIN students s ON s.student_id = p.student_id
         WHERE s.dept_id = d.dept_id AND p.type = 'full_time') AS avg_package
FROM departments d;

-- Latest market demand per skill, flagged when no elective teaches it
CREATE VIEW v_skill_gap AS
SELECT sk.skill_id, sk.name, sk.category, md.year, md.postings_count, md.demand_score,
       (SELECT COUNT(*) FROM course_skills cs WHERE cs.skill_id = sk.skill_id) AS courses_teaching,
       NOT EXISTS (SELECT 1 FROM course_skills cs WHERE cs.skill_id = sk.skill_id) AS uncovered
FROM skills sk
JOIN LATERAL (SELECT * FROM market_demand m WHERE m.skill_id = sk.skill_id ORDER BY m.year DESC LIMIT 1) md ON TRUE;

-- ====================== Functions ======================
CREATE FUNCTION fn_course_difficulty(p_course_id INT) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT ROUND(AVG(0.6 * difficulty + 0.4 * workload), 2) FROM v_course_feedback WHERE course_id = p_course_id
$$;

CREATE FUNCTION fn_placement_stats(p_course_id INT)
RETURNS TABLE(placed_count BIGINT, avg_package NUMERIC, max_package NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT placement_id), ROUND(AVG(package_lpa), 2), MAX(package_lpa)
  FROM v_course_placements WHERE course_id = p_course_id AND type = 'full_time'
$$;

CREATE FUNCTION fn_skill_coverage(p_role_id INT) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM course_skills cs WHERE cs.skill_id = rs.skill_id))
                / NULLIF(COUNT(*), 0), 1)
  FROM role_skills rs WHERE rs.role_id = p_role_id
$$;

-- Recursive prerequisite chain (Q2) with cycle guard and depth limit
CREATE FUNCTION fn_prereq_chain(p_course_id INT)
RETURNS TABLE(course_id INT, code VARCHAR, title VARCHAR, depth INT)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE chain AS (
    SELECT prereq_id, 1 AS depth, ARRAY[cp.course_id, prereq_id] AS path
    FROM course_prerequisites cp WHERE cp.course_id = p_course_id
    UNION ALL
    SELECT p.prereq_id, c.depth + 1, c.path || p.prereq_id
    FROM course_prerequisites p JOIN chain c ON p.course_id = c.prereq_id
    WHERE p.prereq_id <> ALL (c.path) AND c.depth < 6
  )
  SELECT co.course_id, co.code, co.title, MIN(ch.depth)::INT
  FROM chain ch JOIN courses co ON co.course_id = ch.prereq_id
  GROUP BY co.course_id, co.code, co.title
  ORDER BY MIN(ch.depth), co.code
$$;

-- Next electives: all prerequisites completed with a good grade (SECURITY INVOKER: RLS limits to own rows)
CREATE FUNCTION fn_next_electives(p_student_id INT, p_min_grade NUMERIC DEFAULT 6)
RETURNS TABLE(course_id INT, code VARCHAR, title VARCHAR, level VARCHAR, unlocked_by TEXT)
LANGUAGE sql STABLE AS $$
  SELECT c.course_id, c.code, c.title, c.level,
         (SELECT string_agg(pc.code, ', ' ORDER BY pc.code)
            FROM course_prerequisites cp JOIN courses pc ON pc.course_id = cp.prereq_id
           WHERE cp.course_id = c.course_id)
  FROM courses c
  WHERE c.is_active
    AND EXISTS (SELECT 1 FROM course_prerequisites cp WHERE cp.course_id = c.course_id)
    AND NOT EXISTS (SELECT 1 FROM enrollments x WHERE x.student_id = p_student_id AND x.course_id = c.course_id)
    AND NOT EXISTS (
      SELECT 1 FROM course_prerequisites cp
      WHERE cp.course_id = c.course_id
        AND NOT EXISTS (SELECT 1 FROM enrollments e
                        WHERE e.student_id = p_student_id AND e.course_id = cp.prereq_id
                          AND e.grade_points >= p_min_grade))
  ORDER BY c.code
$$;

-- CGPA-boost: electives where students with a similar CGPA (+/-0.5) scored higher than the requester's CGPA.
-- SECURITY DEFINER because it must read other students' grades; returns aggregates only.
CREATE FUNCTION fn_cgpa_boost(p_student_id INT)
RETURNS TABLE(course_id INT, code VARCHAR, title VARCHAR, avg_grade_similar NUMERIC,
              my_cgpa NUMERIC, expected_gain NUMERIC, sample_size BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me NUMERIC;
BEGIN
  IF p_student_id IS DISTINCT FROM fn_current_student_id() AND fn_current_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'You can only request recommendations for your own profile' USING ERRCODE = '42501';
  END IF;
  SELECT cgpa INTO me FROM v_student_cgpa WHERE student_id = p_student_id;
  IF me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.course_id, c.code, c.title,
         ROUND(AVG(e.grade_points), 2), me, ROUND(AVG(e.grade_points) - me, 2), COUNT(*)
  FROM courses c
  JOIN enrollments e ON e.course_id = c.course_id AND e.grade_points IS NOT NULL
  JOIN v_student_cgpa v ON v.student_id = e.student_id
  WHERE c.is_active
    AND v.student_id <> p_student_id
    AND ABS(v.cgpa - me) <= 0.5
    AND NOT EXISTS (SELECT 1 FROM enrollments x WHERE x.student_id = p_student_id AND x.course_id = c.course_id)
  GROUP BY c.course_id, c.code, c.title
  HAVING COUNT(*) >= 3 AND AVG(e.grade_points) > me
  ORDER BY 6 DESC, 7 DESC
  LIMIT 10;
END $$;

-- ====================== Stored procedures (write operations) ======================
-- Admin posts a grade. Row lock prevents two admins posting conflicting grades.
CREATE PROCEDURE sp_post_grade(p_enrollment_id INT, p_grade NUMERIC)
LANGUAGE plpgsql AS $$
DECLARE locked INT;
BEGIN
  IF p_grade IS NULL OR p_grade < 0 OR p_grade > 10 THEN
    RAISE EXCEPTION 'Grade must be between 0 and 10' USING ERRCODE = '22003';
  END IF;
  SELECT enrollment_id INTO locked FROM enrollments WHERE enrollment_id = p_enrollment_id FOR UPDATE;
  IF locked IS NULL THEN
    RAISE EXCEPTION 'Enrollment % not found', p_enrollment_id USING ERRCODE = 'P0002';
  END IF;
  UPDATE enrollments
     SET grade_points = p_grade, grade_posted_at = now(), status = 'completed'
   WHERE enrollment_id = p_enrollment_id;
END $$;

-- A senior submits a review; the gating trigger fires on the insert.
CREATE PROCEDURE sp_submit_feedback(p_enrollment_id INT, p_difficulty INT, p_workload INT,
                                    p_usefulness INT, p_text TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO feedback(enrollment_id, difficulty, workload, usefulness, review_text)
  VALUES (p_enrollment_id, p_difficulty, p_workload, p_usefulness, NULLIF(trim(p_text), ''));
END $$;

-- Placement + interview questions + preparation logs as ONE atomic unit.
-- p_questions: [{course_id, text, round, difficulty}], p_activities: [{course_id, type, platform, hours}]
CREATE PROCEDURE sp_record_placement(p_company_id INT, p_role_id INT, p_type TEXT, p_package NUMERIC,
                                     p_year INT, p_questions JSONB, p_activities JSONB,
                                     INOUT p_placement_id INT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE sid INT := fn_current_student_id(); q JSONB; a JSONB;
BEGIN
  IF sid IS NULL THEN RAISE EXCEPTION 'No student profile for the current user' USING ERRCODE = '42501'; END IF;
  INSERT INTO placements(student_id, company_id, role_id, type, package_lpa, year)
  VALUES (sid, p_company_id, p_role_id, p_type, p_package, p_year)
  RETURNING placement_id INTO p_placement_id;

  FOR q IN SELECT * FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb)) LOOP
    INSERT INTO interview_questions(course_id, placement_id, question_text, round, difficulty)
    VALUES ((q->>'course_id')::int, p_placement_id, q->>'text',
            COALESCE(q->>'round', 'technical'), COALESCE((q->>'difficulty')::int, 3));
  END LOOP;

  FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(p_activities, '[]'::jsonb)) LOOP
    INSERT INTO extra_activities(student_id, course_id, type, platform, hours_spent)
    VALUES (sid, (a->>'course_id')::int, a->>'type', a->>'platform', (a->>'hours')::numeric);
  END LOOP;
END $$;

-- ====================== Auth helper functions (called by the login role only) ======================
CREATE FUNCTION fn_get_login(p_email TEXT)
RETURNS TABLE(user_id INT, password_hash CHAR, role VARCHAR, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.user_id, u.password_hash, u.role,
         COALESCE((SELECT s.name FROM students s WHERE s.user_id = u.user_id),
                  (SELECT f.name FROM faculty f WHERE f.user_id = u.user_id), 'Administrator')::TEXT
  FROM users u WHERE lower(u.email) = lower(p_email)
$$;

-- Self-registration ALWAYS creates a 'student'. There is no role parameter on purpose.
CREATE FUNCTION fn_register_student(p_email TEXT, p_hash TEXT, p_srn TEXT, p_name TEXT,
                                    p_dept_id INT, p_batch_year INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid INT;
BEGIN
  INSERT INTO users(email, password_hash, role) VALUES (lower(p_email), p_hash, 'student') RETURNING user_id INTO uid;
  INSERT INTO students(user_id, srn, name, dept_id, batch_year) VALUES (uid, upper(p_srn), p_name, p_dept_id, p_batch_year);
  RETURN uid;
END $$;

-- Own CGPA only (v_student_cgpa itself is not exposed to application roles)
CREATE FUNCTION fn_my_cgpa() RETURNS TABLE(cgpa NUMERIC, courses_graded BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.cgpa, v.courses_graded FROM v_student_cgpa v WHERE v.student_id = fn_current_student_id()
$$;

-- Student self-enrollment for the current term with strict prerequisite validation (grade >= 6)
CREATE PROCEDURE sp_enroll_student(p_course_id INT, p_term TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid INT := fn_current_student_id();
  v_active BOOLEAN;
BEGIN
  IF sid IS NULL THEN
    RAISE EXCEPTION 'No student profile for the current user' USING ERRCODE = '42501';
  END IF;
  SELECT is_active INTO v_active FROM courses WHERE course_id = p_course_id;
  IF v_active IS NULL OR NOT v_active THEN
    RAISE EXCEPTION 'Course % is not available for enrollment', p_course_id USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM enrollments WHERE student_id = sid AND course_id = p_course_id) THEN
    RAISE EXCEPTION 'Already enrolled in or completed course %', p_course_id USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM course_prerequisites cp
    WHERE cp.course_id = p_course_id
      AND NOT EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.student_id = sid
          AND e.course_id = cp.prereq_id
          AND e.status = 'completed'
          AND e.grade_points >= 6
      )
  ) THEN
    RAISE EXCEPTION 'Cannot enroll: all prerequisites must be completed with grade 6.0 or higher'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO enrollments(student_id, course_id, term, status)
  VALUES (sid, p_course_id, COALESCE(NULLIF(trim(p_term), ''), '2026-ODD'), 'enrolled');
END $$;

-- Password change for signed-in user
CREATE PROCEDURE sp_change_password(p_new_hash TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid INT := fn_current_user_id();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF p_new_hash IS NULL OR length(trim(p_new_hash)) <> 60 THEN
    RAISE EXCEPTION 'Invalid password hash format' USING ERRCODE = '22000';
  END IF;
  UPDATE users SET password_hash = trim(p_new_hash) WHERE user_id = uid;
END $$;

-- Database-backed login lockout: checks failed attempts in last 15 min
CREATE FUNCTION fn_check_login_lockout(p_ip TEXT, p_email TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (COUNT(*) >= 5)
  FROM login_attempts
  WHERE (ip_address = p_ip OR (p_email IS NOT NULL AND lower(email) = lower(p_email)))
    AND success = false
    AND attempted_at > now() - INTERVAL '15 minutes';
$$;

-- Records login attempt and resets failed count on successful authentication
CREATE FUNCTION fn_record_login_attempt(p_ip TEXT, p_email TEXT, p_success BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO login_attempts(ip_address, email, success)
  VALUES (p_ip, lower(p_email), p_success);
  IF p_success THEN
    DELETE FROM login_attempts
     WHERE (ip_address = p_ip OR lower(email) = lower(p_email))
       AND success = false;
  END IF;
END $$;

-- ---------- Exam questions: trigger, view, and procedure ----------
CREATE OR REPLACE FUNCTION trg_exam_question_rules() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enr RECORD;
BEGIN
  IF NEW.enrollment_id IS NOT NULL THEN
    SELECT course_id, status INTO v_enr
    FROM enrollments
    WHERE enrollment_id = NEW.enrollment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Enrollment not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_enr.status = 'dropped' THEN
      RAISE EXCEPTION 'You dropped this course, so you cannot share its exam questions' USING ERRCODE = 'P0001';
    END IF;

    NEW.course_id := v_enr.course_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_question_rules ON exam_questions;
CREATE TRIGGER trg_exam_question_rules
  BEFORE INSERT ON exam_questions
  FOR EACH ROW
  EXECUTE FUNCTION trg_exam_question_rules();

CREATE OR REPLACE VIEW v_exam_questions AS
SELECT
  eq.exam_question_id,
  eq.course_id,
  eq.exam_type,
  COALESCE(e.term, '2025-Spr') AS term,
  eq.question_text,
  eq.marks,
  eq.topic,
  eq.difficulty,
  eq.created_at,
  eq.question_tsv,
  eq.answer_text,
  eq.year,
  eq.semester,
  eq.status,
  eq.contributor_id
FROM exam_questions eq
LEFT JOIN enrollments e ON e.enrollment_id = eq.enrollment_id;

CREATE OR REPLACE PROCEDURE sp_share_exam_questions(
  p_enrollment_id INT,
  p_exam_type     TEXT,
  p_questions     JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
  q JSONB;
BEGIN
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'Add at least one question' USING ERRCODE = 'P0001';
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    INSERT INTO exam_questions(
      enrollment_id,
      exam_type,
      question_text,
      marks,
      topic,
      difficulty
    ) VALUES (
      p_enrollment_id,
      p_exam_type,
      q->>'text',
      NULLIF(q->>'marks', '')::SMALLINT,
      NULLIF(q->>'topic', ''),
      COALESCE(NULLIF(q->>'difficulty', '')::SMALLINT, 3)
    );
  END LOOP;
END;
$$;



-- ---------- Senior Explorer & Tiered Trajectories View ----------
CREATE OR REPLACE VIEW v_senior_tier AS
WITH best_placement AS (
  SELECT DISTINCT ON (p.student_id)
    p.student_id,
    p.placement_id,
    p.package_lpa,
    p.year,
    p.verified,
    c.name AS company_name,
    c.tier AS company_tier,
    jr.title AS role_title
  FROM placements p
  JOIN companies c ON c.company_id = p.company_id
  JOIN job_roles jr ON jr.role_id = p.role_id
  WHERE p.type = 'full_time'
    AND (p.verification_status IS NULL OR p.verification_status != 'rejected')
  ORDER BY p.student_id, (p.verified = true OR p.verification_status = 'verified') DESC, p.package_lpa DESC, p.year DESC
),
internship_counts AS (
  SELECT student_id, COUNT(*) AS internship_count
  FROM placements
  WHERE type = 'internship'
  GROUP BY student_id
),
project_counts AS (
  SELECT student_id, COUNT(*) AS project_count
  FROM projects
  GROUP BY student_id
),
paper_counts AS (
  SELECT student_id, COUNT(*) AS paper_count
  FROM publications
  GROUP BY student_id
),
hackathon_counts AS (
  SELECT student_id,
         COUNT(*) AS total_hackathons,
         COUNT(*) FILTER (WHERE role_status = 'won') AS hackathon_wins
  FROM achievements
  GROUP BY student_id
)
SELECT
  s.student_id,
  sp.senior_code,
  sp.status AS profile_status,
  sp.consent,
  sp.headline,
  sp.linkedin_url,
  sp.show_grades,
  sp.show_placements,
  sp.show_internships,
  sp.show_projects,
  sp.show_prep,
  sp.show_publications,
  sp.show_hackathons,
  sp.profile_views,
  sp.prep_views,
  s.srn,
  s.name AS student_name,
  s.batch_year,
  d.dept_id,
  d.name AS dept_name,
  cg.cgpa,
  bp.package_lpa AS highest_package_lpa,
  CASE
    WHEN bp.package_lpa >= 50.00 THEN '50+ LPA'
    WHEN bp.package_lpa >= 35.00 THEN '35-50 LPA'
    WHEN bp.package_lpa >= 20.00 THEN '20-35 LPA'
    WHEN bp.package_lpa >= 12.00 THEN '12-20 LPA'
    WHEN bp.package_lpa >= 5.00  THEN '5-12 LPA'
    ELSE 'Below 5 LPA'
  END AS tier_name,
  bp.company_name,
  bp.company_tier,
  bp.role_title,
  COALESCE(ic.internship_count, 0) AS internship_count,
  COALESCE(pc.project_count, 0) AS project_count,
  COALESCE(pbc.paper_count, 0) AS paper_count,
  COALESCE(hc.hackathon_wins, 0) AS hackathon_wins,
  COALESCE(hc.total_hackathons, 0) AS total_hackathons
FROM students s
JOIN users u ON u.user_id = s.user_id AND u.role IN ('senior', 'student')
JOIN departments d ON d.dept_id = s.dept_id
LEFT JOIN senior_profiles sp ON sp.student_id = s.student_id
LEFT JOIN v_student_cgpa cg ON cg.student_id = s.student_id
LEFT JOIN best_placement bp ON bp.student_id = s.student_id
LEFT JOIN internship_counts ic ON ic.student_id = s.student_id
LEFT JOIN project_counts pc ON pc.student_id = s.student_id
LEFT JOIN paper_counts pbc ON pbc.student_id = s.student_id
LEFT JOIN hackathon_counts hc ON hc.student_id = s.student_id
WHERE sp.senior_code IS NOT NULL;
