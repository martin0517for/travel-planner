# Travel Planner（旅行規劃）v2

個人用旅遊管理 PWA，以 iPhone 為主要使用裝置。

- 網址：https://martin0517for.github.io/travel-planner/
- 技術：純 HTML / CSS / JavaScript（ES Modules），不用框架、不需建置；資料存在手機本機（localStorage）
- 規格書與開發紀錄：放在 Claude Project 知識庫（`travel-planner-spec.md`、`travel-planner-devlog.md`）
- 舊版（v1）：`legacy-v1` 分支

## 資料夾

```
index.html          進入點（含內容安全政策 CSP）
service-worker.js   離線快取（網路優先）
public/             圖示、字體
src/main.js         路由表
src/core/           共用工具：html.js（安全輸出）、router、icons、theme
src/features/       各功能頁面
src/styles/         tokens（色彩、字體、間距）、base、各區塊樣式
```

## 開發規則

- 畫面一律用 `render(container, html\`...\`)`，插入的值會自動跳脫；不直接寫 `innerHTML`。
- HTML 裡不寫 `style="..."`（CSP 會擋），樣式寫在 CSS 檔。
- 外部連結網址先經過 `safeUrl()` 檢查，並加上 `rel="noopener noreferrer"`。
