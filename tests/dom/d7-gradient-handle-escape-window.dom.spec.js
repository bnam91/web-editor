/* d7-gradient-handle-escape-window.dom.spec.js
 *   ★★⒟7 — 「★그라데이션 손잡이 ★탈출 전 ★한 틱에 내보내기」. (2026-10-25 신설 · 지디)
 *
 * ★★원문(적대 수지 261024 · `~/.gd-work/adversarial/REPORT-suji-261024.md:96·126`) ★그대로:
 *   「같은 경로로 그라데이션: 고르면 손잡이가 ★탈출층으로 옮겨 가므로(★rAF) 보통은 안전하다.
 *     ★탈출 전 한 틱 안에 내보내면 ★남을 수 있다 — ★★못 쟀다.」
 *
 * ★★★원문의 ★한 낱말이 ★틀렸다(261025 실측) — ★옮기는 것은 ★`rAF` 가 ★아니라
 *   ★★`MutationObserver` ★동기 콜백이다(`overlay-handles.js:4004` — `attributeFilter:['class']`).
 *   `_escRaf`(:3993·3997)는 ★옮긴 ★뒤 ★위치를 ★따라가는 ★루프다.
 *   ⇒ ★창이 ★원문이 말한 ★한 프레임(≈16ms)보다 ★★훨씬 ★좁다(마이크로태스크 체크포인트).
 *   ⛔그래도 ★「없다」로 ★닫지 ★않는다 — ★아래에서 ★행위로 ★잰다.
 *
 * ★★그리고 ★더 ★중요한 것 : ★이 결함의 ★까닭은 ★★시간이 ★아니라 ★★명부다.
 *   ★캡처는 `capture-safety.js:460` 에서 ★★정본(`NON_CONTENT_UI_SELECTOR`)을 ★쓴다 —
 *   ★그런데 ★그 정본 ★29종에 ★★`.gradient-corner-handle`·`.shape-handle` 이 ★★없다
 *   (저장 쪽 `serializeCleanRoot` 38종에는 ★있다 ⇒ 차 9 중 둘).
 *   ⇒ ★★손잡이가 ★블럭 ★자식이기만 하면 ★★언제든 ★박힌다. ★탈출은 ★그걸 ★가려주는 ★우연이다.
 *   ⇒ ★★이름 = `CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01` 과 ★★한 뿌리.
 *     ★그 뿌리 판정은 ★아래 `D7-3` 이 ★잠근다(★뿌리를 메우면 ★둘이 ★같이 닫히나).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** ★그라데 블럭을 ★앱 길로 ★만들고 ★앱 길로 ★고른다. ⛔장면을 손으로 짓지 않는다. */
async function makeAndSelect(page) {
  return await page.evaluate(async () => {
    const out = { steps: [] };
    if (typeof window.addGradientBlock !== 'function') { out.fail = 'addGradientBlock 없음'; return out; }
    /* ★★사람이 하는 ★순서를 밟는다 — ★섹션을 ★먼저 고른다.
       ⛔이걸 빼면 `addGradientBlock` 이 `showNoSelectionHint()` 만 내고 ★아무것도 안 만든다
         (gradient-block.js:301 — 「섹션 미선택 = 다른 추가 입구 40곳과 똑같이 막는다」).
       ★261025 에 내가 ★이 줄을 빼먹어 ★전제가 빨개졌다(그 단언이 ★거짓 초록을 막았다). */
    /* ★섹션도 ★앱 길로 만든다(⛔innerHTML 로 짓지 않는다) — u3 spec 과 같은 길 */
    const canvas = document.getElementById('canvas');
    if (!canvas) { out.fail = '#canvas 가 없다'; return out; }
    if (typeof window.addSection !== 'function') { out.fail = 'addSection 없음'; return out; }
    await window.addSection();
    const sec0 = [...canvas.querySelectorAll('.section-block')].pop();
    if (!sec0) { out.fail = 'addSection 뒤에도 섹션이 없다'; return out; }
    if (typeof window.selectSection !== 'function') { out.fail = 'selectSection 없음'; return out; }
    window.selectSection(sec0);
    out.steps.push('sectionSelected');
    const b = window.addGradientBlock();
    out.steps.push('added');
    if (!b || !b.classList) { out.fail = 'addGradientBlock 이 블럭을 안 돌려준다'; return out; }
    out.blockId = b.id || '';
    if (typeof window._selectGradient !== 'function') { out.fail = '_selectGradient 없음'; return out; }
    window._selectGradient(b);            /* ★여기서 손잡이 4개가 ★블럭 자식으로 생긴다 */
    out.steps.push('selected');
    out.childHandles = b.querySelectorAll(':scope > .gradient-corner-handle').length;
    return out;
  });
}

