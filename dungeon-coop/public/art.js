// 程序化像素美術：64x64 角色（4 職業 × 4 造型）與 96x96 頭目
// 管線：各部件獨立圖層 → 去鋸齒門檻化（硬邊像素）→ 右下純黑墨影（Chiaroscuro）＋左上邊緣光 → 合成 → 1px 黑色外框 → 霓虹發光層
import { SKINS } from './data.js';

const TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const INK = '#07050c';

function shade(cv, k = 3, ink = 0.82, rim = 0.32) {
  const x = cv.getContext('2d'), { width: w, height: h } = cv, img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  const A = (px, py) => (px < 0 || py < 0 || px >= w || py >= h ? 0 : d[(py * w + px) * 4 + 3]);
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let px = 0; px < w; px++) {
    const o = (y * w + px) * 4;
    if (!d[o + 3]) continue;
    if (k && !A(px + k, py(y, k))) { for (let c = 0; c < 3; c++) out[o + c] = d[o + c] * (1 - ink); }
    else if (!A(px - 1, y - 1)) { for (let c = 0; c < 3; c++) out[o + c] = d[o + c] + (255 - d[o + c]) * rim; }
  }
  function py(yy, kk) { return yy + kk; }
  img.data.set(out); x.putImageData(img, 0, 0);
  return cv;
}
function outline(cv, col = INK) {
  const x = cv.getContext('2d'), { width: w, height: h } = cv, img = x.getImageData(0, 0, w, h), d = img.data, out = new Uint8ClampedArray(d);
  const [r, g, b] = hex(col);
  for (let y = 0; y < h; y++) for (let px = 0; px < w; px++) {
    const o = (y * w + px) * 4;
    if (d[o + 3]) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = px + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < w && yy < h && d[(yy * w + xx) * 4 + 3] > 0; });
    if (n) { out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; }
  }
  img.data.set(out); x.putImageData(img, 0, 0);
  return cv;
}

// 繪圖工具：在一張畫布上畫，之後整層處理陰影
function painter(w, h) {
  const cv = mk(w, h), g = cv.getContext('2d');
  const P = {
    cv, g,
    rect(x, y, ww, hh, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); return P; },
    ell(cx, cy, rx, ry, c, rot = 0) { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, TAU); g.fill(); return P; },
    poly(pts, c) { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); return P; },
    line(x1, y1, x2, y2, wd, c, cap = 'round') { g.strokeStyle = c; g.lineWidth = wd; g.lineCap = cap; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); return P; },
    path(pts, wd, c) { g.strokeStyle = c; g.lineWidth = wd; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); return P; },
    px(x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); return P; },
  };
  return P;
}
// 合成：每個圖層各自上陰影後疊加
function compose(w, h, layers, glow) {
  const out = mk(w, h), o = out.getContext('2d');
  for (const [fn, k = 3] of layers) { const P = painter(w, h); fn(P); shade(P.cv, k); o.drawImage(P.cv, 0, 0); }
  outline(out);
  if (glow) { const P = painter(w, h); P.g.shadowBlur = 4; glow(P); P.g.shadowBlur = 0; o.drawImage(P.cv, 0, 0); }
  return out;
}
const glowDot = (P, x, y, c, r = 1) => { P.g.shadowColor = c; P.rect(x, y, r, r, c); };

