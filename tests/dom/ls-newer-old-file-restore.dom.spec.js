/* ls-newer-old-file-restore — 옛 proj.json 을 되돌려 놓아도 그보다 새 LS 편집을 말없이 지우지 않는다 (LS-NEWER-THAN-FILE-DELETED-ON-OLD-FILE-RESTORE-01)
 * 왜: 열 때 _pickLsOverFile 은 «LS 판 표지(lsBase) 있고 파일 updatedAt 과 다름» 이면 LS 본을 지웠다 — 시각 비교 없음.
 *   사용자가 옛 판(updatedAt T1 < lsBase T2)을 되돌려 놓으면 그 뒤의 LS 편집이 사라졌다.
 * 고침(지디 발주 · 새 UI 0): 파일이 lsBase 보다 옛것이면 LS 본을 비상 사본(projects:record-refused — 다음 실행 복구 제안)으로 먼저 남기고,
 *   남겨졌을 때만 지금처럼 지운다(되돌린 파일이 이긴다). 못 남기면 LS 와 표지를 그대로 두고 알린다 — 다음 열기에 다시 한다.
 *   파일이 새것이거나 시각을 못 믿으면(없음·같음·못 읽음) 지금 동작 그대로.
 * 자: window.pickLsOverFile 직접 — 부팅(unmarkedWins 기본)·탭(unmarkedWins:false) 두 입구가 같은 함수다. 사본 파일은 main 몫(가짜 기록).
 * 칸: N1 옛 파일 → 사본 남김·파일 우선·LS 걷음 · N2 탭 입구도 같다 · N3 [음성] 파일이 새것 → 지금대로(사본 0) · N4 [음성] 시각 못 믿음(lsBase 꼴 아님) → 지금대로
 *     N5 사본 실패 → 보류 자리로 옮기고 알림(자동저장이 못 덮음) · N6 다음 열기에 보류 본 다시 남김 · N7 남기는 사이 표지가 옮겨졌으면 손 안 댐
 *     N8 실패 + 그사이 편집 → 보류에 남음 · N9 앞 보류 본 안 덮음 · N10 표지가 이미 파일 판이면 끝맺음
 * 픽스처: 섹션 셋 · 글 블럭 · 그림 블럭 둘. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const A = 'proj_lna';
const RED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const T1 = '2026-11-01T00:00:00.000Z', T2 = '2026-11-05T00:00:00.000Z', T3 = '2026-11-08T00:00:00.000Z';

async function setup(page, { recordOk = true } = {}) {
  await page.addInitScript((recordOk) => {
    const fake = { recordRefusedSave: async (p, reason) => { if (window.__gate) await window.__gate; window.__kept.push({ id: p.id, reason, body: JSON.stringify(p) }); return { ok: window.__recordOk ?? recordOk }; } };
    window.__kept = [];
    Object.defineProperty(window, 'electronAPI', { configurable: true, get: () => new Proxy(fake, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) }), set: () => {} });
  }, recordOk);
  const errs = await bootApp(page);
  await page.evaluate(([A, RED, HALF, T2]) => {
    const img = (n, src) => `<div class="asset-block has-image" id="ab_${n}" data-img-src="${src}"><div class="asset-img-clip"><img class="asset-img" src="${src}"></div></div>`;
    const txt = (n, s) => `<div class="text-block" id="tb_${n}" data-type="text"><div class="tb-h2">${s}</div></div>`;
    const sec = (n, inner) => `<div class="section-block" id="sec_${n}"><div class="section-inner">${inner}</div></div>`;
    const ls = { id: A, name: A, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: sec(1, txt(1, '제목 · 되돌린 뒤 사라지면 안 되는 편집')) + sec(2, img(2, RED)) + sec(3, txt(3, '본문') + img(3, HALF)) }] };
    localStorage.setItem('web-editor-autosave__' + A, JSON.stringify(ls));
    localStorage.setItem('web-editor-autosave__' + A + '_ts', String(Date.parse(T2) + 3600e3));   // T2 판에서 이어 한 시간 뒤 편집
    localStorage.setItem('web-editor-ls-base__' + A, T2);
  }, [A, RED, HALF, T2]);
  return errs;
}
const file = (updatedAt) => ({ id: A, name: A, version: 2, updatedAt, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P1', pageSettings: {}, canvas: '<div class="section-block" id="sec_old"><div class="section-inner"></div></div>' }] });
const pick = (page, proj, opts) => page.evaluate(([p, o]) => window.pickLsOverFile(p, p.id, o), [proj, opts]);
const lsOf = (page) => page.evaluate((A) => ({ ls: localStorage.getItem('web-editor-autosave__' + A), base: localStorage.getItem('web-editor-ls-base__' + A) }), A);
const kept = (page) => page.evaluate(() => window.__kept);

test('N1 옛 파일을 되돌려 놓고 열면 — 새 LS 편집을 사본으로 남기고, 파일이 이기고, LS 는 걷힌다', async ({ page }) => {
  const errs = await setup(page);
  expect(await pick(page, file(T1)), '되돌린 파일이 이겨야 한다').toBe(null);
  await expect.poll(() => kept(page).then(k => k.length), { message: '★새 LS 편집을 사본 없이 지웠다(말없는 손실)' }).toBe(1);
  const [k] = await kept(page);
  expect(k.body).toContain('되돌린 뒤 사라지면 안 되는 편집');
  expect(k.body).toContain(RED.slice(-24));
  expect(k.body).toContain(HALF.slice(-24));
  expect(k.reason).toBe('ls_newer_than_file');
  await expect.poll(() => lsOf(page).then(s => s.ls)).toBe(null);
  expect((await lsOf(page)).base, '표지가 되돌린 파일 판으로').toBe(T1);
  expect(errs).toEqual([]);
});
test('N2 탭 입구(unmarkedWins:false)도 같다', async ({ page }) => {
  await setup(page);
  expect(await pick(page, file(T1), { unmarkedWins: false })).toBe(null);
  await expect.poll(() => kept(page).then(k => k.length), { message: '★탭 입구에서 사본 없이 지웠다' }).toBe(1);
});
test('N3 [음성] 파일이 새것(밖에서 고친 판) — 지금대로 걷고 사본 0', async ({ page }) => {
  await setup(page);
  expect(await pick(page, file(T3))).toBe(null);
  expect((await lsOf(page)).ls).toBe(null);
  expect(await kept(page)).toEqual([]);
});
test('N4 [음성] 시각을 못 믿으면(lsBase 꼴 아님) 지금대로', async ({ page }) => {
  await setup(page);
  await page.evaluate((A) => localStorage.setItem('web-editor-ls-base__' + A, '판모름'), A);
  expect(await pick(page, file(T1))).toBe(null);
  expect((await lsOf(page)).ls).toBe(null);
  expect(await kept(page)).toEqual([]);
});
const pend = (page) => page.evaluate((A) => { const ks = Object.keys(localStorage).filter(k => k.startsWith('web-editor-ls-pending__' + A + '__')); return ks.length ? ks.map(k => localStorage.getItem(k)).join('\n') : null; }, A);
test('N5 사본을 못 남기면 그 본을 보류 자리에 옮기고 알린다 — 첫 편집의 자동저장이 덮지 못한다(리뷰 1-2)', async ({ page }) => {
  await setup(page, { recordOk: false });
  await page.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); return o?.(m); }; });
  expect(await pick(page, file(T1))).toBe(null);
  await expect.poll(() => page.evaluate(() => window.__toasts.length), { message: '★못 남겼는데 말이 없다' }).toBeGreaterThan(0);
  expect(await pend(page), '★못 남긴 본이 보류 자리에 없다 — 첫 편집이 LS 를 덮으면 잃는다').toContain('되돌린 뒤 사라지면 안 되는 편집');
  const s1 = await lsOf(page);
  expect([s1.ls, s1.base], '보류로 옮겼으면 LS 를 걷고 표지는 되돌린 파일 판').toEqual([null, T1]);
  await page.evaluate((A) => localStorage.setItem('web-editor-autosave__' + A, '{"pages":[]}'), A);   // 첫 편집의 자동저장 흉내
  expect(await pend(page), '★자동저장이 보류 본을 건드렸다').toContain('되돌린 뒤 사라지면 안 되는 편집');
});
test('N6 다음 열기에 보류 본을 다시 남기고, 남겨지면 보류 자리를 비운다', async ({ page }) => {
  await setup(page, { recordOk: false });
  expect(await pick(page, file(T1))).toBe(null);
  await expect.poll(() => pend(page)).not.toBe(null);
  await page.evaluate(() => { window.__recordOk = true; window.__kept.length = 0; });
  await pick(page, file(T1));
  await expect.poll(() => kept(page).then(k => k.filter(x => x.body.includes('되돌린 뒤 사라지면 안 되는 편집')).length), { message: '★보류 본을 다시 안 남겼다' }).toBe(1);
  await expect.poll(() => pend(page), { message: '★남겼는데 보류 자리가 안 비었다' }).toBe(null);
});
test('N7 사본을 남기는 사이 저장이 표지를 옮겼으면 손대지 않는다 — 낡은 판으로 되돌리지 않는다(리뷰 1-1)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__gate = new Promise(r => { window.__open = r; }); });
  expect(await pick(page, file(T1))).toBe(null);
  await page.evaluate(([A, T3]) => { localStorage.setItem('web-editor-ls-base__' + A, T3); window.__open(); }, [A, T3]);   // 그사이 파일 저장이 표지를 T3 로
  await expect.poll(() => kept(page).then(k => k.length)).toBe(1);
  await page.evaluate(() => new Promise(r => setTimeout(r, 0)));
  const s7 = await lsOf(page);
  expect(s7.base, '★저장이 옮긴 표지를 낡은 판으로 되돌렸다').toBe(T3);
  expect(s7.ls, '표지가 옮겨졌으면 본도 그대로').toContain('되돌린 뒤 사라지면 안 되는 편집');
});
test('N8 사본이 실패했는데 그사이 편집이 LS 를 바꿨어도 그 본은 보류 자리에 남는다(리뷰 2-1)', async ({ page }) => {
  await setup(page, { recordOk: false });
  await page.evaluate(() => { window.__gate = new Promise(r => { window.__open = r; }); });
  expect(await pick(page, file(T1))).toBe(null);
  await page.evaluate((A) => { localStorage.setItem('web-editor-autosave__' + A, '{"pages":[{"id":"p","canvas":"되돌린 파일에서 이은 편집"}]}'); window.__open(); }, A);
  await expect.poll(() => pend(page), { message: '★실패한 본이 아무 데도 없다' }).toContain('되돌린 뒤 사라지면 안 되는 편집');
  expect((await lsOf(page)).ls, '이은 편집은 그대로').toContain('되돌린 파일에서 이은 편집');
});
test('N9 앞 보류 본이 있어도 새 실패 본이 덮지 않는다(리뷰 2-2)', async ({ page }) => {
  await setup(page, { recordOk: false });
  await page.evaluate((A) => localStorage.setItem('web-editor-ls-pending__' + A + '__1', JSON.stringify({ id: A, pages: [{ id: 'p', canvas: '앞 보류 본' }] })), A);
  expect(await pick(page, file(T1))).toBe(null);
  await expect.poll(() => pend(page)).toContain('되돌린 뒤 사라지면 안 되는 편집');
  expect(await pend(page), '★앞 보류 본을 덮었다').toContain('앞 보류 본');
});
test('N10 표지가 이미 되돌린 파일 판이면 끝맺는다 — 남은 본이 다음 열기에 파일을 이기지 않게(리뷰 2-3)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.__gate = new Promise(r => { window.__open = r; }); });
  expect(await pick(page, file(T1))).toBe(null);
  await page.evaluate(([A, T1]) => { localStorage.setItem('web-editor-ls-base__' + A, T1); window.__open(); }, [A, T1]);
  await expect.poll(() => lsOf(page).then(s => s.ls), { message: '★남은 본이 다음 열기에 되돌린 파일을 이긴다' }).toBe(null);
});
