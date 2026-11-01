/**
 * settings.js — App 設定（v0.10.0）：外觀、上次備份時間。
 *
 * 存在 tp2_settings（一個只有一筆的陣列，沿用 storage.js 的讀寫方式）。
 *   theme         string  system 跟隨系統（預設）／light 淺色／dark 深色
 *   lastBackupAt  string  上次匯出備份的時間（ISO 字串）或 ""
 *
 * 資安：讀出時檢查格式，不認得的值用預設值。
 */
import { readCollection, writeCollection } from "../core/storage.js";

const COLLECTION = "settings";
export const THEMES = [
  { value: "system", label: "跟隨系統" },
  { value: "light", label: "淺色" },
  { value: "dark", label: "深色" },
];
const THEME_VALUES = new Set(THEMES.map((t) => t.value));
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function normalizeSettings(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    theme: THEME_VALUES.has(r.theme) ? r.theme : "system",
    lastBackupAt: typeof r.lastBackupAt === "string" && ISO.test(r.lastBackupAt) ? r.lastBackupAt : "",
  };
}

export const settingsStore = {
  get() {
    return normalizeSettings(readCollection(COLLECTION)[0]);
  },
  /** 改其中幾個設定；回傳 true／false（寫入失敗） */
  set(patch) {
    return writeCollection(COLLECTION, [normalizeSettings({ ...this.get(), ...patch })]);
  },
};
