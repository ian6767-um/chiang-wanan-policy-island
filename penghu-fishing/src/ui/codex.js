// 魚類圖鑑：筆記本左右兩頁。右頁魚格子（依釣點／稀有度／名稱排序），左頁詳細資料與最大紀錄。
import { h, btn, pxCanvas, fmtW, onSwipe } from './dom.js';
import { codexArt, thumbArt } from '../render/fishart.js';
import { icon } from '../render/icons.js';
import { PHASE_NAMES, WEATHER_NAMES } from '../core/clock.js';

const SORTS = [['spot', '依釣點'], ['rarity', '依稀有度'], ['name', '依名稱']];
const TIME_NAMES = { all: '全天', ...PHASE_NAMES };

export class CodexPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.data = ui.data;
    this.pauses = false;
    this.sort = 'spot';
    this.sel = null;
  }

  render() {
    const g = this.game;
    const total = this.data.fish.length;
    const n = g.caughtSpecies();
    const right = h('div', { class: 'page' },
      h('div', { class: 'row' }, h('span', { style: { fontSize: '16px' }, 'data-test': 'codex-count' }, `${n} / ${total}`),
        h('span', { class: 'spacer', style: { flex: 1 } }),
        SORTS.map(([id, name]) => btn(name, () => { this.sort = id; this.ui.refreshPanel(); }, this.sort === id ? 'sel' : ''))),
      h('div', { class: 'codex-grid scroll', style: { flex: 1 }, 'data-test': 'codex-grid' }, this.grid()));
    const left = h('div', { class: 'page left scroll', 'data-test': 'codex-detail' }, this.detail());
    const book = h('div', { class: 'book' }, left, right);
    onSwipe(book, (dir) => this.step(dir));
    const next = this.data.config.milestones.find((m) => n < m.count);
    return h('div', { class: 'panel', 'data-test': 'panel-codex' },
      h('div', { class: 'panel-head' }, pxCanvas(icon('book'), 32, 32), h('h2', {}, '魚類圖鑑'),
        h('span', { class: 'muted' }, next ? `下一個里程碑：${next.count} 種（獎勵 ${next.coins.toLocaleString()} 金幣）` : '全部收集完成！'),
        h('span', { class: 'spacer' }),
        g.state.ended ? btn('結局畫面', () => { this.ui.close(true); this.ui.app.showEnding(); }) : null,
        btn('關閉', () => this.ui.close(), 'close', { 'data-test': 'btn-close' })),
      h('div', { class: 'panel-body' }, book));
  }

  ordered() {
    const list = this.data.fish.slice();
    const r = this.data.config.rarity.order;
    if (this.sort === 'rarity') list.sort((a, b) => r.indexOf(b.rarity) - r.indexOf(a.rarity) || a.id.localeCompare(b.id));
    else if (this.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    return list;
  }

  grid() {
    const g = this.game;
    const out = [];
    const cell = (f) => {
      const e = g.state.codex[f.id];
      const state = e?.caught ? 'caught' : e?.seen ? 'seen' : 'none';
      const b = h('button', { class: `cfish${this.sel === f.id ? ' sel' : ''}`, type: 'button', title: state === 'caught' ? f.name : '？？？', 'data-test': `codex-${f.id}`, 'data-state': state, onClick: () => { this.sel = f.id; this.ui.sfx('click'); this.ui.refreshPanel(); } },
        state === 'none' ? null : pxCanvas(thumbArt(f, state === 'seen')),
        state === 'seen' ? h('span', { class: 'q' }, '?') : null);
      return b;
    };
    if (this.sort === 'spot') {
      for (const s of this.data.spots) {
        const fish = this.data.fish.filter((f) => f.spots[0] === s.id);
        if (!fish.length) continue;
        out.push(h('h4', {}, `${s.id} ${s.name}`));
        out.push(...fish.map(cell));
      }
    } else out.push(...this.ordered().map(cell));
    return out;
  }

  step(dir) {
    const list = this.ordered();
    const i = list.findIndex((f) => f.id === this.sel);
    this.sel = list[(i + dir + list.length) % list.length].id;
    this.ui.refreshPanel();
  }

  detail() {
    const g = this.game;
    if (!this.sel) return [h('div', { class: 'muted' }, '點右邊的魚看詳細資料。'), h('div', { class: 'muted' }, '彩色：已釣到｜黑色剪影＋問號：看過但斷線｜空格：從未遇過'), this.stats()];
    const f = this.data.fishById[this.sel];
    const e = g.state.codex[f.id];
    const known = !!e?.caught;
    const D = this.data;
    const art = pxCanvas(codexArt(f, !known));
    const sizes = h('div', { class: 'sizes' }, ['S', 'M', 'L', 'XL'].map((s) => h('span', { class: e?.sizes?.[s] ? 'on' : '' }, s)));
    const time = f.time.map((t) => TIME_NAMES[t]).join('、') + (f.weather ? `（${f.weather.map((w) => WEATHER_NAMES[w]).join('、')}）` : '')
      + (f.season ? `｜${Object.entries(f.season).map(([s, m]) => `${this.data.config.seasons.names[s]}季 ×${m}`).join('、')}` : '')
      + (f.season_only ? `｜只在${f.season_only.map((s) => this.data.config.seasons.names[s]).join('、')}季` : '');
    const best = e?.best;
    return [
      h('div', { style: { display: 'grid', placeItems: 'center', background: '#d8f3ee', border: '1px solid #b89b72', minHeight: '84px' } }, art),
      h('div', { class: 'row' }, h('span', { style: { fontSize: '16px' } }, known ? f.name : '？？？'), h('span', { class: `rar ${f.rarity}` }, this.ui.rarityNames[f.rarity])),
      sizes,
      h('dl', { class: 'dl' },
        h('dt', {}, '出沒釣點'), h('dd', {}, f.spots.map((s) => D.spotById[s].name).join('、')),
        h('dt', {}, '有效魚餌'), h('dd', {}, f.baits.map((b) => D.baitById[b].name).join('、')),
        h('dt', {}, '時段'), h('dd', {}, time),
        h('dt', {}, '重量'), h('dd', {}, `${f.w[0]}–${f.w[1]} kg`),
        h('dt', {}, '釣到次數'), h('dd', {}, `${e?.caught || 0}`),
        h('dt', {}, '最大紀錄'), h('dd', { 'data-test': 'codex-best' }, best
          ? `${fmtW(best.w)}kg（${best.size}）｜${D.rodById[best.rod]?.name}・${D.baitById[best.bait]?.name}｜${D.spotById[best.spot]?.name}｜${new Date(best.at).toLocaleDateString('zh-TW')}`
          : '—')),
    ];
  }

  stats() {
    const s = this.game.state.stats;
    return h('div', { class: 'dl', style: { marginTop: '8px' } },
      h('dt', {}, '總共釣到'), h('dd', {}, `${s.caught} 條`),
      h('dt', {}, '放生'), h('dd', {}, `${s.released} 條`),
      h('dt', {}, '斷線'), h('dd', {}, `${s.broke} 次`),
      h('dt', {}, '賣出'), h('dd', {}, `${s.sold} 條，${s.earned.toLocaleString()} 金幣`));
  }

  onKey(e) {
    if (e.key === 'ArrowRight') this.step(1);
    if (e.key === 'ArrowLeft') this.step(-1);
  }
}
