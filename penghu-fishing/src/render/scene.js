// 釣點場景：天空、雲、遠景、中景地標、水面倒影、水下剖面。全部程序化繪製並快取。
import { makeCanvas, rect, px, ellipse, ditherGradient, ditherOn, line, hash2, PAL as C } from './pixel.js';
import { TONES } from './tones.js';
import { mulberry32, hashString } from '../core/rng.js';

export const LW = 800;     // 圖層寬（寬螢幕最多看到 800）
export const SH = 360;     // 基礎高度
export const HZ = 118;     // 海平線
export const WL = 190;     // 水面剖面線（船浮在這裡）
export const UW = SH - WL; // 水下高度 170

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) {
    if (cache.size > 60) cache.delete(cache.keys().next().value);
    cache.set(key, fn());
  }
  return cache.get(key);
}

// ---------------- 天空與雲 ----------------
function drawSky(T, weather) {
  const L = makeCanvas(LW, WL, false);
  const { ctx } = L;
  const colors = weather === 'cloudy' || weather === 'windy' ? T.sky.map((c, i) => (i === 0 && !T.night ? T.cloud[1] : c)) : T.sky;
  ditherGradient(ctx, 0, 0, LW, HZ + 2, colors, 10);
  // 星星
  if (T.stars) {
    const r = mulberry32(7);
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(r() * LW), y = Math.floor(r() * (HZ - 20));
      px(ctx, x, y, r() < 0.2 ? C.ui4 : C.sky2);
      if (r() < 0.06) { px(ctx, x - 1, y, C.sky1); px(ctx, x + 1, y, C.sky1); px(ctx, x, y - 1, C.sky1); px(ctx, x, y + 1, C.sky1); }
    }
  }
  // 太陽／月亮：像素圓 + 一圈階梯光暈
  const s = T.sun;
  const sx = Math.round(s.x * LW), sy = Math.round(s.y * HZ);
  if (!(weather === 'cloudy' && !s.moon)) {
    ellipse(ctx, sx, sy, s.r + 4, s.r + 4, s.glow);
    ellipse(ctx, sx, sy, s.r, s.r, s.c);
    if (s.moon) { ellipse(ctx, sx + 3, sy - 2, s.r - 1, s.r - 1, T.sky[0]); ellipse(ctx, sx - 2, sy + 1, 1, 1, C.sky2); }
  }
  // 地平線下方要切掉（夕陽半沉）
  rect(ctx, 0, HZ, LW, WL - HZ, T.band[0]);
  return L;
}

/** 有體積感的積雲：數個橢圓疊出外形，3–4 階明暗，光從左上（夕陽時從地平線） */
function cumulus(ctx, cx, by, w, h, T, rand, backlit) {
  const [shadow, mid, lit, hi] = T.cloud;
  const puffs = [];
  const n = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const rx = Math.round(w * (0.18 + rand() * 0.12));
    const ry = Math.round(h * (0.35 + Math.sin(u * Math.PI) * 0.55) * (0.7 + rand() * 0.3));
    puffs.push({ x: Math.round(cx - w / 2 + u * w), y: by - ry + Math.round(h * 0.25), rx, ry });
  }
  for (const p of puffs) ellipse(ctx, p.x, p.y, p.rx, p.ry, shadow);
  for (const p of puffs) ellipse(ctx, p.x - 1, p.y - 2, Math.max(1, p.rx - 2), Math.max(1, p.ry - 2), mid);
  const off = backlit ? 0 : -2;
  for (const p of puffs) ellipse(ctx, p.x + off - 1, p.y - Math.round(p.ry * 0.35), Math.max(1, Math.round(p.rx * 0.65)), Math.max(1, Math.round(p.ry * 0.5)), lit);
  for (const p of puffs) if (rand() < 0.6) ellipse(ctx, p.x + off - 2, p.y - Math.round(p.ry * 0.6), Math.max(1, Math.round(p.rx * 0.3)), Math.max(1, Math.round(p.ry * 0.2)), hi);
  // 平坦的底部
  rect(ctx, cx - Math.round(w / 2) - 4, by, w + 8, 2, shadow);
  rect(ctx, cx - Math.round(w / 2) - 6, by + 2, w + 12, 1, T.cloud[0]);
}

