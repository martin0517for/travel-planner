/**
 * noteForm.js — 新增／編輯筆記（整頁表單，清單頁籤「筆記」，v0.9.0）。
 *
 * openNoteForm({ tripId, note, onSaved })
 *   note 為 null → 新增；有值 → 編輯
 *
 * 欄位（2026-11-01 使用者決定）：類型（筆記／美食／行程／想買／紀念品／其他，預設筆記；v0.10.3 加上美食）、標題（必填 60 字）、
 * 參考連結（一個，只接受 http/https）、內容（3000 字，網址在預覽裡會變成連結）。
 * v0.10.2：選「其他」時出現「自訂類型」（10 字，可不填），下方列出用過的自訂類型，點一下帶入。
 */
import { html, raw, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { noteStore, NOTE_KINDS, LIMITS } from "../../data/notes.js";

// 所有文字欄位用同一組設定（同一種鍵盤，避免切換欄位時鍵盤高度不同而跳動）
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="done"';

export function openNoteForm({ tripId, note = null, onSaved } = {}) {
  const isEdit = Boolean(note);
  const v = note || { kind: "note", customKind: "", title: "", url: "", body: "" };
  const used = noteStore.usedCustomKinds();

  openSheet({
    title: isEdit ? "編輯筆記" : "新增筆記",
    body: html`
      <form class="form" novalidate>
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
