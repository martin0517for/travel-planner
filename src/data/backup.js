/**
 * backup.js — 全部資料的匯出與匯入（設定頁，v0.10.0，2026-11-01 使用者決定）。
 *
 * 備份檔格式（JSON）：
 *   { app: "travel-planner", format: 1, version: "0.10.0", exportedAt: ISO,
 *     data: { trips, places, flights, accommodations, activities, dayPlans, tripPlaces, notes, settings } }
 *
 * 匯入只做「取代全部」。備份檔一律視為不可信（資安原則 2）：
 *   - 檔案大小上限 5 MB；必須是這個 App 的備份格式
 *   - 只接受認得的資料種類；每一筆都用跟 App 讀資料時一樣的檢查（normalize），
 *     檢查不過的筆數、重複的 id、筆數超過上限、引用不存在的旅程或地點 → 整份拒絕
 *   - 寫入時先保留目前的資料；任何一種寫入失敗就全部還原，不會只匯入一半
 * 檢查通過後才寫入，寫入的是「檢查過、整理過」的資料，不是檔案原文。
 */
import { readCollection, writeCollection } from "../core/storage.js";
import { APP_VERSION } from "../core/version.js";
import { normalizeTrip } from "./trips.js";
import { normalizePlace } from "./places.js";
import { normalizeFlight } from "./flights.js";
import { normalizeAccommodation } from "./accommodations.js";
import { normalizeActivity } from "./activities.js";
import { normalizePlan } from "./dayPlans.js";
import { normalizeTripPlace } from "./tripPlaces.js";
import { normalizeNote } from "./notes.js";
import { migrateItemNotes } from "./placeNotes.js";
import { normalizeSettings } from "./settings.js";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ITEMS = 5000; // 每一種資料最多幾筆
const FORMAT = 1;

const KINDS = [
  { key: "trips", normalize: normalizeTrip, label: "趟旅程" },
  { key: "places", normalize: normalizePlace, label: "個地點" },
  { key: "flights", normalize: normalizeFlight, label: "個航班" },
  { key: "accommodations", normalize: normalizeAccommodation, label: "個住宿" },
  { key: "activities", normalize: normalizeActivity, label: "個活動" },
  { key: "dayPlans", normalize: normalizePlan, label: "天的行程" },
  { key: "tripPlaces", normalize: normalizeTripPlace, label: "個想去的地點" },
  { key: "notes", normalize: normalizeNote, label: "則筆記" },
];

/** 目前手機上的全部資料 → 備份檔物件（每一筆都先整理過） */
export function buildBackup() {
  const data = {};
  for (const k of KINDS) data[k.key] = readCollection(k.key).map(k.normalize).filter(Boolean);
  data.settings = [normalizeSettings(readCollection("settings")[0])];
  return { app: "travel-planner", format: FORMAT, version: APP_VERSION, exportedAt: new Date().toISOString(), data };
}

