// 介面總管：HUD、提示、面板切換、漁獲卡、離線摘要、標題與結局畫面。
import { h, btn, pxCanvas, fmt, fmtW, pick } from './dom.js';
import { icon, SEASON_ICON, WEATHER_ICON } from '../render/icons.js';
import { codexArt, thumbArt } from '../render/fishart.js';
import { formatClock, PHASE_NAMES, WEATHER_NAMES } from '../core/clock.js';
import { anyFishFor } from '../core/fishing.js';
import { BackpackPanel } from './backpack.js';
import { MarketPanel } from './market.js';
import { ShopPanel } from './shop.js';
import { MapPanel } from './map.js';
import { CodexPanel } from './codex.js';
import { SettingsPanel } from './settings.js';
import { DebugPanel } from './debug.js';

export class UI {
  constructor(app) {
    this.app = app;
    this.game = app.game;
    this.data = app.game.data;
    this.cfg = app.game.cfg;
    this.root = app.uiRoot;
    this.panel = null;
    this.card = null;
    this.hudEls = {};
    this.root.innerHTML = '';
    this.buildHud();
    this.panels = {
      backpack: new BackpackPanel(this),
      market: new MarketPanel(this),
      shop: new ShopPanel(this),
      map: new MapPanel(this),
      codex: new CodexPanel(this),
      settings: new SettingsPanel(this),
    };
    this.debug = new DebugPanel(this);
    this.game.on((type, p) => this.onGameEvent(type, p));
    this.bindKeys();
  }

  get rarityNames() { return this.cfg.rarity.names; }
  sfx(n) { this.app.audio.play(n); }

  // ---------------- HUD ----------------
  buildHud() {
    const R = this.root;
    const coins = h('div', { class: 'chip coins', 'data-test': 'coins' }, pxCanvas(icon('coin')), h('span', {}, '0'));
    const clock = h('div', { class: 'chip', 'data-test': 'clock' });
    const spot = h('div', { class: 'chip', 'data-test': 'spot' });
    const tl = h('div', { class: 'hud hud-tl' }, coins, clock, spot);
    const ib = (name, label, fn, test) => h('button', { class: 'btn ibtn', type: 'button', title: label, 'aria-label': label, 'data-test': test, onClick: () => { this.sfx('click'); fn(); } }, pxCanvas(icon(name)));
    const tr = h('div', { class: 'hud hud-tr' },
      ib('map', '地圖（M）', () => this.toggle('map'), 'btn-map'),
      ib('book', '圖鑑（C）', () => this.toggle('codex'), 'btn-codex'),
      ib('gear', '設定', () => this.toggle('settings'), 'btn-settings'));
    const packBadge = h('span', { class: 'badge' }, '0/24');
    const packBtn = ib('backpack', '背包（B）', () => this.toggle('backpack'), 'btn-backpack');
    packBtn.appendChild(packBadge);
    const gearBtn = ib('rod', '釣竿與魚餌', () => this.toggleGear(), 'btn-gear');
    const br = h('div', { class: 'hud hud-br' }, gearBtn, packBtn);
    const status = h('div', { class: 'status', 'data-test': 'status' }, '');
    const resumeBtn = btn('繼續釣魚', () => this.resumeFishing(), 'primary', { 'data-test': 'btn-resume', hidden: true });
    const bl = h('div', { class: 'hud hud-bl' }, status, resumeBtn);
    const marketBtn = btn([pxCanvas(icon('market')), '魚市'], () => this.open('market'), 'big', { 'data-test': 'btn-market' });
    const shopBtn = btn([pxCanvas(icon('shop')), '釣具店'], () => this.open('shop'), 'big', { 'data-test': 'btn-shop' });
    const bc = h('div', { class: 'hud hud-bc' }, marketBtn, shopBtn);
    this.toastBox = h('div', { class: 'toasts' });
    this.catSay = h('div', { class: 'catsay', hidden: true });
    this.hudLayer = h('div', { class: 'hudlayer' }, tl, tr, br, bl, bc, this.catSay);
    R.append(this.hudLayer, this.toastBox);
    Object.assign(this.hudEls, { coins: coins.querySelector('span'), clock, spot, packBadge, status, resumeBtn, bc });
    this.lastHud = {};
  }

