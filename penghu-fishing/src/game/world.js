// 即時的釣魚場景：釣魚狀態機、水中的魚、小卷貓、海鷗、粒子，以及每一幀的繪製。
import { sceneLayers, drawSeaweed, drawBandObjects, LW, SH, HZ, WL } from '../render/scene.js';
import { boatSprite, BOAT_LAYOUT, drawPlayer, drawRod, catSprite, drawGull } from '../render/actors.js';
import { swimFrames, packIcon } from '../render/fishart.js';
import { makeCanvas, rect, px, curve, line, ditherOn, PAL as C } from '../render/pixel.js';
import { buildPool, timeMatches, SIZES } from '../core/fishing.js';
import { fireworksTonight } from '../core/clock.js';

const rnd = Math.random;

export class World {
  constructor(game, hooks) {
    this.game = game;
    this.data = game.data;
    this.cfg = game.cfg;
    this.hooks = hooks; // { onCatch, onBroke, onEmpty, onCast, sfx }
    this.t = 0;
    this.state = 'cast';
    this.timer = 0;
    this.pending = null;   // 這一竿抽到的結果
    this.fishes = [];
    this.approach = null;
    this.particles = [];
    this.gulls = [];
    this.jumper = null;
    this.paused = false;
    this.cat = { pose: 'sit', timer: 3, frame: 0, taps: [], say: null, sayT: 0 };
    this.travel = null;
    this.fade = 0;
    this.lure = { x: 0, y: WL + 40, depth: 50 };
    this.flash = 0;
    this.lastCaughtSmall = false;
    this.celebrate = 0;
    this.holdFish = null;
    this.above = null;
    this.W = 640;
    this.resetSpot();
  }

  resetSpot() {
    this.fishes = [];
    this.approach = null;
    this.pending = null;
    this.state = 'cast';
    this.timer = 0;
    const tip = this.rodTip();
    this.lure.x = tip.x + 8;
    this.lure.y = WL + this.lure.depth;
    this.spawnAmbientFish(true);
  }

  // ---------- 狀態 ----------
  get boatId() { return this.game.state.boat; }
  get layout() { return BOAT_LAYOUT[this.boatId]; }
  boatX(W = this.W) { return Math.round(W * 0.34 - this.layout.w / 2); }
  bob() { return Math.round(Math.sin(this.t * 1.4) * 1); }

  rodTip(W = this.W) {
    const L = this.layout;
    const bx = this.boatX(W);
    const sway = Math.round(Math.sin(this.t * 0.9) * 1);
    let tip = { x: bx + L.bow + 26, y: WL - 44 + sway + this.bob() };
    if (this.state === 'reel') tip = { x: tip.x - 4, y: tip.y + 8 + Math.round(Math.sin(this.t * 20)) };
    if (this.state === 'cast' && this.timer < this.cfg.fishing.castTime) {
      const k = this.timer / this.cfg.fishing.castTime;
      if (k < 0.45) tip = { x: bx + L.seat - 16, y: WL - 64 }; // 往後揮
      else if (k < 0.7) tip = { x: bx + L.seat + 10, y: WL - 70 };
    }
    return tip;
  }

  playerAnim() {
    if (this.celebrate > 0) return 'celebrate';
    if (this.state === 'reel') return 'reel';
    if (this.state === 'cast' && this.timer < this.cfg.fishing.castTime) return 'cast';
    return 'idle';
  }

  /** 每一幀更新；dt 為現實秒數（已乘上除錯加速） */
  update(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.celebrate = Math.max(0, this.celebrate - dt);
    this.updateTravel(dt);
    this.updateAmbient(dt);
    this.updateCat(dt);
    if (!this.paused && !this.travel) this.updateFishing(dt);
  }

