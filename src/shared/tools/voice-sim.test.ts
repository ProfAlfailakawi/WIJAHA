import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PERSONAS, scoreAnswer } from './voice-sim.ts';

const t = PERSONAS[0].turns[0];

test('a courteous answer with a solution scores high', () => {
  const s = scoreAnswer(t, 'نعتذر منك طال عمرك، وسوف نرتب لك مقعداً في الصف الأول فوراً');
  assert.ok(s.score >= 90, String(s.score));
  assert.equal(s.tier, 'good');
});

test('blame and refusal are penalised', () => {
  const s = scoreAnswer(t, 'مو ذنبي هذا من القسم الثاني ومستحيل نغيره');
  assert.ok(s.score < 40, String(s.score));
  assert.equal(s.penalties.length, 2);
});

test('very short answers are capped', () => {
  assert.ok(scoreAnswer(t, 'تمام').score <= 30);
});

test('English answers work for the ambassador', () => {
  const s = scoreAnswer(PERSONAS[1].turns[0], 'I sincerely apologize, Your Excellency. I will correct the flag right away.');
  assert.ok(s.score >= 90, String(s.score));
});

test('every persona has bilingual reactions', () => {
  for (const p of PERSONAS) for (const turn of p.turns) for (const k of ['good', 'ok', 'bad'] as const) assert.equal(turn.reaction[k].length, 2);
});
