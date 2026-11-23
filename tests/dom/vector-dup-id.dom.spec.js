/* vector-dup-id — VECTOR-DUP-ID-AFTER-OVERLAY-UNDO-01(지디 261119 실앱 · 0.9.13 125행): 떠 있는 벡터가 같은 id 로 같은 섹션에 2개(위치 다름 · 저장본에도 2개).
 * 뿌리(실측으로 확인할 가설): 떠 있는 것을 끄는 «도중» 캔버스가 통째로 갈리면(⌘Z · 다시 그리기) 끌기 손잡이(overlay-float.js bindFloatMoveDrag)는
 *   옛(떨어져 나간) posEl·옛 섹션을 쥔 채 남는다 → 다음 움직임에서 «지금 커서 아래 섹션 ≠ 옛 섹션»이라 hover.appendChild(옛 posEl) = 되살아난 사본이 라이브 섹션에 붙는다.
 * D1 떠 있는 벡터를 끄는 도중 ⌘Z → 계속 끌고 놓기 → 같은 id 하나 · 저장본(getSerializedCanvas)에도 하나
 * 양성대조: _patches/vecdup-CTL.patch ⇒ D1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 고정 대기 0(dom-fixed-wait-census · cand7 t11) — 요소 상자가 두 rAF 동안 같을 때까지 */
const stable = (page, sel) => expect.poll(() => page.evaluate(async (sel) => {
  const m = () => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => v.toFixed(1)).join(','); };
  const a = m(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const b = m();
  return !!a && a === b;
}, sel), { message: `[전제] ${sel} 멎음` }).toBe(true);
const SVG = '<svg viewBox="0 0 24 24"><rect x="0" y="0" width="24" height="24" fill="currentColor"/></svg>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((svg) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="vS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div id="vHost"></div><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    const { row, block } = window.makeVectorBlock({ svg, color: '#ff0000', w: 80, h: 80 });
    block.id = 'vV'; row.id = 'vR';
    document.getElementById('vHost').replaceWith(row); window.rebindAll?.();
    window.deselectAll?.(); document.getElementById('vS').scrollIntoView({ block: 'start' });
  }, SVG);
  await page.waitForFunction(() => (document.querySelector('#vV svg')?.clientWidth || 0) > 0);   // 그림이 그려졌다
  await stable(page, '#vV');
  return errs;
}
const count = (page) => page.evaluate(() => ({ dom: document.querySelectorAll('#canvas [id="vV"]').length, saved: (window.getSerializedCanvas?.() || '').split('id="vV"').length - 1 }));

test('D1 떠 있는 벡터 끄는 도중 ⌘Z → 계속 끌고 놓아도 같은 id 하나(DOM · 저장본)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const OF = window.OverlayFloat; window.clearHistory?.(); OF.enterFloat(OF.posElOf(document.getElementById('vV'))); window.deselectAll?.(); window.pushHistory?.('떠 있음'); });   // ★전제 바뀜(아이맥 3f63b1b58 — 옛 판은 clear «뒤» push 가 무변화로 버려져 이력 0 = ⌘Z 무동작 = 무효 음성) ⇒ clear(흐름) → 띄움 → push = 되돌릴 일 1칸
  await stable(page, '#vV');
  const c0 = await count(page);
  expect(await page.evaluate(() => window.getHistoryTip?.()?.canUndo), '[전제] 되돌릴 일이 있다(canUndo) — 없으면 ⌘Z 가 무동작이라 이 칸은 아무것도 못 잰다').toBe(true);
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y + 30, { steps: 5 });
  const mid = await count(page);
  await page.evaluate(() => { window.__old = { sec: document.getElementById('vS'), v: document.getElementById('vV'), tip: JSON.stringify(window.getHistoryTip?.() ?? null) }; });   // «⌘Z 가 먹었나» 표식(지디 261123 — 아이맥 1차 c1=1 · afterUndo=mid 라 못 가름)
  await page.keyboard.press('Meta+z');
  const afterUndo = await count(page);
  const ate = await page.evaluate(() => ({ secReplaced: document.getElementById('vS') !== window.__old.sec, vReplaced: document.getElementById('vV') !== window.__old.v, oldVConnected: window.__old.v.isConnected, tipBefore: window.__old.tip, tipAfter: JSON.stringify(window.getHistoryTip?.() ?? null) }));
  await page.mouse.move(x + 120, y + 90, { steps: 8 }); await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const c1 = await count(page);
  const end = await page.evaluate(() => ({ oldVConnected: window.__old.v.isConnected, oldSecConnected: window.__old.sec.isConnected }));
  console.log('[D1 실측]', JSON.stringify({ c0, mid, afterUndo, ate, c1, end }));
  expect([c0.dom, c0.saved], '[전제] 처음 하나').toEqual([1, 1]);
  expect([c1.dom, c1.saved], '★끄는 도중 ⌘Z 뒤 계속 끌어도 같은 id 하나(DOM · 저장본)').toEqual([1, 1]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* D2 (1회차 원문 손짓 그대로 · 지디 261119 «오버레이 켬 → 끌기 → 끔 → ⌘Z → ⌘⇧Z → ⌘Z → 다시 열기») — 단계마다 같은 id 수(DOM · 저장본)를 잰다. 패널 단추·진짜 마우스·키.
 * D3 (곁 가설) — ⌘Z 뒤에도 패널이 «옛 블럭»을 쥔 채 열려 있으면 그 단추를 다시 누름 → 옛 블럭을 exitFloat/enterFloat → 사본이 붙나 */
async function openPanel(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y);
  await expect(page.locator('#vb-w')).toBeVisible();   // 전제 — 벡터 패널이 열렸다
}
/* 누르기 전 떠 있음 상태를 재 두고 «바뀔 때까지» → 상자 멎음(고정 대기 0) */
const toggle = async (page) => {
  const was = await page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('vV')).dataset.overlayBlock === 'true');
  await page.click('#vb-float-toggle');
  await expect.poll(() => page.evaluate(() => window.OverlayFloat.posElOf(document.getElementById('vV')).dataset.overlayBlock === 'true'), '[전제] 오버레이 토글이 상태를 바꿨다').toBe(!was);
  await stable(page, '#vV');
};

