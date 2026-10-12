/**
 * Settings（App 設定）資料模型 —— 全域單一一份，不屬於任何旅程。
 *
 * theme     "light" | "dark" | "system"
 * language  目前只有 "zh-Hant"（繁體中文），先保留欄位方便未來擴充
 * currency  預設貨幣代碼，例如 "TWD"、"JPY"、"USD"
 */
export function defaultSettings() {
  return {
    theme: "system",
    language: "zh-Hant",
    currency: "TWD",
  };
}

export const CURRENCY_OPTIONS = [
  { value: "TWD", label: "TWD 新台幣" },
  { value: "JPY", label: "JPY 日圓" },
  { value: "USD", label: "USD 美元" },
  { value: "EUR", label: "EUR 歐元" },
  { value: "KRW", label: "KRW 韓元" },
  { value: "CNY", label: "CNY 人民幣" },
  { value: "HKD", label: "HKD 港幣" },
  { value: "THB", label: "THB 泰銖" },
  { value: "GBP", label: "GBP 英鎊" },
  { value: "AUD", label: "AUD 澳幣" },
];