// ==================== 玩家角色 ====================
// 皆以面朝右繪製；腳底位於 y=58、身體中心 x=32
function bladeFrame(pal, ph, run) {
  const bob = run ? -Math.abs(Math.sin(ph * TAU)) * 1.6 : Math.sin(ph * TAU) * 0.7, sw = run ? Math.sin(ph * TAU) : 0;
  const by = 0 + bob;
  return compose(64, 64, [
    [P => { // 長圍巾（在身後飄動）
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([31 - t * 24, 25 + by + t * 8 + Math.sin(ph * TAU * 2 - t * 5) * (2 + t * 4) - (run ? t * 6 : 0)]); }
      P.path(pts, 4, pal.cloak); P.path(pts.slice(6), 3, mix(pal.cloak, pal.glow, 0.5));
    }, 2],
    [P => { // 後腳
      P.line(30, 42 + by, 30 - sw * 6, 55, 4.5, mix(pal.c1, '#000000', 0.25)); P.rect(27 - sw * 6, 54, 6, 4, pal.metal);
    }, 2],
    [P => { // 後手
      P.line(27, 28 + by, 24 + sw * 3, 37 + by, 3.5, pal.c2); P.ell(24 + sw * 3, 38 + by, 2, 2, pal.skin);
    }, 1],
    [P => { // 身體
      P.poly([[25, 26 + by], [39, 26 + by], [37, 42 + by], [27, 42 + by]], pal.c1);
      P.poly([[27, 27 + by], [30, 27 + by], [37, 40 + by], [34, 41 + by]], pal.c2);
      P.rect(27, 39 + by, 10, 3, pal.metal);
    }, 3],
    [P => { // 前腳
      P.line(34, 42 + by, 34 + sw * 6, 55, 4.5, pal.c1); P.rect(31 + sw * 6, 54, 7, 4, pal.metal);
    }, 2],
    [P => { // 頭
      P.ell(33, 19 + by, 6, 6.5, pal.skin);
      if (pal.mask) { P.ell(34, 19 + by, 6, 6, '#ece4d0'); P.rect(32, 22 + by, 6, 1, '#a8a090'); }
      P.poly([[26, 18 + by], [28, 11 + by], [33, 12 + by], [37, 10 + by], [40, 15 + by], [39, 19 + by], [35, 15 + by], [30, 17 + by]], pal.c1);
      P.rect(27, 23 + by, 12, 4, pal.cloak);
    }, 2],
    [P => { // 前手
      P.line(38, 28 + by, 42 - sw * 2, 36 + by, 3.5, pal.c2); P.ell(42 - sw * 2, 37 + by, 2, 2, pal.skin);
    }, 1],
  ], P => { glowDot(P, 36, 18 + by, pal.glow, 2); glowDot(P, 4 + (run ? 1 : 0), 33 + by, pal.glow, 2); });
}
function starFrame(pal, ph, run) {
  const hov = -3 + Math.sin(ph * TAU) * 1.2, by = hov, wv = ph * TAU;
  return compose(64, 64, [
    [P => { // 法袍
      const hem = []; for (let i = 0; i <= 8; i++) hem.push([20 + i * 3, 54 + by + Math.sin(wv * (run ? 2 : 1) + i) * 1.5]);
      P.poly([[26, 26 + by], [38, 26 + by], [44, 52 + by], ...hem.reverse(), [20, 52 + by]], pal.c1);
      P.poly([[30, 30 + by], [34, 30 + by], [36, 53 + by], [28, 53 + by]], pal.c2);
      for (const [sx, sy] of [[23, 44], [41, 40], [26, 36], [38, 48], [31, 49]]) P.rect(sx, sy + by, 1, 1, pal.metal);
    }, 3],
    [P => { // 後袖
      P.poly([[26, 28 + by], [21, 38 + by], [24, 40 + by], [29, 31 + by]], pal.c2);
    }, 2],
    [P => { // 兜帽
      P.ell(32, 19 + by, 8.5, 8.5, pal.cloak);
      P.poly([[24, 18 + by], [20, 30 + by], [27, 24 + by]], pal.cloak);
      P.ell(35, 22 + by, 5.5, 4.5, '#05040a');
      P.rect(24, 25 + by, 16, 3, pal.cloak);
    }, 3],
    [P => { // 前袖托著法球
      P.poly([[36, 28 + by], [46, 33 + by], [45, 37 + by], [35, 33 + by]], pal.c2); P.ell(46, 35 + by, 2, 2, pal.skin);
    }, 2],
  ], P => { glowDot(P, 34, 21 + by, pal.glow, 2); glowDot(P, 38, 21 + by, pal.glow, 2); });
}
function aegisFrame(pal, ph, run, skin) {
  const bob = run ? -Math.abs(Math.sin(ph * TAU)) * 1.2 : Math.sin(ph * TAU) * 0.5, sw = run ? Math.sin(ph * TAU) * 0.7 : 0, by = bob;
  return compose(64, 64, [
    [P => { // 披風
      P.poly([[22, 27 + by], [38, 27 + by], [36 - sw * 2, 50], [18 - sw * 3, 52]], pal.cloak);
    }, 3],
    [P => { // 腳（粗壯）
      P.line(27, 43 + by, 27 - sw * 5, 54, 7, pal.c2); P.rect(22 - sw * 5, 52, 10, 6, pal.metal);
      P.line(37, 43 + by, 37 + sw * 5, 54, 7, pal.c1); P.rect(33 + sw * 5, 52, 10, 6, pal.metal);
    }, 2],
    [P => { // 胸甲（寬 20%）
      P.poly([[19, 26 + by], [45, 26 + by], [42, 44 + by], [22, 44 + by]], pal.metal);
      P.rect(22, 40 + by, 20, 4, pal.c2);
      P.poly([[26, 29 + by], [38, 29 + by], [36, 38 + by], [28, 38 + by]], pal.c1);
    }, 3],
    [P => { // 巨大肩甲
      P.ell(20, 28 + by, 7, 5.5, pal.c1); P.ell(44, 28 + by, 7, 5.5, pal.c1);
      P.rect(14, 28 + by, 13, 2, pal.metal); P.rect(38, 28 + by, 13, 2, pal.metal);
    }, 2],
    [P => { // 頭盔與羽飾
      P.ell(32, 18 + by, 7, 7.5, pal.metal);
      P.rect(31, 17 + by, 9, 2, '#05040a'); P.rect(33, 17 + by, 2, 7, '#05040a');
      if (skin === 'tide') P.poly([[26, 13 + by], [32, 4 + by], [38, 13 + by]], pal.cloak);
      else P.poly([[24, 14 + by], [27, 7 + by], [36, 6 + by], [41, 10 + by], [38, 13 + by], [30, 11 + by]], pal.cloak);
    }, 2],
    [P => { // 塔盾（左手，在身前）
      P.poly([[37, 27 + by], [49, 27 + by], [49, 47 + by], [43, 53 + by], [37, 47 + by]], pal.c1);
      P.poly([[39, 29 + by], [47, 29 + by], [47, 46 + by], [43, 50 + by], [39, 46 + by]], pal.metal);
    }, 3],
  ], P => {
    const cx = 43, cy = 38 + by;
    P.g.shadowColor = pal.glow;
    if (skin === 'templar') { P.rect(cx - 1, cy - 5, 2, 10, pal.glow); P.rect(cx - 4, cy - 2, 8, 2, pal.glow); }
    else if (skin === 'tide') { P.ell(cx, cy, 3, 3, pal.glow); P.rect(cx - 1, cy - 6, 2, 4, pal.glow); }
    else { P.ell(cx, cy, 3, 3, pal.glow); for (let i = 0; i < 8; i++) P.px(cx + Math.cos(i * 0.785) * 5, cy + Math.sin(i * 0.785) * 5, pal.glow); }
    if (skin === 'magma') { for (const [x1, y1, x2, y2] of [[24, 30, 28, 36], [40, 31, 36, 38], [30, 42, 33, 45]]) P.line(x1, y1 + by, x2, y2 + by, 1, pal.glow); }
    glowDot(P, 36, 17 + by, pal.glow, 2);
  });
}
function hunterFrame(pal, ph, run) {
  const bob = run ? -Math.abs(Math.sin(ph * TAU)) * 1.5 : Math.sin(ph * TAU) * 0.6, sw = run ? Math.sin(ph * TAU) : 0, by = bob;
  return compose(64, 64, [
    [P => { // 單邊斗篷
      const tip = 14 - (run ? 5 : 0) + Math.sin(ph * TAU * 2) * 2;
      P.poly([[26, 25 + by], [33, 26 + by], [27, 46 + by], [tip, 49 + by + Math.sin(ph * TAU) * 2]], pal.cloak);
    }, 3],
    [P => { // 箭筒
      P.rect(23, 20 + by, 5, 16, pal.c2, 0); for (let i = 0; i < 3; i++) P.rect(23 + i * 2, 17 + by - i, 1, 4, pal.metal);
    }, 2],
    [P => { P.line(30, 42 + by, 30 - sw * 6, 55, 4, mix(pal.c2, '#000000', 0.2)); P.rect(27 - sw * 6, 54, 6, 4, pal.c2); }, 2],
    [P => { P.poly([[26, 26 + by], [38, 26 + by], [37, 42 + by], [27, 42 + by]], pal.c1); P.rect(27, 37 + by, 10, 3, pal.c2); P.line(27, 27 + by, 37, 37 + by, 2, pal.c2); }, 3],
    [P => { P.line(34, 42 + by, 34 + sw * 6, 55, 4, pal.c1); P.rect(31 + sw * 6, 54, 7, 4, pal.c2); }, 2],
    [P => {
      P.ell(33, 19 + by, 6, 6.5, pal.skin);
      P.poly([[26, 20 + by], [27, 12 + by], [34, 10 + by], [40, 14 + by], [40, 18 + by], [33, 15 + by], [29, 20 + by]], pal.cloak);
      if (pal.mask) P.poly([[30, 21 + by], [40, 20 + by], [39, 26 + by], [31, 26 + by]], pal.c1);
    }, 2],
    [P => { P.line(38, 28 + by, 43, 33 + by, 3.5, pal.c1); P.ell(44, 34 + by, 2, 2, pal.skin); }, 1],
  ], P => glowDot(P, 36, 18 + by, pal.glow, 1));
}
const DRAW = { blade: bladeFrame, star: starFrame, aegis: aegisFrame, hunter: hunterFrame };

