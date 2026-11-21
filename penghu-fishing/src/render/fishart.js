// 程序化魚圖：同一個生成器產生游動圖、圖鑑大圖與背包圖示，確保風格一致。
// 魚一律朝右；身體配色來自 fish.json 的 art 欄位（全部是主調色盤顏色）。
import { makeCanvas, px, rect, selOut, rotate90, flipH, hash2, PAL } from './pixel.js';

// 各體型：高寬比、尾鰭比例、身體輪廓函式 p(u)（u=0 尾柄，u=1 吻端）
const TYPES = {
  fusiform: { ar: 0.36, tail: 0.2, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.7), dorsal: [0.35, 0.65], fork: true },
  slender: { ar: 0.24, tail: 0.16, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.08)), 0.45), dorsal: [0.3, 0.7], fork: false },
  deep: { ar: 0.62, tail: 0.18, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.55), dorsal: [0.2, 0.75], fork: false },
  bream: { ar: 0.5, tail: 0.18, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.6), dorsal: [0.2, 0.7], fork: true, steep: true },
  pomfret: { ar: 0.7, tail: 0.16, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.15)), 0.5), dorsal: [0.25, 0.55], fork: true },
  flat: { ar: 0.55, tail: 0.16, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.88 + 0.12)), 0.6), dorsal: [0.3, 0.55], fork: false, spine: true },
  puffer: { ar: 0.62, tail: 0.16, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.8 + 0.2)), 0.45), dorsal: [0.3, 0.42], fork: false },
  grouper: { ar: 0.42, tail: 0.17, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.15)), 0.5), dorsal: [0.2, 0.72], fork: false, bigMouth: true },
  scorpion: { ar: 0.46, tail: 0.17, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.8 + 0.2)), 0.5), dorsal: [0.25, 0.8], fork: false, spiky: true },
  parrot: { ar: 0.45, tail: 0.17, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.15)), 0.55), dorsal: [0.25, 0.75], fork: false, beak: true },
  jack: { ar: 0.44, tail: 0.2, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.6), dorsal: [0.3, 0.6], fork: true, steep: true },
  tuna: { ar: 0.34, tail: 0.2, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.65), dorsal: [0.45, 0.62], fork: true, finlets: true },
  tuna_slim: { ar: 0.24, tail: 0.18, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.6), dorsal: [0.35, 0.7], fork: true, finlets: true },
  mahi: { ar: 0.36, tail: 0.2, prof: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.8 + 0.2)), 0.5) * (0.55 + 0.45 * u), dorsal: [0.05, 0.95], fork: true, blunt: true },
  sailfish: { ar: 0.42, tail: 0.16, prof: (u) => 0.55 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.7), dorsal: [0.15, 0.85], fork: true, bill: 0.2, sail: true },
  marlin: { ar: 0.34, tail: 0.17, prof: (u) => 0.8 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.65), dorsal: [0.55, 0.75], fork: true, bill: 0.18 },
  ribbon: { ar: 0.12, tail: 0.0, prof: (u) => Math.min(1, u * 3) * (u > 0.94 ? 0.7 : 1), dorsal: [0.05, 0.9], fork: false, ribbon: true },
  sunfish: { ar: 0.8, tail: 0.08, prof: (u) => Math.max(u < 0.1 ? 0.75 : 0, Math.pow(Math.max(0, 1 - Math.pow(u * 1.6 - 0.6, 2)), 0.45)), dorsal: [0.28, 0.46], fork: false, sunfish: true },
  squid: { ar: 0.34, tail: 0, prof: null, squid: true },
  cuttle: { ar: 0.46, tail: 0, prof: null, cuttle: true },
};

export function typeInfo(t) { return TYPES[t] || TYPES.fusiform; }

/** 魚在一個 w x h 範圍內、以給定寬度能取得的最佳高度 */
export function naturalSize(art, width) {
  const T = typeInfo(art.t);
  let h = Math.max(5, Math.round(width * T.ar));
  if (T.sail) h = Math.round(h * 1.5);
  if (T.sunfish) h = Math.round(width * 1.5);
  if (h % 2) h++;
  return { w: width, h };
}

