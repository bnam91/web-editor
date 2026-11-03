/* ls-file-base.dom.spec.js — 열 때 localStorage 본이 «밖에서 복원한 파일»을 덮지 않고, 충돌로 낡은 파일은 여전히 복구하는지의 자.
 * 파일 읽기만 스텁(loadProject) · 판정은 실제 initLoad. 실제 복원 길은 앱 값(회신)에 있다.
 * ⛔이 자가 안 재는 것: 실제 파일 복사·충돌·localStorage 디스크 반영.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');

const canvas = (mark) => `<div class="section-block" id="s1" data-section="1"><div class="section-inner"><div class="gap-block" id="g1" data-mark="${mark}" style="height:40px"></div></div></div>`;
const snap = (mark) => ({ version: 2, currentPageId: 'p', pages: [{ id: 'p', name: 'P', canvas: canvas(mark), pageSettings: {} }] });
const UPD = '2026-11-03T00:00:00.000Z';
const fileTs = Date.parse(UPD);

async function open(page, { ls, lsTs, base }) {
  await page.addInitScript(({ file }) => {
    let real;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(real || {}, { get: (t, k) => {
      if (k === 'loadProject') return async () => ({ ...file });
      if (k === 'saveProject') return async (p) => { window.__saved = p; return { ok: true }; };
      return t[k];
    } }), set: (v) => { real = v; } });
  }, { file: { ...snap('FILE'), id: 'p1', name: 'n', updatedAt: UPD } });
  await bootApp(page);
  await page.evaluate(({ ls, lsTs, base }) => {
    const k = 'web-editor-autosave__p1';
    localStorage.setItem(k, ls); localStorage.setItem(k + '_ts', String(lsTs));
    if (base) localStorage.setItem('web-editor-ls-base__p1', base); else localStorage.removeItem('web-editor-ls-base__p1');
  }, { ls: JSON.stringify(snap('LS')), lsTs, base });
  await page.goto(`${ORIGIN}/index.html?project=p1`);
  await page.waitForFunction(() => document.querySelector('#g1')?.dataset.mark);
}
const seen = (page) => page.evaluate(() => document.querySelector('#g1').dataset.mark);
const baseNow = (page) => page.evaluate(() => localStorage.getItem('web-editor-ls-base__p1'));

test('밖에서 바뀐 파일(판이 다름)은 localStorage 가 못 이긴다', async ({ page }) => {
  await open(page, { lsTs: fileTs + 3600e3, base: '2026-11-03T01:00:00.000Z' });
  expect(await seen(page)).toBe('FILE');
  expect(await baseNow(page)).toBe(UPD);
});
test('[음성] 충돌로 낡은 파일(같은 판 + localStorage 가 새로움)은 localStorage 로 복구한다', async ({ page }) => {
  await open(page, { lsTs: fileTs + 3600e3, base: UPD });
  expect(await seen(page)).toBe('LS');
});
test('[음성] 표시 없는 옛 localStorage 본은 옛 규칙 그대로(새로우면 복구)', async ({ page }) => {
  await open(page, { lsTs: fileTs + 3600e3, base: null });
  expect(await seen(page)).toBe('LS');
  expect(await baseNow(page)).toBe(UPD);
});
test('[음성] 같은 판이어도 localStorage 가 낡았으면 파일', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  expect(await seen(page)).toBe('FILE');
});
test('저장에 성공하면 표시가 그 파일 판을 따라간다', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  await page.evaluate(() => window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId: 'p1' }));
  const v = await page.evaluate(() => ({ saved: window.__saved?.updatedAt, base: localStorage.getItem('web-editor-ls-base__p1') }));
  expect(v.saved).toBeTruthy();
  expect(v.base).toBe(v.saved);
});
