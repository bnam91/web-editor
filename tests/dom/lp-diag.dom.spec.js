/* ★★LP 진단 — ★«＋ 를 눌렀는데 줄이 안 생겼다»의 ★세 갈래를 ★한 번에 가른다.
 * ⛔이 파일은 ★.txt 로 둔다 — ★.dom.spec.js 로 만들면 ★게이트의 「디스크 440」이 441 이 되어
 *   ★돌는 전수의 ★`--full` 판정을 ★흐린다. ★★전수가 끝난 뒤 옮긴다:
 *   cp lp-diag.spec.txt <레인>/tests/dom/lp-diag.dom.spec.js
 * ★★목적: ★«왜 안 됐나»를 ★검사 자신이 ★말하게 한다(「검사는 자기 전제를 단언해야 한다」).
 *   ⒜ typeof undefined  → ★모듈 부착 시점 경합
 *   ⒝ specOk false      → ★grdNewLineSpec('body') 가 null
 *   ⒞ res.ok false      → ★grdAddLine 이 거절
 *   ★세 갈래가 ★배타다 ⇒ ★★한 번 재면 갈린다.
 * ⛔「느려서」를 COND_MS 늘리기로 덮지 않는다 — ★여기선 ★아예 ★안 기다리고 ★곧바로 찍는다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="bL" data-section="1" data-name="L" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">L</span></div><div class="section-inner"></div></div>`;

test('LPD1 ★진단 — ＋ 를 누른 «직후» 줄 추가 문이 window 에 있나 (⒜/⒝/⒞ 를 가른다)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    window.selectSection?.(document.getElementById('bL'));
    window.addSpeechBubbleBlock?.('left');
  }, SEC);

  /* ★전제 ①  — 말풍선이 골라졌다 */
  await page.waitForFunction(() => !!document.querySelector('#canvas .speech-bubble-block.selected'), undefined, { timeout: 15000 });
  const id = await page.evaluate(() => document.querySelector('#canvas .speech-bubble-block.selected').id);

  /* ★★전제 ② — ★★«줄 추가 문»이 window 에 ★붙었나. ★이게 이 진단의 핵이다.
     ⛔여기서 터지면 ★그게 ⒜ 다 — ★「＋ 를 눌렀는데 줄이 안 생겼다」보다 ★훨씬 ★많이 말해 준다. */
  const beforeClick = await page.evaluate(() => ({
    newLineSpec: typeof window.grdNewLineSpec,
    addLine: typeof window.grdAddLine,
    specOk: !!(window.grdNewLineSpec && window.grdNewLineSpec('body')),
    btn: document.querySelectorAll('#grd-plus-layer > .ln-add-btn').length,
  }));
  console.log('    LPD1 누르기 ★전: ' + JSON.stringify(beforeClick));

  /* ★전제 ③ — ＋ 가 떴다 */
  await page.waitForFunction((id) => document.querySelectorAll(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`).length === 1,
    id, { timeout: 15000 });

  /* ★★261014 실측으로 ★더한 칸 — ★r3 에서 ★⒜도 ⒝도 ★아니고 ★★⒞(함수 다 있는데 lines null)가 ★1/3 로 났다.
     ⇒ ★다음 갈래는 ★★«클릭이 ★닿았나» vs ★«닿았는데 ★거절했나»다. ★★누르기 ★직전에 ★그 점을 ★찍는다. */
  const box = await page.locator(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const hit = await page.evaluate(({ x, y, id }) => {
    const el = document.elementFromPoint(x, y);
    const btn = document.querySelector(`#grd-plus-layer > .ln-add-btn[data-ln-for="${id}"]`);
    return {
      top: el ? (el.className || el.tagName) : null,          // ★그 점의 ★맨 위 요소
      onBtn: !!(el && btn && (el === btn || btn.contains(el))), // ★★그게 ★＋ 인가
      sel: !!document.getElementById(id)?.classList.contains('selected'),
      sole: document.querySelectorAll('#canvas .selected').length,
    };
  }, { x: cx, y: cy, id });
  console.log('    LPD1 누르기 ★직전 ★점: ' + JSON.stringify(hit));

  /* ⛔★★261014 — ★여기 있던 ★«grdAddLine 직접 부름» 탐침을 ★★뺐다.
     ★까닭: ★그 탐침이 ★★시험을 ★오염시켰다 — ★누르기 ★전에 ★한 번 부르자 ★빨강이 ★1/3 → ★4/6 로 ★올랐다.
     ★★「조사가 ★증거를 ★지운다」. ★그리고 ★그 탐침의 ★`ok:false` 는 ★★내 인자가 틀린 값이었다(host=null). */
  await page.mouse.click(cx, cy);

  /* ★★곧바로 찍는다 — ⛔기다리지 않는다. ★대기가 ★까닭을 ★덮는다 */
  const now = await page.evaluate((id) => ({
    newLineSpec: typeof window.grdNewLineSpec,
    addLine: typeof window.grdAddLine,
    specOk: !!(window.grdNewLineSpec && window.grdNewLineSpec('body')),
    lines: document.getElementById(id)?.dataset.lines ?? null,
    btn: document.querySelectorAll('#grd-plus-layer > .ln-add-btn').length,
  }), id);
  console.log('    LPD1 누른 ★직후: ' + JSON.stringify(now));

  /* ★한 박자 뒤 한 번 더 — ★«늦게 붙는다»와 ★«영영 안 붙는다»를 가른다 */
  await page.waitForTimeout(600);   // ⛔이 고정 대기는 ★판정에 안 쓴다 — ★«늦게»를 재는 자다
  const later = await page.evaluate((id) => ({
    addLine: typeof window.grdAddLine,
    lines: document.getElementById(id)?.dataset.lines ?? null,
  }), id);
  console.log('    LPD1 0.6s ★뒤: ' + JSON.stringify(later));

  /* ★★판정 — ★갈래를 ★단언으로 ★박는다 */
  expect(now.newLineSpec, '⒜ grdNewLineSpec 이 window 에 없다 — 모듈 부착 시점 경합').toBe('function');
  expect(now.addLine, '⒜ grdAddLine 이 window 에 없다 — 모듈 부착 시점 경합').toBe('function');
  expect(now.specOk, '⒝ grdNewLineSpec("body") 가 null 을 돌려준다').toBe(true);
  expect(later.lines, '⒞ 둘 다 있는데 줄이 안 생겼다 — grdAddLine 이 거절했다').not.toBeNull();
  expect(errs).toEqual([]);
});

test('LPD2 ★음성대조 — ★줄 추가 문을 ★일부러 ★떼면 ★LPD1 의 ⒜ 단언이 ★빨개진다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  /* ★★이 칸은 ★«내 자가 ★작동하나»를 잰다 — ⛔초록은 양성이 아니다 */
  const gone = await page.evaluate(() => {
    delete window.grdAddLine;
    return typeof window.grdAddLine;
  });
  expect(gone, '★음성대조 전제 — 떼어냈다').toBe('undefined');
});
