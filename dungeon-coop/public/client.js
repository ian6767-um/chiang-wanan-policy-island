import { Game, CLASSES, T } from './sim.js';
import { buildSprites } from './sprites.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SPR = buildSprites();
const CLS = Object.keys(CLASSES);
const BOSS_T = new Set(['golem', 'dragon', 'lich']);

// ---------- 畫布 ----------
const cv = $('game'), ctx = cv.getContext('2d');
const buf = document.createElement('canvas'), b = buf.getContext('2d');
const light = document.createElement('canvas'), lx = light.getContext('2d');
let DPR = 1, SCALE = 3, VW = 480, VH = 270, U = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  cv.width = Math.floor(innerWidth * DPR); cv.height = Math.floor(innerHeight * DPR);
  SCALE = Math.max(2, Math.round(Math.min(cv.width / 480, cv.height / 270)));
  VW = Math.ceil(cv.width / SCALE); VH = Math.ceil(cv.height / SCALE);
  buf.width = VW; buf.height = VH; light.width = VW; light.height = VH;
  U = Math.max(0.85, Math.min(cv.width / 1280, cv.height / 720));
}
addEventListener('resize', resize); resize();

// ---------- 狀態 ----------
let mode = 'menu';          // menu | online | local
let inGame = false;
let map = null, snap = null, prev = null, snapT = 0, prevMaps = null;
let myId = null, local = null, overInfo = null, lobbyState = null;
const fx = { parts: [], nums: [], rings: [], slashes: [], banners: [], beams: [], bossIntro: null };
let shake = 0, floorT = 0;
const cam = { x: 0, y: 0, init: false };
let camO = { x: 0, y: 0 };

// ---------- 音效 ----------
let AC = null, master = null, noiseBuf = null;
const lastS = {};
function audioInit() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.3; master.connect(AC.destination); } catch { AC = null; }
}
function tone(f, d, type = 'square', v = 0.12, f2 = null, delay = 0) {
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, v = 0.2, freq = 800) {
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const c = noiseBuf.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; }
  const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d);
}
function sfx(n) {
  if (!AC) return;
  const now = performance.now();
  if (lastS[n] && now - lastS[n] < 45) return;
  lastS[n] = now;
  const seq = (fs, d, type, v, gap) => fs.forEach((f, i) => tone(f, d, type, v, null, i * gap));
  switch (n) {
    case 'atk_knight': noise(0.08, 0.15, 3000); break;
    case 'atk_ranger': tone(900, 0.05, 'triangle', 0.05, 500); break;
    case 'atk_mage': tone(300, 0.12, 'sawtooth', 0.05, 120); break;
    case 'atk_cleric': tone(1200, 0.08, 'sine', 0.05, 1600); break;
    case 'hit': tone(200, 0.05, 'square', 0.04, 90); break;
    case 'die': tone(400, 0.15, 'square', 0.07, 60); break;
    case 'hurt': tone(160, 0.18, 'sawtooth', 0.12, 60); break;
    case 'dodge': noise(0.1, 0.08, 1500); break;
    case 'coin': tone(1300, 0.05, 'square', 0.04); tone(1800, 0.07, 'square', 0.04, null, 0.05); break;
    case 'pickup': tone(600, 0.1, 'sine', 0.1, 1200); break;
    case 'door': tone(110, 0.25, 'square', 0.1, 70); noise(0.2, 0.15, 400); break;
    case 'clear': seq([523, 659, 784], 0.15, 'square', 0.06, 0.08); break;
    case 'chest': seq([523, 659, 784, 1047], 0.18, 'triangle', 0.1, 0.07); break;
    case 'boom': noise(0.35, 0.3, 500); tone(90, 0.3, 'sine', 0.2, 40); break;
    case 'roar': tone(140, 0.5, 'sawtooth', 0.12, 70); noise(0.4, 0.1, 700); break;
    case 'jump': tone(200, 0.4, 'sine', 0.1, 500); break;
    case 'stun': seq([880, 660, 880], 0.1, 'square', 0.07, 0.08); break;
    case 'fireball': tone(220, 0.2, 'sawtooth', 0.08, 90); break;
    case 'blink': tone(1500, 0.2, 'sine', 0.08, 300); break;
    case 'down': tone(300, 0.5, 'triangle', 0.15, 80); break;
    case 'revive': seq([392, 523, 659], 0.15, 'sine', 0.1, 0.08); break;
    case 'victory': seq([523, 659, 784, 1047, 784, 1047], 0.2, 'square', 0.07, 0.12); break;
    case 'skill': tone(400, 0.3, 'triangle', 0.12, 1200); break;
    case 'boss': tone(80, 1.0, 'sawtooth', 0.15, 50); break;
  }
}
addEventListener('pointerdown', audioInit);
addEventListener('keydown', audioInit);

// ---------- 介面 ----------
function show(id) {
  for (const p of ['menu', 'lobby', 'local']) $(p).classList.toggle('hidden', p !== id);
  $('ui').classList.remove('hidden'); inGame = false;
}
function hideUI() { $('ui').classList.add('hidden'); inGame = true; }
function err(m, el = 'err') { $(el).textContent = m || ''; }
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
$('name').value = store.get('ah_name') || '';
const myName = () => { const n = $('name').value.trim().slice(0, 10) || '獵人' + Math.floor(Math.random() * 900 + 100); store.set('ah_name', n); return n; };

