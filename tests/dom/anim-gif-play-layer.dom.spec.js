/* anim-gif-play-layer — NEW-현빈QA-GIF-PLAY-OVERLAY-LAYER-SIZE-01(현빈 실앱 QA 261116 · 스샷 #47).
 *   ⑴ «⏸ 단추가 너무 크지 않니? 에셋 ✕ 랑 비교» ⑵ 재생 덮개가 중앙 플로팅·우측 패널보다 위에 보인다 ⑶ 재생 중 그 블럭이 안 골라진다.
 *   원인(코드 읽기): 1판 덮개·단추 = body 직속 position:fixed z 2147483000 → #canvas-area 격리(우측 패널 z 9999 · 선택 테두리 층 #ss-handles-overlay z 9990) 밖 맨 위.
 *     ⑶ = 덮개 pe none 이라 클릭은 블럭에 닿지만 «고른 테두리(#ss-handles-overlay)»를 덮개가 덮어 안 골라진 것처럼 보인다(예측 — L3 이 잰다).
 *   ★잰다: 실제 텍스트 블럭 · 실제 모달 · 진짜 마우스(올림·▶ 클릭·블럭 클릭) · 실제 배율(applyZoom) · 실제 칠 순서(elementsFromPoint — 재는 동안만 pe auto).
 * L1 배율 40% · 75% 에서 ▶ 단추 크기 = 같은 배율의 에셋 ✕(.asset-overlay-clear) 크기 = 30 × 배율 · 자리 = 블럭 오른끝 − 40×배율 · 위 + 10×배율 · 단추·덮개 부모 = #canvas-scaler(#canvas 밖)
 * L2 재생 중 덮개를 화면 전체로 넓혀도 우측 패널 가운데에서 맨 위 = 패널(덮개 아님 · 캔버스 자르기·패널 아래)
 * L3 재생 중 블럭 진짜 클릭 → 블럭 골라짐 · 선택 테두리 층(#ss-handles-overlay)이 덮개보다 위(칠 순서) · 재생 계속(덮개 1)
 * L4(현빈 추가 · 같은 135행): ▶/⏸ 는 재생 중에도 «올렸을 때(또는 골랐을 때)만» — 안 고르고 마우스 뺌 = 숨김 · 덮개·재생은 계속(바퀴 늘어남) · 다시 올리면 ⏸
 * 양성대조(예측 · CTL 패치): js/animation-engine.js 를 1판(body · fixed · z 2147483000 · 화면 좌표 · 재생 중 늘 단추)으로 되돌림 → L1·L2·L3·L4 빨강 · 단위 E14 빨강 ·
 *   P3(같은 CTL 에서 «배율 ≠ 100%» 로 부트되면 빨강 — 부트 배율 미확인 · 예측만) · P1·P2·G1 초록(화면 사각형 비교라 층과 무관)
 * 셀렉터·전역 대조(제품 소스 grep): #anim-tb-play · #anim-canvas-play(animation-engine.js) · #canvas-scaler · #ss-handles-overlay · #panel-right(index.html) ·
 *   .asset-overlay-clear(css/editor-blocks.css 와 .anim-tb-play 같은 절) · .anim-item[data-id](_buildAnimList) · window.applyZoom(editor.js) · window.deselectAll ·
 *   window.addSection · window.selectSection · window.addTextBlock · window.openAnimModal · window.closeAnimModal
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body')).textContent = '쾅!';
    window.__tb = tb;
    window.openAnimModal(tb);
  });
  await page.click('#anim-gif-modal .anim-item[data-id="fade-in"]');
  await page.evaluate(() => window.closeAnimModal());
  expect(await page.evaluate(() => window.__tb.dataset.animFx), '[전제] 효과가 블럭에').toBe('fade-in');
  return errs;
}
/** 캔버스가 멈출 때까지(배율 transform 전환 0.15초 · 맞춤·스크롤) — 재고 나서 누르는 사이에 움직이면 좌표가 낡는다.
 *  수지맥(M4) 런에서 부트 직후 전환 중에 재 P3·L3 가 빨강(배율 0.4364 = 전환 중간값 · 아이맥 초록) — 창·배율에 안 기대게 «멈춤»을 먼저 본다. */
