// 螢幕：整數倍縮放（基礎高度 360，寬度 640–800 依比例延伸）、safe area、強制橫向。

export class Screen {
  constructor(cfg, stage, canvas, ui) {
    this.cfg = cfg;
    this.stage = stage;
    this.canvas = canvas;
    this.ui = ui;
    this.W = cfg.minWidth;
    this.scale = 1;
    this.left = 0;
    this.top = 0;
    this.mode = 'auto';
    this.portrait = false;
    this.listeners = new Set();
    this.probe = document.createElement('div');
    this.probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(this.probe);
    const onResize = () => this.layout();
    addEventListener('resize', onResize);
    addEventListener('orientationchange', () => setTimeout(onResize, 120));
    screen.orientation?.addEventListener?.('change', onResize);
    this.layout();
  }

  on(fn) { this.listeners.add(fn); }

  setMode(mode) { this.mode = mode; this.layout(); }

  /** 依設定計算縮放：auto = 實體像素的整數倍；fit = 填滿（非整數）；數字 = 指定倍率 */
  compute(vw, vh, dpr) {
    const H = this.cfg.baseHeight, minW = this.cfg.minWidth, maxW = this.cfg.maxWidth;
    let s;
    if (this.mode === 'fit') {
      s = Math.min(vh / H, vw / minW);
    } else {
      let k = Math.min(Math.floor((vh * dpr) / H), Math.floor((vw * dpr) / minW));
      if (typeof this.mode === 'number' || /^\d+$/.test(this.mode)) k = Math.min(k, Number(this.mode));
      s = k >= 1 ? k / dpr : Math.min(vh / H, vw / minW); // 螢幕比 640x360 還小時只能非整數縮小
    }
    const W = Math.max(minW, Math.min(maxW, Math.floor(vw / s)));
    return { s, W };
  }

  layout() {
    const vw = window.innerWidth, vh = window.innerHeight, dpr = window.devicePixelRatio || 1;
    this.portrait = vh > vw * 1.05 && matchMedia('(pointer: coarse)').matches;
    const { s, W } = this.compute(vw, vh, dpr);
    this.scale = s;
    this.W = W;
    const H = this.cfg.baseHeight;
    // 對齊到實體像素，避免半像素模糊
    this.left = Math.round(((vw - W * s) / 2) * dpr) / dpr;
    this.top = Math.round(((vh - H * s) / 2) * dpr) / dpr;
    this.stage.style.width = `${W}px`;
    this.stage.style.transform = `translate(${this.left}px, ${this.top}px) scale(${s})`;
    if (this.canvas.width !== W) this.canvas.width = W;
    this.canvas.height = H;
    // safe area（CSS px）→ 基礎像素；畫面已經在安全區內的部分不用再內縮
    const cs = getComputedStyle(this.probe);
    const inset = (v) => parseFloat(v) || 0;
    const sl = Math.max(0, inset(cs.paddingLeft) - this.left) / s;
    const sr = Math.max(0, inset(cs.paddingRight) - (vw - this.left - W * s)) / s;
    const st = Math.max(0, inset(cs.paddingTop) - this.top) / s;
    const sb = Math.max(0, inset(cs.paddingBottom) - (vh - this.top - H * s)) / s;
    this.safe = { l: sl, r: sr, t: st, b: sb };
    for (const [k, v] of Object.entries({ '--sl': sl, '--sr': sr, '--st': st, '--sb': sb })) this.ui.style.setProperty(k, `${Math.ceil(v)}px`);
    for (const fn of this.listeners) fn(this);
  }

  /** 螢幕座標 → 基礎像素座標 */
  toBase(clientX, clientY) {
    return { x: (clientX - this.left) / this.scale, y: (clientY - this.top) / this.scale };
  }

  /** 第一次按「開始」時：進入全螢幕並嘗試鎖定橫向（失敗就靠直向提示畫面） */
  async enterFullscreenLandscape() {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    } catch { /* iOS Safari 不支援 */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* 鎖不住就顯示提示 */ }
  }

  async exitFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* 忽略 */ }
  }

  /** 讓兩側多出來的邊框和場景顏色一致（上半天空色、下半海色） */
  setBorderColors(top, bottom) {
    document.body.style.background = `linear-gradient(to bottom, ${top} 0 50%, ${bottom} 50% 100%)`;
  }
}
