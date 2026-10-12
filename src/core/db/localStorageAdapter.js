/**
 * localStorage 通用存取工具。
 * 之後若要換成 Firebase / Supabase，
 * 只要另外寫一個相同介面（getCollection/setCollection）的 adapter，
 * 並在 BaseRepository 建構時換掉注入的 adapter 即可。
 */

export const localStorageAdapter = {
  getCollection(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error(`[localStorageAdapter] 讀取 ${key} 失敗`, err);
      return [];
    }
  },

  setCollection(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify(items));
      return true;
    } catch (err) {
      console.error(`[localStorageAdapter] 寫入 ${key} 失敗`, err);
      return false;
    }
  },
};

export function generateId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
