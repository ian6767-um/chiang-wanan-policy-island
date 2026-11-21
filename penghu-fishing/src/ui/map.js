// 澎湖海域地圖：兩指縮放、單指拖曳（整數倍縮放保持像素清楚），點釣點出發。
import { h, btn, pxCanvas } from './dom.js';
import { drawMap, MAP_W, MAP_H, K } from '../render/mapart.js';
import { icon } from '../render/icons.js';

export class MapPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.data = ui.data;
    this.pauses = false;
    this.zoom = 1;
    this.pan = null;
    this.selected = null;
  }

  render() {
    const g = this.game;
    this.wrap = h('div', { class: 'mapwrap', 'data-test': 'map' });
    this.layer = h('div', { style: { position: 'absolute', left: 0, top: 0, width: `${MAP_W}px`, height: `${MAP_H}px`, transformOrigin: '0 0' } });
    this.layer.appendChild(pxCanvas(drawMap(this.data, g)));
    // 海域名稱與釣點名稱
    const regionPos = { A: [240, 250], B: [270, 40], C: [120, 160], D: [270, 345] };
    for (const r of this.data.regions) {
      const [x, y] = regionPos[r.id];
      this.layer.appendChild(h('div', { style: { position: 'absolute', left: `${Math.round(x * K)}px`, top: `${Math.round(y * K)}px`, color: '#5e3a24', whiteSpace: 'nowrap', pointerEvents: 'none' } }, `${r.id} ${r.name}`));
    }
    for (const s of this.data.spots) {
      const x = Math.round(s.map[0] * K), y = Math.round(s.map[1] * K);
      const right = s.map[0] > 300 || ['A2'].includes(s.id);
      this.layer.appendChild(h('div', { style: { position: 'absolute', left: right ? `${x + 5}px` : 'auto', right: right ? 'auto' : `${MAP_W - x + 5}px`, top: `${y - 16}px`, color: '#1c1418', background: 'rgba(239,226,196,0.8)', padding: '0 2px', whiteSpace: 'nowrap', pointerEvents: 'none' } }, s.name));
    }
    this.wrap.appendChild(this.layer);
    this.info = h('div', { class: 'mapinfo', hidden: true, 'data-test': 'map-info' });
    this.wrap.appendChild(this.info);
    this.bindGestures();
    const el = h('div', { class: 'panel', 'data-test': 'panel-map' },
      h('div', { class: 'panel-head' }, pxCanvas(icon('map'), 32, 32), h('h2', {}, '澎湖海域圖'),
        h('span', { class: 'muted' }, `目前：${g.spot.name}｜船：${g.boat.name}`), h('span', { class: 'spacer' }),
        btn('－', () => this.setZoom(this.zoom - 1), '', { 'aria-label': '縮小' }), btn('＋', () => this.setZoom(this.zoom + 1), '', { 'aria-label': '放大' }),
        btn('關閉', () => this.ui.close(), 'close', { 'data-test': 'btn-close' })),
      h('div', { class: 'panel-body' }, this.wrap));
    requestAnimationFrame(() => this.center());
    if (this.selected) requestAnimationFrame(() => this.showInfo(this.selected));
    return el;
  }

  center() {
    const rect = this.wrap.getBoundingClientRect();
    const s = this.ui.app.screen.scale;
    this.vw = rect.width / s; this.vh = rect.height / s;
    if (!this.pan) {
      const sp = this.game.spot;
      this.pan = { x: this.vw / 2 - sp.map[0] * K * this.zoom, y: this.vh / 2 - sp.map[1] * K * this.zoom };
    }
    this.apply();
  }

  apply() {
    const z = this.zoom;
    const minX = Math.min(0, this.vw - MAP_W * z), minY = Math.min(0, this.vh - MAP_H * z);
    this.pan.x = Math.round(Math.max(minX, Math.min(Math.max(0, (this.vw - MAP_W * z) / 2), this.pan.x)));
    this.pan.y = Math.round(Math.max(minY, Math.min(Math.max(0, (this.vh - MAP_H * z) / 2), this.pan.y)));
    this.layer.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${z})`;
  }

  /** 整數倍縮放（1–3），以畫面中心或指定點為中心 */
  setZoom(z, cx = this.vw / 2, cy = this.vh / 2) {
    z = Math.max(1, Math.min(3, Math.round(z)));
    if (z === this.zoom) return;
    const mx = (cx - this.pan.x) / this.zoom, my = (cy - this.pan.y) / this.zoom;
    this.zoom = z;
    this.pan.x = cx - mx * z; this.pan.y = cy - my * z;
    this.apply();
  }

  local(e) {
    const r = this.wrap.getBoundingClientRect();
    const s = this.ui.app.screen.scale;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
  }

  bindGestures() {
    const pts = new Map();
    let moved = 0, pinch0 = null, last = null;
    this.wrap.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.mapinfo')) return;
      this.wrap.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, this.local(e));
      moved = 0;
      last = this.local(e);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.zoom }; }
    });
    this.wrap.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = this.local(e);
      pts.set(e.pointerId, p);
      if (pts.size === 2 && pinch0) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.setZoom(pinch0.z * (d / pinch0.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
        moved = 99;
        return;
      }
      moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
      this.pan.x += p.x - last.x; this.pan.y += p.y - last.y;
      last = p;
      this.apply();
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = this.local(e);
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch0 = null;
      if (pts.size === 1) last = [...pts.values()][0];
      if (moved < 6 && pts.size === 0) this.tap(p);
    };
    this.wrap.addEventListener('pointerup', up);
    this.wrap.addEventListener('pointercancel', up);
    this.wrap.addEventListener('wheel', (e) => { e.preventDefault(); const p = this.local(e); this.setZoom(this.zoom + (e.deltaY < 0 ? 1 : -1), p.x, p.y); }, { passive: false });
  }

  tap(p) {
    const mx = (p.x - this.pan.x) / this.zoom, my = (p.y - this.pan.y) / this.zoom;
    let best = null, bd = 22 / this.zoom + 6;
    for (const s of this.data.spots) {
      const d = Math.hypot(s.map[0] * K - mx, s.map[1] * K - 6 - my);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) { this.ui.sfx('click'); this.showInfo(best.id); }
    else this.info.hidden = true;
  }

  showInfo(id) {
    const g = this.game;
    const s = this.data.spotById[id];
    this.selected = id;
    const chk = g.canTravel(id);
    const here = g.state.spot === id;
    const species = this.data.fish.filter((f) => f.spots.includes(id));
    const caught = species.filter((f) => g.state.codex[f.id]?.caught).length;
    this.info.hidden = false;
    this.info.replaceChildren(
      h('div', { style: { fontSize: '14px' } }, `${s.id} ${s.name}`),
      h('div', { class: 'muted' }, `${this.data.regionById[s.region].name}｜${s.features}`),
      h('div', {}, `魚種 ${caught} / ${species.length} 已收集${s.harbor ? '｜有魚市、釣具店' : ''}`),
      chk.ok || here ? null : h('div', { style: { color: '#c8402f' } }, `上鎖：${chk.text}`),
      h('div', { class: 'row' },
        here ? h('span', { class: 'muted' }, '你在這裡') : btn('出發', () => this.go(id), chk.ok ? 'primary' : 'disabled', { 'data-test': 'btn-go', disabled: !chk.ok }),
        btn('取消', () => { this.info.hidden = true; this.selected = null; })));
  }

  go(id) {
    const g = this.game;
    if (!g.canTravel(id).ok) return;
    this.selected = null;
    this.ui.close(true);
    this.ui.app.travelTo(id);
  }
}
