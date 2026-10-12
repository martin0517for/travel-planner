# 維護指南 — 你需要知道的東西

這份文件是給「要接手維護這個專案的你」看的。不需要一次全部學會，
遇到要改的地方，回來查對應章節就好。

---

## 一、需要具備的知識（由淺到深）

### 1. 一定要會：HTML / CSS 基礎
- **HTML**：標籤、屬性、`<div>`／`<button>`／`<input>`／`<form>` 這些基本元素怎麼用。
- **CSS**：
  - Box model（`padding`／`margin`／`border`）
  - Flexbox（這個專案幾乎所有排版都是 `display: flex`，一定要懂 `flex-direction`、`justify-content`、`align-items`）
  - **CSS 自訂變數（CSS Custom Properties）**：整個專案的顏色、間距都是用 `var(--color-ink)` 這種變數，定義在 `src/styles/tokens.css`。深色模式能整套切換，靠的就是這個機制（改變數的值，用到變數的地方全部自動變）。
  - Media Query（`@media (min-width: 700px)`）：用來做手機／桌面版的差異。

### 2. 一定要會：JavaScript（ES6+ 語法）
這個專案**沒有用任何框架**（不是 React／Vue），是「原生 JavaScript」，但用了比較現代的語法，以下都要看得懂：

| 語法 | 範例 | 出現在哪裡 |
|---|---|---|
| `import` / `export`（ES Modules） | `import { tripService } from "../services/tripService.js"` | 幾乎每個檔案開頭 |
| Arrow function | `(a, b) => a + b` | 到處都是 |
| Template literal（模板字串） | `` `你好 ${name}` `` | 所有拼 HTML 字串的地方 |
| Destructuring（解構） | `const { name, id } = trip` | 函式參數、資料處理 |
| Spread（展開） | `{ ...draft, name: "新名字" }` | 更新資料時常用，複製物件再改一個欄位 |
| `class` / `extends` | `class TripRepository extends BaseRepository` | `data/repositories/` 底下每個檔案 |
| `async` / `await` | `await promptEvent.userChoice` | PWA 安裝、Web Share API |
| Array 方法：`map` / `filter` / `find` / `forEach` / `sort` | `trips.filter(t => t.isDone)` | 幾乎每個 Service／View |
| `Promise` | `new Promise((resolve, reject) => {...})` | `core/leafletLoader.js`（動態載入地圖套件） |
| 三元運算子 | `condition ? "A" : "B"` | 拼 HTML 字串時常用 |
| Optional chaining / 預設值 | `place?.name`、`text || ""` | 到處都是，避免資料是 `null` 時噴錯 |

### 3. 一定要會：DOM 操作（沒有框架，所以要手動做框架幫你做的事）
- `document.createElement()`、`element.innerHTML = ...`、`element.appendChild()`
- `element.querySelector()` / `querySelectorAll()`：用 CSS 選擇器抓元素
- `element.addEventListener("click", fn)`：綁事件
- `element.dataset.xxx`：讀 HTML 裡的 `data-xxx="..."` 屬性（這個專案大量用 `data-action="xxx"` 搭配事件委派，見下方「本專案的重複模式」）

### 4. 瀏覽器內建功能（Web APIs）
- **`localStorage`**：整個 App 唯一的資料庫，字串 key-value，只能存字串（所以資料都要 `JSON.stringify` / `JSON.parse`）。
- **`FileReader`**：讀使用者選的檔案內容（資料匯入、旅程分享匯入都用到）。
- **`Blob` + `URL.createObjectURL`**：把 JavaScript 物件包成一個「檔案」讓瀏覽器下載（資料匯出、分享旅程都用到）。
- **`navigator.share`（Web Share API）**：叫出手機/電腦的系統分享面板。
- **`matchMedia`**：偵測系統是淺色還深色模式（設定頁「跟隨系統」用這個）。
- **Service Worker + Web App Manifest**：PWA 能「安裝」、離線使用的關鍵，在 `service-worker.js` 和 `manifest.json`。

