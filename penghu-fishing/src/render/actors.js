// 船、玩家、小卷貓、海鷗。全部朝右（船頭在右）。
import { makeCanvas, rect, px, line, ellipse, PAL as C } from './pixel.js';

// ---------------- 船 ----------------
// 每艘船：寬、座位位置（玩家）、船頭位置（小卷貓）、吃水
export const BOAT_LAYOUT = {
  boat1: { w: 72, h: 20, seat: 20, bow: 58, deck: 8 },
  boat2: { w: 88, h: 20, seat: 26, bow: 72, deck: 9 },
  boat3: { w: 108, h: 30, seat: 40, bow: 92, deck: 12 },
  boat4: { w: 128, h: 34, seat: 50, bow: 110, deck: 13 },
};

const boatCache = new Map();
export function boatSprite(id, night) {
  const key = id + night;
  if (boatCache.has(key)) return boatCache.get(key);
  const L = BOAT_LAYOUT[id];
  const S = makeCanvas(L.w, L.h);
  const { ctx } = S;
  const H = L.h;
  const hullTop = H - 10;
  if (id === 'boat1') {
    // 舢舨：木板船，船頭上翹，兩支槳
    for (let x = 0; x < L.w; x++) {
      const u = x / (L.w - 1);
      const lift = Math.round(Math.pow(Math.max(0, u - 0.7) / 0.3, 2) * 5 + Math.pow(Math.max(0, 0.12 - u) / 0.12, 2) * 2);
      const top = hullTop - lift;
      const bottom = H - 2 - Math.round(Math.pow(Math.abs(u - 0.5) * 2, 3) * 4);
      rect(ctx, x, top, 1, bottom - top, C.wo2);
      px(ctx, x, top, C.wo4);
      px(ctx, x, top + 1, C.wo3);
      if ((x + 3) % 12 === 0) rect(ctx, x, top + 2, 1, bottom - top - 2, C.wo1);
      px(ctx, x, top + 4, C.wo1);
      px(ctx, x, bottom - 1, C.wo0);
    }
    line(ctx, 16, hullTop - 6, 4, H - 1, C.wo3);
    rect(ctx, 2, H - 2, 4, 2, C.wo4);
  } else if (id === 'boat2') {
    // 膠筏：塑膠管並排的平底筏，小舷外機
    rect(ctx, 0, hullTop + 2, L.w, 6, C.ba4);
    for (let x = 0; x < L.w; x += 1) { px(ctx, x, hullTop + 2, C.sky3); px(ctx, x, hullTop + 7, C.ba3); }
    for (let x = 6; x < L.w - 4; x += 14) rect(ctx, x, hullTop + 3, 1, 4, C.ba3);
    ellipse(ctx, L.w - 3, hullTop + 5, 3, 3, C.ba4); px(ctx, L.w - 3, hullTop + 3, C.sky3);
    rect(ctx, 2, hullTop, L.w - 6, 2, C.wo3);
    rect(ctx, 2, hullTop, L.w - 6, 1, C.wo4);
    // 舷外機
    rect(ctx, 0, hullTop - 6, 6, 6, C.ba1); rect(ctx, 1, hullTop - 6, 4, 1, C.ba3); rect(ctx, 2, hullTop, 2, 8, C.ba1);
    // 漏水的水桶
    rect(ctx, 40, hullTop - 4, 5, 4, C.cl1); px(ctx, 40, hullTop - 4, C.sky2);
  } else {
    // 海鷗號／天人菊號：玻璃纖維船身＋船艙
    const big = id === 'boat4';
    for (let x = 0; x < L.w; x++) {
      const u = x / (L.w - 1);
      const lift = Math.round(Math.pow(Math.max(0, u - 0.75) / 0.25, 2) * 6);
      const top = hullTop - lift;
      const bottom = H - 1 - Math.round(Math.pow(Math.max(0, u - 0.6) / 0.4, 1.5) * 6);
      rect(ctx, x, top, 1, bottom - top, C.ui4);
      px(ctx, x, top, C.ui4);
      rect(ctx, x, top + 3, 1, 2, big ? C.wa1 : C.cl1);
      rect(ctx, x, bottom - 2, 1, 2, C.sky2);
      px(ctx, x, bottom - 1, C.ba3);
    }
    // 船艙
    const cx = big ? 8 : 6, cw = big ? 34 : 28, ch = big ? 16 : 13;
    rect(ctx, cx, hullTop - ch, cw, ch, C.ui4);
    rect(ctx, cx + cw - 2, hullTop - ch, 2, ch, C.sky2);
    rect(ctx, cx - 1, hullTop - ch - 2, cw + 2, 2, big ? C.wa1 : C.cl0);
    for (let k = 0; k < 3; k++) rect(ctx, cx + 3 + k * 9, hullTop - ch + 3, 6, 4, night ? C.wa3 : C.sea2);
    // 天線與旗
    line(ctx, cx + 6, hullTop - ch - 2, cx + 6, hullTop - ch - 12, C.ba2);
    rect(ctx, cx + 7, hullTop - ch - 12, 5, 3, big ? C.wa2 : C.cl2);
    // 船舷欄杆
    for (let x = cx + cw + 2; x < L.w - 10; x += 6) line(ctx, x, hullTop - 1, x, hullTop - 5, C.ba3);
    line(ctx, cx + cw + 2, hullTop - 5, L.w - 12, hullTop - 5, C.ba3);
    if (big) {
      // 船頭漆著天人菊
      const fx = L.w - 22, fy = hullTop + 2;
      const petals = [[0, -3], [2, -2], [3, 0], [2, 2], [0, 3], [-2, 2], [-3, 0], [-2, -2]];
      for (const [dx, dy] of petals) { px(ctx, fx + dx, fy + dy, C.wa1); px(ctx, fx + Math.sign(dx) * (Math.abs(dx) + (dx ? 1 : 0)), fy + Math.sign(dy) * (Math.abs(dy) + (dy ? 1 : 0)), C.wa3); }
      rect(ctx, fx - 1, fy - 1, 2, 2, C.wa0);
    }
    // 船名牌（不用文字，只用色塊表示）
    rect(ctx, big ? 60 : 50, hullTop + 1, 12, 2, C.ba1);
  }
  boatCache.set(key, S);
  return S;
}

