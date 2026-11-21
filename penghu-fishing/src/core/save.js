// 存檔：JSON + 版本號 + 逐版升級。儲存位置由呼叫端提供（瀏覽器用 localStorage）。
import { SAVE_VERSION, newState, defaultSettings } from './game.js';

export const SAVE_KEY = 'penghu-slow-fishing-save';

export function serialize(game, nowMs = Date.now()) {
  const s = game.sync();
  s.version = SAVE_VERSION;
  s.lastPlayed = nowMs;
  return JSON.stringify(s);
}

/** 逐版升級：每一版只處理和上一版的差異 */
const MIGRATIONS = {
  // v1 → v2：加入自動規則 whenFull、統計 kept、設定 autoKeep
  1: (s) => {
    s.rules = { releaseBelow: s.rules?.releaseBelow ?? null, whenFull: s.rules?.whenFull ?? 'ask' };
    s.stats = { caught: 0, kept: 0, released: 0, broke: 0, sold: 0, earned: 0, ...(s.stats || {}) };
    s.settings = { ...defaultSettings(), ...(s.settings || {}) };
    s.version = 2;
    return s;
  },
};

export function migrate(s) {
  if (typeof s.version !== 'number') throw new Error('存檔沒有版本號');
  if (s.version > SAVE_VERSION) throw new Error(`存檔版本 ${s.version} 比遊戲新`);
  while (s.version < SAVE_VERSION) {
    const fn = MIGRATIONS[s.version];
    if (!fn) throw new Error(`無法從版本 ${s.version} 升級`);
    s = fn(s);
  }
  return s;
}

/** 讀檔：損毀或格式錯誤時回傳 null；缺少的欄位用預設值補齊 */
export function deserialize(data, text) {
  if (!text) return null;
  let s;
  try { s = JSON.parse(text); } catch { return null; }
  if (!s || typeof s !== 'object') return null;
  try { s = migrate(s); } catch { return null; }
  const base = newState(data, s.createdAt || Date.now(), s.seed);
  const merged = { ...base, ...s };
  merged.settings = { ...base.settings, ...(s.settings || {}) };
  merged.owned = { ...base.owned, ...(s.owned || {}) };
  merged.stats = { ...base.stats, ...(s.stats || {}) };
  merged.rules = { ...base.rules, ...(s.rules || {}) };
  // 防呆：資料表改版後，存檔裡已不存在的東西要退回預設
  if (!data.spotById[merged.spot]) merged.spot = data.config.startSpot;
  if (!merged.owned.rods.includes(merged.rod) || !data.rodById[merged.rod]) merged.rod = data.rods[0].id;
  if (!merged.owned.baits.includes(merged.bait) || !data.baitById[merged.bait]) merged.bait = data.baits[0].id;
  merged.backpack.items = (merged.backpack.items || []).filter((it) => data.fishById[it.fish?.sp]);
  return merged;
}