/**
 * 畫一條魚到新的畫布。frame 用來擺動尾巴與鰭（0..frames-1）。
 */
export function drawFish(art, W, H, frame = 0, frames = 4) {
  const T = typeInfo(art.t);
  const spr = makeCanvas(W, H);
  const { ctx } = spr;
  const [cDark, cMid, cLight] = art.c;
  const belly = art.b;
  const swing = Math.round(Math.sin((frame / frames) * Math.PI * 2) * Math.max(1, H * 0.06));
  const finSwing = Math.round(Math.sin((frame / frames) * Math.PI * 2 + 1) * 1);

  if (T.squid || T.cuttle) { drawCephalopod(spr, art, T, frame, frames); return spr; }

  const billW = T.bill ? Math.round(W * T.bill) : 0;
  const tailW = Math.max(2, Math.round(W * T.tail));
  const bodyX0 = tailW;
  const bodyX1 = W - 1 - billW;
  const bodyW = bodyX1 - bodyX0 + 1;
  // 身體的垂直範圍（帆鰭、旗魚需要留空間給鰭）
  let bodyH = T.sail ? Math.round(H / 1.5) : T.sunfish ? Math.round(H * 0.62) : H - 2;
  if (!T.sail && !T.sunfish) bodyH = Math.max(3, Math.round(H * 0.8));
  const cy = T.sail ? H - Math.round(bodyH / 2) - 1 : Math.round(H / 2);
  const half = bodyH / 2;

  const top = new Array(W).fill(null), bot = new Array(W).fill(null);
  for (let x = bodyX0; x <= bodyX1; x++) {
    const u = (x - bodyX0) / Math.max(1, bodyW - 1);
    let p = T.prof(u);
    if (T.steep && u > 0.75) p *= 1 - (u - 0.75) * 0.9;
    if (T.blunt && u > 0.9) p = Math.max(p, 0.7);
    // 尾柄要細
    if (u < 0.08 && !T.ribbon) p = Math.max(p, 0.18);
    const hh = Math.max(0.6, half * p);
    // 頭部上下不對稱：背部略高、腹部較平
    top[x] = Math.round(cy - hh * (T.blunt ? 1.05 : 1));
    bot[x] = Math.round(cy + hh * 0.92);
  }

  // 身體配色：背部暗、側面中間、側線亮、腹部淺（色相偏移由調色盤本身提供）
  for (let x = bodyX0; x <= bodyX1; x++) {
    const t0 = top[x], b0 = bot[x];
    const hgt = b0 - t0 + 1;
    for (let y = t0; y <= b0; y++) {
      const v = (y - t0) / Math.max(1, hgt - 1);
      let c = v < 0.28 ? cDark : v < 0.55 ? cMid : v < 0.68 ? cLight : belly;
      px(ctx, x, y, c);
    }
  }
  // 受光：左上來光，背部前段亮一排
  for (let x = bodyX0 + Math.round(bodyW * 0.45); x < bodyX1 - 1; x++) {
    if (top[x] + 1 < bot[x]) px(ctx, x, top[x] + 1, cMid);
  }

  // 花紋
  drawPattern(ctx, art, top, bot, bodyX0, bodyX1, W, H);

  // 背鰭
  const [d0, d1] = T.dorsal;
  const dx0 = bodyX0 + Math.round(bodyW * d0), dx1 = bodyX0 + Math.round(bodyW * d1);
  for (let x = dx0; x <= dx1; x++) {
    const u = (x - dx0) / Math.max(1, dx1 - dx0);
    let fh;
    if (T.sail) fh = Math.round((H - bodyH) * 0.95 * Math.sin(Math.PI * Math.min(1, u * 1.1)));
    else if (T.sunfish) fh = Math.round(((H - bodyH) / 2 - 1) * (1 - u));
    else if (T.mahi || T.ribbon) fh = Math.max(1, Math.round(H * (T.ribbon ? 0.18 : 0.12)));
    else fh = Math.max(1, Math.round(H * (T.spiky ? 0.16 : 0.12) * (1 - u * 0.6)));
    for (let k = 1; k <= fh; k++) {
      const y = top[x] - k;
      if (y < 0) break;
      // 鰭條：每隔一欄較暗；鰭的透光用較亮色
      const col = T.spiky && k === fh && x % 2 === 0 ? cDark : (x + k) % 3 === 0 ? cDark : art.f;
      px(ctx, x, y, col);
    }
  }
  if (T.spine) { for (let k = 1; k <= Math.round(H * 0.22); k++) px(ctx, bodyX0 + Math.round(bodyW * 0.72), top[bodyX0 + Math.round(bodyW * 0.72)] - k, cDark); }

  // 臀鰭與腹鰭
  const ax = bodyX0 + Math.round(bodyW * (T.sunfish ? 0.28 : 0.25));
  const aw = Math.max(2, Math.round(bodyW * 0.18));
  for (let x = ax; x < ax + aw; x++) {
    const ah = T.sunfish ? Math.round(((H - bodyH) / 2 - 1) * (1 - (x - ax) / aw)) : Math.max(1, Math.round(H * 0.08));
    for (let k = 1; k <= ah; k++) if (bot[x] + k < H) px(ctx, x, bot[x] + k, (x + k) % 3 === 0 ? cDark : art.f);
  }
  if (!T.sunfish && !T.ribbon && H >= 10) {
    const pxp = bodyX0 + Math.round(bodyW * 0.62);
    px(ctx, pxp, bot[pxp] + 1, art.f);
    if (H > 20) px(ctx, pxp + 1, bot[pxp] + 1 + (finSwing > 0 ? 1 : 0), art.f);
  }
  if (T.finlets && W >= 40) {
    for (let x = bodyX0 + 2; x < bodyX0 + Math.round(bodyW * 0.25); x += 2) {
      px(ctx, x, top[x] - 1, art.f); px(ctx, x, bot[x] + 1, art.f);
    }
  }

  // 尾鰭（隨 frame 擺動）
  if (!T.ribbon) {
    const ty = cy + swing;
    const span = T.sunfish ? Math.round(bodyH * 0.45) : Math.max(2, Math.round(H * (T.fork ? 0.48 : 0.36)));
    for (let x = 0; x < tailW; x++) {
      const u = 1 - x / Math.max(1, tailW); // 尾端 → 尾柄
      let reach = Math.round(span * (0.35 + 0.65 * u));
      for (let y = -reach; y <= reach; y++) {
        // 叉尾：中間凹進去
        if (T.fork && Math.abs(y) < reach * 0.55 * u && x < tailW * 0.6) continue;
        const yy = Math.round(ty + y * (1 - x / (tailW * 3)) + (cy - ty) * (x / tailW));
        if (yy < 0 || yy >= H) continue;
        px(ctx, x, yy, (y + x) % 3 === 0 ? cDark : art.f);
      }
    }
    // 尾柄接合
    for (let x = tailW - 1; x <= bodyX0 + 1; x++) {
      const t0 = Math.round(cy - Math.max(1, half * 0.2)), b0 = Math.round(cy + Math.max(1, half * 0.2));
      for (let y = t0; y <= b0; y++) px(ctx, x, y, y < cy ? cDark : cMid);
    }
  } else {
    // 白帶魚：尾巴是細長的尖端
    for (let x = 0; x < bodyX0 + 3; x++) px(ctx, x, cy + Math.round(Math.sin(x * 0.5 + frame) * 0.6), cMid);
  }

  // 吻與嘴
  if (T.bill) {
    for (let x = bodyX1; x < W; x++) px(ctx, x, top[bodyX1] + Math.round((bot[bodyX1] - top[bodyX1]) * 0.35), cDark);
  }
  if (T.bigMouth && H >= 12) {
    const mx = bodyX1 - 1, my = Math.round(cy + half * 0.25);
    px(ctx, mx, my, cDark); px(ctx, mx - 1, my, cDark); if (W > 60) px(ctx, mx - 2, my, cDark);
  }
  if (T.beak) { px(ctx, bodyX1, Math.round(cy), PAL.sea6); px(ctx, bodyX1 - 1, Math.round(cy), PAL.sea6); }

  // 眼睛（大眼鯛：大眼）
  const ex = bodyX0 + Math.round(bodyW * (T.blunt ? 0.86 : 0.84));
  const ey = Math.round(top[ex] + (bot[ex] - top[ex]) * 0.35);
  const big = art.p === 'bigeye' || H >= 30;
  if (big) {
    rect(ctx, ex - 1, ey - 1, 3, 3, PAL.ui0);
    if (art.p === 'bigeye') { px(ctx, ex - 2, ey, art.pc); px(ctx, ex + 2, ey, art.pc); px(ctx, ex, ey - 2, art.pc); }
    px(ctx, ex, ey - 1, PAL.ui4); // 眼睛反光
  } else {
    px(ctx, ex, ey, PAL.ui0);
    if (H >= 14) px(ctx, ex + 1, ey - 1, PAL.ui4);
  }
  // 鰓蓋線
  if (H >= 16 && !T.ribbon && !T.sunfish) {
    const gx = ex - Math.max(2, Math.round(bodyW * 0.08));
    for (let y = top[gx] + 2; y < bot[gx] - 1; y++) if ((y + gx) % 2 === 0) px(ctx, gx, y, cDark);
  }

  selOut(spr, cDark, null);
  // sel-out 後重畫眼睛反光（避免被描邊蓋掉）
  if (H >= 14) px(ctx, big ? ex : ex + 1, big ? ey - 1 : ey - 1, PAL.ui4);
  return spr;
}

