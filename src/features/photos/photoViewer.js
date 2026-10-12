/**
 * 照片全螢幕檢視：點縮圖會開這個。
 * 左右滑動或按 ‹ › 切換，點背景或 × 關閉。
 * 這是共用元件，之後行程、住宿等其他地方加照片時也可以直接用。
 */
export function openPhotoViewer(photos, startIndex = 0) {
  if (!photos || !photos.length) return;
  let index = startIndex;

  const overlay = document.createElement("div");
  overlay.className = "photo-viewer";
  overlay.innerHTML = `
    <button type="button" class="photo-viewer__close" aria-label="關閉">&times;</button>
    <img class="photo-viewer__img" alt="" />
    ${
      photos.length > 1
        ? `<button type="button" class="photo-viewer__nav photo-viewer__nav--prev" aria-label="上一張">‹</button>
           <button type="button" class="photo-viewer__nav photo-viewer__nav--next" aria-label="下一張">›</button>
           <div class="photo-viewer__count"></div>`
        : ""
    }
  `;
  document.body.appendChild(overlay);

  const img = overlay.querySelector(".photo-viewer__img");
  const count = overlay.querySelector(".photo-viewer__count");

  function show() {
    img.src = photos[index];
    if (count) count.textContent = `${index + 1} / ${photos.length}`;
  }
  function go(step) {
    index = (index + step + photos.length) % photos.length;
    show();
  }
  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) {
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".photo-viewer__close").addEventListener("click", close);
  overlay.querySelector(".photo-viewer__nav--prev")?.addEventListener("click", () => go(-1));
  overlay.querySelector(".photo-viewer__nav--next")?.addEventListener("click", () => go(1));
  document.addEventListener("keydown", onKey);

  // 手機左右滑動切換
  let touchX = null;
  overlay.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  overlay.addEventListener("touchend", (e) => {
    if (touchX === null || photos.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchX = null;
  });

  show();
}

/** 唯讀縮圖列的 HTML（預覽畫面用）。點擊事件由 bindPhotoThumbs 綁定。 */
export function photoThumbsHtml(photos) {
  return `
    <div class="photo-row">
      ${photos
        .map(
          (src, i) => `
        <button type="button" class="photo-thumb" data-photo-index="${i}" aria-label="查看第 ${i + 1} 張照片">
          <img src="${src}" alt="" />
        </button>`
        )
        .join("")}
    </div>
  `;
}

/** 讓 container 裡的縮圖點了可以全螢幕查看 */
export function bindPhotoThumbs(container, photos) {
  container.querySelectorAll("[data-photo-index]").forEach((btn) => {
    btn.addEventListener("click", () => openPhotoViewer(photos, Number(btn.dataset.photoIndex)));
  });
}
