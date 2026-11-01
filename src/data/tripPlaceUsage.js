/**
 * tripPlaceUsage.js — 某個地點在「某一趟旅程」裡用在哪裡（計畫書 9.2 第 ③ 小步，2026-11-01）。
 *
 * 用途：
 *   - 清單上判斷「已排入」並變淡，右邊小標顯示簡短文字（short，只有「航班」「住宿」）
 *   - 預覽顯示完整內容（full，例如「去程航班 BR198」「住宿 12-20（日）入住」）
 *   - 已排入的地點不能從清單移除
 *   - 打開清單時，把這趟已經用到的地點補進清單（舊資料）
 *
 * 目前檢查航班、住宿。之後加上：9.5 活動（「活動：環球影城」）、⑤ 行程（「Day 2」）。
 * （placeUsage.js 是「所有旅程」範圍、刪除地點用；這裡只看一趟。）
 */
import { flightStore, directionLabel } from "./flights.js";
import { accommodationStore } from "./accommodations.js";
import { formatDateShort } from "../core/dates.js";

/** 回傳 [{ short, full }]；空陣列代表「未排入」 */
export function tripUsages(tripId, placeId) {
  const out = [];
  for (const f of flightStore.listByTrip(tripId)) {
    if (f.departurePlaceId !== placeId && f.arrivalPlaceId !== placeId) continue;
    // 小標一律只寫「航班」（2026-11-01 使用者決定）；預覽的完整內容才寫去程／回程與航班號碼
    const full = (f.direction === "other" ? "" : directionLabel(f.direction)) + "航班";
    out.push({ short: "航班", full: [full, f.flightNo].filter(Boolean).join(" ") });
  }
  for (const s of accommodationStore.listByTrip(tripId)) {
    if (s.placeId !== placeId) continue;
    out.push({ short: "住宿", full: s.checkInDate ? `住宿 ${formatDateShort(s.checkInDate)}入住` : "住宿" });
  }
  return out;
}

/** 這趟旅程的航班、住宿用到的所有地點 id（打開清單時補進清單用） */
export function tripUsedPlaceIds(tripId) {
  const ids = new Set();
  for (const f of flightStore.listByTrip(tripId)) {
    if (f.departurePlaceId) ids.add(f.departurePlaceId);
    if (f.arrivalPlaceId) ids.add(f.arrivalPlaceId);
  }
  for (const s of accommodationStore.listByTrip(tripId)) if (s.placeId) ids.add(s.placeId);
  return [...ids];
}
