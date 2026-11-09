/* empty-page-delete-undo — 빈 페이지를 확인 없이 지운 뒤 ⌘Z 한 번이면 그 페이지가 돌아온다 (EMPTY-PAGE-DELETE-NO-CONFIRM-NO-UNDO-01)
 * 티켓(L2 앱 ×3): 섹션을 지워 빈 페이지가 된 뒤 그 페이지를 지우면 확인창 없이 지워지고 ⌘Z 로 못 돌아온다. 내용 있는 페이지는 확인창이 뜬다.
 * 코드 읽기(c1588d839): deletePage 는 이력에 칸을 안 남기고, 보던 페이지를 지우면 다음 페이지의 이력을 가져오지 않는다 ⇒ ⌘Z 가
 *   ⓐ 안 보던 페이지 삭제 뒤: 남은 페이지의 앞 편집을 되돌린다(«⌘Z 한 번이 먹는 값») ⓑ 보던 페이지 삭제 뒤: 지운 페이지의 옛 스냅샷을 목록에 없는 페이지 id 로 띄운다(유령).
 * 고침 방향(지디): 확인창 추가가 아니라 «⌘Z 한 번으로 그 페이지가 돌아온다» — 빈 페이지만. 내용 있는 페이지 쪽 되돌리기는 무변(M1 은 재기만).
 * 진짜 키(page.keyboard ⌘Z · ⌘⇧Z). 픽스처: 페이지 셋(섹션·글·그림) · 가운데 페이지를 비운 뒤 지운다 · 그 페이지에 스크래치 한 장.
 * 칸: E1 보던 빈 페이지 지움 → ⌘Z = 같은 자리·같은 이름으로 돌아오고 유령 없음 · 스크래치 그대로 · E2 안 보던 빈 페이지 지움 → ⌘Z = 그 페이지만 돌아오고 남은 페이지 편집은 그대로
 *     E3 ⌘Z 뒤 ⌘⇧Z = 다시 지워진다(확인창 없음) · M1 [재기만] 내용 있는 페이지(확인 뒤) 지움 → ⌘Z 값을 로그로.
 * 양성대조: js/io/save-load.js 만 c1588d839 로 되돌리면 E1·E2·E3 빨강. 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));

/* P0(보던) · P1(비울 것 · 스크래치 S1) · P2 — 섹션마다 글·그림 */
async function setup(page) {
  const errs = await bootApp(page);
  page.on('dialog', (d) => { page.__dialogs = (page.__dialogs || 0) + 1; d.accept(); });
  const ids = await page.evaluate(async (src) => {
    const sec = (p, n) => `<div class="section-block" id="s_${p}_${n}" data-section="${n}" data-name="${p}-S${n}"><div class="section-hitzone"></div><div class="section-inner">`
      + `<div class="text-block" id="tb_${p}_${n}" data-type="text"><div class="tb-h2" contenteditable="false">${p} 섹션 ${n}</div></div>`
      + `<div class="asset-block has-image" id="ab_${p}_${n}" data-img-src="${src}" style="height:120px;"><div class="asset-img-clip"><img class="asset-img" src="${src}" style="width:100%;height:100%"></div></div></div></div>`;
    const p0 = window.state.currentPageId;
    window.state.pages[0].name = '첫 장';
    document.getElementById('canvas').innerHTML = sec('A', 1) + sec('A', 2);
    window.rebindAll?.();
    await window.initScratchPad('proj_epd', p0);
    for (const [id, name, tag] of [['page_ep1', '가운데 장', 'B'], ['page_ep2', '끝 장', 'C']]) window.state.pages.push({ id, name, label: '', pageSettings: { ...window.state.pageSettings }, canvas: sec(tag, 1) + sec(tag, 2) });
    /* 가운데 장으로 가서 스크래치 한 장 → 섹션 둘을 사용자처럼 지운다(이력에 섹션 든 칸이 남는다) */
    await window.switchPage('page_ep1');
    await window._scratchAddAndSave(src, 960, 100, 200, undefined, 'S1');
    window.pushHistory('지우기 전');
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    window.pushHistory('섹션 지움');
    return { p0, p1: 'page_ep1', p2: 'page_ep2' };
  }, PNG);
  await settle(page);
  return { errs, ids };
}
const pages = (page) => page.evaluate(() => ({ list: window.state.pages.map((p) => [p.id, p.name]), cur: window.state.currentPageId, curInList: window.state.pages.some((p) => p.id === window.state.currentPageId), secs: [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id) }));
const key = async (page, k) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); await settle(page); };

