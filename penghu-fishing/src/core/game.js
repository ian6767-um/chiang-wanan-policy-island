// 遊戲模型（不含畫面）：狀態、圖鑑、背包、商店、移動、自動規則。
import { Backpack } from './backpack.js';
import { phaseOf, toneOf, weatherOf, seasonOf, dayOf, regionBlocked, realToGameMinutes } from './clock.js';
import { rollCatch, rarityIndex, rollWait } from './fishing.js';
import { dailyMarket, sellPrice } from './market.js';

export const SAVE_VERSION = 2;

export function defaultSettings() {
  return {
    music: 0.5, sfx: 0.8, fullscreen: false, scale: 'auto', speed: 1,
    powerSave: false, seasons: true, autoKeep: true, debug: false,
  };
}

export function newState(data, now = Date.now(), seed = Math.floor(Math.random() * 1e9)) {
  const cfg = data.config;
  const pack = data.backpacks[0];
  return {
    version: SAVE_VERSION,
    seed: String(seed),
    createdAt: now,
    lastPlayed: now,
    coins: cfg.startCoins,
    spot: cfg.startSpot,
    rod: data.rods[0].id,
    bait: data.baits[0].id,
    boat: data.boats[0].id,
    owned: { rods: [data.rods[0].id], baits: [data.baits[0].id], boats: [data.boats[0].id] },
    packLevel: pack.level,
    backpack: { rows: pack.rows, cols: pack.cols, items: [] },
    codex: {},
    milestones: [],
    ended: false,
    clock: { minutes: cfg.clock.startMinute },
    legend: { day: 0, spots: {} },
    settings: defaultSettings(),
    rules: { releaseBelow: null, whenFull: 'ask' },
    stats: { caught: 0, kept: 0, released: 0, broke: 0, sold: 0, earned: 0 },
  };
}

export class Game {
  constructor(data, state) {
    this.data = data;
    this.cfg = data.config;
    this.state = state;
    this.pack = Backpack.fromJSON(state.backpack);
    this.listeners = new Set();
    this._marketCache = null;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, payload) { for (const fn of this.listeners) fn(type, payload); }

  /** 把背包同步回 state（存檔前呼叫） */
  sync() { this.state.backpack = this.pack.toJSON(); return this.state; }

  // ---------- 時間與環境 ----------
  get minutes() { return this.state.clock.minutes; }
  get day() { return dayOf(this.minutes); }
  phase(m = this.minutes) { return phaseOf(this.cfg, m); }
  tone(m = this.minutes) { return toneOf(this.cfg, m); }
  season(nowMs = Date.now()) { return seasonOf(this.cfg, this.state.settings, this.state.createdAt, nowMs); }
  weather(m = this.minutes, nowMs = Date.now()) { return weatherOf(this.cfg, this.state.seed, m, this.season(nowMs)); }

  advanceClock(realSeconds, speed = 1) {
    this.state.clock.minutes += realToGameMinutes(this.cfg, realSeconds, speed * (this.state.settings.speed || 1));
  }

  env(nowMs = Date.now(), m = this.minutes) {
    const season = this.season(nowMs);
    return {
      spotId: this.state.spot,
      baitId: this.state.bait,
      phase: this.phase(m),
      weather: weatherOf(this.cfg, this.state.seed, m, season),
      season,
      legendaryBlocked: this.legendaryBlocked(this.state.spot, dayOf(m)),
      date: nowMs,
    };
  }

  get spot() { return this.data.spotById[this.state.spot]; }
  get rod() { return this.data.rodById[this.state.rod]; }
  get bait() { return this.data.baitById[this.state.bait]; }
  get boat() { return this.data.boatById[this.state.boat]; }
  get region() { return this.data.regionById[this.spot.region]; }

  legendaryBlocked(spotId, day) {
    const L = this.state.legend;
    if (L.day !== day) return false;
    return (L.spots[spotId] || 0) >= this.cfg.rarity.legendaryPerSpotPerDay;
  }

  noteLegendary(spotId, day) {
    const L = this.state.legend;
    if (L.day !== day) { L.day = day; L.spots = {}; }
    L.spots[spotId] = (L.spots[spotId] || 0) + 1;
  }

