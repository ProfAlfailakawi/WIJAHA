// Tools: Protocol LIVE, voice, photo check, org protocol, learning path + certificate.
// Usage: BASE=https://wijaha.web.app node scripts/e2e/ttest.cjs   (certificate steps need the real API; set NOAPI=1 for a Vite-only run)
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { zipSync, strToU8 } = require('fflate');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:5199';
const NOAPI = !!process.env.NOAPI;
const out = [];
const log = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ttest-'));
const png = (buf) => buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'ar', acceptDownloads: true });
  const p = await ctx.newPage();
  p.setDefaultTimeout(Number(process.env.PW_TIMEOUT || 30000));
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  p.on('console', (m) => m.type() === 'error' && !/api\/|favicon|Failed to load resource/.test(m.text()) && errs.push(m.text().slice(0, 160)));
  const axe = async (name) => {
    const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    log(`${name} axe serious/critical`, bad.length === 0, bad.map((v) => v.id + ':' + v.nodes.length).join(','));
  };
  const overflow = async (name) => log(`${name}: no horizontal overflow`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  // ------------------------------------------------------------- hub
  await p.goto(BASE + '/tools', { waitUntil: 'networkidle' });
  log('hub lists the tools', (await p.locator('[data-testid^="tool-"]').count()) >= 8);
  await axe('hub');

  // ------------------------------------------------------------- live
  await p.goto(BASE + '/live', { waitUntil: 'networkidle' });
  const cd1 = await p.locator('[data-testid="live-countdown"]').textContent();
  log('live shows a countdown before the start', /\d{2}:\d{2}/.test(cd1 || ''), cd1);
  await p.waitForTimeout(2200);
  const cd2 = await p.locator('[data-testid="live-countdown"]').textContent();
  log('the countdown ticks', cd1 !== cd2, `${cd1} -> ${cd2}`);
  const first = await p.locator('#sheet-h ~ ol li span.tabular-nums').first().textContent();
  await p.click('[data-testid="live-delay-10"]');
  const later = await p.locator('#sheet-h ~ ol li span.tabular-nums').nth(5).textContent();
  log('delay shows the accumulated minutes', /10/.test(await p.locator('[data-testid="live-delay"]').textContent()));
  await p.click('[data-testid="em-vip-late"]');
  log('emergency dialog shows numbered steps', (await p.locator('[role="dialog"] ol li').count()) >= 3);
  const before = await p.locator('#sheet-h ~ ol li span.tabular-nums').nth(8).textContent();
  await p.click('[data-testid="em-apply-delay"]');
  const after = await p.locator('#sheet-h ~ ol li span.tabular-nums').nth(8).textContent();
  log('the emergency can push the schedule', before !== after, `${before} -> ${after}`);
  // start in the past: current step is shown
  const past = new Date(Date.now() - 5 * 60_000);
  const pad = (n) => String(n).padStart(2, '0');
  await p.fill('[data-testid="live-start"]', `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}T${pad(past.getHours())}:${pad(past.getMinutes())}`);
  log('a running step is displayed', (await p.locator('[data-testid="live-current"]').count()) === 1, await p.locator('[data-testid="live-current"]').textContent().catch(() => ''));
  await axe('live');
  await overflow('live');

  // ------------------------------------------------------------- voice
  await p.goto(BASE + '/voice', { waitUntil: 'networkidle' });
  await p.click('[data-testid="persona-sheikh"]');
  await p.fill('[data-testid="voice-answer"]', 'نعتذر منك طال عمرك، وسوف نرتب لك مقعداً في الصف الأول فوراً');
  await p.click('[data-testid="voice-send"]');
  const t1 = await p.locator('[data-testid="voice-log"]').textContent();
  log('a good answer scores high', /100|9\d|8\d/.test(t1.match(/التقييم\s*:?\s*(\d+)/)?.[1] || ''), t1.match(/التقييم\s*:?\s*(\d+)/)?.[0]);
  await p.fill('[data-testid="voice-answer"]', 'مو ذنبي ومستحيل نغير شي');
  await p.click('[data-testid="voice-send"]');
  const rep = await p.locator('[data-testid="voice-report"]').textContent();
  log('the report lists notes after the last turn', /النتيجة النهائية/.test(rep) && /لا تُلقِ اللوم|تجنّب الرفض/.test(rep));
  await axe('voice');
  await overflow('voice');

  // ------------------------------------------------------------- photo
  await p.goto(BASE + '/photo-check', { waitUntil: 'networkidle' });
  const img = path.join(tmp, 'hall.png');
  const canvasPng = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#88a'; g.fillRect(0, 0, 600, 400); return c.toDataURL('image/png').split(',')[1]; });
  fs.writeFileSync(img, Buffer.from(canvasPng, 'base64'));
  await p.setInputFiles('[data-testid="photo-file"]', img);
  await p.waitForSelector('[data-testid="photo-stage"] img');
  log('the photo is shown', true);
  await p.click('[data-testid="mark-h1-bad"]');
  await p.click('[data-testid="photo-stage"]', { position: { x: 200, y: 100 } });
  log('a pin is placed on the photo', (await p.locator('[data-testid="photo-stage"] span').count()) === 1);
  await p.click('[data-testid="mark-h2-ok"]');
  log('score reflects the marks', (await p.locator('[data-testid="photo-score"]').textContent()) === '50%');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid="photo-export"]')]);
  const f = path.join(tmp, 'review.png');
  await dl.saveAs(f);
  log('annotated PNG downloads', png(fs.readFileSync(f)), `${fs.statSync(f).size} bytes`);
  await p.setInputFiles('[data-testid="photo-file"]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('no') });
  log('a non-image is rejected', (await p.locator('[role="alert"]').count()) >= 1);
  await axe('photo');
  await overflow('photo');

  // ------------------------------------------------------------- org manual
  await p.goto(BASE + '/org-protocol', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  const docx = Buffer.from(zipSync({ 'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>الهدايا</w:t></w:r></w:p><w:p><w:r><w:t>لا تقبل الجهة هدايا تتجاوز قيمتها مئة دينار وتسجل في السجل.</w:t></w:r></w:p><w:p><w:r><w:t>الزي</w:t></w:r></w:p><w:p><w:r><w:t>الزي الرسمي إلزامي في الفعاليات الخارجية.</w:t></w:r></w:p></w:body></w:document>') }));
  await p.setInputFiles('[data-testid="org-file"]', { name: 'manual.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx });
  await p.waitForFunction(() => /[1-9]\d* فقرة/.test(document.querySelector('[data-testid="org-count"]')?.textContent || ''));
  log('a .docx manual is read', true, await p.locator('[data-testid="org-count"]').textContent());
  await p.fill('[data-testid="org-q"]', 'ما سياسة الهدايا وقيمتها؟');
  await p.click('[data-testid="org-ask"]');
  const h = await p.locator('[data-testid="org-hits"]').textContent();
  log('the answer quotes the right passage', /مئة دينار/.test(h) && !/الزي الرسمي/.test(h));
  await p.reload({ waitUntil: 'networkidle' });
  log('the manual is remembered locally', /[1-9]\d* فقرة/.test(await p.locator('[data-testid="org-count"]').textContent()));
  await p.fill('[data-testid="org-q"]', 'طيران المروحيات');
  await p.click('[data-testid="org-ask"]');
  log('no match is reported honestly', (await p.locator('[data-testid="org-none"]').count()) === 1);
  await axe('org-protocol');
  await p.click('[data-testid="org-clear"]');
  log('the manual can be deleted', (await p.evaluate(() => localStorage.getItem('wijaha.orgmanual.v1'))) === null);
  await overflow('org-protocol');

  // ------------------------------------------------------------- learn + certificate
  await p.goto(BASE + '/learn', { waitUntil: 'networkidle' });
  log('six modules are shown', (await p.locator('[data-testid^="module-"]').count()) === 6);
  await axe('learn');
  await overflow('learn');
  if (!NOAPI) {
    await p.fill('[data-testid="exam-name"]', 'مختبر آلي');
    // wrong first: pick option 3 for everything
    for (let i = 1; i <= 15; i++) await p.check(`[data-testid="ans-q${i}-3"]`);
    await p.click('[data-testid="exam-submit"]');
    await p.waitForSelector('[data-testid="exam-result"]');
    const failTxt = await p.locator('[data-testid="exam-result"]').textContent();
    log('a failing exam gets no certificate and shows modules to review', !(await p.locator('[data-testid="cert-download"]').count()) && /راجع/.test(failTxt));
    log('wrong answers are not revealed', !/الإجابة الصحيحة/.test(failTxt));
    await p.click('[data-testid="exam-result"] button');
    await p.fill('[data-testid="exam-name"]', 'مختبر آلي');
    const key = { q1: 1, q2: 0, q3: 1, q4: 1, q5: 0, q6: 1, q7: 1, q8: 1, q9: 0, q10: 1, q11: 1, q12: 1, q13: 1, q14: 1, q15: 1 };
    for (const [q, i] of Object.entries(key)) await p.check(`[data-testid="ans-${q}-${i}"]`);
    await p.click('[data-testid="exam-submit"]');
    await p.waitForSelector('[data-testid="cert-download"]');
    log('a passing exam yields a certificate', /مختبر آلي/.test(await p.locator('svg[aria-label*="شهادة"]').getAttribute('aria-label')));
    const [d2] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid="cert-download"]')]);
    const cf = path.join(tmp, 'cert.png');
    await d2.saveAs(cf);
    log('certificate PNG downloads', png(fs.readFileSync(cf)), `${fs.statSync(cf).size} bytes`);
    const href = await p.locator('[data-testid="cert-verify-link"]').getAttribute('href');
    await p.goto(BASE + href, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid="verify-valid"]');
    log('the verification page confirms it', /مختبر آلي/.test(await p.locator('[data-testid="verify-valid"]').textContent()));
    await axe('verify');
    await p.goto(BASE + href.slice(0, -3) + 'AAA', { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid="verify-invalid"]');
    log('a tampered code is rejected', true);
    const lone = await p.evaluate(async () => (await fetch('/api/certificate/exam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: { q1: 1 } }) })).json());
    log('a partial exam does not pass and returns no code', lone.passed === false && !lone.code);
  }

  // ------------------------------------------------------------- event file
  await p.goto(BASE + '/event', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.removeItem('wijaha.event.v1'));
  await p.reload({ waitUntil: 'networkidle' });
  const readyTxt = async () => (await p.locator('#ready-h').textContent()) || '';
  log('an empty event file is mostly not ready', /1 من 8/.test(await readyTxt()), await readyTxt());
  await p.fill('[data-testid="ev-name"]', 'حفل استقبال وفد');
  await p.fill('[data-testid="ev-venue"]', 'فندق الجزيرة');
  await p.fill('[data-testid="ev-hostTitle"]', 'سعادة');
  await p.fill('[data-testid="ev-hostName"]', 'المضيف الاختباري');
  await p.fill('[data-testid="ev-dress"]', 'الزي الرسمي');
  await p.fill('[data-testid="ev-rsvp"]', 'rsvp@example.org');
  await p.fill('[data-testid="ev-start"]', '2031-03-10T19:30');
  const inv = await p.locator('[data-testid="ev-invitation"]').textContent();
  log('the invitation is built from the fields', /يتشرف سعادة المضيف الاختباري/.test(inv) && /19:30/.test(inv) && /الموافق/.test(inv));
  log('readiness improves', /[67] من 8/.test(await readyTxt()), await readyTxt());
  await p.fill('[data-testid="ev-start"]', '2031-02-25T19:30');
  await p.waitForSelector('[data-testid="ev-clash"]', { timeout: 3000 }).catch(() => undefined);
  log('Kuwait National Day is flagged as a clash', (await p.locator('[data-testid="ev-clash"]').count()) === 1, (await p.locator('[data-testid="ev-clash"]').textContent().catch(() => '')) || '');
  const [d3] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid="ev-ics"]')]);
  const icsf = path.join(tmp, 'ev.ics');
  await d3.saveAs(icsf);
  const icsTxt = fs.readFileSync(icsf, 'utf8');
  log('event .ics is valid with reminders', /BEGIN:VCALENDAR/.test(icsTxt) && /DTSTART:20310225T193000/.test(icsTxt) && (icsTxt.match(/VALARM/g) || []).length === 4);
  await p.reload({ waitUntil: 'networkidle' });
  log('the event is remembered locally', (await p.inputValue('[data-testid="ev-name"]')) === 'حفل استقبال وفد');
  await p.click('[data-testid="ev-live"]');
  await p.waitForURL(/\/live\?t=/);
  log('the live page opens with the event start', (await p.inputValue('[data-testid="live-start"]')) === '2031-02-25T19:30');
  await p.click('[data-testid="live-delay-10"]');
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await p.click('[data-testid="live-share"]');
  const link = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  log('the team link carries the delayed start', /\/live\?t=official-reception&s=2031-02-25T19%3A40/.test(link), link);
  await axe('live (with params)');
  await p.goto(BASE + '/event', { waitUntil: 'networkidle' });
  await axe('event');
  await overflow('event');
  await p.goto(BASE + '/review', { waitUntil: 'networkidle' });
  const rv = await p.locator('[data-testid="review-list"]').textContent();
  log('the review page is honest about drafts', /مسودة/.test(rv) && /معتمد/.test(rv) && /لم تراجعها جهة خارجية/.test(rv));
  await axe('review');

  // ------------------------------------------------------------- PWA
  if (!/127\.0\.0\.1|localhost/.test(BASE)) {
    const man = await p.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
    log('web app manifest is valid', man.display === 'standalone' && man.icons.length >= 2, man.name);
    for (const ic of ['/icon-192.png', '/icon-512.png']) {
      const ct = await p.evaluate(async (u) => (await fetch(u)).headers.get('content-type'), ic);
      log(`${ic} is served as an image`, /image\/png/.test(ct || ''), ct);
    }
    await p.goto(BASE + '/live', { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await navigator.serviceWorker.ready; });
    await p.reload({ waitUntil: 'networkidle' });
    await p.goto(BASE + '/learn', { waitUntil: 'networkidle' });
    await p.goto(BASE + '/live', { waitUntil: 'networkidle' });
    log('a service worker controls the page', await p.evaluate(() => !!navigator.serviceWorker.controller));
    await ctx.setOffline(true);
    await p.goto(BASE + '/learn', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await p.waitForSelector('[data-testid^="module-"]', { timeout: 8000 }).catch(() => undefined);
    log('a visited tool opens offline', (await p.locator('[data-testid^="module-"]').count()) === 6);
    await p.goto(BASE + '/live', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await p.waitForSelector('[data-testid="live-status"]', { timeout: 8000 }).catch(() => undefined);
    log('the live run sheet works offline', (await p.locator('[data-testid="live-status"]').count()) === 1);
    await ctx.setOffline(false);
  }

  // ------------------------------------------------------------- 3D (WebGL)
  {
    // Is a canvas drawn (not a flat colour)? Sample its pixels through a 2D copy.
    const painted = (sel) => p.evaluate(async (s) => {
      const c = document.querySelector(s);
      if (!c) return -1;
      const tmp = document.createElement('canvas'); tmp.width = 64; tmp.height = 40;
      const g = tmp.getContext('2d');
      // WebGL canvases cannot be read back reliably between frames, so draw it right after a frame.
      await new Promise((r) => requestAnimationFrame(() => r()));
      g.drawImage(c, 0, 0, 64, 40);
      const d = g.getImageData(0, 0, 64, 40).data;
      const set = new Set();
      for (let i = 0; i < d.length; i += 4) set.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
      return set.size;
    }, sel);
    await p.goto(BASE + '/seating', { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.clear());
    await p.reload({ waitUntil: 'networkidle' });
    await p.click('[data-testid="view-3d"]');
    await p.waitForSelector('[data-testid="hall3d"][data-ready="true"]', { timeout: 90000 });
    await p.waitForTimeout(800);
    const colours = await painted('[data-testid="hall3d-canvas"]');
    log('the 3D hall renders a real scene', colours > 12, `${colours} distinct colours`);
    for (const k of ['chief', 'host', 'door', 'overview']) {
      await p.click(`[data-testid="cam-${k}"]`);
      await p.waitForTimeout(1300);
    }
    log('all four camera views switch without errors', (await p.locator('[data-testid="hall3d-canvas"]').count()) === 1);
    const [d4] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid="hall-png"]')]);
    const hf = path.join(tmp, 'hall.png');
    await d4.saveAs(hf);
    log('3D hall PNG snapshot downloads', png(fs.readFileSync(hf)) && fs.statSync(hf).size > 8000, `${fs.statSync(hf).size} bytes`);
    await p.click('[data-testid="view-2d"]');
    log('back to the 2D plan keeps the studio working', (await p.locator('ol[aria-label="ترتيب الجلوس"] li').count()) > 3);
    await axe('seating 3D view');
    await p.click('[data-testid="view-3d"]');
    await p.waitForSelector('[data-testid="hall3d"][data-ready="true"]', { timeout: 90000 });
    await overflow('seating 3D view');

    await p.goto(BASE + '/posture', { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid="posture"][data-ready="true"]', { timeout: 90000 });
    await p.waitForTimeout(700);
    log('the posture figure renders', (await painted('[data-testid="posture-canvas"]')) > 8);
    const before = await p.locator('[data-testid="pose-info"]').textContent();
    await p.click('[data-testid="pose-majlisAvoid"]');
    const after = await p.locator('[data-testid="pose-info"]').textContent();
    log('choosing a pose updates the guidance', before !== after && /يُتجنَّب/.test(after), after.slice(0, 40));
    await p.click('[data-testid="pose-next"]');
    log('next pose wraps around the list', /وقفة|Reception/.test(await p.locator('[data-testid="pose-info"] h2').textContent()));
    const [d5] = await Promise.all([p.waitForEvent('download'), p.click('[data-testid="pose-png"]')]);
    const pf = path.join(tmp, 'pose.png');
    await d5.saveAs(pf);
    log('posture PNG snapshot downloads', png(fs.readFileSync(pf)), `${fs.statSync(pf).size} bytes`);
    await axe('posture');
    await overflow('posture');
  }

  // ------------------------------------------------------------- English + mobile
  for (const [route, re] of [['/live', /Protocol LIVE|event-day/i], ['/learn', /Learn|certificate/i], ['/voice', /Practise|Voice/i], ['/photo-check', /hall|invitation/i], ['/org-protocol', /manual/i]]) {
    await p.goto(BASE + route, { waitUntil: 'networkidle' });
    await p.getByRole('button', { name: /^EN$|English/i }).first().click({ timeout: 1500 }).catch(() => undefined);
    await p.waitForTimeout(250);
    log(`[en] ${route} renders English`, re.test(await p.locator('h1').first().textContent()));
  }
  await ctx.close();
  const m = await b.newContext({ viewport: { width: 375, height: 800 }, locale: 'ar' });
  const mp = await m.newPage();
  for (const r of ['/tools', '/posture', '/live', '/voice', '/photo-check', '/org-protocol', '/learn']) {
    await mp.goto(BASE + r, { waitUntil: 'networkidle' });
    log(`[mobile] ${r} has no horizontal overflow`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  }
  log('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const pass = out.filter(Boolean).length;
  console.log(`\nSUMMARY: ${pass}/${out.length} passed`);
  process.exit(pass === out.length ? 0 : 1);
})().catch((e) => { console.error('crashed', e); process.exit(2); });
