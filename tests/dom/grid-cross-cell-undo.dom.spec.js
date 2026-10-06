/* grid-cross-cell-undo.dom.spec.js — ★「줄을 옆 칸으로」 뒤 ⌘Z ★한 번에 돌아오나 (2026-10-06 · 지디 발주 ㉣)
 *
 * ★무엇을 재나 — `grdMoveLineToCell`(prop-grid.js)은 ★한 제스처가 ★두 문으로 나간다.
 *   그 머리말은 「★★이력은 «한 칸»이다 — 첫 문만 쌓고 둘째 문은 noHistory 로 끈다(⌘Z 한 번)」라 적는다.
 *   ⛔그런데 ★실앱에서는 그게 ★거짓이었다(실측) — 까닭:
 *     js/model-update-history.js 래퍼가 `window.update*Block` ★전부를 감싸 ★«끝 표본»을 한 칸 더 쌓고
 *     ★그 래퍼는 ★`opts` 를 ★«안 본다». ⇒ 문1 이 ★S1 = 「출발 칸에서만 뺀 ★반쪽」을 한 칸 남긴다.
 *   ★★그것을 잠근다던 tests/unit/grid-line-move-wiring.test.mjs 의 그 검사는 ★«가짜 이웃»으로 돌려
 *     ★pushHistory ★호출 수만 센다 ⇒ ★래퍼를 ★안 본다 = ★「한 환경에서만 참인 검사」.
 *   ⇒ ★그래서 ★여기(래퍼가 얹힌 DOM 자리)에서 ★«스택이 몇 칸 늘었나»와 ★«⌘Z 한 번의 결과»로 잰다.
 *
 * ★양성대조 = ★핀(고치기 «전» 판)에서 돌리면 ★U2 가 빨강이어야 한다:
 *     GD1001_ROOT=<dev 체크아웃 경로> npx playwright test … tests/dom/grid-cross-cell-undo.dom.spec.js
 *   ⛔HEAD 를 핀으로 쓰지 마라 — 고친 뒤엔 HEAD 가 곧 고친 판이라 대조가 전부 초록이 된다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-cross-cell-undo.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const info = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sU"><div class="section-hitzone"></div>'
      + '<div class="section-inner" id="siU"></div></div>');
    window.rebindAll?.();
    window.selectSection(document.getElementById('sU'));
    window.addGridBlock?.({ cols: 2 });
    const g = document.querySelector('.grid-block');
    window.updateGridBlock(g.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'body', text: 'A' }, { type: 'body', text: 'B' }] } });
    window.updateGridBlock(g.id, { patchCell: { r: 0, c: 1, lines: [{ type: 'body', text: 'X' }] } });
    return { id: g.id };
  });
  return { errs, ...info };
}
/** 칸 둘의 줄 글자 — ★모델에서 읽는다(화면이 아니라 데이터가 참값이다). */
const cells = (page, id) => page.evaluate((id) => {
  const m = window.getGridModel(document.getElementById(id));
  return [0, 1].map(c => (m.cells[0][c].lines || []).map(l => l.text));
}, id);
const stackLen = (page) => page.evaluate(() => (window.historyStack || []).length);

test('U0 ★전제 — 두 칸에 줄이 섰고 ★옮기기가 실제로 먹는다', async ({ page }) => {
  const s = await scene(page);
  expect(await cells(page, s.id), '전제: 출발 [A,B] · 도착 [X]').toEqual([['A', 'B'], ['X']]);
  await page.evaluate((id) => {
    const g = document.getElementById(id);
    window.grdSetActiveLine?.(g, { r: 0, c: 0, li: 0 });
    window.grdMoveLineToCell?.(g, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null);
  }, s.id);
  await page.waitForTimeout(220);
  expect(await cells(page, s.id), '전제: A 가 도착 칸 끝으로 갔다').toEqual([['B'], ['X', 'A']]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('U1 ★한 제스처 = ★스택 «한 칸»이다 — ⛔호출 수가 아니라 ★스택 길이로 잰다', async ({ page }) => {
  const s = await scene(page);
  /* ⛔pushHistory ★호출 수로 재면 틀린다 — history.js 의 ★무변화 중복 차단이 하나를 버린다.
     ⇒ ★재야 하는 것은 ★«스택이 몇 칸 늘었나»다. */
  const before = await stackLen(page);
  await page.evaluate((id) => {
    const g = document.getElementById(id);
    window.grdSetActiveLine?.(g, { r: 0, c: 0, li: 0 });
    window.grdMoveLineToCell?.(g, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null);
  }, s.id);
  await page.waitForTimeout(220);
  const after = await stackLen(page);
  expect(`스택 ${before} → ${after} (＋${after - before})`).toBe(`스택 ${before} → ${before + 1} (＋1)`);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('U2 ★★⌘Z ★한 번에 ★원래로 — ⛔«반쪽»(줄이 어느 칸에도 없음) 금지', async ({ page }) => {
  const s = await scene(page);
  const before = await cells(page, s.id);
  await page.evaluate((id) => {
    const g = document.getElementById(id);
    window.grdSetActiveLine?.(g, { r: 0, c: 0, li: 0 });
    window.grdMoveLineToCell?.(g, { r: 0, c: 0 }, 0, { r: 0, c: 1 }, null);
  }, s.id);
  await page.waitForTimeout(220);
  const mid = await cells(page, s.id);
  expect(mid, '전제: 옮기기가 먹었다').toEqual([['B'], ['X', 'A']]);

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  /* ⛔«고정 대기»로 재지 않는다 — 조건으로 기다린다(부하에서 값을 잃는다). */
  let after = mid;
  for (let i = 0; i < 40 && JSON.stringify(after) === JSON.stringify(mid); i++) {
    await page.waitForTimeout(100);
    after = await cells(page, s.id);
  }
  /* ★세 갈래를 ★갈라 적는다 — ㉠안 먹었다 ㉡★«반쪽»(A 가 어느 칸에도 없다) ㉢원래로.
     ⛔「같지 않다」 하나로 두면 ㉠과 ㉡이 ★같은 빨강이 되어 ★무엇이 깨졌나가 흐려진다. */
  const flat = after.flat();
  const lost = !flat.includes('A');
  expect(`먹었나=${JSON.stringify(after) !== JSON.stringify(mid)} · A가사라짐=${lost} · 값=${JSON.stringify(after)}`)
    .toBe(`먹었나=true · A가사라짐=false · 값=${JSON.stringify(before)}`);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
