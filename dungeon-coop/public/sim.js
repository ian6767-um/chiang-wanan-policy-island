// 深淵獵團 — 共用遊戲模擬（線上模式在伺服器跑、本機模式在瀏覽器跑）
import { CLASSES, ENEMIES, BOSSES, CHAPTERS, STAGES_PER_CHAPTER, BOONS, BOON_MAP, RES, TAGS, TREE, SKINS, SHOP, defaultStats } from './data.js';
export { CLASSES } from './data.js';
export const T = 16;

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const TAU = Math.PI * 2;
const NEED = { chest: 0.5, pedestal: 0.8, anvil: 1.0, altar: 1.2 };
const EVO = {
  knight: { 3: '揮砍範圍擴大', 5: '每次揮砍都射出劍氣' }, ranger: { 3: '額外射出平行箭', 5: '箭矢穿透 +1' },
  mage: { 3: '爆炸範圍 +40%', 5: '火球爆炸後分裂' }, cleric: { 3: '穿透與治療 +1', 5: '聖光彈會追蹤敵人' },
};

export class Game {
  constructor(opts = {}) {
    this.opts = opts;
    this.players = new Map();
    this.nid = 1;
    this.events = [];
    this.state = 'lobby';
    this.chapter = 1; this.stage = 0; this.gold = 0; this.time = 0; this.mapVersion = 0; this.tick = 0;
    this.enemies = []; this.projs = []; this.hazards = []; this.pickups = []; this.spawns = []; this.zones = []; this.objs = []; this.doors = null;
    this.dirty = true;
  }
  id() { return this.nid++; }
  ev(o) { this.events.push(o); }
  text(m, c = '#ffffff') { this.ev({ k: 'text', m, c }); }
  isUp(p) { return !p.dead && !p.downed; }
  ups() { const a = []; for (const p of this.players.values()) if (this.isUp(p)) a.push(p); return a; }
  diff() { return (this.chapter - 1) * STAGES_PER_CHAPTER + this.stage; }

  // ================= 玩家 =================
  addPlayer(id, name, cls, meta = {}) {
    if (!CLASSES[cls]) cls = 'knight';
    const tree = {};
    for (const n of TREE) tree[n.id] = clamp(Math.floor(+(meta.tree && meta.tree[n.id]) || 0), 0, n.max);
    const skin = (SKINS[cls] || []).some(s => s.id === meta.skin) ? meta.skin : 'default';
    const p = { id, name: String(name || '獵人').slice(0, 10), cls, skin, tree, x: 0, y: 0, r: 5, aim: 0,
      input: { mx: 0, my: 0, aim: 0, fire: false, skill: false, dodge: false } };
    this.resetPlayer(p);
    this.players.set(id, p);
    if (this.state === 'play') {
      const buddy = this.ups()[0];
      p.x = buddy ? buddy.x : (this.room.cx + 0.5) * T; p.y = buddy ? buddy.y : (this.room.cy + 0.5) * T;
      p.inv = 2;
      this.text(`${p.name} 加入了戰鬥！`, '#8fd3ff');
    }
    return p;
  }
  resetPlayer(p) {
    Object.assign(p, { boons: {}, cq: [], choice: null, choiceT: 0, maxhp: null, maxShield: null, energy: 100, maxEnergy: 100,
      atkCd: 0, skillCd: 0, dodgeT: 0, dodgeCd: 0, dvx: 0, dvy: 0, hitT: 99, inv: 0, downed: false, bleed: 0, dead: false, revive: 0,
      spinT: 0, spinTick: 0, flash: 0, moving: false, kills: 0, dmgDealt: 0, atkCount: 0, frenzyT: 0, dodgeCritT: 0, staticT: 2,
      frostCd: 0, lastStandCd: 0, slowT: 0, burnT: 0, poisT: 0, dotT: 0.5, useId: null, useT: 0, orbT: 0, trailT: 0, guardianUsed: false });
    this.recompute(p);
    p.hp = p.maxhp; p.shield = p.maxShield;
    p.wl = p.st.wlStart; p.lives = p.st.lives; p.rerolls = p.st.rerolls;
    for (let i = 0; i < p.st.startBoons; i++) p.cq.push('normal');
  }
  removePlayer(id) { const p = this.players.get(id); if (p && this.state === 'play') this.text(`${p.name} 離開了`, '#aaaaaa'); this.players.delete(id); }
  setInput(id, inp) { const p = this.players.get(id); if (p) p.input = inp; }

  tagCounts(p) {
    const c = {};
    for (const id in p.boons) { const b = BOON_MAP[id]; c[b.tag] = (c[b.tag] || 0) + p.boons[id]; }
    return c;
  }
  recompute(p) {
    const c = CLASSES[p.cls], s = defaultStats();
    for (const n of TREE) { const l = p.tree[n.id] || 0; if (l) n.apply(s, l); }
    for (const id in p.boons) BOON_MAP[id].apply(s, p.boons[id]);
    const cnt = this.tagCounts(p);
    for (const tag in RES) for (const tier of RES[tag]) if ((cnt[tag] || 0) >= tier.n) tier.apply(s);
    s.dr = Math.min(0.6, s.dr);
    p.st = s;
    const mh = Math.round(c.hp + s.hpAdd), ms = Math.round(c.shield + s.shieldAdd);
    if (p.maxhp != null) { if (mh > p.maxhp) p.hp += mh - p.maxhp; if (ms > p.maxShield) p.shield += ms - p.maxShield; }
    p.maxhp = mh; p.maxShield = ms;
    if (p.hp != null) { p.hp = Math.min(p.hp, mh); p.shield = Math.min(p.shield, ms); }
    this.dirty = true;
  }

  // ---------- 增幅選擇 ----------
  makeChoice(p, rarity) {
    const gain = rarity === 'rare' ? 2 : 1, cnt = this.tagCounts(p);
    const pool = BOONS.filter(b => (p.boons[b.id] || 0) < b.max), o = [];
    while (o.length < 3 && pool.length) {
      const ws = pool.map(b => (cnt[b.tag] ? 2.2 : 1) * (p.boons[b.id] ? 1.5 : 1));
      let r = Math.random() * ws.reduce((a, b) => a + b, 0), i = 0;
      while (r > ws[i]) { r -= ws[i]; i++; }
      o.push([pool[i].id, gain]); pool.splice(i, 1);
    }
    while (o.length < 3) o.push([o.some(x => x[0] === 'gold') ? 'heal' : 'gold', 1]);
    return { r: rarity, o };
  }
  pick(id, i) {
    const p = this.players.get(id);
    if (!p || !p.choice) return;
    const [bid, g] = p.choice.o[clamp(i | 0, 0, p.choice.o.length - 1)];
    if (bid === 'gold') this.gold += 40;
    else if (bid === 'heal') { p.hp = p.maxhp; p.shield = p.maxShield; }
    else {
      const b = BOON_MAP[bid], before = this.tagCounts(p)[b.tag] || 0;
      p.boons[bid] = Math.min(b.max, (p.boons[bid] || 0) + g);
      this.recompute(p);
      const after = this.tagCounts(p)[b.tag] || 0;
      for (const tier of RES[b.tag]) if (before < tier.n && after >= tier.n) {
        this.text(`${p.name} 觸發共鳴【${TAGS[b.tag].name}·${tier.n}】${tier.desc}`, TAGS[b.tag].color);
        this.ev({ k: 'res', i: p.id, c: b.tag });
      }
    }
    p.choice = null; this.dirty = true;
    this.ev({ k: 'snd', s: 'pick' });
  }
  reroll(id) {
    const p = this.players.get(id);
    if (!p || !p.choice || p.rerolls <= 0) return;
    p.rerolls--; p.choice = this.makeChoice(p, p.choice.r); this.dirty = true;
  }

  // ================= 關卡流程 =================
  start() {
    this.state = 'play'; this.chapter = 1; this.stage = 0; this.gold = 0; this.time = 0; this.bossKills = 0; this.cleared = 0;
    for (const p of this.players.values()) this.resetPlayer(p);
    this.enterStage('combat', true);
  }

  enterStage(type, first = false) {
    if (!first) this.cleared++;
    if (type === 'next') { this.chapter++; this.stage = 0; type = 'combat'; }
    this.stage++;
    this.stype = type;
    this.enemies = []; this.projs = []; this.hazards = []; this.pickups = []; this.spawns = []; this.zones = []; this.objs = [];
    this.doors = null; this.doorT = 0; this.doorSel = -1; this.bossPending = 0; this.boss = null; this.waveDelay = 1.2;
    this.genArena(type);
    const R = this.room;
    let i = 0;
    for (const p of this.players.values()) {
      if (p.dead) { p.dead = false; p.hp = Math.ceil(p.maxhp * 0.35); }
      else if (p.downed) p.hp = Math.ceil(p.maxhp * 0.3);
      Object.assign(p, { downed: false, revive: 0, spinT: 0, dodgeT: 0, inv: 1.5, guardianUsed: false, useId: null, useT: 0, slowT: 0, burnT: 0, poisT: 0 });
      p.x = (R.cx + 0.5) * T + (i - (this.players.size - 1) / 2) * 16;
      p.y = (R.y + R.h - 2.5) * T;
      i++;
    }
    const np = Math.max(1, this.players.size);
    this.phase = 'fight';
    if (type === 'combat') this.waves = 2 + (this.stage >= 5 ? 1 : 0);
    else if (type === 'elite') { this.waves = 2; this.elites = 1 + Math.floor(np / 2); }
    else if (type === 'boss') { this.waves = 0; this.bossPending = 2.2; this.text('⚠ 強大的氣息逼近…', '#ff5555'); }
    else this.setupEvent(type);
    this.mapVersion++;
    this.dirty = true;
    const ch = CHAPTERS[this.chapter - 1];
    this.ev({ k: 'stage', ch: this.chapter, sg: this.stage, ty: type });
    const label = { combat: '戰鬥', elite: '精英戰', boss: '頭目戰', supply: '補給站', forge: '武器鍛造', chest: '寶藏室', altar: '血之祭壇' }[type];
    this.text(`第 ${this.chapter} 章 ${ch.name} · ${this.stage}/${STAGES_PER_CHAPTER} · ${label}`, '#ffd34d');
  }

  setupEvent(type) {
    this.phase = 'explore';
    const R = this.room, cx = (R.cx + 0.5) * T, cy = (R.cy + 0.5) * T;
    const add = o => this.objs.push({ id: this.id(), used: [], ...o });
    if (type === 'supply') {
      for (const p of this.players.values()) if (!p.dead) { this.heal(p, p.maxhp * 0.35); p.energy = p.maxEnergy; p.shield = p.maxShield; }
      this.text('補給站：生命回復 35%。用金幣購買物資（站在台座上）', '#6aff9a');
      const items = Object.keys(SHOP).sort(() => Math.random() - 0.5).slice(0, 3);
      const cm = 1 + 0.15 * (this.chapter - 1);
      items.forEach((it, i) => add({ k: 'pedestal', x: cx + (i - 1) * 64, y: cy + 8, it, c: Math.round(SHOP[it].cost * cm) }));
    } else if (type === 'forge') {
      add({ k: 'anvil', x: cx, y: cy });
      this.text('武器鍛造：每位獵人可站在鐵砧上升級一次武器', '#8ad0ff');
    } else if (type === 'chest') {
      const trap = randi(0, 2);
      for (let i = 0; i < 3; i++) add({ k: 'chest', x: cx + (i - 1) * 72, y: cy, trap: i === trap ? (Math.random() < 0.6 ? 'mimic' : 'gas') : null });
      this.text('寶藏室：其中一個是陷阱寶箱，小心選擇！', '#ffd34d');
    } else if (type === 'altar') {
      add({ k: 'altar', x: cx, y: cy });
      this.text('血之祭壇：獻上 25% 最大生命，換取強化 +2 的增幅', '#ff3a6a');
    }
  }

