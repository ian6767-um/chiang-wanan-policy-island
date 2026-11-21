# 澎湖慢釣

2D 像素風的療癒放置型釣魚遊戲。帶著橘色虎斑貓「小卷」，開小船在澎湖群島的 12 個釣點自動釣魚，整理格子背包，到馬公第三漁港賣魚、升級裝備，收集 50 種魚。

網頁版（PWA），原生 JavaScript＋Canvas，不需要建置。介面是繁體中文，字型用 [Cubic 11](https://github.com/ACh-K/Cubic-11)（OFL 授權，放在 `assets/fonts/`）。

## 執行

```sh
cd penghu-fishing
python3 -m http.server 8080   # 然後打開 http://localhost:8080
```

必須用 http 伺服器開，直接打開 `index.html` 會讀不到 JSON。

## 操作

| | 觸控 | PC |
|---|---|---|
| 背包 | 右下背包按鈕 | B |
| 地圖 | 右上地圖按鈕；兩指縮放、單指拖曳 | M；滾輪縮放 |
| 圖鑑 | 右上書本按鈕；左右滑動換魚 | C；←→ |
| 背包裡移動魚 | 長按 0.2 秒拿起、拖曳；拿著時另一隻手指點一下就旋轉 | 拖曳；R 或右鍵旋轉；Delete 丟掉 |
| 商店分頁 | 左右滑動 | Q／E |
| 漁獲卡 | 保留／放生 | K 保留、X 放生 |
| 除錯面板 | 設定 → 除錯面板 | ` |

## 測試

```sh
npm test                 # 單元測試：背包、釣魚規則、資料表與設計文件是否一致、存檔、離線收益（49 項）
npm run test:e2e         # Playwright 端對端：每個畫面與流程、手機直向提示、四種寬螢幕比例、觸控拖曳（19 項）
npm run test:tools       # 美術流水線與資產檢查
npm run check:assets     # 檢查 assets/ 是否符合美術聖經
```

CI 設定在 `.github/workflows/penghu-fishing.yml`。git pre-commit hook：`cp penghu-fishing/tools/pre-commit .git/hooks/`。

## 檔案結構

```
data/          所有數值：魚種 fish.json、釣點 spots.json、釣竿、魚餌、船、背包、台詞，以及可調參數 config.json
src/core/      遊戲規則（不碰畫面，可以在 Node 測試）：背包、抽魚、時鐘天氣季節、魚市、離線、存檔
src/render/    程序化像素圖：場景、魚、角色、肖像、地圖、圖示（只用 palette/master.hex 的 62 色）
src/game/      主迴圈、即時釣魚場景、螢幕縮放與橫向、音效
src/ui/        HUD、漁獲卡、背包、魚市、釣具店、地圖、圖鑑、設定、除錯
tools/         pixel_pipeline.py（AI 圖 → 像素圖）、check_assets.py、make_icons.cjs
docs/          設計文件校對紀錄
```

## 和設計文件的差異

設計文件有幾個事實錯誤和前後矛盾，實作時已經修正。詳見 [docs/design-review.md](docs/design-review.md)。
