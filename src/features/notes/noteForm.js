/**
 * noteForm.js — 新增／編輯筆記（整頁表單，清單頁籤「筆記」，v0.9.0）。
 *
 * openNoteForm({ tripId, note, onSaved })
 *   note 為 null → 新增；有值 → 編輯
 *
 * 欄位（2026-11-01 使用者決定）：類型（筆記／美食／行程／想買／紀念品／其他，預設筆記；v0.10.3 加上美食）、標題（必填 60 字）、
 * 參考連結（一個，只接受 http/https）、內容（3000 字，網址在預覽裡會變成連結）。
 * v0.10.2：選「其他」時出現「自訂類型」（10 字，可不填），下方列出用過的自訂類型，點一下帶入。
 * v0.11.0：貼上連結（pasteLink.js）讀完後打開這裡：
 *   prefill  { kind, title, url, body } 新增時預先帶入
 *   notice   { text, warn } 表單最上面的灰色提示框（「已從 Instagram @帳號 帶入…」「讀不到…」）
 *   新增時，參考連結是 IG／Threads 而且標題還空著 →「參考連結」下方出現「讀取內容」（剪貼簿讀不到時的備案）。
 */
import { html, raw, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { noteStore, NOTE_KINDS, LIMITS } from "../../data/notes.js";
import { readableSource, readLink, organizeNote, SOURCE_LABEL } from "../../core/linkReader.js";

// 所有文字欄位用同一組設定（同一種鍵盤，避免切換欄位時鍵盤高度不同而跳動）
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="done"';

export function openNoteForm({ tripId, note = null, prefill = null, notice = null, onSaved } = {}) {
  const isEdit = Boolean(note);
  const v = note || { kind: "note", customKind: "", title: "", url: "", body: "", ...(prefill || {}) };
  const used = noteStore.usedCustomKinds();

  openSheet({
    title: isEdit ? "編輯筆記" : "新增筆記",
    body: html`
      <form class="form" novalidate>
        <div class="form-notice ${notice && notice.warn ? "form-notice--warn" : ""}" data-notice role="status" ${notice ? "" : html`hidden`}>
          ${notice ? noticeContent(notice) : ""}
        </div>

        <div class="field">
          <div class="field__legend">類型</div>
          <div class="chips chips--wrap" role="radiogroup" aria-label="類型">
            ${NOTE_KINDS.map(
              (k) => html`
                <label class="chip chip--cat ${k.cat} chip--radio">
                  <input type="radio" name="kind" value="${k.value}" ${k.value === v.kind ? html`checked` : ""} />
                  ${icon(k.icon)}${k.label}
                </label>
              `
            )}
          </div>
        </div>

        <div class="field" data-custom ${v.kind === "other" ? "" : html`hidden`}>
          <label for="nt-custom">自訂類型</label>
          <input id="nt-custom" ${raw(TEXT_ATTRS)} name="noteCustom" maxlength="${LIMITS.customKind}"
                 placeholder="例如：藥妝、伴手禮（可不填）" value="${v.customKind || ""}" />
          ${used.length
            ? html`<div class="quick-picks">${used.map((k) => html`<button type="button" class="tag tag--btn" data-pick-kind="${k}">${k}</button>`)}</div>`
            : ""}
        </div>

        <div class="field">
          <label for="nt-title">標題</label>
          <input id="nt-title" ${raw(TEXT_ATTRS)} name="noteTitle" maxlength="${LIMITS.title}"
                 placeholder="例如：上野公園賞櫻攻略" value="${v.title}" />
        </div>

        <div class="field">
          <label for="nt-url">參考連結</label>
          <input id="nt-url" ${raw(TEXT_ATTRS)} name="noteUrl" maxlength="${LIMITS.url}"
                 placeholder="https://…" value="${v.url}" />
          <p class="field__hint field__hint--tight">貼上 IG、Threads、部落格或商品網址（可不填）</p>
          ${isEdit ? "" : html`<button type="button" class="btn btn--ghost btn--small read-btn" data-action="read" hidden>${icon("download")}讀取內容</button>`}
        </div>

        <div class="field">
          <label for="nt-body">內容</label>
          <textarea id="nt-body" name="noteBody" rows="8" maxlength="${LIMITS.body}"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    placeholder="例如：重點整理、要買的口味、價格">${v.body}</textarea>
          <p class="field__hint field__hint--tight" data-count></p>
        </div>

        <div class="form__errors" role="alert" hidden></div>

        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">取消</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "儲存" : "新增"}</button>
        </div>
      </form>
    `,
    onMount(panel, close) {
      const form = panel.querySelector("form");
      const errorsBox = panel.querySelector(".form__errors");
      const body = form.elements.noteBody;
      const count = panel.querySelector("[data-count]");
      const paintCount = () => (count.textContent = `${body.value.length} / ${LIMITS.body}`);
      body.addEventListener("input", paintCount);
      paintCount();

      // 選「其他」才顯示自訂類型
      const customBox = panel.querySelector("[data-custom]");
      form.querySelectorAll('input[name="kind"]').forEach((r) =>
        r.addEventListener("change", () => (customBox.hidden = form.querySelector('input[name="kind"]:checked').value !== "other"))
      );
      panel.querySelectorAll("[data-pick-kind]").forEach((btn) =>
        btn.addEventListener("click", () => (form.elements.noteCustom.value = btn.dataset.pickKind))
      );

      if (!isEdit) wireReadButton(panel, form, paintCount);

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const el = form.elements;
        const kindInput = form.querySelector('input[name="kind"]:checked');
        const kind = kindInput ? kindInput.value : "note";
        const input = { kind, customKind: kind === "other" ? el.noteCustom.value : "", title: el.noteTitle.value, url: el.noteUrl.value, body: body.value };
        const result = isEdit ? noteStore.update(note.id, input) : noteStore.create(tripId, input);
        if (!result.ok) {
          render(errorsBox, html`${result.errors.map((err) => html`<div>${err}</div>`)}`);
          errorsBox.hidden = false;
          return;
        }
        close();
        if (onSaved) onSaved(result.note);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);
    },
  });
}

