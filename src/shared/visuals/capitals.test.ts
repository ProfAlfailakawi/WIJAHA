import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPITALS, glowFor } from './capitals.ts';
import { COVERED } from '../occasions.ts';

test('every covered country has a capital on the globe', () => {
  for (const c of COVERED) {
    assert.ok(CAPITALS[c], c);
    assert.ok(Math.abs(CAPITALS[c].lat) <= 90 && Math.abs(CAPITALS[c].lon) <= 180);
  }
});

test('glow rises as the day nears', () => {
  assert.equal(glowFor(0), 1);
  assert.equal(glowFor(undefined), 0);
  assert.equal(glowFor(500), 0);
  assert.ok(glowFor(10) > glowFor(60));
});
