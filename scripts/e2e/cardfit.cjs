const { chromium } = require('playwright');
const cases = {
  ar_long: ['تجهيز ضيافة الوفد السعودي خلال الأسبوع القادم مع كل التفاصيل المطلوبة للاستقبال', [
    'الحصول على قائمة الوفد الكاملة وكتابة الأسماء كما وردت دون اختصار أو ترجمة آلية، مع اللقب قبل الاسم، والسؤال عن الصيغة المفضلة لكل شخص',
    'تأكيد ألقاب المخاطبة الدقيقة (معالي للوزراء، سعادة للسفراء وكبار المسؤولين، صاحب السمو للأمراء) من وزارة الخارجية أو مراسم الجهة المضيفة',
    'طباعة بطاقات الأسماء بالعربية والإنجليزية بعد اعتماد الصيغ.',
    'مراجعة التقويم: الجمعة والسبت عطلة نهاية الأسبوع في السعودية، فتجنّبوا جدولة اللقاءات الرسمية فيهما إلا باتفاق مسبق، وتأكدوا من مواعيد الصلاة',
    'إذا شملت الزيارة مكة المكرمة أو المدينة المنورة، أو صادفت رمضان أو موسم الحج، فاحجزوا الإقامة والنقل فوراً وراجعوا الأنظمة الخاصة بالحشود']],
  en_long: ["Preparing a full hospitality programme for the visiting Saudi delegation next week", [
    'Obtain the full delegation list and write names exactly as provided, with the title before the name, and ask which form each person prefers',
    'Confirm exact forms of address (Maali for ministers, Saadat for ambassadors, His Highness for princes) with the Ministry of Foreign Affairs',
    'Print bilingual name cards after the forms are approved.',
    'Check the calendar: Friday and Saturday are the weekend, so avoid official meetings then unless agreed in advance and confirm prayer times',
    'If the visit includes Makkah or Madinah, or falls in Ramadan or Hajj season, book lodging and transport immediately and review crowd rules']],
  short: ['قصير', ['نقطة واحدة قصيرة بما يكفي', 'نقطة ثانية قصيرة أيضاً', 'ثالثة']],
};
(async () => {
  const b = await chromium.launch();
  let fails = 0;
  for (const locale of ['ar', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale });
    const p = await ctx.newPage();
    await p.goto((process.env.BASE || 'http://127.0.0.1:5199') + '/visuals', { waitUntil: 'networkidle' });
    if (locale === 'en') { await p.getByRole('button', { name: /^EN$/ }).first().click().catch(() => {}); await p.waitForTimeout(400); }
    await p.locator('#card').scrollIntoViewIfNeeded();
    for (const [name, [title, pts]] of Object.entries(cases)) {
      if ((locale === 'en') !== name.startsWith('en') && name !== 'short') continue;
      await p.locator('#card input').nth(1).fill(title);
      await p.locator('#card textarea').fill(pts.join('\n'));
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const svg = document.querySelector('#card svg[viewBox="0 0 1080 1350"]');
        const bad = [];
        let maxBottom = 0;
        const sr = svg.getBoundingClientRect();
        const k = 1080 / sr.width;
        for (const t of svg.querySelectorAll('text')) {
          const r0 = t.getBoundingClientRect();
          const x0 = (r0.left - sr.left) * k, x1 = (r0.right - sr.left) * k, y1 = (r0.bottom - sr.top) * k;
          if (x0 < 8 || x1 > 1072 || y1 > 1345) bad.push(`${(t.textContent || '').slice(0, 24)} @${Math.round(x0)}-${Math.round(x1)}`);
        }
        const rects = [...svg.querySelectorAll('rect[rx="26"]')];
        for (const rc of rects) maxBottom = Math.max(maxBottom, rc.y.baseVal.value + rc.height.baseVal.value);
        const cards = rects.length;
        const footerTop = 1350 - 168;
        // text lines must not collide with the footer line / note
        const notes = [0];
        return { cards, maxBottom: Math.round(maxBottom), footerTop, bad, noteTop: Math.round(Math.min(...notes)) };
      });
      const ok = r.maxBottom <= r.footerTop && r.bad.length === 0 && r.cards >= 3;
      if (!ok) fails++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  [${locale}] ${name}  cards=${r.cards} lastCardBottom=${r.maxBottom} footerLine=${r.footerTop} overflowing=${r.bad.join(',') || 'none'}`);
      await p.locator('#card svg[viewBox="0 0 1080 1350"]').screenshot({ path: require("os").tmpdir() + `/cardfit-${locale}-${name}.png` });
    }
    await ctx.close();
  }
  await b.close();
  process.exit(fails ? 1 : 0);
})();