test('E1 보던 빈 페이지를 지운 뒤 ⌘Z 한 번 — 같은 자리·같은 이름으로 돌아오고 유령 페이지가 없다 · 스크래치 그대로', async ({ page }) => {
  const { errs, ids } = await setup(page);
  const before = await pages(page);
  await page.evaluate((id) => window.deletePage(id), ids.p1);
  const del = await pages(page);
  expect(del.list.map((x) => x[0]), '[전제] 지워졌다').toEqual([ids.p0, ids.p2]);
  expect(page.__dialogs || 0, '빈 페이지는 확인창 없이(지금 동작 유지)').toBe(0);
  await key(page, 'Meta+z');
  const u = await pages(page);
  console.log('[E1] ' + JSON.stringify({ before, del, u }));
  expect(u.list, '★⌘Z 로 페이지가 안 돌아왔다(이름·순서)').toEqual(before.list);
  expect(u.curInList, `★목록에 없는 페이지(${u.cur})를 보고 있다 — 유령`).toBe(true);
  expect(u.secs.filter((s) => s.startsWith('s_B_')), '★지운 페이지의 옛 섹션이 떴다').toEqual([]);
  await page.evaluate((id) => window.switchPage(id), ids.p1);
  expect(await page.evaluate(() => [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId)), '★돌아온 페이지의 스크래치').toEqual(['S1']);
  expect(errs).toEqual([]);
});

test('E2 안 보던 빈 페이지를 지운 뒤 ⌘Z 한 번 — 그 페이지만 돌아오고 보던 페이지의 앞 편집은 그대로', async ({ page }) => {
  const { errs, ids } = await setup(page);
  await page.evaluate((id) => window.switchPage(id), ids.p0);
  await page.evaluate(() => { window.pushHistory('글 바꾸기 전'); document.querySelector('#tb_A_1 .tb-h2').textContent = 'A 앞 편집'; window.pushHistory('글 바꿈'); });
  const before = await pages(page);
  await page.evaluate((id) => window.deletePage(id), ids.p1);
  expect(page.__dialogs || 0).toBe(0);
  await key(page, 'Meta+z');
  const u = await pages(page);
  expect(u.list, '★⌘Z 로 페이지가 안 돌아왔다').toEqual(before.list);
  expect(await page.evaluate(() => document.querySelector('#tb_A_1 .tb-h2')?.textContent), '★⌘Z 가 보던 페이지의 앞 편집을 먹었다').toBe('A 앞 편집');
  expect(u.cur).toBe(ids.p0);
  expect(errs).toEqual([]);
});

test('E3 ⌘Z 뒤 ⌘⇧Z — 다시 지워진다(확인창 없음)', async ({ page }) => {
  const { errs, ids } = await setup(page);
  await page.evaluate((id) => window.deletePage(id), ids.p1);
  await key(page, 'Meta+z');
  expect((await pages(page)).list.map((x) => x[0]), '[전제] 돌아왔다').toEqual([ids.p0, ids.p1, ids.p2]);
  await key(page, 'Meta+Shift+z');
  const r = await pages(page);
  expect(r.list.map((x) => x[0]), '★⌘⇧Z 가 다시 안 지웠다').toEqual([ids.p0, ids.p2]);
  expect(r.curInList).toBe(true);
  expect(page.__dialogs || 0).toBe(0);
  expect(errs).toEqual([]);
});

test('M1 [재기만] 내용 있는 페이지(확인 뒤) 지움 → ⌘Z 값', async ({ page }) => {
  const { errs, ids } = await setup(page);
  await page.evaluate((id) => window.switchPage(id), ids.p2);
  const before = await pages(page);
  await page.evaluate((id) => window.deletePage(id), ids.p2);
  const del = await pages(page);
  await key(page, 'Meta+z');
  const u = await pages(page);
  console.log('[M1] ' + JSON.stringify({ dialogs: page.__dialogs || 0, before, del, u }));
  expect(page.__dialogs || 0, '[전제] 확인창이 떴다').toBe(1);
  expect(errs).toEqual([]);
});
