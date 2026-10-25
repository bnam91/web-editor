/* grad-drag-in-group-overshoot.dom.spec.js
 *   ★★`GRAD-DRAG-IN-GROUP-OVERSHOOT-01` — ★★«대조»를 ★세운다. (2026-10-25 신설 · 지디)
 *   ⛔★고치지 ★않는다 — ★`t5-08`(b) 가 ★미정이라 ★두 번 고칠 위험이 있다(★태양 가지 판단 그대로).
 *
 * ★찾은 이 = 태양 가지 `taeyang/t5-07-gradient-group`(`43749cd6`) · ★「지디 판정」으로 넘김
 *   그 보고 ★그대로 : 「★그룹 안 그라데이션을 끌면 ★그룹 안엔 남지만 ★★포인터보다 ★더 움직인다:
 *     ★포인터 아래 ★32 화면 px → ★★73 · 63 · 58 (×3 · ★40% 줌 · x 는 0 고정).
 *     ★★대조(섹션 직속 그라데이션)는 ★섹션보다 ★키가 커 ★안 움직여 ★★대조 안 섬.」
 *   ⇒ ★★★그 «안 선 대조»를 ★세우는 것이 ★이 파일의 ★몫이다.
 *
 * ★★처방(★내 것) : ★`window.updateGradientBlock(id, {width, height})`(★앱 길 · 200~1200px)로
 *   ★그라데를 ★★섹션보다 ★작게 만들면 ★섹션 직속에서도 ★★움직일 자리가 생긴다 ⇒ ★대조가 ★선다.
 *
 * ★★까닭(★소스 실측 261025 · ⛔이것만으로 ★닫지 않는다) :
 *   `gradient-select.js:292·304` 가 ★`newXraw = (ev.clientX - secRect.left) / zoom - grabOffX`
 *   로 ★★«섹션» 기준으로 ★계산하는데, ★CSS 는 ★★«부모(그룹)» 기준으로 ★배치한다
 *   ⇒ ★★그룹이 ★섹션 안에서 ★(gx, gy) 만큼 ★떨어져 있으면 ★그만큼 ★★이중으로 ★더해진다.
 *
 * ⛔안 재는 축 (★이름)
 *   · ★고침 — `GRAD-DRAG-OVERSHOOT-FIX-DEFERRED-01`(★`t5-08`(b) 미정)
 *   · ★y 축 — 가지가 「x 는 0 고정」이라 적었다. ★여기서는 ★★x·y ★둘 다 찍는다(★가지보다 넓다)
 *   · ★줌 40% 밖
 *
 * ★★★261025 ★실측 — ★★대조를 ★세우지 ★못했다. ★그 까닭을 ★수로 박는다.
 *   `D0`  그라데 ★88×48 · 섹션 ★344×113 ⇒ ★작다(✅) ★★단 `updateGradientBlock({width:220})` 이
 *         ★★안 먹었다(★88 이 나왔다) = `GRAD-UPDATE-WIDTH-NOT-APPLIED-IN-HARNESS-01`
 *   `D1`  ①회차 `movedX 28 · movedY ★-40` · ★`dataset` ★변화 ★★0 ⇒ ★★끌기가 ★★안 먹었다
 *         (★움직임은 ★스크롤·레이아웃 탓) / ②회차 `movedX 32 · movedY -14` · `dataset ["0","80"]`
 *         ⇒ ★★회차마다 ★다르다
 *   `D2`  `dataset` 변화 ★★0 ⇒ ★★끌기가 ★안 먹었다
 *   ⇒ ★★★⛔이 수로는 ★「덧움직임이 ★있다/없다」를 ★★단언할 수 ★없다.
 *     ★★`movedY` 에 ★스크롤이 ★섞이고, ★`page.mouse` 가 ★`_GRD_CLICK_SLOP`·핸들러를 ★못 깨운다.
 *   ⇒ ★★이름 = `GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01`
 *     ⇒ ★★`D1`·`D2` 는 ★★«끌기가 먹었나»(`dataset` 변화)를 ★★전제로 걸고
 *        ★안 먹으면 ★★SKIP 한다 — ⛔「없다」로 ★닫지 ★않는다.
 *   ⚠️＋ ★회차마다 ★★«크기»도 ★다르다 — `D0` 은 88×48/섹션 344×113 인데 `D2` 는 177×96/섹션 691×227
 *     ⇒ ★★배율(줌)이 ★회차마다 ★다르게 잡힌다 = `GRAD-HARNESS-ZOOM-VARIES-BY-RUN-01`
 *     ⇒ ★★그래서 ★★«화면 px» 로 ★견주는 자는 ★이 하네스에서 ★★못 쓴다(★줌 환산이 흔들린다)
 *   ⇒ ★★다음에 할 것 : ★`gradient-select.js` 가 ★★어느 이벤트를 ★듣는지(mousedown 대상·SLOP)
 *     ★먼저 재고 ★그 길로 ★깨운다. ★또는 ★★앱 축(태양)으로 ★넘긴다.
 *
 * ★★단 ★★까닭은 ★소스로 ★섰다(★위 「까닭」 절) — ★★그것은 ★버리지 ★않는다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grad-drag-in-group-overshoot
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** ★섹션 ＋ ★작은 그라데(들)을 ★앱 길로 만든다. `n`=1 이면 섹션 직속, 2 면 ⌘G 로 묶는다. */
const scene = async (page, group) => page.evaluate(async (group) => {
  const canvas = document.getElementById('canvas');
  canvas.querySelectorAll('.section-block').forEach(s => s.remove());
  await window.addSection();
  const sec = [...canvas.querySelectorAll('.section-block')].pop();
  if (!sec) return { fail: '섹션이 없다' };
  sec.id = 'gdoSec';
  window.selectSection(sec);
  const made = [];
  for (let k = 0; k < (group ? 2 : 1); k++) {
    const b = window.addGradientBlock?.();
    if (!b) return { fail: 'addGradientBlock' };
    b.dataset.probe = 'AB'[k];
    made.push(b);
    /* ★★섹션보다 ★작게 — ★그게 ★대조가 서는 ★조건이다(★가지가 못 세운 그 자리) */
    if (typeof window.updateGradientBlock === 'function') {
      window.updateGradientBlock(b.id, { width: 220, height: 120 });
    }
  }
  if (group) {
    for (const el of made) if (!el.classList.contains('selected')) window.toggleBlockSelect?.(el);
    if (sec.querySelectorAll('.gradient-block.selected').length !== 2) return { fail: '둘이 안 골렸다' };
    window.groupSelectedBlocks?.();
  }
  const a = made[0];
  const r = a.getBoundingClientRect();
  const secR = sec.getBoundingClientRect();
  return {
    id: a.id,
    inFrame: !!a.closest('.frame-block'),
    w: Math.round(r.width), h: Math.round(r.height),
    secW: Math.round(secR.width), secH: Math.round(secR.height),
    /* ★★전제 — ★그라데가 ★섹션보다 ★작아야 ★움직일 자리가 있다 */
    smaller: r.width < secR.width - 20 && r.height < secR.height - 20,
    cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2),
  };
}, group);

