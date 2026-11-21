import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Backpack, itemDims } from '../../src/core/backpack.js';
import { fakeFish } from './helpers.js';

const item = (uid, r, c) => ({ uid, fish: fakeFish(uid, r, c) });

test('放置：在空背包的左上角放得下', () => {
  const b = new Backpack(3, 8);
  assert.equal(b.place(item('a', 2, 2), 0, 0, false), true);
  assert.equal(b.usedCells, 4);
  assert.ok(b.isValid());
});

test('碰撞：重疊的位置放不下', () => {
  const b = new Backpack(3, 8);
  b.place(item('a', 2, 2), 0, 0, false);
  assert.equal(b.canPlace(item('b', 1, 1), 1, 1, false), false);
  assert.equal(b.canPlace(item('b', 1, 1), 2, 0, false), true);
});

test('邊界：超出右邊或下邊放不下，負座標放不下', () => {
  const b = new Backpack(3, 8);
  assert.equal(b.canPlace(item('a', 2, 3), 6, 0, false), false);
  assert.equal(b.canPlace(item('a', 2, 3), 5, 0, false), true);
  assert.equal(b.canPlace(item('a', 2, 3), 0, 2, false), false);
  assert.equal(b.canPlace(item('a', 1, 1), -1, 0, false), false);
  assert.equal(b.canPlace(item('a', 1, 1), 0, 0.5, false), false);
});

test('旋轉：1x5 長魚直放在 3 列背包放不下，橫放可以', () => {
  const b = new Backpack(3, 8);
  assert.deepEqual(itemDims([1, 5], true), { h: 5, w: 1 });
  assert.equal(b.canPlace(item('a', 1, 5), 0, 0, true), false);
  assert.equal(b.canPlace(item('a', 1, 5), 0, 0, false), true);
});

test('旋轉：auto_place 會嘗試另一個方向', () => {
  const b = new Backpack(3, 8);
  // 擋住每一列的右側 7 格，只剩第 0 欄（3 格高）
  for (let y = 0; y < 3; y++) b.place(item('w' + y, 1, 7), 1, y, false);
  const it = item('long', 1, 3); // 1 列 x 3 欄，必須轉成 3 列 x 1 欄
  assert.equal(b.autoPlace(it), true);
  const placed = b.get('long');
  assert.equal(placed.rot, true);
  assert.equal(placed.x, 0);
  assert.ok(b.isValid());
});

test('auto_place 掃描順序：先由上到下、再由左到右', () => {
  const b = new Backpack(3, 8);
  b.autoPlace(item('a', 1, 1));
  b.autoPlace(item('b', 1, 1));
  b.autoPlace(item('c', 1, 1));
  b.autoPlace(item('d', 1, 1));
  assert.deepEqual(['a', 'b', 'c', 'd'].map((u) => [b.get(u).x, b.get(u).y]), [[0, 0], [0, 1], [0, 2], [1, 0]]);
});

test('滿包：填滿 24 格後 auto_place 失敗', () => {
  const b = new Backpack(3, 8);
  for (let i = 0; i < 24; i++) assert.equal(b.autoPlace(item('s' + i, 1, 1)), true);
  assert.equal(b.usedCells, 24);
  assert.equal(b.autoPlace(item('x', 1, 1)), false);
  assert.equal(b.items.length, 24);
});

test('大魚取捨：3x6 黑皮旗魚在 3x8 背包，只要中間有一條小魚就放不下', () => {
  const b = new Backpack(3, 8);
  assert.equal(b.place(item('s', 1, 1), 3, 1, false), true);
  assert.equal(b.autoPlace(item('marlin', 3, 6)), false);
  b.remove('s');
  assert.equal(b.autoPlace(item('marlin', 3, 6)), true);
});

test('移動與移除：move 會忽略自己原本的位置，放不下時位置不變', () => {
  const b = new Backpack(3, 8);
  b.place(item('a', 2, 2), 0, 0, false);
  b.place(item('b', 1, 1), 4, 0, false);
  assert.equal(b.move('a', 1, 1, false), true); // 和原位置重疊也可以
  assert.deepEqual([b.get('a').x, b.get('a').y], [1, 1]);
  assert.equal(b.move('a', 3, 0, false), false); // 撞到 b
  assert.deepEqual([b.get('a').x, b.get('a').y], [1, 1]);
  assert.equal(b.remove('b').uid, 'b');
  assert.equal(b.remove('b'), null);
  assert.equal(b.move('a', 3, 0, false), true);
  assert.ok(b.isValid());
});

test('itemAt 與 occupancy', () => {
  const b = new Backpack(3, 8);
  b.place(item('a', 1, 2), 2, 1, true); // 旋轉 → 2 列 x 1 欄
  assert.equal(b.itemAt(2, 1).uid, 'a');
  assert.equal(b.itemAt(2, 2).uid, 'a');
  assert.equal(b.itemAt(3, 1), null);
});

test('升級尺寸：只能變大，物品保留', () => {
  const b = new Backpack(3, 8);
  b.autoPlace(item('a', 2, 2));
  b.resize(4, 8);
  assert.equal(b.totalCells, 32);
  assert.equal(b.items.length, 1);
  assert.throws(() => b.resize(3, 8));
});

test('JSON 來回轉換', () => {
  const b = new Backpack(3, 8);
  b.autoPlace(item('a', 2, 3));
  const c = Backpack.fromJSON(JSON.parse(JSON.stringify(b.toJSON())));
  assert.deepEqual(c.toJSON(), b.toJSON());
});
