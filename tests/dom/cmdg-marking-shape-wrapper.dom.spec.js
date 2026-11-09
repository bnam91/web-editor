/* cmdg-marking-shape-wrapper — CMDG-MARKING-INTO-SHAPE-WRAPPER-01 (미카사 261109, v0.9.10 e7d97f1ec 에도 남).
 * 증상: 섹션에 떠 있는 마킹 + 흐름 도형(100×100 감싼 프레임 ss_…) 을 ⌘G → 「1개를 프레임 안으로 묶었어요」,
 *   그룹 없음, 마킹이 도형 감싼 프레임(overflow:hidden) 자식으로 들어가 잘려 사라짐.
 * 뿌리: wrapSelectedBlocksInFrame 의 「흐름 자유배치 프레임 + 떠 있는 것」 갈래가 도형 감싼 프레임(isShapeFrame)을
 *   «넣을 프레임»으로 잡았다. 고친 뒤엔 t5-08 갈래(흐름 블럭 + 떠 있는 것 → 새 그룹)를 탄다.
 * 양성대조(261109): js/block-factory.js 를 e7d97f1ec 판으로 되돌리면 S1·S2·S4 빨강 · S3·S5 초록(옛 판도 ⌘Z·진짜 프레임 길은 된다). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const real = (errs) => errs.filter((e) => !/svgPresets/.test(e));
const MARK = '#canvas .sticker-block[data-count]';

/* 실제 앱 길: 섹션 → 흐름 블럭(그림 대역) → 마킹 도구로 찍기 → 섹션 고르고 도형 Rectangle. */
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'secM';
    window.deselectAll(); window.selectSection(sec);
    window.addMockupBlock();   // 그림 대역 — 흐름 블럭(마킹이 그 위에 찍힌다)
    window.deselectAll();
    sec.scrollIntoView({ block: 'start' });
  });
  await raf(page);
  await page.evaluate(() => window.enterCountStickerMode());
  await page.waitForFunction(() => window._countStkState().armed === true);
  const r = await page.evaluate(() => { const b = document.getElementById('secM').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
  await clickAt(page, r.l + r.w * 0.3, r.t + 60, { sel: '[id="secM"]' }, { label: 'stamp' });
  await expect.poll(() => page.evaluate((s) => document.querySelectorAll(s).length, MARK)).toBe(1);
  await page.evaluate(() => window.exitCountStickerMode());
  await page.evaluate(() => {
    const mk = document.querySelector('#canvas .sticker-block[data-count]'); if (!mk.id) mk.id = 'mk1';
    const sec = document.getElementById('secM');
    window.deselectAll(); window.selectSection(sec); window._activeFrame = null;
    window.addShapeBlock('rectangle');
    window.deselectAll(); window.clearHistory?.();
  });
  await raf(page);
  return errs;
}

const ids = (page) => page.evaluate(() => {
  const mk = document.querySelector('#canvas .sticker-block[data-count]');
  const sh = document.querySelector('#secM .shape-block'); const sw = window.ShapeFrame.shapeFrameOf(sh);
  if (!sw.id) sw.id = 'sw1';
  return { mk: mk.id, sw: sw.id };
});
/* 섹션 기준 레이아웃 px 상자(캔버스 배율 ÷) */
const box = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); const se = document.getElementById('secM'); const sr = se.getBoundingClientRect(); const z = (sr.width / se.offsetWidth) || 1; const r = e.getBoundingClientRect(); return [r.left - sr.left, r.top - sr.top, r.width, r.height].map((v) => Math.round(v / z)); }, id);
const centre = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const layerHas = (page, id) => page.evaluate((id) => [...document.querySelectorAll('#layer-panel-body .layer-item')].some((i) => i._dragTarget?.id === id), id);
const state = (page, { mk, sw }) => page.evaluate(({ mk, sw }) => {
  const m = document.getElementById(mk), s = document.getElementById(sw), sec = document.getElementById('secM');
  const g = m.closest('.frame-block[data-group="true"]');
  const vis = (e) => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const sr = sec.getBoundingClientRect();
    return !!h && (h === e || e.contains(h)) && r.left >= sr.left - 1 && r.right <= sr.right + 1 && r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1; };
  return { group: !!g && g.contains(s), mkInSw: s.contains(m), mkParent: m.parentElement.id || m.parentElement.className, mkVis: vis(m), swVis: vis(s.querySelector('.shape-block') || s) };
}, { mk, sw });

