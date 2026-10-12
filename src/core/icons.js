/**
 * 共用 SVG 線條圖示（跟底部導覽列 navBar.js 同一套視覺語言：
 * viewBox 0 0 24 24、無填色、線條顏色跟隨文字色 currentColor）。
 * 目前給「行程」分類跟「清單」分類用，取代原本的 emoji。
 */
const PATHS = {
  attraction: '<path d="M3 20l5-9 4 5 3-4 6 8H3z"/><circle cx="8" cy="7" r="2"/>',
  restaurant:
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  shopping:
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  transport:
    '<rect x="4" y="3" width="16" height="13" rx="3"/><path d="M4 10h16"/><path d="M9 21l-2-3M15 21l2-3"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>',
  other: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  packing:
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5-9 9"/>',
  wishlist: '<path d="M4 3h13a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4"/><path d="M4 3v18"/><path d="M9 8h6M9 12h6M9 16h4"/>',
};

export function svgIcon(name) {
  const path = PATHS[name];
  if (!path) return "";
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