function drawClouds(T, weather, spot, dramatic) {
  const L = makeCanvas(LW, HZ, false);
  const rand = mulberry32(hashString(spot.id + weather));
  const count = weather === 'cloudy' ? 9 : weather === 'windy' ? 6 : dramatic ? 5 : 4;
  for (let i = 0; i < count; i++) {
    const big = dramatic && i === 1;
    const w = big ? 150 : 50 + Math.floor(rand() * 70);
    const h = big ? 80 : 18 + Math.floor(rand() * 22);
    const cx = Math.floor((i + 0.5) * (LW / count) + (rand() - 0.5) * 50);
    const by = big ? HZ - 22 : 18 + Math.floor(rand() * (HZ - 60));
    cumulus(L.ctx, cx, by, w, h, T, rand, !!T.rim);
  }
  // 細長的層雲
  for (let i = 0; i < 4; i++) {
    const y = HZ - 12 - Math.floor(rand() * 30);
    const x = Math.floor(rand() * LW);
    rect(L.ctx, x, y, 40 + Math.floor(rand() * 60), 1, T.cloud[1]);
    rect(L.ctx, x + 8, y + 1, 30 + Math.floor(rand() * 40), 1, T.cloud[0]);
  }
  return L;
}

// ---------------- 地形元件 ----------------
/** 島嶼剪影：階梯狀輪廓，頂邊受光一排 */
function island(ctx, x0, x1, base, height, col, seed, opts = {}) {
  const r = mulberry32(seed);
  const w = x1 - x0;
  let prev = null;
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / w;
    let h = opts.flat ? Math.min(1, Math.min(u, 1 - u) * 8) * height : Math.pow(Math.sin(Math.PI * u), opts.sharp ? 1.6 : 0.8) * height;
    h += Math.round((hash2(Math.floor(x / 3), seed, 3) - 0.5) * (opts.rough ?? 2));
    h = Math.max(1, Math.round(h));
    if (prev !== null && Math.abs(h - prev) > 2) h = prev + Math.sign(h - prev) * 2; // 避免抖動的鋸齒
    prev = h;
    rect(ctx, x, base - h, 1, h, col.m);
    if (col.l) px(ctx, x, base - h, u < 0.6 ? col.l : col.m);
    if (col.d && u > 0.55) rect(ctx, x, base - h + 2, 1, Math.max(0, h - 2), col.d);
  }
  if (r() < 0) r(); // 保留亂數順序
}

function shrubs(ctx, x0, x1, topFn, T, seed) {
  for (let x = x0; x < x1; x += 3) {
    if (hash2(x, seed, 5) < 0.45) continue;
    const y = topFn(x);
    rect(ctx, x, y - 2, 3, 2, T.green.m);
    px(ctx, x, y - 3, T.green.l);
    px(ctx, x + 2, y - 1, T.green.d);
  }
}

/** 柱狀玄武岩：寬 6–9 的柱子，成群明暗（3 柱一組有一根在陰影裡），六角柱頂有受光面 */
function basaltColumns(ctx, x0, x1, base, topY, T, seed, col = T.mid) {
  let x = x0;
  let i = 0;
  let prevTop = topY;
  while (x < x1) {
    const w = 6 + Math.floor(hash2(i, seed, 1) * 4);
    let top = topY + Math.floor(hash2(i, seed, 2) * 8) - 4;
    if (Math.abs(top - prevTop) > 4) top = prevTop + Math.sign(top - prevTop) * 4;
    prevTop = top;
    const shade = hash2(i, seed, 5) < 0.3 ? col.d : col.m;
    rect(ctx, x, top, w, base - top, shade);
    rect(ctx, x, top + 2, 1, base - top - 2, shade === col.d ? col.m : col.l);   // 左側受光
    rect(ctx, x + w - 1, top, 1, base - top, col.d);                             // 柱縫
    rect(ctx, x + 1, top, w - 2, 2, col.l);                                       // 六角柱頂
    px(ctx, x + w - 2, top + 1, col.m);
    // 偶爾的橫向節理
    const jy = top + 10 + Math.floor(hash2(i, seed, 3) * 20);
    if (jy < base - 6) rect(ctx, x + 1, jy, w - 2, 1, col.d);
    // 浪花打濕的底部比較暗
    rect(ctx, x, base - 4, w, 4, col.d);
    x += w; i++;
  }
}