  canLeave() {
    if (this.phase !== 'explore' || this.enemies.length || this.spawns.length || this.bossPending > 0) return false;
    for (const p of this.players.values()) if (p.choice || p.cq.length) return false;
    return true;
  }

  genDoors() {
    let types;
    if (this.stype === 'boss') types = ['next'];
    else if (this.stage + 1 >= STAGES_PER_CHAPTER) types = ['boss'];
    else {
      const W = [['combat', 40], ['elite', this.stage >= 3 ? 14 : 0], ['supply', 11], ['forge', 9], ['chest', 12], ['altar', this.stage >= 2 ? 8 : 0]];
      const n = Math.random() < 0.45 ? 3 : 2;
      types = [];
      for (let guard = 0; types.length < n && guard < 50; guard++) {
        const ok = W.filter(([t, w]) => w > 0 && !types.includes(t) && !(t === this.stype && t !== 'combat'));
        let r = Math.random() * ok.reduce((a, b) => a + b[1], 0), i = 0;
        while (r > ok[i][1]) { r -= ok[i][1]; i++; }
        types.push(ok[i][0]);
      }
      if (!types.includes('combat') && !types.includes('elite') && Math.random() < 0.6) types[0] = 'combat';
    }
    const R = this.room;
    this.doors = types.map((t, i) => ({ t, x: (R.x + Math.round((i + 1) * R.w / (types.length + 1)) + 0.5) * T, y: (R.y + 0.5) * T }));
    this.dirty = true;
    this.ev({ k: 'snd', s: 'door' });
    this.text(types.length > 1 ? '選擇下一個關卡：全員站到同一扇門前' : '前進的門已開啟', '#c9a7ff');
  }

  updateDoors(dt) {
    if (!this.doors) { if (this.canLeave()) this.genDoors(); return; }
    const ups = this.ups();
    let sel = -1;
    if (ups.length) this.doors.forEach((d, i) => { if (ups.every(p => Math.hypot(p.x - d.x, p.y - d.y) < 20)) sel = i; });
    if (sel !== this.doorSel) { this.doorSel = sel; this.doorT = 0; }
    if (sel >= 0) { this.doorT += dt; if (this.doorT >= 1.2) this.enterStage(this.doors[sel].t); }
  }

  endRun(win) {
    if (this.state !== 'play') return;
    if (win) this.cleared++;
    this.state = 'over'; this.overT = win ? 12 : 8;
    const kills = {};
    for (const p of this.players.values()) kills[p.id] = p.kills;
    this.result = { win, ch: this.chapter, sg: this.stage, cleared: this.cleared, bossKills: this.bossKills, kills };
    this.ev({ k: 'over', ...this.result });
    this.text(win ? '虛空主宰已被討伐！深淵恢復了平靜' : '全滅…', win ? '#ffd34d' : '#ff5555');
  }

