import { BaseRepository } from "./BaseRepository.js";

/**
 * DayPlan（單日行程）的 Repository（存 localStorage key "tp_dayplans"）。
 * 一筆 DayPlan = 一趟旅程裡的某一天，裡面的 items 陣列是那天所有行程項目
 * （行程項目直接存在 DayPlan.items 裡，不是獨立一份資料——因為手動排序時
 * 只要重新排這個陣列的順序就好，比較簡單）。
 */
class DayPlanRepository extends BaseRepository {
  constructor() {
    super("tp_dayplans", "day");
  }

  /** 找某趟旅程、某一天（YYYY-MM-DD）的 DayPlan，還沒建立過就回傳 null */
  getByTripAndDate(tripId, date) {
    return this.getAll().find((d) => d.tripId === tripId && d.date === date) || null;
  }

  getByTrip(tripId) {
    return this.getAll()
      .filter((d) => d.tripId === tripId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  deleteByTrip(tripId) {
    this.getByTrip(tripId).forEach((d) => this.delete(d.id));
  }
}

export const dayPlanRepository = new DayPlanRepository();
