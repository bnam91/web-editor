/* u3-purple-outline-geometry.dom.spec.js
 *   ★★U3 ★보라 아웃라인의 ★기하 — ★현빈 신고를 ★헤드리스 ★자가 장면으로 ★쟀다. (2026-10-25 신설)
 *
 * ★★현빈 신고(261024) : 「★자유변형 이펙트 먹였을때 ★안쪽 ★보라색 아웃라인이 ★윗면이
 *   ★파란색 아웃라인 ★밖으로 보이는데 확인해봐」
 * ★★★판정 : ★★이 장면에서는 ★★재현되지 ★않는다. ★수를 ★아래에 박는다.
 *   ⛔★「★고쳤다」로 ★적지 ★않는다 — ★「★재현 안 됨」은 ★네 갈래다(아래 ★미측 절).
 *
 * ★★왜 ★자가 장면인가 : ★현빈이 ★앱을 ★못 만지는 상황이라(261025) ★선택 상태를 ★남겨 줄 수 없다
 *   ⇒ ★★현빈 손을 ★기다리지 ★않고 ★헤드리스로 ★내가 ★장면을 만들었다.
 *
 * ★★★확정된 것 ★셋 (★실측 261025 · 배율 기본 · 글자 = 앱 기본 문구)
 *   ⑴ ★★«보라 아웃라인 = ★글자 bbox» — `.tfh-edge` 의 rect 가 ★글자 Range bbox 와 ★★완전히 같다
 *      (★둘 다 `540.8 / 159.9 / 700.8 / 207.9`) ⇒ ★내 과제(「보라가 글자 bbox 인가」)의 ★답이다.
 *   ⑵ ★★보라가 ★파란 ★밖으로 ★나가지 ★않는다 — ★파란 = `#ss-handles-overlay` 의 `path.ss-sel-path`
 *      (⛔`.text-block` outline 이 ★아니다 · `body.sel-ov` 가 그것을 ★투명으로 지운다)
 *      ★차(양수 = 보라가 밖) : ★top ★−2.9 · left 0.2 · right −0.2 · bottom −0.1
 *      ⇒ ★★보라 윗면이 ★파란 ★2.9 px ★«안»에 있다.
 *   ⑶ ★★손잡이는 ★사다리꼴을 ★따라간다 — 윗변 ★128 · 아랫변 ★160 (★네 점 비와 ★맞는다)
 *
 * ★★★새 관찰 — ★`ce` 상자가 ★네 점(D) ★밖으로 ★나간다 (★`U3-CE-BOX-OVERSHOOTS-D-01`)
 *   ★행렬은 ★`_baseRect(st.W, st.H)` = ★338×43 을 ★D 로 보내는 것인데,
 *   ★그 행렬이 ★★`ce`(★400×58)에도 ★걸린다 ⇒ ★꼭짓점이 ★D 밖으로 ★넘친다 :
 *     ★`ce`  nw[40,0] ne[★418.3,0] se[364.4,151.1] sw[★−14,151.1]
 *     ★`fx`  nw[40,0] ne[359.7,0]  se[319.7,112]   sw[0,112]      ← ★D 와 맞는다
 *   ⇒ ★`ce` 는 ★배경이 없어 ★눈에 ★안 보일 수 있다 — ⛔「보인다」로 ★단정하지 ★않는다.
 *     ★★이것이 ★현빈이 ★본 것과 ★같은지는 ★★안 쟀다.
 *
 * ⛔★「재현 안 됨」의 ★네 갈래 — ⛔하나로 ★닫지 ★않는다
 *   ㉠ ★이미 ★고쳐졌다 — ★261024 U3 재구축에서 ★`.tfh-fx` 를 ★variant-inside 로 둔 것이 그 자리일 수 있다
 *   ㉡ ★장면이 ★다르다 — ★현빈 배율·글자·변형 ★정도를 ★모른다(★그가 ★못 알려주는 상황이다)
 *   ㉢ ★내 자가 ★못 본다 — ★`getBoundingClientRect` 는 ★★외접 사각형이라 ★★사선을 ★숨긴다
 *      ⇒ ★그래서 ★꼭짓점(`DOMMatrix`)으로도 ★쟀다. ★그래도 ★★«눈»은 ★아니다
 *   ㉣ ★★앱(9401)에서만 난다 — ★헤드리스와 ★실앱이 ★다를 수 있다
 *   ⇒ ★이름 = `U3-PURPLE-OUTSIDE-BLUE-NOT-REPRODUCED-01`
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js u3-purple-outline-geometry
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const AXIS = [[0, 0], [400, 0], [400, 120], [0, 120]];
const TRAP = [[40, 0], [360, 0], [400, 140], [0, 140]];

async function scene(page, corners) {
  return await page.evaluate(async (corners) => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast', 'deselectAll'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'u3tb';
    ft.setFxFreeTransform(tb, corners, { history: false });
    window.selectBlock?.(tb.id);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const R = (el) => {
      if (!el) return null;
      const q = el.getBoundingClientRect();
      return { l: +q.left.toFixed(1), t: +q.top.toFixed(1), r: +q.right.toFixed(1), b: +q.bottom.toFixed(1) };
    };
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    const rng = document.createRange(); rng.selectNodeContents(ce);
    const gq = rng.getBoundingClientRect();
    rng.detach?.();
    const glyph = { l: +gq.left.toFixed(1), t: +gq.top.toFixed(1), r: +gq.right.toFixed(1), b: +gq.bottom.toFixed(1) };

    /* ★파란 = ★오버레이 path (⛔`.text-block` outline 이 아니다) */
    const bluePath = document.querySelector('#ss-handles-overlay svg.ss-sel-layer path.ss-sel-path');
    const blue = R(bluePath);
    const edge = R(tb.querySelector('.tfh-edge'));

    /* ★손잡이 ★네 모서리의 ★중심 — ★윗변·아랫변 길이를 ★낸다 */
    const hs = [...tb.querySelectorAll('.tfh-handle')].slice(0, 4).map((h) => {
      const q = h.getBoundingClientRect();
      return [+((q.left + q.right) / 2).toFixed(1), +((q.top + q.bottom) / 2).toFixed(1)];
    });
    return {
      glyph, blue, edge,
      handles: tb.querySelectorAll('.tfh-handle').length,
      topEdgeLen: hs.length === 4 ? +Math.hypot(hs[1][0] - hs[0][0], hs[1][1] - hs[0][1]).toFixed(1) : null,
      botEdgeLen: hs.length === 4 ? +Math.hypot(hs[2][0] - hs[3][0], hs[2][1] - hs[3][1]).toFixed(1) : null,
      /* ★양수 = ★보라가 ★파란 ★밖 */
      purpleOutside: (blue && edge) ? {
        top: +(blue.t - edge.t).toFixed(1), left: +(blue.l - edge.l).toFixed(1),
        right: +(edge.r - blue.r).toFixed(1), bottom: +(edge.b - blue.b).toFixed(1),
      } : null,
    };
  }, corners);
}

