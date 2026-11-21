// Measures intent + sensitivity accuracy of the deterministic analyzer (no DB needed).
import fs from 'node:fs';
import { analyzeIntentAndContextPure } from '../src/server/ai/pipeline.ts';

const files = process.argv.slice(2);
const verbose = process.env.VERBOSE === '1';
for (const f of files) {
  const rows = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  let okI = 0, okS = 0;
  for (const r of rows) {
    const got = analyzeIntentAndContextPure(r.queryText);
    const i = got.intent === r.expectedIntent;
    const s = got.sensitivity === r.expectedSensitivity;
    if (i) okI++;
    if (s) okS++;
    if (verbose && !(i && s)) console.log(`  ✗ ${r.id} want ${r.expectedIntent}/${r.expectedSensitivity} got ${got.intent}/${got.sensitivity} :: ${r.queryText.slice(0, 80)}`);
  }
  console.log(`${f}: n=${rows.length} intent=${((okI / rows.length) * 100).toFixed(1)}% sensitivity=${((okS / rows.length) * 100).toFixed(1)}%`);
}
