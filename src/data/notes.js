/**
 * notes.js — 筆記（Note）：每趟旅程的「想買的東西、參考文章」（清單頁籤「筆記」，v0.9.0，2026-11-01 使用者決定）。
 *
 * Note 欄位：
 *   id         string   例如 "note_k3x9q2m7a1bc"
 *   tripId     string   屬於哪一趟旅程（每趟各自一份；刪除旅程時連帶刪除）
 *   kind       string   類型：note 筆記（預設）／rec 推薦／food 美食／trip 行程／buy 想買／souvenir 紀念品／other 其他
 *                      （v0.10.1 加上行程、紀念品；v0.10.3 加上美食；v0.11.0 加上推薦）
 *                      推薦＝貼上 IG／Threads 連結自動整理的結果，使用者確認後可再改類型
 *   customKind string   自訂類型（v0.10.2）：只有 kind＝other 時才有，最多 10 字，例如「藥妝」；
 *                      空白時顯示「其他」
 *   title      string   標題（必填），最多 60 字（欄位不叫 name，避免 iPhone 當成聯絡人表單）
 *   url        string   參考連結，一個，只接受 http/https；可空
 *   body       string   內容，最多 3000 字（網址在畫面上會變成連結）；可空
 *   placeIds   string[] 地點 id（依使用者排的順序），最多 30 個、不重複（v0.12.0，同活動）
 *                      存檔時自動加入這趟的「想去的地點」；但不算「已排入」（筆記不是行程，2026-11-03 使用者決定）
 *   done       boolean  完成（筆記、推薦＝看過、美食＝吃過、行程＝去過、想買／紀念品＝買了、其他＝完成）
 *   createdAt / updatedAt   列表新的排在上面（createdAt）
 *
 * 資安：寫入前一律經過 validateNoteInput；從本機讀出的資料也經過 normalizeNote，格式不對的略過。
 * 所有寫入操作回傳 { ok: true, note } 或 { ok: false, errors: [...] }。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";
import { safeUrl } from "../core/html.js";
import { tripPlaceStore } from "./tripPlaces.js";

const COLLECTION = "notes";
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

export const LIMITS = { title: 60, url: 500, body: 3000, customKind: 10, places: 30 };

// 順序＝表單選項與篩選列的順序（v0.10.1 使用者決定；v0.10.3 美食排在筆記後面；v0.11.0 推薦排在筆記後面）
export const NOTE_KINDS = [
  { value: "note", label: "筆記", icon: "note", cat: "cat--kind", done: "看過" },
  { value: "rec", label: "推薦", icon: "star", cat: "cat--rec", done: "看過" },
  { value: "food", label: "美食", icon: "restaurant", cat: "cat--restaurant", done: "吃過" },
  { value: "trip", label: "行程", icon: "schedule", cat: "cat--attraction", done: "去過" },
  { value: "buy", label: "想買", icon: "shopping", cat: "cat--shopping", done: "買了" },
  { value: "souvenir", label: "紀念品", icon: "gift", cat: "cat--hotel", done: "買了" },
  { value: "other", label: "其他", icon: "dot", cat: "cat--kind", done: "完成" },
];
const KIND_VALUES = new Set(NOTE_KINDS.map((k) => k.value));

export function noteKind(value) {
  return NOTE_KINDS.find((k) => k.value === value) || NOTE_KINDS[0];
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanUrl(value) {
  const url = cleanText(value, LIMITS.url);
  return url && safeUrl(url) ? url : "";
}

/** 畫面上顯示的類型名稱：自訂類型優先，其他用內建名稱 */
export function noteKindLabel(note) {
  return (note.kind === "other" && note.customKind) || noteKind(note.kind).label;
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

function cleanNote(raw) {
  const kind = KIND_VALUES.has(raw.kind) ? raw.kind : "note";
  return {
    kind,
    customKind: kind === "other" ? cleanText(raw.customKind, LIMITS.customKind) : "",
    title: cleanText(raw.title, LIMITS.title),
    url: cleanUrl(raw.url),
    body: typeof raw.body === "string" ? raw.body.slice(0, LIMITS.body) : "",
    placeIds: cleanPlaceIds(raw.placeIds), // v0.12.0 以前的筆記沒有 → []
  };
}

/** 筆記的地點自動加入這趟的「想去的地點」清單（v0.12.0，跟活動一樣） */
function addPlacesToTripList(note) {
  if (note.placeIds.length) tripPlaceStore.addMany(note.tripId, note.placeIds);
}

export function normalizeNote(raw) {
  if (!raw || typeof raw !== "object" || !isValidId(raw.id) || !isValidId(raw.tripId)) return null;
  const note = cleanNote(raw);
  if (!note.title) return null;
  return {
    id: raw.id,
    tripId: raw.tripId,
    ...note,
    done: raw.done === true,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function loadAll() {
  const seen = new Set();
  return readCollection(COLLECTION)
    .map(normalizeNote)
    .filter((n) => n && !seen.has(n.id) && seen.add(n.id));
}

const save = (all) => writeCollection(COLLECTION, all);

export function validateNoteInput(input) {
  const errors = [];
  const title = cleanText(input.title, LIMITS.title + 1);
  if (!title) errors.push("請輸入標題");
  else if (title.length > LIMITS.title) errors.push(`標題最多 ${LIMITS.title} 字`);
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (url.length > LIMITS.url) errors.push(`參考連結最多 ${LIMITS.url} 字`);
  else if (url && !safeUrl(url)) errors.push("參考連結需以 http:// 或 https:// 開頭");
  if (typeof input.body === "string" && input.body.length > LIMITS.body) errors.push(`內容最多 ${LIMITS.body} 字`);
  if (cleanText(input.customKind, LIMITS.customKind + 1).length > LIMITS.customKind) errors.push(`自訂類型最多 ${LIMITS.customKind} 字`);
  if (Array.isArray(input.placeIds) && input.placeIds.length > LIMITS.places) errors.push(`地點最多 ${LIMITS.places} 個`);
  return { errors, value: cleanNote(input) };
}

export const noteStore = {
  /** 這趟旅程的筆記，新的在上面 */
  listByTrip(tripId) {
    return loadAll()
      .filter((n) => n.tripId === tripId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  get(id) {
    if (!isValidId(id)) return null;
    return loadAll().find((n) => n.id === id) || null;
  },

  /** 用過的自訂類型（所有旅程，最近用的在前面，不重複；表單的快速選項）
   *  跟內建類型同名的（例如 v0.10.3 前自訂的「美食」）不列出，避免重複 */
  usedCustomKinds(max = 12) {
    const seen = new Set(NOTE_KINDS.map((k) => k.label));
    return loadAll()
      .filter((n) => n.customKind)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((n) => n.customKind)
      .filter((k) => !seen.has(k) && seen.add(k))
      .slice(0, max);
  },

  create(tripId, input) {
    if (!isValidId(tripId)) return { ok: false, errors: ["找不到這趟旅程"] };
    const { errors, value } = validateNoteInput(input);
    if (errors.length) return { ok: false, errors };
    const now = new Date().toISOString();
    const note = { id: newId("note"), tripId, ...value, done: false, createdAt: now, updatedAt: now };
    const all = loadAll();
    all.push(note);
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    addPlacesToTripList(note);
    return { ok: true, note };
  },

  update(id, input) {
    const { errors, value } = validateNoteInput(input);
    if (errors.length) return { ok: false, errors };
    const all = loadAll();
    const index = all.findIndex((n) => n.id === id);
    if (index === -1) return { ok: false, errors: ["找不到這則筆記"] };
    all[index] = { ...all[index], ...value, updatedAt: new Date().toISOString() };
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    addPlacesToTripList(all[index]);
    return { ok: true, note: all[index] };
  },

  /** 勾選／取消「完成」 */
  setDone(id, done) {
    const all = loadAll();
    const note = all.find((n) => n.id === id);
    if (!note) return { ok: false, errors: ["找不到這則筆記"] };
    note.done = done === true;
    note.updatedAt = new Date().toISOString();
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, note };
  },

  remove(id) {
    const all = loadAll();
    const next = all.filter((n) => n.id !== id);
    if (next.length === all.length) return { ok: false, errors: ["找不到這則筆記"] };
    if (!save(next)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 有哪些筆記用到這個地點（刪除地點前檢查用，v0.12.0） */
  usingPlace(placeId) {
    return loadAll().filter((n) => n.placeIds.includes(placeId));
  },

  /** 刪除旅程時呼叫 */
  removeByTrip(tripId) {
    const all = loadAll();
    const next = all.filter((n) => n.tripId !== tripId);
    if (next.length === all.length) return true;
    return save(next);
  },
};
