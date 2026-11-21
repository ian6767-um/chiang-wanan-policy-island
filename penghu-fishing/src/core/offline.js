// 離線收益：依最後的釣點、竿、餌，模擬離線期間的漁獲（上限 offline.maxHours 小時）。
import { averageCycleSeconds } from './fishing.js';
import { realToGameMinutes } from './clock.js';

/**
 * game: Game 實例（會直接修改狀態）
 * seconds: 離線的現實秒數
 * rand: 亂數
 * nowMs: 目前現實時間（用來判斷季節）
 */
export function simulateOffline(game, seconds, rand, nowMs = Date.now()) {
  const cfg = game.cfg;
  const capped = Math.min(seconds, cfg.offline.maxHours * 3600);
  const summary = {
    seconds: capped, rawSeconds: seconds, attempts: 0, caught: 0, kept: [], released: 0, autoReleased: 0,
    broke: 0, noBite: 0, stoppedFull: false, newSpecies: [], gameMinutes: 0,
  };
  if (capped < cfg.offline.minSeconds) {
    game.advanceClock(capped);
    return summary;
  }
  const speed = game.state.settings.speed || 1;
  const cycle = averageCycleSeconds(game.data, game.spot, game.bait) / speed;
  const n = Math.floor(capped / cycle);
  const startMinutes = game.state.clock.minutes;
  const minutesPerCycle = realToGameMinutes(cfg, cycle, speed);
  const rules = game.state.rules;
  for (let i = 0; i < n; i++) {
    const m = startMinutes + (i + 1) * minutesPerCycle;
    game.state.clock.minutes = m;
    summary.attempts++;
    const res = game.roll(rand, nowMs, m);
    if (!res) { summary.noBite++; continue; }
    if (res.broke) { game.recordSeen(res.instance); summary.broke++; continue; }
    summary.caught++;
    const rec = game.recordCatch(res.instance);
    if (rec.newSpecies) summary.newSpecies.push(res.fish.id);
    if (game.autoRelease(res.instance)) { game.release(); summary.autoReleased++; continue; }
    if (game.keep(res.instance)) { summary.kept.push(res.instance); continue; }
    // 背包滿了
    if (rules.whenFull === 'release') { game.release(); summary.released++; continue; }
    // 'stop' 或 'ask'（沒有人可以回答）→ 停止釣魚，這條也放掉
    game.release();
    summary.released++;
    summary.stoppedFull = true;
    break;
  }
  // 時鐘走完整段離線時間（停止釣魚後時間仍然流逝）
  game.state.clock.minutes = startMinutes + realToGameMinutes(cfg, capped, speed);
  summary.gameMinutes = game.state.clock.minutes - startMinutes;
  return summary;
}
