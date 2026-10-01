/* section-split.dom.spec.js — D1 섹션 «분리» (현빈 2026-10-01) — 합치기(⌘M)의 왕복.
 * 앱 통째로 헤드리스(bootApp): 진짜 ⌘M 로 합치고, 진짜 우클릭 메뉴 / ⌘⇧M 로 나눈다.
 * ★양성대조 판 = 7699ea33 → 실측 빨강: S1 S2 S3 S4 S5 / 초록: S0(합치기 자체 — 지키는 시험) · S6(옛 판엔 분리가 없어 «빈 통과»).
 *   ⇒ S6 은 «변이 판»으로 따로 쟀다: 분리 함수의 rebindAll 을 옛꼴(옵션 없음 = 히스토리 비움)로 되돌린 사본에서 S4·S6 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SECS = `
<div class="section-block" id="sA" data-section="1" data-name="위섹션" data-bg="rgb(250,240,230)" style="background-color:rgb(250,240,230);">
  <div class="section-hitzone"><span class="section-label">위섹션</span></div>
  <div class="section-inner" style="padding-left:40px;padding-right:40px;" data-padding-x="40">
    <div class="gap-block" data-type="gap" id="gA1" style="height:100px;"></div>
    <div class="frame-block" id="tfA" data-text-frame="true"><div class="text-block" id="tbA" data-type="body"><div class="tb-body" contenteditable="false">위 글자</div></div></div>
    <div class="gap-block" data-type="gap" id="gA2" style="height:80px;"></div>
  </div></div>
<div class="section-block" id="sB" data-section="2" data-name="아래섹션" data-bg="rgb(20,30,90)" style="background-color:rgb(20,30,90);">
  <div class="section-hitzone"><span class="section-label">아래섹션</span></div>
  <div class="section-inner" style="padding-left:12px;padding-right:12px;" data-padding-x="12">
    <div class="gap-block" data-type="gap" id="gB1" style="height:60px;"></div>
    <div class="frame-block" id="tfB" data-text-frame="true"><div class="text-block" id="tbB" data-type="body"><div class="tb-body" contenteditable="false">아래 글자</div></div></div>
    <div class="gap-block" data-type="gap" id="gB2" style="height:60px;"></div>
  </div>
  <div class="frame-block" id="ovB" data-overlay-block="true" data-sel-variant="sticker" data-free-layout="true" data-offset-x="300" data-offset-y="70"
       style="position:absolute;left:300px;top:70px;width:90px;height:90px;"><div class="shape-block" id="shB" style="width:100%;height:100%;background:#e44"></div></div>
</div>
<div class="section-block" id="sC" data-section="3" data-name="셋째" data-bg="rgb(200,250,200)" style="background-color:rgb(200,250,200);">
  <div class="section-hitzone"><span class="section-label">셋째</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" id="gC1" style="height:50px;"></div>
    <div class="frame-block" id="tfC" data-text-frame="true"><div class="text-block" id="tbC" data-type="body"><div class="tb-body" contenteditable="false">셋째 글자</div></div></div></div>
</div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
  }, SECS);
  await page.waitForTimeout(200);
}
/* 섹션 하나의 «보이는 꼴» — 이름·배경색·안쪽 좌우여백·내용 순서·떠 있는 블럭의 섹션 기준 자리 */
const shape = (page, id) => page.evaluate((id) => {
  const s = document.getElementById(id); if (!s) return null;
  const inner = s.querySelector(':scope > .section-inner');
  const sr = s.getBoundingClientRect(), k = sr.width / s.offsetWidth;
  const ov = s.querySelector('#ovB'); const orr = ov?.getBoundingClientRect();
  return { name: s.dataset.name, bg: getComputedStyle(s).backgroundColor, padL: inner?.style.paddingLeft,
           /* 갭은 «높이»로 잰다 — 되살린 이음매 갭은 새 id 를 받는다(지운 갭의 id 는 기록 안 했다). 다른 블럭은 id 로. */
           order: [...inner.querySelectorAll(':scope > [id]')].map(e => e.classList.contains('gap-block') ? 'gap@' + parseFloat(e.style.height) : e.id),
           ov: ov ? { parent: ov.parentElement.id, x: Math.round((orr.left - sr.left) / k), y: Math.round((orr.top - sr.top) / k) } : null };
}, id);
async function mergeBIntoA(page) {
  await page.evaluate(() => { window.deselectAll?.(); const b = document.getElementById('sB'); window.selectSectionWithModifier?.(b, { metaKey: false, shiftKey: false }); });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+m');
  await page.waitForTimeout(150);
}

test('S0 대조 — 진짜 ⌘M 이 합친다(이 하네스에서 합치기가 실제로 돈다)', async ({ page }) => {
  await setup(page);
  await mergeBIntoA(page);
  expect(await page.evaluate(() => [!!document.getElementById('sB'), document.querySelectorAll('#sA .section-merged-part').length])).toEqual([false, 1]);
});

