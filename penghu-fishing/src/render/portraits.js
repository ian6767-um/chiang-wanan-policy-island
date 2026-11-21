// 半身肖像（180x200）：釣具店阿月嬤、魚市阿伯。動畫：呼吸 4 幀、眨眼、說話 3 幀。
import { makeCanvas, rect, px, ellipse, line, hash2, rotate90, PAL as C } from './pixel.js';
import { drawFish } from './fishart.js';

const PW = 180, PH = 200;
const cache = new Map();

export function portrait(kind, breath = 0, blink = false, talk = 0, fishArts = []) {
  const key = `${kind}|${breath}|${blink}|${talk}`;
  if (cache.has(key)) return cache.get(key);
  const S = makeCanvas(PW, PH, false);
  if (kind === 'shop') drawShop(S.ctx, breath, blink, talk, fishArts);
  else drawMarket(S.ctx, breath, blink, talk, fishArts);
  cache.set(key, S);
  return S;
}

const BREATH = [0, 0, -1, 0];

// ---------------- 海口釣具行：阿月嬤 ----------------
function drawShop(ctx, b, blink, talk, fishArts) {
  // 木牆
  rect(ctx, 0, 0, PW, PH, C.wo2);
  for (let x = 0; x < PW; x += 15) { rect(ctx, x, 0, 1, PH, C.wo1); rect(ctx, x + 1, 0, 1, PH, C.wo3); }
  for (let y = 0; y < PH; y += 1) if (hash2(3, y, 1) < 0.08) rect(ctx, 0, y, PH, 1, C.wo1);
  // 暖色燈
  line(ctx, 140, 0, 140, 16, C.ba1);
  rect(ctx, 133, 16, 14, 5, C.wo1);
  rect(ctx, 136, 21, 8, 3, C.wa3);
  for (let r = 0; r < 3; r++) ellipse(ctx, 140, 26, 18 - r * 5, 3 - r, [C.wo3, C.wo4, C.dk6][r]);
  // 牆上的魚標本（石斑）
  rect(ctx, 6, 10, 70, 34, C.wo1); rect(ctx, 7, 11, 68, 32, C.wo4); rect(ctx, 8, 12, 66, 30, C.wo3);
  const grouper = drawFish(fishArts[0] || { t: 'grouper', c: [C.wo1, C.sa0, C.sa1], b: C.sa2, p: 'spots', pc: C.wa2, f: C.sa0 }, 60, 24, 0, 4);
  ctx.drawImage(grouper.c, 11, 15);
  // 魚餌架
  rect(ctx, 6, 52, 52, 2, C.wo1); rect(ctx, 6, 72, 52, 2, C.wo1);
  const lureCols = [C.wa1, C.cl3, C.sea4, C.wa3, C.pl3, C.ui4];
  for (let i = 0; i < 10; i++) { const x = 8 + i * 5; line(ctx, x + 1, 54, x + 1, 57, C.ba3); rect(ctx, x, 57, 3, 6, lureCols[i % 6]); px(ctx, x, 57, C.ui4); px(ctx, x + 1, 63, C.ba3); }
  for (let i = 0; i < 6; i++) { ellipse(ctx, 11 + i * 8, 67, 3, 4, [C.sea3, C.wa2, C.ba4][i % 3]); px(ctx, 11 + i * 8, 67, C.ba1); }
  // 收音機
  rect(ctx, 64, 56, 30, 18, C.ui0); rect(ctx, 65, 57, 28, 16, C.wo3); rect(ctx, 67, 59, 12, 12, C.wo1);
  for (let y = 60; y < 71; y += 2) rect(ctx, 67, y, 12, 1, C.wo2);
  rect(ctx, 82, 59, 9, 4, C.dk7); px(ctx, 85, 60, C.wa1); ellipse(ctx, 86, 67, 2, 2, C.ba3); line(ctx, 90, 56, 96, 46, C.ba3);
  // 吊著的魚乾
  for (let i = 0; i < 4; i++) {
    const x = 104 + i * 10;
    line(ctx, x + 2, 34, x + 2, 40, C.sa2);
    const d = drawFish({ t: 'fusiform', c: [C.wo1, C.wo3, C.sa1], b: C.sa2, p: 'none', pc: C.wo1, f: C.wo2 }, 14, 6, 0, 4);
    ctx.drawImage(rotate90(d).c, x - 1, 40); // 整數像素轉置，不用即時旋轉
  }
  const y0 = BREATH[b];
  // ----- 人物 -----
  const cx = 96;
  // 身體與工作服
  ellipse(ctx, cx, 140 + y0, 46, 34, C.cl0);
  ellipse(ctx, cx - 6, 134 + y0, 30, 22, C.cl1);
  rect(ctx, 50, 140 + y0, 92, 20, C.cl0);
  // 圍裙
  rect(ctx, cx - 22, 116 + y0, 44, 40, C.cl4);
  rect(ctx, cx + 16, 116 + y0, 6, 40, C.sa2);
  line(ctx, cx - 22, 116 + y0, cx - 14, 104 + y0, C.cl4); line(ctx, cx + 22, 116 + y0, cx + 14, 104 + y0, C.cl4);
  rect(ctx, cx - 10, 128 + y0, 20, 10, C.sa2); rect(ctx, cx - 10, 128 + y0, 20, 1, C.sa1);
  // 拉到脖子的花布面罩
  ellipse(ctx, cx, 104 + y0, 22, 7, C.cl2);
  for (let x = cx - 20; x < cx + 20; x += 5) { px(ctx, x, 103 + y0, C.cl3); px(ctx, x + 2, 106 + y0, C.wa3); }
  // 頭巾（後面與兩側）
  ellipse(ctx, cx, 66 + y0, 34, 34, C.cl2);
  rect(ctx, cx - 34, 66 + y0, 10, 34, C.cl2);
  rect(ctx, cx + 24, 66 + y0, 10, 34, C.cl2);
  ellipse(ctx, cx + 8, 62 + y0, 26, 26, C.cl3); // 受光（左上）以外偏暗：先畫亮再壓暗右側
  ellipse(ctx, cx - 6, 60 + y0, 26, 26, C.cl3);
  rect(ctx, cx + 26, 60 + y0, 8, 40, C.cl2);
  // 頭巾花紋：小花
  for (let i = 0; i < 26; i++) {
    const fx = Math.round(cx - 28 + hash2(i, 1, 4) * 56), fy = Math.round(36 + y0 + hash2(i, 2, 4) * 50);
    if ((fx - cx) ** 2 / 900 + (fy - 70 - y0) ** 2 / 500 < 0.55 && fy > 60 + y0) continue; // 臉的位置不畫
    px(ctx, fx, fy, C.ui4); px(ctx, fx - 1, fy, C.wa3); px(ctx, fx + 1, fy, C.wa3); px(ctx, fx, fy - 1, C.wa3); px(ctx, fx, fy + 1, C.wa3);
  }
  // 臉
  ellipse(ctx, cx, 76 + y0, 19, 22, C.sk1);
  ellipse(ctx, cx - 2, 74 + y0, 16, 19, C.sk2);
  px(ctx, cx - 8, 66 + y0, C.sk3); px(ctx, cx - 7, 66 + y0, C.sk3); px(ctx, cx - 9, 67 + y0, C.sk3);
  // 皺紋
  line(ctx, cx - 9, 61 + y0, cx - 3, 61 + y0, C.sk1); line(ctx, cx + 2, 61 + y0, cx + 7, 61 + y0, C.sk1);
  line(ctx, cx - 7, 63 + y0, cx + 5, 63 + y0, C.sk1);
  px(ctx, cx - 14, 72 + y0, C.sk0); px(ctx, cx - 15, 73 + y0, C.sk0); px(ctx, cx + 12, 72 + y0, C.sk0); px(ctx, cx + 13, 73 + y0, C.sk0);
  // 眼睛（瞇眼笑）
  const ey = 70 + y0;
  if (blink) { line(ctx, cx - 11, ey + 1, cx - 5, ey + 1, C.sk0); line(ctx, cx + 3, ey + 1, cx + 9, ey + 1, C.sk0); }
  else {
    line(ctx, cx - 11, ey + 1, cx - 8, ey - 1, C.ui0); line(ctx, cx - 8, ey - 1, cx - 5, ey + 1, C.ui0);
    line(ctx, cx + 3, ey + 1, cx + 6, ey - 1, C.ui0); line(ctx, cx + 6, ey - 1, cx + 9, ey + 1, C.ui0);
  }
  line(ctx, cx - 12, ey - 5, cx - 5, ey - 6, C.ba2); line(ctx, cx + 3, ey - 6, cx + 10, ey - 5, C.ba2);
  // 腮紅、鼻子
  rect(ctx, cx - 14, ey + 6, 4, 2, C.dk5); rect(ctx, cx + 9, ey + 6, 4, 2, C.dk5);
  px(ctx, cx, ey + 7, C.sk0); px(ctx, cx + 1, ey + 8, C.sk0); px(ctx, cx - 1, ey + 8, C.sk1);
  // 嘴
  const my = 86 + y0;
  if (talk === 0) { line(ctx, cx - 6, my, cx - 3, my + 2, C.sk0); line(ctx, cx - 3, my + 2, cx + 3, my + 2, C.sk0); line(ctx, cx + 3, my + 2, cx + 6, my, C.sk0); }
  else if (talk === 1) { rect(ctx, cx - 4, my, 8, 3, C.wo0); rect(ctx, cx - 2, my + 2, 4, 1, C.cl2); rect(ctx, cx - 3, my, 6, 1, C.ui4); }
  else { rect(ctx, cx - 3, my + 1, 6, 2, C.wo0); }
  // 櫃檯
  rect(ctx, 0, 150, PW, 50, C.wo1);
  rect(ctx, 0, 150, PW, 3, C.wo4);
  rect(ctx, 0, 153, PW, 1, C.wo3);
  for (let x = 4; x < PW; x += 22) rect(ctx, x, 158, 1, 42, C.wo0);
  for (let i = 0; i < 30; i++) px(ctx, Math.floor(hash2(i, 5, 1) * PW), 156 + Math.floor(hash2(i, 6, 1) * 40), C.wo2);
  // 靠在櫃檯上的手臂
  rect(ctx, 52, 144 + y0, 34, 8, C.cl0); rect(ctx, 106, 144 + y0, 34, 8, C.cl0);
  rect(ctx, 52, 144 + y0, 34, 2, C.cl1);
  ellipse(ctx, 88, 149 + y0, 6, 4, C.sk1); ellipse(ctx, 87, 148 + y0, 5, 3, C.sk2);
  ellipse(ctx, 104, 149 + y0, 6, 4, C.sk1); ellipse(ctx, 103, 148 + y0, 5, 3, C.sk2);
  // 舊收銀機
  rect(ctx, 136, 124, 40, 26, C.ui0); rect(ctx, 137, 125, 38, 24, C.wo3); rect(ctx, 137, 125, 38, 3, C.wo4);
  rect(ctx, 140, 130, 18, 8, C.dk7); px(ctx, 145, 133, C.ui0); px(ctx, 148, 133, C.ui0); px(ctx, 151, 133, C.ui0);
  for (let y = 140; y < 147; y += 3) for (let x = 140; x < 172; x += 4) rect(ctx, x, y, 3, 2, C.sa3);
  rect(ctx, 160, 116, 12, 8, C.ui0); rect(ctx, 161, 117, 10, 6, C.ba4);
  // 外框描邊
  rect(ctx, 0, 0, PW, 1, C.ui0); rect(ctx, 0, PH - 1, PW, 1, C.ui0);
}

