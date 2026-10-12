/**
 * Place（地點）資料模型 —— 整個 App 的核心共用資料。
 * 所有飯店、景點、餐廳、車站、機場皆引用同一份 Place，
 * 由 Place Library 管理，供行程、地圖、住宿、航班共用。
 *
 * id             string
 * name           string
 * category       "hotel" | "attraction" | "restaurant" | "shopping" | "transport" | "airport"
 *                （固定分類，決定地圖上的圖示顏色）
 * tags           string[]  使用者自行輸入的自訂分類（例如「東京」「必訪」），
 *                          跟 category 分開，用來之後在地點資料庫做篩選
 * address        string
 * lat, lng       number | null
 * googleMapsUrl  string
 * website        string
 * notes          string   （若內含網址會自動轉成可點擊連結）
 */
export function createPlaceDraft() {
  return {
    name: "",
    category: "attraction",
    tags: [],
    address: "",
    lat: null,
    lng: null,
    googleMapsUrl: "",
    website: "",
    notes: "",
  };
}

export const PLACE_CATEGORIES = [
  { value: "hotel", label: "住宿", color: "#9f6b53" },
  { value: "attraction", label: "景點", color: "#448361" },
  { value: "restaurant", label: "餐廳", color: "#d9730d" },
  { value: "shopping", label: "購物", color: "#c4487a" },
  { value: "transport", label: "交通", color: "#787774" },
  { value: "airport", label: "機場", color: "#2f2f2f" },
];