test('U0 ★전제 — ★장면이 선다(손잡이 12 · 파란 path 를 ★제 이름으로 찾았다)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  const errs = await bootApp(page);
  const r = await scene(page, TRAP);
  expect(r.handles, '★손잡이가 12 가 아니다 — 자유변형이 안 켜졌다').toBe(12);
  /* ★★앞끝 양성대조 — ★파란 선을 ★찾았나. ⛔못 찾으면 ★아래 비교가 ★«안 재고 있다»다.
     ⛔`.text-block` outline 으로 재면 ★안 된다 — `body.sel-ov` 가 그것을 ★투명으로 지운다(C7 에서 쟀다) */
  expect(r.blue, '★`#ss-handles-overlay svg.ss-sel-layer path.ss-sel-path` 를 못 찾았다 — 자가 죽었다').toBeTruthy();
  expect(r.edge, '★`.tfh-edge` 를 못 찾았다').toBeTruthy();
  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('U1 ★★★보라 아웃라인 = ★글자 bbox (★내 과제의 답)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  for (const [name, C] of [['axis', AXIS], ['trap', TRAP]]) {
    const r = await scene(page, C);
    console.log(`[U1:${name}]`, JSON.stringify({ edge: r.edge, glyph: r.glyph }));
    /* ★★네 변이 ★모두 ★0.5 px 안에서 ★같다 = ★★보라는 ★글자를 ★그대로 ★감싼다
       ★261025 실측 : 둘 다 `540.8 / 159.9 / 700.8 / 207.9`(axis) */
    for (const k of ['l', 't', 'r', 'b'])
      expect(Math.abs(r.edge[k] - r.glyph[k]),
        `★${name}: 보라(${k}=${r.edge[k]}) 와 글자(${k}=${r.glyph[k]}) 가 어긋난다 — ` +
        '★「보라 = 글자 bbox」가 깨졌다'
      ).toBeLessThan(0.6);
  }
});

test('U2 ★★현빈 신고 — ★보라 윗면이 ★파란 ★밖으로 ★나가나 (★이 장면에서는 ★★아니다)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  for (const [name, C] of [['axis', AXIS], ['trap', TRAP]]) {
    const r = await scene(page, C);
    console.log(`[U2:${name}]`, JSON.stringify(r.purpleOutside));
    /* ★★★「★안 나간다」를 ★수로 박는다 — ★이 칸이 ★빨개지면 ★★증상이 ★돌아온 것이다.
       ★261025 실측 : top ★−2.9 · left 0.2 · right −0.2 · bottom −0.1 (★양수 = 밖)
       ★허용 ★0.5 px = ★border·반올림 여유(⛔신고의 「보인다」는 ★그보다 ★크다) */
    expect(r.purpleOutside.top,
      `★${name}: ★보라 윗면이 ★파란 밖으로 ★${r.purpleOutside.top} px 나갔다 — ★★현빈 신고가 ★재현됐다`
    ).toBeLessThan(0.5);
    for (const k of ['left', 'right', 'bottom'])
      expect(r.purpleOutside[k], `★${name}: 보라 ${k} 가 파란 밖이다 (${r.purpleOutside[k]})`).toBeLessThan(0.5);
  }
});

test('U3h ★손잡이는 ★사다리꼴을 ★따라간다 ＋★음성대조(축정렬은 ★두 변이 같다)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const t = await scene(page, TRAP);
  const a = await scene(page, AXIS);
  console.log('[U3h]', JSON.stringify({ trap: [t.topEdgeLen, t.botEdgeLen], axis: [a.topEdgeLen, a.botEdgeLen] }));
  /* ★★사다리꼴 : 윗변 < 아랫변 (★261025 실측 128 vs 160) */
  expect(t.topEdgeLen, `★사다리꼴인데 윗변이 아랫변보다 짧지 않다 (${t.topEdgeLen} vs ${t.botEdgeLen})`)
    .toBeLessThan(t.botEdgeLen - 5);
  /* ★★음성대조 — ★축정렬이면 ★두 변이 ★같다. ⛔없으면 「손잡이가 ★늘 사다리꼴」과 구분이 안 된다 */
  expect(Math.abs(a.topEdgeLen - a.botEdgeLen),
    `★축정렬인데 두 변이 다르다 (${a.topEdgeLen} vs ${a.botEdgeLen}) — 자가 헛돈다`).toBeLessThan(1);
});
