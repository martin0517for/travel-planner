/**
 * activities.js — 活動資料（Activity）：讀取、檢查、新增、修改、刪除（計畫書 9.5，2026-11-01）。
 *
 * 活動例如「環球影城」：一天或一段日期、可選的開始／結束時間、多個地點、一段內容。
 *
 * Activity 欄位（2026-11-01 使用者決定：只有名稱必填）：
 *   id         string   例如 "act_k3x9q2m7a1bc"
 *   tripId     string   屬於哪一趟旅程
 *   title      string   名稱（必填），最多 40 字（欄位不叫 name，避免 iPhone 當成聯絡人表單）
 *   startDate  string   開始日 "YYYY-MM-DD" 或 ""
 *   endDate    string   結束日 "YYYY-MM-DD" 或 ""；只填開始日＝一天的活動；不能早於開始日
 *   startTime  string   開始時間 "HH:mm" 或 ""（第一天的時間）
 *   endTime    string   結束時間 "HH:mm" 或 ""（最後一天的時間）；一天的活動不能早於開始時間
 *   placeIds   string[] 地點 id（依使用者排的順序），最多 30 個、不重複
 *   notes      string   內容，最多 3000 字（網址在畫面上會變成連結）
 *   createdAt / updatedAt
 *
 * 日期不限制在旅程期間內（跟住宿一樣）。
 * 活動裡的地點自動加入這趟的「想去的地點」清單；移除地點或刪除活動時，地點留在清單（變回未排入）。
 *
 * 資安：寫入前一律經過 validateActivityInput；從本機讀出的資料也經過 normalizeActivity，
 *      格式不對的筆數略過。地點只存 id，並檢查 id 格式。
 *
 * 所有操作回傳 { ok: true, activity } 或 { ok: false, errors: [...] }。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";
import { isValidDate, isValidTime } from "../core/dates.js";
import { tripPlaceStore } from "./tripPlaces.js";

const COLLECTION = "activities";
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

export const LIMITS = { title: 40, notes: 3000, places: 30 };

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanPlaceIds(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const id of list) {
    if (isValidId(id) && !out.includes(id)) out.push(id);
    if (out.length >= LIMITS.places) break;
  }
  return out;
}

function cleanActivity(raw) {
  const startDate = isValidDate(raw.startDate) ? raw.startDate : "";
  let endDate = isValidDate(raw.endDate) ? raw.endDate : "";
  // 結束日跟開始日同一天，就當作一天的活動（只存開始日）
  if (endDate && endDate === startDate) endDate = "";
  return {
    title: cleanText(raw.title, LIMITS.title),
    startDate,
    endDate,
    startTime: isValidTime(raw.startTime) ? raw.startTime.slice(0, 5) : "",
    endTime: isValidTime(raw.endTime) ? raw.endTime.slice(0, 5) : "",
    placeIds: cleanPlaceIds(raw.placeIds),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, LIMITS.notes) : "",
  };
}

export function normalizeActivity(raw) {
  if (!raw || typeof raw !== "object" || !isValidId(raw.id) || !isValidId(raw.tripId)) return null;
  const act = cleanActivity(raw);
  if (!act.title) return null;
  // 讀到「結束日早於開始日」的壞資料時，只保留開始日
  if (act.startDate && act.endDate && act.endDate < act.startDate) act.endDate = "";
  return {
    id: raw.id,
    tripId: raw.tripId,
    ...act,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function loadAll() {
  return readCollection(COLLECTION).map(normalizeActivity).filter(Boolean);
}

export function validateActivityInput(input) {
  const errors = [];
  const title = cleanText(input.title, LIMITS.title + 1);
  if (!title) errors.push("請輸入活動名稱");
  else if (title.length > LIMITS.title) errors.push(`名稱最多 ${LIMITS.title} 字`);
  if (input.startDate && !isValidDate(input.startDate)) errors.push("開始日格式不正確");
  if (input.endDate && !isValidDate(input.endDate)) errors.push("結束日格式不正確");
  if (input.startTime && !isValidTime(input.startTime)) errors.push("開始時間格式不正確");
  if (input.endTime && !isValidTime(input.endTime)) errors.push("結束時間格式不正確");
  if (input.endDate && !input.startDate) errors.push("填了結束日，也要填開始日");
  if (isValidDate(input.startDate) && isValidDate(input.endDate) && input.endDate < input.startDate) {
    errors.push("結束日不能早於開始日");
  }
  const oneDay = !input.endDate || input.endDate === input.startDate;
  if (oneDay && isValidTime(input.startTime) && isValidTime(input.endTime) && input.endTime < input.startTime) {
    errors.push("一天的活動，結束時間不能早於開始時間");
  }
  if (typeof input.notes === "string" && input.notes.length > LIMITS.notes) errors.push(`內容最多 ${LIMITS.notes} 字`);
  if (Array.isArray(input.placeIds) && input.placeIds.length > LIMITS.places) errors.push(`地點最多 ${LIMITS.places} 個`);
  return { errors, value: cleanActivity(input) };
}

/** 排序：依開始日（再依開始時間）；沒填日期的排最後（依建立順序） */
function byStart(a, b) {
  if (a.startDate && b.startDate) {
    // 沒填時間的排在同一天有時間的後面
    const ta = a.startTime || "99:99";
    const tb = b.startTime || "99:99";
    return (a.startDate + ta).localeCompare(b.startDate + tb) || a.createdAt.localeCompare(b.createdAt);
  }
  if (a.startDate) return -1;
  if (b.startDate) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

/** 活動的地點自動加入這趟的「想去的地點」清單（計畫書 9.5） */
function addPlacesToTripList(act) {
  if (act.placeIds.length) tripPlaceStore.addMany(act.tripId, act.placeIds);
}

export const activityStore = {
  listByTrip(tripId) {
    return loadAll().filter((a) => a.tripId === tripId).sort(byStart);
  },

  get(id) {
    if (!isValidId(id)) return null;
    return loadAll().find((a) => a.id === id) || null;
  },

  create(tripId, input) {
    if (!isValidId(tripId)) return { ok: false, errors: ["找不到這趟旅程"] };
    const { errors, value } = validateActivityInput(input);
    if (errors.length) return { ok: false, errors };
    const now = new Date().toISOString();
    const activity = { id: newId("act"), tripId, ...value, createdAt: now, updatedAt: now };
    const all = loadAll();
    all.push(activity);
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    addPlacesToTripList(activity);
    return { ok: true, activity };
  },

  update(id, input) {
    const { errors, value } = validateActivityInput(input);
    if (errors.length) return { ok: false, errors };
    const all = loadAll();
    const index = all.findIndex((a) => a.id === id);
    if (index === -1) return { ok: false, errors: ["找不到這個活動"] };
    all[index] = { ...all[index], ...value, updatedAt: new Date().toISOString() };
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    addPlacesToTripList(all[index]);
    return { ok: true, activity: all[index] };
  },

  remove(id) {
    const all = loadAll();
    const next = all.filter((a) => a.id !== id);
    if (next.length === all.length) return { ok: false, errors: ["找不到這個活動"] };
    if (!writeCollection(COLLECTION, next)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 刪除旅程時呼叫：刪掉這趟旅程的所有活動 */
  removeByTrip(tripId) {
    const all = loadAll();
    const next = all.filter((a) => a.tripId !== tripId);
    if (next.length === all.length) return true;
    return writeCollection(COLLECTION, next);
  },

  /** 有哪些活動用到這個地點（刪除地點前檢查用） */
  usingPlace(placeId) {
    return loadAll().filter((a) => a.placeIds.includes(placeId));
  },
};

/** 活動共幾天：有開始日時回傳數字（只有開始日＝1），否則 null */
export function daysOf(act) {
  if (!act.startDate) return null;
  if (!act.endDate) return 1;
  const [a, b] = [act.startDate, act.endDate].map((d) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  });
  return Math.round((b - a) / 86400000) + 1;
}
