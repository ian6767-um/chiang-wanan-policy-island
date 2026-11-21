// 16x16 像素圖示（UI 用），描邊統一用 #1c1418。
import { makeCanvas, rect, px, line, ellipse, PAL as C } from './pixel.js';

const O = C.ui0;
const cache = new Map();

const DRAW = {
  coin(ctx) {
    ellipse(ctx, 7, 8, 6, 6, O); ellipse(ctx, 7, 8, 5, 5, C.wa2); ellipse(ctx, 7, 7, 4, 4, C.wa3);
    rect(ctx, 6, 5, 2, 6, C.wa2); px(ctx, 5, 5, C.ui4); px(ctx, 4, 6, C.ui4);
  },
  backpack(ctx) {
    rect(ctx, 3, 4, 10, 11, O); rect(ctx, 4, 5, 8, 9, C.sa1); rect(ctx, 4, 5, 8, 2, C.sa2);
    for (let y = 7; y < 14; y += 2) rect(ctx, 4, y, 8, 1, C.sa0); // 竹編紋
    rect(ctx, 5, 1, 6, 1, O); rect(ctx, 5, 2, 1, 2, O); rect(ctx, 10, 2, 1, 2, O);
    rect(ctx, 6, 9, 4, 3, C.wo2); px(ctx, 7, 10, C.wa3);
  },
  map(ctx) {
    rect(ctx, 1, 3, 14, 11, O); rect(ctx, 2, 4, 12, 9, C.sea4);
    rect(ctx, 4, 6, 3, 3, C.pl3); rect(ctx, 9, 5, 2, 5, C.pl3); px(ctx, 6, 10, C.pl3); rect(ctx, 11, 10, 2, 2, C.pl3);
    px(ctx, 5, 7, C.wa1); line(ctx, 6, 8, 9, 9, C.ui4);
  },
  book(ctx) {
    rect(ctx, 1, 3, 14, 11, O); rect(ctx, 2, 4, 6, 9, C.sa3); rect(ctx, 8, 4, 6, 9, C.ui3);
    rect(ctx, 7, 3, 2, 11, C.wo2); for (let y = 6; y < 12; y += 2) { rect(ctx, 3, y, 3, 1, C.sa1); rect(ctx, 10, y, 3, 1, C.sa1); }
    rect(ctx, 11, 1, 2, 4, C.wa1);
  },
  gear(ctx) {
    ellipse(ctx, 8, 8, 6, 6, O); ellipse(ctx, 8, 8, 5, 5, C.ba3);
    for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [12, 3], [3, 12], [12, 12]]) rect(ctx, x - 1, y - 1, 2, 2, O);
    ellipse(ctx, 8, 8, 2, 2, O); px(ctx, 8, 8, C.ba4); px(ctx, 5, 5, C.ba4);
  },
  rod(ctx) {
    line(ctx, 2, 14, 14, 2, C.wo3); line(ctx, 2, 13, 13, 2, C.wo1); rect(ctx, 3, 11, 3, 3, C.ba2); px(ctx, 4, 12, C.ba4);
    line(ctx, 14, 2, 14, 10, C.ui3); px(ctx, 14, 11, C.wa1);
  },
  bait(ctx) {
    line(ctx, 8, 1, 8, 9, C.ba3); ellipse(ctx, 8, 11, 3, 3, C.ba3); ellipse(ctx, 8, 11, 2, 2, C.ui0 === C.ba3 ? C.ba4 : 'transparent');
    rect(ctx, 6, 9, 1, 3, C.ba3); px(ctx, 11, 9, C.ba3); px(ctx, 11, 8, C.ba4);
    rect(ctx, 5, 3, 6, 4, C.cl3); rect(ctx, 5, 3, 6, 1, C.ui4); px(ctx, 10, 4, O);
  },
  boat(ctx) {
    rect(ctx, 1, 9, 14, 3, O); rect(ctx, 2, 9, 12, 2, C.ui4); rect(ctx, 2, 11, 11, 1, C.cl1);
    rect(ctx, 4, 6, 5, 3, C.ui4); rect(ctx, 4, 6, 5, 1, C.cl0); line(ctx, 10, 9, 10, 2, C.ba2); rect(ctx, 11, 2, 3, 2, C.wa1);
    rect(ctx, 0, 13, 16, 1, C.sea3);
  },
  market(ctx) {
    rect(ctx, 1, 4, 14, 3, C.wa1); for (let x = 1; x < 15; x += 4) rect(ctx, x, 4, 2, 3, C.ui4);
    rect(ctx, 1, 7, 14, 1, O); rect(ctx, 2, 8, 1, 6, O); rect(ctx, 13, 8, 1, 6, O); rect(ctx, 3, 11, 10, 3, C.sea5);
    rect(ctx, 5, 10, 5, 2, C.ba3); px(ctx, 9, 10, O);
  },
  shop(ctx) {
    rect(ctx, 2, 5, 12, 10, O); rect(ctx, 3, 6, 10, 8, C.wo3); rect(ctx, 1, 3, 14, 3, C.wo1); rect(ctx, 1, 3, 14, 1, C.wo4);
    rect(ctx, 6, 9, 4, 5, C.wo1); rect(ctx, 4, 7, 2, 2, C.wa3); rect(ctx, 10, 7, 2, 2, C.wa3); line(ctx, 3, 1, 13, 1, C.ba2);
  },
  trash(ctx) {
    rect(ctx, 4, 5, 8, 10, O); rect(ctx, 5, 6, 6, 8, C.ba3); rect(ctx, 3, 3, 10, 2, O); rect(ctx, 6, 1, 4, 2, O);
    for (let x = 6; x < 11; x += 2) rect(ctx, x, 7, 1, 6, C.ba2);
  },
  rotate(ctx) {
    for (let a = 0.6; a < 5.6; a += 0.12) px(ctx, Math.round(8 + Math.cos(a) * 5), Math.round(8 + Math.sin(a) * 5), O);
    rect(ctx, 11, 1, 3, 1, O); rect(ctx, 13, 1, 1, 3, O); px(ctx, 12, 2, O);
  },
  sun(ctx) {
    ellipse(ctx, 8, 8, 4, 4, C.wa2); ellipse(ctx, 8, 8, 3, 3, C.wa3);
    for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [13, 3], [3, 13], [13, 13]]) px(ctx, x, y, C.wa3);
  },
  moon(ctx) { ellipse(ctx, 8, 8, 5, 5, C.sky2); ellipse(ctx, 10, 6, 4, 4, 'rgba(0,0,0,0)'); clearCircle(ctx, 11, 6, 4); },
  cloud(ctx) { ellipse(ctx, 6, 9, 4, 3, C.sky2); ellipse(ctx, 10, 8, 4, 4, C.sky3); rect(ctx, 2, 10, 12, 2, C.sky2); },
  fog(ctx) { for (let y = 4; y < 14; y += 3) rect(ctx, 1 + (y % 2) * 2, y, 12, 1, C.sky2); },
  wind(ctx) { line(ctx, 1, 5, 11, 5, C.sky2); px(ctx, 12, 4, C.sky2); line(ctx, 1, 9, 13, 9, C.sky3); px(ctx, 14, 8, C.sky3); line(ctx, 3, 13, 9, 13, C.sky2); },
  leaf(ctx) { ellipse(ctx, 8, 8, 5, 3, C.pl3); line(ctx, 3, 8, 13, 8, C.pl1); },
  flower(ctx) {
    for (const [x, y] of [[8, 3], [12, 6], [12, 10], [8, 13], [4, 10], [4, 6]]) { ellipse(ctx, x, y, 2, 2, C.wa1); px(ctx, x, y, C.wa3); }
    ellipse(ctx, 8, 8, 2, 2, C.wa0);
  },
  snow(ctx) { line(ctx, 8, 2, 8, 14, C.sky3); line(ctx, 2, 8, 14, 8, C.sky3); line(ctx, 4, 4, 12, 12, C.sky2); line(ctx, 12, 4, 4, 12, C.sky2); },
  maple(ctx) { ellipse(ctx, 8, 8, 5, 5, C.wa2); line(ctx, 8, 8, 8, 15, C.wo2); ellipse(ctx, 8, 7, 2, 3, C.wa1); },
  sound(ctx) { rect(ctx, 2, 6, 3, 4, C.ui3); line(ctx, 5, 6, 8, 3, C.ui3); line(ctx, 5, 9, 8, 12, C.ui3); rect(ctx, 8, 3, 1, 10, C.ui3); px(ctx, 11, 6, C.ui3); px(ctx, 11, 9, C.ui3); px(ctx, 12, 7, C.ui3); px(ctx, 12, 8, C.ui3); },
};

function clearCircle(ctx, cx, cy, r) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) ctx.clearRect(cx + x, cy + y, 1, 1);
}

export function icon(name) {
  if (cache.has(name)) return cache.get(name);
  const S = makeCanvas(16, 16);
  (DRAW[name] || DRAW.coin)(S.ctx);
  cache.set(name, S);
  return S;
}

export const SEASON_ICON = { spring: 'leaf', summer: 'flower', autumn: 'maple', winter: 'snow' };
export const WEATHER_ICON = { sunny: 'sun', cloudy: 'cloud', fog: 'fog', windy: 'wind' };
