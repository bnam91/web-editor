/* graph-bar-thickness-limit — 막대 두께 «60» (B7-b, 2026-10-03 현빈 「60까지 되어야해」; UserLens: 60 을 쳐도 조용히 48 로 잘렸다)
 * 한계는 js/graph-limits.js «한 자리». 여기선 «사람이 쓰는 길 넷»을 따로 재고, 셋 폼(bar-h 가로 · bar-v 세로 · bar-pair 비교)에 건다.
 *   T1 range  — 슬라이더에 실제 키(End)·실제 마우스 끌기 → 60
 *   T2 number — 숫자칸에 «타자»로 60 → 60 / 61·999 → 60(자른다, 알림 UI 는 UX1 로 미룸) / 7 → 8(아래쪽 한계는 그대로)
 *   T3 clamp  — 위 둘이 거치는 applyBarThickness 클램프: 슬라이더·숫자칸 «표시값»도 60 으로 되돌아온다(칸이 999 를 들고 있지 않다)
 *   T4 api    — window.updateGraphBlock({barThickness}) : 60 통과 / 61·999 는 INVALID 로 «거절»(API 는 자르지 않는다 — 원래 동작) · 가로 키만(세로 키는 API 에 없다)
 * 전제 단언(첫 줄): 패널이 «떴고» 칸이 «보이며» 시작값이 60 이 아니다 — 아니면 아래 60 은 «처음부터 참»이다.
 * 렌더 확인: 값이 dataset 에만 있고 그림에 안 닿으면 의미 없다 ⇒ 막대 실제 크기(offsetHeight/Width)도 60.
 * 양성대조: GD1001_ROOT=<37ab1c65 체크아웃> 으로 돌리면 «60 → 60» 류가 빨강(48)이어야 한다.
 * ★H1(2026-10-05 현빈 「세로그래프 두께 60 → 더」): 세로·비교(bar-v · bar-pair)의 위 끝 = «그 막대가 선 칸의 폭»(GRAPH_LIMITS.BAR_THICKNESS_V_MAX 'column').
 *   가로(bar-h)는 60 그대로. 아래 T1·T3 의 «60» 은 폼별 상한 cap(가로 60 · 세로·비교 = 칸 폭)으로 «뒤집었다» — 뒤집은 것이 고친 증거(새 계약 시험 graph-e1). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const FORMS = [
  { type: 'bar-h', key: 'barThickness', fill: '.grb-bar-h-track' },
  { type: 'bar-v', key: 'vBarThickness', fill: '.grb-bar-fill' },
  { type: 'bar-pair', key: 'vBarThickness', fill: '.grb-bar-fill' },
];
const ITEMS = [{ label: '가', value: 40, value2: 30 }, { label: '나', value: 80, value2: 60 }, { label: '다', value: 20, value2: 10 }];

async function setup(page, type) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(({ type, items }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="tS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;"></div></div>');
    const { row, block } = window.makeGraphBlock(); block.id = 'tg';
    block.dataset.chartType = type; block.dataset.items = JSON.stringify(items);
    document.querySelector('#tS .section-inner').appendChild(row);
    window.renderGraph(block); window.rebindAll?.(); window.deselectAll?.();
    window.showGraphProperties(block);
  }, { type, items: ITEMS });
  await page.waitForTimeout(250);
  return errs;
}
/** 전제 — 패널이 떴고 칸이 보이고 시작값이 60 이 아니다. */
async function premise(page, f) {
  const num = page.locator('#grb-bar-thickness-number'), sl = page.locator('#grb-bar-thickness-slider');
  await expect(num, '숫자칸이 안 떴다 — 아래 전부 헛것').toBeVisible();
  await expect(sl, '슬라이더가 안 떴다').toBeVisible();
  const r = await page.evaluate(({ key }) => { const b = document.getElementById('tg'); return { ds: b.dataset[key], n: document.getElementById('grb-bar-thickness-number').value }; }, f);
  expect(r.ds, '시작부터 키가 있다').toBeUndefined();
  expect(r.n, '시작값이 이미 60 이면 「60 → 60」은 처음부터 참').not.toBe('60');
  return { num, sl };
}
/** 폼의 위 끝 — 가로 60 · 세로·비교 = 막대가 선 칸(막대의 부모)의 그려진 폭(H1). */
const capOf = (page, f) => f.type === 'bar-h' ? Promise.resolve(60)
  : page.evaluate(() => Math.floor(document.querySelector('#tg .grb-bar-fill').parentElement.clientWidth));
const state = (page, f) => page.evaluate(({ key, fill, type }) => {
  const b = document.getElementById('tg'); const e = b.querySelector(fill);
  return { ds: b.dataset[key], num: document.getElementById('grb-bar-thickness-number').value, sl: document.getElementById('grb-bar-thickness-slider').value,
    px: type === 'bar-h' ? e.offsetHeight : e.offsetWidth, other: type === 'bar-h' ? b.dataset.vBarThickness : b.dataset.barThickness };
}, { key: f.key, fill: f.fill, type: f.type });

