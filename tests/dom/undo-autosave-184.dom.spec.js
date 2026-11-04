/* undo-autosave-184 — ⌘Z·⌘⇧Z 뒤 저장이 돈다(UNDO-DISK-NOT-FOLLOWING-12S-01).
 * 왜: 복원의 변화는 억제 창에 흡수되어 다음 편집까지 파일이 ⌘Z 앞 그대로였다. kill 이면 되돌리기 전으로 돌아갔다(앱 3/3).
 * 칸: U1 ⌘Z 뒤 미저장이 서고 저장본에서 빠진다 · U2 ⌘⇧Z 뒤 저장본에 돌아온다
 *     N1 [음성] 맨 처음에서 ⌘Z = 저장 안 건다 · N2 [음성] 저장이 끝나면 다시 안 쓴다(무편집 쓰기 없음) · N3 [음성] 되돌리기 봉인 중 ⌘Z 는 안 쓰고 봉인을 안 푼다
 * 변이: restoreSnapshot 의 scheduleAutoSave 를 빼면 U1·U2 빨강 · 토큰 검사를 빼면 N3 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');

const KEY = 'web-editor-autosave';
const saved = (page, id) => page.evaluate(([k, id]) => Object.keys(localStorage).some((x) => x.startsWith(k) && !x.endsWith('_ts') && (localStorage.getItem(x) || '').includes(id)), [KEY, id]);
const dirty = (page) => page.evaluate(() => window.hasUnsavedChanges());
const clean = (page) => page.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 15000 });
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const writes = (page) => page.evaluate(() => window.__writes);

async function setup(page) {
  const errs = await bootApp(page);
  await page.goto(`${ORIGIN}/index.html?project=proj_1700000000184`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.addSection === 'function' && document.readyState === 'complete', null, { timeout: 20000 });
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); window.addSection(); window.clearHistory?.(); window.pushHistory?.('초기'); });
  await clean(page);
  await page.evaluate(() => { window.__writes = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('web-editor-autosave') && !String(k).endsWith('_ts')) window.__writes++; return o.call(this, k, v); }; });
  return errs;
}
/* 섹션 하나를 편집으로 넣고 저장이 끝나기를 기다린다 — 그 id */
async function editAndSave(page) {
  const id = await page.evaluate(() => { const b = new Set([...document.querySelectorAll('#canvas .section-block')].map((s) => s.id)); window.pushHistory('s184'); window.addSection(); window.pushHistory('s184 끝'); return [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id).find((x) => !b.has(x)); });
  await expect.poll(() => saved(page, id), { message: '전제 — 편집이 저장본에 들었다', timeout: 15000 }).toBe(true);
  await clean(page);
  return id;
}
const undoKey = async (page) => { await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); }); await page.keyboard.press('Meta+z'); };

test('U1 ⌘Z 뒤 미저장이 서고 저장본에서 빠진다', async ({ page }) => {
  const errs = await setup(page);
  const id = await editAndSave(page);
  await undoKey(page);
  await expect.poll(() => page.evaluate((i) => !document.getElementById(i), id), { message: '전제 — ⌘Z 가 먹었다' }).toBe(true);
  await expect.poll(() => dirty(page), { message: '★⌘Z 뒤 미저장이 안 선다' }).toBe(true);
  await expect.poll(() => saved(page, id), { message: '★저장본이 ⌘Z 앞 그대로다', timeout: 15000 }).toBe(false);
  expect(errs).toEqual([]);
});

test('U2 ⌘⇧Z 뒤 저장본에 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  const id = await editAndSave(page);
  await undoKey(page);
  await expect.poll(() => saved(page, id), { timeout: 15000 }).toBe(false);
  await clean(page);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(() => page.evaluate((i) => !!document.getElementById(i), id), { message: '전제 — ⌘⇧Z 가 먹었다' }).toBe(true);
  await expect.poll(() => saved(page, id), { message: '★저장본에 안 돌아왔다', timeout: 15000 }).toBe(true);
  expect(errs).toEqual([]);
});

test('N1 [음성] 맨 처음에서 ⌘Z — 저장을 안 건다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.clearHistory?.(); });
  await clean(page);
  const w0 = await writes(page);
  await undoKey(page);
  await frames(page);
  expect(await dirty(page), '★되돌릴 것이 없는데 미저장이 섰다').toBe(false);
  await page.waitForTimeout(1800);
  expect(await writes(page), '★쓰기가 났다').toBe(w0);
  expect(errs).toEqual([]);
});

test('N2 [음성] ⌘Z 의 저장이 끝나면 다시 안 쓴다', async ({ page }) => {
  const errs = await setup(page);
  const id = await editAndSave(page);
  await undoKey(page);
  await expect.poll(() => saved(page, id), { timeout: 15000 }).toBe(false);
  await clean(page);
  const w0 = await writes(page);
  await page.waitForTimeout(2500);
  expect(await writes(page), '★복원 뒤 무편집 쓰기가 또 났다').toBe(w0);
  expect(await dirty(page)).toBe(false);
  expect(errs).toEqual([]);
});

test('N3 [음성] 되돌리기 봉인 중 ⌘Z — 안 쓰고 봉인도 안 푼다', async ({ page }) => {
  const errs = await setup(page);
  const id = await editAndSave(page);
  await page.evaluate(async () => { await window.cancelPendingAutoSaveForReload(new URLSearchParams(location.search).get('project')); });
  const w0 = await writes(page);
  await undoKey(page);
  await expect.poll(() => page.evaluate((i) => !document.getElementById(i), id), { message: '전제 — ⌘Z 가 먹었다' }).toBe(true);
  await frames(page);
  expect(await page.evaluate(() => window.state._suppressAutoSave), '★복원이 봉인을 풀었다').toBe(true);
  await page.waitForTimeout(1800);
  expect(await writes(page), '★봉인 중 쓰기가 났다').toBe(w0);
  expect(await saved(page, id), '저장본은 봉인 앞 그대로').toBe(true);
  await page.evaluate(() => window.resumeAutoSaveAfterAbortedReload());
  expect(errs).toEqual([]);
});
