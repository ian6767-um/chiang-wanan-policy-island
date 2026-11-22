// 深淵獵團 — 共用遊戲模擬（線上模式在伺服器跑、本機模式在瀏覽器跑）
export const T = 16;
const GRID = 5, CELL = 26;

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const CLASSES = {
  knight: { name: '騎士', hp: 130, shield: 60, speed: 72, regen: 6, skillName: '旋風斬', skillCost: 40, skillCd: 7, color: '#5b8cff',
    desc: '近戰揮砍，可彈開正面的敵方子彈。', skillDesc: '旋轉攻擊周圍敵人 2 秒，期間受到傷害減半。' },
  ranger: { name: '遊俠', hp: 90, shield: 40, speed: 84, regen: 6, skillName: '箭雨', skillCost: 45, skillCd: 6, color: '#4fc35a',
    desc: '高速連射弓箭，機動性最高。', skillDesc: '扇形射出 13 支穿透箭。' },
  mage: { name: '法師', hp: 80, shield: 40, speed: 74, regen: 9, skillName: '冰霜新星', skillCost: 50, skillCd: 8, color: '#a46bff',
    desc: '爆裂火球造成範圍傷害（消耗能量）。', skillDesc: '凍結周圍敵人並造成大量傷害，可累積頭目硬直。' },
  cleric: { name: '牧師', hp: 100, shield: 50, speed: 76, regen: 6, skillName: '聖光庇護', skillCost: 50, skillCd: 10, color: '#ffd34d',
    desc: '穿透聖光彈，命中時治療受傷最重的隊友。', skillDesc: '範圍治療、補滿護盾，並立刻救起倒地隊友。' },
};

const ENEMY = {
  slime: { hp: 30, r: 6, speed: 34, dmg: 10 },
  bat: { hp: 16, r: 5, speed: 72, dmg: 8 },
  skel: { hp: 28, r: 6, speed: 42, dmg: 10 },
  orc: { hp: 95, r: 8, speed: 30, dmg: 18 },
  shroom: { hp: 42, r: 6, speed: 22, dmg: 8 },
  golem: { hp: 1000, r: 15, speed: 28, dmg: 22, boss: true, name: '巨岩魔像' },
  dragon: { hp: 900, r: 14, speed: 38, dmg: 20, boss: true, name: '熔岩飛龍' },
  lich: { hp: 860, r: 12, speed: 30, dmg: 18, boss: true, name: '暗影巫妖' },
};
const BOSSES = ['golem', 'dragon', 'lich'];
const ATTACKS = {
  golem: ['slam', 'ring', 'charge', 'slam'],
  dragon: ['breath', 'spread', 'meteor', 'charge'],
  lich: ['spiral', 'summon', 'blink', 'lasers'],
};
const POOLS = [
  ['slime', 'slime', 'bat', 'skel'],
  ['slime', 'bat', 'skel', 'shroom', 'orc'],
  ['bat', 'skel', 'skel', 'shroom', 'orc', 'orc'],
];

const UPGRADES = [
  { text: '力量祝福：全隊傷害 +15%', apply: p => { p.mods.dmg *= 1.15; } },
  { text: '迅捷祝福：全隊攻速 +12%', apply: p => { p.mods.rate *= 1.12; } },
  { text: '生命祝福：全隊最大生命 +20', apply: p => { p.maxhp += 20; p.hp += 20; } },
  { text: '守護祝福：全隊護盾 +15', apply: p => { p.maxShield += 15; p.shield += 15; } },
  { text: '奧術祝福：技能冷卻 -15%', apply: p => { p.mods.skill *= 0.85; } },
  { text: '疾風祝福：移動速度 +8%', apply: p => { p.mods.speed *= 1.08; } },
  { text: '鷹眼祝福：暴擊率 +8%', apply: p => { p.mods.crit += 0.08; } },
];

export class Game {
  constructor(opts = {}) {
    this.opts = opts;
    this.players = new Map();
    this.nid = 1;
    this.events = [];
    this.state = 'lobby';
    this.floor = 0;
    this.gold = 0;
    this.time = 0;
    this.mapVersion = 0;
    this.upgrades = [];
    this.enemies = []; this.projs = []; this.hazards = []; this.pickups = []; this.spawns = [];
    this.rooms = [];
  }
  id() { return this.nid++; }
  ev(o) { this.events.push(o); }
  text(m, c = '#ffffff') { this.ev({ k: 'text', m, c }); }
  isUp(p) { return !p.dead && !p.downed; }
  ups() { const a = []; for (const p of this.players.values()) if (this.isUp(p)) a.push(p); return a; }

  // ---------- 玩家 ----------
  addPlayer(id, name, cls) {
    if (!CLASSES[cls]) cls = 'knight';
    const c = CLASSES[cls];
    const p = {
      id, name: String(name || '獵人').slice(0, 10), cls, x: 0, y: 0, r: 5,
      hp: c.hp, maxhp: c.hp, shield: c.shield, maxShield: c.shield, energy: 100, maxEnergy: 100,
      aim: 0, atkCd: 0, skillCd: 0, dodgeT: 0, dodgeCd: 0, dvx: 0, dvy: 0, hitT: 99, inv: 0,
      downed: false, bleed: 0, dead: false, revive: 0, spinT: 0, spinTick: 0, flash: 0, moving: false,
      mods: { dmg: 1, rate: 1, skill: 1, speed: 1, crit: 0.1 },
      input: { mx: 0, my: 0, aim: 0, fire: false, skill: false, dodge: false }, kills: 0, dmgDealt: 0,
    };
    for (const u of this.upgrades) u.apply(p);
    this.players.set(id, p);
    if (this.state === 'play') {
      const buddy = this.ups()[0];
      const s = this.rooms[0];
      p.x = buddy ? buddy.x : (s.cx + 0.5) * T; p.y = buddy ? buddy.y : (s.cy + 0.5) * T;
      p.inv = 2;
      this.text(`${p.name} 加入了戰鬥！`, '#8fd3ff');
    }
    return p;
  }
  removePlayer(id) { const p = this.players.get(id); if (p && this.state === 'play') this.text(`${p.name} 離開了`, '#aaaaaa'); this.players.delete(id); }
  setInput(id, inp) { const p = this.players.get(id); if (p) p.input = inp; }

