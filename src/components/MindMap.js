'use client';
import { useState } from 'react';

// Radial skill map: course in the centre; taught skills, project-tagged skills and graph-related skills on three rings.
const ring = (items, r, cx, cy) => items.map((it, i) => {
  const a = (2 * Math.PI * i) / Math.max(items.length, 1) - Math.PI / 2;
  return { ...it, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
});

export default function MindMap({ data }) {
  const [hovered, setHovered] = useState(null);

  if (!data || !data.course) return null;

  const W = 780, H = 560, cx = W / 2, cy = H / 2;
  const taughtNames = new Set((data.taught || []).map((s) => s.name));
  const projOnly = (data.fromProjects || []).filter((s) => !taughtNames.has(s.name));
  const rel = (data.related || []).filter((s) => !taughtNames.has(s.name)).slice(0, 12);

  const a = ring(data.taught || [], 135, cx, cy);
  const b = ring(projOnly, 215, cx, cy);
  const c = ring(rel, 260, cx, cy);

  const label = (n) => (n.length > 20 ? n.slice(0, 18) + '…' : n);

  const renderNode = (n, color, ringType, extra) => {
    const isHovered = hovered === n.name;
    const r = extra?.r ?? (10 + (n.depth ?? 1) * 3);

    return (
      <g
        key={n.name}
        onMouseEnter={() => setHovered(n.name)}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
      >
        <title>{`${n.name}${n.cluster ? ` (Cluster: ${n.cluster})` : ''} - ${ringType}`}</title>
        {isHovered && (
          <circle cx={n.x} cy={n.y} r={r + 6} fill={color} opacity="0.25" />
        )}
        <circle
          cx={n.x}
          cy={n.y}
          r={r}
          fill={color}
          stroke="#ffffff"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
        />
        <text
          x={n.x}
          y={n.y + (n.y < cy ? -(r + 8) : r + 15)}
          textAnchor="middle"
          fill="#1e293b"
          style={{
            fontSize: isHovered ? '11px' : '10px',
            fontWeight: isHovered ? 700 : 600,
            paintOrder: 'stroke',
            stroke: '#ffffff',
            strokeWidth: '3px',
            strokeLinejoin: 'round',
          }}
        >
          {label(n.name)}
        </text>
        {n.depth && (
          <text
            x={n.x}
            y={n.y + 3.5}
            textAnchor="middle"
            fill="#ffffff"
            style={{ fontSize: '9px', fontWeight: 800, pointerEvents: 'none' }}
          >
            L{n.depth}
          </text>
        )}
      </g>
    );
  };

  const clusters = [...new Set(rel.map((s) => s.cluster).filter(Boolean))];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
          Interactive Course Competency & Industry Skill Map
        </span>
        {data.graphAvailable ? (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 12, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
            🟢 Neo4j Cypher Traversal
          </span>
        ) : (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 12, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }} title="Neo4j graph database is offline. Skills computed via PostgreSQL relational co-occurrence graph mirror.">
            ℹ️ PostgreSQL Graph Mirror (Fallback)
          </span>
        )}
      </div>
      <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', maxHeight: '560px', display: 'block' }}
          role="img"
          aria-label={`Skill map for ${data.course.title}`}
        >
          {/* Guide Rings */}
          <circle cx={cx} cy={cy} r="135" fill="none" stroke="#e2e8f0" strokeDasharray="4 4" />
          <circle cx={cx} cy={cy} r="215" fill="none" stroke="#e2e8f0" strokeDasharray="4 4" />
          <circle cx={cx} cy={cy} r="260" fill="none" stroke="#e2e8f0" strokeDasharray="4 4" />

          {/* Links */}
          {a.map((n) => (
            <line
              key={'a' + n.name}
              x1={cx}
              y1={cy}
              x2={n.x}
              y2={n.y}
              stroke="#0284c7"
              strokeWidth="2"
              opacity={hovered && hovered !== n.name ? 0.2 : 0.6}
            />
          ))}
          {b.map((n) => (
            <line
              key={'b' + n.name}
              x1={cx}
              y1={cy}
              x2={n.x}
              y2={n.y}
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity={hovered && hovered !== n.name ? 0.2 : 0.5}
            />
          ))}
          {c.map((n) => (
            <line
              key={'c' + n.name}
              x1={cx}
              y1={cy}
              x2={n.x}
              y2={n.y}
              stroke="#8b5cf6"
              strokeWidth="1.2"
              strokeDasharray="2 3"
              opacity={hovered && hovered !== n.name ? 0.2 : 0.4}
            />
          ))}

          {/* Center Course Node */}
          <g className="core" style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r="48" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" filter="drop-shadow(0px 4px 8px rgba(0,0,0,0.25))" />
            <text x={cx} y={cy - 6} textAnchor="middle" fill="#38bdf8" style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {data.course.elective_slot || 'Elective'}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="#ffffff" style={{ fontSize: '10px', fontWeight: 700 }}>
              {data.course.title.length > 18 ? data.course.title.slice(0, 16) + '..' : data.course.title}
            </text>
            <title>{data.course.title}</title>
          </g>

          {/* Render Nodes */}
          {a.map((n) => renderNode(n, '#0284c7', 'Directly Taught in Curriculum'))}
          {b.map((n) => renderNode(n, '#10b981', 'Applied in Senior Projects', { r: 11 + Math.min(n.projects || 1, 4) }))}
          {c.map((n) => renderNode(n, '#8b5cf6', 'Graph-Related Industry Competency', { r: 10 }))}
        </svg>
      </div>

      <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#0284c7' }} />
            Taught in Course (Inner Ring)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
            Used in Capstone Projects (Middle Ring)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }} />
            Industry Domain Clusters (Outer Ring)
          </span>
        </div>
        <span className="muted">Hover on nodes to highlight connections</span>
      </div>

      {clusters.length > 0 && (
        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Active Skill Clusters:</span>
          {clusters.map((cl) => (
            <span key={cl} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
              {cl}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
