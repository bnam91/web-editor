/* capture-strips-editor-ui.dom.spec.js — ★★R1 을 ★★«행위»로 ★잠근다 (2026-10-23 · 지디)
 *
 * ★★★왜 생겼나 — ★★R1 의 자물쇠가 ★«소스 파싱»뿐이었다
 *   `tests/unit/capture-derive-roster.test.mjs` 는 ★★«capture-safety.js 의 함수 몸통에
 *   그 선택자가 ★글자로 있나»를 ★판다. ★그건 ★좋은 자지만 ★★«돌려 본 것»이 ★아니다.
 *   ⇒ ★★★소스가 ★그대로여도 ★행동이 ★깨지는 길이 ★있다 —
 *     ⒤ 상수가 ★빈 문자열로 ★풀린다  ⅱ) ★strip 을 ★다른 노드에 ★건다
 *     ⅲ) ★`querySelectorAll` 이 ★자손을 ★못 본다(스코프 실수)
 * ★★그리고 ★261023 에 ★★찾아보니 — ★★«캡처 산출물»에서 ★손잡이를 ★세는 DOM 벌이 ★★0 이었다.
 *   ★있던 셋은 ★전부 ★★«저장본»(serializeProject)을 ★잰다 — ★★그 길은 ★★고침 ★전에도 ★깨끗했다
 *   (coin-sticker:455 · buzz-frame:566 · marking-icon-label:445)
 *   ⇒ ★이름 `R1-LOCKED-BY-SOURCE-PARSE-ONLY-NO-BEHAVIOR-01` — ★이 벌이 ★그걸 ★닫는다.
 *
 * ★재는 것 ★넷:
 *   C0 ★전제   — ★★«진짜 만드는 자»(window._addAbRotateHandles)가 ★회전존 ★4 를 ★블럭 ★안에 ★넣는다
 *   C1 ★실판   — ★그 클론을 ★걷으면 ★★0
 *   C2 ★음성대조 — ★★명부 ★밖 노드와 ★★콘텐츠(글자)는 ★★남는다 (⛔「전부 지운다」가 아니다)
 *   C3 ★명부 전수 — ★`NON_CONTENT_UI_SELECTOR` 의 ★★모든 종이 ★걷힌다 ＋ ★그 명부가 ★비지 않았다
 *
 * ⚠️★C3 의 장면은 ★★«손으로 만든 것»이다(종마다 빈 div 를 붙인다).
 *   ⇒ ★그 꼴이 ★앱에서 ★정말 나는지는 ★C0 이 ★한 종(ab-rotate-zone)에 대해서만 ★증명한다.
 *   ⇒ ★★나머지 종의 ★«앱에서 나나»는 ★★여전히 ★안 쟀다 — ⛔이 머리말을 ★지우지 마라.
 *
 * ⛔앱을 «안» 띄운다 — index.html ＋ 레포 파일만 크로미움에 얹는다(banner-placeholder-export-strip 선례).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js capture-strips-editor-ui
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script type="module">
  import '/js/asset-rotate.js';
  import { stripEditorOnlyForCapture } from '/js/io/capture-safety.js';
  import { NON_CONTENT_UI_SELECTOR } from '/js/io/editor-ui-roster.js';
  window.__strip = stripEditorOnlyForCapture;
  window.__roster = NON_CONTENT_UI_SELECTOR;
  window.__ready = true;
</script></body>`);
})();

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** ★진짜 장면 — 섹션 > 에셋 블럭 · ★진짜 만드는 자가 회전존을 넣는다. */
const realScene = (page) => page.evaluate(() => {
  const host = document.querySelector('#canvas') || document.body;
  host.innerHTML = '';
  const sec = document.createElement('div');
  sec.className = 'section-block'; sec.id = 'sec1';
  const ab = document.createElement('div');
  ab.className = 'asset-block selected'; ab.id = 'ab1';
  ab.style.cssText = 'position:relative;width:200px;height:120px;';
  /* ★콘텐츠 — ★음성대조용. ★이 글자가 ★사라지면 ★걷는 자가 ★과잉이다. */
  const tb = document.createElement('div');
  tb.className = 'text-block'; tb.id = 'tb1'; tb.textContent = '지우면 안 되는 글자';
  ab.appendChild(tb);
  sec.appendChild(ab); host.appendChild(sec);
  if (typeof window._addAbRotateHandles !== 'function') return { err: '★_addAbRotateHandles 가 window 에 없다' };
  window._addAbRotateHandles(ab);
  return {
    zones: ab.querySelectorAll(':scope > .ab-rotate-zone').length,
    text: tb.textContent,
    /* ★★그 회전존이 ★정말 ★빈 노드인가 — ★이 벌의 ★전제이자 ★적대적 검수 ①의 재확인 */
    zoneKids: [...ab.querySelectorAll(':scope > .ab-rotate-zone')].map(z => z.childNodes.length),
    zoneText: [...ab.querySelectorAll(':scope > .ab-rotate-zone')].map(z => z.textContent),
  };
});

