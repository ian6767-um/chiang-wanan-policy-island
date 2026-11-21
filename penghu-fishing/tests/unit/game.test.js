import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, newState } from '../../src/core/game.js';
import { makeCatch } from '../../src/core/fishing.js';
import { simulateOffline } from '../../src/core/offline.js';
import { serialize, deserialize, migrate } from '../../src/core/save.js';
import { dailyMarket } from '../../src/core/market.js';
import { phaseOf, toneOf, weatherOf, seasonOf, regionBlocked, formatClock } from '../../src/core/clock.js';
import { mulberry32 } from '../../src/core/rng.js';
import { loadDataSync } from './helpers.js';

const data = loadDataSync();
const cfg = data.config;
const NOW = Date.UTC(2026, 0, 1);
const mk = () => new Game(data, newState(data, NOW, 42));
const env = (g) => g.env(NOW);
const catchOf = (g, id, w) => makeCatch(data, data.fishById[id], env(g), g.rod, mulberry32(1), w).instance;

test('新遊戲：在馬公第三漁港，竹仔竿、南極蝦、舢舨、3x8 背包', () => {
  const g = mk();
  assert.equal(g.spot.name, '馬公第三漁港');
  assert.deepEqual([g.rod.pull, g.bait.name, g.boat.name, g.pack.rows, g.pack.cols], [2, '南極蝦', '舢舨', 3, 8]);
  assert.ok(g.atHarbor);
});

test('圖鑑：保留或放生都算釣到，斷線只算看過；新紀錄', () => {
  const g = mk();
  const a = catchOf(g, 'f01', 0.3);
  assert.deepEqual(g.recordCatch(a), { newSpecies: true, newRecord: false, milestone: null });
  const b = catchOf(g, 'f01', 0.5);
  assert.equal(g.recordCatch(b).newRecord, true);
  assert.equal(g.recordCatch(catchOf(g, 'f01', 0.2)).newRecord, false);
  assert.equal(g.state.codex.f01.caught, 3);
  assert.equal(g.state.codex.f01.best.w, 0.5);
  g.recordSeen(catchOf(g, 'f41', 100));
  assert.deepEqual([g.state.codex.f41.seen, g.state.codex.f41.caught], [true, 0]);
  assert.equal(g.caughtSpecies(), 1);
});

test('收集里程碑給金幣，50 種觸發結局', () => {
  const g = mk();
  let ending = false;
  g.on((t) => { if (t === 'ending') ending = true; });
  for (const f of data.fish.slice(0, 10)) g.recordCatch(catchOf(g, f.id, f.w[0]));
  assert.equal(g.state.coins, 500);
  for (const f of data.fish.slice(10)) g.recordCatch(catchOf(g, f.id, f.w[0]));
  assert.equal(g.state.coins, 500 + 3000 + 15000 + 50000);
  assert.ok(ending && g.state.ended);
});

test('自動規則：低於設定稀有度自動放生', () => {
  const g = mk();
  g.state.rules.releaseBelow = 'rare';
  assert.equal(g.autoRelease(catchOf(g, 'f01', 0.2)), true);   // 普通
  assert.equal(g.autoRelease(catchOf(g, 'f20', 1)), true);     // 少見
  assert.equal(g.autoRelease(catchOf(g, 'f36', 1)), false);    // 稀有
  g.state.rules.releaseBelow = null;
  assert.equal(g.autoRelease(catchOf(g, 'f01', 0.2)), false);
});

test('魚市：只能在港口賣；全部賣出（保留稀有以上）', () => {
  const g = mk();
  const small = catchOf(g, 'f01', 0.5);
  const rare = catchOf(g, 'f36', 1);
  g.keep(small); g.keep(rare);
  const expect = g.priceOfItem(small);
  const r = g.sellAll(true);
  assert.deepEqual([r.count, r.coins], [1, expect]);
  assert.equal(g.pack.items.length, 1);
  g.state.spot = 'A1';
  assert.deepEqual(g.sellAll(false), { coins: 0, count: 0 });
  g.state.spot = 'A2';
  assert.equal(g.sellAll(false).count, 1);
});

test('每日魚價：同一天結果相同、範圍 0.8–1.2、熱門魚 x1.5', () => {
  const a = dailyMarket(data, 's', 3), b = dailyMarket(data, 's', 3), c = dailyMarket(data, 's', 4);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.mult, c.mult);
  assert.equal(a.hot.length, 2);
  for (const [id, m] of Object.entries(a.mult)) {
    if (a.hot.includes(id)) assert.equal(m, 1.5); else assert.ok(m >= 0.8 && m <= 1.2);
  }
});

test('商店：錢不夠、已擁有、背包需要依序與船的條件、龍骨竿需要圖鑑 40 種', () => {
  const g = mk();
  assert.equal(g.canBuy('rod', 'rod2').reason, 'poor');
  g.state.coins = 1e6;
  assert.equal(g.canBuy('rod', 'rod1').reason, 'owned');
  assert.equal(g.canBuy('backpack', 3).reason, 'prev');
  assert.ok(g.buy('backpack', 2).ok);
  assert.equal(g.canBuy('backpack', 3).reason, 'locked');
  assert.equal(g.canBuy('boat', 'boat3').reason, 'prev');
  assert.ok(g.buy('boat', 'boat2').ok);
  assert.equal(g.boat.id, 'boat2');
  assert.ok(g.buy('backpack', 3).ok);
  assert.deepEqual([g.pack.rows, g.pack.cols], [5, 8]);
  assert.equal(g.canBuy('rod', 'rod7').reason, 'locked');
  assert.ok(g.buy('bait', 'sandworm').ok);
  assert.ok(g.equip('bait', 'sandworm'));
  assert.equal(g.equip('bait', 'troll'), false);
  assert.equal(g.state.coins, 1e6 - 800 - 2000 - 3000 - 150);
});

