/**
 * Client-side export of an inline SVG to PNG / SVG. Free and offline: nothing leaves the browser.
 * CSS variables are resolved to concrete colours first, because a serialized SVG loses the page's stylesheet.
 */

const FONT_STACK = "'Alexandria','IBM Plex Sans Arabic','Noto Sans Arabic','Segoe UI',Tahoma,Arial,sans-serif";

function resolveVar(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || '#888888';
}

function resolveString(value: string): string {
  return value.replace(/var\((--[a-z0-9-]+)(?:,\s*([^)]+))?\)/gi, (_m, name: string, fallback?: string) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback?.trim() || '#888888';
  });
}

/** Returns a standalone SVG string with CSS variables inlined and a solid background. */
export function serializeSvg(svg: SVGSVGElement, background?: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  const vb = clone.viewBox.baseVal;
  if (vb && vb.width) {
    clone.setAttribute('width', String(vb.width));
    clone.setAttribute('height', String(vb.height));
  }
  clone.removeAttribute('class');
  const prevStyle = clone.getAttribute('style') ?? '';
  clone.setAttribute('style', `${prevStyle};color:${resolveVar('--ink')};font-family:${FONT_STACK}`);
  const all = [clone, ...Array.from(clone.querySelectorAll('*'))];
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.value.includes('var(')) el.setAttribute(attr.name, resolveString(attr.value));
    }
    const st = el.getAttribute('style');
    if (st && st.includes('var(')) el.setAttribute('style', resolveString(st));
    // Interactive affordances are meaningless in a static export.
    el.removeAttribute('tabindex');
    el.removeAttribute('role');
  }
  if (background) {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', resolveString(background));
    clone.insertBefore(rect, clone.firstChild);
  }
  return new XMLSerializer().serializeToString(clone);
}

export async function svgToPngBlob(svg: SVGSVGElement, scale = 2, background = 'var(--bg)'): Promise<Blob> {
  const markup = serializeSvg(svg, background);
  const vb = svg.viewBox.baseVal;
  const width = Math.round(vb.width * scale);
  const height = Math.round(vb.height * scale);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG could not be rasterized'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadPng(svg: SVGSVGElement, filename: string, scale = 2): Promise<void> {
  downloadBlob(await svgToPngBlob(svg, scale), filename.endsWith('.png') ? filename : `${filename}.png`);
}

export function downloadSvg(svg: SVGSVGElement, filename: string): void {
  const markup = serializeSvg(svg, 'var(--bg)');
  downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), filename.endsWith('.svg') ? filename : `${filename}.svg`);
}

/** Uses the native share sheet with the image when available (phones), otherwise downloads it. */
export async function shareOrDownloadPng(svg: SVGSVGElement, filename: string, title: string, scale = 2): Promise<'shared' | 'downloaded'> {
  const blob = await svgToPngBlob(svg, scale);
  const file = new File([blob], filename.endsWith('.png') ? filename : `${filename}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch {
      /* user cancelled: fall through to download */
    }
  }
  downloadBlob(blob, file.name);
  return 'downloaded';
}
