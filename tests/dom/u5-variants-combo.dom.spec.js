/* u5-variants-combo — U5(right-panel-unify) 틀 이관 뒤 «조건부 절»의 갈래마다 패널이 ⑴ 오류 없이 그려지고 ⑵ 그 갈래의 컨트롤 하나가 실제로 dataset 에 쓴다.
 * 왜: renderPanel 은 빈 절을 DOM 에서 뺀다 — 배선이 «늘 있다»고 가정한 요소가 갈래에 따라 사라지면 패널 여는 순간 TypeError 다.
 *   갈래 = radial(항목 없음/고름 · 원/호/다각형 · 칸/점 마커 · 가운데 글/이미지/없음 · 라벨 없음) · chat(프로필 끔/켬) · comparison(띄움 아님/띄움) ·
 *          coupon(칸 닫힘/열림) · step(세로/가로) · qa(피드백 없음/있음) · infocard(countup/price).
 * 단언: pageerror 0 · 갈래 컨트롤에 값을 넣고 input/change → block.dataset(또는 그 JSON)에 그 값 · radial 항목 고름 패널의 .prop-hint ≤ 2(게이트 규칙).
 * 양성대조:
 *   ① prop-radial.js rdl-radius 줄의 data-own="layout" 을 지우면 V-R2 게이트 판정 빨강(소유 위반: rdl-radius → appearance) ·
 *      prop-coupon.js cpn-slot-size 를 감싼 data-own="content" 를 지우면 V-K2 게이트 판정 빨강(→ typography).
 *   ② prop-radial.js 에서 항목 절의 힌트(줄바꿈 안내 · 샘플 고르기 · SVG 안내 · 항목 N 안내)를 .prop-hint 로 되돌리면 V-R2 「힌트 ≤ 2」 빨강.
 *   ③ prop-chat.js 의 setY(프로필 Y) 배선을 지우면 V-C2 빨강(dataset.profileOffsetY 안 바뀜).
 *   ④ prop-comparison.js position 절의 headTools(띄우기 토글)를 지우면 V-M2 빨강(토글 없음). ⚠️U0b(머리만 있는 절 허용) 머지 전에는 이 칸이 빨강이다 — 그게 맞다.
 *   ⑤ prop-coupon.js 의 cpn-slot-weight 배선을 지우면 V-K2 빨강.
 *   ⑥ prop-step.js 패딩 배선(setL)을 지우면 V-S2 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { loadSectionSpec, readPanel, judgePanel } = require('./_panel-sections.js');
const SPEC = loadSectionSpec();
/** 게이트의 판정 그대로 — 기본 패널 밖(칸 열림 · 항목 고름) 상태에서도 소유·순서·제목을 잰다 */
const judge = async (page) => judgePanel(await readPanel(page, SPEC), SPEC);

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.deselectAll?.(); window.selectSection(sec); window.clearHistory?.(); });
  return errs;
}
async function add(page, cls, entry) {
  return page.evaluate(async ({ cls, entry }) => {
    const before = new Set(document.querySelectorAll('.' + cls));
    await window[entry]();
    const b = [...document.querySelectorAll('.' + cls)].find((x) => !before.has(x));
    window.selectBlock(b.id);
    return b.id;
  }, { cls, entry });
}
/** 패널을 다시 연다 — show(블록, ...args) */
const open = (page, fn, id, ...args) => page.evaluate(({ fn, id, args }) => { window[fn](document.getElementById(id), ...args); }, { fn, id, args });
/** 컨트롤에 값 → 이벤트(들) */
const put = (page, sel, value, events = ['input', 'change']) => page.evaluate(({ sel, value, events }) => {
  const el = document.querySelector('#panel-right ' + sel);
  if (!el) return false;
  el.value = value;
  for (const e of events) el.dispatchEvent(new Event(e, { bubbles: true }));
  return true;
}, { sel, value, events });
const click = (page, sel) => page.evaluate((sel) => { const el = document.querySelector('#panel-right ' + sel); if (!el) return false; el.click(); return true; }, sel);
const ds = (page, id) => page.evaluate((id) => ({ ...document.getElementById(id).dataset }), id);
const hints = (page) => page.evaluate(() => document.querySelectorAll('#panel-right .prop-hint').length);

