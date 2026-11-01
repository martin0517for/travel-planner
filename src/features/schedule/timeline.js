/**
 * timeline.js — 每日行程的「排列邏輯」（⑤，2026-11-01）。只計算，不畫畫面。
 *
 * 一天的 Timeline 是一條清單，包含：
 *   - 使用者自己加的行程項目（data/dayPlans.js 的 items）
 *   - 自動出現的：航班（出發那天）、住宿的退房／入住、活動（一段日期時每天都有）
 * 全部手動排序（▲▼），時間只用來顯示，不會自動重排（使用者決定）。
 *
 * 排列方式：先照 DayPlan.order（使用者排過的順序），順序裡沒有的（新出現的）依「預設位置」插入：
 *   - 退房、整天的活動（一段日期活動的第 2 天以後）→ 最上面
 *   - 入住 → 最下面
 *   - 有時間的 → 插在第一個「時間比它晚」的項目前面
 *   - 沒時間的 → 最下面（入住卡之前）
 * 另外有「色帶」：有住宿的每一晚，在當天最上面顯示「入住：飯店名」（不能移動，不在清單裡）。
 *
 * 沒有日期的旅程（或日期不在旅程期間）不會有自動出現的航班、住宿、有日期的活動。
 *
 * 沒有日期的航班、住宿、活動（v0.8.2 活動、v0.8.3 航班與住宿）：從行程頁加入時記在 DayPlan.placed，
 * 排在哪幾天就出現在哪幾天（有日期、沒日期的旅程都可以）。活動、住宿排在兩天以上時顯示「第 N 天／共 N 天」。
 * 「從行程移除」的自動項目（v0.8.3）記在 DayPlan.hidden，那天不顯示（色帶照常顯示）。
 */
import { parseDate, daysBetween, addDays, todayStr } from "../../core/dates.js";
import { dayPlanStore, LIMITS } from "../../data/dayPlans.js";
import { flightStore } from "../../data/flights.js";
import { accommodationStore } from "../../data/accommodations.js";
import { activityStore, daysOf } from "../../data/activities.js";

/**
 * 這趟旅程有哪幾天 → { dated, days: [{ day, date }], todayDay }
 *   有出發日：依出發日～回程日（沒填回程日＝一天）；date 是 "YYYY-MM-DD"
 *   沒有出發日：Day 1 ～ 有記錄的最後一天（至少 1 天），date 是 ""
 *   todayDay：旅程進行中時是今天第幾天，否則 0
 */
export function tripDays(trip) {
  const start = parseDate(trip.startDate);
  if (!start) {
    const count = Math.min(Math.max(1, dayPlanStore.maxDay(trip.id)), LIMITS.undatedDays);
    return { dated: false, days: Array.from({ length: count }, (_, i) => ({ day: i + 1, date: "" })), todayDay: 0 };
  }
  const end = parseDate(trip.endDate) || start;
  const count = Math.min(daysBetween(start, end) + 1, LIMITS.day);
  const days = Array.from({ length: count }, (_, i) => ({ day: i + 1, date: addDays(trip.startDate, i) }));
  const today = todayStr();
  const hit = days.find((d) => d.date === today);
  return { dated: true, days, todayDay: hit ? hit.day : 0 };
}

/**
 * 天數超出旅程日期、而且有項目的 DayPlan（例如旅程從 6 天改成 5 天，第 6 天的行程）。
 * 資料保留不顯示，畫面上方提示（使用者決定）。沒有日期的旅程不會有。
 */
export function outOfRangePlans(trip, info = tripDays(trip)) {
  if (!info.dated) return [];
  const count = info.days.length;
  return dayPlanStore
    .listByTrip(trip.id)
    .map((p) => ({ ...p, placedEntries: placedEntries(trip.id, p) }))
    .filter((p) => p.day > count && (p.items.length || p.placedEntries.length));
}

/** 航班、住宿、活動有沒有日期（沒有日期的才能「排進」某天） */
export function isDated(kind, obj) {
  if (kind === "flight") return Boolean(obj.departureTime);
  if (kind === "stay") return Boolean(obj.checkInDate || obj.checkOutDate);
  return Boolean(obj.startDate);
}

const PLACED_KIND = { f: "flight", s: "stay", a: "activity" };
const STORE_OF = { flight: flightStore, stay: accommodationStore, activity: activityStore };

/** 「排進來」用的引用：航班 "f:"、住宿 "s:"、活動 "a:" */
export function placedRef(kind, obj) {
  return `${{ flight: "f", stay: "s", activity: "a" }[kind]}:${obj.id}`;
}

/**
 * 某天排進來的（沒有日期的）航班、住宿、活動 → Timeline 的項目。
 * 已刪除、不是這趟、或之後填了日期的略過。
 */
export function placedEntries(tripId, plan) {
  if (!plan) return [];
  const out = [];
  for (const ref of plan.placed) {
    const kind = PLACED_KIND[ref.split(":")[0]];
    const obj = STORE_OF[kind].get(ref.slice(ref.indexOf(":") + 1));
    if (!obj || obj.tripId !== tripId || isDated(kind, obj)) continue;
    const days = dayPlanStore.daysPlaced(tripId, ref);
    const nth = days.indexOf(plan.day) + 1;
    const total = days.length;
    if (kind === "flight") out.push({ ref, kind, data: obj, placed: true, time: "", slot: "normal" });
    else if (kind === "stay") out.push({ ref, kind, data: obj, placed: true, time: "", slot: "normal", nth, total });
    else out.push({ ref, kind, data: obj, placed: true, nth, total, time: nth === 1 ? obj.startTime : "", slot: "normal" });
  }
  return out;
}

