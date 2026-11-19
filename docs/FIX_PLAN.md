# خطة جولة الإصلاح 1 | WIJAHA Fix Round 1 Plan

**المستودع:** `ProfAlfailakawi/WIJAHA`  
**الفرع:** `fix/round-1` (متفرع من `main` عند `d670b62`)  
**القاعدة الصارمة للنطاق:** لا إعادة تصميم بصري، ولا تعديل للألوان أو الخطوط أو الأحجام أو المسافات أو التخطيط أو قائمة التنقل العلوية. التعديلات البصرية محصورة حصرياً في التغييرات الجراحية الوظيفية المفروضة ببنود هذه الخطة وبالمكونات الموجودة (`src/components/ui/Primitives.tsx`).

---

## 1. ترتيب التنفيذ الإلزامي

يُنفَّذ العمل بالترتيب الصارم التالي مع commit مستقل لكل بند وإثبات فشل اختبار الانحدار قبل الإصلاح ونجاحه بعده:

1. **تحضير اختبارات الانحدار قبل الإصلاح + تأسيس البنية التحتية والترحيلات المشتركة (`env.ts`، `pgvector`، توسعة المخطط المتوافقة مع الإصدار السابق)**
2. **المسار A — الثغرات الحرجة (P0):** `A1` ← `A2` ← `A3`
3. **المسار B — الثغرات عالية الأولوية (P1):** `B1` ← `B2` ← `B3` ← `B4` ← `B5` ← `B6` ← `B7` ← `B8`
4. **المسار C — الثغرات المتوسطة والحوكمة (P2):** `C1` ← `C2` ← `C3` ← `C4` ← `C5` ← `C6` ← `C7` ← `C8` ← `C9` ← `C10` ← `C11` ← `C12` (`C13` مغطى في `B6`)
5. **المسار D — النزاهة والصدق في المنتج والوثائق:** `D1` ← `D2` ← `D3` ← `D4`
6. **المسار E — الذكاء الاصطناعي الحقيقي والاسترجاع الهجين:** `E1` ← `E2` ← `E3` ← `E4` ← `E5` ← `E6`
7. **المسار F — نزاهة اختبارات الجودة (Evals):** `F1` (`dev` / `holdout` / `adversarial`)
8. **المسار G — البنية التحتية والبيانات والمراقبة والاحتفاظ:** `G1` ← `G2` ← `G3` ← `G4` ← `G5` ← `G6` ← `G7`
9. **المسار I — إكمال نواقص الإصدار الأول (دون تصميم جديد):** `I1`–`I8`
10. **المسار H — الاختبارات ومصفوفة العزل وCI وتوحيد مدير الحزم:** `H1`–`H6`
11. **المسار J — تحديث الوثائق والتقرير الختامي الصادق:** `J1` ← `J2` (`docs/reports/fix-round-1.md`)

---

## 2. مسارات العمل والملفات المتأثرة

### المسار A: الثغرات الحرجة (P0)
| البند | الوصف المختصر | الملفات المتأثرة |
|---|---|---|
| **A1** | إلغاء تسجيل `POST /api/auth/demo-login` إلا عند `NODE_ENV !== 'production' && ENABLE_DEMO_LOGIN === 'true'`، ورفض الإقلاع في الإنتاج عند تفعيل العلَم، وإخفاء أزرار الحسابات التجريبية إلا عند `demoLoginEnabled === true`. | `src/server/config/env.ts`, `server.ts`, `src/lib/auth-client.tsx`, `src/components/layout/AppShell.tsx` |
| **A2** | منع تسريب رمز الدخول السحري في الرد أو السجلات (إلا مع `EMAIL_PROVIDER=console` في غير الإنتاج)، توليد الرمز بـ `crypto.randomInt(100000, 1000000)`، حد 3 طلبات/15د لكل بريد مع إبطال الرموز السابقة، حد 5 محاولات خاطئة/15د لكل بريد مع إبطال الرموز غير المستخدمة + حد IP، مقارنة `crypto.timingSafeEqual`، رسائل محايدة، وطبقة `src/server/email/provider.ts`. | `src/server/email/provider.ts`, `src/db/schema.ts`, `server.ts`, `src/server/config/env.ts` |
| **A3** | طبقة دفع `src/server/billing/provider.ts` (`mock` للتطوير فقط + `stripe` sandbox بتوقيع HMAC على `express.raw`)، صلاحية `org:manage_billing` على `/checkout` و`/cancel`، منع الترقية المباشرة في `/checkout`، مسار تطوير منفصل لمحاكاة الإشعار في غير الإنتاج، استخراج الحقيقة من الجلسة/الحدث الموقّع فقط، منع التكرار عبر `webhook_events`، و`db.transaction` ذرّية. | `src/server/billing/provider.ts`, `src/server/billing/entitlements.ts`, `src/db/schema.ts`, `server.ts`, `src/pages/PricingAndAccountPages.tsx`, `src/pages/ExpertsPage.tsx` |

