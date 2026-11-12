# Senior → Faculty → Admin → Student Publishing Workflow

```
Senior fills in profile, placements, internships, electives & feedback, projects, interview prep
        │  (everything the senior adds or edits is stored as "pending")
        ▼
Senior clicks "Submit for Review"      profile status: draft → submitted (consent = true)
        │
        ▼   (optional) Faculty reviews and endorses academic portion (department-scoped)
        │
        ▼   Admin reviews and verifies official documents (placement CTC, offer letters)
        │
Admin opens Admin Console → Senior Approvals → "Approve & Publish Profile"
        │  (Profile publish and contribution moderation are strictly independent)
        ▼
Admin independently verifies and approves individual placements and moderates feedback items
        │
        ▼
Students see the verified senior in Senior Explorer, approved elective reviews on course pages,
and verified placements in the Student Dashboard and Elective Comparison.
```

## Security & Workflow Rules (Enforced in PostgreSQL DBMS & API Handlers)

| Rule | Where Enforced | Implementation Detail |
|---|---|---|
| A senior can never self-publish; only submit or withdraw | Trigger `trg_senior_profile_guard` | Enforces 42501 permission denied on direct `UPDATE ... status = 'published'` from seniors. |
| Every contribution a senior adds/edits becomes `pending` | Trigger `trg_senior_item_pending` | Sets `verification_status = 'pending'`, `verified = false` on `placements`, `feedback`, `projects`, etc. |
| Editing public text of a published profile triggers re-review | Trigger `trg_senior_profile_guard` | Automatically resets profile status to `'submitted'` and clears published date. |
| Explicit senior consent required before publishing | Trigger `trg_senior_profile_guard` & Admin Route | Admin publish fails if `consent = false`. Admin cannot publish without senior consent. |
| Profile publish does NOT automatically approve contributions | `src/app/api/admin/senior-profiles/route.js` | Bulk auto-approval loop removed. Placements and feedback require independent verification. |
| Faculty input is advisory and academic only | `src/app/api/faculty/review/route.js` & `trg_senior_profile_guard` | Faculty cannot publish or hide live senior profiles; restricted to endorsing department students. |
| Students never see pending, rejected, or withdrawn contributions | Views `v_course_feedback`, `v_course_placements`, `v_course_preparation`, `v_exam_questions` & RLS | Filtered by `COALESCE(moderation_status, 'approved') = 'approved'` and `sp.status = 'published' AND sp.consent = true`. |
| Student SRNs and private identities are protected | Database views | Masked as `Senior SNR-YYYY-XXX` or custom display name; SRN never exposed to other students. |
| Students & seniors cannot modify grades or completed status | Table grants & Trigger `trg_enrollments_grade_guard` | `grade_points`, `grade_posted_at`, and `status = 'completed'` are strictly admin-writable. |
| Students & seniors can share exam questions with batch integrity | Stored Procedure `sp_share_exam_questions` & Route | Atomically inserts 1–10 questions for enrolled courses; rejects invalid exam types and unowned courses. |

## Automated Verification Suite

1. **DBMS Security Hardening Suite (`node --env-file=.env scripts/test-security-rules.mjs`):**
   - 13 comprehensive security & RLS isolation tests executed against PostgreSQL roles (`app_student`, `app_senior`, `app_faculty`, `app_admin`).
   - Verifies grade protection, consent checks, role smuggling blocks, audit log revokes, and independent moderation.

2. **Approval Workflow E2E (`node --env-file=.env scripts/test-approval-flow.mjs`):**
   - Exercises complete lifecycle: draft &rarr; self-publish attempt (blocked) &rarr; submit for review &rarr; admin publish &rarr; student visibility &rarr; senior edit (reverts to submitted).

3. **Item-Level Moderation Gate (`node --env-file=.env scripts/test-item-flow.mjs`):**
   - Verifies that new placements and feedback from published seniors remain pending and hidden until explicitly verified by admin.