// ---------------- 玩家（約 28x36） ----------------
// 玩家朝右坐著。回傳手的位置（釣竿根部），由呼叫端畫釣竿。
export function drawPlayer(ctx, x, y, anim, t, holdFish = null) {
  // x,y = 臀部所在（坐在船座上）；精靈約 28x36，往上長
  const breathe = anim === 'idle' ? (Math.floor(t * 1.6) % 2) : 0;
  const by = y - breathe;
  const hop = anim === 'celebrate' ? Math.round(Math.abs(Math.sin(t * 6)) * 2) : 0;
  const Y = by - hop;
  // 腿：大腿往前、小腿往下（捲起的褲管露出小腿）
  rect(ctx, x - 2, y - 4, 12, 4, C.cl0);
  rect(ctx, x - 2, y - 4, 12, 1, C.cl1);
  rect(ctx, x + 8, y - 4, 3, 2, C.ui3); // 褲管反摺
  rect(ctx, x + 9, y - 2, 3, 6, C.sk2);
  rect(ctx, x + 11, y - 2, 1, 6, C.sk1);
  rect(ctx, x + 9, y + 4, 5, 2, C.ba2);
  // 身體（防曬長袖，淺藍）
  rect(ctx, x - 4, Y - 16, 10, 13, C.cl1);
  rect(ctx, x - 4, Y - 16, 2, 13, C.sky1);   // 左上受光
  rect(ctx, x + 4, Y - 16, 2, 13, C.cl0);    // 背光側
  px(ctx, x, Y - 10, C.cl0); px(ctx, x + 1, Y - 7, C.cl0); // 衣服皺摺
  rect(ctx, x - 4, Y - 4, 10, 1, C.cl0);
  // 頭
  rect(ctx, x - 2, Y - 24, 8, 8, C.sk2);
  rect(ctx, x + 4, Y - 24, 2, 8, C.sk1);
  rect(ctx, x - 3, Y - 23, 2, 5, C.wo1);     // 頭髮
  px(ctx, x + 4, Y - 21, C.ui0);             // 眼睛
  px(ctx, x + 6, Y - 19, C.sk1);             // 鼻
  px(ctx, x + 4, Y - 18, C.sk0);
  // 草帽：寬帽沿＋帽頂＋帽帶
  rect(ctx, x - 7, Y - 25, 18, 2, C.sa2);
  rect(ctx, x - 7, Y - 24, 18, 1, C.sa1);
  rect(ctx, x - 3, Y - 30, 10, 5, C.sa2);
  rect(ctx, x - 3, Y - 30, 10, 1, C.sa3);
  rect(ctx, x - 3, Y - 27, 10, 1, C.wa0);
  for (let k = -6; k < 10; k += 3) px(ctx, x + k, Y - 25, C.sa3);
  rect(ctx, x + 5, Y - 30, 2, 5, C.sa1);
  // 手臂與手：依動作決定手的位置
  const sh = { x: x + 2, y: Y - 14 };
  let hand;
  if (anim === 'reel') {
    const a = t * 10;
    hand = { x: x + 9 + Math.round(Math.cos(a) * 2), y: Y - 9 + Math.round(Math.sin(a) * 2) };
  } else if (anim === 'celebrate') {
    hand = { x: x + 4, y: Y - 31 };
  } else if (anim === 'cast') {
    hand = { x: x + 8, y: Y - 13 };
  } else {
    hand = { x: x + 9, y: Y - 10 };
  }
  line(ctx, sh.x, sh.y, hand.x, hand.y, C.cl1);
  line(ctx, sh.x, sh.y + 1, hand.x, hand.y + 1, C.cl0);
  rect(ctx, hand.x - 1, hand.y - 1, 3, 3, C.sk2);
  px(ctx, hand.x + 1, hand.y + 1, C.sk1);
  if (anim === 'celebrate') {
    const h2 = { x: x - 2, y: Y - 31 };
    line(ctx, x - 2, Y - 14, h2.x, h2.y, C.sky1);
    rect(ctx, h2.x - 1, h2.y - 1, 3, 3, C.sk2);
    if (holdFish) ctx.drawImage(holdFish.c, Math.round(x + 1 - holdFish.w / 2), Math.round(Y - 33 - holdFish.h));
  }
  return hand;
}

