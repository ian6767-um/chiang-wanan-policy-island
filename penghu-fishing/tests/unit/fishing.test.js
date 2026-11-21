import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPool, rollWeight, sizeFor, shapeFor, breakChance, priceOf, rollCatch, anyFishFor } from '../../src/core/fishing.js';
import { mulberry32 } from '../../src/core/rng.js';
import { loadDataSync } from './helpers.js';

const data = loadDataSync();
const cfg = data.config;
const F = (id) => data.fishById[id];

test('魚池 = 釣點魚種 ∩ 魚餌有效魚種 ∩ 時段', () => {
  const pool = buildPool(data, { spotId: 'A1', baitId: 'krill', phase: 'day', weather: 'sunny', season: null });
  const ids = pool.map((p) => p.item.id).sort();
  assert.deepEqual(ids, ['f01', 'f02', 'f12', 'f13']);
  const night = buildPool(data, { spotId: 'A2', baitId: 'glowjig', phase: 'night', weather: 'sunny', season: null });
  assert.deepEqual(night.map((p) => p.item.id), ['f16']);
  const day = buildPool(data, { spotId: 'A2', baitId: 'glowjig', phase: 'day', weather: 'sunny', season: null });
  assert.equal(day.length, 0);
});

test('權重：普通 100、少見 35、稀有 8、傳說 1，並套用季節倍率', () => {
  const p = buildPool(data, { spotId: 'C3', baitId: 'jig', phase: 'day', weather: 'sunny', season: 'winter' });
  const w = Object.fromEntries(p.map((e) => [e.item.id, e.weight]));
  assert.equal(w.f25, 35 * 3); // 土魠冬季 x3
  assert.equal(w.f26, 35);
});

test('傳說魚每天每個釣點限一次', () => {
  const env = { spotId: 'B1', baitId: 'glowjig', phase: 'night', weather: 'sunny', season: null };
  assert.ok(buildPool(data, { ...env, legendaryBlocked: false }).some((e) => e.item.id === 'f48'));
  assert.ok(!buildPool(data, { ...env, legendaryBlocked: true }).some((e) => e.item.id === 'f48'));
});

test('黑皮旗魚只在白天、晴天', () => {
  const env = { spotId: 'D3', baitId: 'troll', phase: 'day', season: null };
  assert.ok(buildPool(data, { ...env, weather: 'sunny' }).some((e) => e.item.id === 'f46'));
  assert.ok(!buildPool(data, { ...env, weather: 'cloudy' }).some((e) => e.item.id === 'f46'));
});

test('重量分佈偏向小魚，且一定在範圍內', () => {
  const rand = mulberry32(1);
  const f = F('f41');
  const counts = { S: 0, M: 0, L: 0, XL: 0 };
  for (let i = 0; i < 20000; i++) {
    const w = rollWeight(cfg, f, rand);
    assert.ok(w >= f.w[0] && w <= f.w[1]);
    counts[sizeFor(cfg, f, w)]++;
  }
  // rand^2.2：P(S)=0.25^(1/2.2)≈53%、M≈26%、L≈16%、XL≈5%
  assert.ok(Math.abs(counts.S / 20000 - 0.532) < 0.02, JSON.stringify(counts));
  assert.ok(Math.abs(counts.XL / 20000 - 0.047) < 0.01, JSON.stringify(counts));
});

test('體型依重量百分位：<25% S、<60% M、<90% L、其餘 XL', () => {
  const f = F('f41'); // 10–150
  assert.equal(sizeFor(cfg, f, 10), 'S');
  assert.equal(sizeFor(cfg, f, 44.9), 'S');
  assert.equal(sizeFor(cfg, f, 45), 'M');
  assert.equal(sizeFor(cfg, f, 94), 'L');
  assert.equal(sizeFor(cfg, f, 136), 'XL');
  assert.equal(sizeFor(cfg, f, 150), 'XL');
});

test('形狀：預設 S 1x1、M 1x2、L 2x2、XL 2x3，可覆寫', () => {
  assert.deepEqual(['S', 'M', 'L', 'XL'].map((s) => shapeFor(cfg, F('f01'), s)), [[1, 1], [1, 2], [2, 2], [2, 3]]);
  assert.deepEqual(shapeFor(cfg, F('f25'), 'S'), [1, 1]);
  assert.deepEqual(shapeFor(cfg, F('f25'), 'XL'), [2, 4]);
  assert.deepEqual(shapeFor(cfg, F('f44'), 'S'), [3, 3]);
  assert.deepEqual(shapeFor(cfg, F('f16'), 'M'), [1, 3]);
});

test('斷線：魚重 ≤ 拉力一定釣得上來；超過時 min(95%, 魚重/拉力-1)', () => {
  assert.equal(breakChance(cfg, 2, 2), 0);
  assert.equal(breakChance(cfg, 1.9, 2), 0);
  assert.ok(Math.abs(breakChance(cfg, 3, 2) - 0.5) < 1e-9);
  assert.equal(breakChance(cfg, 10, 2), 0.95);
});

test('售價 = 單價 × 重量 × 體型加成，四捨五入', () => {
  assert.equal(priceOf(cfg, F('f01'), 0.5, 'M'), Math.round(10 * 0.5 * 1.1));
  assert.equal(priceOf(cfg, F('f41'), 140, 'XL'), Math.round(250 * 140 * 1.5));
  assert.equal(priceOf(cfg, F('f12'), 0.3, 'S'), 1);
  assert.equal(priceOf(cfg, F('f01'), 0.5, 'S', 1.5), 8);
});

test('rollCatch：超過拉力的魚有時候會斷線', () => {
  const rand = mulberry32(7);
  let broke = 0, total = 0;
  const env = { spotId: 'D3', baitId: 'live', phase: 'day', weather: 'sunny', season: null };
  for (let i = 0; i < 500; i++) {
    const r = rollCatch(data, env, data.rodById.rod1, rand);
    total++; if (r.broke) broke++;
    assert.equal(r.instance.sp, 'f41');
  }
  assert.ok(broke > total * 0.9);
});

test('沒有魚吃這個餌時 rollCatch 回傳 null（例如小門嶼用南極蝦）', () => {
  assert.equal(anyFishFor(data, 'C1', 'krill').length, 0);
  assert.equal(rollCatch(data, { spotId: 'C1', baitId: 'krill', phase: 'day', weather: 'sunny', season: null }, data.rodById.rod1, mulberry32(1)), null);
});