// 武器（指向右方，樞紐在左側）
function weaponArt(cls, pal) {
  const P = painter(32, 24), cy = 12;
  if (cls === 'blade') { P.rect(2, cy - 1, 5, 3, pal.c2); P.rect(7, cy - 3, 2, 7, pal.metal); P.poly([[9, cy - 2], [22, cy], [9, cy + 2]], pal.metal); }
  if (cls === 'aegis') { P.rect(2, cy - 1, 17, 3, pal.c2); P.rect(17, cy - 6, 9, 12, pal.metal); P.rect(16, cy - 7, 11, 2, pal.c1); P.rect(16, cy + 5, 11, 2, pal.c1); }
  if (cls === 'hunter') { P.g.strokeStyle = pal.metal; P.g.lineWidth = 2.5; P.g.beginPath(); P.g.arc(4, cy, 10, -1.3, 1.3); P.g.stroke(); }
  if (cls === 'star') { P.ell(16, cy, 5, 5, pal.metal); P.ell(16, cy, 3.5, 3.5, mix(pal.glow, '#ffffff', 0.3)); }
  shade(P.cv, 2); outline(P.cv);
  const g = P.g; g.shadowBlur = 4; g.shadowColor = pal.glow; g.fillStyle = pal.glow;
  if (cls === 'blade') g.fillRect(10, cy - 2, 11, 1);
  if (cls === 'aegis') g.fillRect(20, cy - 2, 3, 4);
  if (cls === 'hunter') { g.fillRect(6, cy - 9, 1, 18); }
  if (cls === 'star') { g.beginPath(); g.arc(16, cy, 2, 0, TAU); g.fill(); }
  return P.cv;
}

