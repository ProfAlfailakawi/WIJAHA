import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Armchair,
  Building2,
  Camera,
  Car,
  Clock,
  Coffee,
  DoorOpen,
  Gift,
  Handshake,
  MapPin,
  Moon,
  PenLine,
  Plane,
  Users,
  Utensils,
} from 'lucide-react';
import { inferTimelineKind, type TimelineKind } from '../../shared/visuals/timeline.ts';

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;

const KIND: Record<TimelineKind, { icon: IconType; tint: string; color: string }> = {
  arrival: { icon: Plane, tint: 'var(--t-indigo)', color: 'var(--c-indigo)' },
  welcome: { icon: Handshake, tint: 'var(--t-gold)', color: 'var(--c-gold)' },
  coffee: { icon: Coffee, tint: 'var(--t-gold)', color: 'var(--c-gold)' },
  meeting: { icon: Users, tint: 'var(--t-indigo)', color: 'var(--c-indigo)' },
  meal: { icon: Utensils, tint: 'var(--t-rose)', color: 'var(--c-rose)' },
  prayer: { icon: Moon, tint: 'var(--t-teal)', color: 'var(--c-teal)' },
  gift: { icon: Gift, tint: 'var(--t-violet)', color: 'var(--c-violet)' },
  photo: { icon: Camera, tint: 'var(--t-violet)', color: 'var(--c-violet)' },
  signing: { icon: PenLine, tint: 'var(--t-indigo)', color: 'var(--c-indigo)' },
  transfer: { icon: Car, tint: 'var(--t-teal)', color: 'var(--c-teal)' },
  departure: { icon: DoorOpen, tint: 'var(--t-gold)', color: 'var(--c-gold)' },
  rest: { icon: Armchair, tint: 'var(--t-teal)', color: 'var(--c-teal)' },
  generic: { icon: Building2, tint: 'var(--surface-2)', color: 'var(--ink-2)' },
};

export interface VisualDay {
  label: string;
  items: Array<{ time?: string; title: string; detail?: string; location?: string; ruleId?: string }>;
}

/** Illustrated programme: an animated rail with a coloured icon node per item. */
export function VisualTimeline({ days, onInspectRule, locale }: { days: VisualDay[]; onInspectRule?: (id: string) => void; locale?: string }) {
  const reduced = useReducedMotion();
  const rtl = locale === 'ar';
  void rtl;
  return (
    <div className="space-y-9">
      {days.map((day, di) => (
        <div key={di}>
          <div className="flex items-center gap-3 mb-5">
            <span className="v2-kicker">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {day.label}
            </span>
            <span className="h-px flex-1 bg-[var(--line)]" aria-hidden="true" />
          </div>

          <ol className="relative">
            <motion.span
              aria-hidden="true"
              className="absolute top-5 bottom-5 start-[23px] w-[3px] rounded-full origin-top"
              style={{ background: 'linear-gradient(to bottom, var(--gold), var(--line))' }}
              initial={reduced ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true, amount: 0.05 }}
              transition={{ duration: reduced ? 0 : 1.1, ease: 'easeOut' }}
            />
            {day.items.map((item, ii) => {
              const kind = inferTimelineKind(`${item.title} ${item.detail ?? ''}`.trim());
              const meta = KIND[kind];
              const Icon = meta.icon;
              return (
                <motion.li
                  key={ii}
                  className="relative ps-16 pb-6 last:pb-0"
                  initial={reduced ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : Math.min(ii * 0.05, 0.25) }}
                >
                  <span
                    aria-hidden="true"
                    className="absolute start-0 top-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-[var(--line)]"
                    style={{ background: meta.tint, color: meta.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.time && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums font-mono" style={{ background: meta.tint, color: meta.color }} dir="ltr">
                          {item.time}
                        </span>
                      )}
                      <p className="text-[0.95rem] font-bold text-[var(--ink)]">{item.title}</p>
                    </div>
                    {item.detail && <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-2)]">{item.detail}</p>}
                    {(item.location || item.ruleId) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-3)]">
                        {item.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            {item.location}
                          </span>
                        )}
                        {item.ruleId && (
                          <button type="button" onClick={() => onInspectRule?.(item.ruleId!)} className="font-mono text-[11px] hover:text-[var(--ink)] underline cursor-pointer" dir="ltr">
                            {item.ruleId}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
