/**
 * Body-language poses for the 3D figure. Angles are in degrees and describe a figure facing +z whose own left is +x:
 *  - flex: positive swings the limb forward; abd: positive swings the limb away from the body.
 * The data is pure so it can be tested and reused; the renderer lives in components/three/figure.ts.
 */

export interface Joint3 {
  x?: number;
  y?: number;
  z?: number;
}

export interface Pose {
  id: string;
  /** Vertical offset of the pelvis above the floor (m) and extra forward shift. */
  hipY: number;
  hipZ: number;
  /** Where the seat/cushion goes, if any. */
  prop: 'none' | 'chair' | 'cushion';
  spine: number; // flex (lean forward)
  neck: number;
  headYaw: number;
  armL: { flex: number; abd: number; elbow: number; twist?: number };
  armR: { flex: number; abd: number; elbow: number; twist?: number };
  legL: { flex: number; abd: number; knee: number };
  legR: { flex: number; abd: number; knee: number };
}

export interface PoseInfo {
  id: string;
  ar: string;
  en: string;
  tipAr: string;
  tipEn: string;
  verdict: 'do' | 'avoid';
}

const STAND_LEG = { flex: 0, abd: 3, knee: 0 };

export const POSES: Record<string, Pose> = {
  stand: {
    id: 'stand', hipY: 0.98, hipZ: 0, prop: 'none', spine: 0, neck: 0, headYaw: 0,
    armL: { flex: 4, abd: 8, elbow: 10 }, armR: { flex: 4, abd: 8, elbow: 10 },
    legL: STAND_LEG, legR: STAND_LEG,
  },
  handshake: {
    id: 'handshake', hipY: 0.98, hipZ: 0, prop: 'none', spine: 4, neck: 6, headYaw: 0,
    armL: { flex: 4, abd: 8, elbow: 10 }, armR: { flex: 40, abd: -6, elbow: 52 },
    legL: STAND_LEG, legR: { flex: 6, abd: 3, knee: 0 },
  },
  handHeart: {
    id: 'handHeart', hipY: 0.98, hipZ: 0, prop: 'none', spine: 3, neck: 10, headYaw: 0,
    armL: { flex: 4, abd: 8, elbow: 10 }, armR: { flex: 38, abd: -24, elbow: 118, twist: -55 },
    legL: STAND_LEG, legR: STAND_LEG,
  },
  nod: {
    id: 'nod', hipY: 0.98, hipZ: 0, prop: 'none', spine: 16, neck: 14, headYaw: 0,
    armL: { flex: 6, abd: 8, elbow: 14 }, armR: { flex: 6, abd: 8, elbow: 14 },
    legL: STAND_LEG, legR: STAND_LEG,
  },
  seated: {
    id: 'seated', hipY: 0.5, hipZ: -0.02, prop: 'chair', spine: 0, neck: 0, headYaw: 0,
    armL: { flex: 24, abd: 8, elbow: 78 }, armR: { flex: 24, abd: 8, elbow: 78 },
    legL: { flex: 90, abd: 4, knee: 90 }, legR: { flex: 90, abd: 4, knee: 90 },
  },
  majlisGood: {
    id: 'majlisGood', hipY: 0.16, hipZ: 0, prop: 'cushion', spine: -2, neck: 0, headYaw: 0,
    armL: { flex: 22, abd: 10, elbow: 80 }, armR: { flex: 22, abd: 10, elbow: 80 },
    legL: { flex: 80, abd: 58, knee: 128 }, legR: { flex: 80, abd: 58, knee: 128 },
  },
  majlisAvoid: {
    id: 'majlisAvoid', hipY: 0.16, hipZ: 0, prop: 'cushion', spine: -14, neck: 4, headYaw: 0,
    armL: { flex: 8, abd: 28, elbow: 20 }, armR: { flex: 8, abd: 28, elbow: 20 },
    legL: { flex: 84, abd: 8, knee: 4 }, legR: { flex: 84, abd: 8, knee: 4 },
  },
};

