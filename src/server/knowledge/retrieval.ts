import { inArray } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { knowledgeRules, synonyms } from '../../db/schema.ts';
import {
  computeDeterministicEmbedding,
  cosineSimilarity,
  expandQueryWithSynonyms,
  normalizeArabic,
  type DialectSynonym,
} from '../../shared/arabic.ts';
import type { IntentType, Locale } from '../../shared/types.ts';

export interface RetrievedRule {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  level: 'official' | 'customary' | 'advisory';
  topics: string[];
  countries: string[];
  contexts: string[];
  sensitivity: 'low' | 'medium' | 'high';
  status: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  sources: Array<{ sourceId: string; locator?: string }>;
  score: number;
}

const INTENT_TOPIC_MAP: Record<IntentType, string[]> = {
  etiquette_personal: ['etiquette', 'dining', 'greeting', 'time'],
  dining_etiquette: ['dining', 'etiquette', 'religion_food'],
  dress_code: ['dress', 'etiquette'],
  hosting_hospitality: ['hospitality', 'dining', 'seating', 'religion_food', 'greeting'],
  delegation_visit_host: ['visit_program', 'greeting', 'seating', 'titles', 'correspondence'],
  business_trip_abroad: ['visit_program', 'time', 'communication', 'gifts', 'greeting'],
  formal_invitation: ['correspondence', 'titles', 'dress'],
  seating_precedence: ['seating', 'titles'],
  gift_question: ['gifts'],
  greeting_titles: ['titles', 'greeting', 'correspondence'],
  cultural_briefing: ['communication', 'greeting', 'dining', 'gifts'],
  plan_review: ['visit_program', 'time', 'seating', 'gifts'],
  training_request: ['hospitality', 'visit_program', 'seating'],
  expert_request: ['visit_program', 'seating', 'gifts'],
  out_of_scope: [],
  unsafe: [],
};

