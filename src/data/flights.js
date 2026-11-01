/**
 * flights.js — 航班資料（Flight）：讀取、檢查、新增、修改、刪除。
 *
 * Flight 欄位（2026-11-01 決定：全部可以空白，但不能整筆都空白）：
 *   id                 string   例如 "flight_k3x9q2m7a1bc"
 *   tripId             string   屬於哪一趟旅程
 *   direction          string   "outbound"（去程）／"return"（回程）／"other"（其他），手動選
 *   airline            string   航空公司，最多 30 字
 *   flightNo           string   航班號碼，最多 10 字，自動轉大寫（br198 → BR198）
 *   departurePlaceId   string   出發機場（地點資料庫的 id），或 ""
 *   departureTime      string   出發的「當地時間」，"YYYY-MM-DDTHH:mm" 或 ""
 *   arrivalPlaceId     string   抵達機場（地點資料庫的 id），或 ""
 *   arrivalTime        string   抵達的「當地時間」，"YYYY-MM-DDTHH:mm" 或 ""
 *   bookingRef         string   訂位代號，最多 12 字，自動轉大寫
 *   seat               string   座位，最多 10 字，自動轉大寫（32a → 32A）
 *   notes              string   備註，最多 1000 字（網址在畫面上會變成連結）
 *   createdAt / updatedAt
 *
 * 時間：一律填機票上的當地時間，App 不換算時區，所以也不檢查「抵達要晚於出發」
 *      （跨時區時，抵達的當地時間可能比出發還早）。
 *
 * 資安：寫入前一律經過 validateFlightInput；從本機讀出的資料也經過 normalizeFlight，
 *      格式不對的筆數略過。地點只存 id，並檢查 id 格式。
 *
 * 所有操作回傳 { ok: true, flight } 或 { ok: false, errors: [...] }。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";
import { isValidDateTime } from "../core/dates.js";
import { tripPlaceStore } from "./tripPlaces.js";

const COLLECTION = "flights";
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

export const LIMITS = { airline: 30, flightNo: 10, bookingRef: 12, seat: 10, notes: 1000 };

/** 去程／回程／其他。順序就是表單上的顯示順序。 */
export const FLIGHT_DIRECTIONS = [
  { value: "outbound", label: "去程" },
  { value: "return", label: "回程" },
  { value: "other", label: "其他" },
];
const DIRECTION_VALUES = new Set(FLIGHT_DIRECTIONS.map((d) => d.value));

export function directionLabel(value) {
  return (FLIGHT_DIRECTIONS.find((d) => d.value === value) || FLIGHT_DIRECTIONS[2]).label;
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function cleanUpper(value, max) {
  return cleanText(value, max).toUpperCase();
}
function cleanPlaceId(value) {
  return isValidId(value) ? value : "";
}
function cleanTime(value) {
  return isValidDateTime(value) ? value : "";
}

function cleanFlight(raw) {
  return {
    direction: DIRECTION_VALUES.has(raw.direction) ? raw.direction : "other",
    airline: cleanText(raw.airline, LIMITS.airline),
    flightNo: cleanUpper(raw.flightNo, LIMITS.flightNo),
    departurePlaceId: cleanPlaceId(raw.departurePlaceId),
    departureTime: cleanTime(raw.departureTime),
    arrivalPlaceId: cleanPlaceId(raw.arrivalPlaceId),
    arrivalTime: cleanTime(raw.arrivalTime),
    bookingRef: cleanUpper(raw.bookingRef, LIMITS.bookingRef),
    seat: cleanUpper(raw.seat, LIMITS.seat),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, LIMITS.notes) : "",
  };
}

/** 除了「去程／回程」之外，有沒有任何一欄有內容 */
function hasContent(f) {
  return Boolean(
    f.airline || f.flightNo || f.departurePlaceId || f.departureTime ||
    f.arrivalPlaceId || f.arrivalTime || f.bookingRef || f.seat || f.notes.trim()
  );
}

