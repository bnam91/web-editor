/* frame-text-noop-undo.dom.spec.js — t 먹통 칸 (지디 2026-10-03, F1 측정 중 발견)
 * ★증상(코드): 자유 프레임도 fullWidth 흐름도 아닌 프레임(data-free-layout·data-full-width 둘 다 없음)을 고르고 t → 아무것도 안 생긴다.
 *   그런데 block-factory.js addTextBlock·addBlankTextBlock 는 pushHistory 를 «먼저» 부르고 나서 「지원하지 않는 프레임 타입」 return 으로 빠졌다.
 * ★재는 것 = 「아무것도 안 넣는 return 앞에서 입구 «자신의» pushHistory 를 안 부른다」. 입구의 호출은 «라벨 없는» pushHistory() 다 —
 *   insert-history.js 래퍼의 끝 표본은 라벨(LABELS[name])이 붙어 구분된다. window.pushHistory 를 감싸 인자 없는 호출 수를 센다.
 * ⚠️★「⌘Z 깊이(getHistoryTip len·pos)」로는 이 결함이 «안 잰다»(실측 2026-10-03, 고치는 중 발견):
 *   ⑴ pushHistory 는 꼭대기와 같으면 안 쌓는다 — 라이브가 꼭대기와 같으면 처음부터 칸이 안 생긴다.
 *   ⑵ 라이브가 꼭대기와 «다르면» 입구 자신의 호출을 빼도, 래퍼(insert-history)의 끝 표본이 «같은 칸»을 만든다(len·pos 동일).
 *   그 칸은 라이브 변경을 담는 칸이라 «빈» 칸이 아닐 수도 있다 — 지디가 말한 「먹통 한 칸」의 실제 모양은 «미확정»이다(보고에 적음).
 *   ⇒ 이 시험은 «호출이 없다»를 잰다. 깊이(len)를 재는 시험은 일부러 두지 않았다(양성대조에서도 초록이라 안 재는 것과 구분이 안 된다).
 * ★양성대조: GD1001_ROOT=<bf9161d0 체크아웃> → T1 빨강 / T0·T2 는 양쪽 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js --workers=2 frame-text-noop-undo */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const FIX = `<div class="section-block" id="sT" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:0;padding-right:0;">
  <div class="gap-block" id="gA" data-type="gap" style="height:30px;"></div>
  <div class="row" data-layout="stack"><div class="frame-block" id="FRX" style="width:600px;min-height:200px;"><div class="gap-block" id="gIn" data-type="gap" style="height:40px;"></div></div></div>
  <div class="gap-block" id="gZ" data-type="gap" style="height:30px;"></div>
</div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('FRX').scrollIntoView({ block: 'center' });
  }, FIX);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
/* window.pushHistory 를 감싸 «라벨 없는» 호출(= 입구 자신의 push-before)과 라벨 있는 호출(래퍼 끝 표본 등)을 따로 센다 */
const spyPush = (page) => page.evaluate(() => {
  window.__ph = { bare: 0, labeled: 0 };
  const orig = window.pushHistory;
  window.pushHistory = function (label) { if (label === undefined) window.__ph.bare++; else window.__ph.labeled++; return orig.apply(this, arguments); };
});
const phCounts = (page) => page.evaluate(() => ({ ...window.__ph }));

async function pickAndPressT(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('FRX').getBoundingClientRect(); return [r.left + r.width * 0.85, r.top + r.height * 0.85]; });
  await page.mouse.click(x, y);
  await expect.poll(() => page.evaluate(() => document.getElementById('FRX').classList.contains('selected')), { timeout: 2000 }).toBe(true);
  /* ★10-05 H11: 자식 있는 프레임을 한 번 클릭 = 오브젝트 선택 ⇒ t 는 프레임 «밖»(섹션)으로 간다. 이 시험이 재는 것은 «프레임 갈래»(지원 안 하는 타입의
     빈 return · fullWidth 만들기)라 전제를 «들어간 상태»로 둔다: 안쪽 gIn 을 클릭해 고른다(실기의 「안쪽 블럭을 먼저 고른다」). */
  await page.waitForTimeout(400);
  const [gx, gy] = await page.evaluate(() => { const r = document.getElementById('gIn').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(gx, gy);
  await expect.poll(() => page.evaluate(() => document.getElementById('FRX').classList.contains('selected') && !!document.querySelector('#FRX .selected')), { timeout: 2000, message: '[전제] 들어간 상태(프레임 + 안쪽 골라짐)' }).toBe(true);
  const kidsBefore = await page.evaluate(() => document.getElementById('FRX').children.length);
  await spyPush(page);
  await page.keyboard.press('t'); await page.waitForTimeout(250);
  return { kidsBefore, kidsAfter: await page.evaluate(() => document.getElementById('FRX').children.length) };
}

test('T0 전제 — 지원 안 하는 프레임에서 t 는 «아무것도 안 만든다»(프레임 안도 섹션에도)', async ({ page }) => {
  const errs = await setup(page);
  const before = await page.evaluate(() => document.querySelectorAll('#sT .text-block').length);
  const r = await pickAndPressT(page);
  expect(errs).toEqual([]);
  expect(r.kidsAfter).toBe(r.kidsBefore);
  expect(await page.evaluate(() => document.querySelectorAll('#sT .text-block').length)).toBe(before);
});

test('T1 ★아무것도 안 넣는 t(흐름 프레임) 는 입구 자신의 pushHistory()(라벨 없는 호출)를 «안» 부른다', async ({ page }) => {
  const errs = await setup(page);
  const r = await pickAndPressT(page);
  const c = await phCounts(page);
  expect(errs).toEqual([]);
  expect(r.kidsAfter, '전제 — t 가 아무것도 안 만들었다').toBe(r.kidsBefore);
  expect(c.bare, '★아무것도 안 넣고 return 하는 t 가 먼저 pushHistory() 를 불렀다').toBe(0);
});

test('T2 지키는 시험 — fullWidth 흐름 프레임 t 는 «만들고» 입구가 pushHistory() 를 «한 번» 부른다(고침이 너무 넓지 않다)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('FRX').dataset.fullWidth = 'true'; });
  const r = await pickAndPressT(page);
  const c = await phCounts(page);
  expect(errs).toEqual([]);
  expect(r.kidsAfter, 't 가 fullWidth 프레임에 글자를 못 만들었다').toBe(r.kidsBefore + 1);
  expect(c.bare, '글자를 만드는 입구가 push-before 를 안 불렀다').toBe(1);
});