async function pick(page, I, mod) {
  const [mx, my] = await centre(page, I.mk);
  await clickAt(page, mx, my, { sel: '#' + I.mk + ', #' + I.mk + ' *' }, { label: 'marking' });
  const [sx, sy] = await centre(page, I.sw);
  await page.keyboard.down(mod); await clickAt(page, sx, sy, { sel: '[id="' + I.sw + '"]' }, { label: 'shape' }); await page.keyboard.up(mod);
  await raf(page);
}
async function groupScene(page, mod) {
  const errs = await scene(page); const I = await ids(page);
  const before = { mk: await box(page, I.mk), sw: await box(page, I.sw) };
  await pick(page, I, mod);
  await page.keyboard.press('Meta+g'); await raf(page);
  return { errs, I, before };
}
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 1);

for (const [label, mod] of [['S1 ⌘클릭', 'Meta'], ['S2 ⇧클릭', 'Shift']]) test(`${label}: 마킹 + 도형 ⌘G → 한 그룹 · 둘 다 보임 · 자리 그대로 · 레이어에 마킹`, async ({ page }) => {
  const { errs, I, before } = await groupScene(page, mod);
  const s = await state(page, I);
  console.log(`  ${label}`, JSON.stringify(s), JSON.stringify(before), JSON.stringify({ mk: await box(page, I.mk), sw: await box(page, I.sw) }));
  expect(s.mkInSw, '마킹이 도형 감싼 프레임 안으로 삼켜졌다').toBe(false);
  expect(s.group, '마킹+도형 그룹(data-group)').toBe(true);
  expect(s.mkVis, '마킹 보임').toBe(true);
  expect(s.swVis, '도형 보임').toBe(true);
  expect(near(await box(page, I.mk), before.mk), '마킹 자리').toBe(true);
  expect(near(await box(page, I.sw), before.sw), '도형 자리').toBe(true);
  expect(await layerHas(page, I.mk), '레이어 패널에 마킹').toBe(true);
  expect(real(errs), errs.join(' | ')).toEqual([]);
});

test('S3 ⌘Z 한 번이 ⌘G 앞으로', async ({ page }) => {
  const { I, before } = await groupScene(page, 'Meta');
  await page.evaluate(() => window.deselectAll());
  await page.keyboard.press('Meta+z'); await raf(page);
  const s = await page.evaluate(({ mk }) => ({ groups: document.querySelectorAll('#secM .frame-block[data-group="true"]').length, parent: document.getElementById(mk).parentElement.id }), I);
  expect(s).toEqual({ groups: 0, parent: 'secM' });
  expect(near(await box(page, I.mk), before.mk)).toBe(true);
});

test('S4 저장 → 다시 열기 뒤에도 그룹이 남는다', async ({ page }) => {
  const { I } = await groupScene(page, 'Meta');
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await raf(page);
  const s = await page.evaluate(({ mk, sw }) => { const m = document.getElementById(mk), g = m?.closest('.frame-block[data-group="true"]'); return { group: !!g && !!g.querySelector('#' + sw), inSw: !!document.getElementById(sw)?.contains(m) }; }, I);
  expect(s).toEqual({ group: true, inSw: false });
});

test('S5 대조 — 진짜 자유배치 프레임 + 떠 있는 마킹 ⌘G 는 지금처럼 «프레임 안으로 (자리 그대로)»', async ({ page }) => {
  const errs = await scene(page);
  const I = await page.evaluate(() => {
    const sec = document.getElementById('secM');
    document.querySelector('#secM .shape-block')?.closest('.frame-block')?.remove();
    window.deselectAll(); window.selectSection(sec); window._activeFrame = null;
    const b = new Set(sec.querySelectorAll('.frame-block'));
    window.addFrameBlock();
    const f = [...sec.querySelectorAll('.frame-block')].find((x) => !b.has(x)); f.id = f.id || 'fr1';
    window.deselectAll(); window.clearHistory?.();
    return { mk: document.querySelector('#canvas .sticker-block[data-count]').id, fr: f.id, free: f.dataset.freeLayout };
  });
  expect(I.free, '[전제] 자유배치 프레임').toBe('true');
  await raf(page);
  const [mx, my] = await centre(page, I.mk);
  await clickAt(page, mx, my, { sel: '#' + I.mk + ', #' + I.mk + ' *' }, { label: 'marking' });
  const fr = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + 8, r.top + 8]; }, I.fr);
  await page.keyboard.down('Meta'); await page.mouse.click(fr[0], fr[1]); await page.keyboard.up('Meta');
  await page.evaluate(() => { window.__t = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__t.push(String(m)); return o?.(m, ...a); }; });
  await page.keyboard.press('Meta+g'); await raf(page);
  const s = await page.evaluate(({ mk, fr }) => ({ parent: document.getElementById(mk).parentElement.id === fr, toast: window.__t.some((t) => /프레임 안으로 묶었어요/.test(t)) }), I);
  expect(s).toEqual({ parent: true, toast: true });
  expect(real(errs), errs.join(' | ')).toEqual([]);
});