### 5. 外部套件（只有一個）
- **[Leaflet](https://leafletjs.com/)**：地圖套件，透過 CDN 動態載入（見 `core/leafletLoader.js`），不是 npm 安裝的。要查地圖相關 API（`L.map()`、`L.marker()`、`L.polyline()`…）直接查 Leaflet 官方文件。

### 5.5 共用圖示：`src/core/icons.js`
App 裡的圖示（底部導覽列、行程分類、清單分頁）統一走這個模組，不再直接寫 emoji。慣例：
- 每個圖示是一組 SVG `<path>`／`<circle>` 字串，存在 `PATHS` 這個物件裡，key 是圖示名稱（例如 `"attraction"`）
- `svgIcon(name)` 包成完整的 `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ...>`，`stroke="currentColor"` 代表顏色會跟著外層文字色（`color: ...`）走，不用每個圖示自己設顏色
- 要加新圖示：在 `PATHS` 加一組 key，去 [Lucide Icons](https://lucide.dev/) 或類似的線條圖示庫找同風格的 SVG path 複製過來（記得統一改成 `viewBox 0 0 24 24`、拿掉圖示庫自帶的顏色屬性）
- 底部導覽列 `navBar.js` 目前是自己內建一份類似的 `ICONS` 物件（尚未整合進 `core/icons.js`），兩邊圖示風格要保持一致（同樣的 `stroke-width`、`stroke-linecap`、`stroke-linejoin`），以後如果要新增圖示、或想把兩邊合併成同一個來源，可以考慮把 `navBar.js` 的 `ICONS` 也搬進 `core/icons.js`

### 6. 不用會，但知道存在就好
- 沒有用 TypeScript（純 JavaScript，沒有型別檢查，改資料結構時要自己小心命名一致）。
- 沒有用建構工具（沒有 Vite/Webpack，`<script type="module">` 直接讀 `.js` 檔案，所以**改完程式碼不用「build」，重新整理瀏覽器就看得到結果**）。
- 沒有後端伺服器、沒有資料庫帳號密碼要管理。

---

## 二、專案架構總覽

```
資料怎麼流動：
使用者點擊 → View（畫面） → Service（商業邏輯／驗證） → Repository（資料存取） → localStorage
```

### 資料夾對照表

| 資料夾 | 放什麼 | 類比 |
|---|---|---|
| `src/data/models/` | 資料長什麼樣子（欄位定義），不含邏輯 | 「表格結構」 |
| `src/data/repositories/` | 讀寫 localStorage 的程式碼，每種資料一個 Repository | 「資料庫存取層」 |
| `src/services/` | 商業邏輯：驗證輸入、跨資料表整合、排序 | 「後端邏輯層」（雖然這裡沒有後端） |
| `src/features/<功能>/` | 畫面本身：組 HTML、綁事件 | 「前端頁面」 |
| `src/core/` | 跟特定功能無關的工具（路由、localStorage 存取、動態載入 Leaflet…） | 「共用工具」 |
| `src/styles/` | CSS，`tokens.css`＝顏色字體變數，`base.css`＝版面骨架，`components.css`＝各元件樣式 | |

### 為什麼要分這三層（View / Service / Repository）？

**最重要的規則：View 只能呼叫 Service，不能直接呼叫 Repository。**

好處：如果以後要把 `localStorage` 換成 Firebase 之類的雲端資料庫，只要改 Repository 那一層，Service 跟 View 完全不用動——因為 View 呼叫的是 `tripService.listTrips()`，它不知道、也不需要知道底層資料到底存在哪裡。

---

## 三、本專案的重複模式（看懂一個，其他都一樣）

這個專案**沒有用框架**，所以很多「畫面」的程式碼長得幾乎一樣，是手動重複同一套模式。看懂下面三種模式，全部 40 幾個檔案幾乎都能看懂：

### 模式一：Repository（資料存取）
**範例檔案：`src/data/repositories/tripRepository.js`**
```js
class TripRepository extends BaseRepository {
  constructor() {
    super("tp_trips", "trip"); // "tp_trips" 是存在 localStorage 的 key 名稱
  }
  // 額外的查詢方法寫在這裡，基本的新增/刪除/修改 BaseRepository 都已經寫好了
}
export const tripRepository = new TripRepository();
```
每種資料（航班、住宿、地點…）都照這個模式各寫一個檔案。CRUD（新增/讀取/修改/刪除）都繼承自 `BaseRepository.js`，不用重寫。

### 模式二：Service（邏輯層）
**範例檔案：`src/services/tripService.js`**
```js
export const tripService = {
  listTrips() { /* 呼叫 repository，可能加工一下資料再回傳 */ },
  createTrip(input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    // 驗證過了才真的呼叫 repository.create()
    return { ok: true, trip: tripRepository.create(input) };
  },
  validate(input) { /* 檢查必填欄位等 */ },
};
```
所有「新增/編輯」的操作都回傳 `{ ok: true/false, ... }` 這種格式，View 那邊看 `ok` 決定要不要顯示錯誤訊息。

### 模式三：View（畫面）—— 又分兩種

**(a) 列表／頁面**，範例：`src/features/trips/tripListView.js`
```js
export function renderXxxView(container) {
  const wrapper = document.createElement("div");
  container.appendChild(wrapper);
  paint(wrapper);
}

function paint(wrapper) {
  const data = xxxService.list();
  wrapper.innerHTML = `...拼出一整串 HTML...`;   // ← 用資料組字串
  wrapper.querySelectorAll("[data-action='xxx']").forEach(el => {
    el.addEventListener("click", () => { ...; paint(wrapper); }); // ← 操作完重新 paint 整個畫面
  });
}
```
這個「改資料 → 整個區塊重新畫一次」的做法，是這個專案**沒有框架時最簡單可靠的更新畫面方式**（代價是效能較差，但這種規模的 App 感覺不出來）。

**(b) Modal 表單**，範例：`src/features/trips/tripFormView.js`
```js
export function openXxxForm({ existingItem = null, onSaved }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `...表單 HTML...`;
  document.body.appendChild(backdrop);
  // 綁「取消」「儲存」按鈕事件，儲存成功後呼叫 onSaved() 讓外面的畫面重新整理
}
```

### `data-action` + 事件委派

HTML 字串裡常看到 `data-action="edit"` 這種寫法，JS 那邊用：
```js
wrapper.querySelectorAll("[data-action='edit']").forEach(btn => {
  btn.addEventListener("click", () => { ... });
});
```
這是因為 `innerHTML = ...` 整個重寫之後，舊的事件監聽器全部失效，所以每次 `paint()` 都要重新找元素、重新綁事件。`data-action` 只是一個好找、好讀的標記，不是瀏覽器特殊語法。

---

## 四、路由（分頁怎麼切換）

沒有用任何路由套件，是自己寫的極簡版（`src/core/router.js`），靠網址的 `#` 後面那段（hash）決定顯示哪個畫面，例如 `#/trips/abc123/schedule`。

- `routes` 物件（在 `src/main.js`）：把「網址規則」對應到「要執行哪個 render 函式」。
- 網址規則可以有參數，例如 `/trips/:id` 裡的 `:id` 會被抓出來，變成 `params.id`。

### 底部導覽列的兩種模式
`src/features/shell/navBar.js` 裡分成「全域模式」（我的旅程／設定）跟「旅程模式」（進到某趟旅程後的總覽／行程／地圖／清單），`src/main.js` 的 `TRIP_SCOPED_PATTERNS` 決定現在該顯示哪一種。

---

## 五、資料模型關聯圖

```
Trip（旅程）
 │
 ├─ Flight（航班）──────┐
 ├─ Accommodation（住宿）├─→ 都用 tripId 指回 Trip
 ├─ DayPlan（每日行程）──┘   （不是 Trip 裡存一個陣列，是反過來查）
 └─ ChecklistItem（清單項目，行李/記事本/必買）

Place（地點資料庫，全域共用，不屬於任何一趟旅程）
 ↑
 被 Flight.departurePlaceId / arrivalPlaceId
    Accommodation.placeId
    DayPlan.items[].placeId
    ChecklistItem.placeId
 引用（用 id 字串關聯，不是真的資料庫外鍵，純粹是「存一個 id，要用的時候自己去 Place 表查」）
```

**這個關聯設計是全專案最重要的觀念**：改任何一個地方的資料結構，記得檢查有沒有其他地方存了它的 `id` 需要一起處理（例如刪除旅程時，`tripService.deleteTrip()` 要記得把 Flight/Accommodation/DayPlan/ChecklistItem 也一起刪掉，不然會留下孤兒資料）。

---

## 六、常見的維護情境

### 情境 1：想加一個新欄位（例如給 Trip 加「旅伴人數」）
1. `data/models/Trip.js`：`createTripDraft()` 加上新欄位預設值，註解裡也補上欄位說明
2. `features/trips/tripFormView.js`：表單加一個 `<input>`，存檔時讀出來塞進 `input` 物件
3. `features/trips/tripListView.js` / `tripDetailView.js`：要顯示的地方自己加

### 情境 2：想加一個新的資料類型（例如「旅費記錄」）
照著 Flight 的模式抄一份：
1. `data/models/Expense.js`（照 `Flight.js` 的格式）
2. `data/repositories/expenseRepository.js`（照 `flightRepository.js`）
3. `services/expenseService.js`（照 `flightService.js`）
4. `features/expenses/expenseFormView.js` + 顯示的地方（照 `flightFormView.js` / `tripDetailView.js`）
5. 別忘了 `tripService.deleteTrip()` 加上連帶刪除、`core/dataKeys.js` 的匯出清單加上新的 localStorage key

### 情境 3：改樣式
先去 `src/styles/tokens.css` 看有沒有現成的顏色/間距變數可以用，盡量不要在元件 CSS 裡寫死顏色值（寫死的話深色模式不會自動適配）。

### 情境 3.5：⚠️ `.field` 底下放 checkbox／radio／自訂 `<label>` 排版要特別小心
`base.css` 裡 `.field input`、`.field label` 這兩條規則，原本是專門給「文字輸入框 + 上方標籤」這種標準表單欄位設計的（例如 `<div class="field"><label>姓名</label><input></div>`）。如果在 `.field` 裡面放別的東西——最常見的就是 checkbox／radio 搭配 `.form-checkbox-row` 這種自訂排版——會踩到兩個坑：

1. `.field input { width: 100%; padding: ...; }` 沒有排除 `type="checkbox"` / `type="radio"` 的話，會把 checkbox 撐成一個跟輸入框一樣寬、有內距的大方塊（已在分享旅程 Modal 遇過，見 README 第十五輪）。
2. `.field label { display: block; }` 的 CSS 優先權比 `.form-checkbox-row { display: flex; }` 高（前者多一個 `label` 元素選擇器），會蓋掉 flex 排版，讓 checkbox 跟文字變成上下疊、而不是左右並排。

目前的修法是讓這兩條規則明確排除特殊情況（`.field input:not([type="checkbox"]):not([type="radio"])`、`.field label:not(.form-checkbox-row)`）。**以後如果要在 `.field` 裡放任何不是「純文字輸入框＋標準標籤」的東西，記得檢查這兩條規則會不會誤套用**，或考慮乾脆不要包在 `.field` 裡（`.field` 本身只提供 `margin-bottom`，不是必要的）。

### 情境 4：JS 改了但瀏覽器沒反應
- 確認是用 `npx serve .` 或 `python3 -m http.server` 這種本機伺服器開的，不是直接雙擊 `index.html`（ES Modules 在 `file://` 協定下會被瀏覽器擋掉）。
- 硬重新整理（`Ctrl+Shift+R` / `Cmd+Shift+R`），避免瀏覽器快取舊檔案。
- 打開瀏覽器開發者工具（F12）的 Console 分頁看有沒有紅字錯誤，通常會直接告訴你是哪個檔案、哪一行。

---

## 七、部署

純靜態檔案，沒有 build 步驟。整個 `travel-planner/` 資料夾直接拖進 [Netlify Drop](https://app.netlify.com/drop) 就能上線，或用 Netlify CLI／接 GitHub 都可以。
