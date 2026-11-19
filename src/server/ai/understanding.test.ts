import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIntentAndContextPure } from './pipeline.ts';
import { mergeUnderstandingPure, normalizeNumerals } from './understanding.ts';
import { allowedRuleStatuses, fuseRankingsPure, type RetrievedRule } from '../knowledge/retrieval.ts';

test('E1: Arabic-Indic digits and number words become extractable counts', () => {
  assert.equal(normalizeNumerals('وفد من ٨ أشخاص'), 'وفد من 8 أشخاص');
  assert.equal(normalizeNumerals('عندنا عشرين ضيف'), 'عندنا 20 ضيف');
  assert.equal(analyzeIntentAndContextPure(normalizeNumerals('نستقبل ١٢ ضيفاً في المطعم')).guestCount, 12);
});

test('E1: model can refine intent but never lower sensitivity or override out-of-scope', () => {
  const rules = analyzeIntentAndContextPure('استقبال وزير الخارجية');
  assert.equal(rules.sensitivity, 'high');
  const merged = mergeUnderstandingPure(rules, { intent: 'delegation_visit_host', sensitivity: 'low', confidence: 0.9 });
  assert.equal(merged.sensitivity, 'high');
  assert.equal(merged.intent, 'delegation_visit_host');
  assert.equal(merged.understoodBy, 'model');

  const oos = analyzeIntentAndContextPure('كم سعر الذهب اليوم');
  assert.equal(mergeUnderstandingPure(oos, { intent: 'dining_etiquette', sensitivity: 'low', confidence: 0.99 }).intent, 'out_of_scope');

  const low = mergeUnderstandingPure(rules, { intent: 'dining_etiquette', sensitivity: 'low', confidence: 0.2 });
  assert.equal(low.understoodBy, 'rules');
});

test('E2: reciprocal rank fusion promotes rules found by both rankings', () => {
  const mk = (id: string) => ({ id } as unknown as RetrievedRule);
  const fused = fuseRankingsPure([mk('A'), mk('B'), mk('C')], ['C'], 3);
  assert.deepEqual(fused.map((r) => r.id), ['C', 'A', 'B']);
});

test('E2: production retrieval excludes demo rules unless explicitly allowed', () => {
  const prev = { ...process.env };
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_DEMO_RULES;
  assert.deepEqual(allowedRuleStatuses(), ['approved']);
  process.env.ALLOW_DEMO_RULES = 'true';
  assert.deepEqual(allowedRuleStatuses(), ['approved', 'draft_demo']);
  process.env = prev;
});
