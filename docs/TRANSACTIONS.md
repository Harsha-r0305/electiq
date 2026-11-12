# ElectIQ: Transaction Architecture & Concurrency Control Guide

This document provides a comprehensive technical breakdown of transaction boundaries, ACID guarantees, row-level locking, and concurrency control in ElectIQ. It is designed as a complete viva and architectural reference.

---

## 1. Executive Summary: Why Transactions Matter in ElectIQ

ElectIQ combines relational data integrity in PostgreSQL with graph traversals in Neo4j. A university course advisory system handles concurrent operations: multiple students self-enrolling, seniors recording placements alongside interview questions, admins posting official grades, and students sharing exam question batches.

Without strict transaction boundaries:
* A placement could be recorded without its associated interview questions or preparation logs (violating **Atomicity**).
* Two administrators could concurrently grade the same student with conflicting marks (violating **Isolation**).
* Role impersonation could leak across connection-pooled queries if connection-level roles were not transaction-scoped.

---

## 2. Key Transaction Boundaries in the System

### 1. `sp_record_placement` (Atomic Multi-Table Write)
* **Location:** `db/02_logic.sql`
* **Tables Modified:** `placements`, `interview_questions`, `extra_activities`
* **What it does:** Records a student's job placement (company, role, CTC package) while simultaneously recording the interview questions they faced and the preparation platforms/hours they invested.
* **Why it needs a transaction:**
  A placement record without its questions or preparation logs produces orphaned master rows and corrupts placement analytics (`v_course_preparation` and `v_placement_analytics`). If inserting an interview question fails (e.g. invalid course foreign key or length violation), the enclosing transaction ensures that the `placements` row is rolled back completely. Zero partial records are saved.

---

### 2. `sp_post_grade` (Row Lock via `SELECT ... FOR UPDATE`)
* **Location:** `db/02_logic.sql`
* **Tables Modified:** `enrollments`
* **What it does:** Validates and posts an official academic grade (0.0 to 10.0), changes enrollment status from `'enrolled'` to `'completed'`, and records `grade_posted_at = now()`.
* **Why it needs a transaction & row lock:**
  ```sql
  SELECT grade_points INTO v_existing
  FROM enrollments
  WHERE enrollment_id = p_enrollment_id
  FOR UPDATE;
  ```
  The `FOR UPDATE` clause acquires an exclusive row-level lock on the specific `enrollments` tuple.
  - **Prevents Lost Updates & Race Conditions:** If two administrators simultaneously post or revise a student's grade, the second transaction blocks until the first completes.
  - **Prevents Double Posting:** Once the first transaction commits with a valid grade, the second transaction unblocks, reads `grade_points IS NOT NULL`, and raises an exception: `'Grade has already been posted for this enrollment'`.
  - **Gating Trigger Enactment:** Because grade posting is atomic, the gating trigger on `feedback` (`trg_feedback_grade_gate`) immediately observes the committed grade, allowing the student/senior to write their anonymous course review.

---

### 3. `withUser()` in `src/lib/db.js` (Session & Security Transaction)
* **Location:** `src/lib/db.js`
* **What it does:** Every incoming HTTP request executes inside a managed transaction:
  ```sql
  BEGIN;
  SET LOCAL ROLE app_<student|senior|faculty|admin>;
  SELECT set_config('app.user_id', :uid, true);
  -- Execute application business logic and queries
  COMMIT;
  ```
* **Why it needs a transaction:**
  Node.js uses a shared PostgreSQL connection pool (`pg.Pool`).
  - **`SET LOCAL ROLE` Scope:** `SET LOCAL` is strictly scoped to the active transaction block. When `COMMIT` or `ROLLBACK` executes, the role immediately reverts back to `app_login`.
  - **Connection Contamination Prevention:** If an unexpected error or uncaught exception crashes a request, `withUser` issues `ROLLBACK`, guaranteeing that subsequent HTTP requests reusing the pooled connection cannot inherit elevated permissions or another user's identity.

---

### 4. Audit Logging Trigger (`trg_audit_log`)
* **Location:** `db/02_logic.sql`
* **Tables Modified:** `audit_log`
* **What it does:** An `AFTER INSERT OR UPDATE OR DELETE` trigger on `enrollments` and `feedback` writes changed columns, old JSON values, new JSON values, and the acting `app.user_id` into `audit_log`.
* **Why it participates in the caller's transaction:**
  - Because triggers execute inside the caller's transaction boundary, the audit log entry is **atomically tied** to the business operation.
  - If the caller's transaction commits, the audit trail is preserved permanently.
  - If the caller's transaction rolls back (e.g., check constraint violation or database error), the audit entry is also rolled back. No "ghost audit logs" can exist for actions that never actually took effect in the database.

---

### 5. `fn_register_student` (Multi-Entity User Registration)
* **Location:** `db/02_logic.sql`
* **Tables Modified:** `users`, `students`
* **What it does:** Registers a new university student: generates a user record in `users` with role `'student'` and hashed password, then generates the linked student profile in `students` with their Student Registration Number (SRN), batch year, and department.
* **Why it needs a transaction:**
  A user account without a corresponding `students` profile cannot use student portal features and will cause null-pointer errors. The transaction guarantees that if the student's SRN violates uniqueness or department ID is invalid, the newly created row in `users` is rolled back completely.

---

