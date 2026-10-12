/**
 * places.js — 地點資料庫（Place）：所有旅程共用。
 * 飯店、機場、景點、餐廳都只建一次，之後航班、住宿、行程、清單用 placeId 引用。
 *
 * Place 欄位：
 *   id        string   例如 "place_k3x9q2m7a1bc"
 *   name      string   必填，最多 60 字
 *   category  string   固定 6 類之一（見 PLACE_CATEGORIES），決定圖示與顏色
 *   area      string   地區（大分類，例如「東京」），最多 30 字，用來篩選
 *   tags      string[] 自訂標籤，最多 10 個，每個最多 20 字（例如「必訪」「雨天備案」）
 *   address   string   最多 160 字
 *   lat, lng  number | null  座標（放地圖、導航用）
 *   mapsUrl   string   保存的地圖連結（只接受 http/https）
 *   website   string   官網（只接受 http/https）
 *   notes     string   備註，最多 1000 字
 *   createdAt / updatedAt
 *
 * 所有操作回傳 { ok: true, place } 或 { ok: false, errors: [...] }。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";
import { safeUrl } from "../core/html.js";
import { isValidLatLng } from "../core/geo.js";

const COLLECTION = "places";
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

export const LIMITS = { name: 60, area: 30, tag: 20, tags: 10, address: 160, notes: 1000, url: 2000 };

/** 固定分類。順序就是畫面上的顯示順序。顏色寫在 places.css（.cat--xxx）。 */
export const PLACE_CATEGORIES = [
  { value: "attraction", label: "景點" },
  { value: "restaurant", label: "餐廳" },
  { value: "shopping", label: "購物" },
  { value: "hotel", label: "住宿" },
  { value: "transport", label: "交通" },
  { value: "airport", label: "機場" },
];
const CATEGORY_VALUES = new Set(PLACE_CATEGORIES.map((c) => c.value));

export function categoryLabel(value) {
  return (PLACE_CATEGORIES.find((c) => c.value === value) || PLACE_CATEGORIES[0]).label;
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** 標籤：接受陣列或「逗號分隔的文字」，去空白、去重複、限制數量與長度 */
export function cleanTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[,，、]/);
  const out = [];
  for (const t of list) {
    const tag = cleanText(t, LIMITS.tag);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= LIMITS.tags) break;
  }
  return out;
}

function cleanUrl(value) {
  return safeUrl(cleanText(value, LIMITS.url)) || "";
}

function cleanPlace(raw) {
  const hasCoords = isValidLatLng(raw.lat, raw.lng);
  return {
    name: cleanText(raw.name, LIMITS.name),
    category: CATEGORY_VALUES.has(raw.category) ? raw.category : "attraction",
    area: cleanText(raw.area, LIMITS.area),
    tags: cleanTags(raw.tags),
    address: cleanText(raw.address, LIMITS.address),
    lat: hasCoords ? raw.lat : null,
    lng: hasCoords ? raw.lng : null,
    mapsUrl: cleanUrl(raw.mapsUrl),
    website: cleanUrl(raw.website),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, LIMITS.notes) : "",
  };
}

/** 從本機讀出的一筆 → 合法 Place 或 null（壞資料略過） */
function normalizePlace(raw) {
  if (!raw || typeof raw !== "object" || !isValidId(raw.id)) return null;
  const place = cleanPlace(raw);
  if (!place.name) return null;
  return {
    id: raw.id,
    ...place,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function loadAll() {
  return readCollection(COLLECTION).map(normalizePlace).filter(Boolean);
}

export function validatePlaceInput(input) {
  const errors = [];
  if (!cleanText(input.name, LIMITS.name)) errors.push("請輸入地點名稱");
  if (input.website && !safeUrl(String(input.website).trim())) errors.push("官網網址需以 http:// 或 https:// 開頭");
  if (typeof input.notes === "string" && input.notes.length > LIMITS.notes) errors.push(`備註最多 ${LIMITS.notes} 字`);
  return { errors, value: cleanPlace(input) };
}

export const placeStore = {
  list() {
    return loadAll().sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  },

  get(id) {
    if (!isValidId(id)) return null;
    return loadAll().find((p) => p.id === id) || null;
  },

  /** 目前用過的所有地區（篩選列與輸入建議用），依使用次數多到少 */
  areas() {
    const count = new Map();
    for (const p of loadAll()) if (p.area) count.set(p.area, (count.get(p.area) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([area]) => area);
  },

  /** 目前用過的所有標籤 */
  tags() {
    const set = new Set();
    for (const p of loadAll()) p.tags.forEach((t) => set.add(t));
    return [...set].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  },

  create(input) {
    const { errors, value } = validatePlaceInput(input);
    if (errors.length) return { ok: false, errors };
    const now = new Date().toISOString();
    const place = { id: newId("place"), ...value, createdAt: now, updatedAt: now };
    const all = loadAll();
    all.push(place);
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, place };
  },

  update(id, input) {
    const { errors, value } = validatePlaceInput(input);
    if (errors.length) return { ok: false, errors };
    const all = loadAll();
    const index = all.findIndex((p) => p.id === id);
    if (index === -1) return { ok: false, errors: ["找不到這個地點"] };
    all[index] = { ...all[index], ...value, updatedAt: new Date().toISOString() };
    if (!writeCollection(COLLECTION, all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, place: all[index] };
  },

  remove(id) {
    // 之後航班、住宿、行程、清單引用地點時，要在這裡先檢查「有沒有被使用」，有的話提醒使用者
    const all = loadAll();
    const next = all.filter((p) => p.id !== id);
    if (next.length === all.length) return { ok: false, errors: ["找不到這個地點"] };
    if (!writeCollection(COLLECTION, next)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },
};
