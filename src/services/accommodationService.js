import { accommodationRepository } from "../data/repositories/accommodationRepository.js";
import { placeRepository } from "../data/repositories/placeRepository.js";

/**
 * AccommodationService — 跟 flightService.js 是同一個模式：
 * listByTrip 把 placeId 換成完整地點物件，create/update 前先驗證。
 */
export const accommodationService = {
  listByTrip(tripId) {
    return accommodationRepository.getByTrip(tripId).map((accom) => ({
      ...accom,
      place: accom.placeId ? placeRepository.getById(accom.placeId) : null,
    }));
  },

  getAccommodation(id) {
    return accommodationRepository.getById(id);
  },

  createAccommodation(input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const accom = accommodationRepository.create(input);
    return { ok: true, accommodation: accom };
  },

  updateAccommodation(id, input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const accom = accommodationRepository.update(id, input);
    return { ok: true, accommodation: accom };
  },

  deleteAccommodation(id) {
    return accommodationRepository.delete(id);
  },

  validate(input) {
    const errors = [];
    if (!input.placeId) errors.push("請選擇住宿地點");
    if (!input.checkIn) errors.push("請選擇入住日期");
    if (!input.checkOut) errors.push("請選擇退房日期");
    if (input.checkIn && input.checkOut && input.checkIn > input.checkOut) {
      errors.push("退房日期不能早於入住日期");
    }
    return errors;
  },
};
