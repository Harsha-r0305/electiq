-- ElectIQ :: 06_curriculum_roles.sql
-- Accommodates the complete Electives I-IV curriculum, verticals, and role elective paths.

-- 1. Expand course code length for UE24* codes (e.g., UE24CS343BB12 is 13 chars)
ALTER TABLE courses ALTER COLUMN code TYPE VARCHAR(30);

-- 2. Add elective metadata to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS vertical VARCHAR(50);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS elective_slot VARCHAR(50);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_elective BOOLEAN DEFAULT true;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS advisor_scope_outlook NUMERIC(3,1);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS content_source TEXT;

-- 3. Expand senior code if needed
ALTER TABLE senior_profiles ALTER COLUMN senior_code TYPE VARCHAR(30);

-- 4. Role elective paths table for pre-computed and graph-ranked recommendations
CREATE TABLE IF NOT EXISTS role_elective_paths (
  path_id         SERIAL PRIMARY KEY,
  role_id         INT NOT NULL REFERENCES job_roles(role_id) ON DELETE CASCADE,
  rank            INT NOT NULL,
  course_id       INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  elective_slot   VARCHAR(50),
  skill_match_pct INT NOT NULL,
  UNIQUE(role_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_role_elective_paths_role ON role_elective_paths(role_id, rank);
CREATE INDEX IF NOT EXISTS idx_role_elective_paths_course ON role_elective_paths(course_id);

-- 5. Extra permissions
GRANT SELECT ON role_elective_paths TO app_student, app_senior, app_faculty, app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_elective_paths TO app_admin;
GRANT USAGE, SELECT ON SEQUENCE role_elective_paths_path_id_seq TO app_student, app_senior, app_faculty, app_admin;

