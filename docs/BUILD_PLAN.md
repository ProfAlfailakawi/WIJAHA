# خطة البناء الشاملة لمنصة «وجاهة | WIJAHA» — الإصدار الأول (V1)

> **تاريخ الإعداد:** 18 نوفمبر 2026
> **النطاق:** تنفيذ كامل للمراحل **1 إلى 6** (الإصدار الأول V1) وفق مواصفات `WIJAHA_BUILD_PROMPT` مع قاعدة بيانات Cloud SQL (PostgreSQL) وهوية بصرية هادئة الفخامة (Quiet Luxury). لا تُنفّذ مزايا المرحلتين 7 و8، مع تصميم المعمارية لتقبلها لاحقاً دون إعادة هيكلة.

---

## 1. القرار المعماري الأساسي (Modular Monolith)
- **الخادم والواجهة في مستودع واحد (TypeScript Strict):**
  - خادم `Express` (`server.ts`) يقدم واجهات `/api/*` مع بث `SSE` مباشر لنتائج الذكاء الاصطناعي، ورؤوس أمان صارمة، وفحص الصلاحيات (`RBAC`)، وعزل المؤسسات (`Multi-Tenancy`).
  - واجهة `React 19` + `React Router` + `Tailwind CSS v4` + `Motion` مع دعم ثنائي اللغة الكامل (`ar` RTL / `en` LTR) والوضعين الفاتح والداكن.
  - قاعدة البيانات: **Cloud SQL for PostgreSQL** عبر `Drizzle ORM` (`src/db/schema.ts` و`src/db/index.ts`) مع مصادقة `Firebase Authentication` (Google OAuth) + روابط سحرية عبر مزود `console` + حسابات تجريبية (`seed`) معزولة للمعاينة والاختبار.
  - موثق بالتفصيل في `docs/decisions/ADR-001-modular-monolith-express-vite.md`.

---

## 2. ترتيب التنفيذ بالمراحل (1 ← 6)

### المرحلة 1 — الأساس التقني والأمني ونظام التصميم
- `src/config/brand.ts`: هوية «وجاهة | WIJAHA» القابلة للتعديل من ملف واحد.
- `src/messages/ar.json` و`src/messages/en.json`: ترجمة شاملة لكل نصوص الواجهة بلا استثناء.
- `src/index.css` و`src/components/ui/*`: نظام التصميم (الألوان العاجية والكحلية والذهبية المحدودة ≤5%، المكونات الأساسية، صفحة `/dev/components`).
- `src/db/schema.ts`: جميع جداول الإصدار الأول (الهوية والمؤسسات، المعرفة، الاستعلامات والنتائج والمشاريع والإصدارات، المحاكاة والكفايات، الخبراء والخدمات والطلبات، الباقات والاستحقاقات والفوترة وسجل الإيرادات، سجل التدقيق والـ Evals).
- `src/server/auth/*`: المصادقة، الجلسات المحمية `HttpOnly`، RBAC مركزي (`can(user, action, resource)`)، وعزل المؤسسات في كل استعلام مع اختبارات عزل آلية 100%.

### المرحلة 2 — قاعدة المعرفة ولوحة المحتوى والفهرسة
- بيانات `seed` تجريبية (`status = 'draft_demo'`) تضم **48 قاعدة بروتوكولية تجريبية** معلّمة بوضوح «محتوى تجريبي غير معتمد»، تغطي الدول والسياقات والنوايا الـ 16 مع مصادر تجريبية وقاموس ألقاب ومرادفات خليجية.
- `src/shared/arabic.ts`: تطبيع النصوص العربية (الهمزات، التاء المربوطة، الألف المقصورة، التشكيل) وتوسيع المرادفات الخليجية.
- `src/server/knowledge/*`: محرك البحث الهجين (كلمات مفتاحية مطبّعة + تشابه دلالي متجهي + مرشحات الدولة والموضوع والسياق والحالة) وكشف التعارض، واستيراد CSV، وطابور المراجعة (`/admin/content` و`/admin/review`).

### المرحلة 3 — محرك الذكاء الاصطناعي والصفحة الرئيسية والنتائج المتحولة والـ Evals
- `src/server/ai/*`: طبقة تجريد المزود (`MockProvider` الحتمي + `GeminiProvider` عبر `@google/genai` مع `gemini-4-hydrogen` و`gemini-embedding-2`)، وخط الأنابيب ذي الـ 9 مراحل، والتحقق الصارم بـ `Zod` ومنع اختلاق أي `ruleId`.
- الصفحة الرئيسية `/` مطابقة للقواعد العشر (مربع بحث ذكي + 3 رقائق أمثلة فقط، بلا تسجيل مسبق أو تشتيت بصري).
- صفحة النتيجة `/r/[resultId]` مع البث المرحلي الحقيقي، وسؤال التوضيح الواحد بالأزرار، والافتراضات القابلة للتعديل، والمكونات الستة التفاعلية المزودة بانفوجرافيك بصري نظيف (`answer`, `checklist`, `timeline`, `draft`, `seating` SVG، `expert_review`).
- `evals/golden/demo-60.jsonl` + `evals/run-evals.ts`: 60 حالة اختبار ذهبية تجريبية تغطي النوايا واللغتين واللهجة الخليجية + لوحة `/admin/evals`.

