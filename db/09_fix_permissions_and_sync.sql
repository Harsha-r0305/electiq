-- ElectIQ :: 09_fix_permissions_and_sync.sql
-- Fixes table grants, views, and RLS policies across all roles (student, senior, faculty, admin)

-- 1. Create or replace standard statistical and summary views so all APIs have clean views
CREATE OR REPLACE VIEW v_course_stats AS
SELECT
  c.course_id,
  ROUND(AVG(f.difficulty)::numeric, 1) AS avg_difficulty,
  ROUND(AVG(f.workload)::numeric, 1) AS avg_workload,
  ROUND(AVG(f.usefulness)::numeric, 1) AS avg_usefulness,
  COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.status = 'published' AND sp.consent = true) AS verified_seniors_count,
  COUNT(DISTINCT p.placement_id) FILTER (WHERE p.type = 'full_time' AND p.verified = true) AS verified_placements_count,
  ROUND(AVG(p.package_lpa) FILTER (WHERE p.type = 'full_time' AND p.verified = true)::numeric, 1) AS avg_package_lpa
FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.course_id
LEFT JOIN feedback f ON f.enrollment_id = e.enrollment_id AND f.is_verified = true AND (f.moderation_status = 'approved' OR f.moderation_status IS NULL)
LEFT JOIN senior_profiles sp ON sp.student_id = e.student_id
LEFT JOIN placements p ON p.student_id = e.student_id
GROUP BY c.course_id;

-- 2. Ensure RLS policies on students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS students_own ON students;
DROP POLICY IF EXISTS students_senior_read ON students;
DROP POLICY IF EXISTS students_admin ON students;
DROP POLICY IF EXISTS students_faculty_read ON students;

CREATE POLICY students_admin ON students FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY students_faculty_read ON students FOR SELECT TO app_faculty USING (true);
CREATE POLICY students_read ON students FOR SELECT TO app_student, app_senior
  USING (
    user_id = fn_current_user_id()
    OR student_id = fn_current_student_id()
    OR student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE (sp.status = 'published' AND sp.consent = true)
         OR sp.student_id = fn_current_student_id()
    )
  );
CREATE POLICY students_own_update ON students FOR UPDATE TO app_student, app_senior
  USING (user_id = fn_current_user_id()) WITH CHECK (user_id = fn_current_user_id());

-- 3. Ensure RLS policies on enrollments
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enrollments_own ON enrollments;
DROP POLICY IF EXISTS enrollments_admin ON enrollments;
DROP POLICY IF EXISTS enrollments_senior_public ON enrollments;
DROP POLICY IF EXISTS enrollments_faculty_read ON enrollments;

CREATE POLICY enrollments_admin ON enrollments FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY enrollments_faculty_read ON enrollments FOR SELECT TO app_faculty USING (true);
CREATE POLICY enrollments_read ON enrollments FOR SELECT TO app_student, app_senior
  USING (
    student_id = fn_current_student_id()
    OR student_id IN (
      SELECT sp.student_id FROM senior_profiles sp
      WHERE (sp.status = 'published' AND sp.consent = true)
         OR sp.student_id = fn_current_student_id()
    )
  );
CREATE POLICY enrollments_own_write ON enrollments FOR ALL TO app_student, app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());

-- 4. Ensure RLS policies on placements
ALTER TABLE placements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS placements_own ON placements;
DROP POLICY IF EXISTS placements_admin ON placements;
DROP POLICY IF EXISTS placements_student_read ON placements;

CREATE POLICY placements_admin ON placements FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY placements_faculty_read ON placements FOR SELECT TO app_faculty USING (true);
CREATE POLICY placements_read ON placements FOR SELECT TO app_student, app_senior
  USING (
    student_id = fn_current_student_id()
    OR (
      verified = true
      AND student_id IN (
        SELECT sp.student_id FROM senior_profiles sp
        WHERE (sp.status = 'published' AND sp.consent = true)
           OR sp.student_id = fn_current_student_id()
      )
    )
  );
CREATE POLICY placements_own_write ON placements FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());

-- 5. Ensure RLS policies on feedback
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feedback_admin ON feedback;
DROP POLICY IF EXISTS feedback_faculty ON feedback;
DROP POLICY IF EXISTS feedback_own_select ON feedback;
DROP POLICY IF EXISTS feedback_own_insert ON feedback;
DROP POLICY IF EXISTS feedback_student_read ON feedback;
DROP POLICY IF EXISTS feedback_read ON feedback;
DROP POLICY IF EXISTS feedback_own_write ON feedback;

CREATE POLICY feedback_admin ON feedback FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY feedback_faculty ON feedback FOR ALL TO app_faculty USING (true) WITH CHECK (true);
CREATE POLICY feedback_read ON feedback FOR SELECT TO app_student, app_senior
  USING (
    EXISTS (SELECT 1 FROM enrollments e WHERE e.enrollment_id = feedback.enrollment_id AND e.student_id = fn_current_student_id())
    OR (moderation_status = 'approved' AND is_verified = true)
  );
CREATE POLICY feedback_own_write ON feedback FOR ALL TO app_senior
  USING (EXISTS (SELECT 1 FROM enrollments e WHERE e.enrollment_id = feedback.enrollment_id AND e.student_id = fn_current_student_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM enrollments e WHERE e.enrollment_id = feedback.enrollment_id AND e.student_id = fn_current_student_id()));

-- 6. Ensure RLS policies on senior_profiles
ALTER TABLE senior_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sp_admin ON senior_profiles;
DROP POLICY IF EXISTS sp_own ON senior_profiles;
DROP POLICY IF EXISTS sp_read ON senior_profiles;

