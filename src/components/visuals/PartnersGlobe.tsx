import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GlobeScene } from '../three/globe-scene.ts';
import { CAPITALS, glowFor } from '../../shared/visuals/capitals.ts';
import { COUNTRY_NAMES, hijriOf, type Upcoming } from '../../shared/occasions.ts';

/**
 * "Partners globe": a navy globe whose partner capitals light up gold as their next national day nears,
 * inside a Hijri crescent year ring (the crescent marks today's Hijri date; dots mark the religious
 * occasions). Uses a bundled list of capital coordinates; no map tiles or external services.
 */

const MONTHS_AR = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
const MONTHS_EN = ['Muharram', 'Safar', 'Rabi I', 'Rabi II', 'Jumada I', 'Jumada II', 'Rajab', 'Shaban', 'Ramadan', 'Shawwal', 'Dhul-Qada', 'Dhul-Hijja'];

const angleOf = (month: number, day: number) => ((month - 1 + (day - 1) / 30) / 12) * Math.PI * 2 - Math.PI / 2;

export function PartnersGlobe({ items, partners, today, ar }: { items: Upcoming[]; partners: string[]; today: Date; ar: boolean }) {
  const host = useRef<HTMLDivElement | null>(null);
  const scene = useRef<GlobeScene | null>(null);
  const [no3d, setNo3d] = useState(false);

  const nextByCountry = useMemo(() => {
    const m = new Map<string, Upcoming>();
    for (const it of items) if (it.country && it.def.kind === 'national' && !m.has(it.country)) m.set(it.country, it);
    return m;
  }, [items]);

  const markers = useMemo(
    () => partners.filter((c) => CAPITALS[c]).map((c) => ({ code: c, ...CAPITALS[c], glow: glowFor(nextByCountry.get(c)?.daysUntil) })),
    [partners, nextByCountry],
  );
  const latest = useRef(markers);
  latest.current = markers;

  useEffect(() => {
    let alive = true;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    (async () => {
      try {
        const c = document.createElement('canvas');
        if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw new Error('no webgl');
        const mod = await import('../three/globe-scene.ts');
        if (!alive || !host.current) return;
        const s = new mod.GlobeScene(host.current);
        scene.current = s;
        s.setMarkers(latest.current);
        s.start();
        ro = new ResizeObserver(() => s.resize());
        ro.observe(host.current);
        io = new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? s.start() : s.stop()), { threshold: 0.01 });
        io.observe(host.current);
      } catch {
        setNo3d(true);
      }
    })();
    return () => {
      alive = false;
      ro?.disconnect();
      io?.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setMarkers(markers);
  }, [markers]);

  const h = hijriOf(today);
  const crescentA = angleOf(h.month, h.day);
  const religious = items.filter((it) => it.def.kind === 'religious' && it.def.hijri && it.daysUntil < 360);
  const ranked = [...nextByCountry.values()].filter((u) => partners.includes(u.country!)).sort((a, b) => a.daysUntil - b.daysUntil);
  const R = 182;

  return (
    <section className="wj-globe-card" aria-labelledby="globe-h" data-testid="partners-globe">
      <div className="wj-globe-stage">
        <svg viewBox="0 0 400 400" className="wj-hijri-ring" role="img" aria-label={ar ? `حلقة السنة الهجرية: اليوم ${h.day} ${MONTHS_AR[h.month - 1]} ${h.year} هـ تقريباً` : `Hijri year ring: today is about ${h.day} ${MONTHS_EN[h.month - 1]} ${h.year} AH`} data-testid="hijri-ring">
          <circle cx="200" cy="200" r={R} className="wj-hijri-track" />
          <circle
            cx="200" cy="200" r={R} className="wj-hijri-progress"
            strokeDasharray={`${((crescentA + Math.PI / 2) / (Math.PI * 2)) * 2 * Math.PI * R} ${2 * Math.PI * R}`}
            transform="rotate(-90 200 200)"
          />
          {Array.from({ length: 12 }, (_, i) => {
            const a = angleOf(i + 1, 1);
            const mid = angleOf(i + 1, 16);
            return (
              <g key={i}>
                <line x1={200 + Math.cos(a) * (R - 7)} y1={200 + Math.sin(a) * (R - 7)} x2={200 + Math.cos(a) * (R + 7)} y2={200 + Math.sin(a) * (R + 7)} className="wj-hijri-tick" />
                <text x={200 + Math.cos(mid) * (R - 30)} y={200 + Math.sin(mid) * (R - 30)} textAnchor="middle" dominantBaseline="middle" className={`wj-hijri-month ${i + 1 === h.month ? 'is-now' : ''}`}>
                  {(ar ? MONTHS_AR : MONTHS_EN)[i]}
                </text>
              </g>
            );
          })}
          {religious.map((u) => {
            const a = angleOf(u.def.hijri!.month, u.def.hijri!.day);
            return <circle key={u.def.id} cx={200 + Math.cos(a) * R} cy={200 + Math.sin(a) * R} r="4.5" className="wj-hijri-occ"><title>{ar ? u.def.nameAr : u.def.nameEn}</title></circle>;
          })}
          <g transform={`translate(${200 + Math.cos(crescentA) * R} ${200 + Math.sin(crescentA) * R})`} data-testid="hijri-crescent">
            <circle r="13" className="wj-hijri-crescent-bg" />
            <path d="M3 -8a9 9 0 1 0 0 16a7 7 0 1 1 0 -16z" className="wj-hijri-crescent" />
          </g>
        </svg>
        <div className="wj-globe-host" ref={host} aria-hidden="true" data-mode={no3d ? 'static' : '3d'}>
          {no3d && (
            <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-full h-full">
              <circle r="1" fill="#15275A" stroke="#E8C882" strokeOpacity=".4" strokeWidth=".01" />
              {markers.map((m) => {
                const lon = ((m.lon - 30) * Math.PI) / 180;
                const lat = (m.lat * Math.PI) / 180;
                return <circle key={m.code} cx={Math.cos(lat) * Math.sin(lon)} cy={-Math.sin(lat) + 0.3} r={0.025 + m.glow * 0.04} fill={m.glow > 0.05 ? '#FFD770' : '#6B7AA8'} />;
              })}
            </svg>
          )}
        </div>
      </div>
      <div className="wj-globe-legend">
        <h2 id="globe-h" className="text-lg font-bold text-[var(--ink)]">{ar ? 'كرة الشركاء' : 'Partners globe'}</h2>
        <p className="text-sm text-[var(--ink-2)] leading-relaxed">{ar ? 'تتوهّج عاصمة كل شريك بالذهبي كلما اقترب يومه الوطني. الحلقة سنة هجرية: الهلال موضع اليوم، والنقاط المناسبات الدينية (تواريخ تقريبية).' : 'Each partner capital glows gold as its national day nears. The ring is the Hijri year: the crescent marks today, dots mark religious occasions (approximate dates).'}</p>
        <ol className="mt-3 space-y-1.5">
          {ranked.slice(0, 6).map((u) => (
            <li key={u.country} className="flex items-center gap-2.5 text-sm">
              <span className="wj-globe-dot" style={{ opacity: 0.35 + glowFor(u.daysUntil) * 0.65 }} aria-hidden="true" />
              <span className="font-semibold text-[var(--ink)]">{ar ? COUNTRY_NAMES[u.country!].ar : COUNTRY_NAMES[u.country!].en}</span>
              <span className="text-[var(--ink-3)] tabular-nums ms-auto">{u.daysUntil === 0 ? (ar ? 'اليوم' : 'today') : ar ? `بعد ${u.daysUntil} يوماً` : `in ${u.daysUntil} days`}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
