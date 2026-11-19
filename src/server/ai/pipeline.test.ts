import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_KNOWLEDGE_RULES } from '../../db/seed-data';
import {
  analyzeIntentAndContextPure,
  applyNaturalProjectUpdatePure,
  auditVisitPlanPure,
  executeWijahaPipeline,
  verifyAndHardenResultPure,
} from './pipeline';
import { scoreRulesPure } from '../knowledge/retrieval';

test('verifyAndHardenResultPure strips hallucinated ruleIds and marks them advisory', () => {
  const retrieved = scoreRulesPure(SEED_KNOWLEDGE_RULES, {
    query: 'عشاء رسمي',
    locale: 'ar',
    intent: 'dining_etiquette',
  });

  const fakeDraft = {
    id: 'res_test_1',
    locale: 'ar' as const,
    title: 'اختبار التحقق الصارم',
    intent: 'dining_etiquette' as const,
    context: [],
    assumptions: [],
    summary: ['نقطة أولى'],
    blocks: [
      {
        type: 'answer' as const,
        points: [
          { text: 'نقطة موثقة', ruleId: retrieved[0].id, level: 'customary' as const },
          { text: 'نقطة برقم مختلق غير موجود', ruleId: 'R-FAKE-9999', level: 'official' as const },
        ],
      },
    ],
    primaryAction: { id: 'export_pdf' as const, label: 'حمّل الخطة' },
    secondaryActions: [],
    trust: {
      ruleIds: ['R-FAKE-9999'],
      reviewedCount: 5,
      demoCount: 0,
      unreviewedClaims: 0,
      sensitivity: 'low' as const,
    },
  };

  const hardened = verifyAndHardenResultPure(fakeDraft, retrieved);
  assert.equal(hardened.trust.ruleIds.includes('R-FAKE-9999'), false);
  assert.equal(hardened.trust.ruleIds.includes(retrieved[0].id), true);
  assert.equal(hardened.trust.unreviewedClaims, 1);
  if (hardened.blocks[0].type === 'answer') {
    assert.equal(hardened.blocks[0].points[1].ruleId, undefined);
    assert.equal(hardened.blocks[0].points[1].level, 'advisory');
  }
});

test('high-sensitivity government queries automatically include expert_review block and max 1 clarification', async () => {
  const q = 'جهز خطة استقبال وفد حكومي رفيع المستوى برئاسة وزير';
  const entities = analyzeIntentAndContextPure(q);
  assert.equal(entities.sensitivity, 'high');

  const retrieved = scoreRulesPure(SEED_KNOWLEDGE_RULES, {
    query: q,
    locale: 'ar',
    intent: entities.intent,
  });
  const res = await executeWijahaPipeline({
    rawQuery: q,
    locale: 'ar',
    retrievedRules: retrieved,
    entities,
  });

  assert.equal(res.blocks.some((b) => b.type === 'expert_review'), true);
  assert.equal(Boolean(res.expertSuggestion), true);
  assert.equal(res.summary.length <= 3, true);
});

test('applyNaturalProjectUpdatePure updates guest count and timeline and emits diffSummary', async () => {
  const q = 'عندنا وفد أكاديمي من بولندا لتوقيع مذكرة تفاهم';
  const entities = analyzeIntentAndContextPure(q);
  const retrieved = scoreRulesPure(SEED_KNOWLEDGE_RULES, {
    query: q,
    locale: 'ar',
    intent: entities.intent,
    countryIso: entities.countryIso,
  });
  const initial = await executeWijahaPipeline({
    rawQuery: q,
    locale: 'ar',
    retrievedRules: retrieved,
    entities,
  });

  const { updated, diffSummary } = applyNaturalProjectUpdatePure(
    initial,
    'زاد الوفد إلى 12 شخصاً وتأجل الموعد يوماً',
    'ar',
  );
  assert.equal(diffSummary.length >= 2, true);
  assert.equal(
    updated.context.some((c) => c.label.includes('12')),
    true,
  );
});

test('auditVisitPlanPure flags missing arrival buffer and ministerial gift risks without altering input', () => {
  const audit = auditVisitPlanPure(
    'الساعة 10:00 وصول الوزير الضيف وتوقيع المذكرة فوراً وتقديم هدية شخصية أمام الصحافة',
    undefined,
    'ar',
  );
  assert.equal(audit.findings.some((f) => f.severity === 'critical'), true);
  assert.equal(audit.findings.length >= 3, true);
});
