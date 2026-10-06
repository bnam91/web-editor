/* frame-align-display.dom.spec.js — U6(E121 · 2026-10-05): 스택 프레임 가로 정렬 «켜짐»이 내용의 실제 자리와 같다.
 *   실측(772ccadc · g15): 자유배치 → stack 변환 직후 패널 «왼쪽» 켜짐 · 자식 L=258/R=258(가운데).
 *   까닭: _convertFreeLayoutToStack 이 자식마다 align-self:center 를 남기고 프레임 align-items 는 비움 → 옛 판정이 빈 값을 'flex-start' 로 그림.
 *   처방: prop-frame.js _renderedHAlign — 그려진 위치로 판정(텍스트 패널 _alignDisplayFor 와 같은 꼴) · 섞이면 아무것도 안 켬.
 * 시험 이름표:
 *   A1 ★새 것 — 변환이 남기는 꼴(자식 align-self:center · 프레임 align-items 비움) → 「가운데」 하나
 *   A2 ★새 것 — 실제 변환 단추(stack)를 눌러 그 자리 그대로 → 「가운데」 하나 (변환 단추가 이스터에그로 막혀 있으면 SKIP · 사유 출력)
 *   A3 음성 — 왼쪽 자식 + 가운데 자식(섞임) → 아무것도 안 켬
 *   A4 회귀 지킴 — 자식이 전부 폭을 채우면(말해 주는 내용 없음) 저장된 값(가운데) 그대로
 *   A5 ★E122 고침 뒤 뒤집음(2026-10-05 태양 lane-e122-falign) — 「왼쪽」 뒤 새 에셋이 «왼쪽 끝»(L≤1). 예전 결함 잠금은 L=250/R=250(가운데)였다.
 *      넓은 범위(다섯 종 × 왼쪽·오른쪽 · 가운데 · 지킴 둘)는 frame-align-insert.dom.spec.js.
 * ★양성대조(실측): 772ccadc(GD1001_ROOT) → A1·A2·A3 빨강(「왼쪽」 켜짐) · A4 초록 · A5 두 판 다 같은 값(L=250) = 기존 결함.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/frame-align-display.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, kidsHtml, frameStyle = '') {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(({ kidsHtml, frameStyle }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="0" style="padding-left:0;padding-right:0"></div></div>`);
    const ss = window.makeFrameBlock({ fullWidth: true });
    ss.style.width = '860px'; ss.style.padding = '30px'; ss.dataset.width = '860';
    if (frameStyle) ss.style.cssText += frameStyle;
    ss.insertAdjacentHTML('beforeend', kidsHtml);
    document.querySelector('#sec1 .section-inner').appendChild(ss);
    window.rebindAll?.();
    window.showFrameProperties(ss);
    window.__ss = ss.id;
  }, { kidsHtml, frameStyle });
  await expect(page.locator('#ss-align-left')).toBeVisible();
  return errs;
}
const lit = (page) => page.evaluate(() => ['ss-align-left', 'ss-align-hcenter', 'ss-align-right'].filter(i => document.getElementById(i)?.classList.contains('active')));
const kidPos = (page, id) => page.evaluate((id) => {
  const ss = document.getElementById(window.__ss), k = document.getElementById(id);
  const fr = ss.getBoundingClientRect(), kr = k.getBoundingClientRect(), sc = fr.width / ss.offsetWidth || 1;
  return { left: Math.round((kr.left - fr.left) / sc - 30), right: Math.round((fr.right - kr.right) / sc - 30) };
}, id);

const CENTERED = '<div class="asset-block" id="k1" style="width:240px;height:60px;align-self:center;flex-shrink:0;background:#ccc"></div>';

test('A1 ★변환이 남기는 꼴(자식 align-self:center · 프레임 정렬 비움) → 「가운데」 하나', async ({ page }) => {
  const errs = await setup(page, CENTERED);
  const p = await kidPos(page, 'k1');
  expect(Math.abs(p.left - p.right), `전제: 자식이 가운데 L=${p.left} R=${p.right}`).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.getElementById(window.__ss).style.alignItems), '전제: 프레임 align-items 비움').toBe('');
  expect(await lit(page)).toEqual(['ss-align-hcenter']);
  expect(errs).toEqual([]);
});

test('A2 ★실제 stack 단추로 변환 → 그 자리 그대로 「가운데」 하나', async ({ page }) => {
  await setup(page, '<div class="asset-block" id="k1" style="position:absolute;left:310px;top:40px;width:240px;height:60px;background:#ccc"></div>',
    ';height:300px;');
  await page.evaluate(() => { const ss = document.getElementById(window.__ss); ss.dataset.freeLayout = 'true'; delete ss.dataset.fullWidth; ss.dataset.height = '300'; window.showFrameProperties(ss); });
  const btn = page.locator('#ss-to-stack-btn');
  await expect(btn, '전제: 자유배치 프레임엔 stack 단추가 있다').toBeVisible();
  const egg = await page.evaluate(() => !window.isEasterEggEnabled || window.isEasterEggEnabled('freeLayoutAnalyze'));
  test.skip(!egg, 'SKIP: freeLayoutAnalyze 이스터에그가 꺼져 변환 단추가 동작하지 않는 판 — 범위 밖');
  const b = await waitStableRect(page, '#ss-to-stack-btn');
  await clickAt(page, b.cx, b.cy, { sel: '[id="ss-to-stack-btn"]' }, { label: 'stack' });
  await expect.poll(() => page.evaluate(() => document.getElementById(window.__ss).dataset.freeLayout || '')).toBe('');
  await expect(page.locator('#ss-align-left')).toBeVisible();
  const p = await kidPos(page, 'k1');
  expect(Math.abs(p.left - p.right), `전제: 변환 뒤 자식 가운데 L=${p.left} R=${p.right}`).toBeLessThanOrEqual(1);
  expect(await lit(page)).toEqual(['ss-align-hcenter']);
});

test('A3 음성 — 왼쪽 자식 + 가운데 자식(섞임) → 아무것도 안 켬', async ({ page }) => {
  await setup(page, '<div class="asset-block" id="kL" style="width:200px;height:40px;align-self:flex-start;flex-shrink:0;background:#ccc"></div>' + CENTERED);
  expect(await lit(page)).toEqual([]);
});

test('A4 회귀 지킴 — 자식이 전부 폭을 채우면 저장된 값(가운데) 그대로', async ({ page }) => {
  await setup(page, '<div class="asset-block" id="kF" style="height:40px;flex-shrink:0;background:#ccc"></div>', ';align-items:center;');
  await page.evaluate(() => { const ss = document.getElementById(window.__ss); ss.dataset.alignItems = 'center'; window.showFrameProperties(ss); });
  const p = await kidPos(page, 'kF');
  expect([p.left <= 1, p.right <= 1], `전제: 폭을 채움 L=${p.left} R=${p.right}`).toEqual([true, true]);
  expect(await lit(page)).toEqual(['ss-align-hcenter']);
});

/* ★A5 — E122 를 고쳐 «뒤집었다»(2026-10-05). 예전엔 «지금 동작»(가운데 L=250/R=250)을 단언하는 초록 결함 잠금이었다(지디 · U30 꼴).
   고침: frame-geometry.js applyFrameHAlignToChild — 정렬 단추와 새로 넣는 길이 같은 규칙 한 벌. 실측 고친 판 L=0. */