/** 備份檔名：travel-planner-backup-2026-11-01.json（本地日期） */
export function backupFileName(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `travel-planner-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

const isTime = (v) => v === "" || (typeof v === "string" && v.length <= 40);

/**
 * 檢查備份檔的文字 → { ok: true, data, summary, exportedAt, version } 或 { ok: false, errors }
 * summary：[{ label: "趟旅程", count: 3 }, …]
 */
export function parseBackup(text) {
  if (typeof text !== "string" || text.length > MAX_FILE_BYTES) return fail("檔案太大（上限 5 MB）");
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("看不懂這個檔案：不是 JSON 格式");
  }
  if (!raw || typeof raw !== "object" || raw.app !== "travel-planner" || !raw.data || typeof raw.data !== "object") {
    return fail("這不是旅行規劃的備份檔");
  }
  if (raw.format !== FORMAT) return fail("備份檔的格式版本不支援");
  const known = new Set([...KINDS.map((k) => k.key), "settings"]);
  const unknown = Object.keys(raw.data).filter((k) => !known.has(k));
  if (unknown.length) return fail(`備份檔裡有不認得的資料：${unknown.slice(0, 3).join("、")}`);

  const data = {};
  const errors = [];
  for (const k of KINDS) {
    const list = raw.data[k.key] === undefined ? [] : raw.data[k.key];
    if (!Array.isArray(list)) return fail(`「${k.key}」的格式不正確`);
    if (list.length > MAX_ITEMS) return fail(`「${k.key}」超過 ${MAX_ITEMS} 筆`);
    const ids = new Set();
    const out = [];
    list.forEach((item, i) => {
      const clean = k.normalize(item);
      if (!clean || !isTime(clean.createdAt) || !isTime(clean.updatedAt)) {
        errors.push(`「${k.key}」第 ${i + 1} 筆格式不正確`);
        return;
      }
      if (ids.has(clean.id)) {
        errors.push(`「${k.key}」有重複的資料（${clean.id}）`);
        return;
      }
      ids.add(clean.id);
      out.push(clean);
    });
    data[k.key] = out;
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 5).concat(errors.length > 5 ? [`…還有 ${errors.length - 5} 個問題`] : []) };

  const settingsList = raw.data.settings === undefined ? [] : raw.data.settings;
  if (!Array.isArray(settingsList) || settingsList.length > 1) return fail("「settings」的格式不正確");
  data.settings = [normalizeSettings(settingsList[0])];

  const refErrors = checkReferences(data);
  if (refErrors.length) return { ok: false, errors: refErrors.slice(0, 5) };

  const exportedAt = typeof raw.exportedAt === "string" && raw.exportedAt.length <= 40 ? raw.exportedAt : "";
  const version = typeof raw.version === "string" && /^\d+\.\d+\.\d+$/.test(raw.version) ? raw.version : "";
  const summary = KINDS.map((k) => ({ label: k.label, count: data[k.key].length }));
  return { ok: true, data, summary, exportedAt, version };
}

/** 引用檢查：屬於的旅程、用到的地點都要在備份檔裡 */
function checkReferences(data) {
  const trips = new Set(data.trips.map((t) => t.id));
  const places = new Set(data.places.map((p) => p.id));
  const errors = [];
  const needTrip = (key, item) => {
    if (!trips.has(item.tripId)) errors.push(`「${key}」引用了不存在的旅程`);
  };
  const needPlace = (key, id) => {
    if (id && !places.has(id)) errors.push(`「${key}」引用了不存在的地點`);
  };
  for (const f of data.flights) {
    needTrip("flights", f);
    needPlace("flights", f.departurePlaceId);
    needPlace("flights", f.arrivalPlaceId);
  }
  for (const s of data.accommodations) {
    needTrip("accommodations", s);
    needPlace("accommodations", s.placeId);
  }
  for (const a of data.activities) {
    needTrip("activities", a);
    a.placeIds.forEach((id) => needPlace("activities", id));
  }
  for (const p of data.dayPlans) {
    needTrip("dayPlans", p);
    p.items.forEach((it) => needPlace("dayPlans", it.placeId));
  }
  for (const t of data.tripPlaces) {
    needTrip("tripPlaces", t);
    needPlace("tripPlaces", t.placeId);
  }
  for (const n of data.notes) {
    needTrip("notes", n);
    n.placeIds.forEach((id) => needPlace("notes", id)); // v0.12.0
  }
  return [...new Set(errors)];
}

/** 用檢查過的資料取代全部；失敗時還原成原本的資料 → { ok } 或 { ok: false, errors } */
export function restoreBackup(data) {
  const keys = [...KINDS.map((k) => k.key), "settings"];
  if (!data || keys.some((k) => !Array.isArray(data[k]))) return fail("備份資料不完整");
  const before = {};
  for (const k of keys) before[k] = readStorageRaw(k);
  for (const k of keys) {
    // 設定用備份檔的，但「上次備份時間」保留這支手機自己的
    const value =
      k === "settings"
        ? [normalizeSettings({ ...data.settings[0], lastBackupAt: normalizeSettings(readCollection("settings")[0]).lastBackupAt })]
        : data[k];
    if (!writeCollection(k, value)) {
      for (const kk of keys) restoreStorageRaw(kk, before[kk]);
      return fail("寫入失敗（手機空間不足？），已還原成原本的資料");
    }
  }
  migrateItemNotes(); // v0.13.0：舊備份的行程項目備註搬進「這趟的備註」
  return { ok: true };
}

// localStorage 原文的保存／還原（只用在匯入失敗時還原，key 一律是 tp2_ 開頭）
function readStorageRaw(name) {
  try {
    return localStorage.getItem(`tp2_${name}`);
  } catch {
    return null;
  }
}
function restoreStorageRaw(name, value) {
  try {
    if (value === null) localStorage.removeItem(`tp2_${name}`);
    else localStorage.setItem(`tp2_${name}`, value);
  } catch {
    /* 還原失敗也不能讓 App 當掉 */
  }
}

function fail(message) {
  return { ok: false, errors: [message] };
}

