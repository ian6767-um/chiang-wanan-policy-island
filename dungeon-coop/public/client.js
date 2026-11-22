import { Game, T } from './sim.js';
import { CLASSES, ENEMIES, BOSSES, BOON_MAP, SPECIAL, TAGS, RES, DOORS, SHOP, CHAPTERS, STAGES_PER_CHAPTER, crystalsFor } from './data.js';
import { playerSprite, enemySprite, objSprite } from './sprites.js';
import { loadSave, persist, metaFor, createCamp, spriteCanvas } from './camp.js';
import { initMusic, playSong, playJingle, stopMusic, toggleMute, isMuted, currentSong, musicLevel, musicTap } from './music.js';
import { drawKeyArt } from './keyart.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const CLS = Object.keys(CLASSES);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const save = loadSave();

// ---------- 畫布 ----------
const cv = $('game'), ctx = cv.getContext('2d');
const buf = document.createElement('canvas'), b = buf.getContext('2d');
const light = document.createElement('canvas'), lx = light.getContext('2d');
let DPR = 1, SCALE = 3, VW = 480, VH = 270, U = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  cv.width = Math.floor(innerWidth * DPR); cv.height = Math.floor(innerHeight * DPR);
  SCALE = Math.max(2, Math.floor(Math.min(cv.width / 560, cv.height / 320)));
  VW = Math.ceil(cv.width / SCALE); VH = Math.ceil(cv.height / SCALE);
  buf.width = VW; buf.height = VH; light.width = VW; light.height = VH;
  U = Math.max(0.85, Math.min(cv.width / 1280, cv.height / 720));
}
addEventListener('resize', resize); resize();

// ---------- 狀態 ----------
let mode = 'menu';          // menu | online | local
let inGame = false, uiBack = 'menu';
let map = null, snap = null, prev = null, snapT = 0, prevMaps = null;
let myId = null, local = null, overInfo = null, lobbyState = null, lastMetaCls = null;
const exMap = new Map();
const fx = { parts: [], nums: [], rings: [], slashes: [], banners: [], beams: [], zaps: [], lobs: [], bossIntro: null, stageIntro: null };
let shake = 0, stageT = 0;
const cam = { x: 0, y: 0, init: false };
let camO = { x: 0, y: 0 };
let choiceRects = [];
const cursors = new Map();

// ---------- 音效 ----------
let AC = null, master = null, noiseBuf = null;
const lastS = {};
function audioInit() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.3; master.connect(AC.destination); initMusic(AC, AC.destination); } catch { AC = null; }
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
    case 'hit': tone(200, 0.05, 'square', 0.035, 90); break;
    case 'die': tone(400, 0.15, 'square', 0.06, 60); break;
    case 'hurt': tone(160, 0.18, 'sawtooth', 0.12, 60); break;
    case 'dodge': noise(0.1, 0.08, 1500); break;
    case 'coin': tone(1300, 0.05, 'square', 0.035); tone(1800, 0.07, 'square', 0.035, null, 0.05); break;
    case 'pickup': tone(600, 0.1, 'sine', 0.1, 1200); break;
    case 'door': seq([392, 523, 784], 0.12, 'triangle', 0.07, 0.07); break;
    case 'clear': seq([523, 659, 784], 0.15, 'square', 0.06, 0.08); break;
    case 'chest': seq([523, 659, 784, 1047], 0.18, 'triangle', 0.1, 0.07); break;
    case 'pick': seq([659, 988], 0.12, 'triangle', 0.09, 0.06); break;
    case 'forge': tone(1600, 0.08, 'square', 0.08); noise(0.15, 0.2, 4000); tone(1200, 0.2, 'triangle', 0.08, null, 0.1); break;
    case 'boom': noise(0.35, 0.3, 500); tone(90, 0.3, 'sine', 0.2, 40); break;
    case 'roar': tone(140, 0.5, 'sawtooth', 0.12, 70); noise(0.4, 0.1, 700); break;
    case 'jump': tone(200, 0.4, 'sine', 0.1, 500); break;
    case 'stun': seq([880, 660, 880], 0.1, 'square', 0.07, 0.08); break;
    case 'fireball': tone(220, 0.2, 'sawtooth', 0.08, 90); break;
    case 'blink': tone(1500, 0.2, 'sine', 0.06, 300); break;
    case 'fuse': tone(1000, 0.4, 'square', 0.05, 2000); break;
    case 'zap': tone(1800, 0.06, 'sawtooth', 0.04, 600); break;
    case 'down': tone(300, 0.5, 'triangle', 0.15, 80); break;
    case 'revive': seq([392, 523, 659], 0.15, 'sine', 0.1, 0.08); break;
    case 'res': seq([523, 784, 1047, 1568], 0.15, 'triangle', 0.09, 0.06); break;
    case 'victory': seq([523, 659, 784, 1047, 784, 1047], 0.2, 'square', 0.07, 0.12); break;
    case 'skill': tone(400, 0.3, 'triangle', 0.12, 1200); break;
    case 'boss': tone(80, 1.0, 'sawtooth', 0.15, 50); break;
  }
}
addEventListener('pointerdown', audioInit);
addEventListener('keydown', audioInit);

// ---------- 介面 ----------
const PANELS = ['menu', 'lobby', 'local', 'camp'];
function show(id) {
  for (const p of PANELS) $(p).classList.toggle('hidden', p !== id);
  $('ui').classList.remove('hidden'); inGame = false;
  $('menuCrys').textContent = save.crystals;
}
function hideUI() { $('ui').classList.add('hidden'); inGame = true; }
function err(m, el = 'err') { $(el).textContent = m || ''; }
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無法儲存 */ } } };
$('name').value = store.get('ah_name') || '';
const myName = () => { const n = $('name').value.trim().slice(0, 10) || '獵人' + Math.floor(Math.random() * 900 + 100); store.set('ah_name', n); return n; };

const camp = createCamp(save, () => { $('menuCrys').textContent = save.crystals; sendMeta(true); });
function openCamp(back, cls) { uiBack = back; if (cls) camp.setClass(cls); camp.render(); show('camp'); }
$('btnCamp').onclick = () => openCamp('menu');
const musicBtn = $('btnMusic');
const musicLabel = () => { musicBtn.textContent = isMuted() ? '♪ 音樂：關' : '♪ 音樂：開'; };
musicBtn.onclick = () => { audioInit(); toggleMute(); musicLabel(); };
musicLabel();
$('btnCamp2').onclick = () => openCamp('lobby', lobbyState && (lobbyState.players.find(p => p.id === myId) || {}).cls);
$('btnCamp3').onclick = () => openCamp('local');
$('btnCampBack').onclick = () => { show(uiBack); if (uiBack === 'lobby') renderLobby(); if (uiBack === 'local') renderLocal(); };

function classCard(cls, selected, onClick, takenBy = []) {
  const c = CLASSES[cls], d = document.createElement('div');
  d.className = 'card' + (selected ? ' sel' : '');
  const pc = spriteCanvas(cls, save.sel[cls], 4); pc.style.width = '64px'; pc.style.height = '80px';
  d.appendChild(pc);
  const lv = Object.values(save.tree[cls]).reduce((a, b) => a + b, 0);
  d.insertAdjacentHTML('beforeend', `<div class="nm" style="color:${c.color}">${c.name}</div>
    <div class="ds">生命 ${c.hp} · 護盾 ${c.shield} · 天賦 ${lv} 級<br>${c.desc}</div>
    <div class="sk">技能【${c.skillName}】${c.skillDesc}</div>` + (takenBy.length ? `<div class="taken">${takenBy.map(esc).join('、')}</div>` : ''));
  d.onclick = onClick;
  return d;
}

// ---------- 線上 ----------
let ws = null;
function wsSend(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function sendMeta(force) {
  if (mode !== 'online' || !lobbyState) return;
  const me = lobbyState.players.find(p => p.id === myId);
  if (!me || (!force && me.cls === lastMetaCls)) return;
  lastMetaCls = me.cls;
  wsSend({ t: 'meta', meta: metaFor(save, me.cls) });
}
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
    case 'joined': myId = m.id; mode = 'online'; snap = prev = map = null; lastMetaCls = null; exMap.clear(); break;
    case 'lobby':
      lobbyState = m;
      sendMeta(false);
      if (!m.playing) {
        if (inGame || $('lobby').classList.contains('hidden') && $('camp').classList.contains('hidden')) { show('lobby'); overInfo = null; snap = null; }
        renderLobby();
      }
      break;
    case 'map': loadMap(m); break;
    case 's':
      prev = snap; snap = m; snapT = performance.now();
      prevMaps = prev ? { p: new Map(prev.ps.map(o => [o.i, o])), e: new Map(prev.es.map(o => [o.i, o])), r: new Map(prev.pr.map(o => [o.i, o])) } : null;
      if (m.ex) for (const x of m.ex) exMap.set(x.i, x);
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
    d.innerHTML = `<div class="ttl"><span>P${i + 1}</span><label style="margin:0;color:var(--text)"><input type="checkbox" ${s.on ? 'checked' : ''}> 參加</label></div>`;
    const pc = spriteCanvas(s.cls, save.sel[s.cls], 3); pc.style.margin = '0 auto';
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
  for (const s of slots) g.addPlayer(s.id, s.name || '玩家' + s.id, s.cls, metaFor(save, s.cls));
  g.start();
  local = { game: g, slots }; mode = 'local'; myId = null; overInfo = null;
  snap = prev = null; prevMaps = null; map = null; exMap.clear();
  fx.banners = []; fx.parts = []; fx.nums = [];
  loadMap(g.mapData());
  hideUI();
}
function leaveGame() {
  if (mode === 'local') {
    if (snap && snap.st !== 'over' && !confirm('確定要放棄這次冒險嗎？（不會獲得魂晶）')) return;
    local = null; mode = 'menu'; renderLocal(); show('local');
  } else if (mode === 'online') {
    if (!confirm('確定要離開房間嗎？')) return;
    mode = 'menu'; if (ws) ws.close(); show('menu');
  }
}

