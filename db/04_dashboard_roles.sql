-- ElectIQ :: 04_dashboard_roles.sql
-- Implements role-specific dashboards, senior explorer, tiered packages, company tiers,
-- market role demands, moderation queue, dashboard designer, and impact tracking.

-- 1. Company tier (1 / 2 / 3)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tier SMALLINT CHECK (tier IN (1, 2, 3)) DEFAULT 2;

UPDATE companies SET tier = 1 WHERE name IN ('Google', 'NVIDIA', 'Microsoft', 'Amazon', 'Goldman Sachs');
UPDATE companies SET tier = 2 WHERE name IN ('Flipkart', 'Razorpay', 'Swiggy', 'Oracle', 'Cisco', 'Zoho');
UPDATE companies SET tier = 3 WHERE name IN ('Bosch', 'Accenture', 'Infosys', 'TCS', 'Wipro') OR tier IS NULL;

-- 2. Package tiers (including the new 12-20 LPA tier)
CREATE TABLE IF NOT EXISTS package_tiers (
  tier_id       SERIAL PRIMARY KEY,
  name          VARCHAR(50) NOT NULL UNIQUE,
  min_lpa       NUMERIC(5,2) NOT NULL,
  max_lpa       NUMERIC(5,2), -- NULL for 50+
  display_order INT NOT NULL DEFAULT 1
);

INSERT INTO package_tiers (name, min_lpa, max_lpa, display_order)
VALUES
  ('50+ LPA', 50.00, NULL, 1),
  ('35-50 LPA', 35.00, 50.00, 2),
  ('20-35 LPA', 20.00, 35.00, 3),
  ('12-20 LPA', 12.00, 20.00, 4),
  ('5-12 LPA', 5.00, 12.00, 5)
ON CONFLICT (name) DO UPDATE 
SET min_lpa = EXCLUDED.min_lpa, max_lpa = EXCLUDED.max_lpa, display_order = EXCLUDED.display_order;

-- 3. Senior profiles
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

-- 4. Projects extensions
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS brief TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS repo_link TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS helped_in_placement TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS placement_id INT REFERENCES placements(placement_id) ON DELETE SET NULL;

-- 5. Placements extensions
ALTER TABLE placements ADD COLUMN IF NOT EXISTS duration_months SMALLINT;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS stipend_monthly NUMERIC(8,2);
ALTER TABLE placements ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT true;

-- 6. Interview Preparation
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

-- 7. Publications
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

-- 8. Events and Hackathons (Achievements)
CREATE TABLE IF NOT EXISTS achievements (
  achievement_id SERIAL PRIMARY KEY,
  student_id     INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  event_name     TEXT NOT NULL,
  role_status    VARCHAR(20) NOT NULL CHECK (role_status IN ('participated', 'finalist', 'won')),
  position       VARCHAR(50),
  year           SMALLINT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Role Demand (Market and Industry Data)
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

-- 10. Moderation Reports (Report button queue)
CREATE TABLE IF NOT EXISTS moderation_reports (
  report_id    SERIAL PRIMARY KEY,
  reporter_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content_type VARCHAR(40) NOT NULL,
  content_id   INT NOT NULL,
  reason       TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Moderation Actions History
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

-- 12. Returned Items from Admin to Seniors
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

-- 13. Entity Requests from Seniors (New company or skill)
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

-- 14. Dashboard Designer Configuration
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

-- 15. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  key        VARCHAR(50) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO system_settings (key, value)
VALUES 
  ('current_term', '2026-ODD'),
  ('academic_year', '2026-2027'),
  ('market_data_quarter', 'Q3 2026'),
  ('market_data_source', 'LinkedIn Economic Graph & NASSCOM Campus Hiring Pulse')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 16. Flags on content (is_hidden, is_verified, admin_edited)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS admin_edited BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE interview_questions ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- 17. View: v_senior_tier
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
  ORDER BY p.student_id, p.package_lpa DESC, p.year DESC
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

-- 18. Grants and Permissions
GRANT SELECT ON package_tiers, role_demand, system_settings TO app_student, app_senior, app_faculty, app_admin;
GRANT SELECT ON v_senior_tier TO app_student, app_faculty, app_admin;
GRANT SELECT ON senior_profiles, publications, achievements, interview_prep TO app_student, app_faculty, app_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON senior_profiles, publications, achievements, interview_prep TO app_senior;
GRANT SELECT, INSERT, UPDATE, DELETE ON entity_requests TO app_senior;
GRANT SELECT, UPDATE ON returned_items TO app_senior;

GRANT INSERT ON moderation_reports TO app_student, app_senior, app_faculty;
GRANT SELECT, UPDATE, DELETE ON moderation_reports TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_actions, returned_items, dashboard_designer_config, package_tiers, role_demand, system_settings, entity_requests TO app_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON companies TO app_admin;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_student, app_senior, app_faculty, app_admin;

