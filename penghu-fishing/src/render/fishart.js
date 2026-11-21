// 程序化魚圖：依照玩家提供的參考圖畫風（assets/fish/art/）——
//   2 像素粗黑描邊、鰭有條紋、白眼圈大眼、鰓蓋線、身體上的胸鰭、背部鱗片紋理與斑點／網紋。
// 同一個生成器產生游動圖、圖鑑大圖、背包圖示與縮圖。魚一律朝右；顏色全部來自主調色盤。
// 有參考圖的魚（fish.art.sprite）在圖鑑和漁獲卡直接用參考圖。
import { makeCanvas, rotate90, flipH, hash2, PAL } from './pixel.js';

// 體型：ar 高寬比（含鰭）、tail 尾鰭佔寬度比例、prof 身體輪廓（u=0 尾柄、u=1 吻端）、dorsal 背鰭範圍、tailKind 尾型
const S = (a, b, k) => (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * a + b)), k);
const TYPES = {
  fusiform: { ar: 0.5, tail: 0.2, prof: S(0.95, 0.05, 0.7), dorsal: [0.35, 0.68], tailKind: 'fork', fin2: true },
  slender: { ar: 0.36, tail: 0.16, prof: S(0.92, 0.08, 0.45), dorsal: [0.25, 0.7], tailKind: 'round' },
  deep: { ar: 0.72, tail: 0.17, prof: S(0.9, 0.1, 0.55), dorsal: [0.2, 0.75], tailKind: 'truncate' },
  bream: { ar: 0.62, tail: 0.18, prof: S(0.9, 0.1, 0.6), dorsal: [0.18, 0.72], tailKind: 'fork', steep: true, spiny: true },
  pomfret: { ar: 0.78, tail: 0.15, prof: S(0.85, 0.15, 0.5), dorsal: [0.25, 0.6], tailKind: 'fork', noPelvic: true },
  flat: { ar: 0.66, tail: 0.15, prof: S(0.88, 0.12, 0.6), dorsal: [0.3, 0.55], tailKind: 'round', spine: true },
  puffer: { ar: 0.7, tail: 0.15, prof: S(0.8, 0.2, 0.45), dorsal: [0.3, 0.42], tailKind: 'round', tiny: true },
  grouper: { ar: 0.52, tail: 0.16, prof: S(0.85, 0.15, 0.5), dorsal: [0.18, 0.74], tailKind: 'round', bigMouth: true, spiny: true },
  scorpion: { ar: 0.56, tail: 0.16, prof: S(0.8, 0.2, 0.5), dorsal: [0.22, 0.82], tailKind: 'round', spiny: true, tall: true },
  parrot: { ar: 0.54, tail: 0.16, prof: S(0.85, 0.15, 0.55), dorsal: [0.22, 0.76], tailKind: 'truncate', beak: true },
  jack: { ar: 0.6, tail: 0.2, prof: S(0.9, 0.1, 0.6), dorsal: [0.3, 0.62], tailKind: 'fork', steep: true, fin2: true },
  tuna: { ar: 0.5, tail: 0.2, prof: S(0.95, 0.05, 0.65), dorsal: [0.45, 0.64], tailKind: 'crescent', finlets: true, fin2: true },
  tuna_slim: { ar: 0.36, tail: 0.18, prof: S(0.95, 0.05, 0.6), dorsal: [0.35, 0.7], tailKind: 'crescent', finlets: true },
  mahi: { ar: 0.46, tail: 0.18, prof: (u) => S(0.8, 0.2, 0.5)(u) * (0.55 + 0.45 * u), dorsal: [0.05, 0.93], tailKind: 'fork', blunt: true, flatDorsal: true },
  sailfish: { ar: 0.62, tail: 0.15, prof: S(0.95, 0.05, 0.7), dorsal: [0.12, 0.86], tailKind: 'crescent', bill: 0.2, sail: true },
  marlin: { ar: 0.42, tail: 0.16, prof: S(0.95, 0.05, 0.65), dorsal: [0.6, 0.8], tailKind: 'crescent', bill: 0.17 },
  ribbon: { ar: 0.14, tail: 0, prof: (u) => Math.min(1, u * 3.5) * (u > 0.95 ? 0.75 : 1), dorsal: [0.05, 0.92], tailKind: 'none', flatDorsal: true },
  sunfish: { ar: 1.05, tail: 0.08, prof: (u) => Math.max(u < 0.1 ? 0.8 : 0, Math.pow(Math.max(0, 1 - Math.pow(u * 1.6 - 0.6, 2)), 0.45)), dorsal: [0.3, 0.46], tailKind: 'clavus', sunfish: true },
  squid: { ar: 0.4, ceph: 'squid' },
  cuttle: { ar: 0.5, ceph: 'cuttle' },
};

