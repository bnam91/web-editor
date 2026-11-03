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
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const AXIS = [[0, 0], [400, 0], [400, 120], [0, 120]];
const TRAP = [[40, 0], [360, 0], [400, 140], [0, 140]];

async function scene(page, corners, kind = 'body', lineHeight = '') {
  return await page.evaluate(async ([corners, kind, lineHeight]) => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast', 'deselectAll'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock(kind);
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'u3tb';
    if (lineHeight) (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-' + kind)).style.lineHeight = lineHeight;
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
    const st = ft.ftStateOf(tb);
    const measured = { W: st.W, H: st.H, OX: st.OX, OY: st.OY };
    const again = ft.ftMeasure(tb, true);
    return {
      glyph, blue, edge, measured, remeasuredOY: again.OY,
      kind: tb.querySelector('.tb-h1') ? 'h1' : 'other',
      zoom: window.currentZoom,
      handles: tb.querySelectorAll('.tfh-handle').length,
      topEdgeLen: hs.length === 4 ? +Math.hypot(hs[1][0] - hs[0][0], hs[1][1] - hs[0][1]).toFixed(1) : null,
      botEdgeLen: hs.length === 4 ? +Math.hypot(hs[2][0] - hs[3][0], hs[2][1] - hs[3][1]).toFixed(1) : null,
      /* ★양수 = ★보라가 ★파란 ★밖 */
      purpleOutside: (blue && edge) ? {
        top: +(blue.t - edge.t).toFixed(1), left: +(blue.l - edge.l).toFixed(1),
        right: +(edge.r - blue.r).toFixed(1), bottom: +(edge.b - blue.b).toFixed(1),
      } : null,
    };
  }, [corners, kind, lineHeight]);
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

/* ★★146(t8-01 · 현빈 신고의 참 장면) — 제목(h1)에서 윗면이 밖이다(판 b267c6f2 줌 100 +5.2). ⛔U2 는 body 라 못 봤다.
   ★줌 셋 = 현빈 실사용 40 ＋ 60·100 · 전제로 배율을 단언한다(시트 210). */
for (const zoom of [40, 60, 100]) {
  test(`U2h ★★h1 — 보라가 파란 안이다(줌 ${zoom} · 축정렬·사다리꼴)`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1200 });
    await bootApp(page);
    await page.evaluate((z) => window.applyZoom(z), zoom);
    await waitZoomSettled(page, zoom);
    for (const [name, C] of [['axis', AXIS], ['trap', TRAP]]) {
      const r = await scene(page, C, 'h1');
      console.log(`[U2h:${zoom}:${name}]`, JSON.stringify({ out: r.purpleOutside, OY: r.measured.OY, edge: r.edge, blue: r.blue }));
      expect(r.kind, '전제: 제목 블럭이 섰다').toBe('h1');
      expect(r.zoom, '전제: 배율이 실제로 걸렸다').toBe(zoom);
      expect(r.measured.OY, '전제: 이 장면은 «글꼴 상자가 줄 상자 위로 넘치는» h1 이다').toBeLessThan(0);
      for (const k of ['top', 'left', 'right', 'bottom'])
        expect(r.purpleOutside[k], `★${zoom}%·${name}: 보라 ${k} 가 파란 밖이다 (${r.purpleOutside[k]} 화면 px)`).toBeLessThan(0.5);
    }
  });
}

