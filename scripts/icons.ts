// npm run icons — renders the PWA icons from SVG with the bundled Chromium.
import { chromium } from '@playwright/test';

function svg(size: number, maskable: boolean): string {
  const pad = maskable ? 0.2 : 0.08;
  const r = maskable ? 0 : size * 0.22;
  const s = size * (1 - pad * 2);
  const o = size * pad;
  const u = s / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.35" r="0.8">
      <stop offset="0" stop-color="#12304a"/><stop offset="1" stop-color="#04060b"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${u * 3}"/></filter>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <g transform="translate(${o} ${o})">
    <rect x="${32 * u}" y="${12 * u}" width="${36 * u}" height="${76 * u}" rx="${18 * u}" fill="none" stroke="#5ce1e6" stroke-width="${6 * u}" filter="url(#glow)"/>
    <rect x="${32 * u}" y="${12 * u}" width="${36 * u}" height="${76 * u}" rx="${18 * u}" fill="#5ce1e6" fill-opacity="0.12" stroke="#bdf6f8" stroke-width="${3 * u}"/>
    <rect x="${41 * u}" y="${24 * u}" width="${18 * u}" height="${40 * u}" rx="${9 * u}" fill="none" stroke="#5ce1e6" stroke-opacity="0.6" stroke-width="${2 * u}"/>
    <circle cx="${50 * u}" cy="${44 * u}" r="${5 * u}" fill="#ff4d5e" filter="url(#glow)"/>
    <circle cx="${50 * u}" cy="${44 * u}" r="${2.6 * u}" fill="#ffe4e6"/>
  </g>
</svg>`;
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const page = await browser.newPage();
for (const [file, size, maskable] of [
  ['public/icon-192.png', 192, false],
  ['public/icon-512.png', 512, false],
  ['public/icon-maskable.png', 512, true],
] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, maskable)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', file);
}
await browser.close();
