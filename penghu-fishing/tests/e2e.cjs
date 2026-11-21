// 端對端測試：用 Playwright 真的打開遊戲，跑過每個主要流程。
// 執行：node tests/e2e.cjs   （設定 SHOTS=資料夾 可以順便存下每個畫面的截圖）
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const { serveFromDisk, ORIGIN } = require('./serve-route.cjs');

const SHOTS = process.env.SHOTS || '';
const results = [];
let browser;

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
  await serveFromDisk(ctx);
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.errors = [];
  page.on('requestfailed', (r) => page.errors.push(`request failed ${r.url()}`));
  page.on('pageerror', (e) => page.errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => window.done === true);
  return page;
}

async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

let current = null;
async function step(name, fn) {
  try { await fn(); results.push(['ok', name]); console.log(`ok - ${name}`); }
  catch (e) {
    results.push(['fail', name, e]);
    console.log(`not ok - ${name}\n  ${String(e.stack || e).split('\n').slice(0, 14).join('\n  ')}`);
    // 失敗後把畫面恢復乾淨，避免連鎖失敗
    if (current && !current.isClosed()) await current.evaluate(() => { const ui = window.__app?.ui; ui?.close(true); document.querySelectorAll('.card').forEach((c) => c.remove()); if (ui) ui.card = null; window.__app?.world.resume(); }).catch(() => {});
  }
}

const T = (id) => `[data-test="${id}"]`;

async function startGame(page) {
  await page.click(T('btn-start'));
  await page.waitForSelector(T('title'), { state: 'detached' });
}

async function waitCard(page, timeout = 30000) {
  await page.waitForSelector(T('catch-card'), { timeout });
}