function classCard(cls, selected, onClick, takenBy = []) {
  const c = CLASSES[cls], d = document.createElement('div');
  d.className = 'card' + (selected ? ' sel' : '');
  const pc = document.createElement('canvas'); pc.width = 72; pc.height = 84;
  const px = pc.getContext('2d'); px.imageSmoothingEnabled = false; px.drawImage(SPR.players[cls][0].n, 0, 0, 72, 84);
  d.appendChild(pc);
  d.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${c.color}">${c.name}</div>
    <div class="ds">生命 ${c.hp} · 護盾 ${c.shield}<br>${c.desc}</div>
    <div class="sk">技能【${c.skillName}】${c.skillDesc}</div>` + (takenBy.length ? `<div class="taken">${takenBy.map(esc).join('、')}</div>` : ''));
  d.onclick = onClick;
  return d;
}
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// ---------- 線上 ----------
let ws = null;
function wsSend(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function connect(first) {
  if (location.protocol === 'file:') return err('線上模式需要先執行 node server.js 再用瀏覽器開啟');
  if (ws && ws.readyState === 1) return wsSend(first);
  err('連線中…');
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => { err(''); wsSend(first); };
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  ws.onerror = () => err('無法連線到伺服器（線上模式需用 node server.js 啟動）');
  ws.onclose = () => { const wasOnline = mode === 'online'; ws = null; if (wasOnline) { mode = 'menu'; show('menu'); err('與伺服器的連線已中斷'); } };
}
function onMsg(m) {
  switch (m.t) {
    case 'joined': myId = m.id; mode = 'online'; snap = prev = map = null; break;
    case 'lobby':
      lobbyState = m;
      if (!m.playing) { if (inGame || $('lobby').classList.contains('hidden')) { show('lobby'); overInfo = null; snap = null; } renderLobby(); }
      break;
    case 'map': loadMap(m); break;
    case 's':
      prev = snap; snap = m; snapT = performance.now();
      prevMaps = prev ? { p: new Map(prev.ps.map(o => [o.i, o])), e: new Map(prev.es.map(o => [o.i, o])), r: new Map(prev.pr.map(o => [o.i, o])) } : null;
      handleEvents(m.ev);
      if (!inGame && map) hideUI();
      break;
    case 'err': err(m.msg, $('lobby').classList.contains('hidden') ? 'err' : 'err2'); break;
  }
}
function renderLobby() {
  const L = lobbyState; if (!L) return;
  $('roomCode').textContent = L.code;
  const me = L.players.find(p => p.id === myId);
  const cont = $('classes'); cont.innerHTML = '';
  for (const c of CLS) cont.appendChild(classCard(c, me && me.cls === c, () => wsSend({ t: 'class', c }), L.players.filter(p => p.cls === c && p.id !== myId).map(p => p.name)));
  const pl = $('plist'); pl.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const p = L.players[i], d = document.createElement('div');
    d.className = 'pslot' + (p ? ' on' : '');
    d.innerHTML = p ? `<b>${p.id === L.host ? '👑 ' : ''}${esc(p.name)}${p.id === myId ? '（你）' : ''}</b><br><span style="color:${CLASSES[p.cls].color}">${CLASSES[p.cls].name}</span><div class="rd ${p.ready ? 'ok' : ''}">${p.ready ? '✔ 已準備' : '尚未準備'}</div>`
      : '<span class="note">等待玩家加入…</span>';
    pl.appendChild(d);
  }
  $('btnReady').textContent = me && me.ready ? '取消準備' : '準備';
  const host = L.host === myId, allReady = L.players.every(p => p.ready);
  $('btnStart').style.display = host ? '' : 'none';
  $('btnStart').disabled = !allReady;
  $('lobbyNote').textContent = host ? (allReady ? '全員準備完成，可以出發！' : '等待全員按下「準備」') : '等待房主開始遊戲…';
}
$('btnCreate').onclick = () => { err(''); connect({ t: 'create', name: myName() }); };
$('btnJoin').onclick = () => { const code = $('code').value.trim().toUpperCase(); if (code.length !== 4) return err('請輸入 4 碼房間代碼'); connect({ t: 'join', code, name: myName() }); };
$('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnReady').onclick = () => wsSend({ t: 'ready' });
$('btnStart').onclick = () => wsSend({ t: 'start' });
$('btnLeave').onclick = () => { mode = 'menu'; if (ws) ws.close(); show('menu'); };

// ---------- 本機同樂 ----------
const DEVICES = { kbm: '鍵盤＋滑鼠', kb2: '第二組鍵盤（IJKL）', pad0: '手把 1', pad1: '手把 2', pad2: '手把 3', pad3: '手把 4' };
const localCfg = [
  { on: true, dev: 'kbm', cls: 'knight', name: '玩家1' },
  { on: false, dev: 'kb2', cls: 'ranger', name: '玩家2' },
  { on: false, dev: 'pad0', cls: 'mage', name: '玩家3' },
  { on: false, dev: 'pad1', cls: 'cleric', name: '玩家4' },
];
function renderLocal() {
  const box = $('localSlots'); box.innerHTML = '';
  localCfg.forEach((s, i) => {
    const d = document.createElement('div'); d.className = 'lslot' + (s.on ? '' : ' off');
    const pc = document.createElement('canvas'); pc.width = 48; pc.height = 56; pc.style.cssText = 'width:48px;height:56px;image-rendering:pixelated;margin:0 auto';
    const px = pc.getContext('2d'); px.imageSmoothingEnabled = false; px.drawImage(SPR.players[s.cls][0].n, 0, 0, 48, 56);
    d.innerHTML = `<div class="ttl"><span>P${i + 1}</span><label style="margin:0;color:var(--text)"><input type="checkbox" ${s.on ? 'checked' : ''}> 參加</label></div>`;
    d.appendChild(pc);
    const nm = document.createElement('input'); nm.value = s.name; nm.maxLength = 10; nm.oninput = () => { s.name = nm.value; };
    const dev = document.createElement('select'); dev.innerHTML = Object.entries(DEVICES).map(([k, v]) => `<option value="${k}" ${k === s.dev ? 'selected' : ''}>${v}</option>`).join('');
    dev.onchange = () => { s.dev = dev.value; };
    const cl = document.createElement('select'); cl.innerHTML = CLS.map(c => `<option value="${c}" ${c === s.cls ? 'selected' : ''}>${CLASSES[c].name}</option>`).join('');
    cl.onchange = () => { s.cls = cl.value; renderLocal(); };
    d.querySelector('input[type=checkbox]').onchange = e => { s.on = e.target.checked; renderLocal(); };
    d.append(nm, dev, cl);
    box.appendChild(d);
  });
  const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  $('padInfo').textContent = pads.length ? `（已偵測到 ${pads.length} 支手把）` : '（目前未偵測到手把）';
}
addEventListener('gamepadconnected', () => { if (!$('local').classList.contains('hidden')) renderLocal(); });
$('btnLocal').onclick = () => { renderLocal(); show('local'); };
$('btnLocalBack').onclick = () => show('menu');
$('btnLocalStart').onclick = startLocal;
function startLocal() {
  const slots = localCfg.filter(s => s.on).map((s, i) => ({ ...s, id: i + 1 }));
  if (!slots.length) return;
  const g = new Game({ leash: { x: Math.max(150, VW / 2 - 40), y: Math.max(90, VH / 2 - 30) } });
  for (const s of slots) g.addPlayer(s.id, s.name || '玩家' + s.id, s.cls);
  g.start();
  local = { game: g, slots }; mode = 'local'; myId = null; overInfo = null;
  snap = prev = null; prevMaps = null; map = null;
  fx.banners = []; fx.parts = []; fx.nums = [];
  loadMap(g.mapData());
  hideUI();
}

function leaveGame() {
  if (mode === 'local') {
    if (snap && snap.st !== 'over' && !confirm('確定要結束這場冒險嗎？')) return;
    local = null; mode = 'menu'; renderLocal(); show('local');
  } else if (mode === 'online') {
    if (!confirm('確定要離開房間嗎？')) return;
    mode = 'menu'; if (ws) ws.close(); show('menu');
  }
}

// ---------- 輸入 ----------
const keys = new Set();
const mouse = { x: 0, y: 0, l: false, r: false, moved: 0 };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (inGame && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' && inGame) leaveGame();
  if (e.code === 'Enter' && inGame && mode === 'local' && snap && snap.st === 'over') startLocal();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; mouse.moved = performance.now(); });
cv.addEventListener('mousedown', e => { if (e.button === 0) mouse.l = true; if (e.button === 2) mouse.r = true; mouse.moved = performance.now(); });
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());

const k = (...c) => (c.some(x => keys.has(x)) ? 1 : 0);
function readDevice(dev, p) {
  if (dev === 'kbm') {
    let aim = 0;
    if (p) { const s = w2s(p.x, p.y - 3); aim = Math.atan2(mouse.y - s.y, mouse.x - s.x); }
    return { mx: k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'), my: k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp'), aim,
      fire: mouse.l, skill: mouse.r || !!k('KeyQ', 'KeyE', 'ShiftLeft'), dodge: !!k('Space') };
  }
  if (dev === 'kb2') return { mx: k('KeyL') - k('KeyJ'), my: k('KeyK') - k('KeyI'), aim: null, fire: !!k('KeyU'), skill: !!k('KeyO'), dodge: !!k('KeyH') };
  const gp = navigator.getGamepads ? navigator.getGamepads()[+dev[3]] : null;
  if (!gp) return { mx: 0, my: 0, aim: null, fire: false, skill: false, dodge: false };
  const dz = v => (Math.abs(v) < 0.22 ? 0 : v), bt = i => (gp.buttons[i] && gp.buttons[i].pressed ? 1 : 0);
  const ax = gp.axes[2] || 0, ay = gp.axes[3] || 0, am = Math.hypot(ax, ay);
  return { mx: dz(gp.axes[0] || 0) || bt(15) - bt(14), my: dz(gp.axes[1] || 0) || bt(13) - bt(12), aim: am > 0.35 ? Math.atan2(ay, ax) : null,
    fire: am > 0.6 || !!bt(7) || !!bt(5), skill: !!(bt(6) || bt(4) || bt(2)), dodge: !!bt(0) };
}
function onlineInput() {
  const me = snap && snap.ps.find(p => p.i === myId);
  const a = readDevice('kbm', me ? ip('p', me) : null);
  const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
  if (gp) {
    const g = readDevice('pad0');
    if (g.mx || g.my) { a.mx = g.mx; a.my = g.my; }
    if (g.aim != null) a.aim = g.aim; else if (performance.now() - mouse.moved > 3000) a.aim = null;
    a.fire = a.fire || g.fire; a.skill = a.skill || g.skill; a.dodge = a.dodge || g.dodge;
  }
  return a;
}
setInterval(() => {
  if (mode !== 'online' || !inGame) return;
  const i = onlineInput();
  wsSend({ t: 'in', mx: i.mx, my: i.my, a: i.aim == null ? null : Math.round(i.aim * 100) / 100, b: (i.fire ? 1 : 0) | (i.skill ? 2 : 0) | (i.dodge ? 4 : 0) });
}, 33);

// ---------- 插值 ----------
function ip(kind, o) {
  if (mode !== 'online' || !prevMaps) return o;
  const q = prevMaps[kind].get(o.i);
  if (!q) return o;
  const al = clamp((performance.now() - snapT) / 33.3, 0, 1);
  if (Math.abs(q.x - o.x) > 60 || Math.abs(q.y - o.y) > 60) return o;
  return { x: q.x + (o.x - q.x) * al, y: q.y + (o.y - q.y) * al };
}
const w2s = (x, y) => ({ x: (x - camO.x) * SCALE, y: (y - camO.y) * SCALE });

// ---------- 地圖 ----------
const THEMES = [
  { floor: ['#3a3d55', '#363950', '#3e4159'], line: '#2e3046', speck: '#4a4e6a', top: '#1d1c30', edge: '#34324f', face: '#4d5070', brick: '#2b2c42', voidc: '#08070f', light: 'rgba(6,5,14,0.55)', deco: '#6b7099' },
  { floor: ['#2c4436', '#29402f', '#30493a'], line: '#22362a', speck: '#3d5c47', top: '#14241a', edge: '#264232', face: '#3f6150', brick: '#22382c', voidc: '#050b07', light: 'rgba(3,10,6,0.58)', deco: '#6fb04f' },
  { floor: ['#46302b', '#412b26', '#4b342e'], line: '#36231f', speck: '#5c3e35', top: '#24120f', edge: '#46231b', face: '#6a3a2c', brick: '#3a1d16', voidc: '#0e0504', light: 'rgba(14,4,2,0.5)', deco: '#ff6a2a' },
];
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
function loadMap(m) {
  const tiles = Uint8Array.from(m.tiles, ch => ch.charCodeAt(0) - 48);
  map = { v: m.v, f: m.f, w: m.w, h: m.h, tiles, rooms: m.rooms, edges: m.edges, doors: m.doors, theme: THEMES[(m.f - 1) % THEMES.length] };
  map.canvas = drawMapCanvas(map);
  cam.init = false; floorT = 0;
}
function drawMapCanvas(m) {
  const c = document.createElement('canvas'); c.width = m.w * T; c.height = m.h * T;
  const x = c.getContext('2d'), th = m.theme;
  x.fillStyle = th.voidc; x.fillRect(0, 0, c.width, c.height);
  const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? 0 : m.tiles[ty * m.w + tx]);
  const isF = t => t === 1 || t === 3;
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
    const t = at(tx, ty), px = tx * T, py = ty * T, h = hash(tx, ty);
    if (isF(t)) {
      x.fillStyle = th.floor[h % 3]; x.fillRect(px, py, T, T);
      x.fillStyle = th.line; x.fillRect(px, py, T, 1); x.fillRect(px, py, 1, T);
      if ((h >> 5) % 2) x.fillRect(px + 8, py + 8, 8, 1);
      x.fillStyle = th.speck;
      for (let k2 = 0; k2 < 3; k2++) if (((h >> (k2 * 4)) & 3) === 0) x.fillRect(px + ((h >> (k2 * 3 + 8)) & 15), py + ((h >> (k2 * 5 + 3)) & 15), 1, 1);
      if (h % 41 === 0) { x.fillStyle = th.deco; x.fillRect(px + 4, py + 6, 1, 1); x.fillRect(px + 5, py + 7, 2, 1); x.fillRect(px + 7, py + 8, 1, 2); }
      if (h % 67 === 0) { x.fillStyle = '#d8d2c0'; x.fillRect(px + 5, py + 9, 5, 1); x.fillRect(px + 4, py + 8, 1, 3); x.fillRect(px + 10, py + 8, 1, 3); }
      if (at(tx, ty - 1) === 2) { x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(px, py, T, 4); }
    } else if (t === 2) {
      if (isF(at(tx, ty + 1))) {
        x.fillStyle = th.face; x.fillRect(px, py, T, T);
        x.fillStyle = th.edge; x.fillRect(px, py, T, 3);
        x.fillStyle = th.brick;
        x.fillRect(px, py + 3, T, 1); x.fillRect(px, py + 8, T, 1); x.fillRect(px, py + 13, T, 1);
        const o = (tx % 2) * 4;
        x.fillRect(px + o + 2, py + 4, 1, 4); x.fillRect(px + o + 10, py + 4, 1, 4); x.fillRect(px + 6 - o / 2, py + 9, 1, 4); x.fillRect(px + 14 - o / 2, py + 9, 1, 4);
        if (h % 19 === 0) { x.fillStyle = th.deco; x.fillRect(px + 7, py + 5, 2, 3); x.fillStyle = '#ffd07a'; x.fillRect(px + 7, py + 4, 2, 1); }
      } else {
        x.fillStyle = th.top; x.fillRect(px, py, T, T);
        x.fillStyle = th.edge;
        if (isF(at(tx - 1, ty))) x.fillRect(px, py, 2, T);
        if (isF(at(tx + 1, ty))) x.fillRect(px + T - 2, py, 2, T);
        if (isF(at(tx, ty - 1))) x.fillRect(px, py, T, 2);
      }
    }
  }
  return c;
}

// ---------- 事件 / 特效 ----------
const DIE_COL = { slime: '#5ccf5c', bat: '#9a6fc0', skel: '#e9e6dc', orc: '#6aa84f', shroom: '#d8443c', golem: '#8b8d99', dragon: '#ff6a2a', lich: '#a46bff' };
const PUFF_COL = { arrow: '#e8d9b0', fire: '#ff9a3a', holy: '#fff6b0', bone: '#e9e6dc', spore: '#b56cff', rock: '#8d8f99', efire: '#ff6a2a', dark: '#a46bff', fireball: '#ff7a2a' };
function burst(x, y, n, c, sp = 60, life = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, v = Math.random() * sp;
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life * (0.5 + Math.random() * 0.5), c, s: Math.random() < 0.3 ? 2 : 1 });
  }
}
function handleEvents(evs) {
  if (!evs) return;
  for (const e of evs) switch (e.k) {
    case 'hit': fx.nums.push({ x: e.x, y: e.y, v: e.v, c: e.c ? '#ffd34d' : '#ffffff', big: e.c, t: 0.7 }); burst(e.x, e.y + 4, 4, '#ffffff', 40, 0.25); sfx('hit'); break;
    case 'phit': fx.nums.push({ x: e.x, y: e.y - 10, v: e.v, c: '#ff5a6a', t: 0.8 }); burst(e.x, e.y, 6, '#ff3d5a', 50, 0.35); if (e.i === myId || mode === 'local') shake = Math.max(shake, 3); sfx('hurt'); break;
    case 'heal': fx.nums.push({ x: e.x, y: e.y - 12, v: '+' + e.v, c: '#7dff9a', t: 0.9 }); burst(e.x, e.y, 8, '#7dff9a', 30, 0.6); break;
    case 'die': burst(e.x, e.y, BOSS_T.has(e.t) ? 60 : 14, DIE_COL[e.t] || '#fff', BOSS_T.has(e.t) ? 140 : 70, 0.7); sfx('die'); break;
    case 'slash': fx.slashes.push({ x: e.x, y: e.y, a: e.a, i: e.i, t: 0.15 }); break;
    case 'spark': burst(e.x, e.y, 6, '#ffe14a', 60, 0.3); break;
    case 'nova': fx.rings.push({ x: e.x, y: e.y, max: 90, t: 0.4, d: 0.4, c: '143,220,255' }); burst(e.x, e.y, 30, '#bfeaff', 120, 0.6); break;
    case 'holy': fx.rings.push({ x: e.x, y: e.y, max: 110, t: 0.5, d: 0.5, c: '255,230,140' }); burst(e.x, e.y, 24, '#fff2a0', 90, 0.7); break;
    case 'boom': fx.rings.push({ x: e.x, y: e.y, max: e.r, t: 0.3, d: 0.3, c: '255,140,50' }); burst(e.x, e.y, e.s ? 8 : 18, '#ff8a3a', e.s ? 50 : 90, 0.45); sfx(e.s ? 'hit' : 'boom'); break;
    case 'beam': fx.beams.push({ ...e, t: 0.3 }); sfx('blink'); break;
    case 'shake': shake = Math.max(shake, e.v); break;
    case 'text': fx.banners.push({ m: e.m, c: e.c, t: 3.2 }); if (fx.banners.length > 4) fx.banners.shift(); break;
    case 'snd': sfx(e.s); break;
    case 'skill': sfx('skill'); break;
    case 'boss': fx.bossIntro = { n: e.n, t: 2.8 }; sfx('boss'); break;
    case 'floor': cam.init = false; floorT = 0; break;
    case 'over': overInfo = { f: e.f, g: e.g }; break;
    case 'dust': burst(e.x, e.y + 3, 6, '#9a93a8', 30, 0.35); break;
    case 'puff': burst(e.x, e.y, 3, PUFF_COL[e.c] || '#fff', 30, 0.25); break;
    case 'chest': burst(e.x, e.y, 24, '#ffd34d', 80, 0.8); break;
    case 'blink': burst(e.x, e.y, 20, '#a46bff', 80, 0.6); break;
  }
}
function updateFx(dt) {
  for (const p of fx.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.t -= dt; }
  fx.parts = fx.parts.filter(p => p.t > 0);
  if (fx.parts.length > 900) fx.parts.splice(0, fx.parts.length - 900);
  for (const n of fx.nums) { n.y -= 22 * dt; n.t -= dt; }
  fx.nums = fx.nums.filter(n => n.t > 0);
  for (const a of ['rings', 'slashes', 'beams', 'banners']) { for (const o of fx[a]) o.t -= dt; fx[a] = fx[a].filter(o => o.t > 0); }
  if (fx.bossIntro) { fx.bossIntro.t -= dt; if (fx.bossIntro.t <= 0) fx.bossIntro = null; }
  shake = Math.max(0, shake - dt * 18);
  floorT += dt;
}

// ---------- 主迴圈 ----------
let lastT = performance.now(), acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
window.__abyss = { get local() { return local; } }; // 除錯用
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  if (mode === 'local' && local && inGame) {
    const g = local.game;
    for (const s of local.slots) g.setInput(s.id, readDevice(s.dev, g.players.get(s.id)));
    acc += dt;
    while (acc >= 1 / 60) { g.step(1 / 60); acc -= 1 / 60; }
    if (!map || g.mapVersion !== map.v) loadMap(g.mapData());
    snap = g.snapshot();
    handleEvents(snap.ev);
  }
  updateFx(dt);
  if (inGame && snap && map) render(dt);
  else { ctx.fillStyle = '#0b0a14'; ctx.fillRect(0, 0, cv.width, cv.height); }
}
requestAnimationFrame(frame);

// ---------- 繪製 ----------
const pcirc = (x, y, r, c) => { b.fillStyle = c; x = Math.round(x); y = Math.round(y); b.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); b.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2); };
const shadow = (x, y, rx) => { b.fillStyle = 'rgba(0,0,0,0.35)'; b.beginPath(); b.ellipse(Math.round(x), Math.round(y), rx, rx * 0.4, 0, 0, 7); b.fill(); };

function render(dt) {
  const s = snap, th = map.theme, now = performance.now() / 1000;
  // 鏡頭
  let tx = 0, ty = 0;
  if (mode === 'online') {
    const me = s.ps.find(p => p.i === myId) || s.ps[0];
    if (me) {
      const q = ip('p', me); tx = q.x; ty = q.y;
      if (!me.dd && performance.now() - mouse.moved < 3000) { tx += clamp((mouse.x / SCALE - VW / 2) * 0.15, -30, 30); ty += clamp((mouse.y / SCALE - VH / 2) * 0.15, -20, 20); }
    }
  } else {
    let n = 0;
    for (const p of s.ps) if (!p.dd) { tx += p.x; ty += p.y; n++; }
    if (!n) for (const p of s.ps) { tx += p.x; ty += p.y; n++; }
    tx /= n || 1; ty /= n || 1;
  }
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
  cam.x += (tx - cam.x) * Math.min(1, dt * 8); cam.y += (ty - cam.y) * Math.min(1, dt * 8);
  const ox = Math.round(cam.x - VW / 2 + (Math.random() - 0.5) * shake), oy = Math.round(cam.y - VH / 2 + (Math.random() - 0.5) * shake);
  camO = { x: ox, y: oy };

  b.fillStyle = th.voidc; b.fillRect(0, 0, VW, VH);
  b.drawImage(map.canvas, -ox, -oy);

  // 門
  for (let i = 0; i < map.doors.length; i += 2) {
    const idx = map.doors[i], owner = map.doors[i + 1];
    if (!(s.rm[owner] & 2)) continue;
    const px = (idx % map.w) * T - ox, py = Math.floor(idx / map.w) * T - oy;
    if (px < -T || py < -T || px > VW || py > VH) continue;
    b.fillStyle = '#1e1830'; b.fillRect(px, py, T, T);
    b.fillStyle = '#9aa0bc'; for (let k2 = 0; k2 < 4; k2++) b.fillRect(px + 1 + k2 * 4, py, 2, T);
    b.fillStyle = '#5a5f78'; b.fillRect(px, py + 3, T, 2); b.fillRect(px, py + 11, T, 2);
  }

  // 傳送門
  if (s.po) {
    const x = s.po.x - ox, y = s.po.y - oy;
    b.fillStyle = 'rgba(110,70,255,0.35)'; b.beginPath(); b.ellipse(x, y, 18, 10, 0, 0, 7); b.fill();
    for (let i = 0; i < 16; i++) {
      const a = now * 3 + i * 0.39, r = 12 + (i % 3) * 3;
      b.fillStyle = i % 2 ? '#b07cff' : '#5ff2ff';
      b.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.55), 2, 2);
    }
    if (s.po.t > 0) { b.strokeStyle = '#ffffff'; b.lineWidth = 2; b.beginPath(); b.arc(x, y, 24, -1.57, -1.57 + 6.28 * s.po.t); b.stroke(); }
  }

  // 危險區域
  for (const h of s.hz) {
    const x = h.x - ox, y = h.y - oy, col = h.d ? '255,50,50' : '255,170,40', p = Math.min(1, h.p);
    b.fillStyle = `rgba(${col},0.16)`; b.strokeStyle = `rgba(${col},${0.5 + 0.4 * Math.sin(now * 20)})`; b.lineWidth = 1;
    if (h.k === 'circle') {
      b.beginPath(); b.arc(x, y, h.r, 0, 7); b.fill(); b.stroke();
      b.fillStyle = `rgba(${col},0.32)`; b.beginPath(); b.arc(x, y, h.r * p, 0, 7); b.fill();
    } else if (h.k === 'line') {
      b.save(); b.translate(x, y); b.rotate(h.a);
      b.fillRect(0, -h.w / 2, h.l, h.w); b.strokeRect(0, -h.w / 2, h.l, h.w);
      b.fillStyle = `rgba(${col},0.32)`; b.fillRect(0, -h.w / 2, h.l * p, h.w); b.restore();
    } else if (h.k === 'cone') {
      b.beginPath(); b.moveTo(x, y); b.arc(x, y, h.r, h.a - h.s, h.a + h.s); b.closePath(); b.fill(); b.stroke();
      b.fillStyle = `rgba(${col},0.32)`; b.beginPath(); b.moveTo(x, y); b.arc(x, y, h.r * p, h.a - h.s, h.a + h.s); b.closePath(); b.fill();
    }
  }
  for (const bm of fx.beams) {
    b.save(); b.translate(bm.x - ox, bm.y - oy); b.rotate(bm.a);
    b.fillStyle = `rgba(200,140,255,${bm.t / 0.3})`; b.fillRect(0, -bm.w / 2, bm.l, bm.w);
    b.fillStyle = `rgba(255,255,255,${bm.t / 0.3})`; b.fillRect(0, -bm.w / 6, bm.l, bm.w / 3); b.restore();
  }

  // 生怪預告
  for (const sp of s.sp) {
    const a = 0.4 + 0.4 * Math.sin(now * 14);
    b.strokeStyle = `rgba(190,110,255,${a})`; b.lineWidth = 1;
    b.beginPath(); b.arc(Math.round(sp.x - ox), Math.round(sp.y - oy), 4 + sp.p * 6, 0, 7); b.stroke();
    pcirc(sp.x - ox, sp.y - oy, 2, `rgba(220,160,255,${a})`);
  }

  // 道具
  for (const pk of s.pk) {
    const x = pk.x - ox, y = pk.y - oy;
    if (x < -20 || y < -20 || x > VW + 20 || y > VH + 20) continue;
    const bob = Math.round(Math.sin(now * 5 + pk.i) * 1.5);
    if (pk.k === 'chest') { const img = SPR.enemies[pk.b ? 'bigchest' : 'chest'].n; shadow(x, y + 4, 7); b.drawImage(img, Math.round(x - 6), Math.round(y - 5)); if (Math.sin(now * 6 + pk.i) > 0.7) b.fillStyle = '#fff', b.fillRect(Math.round(x + 3), Math.round(y - 6), 1, 1); }
    else if (pk.k === 'coin') b.drawImage(SPR.enemies.coin.n, Math.round(x - 3), Math.round(y - 3 + bob));
    else if (pk.k === 'hp') b.drawImage(SPR.enemies.potion.n, Math.round(x - 4), Math.round(y - 4 + bob));
    else b.drawImage(SPR.enemies.crystal.n, Math.round(x - 4), Math.round(y - 4 + bob));
  }

  // 角色與敵人（依 y 排序）
  const ents = [];
  for (const p of s.ps) { const q = ip('p', p); ents.push({ y: q.y, f: () => drawPlayer(p, q.x - ox, q.y - oy, now) }); }
  for (const e of s.es) { const q = ip('e', e); ents.push({ y: q.y, f: () => drawEnemy(e, q.x - ox, q.y - oy, now) }); }
  ents.sort((a, c) => a.y - c.y);
  for (const e of ents) e.f();

  // 子彈
  for (const pr of s.pr) {
    const q = ip('r', pr), x = q.x - ox, y = q.y - oy;
    if (x < -10 || y < -10 || x > VW + 10 || y > VH + 10) continue;
    drawProj(pr, x, y);
  }

  // 特效
  for (const sl of fx.slashes) {
    const k2 = sl.t / 0.15, p = s.ps.find(o => o.i === sl.i), q = p ? ip('p', p) : sl;
    b.strokeStyle = `rgba(255,255,255,${k2})`; b.lineWidth = 2;
    b.beginPath(); b.arc(q.x - ox, q.y - 3 - oy, 26, sl.a - 1.0, sl.a + 1.0); b.stroke();
    b.strokeStyle = `rgba(160,200,255,${k2 * 0.7})`; b.beginPath(); b.arc(q.x - ox, q.y - 3 - oy, 20, sl.a - 0.8, sl.a + 0.8); b.stroke();
  }
  for (const r of fx.rings) {
    const k2 = 1 - r.t / r.d;
    b.strokeStyle = `rgba(${r.c},${1 - k2})`; b.lineWidth = 2;
    b.beginPath(); b.arc(r.x - ox, r.y - oy, Math.max(1, r.max * k2), 0, 7); b.stroke();
  }
  for (const p of fx.parts) { b.fillStyle = p.c; b.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.s, p.s); }

  // 光影
  lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, VW, VH);
  lx.fillStyle = th.light; lx.fillRect(0, 0, VW, VH);
  lx.globalCompositeOperation = 'destination-out';
  const L = (x, y, r, a) => { const g = lx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = g; lx.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const p of s.ps) if (!p.dd) { const q = ip('p', p); L(q.x - ox, q.y - oy, 140, 1); }
  for (const pr of s.pr) if (pr.k === 'fire' || pr.k === 'fireball' || pr.k === 'holy') L(pr.x - ox, pr.y - oy, 26, 0.6);
  if (s.po) L(s.po.x - ox, s.po.y - oy, 80, 0.9);
  lx.globalCompositeOperation = 'source-over';
  b.drawImage(light, 0, 0);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, VW * SCALE, VH * SCALE);
  drawHUD(s, now);
}

function drawWeapon(p, now) {
  b.save(); b.translate(0, -3);
  let a = p.a;
  const sl = fx.slashes.find(o => o.i === p.i);
  if (sl && p.c === 'knight') a += (0.5 - sl.t / 0.15) * 2.4;
  b.rotate(a);
  switch (p.c) {
    case 'knight': b.fillStyle = '#8a6a3a'; b.fillRect(2, -1, 3, 2); b.fillStyle = '#ffd34d'; b.fillRect(5, -3, 1, 6); b.fillStyle = '#dfe6f2'; b.fillRect(6, -1, 10, 2); b.fillStyle = '#ffffff'; b.fillRect(6, -1, 10, 1); break;
    case 'ranger': b.strokeStyle = '#8b5a2b'; b.lineWidth = 2; b.beginPath(); b.arc(3, 0, 7, -1.2, 1.2); b.stroke(); b.fillStyle = '#e8e0c8'; b.fillRect(5, -6, 1, 12); break;
    case 'mage': b.fillStyle = '#7a5230'; b.fillRect(1, -1, 12, 2); b.fillStyle = '#ff8a2a'; b.fillRect(12, -2, 4, 4); b.fillStyle = '#ffe08a'; b.fillRect(13, -1, 2, 2); break;
    case 'cleric': b.fillStyle = '#c9962a'; b.fillRect(2, -1, 9, 2); b.fillStyle = '#fff4c2'; b.fillRect(10, -2, 4, 4); b.fillStyle = '#ffd34d'; b.fillRect(11, -3, 2, 6); break;
  }
  b.restore();
}

function drawPlayer(p, x, y, now) {
  if (x < -30 || y < -30 || x > VW + 30 || y > VH + 30) return;
  x = Math.round(x); y = Math.round(y);
  if (p.dd) { // 墓碑
    b.fillStyle = '#5a5870'; b.fillRect(x - 4, y - 8, 8, 10); b.fillRect(x - 3, y - 9, 6, 1);
    b.fillStyle = '#2a2838'; b.fillRect(x - 1, y - 6, 2, 6); b.fillRect(x - 3, y - 4, 6, 2);
    return;
  }
  shadow(x, y + 4, 6);
  const frames = SPR.players[p.c];
  const fr = p.mv && !p.dn ? Math.floor(now * 8) % 2 : 0;
  const set = frames[fr], face = Math.cos(p.a) < 0 ? -1 : 1;
  const img = p.fl ? set.w : p.dn ? set.g : set.n;
  b.save(); b.translate(x, y);
  if (p.dn) { b.rotate(Math.PI / 2 * face); b.drawImage(img, -7, -10); b.restore(); return; }
  if (p.dg) { b.globalAlpha = 0.55; b.scale(1, 0.85); }
  else if (p.iv && Math.floor(now * 20) % 2) b.globalAlpha = 0.6;
  const behind = Math.sin(p.a) < -0.3;
  if (behind) drawWeapon(p, now);
  b.scale(face, 1); b.drawImage(img, -6, -10); b.scale(face, 1);
  if (!behind) drawWeapon(p, now);
  b.restore();
  if (p.sp) {
    b.strokeStyle = 'rgba(190,215,255,0.75)'; b.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const a = now * 14 + i * 2.09; b.beginPath(); b.arc(x, y - 3, 30, a, a + 0.8); b.stroke(); }
  }
}

function drawEnemy(e, x, y, now) {
  const boss = BOSS_T.has(e.t);
  if (x < -50 || y < -60 || x > VW + 50 || y > VH + 50) return;
  const S = SPR.enemies[e.t];
  let img = e.fl && (!boss || Math.floor(now * 30) % 3 === 0) ? S.w : e.fz ? S.i : S.n;
  if (boss && !e.fl && !e.fz && e.st === 'wind' && Math.floor(now * 16) % 2) img = S.r;
  const sc = boss ? 2 : 1, w = img.width * sc, h = img.height * sc;
  let dx = 0, dy = 0;
  if (e.t === 'slime' && e.st === 'hop') dy = -3;
  if (e.t === 'bat') dy = -5 + Math.round(Math.sin(now * 12 + e.i) * 2);
  if (e.st === 'wind') dx = Math.round((Math.random() - 0.5) * 3);
  if (boss) dy -= e.z;
  shadow(x, y + (boss ? 10 : 4), boss ? Math.max(8, 16 - e.z * 0.15) : w * 0.35);
  b.drawImage(img, Math.round(x - w / 2 + dx), Math.round(y - h + (boss ? 12 : 5) + dy), w, h);
  if (boss && e.st === 'stun') {
    for (let i = 0; i < 3; i++) { const a = now * 6 + i * 2.09; b.fillStyle = '#ffe14a'; b.fillRect(Math.round(x + Math.cos(a) * 12), Math.round(y - h + 8 + Math.sin(a) * 4), 2, 2); }
  }
  if (!boss && e.hp < e.mh) {
    const bw = 14, bx = Math.round(x - bw / 2), by = Math.round(y - h + 2 + dy);
    b.fillStyle = '#1a1426'; b.fillRect(bx - 1, by - 1, bw + 2, 3);
    b.fillStyle = '#ff4a5a'; b.fillRect(bx, by, Math.ceil(bw * e.hp / e.mh), 1);
  }
}

function drawProj(pr, x, y) {
  switch (pr.k) {
    case 'arrow': case 'bone':
      b.save(); b.translate(Math.round(x), Math.round(y)); b.rotate(pr.a);
      b.fillStyle = pr.k === 'arrow' ? '#c9a06a' : '#e9e6dc'; b.fillRect(-4, -0.5, 7, 1);
      b.fillStyle = '#ffffff'; b.fillRect(2, -1, 2, 2); b.restore(); break;
    case 'fire': pcirc(x, y, 3, '#ff7b2a'); pcirc(x, y, 1, '#ffe08a'); break;
    case 'holy': pcirc(x, y, 3, '#fff6b0'); pcirc(x, y, 1, '#ffffff'); break;
    case 'spore': pcirc(x, y, 3, '#7a3fb0'); pcirc(x, y, 2, '#c58cff'); break;
    case 'rock': b.fillStyle = '#2a2838'; b.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); b.fillStyle = '#9a9cab'; b.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); break;
    case 'efire': pcirc(x, y, 3, '#ff4a1a'); pcirc(x, y, 1, '#ffd07a'); break;
    case 'dark': pcirc(x, y, 3, '#5a1fb0'); pcirc(x, y, 2, '#b07cff'); b.fillStyle = '#fff'; b.fillRect(Math.round(x), Math.round(y), 1, 1); break;
    case 'fireball': pcirc(x, y, 5, '#c8301a'); pcirc(x, y, 4, '#ff6a1a'); pcirc(x, y, 2, '#ffd27a'); break;
  }
}

// ---------- HUD ----------
function bar(x, y, w, h, frac, col, bg = 'rgba(0,0,0,0.6)') {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}
function txt(s, x, y, size, col = '#fff', align = 'left', weight = 700) {
  ctx.font = `${weight} ${Math.round(size)}px "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function drawHUD(s, now) {
  const W = cv.width, H = cv.height;
  // 名牌、倒地救援
  for (const p of s.ps) {
    const q = ip('p', p), sc = w2s(q.x, q.y);
    if (p.dd) continue;
    txt(p.n, sc.x, sc.y - 17 * SCALE, 11 * U, CLASSES[p.c].color, 'center');
    if (p.dn) {
      txt(`倒地 ${p.bl}s`, sc.x, sc.y - 22 * SCALE - 6 * U, 11 * U, '#ff6b6b', 'center');
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4 * U; ctx.beginPath(); ctx.arc(sc.x, sc.y, 14 * SCALE, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#7dff9a'; ctx.beginPath(); ctx.arc(sc.x, sc.y, 14 * SCALE, -1.57, -1.57 + 6.28 * p.rv); ctx.stroke();
    }
  }
  for (const n of fx.nums) { const sc = w2s(n.x, n.y); txt(String(n.v), sc.x, sc.y, (n.big ? 16 : 12) * U, n.c, 'center', 900); }

  // 玩家面板
  const order = mode === 'online' ? [...s.ps].sort((a, c) => (a.i === myId ? -1 : c.i === myId ? 1 : 0)) : s.ps;
  const pw = 236 * U, ph = 60 * U;
  order.forEach((p, i) => {
    const x = 12 * U, y = 12 * U + i * (ph + 6 * U), c = CLASSES[p.c];
    ctx.fillStyle = 'rgba(12,10,24,0.78)'; ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = p.i === myId ? '#ffd34d' : c.color; ctx.lineWidth = 2 * U; ctx.strokeRect(x, y, pw, ph);
    ctx.imageSmoothingEnabled = false;
    const set = SPR.players[p.c][0];
    ctx.drawImage(p.dd || p.dn ? set.g : set.n, x + 6 * U, y + 7 * U, 36 * U, 42 * U);
    const bx = x + 50 * U, bw = pw - 58 * U;
    txt(`${p.n}`, bx, y + 10 * U, 12 * U, '#fff');
    txt(`${c.name} · 擊殺 ${p.k}`, x + pw - 8 * U, y + 10 * U, 10 * U, c.color, 'right', 600);
    bar(bx, y + 18 * U, bw, 11 * U, p.hp / p.mh, '#e8384f');
    txt(`${p.hp}/${p.mh}`, bx + bw / 2, y + 23.5 * U, 9 * U, '#fff', 'center');
    bar(bx, y + 31 * U, bw, 6 * U, p.sh / p.ms, '#9fb4d8');
    bar(bx, y + 39 * U, bw, 6 * U, p.en / 100, '#3f8cff');
    const ready = p.sk <= 0;
    bar(bx, y + 48 * U, bw, 6 * U, 1 - p.sk, ready && p.en >= c.skillCost ? '#ffd34d' : '#7a6a3a');
    txt(c.skillName + (ready ? (p.en >= c.skillCost ? ' 就緒' : ' 能量不足') : ''), bx + 2 * U, y + 51 * U, 8 * U, '#fff', 'left', 600);
    if (p.dn) txt('倒地中！', x + pw / 2, y + ph / 2, 16 * U, '#ff6b6b', 'center', 900);
    if (p.dd) txt('陣亡（下一層復活）', x + pw / 2, y + ph / 2, 13 * U, '#aaa', 'center', 900);
  });

  // 樓層 / 金幣
  txt(`第 ${s.f} 層`, W / 2, 20 * U, 16 * U, '#ffd34d', 'center', 900);
  txt(`金幣 ${s.g}`, W / 2, 40 * U, 12 * U, '#ffe9a0', 'center');

  drawMinimap(s, W);

  // 頭目血條
  if (s.bo) {
    const bw = Math.min(W * 0.6, 640 * U), bx = (W - bw) / 2, by = H - 52 * U;
    txt(s.bo.n + (s.bo.rg ? '（狂暴）' : ''), W / 2, by - 12 * U, 14 * U, s.bo.rg ? '#ff6b6b' : '#fff', 'center', 900);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx - 3 * U, by - 3 * U, bw + 6 * U, 26 * U);
    bar(bx, by, bw, 12 * U, s.bo.hp / s.bo.mh, '#c8202f', '#3a1018');
    bar(bx, by + 15 * U, bw, 5 * U, s.bo.sg, s.bo.st ? '#ffffff' : '#ffd34d', '#3a3010');
    txt(s.bo.st ? '破綻！傷害 ×1.5' : '硬直值', bx + bw + 8 * U, by + 17 * U, 9 * U, '#ffd34d', 'left', 600);
  }

  // 訊息
  fx.banners.forEach((bn, i) => {
    ctx.globalAlpha = Math.min(1, bn.t * 2);
    txt(bn.m, W / 2, H * 0.2 + i * 24 * U, 15 * U, bn.c, 'center', 800);
    ctx.globalAlpha = 1;
  });
  if (fx.bossIntro) {
    const a = Math.min(1, fx.bossIntro.t);
    ctx.fillStyle = `rgba(0,0,0,${0.45 * a})`; ctx.fillRect(0, H * 0.4, W, 70 * U);
    ctx.globalAlpha = a; txt(fx.bossIntro.n, W / 2, H * 0.4 + 35 * U, 34 * U, '#ff5a5a', 'center', 900); ctx.globalAlpha = 1;
  }
  if (s.po && s.st === 'play') txt('全員站上傳送門前往下一層', W / 2, H - 22 * U, 13 * U, '#c9a7ff', 'center');
  if (s.f === 1 && floorT < 14 && !s.bo) {
    const help = mode === 'local' ? 'P1 WASD＋滑鼠 · P2 IJKL/U/O/H · 手把 左搖桿移動 右搖桿瞄準射擊 A翻滾 LB技能 · Esc 離開'
      : 'WASD 移動 · 滑鼠瞄準 · 左鍵攻擊 · 右鍵/Q 技能 · 空白鍵 翻滾 · Esc 離開';
    ctx.globalAlpha = Math.min(1, 14 - floorT); txt(help, W / 2, H - 22 * U, 12 * U, '#d8d2ff', 'center', 600); ctx.globalAlpha = 1;
  }

  if (s.st === 'over') {
    ctx.fillStyle = 'rgba(10,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    txt('全 滅', W / 2, H * 0.38, 54 * U, '#ff4a5a', 'center', 900);
    txt(`抵達第 ${s.f} 層 · 金幣 ${s.g}`, W / 2, H * 0.38 + 50 * U, 16 * U, '#fff', 'center');
    const rank = [...s.ps].sort((a, c) => c.dm - a.dm).map(p => `${p.n}：傷害 ${p.dm} / 擊殺 ${p.k}`).join('　');
    txt(rank, W / 2, H * 0.38 + 80 * U, 12 * U, '#ddd', 'center', 600);
    txt(mode === 'local' ? '按 Enter 重新挑戰 · Esc 返回' : '即將返回大廳…', W / 2, H * 0.38 + 115 * U, 14 * U, '#ffd34d', 'center');
  }
}