  updateFishing(dt) {
    const f = this.cfg.fishing;
    this.timer += dt;
    const tip = this.rodTip();
    switch (this.state) {
      case 'cast': {
        // 擬餌沉到水下
        const k = Math.min(1, Math.max(0, (this.timer - f.castTime * 0.6) / (f.castTime * 0.8)));
        this.lure.x = tip.x + 8;
        this.lure.y = Math.round(WL - 20 + (this.lure.depth + 20) * k);
        if (this.timer >= f.castTime * 0.6 && !this._splashed) { this._splashed = true; this.splash(this.lure.x, WL, 4); this.hooks.sfx?.('plop'); }
        if (this.timer >= f.castTime * 1.4) this.beginWait();
        break;
      }
      case 'wait':
        this.lure.y = WL + this.lure.depth + Math.round(Math.sin(this.t * 2) * 1);
        if (this.timer >= this.waitFor) this.beginApproach();
        break;
      case 'empty':
        if (this.timer >= f.emptyRetry) this.beginWait();
        break;
      case 'approach': {
        const a = this.approach;
        const k = Math.min(1, this.timer / f.approachTime);
        a.x = a.x0 + (this.lure.x - a.ox - a.x0) * easeOut(k);
        a.y = a.y0 + (this.lure.y - a.y0) * easeOut(k);
        if (k >= 1) { this.state = 'bite'; this.timer = 0; this.hooks.sfx?.('bite'); this.splash(this.lure.x, this.lure.y, 3, true); }
        break;
      }
      case 'bite':
        // 擬餌閃動
        this.lure.y = WL + this.lure.depth + (Math.floor(this.t * 16) % 2 ? 2 : -1);
        if (this.timer >= f.biteTime) {
          this.state = 'reel'; this.timer = 0;
          const res = this.pending;
          const ratio = Math.min(1, res.instance.w / Math.max(1, res.fish.w[1]));
          this.reelFor = f.reelTimeMin + (f.reelTimeMax - f.reelTimeMin) * ratio;
          this.hooks.sfx?.('reel');
        }
        break;
      case 'reel': {
        const a = this.approach;
        const k = Math.min(1, this.timer / this.reelFor);
        this.lure.x = tip.x + 8 + Math.round(Math.sin(this.t * 8) * 3);
        this.lure.y = Math.round(WL + this.lure.depth * (1 - k));
        if (a) { a.x = this.lure.x - a.ox; a.y = this.lure.y; }
        if (this.pending.broke && k > 0.55) { this.finishBroke(); break; }
        if (k >= 1) this.finishCatch();
        break;
      }
      default: break;
    }
  }

  beginCast() {
    this.state = 'cast'; this.timer = 0; this._splashed = false;
    this.approach = null; this.pending = null; this.holdFish = null;
    this.lure.depth = 36 + Math.floor(rnd() * 70);
    this.hooks.sfx?.('cast');
  }

  beginWait() {
    this.state = 'wait'; this.timer = 0;
    this.waitFor = this.game.rollWait(rnd);
  }

  beginApproach() {
    const res = this.game.roll(rnd);
    if (!res) { this.state = 'empty'; this.timer = 0; this.hooks.onEmpty?.(); return; }
    this.pending = res;
    const fish = res.fish;
    const frames = swimFrames(fish, res.instance.size, 1);
    const fromLeft = rnd() < 0.5;
    const spr = frames[0];
    this.approach = {
      fish, size: res.instance.size, dir: fromLeft ? 1 : -1,
      x0: fromLeft ? -spr.w - 10 : this.W + 10, y0: WL + 30 + Math.floor(rnd() * 100),
      x: 0, y: 0, ox: fromLeft ? spr.w - 2 : 2,
    };
    if (!fromLeft) this.approach.ox = 2;
    this.approach.x = this.approach.x0; this.approach.y = this.approach.y0;
    this.state = 'approach'; this.timer = 0;
  }

  finishBroke() {
    const res = this.pending;
    this.hooks.sfx?.('snap');
    this.splash(this.lure.x, WL, 6);
    // 魚跑掉：往外游
    if (this.approach) this.fishes.push({ fish: res.fish, size: res.instance.size, x: this.approach.x, y: this.approach.y, dir: -this.approach.dir || 1, speed: 60, frame: 0, flee: true });
    this.approach = null;
    this.hooks.onBroke?.(res);
    this.beginCast();
  }

  finishCatch() {
    const res = this.pending;
    this.splash(this.lure.x, WL, 8);
    this.hooks.sfx?.('splash');
    this.approach = null;
    this.state = 'result';
    this.timer = 0;
    this.celebrate = 2.4;
    const icon = packIcon(res.fish, [1, 2], 12, false);
    this.holdFish = icon;
    this.lastCaughtSmall = res.instance.size === 'S';
    if (res.fish.rarity === 'rare' || res.fish.rarity === 'legendary' || res.fish.art.glow) { this.flash = 1.2; this.sparkle(this.rodTip().x - 20, WL - 60, 26); }
    this.catReact(this.lastCaughtSmall ? 'sniff' : 'excited', 2.2);
    this.hooks.onCatch?.(res);
  }

