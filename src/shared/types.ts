import { z } from 'zod';

export const LocaleSchema = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const IntentTypeSchema = z.enum([
  'etiquette_personal',
  'dining_etiquette',
  'dress_code',
  'hosting_hospitality',
  'delegation_visit_host',
  'business_trip_abroad',
  'formal_invitation',
  'seating_precedence',
  'gift_question',
  'greeting_titles',
  'cultural_briefing',
  'plan_review',
  'training_request',
  'expert_request',
  'out_of_scope',
  'unsafe',
]);
export type IntentType = z.infer<typeof IntentTypeSchema>;

export const SensitivitySchema = z.enum(['low', 'medium', 'high']);
export type SensitivityLevel = z.infer<typeof SensitivitySchema>;

export const RuleLevelSchema = z.enum(['official', 'customary', 'advisory']);
export type RuleLevel = z.infer<typeof RuleLevelSchema>;

export const ContextChipSchema = z.object({
  key: z.string(),
  label: z.string(),
  editable: z.boolean().default(true),
});
export type ContextChip = z.infer<typeof ContextChipSchema>;

export const AssumptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  alternativeText: z.string().optional(),
  editable: z.boolean().default(true),
});
export type Assumption = z.infer<typeof AssumptionSchema>;

export const ClarifyingQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  field: z.string(),
  options: z.array(z.string()).min(2).max(4),
});
export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestionSchema>;

export const ActionSchema = z.object({
  id: z.enum([
    'export_pdf',
    'export_docx',
    'save_project',
    'share',
    'practice',
    'followup',
    'request_expert',
  ]),
  label: z.string(),
  targetUrl: z.string().optional(),
});
export type Action = z.infer<typeof ActionSchema>;

// ---------------------------------------------------------------------------
// V1 Six Result Blocks (+ risk_list for /check)
// ---------------------------------------------------------------------------

export const AnswerBlockSchema = z.object({
  type: z.literal('answer'),
  points: z
    .array(
      z.object({
        text: z.string(),
        ruleId: z.string().optional(),
        level: RuleLevelSchema,
      }),
    )
    .min(1)
    .max(7),
});
export type AnswerBlock = z.infer<typeof AnswerBlockSchema>;

export const ChecklistItemSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  when: z.string().optional(),
  owner: z.string().optional(),
  critical: z.boolean().optional(),
  completed: z.boolean().optional(),
  ruleId: z.string().optional(),
});

export const ChecklistBlockSchema = z.object({
  type: z.literal('checklist'),
  groups: z
    .array(
      z.object({
        title: z.string(),
        items: z.array(ChecklistItemSchema).min(1),
      }),
    )
    .min(1),
});
export type ChecklistBlock = z.infer<typeof ChecklistBlockSchema>;