const settle = (page) => expect.poll(() => page.evaluate(() => new Promise((res) => {
  const s = document.getElementById('canvas-scaler'), r0 = window.__tb.getBoundingClientRect();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const r1 = window.__tb.getBoundingClientRect(), busy = (s.getAnimations ? s.getAnimations() : []).length;
    res(!busy && ['x', 'y', 'width', 'height'].every((k) => Math.abs(r0[k] - r1[k]) < 0.01));
  }));
})), { timeout: 10000, message: '[전제] 캔버스 배율·자리가 멈춤' }).toBe(true);
/** 블럭 화면 자리 + 배율 k(scaler 화면 폭 / 원래 폭) — 늘 멈춘 뒤에 잰다 */
const geo = async (page) => { await settle(page); return page.evaluate(() => {
  const r = window.__tb.getBoundingClientRect(), s = document.getElementById('canvas-scaler');
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, right: r.right, top: r.top, k: s.getBoundingClientRect().width / s.offsetWidth };
}); };
/** 같은 배율의 에셋 ✕ 크기 — 같은 CSS 절을 scaler 안에 잠깐 세워 잰다 */
const xSize = (page) => page.evaluate(() => {
  const b = document.createElement('button'); b.className = 'asset-overlay-clear'; document.getElementById('canvas-scaler').appendChild(b);
  const r = b.getBoundingClientRect(); b.remove(); return { w: r.width, h: r.height };
});

