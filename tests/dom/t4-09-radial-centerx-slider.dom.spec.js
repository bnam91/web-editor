/* t4-09-radial-centerx-slider.dom.spec.js — t4-09 「원중심 x 슬라이드 바가 쾌적하게 움직이지 않는 문제」
 *
 * ★잰 값(아이맥 재측 · S3 실앱 c278bc39 ×3) — 원 중심 X 슬라이더 99px 에 범위 −100~150(250)
 *   ⇒ 정수 화면 px 한 칸마다 값이 2~3 씩 뛴다(44→47→49→52) · 50 은 어느 정수 px 로도 못 닿는다(겨냥 0/10) · 숫자 칸 50 은 50.
 * ★S3 실앱 표(같은 장면 ×3): 99px 은 step 1·0.5·0.25 모두 0/10 · 207px(긴 슬라이더)은 step 1·0.5·0.25 모두 10/10
 *   ⇒ 뿌리 = «범위 ÷ 길이»(step 이 아니다). 처방 = 이 줄만 슬라이더를 다음 줄 전폭으로(js/props/prop-radial.js _pairRowWide)
 *   ＋ 한도에 step(js/blocks/radial-block.js RADIAL_LIMITS.centerX.step · 지금 1 · 현빈 선택) ＋ 배선이 step 을 읽는다(parseFloat).
 *
 * ★칸
 *   P  전제 — 호(arc) 라디알을 골랐고 패널에 원 중심 X 슬라이더·숫자 칸이 있다 · 숫자 칸 50 ⇒ 50
 *   S1 슬라이더를 1 정수 px 옮길 때 값이 2 단위 이하로 움직인다(열 걸음 모두)
 *   S2 (지키는 칸) 50 근처로 끈 뒤 →/← 로 정확히 50 — 가르는 칸은 S1
 *   S3 다른 라디알 슬라이더(반지름)는 옛 그대로 정수 값을 낸다(배선 parseFloat 변경의 대조)
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    await window.addSection();
    window.addRadialBlock({ shape: 'arc' });
    const b = [...document.querySelectorAll('#canvas .radial-block')].pop();
    window.deselectAll?.();
    return b.id;
  });
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.cx, r.top + 6);
  await page.waitForFunction(() => !!document.getElementById('rdl-cx-slider') && !!document.getElementById('rdl-cx-number'), null, { timeout: 3000 });
  await page.evaluate(() => document.getElementById('rdl-cx-slider').scrollIntoView({ block: 'center' }));
  return { errs, id };
}

const geo = (page) => page.evaluate(() => { const s = document.getElementById('rdl-cx-slider'); const b = s.getBoundingClientRect(); return { l: b.left, w: b.width, y: Math.round(b.top + b.height / 2), min: +s.min, max: +s.max }; });
const xOf = (g, v) => Math.round(g.l + 6 + (v - g.min) / (g.max - g.min) * (g.w - 12));   // 사람 손 = 정수 px
const ds = (page, id) => page.evaluate((id) => Number(document.getElementById(id).dataset.centerX), id);

async function setNum(page, v, id) {
  await page.fill('#rdl-cx-number', String(v));
  await page.press('#rdl-cx-number', 'Enter');
  await page.waitForFunction(([id, v]) => Number(document.getElementById(id).dataset.centerX) === v, [id, v], { timeout: 3000 });
}

async function dragTo(page, from, to, y) {
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move(to, y, { steps: 10 });
  await page.mouse.up();
}

test('P·S1·S2 ★원 중심 X — 1px 당 2 이하 · 50 에 정수 px 로 닿는다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await setNum(page, 50, id);
  expect(await ds(page, id), 'P 숫자 칸 50').toBe(50);
  const g = await geo(page);
  /* S1 — 40 에서 1px 씩 열 걸음 */
  await setNum(page, 40, id);
  const x0 = xOf(g, 40);
  await page.mouse.move(x0, g.y);
  await page.mouse.down();
  let prev = await ds(page, id);
  const deltas = [];
  for (let k = 1; k <= 10; k++) {
    await page.mouse.move(x0 + k, g.y);
    const v = await ds(page, id);
    deltas.push(Math.abs(v - prev)); prev = v;
  }
  await page.mouse.up();
  expect(Math.max(...deltas), `S1 1px 당 값 변화 ${deltas}`).toBeLessThanOrEqual(2);
  /* S2(지키는 칸) — 50 근처로 끌어 놓은 뒤 →/← 로 미세 조정해 정확히 50 에 닿는다(사람이 맞추는 길).
     ⚠️«끌기만으로 아무 정수에나 닿는다»는 ★보장하지 않는다 — 긴 슬라이더도 1px ≈ 1.2 단위라 px 정렬에 따라
       어떤 정수는 건너뛴다(하네스 실측 50±2px = 47·48·49·51·52 · 앱 207px 에서는 50 에 닿아 겨냥 10/10).
       ⇒ 가르는 칸은 S1(1px 당 2 이하 · 고치기 전 3) 이다. */
  await setNum(page, 0, id);
  await dragTo(page, xOf(g, 0), xOf(g, 50), g.y);
  let v = await ds(page, id);
  for (let k = 0; k < 4 && v !== 50; k++) {
    await page.keyboard.press(v < 50 ? 'ArrowRight' : 'ArrowLeft');
    v = await ds(page, id);
  }
  expect(v, 'S2 끌기 + →/← 로 50').toBe(50);
  expect(errs).toEqual([]);
});

test('S3 ★반지름 슬라이더는 정수 값 그대로(배선 대조)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const g = await page.evaluate(() => { const s = document.getElementById('rdl-radius-slider'); s.scrollIntoView({ block: 'center' }); const b = s.getBoundingClientRect(); return { l: b.left, w: b.width, y: Math.round(b.top + b.height / 2), min: +s.min, max: +s.max }; });
  await dragTo(page, xOf(g, 250), xOf(g, 400), g.y);
  const v = await page.evaluate((id) => document.getElementById(id).dataset.radius, id);
  expect(v, `S3 반지름 값 «${v}» 는 정수 글자`).toMatch(/^\d+$/);
  expect(errs).toEqual([]);
});
