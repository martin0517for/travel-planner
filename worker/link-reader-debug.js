// link-reader-debug.js — 除錯用轉接服務（Cloudflare Worker）。平常不部署。
//
// 用途：IG／Threads 改了規則、正式版（link-reader.js）讀不到時，臨時部署這份查原因，查完就刪掉。
// 來源：2026-11-02 可行性測試用的 link-test（測試版已於 2026-11-03 刪除），內容沒有改。
//
// 使用方式：
//   1. Cloudflare 建立一個新的 Worker（例如 tp-link-debug），貼上這份。
//   2. 把下面的 KEY 改成只有自己知道的密碼再部署（倉庫是公開的，這裡只放佔位字）。
//   3. 用 iPhone 打開：
//        /test?k=密碼            測試頁（貼上連結 → 顯示整理結果）
//        /api?k=密碼&url=網址     跟正式版類似的介面：回傳 { ok, source, author, text, url }
//        /?k=密碼&url=網址        除錯：三種讀法的原始結果（狀態碼、轉址後網址、og:title、og:description、嵌入版內文）
//   4. 查完後刪除這個 Worker。

const KEY = 'CHANGE-ME'; // 部署前改成自己的密碼（不要 commit 真的密碼）
const APP_ORIGIN = 'https://martin0517for.github.io'; // App 的網域（CORS）

const UA_BOT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const UA_BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export default {
  async fetch(request) {
    const u = new URL(request.url);
    if (KEY === 'CHANGE-ME' || u.searchParams.get('k') !== KEY) return json({ ok: false, error: '密碼不對（或還沒設定 KEY）' }, 403);
    if (u.pathname === '/test') return page();

    const parsed = parseTarget(u.searchParams.get('url'));
    if (!parsed) return json({ ok: false, error: '只接受 IG、Threads 的 https 網址' }, 400);

    if (u.pathname === '/api') return json(await readPost(parsed));
    return json(await debug(parsed));
  },
};

// ---- 網址檢查 ----
function parseTarget(raw) {
  let t;
  try { t = new URL(String(raw || '').trim()); } catch { return null; }
  const host = t.hostname.replace(/^www\./, '');
  if (t.protocol !== 'https:') return null;
  if (host === 'instagram.com') {
    const m = t.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})/);
    if (!m) return null;
    const type = m[1] === 'reels' ? 'reel' : m[1];
    return { source: 'instagram', url: `https://www.instagram.com/${type}/${m[2]}/`, embed: `https://www.instagram.com/${type}/${m[2]}/embed/captioned/` };
  }
  if (host === 'threads.net' || host === 'threads.com') {
    return { source: 'threads', url: `https://www.${host}${t.pathname}` };
  }
  return null;
}

// ---- 讀取：先用最穩的方式，失敗再換 ----
async function readPost(p) {
  if (p.source === 'instagram') {
    const e = await get(p.embed, UA_BROWSER);
    if (e.html) {
      const author = pick(e.html, /class="UsernameText"[^>]*>([\s\S]*?)</i);
      let text = text_(pick(e.html, /class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments/i));
      if (author && text.startsWith(author)) text = text.slice(author.length).trim();
      if (text) return done(p.source, author, text, p.url, '嵌入版');
    }
    const o = await get(p.url, UA_BOT);
    if (o.html) {
      const d = meta(o.html, 'og:description');
      const m = d.match(/^[\s\S]*?\s-\s+(\S+)[^:]*:\s*"([\s\S]*)"\.?\s*$/);
      if (m) return done(p.source, m[1], m[2], p.url, '一般網址');
    }
    return { ok: false, source: p.source, url: p.url, error: 'IG 沒有回應內容（可能被擋）' };
  }
  const r = await get(p.url, UA_BOT);
  if (r.html) {
    const text = meta(r.html, 'og:description');
    const author = (meta(r.html, 'og:title').match(/@([A-Za-z0-9._]+)/) || [])[1] || '';
    const url = meta(r.html, 'og:url') || p.url;
    if (text) return done(p.source, author, text, cleanUrl(url), '一般網址');
  }
  return { ok: false, source: p.source, url: p.url, error: 'Threads 沒有回應內容' };
}