  start() {
    this.upgrades = []; this.gold = 0; this.state = 'play'; this.time = 0;
    for (const p of this.players.values()) {
      const c = CLASSES[p.cls];
      Object.assign(p, { hp: c.hp, maxhp: c.hp, shield: c.shield, maxShield: c.shield, energy: 100, dead: false, downed: false, kills: 0, dmgDealt: 0,
        mods: { dmg: 1, rate: 1, skill: 1, speed: 1, crit: 0.1 } });
    }
    this.newFloor(1);
  }

  newFloor(n) {
    this.floor = n;
    this.enemies = []; this.projs = []; this.hazards = []; this.pickups = []; this.spawns = [];
    this.portal = null; this.boss = null; this.transition = 0; this.activeRoom = null; this.bossPending = 0;
    this.genMap();
    const s = this.rooms[0];
    let i = 0;
    for (const p of this.players.values()) {
      if (p.dead) { p.dead = false; p.hp = Math.ceil(p.maxhp * 0.5); }
      else if (p.downed) { p.hp = Math.ceil(p.maxhp * 0.35); }
      p.downed = false; p.revive = 0; p.spinT = 0; p.dodgeT = 0;
      p.x = (s.cx + 0.5) * T + (i % 2 ? 14 : -14);
      p.y = (s.cy + 0.5) * T + (i > 1 ? 14 : -14);
      p.shield = p.maxShield; p.inv = 1.5; i++;
    }
    this.mapVersion++;
    this.ev({ k: 'floor', n });
    this.text(`第 ${n} 層 — ${['石之迴廊', '苔蘚洞窟', '熔岩深淵'][(n - 1) % 3]}`, '#ffd34d');
  }

