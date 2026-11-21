import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lerpPose, POSE_INFO, POSE_ORDER, POSES } from './poses.ts';

test('every described pose has data and bilingual advice', () => {
  for (const p of POSE_INFO) {
    assert.ok(POSES[p.id], p.id);
    assert.ok(p.tipAr.length > 20 && p.tipEn.length > 20, p.id);
    assert.ok(p.verdict === 'do' || p.verdict === 'avoid');
  }
  assert.equal(POSE_ORDER.length, Object.keys(POSES).length);
});

test('interpolation hits both ends and stays between', () => {
  const a = POSES.stand;
  const b = POSES.seated;
  assert.equal(lerpPose(a, b, 0).hipY, a.hipY);
  assert.equal(lerpPose(a, b, 1).hipY, b.hipY);
  const mid = lerpPose(a, b, 0.5);
  assert.ok(mid.hipY < a.hipY && mid.hipY > b.hipY);
  assert.equal(mid.prop, b.prop);
});

test('the avoid pose really differs from the good one in the legs', () => {
  assert.ok(POSES.majlisAvoid.legL.knee < 20 && POSES.majlisGood.legL.knee > 100);
});
