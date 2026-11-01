/**
 * notes.js — 筆記（Note）：每趟旅程的「想買的東西、參考文章」（清單頁籤「筆記」，v0.9.0，2026-11-01 使用者決定）。
 *
 * Note 欄位：
 *   id         string   例如 "note_k3x9q2m7a1bc"
 *   tripId     string   屬於哪一趟旅程（每趟各自一份；刪除旅程時連帶刪除）
 *   kind       string   類型：buy 想買／note 筆記／other 其他（預設 note）
 *   title      string   標題（必填），最多 60 字（欄位不叫 name，避免 iPhone 當成聯絡人表單）
 *   url        string   參考連結，一個，只接受 http/https；可空
 *   body       string   內容，最多 3000 字（網址在畫面上會變成連結）；可空
 *   done       boolean  完成（想買＝買了、筆記＝看過）
 *   createdAt / updatedAt   列表新的排在上面（createdAt）
 *
 * 資安：寫入前一律經過 validateNoteInput；從本機讀出的資料也經過 normalizeNote，格式不對的略過。
 * 所有寫入操作回傳 { ok: true, note } 或 { ok: false, errors: [...] }。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";
import { safeUrl } from "../core/html.js";

const COLLECTION = "notes";
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

export const LIMITS = { title: 60, url: 500, body: 3000 };

export const NOTE_KINDS = [
  { value: "buy", label: "想買", icon: "shopping", cat: "cat--shopping" },
  { value: "note", label: "筆記", icon: "note", cat: "cat--kind" },
  { value: "other", label: "其他", icon: "dot", cat: "cat--kind" },
];
const KIND_VALUES = new Set(NOTE_KINDS.map((k) => k.value));

export function noteKind(value) {
  return NOTE_KINDS.find((k) => k.value === value) || NOTE_KINDS[1];
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanUrl(value) {
  const url = cleanText(value, LIMITS.url);
  return url && safeUrl(url) ? url : "";
}

function cleanNote(raw) {
  return {
    kind: KIND_VALUES.has(raw.kind) ? raw.kind : "note",
    title: cleanText(raw.title, LIMITS.title),
    url: cleanUrl(raw.url),
    body: typeof raw.body === "string" ? raw.body.slice(0, LIMITS.body) : "",
  };
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

  create(tripId, input) {
    if (!isValidId(tripId)) return { ok: false, errors: ["找不到這趟旅程"] };
    const { errors, value } = validateNoteInput(input);
    if (errors.length) return { ok: false, errors };
    const now = new Date().toISOString();
    const note = { id: newId("note"), tripId, ...value, done: false, createdAt: now, updatedAt: now };
    const all = loadAll();
    all.push(note);
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
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

  /** 刪除旅程時呼叫 */
  removeByTrip(tripId) {
    const all = loadAll();
    const next = all.filter((n) => n.tripId !== tripId);
    if (next.length === all.length) return true;
    return save(next);
  },
};
