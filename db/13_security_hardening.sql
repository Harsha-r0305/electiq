-- ElectIQ :: 13_security_hardening.sql
-- Complete DBMS Hardening, Least Privilege RBAC, Final RLS Security Model,
-- Stored Procedure & Trigger Guard Enforcement, and Privacy-Safe Views.

-- ============================================================================
-- PART 1: REVOKE ALL INDISCRIMINATE / EXCESSIVE GRANTS
-- ============================================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_student, app_senior, app_faculty, app_login, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_student, app_senior, app_faculty, app_login, PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM app_student, app_senior, app_faculty, app_login, PUBLIC;

-- Ensure schema usage is permitted for database connection roles
GRANT USAGE ON SCHEMA public TO app_login, app_student, app_senior, app_faculty, app_admin;

-- ============================================================================
-- PART 2: DROP ALL EXISTING RLS POLICIES TO PREVENT OVER-PERMISSIVE 'OR' COMBINATIONS
-- ============================================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================================
-- PART 3: ENABLE ROW LEVEL SECURITY ON ALL SENSITIVE TABLES
-- ============================================================================
ALTER TABLE users                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE students                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE senior_profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE placements                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_activities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_prep              ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_skills              ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications                ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements                ENABLE ROW LEVEL SECURITY;
ALTER TABLE returned_items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_reviews             ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts              ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: DEFINE RIGOROUS AND UNIFIED ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- 1. USERS
-- Admin can view all users. Individual students, seniors, and faculty can only view their own user account.
CREATE POLICY users_admin ON users FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY users_own ON users FOR SELECT TO app_student, app_senior, app_faculty
  USING (user_id = fn_current_user_id());

-- 2. AUDIT LOG & LOGIN ATTEMPTS
-- Strictly administrator only. Students, seniors, and faculty cannot read audit logs or login attempts.
CREATE POLICY audit_log_admin ON audit_log FOR SELECT TO app_admin
  USING (true);

CREATE POLICY login_attempts_admin ON login_attempts FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

-- 3. STUDENTS
-- Admin has full access. Faculty can view students in their department.
-- Students and seniors can view their own profile, or published consenting senior student summaries.
CREATE POLICY students_admin ON students FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY students_faculty ON students FOR SELECT TO app_faculty
  USING (dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id()));

CREATE POLICY students_own ON students FOR SELECT TO app_student, app_senior
  USING (
    user_id = fn_current_user_id()
    OR student_id = fn_current_student_id()
    OR student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE sp.status = 'published' AND sp.consent = true
    )
  );

CREATE POLICY students_own_update ON students FOR UPDATE TO app_student, app_senior
  USING (user_id = fn_current_user_id())
  WITH CHECK (user_id = fn_current_user_id());

-- 4. ENROLLMENTS
-- Admin has full access. Faculty can view enrollments for their assigned courses or department students.
-- Students and seniors can ONLY view their own enrollments, or published consenting senior enrollments where show_grades is true.
-- DIRECT INSERT/UPDATE/DELETE IS FORBIDDEN FOR STUDENTS/SENIORS (Enrollment is via sp_enroll_student).
CREATE POLICY enrollments_admin ON enrollments FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY enrollments_faculty ON enrollments FOR SELECT TO app_faculty
  USING (
    course_id IN (SELECT course_id FROM courses WHERE faculty_id IN (SELECT faculty_id FROM faculty WHERE user_id = fn_current_user_id()))
    OR student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id()))
  );

CREATE POLICY enrollments_own ON enrollments FOR SELECT TO app_student, app_senior
  USING (student_id = fn_current_student_id());

-- 5. SENIOR PROFILES
-- Admin has full access. Faculty can view department seniors and submit academic review notes.
-- Seniors can view and edit their own profile.
-- Students and the public can ONLY view published profiles where consent = true.
CREATE POLICY sp_admin ON senior_profiles FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY sp_faculty_select ON senior_profiles FOR SELECT TO app_faculty
  USING (
    student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id()))
    OR (status = 'published' AND consent = true)
  );

CREATE POLICY sp_faculty_update ON senior_profiles FOR UPDATE TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())))
  WITH CHECK (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));

CREATE POLICY sp_own ON senior_profiles FOR ALL TO app_senior
  USING (student_id = fn_current_student_id())
  WITH CHECK (student_id = fn_current_student_id());

CREATE POLICY sp_public ON senior_profiles FOR SELECT TO app_student
  USING (status = 'published' AND consent = true);

-- 6. PLACEMENTS
-- Admin has full access. Faculty can view department student placements.
-- Seniors can view and manage their own placement submissions.
-- Students can only view verified placements belonging to published, consenting seniors where show_placements is true.
CREATE POLICY placements_admin ON placements FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY placements_faculty ON placements FOR SELECT TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));

CREATE POLICY placements_own ON placements FOR ALL TO app_senior
  USING (student_id = fn_current_student_id())
  WITH CHECK (student_id = fn_current_student_id());

CREATE POLICY placements_public ON placements FOR SELECT TO app_student
  USING (
    verified = true AND COALESCE(verification_status, 'verified') = 'verified'
    AND student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE sp.status = 'published' AND sp.consent = true AND COALESCE(sp.show_placements, true) = true
    )
  );

-- 7. FEEDBACK
-- Admin has full access. Faculty can review feedback on their assigned courses or department electives.
-- Seniors can view and edit their own elective feedback.
-- Students can ONLY view approved, non-hidden feedback from published consenting seniors.
CREATE POLICY feedback_admin ON feedback FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

CREATE POLICY feedback_faculty ON feedback FOR ALL TO app_faculty
  USING (
    enrollment_id IN (
      SELECT e.enrollment_id FROM enrollments e
      JOIN courses c ON c.course_id = e.course_id
      WHERE c.faculty_id IN (SELECT faculty_id FROM faculty WHERE user_id = fn_current_user_id())
         OR c.dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())
    )
  )
  WITH CHECK (
    enrollment_id IN (
      SELECT e.enrollment_id FROM enrollments e
      JOIN courses c ON c.course_id = e.course_id
      WHERE c.faculty_id IN (SELECT faculty_id FROM faculty WHERE user_id = fn_current_user_id())
         OR c.dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())
    )
  );

