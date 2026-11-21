const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const BASE = process.argv[2] || (process.env.BASE || 'http://127.0.0.1:5199');
const out = [];
const log = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

async function pngInfo(buf) {
  const sig = buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  return { sig, w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), size: buf.length };
}

(async () => {
  const b = await chromium.launch();
  for (const locale of ['ar', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale, acceptDownloads: true });
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
    p.on('pageerror', (e) => errs.push('pageerror ' + String(e).slice(0, 160)));
    await p.goto(BASE + '/visuals', { waitUntil: 'networkidle' });
    if (locale === 'en') {
      const toggle = p.getByRole('button', { name: /^EN$|English/i }).first();
      if (await toggle.count()) await toggle.click();
      await p.waitForTimeout(500);
    }
    log(`[${locale}] page lang/dir`, true, await p.evaluate(() => document.documentElement.lang + '|' + document.documentElement.dir));

    // Exports: PNG + SVG from every section
    const pngs = p.locator('[data-testid="export-png"]');
    const n = await pngs.count();
    for (let i = 0; i < n; i++) {
      const btn = pngs.nth(i);
      await btn.scrollIntoViewIfNeeded();
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }).catch(() => null), btn.click()]);
      if (!dl) { log(`[${locale}] export png #${i + 1}`, false, 'no download'); continue; }
      const path = await dl.path();
      const info = await pngInfo(fs.readFileSync(path));
      log(`[${locale}] export png #${i + 1} (${dl.suggestedFilename()})`, info.sig && info.w >= 800 && info.size > 8000, `${info.w}x${info.h} ${info.size}B`);
      if (i === 0 && locale === 'ar') fs.copyFileSync(path, require('path').join(require('os').tmpdir(), 'wijaha-export-sample.png'));
    }
    const svgBtn = p.locator('[data-testid="export-svg"]').first();
    const [sd] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), svgBtn.click()]);
    const svgText = fs.readFileSync(await sd.path(), 'utf8');
    log(`[${locale}] export svg is standalone (no var(), has xmlns)`, svgText.includes('xmlns=') && !svgText.includes('var(--'));

    if (locale === 'ar') {
      // Seating animation + layout switch
      await p.locator('[data-testid="seat-play"]').click();
      await p.waitForTimeout(2500);
      for (const name of ['مائدة مستديرة', 'مباحثات ثنائية', 'حرف U', 'قاعة مسرح']) {
        await p.getByRole('tab', { name }).first().click();
        await p.waitForTimeout(400);
      }
      log('[ar] seating layouts switch without errors', errs.length === 0, errs.join('|'));

      // Reception path: play and see the step advance
      await p.locator('#reception').scrollIntoViewIfNeeded();
      await p.locator('#reception button[aria-label="تشغيل"]').click();
      await p.waitForTimeout(6500);
      const step = await p.locator('#reception p:has-text("المحطة")').innerText();
      log('[ar] reception path advances while playing', !/المحطة\s*1\s*\/\s*8/.test(step.replace(/\s+/g, ' ')) || /2|3/.test(step), step.replace(/\s+/g, ' '));

      // Place setting: jump to course 4
      await p.locator('#table [role="tab"]').nth(3).click();
      const cap = await p.locator('#table h3').first().innerText();
      log('[ar] place setting course selection', /الرئيسي/.test(cap), cap);

      // Podium scenes
      for (const name of ['منصة كلمة', 'الصورة التذكارية']) { await p.locator('#podium').getByRole('tab', { name }).click(); await p.waitForTimeout(300); }
      log('[ar] podium scenes switch', errs.length === 0, errs.join('|'));

      // Rule dialog (needs the API; the dev server has none, so only check the dialog opens)
      await p.locator('#seating button').filter({ hasText: /^R-(ARAB|DEMO)-/ }).first().click();
      await p.waitForTimeout(600);
      log('[ar] rule chip opens a dialog', (await p.locator('[role="dialog"]').count()) > 0);
      await p.keyboard.press('Escape');
    }

    // Scroll-triggered entrance animations: visit every part of the page first, so nothing is still fading in when axe measures contrast.
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 70)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(900);
    // A11y + overflow
    const ax = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = ax.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    log(`[${locale}] axe serious/critical`, bad.length === 0, bad.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0].target.join(' ').slice(0, 60)}`).join(' ; '));
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    log(`[${locale}] no horizontal overflow`, !overflow);
    log(`[${locale}] no console errors`, errs.filter((e) => !/api\/|Failed to load resource/.test(e)).length === 0, errs.slice(0, 3).join(' | '));
    if (locale === 'en') {
      await p.locator('#card').scrollIntoViewIfNeeded();
      await p.waitForTimeout(800);
      await p.locator('#card').screenshot({ path: require('path').join(process.env.SHOTS || require('os').tmpdir(), 'wijaha-card-en.png') });
    }
    await ctx.close();
  }
  // Mobile overflow
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ar' });
  const mp = await m.newPage();
  await mp.goto(BASE + '/visuals', { waitUntil: 'networkidle' });
  log('[mobile] no horizontal overflow', !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  await b.close();
  console.log(`\nSUMMARY: ${out.filter(Boolean).length}/${out.length} passed`);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