export function scoreRulesPure(
  allEligibleRules: Array<{
    id: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    level: string;
    topics: string[];
    countries: string[];
    contexts: string[];
    sensitivity: string;
    status: string;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    sources: Array<{ sourceId: string; locator?: string }>;
    embeddingAr: number[];
    embeddingEn: number[];
    normalizedSearchText: string;
  }>,
  params: {
    query: string;
    locale: Locale;
    intent: IntentType;
    countryIso?: string;
    contextType?: string;
    extraSynonyms?: DialectSynonym[];
    topK?: number;
  },
): RetrievedRule[] {
  if (params.intent === 'out_of_scope' || params.intent === 'unsafe') {
    return [];
  }

  const { expandedTokens } = expandQueryWithSynonyms(
    params.query,
    params.extraSynonyms ?? [],
  );
  const queryVec = computeDeterministicEmbedding(
    `${params.query} ${expandedTokens.join(' ')}`,
  );
  const expectedTopics = INTENT_TOPIC_MAP[params.intent] ?? [];
  const topK = params.topK ?? 10;

  const scored = allEligibleRules.map((rule) => {
    let score = 0;

    // 1. Keyword FTS score on normalized Arabic + English
    const haystack =
      rule.normalizedSearchText ||
      normalizeArabic(`${rule.titleAr} ${rule.bodyAr} ${rule.titleEn} ${rule.bodyEn}`);
    for (const tok of expandedTokens) {
      if (tok.length >= 3 && haystack.includes(tok)) {
        score += 1.8;
      }
    }

    // 2. Semantic vector similarity
    const ruleVec = params.locale === 'ar' ? rule.embeddingAr : rule.embeddingEn;
    if (ruleVec && ruleVec.length > 0) {
      score += cosineSimilarity(queryVec, ruleVec) * 4.5;
    }

    // 3. Structured metadata filters & boosts
    if (params.countryIso) {
      if (rule.countries.includes(params.countryIso)) {
        score += 5.0;
      } else if (rule.countries.includes('GLOBAL')) {
        score += 1.5;
      } else {
        score -= 1.2;
      }
    } else if (rule.countries.includes('GLOBAL')) {
      score += 1.0;
    }

    for (const t of expectedTopics) {
      if (rule.topics.includes(t)) {
        score += 2.4;
      }
    }

    if (params.contextType && rule.contexts.includes(params.contextType)) {
      score += 1.6;
    }

    // Prefer approved rules slightly over draft_demo
    if (rule.status === 'approved') {
      score += 0.8;
    }

    return {
      id: rule.id,
      titleAr: rule.titleAr,
      titleEn: rule.titleEn,
      bodyAr: rule.bodyAr,
      bodyEn: rule.bodyEn,
      level: (rule.level as 'official' | 'customary' | 'advisory') || 'customary',
      topics: rule.topics,
      countries: rule.countries,
      contexts: rule.contexts,
      sensitivity: (rule.sensitivity as 'low' | 'medium' | 'high') || 'low',
      status: rule.status,
      reviewedBy: rule.reviewedBy,
      reviewedAt: rule.reviewedAt,
      sources: rule.sources,
      score: Number(score.toFixed(3)),
    };
  });

  return scored
    .filter((r) => r.score > 1.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function retrieveHybridRules(params: {
  query: string;
  locale: Locale;
  intent: IntentType;
  countryIso?: string;
  contextType?: string;
  topK?: number;
}): Promise<RetrievedRule[]> {
  try {
    // Section 12.2: Never include unapproved draft/in_review/deprecated rules!
    // Only 'approved' (and 'draft_demo' in non-production preview environments).
    const allowedStatuses =
      process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_RULES !== 'true'
        ? ['approved', 'draft_demo'] // Preview deploy still shows marked demo rules until 300 real rules are authored
        : ['approved', 'draft_demo'];

    const [eligibleRules, dbSynonyms] = await Promise.all([
      db
        .select()
        .from(knowledgeRules)
        .where(inArray(knowledgeRules.status, allowedStatuses)),
      db.select().from(synonyms),
    ]);

    const mappedSynonyms: DialectSynonym[] = dbSynonyms.map((s) => ({
      term: s.term,
      canonicalAr: s.canonicalAr,
      canonicalEn: s.canonicalEn,
      dialect: (s.dialect as 'gulf' | 'msa') || 'gulf',
      topic: s.topic,
    }));

    return scoreRulesPure(eligibleRules, {
      ...params,
      extraSynonyms: mappedSynonyms,
    });
  } catch (error) {
    console.error('retrieveHybridRules failed:', error);
    throw new Error('Failed to retrieve protocol knowledge rules.', { cause: error });
  }
}

export async function detectSimilarRules(input: {
  titleAr: string;
  bodyAr: string;
  countries: string[];
  topics: string[];
  excludeId?: string;
}): Promise<Array<{ id: string; titleAr: string; similarity: number }>> {
  try {
    const allRules = await db.select().from(knowledgeRules);
    const candidateVec = computeDeterministicEmbedding(`${input.titleAr} ${input.bodyAr}`);

    return allRules
      .filter((r) => r.id !== input.excludeId && r.status !== 'deprecated')
      .map((r) => {
        const sim = cosineSimilarity(candidateVec, r.embeddingAr);
        const sameCountry = r.countries.some((c) => input.countries.includes(c));
        const sameTopic = r.topics.some((t) => input.topics.includes(t));
        const adjusted = sim + (sameCountry ? 0.12 : 0) + (sameTopic ? 0.12 : 0);
        return {
          id: r.id,
          titleAr: r.titleAr,
          similarity: Number(Math.min(0.99, adjusted).toFixed(2)),
        };
      })
      .filter((r) => r.similarity >= 0.52)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);
  } catch (error) {
    console.error('detectSimilarRules failed:', error);
    return [];
  }
}
