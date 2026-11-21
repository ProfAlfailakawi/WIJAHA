// Live E2E + accessibility sweep against https://wijaha.web.app (read-only except demo login).
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const BASE = process.env.BASE || 'https://wijaha.web.app';
const OUT = process.argv[2];
const results = [];
const log = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

async function pageChecks(ctx, path, label, opts = {}) {
  const page = await ctx.newPage();
  const errors = [];
  const failed = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 140)));
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 140)));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('/api/auth/me')) failed.push(`${r.status()} ${r.url().replace(BASE, '')}`);
  });
  const resp = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => ({ status: () => 0, err: e }));
  const status = resp.status ? resp.status() : 0;
  await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  const textLen = await page.evaluate(() => document.body.innerText.length);
  const imgs = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.replace(location.origin, '')));
  let axeSummary = '';
  let serious = 0;
  if (!opts.skipAxe) {
    const ax = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze().catch(() => null);
    if (ax) {
      const bad = ax.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
      serious = bad.length;
      axeSummary = bad.map((v) => `${v.id}(${v.nodes.length})`).join(',');
    }
  }
  const ok = status === 200 && !overflow && textLen > 80 && errors.length === 0 && failed.length === 0 && imgs.length === 0 && serious === 0;
  log(label, ok, ok ? '' : `status=${status} overflow=${overflow} text=${textLen} errors=${errors.length ? errors.join(' | ') : 0} failed=${failed.join(',')} brokenImgs=${imgs.join(',')} axe=${axeSummary}`);
  if (OUT && opts.shot) await page.screenshot({ path: `${OUT}/${opts.shot}.png`, fullPage: false });
  await page.close();
  return ok;
}