  /** 漁獲卡處理完後呼叫：繼續釣下一竿 */
  resume() {
    if (this.state === 'result' || this.state === 'stopped') this.beginCast();
  }

  stop() { this.state = 'stopped'; this.approach = null; }

  // ---------- 環境：水中的魚、海鷗、跳魚 ----------
  spotPoolSpecies() {
    const env = this.game.env();
    const spot = this.game.spot;
    return this.data.fish.filter((f) => f.spots.includes(spot.id) && timeMatches(f, env.phase) && f.rarity !== 'legendary');
  }

  spawnAmbientFish(initial = false) {
    const f = this.cfg.fishing;
    const species = this.spotPoolSpecies();
    if (!species.length) return;
    const target = f.visibleFishMin + Math.floor(rnd() * (f.visibleFishMax - f.visibleFishMin + 1));
    while (this.fishes.filter((x) => !x.flee).length < target) {
      const fish = species[Math.floor(rnd() * species.length)];
      const size = rnd() < 0.6 ? 'S' : rnd() < 0.7 ? 'M' : 'L';
      const dir = rnd() < 0.5 ? 1 : -1;
      const w = swimFrames(fish, size, 1)[0].w;
      this.fishes.push({
        fish, size, dir,
        x: initial ? Math.floor(rnd() * this.W) : dir > 0 ? -w - 4 : this.W + 4,
        y: WL + 22 + Math.floor(rnd() * 120), speed: 6 + rnd() * 12, frame: rnd() * 4, wob: rnd() * 6,
      });
    }
  }

