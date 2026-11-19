import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSimulationReportPure } from './engine.ts';

test('D1/D2: report only scores assessed competencies and names them with session evidence', () => {
  const report = buildSimulationReportPure({
    runId: 'run_1',
    scenarioId: 'SC-1',
    scenarioTitleAr: 'الوفد وصل مبكراً',
    scenarioTitleEn: 'Early arrival',
    competencies: ['C1', 'C6'],
    nodes: [],
    steps: [
      { nodeId: 'n1', scores: { C1: 3 }, feedbackAr: 'استقبلت الوفد في الصالة الرسمية.', feedbackEn: 'You received them formally.', ruleIds: ['R-1'] },
      { nodeId: 'n2', scores: { C6: 1 }, feedbackAr: 'تأخر إبلاغ المضيف.', feedbackEn: 'The host was told late.', ruleIds: ['R-2'] },
    ],
    locale: 'ar',
  });
  assert.deepEqual(report.competencyBreakdown.map((c) => c.competency).sort(), ['C1', 'C6']);
  assert.ok(report.strengths[0].noteAr.startsWith('الاستقبال والتوديع'));
  assert.ok(report.strengths[0].noteAr.includes('استقبلت الوفد'));
  const gap = report.gaps.find((g) => g.competency === 'C6');
  assert.ok(gap && gap.noteAr.startsWith('المواقف الطارئة'));
  assert.equal(gap?.exampleAr, 'تأخر إبلاغ المضيف.');
});