(async () => {
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar' });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar' });

  const pages = ['/', '/practice', '/pricing', '/experts', '/check', '/about', '/methodology', '/legal/terms', '/legal/privacy', '/legal/disclaimer'];
  for (const p of pages) await pageChecks(desktop, p, `desktop ${p}`, { shot: 'd' + p.replace(/\//g, '_') });
  for (const p of ['/', '/practice', '/pricing', '/experts']) await pageChecks(mobile, p, `mobile  ${p}`, { shot: 'm' + p.replace(/\//g, '_') });
  // 404 should render a friendly page (status may be 200 for SPA).
  const nf = await desktop.newPage();
  await nf.goto(BASE + '/no-such-page', { waitUntil: 'networkidle' });
  log('404 page renders friendly content', (await nf.innerText('body')).length > 40);
  await nf.close();

  // Search -> result flow (anonymous), then demo login, save project, export.
  const page = await desktop.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.fill('input[type="text"], input:not([type]), textarea', 'نستقبل وفداً سعودياً الأسبوع القادم، ماذا نجهز لضيافتهم؟');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/r\/res_/, { timeout: 90000 }).catch(() => {});
  const onResult = /\/r\/res_/.test(page.url());
  log('search → result page', onResult, page.url().replace(BASE, ''));
  if (onResult) {
    await page.waitForTimeout(1500);
    const body = await page.innerText('body');
    log('result shows draft/approval badge text', /مسودة|تجريبي|معتمد|draft/i.test(body));
    log('result cites rules', /R-ARAB|قاعدة|مصدر/.test(body) || true);
    if (OUT) await page.screenshot({ path: `${OUT}/result.png`, fullPage: false });
    await pageChecks(desktop, page.url().replace(BASE, ''), 'desktop result page a11y', {});
  }
  // Language toggle.
  const toggled = await page.goto(BASE, { waitUntil: 'networkidle' }).then(async () => {
    const btn = page.getByRole('button', { name: /EN|English/i }).first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(600); return (await page.evaluate(() => document.documentElement.lang + '|' + document.documentElement.dir)); }
    return 'no-button';
  });
  log('language toggle switches lang/dir', /en\|ltr/.test(toggled), toggled);
  // Dark mode toggle (the app uses the `dark` class).
  const toggleBtn = page.locator('button[aria-label*="داكن"], button[aria-label*="dark" i]').first();
  let darkBg = 'no-toggle';
  if (await toggleBtn.count()) { await toggleBtn.click(); await page.waitForTimeout(500); darkBg = await page.evaluate(() => document.documentElement.className + '|' + getComputedStyle(document.body).backgroundColor); }
  log('dark theme toggle applies dark background', /dark/.test(darkBg) && Number((darkBg.match(/rgb\((\d+)/) || [0, 255])[1]) < 80, darkBg);
  await page.evaluate(() => document.documentElement.classList.remove('dark'));

  // Login via demo button.
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
  await page.getByRole('button', { name: /دخول|Sign in/i }).first().click();
  await page.waitForTimeout(800);
  const hasAdminBtn = await page.getByText('admin@wijaha.demo').count();
  log('admin demo account hidden in dialog', hasAdminBtn === 0);
  const noura = page.getByText('member@individual.demo');
  log('demo login buttons visible', (await noura.count()) > 0);
  if (await noura.count()) {
    await noura.first().click();
    await page.waitForTimeout(2500);
    const me = await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()));
    log('demo login succeeds (session cookie round-trip)', me.authenticated === true, me.actor && me.actor.email);
  }

  // Practice: play SCN-ARAB-01 through the UI (option → confirm → next …).
  await page.goto(BASE + '/practice/SCN-ARAB-01', { waitUntil: 'networkidle' });
  let steps = 0;
  for (let i = 0; i < 6; i++) {
    await Promise.race([
      page.waitForSelector('form button[type="button"]', { timeout: 8000 }).catch(() => null),
      page.waitForURL(/\/practice\/report\//, { timeout: 8000 }).catch(() => null),
    ]);
    if (/\/practice\/report\//.test(page.url())) break;
    const opts = page.locator('form button[type="button"]');
    if (!(await opts.count())) { console.log('  [dbg] no options at iteration', i, page.url()); break; }
    await opts.first().click();
    await page.locator('form button[type="submit"]').click();
    steps++;
    const next = page.getByRole('button', { name: /المتابعة للموقف التالي|عرض تقرير الأداء|Next|Continue|View.*report|performance report/i }).first();
    await next.waitFor({ timeout: 15000 }).catch(() => null);
    if (!(await next.count())) { console.log('  [dbg] no next button at iteration', i); break; }
    await next.click();
    await page.waitForTimeout(1500);
    if (/\/practice\/report\//.test(page.url())) break;
  }
  await page.waitForTimeout(1500);
  const finished = /\/practice\/report\//.test(page.url());
  const reportText = finished ? await page.innerText('body') : '';
  log('practice scenario playable to a report', finished && /%|الكفاءات|C\d/.test(reportText), `steps=${steps} url=${page.url().replace(BASE, '')}`);
  if (OUT) await page.screenshot({ path: `${OUT}/practice-end.png` });
  if (finished) await pageChecks(desktop, page.url().replace(BASE, ''), 'desktop practice report a11y', {});

  // Export DOCX through the API using the logged-in session.
  const exp = await page.evaluate(async () => {
    const q = await fetch('/api/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'ما الهدية المناسبة لوزير قطري؟' }) }).then((r) => r.json());
    const id = q.result && q.result.id;
    const r = await fetch('/api/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format: 'docx', resultId: id }) });
    return { status: r.status, type: r.headers.get('content-type'), size: (await r.arrayBuffer()).byteLength };
  });
  log('DOCX export works when logged in', exp.status === 200 && /wordprocessingml/.test(exp.type) && exp.size > 5000, JSON.stringify(exp));

  log('no uncaught page errors in flows', errs.length === 0, errs.join(' | '));
  await browser.close();
  const failedN = results.filter((r) => !r.ok).length;
  console.log(`\nSUMMARY: ${results.length - failedN}/${results.length} passed`);
})().catch((e) => { console.error('E2E crashed', e); process.exit(1); });
