// 設定：音量、全螢幕、像素縮放、時間流速、省電模式、季節；自動規則；存檔。
import { h, btn, pxCanvas } from './dom.js';
import { icon } from '../render/icons.js';

export class SettingsPanel {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.pauses = false;
    this.tab = 'general';
  }

  render() {
    const tabs = [['general', '一般'], ['rules', '自動規則'], ['save', '存檔']];
    const body = this.tab === 'rules' ? this.rules() : this.tab === 'save' ? this.saveTab() : this.general();
    return h('div', { class: 'panel', 'data-test': 'panel-settings' },
      h('div', { class: 'panel-head' }, pxCanvas(icon('gear'), 32, 32), h('h2', {}, '設定'),
        h('div', { class: 'tabs' }, tabs.map(([id, name]) => btn(name, () => { this.tab = id; this.ui.refreshPanel(); }, this.tab === id ? 'sel' : '', { 'data-test': `stab-${id}` }))),
        h('span', { class: 'spacer' }), btn('關閉', () => this.ui.close(), 'close', { 'data-test': 'btn-close' })),
      h('div', { class: 'panel-body scroll' }, body));
  }

  seg(options, current, onPick, test) {
    return h('div', { class: 'seg', 'data-test': test }, options.map(([v, label]) => btn(label, () => { onPick(v); this.ui.app.applySettings(); this.ui.app.save(); this.ui.refreshPanel(); }, current === v ? 'sel' : '', { 'data-value': String(v) })));
  }

  slider(value, onInput, test) {
    const el = h('input', { type: 'range', min: 0, max: 100, value: Math.round(value * 100), 'data-test': test });
    el.addEventListener('input', () => { onInput(el.value / 100); this.ui.app.applySettings(); });
    el.addEventListener('change', () => this.ui.app.save());
    return el;
  }

  general() {
    const S = this.game.state.settings;
    const cfg = this.ui.cfg;
    return h('div', { class: 'form' },
      h('label', {}, '音樂音量'), this.slider(S.music, (v) => { S.music = v; }, 'music'),
      h('label', {}, '音效音量'), this.slider(S.sfx, (v) => { S.sfx = v; }, 'sfx'),
      h('label', {}, '全螢幕'), this.seg([[true, '開'], [false, '關']], !!document.fullscreenElement, (v) => { S.fullscreen = v; this.ui.app.setFullscreen(v); }),
      h('label', {}, '像素縮放倍率'), this.seg([['auto', '自動（整數）'], ['1', '1x'], ['2', '2x'], ['3', '3x'], ['4', '4x'], ['fit', '填滿（非整數）']], String(S.scale), (v) => { S.scale = v; }, 'scale'),
      h('label', {}, '時間流速'), this.seg(cfg.speedOptions.map((v) => [v, `${v}x`]), S.speed, (v) => { S.speed = v; }, 'speed'),
      h('label', {}, '省電模式'), this.seg([[true, '開（30fps、關閉水面波動）'], [false, '關']], !!S.powerSave, (v) => { S.powerSave = v; }, 'power'),
      h('label', {}, '季節變化'), this.seg([[true, '開（現實 7 天一季）'], [false, '關']], S.seasons !== false, (v) => { S.seasons = v; }, 'seasons'),
      h('label', {}, '漁獲卡自動保留'), this.seg([[true, `開（${cfg.autoKeepSeconds} 秒）`], [false, '關']], !!S.autoKeep, (v) => { S.autoKeep = v; }, 'autokeep'),
      h('label', {}, '除錯面板'), this.seg([[true, '開'], [false, '關']], !!S.debug, (v) => { S.debug = v; this.ui.debug.setVisible(v); }, 'debug'));
  }

  rules() {
    const R = this.game.state.rules;
    const names = this.ui.rarityNames;
    return h('div', { class: 'col' },
      h('div', { class: 'muted' }, '放置用的自動規則。離線收益也會套用這些規則。自動放生的魚一樣會記入圖鑑。'),
      h('div', { class: 'form' },
        h('label', {}, '自動放生'), this.seg([[null, '關閉'], ['uncommon', `低於${names.uncommon}（放生${names.common}）`], ['rare', `低於${names.rare}（放生${names.common}、${names.uncommon}）`], ['legendary', `低於${names.legendary}（只留${names.legendary}）`]], R.releaseBelow, (v) => { R.releaseBelow = v; }, 'rule-release'),
        h('label', {}, '背包滿時'), this.seg([['ask', '詢問我（顯示漁獲卡）'], ['release', '自動放生新漁獲'], ['stop', '停止釣魚']], R.whenFull, (v) => { R.whenFull = v; }, 'rule-full')));
  }

  saveTab() {
    const g = this.game;
    const last = new Date(g.state.lastPlayed).toLocaleString('zh-TW');
    return h('div', { class: 'col' },
      h('div', {}, `存檔版本 ${g.state.version}｜每 ${this.ui.cfg.autosaveSeconds} 秒與重要事件時自動存檔`),
      h('div', { class: 'muted' }, `上次存檔：${last}`),
      h('div', { class: 'row' },
        btn('立即存檔', () => { this.ui.app.save(); this.ui.toast('已存檔'); }, 'primary'),
        btn('匯出存檔', () => this.exportSave()),
        btn('回到標題畫面', () => { this.ui.close(true); this.ui.app.showTitle(); })),
      h('div', { class: 'row', style: { marginTop: '12px' } },
        btn('刪除存檔、重新開始', () => this.reset(), 'danger', { 'data-test': 'btn-reset' })));
  }

  exportSave() {
    const text = this.ui.app.serialize();
    const blob = new Blob([text], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'penghu-slow-fishing-save.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  reset() {
    const box = h('div', { class: 'card', style: { zIndex: 65 } },
      h('div', { style: { fontSize: '14px' } }, '確定要刪除存檔嗎？金幣、背包、圖鑑都會消失。'),
      h('div', { class: 'btns' },
        btn('刪除', () => { box.remove(); this.ui.app.resetSave(); }, 'danger', { 'data-test': 'btn-reset-yes' }),
        btn('取消', () => box.remove())));
    this.ui.root.appendChild(box);
  }
}
