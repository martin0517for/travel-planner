/**
 * SettingsService — App 全域設定（跟旅程無關，只有一份）。
 * 重點是 applyTheme：把 theme 設定值（light/dark/system）換算成
 * 實際要用的 light 或 dark，寫到 <html data-theme="..."> 屬性上，
 * CSS 那邊 [data-theme="dark"] 選擇器會自動套用深色配色（見 tokens.css）。
 */
import { settingsRepository } from "../data/repositories/settingsRepository.js";

// 系統深色/淺色模式切換的監聽器只需要註冊一次，用這個變數避免重複註冊
let systemThemeListenerAttached = false;

export const settingsService = {
  getSettings() {
    return settingsRepository.get();
  },

  updateSettings(patch) {
    const next = { ...this.getSettings(), ...patch };
    settingsRepository.save(next);
    if ("theme" in patch) this.applyTheme();
    return next;
  },

  /** 依目前設定（含 system 跟隨系統）把實際的 light/dark 套用到 <html data-theme> */
  applyTheme() {
    const { theme } = this.getSettings();
    const resolved = theme === "system" ? systemPrefersDark() ? "dark" : "light" : theme;
    document.documentElement.setAttribute("data-theme", resolved);

    if (theme === "system" && !systemThemeListenerAttached) {
      systemThemeListenerAttached = true;
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (this.getSettings().theme === "system") this.applyTheme();
      });
    }
  },
};

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
