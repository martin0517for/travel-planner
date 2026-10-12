/**
 * DayPlan（單日行程）資料模型 —— 一個 tripId + date 對應一筆
 *
 * id        string
 * tripId    string
 * date      string   YYYY-MM-DD
 * items     ItineraryItem[]
 *
 * ItineraryItem（行程項目，內嵌在 DayPlan.items 裡，非獨立集合）
 * id        string
 * placeId   string | null   引用 Place Library
 * time      string          HH:mm，可留空
 * category  "attraction" | "restaurant" | "shopping" | "transport" | "other"
 * notes     string
 */
import { svgIcon } from "../../core/icons.js";

export const ITEM_CATEGORIES = [
  { value: "attraction", label: "景點", icon: svgIcon("attraction"), color: "#448361", colorDark: "#7fb797" },
  { value: "restaurant", label: "餐廳", icon: svgIcon("restaurant"), color: "#d9730d", colorDark: "#e2a35c" },
  { value: "shopping", label: "購物", icon: svgIcon("shopping"), color: "#c4487a", colorDark: "#e0709b" },
  { value: "transport", label: "交通", icon: svgIcon("transport"), color: "#787774", colorDark: "#b9b8b5" },
  { value: "other", label: "其他", icon: svgIcon("other"), color: "#37352f", colorDark: "#e9e9e7" },
];

export function createItemDraft() {
  return {
    placeId: null,
    time: "",
    category: "attraction",
    notes: "",
  };
}

/** 依 Trip 的起訖日產生每日日期清單（YYYY-MM-DD 字串陣列） */
export function buildDateRange(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const dates = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
