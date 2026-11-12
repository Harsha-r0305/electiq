'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, Notice } from '@/components/ui';

export default function Login() {
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api('/api/auth/login', { method: 'POST', body: f }); window.location.href = '/'; }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="auth">
      <h1>ElectIQ</h1>
      <p className="muted">Choose your electives with real data from seniors: difficulty, resources, placements and the skills each course builds.</p>
      <form className="card" onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Sign in</h2>
        <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" required autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="pw">Password</label><input id="pw" type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <Notice error={err} />
        <button className="btn" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <p className="small" style={{ marginTop: '.8rem' }}>New student? <Link href="/register">Create an account</Link></p>
      </form>
      <div className="hint" style={{ marginTop: '1rem' }}>
        Demo accounts (password <b>Password@123</b>): student1@, senior1@, faculty1@ and admin@electiq.dev
      </div>
    </div>
  );
}
