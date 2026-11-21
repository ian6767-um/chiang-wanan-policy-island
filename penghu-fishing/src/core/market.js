// 每日魚價：每個遊戲日重新抽一次，每種魚 ×0.8–1.2，另外抽熱門魚 ×1.5。
import { seeded, pickN } from './rng.js';
import { priceOf } from './fishing.js';

export function dailyMarket(data, seed, day) {
  const m = data.config.market;
  const mult = {};
  if (!m.enabled) {
    for (const f of data.fish) mult[f.id] = 1;
    return { day, mult, hot: [] };
  }
  const rand = seeded(seed, 'market', day);
  for (const f of data.fish) {
    mult[f.id] = Math.round((m.dailyMin + (m.dailyMax - m.dailyMin) * rand()) * 100) / 100;
  }
  // 熱門魚只從普通、少見魚中抽，避免稀有魚價格爆衝
  const candidates = data.fish.filter((f) => f.rarity === 'common' || f.rarity === 'uncommon').map((f) => f.id);
  const hot = pickN(rand, candidates, m.hotCount);
  for (const id of hot) mult[id] = m.hotMult;
  return { day, mult, hot };
}

export function sellPrice(data, market, inst) {
  const fish = data.fishById[inst.sp];
  return priceOf(data.config, fish, inst.w, inst.size, market?.mult?.[inst.sp] ?? 1);
}

export function basePrice(data, inst) {
  return priceOf(data.config, data.fishById[inst.sp], inst.w, inst.size, 1);
}
