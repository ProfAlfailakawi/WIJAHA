import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { ensureSeeded } from './seed.ts';
import { SEED_EVAL_CASES } from './seed-data.ts';

dotenv.config();

async function main() {
  await ensureSeeded();
  const goldenDir = path.resolve(process.cwd(), 'evals/golden');
  fs.mkdirSync(goldenDir, { recursive: true });
  const jsonlPath = path.join(goldenDir, 'demo-60.jsonl');
  const lines = SEED_EVAL_CASES.map((c) => JSON.stringify({ ...c, demo: true })).join('\n') + '\n';
  fs.writeFileSync(jsonlPath, lines, 'utf8');
  console.log(`Seeded Cloud SQL PostgreSQL & wrote ${SEED_EVAL_CASES.length} golden cases to evals/golden/demo-60.jsonl`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
