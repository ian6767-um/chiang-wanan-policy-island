// 遊戲內時鐘、時段、天氣、季節。全部是純函式，方便離線模擬與測試。
import { seeded, weightedPick } from './rng.js';

export const PHASE_NAMES = { dawn: '清晨', day: '白天', dusk: '黃昏', night: '夜晚' };
export const WEATHER_NAMES = { sunny: '晴', cloudy: '多雲', fog: '起霧', windy: '強風' };

export function dayOf(minutes) { return Math.floor(minutes / 1440) + 1; }
export function hourOf(minutes) { return Math.floor((((minutes % 1440) + 1440) % 1440) / 60); }
export function minuteOfDay(minutes) { return ((minutes % 1440) + 1440) % 1440; }

export function formatClock(minutes) {
  const m = minuteOfDay(minutes);
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(Math.floor(m % 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 四個遊戲時段：dawn / day / dusk / night */
export function phaseOf(cfg, minutes) {
  const h = minuteOfDay(minutes) / 60;
  const p = cfg.clock.phases;
  if (h >= p.dawn[0] && h < p.dawn[1]) return 'dawn';
  if (h >= p.day[0] && h < p.day[1]) return 'day';
  if (h >= p.dusk[0] && h < p.dusk[1]) return 'dusk';
  return 'night';
}

/** 畫面色調：清晨霧、白天、黃金時段、紫粉色夕陽、夜晚 */
export function toneOf(cfg, minutes) {
  const phase = phaseOf(cfg, minutes);
  if (phase === 'dusk') {
    const h = minuteOfDay(minutes) / 60;
    return h < cfg.clock.goldenHourEnd ? 'golden' : 'sunset';
  }
  return phase;
}

/** 季節：現實時間每 N 天換一季；關閉時回傳 null（不套用季節修正） */
export function seasonOf(cfg, settings, createdAtMs, nowMs) {
  if (!cfg.seasons.enabled || settings?.seasons === false) return null;
  const days = Math.max(0, (nowMs - createdAtMs) / 86400000);
  const idx = Math.floor(days / cfg.seasons.realDaysPerSeason) % cfg.seasons.order.length;
  return cfg.seasons.order[idx];
}

/** 天氣：每 blockHours 個遊戲小時抽一次，由種子決定（離線模擬也能重現） */
export function weatherOf(cfg, seed, minutes, season) {
  const block = Math.floor(minutes / (cfg.weather.blockHours * 60));
  const rand = seeded(seed, 'weather', block);
  const bh = cfg.weather.blockHours;
  const startH = ((block * bh) % 24 + 24) % 24;
  const [d0, d1] = cfg.clock.phases.dawn;
  const coversDawn = startH < d1 && startH + bh > d0; // 這段時間有包含清晨 → 起霧機率高
  let w = cfg.weather.weights.other;
  if (season === 'winter') w = cfg.weather.weights.winter;
  if (coversDawn) w = cfg.weather.weights.dawn;
  return weightedPick(rand, Object.entries(w).map(([item, weight]) => ({ item, weight })));
}

/** 冬季強風：北海不能出海 */
export function regionBlocked(cfg, regionId, season, weather) {
  return season === 'winter' && weather === 'windy' && regionId === cfg.seasons.winterWindBlocksRegion;
}

/** 夏季夜晚的煙火（只有視覺），每個遊戲夜由種子決定有沒有 */
export function fireworksTonight(cfg, seed, minutes, season) {
  if (season !== 'summer') return false;
  if (phaseOf(cfg, minutes) !== 'night') return false;
  const night = dayOf(minutes - 300); // 跨午夜仍算同一晚
  return seeded(seed, 'fireworks', night)() < cfg.seasons.fireworksChancePerNight;
}

export function realToGameMinutes(cfg, realSeconds, speed = 1) {
  return (realSeconds / 60) * cfg.clock.gameMinutesPerRealMinute * speed;
}