CREATE POLICY feedback_own ON feedback FOR ALL TO app_senior
  USING (EXISTS (SELECT 1 FROM enrollments e WHERE e.enrollment_id = feedback.enrollment_id AND e.student_id = fn_current_student_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM enrollments e WHERE e.enrollment_id = feedback.enrollment_id AND e.student_id = fn_current_student_id()));

CREATE POLICY feedback_public ON feedback FOR SELECT TO app_student
  USING (
    NOT is_hidden
    AND COALESCE(moderation_status, 'approved') = 'approved'
    AND enrollment_id IN (
      SELECT e.enrollment_id FROM enrollments e
      JOIN senior_profiles sp ON sp.student_id = e.student_id
      WHERE sp.status = 'published' AND sp.consent = true
    )
  );

-- 8. PROJECTS & PROJECT SKILLS
CREATE POLICY projects_admin ON projects FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY projects_faculty ON projects FOR ALL TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())))
  WITH CHECK (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));
CREATE POLICY projects_own ON projects FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY projects_public ON projects FOR SELECT TO app_student
  USING (
    COALESCE(moderation_status, 'approved') = 'approved'
    AND student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE sp.status = 'published' AND sp.consent = true AND COALESCE(sp.show_projects, true) = true
    )
  );

CREATE POLICY pskills_admin ON project_skills FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY pskills_own ON project_skills FOR ALL TO app_senior
  USING (project_id IN (SELECT project_id FROM projects WHERE student_id = fn_current_student_id()))
  WITH CHECK (project_id IN (SELECT project_id FROM projects WHERE student_id = fn_current_student_id()));
CREATE POLICY pskills_public ON project_skills FOR SELECT TO app_student, app_faculty
  USING (
    project_id IN (
      SELECT p.project_id FROM projects p
      JOIN senior_profiles sp ON sp.student_id = p.student_id
      WHERE COALESCE(p.moderation_status, 'approved') = 'approved'
        AND sp.status = 'published' AND sp.consent = true
    )
  );

-- 9. PUBLICATIONS
CREATE POLICY pub_admin ON publications FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY pub_faculty ON publications FOR ALL TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())))
  WITH CHECK (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));
CREATE POLICY pub_own ON publications FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY pub_public ON publications FOR SELECT TO app_student
  USING (
    COALESCE(moderation_status, 'approved') = 'approved'
    AND student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE sp.status = 'published' AND sp.consent = true AND COALESCE(sp.show_publications, true) = true
    )
  );

-- 10. ACHIEVEMENTS (HACKATHONS)
CREATE POLICY ach_admin ON achievements FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY ach_faculty ON achievements FOR ALL TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())))
  WITH CHECK (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));
CREATE POLICY ach_own ON achievements FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY ach_public ON achievements FOR SELECT TO app_student
  USING (
    COALESCE(moderation_status, 'approved') = 'approved'
    AND student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE sp.status = 'published' AND sp.consent = true AND COALESCE(sp.show_hackathons, true) = true
    )
  );

-- 11. EXTRA ACTIVITIES (COURSE PREPARATION)
CREATE POLICY activities_admin ON extra_activities FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY activities_faculty ON extra_activities FOR ALL TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())))
  WITH CHECK (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));
CREATE POLICY activities_own ON extra_activities FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY activities_public ON extra_activities FOR SELECT TO app_student
  USING (
    COALESCE(moderation_status, 'approved') = 'approved'
    AND student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE sp.status = 'published' AND sp.consent = true
    )
  );

-- 12. INTERVIEW PREP
CREATE POLICY prep_admin ON interview_prep FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY prep_faculty ON interview_prep FOR ALL TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())))
  WITH CHECK (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));
CREATE POLICY prep_own ON interview_prep FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY prep_public ON interview_prep FOR SELECT TO app_student
  USING (
    COALESCE(moderation_status, 'approved') = 'approved'
    AND student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE sp.status = 'published' AND sp.consent = true AND COALESCE(sp.show_prep, true) = true
    )
  );

-- 13. INTERVIEW QUESTIONS
CREATE POLICY iq_admin ON interview_questions FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY iq_faculty ON interview_questions FOR SELECT TO app_faculty USING (true);
CREATE POLICY iq_own ON interview_questions FOR ALL TO app_senior
  USING (placement_id IN (SELECT placement_id FROM placements WHERE student_id = fn_current_student_id()))
  WITH CHECK (placement_id IN (SELECT placement_id FROM placements WHERE student_id = fn_current_student_id()));
CREATE POLICY iq_public ON interview_questions FOR SELECT TO app_student
  USING (
    COALESCE(is_hidden, false) = false
    AND (
      placement_id IS NULL
      OR placement_id IN (
        SELECT p.placement_id FROM placements p
        JOIN senior_profiles sp ON sp.student_id = p.student_id
        WHERE p.verified = true AND sp.status = 'published' AND sp.consent = true
      )
    )
  );

-- 14. EXAM QUESTIONS
CREATE POLICY eq_admin ON exam_questions FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY eq_faculty ON exam_questions FOR ALL TO app_faculty
  USING (
    course_id IN (
      SELECT course_id FROM courses
      WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())
         OR faculty_id IN (SELECT faculty_id FROM faculty WHERE user_id = fn_current_user_id())
    )
  );
CREATE POLICY eq_own ON exam_questions FOR ALL TO app_student, app_senior
  USING (
    contributor_id = fn_current_student_id()
    OR enrollment_id IN (SELECT enrollment_id FROM enrollments WHERE student_id = fn_current_student_id())
  )
  WITH CHECK (
    contributor_id = fn_current_student_id()
    OR enrollment_id IN (SELECT enrollment_id FROM enrollments WHERE student_id = fn_current_student_id())
  );
CREATE POLICY eq_public ON exam_questions FOR SELECT TO app_student, app_senior
  USING (status = 'approved');