// ---------- 輸入 ----------
const keys = new Set();
const mouse = { x: 0, y: 0, l: false, r: false, moved: 0 };
let showBoons = false;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (inGame && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Tab') showBoons = true;
  if (e.code === 'KeyM') { toggleMute(); musicLabel(); }
  if (e.code === 'Escape' && inGame) leaveGame();
  if (e.code === 'Enter' && inGame && mode === 'local' && snap && snap.st === 'over') startLocal();
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'Tab') showBoons = false; });
addEventListener('blur', () => { keys.clear(); mouse.l = mouse.r = false; showBoons = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; mouse.moved = performance.now(); });
cv.addEventListener('mousedown', e => {
  mouse.moved = performance.now();
  const mx = e.clientX * DPR, my = e.clientY * DPR;
  const hit = choiceRects.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
  if (hit && e.button === 0) { doPick(hit.pid, hit.idx); return; }
  if (e.button === 0) mouse.l = true; if (e.button === 2) mouse.r = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());

const k = (...c) => (c.some(x => keys.has(x)) ? 1 : 0);
const pad = i => (navigator.getGamepads ? navigator.getGamepads()[i] : null);
function readDevice(dev, p) {
  if (dev === 'kbm') {
    let aim = 0;
    if (p) { const s = w2s(p.x, p.y - 4); aim = Math.atan2(mouse.y - s.y, mouse.x - s.x); }
    return { mx: k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft'), my: k('KeyS', 'ArrowDown') - k('KeyW', 'ArrowUp'), aim,
      fire: mouse.l, skill: mouse.r || !!k('KeyQ', 'KeyE', 'ShiftLeft'), dodge: !!k('Space') };
  }
  if (dev === 'kb2') return { mx: k('KeyL') - k('KeyJ'), my: k('KeyK') - k('KeyI'), aim: null, fire: !!k('KeyU'), skill: !!k('KeyO'), dodge: !!k('KeyH') };
  const gp = pad(+dev[3]);
  if (!gp) return { mx: 0, my: 0, aim: null, fire: false, skill: false, dodge: false };
  const dz = v => (Math.abs(v) < 0.22 ? 0 : v), bt = i => (gp.buttons[i] && gp.buttons[i].pressed ? 1 : 0);
  const ax = gp.axes[2] || 0, ay = gp.axes[3] || 0, am = Math.hypot(ax, ay);
  return { mx: dz(gp.axes[0] || 0) || bt(15) - bt(14), my: dz(gp.axes[1] || 0) || bt(13) - bt(12), aim: am > 0.35 ? Math.atan2(ay, ax) : null,
    fire: am > 0.6 || !!bt(7) || !!bt(5), skill: !!(bt(6) || bt(4) || bt(2)), dodge: !!bt(0) };
}
// 選單導覽（邊緣觸發）
const navPrev = new Map();
function navRead(dev) {
  let cur;
  if (dev === 'kbm') cur = { l: k('KeyA', 'ArrowLeft'), r: k('KeyD', 'ArrowRight'), ok: k('Space', 'Enter'), rr: k('KeyR'), n1: k('Digit1'), n2: k('Digit2'), n3: k('Digit3') };
  else if (dev === 'kb2') cur = { l: k('KeyJ'), r: k('KeyL'), ok: k('KeyU'), rr: k('KeyO') };
  else {
    const gp = pad(+dev[3]);
    const bt = i => (gp && gp.buttons[i] && gp.buttons[i].pressed ? 1 : 0), ax = gp ? gp.axes[0] || 0 : 0;
    cur = { l: bt(14) || (ax < -0.5 ? 1 : 0), r: bt(15) || (ax > 0.5 ? 1 : 0), ok: bt(0), rr: bt(3) };
  }
  const p = navPrev.get(dev) || {};
  navPrev.set(dev, cur);
  const e = {};
  for (const key in cur) e[key] = cur[key] && !p[key];
  return e;
}
function doPick(pid, idx) {
  if (mode === 'online') wsSend({ t: 'pick', i: idx });
  else if (local) local.game.pick(pid, idx);
  cursors.set(pid, 1);
}
function doReroll(pid) { if (mode === 'online') wsSend({ t: 'reroll' }); else if (local) local.game.reroll(pid); }
function handleNav(pid, devs) {
  const ex = exMap.get(pid);
  if (!ex || !ex.c) return;
  let cur = cursors.has(pid) ? cursors.get(pid) : 1;
  for (const dev of devs) {
    const n = navRead(dev);
    if (n.l) cur = (cur + 2) % 3;
    if (n.r) cur = (cur + 1) % 3;
    if (n.n1) return doPick(pid, 0);
    if (n.n2) return doPick(pid, 1);
    if (n.n3) return doPick(pid, 2);
    if (n.ok) return doPick(pid, cur);
    if (n.rr) { doReroll(pid); return; }
  }
  cursors.set(pid, cur);
}
function onlineInput() {
  const me = snap && snap.ps.find(p => p.i === myId);
  const a = readDevice('kbm', me ? ip('p', me) : null);
  if (pad(0)) {
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
  { floor: ['#3a3d55', '#363950', '#3e4159'], line: '#2e3046', speck: '#4a4e6a', top: '#1d1c30', edge: '#34324f', face: '#4d5070', brick: '#2b2c42', voidc: '#08070f', light: 'rgba(6,5,14,0.5)', deco: '#6b7099' },
  { floor: ['#2c4436', '#29402f', '#30493a'], line: '#22362a', speck: '#3d5c47', top: '#14241a', edge: '#264232', face: '#3f6150', brick: '#22382c', voidc: '#050b07', light: 'rgba(3,10,6,0.55)', deco: '#6fb04f' },
  { floor: ['#46302b', '#412b26', '#4b342e'], line: '#36231f', speck: '#5c3e35', top: '#24120f', edge: '#46231b', face: '#6a3a2c', brick: '#3a1d16', voidc: '#0e0504', light: 'rgba(14,4,2,0.45)', deco: '#ff6a2a' },
  { floor: ['#3a4a5e', '#36465a', '#3e5064'], line: '#2c3a4c', speck: '#5a7090', top: '#18222e', edge: '#2c3e52', face: '#5a7a98', brick: '#2e4258', voidc: '#05080c', light: 'rgba(4,8,16,0.45)', deco: '#9ad8ff' },
  { floor: ['#2a2038', '#261c33', '#2e233d'], line: '#1c1428', speck: '#4a3a66', top: '#120c1c', edge: '#2a1f3e', face: '#3e2c5a', brick: '#1f1530', voidc: '#06030a', light: 'rgba(8,2,14,0.55)', deco: '#ff4af0' },
];
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
function loadMap(m) {
  const tiles = Uint8Array.from(m.tiles, ch => ch.charCodeAt(0) - 48);
  map = { v: m.v, ch: m.ch, w: m.w, h: m.h, tiles, room: m.room, theme: THEMES[(m.ch - 1) % THEMES.length] };
  map.canvas = drawMapCanvas(map);
  cam.init = false; stageT = 0;
}
function drawMapCanvas(m) {
  const c = document.createElement('canvas'); c.width = m.w * T; c.height = m.h * T;
  const x = c.getContext('2d'), th = m.theme;
  x.fillStyle = th.voidc; x.fillRect(0, 0, c.width, c.height);
  const at = (tx, ty) => (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? 0 : m.tiles[ty * m.w + tx]);
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
    const t = at(tx, ty), px = tx * T, py = ty * T, h = hash(tx + m.v * 7, ty);
    if (t === 1) {
      x.fillStyle = th.floor[h % 3]; x.fillRect(px, py, T, T);
      x.fillStyle = th.line; x.fillRect(px, py, T, 1); x.fillRect(px, py, 1, T);
      if ((h >> 5) % 2) x.fillRect(px + 8, py + 8, 8, 1);
      x.fillStyle = th.speck;
      for (let k2 = 0; k2 < 3; k2++) if (((h >> (k2 * 4)) & 3) === 0) x.fillRect(px + ((h >> (k2 * 3 + 8)) & 15), py + ((h >> (k2 * 5 + 3)) & 15), 1, 1);
      if (h % 41 === 0) { x.fillStyle = th.deco; x.fillRect(px + 4, py + 6, 1, 1); x.fillRect(px + 5, py + 7, 2, 1); x.fillRect(px + 7, py + 8, 1, 2); }
      if (h % 67 === 0) { x.fillStyle = '#d8d2c0'; x.fillRect(px + 5, py + 9, 5, 1); x.fillRect(px + 4, py + 8, 1, 3); x.fillRect(px + 10, py + 8, 1, 3); }
      if (at(tx, ty - 1) === 2) { x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(px, py, T, 4); }
    } else if (t === 2) {
      if (at(tx, ty + 1) === 1) {
        x.fillStyle = th.face; x.fillRect(px, py, T, T);
        x.fillStyle = th.edge; x.fillRect(px, py, T, 3);
        x.fillStyle = th.brick;
        x.fillRect(px, py + 3, T, 1); x.fillRect(px, py + 8, T, 1); x.fillRect(px, py + 13, T, 1);
        const o = (tx % 2) * 4;
        x.fillRect(px + o + 2, py + 4, 1, 4); x.fillRect(px + o + 10, py + 4, 1, 4); x.fillRect(px + 6 - o / 2, py + 9, 1, 4); x.fillRect(px + 14 - o / 2, py + 9, 1, 4);
        if (h % 13 === 0) { x.fillStyle = '#5a3a1a'; x.fillRect(px + 7, py + 6, 2, 4); x.fillStyle = '#ffd07a'; x.fillRect(px + 7, py + 4, 2, 2); x.fillStyle = '#ff8a2a'; x.fillRect(px + 7, py + 5, 2, 1); }
      } else {
        x.fillStyle = th.top; x.fillRect(px, py, T, T);
        x.fillStyle = th.edge;
        if (at(tx - 1, ty) === 1) x.fillRect(px, py, 2, T);
        if (at(tx + 1, ty) === 1) x.fillRect(px + T - 2, py, 2, T);
        if (at(tx, ty - 1) === 1) x.fillRect(px, py, T, 2);
      }
    }
  }
  return c;
}

// ---------- 事件 / 特效 ----------
const DIE_COL = { slime: '#5ccf5c', bat: '#9a6fc0', skel: '#e9e6dc', brute: '#6aa84f', shroom: '#d8443c', ghost: '#c8f0e0', spider: '#6a5040', eye: '#ff4af0',
  imp: '#d8302a', wisp: '#ffb03a', worm: '#ff7a3a', armor: '#8a94a8', crystal: '#8fd8ff', plant: '#e04a8a', beetle: '#3a7a5a', robe: '#6a3ab0', bomb: '#ff8a2a', mimic: '#ffd34d',
  golem: '#8b8d99', queen: '#9be04a', dragon: '#ff6a2a', lich: '#5ff2ff', voidlord: '#ff4af0', general: '#e9e6dc', gargoyle: '#8a8a9a', shroomKing: '#d08aff', demon: '#ff5a2a',
  core: '#ffb04a', icequeen: '#bfeaff', witch: '#b07cff', heart: '#e04a8a', banner: '#c8202f', egg: '#d8e8c0', root: '#4a8a3a', phyl: '#5ff2ff', shadow: '#5a3a8a' };
const PUFF_COL = { arrow: '#e8d9b0', fire: '#ff9a3a', holy: '#fff6b0', bone: '#e9e6dc', spore: '#b56cff', rock: '#8d8f99', efire: '#ff6a2a', dark: '#a46bff', fireball: '#ff7a2a',
  ice: '#bfeaff', seed: '#8ae04a', web: '#ffffff', sword: '#c8dcff', shard: '#bfeaff', wind: '#6dffc4', knife: '#c08cff', hbolt: '#fff6b0' };
const BOOM_COL = { fire: ['255,140,50', '#ff8a3a'], poison: ['140,230,70', '#9be04a'], ice: ['143,220,255', '#bfeaff'], zap: ['255,230,80', '#ffe14a'], steel: ['200,210,230', '#e0e8ff'], enemy: ['255,80,60', '#ff6a4a'] };
const enemyCol = t => DIE_COL[(ENEMIES[t] || BOSSES[t] || {}).spr] || '#fff';
function burst(x, y, n, c, sp = 60, life = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, v = Math.random() * sp;
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: life * (0.5 + Math.random() * 0.5), c, s: Math.random() < 0.3 ? 2 : 1 });
  }
}
function handleEvents(evs) {
  if (!evs) return;
  for (const e of evs) switch (e.k) {
    case 'hit': {
      const col = e.c === 1 ? '#ffd34d' : e.c === 2 ? '#ff9a4a' : e.c === 3 ? '#9be04a' : e.c === 4 ? '#ffe96a' : '#ffffff';
      fx.nums.push({ x: e.x + (Math.random() - 0.5) * 6, y: e.y, v: e.v, c: col, big: e.c === 1, t: 0.7 });
      if (!e.c || e.c === 1) { burst(e.x, e.y + 4, 3, '#ffffff', 40, 0.25); sfx('hit'); }
      break;
    }
    case 'phit': fx.nums.push({ x: e.x, y: e.y - 10, v: e.v, c: '#ff5a6a', t: 0.8 }); burst(e.x, e.y, 6, '#ff3d5a', 50, 0.35); if (e.i === myId || mode === 'local') shake = Math.max(shake, 3); sfx('hurt'); break;
    case 'heal': fx.nums.push({ x: e.x, y: e.y - 12, v: '+' + e.v, c: '#7dff9a', t: 0.9 }); burst(e.x, e.y, 8, '#7dff9a', 30, 0.6); break;
    case 'die': burst(e.x, e.y, BOSSES[e.t] ? 60 : 14, enemyCol(e.t), BOSSES[e.t] ? 140 : 70, 0.7); sfx('die'); break;
    case 'slash': fx.slashes.push({ x: e.x, y: e.y, a: e.a, i: e.i, r: e.r || 32, t: 0.15 }); break;
    case 'spark': burst(e.x, e.y, 6, '#ffe14a', 60, 0.3); break;
    case 'nova': fx.rings.push({ x: e.x, y: e.y, max: e.r || 90, t: 0.4, d: 0.4, c: '143,220,255' }); burst(e.x, e.y, 30, '#bfeaff', 120, 0.6); break;
    case 'holy': fx.rings.push({ x: e.x, y: e.y, max: 110, t: 0.5, d: 0.5, c: '255,230,140' }); burst(e.x, e.y, 24, '#fff2a0', 90, 0.7); break;
    case 'boom': { const [rc, pc] = BOOM_COL[e.c] || BOOM_COL.fire; fx.rings.push({ x: e.x, y: e.y, max: e.r, t: 0.3, d: 0.3, c: rc }); burst(e.x, e.y, e.s ? 8 : 18, pc, e.s ? 50 : 90, 0.45); sfx(e.s ? 'hit' : 'boom'); break; }
    case 'beam': fx.beams.push({ ...e, t: 0.3 }); sfx('blink'); break;
    case 'zap': fx.zaps.push({ pts: e.pts, t: 0.18 }); sfx('zap'); break;
    case 'lob': fx.lobs.push({ ...e, d: e.t, t: e.t }); break;
    case 'shake': shake = Math.max(shake, e.v); break;
    case 'text': fx.banners.push({ m: e.m, c: e.c, t: 3.4 }); if (fx.banners.length > 4) fx.banners.shift(); break;
    case 'snd': sfx(e.s); break;
    case 'skill': sfx('skill'); break;
    case 'boss': fx.bossIntro = { n: e.n, t: 2.8 }; sfx('boss'); break;
    case 'immune': fx.nums.push({ x: e.x + (Math.random() - 0.5) * 10, y: e.y, v: '無效', c: '#9a9ab0', t: 0.5 }); break;
    case 'stage': cam.init = false; stageT = 0; cursors.clear(); break;
    case 'over': onOver(e); break;
    case 'dust': burst(e.x, e.y + 3, 6, '#9a93a8', 30, 0.35); break;
    case 'puff': burst(e.x, e.y, 3, PUFF_COL[e.c] || '#fff', 30, 0.25); break;
    case 'chest': burst(e.x, e.y, 24, '#ffd34d', 80, 0.8); break;
    case 'forge': burst(e.x, e.y - 6, 30, '#ffd07a', 90, 0.6); fx.rings.push({ x: e.x, y: e.y, max: 30, t: 0.4, d: 0.4, c: '140,210,255' }); break;
    case 'blink': burst(e.x, e.y, 20, '#a46bff', 80, 0.6); break;
    case 'exec': fx.nums.push({ x: e.x, y: e.y - 14, v: '處決', c: '#c08cff', big: true, t: 0.9 }); burst(e.x, e.y, 16, '#c08cff', 80, 0.5); break;
    case 'ehealfx': fx.rings.push({ x: e.x, y: e.y, max: 100, t: 0.5, d: 0.5, c: '255,80,200' }); break;
    case 'res': { const p = snap && snap.ps.find(o => o.i === e.i); if (p) fx.rings.push({ x: p.x, y: p.y, max: 60, t: 0.8, d: 0.8, c: hexRgb(TAGS[e.c].color) }); sfx('res'); break; }
  }
}
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
function onOver(e) {
  const kills = mode === 'online' ? (e.kills[myId] || 0) : Object.values(e.kills).reduce((a, b) => a + b, 0);
  const crystals = crystalsFor({ ...e, kills });
  save.crystals += crystals; save.runs++;
  if (e.ch > save.best.ch || (e.ch === save.best.ch && e.sg > save.best.sg)) save.best = { ch: e.ch, sg: e.sg };
  persist(save);
  overInfo = { ...e, crystals };
  jingleLock = true; playJingle(e.win ? 'victory' : 'gameover');
}
function updateFx(dt) {
  for (const p of fx.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.t -= dt; }
  fx.parts = fx.parts.filter(p => p.t > 0);
  if (fx.parts.length > 1000) fx.parts.splice(0, fx.parts.length - 1000);
  for (const n of fx.nums) { n.y -= 22 * dt; n.t -= dt; }
  fx.nums = fx.nums.filter(n => n.t > 0);
  if (fx.nums.length > 120) fx.nums.splice(0, fx.nums.length - 120);
  for (const a of ['rings', 'slashes', 'beams', 'banners', 'zaps', 'lobs']) { for (const o of fx[a]) o.t -= dt; fx[a] = fx[a].filter(o => o.t > 0); }
  if (fx.bossIntro) { fx.bossIntro.t -= dt; if (fx.bossIntro.t <= 0) fx.bossIntro = null; }
  shake = Math.max(0, shake - dt * 18);
  stageT += dt;
}

