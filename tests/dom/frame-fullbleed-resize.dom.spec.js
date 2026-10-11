/* frame-fullbleed-resize.dom.spec.js — ★「패딩 제외」가 ★폭을 만져도 ★안 풀린다 (2026-10-11 · 현빈)
 *
 * ★현빈 원문: 「★리사이즈하면 ★패딩제외가 ★풀린다」 (★08-27 에 ★에셋에서 ★한 번 · ★10-11 에 ★프레임에서 ★또)
 *
 * ★★★무엇이었나 — ★★«풀린다»가 ★아니라 ★★«어긋난다»다. ★실측(★고치기 전 판 `5954e4f4`):
 *   ★켠 뒤       `style.width = calc(100% + 64px)` · `marginLeft = -32px` · 그려진 폭 ★924
 *   ★★드래그 ★중간 `style.width = ★860px` (★★`calc(` 가 ★사라졌다) · `marginLeft` 는 ★★-32px ★그대로
 *   ★up 뒤       ★같다
 *   ⇒ ★스위치(`dataset.fullBleed`)와 ★음수 마진은 ★★남고 ★★폭만 ★죽어
 *     ★블럭이 ★왼쪽으로 ★32px ★밀린 채 ★좁아진다.
 *
 * ★★★왜 ★이 파일이 ★«두 칸»인가 — ★★규약이 ★걸려야 할 ★입구가 ★★둘이다:
 *   ⒤ ★패널 ★폭 슬라이더  (`js/props/prop-frame.js` 의 `applyWidth`)
 *   ⒥ ★오버레이 ★리사이즈 ★핸들 (`js/overlay-handles.js` 의 ★프레임 `onMove`)
 *   ★★⒤ 는 ★★이미 ★걸려 있었고 ★그 자리 ★주석이 ★이 병을 ★★이름으로 ★적어 뒀다.
 *   ★★⒥ 는 ★★한 번도 ★없었다 — 출처= `git log -S'applyBlockFullBleed' -- js/overlay-handles.js` = ★0커밋.
 *   ⇒ ★★★그래서 ★★«공용 본문(`applyBlockFullBleed`)을 ★무력화하면 ★★두 칸이 ★다 ★빨강»이어야 한다.
 *     ★그게 ★이 파일이 ★★한 입구만 ★재지 ★않는 ★까닭이다.
 *
 * ⚠️★따르는 ★결과(★결함이 ★아니다): ★패딩제외가 ★켜져 있으면 ★★가로로 ★폭이 ★안 줄어든다.
 *   ★★패널 슬라이더가 ★이미 ★그렇게 ★동작한다 ⇒ ★★두 입구가 ★같아지는 것이 ★이 고침의 ★뜻이다.
 *   ★세로(높이)는 ★그대로 ★준다 — ★아래 ★음성대조가 ★그것을 ★잠근다.
 *
 * ⚠️★토글은 ★★`label.prop-toggle` 을 ★누른다 — ★그 `input` 은 ★★«안 보인다»(★실측: `check()` 가 ★60초 ★초과).
 * ⛔`waitForTimeout` ★0건 — ★`waitForFunction` 으로만(★`dom-fixed-wait-census` W3 래칫).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/frame-fullbleed-resize.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SNAP = `(() => {
  const el = window.__ff;
  const cs = getComputedStyle(el);
  return {
    ds: el.dataset.fullBleed ?? null,
    styleWidth: el.style.width || '', marginL: el.style.marginLeft || '',
    hasCalc: /calc\\(/.test(el.style.width || ''),
    rectW: Math.round(el.getBoundingClientRect().width),
    rectH: Math.round(el.getBoundingClientRect().height),
    secInnerW: (() => { const s = el.closest('.section-inner'); return s ? Math.round(s.clientWidth) : null; })(),
    effPadX: typeof window.effectiveSectionPadX === 'function' ? window.effectiveSectionPadX(el) : null,
  };
})()`;

/** ★섹션 ★하나 ＋ ★프레임 ★하나 — ★앱 함수로 짓고 ★진짜 클릭으로 ★고른다(★사람이 하는 순서). */
async function setup(page, sid) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((id) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="' + id + '"><div class="section-hitzone"></div>'
      + '<div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll && window.rebindAll();
    window.applyZoom && window.applyZoom(100);
    window.deselectAll && window.deselectAll();
    window.selectSection(document.getElementById(id));
    window.addFrameBlock();
    window.__ff = [...document.querySelectorAll('#' + id + ' .frame-block:not([data-text-frame])')].pop();
    window.buildLayerPanel && window.buildLayerPanel();
    window.deselectAll && window.deselectAll();
    if (window.__ff) window.__ff.dataset.ff = '1';
  }, sid);
  await page.waitForFunction(() => !!window.__ff && window.__ff.isConnected, null, { timeout: 5000 });
  const r = await waitStableRect(page, '[data-ff="1"]');
  await clickAt(page, r.cx, r.cy, { sel: '[data-ff="1"]' }, { label: '프레임 고르기' });
  await page.waitForFunction(() => !!document.getElementById('ss-fullbleed-toggle'), null, { timeout: 5000 })
    .catch(() => { throw new Error('★「패딩 제외」 칸이 ★안 떴다 — ★★이 칸은 ★아무것도 ★안 잰다(★섹션 패딩이 ★0 인가)'); });
  return errs;
}