### المرحلة 4 — المشاريع والإصدارات و«حدّث الخطة» والتصدير
- `/projects` و`/projects/[id]`: حفظ النتائج كمشاريع، تحرير القوائم والجدول الزمني ومسودة الدعوة ومخطط الجلوس التفاعلي، سجل الإصدارات مع الاستعادة، وميزة «حدّث الخطة» باللغة الطبيعية مع عرض الفروق (`diff`)، والمشاركة برابط مؤقت، وتصدير `DOCX` حقيقي و`PDF` رسمي يدعم العربية RTL.

### المرحلة 5 — الباقات والاستحقاقات والقياس والفوترة
- 5 باقات افتراضية قابلة للتعديل (`free`, `individual`, `pro`, `team`, `enterprise`) وجدول `plan_entitlements`، وعداد الاستخدام الشهري (`usage_counters`)، ومحول دفع `mock/sandbox` مع معالجة `webhooks` متكررة بأمان (`idempotent`)، والفواتير، وصفحتا `/pricing` و`/account` و`/org`.

### المرحلة 6 — المحاكاة والتقارير وExpert Bridge و«افحص خطتي» والصفحات القانونية
- `/practice` و`/practice/[scenarioId]` و`/practice/report/[runId]`: 3 سيناريوهات محاكاة تجريبية متفرعة (بينها «الوفد وصل مبكراً») مع أسئلة اختيار وإجابات حرة مقيّمة بالمعيار، وتقرير كفايات بصري (`C1..C7`) دون رقم إجمالي مضلل.
- `/experts` و`/experts/[slug]` و`/request/[serviceId]` و`/admin/requests`: ملفات د. يوسف الحسني ود. أحمد الفيلكاوي، الخدمات الثلاث (`yousef`, `ahmad`, `joint`)، شروط ظهور `Expert Bridge` البرمجية، نظام CRM المبسط، وقواعد توزيع الإيرادات القابلة للضبط (`revenue_split_rules` و`revenue_ledger`).
- `/check`: أداة «افحص خطتي» لتحليل مسودات البرامج واستخراج المخاطر مرتبة حسب الخطورة (`critical`, `important`, `improvement`).
- الصفحات التوثيقية والقانونية: `/about`، `/methodology` (مع انفوجرافيك المنهجية)، `/legal/terms`، `/legal/privacy`، `/legal/disclaimer` (مسودات معلّمة للمراجعة القانونية).

---

## 3. الجداول الرئيسية في قاعدة البيانات (`src/db/schema.ts`)
1. **الهوية والمؤسسات:** `users`, `orgs`, `memberships`, `invitations`, `auth_sessions`, `magic_links`
2. **المعرفة:** `sources`, `knowledge_rules`, `knowledge_rule_versions`, `titles_dictionary`, `synonyms`
3. **النتائج والمشاريع:** `queries`, `results`, `projects`, `project_versions`, `shares`, `exports_log`, `feedback`
4. **المحاكاة:** `scenarios`, `simulation_runs`, `simulation_steps`, `competency_scores`
5. **الخبراء والخدمات:** `experts`, `services`, `service_requests`, `quotes`, `deliveries`, `expert_suggestion_events`
6. **الفوترة والتشغيل:** `plans`, `plan_entitlements`, `subscriptions`, `usage_counters`, `payments`, `webhook_events`, `invoices`, `revenue_split_rules`, `revenue_ledger`, `audit_logs`, `eval_cases`, `eval_runs`, `analytics_events`

---

## 4. المخاطر وضوابط التخفيف
| الخطر | الضابط المطبق |
|---|---|
| اختلاق قواعد بروتوكولية غير موجودة | فحص صارم بعد التوليد يحذف أي `ruleId` غير موجود في القواعد المسترجعة ويحوله إلى `advisory` محسوب في `unreviewedClaims`. |
| تسرب بيانات بين المؤسسات (Cross-tenant leak) | فحص مزدوج في طبقة الصلاحيات والاستعلامات بشرط `orgId` إلزامي + اختبار عزل آلي يغطي المسارات الحساسة. |
| كسر الحروف العربية في التصدير | توليد `DOCX` بخصائص `bidirectional: true`، وتوليد `PDF` عبر قالب HTML/Print مع خطوط `IBM Plex Sans Arabic` المضمنة واتجاه `RTL`. |
| التلوث البصري والازدحام | الالتزام الصارم بـ Quiet Luxury، وحد الذهبي ≤5%، وعدم عرض أي نافذة أو عرض تجاري قبل ظهور القيمة الكاملة للمستخدم. |