  rollWait(rand) { return rollWait(this.data, this.spot, this.bait, rand); }

  /** 抽一次魚（含傳說魚每日限制的記錄）；沒有魚吃這個餌時回傳 null */
  roll(rand, nowMs = Date.now(), m = this.minutes) {
    const env = this.env(nowMs, m);
    const res = rollCatch(this.data, env, this.rod, rand);
    if (res && res.fish.rarity === 'legendary') this.noteLegendary(env.spotId, dayOf(m));
    return res;
  }

  // ---------- 圖鑑 ----------
  codexEntry(id) {
    if (!this.state.codex[id]) this.state.codex[id] = { seen: false, caught: 0, sizes: {}, best: null };
    return this.state.codex[id];
  }

  caughtSpecies() { return Object.values(this.state.codex).filter((e) => e.caught > 0).length; }

  /** 斷線：記為「看過」 */
  recordSeen(inst) {
    const e = this.codexEntry(inst.sp);
    e.seen = true;
    this.state.stats.broke++;
  }

  /** 釣上來（不論保留或放生）都記入圖鑑；回傳 { newSpecies, newRecord, milestone } */
  recordCatch(inst) {
    const e = this.codexEntry(inst.sp);
    const newSpecies = e.caught === 0;
    e.seen = true;
    e.caught++;
    e.sizes[inst.size] = true;
    const newRecord = !e.best || inst.w > e.best.w;
    if (newRecord) {
      e.best = { w: inst.w, size: inst.size, rod: inst.rod, bait: inst.bait, spot: inst.spot, at: inst.at };
    }
    this.state.stats.caught++;
    let milestone = null;
    if (newSpecies) milestone = this.checkMilestones();
    return { newSpecies, newRecord: newRecord && !newSpecies, milestone };
  }

  checkMilestones() {
    const n = this.caughtSpecies();
    let hit = null;
    for (const m of this.cfg.milestones) {
      if (n >= m.count && !this.state.milestones.includes(m.count)) {
        this.state.milestones.push(m.count);
        this.addCoins(m.coins);
        hit = m;
      }
    }
    if (n >= this.data.fish.length && !this.state.ended) {
      this.state.ended = true;
      this.emit('ending');
    }
    if (hit) this.emit('milestone', hit);
    return hit;
  }

  // ---------- 漁獲處理 ----------
  /** 自動規則：回傳 'release'（低於設定稀有度）或 null */
  autoRelease(inst) {
    const below = this.state.rules.releaseBelow;
    if (!below) return false;
    const fish = this.data.fishById[inst.sp];
    return rarityIndex(this.cfg, fish.rarity) < rarityIndex(this.cfg, below);
  }

  canKeep(inst) { return !!this.pack.findSpot({ uid: inst.uid, fish: inst }); }

  keep(inst) {
    const ok = this.pack.autoPlace({ uid: inst.uid, fish: inst });
    if (ok) { this.state.stats.kept++; this.emit('backpack'); }
    return ok;
  }

  release() { this.state.stats.released++; }

  discard(uid) {
    const it = this.pack.remove(uid);
    if (it) { this.state.stats.released++; this.emit('backpack'); }
    return it;
  }

  // ---------- 魚市 ----------
  market() {
    if (!this._marketCache || this._marketCache.day !== this.day) {
      this._marketCache = dailyMarket(this.data, this.state.seed, this.day);
    }
    return this._marketCache;
  }

  priceOfItem(inst) { return sellPrice(this.data, this.market(), inst); }

  packValue() { return this.pack.items.reduce((s, it) => s + this.priceOfItem(it.fish), 0); }

  get atHarbor() { return !!this.spot.harbor; }

  /** 賣出指定的 uid 陣列；回傳 { coins, count } */
  sell(uids) {
    if (!this.atHarbor) return { coins: 0, count: 0 };
    let coins = 0, count = 0;
    for (const uid of uids) {
      const it = this.pack.get(uid);
      if (!it) continue;
      coins += this.priceOfItem(it.fish);
      this.pack.remove(uid);
      count++;
    }
    this.state.stats.sold += count;
    this.state.stats.earned += coins;
    this.addCoins(coins);
    if (count) this.emit('backpack');
    return { coins, count };
  }

