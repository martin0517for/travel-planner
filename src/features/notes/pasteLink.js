/**
 * pasteLink.js — 「貼上連結」整頁（v0.11.0，2026-11-02 使用者決定）。
 *
 * 入口：旅程裡四個頁籤的頂部列，地點資料庫圖示左邊的鏈條（features/shell/shell.js）。
 * 流程：
 *   1. 打開整頁（不自動 focus、不自動讀剪貼簿）。最上面灰框說明用法。
 *   2. 按「貼上」→ 讀剪貼簿，找出第一個 https 網址填進欄位；或自己貼進欄位按鍵盤的「搜尋」。
 *   3. 這趟已經有同一個連結 → 底部面板「這篇已經存過了」：打開那一篇｜仍然新增。
 *      讀取前先用貼上的網址檢查；Threads 分享短網址讀完才知道是哪一篇，讀到後用正式網址再檢查一次（v0.11.1）。
 *   4. IG／Threads → 灰框變成「正在讀取…」，按鈕停用，下方「取消讀取」。
 *      讀到 → 關掉這頁，打開新增筆記並帶入（類型推薦、標題、連結、內容），要按「新增」才存。
 *      讀不到 → 一樣打開新增筆記，只帶入連結，上方警告「讀不到…」。
 *      其他網站的網址 → 不讀，直接打開新增筆記並帶入連結（類型筆記）。
 *   5. 存好後跳到「清單 → 筆記」並打開剛存的那則預覽。
 *   「改成手動新增」→ 打開空白的新增筆記。
 *
 * 資安：剪貼簿只在使用者按「貼上」時讀；只取網址、只接受 https；讀回來的內容見 core/linkReader.js。
 */
import { html, raw, render, safeUrl } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { noteStore } from "../../data/notes.js";
import { firstHttpsUrl, readableSource, cleanLink, linkKey, readLink, organizeNote, SOURCE_LABEL } from "../../core/linkReader.js";
import { openNoteForm, readNotice } from "./noteForm.js";
import { showTripNote } from "../lists/tripLists.js";

// 同其他表單：同一種鍵盤；這裡按鍵盤的「搜尋」＝開始讀取
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="search"';

const INTRO = "在 IG 或 Threads 按「複製連結」，回到這裡按「貼上」，會自動讀取標題和內容，存成這趟的筆記（推薦）。";

