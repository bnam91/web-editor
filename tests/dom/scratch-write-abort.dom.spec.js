/* scratch-write-abort — 스크래치 쓰기 tx 가 커밋에서 abort(quota 꼴)로 끝날 때. 진짜 quota 를 채우지 않고 요청 성공 뒤 tx.abort 로 흉내 낸다, error 이벤트 없이 abort 만 난다.
 * 자: promise 가 끝나나 · 항목 id · saveProject 호출 · 토스트. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const S = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
async function ready(page) {
  await bootApp(page);
  await page.evaluate(async () => {
    window.__armed = false; window.__toasts = []; const o = window.showToast; window.showToast = (t, ...a) => { window.__toasts.push(String(t)); return o?.(t, ...a); };
    window.addEventListener('unhandledrejection', (e) => e.preventDefault());
    const ot = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (a, m, ...r) { const t = ot.call(this, a, m, ...r); if (m === 'readwrite' && window.__armed) { const os = t.objectStore.bind(t); t.objectStore = (n) => { const st = os(n); for (const f of ['put', 'delete']) { const op = st[f].bind(st); st[f] = (...x) => { const q = op(...x); q.addEventListener('success', () => { try { t.abort(); } catch (_) {} }); return q; }; } return st; }; } return t; };
    window.__settle = async (p) => { let st = '대기'; Promise.resolve(p).then(() => { st = '끝'; }, () => { st = '거절'; }); for (let i = 0; i < 40 && st === '대기'; i++) await new Promise((r) => setTimeout(r, 50)); return st; };
    await window.switchScratch('proj_1', 'p1');
  });
}
const on = (page) => page.evaluate(() => { window.__armed = true; });
const off = (page) => page.evaluate(() => { window.__armed = false; });
const items = (page) => page.evaluate(() => [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId).sort());

test('외부화 쓰기가 abort 나도 멈추지 않는다, 매니페스트는 남는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await page.evaluate(() => { Object.defineProperty(window, 'electronAPI', { value: { assetsSaveCanvasImage: async () => ({ ok: true, url: 'goya-asset://proj_1/s.png' }) }, configurable: true, writable: true }); });
  await on(page);
  const r = await page.evaluate(async () => { const proj = { pages: [{ id: 'p1' }] }; const st = await window.__settle(window.externalizeScratchpad(proj, 'proj_1')); return { st, src: proj.pages[0].scratchpad?.[0]?.src }; });
  expect(r).toEqual({ st: '끝', src: 'goya-asset://proj_1/s.png' });
});
test('flush 쓰기가 실패해도 그 키를 다시 열면 항목이 돌아온다, 멈추지 않는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await on(page);
  expect(await page.evaluate((S) => window.__settle(window._scratchAddAndSave(S, 10, 90, 50, null, 's_2')), S)).toBe('거절');
  expect(await page.evaluate(() => window.__settle(window.flushScratchForSwitch()))).toBe('거절');
  await off(page);
  expect(await items(page)).toEqual([]);
  await page.evaluate(() => window.switchScratch('proj_1', 'p1'));
  await expect.poll(() => items(page)).toEqual(['s_1', 's_2']);
  await expect.poll(() => page.evaluate(async () => (await window._scratchExportAll('proj_1', ['p1'])).flatMap((b) => b.items.map((i) => i.id)).sort())).toEqual(['s_1', 's_2']);
});
test('음성: flush 쓰기가 성공하면 되살릴 것이 없다, 다른 키에 안 샌다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await page.evaluate(() => window.flushScratchForSwitch());
  await page.evaluate(() => window.switchScratch('proj_2', 'p1'));
  await expect.poll(() => items(page)).toEqual([]);
  await page.evaluate(() => window.switchScratch('proj_1', 'p1'));
  await expect.poll(() => items(page)).toEqual(['s_1']);
});
test('clearScratchPad 쓰기가 abort 나면 멈추지 않고 거절한다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await on(page);
  expect(await page.evaluate(() => window.__settle(window.clearScratchPad()))).toBe('거절');
});
const WARN = '⚠️ 스크래치를 저장하지 못했습니다. 다시 열면 지금 화면과 다를 수 있습니다.';
test('공용 알림: 말없던 자리(안 기다리는 저장 포함)에서 알리고, 연달아 실패해도 한 번이다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await on(page);
  await page.evaluate(() => window._scratchSaveSoon(0));
  await expect.poll(() => page.evaluate(() => window.__toasts)).toEqual([WARN]);
  await page.evaluate((S) => window.__settle(window._scratchAddAndSave(S, 10, 90, 50, null, 's_2')), S);
  expect(await page.evaluate(() => window.__toasts)).toEqual([WARN]);
});
test('음성 공용 알림: 저장이 되면 안 알린다, 넣기 실패는 부르는 쪽 말에 맡긴다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  expect(await page.evaluate(() => window.__toasts)).toEqual([]);
  await on(page);
  expect(await page.evaluate((S) => window.__settle(window._scratchImportAll('proj_3', [{ pageId: 'p1', items: [{ id: 'x', src: S, x: 1, y: 1, w: 1 }] }])), S)).toBe('거절');
  expect(await page.evaluate(() => window.__toasts)).toEqual([]);
});
const dbIds = (page, key = 'scratch-pad-proj_1-p1') => page.evaluate((key) => new Promise((res) => { const q = indexedDB.open('ScratchPadDB'); q.onsuccess = (e) => { const db = e.target.result; const st = [...db.objectStoreNames][0]; const r = db.transaction(st).objectStore(st).get(key); r.onsuccess = (ev) => { db.close(); res(ev.target.result === undefined ? null : ev.target.result.map((i) => i.id + '=' + (i.src.startsWith('data') ? 'data' : 'goya'))); }; }; }), key);
const holdExternalize = (page) => page.evaluate(() => { window.__release = null; Object.defineProperty(window, 'electronAPI', { value: { assetsSaveCanvasImage: () => new Promise((res) => { window.__release = () => res({ ok: true, url: 'goya-asset://proj_1/a.png' }); }) }, configurable: true, writable: true }); });
test('외부화 경합: IPC 를 기다리는 사이 새 항목을 넣고 탭을 옮겨도 그 항목이 남는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_a'), S);
  await holdExternalize(page);
  await page.evaluate(() => { window.__ext = window.externalizeScratchpad({ pages: [{ id: 'p1' }] }, 'proj_1'); });
  await expect.poll(() => page.evaluate(() => !!window.__release)).toBe(true);
  await page.evaluate((S) => window._scratchAddAndSave(S.replace('A', 'B'), 10, 90, 50, null, 's_b'), S);
  await page.evaluate(() => window.flushScratchForSwitch());
  await page.evaluate(async () => { window.__release(); await window.__ext; });
  expect(await dbIds(page)).toEqual(['s_a=goya', 's_b=data']);
});
test('음성 외부화 경합: 기다리는 사이 지운 항목·지운 키를 되살리지 않는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_a'), S);
  await holdExternalize(page);
  await page.evaluate(() => { window.__ext = window.externalizeScratchpad({ pages: [{ id: 'p1' }] }, 'proj_1'); });
  await expect.poll(() => page.evaluate(() => !!window.__release)).toBe(true);
  await page.evaluate(() => window.clearScratchPad());
  await page.evaluate(async () => { window.__release(); await window.__ext; });
  expect(await dbIds(page)).toBe(null);
});
const failNextRead = (page) => page.evaluate(() => { const og = IDBObjectStore.prototype.get; IDBObjectStore.prototype.get = function (...a) { IDBObjectStore.prototype.get = og; throw new DOMException('대역 읽기 실패', 'UnknownError'); }; });
test('복원: flush 실패 뒤 다시 열 때 읽기가 실패해도 항목이 돌아오고, 다음 열기에 새 DB 를 안 덮는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await on(page);
  await page.evaluate((S) => window.__settle(window._scratchAddAndSave(S, 10, 90, 50, null, 's_2')), S);
  await page.evaluate(() => window.__settle(window.flushScratchForSwitch()));
  await off(page);
  await failNextRead(page);
  await page.evaluate(() => window.switchScratch('proj_1', 'p1'));
  await expect.poll(() => items(page)).toEqual(['s_1', 's_2']);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 170, 50, null, 's_new'), S);
  await page.evaluate(() => window.flushScratchForSwitch());
  await page.evaluate(() => window.switchScratch('proj_1', 'p1'));
  await expect.poll(() => items(page)).toEqual(['s_1', 's_2', 's_new']);
});
test('음성 복원: 되살릴 것이 없을 때 읽기가 실패하면 전처럼 복원 실패를 알린다', async ({ page }) => {
  await ready(page);
  await failNextRead(page);
  await page.evaluate(() => window.switchScratch('proj_1', 'p1'));
  await expect.poll(() => page.evaluate(() => window.__toasts)).toEqual(['⚠️ 스크래치패드 복원 실패 (세션 중에는 정상 동작)']);
});
test('전부 지운 판: flush 가 실패해도 다시 열 때 매니페스트로 되채우지 않는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => { window.state.pages = [{ id: 'p1', canvas: '', scratchpad: [{ id: 's_m', src: S, x: 1, y: 1, w: 9 }] }]; window.state.currentPageId = 'p1'; }, S);
  await page.evaluate(() => window.switchScratch('proj_m', 'p1'));
  await expect.poll(() => items(page)).toEqual(['s_m']);
  await page.evaluate(() => window._scratchRemoveById('s_m'));
  await on(page);
  await page.evaluate(() => window.__settle(window.flushScratchForSwitch()));
  await off(page);
  await page.evaluate(() => window.switchScratch('proj_m', 'p1'));
  await expect.poll(() => dbIds(page, 'scratch-pad-proj_m-p1')).toEqual([]);
  expect(await items(page)).toEqual([]);
});
test('음성 전부 지운 판: IDB 가 빈 다른 맥은 매니페스트로 채운다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => { window.state.pages = [{ id: 'p2', canvas: '', scratchpad: [{ id: 's_m', src: S, x: 1, y: 1, w: 9 }] }]; }, S);
  await page.evaluate(() => window.switchScratch('proj_9', 'p2'));
  await expect.poll(() => items(page)).toEqual(['s_m']);
});
test('페이지 삭제: 저장이 실패하면 토스트는 하나다, 페이지는 안 지운다', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => { window.state.pages = [{ id: 'p1', name: '1', canvas: '' }, { id: 'p2', name: '2', canvas: '' }]; window.state.currentPageId = 'p1'; });
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await on(page);
  await page.evaluate(() => window.__settle(window.deletePage('p1')));
  await expect.poll(() => page.evaluate(() => window.__toasts)).toEqual(['⚠️ 스크래치 저장에 실패해 페이지를 지우지 않았습니다.']);
  expect(await page.evaluate(() => window.state.pages.length)).toBe(2);
});
test('음성 페이지 삭제: 다른 저장 실패는 전처럼 공용 알림이다', async ({ page }) => {
  await ready(page);
  await on(page);
  await page.evaluate((S) => window.__settle(window._scratchAddAndSave(S, 10, 10, 50, null, 's_1')), S);
  await expect.poll(() => page.evaluate(() => window.__toasts)).toEqual(['⚠️ 스크래치를 저장하지 못했습니다. 다시 열면 지금 화면과 다를 수 있습니다.']);
});
const srcOf = (page, id) => page.evaluate((id) => window._scratchItemById(id)?.src?.slice(0, 40), id);
test('외부화 대기 중 같은 id 로 새 그림이 들어와도 옛 그림으로 안 돌아간다', async ({ page }) => {
  await ready(page);
  const NEW = S.replace('A', 'B');
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_a'), S);
  await holdExternalize(page);
  await page.evaluate(() => { window.__ext = window.externalizeScratchpad({ pages: [{ id: 'p1' }] }, 'proj_1'); });
  await expect.poll(() => page.evaluate(() => !!window.__release)).toBe(true);
  await page.evaluate(async (NEW) => { await window._scratchRemoveById('s_a'); await window._scratchAddAndSave(NEW, 10, 10, 50, undefined, 's_a'); }, NEW);
  await page.evaluate(async () => { window.__release(); await window.__ext; });
  expect(await srcOf(page, 's_a')).toBe(NEW.slice(0, 40));
});
test('음성 외부화: 그림이 그대로면 화면 주소도 goya 로 바뀐다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_a'), S);
  await holdExternalize(page);
  await page.evaluate(() => { window.__ext = window.externalizeScratchpad({ pages: [{ id: 'p1' }] }, 'proj_1'); });
  await expect.poll(() => page.evaluate(() => !!window.__release)).toBe(true);
  await page.evaluate(async () => { window.__release(); await window.__ext; });
  expect(await srcOf(page, 's_a')).toBe('goya-asset://proj_1/a.png');
});
const reopen = (page) => page.evaluate(() => window.switchScratch('proj_1', 'p1'));
test('읽기 실패 판: 떠날 때 쓰기가 성공해도 DB 의 항목이 안 지워진다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await failNextRead(page); await reopen(page);
  await expect.poll(() => items(page)).toEqual([]);
  await page.evaluate(() => window.flushScratchForSwitch());
  await reopen(page);
  await expect.poll(() => items(page)).toEqual(['s_1']);
});
test('읽기 실패 판: 떠날 때 쓰기까지 실패해도 복구 뒤 다시 열면 항목이 있다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await failNextRead(page); await reopen(page);
  await on(page);
  expect(await page.evaluate(() => window.__settle(window.flushScratchForSwitch()))).toBe('거절');
  await off(page);
  await reopen(page);
  await expect.poll(() => items(page)).toEqual(['s_1']);
  expect(await dbIds(page)).toEqual(['s_1=data']);
});
test('읽기 실패 판: 새 항목을 넣어도 DB 의 옛 항목이 남는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await failNextRead(page); await reopen(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 90, 50, null, 's_new'), S);
  await expect.poll(() => dbIds(page)).toEqual(['s_1=data', 's_new=data']);
});
test('전부 지우고 flush 성공: 다시 열어도 낡은 매니페스트로 안 되살아난다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => { window.state.pages = [{ id: 'p1', canvas: '', scratchpad: [{ id: 's_m', src: S, x: 1, y: 1, w: 9 }] }]; window.state.currentPageId = 'p1'; }, S);
  await page.evaluate(() => window.switchScratch('proj_m', 'p1'));
  await expect.poll(() => items(page)).toEqual(['s_m']);
  await page.evaluate(() => window._scratchRemoveById('s_m'));
  await page.evaluate(() => window.flushScratchForSwitch());
  await page.evaluate(() => window.switchScratch('proj_m', 'p1'));
  await expect.poll(() => dbIds(page, 'scratch-pad-proj_m-p1')).toEqual([]);
  expect(await items(page)).toEqual([]);
});
test('음성 읽기 실패 판: 다음 로드가 성공하면 평소대로 지운 것이 지워진다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await failNextRead(page); await reopen(page);
  await reopen(page);
  await expect.poll(() => items(page)).toEqual(['s_1']);
  await page.evaluate(() => window._scratchRemoveById('s_1'));
  await expect.poll(() => dbIds(page)).toEqual([]);
});
