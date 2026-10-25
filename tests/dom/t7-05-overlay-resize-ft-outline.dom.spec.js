/* t7-05-overlay-resize-ft-outline.dom.spec.js — t7-05 「오버레이 모드 리사이즈 시 텍스트만 확대되고 아웃라인·격자는 변경되지 않는 오류 수정」
 *
 * ★잰 값(시트 t7-05 클로드코멘트) — 글꼴 36→118.7px · tf 124→409 인데 .tfh-edge rect 49.8×17.2 → 49.8×17.2 불변 ·
 *   대조 .ss-sel-path 는 따라옴(자는 살아 있다).
 * ★뿌리 — 오버레이 글상자 리사이즈(js/overlay-handles.js _onTextOverlayResizeMouseDown)는 폭과 글자 크기만 k 배로 바꾼다.
 *   자유변형의 네 점(dataset.tfCorners · 옛 글자 크기 단위)·잰 값(W H OX OY)·보라 테두리(.tfh-edge)·격자(.tfh-fx)는
 *   아무도 다시 맞추지 않는다(다시 그리기 = 로드·선택 때뿐).
 * ★처방 — 리사이즈 시작 때 네 점을 떠 두고(ftScaleBase), 움직일 때마다 같은 k 로 곱해 그리기 문(applyFxFreeTransform —
 *   다시 재고 손잡이까지 놓는다)을 부른다(ftScaleTo). 둘 다 js/effects-freetransform.js 안.
 *
 * ★칸
 *   P  전제 — 글상자(«짧은 글») 오버레이 + 자유변형 켬 · 보라 테두리·격자 사각형 = 글자 사각형(켠 직후 · 1.5px 안)
 *   R1 오버레이 se 손잡이를 (+120,+60) 화면 px 끌면 글자 크기가 커진다(전제: 리사이즈가 먹었다)
 *   R2 ★그 뒤 보라 테두리(.tfh-edge) 사각형 = 글자 사각형(1.5px 안) — 크기가 글자를 따라왔다
 *   R3 ★격자(.tfh-fx) 사각형 = 글자 사각형(1.5px 안)
 *   R4 ⌘Z 한 번 ⇒ 글자 크기·테두리가 끌기 전으로(테두리 = 글자)
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const R = (page, id) => page.evaluate((id) => {
  const tb = document.getElementById(id);
  const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1');
  const rg = document.createRange(); rg.selectNodeContents(ce); const g = rg.getBoundingClientRect();
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; };
  return { fs: parseFloat(getComputedStyle(ce).fontSize), glyph: box({ getBoundingClientRect: () => g }), edge: box(tb.querySelector(':scope > .tfh-layer > .tfh-edge')), grid: box(tb.querySelector(':scope > .tfh-fx')) };
}, id);
const near = (a, b) => Math.max(Math.abs(a.l - b.l), Math.abs(a.t - b.t), Math.abs(a.w - b.w), Math.abs(a.h - b.h));

test('P·R1~R4 ★오버레이 리사이즈 — 보라 테두리·격자가 글자를 따라온다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    await window.addSection();
    window.addTextBlock('h1');
    const tb = [...document.querySelectorAll('#canvas .text-block')].pop();
    (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1')).textContent = '짧은 글';
    window.deselectAll?.();
    return tb.id;
  });
  let r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected') && !!document.getElementById('txt-overlay-toggle'), id, { timeout: 3000 });
  await page.click('#txt-overlay-toggle');
  await page.waitForFunction((id) => !!document.getElementById(id)?.closest('[data-overlay-block="true"]'), id, { timeout: 3000 });
  await page.selectOption('#panel-right select[id$="-fx-add"]', 'freetransform');
  await page.waitForFunction((id) => !!document.getElementById(id)?.dataset.tfCorners && !!document.querySelector('#' + id + ' > .tfh-layer > .tfh-edge'), id, { timeout: 3000 });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const m0 = await R(page, id);
  expect(near(m0.edge, m0.glyph), `P 켠 직후 테두리=글자 ${JSON.stringify(m0.edge)} vs ${JSON.stringify(m0.glyph)}`).toBeLessThan(1.5);
  expect(near(m0.grid, m0.glyph), 'P 켠 직후 격자=글자').toBeLessThan(1.5);
  const se = await page.evaluate(() => { const h = [...document.querySelectorAll('.tfo-overlay-handle.se')].find((e) => e.offsetParent !== null || e.getBoundingClientRect().width > 0); if (!h) return null; const b = h.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  expect(se, 'P 전제: 오버레이 se 손잡이').not.toBeNull();
  await page.mouse.move(se.x, se.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(se.x + 120 * i / 8, se.y + 60 * i / 8);
  await page.mouse.up();
  await page.waitForFunction(([id, f]) => parseFloat(getComputedStyle(document.getElementById(id).querySelector('[contenteditable], .tb-h1')).fontSize) > f + 4, [id, m0.fs], { timeout: 3000 });
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const m1 = await R(page, id);
  expect(m1.fs, `R1 글자 ${m0.fs} → ${m1.fs}`).toBeGreaterThan(m0.fs + 4);
  expect(near(m1.edge, m1.glyph), `R2 테두리 ${JSON.stringify(m1.edge)} = 글자 ${JSON.stringify(m1.glyph)}`).toBeLessThan(1.5);
  expect(near(m1.grid, m1.glyph), `R3 격자 ${JSON.stringify(m1.grid)} = 글자 ${JSON.stringify(m1.glyph)}`).toBeLessThan(1.5);
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(([id, f]) => Math.abs(parseFloat(getComputedStyle(document.getElementById(id).querySelector('[contenteditable], .tb-h1')).fontSize) - f) < 0.2, [id, m0.fs], { timeout: 3000 });
  await page.evaluate((id) => { const tb = document.getElementById(id); tb.classList.add('selected'); window.ftHandlesSync?.(tb); }, id);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  const m2 = await R(page, id);
  expect(near(m2.edge, m2.glyph), `R4 ⌘Z 뒤 테두리=글자 ${JSON.stringify(m2.edge)} vs ${JSON.stringify(m2.glyph)}`).toBeLessThan(1.5);
  expect(errs).toEqual([]);
});
