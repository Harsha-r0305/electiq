-- ElectIQ :: 07_enhanced_experience.sql
-- Adds rich schema attributes for senior placement experiences, structured interview prep,
-- multi-entry internships/projects/papers/events, elective feedback extensions,
-- and elective-specific examination questions.

-- 1. Extend senior_profiles
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS github_url TEXT;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS advice_for_juniors TEXT;
ALTER TABLE senior_profiles ADD COLUMN IF NOT EXISTS specialization VARCHAR(100);

-- Update status constraint on senior_profiles to support complete workflow
DO $$
BEGIN
  ALTER TABLE senior_profiles DROP CONSTRAINT IF EXISTS senior_profiles_status_check;
  ALTER TABLE senior_profiles ADD CONSTRAINT senior_profiles_status_check
    CHECK (status IN ('draft', 'submitted', 'approved', 'published', 'rejected'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Extend interview_prep with structured prompts
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS dsa_strategy TEXT;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS languages_used TEXT;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS core_subjects_revised TEXT;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS mock_interviews TEXT;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS platforms_used TEXT;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS hr_prep TEXT;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS company_prep TEXT;
ALTER TABLE interview_prep ADD COLUMN IF NOT EXISTS mistakes_to_avoid TEXT;

-- 3. Extend projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS problem_statement TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tech_stack TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS live_demo_link TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS outcome TEXT;

-- 4. Extend publications
ALTER TABLE publications ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'published';
ALTER TABLE publications ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS doi TEXT;
ALTER TABLE publications ADD COLUMN IF NOT EXISTS abstract TEXT;

-- 5. Extend achievements
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS organizer TEXT;
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS project_presented TEXT;

-- 6. Extend extra_activities
ALTER TABLE extra_activities ADD COLUMN IF NOT EXISTS title VARCHAR(200);
ALTER TABLE extra_activities ADD COLUMN IF NOT EXISTS skills_covered TEXT;
ALTER TABLE extra_activities ADD COLUMN IF NOT EXISTS certificate_obtained BOOLEAN DEFAULT false;
ALTER TABLE extra_activities ADD COLUMN IF NOT EXISTS resource_url TEXT;

-- 7. Extend placements (internships & full time)
ALTER TABLE placements ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE placements ADD COLUMN IF NOT EXISTS is_remote BOOLEAN DEFAULT false;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS tech_stack TEXT;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS work_description TEXT;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS ppo_received BOOLEAN DEFAULT false;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS placement_mode VARCHAR(20) DEFAULT 'on_campus';

-- 8. Extend feedback for elective-specific insights
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS placement_help BOOLEAN DEFAULT true;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS extra_prep_needed TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS recommended_resources TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS advice_for_juniors TEXT;

-- 9. Extend exam_questions
ALTER TABLE exam_questions ALTER COLUMN enrollment_id DROP NOT NULL;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS answer_text TEXT;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS year SMALLINT;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS semester SMALLINT;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS contributor_id INT REFERENCES students(student_id) ON DELETE SET NULL;

-- 10. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_placements_package ON placements(package_lpa);
CREATE INDEX IF NOT EXISTS idx_placements_type ON placements(type);
CREATE INDEX IF NOT EXISTS idx_courses_is_elective ON courses(is_elective);
CREATE INDEX IF NOT EXISTS idx_courses_elective_slot ON courses(elective_slot);
CREATE INDEX IF NOT EXISTS idx_exam_questions_course ON exam_questions(course_id, exam_type);

-- 11. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON interview_prep, projects, publications, achievements, extra_activities, feedback TO app_senior, app_admin;
GRANT SELECT ON interview_prep, projects, publications, achievements, extra_activities, feedback TO app_student, app_faculty;
GRANT SELECT, INSERT, UPDATE, DELETE ON exam_questions TO app_senior, app_faculty, app_admin;
GRANT SELECT ON exam_questions TO app_student;
