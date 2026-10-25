/* t6-01-webp-export.dom.spec.js
 *   ★★`t6-01` — ★내보내기 꼴에 ★webp 를 더한다. (2026-10-25 신설 · 지디)
 *
 * ★발주 (현빈 원문 · p10564) : 「우측패널 export 에 ★png, ★gif 외에 ★webp 로도 내보내기 가능하게 해줘.」
 *
 * ★★⛔원문과 ★실물이 ★갈린다 — ★그대로 적어 둔다(★고르지 않고 ★적고 간다) :
 *     원문이 센 것 = ★png · gif ★둘
 *     ★실물 선택지 = ★PNG · ★JPG · GIF(정적) · GIF(애니메이션) ★★넷  ⇒ ★★`jpg` 가 ★원문에 ★안 나온다.
 *   ⇒ ★현빈이 ★「png, gif 외에」라 하신 것은 ★★«지금 있는 것 ★외에»의 ★줄임으로 읽는다
 *     (★jpg 를 ★빼라는 말이 ★아니다 — ★뺀다는 말은 ★어디에도 ★없다).
 *   ★★이 해석이 ★틀렸으면 ★jpg 처분을 ★따로 받아야 한다 — ★이름 `WEBP-ORDER-OMITS-JPG-01`.
 *
 * ★★고치는 김에 ★막는 것 — ★★명부가 ★«둘»이다
 *   ⑴ 선택지: `js/props/prop-page.js` 와 `js/props/prop-section.js` 가 ★같은 네 줄을 ★손으로 ★두 번 적는다.
 *   ⑵ gif 판정: `js/io/export-gate.js:72` 와 `js/io/export-gate-core.js:267` 이 ★'gif'·'gif-anim' 을 ★두 번 적는다.
 *   ⇒ ★★「명부가 둘이면 ★경고 주석으로 못 막는다 — ★파생시켜 ★하나로」.
 *     ★정본 = `js/io/export-formats.js` ★한 자리. ★W3 이 ★그 파생을 ★잰다.
 *
 * ★★안 재는 축 (★이름)
 *   · ★실제로 ★디스크에 ★떨어진 ★webp ★바이트 — `WEBP-REAL-FILE-BYTES-UNMEASURED-01` (★앱/태양 축 · 발주대로)
 *     ★여기서는 ★「제품이 ★무슨 mime 으로 ★toBlob 을 부르나」를 ★가로채 ★재고, ★별도로
 *     ★「이 엔진이 ★그 mime 으로 ★정말 webp 를 만든다」를 ★양성대조(W6)로 ★잰다.
 *   · ★webp 화질(quality 0.95) 이 ★보기에 ★좋은가 — `WEBP-QUALITY-UNJUDGED-01`
 *   · ★★★제품 경로(`exportSection`)가 ★무슨 mime 으로 굽나 — ★★여기서는 ★못 잰다.
 *     ★★261025 ★실측: 헤드리스 playwright 에서 `exportSection` 은 ★터진다 —
 *       `Event{type:'error', target: IMG «data:image/png;base64,★null»}`
 *       ⇒ ★네이티브 CDP 캡처(`export-image.js:484`)가 ★Electron 전용이라 ★여기엔 ★없고,
 *         ★그 자리가 ★`null` 을 ★그대로 ★`<img>` 에 ★싣는다.
 *     ⇒ ★이름 `WEBP-EXPORT-PATH-NEEDS-NATIVE-CAPTURE-01` (★앱/태양 축)
 *     ★대신 ★«꼴 → mime/ext» 파생은 ★★단위검사가 ★잰다 — tests/unit/export-formats-single-roster.test.mjs
 *       (★순수 함수 ＋ ★`export-image.js` 소스가 ★그 파생을 ★쓰나 ＋ ★변이대조)
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js t6-01-webp-export
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    const el = [...c.querySelectorAll('.section-block')].pop();
    el.style.minHeight = '260px';
    return el ? el.id : null;
  });
  await raf2(page);
  return { errs, id };
}

/** ★진짜 클릭으로 섹션을 고른다(왼쪽 패딩 띠) — 전제 = 섹션 패널이 떴다. */
async function pickSection(page, id) {
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  await page.mouse.click(b.left + 8, b.cy);
  await page.waitForFunction((i) =>
    document.getElementById(i)?.classList.contains('selected') &&
    document.getElementById('sec-height-value')?.dataset.secId === i, id, { timeout: 8000 });
  await raf2(page);
}

