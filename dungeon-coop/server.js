// 深淵獵團 — 線上共鬥伺服器（伺服器權威模擬，30 Hz）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game, CLASSES } from './public/sim.js';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };
const TICK = 1 / 30;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: { threshold: 512 } });
const rooms = new Map();
let nextId = 1;

const send = (ws, o) => { if (ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
const broadcast = (r, o) => { const s = JSON.stringify(o); for (const c of r.clients.values()) if (c.ws.bufferedAmount < 1 << 20) send(c.ws, s); };
function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; if (!rooms.has(c)) return c; }
}
function lobby(r) {
  broadcast(r, { t: 'lobby', code: r.code, host: r.host, playing: !!r.game,
    players: [...r.clients.entries()].map(([id, c]) => ({ id, name: c.name, cls: c.cls, ready: c.ready })) });
}
function join(ws, r, name) {
  if (r.clients.size >= 4) return send(ws, { t: 'err', msg: '房間已滿（最多 4 人）' });
  const used = new Set([...r.clients.values()].map(c => c.cls));
  const cls = Object.keys(CLASSES).find(c => !used.has(c)) || 'knight';
  const c = { ws, name: String(name || '').trim().slice(0, 10) || '獵人' + ws.id, cls, ready: false, meta: {} };
  r.clients.set(ws.id, c); ws.room = r;
  send(ws, { t: 'joined', id: ws.id, code: r.code });
  if (r.game) { r.game.addPlayer(ws.id, c.name, c.cls, c.meta); send(ws, r.game.mapData()); }
  lobby(r);
}
function startGame(r) {
  r.game = new Game({});
  for (const [id, c] of r.clients) r.game.addPlayer(id, c.name, c.cls, c.meta);
  r.game.start();
  r.mapV = -1;
  r.timer = setInterval(() => tick(r), TICK * 1000);
  lobby(r);
}
function stopGame(r) {
  clearInterval(r.timer); r.timer = null; r.game = null;
  for (const c of r.clients.values()) c.ready = false;
  lobby(r);
}
function tick(r) {
  const g = r.game; if (!g) return;
  g.step(TICK);
  if (g.mapVersion !== r.mapV) { r.mapV = g.mapVersion; broadcast(r, g.mapData()); }
  broadcast(r, g.snapshot());
  if (g.state === 'over' && g.overT <= 0) stopGame(r);
}
function leave(ws) {
  const r = ws.room; if (!r) return;
  r.clients.delete(ws.id); ws.room = null;
  if (r.game) r.game.removePlayer(ws.id);
  if (r.clients.size === 0) { if (r.timer) clearInterval(r.timer); rooms.delete(r.code); return; }
  if (r.host === ws.id) r.host = r.clients.keys().next().value;
  lobby(r);
}

wss.on('connection', ws => {
  ws.id = nextId++;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const r = ws.room, c = r && r.clients.get(ws.id);
    switch (m.t) {
      case 'create': {
        if (r) return;
        const room = { code: makeCode(), clients: new Map(), host: ws.id, game: null, timer: null };
        rooms.set(room.code, room); join(ws, room, m.name);
        break;
      }
      case 'join': {
        if (r) return;
        const room = rooms.get(String(m.code || '').toUpperCase());
        if (!room) return send(ws, { t: 'err', msg: '找不到這個房間代碼' });
        join(ws, room, m.name);
        break;
      }
      case 'class': if (c && !r.game && CLASSES[m.c]) { c.cls = m.c; lobby(r); } break;
      case 'meta': // 角色永久強化與皮膚（存在玩家自己的瀏覽器，Game.addPlayer 會再驗證範圍）
        if (c && m.meta && typeof m.meta === 'object') c.meta = { tree: m.meta.tree && typeof m.meta.tree === 'object' ? m.meta.tree : {}, skin: String(m.meta.skin || 'default').slice(0, 20) };
        break;
      case 'pick': if (c && r.game) r.game.pick(ws.id, m.i | 0); break;
      case 'reroll': if (c && r.game) r.game.reroll(ws.id); break;
      case 'ready': if (c && !r.game) { c.ready = !c.ready; lobby(r); } break;
      case 'start':
        if (!c || r.game) return;
        if (r.host !== ws.id) return send(ws, { t: 'err', msg: '只有房主可以開始遊戲' });
        if (![...r.clients.values()].every(x => x.ready)) return send(ws, { t: 'err', msg: '還有玩家尚未準備' });
        startGame(r);
        break;
      case 'in':
        if (c && r.game) {
          const n = v => (Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0);
          const b = m.b | 0;
          r.game.setInput(ws.id, { mx: n(m.mx), my: n(m.my), aim: m.a == null || !Number.isFinite(+m.a) ? null : +m.a, fire: !!(b & 1), skill: !!(b & 2), dodge: !!(b & 4) });
        }
        break;
      case 'leave': leave(ws); break;
    }
  });
  ws.on('close', () => leave(ws));
});

server.listen(PORT, () => {
  console.log(`深淵獵團 伺服器已啟動： http://localhost:${PORT}`);
  console.log('同一個網路的朋友請用你的區網 IP 連入，例如 http://192.168.x.x:' + PORT);
});
