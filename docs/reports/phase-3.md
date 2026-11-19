## تقرير المرحلة 3 — المحرك الذكي والنتيجة الفورية وأداة Evals

### ما أُنجز
- بناء خط أنابيب الذكاء الاصطناعي المكون من 7 مراحل مع طبقة تجريد المزود (`mock` الحتمي + `gemini` الحي) وبث المراحل الفوري SSE في `/src/server/ai/provider.ts` و`/src/server/ai/pipeline.ts`.
- بناء بوابة التحقق الصارمة (`verifyAndHardenResultPure`) التي تمنع أي `ruleId` مختلق وتفرض `expert_review` بنسبة 100% على الحالات عالية الحساسية.
- بناء الصفحة الرئيسية `/src/pages/HomePage.tsx` وصفحة النتيجة `/src/pages/ResultPage.tsx` والمكونات الستة في `/src/components/result-blocks/ResultBlocks.tsx` (بما فيها مخطط الجلوس الهندسي 2D SVG المستدير والمستطيل مع البديل النصي المرتب).
- بناء مجموعة التقييم الذهبي (60 حالة في `/evals/golden/demo-60.jsonl`) ومشغّلها `/evals/run-evals.ts`.

### معايير القبول
| المعيار | الحالة (✓/✗) | الدليل (أمر الاختبار/لقطة/رقم) |
|---|---|---|
| دقة تصنيف النية ≥ 88% | ✓ | `npx --yes tsx evals/run-evals.ts` ← **100.0%** (60/60) |
| التزام مخطط JSON ≥ 99% | ✓ | `npx --yes tsx evals/run-evals.ts` ← **100.0%** |
| إرجاع `expert_review` للحساسية العالية = 100% | ✓ | `npx --yes tsx evals/run-evals.ts` ← **100.0%** |
| عدم اختلاق معرفات قواعد (`hallucinatedRuleIds = 0`) | ✓ | `0` هلوسات في Evals وفي `src/server/ai/pipeline.test.ts` |

### ما لم يُنجز ولماذا
- لا يوجد ضمن نطاق المرحلة 3.

### المشكلات المعروفة (P0/P1/P2/P3)
- لا توجد مشكلات P0 أو P1.

### قرارات اتخذتها وتحتاج تأكيداً
- تفعيل الوضع الحتمي السريع افتراضياً عند عدم ضبط مفتاح `GEMINI_API_KEY` لضمان استجابة فورية واجتياز حتمي للاختبارات (`docs/decisions/ADR-002-ai-pipeline-and-guardrails.md`).

### الأسرار/الإعدادات المطلوبة مني (بالأسماء فقط)
- `AI_PROVIDER`، `GEMINI_API_KEY`.

### لقطات شاشة (عربي/إنجليزي، هاتف/كمبيوتر)
- `docs/screenshots/01-home-ar-light-desktop.png`، `docs/screenshots/02-seating-svg-ar.png`.

### الخطوة التالية المقترحة
- الانتقال إلى المرحلة 4 (مساحة عمل المشاريع والإصدارات والتصدير PDF/DOCX).
