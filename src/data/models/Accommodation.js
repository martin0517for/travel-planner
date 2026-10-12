/**
 * Accommodation（住宿）資料模型
 *
 * id              string
 * tripId          string   關聯的旅程
 * placeId         string   引用 Place Library 中的地點（通常 category = "hotel"）
 * checkIn         string   YYYY-MM-DD
 * checkOut        string   YYYY-MM-DD
 * confirmationNo  string   訂房確認碼
 * notes           string
 */
export function createAccommodationDraft(tripId) {
  return {
    tripId,
    placeId: null,
    checkIn: "",
    checkOut: "",
    confirmationNo: "",
    notes: "",
  };
}
