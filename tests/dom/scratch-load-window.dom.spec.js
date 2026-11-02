/* scratch-load-window — 스크래치를 읽는 사이 넣은 장이 다시 열 때 남는다
 * 왜: 로드 중엔 _saveScratch 가 건너뛴다(빈 배열 덮어쓰기 방지). 읽는 사이 넣은 장은 화면엔 보이는데 저장이 안 돼 다시 열면 없었다(앱 12/12 · 부팅·탭 길 · 창 밖 0/3).
 * 칸: S1 읽는 사이 넣은 장 + 원래 장 둘 다 남는다 · S2 [음성] 안 넣으면 로드가 안 쓴다 · S3 [음성] 다 읽은 뒤 넣은 장은 평소대로.
 * 변이: 고침만 되돌리면 S1 빨강 · S2·S3 초록 | 언제나 저장하게 바꾸면 S2 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const PID = 'proj_slw';
const ids = (page) => page.evaluate(() => [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId).sort());
/* 다른 페이지 키를 다녀와 디스크(IndexedDB)에서 다시 읽는다. */
const reread = (page, cur) => page.evaluate(async ([pid, cur]) => { await window.initScratchPad(pid, 'page_other'); await window.initScratchPad(pid, cur); }, [PID, cur]);

async function setup(page) {
  const errs = await bootApp(page);
  const cur = await page.evaluate(async ([src, pid]) => {
    const cur = window.state.currentPageId;
    await window.initScratchPad(pid, cur);
    await window._scratchAddAndSave(src, 960, 100, 200, undefined, 'OLD');
    return cur;
  }, [PNG, PID]);
  return { errs, cur };
}

test('S1 읽는 사이 넣은 장 — 원래 장과 함께 다시 열어도 남는다', async ({ page }) => {
  const { errs, cur } = await setup(page);
  const r = await page.evaluate(async ([src, pid, cur]) => {
    const loading = window.initScratchPad(pid, cur);   // 안 기다린다 — 읽는 중
    const adding = window._scratchAddAndSave(src, 960, 400, 200, undefined, 'NEW');
    await loading; await adding;
    return [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId).sort();
  }, [PNG, PID, cur]);
  expect(r, '[전제] 화면엔 둘 다').toEqual(['NEW', 'OLD']);
  // 그 저장이 끝난 뒤 읽게 한다 — 로드 끝의 저장은 같은 DB 큐에 먼저 들어가 있다
  await reread(page, cur);
  expect(await ids(page), '★읽는 사이 넣은 장이 다시 열 때 없다').toEqual(['NEW', 'OLD']);
  expect(errs).toEqual([]);
});

test('S2 [음성] 안 넣으면 — 로드가 저장을 안 한다', async ({ page }) => {
  const { errs, cur } = await setup(page);
  const puts = await page.evaluate(async ([pid, cur]) => {
    let n = 0; const o = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a) { n++; return o.apply(this, a); };
    await window.initScratchPad(pid, cur);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    IDBObjectStore.prototype.put = o;
    return n;
  }, [PID, cur]);
  expect(puts, '★무편집 로드가 디스크를 썼다').toBe(0);
  expect(await ids(page)).toEqual(['OLD']);
  expect(errs).toEqual([]);
});

test('S3 [음성] 다 읽은 뒤 넣은 장은 평소대로 남는다', async ({ page }) => {
  const { errs, cur } = await setup(page);
  await page.evaluate(async ([src]) => { await window._scratchAddAndSave(src, 960, 400, 200, undefined, 'NEW'); }, [PNG]);
  await reread(page, cur);
  expect(await ids(page)).toEqual(['NEW', 'OLD']);
  expect(errs).toEqual([]);
});
