import 'dotenv/config';
import { isNull } from 'drizzle-orm';
import { db } from './index.ts';
import { knowledgeRules } from './schema.ts';
import { embedAndStoreRule } from '../server/knowledge/retrieval.ts';

/** E2: (re)build semantic embeddings. Usage: npm run kb:reindex [-- --all] */
async function main() {
  const all = process.argv.includes('--all');
  const rows = all
    ? await db.select().from(knowledgeRules)
    : await db.select().from(knowledgeRules).where(isNull(knowledgeRules.embeddingVec));
  let done = 0;
  for (const r of rows) {
    const ok = await embedAndStoreRule(r);
    if (!ok) {
      console.error('No live embedding provider configured (AI_PROVIDER=gemini + GEMINI_API_KEY). Nothing indexed.');
      process.exit(1);
    }
    done += 1;
  }
  console.log(`Indexed ${done} rule(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