function drawMinimap(s, W) {
  const rooms = map.rooms;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rooms) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
  const box = 170 * U, sc = Math.min(box / (x1 - x0), (box * 0.8) / (y1 - y0));
  const mw = (x1 - x0) * sc, mh = (y1 - y0) * sc, mx = W - mw - 16 * U, my = 14 * U;
  ctx.fillStyle = 'rgba(12,10,24,0.7)'; ctx.fillRect(mx - 6 * U, my - 6 * U, mw + 12 * U, mh + 12 * U);
  const known = new Set();
  rooms.forEach((r, i) => { if (s.rm[i] & 1) known.add(i); });
  for (const [a, c] of map.edges) if ((s.rm[a] & 1) || (s.rm[c] & 1)) { known.add(a); known.add(c); }
  ctx.strokeStyle = '#4a4470'; ctx.lineWidth = 2 * U;
  for (const [a, c] of map.edges) {
    if (!(s.rm[a] & 1) && !(s.rm[c] & 1)) continue;
    const A = rooms[a], C = rooms[c];
    ctx.beginPath(); ctx.moveTo(mx + (A.x + A.w / 2 - x0) * sc, my + (A.y + A.h / 2 - y0) * sc); ctx.lineTo(mx + (C.x + C.w / 2 - x0) * sc, my + (C.y + C.h / 2 - y0) * sc); ctx.stroke();
  }
  rooms.forEach((r, i) => {
    if (!known.has(i)) return;
    const vis = s.rm[i] & 1, x = mx + (r.x - x0) * sc, y = my + (r.y - y0) * sc;
    const col = { start: '#7a7a9a', combat: s.rm[i] & 4 ? '#5a6aa0' : '#8a4a5a', boss: '#d8303a', treasure: '#d8a020' }[r.t];
    ctx.fillStyle = vis ? col : 'rgba(80,75,120,0.35)';
    ctx.fillRect(x, y, r.w * sc, r.h * sc);
    if (r.t === 'boss') txt('☠', x + r.w * sc / 2, y + r.h * sc / 2, 11 * U, '#fff', 'center');
  });
  for (const p of s.ps) {
    if (p.dd) continue;
    ctx.fillStyle = p.i === myId ? '#ffffff' : CLASSES[p.c].color;
    ctx.fillRect(mx + (p.x / T - x0) * sc - 2 * U, my + (p.y / T - y0) * sc - 2 * U, 4 * U, 4 * U);
  }
}
