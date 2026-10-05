/* f3-open-fit.dom.spec.js — E129 F3: 저장본을 «열면» 자유 프레임 안 «키 없는 전폭» 그리드가 수직만 움직이던 것 (지디 ⒜ 2026-10-05)
 *
 * 머리표(지디 규율 — «옛 판에서도 초록이면 무엇을 재나»):
 *   [새 것]    9ef09f76 에서 빨강이어야 한다 — 고친 것을 잰다.
 *   [회귀 지킴] 9ef09f76 에서도 초록 — 고치며 깨뜨리지 않았나를 잰다.
 *   [전제]     재기 위한 조건이 섰나(저장본에 키 없음 · 자유 프레임 · 배율 100 · 끌기가 먹었다).
 * 길 = «열기» 정본 window.applyProjectData(저장본 객체) — 실앱 «카드 열기»가 부르는 그 함수(asset-open-heal-beyond-edge 선례).
 * 원인(실측 F3-E129/README · probe-611): 키 없음 → renderGridBlock '100%' → 폭 716 = 프레임 716 → 클램프 left 상한 0.
 *   고침 = 열기 길이 applyPageSettings «뒤»에 fitKeylessFreeFrameGridsOnOpen — 프레임 보이는 폭 × 0.8(입구 규칙 그대로).
 *   ★값 = 573(716×0.8) — rebindAll 안에서 맞추면 패딩 전 폭 764 로 611 이 된다(실측). 그래서 «열린 뒤 프레임 폭 × 0.8» 과 견준다.
 * 하네스 = bootApp(앱 통째) · 진짜 마우스(clickAt — 누르기 직전 맞힌 요소 단언). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;왼칸&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;오른칸&quot;}]}]';
const grid = (id, extra = '', style = 'position:absolute;left:0px;top:43px;width:764px') =>
  `<div class="grid-block" id="${id}" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"${extra} style="${style}"></div>`;
/* 현빈 저장본 꼴(UserLens F3 · 크몽 proj_1790917712926 와 같은 꼴): 자유 프레임(style 764) 안 absolute 그리드 · data-grid-width 없음 */
const FRAME = (fid, inner) => `<div class="frame-block" id="${fid}" data-free-layout="true" style="position:relative;width:764px;height:420px;margin:0 auto;background:#f4f4f8">${inner}</div>`;
const SEC = (sid, inner) => `<div class="section-block" id="${sid}" data-section="1" data-name="${sid}"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:30px"></div>${inner}<div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`;

