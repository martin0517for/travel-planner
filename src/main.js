/**
 * main.js — 整個 App 唯一的進入點，index.html 用 <script type="module"> 載入這個檔案。
 * 這裡做三件事：
 *   1. 套用深色模式（一進來就先設定好，避免畫面閃一下）
 *   2. 註冊路由表（網址 → 要顯示哪個畫面）
 *   3. 啟動 router，並且在每次切換分頁時更新頂部標題 + 底部導覽列
 *
 * 想加一個新分頁？在下面的 `routes` 物件加一行，指到對應的 render 函式，
 * 如果那個分頁是「進到某趟旅程之後」才會有的（像行程／地圖／清單），
 * 記得也把路徑加進 TRIP_SCOPED_PATTERNS，導覽列才會切換成旅程模式。
 *
 * 「設定」頁比較特別：它是全域頁面，但為了讓使用者在旅程裡點「設定」之後，
 * 底部導覽列還能維持該趟旅程的五分頁列，這裡用 sessionStorage 記住「最後待過的 tripId」
 * （見下方 rememberTripId／forgetTripId／recalledTripId）。
 */
import { createRouter } from "./core/router.js";
import { renderNavBar } from "./features/shell/navBar.js";
import { renderTripListView } from "./features/trips/tripListView.js";
import { renderTripDetailView } from "./features/trips/tripDetailView.js";
import { renderTripScheduleView } from "./features/schedule/tripScheduleView.js";
import { renderTripMapView } from "./features/map/tripMapView.js";
import { renderTripListsView } from "./features/lists/tripListsView.js";
import { renderPlaceListView } from "./features/places/placeListView.js";
import { renderSettingsView } from "./features/settings/settingsView.js";
import { settingsService } from "./services/settingsService.js";

// 進來就先套用深色／淺色模式，避免畫面先閃一下淺色再切換
settingsService.applyTheme();

// 攔截瀏覽器的安裝提示，讓「設定」頁可以放一個自己的安裝按鈕
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
});

// pattern -> { title, eyebrow }。找不到就代表由該路由的 view 自己設定標題
// （旅程總覽／行程／地圖／清單這幾頁，標題要顯示旅程目的地，所以自己管理）。
const PAGE_META = {
  "/trips": { title: "我的旅程", eyebrow: "TRIPS" },
  "/settings": { title: "設定", eyebrow: "SETTINGS" },
  "/places": { title: "地點資料庫", eyebrow: "PLACES" },
};

// 進入這些路由代表使用者已經選定一趟旅程，底部導覽列要切換成該旅程專屬的
// 「總覽／行程／地圖／清單／設定」，而不是全域的「我的旅程／設定」。
const TRIP_SCOPED_PATTERNS = new Set(["/trips/:id", "/trips/:id/schedule", "/trips/:id/map", "/trips/:id/lists"]);

// 「目前在哪趟旅程底下」的記憶：進到旅程專屬頁面時記住 tripId，離開旅程模式頁面
// （schedule/map/lists/總覽）之後如果又去了「設定」，底部導覽列仍然可以維持該趟旅程的
// 五分頁列（總覽／行程／地圖／清單／設定），不用先跳回旅程列表才能切到行程/地圖/清單。
// 存在 sessionStorage 是為了重新整理頁面時記憶還在（分頁關掉就清掉，不會跨分頁互相干擾）。
const LAST_TRIP_KEY = "tp_last_trip_id";
function rememberTripId(id) {
  try {
    sessionStorage.setItem(LAST_TRIP_KEY, id);
  } catch {
    /* 無痕模式等 sessionStorage 被擋掉時安靜略過，退回沒有記憶的行為 */
  }
}
function forgetTripId() {
  try {
    sessionStorage.removeItem(LAST_TRIP_KEY);
  } catch {
    /* 同上 */
  }
}
function recalledTripId() {
  try {
    return sessionStorage.getItem(LAST_TRIP_KEY);
  } catch {
    return null;
  }
}

const routes = {
  "/trips": renderTripListView,
  "/trips/:id": renderTripDetailView,
  "/trips/:id/schedule": renderTripScheduleView,
  "/trips/:id/map": renderTripMapView,
  "/trips/:id/lists": renderTripListsView,
  "/places": renderPlaceListView,
  "/settings": renderSettingsView,
};

const appView = document.getElementById("app-view");
const topbarTitle = document.getElementById("topbar-title");
const topbarEyebrow = document.getElementById("topbar-eyebrow");
const navSlot = document.getElementById("nav-slot");

const router = createRouter(routes, {
  container: appView,
  defaultPath: "/trips",
  onNavigate(pattern, params, hash) {
    const meta = PAGE_META[pattern];
    if (meta) {
      topbarTitle.textContent = meta.title;
      topbarEyebrow.textContent = meta.eyebrow;
    }

    navSlot.innerHTML = "";
    if (TRIP_SCOPED_PATTERNS.has(pattern)) {
      // 旅程模式：導覽列顯示這趟旅程的總覽／行程／地圖／清單／設定，用完整路徑（含 id）比對目前分頁
      rememberTripId(params.id);
      navSlot.appendChild(renderNavBar(hash, { tripId: params.id }));
    } else if (pattern === "/settings") {
      // 設定頁比較特別：它是全域頁面，但如果使用者是從某趟旅程裡點進來的，
      // 底部導覽列要維持那趟旅程的五分頁列（「設定」會是 active 的那個），
      // 而不是直接切回全域的「我的旅程／設定」兩分頁，這樣才能直接點回行程/地圖/清單。
      const tripId = recalledTripId();
      navSlot.appendChild(renderNavBar(hash, { tripId }));
    } else {
      // 全域模式：/places 視覺上歸在「我的旅程」底下
      // 回到旅程列表代表使用者主動離開旅程模式，清掉記憶，之後去設定頁就會是全域兩分頁
      if (pattern === "/trips") forgetTripId();
      const activePath = pattern === "/places" ? "/trips" : pattern;
      navSlot.appendChild(renderNavBar(activePath));
    }
  },
});

router.start();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      /* Service Worker 註冊失敗時安靜略過，不影響核心功能 */
    });
  });
}
