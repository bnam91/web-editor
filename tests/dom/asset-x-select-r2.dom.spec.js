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

async function setup(page, zoom, abStyle = null) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); }, abStyle ? SEC.replace('style="height:260px;"', `style="${abStyle}"`) : SEC);
  if (abStyle) {
    const deg = (abStyle.match(/rotate\((\d+)deg\)/) || [])[1];
    if (deg) await page.evaluate((d) => { document.getElementById('abX').dataset.rotation = d; }, deg);   // 앱의 회전 블럭 꼴(data-rotation + transform)
    expect(await page.evaluate(() => document.getElementById('abX').getAttribute('style')), '전제 — 변형 픽스처가 실렸다').toBe(abStyle);
  }
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

/* ★R2-b — 둥글기 손잡이(ne)가 ✕ 를 덮지 않는다. 실측(고치기 전): 40% 골라진 상태에서 ✕ 원 안 113점 중 55점(가운데 포함)이 손잡이 ·
 *   40% 안 골라짐 0 · 100%·200% 는 asset-img 가장자리 2점뿐. ⇒ 낮은 배율 + 골라진 상태에서만. 처방 = 겹칠 때만 ne 손잡이를 ✕ 아래로.
 *   양성대조 36cbe872 = X4[40%] 빨강 예상. 손잡이를 «치우기만» 하고 기능을 죽이면 안 되니 X5 가 끌기로 반경이 바뀌는지 같이 잰다. */
const coverage = (page) => page.evaluate(() => {
  const b = document.querySelector('#abX .asset-overlay-clear'); const r = b.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2; let n = 0, mine = 0, handle = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { if (dx * dx + dy * dy > R * R) continue; n++;
    const e = document.elementFromPoint(cx + dx, cy + dy); if (e === b) mine++; else if (e && e.classList.contains('asset-radius-handle')) handle++; }
  return { n, mine, handle, center: document.elementFromPoint(cx, cy) === b };
});
for (const zoom of [40, 100, 200]) test(`X4 [${zoom}%] ★골라진 상태에서 둥글기 손잡이가 ✕ 를 덮지 않는다(가운데 포함)`, async ({ page }) => {
  await setup(page, zoom);
  await page.evaluate(() => document.querySelector('#abX .asset-overlay-clear').scrollIntoView({ block: 'center', inline: 'center' }));
  { const q = await page.evaluate(() => { const b = document.querySelector('#abX .asset-overlay-clear').getBoundingClientRect(); return [b.left - 60, b.bottom + 60]; });
    await page.mouse.click(q[0], q[1]); await page.waitForTimeout(250); }   // 진짜 클릭으로 고른다(손잡이는 클릭 경로가 붙인다)
  expect(await page.evaluate(() => document.querySelectorAll('.asset-radius-handle').length), '전제 — 둥글기 손잡이가 떠 있다').toBe(4);
  const c = await coverage(page);
  expect(c.handle, `★✕ 원 안 ${c.n}점 중 ${c.handle}점을 둥글기 손잡이가 덮는다`).toBe(0);
  expect(c.center, '★✕ 가운데를 누르면 ✕ 가 아니다').toBe(true);
});
test('X5 지키는 시험 [40%] — ✕ 와 겹친 손잡이를 숨겨도 남은 손잡이(nw)로 모서리 반경이 실제로 바뀐다', async ({ page }) => {
  await setup(page, 40);
  await page.evaluate(() => document.querySelector('#abX .asset-overlay-clear').scrollIntoView({ block: 'center', inline: 'center' }));
  { const q = await page.evaluate(() => { const b = document.querySelector('#abX .asset-overlay-clear').getBoundingClientRect(); return [b.left - 60, b.bottom + 60]; });
    await page.mouse.click(q[0], q[1]); await page.waitForTimeout(250); }   // 진짜 클릭으로 고른다(손잡이는 클릭 경로가 붙인다)
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.asset-radius-handle.ne')).display), '전제 — 40% 에선 ne 가 ✕ 와 겹쳐 숨는다').toBe('none');
  const h = await page.evaluate(() => { const r = document.querySelector('.asset-radius-handle.nw').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const r0 = await page.evaluate(() => parseInt(document.getElementById('abX').style.borderRadius) || 0);
  await page.mouse.move(h[0], h[1]); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h[0] + i * 4, h[1] + i * 4);
  await page.mouse.up(); await page.waitForTimeout(150);
  const r1 = await page.evaluate(() => parseInt(document.getElementById('abX').style.borderRadius) || 0);
  expect(r1, `반경 ${r0} → ${r1}`).toBeGreaterThan(r0);
});

/* ★X6 — 적대QA(2026-10-03)가 첫 처방(ne 를 ✕ 아래로 옮김)을 깬 두 조건: 회전 15°·90° · 높이 40px(se 가 ✕ 를 덮고 ne 가 블럭 밖으로).
 *   처방을 «겹치는 손잡이는 숨김»으로 바꿨다 — 어느 조건에서도 ✕ 원 안 손잡이 점 0, 그리고 손잡이가 «하나 이상» 남는다(기능 생존). */
for (const [name, st] of [['회전15', 'height:260px;transform:rotate(15deg);'], ['회전90', 'height:260px;transform:rotate(90deg);'], ['높이40', 'height:40px;'], ['높이60', 'height:60px;']])
  test(`X6 [40%·${name}] ★✕ 를 덮는 손잡이 0 · 보이는 둥글기 손잡이 ≥1`, async ({ page }) => {
    await setup(page, 40, st);
    await page.evaluate(() => document.querySelector('#abX .asset-overlay-clear').scrollIntoView({ block: 'center', inline: 'center' }));
    const q = await page.evaluate(() => { const a = document.getElementById('abX').getBoundingClientRect(); return [a.left + a.width * 0.3, a.top + a.height * 0.6]; });
    await page.mouse.click(q[0], q[1]); await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.getElementById('abX').classList.contains('selected')), '전제 — 골라졌다').toBe(true);
    const c = await coverage(page);
    expect(c.handle, `★✕ 원 안 ${c.n}점 중 ${c.handle}점을 둥글기 손잡이가 덮는다`).toBe(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('.asset-radius-handle')].filter(h => getComputedStyle(h).display !== 'none').length), '★손잡이가 다 숨었다 — 반경을 못 바꾼다').toBeGreaterThan(0);
  });
