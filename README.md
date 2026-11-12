# ElectIQ: Course & Elective Intelligence System

DBMS Experiential Learning Level 3 course project. ElectIQ helps university students choose their electives intelligently using structured data from seniors: difficulty ratings, workload estimates, learning resources, placement outcomes, faculty evaluations, skills taught, and job-market demand.

Built with **Next.js 14** (App Router, JavaScript), **PostgreSQL 14+** (relational data, procedures, triggers, RLS), and **Neo4j 5** (graph traversals for career pathways and skill clustering).

---

## 1. Architectural Highlights

| Data Domain | Datastore | Justification |
|---|---|---|
| Students, enrollments, grades, feedback, placements, ratings, users, audit | **PostgreSQL** | Relational integrity, ACID transactions, complex aggregations, triggers, row-level security (RLS), and database-level RBAC. |
| Courses, skills, roles, prerequisite chains, skill relatedness, and clusters | **Neo4j** | Multi-hop graph traversals (`Role` &rarr; `Skill` &rarr; `Course` &rarr; `Prerequisites`), recursive prerequisite trees, dynamic skill clusters, and graph-owned `RELATED_TO` links. |

PostgreSQL is authoritative for master data and student records. Courses, skills, job roles, and prerequisite links are mirrored into Neo4j via an idempotent synchronizer (`src/lib/graph-sync.mjs`). Neo4j authoritatively owns `RELATED_TO` strength links and skill clusters shown in the interactive skill map.

### System Architecture
The system architecture diagram is available at [`docs/architecture.png`](docs/architecture.png):

```
Client (Browser) ──[HTTP + JWT Cookie + CSRF Headers]──> Next.js 14 Route Handlers
                                                              │
                                ┌─────────────────────────────┴────────────────────────────┐
                                ▼                                                          ▼
                 PostgreSQL 14+ (Connection Pool)                               Neo4j 5 Enterprise
      ┌─────────────────────────────────────────────────────────┐               (Bolt localhost:7687)
      │  • BEGIN Transaction per request                        │               ┌───────────────────────────┐
      │  • SET LOCAL ROLE app_<student|senior|faculty|admin>    │               │ • Multi-Hop Cypher        │
      │  • set_config('app.user_id', :uid, true)                │               │ • Prerequisite Traversal  │
      │  • Row-Level Security (RLS) Filtering                   │               │ • Skill Clusters          │
      │  • Stored Procedures & Triggers                         │               │ • RELATED_TO Graph Links  │
      │  • COMMIT (identity & role cleared from pool)           │               └───────────────────────────┘
      └─────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites

* **Node.js 20** or newer
* **PostgreSQL 14** or newer (running on port `5432` with a superuser account, e.g., `postgres`)
* **Neo4j 5** (Enterprise or Community, running on Bolt port `7687` and HTTP port `7474`)
  ```bash
  docker run -d --name electiq-neo4j -p 7474:7474 -p 7687:7687 \
    -e NEO4J_AUTH=neo4j/change_me_neo4j_pw neo4j:5
  ```
  *Graceful Fallback:* If Neo4j is stopped, the application degrades gracefully: the career path simulator falls back to SQL ranking, the skill map hides external links, and admin graph panels show clear status warnings.

---

## 3. Setup and Initialization

```bash
# 1. Install dependencies
npm install

# 2. Create the database
createdb electiq   # or: psql -U postgres -c "CREATE DATABASE electiq"

# 3. Configure environment variables
cp .env.example .env   # Verify credentials match PostgreSQL and Neo4j

# 4. Reset, migrate schema, seed initial records, and sync Neo4j
npm run db:reset

# 5. Start development server
npm run dev   # App runs at http://localhost:3000
```

### Environment Variables (`.env`)

| Variable | Description |
|---|---|
| `OWNER_DATABASE_URL` | Superuser connection string used **only** by `npm run db:*` setup scripts |
| `DATABASE_URL` | Connection string used by the web app (`app_login` role with `NOINHERIT`) |
| `APP_LOGIN_PASSWORD` | Password assigned to `app_login` by `db:setup` |
| `NEO4J_URI` | Neo4j Bolt connection URL (`bolt://localhost:7687`) |
| `NEO4J_USER` | Neo4j username (`neo4j`) |
| `NEO4J_PASSWORD` | Neo4j password |
| `JWT_SECRET` | 32+ character random secret for HS256 JWT tokens |
| `COOKIE_SECURE` | Set `true` in production to enforce `Secure` on HttpOnly session cookies |

