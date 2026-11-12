-- ElectIQ :: 01_schema.sql
-- Relational schema (PostgreSQL 14+). Run as the owner role (e.g. postgres).
-- Demonstrates CREATE, constraints, indexes, generated tsvector columns, ALTER and DROP.

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE TABLE departments (
  dept_id   SERIAL PRIMARY KEY,
  name      VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE users (
  user_id       SERIAL PRIMARY KEY,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash CHAR(60) NOT NULL,                      -- bcrypt hash, never plain text
  role          VARCHAR(10) NOT NULL DEFAULT 'student'
                CHECK (role IN ('student','senior','faculty','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE TABLE students (
  student_id  SERIAL PRIMARY KEY,
  user_id     INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  srn         VARCHAR(15) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  dept_id     INT NOT NULL REFERENCES departments(dept_id),
  batch_year  SMALLINT NOT NULL CHECK (batch_year BETWEEN 2000 AND 2100)
);

CREATE TABLE faculty (
  faculty_id  SERIAL PRIMARY KEY,
  user_id     INT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  dept_id     INT NOT NULL REFERENCES departments(dept_id),
  name        VARCHAR(100) NOT NULL,
  designation VARCHAR(50) NOT NULL DEFAULT 'Assistant Professor'
);

CREATE TABLE courses (
  course_id  SERIAL PRIMARY KEY,
  code       VARCHAR(30) NOT NULL UNIQUE,
  title      VARCHAR(150) NOT NULL,
  dept_id    INT NOT NULL REFERENCES departments(dept_id),
  faculty_id INT REFERENCES faculty(faculty_id) ON DELETE SET NULL,
  credits    SMALLINT NOT NULL CHECK (credits BETWEEN 1 AND 6),
  semester   SMALLINT NOT NULL CHECK (semester BETWEEN 1 AND 8),
  level      VARCHAR(12) NOT NULL CHECK (level IN ('foundation','intermediate','advanced')),
  vertical   VARCHAR(50),
  elective_slot VARCHAR(50),
  is_elective BOOLEAN DEFAULT true,
  advisor_scope_outlook NUMERIC(3,1),
  content_source TEXT
);

-- Self-referencing many-to-many on courses: prerequisite chains
CREATE TABLE course_prerequisites (
  course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  prereq_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, prereq_id),
  CHECK (course_id <> prereq_id)
);

CREATE TABLE enrollments (
  enrollment_id   SERIAL PRIMARY KEY,
  student_id      INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  course_id       INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  term            VARCHAR(10) NOT NULL,
  status          VARCHAR(10) NOT NULL DEFAULT 'enrolled'
                  CHECK (status IN ('enrolled','completed','dropped')),
  grade_points    NUMERIC(3,1) CHECK (grade_points BETWEEN 0 AND 10),   -- NULL until posted
  grade_posted_at TIMESTAMPTZ,
  UNIQUE (student_id, course_id),
  CHECK ((grade_points IS NULL) = (grade_posted_at IS NULL))
);

CREATE TABLE feedback (
  feedback_id   SERIAL PRIMARY KEY,
  enrollment_id INT NOT NULL UNIQUE REFERENCES enrollments(enrollment_id) ON DELETE CASCADE,
  difficulty    SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  workload      SMALLINT NOT NULL CHECK (workload BETWEEN 1 AND 5),
  usefulness    SMALLINT NOT NULL CHECK (usefulness BETWEEN 1 AND 5),
  review_text   TEXT,
  review_tsv    TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(review_text,''))) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resources (
  resource_id SERIAL PRIMARY KEY,
  course_id   INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('book','video','notes','practice')),
  title       VARCHAR(200) NOT NULL,
  url         TEXT,
  added_by    INT REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE skills (
  skill_id SERIAL PRIMARY KEY,
  name     VARCHAR(80) NOT NULL UNIQUE,
  category VARCHAR(40) NOT NULL
);

CREATE TABLE course_skills (
  course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  skill_id  INT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  depth     SMALLINT NOT NULL DEFAULT 1 CHECK (depth BETWEEN 1 AND 3),
  PRIMARY KEY (course_id, skill_id)
);

CREATE TABLE projects (
  project_id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  course_id  INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  title      VARCHAR(150) NOT NULL
);

CREATE TABLE project_skills (
  project_id INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  skill_id   INT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, skill_id)
);

CREATE TABLE companies (
  company_id SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  sector     VARCHAR(60) NOT NULL
);