export function typeInfo(t) { return TYPES[t] || TYPES.fusiform; }

/** 在給定寬度下的自然高度（含鰭與描邊） */
export function naturalSize(art, width) {
  let h = Math.max(6, Math.round(width * typeInfo(art.t).ar));
  if (h % 2) h++;
  return { w: width, h };
}

// ---------------- 像素緩衝 ----------------
class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
  set(x, y, col) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h && col) this.c[y * this.w + x] = col; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null; }
  /** 粗黑描邊：外圈 1 像素；thick 時再加內圈 1 像素（參考圖的 2 像素黑邊） */
  outline(color, thick) {
    const { w, h } = this;
    const filled = this.c.map((v) => v !== null);
    const at = (x, y) => x >= 0 && y >= 0 && x < w && y < h && filled[y * w + x];
    const outer = [], inner = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (at(x, y)) {
        if (thick && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1))) inner.push([x, y]);
      } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1)) outer.push([x, y]);
    }
    for (const [x, y] of outer) this.c[y * w + x] = color;
    for (const [x, y] of inner) this.c[y * w + x] = color;
  }
  toCanvas() {
    const S = makeCanvas(this.w, this.h);
    const img = S.ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.c.length; i++) {
      const col = this.c[i];
      if (!col) continue;
      const n = parseInt(col.slice(1), 16);
      img.data[i * 4] = (n >> 16) & 255; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
    }
    S.ctx.putImageData(img, 0, 0);
    return S;
  }
}

const OL = PAL.ui0;