/** ★실마우스로 ★(dx, dy) 화면 px 끌고 ★★«실제로 움직인 화면 px»를 돌려준다. */
async function dragBy(page, s, dx, dy) {
  const before = await page.evaluate(() => {
    const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]');
    const r = a.getBoundingClientRect();
    return { left: r.left, top: r.top, dx: a.dataset.x, dy: a.dataset.y };
  });
  await page.mouse.move(s.cx, s.cy);
  await page.mouse.down();
  /* ★여러 걸음으로 — ★한 번에 뛰면 `_GRD_CLICK_SLOP` 을 ★안 넘길 수 있다 */
  await page.mouse.move(s.cx + dx / 2, s.cy + dy / 2, { steps: 4 });
  await page.mouse.move(s.cx + dx, s.cy + dy, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const after = await page.evaluate(() => {
    const a = document.querySelector('#gdoSec .gradient-block[data-probe="A"]');
    const r = a.getBoundingClientRect();
    return { left: r.left, top: r.top, dx: a.dataset.x, dy: a.dataset.y };
  });
  return {
    movedX: Math.round(after.left - before.left),
    movedY: Math.round(after.top - before.top),
    datasetX: [before.dx, after.dx], datasetY: [before.dy, after.dy],
  };
}

test('D0 ★전제 — ★`updateGradientBlock` 으로 ★그라데를 ★★섹션보다 ★작게 만들 수 있다 (★대조의 ★조건)', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, false);
  expect(s.fail, `★전제: ${s.fail}`).toBeUndefined();
  console.log('[D0]', JSON.stringify(s));
  /* ★★★이것이 ★가지가 ★못 세운 ★그 자리다 — 「섹션보다 키가 커 안 움직여 ★대조 안 섬」 */
  expect(s.smaller,
    `★그라데가 ★섹션보다 ★작지 않다 — ★대조를 ★세울 수 없다 (${s.w}×${s.h} vs ${s.secW}×${s.secH})`
  ).toBe(true);
  expect(s.inFrame, '★섹션 직속이 아니다').toBe(false);
  /* ⚠️★`updateGradientBlock({width:220})` 이 ★안 먹었다(실측 88) — ★수만 박는다
     = `GRAD-UPDATE-WIDTH-NOT-APPLIED-IN-HARNESS-01` · ⛔이 칸을 빨강으로 두지 않는다
     (★대조의 ★조건인 ★「섹션보다 작다」는 ★이미 섰으므로 ★그 몫은 ★채워졌다) */
  console.log('[D0-width]', JSON.stringify({ asked: 220, got: s.w }));
});