---

## 4. Demo Accounts & Walkthrough

All seeded demo accounts use the password `Password@123`:

| Role | Email | Key Features to Test |
|---|---|---|
| **Student** | `student1@electiq.dev` | Dashboard, Courses with filters & pagination, Compare courses, Career path simulator (Neo4j), **For you** (unlocked electives with self-enrollment), Interview questions bank, **ISA and ESA questions** (browse & share anonymously), Analytics. |
| **Senior** | `senior1@electiq.dev` | **Share your experience**: Course reviews (grade-gating demo), placement recording, standalone interview question submission, preparation activity logging, course project submission with tagged skills, **ISA and ESA question sharing**, and "My records". |
| **Faculty** | `faculty1@electiq.dev` | Course ratings (relevance, future scope, feedback) on assigned courses (RLS protected), read-only access to anonymous exam questions view. |
| **Admin** | `admin@electiq.dev` | Enrollments & grading, Courses & prerequisites, Course resources, Departments, Skills & job roles, Neo4j Skill Graph management, User accounts & promotions, Review moderation, and Audit log. |

### Two-Minute Live Demonstration
1. **Grade-Gating Trigger:** Sign in as `senior1@electiq.dev`. Go to *Share your experience* &rarr; attempt to submit a review on course with a pending grade &rarr; rejected by database trigger (`P0001: Feedback not allowed: grade not posted yet`). Sign in as `admin@electiq.dev` &rarr; Admin Console &rarr; *Enrollments & grades* &rarr; post grade `8.5`. Sign back in as `senior1` &rarr; the review now saves successfully.
2. **Circular Prerequisite Trigger:** In Admin &rarr; *Courses* &rarr; attempt to add circular prerequisite (e.g. `UE24CS302` requiring `UE24CS205`, when `205` already requires `302`) &rarr; rejected by trigger (`Circular prerequisite rejected`).
3. **Atomic Placement Transaction:** In Senior &rarr; *Placement & prep*, submitting a placement along with questions and prep logs is atomic. If a question references an invalid course, the entire transaction rolls back cleanly with zero orphan placement records.
4. **Student Self-Enrollment Procedure:** Open *For you* or Course Detail as `student1`. Prerequisites must be completed with a grade of `6.0` or higher (`sp_enroll_student`). Attempting to enroll in a course with unsatisfied prerequisites is rejected.
5. **Atomic Exam Question Batch Sharing:** Sign in as `student1@electiq.dev` &rarr; *ISA and ESA questions* &rarr; choose an enrolled course and share exam questions with marks and topic. Submitting duplicate questions in a single batch fails atomically with zero rows inserted (`uq_exam_question_dup`).
6. **Multi-Hop Neo4j Career Graph:** Navigate to *Career paths* &rarr; select *Machine Learning Engineer*. The query traverses `Role` &rarr; `Skill` &rarr; `Course`, calculates skill match score, and recursively resolves prerequisite courses (`take_first`).

---

## 5. Security & Quality Hardening

* **Database-Level Least Privilege:** Application requests connect using `app_login` (`NOINHERIT`, zero default privileges). Per request, a transaction executes:
  ```sql
  BEGIN;
  SET LOCAL ROLE app_<role>;
  SELECT set_config('app.user_id', :user_id, true);
  -- Request execution under Row-Level Security
  COMMIT;
  ```
