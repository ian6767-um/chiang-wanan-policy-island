// 無頭模擬測試：4 名玩家隨機行動 + 作弊推進，確認不會丟出例外、能打到頭目並進下一層
import { Game } from '../public/sim.js';
const g = new Game({});
['knight', 'ranger', 'mage', 'cleric'].forEach((c, i) => g.addPlayer(i + 1, 'P' + (i + 1), c));
g.start();
let floorsSeen = new Set([1]), bossSeen = 0, maxBytes = 0, ticks = 0;
for (let t = 0; t < 30 * 60 * 6; t++) {
  ticks++;
  for (const p of g.players.values()) {
    // 朝著未清除的房間走，隨機攻擊/技能/翻滾
    const target = g.portal || (() => { const r = g.rooms.find(r => !r.cleared) || g.rooms[0]; return { x: (r.cx + .5) * 16, y: (r.cy + .5) * 16 }; })();
    const a = Math.atan2(target.y - p.y, target.x - p.x) + (Math.random() - .5);
    g.setInput(p.id, { mx: Math.cos(a), my: Math.sin(a), aim: null, fire: true, skill: Math.random() < .02, dodge: Math.random() < .01 });
    if (p.downed && Math.random() < 0.01) { p.downed = false; p.hp = p.maxhp; }      // 測試用：避免全滅
    if (!p.dead && !p.downed && Math.random() < 0.002) p.x = target.x, p.y = target.y; // 測試用：卡路時傳送
    p.hp = Math.max(p.hp, 1) && p.hp;
  }
  g.step(1 / 30);
  if (g.boss) bossSeen++;
  floorsSeen.add(g.floor);
  const s = JSON.stringify(g.snapshot());
  maxBytes = Math.max(maxBytes, s.length);
  if (g.state === 'over') { console.log('game over at floor', g.floor, 'tick', t); g.start(); }
}
console.log({ ticks, floors: [...floorsSeen], bossTicks: bossSeen, maxSnapshotBytes: maxBytes, mapBytes: JSON.stringify(g.mapData()).length });
