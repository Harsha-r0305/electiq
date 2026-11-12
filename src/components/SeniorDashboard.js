'use client';
import { useState } from 'react';
import { useApi, api, Loading, Notice, useAction, lpa, fmt } from './ui';
import SeniorProfileModal from './SeniorProfileModal';

const SECTIONS = [
  { id: 'profile', label: '1. Profile & Academic Details', icon: '👤' },
  { id: 'placement', label: '2. Placement Details & Offers', icon: '💰' },
  { id: 'internships', label: '3. Internships & Training', icon: '💼' },
  { id: 'electives', label: '4. Electives Taken & Feedback', icon: '📚' },
  { id: 'projects', label: '5. Projects & Open Source', icon: '🚀' },
  { id: 'interview_prep', label: '6. Interview Preparation', icon: '🎯' },
  { id: 'contributions', label: '7. Approval Status', icon: '✅' },
];

const ELECTIVE_SLOTS = ['Elective I', 'Elective II', 'Elective III', 'Elective IV'];

const CURRICULUM_ELECTIVES = {
  'Elective I': [
    { course_id: 10, title: 'Advanced Foundations for ML', vertical: 'AAML' },
    { course_id: 14, title: 'Applied Cryptography', vertical: 'CSCS' },
    { course_id: 15, title: 'Augmented and Virtual Reality', vertical: 'CSCS' },
    { course_id: 17, title: 'Chip level Photonics', vertical: 'NICE' },
    { course_id: 18, title: 'Digital Image Processing', vertical: 'SPaSE' },
    { course_id: 13, title: 'Internet of Things', vertical: 'CSCS' },
    { course_id: 11, title: 'Machine Learning with Business Data', vertical: 'AII' },
    { course_id: 12, title: 'ML System Design and AgentOps', vertical: 'AAML+AII' },
    { course_id: 16, title: 'Modern Wireless and 5G Systems', vertical: 'CSCS' },
    { course_id: 19, title: 'Speech and Natural Language Processing', vertical: 'SPaSE' },
  ],
  'Elective II': [
    { course_id: 20, title: 'Advanced Data Analytics', vertical: 'AAML' },
    { course_id: 21, title: 'Big Data Systems and Responsible AI Engineering', vertical: 'AAML' },
    { course_id: 24, title: 'Computer Network Security', vertical: 'CSCS' },
    { course_id: 26, title: 'Design of RTOS', vertical: 'CSCS' },
    { course_id: 23, title: 'Intelligent Vehicle: Connectivity and Cyber Security', vertical: 'CSCS' },
    { course_id: 22, title: 'Prompt Engineering for Generative AI', vertical: 'AAML+AII' },
    { course_id: 28, title: 'Quantum Entanglement and Quantum Computing', vertical: 'NICE' },
    { course_id: 27, title: 'Real Time Operating Systems', vertical: 'NICE' },
    { course_id: 29, title: 'Robotic Systems: From Arms to Drones', vertical: 'SPaSE' },
    { course_id: 25, title: 'ROS for Autonomous Systems', vertical: 'CSCS' },
  ],
  'Elective III': [
    { course_id: 37, title: 'Block Chain', vertical: 'CSCS' },
    { course_id: 33, title: 'Deep Learning for Images', vertical: 'AAML' },
    { course_id: 34, title: 'Deep Learning for Life Sciences', vertical: 'AII' },
    { course_id: 31, title: 'Deep Reinforcement Learning', vertical: 'AAML' },
    { course_id: 36, title: 'Design of Secure Platform and Systems', vertical: 'CSCS' },
    { course_id: 38, title: 'Digital Forensics and Incident Response', vertical: 'CSCS' },
    { course_id: 39, title: 'Digital Twins', vertical: 'CSCS' },
    { course_id: 32, title: 'Explainable AI', vertical: 'AAML+AII' },
    { course_id: 30, title: 'LLM and Their Applications: Design, Optimization, and Evaluation', vertical: 'AAML' },
    { course_id: 35, title: 'Privacy Preserving Machine Learning', vertical: 'AII' },
    { course_id: 40, title: 'Responsible AI', vertical: 'CSCS' },
  ],
  'Elective IV': [
    { course_id: 46, title: 'Agentic AI and Multi-Agent AI System', vertical: 'AAML+AII' },
    { course_id: 49, title: 'Cybersecurity in Cloud', vertical: 'CSCS' },
    { course_id: 43, title: 'Foundations of Frugal Artificial Intelligence', vertical: 'AAML' },
    { course_id: 47, title: 'Information Security', vertical: 'CSCS' },
    { course_id: 41, title: 'Interdisciplinary Deep Learning for Graphs', vertical: 'AAML' },
    { course_id: 44, title: 'Machine Learning for Finance', vertical: 'AII' },
    { course_id: 48, title: 'Mobile Autonomous Robotics', vertical: 'CSCS' },
    { course_id: 50, title: 'SOC and Threat Intelligence', vertical: 'CSCS' },
    { course_id: 42, title: 'Social Computing', vertical: 'AAML' },
    { course_id: 45, title: 'Supply Chain Analytics and Optimization with AI', vertical: 'AII' },
  ],
};

