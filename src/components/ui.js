'use client';
import { useEffect, useState } from 'react';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith('/login')) location.href = '/login';
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export function useApi(path) {
  const [state, set] = useState({ data: null, error: null, loading: !!path });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) { set({ data: null, error: null, loading: false }); return; }
    let live = true;
    set((s) => ({ ...s, loading: true, error: null }));
    api(path).then((d) => live && set({ data: d, error: null, loading: false })).catch((e) => live && set({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [path, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export const fmt = (n, d = 1) => (n === null || n === undefined || n === '' ? '-' : Number(n).toFixed(d));
export const lpa = (n) => (n === null || n === undefined ? '-' : `${Number(n).toFixed(1)} LPA`);

export function Notice({ error, ok, warn, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(false);
  }, [error, ok, warn]);

  if (dismissed || (!error && !ok && !warn)) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  if (error) {
    return (
      <div className="notice err" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>⚠️ {error}</span>
        <button
          type="button"
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', color: '#8b1d33', cursor: 'pointer', fontSize: '1.25rem', padding: '0 0.4rem', fontWeight: 'bold', lineHeight: 1 }}
          aria-label="Dismiss notice"
        >
          &times;
        </button>
      </div>
    );
  }
  if (ok) {
    return (
      <div className="notice ok" role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>✓ {ok}</span>
        <button
          type="button"
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', color: '#0a5c51', cursor: 'pointer', fontSize: '1.25rem', padding: '0 0.4rem', fontWeight: 'bold', lineHeight: 1 }}
          aria-label="Dismiss notice"
        >
          &times;
        </button>
      </div>
    );
  }
  if (warn) {
    return (
      <div className="notice warn" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>ℹ️ {warn}</span>
        <button
          type="button"
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', color: '#7a4004', cursor: 'pointer', fontSize: '1.25rem', padding: '0 0.4rem', fontWeight: 'bold', lineHeight: 1 }}
          aria-label="Dismiss notice"
        >
          &times;
        </button>
      </div>
    );
  }
  return null;
}

export function Loading({ state }) {
  if (state.loading) return <p className="muted">Loading...</p>;
  if (state.error) return <Notice error={state.error} />;
  return null;
}

// Difficulty ruler: a pin on a 1-5 scale
export function Ruler({ value, max = 5, invert = false }) {
  if (value === null || value === undefined) return <div className="ruler empty" />;
  const v = Number(value);
  const pct = ((v - 1) / (max - 1)) * 100;
  const hot = invert ? v <= 2.3 : v >= 3.7;
  const cool = invert ? v >= 3.7 : v <= 2.3;
  return (
    <div className={`ruler ${hot ? 'hot' : cool ? 'cool' : ''}`} role="img" aria-label={`${v.toFixed(1)} out of ${max}`} title={`${v.toFixed(1)} / ${max}`}>
      {[0, 25, 50, 75, 100].map((p) => <i key={p} style={{ left: `${p}%` }} />)}
      <b style={{ left: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([key, label]) => (
        <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}>{label}</button>
      ))}
    </div>
  );
}

export function Field({ label, children }) {
  return <div className="field"><label>{label}{children}</label></div>;
}

// Small helper hook for forms that call the API
export function useAction() {
  const [s, set] = useState({ busy: false, error: null, ok: null });
  const run = async (fn, okMsg = 'Saved.') => {
    set({ busy: true, error: null, ok: null });
    try { const r = await fn(); set({ busy: false, error: null, ok: typeof okMsg === 'function' ? okMsg(r) : okMsg }); return r; }
    catch (e) { set({ busy: false, error: e.message, ok: null }); return null; }
  };
  return [s, run];
}

export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
      <div className="shrink">
        <button
          type="button"
          className="btn ghost small"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          &larr; Previous
        </button>
      </div>
      <span className="small muted">
        Page {page} of {totalPages}
      </span>
      <div className="shrink">
        <button
          type="button"
          className="btn ghost small"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

export function LoadMore({ hasMore, onLoadMore, count, total }) {
  if (!hasMore) return null;
  return (
    <div style={{ textAlign: 'center', margin: '1rem 0' }}>
      <button type="button" className="btn ghost small" onClick={onLoadMore}>
        Load more {count && total ? `(${count} of ${total})` : ''}
      </button>
    </div>
  );
}

