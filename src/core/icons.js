/**
 * icons.js — 全 App 共用的 SVG 線條圖示（不用 emoji）。
 * 規格：viewBox 0 0 24 24、無填色、線條顏色跟隨文字色（currentColor）、粗細 1.7。
 * 這些是程式寫死的內容，所以用 raw() 標記為安全。
 */
import { raw } from "./html.js";

const PATHS = {
  // 導覽
  back: '<path d="M15 5l-7 7 7 7"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.2-1.6l2-1.5-2-3.5-2.4.7A7 7 0 0014 4.6L13.6 2h-3.2L10 4.6a7 7 0 00-2.4 1.4l-2.4-.7-2 3.5 2 1.5A7 7 0 005 12c0 .5 0 1 .2 1.6l-2 1.5 2 3.5 2.4-.7c.7.6 1.5 1 2.4 1.4l.4 2.6h3.2l.4-2.6c.9-.4 1.7-.8 2.4-1.4l2.4.7 2-3.5-2-1.5c.1-.5.2-1 .2-1.6z"/>',
  overview: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  map: '<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  lists: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  plane: '<path d="M3 13l18-8-6 16-3-7-9-1z"/>',
  // 地點資料庫
  places: '<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><path d="M9.5 10h5M12 7.5v5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  navigate: '<path d="M3 11l18-8-8 18-2-8-8-2z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  // 地點分類
  attraction: '<path d="M3 20l5-9 4 5 3-4 6 8H3z"/><circle cx="8" cy="7" r="2"/>',
  restaurant: '<path d="M5 3v7a2 2 0 002 2h1a2 2 0 002-2V3M7.5 3v18"/><path d="M19 15V3a4 4 0 00-4 4v6a2 2 0 002 2h2zm0 0v6"/>',
  gift: '<rect x="3.5" y="9" width="17" height="11" rx="1"/><path d="M2.5 9h19M12 9v11M12 9c-1.5-3.5-5.5-4.5-5.5-2 0 1.5 2.5 2 5.5 2zM12 9c1.5-3.5 5.5-4.5 5.5-2 0 1.5-2.5 2-5.5 2z"/>',
  shopping: '<path d="M6 3L4 7v13a1 1 0 001 1h14a1 1 0 001-1V7l-2-4z"/><path d="M4 7h16M16 11a4 4 0 01-8 0"/>',
  hotel: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 00-3-3h-7v6"/><circle cx="7" cy="11.5" r="2"/>',
  transport: '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M9 21l-2-3M15 21l2-3"/><circle cx="9" cy="13" r=".8"/><circle cx="15" cy="13" r=".8"/>',
  // 活動（9.5，2026-11-01 使用者選票券）
  ticket: '<path d="M4 7a1 1 0 011-1h14a1 1 0 011 1v3a2 2 0 000 4v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3a2 2 0 000-4z"/><path d="M14 6v2M14 11v2M14 16v2"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  remove: '<path d="M6 6l12 12M18 6L6 18"/>',
  // 行程的純文字項目（⑤，2026-11-01）：移動、休息、其他（用餐用 restaurant）
  move: '<path d="M4 12h14M13 6l6 6-6 6"/>',
  rest: '<path d="M5 9h11v4a5 5 0 01-5 5h-1a5 5 0 01-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 010 5H16M8 3.5v2.5M12 3.5v2.5"/>',
  dot: '<circle cx="12" cy="12" r="3.5"/>',
  warning: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  airport: '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
};

export function icon(name) {
  const path = PATHS[name];
  if (!path) return raw("");
  return raw(
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
  );
}