  updateAmbient(dt) {
    for (const f of this.fishes) {
      f.x += f.dir * f.speed * dt;
      f.frame += dt * (f.flee ? 12 : 5);
      f.y += Math.sin(this.t * 0.8 + f.wob) * 0.05;
      if (!f.flee && rnd() < dt * 0.05) f.dir = -f.dir;
    }
    this.fishes = this.fishes.filter((f) => f.x > -160 && f.x < this.W + 160);
    if (rnd() < dt * 0.5) this.spawnAmbientFish();
    // 海鷗
    if (this.gulls.length < 2 && rnd() < dt * 0.04 && this.game.phase() !== 'night') {
      const dir = rnd() < 0.5 ? 1 : -1;
      this.gulls.push({ x: dir > 0 ? -10 : this.W + 10, y: 20 + rnd() * 50, dir, speed: 18 + rnd() * 14, f: 0 });
      this.hooks.sfx?.('gull');
      if (this.cat.pose === 'sit' || this.cat.pose === 'lick') this.catReact('watch', 3);
    }
    for (const g of this.gulls) { g.x += g.dir * g.speed * dt; g.f += dt * 4; g.y += Math.sin(this.t + g.x * 0.02) * 0.1; }
    this.gulls = this.gulls.filter((g) => g.x > -20 && g.x < this.W + 20);
    // 魚躍出水面
    if (!this.jumper && rnd() < dt * 0.03) {
      const sp = this.spotPoolSpecies();
      if (sp.length) this.jumper = { fish: sp[Math.floor(rnd() * sp.length)], x: 380 + rnd() * (this.W - 420), t: 0, dir: rnd() < 0.5 ? 1 : -1 };
    }
    if (this.jumper) {
      this.jumper.t += dt;
      if (this.jumper.t > 1.1) { this.splash(Math.round(this.jumper.x + this.jumper.dir * 20), WL, 5); this.jumper = null; }
    }
    // 粒子
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 140) * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    // 煙火
    const season = this.game.season();
    if (this.game.spot.region === 'A' && fireworksTonight(this.cfg, this.game.state.seed, this.game.minutes, season) && rnd() < dt * 0.8) {
      const x = 300 + rnd() * (this.W - 340), y = 20 + rnd() * 50;
      const cols = [C.wa3, C.cl3, C.sea5, C.dk6, C.ui4];
      const c = cols[Math.floor(rnd() * cols.length)];
      for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; this.particles.push({ x, y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, g: 20, life: 1.2, c, sky: true }); }
      this.hooks.sfx?.('firework');
    }
  }

  splash(x, y, n, small = false) {
    for (let i = 0; i < n; i++) this.particles.push({ x: x + (rnd() - 0.5) * 4, y, vx: (rnd() - 0.5) * 40, vy: -40 - rnd() * (small ? 20 : 60), life: 0.5 + rnd() * 0.3, c: C.sea6 });
  }

  sparkle(x, y, n) {
    for (let i = 0; i < n; i++) this.particles.push({ x: x + (rnd() - 0.5) * 50, y: y + (rnd() - 0.5) * 30, vx: (rnd() - 0.5) * 20, vy: -10 - rnd() * 20, g: 0, life: 0.8 + rnd() * 0.8, c: rnd() < 0.5 ? C.wa3 : C.ui4, star: true });
  }

  // ---------- 小卷貓 ----------
  catReact(pose, seconds) { this.cat.pose = pose; this.cat.timer = seconds; this.cat.forced = true; }

  updateCat(dt) {
    const c = this.cat;
    c.frame += dt * 8;
    c.timer -= dt;
    c.sayT = Math.max(0, c.sayT - dt);
    const night = this.game.phase() === 'night';
    if (c.timer > 0) return;
    c.forced = false;
    if (this.state === 'bite' || this.state === 'reel') { c.pose = 'excited'; c.timer = 0.5; return; }
    if (night && this.state !== 'approach') { c.pose = 'sleep'; c.timer = 5; return; }
    if (this.state === 'wait' || this.state === 'approach') { c.pose = 'watch'; c.timer = 1.5; return; }
    const r = rnd();
    c.pose = r < 0.55 ? 'sit' : r < 0.75 ? 'lick' : r < 0.88 ? 'stretch' : 'sit';
    c.timer = 2 + rnd() * 4;
  }

  /** 點小卷貓：呼嚕、翻肚；點太多次會不耐煩地轉頭 */
  tapCat() {
    const c = this.cat;
    const now = this.t;
    c.taps = c.taps.filter((x) => now - x < 4);
    c.taps.push(now);
    const d = this.data.dialog.cat;
    if (c.taps.length > 5) {
      this.catReact('annoyed', 2.5);
      c.say = d.annoyed[Math.floor(rnd() * d.annoyed.length)];
      this.hooks.sfx?.('meowAnnoyed');
    } else {
      const belly = rnd() < 0.4;
      this.catReact(belly ? 'belly' : 'sit', 2);
      c.say = d.purr[Math.floor(rnd() * d.purr.length)];
      this.hooks.sfx?.(belly ? 'meowCute' : 'purr');
    }
    c.sayT = 1.8;
  }

  catRect(W = this.W) {
    const L = this.layout;
    return { x: this.boatX(W) + L.bow - 10, y: WL - L.deck - 16 + this.bob(), w: 20, h: 16 };
  }

  // ---------- 移動過場 ----------
  startTravel(onSwap, onDone) {
    this.travel = { t: 0, phase: 'out', onSwap, onDone, swapped: false };
    this.hooks.sfx?.('engine');
  }

  updateTravel(dt) {
    const tr = this.travel;
    if (!tr) return;
    tr.t += dt;
    const total = this.cfg.travelSeconds;
    if (tr.phase === 'out' && tr.t >= 0.4) { tr.phase = 'sail'; tr.t = 0; }
    else if (tr.phase === 'sail' && tr.t >= total) { tr.phase = 'in'; tr.t = 0; tr.onSwap?.(); this.resetSpot(); }
    else if (tr.phase === 'in' && tr.t >= 0.4) { this.travel = null; tr.onDone?.(); }
  }

  // ---------- 繪製 ----------
  render(ctx, W, opts = {}) {
    this.W = W;
    const g = this.game;
    const sailing = this.travel && this.travel.phase === 'sail';
    const spot = sailing ? { id: 'travel', scene: 'deep_sea' } : g.spot;
    const region = g.region;
    const tone = g.tone();
    const weather = g.weather();
    const L = sceneLayers(spot, region.underwater, tone, weather);
    const T = L.tone;
    const ox = Math.floor((LW - W) / 2);
    const scroll = sailing ? this.travel.t * 60 : 0;
    // 上半部：天空、雲、地面 → 先畫到 above，再鏡射成倒影
    if (!this.above || this.above.w !== W) this.above = makeCanvas(W, WL, false);
    const A = this.above.ctx;
    A.drawImage(L.sky.c, ox, 0, W, WL, 0, 0, W, WL);
    const drift = Math.floor((this.t * (weather === 'windy' ? 6 : 1.5) + scroll * 0.2) % LW);
    A.drawImage(L.clouds.c, -drift + 0, 0); A.drawImage(L.clouds.c, LW - drift, 0);
    if (sailing) {
      const s = Math.floor((scroll * 0.6) % LW);
      A.drawImage(L.land.c, -s, 0); A.drawImage(L.land.c, LW - s, 0);
    } else {
      A.drawImage(L.land.c, ox, 0, W, HZ + 1, 0, 0, W, HZ + 1);
    }
    // 天空中的粒子（煙火）與海鷗
    for (const p of this.particles) if (p.sky && p.y < HZ) px(A, p.x, p.y, p.c);
    for (const gl of this.gulls) drawGull(A, gl.x, gl.y, Math.floor(gl.f), T.night ? C.ba3 : C.ui4, T.night ? C.ba1 : C.ba2);
    ctx.drawImage(this.above.c, 0, 0, W, HZ, 0, 0, W, HZ);

    // 海面：鏡射倒影，每 2–4 列水平錯位做出波紋；整層半透明疊上海色
    const bandH = WL - HZ;
    rect(ctx, 0, HZ, W, bandH, T.band[1]);
    const waveAmp = opts.powerSave ? 0 : weather === 'windy' ? 3 : 2;
    for (let y = 0; y < bandH; y += 2) {
      const srcY = HZ - 1 - Math.floor(y * 1.1);
      if (srcY < 0) break;
      const rowH = 2 + (y % 3 === 0 ? 1 : 0);
      const off = waveAmp ? Math.round(Math.sin(this.t * 1.6 + y * 0.45) * waveAmp * (0.4 + y / bandH)) : 0;
      ctx.drawImage(this.above.c, 0, srcY, W, 1, off, HZ + y, W, rowH);
    }
    ctx.globalAlpha = 0.38;
    rect(ctx, 0, HZ, W, bandH, T.band[0]);
    ctx.globalAlpha = 0.22;
    rect(ctx, 0, HZ + Math.floor(bandH / 2), W, Math.ceil(bandH / 2), T.band[1]);
    ctx.globalAlpha = 1;
    if (!sailing) drawBandObjects(ctx, spot, T, ox);
    // 海平線一條亮線＋波光
    rect(ctx, 0, HZ, W, 1, T.surface);
    for (let i = 0; i < 40; i++) {
      const gx = Math.floor((i * 97 + Math.floor(this.t * (weather === 'windy' ? 14 : 5)) * (i % 3 + 1)) % W);
      const gy = HZ + 3 + ((i * 37) % (bandH - 6));
      const len = 2 + (i % 4);
      if ((Math.floor(this.t * 2) + i) % 5 !== 0) rect(ctx, gx, gy, len, 1, i % 4 === 0 ? T.glint : T.surface);
    }
    if (weather === 'windy') for (let i = 0; i < 14; i++) { const wx = Math.floor((i * 131 + this.t * 20) % W); const wy = HZ + 8 + ((i * 53) % (bandH - 10)); rect(ctx, wx, wy, 3, 1, C.ui4); }

    // 水下剖面
    const uox = sailing ? Math.floor((scroll * 1.2) % LW) : ox;
    if (sailing) { ctx.drawImage(L.under.layer.c, uox, 0, LW - uox, SH - WL, 0, WL, LW - uox, SH - WL); ctx.drawImage(L.under.layer.c, 0, 0, W, SH - WL, LW - uox, WL, W, SH - WL); }
    else ctx.drawImage(L.under.layer.c, ox, 0, W, SH - WL, 0, WL, W, SH - WL);
    drawSeaweed(ctx, L.under, sailing ? uox : ox, W, this.t, T, region.underwater);

    // 魚
    for (const f of this.fishes) {
      const frames = swimFrames(f.fish, f.size, f.dir);
      const s = frames[Math.floor(f.frame) % frames.length];
      ctx.drawImage(s.c, Math.round(f.x), Math.round(f.y - s.h / 2));
    }
    if (this.approach) {
      const a = this.approach;
      const frames = swimFrames(a.fish, a.size, a.dir);
      const s = frames[Math.floor(this.t * (this.state === 'reel' ? 14 : 7)) % frames.length];
      ctx.drawImage(s.c, Math.round(a.x - (a.dir > 0 ? 0 : 0)), Math.round(a.y - s.h / 2));
    }

    // 水面剖面線
    for (let x = 0; x < W; x++) {
      const wy = WL + Math.round(Math.sin(this.t * 2 + x * 0.12) * (opts.powerSave ? 0 : 1));
      px(ctx, x, wy, T.surface);
      px(ctx, x, wy + 1, T.band[0]);
    }

    // 跳魚
    if (this.jumper) {
      const j = this.jumper;
      const k = j.t / 1.1;
      const frames = swimFrames(j.fish, 'M', j.dir);
      const s = frames[1];
      ctx.drawImage(s.c, Math.round(j.x + j.dir * 40 * k - s.w / 2), Math.round(WL - Math.sin(Math.PI * k) * 26 - s.h / 2));
    }

    // 船、玩家、貓
    const bx = this.boatX(W);
    const lay = this.layout;
    const bob = this.bob();
    const boat = boatSprite(this.boatId, !!T.night);
    const by = WL - boat.h + 8 + bob;
    const anim = this.playerAnim();
    const hand = drawPlayer(ctx, bx + lay.seat, WL - lay.deck + bob, anim, this.t, this.holdFish);
    ctx.drawImage(boat.c, bx, by);
    if (anim !== 'celebrate') {
      const tip = this.rodTip(W);
      drawRod(ctx, hand, tip, this.state === 'reel' ? 10 : 3);
      // 釣線
      if (this.state !== 'result' && this.state !== 'stopped' && !this.travel) {
        const sag = this.state === 'reel' || this.state === 'bite' ? 0 : 10;
        curve(ctx, tip.x, tip.y, (tip.x + this.lure.x) / 2 + 4, (tip.y + this.lure.y) / 2 + sag, this.lure.x, this.lure.y, T.line);
        // 擬餌
        const lc = this.game.bait.id === 'glowjig' && T.night ? C.sea5 : C.wa1;
        rect(ctx, this.lure.x - 1, this.lure.y, 3, 2, lc);
        px(ctx, this.lure.x, this.lure.y - 1, C.ui4);
      }
    }
    // 倒影（船的）
    ctx.globalAlpha = 0.25;
    ctx.drawImage(boat.c, 0, boat.h - 4, boat.w, 4, bx, WL + 2, boat.w, 4);
    ctx.globalAlpha = 1;
    const cr = this.catRect(W);
    const cat = catSprite(this.travel ? 'watch' : this.cat.pose, Math.floor(this.cat.frame) % 8);
    ctx.drawImage(cat.c, cr.x, cr.y);

    // 水花、光點
    for (const p of this.particles) {
      if (p.sky) continue;
      if (p.star) { px(ctx, p.x, p.y, p.c); if (p.life > 0.6) { px(ctx, p.x - 1, p.y, p.c); px(ctx, p.x + 1, p.y, p.c); px(ctx, p.x, p.y - 1, p.c); px(ctx, p.x, p.y + 1, p.c); } }
      else rect(ctx, p.x, p.y, 1, 1, p.c);
    }

    // 霧（整層半透明）
    if (weather === 'fog' || T.fog) {
      const dens = weather === 'fog' ? 0.45 : 0.22;
      ctx.globalAlpha = dens;
      rect(ctx, 0, 0, W, WL, C.sky3);
      ctx.globalAlpha = dens * 0.6;
      for (let i = 0; i < 6; i++) rect(ctx, Math.floor((i * 160 + this.t * 4) % (W + 200)) - 100, HZ - 30 + i * 8, 160, 6, C.ui4);
      ctx.globalAlpha = 1;
    }

    // 稀有漁獲光效
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, this.flash * 0.4);
      rect(ctx, 0, 0, W, SH, C.wa3);
      ctx.globalAlpha = 1;
    }

    // 移動過場：Bayer 抖色淡入淡出（不產生調色盤外的顏色）
    if (this.travel) {
      const tr = this.travel;
      let d = 0;
      if (tr.phase === 'out') d = tr.t / 0.4;
      else if (tr.phase === 'in') d = 1 - tr.t / 0.4;
      if (d > 0) ditherFill(ctx, W, SH, d, C.ui0);
    }
  }
}

function easeOut(k) { return 1 - Math.pow(1 - k, 3); }

// 4x4 Bayer 抖色圖樣（17 階），用 pattern 一次填滿整個畫面
const patterns = new Map();
export function ditherFill(ctx, W, H, density, color) {
  const level = Math.max(0, Math.min(16, Math.round(density * 16)));
  if (level === 0) return;
  const key = color + level;
  if (!patterns.has(key)) {
    const p = makeCanvas(4, 4, false);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherOn(x, y, level / 16)) px(p.ctx, x, y, color);
    patterns.set(key, ctx.createPattern(p.c, 'repeat'));
  }
  ctx.fillStyle = patterns.get(key);
  ctx.fillRect(0, 0, W, H);
}

export { SIZES };
