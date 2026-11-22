// 深淵獵團 — 前端主程式：帳號、房間、主迴圈、輸入傳送、配樂與彈窗
import { CLASSES, CHAPTERS } from './data.js';
import { V, setupRender, loadMap, handleEvents, updateFx, render, w2s } from './render.js';
import { input, initInput, readInput, setControlPref } from './input.js';
import { updateHud, banner, center, renderChoice } from './hud.js';
import { createCamp, skinCards } from './camp.js';
import { initMusic, playSong, playJingle, toggleMute, isMuted, probeMusicFiles, currentSong, musicLevel } from './music.js';
import { drawKeyArt } from './keyart.js';
import { loadSprites } from './art.js';
loadSprites();

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 無法儲存 */ } } };
const cv = $('game');
// 伺服器位址（public/config.js）：留空＝與網頁同一台主機
const SERVER = String(window.ABYSS_SERVER || '').trim().replace(/\/+$/, '');
const WS_URL = SERVER ? SERVER.replace(/^http/, 'ws') + '/ws' : (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
setupRender(cv);
initInput(cv);

// ---------- 狀態 ----------
let token = store.get('abyss_token'), profile = null;
let ws = null, wsWanted = false, myId = null, roomCode = null, inRoom = false;
let snap = null, prev = null, snapT = 0, prevMaps = null;
const exMap = new Map();
let screen = 'auth', resultShown = false;

// ---------- 音效 ----------
let AC = null, master = null, noiseBuf = null;
const lastS = {};
function audioInit() {
  if (AC) return;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.3; master.connect(AC.destination); initMusic(AC, AC.destination); probeMusicFiles(); } catch { AC = null; }
}
addEventListener('pointerdown', audioInit); addEventListener('keydown', audioInit);
function tone(f, d, type = 'square', v = 0.12, f2 = null, delay = 0) {
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, v = 0.2, freq = 800) {
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const c = noiseBuf.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; }
  const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d);
}
function sfx(n) {
  if (!AC) return;
  const now = performance.now(); if (lastS[n] && now - lastS[n] < 45) return; lastS[n] = now;
  const seq = (fs, d, type, v, gap) => fs.forEach((f, i) => tone(f, d, type, v, null, i * gap));
  switch (n) {
    case 'atk_blade': noise(0.06, 0.12, 4500); tone(1400, 0.05, 'triangle', 0.03, 700); break;
    case 'atk_aegis': noise(0.14, 0.2, 900); tone(120, 0.12, 'square', 0.06, 70); break;
    case 'atk_star': tone(700, 0.1, 'sine', 0.05, 1400); break;
    case 'atk_hunter': tone(900, 0.05, 'triangle', 0.05, 500); break;
    case 'perfect': tone(1800, 0.15, 'square', 0.06, 2600); noise(0.1, 0.1, 6000); break;
    case 'parry': seq([1200, 1800], 0.1, 'square', 0.08, 0.04); noise(0.2, 0.2, 3000); break;
    case 'ult': tone(220, 0.6, 'sawtooth', 0.12, 880); noise(0.5, 0.15, 1200); break;
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
    case 'forge': tone(1600, 0.08, 'square', 0.08); noise(0.15, 0.2, 4000); break;
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
    case 'count': tone(880, 0.12, 'square', 0.08); break;
  }
}

// ---------- 介面切換 ----------
const SCREENS = { auth: 'authScreen', home: 'homeScreen', camp: 'campScreen', settings: 'settingsScreen', bind: 'bindScreen' };
function show(name) {
  screen = name;
  for (const [k, id] of Object.entries(SCREENS)) $(id).classList.toggle('hidden', k !== name);
  $('screens').classList.toggle('hidden', inRoom);
  $('hud').classList.toggle('hidden', !inRoom);
  if (name === 'home') renderHome();
  if (name === 'camp') camp.render();
  if (name === 'settings') renderSettings($('settingsBody'));
}
let toastT = null;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => show('home'));
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('.modal').classList.add('hidden'));

