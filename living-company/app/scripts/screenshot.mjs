// Dev helper: capture the office and dump console logs so we can verify visuals
// without a connected browser.
// Usage: node scripts/screenshot.mjs [url] [outPath] [waitMs]
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:3000';
const out = process.argv[3] ?? '/tmp/office.png';
const waitMs = Number(process.argv[4] ?? 2500);

const logs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(waitMs);
const canvas = await page.$('canvas');
await page.screenshot({ path: out });
console.log('CANVAS_PRESENT:', !!canvas);
console.log('OUT:', out);
console.log('CONSOLE:\n' + logs.filter((l) => !l.includes('WebGL') && !l.includes('DevTools')).join('\n'));
await browser.close();