function done(source, author, text, url, via) {
  return { ok: true, source, author: clip(author, 60), text: clip(text, 5000), url: cleanUrl(url), via };
}
function cleanUrl(s) {
  try { const x = new URL(s); x.search = ''; x.hash = ''; return x.href; } catch { return ''; }
}
function clip(s, n) { return String(s || '').replace(/[​-‏‪-‮⁦-⁩﻿]/g, '').trim().slice(0, n); }

async function get(href, ua) {
  try {
    const res = await fetch(href, { headers: { 'User-Agent': ua, 'Accept-Language': 'zh-TW,zh;q=0.9,ja;q=0.8,en;q=0.7' }, redirect: 'follow' });
    if (res.status !== 200 || res.url.includes('/accounts/login')) return { status: res.status, url: res.url };
    return { status: 200, url: res.url, html: (await res.text()).slice(0, 800000) };
  } catch (e) {
    return { error: String(e).slice(0, 200) };
  }
}

// ---- 除錯：三種讀法的原始結果 ----
async function debug(p) {
  const tries = [['方式1 一般網址＋預覽機器人', p.url, UA_BOT]];
  if (p.embed) tries.push(['方式2 嵌入版', p.embed, UA_BROWSER]);
  tries.push(['方式3 一般網址＋iPhone瀏覽器', p.url, UA_BROWSER]);
  const results = [];
  for (const [label, href, ua] of tries) {
    const r = await get(href, ua);
    const h = r.html || '';
    results.push({ 方式: label, 狀態碼: r.status, 最後網址: r.url, og_title: meta(h, 'og:title'), og_description: meta(h, 'og:description'), 嵌入版內文: text_(pick(h, /class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments/i)).slice(0, 1500), 錯誤: r.error });
  }
  return { 網址: p.url, 結果: results };
}

