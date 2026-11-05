/**
 * dayPlans.js — 每日行程（DayPlan）：每趟旅程每一天一筆（⑤ 每日行程 Timeline，2026-11-01）。
 *
 * DayPlan 用「第幾天」記錄，不用日期（使用者決定）：
 *   改出發日時行程跟著平移；沒有日期的旅程也能先用 Day 1、Day 2 排。
 *   航班、住宿、活動有自己的日期，不跟著平移。
 *
 * DayPlan 欄位：
 *   id        string   例如 "day_k3x9q2m7a1bc"
 *   tripId    string   屬於哪一趟旅程（刪除旅程時連帶刪除）
 *   day       number   第幾天（1 開始）；同一趟旅程同一天只會有一筆
 *   items     Item[]   使用者自己加的行程項目（最多 100 個）
 *   order     string[] 這天的排列順序（使用者用 ▲▼ 排的），每個是一個「引用」：
 *                        "i:<項目 id>"   行程項目
 *                        "f:<航班 id>"   航班（出發那天）
 *                        "si:<住宿 id>"  住宿的入住
 *                        "so:<住宿 id>"  住宿的退房
 *                        "a:<活動 id>"   活動（一段日期時每天各自記錄位置）
 *                      航班、住宿、活動只記 id，不複製它們的資料。
 *                      順序裡沒有的（新出現的）由畫面依預設位置插入；已不存在的自動略過。
 *   placed    string[] 排在這天的「沒有日期的」航班、住宿、活動（v0.8.2 活動、v0.8.3 航班與住宿）：
 *                        "f:<航班 id>"  沒有出發時間的航班（只能排在一天）
 *                        "s:<住宿 id>"  沒有入住日、退房日的住宿（可以排在好幾天）
 *                        "a:<活動 id>"  沒有開始日的活動（可以排在好幾天）
 *                      有日期的照日期自動出現；之後填了日期，就從所有天移除（改照日期出現）。
 *                      （v0.8.2 的欄位 activityIds 讀取時自動轉成 "a:" 放進這裡）
 *   hidden    string[] 這天「從行程移除」的自動項目（v0.8.3）："f:" "si:" "so:" "a:"。
 *                      航班、住宿、活動本身不改，總覽頁照常顯示；總覽頁按「加入行程」會清掉。
 *   createdAt / updatedAt
 *
 * Item（行程項目）欄位：地點、文字至少填一項
 *   id           string   例如 "item_k3x9q2m7a1bc"
 *   placeId      string   地點 id 或 ""
 *   text         string   文字，最多 40 字（有地點時是補充說明，沒地點時就是項目名稱）
 *   kind         string   沒地點時的類型：move 移動／meal 用餐／rest 休息／other 其他
 *   time         string   "HH:mm" 或 ""（只用來顯示，不會自動重排）
 *   transport    string   交通方式（怎麼到下一站），最多 30 字
 *   notes        string   備註，最多 1000 字（網址在畫面上會變成連結）
 *                         v0.13.0：有地點的項目不用這欄，改用「這趟的備註」（data/placeNotes.js）；
 *                         只有舊資料搬不過去（合起來超過 1000 字）時才會留著
 *   costAmount   number|null  每人費用（資料預留，畫面目前不顯示）
 *   costCurrency string   幣別，例如 "JPY"（資料預留）
 *   createdAt / updatedAt
 *
 * 行程項目的地點自動加入這趟的「想去的地點」清單；移除後地點留在清單（變回未排入）。
 *
 * 注意：這個檔案不 import places.js（places.js → placeUsage.js → 這裡，避免互相 import）。
 *
 * 資安：寫入前一律經過 validateItemInput；從本機讀出的資料也經過 normalize，格式不對的略過。
 *      地點只存 id，順序只接受認得的引用格式。
 */
import { readCollection, writeCollection, newId, isValidId } from "../core/storage.js";
import { isValidTime } from "../core/dates.js";
import { tripPlaceStore } from "./tripPlaces.js";

const COLLECTION = "dayPlans";
const STORAGE_FAIL = "儲存失敗：手機本機空間不足，或瀏覽器不允許儲存（例如無痕模式）";

export const LIMITS = { text: 40, transport: 30, notes: 1000, items: 100, placed: 50, hidden: 100, order: 300, day: 366, undatedDays: 60 };