CREATE POLICY sp_admin ON senior_profiles FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY sp_faculty ON senior_profiles FOR ALL TO app_faculty USING (true) WITH CHECK (true);
CREATE POLICY sp_read ON senior_profiles FOR SELECT TO app_student, app_senior
  USING (
    student_id = fn_current_student_id()
    OR (status = 'published' AND consent = true)
  );
CREATE POLICY sp_own_write ON senior_profiles FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());

-- 7. Ensure RLS on projects, publications, achievements, extra_activities, interview_prep, interview_questions
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_admin ON projects;
DROP POLICY IF EXISTS projects_own ON projects;
DROP POLICY IF EXISTS projects_read ON projects;
CREATE POLICY projects_admin ON projects FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY projects_faculty ON projects FOR ALL TO app_faculty USING (true) WITH CHECK (true);
CREATE POLICY projects_read ON projects FOR SELECT TO app_student, app_senior
  USING (student_id = fn_current_student_id() OR (moderation_status = 'approved' AND student_id IN (SELECT student_id FROM senior_profiles WHERE status = 'published')));
CREATE POLICY projects_own_write ON projects FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());

ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pub_admin ON publications;
DROP POLICY IF EXISTS pub_own ON publications;
DROP POLICY IF EXISTS pub_read ON publications;
CREATE POLICY pub_admin ON publications FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY pub_faculty ON publications FOR ALL TO app_faculty USING (true) WITH CHECK (true);
CREATE POLICY pub_read ON publications FOR SELECT TO app_student, app_senior
  USING (student_id = fn_current_student_id() OR (moderation_status = 'approved' AND student_id IN (SELECT student_id FROM senior_profiles WHERE status = 'published')));
CREATE POLICY pub_own_write ON publications FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ach_admin ON achievements;
DROP POLICY IF EXISTS ach_own ON achievements;
DROP POLICY IF EXISTS ach_read ON achievements;
CREATE POLICY ach_admin ON achievements FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY ach_faculty ON achievements FOR ALL TO app_faculty USING (true) WITH CHECK (true);
CREATE POLICY ach_read ON achievements FOR SELECT TO app_student, app_senior
  USING (student_id = fn_current_student_id() OR (moderation_status = 'approved' AND student_id IN (SELECT student_id FROM senior_profiles WHERE status = 'published')));
CREATE POLICY ach_own_write ON achievements FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());

ALTER TABLE extra_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activities_admin ON extra_activities;
DROP POLICY IF EXISTS activities_own ON extra_activities;
DROP POLICY IF EXISTS activities_student_read ON extra_activities;
CREATE POLICY activities_admin ON extra_activities FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY activities_faculty ON extra_activities FOR ALL TO app_faculty USING (true) WITH CHECK (true);
CREATE POLICY activities_read ON extra_activities FOR SELECT TO app_student, app_senior
  USING (student_id = fn_current_student_id() OR (moderation_status = 'approved' AND student_id IN (SELECT student_id FROM senior_profiles WHERE status = 'published')));
CREATE POLICY activities_own_write ON extra_activities FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());

ALTER TABLE interview_prep ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prep_admin ON interview_prep;
DROP POLICY IF EXISTS prep_own ON interview_prep;
DROP POLICY IF EXISTS prep_read ON interview_prep;
CREATE POLICY prep_admin ON interview_prep FOR ALL TO app_admin USING (true) WITH CHECK (true);
CREATE POLICY prep_faculty ON interview_prep FOR ALL TO app_faculty USING (true) WITH CHECK (true);
CREATE POLICY prep_read ON interview_prep FOR SELECT TO app_student, app_senior
  USING (student_id = fn_current_student_id() OR (moderation_status = 'approved' AND student_id IN (SELECT student_id FROM senior_profiles WHERE status = 'published')));
CREATE POLICY prep_own_write ON interview_prep FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());

-- 8. Table and Sequence Grants (global SELECT on ALL tables removed for least-privilege security)
GRANT SELECT ON departments, courses, course_prerequisites, skills, course_skills, companies, job_roles, role_skills, role_demand, role_elective_paths, package_tiers, market_demand, system_settings TO app_student, app_senior, app_faculty, app_admin;
GRANT SELECT ON v_course_stats, v_course_summary, v_course_comparison, v_course_feedback, v_course_placements, v_course_preparation, v_exam_questions, v_placement_analytics, v_skill_gap, v_senior_tier, v_student_cgpa TO app_student, app_senior, app_faculty, app_admin;
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO app_senior, app_faculty, app_admin;

-- Write grants for specific roles
GRANT INSERT, UPDATE, DELETE ON senior_profiles, placements, feedback, projects, project_skills, publications, achievements, extra_activities, interview_prep, interview_questions, returned_items, entity_requests, academic_correction_requests TO app_senior, app_admin;
GRANT INSERT, UPDATE, DELETE ON faculty_reviews, academic_correction_requests TO app_faculty;
GRANT UPDATE (status, reviewed_by, reviewed_at, review_comment) ON exam_questions TO app_faculty, app_admin;
GRANT UPDATE (moderation_status, is_verified, faculty_id, faculty_notes, reviewed_by, reviewed_at) ON feedback TO app_faculty, app_admin;
GRANT UPDATE (moderation_status, reviewed_by, reviewed_at, review_notes) ON projects, publications, achievements, extra_activities, interview_prep TO app_faculty, app_admin;
GRANT UPDATE (status, faculty_reviewed_by, faculty_notes, faculty_reviewed_at, reviewed_by, review_notes, published_at) ON senior_profiles TO app_faculty, app_admin;
GRANT UPDATE (verification_status, verified, verified_by, verified_at, review_notes) ON placements TO app_admin;
