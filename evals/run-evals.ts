import fs from 'node:fs';
import path from 'node:path';
import { SEED_EVAL_CASES, SEED_KNOWLEDGE_RULES } from '../src/db/seed-data.ts';
import {
  analyzeIntentAndContextPure,
  executeWijahaPipeline,
} from '../src/server/ai/pipeline.ts';
import { scoreRulesPure } from '../src/server/knowledge/retrieval.ts';
import { WijahaResultSchema, type Locale } from '../src/shared/types.ts';

async function runGoldenEvals() {
  const goldenDir = path.resolve(process.cwd(), 'evals/golden');
  fs.mkdirSync(goldenDir, { recursive: true });
  const jsonlPath = path.join(goldenDir, 'demo-60.jsonl');
  if (!fs.existsSync(jsonlPath)) {
    fs.writeFileSync(
      jsonlPath,
      SEED_EVAL_CASES.map((c) => JSON.stringify({ ...c, demo: true })).join('\n') + '\n',
      'utf8',
    );
  }

  const validIds = new Set(SEED_KNOWLEDGE_RULES.map((r) => r.id));
  let intentHits = 0;
  let recallHits = 0;
  let recallDenominator = 0;
  let schemaPasses = 0;
  let highSensitivityTotal = 0;
  let highSensitivityHits = 0;
  let hallucinatedRuleIds = 0;

  for (const testCase of SEED_EVAL_CASES) {
    const entities = analyzeIntentAndContextPure(testCase.queryText);
    if (entities.intent === testCase.expectedIntent) {
      intentHits += 1;
    } else {
      console.warn(
        `[Intent mismatch] ${testCase.id}: expected=${testCase.expectedIntent} actual=${entities.intent} ("${testCase.queryText}")`,
      );
    }

    const retrieved = scoreRulesPure(SEED_KNOWLEDGE_RULES, {
      query: testCase.queryText,
      locale: testCase.locale as Locale,
      intent: entities.intent,
      countryIso: entities.countryIso,
      topK: 10,
    });

    if (testCase.expectedRuleIds.length > 0) {
      recallDenominator += 1;
      const retSet = new Set(retrieved.map((r) => r.id));
      if (testCase.expectedRuleIds.some((id) => retSet.has(id))) {
        recallHits += 1;
      } else {
        console.warn(`[Recall miss] ${testCase.id}: expected one of ${testCase.expectedRuleIds.join(',')}`);
      }
    }

    const result = await executeWijahaPipeline({
      rawQuery: testCase.queryText,
      locale: testCase.locale as Locale,
      retrievedRules: retrieved,
      entities,
    });

    if (WijahaResultSchema.safeParse(result).success) {
      schemaPasses += 1;
    }

    for (const rId of result.trust.ruleIds) {
      if (!validIds.has(rId)) {
        hallucinatedRuleIds += 1;
      }
    }

    if (testCase.expectedSensitivity === 'high') {
      highSensitivityTotal += 1;
      if (result.blocks.some((b) => b.type === 'expert_review')) {
        highSensitivityHits += 1;
      }
    }
  }

  const total = SEED_EVAL_CASES.length;
  const intentAcc = Number(((intentHits / total) * 100).toFixed(1));
  const recallAt10 = Number(((recallHits / Math.max(1, recallDenominator)) * 100).toFixed(1));
  const schemaPct = Number(((schemaPasses / total) * 100).toFixed(1));
  const highSensPct = Number(
    ((highSensitivityHits / Math.max(1, highSensitivityTotal)) * 100).toFixed(1),
  );

  const summary = {
    totalCases: total,
    gulfDialectCases: SEED_EVAL_CASES.filter((c) => c.dialect === 'gulf').length,
    intentAccuracyPct: intentAcc,
    recallAt10Pct: recallAt10,
    schemaCompliancePct: schemaPct,
    highSensitivityExpertReviewPct: highSensPct,
    hallucinatedRuleIds,
  };

  console.log('WIJAHA Golden Evals Summary (60 Demo Cases):');
  console.table(summary);

  // Release Gate Assertions (Section 13.2)
  if (
    hallucinatedRuleIds !== 0 ||
    intentAcc < 90 ||
    recallAt10 < 85 ||
    schemaPct < 100 ||
    highSensPct < 100
  ) {
    console.error('EVALS RELEASE GATE FAILED');
    process.exit(1);
  }
  console.log('ALL SECTION 13.2 EVAL GATE THRESHOLDS PASSED.');
}

runGoldenEvals().catch((err) => {
  console.error(err);
  process.exit(1);
});