test.describe('radial', () => {
  test('V-R1 항목 없음 — 좌우 패딩이 dataset.padX 에 쓴다', async ({ page }) => {
    const errs = await scene(page);
    const id = await add(page, 'radial-block', 'addRadialBlock');
    await open(page, 'showRadialProperties', id);
    expect(await page.locator('#rdl-item-section').count(), '[전제] 항목 절 없음').toBe(0);
    expect(await put(page, '#rdl-padx-number', '40', ['change'])).toBe(true);
    expect((await ds(page, id)).padX).toBe('40');
    expect(errs).toEqual([]);
  });

  test('V-R2 항목 고름 — 라벨이 items[0].label 에 쓴다 · 힌트 ≤ 2', async ({ page }) => {
    const errs = await scene(page);
    const id = await add(page, 'radial-block', 'addRadialBlock');
    await open(page, 'showRadialProperties', id, 0);
    await expect(page.locator('#rdl-item-section'), '[전제] 항목 절').toHaveCount(1);
    expect(await hints(page), '★항목 고름 패널 .prop-hint ≤ 2').toBeLessThanOrEqual(2);
    expect(await judge(page), '★게이트 판정(항목 고름 — 기본 패널 밖)').toEqual([]);
    expect(await put(page, '#rdl-item-label', 'u5라벨', ['input'])).toBe(true);
    expect(JSON.parse((await ds(page, id)).items)[0].label).toBe('u5라벨');
    // 가운데 이미지까지 켠 가장 무거운 갈래에서도 ≤ 2
    expect(await click(page, '#rdl-center-image')).toBe(true);
    await open(page, 'showRadialProperties', id, 0);
    expect(await hints(page), '★항목 고름 + 가운데 이미지 .prop-hint ≤ 2').toBeLessThanOrEqual(2);
    expect(errs).toEqual([]);
  });

  for (const [name, btn, want, ctl, val, key] of [
    ['호', '#rdl-shape-arc', ['shape', 'arc'], '#rdl-end-number', '30', 'endDeg'],
    ['다각형', '#rdl-shape-5', ['shape', 'poly'], '#rdl-radius-number', '200', 'radius'],
    ['점 마커', '#rdl-marker-dot', ['marker', 'dot'], '#rdl-dot-number', '24', 'dotSize'],
    ['가운데 없음', '#rdl-center-none', ['centerMode', 'none'], '#rdl-padx-number', '20', 'padX'],
    ['라벨 없음', '#rdl-label-none', ['labelPos', 'none'], '#rdl-start-number', '10', 'startDeg'],
  ]) {
    test(`V-R3 ${name} — 갈래 전환 뒤 컨트롤 ${ctl} 가 dataset.${key} 에 쓴다 (항목 없음 · 고름 둘 다)`, async ({ page }) => {
      const errs = await scene(page);
      const id = await add(page, 'radial-block', 'addRadialBlock');
      await open(page, 'showRadialProperties', id);
      expect(await click(page, btn), `[전제] ${btn}`).toBe(true);
      expect((await ds(page, id))[want[0]]).toBe(want[1]);
      for (const idx of [undefined, 0]) {
        if (idx === undefined) await open(page, 'showRadialProperties', id); else await open(page, 'showRadialProperties', id, idx);
        expect(await put(page, ctl, val, ['change']), `[전제] ${ctl}`).toBe(true);
        expect((await ds(page, id))[key]).toBe(val);
        expect(await hints(page)).toBeLessThanOrEqual(2);
      }
      expect(errs).toEqual([]);
    });
  }
});

test('V-C1/C2 chat — 프로필 끔: 간격 → dataset.gap · 켬: 프로필 Y → dataset.profileOffsetY', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'chat-block', 'addChatBlock');
  await open(page, 'showChatProperties', id);
  expect(await put(page, '#chb-gap', '20')).toBe(true);
  expect((await ds(page, id)).gap).toBe('20');
  expect(await click(page, '#chb-show-profile')).toBe(true);
  expect((await ds(page, id)).showProfile).toBe('1');
  await open(page, 'showChatProperties', id);
  expect(await page.locator('#panel-right .chb-prop-profile-row').count(), '[전제] 프로필 줄이 메시지마다').toBeGreaterThan(0);
  expect(await put(page, '#chb-profile-y-num', '12', ['input'])).toBe(true);
  expect((await ds(page, id)).profileOffsetY).toBe('12');
  expect(errs).toEqual([]);
});

