// Seating studio + occasions radar. Usage: BASE=http://127.0.0.1:5199 node scripts/e2e/stest.cjs
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { zipSync, strToU8 } = require('fflate');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:5199';
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'wijaha-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const out = [];
const log = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

function makeXlsx(rows) {
  const strings = [];
  const idx = (s) => { let i = strings.indexOf(s); if (i < 0) { strings.push(s); i = strings.length - 1; } return i; };
  const colL = (i) => String.fromCharCode(65 + i);
  const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => `<c r="${colL(ci)}${ri + 1}" t="s"><v>${idx(c)}</v></c>`).join('')}</row>`).join('');
  const sst = `<?xml version="1.0"?><sst>${strings.map((s) => `<si><t>${s.replace(/&/g, '&amp;')}</t></si>`).join('')}</sst>`;
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>${sheetRows}</sheetData></worksheet>`;
  return Buffer.from(zipSync({ 'xl/sharedStrings.xml': strToU8(sst), 'xl/worksheets/sheet1.xml': strToU8(sheet) }));
}
const order = (p) => p.locator('ol[aria-label="ترتيب الجلوس"] li').evaluateAll((lis) => lis.map((li) => li.querySelector('span.truncate')?.textContent.trim()));
const png = (buf) => buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'ar', acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  p.on('console', (m) => m.type() === 'error' && !/api\//.test(m.text()) && errs.push(m.text().slice(0, 160)));

  // ---------------------------------------------------------------- studio
  await p.goto(BASE + '/seating', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  let o = await order(p);
  log('sample list is sorted by precedence (minister right after the host)', o[0] === 'المضيف' && /٤/.test(o[1]) && /٣/.test(o[2]), o.slice(0, 4).join(' | '));

  // paste import
  await p.locator('textarea[aria-label="الصق قائمة الضيوف"]').fill('الاسم\tالمنصب\nضيف ص1\tمدير\nضيف ص2\tوزير\nضيف ص3\tسفير');
  await p.locator('[data-testid="import-paste"]').click();
  await p.waitForTimeout(500);
  o = await order(p);
  log('pasted Excel text imports and orders (minister, ambassador, manager)', o.length === 4 && /ص2/.test(o[1]) && /ص3/.test(o[2]) && /ص1/.test(o[3]), o.join(' | '));
  log('status message confirms the import', /3/.test(await p.locator('[data-testid="studio-status"]').innerText()));

  // real xlsx upload
  const xlsxPath = path.join(os.tmpdir(), 'guests.xlsx');
  fs.writeFileSync(xlsxPath, makeXlsx([['الاسم', 'المنصب'], ['ضيف س1', 'وكيل وزارة'], ['ضيف س2', 'مستشار'], ['ضيف س3', 'رئيس جامعة'], ['ضيف س4', 'وزير']]));
  await p.locator('[data-testid="guest-file"]').setInputFiles(xlsxPath);
  await p.waitForTimeout(700);
  o = await order(p);
  log('a real .xlsx file imports (4 guests, minister first)', o.length === 5 && /س4/.test(o[1]), o.join(' | '));

  // CSV upload with quotes
  const csvPath = path.join(os.tmpdir(), 'guests.csv');
  fs.writeFileSync(csvPath, 'Name,Title\n"Doe, A",Minister\nB,Director\nC,Ambassador\n');
  await p.locator('[data-testid="guest-file"]').setInputFiles(csvPath);
  await p.waitForTimeout(500);
  o = await order(p);
  log('CSV with a quoted comma imports', o.length === 4 && /Doe, A/.test(o[1]), o.join(' | '));

  // drag and drop swap: seat of rank 3 onto rank 4
  const seats = p.locator('svg[aria-label="مخطط الجلوس القابل للسحب"] g[role="button"]');
  const box = async (i) => { const bb = await seats.nth(i).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
  // find seats by their aria-label (rank + name)
  const idxOf = async (re) => { const labels = await seats.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label'))); return labels.findIndex((l) => re.test(l)); };
  await p.locator('svg[aria-label="مخطط الجلوس القابل للسحب"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  const iA = await idxOf(/^3 /), iB = await idxOf(/^4 /);
  const a = await box(iA), c = await box(iB);
  const before = await order(p);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + c.x) / 2, (a.y + c.y) / 2, { steps: 5 }); await p.mouse.move(c.x, c.y, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(500);
  const after = await order(p);
  log('dragging a seat onto another swaps them', after[2] === before[3] && after[3] === before[2] && before[2] !== before[3], `${before.slice(2, 4).join(',')} -> ${after.slice(2, 4).join(',')}`);
  log('the suggested-order button becomes available after a manual change', !(await p.locator('[data-testid="studio-auto"]').isDisabled()));
  log('a precedence warning appears for the inverted pair', (await p.locator('[data-testid="studio-warnings"]').count()) > 0);
  await p.locator('[data-testid="studio-warnings"] button').first().click();
  await p.waitForTimeout(300);
  log('"swap them" clears the warning', (await p.locator('[data-testid="studio-warnings"]').count()) === 0);

  // keyboard-accessible reordering
  const up = p.locator('ol[aria-label="ترتيب الجلوس"] button[aria-label^="أخّر"]').first();
  const ob = await order(p);
  await up.click(); await p.waitForTimeout(200);
  const oa = await order(p);
  log('move-later button reorders without dragging', oa[1] === ob[2] && oa[2] === ob[1]);
  await p.locator('[data-testid="studio-auto"]').click();

  // capacity warning: 20 guests into the majlis (13 max)
  const many = Array.from({ length: 20 }, (_, i) => `ضيف ${i + 1}\tمدير`).join('\n');
  await p.locator('textarea[aria-label="الصق قائمة الضيوف"]').fill(many);
  await p.locator('[data-testid="import-paste"]').click();
  await p.waitForTimeout(400);
  log('over-capacity guests are reported, not silently dropped', (await p.getByText(/لم يتّسع المخطط لـ 7/).count()) > 0);

  // exports
  const [d1] = await Promise.all([p.waitForEvent('download'), p.locator('[data-testid="studio-png"]').click()]);
  const b1 = fs.readFileSync(await d1.path());
  log('plan PNG export', png(b1) && b1.length > 8000, `${b1.readUInt32BE(16)}x${b1.readUInt32BE(20)}`);
  const [d2] = await Promise.all([p.waitForEvent('download'), p.locator('[data-testid="studio-csv"]').click()]);
  const csv = fs.readFileSync(await d2.path(), 'utf8');
  log('order CSV has a BOM, header and one row per seat', csv.charCodeAt(0) === 0xfeff && csv.split('\r\n').length === 15, `${csv.split('\r\n').length} lines`);
  const pageBtns = await p.locator('[data-testid="cards-png"]').count();
  const [d3] = await Promise.all([p.waitForEvent('download'), p.locator('[data-testid="cards-png"]').first().click()]);
  const b3 = fs.readFileSync(await d3.path());
  log('name-card page exports as an A4 PNG', png(b3) && b3.readUInt32BE(16) === 1588 && b3.readUInt32BE(20) === 2246, `${b3.readUInt32BE(16)}x${b3.readUInt32BE(20)}; pages=${pageBtns}`);
  await p.locator('#cards-h').scrollIntoViewIfNeeded();
  await p.locator('section[aria-labelledby="cards-h"]').screenshot({ path: path.join(SHOTS, 'studio-cards.png') });

  // persistence
  await p.reload({ waitUntil: 'networkidle' });
  o = await order(p);
  log('the list is remembered after a reload (local only)', o.length === 14, String(o.length));

  // visuals
  await p.locator('[data-testid="studio-auto"]').click().catch(() => {});
  await p.locator('[data-testid="import-paste"]').scrollIntoViewIfNeeded();
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: path.join(SHOTS, 'studio-full.png'), fullPage: true });

  const ax = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const bad = ax.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  log('studio axe serious/critical', bad.length === 0, bad.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0].target.join(' ').slice(0, 70)}`).join(' ; '));
  log('studio: no horizontal overflow', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));

  // ---------------------------------------------------------------- occasions
  await p.goto(BASE + '/occasions', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  const nextCards = await p.locator('[data-testid="next-card"]').count();
  log('three "coming up" cards with countdowns', nextCards === 3 && (await p.locator('[data-testid="countdown"]').first().innerText()).length > 0, await p.locator('[data-testid="countdown"]').first().innerText());
  const rows1 = await p.locator('[data-testid="occasion-row"]').count();
  await p.locator('[data-testid="partner-EG"]').click();
  await p.waitForTimeout(300);
  const rows2 = await p.locator('[data-testid="occasion-row"]').count();
  log('adding Egypt adds its occasions', rows2 > rows1, `${rows1} -> ${rows2}`);
  await p.getByLabel('المناسبات الدينية').uncheck();
  const rows3 = await p.locator('[data-testid="occasion-row"]').count();
  log('religious toggle removes religious occasions', rows3 < rows2, `${rows2} -> ${rows3}`);
  await p.getByLabel('المناسبات الدينية').check();
  await p.locator('[data-testid="draft-btn"]').first().click();
  await p.waitForTimeout(500);
  const draft = await p.locator('[data-testid="draft-text"]').inputValue();
  log('a greeting draft opens with a formal Arabic text', /بمناسبة|تهنئة|التهاني/.test(draft) && draft.length > 80, draft.slice(0, 40).replace(/\n/g, ' '));
  await p.keyboard.press('Escape');
  const [di] = await Promise.all([p.waitForEvent('download'), p.locator('[data-testid="ics-all"]').click()]);
  const ics = fs.readFileSync(await di.path(), 'utf8');
  log('calendar export is a valid .ics with reminders', ics.startsWith('BEGIN:VCALENDAR') && (ics.match(/BEGIN:VEVENT/g) || []).length === (await p.locator('[data-testid="occasion-row"]').count()) && ics.includes('TRIGGER:-P7D'), `${(ics.match(/BEGIN:VEVENT/g) || []).length} events`);
  await p.reload({ waitUntil: 'networkidle' });
  log('chosen partners are remembered (local only)', (await p.locator('[data-testid="partner-EG"]').getAttribute('aria-pressed')) === 'true');
  await p.screenshot({ path: path.join(SHOTS, 'occasions-full.png'), fullPage: true });
  const ax2 = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const bad2 = ax2.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  log('occasions axe serious/critical', bad2.length === 0, bad2.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0].target.join(' ').slice(0, 70)}`).join(' ; '));
  log('occasions: no horizontal overflow', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));

  // mobile + English
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar' });
  const mp = await m.newPage();
  for (const u of ['/seating', '/occasions']) {
    await mp.goto(BASE + u, { waitUntil: 'networkidle' });
    log(`[mobile] ${u} has no horizontal overflow`, !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  }
  const en = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en' });
  const ep = await en.newPage();
  await ep.goto(BASE + '/occasions', { waitUntil: 'networkidle' });
  await ep.waitForSelector('h1');
  await ep.waitForSelector('h1');
  await ep.getByRole('button', { name: /^EN$|English/i }).first().click();
  await ep.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 8000 });
  await ep.waitForTimeout(500);
  const h1 = await ep.locator('h1').innerText();
  log('[en] occasions renders English headings', /Never make a scheduling mistake/i.test(h1), h1);
  await ep.goto(BASE + '/seating', { waitUntil: 'networkidle' });
  log('[en] studio renders English', /From a guest list/i.test(await ep.locator('h1').innerText()), await ep.locator('h1').innerText());
  log('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\nSUMMARY: ${out.filter(Boolean).length}/${out.length} passed`);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
