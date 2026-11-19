import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { seedDemoData, seedReferenceData } from './seed.ts';
import { SEED_EVAL_CASES } from './seed-data.ts';

dotenv.config();

async function main() {
  const isProd = process.env.NODE_ENV === 'production';
  const allowProdSeed = process.argv.includes('--allow-production-seed');

  if (isProd && !allowProdSeed) {
    console.error(
      'Refusing to run db:seed with NODE_ENV=production. Pass --allow-production-seed to seed reference catalog data only (demo users/orgs are never seeded in production).',
    );
    process.exit(1);
  }

  await seedReferenceData();

  if (!isProd) {
    await seedDemoData();
    const goldenDir = path.resolve(process.cwd(), 'evals/golden');
    fs.mkdirSync(goldenDir, { recursive: true });
    const jsonlPath = path.join(goldenDir, 'demo-60.jsonl');
    const lines = SEED_EVAL_CASES.map((c) => JSON.stringify({ ...c, demo: true })).join('\n') + '\n';
    fs.writeFileSync(jsonlPath, lines, 'utf8');
    console.log(
      `Seeded reference + demo data & wrote ${SEED_EVAL_CASES.length} golden cases to evals/golden/demo-60.jsonl`,
    );
  } else {
    console.log('Seeded reference catalog data only (production mode — zero demo users/orgs).');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
