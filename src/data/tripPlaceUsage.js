/**
 * tripPlaceUsage.js — 某個地點在「某一趟旅程」裡用在哪裡（計畫書 9.2 第 ③ 小步，2026-11-01）。
 *
 * 用途：
 *   - 清單上判斷「已排入」並變淡，右邊小標顯示簡短文字（short，只有「航班」「住宿」）
 *   - 預覽顯示完整內容（full，例如「去程航班 BR198」「住宿 12-20（日）入住」）
 *   - 已排入的地點不能從清單移除
 *   - 打開清單時，把這趟已經用到的地點補進清單（舊資料）
 *
 * 目前檢查航班、住宿、活動（9.5：小標寫活動名稱「環球影城」，預覽寫「活動 環球影城」）。
 * ⑤ 行程（2026-11-01）：小標寫「Day 2」，預覽寫「Day 2 行程」；同一天放兩次只算一次。
 * （placeUsage.js 是「所有旅程」範圍、刪除地點用；這裡只看一趟。）
 *
 * 排列（v0.8.1 使用者決定）：航班 → 住宿 → 活動 → Day 1 → Day 2 …
 *   航班照出發時間、住宿照入住日、活動照開始日（各 store 的 listByTrip 已排好），
 *   同一天照那天行程頁上的順序。每筆帶 rank（數字，越小越前面），
 *   清單「已排入」區塊用第一筆（最前面那個）的 rank 排序，小標也顯示這一筆。
 */
import { flightStore, directionLabel } from "./flights.js";
import { accommodationStore } from "./accommodations.js";
import { activityStore } from "./activities.js";
import { dayPlanStore } from "./dayPlans.js";
import { formatDateShort } from "../core/dates.js";

// rank = 分類 × 1,000,000 ＋ 第幾筆（或第幾天）× 1,000 ＋ 同一筆／同一天裡的位置
const GROUP = { flight: 0, stay: 1, activity: 2, day: 3 };
const rankOf = (group, index, pos = 0) => GROUP[group] * 1e6 + Math.min(index, 999) * 1e3 + Math.min(pos, 999);

/** 回傳 [{ short, full, rank }]（已依 rank 排好）；空陣列代表「未排入」 */
export function tripUsages(tripId, placeId) {
  const out = [];
  flightStore.listByTrip(tripId).forEach((f, i) => {
    if (f.departurePlaceId !== placeId && f.arrivalPlaceId !== placeId) return;
    // 小標一律只寫「航班」（2026-11-01 使用者決定）；預覽的完整內容才寫去程／回程與航班號碼
    const full = (f.direction === "other" ? "" : directionLabel(f.direction)) + "航班";
    // 同一班：出發機場排在抵達機場前面
    const pos = f.departurePlaceId === placeId ? 0 : 1;
    out.push({ short: "航班", full: [full, f.flightNo].filter(Boolean).join(" "), rank: rankOf("flight", i, pos) });
  });
  accommodationStore.listByTrip(tripId).forEach((s, i) => {
    if (s.placeId !== placeId) return;
    out.push({
      short: "住宿",
      full: s.checkInDate ? `住宿 ${formatDateShort(s.checkInDate)}入住` : "住宿",
      rank: rankOf("stay", i),
    });
  });
  activityStore.listByTrip(tripId).forEach((a, i) => {
    const pos = a.placeIds.indexOf(placeId);
    if (pos < 0) return;
    out.push({ short: a.title, full: `活動 ${a.title}`, rank: rankOf("activity", i, pos) });
  });
  for (const p of dayPlanStore.listByTrip(tripId)) {
    const items = p.items.filter((it) => it.placeId === placeId);
    if (!items.length) continue;
    out.push({ short: `Day ${p.day}`, full: `Day ${p.day} 行程`, rank: rankOf("day", p.day, Math.min(...items.map((it) => dayPosition(p, it)))) });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

/** 行程項目在那天的位置：照使用者排的順序（order）；順序裡沒有的放在後面（依加入先後） */
function dayPosition(plan, item) {
  const at = plan.order.indexOf(`i:${item.id}`);
  return at >= 0 ? at : plan.order.length + plan.items.indexOf(item);
}

/** 這趟旅程的航班、住宿、活動、行程用到的所有地點 id（打開清單時補進清單用） */
export function tripUsedPlaceIds(tripId) {
  const ids = new Set();
  for (const f of flightStore.listByTrip(tripId)) {
    if (f.departurePlaceId) ids.add(f.departurePlaceId);
    if (f.arrivalPlaceId) ids.add(f.arrivalPlaceId);
  }
  for (const s of accommodationStore.listByTrip(tripId)) if (s.placeId) ids.add(s.placeId);
  for (const a of activityStore.listByTrip(tripId)) a.placeIds.forEach((id) => ids.add(id));
  for (const p of dayPlanStore.listByTrip(tripId)) p.items.forEach((it) => it.placeId && ids.add(it.placeId));
  return [...ids];
}
