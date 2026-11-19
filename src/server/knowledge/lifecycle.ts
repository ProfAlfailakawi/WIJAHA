import { z } from 'zod';

export const RuleStatusSchema = z.enum([
  'draft',
  'draft_demo',
  'in_review',
  'approved',
  'deprecated',
]);

export type RuleStatus = z.infer<typeof RuleStatusSchema>;

const ALLOWED_RULE_TRANSITIONS: Record<RuleStatus, readonly RuleStatus[]> = {
  draft: ['in_review'],
  draft_demo: ['in_review'],
  in_review: ['approved', 'draft'],
  approved: ['deprecated', 'in_review'],
  deprecated: ['in_review'],
};

export function canTransitionRuleStatus(fromStatus: string, toStatus: RuleStatus): boolean {
  const parsedFrom = RuleStatusSchema.safeParse(fromStatus);
  if (!parsedFrom.success) {
    return false;
  }
  return ALLOWED_RULE_TRANSITIONS[parsedFrom.data].includes(toStatus);
}
