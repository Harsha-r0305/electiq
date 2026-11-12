-- ElectIQ :: queries.sql  -- the important queries used by the application (run as owner for demonstration)
-- psql -d electiq -f db/queries.sql

\echo '--- Q1  JOIN + GROUP BY + HAVING + ORDER BY: courses with >= 5 reviews, hardest first'
SELECT c.code, c.title, ROUND(AVG(f.difficulty),2) AS avg_difficulty, ROUND(AVG(f.workload),2) AS avg_workload,
       COUNT(*) AS reviews, (SELECT COUNT(*) FROM resources r WHERE r.course_id = c.course_id) AS resources
FROM courses c
JOIN enrollments e ON e.course_id = c.course_id
JOIN feedback f ON f.enrollment_id = e.enrollment_id
GROUP BY c.course_id, c.code, c.title
HAVING COUNT(*) >= 5
ORDER BY avg_difficulty DESC LIMIT 5;

\echo '--- Q2  Recursive CTE: prerequisite chain of Advanced ML Foundations (cycle guard + depth limit)'
SELECT * FROM fn_prereq_chain((SELECT course_id FROM courses WHERE code = 'UE24CS303'));

\echo '--- Q3  Nested subquery: courses whose average full-time package beats the overall average'
SELECT c.code, c.title, ROUND(AVG(vp.package_lpa),2) AS avg_package
FROM courses c JOIN v_course_placements vp ON vp.course_id = c.course_id
WHERE vp.type = 'full_time'
GROUP BY c.course_id, c.code, c.title
HAVING AVG(vp.package_lpa) > (SELECT AVG(package_lpa) FROM placements WHERE type = 'full_time')
ORDER BY avg_package DESC LIMIT 5;

-- (fn_cgpa_boost only serves the signed-in student; here we act as an admin to demonstrate it)
SELECT set_config('app.role', 'admin', false) \gset
\echo '--- Q4  Correlated subquery (inside fn_cgpa_boost): electives where similar-CGPA students beat my CGPA'
SELECT * FROM fn_cgpa_boost((SELECT student_id FROM students s JOIN users u USING (user_id) WHERE u.email = 'student1@electiq.dev')) LIMIT 5;

\echo '--- Q5  NOT EXISTS: in-demand skills that no elective teaches'
SELECT name, postings_count, demand_score FROM v_skill_gap WHERE uncovered ORDER BY demand_score DESC;

\echo '--- Q6  Package variation per elective (multi-table JOIN + aggregates)'
SELECT code, title, fulltime_count, min_package, avg_package, max_package
FROM v_placement_analytics WHERE fulltime_count > 0 ORDER BY avg_package DESC LIMIT 5;

\echo '--- Q7  Window function: rank electives by average package inside each department'
SELECT department, code, avg_package, dept_rank FROM v_placement_analytics
WHERE avg_package IS NOT NULL AND dept_rank <= 2 ORDER BY department, dept_rank;

\echo '--- Q8  Full-text search (GIN index): reviews that mention projects and interviews'
SELECT c.code, left(v.review_text, 80) AS snippet, ts_rank(v.review_tsv, q) AS rank
FROM v_course_feedback v JOIN courses c USING (course_id), websearch_to_tsquery('english', 'project interview') q
WHERE v.review_tsv @@ q ORDER BY rank DESC LIMIT 3;

\echo '--- Q9  Role-to-course skill match in SQL (the fallback behind the Neo4j career path query)'
SELECT c.code, c.title, SUM(rs.importance * cs.depth) AS score
FROM job_roles r JOIN role_skills rs USING (role_id) JOIN course_skills cs USING (skill_id) JOIN courses c USING (course_id)
WHERE r.title = 'ML Engineer' GROUP BY c.code, c.title ORDER BY score DESC LIMIT 5;

\echo '--- Q10 Electives unlocked for a student (all prerequisites completed with grade >= 6)'
SELECT code, title, unlocked_by FROM fn_next_electives((SELECT student_id FROM students s JOIN users u USING (user_id) WHERE u.email = 'student1@electiq.dev')) LIMIT 5;

\echo '--- Index usage: full-text search plan (EXPLAIN)'
EXPLAIN (COSTS OFF) SELECT feedback_id FROM feedback WHERE review_tsv @@ websearch_to_tsquery('english', 'interview');