/** ★캡처가 ★하는 일을 ★그대로 — clone 뜨고 `stripEditorOnlyForCapture` 를 ★먹인다. */
const CAPTURE = async (page) => page.evaluate(async () => {
  const m = await import('/js/io/capture-safety.js');
  const gb = document.querySelector('.gradient-block');
  const sec = (gb && gb.closest('.section-block')) || document.querySelector('.section-block');
  if (!sec) return { fail: '섹션이 없다' };
  const clone = sec.cloneNode(true);
  const before = clone.querySelectorAll('.gradient-corner-handle').length;
  m.stripEditorOnlyForCapture(clone);
  return {
    before,
    after: clone.querySelectorAll('.gradient-corner-handle').length,
    liveChild: sec.querySelectorAll('.gradient-block > .gradient-corner-handle').length,
    inOverlay: (document.getElementById('ss-handles-overlay') || { querySelectorAll: () => [] })
      .querySelectorAll('.gradient-corner-handle').length,
  };
});

test('D7-0 ★전제 — ★앱 길로 그라데 블럭을 만들고 고르면 ★손잡이가 ★블럭 자식으로 생긴다', async ({ page }) => {
  await bootApp(page);
  const r = await makeAndSelect(page);
  expect(r.fail, `★전제가 깨졌다: ${r.fail}`).toBeUndefined();
  console.log('[D7-0]', JSON.stringify(r));
  expect(r.childHandles, '★손잡이가 블럭 자식으로 안 생겼다 — 아래 칸들이 뜻을 잃는다').toBe(4);
});

test('D7-1 ★★★고침 — ★탈출 «전»에 내보내도 ★캡처가 ★손잡이를 ★★지운다 (★261025 ★뒤집었다)', async ({ page }) => {
  await bootApp(page);
  const s = await makeAndSelect(page);
  expect(s.fail).toBeUndefined();
  /* ⛔여기서 ★await 를 ★넣지 ★않는다 — ★MutationObserver 가 ★돌 틈을 ★주면 ★창이 닫힌다.
     ★그래서 ★선택과 ★캡처를 ★★한 evaluate 안에서 ★이어 붙인다. */
  const r = await page.evaluate(async () => {
    const m = await import('/js/io/capture-safety.js');   /* ★먼저 받아 둔다(이 await 가 창을 닫을 수 있다) */
    const b = document.querySelector('.gradient-block');
    const sec = b && b.closest('.section-block');
    if (!b || !sec) return { fail: '블럭/섹션이 없다' };
    /* ★선택을 ★다시 건다 — ★이 줄과 ★아래 clone 사이에 ★await 가 ★하나도 ★없다 */
    window._selectGradient(b);
    const liveChild = sec.querySelectorAll('.gradient-block > .gradient-corner-handle').length;
    const clone = sec.cloneNode(true);
    const before = clone.querySelectorAll('.gradient-corner-handle').length;
    m.stripEditorOnlyForCapture(clone);
    return { liveChild, before, after: clone.querySelectorAll('.gradient-corner-handle').length };
  });
  expect(r.fail).toBeUndefined();
  console.log('[D7-1]', JSON.stringify(r));
  expect(r.liveChild, '★전제: 선택 직후 손잡이가 블럭 자식이 아니다 — 창이 애초에 없다').toBe(4);
  expect(r.before, '★전제: clone 에 손잡이가 안 담겼다').toBe(4);
  /* ★★★261025 ★뒤집었다 — ★뿌리를 ★메웠다(`②S3-GAPS`).
     ★고침 = `js/io/editor-ui-roster.js` ★정본에 ★`.gradient-corner-handle`·`.shape-handle` 을 ★더했다
       (★계약을 ★먼저 쟀다 — `save-strip-plus7-window` `W1`·`W2` : ★저장 두 창 ★0 · ★캡처 ★4)
     ★고침 ★전 실측 : `before 4` → ★`after ★4`(★안 지웠다)
     ★고침 ★후 실측 : `before 4` → ★★`after ★0`(★지운다)
     ⇒ ★★이 칸이 ★다시 ★빨개지면 = ★그 두 줄이 ★정본에서 ★빠진 것이다. */
  expect(r.after,
    `★★캡처가 손잡이를 ★안 지운다 — ★정본(NON_CONTENT_UI_SELECTOR)에서 ★그 줄이 ★빠졌나 (실측 ${r.after})`
  ).toBe(0);
});