/** 提示框內容：一般（打勾）、警告（三角形）、讀取中（轉圈） */
function noticeContent({ text, warn, busy }) {
  return html`${busy ? html`<span class="spin" aria-hidden="true"></span>` : icon(warn ? "warning" : "check")}<span>${text}</span>`;
}

function setNotice(panel, notice) {
  const box = panel.querySelector("[data-notice]");
  box.classList.toggle("form-notice--warn", Boolean(notice && notice.warn));
  box.hidden = !notice;
  render(box, notice ? noticeContent(notice) : html``);
}

/**
 * 「讀取內容」（C-1e）：參考連結是 IG／Threads、標題還空著時出現。
 * 讀到 → 帶入標題、內容（內容已經有字就不蓋掉），類型改成推薦。
 */
function wireReadButton(panel, form, paintCount) {
  const btn = panel.querySelector('[data-action="read"]');
  const el = form.elements;
  const update = () => (btn.hidden = !readableSource(el.noteUrl.value) || Boolean(el.noteTitle.value.trim()));
  el.noteUrl.addEventListener("input", update);
  el.noteTitle.addEventListener("input", update);
  update();

  btn.addEventListener("click", async () => {
    const url = el.noteUrl.value.trim();
    const source = readableSource(url);
    if (!source) return;
    btn.disabled = true;
    setNotice(panel, { busy: true, text: `正在讀取 ${SOURCE_LABEL[source]} 貼文…` });
    const result = await readLink(url);
    if (!panel.isConnected) return; // 讀取中已經關掉表單
    btn.disabled = false;
    if (!result.ok) {
      setNotice(panel, { warn: true, text: `讀不到這篇貼文的內容：${result.error}。請自己填標題，或稍後再按一次「讀取內容」。` });
      return;
    }
    const n = organizeNote(result);
    el.noteTitle.value = n.title;
    el.noteUrl.value = n.url;
    if (!el.noteBody.value.trim()) el.noteBody.value = n.body;
    const rec = form.querySelector('input[name="kind"][value="rec"]');
    if (rec) {
      rec.checked = true;
      rec.dispatchEvent(new Event("change"));
    }
    paintCount();
    update();
    setNotice(panel, { text: readNotice(result) });
  });
}

/** 讀到之後的提示文字（貼上連結頁面也用） */
export function readNotice(result) {
  const what = result.topic ? "標題（主題標籤）和內容" : "標題和內容"; // v0.11.3
  return `已從 ${SOURCE_LABEL[result.source]}${result.author ? ` @${result.author}` : ""} 帶入${what}，確認後按「新增」。`;
}
