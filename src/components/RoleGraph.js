'use client';
import { useState, useMemo } from 'react';

// Concentric hierarchical role graph:
// Centre: Target Career Role
// Ring 1 (radius 180): Required Industry Skills
// Ring 2 (radius 325): University Electives (Slots I-IV grouped cleanly into arcs)
// Ring 3 (radius 430): Foundational Core Prerequisites
export default function RoleGraph({ graph, roleTitle }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [slotFilter, setSlotFilter] = useState('all');

  const W = 1240;
  const H = 980;
  const cx = W / 2;
  const cy = H / 2;

  // Compute positioned nodes
  const { positioned, roleNode, skillNodes, courseNodes, prereqNodes } = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return { positioned: new Map(), roleNode: null, skillNodes: [], courseNodes: [], prereqNodes: [] };
    }

    const pos = new Map();
    const rNode = graph.nodes.find((n) => n.type === 'role');
    const sNodes = graph.nodes.filter((n) => n.type === 'skill');
    const cNodes = graph.nodes.filter((n) => n.type === 'course');
    const pNodes = graph.nodes.filter((n) => n.type === 'prereq');

    // 1. Role at center
    if (rNode) {
      pos.set(rNode.id, { ...rNode, x: cx, y: cy });
    }

    // 2. Skills on Ring 1 (r = 205) - spacious ring
    const r1 = 205;
    sNodes.forEach((s, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(sNodes.length, 1) - Math.PI / 2;
      pos.set(s.id, {
        ...s,
        x: cx + r1 * Math.cos(angle),
        y: cy + r1 * Math.sin(angle),
      });
    });

    // 3. Courses on Ring 2 (r = 365) - Group by Slot into 4 balanced quadrant arcs
    const r2 = 365;
    const slotBuckets = {
      'Elective I': [],
      'Elective II': [],
      'Elective III': [],
      'Elective IV': [],
      'Other': []
    };

    cNodes.forEach(c => {
      if (slotBuckets[c.slot]) slotBuckets[c.slot].push(c);
      else slotBuckets['Other'].push(c);
    });

    // Arc definitions (startAngle, endAngle in radians)
    const slotArcs = {
      'Elective I': [-Math.PI * 0.85, -Math.PI * 0.4],
      'Elective II': [-Math.PI * 0.35, Math.PI * 0.15],
      'Elective III': [Math.PI * 0.25, Math.PI * 0.75],
      'Elective IV': [Math.PI * 0.85, Math.PI * 1.35],
    };

    Object.entries(slotBuckets).forEach(([slot, items]) => {
      if (items.length === 0) return;
      const arc = slotArcs[slot] || [-Math.PI / 2, (3 * Math.PI) / 2];
      const start = arc[0];
      const span = arc[1] - arc[0];

      items.forEach((c, idx) => {
        const angle = items.length === 1 ? start + span / 2 : start + (span * idx) / (items.length - 1);
        pos.set(c.id, {
          ...c,
          x: cx + r2 * Math.cos(angle),
          y: cy + r2 * Math.sin(angle),
        });
      });
    });

    // 4. Prerequisites on Ring 3 (r = 475)
    const r3 = 475;
    pNodes.forEach((p, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(pNodes.length, 1) - Math.PI / 2;
      pos.set(p.id, {
        ...p,
        x: cx + r3 * Math.cos(angle),
        y: cy + r3 * Math.sin(angle),
      });
    });

    return { positioned: pos, roleNode: rNode, skillNodes: sNodes, courseNodes: cNodes, prereqNodes: pNodes };
  }, [graph, cx, cy]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return <div className="card muted">No graph data available for this role.</div>;
  }

  // Active highlights
  const activeId = hovered || selected;
  const connectedNodeIds = new Set();
  const activeLinks = [];

  if (activeId) {
    connectedNodeIds.add(activeId);
    for (const l of graph.links) {
      if (l.source === activeId) {
        connectedNodeIds.add(l.target);
        activeLinks.push(l);
      } else if (l.target === activeId) {
        connectedNodeIds.add(l.source);
        activeLinks.push(l);
      }
    }
  }

  const isDimmed = (n) => {
    if (slotFilter !== 'all') {
      if (n.type === 'course' && n.slot !== slotFilter) return true;
    }
    if (activeId) {
      return !connectedNodeIds.has(n.id);
    }
    return false;
  };

  const isLinkActive = (l) => {
    if (slotFilter !== 'all') {
      const src = positioned.get(l.source);
      const tgt = positioned.get(l.target);
      if (src?.type === 'course' && src.slot !== slotFilter) return false;
      if (tgt?.type === 'course' && tgt.slot !== slotFilter) return false;
    }
    if (!activeId) return true;
    return connectedNodeIds.has(l.source) && connectedNodeIds.has(l.target);
  };

  const getSlotColor = (slot) => {
    if (slot === 'Elective I') return '#0284c7';
    if (slot === 'Elective II') return '#059669';
    if (slot === 'Elective III') return '#7c3aed';
    if (slot === 'Elective IV') return '#db2777';
    return '#475569';
  };

  // Inspect currently hovered or selected node
  const activeNode = activeId ? positioned.get(activeId) : null;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Header Controls & Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginRight: '0.3rem' }}>
            Focus View:
          </span>
          {['all', 'Elective I', 'Elective II', 'Elective III', 'Elective IV'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlotFilter(s)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
                fontSize: '0.78rem',
                fontWeight: slotFilter === s ? 700 : 500,
                background: slotFilter === s ? (s === 'all' ? '#0f172a' : getSlotColor(s)) : '#ffffff',
                color: slotFilter === s ? '#ffffff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {s === 'all' ? 'Entire Graph' : s}
            </button>
          ))}
        </div>

        {activeId && (
          <button
            type="button"
            className="link-btn small"
            onClick={() => { setHovered(null); setSelected(null); }}
            style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: 600 }}
          >
            Clear Active Highlight &times;
          </button>
        )}
      </div>

      {/* SVG Interactive Canvas */}
      <div style={{ background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', maxHeight: '840px', display: 'block' }}
          aria-label={`Spacious Role Graph for ${roleTitle}`}
        >
          {/* Concentric Guide Rings */}
          <circle cx={cx} cy={cy} r="205" fill="none" stroke="#e2e8f0" strokeDasharray="4 4" />
          <circle cx={cx} cy={cy} r="365" fill="none" stroke="#e2e8f0" strokeDasharray="4 4" />
          <circle cx={cx} cy={cy} r="475" fill="none" stroke="#e2e8f0" strokeDasharray="4 4" />

          {/* Ring Labels */}
          <text x={cx} y={cy - 213} textAnchor="middle" fill="#94a3b8" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: 0.5 }}>
            RING 1: REQUIRED INDUSTRY SKILLS
          </text>
          <text x={cx} y={cy - 373} textAnchor="middle" fill="#94a3b8" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: 0.5 }}>
            RING 2: UNIVERSITY ELECTIVES (SLOTS I–IV)
          </text>
          <text x={cx} y={cy - 483} textAnchor="middle" fill="#94a3b8" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: 0.5 }}>
            RING 3: FOUNDATIONAL PREREQUISITES
          </text>

          {/* Links */}
          <g className="links">
            {graph.links.map((l, i) => {
              const src = positioned.get(l.source);
              const tgt = positioned.get(l.target);
              if (!src || !tgt) return null;

              const active = isLinkActive(l);
              const opacity = activeId ? (active ? 0.95 : 0.05) : (slotFilter !== 'all' ? (active ? 0.8 : 0.08) : 0.38);

              let stroke = '#94a3b8';
              let dash = 'none';
              let width = 1.3;

              if (l.type === 'REQUIRES') {
                stroke = '#0284c7';
                width = Math.max(1.3, (l.weight || 3) * 0.7);
              } else if (l.type === 'TEACHES') {
                stroke = '#10b981';
                dash = '4 3';
                width = 1.8;
              } else if (l.type === 'PREREQUISITE_OF') {
                stroke = '#f59e0b';
                dash = '2 3';
                width = 1.4;
              }

              return (
                <line
                  key={`link-${i}`}
                  x1={src.x}
                  y1={src.y}
                  x2={tgt.x}
                  y2={tgt.y}
                  stroke={stroke}
                  strokeWidth={active && activeId ? width + 1.4 : width}
                  strokeDasharray={dash}
                  opacity={opacity}
                  style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {Array.from(positioned.values()).map((n) => {
              const dimmed = isDimmed(n);
              const isSelected = activeId === n.id;
              const opacity = dimmed ? 0.15 : 1;

              // Centre: Role Node
              if (n.type === 'role') {
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    opacity={opacity}
                    onClick={() => setSelected(isSelected ? null : n.id)}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <circle r="46" fill="#0f172a" stroke="#38bdf8" strokeWidth={isSelected ? 4 : 2.5} filter="drop-shadow(0px 6px 12px rgba(0,0,0,0.3))" />
                    <text textAnchor="middle" dy="-0.4em" fill="#38bdf8" style={{ fontSize: '8.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Target Career Role
                    </text>
                    <text textAnchor="middle" dy="0.9em" fill="#ffffff" style={{ fontSize: '10.5px', fontWeight: 800 }}>
                      {n.label.length > 18 ? n.label.slice(0, 16) + '..' : n.label}
                    </text>
                    <title>{`Career Role: ${n.label}`}</title>
                  </g>
                );
              }

              // Ring 1: Skill Nodes
              if (n.type === 'skill') {
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    opacity={opacity}
                    onClick={() => setSelected(isSelected ? null : n.id)}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <circle
                      r={n.r || 18}
                      fill="#e0f2fe"
                      stroke="#0284c7"
                      strokeWidth={isSelected ? 3.5 : 1.8}
                      filter="drop-shadow(0px 2px 4px rgba(2,132,199,0.15))"
                    />
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fill="#0369a1"
                      style={{ fontSize: '9px', fontWeight: 700, pointerEvents: 'none' }}
                    >
                      {n.label.length > 14 ? n.label.slice(0, 12) + '..' : n.label}
                    </text>
                    <title>{`${n.label} (Required Skill, Category: ${n.category || 'Core'}, Importance: ${n.importance}/5)`}</title>
                  </g>
                );
              }

              // Ring 2: Elective Course Nodes
              if (n.type === 'course') {
                const color = getSlotColor(n.slot);
                const rectW = 120;
                const rectH = 32;

                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    opacity={opacity}
                    onClick={() => setSelected(isSelected ? null : n.id)}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <rect
                      x={-rectW / 2}
                      y={-rectH / 2}
                      width={rectW}
                      height={rectH}
                      rx={8}
                      fill={color}
                      stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                      strokeWidth={isSelected ? 3 : 1}
                      filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.18))"
                    />
                    <text
                      textAnchor="middle"
                      dy="-0.2em"
                      fill="#ffffff"
                      style={{ fontSize: '7.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, pointerEvents: 'none', opacity: 0.9 }}
                    >
                      {n.slot}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="1.1em"
                      fill="#ffffff"
                      style={{ fontSize: '9px', fontWeight: 700, pointerEvents: 'none' }}
                    >
                      {n.label.length > 19 ? n.label.slice(0, 17) + '..' : n.label}
                    </text>
                    <title>{`${n.title || n.label}\nSlot: ${n.slot || 'Elective'} | Vertical: ${n.vertical || 'Cross-Track'}\nScore: ${n.score || 0}`}</title>
                  </g>
                );
              }

              // Ring 3: Prerequisite Nodes
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  opacity={opacity}
                  onClick={() => setSelected(isSelected ? null : n.id)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle
                    r={n.r || 15}
                    fill="#f8fafc"
                    stroke="#64748b"
                    strokeWidth={isSelected ? 3 : 1.5}
                    filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.08))"
                  />
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fill="#334155"
                    style={{ fontSize: '8px', fontWeight: 700, pointerEvents: 'none' }}
                  >
                    {n.label.replace(' (core)', '').length > 14 ? n.label.replace(' (core)', '').slice(0, 12) + '..' : n.label.replace(' (core)', '')}
                  </text>
                  <title>{`Foundational Prerequisite: ${n.label}`}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Floating Detailed Node Inspector Card */}
      <div
        className="card"
        style={{
          marginTop: '1rem',
          padding: '1.15rem 1.35rem',
          background: activeNode ? '#f0f9ff' : '#f8fafc',
          border: activeNode ? '1px solid #bae6fd' : '1px solid #e2e8f0',
          borderRadius: 10,
          transition: 'all 0.2s ease',
        }}
      >
        {activeNode ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 4,
                    background: activeNode.type === 'course' ? getSlotColor(activeNode.slot) : activeNode.type === 'skill' ? '#0284c7' : activeNode.type === 'role' ? '#0f172a' : '#64748b',
                    color: '#ffffff',
                  }}
                >
                  {activeNode.type === 'course' ? activeNode.slot : activeNode.type.toUpperCase()}
                </span>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  {activeNode.title || activeNode.label}
                </h4>
              </div>
              <p className="muted" style={{ margin: 0, fontSize: '0.86rem' }}>
                {activeNode.type === 'course' && `Vertical Track: ${activeNode.vertical || 'Cross-Track'} · Skill Match Score: ${activeNode.score || 0} pts`}
                {activeNode.type === 'skill' && `Category: ${activeNode.category || 'Technical'} · Role Importance Weight: ${activeNode.importance || 5} / 5`}
                {activeNode.type === 'prereq' && 'Core curriculum foundational subject required before taking advanced engineering electives.'}
                {activeNode.type === 'role' && `Target industry destination with verified curriculum coverage.`}
              </p>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: 600 }}>
              {connectedNodeIds.size - 1} connected curriculum nodes highlighted
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem', color: '#64748b' }}>
            <span>💡 <b>Interactive Graph Navigation:</b> Hover or click any node to trace prerequisite paths, taught skills, and elective trajectories.</span>
            <span>Radial Hierarchy: Role (Centre) &rarr; Skills (Ring 1) &rarr; Electives (Ring 2) &rarr; Prerequisites (Ring 3)</span>
          </div>
        )}
      </div>
    </div>
  );
}