test('S1 ★합치기 → 우클릭 「섹션 분리」 → 이름·배경·좌우여백·이음매 갭·떠 있는 블럭 자리가 원래대로', async ({ page }) => {
  await setup(page);
  const A0 = await shape(page, 'sA'), B0 = await shape(page, 'sB');
  await mergeBIntoA(page);
  const [x, y] = await page.evaluate(() => { document.getElementById('tbB').scrollIntoView({ block: 'center' }); const r = document.getElementById('tbB').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y, { button: 'right' });
  const item = await page.evaluate(() => { const el = document.getElementById('bcm-section-split'); const r = el.getBoundingClientRect(); return { vis: getComputedStyle(el).display, xy: [r.left + 20, r.top + r.height / 2] }; });
  expect(item.vis, '합쳐 넣은 상자 안 블럭의 우클릭 메뉴에 「섹션 분리」').toBe('flex');
  await page.mouse.click(item.xy[0], item.xy[1]);
  await page.waitForTimeout(150);
  const A1 = await shape(page, 'sA'), B1 = await shape(page, 'sB');
  expect(B1, '★분리된 섹션이 원래 id 로 돌아온다').not.toBeNull();
  expect(B1).toEqual(B0);
  expect(A1, '위 섹션도 원래대로(지웠던 꼬리 갭 80 이 돌아온다)').toEqual(A0);
});

test('S2 ★기록 없는 «옛 합치기» 상자 — 이름 기본값 · 이음매 100px · 토스트로 알린다', async ({ page }) => {
  await setup(page);
  await mergeBIntoA(page);
  await page.evaluate(() => { const p = document.querySelector('#sA .section-merged-part'); delete p.dataset.mergedName; delete p.dataset.mergedTailGapH;
    p.querySelectorAll('[data-merged-outer]').forEach(e => delete e.dataset.mergedOuter); window.__toasts = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__toasts.push(String(m)); return o?.(m, ...a); }; });
  await page.evaluate(() => { window.deselectAll?.(); window.selectBlock?.('tbB'); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+Shift+m');
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => { const s = document.getElementById('sB'); const a = document.querySelector('#sA > .section-inner'); return { name: s?.dataset.name, lastGap: parseFloat(a.lastElementChild.style.height), toast: window.__toasts.join('|'), ovParent: document.getElementById('ovB').parentElement.id }; });
  expect(r.name).toMatch(/^Section \d\d$/);
  expect(r.lastGap).toBe(100);
  expect(r.toast).toContain('기본값');
  expect(r.ovParent, '기록이 없어도 absolute 직계는 섹션 직속으로 돌아간다(어림)').toBe('sB');
});

test('S3 ★순서 보존 — B·C 를 차례로 합친 뒤 B 를 나누면 C 도 B 섹션 «뒤»로 같이 온다', async ({ page }) => {
  await setup(page);
  await mergeBIntoA(page);
  await page.evaluate(() => { window.deselectAll?.(); window.selectSectionWithModifier?.(document.getElementById('sC'), {}); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+m');
  await page.waitForTimeout(150);
  await page.evaluate(() => { window.deselectAll?.(); window.selectBlock?.('tbB'); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+Shift+m');
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => ({ secs: [...document.querySelectorAll('#canvas > .section-block')].map(s => s.id),
    cIn: document.getElementById('tbC').closest('.section-block').id, aParts: document.querySelectorAll('#sA .section-merged-part').length }));
  expect(r.secs).toEqual(['sA', 'sB']);
  expect(r.cIn, 'C 는 B 섹션 안(상자째) — 화면 순서 A·B·C 유지').toBe('sB');
  expect(r.aParts).toBe(0);
});

test('S4 ⌘Z 한 번 = 분리 한 번(합쳐진 상태로 돌아온다)', async ({ page }) => {
  await setup(page);
  await mergeBIntoA(page);
  await page.evaluate(() => { window.deselectAll?.(); window.selectBlock?.('tbB'); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+Shift+m');
  await page.waitForTimeout(150);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => [!!document.getElementById('sB'), document.querySelectorAll('#sA .section-merged-part').length])).toEqual([false, 1]);
});

test('S5 ★합치기가 «기록»만 더했다 — 상자에 mergedName·mergedTailGapH, 섹션 직속이던 것에 data-merged-outer', async ({ page }) => {
  await setup(page);
  await mergeBIntoA(page);
  const r = await page.evaluate(() => { const p = document.querySelector('#sA .section-merged-part'); return { name: p.dataset.mergedName, gap: p.dataset.mergedTailGapH, outer: document.getElementById('ovB').dataset.mergedOuter }; });
  expect(r).toEqual({ name: '아래섹션', gap: '80', outer: '1' });
});

test('S6 ★분리가 «앞선 되돌리기 기록»을 지우지 않는다(rebindAll 의 clearHistory 를 막았다)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { document.getElementById('gA1').style.height = '90px'; window.pushHistory('앞선 편집'); });
  await mergeBIntoA(page);
  const before = await page.evaluate(() => window.getHistoryTip().len);
  await page.evaluate(() => { window.deselectAll?.(); window.selectBlock?.('tbB'); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+Shift+m');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.getHistoryTip());
  expect(after.len, `분리 전 ${before}칸이 분리 뒤 ${after.len}칸 — 기록이 지워졌다`).toBeGreaterThanOrEqual(before);
});