/** 畫一條魚。frame 讓尾巴與鰭擺動（0..frames-1）。 */
export function drawFish(art, W, H, frame = 0, frames = 4) {
  const T = typeInfo(art.t);
  if (T.ceph) return drawCephalopod(art, T, W, H, frame, frames).toCanvas();
  const B = new Buf(W, H);
  const big = W >= 40 && H >= 18;
  const tiny = W < 24;
  const [c0, c1, c2] = art.c;
  const belly = art.b;
  const fin = art.f;
  const finDark = art.fd || c0;
  const ph = (frame / frames) * Math.PI * 2;
  const swing = Math.round(Math.sin(ph) * Math.max(1, H * 0.05));

  // 內容範圍（留 1 像素給外圈描邊）
  const x0 = 1, x1 = W - 2, y0 = 1, y1 = H - 2;
  const iw = x1 - x0 + 1, ih = y1 - y0 + 1;
  const tailW = T.tailKind === 'none' ? 0 : Math.max(2, Math.round(iw * T.tail));
  const billW = T.bill ? Math.round(iw * T.bill) : 0;
  const bx0 = x0 + Math.max(0, tailW - 1), bx1 = x1 - billW, bw = bx1 - bx0 + 1;
  const dh = T.sail ? Math.round(ih * 0.4) : T.sunfish ? Math.round(ih * 0.22) : T.flatDorsal ? Math.max(1, Math.round(ih * 0.14)) : Math.max(1, Math.round(ih * (T.tall ? 0.24 : 0.19)));
  const vh = T.sunfish ? Math.round(ih * 0.22) : Math.max(1, Math.round(ih * (T.tiny ? 0.08 : 0.15)));
  const bt = y0 + dh, bb = y1 - vh;
  const cy = (bt + bb) / 2, half = (bb - bt) / 2;

  const top = [], bot = [];
  for (let x = bx0; x <= bx1; x++) {
    const u = (x - bx0) / Math.max(1, bw - 1);
    let p = T.prof(u);
    if (T.steep && u > 0.78) p *= 1 - (u - 0.78) * 0.85;
    if (T.blunt && u > 0.9) p = Math.max(p, 0.72);
    if (u < 0.07 && T.tailKind !== 'none') p = Math.max(p, 0.22);
    const hh = Math.max(0.6, half * p);
    top[x] = Math.round(cy - hh * (T.blunt ? 1.05 : 1));
    bot[x] = Math.round(cy + hh * 0.93);
  }
  const U = (x) => (x - bx0) / Math.max(1, bw - 1);
  const rays = (i) => (((i % 3) + 3) % 3 === 2 ? finDark : fin); // 鰭條：每 3 列一條深色

  // ---- 鰭（先畫，身體會蓋在上面） ----
  // 背鰭
  const [d0, d1] = T.dorsal;
  const dx0 = bx0 + Math.round(bw * d0), dx1 = bx0 + Math.round(bw * d1);
  for (let x = dx0; x <= dx1; x++) {
    const u = (x - dx0) / Math.max(1, dx1 - dx0);
    let fh;
    if (T.sail) fh = dh * Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.98;
    else if (T.sunfish) fh = dh * (1 - u);
    else if (T.flatDorsal) fh = dh * (u < 0.1 ? 0.6 + u * 4 : 0.85);
    else if (T.spiny) fh = dh * (u < 0.45 ? 0.75 + 0.25 * Math.sin(Math.PI * u / 0.45) : 0.65 + 0.2 * Math.sin(Math.PI * (u - 0.45) / 0.55));
    else fh = dh * Math.pow(1 - u, 0.6);
    fh = Math.max(1, Math.round(fh + (u > 0.1 && u < 0.9 ? Math.sin(ph + u * 4) * 0.4 : 0)));
    for (let k = -1; k < fh; k++) B.set(x, top[x] - k - 1, T.sail && hash2(x, k, 3) < 0.12 ? art.pc : rays(x - dx0));
  }
  // 第二背鰭（鰺、鮪）
  if (T.fin2 && !tiny) {
    const ex0 = bx0 + Math.round(bw * 0.2), ex1 = bx0 + Math.round(bw * 0.32);
    for (let x = ex0; x <= ex1; x++) { const fh = Math.round(dh * 0.6 * (1 - (x - ex0) / Math.max(1, ex1 - ex0)) + 1); for (let k = -1; k < fh; k++) B.set(x, top[x] - k - 1, rays(x)); }
  }
  if (T.spine) for (let k = 0; k < dh + 1; k++) B.set(bx0 + Math.round(bw * 0.74), top[bx0 + Math.round(bw * 0.74)] - k, c0);
  // 臀鰭
  const ax0 = bx0 + Math.round(bw * (T.sunfish ? 0.28 : 0.16)), ax1 = bx0 + Math.round(bw * (T.sunfish ? 0.44 : 0.36));
  for (let x = ax0; x <= ax1; x++) {
    const u = (x - ax0) / Math.max(1, ax1 - ax0);
    const fh = Math.max(1, Math.round((T.sunfish ? vh * (1 - u) : vh * 0.85 * Math.sin(Math.PI * Math.min(1, 0.2 + u * 0.8))) - Math.sin(ph + u * 3) * 0.4));
    for (let k = -1; k < fh; k++) B.set(x, bot[x] + k + 1, rays(x));
  }
  // 腹鰭
  if (!T.noPelvic && !T.sunfish && !tiny && T.tailKind !== 'none') {
    const px0 = bx0 + Math.round(bw * 0.58), px1 = bx0 + Math.round(bw * 0.68);
    for (let x = px0; x <= px1; x++) {
      const fh = Math.max(1, Math.round(vh * (x - px0 + 1) / (px1 - px0 + 1)));
      for (let k = -1; k < fh; k++) B.set(x - Math.floor(k / 2), bot[x] + k + 1, k % 2 ? finDark : fin);
    }
  }
  // 小離鰭（鮪）
  if (T.finlets && big) for (let x = bx0 + 1; x < bx0 + Math.round(bw * 0.2); x += 2) { B.set(x, top[x] - 1, fin); B.set(x, bot[x] + 1, fin); }

  // 尾鰭
  if (T.tailKind !== 'none') {
    const span = T.tailKind === 'clavus' ? half * 0.7 : Math.min(cy - y0, y1 - cy) * (T.tailKind === 'round' || T.tailKind === 'truncate' ? 0.85 : 1);
    const ped = Math.max(1, Math.round(half * 0.22));
    for (let x = x0; x <= bx0 + 1; x++) {
      const t = (x - x0) / Math.max(1, tailW); // 0 = 尾端，1 = 尾柄
      const yc = cy + swing * (1 - t);
      let reach;
      if (T.tailKind === 'round') reach = ped + (span - ped) * Math.sqrt(Math.max(0, 1 - Math.pow(t * 1.1 - 0.15, 2))) * (1 - t * 0.6);
      else if (T.tailKind === 'truncate' || T.tailKind === 'clavus') reach = ped + (span - ped) * (1 - t * 0.85);
      else reach = ped + (span - ped) * Math.pow(1 - t, T.tailKind === 'crescent' ? 0.6 : 0.9);
      for (let y = Math.round(yc - reach); y <= Math.round(yc + reach); y++) {
        const r = Math.abs(y - yc) / Math.max(1, reach);
        if (T.tailKind === 'fork' && t < 0.55 && r < 0.6 * (1 - t / 0.55)) continue;
        if (T.tailKind === 'crescent' && t < 0.45 && r < 0.8 * (1 - t / 0.45)) continue;
        if (T.tailKind === 'clavus' && t < 0.3 && (y % 3 === 0)) continue; // 翻車魚舵鰭的波浪邊
        B.set(x, y, rays(Math.round(y - yc) + (t > 0.85 ? 1 : 0)));
      }
    }
  } else {
    // 白帶魚：尖細的尾巴
    for (let x = x0; x <= bx0 + 2; x++) B.set(x, Math.round(cy + Math.sin(x * 0.5 + ph) * 0.6), c1);
  }

  // ---- 身體 ----
  const fleck = (x, y, k) => hash2(x, y, k + (art.c[1].charCodeAt(3) || 0));
  for (let x = bx0; x <= bx1; x++) {
    const u = U(x);
    const t0 = top[x], b0 = bot[x], hh = Math.max(1, b0 - t0);
    for (let y = t0; y <= b0; y++) {
      const v = (y - t0) / hh;
      const chk = !tiny && (x + y) % 2 === 0;
      let col;
      if (v < 0.16) col = c0;
      else if (v < 0.42) col = chk && v < 0.3 ? c0 : c1;
      else if (v < 0.5) col = chk ? c1 : c2;
      else if (v < 0.57) col = c2;
      else if (v < 0.86) col = belly;
      else col = chk ? belly : c2;
      // 背部鱗片亮點
      if (!tiny && v >= 0.16 && v < 0.42 && fleck(x, y, 1) < 0.1) col = c2;
      if (art.glow && v < 0.45 && fleck(x, y, 2) < 0.05) col = PAL.wa3;
      // 側線色帶（紅甘的琥珀帶、黃鰭鮪的黃帶）
      if (art.band && v >= 0.42 && v < (big ? 0.6 : 0.56) && u < 0.86) col = v < 0.46 && !tiny ? art.band2 || art.band : art.band;
      B.set(x, y, col);
    }
  }
  drawPattern(B, art, T, top, bot, bx0, bx1, W, H, tiny);

  // ---- 頭部：鰓蓋線、眼睛、嘴、眼帶 ----
  const ex = bx0 + Math.round(bw * (T.blunt ? 0.88 : T.sunfish ? 0.8 : 0.86));
  const ey = Math.round(top[ex] + (bot[ex] - top[ex]) * 0.34);
  if (art.eyeband && !tiny) {
    for (let x = ex - Math.round(bw * 0.12); x <= bx1; x++) for (let y = top[x]; y <= bot[x]; y++) {
      const d = (x - ex) * 0.7 + (y - ey) * 1.0;
      if (Math.abs(d) < (big ? 1.3 : 0.8) && y < ey + 3) B.set(x, y, art.eyeband);
    }
  }
  if (!tiny && T.tailKind !== 'none' && !T.sunfish) {
    const gx = bx0 + Math.round(bw * 0.76);
    for (let y = top[gx] + 2; y <= bot[gx] - 1; y++) {
      const v = (y - top[gx]) / Math.max(1, bot[gx] - top[gx]);
      const xx = gx - Math.round(Math.sin(Math.PI * v) * (big ? 2 : 1));
      B.set(xx, y, big ? OL : c0);
      if (big) B.set(xx + 1, y, v > 0.45 ? PAL.ui4 : c2); // 鰓蓋前緣的亮線
    }
  }
  // 嘴
  const my = Math.round(cy + half * (T.bigMouth ? 0.3 : 0.22));
  const ml = T.bigMouth ? Math.max(2, Math.round(bw * 0.1)) : Math.max(1, Math.round(bw * 0.05));
  if (!tiny) for (let k = 0; k < ml; k++) B.set(bx1 - k, my - (k === ml - 1 && big ? 1 : 0), OL);
  if (T.beak) { B.set(bx1, Math.round(cy), PAL.sea6); B.set(bx1 - 1, Math.round(cy), PAL.sea6); }
  if (T.bill) for (let x = bx1 + 1; x <= x1; x++) { B.set(x, top[bx1] + Math.round((bot[bx1] - top[bx1]) * 0.35), c0); if (big && x < x1 - 2) B.set(x, top[bx1] + Math.round((bot[bx1] - top[bx1]) * 0.35) + 1, c1); }
  // 眼睛：白眼圈＋黑瞳孔＋反光
  const bigEye = art.p === 'bigeye';
  if (big) {
    const r = bigEye ? 2 : 1;
    for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) if (dx * dx + dy * dy <= (r + 1) * (r + 1) + 1) B.set(ex + dx, ey + dy, bigEye ? art.pc : PAL.ui4);
    for (let dy = -r; dy <= r - (bigEye ? 0 : 1) + 1; dy++) for (let dx = -r + 1; dx <= r; dx++) B.set(ex + dx, ey + dy, OL);
    B.set(ex + r, ey - r, PAL.ui4);
  } else if (!tiny) {
    B.set(ex, ey, OL); B.set(ex + 1, ey, OL); B.set(ex - 1, ey, PAL.ui4); B.set(ex + 1, ey - 1, PAL.ui4);
  } else {
    B.set(ex, ey, OL);
  }

  // ---- 胸鰭：鰓蓋後方一片往後下方收尖的葉形，自己有描邊 ----
  if (!tiny && !T.sunfish && T.tailKind !== 'none') {
    const pxb = bx0 + Math.round(bw * 0.72), py = Math.round(cy + half * 0.1);
    const L = Math.max(4, Math.round(bw * 0.2)), wide = Math.max(1.5, half * 0.32);
    const set = new Map();
    for (let i = 0; i <= L; i++) {
      const t = i / L;
      const hw = wide * Math.pow(Math.sin(Math.PI * Math.min(1, 0.25 + t * 0.75)), 0.8) + (i > 1 && i < L ? Math.sin(ph) * 0.3 : 0);
      const yc = py + t * half * 0.35; // 往後下方
      for (let y = Math.round(yc - hw); y <= Math.round(yc + hw); y++) set.set(`${pxb - i},${y}`, [pxb - i, y]);
    }
    for (const [x, y] of set.values()) {
      const edge = !set.has(`${x - 1},${y}`) || !set.has(`${x + 1},${y}`) || !set.has(`${x},${y - 1}`) || !set.has(`${x},${y + 1}`);
      B.set(x, y, edge ? OL : (y % 3 === 2 ? finDark : fin));
    }
  }

  B.outline(OL, big);
  return B.toCanvas();
}

