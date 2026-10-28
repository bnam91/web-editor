/* annot-label-offset-drag-click-237.dom.spec.js — 어노테이션 «라벨 위치 끌기»(annotation-select.js _startLabelOffsetDrag) 뒤 click 이 새어 선택·패널이 풀리지 않는다 (237)
 *
 * 까닭(S5 261029 · 판 333aa3d9): 끈 뒤 브라우저 click 의 대상 = mousedown·mouseup 공통 조상(섹션 밖이면 캔버스 바깥) ⇒ 안 삼키면 deselectAll 이 고름을 푼다.
 *   그 자리의 window.swallowNextClick() 은 공용 본문 무력화(220·237 ⒜ 분모 12)에서 «잡는 spec 없음» 이었다 — 이 검사가 그 자를 세운다.
 *   행위 탐침: 그대로 5/5 유지 · 무력화 5/5 풀림(261028 · 판 6f30a34d).
 * 장면 = annotation-1013t2c6-label-box 의 setup·makeAnnotation·selectByLabel 꼴 · ★놓는 점의 임자를 «먼저» 단언(라벨은 오프셋 상한 ±600 안에서 손을 따라온다 ⇒ 섹션 밖·상한 너머에 놓는다).
 * 한 쌍: 이 자리 한 줄만 끈 사본(GD1001_ROOT) 에서 A 빨강 · 그대로 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const SEC = '[id="secA"]';

async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.applyPagePadX?.(window.state?.pageSettings?.padX);
    window.buildLayerPanel?.();
  });
}

const annotCount = (page) => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length);

async function makeAnnotation(page, { p1 = [0.2, 0.3], p2 = [0.35, 0.5] } = {}) {
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
  await page.keyboard.type('라벨 너비 재기 글');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), 'Esc 로 펜 모드 종료').toBe(false);
  const id = await page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.text, id), '★전제: 친 글이 확정됐다').toBe('라벨 너비 재기 글');
  return id;
}

async function selectByLabel(page, id) {
  const sel = `[id="${id}"] .annot-label`;
  const lr = await waitStableRect(page, sel);
  await clickAt(page, lr.cx, lr.cy, { sel }, { label: '라벨' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected')
    && !!document.querySelector('#panel-right [data-prop-panel="annotation"]'), id), '★전제: 골랐고 어노테이션 패널이 떴다').toBe(true);
}


test('A annotation-select:471 라벨 위치 끌기 — 섹션 밖(상한 너머)에서 놓기 ⇒ 선택·패널 유지', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await bootApp(page); await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const sel = `[id="${id}"] .annot-label`;
  /* 라벨 «고르기»(둘째 클릭) — 이미 골라진 라벨을 누를 때만 위치 끌기가 선다(annotation-select.js 머리 주석) */
  for (let k = 0; k < 3; k++) {
    const lr = await waitStableRect(page, sel);
    await page.mouse.click(lr.cx, lr.cy);
    if (await page.waitForFunction((s) => !!document.querySelector(s + '.annot-cell-selected'), sel, { timeout: 1500 }).then(() => true, () => false)) break;
  }
  expect(await page.evaluate((s) => !!document.querySelector(s + '.annot-cell-selected'), sel), '전제: 라벨이 골라졌다').toBe(true);
  const lr = await waitStableRect(page, sel);
  const sec = await waitStableRect(page, SEC);
  /* 섹션 안에서는 라벨이 상한(±600 모델 px) 안이라 손을 끝까지 따라온다(앞 판 5/5) ⇒ 섹션 «밖»(아래 canvas-wrap)으로 상한 너머까지 */
  const far = { x: Math.round(lr.cx), y: Math.round(Math.min(985, sec.top + sec.height + 300)) };
  await page.mouse.move(lr.cx, lr.cy); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(lr.cx + (far.x - lr.cx) * i / 12, lr.cy + (far.y - lr.cy) * i / 12);
  const o = await page.evaluate(([x, y, i]) => { const h = document.elementFromPoint(x, y); return { outside: !h?.closest?.('#' + i), inSec: !!h?.closest?.('#secA'), at: h ? (h.id || h.className || h.tagName).toString().slice(0, 40) : null }; }, [far.x, far.y, id]);
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));   // ⛔waitForFunction 에 Promise 술어 금지(182)
  const r = await page.evaluate((i) => { const b = document.getElementById(i); return { sel: b.classList.contains('selected'), panel: !!document.querySelector('#panel-right [data-prop-panel="annotation"]'), moved: b.dataset.labelDx != null || b.dataset.labelDy != null }; }, id);
  
  expect(o.outside && !o.inSec, '전제: 놓는 점이 섹션 밖 · 어노테이션 밖 · 임자 ' + o.at).toBe(true);
  expect(r.moved, '전제: 라벨 위치 끌기가 걸렸다(labelDx/Dy)').toBe(true);
  expect({ sel: r.sel, panel: r.panel }, '★끈 뒤 click 이 새어 선택·패널이 풀렸다').toEqual({ sel: true, panel: true });
});
