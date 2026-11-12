'use client';
import { useState } from 'react';
import { api, Notice } from './ui';

export default function ReportModal({ contentType, contentId, title = 'Report Item', onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError('Please provide a specific reason (at least 5 characters).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/report', {
        method: 'POST',
        body: {
          content_type: contentType,
          content_id: contentId,
          reason: reason.trim()
        }
      });
      setOk('Item flagged to administrators for review.');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
    }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', background: 'var(--card-bg, #1a202c)' }}>
        <h3>Flag Misleading or Inappropriate Item</h3>
        <p className="small muted">
          Reporting <b>{contentType} #{contentId}</b>. Your report will be placed in the administrator moderation queue.
        </p>
        <Notice error={error} ok={ok} />
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Why are you flagging this? (Reason is mandatory)
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain clearly why this item is inaccurate, misleading, offensive, or out of date..."
              />
            </label>
          </div>
          <div className="row" style={{ marginTop: '1rem', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn ghost small" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn danger small" disabled={busy}>Submit report</button>
          </div>
        </form>
      </div>
    </div>
  );
}

