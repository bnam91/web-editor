/* t-key-repeat-after-frame — T-KEY-REPEAT-INSERTS-INTO-FRAME-01(현빈 261108).
 * 프레임을 한 번 클릭(오브젝트 선택) → t 는 프레임 «다음»에 선다. 그 뒤 t·g·a 를 이어 누르면 «방금 넣은 블럭 바로 다음»에 서야 한다.
 * 0.9.9 까지는 둘째부터 그 프레임 «안» 끝에 쌓였다(활성 프레임이 남아 「안 골라짐 · 활성만」 = 안에 넣기로 읽혔다).
 * 음성: 들어간 상태(자식 더블클릭으로 고름)에서 t 는 여전히 프레임 «안», 고른 자식 다음이다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function scene(page, nested) {
  await page.setViewportSize({ width: 1400, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ([FR, nested]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const addF = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par || null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); return [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); };
    const P = nested ? addF() : null; const F = addF(P);
    window.deselectAll(); window.selectSection(sec); window._activeFrame = F; await window.addTextBlock('body');
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); F.scrollIntoView({ block: 'center' });
    return { F: F.id, P: P?.id || null, kid: F.querySelector('.text-block').id }; }, [FR, nested]);
  return { errs, ...ids };
}
/* A = 에셋(메뉴에서 고르기와 같은 addAssetBlock) */
/* 그 프레임의 «부모 그릇»(섹션 inner 또는 P) 직계 순서 — 텍스트는 text-frame 래퍼 단위 */
const order = (page, host) => page.evaluate((host) => { const box = host ? document.getElementById(host) : document.querySelector('#canvas .section-inner');
  return [...box.children].map((e) => e.id); }, host);
const inF = (page, F) => page.evaluate((F) => document.getElementById(F).children.length, F);
const newUnit = (page) => page.evaluate(() => { const s = document.querySelector('.selected'); return (s?.closest('.frame-block[data-text-frame]') || s?.closest('.row') || s)?.id; });
async function clickFrameEdge(page, F) { const r = await page.evaluate((F) => { const e = document.getElementById(F).getBoundingClientRect(); return [e.left + 6, e.top + 6]; }, F); await page.mouse.click(...r); await raf(page); }

for (const nested of [false, true]) for (const keys of [['t', 't', 't'], ['t', 'g', 't'], ['t', 'A', 't'], ['g', 't', 'g']]) {
  test(`${nested ? '프레임 안 프레임' : '섹션의 프레임'} 한 번 클릭 → ${keys.join(' ')} = 매번 방금 넣은 것 바로 다음`, async ({ page }) => {
    const s = await scene(page, nested);
    const picked = () => page.evaluate((F) => document.getElementById(F).classList.contains('selected'), s.F);
    for (let i = 0; i < 3 && !(await picked()); i++) {   // 고르기만 재시도(27회 중 1회 첫 누름이 빗나감) — 단언은 아래 그대로
      await raf(page);
      if (nested) {   // P 에 들어간 상태로 F 만 오브젝트로 고른다: P 안 F 를 더블클릭
        const r = await page.evaluate((F) => { const e = document.getElementById(F).getBoundingClientRect(); return [e.left + 6, e.top + 6]; }, s.F); await page.mouse.dblclick(...r); await raf(page);
      } else await clickFrameEdge(page, s.F);
    }
    expect(await page.evaluate((F) => document.getElementById(F).classList.contains('selected'), s.F), '[전제] F 를 오브젝트로 고름').toBe(true);
    const n0 = await inF(page, s.F);
    let prev = s.F;
    for (const k of keys) {
      if (k === 'A') await page.evaluate(() => window.addAssetBlock());   // a 키는 에셋 «메뉴»를 연다(넣지 않음) — 메뉴에서 고른 것과 같은 함수
      else await page.keyboard.press(k);
      await raf(page); await page.waitForTimeout(150);
      const u = await newUnit(page); const o = await order(page, s.P);
      expect(o.indexOf(u), `${k}: 새 블럭 ${u} 가 ${prev} 바로 다음 (순서 ${o.join(',')})`).toBe(o.indexOf(prev) + 1);
      prev = u;
    }
    expect(await inF(page, s.F), 'F 안은 그대로').toBe(n0);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('음성 — 자식을 더블클릭으로 골라 들어간 상태면 t 는 F «안», 고른 자식 다음', async ({ page }) => {
  const s = await scene(page, false);
  const r = await page.evaluate((id) => { const e = document.getElementById(id).getBoundingClientRect(); return [e.left + e.width / 2, e.top + e.height / 2]; }, s.kid);
  await page.mouse.dblclick(...r); await raf(page);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), s.kid), '[전제] 자식 고름').toBe(true);
  await page.keyboard.press('t'); await raf(page);
  const u = await newUnit(page);
  const kids = await page.evaluate((F) => [...document.getElementById(F).children].map((e) => e.id), s.F);
  const kidUnit = await page.evaluate((id) => document.getElementById(id).closest('.frame-block[data-text-frame]')?.id || id, s.kid);
  expect(kids.indexOf(u), `F 안 순서 ${kids.join(',')}`).toBe(kids.indexOf(kidUnit) + 1);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
