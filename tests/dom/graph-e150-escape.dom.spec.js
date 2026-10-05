/* graph-e150-escape.dom.spec.js — E150 꺾은선 카테고리 라벨 이스케이프 (태양 lane-f-graph 2026-10-05 · 지디 결정 «이번 묶음»)
 * 옛: drag-utils 꺾은선 .grb-line-xlabel 이 `${o.p.label}` 를 그대로 innerHTML 에 넣어 `<b>x</b>` 가 태그로 읽혔다(막대 셋은 _escGraphHtml).
 * 고침: 그 한 자리만 _escGraphHtml(같은 꼴의 나머지 자리는 명부 — 이번엔 안 고친다).
 * 두 길: P1 패널 라벨 칸(.grb-data-label-input)에 실타이핑 · P2 캔버스 라벨 실더블클릭 편집(K8⒤).
 * 양성대조: d1f642ff 나무 안 → P1 P2 빨강 · P3(막대 — 옛날에도 이스케이프) 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-e150-escape.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const EVIL = '<b>x</b>';

async function setup(page, chartType) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((chartType) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('sG')); window.addGraphBlock({ chartType });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop(); window.deselectAll?.(); return g.id;
  }, chartType);
  return { errs, id };
}
async function stable(page, id, sel, i = 0) {
  let prev = null;
  for (let k = 0; k < 40; k++) {
    const r = await page.evaluate(([id, sel, i]) => { const e = document.getElementById(id)?.querySelectorAll(sel)[i]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }, [id, sel, i]);
    if (r && prev && r.join() === prev.join()) return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 };
    prev = r; await page.waitForTimeout(150);
  }
  throw new Error(`stable: ${sel}[${i}] 가 안 멈췄다`);
}
async function select(page, id, sel) {
  const p = await stable(page, id, sel, 0);
  await clickAt(page, p.x, p.y, { sel: '.graph-block' }, { label: '그래프 선택' });
  await page.waitForSelector('.grb-data-label-input', { timeout: 3000 });
}
const look = (page, id, sel) => page.evaluate(([id, sel]) => { const e = document.getElementById(id).querySelectorAll(sel)[0]; return { text: e.textContent, kids: e.children.length }; }, [id, sel]);

test('P1 ★꺾은선 · 패널 라벨 칸에 `<b>x</b>` 실타이핑 → 캔버스엔 글자 그대로 · 자식 요소 0', async ({ page }) => {
  const { errs, id } = await setup(page, 'line');
  await select(page, id, '.grb-line-xlabel');
  const inp = page.locator('.grb-data-label-input').first();
  await inp.scrollIntoViewIfNeeded(); await inp.click(); await page.keyboard.press('Meta+a'); await page.keyboard.type(EVIL);
  await expect.poll(() => look(page, id, '.grb-line-xlabel')).toEqual({ text: EVIL, kids: 0 });
  expect(errs).toEqual([]);
});
test('P2 ★꺾은선 · 캔버스 라벨 더블클릭 편집으로 `<b>x</b>` → 글자 그대로 · 자식 요소 0', async ({ page }) => {
  const { errs, id } = await setup(page, 'line');
  await select(page, id, '.grb-line-xlabel');
  const q = await stable(page, id, '.grb-line-xlabel', 0);
  await clickAt(page, q.x, q.y, { sel: '.grb-line-xlabel' }, { label: '라벨 더블클릭', dbl: true });
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.matches('.grb-line-xlabel') && document.activeElement.isContentEditable), { message: '편집 진입', timeout: 3000 }).toBe(true);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(EVIL); await page.keyboard.press('Enter');
  await expect.poll(() => look(page, id, '.grb-line-xlabel')).toEqual({ text: EVIL, kids: 0 });
  expect(errs).toEqual([]);
});
test('P3 막대(세로) · 패널 `<b>x</b>` → 글자 그대로(옛날에도 _escGraphHtml — 음성대조)', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  await select(page, id, '.grb-bar-label');
  const inp = page.locator('.grb-data-label-input').first();
  await inp.scrollIntoViewIfNeeded(); await inp.click(); await page.keyboard.press('Meta+a'); await page.keyboard.type(EVIL);
  await expect.poll(() => look(page, id, '.grb-bar-label')).toEqual({ text: EVIL, kids: 0 });
  expect(errs).toEqual([]);
});
