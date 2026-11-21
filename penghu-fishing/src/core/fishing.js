// 釣魚規則：魚池、抽魚、重量、體型、形狀、斷線、售價。
import { weightedPick, randRange } from './rng.js';

export const SIZES = ['S', 'M', 'L', 'XL'];

/** fish.time 是否包含目前時段 */
export function timeMatches(fish, phase) {
  return fish.time.includes('all') || fish.time.includes(phase);
}

/**
 * 目前可以上鉤的魚與權重。
 * env: { spotId, baitId, phase, weather, season, legendaryBlocked:boolean }
 */
export function buildPool(data, env) {
  const cfg = data.config;
  const pool = [];
  for (const f of data.fish) {
    if (!f.spots.includes(env.spotId)) continue;
    if (!f.baits.includes(env.baitId)) continue;
    if (!timeMatches(f, env.phase)) continue;
    if (f.weather && !f.weather.includes(env.weather)) continue;
    if (f.season_only && env.season && !f.season_only.includes(env.season)) continue;
    if (f.rarity === 'legendary' && env.legendaryBlocked) continue;
    let weight = cfg.rarity.weights[f.rarity];
    if (env.season && f.season?.[env.season]) weight *= f.season[env.season];
    pool.push({ item: f, weight });
  }
  return pool;
}

/** 這個釣點＋魚餌在「任何」時段/天氣/季節下是否有魚（給 UI 提示用） */
export function anyFishFor(data, spotId, baitId) {
  return data.fish.filter((f) => f.spots.includes(spotId) && f.baits.includes(baitId));
}

/** 偏向小魚的重量分佈：min + (max-min) * rand^k */
export function rollWeight(cfg, fish, rand) {
  const [min, max] = fish.w;
  const t = Math.pow(rand(), cfg.fishing.weightExponent);
  const w = min + (max - min) * t;
  return roundWeight(w);
}

export function roundWeight(w) {
  return w < 10 ? Math.round(w * 100) / 100 : Math.round(w * 10) / 10;
}

/** 依重量在該魚種範圍內的百分位決定體型 */
export function sizeFor(cfg, fish, weight) {
  const [min, max] = fish.w;
  const t = (weight - min) / (max - min);
  const th = cfg.sizes.thresholds;
  if (t < th.S) return 'S';
  if (t < th.M) return 'M';
  if (t < th.L) return 'L';
  return 'XL';
}

/** 背包形狀 [rows, cols]：魚種可覆寫（all 或個別體型） */
export function shapeFor(cfg, fish, size) {
  const o = fish.shape;
  if (o?.all) return o.all.slice();
  if (o?.[size]) return o[size].slice();
  return cfg.sizes.shapes[size].slice();
}

/** 斷線機率 = min(cap, 魚重 / 拉力 - 1)，魚重 ≤ 拉力時為 0 */
export function breakChance(cfg, weight, pull) {
  if (weight <= pull) return 0;
  return Math.min(cfg.fishing.breakCap, weight / pull - 1);
}

/** 售價 = 單價 × 重量 × 體型加成 × 當日倍率，四捨五入 */
export function priceOf(cfg, fish, weight, size, dailyMult = 1) {
  return Math.round(fish.price * weight * cfg.sizes.priceMult[size] * dailyMult);
}

let uidCounter = 0;
export function newUid(rand) {
  uidCounter = (uidCounter + 1) % 1e6;
  return `${Date.now().toString(36)}-${Math.floor(rand() * 1e9).toString(36)}-${uidCounter}`;
}

/**
 * 一次完整的抽魚：回傳 null（沒有魚咬）或
 * { fish, instance, broke, breakChance }
 */
export function rollCatch(data, env, rod, rand) {
  const pool = buildPool(data, env);
  const fish = weightedPick(rand, pool);
  if (!fish) return null;
  return makeCatch(data, fish, env, rod, rand);
}

export function makeCatch(data, fish, env, rod, rand, forcedWeight = null) {
  const cfg = data.config;
  const weight = forcedWeight ?? rollWeight(cfg, fish, rand);
  const size = sizeFor(cfg, fish, weight);
  const chance = breakChance(cfg, weight, rod.pull);
  const broke = chance > 0 && rand() < chance;
  const instance = {
    uid: newUid(rand),
    sp: fish.id,
    w: weight,
    size,
    shape: shapeFor(cfg, fish, size),
    spot: env.spotId,
    rod: rod.id,
    bait: env.baitId,
    at: env.date ?? Date.now(),
  };
  return { fish, instance, broke, breakChance: chance };
}

/** 等待時間（秒）：隨機 waitMin–waitMax，再乘上魚餌與釣點的倍率 */
export function rollWait(data, spot, bait, rand) {
  const f = data.config.fishing;
  return randRange(rand, f.waitMin, f.waitMax) * (bait.wait ?? 1) * (spot.wait ?? 1);
}

/** 一次釣魚平均要花的秒數（離線模擬用） */
export function averageCycleSeconds(data, spot, bait) {
  const f = data.config.fishing;
  const wait = ((f.waitMin + f.waitMax) / 2) * (bait.wait ?? 1) * (spot.wait ?? 1);
  return f.castTime + wait + f.approachTime + f.biteTime + (f.reelTimeMin + f.reelTimeMax) / 2 + data.config.offline.cardHandling;
}

export function rarityIndex(cfg, rarity) {
  return cfg.rarity.order.indexOf(rarity);
}
