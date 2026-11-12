/**
 * scripts/generate-diagrams.mjs
 * Renders docs/er-diagram.png from ER_DIAGRAM.md and generates docs/architecture.png
 * using Headless Chrome and Mermaid.js.
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DOCS_DIR = 'C:\\Users\\Harsha_R\\Downloads\\electiq\\docs';
const PORT = 9223;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Could not connect to Chrome debugging port.');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}, sessionId = undefined) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }
}

async function run() {
  console.log('Reading ER diagram definition from docs/ER_DIAGRAM.md...');
  const erMd = readFileSync(join(DOCS_DIR, 'ER_DIAGRAM.md'), 'utf-8');
  const mermaidMatch = erMd.match(/```mermaid\s*([\s\S]*?)```/);
  if (!mermaidMatch) throw new Error('No mermaid block found in docs/ER_DIAGRAM.md');
  const erDiagramCode = mermaidMatch[1].trim();

  // Architecture Diagram Mermaid
  const architectureDiagramCode = `
flowchart TD
    subgraph Client["Client Tier (Web Browser)"]
        UI["React 18 UI (Vanilla CSS tokens, Theme Vars)"]
        State["Client State & Forms"]
        CookieStorage["HttpOnly Cookie: electiq_session (SameSite=Lax, Secure)"]
    end

    subgraph Server["Application Tier (Next.js 14 App Router)"]
        Middleware["Next.js Middleware (Route Guards, Security Headers)"]
        CSRF["CSRF & Origin Verification (Sec-Fetch-Site, Host matching)"]
        AuthHandler["Auth & Session Verification (jose HS256 JWT)"]
        RouteHandlers["Route Handlers (/api/*)<br/>handler(['role'], fn)"]
        PoolManager["Connection Pool Manager (withUser / asLogin)"]
    end

    subgraph RelationalDB["Relational Tier (PostgreSQL 14+)"]
        direction TB
        TxBegin["BEGIN Transaction"]
        SetRole["SET LOCAL ROLE app_student | app_senior | app_faculty | app_admin"]
        SetConfig["set_config('app.user_id', :uid, true)"]
        RLS["Row-Level Security (RLS) Engine"]
        Tables["22 Tables (Foreign Keys, Constraints, Generated tsvector)"]
        Views["Identity-Scrubbed Views (v_course_summary, v_placement_analytics, etc.)"]
        Procedures["Stored Procedures & Functions (sp_post_grade, sp_enroll_student, etc.)"]
        AuditTriggers["SECURITY DEFINER Trigger &rarr; audit_log (Tamper-Proof)"]
        TxCommit["COMMIT (Identity & Role disappear from pooled connection)"]
    end

    subgraph GraphDB["Graph Tier (Neo4j 5 Enterprise)"]
        direction TB
        NeoDriver["Neo4j Driver (Bolt localhost:7687)"]
        GraphTraversal["Multi-Hop Graph Traversals (Role &rarr; Skill &rarr; Course)"]
        PrereqChains["Prerequisite Hierarchy Traversal (:PREREQUISITE_OF*1..3)"]
        GraphOwned["Graph-Owned Data (:RELATED_TO {strength}, :IN_CLUSTER)"]
        SyncMirror["Idempotent Mirroring from PostgreSQL (syncGraph)"]
    end

    UI -->|"HTTP Request + JWT Cookie"| Middleware
    Middleware --> CSRF
    CSRF --> AuthHandler
    AuthHandler --> RouteHandlers
    RouteHandlers --> PoolManager
    RouteHandlers -->|"Cypher Traversal"| NeoDriver

    PoolManager --> TxBegin
    TxBegin --> SetRole
    SetRole --> SetConfig
    SetConfig --> RLS
    RLS --> Tables
    RLS --> Views
    Tables --> AuditTriggers
    RouteHandlers -.->|"sp_enroll_student / sp_record_placement"| Procedures
    Procedures --> Tables
    Tables --> TxCommit

    NeoDriver --> GraphTraversal
    GraphTraversal --> PrereqChains
    GraphTraversal --> GraphOwned
    PoolManager -.->|"syncGraph on Master Data Updates"| SyncMirror
    SyncMirror --> GraphTraversal

    classDef client fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef server fill:#1e1e24,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;
    classDef postgres fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#f8fafc;
    classDef neo4j fill:#18181b,stroke:#a855f7,stroke-width:2px,color:#f8fafc;

    class UI,State,CookieStorage client;
    class Middleware,CSRF,AuthHandler,RouteHandlers,PoolManager server;
    class TxBegin,SetRole,SetConfig,RLS,Tables,Views,Procedures,AuditTriggers,TxCommit postgres;
    class NeoDriver,GraphTraversal,PrereqChains,GraphOwned,SyncMirror neo4j;
  `.trim();

  // HTML template using Mermaid CDN
  const generateHtml = (code, title) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 40px;
      background: #0b0f19;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    h1 {
      margin-bottom: 24px;
      font-size: 24px;
      color: #38bdf8;
      letter-spacing: 0.5px;
    }
    #diagram {
      background: #111827;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      border: 1px solid #1f2937;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#111827',
        primaryColor: '#1e293b',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#38bdf8',
        lineColor: '#64748b',
        secondaryColor: '#1e1e24',
        tertiaryColor: '#0f172a'
      }
    });
  </script>
</head>
<body>
  <h1>${title}</h1>
  <div id="diagram" class="mermaid">
${code}
  </div>
</body>
</html>`;

  const erHtml = generateHtml(erDiagramCode, 'ElectIQ Entity-Relationship Diagram (PostgreSQL)');
  const archHtml = generateHtml(architectureDiagramCode, 'ElectIQ System Architecture Diagram');

  const tmpErPath = join(DOCS_DIR, 'er_temp.html');
  const tmpArchPath = join(DOCS_DIR, 'arch_temp.html');
  writeFileSync(tmpErPath, erHtml, 'utf-8');
  writeFileSync(tmpArchPath, archHtml, 'utf-8');

  console.log('Launching headless Chrome to render diagrams...');
  const tmpDir = `C:\\Users\\Harsha_R\\AppData\\Local\\Temp\\chrome_diag_${Date.now()}`;
  mkdirSync(tmpDir, { recursive: true });

  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${tmpDir}`,
      '--disable-gpu',
      '--hide-scrollbars',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    const cdp = new CDP(ws);

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params = {}) => cdp.send(method, params, sessionId);

    await send('Page.enable');

    // 1. Render ER Diagram
    console.log('Rendering ER diagram to docs/er-diagram.png...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1400,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await send('Page.navigate', { url: `file:///${tmpErPath.replace(/\\/g, '/')}` });
    await sleep(3500); // Wait for Mermaid to fetch from CDN and render SVG
    const erCapture = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(DOCS_DIR, 'er-diagram.png'), Buffer.from(erCapture.data, 'base64'));
    console.log('Saved docs/er-diagram.png');

    // 2. Render Architecture Diagram
    console.log('Rendering Architecture diagram to docs/architecture.png...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 1200,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await send('Page.navigate', { url: `file:///${tmpArchPath.replace(/\\/g, '/')}` });
    await sleep(3500);
    const archCapture = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(DOCS_DIR, 'architecture.png'), Buffer.from(archCapture.data, 'base64'));
    console.log('Saved docs/architecture.png');
  } finally {
    proc.kill();
  }
}

run().catch((err) => {
  console.error('Diagram rendering failed:', err);
  process.exit(1);
});