export const POSE_INFO: PoseInfo[] = [
  { id: 'stand', ar: 'وقفة الاستقبال', en: 'Reception stance', verdict: 'do', tipAr: 'الظهر مستقيم والكتفان مرتخيان واليدان بجانب الجسم أو أمامه. لا تضع يديك في جيبك ولا تعقدهما على صدرك أمام ضيف كبير.', tipEn: 'Straight back, relaxed shoulders, hands at the sides or in front. No hands in pockets or arms crossed in front of a senior guest.' },
  { id: 'handshake', ar: 'المصافحة', en: 'Handshake', verdict: 'do', tipAr: 'باليد اليمنى، بقبضة ثابتة غير مبالغ فيها، مع نظرة ودودة وابتسامة. انتظر مبادرة الجنس الآخر بمد اليد أولاً.', tipEn: 'Right hand, a firm but not forceful grip, friendly eye contact and a smile. Wait for a person of the other gender to offer a hand first.' },
  { id: 'handHeart', ar: 'اليد على الصدر', en: 'Hand on chest', verdict: 'do', tipAr: 'تحية معتادة في المجتمعات العربية تعبّر عن الود والاحترام، وتُستخدم عند مصافحة الجنس الآخر أو بدلاً منها عند عدم المصافحة.', tipEn: 'A common greeting across Arab societies showing warmth and respect; used with, or instead of, a handshake where the other person does not shake hands.' },
  { id: 'nod', ar: 'إيماءة الاحترام', en: 'Respectful nod', verdict: 'do', tipAr: 'انحناءة رأس خفيفة تدل على الاحترام. ليست انحناءة عميقة؛ المبالغة فيها غير معتادة في المراسم العربية.', tipEn: 'A slight inclination of the head showing respect. Not a deep bow; exaggerating it is unusual in Arab protocol.' },
  { id: 'seated', ar: 'الجلوس الرسمي', en: 'Formal seated posture', verdict: 'do', tipAr: 'ظهر مستقيم مسنود، وقدمان على الأرض، واليدان على الفخذين أو الطاولة. لا تضع ساقاً فوق ساق بحيث تشير القدم إلى ضيف.', tipEn: 'Back straight and supported, feet on the floor, hands on thighs or the table. Avoid crossing legs so a foot points at a guest.' },
  { id: 'majlisGood', ar: 'جلسة المجلس الصحيحة', en: 'Correct majlis seating', verdict: 'do', tipAr: 'ركبتان مثنيتان وقدمان مطويتان تحتك بحيث لا يظهر باطن القدم لأحد.', tipEn: 'Knees bent, feet tucked under so the soles are not visible to anyone.' },
  { id: 'majlisAvoid', ar: 'ما يجب تجنبه في المجلس', en: 'What to avoid in a majlis', verdict: 'avoid', tipAr: 'مدّ الساقين نحو الجالسين فيظهر باطن القدم: تصرف غير لائق في الثقافة العربية.', tipEn: 'Stretching the legs toward other sitters so the soles show: considered impolite in Arab culture.' },
];

export const POSE_ORDER = POSE_INFO.map((p) => p.id);

/** Linear interpolation of two poses (the renderer eases `t`). */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const arm = (p: Pose['armL'], q: Pose['armL']) => ({ flex: l(p.flex, q.flex), abd: l(p.abd, q.abd), elbow: l(p.elbow, q.elbow), twist: l(p.twist ?? 0, q.twist ?? 0) });
  const leg = (p: Pose['legL'], q: Pose['legL']) => ({ flex: l(p.flex, q.flex), abd: l(p.abd, q.abd), knee: l(p.knee, q.knee) });
  return {
    id: t < 0.5 ? a.id : b.id,
    hipY: l(a.hipY, b.hipY), hipZ: l(a.hipZ, b.hipZ), prop: t < 0.5 ? a.prop : b.prop,
    spine: l(a.spine, b.spine), neck: l(a.neck, b.neck), headYaw: l(a.headYaw, b.headYaw),
    armL: arm(a.armL, b.armL), armR: arm(a.armR, b.armR), legL: leg(a.legL, b.legL), legR: leg(a.legR, b.legR),
  };
}
