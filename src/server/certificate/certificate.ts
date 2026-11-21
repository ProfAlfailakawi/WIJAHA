import crypto from 'node:crypto';
import { EXAM, PASS_MARK } from '../../shared/tools/learn.ts';

/** Answer key: correct option index per question id. Server-side only; never shipped to the browser. */
const KEY: Record<string, number> = { q1: 1, q2: 0, q3: 1, q4: 1, q5: 0, q6: 1, q7: 1, q8: 1, q9: 0, q10: 1, q11: 1, q12: 1, q13: 1, q14: 1, q15: 1 };

export interface GradeResult {
  correct: number;
  total: number;
  passed: boolean;
  /** Modules with at least one wrong answer (guidance only; individual answers are not revealed). */
  reviewModules: string[];
}

export function gradeExam(answers: Record<string, unknown>): GradeResult {
  let correct = 0;
  const review = new Set<string>();
  for (const q of EXAM) {
    if (answers[q.id] === KEY[q.id]) correct++;
    else review.add(q.module);
  }
  return { correct, total: EXAM.length, passed: correct >= PASS_MARK, reviewModules: [...review] };
}

const b64 = (b: Buffer) => b.toString('base64url');

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const n = raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
  return n.length >= 2 && n.length <= 60 ? n : null;
}

export function signCertificate(secret: string, name: string, correct: number, total: number, at = new Date()): string {
  const payload = b64(Buffer.from(JSON.stringify([1, name, correct, total, Math.floor(at.getTime() / 86_400_000)])));
  const sig = b64(crypto.createHmac('sha256', secret).update(`cert:${payload}`).digest().subarray(0, 16));
  return `${payload}.${sig}`;
}

export interface VerifiedCertificate {
  name: string;
  correct: number;
  total: number;
  issuedOn: string;
}

export function verifyCertificate(secret: string, code: string): VerifiedCertificate | null {
  if (typeof code !== 'string' || code.length > 400 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(code)) return null;
  const [payload, sig] = code.split('.');
  const expect = b64(crypto.createHmac('sha256', secret).update(`cert:${payload}`).digest().subarray(0, 16));
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const [v, name, correct, total, days] = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as [number, string, number, number, number];
    if (v !== 1 || typeof name !== 'string') return null;
    return { name, correct, total, issuedOn: new Date(days * 86_400_000).toISOString().slice(0, 10) };
  } catch {
    return null;
  }
}