test('D7-2 ★★탈출 «후» — ★한 틱 뒤에는 ★손잡이가 ★overlay 로 ★옮겨 ★캡처에 ★안 담긴다 (★원문의 「보통은 안전」)', async ({ page }) => {
  await bootApp(page);
  const s = await makeAndSelect(page);
  expect(s.fail).toBeUndefined();
  /* ★MutationObserver 와 rAF 가 ★돌 틈을 ★준다 — ★사람이 고른 뒤 ★내보내기를 ★누르는 ★실제 간격 */
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const r = await CAPTURE(page);
  expect(r.fail).toBeUndefined();
  console.log('[D7-2]', JSON.stringify(r));
  /* ★★이 칸이 ★D7-1 을 ★뜻 있게 만든다 — ⛔없으면 「★언제나 남는다」와 ★구분이 안 된다.
     ★그리고 ★이 칸이 ★빨개지면 ★병이 ★★넓어진 것이다(탈출이 ★안 된다) ⇒ ★그쪽이 ★더 급하다. */
  expect(r.liveChild,
    `★탈출이 안 됐다 — 손잡이가 아직 블럭 자식이다(병이 넓어졌다) · overlay=${r.inOverlay}`
  ).toBe(0);
  expect(r.before, '★탈출했는데 clone 에 손잡이가 담겼다').toBe(0);
});

test('D7-2b ★★창이 ★얼마나 좁나 — ★마이크로태스크 ★한 번만 돌려도 ★탈출이 ★끝났나 (★원문의 「rAF」 정정 근거)', async ({ page }) => {
  await bootApp(page);
  const s = await makeAndSelect(page);
  expect(s.fail).toBeUndefined();
  /* ★★원문은 ★「rAF 로 옮겨 간다」고 적었다. ★소스는 ★`MutationObserver`(overlay-handles.js:4004)다.
     ★MO 는 ★마이크로태스크 체크포인트에 ★돈다 ⇒ ★rAF 를 ★기다리지 ★않아도 ★닫혀 있어야 한다.
     ★이 칸이 ★알려 주는 것 : ★창이 ★한 프레임(≈16ms)인가 ★마이크로태스크인가. */
  const r = await page.evaluate(async () => {
    await Promise.resolve();                 /* ★rAF 를 ★기다리지 ★않는다 — 마이크로태스크만 */
    const gb = document.querySelector('.gradient-block');
    const sec = gb && gb.closest('.section-block');
    return {
      liveChild: sec ? sec.querySelectorAll('.gradient-block > .gradient-corner-handle').length : -1,
      inOverlay: (document.getElementById('ss-handles-overlay') || { querySelectorAll: () => [] })
        .querySelectorAll('.gradient-corner-handle').length,
    };
  });
  console.log('[D7-2b]', JSON.stringify(r));
  expect(r.liveChild, '★전제: 블럭/섹션을 못 찾았다').toBeGreaterThanOrEqual(0);
  /* ⛔여기에 ★한 쪽을 ★단언하지 ★않는다 — ★★이 칸은 ★«재는» 칸이다.
     ★대신 ★둘이 ★더해서 4 인지만 본다(손잡이가 ★사라지지 ★않았음 = 자가 헛돌지 않았다). */
  expect(r.liveChild + r.inOverlay,
    `★손잡이 넷이 ★어디에도 없다 — 자가 헛돌았다 (자식 ${r.liveChild} · overlay ${r.inOverlay})`
  ).toBe(4);
});

