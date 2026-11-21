/* file-changed-outside — FILE-CHANGED-OUTSIDE-WHILE-OPEN-OVERWRITE-01(현빈 결정 261121) 렌더러 쪽: main 이 changed_outside 로 거절하면 고르게 한다.
 * 장면: 디스크·저장·버전 목록을 가짜 API 로(main 의 약속 = tests/unit/file-changed-outside). ⛔실 저장본 0.
 * D1 자동저장 길 거절 → 상자(닫기 없음) «다시 불러오기» + «내 것으로 저장» · 디스크 = 밖의 판 그대로 · 상자 png(SHOT=경로)
 * D2 다시 불러오기 → 버전 목록에서 그 핀(ts · outside-mine)을 찾은 뒤에만 → LS 본 걷음 · 화면 = 밖의 판 · 상자 닫힘
 * D3 다시 불러오기인데 핀이 목록에 없음 → 다시 안 읽음(화면 = 내 편집) · 상자에 까닭
 * D4 내 것으로 저장 → _overOutside 표시로 저장 · 디스크 = 내 편집 · 상자 닫힘
 * D5 내 본을 못 남김(kept:false) → «다시 불러오기» 없음(화면을 버릴 수 없다)
 * 양성대조: _patches/file-changed-outside-dom-CTL.patch(save-load 의 changed_outside 갈래 걷음) → D1 빨강.
 * 셀렉터·전역 대조(제품 소스 grep): #outside-change-overlay · .outside-change-reload · .outside-change-mine · .outside-change-msg(js/tab-system.js) · saveProjectToFile · serializeProject · switchTab · waitSavesFor(save-load.js)
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const sec = (k, t) => `<div class="section-block" id="s_${k}" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="text-block" id="tb_${k}"><p>${t}</p></div></div></div>`;
const doc = (id, tag) => ({ id, name: id + '이름', version: 2, currentPageId: 'page_1', updatedAt: '2026-11-01T00:00:00.000Z', pages: [{ id: 'page_1', name: 'P', canvas: sec(tag + '1', tag + ' 머리') + sec(tag + '2', tag + ' 끝') }] });

async function setup(page, { kept = 'history', pinListed = true } = {}) {
  await page.setViewportSize({ width: 1400, height: 900 });
  const errs = await bootApp(page);
  await page.evaluate(({ A, B, kept, pinListed }) => {
    window.__disk = B; window.__outside = false; window.__sent = [];
    const real = window.electronAPI;
    window.electronAPI = new Proxy(real || {}, { get: (t, k) => k === 'saveProject' ? async (x) => {
        window.__sent.push({ id: x.id, over: !!x._overOutside });
        if (x.id !== 'proj_b') return { ok: true };
        if (window.__outside && !x._overOutside) return { ok: false, reason: 'changed_outside', kept, ts: kept === 'history' ? 4242 : null };
        const { _overOutside, ...rest } = x; window.__disk = rest; window.__outside = false; return { ok: true };
      }
      : k === 'saveProjectSync' ? (x) => ({ ok: true })
      : k === 'saveProjectMeta' ? async () => ({ ok: true })
      : k === 'loadProject' ? async (id) => (id === 'proj_b' ? JSON.parse(JSON.stringify(window.__disk)) : A)
      : k === 'historyList' ? async () => ({ ok: true, entries: pinListed ? [{ ts: 4242, reason: 'outside-mine', pinned: true }] : [] })
      : k === 'projectFolderState' ? async () => 'ok'
      : k === 'projectsRootKey' ? async () => 'acct_me' : t[k] });
    window.openTabs = [{ id: 'proj_a', name: 'proj_a이름', _cache: JSON.stringify(A) }, { id: 'proj_b', name: 'proj_b이름' }];
    window.activeProjectId = 'proj_a';
    window.renderTabBar();
  }, { A: doc('proj_a', 'A'), B: doc('proj_b', '처음'), kept, pinListed });
  await page.evaluate(() => window.switchTab('proj_b'));
  await page.waitForFunction(() => !!document.getElementById('s_처음1') && window.gdtProjectReady?.get?.()?.phase !== 'loading');
  return errs;
}
/* 밖에서 바뀜(디스크 = 밖의 판) → 화면에서 편집 → 저장 */
async function outsideThenEdit(page) {
  await page.evaluate((O) => { window.__disk = O; window.__outside = true; }, doc('proj_b', '밖'));
  await page.evaluate(async () => {
    document.querySelector('#canvas .text-block p').textContent = '내편집 머리';
    window.scheduleAutoSave?.();
    await window.saveProjectToFile(window.serializeProject(), { projectId: 'proj_b', skipThumbnail: true });
    await window.waitSavesFor('proj_b', 15000);
  });
  await page.waitForSelector('#outside-change-overlay', { timeout: 10000 });
}
const diskHas = (page, re) => page.evaluate((s) => new RegExp(s).test(JSON.stringify(window.__disk.pages)), re);

