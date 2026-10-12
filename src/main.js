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

applyTheme("system");
watchSystemTheme(() => "system");

// 記住「進設定頁之前」在哪一頁，設定頁的返回鍵才能回到原處
let lastNonSettingsPath = "/trips";

const tripPage = (active, eyebrow, heading) => (container, { id }) => {
  renderPlaceholder(container, { heading, note: "這一頁會在後續步驟實作。" });
  return { eyebrow, title: "旅程", back: "/trips", tripId: id, active };
};

const routes = {
  "/trips": (container) => {
    renderPlaceholder(container, { heading: "我的旅程", note: "下一步會在這裡做旅程列表。" });
    return { eyebrow: "Trips", title: "我的旅程", back: null };
  },
  "/trips/:id": tripPage("overview", "Overview", "總覽"),
  "/trips/:id/schedule": tripPage("schedule", "Schedule", "行程"),
  "/trips/:id/map": tripPage("map", "Map", "地圖"),
  "/trips/:id/lists": tripPage("lists", "Lists", "清單"),
  "/settings": (container) => {
    renderPlaceholder(container, { heading: "設定", note: "深色模式、資料備份等設定會放在這裡。" });
    return { eyebrow: "Settings", title: "設定", back: lastNonSettingsPath, hideSettings: true };
  },
};

function notFound(container) {
  renderPlaceholder(container, { heading: "找不到這個頁面", note: "請按左上角返回。" });
  return { eyebrow: "404", title: "找不到頁面", back: "/trips" };
}

const page = document.getElementById("page");

createRouter({
  routes,
  notFound,
  onRoute({ pattern, params, handler }) {
    const meta = handler(page, params);
    renderShell(meta);
    if (pattern !== "/settings") {
      lastNonSettingsPath = window.location.hash.replace(/^#/, "") || "/trips";
    }
    window.scrollTo(0, 0); // 換頁時回到頂端
  },
}).start();

// 離線功能：註冊 Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      /* 註冊失敗不影響使用，安靜略過 */
    });
  });
}