// ---------- API ----------
async function api(route, body = {}) {
  const r = await fetch(SERVER + '/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: '無法連線到伺服器' }));
  if (!r.ok) throw new Error(j.error || '發生錯誤');
  if (j.token) { token = j.token; store.set('abyss_token', token); }
  if (j.profile) profile = j.profile;
  return j;
}

// ---------- 登入／註冊／遊客 ----------
let authTab = 'login';
document.querySelectorAll('#authScreen .tab').forEach(t => t.onclick = () => {
  authTab = t.dataset.tab;
  document.querySelectorAll('#authScreen .tab').forEach(x => x.classList.toggle('on', x === t));
  document.querySelector('#authScreen .reg-only').classList.toggle('hidden', authTab !== 'register');
  $('authSubmit').textContent = authTab === 'login' ? '登入' : '註冊並開始';
  $('authForm').password.autocomplete = authTab === 'login' ? 'current-password' : 'new-password';
});
$('authForm').onsubmit = async e => {
  e.preventDefault(); $('authErr').textContent = '';
  const f = e.target;
  try { await api(authTab, { username: f.username.value, password: f.password.value, nick: f.nick.value }); afterLogin(); }
  catch (err) { $('authErr').textContent = err.message; }
};
$('btnGuest').onclick = async () => { $('authErr').textContent = ''; try { await api('guest', {}); afterLogin(); toast('已用遊客身分登入，可隨時綁定帳號保存進度'); } catch (err) { $('authErr').textContent = err.message; } };
$('bindForm').onsubmit = async e => {
  e.preventDefault(); $('bindErr').textContent = '';
  try { await api('bind', { username: e.target.username.value, password: e.target.password.value }); toast('綁定成功！'); show('home'); } catch (err) { $('bindErr').textContent = err.message; }
};
function afterLogin() { connectWs(); show('home'); }
function logout() { token = null; profile = null; store.set('abyss_token', null); wsWanted = false; if (ws) ws.close(); show('auth'); }

// ---------- 主畫面 ----------
function renderHome() {
  if (!profile) return;
  $('homeNick').textContent = profile.nick;
  $('homeAcct').textContent = profile.guest ? '遊客帳號（建議綁定帳號，才能在其他裝置登入）' : `帳號：${profile.username}`;
  $('homeCrys').textContent = profile.crystals;
  const st = profile.stats;
  $('homeStats').innerHTML = [['冒險', st.runs], ['通關', st.wins], ['擊殺', st.kills], ['頭目', st.bossKills], ['最佳', st.best.ch ? `${st.best.ch}-${st.best.sg}` : '—']]
    .map(([k, v]) => `<div class="stat"><b>${v}</b>${k}</div>`).join('');
  $('btnBind').classList.toggle('hidden', !profile.guest);
}
// ---------- 手機橫向 ----------
const orientPref = () => store.get('abyss_orient') || 'landscape';
const isPortrait = () => innerHeight > innerWidth;
function goLandscape() {
  if (input.mode !== 'mobile' || orientPref() !== 'landscape') return Promise.resolve(false);
  const el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
  const req = document.fullscreenElement || !fs ? Promise.resolve() : Promise.resolve(fs.call(el, { navigationUI: 'hide' })).catch(() => {});
  return req.then(() => (screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : Promise.reject())).then(() => true).catch(() => false);
}
let rotateDismissed = false;
function updateRotateHint() {
  const show = inRoom && input.mode === 'mobile' && orientPref() === 'landscape' && isPortrait() && !rotateDismissed;
  $('rotateHint').classList.toggle('hidden', !show);
}
$('btnLandscape').onclick = () => goLandscape().then(ok => { if (!ok) toast('這台裝置無法自動鎖定方向：請關閉手機的「螢幕方向鎖定」後把手機橫放'); });
$('btnRotateClose').onclick = () => { rotateDismissed = true; updateRotateHint(); };
addEventListener('resize', updateRotateHint);
$('btnCreate').onclick = () => { $('homeErr').textContent = ''; goLandscape(); wsSend({ t: 'create' }); };
$('btnJoin').onclick = () => {
  const code = $('joinCode').value.trim();
  if (!/^\d{4}$/.test(code)) { $('homeErr').textContent = '請輸入 4 位數字的房間號碼'; return; }
  $('homeErr').textContent = ''; goLandscape(); wsSend({ t: 'join', code });
};
$('joinCode').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
$('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
$('btnCamp').onclick = () => show('camp');
$('btnSettings').onclick = () => show('settings');
$('btnBind').onclick = () => show('bind');
$('btnLogout').onclick = logout;
$('btnNick').onclick = async () => {
  const n = prompt('新的暱稱（最多 10 個字）', profile.nick); if (!n) return;
  try { await api('nick', { nick: n }); renderHome(); } catch (e) { toast(e.message); }
};
const camp = createCamp({ getProfile: () => profile, api, onChange: p => { profile = p; }, setErr: m => { $('campErr').textContent = m; } });

function renderSettings(box) {
  box.innerHTML = `<label>操作模式<select class="ctrlSel"><option value="auto">自動偵測（依第一次輸入切換）</option><option value="pc">電腦：鍵盤滑鼠</option><option value="mobile">手機：觸控搖桿</option></select></label>
    <label>手機螢幕方向<select class="orientSel"><option value="landscape">橫向（建議，進房時自動切換全螢幕橫向）</option><option value="any">跟隨手機方向</option></select></label>
    <button class="alt musicBtn">${isMuted() ? '♪ 音樂：關' : '♪ 音樂：開'}</button>
    <div class="note">電腦：WASD／方向鍵移動、滑鼠瞄準、左鍵普攻、空白鍵翻滾、右鍵或 E 特殊技、Q 或 R 大招、F 互動、Esc 選單、M 音樂。<br>手機：左下任意處按住出現搖桿；右下扇形按鈕＝攻擊／翻滾／特殊／大招／互動，自動瞄準最近敵人。</div>`;
  const sel = box.querySelector('.ctrlSel'); sel.value = input.pref; sel.onchange = () => setControlPref(sel.value);
  const os = box.querySelector('.orientSel'); os.value = orientPref(); os.onchange = () => { store.set('abyss_orient', os.value); updateRotateHint(); };
  box.querySelector('.musicBtn').onclick = e => { audioInit(); toggleMute(); e.target.textContent = isMuted() ? '♪ 音樂：關' : '♪ 音樂：開'; };
}

// ---------- 連線 ----------
function wsSend(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); else if (o.t !== 'in') toast('尚未連線到伺服器，請稍候'); }
function connectWs() {
  wsWanted = true;
  if (ws && ws.readyState <= 1) return;
  ws = new WebSocket(WS_URL);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token }));
  ws.onmessage = e => onMsg(JSON.parse(e.data));
  ws.onclose = () => {
    const was = inRoom; ws = null; leaveRoomLocal();
    if (was) toast('與伺服器的連線中斷');
    if (wsWanted) setTimeout(connectWs, 1500);
  };
}
function leaveRoomLocal() {
  const was = inRoom;
  inRoom = false; myId = null; roomCode = null; snap = prev = null; prevMaps = null; exMap.clear(); V.map = null;
  for (const m of ['choiceModal', 'skinModal', 'menuModal', 'resultModal']) $(m).classList.add('hidden');
  renderChoice(null);
  if (was || screen !== 'auth') show(screen === 'auth' ? 'auth' : 'home');
}
function onMsg(m) {
  switch (m.t) {
    case 'authok': profile = m.profile; if (screen === 'auth') show('home'); else renderHome(); break;
    case 'autherr': logout(); break;
    case 'profile': profile = m.profile; renderHome(); if (screen === 'camp') camp.render(); if (!$('skinModal').classList.contains('hidden')) openWardrobe(); break;
    case 'joined': myId = m.id; roomCode = m.code; V.myId = myId; inRoom = true; resultShown = false; show(screen); toast(`已進入房間 ${m.code}，把號碼告訴朋友吧！`); break;
    case 'room': roomCode = m.code; break;
    case 'left': leaveRoomLocal(); break;
    case 'map': loadMap(m); break;
    case 's':
      prev = snap; snap = m; snapT = performance.now();
      prevMaps = prev ? { p: new Map(prev.ps.map(o => [o.i, o])), e: new Map(prev.es.map(o => [o.i, o])), r: new Map(prev.pr.map(o => [o.i, o])) } : null;
      if (m.ex) for (const x of m.ex) exMap.set(x.i, x);
      for (const e of handleEvents(m.ev, sfx)) onGameEvent(e);
      break;
    case 'reward':
      profile = m.profile;
      $('resultBody').insertAdjacentHTML('beforeend', `<div class="center"><b class="crys">+${m.crystals} 魂晶</b>（目前 ${m.profile.crystals}）</div>`);
      break;
    case 'err': if (inRoom) toast(m.msg); else { $('homeErr').textContent = m.msg; toast(m.msg); } break;
  }
}
function onGameEvent(e) {
  switch (e.k) {
    case 'text': banner(e.m, e.c); break;
    case 'boss': center(e.n, '#ff5a5a', 2600); break;
    case 'count': if (e.n > 0) { center(String(e.n), '#ffd34d', 900); sfx('count'); } else center('', '#fff', 1); break;
    case 'run': center('出發！', '#ffd34d', 1200); break;
    case 'ui': if (e.w === 'wardrobe' && e.i === myId) openWardrobe(); break;
    case 'hub': $('resultModal').classList.add('hidden'); resultShown = false; break;
    case 'over': showResult(e); break;
  }
}
function showResult(e) {
  if (resultShown) return; resultShown = true;
  $('resultTitle').textContent = e.win ? '深淵通關！' : '全滅…';
  $('resultBody').innerHTML = `<div>抵達第 ${e.ch} 章第 ${e.sg} 關・完成 ${e.cleared} 關・擊敗頭目 ${e.bossKills}</div>` +
    (snap ? [...snap.ps].sort((a, b) => b.dm - a.dm).map(p => `<div>${esc(p.n)}（${CLASSES[p.c].name}）：傷害 ${p.dm}・擊殺 ${p.k}</div>`).join('') : '');
  $('resultModal').classList.remove('hidden');
  playJingle(e.win ? 'victory' : 'gameover');
}
function openWardrobe() {
  const me = snap && snap.ps.find(p => p.i === myId); if (!me || !profile) return;
  $('skinNote').textContent = `${CLASSES[me.c].name}的造型（切換後房間內所有人即時看到）・魂晶 ${profile.crystals}`;
  skinCards($('skinList'), profile, me.c, async s => { try { await api('skin', { cls: me.c, skin: s.id }); openWardrobe(); } catch (err) { toast(err.message); } });
  $('skinModal').classList.remove('hidden');
}
function openMenu() {
  const box = $('menuBody');
  box.innerHTML = `<div class="chip center">房號 <b>${roomCode}</b></div><button class="mResume">繼續</button>`;
  const set = document.createElement('div'); set.className = 'stack'; box.appendChild(set); renderSettings(set);
  box.insertAdjacentHTML('beforeend', '<button class="alt mLeave">離開房間</button>');
  box.querySelector('.mResume').onclick = () => $('menuModal').classList.add('hidden');
  box.querySelector('.mLeave').onclick = () => { wsSend({ t: 'leave' }); $('menuModal').classList.add('hidden'); };
  $('menuModal').classList.remove('hidden');
}
$('btnMenu').onclick = openMenu;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'KeyM') toggleMute();
  if (!inRoom) return;
  if (e.code === 'Escape') { const open = ['skinModal', 'menuModal'].find(m => !$(m).classList.contains('hidden')); if (open) $(open).classList.add('hidden'); else openMenu(); }
  const ex = exMap.get(myId);
  if (ex && ex.c) {
    const i = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (i != null) wsSend({ t: 'pick', i });
    if (e.code === 'KeyR' && ex.rr) wsSend({ t: 'reroll' });
  }
});

