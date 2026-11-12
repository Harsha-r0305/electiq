-- ElectIQ :: tests.sql  (run as the owner: psql -d electiq -f db/tests.sql)
-- Database-level test cases for constraints, triggers, procedures, RBAC and Row-Level Security.
-- Every test prints PASS or FAIL. Nothing is committed (everything runs in one rolled-back transaction).
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE results(n SERIAL, test TEXT, passed BOOLEAN, detail TEXT);
GRANT ALL ON results, results_n_seq TO PUBLIC;

-- Runs p_sql as p_role (user p_uid) and expects it to FAIL with a message containing p_expect
CREATE FUNCTION pg_temp.expect_fail(p_test TEXT, p_role TEXT, p_uid INT, p_sql TEXT, p_expect TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  PERFORM set_config('app.user_id', p_uid::text, true);
  PERFORM set_config('app.role', replace(p_role, 'app_', ''), true);
  BEGIN
    EXECUTE p_sql;
    RESET ROLE;
    INSERT INTO results(test, passed, detail) VALUES (p_test, false, 'no error was raised');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO results(test, passed, detail) VALUES (p_test, SQLERRM ILIKE '%' || p_expect || '%', SQLERRM);
  END;
  RESET ROLE;
END $$;

-- Runs p_sql as p_role and expects it to SUCCEED and return the given integer
CREATE FUNCTION pg_temp.expect_value(p_test TEXT, p_role TEXT, p_uid INT, p_sql TEXT, p_value BIGINT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE v BIGINT;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  PERFORM set_config('app.user_id', p_uid::text, true);
  EXECUTE p_sql INTO v;
  RESET ROLE;
  INSERT INTO results(test, passed, detail) VALUES (p_test, v = p_value, 'got ' || v || ', expected ' || p_value);
END $$;

SELECT CASE WHEN position('windows' in lower(version())) > 0 OR position('mingw' in lower(version())) > 0 OR position('visual c++' in lower(version())) > 0 THEN 'nul' ELSE '/dev/null' END AS devnull \gset
\o :devnull
SELECT user_id AS u_stu FROM users WHERE email = 'student1@electiq.dev' \gset
SELECT user_id AS u_sen FROM users WHERE email = 'senior1@electiq.dev' \gset
SELECT user_id AS u_fac FROM users WHERE email = 'faculty1@electiq.dev' \gset
SELECT user_id AS u_adm FROM users WHERE email = 'admin@electiq.dev' \gset
SELECT enrollment_id AS ungraded FROM enrollments e JOIN students s USING (student_id) WHERE s.user_id = :u_sen AND grade_points IS NULL LIMIT 1 \gset
SELECT e.enrollment_id AS other_enr FROM enrollments e WHERE e.grade_points IS NOT NULL AND e.student_id <> (SELECT student_id FROM students WHERE user_id = :u_sen) AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.enrollment_id = e.enrollment_id) LIMIT 1 \gset
SELECT count(*) AS my_enr FROM enrollments e JOIN students s USING (student_id) WHERE s.user_id = :u_stu \gset
SELECT course_id AS c_303 FROM courses WHERE code = 'UE24CS303' \gset
SELECT course_id AS c_301 FROM courses WHERE code = 'UE24CS301' \gset
SELECT e.enrollment_id AS stu_enr_active, e.course_id AS stu_cid FROM enrollments e JOIN students s USING (student_id) WHERE s.user_id = :u_stu AND e.status = 'enrolled' LIMIT 1 \gset
SELECT e.enrollment_id AS not_my_enr FROM enrollments e JOIN students s USING (student_id) WHERE s.user_id <> :u_stu LIMIT 1 \gset

-- ---- Constraints and triggers ----
SELECT pg_temp.expect_fail('T01 review before grade posted is rejected (trigger)', 'app_senior', :u_sen,
  format('CALL sp_submit_feedback(%s,3,3,3,''too early'')', :ungraded), 'grade for this enrollment has not been posted');
SELECT pg_temp.expect_fail('T02 circular prerequisite is rejected (trigger)', 'app_admin', :u_adm,
  'INSERT INTO course_prerequisites(course_id,prereq_id) SELECT (SELECT course_id FROM courses WHERE code=''UE24CS201''),(SELECT course_id FROM courses WHERE code=''UE24CS301'')', 'Circular prerequisite');
SELECT pg_temp.expect_fail('T03 self prerequisite is rejected (CHECK)', 'app_admin', :u_adm,
  'INSERT INTO course_prerequisites VALUES (1,1)', 'check constraint');
SELECT pg_temp.expect_fail('T04 grade above 10 is rejected (procedure + CHECK)', 'app_admin', :u_adm,
  format('CALL sp_post_grade(%s, 11)', :ungraded), 'between 0 and 10');
SELECT pg_temp.expect_fail('T05 rating of 6 is rejected (CHECK)', 'app_senior', :u_sen,
  'INSERT INTO feedback(enrollment_id,difficulty,workload,usefulness) SELECT e.enrollment_id,6,3,3 FROM enrollments e WHERE e.grade_points IS NOT NULL AND NOT EXISTS (SELECT 1 FROM feedback f WHERE f.enrollment_id = e.enrollment_id) LIMIT 1', 'check constraint');
SELECT pg_temp.expect_fail('T06 duplicate enrollment is rejected (UNIQUE)', 'app_admin', :u_adm,
  'INSERT INTO enrollments(student_id,course_id,term) SELECT student_id,course_id,''2026-ODD'' FROM enrollments LIMIT 1', 'duplicate key');
SELECT pg_temp.expect_fail('T07 invalid email is rejected (CHECK)', 'app_admin', :u_adm,
  'INSERT INTO users(email,password_hash,role) VALUES (''not-an-email'', repeat(''x'',60), ''student'')', 'check constraint');
SELECT pg_temp.expect_fail('T08 grade and posted-at must be set together (CHECK)', 'app_admin', :u_adm,
  'UPDATE enrollments SET grade_points = 7 WHERE grade_points IS NULL', 'check constraint');

-- ---- Role-based access control (GRANTs) ----
SELECT pg_temp.expect_fail('T09 student cannot read base feedback table', 'app_student', :u_stu, 'SELECT count(*) FROM feedback', 'permission denied');
SELECT pg_temp.expect_fail('T10 student cannot post grades', 'app_student', :u_stu, format('CALL sp_post_grade(%s, 10)', :ungraded), 'permission denied');
SELECT pg_temp.expect_fail('T11 senior cannot change roles', 'app_senior', :u_sen, 'UPDATE users SET role = ''admin''', 'permission denied');
SELECT pg_temp.expect_fail('T12 admin can change only users.role (column grant)', 'app_admin', :u_adm, 'UPDATE users SET email = ''x@y.zz''', 'permission denied');
SELECT pg_temp.expect_fail('T13 no application role can write audit_log', 'app_admin', :u_adm, 'INSERT INTO audit_log(action,table_name) VALUES (''X'',''y'')', 'permission denied');
SELECT pg_temp.expect_fail('T14 student cannot see identity-linked placements view', 'app_student', :u_stu, 'SELECT * FROM v_course_placements', 'permission denied');
SELECT pg_temp.expect_fail('T15 login role has no table access', 'app_login', :u_stu, 'SELECT count(*) FROM users', 'permission denied');

-- ---- Row-Level Security ----
SELECT pg_temp.expect_value('T16 student sees only their own enrollments', 'app_student', :u_stu, 'SELECT count(*) FROM enrollments', :my_enr);
SELECT pg_temp.expect_value('T17 student still reads shared feedback through the view', 'app_student', :u_stu, 'SELECT (count(*) > 100)::int FROM v_course_feedback', 1);
SELECT pg_temp.expect_value('T18 senior cannot see other seniors'' placements', 'app_senior', :u_sen,
  'SELECT count(*) FROM placements WHERE student_id <> fn_current_student_id()', 0);
SELECT pg_temp.expect_fail('T19 student cannot request another profile''s CGPA boost', 'app_student', :u_stu,
  'SELECT * FROM fn_cgpa_boost(1 + (SELECT max(student_id) FROM students WHERE user_id <> ' || :u_stu || '))', 'only request recommendations for your own');
SELECT pg_temp.expect_fail('T20 faculty cannot rate a course they do not teach (RLS)', 'app_faculty', :u_fac,
  'INSERT INTO faculty_reviews(faculty_id,course_id,relevance,future_scope) SELECT fn_current_faculty_id(), course_id, 4, 4 FROM courses WHERE faculty_id <> fn_current_faculty_id() LIMIT 1', 'row-level security');
SELECT pg_temp.expect_fail('T21 senior cannot review another senior''s enrollment (RLS)', 'app_senior', :u_sen,
  format('INSERT INTO feedback(enrollment_id,difficulty,workload,usefulness) VALUES (%s,3,3,3)', :other_enr), 'row-level security');

-- ---- Transactions: a failing placement leaves nothing behind ----
SELECT pg_temp.expect_fail('T22 placement with a bad question rolls back completely', 'app_senior', :u_sen,
  'CALL sp_record_placement(1,1,''full_time'',25,2026,''[{"course_id":999999,"text":"bad course id for rollback"}]''::jsonb,''[]''::jsonb,NULL)', 'violates foreign key');
SELECT pg_temp.expect_value('T23 ... and no orphan placement exists', 'app_senior', :u_sen, 'SELECT count(*) FROM placements WHERE package_lpa = 25 AND year = 2026', 0);

-- ---- Positive paths ----
SAVEPOINT p;
SET LOCAL ROLE app_admin; SELECT set_config('app.user_id', :'u_adm', true);
CALL sp_post_grade(:ungraded, 8.5);
RESET ROLE;
SELECT pg_temp.expect_value('T24 admin posts a grade, then the senior may review', 'app_senior', :u_sen,
  format('WITH x AS (INSERT INTO feedback(enrollment_id,difficulty,workload,usefulness,review_text) VALUES (%s,4,3,5,''ok'') RETURNING 1) SELECT count(*) FROM x', :ungraded), 1);
SELECT pg_temp.expect_value('T25 audit trigger recorded the grade change', 'app_admin', :u_adm,
  format('SELECT count(*) FROM audit_log WHERE table_name = ''enrollments'' AND action = ''UPDATE'' AND row_pk = ''%s'' AND user_id = %s', :ungraded, :u_adm), 1);
SELECT pg_temp.expect_value('T26 recursive CTE returns the full prerequisite chain', 'app_student', :u_stu,
  'SELECT count(*) FROM fn_prereq_chain((SELECT course_id FROM courses WHERE code=''UE24CS303''))', 4);

-- ---- Exam questions (ISA1, ISA2, ESA) ----
SELECT pg_temp.expect_value('T27 enrolled student inserts exam question and trigger fills course_id', 'app_student', :u_stu,
  format('DO $d$ BEGIN
     INSERT INTO exam_questions(enrollment_id, exam_type, question_text, marks, topic, difficulty)
     VALUES (%s, ''ISA1'', ''Explain difference between processes and threads with examples.'', 5, ''OS'', 3);
   END $d$;
   SELECT (course_id = %s)::int FROM exam_questions WHERE enrollment_id = %s AND question_text = ''Explain difference between processes and threads with examples.''', :stu_enr_active, :stu_cid, :stu_enr_active), 1);
SELECT pg_temp.expect_fail('T28 exam_type of ISA3 is rejected (check constraint)', 'app_student', :u_stu,
  format('INSERT INTO exam_questions(enrollment_id, exam_type, question_text, marks) VALUES (%s, ''ISA3'', ''Test question text with sufficient length.'', 5)', :stu_enr_active), 'check constraint');
SELECT pg_temp.expect_fail('T29 batch with duplicate question via sp_share_exam_questions fails with duplicate key', 'app_student', :u_stu,
  format('CALL sp_share_exam_questions(%s, ''ESA'', ''[{"text":"This is an ESA exam question that is repeated twice in the batch.","marks":10,"topic":"OS","difficulty":4},{"text":"This is an ESA exam question that is repeated twice in the batch.","marks":10,"topic":"OS","difficulty":4}]''::jsonb)', :stu_enr_active), 'duplicate key');
SELECT pg_temp.expect_value('T30 after T29 no ESA rows exist for that enrollment (transaction atomicity)', 'app_student', :u_stu,
  format('SELECT count(*) FROM exam_questions WHERE enrollment_id = %s AND exam_type = ''ESA''', :stu_enr_active), 0);
SELECT pg_temp.expect_fail('T31 student calling procedure with another enrollment fails with row-level security', 'app_student', :u_stu,
  format('CALL sp_share_exam_questions(%s, ''ISA2'', ''[{"text":"Another question with sufficient character length.","marks":5}]''::jsonb)', :not_my_enr), 'row-level security');
SELECT pg_temp.expect_fail('T32 faculty reading base table exam_questions fails with permission denied', 'app_faculty', :u_fac,
  'SELECT count(*) FROM exam_questions', 'permission denied');
SELECT pg_temp.expect_value('T33 faculty can read v_exam_questions (more than 100 rows)', 'app_faculty', :u_fac,
  'SELECT (count(*) > 100)::int FROM v_exam_questions', 1);
UPDATE enrollments SET status = 'dropped' WHERE enrollment_id = :stu_enr_active;
SELECT pg_temp.expect_fail('T34 dropped course enrollment fails with dropped this course', 'app_student', :u_stu,
  format('CALL sp_share_exam_questions(%s, ''ISA1'', ''[{"text":"Question for a dropped course will fail validation.","marks":5}]''::jsonb)', :stu_enr_active), 'dropped this course');
UPDATE enrollments SET status = 'enrolled' WHERE enrollment_id = :stu_enr_active;

-- ---- Additional features (self-enrollment, projects RLS, change password, lockout) ----
SELECT pg_temp.expect_fail('T35 student self-enrollment rejects if prerequisites are not completed', 'app_student', :u_stu,
  format('CALL sp_enroll_student(%s, ''2026-ODD'')', :c_303), 'all prerequisites must be completed with grade 6.0 or higher');
SELECT pg_temp.expect_value('T36 student self-enrollment succeeds when prerequisites are satisfied', 'app_student', :u_stu,
  format('DO $d$ BEGIN CALL sp_enroll_student(%s, ''2026-ODD''); END $d$; SELECT count(*) FROM enrollments WHERE student_id = fn_current_student_id() AND course_id = %s', :c_301, :c_301), 1);
SELECT pg_temp.expect_value('T37 senior can insert a project with skill tags', 'app_senior', :u_sen,
  'DO $d$ DECLARE pid INT; BEGIN
     INSERT INTO projects(student_id, course_id, title) VALUES (fn_current_student_id(), 1, ''Senior Web System'') RETURNING project_id INTO pid;
     INSERT INTO project_skills(project_id, skill_id) VALUES (pid, 1);
   END $d$;
   SELECT count(*) FROM project_skills WHERE skill_id = 1 AND project_id = (SELECT max(project_id) FROM projects WHERE student_id = fn_current_student_id())', 1);
SELECT pg_temp.expect_fail('T38 senior cannot insert a project for another student profile (RLS)', 'app_senior', :u_sen,
  'INSERT INTO projects(student_id, course_id, title) VALUES (1 + (SELECT max(student_id) FROM students WHERE user_id <> ' || :u_sen || '), 1, ''Other Project'')', 'row-level security');
SELECT pg_temp.expect_fail('T39 password change rejects invalid hash format', 'app_student', :u_stu,
  'CALL sp_change_password(''short'')', 'Invalid password hash format');
SELECT pg_temp.expect_value('T40 password change succeeds for authenticated user', 'app_student', :u_stu,
  'CALL sp_change_password(repeat(''z'', 60)); SELECT 1', 1);
SELECT pg_temp.expect_value('T41 failed-login lockout triggers after 5 failed attempts', 'app_login', :u_stu,
  'SELECT fn_record_login_attempt(''192.168.1.100'',''lockout@electiq.dev'',false);
   SELECT fn_record_login_attempt(''192.168.1.100'',''lockout@electiq.dev'',false);
   SELECT fn_record_login_attempt(''192.168.1.100'',''lockout@electiq.dev'',false);
   SELECT fn_record_login_attempt(''192.168.1.100'',''lockout@electiq.dev'',false);
   SELECT fn_record_login_attempt(''192.168.1.100'',''lockout@electiq.dev'',false);
   SELECT fn_check_login_lockout(''192.168.1.100'',''lockout@electiq.dev'')::int', 1);

\o
SELECT test, CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS result, left(detail, 90) AS detail FROM results ORDER BY n;
SELECT count(*) FILTER (WHERE passed) AS passed, count(*) FILTER (WHERE NOT passed) AS failed FROM results;
ROLLBACK;