test('A5 ★[E122 고침 · 뒤집음] 「왼쪽」 누른 뒤 새 에셋은 «왼쪽 끝»에 붙는다(예전: 가운데 L=250)', async ({ page }) => {
  await setup(page, CENTERED);
  const lb = await waitStableRect(page, '#ss-align-left');
  await clickAt(page, lb.cx, lb.cy, { sel: '[id="ss-align-left"]' }, { label: '왼쪽' });
  await expect.poll(() => lit(page)).toEqual(['ss-align-left']);
  const before = await page.evaluate(() => document.getElementById(window.__ss).querySelectorAll('.asset-block').length);
  await page.evaluate(() => { window._activeFrame = document.getElementById(window.__ss); window.addAssetBlock('small'); });
  await expect.poll(() => page.evaluate(() => document.getElementById(window.__ss).querySelectorAll('.asset-block').length)).toBe(before + 1);
  const newId = await page.evaluate(() => { const a = [...document.getElementById(window.__ss).querySelectorAll('.asset-block')].find(e => e.id !== 'k1'); if (!a.id) a.id = 'kNew'; return a.id; });
  const p = await kidPos(page, newId);
  test.info().annotations.push({ type: 'measured', description: JSON.stringify(p) });
  expect(p.left, `E122 고친 뒤 = 왼쪽 끝(L≤1) · 잰 값 L=${p.left} R=${p.right}`).toBeLessThanOrEqual(1);
  expect(p.right, `전제 — 폭을 다 채우지 않는 에셋(정렬이 보이는 것) R=${p.right}`).toBeGreaterThan(20);
});