export default function SeniorDashboard() {
  const [activeSection, setActiveSection] = useState('profile');
  const dashApi = useApi('/api/seniors/my-dashboard');
  const lookups = useApi('/api/lookups');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [s, run] = useAction();

  const d = dashApi.data;
  const h = d?.header;
  const prof = d?.profile || {};
  const subs = d?.submissions || {};

  // Form states
  // Profile & Academic Details
  const [seniorName, setSeniorName] = useState('');
  const [seniorSrn, setSeniorSrn] = useState('');
  const [seniorDept, setSeniorDept] = useState('');
  const [seniorBatch, setSeniorBatch] = useState('2025');
  const [seniorCgpa, setSeniorCgpa] = useState('8.72');
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [adviceForJuniors, setAdviceForJuniors] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Sync profile data once loaded
  if (d && !profileLoaded) {
    setSeniorName(h?.student_name || '');
    setSeniorSrn(h?.srn || '');
    setSeniorDept(String(h?.dept_id || h?.department || '1'));
    setSeniorBatch(String(h?.batch || '2025'));
    setSeniorCgpa(h?.cgpa !== null && h?.cgpa !== undefined ? String(h.cgpa) : '8.72');
    setDisplayName(prof.display_name || '');
    setHeadline(prof.headline || '');
    setSpecialization(prof.specialization || '');
    setAdviceForJuniors(prof.advice_for_juniors || '');
    setLinkedinUrl(prof.linkedin_url || '');
    setGithubUrl(prof.github_url || '');
    setProfileLoaded(true);
  }

  // 4 Elective Slots state & data
  const [slotViewMode, setSlotViewMode] = useState('all'); // 'all' or specific slot
  const [slotStates, setSlotStates] = useState({
    'Elective I': { course_id: '', grade_points: '8.5', difficulty: 3, usefulness: 4, workload: 3, review_text: '', placement_help: true, extra_prep_needed: '', recommended_resources: '', advice_for_juniors: '' },
    'Elective II': { course_id: '', grade_points: '8.5', difficulty: 3, usefulness: 4, workload: 3, review_text: '', placement_help: true, extra_prep_needed: '', recommended_resources: '', advice_for_juniors: '' },
    'Elective III': { course_id: '', grade_points: '8.5', difficulty: 3, usefulness: 4, workload: 3, review_text: '', placement_help: true, extra_prep_needed: '', recommended_resources: '', advice_for_juniors: '' },
    'Elective IV': { course_id: '', grade_points: '8.5', difficulty: 3, usefulness: 4, workload: 3, review_text: '', placement_help: true, extra_prep_needed: '', recommended_resources: '', advice_for_juniors: '' },
  });
  const [slotsSynced, setSlotsSynced] = useState(false);

  // Sync slots from server data once loaded
  if (d && !slotsSynced) {
    const feedbackList = subs.feedback || [];
    const eligibleList = subs.eligibleCourses || [];
    const nextStates = { ...slotStates };
    ELECTIVE_SLOTS.forEach(slotKey => {
      const fb = feedbackList.find(f => f.elective_slot === slotKey);
      const enr = eligibleList.find(e => e.elective_slot === slotKey);
      if (fb) {
        nextStates[slotKey] = {
          course_id: String(fb.course_id || ''),
          grade_points: fb.grade_points !== null && fb.grade_points !== undefined ? String(fb.grade_points) : '8.5',
          difficulty: fb.difficulty || 3,
          usefulness: fb.usefulness || 4,
          workload: fb.workload || 3,
          review_text: fb.review_text || '',
          placement_help: fb.placement_help !== false,
          extra_prep_needed: fb.extra_prep_needed || '',
          recommended_resources: fb.recommended_resources || '',
          advice_for_juniors: fb.advice_for_juniors || '',
        };
      } else if (enr) {
        nextStates[slotKey] = {
          course_id: String(enr.course_id || ''),
          grade_points: enr.grade_points !== null && enr.grade_points !== undefined ? String(enr.grade_points) : '8.5',
          difficulty: 3,
          usefulness: 4,
          workload: 3,
          review_text: '',
          placement_help: true,
          extra_prep_needed: '',
          recommended_resources: '',
          advice_for_juniors: '',
        };
      }
    });
    setSlotStates(nextStates);
    setSlotsSynced(true);
  }

  const updateSlot = (slotKey, field, val) => {
    setSlotStates(prev => ({
      ...prev,
      [slotKey]: {
        ...prev[slotKey],
        [field]: val
      }
    }));
  };

  const handleSaveSlot = async (slotKey) => {
    const sData = slotStates[slotKey];
    if (!sData?.course_id) {
      alert(`Please select an elective course offering for ${slotKey} from the list.`);
      return;
    }
    await run(async () => {
      await api('/api/seniors/contributions', {
        method: 'POST',
        body: {
          section: 'feedback',
          action: 'create',
          data: {
            course_id: sData.course_id,
            elective_slot: slotKey,
            grade_points: sData.grade_points,
            difficulty: sData.difficulty,
            workload: sData.workload,
            usefulness: sData.usefulness,
            review_text: sData.review_text,
            placement_help: sData.placement_help,
            extra_prep_needed: sData.extra_prep_needed,
            recommended_resources: sData.recommended_resources,
            advice_for_juniors: sData.advice_for_juniors,
          },
        },
      });
      dashApi.reload();
    }, `${slotKey} elective details and experience feedback saved successfully!`);
  };

  // Interview Prep Form
  const [dsaStrategy, setDsaStrategy] = useState('');
  const [languagesUsed, setLanguagesUsed] = useState('');
  const [coreSubjects, setCoreSubjects] = useState('');
  const [mockInterviews, setMockInterviews] = useState('');
  const [platformsUsed, setPlatformsUsed] = useState('');
  const [hrPrep, setHrPrep] = useState('');
  const [companyPrep, setCompanyPrep] = useState('');
  const [mistakesAvoid, setMistakesAvoid] = useState('');
  const [prepWeeks, setPrepWeeks] = useState(10);

  // Exam Question Form
  const [eqCourseId, setEqCourseId] = useState('');
  const [eqExamType, setEqExamType] = useState('ISA1');
  const [eqText, setEqText] = useState('');
  const [eqMarks, setEqMarks] = useState(10);
  const [eqTopic, setEqTopic] = useState('');
  const [eqDifficulty, setEqDifficulty] = useState(3);
  const [eqAnswer, setEqAnswer] = useState('');

  // Placement Form
  const [plcCompanyId, setPlcCompanyId] = useState('');
  const [plcRoleId, setPlcRoleId] = useState('');
  const [plcPkg, setPlcPkg] = useState('');
  const [plcYear, setPlcYear] = useState('2025');
  const [plcLocation, setPlcLocation] = useState('Bengaluru');
  const [plcRemote, setPlcRemote] = useState(false);
  const [plcTech, setPlcTech] = useState('');
  const [plcWorkDesc, setPlcWorkDesc] = useState('');
  const [plcPpo, setPlcPpo] = useState(false);
  const [plcMode, setPlcMode] = useState('on_campus');
  const [plcEvidence, setPlcEvidence] = useState('');
  const [editingPlacementId, setEditingPlacementId] = useState(null);

  // Internship Form
  const [intCompanyId, setIntCompanyId] = useState('');
  const [intRoleId, setIntRoleId] = useState('');
  const [intPkg, setIntPkg] = useState('');
  const [intDuration, setIntDuration] = useState('6');
  const [intStipend, setIntStipend] = useState('');
  const [intYear, setIntYear] = useState('2024');
  const [intLocation, setIntLocation] = useState('Bengaluru');
  const [intPpo, setIntPpo] = useState(false);
  const [intEvidence, setIntEvidence] = useState('');
  const [intTech, setIntTech] = useState('');
  const [intDesc, setIntDesc] = useState('');
  const [editingInternshipId, setEditingInternshipId] = useState(null);

  // Project Form
  const [prjCourseId, setPrjCourseId] = useState('');
  const [prjTitle, setPrjTitle] = useState('');
  const [prjProblem, setPrjProblem] = useState('');
  const [prjTech, setPrjTech] = useState('');
  const [prjRepo, setPrjRepo] = useState('');
  const [prjLive, setPrjLive] = useState('');
  const [prjOutcome, setPrjOutcome] = useState('');

  // Extra Prep Form
  const [epCourseId, setEpCourseId] = useState('');
  const [epType, setEpType] = useState('online_course');
  const [epPlatform, setEpPlatform] = useState('LeetCode');
  const [epHours, setEpHours] = useState('40');
  const [epTitle, setEpTitle] = useState('');
  const [epSkills, setEpSkills] = useState('');
  const [epCert, setEpCert] = useState(false);

  // Publication Form
  const [pubTitle, setPubTitle] = useState('');
  const [pubVenue, setPubVenue] = useState('');
  const [pubType, setPubType] = useState('Conference');
  const [pubYear, setPubYear] = useState('2024');
  const [pubStatus, setPubStatus] = useState('published');
  const [pubTopic, setPubTopic] = useState('');
  const [pubAbstract, setPubAbstract] = useState('');

  // Hackathon Form
  const [hEventName, setHEventName] = useState('');
  const [hOrganizer, setHOrganizer] = useState('');
  const [hStatus, setHStatus] = useState('won');
  const [hPosition, setHPosition] = useState('First Place');
  const [hProject, setHProject] = useState('');
  const [hYear, setHYear] = useState('2024');

  // Save profile info
  const handleSaveProfile = async (action = 'save_profile') => {
    await run(async () => {
      await api('/api/seniors/my-dashboard', {
        method: 'POST',
        body: {
          action,
          name: seniorName,
          student_name: seniorName,
          srn: seniorSrn,
          dept_id: seniorDept,
          department: seniorDept,
          batch_year: seniorBatch,
          batch: seniorBatch,
          cgpa: seniorCgpa,
          display_name: displayName || seniorName,
          headline,
          specialization,
          advice_for_juniors: adviceForJuniors,
          linkedin_url: linkedinUrl,
          github_url: githubUrl,
          consent: true,
        },
      });
      dashApi.reload();
    }, action === 'submit_for_review' ? 'Submitted for admin approval. Students will see your profile, electives and placements once the admin publishes them.' : action === 'unpublish_request' ? 'Withdrawn: your profile is now a draft and hidden from students.' : 'Saved. (If your profile was already published, edits to public details are re-sent to the admin for approval.)');
  };

  // Submit helper
  const handleContribution = async (section, data, successMsg, customAction = null) => {
    await run(async () => {
      await api('/api/seniors/contributions', {
        method: 'POST',
        body: { section, action: customAction || (data?.placement_id || data?.internship_id ? 'update' : 'create'), data },
      });
      dashApi.reload();
    }, successMsg);
  };

  // Delete helper
  const handleDeleteItem = async (section, data) => {
    await run(async () => {
      await api('/api/seniors/contributions', {
        method: 'POST',
        body: { section, action: 'delete', data },
      });
      dashApi.reload();
    }, 'Item removed successfully.');
  };

  return (
    <div className="senior-container">
      {/* Top Header Card */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          borderTop: '4px solid var(--blue-deep, #0284c7)',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>
                {seniorName || h?.student_name || displayName || `Senior #${h?.senior_code || 'Alumnus'}`}
              </h1>
              <span className="tag blue">{h?.tier || 'Verified Alumni'}</span>
              <span
                style={{
                  padding: '0.2rem 0.65rem',
                  borderRadius: 12,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background:
                    prof.status === 'published' ? '#dcfce7' :
                    prof.status === 'faculty_approved' ? '#e0e7ff' :
                    prof.status === 'submitted' || prof.status === 'under_review' ? '#fef3c7' :
                    prof.status === 'changes_requested' ? '#fee2e2' :
                    '#f1f5f9',
                  color:
                    prof.status === 'published' ? '#15803d' :
                    prof.status === 'faculty_approved' ? '#3730a3' :
                    prof.status === 'submitted' || prof.status === 'under_review' ? '#b45309' :
                    prof.status === 'changes_requested' ? '#b91c1c' :
                    '#475569',
                }}
              >
                {prof.status === 'published' ? '● Published (visible to students)' :
                 prof.status === 'faculty_approved' ? '⏳ Awaiting Admin Approval' :
                 prof.status === 'submitted' || prof.status === 'under_review' ? '⏳ Awaiting Admin Approval' :
                 prof.status === 'changes_requested' ? '⚠️ Corrections Requested' :
                 prof.status === 'rejected' ? '✕ Rejected' :
                 '○ Draft Mode'}
              </span>
            </div>
            <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.92rem' }}>
              Department: <b>{h?.department}</b> &bull; Class of <b>{h?.batch}</b> &bull; Exact CGPA: <b style={{ color: '#059669' }}>{fmt(h?.cgpa, 2)}</b>
              {h?.highest_package_lpa && <> &bull; Highest Offer: <b style={{ color: '#0284c7' }}>{lpa(h.highest_package_lpa)}</b> ({h?.company})</>}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setPreviewOpen(true)}
              style={{ padding: '0.55rem 1.1rem', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e293b', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
            >
              👁 Preview Public View
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => handleSaveProfile('save_profile')}
              style={{ padding: '0.55rem 1.1rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              💾 Save Profile Details
            </button>
            {prof.status === 'published' ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (confirm('Withdraw your profile? It will become a draft and disappear from the Student Dashboard until you submit again and the admin approves it.')) {
                    handleSaveProfile('unpublish_request');
                  }
                }}
                style={{
                  padding: '0.55rem 1.1rem',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Withdraw from Students
              </button>
            ) : prof.status === 'submitted' || prof.status === 'under_review' ? (
              <span
                style={{
                  padding: '0.55rem 1.1rem',
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                ⏳ Awaiting Admin Approval
              </span>
            ) : prof.status === 'faculty_approved' ? (
              <span
                style={{
                  padding: '0.55rem 1.1rem',
                  background: '#e0e7ff',
                  color: '#3730a3',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                ⏳ Awaiting Admin Approval
              </span>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => handleSaveProfile('submit_for_review')}
                style={{
                  padding: '0.55rem 1.3rem',
                  background: 'var(--blue-deep, #0284c7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {prof.status === 'changes_requested' || prof.status === 'rejected' ? '🚀 Resubmit for Admin Approval' : 'Submit for Admin Approval'}
              </button>
            )}
          </div>
        </div>

        {(prof.status === 'changes_requested' || prof.status === 'rejected') && (prof.review_notes || prof.faculty_notes) && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.85rem 1.15rem', marginTop: '1rem' }}>
            <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.35rem' }}>⚠️ The reviewer sent this back. Fix the points below and resubmit for admin approval:</div>
            {prof.faculty_notes && <div style={{ fontSize: '0.85rem', color: '#7f1d1d', marginBottom: '0.25rem' }}><b>Faculty Note:</b> {prof.faculty_notes}</div>}
            {prof.review_notes && <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}><b>Admin Note:</b> {prof.review_notes}</div>}
          </div>
        )}
      </div>

      <Notice error={s.error} ok={s.ok} />
      <Loading state={dashApi} />

      {/* Main Workspace Layout with Responsive Sidebar Navigation */}
      <div className="senior-grid">
        {/* Left Sidebar Steps */}
        <div className="card senior-nav-sticky" style={{ padding: '0.75rem', borderRadius: 8, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '0.5rem 0.5rem 0.75rem', fontWeight: 800, fontSize: '0.82rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #f1f5f9', marginBottom: '0.5rem' }}>
            Experience Portal
          </div>
          <div className="senior-nav-list">
            {SECTIONS.map((sec) => {
              const active = activeSection === sec.id;
              let badgeCount = null;
              if (sec.id === 'placement') badgeCount = (subs.placements || []).length;
              if (sec.id === 'internships') badgeCount = (subs.internships || []).length;
              if (sec.id === 'electives') badgeCount = (subs.feedback || []).length ? `${(subs.feedback || []).length}/4` : null;
              if (sec.id === 'projects') badgeCount = (subs.projects || []).length;
              if (sec.id === 'publications') badgeCount = (subs.publications || []).length;
              if (sec.id === 'hackathons') badgeCount = (subs.hackathons || []).length;
              if (sec.id === 'exam_questions') badgeCount = (subs.examQuestions || []).length;
              if (sec.id === 'extra_prep') badgeCount = (subs.extraPrep || []).length;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.6rem',
                    padding: '0.65rem 0.75rem',
                    border: active ? '1px solid #bae6fd' : '1px solid transparent',
                    borderRadius: 6,
                    background: active ? '#f0f9ff' : 'transparent',
                    color: active ? '#0284c7' : '#334155',
                    fontWeight: active ? 700 : 500,
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <span style={{ fontSize: '1.05rem' }}>{sec.icon}</span>
                    <span>{sec.label}</span>
                  </div>
                  {badgeCount && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: 12,
                        background: active ? '#0284c7' : '#e2e8f0',
                        color: active ? '#fff' : '#475569',
                      }}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content Work Area */}
        <div className="card" style={{ padding: '1.5rem 1.75rem', background: '#fff', borderRadius: 8, minHeight: 650, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          {/* 1. PROFILE & ACADEMIC INFORMATION */}
          {activeSection === 'profile' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                1. Profile & Academic Details
              </h2>
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Enter and manage your verified university identification, department, graduation year, and cumulative CGPA.
              </p>

              {/* Editable Academic Profile Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                    Senior Full Name
                  </label>
                  <input
                    value={seniorName}
                    onChange={(e) => setSeniorName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Your official name registered with the university.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                    Student SRN
                  </label>
                  <input
                    value={seniorSrn}
                    onChange={(e) => setSeniorSrn(e.target.value)}
                    placeholder="e.g. PES20210001"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Your university Student Registration Number.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                    University Department
                  </label>
                  <select
                    value={seniorDept}
                    onChange={(e) => setSeniorDept(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem', background: '#fff' }}
                  >
                    {(d?.departments && d.departments.length > 0 ? d.departments : [
                      { dept_id: 1, name: 'Computer Science and Engineering' },
                      { dept_id: 2, name: 'Electronics and Communication Engineering' },
                      { dept_id: 3, name: 'Electrical and Electronics Engineering' }
                    ]).map((dept) => (
                      <option key={dept.dept_id} value={dept.dept_id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Your degree-granting academic department.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                    Graduation Batch / Year of Passing
                  </label>
                  <input
                    type="number"
                    min="2018"
                    max="2030"
                    value={seniorBatch}
                    onChange={(e) => setSeniorBatch(e.target.value)}
                    placeholder="2025"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Graduation cohort (e.g. 2025).</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                    Exact Cumulative CGPA (out of 10.0)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={seniorCgpa}
                    onChange={(e) => setSeniorCgpa(e.target.value)}
                    placeholder="8.72"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem', fontWeight: 700, color: '#059669' }}
                  />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Cumulative grade point average on a 10.0 scale.</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                    Senior Identifier Code
                  </label>
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '0.95rem', fontWeight: 700, color: '#0284c7' }}>
                    #{h?.senior_code || 'S-056AA0'}
                  </div>
                  <span className="muted" style={{ fontSize: '0.75rem' }}>System-assigned senior directory tracking code.</span>
                </div>
              </div>

              {/* Public Persona & Senior Directory Showcase */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                  Public Directory Profile &amp; Mentorship
                </h3>
                <p className="muted" style={{ fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                  This information is displayed publicly on the Senior Explorer to juniors seeking guidance in your specialization.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                      Public Display Name
                    </label>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Aarav S. (or leave blank to use Full Name)"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                    />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>Name shown to students across ElectIQ.</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                      Professional Headline
                    </label>
                    <input
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Machine Learning Engineer @ Google | PESU Alumni"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                    />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>One-line role, company, or career focus.</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                      Specialization / Technical Domain
                    </label>
                    <input
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="e.g. Machine Learning, Distributed Systems, Cloud Architecture"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                    />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>Core areas of expertise to match junior filters.</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                      LinkedIn Profile URL
                    </label>
                    <input
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                    />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>Allow verified juniors to connect for professional mentorship.</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                      GitHub / Portfolio Link
                    </label>
                    <input
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/username"
                      style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                    />
                    <span className="muted" style={{ fontSize: '0.75rem' }}>Open source contributions and project showcases.</span>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
                    Overarching Guidance &amp; Advice for Junior Students
                  </label>
                  <textarea
                    rows={3}
                    value={adviceForJuniors}
                    onChange={(e) => setAdviceForJuniors(e.target.value)}
                    placeholder="Share essential high-level advice: how to balance CGPA with coding prep, which elective tracks pay off the most, and key mindset shifts for campus placements..."
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.92rem' }}
                  />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Featured prominently on your senior mentorship card.</span>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleSaveProfile('save_profile')}
                  style={{
                    padding: '0.65rem 1.5rem',
                    background: 'var(--blue-deep, #0284c7)',
                    color: '#fff',
                    borderRadius: 8,
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  💾 Save Profile &amp; Academic Information
                </button>
              </div>
            </div>
          )}

          {/* 2. ELECTIVES TAKEN & COURSE FEEDBACK */}
          {activeSection === 'electives' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  4. Electives Taken &amp; Course Feedback (All 4 Electives)
                </h2>
                <span className="tag blue">4 Elective Slots</span>
              </div>
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Select the elective course you completed in each of the 4 university slots and share your verified grade, difficulty rating, placement usefulness, and advice for junior students.
              </p>

              {/* View filter buttons: All 4 together or individual */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setSlotViewMode('all')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: 6,
                    border: slotViewMode === 'all' ? '1px solid var(--blue-deep, #0284c7)' : '1px solid transparent',
                    background: slotViewMode === 'all' ? 'var(--blue-deep, #0284c7)' : 'transparent',
                    color: slotViewMode === 'all' ? '#fff' : '#475569',
                    fontWeight: slotViewMode === 'all' ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  ⚡ View All 4 Electives Together
                </button>
                {ELECTIVE_SLOTS.map((slot, idx) => {
                  const isSel = slotViewMode === slot;
                  const chosenCourse = (subs.feedback || []).find(f => f.elective_slot === slot) || (subs.eligibleCourses || []).find(e => e.elective_slot === slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSlotViewMode(slot)}
                      style={{
                        padding: '0.45rem 0.9rem',
                        borderRadius: 6,
                        border: isSel ? '1px solid var(--blue-deep, #0284c7)' : '1px solid transparent',
                        background: isSel ? 'var(--blue-deep, #0284c7)' : 'transparent',
                        color: isSel ? '#fff' : '#475569',
                        fontWeight: isSel ? 700 : 500,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      Elective {idx + 1} {chosenCourse ? '✓' : ''}
                    </button>
                  );
                })}
              </div>

              {/* Stacked 4 Elective Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {ELECTIVE_SLOTS.filter(slot => slotViewMode === 'all' || slotViewMode === slot).map((slotKey) => {
                  const slotIdx = ELECTIVE_SLOTS.indexOf(slotKey);
                  const slotNumber = slotIdx + 1;
                  const sData = slotStates[slotKey] || {};
                  const existingFb = (subs.feedback || []).find(f => f.elective_slot === slotKey);
                  const coursesForSlot = CURRICULUM_ELECTIVES[slotKey] || [];

                  return (
                    <div
                      key={slotKey}
                      style={{
                        background: '#fff',
                        padding: '1.5rem',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--blue-deep, #0284c7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem' }}>
                            {slotNumber}
                          </span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                              Elective {slotNumber} ({slotKey})
                            </h3>
                            <span className="muted" style={{ fontSize: '0.78rem' }}>
                              Choose 1 course from {coursesForSlot.length} university curriculum offerings
                            </span>
                          </div>
                        </div>

                        {existingFb ? (
                          <span
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              padding: '0.25rem 0.65rem',
                              borderRadius: 20,
                              background: existingFb.moderation_status === 'approved' || existingFb.is_verified ? '#dcfce7' : '#fef3c7',
                              color: existingFb.moderation_status === 'approved' || existingFb.is_verified ? '#15803d' : '#b45309',
                            }}
                          >
                            {existingFb.moderation_status === 'approved' || existingFb.is_verified ? '✓ Approved & Published' : '⏳ Moderation Pending'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '0.25rem 0.65rem', borderRadius: 20, background: '#f1f5f9', color: '#64748b' }}>
                            Not Configured
                          </span>
                        )}
                      </div>

                      {/* Course Dropdown & Grade */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1e293b' }}>
                            Select Elective {slotNumber} Course:
                          </label>
                          <select
                            value={sData.course_id || ''}
                            onChange={(e) => updateSlot(slotKey, 'course_id', e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.9rem', background: '#fff', fontWeight: 600 }}
                          >
                            <option value="">-- Choose an elective from {slotKey} ({coursesForSlot.length} available) --</option>
                            {coursesForSlot.map((c) => (
                              <option key={c.course_id} value={c.course_id}>
                                {c.title} [{c.vertical}]
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem', color: '#1e293b' }}>
                            Grade Points Obtained (0.0 – 10.0):
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={sData.grade_points || '8.5'}
                            onChange={(e) => updateSlot(slotKey, 'grade_points', e.target.value)}
                            placeholder="e.g. 9.0"
                            style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.9rem' }}
                          />
                        </div>
                      </div>

                      {/* Difficulty, Usefulness, Workload Sliders */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #f1f5f9', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Difficulty Level:</span>
                            <b style={{ color: '#0f172a', fontSize: '0.85rem' }}>{sData.difficulty || 3} / 5</b>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={sData.difficulty || 3}
                            onChange={(e) => updateSlot(slotKey, 'difficulty', Number(e.target.value))}
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Placement Usefulness:</span>
                            <b style={{ color: '#059669', fontSize: '0.85rem' }}>{sData.usefulness || 4} / 5</b>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={sData.usefulness || 4}
                            onChange={(e) => updateSlot(slotKey, 'usefulness', Number(e.target.value))}
                            style={{ width: '100%' }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Semester Workload:</span>
                            <b style={{ color: '#0f172a', fontSize: '0.85rem' }}>{sData.workload || 3} / 5</b>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            value={sData.workload || 3}
                            onChange={(e) => updateSlot(slotKey, 'workload', Number(e.target.value))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '0.85rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600, color: '#1e293b' }}>
                          <input
                            type="checkbox"
                            checked={sData.placement_help !== false}
                            onChange={(e) => updateSlot(slotKey, 'placement_help', e.target.checked)}
                          />
                          This elective directly helped in technical interview / placement rounds
                        </label>
                      </div>

                      <div style={{ marginBottom: '0.85rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem', color: '#1e293b' }}>
                          Course Experience & Detailed Review
                        </label>
                        <textarea
                          rows={2}
                          value={sData.review_text || ''}
                          onChange={(e) => updateSlot(slotKey, 'review_text', e.target.value)}
                          placeholder="How was the teaching, grading, assignments, and practical depth of this elective?"
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.88rem' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            Recommended Learning Resources & Texts
                          </label>
                          <input
                            value={sData.recommended_resources || ''}
                            onChange={(e) => updateSlot(slotKey, 'recommended_resources', e.target.value)}
                            placeholder="e.g. Stanford lecture notes, Official docs"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            Extra Preparation Needed Outside Class
                          </label>
                          <input
                            value={sData.extra_prep_needed || ''}
                            onChange={(e) => updateSlot(slotKey, 'extra_prep_needed', e.target.value)}
                            placeholder="e.g. Python, Linear Algebra, PyTorch basics"
                            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Practical Advice for Juniors Taking This Elective
                        </label>
                        <textarea
                          rows={2}
                          value={sData.advice_for_juniors || ''}
                          onChange={(e) => updateSlot(slotKey, 'advice_for_juniors', e.target.value)}
                          placeholder="What specific strategies or pitfalls should 3rd year students know before choosing this elective?"
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.88rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => handleSaveSlot(slotKey)}
                          style={{
                            padding: '0.55rem 1.4rem',
                            background: 'var(--blue-deep, #0284c7)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                          }}
                        >
                          Save Elective {slotNumber} ({slotKey}) & Feedback
                        </button>

                        {existingFb && (
                          <button
                            type="button"
                            onClick={() => handleDeleteItem('feedback', { feedback_id: existingFb.feedback_id })}
                            style={{ background: 'none', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.45rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem' }}
                          >
                            Remove Feedback
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. EXTRA PREPARATION */}
          {activeSection === 'internships' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>3. Internships &amp; Industrial Training</h2>
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Add your summer / semester internship experiences.
              </p>

              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                {editingInternshipId && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '0.6rem 0.9rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>
                      Editing Internship Record #{editingInternshipId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingInternshipId(null);
                        setIntCompanyId('');
                        setIntRoleId('');
                        setIntPkg('');
                        setIntDuration('6');
                        setIntStipend('');
                        setIntLocation('Bengaluru');
                        setIntPpo(false);
                        setIntTech('');
                        setIntDesc('');
                      }}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      ✕ Cancel Edit
                    </button>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Company</label>
                    <select
                      value={intCompanyId}
                      onChange={(e) => setIntCompanyId(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="">Select Company...</option>
                      {(lookups.data?.companies ?? []).map((c) => (
                        <option key={c.company_id} value={c.company_id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Role</label>
                    <select
                      value={intRoleId}
                      onChange={(e) => setIntRoleId(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="">Select Role...</option>
                      {(lookups.data?.roles ?? []).map((r) => (
                        <option key={r.role_id} value={r.role_id}>{r.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Duration (Months)</label>
                    <input
                      type="number"
                      value={intDuration}
                      onChange={(e) => setIntDuration(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Tech Stack</label>
                    <input
                      value={intTech}
                      onChange={(e) => setIntTech(e.target.value)}
                      placeholder="e.g. Python, Docker, Kubernetes"
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={intPpo} onChange={(e) => setIntPpo(e.target.checked)} />
                      Converted to Pre-Placement Offer (PPO)
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Work Done / Description</label>
                  <textarea
                    rows={2}
                    value={intDesc}
                    onChange={(e) => setIntDesc(e.target.value)}
                    placeholder="Briefly describe what you built and delivered during this internship..."
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    if (!intCompanyId || !intRoleId) return alert('Select company and role');
                    const payload = {
                      company_id: intCompanyId,
                      role_id: intRoleId,
                      package_lpa: intPkg || 0,
                      year: intYear,
                      duration_months: intDuration,
                      stipend_monthly: intStipend || 0,
                      location: intLocation,
                      tech_stack: intTech,
                      work_description: intDesc,
                      ppo_received: intPpo,
                    };
                    if (editingInternshipId) {
                      payload.placement_id = editingInternshipId;
                      await handleContribution('internship', payload, 'Internship entry updated successfully!', 'update');
                      setEditingInternshipId(null);
                    } else {
                      await handleContribution('internship', payload, 'Internship entry saved!');
                    }
                    setIntCompanyId('');
                    setIntRoleId('');
                    setIntPkg('');
                    setIntStipend('');
                    setIntTech('');
                    setIntDesc('');
                  }}
                  style={{ padding: '0.45rem 1rem', background: editingInternshipId ? '#059669' : 'var(--blue-deep, #0284c7)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  {editingInternshipId ? '✓ Update Internship Entry' : 'Save Internship'}
                </button>
              </div>

              {/* List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(subs.internships || []).map((it) => (
                  <div key={it.placement_id} style={{ padding: '0.75rem 1rem', borderRadius: 6, background: '#f8fafc', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <b>{it.role_title}</b> at <b>{it.company_name}</b> ({it.duration_months} mos)
                      {it.ppo_received && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}>PPO Converted</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingInternshipId(it.placement_id);
                          setIntCompanyId(String(it.company_id || ''));
                          setIntRoleId(String(it.role_id || ''));
                          setIntPkg(String(it.package_lpa || ''));
                          setIntDuration(String(it.duration_months || '6'));
                          setIntStipend(String(it.stipend_monthly || ''));
                          setIntLocation(it.location || 'Bengaluru');
                          setIntPpo(Boolean(it.ppo_received));
                          setIntTech(it.tech_stack || '');
                          setIntDesc(it.work_description || '');
                          if (typeof window !== 'undefined') window.scrollTo({ top: 200, behavior: 'smooth' });
                        }}
                        style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem('internship', { placement_id: it.placement_id })}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. PROJECTS */}
          {activeSection === 'projects' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>6. Projects &amp; Open Source Repositories</h2>
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Showcase projects completed for university electives or portfolio.
              </p>

              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Related Elective</label>
                    <select
                      value={prjCourseId}
                      onChange={(e) => setPrjCourseId(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="">Select Elective...</option>
                      {(lookups.data?.electives ?? []).map((c) => (
                        <option key={c.course_id} value={c.course_id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Project Title</label>
                    <input
                      value={prjTitle}
                      onChange={(e) => setPrjTitle(e.target.value)}
                      placeholder="e.g. Distributed Consensus Engine"
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Tech Stack</label>
                    <input
                      value={prjTech}
                      onChange={(e) => setPrjTech(e.target.value)}
                      placeholder="e.g. Go, Raft, gRPC, Docker"
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>GitHub Repository Link</label>
                    <input
                      value={prjRepo}
                      onChange={(e) => setPrjRepo(e.target.value)}
                      placeholder="https://github.com/..."
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Problem Solved & Outcome</label>
                  <textarea
                    rows={2}
                    value={prjProblem}
                    onChange={(e) => setPrjProblem(e.target.value)}
                    placeholder="What problem did you solve and what was the impact during interviews?"
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (!prjCourseId || !prjTitle) return alert('Fill elective and project title');
                    handleContribution('projects', {
                      course_id: prjCourseId,
                      title: prjTitle,
                      tech_stack: prjTech,
                      repo_link: prjRepo,
                      problem_statement: prjProblem,
                      outcome: prjOutcome || 'Demonstrated core concepts in technical interview',
                    }, 'Project logged successfully!');
                  }}
                  style={{ padding: '0.45rem 1rem', background: 'var(--blue-deep, #0284c7)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  Save Project
                </button>
              </div>

              {/* List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(subs.projects || []).map((pj) => (
                  <div key={pj.project_id} style={{ padding: '0.75rem 1rem', borderRadius: 6, background: '#f8fafc', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <b>{pj.title}</b> &bull; <span className="muted">{pj.elective_name}</span>
                      {pj.tech_stack && <div className="muted" style={{ fontSize: '0.8rem' }}>Tech: {pj.tech_stack}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem('projects', { project_id: pj.project_id })}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. RESEARCH PAPERS */}
          {activeSection === 'interview_prep' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>7. Structured Interview Preparation Blueprint</h2>
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Fill these guided prompts to create a blueprint for juniors preparing for recruitment.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    DSA & Problem Solving Strategy
                  </label>
                  <textarea
                    rows={3}
                    value={dsaStrategy}
                    onChange={(e) => setDsaStrategy(e.target.value)}
                    placeholder="Which topics did you prioritize (Two Pointers, Sliding Window, DP, Graphs)? How many problems per day?"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Coding Languages Used
                    </label>
                    <input
                      value={languagesUsed}
                      onChange={(e) => setLanguagesUsed(e.target.value)}
                      placeholder="e.g. C++ (STL), Python, SQL"
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Practice Platforms Used
                    </label>
                    <input
                      value={platformsUsed}
                      onChange={(e) => setPlatformsUsed(e.target.value)}
                      placeholder="e.g. LeetCode (350 solved), Codeforces (Div 2), NeetCode 150"
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Core Computer Science Subjects Revised
                  </label>
                  <textarea
                    rows={2}
                    value={coreSubjects}
                    onChange={(e) => setCoreSubjects(e.target.value)}
                    placeholder="Which concepts were asked the most in OS, DBMS, Computer Networks, and Low-Level Design?"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Mock Interviews Practice
                    </label>
                    <textarea
                      rows={2}
                      value={mockInterviews}
                      onChange={(e) => setMockInterviews(e.target.value)}
                      placeholder="How many peer mocks did you do? On Pramp / with classmates?"
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                      HR / Behavioral Round Prep
                    </label>
                    <textarea
                      rows={2}
                      value={hrPrep}
                      onChange={(e) => setHrPrep(e.target.value)}
                      placeholder="STAR method stories, leadership questions, culture fit prep..."
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem', color: '#be123c' }}>
                    Mistakes to Avoid
                  </label>
                  <textarea
                    rows={2}
                    value={mistakesAvoid}
                    onChange={(e) => setMistakesAvoid(e.target.value)}
                    placeholder="What costly mistakes did you or your friends make that cost rounds?"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    handleContribution('interview_prep', {
                      strategy: dsaStrategy,
                      dsa_strategy: dsaStrategy,
                      languages_used: languagesUsed,
                      platforms_used: platformsUsed,
                      core_subjects_revised: coreSubjects,
                      mock_interviews: mockInterviews,
                      hr_prep: hrPrep,
                      mistakes_to_avoid: mistakesAvoid,
                      weeks: prepWeeks,
                    }, 'Interview preparation guide saved!');
                  }}
                  style={{ padding: '0.5rem 1.25rem', background: 'var(--blue-deep, #0284c7)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-start' }}
                >
                  Save Interview Strategy
                </button>
              </div>
            </div>
          )}

          {/* 9. PLACEMENT DETAILS */}
          {activeSection === 'placement' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>2. Full-Time Placement Details &amp; Offers</h2>
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Record your full-time placement offer. Package is verified and automatically classified into the appropriate salary range.
              </p>

              <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                {editingPlacementId && (
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '0.6rem 0.9rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>
                      Editing Placement Record #{editingPlacementId}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlacementId(null);
                        setPlcCompanyId('');
                        setPlcRoleId('');
                        setPlcPkg('');
                        setPlcYear('2025');
                        setPlcLocation('Bengaluru');
                        setPlcRemote(false);
                        setPlcWorkDesc('');
                        setPlcPpo(false);
                        setPlcMode('on_campus');
                        setPlcEvidence('');
                      }}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      ✕ Cancel Edit
                    </button>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Company</label>
                    <select
                      value={plcCompanyId}
                      onChange={(e) => setPlcCompanyId(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="">Select Company...</option>
                      {(lookups.data?.companies ?? []).map((c) => (
                        <option key={c.company_id} value={c.company_id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Job Role</label>
                    <select
                      value={plcRoleId}
                      onChange={(e) => setPlcRoleId(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="">Select Role...</option>
                      {(lookups.data?.roles ?? []).map((r) => (
                        <option key={r.role_id} value={r.role_id}>{r.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Package (LPA)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={plcPkg}
                      onChange={(e) => setPlcPkg(e.target.value)}
                      placeholder="e.g. 18.5"
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Job Location</label>
                    <input
                      value={plcLocation}
                      onChange={(e) => setPlcLocation(e.target.value)}
                      placeholder="e.g. Bengaluru, Hyderabad"
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Hiring Channel</label>
                    <select
                      value={plcMode}
                      onChange={(e) => setPlcMode(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                    >
                      <option value="on_campus">On-Campus Placement</option>
                      <option value="off_campus">Off-Campus Referral / Contest</option>
                      <option value="ppo">PPO from Internship</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input type="checkbox" checked={plcPpo} onChange={(e) => setPlcPpo(e.target.checked)} />
                      Converted via PPO
                    </label>
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Role Description & Tech Stack</label>
                  <textarea
                    rows={2}
                    value={plcWorkDesc}
                    onChange={(e) => setPlcWorkDesc(e.target.value)}
                    placeholder="e.g. Backend engineering for high-throughput messaging microservices."
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Verification Evidence / Placement Cell Reference
                  </label>
                  <input
                    value={plcEvidence}
                    onChange={(e) => setPlcEvidence(e.target.value)}
                    placeholder="e.g. Offer letter ref #GOOG-IN-2025-SDE-99812 verified by Campus Placement Cell"
                    style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Required for Admin placement verification and salary tier publication.</span>
                </div>

                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    if (!plcCompanyId || !plcRoleId || !plcPkg) return alert('Fill company, role and package');
                    const payload = {
                      company_id: plcCompanyId,
                      role_id: plcRoleId,
                      package_lpa: plcPkg,
                      year: plcYear,
                      location: plcLocation,
                      is_remote: plcRemote,
                      work_description: plcWorkDesc,
                      ppo_received: plcPpo,
                      placement_mode: plcMode,
                      evidence_text: plcEvidence,
                    };
                    if (editingPlacementId) {
                      payload.placement_id = editingPlacementId;
                      await handleContribution('placement', payload, 'Placement offer updated successfully!', 'update');
                      setEditingPlacementId(null);
                    } else {
                      await handleContribution('placement', payload, 'Placement offer recorded!');
                    }
                    setPlcCompanyId('');
                    setPlcRoleId('');
                    setPlcPkg('');
                    setPlcWorkDesc('');
                    setPlcEvidence('');
                  }}
                  style={{ padding: '0.45rem 1rem', background: editingPlacementId ? '#059669' : 'var(--blue-deep, #0284c7)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                >
                  {editingPlacementId ? '✓ Save Changes to Placement' : 'Record Placement'}
                </button>
              </div>

              {/* List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(subs.placements || []).map((pl) => (
                  <div key={pl.placement_id} style={{ padding: '0.75rem 1rem', borderRadius: 6, background: '#f8fafc', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <b style={{ color: '#059669', fontSize: '1.05rem' }}>{lpa(pl.package_lpa)}</b>
                        <span>&bull;</span>
                        <b>{pl.company_name}</b> ({pl.role_title})
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: 10,
                            background: pl.verification_status === 'verified' || pl.verified ? '#dcfce7' : pl.verification_status === 'rejected' ? '#fee2e2' : '#fef3c7',
                            color: pl.verification_status === 'verified' || pl.verified ? '#15803d' : pl.verification_status === 'rejected' ? '#b91c1c' : '#b45309',
                          }}
                        >
                          {pl.verification_status === 'verified' || pl.verified ? '✓ Verified by Admin' : pl.verification_status === 'rejected' ? '✕ Rejected' : '⏳ Verification Pending'}
                        </span>
                      </div>
                      <div className="muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        Location: {pl.location} &bull; Mode: {pl.placement_mode}
                        {pl.evidence_text && <span> &bull; Ref: <i>{pl.evidence_text}</i></span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPlacementId(pl.placement_id);
                          setPlcCompanyId(String(pl.company_id || ''));
                          setPlcRoleId(String(pl.role_id || ''));
                          setPlcPkg(String(pl.package_lpa || ''));
                          setPlcYear(String(pl.year || '2025'));
                          setPlcLocation(pl.location || 'Bengaluru');
                          setPlcRemote(Boolean(pl.is_remote));
                          setPlcWorkDesc(pl.work_description || '');
                          setPlcPpo(Boolean(pl.ppo_received));
                          setPlcMode(pl.placement_mode || 'on_campus');
                          setPlcEvidence(pl.evidence_text || '');
                          if (typeof window !== 'undefined') window.scrollTo({ top: 200, behavior: 'smooth' });
                        }}
                        style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem('placement', { placement_id: pl.placement_id })}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. EXAM QUESTIONS */}
          {activeSection === 'contributions' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>7. Approval Status &amp; Submissions</h2>
              <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Everything you submit is reviewed by an administrator. Students only see items after approval.
              </p>

              {(() => {
                const rows = [
                  ['Profile', [{ st: prof.status }]],
                  ['Placements & offers', (subs.placements || []).map((x) => ({ st: x.verification_status || 'pending' }))],
                  ['Internships', (subs.internships || []).map((x) => ({ st: x.verification_status || 'pending' }))],
                  ['Elective reviews', (subs.feedback || []).map((x) => ({ st: x.moderation_status || 'pending' }))],
                  ['Projects', (subs.projects || []).map((x) => ({ st: x.moderation_status || 'pending' }))],
                  ['Interview preparation', (subs.interviewPrep || []).map((x) => ({ st: x.moderation_status || 'pending' }))],
                ];
                const live = (st) => st === 'published' || st === 'approved' || st === 'verified';
                const bad = (st) => st === 'rejected' || st === 'changes_requested';
                return (
                  <div className="card" style={{ padding: '1rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', margin: '0 0 0.6rem 0' }}>Where your submissions stand</h3>
                    <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ textAlign: 'left' }}><th>Section</th><th>Visible to students</th><th>Waiting for admin</th><th>Needs changes</th></tr></thead>
                      <tbody>
                        {rows.map(([label, items]) => (
                          <tr key={label} style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
                            <td style={{ padding: '0.4rem 0' }}>{label}</td>
                            <td>{items.filter((i) => live(i.st)).length}</td>
                            <td>{items.filter((i) => !live(i.st) && !bad(i.st) && !(label === 'Profile' && i.st === 'draft')).length}</td>
                            <td style={{ color: items.some((i) => bad(i.st)) ? '#b91c1c' : undefined }}>{items.filter((i) => bad(i.st)).length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {prof.status === 'draft' && <p className="muted" style={{ margin: '0.6rem 0 0', fontSize: '0.82rem' }}>Your profile is still a draft. Use <b>Submit for Admin Approval</b> at the top so students can see it.</p>}
                  </div>
                );
              })()}

            </div>
          )}
        </div>
      </div>

      {previewOpen && (
        <SeniorProfileModal
          seniorCode={h?.senior_code}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