function drawPattern(B, art, T, top, bot, bx0, bx1, W, H, tiny) {
  const pc = art.pc, p = art.p;
  const bw = bx1 - bx0 + 1;
  const inside = (x, y) => x >= bx0 && x <= bx1 && y > top[x] && y < bot[x];
  const headCut = bx0 + Math.round(bw * (['mottle', 'honeycomb', 'blotch', 'spots'].includes(p) ? 0.95 : 0.8));
  const seed = art.c[0].charCodeAt(2) + art.pc.charCodeAt(4);
  for (let x = bx0 + 1; x < headCut; x++) {
    const t = top[x], b = bot[x], hh = b - t;
    if (hh < 3) continue;
    for (let y = t + 1; y < b; y++) {
      const v = (y - t) / hh;
      let on = false;
      switch (p) {
        case 'stripes': on = [0.22, 0.38, 0.54].some((s) => Math.abs(v - s) < 0.5 / hh) && (H >= 24 || v < 0.45); break;
        case 'lateral': on = Math.abs(v - 0.48) < 0.5 / hh; break;
        case 'bars': { const per = Math.max(4, Math.round(bw / 6)); on = ((x - bx0) % per) < Math.max(1, Math.round(per * 0.38)) && v < 0.78; break; }
        case 'waves': on = v < 0.42 && (Math.round((y - t) + Math.sin(x * 0.7) * 1.5) % 3 === 0); break;
        case 'arcs': on = [0.22, 0.4, 0.58].some((s) => Math.abs(v - s - Math.sin(((x - bx0) / bw) * Math.PI) * 0.06) < 0.5 / hh); break;
        case 'belly_stripes': on = [0.64, 0.74, 0.84].some((s) => Math.abs(v - s) < 0.5 / hh); break;
        case 'scales': on = v < 0.7 && (x + y * 2) % 4 === 0; break;
        case 'spots': on = v < 0.8 && hash2(x, y, seed) < 0.12; break;
        case 'dots': on = v < 0.75 && hash2(x, y, seed) < 0.07; break;
        case 'freckles': case 'speckle': on = v < 0.9 && hash2(x, y, seed) < (v < 0.5 ? 0.12 : 0.18); break;
        case 'mottle': case 'blotch': {
          const n = hash2(Math.floor((x + (y % 2)) / 3), Math.floor(y / 3), seed);
          on = n < 0.32 && hash2(x, y, seed + 1) < 0.85;
          break;
        }
        case 'honeycomb': {
          // 網紋：亮色細線把身體分成一塊塊深色斑
          const s = tiny ? 3 : 5;
          let d1 = 99, d2 = 99;
          const gx = Math.floor(x / s), gy = Math.floor(y / s);
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const cx = (gx + i) * s + hash2(gx + i, gy + j, seed) * s, cyy = (gy + j) * s + hash2(gx + i, gy + j, seed + 7) * s;
            const d = Math.hypot(x - cx, y - cyy);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          if (d2 - d1 < 1.1) on = true;
          else if (art.pc2 && hash2(x, y, seed + 3) < 0.04) { B.set(x, y, art.pc2); continue; }
          break;
        }
        default: break;
      }
      if (on && inside(x, y)) B.set(x, y, pc);
    }
  }
}