* **Row-Level Security (RLS):** Enabled on `students`, `enrollments`, `feedback`, `placements`, `extra_activities`, `interview_questions`, `faculty_reviews`, `projects`, and `project_skills`. Students and seniors can only view/mutate their own private records.
* **Tamper-Proof Audit Logging:** Only `SECURITY DEFINER` triggers write to `audit_log`. No application role has `INSERT`, `UPDATE`, or `DELETE` permissions on `audit_log`.
* **Database-Backed Login Lockout:** Failed login attempts are recorded in `login_attempts`. More than 5 failed attempts in 15 minutes trigger a database lockout (`fn_check_login_lockout`).
* **CSRF Protection:** State-changing requests (`POST`, `PUT`, `DELETE`) are verified against `Sec-Fetch-Site` (`cross-site` rejected) and matching `Origin`/`Host` headers.
* **Content Security Policy (CSP):** Strict CSP headers configured in `next.config.mjs` blocking unauthorized frame embedding (`frame-ancestors 'none'`), untrusted scripts, and external form submissions.
* **Secure Cookie:** Session cookies enforce `HttpOnly`, `SameSite=Lax`, and `Secure` when `COOKIE_SECURE=true`.

---

## 6. Implementation Notes & Synopsis Alignment

### Master-Data Reads Rationale
The original course synopsis mentions master-data reads going *"via views"*. In this implementation:
* Base master-data tables (`departments`, `courses`, `course_prerequisites`, `skills`, `course_skills`, `companies`, `job_roles`, `role_skills`, `market_demand`, `resources`, `projects`, `project_skills`, `faculty`) contain purely academic and structural metadata with **no student identities or private data**. These tables are directly granted read-only (`SELECT`) access to application roles (`app_student`, `app_senior`, `app_faculty`, `app_admin`).
* User-sensitive and private tables (`feedback`, `placements`, `enrollments`, `extra_activities`, `faculty_reviews`) are protected either via **Row-Level Security (RLS)** for authenticated owners or accessed through **identity-scrubbed aggregated views** (`v_course_feedback`, `v_course_summary`, `v_placement_analytics`, `v_course_comparison`, `v_faculty_reviews`).
* This approach optimizes query planner performance while strictly upholding student privacy and least privilege.

### Neo4j Career Cypher Query
The career path simulator (`src/app/api/career/route.js`) executes the following multi-hop traversal in Neo4j:
```cypher
MATCH (r:Role {role_id: toInteger($roleId)})-[q:REQUIRES]->(s:Skill)<-[t:TEACHES]-(c:Course)
WITH c, collect(DISTINCT s.name) AS covers, sum(q.importance * t.depth) AS score
ORDER BY score DESC LIMIT 8
OPTIONAL MATCH (pre:Course)-[:PREREQUISITE_OF*1..3]->(c)
RETURN c.course_id AS course_id, c.code AS code, c.title AS title, covers, score,
       [x IN collect(DISTINCT pre.code) WHERE x IS NOT NULL] AS take_first
ORDER BY score DESC
```

### AI Semantic Elective Search
Students can describe what they want to learn in the **Discover Electives with AI** section of the Student Dashboard. Courses are embedded with the local `all-MiniLM-L6-v2` model (384-d) into `course_embeddings` (PostgreSQL + pgvector, HNSW cosine index) and ranked in SQL. Setup, architecture and limitations: [`docs/VECTOR_SEARCH.md`](docs/VECTOR_SEARCH.md). Quick start: `npm run db:setup && npm run db:seed`, `pip install -r embedding_service/requirements.txt`, `npm run db:vector`, `npm run embed:serve`, `npm run dev`.

### Senior → Admin → Student publishing
Seniors submit; only an administrator publishes; students see approved content only. See [`docs/APPROVAL_WORKFLOW.md`](docs/APPROVAL_WORKFLOW.md).

## 7. Testing & Verification

ElectIQ features comprehensive automated test suites covering all 23 database tables, security hardening, triggers, RLS isolation, and publishing workflows:

### DBMS Security & RLS Hardening Suite (13 Automated Security Tests)
Tests database-level role isolation, direct SQL modification protection, senior self-publish guards, senior self-approve prevention, cross-senior edit prevention, password hash revokes, audit log protection, faculty publish rejection, consent gates, and student/senior exam question sharing integrity:
```bash
npm run test:security
```

### Senior → Faculty → Admin Approval & Item Moderation Suite
Exercises full publishing lifecycle over HTTP (draft → submit → admin publish → student visibility → senior edits triggering re-approval) and verifies independent item moderation:
```bash
npm run test:workflow
```