test('L1 ▶ 단추 = 에셋 ✕ 크기·배율 · 자리 · 캔버스 층', async ({ page }) => {
  const errs = await scene(page);
  const btn = page.locator('#anim-tb-play');
  for (const z of [40, 75]) {
    await page.evaluate((zz) => window.applyZoom(zz), z);
    await expect.poll(async () => Math.abs((await geo(page)).k - z / 100), { message: `[전제] 배율 ${z}% 적용` }).toBeLessThan(0.01);
    const g = await geo(page);
    await page.mouse.move(g.cx, g.cy);
    await expect(btn, `[전제] ${z}% GIF 블럭에 올리면 ▶`).toBeVisible();
    const bb = await btn.boundingBox(), x = await xSize(page);
    expect([Math.abs(bb.width - x.w) <= 0.5, Math.abs(bb.height - x.h) <= 0.5, Math.abs(bb.width - 30 * g.k) <= 0.5],
      `★${z}% 단추 ${bb.width.toFixed(1)}×${bb.height.toFixed(1)} vs 에셋 ✕ ${x.w.toFixed(1)}×${x.h.toFixed(1)} (30×${g.k.toFixed(2)})`).toEqual([true, true, true]);
    expect([Math.abs(bb.x - (g.right - 40 * g.k)) <= 1, Math.abs(bb.y - (g.top + 10 * g.k)) <= 1], `${z}% 자리(오른끝−40·위+10 캔버스px) — ${JSON.stringify(bb)}`).toEqual([true, true]);
  }
  await btn.click();
  await expect(page.locator('#anim-canvas-play'), '[전제] ▶ 로 재생').toHaveCount(1);
  expect(await page.evaluate(() => ['anim-tb-play', 'anim-canvas-play'].map((id) => { const e = document.getElementById(id); return [e.parentElement.id, !e.closest('#canvas')]; })),
    '★단추·덮개 = #canvas-scaler 층 · #canvas 밖(저장 0)').toEqual([['canvas-scaler', true], ['canvas-scaler', true]]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L2 재생 덮개는 패널 아래 — 화면 전체로 넓혀도 우측 패널이 위', async ({ page }) => {
  const errs = await scene(page);
  const g = await geo(page);
  await page.mouse.move(g.cx, g.cy);
  await page.click('#anim-tb-play');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  const r = await page.evaluate(() => {
    const cv = document.getElementById('anim-canvas-play'), p = document.getElementById('panel-right').getBoundingClientRect();
    const keep = cv.style.cssText;   // 한 evaluate 안(rAF 사이 없음) — 재고 바로 되돌린다
    Object.assign(cv.style, { pointerEvents: 'auto', left: '-20000px', top: '-20000px', width: '60000px', height: '60000px' });
    const hit = document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2);
    const out = { panelW: p.width, onPanel: !!(hit && hit.closest('#panel-right')), onOverlay: hit === cv };
    cv.style.cssText = keep;
    return out;
  });
  expect(r.panelW, '[전제] 우측 패널이 보인다').toBeGreaterThan(50);
  expect([r.onPanel, r.onOverlay], '★재생 덮개가 우측 패널 위로 뜬다').toEqual([true, false]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L3 재생 중 블럭 클릭 → 골라짐 · 선택 테두리가 덮개 위 · 재생 계속', async ({ page }) => {
  const errs = await scene(page);
  const g = await geo(page);
  await page.mouse.move(g.cx, g.cy);
  await page.click('#anim-tb-play');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  await page.evaluate(() => window.deselectAll());
  expect(await page.evaluate(() => window.__tb.classList.contains('selected')), '[전제] 안 골라진 채로 시작').toBe(false);
  const g3 = await geo(page);   // 누르기 직전에 다시 잰다(재생 시작·선택 해제 사이 캔버스가 움직였을 수 있다)
  await page.mouse.click(g3.cx, g3.cy);
  await expect.poll(() => page.evaluate(() => window.__tb.classList.contains('selected')), { message: `★재생 중 클릭으로 블럭이 안 골라진다 — 누른 곳 ${g3.cx.toFixed(1)},${g3.cy.toFixed(1)}` }).toBe(true);
  const order = await page.evaluate(([x, y]) => {
    const cv = document.getElementById('anim-canvas-play'), ov = document.getElementById('ss-handles-overlay');
    const k1 = cv.style.pointerEvents, k2 = ov.style.pointerEvents;
    cv.style.pointerEvents = 'auto'; ov.style.pointerEvents = 'auto';
    const list = document.elementsFromPoint(x, y);
    cv.style.pointerEvents = k1; ov.style.pointerEvents = k2;
    return { cv: list.indexOf(cv), ov: list.indexOf(ov), sel: (window.__selOverlay?.targets() || []).length };
  }, [g3.cx, g3.cy]);
  expect([order.cv >= 0, order.sel > 0], `[전제] 덮개가 그 자리 · 선택 테두리 대상 있음 — ${JSON.stringify(order)}`).toEqual([true, true]);
  expect(order.ov >= 0 && order.ov < order.cv, `★선택 테두리 층이 재생 덮개 아래(덮여서 안 골라진 것처럼 보인다) — ${JSON.stringify(order)}`).toBe(true);
  await expect(page.locator('#anim-canvas-play'), '클릭은 재생을 안 끝낸다').toHaveCount(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L4 재생 중에도 ▶/⏸ 는 올렸을 때만 — 빼면 숨김 · 재생 계속 · 다시 올리면 ⏸', async ({ page }) => {
  const errs = await scene(page);
  const g = await geo(page);
  await page.mouse.move(g.cx, g.cy);
  const btn = page.locator('#anim-tb-play');
  await btn.click();
  await expect(page.locator('#anim-canvas-play'), '[전제] ▶ 로 재생').toHaveCount(1);
  await page.evaluate(() => window.deselectAll());
  expect(await page.evaluate(() => window.__tb.classList.contains('selected')), '[전제] 안 골라짐').toBe(false);
  const away = await page.evaluate(() => { const w = document.getElementById('canvas-wrap').getBoundingClientRect(); return { x: w.left + 8, y: w.bottom - 8 }; });
  await page.mouse.move(away.x, away.y);
  await expect(btn, '★재생 중 마우스를 뺐는데 ⏸ 가 늘 떠 있다').toBeHidden();
  const l0 = await page.evaluate(() => Number(document.getElementById('anim-canvas-play').dataset.loops));
  await expect.poll(() => page.evaluate(() => Number(document.getElementById('anim-canvas-play')?.dataset.loops ?? -1)), { timeout: 15000, message: '★단추 숨김과 같이 재생이 멈췄다' }).toBeGreaterThan(l0);
  const g4 = await geo(page);
  await page.mouse.move(g4.cx, g4.cy);
  await expect(btn, '다시 올리면 보임').toBeVisible();
  await expect(btn).toHaveText('⏸');
  expect(errs, errs.join(' | ')).toEqual([]);
});