// ---------- 配樂 ----------
const BOSS_KEY = [0, 2, -3, 3, -2];
let jingleLock = false;
function updateMusic() {
  if (!AC) return;
  if (!inGame || !snap) {
    jingleLock = false;
    playSong($('camp').classList.contains('hidden') ? 'title' : 'camp');
    return;
  }
  if (snap.st === 'over' || jingleLock) return;
  const ty = snap.ty;
  if (ty === 'boss' && (snap.ph === 'fight' || (snap.bs && snap.bs.length))) {
    if (snap.cp >= CHAPTERS.length) playSong('final'); else playSong('boss', BOSS_KEY[snap.cp - 1] || 0);
  } else if (ty === 'combat' || ty === 'elite') playSong('ch' + snap.cp);
  else playSong('event');
}

// ---------- 主迴圈 ----------
let lastT = performance.now(), acc = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  if (mode === 'local' && local && inGame) {
    const g = local.game;
    for (const s of local.slots) g.setInput(s.id, readDevice(s.dev, g.players.get(s.id)));
    acc += dt;
    while (acc >= 1 / 60) { g.step(1 / 60); acc -= 1 / 60; }
    if (!map || g.mapVersion !== map.v) loadMap(g.mapData());
    snap = g.snapshot();
    if (snap.ex) for (const x of snap.ex) exMap.set(x.i, x);
    handleEvents(snap.ev);
    for (const s of local.slots) handleNav(s.id, [s.dev]);
  } else if (mode === 'online' && inGame) {
    handleNav(myId, pad(0) ? ['kbm', 'pad0'] : ['kbm']);
  }
  updateFx(dt);
  updateMusic();
  if (KEYART) { drawKeyArt(ctx, cv.width, cv.height, t / 1000); return; }
  if (inGame && snap && map) render(dt);
  else {
    ctx.fillStyle = '#0b0a14'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!$('menu').classList.contains('hidden')) { const tc = $('title'), r = tc.getBoundingClientRect(); const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR); if (tc.width !== w || tc.height !== h) { tc.width = w; tc.height = h; } drawKeyArt(tc.getContext('2d'), w, h, t / 1000); }
  }
}
const KEYART = new URLSearchParams(location.search).has('keyart');
if (KEYART) $('ui').classList.add('hidden');
requestAnimationFrame(frame);
window.__abyss = { get local() { return local; }, save, music: () => ({ song: currentSong(), level: musicLevel() }), musicTap, playSong, get ac() { return AC; } }; // 除錯用

// ---------- 繪製 ----------
const pcirc = (x, y, r, c) => { b.fillStyle = c; x = Math.round(x); y = Math.round(y); b.fillRect(x - r, y - r + 1, r * 2, r * 2 - 2); b.fillRect(x - r + 1, y - r, r * 2 - 2, r * 2); };
const shadow = (x, y, rx) => { b.fillStyle = 'rgba(0,0,0,0.35)'; b.beginPath(); b.ellipse(Math.round(x), Math.round(y), rx, rx * 0.4, 0, 0, 7); b.fill(); };
const onScreen = (x, y, m = 30) => x > -m && y > -m && x < VW + m && y < VH + m;