test('U2n ★음성대조 — 파란 윗변은 «걸린 h1» 에서만 오른다: 안 건 h1·body·✕ 뒤는 글상자 윗변 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  await waitZoomSettled(page, await page.evaluate(() => window.currentZoom));   // 첫 배율 전환 중에 재면 gap 이 -1.5~-2.46 으로 흔들린다(멎으면 -2.12)
  const r = await page.evaluate(async () => {
    const ft = await import('/js/effects-freetransform.js');
    const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const gap = async (kind, on) => {
      const canvas = document.getElementById('canvas');
      canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
      await window.addSection();
      const sec = [...canvas.querySelectorAll('.section-block')].pop();
      window.getSelectedSection = () => sec; window._activeFrame = null;
      await window.addTextBlock(kind);
      const tb = [...sec.querySelectorAll('.text-block')].pop();
      tb.id = 'u3n';
      if (on) ft.setFxFreeTransform(tb, [[40, 0], [360, 0], [400, 140], [0, 140]], { history: false });
      window.selectBlock?.(tb.id);
      await frames();
      const blueTop = () => document.querySelector('#ss-handles-overlay svg.ss-sel-layer path.ss-sel-path').getBoundingClientRect().top;
      const out = { gap: blueTop() - tb.getBoundingClientRect().top };
      if (on) { ft.setFxFreeTransform(tb, null, { history: false }); await frames(); out.afterX = blueTop() - tb.getBoundingClientRect().top; }
      return out;
    };
    return { h1On: await gap('h1', true), h1Off: await gap('h1', false), bodyOn: await gap('body', true) };
  });
  console.log('[U2n]', JSON.stringify(r));
  expect(r.h1On.gap, '★양성: 걸린 h1 은 파란 윗변이 글상자 위로 오른다').toBeLessThan(-2);
  expect(Math.abs(r.h1On.afterX), '✕ 뒤엔 글상자 윗변으로 돌아온다').toBeLessThan(1.5);
  expect(Math.abs(r.h1Off.gap), '안 건 h1 은 글상자 윗변 그대로').toBeLessThan(1.5);
  expect(Math.abs(r.bodyOn.gap), '걸린 body(OY 양수) 는 글상자 윗변 그대로').toBeLessThan(1.5);
});

test('U2c ★뿌리 — h1 OY 음수는 줄간격이 만든다(캐시 아님): 다시 재도 같고 · 줄간격을 넓히면 양수', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const tight = await scene(page, TRAP, 'h1');
  const loose = await scene(page, TRAP, 'h1', '1.6');
  console.log('[U2c]', JSON.stringify({ tight: tight.measured, again: tight.remeasuredOY, loose: loose.measured }));
  expect(Math.abs(tight.remeasuredOY - tight.measured.OY), '★force 로 다시 재면 달라진다 — 캐시가 뿌리다').toBeLessThan(0.01);
  expect(tight.measured.OY).toBeLessThan(0);
  expect(loose.measured.OY, '★줄간격 1.6 에서도 음수다 — 줄간격이 뿌리가 아니다').toBeGreaterThan(0);
});

/* ★★147(t8-02) — 자유변형 중 Enter: 보라·격자가 따라오나. ★두 값을 나란히(전·후) · 전제 단언 · 조건 대기(rAF 두 번). */
async function enterScene(page, kind, zoom, touched) {
  await page.evaluate((z) => window.applyZoom(z), zoom);
  await waitZoomSettled(page, zoom);
  await page.evaluate(async ([kind, touched, TRAP]) => {
    for (const k of ['showToast']) if (typeof window[k] !== 'function') window[k] = () => {};
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock(kind);
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'u4tb';
    tb.querySelector('[contenteditable]').textContent = '첫 줄';
    if (touched) ft.setFxFreeTransform(tb, TRAP, { history: false, touched: true });
    else ft.resetFxFreeTransform(tb, { history: false });
    window.selectBlock?.(tb.id);
    tb.scrollIntoView({ block: 'center' });
    window.__u4read = () => {
      const R = (el) => { const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
      const ce = tb.querySelector('[contenteditable]');
      const rng = document.createRange(); rng.selectNodeContents(ce);
      const st = ft.ftStateOf(tb);
      return { edge: R(tb.querySelector('.tfh-edge')), grid: R(tb.querySelector('.tfh-grid')), glyph: R(rng), H: st.H, W: st.W, corners: tb.dataset.tfCorners, touched: st.touched, editing: tb.classList.contains('editing'), text: ce.innerText };
    };
  }, [kind, touched, TRAP]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const box = await page.locator('#u4tb').boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => document.getElementById('u4tb').classList.contains('editing'));
  await page.evaluate(() => { const sel = getSelection(); sel.selectAllChildren(document.querySelector('#u4tb [contenteditable]')); sel.collapseToEnd(); });
}
const read2 = async (page) => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(() => window.__u4read());
};

