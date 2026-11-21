// 資料檢查：確認 JSON 與設計文件的資料表一致、而且每條魚都真的釣得到。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateData } from '../../src/core/data.js';
import { buildPool, shapeFor, SIZES } from '../../src/core/fishing.js';
import { Backpack } from '../../src/core/backpack.js';
import { loadDataSync, ROOT } from './helpers.js';

const data = loadDataSync();
const cfg = data.config;

test('資料互相參照沒有錯誤', () => {
  assert.deepEqual(validateData(data), []);
});

test('50 種魚：普通 18、少見 17、稀有 10、傳說 5，編號連續', () => {
  assert.equal(data.fish.length, 50);
  const count = (r) => data.fish.filter((f) => f.rarity === r).length;
  assert.deepEqual([count('common'), count('uncommon'), count('rare'), count('legendary')], [18, 17, 10, 5]);
  data.fish.forEach((f, i) => assert.equal(f.id, `f${String(i + 1).padStart(2, '0')}`));
});

test('魚種數值與設計文件資料表一致（抽查）', () => {
  const by = (name) => data.fish.find((f) => f.name.startsWith(name));
  assert.deepEqual([by('豆仔魚').w, by('豆仔魚').price], [[0.1, 0.8], 10]);
  assert.deepEqual([by('河魨').price], [2]);
  assert.deepEqual(by('白帶魚').shape, { S: [1, 2], M: [1, 3], L: [1, 4], XL: [1, 5] });
  assert.deepEqual(by('龍膽石斑').shape, { L: [3, 3], XL: [3, 4] });
  assert.deepEqual(by('龍膽石斑').w, [10, 150]);
  assert.deepEqual(by('黑皮旗魚').shape, { all: [3, 6] });
  assert.deepEqual(by('黑皮旗魚').weather, ['sunny']);
  assert.equal(by('石滬之主').price, 1500);
  assert.deepEqual(by('跨海大橋').shape, { all: [1, 6] });
  assert.deepEqual(by('天人菊鬼頭刀').season_only, ['summer']);
  assert.deepEqual(by('土魠').season, { winter: 3 });
  assert.deepEqual(by('鬼頭刀').season, { summer: 2 });
});

test('釣竿、魚餌、船、背包與資料表一致', () => {
  assert.deepEqual(data.rods.map((r) => [r.pull, r.price]), [[2, 0], [4, 300], [7, 1200], [12, 4000], [25, 12000], [60, 40000], [300, 150000]]);
  assert.equal(data.rods[6].require.codex, 40);
  assert.deepEqual(data.baits.map((b) => [b.name, b.price]), [
    ['南極蝦', 0], ['沙蟲', 150], ['魷魚肉條', 400], ['木蝦', 600], ['米諾', 900], ['軟蟲', 1500],
    ['夜光鉛頭', 1800], ['鐵板', 3500], ['活餌', 6000], ['拖釣假餌', 15000]]);
  assert.deepEqual(data.boats.map((b) => [b.price, b.regions.join('')]), [[0, 'A'], [2000, 'AB'], [10000, 'ABC'], [35000, 'ABCD']]);
  assert.deepEqual(data.backpacks.map((p) => [p.rows, p.cols, p.price]), [[3, 8, 0], [4, 8, 800], [5, 8, 3000], [6, 8, 9000], [6, 10, 25000]]);
  assert.equal(data.spots.length, 12);
  assert.equal(data.spots.filter((s) => s.harbor).map((s) => s.id).join(), 'A2');
});

test('每條魚都至少在某個時段／天氣／季節釣得到', () => {
  const phases = ['dawn', 'day', 'dusk', 'night'];
  const weathers = ['sunny', 'cloudy', 'fog', 'windy'];
  const seasons = [null, ...cfg.seasons.order];
  for (const f of data.fish) {
    let ok = false;
    for (const spotId of f.spots) for (const baitId of f.baits) for (const phase of phases)
      for (const weather of weathers) for (const season of seasons) {
        const pool = buildPool(data, { spotId, baitId, phase, weather, season, legendaryBlocked: false });
        if (pool.some((p) => p.item.id === f.id)) ok = true;
      }
    assert.ok(ok, `${f.name} 永遠釣不到`);
  }
});

test('季節功能關閉時，季節限定魚仍然釣得到（避免圖鑑無法全收集）', () => {
  const pool = buildPool(data, { spotId: 'C3', baitId: 'troll', phase: 'dusk', weather: 'sunny', season: null, legendaryBlocked: false });
  assert.ok(pool.some((p) => p.item.id === 'f50'));
  const winter = buildPool(data, { spotId: 'C3', baitId: 'troll', phase: 'dusk', weather: 'sunny', season: 'winter', legendaryBlocked: false });
  assert.ok(!winter.some((p) => p.item.id === 'f50'));
});

test('最強的竿拉得動最重的魚', () => {
  const maxW = Math.max(...data.fish.map((f) => f.w[1]));
  const maxPull = Math.max(...data.rods.map((r) => r.pull));
  assert.ok(maxW <= maxPull, `${maxW} > ${maxPull}`);
});

test('每一種魚的每一種體型，都放得進「初始」3x8 背包', () => {
  for (const f of data.fish) for (const s of SIZES) {
    const shape = shapeFor(cfg, f, s);
    const b = new Backpack(3, 8);
    assert.ok(b.autoPlace({ uid: 'x', fish: { shape } }), `${f.name} ${s} ${shape.join('x')}`);
  }
});

test('每個海域都有船可以到', () => {
  for (const r of data.regions) assert.ok(data.boats.some((b) => b.regions.includes(r.id)), r.id);
});

test('魚的配色只用主調色盤的顏色', () => {
  const pal = new Set(readFileSync(join(ROOT, 'palette', 'master.hex'), 'utf8').trim().split(/\s+/).map((h) => '#' + h.toLowerCase()));
  assert.ok(pal.size <= 64, `調色盤 ${pal.size} 色`);
  for (const f of data.fish) {
    const a = f.art;
    for (const c of [...a.c, a.b, a.pc, a.f]) assert.ok(pal.has(c.toLowerCase()), `${f.name} 用了調色盤外的顏色 ${c}`);
  }
});
