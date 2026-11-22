// 世界繪製：地圖、角色、頭目、特效、光影；世界座標的名牌與傷害數字畫在高解析主畫布
import { T } from './sim.js';
import { CLASSES, ENEMIES, BOSSES, DOORS, SHOP } from './data.js';
import { enemySprite, objSprite } from './sprites.js';
import { heroArt, bossArt, SKIN_FX } from './art.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const V = { DPR: 1, SCALE: 3, VW: 480, VH: 270, U: 1, camO: { x: 0, y: 0 }, myId: null, map: null };
let cv, ctx;
const buf = document.createElement('canvas'), b = buf.getContext('2d');
const light = document.createElement('canvas'), lx = light.getContext('2d');
export const fx = { parts: [], nums: [], rings: [], slashes: [], beams: [], zaps: [], lobs: [], afters: [], trails: new Map(), shake: 0 };
const cam = { x: 0, y: 0, init: false };

export function setupRender(canvas) { cv = canvas; ctx = cv.getContext('2d'); resize(); addEventListener('resize', resize); }
export function resize() {
  V.DPR = Math.min(3, window.devicePixelRatio || 1);
  cv.width = Math.floor(innerWidth * V.DPR); cv.height = Math.floor(innerHeight * V.DPR);
  const portrait = cv.height > cv.width;
  V.SCALE = Math.max(2, Math.floor(Math.min(cv.width / (portrait ? 360 : 560), cv.height / (portrait ? 560 : 320))));
  V.VW = Math.ceil(cv.width / V.SCALE); V.VH = Math.ceil(cv.height / V.SCALE);
  buf.width = V.VW; buf.height = V.VH; light.width = V.VW; light.height = V.VH;
  V.U = Math.max(0.85, Math.min(cv.width / 1280, cv.height / 720)) * (portrait ? 1.15 : 1);
}
export const w2s = (x, y) => ({ x: (x - V.camO.x) * V.SCALE, y: (y - V.camO.y) * V.SCALE });
const A = o => (o == null || o === V.myId ? 1 : 0.35);   // 視覺降噪：隊友特效 35%

// ---------- 地圖 ----------
const THEMES = [
  { floor: ['#2e3048', '#2a2c42', '#33354e'], line: '#20223a', speck: '#4a4e6a', top: '#121120', edge: '#2a2846', face: '#3e4060', brick: '#1c1d30', voidc: '#030208', light: 'rgba(3,2,10,0.62)', deco: '#6b7099' },
  { floor: ['#22382c', '#1f3428', '#263d30'], line: '#162a1f', speck: '#3d5c47', top: '#0c1a12', edge: '#1c3426', face: '#2f5040', brick: '#132a1d', voidc: '#020604', light: 'rgba(2,8,4,0.62)', deco: '#6fb04f' },
  { floor: ['#3a2420', '#35211d', '#402824'], line: '#2a1814', speck: '#5c3e35', top: '#1a0a08', edge: '#3a1712', face: '#5a2c20', brick: '#2e140e', voidc: '#0a0302', light: 'rgba(10,3,1,0.55)', deco: '#ff6a2a' },
  { floor: ['#2e3c50', '#2a384c', '#324256'], line: '#202c3e', speck: '#5a7090', top: '#0e1620', edge: '#22324a', face: '#4a6a88', brick: '#22344a', voidc: '#020408', light: 'rgba(2,5,12,0.55)', deco: '#9ad8ff' },
  { floor: ['#221a30', '#1e162b', '#261d35'], line: '#150e20', speck: '#4a3a66', top: '#0a0614', edge: '#221836', face: '#34264e', brick: '#170f26', voidc: '#030106', light: 'rgba(5,1,10,0.62)', deco: '#ff4af0' },
];
const HUB = { floor: ['#16121f', '#141020', '#191424'], line: '#3a2e14', speck: '#2a2238', top: '#0a0810', edge: '#4a3a1a', face: '#2a2238', brick: '#16121f', voidc: '#030206', light: 'rgba(4,2,10,0.5)', deco: '#ffd34d' };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
export function loadMap(m) {
  const tiles = Uint8Array.from(m.tiles, ch => ch.charCodeAt(0) - 48);
  V.map = { v: m.v, ch: m.ch, hub: m.hub, w: m.w, h: m.h, tiles, room: m.room, theme: m.hub ? HUB : THEMES[(m.ch - 1) % THEMES.length] };
  V.map.canvas = drawMapCanvas(V.map);
  cam.init = false;
}
function drawMapCanvas(m) {
  const c = document.createElement('canvas'); c.width = m.w * T; c.height = m.h * T;
  const x = c.getContext('2d'), th = m.theme;
  x.fillStyle = th.voidc; x.fillRect(0, 0, c.width, c.height);
  const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? 0 : m.tiles[ty * m.w + tx]);
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
    const t = at(tx, ty), px = tx * T, py = ty * T, h = hash(tx + m.v * 7, ty);
    if (t === 1) {
      x.fillStyle = th.floor[h % 3]; x.fillRect(px, py, T, T);
      x.fillStyle = th.line; x.fillRect(px, py, T, 1); x.fillRect(px, py, 1, T);
      if (m.hub) { if ((tx + ty) % 4 === 0) { x.fillStyle = '#5a4520'; x.fillRect(px + 7, py + 7, 2, 2); } }
      else {
        x.fillStyle = th.speck;
        for (let k = 0; k < 3; k++) if (((h >> (k * 4)) & 3) === 0) x.fillRect(px + ((h >> (k * 3 + 8)) & 15), py + ((h >> (k * 5 + 3)) & 15), 1, 1);
        if (h % 41 === 0) { x.fillStyle = th.deco; x.fillRect(px + 4, py + 6, 1, 1); x.fillRect(px + 5, py + 7, 2, 1); x.fillRect(px + 7, py + 8, 1, 2); }
        if (h % 67 === 0) { x.fillStyle = '#d8d2c0'; x.fillRect(px + 5, py + 9, 5, 1); x.fillRect(px + 4, py + 8, 1, 3); x.fillRect(px + 10, py + 8, 1, 3); }
      }
      if (at(tx, ty - 1) === 2) { x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(px, py, T, 5); }
    } else if (t === 2) {
      if (at(tx, ty + 1) === 1) {
        x.fillStyle = th.face; x.fillRect(px, py, T, T);
        x.fillStyle = th.edge; x.fillRect(px, py, T, 3);
        x.fillStyle = th.brick;
        x.fillRect(px, py + 3, T, 1); x.fillRect(px, py + 8, T, 1); x.fillRect(px, py + 13, T, 1);
        const o = (tx % 2) * 4;
        x.fillRect(px + o + 2, py + 4, 1, 4); x.fillRect(px + o + 10, py + 4, 1, 4); x.fillRect(px + 6 - o / 2, py + 9, 1, 4); x.fillRect(px + 14 - o / 2, py + 9, 1, 4);
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px + 10, py + 3, 6, 13);
        if (h % 11 === 0) { x.fillStyle = '#5a3a1a'; x.fillRect(px + 7, py + 6, 2, 4); x.fillStyle = m.hub ? '#7affea' : '#ffd07a'; x.fillRect(px + 7, py + 4, 2, 2); }
      } else {
        x.fillStyle = th.top; x.fillRect(px, py, T, T);
        x.fillStyle = th.edge;
        if (at(tx - 1, ty) === 1) x.fillRect(px, py, 2, T);
        if (at(tx + 1, ty) === 1) x.fillRect(px + T - 2, py, 2, T);
        if (at(tx, ty - 1) === 1) x.fillRect(px, py, T, 2);
      }
    }
  }
  return c;
}

