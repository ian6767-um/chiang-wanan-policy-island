// 手繪風航海圖：澎湖群島（示意位置，非精確比例）。地圖空間 480x360，畫在 400x300 的畫布上。
import { makeCanvas, rect, px, line, ellipse, hash2, PAL as C } from './pixel.js';

export const MAP_W = 400, MAP_H = 300;
export const K = MAP_W / 480; // spots.json 座標 → 畫布

/** 島嶼輪廓（480x360 空間的多邊形） */
const ISLANDS = {
  main: [[262, 206], [270, 196], [282, 192], [288, 178], [300, 168], [316, 160], [330, 164], [338, 178], [334, 196], [326, 212], [316, 226], [300, 236], [290, 230], [282, 222], [276, 226], [268, 222]],
  baisha: [[252, 128], [262, 118], [280, 112], [300, 116], [316, 124], [318, 136], [304, 146], [286, 148], [270, 142], [258, 138]],
  xiyu: [[196, 102], [204, 110], [206, 130], [204, 150], [200, 172], [198, 196], [194, 214], [186, 226], [178, 222], [182, 204], [186, 180], [188, 156], [190, 128], [190, 110]],
  xiaomen: [[180, 92], [188, 90], [192, 96], [186, 100], [180, 98]],
  jibei: [[276, 56], [290, 50], [304, 54], [306, 62], [294, 68], [280, 66]],
  mudou: [[314, 22], [320, 20], [324, 24], [318, 28]],
  niaoyu: [[296, 96], [304, 94], [306, 100], [298, 102]],
  tongpan: [[230, 242], [238, 238], [244, 244], [238, 250], [230, 248]],
  hujing: [[254, 250], [266, 246], [272, 252], [262, 258], [254, 256]],
  wangan: [[238, 288], [252, 282], [266, 288], [264, 300], [250, 306], [238, 300]],
  jiangjun: [[270, 290], [278, 288], [280, 294], [272, 296]],
  qimei: [[214, 332], [226, 326], [240, 330], [238, 344], [224, 350], [214, 344]],
  dongji: [[334, 294], [344, 292], [348, 300], [338, 304]],
  xiji: [[318, 300], [326, 298], [328, 304], [320, 306]],
};

/** 掃描線多邊形填色（不用瀏覽器的反鋸齒路徑） */
export function polyFill(ctx, pts, color) {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  ctx.fillStyle = color;
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const a = Math.round(xs[i]), b = Math.round(xs[i + 1]);
      if (b >= a) ctx.fillRect(a, y, b - a + 1, 1);
    }
  }
}