/** 저장본 객체를 만들어 «열기» 정본으로 연다. pages = [canvas html, …] */
async function openSaved(page, pages) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  const data = await page.evaluate((pages) => {
    const d = JSON.parse(window.serializeProject());
    const p0 = d.pages[0];
    d.pages = pages.map((html, i) => ({ ...p0, id: 'page_' + (i + 1), name: 'P' + (i + 1), canvas: html, pageSettings: { ...(p0.pageSettings || {}), padX: 72 } }));
    d.currentPageId = 'page_1';
    return d;
  }, pages);
  /* [전제] 저장본에 키가 «없다»(파일 꼴 그대로) */
  for (const html of pages) expect(html.includes('data-grid-width="'), '[전제] 저장본 그리드에 data-grid-width 가 없다').toBe(html.includes('data-keyed'));
  await page.evaluate((d) => window.applyProjectData(d), data);
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.deselectAll?.(); window.applyZoom?.(100); });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.currentZoom), '[전제] 배율 100').toBe(100);
  return errs;
}
const geo = (page, gid) => page.evaluate((gid) => {
  const g = document.getElementById(gid); const fr = g.closest('.frame-block[data-free-layout="true"]');
  let u = g; while (fr && u && u.parentElement !== fr) u = u.parentElement;
  return { key: g.dataset.gridWidth ?? null, auto: g.dataset.gridWidthAuto ?? null, styleW: g.style.width, w: g.offsetWidth,
           fw: fr ? fr.offsetWidth : null, fcw: fr ? fr.clientWidth : null, left: u ? parseFloat(u.style.left) : null, top: u ? parseFloat(u.style.top) : null, float: g.dataset.overlayBlock === 'true' };
}, gid);
/** 진짜 끌기: 1차 클릭 = 프레임 · 2차 클릭 = 그리드(파고들기) · (+dx,+dy) */
async function realDrag(page, fid, gid, dx, dy) {
  await page.evaluate((fid) => document.getElementById(fid).scrollIntoView({ block: 'center' }), fid);
  await page.waitForTimeout(150);
  const p = await page.evaluate((gid) => { const r = document.getElementById(gid).getBoundingClientRect(); return [r.left + Math.min(40, r.width / 4), r.top + r.height / 2]; }, gid);
  await clickAt(page, p[0], p[1], { sel: '.frame-block' }, { label: '프레임 고르기' }); await page.waitForTimeout(250);
  await clickAt(page, p[0], p[1], { sel: `.grid-block` }, { label: '그리드 고르기(파고들기)' }); await page.waitForTimeout(250);
  await expect.poll(() => page.evaluate((gid) => document.getElementById(gid).classList.contains('selected'), gid), { message: '[전제] 그리드가 골라졌다' }).toBe(true);
  await page.mouse.move(p[0], p[1]); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(p[0] + dx * i / 12, p[1] + dy * i / 12);
  await page.mouse.up(); await page.waitForTimeout(250);
}

test('O1 [새 것] 저장본을 열면 키 없는 전폭 그리드가 «열린 뒤 프레임 폭 × 0.8» 로 맞춰진다(573 — 611 아님)', async ({ page }) => {
  const errs = await openSaved(page, [SEC('s1', FRAME('fr1', grid('g1')))]);
  const g = await geo(page, 'g1');
  expect(g.fcw, `[전제] 열린 뒤 프레임 보이는 폭 = 716(style 764 · 섹션 내용 716) ${JSON.stringify(g)}`).toBe(716);
  expect(g.float, '[전제] 안 떠 있다').toBe(false);
  expect(g.key, `★키 = 프레임 보이는 폭 × 0.8 = ${Math.round(g.fcw * 0.8)} ${JSON.stringify(g)}`).toBe(String(Math.round(g.fcw * 0.8)));
  expect(g.auto, '자동 표시(입구 규칙과 같은 출처)').toBe('1');
  expect(g.w, `그려진 폭 < 프레임 폭 ${JSON.stringify(g)}`).toBeLessThan(g.fw);
  expect(errs).toEqual([]);
});

test('O2 [새 것] 연 뒤 진짜 끌기 (+100,+50) → 좌우도 움직인다(Δx 100 · Δy 50)', async ({ page }) => {
  const errs = await openSaved(page, [SEC('s1', FRAME('fr1', grid('g1')))]);
  const g0 = await geo(page, 'g1');
  await realDrag(page, 'fr1', 'g1', 100, 50);
  const g1 = await geo(page, 'g1');
  expect(g1.top - g0.top, `[전제] 끌기가 먹었다(세로 50) ${JSON.stringify([g0, g1])}`).toBe(50);
  expect(g1.left - g0.left, `★Δx(수직만이면 0) · 폭 ${g0.w} / 프레임 ${g0.fw} ${JSON.stringify([g0, g1])}`).toBe(100);
  expect(errs).toEqual([]);
});

