import test from 'node:test';
import assert from 'node:assert/strict';
import { pointsFromResult, shorten } from './card-points.ts';
import { wrapText } from '../../components/visuals/svg-kit.tsx';
import type { WijahaResult } from '../types.ts';

const base = { summary: [], blocks: [] } as unknown as WijahaResult;

test('shorten keeps short text and cuts long text on a word boundary with an ellipsis', () => {
  assert.equal(shorten('قصير'), 'قصير');
  const long = 'كلمة '.repeat(60);
  const out = shorten(long, 50);
  assert.ok(out.length <= 50 && out.endsWith('…'));
  assert.ok(!out.slice(0, -1).endsWith(' '));
});

test('pointsFromResult takes up to five distinct readable points, answers first', () => {
  const result = {
    ...base,
    summary: ['ملخص أول طويل بما يكفي ليُعتمد كنقطة'],
    blocks: [
      { type: 'answer', points: ['نقطة أولى واضحة ومفيدة', 'نقطة أولى واضحة ومفيدة', 'قصيرة', 'نقطة ثانية واضحة ومفيدة'].map((text) => ({ text, level: 'customary' })) },
      { type: 'checklist', groups: [{ title: 'g', items: ['بند ثالث من قائمة التجهيز', 'بند رابع من قائمة التجهيز', 'بند خامس من قائمة التجهيز', 'بند سادس لا يدخل'].map((text) => ({ text })) }] },
    ],
  } as unknown as WijahaResult;
  const pts = pointsFromResult(result);
  assert.equal(pts.length, 5);
  assert.equal(new Set(pts).size, 5);
  assert.equal(pts[0], 'نقطة أولى واضحة ومفيدة');
  assert.ok(!pts.includes('قصيرة'));
});

test('wrapText wraps by measured width and truncates with an ellipsis at the line limit', () => {
  const measure = (s: string) => s.length * 10;
  assert.deepEqual(wrapText('aa bb cc dd', 50, measure), ['aa bb', 'cc dd']);
  assert.deepEqual(wrapText('a', 5, measure), ['a']);
  const lines = wrapText('aaaa bbbb cccc dddd eeee', 45, measure, 2);
  assert.equal(lines.length, 2);
  assert.ok(lines[1].endsWith('…'));
});