function render(dt) {
  const s = snap, th = map.theme, now = performance.now() / 1000;
  // 鏡頭
  let tx = 0, ty = 0;
  if (mode === 'online') {
    const me = s.ps.find(p => p.i === myId) || s.ps[0];
    if (me) {
      const q = ip('p', me); tx = q.x; ty = q.y;
      if (!me.dd && !me.ch && performance.now() - mouse.moved < 3000) { tx += clamp((mouse.x / SCALE - VW / 2) * 0.15, -30, 30); ty += clamp((mouse.y / SCALE - VH / 2) * 0.15, -20, 20); }
    }
  } else {
    let n = 0;
    for (const p of s.ps) if (!p.dd) { tx += p.x; ty += p.y; n++; }
    if (!n) for (const p of s.ps) { tx += p.x; ty += p.y; n++; }
    tx /= n || 1; ty /= n || 1;
  }
  // 鏡頭限制在房間範圍內（房間比畫面小時置中）
  const R = map.room;
  const cl = (v, lo, hi, half) => (hi - lo < half * 2 ? (lo + hi) / 2 : clamp(v, lo + half, hi - half));
  tx = cl(tx, (R.x - 1) * T, (R.x + R.w + 1) * T, VW / 2);
  ty = cl(ty, (R.y - 2.5) * T, (R.y + R.h + 1) * T, VH / 2);
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.init = true; }
  cam.x += (tx - cam.x) * Math.min(1, dt * 8); cam.y += (ty - cam.y) * Math.min(1, dt * 8);
  const ox = Math.round(cam.x - VW / 2 + (Math.random() - 0.5) * shake), oy = Math.round(cam.y - VH / 2 + (Math.random() - 0.5) * shake);
  camO = { x: ox, y: oy };

  b.fillStyle = th.voidc; b.fillRect(0, 0, VW, VH);
  b.drawImage(map.canvas, -ox, -oy);

  // 門
  if (s.dr) s.dr.forEach((d, i) => {
    const x = Math.round(d.x - ox), y = Math.round(d.y - oy), col = DOORS[d.t].color;
    const pulse = 0.5 + 0.5 * Math.sin(now * 4 + i);
    b.fillStyle = 'rgba(0,0,0,0.85)'; b.fillRect(x - 7, y - 24, 14, 18);
    b.fillStyle = col; b.globalAlpha = 0.25 + 0.25 * pulse; b.fillRect(x - 6, y - 22, 12, 16); b.globalAlpha = 1;
    b.fillStyle = col; b.fillRect(x - 9, y - 26, 2, 20); b.fillRect(x + 7, y - 26, 2, 20); b.fillRect(x - 9, y - 27, 18, 3);
    b.fillStyle = '#ffffff'; b.fillRect(x - 1, y - 29, 2, 2);
    b.fillStyle = col; b.globalAlpha = 0.2 + 0.15 * pulse; b.beginPath(); b.ellipse(x, y, 14, 6, 0, 0, 7); b.fill(); b.globalAlpha = 1;
    if (s.ds === i && s.dt > 0) { b.strokeStyle = '#ffffff'; b.lineWidth = 2; b.beginPath(); b.arc(x, y - 14, 16, -1.57, -1.57 + 6.28 * s.dt); b.stroke(); }
  });

  // 區域
  for (const z of s.zn) {
    const x = Math.round(z.x - ox), y = Math.round(z.y - oy);
    if (!onScreen(x, y, 40)) continue;
    if (z.k === 'fire') { for (let i = 0; i < 3; i++) { const a = now * 9 + i * 2.1 + z.x; b.fillStyle = i % 2 ? '#ff8a2a' : '#ffd07a'; b.fillRect(x + Math.round(Math.cos(a) * z.r * 0.6), y + Math.round(Math.sin(a * 1.3) * z.r * 0.3) - (i * 2), 2, 3); } }
    else if (z.k === 'poison') { b.fillStyle = 'rgba(140,230,70,0.22)'; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.fill(); }
    else if (z.k === 'pool') { b.fillStyle = 'rgba(120,200,60,0.28)'; b.beginPath(); b.ellipse(x, y, z.r, z.r * 0.6, 0, 0, 7); b.fill(); if (Math.random() < 0.1) burst(z.x + (Math.random() - 0.5) * z.r, z.y, 1, '#b0ff7a', 10, 0.5); }
    else if (z.k === 'lava') {
      b.fillStyle = 'rgba(255,90,20,0.35)'; b.beginPath(); b.ellipse(x, y, z.r, z.r * 0.65, 0, 0, 7); b.fill();
      b.fillStyle = 'rgba(255,200,80,0.45)'; b.beginPath(); b.ellipse(x, y, z.r * 0.55, z.r * 0.35, 0, 0, 7); b.fill();
      if (Math.random() < 0.15) burst(z.x + (Math.random() - 0.5) * z.r, z.y, 1, '#ffb04a', 15, 0.5);
    } else if (z.k === 'warm') {
      b.strokeStyle = z.on ? 'rgba(255,190,90,0.9)' : 'rgba(255,190,90,0.35)'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.stroke();
      if (z.on) { b.fillStyle = 'rgba(255,160,60,0.12)'; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.fill(); }
      b.fillStyle = '#3a3040'; b.fillRect(x - 5, y - 2, 10, 6); b.fillStyle = '#5a5070'; b.fillRect(x - 6, y - 4, 12, 2);
      b.fillStyle = Math.sin(now * 18) > 0 ? '#ffd07a' : '#ff8a2a'; b.fillRect(x - 3, y - 9, 6, 5); b.fillStyle = '#fff0a0'; b.fillRect(x - 1, y - 8, 2, 3);
    } else if (z.k === 'safe') {
      b.fillStyle = 'rgba(90,200,255,0.25)'; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.fill();
      b.strokeStyle = `rgba(150,230,255,${0.6 + 0.4 * Math.sin(now * 12)})`; b.lineWidth = 2; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.stroke();
    } else if (z.k === 'hole') {
      for (let i = 0; i < 4; i++) { b.fillStyle = `rgba(${40 + i * 30},0,${80 + i * 30},${0.5 - i * 0.1})`; b.beginPath(); b.arc(x, y, 34 - i * 7, 0, 7); b.fill(); }
      b.fillStyle = '#000'; b.beginPath(); b.arc(x, y, 9, 0, 7); b.fill();
      for (let i = 0; i < 10; i++) { const a = now * 4 + i * 0.63, rr = 12 + ((now * 30 + i * 9) % 40); b.fillStyle = '#c08cff'; b.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1, 1); }
    } else if (z.k === 'met') {
      b.strokeStyle = 'rgba(255,140,40,0.8)'; b.lineWidth = 1; b.beginPath(); b.arc(x, y, z.r, 0, 7); b.stroke();
      const my = y - (1 - z.p) * 90; pcirc(x + (1 - z.p) * 20, my, 4, '#ff6a1a'); pcirc(x + (1 - z.p) * 20, my, 2, '#ffe08a');
    }
  }

  // 危險區域
  for (const h of s.hz) {
    const x = h.x - ox, y = h.y - oy, col = h.d ? (h.f === 'poison' ? '140,230,70' : '255,50,50') : '255,170,40', p = Math.min(1, h.p);
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
    b.fillStyle = `rgba(220,140,255,${bm.t / 0.3})`; b.fillRect(0, -bm.w / 2, bm.l, bm.w);
    b.fillStyle = `rgba(255,255,255,${bm.t / 0.3})`; b.fillRect(0, -bm.w / 6, bm.l, bm.w / 3); b.restore();
  }

  // 生怪預告
  for (const sp of s.sp) {
    const a = 0.4 + 0.4 * Math.sin(now * 14), c = sp.el ? '255,210,80' : '190,110,255';
    b.strokeStyle = `rgba(${c},${a})`; b.lineWidth = 1;
    b.beginPath(); b.arc(Math.round(sp.x - ox), Math.round(sp.y - oy), 4 + sp.p * 6, 0, 7); b.stroke();
    pcirc(sp.x - ox, sp.y - oy, 2, `rgba(${c},${a})`);
  }

  // 互動物件
  for (const o of s.ob) drawObj(o, o.x - ox, o.y - oy, now);

  // 道具
  for (const pk of s.pk) {
    const x = pk.x - ox, y = pk.y - oy;
    if (!onScreen(x, y, 20)) continue;
    const bob = Math.round(Math.sin(now * 5 + pk.i) * 1.5);
    if (pk.k === 'coin') b.drawImage(objSprite('coin').n, Math.round(x - 3), Math.round(y - 3 + bob));
    else if (pk.k === 'hp') b.drawImage(objSprite('potion').n, Math.round(x - 4), Math.round(y - 4 + bob));
    else b.drawImage(objSprite('crystal').n, Math.round(x - 4), Math.round(y - 4 + bob));
  }

  // 角色與敵人
  const ents = [];
  for (const p of s.ps) { const q = ip('p', p); ents.push({ y: q.y, f: () => drawPlayer(p, q.x - ox, q.y - oy, now, s.tm) }); }
  for (const e of s.es) { const q = ip('e', e); ents.push({ y: q.y, f: () => drawEnemy(e, q.x - ox, q.y - oy, now) }); }
  ents.sort((a, c) => a.y - c.y);
  for (const e of ents) e.f();

  // 子彈
  for (const pr of s.pr) {
    const q = ip('r', pr), x = q.x - ox, y = q.y - oy;
    if (onScreen(x, y, 10)) drawProj(pr, x, y, now);
  }
  for (const l of fx.lobs) {
    const k2 = 1 - l.t / l.d, x = l.x1 + (l.x2 - l.x1) * k2 - ox, y = l.y1 + (l.y2 - l.y1) * k2 - Math.sin(k2 * Math.PI) * 50 - oy;
    pcirc(x, y, 3, '#3a3a4a'); b.fillStyle = '#ff6a2a'; b.fillRect(Math.round(x), Math.round(y) - 4, 1, 2);
  }

  // 特效
  for (const sl of fx.slashes) {
    const k2 = sl.t / 0.15, p = s.ps.find(o => o.i === sl.i), q = p ? ip('p', p) : sl;
    b.strokeStyle = `rgba(255,255,255,${k2})`; b.lineWidth = 2;
    b.beginPath(); b.arc(q.x - ox, q.y - 4 - oy, sl.r - 6, sl.a - 1.0, sl.a + 1.0); b.stroke();
    b.strokeStyle = `rgba(160,200,255,${k2 * 0.7})`; b.beginPath(); b.arc(q.x - ox, q.y - 4 - oy, sl.r - 12, sl.a - 0.8, sl.a + 0.8); b.stroke();
  }
  for (const r of fx.rings) {
    const k2 = 1 - r.t / r.d;
    b.strokeStyle = `rgba(${r.c},${1 - k2})`; b.lineWidth = 2;
    b.beginPath(); b.arc(r.x - ox, r.y - oy, Math.max(1, r.max * k2), 0, 7); b.stroke();
  }
  for (const z of fx.zaps) {
    b.strokeStyle = `rgba(255,240,120,${z.t / 0.18})`; b.lineWidth = 1;
    b.beginPath();
    z.pts.forEach(([x, y], i) => {
      if (i === 0) { b.moveTo(x - ox, y - oy); return; }
      const [px, py] = z.pts[i - 1];
      for (let j = 1; j <= 3; j++) b.lineTo(px + (x - px) * j / 4 - ox + (Math.random() - 0.5) * 6, py + (y - py) * j / 4 - oy + (Math.random() - 0.5) * 6);
      b.lineTo(x - ox, y - oy);
    });
    b.stroke();
  }
  for (const p of fx.parts) { b.fillStyle = p.c; b.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.s, p.s); }

  if (s.mk) {
    const p = s.ps.find(o => o.i === s.mk.i);
    if (p) {
      const q = ip('p', p), x = Math.round(q.x - ox), y = Math.round(q.y - oy);
      b.strokeStyle = `rgba(95,242,255,${0.5 + 0.4 * Math.sin(now * 14)})`; b.lineWidth = 1; b.beginPath(); b.arc(x, y, 56, 0, 7); b.stroke();
      b.fillStyle = 'rgba(95,242,255,0.08)'; b.beginPath(); b.arc(x, y, 56, 0, 7); b.fill();
      b.fillStyle = '#5ff2ff'; b.fillRect(x - 3, y - 34, 6, 5); b.fillStyle = '#16121f'; b.fillRect(x - 2, y - 33, 1, 2); b.fillRect(x + 1, y - 33, 1, 2); b.fillStyle = '#5ff2ff'; b.fillRect(x - 2, y - 29, 4, 2);
    }
  }

  // 光影
  lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, VW, VH);
  lx.fillStyle = th.light; lx.fillRect(0, 0, VW, VH);
  lx.globalCompositeOperation = 'destination-out';
  const L = (x, y, r, a) => { const g = lx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = g; lx.fillRect(x - r, y - r, r * 2, r * 2); };
  for (const p of s.ps) if (!p.dd) { const q = ip('p', p); L(q.x - ox, q.y - oy, 150, 1); }
  for (const pr of s.pr) if (pr.k === 'fire' || pr.k === 'fireball' || pr.k === 'holy' || pr.k === 'efire') L(pr.x - ox, pr.y - oy, 22, 0.5);
  if (s.dr) for (const d of s.dr) L(d.x - ox, d.y - 14 - oy, 50, 0.8);
  lx.globalCompositeOperation = 'source-over';
  b.drawImage(light, 0, 0);

  if (s.ts) { b.globalCompositeOperation = 'saturation'; b.fillStyle = 'hsl(0,0%,50%)'; b.fillRect(0, 0, VW, VH); b.globalCompositeOperation = 'source-over'; b.fillStyle = 'rgba(60,40,120,0.18)'; b.fillRect(0, 0, VW, VH); }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, VW * SCALE, VH * SCALE);
  drawHUD(s, now);
}

