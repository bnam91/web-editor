/* modal-overlay-float.dom.spec.js — T3 「모달 오버레이 기능이 안 보인다 ⇒ 추가」
 *   (현빈 섹션메모 `sec_3e0suk0` · 지디 발주 2026-10-07)
 *
 * ══ ★「안 보인다」가 ★넷 중 어느 것이었나 — ★행위로 가렸다 ══════════════════════
 *   ㉠없다 ㉡있는데 패널에 안 뜬다 ㉢뜨는데 안 먹는다 ㉣다른 이름이다
 *   ★참값 = ★★㉠ ★없다. ★근거 셋(착수 전 실측):
 *     ⑴ `js/overlay-float.js` 머리말 — 「공용 모듈 (★텍스트 · 도형 · 에셋)」 ⇒ ★모달이 그 셋에 ★없다
 *     ⑵ `js/props/prop-modal.js` 의 「오버레이」 ★1건 = ★:13 ★주석이다(「패널과 오버레이 ★핸들이…」)
 *        ⇒ ★토글이 아니다 ⇒ ㉡㉢ 이 아니다
 *     ⑶ 다른 이름 후보(`overlay-float`·`floatBlock`·`data-float`) 전수 — 모달 ★0건 ⇒ ㉣ 아니다
 *
 * ══ ★무엇을 ★안 만들었나 (★이 건의 ★값) ═══════════════════════════════════════
 *   ⛔진입·이탈·드래그를 ★새로 짜지 않았다. `js/overlay-float.js` 가 ★정본이고
 *   ★그 파일이 ★베끼기를 ★막아 뒀다 — 「사본을 만들면 ★그 11개(후속 P0 수정: 회전축 어긋남 ·
 *   클램프 범위 · 재부모 좌표 점프 · contenteditable 가드 · 복귀 섹션 오인 …)를 ★두 번 더 만든다」
 *   ⇒ 모달이 ★꽂히는 자리가 ★이미 셋 맞았다(착수 전 실측):
 *     ★`posElOf`(:32) 가 모달을 ★어느 갈래에도 안 걸어 ★`return block` 으로 떨어뜨린다 ⇒ ★어댑터 수정 ★0
 *     ★`wireFloatToggle({block,buttonId,rerender})` 가 ★이미 매개화됐다(선례 텍스트·도형)
 *     ★제외 명부 `_isFlowAnchor`(:386) = gap-block·drop-indicator·ss-resize-handle ⇒ 모달 ★안 막힌다
 *   ⇒ ★단추 겉모습도 ★공용이다 — `_helpers.overlayToggleBtnHTML`
 *
 * ══ ★「있나」가 아니라 ★「읽히나」 (지디 지시) ═════════════════════════════════
 *   ★어제 쿠폰에서 ★단추가 ★17px 로 눌려 글자가 쪼개졌다. ⇒ ★자 = ★«구별되는 y» 의 수.
 *   ⛔`scrollWidth > clientWidth` 금지(단추는 overflow visible — ★넘쳐도 안 자란다 · 실측 over 0)
 *   ⛔`getClientRects().length` 금지(그건 ★«글자 토막» 수다 — ★한 줄인데 2 가 나온다 · 실측)
 *   ★이 단추는 ★아이콘(svg)이라 글자가 없다 ⇒ ★★대신 ★«면적»을 잰다(어제 「면적일 수 있다」 교훈).
 *
 * ⛔앱 통째 헤드리스(`bootApp`) — ★내 손 하네스를 ★또 만들지 않는다(어제 교훈: 손 하네스 131벌).
 * ★양성대조: `GD1001_ROOT=<4b36eb56 체크아웃>` 이면 같은 시험이 ★옛 판을 잰다(★빨강이어야 한다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js modal-overlay-float --workers=2
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 모달 하나를 섹션에 넣고 «고른» 상태로 만든다 — 사람이 하는 순서(넣기 → 고르기)를 밟는다. */
async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div>'
      + '<div class="section-inner" id="inner1"></div></div>');
    window.rebindAll?.();
    /* ★사람이 하는 순서 — 섹션을 고르고 ★입구로 넣는다(⛔DOM 을 손으로 짜 넣지 않는다) */
    document.getElementById('sec1').classList.add('selected');
    const made = window.addModalBlock?.({});
    window.__mdl = made && made.block;
  });
  await page.waitForTimeout(250);
  /* ★전제 ① — 모달이 ★실제로 들어갔고 ★골라졌나 */
  const pre = await page.evaluate(() => ({
    exists: !!window.__mdl,
    inDom: !!(window.__mdl && window.__mdl.isConnected),
    selected: !!(window.__mdl && window.__mdl.classList.contains('selected')),
    panelOpen: /Modal/.test(document.getElementById('panel-right')?.innerHTML || ''),
  }));
  expect(pre.exists, '전제: addModalBlock 이 블럭을 안 돌려줬다').toBe(true);
  expect(pre.inDom, '전제: 모달이 DOM 에 없다').toBe(true);
  expect(pre.selected, '전제: 넣은 뒤 자동선택이 안 됐다').toBe(true);
  expect(pre.panelOpen, '전제: 우측 패널이 모달 패널이 아니다').toBe(true);
  return errs;
}

