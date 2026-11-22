// 遊戲主視覺：低解析度繪製後放大，維持像素感
import { playerSprite, enemySprite } from './sprites.js';

const BW = 320, BH = 180;
const buf = document.createElement('canvas'); buf.width = BW; buf.height = BH;
const b = buf.getContext('2d');
const tintCache = new Map();
function silhouette(img, color) {
  const key = img.width + 'x' + img.height + color + (img.__id ||= Math.random());
  if (tintCache.has(key)) return tintCache.get(key);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  return c;
}
const rnd = (i, k = 1) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export function drawKeyArt(ctx, W, H, t) {
  b.imageSmoothingEnabled = false;
  // 天空
  const g = b.createLinearGradient(0, 0, 0, BH);
  g.addColorStop(0, '#07060f'); g.addColorStop(0.45, '#1c1038'); g.addColorStop(0.8, '#3a1240'); g.addColorStop(1, '#12060f');
  b.fillStyle = g; b.fillRect(0, 0, BW, BH);
  for (let i = 0; i < 70; i++) {
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
    b.fillStyle = `rgba(255,240,255,${0.25 + 0.5 * tw * rnd(i, 3)})`;
    b.fillRect(Math.floor(rnd(i) * BW), Math.floor(rnd(i, 2) * BH * 0.6), 1, 1);
  }
  // 深淵之門
  const px = BW / 2, py = 94;
  for (let r = 62; r > 0; r -= 4) {
    const k = r / 62;
    b.fillStyle = `rgba(${Math.round(120 + 100 * (1 - k))},${Math.round(40 + 30 * (1 - k))},${Math.round(200 + 40 * (1 - k))},${0.08 + 0.05 * (1 - k)})`;
    b.beginPath(); b.arc(px, py, r + Math.sin(t * 1.5 + r) * 1.5, 0, 7); b.fill();
  }
  for (let i = 0; i < 40; i++) {
    const a = t * 0.6 + i * 0.157, rr = 44 + Math.sin(t * 2 + i) * 3;
    b.fillStyle = i % 3 ? '#b07cff' : '#ff4af0';
    b.fillRect(Math.round(px + Math.cos(a) * rr), Math.round(py + Math.sin(a) * rr * 0.9), 1, 1);
  }
  // 頭目剪影
  const eye = enemySprite('voidlord').n;
  b.globalAlpha = 0.9; b.drawImage(eye, px - 32, py - 34 + Math.sin(t) * 2, 64, 64); b.globalAlpha = 1;
  b.drawImage(silhouette(enemySprite('dragon').n, '#2a0d2a'), 4, 52 + Math.sin(t * 0.8) * 3, 80, 80);
  b.drawImage(silhouette(enemySprite('golem').n, '#1f0d26'), BW - 92, 60, 84, 84);
  b.drawImage(silhouette(enemySprite('lich').n, '#24103a'), BW - 72, 34 + Math.sin(t * 1.2) * 2, 48, 48);
  b.drawImage(silhouette(enemySprite('queen').n, '#200a22'), 60, 46 + Math.sin(t * 0.9 + 1) * 2, 44, 44);
  // 石柱
  for (const [x, h] of [[24, 120], [BW - 40, 120]]) {
    b.fillStyle = '#16121f'; b.fillRect(x, BH - h, 16, h);
    b.fillStyle = '#2e2846'; b.fillRect(x + 1, BH - h, 14, h);
    b.fillStyle = '#16121f'; for (let y = BH - h + 6; y < BH; y += 8) b.fillRect(x + 1, y, 14, 1);
    b.fillStyle = '#ffb04a'; b.fillRect(x + 6, BH - h + 18 + (Math.sin(t * 12 + x) > 0 ? 0 : 1), 4, 4);
    b.fillStyle = 'rgba(255,170,60,0.15)'; b.beginPath(); b.arc(x + 8, BH - h + 20, 14, 0, 7); b.fill();
  }
  // 地面
  b.fillStyle = '#1a1428'; b.fillRect(0, BH - 34, BW, 34);
  b.fillStyle = '#2a2240'; b.fillRect(0, BH - 34, BW, 2);
  for (let i = 0; i < 20; i++) { b.fillStyle = '#231c36'; b.fillRect(i * 16 + (i % 2) * 4, BH - 24 + (i % 3) * 6, 10, 1); }
  // 四位獵人
  const heroes = [['knight', 'default'], ['ranger', 'default'], ['mage', 'default'], ['cleric', 'default']];
  heroes.forEach(([c, sk], i) => {
    const img = playerSprite(c, sk)[0].n, x = BW / 2 - 92 + i * 46, y = BH - 66 + Math.round(Math.sin(t * 2 + i) * 1.5);
    b.fillStyle = 'rgba(0,0,0,0.4)'; b.beginPath(); b.ellipse(x + 16, BH - 27, 13, 4, 0, 0, 7); b.fill();
    b.drawImage(img, x, y, 32, 40);
  });
  // 餘燼
  for (let i = 0; i < 36; i++) {
    const life = (t * 0.25 + rnd(i, 5)) % 1;
    b.fillStyle = i % 2 ? '#ff8a2a' : '#ffd07a';
    b.globalAlpha = 1 - life;
    b.fillRect(Math.round(rnd(i, 6) * BW + Math.sin(t + i) * 4), Math.round(BH - life * BH), 1, 1);
  }
  b.globalAlpha = 1;
  // 標題
  const ty = 33;
  b.textAlign = 'center'; b.textBaseline = 'middle';
  b.font = '900 30px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  b.fillStyle = '#16060a';
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 3], [2, 3], [-2, 3]]) b.fillText('深淵獵團', BW / 2 + dx, ty + dy);
  const tg = b.createLinearGradient(0, ty - 14, 0, ty + 14);
  tg.addColorStop(0, '#fff6c8'); tg.addColorStop(0.5, '#ffd34d'); tg.addColorStop(1, '#e06a1a');
  b.fillStyle = tg; b.fillText('深淵獵團', BW / 2, ty);
  b.font = '700 8px monospace'; b.fillStyle = '#c9a7ff';
  b.fillText('A B Y S S   H U N T E R S', BW / 2, ty + 21);
  // 放大到目標畫布
  ctx.imageSmoothingEnabled = false;
  const sc = Math.max(W / BW, H / BH), dw = BW * sc, dh = BH * sc;
  ctx.drawImage(buf, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
