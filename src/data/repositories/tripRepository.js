import { BaseRepository } from "./BaseRepository.js";

/**
 * Trip 的 Repository。基本的新增/讀取/修改/刪除都繼承自 BaseRepository，
 * 這裡只加 Trip 專屬的查詢方法（依日期排序）。
 * 存在 localStorage 的 key 是 "tp_trips"（一個 JSON 陣列，每個元素是一趟旅程）。
 */
class TripRepository extends BaseRepository {
  constructor() {
    super("tp_trips", "trip"); // "trip" 是新資料 id 的前綴，例如 trip_abc123
  }

  /** 依出發日期排序（給「我的旅程」列表用，最早出發的排前面） */
  getAllSortedByDate() {
    return this.getAll().sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
  }
}

export const tripRepository = new TripRepository();