for (const [kind, zoom] of [['body', 100], ['h1', 100], ['body', 40], ['h1', 40]]) {
  test(`U4 ★★안 만진 글상자 Enter — 보라·격자가 새 줄을 덮는다(${kind} · 줌 ${zoom})`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1200 });
    await bootApp(page);
    await enterScene(page, kind, zoom, false);
    const a = await read2(page);
    expect(a.editing, '전제: 편집 중이다').toBe(true);
    expect(a.touched, '전제: 안 만진 글상자다').toBe(false);
    /* ★음성 — Enter 전엔 다시 읽어도 안 변한다 */
    const a2 = await read2(page);
    expect(Math.abs((a2.edge.b - a2.edge.t) - (a.edge.b - a.edge.t)), '★음성: Enter 를 안 눌렀는데 보라 높이가 변했다').toBeLessThan(0.1);
    await page.keyboard.press('Enter');
    await page.keyboard.type('둘째');
    await page.keyboard.press('Enter');
    await page.keyboard.type('셋째');
    const b = await read2(page);
    console.log(`[U4:${kind}:${zoom}]`, JSON.stringify({ H: [a.H, b.H], edgeB: [a.edge.b, b.edge.b], gridB: [a.grid.b, b.grid.b], glyphB: [a.glyph.b, b.glyph.b] }));
    expect(b.text, '전제: 글이 이어 쳐졌다(caret 안 잃음)').toMatch(/첫 줄[\s\S]*둘째[\s\S]*셋째/);
    /* ★핀 재현 없음 · 고침 1판의 결함 — Enter 뒤 W 가 블록 폭(796)으로 부풀었다. 이 글의 가장 긴 줄은 «첫 줄»이다 */
    expect(Math.abs(b.W - a.W), `★상자 폭이 글자보다 부풀었다 (W ${a.W} → ${b.W})`).toBeLessThan(1);
    expect(b.H, '★다시 안 쟀다 — H 그대로').toBeGreaterThan(a.H * 1.5);
    for (const k of ['l', 't', 'r', 'b']) {
      expect(Math.abs(b.edge[k] - b.glyph[k]), `★보라 ${k} 가 글자 상자와 어긋난다`).toBeLessThan(1.5);
      expect(Math.abs(b.grid[k] - b.edge[k]), `★격자 ${k} 가 보라와 어긋난다`).toBeLessThan(0.1);
    }
  });
}

test('U4t ★음성대조 — 옛 파일(tfSchema 없음)의 만진 사다리꼴은 Enter 에 네 점·잰 값을 안 건드린다(새 파일은 ft-touched-enter-keeps-text)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  await enterScene(page, 'body', 100, true);
  await page.evaluate(() => { delete document.getElementById('u4tb').dataset.tfSchema; });
  const a = await read2(page);
  expect(a.touched, '전제: 만진 글상자다').toBe(true);
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째');
  const b = await read2(page);
  console.log('[U4t]', JSON.stringify({ H: [a.H, b.H], corners: [a.corners, b.corners] }));
  expect(b.corners).toBe(a.corners);
  expect(b.H).toBe(a.H);
});

/* ★J146B ⒜ — 안 만진 여러 줄의 첫 끌기: 네 점은 글자 폭 기준인데 W 만 Range 폭으로 바뀌면 글자가 짓눌린다.
   자 = 글자 «노드» 합집합 폭(⛔Range 전체 상자는 div 줄 폭을 잡아 짓눌림을 못 본다). */