let cached = null;
export function mapBase() {
  if (cached) return cached;
  const S = makeCanvas(MAP_W, MAP_H, false);
  const { ctx } = S;
  // 羊皮紙
  rect(ctx, 0, 0, MAP_W, MAP_H, C.sa3);
  for (let i = 0; i < 900; i++) px(ctx, Math.floor(hash2(i, 1, 1) * MAP_W), Math.floor(hash2(i, 2, 1) * MAP_H), hash2(i, 3, 1) < 0.6 ? C.sa2 : C.cl4);
  // 海：淺色，近島處更淺
  rect(ctx, 8, 8, MAP_W - 16, MAP_H - 16, C.sea5);
  for (let i = 0; i < 160; i++) {
    const x = 10 + Math.floor(hash2(i, 4, 1) * (MAP_W - 26)), y = 10 + Math.floor(hash2(i, 5, 1) * (MAP_H - 22));
    rect(ctx, x, y, 3, 1, C.sea4); px(ctx, x + 3, y - 1, C.sea4);
  }
  // 經緯格線
  for (let x = 8; x < MAP_W - 8; x += 40) for (let y = 8; y < MAP_H - 8; y += 3) px(ctx, x, y, C.sea4);
  for (let y = 8; y < MAP_H - 8; y += 40) for (let x = 8; x < MAP_W - 8; x += 3) px(ctx, x, y, C.sea4);
  // 島嶼：淺灘 → 沙岸 → 綠地，左上受光
  const scaled = (pts, d = 0) => pts.map(([x, y]) => [x * K + d, y * K + d]);
  for (const pts of Object.values(ISLANDS)) {
    const s = scaled(pts);
    const cx = s.reduce((a, p) => a + p[0], 0) / s.length, cy = s.reduce((a, p) => a + p[1], 0) / s.length;
    const grow = (k) => s.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
    polyFill(ctx, grow(1.25), C.sea6);
    polyFill(ctx, s.map(([x, y]) => [x + 1, y + 1]), C.sa0);
    polyFill(ctx, s, C.sa2);
    polyFill(ctx, grow(0.78), C.pl3);
    polyFill(ctx, grow(0.5).map(([x, y]) => [x - 1, y - 1]), C.pl2);
  }
  // 跨海大橋（白沙—西嶼）
  for (let x = Math.round(205 * K); x < Math.round(254 * K); x++) px(ctx, x, Math.round(124 * K), x % 2 ? C.ui0 : C.ba3);
  // 馬公市區
  for (let i = 0; i < 8; i++) rect(ctx, Math.round(268 * K) + (i % 4) * 3, Math.round(208 * K) + Math.floor(i / 4) * 3, 2, 2, C.wa1);
  // 指北針
  const rx = MAP_W - 40, ry = 44;
  ellipse(ctx, rx, ry, 18, 18, C.sa2); ellipse(ctx, rx, ry, 16, 16, C.sa3);
  for (let k = -14; k <= 14; k++) { px(ctx, rx, ry + k, C.ui2); px(ctx, rx + k, ry, C.ui2); }
  for (let k = 0; k < 14; k++) { line(ctx, rx - Math.max(0, 3 - Math.floor(k / 4)), ry - k, rx + Math.max(0, 3 - Math.floor(k / 4)), ry - k, C.wa1); }
  rect(ctx, rx - 1, ry - 1, 3, 3, C.ui0);
  // 外框
  rect(ctx, 0, 0, MAP_W, 2, C.wo2); rect(ctx, 0, MAP_H - 2, MAP_W, 2, C.wo2); rect(ctx, 0, 0, 2, MAP_H, C.wo2); rect(ctx, MAP_W - 2, 0, 2, MAP_H, C.wo2);
  rect(ctx, 6, 6, MAP_W - 12, 1, C.wo3); rect(ctx, 6, MAP_H - 7, MAP_W - 12, 1, C.wo3); rect(ctx, 6, 6, 1, MAP_H - 12, C.wo3); rect(ctx, MAP_W - 7, 6, 1, MAP_H - 12, C.wo3);
  cached = S;
  return S;
}

/** 航線＋釣點圖釘（每次開地圖重畫，因為解鎖狀態會變） */
export function drawMap(data, game) {
  const base = mapBase();
  const S = makeCanvas(MAP_W, MAP_H, false);
  const { ctx } = S;
  ctx.drawImage(base.c, 0, 0);
  const harbor = data.spots.find((s) => s.harbor);
  const hx = Math.round(harbor.map[0] * K), hy = Math.round(harbor.map[1] * K);
  for (const s of data.spots) {
    if (s === harbor) continue;
    const x = Math.round(s.map[0] * K), y = Math.round(s.map[1] * K);
    const n = Math.max(Math.abs(x - hx), Math.abs(y - hy));
    for (let i = 0; i < n; i += 4) px(ctx, Math.round(hx + ((x - hx) * i) / n), Math.round(hy + ((y - hy) * i) / n), C.wo2);
  }
  for (const s of data.spots) {
    const x = Math.round(s.map[0] * K), y = Math.round(s.map[1] * K);
    const ok = game.canTravel(s.id).reason !== 'boat';
    const here = game.state.spot === s.id;
    // 木頭圖釘
    rect(ctx, x, y - 8, 1, 8, C.wo1);
    ellipse(ctx, x, y - 10, 3, 3, C.ui0);
    ellipse(ctx, x, y - 10, 2, 2, here ? C.wa3 : ok ? (s.harbor ? C.wa1 : C.wo4) : C.ba3);
    px(ctx, x - 1, y - 11, C.ui4);
    if (!ok) { rect(ctx, x + 3, y - 6, 5, 4, C.ui0); rect(ctx, x + 4, y - 5, 3, 2, C.wa2); rect(ctx, x + 4, y - 8, 3, 2, C.ui0); }
  }
  return S;
}
