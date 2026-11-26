/**
 * Practice counterpart reactions: the 3D host or delegation head takes a posture after each answer.
 * The category comes from the chosen option's own rubric scores, which the scenario payload already carries
 * (0..3 per competency). Display only; grading stays on the server.
 */
import { POSES, type Pose } from './poses.ts';

export type Reaction = 'waiting' | 'warm' | 'approving' | 'reserved' | 'displeased';

const STAND_LEG = { flex: 0, abd: 3, knee: 0 };

export const REACTION_POSES: Record<Reaction, Pose> = {
  waiting: { ...POSES.stand, id: 'cp-waiting' },
  warm: { ...POSES.handHeart, id: 'cp-warm', neck: 12 },
  approving: { ...POSES.nod, id: 'cp-approving' },
  reserved: {
    id: 'cp-reserved', hipY: 0.98, hipZ: 0, prop: 'none', spine: -3, neck: -4, headYaw: 18,
    armL: { flex: 2, abd: 6, elbow: 6 }, armR: { flex: 2, abd: 6, elbow: 6 },
    legL: STAND_LEG, legR: STAND_LEG,
  },
  displeased: {
    id: 'cp-displeased', hipY: 0.98, hipZ: 0, prop: 'none', spine: -10, neck: -10, headYaw: 40,
    armL: { flex: -6, abd: 4, elbow: 4 }, armR: { flex: -6, abd: 4, elbow: 4 },
    legL: STAND_LEG, legR: { flex: -6, abd: 6, knee: 0 },
  },
};

export function reactionFor(scores: Record<string, number> | undefined): Reaction {
  const v = Object.values(scores ?? {}).filter((n) => Number.isFinite(n));
  if (!v.length) return 'approving';
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  if (mean >= 2.5) return 'warm';
  if (mean >= 1.5) return 'approving';
  if (mean >= 0.75) return 'reserved';
  return 'displeased';
}

export const REACTION_TEXT: Record<Reaction, { ar: string; en: string }> = {
  waiting: { ar: 'ينتظر ردّك', en: 'Waiting for your response' },
  warm: { ar: 'يضع يده على صدره امتناناً', en: 'Hand on chest, visibly pleased' },
  approving: { ar: 'يومئ برأسه موافقاً', en: 'Nods in approval' },
  reserved: { ar: 'يلتفت قليلاً بتحفّظ', en: 'Turns slightly, reserved' },
  displeased: { ar: 'يتراجع قليلاً ويشيح بوجهه', en: 'Leans back and looks away' },
};
