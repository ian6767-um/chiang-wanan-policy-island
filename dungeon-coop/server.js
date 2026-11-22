// 深淵獵團 — 伺服器：靜態檔案 + REST 帳號 API + WebSocket 房間（伺服器權威模擬 30 Hz）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game } from './public/sim.js';
import { CLASSES } from './public/data.js';
import { Accounts, AccountError } from './server/accounts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(HERE, 'public');
const accounts = new Accounts(process.env.ABYSS_DATA || path.join(HERE, 'data'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const TICK = 1 / 30;

// ---------- 簡單的登入嘗試限制 ----------
const attempts = new Map();
function limited(ip) {
  const now = Date.now(), a = (attempts.get(ip) || []).filter(t => now - t < 60_000);
  a.push(now); attempts.set(ip, a);
  return a.length > 20;
}

// ---------- REST API ----------
function readBody(req) {
  return new Promise((ok, bad) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 10_000) { bad(new AccountError('資料過大')); req.destroy(); } });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch { bad(new AccountError('格式錯誤')); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
async function api(req, res, route) {
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const auth = (req.headers.authorization || '').replace(/^Bearer /, '');
    const me = accounts.verify(auth);
    const need = () => { if (!me) throw new AccountError('請重新登入'); return me; };
    const ok = u => json(res, 200, { token: accounts.sign(u.id), profile: accounts.profile(u) });
    const ip = req.socket.remoteAddress;
    switch (route) {
      case 'register': if (limited(ip)) throw new AccountError('嘗試太頻繁，請稍後再試'); return ok(accounts.register(body.username, body.password, body.nick));
      case 'login': if (limited(ip)) throw new AccountError('嘗試太頻繁，請稍後再試'); return ok(accounts.login(body.username, body.password));
      case 'guest': if (limited(ip)) throw new AccountError('嘗試太頻繁，請稍後再試'); return ok(accounts.guest(body.nick));
      case 'bind': return ok(accounts.bind(need(), body.username, body.password));
      case 'me': return ok(need());
      case 'nick': accounts.setNick(need(), body.nick); syncPlayer(me); return ok(me);
      case 'tree': accounts.buyTree(need(), body.cls, body.node); syncPlayer(me); return ok(me);
      case 'skin': accounts.skin(need(), body.cls, body.skin); syncPlayer(me); return ok(me);
      default: return json(res, 404, { error: '找不到 API' });
    }
  } catch (e) {
    if (e instanceof AccountError) return json(res, 400, { error: e.message });
    console.error(e); return json(res, 500, { error: '伺服器錯誤' });
  }
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/api/music') {
    // 列出 public/music 內可用的 AI 生成配樂（title / hub / dungeon / boss .mp3）
    let files = [];
    try { files = fs.readdirSync(path.join(ROOT, 'music')).filter(f => /^(title|hub|dungeon|boss)\.mp3$/.test(f)); } catch { /* 沒有資料夾就用合成音樂 */ }
    return json(res, 200, { files });
  }
  if (url.startsWith('/api/')) return api(req, res, url.slice(5));
  const file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- 房間（4 位數純數字代碼） ----------
const rooms = new Map();
const online = new Map();  // 帳號 id → ws
let nextId = 1;
const send = (ws, o) => { if (ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
const broadcast = (r, o) => { const s = JSON.stringify(o); for (const ws of r.clients.values()) if (ws.bufferedAmount < 1 << 20) send(ws, s); };
function makeCode() {
  if (rooms.size >= 10000) return null;
  for (;;) { const c = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); if (!rooms.has(c)) return c; }
}
function roomInfo(r) {
  broadcast(r, { t: 'room', code: r.code, host: r.host, players: [...r.clients.values()].map(ws => ({ id: ws.id, nick: ws.user.nick })) });
}
function syncPlayer(u) {
  const ws = online.get(u.id);
  if (ws && ws.room) { ws.room.game.setMeta(ws.id, accounts.meta(u)); const p = ws.room.game.players.get(ws.id); if (p) p.name = u.nick; }
  if (ws) send(ws, { t: 'profile', profile: accounts.profile(u) });
}
function join(ws, r) {
  if (r.clients.size >= 4) return send(ws, { t: 'err', msg: '房間已滿（上限 4 人）' });
  if (r.game.state !== 'hub') return send(ws, { t: 'err', msg: '這個房間的遊戲已經開始，請等他們回到聖殿再加入' });
  r.clients.set(ws.id, ws); ws.room = r;
  r.game.addPlayer(ws.id, ws.user.nick, ws.user.cls, accounts.meta(ws.user));
  send(ws, { t: 'joined', id: ws.id, code: r.code });
  send(ws, r.game.mapData());
  roomInfo(r);
}
function tick(r) {
  const g = r.game;
  g.step(TICK);
  if (g.mapVersion !== r.mapV) { r.mapV = g.mapVersion; broadcast(r, g.mapData()); }
  const snap = g.snapshot();
  for (const e of snap.ev) {
    if (e.k === 'cls') { const ws = r.clients.get(e.i); if (ws) accounts.setClass(ws.user, e.c); }
    if (e.k === 'over') for (const ws of r.clients.values()) {
      const got = accounts.reward(ws.user, e, e.kills[ws.id] || 0);
      send(ws, { t: 'reward', crystals: got, profile: accounts.profile(ws.user) });
    }
  }
  broadcast(r, snap);
}
function leave(ws) {
  const r = ws.room; if (!r) return;
  r.clients.delete(ws.id); ws.room = null;
  r.game.removePlayer(ws.id);
  if (r.clients.size === 0) { clearInterval(r.timer); rooms.delete(r.code); return; }
  if (r.host === ws.id) r.host = r.clients.keys().next().value;
  roomInfo(r);
}

const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: { threshold: 512 } });
wss.on('connection', ws => {
  ws.id = nextId++;
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'auth') {
      const u = accounts.verify(m.token);
      if (!u) return send(ws, { t: 'autherr' });
      const old = online.get(u.id);
      if (old && old !== ws) { send(old, { t: 'err', msg: '此帳號已在其他地方登入' }); old.close(); }
      ws.user = u; online.set(u.id, ws);
      return send(ws, { t: 'authok', profile: accounts.profile(u) });
    }
    if (!ws.user) return;
    const r = ws.room;
    switch (m.t) {
      case 'create': {
        if (r) return;
        const code = makeCode();
        if (!code) return send(ws, { t: 'err', msg: '目前房間已滿，請稍後再試' });
        const game = new Game({});
        game.enterHub();
        const room = { code, clients: new Map(), host: ws.id, game, mapV: -1 };
        room.timer = setInterval(() => tick(room), TICK * 1000);
        rooms.set(code, room);
        join(ws, room);
        break;
      }
      case 'join': {
        if (r) return;
        const code = String(m.code || '').trim();
        if (!/^\d{4}$/.test(code)) return send(ws, { t: 'err', msg: '請輸入 4 位數字的房間號碼' });
        const room = rooms.get(code);
        if (!room) return send(ws, { t: 'err', msg: `找不到房間 ${code}，請確認號碼` });
        join(ws, room);
        break;
      }
      case 'leave': leave(ws); send(ws, { t: 'left' }); break;
      case 'in':
        if (r) {
          const n = v => (Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0), b = m.b | 0;
          r.game.setInput(ws.id, { mx: n(m.mx), my: n(m.my), aim: m.a == null || !Number.isFinite(+m.a) ? null : +m.a, ad: Number.isFinite(+m.d) ? +m.d : 80,
            fire: !!(b & 1), skill: !!(b & 2), dodge: !!(b & 4), ult: !!(b & 8), use: !!(b & 16) });
        }
        break;
      case 'dev': // 只有在 ABYSS_DEV=1 時開放的測試指令
        if (!process.env.ABYSS_DEV || !r) return;
        if (m.cmd === 'start') r.game.startRun();
        if (m.cmd === 'boss') { const g = r.game; g.chapter = m.ch || 1; g.stage = 9; g.enterStage('boss'); if (m.id) g.bossId = m.id; }
        if (m.cmd === 'stage') { const g = r.game; g.enterStage(m.ty || 'combat'); }
        if (m.cmd === 'god') for (const p of r.game.players.values()) { p.maxhp = p.hp = 99999; }
        if (m.cmd === 'ult') for (const p of r.game.players.values()) p.ultE = 300;
        if (m.cmd === 'down') { const p = r.game.players.get(ws.id); if (p) { p.hp = 0; r.game.goDown(p); } }
        if (m.cmd === 'cls') r.game.setClass(ws.id, m.c);
        if (m.cmd === 'skin') r.game.setSkin(ws.id, m.c, m.s);
        if (m.cmd === 'boons') for (const p of r.game.players.values()) p.cq.push('normal');
        break;
      case 'pick': if (r) r.game.pick(ws.id, m.i | 0); break;
      case 'reroll': if (r) r.game.reroll(ws.id); break;
      case 'skin':
        // 衣櫃切換造型：驗證擁有權後同步給房間並存入帳號
        try {
          if (!CLASSES[m.cls]) return;
          if (!(ws.user.owned[m.cls] || []).includes(m.skin)) return send(ws, { t: 'err', msg: '尚未解鎖這個造型' });
          accounts.skin(ws.user, m.cls, m.skin);
          if (r) r.game.setSkin(ws.id, m.cls, m.skin);
          send(ws, { t: 'profile', profile: accounts.profile(ws.user) });
        } catch (e) { send(ws, { t: 'err', msg: e.message }); }
        break;
    }
  });
  ws.on('close', () => { leave(ws); if (ws.user && online.get(ws.user.id) === ws) online.delete(ws.user.id); });
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { accounts.flush(); process.exit(0); });
server.listen(PORT, () => {
  console.log(`深淵獵團 伺服器已啟動： http://localhost:${PORT}`);
  console.log('帳號資料存放於', accounts.dir);
});
