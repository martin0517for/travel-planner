/**
 * trips.js — 旅程資料（Trip）：讀取、檢查、新增、修改、刪除。
 *
 * Trip 欄位：
 *   id           string   例如 "trip_k3x9q2m7a1bc"
 *   name         string   必填，最多 40 字
 *   destination  string   選填，最多 40 字
 *   startDate    string   選填，"YYYY-MM-DD" 或 ""
 *   endDate      string   選填，"YYYY-MM-DD" 或 ""；有填就必須有出發日，且不能早於出發日
 *   createdAt / updatedAt  ISO 時間字串
 *
 * 資安：
 *   - 寫入前一律經過 validateTripInput：去頭尾空白、限制長度、檢查日期格式。
 *   - 從本機讀出的資料也會經過 normalizeTrip 過濾，格式不對的筆數直接略過，
 *     不會讓壞掉的資料把畫面弄壞。
 *
 * 所有操作回傳 { ok: true, trip } 或 { ok: false, errors: ["…"] }。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";
import { isValidDate, parseDate } from "../core/dates.js";

const COLLECTION = "trips";
export const NAME_MAX = 40;
export const DESTINATION_MAX = 40;
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** 從本機讀出的一筆資料 → 合法的 Trip，或 null（略過） */
function normalizeTrip(raw) {
  if (!raw || typeof raw !== "object" || !isValidId(raw.id)) return null;
  const name = cleanText(raw.name, NAME_MAX);
  if (!name) return null;
  return {
    id: raw.id,
    name,
    destination: cleanText(raw.destination, DESTINATION_MAX),
    startDate: isValidDate(raw.startDate) ? raw.startDate : "",
    endDate: isValidDate(raw.endDate) ? raw.endDate : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function loadAll() {
  return readCollection(COLLECTION).map(normalizeTrip).filter(Boolean);
}

/** 檢查表單輸入，回傳 { errors, value }（value 是整理過的乾淨資料） */
export function validateTripInput(input) {
  const errors = [];
  const name = cleanText(input.name, NAME_MAX);
  const destination = cleanText(input.destination, DESTINATION_MAX);
  const startDate = typeof input.startDate === "string" ? input.startDate : "";
  const endDate = typeof input.endDate === "string" ? input.endDate : "";

  if (!name) errors.push("請輸入旅程名稱");
  if (startDate && !isValidDate(startDate)) errors.push("出發日格式不正確");
  if (endDate && !isValidDate(endDate)) errors.push("回程日格式不正確");
  if (endDate && !startDate) errors.push("填了回程日，也要填出發日");
  if (isValidDate(startDate) && isValidDate(endDate) && parseDate(endDate) < parseDate(startDate)) {
    errors.push("回程日不能早於出發日");
  }
  return { errors, value: { name, destination, startDate, endDate } };
}

export const tripStore = {
  list() {
    return loadAll();
  },

  get(id) {
    if (!isValidId(id)) return null;
    return loadAll().find((t) => t.id === id) || null;
  },

  create(input) {
    const { errors, value } = validateTripInput(input);
    if (errors.length) return { ok: false, errors };
    const now = new Date().toISOString();
    const trip = { id: newId("trip"), ...value, createdAt: now, updatedAt: now };
    const all = loadAll();
    all.push(trip);
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, trip };
  },

  update(id, input) {
    const { errors, value } = validateTripInput(input);
    if (errors.length) return { ok: false, errors };
    const all = loadAll();
    const index = all.findIndex((t) => t.id === id);
    if (index === -1) return { ok: false, errors: ["找不到這趟旅程"] };
    all[index] = { ...all[index], ...value, updatedAt: new Date().toISOString() };
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, trip: all[index] };
  },

  remove(id) {
    const all = loadAll();
    const next = all.filter((t) => t.id !== id);
    if (next.length === all.length) return { ok: false, errors: ["找不到這趟旅程"] };
    if (!writeCollection(COLLECTION, next)) return { ok: false, errors: [STORAGE_FAIL] };
    // 之後有航班、住宿、行程、清單時，要在這裡一起刪掉屬於這趟旅程的資料
    return { ok: true };
  },
};
