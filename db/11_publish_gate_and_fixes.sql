-- ElectIQ :: 11_publish_gate_and_fixes.sql
-- Idempotent. Single source of truth for the "Senior -> Admin publish -> Student" visibility rule.
--
--   Senior-contributed content (electives feedback, placements, prep, projects, activities, ...) is
--   visible to students ONLY when
--     (a) the author's senior profile is 'published' by an admin AND the senior gave consent, and
--     (b) the individual item has not been rejected / hidden / sent back for changes.
--   Real names are never exposed through the shared views: only the senior's chosen display name or
--   the anonymous senior code is shown.

-- 1. Course feedback view (replaces the older anonymous-only version that the API routes outgrew)
CREATE OR REPLACE VIEW v_course_feedback AS
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
       COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code)            AS display_name,
       COALESCE(NULLIF(sp.display_name, ''), 'Senior ' || sp.senior_code)            AS student_name,
       CASE WHEN COALESCE(sp.show_grades, true) THEN e.grade_points END              AS grade_points,
       f.placement_help,
       f.extra_prep_needed,
       f.recommended_resources,
       f.advice_for_juniors,
       CASE WHEN COALESCE(sp.show_placements, true) THEN pl.company_name END         AS company_name,
       CASE WHEN COALESCE(sp.show_placements, true) THEN pl.package_lpa END          AS package_lpa,
       CASE WHEN COALESCE(sp.show_placements, true) THEN pl.role_title END           AS role_title
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

-- 2. Placements counted toward a course: verified offers of published, consenting seniors only
CREATE OR REPLACE VIEW v_course_placements AS
SELECT e.course_id, p.placement_id, p.student_id, p.type, p.package_lpa, p.year
FROM placements p
JOIN enrollments e ON e.student_id = p.student_id
JOIN senior_profiles sp ON sp.student_id = p.student_id
WHERE e.status = 'completed' AND e.grade_points IS NOT NULL
  AND p.verified = true AND COALESCE(p.verification_status, 'verified') = 'verified'
  AND sp.status = 'published' AND sp.consent = true;

-- 3. Row-level security: unpublished profiles are private to their owner and to staff
DROP POLICY IF EXISTS sp_read ON senior_profiles;
CREATE POLICY sp_read ON senior_profiles FOR SELECT
  TO app_admin, app_faculty, app_senior, app_student
  USING (
    fn_current_role() IN ('admin', 'faculty')
    OR student_id = fn_current_student_id()
    OR (status = 'published' AND consent = true)
  );

-- 4. Make sure every role can read the (re)built views
GRANT SELECT ON v_course_feedback, v_course_placements
  TO app_student, app_senior, app_faculty, app_admin;

-- 5. Self-reported CGPA (the API already writes it; the column was missing -> profile save failed)
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS cgpa NUMERIC(4,2);
DO $$ BEGIN
  ALTER TABLE senior_profiles DROP CONSTRAINT IF EXISTS senior_profiles_cgpa_check;
  ALTER TABLE senior_profiles ADD CONSTRAINT senior_profiles_cgpa_check CHECK (cgpa IS NULL OR cgpa BETWEEN 0 AND 10);
END $$;
GRANT UPDATE (cgpa, published_at) ON senior_profiles TO app_admin;
GRANT UPDATE (cgpa) ON senior_profiles TO app_senior;

-- 6. A senior can NEVER publish / approve anything, whatever the API sends.
--    Allowed senior transitions: draft|changes_requested|rejected -> submitted, published|submitted -> draft.
--    Editing public-facing profile text of a published profile sends it back to admin review.
CREATE OR REPLACE FUNCTION trg_senior_profile_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user <> 'app_senior' THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.published_at := NULL; NEW.reviewed_by := NULL; NEW.review_notes := NULL;
    NEW.faculty_reviewed_by := NULL; NEW.faculty_notes := NULL; NEW.faculty_reviewed_at := NULL;
    RETURN NEW;
  END IF;

  -- staff-owned columns are read-only for seniors
  NEW.published_at := OLD.published_at;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.review_notes := OLD.review_notes;
  NEW.faculty_reviewed_by := OLD.faculty_reviewed_by;
  NEW.faculty_notes := OLD.faculty_notes;
  NEW.faculty_reviewed_at := OLD.faculty_reviewed_at;
  NEW.student_id := OLD.student_id;
  NEW.senior_code := OLD.senior_code;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'submitted' AND OLD.status IN ('draft', 'changes_requested', 'rejected', 'submitted') THEN
      NEW.submitted_at := now();
    ELSIF NEW.status = 'draft' AND OLD.status IN ('published', 'submitted', 'changes_requested') THEN
      NULL;  -- the senior withdraws their own profile
    ELSE
      NEW.status := OLD.status;  -- any other transition (e.g. -> published) is silently refused
    END IF;
  ELSIF OLD.status = 'published' AND (
        NEW.headline IS DISTINCT FROM OLD.headline OR NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.specialization IS DISTINCT FROM OLD.specialization OR NEW.advice_for_juniors IS DISTINCT FROM OLD.advice_for_juniors
     OR NEW.linkedin_url IS DISTINCT FROM OLD.linkedin_url OR NEW.github_url IS DISTINCT FROM OLD.github_url
     OR NEW.cgpa IS DISTINCT FROM OLD.cgpa) THEN
    NEW.status := 'submitted';
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS senior_profile_guard ON senior_profiles;
CREATE TRIGGER senior_profile_guard BEFORE INSERT OR UPDATE ON senior_profiles
  FOR EACH ROW EXECUTE FUNCTION trg_senior_profile_guard();

