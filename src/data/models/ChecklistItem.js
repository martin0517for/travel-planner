/**
 * ChecklistItem（清單項目）資料模型
 *
 * id        string
 * tripId    string
 * listType  "packing" | "wishlist" | "shopping"
 * text      string   項目內容
 * isDone    boolean  是否已勾選完成
 * placeId   string | null  關聯地點（僅記事本／必買清單使用，行李清單不需要）
 * notes     string         備註（若內含網址會自動轉成可點擊連結）
 */
export function createChecklistItemDraft(tripId, listType) {
  return {
    tripId,
    listType,
    text: "",
    isDone: false,
    placeId: null,
    notes: "",
  };
}

/** 記事本／必買清單才需要「地點」欄位；行李清單不需要地點，但備註三種清單都支援 */
export function listHasPlaceField(listType) {
  return listType === "wishlist" || listType === "shopping";
}

import { svgIcon } from "../../core/icons.js";

export const CHECKLIST_TYPES = [
  { value: "packing", label: "行李清單", icon: svgIcon("packing"), placeholder: "例如：護照、轉接頭、常備藥品" },
  { value: "wishlist", label: "記事本", icon: svgIcon("wishlist"), placeholder: "例如：想去的展覽、想吃的餐廳" },
  { value: "shopping", label: "必買清單", icon: svgIcon("shopping"), placeholder: "例如：伴手禮、限定商品" },
];