const cache = new Map();
// ---------- 參考圖切出的精靈圖（public/assets/sprites，由 tools/extract_sprites.py 產生） ----------
const IMG = new Map();
// 參考圖中面朝左的造型（遊戲內預設面朝右）
const FACES_LEFT = new Set(['blade_styx']);
export function loadSprites() {
  return fetch('assets/sprites/index.json').then(r => r.json()).then(meta => Promise.all(Object.keys(meta).map(name => new Promise(ok => {
    const im = new Image();
    im.onload = () => { IMG.set(name, im); ok(); };
    im.onerror = ok;
    im.src = `assets/sprites/${name}.png`;
  })))).then(() => cache.clear()).catch(() => {});
}
function flipped(im) { const c = mk(im.width, im.height), x = c.getContext('2d'); x.translate(im.width, 0); x.scale(-1, 1); x.drawImage(im, 0, 0); return c; }
function tintC(src, col) { const t = mk(src.width, src.height), x = t.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, t.width, t.height); return t; }
function imageHero(name, pal, skinId) {
  let im = IMG.get(name);
  if (FACES_LEFT.has(name)) im = flipped(im);
  const frames = [im, im, im, im, im, im];
  // ox/oy：以腳底中心為原點時的繪製位置
  return { img: true, w: im.width, h: im.height, ox: -im.width / 2, oy: -im.height + 3, idle: frames.slice(0, 4), run: frames,
    white: tintC(im, '#ffffff'), ghost: tintC(im, 'rgba(120,200,255,0.75)'), weapon: null, pal, fx: SKIN_FX[skinId] };
}
export function heroArt(cls, skinId) {
  const key = cls + ':' + skinId;
  if (cache.has(key)) return cache.get(key);
  const sk0 = (SKINS[cls] || []).find(s => s.id === skinId) || SKINS[cls][0];
  if (IMG.has(cls + '_' + sk0.id)) { const a = imageHero(cls + '_' + sk0.id, sk0.pal, sk0.id); cache.set(key, a); return a; }
  const sk = sk0;
  const pal = sk.pal, draw = DRAW[cls];
  const idle = [0, 0.25, 0.5, 0.75].map(ph => draw(pal, ph, false, sk.id));
  const run = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6].map(ph => draw(pal, ph, true, sk.id));
  const tint = (c, col) => { const t = mk(64, 64), x = t.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, 64, 64); return t; };
  const a = { idle, run, white: tint(idle[0], '#ffffff'), ghost: tint(idle[0], 'rgba(120,200,255,0.75)'), weapon: weaponArt(cls, pal), pal, fx: SKIN_FX[sk.id], w: 64, h: 64, ox: -32, oy: -56 };
  cache.set(key, a);
  return a;
}
// 造型專屬粒子
export const SKIN_FX = {
  styx: { c: '#ff3a3a', k: 'ember' }, thunder: { c: '#6ae8ff', k: 'spark' }, sun: { c: '#ffd860', k: 'ember' }, bone: { c: '#5aff9a', k: 'wisp' },
  olympus: { c: '#ffe07a', k: 'star' }, bloodmoon: { c: '#ff3a5a', k: 'bat' }, frost: { c: '#bff4ff', k: 'frost' }, necro: { c: '#5aff5a', k: 'wisp' },
  sparta: { c: '#ffc04a', k: 'ember' }, magma: { c: '#ff6a1a', k: 'ember' }, templar: { c: '#9ae0ff', k: 'star' }, tide: { c: '#7affea', k: 'bubble' },
  moon: { c: '#d8f0ff', k: 'star' }, phoenix: { c: '#ff8a1a', k: 'ember' }, cyber: { c: '#ff3ae0', k: 'spark' }, dune: { c: '#e8c890', k: 'sand' },
};

