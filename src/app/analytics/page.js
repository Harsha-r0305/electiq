'use client';
import { useApi, Loading, lpa, fmt } from '@/components/ui';

export default function Analytics() {
  const a = useApi('/api/analytics');
  const d = a.data;
  const max = Math.max(1, ...(d?.skillGap ?? []).map((s) => s.postings_count));
  return (
    <div>
      <h1>Analytics</h1>
      <Loading state={a} />
      {d?.departments && (<><h2>Department dashboard</h2>
        <div className="tablewrap"><table><thead><tr><th>Department</th><th className="num">Students</th><th className="num">Courses</th><th className="num">Enrollments</th><th className="num">Average grade</th><th className="num">Full-time placements</th><th className="num">Average package</th></tr></thead>
          <tbody>{d.departments.map((x) => <tr key={x.dept_id}><td>{x.department}</td><td className="num">{x.students}</td><td className="num">{x.courses}</td><td className="num">{x.enrollments}</td><td className="num">{fmt(x.avg_grade, 2)}</td><td className="num">{x.fulltime_placements}</td><td className="num">{lpa(x.avg_package)}</td></tr>)}</tbody></table></div></>)}
      {d && (<>
        <h2>Package variation by elective</h2>
        <p className="muted">A placement counts toward every course the student completed with a grade. Read these as association, not cause.</p>
        <div className="tablewrap"><table><thead><tr><th>Course</th><th className="num">Full-time</th><th className="num">Internships</th><th className="num">Lowest</th><th className="num">Average</th><th className="num">Highest</th><th className="num">Rank in dept</th></tr></thead>
          <tbody>{d.placement.filter((p) => p.fulltime_count > 0).map((p) => <tr key={p.course_id}><td>{p.title}</td><td className="num">{p.fulltime_count}</td><td className="num">{p.internship_count}</td><td className="num">{lpa(p.min_package)}</td><td className="num">{lpa(p.avg_package)}</td><td className="num">{lpa(p.max_package)}</td><td className="num">{p.dept_rank}</td></tr>)}</tbody></table></div>
        <h2>Job-market skill demand</h2>
        <p className="muted">Skills flagged in amber are in demand but taught by no elective.</p>
        <div className="tablewrap"><table><thead><tr><th>Skill</th><th>Category</th><th>Job postings ({d.skillGap[0]?.year})</th><th className="num">Demand</th><th>Covered by</th></tr></thead>
          <tbody>{d.skillGap.map((s) => <tr key={s.skill_id}><td>{s.name}</td><td>{s.category}</td><td><div className="meter" title={`${s.postings_count} postings`}><span style={{ width: `${(s.postings_count / max) * 100}%`, background: s.uncovered ? 'var(--amber)' : 'var(--teal)' }} /></div></td><td className="num">{fmt(s.demand_score)}</td><td>{s.uncovered ? <span className="tag amber">no elective</span> : `${s.courses_teaching} course${s.courses_teaching > 1 ? 's' : ''}`}</td></tr>)}</tbody></table></div>
      </>)}
    </div>
  );
}
