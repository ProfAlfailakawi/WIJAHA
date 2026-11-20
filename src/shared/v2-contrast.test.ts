import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');

const channel = (c: number): number => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string): number => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const tokens = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));

const lightStart = css.indexOf(':root {\n  --navy-1');
const darkStart = css.indexOf('.dark {\n  --t-gold');
const light = tokens(css.slice(lightStart, darkStart));
const dark = tokens(css.slice(darkStart, css.indexOf('}', darkStart)));

for (const name of ['gold', 'teal', 'rose', 'indigo', 'violet']) {
  test(`v2 kicker contrast AA (light): ${name}`, () => {
    assert.ok(ratio(light[`c-${name}`], light[`t-${name}`]) >= 4.5, `${name} ${ratio(light[`c-${name}`], light[`t-${name}`]).toFixed(2)}`);
  });
  test(`v2 kicker contrast AA (dark): ${name}`, () => {
    assert.ok(ratio(dark[`c-${name}`], dark[`t-${name}`]) >= 4.5);
  });
}