/** ★페이지 패널을 띄운다 — ★섹션을 고르면 ★안 뜬다(261025 실측: 섹션 패널과 ★다른 칸이다). */
async function showPagePanel(page) {
  await page.evaluate(() => window.showPageProperties?.());
  await page.waitForFunction(() => !!document.getElementById('page-export-format'), null, { timeout: 8000 });
  await raf2(page);
}

const optsOf = (page, sel) => page.evaluate((s) => {
  const el = document.getElementById(s);
  if (!el) return null;
  return [...el.options].map(o => ({ id: o.value, label: o.textContent.trim() }));
}, sel);

/* ─────────────────────────── W0 ★전제 ─────────────────────────── */
test('W0 ★자가점검 — 앱이 뜨고 ★페이지 패널과 ★섹션 패널의 ★형식 칸이 ★둘 다 선다', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(typeof id === 'string' && id, `addSection 이 준 id = ${id}`).toBeTruthy();
  await showPagePanel(page);
  const pageOpts = await optsOf(page, 'page-export-format');
  expect(pageOpts, '페이지 패널 형식 칸(#page-export-format)이 없다 — 아래 판정 무효').not.toBe(null);
  await pickSection(page, id);
  const secOpts = await optsOf(page, 'sec-export-format');
  expect(secOpts, '섹션 패널 형식 칸(#sec-export-format)이 없다 — 아래 판정 무효').not.toBe(null);
  expect(errs, `콘솔 오류 = ${JSON.stringify(errs)}`).toEqual([]);
});

/* ───────────────────── W1·W2 ★webp 가 ★두 칸 모두에 ───────────────────── */
test('W1 ★페이지 패널 형식 칸에 ★webp 가 있다', async ({ page }) => {
  await setup(page);
  await showPagePanel(page);
  const o = await optsOf(page, 'page-export-format');
  expect(o.map(x => x.id), `페이지 선택지 = ${JSON.stringify(o)}`).toContain('webp');
});

test('W2 ★섹션 패널 형식 칸에 ★webp 가 있다', async ({ page }) => {
  const { id } = await setup(page);
  await pickSection(page, id);
  const o = await optsOf(page, 'sec-export-format');
  expect(o.map(x => x.id), `섹션 선택지 = ${JSON.stringify(o)}`).toContain('webp');
});

/* ───────── W3 ★★명부가 ★하나다 — 두 칸이 ★공용 정본에서 ★파생된다 ───────── */
test('W3 ★★두 칸이 ★«같은 정본»에서 나온다 — 선택지가 글자까지 같고 ★그 수가 ★정본의 수다', async ({ page }) => {
  const { id } = await setup(page);
  await showPagePanel(page);
  const pageOpts = await optsOf(page, 'page-export-format');
  await pickSection(page, id);
  const secOpts = await optsOf(page, 'sec-export-format');
  expect(secOpts, `페이지 ${JSON.stringify(pageOpts)} · 섹션 ${JSON.stringify(secOpts)}`).toEqual(pageOpts);
  /* ★★여기가 ★「파생」을 ★재는 자리다 — ⛔두 쪽이 ★우연히 같은 것과 ★구분하려면
     ★«정본»이 ★실재하고 ★그 수와 ★같아야 한다. */
  const src = await page.evaluate(() => {
    const L = window.EXPORT_FORMATS;
    return Array.isArray(L) ? L.map(f => ({ id: f.id, label: f.label })) : null;
  });
  expect(src, '공용 정본 window.EXPORT_FORMATS 가 없다 — 두 칸이 여전히 손으로 두 번 적힌 명부다').not.toBe(null);
  expect(pageOpts, `정본 = ${JSON.stringify(src)}`).toEqual(src);
});