export function openPasteLink({ trip }) {
  openSheet({
    title: "貼上連結",
    body: html`
      <form class="form" novalidate>
        <div class="form-notice" data-notice role="status">${icon("link")}<span>${INTRO}</span></div>
        <div class="field">
          <label for="pl-url">IG／Threads 連結</label>
          <div class="paste-row">
            <input id="pl-url" ${raw(TEXT_ATTRS)} name="pasteUrl" maxlength="500" placeholder="https://…" />
            <button type="button" class="btn btn--primary" data-action="paste">貼上</button>
          </div>
          <p class="field__hint field__hint--tight">也可以自己貼進欄位，再按鍵盤的「搜尋」</p>
        </div>
        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">取消</button>
          <button type="button" class="btn btn--ghost" data-action="manual">改成手動新增</button>
        </div>
      </form>
    `,
    onMount(panel, close) {
      const form = panel.querySelector("form");
      const input = form.elements.pasteUrl;
      const pasteBtn = panel.querySelector('[data-action="paste"]');
      const cancelBtn = panel.querySelector('[data-action="cancel"]');
      const manualBtn = panel.querySelector('[data-action="manual"]');
      const noticeBox = panel.querySelector("[data-notice]");
      let controller = null; // 讀取中才有

      const notice = (text, { warn = false, busy = false } = {}) => {
        noticeBox.classList.toggle("form-notice--warn", warn);
        render(noticeBox, html`${busy ? html`<span class="spin" aria-hidden="true"></span>` : icon(warn ? "warning" : "link")}<span>${text}</span>`);
      };
      const setBusy = (busy) => {
        input.disabled = busy;
        pasteBtn.disabled = busy;
        manualBtn.disabled = busy;
        cancelBtn.textContent = busy ? "取消讀取" : "取消";
      };
      const onSaved = (note) => showTripNote(trip.id, note.id);
      const openForm = (options) => {
        close();
        openNoteForm({ tripId: trip.id, onSaved, ...options });
      };

      async function start(raw) {
        if (controller) return;
        const url = firstHttpsUrl(raw) || String(raw || "").trim();
        if (!url) return notice("請先貼上連結。", { warn: true });
        if (!url.startsWith("https://") || !safeUrl(url)) return notice("請貼上 https:// 開頭的網址。", { warn: true });
        input.value = url;
        input.blur();

        // C-6：這趟已經有同一個連結 → 先問
        const dup = findDuplicate(url);
        if (dup) return askDuplicate(dup, () => read(url, { checked: true }));
        read(url);
      }

      /** 這趟筆記裡同一篇的連結（不分追蹤參數、www、reel／reels…，見 linkKey） */
      function findDuplicate(url) {
        const key = linkKey(url);
        return key ? noteStore.listByTrip(trip.id).find((n) => n.url && linkKey(n.url) === key) : null;
      }

      async function read(url, { checked = false } = {}) {
        const source = readableSource(url);
        // C-5：其他網站 → 不讀，直接帶入連結
        if (!source) return openForm({ prefill: { url } });

        const ctrl = new AbortController();
        controller = ctrl;
        setBusy(true);
        notice(`正在讀取 ${SOURCE_LABEL[source]} 貼文…讀到後會自動打開新增筆記（Threads 約 3～4 秒）`, { busy: true });
        const result = await readLink(url, ctrl.signal);
        if (!panel.isConnected || ctrl.signal.aborted) return; // 已經關掉或按了取消讀取
        controller = null;
        setBusy(false);

        if (result.ok) {
          const n = organizeNote(result);
          const show = () => openForm({ prefill: { kind: "rec", title: n.title, url: n.url, body: n.body }, notice: { text: readNotice(result) } });
          // Threads 的分享短網址（/share/…）讀完才知道是哪一篇 → 用讀回來的正式網址再檢查一次
          const dup = !checked && findDuplicate(n.url);
          if (dup) return askDuplicate(dup, show);
          show();
        } else {
          openForm({
            prefill: { kind: "rec", url: cleanLink(url) },
            notice: { warn: true, text: `讀不到這篇貼文的內容：${result.error}。請自己填標題，或稍後按「讀取內容」再試一次。` },
          });
        }
      }

      function askDuplicate(dup, proceed) {
        openSheet({
          title: "這篇已經存過了",
          body: html`
            <p class="field__hint">這趟的筆記裡已經有同一個連結：</p>
            <div class="detail-row">
              <div class="detail-row__value">${dup.title}</div>
            </div>
            <div class="form__actions form__actions--spaced">
              <button type="button" class="btn btn--ghost" data-action="again">仍然新增</button>
              <button type="button" class="btn btn--primary" data-action="open">打開那一篇</button>
            </div>
          `,
          onMount(sheet, closeSheet) {
            sheet.querySelector('[data-action="again"]').addEventListener("click", () => {
              closeSheet();
              proceed();
            });
            sheet.querySelector('[data-action="open"]').addEventListener("click", () => {
              closeSheet();
              close();
              showTripNote(trip.id, dup.id);
            });
          },
        });
      }

      pasteBtn.addEventListener("click", async () => {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          return notice("這個瀏覽器不能讀取剪貼簿，請自己貼進欄位，再按鍵盤的「搜尋」。", { warn: true });
        }
        let text = "";
        try {
          text = await navigator.clipboard.readText();
        } catch {
          return notice("沒有取得剪貼簿的內容，請自己貼進欄位，再按鍵盤的「搜尋」。", { warn: true });
        }
        const url = firstHttpsUrl(text);
        if (!url) return notice("剪貼簿裡沒有網址。請先在 IG 或 Threads 按「複製連結」。", { warn: true });
        start(url);
      });

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        start(input.value);
      });

      cancelBtn.addEventListener("click", () => {
        if (controller) {
          controller.abort();
          controller = null;
          setBusy(false);
          notice(INTRO);
          return;
        }
        close();
      });
      manualBtn.addEventListener("click", () => openForm({}));
    },
  });
}
