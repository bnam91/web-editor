/* scratch-group-mode.dom.spec.js — ★⑦ 그룹 진입 모드 (현빈 2026-10-10)
 *
 * 현빈 원문: 「★표준 동작(★더블클릭 → ★그룹 진입 → ★멤버 단독 선택)을 넣고, ★그 상태에서
 *   ⌘Shift+G 가 ★아니라 ★★백스페이스·딜릿키 누르거나 ★삭제버튼 누르면 ★★그 한 장만 ★빼게」
 *
 * ★★«고치기 전» 실측(이 레인 · 2026-10-10 · 판 `be4ebbc1`) — ⚰️그대로 적어 둔다:
 *     멤버를 ★그냥 클릭 → 선택 ★3   (그룹 공동 선택)
 *     ★⇧클릭            → 선택 ★1   ⇐ ★«한 장 고르는 길»은 ★이미 있었다
 *     ★더블클릭          → 선택 0 → ★3 (★모드 흔적 ★없다 · 두 mousedown 이 각각 클릭 길을 탄다)
 *     ★Delete/Backspace → 장 수 ★3 → ★★0 (★그룹 ★전원 삭제)
 *     ★⌘⇧G             → 그룹 ★[g,g,g] → ★[null,null,null] (★통째로 풀림)
 *   ⇒ ★★«없던 것»은 ★«빼는 길» ★하나다. ★이 파일이 그것을 잰다.
 *
 * ★꼴은 `_sliceMode` 를 본떴다 — ⛔두 모드를 ★따로 고치지 마라(같은 관용구다).
 * ★G1 은 ★«모드 밖 무변»의 증인이다 — ★고치기 전에도 ★초록이라야 한다.
 * ★양성대조·변이 명부는 파일 끝 주석.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const IDS = ['sp_a', 'sp_b', 'sp_c'];

async function clickItem(page, id, { shift = false, dbl = false } = {}) {
  await page.evaluate((s) => document.querySelector('.scratch-item[data-scratch-id="' + s + '"]')
    .scrollIntoView({ block: 'center', inline: 'center' }), id);
  const el = page.locator('.scratch-item[data-scratch-id="' + id + '"]');
  if (dbl) await el.dblclick({ modifiers: shift ? ['Shift'] : [] });
  else await el.click({ modifiers: shift ? ['Shift'] : [] });
  await page.waitForTimeout(140);
}
/* ★«사람이 하는 순서»로 장면을 세운다 — 셋을 골라 ★진짜 묶는 길로 묶는다.
   ⛔`_scratchAddAndSave(...,g,...)` 로 바로 만들지 않는다(그 꼴이 앱에서 생기나부터). */
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(async ({ px, ids }) => {
    window.applyZoom?.(100);
    let x = 1150;
    for (const id of ids) { await window._scratchAddAndSave(px, x, 120, 140, undefined, id); x += 170; }
  }, { px: PX, ids: IDS });
  await page.waitForFunction((n) => document.querySelectorAll('.scratch-item').length === n, IDS.length, { timeout: 15000 });
  for (let i = 0; i < IDS.length; i++) await clickItem(page, IDS[i], { shift: i > 0 });
  const r = await page.evaluate(() => ({ grouped: window._scratchGroupAndAlign?.(), zoom: window.currentZoom }));
  await page.mouse.click(300, 900); await page.waitForTimeout(150);   // 선택 비우기
  return r;
}
const st = (page) => page.evaluate(() => ({
  pads: document.querySelectorAll('.scratch-item').length,
  sel: document.querySelectorAll('.scratch-item.scratch-selected').length,
  groups: [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchGroup ?? null),
  marked: document.querySelectorAll('.scratch-item.scratch-group-mode').length,
  mode: window._scratchGroupMode?.() ?? null,
  marquee: document.querySelectorAll('.scratch-marquee').length,
  closeGlyphs: [...document.querySelectorAll('.scratch-item .scratch-close')].map((b) => b.textContent),
}));

