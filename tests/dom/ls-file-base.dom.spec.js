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

async function open(page, { ls = snap('LS'), lsTs, base, file = {} }) {
  await page.addInitScript(({ file }) => {
    let real;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(real || {}, { get: (t, k) => {
      if (k === 'loadProject') return async () => ({ ...file });
      if (k === 'saveProject') return async (p) => { window.__saved = p; return { ok: true }; };
      if (k === 'assetsSaveCanvasImage') return async () => ({ ok: true, url: 'goya-asset://p1/new.png' });
      return t[k];
    } }), set: (v) => { real = v; } });
  }, { file: { ...snap('FILE'), id: 'p1', name: 'n', updatedAt: UPD, ...file } });
  await bootApp(page);
  await page.evaluate(({ ls, lsTs, base }) => {
    const k = 'web-editor-autosave__p1';
    localStorage.setItem(k, ls); localStorage.setItem(k + '_ts', String(lsTs));
    if (base) localStorage.setItem('web-editor-ls-base__p1', base); else localStorage.removeItem('web-editor-ls-base__p1');
  }, { ls: JSON.stringify(ls), lsTs, base });
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
test('거절한 본은 걷는다 — 저장 없이 끝나 다시 열어도 파일이다', async ({ page }) => {
  await open(page, { lsTs: fileTs + 3600e3, base: '2026-11-03T01:00:00.000Z' });
  expect(await seen(page)).toBe('FILE');
  expect(await page.evaluate(() => [localStorage.getItem('web-editor-autosave__p1'), localStorage.getItem('web-editor-autosave__p1_ts')])).toEqual([null, null]);
  await page.goto(`${ORIGIN}/index.html?project=p1`);
  await page.waitForFunction(() => document.querySelector('#g1')?.dataset.mark);
  expect(await seen(page)).toBe('FILE');
});
test('[음성] 깨진 파일 대신 읽은 백업(판이 다름)은 더 새 localStorage 를 못 이긴다', async ({ page }) => {
  await open(page, { lsTs: fileTs + 3600e3, base: '2026-11-03T01:00:00.000Z', file: { _recovered: 'backup' } });
  expect(await seen(page)).toBe('LS');
});
test('[음성] 숫자 updatedAt 파일도 같은 판이면 localStorage 로 복구한다', async ({ page }) => {
  await open(page, { lsTs: fileTs + 3600e3, base: String(fileTs), file: { updatedAt: fileTs } });
  expect(await seen(page)).toBe('LS');
});
test('부팅 중 활성 프로젝트가 바뀌어도 표시는 부팅 프로젝트 몫이다', async ({ page }) => {
  await page.addInitScript(({ file }) => {
    let real;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(real || {}, { get: (t, k) => {
      if (k === 'loadProject') return async () => { if (window.__swap) window.activeProjectId = 'p2'; return { ...file }; };
      return t[k];
    } }), set: (v) => { real = v; } });
    window.__swap = location.search.includes('project=p1');
  }, { file: { ...snap('FILE'), id: 'p1', name: 'n', updatedAt: UPD } });
  await bootApp(page);
  await page.goto(`${ORIGIN}/index.html?project=p1`);
  await page.waitForFunction(() => localStorage.getItem('web-editor-ls-base__p1') || localStorage.getItem('web-editor-ls-base__p2'));
  expect(await page.evaluate(() => [localStorage.getItem('web-editor-ls-base__p1'), localStorage.getItem('web-editor-ls-base__p2')])).toEqual([UPD, null]);
});
test('localStorage 본이 이겨도 파일에만 있는 갤러리 항목은 남는다', async ({ page }) => {
  await open(page, { ls: { ...snap('LS'), imageGallery: [{ id: 'a' }] }, lsTs: fileTs + 3600e3, base: UPD, file: { imageGallery: [{ id: 'a' }, { id: 'gal1' }] } });
  expect(await seen(page)).toBe('LS');
  await expect.poll(() => page.evaluate(() => (window.state.imageGallery || []).map(x => x.id))).toEqual(['a', 'gal1']);
});
test('복구한 본이 파일과 다르면 편집 없이도 파일에 넣는다', async ({ page }) => {
  await open(page, { lsTs: fileTs + 3600e3, base: UPD });
  await expect.poll(() => page.evaluate(() => /data-mark="LS"/.test(window.__saved?.pages?.[0]?.canvas || '')), { timeout: 8000 }).toBe(true);
});
test('[음성] localStorage 본이 파일과 같으면 안 쓴다(DEF-03) · 그림이 data 와 goya 로만 달라도 같다', async ({ page }) => {
  const pic = (src) => ({ ...snap('FILE'), pages: [{ id: 'p', name: 'P', pageSettings: {}, canvas: canvas('FILE') + `<img src="${src}">` }] });
  await open(page, { ls: pic('data:image/png;base64,AAAA'), lsTs: fileTs + 3600e3, base: UPD, file: pic('goya-asset://p1/h.png') });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));   // 고침이 예약하는 자리(두 프레임 뒤)를 지난다
  expect(await page.evaluate(() => window.hasUnsavedChanges())).toBe(false);
  expect(await page.evaluate(() => window.__saved || null)).toBeNull();
});
test('localStorage 가 꽉 차 표시를 못 써도 프로젝트는 열린다', async ({ page }) => {
  await page.addInitScript(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('web-editor-ls-base__')) throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; });
  await open(page, { lsTs: fileTs - 3600e3, base: null });
  expect(await seen(page)).toBe('FILE');
});
test('파일보다 조금이라도 낡은 본은 못 이긴다(탭·홈으로 나간 저장 뒤)', async ({ page }) => {
  await open(page, { lsTs: fileTs - 20, base: UPD });
  expect(await seen(page)).toBe('FILE');
});
const pic = (src) => ({ ...snap('FILE'), pages: [{ id: 'p', name: 'P', pageSettings: {}, canvas: canvas('FILE') + `<div id="pc" style="background-image: url(&quot;${src}&quot;);"></div>` }] });
const writes = (page, n = true) => expect.poll(() => page.evaluate(() => !!window.__saved), { timeout: 8000 }).toBe(n);
const settled = async (page) => { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))); return page.evaluate(() => [window.hasUnsavedChanges(), !!window.__saved]); };
test('그림만 다른 그림으로 바뀐 본(goya a·b)은 다르다 — 파일로 넣는다', async ({ page }) => {
  await open(page, { ls: pic('goya-asset://p1/bbbb.png'), lsTs: fileTs + 3600e3, base: UPD, file: pic('goya-asset://p1/aaaa.png') });
  await writes(page);
});
test('[음성] 배경 url(&quot;…&quot;) 안의 data 와 goya 는 글자가 달라도 같다(하네스는 해시가 없어 같다고 본다)', async ({ page }) => {
  await open(page, { ls: pic('data:image/png;base64,AAAA'), lsTs: fileTs + 3600e3, base: UPD, file: pic('goya-asset://p1/h.png') });
  expect(await settled(page)).toEqual([false, false]);
});
test('캔버스 밖 변경(체크리스트)만 다른 본도 파일로 넣는다', async ({ page }) => {
  await open(page, { ls: { ...snap('FILE'), checklistItems: [{ id: 'c' }] }, lsTs: fileTs + 3600e3, base: UPD });
  await writes(page);
});
test('[음성] 옛 파일에 없는 필드 · 빈 값으로는 안 쓴다', async ({ page }) => {
  await open(page, { ls: { ...snap('FILE'), checklistItems: [], checklistSections: [], assetsTree: [], imageGallery: [] }, lsTs: fileTs + 3600e3, base: UPD });
  expect(await settled(page)).toEqual([false, false]);
});
test('복구 저장은 본의 data 그림을 파일에 되돌리지 않는다', async ({ page }) => {
  await open(page, { ls: pic('data:image/png;base64,AAAA'), lsTs: fileTs + 3600e3, base: UPD, file: { ...pic('goya-asset://p1/h.png'), checklistItems: [{ id: 'x' }] } });
  await writes(page);
  expect(await page.evaluate(() => window.__saved.pages[0].canvas.includes('data:image'))).toBe(false);
});
test('[음성] 부팅 중 다른 프로젝트로 갔으면 복구 저장을 걸지 않는다', async ({ page }) => {
  await page.addInitScript(({ file }) => {
    let real;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(real || {}, { get: (t, k) => {
      if (k === 'loadProject') return async () => { if (location.search.includes('project=p1')) window.activeProjectId = 'p2'; return { ...file }; };
      if (k === 'saveProject') return async (p) => { window.__saved = p; return { ok: true }; };
      return t[k];
    } }), set: (v) => { real = v; } });
  }, { file: { ...snap('FILE'), id: 'p1', name: 'n', updatedAt: UPD } });
  await bootApp(page);
  await page.evaluate(({ ls, lsTs, upd }) => { for (const id of ['p1', 'p2']) { const k = 'web-editor-autosave__' + id; localStorage.setItem(k, ls); localStorage.setItem(k + '_ts', String(lsTs)); localStorage.setItem('web-editor-ls-base__' + id, upd); } }, { ls: JSON.stringify(snap('LS')), lsTs: fileTs + 3600e3, upd: UPD });
  await page.goto(`${ORIGIN}/index.html?project=p1`);
  await page.waitForFunction(() => window.activeProjectId === 'p2' && localStorage.getItem('web-editor-ls-base__p1'));
  expect(await settled(page)).toEqual([false, false]);
});
test('비교가 거절되면(해시 실패) 다르다고 치고 파일로 넣는다', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(globalThis.crypto, 'subtle', { configurable: true, value: { digest: async () => { throw new Error('no'); } } }); });
  await open(page, { ls: pic('data:image/png;base64,AAAA'), lsTs: fileTs + 3600e3, base: UPD, file: pic('goya-asset://p1/h.png') });
  await writes(page);
});
const tabOpen = async (page, id, { ls = snap('LS'), lsTs, base }) => {
  await page.evaluate(({ id, ls, lsTs, base }) => { const k = 'web-editor-autosave__' + id; localStorage.setItem(k, ls); localStorage.setItem(k + '_ts', String(lsTs)); if (base) localStorage.setItem('web-editor-ls-base__' + id, base); else localStorage.removeItem('web-editor-ls-base__' + id); window.__saved = null; }, { id, ls: JSON.stringify(ls), lsTs, base });
  await page.evaluate((id) => window.openTabForProject(id), id);
  await page.waitForFunction((id) => window.activeProjectId === id && document.querySelector('#g1')?.dataset.mark, id);
};
test('탭으로 연 프로젝트도 충돌로 낡은 파일이면 복구하고 파일로 넣는다', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  await tabOpen(page, 'p3', { lsTs: fileTs + 3600e3, base: UPD });
  expect(await seen(page)).toBe('LS');
  await writes(page);
  expect(await page.evaluate(() => window.__saved.id)).toBe('p3');
});
test('[음성] 탭: 표시 없는 옛 본은 파일 · 본과 표시는 그대로 둔다', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  await tabOpen(page, 'p4', { lsTs: fileTs + 3600e3, base: null });
  expect(await seen(page)).toBe('FILE');
  expect(await settled(page)).toEqual([false, false]);
  expect(await page.evaluate(() => [localStorage.getItem('web-editor-ls-base__p4'), !!localStorage.getItem('web-editor-autosave__p4')])).toEqual([null, true]);
});
test('[음성] 탭: 평소 저장 뒤(본이 조금 낡음)는 파일 · 안 쓴다', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  await tabOpen(page, 'p5', { lsTs: fileTs - 20, base: UPD });
  expect(await seen(page)).toBe('FILE');
  expect(await settled(page)).toEqual([false, false]);
});
test('[음성] 탭: 판이 다른 본(복원한 파일)은 걷고 파일', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  await tabOpen(page, 'p6', { lsTs: fileTs + 3600e3, base: 'other' });
  expect(await seen(page)).toBe('FILE');
  expect(await page.evaluate(() => localStorage.getItem('web-editor-autosave__p6'))).toBeNull();
});
async function storeBoot(page, delay = 0) {
  await page.addInitScript(({ file, delay }) => {
    let real; window.__store = {}; window.__delay = delay;
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(real || {}, { get: (t, k) => {
      if (k === 'loadProject') return async (id) => ({ ...(window.__store[id] || file), id });
      if (k === 'saveProject') return async (p) => { await new Promise((r) => setTimeout(r, window.__delay)); window.__store[p.id] = p; window.__saved = p; return { ok: true }; };
      return t[k];
    } }), set: (v) => { real = v; } });
  }, { file: { ...snap('FILE'), name: 'n', updatedAt: UPD }, delay });
  await bootApp(page);
  await page.goto(`${ORIGIN}/index.html?project=p1`);
  await page.waitForFunction(() => document.querySelector('#g1')?.dataset.mark);
}
const setMark = (page, m) => page.evaluate((m) => { document.querySelector('#g1').dataset.mark = m; window.scheduleAutoSave(); }, m);
test('저장 중 편집 → 탭 닫기 → 쓰기 끝나기 전 다시 열기: 대기 중이던 편집이 산다', async ({ page }) => {
  await storeBoot(page);
  await page.evaluate(() => window.openTabForProject('p3'));
  await page.waitForFunction(() => window.activeProjectId === 'p3' && document.querySelector('#g1')?.dataset.mark);
  await page.evaluate(() => { window.__delay = 800; });
  await setMark(page, 'Q');
  await page.waitForFunction(() => /data-mark=\\?"Q/.test(localStorage.getItem('web-editor-autosave__p3') || ''));
  await page.evaluate(() => { document.querySelector('#g1').dataset.mark = 'Z'; return window.closeTab('p3').then(() => window.openTabForProject('p3')); });
  await page.waitForFunction(() => window.activeProjectId === 'p3' && document.querySelector('#g1')?.dataset.mark);
  expect(await seen(page)).toBe('Z');
  expect(await page.evaluate(() => /data-mark="Z"/.test(window.__store.p3?.pages?.[0]?.canvas || ''))).toBe(true);
});
test('저장이 상한 안에 안 끝나면 본을 쓰지 않고 파일로 연다', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  await page.evaluate(() => { window.waitSavesFor = async () => false; });
  await tabOpen(page, 'p3', { lsTs: fileTs + 3600e3, base: UPD });
  expect(await seen(page)).toBe('FILE');
});
test('복구 첫 로드 직후 다른 탭으로 갔다 돌아와도 복구분을 파일로 넣는다', async ({ page }) => {
  await storeBoot(page);
  await page.evaluate(({ ls, lsTs, upd }) => {
    const k = 'web-editor-autosave__p3'; localStorage.setItem(k, ls); localStorage.setItem(k + '_ts', String(lsTs)); localStorage.setItem('web-editor-ls-base__p3', upd);
    const c = document.getElementById('canvas');
    const o = new MutationObserver(() => { if (document.querySelector('#g1')?.dataset.mark === 'LS') { o.disconnect(); window.__away = window.switchTab('p1'); } });
    o.observe(c, { subtree: true, childList: true, attributes: true });
    window.openTabForProject('p3');
  }, { ls: JSON.stringify(snap('LS')), lsTs: fileTs + 3600e3, upd: UPD });
  await page.waitForFunction(() => window.__away && window.activeProjectId === 'p1');
  await page.evaluate(() => window.__away);
  expect(await page.evaluate(() => window.__saved || null)).toBeNull();
  await page.evaluate(() => window.switchTab('p3'));
  await expect.poll(() => page.evaluate(() => /data-mark="LS"/.test(window.__store.p3?.pages?.[0]?.canvas || '')), { timeout: 8000 }).toBe(true);
});
test('상한을 넘겨 낡게 연 탭: 편집이 파일을 덮지 않고, 돌아오면 파일을 다시 읽는다', async ({ page }) => {
  await storeBoot(page);
  await page.evaluate(() => { const w = window.waitSavesFor; window.waitSavesFor = async () => false; window.__w = w; });
  await page.evaluate(() => window.openTabForProject('p3'));
  await page.waitForFunction(() => window.activeProjectId === 'p3' && document.querySelector('#g1')?.dataset.mark);
  await page.evaluate(() => { window.__saved = null; window.waitSavesFor = window.__w; });
  await setMark(page, 'STALE');
  await page.waitForFunction(() => [...document.querySelectorAll('[id*=toast],[class*=toast]')].some((e) => e.textContent.includes('이 편집은 저장되지 않습니다')));
  await expect.poll(() => page.evaluate(() => window.isTabFirstLoading('p3'))).toBe(true);
  expect(await page.evaluate(() => window.__saved)).toBeNull();
  await page.evaluate(() => window.switchTab('p1'));
  await page.evaluate(() => window.switchTab('p3'));
  await page.waitForFunction(() => window.activeProjectId === 'p3' && document.querySelector('#g1')?.dataset.mark);
  expect(await seen(page)).toBe('FILE');
  expect(await page.evaluate(() => window.isTabFirstLoading('p3'))).toBe(false);
});
test('낡게 연 탭: 앞 프로젝트 저장이 끝나도 편집이 저장된 척하지 않는다', async ({ page }) => {
  await storeBoot(page);
  await page.evaluate(() => { const w = window.waitSavesFor; window.waitSavesFor = async () => false; window.__w = w; });
  await page.evaluate(() => window.openTabForProject('p3'));
  await page.waitForFunction(() => window.activeProjectId === 'p3' && document.querySelector('#g1')?.dataset.mark);
  await page.evaluate(() => { window.waitSavesFor = window.__w; });
  await setMark(page, 'STALE');
  await expect(page.locator('#autosave-indicator')).toContainText('저장 실패');
  await page.evaluate(() => window.saveProjectToFile(JSON.stringify({ version: 2, currentPageId: 'x', pages: [{ id: 'x', canvas: '<div class="section-block"></div>' }] }), { skipThumbnail: true, projectId: 'p1' }));
  expect(await page.evaluate(() => window.hasUnsavedChanges()), '★안 남은 편집의 미저장 표시를 지웠다').toBe(true);
  await page.evaluate(async () => { (await import('/js/io/save-load.js')); });
  await expect(page.locator('#autosave-indicator')).toContainText('저장 실패');
});
test('앞 저장을 기다리는 중 온 타이머는 «읽지 못해»라고 말하지 않는다', async ({ page }) => {
  await storeBoot(page);
  await page.evaluate(() => { window.__w = window.waitSavesFor; window.waitSavesFor = () => new Promise((r) => { window.__go = r; }); window.__ts = []; const t = window.showToast; window.showToast = (m) => { window.__ts.push(m); return t?.(m); }; });
  await page.evaluate(() => { window.openTabForProject('p3'); });
  await page.waitForFunction(() => window.activeProjectId === 'p3' && window.isTabFirstLoading('p3') && window.__go);
  await page.evaluate(() => window.scheduleAutoSave());
  await page.waitForFunction(() => document.getElementById('autosave-indicator')?.textContent.includes('저장 실패'));
  expect(await page.evaluate(() => window.__ts)).toEqual([]);
  await page.evaluate(() => { window.waitSavesFor = window.__w; window.__go(false); });
  await page.waitForFunction(() => window.__ts.some((m) => m.includes('앞 저장이 아직 안 끝나')));
  expect((await page.evaluate(() => window.__ts)).filter((m) => m.includes('읽지 못해'))).toEqual([]);
});
test('쿼터 축출은 파일에 든 본부터, 안 든 복구본은 안 지운다', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  const order = await page.evaluate(async () => {
    const { safeLocalStorageSet } = await import('/js/io/save-load.js');
    const K = 'web-editor-autosave__'; const now = Date.now();
    for (const k of Object.keys(localStorage)) if (k.startsWith(K)) localStorage.removeItem(k);
    const put = (id, ts, base) => { localStorage.setItem(K + id, 'x'); localStorage.setItem(K + id + '_ts', String(ts)); if (base) localStorage.setItem('web-editor-ls-base__' + id, base); };
    put('rec', now - 9e6, new Date(now - 1e7).toISOString());   // 가장 오래됐지만 파일보다 새로운 복구본
    put('recnum', now - 8e6, String(now - 1e7));                // 숫자 updatedAt 복구본
    put('filed', now - 1000, new Date(now).toISOString());      // 새롭지만 파일에 든 본
    put('nomark', now - 500, null);
    const o = Storage.prototype.setItem; let left = 4; const gone = () => ['rec', 'recnum', 'filed', 'nomark'].filter((id) => localStorage.getItem(K + id) === null);
    const seq = [];
    Storage.prototype.setItem = function (k, v) { if (k === K + 'me' && left-- > 0) { const b = gone(); if (seq.at(-1)?.join() !== b.join()) seq.push(b); throw new DOMException('q', 'QuotaExceededError'); } return o.call(this, k, v); };
    try { safeLocalStorageSet(K + 'me', 'y'); } finally { Storage.prototype.setItem = o; }
    seq.push(gone());
    return seq;
  });
  expect(order).toEqual([[], ['filed'], ['filed', 'nomark']]);
});
const big = (m) => JSON.stringify({ ...snap(m), pad: 'p'.repeat(2.2 * 1024 * 1024) });
const lsOf = (page, id) => page.evaluate((id) => { const k = 'web-editor-autosave__' + id; const v = localStorage.getItem(k); return { len: v?.length ?? null, ts: localStorage.getItem(k + '_ts'), big: (v?.length ?? 0) > 2097152 }; }, id);
test('2MB 초과 본: 저장 실패면 큰 본을 남기고, 저장 전에는 앞 본을 안 지운다', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  const id = await page.evaluate(() => window.activeProjectId);
  await page.evaluate((id) => { localStorage.setItem('web-editor-autosave__' + id, 'old'); localStorage.setItem('web-editor-autosave__' + id + '_ts', '1'); }, id);
  const before = await page.evaluate(async ([s, id]) => (await import('/js/io/save-load.js')).safeLocalStorageSet('web-editor-autosave__' + id, s), [big('B'), id]);
  expect(before).toBe(false);
  expect(await lsOf(page, id)).toMatchObject({ len: 3, ts: '1' });
  await page.evaluate(async ([s, id]) => {
    const a = window.electronAPI; Object.defineProperty(window, 'electronAPI', { configurable: true, value: new Proxy(a, { get: (t, k) => k === 'saveProject' ? async () => ({ ok: false, reason: 'x' }) : t[k] }) });
    await window.saveProjectToFile(s, { skipThumbnail: true, projectId: id });
  }, [big('B'), id]);
  const l = await lsOf(page, id);
  expect(l.big).toBe(true); expect(l.ts).not.toBe('1');
});
test('[BUG-44] 2MB 초과 본이 파일에 들어가면 본을 지운다', async ({ page }) => {
  await open(page, { lsTs: fileTs - 3600e3, base: UPD });
  const id = await page.evaluate(() => window.activeProjectId);
  await page.evaluate(async ([s, id]) => { localStorage.setItem('web-editor-autosave__' + id, 'old'); await window.saveProjectToFile(s, { skipThumbnail: true, projectId: id }); }, [big('B'), id]);
  expect(await lsOf(page, id)).toMatchObject({ len: null, ts: null });
});