// ---------------- 小管、軟絲 ----------------
function drawCephalopod(art, T, W, H, frame, frames) {
  const B = new Buf(W, H);
  const [c0, c1, c2] = art.c;
  const big = W >= 40;
  const cy = Math.round(H / 2);
  const mx0 = Math.round(W * 0.4), mx1 = W - 2;
  const ph = (frame / frames) * Math.PI * 2;
  for (let x = mx0; x <= mx1; x++) {
    const u = (x - mx0) / (mx1 - mx0);
    const hh = T.ceph === 'cuttle' ? (H * 0.3) * Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1, 2))) * 1.05 : (H * 0.26) * (1 - u * 0.72);
    const t0 = Math.round(cy - hh), b0 = Math.round(cy + hh);
    for (let y = t0; y <= b0; y++) {
      const v = (y - t0) / Math.max(1, b0 - t0);
      let col = v < 0.3 ? c0 : v < 0.62 ? c1 : art.b;
      if (v < 0.62 && hash2(x, y, 9) < 0.14) col = art.pc;
      B.set(x, y, col);
    }
    if (T.ceph === 'cuttle') { if (x > mx0 + 1 && x < mx1 - 1) { B.set(x, t0 - 1, art.f); B.set(x, b0 + 1, art.f); if ((x + frame) % 2 === 0) { B.set(x, t0 - 2, art.f); B.set(x, b0 + 2, art.f); } } }
    else if (u > 0.7) { const fh = Math.round((u - 0.7) * H * 0.9); for (let k = 1; k <= fh; k++) { B.set(x, t0 - k, art.f); B.set(x, b0 + k, art.f); } }
  }
  B.set(Math.round((mx0 + mx1) / 2), cy - Math.round(H * 0.12), c2);
  const hx0 = Math.round(W * 0.27);
  for (let x = hx0; x <= mx0; x++) for (let y = cy - Math.round(H * 0.15); y <= cy + Math.round(H * 0.15); y++) B.set(x, y, c1);
  // 眼
  B.set(mx0 - 2, cy - 1, PAL.ui4); B.set(mx0 - 1, cy - 1, OL); B.set(mx0 - 1, cy, OL); B.set(mx0 - 2, cy, OL);
  // 腕
  for (let i = 0; i < 4; i++) {
    const oy = (i - 1.5) * Math.max(1, H * 0.09);
    for (let x = 1; x < hx0; x++) {
      const u = 1 - x / hx0;
      const y = Math.round(cy + oy * (0.6 + u * 0.6) + Math.sin(x * 0.6 + ph + i) * (1 - u) * 1.2);
      if (x > hx0 * (i % 2 ? 0.15 : 0)) B.set(x, y, i % 2 ? c0 : c1);
    }
  }
  B.outline(OL, big);
  return B;
}