function drawPattern(ctx, art, top, bot, x0, x1, W, H) {
  const pc = art.pc;
  const p = art.p;
  const bodyW = x1 - x0 + 1;
  const inBody = (x, y) => x >= x0 && x <= x1 && y > top[x] && y < bot[x];
  for (let x = x0 + 1; x < x1 - Math.max(2, Math.round(bodyW * 0.14)); x++) {
    const t = top[x], b = bot[x], hh = b - t;
    if (hh < 3) continue;
    const u = (x - x0) / bodyW;
    switch (p) {
      case 'stripes': {
        const n = H >= 24 ? 3 : 2;
        for (let i = 1; i <= n; i++) { const y = Math.round(t + hh * (i / (n + 1)) * 0.7); if (inBody(x, y)) px(ctx, x, y, pc); }
        break;
      }
      case 'lateral': { const y = Math.round(t + hh * 0.48); if (inBody(x, y)) px(ctx, x, y, pc); break; }
      case 'bars': {
        const period = Math.max(4, Math.round(bodyW / 6));
        if (((x - x0) % period) < Math.max(1, Math.round(period * 0.35))) for (let y = t + 1; y < t + hh * 0.75; y++) if (inBody(x, y)) px(ctx, x, y, pc);
        break;
      }
      case 'waves': {
        for (let y = t + 1; y < t + hh * 0.4; y++) if (inBody(x, y) && Math.round((y - t) + Math.sin(x * 0.7) * 1.5) % 3 === 0) px(ctx, x, y, pc);
        break;
      }
      case 'arcs': {
        for (let k = 0; k < 3; k++) { const y = Math.round(t + hh * (0.2 + k * 0.18) + Math.sin(u * Math.PI) * hh * 0.08); if (inBody(x, y)) px(ctx, x, y, pc); }
        break;
      }
      case 'belly_stripes': {
        for (let k = 0; k < 3; k++) { const y = Math.round(t + hh * (0.62 + k * 0.1)); if (inBody(x, y)) px(ctx, x, y, pc); }
        break;
      }
      case 'scales': {
        for (let y = t + 1; y < b; y++) if (inBody(x, y) && (x + y) % 4 === 0 && y < t + hh * 0.7) px(ctx, x, y, pc);
        break;
      }
      default: break;
    }
  }
  // 點狀花紋：用固定雜湊散佈
  if (['spots', 'dots', 'mottle', 'freckles'].includes(p)) {
    const density = p === 'spots' ? 0.12 : p === 'dots' ? 0.07 : p === 'freckles' ? 0.05 : 0.2;
    const blob = p === 'mottle' && H >= 20 ? 2 : 1;
    for (let x = x0 + 2; x < x1 - Math.max(2, Math.round(bodyW * 0.12)); x += blob) {
      for (let y = top[x] + 1; y < bot[x] - 1; y += blob) {
        if (p === 'freckles' && y > top[x] + (bot[x] - top[x]) * 0.5) continue;
        if (hash2(x, y, art.c[1].length + art.pc.charCodeAt(2)) < density && inBody(x, y)) {
          for (let dy = 0; dy < blob; dy++) for (let dx = 0; dx < blob; dx++) if (inBody(x + dx, y + dy)) px(ctx, x + dx, y + dy, art.pc);
        }
      }
    }
  }
}