test('D1 거절 → 고르기 상자(닫기 없음) · 디스크는 밖의 판 그대로', async ({ page }) => {
  const errs = await setup(page);
  await outsideThenEdit(page);
  const ui = await page.evaluate(() => { const o = document.getElementById('outside-change-overlay'); return { reload: !o.querySelector('.outside-change-reload').hidden, mine: !!o.querySelector('.outside-change-mine'), close: !!o.querySelector('[class*="close"]'), text: o.querySelector('.outside-change-text').textContent }; });
  expect(ui, '★상자 두 단추 · 닫기 없음').toMatchObject({ reload: true, mine: true, close: false });
  expect(ui.text, '내 편집 자리 안내').toContain('밖에서 바뀌기 전 내 편집');
  expect(await diskHas(page, '밖 머리'), '★밖의 판 그대로').toBe(true);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D2 다시 불러오기 → 핀 확인 뒤 · LS 본 걷음 · 화면 = 밖의 판', async ({ page }) => {
  const errs = await setup(page);
  await outsideThenEdit(page);
  await page.evaluate(() => localStorage.setItem('web-editor-autosave__proj_b', JSON.stringify({ pages: [] })));
  await page.click('.outside-change-reload');
  await page.waitForFunction(() => !!document.getElementById('s_밖1'), null, { timeout: 10000 });
  const r = await page.evaluate(() => ({ ov: !!document.getElementById('outside-change-overlay'), ls: localStorage.getItem('web-editor-autosave__proj_b'), mineOnScreen: document.getElementById('canvas').textContent.includes('내편집') }));
  expect(r, '★다시 읽음 · LS 본 걷음 · 상자 닫힘').toEqual({ ov: false, ls: null, mineOnScreen: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D3 핀이 목록에 없음 → 다시 안 읽음 · 까닭', async ({ page }) => {
  const errs = await setup(page, { pinListed: false });
  await outsideThenEdit(page);
  await page.click('.outside-change-reload');
  await expect(page.locator('.outside-change-msg')).toContainText('확인하지 못해');
  const r = await page.evaluate(() => ({ ov: !!document.getElementById('outside-change-overlay'), mine: document.getElementById('canvas').textContent.includes('내편집'), outside: !!document.getElementById('s_밖1') }));
  expect(r, '★화면(내 편집)을 안 버림').toEqual({ ov: true, mine: true, outside: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D4 내 것으로 저장 → _overOutside 저장 · 디스크 = 내 편집', async ({ page }) => {
  const errs = await setup(page);
  await outsideThenEdit(page);
  await page.click('.outside-change-mine');
  await page.waitForFunction(() => !document.getElementById('outside-change-overlay'), null, { timeout: 10000 });
  expect(await page.evaluate(() => window.__sent.filter((s) => s.id === 'proj_b').some((s) => s.over)), '★표시 저장').toBe(true);
  expect(await diskHas(page, '내편집 머리'), '★디스크 = 내 편집').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('D5 내 본을 못 남김 → 다시 불러오기 없음', async ({ page }) => {
  const errs = await setup(page, { kept: false });
  await outsideThenEdit(page);
  expect(await page.evaluate(() => document.querySelector('.outside-change-reload').hidden), '★화면을 버리는 단추가 보인다').toBe(true);
  await expect(page.locator('.outside-change-text')).toContainText('화면에만');
  expect(errs, errs.join(' | ')).toEqual([]);
});
