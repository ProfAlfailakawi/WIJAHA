import type { SeatNode } from '../types.ts';
import { planLayout, toPercent, type LayoutKind } from './seating.ts';

export function buildSeatNodes(
  layout: LayoutKind,
  count: number,
  locale: 'ar' | 'en',
  isBilateral: boolean,
): SeatNode[] {
  const plan = planLayout(layout, count);
  const ar = locale === 'ar';
  const hostSide = ar ? 'الجانب المضيف' : 'Host Side';
  const visitSide = ar ? 'الوفد الزائر' : 'Visiting Delegation';

  const labelFor = (rank: number, side?: 'host' | 'guest'): { label: string; role?: string } => {
    if (layout === 'majlis') {
      if (rank === 1) return { label: ar ? 'المضيف' : 'Host', role: ar ? 'صدر المجلس' : 'Head of the majlis' };
      if (rank === 2) return { label: ar ? 'ضيف الشرف' : 'Guest of honor', role: ar ? 'يمين المضيف' : "Host's right" };
      if (rank === 3) return { label: ar ? 'الضيف الثاني' : 'Second guest', role: ar ? 'يسار المضيف' : "Host's left" };
      return { label: ar ? `ضيف بحسب الأسبقية ${rank - 3}` : `Guest by precedence ${rank - 3}`, role: ar ? 'على امتداد جدار المجلس' : 'Along the majlis wall' };
    }
    if (layout === 'rect') {
      if (rank === 1) return { label: ar ? 'رئيس الوفد المضيف' : 'Host Principal', role: isBilateral ? hostSide : undefined };
      if (rank === 2) return { label: ar ? 'رئيس الوفد الضيف' : 'Visiting Head', role: visitSide };
      if (rank === 4) return { label: ar ? 'المترجم المرافق' : 'Interpreter', role: visitSide };
      return side === 'guest'
        ? { label: ar ? `عضو الوفد الضيف ${Math.ceil((rank - 2) / 2)}` : `Visiting Member ${Math.ceil((rank - 2) / 2)}`, role: visitSide }
        : { label: ar ? `ممثل المضيف ${Math.ceil((rank - 1) / 2)}` : `Host Member ${Math.ceil((rank - 1) / 2)}`, role: hostSide };
    }
    const list = ar
      ? [
          { label: 'المضيف الرئيسي', role: 'المضيف (مواجه للمدخل)' },
          { label: 'رئيس الوفد الضيف', role: 'ضيف الشرف الأول (يمين المضيف)' },
          { label: 'نائب المضيف', role: 'الجانب المضيف' },
          { label: 'الضيف الثاني بالوفد', role: 'يسار المضيف' },
          { label: 'مترجم / منسق الوفد', role: 'مساندة تواصل' },
          { label: 'ممثل الجهة المضيفة 2', role: 'الجانب المضيف' },
          { label: 'عضو الوفد الضيف 3', role: 'الوفد الزائر' },
          { label: 'مسؤول المراسم', role: 'إشراف تشغيلي (قرب المدخل)' },
          { label: 'عضو الوفد الضيف 4', role: 'الوفد الزائر' },
          { label: 'ممثل الجهة المضيفة 3', role: 'الجانب المضيف' },
          { label: 'عضو الوفد الضيف 5', role: 'الوفد الزائر' },
          { label: 'ممثل الجهة المضيفة 4', role: 'الجانب المضيف' },
        ]
      : [
          { label: 'Principal Host', role: 'Host (Facing Entrance)' },
          { label: 'Head of Delegation', role: 'Chief Guest (Host Right)' },
          { label: 'Deputy Host', role: 'Host Delegation' },
          { label: 'Second Visiting Principal', role: 'Host Left' },
          { label: 'Interpreter / Liaison', role: 'Communication Support' },
          { label: 'Host Representative 2', role: 'Host Delegation' },
          { label: 'Visiting Delegate 3', role: 'Visiting Delegation' },
          { label: 'Protocol Lead', role: 'Logistics Seat (Near Door)' },
          { label: 'Visiting Delegate 4', role: 'Visiting Delegation' },
          { label: 'Host Representative 3', role: 'Host Delegation' },
          { label: 'Visiting Delegate 5', role: 'Visiting Delegation' },
          { label: 'Host Representative 4', role: 'Host Delegation' },
        ];
    return list[rank - 1] ?? { label: ar ? `مقعد ${rank}` : `Seat ${rank}`, role: ar ? 'مشارك' : 'Participant' };
  };

  return plan.seats.map((spot) => {
    const meta = labelFor(spot.rank, spot.side);
    const { x, y } = toPercent(spot.x, spot.y);
    return { id: `seat_${spot.rank}`, label: meta.label, role: meta.role, rank: spot.rank, x, y };
  });
}
