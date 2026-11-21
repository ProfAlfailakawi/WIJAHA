import test from 'node:test';
import assert from 'node:assert/strict';
import { findViolations, sortByPrecedence, swap, titleTier } from './precedence.ts';

const cases: Array<[string, number]> = [
  ['وزير التعليم العالي', 7],
  ['معالي الوزير', 7],
  ['سفير دولة الكويت', 6],
  ['وكيل وزارة الخارجية', 5],
  ['رئيس جامعة الكويت', 5],
  ['المدير العام', 4],
  ['مدير إدارة المراسم', 3],
  ['دكتور في القانون', 2],
  ['موظف', 1],
  ['ولي العهد', 9],
  ['رئيس مجلس الوزراء', 9],
  ['Minister of Foreign Affairs', 7],
  ['Ambassador of Japan', 6],
  ['Chief Executive Officer', 4],
  ['Professor of Law', 3],
  ['His Highness', 8],
  ['', 1],
];
for (const [t, tier] of cases) test(`tier: ${t || '(empty)'}`, () => assert.equal(titleTier(t), tier));

test('sortByPrecedence orders by tier and keeps entry order for ties', () => {
  const g = [
    { id: 'a', title: 'مدير' },
    { id: 'b', title: 'وزير' },
    { id: 'c', title: 'سفير' },
    { id: 'd', title: 'مدير' },
  ];
  assert.deepEqual(sortByPrecedence(g).map((x) => x.id), ['b', 'c', 'a', 'd']);
});

test('findViolations flags a lower tier seated before a higher one, and nothing for a correct order', () => {
  const ok = sortByPrecedence([{ id: 'a', title: 'مدير' }, { id: 'b', title: 'وزير' }]);
  assert.deepEqual(findViolations(ok), []);
  const bad = [{ id: 'a', title: 'مدير' }, { id: 'b', title: 'وزير' }];
  assert.deepEqual(findViolations(bad), [{ higher: 'b', lower: 'a' }]);
});

test('swap is pure and bounds-safe', () => {
  const l = [1, 2, 3];
  assert.deepEqual(swap(l, 0, 2), [3, 2, 1]);
  assert.deepEqual(l, [1, 2, 3]);
  assert.equal(swap(l, 0, 9), l);
});
