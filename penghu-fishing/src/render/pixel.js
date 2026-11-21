// 像素繪圖工具。所有顏色都必須來自主調色盤（palette/master.hex），只用整數座標。

export const PAL = {
  sea0: '#0b1d3a', sea1: '#123a63', sea2: '#1b5f8c', sea3: '#2a86a8', sea4: '#47b3c2', sea5: '#8fdbd6', sea6: '#d8f3ee',
  sky0: '#5fa8e0', sky1: '#8cc7ef', sky2: '#c4e4f7', sky3: '#f4f7f2',
  dk0: '#1a1433', dk1: '#2e2350', dk2: '#57376f', dk3: '#8a4b86', dk4: '#c4607e', dk5: '#ef8a7a', dk6: '#f7b98b', dk7: '#fde2b0',
  ba0: '#1a1820', ba1: '#2e2b36', ba2: '#4a4552', ba3: '#6e6672', ba4: '#9a8f92',
  sa0: '#8a6e4e', sa1: '#b89b72', sa2: '#d9c29a', sa3: '#efe2c4',
  pl0: '#1f3a2b', pl1: '#2f5a3a', pl2: '#4f7d43', pl3: '#86a64f', pl4: '#c9b458',
  wa0: '#8c2a22', wa1: '#c8402f', wa2: '#e9a23b', wa3: '#f6d35b',
  wo0: '#2a1810', wo1: '#3b2418', wo2: '#5e3a24', wo3: '#8a5a34', wo4: '#b98450',
  sk0: '#6b3f2a', sk1: '#a8674a', sk2: '#d99a74', sk3: '#f2c7a0',
  ca0: '#7a3214', ca1: '#b5541e', ca2: '#e08a3a', ca3: '#f6c27a', ca4: '#fff1dc',
  cl0: '#2d4f7c', cl1: '#4f86b8', cl2: '#a83a4a', cl3: '#e57a8a', cl4: '#f1e3c8',
  ui0: '#1c1418', ui1: '#3a2a26', ui2: '#6b4a3a', ui3: '#e8d9b8', ui4: '#fff8ec', ui5: '#f4c542',
};

export const PALETTE_LIST = [...new Set(Object.values(PAL))];

export function makeCanvas(w, h, readback = true) {
  let c;
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') c = new OffscreenCanvas(w, h);
  else { c = document.createElement('canvas'); c.width = w; c.height = h; }
  const ctx = c.getContext('2d', { willReadFrequently: readback });
  ctx.imageSmoothingEnabled = false;
  return { c, ctx, w, h };
}

export function rect(ctx, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** 填滿的像素橢圓（以中心與半徑） */
export function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const t = 1 - (y * y) / (ry * ry + 0.0001);
    if (t < 0) continue;
    const half = Math.round(rx * Math.sqrt(t));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

/** 4x4 Bayer 抖色：只能用在天空、水深漸層和霧 */
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** 垂直漸層（色階之間用 Bayer 抖色） colors: 從上到下 */
export function ditherGradient(ctx, x0, y0, w, h, colors, ditherBand = 6) {
  const n = colors.length - 1;
  if (n <= 0) { rect(ctx, x0, y0, w, h, colors[0]); return; }
  const seg = h / n;
  for (let y = 0; y < h; y++) {
    const pos = y / seg;
    const i = Math.min(n - 1, Math.floor(pos));
    const local = (pos - i) * seg; // 0..seg
    // 色階之間只在交界附近 ditherBand 像素內抖色
    const edge = seg - local;
    for (let x = 0; x < w; x += 1) {
      let c = colors[i];
      if (edge < ditherBand) {
        const th = (BAYER4[y & 3][(x + x0) & 3] + 0.5) / 16;
        if (1 - edge / ditherBand > th) c = colors[i + 1];
      }
      ctx.fillStyle = c;
      // 合併同色水平線段以加速
      let run = 1;
      while (x + run < w) {
        let c2 = colors[i];
        if (edge < ditherBand) {
          const th2 = (BAYER4[y & 3][(x + run + x0) & 3] + 0.5) / 16;
          if (1 - edge / ditherBand > th2) c2 = colors[i + 1];
        }
        if (c2 !== c) break;
        run++;
      }
      ctx.fillRect(x0 + x, y0 + y, run, 1);
      x += run - 1;
    }
  }
}

/** 以 Bayer 門檻判斷某像素在 density(0..1) 時是否要畫 */
export function ditherOn(x, y, density) {
  return (BAYER4[y & 3][x & 3] + 0.5) / 16 < density;
}

/** Bresenham 直線 */
export function line(ctx, x0, y0, x1, y1, color) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  for (let guard = 0; guard < 4000; guard++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** 二次貝茲曲線（釣線下垂用） */
export function curve(ctx, x0, y0, cx, cy, x1, y1, color) {
  const steps = Math.max(8, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
  let px0 = x0, py0 = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    line(ctx, px0, py0, x, y, color);
    px0 = x; py0 = y;
  }
}

/** 整數像素 90 度旋轉（轉置），不使用即時旋轉造成鋸齒 */
export function rotate90(src) {
  const { c, w, h } = src;
  const out = makeCanvas(h, w);
  const sctx = c.getContext('2d');
  const id = sctx.getImageData(0, 0, w, h);
  const od = out.ctx.createImageData(h, w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (y * w + x) * 4;
    // 順時針：新座標 (h-1-y, x)
    const nx = h - 1 - y, ny = x;
    const di = (ny * h + nx) * 4;
    od.data[di] = id.data[si]; od.data[di + 1] = id.data[si + 1]; od.data[di + 2] = id.data[si + 2]; od.data[di + 3] = id.data[si + 3];
  }
  out.ctx.putImageData(od, 0, 0);
  return out;
}

/** 水平翻轉（整數像素） */
export function flipH(src) {
  const out = makeCanvas(src.w, src.h);
  out.ctx.save();
  out.ctx.translate(src.w, 0);
  out.ctx.scale(-1, 1);
  out.ctx.drawImage(src.c, 0, 0);
  out.ctx.restore();
  return out;
}

/** sel-out 描邊：在不透明區域的外圈上色（受光的左上側用較亮顏色） */
export function selOut(sprite, darkColor, lightColor = null) {
  const { ctx, w, h } = sprite;
  const id = ctx.getImageData(0, 0, w, h);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : id.data[(y * w + x) * 4 + 3]);
  const edges = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!a(x, y)) continue;
    const top = !a(x, y - 1), left = !a(x - 1, y), right = !a(x + 1, y), bottom = !a(x, y + 1);
    if (top || left || right || bottom) edges.push([x, y, (top || left) && !bottom && !right]);
  }
  for (const [x, y, lit] of edges) px(ctx, x, y, lit && lightColor ? lightColor : darkColor);
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 簡單的 0..1 雜湊雜訊（固定種子，用來放置細節） */
export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
