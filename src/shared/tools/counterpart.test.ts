import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reactionFor, REACTION_POSES, REACTION_TEXT } from './counterpart.ts';

test('the counterpart reaction follows the option scores', () => {
  assert.equal(reactionFor({ C1: 3, C6: 3 }), 'warm');
  assert.equal(reactionFor({ C1: 2, C6: 2 }), 'approving');
  assert.equal(reactionFor({ C1: 1, C6: 1 }), 'reserved');
  assert.equal(reactionFor({ C1: 1, C6: 0 }), 'displeased');
  assert.equal(reactionFor({ C1: 0, C6: 0 }), 'displeased');
  assert.equal(reactionFor(undefined), 'approving');
});

test('every reaction has a pose and bilingual text', () => {
  for (const k of Object.keys(REACTION_TEXT) as Array<keyof typeof REACTION_TEXT>) {
    assert.ok(REACTION_POSES[k]);
    assert.ok(REACTION_TEXT[k].ar && REACTION_TEXT[k].en);
  }
});
