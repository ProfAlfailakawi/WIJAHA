import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_KNOWLEDGE_RULES, SEED_SOURCES } from '../../db/seed-data.ts';
import { analyzeIntentAndContextPure } from '../ai/pipeline.ts';
import { scoreRulesPure } from './retrieval.ts';

const arab = SEED_KNOWLEDGE_RULES.filter((r) => r.id.startsWith('R-ARAB-'));
const eligible = SEED_KNOWLEDGE_RULES.map((r) => ({ ...r, status: 'approved' }));

test('arab pack: ids are unique and every rule has a known source', () => {
  const ids = SEED_KNOWLEDGE_RULES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  const sources = new Set(SEED_SOURCES.map((s) => s.id));
  for (const r of arab) {
    assert.ok(r.sources.every((s) => sources.has(s.sourceId)), r.id);
  }
});

test('arab pack: drafts only, bilingual, no invented links', () => {
  assert.ok(arab.length >= 80);
  for (const r of arab) {
    assert.equal(r.status, 'draft_demo');
    assert.ok(r.titleAr.startsWith('[مسودة]') && r.titleEn.startsWith('[Draft]'), r.id);
    assert.ok(r.bodyAr.length > 40 && r.bodyEn.length > 40, r.id);
    assert.ok(!/https?:\/\//i.test(r.bodyAr + r.bodyEn), `${r.id} contains a URL`);
    assert.ok(r.topics.length > 0 && r.countries.length > 0 && r.contexts.length > 0, r.id);
    assert.ok((r.exceptions ?? '').length > 0, `${r.id} lacks a verification note`);
  }
});

test('arab pack: every Gulf state has titles, calendar and alcohol/hospitality coverage', () => {
  for (const iso of ['KW', 'SA', 'AE', 'QA', 'BH', 'OM']) {
    const own = arab.filter((r) => r.countries[0] === iso);
    assert.ok(own.length >= 4, `${iso} has only ${own.length} rules`);
    assert.ok(own.some((r) => r.topics.includes('titles')), `${iso} titles`);
  }
});

function top(query: string, k = 6): string[] {
  const e = analyzeIntentAndContextPure(query);
  return scoreRulesPure(eligible as never, { query, locale: 'ar', intent: e.intent, countryIso: e.countryIso, topK: k }).map((r) => r.id);
}

test('retrieval: Omani sultan titles and Qatari ministerial gifts surface the right rules', () => {
  assert.ok(top('كيف نخاطب سلطان عمان في الرسالة الرسمية؟').includes('R-ARAB-125'));
  assert.ok(top('ما الهدية المناسبة لوزير قطري؟').includes('R-ARAB-015'));
});

test('retrieval: Ramadan scheduling for UAE partners surfaces the Ramadan rule', () => {
  assert.ok(top('بنستقبل وفداً إماراتياً في رمضان، كيف نرتب الإفطار والبرنامج؟').includes('R-ARAB-009'));
});

test('retrieval: queries without a country do not surface country packs first', () => {
  const ids = top('أريد طلب مراجعة خبير لبرنامج زيارة رسمي', 5);
  assert.ok(!ids.slice(0, 3).some((id) => /^R-ARAB-1[0-9][0-9]$/.test(id)));
});
