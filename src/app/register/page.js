'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, Notice, useApi } from '@/components/ui';

export default function Register() {
  const depts = useApi('/api/departments');
  const [f, setF] = useState({ name: '', email: '', srn: '', dept_id: '', batch_year: new Date().getFullYear() + 3, password: '' });
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr(null);
    try { await api('/api/auth/register', { method: 'POST', body: f }); setDone(true); } catch (x) { setErr(x.message); }
  };
  if (done) return <div className="auth card"><h1>Account created</h1><p>Your student account is ready. Seniors and faculty accounts are set up by an administrator.</p><Link className="btn" href="/login">Go to sign in</Link></div>;
  return (
    <form className="auth card" onSubmit={submit}>
      <h1>Create a student account</h1>
      <div className="field"><label htmlFor="n">Full name</label><input id="n" required value={f.name} onChange={set('name')} /></div>
      <div className="field"><label htmlFor="e">University email</label><input id="e" type="email" required value={f.email} onChange={set('email')} /></div>
      <div className="row">
        <div className="field"><label htmlFor="s">SRN</label><input id="s" required value={f.srn} onChange={set('srn')} /></div>
        <div className="field"><label htmlFor="b">Batch (graduation year)</label><input id="b" type="number" required value={f.batch_year} onChange={set('batch_year')} /></div>
      </div>
      <div className="field"><label htmlFor="d">Department</label>
        <select id="d" required value={f.dept_id} onChange={set('dept_id')}><option value="">Select...</option>{(depts.data ?? []).map((d) => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}</select></div>
      <div className="field"><label htmlFor="p">Password</label><input id="p" type="password" required autoComplete="new-password" value={f.password} onChange={set('password')} /><span className="small muted">At least 8 characters, with a letter and a number.</span></div>
      <Notice error={err} />
      <button className="btn">Create account</button>
      <p className="small" style={{ marginTop: '.8rem' }}>Already registered? <Link href="/login">Sign in</Link></p>
    </form>
  );
}
