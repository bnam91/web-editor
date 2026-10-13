/* annotation-1013 — 스티커패널 어노테이션 블럭 (1013t1A1·A2·A3).
 *
 * ★무엇을 잠그나
 *   AN1 만들면 «바로» 좌측 레이어에 「Annotation」 행(아이콘·Sticker 태그)이 선다 (A1)
 *   AN2 그 행을 누르면 어노테이션 패널 + 점 핸들이 뜬다 (A1)
 *   AN3 지우면 «죽은 행»이 안 남는다 (A1)
 * ★만드는 길은 «사람 손» 그대로 — 펜 단추 → 메뉴 「Annotation」 → 섹션 두 점 → Enter → Esc.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';

/* 빈 섹션 하나. */
async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.buildLayerPanel?.();
  });
}

const annotCount = (page) => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length);
const layerRows = (page) => page.evaluate(() => document.querySelectorAll('#layer-panel-body .layer-item').length);

/* 펜 단추 → 「Annotation」 → 두 점 → Enter(라벨 편집 진입) → Esc(확정·펜 종료). 돌려줌: 만든 블럭 id. */
async function makeAnnotation(page, { p1 = [0.2, 0.3], p2 = [0.45, 0.6] } = {}) {
  const before = await annotCount(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * p1[0], r.top + r.height * p1[1], { sel: SEC }, { label: '첫 점' });
  await clickAt(page, r.left + r.width * p2[0], r.top + r.height * p2[1], { sel: SEC }, { label: '둘째 점' });
  await page.keyboard.press('Enter');
  await expect.poll(() => annotCount(page), 'Enter 로 어노테이션 하나가 생겼다').toBe(before + 1);
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList?.contains('annot-label')), '생성 직후 라벨 편집에 들어갔다').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), 'Esc 로 펜 모드 종료').toBe(false);
  return page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
}

const rowOf = (page, id) => page.evaluate((id) => {
  const it = [...document.querySelectorAll('#layer-panel-body .layer-item')].find(i => i._dragTarget?.id === id);
  if (!it) return null;
  return { type: it.dataset.layerType, name: it.querySelector('.layer-item-name')?.textContent, tag: it.querySelector('.layer-item-type')?.textContent,
    icon: !!it.querySelector('svg.layer-item-icon'), active: it.classList.contains('active') };
}, id);

test('AN1 만들면 바로 레이어에 「Annotation」 행이 선다 (아이콘 · Sticker 태그)', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  expect(await annotCount(page), '★전제: 어노테이션 0').toBe(0);
  const rows0 = await layerRows(page);
  const id = await makeAnnotation(page);
  await expect.poll(() => rowOf(page, id), '만든 직후(다른 동작 없이) 행이 있다').toEqual({ type: 'annotation', name: 'Annotation', tag: 'Sticker', icon: true, active: false });
  expect(await layerRows(page), '행 수 = 전 + 1').toBe(rows0 + 1);
  expect(errs).toEqual([]);
});

test('AN2 레이어 행을 누르면 어노테이션 패널 + 점 핸들이 뜬다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await expect.poll(() => rowOf(page, id)).not.toBeNull();
  expect(await page.evaluate(() => document.querySelectorAll('.annot-handle').length), '★전제: 누르기 전 핸들 0').toBe(0);
  const rowSel = '#layer-panel-body .layer-item[data-layer-type="annotation"]';
  const rr = await waitStableRect(page, rowSel);
  await clickAt(page, rr.cx, rr.cy, { sel: rowSel }, { label: '레이어 행' });
  await expect.poll(() => page.evaluate((id) => {
    const b = document.getElementById(id);
    return { sel: b.classList.contains('selected'), handles: b.querySelectorAll('.annot-handle').length,
      panel: !!document.querySelector('#panel-right [data-prop-panel="annotation"]') };
  }, id), '선택 + 핸들 2 + 어노테이션 패널').toEqual({ sel: true, handles: 2, panel: true });
  expect((await rowOf(page, id)).active, '그 행이 켜졌다').toBe(true);
});

test('AN3 지우면 레이어에 죽은 행이 안 남는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await expect.poll(() => rowOf(page, id)).not.toBeNull();
  const lr = await waitStableRect(page, `[id="${id}"] .annot-label`);
  await clickAt(page, lr.cx, lr.cy, { sel: `[id="${id}"] .annot-label` }, { label: '라벨' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '★전제: 캔버스에서 골랐다').toBe(true);
  await page.keyboard.press('Backspace');
  await expect.poll(() => annotCount(page), 'Backspace 로 지워졌다').toBe(0);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#layer-panel-body .layer-item')].filter(i => i._dragTarget && !i._dragTarget.isConnected).length),
    '지운 블럭을 가리키는 행 0').toBe(0);
  expect(await rowOf(page, id), '그 블럭의 행이 없다').toBeNull();
});
