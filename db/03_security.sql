-- ElectIQ :: 03_security.sql
-- Database-level RBAC: group roles, least-privilege GRANTs and Row-Level Security.
-- The app connects as app_login (NOINHERIT, no table privileges) and, per request, runs
--   BEGIN; SET LOCAL ROLE app_<role>; SELECT set_config('app.user_id', ..., true); ... COMMIT;

DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['app_student','app_senior','app_faculty','app_admin'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_login') THEN
    CREATE ROLE app_login LOGIN NOINHERIT;
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_login', current_database());
END $$;

GRANT app_student, app_senior, app_faculty, app_admin TO app_login;
GRANT USAGE ON SCHEMA public TO app_login, app_student, app_senior, app_faculty, app_admin;

-- ---------- Master data: readable by every signed-in role ----------
GRANT SELECT ON departments, courses, course_prerequisites, skills, course_skills, companies,
                job_roles, role_skills, market_demand, resources, projects, project_skills, faculty
  TO app_student, app_senior, app_faculty, app_admin;

-- ---------- Shared reads go through views (no student identity inside) ----------
GRANT SELECT ON v_course_feedback, v_faculty_reviews, v_course_preparation, v_course_summary,
                v_course_comparison, v_placement_analytics, v_skill_gap
  TO app_student, app_senior, app_faculty, app_admin;
GRANT SELECT ON v_department_dashboard TO app_faculty, app_admin;
GRANT SELECT ON v_student_cgpa TO app_admin;

-- ---------- Per-role table privileges ----------
GRANT SELECT ON students, enrollments TO app_student, app_senior;
GRANT SELECT ON feedback TO app_senior;                                  -- own rows only (RLS)
GRANT INSERT ON feedback TO app_senior;
GRANT SELECT, INSERT, UPDATE, DELETE ON placements, extra_activities TO app_senior;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects, project_skills TO app_senior;
GRANT SELECT, INSERT ON interview_questions TO app_senior;
GRANT SELECT ON interview_questions TO app_student, app_faculty;
GRANT SELECT, INSERT, UPDATE ON faculty_reviews TO app_faculty;


-- Admin: full control of master data, enrollments and moderation; narrow access to users
GRANT SELECT, INSERT, UPDATE, DELETE ON departments, courses, course_prerequisites, skills, course_skills,
      companies, job_roles, role_skills, market_demand, resources, projects, project_skills,
      students, faculty, enrollments, interview_questions, faculty_reviews TO app_admin;
GRANT SELECT, DELETE ON feedback, placements, extra_activities TO app_admin;
GRANT SELECT, INSERT ON users TO app_admin;
GRANT UPDATE (role) ON users TO app_admin;                              -- column-level: only role is editable
GRANT SELECT ON audit_log TO app_admin;
-- audit_log: no INSERT/UPDATE/DELETE for any application role (only the SECURITY DEFINER trigger writes)

GRANT SELECT ON departments TO app_login;                                  -- public registration form
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_senior, app_faculty, app_admin;

-- ---------- Routines: restrict who may call what ----------
REVOKE EXECUTE ON FUNCTION fn_get_login(TEXT), fn_register_student(TEXT,TEXT,TEXT,TEXT,INT,INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_get_login(TEXT), fn_register_student(TEXT,TEXT,TEXT,TEXT,INT,INT) TO app_login;
REVOKE EXECUTE ON FUNCTION fn_check_login_lockout(TEXT,TEXT), fn_record_login_attempt(TEXT,TEXT,BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_check_login_lockout(TEXT,TEXT), fn_record_login_attempt(TEXT,TEXT,BOOLEAN) TO app_login;
REVOKE EXECUTE ON PROCEDURE sp_post_grade(INT, NUMERIC) FROM PUBLIC;
GRANT  EXECUTE ON PROCEDURE sp_post_grade(INT, NUMERIC) TO app_admin;
REVOKE EXECUTE ON PROCEDURE sp_submit_feedback(INT,INT,INT,INT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON PROCEDURE sp_submit_feedback(INT,INT,INT,INT,TEXT) TO app_senior;
REVOKE EXECUTE ON PROCEDURE sp_record_placement(INT,INT,TEXT,NUMERIC,INT,JSONB,JSONB,INT) FROM PUBLIC;
GRANT  EXECUTE ON PROCEDURE sp_record_placement(INT,INT,TEXT,NUMERIC,INT,JSONB,JSONB,INT) TO app_senior;
REVOKE EXECUTE ON PROCEDURE sp_enroll_student(INT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON PROCEDURE sp_enroll_student(INT, TEXT) TO app_student, app_senior;
REVOKE EXECUTE ON PROCEDURE sp_change_password(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON PROCEDURE sp_change_password(TEXT) TO app_student, app_senior, app_faculty, app_admin;

-- ---------- Row-Level Security: private data and writes only ----------
ALTER TABLE students            ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback            ENABLE ROW LEVEL SECURITY;
ALTER TABLE placements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_skills      ENABLE ROW LEVEL SECURITY;

CREATE POLICY students_own ON students FOR SELECT TO app_student, app_senior
  USING (user_id = fn_current_user_id());
CREATE POLICY students_admin ON students FOR ALL TO app_admin USING (true) WITH CHECK (true);

CREATE POLICY enrollments_own ON enrollments FOR SELECT TO app_student, app_senior
  USING (student_id = fn_current_student_id());
CREATE POLICY enrollments_admin ON enrollments FOR ALL TO app_admin USING (true) WITH CHECK (true);

CREATE POLICY feedback_own_select ON feedback FOR SELECT TO app_senior
  USING (EXISTS (SELECT 1 FROM enrollments e
                 WHERE e.enrollment_id = feedback.enrollment_id AND e.student_id = fn_current_student_id()));
CREATE POLICY feedback_own_insert ON feedback FOR INSERT TO app_senior
  WITH CHECK (EXISTS (SELECT 1 FROM enrollments e
                      WHERE e.enrollment_id = feedback.enrollment_id AND e.student_id = fn_current_student_id()));
CREATE POLICY feedback_admin ON feedback FOR ALL TO app_admin USING (true) WITH CHECK (true);

CREATE POLICY placements_own ON placements FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY placements_admin ON placements FOR ALL TO app_admin USING (true) WITH CHECK (true);

CREATE POLICY activities_own ON extra_activities FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY activities_admin ON extra_activities FOR ALL TO app_admin USING (true) WITH CHECK (true);

CREATE POLICY questions_read ON interview_questions FOR SELECT TO app_student, app_senior, app_faculty, app_admin
  USING (true);
CREATE POLICY questions_insert ON interview_questions FOR INSERT TO app_senior
  WITH CHECK (placement_id IS NULL OR EXISTS (SELECT 1 FROM placements p
              WHERE p.placement_id = interview_questions.placement_id AND p.student_id = fn_current_student_id()));
CREATE POLICY questions_admin ON interview_questions FOR ALL TO app_admin USING (true) WITH CHECK (true);

CREATE POLICY freviews_own ON faculty_reviews FOR SELECT TO app_faculty
  USING (faculty_id = fn_current_faculty_id());
CREATE POLICY freviews_insert ON faculty_reviews FOR INSERT TO app_faculty
  WITH CHECK (faculty_id = fn_current_faculty_id()
              AND EXISTS (SELECT 1 FROM courses c WHERE c.course_id = faculty_reviews.course_id
                          AND c.faculty_id = faculty_reviews.faculty_id));
CREATE POLICY freviews_update ON faculty_reviews FOR UPDATE TO app_faculty
  USING (faculty_id = fn_current_faculty_id()) WITH CHECK (faculty_id = fn_current_faculty_id());
CREATE POLICY freviews_admin ON faculty_reviews FOR ALL TO app_admin USING (true) WITH CHECK (true);

CREATE POLICY projects_read ON projects FOR SELECT TO app_student, app_senior, app_faculty, app_admin
  USING (true);
CREATE POLICY projects_own ON projects FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY projects_admin ON projects FOR ALL TO app_admin USING (true) WITH CHECK (true);

CREATE POLICY pskills_read ON project_skills FOR SELECT TO app_student, app_senior, app_faculty, app_admin
  USING (true);
CREATE POLICY pskills_own ON project_skills FOR ALL TO app_senior
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.project_id = project_skills.project_id AND p.student_id = fn_current_student_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.project_id = project_skills.project_id AND p.student_id = fn_current_student_id()));
CREATE POLICY pskills_admin ON project_skills FOR ALL TO app_admin USING (true) WITH CHECK (true);

-- ---------- Exam questions ----------
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON exam_questions TO app_student, app_senior, app_admin;
GRANT SELECT ON v_exam_questions TO app_student, app_senior, app_faculty, app_admin;
GRANT USAGE ON SEQUENCE exam_questions_exam_question_id_seq TO app_student, app_senior;

REVOKE EXECUTE ON PROCEDURE sp_share_exam_questions(INT, TEXT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON PROCEDURE sp_share_exam_questions(INT, TEXT, JSONB) TO app_student, app_senior;

CREATE POLICY exam_questions_own ON exam_questions FOR ALL TO app_student, app_senior
  USING (EXISTS (SELECT 1 FROM enrollments e WHERE e.enrollment_id = exam_questions.enrollment_id AND e.student_id = fn_current_student_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM enrollments e WHERE e.enrollment_id = exam_questions.enrollment_id AND e.student_id = fn_current_student_id()));
CREATE POLICY exam_questions_admin ON exam_questions FOR ALL TO app_admin USING (true) WITH CHECK (true);



-- ---------- Role-specific Dashboards & Senior Explorer Security ----------
GRANT SELECT ON package_tiers, role_demand, system_settings TO app_student, app_senior, app_faculty, app_admin;
GRANT SELECT ON v_senior_tier TO app_student, app_faculty, app_admin;
GRANT SELECT ON senior_profiles, publications, achievements, interview_prep TO app_student, app_faculty, app_admin;
GRANT SELECT ON v_student_cgpa TO app_student, app_senior;

GRANT SELECT, INSERT, UPDATE, DELETE ON senior_profiles, publications, achievements, interview_prep TO app_senior;
GRANT SELECT, INSERT, UPDATE, DELETE ON entity_requests TO app_senior;
GRANT SELECT, UPDATE ON returned_items TO app_senior;

GRANT INSERT ON moderation_reports TO app_student, app_senior, app_faculty;
GRANT SELECT, UPDATE, DELETE ON moderation_reports TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_actions, returned_items, dashboard_designer_config, package_tiers, role_demand, system_settings, entity_requests TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON companies TO app_admin;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_student, app_senior, app_faculty, app_admin;

ALTER TABLE senior_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_read ON senior_profiles FOR SELECT TO app_student, app_faculty, app_admin, app_senior USING (true);
CREATE POLICY sp_own ON senior_profiles FOR ALL TO app_senior USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY sp_admin ON senior_profiles FOR ALL TO app_admin USING (true) WITH CHECK (true);

ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY pub_read ON publications FOR SELECT TO app_student, app_faculty, app_admin, app_senior USING (true);
CREATE POLICY pub_own ON publications FOR ALL TO app_senior USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY pub_admin ON publications FOR ALL TO app_admin USING (true) WITH CHECK (true);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY ach_read ON achievements FOR SELECT TO app_student, app_faculty, app_admin, app_senior USING (true);
CREATE POLICY ach_own ON achievements FOR ALL TO app_senior USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY ach_admin ON achievements FOR ALL TO app_admin USING (true) WITH CHECK (true);

ALTER TABLE interview_prep ENABLE ROW LEVEL SECURITY;
CREATE POLICY prep_read ON interview_prep FOR SELECT TO app_student, app_faculty, app_admin, app_senior USING (true);
CREATE POLICY prep_own ON interview_prep FOR ALL TO app_senior USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY prep_admin ON interview_prep FOR ALL TO app_admin USING (true) WITH CHECK (true);

ALTER TABLE returned_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ret_own ON returned_items FOR ALL TO app_senior USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY ret_admin ON returned_items FOR ALL TO app_admin USING (true) WITH CHECK (true);

ALTER TABLE entity_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY req_own ON entity_requests FOR ALL TO app_senior USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
CREATE POLICY req_admin ON entity_requests FOR ALL TO app_admin USING (true) WITH CHECK (true);

GRANT SELECT ON role_elective_paths TO app_student, app_senior, app_faculty, app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_elective_paths TO app_admin;
