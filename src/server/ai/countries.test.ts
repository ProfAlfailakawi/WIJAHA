import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic } from '../../shared/arabic.ts';
import { detectCountry } from './countries.ts';

const iso = (q: string) => detectCountry(normalizeArabic(q))?.iso;

const cases: Array<[string, string | undefined]> = [
  ['وفد من سلطنة عمان يزور الكويت', 'OM'],
  ['وفد أردني يزورنا', 'JO'],
  ['وفد من الأردن في عمّان', 'JO'],
  ['سنسافر إلى مسقط الأسبوع القادم', 'OM'],
  ['استقبال وفد سعودي', 'SA'],
  ['وفد من الإمارات وقطر', 'AE'],
  ['زيارة الدوحة', 'QA'],
  ['وفد بحريني', 'BH'],
  ['وفد مصري رفيع', 'EG'],
  ['التسوية في المصرف', undefined],
  ['الاجتماع بعد صلاة المغرب', undefined],
  ['وفد مغربي', 'MA'],
  ['وفد من المغرب غداً', 'MA'],
  ['اليمين واليسار على الطاولة', undefined],
  ['وفد من لبنان', 'LB'],
  ['وفد عراقي', 'IQ'],
  ['ضيوف من دول الخليج', 'GCC'],
  ['a delegation from Kuwait and Saudi Arabia', 'KW'],
  ['وفد هندي', 'IN'],
  ['دورة في الهندسة المعمارية', undefined],
];
for (const [q, want] of cases) {
  test(`country: ${q}`, () => assert.equal(iso(q), want));
}