-- 7. Anything a senior creates or edits starts as pending until an admin approves it.
CREATE OR REPLACE FUNCTION trg_senior_item_pending() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user <> 'app_senior' THEN RETURN NEW; END IF;
  CASE TG_TABLE_NAME
    WHEN 'placements' THEN
      NEW.verified := false; NEW.verification_status := 'pending';
      NEW.verified_by := NULL; NEW.verified_at := NULL;
    WHEN 'feedback' THEN
      NEW.is_verified := false; NEW.moderation_status := 'pending';
    WHEN 'exam_questions' THEN
      NEW.status := 'pending';
    ELSE
      NEW.moderation_status := 'pending';
  END CASE;
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

-- 8. Student-facing shared views only expose approved items of published seniors
CREATE OR REPLACE VIEW v_course_preparation AS
SELECT ea.course_id, ea.type, ea.platform, COUNT(*) AS seniors, ROUND(AVG(ea.hours_spent), 1) AS avg_hours
FROM extra_activities ea
JOIN senior_profiles sp ON sp.student_id = ea.student_id
WHERE COALESCE(ea.moderation_status, 'approved') = 'approved'
  AND sp.status = 'published' AND sp.consent = true
GROUP BY ea.course_id, ea.type, ea.platform;

CREATE OR REPLACE VIEW v_exam_questions AS
SELECT eq.exam_question_id, eq.course_id, eq.exam_type,
       COALESCE(e.term, '2025-Spr') AS term,
       eq.question_text, eq.marks, eq.topic, eq.difficulty, eq.created_at, eq.question_tsv,
       eq.answer_text, eq.year, eq.semester, eq.status, eq.contributor_id
FROM exam_questions eq
LEFT JOIN enrollments e ON e.enrollment_id = eq.enrollment_id
WHERE COALESCE(eq.status, 'approved') = 'approved'
  AND (eq.contributor_id IS NULL OR EXISTS (
        SELECT 1 FROM senior_profiles sp
        WHERE sp.student_id = eq.contributor_id AND sp.status = 'published' AND sp.consent = true));

GRANT SELECT ON v_course_preparation, v_exam_questions TO app_student, app_senior, app_faculty, app_admin;

-- 9. Profile view counter (the senior profile route calls this; it was missing from the migrations)
CREATE OR REPLACE FUNCTION fn_increment_senior_views(p_code TEXT) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE senior_profiles SET profile_views = profile_views + 1
  WHERE senior_code = p_code AND status = 'published' AND consent = true
    AND student_id IS DISTINCT FROM fn_current_student_id();
$$;
REVOKE EXECUTE ON FUNCTION fn_increment_senior_views(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_increment_senior_views(TEXT) TO app_student, app_senior, app_faculty, app_admin;

-- 10. Skill-graph tables used by the Admin "Graph" tab when Neo4j is not running (were never in a migration)
CREATE TABLE IF NOT EXISTS graph_related_skills (
  skill_a_id INT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  skill_b_id INT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  strength   NUMERIC(4,1) NOT NULL DEFAULT 1 CHECK (strength BETWEEN 1 AND 10),
  PRIMARY KEY (skill_a_id, skill_b_id),
  CHECK (skill_a_id <> skill_b_id)
);
CREATE TABLE IF NOT EXISTS graph_skill_clusters (
  cluster_name TEXT NOT NULL,
  skill_id     INT  NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  PRIMARY KEY (cluster_name, skill_id)
);
GRANT SELECT ON graph_related_skills, graph_skill_clusters TO app_student, app_senior, app_faculty, app_admin;
GRANT INSERT, UPDATE, DELETE ON graph_related_skills, graph_skill_clusters TO app_admin;
