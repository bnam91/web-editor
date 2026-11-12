/* sec-asset-url-card-noop.dom.spec.js — SEC ③ ㉡ (현빈 GO 261112 «링크=아무것도 안함»)
 *   에셋 패널 URL 카드: «열기» 버튼을 화면에서 없애고(죽은 버튼 숨김), 목록 줄·그리드 카드 어디를 눌러도 새 창·외부 시도 0.
 *   카드 자체(아이콘·이름·이름변경·삭제)는 유지.
 *   ★«보이나»는 hidden 속성이 아니라 hover 뒤 «computed display·크기»로 잰다(클래스 display 가 hidden 을 이긴다).
 *   U1 목록 줄 — 보이는 버튼 = 이름변경·삭제 둘뿐(열기 없음) · 이름 남음
 *   U2 목록 줄 아이콘·이름 클릭/더블클릭 · 그리드 카드 클릭/더블클릭 = 새 창 0 · 외부 시도 0 · 카드 그대로
 *   U3 [양성대조 · 자] 같은 그물이 스크립트 window.open 은 «잡는다»(하네스=Chromium · 앱에선 main/nav-guard 가 deny)
 *   가드 되돌림 양성대조: assets-panel.js 이 커밋을 되돌리면 U1(열기 버튼 보임)·U2(그리드 더블클릭 새 창) 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
test.describe.configure({ timeout: 60000 });
const URL_ = 'https://attacker.example/asset';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const net = { tried: [], popups: [] };
  await page.route('https://attacker.example/**', (r) => { net.tried.push(r.request().url()); return r.abort(); });
  page.context().on('page', (p) => net.popups.push(p.url()));
  await page.evaluate(() => window.switchToTab?.('assets'));
  const ids = await page.evaluate((u) => {
    const folder = window.assetsCreateFolder();
    const inFolder = window.assetsAddUrl({ title: '그리드링크', url: u }, folder);
    const root = window.assetsAddUrl({ title: '목록링크', url: u }, null);
    return { folder, inFolder, root };
  }, URL_);
  await expect.poll(() => page.evaluate((id) => !!document.querySelector(`.assets-row[data-asset-id="${id}"]`), ids.root),
    { message: '[전제] URL 목록 줄이 그려졌다' }).toBe(true);
  /* 새 폴더는 setTimeout 0 뒤 이름 편집에 «자동» 들어간다 — 들어간 걸 보고 끝낸다(클릭이 이름 편집에 먹히지 않게) */
  await page.waitForFunction(() => new Promise(r => setTimeout(() => r(true), 0)));
  await page.evaluate(() => document.activeElement?.blur?.());
  return { errs, net, ids };
}
const settle = (page) => page.waitForFunction(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => r(true)), 300)));

test('U1 목록 줄 URL 카드 — hover 해도 보이는 버튼은 이름변경·삭제뿐(열기 없음 · computed display 로 잼)', async ({ page }) => {
  const { errs, ids } = await setup(page);
  const row = `.assets-row[data-asset-id="${ids.root}"]`;
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), row);
  const r = await waitStableRect(page, row);
  await page.mouse.move(r.cx, r.cy);
  const vis = await page.evaluate((s) => {
    const row = document.querySelector(s);
    const shown = (el) => { for (let n = el; n && n !== row.parentElement; n = n.parentElement) { const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false; } const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
    return { buttons: [...row.querySelectorAll('button')].filter(shown).map(b => b.dataset.act || b.title),
             openish: [...row.querySelectorAll('button, a')].filter(shown).filter(b => /열기|open/i.test((b.title || '') + (b.dataset.act || '') + (b.getAttribute('aria-label') || ''))).length,
             name: row.querySelector('.assets-row-name')?.textContent };
  }, row);
  console.log('  U1:', JSON.stringify(vis));
  expect(vis.buttons, '★전제 — hover 로 액션 줄이 보인다(이게 비면 «안 보임»을 못 잰 것)').toContain('delete');
  expect(vis.openish, '★URL 카드에 «열기» 계열 버튼이 보인다(죽은 버튼)').toBe(0);
  expect(vis.buttons.sort()).toEqual(['delete', 'rename']);
  expect(vis.name).toBe('목록링크');
  expect(errs).toEqual([]);
});

test('U2 목록 줄·그리드 카드를 클릭·더블클릭해도 새 창 0 · 외부 시도 0 · 카드 그대로', async ({ page }) => {
  const { errs, net, ids } = await setup(page);
  const icon = `.assets-row[data-asset-id="${ids.root}"]`;
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), icon);
  const r = await waitStableRect(page, icon);
  await page.mouse.click(r.left + 12, r.cy);                     // 줄 왼쪽(아이콘 자리)
  await page.mouse.dblclick(r.left + 12, r.cy);
  await page.keyboard.press('Escape');
  /* 그리드로 — 폴더 줄의 보기 토글(사람 손) */
  const frow = `.assets-row[data-asset-id="${ids.folder}"]`;
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), frow);
  const fr = await waitStableRect(page, frow);
  await page.mouse.move(fr.cx, fr.cy);
  await page.click(`${frow} button[data-act="view-toggle"]`);
  const card = `.assets-grid-card[data-asset-id="${ids.inFolder}"]`;
  await page.waitForSelector(card);
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), card);
  const c = await waitStableRect(page, card);
  await page.mouse.click(c.cx, c.cy);
  await page.mouse.dblclick(c.cx, c.cy);
  await settle(page);
  const left = await page.evaluate(([a, b]) => ({ row: !!document.querySelector(`.assets-row[data-asset-id="${a}"]`),
    card: !!document.querySelector(`.assets-grid-card[data-asset-id="${b}"]`) }), [ids.root, ids.inFolder]);
  console.log('  U2:', JSON.stringify({ net, left }));
  expect(net.popups, '★URL 카드 클릭이 새 창을 열었다').toEqual([]);
  expect(net.tried, '★URL 카드 클릭이 외부 주소를 시도했다').toEqual([]);
  expect(left, '카드가 사라졌다(다른 기능이 망가짐)').toEqual({ row: true, card: true });
  expect(errs).toEqual([]);
});

test('U3 [양성대조 · 자] 같은 그물이 스크립트 window.open 은 잡는다 — U2 초록이 «못 재서» 초록이 아님', async ({ page }) => {
  const { net } = await setup(page);
  await page.evaluate((u) => { window.open(u, '_blank'); }, URL_ + '/pc');
  await expect.poll(() => net.popups.length + net.tried.length, { message: '★그물이 새 창을 못 잡는다', timeout: 5000 }).toBeGreaterThan(0);
  console.log('  U3:', JSON.stringify(net));
});
