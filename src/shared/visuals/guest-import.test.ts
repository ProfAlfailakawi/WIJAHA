import test from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { MAX_GUESTS, parseGuestText, parseXlsxRows, rowsToGuests, splitCsvLine } from './guest-import.ts';

test('splitCsvLine honours quotes and escaped quotes', () => {
  assert.deepEqual(splitCsvLine('a,"b,c",d', ','), ['a', 'b,c', 'd']);
  assert.deepEqual(splitCsvLine('"he said ""hi""",x', ','), ['he said "hi"', 'x']);
});

test('pasted Excel (tab separated) with an Arabic header', () => {
  const r = parseGuestText('الاسم\tالمنصب\nضيف ١\tوزير التجارة\nضيف ٢\tمديرة إدارة');
  assert.equal(r.hadHeader, true);
  assert.deepEqual(r.guests.map((g) => [g.name, g.title]), [['ضيف ١', 'وزير التجارة'], ['ضيف ٢', 'مديرة إدارة']]);
});

test('CSV with English header and quoted comma', () => {
  const r = parseGuestText('Name,Title\n"Smith, John",Ambassador\nLee,Director');
  assert.equal(r.guests.length, 2);
  assert.equal(r.guests[0].name, 'Smith, John');
  assert.equal(r.guests[0].title, 'Ambassador');
});

test('single column and "Name - Title" lines', () => {
  const a = parseGuestText('ضيف أ\nضيف ب');
  assert.deepEqual(a.guests.map((g) => g.name), ['ضيف أ', 'ضيف ب']);
  const b = parseGuestText('ضيف ج - سفير\nضيف د - وكيل وزارة');
  assert.deepEqual(b.guests.map((g) => g.title), ['سفير', 'وكيل وزارة']);
});

test('an Arabic comma inside a name does not split it', () => {
  const r = parseGuestText('ضيف، الأول');
  assert.equal(r.guests.length, 1);
});

test('blank names are skipped and the list is capped', () => {
  const rows = Array.from({ length: MAX_GUESTS + 5 }, (_, i) => [`ضيف ${i + 1}`, 'مدير']);
  rows.push(['', 'لا اسم له']);
  const r = rowsToGuests(rows);
  assert.equal(r.guests.length, MAX_GUESTS);
  assert.equal(r.skipped, 6);
});

function makeXlsx(): Uint8Array {
  const shared = ['الاسم', 'المنصب', 'ضيف &amp; ضيف', 'وزير'];
  const sst = `<?xml version="1.0"?><sst>${shared.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
    <row r="3"><c r="A3" t="inlineStr"><is><t>ضيف د</t></is></c><c r="C3"><v>7</v></c></row>
  </sheetData></worksheet>`;
  return zipSync({ 'xl/sharedStrings.xml': strToU8(sst), 'xl/worksheets/sheet1.xml': strToU8(sheet) });
}

test('parseXlsxRows reads shared strings, inline strings, entities and sparse columns', () => {
  const rows = parseXlsxRows(makeXlsx());
  assert.deepEqual(rows[0], ['الاسم', 'المنصب']);
  assert.deepEqual(rows[1], ['ضيف & ضيف', 'وزير']);
  assert.deepEqual(rows[2], ['ضيف د', '', '7']);
  const r = rowsToGuests(rows);
  assert.equal(r.hadHeader, true);
  assert.equal(r.guests.length, 2);
});

test('parseXlsxRows tolerates a file with no worksheet', () => {
  assert.deepEqual(parseXlsxRows(zipSync({ 'readme.txt': strToU8('x') })), []);
});