/** 純文字項目的類型（沒選地點時用來決定圖示）。順序就是表單上的顯示順序。 */
export const ITEM_KINDS = [
  { value: "move", label: "移動" },
  { value: "meal", label: "用餐" },
  { value: "rest", label: "休息" },
  { value: "other", label: "其他" },
];
const KIND_VALUES = new Set(ITEM_KINDS.map((k) => k.value));
export function kindLabel(value) {
  return (ITEM_KINDS.find((k) => k.value === value) || ITEM_KINDS[3]).label;
}

/** 交通方式的快速選項（點一下帶入，也可以自己打） */
export const TRANSPORT_PICKS = ["步行", "電車", "地鐵", "公車", "計程車", "開車", "新幹線", "船"];

const REF_PATTERN = /^(i|f|si|so|s|a):[a-z0-9_]{3,40}$/;
const PLACED_PATTERN = /^(f|s|a):[a-z0-9_]{3,40}$/;
const HIDDEN_PATTERN = /^(f|si|so|a):[a-z0-9_]{3,40}$/;
export function isValidRef(ref) {
  return typeof ref === "string" && REF_PATTERN.test(ref);
}

function cleanText(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanItem(raw) {
  const amount = typeof raw.costAmount === "number" && Number.isFinite(raw.costAmount) && raw.costAmount >= 0 ? raw.costAmount : null;
  return {
    placeId: isValidId(raw.placeId) ? raw.placeId : "",
    text: cleanText(raw.text, LIMITS.text),
    kind: KIND_VALUES.has(raw.kind) ? raw.kind : "other",
    time: isValidTime(raw.time) ? raw.time.slice(0, 5) : "",
    transport: cleanText(raw.transport, LIMITS.transport),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, LIMITS.notes) : "",
    costAmount: amount,
    costCurrency: typeof raw.costCurrency === "string" && /^[A-Z]{3}$/.test(raw.costCurrency) ? raw.costCurrency : "",
  };
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object" || !isValidId(raw.id)) return null;
  const item = cleanItem(raw);
  if (!item.placeId && !item.text) return null;
  return {
    id: raw.id,
    ...item,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function cleanOrder(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const ref of list) {
    if (isValidRef(ref) && !out.includes(ref)) out.push(ref);
    if (out.length >= LIMITS.order) break;
  }
  return out;
}

/** 只留符合格式、不重複的引用 */
function cleanRefs(list, pattern, max) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const ref of list) {
    if (typeof ref === "string" && pattern.test(ref) && !out.includes(ref)) out.push(ref);
    if (out.length >= max) break;
  }
  return out;
}