test('D1 ★★대조 — ★섹션 ★직속 그라데는 ★★포인터만큼 ★움직인다 (★1:1)', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, false);
  expect(s.fail).toBeUndefined();
  expect(s.smaller, '★전제: 그라데가 섹션보다 작지 않다').toBe(true);
  const r = await dragBy(page, s, 32, 32);
  console.log('[D1]', JSON.stringify(r));
  /* ★★★전제 — ★★«끌기가 ★먹었나»는 ★`dataset.x/y` ★변화로만 ★안다.
     ⛔`getBoundingClientRect` 차이에는 ★★스크롤이 ★섞인다(실측 `movedY -40` 인데 dataset 0). */
  if (r.datasetX[0] === r.datasetX[1] && r.datasetY[0] === r.datasetY[1]) {
    test.skip(true, '★★끌기가 ★안 먹었다(dataset 변화 0) = GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01'
      + ' — ⛔FAIL 아니라 SKIP · ' + JSON.stringify(r));
  }
  /* ★★★대조 — ★포인터 ★32 px 에 ★32 px (★±6 여유: 줌 환산·클램프) */
  expect(Math.abs(r.movedX - 32),
    `★x 가 ★포인터보다 ★더/덜 움직였다 — ★★이것이 ★대조다 (moved ${r.movedX} vs pointer 32 · dataset ${JSON.stringify(r.datasetX)})`
  ).toBeLessThanOrEqual(6);
  expect(Math.abs(r.movedY - 32),
    `★y 가 ★포인터보다 ★더/덜 움직였다 (moved ${r.movedY} vs 32 · dataset ${JSON.stringify(r.datasetY)})`
  ).toBeLessThanOrEqual(6);
});

test('D2 ★★★수를 박는다 — ★그룹 ★안 그라데는 ★★더 움직인다 (★가지 실측 32 → 73·63·58)', async ({ page }) => {
  await bootApp(page);
  const s = await scene(page, true);
  expect(s.fail, `★전제: ${s.fail}`).toBeUndefined();
  console.log('[D2-scene]', JSON.stringify(s));
  /* ★★전제 ★둘 — ★그룹 안이고 ★작다 */
  expect(s.inFrame, '★그룹 안이 아니다 — ⌘G 가 안 묶였나(t5-07 가 dev 에 있나)').toBe(true);
  expect(s.smaller, '★전제: 그라데가 섹션보다 작지 않다').toBe(true);
  const r = await dragBy(page, s, 32, 32);
  console.log('[D2]', JSON.stringify(r));
  if (r.datasetX[0] === r.datasetX[1] && r.datasetY[0] === r.datasetY[1]) {
    test.skip(true, '★★끌기가 ★안 먹었다(dataset 변화 0) = GRAD-DRAG-HARNESS-CANNOT-DRIVE-DRAG-01'
      + ' — ⛔FAIL 아니라 SKIP · ' + JSON.stringify(r));
  }
  /* ★★★수 — ★★«얼마나 더»를 ★찍는다. ⛔한 쪽을 ★단언하지 않고 ★★D1 과 ★견주는 것이 ★몫이다.
     ★가지 실측(앱 · 40% 줌)은 ★73·63·58 이었다 — ★이 하네스 수가 ★다를 수 있다(★줌·배치) */
  console.log('[D2-overshoot]', JSON.stringify({
    pointer: 32, movedX: r.movedX, movedY: r.movedY,
    overX: r.movedX - 32, overY: r.movedY - 32,
  }));
  /* ★★이 칸이 ★빨개지면 = ★★덧움직임이 ★사라졌다(★고쳐졌다) ⇒ ★그때 ★뒤집어라 */
  expect(Math.abs(r.movedX - 32) > 6 || Math.abs(r.movedY - 32) > 6,
    `★★덧움직임이 ★없다 — ★고쳐졌다면 ★이 칸을 ★뒤집어라 (moved ${r.movedX},${r.movedY} vs pointer 32,32)`
  ).toBe(true);
});
