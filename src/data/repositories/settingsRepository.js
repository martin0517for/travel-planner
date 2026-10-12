import { localStorageAdapter } from "../../core/db/localStorageAdapter.js";
import { defaultSettings } from "../models/Settings.js";

const KEY = "tp_settings";

class SettingsRepository {
  get() {
    const raw = localStorageAdapter.getCollection(KEY);
    // Settings 是單一物件，借用 getCollection/setCollection 存取（它們本來就是存 JSON，物件也行）
    if (raw && !Array.isArray(raw)) return { ...defaultSettings(), ...raw };
    return defaultSettings();
  }

  save(settings) {
    localStorageAdapter.setCollection(KEY, settings);
    return settings;
  }
}

export const settingsRepository = new SettingsRepository();
