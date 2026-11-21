/* t13d-05b — 0.9.13 t13D-05 후속(현빈 261121): 떠 있는 프레임의 패널 X/Y 가 0,0 이 아니라 «실제 떠 있는 좌표»
 * 고침: prop-frame.js — 떠 있으면 X/Y 칸(ss-pos-x/y) = dataset.offsetX/Y(자리 주인 기준 · overlay-float 정본) · 배선 = wireFloatPosition(텍스트·에셋과 같은 한 벌)
 *        overlay-float.js _syncPanelXY — 끌면 그 칸도 따라옴(프레임 패널 id 가 옛 ss-pos-*).
 * X1 오버레이 단추 → 패널 X/Y = 화면 실측(프레임 rect − 섹션 rect)/배율 · 0,0 아님
 * X2 진짜 마우스로 끌면 → 칸이 새 화면 좌표를 따라옴
 * X3 X 칸에 50 을 넣으면 → 프레임이 섹션 왼쪽 50 에 섬 · translate 안 씀
 * X4 [지킴] 흐름(안 뜬) 프레임은 옛 그대로 — X 칸 = translateX · 넣으면 translateX
 * 양성대조: _patches/t13d-05b-CTL-xy.patch(prop-frame.js·overlay-float.js 고침 걷음) → X1·X2·X3 빨강 · X4 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    c.querySelector('.section-block').id = 'sX'; window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sX'), inner = sec.querySelector('.section-inner'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const fresh = (sel, fn) => { const before = new Set(sec.querySelectorAll(sel)); window.deselectAll(); window.selectSection(sec); fn(); return [...sec.querySelectorAll(sel)].find((x) => !before.has(x)); };
    const t = fresh('.frame-block[data-text-frame]', () => window.addTextBlock('body')); t.id = 'tfT'; const ed = t.querySelector('[class^="tb-"]'); ed.textContent = '위 글자'; delete ed.dataset.isPlaceholder;
    const fr = fresh('.frame-block:not([data-text-frame])', () => window.addFrameBlock()); fr.id = 'frO';
    window.updateFrameBlock?.('frO', { width: 360, height: 180 });
    window.rebindAll?.(); window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  await raf(page);
  return errs;
}
async function pickFrame(page) {
  const r = await page.evaluate(() => { const q = document.getElementById('frO').getBoundingClientRect(); return [q.right - 30, q.bottom - 30]; });
  await page.mouse.click(r[0], r[1]); await raf(page);
  await page.evaluate(() => { const f = document.getElementById('frO'); if (!f.classList.contains('selected')) window.selectBlock?.('frO'); window.showFrameProperties?.(f); window.showHandlesFor?.(f); });
  await raf(page);
}
async function toggle(page) {
  const b = await page.evaluate(() => { const e = document.getElementById('ss-float-toggle'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  expect(b, '[전제] 프레임 패널에 오버레이 단추').toBeTruthy(); await page.mouse.click(b[0], b[1]); await raf(page);
}
/* 화면 실측 좌표(섹션 기준 · 배율 나눔) ↔ 패널 칸 */
const xy = (page) => page.evaluate(() => { const f = document.getElementById('frO'), s = document.getElementById('sX'), z = (window.currentZoom || 100) / 100;
  const fr = f.getBoundingClientRect(), sr = s.getBoundingClientRect(), X = document.getElementById('ss-pos-x'), Y = document.getElementById('ss-pos-y');
  return { ov: f.dataset.overlayBlock || null, screen: [Math.round((fr.left - sr.left) / z), Math.round((fr.top - sr.top) / z)], panel: X && Y ? [Number(X.value), Number(Y.value)] : null, tx: f.dataset.translateX ?? null, tf: f.style.transform || '' }; });
const near = (a, b) => a && b && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;

test('X1 오버레이 단추 → 패널 X/Y = 화면 실측 좌표(0,0 아님)', async ({ page }) => {
  const errs = await scene(page);
  await pickFrame(page); await toggle(page);
  await pickFrame(page);   // 패널을 지금 상태로 다시 그림(사람이 다시 고른 것과 같음)
  const s = await xy(page);
  expect(s.ov, '[전제] 떴다').toBe('true');
  expect(s.screen[1] > 0 && s.screen.some((v) => v !== 0), `[전제] 화면 좌표가 0,0 이 아닌 자리 ${JSON.stringify(s)}`).toBe(true);
  expect(near(s.panel, s.screen), `★패널 X/Y = 화면 실측 ${JSON.stringify(s)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('X2 끌면 X/Y 칸이 새 화면 좌표를 따라옴', async ({ page }) => {
  const errs = await scene(page);
  await pickFrame(page); await toggle(page); await pickFrame(page);
  const a = await xy(page);
  const p = await page.evaluate(() => { const q = document.getElementById('frO').getBoundingClientRect(); return [q.right - 30, q.bottom - 30]; });
  await page.mouse.move(p[0], p[1]); await page.mouse.down();
  await page.mouse.move(p[0] + 140, p[1] + 70, { steps: 10 });
  await page.mouse.up(); await raf(page);
  const b = await xy(page);
  expect(b.screen[0] > a.screen[0] && b.screen[1] > a.screen[1], `[전제] 끌기가 먹었다(오른쪽 아래로 옮김 · 두 측정 견줌) ${JSON.stringify([a.screen, b.screen])}`).toBe(true);
  expect(near(b.panel, b.screen), `★끈 뒤 패널 = 새 화면 좌표 ${JSON.stringify(b)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('X3 X 칸에 50 → 프레임이 섹션 왼쪽 50 · translate 안 씀', async ({ page }) => {
  const errs = await scene(page);
  await pickFrame(page); await toggle(page); await pickFrame(page);
  await page.locator('#ss-pos-x').fill('50'); await page.locator('#ss-pos-x').press('Enter'); await raf(page);
  const s = await xy(page);
  expect(s.screen[0], `★화면 X = 50 ${JSON.stringify(s)}`).toBe(50);
  expect([s.tx, /translate/.test(s.tf)], '★translate 안 씀(자리로 옮김)').toEqual([null, false]);
  expect(errs).toEqual([]);
});

test('X4 [지킴] 흐름(안 뜬) 프레임 X 칸 = translateX · 넣으면 translateX', async ({ page }) => {
  const errs = await scene(page);
  await pickFrame(page);
  const a = await xy(page);
  expect([a.ov, a.panel && a.panel[0]], '[전제] 흐름 · X 칸 = translateX(0)').toEqual([null, 0]);
  await page.locator('#ss-pos-x').fill('12'); await raf(page);
  const b = await xy(page);
  expect([b.ov, b.tx], '★흐름은 옛 그대로 translateX').toEqual([null, '12']);
  expect(errs).toEqual([]);
});
