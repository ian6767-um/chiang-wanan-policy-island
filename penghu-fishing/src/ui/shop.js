// 海口釣具行：阿月嬤＋分頁商店（釣竿、魚餌、船、背包）。
import { h, btn, pxCanvas, fmt, pick, onSwipe } from './dom.js';
import { portrait } from '../render/portraits.js';
import { icon } from '../render/icons.js';
import { thumbArt } from '../render/fishart.js';

const TABS = [['rod', '釣竿'], ['bait', '魚餌'], ['boat', '船'], ['backpack', '背包']];

export class ShopPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.data = ui.data;
    this.pauses = true;
    this.tab = 'rod';
    this.line = null;
  }

  canOpen() {
    if (!this.game.atHarbor) { this.ui.toast('要回到馬公第三漁港才能去釣具店'); return false; }
    return true;
  }

  say(kind) { this.line = pick(this.data.dialog.shop[kind]); }

  render() {
    const g = this.game;
    if (!this.line) this.say(Math.random() < 0.5 ? 'greet' : 'idle');
    this.canvas = pxCanvas(portrait('shop', 0, false, 0, [this.data.fishById.f31.art]));
    this.canvas.addEventListener('click', () => { this.say('idle'); this.talk = 8; this.bubble.textContent = this.line; });
    this.bubble = h('div', { class: 'bubble', 'data-test': 'shop-say' }, this.line);
    const list = h('div', { class: 'items scroll', style: { maxHeight: '250px' }, 'data-test': 'shop-items' }, this.items());
    onSwipe(list, (dir) => this.switchTab(dir));
    const el = h('div', { class: 'panel wood', 'data-test': 'panel-shop' },
      h('div', { class: 'panel-head' },
        pxCanvas(icon('shop'), 32, 32), h('h2', {}, '海口釣具行'),
        h('div', { class: 'tabs' }, TABS.map(([id, name]) => btn(name, () => { this.tab = id; this.ui.refreshPanel(); }, this.tab === id ? 'sel' : '', { 'data-test': `tab-${id}` }))),
        h('span', { class: 'spacer' }),
        h('span', { class: 'chip coins' }, pxCanvas(icon('coin')), fmt(g.state.coins)),
        btn('離開', () => this.ui.close(), 'close', { 'data-test': 'btn-close' })),
      h('div', { class: 'panel-body' },
        h('div', { class: 'portrait' }, this.canvas, this.bubble),
        h('div', { class: 'col', style: { flex: 1, minWidth: 0 } }, list, h('div', { class: 'muted' }, '左右滑動或按 Q／E 切換分頁'))));
    this.el = el;
    this.startAnim();
    return el;
  }

  switchTab(dir) {
    const i = TABS.findIndex(([id]) => id === this.tab);
    this.tab = TABS[(i + dir + TABS.length) % TABS.length][0];
    this.ui.sfx('click');
    this.ui.refreshPanel();
  }

  onKey(e) {
    const k = e.key.toLowerCase();
    if (k === 'q') this.switchTab(-1);
    if (k === 'e') this.switchTab(1);
  }

  items() {
    const g = this.game;
    const D = this.data;
    if (this.tab === 'rod') {
      return D.rods.map((r) => this.card('rod', r.id, r.name, r.desc, r.price, `拉力 ${g.rod.pull}kg → ${r.pull}kg`, 'rod', g.state.rod === r.id));
    }
    if (this.tab === 'bait') {
      return D.baits.map((b) => {
        const fish = D.fish.filter((f) => f.baits.includes(b.id));
        const icons = h('div', { class: 'fishicons' }, fish.map((f) => {
          const e = g.state.codex[f.id];
          return pxCanvas(thumbArt(f, !(e && e.caught)));
        }));
        return this.card('bait', b.id, b.name, b.desc, b.price, [`適合體型：${b.sizes}｜有效魚種 ${fish.length} 種`, icons], 'bait', g.state.bait === b.id);
      });
    }
    if (this.tab === 'boat') {
      return D.boats.map((b) => this.card('boat', b.id, b.name, b.desc, b.price,
        `可前往：${b.regions.map((r) => D.regionById[r].name).join('、')}`, 'boat', false));
    }
    const cur = D.backpackByLevel[g.state.packLevel];
    return D.backpacks.map((p) => this.card('backpack', p.level, `背包 ${p.rows}x${p.cols}`, `${p.rows * p.cols} 格`, p.price,
      `${cur.rows}x${cur.cols} → ${p.rows}x${p.cols}`, 'backpack', false));
  }

  card(kind, id, name, desc, price, stat, ic, equipped) {
    const g = this.game;
    const owned = g.owns(kind, id);
    const chk = g.canBuy(kind, id);
    let action;
    if (owned) {
      if (kind === 'rod' || kind === 'bait') {
        action = equipped ? h('span', { class: 'muted' }, '已裝備') : btn('裝備', () => { g.equip(kind, id); this.ui.sfx('place'); this.ui.refreshPanel(); }, '', { 'data-test': `equip-${id}` });
      } else action = h('span', { class: 'muted' }, kind === 'backpack' && g.state.packLevel !== id ? '已擁有（舊）' : '已擁有');
    } else {
      action = btn('購買', () => this.buy(kind, id), chk.ok ? 'primary' : 'disabled', { 'data-test': `buy-${kind}-${id}` });
    }
    const need = !owned && (chk.reason === 'locked' || chk.reason === 'prev') ? h('div', { class: 'need' }, chk.text) : null;
    return h('div', { class: `item-card${owned ? ' owned' : ''}${!owned && chk.reason === 'poor' ? ' poor' : ''}`, 'data-test': 'shop-item' },
      pxCanvas(icon(ic), 32, 32),
      h('div', { class: 'grow' },
        h('div', { class: 'name' }, name),
        h('div', { class: 'desc' }, desc),
        h('div', { class: 'stat' }, stat),
        need),
      h('div', { class: 'col', style: { alignItems: 'flex-end' } },
        price > 0 && !owned ? h('span', { class: 'price' }, pxCanvas(icon('coin')), fmt(price)) : h('span', { class: 'price' }, price === 0 ? '初始' : ''),
        action));
  }

  buy(kind, id) {
    const g = this.game;
    const r = g.buy(kind, id);
    if (!r.ok) {
      this.ui.sfx('error');
      this.say(r.reason === 'poor' ? 'poor' : 'locked');
    } else {
      this.ui.sfx('coin');
      this.say('buy');
      const item = g.shopItem(kind, id);
      if (kind === 'rod' || kind === 'bait') { g.equip(kind, id); this.ui.toast(`買了${item.name}，已直接裝備`); }
      else if (kind === 'boat') this.ui.toast(`買了${item.name}！可以去更遠的海域了`);
      else this.ui.toast(`背包升級為 ${item.rows}x${item.cols}`);
      this.ui.app.save();
    }
    this.talk = 8;
    this.ui.refreshPanel();
  }

  startAnim() {
    clearInterval(this.anim);
    let f = 0;
    if (this.talk === undefined) this.talk = 8;
    this.anim = setInterval(() => {
      if (!this.canvas.isConnected) { clearInterval(this.anim); return; }
      f++;
      if (this.talk > 0) this.talk--;
      const p = portrait('shop', Math.floor(f / 3) % 4, f % 30 === 0, this.talk > 0 ? [1, 2, 0][f % 3] : 0, [this.data.fishById.f31.art]);
      this.canvas.getContext('2d').drawImage(p.c, 0, 0);
    }, 160);
  }

  onClose() { clearInterval(this.anim); this.line = null; this.talk = undefined; }
}