### 6. Admin User and Faculty Creation
* **Location:** `src/app/api/admin/users/route.js` and `scripts/seed.mjs`
* **Tables Modified:** `users`, `faculty`
* **What it does:** When an administrator provisions a faculty account, it creates the credentials in `users` (role `'faculty'`) and the academic profile in `faculty` (designation, department).
* **Why it needs a transaction:**
  Guarantees 1:1 referential integrity between user authentication records and departmental faculty rosters.

---

### 7. `sp_share_exam_questions` (Batch Atomicity)
* **Location:** `db/02_logic.sql`
* **Tables Modified:** `exam_questions`
* **What it does:** Takes a JSONB array of 1 to 10 exam questions shared by an enrolled student for ISA1, ISA2, or ESA assessments and loops to insert them.
* **Why it needs a transaction:**
  - **All-or-Nothing Guarantee:** If a student attempts to share 5 questions and the 3rd question is a duplicate (`uq_exam_question_dup`) or has invalid marks, PostgreSQL aborts the procedure with an exception.
  - **Zero Partial Insertion:** The transaction rolls back questions 1 and 2 automatically. The student is informed of the exact validation failure and no half-submitted batches pollute the question bank.

---

## 3. Two-Session PSQL Demo: Row-Lock Wait and Rollback

To demonstrate database concurrency control live during a viva, open two terminal windows connected to PostgreSQL:

### Demo A: Row Lock Wait on `sp_post_grade` (`SELECT ... FOR UPDATE`)

#### Terminal 1 (Session 1 - Admin 1):
```sql
psql -d electiq

-- Start transaction and acquire row lock on enrollment 100
BEGIN;
SET LOCAL ROLE app_admin;
SELECT set_config('app.user_id', '1', true);

-- Lock the row and check existing grade
SELECT enrollment_id, student_id, course_id, grade_points 
FROM enrollments 
WHERE enrollment_id = 100 
FOR UPDATE;

-- Keep this transaction OPEN (do not type COMMIT yet)
```

#### Terminal 2 (Session 2 - Admin 2 attempting concurrent grade update):
```sql
psql -d electiq

-- Attempt to post a grade to the same enrollment
BEGIN;
SET LOCAL ROLE app_admin;
SELECT set_config('app.user_id', '2', true);

-- This call immediately BLOCKS waiting for Session 1 to release the row lock:
CALL sp_post_grade(100, 9.0);
```

#### Observation:
Session 2 hangs and waits. Now go back to **Terminal 1** and commit:
```sql
-- In Terminal 1:
CALL sp_post_grade(100, 8.5);
COMMIT;
```

#### Result in Terminal 2:
As soon as Terminal 1 commits, Terminal 2 unblocks immediately and fails with:
```text
ERROR: P0001: Grade has already been posted for this enrollment
```
This proves that:
1. `FOR UPDATE` serializes concurrent accesses on that specific enrollment row.
2. The second transaction re-evaluates the fresh state and avoids a conflicting write.

---

### Demo B: Atomic Rollback on Placement Failure

```sql
psql -d electiq

BEGIN;
SET LOCAL ROLE app_senior;
SELECT set_config('app.user_id', (SELECT user_id FROM users WHERE email='senior1@electiq.dev'), true);

-- Verify current placement count for this student
SELECT count(*) FROM placements WHERE student_id = fn_current_student_id();

-- Call sp_record_placement with a valid placement but an INVALID course_id (999999) in questions:
CALL sp_record_placement(
  1, 1, 'full_time', 24.0, 2026,
  '[{"course_id": 999999, "text": "What is Paxos consensus?", "round": "technical", "difficulty": 4}]'::jsonb,
  '[]'::jsonb,
  NULL
);
-- Notice the error:
-- ERROR: insert or update on table "interview_questions" violates foreign key constraint "interview_questions_course_id_fkey"

ROLLBACK;

-- Verify that NO orphan placement was created:
SELECT count(*) FROM placements WHERE package_lpa = 24.0 AND year = 2026;
-- Output: 0
```

---

## 4. Cross-Database Synchronization (PostgreSQL & Neo4j)

### Why is there no 2-Phase Commit (2PC)?
In enterprise architectures, distributed 2PC cross-database transactions across heterogeneous systems (relational SQL + graph engine) introduce severe latency, distributed deadlocks, and single-point-of-failure bottlenecks.

Instead, ElectIQ implements an **Authoritative Relational Master + Idempotent Graph Projection** pattern:
1. **PostgreSQL Commits First:** PostgreSQL is the single authoritative source of truth for all master catalog data (courses, prerequisites, skills, roles).
2. **Asynchronous / Post-Commit Graph Sync:** Graph nodes and relationships in Neo4j are updated via `src/lib/graph-sync.mjs`.
3. **Idempotent Repair (`npm run sync-graph`):**
   If Neo4j was temporarily unreachable or stopped during a PostgreSQL transaction, no cross-system corruption occurs. Running:
   ```bash
   npm run sync-graph
   ```
   runs Cypher `MERGE` statements that idempotently reconcile courses, skills, roles, and prerequisites with PostgreSQL master data.
4. **Graph-Owned State Protection:**
   The graph-native relationships (`RELATED_TO` semantic strength and `IN_CLUSTER` grouping) are owned authoritatively by Neo4j and are preserved during reconciliation.