function drawCephalopod(spr, art, T, frame, frames) {
  const { ctx, w: W, h: H } = spr;
  const [cDark, cMid, cLight] = art.c;
  const cy = Math.round(H / 2);
  const mantleX0 = Math.round(W * 0.38), mantleX1 = W - 1;
  const armX1 = mantleX0;
  const wob = Math.round(Math.sin((frame / frames) * Math.PI * 2) * 1);
  // 外套膜（朝右）
  for (let x = mantleX0; x <= mantleX1; x++) {
    const u = (x - mantleX0) / (mantleX1 - mantleX0);
    const hh = (H * (T.cuttle ? 0.32 : 0.26)) * (T.cuttle ? Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1, 2))) * 1.1 : (1 - u * 0.75));
    const t0 = Math.round(cy - hh), b0 = Math.round(cy + hh);
    for (let y = t0; y <= b0; y++) {
      const v = (y - t0) / Math.max(1, b0 - t0);
      px(ctx, x, y, v < 0.3 ? cDark : v < 0.65 ? cMid : art.b);
    }
    // 鰭：軟絲是整圈的裙邊；小管只在尾端
    if (T.cuttle) {
      if (x > mantleX0 + 1 && x < mantleX1 - 1) { px(ctx, x, t0 - 1, art.f); px(ctx, x, b0 + 1, art.f); if ((x + frame) % 2 === 0) { px(ctx, x, t0 - 2, art.f); px(ctx, x, b0 + 2, art.f); } }
    } else if (u > 0.72) {
      const fh = Math.round((u - 0.72) * H * 0.9);
      for (let k = 1; k <= fh; k++) { px(ctx, x, t0 - k, art.f); px(ctx, x, b0 + k, art.f); }
    }
  }
  // 斑點色素
  for (let x = mantleX0 + 1; x < mantleX1 - 1; x++) for (let y = cy - Math.round(H * 0.2); y < cy + Math.round(H * 0.1); y++) {
    if (hash2(x, y, 9) < 0.12) { const a = ctx.getImageData(x, y, 1, 1).data[3]; if (a) px(ctx, x, y, art.pc); }
  }
  // 頭與眼
  const hx0 = Math.round(W * 0.28);
  for (let x = hx0; x < mantleX0 + 1; x++) for (let y = cy - Math.round(H * 0.15); y <= cy + Math.round(H * 0.15); y++) px(ctx, x, y, cMid);
  rect(ctx, mantleX0 - 2, cy - 1, 2, 2, PAL.ui0); px(ctx, mantleX0 - 2, cy - 1, PAL.ui4);
  // 腕
  const arms = 4;
  for (let i = 0; i < arms; i++) {
    const oy = Math.round((i - (arms - 1) / 2) * Math.max(1, H * 0.09));
    for (let x = 0; x < hx0; x++) {
      const u = 1 - x / hx0;
      const y = Math.round(cy + oy * (0.6 + u * 0.6) + Math.sin(x * 0.6 + frame * 1.5 + i) * (1 - u) * 1.2 + wob * (1 - u));
      if (y >= 0 && y < H && x > hx0 * (i % 2 ? 0.15 : 0.0)) px(ctx, x, y, i % 2 ? cDark : cMid);
    }
  }
  selOut(spr, cDark, null);
  px(ctx, mantleX0 - 2, cy - 1, PAL.ui4);
  // 讓 cLight 也出現（高光）
  px(ctx, Math.round((mantleX0 + mantleX1) / 2), cy - Math.round(H * 0.12), cLight);
}

