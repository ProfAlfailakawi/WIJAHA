import { SEED_KNOWLEDGE_RULES } from '../src/db/seed-data.ts';
import { analyzeIntentAndContextPure } from '../src/server/ai/pipeline.ts';
import { scoreRulesPure } from '../src/server/knowledge/retrieval.ts';
const all = SEED_KNOWLEDGE_RULES.map((r) => ({ ...r, status: 'approved' }));
for (const q of process.argv.slice(2)) {
  const e = analyzeIntentAndContextPure(q);
  const t = scoreRulesPure(all as never, { query: q, locale: /[؀-ۿ]/.test(q) ? 'ar' : 'en', intent: e.intent, countryIso: e.countryIso, topK: 5 });
  console.log(`\n» ${q}\n  intent=${e.intent} country=${e.countryIso} sens=${e.sensitivity}`);
  t.forEach((x) => console.log(`   ${x.id} ${x.score.toFixed(1)} ${x.titleAr.slice(0, 55)}`));
}