async function firstDrag(page, kind, zoom, lines) {
  await enterScene(page, kind, zoom, false);
  for (let i = 1; i < lines; i++) { await page.keyboard.press('Enter'); await page.keyboard.type('줄' + i); }
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    window.__ink = () => {
      const tb = document.getElementById('u4tb'); const ce = tb.querySelector('[contenteditable]');
      const r = document.createRange(); const w = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT); let lo = Infinity, hi = -Infinity;
      for (let n = w.nextNode(); n; n = w.nextNode()) { r.selectNodeContents(n); const q = r.getBoundingClientRect(); if (q.width > 0) { lo = Math.min(lo, q.left); hi = Math.max(hi, q.right); } }
      return { ink: hi - lo, lines: ce.children.length, W: window.ftStateOf(tb).W, corners: tb.dataset.tfCorners };
    };
    if (!document.getElementById('u4tb').classList.contains('selected')) window.selectBlock?.('u4tb');
  });
  const handle = page.locator('#u4tb .tfh-handle[data-tfh="nw"]');
  await handle.waitFor();
  await read2(page);
  const a = await page.evaluate(() => window.__ink());
  const h = await handle.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 10, h.y + h.height / 2);
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('u4tb').dataset.tfTouched === '1');
  await read2(page);
  return { a, b: await page.evaluate(() => window.__ink()) };
}
for (const [kind, zoom] of [['body', 100], ['h1', 100], ['body', 40], ['h1', 40]]) {
  test(`U6 ★★안 만진 여러 줄 첫 끌기 — 글자가 안 짓눌린다(${kind} · 줌 ${zoom})`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1200 });
    await bootApp(page);
    const { a, b } = await firstDrag(page, kind, zoom, 3);
    console.log(`[U6:${kind}:${zoom}]`, JSON.stringify({ a, b }));
    expect(a.lines, '전제: Enter 로 줄이 갈렸다').toBeGreaterThan(1);
    expect(b.corners, '전제: 끌기가 네 점을 바꿨다').not.toBe(a.corners);
    expect(b.ink, `★글자가 짓눌렸다 (${a.ink} → ${b.ink})`).toBeGreaterThan(a.ink * 0.8);
    expect(Math.abs(b.W - a.W), `★잰 폭이 뛰었다 (W ${a.W} → ${b.W})`).toBeLessThan(1);
    /* 다시 열어도 같은 그림 — 저장본 그대로 갈아끼우고 복원 길로 */
    await page.evaluate(() => { const s = document.getElementById('u4tb').closest('.section-block'); s.outerHTML = s.outerHTML; window.rebindAll?.(); });
    await page.waitForFunction(() => window.ftStateOf(document.getElementById('u4tb'))?.W > 0);
    const c = await page.evaluate(() => window.__ink());
    expect(Math.abs(c.ink - b.ink), `★다시 열면 그림이 변한다 (${b.ink} → ${c.ink})`).toBeLessThan(1.5);
  });
}
test('U6n ★음성대조 — 한 줄 첫 끌기는 원래 안 짓눌린다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const { a, b } = await firstDrag(page, 'body', 100, 1);
  expect(a.lines, '전제: 한 줄').toBe(0);
  expect(b.corners).not.toBe(a.corners);
  expect(b.ink).toBeGreaterThan(a.ink * 0.8);
  expect(Math.abs(b.W - a.W)).toBeLessThan(1);
});
test('U6o ★음성대조 — 옛 만진 파일(박힌 폭 ≈ Range 폭)은 Range 폭 그대로 잰다(네 점이 그 W 기준)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  await enterScene(page, 'body', 100, true);
  await page.keyboard.press('Escape');
  const r = await page.evaluate(async () => {
    const ft = await import('/js/effects-freetransform.js');
    const tb = document.getElementById('u4tb'); const ce = tb.querySelector('[contenteditable]');
    ce.innerHTML = '<div>첫 줄</div><div>둘째</div><div>셋째</div>'; ce.style.width = '';
    ft.applyFxFreeTransform(tb); const W1 = ft.ftStateOf(tb).W; const pinned = ce.style.width;
    ft.applyFxFreeTransform(tb); return { W1, pinned, W2: ft.ftStateOf(tb).W, touched: tb.dataset.tfTouched };
  });
  console.log('[U6o]', JSON.stringify(r));
  expect(r.touched, '전제: 만진 글상자').toBe('1');
  expect(r.W1, '전제: 옛 자는 블록 폭을 잡는다').toBeGreaterThan(300);
  expect(parseFloat(r.pinned), '전제: 박힌 폭 ≈ Range 폭').toBeGreaterThan(300);
  expect(r.W2).toBe(r.W1);
});

