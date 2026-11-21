import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkManual, searchManual } from './org-manual.ts';
import { CHECKLISTS, scoreChecks } from './photo-checklists.ts';

const manual = `# الاستقبال
عند وصول الضيف الرئيسي يستقبله المدير العام عند المدخل ثم يرافقه إلى قاعة الاجتماعات.

# الهدايا
لا تقبل الجهة هدايا تتجاوز قيمتها مئة دينار، وتُسجَّل جميع الهدايا في السجل.

# الزي
الزي الرسمي إلزامي في الفعاليات الخارجية.`;

test('manual is split by headings', () => {
  const c = chunkManual(manual);
  assert.equal(c.length, 3);
  assert.equal(c[1].heading, 'الهدايا');
});

test('search finds the relevant rule and ignores unrelated ones', () => {
  const c = chunkManual(manual);
  const hits = searchManual(c, 'ما سياسة الهدايا وقيمتها؟');
  assert.equal(hits[0].chunk.heading, 'الهدايا');
  assert.equal(searchManual(c, 'طيران الطائرة').length, 0);
});

test('photo score ignores n/a and lists failures', () => {
  const items = CHECKLISTS.podium;
  const marks: Record<string, 'ok' | 'bad' | 'na'> = {};
  items.forEach((i, n) => (marks[i.id] = n === 0 ? 'bad' : n === 1 ? 'na' : 'ok'));
  const r = scoreChecks('podium', marks);
  assert.equal(r.bad.length, 1);
  assert.equal(r.answered, items.length - 1);
  assert.equal(r.score, Math.round(((items.length - 2) / (items.length - 1)) * 100));
});