CREATE TABLE job_roles (
  role_id SERIAL PRIMARY KEY,
  title   VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE role_skills (
  role_id    INT NOT NULL REFERENCES job_roles(role_id) ON DELETE CASCADE,
  skill_id   INT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  PRIMARY KEY (role_id, skill_id)
);

CREATE TABLE role_elective_paths (
  path_id         SERIAL PRIMARY KEY,
  role_id         INT NOT NULL REFERENCES job_roles(role_id) ON DELETE CASCADE,
  rank            INT NOT NULL,
  course_id       INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  elective_slot   VARCHAR(50),
  skill_match_pct INT NOT NULL,
  UNIQUE(role_id, course_id)
);

CREATE INDEX idx_role_elective_paths_role ON role_elective_paths(role_id, rank);
CREATE INDEX idx_role_elective_paths_course ON role_elective_paths(course_id);

CREATE TABLE placements (
  placement_id SERIAL PRIMARY KEY,
  student_id   INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  company_id   INT NOT NULL REFERENCES companies(company_id),
  role_id      INT NOT NULL REFERENCES job_roles(role_id),
  type         VARCHAR(10) NOT NULL CHECK (type IN ('internship','full_time')),
  package_lpa  NUMERIC(5,2) NOT NULL CHECK (package_lpa > 0),
  year         SMALLINT NOT NULL,
  UNIQUE (student_id, company_id, type, year)
);

CREATE TABLE extra_activities (
  activity_id SERIAL PRIMARY KEY,
  student_id  INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  course_id   INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL,
  platform    VARCHAR(40) NOT NULL,
  hours_spent NUMERIC(5,1) NOT NULL CHECK (hours_spent >= 0)
);

CREATE TABLE interview_questions (
  question_id   SERIAL PRIMARY KEY,
  course_id     INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  placement_id  INT REFERENCES placements(placement_id) ON DELETE SET NULL,
  question_text TEXT NOT NULL,
  round         VARCHAR(15) NOT NULL DEFAULT 'technical',
  difficulty    SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  question_tsv  TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', question_text)) STORED
);

CREATE TABLE faculty_reviews (
  review_id    SERIAL PRIMARY KEY,
  faculty_id   INT NOT NULL REFERENCES faculty(faculty_id) ON DELETE CASCADE,
  course_id    INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  relevance    SMALLINT NOT NULL CHECK (relevance BETWEEN 1 AND 5),
  future_scope SMALLINT NOT NULL CHECK (future_scope BETWEEN 1 AND 5),
  comment      TEXT,
  UNIQUE (faculty_id, course_id)
);

CREATE TABLE market_demand (
  demand_id      SERIAL PRIMARY KEY,
  skill_id       INT NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
  year           SMALLINT NOT NULL,
  postings_count INT NOT NULL CHECK (postings_count >= 0),
  demand_score   NUMERIC(3,1) NOT NULL CHECK (demand_score BETWEEN 0 AND 10),
  UNIQUE (skill_id, year)
);

CREATE TABLE audit_log (
  log_id     BIGSERIAL PRIMARY KEY,
  user_id    INT,
  action     VARCHAR(6) NOT NULL,
  table_name VARCHAR(40) NOT NULL,
  row_pk     TEXT,
  old_value  JSONB,
  new_value  JSONB,
  logged_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE login_attempts (
  attempt_id   SERIAL PRIMARY KEY,
  ip_address   VARCHAR(45) NOT NULL,
  email        VARCHAR(120),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success      BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE exam_questions (
  exam_question_id SERIAL PRIMARY KEY,
  enrollment_id    INT NOT NULL REFERENCES enrollments(enrollment_id) ON DELETE CASCADE,
  course_id        INT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,   -- set by trigger from the enrollment
  exam_type        VARCHAR(4) NOT NULL CHECK (exam_type IN ('ISA1','ISA2','ESA')),
  question_text    TEXT NOT NULL CHECK (char_length(question_text) BETWEEN 10 AND 800),
  marks            SMALLINT CHECK (marks BETWEEN 1 AND 100),
  topic            VARCHAR(100),
  difficulty       SMALLINT NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  question_tsv     TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', question_text || ' ' || coalesce(topic, ''))) STORED
);
CREATE UNIQUE INDEX uq_exam_question_dup ON exam_questions(enrollment_id, exam_type, lower(question_text));

-- ---------- Indexes ----------
CREATE INDEX idx_enrollments_course   ON enrollments(course_id);
CREATE INDEX idx_placements_student   ON placements(student_id);
CREATE INDEX idx_placements_year_pkg  ON placements(year, package_lpa);
CREATE INDEX idx_resources_course     ON resources(course_id);
CREATE INDEX idx_questions_course     ON interview_questions(course_id);
CREATE INDEX idx_prereq_prereq        ON course_prerequisites(prereq_id);
CREATE INDEX idx_feedback_tsv         ON feedback USING GIN (review_tsv);
CREATE INDEX idx_questions_tsv        ON interview_questions USING GIN (question_tsv);
CREATE INDEX idx_login_attempts       ON login_attempts(ip_address, attempted_at DESC);
CREATE INDEX idx_exam_course_type     ON exam_questions(course_id, exam_type);
CREATE INDEX idx_exam_tsv             ON exam_questions USING GIN (question_tsv);

-- ---------- ALTER / DROP demonstrations (migration style) ----------
ALTER TABLE courses    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE placements ADD CONSTRAINT chk_placement_year CHECK (year BETWEEN 2015 AND 2100);

ALTER TABLE courses ADD COLUMN legacy_code VARCHAR(10);          -- deprecated column ...
ALTER TABLE courses DROP COLUMN legacy_code;                     -- ... dropped again

CREATE INDEX idx_tmp_courses_title ON courses(title);            -- redundant index ...
DROP INDEX idx_tmp_courses_title;                                -- ... dropped again


-- ---------- Role-specific Dashboards & Senior Explorer Schema ----------
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tier SMALLINT CHECK (tier IN (1, 2, 3)) DEFAULT 2;

CREATE TABLE IF NOT EXISTS package_tiers (
  tier_id       SERIAL PRIMARY KEY,
  name          VARCHAR(50) NOT NULL UNIQUE,
  min_lpa       NUMERIC(5,2) NOT NULL,
  max_lpa       NUMERIC(5,2),
  display_order INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS senior_profiles (
  student_id       INT PRIMARY KEY REFERENCES students(student_id) ON DELETE CASCADE,
  senior_code      VARCHAR(20) NOT NULL UNIQUE,
  status           VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  consent          BOOLEAN NOT NULL DEFAULT true,
  headline         TEXT,
  linkedin_url     TEXT,
  show_grades      BOOLEAN NOT NULL DEFAULT true,
  show_placements  BOOLEAN NOT NULL DEFAULT true,
  show_internships BOOLEAN NOT NULL DEFAULT true,
  show_projects    BOOLEAN NOT NULL DEFAULT true,
  show_prep        BOOLEAN NOT NULL DEFAULT true,
  show_publications BOOLEAN NOT NULL DEFAULT true,
  show_hackathons  BOOLEAN NOT NULL DEFAULT true,
  profile_views    INT NOT NULL DEFAULT 0,
  prep_views       INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS repo_link TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS helped_in_placement TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS placement_id INT REFERENCES placements(placement_id) ON DELETE SET NULL;

ALTER TABLE placements ADD COLUMN IF NOT EXISTS duration_months SMALLINT;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS stipend_monthly NUMERIC(8,2);
ALTER TABLE placements ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS interview_prep (
  prep_id      SERIAL PRIMARY KEY,
  student_id   INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  placement_id INT REFERENCES placements(placement_id) ON DELETE SET NULL,
  strategy     TEXT,
  weeks        SMALLINT CHECK (weeks >= 0),
  resources    TEXT,
  tips         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publications (
  pub_id      SERIAL PRIMARY KEY,
  student_id  INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  venue       TEXT NOT NULL,
  type        VARCHAR(50) NOT NULL,
  year        SMALLINT NOT NULL,
  link        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS achievements (
  achievement_id SERIAL PRIMARY KEY,
  student_id     INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  event_name     TEXT NOT NULL,
  role_status    VARCHAR(20) NOT NULL CHECK (role_status IN ('participated', 'finalist', 'won')),
  position       VARCHAR(50),
  year           SMALLINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_demand (
  role_demand_id  SERIAL PRIMARY KEY,
  role_id         INT NOT NULL REFERENCES job_roles(role_id) ON DELETE CASCADE,
  year            SMALLINT NOT NULL,
  quarter         VARCHAR(10) NOT NULL,
  postings_count  INT NOT NULL CHECK (postings_count >= 0),
  demand_score    NUMERIC(3,1) NOT NULL CHECK (demand_score BETWEEN 0 AND 10),
  avg_salary_lpa  NUMERIC(5,2),
  trend_indicator VARCHAR(10) NOT NULL DEFAULT 'rising' CHECK (trend_indicator IN ('rising', 'stable', 'falling')),
  source_name     TEXT NOT NULL,
  source_link     TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, year, quarter)
);

CREATE TABLE IF NOT EXISTS moderation_reports (
  report_id    SERIAL PRIMARY KEY,
  reporter_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content_type VARCHAR(40) NOT NULL,
  content_id   INT NOT NULL,
  reason       TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  action_id    SERIAL PRIMARY KEY,
  admin_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content_type VARCHAR(40) NOT NULL,
  content_id   INT NOT NULL,
  action       VARCHAR(20) NOT NULL CHECK (action IN ('hide', 'return', 'correct', 'delete', 'verify')),
  reason       TEXT NOT NULL,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS returned_items (
  notice_id    SERIAL PRIMARY KEY,
  student_id   INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  content_type VARCHAR(40) NOT NULL,
  content_id   INT NOT NULL,
  admin_reason TEXT NOT NULL,
  senior_reply TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resubmitted', 'resolved')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entity_requests (
  request_id    SERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('company', 'skill')),
  name          TEXT NOT NULL,
  details       TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dashboard_designer_config (
  config_id     SERIAL PRIMARY KEY,
  role          VARCHAR(20) NOT NULL,
  section       VARCHAR(50) NOT NULL,
  field_key     VARCHAR(50) NOT NULL,
  label         TEXT NOT NULL,
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  is_required   BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  custom_type   VARCHAR(20),
  UNIQUE(role, section, field_key)
);

CREATE TABLE IF NOT EXISTS system_settings (
  key        VARCHAR(50) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_edited BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
