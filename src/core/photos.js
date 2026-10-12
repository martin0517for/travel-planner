/**
 * photos.js — 照片的壓縮與本機容量計算（簡單版：照片轉成 JPEG 文字存進 localStorage）。
 *
 * 為什麼要壓縮：localStorage 整個 App 只有大約 5MB（iPhone Safari 更緊），
 * 手機原圖一張就 2～5MB，不壓縮存一張就滿了。
 * 這裡把長邊縮到 PHOTO_MAX_SIDE 像素、轉成品質 PHOTO_QUALITY 的 JPEG，
 * 一張大約 50～90KB，手機上看起來仍然清楚。
 *
 * 為什麼要「容量預算」：localStorage 滿了之後，不只照片存不進去，
 * 連新增旅程、行程都會失敗。所以照片最多只能用到 STORAGE_BUDGET_CHARS，
 * 剩下的空間保留給其他資料。
 *
 * 之後如果需要存大量照片或原始畫質，要改用 IndexedDB（容量大很多），
 * 只需要換掉這裡跟 ChecklistItem.photos 的存放方式。
 */

export const PHOTO_MAX_COUNT = 6; // 每個項目最多幾張
export const PHOTO_MAX_SIDE = 800; // 壓縮後長邊最多幾像素
export const PHOTO_QUALITY = 0.6; // JPEG 品質（0～1）

// localStorage 總字元數上限的保守估計（iPhone Safari 約 250 萬字元），
// 照片加上其他資料最多用到 200 萬字元，保留約 50 萬字元給旅程、行程等資料。
export const STORAGE_BUDGET_CHARS = 2_000_000;

/**
 * 把使用者選的圖片檔壓縮成 JPEG 的 data URL（"data:image/jpeg;base64,..." 文字）。
 * iPhone 選照片時，Safari 會自動把 HEIC 轉成 JPEG 交給我們，不用另外處理。
 */
export async function compressImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // 透明背景的 PNG 轉 JPEG 時，避免透明處變黑
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法讀取這張圖片"));
    };
    img.src = url;
  });
}

/** 目前 localStorage 一共用了多少字元（所有 key + value 加總） */
export function storageUsedChars() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      total += key.length + (localStorage.getItem(key) || "").length;
    }
  } catch {
    /* 讀不到就當作 0，不擋使用者 */
  }
  return total;
}

/** 一組照片（data URL 陣列）總共多少字元 */
export function photosChars(photos) {
  return (photos || []).reduce((sum, p) => sum + p.length, 0);
}

/** 用了預算的百分之幾（0～100），給表單顯示用 */
export function storagePercent(extraChars = 0) {
  return Math.min(100, Math.round(((storageUsedChars() + extraChars) / STORAGE_BUDGET_CHARS) * 100));
}