for (const f of FORMS) {
  test(`T1 range [${f.type}] 슬라이더 End 키 → 위 끝(가로 60 · 세로·비교 칸 폭)`, async ({ page }) => {
    const errs = await setup(page, f.type); const { sl } = await premise(page, f);
    const cap = await capOf(page, f);
    await sl.focus(); await page.keyboard.press('End');
    const s = await state(page, f);
    /* 슬라이더 step 2(min 8) — 홀수 칸 폭(예 245)이면 End 는 244 에 앉는다. 막대·칸은 그 값과 같아야 한다. */
    expect(Math.abs(+s.ds - cap), `dataset ${s.ds} ≈ cap ${cap}`).toBeLessThanOrEqual(1); expect(s.px, '그림 속 막대 크기 = 키').toBe(+s.ds); expect(s.num).toBe(s.ds);
    expect(Math.abs(+s.sl - cap), `슬라이더(step 2 라 홀수 cap 은 1 아래로 앉을 수 있다) ${s.sl}`).toBeLessThanOrEqual(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });
  test(`T1 range [${f.type}] 슬라이더를 오른쪽 끝 «너머»로 끌기 → 위 끝`, async ({ page }) => {
    const errs = await setup(page, f.type); const { sl } = await premise(page, f);
    const cap = await capOf(page, f);
    const bb = await sl.boundingBox();
    await page.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height / 2); await page.mouse.down();
    await page.mouse.move(bb.x + bb.width + 80, bb.y + bb.height / 2, { steps: 8 }); await page.mouse.up();
    const s = await state(page, f);
    expect(Math.abs(+s.ds - cap), `끌기 끝 = 위 끝(슬라이더 step 2) ds=${s.ds} cap=${cap}`).toBeLessThanOrEqual(1); expect(Math.abs(s.px - cap)).toBeLessThanOrEqual(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });
  test(`T2 number [${f.type}] 60 을 타자로 → 60`, async ({ page }) => {
    const errs = await setup(page, f.type); const { num } = await premise(page, f);
    await num.fill('60'); await num.press('Tab');
    const s = await state(page, f);
    expect(s.ds).toBe('60'); expect(s.px).toBe(60); expect(s.num).toBe('60');
    expect(s.other, '가로/세로 키가 섞여 들어갔다').toBeUndefined();
    expect(errs, errs.join('\n')).toEqual([]);
  });
  for (const v of ['61', '999']) test(`T3 clamp [${f.type}] 숫자칸에 ${v} → 위 끝(가로 60 · 세로·비교 칸 폭 — 61 은 칸 안이면 그대로)`, async ({ page }) => {
    const errs = await setup(page, f.type); const { num } = await premise(page, f);
    const cap = await capOf(page, f), want = Math.min(+v, cap);
    await num.fill(v); await num.press('Tab');
    const s = await state(page, f);
    expect(s.ds, `cap ${cap}`).toBe(String(want)); expect(s.px).toBe(want); expect(s.num, '칸이 자른 값을 안 보여 준다').toBe(String(want));
    expect(errs, errs.join('\n')).toEqual([]);
  });
  test(`T3 clamp [${f.type}] 숫자칸에 7 → 8 (아래쪽 한계 그대로)`, async ({ page }) => {
    const errs = await setup(page, f.type); const { num } = await premise(page, f);
    await num.fill('7'); await num.press('Tab');
    const s = await state(page, f);
    expect(s.ds).toBe('8'); expect(s.px).toBe(8);
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

test(`T4 api [bar-h] updateGraphBlock — 60 통과 · 61·999 거절(값 불변)`, async ({ page }) => {
  const errs = await setup(page, 'bar-h');
  const r = await page.evaluate(() => {
    const b = document.getElementById('tg'); const out = { pre: { fn: typeof window.updateGraphBlock, ds: b.dataset.barThickness } };
    out.ok60 = window.updateGraphBlock('tg', { barThickness: 60 }); out.ds60 = b.dataset.barThickness; out.px60 = b.querySelector('.grb-bar-h-track').offsetHeight;
    out.r61 = window.updateGraphBlock('tg', { barThickness: 61 }); out.r999 = window.updateGraphBlock('tg', { barThickness: 999 }); out.dsAfter = b.dataset.barThickness;
    out.r7 = window.updateGraphBlock('tg', { barThickness: 7 });
    return out;
  });
  expect(r.pre.fn, 'API 함수가 없다').toBe('function'); expect(r.pre.ds, '시작부터 키가 있다').toBeUndefined();
  expect(r.ok60.ok, JSON.stringify(r.ok60)).toBe(true); expect(r.ds60).toBe('60'); expect(r.px60).toBe(60);
  expect(r.r61.ok).toBe(false); expect(r.r61.code).toBe('INVALID'); expect(r.r999.ok).toBe(false);
  expect(r.dsAfter, '거절됐는데 값이 바뀌었다').toBe('60');
  expect(r.r7.ok, '아래쪽 한계(8)도 그대로').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});
