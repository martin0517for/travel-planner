/**
 * main.js — App 的進入點（index.html 只載入這個檔案）。
 *
 * 做三件事：
 *   1. 套用深色／淺色模式
 *   2. 定義路由表：網址 → 哪個頁面
 *   3. 每次換頁時，畫出外框（頂部列、底部導覽）＋頁面內容
 *
 * 每個頁面函式的格式：(container, params) => meta
 *   container 是內容區，頁面把自己畫進去；回傳的 meta 給外框用（見 features/shell/shell.js）。
 */
import { createRouter } from "./core/router.js";
import { applyTheme, watchSystemTheme } from "./core/theme.js";
import { renderShell } from "./features/shell/shell.js";
import { renderPlaceholder } from "./features/shell/placeholder.js";
import { renderTripList } from "./features/trips/tripList.js";
import { renderTripOverview } from "./features/trips/tripOverview.js";
import { tripStore } from "./data/trips.js";
import { renderPlaceList } from "./features/places/placeList.js";
import { renderSettings } from "./features/settings/settings.js";
import { renderTripLists } from "./features/lists/tripLists.js";
import { renderSchedule } from "./features/schedule/schedule.js";
import { settingsStore } from "./data/settings.js";
import { migrateItemNotes } from "./data/placeNotes.js";

// 外觀：照設定頁選的（跟隨系統／淺色／深色，v0.10.0）；跟隨系統時，iPhone 切換深色模式會即時跟著換
applyTheme(settingsStore.get().theme);
migrateItemNotes(); // v0.13.0：有地點的行程項目備註搬進「這趟的備註」（搬過的不會再動）
watchSystemTheme(() => settingsStore.get().theme);

// 「地點資料庫」和「設定」是全域頁面（從右上角進入），
// 記住進去之前在哪一頁，它們的返回鍵才能回到原處
const GLOBAL_PAGES = new Set(["/places", "/settings"]);
let lastMainPath = "/trips";

/**
 * 旅程內的頁面共用這個包裝：先用網址的 id 找旅程，找不到就顯示「找不到」，
 * 找到就交給各頁面的 renderBody 畫內容。標題一律顯示旅程名稱。
 */
const tripPage = (active, eyebrow, renderBody) => (container, { id }) => {
  const trip = tripStore.get(id);
  if (!trip) {
    renderPlaceholder(container, { heading: "找不到這趟旅程", note: "它可能已經被刪除了。" });
    return { eyebrow, title: "找不到旅程", back: "/trips" };
  }
  // refresh：資料改了之後重畫目前頁面（含頂部標題）
  const refresh = () => router.refresh();
  renderBody(container, trip, refresh);
  return { eyebrow, title: trip.name, back: "/trips", tripId: trip.id, active };
};

/** 從「進入全域頁面前的路徑」找出所在的旅程（例如 /trips/trip_abc/lists → 那趟旅程），不在旅程裡就是 null */
function tripFromPath(path) {
  const m = /^\/trips\/([^/]+)/.exec(path || "");
  if (!m) return null;
  try {
    return tripStore.get(decodeURIComponent(m[1]));
  } catch {
    return null;
  }
}

const comingSoon = (heading) => (container) =>
  renderPlaceholder(container, { heading, note: "這一頁會在後續步驟實作。" });

const routes = {
  "/trips": renderTripList,
  "/trips/:id": tripPage("overview", "Overview", renderTripOverview),
  "/trips/:id/schedule": tripPage("schedule", "Schedule", renderSchedule),
  "/trips/:id/map": tripPage("map", "Map", comingSoon("地圖")),
  "/trips/:id/lists": tripPage("lists", "Lists", renderTripLists),
  // 從某趟旅程裡打開時，帶入那趟旅程：地點前面會有圓圈，可以快速加入那趟的想去地點（9.2，2026-11-01）
  "/places": (container) => ({ ...renderPlaceList(container, { trip: tripFromPath(lastMainPath) }), back: lastMainPath, page: "places" }),
  "/settings": (container) => ({ ...renderSettings(container), back: lastMainPath, page: "settings" }),
};

function notFound(container) {
  renderPlaceholder(container, { heading: "找不到這個頁面", note: "請按左上角返回。" });
  return { eyebrow: "404", title: "找不到頁面", back: "/trips" };
}

const page = document.getElementById("page");

const router = createRouter({
  routes,
  notFound,
  onRoute({ pattern, params, handler }) {
    const meta = handler(page, params);
    renderShell(meta);
    if (!GLOBAL_PAGES.has(pattern)) {
      lastMainPath = window.location.hash.replace(/^#/, "") || "/trips";
    }
  },
  onNavigate() {
    window.scrollTo(0, 0); // 換頁時回到頂端（同一頁重畫時不捲動）
  },
});
router.start();

// 離線功能：註冊 Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      /* 註冊失敗不影響使用，安靜略過 */
    });
  });
}
