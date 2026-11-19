import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { BRAND } from '../../config/brand.ts';
import type { WijahaResult } from '../../shared/types.ts';

const execFileAsync = promisify(execFile);

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function generateProjectDocx(params: {
  result: WijahaResult;
  versionNumber: number;
  orgName?: string;
  watermarked: boolean;
}): Promise<Buffer> {
  const { result, versionNumber, orgName, watermarked } = params;
  const isAr = result.locale === 'ar';
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const paragraphs: Paragraph[] = [];

  // Header brand + watermark notice if free plan
  paragraphs.push(
    new Paragraph({
      bidirectional: isAr,
      alignment: align,
      children: [
        new TextRun({
          text: `${isAr ? BRAND.nameAr : BRAND.nameEn}${orgName ? ` — ${orgName}` : ''}`,
          bold: true,
          size: 24,
          color: '14213D',
        }),
      ],
    }),
  );

  if (watermarked) {
    paragraphs.push(
      new Paragraph({
        bidirectional: isAr,
        alignment: align,
        children: [
          new TextRun({
            text: isAr
              ? '[نسخة باقة مجانية بعلامة وجاهة — محتوى تجريبي للمراجعة]'
              : '[WIJAHA Free Tier Watermark — Demo Advisory Output]',
            italics: true,
            size: 18,
            color: '755627',
          }),
        ],
      }),
    );
  }

  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      bidirectional: isAr,
      alignment: align,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: result.title, bold: true, size: 34, color: '14213D' })],
    }),
  );

  paragraphs.push(
    new Paragraph({
      bidirectional: isAr,
      alignment: align,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: isAr
            ? `الإصدار v${versionNumber} · التاريخ: ${new Date().toISOString().slice(0, 10)}`
            : `Version v${versionNumber} · Date: ${new Date().toISOString().slice(0, 10)}`,
          size: 20,
          color: '596275',
        }),
      ],
    }),
  );

  // Summary
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      bidirectional: isAr,
      alignment: align,
      children: [
        new TextRun({
          text: isAr ? 'أهم 3 أولويات تنفيذية' : 'Top 3 Priorities',
          bold: true,
          size: 26,
        }),
      ],
    }),
  );

  for (const s of result.summary) {
    paragraphs.push(
      new Paragraph({
        bidirectional: isAr,
        alignment: align,
        bullet: { level: 0 },
        children: [new TextRun({ text: s, size: 22 })],
      }),
    );
  }

  // Blocks
  for (const block of result.blocks) {
    if (block.type === 'answer') {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          bidirectional: isAr,
          alignment: align,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: isAr ? 'الإرشادات البروتوكولية' : 'Protocol Guidance',
              bold: true,
              size: 26,
            }),
          ],
        }),
      );
      for (const pt of block.points) {
        paragraphs.push(
          new Paragraph({
            bidirectional: isAr,
            alignment: align,
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: `${pt.text}${pt.ruleId ? ` [${pt.ruleId}]` : ''}`,
                size: 22,
              }),
            ],
          }),
        );
      }
    } else if (block.type === 'checklist') {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          bidirectional: isAr,
          alignment: align,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: isAr ? 'قائمة التجهيز التنفيذية' : 'Readiness Checklist',
              bold: true,
              size: 26,
            }),
          ],
        }),
      );
      for (const grp of block.groups) {
        paragraphs.push(
          new Paragraph({
            bidirectional: isAr,
            alignment: align,
            children: [new TextRun({ text: grp.title, bold: true, size: 23 })],
          }),
        );
        for (const item of grp.items) {
          paragraphs.push(
            new Paragraph({
              bidirectional: isAr,
              alignment: align,
              bullet: { level: 0 },
              children: [
                new TextRun({
                  text: `[${item.completed ? '✓' : ' '}] ${item.text}${item.when ? ` (${item.when})` : ''}`,
                  size: 22,
                }),
              ],
            }),
          );
        }
      }
    } else if (block.type === 'timeline') {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          bidirectional: isAr,
          alignment: align,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: isAr ? 'الجدول الزمني وبرنامج الزيارة' : 'Visit Itinerary',
              bold: true,
              size: 26,
            }),
          ],
        }),
      );
      for (const day of block.days) {
        paragraphs.push(
          new Paragraph({
            bidirectional: isAr,
            alignment: align,
            children: [new TextRun({ text: day.label, bold: true, size: 23 })],
          }),
        );
        for (const it of day.items) {
          paragraphs.push(
            new Paragraph({
              bidirectional: isAr,
              alignment: align,
              bullet: { level: 0 },
              children: [
                new TextRun({
                  text: `${it.time ? `${it.time} — ` : ''}${it.title}${it.detail ? `: ${it.detail}` : ''}`,
                  size: 22,
                }),
              ],
            }),
          );
        }
      }
    } else if (block.type === 'draft') {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          bidirectional: isAr,
          alignment: align,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: isAr ? 'مسودة المراسلة المقترحة' : 'Correspondence Draft',
              bold: true,
              size: 26,
            }),
          ],
        }),
      );
      for (const line of block.text.split('\n')) {
        paragraphs.push(
          new Paragraph({
            bidirectional: block.language === 'ar',
            alignment: block.language === 'ar' ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: [new TextRun({ text: line, size: 22 })],
          }),
        );
      }
    } else if (block.type === 'seating') {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          bidirectional: isAr,
          alignment: align,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: isAr
                ? 'ترتيب الجلوس والأسبقية (اقتراح للمراجعة)'
                : 'Seating & Precedence Order (Advisory)',
              bold: true,
              size: 26,
            }),
          ],
        }),
      );
      for (const seat of block.seats) {
        paragraphs.push(
          new Paragraph({
            bidirectional: isAr,
            alignment: align,
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: `${seat.rank ? `#${seat.rank} ` : ''}${seat.label}${seat.role ? ` — ${seat.role}` : ''}`,
                size: 22,
              }),
            ],
          }),
        );
      }
    }
  }

  // Mandatory footer per Section 10.5
  paragraphs.push(
    new Paragraph({
      bidirectional: isAr,
      alignment: align,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: isAr
            ? 'أُعد بمساعدة وجاهة — يُراجع قبل الاعتماد الرسمي. (محتوى القواعد التجريبية للمعاينة فقط)'
            : 'Prepared with WIJAHA — Review prior to official sign-off. (Demo preview rules)',
          italics: true,
          size: 18,
          color: '596275',
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export function buildOfficialPrintHtml(params: {
  result: WijahaResult;
  versionNumber: number;
  orgName?: string;
  watermarked: boolean;
}): string {
  const { result, versionNumber, orgName, watermarked } = params;
  const isAr = result.locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const blocksHtml = result.blocks
    .map((b) => {
      if (b.type === 'answer') {
        return `<section class="block"><h2>${isAr ? 'الإرشادات المركزة' : 'Focused Guidance'}</h2><ul>${b.points
          .map((p) => `<li>${escapeHtml(p.text)} <small>(${escapeHtml(p.level)})</small></li>`)
          .join('')}</ul></section>`;
      }
      if (b.type === 'checklist') {
        return `<section class="block"><h2>${isAr ? 'قائمة التجهيز التنفيذية' : 'Operational Checklist'}</h2>${b.groups
          .map(
            (g) =>
              `<h3>${escapeHtml(g.title)}</h3><ul>${g.items
                .map(
                  (it) =>
                    `<li>${it.completed ? '☑' : '☐'} ${escapeHtml(it.text)}${
                      it.when ? ` — <em>${escapeHtml(it.when)}</em>` : ''
                    }</li>`,
                )
                .join('')}</ul>`,
          )
          .join('')}</section>`;
      }
      if (b.type === 'timeline') {
        return `<section class="block"><h2>${isAr ? 'برنامج الزيارة والجدول الزمني' : 'Visit Itinerary'}</h2>${b.days
          .map(
            (d) =>
              `<h3>${escapeHtml(d.label)}</h3><ul>${d.items
                .map(
                  (it) =>
                    `<li><strong>${escapeHtml(it.time || '')}</strong> ${escapeHtml(it.title)}${
                      it.detail ? ` — ${escapeHtml(it.detail)}` : ''
                    }</li>`,
                )
                .join('')}</ul>`,
          )
          .join('')}</section>`;
      }
      if (b.type === 'draft') {
        return `<section class="block"><h2>${isAr ? 'مسودة المراسلة' : 'Correspondence Draft'}</h2><pre class="draft">${escapeHtml(
          b.text,
        )}</pre></section>`;
      }
      if (b.type === 'seating') {
        return `<section class="block"><h2>${
          isAr ? 'مخطط ترتيب الجلوس والأسبقية' : 'Seating & Precedence Plan'
        }</h2><p class="notice">${
          isAr
            ? 'ترتيب الأسبقية الرسمي تحدده الجهة المضيفة؛ هذا اقتراح للمراجعة.'
            : 'Official order of precedence is determined by the host institution.'
        }</p><ol>${b.seats
          .map(
            (s) =>
              `<li><strong>${escapeHtml(s.label)}</strong>${
                s.role ? ` · ${escapeHtml(s.role)}` : ''
              }</li>`,
          )
          .join('')}</ol></section>`;
      }
      return '';
    })
    .join('\n');

  return `<!doctype html>
<html lang="${result.locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(result.title)}</title>
<style>
  body { font-family: "IBM Plex Sans Arabic", "DejaVu Sans", system-ui, sans-serif; color: #14213D; background: #fff; margin: 36px; line-height: 1.7; }
  header { border-bottom: 2px solid #B08D57; padding-bottom: 14px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: baseline; }
  h1 { font-size: 24px; margin: 0 0 8px 0; }
  h2 { font-size: 18px; color: #14213D; border-bottom: 1px solid #E4DCCB; padding-bottom: 6px; margin-top: 22px; }
  h3 { font-size: 15px; color: #3D4A63; margin-top: 12px; }
  .meta { font-size: 13px; color: #596275; }
  .watermark { background: #FAF7F0; border: 1px solid #E4DCCB; padding: 6px 12px; font-size: 12px; color: #755627; margin-bottom: 16px; border-radius: 6px; }
  .draft { white-space: pre-wrap; background: #FAF7F0; padding: 14px; border: 1px solid #E4DCCB; border-radius: 8px; font-family: inherit; }
  .notice { font-size: 13px; color: #7D5100; }
  footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #E4DCCB; font-size: 12px; color: #596275; }
</style>
</head>
<body>
  ${
    watermarked
      ? `<div class="watermark">${
          isAr
            ? 'علامة وجاهة (الباقة المجانية) — مخرجات استرشادية للمراجعة'
            : 'WIJAHA Free Tier Watermark — Advisory Output for Review'
        }</div>`
      : ''
  }
  <header>
    <div>
      <strong>${isAr ? BRAND.nameAr : BRAND.nameEn}</strong>
      ${orgName ? ` · <span>${escapeHtml(orgName)}</span>` : ''}
    </div>
    <div class="meta">v${versionNumber} · ${new Date().toISOString().slice(0, 10)}</div>
  </header>
  <h1>${escapeHtml(result.title)}</h1>
  <section class="block">
    <h2>${isAr ? 'أهم 3 أشياء الآن' : 'Top 3 Priorities'}</h2>
    <ul>${result.summary.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
  </section>
  ${blocksHtml}
  <footer>
    ${
      isAr
        ? 'أُعد بمساعدة وجاهة — يُراجع قبل الاعتماد الرسمي.'
        : 'Prepared with WIJAHA — Review prior to official approval.'
    }
  </footer>
</body>
</html>`;
}

export async function generateProjectPdfOrHtml(params: {
  result: WijahaResult;
  versionNumber: number;
  orgName?: string;
  watermarked: boolean;
}): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
  const html = buildOfficialPrintHtml(params);
  const chromiumCandidates = [
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const bin = chromiumCandidates.find((p) => fs.existsSync(p));

  if (bin) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wijaha-pdf-'));
    const htmlFile = path.join(tmpDir, 'plan.html');
    const pdfFile = path.join(tmpDir, 'plan.pdf');
    try {
      fs.writeFileSync(htmlFile, html, 'utf8');
      await execFileAsync(
        bin,
        [
          '--headless',
          '--no-sandbox',
          '--disable-gpu',
          `--print-to-pdf=${pdfFile}`,
          `file://${htmlFile}`,
        ],
        { timeout: 12000 },
      );
      if (fs.existsSync(pdfFile)) {
        const pdfBuf = fs.readFileSync(pdfFile);
        return { buffer: pdfBuf, mimeType: 'application/pdf', extension: 'pdf' };
      }
    } catch (err) {
      console.warn('Headless PDF print fallback to printable HTML:', err);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  return {
    buffer: Buffer.from(html, 'utf8'),
    mimeType: 'text/html; charset=utf-8',
    extension: 'html',
  };
}