  /** 每一幀呼叫，只在數值變化時改 DOM */
  updateHud() {
    const g = this.game;
    const E = this.hudEls;
    const set = (k, v, fn) => { if (this.lastHud[k] !== v) { this.lastHud[k] = v; fn(v); } };
    set('coins', g.state.coins, (v) => { E.coins.textContent = fmt(v); });
    const season = g.season();
    const weather = g.weather();
    const clk = `${formatClock(g.minutes)}|${g.phase()}|${weather}|${season}|${g.day}`;
    set('clock', clk, () => {
      E.clock.replaceChildren(
        pxCanvas(icon(g.phase() === 'night' ? 'moon' : 'sun')), `第 ${g.day} 天 ${formatClock(g.minutes)} ${PHASE_NAMES[g.phase()]}`,
        pxCanvas(icon(WEATHER_ICON[weather])), WEATHER_NAMES[weather],
        ...(season ? [pxCanvas(icon(SEASON_ICON[season])), this.cfg.seasons.names[season]] : []));
    });
    set('spot', g.state.spot + g.state.bait + g.state.rod, () => {
      E.spot.textContent = `${g.region.name}・${g.spot.name}｜${g.rod.name}（${g.rod.pull}kg）｜${g.bait.name}`;
    });
    set('pack', `${g.pack.usedCells}/${g.pack.totalCells}`, (v) => {
      E.packBadge.textContent = v;
      E.packBadge.classList.toggle('full', !g.pack.findSpot({ uid: '_', fish: { shape: [1, 1] } }));
    });
    set('harbor', g.atHarbor, (v) => { E.bc.hidden = !v; });
    const w = this.app.world;
    let st = '';
    let warn = false;
    if (w.travel) st = '航行中…';
    else if (w.state === 'stopped') { st = '背包滿了，已停止釣魚'; warn = true; }
    else if (w.state === 'empty') { st = this.emptyHint(); warn = true; }
    else if (w.state === 'wait' || w.state === 'cast') st = '等魚上鉤…';
    else if (w.state === 'approach') st = '有魚靠近了…';
    else if (w.state === 'bite' || w.state === 'reel') st = '上鉤了！收線中';
    set('status', st + warn, () => { E.status.textContent = st; E.status.classList.toggle('warn', warn); E.status.hidden = !st; });
    set('resume', w.state === 'stopped', (v) => { E.resumeBtn.hidden = !v; });
    // 小卷貓的對話框
    const c = w.cat;
    if (c.sayT > 0 && c.say) {
      const r = w.catRect();
      this.catSay.hidden = false;
      this.catSay.textContent = c.say;
      this.catSay.style.left = `${r.x + 10}px`;
      this.catSay.style.top = `${r.y - 4}px`;
    } else this.catSay.hidden = true;
  }

  emptyHint() {
    const g = this.game;
    const any = anyFishFor(this.data, g.state.spot, g.state.bait);
    if (!any.length) return `這裡沒有魚吃「${g.bait.name}」，換個餌或釣點吧`;
    return `現在這個時段／天氣沒有魚吃「${g.bait.name}」`;
  }

  toast(text) {
    const t = h('div', { class: 'toast' }, text);
    this.toastBox.appendChild(t);
    while (this.toastBox.children.length > 3) this.toastBox.firstChild.remove();
    setTimeout(() => t.remove(), 3300);
  }

  // ---------------- 面板 ----------------
  open(name) {
    if (this.card && name !== 'backpack') return; // 漁獲卡還沒處理
    if (this.panel === name) return;
    this.close(true);
    const p = this.panels[name];
    if (p.canOpen && !p.canOpen()) return;
    this.panel = name;
    if (this.card) this.card.style.display = 'none';
    if (this.gearEl) this.toggleGear();
    this.veil = h('div', { class: 'veil', onClick: () => this.close() });
    this.panelEl = p.render();
    this.root.append(this.veil, this.panelEl);
    this.app.world.paused = !!p.pauses;
    this.sfx(name === 'shop' ? 'door' : 'click');
    if (name === 'shop') this.app.audio.setTrack('shop');
  }

  close(silent = false) {
    if (!this.panel) return;
    const p = this.panels[this.panel];
    p.onClose?.();
    this.veil?.remove();
    this.panelEl?.remove();
    this.panel = null;
    this.app.world.paused = false;
    this.app.updateTrack();
    if (!silent) this.sfx('click');
    if (this.card) this.card.style.display = '';
  }

  toggle(name) { if (this.panel === name) this.close(); else this.open(name); }

  /** 重新繪製目前開著的面板（買東西、賣魚之後） */
  refreshPanel() {
    if (!this.panel) return;
    const p = this.panels[this.panel];
    const el = p.render();
    this.panelEl.replaceWith(el);
    this.panelEl = el;
  }

