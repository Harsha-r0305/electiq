-- Enable RLS and add policies for the new tables

ALTER TABLE senior_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sp_read ON senior_profiles;
CREATE POLICY sp_read ON senior_profiles FOR SELECT TO app_student, app_faculty, app_admin, app_senior
  USING (true);
DROP POLICY IF EXISTS sp_own ON senior_profiles;
CREATE POLICY sp_own ON senior_profiles FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
DROP POLICY IF EXISTS sp_admin ON senior_profiles;
CREATE POLICY sp_admin ON senior_profiles FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pub_read ON publications;
CREATE POLICY pub_read ON publications FOR SELECT TO app_student, app_faculty, app_admin, app_senior
  USING (true);
DROP POLICY IF EXISTS pub_own ON publications;
CREATE POLICY pub_own ON publications FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
DROP POLICY IF EXISTS pub_admin ON publications;
CREATE POLICY pub_admin ON publications FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ach_read ON achievements;
CREATE POLICY ach_read ON achievements FOR SELECT TO app_student, app_faculty, app_admin, app_senior
  USING (true);
DROP POLICY IF EXISTS ach_own ON achievements;
CREATE POLICY ach_own ON achievements FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
DROP POLICY IF EXISTS ach_admin ON achievements;
CREATE POLICY ach_admin ON achievements FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

ALTER TABLE interview_prep ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prep_read ON interview_prep;
CREATE POLICY prep_read ON interview_prep FOR SELECT TO app_student, app_faculty, app_admin, app_senior
  USING (true);
DROP POLICY IF EXISTS prep_own ON interview_prep;
CREATE POLICY prep_own ON interview_prep FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
DROP POLICY IF EXISTS prep_admin ON interview_prep;
CREATE POLICY prep_admin ON interview_prep FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

ALTER TABLE returned_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ret_own ON returned_items;
CREATE POLICY ret_own ON returned_items FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
DROP POLICY IF EXISTS ret_admin ON returned_items;
CREATE POLICY ret_admin ON returned_items FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

ALTER TABLE entity_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS req_own ON entity_requests;
CREATE POLICY req_own ON entity_requests FOR ALL TO app_senior
  USING (student_id = fn_current_student_id()) WITH CHECK (student_id = fn_current_student_id());
DROP POLICY IF EXISTS req_admin ON entity_requests;
CREATE POLICY req_admin ON entity_requests FOR ALL TO app_admin
  USING (true) WITH CHECK (true);

-- Ensure v_student_cgpa is readable by student helper or grant directly where needed
GRANT SELECT ON v_student_cgpa TO app_student, app_senior;

