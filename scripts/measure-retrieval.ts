// Offline retrieval check (no DB): ranks SEED rules for the golden dev cases, with and without the Arab pack.
import fs from 'node:fs';
import { SEED_KNOWLEDGE_RULES } from '../src/db/seed-data.ts';
import { analyzeIntentAndContextPure } from '../src/server/ai/pipeline.ts';
import { scoreRulesPure } from '../src/server/knowledge/retrieval.ts';

const mk = (rules: typeof SEED_KNOWLEDGE_RULES) =>
  rules.map((r) => ({ ...r, status: 'approved', sources: r.sources }));
const withArab = mk(SEED_KNOWLEDGE_RULES);
const base = mk(SEED_KNOWLEDGE_RULES.filter((r) => !r.id.startsWith('R-ARAB')));

for (const f of process.argv.slice(2)) {
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => (r.expectedRuleIds ?? []).length);
  const run = (rules: typeof withArab) => {
    let hit = 0, total = 0;
    for (const r of rows) {
      const e = analyzeIntentAndContextPure(r.queryText);
      const top = scoreRulesPure(rules as never, { query: r.queryText, locale: r.locale ?? 'ar', intent: e.intent, countryIso: e.countryIso, topK: 10 });
      const ids = new Set(top.map((t) => t.id));
      for (const id of r.expectedRuleIds) { total++; if (ids.has(id)) hit++; }
    }
    return ((hit / total) * 100).toFixed(1);
  };
  console.log(`${f}: recall@10 base=${run(base)}% with-arab=${run(withArab)}% (n=${rows.length})`);
}