function house(ctx, x, base, w, h, T, seed) {
  rect(ctx, x, base - h, w, h, T.wall.l);
  rect(ctx, x + w - 2, base - h, 2, h, T.wall.d);
  // 咾咕石的牆面紋理
  for (let yy = base - h + 2; yy < base; yy += 3) for (let xx = x + 1; xx < x + w - 2; xx += 4) if (hash2(xx, yy, seed) < 0.4) rect(ctx, xx, yy, 2, 1, T.wall.s);
  // 紅瓦屋頂
  rect(ctx, x - 1, base - h - 3, w + 2, 3, T.roof);
  rect(ctx, x - 1, base - h - 3, w + 2, 1, T.wall.d);
  // 窗
  const lit = T.night;
  for (let xx = x + 2; xx < x + w - 3; xx += 5) rect(ctx, xx, base - h + 3, 2, 2, lit && hash2(xx, seed, 9) < 0.7 ? T.lamp : T.window);
}

function lighthouse(ctx, x, base, h, T, striped) {
  const w0 = 8, w1 = 6;
  for (let y = 0; y < h; y++) {
    const w = Math.round(w0 - (w0 - w1) * (y / h));
    const yy = base - y;
    const band = striped ? Math.floor(y / 6) % 2 === 0 : false;
    const c = band ? T.stripe : T.wall.l;
    rect(ctx, x - Math.floor(w / 2), yy, w, 1, c);
    px(ctx, x + Math.ceil(w / 2) - 1, yy, band ? T.stripe : T.wall.d);
  }
  const ty = base - h;
  rect(ctx, x - 4, ty - 2, 8, 2, T.stripe);
  rect(ctx, x - 3, ty - 6, 6, 4, T.night ? T.lamp : T.wall.d);
  rect(ctx, x - 2, ty - 8, 4, 2, T.stripe);
  px(ctx, x, ty - 9, T.stripe);
}

function smallBoat(ctx, x, base, w, hull, T, flag) {
  rect(ctx, x, base - 3, w, 3, hull);
  rect(ctx, x + 1, base - 1, w - 2, 1, T.near.d);
  rect(ctx, x + 3, base - 7, Math.round(w / 3), 4, T.wall.l);
  line(ctx, x + Math.round(w * 0.65), base - 3, x + Math.round(w * 0.65), base - 14, T.near.d);
  if (flag) rect(ctx, x + Math.round(w * 0.65) + 1, base - 14, 4, 3, flag);
}