// ---------- 事件 ----------
const BOOM = { fire: '255,140,50', poison: '140,230,70', ice: '143,220,255', zap: '255,230,80', steel: '200,210,230', enemy: '255,80,60',
  shadow: '190,60,255', star: '160,140,255', gold: '255,210,80', light: '220,240,255' };
export function burst(x, y, n, c, sp = 60, life = 0.5, o) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, v = Math.random() * sp;
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life * (0.5 + Math.random() * 0.5), c, s: Math.random() < 0.3 ? 2 : 1, o });
  }
}
function addNum(x, y, v, c, big) {
  // 不重疊的浮動數字：與現有數字太接近就往上堆疊
  let ny = y;
  for (let k = 0; k < 8; k++) {
    if (!fx.nums.some(n => Math.abs(n.x - x) < 16 && Math.abs(n.y - ny) < 8)) break;
    ny -= 8;
  }
  fx.nums.push({ x, y: ny, v, c, big, t: 0.8 });
}
export function handleEvents(evs, sfx) {
  const out = [];
  for (const e of evs || []) switch (e.k) {
    case 'hit': {
      const col = e.c === 1 ? '#ffd34d' : e.c === 2 ? '#ff9a4a' : e.c === 3 ? '#9be04a' : e.c === 4 ? '#ffe96a' : '#ffffff';
      addNum(e.x + (Math.random() - 0.5) * 4, e.y, e.v, col, e.c === 1);
      if (!e.c || e.c === 1) { burst(e.x, e.y + 4, 3, '#ffffff', 40, 0.25); sfx('hit'); }
      break;
    }
    case 'phit': addNum(e.x, e.y - 20, e.v, '#ff5a6a'); burst(e.x, e.y - 10, 6, '#ff3d5a', 50, 0.35); if (e.i === V.myId) fx.shake = Math.max(fx.shake, 3); sfx('hurt'); break;
    case 'heal': addNum(e.x, e.y - 24, typeof e.v === 'number' ? '+' + e.v : e.v, '#7dff9a'); burst(e.x, e.y - 10, 8, '#7dff9a', 30, 0.6); break;
    case 'die': burst(e.x, e.y, BOSSES[e.t] ? 70 : 14, BOSSES[e.t] ? '#ff4af0' : '#e8e0f0', BOSSES[e.t] ? 160 : 70, 0.7); sfx('die'); break;
    case 'slash': fx.slashes.push({ ...e, t: 0.16 }); break;
    case 'spark': burst(e.x, e.y, 6, '#ffe14a', 60, 0.3); break;
    case 'nova': fx.rings.push({ x: e.x, y: e.y, max: e.r || 90, t: 0.4, d: 0.4, c: '143,220,255', o: e.o }); break;
    case 'holy': fx.rings.push({ x: e.x, y: e.y, max: 60, t: 0.5, d: 0.5, c: '255,230,140' }); burst(e.x, e.y, 24, '#fff2a0', 90, 0.7); break;
    case 'boom': fx.rings.push({ x: e.x, y: e.y, max: e.r, t: 0.32, d: 0.32, c: BOOM[e.c] || BOOM.fire, o: e.o, fill: 1 }); burst(e.x, e.y, e.s ? 8 : 18, `rgb(${BOOM[e.c] || BOOM.fire})`, e.s ? 50 : 90, 0.45, e.o); sfx(e.s ? 'hit' : 'boom'); break;
    case 'beam': fx.beams.push({ ...e, t: 0.3 }); sfx('blink'); break;
    case 'zap': fx.zaps.push({ pts: e.pts, t: 0.18, o: e.o }); sfx('zap'); break;
    case 'lob': fx.lobs.push({ ...e, d: e.t, t: e.t }); break;
    case 'shake': if (e.o == null || e.o === V.myId) fx.shake = Math.max(fx.shake, e.v); else fx.shake = Math.max(fx.shake, e.v * 0.3); break;
    case 'hitstop': if (e.i === V.myId) fx.shake = Math.max(fx.shake, 1.2); break;
    case 'dash': fx.trails.set(e.i, { t: 0.3, pts: [] }); burst(e.x, e.y, 6, '#9a93a8', 30, 0.35); break;
    case 'after': fx.afters.push({ ...e, t: 0.35 }); break;
    case 'parry': fx.rings.push({ x: e.x, y: e.y - 10, max: 84, t: 0.45, d: 0.45, c: '255,220,100', o: e.i, fill: 1 }); burst(e.x, e.y - 10, 30, '#ffe08a', 120, 0.5); break;
    case 'perfect': fx.rings.push({ x: e.x, y: e.y - 16, max: 26, t: 0.25, d: 0.25, c: '120,255,240', o: e.o }); break;
    case 'trap': fx.rings.push({ x: e.x, y: e.y, max: 30, t: 0.4, d: 0.4, c: '120,255,120', o: e.o }); burst(e.x, e.y, 14, '#9aff7a', 50, 0.5, e.o); break;
    case 'ult': fx.rings.push({ x: e.x, y: e.y - 16, max: 70, t: 0.5, d: 0.5, c: '255,255,255', o: e.i }); sfx('ult'); break;
    case 'skill': sfx('skill'); break;
    case 'snd': sfx(e.s); break;
    case 'dust': burst(e.x, e.y + 3, 6, '#9a93a8', 30, 0.35); break;
    case 'puff': burst(e.x, e.y, 3, '#d8d0ff', 30, 0.25); break;
    case 'chest': burst(e.x, e.y, 24, '#ffd34d', 80, 0.8); break;
    case 'forge': burst(e.x, e.y - 6, 30, '#ffd07a', 90, 0.6); break;
    case 'blink': burst(e.x, e.y - 10, 20, '#a46bff', 80, 0.6); break;
    case 'exec': addNum(e.x, e.y - 14, '處決', '#c08cff', true); break;
    case 'immune': addNum(e.x, e.y, '無效', '#9a9ab0'); break;
    case 'ehealfx': fx.rings.push({ x: e.x, y: e.y, max: 100, t: 0.5, d: 0.5, c: '255,80,200' }); break;
    case 'res': sfx('res'); break;
    case 'stage': case 'hub': cam.init = false; break;
    default: out.push(e);
  }
  for (const e of evs || []) if (['stage', 'hub', 'res'].includes(e.k)) out.push(e);
  return out;
}
export function updateFx(dt) {
  for (const p of fx.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.t -= dt; }
  fx.parts = fx.parts.filter(p => p.t > 0);
  if (fx.parts.length > 1200) fx.parts.splice(0, fx.parts.length - 1200);
  for (const n of fx.nums) { n.y -= 20 * dt; n.t -= dt; }
  fx.nums = fx.nums.filter(n => n.t > 0);
  if (fx.nums.length > 140) fx.nums.splice(0, fx.nums.length - 140);
  for (const k of ['rings', 'slashes', 'beams', 'zaps', 'lobs', 'afters']) { for (const o of fx[k]) o.t -= dt; fx[k] = fx[k].filter(o => o.t > 0); }
  for (const [k, tr] of fx.trails) { tr.t -= dt; if (tr.t <= 0) fx.trails.delete(k); }
  fx.shake = Math.max(0, fx.shake - dt * 18);
}

