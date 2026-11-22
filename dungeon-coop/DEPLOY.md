# 部署：前端放 Netlify、伺服器放 Render

Netlify 只能放靜態網頁，**無法執行需要一直連線的多人遊戲伺服器**（WebSocket＋即時運算）與帳號資料庫，
所以分成兩部分：

| 部分 | 放哪裡 | 內容 |
|---|---|---|
| 前端（網頁、美術、音樂） | **Netlify** | `abyss-hunters-netlify.zip` |
| 遊戲伺服器（房間、帳號、戰鬥運算） | **Render**（或 Railway、Fly.io） | `server.js` 等，見下方 |

## 步驟 1：部署遊戲伺服器（Render）

1. 把專案推到你的 GitHub（或使用 `abyss-hunters-source.zip` 解壓後上傳到新的 GitHub repo）。
2. 到 [Render](https://render.com) → **New → Blueprint** → 選這個 repo。Render 會讀取 `dungeon-coop/render.yaml` 自動建立服務。
   - 若 repo 的根目錄就是 `dungeon-coop`，把 `render.yaml` 移到根目錄並刪掉 `rootDir` 那一行。
   - 也可以手動建立 **Web Service**：Root Directory 填 `dungeon-coop`，Build Command `npm ci --omit=dev`，Start Command `node server.js`。
3. 帳號資料存在磁碟上：`render.yaml` 使用 Starter 方案加 1GB 磁碟（帳號才不會遺失）。
   改用免費方案也能玩，但伺服器重啟後帳號與魂晶會清空，且閒置 15 分鐘後會休眠（第一次連線要等約 1 分鐘喚醒）。
4. 部署完成後會得到網址，例如 `https://abyss-hunters.onrender.com`。打開 `https://…/api/health` 看到 `{"ok":true…}` 就成功了。

> 其他選擇：有 Docker 的主機（Fly.io、Railway、自己的 VPS）可直接用 `Dockerfile`，記得把 `/data` 掛成持久磁碟。

## 步驟 2：部署前端（Netlify）

**方法 A：直接用壓縮檔（最簡單）**
1. 解壓 `abyss-hunters-netlify.zip`，打開裡面的 `config.js`，把網址填進去：
   ```js
   window.ABYSS_SERVER = 'https://abyss-hunters.onrender.com';
   ```
2. 到 [Netlify Drop](https://app.netlify.com/drop)，把整個資料夾拖進去，完成。
3. 之後換伺服器網址：在 Netlify 重新上傳修改過 `config.js` 的資料夾即可。

**方法 B：自己建置**
```bash
cd dungeon-coop
npm install
npm run build:netlify -- https://abyss-hunters.onrender.com
# 產生 dist/netlify-site/（拖到 Netlify Drop）與 dist/abyss-hunters-netlify.zip
```

## 步驟 3（建議）：限制只有你的網站能使用伺服器

在 Render 的 Environment 把 `CORS_ORIGIN` 改成你的 Netlify 網址（例如 `https://abyss-hunters.netlify.app`）。

## 其他

- 手機要能「鎖定橫向全螢幕」需要 HTTPS；Netlify 與 Render 預設都是 HTTPS。
- AI 生成的音樂：把 `hub.mp3`、`dungeon.mp3`、`boss.mp3`、`title.mp3` 放進網站的 `music/` 資料夾，並把檔名加進 `music/index.json` 的 `files` 陣列。
- 只想在家裡或同一個 Wi-Fi 玩：不用 Netlify，直接 `npm install && npm start`，朋友連 `http://你的電腦IP:3000`。