// ---------------- 魚市：阿伯 ----------------
function drawMarket(ctx, b, blink, talk, fishArts) {
  // 背景：清晨的港口
  for (let y = 0; y < 70; y++) rect(ctx, 0, y, PW, 1, y < 25 ? C.sky1 : y < 50 ? C.sky2 : C.dk7);
  rect(ctx, 0, 70, PW, 30, C.sea3);
  for (let i = 0; i < 20; i++) rect(ctx, Math.floor(hash2(i, 1, 2) * PW), 72 + Math.floor(hash2(i, 2, 2) * 26), 4, 1, C.sea5);
  // 漁船
  const hulls = [C.cl1, C.wa1, C.pl2];
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 60;
    rect(ctx, x, 62, 44, 8, hulls[i]); rect(ctx, x + 2, 68, 40, 2, C.ba1);
    rect(ctx, x + 8, 52, 14, 10, C.ui4); rect(ctx, x + 10, 54, 4, 3, C.sea2);
    line(ctx, x + 30, 62, x + 30, 38, C.ba1); rect(ctx, x + 31, 38, 7, 4, hulls[(i + 1) % 3]);
  }
  // 棚子
  rect(ctx, 0, 0, PW, 12, C.wa1);
  for (let x = 0; x < PW; x += 20) rect(ctx, x, 0, 10, 12, C.ui4);
  for (let x = 0; x < PW; x += 10) px(ctx, x + 5, 12, x % 20 ? C.wa1 : C.ui4);
  rect(ctx, 0, 13, PW, 1, C.ui0);
  // 吊秤
  line(ctx, 150, 14, 150, 30, C.ba2); ellipse(ctx, 150, 38, 9, 9, C.ui0); ellipse(ctx, 150, 38, 8, 8, C.ba4); ellipse(ctx, 150, 38, 6, 6, C.ui4);
  line(ctx, 150, 38, 154, 34, C.wa1); line(ctx, 150, 47, 150, 54, C.ba2); rect(ctx, 144, 54, 13, 3, C.ba3);
  const y0 = BREATH[b];
  const cx = 82;
  // 身體：橡膠圍裙（深藍）
  ellipse(ctx, cx, 146 + y0, 48, 36, C.ba2);   // 灰色上衣
  ellipse(ctx, cx - 4, 144 + y0, 42, 32, C.ba3);
  rect(ctx, cx - 26, 116 + y0, 52, 44, C.cl0);
  rect(ctx, cx - 26, 116 + y0, 6, 44, C.cl1);
  line(ctx, cx - 26, 116 + y0, cx - 16, 100 + y0, C.cl0); line(ctx, cx + 26, 116 + y0, cx + 16, 100 + y0, C.cl0);
  // 脖子上的毛巾
  ellipse(ctx, cx, 100 + y0, 20, 6, C.ui4);
  rect(ctx, cx + 8, 100 + y0, 7, 22, C.ui4); rect(ctx, cx + 13, 100 + y0, 2, 22, C.sky2);
  for (let y = 104 + y0; y < 122 + y0; y += 4) rect(ctx, cx + 8, y, 7, 1, C.sky2);
  // 頭
  ellipse(ctx, cx, 72 + y0, 21, 24, C.sk1);
  ellipse(ctx, cx - 2, 70 + y0, 18, 21, C.sk2);
  // 灰白短髮
  ellipse(ctx, cx, 52 + y0, 21, 10, C.ba3);
  rect(ctx, cx - 21, 50 + y0, 6, 18, C.ba3); rect(ctx, cx + 16, 50 + y0, 6, 18, C.ba3);
  for (let i = 0; i < 18; i++) px(ctx, cx - 18 + Math.floor(hash2(i, 3, 3) * 36), 44 + y0 + Math.floor(hash2(i, 4, 3) * 10), C.ba4);
  ellipse(ctx, cx - 21, 72 + y0, 3, 5, C.sk1); ellipse(ctx, cx + 21, 72 + y0, 3, 5, C.sk1); // 耳朵
  // 眼睛、眉毛
  const ey = 68 + y0;
  line(ctx, cx - 12, ey - 5, cx - 5, ey - 4, C.ba2); line(ctx, cx + 4, ey - 4, cx + 11, ey - 5, C.ba2);
  if (blink) { line(ctx, cx - 11, ey, cx - 6, ey, C.sk0); line(ctx, cx + 5, ey, cx + 10, ey, C.sk0); }
  else { rect(ctx, cx - 10, ey - 1, 3, 3, C.ui0); rect(ctx, cx + 6, ey - 1, 3, 3, C.ui0); px(ctx, cx - 10, ey - 1, C.ui4); px(ctx, cx + 6, ey - 1, C.ui4); }
  px(ctx, cx - 13, ey + 2, C.sk1); px(ctx, cx + 12, ey + 2, C.sk1);
  // 鼻子、嘴
  rect(ctx, cx - 1, ey + 4, 3, 6, C.sk1); px(ctx, cx - 2, ey + 9, C.sk0);
  const my = 84 + y0;
  if (talk === 0) { line(ctx, cx - 6, my, cx + 6, my, C.sk0); px(ctx, cx - 7, my - 1, C.sk0); px(ctx, cx + 7, my - 1, C.sk0); }
  else if (talk === 1) { rect(ctx, cx - 5, my - 1, 10, 4, C.wo0); rect(ctx, cx - 4, my - 1, 8, 1, C.ui4); }
  else rect(ctx, cx - 4, my, 8, 2, C.wo0);
  // 鬍渣
  for (let i = 0; i < 14; i++) px(ctx, cx - 10 + Math.floor(hash2(i, 7, 3) * 20), 86 + y0 + Math.floor(hash2(i, 8, 3) * 6), C.sk1);
  // 攤位：碎冰、塑膠籃、魚
  rect(ctx, 0, 150, PW, 50, C.ba2);
  rect(ctx, 0, 150, PW, 2, C.ba4);
  rect(ctx, 6, 156, 168, 30, C.sky3);
  for (let i = 0; i < 90; i++) px(ctx, 6 + Math.floor(hash2(i, 9, 1) * 168), 156 + Math.floor(hash2(i, 10, 1) * 30), hash2(i, 11, 1) < 0.5 ? C.sea6 : C.ui4);
  const arts = fishArts.length ? fishArts : [{ t: 'bream', c: [C.cl2, C.cl3, C.dk6], b: C.dk7, p: 'dots', pc: C.sea4, f: C.cl3 }];
  for (let i = 0; i < 5; i++) {
    const f = drawFish(arts[i % arts.length], 30, 14, 0, 4);
    ctx.drawImage(f.c, 10 + i * 32, 162 + (i % 2) * 8);
  }
  rect(ctx, 0, 188, PW, 12, C.cl1); for (let x = 0; x < PW; x += 6) rect(ctx, x, 190, 3, 8, C.cl0);
  rect(ctx, 0, 0, PW, 1, C.ui0); rect(ctx, 0, PH - 1, PW, 1, C.ui0);
}
