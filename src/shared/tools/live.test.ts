import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyDelay, buildSchedule, EMERGENCIES, formatCountdown, statusAt, TEMPLATES } from './live.ts';

const start = new Date('2026-12-01T10:00:00Z');
const t = TEMPLATES[0];

test('schedule is built relative to the start and stays ordered', () => {
  const s = buildSchedule(t, start);
  assert.equal(s[0].start.toISOString(), '2026-12-01T08:30:00.000Z');
  for (let i = 1; i < s.length; i++) assert.ok(s[i].start >= s[i - 1].start);
});

test('status reports phase, current and next', () => {
  const s = buildSchedule(t, start);
  assert.equal(statusAt(s, new Date('2026-12-01T07:00:00Z')).phase, 'before');
  const run = statusAt(s, new Date('2026-12-01T10:03:00Z'));
  assert.equal(run.phase, 'running');
  assert.equal(run.current?.en, 'Principal guest arrives: welcome and greeting');
  assert.equal(run.next?.index, run.current!.index + 1);
  assert.equal(statusAt(s, new Date('2026-12-01T20:00:00Z')).phase, 'done');
});

test('delay only moves what has not finished', () => {
  const s = buildSchedule(t, start);
  const now = new Date('2026-12-01T10:03:00Z');
  const d = applyDelay(s, now, 10);
  assert.equal(d[0].start.getTime(), s[0].start.getTime());
  assert.equal(d[5].start.getTime(), s[5].start.getTime() + 600_000);
  const cur = statusAt(s, now).current!.index;
  assert.equal(d[cur].start.getTime(), s[cur].start.getTime());
  assert.equal(d[cur].end.getTime(), s[cur].end.getTime() + 600_000);
});

test('countdown formatting and emergency content', () => {
  assert.equal(formatCountdown(65), '01:05');
  assert.equal(formatCountdown(3725), '1:02:05');
  for (const e of EMERGENCIES) {
    assert.ok(e.stepsAr.length >= 3 && e.stepsAr.length === e.stepsEn.length, e.id);
  }
});