export const TimelineBlockSchema = z.object({
  type: z.literal('timeline'),
  days: z
    .array(
      z.object({
        label: z.string(),
        items: z
          .array(
            z.object({
              time: z.string().optional(),
              title: z.string(),
              detail: z.string().optional(),
              location: z.string().optional(),
              ruleId: z.string().optional(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export type TimelineBlock = z.infer<typeof TimelineBlockSchema>;

export const DraftBlockSchema = z.object({
  type: z.literal('draft'),
  kind: z.enum(['invitation', 'letter', 'speech', 'message']),
  language: z.string(),
  text: z.string(),
  reviewRequired: z.boolean(),
  notes: z.array(z.string()),
});
export type DraftBlock = z.infer<typeof DraftBlockSchema>;

export const SeatSchema = z.object({
  id: z.string(),
  label: z.string(),
  role: z.string().optional(),
  rank: z.number().int().optional(),
  x: z.number().min(5).max(95),
  y: z.number().min(5).max(95),
});
export type SeatNode = z.infer<typeof SeatSchema>;

export const SeatingBlockSchema = z.object({
  type: z.literal('seating'),
  layout: z.enum(['round', 'rect', 'u_shape', 'theatre']),
  seats: z.array(SeatSchema),
  host: z.string().optional(),
  officialPrecedenceNotice: z.boolean().default(true),
  principles: z.array(
    z.object({
      text: z.string(),
      ruleId: z.string().optional(),
    }),
  ),
});
export type SeatingBlock = z.infer<typeof SeatingBlockSchema>;

export const ExpertSuggestionSchema = z.object({
  trigger: z.enum([
    'high_sensitivity',
    'unreviewed_claims',
    'competency_gap',
    'frequent_delegations',
    'custom_org_training',
    'explicit_request',
  ]),
  serviceId: z.string(),
  expertSlug: z.string(),
  expertName: z.string(),
  serviceTitle: z.string(),
  reason: z.string(),
  priceLabel: z.string(),
});
export type ExpertSuggestion = z.infer<typeof ExpertSuggestionSchema>;

export const ExpertReviewBlockSchema = z.object({
  type: z.literal('expert_review'),
  reason: z.string(),
  expertSlug: z.string(),
  serviceId: z.string(),
  recommendedExpertName: z.string(),
  serviceTitle: z.string(),
});
export type ExpertReviewBlock = z.infer<typeof ExpertReviewBlockSchema>;

export const ResultBlockSchema = z.discriminatedUnion('type', [
  AnswerBlockSchema,
  ChecklistBlockSchema,
  TimelineBlockSchema,
  DraftBlockSchema,
  SeatingBlockSchema,
  ExpertReviewBlockSchema,
]);
export type ResultBlock = z.infer<typeof ResultBlockSchema>;

export const WijahaResultSchema = z.object({
  id: z.string(),
  locale: LocaleSchema,
  title: z.string().max(80),
  intent: IntentTypeSchema,
  isOutOfScope: z.boolean().optional(),
  context: z.array(ContextChipSchema),
  assumptions: z.array(AssumptionSchema),
  clarification: ClarifyingQuestionSchema.optional(),
  summary: z.array(z.string()).min(1).max(3),
  blocks: z.array(ResultBlockSchema).min(1).max(3),
  primaryAction: ActionSchema,
  secondaryActions: z.array(ActionSchema).max(3),
  trust: z.object({
    ruleIds: z.array(z.string()),
    reviewedCount: z.number().int().nonnegative(),
    demoCount: z.number().int().nonnegative().default(0),
    unreviewedClaims: z.number().int().nonnegative(),
    lastReviewedAt: z.string().optional(),
    sensitivity: SensitivitySchema,
    sourcesDetail: z
      .array(
        z.object({
          ruleId: z.string(),
          ruleTitle: z.string(),
          level: RuleLevelSchema,
          status: z.string(),
          sourceTitle: z.string().optional(),
          reviewedBy: z.string().optional(),
        }),
      )
      .optional(),
  }),
  expertSuggestion: ExpertSuggestionSchema.optional(),
});
export type WijahaResult = z.infer<typeof WijahaResultSchema>;

// ---------------------------------------------------------------------------
// "Check My Plan" (/check) Schema
// ---------------------------------------------------------------------------

export const PlanReviewFindingSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'important', 'improvement']),
  what: z.string(),
  why: z.string(),
  suggestion: z.string(),
  ruleId: z.string().optional(),
  ruleTitle: z.string().optional(),
});
export type PlanReviewFinding = z.infer<typeof PlanReviewFindingSchema>;

export const PlanCheckResponseSchema = z.object({
  id: z.string(),
  locale: LocaleSchema,
  summary: z.string(),
  findings: z.array(PlanReviewFindingSchema),
  isDemoContent: z.boolean(),
});
export type PlanCheckResponse = z.infer<typeof PlanCheckResponseSchema>;

// ---------------------------------------------------------------------------
// Simulation & Competencies
// ---------------------------------------------------------------------------

export const CompetencyCodeSchema = z.enum(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7']);
export type CompetencyCode = z.infer<typeof CompetencyCodeSchema>;

export interface ScenarioOption {
  id: string;
  textAr: string;
  textEn: string;
  next: string;
  scores: Record<string, number>;
  feedbackAr: string;
  feedbackEn: string;
  ruleIds: string[];
}

export interface ScenarioNode {
  id: string;
  narrativeAr: string;
  narrativeEn: string;
  persona?: {
    nameAr: string;
    nameEn: string;
    roleAr: string;
    roleEn: string;
    styleAr: string;
    styleEn: string;
  };
  kind: 'choice' | 'free_text';
  options?: ScenarioOption[];
  freeTextCriterionId?: string;
  promptHintAr?: string;
  promptHintEn?: string;
  next?: string;
  isEnd?: boolean;
}

export interface RubricCriterion {
  id: string;
  competency: CompetencyCode;
  descriptionAr: string;
  descriptionEn: string;
  keywordsAr: string[];
  keywordsEn: string[];
  levels: Array<{ score: 0 | 1 | 2 | 3; descriptorAr: string; descriptorEn: string }>;
}

export interface ScenarioRubric {
  criteria: RubricCriterion[];
}

export interface SimulationReport {
  runId: string;
  scenarioId: string;
  scenarioTitleAr: string;
  scenarioTitleEn: string;
  completedAt: string;
  competencyBreakdown: Array<{
    competency: CompetencyCode;
    score: number;
    maxScore: number;
    pct: number;
  }>;
  strengths: Array<{ competency: CompetencyCode; noteAr: string; noteEn: string }>;
  gaps: Array<{
    competency: CompetencyCode;
    noteAr: string;
    noteEn: string;
    exampleAr: string;
    exampleEn: string;
  }>;
  explanations: Array<{
    stepNodeId: string;
    feedbackAr: string;
    feedbackEn: string;
    ruleIds: string[];
  }>;
  recommendedNextScenarioId?: string;
  expertBridgeSuggestion?: ExpertSuggestion;
  historyPoints?: Array<{ runIndex: number; avgPct: number; at: string }>;
}

// ---------------------------------------------------------------------------
// API Input Validation Schemas
// ---------------------------------------------------------------------------

export const QueryInputSchema = z.object({
  query: z.string().trim().min(2).max(2000),
  locale: LocaleSchema.default('ar'),
  clarificationAnswer: z.string().trim().max(200).optional(),
  overrideContext: z.record(z.string(), z.string()).optional(),
});

export const CheckPlanInputSchema = z.object({
  planText: z.string().trim().min(10).max(8000),
  contextNote: z.string().trim().max(400).optional(),
  locale: LocaleSchema.default('ar'),
});

export const ProjectCreateInputSchema = z.object({
  resultId: z.string().min(1),
  title: z.string().trim().min(2).max(120).optional(),
});

export const ProjectPatchInputSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  payload: WijahaResultSchema,
  changeSummary: z.string().trim().min(2).max(240).default('تعديل يدوي'),
});

export const ProjectNaturalUpdateSchema = z.object({
  instruction: z.string().trim().min(3).max(1000),
  locale: LocaleSchema.default('ar'),
});

export const ServiceRequestInputSchema = z.object({
  serviceId: z.string().min(1),
  requesterName: z.string().trim().min(2).max(120),
  requesterEmail: z.email().max(180),
  projectId: z.string().optional(),
  triggerSource: z.string().max(80).default('direct'),
  contextShared: z.record(z.string(), z.unknown()).default({}),
  clientNotes: z.string().trim().max(2000).default(''),
});
