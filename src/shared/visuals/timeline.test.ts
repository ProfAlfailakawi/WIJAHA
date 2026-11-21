import test from 'node:test';
import assert from 'node:assert/strict';
import { inferTimelineKind } from './timeline.ts';

const cases: Array<[string, string]> = [
  ['وصول الوفد إلى المطار', 'arrival'],
  ['الاستقبال الرسمي عند الباب', 'welcome'],
  ['ضيافة القهوة والتمر', 'coffee'],
  ['اجتماع المباحثات الثنائية', 'meeting'],
  ['غداء رسمي على شرف الوفد', 'meal'],
  ['صلاة الظهر', 'prayer'],
  ['تبادل الهدايا التذكارية', 'gift'],
  ['الصورة التذكارية', 'photo'],
  ['توقيع مذكرة التفاهم', 'signing'],
  ['الانتقال بالمواكب إلى المقر', 'transfer'],
  ['مغادرة الوفد', 'departure'],
  ['Arrival at the airport', 'arrival'],
  ['Welcome by the protocol officer', 'welcome'],
  ['Working lunch', 'meal'],
  ['Signing ceremony', 'signing'],
  ['استراحة قصيرة', 'rest'],
  ['شيء آخر تماماً', 'generic'],
];
for (const [text, kind] of cases) test(`timeline kind: ${text}`, () => assert.equal(inferTimelineKind(text), kind));