  // ---------- 地圖生成 ----------
  genMap() {
    const W = GRID * CELL, H = GRID * CELL;
    this.W = W; this.H = H;
    const tiles = new Uint8Array(W * H);
    const doorOwner = new Int16Array(W * H).fill(-1);
    const mainLen = Math.min(5 + this.floor, 9);
    let path, used;
    for (let tries = 0; tries < 300; tries++) {
      used = new Set();
      const sx = randi(0, GRID - 1), sy = randi(0, GRID - 1);
      path = [[sx, sy]]; used.add(sx + ',' + sy);
      while (path.length < mainLen) {
        const [cx, cy] = path[path.length - 1];
        const opts = DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < GRID && y < GRID && !used.has(x + ',' + y));
        if (!opts.length) break;
        const nx = pick(opts); path.push(nx); used.add(nx.join(','));
      }
      if (path.length === mainLen) break;
    }
    const cells = path.map((c, i) => ({ gx: c[0], gy: c[1], type: i === 0 ? 'start' : i === path.length - 1 ? 'boss' : 'combat' }));
    const edges = path.slice(1).map((_, i) => [i, i + 1]);
    const nBranch = 2 + (this.floor > 2 ? 1 : 0);
    for (let b = 0; b < nBranch; b++) {
      for (let t = 0; t < 20; t++) {
        const fromIdx = randi(0, path.length - 2);
        const f = cells[fromIdx];
        const opts = DIRS.map(([dx, dy]) => [f.gx + dx, f.gy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < GRID && y < GRID && !used.has(x + ',' + y));
        if (!opts.length) continue;
        const [x, y] = pick(opts); used.add(x + ',' + y);
        cells.push({ gx: x, gy: y, type: b === 0 ? 'treasure' : 'combat' });
        edges.push([fromIdx, cells.length - 1]);
        break;
      }
    }
    const rooms = cells.map(c => {
      const boss = c.type === 'boss', small = c.type === 'start' || c.type === 'treasure';
      const w = boss ? 21 : small ? 11 : pick([13, 15, 17, 19]);
      const h = boss ? 19 : small ? 9 : pick([11, 13, 15]);
      const x = c.gx * CELL + ((CELL - w) >> 1), y = c.gy * CELL + ((CELL - h) >> 1);
      return { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: c.type, locked: false,
        cleared: c.type !== 'combat' && c.type !== 'boss', visited: c.type === 'start', active: false,
        waves: c.type === 'combat' ? (this.floor >= 3 ? 3 : 2) : 0 };
    });
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y * W + x] = 1;
    for (const [ai, bi] of edges) {
      const A = rooms[ai], B = rooms[bi];
      if (cells[ai].gy === cells[bi].gy) {
        const [L, R, li, ri] = cells[ai].gx < cells[bi].gx ? [A, B, ai, bi] : [B, A, bi, ai];
        const cy = L.cy;
        for (let x = L.x + L.w; x <= R.x - 1; x++) for (let y = cy - 1; y <= cy + 1; y++) {
          const i = y * W + x; tiles[i] = 1;
          if (x === L.x + L.w) { tiles[i] = 3; doorOwner[i] = li; }
          if (x === R.x - 1) { tiles[i] = 3; doorOwner[i] = ri; }
        }
      } else {
        const [U, D, ui, di] = cells[ai].gy < cells[bi].gy ? [A, B, ai, bi] : [B, A, bi, ai];
        const cx = U.cx;
        for (let y = U.y + U.h; y <= D.y - 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
          const i = y * W + x; tiles[i] = 1;
          if (y === U.y + U.h) { tiles[i] = 3; doorOwner[i] = ui; }
          if (y === D.y - 1) { tiles[i] = 3; doorOwner[i] = di; }
        }
      }
    }
    // 只有戰鬥/頭目房需要門
    for (let i = 0; i < tiles.length; i++) if (tiles[i] === 3) {
      const t = rooms[doorOwner[i]].type;
      if (t !== 'combat' && t !== 'boss') { tiles[i] = 1; doorOwner[i] = -1; }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tiles[y * W + x] !== 0) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) { const t = tiles[yy * W + xx]; if (t === 1 || t === 3) { near = true; break; } }
      }
      if (near) tiles[y * W + x] = 2;
    }
    this.tiles = tiles; this.doorOwner = doorOwner; this.rooms = rooms; this.edges = edges;
    for (const r of rooms) if (r.type === 'treasure') this.pickups.push({ id: this.id(), k: 'chest', x: (r.cx + 0.5) * T, y: (r.cy + 0.5) * T, big: true });
  }

  mapData() {
    const doors = [];
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] === 3) doors.push(i, this.doorOwner[i]);
    return { t: 'map', v: this.mapVersion, f: this.floor, w: this.W, h: this.H, tiles: Array.from(this.tiles).join(''),
      rooms: this.rooms.map(r => ({ x: r.x, y: r.y, w: r.w, h: r.h, t: r.type })), edges: this.edges, doors };
  }

  // ---------- 碰撞 ----------
  solid(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.W || ty >= this.H) return true;
    const i = ty * this.W + tx, t = this.tiles[i];
    if (t === 1) return false;
    if (t === 3) return this.rooms[this.doorOwner[i]].locked;
    return true;
  }
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
  inRoom(p, r, m = 0) {
    const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
    return tx >= r.x + m && tx <= r.x + r.w - 1 - m && ty >= r.y + m && ty <= r.y + r.h - 1 - m;
  }
  nearestUp(e) {
    let best = null, bd = Infinity;
    for (const p of this.players.values()) if (this.isUp(p)) { const d = d2(p, e); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  nearestEnemy(p, maxd) {
    let best = null, bd = maxd * maxd;
    for (const e of this.enemies) { const d = d2(p, e); if (d < bd && this.los(p.x, p.y, e.x, e.y)) { bd = d; best = e; } }
    return best;
  }

  // ---------- 主迴圈 ----------
  step(dt) {
    if (this.state === 'over') { this.overT -= dt; return; }
    if (this.state !== 'play') return;
    this.time += dt;
    for (const p of this.players.values()) this.updatePlayer(p, dt);
    this.updateRooms(dt);
    this.updateSpawns(dt);
    for (const e of this.enemies) if (!e.dead) this.updateEnemy(e, dt);
    this.separate();
    this.enemies = this.enemies.filter(e => !e.dead);
    this.updateProjs(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updatePortal(dt);
    if (this.players.size > 0 && this.ups().length === 0 && this.state === 'play') {
      this.state = 'over'; this.overT = 6;
      this.ev({ k: 'over', f: this.floor, g: this.gold });
      this.text('全滅…', '#ff5555');
    }
  }

  updatePlayer(p, dt) {
    if (p.dead) return;
    p.flash = Math.max(0, p.flash - dt); p.inv = Math.max(0, p.inv - dt);
    if (p.downed) {
      p.bleed -= dt;
      let helper = false;
      for (const q of this.players.values()) if (q !== p && this.isUp(q) && d2(p, q) < 26 * 26) helper = true;
      p.revive = helper ? p.revive + dt : Math.max(0, p.revive - dt * 0.5);
      if (p.revive >= 2.5) this.revivePlayer(p, 0.4);
      else if (p.bleed <= 0) { p.dead = true; p.downed = false; this.text(`${p.name} 陣亡了…下一層會復活`, '#ff6b6b'); }
      return;
    }
    const c = CLASSES[p.cls], inp = p.input || {};
    p.atkCd -= dt; p.skillCd -= dt; p.dodgeCd -= dt; p.hitT += dt;
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
      p.dodgeT = 0.28; p.dodgeCd = 0.85;
      this.ev({ k: 'snd', s: 'dodge' }); this.ev({ k: 'dust', x: r1(p.x), y: r1(p.y) });
    }
    const spd = c.speed * p.mods.speed;
    const px = p.x, py = p.y;
    if (p.dodgeT > 0) { p.dodgeT -= dt; this.moveEnt(p, p.dvx * spd * 2.7 * dt, p.dvy * spd * 2.7 * dt); }
    else { const k = p.spinT > 0 ? 0.75 : 1; this.moveEnt(p, mx * spd * k * dt, my * spd * k * dt); }
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
    p.energy = Math.min(p.maxEnergy, p.energy + c.regen * dt);
    if (p.hitT > 3) p.shield = Math.min(p.maxShield, p.shield + 20 * dt);
    if (p.spinT > 0) {
      p.spinT -= dt; p.spinTick -= dt;
      if (p.spinTick <= 0) {
        p.spinTick = 0.2;
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 36 + e.r) this.hurtEnemy(e, 13 * p.mods.dmg, p, Math.atan2(e.y - p.y, e.x - p.x));
        this.projs = this.projs.filter(pr => !(pr.team === 'e' && Math.hypot(pr.x - p.x, pr.y - p.y) < 38));
      }
    }
  }

  revivePlayer(p, frac) {
    p.downed = false; p.hp = Math.ceil(p.maxhp * frac); p.revive = 0; p.inv = 1.5;
    this.text(`${p.name} 被救起了！`, '#7dff9a'); this.ev({ k: 'snd', s: 'revive' });
  }

  shoot(team, owner, kind, x, y, a, speed, dmg, o = {}) {
    this.projs.push({ id: this.id(), k: kind, team, owner, x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, r: o.r || 3, life: o.life || 1.6, pierce: o.pierce || 0, splash: o.splash || 0, heal: !!o.heal, hit: [] });
  }

  attack(p) {
    const a = p.aim, m = p.mods;
    switch (p.cls) {
      case 'knight': {
        p.atkCd = 0.36 / m.rate;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < 32 + e.r && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), a)) < 1.05) this.hurtEnemy(e, 24 * m.dmg, p, a, 90);
        }
        this.projs = this.projs.filter(pr => {
          if (pr.team === 'e' && Math.hypot(pr.x - p.x, pr.y - p.y) < 34 && Math.abs(angDiff(Math.atan2(pr.y - p.y, pr.x - p.x), a)) < 1.1) {
            this.ev({ k: 'spark', x: r1(pr.x), y: r1(pr.y) }); return false;
          }
          return true;
        });
        this.ev({ k: 'slash', x: r1(p.x), y: r1(p.y), a: r2(a), i: p.id });
        break;
      }
      case 'ranger':
        p.atkCd = 0.17 / m.rate;
        this.shoot('p', p.id, 'arrow', p.x, p.y - 3, a + rand(-0.05, 0.05), 290, 11 * m.dmg);
        break;
      case 'mage':
        if (p.energy < 3) { p.atkCd = 0.2; return; }
        p.energy -= 3; p.atkCd = 0.42 / m.rate;
        this.shoot('p', p.id, 'fire', p.x, p.y - 3, a, 190, 17 * m.dmg, { splash: 24, r: 4 });
        break;
      case 'cleric':
        p.atkCd = 0.28 / m.rate;
        this.shoot('p', p.id, 'holy', p.x, p.y - 3, a, 220, 10 * m.dmg, { pierce: 2, heal: true });
        break;
    }
    this.ev({ k: 'snd', s: 'atk_' + p.cls });
  }

  skill(p) {
    const c = CLASSES[p.cls];
    p.energy -= c.skillCost; p.skillCd = c.skillCd * p.mods.skill;
    this.ev({ k: 'skill', i: p.id, c: p.cls, x: r1(p.x), y: r1(p.y) });
    switch (p.cls) {
      case 'knight': p.spinT = 2.2; p.spinTick = 0; break;
      case 'ranger':
        for (let i = -6; i <= 6; i++) this.shoot('p', p.id, 'arrow', p.x, p.y - 3, p.aim + i * 0.1, 300, 15 * p.mods.dmg, { pierce: 1 });
        break;
      case 'mage':
        for (const e of this.enemies) {
          if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) > 90 + e.r) continue;
          this.hurtEnemy(e, 32 * p.mods.dmg, p, null);
          if (e.boss) { e.frozen = Math.max(e.frozen, 0.8); e.stagger += 40; } else e.frozen = 2.8;
        }
        this.ev({ k: 'nova', x: r1(p.x), y: r1(p.y) });
        break;
      case 'cleric':
        for (const q of this.players.values()) {
          if (q.dead || Math.hypot(q.x - p.x, q.y - p.y) > 110) continue;
          if (q.downed) this.revivePlayer(q, 0.5);
          else q.hp = Math.min(q.maxhp, q.hp + 45);
          q.shield = q.maxShield; q.inv = Math.max(q.inv, 1.5);
          this.ev({ k: 'heal', x: r1(q.x), y: r1(q.y), v: 45 });
        }
        this.ev({ k: 'holy', x: r1(p.x), y: r1(p.y) });
        break;
    }
  }

  hurtPlayer(p, dmg) {
    if (!this.isUp(p) || p.dodgeT > 0 || p.inv > 0) return false;
    if (p.spinT > 0) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    p.hitT = 0; p.flash = 0.15; p.inv = 0.45;
    const total = dmg;
    const s = Math.min(p.shield, dmg); p.shield -= s; dmg -= s; p.hp -= dmg;
    this.ev({ k: 'phit', x: r1(p.x), y: r1(p.y), v: total, i: p.id });
    if (p.hp <= 0) {
      p.hp = 0; p.downed = true; p.bleed = 20; p.revive = 0; p.spinT = 0;
      this.text(`${p.name} 倒地了！站在旁邊救援！`, '#ff8a5c'); this.ev({ k: 'snd', s: 'down' });
    }
    return true;
  }

  hurtEnemy(e, dmg, p, a, kb = 40) {
    if (e.dead) return;
    const crit = p && Math.random() < p.mods.crit;
    if (crit) dmg *= 1.8;
    if (e.boss && e.stun > 0) dmg *= 1.5;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.1;
    if (p) p.dmgDealt += dmg;
    if (e.boss) e.stagger += dmg;
    else if (kb && a != null && e.st !== 'dash') this.moveEnt(e, Math.cos(a) * kb * 0.05, Math.sin(a) * kb * 0.05);
    this.ev({ k: 'hit', x: r1(e.x), y: r1(e.y - e.r), v: dmg, c: crit ? 1 : 0 });
    if (e.hp <= 0) this.killEnemy(e, p);
  }

  killEnemy(e, p) {
    e.dead = true; e.hp = 0;
    if (p) p.kills++;
    this.ev({ k: 'die', x: r1(e.x), y: r1(e.y), t: e.type });
    if (e.boss) return this.bossDown(e);
    const nc = randi(1, 2);
    for (let i = 0; i < nc; i++) this.drop('coin', e.x, e.y);
    const r = Math.random();
    if (r < 0.09) this.drop('hp', e.x, e.y); else if (r < 0.27) this.drop('en', e.x, e.y);
  }
  drop(k, x, y) { this.pickups.push({ id: this.id(), k, x: x + rand(-6, 6), y: y + rand(-6, 6) }); }

  // ---------- 房間 ----------
  updateRooms(dt) {
    const ups = this.ups();
    for (const r of this.rooms) {
      if (!r.visited && ups.some(p => this.inRoom(p, r))) r.visited = true;
      if (r.cleared || r.active || this.activeRoom) continue;
      const trig = ups.find(p => this.inRoom(p, r, 1));
      if (trig) this.activateRoom(r, trig);
    }
    const ar = this.activeRoom;
    if (ar && ar.type === 'combat' && this.enemies.length === 0 && this.spawns.length === 0) {
      if (ar.waves > 0) this.spawnWave(ar); else this.clearRoom(ar);
    }
    if (this.bossPending > 0) {
      this.bossPending -= dt;
      if (this.bossPending <= 0) {
        const type = BOSSES[(this.floor - 1) % BOSSES.length];
        const b = this.createEnemy(type, (ar.cx + 0.5) * T, (ar.cy + 0.5) * T);
        this.ev({ k: 'boss', n: b.name }); this.ev({ k: 'shake', v: 8 });
      }
    }
  }

  activateRoom(r, trig) {
    r.active = true; r.locked = true; r.visited = true; this.activeRoom = r;
    for (const p of this.players.values()) {
      if (p.dead || this.inRoom(p, r, 1)) continue;
      p.x = trig.x + rand(-6, 6); p.y = trig.y + rand(-6, 6);
      if (this.collides(p.x, p.y, p.r)) { p.x = trig.x; p.y = trig.y; }
    }
    this.ev({ k: 'snd', s: 'door' });
    if (r.type === 'boss') { this.bossPending = 1.6; this.text('⚠ 強大的氣息逼近…', '#ff5555'); }
    else this.spawnWave(r);
  }

  spawnWave(r) {
    r.waves--;
    const np = Math.max(1, this.players.size);
    const count = Math.round(3 + this.floor * 0.8 + np * 1.3 + rand(0, 2));
    const pool = POOLS[Math.min(this.floor - 1, POOLS.length - 1)];
    const ups = this.ups();
    for (let i = 0; i < count; i++) {
      for (let t = 0; t < 30; t++) {
        const x = (randi(r.x + 2, r.x + r.w - 3) + 0.5) * T, y = (randi(r.y + 2, r.y + r.h - 3) + 0.5) * T;
        if (ups.some(p => Math.hypot(p.x - x, p.y - y) < 56)) continue;
        this.spawns.push({ x, y, type: pick(pool), t: 0.9 + rand(0, 0.3) });
        break;
      }
    }
    if (!this.spawns.length) this.spawns.push({ x: (r.cx + 0.5) * T, y: (r.cy + 0.5) * T, type: 'slime', t: 0.9 });
  }

  updateSpawns(dt) {
    for (const s of this.spawns) { s.t -= dt; if (s.t <= 0) this.createEnemy(s.type, s.x, s.y); }
    this.spawns = this.spawns.filter(s => s.t > 0);
  }

  clearRoom(r) {
    r.cleared = true; r.locked = false; r.active = false; this.activeRoom = null;
    this.ev({ k: 'snd', s: 'clear' }); this.text('房間已清除！', '#7dff9a');
    const x = (r.cx + 0.5) * T, y = (r.cy + 0.5) * T;
    if (Math.random() < 0.35) this.pickups.push({ id: this.id(), k: 'chest', x, y });
    else { this.drop(Math.random() < 0.5 ? 'hp' : 'en', x, y); this.drop('coin', x, y); this.drop('coin', x, y); }
  }

  bossDown(e) {
    this.boss = null;
    const r = this.activeRoom;
    for (const o of this.enemies) if (!o.dead) { o.dead = true; this.ev({ k: 'die', x: r1(o.x), y: r1(o.y), t: o.type }); }
    this.projs = this.projs.filter(p => p.team === 'p'); this.hazards = []; this.spawns = [];
    this.ev({ k: 'shake', v: 10 }); this.ev({ k: 'snd', s: 'victory' });
    this.text(`討伐成功！擊敗了 ${e.name}`, '#ffd34d');
    if (r) {
      r.cleared = true; r.locked = false; r.active = false; this.activeRoom = null;
      const x = (r.cx + 0.5) * T, y = (r.cy + 0.5) * T;
      this.portal = { x, y: y - 40 };
      this.pickups.push({ id: this.id(), k: 'chest', x, y: y + 30, big: true });
      for (let i = 0; i < 12; i++) this.drop('coin', e.x + rand(-20, 20), e.y + rand(-20, 20));
      this.drop('hp', e.x, e.y); this.drop('hp', e.x, e.y);
      this.text('所有存活隊員站上傳送門即可前往下一層', '#c9a7ff');
    }
  }

  // ---------- 敵人 ----------
  createEnemy(type, x, y) {
    const d = ENEMY[type];
    const np = Math.max(1, this.players.size);
    const hs = (1 + 0.28 * (this.floor - 1)) * (d.boss ? 1 + 0.65 * (np - 1) : 1 + 0.2 * (np - 1));
    const hp = Math.round(d.hp * hs);
    const e = { id: this.id(), type, x, y, r: d.r, hp, maxhp: hp, speed: d.speed * (1 + 0.04 * (this.floor - 1)),
      dmg: d.dmg * (1 + 0.12 * (this.floor - 1)), boss: !!d.boss, st: 'idle', t: rand(0.3, 1.2), cd: rand(0.6, 2),
      frozen: 0, flash: 0, a: 0, stun: 0, stagger: 0, wob: rand(0, 6.28), z: 0, atk: null };
    if (e.boss) { e.staggerMax = Math.round(e.maxhp * 0.1); e.t = 1.5; e.name = d.name; e.sa = 0; this.boss = e; }
    this.enemies.push(e);
    return e;
  }

  separate() {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const a = es[i], b = es[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0.01 && d < m) {
        const push = (m - d) / 2, nx = dx / d, ny = dy / d;
        if (!a.boss) this.moveEnt(a, -nx * push, -ny * push);
        if (!b.boss) this.moveEnt(b, nx * push, ny * push);
      }
    }
  }

  contact(e, mul = 1) {
    for (const p of this.players.values()) if (this.isUp(p) && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 1) this.hurtPlayer(p, e.dmg * mul);
  }

  updateEnemy(e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    if (e.frozen > 0) { e.frozen -= dt; if (!e.boss) return; }
    const tgt = this.nearestUp(e);
    if (!tgt) return;
    const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
    e.a = a; e.cd -= dt;
    if (e.boss) { if (e.frozen > 0) return; this.updateBoss(e, tgt, d, a, dt); return; }
    switch (e.type) {
      case 'slime': {
        e.t -= dt; if (e.t < 0) e.t = 1.1;
        const hop = e.t < 0.45; e.st = hop ? 'hop' : 'idle';
        if (hop) this.moveEnt(e, Math.cos(a) * e.speed * 2.2 * dt, Math.sin(a) * e.speed * 2.2 * dt);
        break;
      }
      case 'bat': {
        e.wob += dt * 6;
        const aa = a + Math.sin(e.wob) * 0.9;
        this.moveEnt(e, Math.cos(aa) * e.speed * dt, Math.sin(aa) * e.speed * dt);
        break;
      }
      case 'skel': {
        let sa = a, sp = 1;
        if (d < 75) sp = -1; else if (d < 140) { sa = a + (e.id % 2 ? 1 : -1) * Math.PI / 2; sp = 0.5; }
        this.moveEnt(e, Math.cos(sa) * e.speed * sp * dt, Math.sin(sa) * e.speed * sp * dt);
        if (e.cd <= 0 && d < 220 && this.los(e.x, e.y, tgt.x, tgt.y)) { e.cd = rand(1.6, 2.2); this.shoot('e', e.id, 'bone', e.x, e.y, a, 125, e.dmg); }
        break;
      }
      case 'orc': {
        if (e.st === 'wind') { e.t -= dt; if (e.t <= 0) { e.st = 'dash'; e.t = 0.5; } }
        else if (e.st === 'dash') {
          e.t -= dt;
          const b = this.moveEnt(e, Math.cos(e.da) * 210 * dt, Math.sin(e.da) * 210 * dt);
          if (e.t <= 0 || b) { e.st = 'rest'; e.t = 0.9; }
        } else if (e.st === 'rest') { e.t -= dt; if (e.t <= 0) e.st = 'idle'; }
        else {
          this.moveEnt(e, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt);
          if (d < 110 && e.cd <= 0 && this.los(e.x, e.y, tgt.x, tgt.y)) {
            e.st = 'wind'; e.t = 0.65; e.da = a; e.cd = 3;
            this.hazards.push({ id: this.id(), k: 'line', x: e.x, y: e.y, a, len: this.rayLen(e.x, e.y, a, 120), w: 16, delay: 0.65, t: 0, dmg: 0 });
          }
        }
        break;
      }
      case 'shroom': {
        if (d > 60) this.moveEnt(e, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt);
        if (e.cd <= 0 && d < 200) { e.cd = rand(2.4, 3); for (let i = 0; i < 8; i++) this.shoot('e', e.id, 'spore', e.x, e.y, a + i * Math.PI / 4, 70, e.dmg, { life: 2.6 }); }
        break;
      }
    }
    this.contact(e, e.st === 'dash' ? 1.4 : 1);
  }

  ring(e, n, kind, speed, dmg, off = 0, o = {}) {
    for (let i = 0; i < n; i++) this.shoot('e', e.id, kind, e.x, e.y, off + i * Math.PI * 2 / n, speed, dmg, o);
  }

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
      if (d > 40) this.moveEnt(e, Math.cos(a) * e.speed * dt, Math.sin(a) * e.speed * dt);
      if (e.t <= 0) { e.atk = pick(ATTACKS[e.type]); e.at = 0; e.ph = 0; e.st = e.atk; this.beginAttack(e, tgt, a, sp); }
      this.contact(e);
      return;
    }
    const sdt = dt * sp;
    e.at += sdt;
    this.runAttack(e, tgt, a, sdt, sp);
    this.contact(e, e.st === 'dash' ? 1.4 : 1);
  }

  endAttack(e) { e.atk = null; e.st = 'walk'; e.z = 0; e.t = e.raged ? rand(0.6, 1.0) : rand(1.0, 1.6); }

  beginAttack(e, tgt, a, sp) {
    const R = this.activeRoom;
    switch (e.atk) {
      case 'slam':
        e.sx = e.x; e.sy = e.y; e.tx = tgt.x; e.ty = tgt.y;
        this.hazards.push({ id: this.id(), k: 'circle', x: tgt.x, y: tgt.y, r: 44, delay: 1 / sp, t: 0, dmg: e.dmg * 1.3 });
        this.ev({ k: 'snd', s: 'jump' });
        break;
      case 'charge':
        e.da = a;
        this.hazards.push({ id: this.id(), k: 'line', x: e.x, y: e.y, a, len: this.rayLen(e.x, e.y, a, 420), w: 30, delay: 0.8 / sp, t: 0, dmg: 0 });
        this.ev({ k: 'snd', s: 'roar' });
        break;
      case 'breath':
        e.da = a; e.ft = 0;
        this.hazards.push({ id: this.id(), k: 'cone', x: e.x, y: e.y, a, r: 150, s: 0.5, delay: 0.6 / sp, t: 0, dmg: 0 });
        break;
      case 'meteor':
        for (const p of this.ups()) for (let i = 0; i < 2; i++)
          this.hazards.push({ id: this.id(), k: 'circle', x: p.x + rand(-14, 14), y: p.y + rand(-14, 14), r: 30, delay: (1.2 + i * 0.4) / sp, t: 0, dmg: e.dmg * 1.1 });
        if (R) for (let i = 0; i < 4; i++)
          this.hazards.push({ id: this.id(), k: 'circle', x: (randi(R.x + 2, R.x + R.w - 3) + 0.5) * T, y: (randi(R.y + 2, R.y + R.h - 3) + 0.5) * T, r: 30, delay: rand(1.2, 1.8) / sp, t: 0, dmg: e.dmg * 1.1 });
        this.ev({ k: 'snd', s: 'roar' });
        break;
      case 'spiral': e.ft = 0; e.sa = a; break;
      case 'summon': {
        const n = 2 + Math.floor(this.players.size / 2);
        if (this.enemies.length < 8) for (let i = 0; i < n; i++) {
          const ang = i * Math.PI * 2 / n, x = e.x + Math.cos(ang) * 40, y = e.y + Math.sin(ang) * 40;
          if (!this.collides(x, y, 6)) this.spawns.push({ x, y, type: pick(['skel', 'bat']), t: 0.9 });
        }
        this.text(`${e.name} 召喚了亡靈！`, '#c9a7ff');
        break;
      }
      case 'blink': break;
      case 'lasers': {
        const angs = this.ups().map(p => Math.atan2(p.y - e.y, p.x - e.x));
        if (e.raged) angs.push(rand(0, 6.28), rand(0, 6.28));
        for (const la of angs) this.hazards.push({ id: this.id(), k: 'line', x: e.x, y: e.y, a: la, len: this.rayLen(e.x, e.y, la, 420), w: 14, delay: 1.0 / sp, t: 0, dmg: e.dmg * 1.4 });
        break;
      }
    }
  }

  runAttack(e, tgt, a, dt, sp) {
    const R = this.activeRoom;
    switch (e.atk) {
      case 'slam': {
        const k = Math.min(1, e.at / 1.0);
        e.st = 'jump';
        e.x = e.sx + (e.tx - e.sx) * k; e.y = e.sy + (e.ty - e.sy) * k; e.z = Math.sin(k * Math.PI) * 34;
        if (k >= 1) { this.ring(e, 10, 'rock', 110, e.dmg * 0.6, rand(0, 1)); this.ev({ k: 'shake', v: 7 }); this.endAttack(e); }
        break;
      }
      case 'ring':
        e.st = 'cast';
        if (e.ph < 3 && e.at >= 0.3 + e.ph * 0.5) { this.ring(e, 14, 'rock', 105, e.dmg * 0.6, e.ph * 0.22); e.ph++; this.ev({ k: 'snd', s: 'boom' }); }
        if (e.at >= 1.8) this.endAttack(e);
        break;
      case 'charge':
        if (e.at < 0.8) { e.st = 'wind'; break; }
        e.st = 'dash';
        if (this.moveEnt(e, Math.cos(e.da) * 260 * dt, Math.sin(e.da) * 260 * dt)) {
          this.ring(e, 8, 'rock', 100, e.dmg * 0.5);
          this.endAttack(e); e.stun = 1.6;
          this.text(`${e.name} 撞上牆壁暈眩了！`, '#ffd34d'); this.ev({ k: 'shake', v: 9 }); this.ev({ k: 'snd', s: 'boom' });
        } else if (e.at > 2.4) this.endAttack(e);
        break;
      case 'breath':
        if (e.at < 0.6) { e.st = 'wind'; break; }
        e.st = 'cast';
        e.da += clamp(angDiff(a, e.da), -0.9 * dt, 0.9 * dt);
        e.ft -= dt;
        while (e.ft <= 0) { e.ft += 0.045; this.shoot('e', e.id, 'efire', e.x, e.y, e.da + rand(-0.4, 0.4), rand(130, 170), e.dmg * 0.35, { life: 0.9 }); }
        if (e.at >= 2.0) this.endAttack(e);
        break;
      case 'spread':
        e.st = 'cast';
        if (e.ph < 3 && e.at >= 0.2 + e.ph * 0.5) {
          for (let i = -2; i <= 2; i++) this.shoot('e', e.id, 'fireball', e.x, e.y, a + i * 0.22, 135, e.dmg * 0.7, { r: 5, life: 2.5 });
          e.ph++; this.ev({ k: 'snd', s: 'fireball' });
        }
        if (e.at >= 1.6) this.endAttack(e);
        break;
      case 'meteor': e.st = 'cast'; if (e.at >= 1.5) this.endAttack(e); break;
      case 'spiral':
        e.st = 'cast';
        e.ft -= dt;
        while (e.ft <= 0) { e.ft += 0.07; e.sa += 0.27; for (let i = 0; i < (e.raged ? 3 : 2); i++) this.shoot('e', e.id, 'dark', e.x, e.y, e.sa + i * Math.PI * 2 / (e.raged ? 3 : 2), 95, e.dmg * 0.5, { life: 3 }); }
        if (e.at >= 2.8) this.endAttack(e);
        break;
      case 'summon': e.st = 'cast'; if (e.at >= 1.0) this.endAttack(e); break;
      case 'blink':
        if (e.ph === 0) { e.st = 'wind'; if (e.at >= 0.5 && R) {
          for (let t = 0; t < 30; t++) {
            const x = (randi(R.x + 2, R.x + R.w - 3) + 0.5) * T, y = (randi(R.y + 2, R.y + R.h - 3) + 0.5) * T;
            if (this.ups().every(p => Math.hypot(p.x - x, p.y - y) > 70)) { this.ev({ k: 'blink', x: r1(e.x), y: r1(e.y) }); e.x = x; e.y = y; break; }
          }
          this.ring(e, 18, 'dark', 90, e.dmg * 0.5, rand(0, 1), { life: 3 }); e.ph = 1; this.ev({ k: 'snd', s: 'blink' });
        } }
        if (e.at >= 1.1) this.endAttack(e);
        break;
      case 'lasers': e.st = 'cast'; if (e.at >= 1.3) this.endAttack(e); break;
      default: this.endAttack(e);
    }
  }

  // ---------- 子彈 / 危險區 / 道具 ----------
  updateProjs(dt) {
    const out = [];
    for (const pr of this.projs) {
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      let dead = pr.life <= 0 || this.solidAt(pr.x, pr.y);
      if (!dead && pr.team === 'p') {
        for (const e of this.enemies) {
          if (e.dead || pr.hit.includes(e.id)) continue;
          if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.r) {
            const owner = this.players.get(pr.owner);
            this.hurtEnemy(e, pr.dmg, owner, Math.atan2(pr.vy, pr.vx));
            if (pr.heal) this.healLowest(1);
            if (pr.splash) { dead = true; break; }
            if (pr.pierce > 0) { pr.pierce--; pr.hit.push(e.id); } else { dead = true; break; }
          }
        }
      } else if (!dead) {
        for (const p of this.players.values()) {
          if (!this.isUp(p) || p.dodgeT > 0) continue;
          if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + pr.r) { this.hurtPlayer(p, pr.dmg); dead = true; break; }
        }
      }
      if (dead) {
        if (pr.splash) {
          const owner = this.players.get(pr.owner);
          for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - pr.x, e.y - pr.y) < pr.splash + e.r) this.hurtEnemy(e, pr.dmg * 0.6, owner, null);
          this.ev({ k: 'boom', x: r1(pr.x), y: r1(pr.y), r: pr.splash, s: 1 });
        } else if (pr.life > 0) this.ev({ k: 'puff', x: r1(pr.x), y: r1(pr.y), c: pr.k });
      } else out.push(pr);
    }
    this.projs = out;
  }

  healLowest(v) {
    let best = null;
    for (const p of this.players.values()) if (this.isUp(p) && p.hp < p.maxhp && (!best || p.hp / p.maxhp < best.hp / best.maxhp)) best = p;
    if (best) best.hp = Math.min(best.maxhp, best.hp + v);
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
          if (hit) this.hurtPlayer(p, h.dmg);
        }
        if (h.k === 'circle') { this.ev({ k: 'boom', x: r1(h.x), y: r1(h.y), r: h.r }); this.ev({ k: 'shake', v: 4 }); }
        else this.ev({ k: 'beam', x: r1(h.x), y: r1(h.y), a: r2(h.a), l: h.len, w: h.w });
      }
    }
    this.hazards = keep;
  }

  updatePickups(dt) {
    const keep = [];
    for (const pk of this.pickups) {
      let taken = false;
      if (pk.k === 'chest') {
        for (const p of this.players.values()) if (this.isUp(p) && Math.hypot(p.x - pk.x, p.y - pk.y) < 14) { this.openChest(pk, p); taken = true; break; }
      } else {
        let best = null, bd = 44;
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
            if (pk.k === 'coin') this.gold++;
            else if (pk.k === 'hp') { best.hp = Math.min(best.maxhp, best.hp + 30); this.ev({ k: 'heal', x: r1(best.x), y: r1(best.y), v: 30 }); }
            else if (pk.k === 'en') best.energy = Math.min(best.maxEnergy, best.energy + 25);
            this.ev({ k: 'snd', s: pk.k === 'coin' ? 'coin' : 'pickup' });
          } else {
            const a = Math.atan2(best.y - pk.y, best.x - pk.x);
            pk.x += Math.cos(a) * 150 * dt; pk.y += Math.sin(a) * 150 * dt;
          }
        }
      }
      if (!taken) keep.push(pk);
    }
    this.pickups = keep;
  }

  openChest(pk, p) {
    const n = pk.big ? 2 : 1;
    const pool = UPGRADES.slice();
    for (let i = 0; i < n; i++) {
      const u = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      this.upgrades.push(u);
      for (const q of this.players.values()) u.apply(q);
      this.text(u.text, '#8fd3ff');
    }
    for (let i = 0; i < 4; i++) this.drop('coin', pk.x, pk.y);
    this.ev({ k: 'chest', x: r1(pk.x), y: r1(pk.y) }); this.ev({ k: 'snd', s: 'chest' });
  }

  updatePortal(dt) {
    if (!this.portal) return;
    const ups = this.ups();
    const all = ups.length > 0 && ups.every(p => Math.hypot(p.x - this.portal.x, p.y - this.portal.y) < 26);
    this.transition = all ? this.transition + dt : 0;
    if (this.transition >= 1.2) this.newFloor(this.floor + 1);
  }

  // ---------- 快照 ----------
  snapshot() {
    const ps = [];
    for (const p of this.players.values()) {
      const c = CLASSES[p.cls];
      ps.push({ i: p.id, n: p.name, c: p.cls, x: r1(p.x), y: r1(p.y), a: r2(p.aim), hp: Math.ceil(p.hp), mh: p.maxhp,
        sh: Math.ceil(p.shield), ms: p.maxShield, en: Math.floor(p.energy), dg: p.dodgeT > 0 ? 1 : 0, dn: p.downed ? 1 : 0, dd: p.dead ? 1 : 0,
        rv: r2(p.revive / 2.5), bl: Math.ceil(p.bleed), sk: r2(Math.max(0, p.skillCd) / (c.skillCd * p.mods.skill)), sp: p.spinT > 0 ? 1 : 0,
        fl: p.flash > 0 ? 1 : 0, mv: p.moving ? 1 : 0, iv: p.inv > 0 ? 1 : 0, k: p.kills, dm: p.dmgDealt });
    }
    const snap = {
      t: 's', st: this.state, f: this.floor, g: this.gold, tm: r2(this.time), ps,
      es: this.enemies.map(e => ({ i: e.id, t: e.type, x: r1(e.x), y: r1(e.y), hp: Math.max(0, e.hp), mh: e.maxhp, fz: e.frozen > 0 ? 1 : 0, fl: e.flash > 0 ? 1 : 0, st: e.st, a: r2(e.a), z: Math.round(e.z || 0) })),
      pr: this.projs.map(p => ({ i: p.id, k: p.k, x: r1(p.x), y: r1(p.y), a: r2(Math.atan2(p.vy, p.vx)) })),
      hz: this.hazards.map(h => ({ k: h.k, x: r1(h.x), y: r1(h.y), r: h.r, a: r2(h.a || 0), l: h.len, w: h.w, s: h.s, p: r2(h.t / h.delay), d: h.dmg > 0 ? 1 : 0 })),
      pk: this.pickups.map(p => ({ i: p.id, k: p.k, x: r1(p.x), y: r1(p.y), b: p.big ? 1 : 0 })),
      sp: this.spawns.map(s => ({ x: r1(s.x), y: r1(s.y), p: r2(s.t) })),
      rm: this.rooms.map(r => (r.visited ? 1 : 0) | (r.locked ? 2 : 0) | (r.cleared ? 4 : 0)),
      po: this.portal ? { x: this.portal.x, y: this.portal.y, t: r2(this.transition / 1.2) } : null,
      bo: this.boss ? { n: this.boss.name, hp: Math.max(0, this.boss.hp), mh: this.boss.maxhp, sg: r2(Math.min(1, this.boss.stagger / this.boss.staggerMax)), st: this.boss.stun > 0 ? 1 : 0, rg: this.boss.raged ? 1 : 0 } : null,
      ev: this.events,
    };
    this.events = [];
    return snap;
  }
}
