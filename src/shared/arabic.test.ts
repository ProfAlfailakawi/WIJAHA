import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAND } from '../config/brand';
import {
  calculateContrastRatio,
  computeDeterministicEmbedding,
  cosineSimilarity,
  expandQueryWithSynonyms,
  normalizeArabic,
} from './arabic';

test('normalizeArabic strips diacritics and unifies hamza/taa marbuta/alef maqsura', () => {
  const raw = 'مَأْدُبَةُ عَشَاءٍ رَسْمِيَّةٌ فِي أُورُوبَّا وَمُوسْكُو إلى مَتَى';
  const norm = normalizeArabic(raw);
  assert.equal(norm.includes('ة'), false);
  assert.equal(norm.includes('أ'), false);
  assert.equal(norm.includes('إ'), false);
  assert.equal(norm.includes('ى'), false);
  assert.equal(norm, 'مادبه عشاء رسميه في اوروبا وموسكو الي متي');
});

test('expandQueryWithSynonyms detects Gulf dialect and expands hospitality terms', () => {
  const out = expandQueryWithSynonyms('عندنا عزيمة باجر بالمطعم، شلون أتصرف؟');
  assert.equal(out.detectedDialect, 'gulf');
  assert.equal(out.expandedTokens.includes('ضيافه'), true);
  assert.equal(out.expandedTokens.includes('غدا'), true);
});

test('deterministic embeddings give higher similarity to related protocol rules than unrelated text', () => {
  const v1 = computeDeterministicEmbedding('ترتيب الجلوس والأسبقية على الطاولة الدائرية للمضيف');
  const v2 = computeDeterministicEmbedding('مخطط الجلوس ومقعد ضيف الشرف يمين المضيف على الطاولة');
  const v3 = computeDeterministicEmbedding('تأشيرات السفر وحقيبة الملابس الشتوية الثقيلة');
  assert.equal(cosineSimilarity(v1, v2) > cosineSimilarity(v1, v3), true);
});

test('Quiet Luxury light and dark mode design tokens pass WCAG 2.2 AA contrast ratios (>= 4.5:1)', () => {
  const { light, dark } = BRAND.tokens;
  assert.equal(calculateContrastRatio(light.ink, light.bg) >= 12, true);
  assert.equal(calculateContrastRatio(light.ink2, light.bg) >= 7, true);
  assert.equal(calculateContrastRatio(light.ink3, light.bg) >= 4.5, true);
  assert.equal(calculateContrastRatio(light.goldInk, light.bg) >= 4.5, true);

  assert.equal(calculateContrastRatio(dark.ink, dark.bg) >= 12, true);
  assert.equal(calculateContrastRatio(dark.ink2, dark.bg) >= 7, true);
  assert.equal(calculateContrastRatio(dark.ink3, dark.bg) >= 4.5, true);
});