/* ───────── W4·W5 ★제품이 ★그 꼴의 mime 으로 ★굽는다 (＋★양성대조) ───────── */
/** `toBlob` 을 가로채 ★무슨 mime 으로 불렸나와 ★받은 확장자를 잰다. ⛔파일을 만들지는 않는다. */
const NO_NATIVE = 'WEBP-EXPORT-PATH-NEEDS-NATIVE-CAPTURE-01 — 헤드리스엔 네이티브 CDP 캡처가 없어 exportSection 이 터진다(실측: IMG data:image/png;base64,null). 꼴→mime 파생은 tests/unit/export-formats-single-roster 가 잰다';
async function bakeMime(page, id, fmt) {
  return page.evaluate(async ([i, f]) => {
    const sec = document.getElementById(i);
    const seen = { mimes: [], ext: null, err: null };
    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    const origTrigger = window.triggerDownload;
    HTMLCanvasElement.prototype.toBlob = function (cb, mime, q) {
      seen.mimes.push(String(mime || ''));
      return origToBlob.call(this, cb, mime, q);
    };
    window.triggerDownload = (blob, ext) => { seen.ext = String(ext || ''); seen.size = blob ? blob.size : 0;
      seen.head = null; return Promise.resolve(); };
    try { await window.exportSection(sec, f, 860); }
    catch (e) { seen.err = String(e && e.message || e); }
    finally { HTMLCanvasElement.prototype.toBlob = origToBlob; window.triggerDownload = origTrigger; }
    return seen;
  }, [id, fmt]);
}

test('W4 ★webp 를 고르면 ★`image/webp` 로 굽고 ★확장자가 `webp` 다', async ({ page }) => {
  test.skip(true, NO_NATIVE);
  const { id } = await setup(page);
  const r = await bakeMime(page, id, 'webp');
  expect(r.err, `내보내기가 터졌다 — ${r.err}`).toBe(null);
  expect(r.mimes, `toBlob 이 받은 mime = ${JSON.stringify(r.mimes)}`).toContain('image/webp');
  expect(r.ext, `triggerDownload 가 받은 확장자 = ${r.ext}`).toBe('webp');
  expect(r.size > 0, `구운 바이트 = ${r.size}`).toBe(true);
});

test('W5 ★★양성대조 — 같은 자로 ★png·jpg 를 재면 ★그 mime 이 나온다 (★자가 작동)', async ({ page }) => {
  test.skip(true, NO_NATIVE);
  const { id } = await setup(page);
  const p = await bakeMime(page, id, 'png');
  const j = await bakeMime(page, id, 'jpg');
  expect(p.mimes, `png 때 mime = ${JSON.stringify(p.mimes)}`).toContain('image/png');
  expect(p.ext, `png 확장자 = ${p.ext}`).toBe('png');
  expect(j.mimes, `jpg 때 mime = ${JSON.stringify(j.mimes)}`).toContain('image/jpeg');
  expect(j.ext, `jpg 확장자 = ${j.ext}`).toBe('jpg');
  /* ★★셋이 ★서로 다르다 — ⛔「늘 같은 mime」이면 W4 는 아무것도 안 잰다 */
  expect(new Set([p.mimes.join(), j.mimes.join()]).size, 'png 와 jpg 가 같은 mime 으로 구워졌다').toBe(2);
});

/* ───────── W6 ★이 엔진이 ★정말 webp 를 만든다 (★양성대조 · 능력) ───────── */
test('W6 ★★`image/webp` toBlob 이 ★정말 ★WebP 바이트를 낸다 (RIFF…WEBP 매직)', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#ff8800'; ctx.fillRect(0, 0, 32, 32);
    const blob = await new Promise(res => cv.toBlob(res, 'image/webp', 0.95));
    if (!blob) return { ok: false, why: 'toBlob 이 null 을 줬다' };
    const u8 = new Uint8Array(await blob.arrayBuffer());
    const s = (a, b) => String.fromCharCode(...u8.slice(a, b));
    return { ok: true, type: blob.type, size: blob.size, riff: s(0, 4), webp: s(8, 12) };
  });
  expect(r.ok, `webp 를 못 구웠다 — ${r.why}`).toBe(true);
  expect(r.riff, `앞 4바이트 = «${r.riff}» (전부: ${JSON.stringify(r)})`).toBe('RIFF');
  expect(r.webp, `8~12 바이트 = «${r.webp}» — PNG 로 떨어졌다면 여기가 WEBP 가 아니다`).toBe('WEBP');
  expect(r.type, `blob.type = ${r.type}`).toBe('image/webp');
});

/* ───────── W7 ★음성대조 — gif 는 ★그 길로 ★안 간다 ───────── */
test('W7 ★★음성대조 — ★gif 는 ★`image/gif` 로 굽지 ★않는다(별도 인코더 길)', async ({ page }) => {
  test.skip(true, NO_NATIVE);
  const { id } = await setup(page);
  const g = await bakeMime(page, id, 'gif');
  expect(g.mimes.includes('image/gif'), `gif 때 toBlob mime = ${JSON.stringify(g.mimes)} — gif 는 toBlob 길이 아니다`).toBe(false);
});
