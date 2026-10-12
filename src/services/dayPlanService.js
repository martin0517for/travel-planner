/**
 * DayPlanService — 每日行程的所有邏輯：
 *   - 依 Trip 起訖日產生每一天的清單
 *   - 新增/編輯/刪除行程項目（實際存在 DayPlan.items 陣列裡）
 *   - moveItem：手動排序，其實就是把陣列裡兩個項目的位置互換
 *   - getAccommodationForDate：查某一天是不是落在某筆住宿的入住～退房
 *     區間內，用來在 Timeline 上顯示住宿色帶
 */
import { dayPlanRepository } from "../data/repositories/dayPlanRepository.js";
import { placeRepository } from "../data/repositories/placeRepository.js";
import { accommodationRepository } from "../data/repositories/accommodationRepository.js";
import { generateId } from "../core/db/localStorageAdapter.js";
import { buildDateRange } from "../data/models/DayPlan.js";

export const dayPlanService = {
  /** 依 Trip 的起訖日，回傳每一天的資料（含當天已存的 DayPlan，若無則為空陣列） */
  listDaysForTrip(trip) {
    const dates = buildDateRange(trip.startDate, trip.endDate);
    return dates.map((date) => {
      const existing = dayPlanRepository.getByTripAndDate(trip.id, date);
      return {
        date,
        items: (existing?.items || []).map(attachPlace),
      };
    });
  },

  getItems(tripId, date) {
    const dayPlan = dayPlanRepository.getByTripAndDate(tripId, date);
    return (dayPlan?.items || []).map(attachPlace);
  },

  addItem(tripId, date, input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };

    let dayPlan = dayPlanRepository.getByTripAndDate(tripId, date);
    const item = { id: generateId("item"), ...input };

    if (dayPlan) {
      const items = [...dayPlan.items, item];
      dayPlanRepository.update(dayPlan.id, { items });
    } else {
      dayPlanRepository.create({ tripId, date, items: [item] });
    }
    return { ok: true, item };
  },

  updateItem(tripId, date, itemId, input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };

    const dayPlan = dayPlanRepository.getByTripAndDate(tripId, date);
    if (!dayPlan) return { ok: false, errors: ["找不到這一天的行程"] };

    const items = dayPlan.items.map((it) => (it.id === itemId ? { ...it, ...input } : it));
    dayPlanRepository.update(dayPlan.id, { items });
    return { ok: true };
  },

  deleteItem(tripId, date, itemId) {
    const dayPlan = dayPlanRepository.getByTripAndDate(tripId, date);
    if (!dayPlan) return false;
    const items = dayPlan.items.filter((it) => it.id !== itemId);
    dayPlanRepository.update(dayPlan.id, { items });
    return true;
  },

  /** 把某個項目往前或往後移一位（手動排序） */
  moveItem(tripId, date, itemId, direction) {
    const dayPlan = dayPlanRepository.getByTripAndDate(tripId, date);
    if (!dayPlan) return false;
    const items = [...dayPlan.items];
    const index = items.findIndex((it) => it.id === itemId);
    if (index === -1) return false;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return false;
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
    dayPlanRepository.update(dayPlan.id, { items });
    return true;
  },

  /** 查詢某一天入住中的住宿（用於顯示住宿色帶） */
  getAccommodationForDate(tripId, date) {
    const accoms = accommodationRepository.getByTrip(tripId);
    const match = accoms.find((a) => a.checkIn && a.checkOut && date >= a.checkIn && date < a.checkOut);
    if (!match) return null;
    return { ...match, place: match.placeId ? placeRepository.getById(match.placeId) : null };
  },

  validate(input) {
    const errors = [];
    if (!input.placeId) errors.push("請選擇地點");
    if (!input.category) errors.push("請選擇類別");
    return errors;
  },
};

function attachPlace(item) {
  return { ...item, place: item.placeId ? placeRepository.getById(item.placeId) : null };
}
