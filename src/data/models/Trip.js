/**
 * Trip（旅程）資料模型
 *
 * id            string
 * name          string   旅程名稱（自訂，如「東京賞櫻」）
 * destination   string   目的地
 * startDate     string   YYYY-MM-DD
 * endDate       string   YYYY-MM-DD
 * createdAt / updatedAt  ISO 字串，由 Repository 自動填入
 *
 * 關聯設計：Flight / Accommodation / DayPlan 各自帶一個 tripId 外鍵，
 * 反向查詢（而非在 Trip 上維護 id 陣列），避免兩邊資料互相脫節。
 */
export function createTripDraft() {
  return {
    name: "",
    destination: "",
    startDate: "",
    endDate: "",
  };
}

/** 距離出發的天數（負數＝已出發或已結束） */
export function daysUntil(trip) {
  if (!trip.startDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(trip.startDate);
  const diffMs = start - today;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
