/* autosave-max-wait-354 — 연속 편집 중에도 자동저장이 최대 대기 안에 한 번은 난다 (J354)
 * 왜: scheduleAutoSave 가 부를 때마다 1.5초 타이머를 되걸어, 1.5초보다 촘촘한 편집이 이어지면 저장이 한 번도 안 났다.
 *   앱 실측(cb331c44 · ~/gd-lane/imac-gd-L1/354): 간격 0.8·1.2초 40초 쓰기 0 · SIGTERM 뒤 그 40초가 디스크에 없다.
 * 자: 자동저장본 localStorage 쓰기 시각(파일 쓰기와 같은 타이머 · tests/dom/drag-move-autosave 머리말). 파일은 앱이 잰다.
 * 칸: W1 0.8초 간격 8초 — 첫 쓰기가 첫 편집 뒤 5초 언저리 · W2 [음성] 편집 하나 — 1.5초 언저리 · W3 [음성] 2초 간격 — 편집마다 1.5초 뒤.
 * 변이: 고침만 되돌리면 W1 빨강 · W2·W3 초록.
 * ★처음 실행 기록: 2026-11-01 18:1x · 아이맥 · 판 cb331c44 · w1 · retries 0 · repeat-each 3 · 고친 판 9/9 · 되돌린 판 W1 3/3 빨강 · W2·W3 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000354';

const KEY = 'web-editor-autosave';
async function setup(page) {
  const errs = await bootApp(page);
  await page.goto(`${ORIGIN}/index.html?project=${PID}`);   // 프로젝트 id 가 있어야 자동저장이 돈다
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.addSection === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.evaluate((KEY) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection(); window.selectSection?.(c.querySelector('.section-block'));
  }, KEY);
  await page.waitForTimeout(2500);   // 장면을 만든 타이머가 끝나기를 기다린다
  await page.evaluate((KEY) => {
    window.__w = []; const o = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (this === localStorage && String(k).startsWith(KEY) && !/ts/i.test(String(k))) window.__w.push(Date.now()); return o.call(this, k, v); };
  }, KEY);
  return errs;
}
const edit = (page) => page.evaluate(() => { window.addTextBlock('h2'); return Date.now(); });
const writes = (page) => page.evaluate(() => window.__w);

test('W1 0.8초 간격 — 5초 언저리에 한 번은 쓴다', async ({ page }) => {
  const errs = await setup(page);
  const t0 = await edit(page);
  for (let i = 0; i < 10; i++) { await page.waitForTimeout(800); await edit(page); }
  const w = await writes(page);
  expect(w.length, '★연속 편집 중 저장이 한 번도 안 났다').toBeGreaterThan(0);
  const first = w[0] - t0;
  expect(first, `첫 쓰기 ${first}ms`).toBeGreaterThan(3500);
  expect(first).toBeLessThan(6500);
  expect(errs).toEqual([]);
});

test('W2 [음성] 편집 하나 — 1.5초 언저리', async ({ page }) => {
  const errs = await setup(page);
  const t0 = await edit(page);
  await page.waitForTimeout(2600);
  const w = await writes(page);
  expect(w.length).toBe(1);
  expect(w[0] - t0).toBeGreaterThan(1300);
  expect(w[0] - t0).toBeLessThan(2500);
  expect(errs).toEqual([]);
});

test('W3 [음성] 2초 간격 — 편집마다 1.5초 뒤', async ({ page }) => {
  const errs = await setup(page);
  const ts = []; for (let i = 0; i < 3; i++) { ts.push(await edit(page)); await page.waitForTimeout(2000); }
  const w = await writes(page);
  expect(w.length).toBe(3);
  w.forEach((x, i) => { expect(x - ts[i], `칸 ${i}`).toBeGreaterThan(1300); expect(x - ts[i]).toBeLessThan(2000); });
  expect(errs).toEqual([]);
});
