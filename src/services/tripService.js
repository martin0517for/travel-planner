/**
 * TripService — 商業邏輯層。
 * View 永遠呼叫 Service，Service 才去呼叫 Repository。
 * 好處：驗證規則、排序規則、跨 Repository 的組合邏輯都集中在這裡，
 * View 只負責畫面，Repository 只負責存取。
 * deleteTrip 特別要注意：刪一趟旅程要「連帶」把它的航班/住宿/每日行程/
 * 清單項目都刪掉，不然會留下一堆孤兒資料（永遠找不到、也刪不掉）。
 */
import { tripRepository } from "../data/repositories/tripRepository.js";
import { flightRepository } from "../data/repositories/flightRepository.js";
import { accommodationRepository } from "../data/repositories/accommodationRepository.js";
import { dayPlanRepository } from "../data/repositories/dayPlanRepository.js";
import { checklistRepository } from "../data/repositories/checklistRepository.js";
import { daysUntil } from "../data/models/Trip.js";

export const tripService = {
  listTrips() {
    return tripRepository.getAllSortedByDate().map((trip) => ({
      ...trip,
      countdown: daysUntil(trip),
    }));
  },

  getTrip(id) {
    return tripRepository.getById(id);
  },

  createTrip(input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const trip = tripRepository.create(input);
    return { ok: true, trip };
  },

  updateTrip(id, input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const trip = tripRepository.update(id, input);
    return { ok: true, trip };
  },

  deleteTrip(id) {
    flightRepository.deleteByTrip(id);
    accommodationRepository.deleteByTrip(id);
    dayPlanRepository.deleteByTrip(id);
    checklistRepository.deleteByTrip(id);
    return tripRepository.delete(id);
  },

  validate(input) {
    const errors = [];
    if (!input.name || !input.name.trim()) errors.push("請輸入旅程名稱");
    if (!input.destination || !input.destination.trim()) errors.push("請輸入目的地");
    if (!input.startDate) errors.push("請選擇出發日期");
    if (!input.endDate) errors.push("請選擇結束日期");
    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      errors.push("結束日期不能早於出發日期");
    }
    return errors;
  },
};
