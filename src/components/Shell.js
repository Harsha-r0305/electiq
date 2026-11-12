'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, Notice } from './ui';

const NAV = [
  ['/', 'Dashboard', ['student', 'senior', 'faculty']],
  ['/courses', 'Elective explorer', ['student']],
  ['/compare', 'Compare courses', ['student']],
  ['/career', 'Career simulator', ['student']],
  ['/seniors', 'Senior Explorer', ['student']],
  ['/market-trends', 'Market trends', ['student', 'faculty']],
  ['/questions', 'Interview questions', ['student']],
  ['/exam-questions', 'Exam questions', ['student', 'senior', 'faculty']],
  ['/analytics', 'Analytics', ['student', 'faculty']],
  ['/admin', 'Administrator Console', ['admin']],
];

const GUEST_NAV = [
  ['/login', 'Sign in →', null],
  ['/register', 'Create account', null],
  ['/courses', 'Elective explorer', null],
  ['/compare', 'Compare courses', null],
  ['/seniors', 'Senior Explorer', null],
  ['/career', 'Career simulator', null],
  ['/market-trends', 'Market trends', null],
];

const ROLE_LABEL = {
  student: 'Student',
  senior: 'Senior (Contribution-only)',
  faculty: 'Faculty Member',
  admin: 'Administrator'
};

function PasswordModal({ onClose }) {
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (pwd.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (pwd !== confirmPwd) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: { password: pwd } });
      setOk('Password updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%' }}>
        <h3>Change password</h3>
        <Notice error={error} ok={ok} />
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>New password
              <input type="password" required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Minimum 8 characters" />
            </label>
          </div>
          <div className="field" style={{ marginTop: '0.8rem' }}>
            <label>Confirm new password
              <input type="password" required minLength={8} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Re-enter new password" />
            </label>
          </div>
          <div className="row" style={{ marginTop: '1.2rem', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn small" disabled={busy}>Update password</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Shell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [showPwd, setShowPwd] = useState(false);
  const bare = path === '/login' || path === '/register';

  useEffect(() => {
    if (!bare) {
      api('/api/auth/me').then(setMe).catch(() => setMe(null));
    }
  }, [bare, path]);

  if (bare) return <div className="plain">{children}</div>;

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setMe(null);
    router.push('/login');
    router.refresh();
  };

  const visibleNav = me
    ? NAV.filter(([, , roles]) => !roles || roles.includes(me.role))
    : GUEST_NAV;

  return (
    <div className="app">
      <aside className="side">
        <Link href="/" className="brand">Elect<span>IQ</span></Link>
        <nav aria-label="Main">
          {visibleNav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={path === href || (href !== '/' && path.startsWith(href)) ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
        </nav>
        {me ? (
          <div className="who">
            <b>{me.name}</b>
            <span className="small muted" style={{ display: 'block' }}>
              {ROLE_LABEL[me.role] || me.role}
              {me.srn && ` · ${me.srn}`}
              {me.senior_code && ` · #${me.senior_code}`}
            </span>
            <div style={{ marginTop: '0.4rem' }}>
              <button className="link-btn" onClick={() => setShowPwd(true)}>Change password</button> · <button className="link-btn" onClick={logout}>Sign out</button>
            </div>
          </div>
        ) : (
          <div className="who" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.85rem' }}>
            <b style={{ color: '#0369a1', fontSize: '0.85rem' }}>Account Access</b>
            <span className="small muted" style={{ display: 'block', margin: '0.2rem 0 0.6rem', fontSize: '0.78rem' }}>
              Sign in to view your personalized dashboard and elective feedback.
            </span>
            <Link
              href="/login"
              className="btn small"
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'var(--blue-deep, #0284c7)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                borderRadius: 6,
                padding: '0.4rem',
                fontSize: '0.82rem',
              }}
            >
              Sign In to ElectIQ &rarr;
            </Link>
          </div>
        )}
      </aside>
      <main className="main">{children}</main>
      {showPwd && <PasswordModal onClose={() => setShowPwd(false)} />}
    </div>
  );
}