// ==================== 頭目（96x96，腳底 y=90） ====================
const B = {
  golem: (P, f, L) => {
    const s = f ? 1 : 0;
    L(P => { P.poly([[30, 60], [42, 60], [40, 90], [26, 90]], '#5a5c68'); P.poly([[54, 60], [66, 60], [70, 90], [56, 90]], '#6a6c78'); }, 3);
    L(P => { P.poly([[22, 28 - s], [74, 26 - s], [80, 58], [62, 70], [32, 70], [16, 56]], '#8b8d99'); P.poly([[30, 40], [50, 36], [46, 56], [30, 58]], '#9a9caa'); P.ell(70, 30, 6, 4, '#4a7a3a'); }, 4);
    L(P => { P.poly([[8, 34], [22, 30], [26, 64], [10, 70], [4, 54]], '#7a7c88'); P.poly([[74, 30], [88, 34], [92, 56], [84, 70], [70, 62]], '#7a7c88'); }, 3);
    L(P => { P.poly([[38, 12 - s], [58, 12 - s], [62, 28], [34, 28]], '#9a9caa'); }, 3);
  }, golemGlow: (P, f) => { P.g.shadowColor = '#5ff2ff'; P.rect(41, 19 - f, 4, 3, '#5ff2ff'); P.rect(51, 19 - f, 4, 3, '#5ff2ff'); P.line(36, 38, 48, 50, 1.5, '#5ff2ff'); P.line(60, 34, 66, 52, 1.5, '#5ff2ff'); P.ell(48, 46, 4, 4, '#5ff2ff'); },
  general: (P, f, L) => {
    L(P => { P.poly([[26, 30], [70, 30], [80, 86 - f], [16, 86 + f]], '#7a121c'); }, 4);
    L(P => { P.line(40, 60, 36, 88, 5, '#e9e6dc'); P.line(56, 60, 60, 88, 5, '#e9e6dc'); P.rect(32, 84, 10, 5, '#3a3440'); P.rect(55, 84, 10, 5, '#3a3440'); }, 2);
    L(P => { P.poly([[28, 30], [68, 30], [64, 62], [32, 62]], '#4a4a5a'); P.rect(32, 54, 32, 6, '#c8a040'); P.poly([[40, 34], [56, 34], [52, 50], [44, 50]], '#5a5a6e'); }, 4);
    L(P => { P.ell(22, 34, 9, 7, '#5a5a6e'); P.ell(74, 34, 9, 7, '#5a5a6e'); P.line(20, 38, 18, 58, 5, '#e9e6dc'); P.line(76, 38, 82, 56, 5, '#e9e6dc'); }, 3);
    L(P => { P.line(84, 10, 82, 66, 4, '#c8ccd8'); P.rect(76, 54, 14, 3, '#c8a040'); }, 2);
    L(P => { P.ell(48, 20 - f, 11, 11, '#e9e6dc'); P.rect(40, 26 - f, 16, 5, '#e9e6dc'); P.poly([[36, 16], [26, 2], [40, 12]], '#3a3440'); P.poly([[60, 16], [70, 2], [56, 12]], '#3a3440'); P.poly([[37, 14], [59, 14], [56, 8], [40, 8]], '#c8a040'); P.ell(43, 21 - f, 3, 3, '#05040a'); P.ell(53, 21 - f, 3, 3, '#05040a'); }, 3);
  }, generalGlow: (P, f) => { P.g.shadowColor = '#ff3a3a'; P.rect(42, 20 - f, 2, 2, '#ff4a3a'); P.rect(52, 20 - f, 2, 2, '#ff4a3a'); P.line(83, 12, 82, 52, 1, '#ffb0a0'); },
  gargoyle: (P, f, L, pal) => {
    const g = pal || { a: '#7a7a8a', d: '#4a4a58' };
    L(P => { P.poly([[40, 34], [4, 8 + f * 3], [10, 30], [2, 40], [16, 44], [8, 56], [36, 52]], g.d); P.poly([[56, 34], [92, 8 + f * 3], [86, 30], [94, 40], [80, 44], [88, 56], [60, 52]], g.d); }, 3);
    L(P => { P.path([[60, 76], [76, 84], [86, 74], [84, 66]], 4, g.a); }, 2);
    L(P => { P.ell(48, 60, 16, 18, g.a); P.ell(38, 82, 6, 8, g.a); P.ell(58, 82, 6, 8, g.a); P.rect(32, 86, 12, 4, g.d); P.rect(52, 86, 12, 4, g.d); }, 4);
    L(P => { P.ell(48, 34 - f, 11, 10, g.a); P.poly([[40, 28], [30, 12], [42, 24]], '#d8d0c0'); P.poly([[56, 28], [66, 12], [54, 24]], '#d8d0c0'); P.rect(42, 40 - f, 12, 3, '#05040a'); P.rect(43, 40 - f, 2, 2, '#f0f0f0'); P.rect(51, 40 - f, 2, 2, '#f0f0f0'); }, 3);
    L(P => { P.line(34, 52, 26, 68, 5, g.a); P.line(62, 52, 70, 68, 5, g.a); }, 2);
  }, gargoyleGlow: (P, f, pal) => { const c = (pal && pal.eye) || '#ff3a3a'; P.g.shadowColor = c; P.rect(42, 33 - f, 3, 2, c); P.rect(51, 33 - f, 3, 2, c); P.ell(48, 58, 3, 3, c); },
  queen: (P, f, L) => {
    L(P => { for (let i = 0; i < 4; i++) { const y = 46 + i * 7, sp = f * 2; P.path([[40, y], [22 - i * 2, y - 14 + sp], [6 + i * 3, y + 16]], 3.5, '#2a1f34'); P.path([[56, y], [74 + i * 2, y - 14 + sp], [90 - i * 3, y + 16]], 3.5, '#2a1f34'); } }, 2);
    L(P => { P.ell(48, 66, 22, 18, '#3a2a4a'); P.ell(48, 62, 16, 11, '#4a3a5a'); }, 4);
    L(P => { P.ell(48, 40 - f, 13, 11, '#3a2a4a'); P.rect(42, 50 - f, 3, 6, '#2a1f34'); P.rect(51, 50 - f, 3, 6, '#2a1f34'); }, 3);
    L(P => { P.poly([[36, 30 - f], [38, 20 - f], [43, 27 - f], [48, 18 - f], [53, 27 - f], [58, 20 - f], [60, 30 - f]], '#ffd34d'); }, 2);
  }, queenGlow: (P, f) => { P.g.shadowColor = '#9be04a'; for (const [x, y] of [[44, 58], [52, 58], [48, 66], [40, 70], [56, 70], [48, 76]]) P.ell(x, y, 2, 1.5, '#b0ff5a'); P.g.shadowColor = '#ff4040'; for (const [x, y] of [[43, 38], [53, 38], [46, 42], [50, 42]]) P.rect(x, y - f, 2, 2, '#ff3a3a'); },
  flowerKing: (P, f, L) => {
    L(P => { P.poly([[42, 56], [54, 56], [58, 90], [38, 90]], '#2a6a2a'); P.ell(26, 76, 14, 5, '#3a8a2a', -0.4); P.ell(70, 74, 14, 5, '#3a8a2a', 0.4); }, 3);
    L(P => { for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + f * 0.08; P.ell(48 + Math.cos(a) * 20, 38 + Math.sin(a) * 18, 12, 8, i % 2 ? '#c82a6a' : '#e04a8a', a); } }, 4);
    L(P => { P.ell(48, 38, 14, 13, '#6a1038'); P.ell(48, 42 + f, 10, 6, '#200810'); for (let i = 0; i < 6; i++) { P.poly([[40 + i * 3, 36 + f], [41.5 + i * 3, 40 + f], [43 + i * 3, 36 + f]], '#f4f1ea'); P.poly([[40 + i * 3, 48 + f], [41.5 + i * 3, 44 + f], [43 + i * 3, 48 + f]], '#f4f1ea'); } }, 3);
  }, flowerKingGlow: (P, f) => { P.g.shadowColor = '#ffd34d'; for (let i = 0; i < 6; i++) P.rect(20 + i * 11, 14 + ((i * 7 + f * 3) % 9), 2, 2, '#ffe14a'); P.ell(48, 31, 3, 2, '#ffd34d'); },
  shroomKing: (P, f, L) => {
    L(P => { P.poly([[34, 50], [62, 50], [66, 88], [30, 88]], '#e8d6b0'); P.ell(30, 66, 6, 4, '#e8d6b0'); P.ell(66, 66, 6, 4, '#e8d6b0'); }, 4);
    L(P => { P.ell(48, 40 - f, 36, 22, '#9a3ad8'); P.rect(12, 40 - f, 72, 10, '#7a2ab0'); for (const [x, y, r] of [[30, 30, 5], [50, 24, 6], [68, 34, 4], [40, 44, 3], [62, 46, 3]]) P.ell(x, y - f, r, r * 0.8, '#f4f1ea'); }, 4);
    L(P => { P.poly([[34, 18 - f], [37, 6 - f], [42, 14 - f], [48, 4 - f], [54, 14 - f], [59, 6 - f], [62, 18 - f]], '#ffd34d'); P.rect(40, 62, 4, 4, '#2a1a10'); P.rect(52, 62, 4, 4, '#2a1a10'); P.rect(44, 72, 8, 2, '#6a3a20'); }, 2);
  }, shroomKingGlow: (P, f) => { P.g.shadowColor = '#d08aff'; for (let i = 0; i < 8; i++) P.rect(10 + i * 10, 70 - ((i * 13 + f * 5) % 30), 2, 2, '#e0b0ff'); P.ell(48, 9 - f, 2, 2, '#ff4af0'); },
  dragon: (P, f, L) => {
    L(P => { P.poly([[38, 36], [2, 6 + f * 4], [8, 28], [0, 40], [14, 42], [6, 56], [34, 50]], '#7a2a4a'); P.poly([[58, 36], [94, 6 + f * 4], [88, 28], [96, 40], [82, 42], [90, 56], [62, 50]], '#7a2a4a'); }, 3);
    L(P => { P.path([[56, 80], [76, 88], [90, 78], [88, 68]], 6, '#a8301a'); }, 3);
    L(P => { P.ell(48, 62, 18, 22, '#d8452a'); P.ell(48, 66, 10, 16, '#ffc04a'); for (let i = 0; i < 5; i++) P.rect(40, 54 + i * 6, 16, 1, '#d89030'); P.ell(38, 84, 7, 7, '#a8301a'); P.ell(58, 84, 7, 7, '#a8301a'); }, 4);
    L(P => { P.line(48, 44, 48, 26 - f, 9, '#d8452a'); P.ell(48, 22 - f, 11, 9, '#d8452a'); P.rect(46, 26 - f, 12, 5, '#c8361a'); P.poly([[40, 16 - f], [32, 4 - f], [44, 12 - f]], '#f0e0c0'); P.poly([[56, 16 - f], [64, 4 - f], [52, 12 - f]], '#f0e0c0'); }, 3);
  }, dragonGlow: (P, f) => { P.g.shadowColor = '#ffe14a'; P.rect(42, 20 - f, 3, 2, '#ffe14a'); P.rect(52, 20 - f, 3, 2, '#ffe14a'); P.ell(48, 36 - f, 3, 4, '#ff8a2a'); },
  demon: (P, f, L) => {
    L(P => { P.line(40, 64, 34, 88, 9, '#7a1408'); P.line(56, 64, 62, 88, 9, '#7a1408'); P.rect(26, 84, 14, 6, '#2a0a06'); P.rect(56, 84, 14, 6, '#2a0a06'); }, 3);
    L(P => { P.poly([[22, 30 - f], [74, 30 - f], [64, 66], [32, 66]], '#c8301a'); P.poly([[34, 40], [62, 40], [58, 58], [38, 58]], '#a8240f'); P.rect(32, 60, 32, 6, '#3a1a10'); }, 4);
    L(P => { P.ell(20, 36 - f, 9, 8, '#c8301a'); P.ell(76, 36 - f, 9, 8, '#c8301a'); P.line(16, 40, 12, 62, 7, '#c8301a'); P.line(80, 40, 86, 60, 7, '#c8301a'); }, 3);
    L(P => { P.ell(48, 22 - f, 11, 10, '#c8301a'); P.poly([[38, 16 - f], [22, 0], [30, 14 - f], [26, 2]], '#2a1a14'); P.poly([[58, 16 - f], [74, 0], [66, 14 - f], [70, 2]], '#2a1a14'); P.rect(42, 27 - f, 12, 3, '#05040a'); }, 3);
  }, demonGlow: (P, f) => { P.g.shadowColor = '#ffb020'; P.rect(42, 20 - f, 3, 2, '#ffe14a'); P.rect(51, 20 - f, 3, 2, '#ffe14a'); P.path([[86, 62], [92, 74], [84, 84], [92, 92]], 2, '#ff8a2a'); for (let i = 0; i < 5; i++) P.rect(34 + i * 7, 8 - ((i * 5 + f * 3) % 8) - f, 2, 3, '#ff6a1a'); },
  core: (P, f, L) => {
    L(P => { P.line(36, 70, 24, 90, 5, '#3a3038'); P.line(60, 70, 72, 90, 5, '#3a3038'); P.line(48, 72, 48, 90, 5, '#4a4048'); }, 2);
    L(P => { P.ell(48, 46, 30, 30, '#4a4040'); P.ell(48, 46, 24, 24, '#2a2020'); }, 4);
    L(P => { for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + f * 0.2; P.rect(48 + Math.cos(a) * 27 - 3, 46 + Math.sin(a) * 27 - 3, 6, 6, '#6a5a50'); } }, 2);
  }, coreGlow: (P, f) => { P.g.shadowColor = '#ff8a2a'; P.ell(48, 46, 14 + f, 14 + f, '#ff6a1a'); P.ell(48, 46, 8, 8, '#ffd070'); P.ell(48, 46, 3, 3, '#ffffff'); P.g.shadowColor = '#ffb04a'; P.line(20, 46, 30, 46, 2, '#ffb04a'); P.line(66, 46, 76, 46, 2, '#ffb04a'); },
  lich: (P, f, L) => {
    L(P => { const hem = []; for (let i = 0; i <= 8; i++) hem.push([24 + i * 6, 86 - f + (i % 2) * 4]); P.poly([[34, 34], [62, 34], [72, 84], ...hem.reverse(), [24, 84]], '#2a4a6a'); P.poly([[42, 36], [54, 36], [56, 84], [40, 84]], '#1a3a5a'); }, 4);
    L(P => { P.line(76, 8, 72, 88, 3, '#5a4a3a'); }, 2);
    L(P => { P.line(36, 40, 26, 58, 5, '#2a4a6a'); P.line(60, 40, 72, 50, 5, '#2a4a6a'); P.ell(72, 50, 3, 3, '#e9e6dc'); }, 2);
    L(P => { P.ell(48, 24 - f, 10, 11, '#e9e6dc'); P.ell(44, 24 - f, 3, 3, '#05040a'); P.ell(53, 24 - f, 3, 3, '#05040a'); P.rect(43, 31 - f, 10, 2, '#a8a090'); P.poly([[36, 14 - f], [40, 2 - f], [44, 12 - f], [48, 0 - f], [52, 12 - f], [56, 2 - f], [60, 14 - f]], '#8fd8ff'); }, 3);
  }, lichGlow: (P, f) => { P.g.shadowColor = '#5ff2ff'; P.rect(43, 23 - f, 2, 2, '#5ff2ff'); P.rect(52, 23 - f, 2, 2, '#5ff2ff'); P.poly([[76, 2], [80, 10], [76, 16], [72, 10]], '#9af4ff'); },
  icequeen: (P, f, L) => {
    L(P => { P.path([[38, 14], [30, 40], [28, 70]], 6, '#f0f8ff'); P.path([[58, 14], [66, 40], [68, 70]], 6, '#f0f8ff'); }, 2);
    L(P => { P.poly([[38, 36], [58, 36], [80, 88], [16, 88]], '#8fd8ff'); P.poly([[44, 38], [52, 38], [62, 88], [34, 88]], '#bfeaff'); P.rect(38, 46, 20, 3, '#e8f8ff'); }, 4);
    L(P => { P.line(38, 40, 28, 56, 4, '#8fd8ff'); P.line(58, 40, 68, 54, 4, '#8fd8ff'); }, 2);
    L(P => { P.ell(48, 24 - f, 9, 10, '#d8e8f8'); P.rect(42, 24 - f, 3, 2, '#2a3a5a'); P.rect(51, 24 - f, 3, 2, '#2a3a5a'); P.poly([[38, 16 - f], [40, 2 - f], [44, 12 - f], [48, -2 - f], [52, 12 - f], [56, 2 - f], [58, 16 - f]], '#e8f8ff'); }, 3);
  }, icequeenGlow: (P, f) => { P.g.shadowColor = '#7ae8ff'; P.ell(48, 6 - f, 2, 3, '#7ae8ff'); for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + f * 0.3; P.poly([[48 + Math.cos(a) * 34, 50 + Math.sin(a) * 26 - 3], [48 + Math.cos(a) * 34 + 2, 50 + Math.sin(a) * 26], [48 + Math.cos(a) * 34, 50 + Math.sin(a) * 26 + 4], [48 + Math.cos(a) * 34 - 2, 50 + Math.sin(a) * 26]], '#bff4ff'); } },
  deathknight: (P, f, L) => {
    L(P => { P.poly([[30, 30], [66, 30], [76, 86 - f], [20, 88 + f]], '#1a2430'); }, 4);
    L(P => { P.line(40, 62, 38, 88, 8, '#3a4a5a'); P.line(56, 62, 58, 88, 8, '#3a4a5a'); P.rect(30, 84, 14, 6, '#5a6a7a'); P.rect(52, 84, 14, 6, '#5a6a7a'); }, 3);
    L(P => { P.poly([[28, 30], [68, 30], [64, 64], [32, 64]], '#5a6a7a'); P.poly([[38, 34], [58, 34], [54, 54], [42, 54]], '#3a4a5a'); }, 4);
    L(P => { P.ell(24, 34, 10, 8, '#6a7a8a'); P.ell(72, 34, 10, 8, '#6a7a8a'); }, 3);
    L(P => { P.line(80, 6, 76, 72, 6, '#a8c0d8'); P.rect(70, 58, 16, 4, '#3a4a5a'); }, 2);
    L(P => { P.ell(48, 20 - f, 10, 11, '#5a6a7a'); P.rect(40, 19 - f, 16, 3, '#05040a'); P.rect(47, 19 - f, 2, 9, '#05040a'); }, 3);
  }, deathknightGlow: (P, f) => { P.g.shadowColor = '#5ff2ff'; P.rect(41, 19 - f, 5, 2, '#5ff2ff'); P.rect(50, 19 - f, 5, 2, '#5ff2ff'); for (let i = 0; i < 4; i++) P.rect(42 + i * 4, 6 - ((i * 3 + f * 4) % 6) - f, 2, 4, '#7af4ff'); P.line(79, 10, 76, 56, 1, '#bff4ff'); },
  voidlord: (P, f, L) => {
    L(P => { for (let i = 0; i < 6; i++) { const x = 24 + i * 10; P.path([[x, 60], [x + Math.sin(f + i) * 6 - 4, 76], [x + 2, 92]], 5, i % 2 ? '#2e1458' : '#4a2a6e'); } }, 2);
    L(P => { P.ell(48, 44, 32, 28, '#4a2a6e'); }, 4);
    L(P => { P.ell(48, 44, 22, 16, '#f0e0ff'); P.poly([[30, 16], [34, 4], [40, 14], [48, 2], [56, 14], [62, 4], [66, 16]], '#ffd34d'); }, 3);
  }, voidlordGlow: (P, f) => { P.g.shadowColor = '#ff4af0'; P.ell(48, 44, 11, 11, '#ff4af0'); P.ell(48, 44, 6, 9, '#1a0a20'); P.rect(44, 38, 2, 3, '#ffffff'); },
  witch: (P, f, L) => {
    L(P => { P.g.strokeStyle = '#ffd34d'; P.g.lineWidth = 3; P.g.beginPath(); P.g.arc(48, 34, 30, 0, TAU); P.g.stroke(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; P.rect(48 + Math.cos(a) * 30 - 1, 34 + Math.sin(a) * 30 - 1, 3, 3, '#c8a040'); } }, 2);
    L(P => { P.poly([[36, 40], [60, 40], [76, 88], [20, 88]], '#3a2a6e'); P.poly([[44, 42], [52, 42], [58, 88], [38, 88]], '#2a1f50'); }, 4);
    L(P => { P.line(66, 16, 62, 88, 3, '#5a4a3a'); P.ell(66, 12, 5, 7, '#c8a040'); }, 2);
    L(P => { P.ell(48, 30 - f, 8, 9, '#f0d8c8'); P.rect(43, 30 - f, 3, 2, '#2a1f50'); P.rect(51, 30 - f, 3, 2, '#2a1f50'); P.rect(26, 22 - f, 44, 4, '#2a1f50'); P.poly([[34, 22 - f], [62, 22 - f], [54, 2 - f], [44, -2 - f]], '#3a2a6e'); }, 3);
  }, witchGlow: (P, f) => { P.g.shadowColor = '#b07cff'; P.ell(48, 12 - f, 4, 4, '#e0d0ff'); P.line(48, 12 - f, 48, 9 - f, 1, '#3a2a6e'); P.line(48, 12 - f, 50, 12 - f, 1, '#3a2a6e'); P.ell(66, 12, 2, 4, '#ffe08a'); },
  heart: (P, f, L) => {
    const s = 1 + f * 0.06;
    L(P => { for (let i = 0; i < 5; i++) P.path([[48, 70], [20 + i * 14, 82 + (i % 2) * 6], [16 + i * 16, 94]], 4, '#4a0a24'); P.path([[38, 20], [30, 6]], 6, '#6a1038'); P.path([[56, 18], [64, 4]], 6, '#6a1038'); }, 2);
    L(P => { P.ell(38, 40, 18 * s, 18 * s, '#8a1a4a'); P.ell(58, 40, 18 * s, 18 * s, '#8a1a4a'); P.poly([[22, 46], [74, 46], [48, 80 * s]], '#8a1a4a'); }, 4);
    L(P => { P.path([[30, 30], [40, 44], [36, 60]], 2, '#4a0a24'); P.path([[66, 32], [56, 46], [62, 62]], 2, '#4a0a24'); }, 0);
  }, heartGlow: (P, f) => { P.g.shadowColor = '#ff4af0'; for (const [x, y] of [[40, 42], [56, 42], [48, 58]]) { P.ell(x, y, 4, 3, '#ff4af0'); P.ell(x, y, 1.5, 2.5, '#1a0a14'); } },
};
const ALIAS = { gargoyle2: 'gargoyle' };
const PALS = { gargoyle: { a: '#7a7a8a', d: '#4a4a58', eye: '#ff3a3a' }, gargoyle2: { a: '#6a7a8a', d: '#3a4a58', eye: '#4ad8ff' } };
export function bossArt(type) {
  const key = 'boss:' + type;
  if (cache.has(key)) return cache.get(key);
  if (IMG.has(type)) {
    const im = IMG.get(type);
    const a = { img: true, frames: [im, im], white: tintC(im, '#ffffff'), ice: tintC(im, 'rgba(120,200,255,0.5)'), stone: tintC(im, 'rgba(60,60,70,0.6)'), red: tintC(im, 'rgba(255,40,40,0.35)'),
      w: im.width, h: im.height, ox: -im.width / 2, oy: -im.height + 8 };
    cache.set(key, a);
    return a;
  }
  const name = ALIAS[type] || type, fn = B[name], glow = B[name + 'Glow'];
  if (!fn) return null;
  const frames = [0, 1].map(f => {
    const layers = [];
    fn(null, f, (draw, k = 3) => layers.push([draw, k]), PALS[type]);
    return compose(96, 96, layers, glow ? P => glow(P, f, PALS[type]) : null);
  });
  const tint = (c, col) => { const t = mk(96, 96), x = t.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, 96, 96); return t; };
  const a = { frames, white: tint(frames[0], '#ffffff'), ice: tint(frames[0], 'rgba(120,200,255,0.5)'), stone: tint(frames[0], 'rgba(60,60,70,0.6)'), red: tint(frames[0], 'rgba(255,40,40,0.35)'), w: 96, h: 96, ox: -48, oy: -88 };
  cache.set(key, a);
  return a;
}
// 一般敵人：把舊精靈圖套上相同的黑影與外框處理後放大 2 倍
export function enhance(src) {
  const c = mk(src.width, src.height); c.getContext('2d').drawImage(src, 0, 0);
  return shade(c, 2, 0.7, 0.25);
}
