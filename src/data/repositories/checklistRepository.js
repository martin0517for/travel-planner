import { BaseRepository } from "./BaseRepository.js";

/**
 * ChecklistItem（行李清單／記事本／必買清單項目）的 Repository
 * （存 localStorage key "tp_checklist_items"）。
 * 三種清單共用同一份資料表，用 listType 欄位區分是哪一種清單。
 */
class ChecklistRepository extends BaseRepository {
  constructor() {
    super("tp_checklist_items", "checklist");
  }

  /** 取某趟旅程、某一種清單（例如只要 packing）的項目 */
  getByTripAndType(tripId, listType) {
    return this.getAll()
      .filter((item) => item.tripId === tripId && item.listType === listType)
      .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  }

  /** 取某趟旅程「所有種類」的清單項目（分享旅程功能會用到） */
  getByTrip(tripId) {
    return this.getAll().filter((item) => item.tripId === tripId);
  }

  deleteByTrip(tripId) {
    this.getAll()
      .filter((item) => item.tripId === tripId)
      .forEach((item) => this.delete(item.id));
  }
}

export const checklistRepository = new ChecklistRepository();
