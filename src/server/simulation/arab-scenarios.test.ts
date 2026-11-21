import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_KNOWLEDGE_RULES, SEED_SCENARIOS } from '../../db/seed-data.ts';
import { nextScenarioId } from './engine.ts';

const ruleIds = new Set(SEED_KNOWLEDGE_RULES.map((r) => r.id));
const arab = SEED_SCENARIOS.filter((s) => s.id.startsWith('SCN-ARAB-'));

test('arab scenarios: four drafts exist with unique ids', () => {
  assert.equal(arab.length, 4);
  assert.equal(new Set(SEED_SCENARIOS.map((s) => s.id)).size, SEED_SCENARIOS.length);
  for (const s of arab) assert.equal(s.status, 'draft');
});

for (const sc of arab) {
  test(`arab scenario ${sc.id}: graph is consistent`, () => {
    const nodeIds = new Set(sc.nodes.map((n) => n.id));
    assert.ok(sc.nodes.some((n) => n.isEnd), 'has an end node');
    for (const n of sc.nodes) {
      if (n.isEnd) continue;
      assert.ok(n.options && n.options.length >= 2, `${n.id} has options`);
      const scoreKeys = new Set<string>();
      for (const o of n.options!) {
        assert.ok(nodeIds.has(o.next), `${n.id}/${o.id} next ${o.next} exists`);
        assert.ok(o.feedbackAr.length > 20 && o.feedbackEn.length > 20, `${o.id} feedback`);
        assert.ok(o.ruleIds.length > 0 && o.ruleIds.every((id) => ruleIds.has(id)), `${o.id} rule ids exist`);
        for (const [k, v] of Object.entries(o.scores)) {
          assert.ok(sc.competencies.includes(k as never), `${o.id} scores unknown competency ${k}`);
          assert.ok(v >= 0 && v <= 3, `${o.id} score range`);
          scoreKeys.add(k);
        }
      }
      // Every step offers at least one fully correct and one clearly poor option.
      const best = Math.max(...n.options!.map((o) => Math.max(...Object.values(o.scores))));
      const worst = Math.min(...n.options!.map((o) => Math.min(...Object.values(o.scores))));
      assert.equal(best, 3, `${n.id} has a best answer`);
      assert.ok(worst <= 1, `${n.id} has a weak answer`);
    }
    // Every node is reachable from the first.
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      sc.nodes.find((n) => n.id === id)?.options?.forEach((o) => walk(o.next));
    };
    walk(sc.nodes[0].id);
    assert.equal(seen.size, sc.nodes.length, 'all nodes reachable');
  });
}

test('recommended next scenario cycles through the catalogue', () => {
  assert.equal(nextScenarioId('SCN-DEMO-01'), 'SCN-DEMO-02');
  assert.equal(nextScenarioId('SCN-ARAB-04'), 'SCN-DEMO-01');
  assert.equal(nextScenarioId('unknown'), 'SCN-DEMO-01');
});