// ---------------- 參考圖（玩家提供的像素畫） ----------------
const refSprites = new Map();

/** 開始遊戲前預先載入 fish.json 裡有 art.sprite 的參考圖 */
export async function loadFishSprites(data, base = '') {
  await Promise.all(data.fish.filter((f) => f.art.sprite).map((f) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const S = makeCanvas(img.width, img.height);
      S.ctx.drawImage(img, 0, 0);
      refSprites.set(f.id, S);
      resolve();
    };
    img.onerror = () => { console.warn(`讀不到魚的參考圖 ${f.art.sprite}，改用程式畫的版本`); resolve(); };
    img.src = base + f.art.sprite;
  })));
  cache.clear();
}

export function refSprite(fish) { return refSprites.get(fish.id) || null; }

// ---------------- 快取與各種尺寸 ----------------
const cache = new Map();

/** 整數倍放大（nearest），不做任何平滑 */
function upscale(src, k) {
  const out = makeCanvas(src.w * k, src.h * k);
  out.ctx.imageSmoothingEnabled = false;
  out.ctx.drawImage(src.c, 0, 0, src.w * k, src.h * k);
  return out;
}

/** 游動圖：寬度依體型（S16/M24/L40/XL64，巨型魚 96–140），畫面上 1:1 */
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