function drawObj(o, x, y, now) {
  x = Math.round(x); y = Math.round(y);
  if (!onScreen(x, y, 30)) return;
  shadow(x, y + 4, 8);
  if (o.k === 'chest') {
    let dx = 0;
    if (o.tr && !o.o && (now % 4) < 0.25) dx = Math.round(Math.sin(now * 60));
    b.drawImage(objSprite(o.o ? 'chestOpen' : 'chest').n, x - 6 + dx, y - 6);
  } else if (o.k === 'pedestal') {
    b.fillStyle = '#5a5870'; b.fillRect(x - 6, y - 4, 12, 8); b.fillStyle = '#7a7890'; b.fillRect(x - 7, y - 6, 14, 3); b.fillStyle = '#3a3848'; b.fillRect(x - 6, y + 3, 12, 1);
    if (!o.o) {
      const bob = Math.round(Math.sin(now * 3 + o.i) * 1.5), name = { potion: 'potion', boon: 'scroll', cross: 'cross', whet: 'whet' }[o.it];
      b.drawImage(objSprite(name).n, x - 4, y - 16 + bob);
    }
  } else if (o.k === 'anvil') {
    b.fillStyle = '#2a2838'; b.fillRect(x - 9, y - 6, 18, 5); b.fillRect(x - 5, y - 1, 10, 3); b.fillRect(x - 7, y + 2, 14, 3);
    b.fillStyle = '#6a6880'; b.fillRect(x - 8, y - 6, 16, 2); b.fillStyle = '#9a98b0'; b.fillRect(x - 8, y - 6, 10, 1);
    if (Math.random() < 0.08) burst(o.x + (Math.random() - 0.5) * 10, o.y - 8, 1, '#ffd07a', 30, 0.4);
  } else if (o.k === 'altar') {
    b.fillStyle = '#3a1a24'; b.fillRect(x - 10, y - 8, 20, 12); b.fillStyle = '#6a2a3a'; b.fillRect(x - 11, y - 10, 22, 3);
    b.fillStyle = `rgba(255,40,80,${0.5 + 0.3 * Math.sin(now * 3)})`; b.fillRect(x - 4, y - 6, 8, 6);
    for (const cx of [-9, 8]) { b.fillStyle = '#e8e0d0'; b.fillRect(x + cx, y - 15, 2, 5); b.fillStyle = Math.sin(now * 20 + cx) > 0 ? '#ffd07a' : '#ff8a2a'; b.fillRect(x + cx, y - 17, 2, 2); }
  }
}

function drawWeapon(p, now) {
  b.save(); b.translate(0, -6);
  let a = p.a;
  const sl = fx.slashes.find(o => o.i === p.i);
  if (sl && p.c === 'knight') a += (0.5 - sl.t / 0.15) * 2.4;
  b.rotate(a);
  const ex = exMap.get(p.i), wl = ex ? ex.wl : 1, glow = wl >= 5 ? '#ffe14a' : wl >= 3 ? '#8fd8ff' : null;
  switch (p.c) {
    case 'knight':
      b.fillStyle = '#5a3a1a'; b.fillRect(2, -1, 4, 2); b.fillStyle = '#ffd34d'; b.fillRect(6, -3, 2, 6);
      b.fillStyle = '#dfe6f2'; b.fillRect(8, -1, 11, 3); b.fillStyle = '#ffffff'; b.fillRect(8, -1, 11, 1); b.fillStyle = '#8a94a8'; b.fillRect(19, 0, 1, 1);
      if (glow) { b.fillStyle = glow; b.fillRect(9, 1, 9, 1); }
      break;
    case 'ranger':
      b.strokeStyle = '#8b5a2b'; b.lineWidth = 2; b.beginPath(); b.arc(3, 0, 8, -1.2, 1.2); b.stroke();
      b.fillStyle = glow || '#e8e0c8'; b.fillRect(6, -7, 1, 14); b.fillStyle = '#c9a06a'; b.fillRect(2, 0, 9, 1);
      break;
    case 'mage':
      b.fillStyle = '#7a5230'; b.fillRect(0, -1, 14, 2); b.fillStyle = '#ffd34d'; b.fillRect(13, -2, 1, 4);
      b.fillStyle = glow || '#ff8a2a'; b.fillRect(14, -2, 4, 4); b.fillStyle = '#ffe08a'; b.fillRect(15, -1, 2, 2);
      break;
    case 'cleric':
      b.fillStyle = '#c9962a'; b.fillRect(1, -1, 11, 2); b.fillStyle = '#fff4c2'; b.fillRect(11, -3, 5, 6); b.fillStyle = glow || '#ffd34d'; b.fillRect(12, -4, 3, 8); b.fillRect(10, -1, 7, 2);
      break;
  }
  b.restore();
}

function drawPlayer(p, x, y, now, tm) {
  if (!onScreen(x, y)) return;
  x = Math.round(x); y = Math.round(y);
  if (p.dd) {
    b.fillStyle = '#5a5870'; b.fillRect(x - 4, y - 9, 8, 11); b.fillRect(x - 3, y - 10, 6, 1);
    b.fillStyle = '#2a2838'; b.fillRect(x - 1, y - 7, 2, 6); b.fillRect(x - 3, y - 5, 6, 2);
    return;
  }
  shadow(x, y + 4, 7);
  const frames = playerSprite(p.c, p.sk);
  const walk = p.mv && !p.dn, fr = walk ? 1 + (Math.floor(now * 8) % 2) : 0;
  const set = frames[fr], face = Math.cos(p.a) < 0 ? -1 : 1;
  const img = p.fl ? set.w : p.dn ? set.g : set.n;
  const bob = !walk && Math.floor(now * 2) % 2 ? 1 : 0;
  b.save(); b.translate(x, y);
  if (p.dn) { b.rotate(Math.PI / 2 * face); b.drawImage(img, -10, -12); b.restore(); return; }
  if (p.dg) { b.globalAlpha = 0.55; b.scale(1, 0.85); }
  else if (p.iv && Math.floor(now * 20) % 2) b.globalAlpha = 0.6;
  const behind = Math.sin(p.a) < -0.3;
  if (behind) drawWeapon(p, now);
  b.scale(face, 1); b.drawImage(img, -8, -15 + bob);
  if (p.se & 1) { b.globalAlpha = 0.3; b.drawImage(set.i, -8, -15 + bob); b.globalAlpha = 1; }
  if (p.se & 4) { b.globalAlpha = 0.45; b.drawImage(set.p, -8, -15 + bob); b.globalAlpha = 1; }
  b.scale(face, 1);
  if (!behind) drawWeapon(p, now);
  b.restore();
  if (p.se & 2 && Math.random() < 0.3) burst(p.x + (Math.random() - 0.5) * 8, p.y - 6, 1, '#ff8a2a', 20, 0.4);
  if (p.sp) {
    b.strokeStyle = 'rgba(190,215,255,0.75)'; b.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const a = now * 14 + i * 2.09; b.beginPath(); b.arc(x, y - 4, 30, a, a + 0.8); b.stroke(); }
  }
  if (p.ob) for (let i = 0; i < p.ob; i++) {
    const a = tm * 3.5 + i * 6.283 / p.ob + (performance.now() / 1000 - snapT / 1000) * 3.5 * (mode === 'online' ? 1 : 0);
    const bx = x + Math.cos(a) * 26, by = y - 3 + Math.sin(a) * 26;
    b.save(); b.translate(Math.round(bx), Math.round(by)); b.rotate(a + 1.57);
    b.fillStyle = '#c08cff'; b.fillRect(-1, -4, 2, 8); b.fillStyle = '#ffffff'; b.fillRect(0, -4, 1, 3); b.restore();
  }
}