// ---- 文字處理 ----
function meta(html, prop) {
  const tag = (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i')) || [])[0] || '';
  return decode((tag.match(/content=["']([^"']*)["']/i) || [])[1] || '');
}
function pick(s, re) { const m = s.match(re); return m ? decode(m[1]).trim() : ''; }
function text_(s) {
  return decode(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}
function decode(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': APP_ORIGIN,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// ---- 測試頁（模擬 App 裡的流程：貼上 → 讀取 → 整理成筆記；整理規則是 v0.11.0 以前的版本） ----
function page() {
  return new Response(TEST_HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

const TEST_HTML = `<!doctype html>
<html lang="zh-Hant"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><title>貼上連結測試</title>
<style>
  :root{--ink:#37352f;--soft:#787774;--paper:#f7f7f5;--card:#fff;--line:#e9e9e7;--link:#9f6b53;--danger:#cb4b4b}
  @media (prefers-color-scheme:dark){:root{--ink:#e9e9e7;--soft:#9b9a97;--paper:#191919;--card:#2f2f2f;--line:#424242;--link:#c99b7c;--danger:#e07a7a}}
  *{box-sizing:border-box} body{margin:0;padding:16px 16px calc(40px + env(safe-area-inset-bottom));background:var(--paper);color:var(--ink);font:16px/1.5 -apple-system,"PingFang TC",sans-serif}
  main{max-width:560px;margin:0 auto} h1{font-size:20px;margin:8px 0 4px} p.hint{color:var(--soft);font-size:14px;margin:0 0 16px}
  button{font:inherit;color:inherit;border:0;border-radius:6px;min-height:44px;padding:0 16px;cursor:pointer}
  .primary{background:var(--ink);color:var(--paper);width:100%;font-weight:600}
  .row{display:flex;gap:8px;margin-top:8px} .row input{flex:1}
  input,textarea{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:10px 12px;width:100%}
  textarea{min-height:220px;resize:vertical}
  .ghost{background:var(--card);border:1px solid var(--line)}
  .card{background:var(--card);border-radius:12px;padding:16px;margin-top:16px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  label{display:block;font-size:13px;color:var(--soft);margin:12px 0 4px} label:first-child{margin-top:0}
  .badge{display:inline-flex;align-items:center;gap:6px;background:var(--paper);border-radius:999px;padding:4px 12px;font-size:14px}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--link)}
  .msg{margin-top:12px;font-size:14px;color:var(--soft)} .err{color:var(--danger)}
  .meta{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--soft);margin-top:8px;word-break:break-all}
  a{color:var(--link)}
</style></head><body><main>
<h1>貼上連結測試</h1>
<p class="hint">在 IG 或 Threads 按「複製連結」，回到這裡按下面的按鈕。</p>
<button class="primary" id="paste">貼上連結</button>
<div class="row"><input id="url" type="search" placeholder="或自己貼上網址" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"><button class="ghost" id="go">讀取</button></div>
<div class="msg" id="msg"></div>
<div class="card" id="result" hidden>
  <label>類型</label><span class="badge"><span class="dot"></span>推薦</span>
  <label>標題（<span id="tlen">0</span> / 60）</label><input id="title" type="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
  <label>參考連結</label><input id="link" type="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
  <label>內容（<span id="blen">0</span> / 3000）</label><textarea id="body" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
  <div class="meta" id="info"></div>
</div>
</main>
<script>
const K = new URLSearchParams(location.search).get('k') || '';
const $ = id => document.getElementById(id);
const msg = (t, err) => { $('msg').textContent = t; $('msg').className = 'msg' + (err ? ' err' : ''); };

$('paste').addEventListener('click', async () => {
  try {
    const t = await navigator.clipboard.readText();
    const m = (t || '').match(/https:\\/\\/[^\\s]+/);
    if (!m) return msg('剪貼簿裡沒有網址：「' + (t || '').slice(0, 40) + '」', true);
    $('url').value = m[0]; load(m[0]);
  } catch (e) { msg('讀不到剪貼簿：' + e.message, true); }
});
$('go').addEventListener('click', () => load($('url').value));
$('url').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); load($('url').value); } });
$('title').addEventListener('input', count); $('body').addEventListener('input', count);
function count(){ $('tlen').textContent = [...$('title').value].length; $('blen').textContent = [...$('body').value].length; }

async function load(url) {
  url = (url || '').trim(); if (!url) return;
  msg('讀取中…'); $('result').hidden = true;
  const t0 = Date.now();
  try {
    const r = await fetch('/api?k=' + encodeURIComponent(K) + '&url=' + encodeURIComponent(url));
    const d = await r.json();
    if (!d.ok) return msg('讀不到：' + (d.error || '未知原因') + '。正式版會讓你自己填標題。', true);
    const n = organize(d);
    $('title').value = n.title; $('link').value = n.url; $('body').value = n.body; count();
    $('info').textContent = (d.source === 'instagram' ? 'Instagram' : 'Threads') + '・@' + (d.author || '?') + '・用' + d.via + '讀到・' + ((Date.now() - t0) / 1000).toFixed(1) + ' 秒';
    $('result').hidden = false; msg('');
  } catch (e) { msg('連線失敗：' + e.message, true); }
}

// 整理（舊版規則；App 正式版的規則在 src/core/linkReader.js）
function organize(d) {
  const text = String(d.text || '').replace(/\\r/g, '').trim();
  const lines = text.split('\\n').map(s => s.trim());
  let title = '';
  for (const line of lines) {
    const s = line.replace(/#[^\\s#]+/g, '').replace(/^[-–—_.・·•▪️\\s]+$/, '').trim();
    if (s) { title = s; break; }
  }
  if (!title) title = (d.source === 'instagram' ? 'IG' : 'Threads') + (d.author ? ' @' + d.author : '') + ' 的貼文';
  return { title: [...title].slice(0, 60).join(''), url: d.url, body: [...text].slice(0, 3000).join('') };
}
</script>
</body></html>`;
