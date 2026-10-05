/* small-fixes-e148-e38-e28.dom.spec.js — lane-esweep 작은 고침 셋의 시험 (2026-10-06 · 태양 승인 «＋» 줄)
 *   E148 — ⌘C 가 OS 클립보드로 보내는 글자에 편집 UI(이미지 편집 안내 · 섹션 라벨/툴바)가 섞였다. ⛔하네스 electronAPI 는 가짜(OS 클립보드 안 닿음) — window._internalClipboardText 를 읽는다.
 *   E38  — Icon Text 에선 Type 절(H1·Cap — 눌러도 화면 변화 0)을 안 보인다(⒜ · ⒝ 먹게 하기는 현빈 쪽 ⑱).
 *   E28  — ＋(태그블럭 · 그리드)의 «잡는 자리»만 화면 최소 24px · 보이는 원은 모델 40px 그대로(H9).
 * 머리표: [새 것] 고치기 전 빨강 · [지킴] 고치기 전에도 초록. 예측 = reports/esweep/predict-small.md.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
test.describe.configure({ timeout: 60000 });
const SEC = `<div class="section-block" id="sX" data-section="1" data-name="섹션이름X"><div class="section-hitzone"><span class="section-label" draggable="true">섹션이름X</span></div><div class="section-inner" id="sXi"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="gap-block" data-type="gap" style="height:260px"></div></div></div>`;
async function fresh(page, zoom = 100) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(([h, z]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(z); }, [SEC, zoom]);
  await page.waitForTimeout(250);
  return errs;
}
const add = (page, call, sel) => page.evaluate(([call, sel]) => { const before = new Set([...document.querySelectorAll(sel)].map(e => e.id)); window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(document.getElementById('sX')); (new Function(call))(); const m = [...document.querySelectorAll(sel)].find(e => !before.has(e.id)); return m ? m.id : null; }, [call, sel]);
const clickCenter = async (page, sel) => { const p = await page.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); await page.mouse.move(5, 300); await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); };

/* ── E148 ── */
test('E148-C1 [새 것] 이미지 편집 중 + 섹션 골라진 채 ⌘C → 클립보드 글자에 안내문·섹션 이름표가 없고 블럭 글자는 있다', async ({ page }) => {
  const errs = await fresh(page);
  const tb = await add(page, "window.addTextBlock('body')", '#canvas .text-block');
  await page.evaluate((tb) => { document.querySelector('#' + tb + ' [class^="tb-"]').textContent = '본문글자E148'; }, tb);
  const ab = await add(page, "window.addAssetBlock('small')", '#canvas .asset-block');
  await page.evaluate((ab) => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 4; const a = document.getElementById(ab); window.applyAssetImage ? window.applyAssetImage(a, cv.toDataURL()) : (a.innerHTML += `<div class="asset-img-clip"><img class="asset-img" src="${cv.toDataURL()}"></div>`); }, ab);
  await page.evaluate((ab) => { window.enterImageEditMode(document.getElementById(ab)); }, ab);
  expect(await page.evaluate(() => !!document.querySelector('#sX .img-edit-hint')), '[전제] 이미지 편집 안내문이 섹션 안에 있다').toBe(true);
  await page.evaluate(() => { const s = document.getElementById('sX'); s.classList.add('selected'); window.copySelected ? window.copySelected() : null; });
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(300);
  const t = await page.evaluate(() => window._internalClipboardText || '');
  expect(t.length, `[전제] 글자가 실렸다 · ${JSON.stringify(t.slice(0, 80))}`).toBeGreaterThan(0);
  expect(/드래그: 위치|Esc: 완료/.test(t), `안내문 섞임 · ${JSON.stringify(t.slice(0, 200))}`).toBe(false);
  expect(t.includes('섹션이름X'), `섹션 이름표 섞임 · ${JSON.stringify(t.slice(0, 200))}`).toBe(false);
  expect(errs).toEqual([]);
});
test('E148-C2 [지킴] 글자 블럭 하나 ⌘C → 그 글자가 그대로', async ({ page }) => {
  const errs = await fresh(page);
  const tb = await add(page, "window.addTextBlock('body')", '#canvas .text-block');
  await page.evaluate((tb) => { document.querySelector('#' + tb + ' [class^="tb-"]').textContent = '본문글자C2'; }, tb);
  await clickCenter(page, `#${tb} [class^="tb-"]`);
  await page.keyboard.press('Meta+c'); await page.waitForTimeout(300);
  expect(await page.evaluate(() => window._internalClipboardText || '')).toContain('본문글자C2');
  expect(errs).toEqual([]);
});

/* ── E38 ── */
const typeShown = (page) => page.evaluate(() => { const e = document.getElementById('type-section'); return e ? getComputedStyle(e).display !== 'none' : null; });
test('E38-T1 [새 것] Icon Text 를 고르면 Type 절이 안 보인다', async ({ page }) => {
  const errs = await fresh(page);
  const id = await add(page, 'window.addIconTextBlock()', '#canvas .icon-text-block');
  expect(id, '[전제] Icon Text').toBeTruthy();
  await clickCenter(page, `#${id} .itb-text`);
  expect(await typeShown(page), 'Icon Text 패널의 Type 절').toBe(false);
  expect(errs).toEqual([]);
});
test('E38-T2 [지킴] 글자 블럭(Body)은 Type 절이 보인다', async ({ page }) => {
  const errs = await fresh(page);
  const id = await add(page, "window.addTextBlock('body')", '#canvas .text-block');
  await clickCenter(page, `#${id} [class^="tb-"]`);
  expect(await typeShown(page)).toBe(true);
  expect(errs).toEqual([]);
});

/* ── E28 ── */
async function tagScene(page, zoom) {
  const errs = await fresh(page, zoom);
  const id = await add(page, 'window.addLabelGroupBlock()', '#canvas .label-group-block');
  expect(id, '[전제] 태그블럭').toBeTruthy();
  await clickCenter(page, `#${id}`);
  const btn = await page.evaluate((id) => { const b = document.querySelector('#' + id + ' .label-group-add-btn'); const r = b.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, pe: getComputedStyle(b).pointerEvents }; }, id);
  expect(btn.pe, '[전제] 고른 태그블럭의 ＋ 가 눌린다').toBe('auto');
  return { errs, id, btn };
}
const nLabels = (page, id) => page.evaluate((id) => document.querySelectorAll('#' + id + ' .label-item').length, id);
test('E28-P1 [새 것] 배율 40% — ＋ 원 밖 10 화면px(잡는 자리 24 안)을 누르면 태그가 늘어난다', async ({ page }) => {
  const { errs, id, btn } = await tagScene(page, 40);
  expect(Math.round(btn.w), '[전제] 보이는 원 = 40×0.4 = 16 화면px').toBe(16);
  const n0 = await nLabels(page, id);
  await page.mouse.click(btn.cx + 10, btn.cy);   // 원 반지름 8 밖 · 잡는 자리 반지름 12 안
  await page.waitForTimeout(300);
  expect(await nLabels(page, id), `태그 수 ${n0} → ?`).toBe(n0 + 1);
  expect(errs).toEqual([]);
});
test('E28-P2 [지킴] 배율 100% — 보이는 원 40 화면px 그대로 · 원 안 누르면 늘어남', async ({ page }) => {
  const { errs, id, btn } = await tagScene(page, 100);
  expect(Math.round(btn.w)).toBe(40);
  const n0 = await nLabels(page, id);
  await page.mouse.click(btn.cx, btn.cy); await page.waitForTimeout(300);
  expect(await nLabels(page, id)).toBe(n0 + 1);
  expect(errs).toEqual([]);
});
