/* tab-pass-no-rewrite-345 — A 를 편집하고 곧바로 B→C 로 지나가도 무편집 B 는 다시 안 쓴다 (J345B)
 * 왜: 미저장 판정(dirty·타이머·진행 중 저장)이 전역 하나라 A 의 것을 B 의 것으로 읽었다 ⇒ 탭 전환이 B 를 저장 · DEF-03 이 이 창에서 안 섰다.
 *   앱 실측(df8241e1 · ~/gd-lane/imac-gd-L1/345b): B 파일 다시 쓰임 · updatedAt 앞으로 · 느린 전환엔 안 쓰임.
 * 자: 프로젝트별 electronAPI.saveProject · saveProjectSync 호출(하네스의 가짜 API 를 갈아 끼워 센다). 파일은 앱이 잰다.
 * 칸: T1 빠른 B→C — B 저장 0 · A 저장 ≥1 · T2 [음성] 느린 B→C — B 저장 0 · T3 [양성] B 를 편집하고 빠르게 C — B 저장 ≥1(자가 B 저장을 본다)
 *     T4 B 에서 곧바로 beforeunload — 동기 저장 0 · T5 [양성] B 를 편집하고 beforeunload — 동기 저장 B
 *     T6 A 저장이 실패하면 B 는 안 쓰고, A 로 돌아와 떠날 때 A 를 다시 쓴다.
 * 변이: 고침(_hasOwnUnsaved 의 임자 대조)만 되돌리면 T1·T4·T6 빨강 · 나머지 초록.
 * 창의 끝: A 타이머가 터지며 남기는 «autoSave skip» 콘솔 한 줄 + 진행 중 저장 0(고정 대기를 안 쓴다 · tests/unit/dom-fixed-wait-census).
 * ★처음 실행 기록: 2026-11-02 18:3x · 아이맥 · 판 df8241e1 · w1 · retries 0 · repeat-each 3 · 고친 판 18/18 · 되돌린 판 T1·T4·T6 각 3/3 빨강 · T2·T3·T5 초록 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const [A, B, C] = ['proj_345a', 'proj_345b', 'proj_345c'];

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate((ids) => {
    const project = (id) => ({ ...window.buildEmptyProject(id, id), id, name: id, version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'P', pageSettings: {}, canvas: `<div class="section-block" id="sec_${id}"><div class="section-inner"></div></div>` }] });
    const files = new Map(ids.map(id => [id, project(id)]));
    window.__calls = { save: [], sync: [] }; window.__fail = new Set();
    const fake = {
      loadProject: async (id) => JSON.parse(JSON.stringify(files.get(id) || null)),
      saveProject: async (p) => { window.__calls.save.push(p.id); if (window.__fail.has(p.id)) throw new Error('EPERM'); files.set(p.id, p); return { ok: true }; },
      saveProjectSync: (p) => { window.__calls.sync.push(p.id); return { ok: true }; },
    };
    window.electronAPI = new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) });
    window.openTabs = ids.map(id => ({ id, name: id, _cache: JSON.stringify(files.get(id)) }));
    window.activeProjectId = ids[0];
    window.applyProjectData(JSON.parse(window.openTabs[0]._cache));
  }, [A, B, C]);
  await settle(page);
  await page.waitForFunction(() => !window.hasUnsavedChanges());   // 장면을 만든 타이머가 끝나기를 기다린다
  await page.evaluate(() => { window.__calls.save.length = 0; window.__calls.sync.length = 0; });
  return errs;
}
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));   // 전환 억제 창(rAF)이 닫힌 뒤에 편집한다 — 그 안의 편집은 불러오기로 친다
const edit = async (page) => {
  await page.evaluate(() => { window.selectSection?.(document.querySelector('#canvas .section-block')); window.addTextBlock('h2'); });
  await page.waitForFunction(() => window.hasUnsavedChanges());   // [전제] 편집이 미저장을 세웠다
};
const go = (page, id) => page.evaluate((id) => window.switchTab(id), id);
const calls = (page) => page.evaluate(() => window.__calls);
const unload = (page) => page.evaluate(() => { window.dispatchEvent(new Event('beforeunload')); });
const drained = (page) => page.waitForFunction(() => !window._isSavingToFile);
/** A 를 편집한다. 돌려주는 약속 = A 의 타이머가 터져 «autoSave skip» 을 남길 때(= 창이 끝날 때). */
async function start(page) {
  const errs = await setup(page);
  const expired = page.waitForEvent('console', { predicate: m => m.text().includes('autoSave skip'), timeout: 15000 });
  expired.catch(() => {});   // 기다리지 않는 칸(T4·T5)에서 페이지가 먼저 닫혀도 처리 안 된 거부가 안 나게
  await edit(page);
  return { errs, expired };
}

