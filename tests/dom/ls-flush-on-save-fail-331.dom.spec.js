/* ls-flush-on-save-fail-331 — 파일 저장이 실패하면 localStorage 를 바로 디스크로 내리라고 부른다 (LOCALSTORAGE-DISK-FLUSH-LAG-40S-KILL-01)
 * 왜: 파일이 막히면 localStorage 가 유일한 사본인데 디스크 반영이 늦어, 연속 편집 뒤 kill -9 에 전부 잃었다.
 * ⛔못 재는 축: 실제 디스크 반영·kill — Electron 메인이라 하네스 밖(앱 값은 회신 imac-gd-L3-CLOSE).
 * 변이: save-load.js 의 flushLocalStorage 한 줄을 빼면 F1 빨강 · F2 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, saveImpl) {
  await bootApp(page);
  await page.evaluate((impl) => {
    window.__flush = 0; window.__saves = 0;
    const api = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (_, k) => {
      if (k === 'flushLocalStorage') return () => { window.__flush++; };
      if (k === 'saveProject') return () => { window.__saves++; return Promise.resolve(impl === 'fail' ? { ok: false, reason: 'EACCES' } : { ok: true }); };
      return api[k];
    } });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sP" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="row"></div></div></div>');
    window.rebindAll?.();
    window.activeProjectId = 'proj_331test';
    window.scheduleAutoSave();
  }, saveImpl);
  await page.waitForFunction(() => window.__saves > 0, null, { timeout: 8000 });
  await expect.poll(() => page.evaluate(() => document.getElementById('autosave-indicator').className), { message: '저장이 끝났다' }).not.toBe('saving');
}

test('F1 파일 저장 실패 ⇒ localStorage 를 내리라고 부른다', async ({ page }) => {
  await setup(page, 'fail');
  await expect.poll(() => page.evaluate(() => window.__flush), { message: '실패인데 안 내렸다' }).toBe(1);
});
test('F2 [음성] 파일 저장 성공 ⇒ 안 부른다', async ({ page }) => {
  await setup(page, 'ok');
  expect(await page.evaluate(() => window.__flush)).toBe(0);
});