// ---------- 插值 ----------
function ip(kind, o) {
  if (!prevMaps) return o;
  const q = prevMaps[kind].get(o.i);
  if (!q) return o;
  const al = clamp((performance.now() - snapT) / 33.3, 0, 1);
  if (Math.abs(q.x - o.x) > 60 || Math.abs(q.y - o.y) > 60) return o;
  return { x: q.x + (o.x - q.x) * al, y: q.y + (o.y - q.y) * al };
}

// ---------- 輸入傳送（30Hz） ----------
setInterval(() => {
  if (!inRoom || !snap) return;
  const modalOpen = ['skinModal', 'menuModal'].some(m => !$(m).classList.contains('hidden'));
  const me = snap.ps.find(p => p.i === myId);
  let i = { mx: 0, my: 0, aim: null, ad: 80 };
  if (!modalOpen) {
    const q = me ? ip('p', me) : null, ps = q ? w2s(q.x, q.y - 20) : null;
    i = readInput(ps ? { x: ps.x / V.DPR, y: ps.y / V.DPR } : null, V.SCALE / V.DPR);
  }
  wsSend({ t: 'in', mx: i.mx, my: i.my, a: i.aim == null ? null : Math.round(i.aim * 100) / 100, d: Math.round(i.ad || 80),
    b: (i.fire ? 1 : 0) | (i.skill ? 2 : 0) | (i.dodge ? 4 : 0) | (i.ult ? 8 : 0) | (i.use ? 16 : 0) });
}, 33);

