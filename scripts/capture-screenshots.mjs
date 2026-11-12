/**
 * scripts/capture-screenshots.mjs
 * Captures clean UI screenshots for all roles and views using system Chrome and CDP.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT_DIR = 'C:\\Users\\Harsha_R\\Downloads\\electiq\\docs\\screenshots';
const PORT = 9222;

async function getSessionCookie(email, password = 'Password@123') {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error(`Could not login as ${email}`);
  const match = cookie.match(/electiq_session=([^;]+)/);
  return match ? match[1] : '';
}

mkdirSync(OUT_DIR, { recursive: true });

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
  console.log('Fetching auth tokens for demo roles...');
  const sessions = {
    guest: null,
    student: await getSessionCookie('student1@electiq.dev'),
    senior: await getSessionCookie('senior1@electiq.dev'),
    faculty: await getSessionCookie('faculty1@electiq.dev'),
    admin: await getSessionCookie('admin@electiq.dev'),
  };

  console.log('Launching headless Chrome...');
  const tmpDir = `C:\\Users\\Harsha_R\\AppData\\Local\\Temp\\chrome_ss_${Date.now()}`;
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
    await send('Network.enable');

    const capture = async (name, url, role = 'student', width = 1280, height = 800, clickTab = null) => {
      console.log(`Capturing: ${name} (${role})`);
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });

      await send('Network.clearBrowserCookies');
      if (sessions[role]) {
        await send('Network.setCookie', {
          name: 'electiq_session',
          value: sessions[role],
          domain: 'localhost',
          path: '/',
          httpOnly: true,
        });
      }

      await send('Page.navigate', { url });
      await sleep(1500);

      if (clickTab) {
        await send('Runtime.evaluate', {
          expression: `(() => {
            const btn = Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent.toLowerCase().includes('${clickTab.toLowerCase()}'));
            if (btn) btn.click();
          })()`,
        });
        await sleep(1000);
      }

      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(OUT_DIR, `${name}.png`), Buffer.from(data, 'base64'));
    };

    // 1. Student views
    await capture('01_dashboard_student', 'http://localhost:3000/', 'student');
    await capture('02_courses_list', 'http://localhost:3000/courses', 'student');
    await capture('03_course_detail_overview', 'http://localhost:3000/courses/1', 'student');
    await capture('04_course_detail_reviews', 'http://localhost:3000/courses/1', 'student', 1280, 800, 'reviews');
    await capture('05_course_detail_prep', 'http://localhost:3000/courses/1', 'student', 1280, 800, 'prep');
    await capture('06_course_detail_mindmap', 'http://localhost:3000/courses/1', 'student', 1280, 800, 'skill');
    await capture('07_course_compare', 'http://localhost:3000/compare', 'student');
    await capture('08_career_paths_neo4j', 'http://localhost:3000/career', 'student');
    await capture('09_for_you_recommendations', 'http://localhost:3000/for-you', 'student');
    await capture('10_interview_questions', 'http://localhost:3000/questions', 'student');
    await capture('11_analytics', 'http://localhost:3000/analytics', 'student');

    // 2. Senior views (Contribute tabs)
    await capture('12_contribute_review', 'http://localhost:3000/contribute', 'senior', 1280, 800, 'review');
    await capture('13_contribute_placement', 'http://localhost:3000/contribute', 'senior', 1280, 800, 'placement');
    await capture('14_contribute_question', 'http://localhost:3000/contribute', 'senior', 1280, 800, 'interview');
    await capture('15_contribute_activity', 'http://localhost:3000/contribute', 'senior', 1280, 800, 'preparation');
    await capture('16_contribute_project', 'http://localhost:3000/contribute', 'senior', 1280, 800, 'project');
    await capture('17_contribute_records', 'http://localhost:3000/contribute', 'senior', 1280, 800, 'records');

    // 3. Faculty view
    await capture('18_faculty_ratings', 'http://localhost:3000/faculty', 'faculty');

    // 4. Admin console (All 7 panels)
    await capture('19_admin_enrollments', 'http://localhost:3000/admin', 'admin', 1280, 800, 'enrollments');
    await capture('20_admin_courses', 'http://localhost:3000/admin', 'admin', 1280, 800, 'courses');
    await capture('21_admin_skills', 'http://localhost:3000/admin', 'admin', 1280, 800, 'skills');
    await capture('22_admin_skill_graph', 'http://localhost:3000/admin', 'admin', 1280, 800, 'graph');
    await capture('23_admin_accounts', 'http://localhost:3000/admin', 'admin', 1280, 800, 'accounts');
    await capture('24_admin_moderation', 'http://localhost:3000/admin', 'admin', 1280, 800, 'reviews');
    await capture('25_admin_audit_log', 'http://localhost:3000/admin', 'admin', 1280, 800, 'audit');

    // 5. Mobile responsive views (390px)
    await capture('26_mobile_dashboard', 'http://localhost:3000/', 'student', 390, 844);
    await capture('27_mobile_courses', 'http://localhost:3000/courses', 'student', 390, 844);
    await capture('28_mobile_career', 'http://localhost:3000/career', 'student', 390, 844);

    console.log('\n[SUCCESS] All 28 screenshots captured and saved to docs/screenshots/ !');
  } finally {
    proc.kill();
  }
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