// ---------------- 各釣點地標 ----------------
const SCENES = {
  rainbow_bridge(ctx, T) {
    island(ctx, 60, 360, HZ, 14, { m: T.far }, 11, { flat: true });
    // 馬公市區天際線
    for (let i = 0; i < 26; i++) {
      const x = 80 + i * 11, h = 8 + Math.floor(hash2(i, 1, 1) * 16);
      rect(ctx, x, HZ - h - 4, 10, h, T.mid.m);
      rect(ctx, x, HZ - h - 4, 1, h, T.mid.l);
      if (T.night) for (let k = 0; k < 3; k++) if (hash2(i, k, 2) < 0.5) px(ctx, x + 3 + k * 2, HZ - h + 1, T.lamp);
    }
    // 海堤
    rect(ctx, 0, HZ - 4, LW, 4, T.near.m);
    rect(ctx, 0, HZ - 4, LW, 1, T.near.l);
    // 西瀛虹橋：白色拱橋
    const bx = 470, bw = 150, bh = 30;
    for (let x = 0; x <= bw; x++) {
      const u = x / bw;
      const y = Math.round(HZ - 6 - Math.sin(Math.PI * u) * bh);
      rect(ctx, bx + x, y, 1, 3, T.wall.l);
      px(ctx, bx + x, y + 3, T.wall.d);
      if (x % 10 === 0) line(ctx, bx + x, y + 3, bx + x, HZ - 5, T.wall.d);
      if (T.night && x % 15 === 0) px(ctx, bx + x, y - 1, T.lamp);
    }
    rect(ctx, bx - 20, HZ - 7, bw + 40, 2, T.wall.l);
    // 觀音亭廟頂
    rect(ctx, 330, HZ - 16, 24, 10, T.wall.l);
    rect(ctx, 326, HZ - 19, 32, 3, T.roof);
    px(ctx, 325, HZ - 21, T.roof); px(ctx, 358, HZ - 21, T.roof);
  },
  harbor(ctx, T) {
    island(ctx, 0, 800, HZ, 10, { m: T.far }, 21, { flat: true });
    for (let i = 0; i < 30; i++) {
      const x = 10 + i * 26, h = 10 + Math.floor(hash2(i, 2, 1) * 20);
      house(ctx, x, HZ - 6, 18 + Math.floor(hash2(i, 3, 1) * 6), h, T, i);
    }
    // 碼頭
    rect(ctx, 0, HZ - 6, LW, 6, T.near.m);
    rect(ctx, 0, HZ - 6, LW, 1, T.near.l);
    for (let x = 4; x < LW; x += 16) rect(ctx, x, HZ - 5, 2, 5, T.near.d);
    // 魚市棚子
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 40;
      rect(ctx, x, HZ - 18, 34, 3, i % 2 ? T.roof : C.cl1);
      line(ctx, x + 1, HZ - 15, x + 1, HZ - 7, T.near.d);
      line(ctx, x + 32, HZ - 15, x + 32, HZ - 7, T.near.d);
      rect(ctx, x + 4, HZ - 10, 26, 3, T.wall.d);
    }
    // 彩色漁船與旗子
    const hulls = [C.cl1, C.wa1, C.pl2, C.wa2, C.cl0];
    for (let i = 0; i < 7; i++) smallBoat(ctx, 330 + i * 62, HZ + 1, 40, T.night ? T.mid.m : hulls[i % hulls.length], T, T.night ? null : hulls[(i + 2) % hulls.length]);
    if (T.night) for (let x = 20; x < LW; x += 60) { line(ctx, x, HZ - 6, x, HZ - 26, T.near.d); rect(ctx, x - 1, HZ - 28, 3, 2, T.lamp); }
  },
  basalt_isle(ctx, T) {
    island(ctx, 40, 260, HZ, 12, { m: T.far }, 31, {});
    // 桶盤嶼：平頂島，四周玄武岩柱
    basaltColumns(ctx, 360, 680, HZ, HZ - 42, T, 31);
    rect(ctx, 356, HZ - 50, 330, 6, T.green.m);
    rect(ctx, 356, HZ - 50, 330, 1, T.green.l);
    shrubs(ctx, 360, 680, () => HZ - 50, T, 2);
    for (let i = 0; i < 6; i++) house(ctx, 420 + i * 30, HZ - 50, 16, 9, T, 40 + i);
    // 潮間帶礁石
    for (let x = 330; x < 720; x += 7) if (hash2(x, 4, 4) < 0.5) rect(ctx, x, HZ - 3, 5, 3, T.near.m);
  },
  long_bridge(ctx, T) {
    island(ctx, 0, 140, HZ, 26, T.mid, 41, {});
    island(ctx, 660, 800, HZ, 30, T.mid, 42, {});
    // 跨海大橋：低矮、規律的拱
    const deck = HZ - 16;
    rect(ctx, 100, deck, 600, 3, T.wall.l);
    rect(ctx, 100, deck + 3, 600, 1, T.wall.d);
    for (let x = 100; x < 700; x += 24) {
      for (let k = 0; k < 24; k++) {
        const y = Math.round(deck + 4 + Math.sin(Math.PI * (k / 24)) * 7);
        rect(ctx, x + k, y, 1, Math.max(0, HZ - y), T.mid.m);
      }
      rect(ctx, x, deck + 4, 3, HZ - deck - 4, T.wall.d);
    }
    if (T.night) for (let x = 104; x < 700; x += 12) { px(ctx, x, deck - 2, T.lamp); px(ctx, x, deck - 1, C.wa2); }
    else for (let x = 104; x < 700; x += 12) px(ctx, x, deck - 1, T.near.d);
  },
  sand_spit(ctx, T) {
    island(ctx, 120, 520, HZ, 18, T.green, 51, { flat: true });
    // 彎曲的白沙尾
    for (let x = 380; x < 760; x++) {
      const u = (x - 380) / 380;
      const h = Math.max(1, Math.round((1 - u) * 6));
      rect(ctx, x, HZ - h, 1, h, T.sand.l);
      px(ctx, x, HZ - h, C.ui4 === T.sand.l ? T.sand.m : T.sand.l);
      rect(ctx, x, HZ - 1, 1, 1, T.sand.m);
    }
    // 遠方的風力發電機
    for (let i = 0; i < 4; i++) {
      const x = 160 + i * 40, top = HZ - 44;
      line(ctx, x, HZ - 16, x, top, T.wall.l);
      line(ctx, x, top, x - 7, top - 6, T.wall.l);
      line(ctx, x, top, x + 8, top - 3, T.wall.l);
      line(ctx, x, top, x + 1, top + 9, T.wall.l);
    }
  },
  lighthouse(ctx, T) {
    island(ctx, 0, 160, HZ, 10, { m: T.far }, 61, { flat: true });
    // 目斗嶼：小小的礁岩島
    island(ctx, 480, 640, HZ, 16, T.mid, 62, { rough: 4 });
    lighthouse(ctx, 556, HZ - 14, 52, T, true);
    rect(ctx, 566, HZ - 22, 14, 8, T.wall.l);
    rect(ctx, 565, HZ - 24, 16, 2, T.roof);
  },
  sea_arch(ctx, T) {
    island(ctx, 0, 300, HZ, 20, { m: T.far }, 71, {});
    // 鯨魚洞：黑色火山岩海蝕拱
    const x0 = 420, x1 = 700, top = HZ - 62;
    for (let x = x0; x < x1; x++) {
      const u = (x - x0) / (x1 - x0);
      const h = Math.round(Math.pow(Math.sin(Math.PI * u), 0.5) * (HZ - top));
      rect(ctx, x, HZ - h, 1, h, T.near.m);
      if (u < 0.5) px(ctx, x, HZ - h, T.near.l);
    }
    // 拱洞
    for (let x = 520; x < 600; x++) {
      const u = (x - 520) / 80;
      const h = Math.round(Math.sin(Math.PI * u) * 34);
      rect(ctx, x, HZ - h, 1, h, T.sky[T.sky.length - 1]);
    }
    for (let x = 520; x < 600; x++) { const u = (x - 520) / 80; px(ctx, x, HZ - Math.round(Math.sin(Math.PI * u) * 34) - 1, T.near.d); }
    shrubs(ctx, 440, 680, (x) => HZ - Math.round(Math.pow(Math.sin(Math.PI * ((x - x0) / (x1 - x0))), 0.5) * (HZ - top)), T, 7);
  },
  basalt_wall(ctx, T) {
    island(ctx, 0, 200, HZ, 14, { m: T.far }, 81, {});
    // 大菓葉：高聳的六角玄武岩柱牆
    basaltColumns(ctx, 300, 760, HZ, HZ - 78, T, 81, T.near);
    rect(ctx, 296, HZ - 86, 470, 4, T.green.m);
    rect(ctx, 296, HZ - 86, 470, 1, T.green.l);
    shrubs(ctx, 300, 760, () => HZ - 86, T, 8);
  },
  village(ctx, T) {
    // 外垵：山坡上的咾咕石屋、廟、燈塔
    island(ctx, 260, 780, HZ, 56, T.green, 91, { rough: 3 });
    const top = (x) => HZ - Math.round(Math.pow(Math.sin(Math.PI * ((x - 260) / 520)), 0.8) * 56);
    for (let i = 0; i < 16; i++) {
      const x = 300 + i * 24 + Math.floor(hash2(i, 9, 1) * 8);
      if (x > 720) break;
      const base = Math.min(HZ, top(x + 8) + 14 + Math.floor(hash2(i, 9, 2) * 16));
      house(ctx, x, base, 16, 8, T, 90 + i);
    }
    // 廟頂（燕尾脊）
    const tx = 470, tb = top(tx) + 20;
    rect(ctx, tx, tb - 10, 30, 10, T.wall.l);
    rect(ctx, tx - 4, tb - 14, 38, 4, T.roof);
    px(ctx, tx - 5, tb - 16, T.roof); px(ctx, tx - 6, tb - 17, T.roof);
    px(ctx, tx + 34, tb - 16, T.roof); px(ctx, tx + 35, tb - 17, T.roof);
    rect(ctx, tx + 12, tb - 6, 6, 6, T.roof);
    // 漁翁島燈塔（白色）
    lighthouse(ctx, 740, top(740) + 6, 30, T, false);
    rect(ctx, 0, HZ - 3, 260, 3, T.near.m);
  },
  flat_isle(ctx, T) {
    // 望安：平坦的綠色島嶼
    island(ctx, 300, 760, HZ, 14, T.green, 101, { flat: true, rough: 1 });
    shrubs(ctx, 320, 740, () => HZ - 14, T, 10);
    for (let i = 0; i < 5; i++) house(ctx, 480 + i * 26, HZ - 12, 14, 7, T, 100 + i);
    rect(ctx, 300, HZ - 2, 460, 2, T.sand.l);
  },
  heart_weir(ctx, T) {
    // 七美：島嶼崖壁 + 低角度看到的雙心石滬
    island(ctx, 380, 800, HZ, 40, T.green, 111, { rough: 3 });
    basaltColumns(ctx, 400, 780, HZ, HZ - 18, T, 111, T.mid);
    // 雙心石滬本身畫在水面上（drawBandObjects），從低角度看是扁的
  },
  deep_sea(ctx, T) {
    // 東吉嶼：遠方的小島與大湧浪
    island(ctx, 560, 680, HZ, 12, { m: T.far, l: T.mid.l }, 121, {});
    lighthouse(ctx, 640, HZ - 9, 14, T, false);
  },
};

