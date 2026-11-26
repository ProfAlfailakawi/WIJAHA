import React, { useEffect, useRef, useState } from 'react';
import { Download, DoorOpen, Video } from 'lucide-react';
import type { Hall3DHandle } from '../three/Hall3D';

/**
 * "Guests enter": walks the figures in from the door to their seats in order of precedence, and can record
 * the walk as a short clip in the browser (MediaRecorder on the 3D canvas, where supported). Nothing leaves
 * the device; the clip is offered as a download link.
 */

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function GuestsEnter({ hall, ar, className }: { hall: React.RefObject<Hall3DHandle | null>; ar: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState(false);
  const [clip, setClip] = useState<{ url: string; ext: string } | null>(null);
  const [canRecord] = useState(() => {
    if (typeof document === 'undefined' || !pickMime()) return false;
    return typeof (document.createElement('canvas') as HTMLCanvasElement & { captureStream?: unknown }).captureStream === 'function';
  });
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const play = async () => {
    const h = hall.current;
    if (!h || busy) return;
    setBusy(true);
    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    const mime = record && canRecord ? pickMime() : null;
    const canvas = h.canvas();
    if (mime && canvas) {
      try {
        const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(30);
        recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        recorder.start(250);
      } catch {
        recorder = null;
      }
    }
    try {
      await h.walkIn();
      if (recorder) await new Promise((r) => setTimeout(r, 600));
    } finally {
      if (recorder && recorder.state !== 'inactive') {
        const rec = recorder;
        await new Promise<void>((resolve) => {
          rec.onstop = () => resolve();
          rec.stop();
        });
        if (chunks.length) {
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          const blob = new Blob(chunks, { type: mime ?? 'video/webm' });
          urlRef.current = URL.createObjectURL(blob);
          setClip({ url: urlRef.current, ext: (mime ?? '').includes('mp4') ? 'mp4' : 'webm' });
        }
      }
      setBusy(false);
    }
  };

  const btn = 'min-h-[40px] inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer disabled:opacity-50';
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`} data-testid="guests-enter">
      <button type="button" className={`${btn} !bg-[var(--primary)] !text-[var(--primary-fg)] !border-[var(--primary)]`} onClick={() => void play()} disabled={busy} data-testid="guests-enter-play">
        <DoorOpen className="w-4 h-4" aria-hidden="true" />
        {busy ? (ar ? 'الضيوف يدخلون…' : 'Guests entering…') : ar ? 'دخول الضيوف' : 'Guests enter'}
      </button>
      {canRecord && (
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--ink-2)] min-h-[40px] cursor-pointer">
          <input type="checkbox" checked={record} onChange={(e) => setRecord(e.target.checked)} disabled={busy} className="w-4 h-4 accent-[var(--gold)]" data-testid="guests-enter-record" />
          <Video className="w-4 h-4" aria-hidden="true" />
          {ar ? 'سجّل مقطعاً قصيراً' : 'Record a short clip'}
        </label>
      )}
      {clip && !busy && (
        <a href={clip.url} download={`wijaha-guests-enter.${clip.ext}`} className={btn} data-testid="guests-enter-clip">
          <Download className="w-4 h-4" aria-hidden="true" />
          {ar ? 'حمّل المقطع' : 'Download clip'}
        </a>
      )}
      <span className="sr-only" aria-live="polite">{busy ? (ar ? 'يدخل الضيوف بترتيب الأسبقية' : 'Guests are entering in order of precedence') : ''}</span>
    </div>
  );
}