/** 釣竿：從手到竿尖，竿身有彎曲（收線時更彎） */
export function drawRod(ctx, hand, tip, bend, color = C.wo3) {
  const mx = (hand.x + tip.x) / 2, my = (hand.y + tip.y) / 2 + bend;
  const steps = 24;
  let lx = hand.x, ly = hand.y;
  for (let i = 1; i <= steps; i++) {
    const tt = i / steps;
    const xx = (1 - tt) * (1 - tt) * hand.x + 2 * (1 - tt) * tt * mx + tt * tt * tip.x;
    const yy = (1 - tt) * (1 - tt) * hand.y + 2 * (1 - tt) * tt * my + tt * tt * tip.y;
    line(ctx, lx, ly, xx, yy, i < 6 ? C.wo1 : color);
    lx = xx; ly = yy;
  }
  px(ctx, tip.x, tip.y, C.ui4);
  // 捲線器
  rect(ctx, hand.x + 2, hand.y + 1, 3, 3, C.ba2);
  px(ctx, hand.x + 3, hand.y + 2, C.ba4);
}

// ---------------- 小卷貓（約 20x16） ----------------
const CAT_COLORS = { o: C.ca0, b: C.ca2, d: C.ca1, l: C.ca3, w: C.ca4, e: C.wa2, k: C.ui0, p: C.cl3, h: C.ui4 };
const CAT_MAPS = {
  sit: [
    '....................',
    '............o...o...',
    '...........obo.obo..',
    '...........obbbbbo..',
    '..........obdbdbbbo.',
    '..........obekbbekbo',
    '..........obbbbpbbbo',
    '...........owwbbwwo.',
    '....ooooooobwwwwbo..',
    '...obdbdbdbwwwwbo...',
    '..obbdbdbdbbwwwbo...',
    '..obdbbdbbdbbwwbo...',
    '..obbbbbbbbbbwwbo...',
    '..oblbbbbbbbbwwo....',
    '...owwoooooowwwo....',
    '....................',
  ],
  stretch: [
    '....................',
    '....................',
    '....................',
    '....................',
    '..ooooo.............',
    '.obdbdbo............',
    '.obbdbdboo..........',
    '.obdbbdbbboo........',
    '..obbbdbbbbboo..o.o.',
    '...obbbbdbbbbboobobo',
    '...obbobbbbdbbbbbbbo',
    '...obo.oobbbbbbbekbo',
    '...obo...oobbbbbpbo.',
    '...owo.....owwwwwo..',
    '...owo....owwowwwo..',
    '...oo.....oooooooo..',
  ],
  sleep: [
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '..............o.o...',
    '.......oooooooobobo.',
    '.....oobdbdbdbobbbo.',
    '....obdbdbdbdbobbbbo',
    '...obbbbbbbbbbbookbo',
    '...obdbbbbbbbbbbbpbo',
    '...obbdbdbdbbbbwwbo.',
    '...oowwwwwwwwwwwwoo.',
    '....oooooooooooooo..',
  ],
};

function mapToSprite(map, mutate) {
  const S = makeCanvas(20, 16);
  const rows = map.map((r) => r.split(''));
  if (mutate) mutate(rows);
  rows.forEach((row, y) => row.forEach((ch, x) => { if (CAT_COLORS[ch]) px(S.ctx, x, y, CAT_COLORS[ch]); }));
  return S;
}