/** 畫在水面上的物件（在倒影之後畫，例如石滬）。ox 為圖層的水平裁切位移 */
export function drawBandObjects(ctx, spot, T, ox) {
  if (spot.scene === 'heart_weir') {
    const hearts = [{ cx: 560, cy: HZ + 14, s: 3.6 }, { cx: 612, cy: HZ + 15, s: 2.8 }];
    for (const h of hearts) {
      for (let a = 0; a < Math.PI * 2; a += 0.004) {
        const hx = 16 * Math.pow(Math.sin(a), 3);
        const hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
        const x = Math.round(h.cx + hx * h.s) - ox, y = Math.round(h.cy - hy * h.s * 0.3);
        px(ctx, x, y, T.near.l);
        px(ctx, x, y + 1, T.near.m);
      }
    }
  }
}

const DRAMATIC = new Set(['lighthouse', 'deep_sea', 'sea_arch']);

/** 天空+雲以外的「地面」層（遠景+中景地標），站在海平線上 */
function drawLand(spot, T) {
  const L = makeCanvas(LW, HZ + 1, false);
  // 遠方的群島（每個釣點都有，越遠越淡）
  island(L.ctx, 0, 260, HZ, 6, { m: T.far }, hashString(spot.id) % 999, { flat: true, rough: 1 });
  island(L.ctx, 600, 800, HZ, 5, { m: T.far }, (hashString(spot.id) + 5) % 999, { flat: true, rough: 1 });
  (SCENES[spot.scene] || SCENES.deep_sea)(L.ctx, T);
  return L;
}