### End-to-End Workflow & Dashboard Synchronization
Tests complete end-to-end synchronization across Senior Explorer, Course Placements, Exam Repository, and Student Dashboard:
```bash
npm run test:e2e
```

Full details, execution outputs, and manual UI test tables are documented in [`docs/TESTING.md`](docs/TESTING.md).

---

## 8. Data Provenance & Synthetic vs Real Data

* **Synthetic Data Notice:** Student profiles, grades, senior course feedback reviews, placements, and exam question distributions in the default seed are generated synthetically using reproducible random seeds mapped against real course curricula.
* **Importing Real Senior Responses:**
  Real senior responses (e.g. from Google Forms, alumni surveys, or CSV exports) can be placed in `data/` and loaded directly. The seeder parses and validates course codes, semester terms, ratings (1–5 scale), and package ranges, rejecting malformed rows while preserving relational and referential integrity.

---

## 9. Artifacts & Documentation

* **Entity-Relationship Diagram:** [`docs/er-diagram.png`](docs/er-diagram.png) (generated from [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md))
* **System Architecture Diagram:** [`docs/architecture.png`](docs/architecture.png)
* **Comprehensive Test Report:** [`docs/TESTING.md`](docs/TESTING.md)
* **UI Screenshots:** 28 high-resolution screenshots covering desktop, mobile, and all role views in [`docs/screenshots/`](docs/screenshots/)

---

## 10. Project Directory Structure

```
electiq/
├── db/
│   ├── 01_schema.sql           # 23 tables, constraints, tsvector columns, B-tree/GIN indexes
│   ├── 02_logic.sql            # Views, procedures (sp_share_exam_questions, sp_enroll_student), triggers
│   ├── 03_security.sql         # RBAC roles, grants, column grants, Row-Level Security policies
│   ├── queries.sql             # Demonstration queries (Q1-Q10)
│   └── tests.sql               # Automated database regression test suite (34+ tests, 41 assertions)
├── docs/
│   ├── ER_DIAGRAM.md           # Mermaid ER diagram source (23 entities)
│   ├── TRANSACTIONS.md         # Complete transactions guide, ACID mechanics & row-lock demos
│   ├── er-diagram.png          # Exported full ER diagram
│   ├── architecture.png        # System architecture diagram
│   ├── TESTING.md              # Detailed automated & manual test report
│   └── screenshots/            # 28 UI screenshots for all roles and views
├── scripts/
│   ├── setup-db.mjs            # DDL runner using OWNER_DATABASE_URL
│   ├── seed.mjs                # Data seeder (demo users, courses, enrollments, placements)
│   ├── sync-graph.mjs          # Idempotent PostgreSQL to Neo4j synchronizer
│   ├── smoke-all.mjs           # Logs in as every role and hits every page/API
│   ├── test-approval-flow.mjs  # Senior → Admin → Student publishing tests
│   ├── test-item-flow.mjs      # Item-level approval gate tests
│   ├── test-semantic-search.mjs# pgvector + semantic search API tests
│   ├── generate_supplementary_data.py / generate_embeddings.py
│   ├── capture-screenshots.mjs # Headless Chrome screenshot capture script
│   └── generate-diagrams.mjs   # Headless Chrome Mermaid diagram exporter
├── src/
│   ├── app/                    # Next.js App Router pages and API route handlers
│   │   ├── admin/              # Admin console (7 panels + sub-features)
│   │   ├── api/                # REST endpoints with handler() wrapper
│   │   ├── career/             # Career path simulator (Neo4j multi-hop traversal)
│   │   ├── courses/            # Course catalog, search, filters, pagination, course detail
│   │   ├── contribute/         # Senior forms (reviews, placements, questions, prep, projects)
│   │   ├── for-you/            # Unlocked electives, CGPA boost, student self-enrollment
│   │   └── ...
│   ├── components/             # Reusable UI components, AdminPanels, MindMap, Shell
│   └── lib/                    # db.js (SET LOCAL ROLE), auth.js, route.js (CSRF check), neo.mjs
└── package.json
```
