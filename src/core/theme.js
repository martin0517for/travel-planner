/**
 * theme.js — 深色／淺色模式。
 * 目前固定「跟隨系統」：iPhone 切換深色模式時，App 會即時跟著換。
 * 之後做「設定」頁時，會加上手動選擇淺色／深色的選項。
 */
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function applyTheme(preference = "system") {
  const dark = preference === "dark" || (preference === "system" && media.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function watchSystemTheme(getPreference) {
  media.addEventListener("change", () => applyTheme(getPreference()));
}
