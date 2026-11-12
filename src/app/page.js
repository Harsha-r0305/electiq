'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApi, Loading } from '@/components/ui';
import StudentDashboard from '@/components/StudentDashboard';
import SeniorDashboard from '@/components/SeniorDashboard';
import FacultyDashboard from '@/components/FacultyDashboard';
import AdminPage from './admin/page';

export default function Dashboard() {
  const me = useApi('/api/auth/me');
  const router = useRouter();

  useEffect(() => {
    if (!me.loading && (me.error || !me.data)) {
      router.replace('/login');
    } else if (!me.loading && me.data?.role === 'admin') {
      router.replace('/admin');
    }
  }, [me.loading, me.error, me.data, router]);

  if (me.loading) return <Loading state={me} />;

  if (me.error || !me.data) {
    return (
      <div style={{ maxWidth: 500, margin: '4rem auto', textAlign: 'center', padding: '2.5rem 2rem' }} className="card">
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎓</div>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
          Welcome to ElectIQ
        </h2>
        <p className="muted" style={{ margin: '0 0 1.75rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
          Your student academic and placement guidance platform. Please sign in to view your personalized dashboard and elective trajectories.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 300, margin: '0 auto' }}>
          <Link
            href="/login"
            className="btn"
            style={{
              display: 'block',
              padding: '0.75rem 1.5rem',
              background: 'var(--blue-deep, #0284c7)',
              color: '#fff',
              fontWeight: 700,
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: '0.95rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
            }}
          >
            Sign In to ElectIQ &rarr;
          </Link>
          <Link
            href="/register"
            style={{
              fontSize: '0.88rem',
              color: '#64748b',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            New student? Create an account
          </Link>
        </div>
      </div>
    );
  }

  const role = me.data?.role;

  if (role === 'senior') {
    return <SeniorDashboard />;
  }

  if (role === 'faculty') {
    return <FacultyDashboard />;
  }

  if (role === 'admin') {
    return <AdminPage />;
  }

  // Default: student dashboard
  return <StudentDashboard />;
}