// ---------- 主繪製 ----------
const pcirc = (x, y, r, c) => { b.fillStyle = c; x = Math.round(x); y = Math.round(y); b.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); b.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2); };
const shadowE = (x, y, rx) => { b.fillStyle = 'rgba(0,0,0,0.5)'; b.beginPath(); b.ellipse(Math.round(x), Math.round(y), rx, rx * 0.38, 0, 0, 7); b.fill(); };
const onScreen = (x, y, m = 40) => x > -m && y > -m && x < V.VW + m && y < V.VH + m;

export function render(s, dt, ip, lead) {
  const map = V.map, th = map.theme, now = performance.now() / 1000;
  let tx = 0, ty = 0;
  const me = s.ps.find(p => p.i === V.myId) || s.ps[0];
  if (me) { const q = ip('p', me); tx = q.x + lead.x; ty = q.y - 16 + lead.y; }
  const R = map.room;
  const cl = (v, lo, hi, half) => (hi - lo < half * 2 ? (lo + hi) / 2 : clamp(v, lo + half, hi - half));
  tx = cl(tx, (R.x - 1) * T, (R.x + R.w + 1) * T, V.VW / 2);
  ty = cl(ty, (R.y - 3) * T, (R.y + R.h + 5) * T, V.VH / 2);
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
  cam.x += (tx - cam.x) * Math.min(1, dt * 9); cam.y += (ty - cam.y) * Math.min(1, dt * 9);
  const ox = Math.round(cam.x - V.VW / 2 + (Math.random() - 0.5) * fx.shake), oy = Math.round(cam.y - V.VH / 2 + (Math.random() - 0.5) * fx.shake);
  V.camO = { x: ox, y: oy };
  b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
  b.fillStyle = th.voidc; b.fillRect(0, 0, V.VW, V.VH);
  b.drawImage(map.canvas, -ox, -oy);

  if (s.dr) s.dr.forEach((d, i) => drawDoor(d, d.x - ox, d.y - oy, now, i, s));
  for (const z of s.zn) drawZone(z, z.x - ox, z.y - oy, now);
  for (const h of s.hz) drawHazard(h, h.x - ox, h.y - oy, now);
  for (const bm of fx.beams) {
    b.save(); b.translate(bm.x - ox, bm.y - oy); b.rotate(bm.a);
    b.fillStyle = `rgba(220,140,255,${bm.t / 0.3})`; b.fillRect(0, -bm.w / 2, bm.l, bm.w);
    b.fillStyle = `rgba(255,255,255,${bm.t / 0.3})`; b.fillRect(0, -bm.w / 6, bm.l, bm.w / 3); b.restore();
  }
  for (const sp of s.sp) {
    const a = 0.4 + 0.4 * Math.sin(now * 14), c = sp.el ? '255,210,80' : '190,110,255';
    b.strokeStyle = `rgba(${c},${a})`; b.lineWidth = 1; b.beginPath(); b.arc(Math.round(sp.x - ox), Math.round(sp.y - oy), 4 + sp.p * 6, 0, 7); b.stroke();
  }
  for (const o of s.ob) drawObj(o, o.x - ox, o.y - oy, now, s);
  for (const pk of s.pk) {
    const x = pk.x - ox, y = pk.y - oy; if (!onScreen(x, y)) continue;
    const bob = Math.round(Math.sin(now * 5 + pk.i) * 1.5);
    const img = objSprite(pk.k === 'coin' ? 'coin' : pk.k === 'hp' ? 'potion' : 'crystal').n;
    b.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2 + bob));
  }
  // 角色、敵人依 y 排序
  const ents = [];
  for (const p of s.ps) { const q = ip('p', p); ents.push({ y: q.y, f: () => drawPlayer(p, q.x - ox, q.y - oy, now, s) }); }
  for (const e of s.es) { const q = ip('e', e); ents.push({ y: q.y, f: () => drawEnemy(e, q.x - ox, q.y - oy, now) }); }
  ents.sort((a, c) => a.y - c.y);
  for (const e of ents) e.f();
  // 殘影
  for (const a of fx.afters) {
    const p = s.ps.find(o => o.i === a.i); if (!p) continue;
    const art = heroArt(p.c, p.sk);
    b.globalAlpha = (a.t / 0.35) * 0.6 * A(a.o);
    b.drawImage(art.ghost, Math.round(a.x1 - ox - 32), Math.round(a.y1 - oy - 56));
    b.globalCompositeOperation = 'lighter'; b.strokeStyle = art.pal.trail; b.lineWidth = 2;
    b.beginPath(); b.moveTo(a.x1 - ox, a.y1 - oy - 20); b.lineTo(a.x2 - ox, a.y2 - oy - 20); b.stroke();
    b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
  }
  // 子彈
  for (const pr of s.pr) { const q = ip('r', pr), x = q.x - ox, y = q.y - oy; if (onScreen(x, y, 10)) { b.globalAlpha = pr.e ? 1 : A(pr.o); drawProj(pr, x, y, s); b.globalAlpha = 1; } }
  for (const l of fx.lobs) {
    const k = 1 - l.t / l.d, x = l.x1 + (l.x2 - l.x1) * k - ox, y = l.y1 + (l.y2 - l.y1) * k - Math.sin(k * Math.PI) * 50 - oy;
    pcirc(x, y, 3, '#3a3a4a'); b.fillStyle = '#ff6a2a'; b.fillRect(Math.round(x), Math.round(y) - 4, 1, 2);
  }
  // 斬擊軌跡（霓虹）
  b.globalCompositeOperation = 'lighter';
  for (const sl of fx.slashes) {
    const p = s.ps.find(o => o.i === sl.i); if (!p) continue;
    const q = ip('p', p), k = sl.t / 0.16, art = heroArt(p.c, p.sk), col = art.pal.trail;
    b.globalAlpha = k * A(sl.i);
    const cx = q.x - ox, cy = q.y - 20 - oy, r = sl.r - 4, dir = sl.n % 2 ? -1 : 1, span = p.c === 'aegis' ? 1.3 : 1.0;
    b.strokeStyle = col; b.lineWidth = p.c === 'aegis' ? 5 : 3;
    b.beginPath(); b.arc(cx, cy, r, sl.a - span * dir, sl.a + span * dir, dir < 0); b.stroke();
    b.strokeStyle = '#ffffff'; b.lineWidth = 1; b.beginPath(); b.arc(cx, cy, r, sl.a - span * 0.6 * dir, sl.a + span * dir, dir < 0); b.stroke();
  }
  for (const r of fx.rings) {
    const k = 1 - r.t / r.d;
    b.globalAlpha = (1 - k) * A(r.o);
    if (r.fill) { b.fillStyle = `rgba(${r.c},0.25)`; b.beginPath(); b.arc(r.x - ox, r.y - oy, Math.max(1, r.max * Math.min(1, k * 1.6)), 0, 7); b.fill(); }
    b.strokeStyle = `rgb(${r.c})`; b.lineWidth = 2; b.beginPath(); b.arc(r.x - ox, r.y - oy, Math.max(1, r.max * k), 0, 7); b.stroke();
  }
  for (const z of fx.zaps) {
    b.globalAlpha = (z.t / 0.18) * A(z.o); b.strokeStyle = '#fff07a'; b.lineWidth = 1; b.beginPath();
    z.pts.forEach(([x, y], i) => {
      if (!i) { b.moveTo(x - ox, y - oy); return; }
      const [px, py] = z.pts[i - 1];
      for (let j = 1; j <= 3; j++) b.lineTo(px + (x - px) * j / 4 - ox + (Math.random() - 0.5) * 6, py + (y - py) * j / 4 - oy + (Math.random() - 0.5) * 6);
      b.lineTo(x - ox, y - oy);
    });
    b.stroke();
  }
  b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
  for (const p of fx.parts) { b.globalAlpha = A(p.o); b.fillStyle = p.c; b.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.s, p.s); }
  b.globalAlpha = 1;

  // 光影（高對比墨影）
  lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, V.VW, V.VH);
  lx.fillStyle = th.light; lx.fillRect(0, 0, V.VW, V.VH);
  lx.globalCompositeOperation = 'destination-out';
  const L = (x, y, r, a) => { const g = lx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = g; lx.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const p of s.ps) if (!p.dd) { const q = ip('p', p); L(q.x - ox, q.y - 16 - oy, p.dn ? 70 : 150, 1); }
  for (const pr of s.pr) if (!pr.e) L(pr.x - ox, pr.y - oy, 20, 0.5);
  if (s.dr) for (const d of s.dr) L(d.x - ox, d.y - 14 - oy, 50, 0.8);
  for (const o of s.ob) if (o.k === 'portal' || o.k === 'classAltar') L(o.x - ox, o.y - oy, o.k === 'portal' ? 90 : 40, 0.8);
  lx.globalCompositeOperation = 'source-over';
  b.drawImage(light, 0, 0);
  if (s.ts) { b.globalCompositeOperation = 'saturation'; b.fillStyle = 'hsl(0,0%,50%)'; b.fillRect(0, 0, V.VW, V.VH); b.globalCompositeOperation = 'source-over'; }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, V.VW * V.SCALE, V.VH * V.SCALE);
  drawWorldText(s, ip, now);
}