test('O3 [새 것] 연 뒤 끌기 → ⌘Z 한 번 = 끌기 전 자리 · ⌘⇧Z = 다시 그 자리(맞춘 폭은 그대로)', async ({ page }) => {
  const errs = await openSaved(page, [SEC('s1', FRAME('fr1', grid('g1')))]);
  const g0 = await geo(page, 'g1');
  await realDrag(page, 'fr1', 'g1', 100, 50);
  const g1 = await geo(page, 'g1');
  expect(g1.left - g0.left, '[전제] 좌우로 움직였다').toBe(100);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  const u = await geo(page, 'g1');
  expect([u.left, u.top, u.key], `⌘Z 한 번 = 끌기 전 ${JSON.stringify([g0, u])}`).toEqual([g0.left, g0.top, g0.key]);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(300);
  const r = await geo(page, 'g1');
  expect([r.left, r.top, r.key], `⌘⇧Z = 끌기 뒤 ${JSON.stringify([g1, r])}`).toEqual([g1.left, g1.top, g1.key]);
  expect(errs).toEqual([]);
});

test('O4 [새 것] 페이지 전환도 «열기» — 둘째 쪽의 키 없는 전폭 그리드도 맞춰진다', async ({ page }) => {
  const errs = await openSaved(page, [SEC('s1', '<div class="gap-block" data-type="gap" style="height:20px"></div>'), SEC('s2', FRAME('fr2', grid('g2')))]);
  await page.evaluate(() => window.switchPage('page_2'));
  await page.waitForTimeout(500);
  const g = await geo(page, 'g2');
  expect(g.fcw, `[전제] 둘째 쪽 프레임 716 ${JSON.stringify(g)}`).toBe(716);
  expect(g.key, `★키 = ${Math.round(g.fcw * 0.8)} ${JSON.stringify(g)}`).toBe(String(Math.round(g.fcw * 0.8)));
  expect(errs).toEqual([]);
});

test('G1 [회귀 지킴] 폭을 정한 그리드(400)·떠 있는 그리드·흐름(프레임 밖) 그리드는 열어도 그대로', async ({ page }) => {
  const keyed = grid('gK', ' data-keyed="1" data-grid-width="400"', 'position:absolute;left:0px;top:200px;width:400px');
  const flow = `<div class="row" id="rF" data-layout="stack">${grid('gF', '', '')}</div>`;
  const errs = await openSaved(page, [SEC('s1', FRAME('fr1', keyed) + flow)]);
  const k = await geo(page, 'gK'); const f = await geo(page, 'gF');
  expect([k.key, k.auto, k.w], `폭 400 그리드 무접촉 ${JSON.stringify(k)}`).toEqual(['400', null, 400]);
  expect([f.key, f.auto, f.styleW], `흐름 그리드는 키 없음·100% 그대로 ${JSON.stringify(f)}`).toEqual([null, null, '100%']);
  /* 폭 정한 그리드 끌기 — 종전처럼 Δx 100(고침이 이 길을 안 바꿨다) */
  const k0 = k; await realDrag(page, 'fr1', 'gK', 100, 50); const k1 = await geo(page, 'gK');
  expect([k1.left - k0.left, k1.top - k0.top], `폭 400 끌기 ${JSON.stringify([k0, k1])}`).toEqual([100, 50]);
  expect(errs).toEqual([]);
});

test('G2 [회귀 지킴] 떠 있는(오버레이) 키 없는 그리드는 열어도 맞추지 않는다', async ({ page }) => {
  const floating = `<div class="grid-block" id="gO" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}" data-overlay-block="true" data-offset-x="40" data-offset-y="40" data-overlay-frozen-width="500px" style="position:absolute;left:40px;top:40px;width:500px"></div>`;
  const errs = await openSaved(page, [`<div class="section-block" id="s1" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:300px"></div></div>${floating}</div>`]);
  const g = await page.evaluate(() => { const g = document.getElementById('gO'); return { key: g.dataset.gridWidth ?? null, auto: g.dataset.gridWidthAuto ?? null, float: g.dataset.overlayBlock }; });
  expect(g, '떠 있는 그리드 무접촉').toEqual({ key: null, auto: null, float: 'true' });
  expect(errs).toEqual([]);
});
