import { flightRepository } from "../data/repositories/flightRepository.js";
import { placeRepository } from "../data/repositories/placeRepository.js";

/**
 * FlightService — View 只會呼叫這裡，不會直接碰 flightRepository。
 * 主要多做兩件 Repository 沒做的事：
 *   1. listByTrip：把航班資料裡存的 placeId 換成完整的 Place 物件（"join"），
 *      畫面才能直接顯示地點名稱，不用自己再查一次。
 *   2. createFlight / updateFlight：存檔前先 validate()，檢查沒過就不寫入。
 */
export const flightService = {
  /** 取某趟旅程的所有航班，並把 departurePlaceId/arrivalPlaceId 換成完整地點物件 */
  listByTrip(tripId) {
    return flightRepository.getByTrip(tripId).map((flight) => ({
      ...flight,
      departurePlace: flight.departurePlaceId ? placeRepository.getById(flight.departurePlaceId) : null,
      arrivalPlace: flight.arrivalPlaceId ? placeRepository.getById(flight.arrivalPlaceId) : null,
    }));
  },

  getFlight(id) {
    return flightRepository.getById(id);
  },

  createFlight(input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const flight = flightRepository.create(input);
    return { ok: true, flight };
  },

  updateFlight(id, input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const flight = flightRepository.update(id, input);
    return { ok: true, flight };
  },

  deleteFlight(id) {
    return flightRepository.delete(id);
  },

  /** 回傳錯誤訊息陣列；空陣列代表驗證通過 */
  validate(input) {
    const errors = [];
    if (!input.airline || !input.airline.trim()) errors.push("請輸入航空公司");
    if (!input.flightNo || !input.flightNo.trim()) errors.push("請輸入航班編號");
    if (!input.departureTime) errors.push("請選擇出發時間");
    if (!input.arrivalTime) errors.push("請選擇抵達時間");
    return errors;
  },
};