/* ⚠️★★★261025 에 ★내 자가 ★속았다 — ★이 칸(과 `_clone-removals` 파서) 둘이 ★★같이 틀렸다.
     ★변이를 「, .gradient-corner-handle 」 뒤에 ★CSS 블록주석을 붙여 심었더니 ★★CSS 는 ★그 주석을 ★먹어 ★선택자로 ★작동했고
     (`D7-1` after 0), ★내 ★split 파서와 `_clone-removals` 는 ★그것을 ★문자열로 ★읽어 ★★「없다」고 답했다
     (`hasGrad false` · `S3-GAPS` capture 1 남음) ⇒ ★★만장일치가 ★공통 오염이었다.
   ⇒ ⛔이 명부를 ★변이로 건드릴 때 ★★주석을 ★같이 넣지 ★마라.
     ⚠️그리고 ★이 글을 ★쓸 때도 ★밟았다 — ★JS 블록주석 ★안에 ★닫는 짝을 ★적어 ★주석이 ★조기 종료됐다. ★주석 없이 다시 재니 ★전부 맞았다. */
test('D7-3 ★★★한 뿌리인가 — ★뿌리(정본 명부)에 ★그 둘이 ★없다 ⇒ ★메우면 ★D7-1 이 ★닫힌다', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(async () => {
    const roster = await import('/js/io/editor-ui-roster.js');
    const sel = String(roster.NON_CONTENT_UI_SELECTOR || '').split(',').map(s => s.trim()).filter(Boolean);
    return {
      n: sel.length,
      hasGrad: sel.includes('.gradient-corner-handle'),
      hasShape: sel.includes('.shape-handle'),
      hasSticker: sel.includes('.sticker-corner-handle'),   /* ★음성대조 — 같은 꼴인데 ★있는 것 */
    };
  });
  console.log('[D7-3]', JSON.stringify(r));
  /* ★★전제 — ★같은 꼴의 ★손잡이가 ★하나는 ★명부에 ★있다 ⇒ ★「명부가 빈 것」이 아니다 */
  expect(r.hasSticker, '★전제: .sticker-corner-handle 도 명부에 없다 — 명부 자체가 비었나').toBe(true);
  expect(r.n, '★전제: 정본 종수가 0 이다 — 파서가 헛돌았다').toBeGreaterThan(20);
  /* ★★★261025 ★뒤집었다 — ★뿌리를 ★메웠다.
     ★고침 전 : `n 29` · hasGrad ★false · hasShape ★false
     ★고침 후 : ★`n 31` · hasGrad ★★true · hasShape ★★true
     ⇒ ★★`CAPTURE-ROSTER-NOT-DERIVED-FROM-SAVE-01` 의 ★남은 몫이 ★닫혔다
       (★`tests/unit/capture-derive-roster.test.mjs` ★`S3-GAPS` 가 ★★todo 를 떼고 ★단언이 됐다) */
  expect(r.hasGrad, '★.gradient-corner-handle 이 ★정본에서 ★빠졌다 — D7-1 도 같이 빨개졌나 보라').toBe(true);
  expect(r.hasShape, '★.shape-handle 이 ★정본에서 ★빠졌다 — D7-1 도 같이 빨개졌나 보라').toBe(true);
});
