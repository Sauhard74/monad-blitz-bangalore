import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3000/_dev/master.png');
const result = await page.evaluate(async () => {
  const img = document.querySelector('img');
  await img.decode();
  // crop top office region: cols 0-15, rows 0-24 => 256 x 384
  const cw = 256, ch = 384;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, cw, ch, 0, 0, cw, ch);
  // sample an empty area for alpha (around 0,0 .. is wardrobe; sample col5,row0 = empty)
  const px = x.getImageData(5*16+8, 0*16+8, 1, 1).data;
  return { dataUrl: c.toDataURL('image/png'), alphaAtEmpty: px[3] };
});
const b64 = result.dataUrl.split(',')[1];
const { writeFileSync } = await import('node:fs');
writeFileSync('public/assets/limezu/tiles/office.png', Buffer.from(b64, 'base64'));
console.log('cropped office.png; alpha at empty pixel =', result.alphaAtEmpty, '(0 = transparent, 255 = opaque)');
await browser.close();
