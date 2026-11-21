// 進入點：載入資料與存檔、建立遊戲、主迴圈、標題畫面、離線收益、存檔。
import { loadData, validateData } from '../core/data.js';
import { Game, newState } from '../core/game.js';
import { serialize, deserialize, SAVE_KEY } from '../core/save.js';
import { simulateOffline } from '../core/offline.js';
import { weatherOf } from '../core/clock.js';
import { World } from './world.js';
import { Screen } from './screen.js';
import { Audio } from './audio.js';
import { UI } from '../ui/ui.js';
import { h, btn } from '../ui/dom.js';
import { TONES } from '../render/tones.js';
import { catSprite } from '../render/actors.js';
import { rect, PAL as C } from '../render/pixel.js';
import { loadFishSprites } from '../render/fishart.js';

const storage = {
  get() { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, v); return true; } catch { return false; } },
  remove() { try { localStorage.removeItem(SAVE_KEY); } catch { /* 忽略 */ } },
};

class App {
  async boot() {
    this.data = await loadData(async (n) => {
      const r = await fetch(`data/${n}.json`);
      if (!r.ok) throw new Error(`讀不到 data/${n}.json`);
      return r.json();
    });
    await loadFishSprites(this.data);
    const errs = validateData(this.data);
    if (errs.length) console.warn('資料檢查：', errs);
    this.cfg = this.data.config;
    this.stage = document.getElementById('stage');
    this.canvas = document.getElementById('view');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.uiRoot = document.getElementById('ui');
    this.screen = new Screen(this.cfg, this.stage, this.canvas, this.uiRoot);
    this.audio = new Audio();
    window.__sfx = (n) => this.audio.play(n);
    this.debugSpeed = 1;
    this.weatherOverride = null;
    this.paused = false;
    this.saveText = storage.get();
    const loaded = deserialize(this.data, this.saveText);
    this.setGame(loaded || newState(this.data), !!loaded);
    this.screen.on(() => this.onResize());
    this.onResize(); // 開機時就是直向的情況
    this.bindInput();
    this.bindLifecycle();
    this.registerSW();
    document.getElementById('boot').classList.add('gone');
    this.showTitle();
    this.last = performance.now();
    this.frame = 0;
    this.autosaveT = 0;
    requestAnimationFrame((t) => this.loop(t));
    window.__app = this; // 測試與除錯用
    window.done = true;
  }

  setGame(state, hasSave) {
    this.hasSave = hasSave;
    this.game = new Game(this.data, state);
    const g = this.game;
    const orig = g.weather.bind(g);
    g.weather = (m, now) => this.weatherOverride || orig(m, now);
    g.env = ((origEnv) => (now, m) => { const e = origEnv(now, m); if (this.weatherOverride) e.weather = this.weatherOverride; return e; })(g.env.bind(g));
    this.world = new World(g, {
      onCatch: (res) => this.ui.handleCatch(res),
      onBroke: (res) => this.ui.handleBroke(res),
      onEmpty: () => {},
      sfx: (n) => this.audio.play(n),
    });
    this.ui = new UI(this);
    this.applySettings();
  }