-- 15. FACULTY REVIEWS
CREATE POLICY freviews_admin ON faculty_reviews FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY freviews_own ON faculty_reviews FOR ALL TO app_faculty
  USING (faculty_id = fn_current_faculty_id())
  WITH CHECK (
    faculty_id = fn_current_faculty_id()
    AND EXISTS (SELECT 1 FROM courses c WHERE c.course_id = faculty_reviews.course_id AND c.faculty_id = faculty_reviews.faculty_id)
  );
CREATE POLICY freviews_public ON faculty_reviews FOR SELECT TO app_student, app_senior USING (true);

-- 16. RETURNED ITEMS
CREATE POLICY ret_admin ON returned_items FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY ret_faculty ON returned_items FOR ALL TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())))
  WITH CHECK (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));
CREATE POLICY ret_own ON returned_items FOR ALL TO app_senior, app_student
  USING (student_id = fn_current_student_id())
  WITH CHECK (student_id = fn_current_student_id());

-- 17. ENTITY REQUESTS
CREATE POLICY req_admin ON entity_requests FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY req_own ON entity_requests FOR ALL TO app_senior
  USING (student_id = fn_current_student_id())
  WITH CHECK (student_id = fn_current_student_id());

-- 18. ACADEMIC CORRECTION REQUESTS
CREATE POLICY acr_admin ON academic_correction_requests FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY acr_faculty ON academic_correction_requests FOR SELECT TO app_faculty
  USING (student_id IN (SELECT student_id FROM students WHERE dept_id IN (SELECT dept_id FROM faculty WHERE user_id = fn_current_user_id())));
CREATE POLICY acr_own ON academic_correction_requests FOR ALL TO app_student, app_senior
  USING (student_id = fn_current_student_id())
  WITH CHECK (student_id = fn_current_student_id());

-- 19. MODERATION REPORTS & ACTIONS
CREATE POLICY mr_admin ON moderation_reports FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY mr_insert ON moderation_reports FOR INSERT TO app_student, app_senior, app_faculty
  WITH CHECK (reporter_id = fn_current_user_id());

CREATE POLICY ma_admin ON moderation_actions FOR ALL TO app_admin USING (true) WITH CHECK (true);

-- ============================================================================
-- PART 5: TABLE-LEVEL AND VIEW-LEVEL GRANTS (LEAST PRIVILEGE)
-- ============================================================================

-- 1. Reference / Master catalog data: readable by all signed-in users
GRANT SELECT ON departments, courses, course_prerequisites, skills, course_skills,
                companies, job_roles, role_skills, role_demand, role_elective_paths,
                package_tiers, market_demand, system_settings, resources, faculty
  TO app_student, app_senior, app_faculty, app_admin;

-- 2. Pre-login role (app_login) - ONLY departments table and login routines
GRANT SELECT ON departments TO app_login;
GRANT EXECUTE ON FUNCTION fn_get_login(TEXT), fn_register_student(TEXT,TEXT,TEXT,TEXT,INT,INT),
                          fn_check_login_lockout(TEXT,TEXT), fn_record_login_attempt(TEXT,TEXT,BOOLEAN)
  TO app_login;

-- 3. Student role (app_student)
GRANT SELECT ON students, enrollments, senior_profiles, placements, feedback,
                projects, project_skills, publications, achievements, extra_activities,
                interview_prep, interview_questions, exam_questions, returned_items,
                academic_correction_requests, faculty_reviews
  TO app_student;

GRANT INSERT, UPDATE ON academic_correction_requests TO app_student;
GRANT INSERT ON moderation_reports TO app_student;
GRANT SELECT, INSERT ON exam_questions TO app_student;

-- 4. Senior role (app_senior) - inherits student reads and adds contribution writes
GRANT SELECT ON students, enrollments, faculty_reviews TO app_senior;
GRANT SELECT, INSERT, UPDATE ON senior_profiles, returned_items, academic_correction_requests TO app_senior;
GRANT SELECT, INSERT, UPDATE, DELETE ON placements, feedback, projects, project_skills,
                                       publications, achievements, extra_activities,
                                       interview_prep, interview_questions, exam_questions, entity_requests
  TO app_senior;
GRANT INSERT ON moderation_reports TO app_senior;

-- 5. Faculty role (app_faculty)
GRANT SELECT ON students, enrollments, senior_profiles, placements, feedback,
                projects, project_skills, publications, achievements, extra_activities,
                interview_prep, interview_questions, exam_questions, returned_items,
                academic_correction_requests
  TO app_faculty;

GRANT SELECT, INSERT, UPDATE ON faculty_reviews TO app_faculty;
GRANT INSERT, UPDATE ON returned_items TO app_faculty;
GRANT INSERT ON moderation_reports TO app_faculty;
GRANT UPDATE (status, faculty_reviewed_by, faculty_notes, faculty_reviewed_at) ON senior_profiles TO app_faculty;
GRANT UPDATE (moderation_status, is_verified, faculty_notes, reviewed_by, reviewed_at) ON feedback TO app_faculty;
GRANT UPDATE (status, review_comment, reviewed_by, reviewed_at) ON exam_questions TO app_faculty;

-- 6. Admin role (app_admin) - full administrative access
GRANT SELECT, INSERT, UPDATE, DELETE ON departments, courses, course_prerequisites, skills,
                                       course_skills, companies, job_roles, role_skills,
                                       role_demand, role_elective_paths, package_tiers,
                                       market_demand, system_settings, resources, faculty,
                                       faculty_reviews, students, enrollments, senior_profiles,
                                       placements, feedback, projects, project_skills,
                                       publications, achievements, extra_activities,
                                       interview_prep, interview_questions, exam_questions,
                                       returned_items, entity_requests, academic_correction_requests,
                                       moderation_reports, moderation_actions,
                                       dashboard_designer_config, graph_related_skills, graph_skill_clusters
  TO app_admin;

GRANT SELECT, INSERT ON users TO app_admin;
GRANT UPDATE (role) ON users TO app_admin;
GRANT SELECT ON audit_log TO app_admin;
GRANT SELECT, DELETE ON login_attempts TO app_admin;

-- ============================================================================
-- PART 6: SEQUENCE PRIVILEGES
-- ============================================================================
GRANT USAGE, SELECT ON SEQUENCE
  academic_correction_requests_request_id_seq,
  moderation_reports_report_id_seq,
  exam_questions_exam_question_id_seq