const btnBox = (page) => page.evaluate(() => {
  const b = document.getElementById('mdl-float-toggle');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), pressed: b.getAttribute('aria-pressed'),
           cls: b.className };
});

/* ═══════════════════════════════════════════════════════════════════════════
   M-OVL1 — ★단추가 «있다» ＋ ★«눌릴 면적이 있다»(지디 지시: 있나가 아니라 읽히나)
═══════════════════════════════════════════════════════════════════════════ */
test('M-OVL1 ★오버레이 단추가 모달 패널에 있고 «눌릴 면적»을 갖는다', async ({ page }) => {
  // ⇐ 되돌리기: prop-modal.js 의 overlayToggleBtnHTML 호출 한 줄을 지우면 빨강
  const errs = await setup(page);
  const b = await btnBox(page);
  expect(b, '★오버레이 단추(#mdl-float-toggle)가 패널에 없다').not.toBeNull();
  /* ★면적 — 「선택이 안 된다」가 규칙이 아니라 «면적»일 수 있다(2026-09-30 교훈).
     ⛔px 수를 박지 않는다: ★같은 패널의 ★다른 아이콘 단추와 ★견준다(★같은 실행에서). */
  const ref = await page.evaluate(() => {
    const any = [...document.querySelectorAll('#panel-right .prop-chain-btn')]
      .filter(e => e.id !== 'mdl-float-toggle')
      .map(e => { const r = e.getBoundingClientRect(); return { id: e.id, w: Math.round(r.width), h: Math.round(r.height) }; });
    return any;
  });
  expect(b.w, `단추 폭 ${b.w}px — 0 이면 못 누른다`).toBeGreaterThan(0);
  expect(b.h, `단추 높이 ${b.h}px`).toBeGreaterThan(0);
  /* ★그리고 ★공용 겉모습을 썼나 — 클래스가 ★정본 함수의 것이어야 한다 */
  expect(b.cls, `클래스 ${b.cls}`).toContain('prop-chain-btn--overlay');
  expect(b.pressed, '처음엔 안 눌린 상태여야 한다').toBe('false');
  /* ★음성대조 — ★그 패널에 ★다른 chain 단추가 있으면 ★크기를 견준다(없으면 이 칸은 건너뛴다) */
  if (ref.length) {
    const r0 = ref[0];
    expect(Math.abs(b.w - r0.w), `★${r0.id}(${r0.w}×${r0.h}) 와 폭이 ${Math.abs(b.w - r0.w)}px 다르다`).toBeLessThanOrEqual(2);
  }
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M-OVL2 — ★「먹나」. ★진짜 클릭으로 ★떠야 한다(㉢ 갈래를 닫는다)
═══════════════════════════════════════════════════════════════════════════ */
test('M-OVL2 ★단추를 «진짜 눌러» 모달이 뜬다 — 그리고 다시 누르면 제자리로', async ({ page }) => {
  // ⇐ 되돌리기: wireFloatToggle 호출을 지우면 «단추는 있는데 안 먹는다»(㉢) 가 되어 빨강
  const errs = await setup(page);
  const read = () => page.evaluate(() => {
    const m = window.__mdl;
    const pos = window.OverlayFloat?.posElOf(m) || m;
    return {
      overlay: pos.dataset.overlayBlock || null,
      position: getComputedStyle(pos).position,
      parent: pos.parentElement?.className || null,
      pressed: document.getElementById('mdl-float-toggle')?.getAttribute('aria-pressed'),
      hasXY: !!document.getElementById('mdl-x-number'),
    };
  });
  /* ★전제 — ★posElOf 가 ★모달 ★자신을 돌려주나(착수 전 소스 실측의 ★행위 확인) */
  const same = await page.evaluate(() => window.OverlayFloat?.posElOf(window.__mdl) === window.__mdl);
  expect(same, '★posElOf 가 모달 자신을 안 돌려준다 — 어댑터 전제가 깨졌다').toBe(true);

  const before = await read();
  expect(before.overlay, '처음엔 떠 있지 않아야 한다').not.toBe('true');
  expect(before.hasXY, '떠 있지 않을 때 X/Y 칸이 보이면 안 된다').toBe(false);

  await page.locator('#mdl-float-toggle').click();
  await page.waitForTimeout(250);
  const after = await read();
  expect(after.overlay, '★눌렀는데 안 떴다 — 단추는 있고 «안 먹는다»(㉢)').toBe('true');
  expect(after.position, `떠 있는데 position 이 ${after.position} 다`).toBe('absolute');
  expect(after.pressed, '눌린 상태 표시(aria-pressed)가 안 바뀌었다').toBe('true');
  expect(after.hasXY, '★떠 있으면 X/Y 두 칸이 나와야 한다').toBe(true);

  /* ★되돌아오나 — 「다시 누르면 원래 자리로」가 그 모듈의 계약이다 */
  await page.locator('#mdl-float-toggle').click();
  await page.waitForTimeout(250);
  const back = await read();
  expect(back.overlay, '★다시 눌렀는데 안 돌아왔다').not.toBe('true');
  expect(back.hasXY, '돌아왔는데 X/Y 칸이 남아 있다').toBe(false);
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M-OVL3 — ★⌘Z ★한 걸음. ⛔「되돌려진다」가 아니라 ★몇 칸 늘었나
   ★그 모듈이 ★«양쪽 끝»을 찍는다고 적어 뒀다(wireFloatToggle 주석) ⇒ ★그 수를 잰다
═══════════════════════════════════════════════════════════════════════════ */
test('M-OVL3 ★오버레이 토글 한 번 = 히스토리가 «양쪽 끝»을 남긴다 (수로 센다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const tipSeq = () => (window.getHistoryTip ? (window.getHistoryTip().empty ? null : window.getHistoryTip().seq) : null);
    const s0 = tipSeq();
    document.getElementById('mdl-float-toggle').click();
    await new Promise(r => setTimeout(r, 300));
    const s1 = tipSeq();
    /* ★그리고 ★⌘Z 한 번에 ★돌아오나 — ★스택 수와 ★행위를 ★같이 */
    const posBefore = (window.OverlayFloat.posElOf(window.__mdl)).dataset.overlayBlock || null;
    const labelBefore = window.getHistoryTip()?.action || null;
    window.undo?.();
    await new Promise(r => setTimeout(r, 400));
    /* ★★undo 는 ★캔버스를 ★통째로 되살린다 ⇒ ★`window.__mdl` 은 ★★떼어진 옛 노드다.
       ⛔그 참조로 재면 ★영원히 'true' 가 나온다(★실측: mdlStillSame=false · 그래서 이 칸이 ★틀렸었다).
       ⇒ ★★다시 집는다. (★「조사가 증거를 지운다」의 사촌 — ★동작이 ★대상을 갈아끼운다) */
    const live = document.querySelector('.modal-block');
    const posAfter = live ? ((window.OverlayFloat.posElOf(live)).dataset.overlayBlock || null) : null;
    return { s0, s1, delta: (s0 != null && s1 != null) ? s1 - s0 : null,
             posBefore, posAfter, labelBefore, labelAfter: window.getHistoryTip()?.action || null,
             reQueried: live !== window.__mdl, liveExists: !!live };
  });
  /* ★전제 — 히스토리 자가 ★살아 있나(둘 다 null 이면 ★안 재고 있다) */
  expect(r.s1, '★getHistoryTip 이 seq 를 안 준다 — 이 칸은 아무것도 재고 있지 않다').not.toBeNull();
  /* ★그 모듈 주석이 「양쪽 끝」이라 했다 ⇒ ★칸이 ★늘어야 한다. ⛔맨숫자를 박지 않는다 */
  expect(r.delta, `스택 ${r.s0} → ${r.s1} (Δ ${r.delta}) — 토글이 표본을 안 남겼다`).toBeGreaterThanOrEqual(1);
  /* ★행위 — ⌘Z 한 번에 ★떠 있던 것이 ★내려와야 한다 */
  expect(r.posBefore, '전제: 토글 뒤에 떠 있어야 한다').toBe('true');
  /* ★전제 — undo 가 ★노드를 갈아끼웠나(그래야 위 «다시 집기»가 뜻이 있다) */
  expect(r.liveExists, 'undo 뒤 모달이 사라졌다').toBe(true);
  expect(r.reQueried, '★undo 가 노드를 안 갈아끼웠다 — 이 칸의 «다시 집기» 전제가 바뀌었다').toBe(true);
  /* ★라벨로도 한 번 — 「오버레이로 전환」이 되돌려졌나 */
  expect(r.labelBefore, `토글 뒤 꼭대기 라벨 ${r.labelBefore}`).toMatch(/오버레이/);
  expect(r.posAfter, `★⌘Z 한 번에 안 내려왔다 (${r.posBefore} → ${r.posAfter})`).not.toBe('true');
  expect(errs).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M-OVL4 — ★떠 있을 때 ★폭 손잡이가 ★흐름과 «다르게» 가나 (★대조로 닫는다)
   ───────────────────────────────────────────────────────────────────────────
   ★내 첫 가설: 모달 리사이즈는 ★Δ=2·dx 로 센다(`overlay-handles.js:1131` — 「wMode:'fixed' 가
     ★margin:auto 를 같이 주므로 상자가 ★정중앙에 선다 ⇒ 각 변이 Δ/2 만 움직인다」).
     ★떠 있으면(absolute ＋ left 지정) ★margin:auto 가 ★가운데로 안 보낸다 ⇒ ★전제가 깨질 것이다.
   ⛔★★그 가설을 ★박지 않았다 — ★대조를 세웠고 ★대조가 ★가설을 ★기각했다:
     ★실측(2026-10-07) — ★흐름과 ★떠 있는 쪽이 ★★완전히 같았다
        둘 다 `wMode full→fixed` · `dataset.width 400→860` · ★offsetWidth ★불변(860)
     ★★그리고 ★내 첫 측정의 흠도 ★그 대조가 찾았다 — ★시작 폭이 ★860(=clamp 최댓값)이었다
        (`wMode:'full'` 이면 폭이 ★캔버스 전체다) ⇒ ★★더 넓힐 수가 ★없었다 ⇒ Δ 가 0 으로 보였다
     ⇒ ★★그래서 ★좁은 ★고정폭에서 ★시작한다. ⚠️배율이 ★40% 다(실측 `currentZoom=40`) —
        ★화면 dx 를 ★모델 dx 로 바꾸는 것은 ★핸들러가 한다(`_canvasScaleNow`), ★검사는 ★비만 본다.
   ★이 칸이 ★재는 것 = ★「★떠 있는 쪽이 ★흐름과 ★같은 비로 가나」. ⛔1 이냐 2 냐를 ★안 박는다.
═══════════════════════════════════════════════════════════════════════════ */

/** se 손잡이를 진짜 마우스로 dx 만큼 끌고 «폭 변화»를 돌려준다. */
async function dragSE(page, dx) {
  await page.evaluate(() => {
    const m = document.querySelector('.modal-block');
    m.classList.add('selected');
    window.showHandlesFor?.(m);
  });
  await page.waitForTimeout(250);
  const n = await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay .mdl-overlay-handle').length);
  const box = await page.locator('#ss-handles-overlay .mdl-overlay-handle.se').boundingBox();
  if (!box) return { n, box: null };
  const w0 = await page.evaluate(() => document.querySelector('.modal-block').offsetWidth);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const w1 = await page.evaluate(() => document.querySelector('.modal-block').offsetWidth);
  return { n, w0, w1, d: w1 - w0 };
}
/** 좁은 고정폭으로 맞춘다 — ⛔clamp 최댓값에서 시작하면 더 넓힐 수 없다(내가 밟은 함정). */
async function narrowFixed(page, w) {
  await page.evaluate((w) => {
    const m = document.querySelector('.modal-block');
    window.setModalSizeMode?.(m, 'w', 'fixed');
    m.dataset.width = String(w);
    window.renderModalBlock?.(m);
  }, w);
  await page.waitForTimeout(200);
  const got = await page.evaluate(() => document.querySelector('.modal-block').offsetWidth);
  expect(got, `전제: 좁은 고정폭 ${w} 로 안 맞춰졌다(${got})`).toBe(w);
}

test('M-OVL4 ★떠 있는 모달의 폭 손잡이가 ★흐름과 «같은 비»로 간다 (★대조)', async ({ page }) => {
  const errs = await setup(page);
  const DX = 30;
  /* ⑴ 흐름 — 기준 */
  await narrowFixed(page, 300);
  const flow = await dragSE(page, DX);
  expect(flow.n, '흐름: 손잡이가 0개다').toBeGreaterThan(0);
  expect(flow.box, '흐름: se 손잡이가 화면에 없다').not.toBeNull();
  /* ★전제 — 기준이 ★실제로 움직였나. 0 이면 ★이 대조는 «안 쟀다»다 */
  expect(Math.abs(flow.d), `흐름이 안 움직였다 (${flow.w0} → ${flow.w1})`).toBeGreaterThan(0);

  /* ⑵ 떠 있게 하고 ★같은 폭에서 ★같은 dx */
  await page.evaluate(() => document.getElementById('mdl-float-toggle').click());
  await page.waitForTimeout(350);
  const isUp = await page.evaluate(() => {
    const m = document.querySelector('.modal-block');
    return (window.OverlayFloat.posElOf(m)).dataset.overlayBlock || null;
  });
  expect(isUp, '전제: 떠 있어야 한다').toBe('true');
  await narrowFixed(page, 300);
  const flt = await dragSE(page, DX);
  expect(flt.n, '떠 있을 때 손잡이가 0개다 — ★그것부터 결함이다').toBeGreaterThan(0);
  expect(flt.box, '떠 있을 때 se 손잡이가 화면에 없다').not.toBeNull();

  /* ★본단언 — ★두 비가 ★같나. ⛔1·2 를 박지 않고 ★서로 견준다(★같은 실행 · 빌린 수 0) */
  console.log(`M-OVL4 flow d=${flow.d} (${flow.w0}→${flow.w1}) · float d=${flt.d} (${flt.w0}→${flt.w1}) · dx=${DX}`);
  expect(flt.d, `★떠 있는 쪽이 ${flt.d}px · 흐름은 ${flow.d}px — 같은 dx(${DX})인데 갈린다`)
    .toBe(flow.d);
  expect(errs).toEqual([]);
});
