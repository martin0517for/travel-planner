import { BaseRepository } from "./BaseRepository.js";

/**
 * Accommodation（住宿）的 Repository（存 localStorage key "tp_accommodations"）。
 * 跟 FlightRepository 是同一個模式：用 tripId 反查所屬旅程。
 */
class AccommodationRepository extends BaseRepository {
  constructor() {
    super("tp_accommodations", "accom");
  }

  /** 取某趟旅程的所有住宿，依入住日期排序 */
  getByTrip(tripId) {
    return this.getAll()
      .filter((a) => a.tripId === tripId)
      .sort((a, b) => (a.checkIn || "").localeCompare(b.checkIn || ""));
  }

  /** 刪旅程時連帶呼叫，避免留下孤兒資料 */
  deleteByTrip(tripId) {
    this.getByTrip(tripId).forEach((a) => this.delete(a.id));
  }
}

export const accommodationRepository = new AccommodationRepository();