// ---------- 快取 ----------
const cache = new Map();

/** 游動圖：寬度依體型（S16/M24/L40/XL64，巨型魚 96–140） */
export function swimWidth(fish, size) {
  const giant = fish.w[1] >= 80;
  const base = { S: 16, M: 24, L: 40, XL: 64 }[size];
  if (giant && (size === 'L' || size === 'XL')) return size === 'XL' ? (fish.w[1] >= 150 ? 140 : 112) : 96;
  return base;
}

export function swimFrames(fish, size, dir = 1) {
  const key = `swim|${fish.id}|${size}|${dir}`;
  if (cache.has(key)) return cache.get(key);
  const W = swimWidth(fish, size);
  const { h } = naturalSize(fish.art, W);
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const s = drawFish(fish.art, W, h, f, 4);
    frames.push(dir < 0 ? flipH(s) : s);
  }
  cache.set(key, frames);
  return frames;
}

/** 圖鑑大圖：128x64（巨型魚 192x80），魚置中 */
export function codexArt(fish, silhouette = false) {
  const key = `codex|${fish.id}|${silhouette}`;
  if (cache.has(key)) return cache.get(key);
  const giant = fish.w[1] >= 80;
  const CW = giant ? 192 : 128, CH = giant ? 80 : 64;
  const out = fitFish(fish, CW, CH, 4);
  if (silhouette) silhouetteOf(out, PAL.ui1);
  cache.set(key, out);
  return out;
}

