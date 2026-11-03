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
