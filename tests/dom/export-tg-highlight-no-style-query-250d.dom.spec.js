/* export-tg-highlight-no-style-query-250d.dom.spec.js — 내보낸 HTML 을 style() 쿼리 못 쓰는 브라우저에서 열 때 그라데이션 글자 안 형광펜(★250D ①).
 *
 * 지원: Chrome·Edge 111 · Safari 18 · Firefox 151(MDN browser-compat-data). 그 아래는 @container style() 블록을 버린다.
 * 이 맥엔 그런 브라우저가 없어 실제 exportHTMLFile 산출물에서 그 블록을 지워 흉내 낸다. ⛔못 보는 꼴: 진짜 Firefox·옛 Safari 의 그림.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000252';
test.describe.configure({ timeout: 60000 });
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: (_, k) => (k === "saveProjectSync" ? (proj) => { (window.__sync ||= []).push(JSON.stringify(proj)); return { ok: true }; } : () => Promise.resolve(null)) }); });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ contentType: MIME[path.extname(f)] || "application/octet-stream", body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html?project=${PID}`);
  await page.waitForFunction(() => typeof window.rebindAll === "function" && typeof window.exportHTMLFile === "function", null, { timeout: 20000 });
  await page.evaluate(() => {
    document.getElementById('canvas').querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const inner = document.querySelector('#canvas .section-block .section-inner');
    const box = document.createElement('div');
    box.innerHTML = '<div id="tg" style="font-size:60px;font-weight:700;background-image: linear-gradient(90deg, rgb(255, 0, 0), rgb(0, 0, 255)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">가나<span id="hl" style="background-color: rgb(255, 255, 0); color: rgb(0, 0, 0);">다라마바</span></div>';
    inner.appendChild(box);
  });
}
const exported = (page) => page.evaluate(async () => { const o = URL.createObjectURL; let blob = null; URL.createObjectURL = (b) => { blob = b; return o.call(URL, b); }; HTMLAnchorElement.prototype.click = function () {}; await window.exportHTMLFile(); URL.createObjectURL = o; return blob ? blob.text() : null; });
/* 파서가 버리는 것과 같게 — @container style(…) { … } 블록 통째 */
const dropStyleQueries = (html) => { let out = html, i; while ((i = out.search(/@container\s+style\(/)) >= 0) { let j = out.indexOf('{', i), d = 1; j++; while (d && j < out.length) { if (out[j] === '{') d++; else if (out[j] === '}') d--; j++; } out = out.slice(0, i) + out.slice(j); } return out; };
const inkOnYellow = async (page, html) => { await page.setContent(html, { waitUntil: 'load' }); const fill = await page.evaluate(() => getComputedStyle(document.getElementById('hl')).webkitTextFillColor); const png = (await page.locator('#hl').screenshot()).toString('base64'); const ink = await page.evaluate(async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, i.width, i.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] < 128 && d[k + 1] < 128) n++; return n; }, png); return { fill, ink }; };

test('E0 [전제] 산출물에 @container 가 실리고, 지우면 없어진다', async ({ page }) => {
  await boot(page);
  const h = await exported(page);
  expect(h).toMatch(/@container\s+style\(/);
  expect(dropStyleQueries(h)).not.toMatch(/@container\s+style\(/);
});

test('E1 지원 브라우저 — 형광펜 글자가 보인다', async ({ page }) => {
  await boot(page);
  const v = await inkOnYellow(page, await exported(page));
  expect(v.fill).toBe('rgb(0, 0, 0)');
  expect(v.ink).toBeGreaterThan(100);
});

test('E2 style() 못 쓰는 브라우저(블록 버림) — 형광펜 글자가 보인다', async ({ page }) => {
  await boot(page);
  const v = await inkOnYellow(page, dropStyleQueries(await exported(page)));
  expect(v.fill, JSON.stringify(v)).toBe('rgb(0, 0, 0)');
  expect(v.ink, JSON.stringify(v)).toBeGreaterThan(100);
});