export function normalizePlan(raw) {
  if (!raw || typeof raw !== "object" || !isValidId(raw.id) || !isValidId(raw.tripId)) return null;
  if (!Number.isInteger(raw.day) || raw.day < 1 || raw.day > LIMITS.day) return null;
  const items = [];
  const seen = new Set();
  for (const it of Array.isArray(raw.items) ? raw.items : []) {
    const item = normalizeItem(it);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
    if (items.length >= LIMITS.items) break;
  }
  return {
    id: raw.id,
    tripId: raw.tripId,
    day: raw.day,
    items,
    placed: cleanRefs(
      [...(Array.isArray(raw.placed) ? raw.placed : []), ...(Array.isArray(raw.activityIds) ? raw.activityIds.map((id) => `a:${id}`) : [])],
      PLACED_PATTERN,
      LIMITS.placed
    ),
    hidden: cleanRefs(raw.hidden, HIDDEN_PATTERN, LIMITS.hidden),
    order: cleanOrder(raw.order),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

/** 讀出全部；同一趟旅程同一天重複的只留第一筆 */
function loadAll() {
  const seen = new Set();
  const out = [];
  for (const plan of readCollection(COLLECTION).map(normalizePlan)) {
    if (!plan) continue;
    const key = `${plan.tripId}|${plan.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(plan);
  }
  return out;
}

const save = (all) => writeCollection(COLLECTION, all);

/** 找到（或建立）某天的 DayPlan；回傳在 all 裡的那一筆 */
function ensurePlan(all, tripId, day) {
  let plan = all.find((p) => p.tripId === tripId && p.day === day);
  if (!plan) {
    const now = new Date().toISOString();
    plan = { id: newId("day"), tripId, day, items: [], placed: [], hidden: [], order: [], createdAt: now, updatedAt: now };
    all.push(plan);
  }
  return plan;
}

function validDay(day) {
  return Number.isInteger(day) && day >= 1 && day <= LIMITS.day;
}

export function validateItemInput(input) {
  const errors = [];
  const text = cleanText(input.text, LIMITS.text + 1);
  const placeId = isValidId(input.placeId) ? input.placeId : "";
  if (!placeId && !text) errors.push("請選擇地點，或輸入文字");
  if (text.length > LIMITS.text) errors.push(`文字最多 ${LIMITS.text} 字`);
  if (input.time && !isValidTime(input.time)) errors.push("時間格式不正確");
  if (cleanText(input.transport, LIMITS.transport + 1).length > LIMITS.transport) errors.push(`交通方式最多 ${LIMITS.transport} 字`);
  if (typeof input.notes === "string" && input.notes.length > LIMITS.notes) errors.push(`備註最多 ${LIMITS.notes} 字`);
  return { errors, value: cleanItem(input) };
}

/** 把順序裡的「新項目」佔位符換成真正的 id，並整理格式 */
function finalOrder(order, ref) {
  return cleanOrder((Array.isArray(order) ? order : []).map((r) => (r === "i:NEW" ? ref : r)));
}

function addToTripList(tripId, item) {
  if (item.placeId) tripPlaceStore.addMany(tripId, [item.placeId]);
}

export const dayPlanStore = {
  /** 所有旅程的 DayPlan（v0.13.0 舊資料搬移用） */
  listAll() {
    return loadAll();
  },

  /** 清掉這些項目自己的備註（v0.13.0 搬進「這趟的備註」之後） */
  clearItemNotes(tripId, itemIds) {
    const ids = new Set(itemIds);
    const all = loadAll();
    let changed = false;
    for (const plan of all.filter((p) => p.tripId === tripId)) {
      for (const it of plan.items) {
        if (ids.has(it.id) && it.notes) {
          it.notes = "";
          changed = true;
        }
      }
    }
    if (changed && !save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 這趟旅程的所有 DayPlan，依第幾天排列 */
  listByTrip(tripId) {
    return loadAll()
      .filter((p) => p.tripId === tripId)
      .sort((a, b) => a.day - b.day);
  },

  get(tripId, day) {
    return loadAll().find((p) => p.tripId === tripId && p.day === day) || null;
  },

  /** 有記錄的最後一天（沒有日期的旅程用來決定共幾天）；沒有任何記錄時是 0 */
  maxDay(tripId) {
    return this.listByTrip(tripId).reduce((max, p) => Math.max(max, p.day), 0);
  },

  /** 找出某個項目在哪一天 → { plan, item } 或 null */
  findItem(tripId, itemId) {
    for (const plan of this.listByTrip(tripId)) {
      const item = plan.items.find((it) => it.id === itemId);
      if (item) return { plan, item };
    }
    return null;
  },

  /**
   * 新增行程項目。order 是畫面算好的「加入後這天的完整順序」，新項目的位置用 "i:NEW" 表示。
   */
  createItem(tripId, day, input, order) {
    if (!isValidId(tripId) || !validDay(day)) return { ok: false, errors: ["找不到這一天"] };
    const { errors, value } = validateItemInput(input);
    if (errors.length) return { ok: false, errors };
    const all = loadAll();
    const plan = ensurePlan(all, tripId, day);
    if (plan.items.length >= LIMITS.items) return { ok: false, errors: [`一天最多 ${LIMITS.items} 個項目`] };
    const now = new Date().toISOString();
    const item = { id: newId("item"), ...value, createdAt: now, updatedAt: now };
    plan.items.push(item);
    plan.order = finalOrder(order, `i:${item.id}`);
    plan.updatedAt = now;
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    addToTripList(tripId, item);
    return { ok: true, item };
  },

  /**
   * 修改行程項目。toDay 跟原本不同時，搬到那一天；order 是那一天搬入後的完整順序（只在換天時使用）。
   * 每人費用目前畫面不顯示：input 沒帶時保留原本的值。
   */
  updateItem(tripId, itemId, input, { toDay, order } = {}) {
    const all = loadAll();
    const from = all.find((p) => p.tripId === tripId && p.items.some((it) => it.id === itemId));
    if (!from) return { ok: false, errors: ["找不到這個項目"] };
    const old = from.items.find((it) => it.id === itemId);
    const merged = { ...input };
    if (!("costAmount" in merged)) merged.costAmount = old.costAmount;
    if (!("costCurrency" in merged)) merged.costCurrency = old.costCurrency;
    const { errors, value } = validateItemInput(merged);
    if (errors.length) return { ok: false, errors };
    const now = new Date().toISOString();
    const item = { ...old, ...value, updatedAt: now };
    const ref = `i:${itemId}`;
    if (validDay(toDay) && toDay !== from.day) {
      const to = ensurePlan(all, tripId, toDay);
      if (to.items.length >= LIMITS.items) return { ok: false, errors: [`一天最多 ${LIMITS.items} 個項目`] };
      from.items = from.items.filter((it) => it.id !== itemId);
      from.order = from.order.filter((r) => r !== ref);
      from.updatedAt = now;
      to.items.push(item);
      to.order = finalOrder(order, ref);
      to.updatedAt = now;
    } else {
      from.items = from.items.map((it) => (it.id === itemId ? item : it));
      from.updatedAt = now;
    }
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    addToTripList(tripId, item);
    return { ok: true, item };
  },

  removeItem(tripId, itemId) {
    const all = loadAll();
    const plan = all.find((p) => p.tripId === tripId && p.items.some((it) => it.id === itemId));
    if (!plan) return { ok: false, errors: ["找不到這個項目"] };
    plan.items = plan.items.filter((it) => it.id !== itemId);
    plan.order = plan.order.filter((r) => r !== `i:${itemId}`);
    plan.updatedAt = new Date().toISOString();
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /**
   * 把一個沒有日期的航班／住宿／活動排進某一天（ref："f:" "s:" "a:"）。
   * order 是畫面算好的「加入後這天的完整順序」。single＝只能排一天（航班）：先從其他天拿掉。
   */
  place(tripId, day, ref, order, { single = false } = {}) {
    if (!isValidId(tripId) || !validDay(day) || !PLACED_PATTERN.test(ref)) return { ok: false, errors: ["找不到這一天"] };
    const all = loadAll();
    if (single) {
      for (const p of all) {
        if (p.tripId !== tripId || p.day === day || !p.placed.includes(ref)) continue;
        p.placed = p.placed.filter((r) => r !== ref);
        p.order = p.order.filter((r) => r !== ref);
      }
    }
    const plan = ensurePlan(all, tripId, day);
    if (!plan.placed.includes(ref)) {
      if (plan.placed.length >= LIMITS.placed) return { ok: false, errors: [`一天最多排 ${LIMITS.placed} 個未定日期的項目`] };
      plan.placed.push(ref);
    }
    plan.order = cleanOrder(order);
    plan.updatedAt = new Date().toISOString();
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 從某一天拿掉一個排進來的（沒有日期的）項目；本身不刪除 */
  unplace(tripId, day, ref) {
    const all = loadAll();
    const plan = all.find((p) => p.tripId === tripId && p.day === day);
    if (!plan || !plan.placed.includes(ref)) return { ok: true };
    plan.placed = plan.placed.filter((r) => r !== ref);
    plan.order = plan.order.filter((r) => r !== ref);
    plan.updatedAt = new Date().toISOString();
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 這個（沒有日期的）項目排在哪幾天 → [第幾天...]（由小到大） */
  daysPlaced(tripId, ref) {
    return this.listByTrip(tripId)
      .filter((p) => p.placed.includes(ref))
      .map((p) => p.day);
  },

  /** 「從行程移除」有日期的自動項目：記在那天的 hidden，順序裡的位置也拿掉（放回時用預設位置） */
  hide(tripId, day, refs) {
    if (!isValidId(tripId) || !validDay(day)) return { ok: false, errors: ["找不到這一天"] };
    const list = refs.filter((r) => HIDDEN_PATTERN.test(r));
    const all = loadAll();
    const plan = ensurePlan(all, tripId, day);
    for (const ref of list) if (!plan.hidden.includes(ref)) plan.hidden.push(ref);
    if (plan.hidden.length > LIMITS.hidden) return { ok: false, errors: ["這天移除的項目太多了"] };
    plan.order = plan.order.filter((r) => !list.includes(r));
    plan.updatedAt = new Date().toISOString();
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 放回行程：day 有值只清那天，沒有就清所有天 */
  unhide(tripId, refs, day = 0) {
    const all = loadAll();
    let changed = false;
    for (const p of all) {
      if (p.tripId !== tripId || (day && p.day !== day)) continue;
      const next = p.hidden.filter((r) => !refs.includes(r));
      if (next.length === p.hidden.length) continue;
      p.hidden = next;
      p.updatedAt = new Date().toISOString();
      changed = true;
    }
    if (changed && !save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /**
   * 航班、住宿、活動填了日期、改了日期或被刪除時：從所有天拿掉「排進來」和「移除」的紀錄，
   * 順序裡的位置也清掉（之後照日期、預設位置出現）。refs 例如 ["f:id"]、["s:id","si:id","so:id"]。
   */
  forget(tripId, refs) {
    const all = loadAll();
    let changed = false;
    for (const p of all) {
      if (p.tripId !== tripId) continue;
      const has = (list) => list.some((r) => refs.includes(r));
      if (!has(p.placed) && !has(p.hidden) && !has(p.order)) continue;
      p.placed = p.placed.filter((r) => !refs.includes(r));
      p.hidden = p.hidden.filter((r) => !refs.includes(r));
      p.order = p.order.filter((r) => !refs.includes(r));
      changed = true;
    }
    if (changed && !save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 儲存這天的排列順序（▲▼ 之後呼叫） */
  setOrder(tripId, day, order) {
    if (!isValidId(tripId) || !validDay(day)) return { ok: false, errors: ["找不到這一天"] };
    const all = loadAll();
    const plan = ensurePlan(all, tripId, day);
    plan.order = cleanOrder(order);
    plan.updatedAt = new Date().toISOString();
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 沒有日期的旅程：新增一天（建立一筆空的 DayPlan） */
  addDay(tripId, day) {
    if (!isValidId(tripId) || !Number.isInteger(day) || day < 2 || day > LIMITS.undatedDays) {
      return { ok: false, errors: [`最多 ${LIMITS.undatedDays} 天`] };
    }
    const all = loadAll();
    ensurePlan(all, tripId, day);
    if (!save(all)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /** 刪除某天的整筆 DayPlan（含裡面的項目） */
  removeDay(tripId, day) {
    const all = loadAll();
    const next = all.filter((p) => !(p.tripId === tripId && p.day === day));
    if (next.length === all.length) return { ok: true };
    if (!save(next)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true };
  },

  /**
   * 把某天的項目全部搬到另一天的最後面，原本那天刪除（天數超出旅程日期時用）。
   * baseOrder：畫面算好的「目標那天目前的完整順序」，搬來的項目接在它後面。
   */
  moveDayItems(tripId, fromDay, toDay, baseOrder) {
    if (!validDay(toDay)) return { ok: false, errors: ["找不到這一天"] };
    const all = loadAll();
    const from = all.find((p) => p.tripId === tripId && p.day === fromDay);
    if (!from) return { ok: true, moved: 0 };
    const to = ensurePlan(all, tripId, toDay);
    if (to.items.length + from.items.length > LIMITS.items) return { ok: false, errors: [`一天最多 ${LIMITS.items} 個項目`] };
    // 排進來的（沒有日期的）航班、住宿、活動也一起搬（最後一天已經有的不重複）
    const placed = from.placed.filter((r) => !to.placed.includes(r));
    if (to.placed.length + placed.length > LIMITS.placed) {
      return { ok: false, errors: [`一天最多排 ${LIMITS.placed} 個未定日期的項目`] };
    }
    // 照原本那天的順序搬過去；順序裡沒有的接在後面
    const known = new Set([...from.items.map((it) => `i:${it.id}`), ...placed]);
    const refs = [...from.order, ...from.items.map((it) => `i:${it.id}`), ...placed];
    const moved = [...new Set(refs)].filter((r) => known.has(r));
    to.items.push(...from.items);
    to.placed.push(...placed);
    to.order = cleanOrder([...(Array.isArray(baseOrder) ? baseOrder : to.order), ...moved]);
    to.updatedAt = new Date().toISOString();
    const next = all.filter((p) => p !== from);
    if (!save(next)) return { ok: false, errors: [STORAGE_FAIL] };
    return { ok: true, moved: moved.length };
  },

  /** 刪除旅程時呼叫 */
  removeByTrip(tripId) {
    const all = loadAll();
    const next = all.filter((p) => p.tripId !== tripId);
    if (next.length === all.length) return true;
    return save(next);
  },

  /** 有哪些行程項目用到這個地點 → [{ tripId, day }]（刪除地點前檢查用；同一天只算一次） */
  usingPlace(placeId) {
    return loadAll()
      .filter((p) => p.items.some((it) => it.placeId === placeId))
      .map((p) => ({ tripId: p.tripId, day: p.day }));
  },
};
