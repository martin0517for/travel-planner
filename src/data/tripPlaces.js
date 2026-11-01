/**
 * tripPlaces.js — 旅程地點清單（計畫書 9.2）：每趟旅程自己的「想去的地點」。
 *
 * 只保存「引用」：地點本身的資料只有一份，在共用地點資料庫（places.js）。
 * 在地點資料庫修改地點後，每趟旅程的清單都會跟著同步。
 *
 * TripPlace 欄位（2026-11-01 決定）：
 *   id         string   例如 "tplace_k3x9q2m7a1bc"
 *   tripId     string   屬於哪一趟旅程（刪除旅程時連帶刪除；共用地點不受影響）
 *   placeId    string   地點資料庫的 id；同一趟旅程裡同一個地點只會有一筆
 *   notes      string   這趟的備註（只屬於這趟，跟地點本身的備註分開），最多 1000 字
 *   visited    boolean  去過了沒（使用者自己勾）
 *   createdAt / updatedAt   清單依加入先後排列（createdAt）
 *
 * 「已排入」不存在這裡：由 App 依航班、住宿、行程自動判斷（第 ③ 小步、⑤ Timeline 接上）。
 *
 * 注意：這個檔案不 import places.js（places.js → placeUsage.js → 這裡，避免互相 import）。
 * 地點是否存在由畫面那一層檢查。
 *
 * 資安：寫入前檢查 id 格式、限制長度；從本機讀出的資料也經過 normalize，格式不對的略過。
 * 所有寫入操作回傳 { ok: true, ... } 或 { ok: false, errors: [...] }。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";

const COLLECTION = "tripPlaces";
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

export const LIMITS = { notes: 1000 };

export function normalizeTripPlace(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!isValidId(raw.id) || !isValidId(raw.tripId) || !isValidId(raw.placeId)) return null;
  return {
    id: raw.id,
    tripId: raw.tripId,
    placeId: raw.placeId,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, LIMITS.notes) : "",
    visited: raw.visited === true,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

/** 讀出全部；同一趟旅程重複的地點只留第一筆（避免資料被改壞時重複顯示） */
function loadAll() {
  const seen = new Set();
  const out = [];
  for (const item of readCollection(COLLECTION).map(normalizeTripPlace)) {
    if (!item) continue;
    const key = `${item.tripId}|${item.placeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function save(all) {
  return writeCollection(COLLECTION, all);
}

export const tripPlaceStore = {
  /** 某趟旅程的清單，依加入先後排列 */
  listByTrip(tripId) {
    return loadAll()
      .filter((t) => t.tripId === tripId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  get(id) {
    if (!isValidId(id)) return null;
    return loadAll().find((t) => t.id === id) || null;
  },

  /** 這趟旅程的清單裡已經有哪些地點（Set of placeId） */
  placeIdsOf(tripId) {
    return new Set(loadAll().filter((t) => t.tripId === tripId).map((t) => t.placeId));
  },

  /**
   * 一次加入多個地點。已經在清單裡的會略過。
   * 回傳 { ok: true, added: 實際加入的筆數 }
   */
  addMany(tripId, placeIds) {
    if (!isValidId(tripId)) return { ok: false, errors: ["找不到這趟旅程"] };
    const all = loadAll();
    const existing = new Set(all.filter((t) => t.tripId === tripId).map((t) => t.placeId));
    const base = Date.now();
    let added = 0;
    for (const placeId of placeIds) {
      if (!isValidId(placeId) || existing.has(placeId)) continue;
      existing.add(placeId);
      // 同一批加入時每筆差 1 毫秒，排序才會照選取順序
      const now = new Date(base + added).toISOString();
      all.push({ id: newId("tplace"), tripId, placeId, notes: "", visited: false, createdAt: now, updatedAt: now });
      added++;
    }
    if (added && !save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, added };
  },

  /** 勾選／取消「去過」 */
  setVisited(id, visited) {
    const all = loadAll();
    const item = all.find((t) => t.id === id);
    if (!item) return { ok: false, errors: ["找不到這個地點"] };
    item.visited = visited === true;
    item.updatedAt = new Date().toISOString();
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, item };
  },

  /** 修改這趟的備註 */
  updateNotes(id, notes) {
    if (typeof notes !== "string") notes = "";
    if (notes.length > LIMITS.notes) return { ok: false, errors: [`備註最多 ${LIMITS.notes} 字`] };
    const all = loadAll();
    const item = all.find((t) => t.id === id);
    if (!item) return { ok: false, errors: ["找不到這個地點"] };
    item.notes = notes;
    item.updatedAt = new Date().toISOString();
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, item };
  },

  /** 從這趟的清單移除（共用地點資料庫不受影響） */
  remove(id) {
    const all = loadAll();
    const next = all.filter((t) => t.id !== id);
    if (next.length === all.length) return { ok: false, errors: ["找不到這個地點"] };
    if (!save(next)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 刪除旅程時呼叫：刪掉這趟旅程的整份清單 */
  removeByTrip(tripId) {
    const all = loadAll();
    const next = all.filter((t) => t.tripId !== tripId);
    if (next.length === all.length) return true;
    return save(next);
  },

  /** 有哪些旅程清單用到這個地點（刪除地點前檢查用） */
  usingPlace(placeId) {
    return loadAll().filter((t) => t.placeId === placeId);
  },
};
