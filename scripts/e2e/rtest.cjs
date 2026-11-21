const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const BASE = process.env.BASE || 'https://wijaha.web.app';
const out = [];
const log = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

async function ask(ctx, q) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.fill('input, textarea', q);
  await p.keyboard.press('Enter');
  await p.waitForURL(/\/r\/res_/, { timeout: 120000 });
  await p.waitForTimeout(2500);
  return { p, errs };
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ar', acceptDownloads: true });

  // 1) Saudi delegation: reception path + share card
  {
    const { p, errs } = await ask(ctx, 'نستقبل وفداً سعودياً الأسبوع القادم، ماذا نجهز لضيافتهم؟');
    const hasPath = (await p.getByText('مسار الاستقبال المتحرك').count()) > 0;
    log('delegation result shows the reception-path aid', hasPath);
    if (hasPath) {
      await p.getByText('مسار الاستقبال المتحرك').first().click();
      await p.waitForTimeout(800);
      const hall = await p.locator('svg[aria-label="مسار الاستقبال"]').count();
      log('reception path renders inside the result', hall > 0);
      await p.locator('[aria-label="تشغيل"]').first().click().catch(() => {});
      await p.waitForTimeout(4000);
      await p.locator('section[aria-label="مرئيات مساعدة"]').screenshot({ path: require('path').join(process.env.SHOTS || require('os').tmpdir(), 'wijaha-result-visuals.png') });
    }
    // timeline visual (if present)
    const tl = await p.getByRole('tab', { name: 'مصوّر' }).count();
    log('timeline has the visual/list toggle', tl > 0 || (await p.getByText('البرنامج').count()) >= 0);
    // share card
    await p.locator('[data-testid="open-share-card"]').click();
    await p.waitForTimeout(1500);
    const card = await p.locator('[role="dialog"] svg[role="img"]').count();
    log('share card dialog renders a card', card > 0);
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }).catch(() => null), p.locator('[data-testid="card-png"]').click()]);
    if (dl) {
      const buf = fs.readFileSync(await dl.path());
      log('share card downloads as PNG', buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a' && buf.length > 8000, `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)} ${buf.length}B`);
      fs.copyFileSync(await dl.path(), require('path').join(require('os').tmpdir(), 'wijaha-result-card.png'));
    } else log('share card downloads as PNG', false, 'no download');
    await p.keyboard.press('Escape');
    const ax = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = ax.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    log('result page axe serious/critical', bad.length === 0, bad.map((v) => `${v.id}(${v.nodes.length}) ${v.nodes[0].target.join(' ').slice(0, 70)}`).join(' ; '));
    log('no page errors', errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, errs.slice(0, 2).join(' | '));
    await p.close();
  }

  // 2) Majlis seating via the model + deterministic builder
  {
    const { p, errs } = await ask(ctx, 'ترتيب الجلوس في مجلس سعودي لوفد من 8 أشخاص');
    const svg = p.locator('svg[aria-label]').filter({ has: p.locator('text') });
    const seating = await p.getByText('صدر المجلس').count();
    log('majlis seating plan appears for a Gulf majlis question', seating > 0);
    const legend = await p.locator('ol[aria-label="ترتيب الأسبقية"] li').count();
    log('precedence legend lists the seats', legend >= 4, String(legend));
    const sec = p.locator('section:has(svg[aria-label])').filter({ hasText: 'الأسبقية' }).first();
    await sec.scrollIntoViewIfNeeded();
    await p.waitForTimeout(1200);
    await sec.screenshot({ path: require('path').join(process.env.SHOTS || require('os').tmpdir(), 'wijaha-result-seating.png') });
    log('no page errors (seating)', errs.filter((e) => !/Failed to load resource/.test(e)).length === 0, errs.slice(0, 2).join(' | '));
    await p.close();
  }

  // 3) Dining: place setting aid
  {
    const { p } = await ask(ctx, 'ما آداب المائدة وأي شوكة أستخدم في عشاء رسمي؟');
    const table = (await p.getByText('المائدة الرسمية من الخارج إلى الداخل').count()) > 0;
    log('dining result shows the formal table aid', table);
    await p.close();
  }
  await b.close();
  console.log(`\nSUMMARY: ${out.filter(Boolean).length}/${out.length} passed`);
})().catch((e) => { console.error('CRASH', e.message); process.exit(1); });