// ---------------- 水下剖面 ----------------
function drawUnderwater(regionKind, T, spot) {
  const L = makeCanvas(LW, UW, false);
  const { ctx } = L;
  const r = mulberry32(hashString('uw' + spot.id));
  ditherGradient(ctx, 0, 0, LW, UW, T.under, 8);
  // 光束（只在白天與黃金時段）：抖色斜帶
  if (!T.night) {
    for (let i = 0; i < 6; i++) {
      const x0 = Math.floor(r() * LW);
      for (let y = 0; y < 90; y++) {
        const x = x0 + Math.floor(y * 0.45);
        for (let k = 0; k < 10; k++) if (ditherOn(x + k, y, 0.25 * (1 - y / 90))) px(ctx, x + k, y, T.under[0] === C.sea4 ? C.sea5 : T.under[0]);
      }
    }
  }
  const sand = regionKind === 'whitesand' ? [C.sa2, C.sa3, C.ui4] : regionKind === 'basalt' ? [C.ba2, C.ba3, C.sa1] : [C.sa0, C.sa1, C.sa2];
  const nightSand = T.night ? [C.ba1, C.ba2, C.ba3] : sand;
  // 海底起伏；南海右側是深藍的陡坡
  const floor = (x) => {
    let y = UW - 18 + Math.round(Math.sin(x * 0.02) * 5 + Math.sin(x * 0.07) * 2);
    if (regionKind === 'dropoff' && x > 520) y = Math.min(UW + 20, y + Math.round((x - 520) * 0.4));
    return y;
  };
  for (let x = 0; x < LW; x++) {
    const y = floor(x);
    if (y >= UW) continue;
    rect(ctx, x, y, 1, UW - y, nightSand[0]);
    px(ctx, x, y, nightSand[2]);
    px(ctx, x, y + 1, nightSand[1]);
    if (hash2(x, 1, 7) < 0.08) px(ctx, x, y + 3 + Math.floor(hash2(x, 2, 7) * 8), nightSand[1]);
  }
  // 礁石（玄武岩巨石：3–5 階）
  const rocks = regionKind === 'basalt' ? 9 : 5;
  for (let i = 0; i < rocks; i++) {
    const x = Math.floor(r() * LW), rw = 14 + Math.floor(r() * 26), rh = 10 + Math.floor(r() * 16);
    const by = floor(x) + 3;
    const shades = T.night ? [C.ba0, C.ba1, C.ba2] : [C.ba1, C.ba2, C.ba3, C.ba4];
    ellipse(ctx, x, by - Math.round(rh / 2), Math.round(rw / 2), Math.round(rh / 2), shades[0]);
    ellipse(ctx, x - 2, by - Math.round(rh / 2) - 1, Math.round(rw / 2) - 3, Math.round(rh / 2) - 2, shades[1]);
    ellipse(ctx, x - 4, by - Math.round(rh / 2) - 3, Math.max(1, Math.round(rw / 4) - 1), Math.max(1, Math.round(rh / 4)), shades[2]);
    if (shades[3]) rect(ctx, x - 6, by - rh + 2, 3, 1, shades[3]);
  }
  // 珊瑚
  const coralCols = T.night ? [C.dk2, C.dk3] : [C.cl3, C.wa2, C.dk4, C.dk5];
  const corals = regionKind === 'dropoff' ? 9 : regionKind === 'seagrass' ? 2 : 5;
  for (let i = 0; i < corals; i++) {
    const x = Math.floor(r() * (regionKind === 'dropoff' ? 520 : LW));
    const by = floor(x);
    const cc = coralCols[i % coralCols.length];
    const branches = 3 + Math.floor(r() * 4);
    for (let b = 0; b < branches; b++) {
      let bx = x + b * 3 - branches, byy = by;
      const len = 6 + Math.floor(r() * (regionKind === 'dropoff' ? 16 : 9));
      for (let k = 0; k < len; k++) { px(ctx, bx, byy - k, cc); if (k % 4 === 3) bx += r() < 0.5 ? -1 : 1; }
      px(ctx, bx, byy - len, C.ui4 === cc ? cc : coralCols[(i + 1) % coralCols.length]);
    }
  }
  // 沉木
  const lx = 120 + Math.floor(r() * 200), ly = floor(lx) - 3;
  rect(ctx, lx, ly, 46, 5, T.night ? C.wo0 : C.wo2);
  rect(ctx, lx, ly, 46, 1, T.night ? C.wo1 : C.wo3);
  rect(ctx, lx + 44, ly - 1, 4, 7, T.night ? C.wo0 : C.wo1);
  for (let k = 4; k < 44; k += 7) px(ctx, lx + k, ly + 2, C.wo1);
  rect(ctx, lx + 10, ly - 4, 2, 4, T.night ? C.wo0 : C.wo2);
  // 貝殼
  for (let i = 0; i < 14; i++) { const x = Math.floor(r() * LW); const y = floor(x) + 2; if (y < UW - 1) { px(ctx, x, y, C.sa3); px(ctx, x + 1, y, C.cl3); } }
  // 馬公內海：海草床與蚵架
  if (regionKind === 'seagrass') {
    for (let x = 500; x < 760; x += 40) {
      line(ctx, x, 0, x, floor(x), T.night ? C.wo0 : C.wo2);
      for (let y = 14; y < 70; y += 12) { line(ctx, x + 1, y, x + 3, y + 4, C.ba3); px(ctx, x + 3, y + 5, C.ba4); }
    }
  }
  // 南海：綠蠵龜剪影（只當背景，不能釣）
  if (spot.id === 'D1') {
    const tx = 560, ty = 40;
    ellipse(ctx, tx, ty, 14, 6, T.under[2] || C.sea1);
    ellipse(ctx, tx + 16, ty - 1, 4, 3, T.under[2] || C.sea1);
    line(ctx, tx - 4, ty + 5, tx - 12, ty + 11, T.under[2] || C.sea1);
    line(ctx, tx + 6, ty + 5, tx + 12, ty + 10, T.under[2] || C.sea1);
    line(ctx, tx - 6, ty - 5, tx - 14, ty - 10, T.under[2] || C.sea1);
  }
  return { layer: L, floor, seagrass: regionKind === 'seagrass' };
}