test('G0 전제 — 3장이 ★진짜 길로 ★한 그룹 · zoom 100 · 모드 입구가 있다', async ({ page }) => {
  const r = await scene(page);
  expect(r.zoom, 'zoom 100').toBe(100);
  const s = await st(page);
  expect(s.pads, '3장').toBe(3);
  expect(new Set(s.groups).size, '그룹 id 가 하나').toBe(1);
  expect([...new Set(s.groups)][0], '그룹 id 가 있다').toBeTruthy();
  expect(await page.evaluate(() => typeof window._scratchGroupMode), '모드 읽는 입구').toBe('function');
  expect(s.mode, '아직 진입 전').toBeNull();
});

test('G1 ⚰️★모드 «밖»은 ★한 글자도 안 바뀐다 — 고치기 전 수 그대로(회귀 0 증인)', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c');
  let s = await st(page);
  expect(s.sel, '★그냥 클릭 → 선택 3 (⚰️고치기 전 값)').toBe(3);
  expect(s.mode, '★클릭만으로는 모드가 안 선다').toBeNull();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete'); await page.waitForTimeout(280);
  s = await st(page);
  expect(s.pads, '★Delete → 3장이 0장 (⚰️고치기 전 값 · 전원 삭제)').toBe(0);
});

test('G1b ⚰️★⇧클릭은 ★이미 한 장을 고른다 — ★고치기 전부터 참(지디가 현빈께 정정할 칸)', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c', { shift: true });
  const s = await st(page);
  expect(s.sel, '★⇧클릭 → 선택 1').toBe(1);
  expect(s.mode, '★⇧클릭은 모드가 아니다').toBeNull();
});

test('G2 ★★더블클릭 → 그룹 진입 ＋ 그 멤버 ★단독 선택 ＋ 화면에 ★표시', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c', { dbl: true });
  const s = await st(page);
  console.log('[G2] ' + JSON.stringify(s));
  expect(s.mode, '★모드가 그 그룹으로 섰다').toBe(s.groups[0]);
  expect(s.sel, '★★단독 선택 강제 — 1장').toBe(1);
  expect(s.marked, '★그룹 3장에 표시가 붙었다').toBe(3);
  expect(s.pads, '★아무것도 안 지워졌다').toBe(3);
});

test('G3 ★★본 단언 — 진입 중 ★Delete 는 ★그 한 장만 ★뺀다(⛔지우지 않는다)', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c', { dbl: true });
  const b = await st(page);
  expect(b.mode, '전제 — 진입했다').toBeTruthy();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  const a = await st(page);
  console.log('[G3] 전 ' + JSON.stringify(b.groups) + ' → 후 ' + JSON.stringify(a.groups) + ' pads ' + b.pads + '→' + a.pads);
  expect(a.pads, '★★장 수는 ★그대로 3 (⚰️고치기 전엔 0 이 됐다)').toBe(3);
  expect(a.groups.filter((g) => g).length, '★그룹에 남은 장 = 2').toBe(2);
  expect(a.groups[2], '★뺀 장(sp_c)은 그룹이 없다').toBeNull();
});

test('G4 ★진입 중 ★✕ 도 ★빼기 — 현빈 「삭제버튼 누르면 그 한 장만 빼게」', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c', { dbl: true });
  await page.locator('.scratch-item[data-scratch-id="sp_c"] .scratch-close').click();
  await page.waitForTimeout(300);
  const a = await st(page);
  console.log('[G4] ' + JSON.stringify(a.groups) + ' pads=' + a.pads);
  expect(a.pads, '★안 지워졌다').toBe(3);
  expect(a.groups.filter((g) => g).length, '★그룹 2장').toBe(2);
});

test('G5 ★진입 중 ✕ 는 ★모양이 바뀐다(⊘) — ★같은 손잡이가 다른 일을 하므로', async ({ page }) => {
  await scene(page);
  let s = await st(page);
  expect(s.closeGlyphs.every((g) => g === '✕'), '전 — 전부 ✕').toBe(true);
  await clickItem(page, 'sp_c', { dbl: true });
  s = await st(page);
  console.log('[G5] ' + JSON.stringify(s.closeGlyphs));
  expect(s.closeGlyphs.filter((g) => g === '⊘').length, '★그룹 3장이 ⊘').toBe(3);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  s = await st(page);
  expect(s.closeGlyphs.every((g) => g === '✕'), '★나가면 ✕ 로 돌아온다').toBe(true);
});

