// 無頭模擬測試：4 名玩家自動戰鬥、選增幅、走門，確認整個流程不會丟出例外
import { Game } from '../public/sim.js';
import { TREE } from '../public/data.js';
const maxTree = Object.fromEntries(TREE.map(n => [n.id, n.max]));
const g = new Game({});
['knight', 'ranger', 'mage', 'cleric'].forEach((c, i) => g.addPlayer(i + 1, 'P' + (i + 1), c, { tree: i % 2 ? maxTree : {}, skin: 'default' }));
g.start();
const seen = { types: new Set(), enemies: new Set(), chapters: new Set(), resonance: 0, picks: 0 };
let maxBytes = 0, runs = 0;
const TICKS = 30 * 60 * 25;
for (let t = 0; t < TICKS; t++) {
  for (const p of g.players.values()) {
    if (p.choice) { g.pick(p.id, Math.floor(Math.random() * 3)); seen.picks++; continue; }
    let target;
    if (g.doors) target = g.doors[0];
    else if (g.objs.length && g.phase === 'explore') target = g.objs.find(o => g.usable(o, p)) || { x: p.x, y: p.y };
    else { const e = g.enemies[0]; target = e ? { x: p.x + (e.x - p.x) * 0.3, y: p.y + (e.y - p.y) * 0.3 } : { x: (g.room.cx + .5) * 16, y: (g.room.cy + .5) * 16 }; }
    const a = Math.atan2(target.y - p.y, target.x - p.x) + (Math.random() - .5) * 0.4;
    const far = Math.hypot(target.y - p.y, target.x - p.x) > 4;
    g.setInput(p.id, { mx: far ? Math.cos(a) : 0, my: far ? Math.sin(a) : 0, aim: null, fire: true, skill: Math.random() < .03, dodge: Math.random() < .01 });
    // 測試加速：大幅降低受傷，偶爾傳送卡住的玩家
    if (p.downed && Math.random() < 0.02) { p.downed = false; p.hp = p.maxhp; }
    if (g.isUp(p) && Math.random() < 0.003) { p.x = target.x; p.y = target.y; }
  }
  for (const e of g.enemies) if (!e.boss && Math.random() < 0.002) e.hp = 0, g.killEnemy(e, g.players.get(1));
  if (g.boss && Math.random() < 0.01) g.boss.hp -= g.boss.maxhp * 0.05;
  g.step(1 / 30);
  seen.types.add(g.stype); seen.chapters.add(g.chapter);
  for (const e of g.enemies) seen.enemies.add(e.type);
  const s = g.snapshot();
  for (const ev of s.ev) if (ev.k === 'res') seen.resonance++;
  maxBytes = Math.max(maxBytes, JSON.stringify(s).length);
  if (g.state === 'over') { runs++; console.log('run end', g.result); g.start(); }
}
console.log({ stageTypes: [...seen.types], chapters: [...seen.chapters], enemyTypes: seen.enemies.size, picks: seen.picks, resonance: seen.resonance, maxSnapshotBytes: maxBytes, runs });