  // ================= 地圖 =================
  genArena(type) {
    let w, h;
    if (type === 'boss') { w = 30; h = 22; }
    else if (type === 'combat' || type === 'elite') { w = randi(22, 28); h = randi(15, 19); }
    else { w = 19; h = 13; }
    const W = w + 4, H = h + 5, rx = 2, ry = 3;
    const tiles = new Uint8Array(W * H);
    for (let y = ry; y < ry + h; y++) for (let x = rx; x < rx + w; x++) tiles[y * W + x] = 1;
    const R = { x: rx, y: ry, w, h, cx: rx + (w >> 1), cy: ry + (h >> 1) };
    const hole = (x, y) => { tiles[y * W + x] = 0; };
    if (type === 'combat' || type === 'elite') {
      const n = randi(0, 5);
      for (let i = 0; i < n; i++) {
        const tx = randi(rx + 3, rx + w - 5), ty = randi(ry + 3, ry + h - 6);
        if (Math.abs(tx - R.cx) < 4 && Math.abs(ty - R.cy) < 3) continue;
        const shape = randi(0, 2);
        if (shape === 0) { hole(tx, ty); hole(tx + 1, ty); hole(tx, ty + 1); hole(tx + 1, ty + 1); }
        else if (shape === 1) { hole(tx, ty); hole(tx + 1, ty); hole(tx + 2, ty); }
        else { hole(tx, ty); hole(tx, ty + 1); hole(tx, ty + 2); }
      }
    } else if (type === 'boss') {
      for (const [dx, dy] of [[-8, -5], [7, -5], [-8, 4], [7, 4]]) { hole(R.cx + dx, R.cy + dy); hole(R.cx + dx + 1, R.cy + dy); hole(R.cx + dx, R.cy + dy + 1); hole(R.cx + dx + 1, R.cy + dy + 1); }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tiles[y * W + x] !== 0) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && tiles[yy * W + xx] === 1) { near = true; break; }
      }
      if (near) tiles[y * W + x] = 2;
    }
    this.W = W; this.H = H; this.tiles = tiles; this.room = R;
  }
  mapData() {
    return { t: 'map', v: this.mapVersion, ch: this.chapter, w: this.W, h: this.H, tiles: Array.from(this.tiles).join(''), room: this.room };
  }

  // ---------- 碰撞 ----------
  solid(tx, ty) { return tx < 0 || ty < 0 || tx >= this.W || ty >= this.H || this.tiles[ty * this.W + tx] !== 1; }
  solidAt(x, y) { return this.solid(Math.floor(x / T), Math.floor(y / T)); }
  collides(x, y, r) {
    const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solid(tx, ty)) return true;
    return false;
  }
  moveEnt(e, dx, dy) {
    if (this.collides(e.x, e.y, e.r)) { e.x += dx; e.y += dy; return false; }
    let b = false;
    if (dx) { if (!this.collides(e.x + dx, e.y, e.r)) e.x += dx; else b = true; }
    if (dy) { if (!this.collides(e.x, e.y + dy, e.r)) e.y += dy; else b = true; }
    return b;
  }
  moveFree(e, dx, dy) {
    const R = this.room;
    e.x = clamp(e.x + dx, (R.x + 0.5) * T, (R.x + R.w - 0.5) * T);
    e.y = clamp(e.y + dy, (R.y + 0.5) * T, (R.y + R.h - 0.5) * T);
  }
  los(x1, y1, x2, y2) {
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 6);
    for (let i = 1; i < n; i++) if (this.solidAt(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n)) return false;
    return true;
  }
  rayLen(x, y, a, max) {
    const c = Math.cos(a), s = Math.sin(a);
    for (let d = 0; d < max; d += 4) if (this.solidAt(x + c * d, y + s * d)) return d;
    return max;
  }
  randFloor(margin = 2, awayFrom = null, minD = 0) {
    const R = this.room;
    for (let t = 0; t < 40; t++) {
      const x = (randi(R.x + margin, R.x + R.w - 1 - margin) + 0.5) * T, y = (randi(R.y + margin, R.y + R.h - 1 - margin) + 0.5) * T;
      if (this.collides(x, y, 7)) continue;
      if (awayFrom && awayFrom.some(p => Math.hypot(p.x - x, p.y - y) < minD)) continue;
      return { x, y };
    }
    return { x: (R.cx + 0.5) * T, y: (R.cy + 0.5) * T };
  }
  nearestUp(e) {
    let best = null, bd = Infinity;
    for (const p of this.players.values()) if (this.isUp(p)) { const d = d2(p, e); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  nearestEnemy(p, maxd, skip = null) {
    let best = null, bd = maxd * maxd;
    for (const e of this.enemies) {
      if (e.dead || e.under || (skip && skip.has(e.id))) continue;
      const d = d2(p, e);
      if (d < bd && this.los(p.x, p.y, e.x, e.y)) { bd = d; best = e; }
    }
    return best;
  }

  // ================= 主迴圈 =================
  step(dt) {
    if (this.state === 'over') { this.overT -= dt; return; }
    if (this.state !== 'play') return;
    this.time += dt; this.tick++;
    for (const p of this.players.values()) {
      if (!p.choice && p.cq.length) { p.choice = this.makeChoice(p, p.cq.shift()); p.choiceT = 0; this.dirty = true; }
      if (p.choice) { p.choiceT += dt; if (p.choiceT > 60) this.pick(p.id, 0); }
      this.updatePlayer(p, dt);
    }
    this.updateFight(dt);
    this.updateSpawns(dt);
    for (const e of this.enemies) if (!e.dead) this.updateEnemy(e, dt);
    this.separate();
    this.enemies = this.enemies.filter(e => !e.dead);
    this.updateProjs(dt);
    this.updateHazards(dt);
    this.updateZones(dt);
    this.updatePickups(dt);
    this.updateObjs(dt);
    this.updateDoors(dt);
    if (this.state === 'play' && this.players.size > 0 && this.ups().length === 0) this.endRun(false);
  }

  updateFight(dt) {
    if (this.phase !== 'fight') return;
    if (this.bossPending > 0) {
      this.bossPending -= dt;
      if (this.bossPending <= 0) {
        const b = this.createEnemy(CHAPTERS[this.chapter - 1].boss, (this.room.cx + 0.5) * T, (this.room.cy - 2) * T);
        this.ev({ k: 'boss', n: b.name }); this.ev({ k: 'shake', v: 8 });
      }
      return;
    }
    if (this.stype === 'boss') return;
    if (this.enemies.length || this.spawns.length) return;
    if (this.waves > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) { this.spawnWave(); this.waveDelay = 0.8; }
      return;
    }
    // 清除
    this.phase = 'explore';
    const R = this.room, x = (R.cx + 0.5) * T, y = (R.cy + 0.5) * T;
    const elite = this.stype === 'elite';
    for (let i = 0; i < (elite ? 10 : 4); i++) this.drop('coin', x + rand(-20, 20), y + rand(-20, 20));
    if (Math.random() < 0.5) this.drop(Math.random() < 0.5 ? 'hp' : 'en', x, y);
    for (const p of this.players.values()) p.cq.push(elite ? 'rare' : 'normal');
    this.ev({ k: 'snd', s: 'clear' });
    this.text(elite ? '精英討伐完成！選擇強化 +2 的增幅' : '關卡完成！選擇一個增幅', '#7dff9a');
  }

  spawnWave() {
    this.waves--;
    const np = Math.max(1, this.players.size), d = this.diff();
    const pool = CHAPTERS[this.chapter - 1].pool;
    const sub = pool.slice(0, this.stage <= 2 ? 4 : this.stage <= 5 ? 6 : 8);
    const count = Math.round(3 + d * 0.12 + np * 1.4 + rand(0, 2));
    const ups = this.ups();
    let elites = this.stype === 'elite' && this.waves === 1 ? this.elites : 0;
    for (let i = 0; i < count; i++) {
      const pos = this.randFloor(2, ups, 60);
      const el = elites > 0 || (this.stage >= 4 && Math.random() < 0.06 + this.chapter * 0.02);
      if (elites > 0) elites--;
      this.spawns.push({ x: pos.x, y: pos.y, type: pick(sub), t: 0.9 + rand(0, 0.4), el });
    }
  }
  updateSpawns(dt) {
    for (const s of this.spawns) { s.t -= dt; if (s.t <= 0) this.createEnemy(s.type, s.x, s.y, { elite: s.el }); }
    this.spawns = this.spawns.filter(s => s.t > 0);
  }

  // ================= 玩家更新 =================
  updatePlayer(p, dt) {
    if (p.dead) return;
    const s = p.st;
    p.flash = Math.max(0, p.flash - dt); p.inv = Math.max(0, p.inv - dt);
    if (p.downed) {
      p.bleed -= dt;
      let helper = null;
      for (const q of this.players.values()) if (q !== p && this.isUp(q) && d2(p, q) < 26 * 26) helper = q;
      p.revive = helper ? p.revive + dt * (helper.st.fastRevive ? 2 : 1) : Math.max(0, p.revive - dt * 0.5);
      if (p.revive >= 2.5) { this.revivePlayer(p, 0.4); if (helper.st.fastRevive) p.shield = p.maxShield; }
      else if (p.bleed <= 0) { p.dead = true; p.downed = false; this.text(`${p.name} 陣亡了…下一關會復活`, '#ff6b6b'); }
      return;
    }
    // 狀態
    p.slowT -= dt; p.burnT -= dt; p.poisT -= dt; p.frostCd -= dt; p.lastStandCd -= dt; p.frenzyT -= dt; p.dodgeCritT -= dt;
    p.dotT -= dt;
    if (p.dotT <= 0) {
      p.dotT = 0.5;
      const sc = 1 + 0.3 * (this.chapter - 1);
      const dmg = ((p.burnT > 0 ? 3 : 0) + (p.poisT > 0 ? 2 : 0)) * sc;
      if (dmg) this.hurtRaw(p, dmg);
      if (!this.isUp(p)) return;
    }
    if (s.regen && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + s.regen * s.healMul * dt);
    const c = CLASSES[p.cls];
    p.energy = Math.min(p.maxEnergy, p.energy + c.regen * s.energyRegen * dt);
    p.hitT += dt;
    if (p.hitT > s.shieldDelay) p.shield = Math.min(p.maxShield, p.shield + 20 * s.shieldRegen * dt);
    p.atkCd -= dt; p.skillCd -= dt; p.dodgeCd -= dt;

    if (p.choice) { p.inv = Math.max(p.inv, 0.3); p.moving = false; return; }

    const inp = p.input || {};
    let mx = +inp.mx || 0, my = +inp.my || 0;
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = ml > 0.1;
    if (inp.aim == null || !isFinite(inp.aim)) {
      const t = this.nearestEnemy(p, 230);
      if (t) p.aim = Math.atan2(t.y - p.y, t.x - p.x); else if (p.moving) p.aim = Math.atan2(my, mx);
    } else p.aim = +inp.aim;
    if (inp.dodge && p.dodgeCd <= 0 && p.dodgeT <= 0) {
      const l = Math.hypot(mx, my);
      if (l > 0.1) { p.dvx = mx / l; p.dvy = my / l; } else { p.dvx = Math.cos(p.aim); p.dvy = Math.sin(p.aim); }
      p.dodgeT = 0.28; p.dodgeCd = 0.85 * s.dodgeCd;
      if (s.dodgeCrit) p.dodgeCritT = 1.5;
      this.ev({ k: 'snd', s: 'dodge' }); this.ev({ k: 'dust', x: r1(p.x), y: r1(p.y) });
    }
    const spd = c.speed * s.speed * (p.slowT > 0 ? 0.6 : 1);
    const px = p.x, py = p.y;
    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      this.moveEnt(p, p.dvx * spd * 2.7 * dt, p.dvy * spd * 2.7 * dt);
      p.trailT -= dt;
      if (p.trailT <= 0 && (s.dodgeFire || s.dodgePoison)) {
        p.trailT = 0.07;
        this.zones.push({ k: s.dodgeFire ? 'fire' : 'poison', x: p.x, y: p.y, r: 12, t: 2.5, tick: 0, owner: p.id });
        if (s.dodgeFire && s.dodgePoison) this.zones.push({ k: 'poison', x: p.x, y: p.y, r: 12, t: 2.5, tick: 0.2, owner: p.id });
      }
      if (p.dodgeT <= 0 && s.dodgeShock) { this.blast(p, p.x, p.y, 50, 18, 'zap'); }
    } else {
      const k = p.spinT > 0 ? 0.75 : 1;
      this.moveEnt(p, mx * spd * k * dt, my * spd * k * dt);
    }
    const L = this.opts.leash;
    if (L) {
      let cx = 0, cy = 0, n = 0;
      for (const q of this.players.values()) if (q !== p && !q.dead) { cx += q.x; cy += q.y; n++; }
      if (n) {
        cx /= n; cy /= n;
        if (Math.abs(p.x - cx) > L.x && Math.abs(p.x - cx) > Math.abs(px - cx)) p.x = px;
        if (Math.abs(p.y - cy) > L.y && Math.abs(p.y - cy) > Math.abs(py - cy)) p.y = py;
      }
    }
    if (inp.fire && p.atkCd <= 0 && p.dodgeT <= 0) this.attack(p);
    if (inp.skill && p.skillCd <= 0 && p.dodgeT <= 0 && p.energy >= c.skillCost) this.skill(p);
    if (p.spinT > 0) {
      p.spinT -= dt; p.spinTick -= dt;
      if (p.spinTick <= 0) {
        p.spinTick = 0.2;
        for (const e of this.enemies) if (!e.dead && dist(e, p) < 36 + e.r) this.hurtEnemy(e, this.pdmg(p, 13, e), p, Math.atan2(e.y - p.y, e.x - p.x), { kb: 30 });
        this.projs = this.projs.filter(pr => !(pr.team === 'e' && Math.hypot(pr.x - p.x, pr.y - p.y) < 38));
      }
    }
    // 被動
    if (s.staticField) {
      p.staticT -= dt;
      if (p.staticT <= 0) {
        p.staticT = 2;
        const hit = new Set();
        for (let i = 0; i < s.staticField; i++) {
          const e = this.nearestEnemy(p, 120, hit);
          if (!e) break;
          hit.add(e.id);
          this.hurtEnemy(e, this.pdmg(p, 12 * s.chainDmg, e), p, null, { proc: false, noCrit: true, col: 4 });
          if (s.paralyze && !e.boss) e.stunT = 0.6;
          this.ev({ k: 'zap', pts: [[r1(p.x), r1(p.y - 4)], [r1(e.x), r1(e.y)]] });
        }
      }
    }
    if (s.orbit) {
      p.orbT -= dt;
      if (p.orbT <= 0) {
        p.orbT = 0.2;
        for (let i = 0; i < s.orbit; i++) {
          const a = this.time * 3.5 + i * TAU / s.orbit, bx = p.x + Math.cos(a) * 26, by = p.y - 3 + Math.sin(a) * 26;
          for (const e of this.enemies) if (!e.dead && !e.under && Math.hypot(e.x - bx, e.y - by) < e.r + 6) this.hurtEnemy(e, this.pdmg(p, 7, e), p, a, { proc: false, kb: 20 });
        }
      }
    }
  }

  revivePlayer(p, frac) {
    p.downed = false; p.hp = Math.ceil(p.maxhp * frac); p.revive = 0; p.inv = 1.5;
    this.text(`${p.name} 重新站了起來！`, '#7dff9a'); this.ev({ k: 'snd', s: 'revive' });
  }
  heal(p, amt) {
    if (!this.isUp(p)) return;
    amt *= p.st.healMul;
    const over = p.hp + amt - p.maxhp;
    p.hp = Math.min(p.maxhp, p.hp + amt);
    if (over > 0 && p.st.overheal) p.shield = Math.min(p.maxShield, p.shield + over);
  }
  healLowest(v) {
    let best = null;
    for (const p of this.players.values()) if (this.isUp(p) && p.hp < p.maxhp && (!best || p.hp / p.maxhp < best.hp / best.maxhp)) best = p;
    if (best) this.heal(best, v);
  }

  // 玩家傷害倍率
  pdmg(p, base, e) {
    const s = p.st;
    let m = s.dmg * (1 + 0.12 * (p.wl - 1));
    let aura = 0;
    for (const q of this.players.values()) if (q.st.aura && this.isUp(q) && d2(p, q) < 110 * 110) aura += q.st.aura;
    m *= 1 + aura;
    if (s.fullShieldDmg && p.shield >= p.maxShield - 0.5) m *= 1 + s.fullShieldDmg;
    if (e) {
      if (e.burnT > 0) m *= 1 + s.dmgVsBurn;
      if (e.slowT > 0 || e.frozen > 0) m *= 1 + s.vsSlow;
      if (e.frozen > 0) m *= s.frozenVuln;
      if (e.poison > 0) m *= 1 + s.corrode;
      if (e.vulnT > 0) m *= 1 + e.vuln;
      if (e.boss) m *= 1 + s.bossDmg;
    }
    return base * m;
  }

  shoot(team, owner, kind, x, y, a, speed, dmg, o = {}) {
    let ox = 0, oy = 0;
    if (o.off) { ox = -Math.sin(a) * o.off; oy = Math.cos(a) * o.off; }
    this.projs.push({ id: this.id(), k: kind, team, owner, x: x + Math.cos(a) * 6 + ox, y: y + Math.sin(a) * 6 + oy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, r: o.r || 3, life: o.life || 1.6, pierce: o.pierce || 0, splash: o.splash || 0, heal: o.heal || 0, home: !!o.home, chain: !!o.chain,
      ignite: !!o.ignite, frag: !!o.frag, fx: o.fx || null, proc: o.proc !== false, hit: [] });
  }
  pshoot(p, kind, a, speed, dmg, o = {}) { this.shoot('p', p.id, kind, p.x, p.y - 3, a, speed, dmg, o); }

  attack(p) {
    const s = p.st, a = p.aim, ms = s.multishot;
    p.atkCount++;
    const rate = s.rate * (p.frenzyT > 0 ? 1.35 : 1);
    switch (p.cls) {
      case 'knight': {
        p.atkCd = 0.36 / rate;
        const range = p.wl >= 3 ? 40 : 32;
        for (const e of this.enemies) {
          if (e.dead || e.under) continue;
          if (dist(e, p) < range + e.r && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), a)) < 1.05) this.hurtEnemy(e, this.pdmg(p, 24, e), p, a, { kb: 90 });
        }
        this.projs = this.projs.filter(pr => {
          if (pr.team === 'e' && Math.hypot(pr.x - p.x, pr.y - p.y) < range + 2 && Math.abs(angDiff(Math.atan2(pr.y - p.y, pr.x - p.x), a)) < 1.1) { this.ev({ k: 'spark', x: r1(pr.x), y: r1(pr.y) }); return false; }
          return true;
        });
        this.ev({ k: 'slash', x: r1(p.x), y: r1(p.y), a: r2(a), i: p.id, r: range });
        if ((s.unique && p.atkCount % 3 === 0) || p.wl >= 5) this.pshoot(p, 'sword', a, 230, 16, { pierce: 3, r: 5, life: 0.6 });
        for (let i = 1; i <= ms; i++) for (const sg of [-1, 1]) this.pshoot(p, 'sword', a + sg * 0.3 * i, 230, 12, { pierce: 2, r: 5, life: 0.5 });
        break;
      }
      case 'ranger': {
        p.atkCd = 0.17 / rate;
        const pierce = p.wl >= 5 ? 1 : 0, jit = rand(-0.05, 0.05);
        this.pshoot(p, 'arrow', a + jit, 290, 11, { pierce, off: p.wl >= 3 ? -3 : 0 });
        if (p.wl >= 3) this.pshoot(p, 'arrow', a + jit, 290, 11, { pierce, off: 3 });
        if (s.unique) for (const sg of [-1, 1]) this.pshoot(p, 'arrow', a + sg * 0.3, 280, 9, { pierce });
        for (let i = 1; i <= ms; i++) for (const sg of [-1, 1]) this.pshoot(p, 'arrow', a + sg * 0.12 * i, 280, 9, { pierce });
        break;
      }
      case 'mage': {
        if (p.energy < 3) { p.atkCd = 0.2; return; }
        p.energy -= 3; p.atkCd = 0.42 / rate;
        const splash = 24 * (p.wl >= 3 ? 1.4 : 1) * (s.unique ? 1.3 : 1);
        const o = { splash, r: 4, ignite: s.unique, frag: p.wl >= 5 };
        this.pshoot(p, 'fire', a, 190, 17, o);
        for (let i = 1; i <= ms; i++) for (const sg of [-1, 1]) this.pshoot(p, 'fire', a + sg * 0.18 * i, 190, 13, o);
        break;
      }
      case 'cleric': {
        p.atkCd = 0.28 / rate;
        const o = { pierce: 2 + (p.wl >= 3 ? 1 : 0), heal: 1 + (p.wl >= 3 ? 1 : 0), home: p.wl >= 5, chain: s.unique };
        this.pshoot(p, 'holy', a, 220, 10, o);
        for (let i = 1; i <= ms; i++) for (const sg of [-1, 1]) this.pshoot(p, 'holy', a + sg * 0.15 * i, 220, 8, o);
        break;
      }
    }
    if (s.iceShards && p.atkCount % s.iceShards === 0) for (let i = 0; i < 8; i++) this.pshoot(p, 'shard', i * TAU / 8, 200, 8, { fx: 'slow', proc: false, life: 0.8 });
    if (s.holyShot && p.atkCount % s.holyShot === 0) this.pshoot(p, 'hbolt', a, 180, 14, { home: true, heal: 2, life: 2.5 });
    this.ev({ k: 'snd', s: 'atk_' + p.cls });
  }

  skill(p) {
    const c = CLASSES[p.cls], s = p.st;
    p.energy -= c.skillCost; p.skillCd = c.skillCd * s.skillCd;
    this.ev({ k: 'skill', i: p.id, c: p.cls, x: r1(p.x), y: r1(p.y) });
    switch (p.cls) {
      case 'knight': p.spinT = 2.2; p.spinTick = 0; break;
      case 'ranger':
        for (let i = -6; i <= 6; i++) this.pshoot(p, 'arrow', p.aim + i * 0.1, 300, 15, { pierce: 1 });
        break;
      case 'mage':
        for (const e of this.enemies) {
          if (e.dead || e.under || dist(e, p) > 90 + e.r) continue;
          this.hurtEnemy(e, this.pdmg(p, 32, e), p, null);
          if (e.boss) { e.frozen = Math.max(e.frozen, 0.8); e.stagger += 40; } else e.frozen = 2.8;
        }
        this.ev({ k: 'nova', x: r1(p.x), y: r1(p.y) });
        break;
      case 'cleric':
        for (const q of this.players.values()) {
          if (q.dead || dist(q, p) > 110) continue;
          if (q.downed) this.revivePlayer(q, 0.5); else this.heal(q, 45);
          q.shield = q.maxShield; q.inv = Math.max(q.inv, 1.5);
          this.ev({ k: 'heal', x: r1(q.x), y: r1(q.y), v: 45 });
        }
        this.ev({ k: 'holy', x: r1(p.x), y: r1(p.y) });
        break;
    }
    if (s.skillMeteor) {
      const live = this.enemies.filter(e => !e.dead && !e.under);
      for (let i = 0; i < s.skillMeteor; i++) {
        const t = live.length ? pick(live) : p;
        this.zones.push({ k: 'met', x: t.x + rand(-10, 10), y: t.y + rand(-10, 10), r: 30, t: 0.7 + i * 0.12, d: 0.7 + i * 0.12, owner: p.id });
      }
    }
    if (s.thunderSkill) {
      for (const e of this.enemies) if (!e.dead && !e.under) {
        this.hurtEnemy(e, this.pdmg(p, 25, e), p, null, { proc: false, col: 4 });
        if (!e.boss) e.stunT = 0.8;
        this.ev({ k: 'zap', pts: [[r1(e.x + rand(-20, 20)), r1(e.y - 120)], [r1(e.x), r1(e.y)]] });
      }
      this.ev({ k: 'shake', v: 5 });
    }
    if (s.skillHealTeam) for (const q of this.players.values()) if (this.isUp(q)) { this.heal(q, q.maxhp * 0.25); this.ev({ k: 'heal', x: r1(q.x), y: r1(q.y), v: Math.round(q.maxhp * 0.25) }); }
  }

  hurtRaw(p, dmg) {
    if (!this.isUp(p)) return;
    dmg *= 1 - p.st.dr;
    const s = Math.min(p.shield, dmg); p.shield -= s; p.hp -= dmg - s;
    if (p.hp <= 0) this.goDown(p);
  }
  hurtPlayer(p, dmg, fx = null) {
    if (!this.isUp(p) || p.dodgeT > 0 || p.inv > 0) return false;
    const s = p.st;
    if (p.spinT > 0) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg * (1 - s.dr)));
    p.hitT = 0; p.flash = 0.15; p.inv = 0.45;
    const hadShield = p.shield > 0;
    const sh = Math.min(p.shield, dmg); p.shield -= sh; p.hp -= dmg - sh;
    this.ev({ k: 'phit', x: r1(p.x), y: r1(p.y), v: dmg, i: p.id });
    if (fx === 'slow') p.slowT = 2; else if (fx === 'burn') p.burnT = 3; else if (fx === 'poison') p.poisT = 4;
    if (s.thorns) for (const e of this.enemies) if (!e.dead && !e.under && dist(e, p) < 48 + e.r) this.hurtEnemy(e, this.pdmg(p, s.thorns, e), p, null, { proc: false, noCrit: true });
    if (s.frostArmor && p.frostCd <= 0) {
      p.frostCd = 4;
      for (const e of this.enemies) if (!e.dead && dist(e, p) < 64) e.frozen = Math.max(e.frozen, e.boss ? 0.5 : 1.6);
      this.ev({ k: 'nova', x: r1(p.x), y: r1(p.y), r: 64 });
    }
    if (s.shieldNova && hadShield && p.shield <= 0) this.blast(p, p.x, p.y, 64, 40, 'steel');
    if (p.hp <= 0) this.goDown(p);
    return true;
  }
  goDown(p) {
    const s = p.st;
    if (s.lastStand && p.lastStandCd <= 0) { p.hp = 1; p.lastStandCd = 20; p.inv = 1; this.text(`${p.name} 的鋼鐵意志抵擋了致命一擊！`, '#c0cadf'); return; }
    if (s.guardian && !p.guardianUsed) { p.guardianUsed = true; p.hp = Math.ceil(p.maxhp * 0.5); p.inv = 2; this.text(`守護天使庇佑了 ${p.name}！`, '#fff0a0'); this.ev({ k: 'holy', x: r1(p.x), y: r1(p.y) }); return; }
    if (p.lives > 0) { p.lives--; p.hp = Math.ceil(p.maxhp * 0.5); p.inv = 2; this.dirty = true; this.text(`${p.name} 以不屈意志復活！`, '#ffd34d'); this.ev({ k: 'holy', x: r1(p.x), y: r1(p.y) }); return; }
    p.hp = 0; p.downed = true; p.bleed = 20; p.revive = 0; p.spinT = 0;
    this.text(`${p.name} 倒地了！站在旁邊救援！`, '#ff8a5c'); this.ev({ k: 'snd', s: 'down' });
  }

  // ---------- 對敵傷害 ----------
  hurtEnemy(e, dmg, p, a, o = {}) {
    if (e.dead || e.under) return;
    let crit = false;
    if (p && !o.noCrit) { crit = p.dodgeCritT > 0 || Math.random() < p.st.crit; if (crit) dmg *= p.st.critDmg; }
    if (e.boss && e.stun > 0) dmg *= 1.5;
    if (e.armor) dmg *= 1 - e.armor;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.1;
    if (p) { p.dmgDealt += dmg; if (p.st.lifesteal) this.heal(p, dmg * p.st.lifesteal); }
    if (e.boss) e.stagger += dmg;
    else if (o.kb !== 0 && a != null && e.st !== 'dash' && !e.elite) { const kb = o.kb || 40; this.moveEnt(e, Math.cos(a) * kb * 0.05, Math.sin(a) * kb * 0.05); }
    this.ev({ k: 'hit', x: r1(e.x), y: r1(e.y - e.r), v: dmg, c: crit ? 1 : o.col || 0 });
    if (o.fx === 'slow') e.slowT = Math.max(e.slowT, 2);
    if (o.ignite && p) this.ignite(e, p);
    if (p && o.proc !== false) this.procs(p, e, crit);
    if (e.hp <= 0) return this.killEnemy(e, p);
    if (p && p.st.execute && !e.boss && e.hp < e.maxhp * p.st.execute) { this.ev({ k: 'exec', x: r1(e.x), y: r1(e.y) }); this.killEnemy(e, p); }
  }
  ignite(e, p) {
    e.burnT = 3; e.burnOwner = p.id;
    e.burnDps = Math.max(e.burnDps || 0, 6 * p.st.burnDmg * p.st.dmg * (1 + 0.12 * (p.wl - 1)));
  }
  poisonE(e, p, n) {
    if (e.dead) return;
    e.poison = Math.min(p.st.poisonMax, (e.poison || 0) + n); e.poisonT = 4; e.poisonOwner = p.id;
    e.poisonDps = 2.5 * p.st.poisonDmg * p.st.dmg;
    if (p.st.poisonBurst && e.poison >= 10) { e.poison = 0; this.blast(p, e.x, e.y, 46, 60 * p.st.poisonDmg, 'poison'); }
  }
  procs(p, e, crit) {
    const s = p.st;
    if (s.burnChance && Math.random() < s.burnChance) this.ignite(e, p);
    if (s.slowChance && Math.random() < s.slowChance) {
      e.slowT = Math.max(e.slowT, s.slowDur);
      if (s.freezeChance && Math.random() < s.freezeChance) e.frozen = Math.max(e.frozen, e.boss ? 0.6 : 1.5);
    }
    if (s.poisonChance && Math.random() < s.poisonChance) this.poisonE(e, p, 1);
    if (s.chainChance && Math.random() < s.chainChance) this.chain(p, e, this.pdmg(p, 14 * s.chainDmg, null), s.chainCount);
    if (s.curse) { e.vulnT = 3; e.vuln = s.curse; }
    if (crit && s.windBlades && !e.dead) this.pshoot(p, 'wind', Math.atan2(e.y - p.y, e.x - p.x) + rand(-0.6, 0.6), 240, 12, { home: true, proc: false, pierce: 1 });
  }
  chain(p, from, dmg, n) {
    const pts = [[r1(from.x), r1(from.y)]], hit = new Set([from.id]);
    let cur = from;
    for (let i = 0; i < n; i++) {
      let best = null, bd = 95 * 95;
      for (const e of this.enemies) if (!e.dead && !e.under && !hit.has(e.id)) { const d = d2(e, cur); if (d < bd) { bd = d; best = e; } }
      if (!best) break;
      hit.add(best.id);
      pts.push([r1(best.x), r1(best.y)]);
      this.hurtEnemy(best, dmg, p, null, { proc: false, noCrit: true, col: 4 });
      if (p.st.paralyze && !best.boss) best.stunT = 0.6;
      cur = best;
    }
    if (pts.length > 1) this.ev({ k: 'zap', pts });
  }
  blast(p, x, y, r, base, kind) {
    for (const e of this.enemies) if (!e.dead && !e.under && Math.hypot(e.x - x, e.y - y) < r + e.r) this.hurtEnemy(e, this.pdmg(p, base, e), p, Math.atan2(e.y - y, e.x - x), { proc: false, noCrit: true, kb: 60 });
    this.ev({ k: 'boom', x: r1(x), y: r1(y), r, c: kind });
  }

  killEnemy(e, p) {
    if (e.dead) return;
    e.dead = true; e.hp = 0;
    this.ev({ k: 'die', x: r1(e.x), y: r1(e.y), t: e.type });
    if (e.boss) return this.bossDown(e);
    const ow = p || this.players.get(e.burnOwner) || this.players.get(e.poisonOwner);
    if (p) {
      p.kills++;
      if (p.st.killHeal) this.heal(p, p.st.killHeal);
      if (p.st.frenzy) p.frenzyT = 2.5;
      if (p.st.shadowKnife) for (let i = 0; i < 4; i++) this.shoot('p', p.id, 'knife', e.x, e.y, i * TAU / 4 + rand(0, 1), 220, 10, { proc: false, pierce: 1, life: 0.7 });
    }
    if (ow) {
      if (e.burnT > 0 && ow.st.burnExplode) this.blast(ow, e.x, e.y, 36, 22, 'fire');
      if (e.frozen > 0 && ow.st.shatter) this.blast(ow, e.x, e.y, 42, 26, 'ice');
      if (e.poison > 0 && ow.st.poisonSpread) for (const o of this.enemies) if (!o.dead && o !== e && dist(o, e) < 64) this.poisonE(o, ow, e.poison);
    }
    const D = ENEMIES[e.type];
    if (D.split) for (let i = 0; i < D.split.n; i++) {
      const c = this.createEnemy(D.split.t, e.x + rand(-6, 6), e.y + rand(-6, 6));
      c.inv = 0.3;
    }
    const nc = randi(1, 2) + (e.elite ? 5 : 0);
    for (let i = 0; i < nc; i++) this.drop('coin', e.x, e.y);
    const r = Math.random();
    if (r < (e.elite ? 0.45 : 0.07)) this.drop('hp', e.x, e.y); else if (r < 0.22) this.drop('en', e.x, e.y);
  }
  drop(k, x, y) { this.pickups.push({ id: this.id(), k, x: x + rand(-6, 6), y: y + rand(-6, 6) }); }

  bossDown(e) {
    this.boss = null; this.bossKills++;
    for (const o of this.enemies) if (!o.dead) { o.dead = true; this.ev({ k: 'die', x: r1(o.x), y: r1(o.y), t: o.type }); }
    this.projs = this.projs.filter(p => p.team === 'p'); this.hazards = []; this.spawns = []; this.zones = this.zones.filter(z => z.k !== 'pool');
    this.ev({ k: 'shake', v: 12 }); this.ev({ k: 'snd', s: 'victory' });
    if (this.chapter >= CHAPTERS.length) return this.endRun(true);
    this.text(`討伐成功！擊敗了 ${e.name}`, '#ffd34d');
    this.phase = 'explore';
    for (let i = 0; i < 24; i++) this.drop('coin', e.x + rand(-24, 24), e.y + rand(-24, 24));
    for (const p of this.players.values()) { p.cq.push('rare'); if (this.isUp(p)) this.heal(p, p.maxhp * 0.5); }
  }

  // ================= 敵人 =================
  createEnemy(type, x, y, o = {}) {
    const B = BOSSES[type], D = B || ENEMIES[type];
    const np = Math.max(1, this.players.size), d = this.diff();
    let hp = B ? D.hp * (1 + 0.6 * (np - 1)) : D.hp * (1 + 0.09 * (d - 1)) * (1 + 0.25 * (np - 1));
    const e = { id: this.id(), type, x, y, r: D.r, hp, maxhp: hp, sp: D.sp * (1 + 0.008 * d), dmg: D.dmg * (1 + 0.035 * (d - 1)),
      boss: !!B, ai: B ? 'boss' : D.ai, armor: D.armor || 0, st: 'idle', t: rand(0.3, 1.2), cd: rand(0.8, 2), cd2: rand(1, 2.5),
      frozen: 0, flash: 0, a: 0, stun: 0, stagger: 0, wob: rand(0, 6.28), z: 0, atk: null, slowT: 0, vulnT: 0, stunT: 0,
      poison: 0, burnT: 0, poisonT: 0, dotT: 0.5, face: 0, scale: D.scale || 1, under: false };
    if (o.elite && !B) { e.elite = true; e.hp *= 3.2; e.dmg *= 1.25; e.r *= 1.2; e.scale *= 1.3; e.sp *= 1.08; }
    e.hp = Math.round(e.hp); e.maxhp = e.hp;
    if (B) { e.staggerMax = Math.round(e.maxhp * 0.1); e.t = 1.5; e.name = D.n; e.sa = 0; this.boss = e; }
    if (e.ai === 'burrow') { e.st = 'up'; e.t = 1.5; }
    this.enemies.push(e);
    return e;
  }

  separate() {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (a.dead || b.dead || a.under || b.under) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0.01 && d < m) {
        const push = (m - d) / 2, nx = dx / d, ny = dy / d;
        if (!a.boss) this.moveEnt(a, -nx * push, -ny * push);
        if (!b.boss) this.moveEnt(b, nx * push, ny * push);
      }
    }
  }
  contact(e, mul = 1, fx = null) {
    for (const p of this.players.values()) if (this.isUp(p) && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 1) this.hurtPlayer(p, e.dmg * mul, fx);
  }
  moveE(e, a, sp, dt) {
    const dx = Math.cos(a) * sp * dt, dy = Math.sin(a) * sp * dt;
    if (ENEMIES[e.type] && ENEMIES[e.type].phase) this.moveFree(e, dx, dy); else return this.moveEnt(e, dx, dy);
    return false;
  }
  fire(e, s, a) {
    const n = s.n || 1, dmg = e.dmg * (s.m || 0.9);
    for (let i = 0; i < n; i++) {
      const ang = s.ring ? a + i * TAU / n : a + (n === 1 ? 0 : (i - (n - 1) / 2) * (s.spr || 0.2));
      this.shoot('e', e.id, s.k, e.x, e.y, ang, s.v, dmg, { fx: s.fx, life: s.life || 2.6, r: s.k === 'fireball' ? 5 : 3 });
    }
  }
  enemyBlast(e, r, dmg, fx) {
    for (const p of this.players.values()) if (this.isUp(p) && dist(p, e) < r + p.r) this.hurtPlayer(p, dmg, fx);
    this.ev({ k: 'boom', x: r1(e.x), y: r1(e.y), r, c: fx === 'burn' ? 'fire' : 'enemy' }); this.ev({ k: 'shake', v: 4 });
  }

  updateEnemy(e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    // 狀態傷害
    if (e.burnT > 0 || e.poisonT > 0) {
      e.dotT -= dt;
      if (e.dotT <= 0) {
        e.dotT = 0.5;
        if (e.burnT > 0) this.hurtEnemy(e, e.burnDps * 0.5, this.players.get(e.burnOwner), null, { proc: false, noCrit: true, kb: 0, col: 2 });
        if (!e.dead && e.poisonT > 0 && e.poison > 0) this.hurtEnemy(e, e.poisonDps * e.poison * 0.5, this.players.get(e.poisonOwner), null, { proc: false, noCrit: true, kb: 0, col: 3 });
        if (e.dead) return;
      }
      e.burnT -= dt; e.poisonT -= dt; if (e.poisonT <= 0) e.poison = 0;
    }
    e.slowT -= dt; e.vulnT -= dt;
    if (e.frozen > 0) { e.frozen -= dt; if (!e.boss) return; }
    if (e.stunT > 0) { e.stunT -= dt; return; }
    const tgt = this.nearestUp(e);
    if (!tgt) return;
    const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
    e.a = a; e.cd -= dt; e.cd2 -= dt;
    if (e.boss) { if (e.frozen > 0) return; this.updateBoss(e, tgt, d, a, dt); return; }
    const D = ENEMIES[e.type], sp = e.sp * (e.slowT > 0 ? 0.55 : 1);
    const canSee = () => D.phase || this.los(e.x, e.y, tgt.x, tgt.y);
    const kite = (near, far) => {
      let sa = a, k = 1;
      if (d < near) k = -1; else if (d < far) { sa = a + (e.id % 2 ? 1 : -1) * Math.PI / 2; k = 0.5; }
      this.moveE(e, sa, sp * k, dt);
    };
    switch (D.ai) {
      case 'chase': this.moveE(e, a, sp, dt); break;
      case 'hop': {
        e.t -= dt; if (e.t < 0) e.t = 1.1;
        const hop = e.t < 0.45; e.st = hop ? 'hop' : 'idle';
        if (hop) this.moveE(e, a, sp * 2.2, dt);
        break;
      }
      case 'fly': e.wob += dt * 6; this.moveE(e, a + Math.sin(e.wob) * 0.9, sp, dt); break;
      case 'kite':
        kite(75, 140);
        if (e.cd <= 0 && d < 230 && canSee()) { e.cd = D.shot.cd * rand(0.85, 1.15); this.fire(e, D.shot, a); }
        break;
      case 'caster':
        if (d > 60) this.moveE(e, a, sp, dt);
        if (e.cd <= 0 && d < 220) { e.cd = D.shot.cd * rand(0.9, 1.1); this.fire(e, D.shot, a); }
        break;
      case 'turret':
        if (e.cd <= 0 && d < 260 && canSee()) { e.cd = D.shot.cd * rand(0.9, 1.1); this.fire(e, D.shot, a); }
        break;
      case 'charge':
        if (e.st === 'wind') { e.t -= dt; if (e.t <= 0) { e.st = 'dash'; e.t = 0.5; } }
        else if (e.st === 'dash') {
          e.t -= dt;
          const b = this.moveEnt(e, Math.cos(e.da) * 210 * dt, Math.sin(e.da) * 210 * dt);
          if (e.t <= 0 || b) { e.st = 'rest'; e.t = 0.9; }
        } else if (e.st === 'rest') { e.t -= dt; if (e.t <= 0) e.st = 'idle'; }
        else {
          this.moveE(e, a, sp, dt);
          if (d < 110 && e.cd <= 0 && canSee()) {
            e.st = 'wind'; e.t = 0.65; e.da = a; e.cd = 3;
            this.hazards.push({ id: this.id(), k: 'line', x: e.x, y: e.y, a, len: this.rayLen(e.x, e.y, a, 120), w: 16 * e.scale, delay: 0.65, t: 0, dmg: 0 });
          }
        }
        break;
      case 'mortar':
        kite(110, 170);
        if (e.cd <= 0 && d < 240) {
          e.cd = (D.cd || 3) * rand(0.9, 1.1);
          const x = tgt.x + rand(-8, 8), y = tgt.y + rand(-8, 8);
          this.hazards.push({ id: this.id(), k: 'circle', x, y, r: 26, delay: 1.1, t: 0, dmg: e.dmg, fx: D.fx || null });
          this.ev({ k: 'lob', x1: r1(e.x), y1: r1(e.y), x2: r1(x), y2: r1(y), t: 1.1 });
        }
        break;
      case 'exploder':
        if (e.fuse != null) {
          e.fuse -= dt; e.st = 'fuse';
          if (e.fuse <= 0) { this.enemyBlast(e, D.boom || 36, e.dmg, D.fx); this.killEnemy(e, null); }
          return;
        }
        this.moveE(e, a, sp, dt);
        if (d < 24) { e.fuse = 0.6; this.ev({ k: 'snd', s: 'fuse' }); }
        return;
      case 'summoner':
        kite(110, 170);
        if (e.cd <= 0) {
          e.cd = 5.5;
          if (this.enemies.length < 16) for (let i = 0; i < 2; i++) {
            const x = e.x + rand(-24, 24), y = e.y + rand(-24, 24);
            if (!this.collides(x, y, 6)) this.spawns.push({ x, y, type: pick(D.sum), t: 0.9 });
          }
        }
        break;
      case 'healer':
        kite(100, 160);
        if (e.cd2 <= 0) {
          e.cd2 = 3.5;
          for (const o of this.enemies) if (!o.dead && !o.boss && o !== e && dist(o, e) < 100) o.hp = Math.min(o.maxhp, o.hp + o.maxhp * 0.2);
          this.ev({ k: 'ehealfx', x: r1(e.x), y: r1(e.y) });
        }
        if (e.cd <= 0 && canSee()) { e.cd = D.shot.cd; this.fire(e, D.shot, a); }
        break;
      case 'shield':
        e.face += clamp(angDiff(a, e.face), -2.2 * dt, 2.2 * dt);
        this.moveE(e, a, sp, dt);
        break;
      case 'blink':
        if (e.st === 'fade') {
          e.t -= dt;
          if (e.t <= 0) {
            for (let t = 0; t < 12; t++) {
              const ang = rand(0, TAU), rr = rand(70, 100), x = tgt.x + Math.cos(ang) * rr, y = tgt.y + Math.sin(ang) * rr;
              if (!this.collides(x, y, e.r)) { this.ev({ k: 'blink', x: r1(e.x), y: r1(e.y) }); e.x = x; e.y = y; break; }
            }
            e.st = 'appear'; e.t = 0.3;
          }
          return;
        } else if (e.st === 'appear') { e.t -= dt; if (e.t <= 0) { this.fire(e, D.shot, a); e.st = 'idle'; } }
        else {
          kite(80, 150);
          if (e.cd <= 0) { e.cd = D.shot.cd * rand(1, 1.3) + 1; e.st = 'fade'; e.t = 0.45; }
        }
        break;
      case 'burrow':
        e.t -= dt;
        if (e.st === 'under') {
          this.moveEnt(e, Math.cos(a) * sp * 1.1 * dt, Math.sin(a) * sp * 1.1 * dt);
          if (e.t <= 0) { e.st = 'rise'; e.t = 0.6; this.hazards.push({ id: this.id(), k: 'circle', x: e.x, y: e.y, r: 22, delay: 0.6, t: 0, dmg: e.dmg, fx: D.shot.fx }); }
          return;
        } else if (e.st === 'rise') {
          if (e.t <= 0) { e.under = false; e.st = 'up'; e.t = 2.2; this.fire(e, D.shot, rand(0, 1)); }
          return;
        } else {
          if (e.cd <= 0 && canSee()) { e.cd = 1.1; this.fire(e, { ...D.shot, n: 1, ring: 0 }, a); }
          if (e.t <= 0) { e.st = 'under'; e.under = true; e.t = 2.4; this.ev({ k: 'dust', x: r1(e.x), y: r1(e.y) }); }
        }
        break;
      case 'laser':
        this.moveE(e, a + Math.PI / 2, sp * 0.5, dt);
        if (e.cd <= 0 && d < 300) {
          e.cd = rand(3, 4);
          this.hazards.push({ id: this.id(), k: 'line', x: e.x, y: e.y, a, len: this.rayLen(e.x, e.y, a, 420), w: 12, delay: 1.0, t: 0, dmg: e.dmg });
        }
        break;
      case 'orbit': {
        const th = Math.atan2(e.y - tgt.y, e.x - tgt.x) + (e.id % 2 ? 0.6 : -0.6);
        const tx = tgt.x + Math.cos(th) * 85, ty = tgt.y + Math.sin(th) * 85;
        this.moveE(e, Math.atan2(ty - e.y, tx - e.x), sp, dt);
        if (e.cd <= 0 && canSee()) { e.cd = D.shot.cd * rand(0.9, 1.2); this.fire(e, D.shot, a); }
        break;
      }
      case 'leap':
        if (e.st === 'leap') {
          e.t += dt;
          const k = Math.min(1, e.t / 0.7);
          e.x = e.sx + (e.tx - e.sx) * k; e.y = e.sy + (e.ty - e.sy) * k; e.z = Math.sin(k * Math.PI) * 16;
          if (k >= 1) { e.st = 'idle'; e.z = 0; e.cd2 = rand(2, 3); }
          return;
        }
        this.moveE(e, a, sp * 0.6, dt);
        if (e.cd2 <= 0 && d < 130 && canSee()) {
          e.st = 'leap'; e.t = 0; e.sx = e.x; e.sy = e.y; e.tx = tgt.x; e.ty = tgt.y;
          this.hazards.push({ id: this.id(), k: 'circle', x: tgt.x, y: tgt.y, r: 20, delay: 0.7, t: 0, dmg: e.dmg });
        } else if (e.cd <= 0 && D.shot && d < 200 && canSee()) { e.cd = D.shot.cd; this.fire(e, D.shot, a); }
        break;
      case 'mimic':
        this.moveE(e, a, sp, dt);
        if (e.cd <= 0) { e.cd = 2.5; this.fire(e, { k: 'rock', n: 10, ring: 1, v: 110 }, a); }
        break;
    }
    this.contact(e, e.st === 'dash' ? 1.4 : 1, D.fx);
  }

  // ---------- 頭目 ----------
  updateBoss(e, tgt, d, a, dt) {
    if (e.stun > 0) { e.stun -= dt; e.st = 'stun'; e.z = 0; return; }
    if (e.stagger >= e.staggerMax) {
      e.stagger = 0; e.stun = 2.6; e.st = 'stun'; e.atk = null; e.z = 0; e.t = 0.8;
      this.text('破綻！頭目倒地，集中火力！', '#ffd34d'); this.ev({ k: 'shake', v: 6 }); this.ev({ k: 'snd', s: 'stun' });
      return;
    }
    const rage = e.hp < e.maxhp * 0.5;
    if (rage && !e.raged) { e.raged = true; e.staggerMax = Math.round(e.staggerMax * 1.3); this.text(`${e.name} 憤怒了！攻擊變得更猛烈`, '#ff5555'); this.ev({ k: 'shake', v: 6 }); this.ev({ k: 'snd', s: 'roar' }); }
    const sp = rage ? 1.3 : 1;
    if (!e.atk) {
      e.t -= dt * sp; e.st = 'walk';
      if (d > 40) this.moveEnt(e, Math.cos(a) * e.sp * dt, Math.sin(a) * e.sp * dt);
      if (e.t <= 0) { e.atk = pick(BOSSES[e.type].atks); e.at = 0; e.ph = 0; e.st = e.atk; this.beginAttack(e, tgt, a, sp); }
      this.contact(e);
      return;
    }
    const sdt = dt * sp;
    e.at += sdt;
    this.runAttack(e, tgt, a, sdt);
    if (e.st !== 'jump') this.contact(e, e.st === 'dash' ? 1.4 : 1);
  }
  endAttack(e) { e.atk = null; e.st = 'walk'; e.z = 0; e.t = e.raged ? rand(0.6, 1.0) : rand(1.0, 1.6); }
  hz(o) { this.hazards.push({ id: this.id(), t: 0, dmg: 0, ...o }); }

  beginAttack(e, tgt, a, sp) {
    const R = this.room, ups = this.ups();
    switch (e.atk) {
      case 'slam': case 'leap':
        e.sx = e.x; e.sy = e.y; e.tx = tgt.x; e.ty = tgt.y;
        this.hz({ k: 'circle', x: tgt.x, y: tgt.y, r: 46, delay: 1 / sp, dmg: e.dmg * 1.3 });
        this.ev({ k: 'snd', s: 'jump' });
        break;
      case 'charge':
        e.da = a;
        this.hz({ k: 'line', x: e.x, y: e.y, a, len: this.rayLen(e.x, e.y, a, 420), w: 30, delay: 0.8 / sp });
        this.ev({ k: 'snd', s: 'roar' });
        break;
      case 'breath':
        e.da = a; e.ft = 0;
        this.hz({ k: 'cone', x: e.x, y: e.y, a, r: 150, s: 0.5, delay: 0.6 / sp });
        break;
      case 'meteor': case 'poisonRain': case 'voidZones': {
        const fx = e.atk === 'poisonRain' ? 'poison' : e.atk === 'meteor' ? 'burn' : null;
        const per = e.atk === 'voidZones' ? 3 : 2;
        for (const p of ups) for (let i = 0; i < per; i++)
          this.hz({ k: 'circle', x: p.x + rand(-16, 16), y: p.y + rand(-16, 16), r: e.atk === 'voidZones' ? 34 : 30, delay: (1.2 + i * 0.35) / sp, dmg: e.dmg * 1.1, fx, pool: e.atk === 'poisonRain' });
        for (let i = 0; i < 4; i++) { const q = this.randFloor(2); this.hz({ k: 'circle', x: q.x, y: q.y, r: 30, delay: rand(1.2, 1.8) / sp, dmg: e.dmg * 1.1, fx, pool: e.atk === 'poisonRain' }); }
        this.ev({ k: 'snd', s: 'roar' });
        break;
      }
      case 'spiral': case 'hell': e.ft = 0; e.sa = a; e.dir = Math.random() < 0.5 ? 1 : -1; break;
      case 'summon': case 'brood': case 'summonEyes': {
        const type = e.atk === 'brood' ? 'spiderling' : e.atk === 'summonEyes' ? 'voidEye' : pick(['iceSkel', 'frostGhost']);
        const n = e.atk === 'summonEyes' ? 2 : e.atk === 'brood' ? 2 + this.players.size : 2 + Math.floor(this.players.size / 2);
        if (this.enemies.length < 10) for (let i = 0; i < n; i++) {
          const ang = i * TAU / n, x = e.x + Math.cos(ang) * 40, y = e.y + Math.sin(ang) * 40;
          if (!this.collides(x, y, 6)) this.spawns.push({ x, y, type, t: 0.9 });
        }
        this.text(`${e.name} 召喚了手下！`, '#c9a7ff');
        break;
      }
      case 'lasers': {
        const angs = ups.map(p => Math.atan2(p.y - e.y, p.x - e.x));
        if (e.raged) angs.push(rand(0, TAU), rand(0, TAU));
        for (const la of angs) this.hz({ k: 'line', x: e.x, y: e.y, a: la, len: this.rayLen(e.x, e.y, la, 420), w: 14, delay: 1.0 / sp, dmg: e.dmg * 1.4 });
        break;
      }
      case 'sweep': {
        const dir = Math.random() < 0.5 ? 1 : -1, a0 = a - dir * 1.4;
        for (let i = 0; i < 16; i++) { const la = a0 + dir * i * 0.2; this.hz({ k: 'line', x: e.x, y: e.y, a: la, len: this.rayLen(e.x, e.y, la, 420), w: 16, delay: (0.8 + i * 0.07) / sp, dmg: e.dmg * 1.1 }); }
        this.ev({ k: 'snd', s: 'roar' });
        break;
      }
    }
  }

  runAttack(e, tgt, a, dt) {
    const R = this.room;
    switch (e.atk) {
      case 'slam': case 'leap': {
        const k = Math.min(1, e.at / 1.0);
        e.st = 'jump';
        e.x = e.sx + (e.tx - e.sx) * k; e.y = e.sy + (e.ty - e.sy) * k; e.z = Math.sin(k * Math.PI) * 34;
        if (k >= 1) {
          if (e.atk === 'slam') this.fire(e, { k: 'rock', n: 10, ring: 1, v: 110, m: 0.6 }, rand(0, 1));
          else for (let i = 0; i < 3; i++) this.zones.push({ k: 'pool', x: e.x + rand(-30, 30), y: e.y + rand(-30, 30), r: 22, t: 5, tick: 0 });
          this.ev({ k: 'shake', v: 7 }); this.endAttack(e);
        }
        break;
      }
      case 'ring':
        e.st = 'cast';
        if (e.ph < 3 && e.at >= 0.3 + e.ph * 0.5) { this.fire(e, { k: 'rock', n: 14, ring: 1, v: 105, m: 0.6 }, e.ph * 0.22); e.ph++; this.ev({ k: 'snd', s: 'boom' }); }
        if (e.at >= 1.8) this.endAttack(e);
        break;
      case 'charge':
        if (e.at < 0.8) { e.st = 'wind'; break; }
        e.st = 'dash';
        if (this.moveEnt(e, Math.cos(e.da) * 260 * dt, Math.sin(e.da) * 260 * dt)) {
          this.fire(e, { k: 'rock', n: 8, ring: 1, v: 100, m: 0.5 }, 0);
          this.endAttack(e); e.stun = 1.6;
          this.text(`${e.name} 撞上牆壁暈眩了！`, '#ffd34d'); this.ev({ k: 'shake', v: 9 }); this.ev({ k: 'snd', s: 'boom' });
        } else if (e.at > 2.4) this.endAttack(e);
        break;
      case 'breath':
        if (e.at < 0.6) { e.st = 'wind'; break; }
        e.st = 'cast';
        e.da += clamp(angDiff(a, e.da), -0.9 * dt, 0.9 * dt);
        e.ft -= dt;
        while (e.ft <= 0) { e.ft += 0.045; this.shoot('e', e.id, 'efire', e.x, e.y, e.da + rand(-0.4, 0.4), rand(130, 170), e.dmg * 0.35, { life: 0.9, fx: 'burn' }); }
        if (e.at >= 2.0) this.endAttack(e);
        break;
      case 'spread':
        e.st = 'cast';
        if (e.ph < 3 && e.at >= 0.2 + e.ph * 0.5) { this.fire(e, { k: 'fireball', n: 5, spr: 0.22, v: 135, m: 0.7 }, a); e.ph++; this.ev({ k: 'snd', s: 'fireball' }); }
        if (e.at >= 1.6) this.endAttack(e);
        break;
      case 'web':
        e.st = 'cast';
        if (e.ph < 3 && e.at >= 0.2 + e.ph * 0.4) { this.fire(e, { k: 'web', n: 7, spr: 0.2, v: 120, m: 0.6, fx: 'slow' }, a); e.ph++; }
        if (e.at >= 1.4) this.endAttack(e);
        break;
      case 'frostNova':
        e.st = 'cast';
        if (e.ph < 3 && e.at >= 0.3 + e.ph * 0.5) { this.fire(e, { k: 'ice', n: 16, ring: 1, v: 95, m: 0.55, fx: 'slow' }, e.ph * 0.2); e.ph++; }
        if (e.at >= 1.8) this.endAttack(e);
        break;
      case 'meteor': case 'poisonRain': case 'voidZones': e.st = 'cast'; if (e.at >= 1.6) this.endAttack(e); break;
      case 'spiral': case 'hell': {
        e.st = 'cast';
        e.ft -= dt;
        const arms = e.atk === 'hell' ? 4 : e.raged ? 3 : 2, kind = e.atk === 'hell' ? 'dark' : 'ice';
        while (e.ft <= 0) {
          e.ft += e.atk === 'hell' ? 0.09 : 0.07; e.sa += 0.27 * e.dir;
          for (let i = 0; i < arms; i++) this.shoot('e', e.id, kind, e.x, e.y, e.sa + i * TAU / arms, 92, e.dmg * 0.5, { life: 3.2 });
          if (e.atk === 'hell' && e.at > 1.5) for (let i = 0; i < arms; i++) this.shoot('e', e.id, kind, e.x, e.y, -e.sa + i * TAU / arms, 80, e.dmg * 0.5, { life: 3.2 });
        }
        if (e.at >= (e.atk === 'hell' ? 3 : 2.8)) this.endAttack(e);
        break;
      }
      case 'summon': case 'brood': case 'summonEyes': e.st = 'cast'; if (e.at >= 1.0) this.endAttack(e); break;
      case 'blink':
        if (e.ph === 0) {
          e.st = 'wind';
          if (e.at >= 0.5) {
            const q = this.randFloor(3, this.ups(), 80);
            this.ev({ k: 'blink', x: r1(e.x), y: r1(e.y) }); e.x = q.x; e.y = q.y;
            this.fire(e, { k: e.type === 'voidlord' ? 'dark' : 'ice', n: e.type === 'voidlord' ? 22 : 18, ring: 1, v: 90, m: 0.5, life: 3 }, rand(0, 1));
            e.ph = 1; this.ev({ k: 'snd', s: 'blink' });
          }
        }
        if (e.at >= 1.1) this.endAttack(e);
        break;
      case 'lasers': e.st = 'cast'; if (e.at >= 1.3) this.endAttack(e); break;
      case 'sweep': e.st = 'cast'; if (e.at >= 2.2) this.endAttack(e); break;
      default: this.endAttack(e);
    }
  }

  // ================= 子彈 / 危險區 / 區域 / 道具 =================
  updateProjs(dt) {
    const out = [];
    for (const pr of this.projs) {
      if (pr.home && pr.team === 'p') {
        let best = null, bd = 160 * 160;
        for (const e of this.enemies) if (!e.dead && !e.under && !pr.hit.includes(e.id)) { const d = (e.x - pr.x) ** 2 + (e.y - pr.y) ** 2; if (d < bd) { bd = d; best = e; } }
        if (best) {
          const sp = Math.hypot(pr.vx, pr.vy), cur = Math.atan2(pr.vy, pr.vx);
          const na = cur + clamp(angDiff(Math.atan2(best.y - pr.y, best.x - pr.x), cur), -5 * dt, 5 * dt);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      let dead = pr.life <= 0 || this.solidAt(pr.x, pr.y);
      if (!dead && pr.team === 'p') {
        const owner = this.players.get(pr.owner);
        for (const e of this.enemies) {
          if (e.dead || e.under || pr.hit.includes(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) >= e.r + pr.r) continue;
          if (e.ai === 'shield' && Math.abs(angDiff(Math.atan2(-pr.vy, -pr.vx), e.face)) < 0.9) {
            this.ev({ k: 'spark', x: r1(pr.x), y: r1(pr.y) }); dead = true; break;
          }
          if (owner) {
            this.hurtEnemy(e, this.pdmg(owner, pr.dmg, e), owner, Math.atan2(pr.vy, pr.vx), { fx: pr.fx, ignite: pr.ignite, proc: pr.proc });
            if (pr.heal) this.healLowest(pr.heal);
            if (pr.chain) this.chain(owner, e, this.pdmg(owner, pr.dmg * 0.6, null), 1);
          }
          if (pr.splash) { dead = true; break; }
          if (pr.pierce > 0) { pr.pierce--; pr.hit.push(e.id); } else { dead = true; break; }
        }
      } else if (!dead) {
        for (const p of this.players.values()) {
          if (!this.isUp(p) || p.dodgeT > 0) continue;
          if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + pr.r) { this.hurtPlayer(p, pr.dmg, pr.fx); dead = true; break; }
        }
      }
      if (dead) {
        const owner = this.players.get(pr.owner);
        if (pr.splash && owner) {
          for (const e of this.enemies) if (!e.dead && !e.under && Math.hypot(e.x - pr.x, e.y - pr.y) < pr.splash + e.r) this.hurtEnemy(e, this.pdmg(owner, pr.dmg * 0.6, e), owner, null, { ignite: pr.ignite, proc: false });
          this.ev({ k: 'boom', x: r1(pr.x), y: r1(pr.y), r: pr.splash, c: 'fire', s: 1 });
          if (pr.frag) for (let i = 0; i < 3; i++) this.shoot('p', pr.owner, 'fire', pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, rand(0, TAU), 150, pr.dmg * 0.4, { splash: 14, r: 3, life: 0.5, ignite: pr.ignite });
        } else if (pr.life > 0) this.ev({ k: 'puff', x: r1(pr.x), y: r1(pr.y), c: pr.k });
      } else out.push(pr);
    }
    this.projs = out;
  }

  updateHazards(dt) {
    const keep = [];
    for (const h of this.hazards) {
      h.t += dt;
      if (h.t < h.delay) { keep.push(h); continue; }
      if (h.dmg > 0) {
        for (const p of this.players.values()) {
          if (!this.isUp(p)) continue;
          const dx = p.x - h.x, dy = p.y - h.y;
          let hit = false;
          if (h.k === 'circle') hit = Math.hypot(dx, dy) < h.r + p.r;
          else if (h.k === 'line') {
            const c = Math.cos(h.a), s = Math.sin(h.a), along = dx * c + dy * s, perp = Math.abs(-dx * s + dy * c);
            hit = along > -p.r && along < h.len + p.r && perp < h.w / 2 + p.r;
          } else if (h.k === 'cone') hit = Math.hypot(dx, dy) < h.r && Math.abs(angDiff(Math.atan2(dy, dx), h.a)) < h.s;
          if (hit) this.hurtPlayer(p, h.dmg, h.fx);
        }
        if (h.k === 'circle') { this.ev({ k: 'boom', x: r1(h.x), y: r1(h.y), r: h.r, c: h.fx === 'poison' ? 'poison' : h.fx === 'burn' ? 'fire' : 'enemy' }); this.ev({ k: 'shake', v: 3 }); }
        else this.ev({ k: 'beam', x: r1(h.x), y: r1(h.y), a: r2(h.a), l: h.len, w: h.w });
        if (h.pool) this.zones.push({ k: 'pool', x: h.x, y: h.y, r: h.r * 0.8, t: 4, tick: 0 });
      }
    }
    this.hazards = keep;
  }

  updateZones(dt) {
    const keep = [];
    for (const z of this.zones) {
      z.t -= dt;
      if (z.k === 'met') {
        if (z.t <= 0) { const p = this.players.get(z.owner); if (p) { this.blast(p, z.x, z.y, z.r, 30, 'fire'); for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - z.x, e.y - z.y) < z.r) this.ignite(e, p); } continue; }
        keep.push(z); continue;
      }
      if (z.t <= 0) continue;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.k === 'pool' ? 0.5 : 0.4;
        if (z.k === 'pool') { for (const p of this.players.values()) if (this.isUp(p) && Math.hypot(p.x - z.x, p.y - z.y) < z.r) p.poisT = Math.max(p.poisT, 2); }
        else {
          const p = this.players.get(z.owner);
          if (p) for (const e of this.enemies) {
            if (e.dead || e.under || Math.hypot(e.x - z.x, e.y - z.y) > z.r + e.r) continue;
            if (z.k === 'fire') { this.hurtEnemy(e, this.pdmg(p, 4, e), p, null, { proc: false, noCrit: true, kb: 0, col: 2 }); this.ignite(e, p); }
            else this.poisonE(e, p, 1);
          }
        }
      }
      keep.push(z);
    }
    this.zones = keep;
  }

  updatePickups(dt) {
    const keep = [];
    for (const pk of this.pickups) {
      let taken = false, best = null, bd = 48;
      for (const p of this.players.values()) {
        if (!this.isUp(p)) continue;
        if (pk.k === 'hp' && p.hp >= p.maxhp) continue;
        if (pk.k === 'en' && p.energy >= p.maxEnergy) continue;
        const d = Math.hypot(p.x - pk.x, p.y - pk.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        if (bd < 7) {
          taken = true;
          if (pk.k === 'coin') this.gold += best.st.goldMul;
          else if (pk.k === 'hp') { this.heal(best, 30); this.ev({ k: 'heal', x: r1(best.x), y: r1(best.y), v: 30 }); }
          else if (pk.k === 'en') best.energy = Math.min(best.maxEnergy, best.energy + 25);
          this.ev({ k: 'snd', s: pk.k === 'coin' ? 'coin' : 'pickup' });
        } else {
          const a = Math.atan2(best.y - pk.y, best.x - pk.x);
          pk.x += Math.cos(a) * 160 * dt; pk.y += Math.sin(a) * 160 * dt;
        }
      }
      if (!taken) keep.push(pk);
    }
    this.pickups = keep;
  }

  usable(o, p) {
    if (o.k === 'chest') return !o.opened;
    if (o.k === 'pedestal') return !o.sold && this.gold >= o.c;
    if (o.k === 'anvil' || o.k === 'altar') return !o.used.includes(p.id);
    return false;
  }
  updateObjs(dt) {
    for (const p of this.players.values()) {
      if (!this.isUp(p) || p.choice) { p.useId = null; p.useT = 0; continue; }
      let tgt = null;
      for (const o of this.objs) if (this.usable(o, p) && Math.hypot(o.x - p.x, o.y - p.y) < 16) tgt = o;
      if (!tgt) { p.useId = null; p.useT = 0; continue; }
      if (p.useId !== tgt.id) { p.useId = tgt.id; p.useT = 0; }
      p.useT += dt;
      if (p.useT >= NEED[tgt.k]) { this.useObj(tgt, p); p.useId = null; p.useT = 0; }
    }
  }
  useObj(o, p) {
    this.dirty = true;
    switch (o.k) {
      case 'chest':
        o.opened = true;
        if (o.trap === 'mimic') {
          o.gone = true;
          const m = this.createEnemy('mimic', o.x, o.y);
          m.inv = 0.5;
          this.text('是寶箱怪！', '#ff5a5a'); this.ev({ k: 'shake', v: 6 }); this.ev({ k: 'snd', s: 'roar' });
        } else if (o.trap === 'gas') {
          for (const q of this.players.values()) if (this.isUp(q) && dist(q, o) < 48) { q.inv = 0; this.hurtPlayer(q, 14 + this.chapter * 4, 'poison'); }
          this.ev({ k: 'boom', x: r1(o.x), y: r1(o.y), r: 48, c: 'poison' });
          this.text('陷阱寶箱！毒氣噴發！', '#8ee04a');
        } else {
          for (let i = 0; i < randi(8, 14); i++) this.drop('coin', o.x, o.y);
          p.cq.push('normal');
          this.ev({ k: 'chest', x: r1(o.x), y: r1(o.y) }); this.ev({ k: 'snd', s: 'chest' });
          this.text(`${p.name} 打開了寶箱！`, '#ffd34d');
        }
        break;
      case 'pedestal':
        this.gold -= o.c; o.sold = true;
        if (o.it === 'potion') { this.heal(p, p.maxhp * 0.5); this.ev({ k: 'heal', x: r1(p.x), y: r1(p.y), v: Math.round(p.maxhp * 0.5) }); }
        else if (o.it === 'boon') p.cq.push('normal');
        else if (o.it === 'cross') p.lives++;
        else if (o.it === 'whet') this.upgradeWeapon(p);
        this.text(`${p.name} 購買了 ${SHOP[o.it].name}`, '#6aff9a'); this.ev({ k: 'snd', s: 'chest' });
        break;
      case 'anvil':
        o.used.push(p.id); this.upgradeWeapon(p);
        break;
      case 'altar':
        o.used.push(p.id);
        p.hp = Math.max(1, p.hp - Math.round(p.maxhp * 0.25));
        p.cq.push('rare');
        this.ev({ k: 'phit', x: r1(p.x), y: r1(p.y), v: Math.round(p.maxhp * 0.25), i: p.id }); this.ev({ k: 'snd', s: 'roar' });
        this.text(`${p.name} 獻上鮮血，獲得強力增幅`, '#ff3a6a');
        break;
    }
    this.objs = this.objs.filter(x => !x.gone);
  }
  upgradeWeapon(p) {
    p.wl++;
    this.ev({ k: 'forge', x: r1(p.x), y: r1(p.y) }); this.ev({ k: 'snd', s: 'forge' });
    const evo = EVO[p.cls][p.wl];
    this.text(`${p.name} 的武器升級到 Lv${p.wl}${evo ? '：' + evo : ''}`, '#8ad0ff');
    this.dirty = true;
  }

  // ================= 快照 =================
  snapshot() {
    const ps = [];
    for (const p of this.players.values()) {
      const c = CLASSES[p.cls];
      ps.push({ i: p.id, n: p.name, c: p.cls, sk: p.skin, x: r1(p.x), y: r1(p.y), a: r2(p.aim), hp: Math.ceil(p.hp), mh: p.maxhp,
        sh: Math.ceil(p.shield), ms: p.maxShield, en: Math.floor(p.energy), dg: p.dodgeT > 0 ? 1 : 0, dn: p.downed ? 1 : 0, dd: p.dead ? 1 : 0,
        rv: r2(p.revive / 2.5), bl: Math.ceil(p.bleed), sk2: r2(Math.max(0, p.skillCd) / (c.skillCd * p.st.skillCd)), sp: p.spinT > 0 ? 1 : 0,
        fl: p.flash > 0 ? 1 : 0, mv: p.moving ? 1 : 0, iv: p.inv > 0 ? 1 : 0, k: p.kills, dm: p.dmgDealt,
        se: (p.slowT > 0 ? 1 : 0) | (p.burnT > 0 ? 2 : 0) | (p.poisT > 0 ? 4 : 0), ob: p.st.orbit, ch: p.choice ? 1 : 0,
        ut: p.useId ? r2(p.useT / NEED[(this.objs.find(o => o.id === p.useId) || {}).k || 'chest']) : 0 });
    }
    const snap = {
      t: 's', st: this.state, ph: this.phase, cp: this.chapter, sg: this.stage, ty: this.stype, g: Math.floor(this.gold), tm: r2(this.time), ps,
      es: this.enemies.map(e => ({ i: e.id, t: e.type, x: r1(e.x), y: r1(e.y), hp: Math.max(0, Math.round(e.hp)), mh: e.maxhp, fz: e.frozen > 0 ? 1 : 0, fl: e.flash > 0 ? 1 : 0,
        st: e.st, a: r2(e.a), z: Math.round(e.z || 0), el: e.elite ? 1 : 0, sc: e.scale,
        se: (e.burnT > 0 ? 1 : 0) | (e.poison > 0 ? 2 : 0) | (e.slowT > 0 ? 4 : 0) | (e.stunT > 0 ? 8 : 0), un: e.under ? 1 : 0, fc: e.ai === 'shield' ? r2(e.face) : undefined })),
      pr: this.projs.map(p => ({ i: p.id, k: p.k, x: r1(p.x), y: r1(p.y), a: r2(Math.atan2(p.vy, p.vx)), e: p.team === 'e' ? 1 : 0 })),
      hz: this.hazards.map(h => ({ k: h.k, x: r1(h.x), y: r1(h.y), r: h.r, a: r2(h.a || 0), l: h.len, w: h.w, s: h.s, p: r2(h.t / h.delay), d: h.dmg > 0 ? 1 : 0, f: h.fx || undefined })),
      zn: this.zones.map(z => ({ k: z.k, x: r1(z.x), y: r1(z.y), r: z.r, p: z.d ? r2(1 - z.t / z.d) : r2(Math.min(1, z.t)) })),
      pk: this.pickups.map(p => ({ i: p.id, k: p.k, x: r1(p.x), y: r1(p.y) })),
      sp: this.spawns.map(s => ({ x: r1(s.x), y: r1(s.y), p: r2(s.t), el: s.el ? 1 : 0 })),
      ob: this.objs.map(o => ({ i: o.id, k: o.k, x: o.x, y: o.y, it: o.it, c: o.c, o: o.opened || o.sold ? 1 : 0, u: o.used, tr: o.trap === 'mimic' ? 1 : 0 })),
      dr: this.doors ? this.doors.map(d => ({ x: d.x, y: d.y, t: d.t })) : null, ds: this.doorSel, dt: r2((this.doorT || 0) / 1.2),
      bo: this.boss ? { n: this.boss.name, hp: Math.max(0, Math.round(this.boss.hp)), mh: this.boss.maxhp, sg: r2(Math.min(1, this.boss.stagger / this.boss.staggerMax)), st: this.boss.stun > 0 ? 1 : 0, rg: this.boss.raged ? 1 : 0 } : null,
      ev: this.events,
    };
    if (this.dirty || this.tick % 30 === 0) {
      this.dirty = false;
      snap.ex = [...this.players.values()].map(p => ({ i: p.id, b: Object.entries(p.boons), wl: p.wl, lv: p.lives, rr: p.rerolls, cq: p.cq.length,
        c: p.choice ? { r: p.choice.r, o: p.choice.o } : null }));
    }
    this.events = [];
    return snap;
  }
}