test('移動：沒有對應的船不能去', () => {
  const g = mk();
  assert.equal(g.canTravel('B1', NOW).reason, 'boat');
  assert.ok(g.travel('A3', NOW).ok);
  g.state.owned.boats.push('boat2');
  assert.ok(g.canTravel('B1', NOW).ok || g.canTravel('B1', NOW).reason === 'wind');
});

test('時鐘：時段與色調', () => {
  assert.equal(phaseOf(cfg, 5 * 60), 'dawn');
  assert.equal(phaseOf(cfg, 12 * 60), 'day');
  assert.equal(phaseOf(cfg, 17 * 60 + 30), 'dusk');
  assert.equal(toneOf(cfg, 17 * 60 + 30), 'golden');
  assert.equal(toneOf(cfg, 18 * 60 + 30), 'sunset');
  assert.equal(phaseOf(cfg, 23 * 60), 'night');
  assert.equal(phaseOf(cfg, 1440 + 3 * 60), 'night');
  assert.equal(formatClock(1440 + 65), '01:05');
});

test('天氣可重現；清晨起霧的機率比白天高', () => {
  assert.equal(weatherOf(cfg, 's', 600, null), weatherOf(cfg, 's', 600, null));
  let fogDawn = 0, fogDay = 0;
  for (let d = 0; d < 400; d++) {
    if (weatherOf(cfg, 's', d * 1440 + 6 * 60, null) === 'fog') fogDawn++;
    if (weatherOf(cfg, 's', d * 1440 + 13 * 60, null) === 'fog') fogDay++;
  }
  assert.ok(fogDawn > fogDay * 3, `${fogDawn} vs ${fogDay}`);
});

test('季節：現實 7 天換一季，可以關閉；冬季強風封北海', () => {
  const day = 86400000;
  assert.equal(seasonOf(cfg, {}, 0, 0), 'spring');
  assert.equal(seasonOf(cfg, {}, 0, 7 * day), 'summer');
  assert.equal(seasonOf(cfg, {}, 0, 21 * day), 'winter');
  assert.equal(seasonOf(cfg, {}, 0, 28 * day), 'spring');
  assert.equal(seasonOf(cfg, { seasons: false }, 0, 21 * day), null);
  assert.equal(regionBlocked(cfg, 'B', 'winter', 'windy'), true);
  assert.equal(regionBlocked(cfg, 'B', 'winter', 'sunny'), false);
  assert.equal(regionBlocked(cfg, 'A', 'winter', 'windy'), false);
});

test('離線：上限 8 小時，背包滿了就停止', () => {
  const g = mk();
  g.state.spot = 'A1';
  const s = simulateOffline(g, 24 * 3600, mulberry32(3), NOW);
  assert.equal(s.seconds, 8 * 3600);
  assert.ok(s.caught > 0);
  assert.ok(s.stoppedFull, '24 格背包在 8 小時內應該會滿');
  assert.ok(g.pack.isValid());
  assert.equal(s.kept.length, g.pack.items.length);
  assert.ok(Math.abs(g.state.clock.minutes - (cfg.clock.startMinute + 8 * 60 * 10)) < 1e-6);
});

test('離線：背包滿時自動放生 → 不會停止；自動放生普通魚', () => {
  const g = mk();
  g.state.spot = 'A1';
  g.state.rules.whenFull = 'release';
  const s = simulateOffline(g, 8 * 3600, mulberry32(3), NOW);
  assert.equal(s.stoppedFull, false);
  assert.ok(s.released > 0);
  const g2 = mk();
  g2.state.spot = 'A1';
  g2.state.rules.releaseBelow = 'uncommon';
  const s2 = simulateOffline(g2, 3600, mulberry32(3), NOW);
  assert.equal(s2.kept.length, 0);
  assert.ok(s2.autoReleased > 0);
});

test('離線：不到 60 秒不模擬', () => {
  const g = mk();
  const s = simulateOffline(g, 30, mulberry32(1), NOW);
  assert.equal(s.attempts, 0);
});

test('存檔：來回轉換、版本升級、損毀存檔', () => {
  const g = mk();
  g.state.coins = 123;
  g.keep(catchOf(g, 'f01', 0.5));
  const text = serialize(g, NOW);
  const s = deserialize(data, text);
  assert.equal(s.coins, 123);
  assert.equal(s.backpack.items.length, 1);
  assert.equal(s.version, 2);
  assert.equal(deserialize(data, '{broken'), null);
  assert.equal(deserialize(data, JSON.stringify({ version: 99 })), null);
  const old = migrate({ version: 1, rules: { releaseBelow: 'rare' } });
  assert.deepEqual(old.rules, { releaseBelow: 'rare', whenFull: 'ask' });
  assert.equal(old.settings.autoKeep, true);
});

test('存檔：不存在的釣點或未擁有的裝備會退回預設', () => {
  const g = mk();
  g.state.spot = 'Z9';
  g.state.rod = 'rod6';
  const s = deserialize(data, serialize(g, NOW));
  assert.equal(s.spot, 'A2');
  assert.equal(s.rod, 'rod1');
});
