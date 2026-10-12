/**
 * 把純文字中的網址自動轉成可點擊的 <a> 連結，其餘文字照樣做 HTML escape，
 * 避免使用者輸入的文字被誤判成 HTML 標籤。
 */
const URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

export function linkifyHtml(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  return escaped.replace(URL_PATTERN, (match) => {
    const href = match.startsWith("http") ? match : `https://${match}`;
    return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
