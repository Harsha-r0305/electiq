# ER diagram (PostgreSQL)

Render this file on GitHub (Mermaid is built in) or paste the block into https://mermaid.live to export an image.
Crow's-foot notation: `||` exactly one, `o|` zero or one, `|{` one or many, `o{` zero or many.

```mermaid
erDiagram
    DEPARTMENTS ||--o{ STUDENTS : has
    DEPARTMENTS ||--o{ FACULTY : employs
    DEPARTMENTS ||--o{ COURSES : offers
    USERS ||--o| STUDENTS : "is profile of"
    USERS ||--o| FACULTY : "is profile of"
    FACULTY ||--o{ COURSES : teaches
    COURSES ||--o{ COURSE_PREREQUISITES : "is target of"
    COURSES ||--o{ COURSE_PREREQUISITES : "is required by"
    STUDENTS ||--o{ ENROLLMENTS : takes
    COURSES ||--o{ ENROLLMENTS : "taken in"
    ENROLLMENTS ||--o| FEEDBACK : "reviewed by"
    COURSES ||--o{ RESOURCES : has
    COURSES ||--o{ COURSE_SKILLS : teaches
    SKILLS ||--o{ COURSE_SKILLS : "taught in"
    STUDENTS ||--o{ PROJECTS : builds
    COURSES ||--o{ PROJECTS : "done in"
    PROJECTS ||--o{ PROJECT_SKILLS : uses
    SKILLS ||--o{ PROJECT_SKILLS : "used in"
    JOB_ROLES ||--o{ ROLE_SKILLS : requires
    SKILLS ||--o{ ROLE_SKILLS : "required by"
    STUDENTS ||--o{ PLACEMENTS : gets
    COMPANIES ||--o{ PLACEMENTS : offers
    JOB_ROLES ||--o{ PLACEMENTS : "hired as"
    PLACEMENTS ||--o{ INTERVIEW_QUESTIONS : "asked during"
    COURSES ||--o{ INTERVIEW_QUESTIONS : "tagged to"
    STUDENTS ||--o{ EXTRA_ACTIVITIES : logs
    COURSES ||--o{ EXTRA_ACTIVITIES : "alongside"
    FACULTY ||--o{ FACULTY_REVIEWS : writes
    COURSES ||--o{ FACULTY_REVIEWS : "rated in"
    SKILLS ||--o{ MARKET_DEMAND : "tracked in"
    ENROLLMENTS ||--o{ EXAM_QUESTIONS : "shared from"
    COURSES ||--o{ EXAM_QUESTIONS : "asked in"

    DEPARTMENTS { int dept_id PK  string name UK }
    USERS { int user_id PK  string email UK  char password_hash  string role }
    STUDENTS { int student_id PK  int user_id FK  string srn UK  string name  int dept_id FK  int batch_year }
    FACULTY { int faculty_id PK  int user_id FK  int dept_id FK  string name  string designation }
    COURSES { int course_id PK  string code UK  string title  int dept_id FK  int faculty_id FK  int credits  int semester  string level }
    COURSE_PREREQUISITES { int course_id PK,FK  int prereq_id PK,FK }
    ENROLLMENTS { int enrollment_id PK  int student_id FK  int course_id FK  string term  string status  decimal grade_points  timestamptz grade_posted_at }
    FEEDBACK { int feedback_id PK  int enrollment_id FK,UK  int difficulty  int workload  int usefulness  text review_text }
    RESOURCES { int resource_id PK  int course_id FK  string type  string title  text url }
    SKILLS { int skill_id PK  string name UK  string category }
    COURSE_SKILLS { int course_id PK,FK  int skill_id PK,FK  int depth }
    PROJECTS { int project_id PK  int student_id FK  int course_id FK  string title }
    PROJECT_SKILLS { int project_id PK,FK  int skill_id PK,FK }
    COMPANIES { int company_id PK  string name UK  string sector }
    JOB_ROLES { int role_id PK  string title UK }
    ROLE_SKILLS { int role_id PK,FK  int skill_id PK,FK  int importance }
    PLACEMENTS { int placement_id PK  int student_id FK  int company_id FK  int role_id FK  string type  decimal package_lpa  int year }
    EXTRA_ACTIVITIES { int activity_id PK  int student_id FK  int course_id FK  string type  string platform  decimal hours_spent }
    INTERVIEW_QUESTIONS { int question_id PK  int course_id FK  int placement_id FK  text question_text  string round  int difficulty }
    FACULTY_REVIEWS { int review_id PK  int faculty_id FK  int course_id FK  int relevance  int future_scope  text comment }
    MARKET_DEMAND { int demand_id PK  int skill_id FK  int year  int postings_count  decimal demand_score }
    EXAM_QUESTIONS { int exam_question_id PK  int enrollment_id FK  int course_id FK  string exam_type  text question_text  int marks  string topic  int difficulty  timestamptz created_at }
    AUDIT_LOG { bigint log_id PK  int user_id  string action  string table_name  string row_pk  jsonb old_value  jsonb new_value }
```

`course_prerequisites` is the self-referencing many-to-many on `courses`. `audit_log` has no foreign keys on purpose: audit rows must survive deletion of the rows they describe.

## Neo4j graph model

```
(:Course {course_id, code, title, level}) -[:PREREQUISITE_OF]-> (:Course)
(:Course) -[:TEACHES {depth}]-> (:Skill {skill_id, name, category})
(:Role {role_id, title}) -[:REQUIRES {importance}]-> (:Skill)
(:Skill) -[:RELATED_TO {strength}]-> (:Skill)        <- owned by Neo4j
(:Skill) -[:IN_CLUSTER]-> (:Cluster {name})          <- owned by Neo4j
```
The first three relationship types and all course, skill and role nodes are mirrored from PostgreSQL (`npm run sync-graph`). `RELATED_TO` and `IN_CLUSTER` exist only in Neo4j.
