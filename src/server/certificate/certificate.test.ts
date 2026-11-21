import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXAM } from '../../shared/tools/learn.ts';
import { cleanName, gradeExam, signCertificate, verifyCertificate } from './certificate.ts';

const SECRET = 'x'.repeat(40);
const perfect = { q1: 1, q2: 0, q3: 1, q4: 1, q5: 0, q6: 1, q7: 1, q8: 1, q9: 0, q10: 1, q11: 1, q12: 1, q13: 1, q14: 1, q15: 1 };

test('key covers every exam question and grades correctly', () => {
  assert.equal(Object.keys(perfect).length, EXAM.length);
  assert.equal(gradeExam(perfect).passed, true);
  assert.equal(gradeExam(perfect).correct, 15);
  const r = gradeExam({ ...perfect, q1: 0, q2: 3, q3: 0, q4: 0 });
  assert.equal(r.correct, 11);
  assert.equal(r.passed, false);
  assert.deepEqual(r.reviewModules.sort(), ['m1', 'm2']);
  assert.equal(gradeExam({}).correct, 0);
});

test('every option index is in range', () => {
  for (const q of EXAM) assert.equal(q.optionsAr.length, 4);
});

test('certificates verify, and tampering or a wrong secret fails', () => {
  const code = signCertificate(SECRET, 'مختبر آلي', 14, 15, new Date('2026-11-20T10:00:00Z'));
  const v = verifyCertificate(SECRET, code);
  assert.equal(v?.name, 'مختبر آلي');
  assert.equal(v?.issuedOn, '2026-11-20');
  assert.equal(verifyCertificate('y'.repeat(40), code), null);
  const [p, s] = code.split('.');
  const forged = Buffer.from(JSON.stringify([1, 'Other', 15, 15, 20_000])).toString('base64url');
  assert.equal(verifyCertificate(SECRET, `${forged}.${s}`), null);
  assert.equal(verifyCertificate(SECRET, `${p}.AAAA`), null);
  assert.equal(verifyCertificate(SECRET, 'not a code'), null);
});

test('names are sanitised', () => {
  assert.equal(cleanName('  <b>Ali</b>  '), 'bAli/b');
  assert.equal(cleanName('a'), null);
  assert.equal(cleanName('x'.repeat(61)), null);
});