test('G6 ★나가기 — ★Esc · ★그룹 밖 클릭', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c', { dbl: true });
  expect((await st(page)).mode, '전제 — 진입').toBeTruthy();
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  expect((await st(page)).mode, '★Esc 로 나간다').toBeNull();
  await clickItem(page, 'sp_c', { dbl: true });
  expect((await st(page)).mode, '전제 — 다시 진입').toBeTruthy();
  await page.mouse.click(300, 900); await page.waitForTimeout(250);
  expect((await st(page)).mode, '★그룹 밖을 누르면 나간다').toBeNull();
});

test('G7 ★★진입 배타 — 두 모드가 ★동시에 못 선다(✂ 를 누르면 그룹 모드가 풀린다)', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c', { dbl: true });
  expect((await st(page)).mode, '전제 — 그룹 모드').toBeTruthy();
  const btn = page.locator('.scratch-item[data-scratch-id="sp_c"] .scratch-slice-btn');
  expect(await btn.count(), '전제 — ✂ 손잡이가 있다').toBe(1);
  await btn.click({ force: true }); await page.waitForTimeout(250);
  const s = await page.evaluate(() => ({ group: window._scratchGroupMode?.() ?? null,
    slice: document.querySelectorAll('.scratch-item.scratch-slice-mode').length }));
  console.log('[G7] ' + JSON.stringify(s));
  expect(s.slice, '★슬라이스 모드가 섰다').toBe(1);
  expect(s.group, '★★그룹 모드는 ★풀렸다(동시에 못 선다)').toBeNull();
});

test('G7b ★★진입 배타 ★★«반대 방향» — ✂ 가 선 채로 그룹에 들어가면 ✂ 가 ★풀린다', async ({ page }) => {
  /* ★★왜 이 칸이 ★따로 있나 — ★G7 은 ★한 방향(그룹→✂)만 잰다.
     ★제품에는 ★두 자리가 ★따로 있다: `_enterSliceMode` 머리가 group 을 내리고,
     `_enterGroupMode` 머리가 slice 를 내린다. ⇒ ★한 방향만 재면 ★반대쪽 줄을
     ★지워도 ★초록이다(= ★그 줄을 ★재는 자가 ★없다). ★게이트가 ★양쪽으로 ★무너지는 자리. */
  await scene(page);
  const btn = page.locator('.scratch-item[data-scratch-id="sp_c"] .scratch-slice-btn');
  expect(await btn.count(), '전제 — ✂ 손잡이가 있다').toBe(1);
  await btn.click({ force: true }); await page.waitForTimeout(250);
  const p0 = await page.evaluate(() => ({ group: window._scratchGroupMode?.() ?? null,
    slice: document.querySelectorAll('.scratch-item.scratch-slice-mode').length,
    pads: document.querySelectorAll('.scratch-item').length }));
  console.log('[G7b 전제] ' + JSON.stringify(p0));
  expect(p0.slice, '★전제 — ✂ 모드가 ★먼저 섰다').toBe(1);
  expect(p0.group, '★전제 — 그룹 모드는 ★아직 아니다').toBeNull();
  await clickItem(page, 'sp_a', { dbl: true }); await page.waitForTimeout(250);
  const s1 = await page.evaluate(() => ({ group: window._scratchGroupMode?.() ?? null,
    slice: document.querySelectorAll('.scratch-item.scratch-slice-mode').length,
    pads: document.querySelectorAll('.scratch-item').length }));
  /* ★★전제 — ★장 수가 ★안 변했다. ★✂ 모드는 ★«클릭하면 ★자른다»라서 ★이 더블클릭이
     ★슬라이스를 ★확정해 ★장을 ★늘릴 수 있다 ⇒ ★그러면 ★아래 단언은 ★★딴 장면을 재고도 ★초록이다. */
  expect(s1.pads, `★★전제 — ★장 수 무변(전 ${p0.pads} → 후 ${s1.pads}) · ⛔늘었다면 ✂ 가 ★잘린 것이다`).toBe(p0.pads);
  console.log('[G7b 뒤] ' + JSON.stringify(s1));
  expect(s1.group, '★그룹 모드가 섰다').toBeTruthy();
  expect(s1.slice, '★★✂ 모드가 ★풀렸다(동시에 못 선다 — ★반대 방향)').toBe(0);
});