const shadowCache = new Map();
function shadowTint(img) {
  if (shadowCache.has(img)) return shadowCache.get(img);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(110,50,190,0.82)'; x.fillRect(0, 0, c.width, c.height);
  shadowCache.set(img, c);
  return c;
}
function drawEnemy(e, x, y, now) {
  const B = BOSSES[e.t], D = B || ENEMIES[e.t];
  if (!onScreen(x, y, 60)) return;
  if (e.t === 'shadowClone') {
    const set = playerSprite(e.c || 'knight', 'default')[Math.floor(now * 8) % 2 + 1];
    shadow(x, y + 4, 7);
    b.save(); b.translate(Math.round(x), Math.round(y)); if (Math.cos(e.a) < 0) b.scale(-1, 1);
    b.drawImage(e.fl ? set.w : shadowTint(set.n), -8, -15);
    b.restore();
    b.fillStyle = `rgba(160,80,255,${0.5 + 0.3 * Math.sin(now * 10)})`; b.fillRect(Math.round(x) - 2, Math.round(y) - 11, 1, 1); b.fillRect(Math.round(x) + 1, Math.round(y) - 11, 1, 1);
    if (Math.random() < 0.2) burst(e.x + (Math.random() - 0.5) * 8, e.y - 8, 1, '#7a4ab0', 15, 0.4);
    if (e.hp < e.mh) { b.fillStyle = '#1a1426'; b.fillRect(Math.round(x) - 8, Math.round(y) - 20, 16, 3); b.fillStyle = '#b07cff'; b.fillRect(Math.round(x) - 7, Math.round(y) - 19, Math.ceil(14 * e.hp / e.mh), 1); }
    return;
  }
  const S = enemySprite(e.t);
  if (e.un) {
    b.fillStyle = '#3a2a1a'; b.beginPath(); b.ellipse(Math.round(x), Math.round(y + 3), 7, 3, 0, 0, 7); b.fill();
    if (Math.random() < 0.2) burst(e.x + (Math.random() - 0.5) * 10, e.y + 2, 1, '#6a5030', 20, 0.3);
    return;
  }
  let img = e.pt ? S.g : e.fl && (!B || Math.floor(now * 30) % 3 === 0) ? S.w : e.fz ? S.i : S.n;
  if (e.st === 'fuse' && Math.floor(now * 16) % 2) img = S.w;
  if (B && !e.fl && !e.fz && e.st === 'wind' && Math.floor(now * 16) % 2) img = S.r;
  const sc = (B ? 2 : 1) * (e.sc || 1);
  const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  let dx = 0, dy = 0;
  if (D.spr === 'slime' && e.st === 'hop') dy = -3;
  if (D.ai === 'fly' || D.spr === 'wisp' || D.spr === 'eye' || D.spr === 'ghost') dy = -5 + Math.round(Math.sin(now * 6 + e.i) * 2);
  if (e.st === 'wind') dx = Math.round((Math.random() - 0.5) * 3);
  if (e.st === 'fade') b.globalAlpha = 0.4;
  dy -= e.z;
  shadow(x, y + (B ? 10 : 4), B ? Math.max(8, 16 - e.z * 0.15) : Math.max(4, w * 0.35));
  const ax = Math.round(x - w / 2 + dx), ay = Math.round(y - h + (B ? 12 : 5) + dy);
  if (D.alpha) b.globalAlpha = Math.min(b.globalAlpha, D.alpha);
  if (e.el) { const o = S.o; b.drawImage(o, ax - sc, ay - sc, Math.round(o.width * sc), Math.round(o.height * sc)); }
  else b.drawImage(img, ax, ay, w, h);
  if (e.el && img !== S.n) b.drawImage(img, ax, ay, w, h);
  if (e.se & 4 && !e.fz) { b.globalAlpha = 0.4; b.drawImage(S.i, ax, ay, w, h); }
  if (e.se & 2) { b.globalAlpha = 0.35; b.drawImage(S.p, ax, ay, w, h); }
  b.globalAlpha = 1;
  if (e.se & 1 && Math.random() < 0.35) burst(e.x + (Math.random() - 0.5) * w * 0.6, e.y - h * 0.4, 1, Math.random() < 0.5 ? '#ff8a2a' : '#ffd07a', 25, 0.4);
  if (e.se & 2 && Math.random() < 0.15) burst(e.x + (Math.random() - 0.5) * w * 0.6, e.y - h * 0.3, 1, '#9be04a', 15, 0.5);
  if (e.im && B) {
    b.strokeStyle = `rgba(255,220,120,${0.5 + 0.3 * Math.sin(now * 8)})`; b.lineWidth = 1;
    b.beginPath(); b.ellipse(Math.round(x), Math.round(ay + h / 2), w * 0.55, h * 0.55, 0, 0, 7); b.stroke();
  }
  if (e.fc != null) {
    b.strokeStyle = '#c8d4f0'; b.lineWidth = 2; b.beginPath(); b.arc(Math.round(x), Math.round(y - 4), e.sc * 10, e.fc - 0.8, e.fc + 0.8); b.stroke();
  }
  if ((B && e.st === 'stun') || e.se & 8) {
    for (let i = 0; i < 3; i++) { const a = now * 6 + i * 2.09; b.fillStyle = '#ffe14a'; b.fillRect(Math.round(x + Math.cos(a) * (B ? 12 : 7)), Math.round(ay - 2 + Math.sin(a) * 3), 2, 2); }
  }
  if (!B && e.hp < e.mh) {
    const bw = e.el ? 20 : 14, bx = Math.round(x - bw / 2), by = ay - 3;
    b.fillStyle = '#1a1426'; b.fillRect(bx - 1, by - 1, bw + 2, 3);
    b.fillStyle = e.el ? '#ffb02a' : '#ff4a5a'; b.fillRect(bx, by, Math.ceil(bw * e.hp / e.mh), 1);
  }
}

function drawProj(pr, x, y, now) {
  const rot = (fn) => { b.save(); b.translate(Math.round(x), Math.round(y)); b.rotate(pr.a); fn(); b.restore(); };
  switch (pr.k) {
    case 'arrow': rot(() => { b.fillStyle = '#c9a06a'; b.fillRect(-5, -0.5, 8, 1); b.fillStyle = '#ffffff'; b.fillRect(2, -1, 2, 2); b.fillStyle = '#e04a4a'; b.fillRect(-5, -1, 2, 2); }); break;
    case 'bone': rot(() => { b.fillStyle = '#e9e6dc'; b.fillRect(-3, -1, 6, 2); b.fillRect(-4, -2, 2, 4); b.fillRect(2, -2, 2, 4); }); break;
    case 'sword': rot(() => { b.fillStyle = 'rgba(200,220,255,0.85)'; b.fillRect(-2, -6, 3, 12); b.fillStyle = '#ffffff'; b.fillRect(0, -5, 1, 10); }); break;
    case 'knife': rot(() => { b.fillStyle = '#c08cff'; b.fillRect(-3, -1, 6, 2); b.fillStyle = '#fff'; b.fillRect(1, -1, 2, 1); }); break;
    case 'wind': rot(() => { b.fillStyle = '#6dffc4'; b.fillRect(-4, -1, 8, 2); b.fillStyle = '#e0fff4'; b.fillRect(-1, -2, 4, 1); }); break;
    case 'shard': case 'ice': pcirc(x, y, pr.k === 'ice' ? 3 : 2, '#5ab0e8'); pcirc(x, y, 1, '#e8f8ff'); break;
    case 'fire': pcirc(x, y, 3, '#ff7b2a'); pcirc(x, y, 1, '#ffe08a'); break;
    case 'holy': case 'hbolt': pcirc(x, y, pr.k === 'hbolt' ? 4 : 3, '#fff6b0'); pcirc(x, y, 1, '#ffffff'); break;
    case 'spore': pcirc(x, y, 3, '#7a3fb0'); pcirc(x, y, 2, '#c58cff'); break;
    case 'seed': pcirc(x, y, 3, '#3a7a1a'); pcirc(x, y, 2, '#8ae04a'); break;
    case 'web': b.fillStyle = 'rgba(255,255,255,0.85)'; b.fillRect(Math.round(x) - 3, Math.round(y), 7, 1); b.fillRect(Math.round(x), Math.round(y) - 3, 1, 7); b.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); break;
    case 'rock': b.fillStyle = '#2a2838'; b.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); b.fillStyle = '#9a9cab'; b.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); break;
    case 'efire': pcirc(x, y, 3, '#ff4a1a'); pcirc(x, y, 1, '#ffd07a'); break;
    case 'dark': pcirc(x, y, 3, '#5a1fb0'); pcirc(x, y, 2, '#d07cff'); b.fillStyle = '#fff'; b.fillRect(Math.round(x), Math.round(y), 1, 1); break;
    case 'fireball': pcirc(x, y, 5, '#c8301a'); pcirc(x, y, 4, '#ff6a1a'); pcirc(x, y, 2, '#ffd27a'); break;
  }
}

// ---------- HUD ----------
function bar(x, y, w, h, frac, col, bg = 'rgba(0,0,0,0.6)') {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}
const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';
function txt(s, x, y, size, col = '#fff', align = 'left', weight = 700) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size / 5); ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function wrap(s, maxW, size, weight = 500) {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
  const lines = []; let cur = '';
  for (const ch of s) { if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; }
  if (cur) lines.push(cur);
  return lines;
}
function tagCounts(ex) {
  const c = {};
  if (ex) for (const [id, l] of ex.b) { const bn = BOON_MAP[id]; if (bn) c[bn.tag] = (c[bn.tag] || 0) + l; }
  return c;
}

