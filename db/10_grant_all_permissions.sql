-- ElectIQ :: 10_grant_all_permissions.sql
-- Least-privilege permission and grant resolution across application roles.
-- Corrected: Removed all excessively broad grants, global function executes, and USING (true) policies.

-- 1. Table grants for app_senior
-- NOTE: enrollments and students are strictly protected. Students and seniors only have SELECT on enrollments.
GRANT SELECT ON enrollments TO app_senior, app_student;
GRANT SELECT, INSERT, UPDATE, DELETE ON enrollments TO app_admin;

GRANT SELECT ON students TO app_senior, app_student;
GRANT SELECT, INSERT, UPDATE, DELETE ON students TO app_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON feedback TO app_senior, app_admin;
GRANT SELECT ON feedback TO app_student;
GRANT UPDATE (moderation_status, is_verified, faculty_notes, reviewed_by, reviewed_at) ON feedback TO app_faculty;

GRANT SELECT, INSERT, UPDATE ON senior_profiles TO app_senior;
GRANT SELECT, INSERT, UPDATE, DELETE ON senior_profiles TO app_admin;
GRANT SELECT ON senior_profiles TO app_student, app_faculty;
GRANT UPDATE (status, faculty_reviewed_by, faculty_notes, faculty_reviewed_at) ON senior_profiles TO app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON placements TO app_senior, app_admin;
GRANT SELECT ON placements TO app_student, app_faculty;
GRANT UPDATE (verification_status, verified, verified_by, verified_at, review_notes) ON placements TO app_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON interview_prep TO app_senior, app_admin;
GRANT SELECT ON interview_prep TO app_student, app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON interview_questions TO app_senior, app_admin;
GRANT SELECT ON interview_questions TO app_student, app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO app_senior, app_admin;
GRANT SELECT ON projects TO app_student, app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON project_skills TO app_senior, app_admin;
GRANT SELECT ON project_skills TO app_student, app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON publications TO app_senior, app_admin;
GRANT SELECT ON publications TO app_student, app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON achievements TO app_senior, app_admin;
GRANT SELECT ON achievements TO app_student, app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON extra_activities TO app_senior, app_admin;
GRANT SELECT ON extra_activities TO app_student, app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON exam_questions TO app_senior, app_admin;
GRANT SELECT, INSERT ON exam_questions TO app_student;
GRANT SELECT, UPDATE (status, review_comment, reviewed_by, reviewed_at) ON exam_questions TO app_faculty;

GRANT SELECT, UPDATE ON returned_items TO app_senior, app_student;
GRANT SELECT, INSERT, UPDATE, DELETE ON returned_items TO app_faculty, app_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON entity_requests TO app_senior, app_admin;
GRANT SELECT, INSERT, UPDATE ON academic_correction_requests TO app_senior, app_student;
GRANT SELECT ON academic_correction_requests TO app_faculty;
GRANT SELECT, INSERT, UPDATE, DELETE ON academic_correction_requests TO app_admin;

GRANT SELECT, INSERT, UPDATE ON faculty_reviews TO app_faculty;
GRANT SELECT, INSERT, UPDATE, DELETE ON faculty_reviews TO app_admin;

-- 2. Read access on reference tables for all authenticated roles
GRANT SELECT ON courses, departments, job_roles, companies, skills, course_skills, course_prerequisites, role_skills, role_demand, role_elective_paths, package_tiers, market_demand, system_settings, resources TO app_student, app_senior, app_faculty, app_admin;

-- app_login has minimal access (departments list for registration)
GRANT SELECT ON departments TO app_login;

-- 3. Grants on specific sequences needed for data creation
GRANT USAGE, SELECT ON SEQUENCE feedback_feedback_id_seq, placements_placement_id_seq, projects_project_id_seq, publications_pub_id_seq, achievements_achievement_id_seq, extra_activities_activity_id_seq, interview_prep_prep_id_seq, interview_questions_question_id_seq, exam_questions_exam_question_id_seq, entity_requests_request_id_seq, academic_correction_requests_request_id_seq, moderation_reports_report_id_seq TO app_senior;
GRANT USAGE, SELECT ON SEQUENCE exam_questions_exam_question_id_seq, academic_correction_requests_request_id_seq, moderation_reports_report_id_seq TO app_student;
GRANT USAGE, SELECT ON SEQUENCE faculty_reviews_review_id_seq, moderation_reports_report_id_seq TO app_faculty;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_admin;

-- 4. Role-specific procedure and function execution
REVOKE EXECUTE ON ALL FUNCTIONS FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES FROM PUBLIC;

GRANT EXECUTE ON FUNCTION fn_get_login(TEXT), fn_register_student(TEXT,TEXT,TEXT,TEXT,INT,INT), fn_check_login_lockout(TEXT,TEXT), fn_record_login_attempt(TEXT,TEXT,BOOLEAN) TO app_login;

GRANT EXECUTE ON PROCEDURE sp_enroll_student(INT, TEXT), sp_change_password(TEXT), sp_share_exam_questions(INT, TEXT, JSONB) TO app_student, app_senior;
GRANT EXECUTE ON PROCEDURE sp_submit_feedback(INT,INT,INT,INT,TEXT), sp_record_placement(INT,INT,TEXT,NUMERIC,INT,JSONB,JSONB,INT) TO app_senior;
GRANT EXECUTE ON PROCEDURE sp_post_grade(INT, NUMERIC) TO app_admin;
GRANT EXECUTE ON PROCEDURE sp_change_password(TEXT) TO app_faculty, app_admin;

GRANT EXECUTE ON FUNCTION fn_current_user_id(), fn_current_role(), fn_current_student_id(), fn_current_faculty_id(), fn_my_cgpa(), fn_next_electives(INT, NUMERIC), fn_cgpa_boost(INT), fn_prereq_chain(INT), fn_skill_coverage(INT), fn_course_difficulty(INT), fn_placement_stats(INT) TO app_student, app_senior, app_faculty, app_admin;