test('C0 ★전제 — ★«진짜 만드는 자»가 ★회전존 ★4 를 넣는다 · ★그 넷은 ★빈 노드다', async ({ page }) => {
  const errs = await boot(page);
  const s = await realScene(page);
  expect(s.err, `★장면을 못 만들었다: ${s.err}`).toBeUndefined();
  expect(s.zones, `★전제: 고른 에셋 블럭 ★안에 .ab-rotate-zone 이 ★4 다 — 잰 값 ${s.zones}`).toBe(4);
  expect(s.text, '★전제: 콘텐츠 글자가 있다').toBe('지우면 안 되는 글자');
  /* ★★적대적 ① 의 재확인 — ★그 넷이 ★무언가를 ★품으면 ★걷을 때 ★그것도 ★같이 간다 */
  expect(s.zoneKids, `★회전존이 ★자식을 품는다 — 잰 값 ${JSON.stringify(s.zoneKids)} · 걷으면 그 자식도 같이 간다`).toEqual([0, 0, 0, 0]);
  expect(s.zoneText, '★회전존이 ★글자를 품는다').toEqual(['', '', '', '']);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('C1 ★★실판 — ★클론을 ★걷으면 ★회전존이 ★0 · C2 ★음성대조 — ★콘텐츠는 ★남는다', async ({ page }) => {
  const errs = await boot(page);
  const pre = await realScene(page);
  expect(pre.zones, '★전제(C0 와 같은 자)').toBe(4);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    const clone = ab.cloneNode(true);
    /* ★★걷기 ★전을 ★먼저 잰다 — ⛔없으면 「0 이다」가 「★원래 0 이었다」와 ★구분 안 된다 */
    const before = clone.querySelectorAll('.ab-rotate-zone').length;
    /* ★명부 ★밖 노드 — ★★이것이 ★사라지면 ★걷는 자가 ★과잉이다 */
    const keep = document.createElement('div');
    keep.className = 'zz-not-in-roster'; keep.textContent = '나는 남아야 한다';
    clone.appendChild(keep);
    window.__strip(clone);
    return {
      before,
      after: clone.querySelectorAll('.ab-rotate-zone').length,
      keptOther: clone.querySelectorAll('.zz-not-in-roster').length,
      keptText: clone.querySelector('#tb1')?.textContent ?? null,
    };
  });
  expect(r.before, `★전제: 걷기 ★전 클론에 회전존 ★4 — 잰 값 ${r.before}`).toBe(4);
  expect(r.after,
    `★★R1 — 걷은 클론에 .ab-rotate-zone 이 ★${r.after} 개 남았다. ` +
    '⇒ ★js/io/capture-safety.js stripEditorOnlyForCapture 가 ★NON_CONTENT_UI_SELECTOR 를 ★안 읽고 있다 ' +
    '(★★EXPORT-SELECTED-HANDLE-BAKED-IN-01 — 고른 채 내보내면 손잡이가 박힌다)').toBe(0);
  expect(r.keptOther, '★★음성대조 — ★명부 ★밖 노드까지 지웠다 = ★걷는 자가 ★과잉이다').toBe(1);
  expect(r.keptText, '★★음성대조 — ★콘텐츠 글자가 ★사라졌다').toBe('지우면 안 되는 글자');
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('C3 ★명부 ★전수 — `NON_CONTENT_UI_SELECTOR` 의 ★모든 종이 ★걷힌다 (⚠️장면은 손으로 만든 것)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const roster = String(window.__roster || '');
    const sels = roster.split(',').map(s => s.trim()).filter(Boolean);
    const host = document.querySelector('#canvas') || document.body;
    host.innerHTML = '';
    const sec = document.createElement('div');
    sec.className = 'section-block';
    /* ★종마다 ★빈 div 하나 — ⚠️손으로 만든 장면이다(머리말 참조) */
    for (const s of sels) {
      const d = document.createElement('div');
      d.className = s.replace(/^\./, '');
      d.dataset.probe = s;
      sec.appendChild(d);
    }
    const keep = document.createElement('div');
    keep.className = 'zz-not-in-roster'; keep.textContent = '남아야 한다';
    sec.appendChild(keep);
    host.appendChild(sec);
    const clone = sec.cloneNode(true);
    const before = sels.filter(s => clone.querySelector(s));
    window.__strip(clone);
    const after = sels.filter(s => clone.querySelector(s));
    return { n: sels.length, beforeN: before.length, after, kept: clone.querySelectorAll('.zz-not-in-roster').length };
  });
  /* ★★분모가 ★비면 ★아래 「0 건」이 ★★«안 쟀다»다 */
  expect(r.n, `★명부가 ★${r.n} 종이다 — ★비면 이 칸이 ★항등으로 초록이다(js/io/editor-ui-roster.js 를 보라)`).toBeGreaterThanOrEqual(20);
  expect(r.beforeN, `★전제: 걷기 ★전에 ★${r.n} 종이 ★다 ★있다 — 잰 값 ${r.beforeN}`).toBe(r.n);
  expect(r.after,
    `★★캡처 겹이 ★안 걷는 종이 ★${r.after.length} 개다: ${r.after.join(' ')}\n` +
    '  ⇒ ★소스 파싱(capture-derive-roster R1)은 ★초록인데 ★★행동이 ★다르다 — ★그 틈이 ★이 벌의 까닭이다').toEqual([]);
  expect(r.kept, '★★음성대조 — ★명부 밖 노드까지 지웠다').toBe(1);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});
