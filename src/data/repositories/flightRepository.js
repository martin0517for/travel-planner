import { BaseRepository } from "./BaseRepository.js";

/**
 * Flight 的 Repository（存 localStorage key "tp_flights"）。
 * 每筆航班用 tripId 欄位指回它屬於哪一趟旅程（不是 Trip 裡存航班陣列，
 * 是反過來查——這樣刪航班、查詢都只要動這一份資料）。
 */
class FlightRepository extends BaseRepository {
  constructor() {
    super("tp_flights", "flight");
  }

  /** 取某趟旅程的所有航班，依出發時間排序 */
  getByTrip(tripId) {
    return this.getAll()
      .filter((f) => f.tripId === tripId)
      .sort((a, b) => (a.departureTime || "").localeCompare(b.departureTime || ""));
  }

  /** 刪旅程時要呼叫這個，不然航班資料會變成沒人指向的孤兒資料 */
  deleteByTrip(tripId) {
    this.getByTrip(tripId).forEach((f) => this.delete(f.id));
  }
}

export const flightRepository = new FlightRepository();
