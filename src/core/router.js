/**
 * router.js — 用網址的 # 後面那段決定要顯示哪一頁（hash router）。
 *
 * 例：#/trips/abc123/schedule 會比對到 "/trips/:id/schedule"，params = { id: "abc123" }。
 * 用 hash 的好處：GitHub Pages 這種純靜態主機不需要任何設定，重新整理也不會 404。
 */

export function createRouter({ routes, notFound, onRoute, onNavigate }) {
  const compiled = Object.entries(routes).map(([pattern, handler]) => {
    const keys = [];
    const regex = new RegExp(
      "^" +
        pattern.replace(/:([a-zA-Z]+)/g, (_, key) => {
          keys.push(key);
          return "([^/]+)";
        }) +
        "/?$"
    );
    return { pattern, regex, keys, handler };
  });

  function resolve() {
    const path = window.location.hash.replace(/^#/, "") || "/trips";
    for (const route of compiled) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.keys.forEach((key, i) => {
          // 網址參數可能被人亂改，decode 失敗就當作找不到頁面
          try {
            params[key] = decodeURIComponent(match[i + 1]);
          } catch {
            params[key] = "";
          }
        });
        onRoute({ pattern: route.pattern, params, handler: route.handler });
        return;
      }
    }
    onRoute({ pattern: null, params: {}, handler: notFound });
  }

  return {
    start() {
      window.addEventListener("hashchange", () => {
        resolve();
        if (onNavigate) onNavigate();
      });
      resolve();
    },
    /** 重畫目前頁面（資料改了之後用），不捲動 */
    refresh: resolve,
  };
}

/** 切換頁面 */
export function navigate(path) {
  window.location.hash = path;
}
