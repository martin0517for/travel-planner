/**
 * placeUsage.js — 查詢「某個地點被哪些資料使用」（2026-11-01）。
 *
 * 用途：刪除地點前檢查。正在被使用的地點不能刪除，並告訴使用者用在哪裡，
 * 例如「東京賞櫻｜去程航班 BR198」，要先從那裡移除才能刪（計畫書 9.2 第 6 點的做法）。
 *
 * 目前檢查航班、住宿、活動（9.5）、每日行程（⑤）、筆記（v0.12.0）、旅程地點清單（2026-11-01 加入）。之後有新的資料引用地點時，在 placeUsages() 裡加上對應的檢查。
 * 獨立成一個檔案，是為了不讓 places.js 直接依賴其他資料（避免互相 import）。
 */
import { flightStore, directionLabel } from "./flights.js";
import { tripStore } from "./trips.js";
import { accommodationStore } from "./accommodations.js";
import { tripPlaceStore } from "./tripPlaces.js";
import { activityStore } from "./activities.js";
import { dayPlanStore } from "./dayPlans.js";
import { noteStore } from "./notes.js";
import { formatDateShort } from "../core/dates.js";

/** 回傳描述文字的陣列；空陣列代表沒有被使用 */
export function placeUsages(placeId) {
  const tripName = (id) => (tripStore.get(id) || {}).name || "（未知旅程）";
  const flights = flightStore.usingPlace(placeId).map((f) => {
    const dir = f.direction === "other" ? "" : directionLabel(f.direction);
    const label = [dir + "航班", f.flightNo].filter(Boolean).join(" ");
    return `${tripName(f.tripId)}｜${label}`;
  });
  const stays = accommodationStore.usingPlace(placeId).map((s) => {
    const when = s.checkInDate ? ` ${formatDateShort(s.checkInDate)}入住` : "";
    return `${tripName(s.tripId)}｜住宿${when}`;
  });
  const acts = activityStore.usingPlace(placeId).map((a) => `${tripName(a.tripId)}｜活動 ${a.title}`);
  const days = dayPlanStore.usingPlace(placeId).map((d) => `${tripName(d.tripId)}｜Day ${d.day} 行程`);
  const notes = noteStore.usingPlace(placeId).map((n) => `${tripName(n.tripId)}｜筆記 ${n.title}`);
  const lists = tripPlaceStore.usingPlace(placeId).map((t) => `${tripName(t.tripId)}｜想去的地點清單`);
  return [...flights, ...stays, ...acts, ...days, ...notes, ...lists];
}