  sellAll(keepRareUp = false) {
    const rareIdx = rarityIndex(this.cfg, 'rare');
    const uids = this.pack.items
      .filter((it) => !keepRareUp || rarityIndex(this.cfg, this.data.fishById[it.fish.sp].rarity) < rareIdx)
      .map((it) => it.uid);
    return this.sell(uids);
  }

  addCoins(n) { this.state.coins += n; this.emit('coins', n); }

  // ---------- 商店 ----------
  bestBoat() {
    const owned = this.state.owned.boats;
    return this.data.boats.filter((b) => owned.includes(b.id)).pop();
  }

  owns(kind, id) {
    if (kind === 'backpack') return this.state.packLevel >= id;
    return this.state.owned[kind + 's'].includes(id);
  }

  /** { ok, reason } reason：owned / poor / locked / prev */
  canBuy(kind, id) {
    const item = this.shopItem(kind, id);
    if (!item) return { ok: false, reason: 'missing' };
    if (this.owns(kind, id)) return { ok: false, reason: 'owned' };
    if (kind === 'backpack') {
      if (id !== this.state.packLevel + 1) return { ok: false, reason: 'prev', text: `需要先買 ${this.data.backpackByLevel[id - 1].rows}x${this.data.backpackByLevel[id - 1].cols} 背包` };
      if (item.require?.boat && !this.owns('boat', item.require.boat)) return { ok: false, reason: 'locked', text: `需要擁有${this.data.boatById[item.require.boat].name}` };
    }
    if (kind === 'rod' && item.require?.codex && this.caughtSpecies() < item.require.codex) {
      return { ok: false, reason: 'locked', text: `圖鑑需收集 ${item.require.codex} 種（目前 ${this.caughtSpecies()}）` };
    }
    if (kind === 'boat') {
      const idx = this.data.boats.indexOf(item);
      const prev = this.data.boats[idx - 1];
      if (prev && !this.owns('boat', prev.id)) return { ok: false, reason: 'prev', text: `需要先擁有${prev.name}` };
    }
    if (this.state.coins < item.price) return { ok: false, reason: 'poor' };
    return { ok: true };
  }

  shopItem(kind, id) {
    if (kind === 'rod') return this.data.rodById[id];
    if (kind === 'bait') return this.data.baitById[id];
    if (kind === 'boat') return this.data.boatById[id];
    if (kind === 'backpack') return this.data.backpackByLevel[id];
    return null;
  }

  buy(kind, id) {
    const chk = this.canBuy(kind, id);
    if (!chk.ok) return chk;
    const item = this.shopItem(kind, id);
    this.state.coins -= item.price;
    this.emit('coins', -item.price);
    if (kind === 'backpack') {
      this.state.packLevel = id;
      this.pack.resize(item.rows, item.cols);
      this.emit('backpack');
    } else {
      this.state.owned[kind + 's'].push(id);
      if (kind === 'boat') this.state.boat = this.bestBoat().id;
    }
    return { ok: true };
  }

  equip(kind, id) {
    if (!this.owns(kind, id)) return false;
    if (kind === 'rod') this.state.rod = id;
    if (kind === 'bait') this.state.bait = id;
    this.emit('equip', { kind, id });
    return true;
  }

  // ---------- 移動 ----------
  canTravel(spotId, nowMs = Date.now()) {
    const spot = this.data.spotById[spotId];
    if (!spot) return { ok: false, reason: 'missing' };
    const boat = this.bestBoat();
    if (!boat.regions.includes(spot.region)) {
      const need = this.data.boats.find((b) => b.regions.includes(spot.region));
      return { ok: false, reason: 'boat', text: `需要${need.name}` };
    }
    const season = this.season(nowMs);
    if (regionBlocked(this.cfg, spot.region, season, this.weather(this.minutes, nowMs))) {
      return { ok: false, reason: 'wind', text: '東北季風太強，今天北海不能出海' };
    }
    return { ok: true };
  }

  travel(spotId, nowMs = Date.now()) {
    const chk = this.canTravel(spotId, nowMs);
    if (!chk.ok) return chk;
    this.state.spot = spotId;
    this.emit('travel', spotId);
    return { ok: true };
  }
}