### المسار B: الثغرات عالية الأولوية (P1)
| البند | الوصف المختصر | الملفات المتأثرة |
|---|---|---|
| **B1** | حذف `ensureSeeded()` من `server.ts`، وحصر الزرع في `npm run db:seed` مع فصل البيانات المرجعية عن البيانات التجريبية ومنع الزرع في الإنتاج بدون `--allow-production-seed` (وحتى معه لا حسابات تجريبية). | `server.ts`, `src/db/seed.ts`, `src/db/seed-data.ts`, `src/db/seed-cli.ts` |
| **B2** | معرفات نتائج UUID كاملة (128-bit)، `isPublicShare = false` افتراضياً، `anonId` موقّع بـ HMAC في cookie، وتحقق صارم من الملكية/صلاحية المؤسسة في القراءة و`refine` (مع القياس وحد المعدل) والتصدير وإنشاء المشروع. | `src/server/auth/anon.ts`, `src/server/ai/pipeline.ts`, `src/db/schema.ts`, `server.ts` |
| **B3** | إلزامية الدخول لطلب الخدمة (موثقة في `ADR-003`)، إنشاء الطلب دائماً بحالة `new` و`paid: false`، إنشاء جلسة دفع للخدمات ثابتة السعر وتحويلها إلى `paid` فقط من إشعار موقّع، التحقق من ملكية `projectId`، ومعرف طلب فريد بضمان قاعدة البيانات. | `server.ts`, `src/pages/ExpertsPage.tsx`, `docs/decisions/ADR-003-service-request-auth-and-rls.md` |
| **B4** | عند غياب سجل العضوية يُعاد `orgRole = null` وتعود الجلسة للمساحة الشخصية، وإضافة مسار حذف عضو يُبطل جلساته المرتبطة بالمؤسسة فوراً. | `src/server/auth/session.ts`, `server.ts`, `src/pages/PricingAndAccountPages.tsx` |
| **B5** | `src/server/config/env.ts` بمخطط Zod صارم، إلزامية `FIELD_ENCRYPTION_KEY` (32 بايت) و`IP_HASH_SALT` في الإنتاج، توليد تلقائي في `.env.local` للتطوير مع تحذير، دعم تدوير المفاتيح (`keyVersion`)، واستخدام `SESSION_SECRET` لتوقيع الجلسات المجهولة. | `src/server/config/env.ts`, `src/server/auth/rbac.ts`, `.gitignore`, `.env.example` |
| **B6** | نقل إعدادات Firebase إلى متغيرات بيئة (`VITE_FIREBASE_*` و`FIREBASE_*`)، تفعيل `checkRevoked: true` ورفض بريد غير مؤكد لمزود كلمة المرور، وتوثيق الحاجة لمشروع Firebase مستقل دون إنشائه. | `src/lib/firebase.ts`, `src/lib/firebase-admin.ts`, `src/server/auth/session.ts`, `README.md`, `docs/reports/fix-round-1.md` |
| **B7** | حذف صورتَي المؤسسَين المولّدتين من المستودع والكود، عرض الأحرف الأولى في المكون الدائري الموجود، وإضافة تحديث `avatarUrl` من لوحة الإدارة. | `src/assets/images/expert_*`, `src/config/brand.ts`, `src/db/seed-data.ts`, `src/pages/ExpertsPage.tsx`, `src/pages/AdminPage.tsx`, `server.ts` |
| **B8** | استيراد الصور المتبقية عبر `import` قياسي في Vite لتُضمَّن في `dist/` مع اختبار آلي يتحقق من استجابة `200` في نسخة الإنتاج. | `src/config/brand.ts`, `tests/build-assets.test.ts` |

