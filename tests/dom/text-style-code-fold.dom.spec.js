/* text-style-code-fold.dom.spec.js — 1020t2d1 형광펜·점·밑줄 «번호 붙여넣기» 줄을 한 토글로 접기
 *
 * 현빈 원문(T1-NOTE-1020 :18): 「… 형광펜 번호 붙여넣기, 점번호 붙여넣기, 밑줄번호 붙여넣기 등. 번호 부분나오는 부분은
 *   일괄로 토글로 접어둘수 있게 해줘 너무 복잡해 보여.」
 * 시트 39행(아이맥 · ca702d40): ❌ — 텍스트블럭 선택 → txt-hl-code/dot-code/ul-code 3줄 그대로 노출 · 접기 토글/details/fold 조상 0.
 * 칸
 *   P0  전제 — 텍스트 블럭을 고르면 패널에 번호 줄 셋(txt-hl/dot/ul-code-row)이 있다
 *   F   처음엔 접혀 있다 — 머리 하나(#txt-code-fold-toggle · aria-expanded=false) · 세 줄 다 안 보인다(offsetParent null)
 *   O   머리를 진짜 클릭 → 세 줄 다 보이고 aria-expanded=true · 다시 클릭 → 다시 접힘
 *   K   펼친 뒤 다른 글상자를 골라도 펼침이 남는다(한 사람 한 세션의 손버릇)
 * 양성대조: GD1001_ROOT=<핀 사본> ⇒ F·O·K 빨강(머리 0 · 세 줄 보임).
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1400 });
  const errs = await bootApp(page);
  await page.addInitScript(() => { try { localStorage.removeItem('goditor.textStyleCodeFold.open'); } catch (_) {} });
  await page.evaluate(() => {
    try { localStorage.removeItem('goditor.textStyleCodeFold.open'); } catch (_) {}
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    window.addTextBlock('body', { content: '첫 글상자' });
    window.selectSection(sec);
    window.addTextBlock('body', { content: '둘째 글상자' });
    const tbs = [...sec.querySelectorAll('.text-block')];
    window.__a = tbs[tbs.length - 2]; window.__b = tbs[tbs.length - 1];
    window.selectBlock(window.__a.id);
  });
  await page.waitForFunction(() => !!document.getElementById('txt-hl-code-row'));
  return errs;
}
const rowsShown = (page) => page.evaluate(() => ['hl', 'dot', 'ul'].map((k) => { const r = document.getElementById(`txt-${k}-code-row`); return r ? r.offsetParent !== null : null; }));
const head = (page) => page.evaluate(() => { const h = document.getElementById('txt-code-fold-toggle'); return h ? { exp: h.getAttribute('aria-expanded'), n: document.querySelectorAll('#txt-code-fold-toggle').length } : null; });
async function clickHead(page) {
  await page.locator('#txt-code-fold-toggle').scrollIntoViewIfNeeded();
  const b = await page.locator('#txt-code-fold-toggle').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test('P0 전제 — 번호 줄 셋이 패널에 있다', async ({ page }) => {
  const errs = await setup(page);
  const ids = await page.evaluate(() => ['hl', 'dot', 'ul'].map((k) => !!document.getElementById(`txt-${k}-code-row`)));
  expect(ids).toEqual([true, true, true]);
  expect(errs).toEqual([]);
});

test('F 처음엔 접혀 있다 — 머리 하나 · 세 줄 안 보임', async ({ page }) => {
  const errs = await setup(page);
  expect(await head(page)).toEqual({ exp: 'false', n: 1 });
  expect(await rowsShown(page)).toEqual([false, false, false]);
  expect(errs).toEqual([]);
});

test('O 머리 클릭 → 세 줄 보임 · 다시 클릭 → 접힘', async ({ page }) => {
  const errs = await setup(page);
  await clickHead(page);
  await page.waitForFunction(() => document.getElementById('txt-code-fold-toggle').getAttribute('aria-expanded') === 'true');
  expect(await rowsShown(page)).toEqual([true, true, true]);
  await clickHead(page);
  await page.waitForFunction(() => document.getElementById('txt-code-fold-toggle').getAttribute('aria-expanded') === 'false');
  expect(await rowsShown(page)).toEqual([false, false, false]);
  expect(errs).toEqual([]);
});

test('K 펼친 뒤 다른 글상자를 골라도 펼침이 남는다', async ({ page }) => {
  const errs = await setup(page);
  await clickHead(page);
  await page.waitForFunction(() => document.getElementById('txt-code-fold-toggle').getAttribute('aria-expanded') === 'true');
  await page.evaluate(() => window.selectBlock(window.__b.id));
  await page.waitForFunction(() => { const h = document.getElementById('txt-code-fold-toggle'); return !!h && h.isConnected; });
  expect(await head(page)).toEqual({ exp: 'true', n: 1 });
  expect(await rowsShown(page)).toEqual([true, true, true]);
  expect(errs).toEqual([]);
});