/**
 * 某一天的內容 → { entries, bands }
 *   entries：[{ ref, kind, data, time, slot, ... }] 已排好順序
 *     kind：item｜flight｜checkout｜checkin｜activity
 *     time：顯示用的時間（"HH:mm" 或 ""）
 *     slot：預設位置 top｜normal｜bottom
 *   bands：[{ stay }] 這晚住哪裡（色帶）
 */
export function dayContent(trip, day, date) {
  const plan = dayPlanStore.get(trip.id, day);
  const hidden = new Set(plan ? plan.hidden : []);
  const candidates = [];

  for (const item of plan ? plan.items : []) {
    candidates.push({ ref: `i:${item.id}`, kind: "item", data: item, time: item.time, slot: "normal" });
  }

  const bands = [];
  if (date) {
    for (const f of flightStore.listByTrip(trip.id)) {
      if (f.departureTime.slice(0, 10) !== date || hidden.has(`f:${f.id}`)) continue;
      candidates.push({ ref: `f:${f.id}`, kind: "flight", data: f, time: f.departureTime.slice(11, 16), slot: "normal" });
    }
    for (const s of accommodationStore.listByTrip(trip.id)) {
      if (s.checkOutDate === date && !hidden.has(`so:${s.id}`)) {
        candidates.push({ ref: `so:${s.id}`, kind: "checkout", data: s, time: s.checkOutTime, slot: "top" });
      }
      if (s.checkInDate === date && !hidden.has(`si:${s.id}`)) {
        candidates.push({ ref: `si:${s.id}`, kind: "checkin", data: s, time: s.checkInTime, slot: "bottom" });
      }
      // 色帶：這晚住在這裡（入住日 ≤ 今天 < 退房日；沒填退房日時只有入住那晚）
      const night = s.checkInDate && s.checkInDate <= date && (s.checkOutDate ? date < s.checkOutDate : date === s.checkInDate);
      if (night) bands.push({ stay: s });
    }
    for (const a of activityStore.listByTrip(trip.id)) {
      const info = activityOnDate(a, date);
      if (!info || hidden.has(`a:${a.id}`)) continue;
      candidates.push({ ref: `a:${a.id}`, kind: "activity", data: a, ...info });
    }
  }

  // 沒有日期、排進這天的航班、住宿、活動（活動第一天顯示開始時間）
  candidates.push(...placedEntries(trip.id, plan));

  return { entries: arrange(candidates, plan ? plan.order : []), bands };
}

/**
 * 活動在某天的樣子：不在這天回傳 null。
 *   一天的活動：時間＝開始時間
 *   一段日期：第一天顯示開始時間；之後的日子顯示「整天」並預設放最上面
 */
function activityOnDate(a, date) {
  if (!a.startDate) return null;
  const last = a.endDate || a.startDate;
  if (date < a.startDate || date > last) return null;
  const total = daysOf(a) || 1;
  const nth = daysBetween(parseDate(a.startDate), parseDate(date)) + 1;
  if (total === 1 || nth === 1) return { time: a.startTime, slot: "normal", nth, total };
  return { time: "", allDay: true, slot: "top", nth, total };
}

/** 依使用者排過的順序排列，沒排過的依預設位置插入 */
function arrange(candidates, order) {
  const byRef = new Map(candidates.map((c) => [c.ref, c]));
  const list = order.filter((ref) => byRef.has(ref)).map((ref) => byRef.get(ref));
  const placed = new Set(list.map((c) => c.ref));
  // 沒排過的：自己加的項目依建立先後，其他依時間
  const missing = candidates.filter((c) => !placed.has(c.ref));
  for (const c of missing) insertAt(list, c);
  return list;
}

/** 依預設位置把一個項目插進清單（會直接改 list） */
export function insertAt(list, entry) {
  if (entry.slot === "top") {
    let i = 0;
    while (i < list.length && list[i].slot === "top") i++;
    list.splice(i, 0, entry);
    return list;
  }
  if (entry.slot === "bottom") {
    list.push(entry);
    return list;
  }
  // 最下面的入住卡之前（沒時間的項目放這裡；有時間但沒有比它晚的，也放這裡）
  let end = list.length;
  while (end > 0 && list[end - 1].slot === "bottom") end--;
  let start = 0;
  while (start < list.length && list[start].slot === "top") start++;
  if (entry.time) {
    for (let i = start; i < end; i++) {
      if (list[i].time && list[i].slot === "normal" && list[i].time > entry.time) {
        list.splice(i, 0, entry);
        return list;
      }
    }
  }
  list.splice(Math.max(end, start), 0, entry);
  return list;
}

/**
 * 加入（或從別天搬來）一個行程項目後，那一天的完整順序。
 * ref 是 "i:NEW"（新增）、"i:<id>"（搬來），或排進沒有日期的航班 "f:"、住宿 "s:"、活動 "a:"。
 */
export function orderWithNewItem(trip, day, date, ref, time) {
  const { entries } = dayContent(trip, day, date);
  const list = entries.filter((e) => e.ref !== ref);
  insertAt(list, { ref, time, slot: "normal" });
  return list.map((e) => e.ref);
}