  // ---------------- 釣竿與魚餌快速切換 ----------------
  toggleGear() {
    if (this.gearEl) { this.gearEl.remove(); this.gearEl = null; return; }
    const g = this.game;
    const rods = this.data.rods.filter((r) => g.owns('rod', r.id));
    const baits = this.data.baits.filter((b) => g.owns('bait', b.id));
    const el = h('div', { class: 'panel', style: { left: 'auto', width: '300px', top: 'auto', height: 'auto', bottom: 'calc(52px + var(--sb))' }, 'data-test': 'gear-panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, '釣竿與魚餌'), h('span', { class: 'spacer' }), btn('關閉', () => this.toggleGear(), 'close')),
      h('div', { class: 'col', style: { padding: '0 8px 8px' } },
        h('div', { class: 'muted' }, '釣竿（拉力上限）'),
        h('div', { class: 'seg' }, rods.map((r) => btn(`${r.name} ${r.pull}kg`, () => { g.equip('rod', r.id); this.toggleGear(); this.toggleGear(); }, g.state.rod === r.id ? 'sel' : ''))),
        h('div', { class: 'muted' }, '魚餌（買一次永久可用）'),
        h('div', { class: 'seg' }, baits.map((b) => btn(b.name, () => { g.equip('bait', b.id); this.toggleGear(); this.toggleGear(); }, g.state.bait === b.id ? 'sel' : '', { 'data-bait': b.id }))),
        h('div', { class: 'muted' }, anyFishFor(this.data, g.state.spot, g.state.bait).length ? `這裡吃「${g.bait.name}」的魚：${anyFishFor(this.data, g.state.spot, g.state.bait).map((f) => g.codexEntry(f.id).caught ? f.name : '？？？').join('、')}` : `這裡沒有魚吃「${g.bait.name}」`)));
    this.gearEl = el;
    this.root.appendChild(el);
  }

  // ---------------- 遊戲事件 ----------------
  onGameEvent(type, p) {
    if (type === 'milestone') { this.toast(`圖鑑收集 ${p.count} 種！獎勵 ${fmt(p.coins)} 金幣`); this.sfx('record'); }
    if (type === 'ending') setTimeout(() => this.showEnding(), 1500);
    if (type === 'equip' && this.gearEl) { /* 重新整理由呼叫端處理 */ }
  }

  /** 世界通知：釣到魚 */
  handleCatch(res) {
    const g = this.game;
    const inst = res.instance;
    const rec = g.recordCatch(inst);
    this.sfx(res.fish.rarity);
    if (rec.newRecord) setTimeout(() => this.sfx('record'), 500);
    // 自動規則：低於設定稀有度自動放生
    if (g.autoRelease(inst)) {
      g.release();
      this.toast(`自動放生：${res.fish.name}（${inst.size}，${fmtW(inst.w)}kg）`);
      this.app.save();
      setTimeout(() => this.app.world.resume(), 900);
      return;
    }
    const fits = g.canKeep(inst);
    if (!fits && g.state.rules.whenFull === 'release') {
      g.release();
      this.toast(`背包已滿，自動放生：${res.fish.name}`);
      setTimeout(() => this.app.world.resume(), 900);
      return;
    }
    if (!fits && g.state.rules.whenFull === 'stop') {
      g.release();
      this.toast(`背包已滿，停止釣魚（放掉了 ${res.fish.name}）`);
      this.app.world.stop();
      this.app.save();
      return;
    }
    this.showCard(res, rec);
  }

  handleBroke(res) {
    const g = this.game;
    g.recordSeen(res.instance);
    this.toast(`斷線了！有條大魚跑掉了（約 ${fmtW(res.instance.w)}kg，超過 ${g.rod.pull}kg 拉力）`);
  }

  // ---------------- 漁獲卡 ----------------
  showCard(res, rec) {
    const g = this.game;
    const inst = res.instance;
    const fish = res.fish;
    const fits = g.canKeep(inst);
    const ribbonColor = { common: '#9a8f92', uncommon: '#4f7d43', rare: '#4f86b8', legendary: '#e9a23b' }[fish.rarity];
    const art = pxCanvas(codexArt(fish));
    const auto = h('div', { class: 'auto' });
    const close = () => { clearInterval(this.cardTimer); this.card?.remove(); this.card = null; };
    const keep = () => {
      if (g.keep(inst)) { this.sfx('place'); close(); this.app.save(); this.app.world.resume(); }
      else { this.sfx('error'); close(); this.showCard(res, rec); }
    };
    const release = () => { g.release(); this.sfx('discard'); close(); this.app.save(); this.app.world.resume(); };
    const organize = () => {
      clearInterval(this.cardTimer);
      this.card.style.display = 'none';
      this.panels.backpack.pending = { res, rec, onDone: () => { close(); this.app.save(); this.app.world.resume(); } };
      this.open('backpack');
    };
    const card = h('div', { class: 'card', 'data-test': 'catch-card' },
      h('div', { class: 'ribbon', style: { background: ribbonColor, color: fish.rarity === 'legendary' ? '#1c1418' : '#fff8ec' } }, `${this.rarityNames[fish.rarity]}`),
      h('div', { class: 'fishbox' }, art),
      h('h3', {}, fish.name),
      h('div', { class: 'stats' }, h('span', { class: 'size' }, inst.size), `${fmtW(inst.w)} kg`, h('span', { class: 'muted' }, `預估售價 ${fmt(g.priceOfItem(inst))} 金幣`)),
      rec.newSpecies ? h('div', { class: 'flag new' }, '新魚種！已記入圖鑑') : null,
      rec.newRecord ? h('div', { class: 'flag' }, '新紀錄！') : null,
      fits ? null : h('div', { class: 'full' }, '背包已滿'),
      h('div', { class: 'btns' },
        fits ? btn('保留', keep, 'primary', { 'data-test': 'btn-keep' }) : btn('打開背包整理', organize, 'primary', { 'data-test': 'btn-organize' }),
        btn(fits ? '放生' : '放生這條', release, '', { 'data-test': 'btn-release' })),
      auto);
    this.card = card;
    this.root.appendChild(card);
    // 放置用：一段時間沒操作就自動保留（背包放得下時）
    if (g.state.settings.autoKeep && fits) {
      let left = this.cfg.autoKeepSeconds;
      auto.textContent = `${left} 秒後自動保留`;
      this.cardTimer = setInterval(() => {
        if (this.app.paused) return;
        left--;
        auto.textContent = `${left} 秒後自動保留`;
        if (left <= 0) keep();
      }, 1000);
    }
  }

  resumeFishing() {
    if (!this.game.canKeep({ uid: '_', shape: [1, 1] })) { this.toast('背包還是滿的，先去整理或賣魚吧'); }
    this.app.world.resume();
  }

  // ---------------- 離線摘要 ----------------
  showOffline(sum) {
    const hours = Math.floor(sum.seconds / 3600), mins = Math.floor((sum.seconds % 3600) / 60);
    const kept = sum.kept.slice(0, 24);
    const el = h('div', { class: 'card', 'data-test': 'offline' },
      h('h3', {}, '你不在的時候……'),
      h('div', { class: 'muted' }, `離開了 ${hours ? `${hours} 小時 ` : ''}${mins} 分鐘${sum.rawSeconds > sum.seconds ? `（最多計算 ${this.cfg.offline.maxHours} 小時）` : ''}`),
      h('div', {}, `釣到 ${sum.caught} 條，保留 ${sum.kept.length} 條，放生 ${sum.released + sum.autoReleased} 條，斷線 ${sum.broke} 次`),
      kept.length ? h('div', { class: 'fishicons', style: { justifyContent: 'center' } }, kept.map((i) => pxCanvas(thumbArt(this.data.fishById[i.sp])))) : null,
      sum.newSpecies.length ? h('div', { class: 'flag new' }, `新魚種：${sum.newSpecies.map((id) => this.data.fishById[id].name).join('、')}`) : null,
      h('div', { class: sum.stoppedFull ? 'full' : 'muted' }, sum.stoppedFull ? '背包滿了，小卷和你在船上睡著了。' : `背包 ${this.game.pack.usedCells}/${this.game.pack.totalCells} 格`),
      h('div', { class: 'btns' }, btn('好', () => { el.remove(); if (sum.stoppedFull) this.app.world.stop(); }, 'primary', { 'data-test': 'btn-offline-ok' })));
    this.root.appendChild(el);
  }

  // ---------------- 結局 ----------------
  showEnding() {
    this.close(true);
    this.app.showEnding();
  }

  bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (this.gearEl) this.toggleGear(); else this.close(); }
      if (this.app.titleShown) return;
      if (k === 'b') this.toggle('backpack');
      else if (k === 'm') this.toggle('map');
      else if (k === 'c') this.toggle('codex');
      else if (k === '`') this.debug.toggle();
      else if (this.panel && this.panels[this.panel].onKey) this.panels[this.panel].onKey(e);
      else if (this.card && (k === 'k' || k === 'enter')) this.card.querySelector('[data-test=btn-keep]')?.click();
      else if (this.card && k === 'x') this.card.querySelector('[data-test=btn-release]')?.click();
    });
  }
}

export { pick };
