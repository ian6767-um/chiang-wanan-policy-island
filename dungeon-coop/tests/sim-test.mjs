// 無頭模擬測試：聖殿大廳 → 職業祭壇 → 傳送陣倒數 → 地牢；4 職業自動戰鬥、選增幅、走門
// 強制打過全部 15 隻頭目，並檢查小怪只出現在自己的章節
import { Game } from '../public/sim.js';
import { TREE, ENEMIES, BOSSES, CHAPTERS, CLASSES } from '../public/data.js';
const assert = (c, m) => { if (!c) { console.error('✗', m); process.exitCode = 1; } else console.log('✓', m); };
const maxTree = Object.fromEntries(TREE.map(n => [n.id, n.max]));
const g = new Game({});
g.enterHub();
const classes = Object.keys(CLASSES);
for (let i = 0; i < 4; i++) g.addPlayer(i + 1, 'P' + (i + 1), 'blade', { trees: { [classes[i]]: i % 2 ? maxTree : {} } });
const step = n => { for (let i = 0; i < n; i++) g.step(1 / 30); };
const evs = [];
const flush = () => { const s = g.snapshot(); evs.push(...s.ev); return s; };
// 走到各自的職業祭壇並按互動鍵
for (const [i, p] of [...g.players.values()].entries()) {
  const altar = g.objs.find(o => o.k === 'classAltar' && o.cls === classes[i]);
  p.x = altar.x; p.y = altar.y + 4;
  g.setInput(p.id, { mx: 0, my: 0, aim: 0, use: true }); step(1); g.setInput(p.id, { mx: 0, my: 0, aim: 0, use: false }); step(1);
}
assert([...g.players.values()].map(p => p.cls).join() === classes.join(), '在祭壇切換為 4 種職業');
// 衣櫃
const ward = g.objs.find(o => o.k === 'wardrobe'), p1 = g.players.get(1);
p1.x = ward.x; p1.y = ward.y + 4; g.setInput(1, { use: true }); step(1); g.setInput(1, { use: false }); step(1);
assert(flush().ev.some(e => e.k === 'ui' && e.w === 'wardrobe') || evs.some(e => e.k === 'ui'), '鏡像衣櫃開啟造型面板');
// 訓練木樁：攻擊後木樁不會死
const dummy = g.enemies.find(e => e.type === 'dummy');
p1.x = dummy.x - 20; p1.y = dummy.y; g.setInput(1, { aim: 0, fire: true }); step(60); g.setInput(1, { aim: 0 });
assert(!dummy.dead && evs.concat(flush().ev).some(e => e.k === 'hit'), '訓練木樁受到傷害並且不會死亡');
// 傳送陣：全員站上去並準備 → 倒數 3 秒
const po = g.portal();
for (const p of g.players.values()) { p.x = po.x + (p.id - 2.5) * 8; p.y = po.y; g.setInput(p.id, { use: true }); }
step(1); for (const p of g.players.values()) g.setInput(p.id, { use: false });
assert([...g.players.values()].every(p => p.ready), '全員按下準備');
step(30 * 2); assert(g.state === 'hub' && g.countdown > 0, '倒數進行中');
step(30 * 1.2); assert(g.state === 'play', '倒數 3 秒後進入地牢');

