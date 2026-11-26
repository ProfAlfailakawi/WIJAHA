# المكتبة المرئية

صفحة `/visuals` ومكوّنات `src/components/visuals/`. كل شيء رسوم SVG يولّدها الكود في المتصفح: بلا خدمات خارجية وبلا تكلفة.

| المرئي | المكوّن | أين يظهر |
|---|---|---|
| مخططات الجلوس: المجلس الخليجي، المستديرة، المباحثات، حرف U، المسرح | `SeatingFloorplan` | `/visuals` وكتلة الجلوس في النتائج |
| مسار الاستقبال المتحرك (مجلس خليجي / وفد رسمي) | `ReceptionPath` | `/visuals` وتحت نتائج الاستقبال والضيافة |
| المائدة الرسمية من الخارج إلى الداخل | `PlaceSetting` | `/visuals` وتحت نتائج المائدة والضيافة |
| توقيع اتفاقية، منصة كلمة، صورة تذكارية | `PodiumFlags` | `/visuals` |
| بطاقة المشاركة 1080×1350 | `ShareCard` | `/visuals` وزر في كل نتيجة |
| الخط الزمني المصوّر | `VisualTimeline` | كتلة البرنامج في النتائج و`/visuals` |

- **الهندسة المشتركة** `src/shared/visuals/seating.ts`: يستعملها الخادم (`seat-nodes.ts`) والواجهة معاً، ومختبَرة لكل تخطيط وعدد مقاعد (ترتيب 1..n، الحدود، عدم التداخل، ضيف الشرف عن يمين المضيف).
- **التصدير** `export.ts`: PNG وSVG ومشاركة أصلية على الجوال، كلها من المتصفح. الألوان تُثبَّت قبل التصدير، والصورة تمر عبر `data:` لتوافق سياسة الأمان.
- **القواعد**: كل مرئي يربط خطواته برموز قواعد حقيقية؛ النقر عليها يفتح نافذة القاعدة من `GET /api/rules/:id` (للقراءة العامة، للقواعد المعتمدة فقط).
- **الاتجاه**: كل SVG يحمل اتجاهه صراحةً (RTL/LTR) فلا يتأثر باتجاه الصفحة.
- فحوص المتصفح في `scripts/e2e/`.

حدود: الأعلام مجرّدة (ليست أعلاماً حقيقية) والتفاصيل الدقيقة تُعتمد من مراسم الجهة المضيفة. مخطط الجلوس يعتمد عدد الضيوف ولا يستورد قوائم Excel بعد.

## Seating studio (`/seating`) and Occasions radar (`/occasions`)

- **Studio**: paste or import Excel/CSV (real .xlsx read in-browser via fflate), guests ordered by a title-based precedence suggestion (advisory only, confirm with the host's protocol office), drag seats to swap, warnings for inverted precedence, A4 name cards (PNG), plan PNG and order CSV. Data stays in the browser (localStorage).
- **Radar**: national/religious days for chosen partner countries, greeting drafts, `.ics` export with reminders. Hijri dates are computed with Intl `islamic-umalqura` and are approximate (moon sighting); some national dates are unverified.
- Tests: `scripts/e2e/stest.cjs` (30 checks), plus unit tests for precedence, guest-import and occasions.

## Visual wave 1 (display only; no data, API or grading changes)

| Visual | Where | Files |
|---|---|---|
| The hall forms as you type (3D on capable desktops, static plan on phones / low power / reduced motion); on submit the camera settles into the principal guest's seat | `/` hero | `components/visuals/HeroHall.tsx` |
| Guests enter from the door in order of precedence, optional clip via MediaRecorder | `/seating` and the seating block, 3D view | `components/visuals/GuestsEnter.tsx`, `three/hall-scene.ts` (`walkIn`) |
| Invitation envelope and descending cards while a result streams | `/r/:id` | `components/visuals/InvitationEnvelope.tsx` |
| Embodied counterpart reacting to the chosen option's own rubric scores | `/practice/:scenarioId` | `three/CounterpartStage.tsx`, `shared/tools/counterpart.ts` |
| Ops room: circular clock, sliding timeline, red flood while an emergency playbook is open | `/live` | `components/visuals/OpsRoom.tsx` |
| Partners globe (bundled capital coordinates, no map service) and Hijri year ring | `/occasions` | `components/visuals/PartnersGlobe.tsx`, `three/globe-scene.ts`, `shared/visuals/capitals.ts` |
| Wijaha passport seals (soft Web Audio thud after interaction) and certificate sheen | `/practice/report/:runId`, `/learn` | `components/visuals/PassportSeals.tsx` |
| The table builds itself on scroll + "spot the mistake" | `/showcase` | `components/visuals/TableBuild.tsx` |
| One token system (navy + gold accents, Amiri headings, shared radii) and the eight-point star thread between pages | every page | `index.css`, `styles/visual-wave.css`, `layout/StarThread.tsx` |
