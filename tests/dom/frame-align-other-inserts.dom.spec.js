/* frame-align-other-inserts.dom.spec.js — E135: E122 공용 정렬을 «안 거치던» 넣기 길(붙여넣기 · 템플릿 넣기 · T▾ fullWidth)도 프레임 정렬을 따른다 (2026-10-06 lane-esweep · 태양 승인 01:26)
 * 판정 = E122 와 같은 정의: 새로 들어온 것의 자리 == 같은 정렬 단추를 «다시 누른» 뒤 자리.
 * 장면: «오른쪽»을 준 fullWidth 스택 프레임 FR(안에 Heading 하나 — 드릴 대상) + FR «밖» 섹션의 Object 에셋(가운데 · 붙여넣기 원본).
 * 손: 프레임 고르기·정렬 단추·드릴·메뉴 = clickAt(맞힌 요소 단언) · ⌘C/⌘V/⌘D = 키보드(하네스 electronAPI 가짜 → OS 클립보드 안 닿음).
 * 머리표: [새 것] 2eb78685 에서 빨강 · [지킴] 2eb78685 에서도 초록 · [전제] 재기 위한 조건. 예측 = reports/esweep/predict-e135.md.
 * ⛔못 보는 꼴: 프레임 안으로 «끌어 넣기»(block-drag.js — lane-drag 몫) · MCP add_* · 진짜 템플릿 창(여기는 그 창이 부르는 문을 JS 로).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
test.describe.configure({ timeout: 60000 });

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="0" style="padding-left:0;padding-right:0"></div></div>`);
    const inner = document.querySelector('#sec1 .section-inner');
    const ss = window.makeFrameBlock({ fullWidth: true }); ss.id = 'FR'; ss.style.width = '860px'; ss.style.padding = '30px'; ss.dataset.width = '860'; ss.style.minHeight = '200px';
    inner.appendChild(ss);
    window.rebindAll?.(); window.deselectAll?.();
    window._activeFrame = ss; window.addTextBlock('h2'); window._activeFrame = null;                 // [전제·JS] 드릴 대상 자식 하나
    window.deselectAll?.(); window.selectSection?.(document.getElementById('sec1'));
    const before = new Set([...document.querySelectorAll('.asset-block')]);
    window.addAssetBlock('small');                                                                   // [전제·JS] 프레임 «밖» 붙여넣기 원본(가운데)
    const src = [...document.querySelectorAll('.asset-block')].find(e => !before.has(e)); src.id = 'SRC';
    window.deselectAll?.(); window.applyZoom?.(100);
  });
  expect(await page.evaluate(() => !document.getElementById('FR').contains(document.getElementById('SRC'))), '[전제] 원본은 프레임 밖').toBe(true);
  return errs;
}
async function pickFrame(page) {
  await page.evaluate(() => { window.deselectAll?.(); document.getElementById('FR').scrollIntoView({ block: 'center' }); });
  const p = await page.evaluate(() => { const f = document.getElementById('FR'); const r = f.getBoundingClientRect(); for (let y = Math.round(r.bottom - 4); y > r.top; y -= 3) for (const x of [Math.round(r.right - 6), Math.round(r.left + 6)]) if (document.elementFromPoint(x, y) === f) return [x, y]; return null; });
  expect(p, '[전제] 프레임 빈 곳').toBeTruthy();
  await clickAt(page, p[0], p[1], { sel: '#FR' }, { label: '프레임 고르기' });
  await page.waitForFunction(() => document.getElementById('FR').classList.contains('selected') && !!document.getElementById('ss-align-right'), null, { timeout: 3000 });
}
async function align(page, btnId) {
  await pickFrame(page);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), btnId);
  const b = await waitStableRect(page, '#' + btnId);
  await clickAt(page, b.cx, b.cy, { sel: `[id="${btnId}"]` }, { label: btnId });
  await page.waitForTimeout(250);
}
async function drillIn(page) {
  await pickFrame(page);
  const k = await page.evaluate(() => { const t = document.querySelector('#FR .text-block [class^="tb-"]'); const r = t.getBoundingClientRect(); return [Math.round(r.left + 12), Math.round(r.top + r.height / 2)]; });
  await clickAt(page, k[0], k[1], { sel: '#FR .text-block' }, { label: '자식 클릭(들어가기)' });
  await page.waitForTimeout(300);
}
const markKnown = (page) => page.evaluate(() => { window.__known = new Set([...document.getElementById('FR').children]); });
const newTop = (page) => page.evaluate(() => { const t = [...document.getElementById('FR').children].find(e => !window.__known.has(e)); if (t) t.dataset.e135 = '1'; return !!t; });
/** 새로 들어온 직계 자식(data-e135)의 «보이는 블럭» 자리 — 프레임 안쪽 상자 기준 L/R · alignSelf */
const pos = (page) => page.evaluate(() => {
  const FR = document.getElementById('FR'); const top = FR.querySelector(':scope > [data-e135="1"]');
  const blk = (top.matches('[class*="-block"]:not(.row)') && !top.dataset.textFrame) ? top : (top.querySelector('[class*="-block"]:not(.frame-block[data-text-frame])') || top);
  const fr = FR.getBoundingClientRect(), cs = getComputedStyle(FR); let q = blk.getBoundingClientRect();
  if (blk.classList.contains('text-block')) { const r = document.createRange(); r.selectNodeContents(blk.querySelector('[class^="tb-"]') || blk); q = r.getBoundingClientRect(); }
  return { kind: blk.className.split(' ')[0], L: Math.round(q.left - (fr.left + parseFloat(cs.paddingLeft))), R: Math.round((fr.right - parseFloat(cs.paddingRight)) - q.right), self: getComputedStyle(top).alignSelf };
});
/** E122 정의: 새 것의 자리 == 단추를 다시 누른 뒤 자리 */
async function expectFollows(page, tag, btn = 'ss-align-right') {
  expect(await newTop(page), `[전제] ${tag}: 프레임 안에 새 직계 자식이 생겼다`).toBe(true);
  const a = await pos(page);
  await align(page, btn);
  const b = await pos(page);
  expect(Math.abs(a.L - b.L) <= 1 && Math.abs(a.R - b.R) <= 1, `${tag}: 넣은 자리 ${JSON.stringify(a)} == 다시 누른 자리 ${JSON.stringify(b)}`).toBe(true);
  return { a, b };
}

