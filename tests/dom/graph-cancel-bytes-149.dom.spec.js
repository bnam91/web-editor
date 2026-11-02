/* graph-cancel-bytes-149.dom.spec.js — 149 GRAPH-ESC-AFTER-LOAD-REWRITES-BYTES-01
 *
 * 원문(시트 149): 로드한 그래프 블럭을 더블클릭해 편집에 들어간 뒤 Esc 로 빠지면 다시 그려져 저장 바이트가 움직인다.
 * 저장본 꼴 ≠ 렌더러 꼴을 표식(data-saved-form)으로 세운다 — 다시 그리면 표식이 사라지므로 «다시 그렸나»를 바이트로 잰다.
 *
 * 칸
 *   C1 라벨 더블클릭 → Esc ⇒ 저장 바이트 같음 · 이력 같음 · 편집 흔적 0 (종류 넷)
 *   C2 값 라벨 · 새 꼴 축 눈금 → Esc ⇒ 저장 바이트 같음
 *   C3 (지키는 칸) Esc 뒤 다시 더블클릭 ⇒ 편집이 또 열린다(바인더 산다) · 고쳐 확정 ⇒ 값 바뀜 · ⌘Z 로 돌아옴
 *   C4 같은 글자로 확정(blur) ⇒ 바이트 같음
 * 대조: 고침만 되돌리면 C1·C2·C4 빨강, C3 은 초록(바인더 칸은 고침과 무관하게 서야 한다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-cancel-bytes-149.dom.spec.js --repeat-each=3 --workers=1 --retries=0
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const LABEL_SEL = { 'bar-v': '.grb-bar-label', 'bar-h': '.grb-bar-h-desc', line: '.grb-line-xlabel', pie: '.grb-pie-label' };

async function setup(page, chartType, extra = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([chartType, extra]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    Object.assign(g.dataset, extra); window.renderGraph(g);
    /* 저장본 꼴 — 렌더러가 안 쓰는 표식을 안쪽 요소에 박는다. 다시 그리면 사라진다. */
    g.querySelectorAll('*').forEach(el => el.setAttribute('data-saved-form', '1'));
    window.deselectAll?.(); g.scrollIntoView({ block: 'center' });
    window.pushHistory?.('전제');
    return g.id;
  }, [chartType, extra]);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  return { errs, id };
}
const stablePt = (page, id, sel, i) => page.evaluate(([id, sel, i]) => new Promise((res) => {
  let last = null, same = 0, n = 0;
  const tick = () => { const e = document.getElementById(id).querySelectorAll(sel)[i]; const r = e.getBoundingClientRect(); const k = Math.round(r.left) + ',' + Math.round(r.top);
    same = k === last ? same + 1 : 0; last = k; n++;
    if (same >= 5 || n > 120) res({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, stable: same >= 5 }); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), [id, sel, i]);
const S = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id);
  return { bytes: window.getSerializedCanvas(), hist: window.historyStack.length, editing: g.classList.contains('editing'), ce: g.querySelectorAll('[contenteditable]').length, kept: g.querySelectorAll('[data-saved-form]').length, focusInside: g.contains(document.activeElement) };
}, id);

async function openEdit(page, id, sel, i = 0) {
  const b = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 8 }; }, id);
  await page.mouse.click(b.x, b.y);
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id, { timeout: 3000 });
  const p = await stablePt(page, id, sel, i);
  expect([p.stable, p.w > 0], '전제: 대상이 보이고 멈췄다').toEqual([true, true]);
  await page.mouse.dblclick(p.x, p.y);
  await page.waitForFunction((id) => !!document.getElementById(id).querySelector('[contenteditable="true"]'), id, { timeout: 3000 });
}

for (const type of Object.keys(LABEL_SEL)) {
  test(`C1 ${type} 라벨 더블클릭 → Esc ⇒ 저장 바이트 같음`, async ({ page }) => {
    const { errs, id } = await setup(page, type, type === 'pie' ? { showLegend: '1' } : {});
    const s0 = await S(page, id);
    expect(s0.kept > 0, '전제: 표식이 박혔다').toBe(true);
    await openEdit(page, id, LABEL_SEL[type]);
    await page.keyboard.press('Escape');
    await page.waitForFunction((id) => !document.getElementById(id).classList.contains('editing'), id, { timeout: 3000 });
    const s1 = await S(page, id);
    expect(s1.bytes === s0.bytes, 'C1 저장 바이트').toBe(true);
    expect({ hist: s1.hist, ce: s1.ce, editing: s1.editing, kept: s1.kept, focusInside: s1.focusInside }, 'C1 이력·편집 흔적').toEqual({ hist: s0.hist, ce: s0.ce, editing: false, kept: s0.kept, focusInside: false });
    expect(errs).toEqual([]);
  });
}

test('C2 값 라벨 → Esc ⇒ 저장 바이트 같음', async ({ page }) => {
  const { errs, id } = await setup(page, 'line', { showVLabel: '1' });
  const s0 = await S(page, id);
  await openEdit(page, id, '.grb-line-vlabel');
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('editing'), id, { timeout: 3000 });
  const s1 = await S(page, id);
  expect(s1.bytes === s0.bytes, 'C2 값 라벨 저장 바이트').toBe(true);
  expect(errs).toEqual([]);
});