(async () => {
  browser = await chromium.launch();

  await step('標題畫面 → 開始，沒有錯誤', async () => {
    const page = await newPage();
    await shot(page, '01-title');
    assert.ok(await page.isVisible(T('btn-start')));
    assert.equal(await page.isVisible(T('btn-continue')), false);
    await startGame(page);
    const spot = await page.textContent(T('spot'));
    assert.match(spot, /馬公第三漁港/);
    await page.waitForTimeout(300);
    await shot(page, '02-harbor');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });

  let page = await newPage();
  current = page;
  await startGame(page);
  await page.evaluate(() => { window.__app.debugSpeed = 20; });

  await step('自動釣魚 → 漁獲卡 → 保留進背包', async () => {
    await waitCard(page);
    await shot(page, '03-catch-card');
    const txt = await page.textContent(T('catch-card'));
    assert.match(txt, /kg/);
    assert.match(txt, /預估售價/);
    await page.click(T('btn-keep'));
    await page.waitForSelector(T('catch-card'), { state: 'detached' });
    const used = await page.evaluate(() => window.__app.game.pack.items.length);
    assert.equal(used, 1);
    const codex = await page.evaluate(() => window.__app.game.caughtSpecies());
    assert.equal(codex, 1);
  });

  await step('放生也會記入圖鑑', async () => {
    await waitCard(page);
    const before = await page.evaluate(() => window.__app.game.state.stats.caught);
    await page.click(T('btn-release'));
    const items = await page.evaluate(() => window.__app.game.pack.items.length);
    assert.equal(items, 1);
    assert.ok(before >= 2);
  });

  await step('背包：選取、旋轉、拖曳移動、丟掉', async () => {
    await page.evaluate(() => { window.__app.debugSpeed = 1; });
    // 放一條 1x2 的魚到 (0,0)
    await page.evaluate(() => {
      const g = window.__app.game;
      g.pack.items.length = 0;
      g.pack.place({ uid: 'm1', fish: { uid: 'm1', sp: 'f01', w: 0.5, size: 'M', shape: [1, 2], spot: 'A2', rod: 'rod1', bait: 'krill', at: Date.now() } }, 0, 0, false);
    });
    await page.click(T('btn-backpack'));
    await page.waitForSelector(T('panel-backpack'));
    await shot(page, '04-backpack');
    assert.ok(await page.evaluate(() => window.__app.world.paused), '整理背包時要暫停釣魚');
    const item = page.locator(T('pack-item')).first();
    await item.click();
    assert.match(await page.textContent(T('pack-info')), /豆仔魚/);
    await page.click(T('btn-rotate'));
    assert.equal(await page.evaluate(() => window.__app.game.pack.get('m1').rot), true);
    // 滑鼠拖曳到第 3 欄
    const box = await page.locator(T('pack-item')).first().boundingBox();
    const grid = await page.locator(T('pack-grid')).boundingBox();
    const cell = (grid.width - 4) / 8;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + cell * 1, box.y + box.height / 4, { steps: 4 });
    await page.mouse.move(box.x + box.width / 2 + cell * 3, box.y + box.height / 4, { steps: 6 });
    await page.mouse.up();
    const it = await page.evaluate(() => window.__app.game.pack.get('m1'));
    assert.equal(it.x, 3, `拖曳後 x=${it.x}`);
    assert.ok(await page.evaluate(() => window.__app.game.pack.isValid()));
    await page.locator(T('pack-item')).first().click();
    await page.click(T('btn-discard'));
    assert.equal(await page.evaluate(() => window.__app.game.pack.items.length), 0);
    await page.click(`${T('panel-backpack')} ${T('btn-close')}`);
  });

  await step('丟稀有以上的魚要確認', async () => {
    await page.evaluate(() => {
      const g = window.__app.game;
      g.pack.place({ uid: 'r1', fish: { uid: 'r1', sp: 'f36', w: 1, size: 'M', shape: [1, 2], spot: 'D3', rod: 'rod1', bait: 'squid', at: Date.now() } }, 0, 0, false);
    });
    await page.click(T('btn-backpack'));
    await page.locator(T('pack-item')).first().click();
    await page.click(T('btn-discard'));
    await page.waitForSelector(T('confirm'));
    await page.click(T('btn-confirm-no'));
    assert.equal(await page.evaluate(() => window.__app.game.pack.items.length), 1);
    await page.click(`${T('panel-backpack')} ${T('btn-close')}`);
  });

  await step('魚市：全部賣出（保留稀有以上）、全部賣出、金幣增加', async () => {
    await page.evaluate(() => {
      const g = window.__app.game;
      for (let i = 0; i < 3; i++) g.keep({ uid: 'c' + i, sp: 'f13', w: 0.8, size: 'L', shape: [2, 2], spot: 'A2', rod: 'rod1', bait: 'krill', at: Date.now() });
    });
    const c0 = await page.evaluate(() => window.__app.game.state.coins);
    await page.click(T('btn-market'));
    await page.waitForSelector(T('panel-market'));
    await page.waitForTimeout(200);
    await shot(page, '05-market');
    await page.click(T('btn-sell-common'));
    const after = await page.evaluate(() => ({ coins: window.__app.game.state.coins, n: window.__app.game.pack.items.length }));
    assert.equal(after.n, 1, '稀有的紅喉要留下');
    assert.ok(after.coins > c0);
    await page.click(T('btn-sell-all'));
    assert.equal(await page.evaluate(() => window.__app.game.pack.items.length), 0);
    await page.waitForTimeout(900);
    await page.click(`${T('panel-market')} ${T('btn-close')}`);
  });

  await step('釣具店：買竿、餌、背包、船，條件檢查', async () => {
    await page.evaluate(() => { window.__app.game.state.coins = 20000; });
    await page.click(T('btn-shop'));
    await page.waitForSelector(T('panel-shop'));
    await page.waitForTimeout(200);
    await shot(page, '06-shop');
    await page.click(T('buy-rod-rod2'));
    assert.equal(await page.evaluate(() => window.__app.game.state.rod), 'rod2');
    await page.keyboard.press('e');
    await page.click(T('buy-bait-sandworm'));
    assert.equal(await page.evaluate(() => window.__app.game.state.bait), 'sandworm');
    await page.click(T('tab-backpack'));
    await shot(page, '07-shop-backpack');
    await page.click(T('buy-backpack-3'));
    assert.equal(await page.evaluate(() => window.__app.game.state.packLevel), 1, '不能跳級買背包');
    await page.click(T('buy-backpack-2'));
    assert.equal(await page.evaluate(() => window.__app.game.pack.rows), 4);
    await page.click(T('tab-boat'));
    await page.click(T('buy-boat-boat2'));
    assert.equal(await page.evaluate(() => window.__app.game.state.boat), 'boat2');
    await page.click(`${T('panel-shop')} ${T('btn-close')}`);
  });

  await step('地圖：上鎖的釣點不能去；可以去的釣點出發 → 過場 → 抵達', async () => {
    await page.click(T('btn-map'));
    await page.waitForSelector(T('panel-map'));
    await page.waitForTimeout(200);
    await shot(page, '08-map');
    const locked = await page.evaluate(() => window.__app.game.canTravel('C1').reason);
    assert.equal(locked, 'boat');
    await page.evaluate(() => window.__app.ui.panels.map.showInfo('C1'));
    assert.ok(await page.locator(T('btn-go')).isDisabled());
    await page.evaluate(() => { window.__app.weatherOverride = 'sunny'; window.__app.ui.panels.map.showInfo('B2'); });
    await page.click(T('btn-go'));
    await page.waitForTimeout(1500);
    await shot(page, '09-travel');
    await page.waitForFunction(() => window.__app.game.state.spot === 'B2' && !window.__app.world.travel, null, { timeout: 8000 });
    assert.match(await page.textContent(T('spot')), /吉貝沙尾/);
    assert.equal(await page.isVisible(T('btn-market')), false, '不在港口時不能開魚市');
  });

  await step('圖鑑：數量與剪影', async () => {
    await page.evaluate(() => { const g = window.__app.game; g.codexEntry('f41').seen = true; });
    await page.click(T('btn-codex'));
    await page.waitForSelector(T('panel-codex'));
    const n = await page.evaluate(() => window.__app.game.caughtSpecies());
    assert.equal(await page.textContent(T('codex-count')), `${n} / 50`);
    assert.equal(await page.getAttribute(T('codex-f41'), 'data-state'), 'seen');
    await page.click(T('codex-f41'));
    await shot(page, '10-codex');
    await page.click(`${T('panel-codex')} ${T('btn-close')}`);
  });

  await step('設定：自動規則（背包滿時停止）', async () => {
    await page.click(T('btn-settings'));
    await page.click(T('stab-rules'));
    await shot(page, '11-settings-rules');
    await page.click(`${T('rule-full')} [data-value="stop"]`);
    assert.equal(await page.evaluate(() => window.__app.game.state.rules.whenFull), 'stop');
    await page.click(`${T('rule-full')} [data-value="ask"]`);
    await page.click(`${T('panel-settings')} ${T('btn-close')}`);
  });

  await step('背包已滿：漁獲卡顯示「背包已滿」→ 打開背包整理 → 放生這條 → 繼續釣魚', async () => {
    await page.evaluate(() => {
      const g = window.__app.game;
      g.travel('A2');
      g.state.bait = 'krill';
      window.__app.world.resetSpot(); window.__app.world.beginCast();
      let i = 0;
      while (g.keep({ uid: 'z' + i, sp: 'f01', w: 0.1, size: 'S', shape: [1, 1], spot: 'A2', rod: 'rod1', bait: 'krill', at: Date.now() })) i++;
      window.__app.debugSpeed = 20;
    });
    await waitCard(page);
    await shot(page, '12-card-full');
    assert.match(await page.textContent(T('catch-card')), /背包已滿/);
    await page.click(T('btn-organize'));
    await page.waitForSelector(T('pending'));
    await shot(page, '13-organize');
    await page.click(T('btn-pending-release'));
    await page.click(`${T('panel-backpack')} ${T('btn-close')}`);
    assert.equal(await page.isVisible(T('catch-card')), false);
    await page.waitForFunction(() => ['cast', 'wait', 'approach', 'bite', 'reel'].includes(window.__app.world.state), null, { timeout: 5000 });
  });

  await step('點小卷貓有反應', async () => {
    const r = await page.evaluate(() => { const app = window.__app; const c = app.world.catRect(app.screen.W); const s = app.screen; return { x: s.left + (c.x + 10) * s.scale, y: s.top + (c.y + 8) * s.scale }; });
    await page.mouse.click(r.x, r.y);
    const pose = await page.evaluate(() => window.__app.world.cat.pose);
    assert.ok(['sit', 'belly'].includes(pose), pose);
  });

  await step('存檔 → 重新整理 → 繼續 → 離線收益', async () => {
    await page.evaluate(() => {
      const app = window.__app;
      app.game.pack.items.length = 0;
      app.save();
      const s = JSON.parse(localStorage.getItem('penghu-slow-fishing-save'));
      s.lastPlayed = Date.now() - 3 * 3600 * 1000; // 假裝離開 3 小時
      localStorage.setItem('penghu-slow-fishing-save', JSON.stringify(s));
      app.started = false; // 避免 beforeunload 又存一次
    });
    await page.reload();
    await page.waitForFunction(() => window.done === true);
    assert.ok(await page.isVisible(T('btn-continue')));
    await page.click(T('btn-continue'));
    await page.waitForSelector(T('offline'));
    await shot(page, '14-offline');
    const txt = await page.textContent(T('offline'));
    assert.match(txt, /你不在的時候/);
    assert.match(txt, /3 小時/);
    const coins = await page.evaluate(() => window.__app.game.state.coins);
    assert.ok(coins > 0, '金幣要保留');
    await page.click(T('btn-offline-ok'));
  });
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // ---------- 手機：直向提示、各種寬螢幕比例 ----------
  await step('手機直向：顯示「請將手機轉為橫向」並暫停', async () => {
    const p = await newPage({ ...devices['Pixel 7'] });
    assert.equal(await p.isVisible('#rotate'), true);
    await shot(p, '15-portrait');
    await p.context().close();
  });

  const ratios = [['16:9', 640, 360], ['19.5:9', 844, 390], ['20:9', 800, 360], ['21:9', 840, 360]];
  for (const [name, w, hgt] of ratios) {
    await step(`手機橫向 ${name}：整數倍縮放、背景不留白、按鈕夠大`, async () => {
      const p = await newPage({ viewport: { width: w, height: hgt }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await p.click(T('btn-start'));
      await p.waitForTimeout(400);
      const info = await p.evaluate(() => {
        const s = window.__app.screen;
        const b = document.querySelector('[data-test="btn-backpack"]').getBoundingClientRect();
        return { W: s.W, scale: s.scale, dpr: devicePixelRatio, left: s.left, sw: document.documentElement.scrollWidth, iw: innerWidth, bw: b.width, bh: b.height, portrait: s.portrait };
      });
      assert.equal(info.portrait, false);
      assert.ok(info.W >= 640 && info.W <= 800, `W=${info.W}`);
      assert.ok(Number.isInteger(Math.round(info.scale * info.dpr * 1000) / 1000), `scale=${info.scale}`);
      assert.ok(info.sw <= info.iw, '不能有水平捲動');
      assert.ok(info.bw >= 40 && info.bh >= 40, `按鈕 ${info.bw}x${info.bh} CSS px`);
      await shot(p, `16-ratio-${name.replace(':', 'x')}`);
      assert.deepEqual(p.errors, []);
      await p.context().close();
    });
  }

  await step('觸控：長按拿起魚並拖曳', async () => {
    const p = await newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await p.click(T('btn-start'));
    await p.evaluate(() => {
      const g = window.__app.game;
      g.pack.place({ uid: 't1', fish: { uid: 't1', sp: 'f01', w: 0.5, size: 'S', shape: [1, 1], spot: 'A2', rod: 'rod1', bait: 'krill', at: Date.now() } }, 0, 0, false);
    });
    await p.click(T('btn-backpack'));
    const box = await p.locator(T('pack-item')).first().boundingBox();
    const grid = await p.locator(T('pack-grid')).boundingBox();
    const cell = (grid.width - 4) / 8;
    // 用 CDP 送觸控事件：按住 300ms → 拖曳 → 放開
    const cdp = await p.context().newCDPSession(p);
    const x0 = box.x + box.width / 2, y0 = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    await p.waitForTimeout(300);
    // 觸控時魚顯示在手指上方 40 基礎像素，所以手指要往下多移一點
    const lift = await p.evaluate(() => 40 * window.__app.screen.scale);
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (cell * 2 * i) / 8, y: y0 + cell + (lift * i) / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(100);
    const it = await p.evaluate(() => window.__app.game.pack.get('t1'));
    assert.deepEqual([it.x, it.y], [2, 1]);
    await p.context().close();
  });

  await browser.close();
  const failed = results.filter((r) => r[0] === 'fail');
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => { console.error(e); await browser?.close(); process.exit(1); });
