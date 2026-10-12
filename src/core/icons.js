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
};

export function icon(name) {
  const path = PATHS[name];
  if (!path) return raw("");
  return raw(
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`
  );
}