/* ★J146B ⒝ — 패딩 위 값 글상자: 보라·격자·손잡이가 글자에서 패딩만큼 어긋난다. 패널 입력으로 값을 넣는다. */
async function padScene(page, kind, zoom, pad, side = 'v') {
  await page.evaluate((z) => window.applyZoom(z), zoom);
  await waitZoomSettled(page, zoom);
  await scene(page, TRAP, kind);
  await page.evaluate(([pad, side]) => {
    const tb = document.getElementById('u3tb'); tb.scrollIntoView({ block: 'center' });
    if (side === 'redraw') { tb.style.paddingTop = pad + 'px'; window.applyFxFreeTransform?.(tb); return; }   /* 패널 말고 다시 그리는 길(복원·글 입력) */
    const n = document.getElementById(side === 'l' ? 'txt-pl-number' : 'txt-pv-number'); n.value = pad; n.dispatchEvent(new Event('input', { bubbles: true }));
  }, [pad, side]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(() => {
    const tb = document.getElementById('u3tb'); const R = (e) => e.getBoundingClientRect();
    const g = document.createRange(); g.selectNodeContents(tb.querySelector('[contenteditable]'));
    const nw = R(tb.querySelector('.tfh-handle[data-tfh="sw"]'));
    return { edge: R(tb.querySelector('.tfh-edge')).toJSON(), grid: R(tb.querySelector('.tfh-grid')).toJSON(), glyph: g.getBoundingClientRect().toJSON(), tb: R(tb).toJSON(), blue: R(document.querySelector('#ss-handles-overlay svg.ss-sel-layer path.ss-sel-path')).toJSON(), sw: [nw.left + nw.width / 2, nw.top + nw.height / 2], pad: getComputedStyle(tb).paddingTop, padL: getComputedStyle(tb).paddingLeft };
  });
}
for (const [kind, zoom] of [['h1', 100], ['body', 100], ['h1', 40], ['body', 40]]) {
  test(`U7 ★★패딩 40 — 보라·격자·손잡이가 글자에 붙는다(${kind} · 줌 ${zoom})`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1200 });
    await bootApp(page);
    const r = await padScene(page, kind, zoom, 40);
    console.log(`[U7:${kind}:${zoom}]`, JSON.stringify({ top: r.edge.top - r.glyph.top, bottom: r.edge.bottom - r.glyph.bottom, blueTop: r.blue.top - r.tb.top }));
    expect(r.pad, '전제: 패널 입력이 먹었다').toBe('40px');
    for (const k of ['top', 'bottom', 'left', 'right']) {
      expect(Math.abs(r.edge[k] - r.glyph[k]), `★보라 ${k} 가 글자에서 어긋난다`).toBeLessThan(1.5);
      expect(Math.abs(r.grid[k] - r.edge[k]), `★격자 ${k} 가 보라와 어긋난다`).toBeLessThan(0.1);
    }
    expect(Math.abs(r.sw[1] - r.edge.bottom), '★손잡이가 보라에서 어긋난다').toBeLessThan(1.5);
    expect(Math.abs(r.blue.top - r.tb.top), '★패딩이 받는데 파란 윗변이 올랐다').toBeLessThan(1.5);
  });
}
test('U7l ★왼쪽 패딩 30 — 보라가 글자에 붙는다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const r = await padScene(page, 'h1', 100, 30, 'l');
  expect(r.padL, '전제').toBe('30px');
  expect(Math.abs(r.edge.left - r.glyph.left), '★보라 left 가 글자에서 어긋난다').toBeLessThan(1.5);
});
test('U7r ★패딩 뒤 다시 그려도(복원·글 입력 길) 보라가 글자에 붙는다', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const r = await padScene(page, 'h1', 100, 40, 'redraw');
  expect(r.pad, '전제').toBe('40px');
  expect(Math.abs(r.edge.top - r.glyph.top), '★보라 top 이 글자에서 어긋난다').toBeLessThan(1.5);
});
test('U7n ★음성대조 — 패딩 0 은 전과 같다(보라 = 글자)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await bootApp(page);
  const r = await padScene(page, 'h1', 100, 0);
  expect(r.pad).toBe('0px');
  for (const k of ['top', 'bottom', 'left', 'right']) expect(Math.abs(r.edge[k] - r.glyph[k])).toBeLessThan(1.5);
});
