// 小型 DOM 工具：h() 建立元素、面板管理、提示訊息。

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    if (c instanceof Node) el.appendChild(c);
    else if (c && c.c instanceof HTMLCanvasElement) el.appendChild(c.c);
    else el.appendChild(document.createTextNode(String(c)));
  }
  return el;
}

/** 把一個像素畫布複製成新的 <canvas class="px">（同一張圖可以放在多個地方） */
export function pxCanvas(sprite, cssW = null, cssH = null) {
  const c = document.createElement('canvas');
  c.width = sprite.w; c.height = sprite.h;
  c.className = 'px';
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite.c, 0, 0);
  if (cssW) c.style.width = `${cssW}px`;
  if (cssH) c.style.height = `${cssH}px`;
  return c;
}

export function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

export function fmtW(w) { return w < 10 ? w.toFixed(2) : w.toFixed(1); }

export function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

/** 按鈕：按下有 1 像素下沉（CSS）＋音效 */
export function btn(label, onClick, cls = '', attrs = {}) {
  return h('button', { class: `btn ${cls}`, type: 'button', ...attrs, onClick: (e) => { window.__sfx?.('click'); onClick?.(e); } }, label);
}

/** 左右滑動偵測（商店、圖鑑換頁） */
export function onSwipe(el, cb) {
  let sx = 0, sy = 0, id = null;
  el.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; id = e.pointerId; });
  el.addEventListener('pointerup', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) cb(dx < 0 ? 1 : -1);
    id = null;
  });
}