const seq = async (page, label, log) => { log.push([label, await count(page)]); };
test('D2 (1회차 손짓) 켬 → 끌기 → 끔 → ⌘Z → ⌘⇧Z → ⌘Z → 다시 열기 — 단계마다 같은 id 하나', async ({ page }) => {
  const errs = await setup(page); const log = [];
  await page.evaluate(() => window.clearHistory?.());
  await openPanel(page); await seq(page, 'open', log);
  await toggle(page); await seq(page, '켬', log);
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('vV').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 150, y + 60, { steps: 10 }); await page.mouse.up(); await page.evaluate(() => { window.__upAt = performance.now(); }); await stable(page, '#vV'); await seq(page, '끌기', log);
  if (!(await page.locator('#vb-float-toggle').isVisible())) await openPanel(page);
  await page.waitForFunction(() => performance.now() - window.__upAt > 150);   // ★전제(아이맥 3eb53c9b5 D2 «토글이 상태를 바꿨다» 빨강) — 끌고 놓은 뒤 120ms 는 합성 click 을 삼킨다(overlay-float.js onUp killClick · 놓는 자리 선택 풀림 막기) ⇒ 그 창이 닫힌 뒤 누른다(사람 손 속도 · 고정 대기 아님 = 조건 대기)
  await toggle(page); await seq(page, '끔', log);
  for (const [k, l] of [['Meta+z', '⌘Z'], ['Meta+Shift+z', '⌘⇧Z'], ['Meta+z', '⌘Z 2']]) { await page.keyboard.press(k); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await seq(page, l, log); }
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await page.waitForFunction(() => !!document.querySelector('#canvas .section-block'));
  await seq(page, '다시 열기', log);
  console.log('[D2 실측]', JSON.stringify(log));
  expect(log.filter(([, c]) => c.dom !== 1 || c.saved !== 1).map(([l]) => l), '★어느 단계에서도 같은 id 는 하나(DOM · 저장본)').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D3 (곁 가설) 켬 → ⌘Z → 패널이 열려 있으면 단추 다시 누름 → 같은 id 하나', async ({ page }) => {
  const errs = await setup(page); const log = [];
  await page.evaluate(() => window.clearHistory?.());
  await openPanel(page); await toggle(page); await seq(page, '켬', log);
  await page.keyboard.press('Meta+z'); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await seq(page, '⌘Z', log);
  const btn = await page.locator('#vb-float-toggle').isVisible();
  if (btn) { await page.click('#vb-float-toggle'); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }
  await seq(page, '단추 다시', log);
  console.log('[D3 실측]', JSON.stringify({ btn, log }));
  expect(log.filter(([, c]) => c.dom !== 1 || c.saved !== 1).map(([l]) => l), '★같은 id 하나').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