/**
 * 圖鑑大圖：原生 68x40（巨型魚 100x48），以 2 倍整數放大成 136x80（200x96），
 * 和參考圖同樣的「大像素」密度。有參考圖的魚直接用參考圖。
 */
export function codexArt(fish, silhouette = false) {
  const key = `codex|${fish.id}|${silhouette}`;
  if (cache.has(key)) return cache.get(key);
  const ref = refSprite(fish);
  let native;
  if (ref) {
    native = makeCanvas(ref.w, ref.h);
    native.ctx.drawImage(ref.c, 0, 0);
  } else {
    const giant = fish.w[1] >= 80;
    native = fitFish(fish, giant ? 100 : 68, giant ? 48 : 40, 0);
  }
  if (silhouette) silhouetteOf(native, PAL.ui1);
  const out = upscale(native, 2);
  cache.set(key, out);
  return out;
}

/** 縮圖（圖鑑格子、魚市清單、離線摘要）：原生 32x18，1:1 */
export function thumbArt(fish, silhouette = false) {
  const key = `thumb|${fish.id}|${silhouette}`;
  if (cache.has(key)) return cache.get(key);
  const out = fitFish(fish, 32, 18, 0);
  if (silhouette) silhouetteOf(out, PAL.ui1);
  cache.set(key, out);
  return out;
}

/** 背包圖示：以半解析度重畫（和圖鑑同一種大像素），再 2 倍放大填滿 cols*cell x rows*cell */
export function packIcon(fish, shape, cell, rot = false) {
  const key = `pack|${fish.id}|${shape.join('x')}|${cell}|${rot}`;
  if (cache.has(key)) return cache.get(key);
  let out;
  if (rot) out = rotate90(packIcon(fish, shape, cell, false));
  else {
    const W = shape[1] * cell, H = shape[0] * cell;
    const half = fitFish(fish, Math.floor(W / 2), Math.floor(H / 2), 1);
    out = makeCanvas(W, H);
    out.ctx.imageSmoothingEnabled = false;
    out.ctx.drawImage(half.c, Math.floor((W - half.w * 2) / 2), Math.floor((H - half.h * 2) / 2), half.w * 2, half.h * 2);
  }
  cache.set(key, out);
  return out;
}

function fitFish(fish, CW, CH, pad) {
  const out = makeCanvas(CW, CH);
  let w = CW - pad * 2;
  let { h } = naturalSize(fish.art, w);
  if (h > CH - pad * 2) { w = Math.floor((w * (CH - pad * 2)) / h); h = naturalSize(fish.art, w).h; }
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
