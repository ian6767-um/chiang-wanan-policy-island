// 雙平台輸入：PC 鍵鼠 / 手機觸控（動態虛擬搖桿 + 扇形按鈕），依首次輸入或設定自動切換
const $ = id => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無法儲存 */ } } };

export const input = {
  pref: store.get('abyss_ctrl') || 'auto',   // auto | pc | mobile
  mode: 'pc',
  keys: new Set(),
  mouse: { x: 0, y: 0, l: false, r: false, moved: 0 },
  touch: { mx: 0, my: 0, fire: false, skill: false, dodge: false, ult: false, use: false },
  onMode: () => {},
};
function applyMode(m) {
  if (input.mode === m) return;
  input.mode = m;
  document.body.classList.toggle('mobile', m === 'mobile');
  input.onMode(m);
}
export function setControlPref(p) {
  input.pref = p; store.set('abyss_ctrl', p);
  if (p === 'pc' || p === 'mobile') applyMode(p);
  else applyMode(matchMedia('(pointer: coarse)').matches ? 'mobile' : 'pc');
}
const auto = m => { if (input.pref === 'auto') applyMode(m); };

// 扇形按鈕：角度 0° 在大按鈕左側，往上逆時針排列
const BTNS = [
  { k: 'fire', label: '攻擊', big: true },
  { k: 'dodge', label: '翻滾', ang: 0 },
  { k: 'skill', label: '特殊', ang: 32 },
  { k: 'ult', label: '大招', ang: 64 },
  { k: 'use', label: '互動', ang: 96 },
];
export const touchBtns = {};
export function initInput(canvas) {
  const k = input.keys;
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    k.add(e.code); auto('pc');
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => k.delete(e.code));
  addEventListener('blur', () => { k.clear(); input.mouse.l = input.mouse.r = false; });
  canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; input.mouse.x = e.clientX; input.mouse.y = e.clientY; input.mouse.moved = performance.now(); auto('pc'); });
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') { auto('mobile'); return; }
    auto('pc'); input.mouse.x = e.clientX; input.mouse.y = e.clientY;
    if (e.button === 0) input.mouse.l = true; if (e.button === 2) input.mouse.r = true;
  });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') return; if (e.button === 0) input.mouse.l = false; if (e.button === 2) input.mouse.r = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('touchstart', () => auto('mobile'), { passive: true });

  // 動態搖桿：在左半邊任意位置按下即出現
  const zone = $('stickZone'), stick = $('stick'), knob = $('knob');
  let sid = null, sx = 0, sy = 0;
  const R = 50;
  zone.addEventListener('pointerdown', e => {
    if (sid != null) return;
    sid = e.pointerId; sx = e.clientX; sy = e.clientY; try { zone.setPointerCapture(sid); } catch { /* 略過 */ }
    stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.remove('hidden'); knob.style.transform = '';
    auto('mobile');
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - sx, dy = e.clientY - sy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / R);
    input.touch.mx = m < 0.15 ? 0 : dx / R; input.touch.my = m < 0.15 ? 0 : dy / R;
  });
  const end = e => { if (e.pointerId !== sid) return; sid = null; input.touch.mx = input.touch.my = 0; stick.classList.add('hidden'); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

  const fan = $('fan');
  for (const bd of BTNS) {
    const el = document.createElement('div');
    el.className = 'tb ' + (bd.big ? 'big' : 'sm');
    if (!bd.big) el.style.setProperty('--ang', bd.ang + 'deg');
    el.innerHTML = `<span class="lb">${bd.label}</span><i class="cd"></i><b class="n"></b>`;
    const on = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* 合成事件時可能沒有指標 */ } input.touch[bd.k] = true; el.classList.add('on'); auto('mobile'); };
    const off = () => { input.touch[bd.k] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    fan.appendChild(el);
    touchBtns[bd.k] = el;
  }
  setControlPref(input.pref);
}

// 讀取目前輸入；playerScreen 為自己角色的螢幕座標（CSS 像素），scale 為世界→螢幕倍率
export function readInput(playerScreen, scale) {
  const k = input.keys, key = (...c) => (c.some(x => k.has(x)) ? 1 : 0);
  if (input.mode === 'mobile') {
    const t = input.touch;
    // 手機：自動瞄準最近敵人（aim = null 交給伺服器鎖定）
    return { mx: t.mx, my: t.my, aim: null, ad: 80, fire: t.fire, skill: t.skill, dodge: t.dodge, ult: t.ult, use: t.use };
  }
  let aim = 0, ad = 80;
  if (playerScreen) {
    const dx = input.mouse.x - playerScreen.x, dy = input.mouse.y - playerScreen.y;
    aim = Math.atan2(dy, dx); ad = Math.hypot(dx, dy) / scale;
  }
  return {
    mx: key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft'), my: key('KeyS', 'ArrowDown') - key('KeyW', 'ArrowUp'), aim, ad,
    fire: input.mouse.l, skill: input.mouse.r || !!key('KeyE'), dodge: !!key('Space'), ult: !!key('KeyQ', 'KeyR'), use: !!key('KeyF'),
  };
}