function drawDoor(d, x, y, now, i, s) {
  x = Math.round(x); y = Math.round(y);
  const col = DOORS[d.t].color, pulse = 0.5 + 0.5 * Math.sin(now * 4 + i);
  b.fillStyle = 'rgba(0,0,0,0.9)'; b.fillRect(x - 8, y - 26, 16, 20);
  b.fillStyle = col; b.globalAlpha = 0.3 + 0.3 * pulse; b.fillRect(x - 7, y - 24, 14, 18); b.globalAlpha = 1;
  b.fillStyle = col; b.fillRect(x - 10, y - 28, 2, 22); b.fillRect(x + 8, y - 28, 2, 22); b.fillRect(x - 10, y - 30, 20, 3);
  b.globalAlpha = 0.2 + 0.15 * pulse; b.beginPath(); b.ellipse(x, y, 16, 6, 0, 0, 7); b.fill(); b.globalAlpha = 1;
  if (s.ds === i && s.dt > 0) { b.strokeStyle = '#fff'; b.lineWidth = 2; b.beginPath(); b.arc(x, y - 14, 18, -1.57, -1.57 + 6.28 * s.dt); b.stroke(); }
}
function drawZone(z, x, y, now) {
  if (!onScreen(x, y, 120)) return;
  b.globalAlpha = A(z.o);
  switch (z.k) {
    case 'fire': for (let i = 0; i < 3; i++) { const a = now * 9 + i * 2.1 + z.x; b.fillStyle = i % 2 ? '#ff8a2a' : '#ffd07a'; b.fillRect(Math.round(x + Math.cos(a) * z.r * 0.6), Math.round(y + Math.sin(a * 1.3) * z.r * 0.3) - i * 2, 2, 3); } break;
    case 'poison': b.fillStyle = 'rgba(140,230,70,0.22)'; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.fill(); break;
    case 'pool': b.fillStyle = 'rgba(120,200,60,0.3)'; b.beginPath(); b.ellipse(x, y, z.r, z.r * 0.6, 0, 0, 7); b.fill(); break;
    case 'lava': b.fillStyle = 'rgba(255,90,20,0.4)'; b.beginPath(); b.ellipse(x, y, z.r, z.r * 0.65, 0, 0, 7); b.fill(); b.fillStyle = 'rgba(255,200,80,0.5)'; b.beginPath(); b.ellipse(x, y, z.r * 0.5, z.r * 0.3, 0, 0, 7); b.fill(); break;
    case 'warm':
      b.strokeStyle = z.on ? 'rgba(255,190,90,0.9)' : 'rgba(255,190,90,0.35)'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.stroke();
      b.fillStyle = '#3a3040'; b.fillRect(x - 5, y - 2, 10, 6); b.fillStyle = Math.sin(now * 18) > 0 ? '#ffd07a' : '#ff8a2a'; b.fillRect(x - 3, y - 9, 6, 6); break;
    case 'safe': b.fillStyle = 'rgba(90,200,255,0.25)'; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.fill(); b.strokeStyle = '#9ae8ff'; b.lineWidth = 2; b.stroke(); break;
    case 'hole': for (let i = 0; i < 4; i++) { b.fillStyle = `rgba(${40 + i * 30},0,${80 + i * 30},${0.5 - i * 0.1})`; b.beginPath(); b.arc(x, y, 34 - i * 7, 0, 7); b.fill(); } b.fillStyle = '#000'; b.beginPath(); b.arc(x, y, 9, 0, 7); b.fill(); break;
    case 'met': { b.strokeStyle = 'rgba(255,140,40,0.8)'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.stroke(); const my = y - (1 - z.p) * 90; pcirc(x + (1 - z.p) * 20, my, 4, '#ff6a1a'); break; }
    case 'grav':
      for (let i = 0; i < 4; i++) { b.fillStyle = `rgba(${60 + i * 30},20,${140 + i * 25},${0.35 - i * 0.06})`; b.beginPath(); b.arc(x, y, z.r * (1 - i * 0.2), 0, 7); b.fill(); }
      b.fillStyle = '#05020a'; b.beginPath(); b.arc(x, y, 7, 0, 7); b.fill();
      for (let i = 0; i < 14; i++) { const a = now * 5 + i * 0.45, r = 8 + ((now * 40 + i * 11) % (z.r - 8)); b.fillStyle = i % 2 ? '#b8a8ff' : '#ffe07a'; b.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1); }
      break;
    case 'trap': b.strokeStyle = `rgba(120,255,120,${0.35 + 0.25 * Math.sin(now * 6)})`; b.lineWidth = 1; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.stroke(); b.fillStyle = 'rgba(120,255,120,0.5)'; b.fillRect(x - 1, y - 1, 3, 3); break;
    case 'field':
      b.fillStyle = 'rgba(255,200,80,0.12)'; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.fill();
      b.strokeStyle = `rgba(255,220,120,${0.6 + 0.3 * Math.sin(now * 8)})`; b.lineWidth = 2; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.stroke();
      for (let i = 0; i < 12; i++) { const a = now + i * 0.52; b.fillStyle = '#fff0a0'; b.fillRect(Math.round(x + Math.cos(a) * z.r), Math.round(y + Math.sin(a) * z.r), 2, 2); }
      break;
    case 'blaze': for (let i = 0; i < 10; i++) { const a = i * 0.63 + z.x, rr = (i % 5) * z.r / 5; b.fillStyle = (Math.floor(now * 10) + i) % 2 ? '#ff8a2a' : '#ffd07a'; b.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.6 - (now * 20 + i * 3) % 8), 2, 3); } b.fillStyle = 'rgba(255,100,30,0.18)'; b.beginPath(); b.ellipse(x, y, z.r, z.r * 0.6, 0, 0, 7); b.fill(); break;
    case 'bigmet': {
      b.strokeStyle = 'rgba(180,160,255,0.9)'; b.lineWidth = 2; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.stroke();
      b.fillStyle = 'rgba(160,140,255,0.15)'; b.beginPath(); b.arc(x, y, z.r * z.p, 0, 7); b.fill();
      const my = y - (1 - z.p) * 160; b.globalCompositeOperation = 'lighter'; pcirc(x, my, 12, '#8a7bff'); pcirc(x, my, 7, '#fff0c0'); b.globalCompositeOperation = 'source-over';
      break;
    }
    case 'larrow': { const k = z.p, yy = y - (1 - k) * 120; b.fillStyle = '#e8f4ff'; b.fillRect(Math.round(x), Math.round(yy) - 8, 1, 8); b.fillStyle = 'rgba(220,240,255,0.25)'; b.beginPath(); b.arc(x, y, z.r * k, 0, 7); b.fill(); break; }
  }
  b.globalAlpha = 1;
}
function drawHazard(h, x, y, now) {
  const col = h.d ? (h.f === 'poison' ? '140,230,70' : '255,50,50') : '255,170,40', p = Math.min(1, h.p);
  b.fillStyle = `rgba(${col},0.16)`; b.strokeStyle = `rgba(${col},${0.5 + 0.4 * Math.sin(now * 20)})`; b.lineWidth = 1;
  if (h.k === 'circle') { b.beginPath(); b.arc(x, y, h.r, 0, 7); b.fill(); b.stroke(); b.fillStyle = `rgba(${col},0.32)`; b.beginPath(); b.arc(x, y, h.r * p, 0, 7); b.fill(); }
  else if (h.k === 'line') { b.save(); b.translate(x, y); b.rotate(h.a); b.fillRect(0, -h.w / 2, h.l, h.w); b.strokeRect(0, -h.w / 2, h.l, h.w); b.fillStyle = `rgba(${col},0.32)`; b.fillRect(0, -h.w / 2, h.l * p, h.w); b.restore(); }
  else if (h.k === 'cone') { b.beginPath(); b.moveTo(x, y); b.arc(x, y, h.r, h.a - h.s, h.a + h.s); b.closePath(); b.fill(); b.stroke(); }
}
function drawObj(o, x, y, now, s) {
  x = Math.round(x); y = Math.round(y);
  if (!onScreen(x, y, 60)) return;
  switch (o.k) {
    case 'chest': { let dx = 0; if (o.tr && !o.o && (now % 4) < 0.25) dx = Math.round(Math.sin(now * 60)); const img = objSprite(o.o ? 'chestOpen' : 'chest').n; shadowE(x, y + 4, 9); b.drawImage(img, x - img.width + dx, y - img.height, img.width * 2, img.height * 2); break; }
    case 'pedestal': {
      b.fillStyle = '#4a4860'; b.fillRect(x - 7, y - 4, 14, 9); b.fillStyle = '#7a7890'; b.fillRect(x - 8, y - 6, 16, 3);
      if (!o.o) { const nm = { potion: 'potion', boon: 'scroll', cross: 'cross', whet: 'whet' }[o.it], img = objSprite(nm).n; b.drawImage(img, x - img.width, y - 24 + Math.round(Math.sin(now * 3 + o.i) * 1.5), img.width * 2, img.height * 2); }
      break;
    }
    case 'anvil': b.fillStyle = '#1a1828'; b.fillRect(x - 10, y - 7, 20, 6); b.fillRect(x - 5, y - 1, 10, 4); b.fillRect(x - 8, y + 3, 16, 3); b.fillStyle = '#6a6880'; b.fillRect(x - 9, y - 7, 18, 2); break;
    case 'altar': b.fillStyle = '#3a1a24'; b.fillRect(x - 11, y - 8, 22, 13); b.fillStyle = `rgba(255,40,80,${0.5 + 0.3 * Math.sin(now * 3)})`; b.fillRect(x - 4, y - 6, 8, 6); break;
    case 'classAltar': {
      const c = CLASSES[o.cl], art = heroArt(o.cl, null);
      b.fillStyle = '#0c0a14'; b.fillRect(x - 12, y - 4, 24, 9); b.fillStyle = '#2a2238'; b.fillRect(x - 13, y - 6, 26, 3);
      b.strokeStyle = c.color; b.globalAlpha = 0.6 + 0.3 * Math.sin(now * 3); b.lineWidth = 1; b.beginPath(); b.ellipse(x, y, 16, 6, 0, 0, 7); b.stroke();
      b.globalAlpha = 0.6; b.drawImage(art.idle[Math.floor(now * 4) % 4], x - 32, y - 66 + Math.round(Math.sin(now * 2) * 2)); b.globalAlpha = 1;
      break;
    }
    case 'wardrobe':
      b.fillStyle = '#c8a040'; b.fillRect(x - 12, y - 40, 24, 44); b.fillStyle = '#0c0a18'; b.fillRect(x - 9, y - 37, 18, 38);
      { const g = b.createLinearGradient(x - 9, y - 37, x + 9, y); g.addColorStop(0, '#3a3a6e'); g.addColorStop((now * 0.3) % 1, '#b8c8ff'); g.addColorStop(1, '#1a1a3a'); b.fillStyle = g; b.globalAlpha = 0.7; b.fillRect(x - 8, y - 36, 16, 36); b.globalAlpha = 1; }
      b.fillStyle = '#ffd34d'; b.fillRect(x - 2, y - 44, 4, 4);
      break;
    case 'portal': {
      const ready = s.ps.filter(p => p.rd).length, all = s.ps.length;
      b.globalCompositeOperation = 'lighter';
      for (let r = 34; r > 4; r -= 6) { b.fillStyle = `rgba(${ready === all ? 255 : 120},${ready === all ? 200 : 80},255,0.07)`; b.beginPath(); b.ellipse(x, y, r, r * 0.55, 0, 0, 7); b.fill(); }
      for (let i = 0; i < 24; i++) { const a = now * (i % 2 ? 1.2 : -0.8) + i * 0.26, r = i % 2 ? 30 : 22; b.fillStyle = i % 3 ? '#b07cff' : '#5ff2ff'; b.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.55), 2, 2); }
      b.globalCompositeOperation = 'source-over';
      break;
    }
  }
}
function drawSoulTorch(p, x, y, now, art) {
  const g = art.pal.glow;
  b.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { const yy = y - 6 - i * 4 - ((now * 30 + i * 5) % 6), w = 8 - i; b.fillStyle = i % 2 ? g : '#ffffff'; b.globalAlpha = 0.8 - i * 0.1; b.fillRect(Math.round(x - w / 2 + Math.sin(now * 8 + i) * 2), Math.round(yy), w, 4); }
  b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
  b.fillStyle = '#2a2238'; b.fillRect(x - 3, y - 4, 6, 8); b.fillStyle = '#5a4a3a'; b.fillRect(x - 1, y + 3, 2, 3);
}
function drawPlayer(p, x, y, now, s) {
  if (!onScreen(x, y, 70)) return;
  x = Math.round(x); y = Math.round(y);
  const art = heroArt(p.c, p.sk);
  if (p.dd) { b.fillStyle = '#4a4860'; b.fillRect(x - 5, y - 12, 10, 14); b.fillStyle = '#1a1828'; b.fillRect(x - 1, y - 10, 2, 8); b.fillRect(x - 3, y - 7, 6, 2); return; }
  if (p.dn) { shadowE(x, y + 3, 6); drawSoulTorch(p, x, y, now, art); return; }
  const face = Math.cos(p.a) < 0 ? -1 : 1, me = p.i === V.myId;
  shadowE(x, y + 3, p.c === 'aegis' ? 11 : 9);
  if (p.fd) { b.strokeStyle = 'rgba(255,220,120,0.7)'; b.lineWidth = 1; b.beginPath(); b.ellipse(x, y + 2, 13, 5, 0, 0, 7); b.stroke(); }
  // 翻滾殘影
  const tr = fx.trails.get(p.i);
  if (tr) {
    tr.pts.push([x + V.camO.x, y + V.camO.y]); if (tr.pts.length > 6) tr.pts.shift();
    tr.pts.forEach(([gx, gy], i) => { b.globalAlpha = (i / tr.pts.length) * 0.5 * A(p.i); b.save(); b.translate(gx - V.camO.x, gy - V.camO.y); b.scale(face, 1); b.drawImage(art.ghost, -32, -56); b.restore(); });
    b.globalAlpha = 1;
  }
  const frame = p.fl ? art.white : p.mv ? art.run[Math.floor(now * 11) % 6] : art.idle[Math.floor(now * 4) % 4];
  const behind = Math.sin(p.a) < -0.35;
  if (p.dg) b.globalAlpha = 0.6;
  if (p.iv && !p.ul && Math.floor(now * 20) % 2) b.globalAlpha = 0.65;
  if (behind) drawWeapon(p, x, y, face, art, now);
  b.save(); b.translate(x, y); b.scale(face, 1); b.drawImage(frame, -32, -56); b.restore();
  if (!behind) drawWeapon(p, x, y, face, art, now);
  b.globalAlpha = 1;
  if (p.se & 1) { b.globalAlpha = 0.3; b.save(); b.translate(x, y); b.scale(face, 1); b.drawImage(art.ghost, -32, -56); b.restore(); b.globalAlpha = 1; }
  if (p.br > 0) { b.strokeStyle = 'rgba(255,215,90,0.8)'; b.lineWidth = 1; b.beginPath(); b.ellipse(x, y - 18, 16, 24, 0, 0, 7); b.stroke(); }
  // 遊俠蓄力光圈：縮到最小（金色）時放開
  if (p.chg > 0) {
    const [lo, hi] = p.pw, k = Math.min(1, p.chg / hi), perfect = p.chg >= lo && p.chg <= hi;
    b.globalCompositeOperation = 'lighter'; b.strokeStyle = perfect ? '#ffe14a' : art.pal.glow; b.lineWidth = perfect ? 2 : 1;
    b.beginPath(); b.arc(x, y - 20, Math.max(4, 30 * (1 - k) + 4), 0, 7); b.stroke(); b.globalCompositeOperation = 'source-over';
  }
  // 舉盾
  if (p.blk) { b.globalCompositeOperation = 'lighter'; b.strokeStyle = art.pal.glow; b.lineWidth = 3; b.beginPath(); b.arc(x, y - 18, 22, p.a - 1.1, p.a + 1.1); b.stroke(); b.globalCompositeOperation = 'source-over'; }
  // 大招氣場
  if (p.ul) { b.globalCompositeOperation = 'lighter'; b.globalAlpha = 0.5 * A(p.i); b.fillStyle = art.pal.glow; b.beginPath(); b.ellipse(x, y - 20, 18 + Math.sin(now * 30) * 2, 28, 0, 0, 7); b.fill(); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over'; }
  // 造型粒子
  const sf = art.fx;
  if (sf && Math.random() < (p.mv ? 0.5 : 0.18)) {
    const px = p.x + (Math.random() - 0.5) * 16, py = p.y - 10 - Math.random() * 30;
    if (sf.k === 'sand' || sf.k === 'frost') fx.parts.push({ x: p.x + (Math.random() - 0.5) * 10, y: p.y + 2, vx: -face * 10, vy: -4, t: 0.6, c: sf.c, s: 1, o: p.i });
    else fx.parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 14, vy: sf.k === 'bubble' || sf.k === 'ember' || sf.k === 'wisp' ? -22 : (Math.random() - 0.5) * 14, t: 0.5, c: sf.c, s: sf.k === 'bat' ? 2 : 1, o: p.i });
  }
  if (p.ob) for (let i = 0; i < p.ob; i++) {
    const a = s.tm * 3.5 + i * 6.283 / p.ob, bx = x + Math.cos(a) * 26, by = y - 3 + Math.sin(a) * 26;
    b.save(); b.translate(Math.round(bx), Math.round(by)); b.rotate(a + 1.57); b.fillStyle = '#c08cff'; b.fillRect(-1, -4, 2, 8); b.restore();
  }
}
function drawWeapon(p, x, y, face, art, now) {
  let a = p.a;
  const sl = fx.slashes.find(o => o.i === p.i);
  if (sl) a += (0.5 - sl.t / 0.16) * (sl.n % 2 ? -2.6 : 2.6);
  const hx = x + face * 9, hy = y - 24;
  b.save();
  if (p.c === 'star') {
    const ox = Math.cos(p.a) * 12, oy = Math.sin(p.a) * 8 + Math.sin(now * 3) * 2;
    b.globalCompositeOperation = 'lighter'; b.globalAlpha *= 0.5; pcirc(hx + ox, hy + oy, 6, art.pal.glow); b.globalAlpha *= 2; b.globalCompositeOperation = 'source-over';
    b.drawImage(art.weapon, Math.round(hx + ox - 16), Math.round(hy + oy - 12));
  } else {
    b.translate(hx, hy); b.rotate(a);
    if (p.c === 'hunter' && p.chg > 0) { b.fillStyle = art.pal.glow; b.fillRect(2, -1, 14, 1); }
    b.drawImage(art.weapon, -4, -12);
    if (p.c === 'blade') { b.rotate(0.7); b.translate(-6, 6); b.drawImage(art.weapon, -4, -12); }
  }
  b.restore();
}
function drawEnemy(e, x, y, now) {
  const B = BOSSES[e.t], D = B || ENEMIES[e.t];
  if (!onScreen(x, y, 100)) return;
  if (e.t === 'dummy') return drawDummy(e, x, y, now);
  if (B) return drawBoss(e, x, y, now, B);
  if (e.t === 'shadowClone') {
    const art = heroArt(e.c || 'blade', null);
    shadowE(x, y + 3, 8);
    b.save(); b.translate(Math.round(x), Math.round(y)); if (Math.cos(e.a) < 0) b.scale(-1, 1);
    b.globalAlpha = 0.85; b.drawImage(e.fl ? art.white : shadowTint(art.run[Math.floor(now * 10) % 6]), -32, -56); b.restore(); b.globalAlpha = 1;
    return;
  }
  const S = enemySprite(e.t);
  if (e.un) { b.fillStyle = '#3a2a1a'; b.beginPath(); b.ellipse(Math.round(x), Math.round(y + 3), 9, 4, 0, 0, 7); b.fill(); return; }
  let img = e.fl ? S.w : e.fz ? S.i : S.n;
  if (e.st === 'fuse' && Math.floor(now * 16) % 2) img = S.w;
  const sc = 2 * (e.sc || 1), w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  let dx = 0, dy = 0;
  if (D.spr === 'slime' && e.st === 'hop') dy = -5;
  if (D.ai === 'fly' || D.spr === 'wisp' || D.spr === 'eye' || D.spr === 'ghost') dy = -8 + Math.round(Math.sin(now * 6 + e.i) * 2);
  if (e.st === 'wind') dx = Math.round((Math.random() - 0.5) * 3);
  if (e.st === 'fade') b.globalAlpha = 0.4;
  dy -= e.z;
  shadowE(x, y + 4, Math.max(5, w * 0.32));
  const ax = Math.round(x - w / 2 + dx), ay = Math.round(y - h + 8 + dy);
  if (D.alpha) b.globalAlpha = Math.min(b.globalAlpha, D.alpha);
  if (e.el) b.drawImage(S.o, ax - sc, ay - sc, Math.round(S.o.width * sc), Math.round(S.o.height * sc));
  b.drawImage(img, ax, ay, w, h);
  if (e.se & 4 && !e.fz) { b.globalAlpha = 0.4; b.drawImage(S.i, ax, ay, w, h); }
  if (e.se & 2) { b.globalAlpha = 0.35; b.drawImage(S.p, ax, ay, w, h); }
  b.globalAlpha = 1;
  if (e.se & 1 && Math.random() < 0.35) burst(e.x + (Math.random() - 0.5) * w * 0.6, e.y - h * 0.4, 1, Math.random() < 0.5 ? '#ff8a2a' : '#ffd07a', 25, 0.4);
  if (e.mk) { b.fillStyle = '#ff3a5a'; b.fillRect(Math.round(x) - 2, ay - 8, 4, 4); b.fillStyle = '#fff'; b.fillRect(Math.round(x) - 1, ay - 7, 2, 2); }
  if (e.vn) { b.strokeStyle = 'rgba(120,255,120,0.8)'; b.lineWidth = 1; b.beginPath(); b.ellipse(Math.round(x), Math.round(y + 3), w * 0.4, 4, 0, 0, 7); b.stroke(); }
  if (e.fc != null) { b.strokeStyle = '#c8d4f0'; b.lineWidth = 2; b.beginPath(); b.arc(Math.round(x), Math.round(y - 8), e.sc * 14, e.fc - 0.8, e.fc + 0.8); b.stroke(); }
  if (e.se & 8) for (let i = 0; i < 3; i++) { const a = now * 6 + i * 2.09; b.fillStyle = '#ffe14a'; b.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(ay - 3 + Math.sin(a) * 3), 2, 2); }
  if (e.hp < e.mh) { const bw = e.el ? 26 : 18, bx = Math.round(x - bw / 2), by = ay - 4; b.fillStyle = '#05040a'; b.fillRect(bx - 1, by - 1, bw + 2, 4); b.fillStyle = e.el ? '#ffb02a' : '#ff4a5a'; b.fillRect(bx, by, Math.ceil(bw * e.hp / e.mh), 2); }
}
const shadowCache = new Map();
function shadowTint(img) {
  if (shadowCache.has(img)) return shadowCache.get(img);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(90,30,170,0.85)'; x.fillRect(0, 0, c.width, c.height);
  shadowCache.set(img, c); return c;
}
function drawBoss(e, x, y, now, B) {
  const art = bossArt(e.t); if (!art) return;
  let img = art.frames[Math.floor(now * 2.2) % 2];
  if (e.pt) img = art.stone; else if (e.fl && Math.floor(now * 30) % 3 === 0) img = art.white; else if (e.fz) img = art.ice; else if (e.st === 'wind' && Math.floor(now * 16) % 2) img = art.red;
  const dx = e.st === 'wind' ? Math.round((Math.random() - 0.5) * 4) : 0;
  shadowE(x, y + 6, Math.max(10, 26 - e.z * 0.2));
  b.drawImage(img, Math.round(x - 48 + dx), Math.round(y - 88 - e.z));
  if (e.im) { b.strokeStyle = `rgba(255,220,120,${0.5 + 0.3 * Math.sin(now * 8)})`; b.lineWidth = 1; b.beginPath(); b.ellipse(Math.round(x), Math.round(y - 40 - e.z), 40, 46, 0, 0, 7); b.stroke(); }
  if (e.st === 'stun') for (let i = 0; i < 4; i++) { const a = now * 6 + i * 1.57; b.fillStyle = '#ffe14a'; b.fillRect(Math.round(x + Math.cos(a) * 20), Math.round(y - 86 + Math.sin(a) * 4), 3, 3); }
}
function drawDummy(e, x, y, now) {
  x = Math.round(x); y = Math.round(y);
  const wob = e.fl ? Math.round(Math.sin(now * 60) * 2) : 0;
  shadowE(x, y + 3, 9);
  b.fillStyle = '#5a3a1a'; b.fillRect(x - 2, y - 22, 4, 24); b.fillRect(x - 10 + wob, y - 20, 20, 3);
  b.fillStyle = '#c8a060'; b.beginPath(); b.ellipse(x + wob, y - 30, 9, 10, 0, 0, 7); b.fill();
  b.fillStyle = '#c8202a'; b.beginPath(); b.ellipse(x + wob, y - 30, 5, 6, 0, 0, 7); b.fill(); b.fillStyle = '#f0e0c0'; b.beginPath(); b.ellipse(x + wob, y - 30, 2, 2.5, 0, 0, 7); b.fill();
  b.strokeStyle = '#07050c'; b.lineWidth = 1; b.beginPath(); b.ellipse(x + wob, y - 30, 9, 10, 0, 0, 7); b.stroke();
}
function drawProj(pr, x, y, s) {
  const rot = fn => { b.save(); b.translate(Math.round(x), Math.round(y)); b.rotate(pr.a); fn(); b.restore(); };
  const owner = pr.o != null ? s.ps.find(p => p.i === pr.o) : null, pal = owner ? heroArt(owner.c, owner.sk).pal : null;
  switch (pr.k) {
    case 'arrow': rot(() => { b.fillStyle = pal ? pal.metal : '#c9a06a'; b.fillRect(-6, -0.5, 10, 1); b.fillStyle = pal ? pal.glow : '#fff'; b.fillRect(3, -1, 3, 2); }); break;
    case 'perfect': rot(() => { b.globalCompositeOperation = 'lighter'; b.fillStyle = pal ? pal.trail : '#9affff'; b.fillRect(-18, -1, 22, 2); b.fillStyle = '#ffffff'; b.fillRect(-4, -1, 10, 2); b.globalCompositeOperation = 'source-over'; }); break;
    case 'markblade': case 'crescent': rot(() => { b.globalCompositeOperation = 'lighter'; b.strokeStyle = pal ? pal.trail : '#ff4a4a'; b.lineWidth = pr.k === 'crescent' ? 3 : 2; b.beginPath(); b.arc(-4, 0, pr.k === 'crescent' ? 8 : 5, -1.2, 1.2); b.stroke(); b.globalCompositeOperation = 'source-over'; }); break;
    case 'arcane': b.globalCompositeOperation = 'lighter'; pcirc(x, y, 3, pal ? pal.trail : '#8ab0ff'); pcirc(x, y, 1, '#ffffff'); b.globalCompositeOperation = 'source-over'; break;
    case 'orb': b.globalCompositeOperation = 'lighter'; pcirc(x, y, 5, pal ? pal.glow : '#ffe07a'); pcirc(x, y, 2, '#ffffff'); b.globalCompositeOperation = 'source-over'; break;
    case 'bone': rot(() => { b.fillStyle = '#e9e6dc'; b.fillRect(-3, -1, 6, 2); b.fillRect(-4, -2, 2, 4); b.fillRect(2, -2, 2, 4); }); break;
    case 'knife': case 'wind': case 'sword': rot(() => { b.fillStyle = pr.k === 'wind' ? '#6dffc4' : '#c08cff'; b.fillRect(-4, -1, 8, 2); }); break;
    case 'shard': case 'ice': pcirc(x, y, pr.k === 'ice' ? 3 : 2, '#5ab0e8'); pcirc(x, y, 1, '#e8f8ff'); break;
    case 'fire': pcirc(x, y, 3, '#ff7b2a'); pcirc(x, y, 1, '#ffe08a'); break;
    case 'holy': case 'hbolt': pcirc(x, y, 3, '#fff6b0'); pcirc(x, y, 1, '#ffffff'); break;
    case 'spore': pcirc(x, y, 3, '#7a3fb0'); pcirc(x, y, 2, '#c58cff'); break;
    case 'seed': pcirc(x, y, 3, '#3a7a1a'); pcirc(x, y, 2, '#8ae04a'); break;
    case 'web': b.fillStyle = 'rgba(255,255,255,0.85)'; b.fillRect(Math.round(x) - 3, Math.round(y), 7, 1); b.fillRect(Math.round(x), Math.round(y) - 3, 1, 7); break;
    case 'rock': b.fillStyle = '#07050c'; b.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); b.fillStyle = '#9a9cab'; b.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); break;
    case 'efire': pcirc(x, y, 3, '#ff4a1a'); pcirc(x, y, 1, '#ffd07a'); break;
    case 'dark': pcirc(x, y, 3, '#5a1fb0'); pcirc(x, y, 2, '#d07cff'); break;
    case 'fireball': pcirc(x, y, 5, '#c8301a'); pcirc(x, y, 4, '#ff6a1a'); pcirc(x, y, 2, '#ffd27a'); break;
    default: pcirc(x, y, 2, '#ffffff');
  }
}

