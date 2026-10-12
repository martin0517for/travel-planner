/**
 * 底部導覽列有兩種模式：
 * - global：還沒進入特定旅程時（我的旅程列表／設定）
 * - trip：已經選定一趟旅程後，整趟旅程的操作都收在這裡
 *         （總覽＝航班＋住宿、行程＝每日 Timeline、地圖、清單＝行李／待買等，
 *          最後加一個「設定」分頁，連到全域設定頁，這樣在旅程裡也不用先跳回旅程列表才能改設定）
 */
const ICONS = {
  trips: '<path d="M3 12l9-9 9 9M5 10v10h14V10"/>',
  overview: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  map: '<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  lists: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.2-1.6l2-1.5-2-3.5-2.4.7A7 7 0 0014 4.6L13.6 2h-3.2L10 4.6a7 7 0 00-2.4 1.4l-2.4-.7-2 3.5 2 1.5A7 7 0 005 12c0 .5 0 1 .2 1.6l-2 1.5 2 3.5 2.4-.7c.7.6 1.5 1 2.4 1.4l.4 2.6h3.2l.4-2.6c.9-.4 1.7-.8 2.4-1.4l2.4.7 2-3.5-2-1.5c.1-.5.2-1 .2-1.6z"/>',
};

function svg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

const GLOBAL_ITEMS = [
  { path: "/trips", label: "我的旅程", icon: "trips" },
  { path: "/settings", label: "設定", icon: "settings" },
];

function tripItems(tripId) {
  return [
    { path: `/trips/${tripId}`, label: "總覽", icon: "overview" },
    { path: `/trips/${tripId}/schedule`, label: "行程", icon: "schedule" },
    { path: `/trips/${tripId}/map`, label: "地圖", icon: "map" },
    { path: `/trips/${tripId}/lists`, label: "清單", icon: "lists" },
    { path: "/settings", label: "設定", icon: "settings" },
  ];
}

/**
 * activePath：目前要 highlight 的路徑。
 * options.tripId：有傳代表進入「旅程模式」，導覽列會換成該趟旅程的總覽／行程／地圖。
 */
export function renderNavBar(activePath, { tripId } = {}) {
  const items = tripId ? tripItems(tripId) : GLOBAL_ITEMS;

  const nav = document.createElement("nav");
  nav.className = "navbar";
  nav.innerHTML = items
    .map(
      (item) => `
    <button class="navbar__item ${activePath === item.path ? "is-active" : ""}" data-path="${item.path}">
      <span class="navbar__icon-wrap">${svg(item.icon)}</span>
      <span>${item.label}</span>
    </button>
  `
    )
    .join("");

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".navbar__item");
    if (!btn) return;
    window.location.hash = btn.dataset.path;
  });

  return nav;
}
