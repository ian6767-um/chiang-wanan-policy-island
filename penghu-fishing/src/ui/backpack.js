// 背包介面：格子、拖曳、旋轉、丟棄、整理中的新漁獲。
import { h, btn, pxCanvas, fmt, fmtW } from './dom.js';
import { packIcon } from '../render/fishart.js';
import { icon } from '../render/icons.js';
import { itemDims } from '../core/backpack.js';
import { rarityIndex } from '../core/fishing.js';

export class BackpackPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.data = ui.data;
    this.pauses = true;
    this.selected = null;
    this.pending = null; // { res, rec, onDone }
    this.drag = null;
    this.onKeyBound = null;
  }

  get cell() { return this.ui.cfg.backpackCell; }
  sfx(n) { this.ui.sfx(n); }

  render() {
    const g = this.game;
    const P = g.pack;
    const C = this.cell;
    this.gridEl = h('div', { class: 'grid', style: { width: `${P.cols * C + 4}px`, height: `${P.rows * C + 4}px` }, 'data-test': 'pack-grid' });
    this.cells = [];
    for (let y = 0; y < P.rows; y++) {
      this.cells.push([]);
      for (let x = 0; x < P.cols; x++) {
        const c = h('div', { class: 'cell', style: { left: `${x * C}px`, top: `${y * C}px`, width: `${C}px`, height: `${C}px` } });
        this.cells[y].push(c);
        this.gridEl.appendChild(c);
      }
    }
    for (const it of P.items) this.gridEl.appendChild(this.itemEl(it));
    this.gridEl.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.drag) this.rotateDrag(); });

    this.infoEl = h('div', { class: 'info', 'data-test': 'pack-info' });
    this.trashEl = h('div', { class: 'trash', 'data-test': 'trash' }, pxCanvas(icon('trash'), 32, 32));
    const side = h('div', { class: 'col', style: { flex: '1', minWidth: '150px' } },
      this.infoEl,
      h('div', { class: 'row' },
        btn([pxCanvas(icon('rotate'), 16, 16), '旋轉'], () => this.rotateSelected(), '', { 'data-test': 'btn-rotate' }),
        btn('丟掉', () => this.discardSelected(), 'danger', { 'data-test': 'btn-discard' })),
      h('div', { class: 'row' }, this.trashEl, h('div', { class: 'muted', style: { flex: 1 } }, '拖到垃圾桶也可以丟掉')),
      this.pendingBox());
    this.statsEl = h('div', { class: 'muted', 'data-test': 'pack-stats' });
    const el = h('div', { class: 'panel wood', 'data-test': 'panel-backpack' },
      h('div', { class: 'panel-head' },
        pxCanvas(icon('backpack'), 32, 32), h('h2', {}, '背包'), this.statsEl, h('span', { class: 'spacer' }),
        btn('自動規則', () => { this.ui.close(true); this.ui.panels.settings.tab = 'rules'; this.ui.open('settings'); }),
        btn('關閉', () => this.ui.close(), 'close', { 'data-test': 'btn-close' })),
      h('div', { class: 'panel-body' }, h('div', { class: 'col' }, this.gridEl, h('div', { class: 'muted' }, this.hint())), side));
    this.el = el;
    this.updateStats();
    this.showInfo(this.selected ? P.get(this.selected) : null);
    return el;
  }

  hint() {
    return matchMedia('(pointer: coarse)').matches
      ? '長按拿起魚、拖曳移動；拿著時用另一隻手指點一下就旋轉'
      : '拖曳移動魚；拿著時按 R 或右鍵旋轉；Delete 丟掉';
  }

  updateStats() {
    const g = this.game;
    this.statsEl.textContent = `已用 ${g.pack.usedCells} / ${g.pack.totalCells} 格｜總價值 ${fmt(g.packValue())} 金幣`;
  }

  itemEl(it) {
    const C = this.cell;
    const fish = this.data.fishById[it.fish.sp];
    const { w, h: hh } = itemDims(it.fish.shape, it.rot);
    const el = h('div', {
      class: `item${this.selected === it.uid ? ' sel' : ''}`, 'data-uid': it.uid, 'data-test': 'pack-item',
      style: { left: `${it.x * C}px`, top: `${it.y * C}px`, width: `${w * C}px`, height: `${hh * C}px` },
    }, pxCanvas(packIcon(fish, it.fish.shape, C, it.rot)), h('span', { class: 'tag' }, it.fish.size));
    this.bindDrag(el, () => ({ kind: 'item', uid: it.uid, fish: it.fish, rot: it.rot }));
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !this.drag) this.showTip(el, it.fish); });
    el.addEventListener('pointerleave', () => this.hideTip());
    return el;
  }

  pendingBox() {
    if (!this.pending) return null;
    const inst = this.pending.res.instance;
    const fish = this.pending.res.fish;
    const C = this.cell;
    const box = h('div', { class: 'pending', 'data-test': 'pending' },
      h('div', {}, `新漁獲：${fish.name}（${inst.size}，${fmtW(inst.w)}kg）`),
      h('div', { class: 'muted' }, '把牠拖進空位，或放生'));
    const holder = h('div', { style: { width: `${inst.shape[1] * C}px`, height: `${inst.shape[0] * C}px`, position: 'relative', margin: '4px 0', cursor: 'grab' }, 'data-test': 'pending-fish' },
      pxCanvas(packIcon(fish, inst.shape, C, false), inst.shape[1] * C, inst.shape[0] * C));
    this.bindDrag(holder, () => ({ kind: 'pending', uid: inst.uid, fish: inst, rot: false }));
    box.append(holder, h('div', { class: 'row' },
      btn('自動放入', () => this.placePendingAuto(), 'primary', { 'data-test': 'btn-pending-auto' }),
      btn('放生這條', () => this.releasePending(), '', { 'data-test': 'btn-pending-release' })));
    return box;
  }

  // ---------- 選取與資訊 ----------
  select(uid) {
    this.selected = uid;
    for (const el of this.gridEl.querySelectorAll('.item')) el.classList.toggle('sel', el.dataset.uid === uid);
    this.showInfo(uid ? this.game.pack.get(uid) : null);
  }

  showInfo(it) {
    if (!this.infoEl) return;
    if (!it) { this.infoEl.replaceChildren(h('div', { class: 'muted' }, '點一下魚可以看詳細資料')); return; }
    const fish = this.data.fishById[it.fish.sp];
    this.infoEl.replaceChildren(
      h('div', { style: { fontSize: '14px' } }, fish.name, ' ', h('span', { class: `rar ${fish.rarity}` }, this.ui.rarityNames[fish.rarity])),
      h('div', {}, h('span', { class: 'size' }, it.fish.size), ` ${fmtW(it.fish.w)} kg｜佔 ${it.fish.shape[0]}x${it.fish.shape[1]} 格`),
      h('div', {}, `今日售價 ${fmt(this.game.priceOfItem(it.fish))} 金幣`));
  }

  showTip(el, inst) {
    this.hideTip();
    const fish = this.data.fishById[inst.sp];
    const r = el.getBoundingClientRect();
    const p = this.ui.app.screen.toBase(r.right, r.top);
    this.tip = h('div', { class: 'tip', style: { left: `${Math.min(p.x + 4, this.ui.app.screen.W - 170)}px`, top: `${Math.max(0, p.y - 10)}px` } },
      `${fish.name}｜${inst.size}｜${fmtW(inst.w)}kg｜${fmt(this.game.priceOfItem(inst))} 金幣`);
    this.ui.root.appendChild(this.tip);
  }

  hideTip() { this.tip?.remove(); this.tip = null; }

  // ---------- 拖曳 ----------
  bindDrag(el, getSrc) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 2) return;
      if (this.drag) { // 拿著魚時第二隻手指點一下 → 旋轉
        if (e.pointerId !== this.drag.pointerId) { this.rotateDrag(); e.preventDefault(); }
        return;
      }
      e.preventDefault();
      const src = getSrc();
      const start = { x: e.clientX, y: e.clientY };
      const touch = e.pointerType !== 'mouse';
      const pid = e.pointerId;
      let timer = null;
      let started = false;
      const begin = () => {
        if (started) return;
        started = true;
        const r = el.getBoundingClientRect();
        const s = this.ui.app.screen.scale;
        this.startDrag(src, el, pid, touch, (start.x - r.left) / s, (start.y - r.top) / s, e.clientX, e.clientY);
      };
      if (touch) timer = setTimeout(begin, 200); // 長按 0.2 秒拿起
      const move = (ev) => {
        if (ev.pointerId !== pid) return;
        const d = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
        if (!started && !touch && d > 3) begin();
        if (!started && touch && d > 10) { clearTimeout(timer); cleanup(); }
        if (started) this.moveDrag(ev.clientX, ev.clientY);
      };
      const up = (ev) => {
        if (ev.pointerId !== pid) return;
        clearTimeout(timer);
        cleanup();
        if (started) this.endDrag(ev.clientX, ev.clientY);
        else if (src.kind === 'item') { this.select(src.uid); this.sfx('click'); }
      };
      const cleanup = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
    });
  }

  startDrag(src, el, pointerId, touch, offX, offY, cx, cy) {
    this.hideTip();
    const fish = this.data.fishById[src.fish.sp];
    this.drag = { ...src, el, pointerId, touch, offX, offY, fishDef: fish, target: null };
    el.classList.add('picked');
    this.ghost = h('div', { class: 'drag-ghost' });
    this.ui.root.appendChild(this.ghost);
    this.renderGhost();
    if (src.kind === 'item') this.select(src.uid);
    this.sfx('click');
    this.moveDrag(cx, cy);
    this.keyRotate = (e) => { if (e.key.toLowerCase() === 'r') this.rotateDrag(); };
    addEventListener('keydown', this.keyRotate);
    // 拿著魚時，畫面上任何地方的第二隻手指點擊都可以旋轉
    this.secondTap = (e) => { if (this.drag && e.pointerId !== this.drag.pointerId && e.pointerType !== 'mouse') { this.rotateDrag(); e.preventDefault(); e.stopPropagation(); } };
    addEventListener('pointerdown', this.secondTap, true);
  }

  renderGhost() {
    const d = this.drag;
    const C = this.cell;
    const { w, h: hh } = itemDims(d.fish.shape, d.rot);
    this.ghost.style.width = `${w * C}px`;
    this.ghost.style.height = `${hh * C}px`;
    this.ghost.replaceChildren(pxCanvas(packIcon(d.fishDef, d.fish.shape, C, d.rot)));
    // 旋轉後讓手指仍在魚身上
    d.offX = Math.min(d.offX, w * C - 4);
    d.offY = Math.min(d.offY, hh * C - 4);
  }

  rotateDrag() {
    if (!this.drag) return;
    this.drag.rot = !this.drag.rot;
    this.renderGhost();
    this.sfx('click');
    if (this.lastPointer) this.moveDrag(this.lastPointer.x, this.lastPointer.y);
  }

  moveDrag(cx, cy) {
    const d = this.drag;
    if (!d) return;
    this.lastPointer = { x: cx, y: cy };
    const scr = this.ui.app.screen;
    const p = scr.toBase(cx, cy);
    const lift = d.touch ? 40 : 0; // 觸控：魚顯示在手指上方，不被手指擋住
    const gx = p.x - d.offX, gy = p.y - d.offY - lift;
    this.ghost.style.left = `${gx}px`;
    this.ghost.style.top = `${gy}px`;
    // 目標格子
    const gr = this.gridEl.getBoundingClientRect();
    const g0 = scr.toBase(gr.left, gr.top);
    const C = this.cell;
    const tx = Math.round((gx - g0.x - 2) / C), ty = Math.round((gy - g0.y - 2) / C);
    const P = this.game.pack;
    const { w, h: hh } = itemDims(d.fish.shape, d.rot);
    for (const row of this.cells) for (const c of row) c.classList.remove('ok', 'bad');
    const tr = this.trashEl.getBoundingClientRect();
    const overTrash = d.kind === 'item' && cx >= tr.left && cx <= tr.right && cy - lift * scr.scale >= tr.top - 20 && cy - lift * scr.scale <= tr.bottom + 20;
    this.trashEl.classList.toggle('hot', overTrash);
    d.overTrash = overTrash;
    const inside = tx + w > 0 && ty + hh > 0 && tx < P.cols && ty < P.rows;
    if (!inside || overTrash) { d.target = null; return; }
    const ok = P.canPlace({ uid: d.uid, fish: d.fish }, tx, ty, d.rot);
    for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < w; xx++) {
      const c = this.cells[ty + yy]?.[tx + xx];
      if (c) c.classList.add(ok ? 'ok' : 'bad');
    }
    d.target = { x: tx, y: ty, ok };
  }

  endDrag() {
    const d = this.drag;
    removeEventListener('keydown', this.keyRotate);
    removeEventListener('pointerdown', this.secondTap, true);
    this.ghost?.remove();
    this.drag = null;
    const g = this.game;
    if (d.overTrash) { this.discard(d.uid); return; }
    if (d.target?.ok) {
      if (d.kind === 'item') g.pack.move(d.uid, d.target.x, d.target.y, d.rot);
      else {
        g.pack.place({ uid: d.uid, fish: d.fish }, d.target.x, d.target.y, d.rot);
        g.state.stats.kept++;
        this.finishPending('放進背包了');
      }
      this.sfx('place');
      this.ui.app.save();
    } else if (d.target) this.sfx('error');
    this.rerender();
  }

  rerender() {
    const old = this.el;
    const el = this.render(); // render() 會把 this.el 換成新的元素
    if (old?.isConnected) old.replaceWith(el);
    if (this.ui.panel === 'backpack') this.ui.panelEl = el;
  }

  // ---------- 旋轉、丟棄 ----------
  rotateSelected() {
    const it = this.selected && this.game.pack.get(this.selected);
    if (!it) { this.ui.toast('先點選一條魚'); return; }
    if (this.game.pack.move(it.uid, it.x, it.y, !it.rot)) { this.sfx('place'); this.rerender(); return; }
    this.sfx('error');
    this.ui.toast('這裡轉不過來，先拖到空一點的地方');
  }

  discardSelected() {
    if (!this.selected) { this.ui.toast('先點選一條魚'); return; }
    this.discard(this.selected);
  }

  discard(uid) {
    const g = this.game;
    const it = g.pack.get(uid);
    if (!it) return;
    const fish = this.data.fishById[it.fish.sp];
    const doIt = () => { g.discard(uid); this.selected = null; this.sfx('discard'); this.ui.app.save(); this.rerender(); };
    if (rarityIndex(g.cfg, fish.rarity) >= rarityIndex(g.cfg, 'rare')) this.confirm(`真的要丟掉${this.ui.rarityNames[fish.rarity]}的「${fish.name}」嗎？`, doIt);
    else doIt();
  }

  confirm(text, yes) {
    const box = h('div', { class: 'card', style: { zIndex: 65 }, 'data-test': 'confirm' },
      h('div', { style: { fontSize: '14px' } }, text),
      h('div', { class: 'btns' },
        btn('丟掉', () => { box.remove(); yes(); }, 'danger', { 'data-test': 'btn-confirm-yes' }),
        btn('取消', () => { box.remove(); this.rerender(); }, '', { 'data-test': 'btn-confirm-no' })));
    this.ui.root.appendChild(box);
  }

  // ---------- 整理中的新漁獲 ----------
  placePendingAuto() {
    const inst = this.pending.res.instance;
    if (this.game.keep(inst)) { this.sfx('place'); this.finishPending('放進背包了'); this.rerender(); }
    else { this.sfx('error'); this.ui.toast('還是放不下，再騰出一點空間'); }
  }

  releasePending() {
    this.game.release();
    this.sfx('discard');
    this.finishPending('放生了');
    this.rerender();
  }

  finishPending(msg) {
    const p = this.pending;
    this.pending = null;
    this.ui.toast(`${p.res.fish.name} ${msg}`);
    p.onDone();
  }

  onClose() {
    this.hideTip();
    // 還沒處理的新漁獲：重新顯示漁獲卡（重新判斷背包是否放得下）
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      this.ui.card?.remove();
      this.ui.card = null;
      setTimeout(() => this.ui.showCard(p.res, { ...p.rec, newSpecies: false, newRecord: false }), 0);
    }
  }

  onKey(e) {
    const k = e.key.toLowerCase();
    if (k === 'r' && !this.drag) this.rotateSelected();
    if (k === 'delete' || k === 'backspace') this.discardSelected();
  }
}