const catCache = new Map();
/** pose: sit / lick / stretch / sleep / watch / excited / sniff / annoyed / belly */
export function catSprite(pose, frame) {
  const key = pose + frame;
  if (catCache.has(key)) return catCache.get(key);
  let S;
  const shiftHead = (rows, dx, dy) => {
    const src = rows.map((r) => r.slice());
    for (let y = 0; y < 8; y++) for (let x = 10; x < 20; x++) rows[y][x] = '.';
    for (let y = 0; y < 8; y++) for (let x = 10; x < 20; x++) {
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < 16 && nx >= 0 && nx < 20 && src[y][x] !== '.') rows[ny][nx] = src[y][x];
    }
  };
  switch (pose) {
    case 'lick': S = mapToSprite(CAT_MAPS.sit, (r) => {
      shiftHead(r, 0, 1);
      r[5][13] = 'o'; r[5][17] = 'o'; r[6][13] = 'b'; r[6][17] = 'b'; // 閉眼
      if (frame % 2 === 0) { r[8][15] = 'w'; r[7][16] = 'w'; r[8][16] = 'w'; r[7][14] = 'p'; } // 舔爪
      else { r[9][15] = 'w'; r[8][16] = 'w'; }
    }); break;
    case 'watch': S = mapToSprite(CAT_MAPS.sit, (r) => {
      shiftHead(r, 0, -1);
      r[0][12] = 'o'; r[0][17] = 'o'; // 耳朵豎起
      r[4][13] = 'k'; r[4][12] = 'e'; r[4][17] = 'k'; r[4][16] = 'e'; // 往上看
    }); break;
    case 'excited': S = mapToSprite(CAT_MAPS.sit, (r) => {
      shiftHead(r, 1, -1);
      r[6][16] = 'k'; r[6][17] = 'p'; // 張嘴喵
      // 伸出前爪
      r[7][18] = 'w'; r[7][19] = 'w'; r[8][17] = 'w'; r[8][18] = 'o';
    }); break;
    case 'sniff': S = mapToSprite(CAT_MAPS.sit, (r) => shiftHead(r, 1, 2)); break;
    case 'annoyed': S = mapToSprite(CAT_MAPS.sit, (r) => {
      // 轉頭：看不到眼睛，只看到後腦
      for (let y = 4; y < 7; y++) for (let x = 11; x < 19; x++) if ('ekp'.includes(r[y][x])) r[y][x] = y === 5 ? 'd' : 'b';
    }); break;
    case 'belly': S = mapToSprite(CAT_MAPS.sleep, (r) => {
      for (let x = 5; x < 16; x++) { r[13][x] = 'w'; r[12][x] = x % 3 ? 'w' : 'l'; }
      r[8][6] = 'w'; r[7][7] = 'w'; r[8][12] = 'w'; r[7][13] = 'w'; // 四腳朝天
    }); break;
    case 'stretch': S = mapToSprite(CAT_MAPS.stretch); break;
    case 'sleep': S = mapToSprite(CAT_MAPS.sleep, (r) => { if (frame % 2) { r[10][7] = 'd'; r[9][8] = 'b'; } }); break;
    default: S = mapToSprite(CAT_MAPS.sit);
  }
  drawCatTail(S.ctx, pose, frame);
  catCache.set(key, S);
  return S;
}

function drawCatTail(ctx, pose, frame) {
  if (pose === 'sleep' || pose === 'belly') return; // 尾巴捲在身體下
  const fast = pose === 'watch' || pose === 'excited';
  const ph = (frame / 8) * Math.PI * 2 * (fast ? 2 : 1);
  const base = pose === 'stretch' ? { x: 1, y: 6 } : { x: 2, y: 12 };
  let x = base.x, y = base.y;
  for (let i = 0; i < 7; i++) {
    const nx = Math.round(base.x - i * 0.3 + Math.sin(ph + i * 0.5) * (i / 7) * 2);
    const ny = base.y - i;
    if (ny < 0) break;
    x = Math.max(0, nx); y = ny;
    px(ctx, x, y, i % 2 ? C.ca1 : C.ca2);
    px(ctx, x - 1 < 0 ? x + 1 : x - 1, y, C.ca0);
  }
  px(ctx, x, y - 1, C.ca0);
}

// ---------------- 海鷗 ----------------
export function drawGull(ctx, x, y, frame, color = C.ui4, dark = C.ba2) {
  x = Math.round(x); y = Math.round(y);
  const up = frame % 2 === 0;
  rect(ctx, x - 1, y, 3, 1, color);
  px(ctx, x + 2, y, C.wa2);
  if (up) { px(ctx, x - 2, y - 1, dark); px(ctx, x - 3, y - 2, dark); px(ctx, x + 1, y - 1, dark); px(ctx, x + 2, y - 2, dark); }
  else { px(ctx, x - 2, y + 1, dark); px(ctx, x - 3, y + 1, dark); px(ctx, x + 1, y + 1, dark); px(ctx, x + 2, y + 1, dark); }
}
