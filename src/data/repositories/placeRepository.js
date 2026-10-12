import { BaseRepository } from "./BaseRepository.js";

/**
 * Place（地點資料庫）的 Repository（存 localStorage key "tp_places"）。
 * 這份資料是全域共用的，不屬於任何一趟旅程——航班的機場、住宿的飯店、
 * 行程項目的景點，全部指到同一份 Place 資料，避免同一個地方要重複輸入好幾次。
 */
class PlaceRepository extends BaseRepository {
  constructor() {
    super("tp_places", "place");
  }

  getByCategory(category) {
    return this.getAll().filter((place) => place.category === category);
  }
}

export const placeRepository = new PlaceRepository();
