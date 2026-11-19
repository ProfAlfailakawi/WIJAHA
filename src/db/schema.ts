import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// 1. Identity, Organizations & Multi-Tenancy
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name').notNull().default(''),
  locale: text('locale').notNull().default('ar'),
  theme: text('theme').notNull().default('light'),
  platformRole: text('platform_role').notNull().default('user'),
  expertSuggestionsEnabled: boolean('expert_suggestions_enabled').notNull().default(true),
  mfaVerified: boolean('mfa_verified').notNull().default(false),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  mfaSecretEncrypted: text('mfa_secret_encrypted'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orgs = pgTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameEn: text('name_en').notNull().default(''),
  logoUrl: text('logo_url'),
  planId: text('plan_id').notNull().default('free'),
  isPersonal: boolean('is_personal').notNull().default(false),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const memberships = pgTable('memberships', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const invitations = pgTable('invitations', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  invitedByUid: text('invited_by_uid').notNull(),
  status: text('status').notNull().default('pending'),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const authSessions = pgTable('auth_sessions', {
  id: text('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  activeOrgId: text('active_org_id').notNull(),
  mfaVerified: boolean('mfa_verified').notNull().default(false),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const magicLinks = pgTable('magic_links', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  invalidatedAt: timestamp('invalidated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const magicAttempts = pgTable(
  'magic_attempts',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    ipHash: text('ip_hash').notNull(),
    succeeded: boolean('succeeded').notNull().default(false),
    attemptedAt: timestamp('attempted_at').defaultNow().notNull(),
  },
  (table) => [index('magic_attempts_email_time_idx').on(table.email, table.attemptedAt)],
);

export const rateLimitBuckets = pgTable('rate_limit_buckets', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(1),
  resetAt: timestamp('reset_at').notNull(),
});

// ---------------------------------------------------------------------------
// 2. Protocol Knowledge Base & Dictionaries
// ---------------------------------------------------------------------------

export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  publisher: text('publisher').notNull(),
  type: text('type').notNull().default('internal'),
  url: text('url'),
  publishedAt: text('published_at'),
  accessedAt: text('accessed_at').notNull(),
  reliability: text('reliability').notNull().default('secondary'),
  isDemo: boolean('is_demo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const knowledgeRules = pgTable(
  'knowledge_rules',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id'),
    titleAr: text('title_ar').notNull(),
    titleEn: text('title_en').notNull(),
    bodyAr: text('body_ar').notNull(),
    bodyEn: text('body_en').notNull(),
    level: text('level').notNull().default('customary'),
    topics: jsonb('topics').$type<string[]>().notNull().default([]),
    countries: jsonb('countries').$type<string[]>().notNull().default(['GLOBAL']),
    contexts: jsonb('contexts').$type<string[]>().notNull().default(['business']),
    sensitivity: text('sensitivity').notNull().default('low'),
    sources: jsonb('sources')
      .$type<Array<{ sourceId: string; locator?: string }>>()
      .notNull()
      .default([]),
    exceptions: text('exceptions'),
    status: text('status').notNull().default('draft_demo'),
    authorUid: text('author_uid').notNull(),
    reviewedBy: text('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    reviewNote: text('review_note'),
    validFrom: text('valid_from'),
    reviewDueAt: text('review_due_at').notNull(),
    version: integer('version').notNull().default(1),
    supersedes: text('supersedes'),
    embeddingAr: jsonb('embedding_ar').$type<number[]>().notNull().default([]),
    embeddingEn: jsonb('embedding_en').$type<number[]>().notNull().default([]),
    embeddingVec: vector('embedding_vec', { dimensions: 768 }),
    normalizedSearchText: text('normalized_search_text').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('knowledge_rules_embedding_hnsw_idx').using(
      'hnsw',
      table.embeddingVec.op('vector_cosine_ops'),
    ),
  ],
);

export const knowledgeRuleVersions = pgTable('knowledge_rule_versions', {
  id: serial('id').primaryKey(),
  ruleId: text('rule_id')
    .notNull()
    .references(() => knowledgeRules.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
  changedByUid: text('changed_by_uid').notNull(),
  changeNote: text('change_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const titlesDictionary = pgTable('titles_dictionary', {
  id: text('id').primaryKey(),
  country: text('country').notNull().default('GLOBAL'),
  roleAr: text('role_ar').notNull(),
  roleEn: text('role_en').notNull(),
  salutationAr: text('salutation_ar').notNull(),
  salutationEn: text('salutation_en').notNull(),
  reviewedBy: text('reviewed_by'),
  isDemo: boolean('is_demo').notNull().default(true),
});

export const synonyms = pgTable('synonyms', {
  id: serial('id').primaryKey(),
  term: text('term').notNull(),
  canonicalAr: text('canonical_ar').notNull(),
  canonicalEn: text('canonical_en').notNull(),
  dialect: text('dialect').notNull().default('gulf'),
  topic: text('topic').notNull().default('general'),
});

// ---------------------------------------------------------------------------
// 3. Queries, Transformative Results, Projects & Exports
// ---------------------------------------------------------------------------

export const queries = pgTable('queries', {
  id: text('id').primaryKey(),
  userUid: text('user_uid'),
  anonId: text('anon_id'),
  orgId: text('org_id'),
  textEncrypted: text('text_encrypted').notNull(),
  locale: text('locale').notNull().default('ar'),
  intent: text('intent').notNull().default('etiquette_personal'),
  sensitivity: text('sensitivity').notNull().default('low'),
  cacheHash: text('cache_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const results = pgTable('results', {
  id: text('id').primaryKey(),
  queryId: text('query_id')
    .notNull()
    .references(() => queries.id, { onDelete: 'cascade' }),
  userUid: text('user_uid'),
  anonId: text('anon_id'),
  orgId: text('org_id'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  ruleIds: jsonb('rule_ids').$type<string[]>().notNull().default([]),
  modelMeta: jsonb('model_meta').$type<Record<string, unknown>>().notNull().default({}),
  costEstimateKwd: text('cost_estimate_kwd').notNull().default('0.002'),
  isPublicShare: boolean('is_public_share').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  ownerUid: text('owner_uid')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  intent: text('intent').notNull().default('delegation_visit_host'),
  currentVersionId: text('current_version_id').notNull(),
  visibility: text('visibility').notNull().default('org'),
  dismissedExpertTriggers: jsonb('dismissed_expert_triggers')
    .$type<string[]>()
    .notNull()
    .default([]),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const projectVersions = pgTable('project_versions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  versionNumber: integer('version_number').notNull().default(1),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  changeSummary: text('change_summary').notNull(),
  diffSummary: jsonb('diff_summary').$type<string[]>().notNull().default([]),
  authorUid: text('author_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shares = pgTable('shares', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  orgId: text('org_id').notNull(),
  token: text('token').notNull().unique(),
  createdByUid: text('created_by_uid').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const exportsLog = pgTable('exports_log', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  orgId: text('org_id').notNull(),
  userUid: text('user_uid').notNull(),
  format: text('format').notNull(),
  watermarked: boolean('watermarked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const feedback = pgTable('feedback', {
  id: text('id').primaryKey(),
  resultId: text('result_id').notNull(),
  userUid: text('user_uid'),
  rating: text('rating').notNull(),
  comment: text('comment'),
  reportedError: boolean('reported_error').notNull().default(false),
  ruleIds: jsonb('rule_ids').$type<string[]>().notNull().default([]),
  reviewStatus: text('review_status').notNull().default('open'),
  resolvedByUid: text('resolved_by_uid'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 4. Simulation & Competency Engine
// ---------------------------------------------------------------------------

export const scenarios = pgTable('scenarios', {
  id: text('id').primaryKey(),
  titleAr: text('title_ar').notNull(),
  titleEn: text('title_en').notNull(),
  descriptionAr: text('description_ar').notNull(),
  descriptionEn: text('description_en').notNull(),
  audience: jsonb('audience').$type<string[]>().notNull().default(['corporate']),
  level: integer('level').notNull().default(1),
  competencies: jsonb('competencies').$type<string[]>().notNull().default(['C1']),
  learningObjectivesAr: jsonb('learning_objectives_ar').$type<string[]>().notNull().default([]),
  learningObjectivesEn: jsonb('learning_objectives_en').$type<string[]>().notNull().default([]),
  estimatedMinutes: integer('estimated_minutes').notNull().default(5),
  contentOwner: text('content_owner').notNull(),
  learningDesignOwner: text('learning_design_owner').notNull(),
  status: text('status').notNull().default('draft'),
  isDemo: boolean('is_demo').notNull().default(true),
  coverImage: text('cover_image'),
  nodes: jsonb('nodes').$type<Array<Record<string, unknown>>>().notNull().default([]),
  rubric: jsonb('rubric').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const simulationRuns = pgTable('simulation_runs', {
  id: text('id').primaryKey(),
  userUid: text('user_uid'),
  anonId: text('anon_id'),
  orgId: text('org_id'),
  scenarioId: text('scenario_id')
    .notNull()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  locale: text('locale').notNull().default('ar'),
  status: text('status').notNull().default('in_progress'),
  currentNodeId: text('current_node_id').notNull(),
  reportPayload: jsonb('report_payload').$type<Record<string, unknown>>(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  finishedAt: timestamp('finished_at'),
});

export const simulationSteps = pgTable('simulation_steps', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => simulationRuns.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  kind: text('kind').notNull().default('choice'),
  answerEncrypted: text('answer_encrypted').notNull(),
  scores: jsonb('scores').$type<Record<string, number>>().notNull().default({}),
  feedbackText: text('feedback_text').notNull().default(''),
  ruleIds: jsonb('rule_ids').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const competencyScores = pgTable('competency_scores', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid'),
  orgId: text('org_id'),
  competency: text('competency').notNull(),
  score: integer('score').notNull(),
  maxScore: integer('max_score').notNull().default(3),
  runId: text('run_id')
    .notNull()
    .references(() => simulationRuns.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 5. Experts, Services & CRM (Expert Bridge)
// ---------------------------------------------------------------------------

export const experts = pgTable('experts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  titleAr: text('title_ar').notNull(),
  titleEn: text('title_en').notNull(),
  bioAr: text('bio_ar').notNull(),
  bioEn: text('bio_en').notNull(),
  avatarUrl: text('avatar_url').notNull(),
  roleTag: text('role_tag').notNull(),
  active: boolean('active').notNull().default(true),
});

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  titleAr: text('title_ar').notNull(),
  titleEn: text('title_en').notNull(),
  forWhomAr: text('for_whom_ar').notNull(),
  forWhomEn: text('for_whom_en').notNull(),
  deliverablesAr: jsonb('deliverables_ar').$type<string[]>().notNull().default([]),
  deliverablesEn: jsonb('deliverables_en').$type<string[]>().notNull().default([]),
  format: text('format').notNull(),
  durationAr: text('duration_ar'),
  durationEn: text('duration_en'),
  pricingType: text('pricing_type').notNull(),
  priceAmountKwd: integer('price_amount_kwd'),
  turnaroundAr: text('turnaround_ar'),
  turnaroundEn: text('turnaround_en'),
  active: boolean('active').notNull().default(true),
});

export const serviceRequests = pgTable('service_requests', {
  id: text('id').primaryKey(),
  requesterUid: text('requester_uid'),
  requesterEmail: text('requester_email').notNull(),
  requesterName: text('requester_name').notNull(),
  orgId: text('org_id'),
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id),
  projectId: text('project_id'),
  triggerSource: text('trigger_source').notNull().default('direct'),
  status: text('status').notNull().default('new'),
  contextShared: jsonb('context_shared').$type<Record<string, unknown>>().notNull().default({}),
  clientNotes: text('client_notes').notNull().default(''),
  internalNotes: text('internal_notes').notNull().default(''),
  assignedOwner: text('assigned_owner').notNull().default('yousef'),
  quotedAmountKwd: integer('quoted_amount_kwd'),
  deliveryNotes: text('delivery_notes'),
  paid: boolean('paid').notNull().default(false),
  rating: integer('rating'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const expertSuggestionEvents = pgTable('expert_suggestion_events', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid'),
  orgId: text('org_id'),
  projectId: text('project_id'),
  resultId: text('result_id'),
  triggerType: text('trigger_type').notNull(),
  eventType: text('event_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 6. Plans, Entitlements, Billing, Metering & Revenue Governance
// ---------------------------------------------------------------------------

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  audienceAr: text('audience_ar').notNull(),
  audienceEn: text('audience_en').notNull(),
  monthlyPriceKwd: integer('monthly_price_kwd').notNull().default(0),
  annualPriceKwd: integer('annual_price_kwd').notNull().default(0),
  isQuote: boolean('is_quote').notNull().default(false),
  taxNoteAr: text('tax_note_ar').notNull(),
  taxNoteEn: text('tax_note_en').notNull(),
  excludedAr: jsonb('excluded_ar').$type<string[]>().notNull().default([]),
  excludedEn: jsonb('excluded_en').$type<string[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

export const planEntitlements = pgTable('plan_entitlements', {
  id: serial('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  entitlementKey: text('entitlement_key').notNull(),
  entitlementValue: text('entitlement_value').notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  userUid: text('user_uid').notNull(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id),
  billingCycle: text('billing_cycle').notNull().default('monthly'),
  status: text('status').notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start').defaultNow().notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  providerRef: text('provider_ref'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usageCounters = pgTable(
  'usage_counters',
  {
    id: serial('id').primaryKey(),
    orgId: text('org_id').notNull(),
    periodKey: text('period_key').notNull(),
    metricKey: text('metric_key').notNull(),
    usedCount: integer('used_count').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('usage_counters_org_period_metric_idx').on(
      table.orgId,
      table.periodKey,
      table.metricKey,
    ),
  ],
);

export const billingCheckoutSessions = pgTable('billing_checkout_sessions', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  providerSessionId: text('provider_session_id').notNull().unique(),
  orgId: text('org_id').notNull(),
  userUid: text('user_uid').notNull(),
  kind: text('kind').notNull(),
  targetId: text('target_id').notNull(),
  billingCycle: text('billing_cycle'),
  amountKwd: integer('amount_kwd').notNull(),
  serviceRequestId: text('service_request_id'),
  serviceOwner: text('service_owner'),
  status: text('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull(),
  userUid: text('user_uid').notNull(),
  kind: text('kind').notNull(),
  targetId: text('target_id').notNull(),
  amountKwd: integer('amount_kwd').notNull(),
  currency: text('currency').notNull().default('KWD'),
  status: text('status').notNull().default('succeeded'),
  provider: text('provider').notNull().default('mock'),
  providerTxId: text('provider_tx_id').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const webhookEvents = pgTable('webhook_events', {
  id: serial('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  provider: text('provider').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
});

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  orgId: text('org_id').notNull(),
  userUid: text('user_uid').notNull(),
  paymentId: text('payment_id').notNull(),
  amountKwd: integer('amount_kwd').notNull(),
  descriptionAr: text('description_ar').notNull(),
  descriptionEn: text('description_en').notNull(),
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
});

// Section 3.3: Revenue split rules configurable in Admin, empty/null by default (never hardcode founder splits)
export const revenueSplitRules = pgTable('revenue_split_rules', {
  id: text('id').primaryKey(),
  ownerType: text('owner_type').notNull().unique(),
  platformSharePct: integer('platform_share_pct'),
  yousefSharePct: integer('yousef_share_pct'),
  ahmadSharePct: integer('ahmad_share_pct'),
  notes: text('notes').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const revenueLedger = pgTable('revenue_ledger', {
  id: text('id').primaryKey(),
  paymentId: text('payment_id').notNull(),
  serviceId: text('service_id'),
  serviceOwner: text('service_owner').notNull(),
  grossAmountKwd: integer('gross_amount_kwd').notNull(),
  splitSnapshot: jsonb('split_snapshot').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// 7. Security Audit, Analytics & AI Evals
// ---------------------------------------------------------------------------

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  orgId: text('org_id'),
  ipHash: text('ip_hash').notNull().default('local'),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const evalCases = pgTable('eval_cases', {
  id: text('id').primaryKey(),
  dataset: text('dataset').notNull().default('dev'),
  queryText: text('query_text').notNull(),
  locale: text('locale').notNull().default('ar'),
  dialect: text('dialect').notNull().default('msa'),
  expectedIntent: text('expected_intent').notNull(),
  expectedSensitivity: text('expected_sensitivity').notNull(),
  expectedBlocks: jsonb('expected_blocks').$type<string[]>().notNull().default([]),
  expectedRuleIds: jsonb('expected_rule_ids').$type<string[]>().notNull().default([]),
  mandatoryKeywords: jsonb('mandatory_keywords').$type<string[]>().notNull().default([]),
  forbiddenKeywords: jsonb('forbidden_keywords').$type<string[]>().notNull().default([]),
  author: text('author').notNull().default('system_demo'),
  reviewedBy: text('reviewed_by'),
  status: text('status').notNull().default('approved'),
  isDemo: boolean('is_demo').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const evalRuns = pgTable('eval_runs', {
  id: text('id').primaryKey(),
  providerUsed: text('provider_used').notNull(),
  totalCases: integer('total_cases').notNull(),
  intentAccuracyPct: integer('intent_accuracy_pct').notNull(),
  recallPct: integer('recall_pct').notNull(),
  schemaPassPct: integer('schema_pass_pct').notNull(),
  highSensitivityPassPct: integer('high_sensitivity_pass_pct').notNull(),
  hallucinatedRulesCount: integer('hallucinated_rules_count').notNull(),
  summaryJson: jsonb('summary_json').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiCalls = pgTable(
  'ai_calls',
  {
    id: text('id').primaryKey(),
    stage: text('stage').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    estimatedCostKwd: text('estimated_cost_kwd').notNull().default('0'),
    usedFallback: boolean('used_fallback').notNull().default(false),
    orgId: text('org_id'),
    userUid: text('user_uid'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('ai_calls_created_at_idx').on(table.createdAt)],
);

export const resultCache = pgTable('result_cache', {
  cacheKey: text('cache_key').primaryKey(),
  locale: text('locale').notNull(),
  kbVersion: text('kb_version').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  ruleIds: jsonb('rule_ids').$type<string[]>().notNull().default([]),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  eventName: text('event_name').notNull(),
  orgId: text('org_id'),
  locale: text('locale').notNull().default('ar'),
  durationMs: integer('duration_ms'),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
}));

export const orgsRelations = relations(orgs, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
  subscriptions: many(subscriptions),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userUid],
    references: [users.uid],
  }),
  org: one(orgs, {
    fields: [memberships.orgId],
    references: [orgs.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  owner: one(users, {
    fields: [projects.ownerUid],
    references: [users.uid],
  }),
  org: one(orgs, {
    fields: [projects.orgId],
    references: [orgs.id],
  }),
}));