/** 背包圖示：形狀 [rows, cols] × 每格 cell 像素；rot=true 時使用整數像素轉置 */
export function packIcon(fish, shape, cell, rot = false) {
  const key = `pack|${fish.id}|${shape.join('x')}|${cell}|${rot}`;
  if (cache.has(key)) return cache.get(key);
  let out;
  if (rot) out = rotate90(packIcon(fish, shape, cell, false));
  else out = fitFish(fish, shape[1] * cell, shape[0] * cell, 2);
  cache.set(key, out);
  return out;
}

function fitFish(fish, CW, CH, pad) {
  const out = makeCanvas(CW, CH);
  let w = CW - pad * 2;
  let { h } = naturalSize(fish.art, w);
  if (h > CH - pad * 2) { w = Math.floor(w * (CH - pad * 2) / h); h = naturalSize(fish.art, w).h; }
  if (h > CH - pad * 2) h = CH - pad * 2;
  w = Math.max(8, w);
  const spr = drawFish(fish.art, w, h, 0, 4);
  out.ctx.drawImage(spr.c, Math.floor((CW - w) / 2), Math.floor((CH - h) / 2));
  return out;
}

export function silhouetteOf(sprite, color) {
  const { ctx, w, h } = sprite;
  const id = ctx.getImageData(0, 0, w, h);
  ctx.fillStyle = color;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (id.data[(y * w + x) * 4 + 3]) ctx.fillRect(x, y, 1, 1);
}

export function clearFishCache() { cache.clear(); }
