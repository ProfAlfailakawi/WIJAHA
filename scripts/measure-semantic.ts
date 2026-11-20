// Offline benchmark: lexical ranking vs lexical+semantic (RRF). Needs a Vertex token: VERTEX_ACCESS_TOKEN.
// Usage: AI_EMBED_PROVIDER=vertex VERTEX_PROJECT=<id> VERTEX_ACCESS_TOKEN=$(gcloud auth print-access-token) npx tsx scripts/measure-semantic.ts <jsonl...>
import fs from 'node:fs';
import { SEED_KNOWLEDGE_RULES } from '../src/db/seed-data.ts';
import { analyzeIntentAndContextPure } from '../src/server/ai/pipeline.ts';
import { embedTexts } from '../src/server/ai/provider.ts';
import { cosineSimilarity } from '../src/shared/arabic.ts';
import { fuseRankingsPure, scoreRulesPure } from '../src/server/knowledge/retrieval.ts';

const eligible = SEED_KNOWLEDGE_RULES.map((r) => ({ ...r }));
const docVecs = await embedTexts(eligible.map((r) => `${r.titleAr}\n${r.bodyAr}\n${r.titleEn}\n${r.bodyEn}`), 'document');
if (!docVecs) throw new Error('no embedding provider');

for (const f of process.argv.slice(2)) {
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => (r.expectedRuleIds ?? []).length);
  const qVecs = (await embedTexts(rows.map((r) => r.queryText), 'query'))!;
  const m = { lex: { hit: 0, mrr: 0 }, sem: { hit: 0, mrr: 0 }, fused: { hit: 0, mrr: 0 } };
  rows.forEach((r, qi) => {
    const e = analyzeIntentAndContextPure(r.queryText);
    const base = { query: r.queryText, locale: r.locale ?? 'ar', intent: e.intent, countryIso: e.countryIso };
    const full = scoreRulesPure(eligible as never, { ...base, topK: eligible.length });
    const sem = eligible
      .map((rule, i) => ({ id: rule.id, s: cosineSimilarity(qVecs[qi], docVecs[i]) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 20)
      .map((x) => x.id);
    const lex10 = full.slice(0, 10);
    const fused10 = fuseRankingsPure(full, sem, 10);
    for (const [name, ids] of [['lex', lex10.map((x) => x.id)], ['sem', sem.slice(0, 10)], ['fused', fused10.map((x) => x.id)]] as const) {
      const rank = ids.findIndex((id) => r.expectedRuleIds.includes(id));
      if (rank >= 0) { m[name].hit += 1; m[name].mrr += 1 / (rank + 1); }
    }
  });
  const n = rows.length;
  const p = (x: number) => ((x / n) * 100).toFixed(1);
  console.log(`${f.split('/').pop()}: n=${n} | lexical recall@10=${p(m.lex.hit)}% MRR=${(m.lex.mrr / n).toFixed(3)} | semantic-only recall@10=${p(m.sem.hit)}% MRR=${(m.sem.mrr / n).toFixed(3)} | fused recall@10=${p(m.fused.hit)}% MRR=${(m.fused.mrr / n).toFixed(3)}`);
}
