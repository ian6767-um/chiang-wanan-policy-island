// 產生 PWA 圖示（192、512）：用遊戲裡的小卷貓像素圖，整數倍放大，全部是主調色盤顏色、完全不透明。
// 執行：node tools/make_icons.cjs
const { chromium } = require('playwright');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { serveFromDisk, ORIGIN, ROOT } = require('../tests/serve-route.cjs');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  await serveFromDisk(ctx);
  const p = await ctx.newPage();
  await p.goto(`${ORIGIN}/index.html`);
  await p.waitForFunction(() => window.done === true);
  for (const size of [192, 512]) {
    const dataUrl = await p.evaluate(async (size) => {
      const { catSprite } = await import('/src/render/actors.js');
      const { PAL } = await import('/src/render/pixel.js');
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      // 背景：夕陽天空＋海
      const band = Math.floor(size / 12);
      const sky = [PAL.dk1, PAL.dk2, PAL.dk3, PAL.dk4, PAL.dk5, PAL.dk6];
      sky.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(0, i * band, size, band + 1); });
      ctx.fillStyle = PAL.sea2; ctx.fillRect(0, band * 6, size, size - band * 6);
      ctx.fillStyle = PAL.dk7; ctx.fillRect(0, band * 6, size, Math.max(2, Math.floor(size / 96)) * 2);
      const cat = catSprite('sit', 0);
      const k = Math.floor((size * 0.8) / 20);
      const x0 = Math.floor((size - 20 * k) / 2), y0 = Math.floor(size * 0.62 - 16 * k);
      ctx.drawImage(cat.c, 0, 0, 20, 16, x0, y0, 20 * k, 16 * k);
      return c.toDataURL('image/png');
    }, size);
    const out = join(ROOT, 'assets', 'icons', `icon-${size}.png`);
    writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('wrote', out);
  }
  await b.close();
})();