function drawHUD(s, now) {
  const W = cv.width, H = cv.height;
  choiceRects = [];
  // 名牌、倒地、互動進度
  for (const p of s.ps) {
    const q = ip('p', p), sc = w2s(q.x, q.y);
    if (p.dd) continue;
    txt(p.n, sc.x, sc.y - 20 * SCALE, 11 * U, CLASSES[p.c].color, 'center');
    if (p.ch) txt('選擇增幅中…', sc.x, sc.y - 20 * SCALE - 13 * U, 10 * U, '#ffd34d', 'center', 600);
    if (p.dn) {
      txt(`倒地 ${p.bl}s`, sc.x, sc.y - 20 * SCALE - 13 * U, 11 * U, '#ff6b6b', 'center');
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4 * U; ctx.beginPath(); ctx.arc(sc.x, sc.y, 14 * SCALE, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#7dff9a'; ctx.beginPath(); ctx.arc(sc.x, sc.y, 14 * SCALE, -1.57, -1.57 + 6.28 * p.rv); ctx.stroke();
    }
    if (p.ut > 0) {
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4 * U; ctx.beginPath(); ctx.arc(sc.x, sc.y - 6 * SCALE, 12 * SCALE, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(sc.x, sc.y - 6 * SCALE, 12 * SCALE, -1.57, -1.57 + 6.28 * Math.min(1, p.ut)); ctx.stroke();
    }
  }
  // 門、物件標籤
  if (s.dr) s.dr.forEach(d => {
    const sc = w2s(d.x, d.y - 34), D = DOORS[d.t], m = 40 * U;
    if (sc.x > m && sc.x < W - m && sc.y > m && sc.y < H - m) { txt(`【${D.icon}】${D.name}`, sc.x, sc.y, 13 * U, D.color, 'center', 900); return; }
    // 畫面外的門：在邊緣顯示箭頭
    const cx = W / 2, cy = H / 2, a = Math.atan2(sc.y - cy, sc.x - cx);
    const ex = clamp(sc.x, m + 60 * U, W - m - 60 * U), ey = clamp(sc.y, m + 70 * U, H - m);
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.fillStyle = D.color; ctx.beginPath(); ctx.moveTo(14 * U, 0); ctx.lineTo(-8 * U, -9 * U); ctx.lineTo(-8 * U, 9 * U); ctx.closePath(); ctx.fill();
    ctx.restore();
    txt(D.name, ex, ey + 18 * U, 11 * U, D.color, 'center', 900);
  });
  for (const o of s.ob) {
    const sc = w2s(o.x, o.y - 22);
    if (o.k === 'pedestal' && !o.o) { txt(SHOP[o.it].name, sc.x, sc.y - 12 * U, 11 * U, '#fff', 'center'); txt(`${o.c} 金幣`, sc.x, sc.y + 2 * U, 10 * U, s.g >= o.c ? '#ffd34d' : '#ff6a6a', 'center'); }
    if (o.k === 'anvil') txt('鐵砧：站上去升級武器', sc.x, sc.y, 11 * U, '#8ad0ff', 'center');
    if (o.k === 'altar') txt('祭壇：獻上 25% 生命', sc.x, sc.y - 4 * U, 11 * U, '#ff6a8a', 'center');
  }
  for (const n of fx.nums) { const sc = w2s(n.x, n.y); txt(String(n.v), sc.x, sc.y, (n.big ? 16 : 11) * U, n.c, 'center', 900); }

  // 玩家面板
  const order = mode === 'online' ? [...s.ps].sort((a, c) => (a.i === myId ? -1 : c.i === myId ? 1 : 0)) : s.ps;
  const pw = 250 * U, ph = 74 * U;
  order.forEach((p, i) => {
    const x = 12 * U, y = 12 * U + i * (ph + 6 * U), c = CLASSES[p.c], ex = exMap.get(p.i);
    ctx.fillStyle = 'rgba(12,10,24,0.8)'; ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = p.i === myId ? '#ffd34d' : c.color; ctx.lineWidth = 2 * U; ctx.strokeRect(x, y, pw, ph);
    ctx.imageSmoothingEnabled = false;
    const set = playerSprite(p.c, p.sk)[0];
    ctx.drawImage(p.dd || p.dn ? set.g : set.n, x + 6 * U, y + 8 * U, 32 * U, 40 * U);
    if (ex) txt(`武 Lv${ex.wl}`, x + 22 * U, y + 56 * U, 9 * U, ex.wl >= 5 ? '#ffe14a' : ex.wl >= 3 ? '#8fd8ff' : '#ccc', 'center', 700);
    if (ex && ex.lv) txt(`♥×${ex.lv}`, x + 22 * U, y + 67 * U, 9 * U, '#ff8a9a', 'center', 700);
    const bx = x + 46 * U, bw = pw - 54 * U;
    txt(p.n, bx, y + 10 * U, 12 * U, '#fff');
    txt(`${c.name} · 擊殺 ${p.k}`, x + pw - 8 * U, y + 10 * U, 10 * U, c.color, 'right', 600);
    bar(bx, y + 18 * U, bw, 11 * U, p.hp / p.mh, '#e8384f');
    txt(`${p.hp}/${p.mh}`, bx + bw / 2, y + 23.5 * U, 9 * U, '#fff', 'center');
    bar(bx, y + 31 * U, bw, 5 * U, p.sh / p.ms, '#9fb4d8');
    bar(bx, y + 38 * U, bw, 5 * U, p.en / 100, '#3f8cff');
    const ready = p.sk2 <= 0;
    bar(bx, y + 45 * U, bw, 5 * U, 1 - p.sk2, ready && p.en >= c.skillCost ? '#ffd34d' : '#7a6a3a');
    // 共鳴
    const tc = tagCounts(ex);
    let cx = bx;
    for (const tag of Object.keys(TAGS)) {
      if (!tc[tag]) continue;
      const tier = RES[tag].filter(r => tc[tag] >= r.n).length;
      ctx.fillStyle = tier ? TAGS[tag].color : 'rgba(255,255,255,0.15)';
      ctx.fillRect(cx, y + 54 * U, 26 * U, 14 * U);
      txt(`${TAGS[tag].icon}${tc[tag]}`, cx + 13 * U, y + 61 * U, 9 * U, tier ? '#111' : TAGS[tag].color, 'center', 900);
      ctx.lineWidth = 1;
      cx += 29 * U;
      if (cx > x + pw - 28 * U) break;
    }
    if (!Object.keys(tc).length) txt(`${c.skillName}${ready ? (p.en >= c.skillCost ? ' 就緒' : ' 能量不足') : ''}`, bx, y + 61 * U, 9 * U, '#aaa', 'left', 600);
    if (p.dn) txt('倒地中！', x + pw / 2, y + ph / 2, 16 * U, '#ff6b6b', 'center', 900);
    if (p.dd) txt('陣亡（下一關復活）', x + pw / 2, y + ph / 2, 13 * U, '#aaa', 'center', 900);
  });

  // 章節進度
  const ch = CHAPTERS[s.cp - 1];
  txt(`第 ${s.cp} 章 · ${ch.name}`, W / 2, 18 * U, 15 * U, '#ffd34d', 'center', 900);
  const nw = 20 * U, gap = 4 * U, total = STAGES_PER_CHAPTER * (nw + gap) - gap;
  for (let i = 1; i <= STAGES_PER_CHAPTER; i++) {
    const x = W / 2 - total / 2 + (i - 1) * (nw + gap), y = 30 * U;
    ctx.fillStyle = i < s.sg ? '#6a5ac8' : i === s.sg ? '#ffd34d' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, nw, 12 * U);
    if (i === STAGES_PER_CHAPTER) txt('王', x + nw / 2, y + 6 * U, 9 * U, i === s.sg ? '#111' : '#ff6a6a', 'center', 900);
  }
  txt(`金幣 ${s.g}`, W / 2, 56 * U, 12 * U, '#ffe9a0', 'center');

  // 頭目血條
  if (s.bs && s.bs.length) {
    const n = s.bs.length, gap = 16 * U;
    const bw = Math.min((W * 0.62 - gap * (n - 1)) / n, 640 * U);
    s.bs.forEach((bo, i) => {
      const bx = W / 2 - (bw * n + gap * (n - 1)) / 2 + i * (bw + gap), by = H - (bo.gg != null ? 62 : 52) * U;
      txt(bo.n + (bo.rg ? '（狂暴）' : ''), bx, by - 13 * U, 14 * U, bo.rg ? '#ff6b6b' : '#fff', 'left', 900);
      txt(`${bo.hp} / ${bo.mh}（${Math.ceil(bo.hp / bo.mh * 100)}%）`, bx + bw, by - 13 * U, 12 * U, '#ffd0d0', 'right', 800);
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(bx - 3 * U, by - 3 * U, bw + 6 * U, (bo.gg != null ? 36 : 26) * U);
      bar(bx, by, bw, 12 * U, bo.hp / bo.mh, bo.im === 1 ? '#7a7a90' : '#c8202f', '#3a1018');
      if (bo.im) { ctx.strokeStyle = bo.im === 1 ? '#c0c0d0' : '#ffd34d'; ctx.lineWidth = 2 * U; ctx.strokeRect(bx - 1, by - 1, bw + 2, 12 * U + 2); }
      bar(bx, by + 15 * U, bw, 5 * U, bo.sg, bo.st ? '#ffffff' : '#ffd34d', '#3a3010');
      if (bo.gg != null) { bar(bx, by + 24 * U, bw, 6 * U, bo.gg, bo.gg > 0.8 ? '#ff3a1a' : '#ff9a3a', '#3a1a08'); }
      const status = bo.st ? '破綻！傷害 ×1.5' : bo.ms || '硬直值';
      txt(status, bx, by + (bo.gg != null ? 42 : 32) * U, 11 * U, bo.im === 1 ? '#d0d0e0' : '#ffd34d', 'left', 800);
    });
  }
  if (s.mk) { const p = s.ps.find(o => o.i === s.mk.i); if (p) { const sc = w2s(p.x, p.y); txt(`死亡印記 ${s.mk.t.toFixed(1)}`, sc.x, sc.y - 36 * SCALE, 13 * U, '#5ff2ff', 'center', 900); } }
  if (s.ts) txt('時 間 停 止', W / 2, H * 0.32, 30 * U, '#e0d0ff', 'center', 900);

  // 訊息
  fx.banners.forEach((bn, i) => {
    ctx.globalAlpha = Math.min(1, bn.t * 2);
    txt(bn.m, W / 2, H * 0.2 + i * 24 * U, 14 * U, bn.c, 'center', 800);
    ctx.globalAlpha = 1;
  });
  if (fx.bossIntro) {
    const a = Math.min(1, fx.bossIntro.t);
    ctx.fillStyle = `rgba(0,0,0,${0.45 * a})`; ctx.fillRect(0, H * 0.4, W, 70 * U);
    ctx.globalAlpha = a; txt(fx.bossIntro.n, W / 2, H * 0.4 + 35 * U, 34 * U, '#ff5a5a', 'center', 900); ctx.globalAlpha = 1;
  }
  if (s.cp === 1 && s.sg === 1 && stageT < 14 && !s.dr) {
    const help = mode === 'local' ? 'P1 WASD＋滑鼠 · P2 IJKL/U/O/H · 手把 左搖桿移動 右搖桿瞄準射擊 A翻滾 LB技能 · Tab 查看增幅 · Esc 離開'
      : 'WASD 移動 · 滑鼠瞄準 · 左鍵攻擊 · 右鍵/Q 技能 · 空白鍵 翻滾 · Tab 查看增幅 · Esc 離開';
    ctx.globalAlpha = Math.min(1, 14 - stageT); txt(help, W / 2, H - 22 * U, 12 * U, '#d8d2ff', 'center', 600); ctx.globalAlpha = 1;
  }

  if (showBoons) drawBoonList(s);
  drawChoices(s);

  if (s.st === 'over') drawOver(s);
}

function boonCard(bid, g, have, ex, x, y, w, h, sel, compact) {
  const sp = SPECIAL[bid], bn = BOON_MAP[bid];
  const tag = bn ? TAGS[bn.tag] : null, col = tag ? tag.color : '#ffd34d';
  ctx.fillStyle = sel ? 'rgba(40,32,80,0.96)' : 'rgba(18,14,34,0.94)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = sel ? '#ffffff' : col; ctx.lineWidth = (sel ? 3 : 2) * U; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w, (compact ? 16 : 22) * U);
  const fs = compact ? 0.82 : 1;
  txt(tag ? `${tag.icon}・${tag.name}` : '特殊', x + 8 * U, y + (compact ? 8 : 11) * U, 11 * U * fs, '#111', 'left', 900);
  if (g > 1) txt(`強化 +${g}`, x + w - 8 * U, y + (compact ? 8 : 11) * U, 11 * U * fs, '#111', 'right', 900);
  const name = bn ? bn.name : sp.name;
  const nl = bn ? Math.min(bn.max, have + g) : 0;
  txt(name, x + 10 * U, y + (compact ? 30 : 42) * U, 16 * U * fs, '#fff', 'left', 900);
  if (bn) txt(have ? `Lv${have} → Lv${nl}` : `Lv${nl}`, x + w - 10 * U, y + (compact ? 30 : 42) * U, 11 * U * fs, '#c9b8ff', 'right', 700);
  const lines = wrap(bn ? bn.desc(nl) : sp.desc(), w - 20 * U, 12 * U * fs);
  lines.slice(0, compact ? 2 : 4).forEach((l, i) => txt(l, x + 10 * U, y + ((compact ? 48 : 66) + i * 17 * fs) * U, 12 * U * fs, '#e8e4ff', 'left', 500));
  if (bn && !compact) {
    const tc = tagCounts(ex), cur = tc[bn.tag] || 0, after = cur + (nl - have);
    const next = RES[bn.tag].find(r => r.n > cur);
    txt(`${tag.name}共鳴 ${cur} → ${after}`, x + 10 * U, y + h - 40 * U, 11 * U, col, 'left', 800);
    if (next) {
      const ln = wrap(`${next.n}：${next.desc}`, w - 20 * U, 10 * U);
      ln.slice(0, 2).forEach((l, i) => txt(l, x + 10 * U, y + h - 24 * U + i * 13 * U, 10 * U, after >= next.n ? '#7dff9a' : '#9a93c4', 'left', 600));
    }
  }
}
function drawChoices(s) {
  const W = cv.width, H = cv.height;
  const pending = s.ps.filter(p => { const ex = exMap.get(p.i); return ex && ex.c && (mode === 'local' || p.i === myId); });
  if (!pending.length) return;
  ctx.fillStyle = 'rgba(5,3,12,0.55)'; ctx.fillRect(0, 0, W, H);
  if (pending.length === 1) {
    const p = pending[0], ex = exMap.get(p.i), cw = Math.min(250 * U, (W - 80 * U) / 3), ch = 260 * U, gap = 18 * U;
    const x0 = W / 2 - (cw * 3 + gap * 2) / 2, y0 = H / 2 - ch / 2;
    txt(ex.c.r === 'rare' ? '選擇一個強化增幅（等級 +2）' : '選擇一個增幅', W / 2, y0 - 44 * U, 22 * U, '#ffd34d', 'center', 900);
    if (mode === 'local') txt(p.n, W / 2, y0 - 18 * U, 13 * U, CLASSES[p.c].color, 'center');
    const cur = cursors.has(p.i) ? cursors.get(p.i) : 1;
    ex.c.o.forEach(([id, g], i) => {
      const x = x0 + i * (cw + gap);
      boonCard(id, g, (ex.b.find(b2 => b2[0] === id) || [0, 0])[1], ex, x, y0, cw, ch, i === cur, false);
      txt(String(i + 1), x + cw / 2, y0 + ch + 16 * U, 14 * U, i === cur ? '#fff' : '#888', 'center', 900);
      choiceRects.push({ x, y: y0, w: cw, h: ch, pid: p.i, idx: i });
    });
    txt(`1/2/3 或點擊選擇 · A/D 移動、空白鍵確認 · 手把 十字鍵 + A${ex.rr ? ` · R／Y 重擲（剩 ${ex.rr} 次）` : ''}`, W / 2, y0 + ch + 44 * U, 12 * U, '#c9c2f0', 'center', 600);
    return;
  }
  // 本機多人：每人一欄
  const colW = Math.min(300 * U, (W - 40 * U) / pending.length - 10 * U), ch = 92 * U;
  const x0 = W / 2 - (pending.length * (colW + 10 * U) - 10 * U) / 2, y0 = H * 0.18;
  txt('選擇增幅', W / 2, y0 - 26 * U, 20 * U, '#ffd34d', 'center', 900);
  pending.forEach((p, k2) => {
    const ex = exMap.get(p.i), x = x0 + k2 * (colW + 10 * U), cur = cursors.has(p.i) ? cursors.get(p.i) : 1;
    const slot = local && local.slots.find(sl => sl.id === p.i);
    txt(`${p.n}${ex.c.r === 'rare' ? '（強化 +2）' : ''}`, x + colW / 2, y0, 13 * U, CLASSES[p.c].color, 'center', 900);
    ex.c.o.forEach(([id, g], i) => {
      const y = y0 + 16 * U + i * (ch + 8 * U);
      boonCard(id, g, (ex.b.find(b2 => b2[0] === id) || [0, 0])[1], ex, x, y, colW, ch, i === cur, true);
      if (slot && slot.dev === 'kbm') choiceRects.push({ x, y, w: colW, h: ch, pid: p.i, idx: i });
    });
    const hint = slot ? { kbm: '1/2/3 · A/D＋空白鍵 · R 重擲', kb2: 'J/L 移動 · U 確認 · O 重擲' }[slot.dev] || '十字鍵 · A 確認 · Y 重擲' : '';
    txt(hint + (ex.rr ? `（${ex.rr}）` : ''), x + colW / 2, y0 + 16 * U + 3 * (ch + 8 * U) + 6 * U, 10 * U, '#c9c2f0', 'center', 600);
  });
}
function drawBoonList(s) {
  const W = cv.width, H = cv.height;
  const list = mode === 'online' ? s.ps.filter(p => p.i === myId) : s.ps;
  const colW = Math.min(360 * U, (W - 40 * U) / list.length - 10 * U);
  ctx.fillStyle = 'rgba(5,3,12,0.8)'; ctx.fillRect(0, 0, W, H);
  list.forEach((p, k2) => {
    const ex = exMap.get(p.i); if (!ex) return;
    let x = 20 * U + k2 * (colW + 10 * U), y = 80 * U;
    txt(`${p.n} 的增幅`, x, y, 16 * U, CLASSES[p.c].color, 'left', 900); y += 24 * U;
    const tc = tagCounts(ex);
    for (const tag of Object.keys(TAGS)) {
      if (!tc[tag]) continue;
      txt(`${TAGS[tag].name} ${tc[tag]}`, x, y, 13 * U, TAGS[tag].color, 'left', 900); y += 18 * U;
      for (const r of RES[tag]) { txt(`${tc[tag] >= r.n ? '◆' : '◇'} ${r.n}：${r.desc}`, x + 10 * U, y, 10 * U, tc[tag] >= r.n ? '#fff' : '#777', 'left', 600); y += 14 * U; }
      for (const [id, l] of ex.b) if (BOON_MAP[id].tag === tag) { txt(`・${BOON_MAP[id].name} Lv${l}：${BOON_MAP[id].desc(l)}`, x + 10 * U, y, 10 * U, '#d8d2ff', 'left', 500); y += 14 * U; }
      y += 6 * U;
      if (y > H - 40 * U) break;
    }
    if (!ex.b.length) txt('尚未獲得增幅', x, y, 12 * U, '#999');
  });
}
function drawOver(s) {
  const W = cv.width, H = cv.height, o = overInfo;
  ctx.fillStyle = o && o.win ? 'rgba(20,14,0,0.7)' : 'rgba(10,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
  txt(o && o.win ? '深淵通關！' : '全 滅', W / 2, H * 0.32, 54 * U, o && o.win ? '#ffd34d' : '#ff4a5a', 'center', 900);
  txt(`抵達第 ${s.cp} 章第 ${s.sg} 關 · 完成 ${o ? o.cleared : 0} 關 · 擊敗頭目 ${o ? o.bossKills : 0}`, W / 2, H * 0.32 + 50 * U, 16 * U, '#fff', 'center');
  const rank = [...s.ps].sort((a, c) => c.dm - a.dm).map(p => `${p.n}：傷害 ${p.dm} / 擊殺 ${p.k}`).join('　');
  txt(rank, W / 2, H * 0.32 + 80 * U, 12 * U, '#ddd', 'center', 600);
  if (o) txt(`獲得 ${o.crystals} 魂晶（目前 ${save.crystals}）→ 到營地強化角色吧！`, W / 2, H * 0.32 + 112 * U, 16 * U, '#8fe8ff', 'center', 900);
  txt(mode === 'local' ? '按 Enter 再次挑戰 · Esc 返回（可進入營地）' : '即將返回大廳…', W / 2, H * 0.32 + 146 * U, 14 * U, '#ffd34d', 'center');
}

if (!KEYART) show('menu');