// ---------------- 對外介面 ----------------
export function sceneLayers(spot, regionKind, tone, weather) {
  const T = TONES[tone];
  return {
    tone: T,
    sky: cached(`sky|${tone}|${weather}`, () => drawSky(T, weather)),
    clouds: cached(`cl|${tone}|${weather}|${spot.id}`, () => drawClouds(T, weather, spot, DRAMATIC.has(spot.scene))),
    land: cached(`land|${tone}|${spot.id}`, () => drawLand(spot, T)),
    under: cached(`uw|${tone}|${spot.id}`, () => drawUnderwater(regionKind, T, spot)),
    scene: spot.scene,
  };
}

/** 海草：每一幀依時間擺動（直接畫，不快取） */
export function drawSeaweed(ctx, under, offX, W, t, T, regionKind) {
  const cols = T.night ? [C.pl0, C.pl1] : [C.pl1, C.pl2, C.pl3];
  const count = regionKind === 'seagrass' ? 34 : 16;
  for (let i = 0; i < count; i++) {
    const wx = Math.floor(hash2(i, 77, 1) * LW);
    const sx = wx - offX;
    if (sx < -4 || sx > W + 4) continue;
    const base = under.floor(wx) + WL + 1;
    const len = 10 + Math.floor(hash2(i, 77, 2) * (regionKind === 'seagrass' ? 18 : 34));
    for (let k = 0; k < len; k++) {
      const sway = Math.round(Math.sin(t * 1.3 + i + k * 0.18) * (k / len) * 3);
      px(ctx, sx + sway, base - k, cols[(k + i) % cols.length]);
      if (regionKind !== 'seagrass' && k % 5 === 2) px(ctx, sx + sway + (i % 2 ? 1 : -1), base - k, cols[0]);
    }
  }
}

export function clearSceneCache() { cache.clear(); }
