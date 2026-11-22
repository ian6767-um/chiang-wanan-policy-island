// 營地：科技樹與造型（資料存在伺服器帳號）
import { CLASSES, TREE, TREE_MAP, SKINS } from './data.js';
import { heroArt } from './art.js';

const CLS = Object.keys(CLASSES);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export function heroCanvas(cls, skin, size = 96) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(heroArt(cls, skin).idle[0], 0, 0);
  c.style.width = size + 'px'; c.style.height = size + 'px'; c.style.imageRendering = 'pixelated';
  return c;
}
// 造型卡片（營地與鏡像衣櫃共用）
export function skinCards(box, profile, cls, onAction) {
  box.innerHTML = '';
  for (const s of SKINS[cls]) {
    const owned = (profile.owned[cls] || []).includes(s.id), on = profile.sel[cls] === s.id;
    const d = document.createElement('div'); d.className = 'skin' + (on ? ' on' : '');
    d.appendChild(heroCanvas(cls, s.id));
    d.insertAdjacentHTML('beforeend', `<div class="nm">${esc(s.name)}</div>`);
    const b = document.createElement('button');
    b.className = owned ? 'alt' : 'gold';
    b.textContent = on ? '使用中' : owned ? '換上' : `解鎖 ${s.cost} 魂晶`;
    b.disabled = on || (!owned && profile.crystals < s.cost);
    b.onclick = () => onAction(s);
    d.appendChild(b);
    box.appendChild(d);
  }
}
export function createCamp({ getProfile, api, onChange, setErr }) {
  let cls = CLS[0], sel = 'hp';
  const nodeName = n => (n.id === 'unique' ? `絕技：${CLASSES[cls].uniqueName}` : n.name);
  const nodeDesc = (n, l) => (n.id === 'unique' ? CLASSES[cls].uniqueDesc : n.desc(l));
  const reqOk = (tree, n) => !n.req || (tree[n.req[0]] || 0) >= n.req[1];
  const act = async (route, body) => { try { setErr(''); const r = await api(route, body); onChange(r.profile); render(); } catch (e) { setErr(e.message); } };
  function render() {
    const P = getProfile(); if (!P) return;
    const tree = P.trees[cls] || {};
    document.getElementById('campCrystals').textContent = P.crystals;
    const tabs = document.getElementById('campTabs'); tabs.innerHTML = '';
    for (const c of CLS) {
      const b = document.createElement('button'); b.className = 'tab' + (c === cls ? ' on' : '');
      b.textContent = CLASSES[c].name; b.style.color = CLASSES[c].color;
      b.onclick = () => { cls = c; render(); }; tabs.appendChild(b);
    }
    const box = document.getElementById('tree'); box.innerHTML = '';
    const pos = n => [(n.col + 0.5) * 20, (n.row + 0.5) * 20];
    let svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">';
    for (const n of TREE) if (n.req) { const [x1, y1] = pos(TREE_MAP[n.req[0]]), [x2, y2] = pos(n); svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${reqOk(tree, n) ? '#ffd34d' : '#3a3366'}" vector-effect="non-scaling-stroke" stroke-width="3"/>`; }
    box.insertAdjacentHTML('beforeend', svg + '</svg>');
    for (const n of TREE) {
      const lv = tree[n.id] || 0, [x, y] = pos(n), d = document.createElement('button');
      d.className = 'node' + (lv >= n.max ? ' max' : lv > 0 ? ' some' : reqOk(tree, n) ? ' open' : ' lock') + (sel === n.id ? ' sel' : '');
      d.style.left = x + '%'; d.style.top = y + '%';
      d.innerHTML = `<b>${esc(nodeName(n))}</b><small>${lv}/${n.max}</small>`;
      d.onclick = () => { sel = n.id; render(); }; box.appendChild(d);
    }
    const n = TREE_MAP[sel], lv = tree[n.id] || 0, ok = reqOk(tree, n);
    const det = document.getElementById('nodeDetail');
    det.innerHTML = `<b>${esc(nodeName(n))}　Lv ${lv}/${n.max}</b>${lv ? `<div>目前：${esc(nodeDesc(n, lv))}</div>` : ''}
      ${lv < n.max ? `<div class="next">下一級：${esc(nodeDesc(n, lv + 1))}</div>` : '<div class="next">已達最高等級</div>'}
      ${ok ? '' : `<div class="lockmsg">需要先將「${esc(nodeName(TREE_MAP[n.req[0]]))}」升到 Lv${n.req[1]}</div>`}`;
    if (lv < n.max) { const b = document.createElement('button'); b.className = 'gold'; b.textContent = `升級（${n.cost(lv + 1)} 魂晶）`; b.disabled = !ok || P.crystals < n.cost(lv + 1); b.onclick = () => act('tree', { cls, node: n.id }); det.appendChild(b); }
    skinCards(document.getElementById('campSkins'), P, cls, s => act('skin', { cls, skin: s.id }));
  }
  return { render, setClass(c) { if (CLASSES[c]) cls = c; } };
}
