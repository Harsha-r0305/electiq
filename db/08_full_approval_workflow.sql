-- ElectIQ :: 08_full_approval_workflow.sql
-- Implements complete end-to-end Senior submission -> Faculty academic review -> Admin verification & publication -> Live Student Dashboard synchronization.

-- 1. Extend senior_profiles status and review tracking
DO $$
BEGIN
  ALTER TABLE senior_profiles DROP CONSTRAINT IF EXISTS senior_profiles_status_check;
  ALTER TABLE senior_profiles ADD CONSTRAINT senior_profiles_status_check
    CHECK (status IN ('draft', 'submitted', 'under_review', 'faculty_approved', 'changes_requested', 'approved', 'published', 'rejected'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS faculty_reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS faculty_notes TEXT;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS faculty_reviewed_at TIMESTAMPTZ;

-- 2. Extend placements with verification and evidence fields
ALTER TABLE placements ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'verified';
DO $$
BEGIN
  ALTER TABLE placements DROP CONSTRAINT IF EXISTS placements_verification_status_check;
  ALTER TABLE placements ADD CONSTRAINT placements_verification_status_check
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE placements ADD COLUMN IF NOT EXISTS evidence_text TEXT;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS verified_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 3. Extend feedback with moderation tracking
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
DO $$
BEGIN
  ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_moderation_status_check;
  ALTER TABLE feedback ADD CONSTRAINT feedback_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS faculty_id INT REFERENCES faculty(faculty_id) ON DELETE SET NULL;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS faculty_notes TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 4. Extend exam_questions with review tracking
DO $$
BEGIN
  ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_status_check;
  ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS review_comment TEXT;

-- 5. Extend projects with moderation status
ALTER TABLE projects ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
DO $$
BEGIN
  ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_moderation_status_check;
  ALTER TABLE projects ADD CONSTRAINT projects_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 6. Extend publications with separate moderation status
ALTER TABLE publications ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
DO $$
BEGIN
  ALTER TABLE publications DROP CONSTRAINT IF EXISTS publications_moderation_status_check;
  ALTER TABLE publications ADD CONSTRAINT publications_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE publications ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 7. Extend achievements (hackathons) with moderation status
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
DO $$
BEGIN
  ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_moderation_status_check;
  ALTER TABLE achievements ADD CONSTRAINT achievements_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 8. Extend extra_activities with moderation status
ALTER TABLE extra_activities ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
DO $$
BEGIN
  ALTER TABLE extra_activities DROP CONSTRAINT IF EXISTS extra_activities_moderation_status_check;
  ALTER TABLE extra_activities ADD CONSTRAINT extra_activities_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE extra_activities ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE extra_activities ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE extra_activities ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 9. Extend interview_prep with moderation status
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
DO $$
BEGIN
  ALTER TABLE interview_prep DROP CONSTRAINT IF EXISTS interview_prep_moderation_status_check;
  ALTER TABLE interview_prep ADD CONSTRAINT interview_prep_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- 10. Extend resources with moderation status
ALTER TABLE resources ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) DEFAULT 'approved';
DO $$
BEGIN
  ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_moderation_status_check;
  ALTER TABLE resources ADD CONSTRAINT resources_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'changes_requested'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE resources ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- 11. Academic Correction Requests Table
CREATE TABLE IF NOT EXISTS academic_correction_requests (
  request_id   SERIAL PRIMARY KEY,
  student_id   INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  issue_type   VARCHAR(50) NOT NULL,
  description  TEXT NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  admin_reply  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Extend returned_items
ALTER TABLE returned_items ADD COLUMN IF NOT EXISTS reviewer_role VARCHAR(20) DEFAULT 'admin';
ALTER TABLE returned_items ADD COLUMN IF NOT EXISTS reviewer_id INT REFERENCES users(user_id) ON DELETE SET NULL;

-- 13. Ensure existing 60 seniors remain fully verified and published
UPDATE senior_profiles
SET status = 'published', consent = true
WHERE status = 'published' OR senior_code LIKE 'S-%' AND student_id > 1;

UPDATE placements
SET verified = true, verification_status = 'verified'
WHERE verified = true OR type = 'full_time' AND student_id > 1;

UPDATE feedback
SET is_verified = true, moderation_status = 'approved'
WHERE feedback_id IS NOT NULL;

-- 14. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON academic_correction_requests TO app_senior, app_student, app_admin;
GRANT SELECT ON academic_correction_requests TO app_faculty;

GRANT SELECT, INSERT, UPDATE, DELETE ON returned_items TO app_senior, app_faculty, app_admin;
GRANT SELECT ON returned_items TO app_student;

GRANT UPDATE (status, consent, headline, linkedin_url, github_url, display_name, specialization, advice_for_juniors, show_grades, show_placements, show_internships, show_projects, show_prep, show_publications, show_hackathons, submitted_at, updated_at) ON senior_profiles TO app_senior;
GRANT UPDATE ON senior_profiles TO app_admin;
GRANT SELECT ON senior_profiles TO app_faculty, app_student;

GRANT UPDATE (verification_status, verified, verified_by, verified_at, review_notes) ON placements TO app_admin;
GRANT UPDATE (moderation_status, is_verified, faculty_id, faculty_notes, reviewed_by, reviewed_at) ON feedback TO app_faculty, app_admin;
GRANT UPDATE (status, reviewed_by, reviewed_at, review_comment) ON exam_questions TO app_faculty, app_admin;
GRANT UPDATE (moderation_status, reviewed_by, reviewed_at, review_notes) ON projects, publications, achievements, extra_activities, interview_prep TO app_faculty, app_admin;
GRANT UPDATE (moderation_status, reviewed_by, reviewed_at) ON resources TO app_admin, app_faculty;

