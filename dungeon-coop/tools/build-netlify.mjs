// 產生可直接上傳 Netlify 的前端資料夾與壓縮檔
// 用法：node tools/build-netlify.mjs https://你的伺服器網址
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(DIST, 'netlify-site');
const server = (process.argv[2] || process.env.ABYSS_SERVER || '').replace(/\/+$/, '');

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), SITE, { recursive: true, filter: src => !src.endsWith('artsheet.html') });
fs.writeFileSync(path.join(SITE, 'config.js'), `// 遊戲伺服器位址（部署後可直接修改這一行）\nwindow.ABYSS_SERVER = ${JSON.stringify(server)};\n`);
const musicDir = path.join(SITE, 'music');
fs.mkdirSync(musicDir, { recursive: true });
const tracks = fs.readdirSync(musicDir).filter(f => /^(title|hub|dungeon|boss)\.mp3$/.test(f));
fs.writeFileSync(path.join(musicDir, 'index.json'), JSON.stringify({ files: tracks }));
fs.writeFileSync(path.join(SITE, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/assets/*\n  Cache-Control: public, max-age=604800\n`);
fs.writeFileSync(path.join(SITE, 'netlify.toml'), `[build]\n  publish = "."\n`);

const zip = (name, cwd, args) => { const out = path.join(DIST, name); execFileSync('zip', ['-qr', out, ...args], { cwd }); return out; };
const site = zip('abyss-hunters-netlify.zip', SITE, ['.']);
const src = zip('abyss-hunters-source.zip', path.join(ROOT, '..'), ['dungeon-coop', '-x', 'dungeon-coop/node_modules/*', 'dungeon-coop/data/*', 'dungeon-coop/dist/*', '*.DS_Store']);
console.log('Netlify 網站資料夾：', SITE);
console.log('Netlify 上傳用壓縮檔：', site, `(${(fs.statSync(site).size / 1024).toFixed(0)} KB)`);
console.log('完整原始碼壓縮檔：', src, `(${(fs.statSync(src).size / 1024).toFixed(0)} KB)`);
console.log(server ? `伺服器位址已設定為 ${server}` : '⚠ 尚未設定伺服器位址：部署伺服器後，修改網站裡的 config.js 或重新執行並帶上網址');
