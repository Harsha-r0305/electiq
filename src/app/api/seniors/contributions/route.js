import { handler } from '@/lib/route';
import { int, str } from '@/lib/validate';

export const POST = handler(['senior'], async ({ session, body, db }) => {
  return await db(async (c) => {
    const studentRes = await c.query('SELECT student_id FROM students WHERE user_id = $1', [session.uid]);
    const sid = studentRes.rows[0]?.student_id;
    if (!sid) return { error: 'Student record not found' };

    // Seniors never publish anything themselves: every item they add or edit is 'pending' until an
    // administrator approves it (also enforced by the senior_item_pending trigger in the database).
    const isPublished = false;

    const { section, action = 'create', data } = body;

    // 1. Course Feedback (Electives Taken & Feedback)
    if (section === 'feedback') {
      if (action === 'create' || action === 'update') {
        let enrId = data.enrollment_id ? parseInt(data.enrollment_id) : null;
        const courseId = data.course_id ? parseInt(data.course_id) : null;

        let enrRow = null;
        if (enrId) {
          const res = await c.query(
            `SELECT enrollment_id, status, grade_points FROM enrollments WHERE enrollment_id = $1 AND student_id = $2`,
            [enrId, sid]
          );
          enrRow = res.rows[0];
        } else if (courseId) {
          const res = await c.query(
            `SELECT enrollment_id, status, grade_points FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = 'completed' AND grade_points IS NOT NULL LIMIT 1`,
            [sid, courseId]
          );
          enrRow = res.rows[0];
          if (enrRow) enrId = enrRow.enrollment_id;
        }

        if (!enrRow || enrRow.status !== 'completed' || enrRow.grade_points === null) {
          return { error: 'Feedback can only be submitted for completed courses with an official posted grade.' };
        }

        const diff = int(data.difficulty || 3, 'Difficulty', { min: 1, max: 5 });
        const work = int(data.workload || 3, 'Workload', { min: 1, max: 5 });
        const use = int(data.usefulness || 4, 'Usefulness', { min: 1, max: 5 });
        const text = data.review_text?.trim() || null;
        const plcHelp = data.placement_help !== false;
        const extraNeeded = data.extra_prep_needed?.trim() || null;
        const recResources = data.recommended_resources?.trim() || null;
        const juniorAdvice = data.advice_for_juniors?.trim() || null;

        const fbVerified = isPublished ? true : false;
        const fbStatus = isPublished ? 'approved' : 'pending';

        await c.query(`
          INSERT INTO feedback (
            enrollment_id, difficulty, workload, usefulness, review_text,
            placement_help, extra_prep_needed, recommended_resources, advice_for_juniors,
            is_verified, moderation_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (enrollment_id) DO UPDATE SET
            difficulty = EXCLUDED.difficulty,
            workload = EXCLUDED.workload,
            usefulness = EXCLUDED.usefulness,
            review_text = EXCLUDED.review_text,
            placement_help = EXCLUDED.placement_help,
            extra_prep_needed = EXCLUDED.extra_prep_needed,
            recommended_resources = EXCLUDED.recommended_resources,
            advice_for_juniors = EXCLUDED.advice_for_juniors,
            is_verified = EXCLUDED.is_verified,
            moderation_status = EXCLUDED.moderation_status
        `, [enrId, diff, work, use, text, plcHelp, extraNeeded, recResources, juniorAdvice, fbVerified, fbStatus]);
        return { ok: true, message: isPublished ? 'Elective details and feedback published live!' : 'Elective details and feedback saved. It will appear to students after admin approval.' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM feedback WHERE feedback_id = $1', [data.feedback_id]);
        return { ok: true, message: 'Feedback removed.' };
      }
    }

    // 2. Placements (Full-time) & 3. Internships
    if (section === 'placement' || section === 'internship') {
      const plcVerified = isPublished ? true : false;
      const plcStatus = isPublished ? 'verified' : 'pending';

      if (action === 'create') {
        const compId = int(data.company_id, 'Company');
        const roleId = int(data.role_id, 'Role');
        const pkg = parseFloat(data.package_lpa);
        const year = int(data.year, 'Year', { min: 2015, max: 2100 });
        const type = section === 'internship' ? 'internship' : (data.type || 'full_time');
        const duration = data.duration_months ? int(data.duration_months, 'Duration') : null;
        const stipend = data.stipend_monthly ? parseFloat(data.stipend_monthly) : null;
        const location = data.location?.trim() || 'Bengaluru, India';
        const isRemote = Boolean(data.is_remote);
        const techStack = data.tech_stack?.trim() || null;
        const workDesc = data.work_description?.trim() || null;
        const ppo = Boolean(data.ppo_received);
        const mode = data.placement_mode || 'on_campus';
        const evidence = data.evidence_text?.trim() || null;

        await c.query(`
          INSERT INTO placements (
            student_id, company_id, role_id, type, package_lpa, year,
            duration_months, stipend_monthly, verified, verification_status,
            location, is_remote, tech_stack, work_description, ppo_received, placement_mode, evidence_text
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (student_id, company_id, type, year) DO UPDATE SET
            role_id = EXCLUDED.role_id,
            package_lpa = EXCLUDED.package_lpa,
            duration_months = EXCLUDED.duration_months,
            stipend_monthly = EXCLUDED.stipend_monthly,
            verified = EXCLUDED.verified,
            verification_status = EXCLUDED.verification_status,
            location = EXCLUDED.location,
            is_remote = EXCLUDED.is_remote,
            tech_stack = EXCLUDED.tech_stack,
            work_description = EXCLUDED.work_description,
            ppo_received = EXCLUDED.ppo_received,
            placement_mode = EXCLUDED.placement_mode,
            evidence_text = EXCLUDED.evidence_text
        `, [sid, compId, roleId, type, pkg, year, duration, stipend, plcVerified, plcStatus, location, isRemote, techStack, workDesc, ppo, mode, evidence]);
        return { ok: true, message: isPublished ? `${type === 'internship' ? 'Internship' : 'Placement offer'} recorded and published live!` : `${type === 'internship' ? 'Internship' : 'Placement'} submitted (pending admin verification).` };
      } else if (action === 'update') {
        const plcId = int(data.placement_id, 'Placement ID');
        const compId = int(data.company_id, 'Company');
        const roleId = int(data.role_id, 'Role');
        const pkg = parseFloat(data.package_lpa);
        const year = int(data.year, 'Year', { min: 2015, max: 2100 });
        const duration = data.duration_months ? int(data.duration_months, 'Duration') : null;
        const stipend = data.stipend_monthly ? parseFloat(data.stipend_monthly) : null;
        const location = data.location?.trim() || 'Bengaluru, India';
        const isRemote = Boolean(data.is_remote);
        const techStack = data.tech_stack?.trim() || null;
        const workDesc = data.work_description?.trim() || null;
        const ppo = Boolean(data.ppo_received);
        const mode = data.placement_mode || 'on_campus';
        const evidence = data.evidence_text?.trim() || null;

        await c.query(`
          UPDATE placements
          SET company_id = $1, role_id = $2, package_lpa = $3, year = $4,
              duration_months = $5, stipend_monthly = $6, location = $7, is_remote = $8,
              tech_stack = $9, work_description = $10, ppo_received = $11, placement_mode = $12,
              evidence_text = $13, verified = $14, verification_status = $15
          WHERE placement_id = $16 AND student_id = $17
        `, [compId, roleId, pkg, year, duration, stipend, location, isRemote, techStack, workDesc, ppo, mode, evidence, plcVerified, plcStatus, plcId, sid]);
        return { ok: true, message: isPublished ? 'Placement offer updated and synchronized live!' : 'Placement updated and resubmitted for admin approval.' };
      } else if (action === 'delete') {
        const pId = parseInt(data.placement_id, 10);
        console.log(`[DELETE PLACEMENT] attempting delete placement_id=${pId}, sid=${sid}`);
        const delRes = await c.query('DELETE FROM placements WHERE placement_id = $1 AND student_id = $2', [pId, sid]);
        console.log(`[DELETE PLACEMENT] rowCount deleted: ${delRes.rowCount}`);
        return { ok: true, message: 'Record removed.' };
      }
    }

    // 4. Interview Preparation
    if (section === 'interview_prep') {
      if (action === 'create' || action === 'update') {
        const plcId = data.placement_id ? int(data.placement_id, 'Placement ID') : null;
        const weeks = data.weeks ? int(data.weeks, 'Weeks', { min: 1, max: 100 }) : 10;
        const prepStatus = isPublished ? 'approved' : 'pending';
        
        if (data.prep_id) {
          await c.query(`
            UPDATE interview_prep
            SET placement_id = $1, strategy = $2, weeks = $3, resources = $4, tips = $5,
                dsa_strategy = $6, languages_used = $7, core_subjects_revised = $8, mock_interviews = $9,
                platforms_used = $10, hr_prep = $11, company_prep = $12, mistakes_to_avoid = $13,
                moderation_status = $14
            WHERE prep_id = $15 AND student_id = $16
          `, [
            plcId, data.strategy, weeks, data.resources, data.tips,
            data.dsa_strategy, data.languages_used, data.core_subjects_revised,
            data.mock_interviews, data.platforms_used, data.hr_prep,
            data.company_prep, data.mistakes_to_avoid, prepStatus, data.prep_id, sid
          ]);
        } else {
          await c.query(`
            INSERT INTO interview_prep (
              student_id, placement_id, strategy, weeks, resources, tips,
              dsa_strategy, languages_used, core_subjects_revised, mock_interviews,
              platforms_used, hr_prep, company_prep, mistakes_to_avoid, moderation_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, [
            sid, plcId, data.strategy, weeks, data.resources, data.tips,
            data.dsa_strategy, data.languages_used, data.core_subjects_revised,
            data.mock_interviews, data.platforms_used, data.hr_prep,
            data.company_prep, data.mistakes_to_avoid, prepStatus
          ]);
        }
        return { ok: true, message: isPublished ? 'Interview preparation guide published live!' : 'Interview preparation guide saved (pending admin approval).' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM interview_prep WHERE prep_id = $1 AND student_id = $2', [data.prep_id, sid]);
        return { ok: true, message: 'Interview preparation guide deleted.' };
      }
    }

    // 5. Recruiter Interview Questions
    if (section === 'interview_questions') {
      if (action === 'create') {
        const courseId = int(data.course_id, 'Course');
        const plcId = data.placement_id ? int(data.placement_id, 'Placement') : null;
        const text = str(data.question_text, 'Question text', { min: 5 });
        const round = str(data.round || 'technical', 'Round');
        const diff = int(data.difficulty || 3, 'Difficulty', { min: 1, max: 5 });

        await c.query(`
          INSERT INTO interview_questions (course_id, placement_id, question_text, round, difficulty)
          VALUES ($1, $2, $3, $4, $5)
        `, [courseId, plcId, text, round, diff]);
        return { ok: true, message: 'Interview question added.' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM interview_questions WHERE question_id = $1', [data.question_id]);
        return { ok: true, message: 'Question removed.' };
      }
    }

    // 6. Elective-Specific Exam Questions (ISA 1, ISA 2, ESA)
    if (section === 'exam_questions') {
      if (action === 'create' || action === 'update') {
        const courseId = int(data.course_id, 'Course');
        let examType = str(data.exam_type, 'Exam Type');
        if (examType === 'ISA 1') examType = 'ISA1';
        if (examType === 'ISA 2') examType = 'ISA2';
        const qText = str(data.question_text, 'Question Text', { min: 10 });
        const marks = data.marks ? int(data.marks, 'Marks', { min: 1, max: 100 }) : 10;
        const topic = data.topic?.trim() || 'General';
        const diff = int(data.difficulty || 3, 'Difficulty', { min: 1, max: 5 });
        const ansText = data.answer_text?.trim() || null;
        const yr = data.year ? int(data.year, 'Year', { min: 2015, max: 2100 }) : 2025;
        const sem = data.semester ? int(data.semester, 'Semester', { min: 1, max: 8 }) : 5;
        const eqStatus = isPublished ? 'verified' : 'pending';

        if (data.exam_question_id) {
          await c.query(`
            UPDATE exam_questions
            SET course_id = $1, exam_type = $2, question_text = $3, marks = $4,
                topic = $5, difficulty = $6, answer_text = $7, year = $8, semester = $9,
                status = $10
            WHERE exam_question_id = $11 AND contributor_id = $12
          `, [courseId, examType, qText, marks, topic, diff, ansText, yr, sem, eqStatus, data.exam_question_id, sid]);
        } else {
          await c.query(`
            INSERT INTO exam_questions (
              course_id, exam_type, question_text, marks, topic,
              difficulty, answer_text, year, semester, status, contributor_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [courseId, examType, qText, marks, topic, diff, ansText, yr, sem, eqStatus, sid]);
        }
        return { ok: true, message: isPublished ? 'Exam question published live!' : 'Exam question submitted (pending admin approval).' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM exam_questions WHERE exam_question_id = $1 AND contributor_id = $2', [data.exam_question_id, sid]);
        return { ok: true, message: 'Exam question removed.' };
      }
    }

    // 7. Extra Preparation (Activities)
    if (section === 'extra_prep') {
      if (action === 'create' || action === 'update') {
        const courseId = data.course_id ? int(data.course_id, 'Course') : null;
        const type = str(data.type, 'Type');
        const platform = str(data.platform, 'Platform');
        const hours = parseFloat(data.hours_spent) || 0;
        const title = data.title?.trim() || null;
        const skills = data.skills_covered?.trim() || null;
        const cert = Boolean(data.certificate_obtained);
        const url = data.resource_url?.trim() || null;
        const actStatus = isPublished ? 'approved' : 'pending';

        if (data.activity_id) {
          await c.query(`
            UPDATE extra_activities
            SET course_id = $1, type = $2, platform = $3, hours_spent = $4,
                title = $5, skills_covered = $6, certificate_obtained = $7, resource_url = $8,
                moderation_status = $9
            WHERE activity_id = $10 AND student_id = $11
          `, [courseId, type, platform, hours, title, skills, cert, url, actStatus, data.activity_id, sid]);
        } else {
          await c.query(`
            INSERT INTO extra_activities (
              student_id, course_id, type, platform, hours_spent,
              title, skills_covered, certificate_obtained, resource_url, moderation_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [sid, courseId, type, platform, hours, title, skills, cert, url, actStatus]);
        }
        return { ok: true, message: isPublished ? 'Preparation activity published live!' : 'Preparation activity saved (pending admin approval).' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM extra_activities WHERE activity_id = $1 AND student_id = $2', [data.activity_id, sid]);
        return { ok: true, message: 'Activity deleted.' };
      }
    }

    // 8. Projects & Placement-Project Links
    if (section === 'projects') {
      if (action === 'create' || action === 'update') {
        const courseId = data.course_id ? int(data.course_id, 'Course') : null;
        const title = str(data.title, 'Project Title');
        const brief = data.brief?.trim() || null;
        const problemStatement = data.problem_statement?.trim() || null;
        const techStack = data.tech_stack?.trim() || null;
        const repo = data.repo_link?.trim() || null;
        const liveDemo = data.live_demo_link?.trim() || null;
        const outcome = data.outcome?.trim() || null;
        const helped = data.helped_in_placement?.trim() || null;
        const plcId = data.placement_id ? int(data.placement_id, 'Placement ID') : null;
        const isCompleted = data.is_completed !== false;
        const prjStatus = isPublished ? 'approved' : 'pending';

        if (data.project_id) {
          await c.query(`
            UPDATE projects
            SET course_id = $1, title = $2, brief = $3, problem_statement = $4,
                tech_stack = $5, repo_link = $6, live_demo_link = $7, outcome = $8,
                helped_in_placement = $9, placement_id = $10, is_completed = $11,
                moderation_status = $12
            WHERE project_id = $13 AND student_id = $14
          `, [courseId, title, brief, problemStatement, techStack, repo, liveDemo, outcome, helped, plcId, isCompleted, prjStatus, data.project_id, sid]);
        } else {
          const prjRes = await c.query(`
            INSERT INTO projects (
              student_id, course_id, title, brief, problem_statement, tech_stack,
              repo_link, live_demo_link, outcome, helped_in_placement, placement_id, is_completed, moderation_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING project_id
          `, [sid, courseId, title, brief, problemStatement, techStack, repo, liveDemo, outcome, helped, plcId, isCompleted, prjStatus]);
          const pid = prjRes.rows[0].project_id;

          if (Array.isArray(data.skill_ids)) {
            for (const skid of data.skill_ids) {
              await c.query('INSERT INTO project_skills (project_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [pid, skid]);
            }
          }
        }
        return { ok: true, message: isPublished ? 'Project published live!' : 'Project saved (pending admin approval).' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM projects WHERE project_id = $1 AND student_id = $2', [data.project_id, sid]);
        return { ok: true, message: 'Project removed.' };
      }
    }

    // 9. Research Publications
    if (section === 'publications') {
      if (action === 'create' || action === 'update') {
        const title = str(data.title, 'Title');
        const venue = str(data.venue, 'Venue');
        const type = str(data.type, 'Type');
        const year = int(data.year, 'Year', { min: 2015, max: 2100 });
        const link = data.link?.trim() || null;
        const status = data.status?.trim() || 'published'; // research publication status
        const topic = data.topic?.trim() || null;
        const doi = data.doi?.trim() || null;
        const abstract = data.abstract?.trim() || null;
        const pubModStatus = isPublished ? 'approved' : 'pending';

        if (data.pub_id) {
          await c.query(`
            UPDATE publications
            SET title = $1, venue = $2, type = $3, year = $4, link = $5,
                status = $6, topic = $7, doi = $8, abstract = $9, moderation_status = $10
            WHERE pub_id = $11 AND student_id = $12
          `, [title, venue, type, year, link, status, topic, doi, abstract, pubModStatus, data.pub_id, sid]);
        } else {
          await c.query(`
            INSERT INTO publications (
              student_id, title, venue, type, year, link, status, topic, doi, abstract, moderation_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [sid, title, venue, type, year, link, status, topic, doi, abstract, pubModStatus]);
        }
        return { ok: true, message: isPublished ? 'Research publication published live!' : 'Research publication saved (pending admin approval).' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM publications WHERE pub_id = $1 AND student_id = $2', [data.pub_id, sid]);
        return { ok: true, message: 'Publication deleted.' };
      }
    }

    // 10. Events and Hackathons
    if (section === 'hackathons') {
      if (action === 'create' || action === 'update') {
        const eventName = str(data.event_name, 'Event Name');
        const roleStatus = str(data.role_status, 'Status');
        const position = data.position?.trim() || null;
        const year = int(data.year, 'Year', { min: 2015, max: 2100 });
        const organizer = data.organizer?.trim() || null;
        const projectPresented = data.project_presented?.trim() || null;
        const achModStatus = isPublished ? 'approved' : 'pending';

        if (data.achievement_id) {
          await c.query(`
            UPDATE achievements
            SET event_name = $1, role_status = $2, position = $3, year = $4,
                organizer = $5, project_presented = $6, moderation_status = $7
            WHERE achievement_id = $8 AND student_id = $9
          `, [eventName, roleStatus, position, year, organizer, projectPresented, achModStatus, data.achievement_id, sid]);
        } else {
          await c.query(`
            INSERT INTO achievements (
              student_id, event_name, role_status, position, year, organizer, project_presented, moderation_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [sid, eventName, roleStatus, position, year, organizer, projectPresented, achModStatus]);
        }
        return { ok: true, message: isPublished ? 'Achievement published live!' : 'Achievement logged (pending admin approval).' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM achievements WHERE achievement_id = $1 AND student_id = $2', [data.achievement_id, sid]);
        return { ok: true, message: 'Achievement deleted.' };
      }
    }

    // 11. Resources
    if (section === 'resources') {
      if (action === 'create') {
        const courseId = int(data.course_id, 'Course');
        const type = str(data.type, 'Type');
        const title = str(data.title, 'Title');
        const url = data.url?.trim() || null;

        await c.query(`
          INSERT INTO resources (course_id, type, title, url, added_by, moderation_status)
          VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [courseId, type, title, url, session.uid]);
        return { ok: true, message: 'Resource shared (pending admin approval).' };
      } else if (action === 'delete') {
        await c.query('DELETE FROM resources WHERE resource_id = $1 AND added_by = $2', [data.resource_id, session.uid]);
        return { ok: true, message: 'Resource deleted.' };
      }
    }

    // Returned items reply & resolution
    if (section === 'returned_notice') {
      await c.query(`
        UPDATE returned_items
        SET senior_reply = $1, status = 'resubmitted', updated_at = now()
        WHERE notice_id = $2 AND student_id = $3
      `, [data.reply, data.notice_id, sid]);

      // Set profile to submitted so reviewers can see the update
      await c.query(`
        UPDATE senior_profiles
        SET status = 'submitted', updated_at = now()
        WHERE student_id = $1 AND status = 'changes_requested'
      `, [sid]);

      return { ok: true, message: 'Corrections and explanation submitted.' };
    }

    // Entity Requests (Request new recruiting company or skill)
    if (section === 'entity_request') {
      const type = str(data.type, 'Type');
      const name = str(data.name, 'Name');
      const details = data.details?.trim() || null;

      await c.query(`
        INSERT INTO entity_requests (student_id, type, name, details)
        VALUES ($1, $2, $3, $4)
      `, [sid, type, name, details]);
      return { ok: true, message: 'Request submitted to administrators.' };
    }

    return { error: 'Unknown contribution section' };
  });
});

export const dynamic = 'force-dynamic';