  // ---------------- 主迴圈 ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const raw = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    this.frame++;
    const power = this.game.state.settings.powerSave;
    const stopped = this.paused || this.screen.portrait;
    if (!stopped) {
      const dt = raw * this.debugSpeed;
      if (!this.titleShown && !this.endingShown) this.game.advanceClock(dt);
      this.world.update(dt);
      this.autosaveT += raw;
      if (!this.titleShown && this.autosaveT >= this.cfg.autosaveSeconds) { this.autosaveT = 0; this.save(); }
    }
    if (power && this.frame % 2) return; // 省電：30fps
    this.world.render(this.ctx, this.screen.W, { powerSave: power });
    if (!this.titleShown && !this.endingShown) this.ui.updateHud();
    this.audio.tick();
    this.updateBorders();
  }

  updateBorders() {
    const tone = this.game.tone();
    if (tone === this.lastTone) return;
    this.lastTone = tone;
    const T = TONES[tone];
    this.screen.setBorderColors(T.sky[0], T.under[T.under.length - 1]);
    this.updateTrack();
  }

  updateTrack() {
    if (this.ui?.panel === 'shop') return;
    if (this.titleShown) { this.audio.setTrack('title'); return; }
    this.audio.setTrack(this.game.phase() === 'night' ? 'night' : this.game.region.bgm);
  }

  onResize() {
    const portrait = this.screen.portrait;
    document.getElementById('rotate').hidden = !portrait;
    if (portrait === this.wasPortrait) return;
    this.wasPortrait = portrait;
    if (portrait) { this.save(); this.audio.suspend(); this.startRotateAnim(); }
    else { this.audio.resume(); this.last = performance.now(); }
  }

  // ---------------- 輸入 ----------------
  bindInput() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      if (this.titleShown) return;
      const p = this.screen.toBase(e.clientX, e.clientY);
      const r = this.world.catRect(this.screen.W);
      if (p.x >= r.x - 4 && p.x <= r.x + r.w + 4 && p.y >= r.y - 4 && p.y <= r.y + r.h + 4) this.world.tapCat();
    });
    addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
  }

  bindLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.hiddenAt = Date.now();
        this.save();            // 切到背景時立刻存檔
        this.audio.suspend();
      } else {
        this.audio.resume();
        const away = (Date.now() - (this.hiddenAt || Date.now())) / 1000;
        this.last = performance.now();
        if (!this.titleShown && away >= this.cfg.offline.minSeconds) this.runOffline(away); // 背景時暫停渲染，但繼續計算放置收益
      }
    });
    addEventListener('pagehide', () => this.save());
    addEventListener('beforeunload', () => this.save());
  }

  registerSW() {
    if (!('serviceWorker' in navigator) || navigator.webdriver || location.protocol !== 'https:') return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---------------- 存檔 ----------------
  serialize() { return serialize(this.game, Date.now()); }

  save() {
    // 標題與結局畫面會暫時借用釣點與時間來畫背景，這時候不存檔
    if (!this.started || this.titleShown || this.endingShown) return;
    storage.set(this.serialize());
  }

  resetSave() {
    storage.remove();
    this.started = false;
    this.ui.close(true);
    this.setGame(newState(this.data), false);
    this.showTitle();
  }

  runOffline(seconds) {
    const sum = simulateOffline(this.game, seconds, Math.random, Date.now());
    this.world.resetSpot();
    if (sum.attempts > 0 || sum.seconds >= this.cfg.offline.minSeconds) this.ui.showOffline(sum);
    this.save();
  }

  applySettings() {
    const S = this.game.state.settings;
    this.audio.setVolumes(S.music, S.sfx);
    this.screen.setMode(S.scale === 'auto' ? 'auto' : S.scale);
  }

  async setFullscreen(on) {
    if (on) await this.screen.enterFullscreenLandscape();
    else await this.screen.exitFullscreen();
  }

  // ---------------- 移動 ----------------
  travelTo(id) {
    const g = this.game;
    if (this.ui.card) return;
    this.world.startTravel(() => { g.travel(id); this.updateTrack(); }, () => {
      this.ui.toast(`抵達 ${g.region.name}・${g.spot.name}`);
      this.save();
      this.world.beginCast();
    });
  }

  // ---------------- 標題畫面 ----------------
  showTitle() {
    this.save();
    this.titleShown = true;
    this.titleEl?.remove();
    this.ui.hudLayer.hidden = true;
    // 標題背景：西嶼的夕陽（借用目前的世界繪製，暫時換成外垵漁港 18:30）
    this.titleBackup = { spot: this.game.state.spot, minutes: this.game.state.clock.minutes };
    this.game.state.spot = 'C3';
    this.game.state.clock.minutes = Math.floor(this.game.state.clock.minutes / 1440) * 1440 + 18.5 * 60;
    this.world.resetSpot();
    this.world.paused = true;
    const cont = this.hasSave;
    const start = () => {
      if (cont) {
        const box = h('div', { class: 'card', style: { zIndex: 65 } }, h('div', { style: { fontSize: '14px' } }, '已經有存檔了。要刪掉存檔、重新開始嗎？'),
          h('div', { class: 'btns' }, btn('重新開始', () => { box.remove(); storage.remove(); this.setGame(newState(this.data), false); this.enter(false); }, 'danger', { 'data-test': 'btn-new-confirm' }), btn('取消', () => box.remove())));
        this.uiRoot.appendChild(box);
        return;
      }
      this.enter(false);
    };
    this.titleEl = h('div', { class: 'title', 'data-test': 'title' },
      h('h1', {}, '澎湖慢釣'),
      h('div', { class: 'sub' }, '帶著橘貓小卷，在澎湖的海上慢慢釣魚'),
      h('div', { class: 'row' },
        btn('開始', start, cont ? '' : 'primary', { 'data-test': 'btn-start' }),
        cont ? btn('繼續', () => this.enter(true), 'primary', { 'data-test': 'btn-continue' }) : null));
    this.uiRoot.appendChild(this.titleEl);
    this.updateTrack();
  }

  async enter(cont) {
    this.audio.unlock();
    if (matchMedia('(pointer: coarse)').matches || this.game.state.settings.fullscreen) this.screen.enterFullscreenLandscape();
    this.titleEl?.remove();
    // 新遊戲時 setGame 已經換成新的狀態，不用還原標題前的位置
    if (cont && this.titleBackup) { this.game.state.spot = this.titleBackup.spot; this.game.state.clock.minutes = this.titleBackup.minutes; }
    else if (!cont) { const fresh = newState(this.data); this.game.state.spot = fresh.spot; this.game.state.clock.minutes = fresh.clock.minutes; }
    this.titleShown = false;
    this.started = true;
    this.ui.hudLayer.hidden = false;
    this.world.paused = false;
    this.world.resetSpot();
    this.world.beginCast();
    this.updateTrack();
    this.lastTone = null;
    if (cont) {
      const away = (Date.now() - this.game.state.lastPlayed) / 1000;
      if (away >= this.cfg.offline.minSeconds) this.runOffline(away);
    } else {
      this.ui.toast('歡迎來到馬公第三漁港！小卷已經在船頭等你了');
    }
    this.save();
  }

  showEnding() {
    const g = this.game;
    this.save();
    this.endingShown = true;
    this.endingBackup = { spot: g.state.spot, minutes: g.state.clock.minutes };
    g.state.spot = 'C2';
    g.state.clock.minutes = Math.floor(g.state.clock.minutes / 1440) * 1440 + 18.4 * 60;
    this.world.resetSpot();
    this.world.paused = true;
    this.ui.hudLayer.hidden = true;
    const el = h('div', { class: 'title ending', 'data-test': 'ending' },
      h('h1', { style: { fontSize: '32px', lineHeight: '36px' } }, '五十種魚，全部到齊'),
      h('div', { class: 'text' }, '西嶼的夕陽把玄武岩染成紫色。小卷靠在船頭打了個呵欠。', h('br'), '圖鑑寫滿了，可是明天的海，還是會有新的故事。'),
      h('div', { class: 'row' }, btn('繼續釣魚', () => {
        el.remove();
        this.endingShown = false;
        g.state.spot = this.endingBackup.spot; g.state.clock.minutes = this.endingBackup.minutes;
        this.ui.hudLayer.hidden = false;
        this.world.paused = false; this.world.resetSpot(); this.world.beginCast();
      }, 'primary')));
    this.uiRoot.appendChild(el);
  }

  // 直向提示：小卷貓轉動手機的動畫
  startRotateAnim() {
    if (this.rotTimer) return;
    const cv = document.getElementById('rotate-art');
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let f = 0;
    this.rotTimer = setInterval(() => {
      if (!this.screen.portrait) { clearInterval(this.rotTimer); this.rotTimer = null; return; }
      f++;
      rect(ctx, 0, 0, 64, 48, C.sea0);
      const land = Math.floor(f / 6) % 2 === 1;
      if (land) { rect(ctx, 26, 16, 30, 18, C.ui0); rect(ctx, 28, 18, 26, 14, C.sea4); rect(ctx, 30, 26, 22, 4, C.sea2); }
      else { rect(ctx, 32, 8, 18, 30, C.ui0); rect(ctx, 34, 10, 14, 26, C.sea4); rect(ctx, 34, 28, 14, 6, C.sea2); }
      for (let i = 0; i < 5; i++) rect(ctx, 22 + i, 6 + (i % 2), 1, 1, C.wa3); // 旋轉的箭頭
      ctx.drawImage(catSprite(land ? 'excited' : 'watch', f % 8).c, 4, 26);
    }, 120);
  }
}

const app = new App();
app.boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  b.textContent = `載入失敗：${e.message}`;
});

export { weatherOf };