### المسار C: الثغرات المتوسطة والحوكمة (P2)
| البند | الوصف المختصر | الملفات المتأثرة |
|---|---|---|
| **C1** | التحقق من ملكية جلسات المحاكاة (`userUid` أو `anonId` الموقّع) على `/step` و`/report`. | `server.ts` |
| **C2** | تصفية المشاريع المحذوفة (`deletedAt IS NULL`)، مسار `DELETE /api/projects/:id`، ومسار `DELETE /api/shares/:id` (`revokedAt`)، وصلاحية افتراضية 30 يوماً قابلة للتعديل للروابط. | `src/db/schema.ts`, `server.ts`, `src/pages/ProjectsPage.tsx` |
| **C3** | إخفاء رموز الدعوات عن غير `org_owner` و`org_admin`، وإكمال `POST /api/invitations/:token/accept` (صلاحية، استخدام واحد، مطابقة بريد، فحص مقاعد). | `server.ts`, `src/pages/PricingAndAccountPages.tsx`, `src/App.tsx` |
| **C4** | تقسيم صلاحيات الإدارة (`admin:content`, `admin:requests:own`, `admin:requests:all`, `admin:finance`, `admin:users`, `admin:evals`) وعزل بيانات الخبير عن السجل المالي وبريد الآخرين. | `src/server/auth/rbac.ts`, `server.ts`, `src/pages/AdminPage.tsx` |
| **C5** | التحقق بـ Zod enum وآلة حالات صارمة لانتقالات حالة القاعدة (`draft` → `in_review` → `approved` → `deprecated`) مع اشتراط مراجع و`senior_reviewer` للحساسية العالية. | `src/server/knowledge/lifecycle.ts`, `server.ts` |
| **C6** | حصر `POST /api/admin/evals/run` بصلاحية `admin:evals` مع حد معدل وسقف تكلفة. | `server.ts` |
| **C7** | فرض التحقق الثنائي TOTP MFA على أدوار الإدارة والخبير والمراجع قبل دخول `/api/admin/*` (مع إمكانية تعطيله في التطوير فقط عبر متغير بيئة موثق). | `src/server/auth/totp.ts`, `src/db/schema.ts`, `server.ts`, `src/pages/AdminPage.tsx`, `src/pages/PricingAndAccountPages.tsx` |
| **C8** | زيادة ذرّية مشروطة في SQL لعدادات الاستخدام قبل التوليد/التعديل/التصدير مع استرداد الرصيد عند الفشل، وحد شهري للمجهول (`anonId` + `ipHash`). | `src/server/billing/entitlements.ts`, `src/db/schema.ts`, `server.ts` |
| **C9** | ضبط `trust proxy` لـ Cloud Run، ونقل محدد المعدل إلى جدول مشترك في Postgres (`rate_limit_buckets`) مع تنظيف دوري. | `src/server/security/rate-limit.ts`, `src/db/schema.ts`, `server.ts` |
| **C10** | رؤوس أمان صارمة (`Content-Security-Policy`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy`). | `src/server/security/headers.ts`, `server.ts` |
| **C11** | قراءة `IP_HASH_SALT` من البيئة مع توثيق التدوير الدوري. | `src/server/config/env.ts`, `src/server/auth/rbac.ts`, `docs/security.md` |
| **C12** | تقييد `locale` بـ Zod enum في `exporter.ts`، وتشغيل التصدير بمهلة زمنية وحد ذاكرة لـ Chromium وتوثيق `--no-sandbox`. | `src/server/export/exporter.ts`, `docs/security.md` |

### المسار D: النزاهة والصدق في المنتج والوثائق
- **D1:** إزالة `?? 42` من `PracticePage.tsx` و`: 70` من `server.ts`، وفصل دالة حساب محاور الرادار (`computeRadarAxesPure`) بحيث تظهر الكفايات غير المقيّمة كنقطة مفتوحة بلا رقم مع نص «لم تُقيَّم في هذه الجلسة».
- **D2:** تعديل `buildSimulationReportPure` لتذكر كل نقطة قوة أو فجوة اسم الكفاية، والخيار الفعلي الذي اختاره المتدرب في الجلسة، و`ruleId` المرجعي.
- **D3 & D4:** تغيير اسم الحزمة إلى `"wijaha"`، وتوحيد أوامر `package.json`، وعرض تنبيه هادئ في `ResultPage.tsx` عند `AI_PROVIDER=mock`، ومطابقة كل الوثائق للواقع الفعلي.

### المسار E: الذكاء الاصطناعي الحقيقي والاسترجاع الهجين
- **E1:** استخراج النية بنموذج لغوي سريع مع `IntentExtractionSchema` ومهلة 4 ثوانٍ وعتبة ثقة، وفصل نص المستخدم كبيانات غير موثوقة، وحساب الحساسية كأعلى القيمتين (`max(model, rules)`)، ودعم الأرقام الهندية والكلمات العربية في `parseGuestCount`.
- **E2:** تضمين حقيقي عبر `AI_MODEL_EMBED` (`@google/genai` `embedContent`)، وتفعيل `pgvector` بفهرس `HNSW`، وأمر `npm run kb:reindex` ومهمة خلفية عند تعديل القاعدة، ودمج البحث النصي الكامل في Postgres (مع التطبيع والمرادفات) مع البحث المتجهي عبر **Reciprocal Rank Fusion (RRF)**، وتسمية الاحتياط الوهمي `lexicalHashVector`، ومنع استرجاع `draft_demo` في الإنتاج وعزل قواعد المؤسسات.
- **E3:** مخطط Zod صارم لـ `WijahaResult` والمكونات الستة + `responseSchema`، إعادة محاولة واحدة عند فشل المخطط ثم الاحتياط الحتمي، التحقق من `ruleIds` وتجريد الروابط وحد 3 نقاط للملخص و`primaryAction` واحد ومصفوفة المكونات المسموحة، وإلغاء الطلب عبر `AbortController` مع SSE.
- **E4 & E5:** عمليات تعديل منظمة (`ProjectPatchOpSchema`) لتحديث المشروع وحساب الفروقات حتمياً، وفحص برنامج الزيارة (`auditVisitPlan`) بالنموذج والقواعد المسترجعة مع حد 20,000 حرف وحماية من حقن التعليمات.
- **E6:** جدول `ai_calls` (دون نصوص المستخدم)، سقوف تكلفة يومية للمستخدم والمؤسسة والمنصة مع تنبيه 80%، وذاكرة مؤقتة للنتائج العامة (`result_cache`) مع لوحة مراقبة إدارية بسيطة.

### المسارات F, G, H, I, J
- **F:** تقسيم التقييمات إلى `evals/dev` و`evals/holdout` (مع أداة استيراد CSV وإعادة صياغة باللهجات والأخطاء الإملائية والأسئلة المركبة) و`evals/adversarial` (20+ حالة حقن تعليمات وطلبات متنكرة ومصادر وهمية)، وإضافة إدارة الحالات للخبراء وفصل التقارير وبوابة الدمج.
- **G:** `env.ts` الصارم، وترحيلات `drizzle/` المتعقبة (`npm run db:migrate`)، وسياسات PostgreSQL `ROW LEVEL SECURITY` عبر `SET LOCAL app.user_uid / app.org_id`، وسجلات JSON منظمة بـ `pino` وتنقية PII ودعم Sentry الاختياري، و`/healthz` و`/readyz` و`SIGTERM`، ومهمة الاحتفاظ المجدولة (`retention.ts`)، و`docs/runbook.md`.
- **I:** التحقق من اكتمال إلغاء المشاركة، وقبول الدعوات، وتصدير/حذف واسترجاع الحساب خلال 14 يوماً، وإيقاف اقتراحات الخبراء عبر كل المسارات، وطابور البلاغات المرتبط بـ `ruleIds`، وتنبيه القواعد المستحقة للمراجعة (`review_due_at`)، وسجل التدقيق الشامل، ومطابقة 100% لمفاتيح `message_key` في `ar.json` و`en.json`.
- **H & J:** اختبارات الوحدة، واختبارات التكامل (بما فيها 19 اختبار انحدار أمني ومصفوفة العزل الآلية)، والرحلات العشر E2E بالعربية والإنجليزية على `375px` و`1440px`، وفحص الوصول `axe`، وملف `.github/workflows/ci.yml` و`dependabot.yml`، وتحديث كافة الوثائق والتقرير الختامي `docs/reports/fix-round-1.md`.

---

## 3. المخاطر وضوابط التخفيف

1. **كسر بيئة المعاينة التفاعلية أثناء تشديد الأمان (CSP / MFA / Demo Login):**
   - *التخفيف:* تُضبط الإعدادات الافتراضية للإنتاج بأقصى تشدد (`frame-ancestors 'none'`, رفض `demo-login` و`mock` وفرض `MFA`)، بينما تعمل بيئة التطوير المحلية بأعلام صريحة وموثقة في `.env.local` و`.env.example`، وتُختبر الحالتان (الإنتاج الصارم والتطوير) آلياً في اختبارات الانحدار.
2. **اتصال قاعدة البيانات وسياسات RLS مع حوض الاتصالات (`pg.Pool`):**
   - *التخفيف:* استخدام معاملات `db.transaction` مع `SET LOCAL app.user_uid = ...; SET LOCAL app.org_id = ...;` بحيث تبقى المتغيرات محصورة داخل المعاملة ولا تتسرب أبداً بين الطلبات المتزامنة في حوض الاتصالات، وتوثيق بنية المستخدم المزدوج (مستخدم تطبيق بلا `BYPASSRLS` مقابل مستخدم الترحيلات) في `ADR-003`.
3. **أبعاد متجهات `pgvector` عند التبديل بين المزود الوهمي والحقيقي:**
   - *التخفيف:* توحيد بُعد المتجه على `768` (`outputDimensionality: 768` لنموذج `gemini-embedding-2` ومثيله في `lexicalHashVector` المخصص لوضع `mock` فقط) مع توثيق البُعد وأمر `npm run kb:reindex` عند تغيير النموذج.