test('T1 A 편집 뒤 빠른 B→C — 무편집 B 를 안 쓴다 · A 는 쓴다', async ({ page }) => {
  const s = await start(page);
  await go(page, B); await go(page, C);
  await s.expired; await drained(page);
  const c = await calls(page);
  expect(c.save, '★무편집 B 가 다시 쓰였다').not.toContain(B);
  expect(c.save, '[전제] 떠난 A 는 써졌다').toContain(A);
  expect(c.save).not.toContain(C);
  expect(s.errs).toEqual([]);
});

test('T2 [음성] 느린 B→C — 무편집 B 를 안 쓴다', async ({ page }) => {
  const s = await start(page);
  await go(page, B); await s.expired; await drained(page);
  await go(page, C); await drained(page);
  const c = await calls(page);
  expect(c.save).not.toContain(B);
  expect(c.save).toContain(A);
  expect(s.errs).toEqual([]);
});

test('T3 [양성] B 를 편집하고 빠르게 C — B 를 쓴다', async ({ page }) => {
  const s = await start(page);
  await go(page, B); await settle(page); await edit(page); await go(page, C);
  await s.expired; await drained(page);
  const c = await calls(page);
  expect(c.save, '★편집한 B 가 안 써졌다').toContain(B);
  expect(c.save).toContain(A);
  expect(s.errs).toEqual([]);
});

test('T4 A 편집 뒤 B 에서 곧바로 닫기 — 무편집 B 를 동기로 안 쓴다', async ({ page }) => {
  const s = await start(page);
  await go(page, B); await unload(page);
  expect((await calls(page)).sync, '★닫기가 무편집 B 를 다시 썼다').toEqual([]);
  expect(s.errs).toEqual([]);
});

test('T5 [양성] B 를 편집하고 곧바로 닫기 — B 를 동기로 쓴다', async ({ page }) => {
  const s = await start(page);
  await go(page, B); await settle(page); await edit(page); await unload(page);
  expect((await calls(page)).sync, '★편집한 B 가 닫기에 안 써졌다').toEqual([B]);
  expect(s.errs).toEqual([]);
});

test('T6 A 저장 실패 — 무편집 B 는 안 쓰고, A 로 돌아와 떠날 때 A 를 다시 쓴다', async ({ page }) => {
  const s = await start(page);
  await page.evaluate((A) => window.__fail.add(A), A);
  await go(page, B); await s.expired; await drained(page);
  await go(page, C); await drained(page);
  let c = await calls(page);
  expect(c.save.filter(x => x === A).length, '[전제] A 를 한 번 시도했다').toBe(1);
  expect(c.save, '★실패한 A 의 미저장을 B 의 것으로 읽었다').not.toContain(B);
  await page.evaluate((A) => window.__fail.delete(A), A);
  await go(page, A); await settle(page); await go(page, B); await drained(page);
  c = await calls(page);
  expect(c.save.filter(x => x === A).length, '★실패한 A 를 돌아와 떠나도 다시 안 썼다').toBe(2);
  expect(s.errs).toEqual([]);
});
