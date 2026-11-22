// 存檔與營地（科技樹、皮膚商店）
import { CLASSES, TREE, TREE_MAP, SKINS } from './data.js';
import { playerSprite } from './sprites.js';

const KEY = 'abyss_save_v1';
const CLS = Object.keys(CLASSES);
function fresh() {
  return { v: 1, crystals: 120, runs: 0, best: { ch: 0, sg: 0 },
    tree: Object.fromEntries(CLS.map(c => [c, {}])), owned: Object.fromEntries(CLS.map(c => [c, ['default']])), sel: Object.fromEntries(CLS.map(c => [c, 'default'])) };
}
export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) { const f = fresh(); for (const c of CLS) { s.tree[c] ||= {}; s.owned[c] ||= ['default']; s.sel[c] ||= 'default'; } return { ...f, ...s }; }
  } catch { /* 無法讀取時使用新存檔 */ }
  return fresh();
}
export function persist(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 瀏覽器不允許儲存 */ } }
export const metaFor = (s, cls) => ({ tree: s.tree[cls] || {}, skin: s.sel[cls] || 'default' });

const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export function spriteCanvas(cls, skin, scale = 4) {
  const img = playerSprite(cls, skin)[0].n, c = document.createElement('canvas');
  c.width = img.width * scale; c.height = img.height * scale;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height);
  c.style.imageRendering = 'pixelated';
  return c;
}

export function createCamp(save, onChange) {
  let cls = 'knight', sel = 'hp';
  const el = document.getElementById('camp');
  const nodeName = n => (n.id === 'unique' ? `${n.name}：${CLASSES[cls].uniqueName}` : n.name);
  const nodeDesc = (n, l) => (n.id === 'unique' ? CLASSES[cls].uniqueDesc : n.desc(l));
  const reqOk = (tree, n) => !n.req || (tree[n.req[0]] || 0) >= n.req[1];

  function buy(n) {
    const tree = save.tree[cls], lv = tree[n.id] || 0;
    if (lv >= n.max || !reqOk(tree, n)) return;
    const cost = n.cost(lv + 1);
    if (save.crystals < cost) return;
    save.crystals -= cost; tree[n.id] = lv + 1;
    persist(save); onChange(); render();
  }
  function skinAction(sk) {
    const owned = save.owned[cls];
    if (!owned.includes(sk.id)) {
      if (save.crystals < sk.cost) return;
      save.crystals -= sk.cost; owned.push(sk.id);
    }
    save.sel[cls] = sk.id;
    persist(save); onChange(); render();
  }

  function render() {
    const tree = save.tree[cls];
    el.querySelector('#campCrystals').textContent = save.crystals;
    el.querySelector('#campBest').textContent = save.best.ch ? `最佳紀錄：第 ${save.best.ch} 章 ${save.best.sg} 關 · 冒險 ${save.runs} 次` : `冒險 ${save.runs} 次`;
    // 職業分頁
    const tabs = el.querySelector('#campTabs'); tabs.innerHTML = '';
    for (const c of CLS) {
      const b = document.createElement('button');
      b.className = 'tab' + (c === cls ? ' on' : ''); b.style.setProperty('--c', CLASSES[c].color);
      b.appendChild(spriteCanvas(c, save.sel[c], 2));
      b.insertAdjacentHTML('beforeend', `<span>${CLASSES[c].name}</span>`);
      b.onclick = () => { cls = c; render(); };
      tabs.appendChild(b);
    }
    // 科技樹
    const box = el.querySelector('#tree'); box.innerHTML = '';
    const pos = n => [(n.col + 0.5) * 20, (n.row + 0.5) * 20];
    let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">';
    for (const n of TREE) if (n.req) {
      const [x1, y1] = pos(TREE_MAP[n.req[0]]), [x2, y2] = pos(n), ok = reqOk(tree, n);
      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ok ? '#ffd34d' : '#3a3366'}" stroke-width="${ok ? 0.8 : 0.6}" vector-effect="non-scaling-stroke" style="stroke-width:${ok ? 3 : 2}px"/>`;
    }
    box.insertAdjacentHTML('beforeend', svg + '</svg>');
    for (const n of TREE) {
      const lv = tree[n.id] || 0, ok = reqOk(tree, n), [x, y] = pos(n);
      const d = document.createElement('button');
      d.className = 'node' + (lv >= n.max ? ' max' : lv > 0 ? ' some' : ok ? ' open' : ' lock') + (sel === n.id ? ' sel' : '');
      d.style.left = x + '%'; d.style.top = y + '%';
      d.innerHTML = `<b>${esc(nodeName(n))}</b><small>${lv}/${n.max}</small>`;
      d.onclick = () => { sel = n.id; render(); };
      box.appendChild(d);
    }
    // 詳細資訊
    const n = TREE_MAP[sel], lv = tree[n.id] || 0, ok = reqOk(tree, n), cost = lv < n.max ? n.cost(lv + 1) : 0;
    const det = el.querySelector('#nodeDetail');
    det.innerHTML = `<h3>${esc(nodeName(n))} <small>Lv ${lv}/${n.max}</small></h3>
      ${lv > 0 ? `<p>目前：${esc(nodeDesc(n, lv))}</p>` : ''}
      ${lv < n.max ? `<p class="next">下一級：${esc(nodeDesc(n, lv + 1))}</p>` : '<p class="next">已達最高等級</p>'}
      ${!ok ? `<p class="lockmsg">需要先將「${esc(nodeName(TREE_MAP[n.req[0]]))}」升到 Lv${n.req[1]}</p>` : ''}`;
    if (lv < n.max) {
      const b = document.createElement('button');
      b.className = 'gold'; b.textContent = `升級（${cost} 魂晶）`;
      b.disabled = !ok || save.crystals < cost;
      b.onclick = () => buy(n);
      det.appendChild(b);
    }
    // 皮膚
    const sk = el.querySelector('#skins'); sk.innerHTML = '';
    for (const s of SKINS[cls]) {
      const owned = save.owned[cls].includes(s.id), on = save.sel[cls] === s.id;
      const d = document.createElement('div'); d.className = 'skin' + (on ? ' on' : '');
      d.appendChild(spriteCanvas(cls, s.id, 4));
      d.insertAdjacentHTML('beforeend', `<div class="nm">${esc(s.name)}</div>`);
      const b = document.createElement('button');
      b.className = owned ? 'alt' : 'gold';
      b.textContent = on ? '使用中' : owned ? '換上' : `${s.cost} 魂晶`;
      b.disabled = on || (!owned && save.crystals < s.cost);
      b.onclick = () => skinAction(s);
      d.appendChild(b);
      sk.appendChild(d);
    }
  }
  return { render, setClass(c) { cls = c; } };
}