/** ★패딩제외를 ★★패널에서 ★진짜로 ★켠다 ＋ ★★켜졌음을 ★수로 ★확인한다. */
async function turnOn(page) {
  await page.locator('label.prop-toggle:has(#ss-fullbleed-toggle)').click();
  await page.waitForFunction(() => window.__ff.dataset.fullBleed === 'true', null, { timeout: 5000 })
    .catch(() => { throw new Error('★켜기가 ★`dataset.fullBleed` 에 ★안 닿았다 — ★전제가 ★안 섰다'); });
  const on = await page.evaluate((c) => eval(c), SNAP);
  /* ★★전제 ★둘 — ⛔이 둘이 없으면 ★아래 ★주 단언이 ★«항등식»이 된다(★원래 calc 가 없었을 수도) */
  expect(on.ds, '★전제 ㉠ — ★스위치가 ★켜졌다').toBe('true');
  expect(on.hasCalc,
    `★★전제 ㉡ — ★켠 ★직후 ★`+'`style.width`'+`가 ★`+'`calc(`'+`를 ★품는다(★그게 ★패딩제외의 ★그림이다).`
    + ` ★잰 값 「${on.styleWidth}」 · marginLeft 「${on.marginL}」`).toBe(true);
  return on;
}

/** ★오버레이 ★`se` 핸들의 ★화면 좌표. */
const seHandle = (page) => page.evaluate(() => {
  const hs = [...document.querySelectorAll('.ss-resize-handle, .frame-resize-handle')];
  const se = hs.find((x) => /\bse\b/.test(String(x.className))) || hs[hs.length - 1];
  if (!se) return { n: 0 };
  const b = se.getBoundingClientRect();
  return { n: hs.length, cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
});

/* ══════ 입구 ⒥ ★오버레이 ★리사이즈 ★핸들 ══════════════════════════════════ */
test('FB1 ★★핸들로 ★끌어도 ★패딩제외가 ★안 풀린다 — ★★«드래그 ★중»에도 (현빈 2026-10-11)', async ({ page }) => {
  const errs = await setup(page, 'fbA');
  const on = await turnOn(page);
  const h = await seHandle(page);
  expect(h.n, `★전제 ㉢ — ★오버레이 ★리사이즈 ★핸들이 ★섰다. 잰 값 ${JSON.stringify(h)}`).toBeGreaterThan(0);

  /* ★★드래그를 ★끊어 ★«중간»을 ★찍는다 — ★★사람은 ★끌면서 ★본다(★그래서 ★`onUp` 이 ★아니라 ★`onMove` 다) */
  await page.mouse.move(h.cx, h.cy);
  await page.mouse.down();
  await page.mouse.move(h.cx - 30, h.cy + 8, { steps: 6 });
  const mid = await page.evaluate((c) => eval(c), SNAP);
  await page.mouse.move(h.cx - 70, h.cy + 16, { steps: 6 });
  const mid2 = await page.evaluate((c) => eval(c), SNAP);
  await page.mouse.up();
  await page.waitForFunction(() => true, null, { timeout: 800 });
  const up = await page.evaluate((c) => eval(c), SNAP);
  console.log('★FB1 잰 것 = ' + JSON.stringify({ on, mid, mid2, up }));

  /* ── ★★주 단언 ⑴ — ★★«드래그 ★중»에도 ★`calc(` 가 ★살아 있다 (★고치기 전 = ★`860px`) ── */
  expect(mid.hasCalc,
    `★★★드래그 ★«중»에도 ★`+'`style.width`'+`가 ★`+'`calc(`'+`를 ★품어야 한다 —`
    + ` ★★그 자리가 ★`+'`onMove`'+` 인 ★까닭이다(★사람은 ★끌면서 ★본다).`
    + ` ★잰 값 「${mid.styleWidth}」 (★고치기 전 ★실측 = 「860px」)`).toBe(true);
  expect(mid2.hasCalc, `★★둘째 틱에서도 ★같다. 잰 값 「${mid2.styleWidth}」`).toBe(true);
  /* ── ★★주 단언 ⑵ — ★놓은 ★뒤에도 ★같다 ── */
  expect(up.hasCalc, `★★놓은 ★뒤에도 ★`+'`calc(`'+`가 ★살아 있다. 잰 값 「${up.styleWidth}」`).toBe(true);
  /* ── ★★주 단언 ⑶ — ★★«세트»가 ★안 갈린다(★폭·마진·스위치 ★셋) ── */
  expect({ ds: up.ds, marginL: up.marginL },
    `★★스위치와 ★음수 마진도 ★세트로 ★남는다 — ⛔폭만 ★죽으면 ★블럭이 ★한쪽으로 ★밀린다. 잰 값 ${JSON.stringify(up)}`)
    .toEqual({ ds: 'true', marginL: on.marginL });
  /* ── ★★주 단언 ⑷ — ★그려진 폭이 ★★섹션 패딩을 ★뚫은 ★그 값 그대로 ── */
  expect(up.rectW,
    `★★그려진 폭이 ★켠 ★직후와 ★같아야 한다(★패딩을 ★뚫은 ★상태 ★유지).`
    + ` 잰 값 ${up.rectW} · 켠 직후 ${on.rectW} · section-inner ${up.secInnerW} · effPadX ${up.effPadX}`).toBe(on.rectW);

  /* ── ★★음성대조 — ★★세로(높이)는 ★★여전히 ★끌린다. ⛔내 고침이 ★리사이즈를 ★통째로 ★끄지 ★않았다 ── */
  expect(up.rectH !== on.rectH,
    `★★★음성대조 — ★높이는 ★★여전히 ★바뀌어야 한다(★내 고침은 ★«폭»만 ★되돌린다).`
    + ` 잰 값 높이 ${on.rectH} → ${up.rectH}`).toBe(true);

  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ 입구 ⒤ ★패널 ★폭 슬라이더 — ★★이미 ★걸려 있던 자리. ★★같이 ★잠근다 ══════ */
test('FB2 ★★패널 ★폭 칸을 만져도 ★패딩제외가 ★안 풀린다 — ★★둘째 입구(★공용 본문을 ★같이 잠근다)', async ({ page }) => {
  const errs = await setup(page, 'fbB');
  const on = await turnOn(page);

  /* ★패널의 ★폭 ★숫자 칸을 ★사람처럼 ★채운다 */
  const nBox = await page.locator('#ss-width-num').count();
  expect(nBox, '★전제 ㉢ — ★패널에 ★폭 ★숫자 칸(`#ss-width-num`)이 ★하나다').toBe(1);
  await page.fill('#ss-width-num', '400');
  await page.locator('#ss-width-num').press('Enter');
  await page.waitForFunction(() => window.__ff.dataset.width === '400', null, { timeout: 5000 })
    .catch(() => { throw new Error('★폭 칸이 ★`dataset.width` 에 ★안 닿았다 — ★이 칸은 ★아무것도 안 잰다'); });
  const after = await page.evaluate((c) => eval(c), SNAP);
  console.log('★FB2 잰 것 = ' + JSON.stringify({ on, after }));

  expect(after.hasCalc,
    `★★패널에서 ★폭을 ★만져도 ★`+'`calc(`'+`가 ★살아 있어야 한다(★그 자리 ★주석의 ★그 규약).`
    + ` 잰 값 「${after.styleWidth}」`).toBe(true);
  expect({ ds: after.ds, marginL: after.marginL },
    `★★스위치와 ★음수 마진도 ★세트로 ★남는다. 잰 값 ${JSON.stringify(after)}`)
    .toEqual({ ds: 'true', marginL: on.marginL });
  expect(after.rectW, `★★그려진 폭도 ★같다. 잰 값 ${after.rectW} · 켠 직후 ${on.rectW}`).toBe(on.rectW);

  /* ★★음성대조 — ★★끄면 ★그 폭(400)이 ★★살아난다. ⛔«항상 calc» 가 ★아니다 */
  await page.locator('label.prop-toggle:has(#ss-fullbleed-toggle)').click();
  await page.waitForFunction(() => window.__ff.dataset.fullBleed === undefined, null, { timeout: 5000 })
    .catch(() => { throw new Error('★끄기가 ★`dataset.fullBleed` 를 ★안 지웠다'); });
  const off = await page.evaluate((c) => eval(c), SNAP);
  console.log('★FB2 끈 뒤 = ' + JSON.stringify(off));
  expect(off.hasCalc,
    `★★★음성대조 — ★★끄면 ★`+'`calc(`'+`가 ★사라져야 한다(⛔«항상 참»인 단언이 ★아니다).`
    + ` 잰 값 「${off.styleWidth}」`).toBe(false);

  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});
