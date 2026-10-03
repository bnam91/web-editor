/* asset-x-select-r2 — 에셋 ✕(이미지 지우기)를 누르면 «그 블럭을 고른다» (R2, 2026-10-03 현빈 「x 로 이미지 지운 뒤 백스페이스를 하면 에셋블럭이 안 지워진다 — 간헐적으로」)
 * ★측정(Evaluator, 현빈 proj_1790933370176/ab_y0hthua 를 «읽기만» 얹음, 40%, 매 회 새 페이지):
 *   고르고 ✕ → ⌫ = 120회 다 지워짐(신고 순서 그대로는 안 난다) / 안 고르고 마우스만 올려(✕ 는 :hover 로 보임) ✕ → ⌫ = 40/40 안 지워짐 /
 *   ★다른 블럭을 골라 둔 채 ✕ → ⌫ = 10/10 «골라 둔 다른 블럭이 대신 지워짐» — 신고보다 나쁜 결함.
 *   ⇒ 「간헐적」은 무작위가 아니라 «블럭을 안 고르고 마우스만 올려 ✕ 를 눌렀을 때» 나는 «조건»일 공산(사람 손 순서는 실앱 미측정).
 * 기전: ✕ 처리기가 stopPropagation(빈 블럭 클릭 = 파일 고르기 등으로 새지 않게 — 그대로 둔다) → 선택 경로를 안 탄다 → ⌫ 는 그때 골라진 것을 지운다.
 * ★양성대조 핀 36cbe872(고치기 전) = X1·X2 빨강 예상 / X0(골라 둔 채 ✕ — 원래도 됨)은 지키는 시험. 결과는 커밋 본문.
 * 배율: 전제를 단언한다(10-02 「50%·200% 시험이 둘 다 10% 에서 돌던」 일 — applyZoom 은 퍼센트). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = `<div class="section-block" id="sX" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;">
  <div class="gap-block" data-type="gap" id="gX0" style="height:40px;"></div>
  <div class="row" data-layout="stack"><div class="text-block" id="tbOther" data-type="text"><p class="tb-p">다른 블럭</p></div></div>
  <div class="row" id="rowX"><div class="asset-block has-image" id="abX" data-img-src="${PX}" data-fit="cover" style="height:260px;">
    <div class="asset-img-clip"><img class="asset-img" src="${PX}" draggable="false" style="object-fit:cover;"></div>
    <button class="asset-overlay-clear" title="이미지 제거">✕</button><div class="asset-overlay"></div></div></div>
  <div class="gap-block" data-type="gap" id="gX1" style="height:200px;"></div></div></div>`;

async function setup(page, zoom) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); }, SEC);
  await page.evaluate((z) => window.applyZoom(z), zoom);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.currentZoom), `★전제 — 배율 ${zoom}%`).toBe(zoom);
  await page.evaluate(() => document.getElementById('abX').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
}
/* ✕ 단추가 «맨 위»인 화면 점 하나 — 둥글기 손잡이가 단추 일부를 덮는다(측정: 40% 에서 원의 114점 중 48점). */
const xPoint = (page) => page.evaluate(() => {
  const b = document.querySelector('#abX .asset-overlay-clear'); const r = b.getBoundingClientRect();
  for (let dy = 0; dy < r.height; dy++) for (let dx = 0; dx < r.width; dx++) {
    const x = r.left + dx + 0.5, y = r.top + dy + 0.5;
    if (document.elementFromPoint(x, y) === b) return [x, y];
  }
  return null;
});
const center = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
async function hoverAndClickX(page) {
  // ✕ 는 블럭 오른쪽 위 — 200% 에선 블럭이 화면보다 넓어 그 자리가 화면 밖이다. 단추 자리를 화면 안으로.
  await page.evaluate(() => document.querySelector('#abX .asset-overlay-clear').scrollIntoView({ block: 'center', inline: 'center' }));
  await page.waitForTimeout(150);
  const [cx, cy] = await page.evaluate(() => { const a = document.getElementById('abX').getBoundingClientRect(), b = document.querySelector('#abX .asset-overlay-clear').getBoundingClientRect();
    return [Math.max(a.left + 5, b.left - 60), b.top + b.height / 2 + 40]; });   // 블럭 «안»이면서 단추 옆 — 마우스만 올려 ✕ 를 보이게
  await page.mouse.move(cx, cy); await page.waitForTimeout(150);
  const p = await xPoint(page);
  expect(p, '★✕ 단추가 맨 위인 점이 하나도 없다 — 계측기가 못 누른다').not.toBeNull();
  await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.getElementById('abX')?.classList.contains('has-image')), '전제 — ✕ 로 이미지가 비었다').toBe(false);
}
const exists = (page, id) => page.evaluate((id) => !!document.getElementById(id), id);

for (const zoom of [40, 100, 200]) {
  test(`X0 [${zoom}%] 지키는 시험 — 골라 둔 채 ✕ → ⌫ = 그 블럭이 지워진다`, async ({ page }) => {
    await setup(page, zoom);
    const [cx, cy] = await center(page, 'abX'); await page.mouse.click(cx, cy); await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.getElementById('abX').classList.contains('selected')), '전제 — 골라졌다').toBe(true);
    await hoverAndClickX(page);
    await page.keyboard.press('Backspace'); await page.waitForTimeout(200);
    expect(await exists(page, 'abX')).toBe(false);
  });
  test(`X1 [${zoom}%] ★안 고르고 마우스만 올려 ✕ → ⌫ = 그 블럭이 지워진다`, async ({ page }) => {
    await setup(page, zoom);
    await hoverAndClickX(page);
    await page.keyboard.press('Backspace'); await page.waitForTimeout(200);
    expect(await exists(page, 'abX'), '★✕ 를 누른 블럭이 안 지워졌다(R2 신고 그대로)').toBe(false);
  });
  test(`X2 [${zoom}%] ★★다른 블럭을 골라 둔 채 ✕ → ⌫ = «다른 블럭»은 살아 있고 ✕ 누른 블럭이 지워진다`, async ({ page }) => {
    await setup(page, zoom);
    const [ox, oy] = await center(page, 'tbOther'); await page.mouse.click(ox, oy); await page.waitForTimeout(200);
    await page.evaluate(() => document.activeElement?.blur?.());
    expect(await page.evaluate(() => document.getElementById('tbOther').classList.contains('selected')), '전제 — 다른 블럭이 골라졌다').toBe(true);
    await hoverAndClickX(page);
    await page.keyboard.press('Backspace'); await page.waitForTimeout(200);
    expect(await exists(page, 'tbOther'), '★★골라 둔 «다른 블럭»이 대신 지워졌다').toBe(true);
    expect(await exists(page, 'abX'), '★✕ 를 누른 블럭이 안 지워졌다').toBe(false);
  });
}
test('X3 ✕ 는 한 걸음 — ⌘Z 한 번에 이미지가 돌아오고, ✕ 누른 블럭은 골라진 채', async ({ page }) => {
  await setup(page, 100);
  await hoverAndClickX(page);
  expect(await page.evaluate(() => document.getElementById('abX').classList.contains('selected')), '★✕ 뒤 그 블럭이 안 골라졌다').toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.getElementById('abX')?.classList.contains('has-image'))).toBe(true);
});
