// 讀取並索引所有 JSON 資料。瀏覽器與 Node（測試）共用：呼叫端提供 loader(name) => Promise<object>。

export const DATA_FILES = ['config', 'fish', 'spots', 'rods', 'baits', 'boats', 'backpacks', 'dialog'];

export async function loadData(loader) {
  const raw = {};
  await Promise.all(DATA_FILES.map(async (n) => { raw[n] = await loader(n); }));
  return buildData(raw);
}

export function buildData(raw) {
  const byId = (list, key = 'id') => Object.fromEntries(list.map((x) => [x[key], x]));
  const d = {
    config: raw.config,
    fish: raw.fish.fish,
    regions: raw.spots.regions,
    spots: raw.spots.spots,
    rods: raw.rods.rods,
    baits: raw.baits.baits,
    boats: raw.boats.boats,
    backpacks: raw.backpacks.backpacks,
    dialog: raw.dialog,
  };
  d.fishById = byId(d.fish);
  d.spotById = byId(d.spots);
  d.regionById = byId(d.regions);
  d.rodById = byId(d.rods);
  d.baitById = byId(d.baits);
  d.boatById = byId(d.boats);
  d.backpackByLevel = byId(d.backpacks, 'level');
  return d;
}

/** 檢查資料彼此參照是否正確；回傳錯誤訊息陣列（空陣列代表沒問題） */
export function validateData(d) {
  const errors = [];
  const cfg = d.config;
  const rarities = cfg.rarity.order;
  const sizes = Object.keys(cfg.sizes.shapes);
  const times = ['all', 'dawn', 'day', 'dusk', 'night'];
  const seasons = cfg.seasons.order;
  const maxPack = d.backpacks[d.backpacks.length - 1];
  const ids = new Set();
  for (const f of d.fish) {
    if (ids.has(f.id)) errors.push(`魚種 id 重複：${f.id}`);
    ids.add(f.id);
    if (!rarities.includes(f.rarity)) errors.push(`${f.name} 稀有度錯誤：${f.rarity}`);
    if (!(f.w[0] > 0 && f.w[1] > f.w[0])) errors.push(`${f.name} 重量範圍錯誤`);
    if (!(f.price > 0)) errors.push(`${f.name} 單價錯誤`);
    for (const s of f.spots) if (!d.spotById[s]) errors.push(`${f.name} 的釣點不存在：${s}`);
    for (const b of f.baits) if (!d.baitById[b]) errors.push(`${f.name} 的魚餌不存在：${b}`);
    for (const t of f.time) if (!times.includes(t)) errors.push(`${f.name} 時段錯誤：${t}`);
    for (const s of Object.keys(f.season || {})) if (!seasons.includes(s)) errors.push(`${f.name} 季節錯誤：${s}`);
    for (const s of f.season_only || []) if (!seasons.includes(s)) errors.push(`${f.name} 季節錯誤：${s}`);
    if (f.shape) {
      for (const [k, v] of Object.entries(f.shape)) {
        if (k !== 'all' && !sizes.includes(k)) errors.push(`${f.name} 形狀覆寫的體型錯誤：${k}`);
        const fits = (v[0] <= maxPack.rows && v[1] <= maxPack.cols) || (v[1] <= maxPack.rows && v[0] <= maxPack.cols);
        if (!fits) errors.push(`${f.name} 的形狀 ${v.join('x')} 放不進最大背包`);
      }
    }
  }
  for (const s of d.spots) if (!d.regionById[s.region]) errors.push(`釣點 ${s.id} 的海域不存在`);
  for (const b of d.boats) for (const r of b.regions) if (!d.regionById[r]) errors.push(`船 ${b.name} 的海域不存在：${r}`);
  for (const p of d.backpacks) if (p.require?.boat && !d.boatById[p.require.boat]) errors.push(`背包 ${p.level} 需要的船不存在`);
  return errors;
}