test('V-M1/M2 comparison — 띄움 아님: 겹침 → dataset.overlap · 띄움: 토글 → overlayBlock · X 칸 생김', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'comparison-block', 'addComparisonBlock');
  await open(page, 'showComparisonProperties', id);
  expect(await put(page, '#cmp-ovl-num', '40', ['input'])).toBe(true);
  expect((await ds(page, id)).overlap).toBe('40');
  expect(await click(page, '#cmp-float-toggle'), '★Position 절 머리에 띄우기 토글').toBe(true);
  await expect.poll(async () => (await ds(page, id)).overlayBlock).toBe('true');
  await open(page, 'showComparisonProperties', id);
  await expect(page.locator('#panel-right #cmp-x-number'), '띄우면 X/Y 줄').toHaveCount(1);
  expect(errs).toEqual([]);
});

test('V-K1/K2 coupon — 칸 닫힘: 폭 → dataset.width · 칸 열림: 굵기 → dataset.slotNumWeight', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'coupon-block', 'addCouponBlock');
  await open(page, 'showCouponProperties', id);
  expect(await put(page, '#cpn-width-number', '420', ['change'])).toBe(true);
  expect((await ds(page, id)).width).toBe('420');
  await open(page, 'showCouponProperties', id, 'num');
  await expect(page.locator('#panel-right #cpn-slot-text'), '[전제] num 칸이 열렸다').toHaveCount(1);
  expect(await judge(page), '★게이트 판정(칸 열림 — 기본 패널 밖 · cpn-slot-size/-slotcol data-own)').toEqual([]);
  expect(await put(page, '#cpn-slot-weight', '900', ['change'])).toBe(true);
  expect((await ds(page, id)).slotNumWeight).toBe('900');
  expect(errs).toEqual([]);
});

test('V-S1/S2 step — 세로: 간격 → dataset.gap · 가로: 왼쪽 패딩 → dataset.stepPadL', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'step-block', 'addStepBlock');
  await open(page, 'showStepProperties', id);
  expect(await put(page, '#stb-gap-number', '40', ['change'])).toBe(true);
  expect((await ds(page, id)).gap).toBe('40');
  expect(await click(page, '#stb-orient-group [data-orient="horizontal"]')).toBe(true);
  expect((await ds(page, id)).stepOrient).toBe('horizontal');
  await open(page, 'showStepProperties', id);
  expect(await put(page, '#stb-padl-number', '24', ['change'])).toBe(true);
  expect((await ds(page, id)).stepPadL).toBe('24');
  expect(errs).toEqual([]);
});

test('V-Q1/Q2 qa — 피드백 없음/있음: 절이 맞게 뜬다(읽기 전용 패널 — 쓰는 컨트롤 없음)', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'qa-block', 'addQABlock');
  const titles = () => page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-sec-title-text')].map((e) => e.textContent.trim()));
  await page.evaluate((id) => { delete document.getElementById(id).dataset.feedback; }, id);
  await open(page, 'showQAProperties', id);
  expect(await titles()).toEqual(['Checklist', 'Template']);
  await page.evaluate((id) => { document.getElementById(id).dataset.feedback = 'u5 피드백'; }, id);
  await open(page, 'showQAProperties', id);
  expect(await titles()).toEqual(['Checklist', 'Feedback', 'Template']);
  expect(await page.locator('#panel-right').textContent()).toContain('u5 피드백');
  expect(errs).toEqual([]);
});

test('V-I1/I2 infocard — countup: 숫자 크기 → dataset.numSize · price: 필드 → data JSON', async ({ page }) => {
  const errs = await scene(page);
  const id = await add(page, 'infocard-block', 'addInfoCardBlock');
  await open(page, 'showInfoCardProperties', id);
  expect(await put(page, '#ifc-num-number', '120', ['change']), '[전제] countup 숫자 크기 칸').toBe(true);
  expect((await ds(page, id)).numSize).toBe('120');
  expect(await click(page, '[data-variant="price"]')).toBe(true);
  await expect(page.locator('#panel-right #ifc-num-number'), 'price 갈래엔 숫자 크기 없음').toHaveCount(0);
  expect(await put(page, '.ifc-field[data-key="label"]', 'u5가격', ['change'])).toBe(true);
  expect(JSON.parse((await ds(page, id)).data || '{}').label).toBe('u5가격');
  expect(errs).toEqual([]);
});