// ---------- 配樂 ----------
const BOSS_KEY = [0, 2, -3, 3, -2];
function updateMusic() {
  if (!AC) return;
  if (!inRoom || !snap) { playSong(screen === 'camp' ? 'camp' : 'title'); return; }
  if (snap.st === 'over') return;
  if (snap.st === 'hub') { playSong('camp'); return; }
  if (snap.ty === 'boss' && (snap.ph === 'fight' || (snap.bs && snap.bs.length))) { if (snap.cp >= CHAPTERS.length) playSong('final'); else playSong('boss', BOSS_KEY[snap.cp - 1] || 0); return; }
  if (snap.ty === 'combat' || snap.ty === 'elite') { playSong('ch' + snap.cp); return; }
  playSong('event');
}

// ---------- 主迴圈 ----------
const KEYART = new URLSearchParams(location.search).has('keyart');
let lastT = performance.now(), hudT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  updateFx(dt);
  updateMusic();
  const ctx = cv.getContext('2d');
  if (KEYART) { drawKeyArt(ctx, cv.width, cv.height, t / 1000); return; }
  if (inRoom && snap && V.map) {
    const lead = input.mode === 'pc' && performance.now() - input.mouse.moved < 3000
      ? { x: clamp((input.mouse.x * V.DPR - cv.width / 2) / V.SCALE * 0.12, -28, 28), y: clamp((input.mouse.y * V.DPR - cv.height / 2) / V.SCALE * 0.12, -18, 18) } : { x: 0, y: 0 };
    render(snap, dt, ip, lead);
    hudT -= dt;
    if (hudT <= 0) { hudT = 1 / 15; updateHud(snap, exMap, myId, roomCode); updateRotateHint(); }
    renderChoice(exMap.get(myId), i => wsSend({ t: 'pick', i }), () => wsSend({ t: 'reroll' }));
  } else {
    ctx.fillStyle = '#07050c'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (const id of ['title', 'title2']) {
      const tc = $(id); if (tc.offsetParent === null) continue;
      const r = tc.getBoundingClientRect(), w = Math.round(r.width * V.DPR), h = Math.round(r.height * V.DPR);
      if (!w || !h) continue;
      if (tc.width !== w || tc.height !== h) { tc.width = w; tc.height = h; }
      drawKeyArt(tc.getContext('2d'), w, h, t / 1000);
    }
  }
}
requestAnimationFrame(frame);
window.__abyss = { get snap() { return snap; }, get profile() { return profile; }, input, music: () => ({ song: currentSong(), level: musicLevel() }), wsSend };

// ---------- 啟動 ----------
if (KEYART) $('screens').classList.add('hidden');
else if (token) api('me').then(() => afterLogin()).catch(() => { token = null; store.set('abyss_token', null); show('auth'); });
else show('auth');
if (!SERVER && /netlify\.app$|netlify\.com$/.test(location.hostname)) $('authErr').textContent = '尚未設定遊戲伺服器：請在 config.js 填入伺服器網址（見 DEPLOY.md）';
