// 除錯面板：切換釣點、竿、餌、時間加速、設定時刻與天氣、加金幣。（按 ` 或在設定裡開啟）
import { h, btn } from './dom.js';

export class DebugPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.el = null;
    if (this.game.state.settings.debug) this.setVisible(true);
  }

  toggle() { this.setVisible(!this.el); this.game.state.settings.debug = !!this.el; }

  setVisible(v) {
    if (!v) { this.el?.remove(); this.el = null; return; }
    if (this.el) return;
    this.el = this.build();
    this.ui.root.appendChild(this.el);
  }

  refresh() { if (this.el) { const n = this.build(); this.el.replaceWith(n); this.el = n; } }

  select(options, value, onChange, test) {
    const s = h('select', { 'data-test': test }, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
    s.addEventListener('change', () => { onChange(s.value); this.ui.app.save(); });
    return s;
  }

  build() {
    const g = this.game;
    const D = this.ui.data;
    const app = this.ui.app;
    return h('div', { class: 'debug', 'data-test': 'debug' },
      h('div', {}, '除錯面板（` 關閉）'),
      this.select(D.spots.map((s) => [s.id, `${s.id} ${s.name}`]), g.state.spot, (v) => { g.state.spot = v; app.world.resetSpot(); app.updateTrack(); }, 'dbg-spot'),
      this.select(D.rods.map((r) => [r.id, `${r.name} ${r.pull}kg`]), g.state.rod, (v) => { if (!g.owns('rod', v)) g.state.owned.rods.push(v); g.equip('rod', v); }, 'dbg-rod'),
      this.select(D.baits.map((b) => [b.id, b.name]), g.state.bait, (v) => { if (!g.owns('bait', v)) g.state.owned.baits.push(v); g.equip('bait', v); }, 'dbg-bait'),
      this.select(D.boats.map((b) => [b.id, b.name]), g.state.boat, (v) => {
        for (const b of D.boats) { if (!g.owns('boat', b.id)) g.state.owned.boats.push(b.id); if (b.id === v) break; }
        g.state.boat = g.bestBoat().id;
      }, 'dbg-boat'),
      h('div', { class: 'row' }, '加速', [1, 5, 20, 60].map((v) => btn(`${v}x`, () => { app.debugSpeed = v; this.refresh(); }, app.debugSpeed === v ? 'sel' : '', { 'data-test': `dbg-speed-${v}` }))),
      h('div', { class: 'row' }, '時刻', [6, 12, 17.5, 18.5, 22].map((hh) => btn(String(hh), () => {
        const m = g.state.clock.minutes; g.state.clock.minutes = Math.floor(m / 1440) * 1440 + hh * 60;
      }))),
      h('div', { class: 'row' }, '天氣', [['', '自動'], ['sunny', '晴'], ['cloudy', '雲'], ['fog', '霧'], ['windy', '風']].map(([v, l]) => btn(l, () => { app.weatherOverride = v || null; this.refresh(); }, (app.weatherOverride || '') === v ? 'sel' : ''))),
      h('div', { class: 'row' },
        btn('+10000 金幣', () => g.addCoins(10000), '', { 'data-test': 'dbg-coins' }),
        btn('馬上咬鉤', () => { if (app.world.state === 'wait') app.world.timer = 999; }, '', { 'data-test': 'dbg-bite' })));
  }
}
