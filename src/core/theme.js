/**
 * theme.js — 深色／淺色模式。
 * preference：system 跟隨系統（iPhone 切換深色模式時即時跟著換）／light 淺色／dark 深色。
 * 選擇存在 data/settings.js，設定頁可以改（v0.10.0）。
 */
const media = window.matchMedia("(prefers-color-scheme: dark)");

export function applyTheme(preference = "system") {
  const dark = preference === "dark" || (preference === "system" && media.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function watchSystemTheme(getPreference) {
  media.addEventListener("change", () => applyTheme(getPreference()));
}