const seen = { types: new Set(), enemies: new Set(), chapters: new Set(), resonance: 0, picks: 0, bosses: new Set(), wrong: new Set(), ults: new Set(), specials: new Set(), torch: 0, revived: 0 };
const bossQueue = CHAPTERS.map(c => [...c.bosses]);
const origEnter = g.enterStage.bind(g);
g.enterStage = (type, first) => { origEnter(type, first); if (g.stype === 'boss') { const q = bossQueue[g.chapter - 1]; g.bossId = q.length ? q.shift() : g.bossId; } };
let maxBytes = 0, runs = 0;
for (let t = 0; t < 30 * 60 * 90; t++) {
  for (const p of g.players.values()) {
    if (p.choice) { g.pick(p.id, Math.floor(Math.random() * 3)); seen.picks++; continue; }
    let target;
    if (g.state === 'hub') { const po2 = g.portal(); target = po2; }
    else if (g.doors) target = g.doors[0];
    else if (g.objs.length && g.phase === 'explore') target = g.objs.find(o => g.usable(o, p)) || { x: p.x, y: p.y };
    else { const e = g.enemies[0]; target = e ? { x: p.x + (e.x - p.x) * 0.3, y: p.y + (e.y - p.y) * 0.3 } : { x: (g.room.cx + .5) * 16, y: (g.room.cy + .5) * 16 }; }
    const a = Math.atan2(target.y - p.y, target.x - p.x) + (Math.random() - .5) * 0.4;
    const far = Math.hypot(target.y - p.y, target.x - p.x) > 4;
    const downedTeammate = [...g.players.values()].find(q => q.downed);
    g.setInput(p.id, { mx: far ? Math.cos(a) : 0, my: far ? Math.sin(a) : 0, aim: null, fire: g.enemies.length > 0 && g.state === 'play' && Math.random() < 0.9, skill: Math.random() < .03, dodge: Math.random() < .01,
      ult: g.enemies.length > 0 && Math.random() < .02, use: g.state === 'hub' ? false : g.phase === 'explore' || !!downedTeammate });
    if (downedTeammate && !p.downed && g.isUp(p) && Math.random() < 0.05) { p.x = downedTeammate.x + 5; p.y = downedTeammate.y; }
    if (g.isUp(p) && Math.random() < 0.003) { p.x = target.x; p.y = target.y; }
  }
  for (const e of g.enemies) if (!e.boss && e.type !== 'dummy' && Math.random() < 0.002) e.hp = 0, g.killEnemy(e, g.players.get(1));
  for (const e of g.enemies) if (e.boss && Math.random() < 0.01) e.hp -= e.maxhp * 0.05;
  const downedBefore = [...g.players.values()].filter(p => p.downed).length;
  g.step(1 / 30);
  if (g.state === 'play') { seen.types.add(g.stype); seen.chapters.add(g.chapter); }
  for (const e of g.enemies) {
    if (g.state !== 'play') continue;
    seen.enemies.add(e.type);
    if (e.boss) seen.bosses.add(e.type);
    const ch = (ENEMIES[e.type] || BOSSES[e.type]).ch;
    if (ch !== g.chapter) seen.wrong.add(`${e.type}(第${ch}章→第${g.chapter}章)`);
  }
  const s = g.snapshot();
  for (const ev of s.ev) {
    if (ev.k === 'res') seen.resonance++;
    if (ev.k === 'ult') seen.ults.add(ev.c);
    if (ev.k === 'skill') seen.specials.add(ev.c);
    if (ev.k === 'text' && ev.m.includes('靈魂火炬！')) seen.torch++;
    if (ev.k === 'text' && ev.m.includes('重生')) seen.revived++;
    if (ev.k === 'over') { runs++; }
  }
  maxBytes = Math.max(maxBytes, JSON.stringify(s).length);
  if (g.state === 'hub' && runs > 0) {
    if (!bossQueue.some(q => q.length)) break;
    for (const p of g.players.values()) { p.ready = true; p.x = g.portal().x; p.y = g.portal().y; }
  }
}
console.log('頭目', [...seen.bosses].join(' '));
assert(seen.bosses.size === 16, '15 隻頭目（雙子算 2 隻）都出現過');
assert(seen.wrong.size === 0, '小怪只出現在所屬章節 ' + [...seen.wrong].join(','));
assert(seen.ults.size === 4 && seen.specials.size === 4, '4 職業都施放過特殊技與大招');
assert(seen.torch > 0 && seen.revived > 0, `靈魂火炬倒地 ${seen.torch} 次、被救起 ${seen.revived} 次`);
assert(runs >= 1, `完成 ${runs} 輪冒險後回到聖殿`);
console.log({ stageTypes: [...seen.types], chapters: [...seen.chapters], enemyTypes: seen.enemies.size, picks: seen.picks, resonance: seen.resonance, maxSnapshotBytes: maxBytes });