// ---------- 高解析：名牌、傷害數字、物件標籤 ----------
const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';
function txt(s, x, y, size, col = '#fff', align = 'center', weight = 800) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 4.5); ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function drawWorldText(s, ip, now) {
  const U = V.U;
  for (const p of s.ps) {
    if (p.dd) continue;
    const q = ip('p', p), sc = w2s(q.x, q.y);
    txt(p.n, sc.x, w2s(q.x, q.y - (p.dn ? 34 : 60)).y, 11 * U, CLASSES[p.c].color);
    if (p.rd && s.st === 'hub') txt('✔ 準備', sc.x, sc.y + 12 * U, 10 * U, '#7dff9a');
    if (p.dn) {
      txt(`靈魂火炬 ${p.tt}s`, sc.x, sc.y - 22 * V.SCALE, 10 * U, '#ff8a6a');
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4 * U; ctx.beginPath(); ctx.arc(sc.x, sc.y - 8 * V.SCALE, 14 * V.SCALE, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#7dff9a'; ctx.beginPath(); ctx.arc(sc.x, sc.y - 8 * V.SCALE, 14 * V.SCALE, -1.57, -1.57 + 6.28 * p.rv); ctx.stroke();
    }
    if (p.ut > 0) { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3 * U; ctx.beginPath(); ctx.arc(sc.x, sc.y - 20 * V.SCALE, 12 * V.SCALE, -1.57, -1.57 + 6.28 * Math.min(1, p.ut)); ctx.stroke(); }
  }
  if (s.dr) for (const d of s.dr) { const sc = w2s(d.x, d.y - 36), D = DOORS[d.t]; txt(`【${D.icon}】${D.name}`, sc.x, sc.y, 12 * U, D.color, 'center', 900); }
  for (const o of s.ob) {
    const sc = w2s(o.x, o.y - 26);
    if (o.k === 'pedestal' && !o.o) { txt(SHOP[o.it].name, sc.x, sc.y - 12 * U, 11 * U); txt(`${o.c} 金幣`, sc.x, sc.y + 2 * U, 10 * U, s.g >= o.c ? '#ffd34d' : '#ff6a6a'); }
    if (o.k === 'classAltar') { const c = CLASSES[o.cl]; txt(c.name, sc.x, w2s(o.x, o.y + 12).y, 11 * U, c.color, 'center', 900); }
    if (o.k === 'wardrobe') txt('鏡像衣櫃', sc.x, w2s(o.x, o.y + 12).y, 11 * U, '#ffd34d');
    if (o.k === 'portal') { const rd = s.ps.filter(p => p.rd).length; txt(`出發傳送陣　準備 ${rd}/${s.ps.length}`, sc.x, w2s(o.x, o.y + 22).y, 12 * U, '#c9a7ff', 'center', 900); }
  }
  for (const n of fx.nums) { const sc = w2s(n.x, n.y); ctx.globalAlpha = Math.min(1, n.t * 2.5); txt(String(n.v), sc.x, sc.y, (n.big ? 16 : 11) * U, n.c, 'center', 900); ctx.globalAlpha = 1; }
}
