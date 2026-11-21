// 可重現的亂數：mulberry32 + 字串雜湊。測試與「每日魚價」「天氣」都需要固定種子。

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由多個片段組成種子的亂數產生器 */
export function seeded(...parts) {
  return mulberry32(hashString(parts.join('|')));
}

export function randRange(rand, min, max) {
  return min + (max - min) * rand();
}

export function randInt(rand, min, maxInclusive) {
  return Math.floor(min + (maxInclusive - min + 1) * rand());
}

/** 依權重抽一個項目；items 為 [{item, weight}]，全部權重為 0 時回傳 null */
export function weightedPick(rand, entries) {
  let total = 0;
  for (const e of entries) total += Math.max(0, e.weight);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const e of entries) {
    const w = Math.max(0, e.weight);
    if (r < w) return e.item;
    r -= w;
  }
  return entries[entries.length - 1].item;
}

export function pickN(rand, list, n) {
  const copy = list.slice();
  const out = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}