test('C2 새 꼴 축 눈금 → Esc ⇒ 저장 바이트 같음', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v', { showAxis: '1' });
  const s0 = await S(page, id);
  await openEdit(page, id, '.grb-ov-tick[data-grb-tick]', 1);
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('editing'), id, { timeout: 3000 });
  const s1 = await S(page, id);
  expect(s1.bytes === s0.bytes, 'C2 눈금 저장 바이트').toBe(true);
  expect(errs).toEqual([]);
});

test('C3 Esc 뒤 다시 열림 · 고쳐 확정 ⇒ 값 바뀜 · ⌘Z 로 돌아옴', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  const sel = LABEL_SEL['bar-v'];
  await openEdit(page, id, sel);
  await page.keyboard.press('Escape');
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('editing'), id, { timeout: 3000 });
  const label0 = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items)[0].label, id);
  await openEdit(page, id, sel);
  await page.keyboard.press('Meta+a'); await page.keyboard.type('새글'); await page.keyboard.press('Meta+Enter');
  await page.waitForFunction((id) => JSON.parse(document.getElementById(id).dataset.items)[0].label === '새글', id, { timeout: 3000 });
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(([id, l]) => JSON.parse(document.getElementById(id)?.dataset.items || '[]')[0]?.label === l, [id, label0], { timeout: 5000 });
  expect(errs).toEqual([]);
});

test('C4 같은 글자로 확정(blur) ⇒ 저장 바이트 같음', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  const s0 = await S(page, id);
  await openEdit(page, id, LABEL_SEL['bar-v']);
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForFunction((id) => !document.getElementById(id).classList.contains('editing'), id, { timeout: 3000 });
  const s1 = await S(page, id);
  expect(s1.bytes === s0.bytes, 'C4 저장 바이트').toBe(true);
  expect(errs).toEqual([]);
});

/* L — lazy 패스(화면 밖 섹션 배경 내리기)가 색 전용 줄임 background 를 CSSOM 꼴로 다시 쓰던 것. 앱 실측 = 점 5개 2588 → 2653(점당 13자).
 *   L1 색 전용: 스크롤로 나갔다 와도 data-lazy-bg 0 · 저장 바이트 같음
 *   L2 (지키는 칸) 진짜 이미지: 여전히 내린다(data-lazy-bg 에 보관) · 저장본에 url 이 남는다 */
async function lazySetup(page, innerHtml) {
  await page.setViewportSize({ width: 1500, height: 900 });
  const errs = await bootApp(page);
  await page.evaluate((innerHtml) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    const sec = (id, body) => `<div class="section-block" id="${id}" data-section="1"><div class="section-hitzone"></div><div class="section-inner">${body}</div></div>`;
    c.insertAdjacentHTML('beforeend', sec('sNear', innerHtml) + sec('sGap', '<div class="gap-block" data-type="gap" style="height:12000px"></div>') + sec('sFar', '<div class="gap-block" id="farMark" data-type="gap" style="height:40px"></div>'));
    window.rebindAll?.(); window.applyZoom?.(100);
    window.initLazySections(); window.refreshLazyObservation();
  }, innerHtml);
  return errs;
}
const goAway = async (page) => {
  await page.evaluate(() => document.getElementById('farMark').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => document.getElementById('sNear').classList.contains('lazy-unloaded'), null, { timeout: 5000 });
};

test('L1 색 전용 줄임 background ⇒ 나갔다 와도 저장 바이트 같음', async ({ page }) => {
  const errs = await lazySetup(page, '<div id="dot" style="background:#e65004;opacity:1;width:9px;height:9px"></div>');
  const b0 = await page.evaluate(() => window.getSerializedCanvas());
  await goAway(page);
  expect(await page.evaluate(() => document.getElementById('dot').getAttribute('data-lazy-bg')), 'L1 안 내린다').toBe(null);
  const b1 = await page.evaluate(() => window.getSerializedCanvas());
  expect(b1 === b0, 'L1 나간 동안 저장 바이트').toBe(true);
  await page.evaluate(() => document.getElementById('dot').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => !document.getElementById('sNear').classList.contains('lazy-unloaded'), null, { timeout: 5000 });
  expect(await page.evaluate(() => document.getElementById('dot').getAttribute('style')), 'L1 돌아와도 원문 꼴').toBe('background:#e65004;opacity:1;width:9px;height:9px');
  expect(errs).toEqual([]);
});

test('L2 진짜 이미지 ⇒ 여전히 내리고 저장본엔 url 이 남는다', async ({ page }) => {
  const errs = await lazySetup(page, '<div id="img" style="background-image:url(a.png);width:9px;height:9px"></div>');
  await goAway(page);
  const s = await page.evaluate(() => { const e = document.getElementById('img'); return { lazy: e.getAttribute('data-lazy-bg'), live: e.style.backgroundImage, saved: window.getSerializedCanvas().includes('a.png') }; });
  expect(s.lazy, 'L2 보관').toContain('a.png');
  expect(s.live, 'L2 라이브는 내림').toBe('none');
  expect(s.saved, 'L2 저장본에 url').toBe(true);
  expect(errs).toEqual([]);
});
