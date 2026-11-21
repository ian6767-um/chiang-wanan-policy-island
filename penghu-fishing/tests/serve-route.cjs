// 測試用：讓 Playwright 直接從磁碟讀檔，模擬 https://game.local/ 這個網站（不需要另外開伺服器）。
const { readFile } = require('node:fs/promises');
const { join, extname, normalize } = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

const ORIGIN = 'https://game.local';
const ROOT = join(__dirname, '..');

async function serveFromDisk(context) {
  await context.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) return route.fulfill({ status: 403, body: 'forbidden' });
    try {
      const body = await readFile(file);
      await route.fulfill({ status: 200, body, headers: { 'content-type': TYPES[extname(file)] || 'application/octet-stream' } });
    } catch {
      await route.fulfill({ status: 404, body: 'not found' });
    }
  });
}

module.exports = { serveFromDisk, ORIGIN, ROOT };