/** 從本機讀出的一筆 → 合法 Flight 或 null（壞資料略過） */
export function normalizeFlight(raw) {
  if (!raw || typeof raw !== "object" || !isValidId(raw.id) || !isValidId(raw.tripId)) return null;
  const flight = cleanFlight(raw);
  if (!hasContent(flight)) return null;
  return {
    id: raw.id,
    tripId: raw.tripId,
    ...flight,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function loadAll() {
  return readCollection(COLLECTION).map(normalizeFlight).filter(Boolean);
}

export function validateFlightInput(input) {
  const errors = [];
  if (input.departureTime && !isValidDateTime(input.departureTime)) errors.push("出發時間格式不正確");
  if (input.arrivalTime && !isValidDateTime(input.arrivalTime)) errors.push("抵達時間格式不正確");
  if (typeof input.notes === "string" && input.notes.length > LIMITS.notes) errors.push(`備註最多 ${LIMITS.notes} 字`);
  const value = cleanFlight(input);
  if (!errors.length && !hasContent(value)) errors.push("至少要填一項（例如航班號碼或出發時間）");
  return { errors, value };
}

/** 排序：有出發時間的依時間先後；沒填的排最後（依建立順序） */
function byDeparture(a, b) {
  if (a.departureTime && b.departureTime) return a.departureTime.localeCompare(b.departureTime);
  if (a.departureTime) return -1;
  if (b.departureTime) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}

/**
 * 計畫書 9.2：航班的機場自動加入這趟的「想去的地點」清單（2026-11-01）。
 * 換掉機場或刪除航班時，舊機場繼續留在清單（變回「未排入」）。
 */
function addAirportsToTripList(flight) {
  tripPlaceStore.addMany(flight.tripId, [flight.departurePlaceId, flight.arrivalPlaceId].filter(Boolean));
}

export const flightStore = {
  /** 某趟旅程的所有航班（已排序） */
  listByTrip(tripId) {
    return loadAll().filter((f) => f.tripId === tripId).sort(byDeparture);
  },

  get(id) {
    if (!isValidId(id)) return null;
    return loadAll().find((f) => f.id === id) || null;
  },

  create(tripId, input) {
    if (!isValidId(tripId)) return { ok: false, errors: ["找不到這趟旅程"] };
    const { errors, value } = validateFlightInput(input);
    if (errors.length) return { ok: false, errors };
    const now = new Date().toISOString();
    const flight = { id: newId("flight"), tripId, ...value, createdAt: now, updatedAt: now };
    const all = loadAll();
    all.push(flight);
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    addAirportsToTripList(flight);
    return { ok: true, flight };
  },

  update(id, input) {
    const { errors, value } = validateFlightInput(input);
    if (errors.length) return { ok: false, errors };
    const all = loadAll();
    const index = all.findIndex((f) => f.id === id);
    if (index === -1) return { ok: false, errors: ["找不到這個航班"] };
    all[index] = { ...all[index], ...value, updatedAt: new Date().toISOString() };
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    addAirportsToTripList(all[index]);
    return { ok: true, flight: all[index] };
  },

  remove(id) {
    const all = loadAll();
    const next = all.filter((f) => f.id !== id);
    if (next.length === all.length) return { ok: false, errors: ["找不到這個航班"] };
    if (!writeCollection(COLLECTION, next)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 刪除旅程時呼叫：刪掉這趟旅程的所有航班 */
  removeByTrip(tripId) {
    const all = loadAll();
    const next = all.filter((f) => f.tripId !== tripId);
    if (next.length === all.length) return true;
    return writeCollection(COLLECTION, next);
  },

  /** 有哪些航班用到這個地點（之後刪除地點前檢查用） */
  usingPlace(placeId) {
    return loadAll().filter((f) => f.departurePlaceId === placeId || f.arrivalPlaceId === placeId);
  },
};