test('N1 [새 것] 붙여넣기 — 밖의 Object 를 «오른쪽» 프레임 안(드릴)에 ⌘V → 오른쪽', async ({ page }) => {
  const errs = await setup(page);
  await align(page, 'ss-align-right');
  const s = await page.evaluate(() => { const e = document.getElementById('SRC'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; });
  await page.evaluate(() => window.deselectAll?.());
  await clickAt(page, s[0], s[1], { sel: '#SRC' }, { label: '원본 고르기' }); await page.waitForTimeout(250);
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(250);
  await drillIn(page); await markKnown(page);
  await page.keyboard.press('Meta+v'); await page.waitForTimeout(500);
  const { a } = await expectFollows(page, 'N1');
  expect(a.R <= 1 && a.L > 20, `N1: 에셋이 오른쪽 끝 · ${JSON.stringify(a)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('N3 [새 것] 템플릿 넣기 길 — 드릴 상태에서 insertAfterSelected(sec, row)(template-system 이 부르는 그 문) → 오른쪽', async ({ page }) => {
  const errs = await setup(page);
  await align(page, 'ss-align-right');
  await drillIn(page); await markKnown(page);
  await page.evaluate(() => {   // [전제·JS] 템플릿 «블럭» 넣기와 같은 꼴: 원본 row 를 복제해 그 문으로 넣는다
    const srcRow = document.getElementById('SRC').closest('.row') || document.getElementById('SRC');
    const row = srcRow.cloneNode(true); row.querySelectorAll('[id]').forEach(e => { e.id = e.id + '_t'; }); if (row.id) row.id += '_t';
    window.insertAfterSelected(document.getElementById('sec1'), row);
  });
  await page.waitForTimeout(300);
  const { a } = await expectFollows(page, 'N3');
  expect(a.R <= 1 && a.L > 20, `N3: 오른쪽 끝 · ${JSON.stringify(a)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('N4 [새 것 · 판정 꼴은 예측 표 참조] T▾ Body — 드릴 상태(fullWidth 갈래) → 다시 누른 자리와 같다', async ({ page }) => {
  const errs = await setup(page);
  await align(page, 'ss-align-right');
  await drillIn(page); await markKnown(page);
  const tsel = 'button.fp-dropdown-trigger[title^="텍스트 블록 추가"]';
  const t = await waitStableRect(page, tsel);
  await clickAt(page, t.cx, t.cy, { sel: tsel }, { label: '플로팅 T' });
  await page.waitForFunction(() => [...document.querySelectorAll('.fp-menu-item')].some(e => e.innerText.trim() === 'Body' && e.getBoundingClientRect().width > 0), null, { timeout: 3000 });
  const it = await page.evaluate(() => { const e = [...document.querySelectorAll('.fp-menu-item')].find(e => e.innerText.trim() === 'Body' && e.getBoundingClientRect().width > 0); e.dataset.e135m = '1'; const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await clickAt(page, it[0], it[1], { sel: '[data-e135m="1"]' }, { label: '메뉴 Body' }); await page.waitForTimeout(400);
  const { a, b } = await expectFollows(page, 'N4');
  expect(a.self, `N4: 글자 프레임 align-self(넣은 직후) = 다시 누른 뒤 · ${a.self} vs ${b.self}`).toBe(b.self);
  expect(errs).toEqual([]);
});

test('N5 [새 것 · 판정 꼴은 예측 표 참조] addBlankTextBlock(fullWidth 갈래 · 태양 승인 다섯째 자리) — 다시 누른 자리와 같다', async ({ page }) => {
  /* [전제·JS] 앱 안에서 이 함수를 부르는 자리는 0 이다(T 키 = addTextBlock · editor.js:2863) — window 노출뿐이라 그 문을 직접 부른다. */
  const errs = await setup(page);
  await align(page, 'ss-align-right');
  await drillIn(page); await markKnown(page);
  await page.evaluate(() => window.addBlankTextBlock('body'));
  await page.waitForTimeout(300);
  const { a, b } = await expectFollows(page, 'N5');
  expect(a.self, `N5: 글자 프레임 align-self(넣은 직후) = 다시 누른 뒤 · ${a.self} vs ${b.self}`).toBe(b.self);
  expect(errs).toEqual([]);
});

test('N2 [지킴] ⌘D — 프레임 안(이미 정렬된) 자식 복제는 다시 누른 자리와 같다', async ({ page }) => {
  const errs = await setup(page);
  await align(page, 'ss-align-right');
  await drillIn(page); await markKnown(page);
  await page.keyboard.press('Meta+d'); await page.waitForTimeout(500);
  await expectFollows(page, 'N2');
  expect(errs).toEqual([]);
});

test('N0 [지킴] 정렬을 «안 준» 프레임에 붙여넣기 — 종전대로 가운데', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => document.getElementById('FR').dataset.alignItems ?? null), '[전제] 정렬 값 없음').toBe(null);
  const s = await page.evaluate(() => { const e = document.getElementById('SRC'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; });
  await page.evaluate(() => window.deselectAll?.());
  await clickAt(page, s[0], s[1], { sel: '#SRC' }, { label: '원본 고르기' }); await page.waitForTimeout(250);
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(250);
  await drillIn(page); await markKnown(page);
  await page.keyboard.press('Meta+v'); await page.waitForTimeout(500);
  expect(await newTop(page), '[전제] 붙었다').toBe(true);
  const a = await pos(page);
  expect(a.L > 20 && Math.abs(a.L - a.R) <= 2, `N0: 가운데 그대로 · ${JSON.stringify(a)}`).toBe(true);
  expect(errs).toEqual([]);
});