test('G8 ★모드에서 ★그룹 밖을 ★끌면 — ★모드가 ★풀리고 ★마퀴가 ★뜬다(★제품이 ★참으로 하는 일)', async ({ page }) => {
  /* ★★⚰️2026-10-10 — 이 칸은 ★처음 「★진입 중엔 ★마퀴가 ★안 뜬다」였다. ★★그 단언은 ★★거짓이다.
     ★실측(양성대조 포함): ★모드 ★밖 끌기 = 마퀴 ★1 · ★모드 ★진입 중 끌기 = ★★1 ⇒ ★★억제가 ★안 된다.
     ★변이 `M-MARQUEE`(게이트를 true 로) → ★★순 빨강 ★0건 ⇒ ★그 게이트는 ★★닿지 않는 코드였다.
     ★★까닭 = `_enterGroupMode` 가 `onOutsideMousedown` 을 ★★capture 로 단다 ⇒ 빈 영역 mousedown 이
       ★★먼저 ★모드를 ★내린다 ⇒ 마퀴 게이트가 읽을 때 `_groupMode` 는 ★이미 null.
     ⇒ ★제품에서 ★그 게이트를 ★지웠고, ★이 칸을 ★★«제품이 ★참으로 하는 일»로 ★다시 썼다.
     ★★선택이 ★그룹 밖으로 ★샐 수 ★없는 ★참 까닭 = ★★«모드가 ★이미 끝났기 때문»이다 — ★그걸 ★잰다.
     ⛔「마퀴가 안 뜬다」로 ★되돌리지 마라 — ★그건 ★3일 안에 ★또 ★거짓 단언이 된다. */
  await scene(page);
  await clickItem(page, 'sp_c', { dbl: true });
  expect((await st(page)).mode, '★전제 — 진입했다').toBeTruthy();

  await page.mouse.move(300, 880); await page.mouse.down();
  await page.mouse.move(600, 940, { steps: 6 });
  const mid = await page.evaluate(() => ({
    marquee: document.querySelectorAll('.scratch-marquee').length,
    mode: window._scratchGroupMode?.() ?? null,
    marked: document.querySelectorAll('.scratch-item.scratch-group-mode').length,
  }));
  await page.mouse.up(); await page.waitForTimeout(150);
  console.log('[G8] 끄는 중 = ' + JSON.stringify(mid));
  /* ⒜ ★모드가 ★풀렸다 — ★이것이 ★안전의 ★참 근거다(capture 가 ★선택보다 먼저 돈다) */
  expect(mid.mode, '★★모드가 ★풀렸다 — ★빈 영역 mousedown 이 capture 로 ★먼저 내린다').toBeNull();
  expect(mid.marked, '★점선 표시도 ★같이 거뒀다').toBe(0);
  /* ⒝ ★그리고 ★마퀴는 ★제 일을 한다 — ⛔모드가 ★마퀴를 ★죽이지 ★않는다 */
  expect(mid.marquee, '★마퀴가 ★뜬다(모드는 이미 끝났다)').toBeGreaterThan(0);
});

test('G9 ★1장만 남으면 그룹이 ★자동으로 풀린다 (★지디 기본값 · 현빈 미정)', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c', { dbl: true });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  let s = await st(page);
  expect(s.groups.filter((g) => g).length, '★한 장 뺀 뒤 2장').toBe(2);
  await clickItem(page, 'sp_b', { dbl: true });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  s = await st(page);
  console.log('[G9] ' + JSON.stringify(s.groups) + ' mode=' + s.mode);
  expect(s.groups.filter((g) => g).length, '★★1장 남자 ★그룹이 통째로 풀렸다').toBe(0);
  expect(s.pads, '★장은 셋 다 살아 있다').toBe(3);
  expect(s.mode, '★모드도 같이 나갔다').toBeNull();
});

test('G10 ★⌘Z ★한 걸음 — 뺀 것이 되돌아온다', async ({ page }) => {
  await scene(page);
  await clickItem(page, 'sp_c', { dbl: true });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  expect((await st(page)).groups.filter((g) => g).length, '전제 — 2장').toBe(2);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(400);
  const s = await st(page);
  console.log('[G10] ' + JSON.stringify(s.groups));
  expect(s.groups.filter((g) => g).length, '★★⌘Z 한 번에 3장이 다시 그룹').toBe(3);
});

/* ══ 양성대조·변이 명부 — ★실측은 ★창에서 채운다 ═══════════════════════════════════ */
