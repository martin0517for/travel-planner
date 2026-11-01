/**
 * accommodations.js — 住宿資料（Accommodation）：讀取、檢查、新增、修改、刪除。
 *
 * Accommodation 欄位（2026-11-01 決定：全部可以空白，但不能整筆都空白）：
 *   id             string   例如 "stay_k3x9q2m7a1bc"
 *   tripId         string   屬於哪一趟旅程
 *   placeId        string   飯店（地點資料庫的 id），或 ""
 *   checkInDate    string   入住日 "YYYY-MM-DD" 或 ""
 *   checkInTime    string   入住時間 "HH:mm" 或 ""（例如 15:00）
 *   checkOutDate   string   退房日 "YYYY-MM-DD" 或 ""；兩個日期都有時，不能早於入住日
 *   checkOutTime   string   退房時間 "HH:mm" 或 ""（例如 11:00）
 *   platform       string   訂房平台，最多 30 字（例如 Agoda、官網）
 *   bookingRef     string   訂房代號，最多 30 字，照原樣保存（不轉大寫）
 *   notes          string   備註，最多 1000 字（網址在畫面上會變成連結）
 *   createdAt / updatedAt
 *
 * 之後行程頁的「當晚住哪裡」會用入住日～退房日判斷；沒填日期的住宿不會出現在行程頁。
 *
 * 資安：寫入前一律經過 validateAccommodationInput；從本機讀出的資料也經過
 *      normalizeAccommodation，格式不對的筆數略過。飯店只存 id，並檢查 id 格式。
 *
 * 所有操作回傳 { ok: true, stay } 或 { ok: false, errors: [...] }。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";
import { isValidDate, isValidTime } from "../core/dates.js";

const COLLECTION = "accommodations";
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

export const LIMITS = { platform: 30, bookingRef: 30, notes: 1000 };

/** 訂房平台的快速選項（點一下帶入，也可以自己打別的） */
export const PLATFORM_PICKS = ["Agoda", "Booking.com", "Airbnb", "Trip.com", "官網"];

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanStay(raw) {
  return {
    placeId: isValidId(raw.placeId) ? raw.placeId : "",
    checkInDate: isValidDate(raw.checkInDate) ? raw.checkInDate : "",
    checkInTime: isValidTime(raw.checkInTime) ? raw.checkInTime.slice(0, 5) : "",
    checkOutDate: isValidDate(raw.checkOutDate) ? raw.checkOutDate : "",
    checkOutTime: isValidTime(raw.checkOutTime) ? raw.checkOutTime.slice(0, 5) : "",
    platform: cleanText(raw.platform, LIMITS.platform),
    bookingRef: cleanText(raw.bookingRef, LIMITS.bookingRef),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, LIMITS.notes) : "",
  };
}

function hasContent(s) {
  return Boolean(
    s.placeId || s.checkInDate || s.checkInTime || s.checkOutDate || s.checkOutTime ||
    s.platform || s.bookingRef || s.notes.trim()
  );
}

function normalizeAccommodation(raw) {
  if (!raw || typeof raw !== "object" || !isValidId(raw.id) || !isValidId(raw.tripId)) return null;
  const stay = cleanStay(raw);
  if (!hasContent(stay)) return null;
  return {
    id: raw.id,
    tripId: raw.tripId,
    ...stay,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function loadAll() {
  return readCollection(COLLECTION).map(normalizeAccommodation).filter(Boolean);
}

export function validateAccommodationInput(input) {
  const errors = [];
  if (input.checkInDate && !isValidDate(input.checkInDate)) errors.push("入住日格式不正確");
  if (input.checkOutDate && !isValidDate(input.checkOutDate)) errors.push("退房日格式不正確");
  if (input.checkInTime && !isValidTime(input.checkInTime)) errors.push("入住時間格式不正確");
  if (input.checkOutTime && !isValidTime(input.checkOutTime)) errors.push("退房時間格式不正確");
  if (isValidDate(input.checkInDate) && isValidDate(input.checkOutDate) && input.checkOutDate < input.checkInDate) {
    errors.push("退房日不能早於入住日");
  }
  if (typeof input.notes === "string" && input.notes.length > LIMITS.notes) errors.push(`備註最多 ${LIMITS.notes} 字`);
  const value = cleanStay(input);
  if (!errors.length && !hasContent(value)) errors.push("至少要填一項（例如飯店或入住日）");
  return { errors, value };
}

/** 排序：有入住日的依日期（再依時間）；沒填的排最後（依建立順序） */
function byCheckIn(a, b) {
  if (a.checkInDate && b.checkInDate) {
    return (a.checkInDate + a.checkInTime).localeCompare(b.checkInDate + b.checkInTime);
  }
  if (a.checkInDate) return -1;
  if (b.checkInDate) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

export const accommodationStore = {
  listByTrip(tripId) {
    return loadAll().filter((s) => s.tripId === tripId).sort(byCheckIn);
  },

  get(id) {
    if (!isValidId(id)) return null;
    return loadAll().find((s) => s.id === id) || null;
  },

  create(tripId, input) {
    if (!isValidId(tripId)) return { ok: false, errors: ["找不到這趟旅程"] };
    const { errors, value } = validateAccommodationInput(input);
    if (errors.length) return { ok: false, errors };
    const now = new Date().toISOString();
    const stay = { id: newId("stay"), tripId, ...value, createdAt: now, updatedAt: now };
    const all = loadAll();
    all.push(stay);
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, stay };
  },

  update(id, input) {
    const { errors, value } = validateAccommodationInput(input);
    if (errors.length) return { ok: false, errors };
    const all = loadAll();
    const index = all.findIndex((s) => s.id === id);
    if (index === -1) return { ok: false, errors: ["找不到這筆住宿"] };
    all[index] = { ...all[index], ...value, updatedAt: new Date().toISOString() };
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, stay: all[index] };
  },

  remove(id) {
    const all = loadAll();
    const next = all.filter((s) => s.id !== id);
    if (next.length === all.length) return { ok: false, errors: ["找不到這筆住宿"] };
    if (!writeCollection(COLLECTION, next)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 刪除旅程時呼叫：刪掉這趟旅程的所有住宿 */
  removeByTrip(tripId) {
    const all = loadAll();
    const next = all.filter((s) => s.tripId !== tripId);
    if (next.length === all.length) return true;
    return writeCollection(COLLECTION, next);
  },

  /** 有哪些住宿用到這個地點（刪除地點前檢查用） */
  usingPlace(placeId) {
    return loadAll().filter((s) => s.placeId === placeId);
  },
};

/** 幾晚：兩個日期都有時回傳數字，否則 null */
export function nightsOf(stay) {
  if (!stay.checkInDate || !stay.checkOutDate) return null;
  const [a, b] = [stay.checkInDate, stay.checkOutDate].map((d) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  });
  return Math.round((b - a) / 86400000);
}
