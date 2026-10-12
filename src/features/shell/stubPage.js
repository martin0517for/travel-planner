/**
 * 「即將推出」佔位畫面，還沒開始開發的分頁先顯示這個當預告。
 */
export function renderStubPage(container, { title, description }) {
  const el = document.createElement("div");
  el.className = "stub-page";
  el.innerHTML = `
    <span class="stub-page__badge">即將推出</span>
    <h2>${title}</h2>
    <p>${description}</p>
  `;
  container.appendChild(el);
}