TO app_student;

GRANT USAGE, SELECT ON SEQUENCE
  feedback_feedback_id_seq,
  placements_placement_id_seq,
  projects_project_id_seq,
  publications_pub_id_seq,
  achievements_achievement_id_seq,
  extra_activities_activity_id_seq,
  interview_prep_prep_id_seq,
  interview_questions_question_id_seq,
  exam_questions_exam_question_id_seq,
  entity_requests_request_id_seq,
  academic_correction_requests_request_id_seq,
  moderation_reports_report_id_seq
TO app_senior;

GRANT USAGE, SELECT ON SEQUENCE
  faculty_reviews_review_id_seq,
  returned_items_notice_id_seq,
  moderation_reports_report_id_seq
TO app_faculty;

GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_admin;

-- ============================================================================
-- PART 7: STORED PROCEDURES & ROUTINES SECURITY
-- ============================================================================

-- Stored Procedure: sp_post_grade (Admin only, SELECT FOR UPDATE concurrency protection)
CREATE OR REPLACE PROCEDURE sp_post_grade(p_enrollment_id INT, p_grade NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  locked INT;
  v_role TEXT := fn_current_role();
BEGIN
  IF current_user <> 'app_admin' AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only administrators can post grades' USING ERRCODE = '42501';
  END IF;
  IF p_grade IS NULL OR p_grade < 0.0 OR p_grade > 10.0 THEN
    RAISE EXCEPTION 'Grade must be between 0.0 and 10.0' USING ERRCODE = '22003';
  END IF;
  SELECT enrollment_id INTO locked FROM enrollments WHERE enrollment_id = p_enrollment_id FOR UPDATE;
  IF locked IS NULL THEN
    RAISE EXCEPTION 'Enrollment % not found', p_enrollment_id USING ERRCODE = 'P0002';
  END IF;
  UPDATE enrollments
     SET grade_points = p_grade, grade_posted_at = now(), status = 'completed'
   WHERE enrollment_id = p_enrollment_id;
END $$;

-- Stored Procedure: sp_enroll_student (Prerequisite check grade >= 6.0, atomic)
CREATE OR REPLACE PROCEDURE sp_enroll_student(p_course_id INT, p_term TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid INT := fn_current_student_id();
  v_role TEXT := fn_current_role();
  v_active BOOLEAN;
BEGIN
  IF sid IS NULL AND v_role <> 'admin' THEN
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

-- Stored Procedure: sp_share_exam_questions (Student & Senior, atomic batch, duplicate resistant)
CREATE OR REPLACE PROCEDURE sp_share_exam_questions(
  p_enrollment_id INT,
  p_exam_type     TEXT,
  p_questions     JSONB
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sid INT := fn_current_student_id();
  v_role TEXT := fn_current_role();
  v_enr RECORD;
  q JSONB;
  v_text TEXT;
  v_marks SMALLINT;
  v_diff SMALLINT;
  v_topic TEXT;
BEGIN
  IF v_sid IS NULL AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Not authorized: must be signed in as student or senior' USING ERRCODE = '42501';
  END IF;

  IF p_exam_type NOT IN ('ISA1', 'ISA2', 'ESA') THEN
    RAISE EXCEPTION 'Invalid exam type: % (must be ISA1, ISA2, or ESA)', p_exam_type USING ERRCODE = '22000';
  END IF;

  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) = 0 THEN
    RAISE EXCEPTION 'Must provide at least one question' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_array_length(p_questions) > 10 THEN
    RAISE EXCEPTION 'Cannot share more than 10 questions in a single batch' USING ERRCODE = 'P0001';
  END IF;

  SELECT enrollment_id, course_id, student_id, status INTO v_enr
  FROM enrollments
  WHERE enrollment_id = p_enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment % not found', p_enrollment_id USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'admin' AND v_enr.student_id <> v_sid THEN
    RAISE EXCEPTION 'You can only share exam questions for your own enrolled courses' USING ERRCODE = '42501';
  END IF;

  IF v_enr.status = 'dropped' THEN
    RAISE EXCEPTION 'Cannot share questions for a dropped course' USING ERRCODE = 'P0001';
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    v_text := trim(q->>'text');
    IF v_text IS NULL OR length(v_text) < 10 OR length(v_text) > 800 THEN
      RAISE EXCEPTION 'Question text must be between 10 and 800 characters' USING ERRCODE = '22000';
    END IF;

    v_marks := NULLIF(q->>'marks', '')::SMALLINT;
    IF v_marks IS NOT NULL AND (v_marks < 1 OR v_marks > 100) THEN
      RAISE EXCEPTION 'Marks must be between 1 and 100' USING ERRCODE = '22000';
    END IF;

    v_diff := COALESCE(NULLIF(q->>'difficulty', '')::SMALLINT, 3);
    IF v_diff < 1 OR v_diff > 5 THEN v_diff := 3; END IF;

    v_topic := NULLIF(trim(q->>'topic'), '');

    INSERT INTO exam_questions(
      enrollment_id, course_id, exam_type, question_text, marks, topic, difficulty, status, contributor_id
    ) VALUES (
      p_enrollment_id, v_enr.course_id, p_exam_type, v_text, v_marks, v_topic, v_diff, 'pending', v_sid
    )
    ON CONFLICT (enrollment_id, exam_type, lower(question_text)) DO NOTHING;
  END LOOP;
END;
$$;

-- Stored Procedure: sp_submit_feedback (Guards enrollment ownership & grade posted)
CREATE OR REPLACE PROCEDURE sp_submit_feedback(
  p_enrollment_id INT, p_difficulty INT, p_workload INT, p_usefulness INT, p_text TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sid INT := fn_current_student_id();
  v_role TEXT := fn_current_role();
  v_enr RECORD;
BEGIN
  IF v_sid IS NULL AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Not authenticated as a student/senior' USING ERRCODE = '42501';
  END IF;

  SELECT enrollment_id, student_id, grade_points INTO v_enr
  FROM enrollments WHERE enrollment_id = p_enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment % not found', p_enrollment_id USING ERRCODE = 'P0002';
  END IF;

  IF v_role <> 'admin' AND v_enr.student_id <> v_sid THEN
    RAISE EXCEPTION 'Unauthorized: feedback can only be submitted for your own enrollments' USING ERRCODE = '42501';
  END IF;

  IF v_enr.grade_points IS NULL THEN
    RAISE EXCEPTION 'Feedback not allowed: the grade for this enrollment has not been posted yet' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO feedback(enrollment_id, difficulty, workload, usefulness, review_text, moderation_status, is_verified)
  VALUES (p_enrollment_id, p_difficulty, p_workload, p_usefulness, NULLIF(trim(p_text), ''), 'pending', false)
  ON CONFLICT (enrollment_id) DO UPDATE SET
    difficulty = EXCLUDED.difficulty,
    workload = EXCLUDED.workload,
    usefulness = EXCLUDED.usefulness,
    review_text = EXCLUDED.review_text,
    moderation_status = 'pending',
    is_verified = false;
END $$;

-- Stored Procedure: sp_change_password
CREATE OR REPLACE PROCEDURE sp_change_password(p_new_hash TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid INT := fn_current_user_id();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF p_new_hash IS NULL OR length(trim(p_new_hash)) <> 60 THEN
    RAISE EXCEPTION 'Invalid password hash format' USING ERRCODE = '22000';
  END IF;
  UPDATE users SET password_hash = trim(p_new_hash) WHERE user_id = uid;
END $$;

-- Routine Execution Grants
GRANT EXECUTE ON PROCEDURE sp_enroll_student(INT, TEXT), sp_change_password(TEXT), sp_share_exam_questions(INT, TEXT, JSONB) TO app_student, app_senior;
GRANT EXECUTE ON PROCEDURE sp_submit_feedback(INT,INT,INT,INT,TEXT), sp_record_placement(INT,INT,TEXT,NUMERIC,INT,JSONB,JSONB,INT) TO app_senior;
GRANT EXECUTE ON PROCEDURE sp_post_grade(INT, NUMERIC) TO app_admin;
GRANT EXECUTE ON PROCEDURE sp_change_password(TEXT) TO app_faculty, app_admin;

GRANT EXECUTE ON FUNCTION fn_current_user_id(), fn_current_role(), fn_current_student_id(), fn_current_faculty_id(),
                          fn_my_cgpa(), fn_next_electives(INT, NUMERIC), fn_cgpa_boost(INT), fn_prereq_chain(INT),
                          fn_skill_coverage(INT), fn_course_difficulty(INT), fn_placement_stats(INT),
                          fn_increment_senior_views(TEXT)
  TO app_student, app_senior, app_faculty, app_admin;

-- ============================================================================
-- PART 8: DATABASE TRIGGER GUARDS (PROTECT GRADES & PUBLISHING INTEGRITY)
-- ============================================================================

-- Guard 1: Direct Grade Tampering Protection on Enrollments
CREATE OR REPLACE FUNCTION trg_enrollments_grade_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT := fn_current_role();
BEGIN
  IF current_user IN ('app_student', 'app_senior') OR v_role IN ('student', 'senior') THEN
    IF TG_OP = 'UPDATE' THEN
      IF (NEW.grade_points IS DISTINCT FROM OLD.grade_points) OR
         (NEW.grade_posted_at IS DISTINCT FROM OLD.grade_posted_at) OR
         (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed') THEN
        RAISE EXCEPTION 'Unauthorized: Students and seniors cannot modify official grades or completion status'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_OP = 'INSERT' THEN
      IF NEW.grade_points IS NOT NULL OR NEW.grade_posted_at IS NOT NULL OR NEW.status = 'completed' THEN
        RAISE EXCEPTION 'Unauthorized: Enrollments cannot be created with grades or completed status directly'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.status = 'completed' OR OLD.grade_points IS NOT NULL THEN
        RAISE EXCEPTION 'Unauthorized: Completed academic records cannot be deleted'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enrollments_grade_guard ON enrollments;
CREATE TRIGGER enrollments_grade_guard
  BEFORE INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION trg_enrollments_grade_guard();

-- Guard 2: Senior Profile Publishing Guard (Senior cannot publish; faculty cannot publish; admin requires consent)
CREATE OR REPLACE FUNCTION trg_senior_profile_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT := fn_current_role();
BEGIN
  -- 1. Admin decisions
  IF current_user = 'app_admin' OR v_role = 'admin' THEN
    IF NEW.status = 'published' AND OLD.consent IS NOT TRUE AND NEW.consent IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot publish senior profile without explicit senior consent'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- 2. Faculty decisions (Faculty can endorse or request changes, but cannot publish)
  IF current_user = 'app_faculty' OR v_role = 'faculty' THEN
    IF NEW.status = 'published' THEN
      RAISE EXCEPTION 'Faculty cannot publish senior profiles'
        USING ERRCODE = '42501';
    END IF;
    NEW.student_id := OLD.student_id;
    NEW.senior_code := OLD.senior_code;
    NEW.published_at := OLD.published_at;
    RETURN NEW;
  END IF;

  -- 3. Senior actions
  IF current_user = 'app_senior' OR v_role = 'senior' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'draft';
      NEW.published_at := NULL; NEW.reviewed_by := NULL; NEW.review_notes := NULL;
      NEW.faculty_reviewed_by := NULL; NEW.faculty_notes := NULL; NEW.faculty_reviewed_at := NULL;
      RETURN NEW;
    END IF;

    -- Staff-owned review columns are immutable for seniors
    NEW.published_at := OLD.published_at;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.review_notes := OLD.review_notes;
    NEW.faculty_reviewed_by := OLD.faculty_reviewed_by;
    NEW.faculty_notes := OLD.faculty_notes;
    NEW.faculty_reviewed_at := OLD.faculty_reviewed_at;
    NEW.student_id := OLD.student_id;
    NEW.senior_code := OLD.senior_code;

    -- Seniors can never set published or approved statuses
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('published', 'faculty_approved', 'approved') THEN
      RAISE EXCEPTION 'Access denied: only an administrator can publish senior profiles'
        USING ERRCODE = '42501';
    END IF;

    -- If a senior profile is published, ANY edit by senior automatically reverts status to 'submitted' for re-review
    IF OLD.status = 'published' THEN
      NEW.status := 'submitted';
      NEW.submitted_at := now();
    ELSIF NEW.status IN ('published', 'faculty_approved', 'approved') THEN
      RAISE EXCEPTION 'Access denied: only an administrator can publish senior profiles'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'submitted' AND OLD.status IN ('draft', 'changes_requested', 'rejected', 'submitted', 'published') THEN
        NEW.submitted_at := now();
      ELSIF NEW.status = 'draft' AND OLD.status IN ('published', 'submitted', 'changes_requested') THEN
        NULL; -- Senior withdraws profile
      ELSE
        NEW.status := OLD.status;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS senior_profile_guard ON senior_profiles;
CREATE TRIGGER senior_profile_guard
  BEFORE INSERT OR UPDATE ON senior_profiles
  FOR EACH ROW EXECUTE FUNCTION trg_senior_profile_guard();

-- Guard 3: Senior Item Pending Guard (Senior edits revert to pending; staff edits are preserved)
CREATE OR REPLACE FUNCTION trg_senior_item_pending() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_role TEXT := fn_current_role();
BEGIN
  IF (current_user IN ('app_senior', 'app_student') OR v_role IN ('senior', 'student'))
     AND current_user NOT IN ('app_admin', 'app_faculty') AND v_role NOT IN ('admin', 'faculty') THEN
    CASE TG_TABLE_NAME
      WHEN 'placements' THEN
        NEW.verified := false; NEW.verification_status := 'pending';
        NEW.verified_by := NULL; NEW.verified_at := NULL;
      WHEN 'feedback' THEN
        NEW.is_verified := false; NEW.moderation_status := 'pending';
        NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
      WHEN 'exam_questions' THEN
        NEW.status := 'pending';
        NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
      ELSE
        NEW.moderation_status := 'pending';
        NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    END CASE;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['placements','feedback','exam_questions','projects','publications',
                           'achievements','extra_activities','interview_prep','resources'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS senior_item_pending ON %I', t);
    EXECUTE format('CREATE TRIGGER senior_item_pending BEFORE INSERT OR UPDATE ON %I
                    FOR EACH ROW EXECUTE FUNCTION trg_senior_item_pending()', t);
  END LOOP;
END $$;

-- ============================================================================
-- PART 9: DROP AND RECREATE SYNCHRONIZED, PRIVACY-SAFE DATABASE VIEWS
-- ============================================================================

-- Drop views in reverse dependency order
DROP VIEW IF EXISTS v_course_comparison CASCADE;
DROP VIEW IF EXISTS v_course_summary CASCADE;
DROP VIEW IF EXISTS v_placement_analytics CASCADE;
DROP VIEW IF EXISTS v_course_stats CASCADE;
DROP VIEW IF EXISTS v_course_feedback CASCADE;
DROP VIEW IF EXISTS v_course_placements CASCADE;
DROP VIEW IF EXISTS v_course_preparation CASCADE;
DROP VIEW IF EXISTS v_exam_questions CASCADE;
DROP VIEW IF EXISTS v_senior_tier CASCADE;
DROP VIEW IF EXISTS v_student_cgpa CASCADE;
DROP VIEW IF EXISTS v_faculty_reviews CASCADE;
DROP VIEW IF EXISTS v_department_dashboard CASCADE;
DROP VIEW IF EXISTS v_skill_gap CASCADE;

-- 1. Student CGPA view (security_invoker ensures calling student only sees own record)
CREATE VIEW v_student_cgpa WITH (security_invoker = true) AS
SELECT s.student_id,
       ROUND(SUM(e.grade_points * c.credits) / NULLIF(SUM(c.credits), 0), 2) AS cgpa,
       COUNT(e.enrollment_id) AS courses_graded
FROM students s
LEFT JOIN enrollments e ON e.student_id = s.student_id
     AND e.status = 'completed' AND e.grade_points IS NOT NULL
LEFT JOIN courses c ON c.course_id = e.course_id
GROUP BY s.student_id;

-- 2. Course Feedback view (anonymous display, approved & published consenting seniors only)
CREATE VIEW v_course_feedback AS
SELECT f.feedback_id,
       e.course_id,
       f.difficulty,
       f.workload,
       f.usefulness,
       f.review_text,
       f.review_tsv,
       f.created_at,
       s.batch_year,
       sp.senior_code,
       COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS display_name,
       COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS student_name,
       CASE WHEN COALESCE(sp.show_grades, true) THEN e.grade_points END AS grade_points,
       f.placement_help,
       f.extra_prep_needed,
       f.recommended_resources,
       f.advice_for_juniors,
       CASE WHEN COALESCE(sp.show_placements, true) THEN pl.company_name END AS company_name,
       CASE WHEN COALESCE(sp.show_placements, true) THEN pl.package_lpa END AS package_lpa,
       CASE WHEN COALESCE(sp.show_placements, true) THEN pl.role_title END AS role_title
FROM feedback f
JOIN enrollments e ON e.enrollment_id = f.enrollment_id
JOIN students s    ON s.student_id = e.student_id
JOIN senior_profiles sp ON sp.student_id = s.student_id
LEFT JOIN LATERAL (
  SELECT p.package_lpa, cmp.name AS company_name, jr.title AS role_title
  FROM placements p
  JOIN companies cmp ON cmp.company_id = p.company_id
  JOIN job_roles jr  ON jr.role_id = p.role_id
  WHERE p.student_id = s.student_id AND p.type = 'full_time'
    AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'
  ORDER BY p.package_lpa DESC NULLS LAST
  LIMIT 1
) pl ON TRUE
WHERE NOT f.is_hidden
  AND COALESCE(f.moderation_status, 'approved') = 'approved'
  AND sp.status = 'published' AND sp.consent = true;

-- 3. Course Placements view (verified offers of published, consenting seniors)
CREATE VIEW v_course_placements AS
SELECT e.course_id, p.placement_id, p.student_id, p.type, p.package_lpa, p.year
FROM placements p
JOIN enrollments e ON e.student_id = p.student_id
JOIN senior_profiles sp ON sp.student_id = p.student_id
WHERE e.status = 'completed' AND e.grade_points IS NOT NULL
  AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'
  AND sp.status = 'published' AND sp.consent = true;

-- 4. Course Preparation view
CREATE VIEW v_course_preparation AS
SELECT ea.course_id, ea.type, ea.platform, COUNT(*) AS seniors, ROUND(AVG(ea.hours_spent), 1) AS avg_hours
FROM extra_activities ea
JOIN senior_profiles sp ON sp.student_id = ea.student_id
WHERE COALESCE(ea.moderation_status, 'approved') = 'approved'
  AND sp.status = 'published' AND sp.consent = true
GROUP BY ea.course_id, ea.type, ea.platform;

-- 5. Exam Questions view (only approved questions; anonymous contributor display)
CREATE VIEW v_exam_questions AS
SELECT eq.exam_question_id, eq.course_id, eq.exam_type,
       COALESCE(e.term, '2025-Spr') AS term,
       eq.question_text, eq.marks, eq.topic, eq.difficulty, eq.created_at, eq.question_tsv,
       eq.answer_text, eq.year, eq.semester, eq.status, eq.contributor_id,
       CASE
         WHEN sp.senior_code IS NOT NULL AND sp.status = 'published' AND sp.consent = true THEN sp.senior_code
         ELSE NULL
       END AS contributor_code
FROM exam_questions eq
LEFT JOIN enrollments e ON e.enrollment_id = eq.enrollment_id
LEFT JOIN senior_profiles sp ON sp.student_id = eq.contributor_id
WHERE COALESCE(eq.status, 'approved') = 'approved';

-- 6. Senior Tier View (Privacy safe: no raw SRN exposed; only published & consenting seniors)
CREATE VIEW v_senior_tier AS
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
    AND p.verified = true
    AND COALESCE(p.verification_status, 'verified') = 'verified'
  ORDER BY p.student_id, p.package_lpa DESC, p.year DESC
),
internship_counts AS (
  SELECT student_id, COUNT(*) AS internship_count
  FROM placements
  WHERE type = 'internship' AND verified = true
  GROUP BY student_id
),
project_counts AS (
  SELECT student_id, COUNT(*) AS project_count
  FROM projects
  WHERE COALESCE(moderation_status, 'approved') = 'approved'
  GROUP BY student_id
),
paper_counts AS (
  SELECT student_id, COUNT(*) AS paper_count
  FROM publications
  WHERE COALESCE(moderation_status, 'approved') = 'approved'
  GROUP BY student_id
),
hackathon_counts AS (
  SELECT student_id,
         COUNT(*) AS total_hackathons,
         COUNT(*) FILTER (WHERE role_status = 'won') AS hackathon_wins
  FROM achievements
  WHERE COALESCE(moderation_status, 'approved') = 'approved'
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
  NULL::varchar AS srn,
  COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS display_name,
  COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code) AS student_name,
  s.batch_year,
  d.dept_id,
  d.name AS dept_name,
  CASE WHEN COALESCE(sp.show_grades, true) THEN cg.cgpa ELSE NULL END AS cgpa,
  CASE WHEN COALESCE(sp.show_placements, true) THEN bp.package_lpa ELSE NULL END AS highest_package_lpa,
  CASE
    WHEN bp.package_lpa >= 50.00 THEN '50+ LPA'
    WHEN bp.package_lpa >= 35.00 THEN '35-50 LPA'
    WHEN bp.package_lpa >= 20.00 THEN '20-35 LPA'
    WHEN bp.package_lpa >= 12.00 THEN '12-20 LPA'
    WHEN bp.package_lpa >= 5.00  THEN '5-12 LPA'
    ELSE 'Below 5 LPA'
  END AS tier_name,
  CASE WHEN COALESCE(sp.show_placements, true) THEN bp.company_name ELSE NULL END AS company_name,
  bp.company_tier,
  CASE WHEN COALESCE(sp.show_placements, true) THEN bp.role_title ELSE NULL END AS role_title,
  CASE WHEN COALESCE(sp.show_internships, true) THEN COALESCE(ic.internship_count, 0) ELSE 0 END AS internship_count,
  CASE WHEN COALESCE(sp.show_projects, true) THEN COALESCE(pc.project_count, 0) ELSE 0 END AS project_count,
  CASE WHEN COALESCE(sp.show_publications, true) THEN COALESCE(pbc.paper_count, 0) ELSE 0 END AS paper_count,
  CASE WHEN COALESCE(sp.show_hackathons, true) THEN COALESCE(hc.hackathon_wins, 0) ELSE 0 END AS hackathon_wins,
  CASE WHEN COALESCE(sp.show_hackathons, true) THEN COALESCE(hc.total_hackathons, 0) ELSE 0 END AS total_hackathons
FROM students s
JOIN senior_profiles sp ON sp.student_id = s.student_id
JOIN departments d ON d.dept_id = s.dept_id
LEFT JOIN v_student_cgpa cg ON cg.student_id = s.student_id
LEFT JOIN best_placement bp ON bp.student_id = s.student_id
LEFT JOIN internship_counts ic ON ic.student_id = s.student_id
LEFT JOIN project_counts pc ON pc.student_id = s.student_id
LEFT JOIN paper_counts pbc ON pbc.student_id = s.student_id
LEFT JOIN hackathon_counts hc ON hc.student_id = s.student_id
WHERE sp.senior_code IS NOT NULL
  AND sp.status = 'published' AND sp.consent = true;

-- 7. Course Stats view
CREATE VIEW v_course_stats AS
SELECT
  c.course_id,
  ROUND(AVG(f.difficulty)::numeric, 1) AS avg_difficulty,
  ROUND(AVG(f.workload)::numeric, 1) AS avg_workload,
  ROUND(AVG(f.usefulness)::numeric, 1) AS avg_usefulness,
  COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.status = 'published' AND sp.consent = true) AS verified_seniors_count,
  COUNT(DISTINCT p.placement_id) FILTER (WHERE p.type = 'full_time' AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified' AND sp.status = 'published' AND sp.consent = true) AS verified_placements_count,
  ROUND(AVG(p.package_lpa) FILTER (WHERE p.type = 'full_time' AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified' AND sp.status = 'published' AND sp.consent = true)::numeric, 1) AS avg_package_lpa
FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.course_id
LEFT JOIN feedback f ON f.enrollment_id = e.enrollment_id AND NOT f.is_hidden AND COALESCE(f.moderation_status, 'approved') = 'approved'
LEFT JOIN senior_profiles sp ON sp.student_id = e.student_id AND sp.status = 'published' AND sp.consent = true
LEFT JOIN placements p ON p.student_id = e.student_id AND p.type = 'full_time' AND p.verified = true
GROUP BY c.course_id;

-- 8. Faculty Reviews view
CREATE VIEW v_faculty_reviews AS
SELECT fr.course_id, f.name AS faculty_name, fr.relevance, fr.future_scope, fr.comment
FROM faculty_reviews fr JOIN faculty f ON f.faculty_id = fr.faculty_id;

-- 9. Course Summary view
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

-- 10. Course Comparison view
CREATE VIEW v_course_comparison AS
SELECT s.*,
       (SELECT COUNT(*) FROM course_skills cs WHERE cs.course_id = s.course_id) AS skill_count,
       (SELECT string_agg(sk.name, ', ' ORDER BY cs.depth DESC, sk.name)
          FROM course_skills cs JOIN skills sk ON sk.skill_id = cs.skill_id
         WHERE cs.course_id = s.course_id) AS skills
FROM v_course_summary s;

-- 11. Placement Analytics view
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

-- 12. Department Dashboard view
CREATE VIEW v_department_dashboard AS
SELECT d.dept_id, d.name AS department,
       (SELECT COUNT(*) FROM students s WHERE s.dept_id = d.dept_id) AS students,
       (SELECT COUNT(*) FROM courses c WHERE c.dept_id = d.dept_id) AS courses,
       (SELECT COUNT(*) FROM enrollments e JOIN courses c ON c.course_id = e.course_id
         WHERE c.dept_id = d.dept_id) AS enrollments,
       (SELECT ROUND(AVG(e.grade_points), 2) FROM enrollments e JOIN courses c ON c.course_id = e.course_id
         WHERE c.dept_id = d.dept_id) AS avg_grade,
       (SELECT COUNT(DISTINCT p.placement_id) FROM placements p JOIN students s ON s.student_id = p.student_id
         WHERE s.dept_id = d.dept_id AND p.type = 'full_time' AND p.verified = true) AS fulltime_placements,
       (SELECT ROUND(AVG(p.package_lpa), 2) FROM placements p JOIN students s ON s.student_id = p.student_id
         WHERE s.dept_id = d.dept_id AND p.type = 'full_time' AND p.verified = true) AS avg_package
FROM departments d;

-- 13. Skill Gap view
CREATE VIEW v_skill_gap AS
SELECT sk.skill_id, sk.name, sk.category, md.year, md.postings_count, md.demand_score,
       (SELECT COUNT(*) FROM course_skills cs WHERE cs.skill_id = sk.skill_id) AS courses_teaching,
       NOT EXISTS (SELECT 1 FROM course_skills cs WHERE cs.skill_id = sk.skill_id) AS uncovered
FROM skills sk
JOIN LATERAL (SELECT * FROM market_demand m WHERE m.skill_id = sk.skill_id ORDER BY m.year DESC LIMIT 1) md ON TRUE;

-- View grants to application roles
GRANT SELECT ON
  v_course_summary,
  v_course_comparison,
  v_course_feedback,
  v_course_placements,
  v_course_preparation,
  v_exam_questions,
  v_placement_analytics,
  v_senior_tier,
  v_skill_gap,
  v_course_stats,
  v_student_cgpa,
  v_faculty_reviews
TO app_student, app_senior, app_faculty, app_admin;

GRANT SELECT ON v_department_dashboard TO app_faculty, app_admin;

-- 14. Academic Standing Security-Definer Function (Calculates department rank & percentile safely)
CREATE OR REPLACE FUNCTION fn_get_student_academic_standing(p_student_id INT)
RETURNS TABLE (
    dept_rank       INT,
    total_students  INT,
    pct_rank        NUMERIC,
    standing_label  VARCHAR(100)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_dept_id INT;
    v_cgpa NUMERIC;
    v_rank INT;
    v_total INT;
    v_pct NUMERIC;
BEGIN
    SELECT s.dept_id INTO v_dept_id FROM students s WHERE s.student_id = p_student_id;
    IF v_dept_id IS NULL THEN
        RETURN;
    END IF;

    SELECT ROUND(AVG(e.grade_points)::numeric, 2)
    INTO v_cgpa
    FROM enrollments e
    WHERE e.student_id = p_student_id AND e.status = 'completed' AND e.grade_points IS NOT NULL;

    IF v_cgpa IS NULL THEN
        dept_rank := NULL;
        total_students := NULL;
        pct_rank := NULL;
        standing_label := 'Not Ranked Yet';
        RETURN NEXT;
        RETURN;
    END IF;

    WITH dept_stats AS (
        SELECT s.student_id,
               AVG(e.grade_points) AS student_cgpa,
               RANK() OVER (ORDER BY AVG(e.grade_points) DESC) AS drk,
               COUNT(*) OVER () AS tot
        FROM students s
        JOIN enrollments e ON e.student_id = s.student_id
        WHERE s.dept_id = v_dept_id AND e.status = 'completed' AND e.grade_points IS NOT NULL
        GROUP BY s.student_id
    )
    SELECT drk, tot, ROUND((drk::numeric / NULLIF(tot, 0)), 2)
    INTO v_rank, v_total, v_pct
    FROM dept_stats
    WHERE student_id = p_student_id;

    dept_rank := v_rank;
    total_students := v_total;
    pct_rank := v_pct;

    IF v_pct <= 0.10 THEN
        standing_label := 'Top 10% Academic Standing • Dean''s Honor List';
    ELSIF v_pct <= 0.25 THEN
        standing_label := 'Top 25% Academic Standing';
    ELSIF v_pct <= 0.50 THEN
        standing_label := 'Top 50% Academic Standing';
    ELSE
        standing_label := 'Good Standing';
    END IF;

    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_get_student_academic_standing(INT) TO app_student, app_senior, app_faculty, app_admin;

