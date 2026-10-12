/**
 * PlaceService — 地點資料庫的邏輯層。listPlaces 同時支援依固定類別（category）、
 * 自訂分類（tag）、關鍵字（name/address/tags 都會比對）三種方式篩選，
 * 三個條件可以同時套用（AND 邏輯）。
 */
import { placeRepository } from "../data/repositories/placeRepository.js";

export const placeService = {
  listPlaces({ category = null, tag = null, query = "" } = {}) {
    let items = placeRepository.getAll();
    if (category) items = items.filter((p) => p.category === category);
    if (tag) items = items.filter((p) => (p.tags || []).includes(tag));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.address || "").toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  },

  /** 取得目前所有地點用過的自訂分類（去重、排序），給篩選 chip 與新增地點時的建議清單用 */
  listAllTags() {
    const set = new Set();
    placeRepository.getAll().forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b, "zh-Hant"));
  },

  getPlace(id) {
    return placeRepository.getById(id);
  },

  createPlace(input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const place = placeRepository.create(input);
    return { ok: true, place };
  },

  updatePlace(id, input) {
    const errors = this.validate(input);
    if (errors.length) return { ok: false, errors };
    const place = placeRepository.update(id, input);
    return { ok: true, place };
  },

  deletePlace(id) {
    return placeRepository.delete(id);
  },

  validate(input) {
    const errors = [];
    if (!input.name || !input.name.trim()) errors.push("請輸入地點名稱");
    if (!input.category) errors.push("請選擇地點類別");
    if (input.lat !== null && input.lat !== undefined && (isNaN(input.lat) || input.lat < -90 || input.lat > 90)) {
      errors.push("緯度需介於 -90 到 90 之間");
    }
    if (input.lng !== null && input.lng !== undefined && (isNaN(input.lng) || input.lng < -180 || input.lng > 180)) {
      errors.push("經度需介於 -180 到 180 之間");
    }
    return errors;
  },
};
