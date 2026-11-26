import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Clock,
  Copy,
  FileText,
  ImageDown,
  ListChecks,
  MapPin,
  Play,
  Plus,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { downloadPng } from '../visuals/export.ts';
import { SeatingFloorplan, SeatLegend } from '../visuals/SeatingFloorplan';
import { Hall3D, type Hall3DHandle } from '../three/Hall3D';
import { GuestsEnter } from '../visuals/GuestsEnter';
import type { HallSeat } from '../three/hall-scene.ts';
import { fromPercent, planLayout } from '../../shared/visuals/seating.ts';
import { VisualTimeline } from '../visuals/VisualTimeline';
import { useI18n } from '../../lib/i18n';
import type {
  AnswerBlock,
  ChecklistBlock,
  DraftBlock,
  ExpertReviewBlock,
  ExpertSuggestion,
  ResultBlock,
  SeatingBlock,
  TimelineBlock,
} from '../../shared/types';
import { Button, RuleLevelTag } from '../ui/Primitives';

interface BlockRendererProps {
  block: ResultBlock;
  blockIndex: number;
  editable?: boolean;
  onUpdateBlock?: (index: number, next: ResultBlock) => void;
  onInspectRule?: (ruleId: string) => void;
  projectId?: string;
}

export function ResultBlockRenderer({
  block,
  blockIndex,
  editable = false,
  onUpdateBlock,
  onInspectRule,
  projectId,
}: BlockRendererProps) {
  switch (block.type) {
    case 'answer':
      return (
        <AnswerBlockView
          block={block}
          editable={editable}
          onChange={(next) => onUpdateBlock?.(blockIndex, next)}
          onInspectRule={onInspectRule}
        />
      );
    case 'checklist':
      return (
        <ChecklistBlockView
          block={block}
          editable={editable}
          onChange={(next) => onUpdateBlock?.(blockIndex, next)}
          onInspectRule={onInspectRule}
        />
      );
    case 'timeline':
      return (
        <TimelineBlockView
          block={block}
          editable={editable}
          onChange={(next) => onUpdateBlock?.(blockIndex, next)}
          onInspectRule={onInspectRule}
        />
      );
    case 'draft':
      return (
        <DraftBlockView
          block={block}
          editable={editable}
          onChange={(next) => onUpdateBlock?.(blockIndex, next)}
        />
      );
    case 'seating':
      return (
        <SeatingBlockView
          block={block}
          editable={editable}
          onChange={(next) => onUpdateBlock?.(blockIndex, next)}
          onInspectRule={onInspectRule}
        />
      );
    case 'expert_review':
      return <ExpertReviewBlockView block={block} projectId={projectId} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Answer Block
// ---------------------------------------------------------------------------

function AnswerBlockView({
  block,
  editable,
  onChange,
  onInspectRule,
}: {
  block: AnswerBlock;
  editable: boolean;
  onChange: (next: AnswerBlock) => void;
  onInspectRule?: (ruleId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-[var(--line)]">
        <BookOpen className="w-4 h-4 text-[var(--gold-ink)]" aria-hidden="true" />
        <h3 className="text-base font-semibold text-[var(--ink)]">
          {t.result.blocks.answerTitle}
        </h3>
      </div>

      <ol className="space-y-4">
        {block.points.map((pt, idx) => (
          <li key={idx} className="flex items-start gap-3.5">
            <span className="w-6 h-6 rounded-md bg-[var(--surface-2)] text-[var(--gold-ink)] text-xs font-semibold tabular-nums flex items-center justify-center shrink-0 mt-0.5">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 space-y-1">
              {editable ? (
                <textarea
                  value={pt.text}
                  rows={2}
                  onChange={(e) => {
                    const nextPoints = block.points.map((p, i) =>
                      i === idx ? { ...p, text: e.target.value } : p,
                    );
                    onChange({ ...block, points: nextPoints });
                  }}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)]"
                />
              ) : (
                <p className="text-[15px] text-[var(--ink)] leading-relaxed">{pt.text}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-3)]">
                <RuleLevelTag level={pt.level} label={t.result.levels[pt.level]} />
                {pt.ruleId && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => onInspectRule?.(pt.ruleId!)}
                      className="font-mono text-[11px] text-[var(--ink-2)] hover:text-[var(--ink)] underline underline-offset-2 cursor-pointer"
                      dir="ltr"
                    >
                      {pt.ruleId}
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Checklist Block + Readiness Infographic
// ---------------------------------------------------------------------------

function ChecklistBlockView({
  block,
  editable,
  onChange,
  onInspectRule,
}: {
  block: ChecklistBlock;
  editable: boolean;
  onChange: (next: ChecklistBlock) => void;
  onInspectRule?: (ruleId: string) => void;
}) {
  const { t, locale } = useI18n();
  const reducedMotion = useReducedMotion();
  const [localChecked, setLocalChecked] = useState<Record<string, boolean>>({});
  const [newItemText, setNewItemText] = useState('');

  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    let criticalTotal = 0;
    let criticalDone = 0;

    block.groups.forEach((g, gi) => {
      g.items.forEach((item, ii) => {
        const key = item.id || `${gi}-${ii}`;
        const isChecked = editable
          ? Boolean(item.completed)
          : localChecked[key] ?? Boolean(item.completed);
        total += 1;
        if (isChecked) done += 1;
        if (item.critical) {
          criticalTotal += 1;
          if (isChecked) criticalDone += 1;
        }
      });
    });

    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct, criticalTotal, criticalDone };
  }, [block, editable, localChecked]);

  const toggleItem = (gi: number, ii: number, key: string, current: boolean) => {
    if (editable) {
      const nextGroups = block.groups.map((g, gIdx) =>
        gIdx !== gi
          ? g
          : {
              ...g,
              items: g.items.map((it, iIdx) =>
                iIdx !== ii ? it : { ...it, completed: !current },
              ),
            },
      );
      onChange({ ...block, groups: nextGroups });
    } else {
      setLocalChecked((prev) => ({ ...prev, [key]: !current }));
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    const nextGroups = block.groups.map((g, idx) =>
      idx === 0
        ? {
            ...g,
            items: [
              ...g.items,
              {
                id: `custom-${Date.now()}`,
                text: newItemText.trim(),
                completed: false,
              },
            ],
          }
        : g,
    );
    onChange({ ...block, groups: nextGroups });
    setNewItemText('');
  };

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      {/* Header + Readiness Infographic */}
      <div className="pb-4 mb-5 border-b border-[var(--line)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ListChecks className="w-4 h-4 text-[var(--gold-ink)]" aria-hidden="true" />
            <h3 className="text-base font-semibold text-[var(--ink)]">
              {t.result.blocks.checklistTitle}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--ink-2)] tabular-nums">
            <span>
              {t.result.blocks.checklistProgress}:{' '}
              <strong className="text-[var(--ink)]">
                {stats.done}/{stats.total} ({stats.pct}%)
              </strong>
            </span>
            {stats.criticalTotal > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--warning)] font-medium">
                  {t.result.blocks.criticalTag}: {stats.criticalDone}/{stats.criticalTotal}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Clean Progress Bar Infographic */}
        <div
          className="h-2 w-full rounded-full bg-[var(--surface-2)] overflow-hidden"
          role="progressbar"
          aria-label={t.result.blocks.checklistProgress}
          aria-valuenow={stats.pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            initial={false}
            animate={{ width: `${stats.pct}%` }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
            className="h-full bg-[var(--success)] rounded-full"
          />
        </div>
      </div>

      <div className="space-y-6">
        {block.groups.map((group, gi) => (
          <div key={gi} className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
              {group.title}
            </h4>
            <ul className="divide-y divide-[var(--line)]/60 border border-[var(--line)] rounded-lg bg-[var(--bg)]/50">
              {group.items.map((item, ii) => {
                const key = item.id || `${gi}-${ii}`;
                const checked = editable
                  ? Boolean(item.completed)
                  : localChecked[key] ?? Boolean(item.completed);

                return (
                  <li key={key} className="p-3 sm:px-4 flex items-start gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={item.text}
                      onClick={() => toggleItem(gi, ii, key, checked)}
                      className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        checked
                          ? 'bg-[var(--success)] border-[var(--success)] text-white'
                          : 'bg-[var(--surface)] border-[var(--ink-3)]'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-1">
                      {editable ? (
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => {
                            const nextGroups = block.groups.map((g, gIdx) =>
                              gIdx !== gi
                                ? g
                                : {
                                    ...g,
                                    items: g.items.map((it, iIdx) =>
                                      iIdx !== ii ? it : { ...it, text: e.target.value },
                                    ),
                                  },
                            );
                            onChange({ ...block, groups: nextGroups });
                          }}
                          className="w-full rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-sm text-[var(--ink)]"
                        />
                      ) : (
                        <p
                          className={`text-sm leading-relaxed ${
                            checked ? 'line-through text-[var(--ink-3)]' : 'text-[var(--ink)]'
                          }`}
                        >
                          {item.text}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-3)]">
                        {item.critical && (
                          <span className="text-[var(--danger)] font-semibold">
                            {t.result.blocks.criticalTag}
                          </span>
                        )}
                        {item.when && (
                          <>
                            {item.critical && <span aria-hidden="true">·</span>}
                            <span>{item.when}</span>
                          </>
                        )}
                        {item.owner && (
                          <>
                            {(item.critical || item.when) && <span aria-hidden="true">·</span>}
                            <span>{item.owner}</span>
                          </>
                        )}
                        {item.ruleId && (
                          <>
                            <span aria-hidden="true">·</span>
                            <button
                              type="button"
                              onClick={() => onInspectRule?.(item.ruleId!)}
                              className="font-mono text-[11px] hover:text-[var(--ink)] underline cursor-pointer"
                              dir="ltr"
                            >
                              {item.ruleId}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {editable && (
          <form onSubmit={handleAddItem} className="flex gap-2 pt-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder={locale === 'ar' ? 'أضف بند تجهيز جديد…' : 'Add new checklist item…'}
              className="flex-1 min-h-[42px] rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
            />
            <Button type="submit" variant="secondary" size="sm">
              <Plus className="w-4 h-4" />
              <span>{t.projects.addChecklistItem}</span>
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Timeline Block + Architectural Chronological Rail Infographic
// ---------------------------------------------------------------------------

function TimelineBlockView({
  block,
  editable,
  onChange,
  onInspectRule,
}: {
  block: TimelineBlock;
  editable: boolean;
  onChange: (next: TimelineBlock) => void;
  onInspectRule?: (ruleId: string) => void;
}) {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<'visual' | 'list'>('visual');
  const visual = !editable && mode === 'visual';

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-[var(--line)]">
        <Clock className="w-4 h-4 text-[var(--gold-ink)]" aria-hidden="true" />
        <h3 className="text-base font-semibold text-[var(--ink)]">
          {t.result.blocks.timelineTitle}
        </h3>
        {!editable && (
          <div role="tablist" className="ms-auto inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5">
            {(['visual', 'list'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-[34px] px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === m ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
              >
                {m === 'visual' ? (locale === 'ar' ? 'مصوّر' : 'Visual') : locale === 'ar' ? 'قائمة' : 'List'}
              </button>
            ))}
          </div>
        )}
      </div>

      {visual && <VisualTimeline days={block.days} locale={locale} onInspectRule={onInspectRule} />}

      <div className={visual ? 'hidden' : 'space-y-7'}>
        {block.days.map((day, di) => (
          <div key={di}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-ink)] mb-4">
              {day.label}
            </h4>

            <ol className="relative border-s border-[var(--line)] ms-3 space-y-5">
              {day.items.map((item, ii) => (
                <li key={ii} className="ps-5 relative">
                  <span
                    aria-hidden="true"
                    className="absolute -start-[5px] top-1.5 w-2.5 h-2.5 rotate-45 bg-[var(--surface)] border border-[var(--gold)]"
                  />

                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    {editable ? (
                      <input
                        type="text"
                        value={item.time || ''}
                        onChange={(e) => {
                          const nextDays = block.days.map((d, dIdx) =>
                            dIdx !== di
                              ? d
                              : {
                                  ...d,
                                  items: d.items.map((it, iIdx) =>
                                    iIdx !== ii ? it : { ...it, time: e.target.value },
                                  ),
                                },
                          );
                          onChange({ ...block, days: nextDays });
                        }}
                        className="w-24 rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-0.5 text-xs font-mono tabular-nums"
                        dir="ltr"
                      />
                    ) : (
                      item.time && (
                        <span
                          className="text-xs font-semibold font-mono tabular-nums text-[var(--gold-ink)] shrink-0 min-w-[56px]"
                          dir="ltr"
                        >
                          {item.time}
                        </span>
                      )
                    )}

                    <div className="flex-1 space-y-1">
                      {editable ? (
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const nextDays = block.days.map((d, dIdx) =>
                              dIdx !== di
                                ? d
                                : {
                                    ...d,
                                    items: d.items.map((it, iIdx) =>
                                      iIdx !== ii ? it : { ...it, title: e.target.value },
                                    ),
                                  },
                            );
                            onChange({ ...block, days: nextDays });
                          }}
                          className="w-full rounded border border-[var(--line)] bg-[var(--bg)] px-2.5 py-1 text-sm font-medium text-[var(--ink)]"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                      )}

                      {item.detail && <p className="text-sm text-[var(--ink-2)]">{item.detail}</p>}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-3)]">
                        {item.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            <span>{item.location}</span>
                          </span>
                        )}
                        {item.ruleId && (
                          <>
                            {item.location && <span aria-hidden="true">·</span>}
                            <button
                              type="button"
                              onClick={() => onInspectRule?.(item.ruleId!)}
                              className="font-mono text-[11px] hover:text-[var(--ink)] underline cursor-pointer"
                              dir="ltr"
                            >
                              {item.ruleId}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Draft Block (Diplomatic Stationery Sheet)
// ---------------------------------------------------------------------------

function DraftBlockView({
  block,
  editable,
  onChange,
}: {
  block: DraftBlock;
  editable: boolean;
  onChange: (next: DraftBlock) => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard fallback
    }
  };

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-[var(--gold-ink)]" aria-hidden="true" />
          <h3 className="text-base font-semibold text-[var(--ink)]">
            {t.result.blocks.draftTitle}
          </h3>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void handleCopy()}>
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? t.result.blocks.draftCopied : t.result.blocks.draftCopy}</span>
        </Button>
      </div>

      {block.reviewRequired && (
        <div className="rounded-lg border border-[var(--warning)]/35 bg-[var(--surface-2)] px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[var(--warning)]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{t.result.blocks.draftReviewNotice}</span>
        </div>
      )}

      <div
        dir={block.language === 'ar' ? 'rtl' : 'ltr'}
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-4 sm:p-5 text-start"
      >
        {editable ? (
          <textarea
            value={block.text}
            rows={7}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className="w-full bg-transparent text-sm text-[var(--ink)] leading-relaxed focus:outline-none"
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--ink)] leading-relaxed">
            {block.text}
          </pre>
        )}
      </div>

      {block.notes.length > 0 && (
        <ul className="space-y-1 text-xs text-[var(--ink-2)]">
          {block.notes.map((note, idx) => (
            <li key={idx}>• {note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. Seating Block — Interactive 2D SVG Floorplan Infographic + Ordered List
// ---------------------------------------------------------------------------

function SeatingBlockView({
  block,
  editable,
  onChange,
  onInspectRule,
}: {
  block: SeatingBlock;
  editable: boolean;
  onChange: (next: SeatingBlock) => void;
  onInspectRule?: (ruleId: string) => void;
}) {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'diagram' | 'list'>('diagram');
  const [selectedSeatId, setSelectedSeatId] = useState<string>(block.seats[1]?.id || block.seats[0]?.id || '');
  const [playKey, setPlayKey] = useState(0);
  const [view3d, setView3d] = useState(false);
  const hallRef = useRef<Hall3DHandle>(null);
  const [no3d, setNo3d] = useState(false);
  const hallSeats: HallSeat[] = useMemo(() => {
    const plan = planLayout(block.layout, block.seats.length);
    return block.seats.map((s, i) => {
      const spot = plan.seats.find((p) => p.rank === s.rank) ?? plan.seats[i];
      const px = fromPercent(s.x, s.y);
      return { id: s.id, label: s.label, role: s.role, rank: s.rank ?? i + 1, x: px.x, y: px.y, facing: spot?.facing ?? 90 };
    });
  }, [block.layout, block.seats]);
  const svgRef = useRef<SVGSVGElement>(null);

  const sortedSeats = useMemo(
    () => [...block.seats].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    [block.seats],
  );

  const selectedSeat =
    block.seats.find((s) => s.id === selectedSeatId) ?? sortedSeats[0] ?? null;

  const swapSeatRank = (seatId: string, delta: -1 | 1) => {
    const ordered = [...sortedSeats];
    const idx = ordered.findIndex((s) => s.id === seatId);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= ordered.length) return;

    // Swap x/y coordinates and ranks between the two seats so visual position updates cleanly
    const a = ordered[idx];
    const b = ordered[targetIdx];
    const nextSeats = block.seats.map((s) => {
      if (s.id === a.id) {
        return { ...s, rank: b.rank, x: b.x, y: b.y };
      }
      if (s.id === b.id) {
        return { ...s, rank: a.rank, x: a.x, y: a.y };
      }
      return s;
    });

    onChange({ ...block, seats: nextSeats });
  };

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-[var(--gold-ink)]" aria-hidden="true" />
          <h3 className="text-base font-semibold text-[var(--ink)]">
            {t.result.blocks.seatingTitle}
          </h3>
        </div>

        {/* Accessible View Switcher (Section 7.6) */}
        <div role="tablist" className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'diagram'}
            onClick={() => setActiveTab('diagram')}
            className={`min-h-[36px] px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'diagram'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            {t.result.blocks.seatingDiagramTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'list'}
            onClick={() => setActiveTab('list')}
            className={`min-h-[36px] px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'list'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            {t.result.blocks.seatingListTab}
          </button>
        </div>
      </div>

      {/* Mandatory Precedence Warning (Section 9.3) */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[var(--ink-2)]">
        <ShieldAlert className="w-4 h-4 text-[var(--gold-ink)] shrink-0" aria-hidden="true" />
        <span>{t.result.blocks.seatingPrecedenceWarning}</span>
      </div>

      {activeTab === 'diagram' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={locale === 'ar' ? 'نمط العرض' : 'View mode'}>
            <button type="button" aria-pressed={!view3d} onClick={() => setView3d(false)} className="min-h-[36px] px-3 rounded-full border border-[var(--line)] text-xs font-semibold cursor-pointer aria-pressed:bg-[var(--primary)] aria-pressed:text-[var(--bg)] text-[var(--ink)]" data-testid="result-view-2d">{locale === 'ar' ? 'مخطط ثنائي' : '2D plan'}</button>
            <button type="button" aria-pressed={view3d} onClick={() => setView3d(true)} className="min-h-[36px] px-3 rounded-full border border-[var(--line)] text-xs font-semibold cursor-pointer aria-pressed:bg-[var(--primary)] aria-pressed:text-[var(--bg)] text-[var(--ink)]" data-testid="result-view-3d">{locale === 'ar' ? 'قاعة ثلاثية الأبعاد' : '3D hall'}</button>
          </div>
          {view3d && !no3d ? (
            <>
            <Hall3D
              ref={hallRef}
              plan={planLayout(block.layout, block.seats.length)}
              seats={hallSeats}
              selectedId={selectedSeat?.id}
              rtl={locale === 'ar'}
              preset="overview"
              presetNonce={0}
              onPick={setSelectedSeatId}
              onUnsupported={() => setNo3d(true)}
              ariaLabel={locale === 'ar' ? 'قاعة ثلاثية الأبعاد تدور بإصبعك' : 'Rotatable 3D hall'}
            />
            <GuestsEnter hall={hallRef} ar={locale === 'ar'} />
            </>
          ) : (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-2 sm:p-3 overflow-hidden">
            <SeatingFloorplan
              ref={svgRef}
              layout={block.layout}
              seats={block.seats}
              locale={locale}
              selectedId={selectedSeat?.id}
              onSelect={setSelectedSeatId}
              animateKey={playKey}
              ariaLabel={t.result.blocks.seatingTitle}
            />
          </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPlayKey((n) => n + 1)}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 text-xs font-bold text-[var(--bg)] cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              {locale === 'ar' ? 'شغّل الجلوس' : 'Play seating'}
            </button>
            <button
              type="button"
              onClick={() => svgRef.current && void downloadPng(svgRef.current, 'wijaha-seating')}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer"
            >
              <ImageDown className="w-3.5 h-3.5" aria-hidden="true" />
              {locale === 'ar' ? 'حمّل صورة' : 'Download image'}
            </button>
          </div>
          <SeatLegend seats={block.seats} locale={locale} selectedId={selectedSeat?.id} onSelect={setSelectedSeatId} />

          {/* Interactive Selected Seat Inspector
 + Swap Controls */}
          {selectedSeat && (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-semibold text-[var(--ink)] tabular-nums">
                  #{selectedSeat.rank ?? '-'} · {selectedSeat.label}
                </span>
                {selectedSeat.role && (
                  <span className="ms-2 text-xs text-[var(--ink-3)]">({selectedSeat.role})</span>
                )}
              </div>

              {editable && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => swapSeatRank(selectedSeat.id, -1)}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    <span>{t.result.blocks.swapSeatUp}</span>
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => swapSeatRank(selectedSeat.id, 1)}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    <span>{t.result.blocks.swapSeatDown}</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <ol className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-[var(--bg)]">
          {sortedSeats.map((seat) => (
            <li
              key={seat.id}
              className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[var(--surface-2)] text-[var(--ink)] text-xs font-bold tabular-nums flex items-center justify-center">
                  {seat.rank ?? '•'}
                </span>
                <span className="font-medium text-[var(--ink)]">{seat.label}</span>
              </div>
              {seat.role && <span className="text-xs text-[var(--ink-3)]">{seat.role}</span>}
            </li>
          ))}
        </ol>
      )}

      {/* Precedence Principles */}
      {block.principles.length > 0 && (
        <ul className="space-y-1.5 pt-2 text-xs text-[var(--ink-2)]">
          {block.principles.map((pr, idx) => (
            <li key={idx} className="flex flex-wrap items-center gap-2">
              <span>• {pr.text}</span>
              {pr.ruleId && (
                <button
                  type="button"
                  onClick={() => onInspectRule?.(pr.ruleId!)}
                  className="font-mono text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] underline cursor-pointer"
                  dir="ltr"
                >
                  {pr.ruleId}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6. Expert Review Block & Post-Result Expert Bridge Card
// ---------------------------------------------------------------------------

function ExpertReviewBlockView({
  block,
  projectId,
}: {
  block: ExpertReviewBlock;
  projectId?: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const target = `/request/${block.serviceId}${
    projectId ? `?projectId=${encodeURIComponent(projectId)}&trigger=high_sensitivity` : '?trigger=high_sensitivity'
  }`;

  return (
    <section className="rounded-xl border border-[var(--gold)]/45 bg-[var(--surface)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--gold-ink)]">
          <UserCheck className="w-4 h-4" aria-hidden="true" />
          <span>{t.result.blocks.expertReviewTitle}</span>
        </div>
        <h4 className="text-base font-semibold text-[var(--ink)]">
          {block.serviceTitle} · {block.recommendedExpertName}
        </h4>
        <p className="text-sm text-[var(--ink-2)] leading-relaxed">{block.reason}</p>
      </div>
      <Button variant="secondary" onClick={() => navigate(target)} className="shrink-0">
        {t.result.expertBridge.requestBtn}
      </Button>
    </section>
  );
}

export function ExpertBridgeCard({
  suggestion,
  projectId,
  onDismiss,
}: {
  suggestion: ExpertSuggestion;
  projectId?: string;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const url = `/request/${suggestion.serviceId}?trigger=${encodeURIComponent(suggestion.trigger)}${
    projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''
  }`;

  return (
    <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/75 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--gold-ink)]">
          {suggestion.expertName} · {suggestion.priceLabel}
        </p>
        <h3 className="text-base font-semibold text-[var(--ink)]">{suggestion.serviceTitle}</h3>
        <p className="text-sm text-[var(--ink-2)] leading-relaxed">{suggestion.reason}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="primary" size="sm" onClick={() => navigate(url)}>
          {t.result.expertBridge.requestBtn}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t.result.expertBridge.noThanks}
        </Button>
      </div>
    </aside>
  );
}
