// 馬公第三漁港魚市：阿伯、背包格子、售價清單、每日魚價。
import { h, btn, pxCanvas, fmt, fmtW, pick } from './dom.js';
import { packIcon, codexArt } from '../render/fishart.js';
import { portrait } from '../render/portraits.js';
import { icon } from '../render/icons.js';
import { itemDims } from '../core/backpack.js';

const MCELL = 24; // 魚市裡的格子小一點（美術規格每格 24x24）

export class MarketPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.data = ui.data;
    this.pauses = true;
    this.sel = new Set();
    this.line = null;
  }

  canOpen() {
    if (!this.game.atHarbor) { this.ui.toast('要回到馬公第三漁港才能賣魚'); return false; }
    return true;
  }

  render() {
    const g = this.game;
    const m = g.market();
    const d = this.data.dialog.market;
    if (!this.line) this.line = g.pack.items.length ? pick(d.greet) : pick(d.empty);
    this.canvas = pxCanvas(portrait('market', 0, false, 0, this.stallArts()));
    this.bubble = h('div', { class: 'bubble', 'data-test': 'market-say' }, this.line);
    const hot = m.hot.map((id) => this.data.fishById[id].name).join('、');
    const grid = this.gridView();
    const list = this.listView();
    const total = [...this.sel].reduce((s, uid) => { const it = g.pack.get(uid); return s + (it ? g.priceOfItem(it.fish) : 0); }, 0);
    const el = h('div', { class: 'panel', 'data-test': 'panel-market' },
      h('div', { class: 'panel-head' },
        pxCanvas(icon('market'), 32, 32), h('h2', {}, '魚市'),
        h('span', { class: 'muted' }, `第 ${g.day} 天｜今日熱門（價格 ×${this.ui.cfg.market.hotMult}）：${hot || '無'}`),
        h('span', { class: 'spacer' }),
        h('span', { class: 'chip coins', 'data-test': 'market-coins' }, pxCanvas(icon('coin')), fmt(g.state.coins)),
        btn('離開', () => this.ui.close(), 'close', { 'data-test': 'btn-close' })),
      h('div', { class: 'panel-body' },
        h('div', { class: 'portrait' }, this.canvas, this.bubble),
        h('div', { class: 'col' }, grid, h('div', { class: 'muted' }, `點魚可以多選｜已選 ${this.sel.size} 條，${fmt(total)} 金幣`)),
        h('div', { class: 'col', style: { flex: 1, minWidth: 0 } },
          h('div', { class: 'sell-list scroll', style: { maxHeight: '170px' } }, list),
          h('div', { class: 'col' },
            btn(`賣出選取（${this.sel.size}）`, () => this.sellSel(), 'primary', { disabled: !this.sel.size, 'data-test': 'btn-sell-sel' }),
            btn('全部賣出', () => this.sellAll(false), '', { disabled: !g.pack.items.length, 'data-test': 'btn-sell-all' }),
            btn('全部賣出（保留稀有以上）', () => this.sellAll(true), '', { disabled: !g.pack.items.length, 'data-test': 'btn-sell-common' })))));
    this.el = el;
    this.startAnim();
    return el;
  }

  stallArts() {
    return this.data.fish.filter((f) => ['f20', 'f05', 'f18', 'f23', 'f27'].includes(f.id)).map((f) => f.art);
  }

  gridView() {
    const g = this.game;
    const P = g.pack;
    const grid = h('div', { class: 'grid', style: { width: `${P.cols * MCELL + 4}px`, height: `${P.rows * MCELL + 4}px` }, 'data-test': 'market-grid' });
    for (let y = 0; y < P.rows; y++) for (let x = 0; x < P.cols; x++) grid.appendChild(h('div', { class: 'cell', style: { left: `${x * MCELL}px`, top: `${y * MCELL}px`, width: `${MCELL}px`, height: `${MCELL}px` } }));
    for (const it of P.items) {
      const { w, h: hh } = itemDims(it.fish.shape, it.rot);
      const fish = this.data.fishById[it.fish.sp];
      grid.appendChild(h('div', {
        class: `item${this.sel.has(it.uid) ? ' sel' : ''}`, 'data-uid': it.uid,
        style: { left: `${it.x * MCELL}px`, top: `${it.y * MCELL}px`, width: `${w * MCELL}px`, height: `${hh * MCELL}px`, cursor: 'pointer' },
        onClick: () => this.toggle(it.uid),
      }, pxCanvas(packIcon(fish, it.fish.shape, MCELL, it.rot))));
    }
    return grid;
  }

  listView() {
    const g = this.game;
    const m = g.market();
    if (!g.pack.items.length) return [h('div', { class: 'muted' }, '背包是空的')];
    return g.pack.items
      .slice()
      .sort((a, b) => g.priceOfItem(b.fish) - g.priceOfItem(a.fish))
      .map((it) => {
        const fish = this.data.fishById[it.fish.sp];
        const mult = m.mult[fish.id];
        return h('div', { class: `sell-row${this.sel.has(it.uid) ? ' sel' : ''}`, 'data-test': 'sell-row', onClick: () => this.toggle(it.uid) },
          pxCanvas(codexArt(fish), 32, 16), h('span', {}, fish.name), h('span', { class: 'size' }, it.fish.size), h('span', { class: 'muted' }, `${fmtW(it.fish.w)}kg`),
          m.hot.includes(fish.id) ? h('span', { class: 'hot' }, '熱門') : h('span', { class: 'muted' }, `×${mult.toFixed(2)}`),
          h('span', { class: 'p' }, `${fmt(g.priceOfItem(it.fish))}`));
      });
  }

  toggle(uid) {
    if (this.sel.has(uid)) this.sel.delete(uid); else this.sel.add(uid);
    this.ui.sfx('click');
    this.ui.refreshPanel();
  }

  sellSel() { this.doSell(() => this.game.sell([...this.sel])); }
  sellAll(keepRare) { this.doSell(() => this.game.sellAll(keepRare)); }

  doSell(fn) {
    const g = this.game;
    const rare = g.pack.items.filter((it) => (this.sel.size ? this.sel.has(it.uid) : true) && ['rare', 'legendary'].includes(this.data.fishById[it.fish.sp].rarity));
    const r = fn();
    this.sel.clear();
    if (!r.count) { this.ui.toast('沒有可以賣的魚'); return; }
    const d = this.data.dialog.market;
    this.line = rare.length ? pick(d.rare).replace('{name}', this.data.fishById[rare[0].fish.sp].name) : pick(d.sold);
    this.ui.toast(`賣出 ${r.count} 條，獲得 ${fmt(r.coins)} 金幣`);
    this.ui.app.save();
    const from = this.el.querySelector('[data-test=market-grid]').getBoundingClientRect();
    this.ui.refreshPanel();
    this.coinBurst(from, Math.min(12, 3 + r.count));
  }

  /** 金幣飛向金幣欄的動畫＋音效 */
  coinBurst(fromRect, n) {
    const scr = this.ui.app.screen;
    const a = scr.toBase(fromRect.left + fromRect.width / 2, fromRect.top + fromRect.height / 2);
    const target = this.ui.root.querySelector('[data-test=market-coins]')?.getBoundingClientRect();
    const b = target ? scr.toBase(target.left + 8, target.top + 4) : { x: 20, y: 10 };
    for (let i = 0; i < n; i++) {
      const c = h('div', { class: 'coinfly', style: { left: `${a.x + (i % 4) * 6 - 12}px`, top: `${a.y + Math.floor(i / 4) * 6}px` } }, pxCanvas(icon('coin')));
      this.ui.root.appendChild(c);
      setTimeout(() => { c.style.left = `${b.x}px`; c.style.top = `${b.y}px`; }, 30 + i * 60);
      setTimeout(() => { c.remove(); this.ui.sfx('coin'); }, 760 + i * 60);
    }
  }

  /** 阿伯的閒置動畫：呼吸、眨眼、說話 */
  startAnim() {
    clearInterval(this.anim);
    let f = 0;
    const talkUntil = 8;
    this.anim = setInterval(() => {
      if (!this.canvas.isConnected) { clearInterval(this.anim); return; }
      f++;
      const breath = Math.floor(f / 3) % 4;
      const blink = f % 28 === 0;
      const talk = f < talkUntil ? [1, 2, 0][f % 3] : 0;
      const p = portrait('market', breath, blink, talk, this.stallArts());
      const ctx = this.canvas.getContext('2d');
      ctx.drawImage(p.c, 0, 0);
    }, 160);
  }

  onClose() { clearInterval(this.anim); this.line = null; this.sel.clear(); }
}
