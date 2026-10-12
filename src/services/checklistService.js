import { checklistRepository } from "../data/repositories/checklistRepository.js";
import { placeRepository } from "../data/repositories/placeRepository.js";

/**
 * ChecklistService — 行李清單／記事本／必買清單共用同一個 service，
 * 用 listType 參數（"packing" / "wishlist" / "shopping"）區分是哪一種。
 */
export const checklistService = {
  /** 取某趟旅程、某一種清單的項目，並把 placeId 換成完整地點物件 */
  listItems(tripId, listType) {
    return checklistRepository.getByTripAndType(tripId, listType).map((item) => ({
      ...item,
      place: item.placeId ? placeRepository.getById(item.placeId) : null,
    }));
  },

  getItem(id) {
    return checklistRepository.getById(id);
  },

  addItem(tripId, listType, input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const item = checklistRepository.create({
      tripId,
      listType,
      text: input.text.trim(),
      isDone: false,
      placeId: input.placeId ?? null,
      notes: (input.notes || "").trim(),
    });
    return { ok: true, item };
  },

  updateItem(id, input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const item = checklistRepository.update(id, {
      text: input.text.trim(),
      placeId: input.placeId ?? null,
      notes: (input.notes || "").trim(),
    });
    return { ok: true, item };
  },

  /** 打勾／取消打勾，切換 isDone 的布林值 */
  toggleDone(id) {
    const item = checklistRepository.getById(id);
    if (!item) return null;
    return checklistRepository.update(id, { isDone: !item.isDone });
  },

  deleteItem(id) {
    return checklistRepository.delete(id);
  },

  validate(input) {
    const errors = [];
    if (!input.text || !input.text.trim()) errors.push("請輸入項目名稱");
    return errors;
  },
};
