/* graph-bar-label-frame-dbl-6634 — 프레임 안 막대 그래프 범주 라벨은 첫 더블클릭에 글이 열린다 (시트 148 · 현빈 결정 6634)
 * 왜: 프레임 더블클릭 = «한 겹 내려가기»(js/drag-utils.js _dblGesture)가 라벨 더블클릭도 먹어, 글은 둘째 더블클릭에야 열렸다(앱 값 0/1 · 프레임 밖 1/1).
 * 칸: B1 세로 · B2 가로 · B3 비교 = 첫 더블클릭 편집 · 고친 글이 items 에 저장 · ⌘Z 한 번에 돌아옴
 *     B4 [음성] 프레임 안 글상자 = 한 겹 그대로(편집 아님 · 그 글상자 골림) · B5 [음성] 프레임 안 막대 몸통 = 편집 아님 · B6 [음성] 프레임 밖 라벨 = 첫 더블클릭 편집
 * 변이: 고침 한 줄을 빼면 B1·B2·B3 빨강 · 나머지 초록 | 한 겹 내려가기를 통째로 끄면 B4 빨강.
 * ⛔고정 대기 0.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sF" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';

async function scene(page, make, inFrame = true) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await waitZoomSettled(page, 40);
  await page.evaluate(() => window.applyZoom(100));
  await waitZoomSettled(page, 100);
  const id = await page.evaluate(([html, make, inFrame]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.();
    const S = document.getElementById('sF'); window.deselectAll?.(); window._activeFrame = null; window.selectSection(S);
    if (inFrame) {
      const before = new Set([...S.querySelectorAll('.frame-block')]);
      window.addFrameBlock();
      const fr = [...S.querySelectorAll('.frame-block:not([data-text-frame])')].find((f) => !before.has(f));
      fr.style.height = '700px'; fr.style.minHeight = '700px';
      window.deselectAll?.(); window._activeFrame = fr;
    }
    if (make.text) window.addTextBlock('body'); else window.addGraphBlock({ chartType: make.chart });
    const el = [...S.querySelectorAll(make.text ? '.text-block' : '.graph-block')].pop();
    window.deselectAll?.(); window._activeFrame = null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    return el.id;
  }, [SEC, make, inFrame]);
  await waitStableRect(page, '#' + id);
  return { errs, id };
}
const inFrameOk = (page, id) => page.evaluate((id) => !!document.getElementById(id).closest('.frame-block:not([data-text-frame])'), id);
const editing = (page, sel) => page.evaluate((sel) => !!document.activeElement?.isContentEditable && document.activeElement.matches(sel), sel);
const label1 = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items)[1].label, id);
async function dblLabel(page, id, sel) {
  const r = await waitStableRect(page, `#${id} ${sel}`, { index: 1 });
  await page.mouse.dblclick(r.cx, r.cy);
}

for (const [name, chart, sel] of [['B1 세로 막대', 'bar-v', '.grb-bar-label'], ['B2 가로 막대', 'bar-h', '.grb-bar-h-desc'], ['B3 비교 막대', 'bar-pair', '.grb-bar-label']]) {
  test(`${name} — 프레임 안 라벨 첫 더블클릭에 글이 열리고 저장 · ⌘Z 한 번`, async ({ page }) => {
    const { errs, id } = await scene(page, { chart });
    expect(await inFrameOk(page, id), '[전제] 프레임 안').toBe(true);
    const old = await label1(page, id);
    await dblLabel(page, id, sel);
    await expect.poll(() => editing(page, sel), '★첫 더블클릭에 편집이 안 열렸다').toBe(true);
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('새이름');
    await page.keyboard.press('Meta+Enter');
    await expect.poll(() => label1(page, id), '★고친 글이 저장 자리에').toBe('새이름');
    await page.keyboard.press('Meta+z');
    await expect.poll(() => label1(page, id), '★⌘Z 한 번에 돌아온다').toBe(old);
    expect(errs).toEqual([]);
  });
}

test('B4 [음성] 프레임 안 글상자 — 첫 더블클릭은 한 겹 내려가기 그대로', async ({ page }) => {
  const { errs, id } = await scene(page, { text: true });
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.dblclick(r.cx, r.cy);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '그 글상자가 골린다').toBe(true);
  expect(await page.evaluate(() => !!document.activeElement?.isContentEditable), '★편집이 열리면 안 된다').toBe(false);
  expect(errs).toEqual([]);
});

test('B5 [음성] 프레임 안 막대 몸통 — 첫 더블클릭은 편집 아님', async ({ page }) => {
  const { errs, id } = await scene(page, { chart: 'bar-v' });
  const r = await waitStableRect(page, `#${id} .grb-bar-fill`);
  await page.mouse.dblclick(r.cx, r.cy);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '그래프가 골린다').toBe(true);
  expect(await page.evaluate(() => !!document.activeElement?.isContentEditable), '★편집이 열리면 안 된다').toBe(false);
  expect(errs).toEqual([]);
});

test('B6 [음성] 프레임 밖 라벨 — 첫 더블클릭 편집 그대로', async ({ page }) => {
  const { errs, id } = await scene(page, { chart: 'bar-v' }, false);
  expect(await inFrameOk(page, id), '[전제] 프레임 밖').toBe(false);
  await dblLabel(page, id, '.grb-bar-label');
  await expect.poll(() => editing(page, '.grb-bar-label')).toBe(true);
  expect(errs).toEqual([]);
});
