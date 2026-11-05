/**
 * placeNotes.js — 行程項目和「想去的地點」共用「這趟的備註」（v0.13.0，2026-11-05 使用者決定 D-1～D-9）。
 *
 * 規則：
 *   - 有選地點的行程項目，不另外存備註：備註就是那個地點在這趟的「這趟的備註」（tripPlaces 的 notes）。
 *     同一個地點排在好幾天，顯示同一份；在哪裡改都會一起變。
 *   - 沒選地點的行程項目（移動、用餐…）照舊用自己的 notes。
 *
 * 匯出：
 *   tripPlaceNotes(tripId, placeId)           → 這趟的備註（沒有就 ""）
 *   setTripPlaceNotes(tripId, placeId, notes) → 寫入（地點還不在清單時先加入）
 *   migrateItemNotes()                        → 舊資料一次搬移（App 啟動、匯入備份後呼叫；重複呼叫沒關係）
 *
 * 搬移（D-3）：有地點、而且 notes 不是空的行程項目 →
 *   這趟的備註是空的 → 直接放進去；已經有 → 接在後面（空一行）；內容已經包含 → 不重複；
 *   搬好後清掉項目自己的 notes。合起來超過 1000 字的那一筆先不搬（保留在項目上，畫面照樣顯示，
 *   使用者在表單改過一次就會合併）。
 *
 * 資安：只寫進資料層原本的 updateNotes（有長度檢查）；id 都來自已檢查過的資料。
 */
import { tripPlaceStore, LIMITS as TP_LIMITS } from "./tripPlaces.js";
import { dayPlanStore } from "./dayPlans.js";

const MAX = TP_LIMITS.notes;

function entryOf(tripId, placeId) {
  return tripPlaceStore.listByTrip(tripId).find((t) => t.placeId === placeId) || null;
}

export function tripPlaceNotes(tripId, placeId) {
  const e = placeId ? entryOf(tripId, placeId) : null;
  return e ? e.notes : "";
}

export function setTripPlaceNotes(tripId, placeId, notes) {
  let e = entryOf(tripId, placeId);
  if (!e) {
    const r = tripPlaceStore.addMany(tripId, [placeId]);
    if (!r.ok) return r;
    e = entryOf(tripId, placeId);
    if (!e) return { ok: false, errors: ["找不到這個地點"] };
  }
  if (e.notes === notes) return { ok: true, item: e };
  return tripPlaceStore.updateNotes(e.id, notes);
}

/** 合併兩段備註（空一行接在後面；已經包含就不重複） */
export function mergeNotes(base, extra) {
  const a = (base || "").trim();
  const b = (extra || "").trim();
  if (!b || a.includes(b)) return base || "";
  if (!a) return b;
  return `${a}\n\n${b}`;
}

export function migrateItemNotes() {
  let moved = 0;
  for (const plan of dayPlanStore.listAll()) {
    const done = [];
    for (const item of plan.items) {
      if (!item.placeId || !item.notes.trim()) continue;
      const merged = mergeNotes(tripPlaceNotes(plan.tripId, item.placeId), item.notes);
      if (merged.length > MAX) continue; // 先不搬，保留在項目上
      const r = setTripPlaceNotes(plan.tripId, item.placeId, merged);
      if (r.ok) done.push(item.id);
    }
    if (done.length && dayPlanStore.clearItemNotes(plan.tripId, done).ok) moved += done.length;
  }
  return moved;
}
