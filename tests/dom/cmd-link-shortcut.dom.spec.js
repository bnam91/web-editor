/* cmd-link-shortcut.dom.spec.js — ★② ⌘L = «섹션링크» 단축키. ★⌘＋🔗 버튼과 ★«같은 일»을 한다
 *
 * 현빈 2026-10-09 (1009t2-② · 지디 발주) — 원문:
 *   ② 「스크래치패드 선택 후 커맨드+링크버튼=링크연결 섹션 나타나는데 → ★커맨드L 단축키로도 되게」
 *
 * ★★★이 파일이 ★재는 것 = ★«입구가 하나 늘었다» ★하나다. ⛔«수»는 ★안 바꾼다.
 *   ⇒ 섹션은 ★«하나»다(그룹이든 여러 장을 따로 골랐든) — ★2026-10-07 승인 ④⑤ ★그대로.
 *   ★재는 자리 = cmd-link-new-section.dom.spec.js 의 L3·L4·L5 와 ★같은 수. ⇒ K2·K5 가 그 둘을 ★나란히 놓는다.
 *
 * ★★★⚠️보류 중인 요구가 ★하나 있다 — ★이 파일의 ★K4 가 ★그 자리다:
 *   현빈 2026-10-09 ③ 「★각 스크래치패드(★그룹설정된 스크래치그룹도 ★하나로 침)와 연결된 섹션 ★일괄 생성」
 *   ⇒ ★따로 고른 3장이면 섹션 ★3개가 된다 = ★2026-10-07 승인 ⑤(「섹션 하나」)를 ★뒤집는다.
 *   ⇒ ★★«현빈 결정 둘이 부딪친다» ⇒ ★지디가 현빈께 ★올렸고 ★답을 ★기다린다(2026-10-09).
 *   ★그래서 ③ 은 ★이 묶음에 ★없다. ★K4 는 ★★«오늘의 계약»(섹션 1개)을 ★물고 있다.
 *   ⇒ ★★답이 「③ 으로 간다」면 ★K4 와 L5 를 ★⚰️로 ★같이 갱신해라(⛔지우지 말고 ★이어 적어라).
 *     그때 쓸 ★검사·제품은 ★이미 서 있다 — 지디에게 ★보류분을 물어라(⌘L 쪽 N개 단언 ＋ 단위 쪼개기).
 *
 * ★무엇으로 재나 — 앱 통째로 헤드리스(bootApp). ⛔addSection 스텁 금지(cmd-link-new-section 머리말의 그 까닭:
 *   js/insert-history.js 의 «끝 표본» 래퍼를 안 지나면 ⌘Z 축이 ★조용히 초록이 된다).
 *
 * ★양성대조·변이 명부는 파일 끝 주석에 있다(무엇을 무력화하면 어느 검사가 빨강인가 — ★실측 수).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmd-link-shortcut
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* 스크래치 아홉 — 단독 1 · 그룹(g_five) ★5 · 따로 고를 것 3.
   ★자리는 캔버스 «오른쪽»으로 몰아 둔다 — 섹션을 가리면 클릭이 빨강으로 말해 준다. */
const ITEMS = [
  ['sp_solo', 1500,  80, undefined],
  ['sp_f1',   1500, 300, 'g_five'],
  ['sp_f2',   1650, 300, 'g_five'],
  ['sp_f3',   1800, 300, 'g_five'],
  ['sp_f4',   1500, 460, 'g_five'],
  ['sp_f5',   1650, 460, 'g_five'],
  ['sp_m1',   1500, 640, undefined],
  ['sp_m2',   1700, 640, undefined],
  ['sp_m3',   1900, 640, undefined],
];
const GROUP_ID = 'g_five';                                            // ★이름 하나 — ⛔문자열을 두 곳에 적지 않는다
const GROUP_N  = ITEMS.filter(([, , , g]) => g === GROUP_ID).length;   // ★5 — ⛔손으로 안 박는다

/* ★장면을 «앱 자신의 입구»로 세운다 — 손으로 쓴 섹션 HTML 은 ⌘Z 복원이 좌우여백을 «채워» 넣어
   「복원 뒤 ≠ 조작 전」이 된다(cmd-link-new-section 의 그 실측). */
async function buildScene(page) {
  return page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection({ skipDefaultBlock: true });
    window.addSection({ skipDefaultBlock: true });
    window.deselectAll?.();
    return [...c.querySelectorAll('.section-block:not([data-ghost])')].map(s => s.id);
  });
}

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  const ids = await buildScene(page);
  await page.evaluate(async ({ px, items }) => {
    for (const [id, x, y, g] of items) await window._scratchAddAndSave(px, x, y, 140, g, id);
  }, { px: PX, items: ITEMS });
  // 🔗 손잡이가 «실제로 주입될 때까지» — ★산출물로 기다린다(⛔고정 대기 금지)
  await page.waitForFunction(
    (n) => document.querySelectorAll('.scratch-item .spl-btn-link').length === n,
    ITEMS.length, { timeout: 15000 });
  return ids;
}

const secIds  = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
/* 섹션별 «연결된 스크래치 id 묶음» — 토큰의 «:0» 꼬리를 떼고 정렬해 돌려준다. */
const refRows = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block')]
  .map(s => ({ id: s.id, ids: (s.dataset.refLinks || '').split(',').filter(Boolean).map(t => t.split(':')[0]).sort() }))
  .filter(r => r.ids.length));
const linking = (page) => page.evaluate(() => ({
  body: document.body.classList.contains('spl-linking'),
  banner: (() => { const b = document.getElementById('spl-banner'); return !!b && b.style.display !== 'none'; })(),
}));

/* 스크래치 항목을 «진짜 마우스»로 누른다(선택). shift 로 더한다.
   ⛔고정 좌표 금지 — 배율이 100% 가 아니면 그 점이 상자 «밖»이 되어 playwright 가 던진다(실측). */
async function clickItem(page, sid, { shift = false } = {}) {
  await page.evaluate((s) => document.querySelector('.scratch-item[data-scratch-id="' + s + '"]')
    .scrollIntoView({ block: 'center', inline: 'center' }), sid);
  await page.locator('.scratch-item[data-scratch-id="' + sid + '"]').click({ modifiers: shift ? ['Shift'] : [] });
  await page.waitForTimeout(120);
}
/* ★`expected` = «고르고 나면 ★몇 장이 선택돼 있어야 하나». ⛔`sids.length` 를 ★기본으로만 믿지 마라 —
   ★★그룹 멤버를 ★하나 누르면 ★★그룹 ★전원이 선택된다(★정의 자리: js/scratch-pad.js:808
   `if (s !== item && s.g === item.g && !_selectedItems.has(s))` — ★`s.g` 로 번진다).
   ★실측(2026-10-09): `sp_f3` ★한 장을 눌렀더니 선택이 ★★5 장이었다 ⇒ ★처음 쓴 `toBe(1)` 이 ★빨개졌고
     ★그것은 ★★«내 전제»의 흠이지 ★제품의 흠이 ★아니었다(그 판에서 ★L4 는 ★초록이었다).
   ⛔«쓰는 자리» grep(`scratchGroup`)으로 ★이것을 ★못 본다 — 그 경로는 ★`it.g` 를 쓴다. */
async function selectMany(page, sids, expected = sids.length) {
  for (let i = 0; i < sids.length; i++) await clickItem(page, sids[i], { shift: i > 0 });
  const got = await page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length);
  expect(got, `전제 — ${expected}장이 ★골라졌다(누른 수 ${sids.length} · 잰 값 ${got})`).toBe(expected);
}
/* ⌘L — ★이 파일이 재는 그 제스처. 입력란 밖에서 누른다. */
async function pressCmdL(page) {
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+l');
  await page.waitForTimeout(350);
}
async function clickLinkBtn(page, sid, { meta = false } = {}) {
  await page.evaluate((s) => document.querySelector('.scratch-item[data-scratch-id="' + s + '"]')
    .scrollIntoView({ block: 'center', inline: 'center' }), sid);
  const btn = page.locator('.scratch-item[data-scratch-id="' + sid + '"] .spl-btn-link');
  await expect(btn, `전제 — ${sid} 에 🔗 손잡이가 있다`).toHaveCount(1);
  await btn.click(meta ? { modifiers: ['Meta'] } : {});
  await page.waitForTimeout(350);
}
/* 한 제스처의 «결과»를 ★같은 자로 떠낸다 — K2·K5 의 ★대조에 쓴다.
   ★섹션 ★증가 수 ＋ ★각 섹션에 붙은 연결 묶음 ＋ 연결모드 ⇒ ★이 셋이 같으면 «같은 일»이다. */
async function outcome(page, gesture) {
  const before = await secIds(page);
  await gesture();
  const after = await secIds(page);
  return {
    dSections: after.length - before.length,
    rows: (await refRows(page)).map(r => r.ids),
    linking: await linking(page),
    tailIsNew: after.length > before.length ? !before.includes(after[after.length - 1]) : null,
  };
}

test('K0 전제 — 장면이 서고 ★키보드 길이 살아 있다(⛔이게 거짓이면 아래 빨강은 「안 재고 있다」와 구분 안 된다)', async ({ page }) => {
  const ids = await setup(page);
  expect(ids.length, '⒜ 섹션 둘').toBe(2);
  expect(await refRows(page), '⒝ 아직 연결 0건').toEqual([]);
  expect(await page.evaluate((g) => document.querySelectorAll('.scratch-item[data-scratch-group="' + g + '"]').length, GROUP_ID), '⒞ 그룹 5장이 DOM 에').toBe(GROUP_N);
  // ⒟ ★히스토리 래퍼 전제 — 이게 거짓이면 K6 의 초록이 아무것도 안 잠근다.
  expect(await page.evaluate(() => window.__insertSeamRoster().includes('addSection')), '⒟ addSection 이 삽입 래퍼 명부에').toBe(true);
  /* ⒠ ★★계측기 양성대조 — ★키보드 단축키가 이 하네스에서 ★실제로 앱에 닿나.
     ⛔이걸 안 세우면, ⌘L 핸들러가 ★있는데도 「키가 안 닿아서」 빨강인 판을 ★구분할 수 없다.
     ★`s` = addSection 기본 키(js/settings/settings-store.js FALLBACK.shortcuts.addSection='KeyS'). */
  const b = await secIds(page);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('s');
  await page.waitForTimeout(250);
  expect((await secIds(page)).length - b.length, '⒠ ★`s` 키가 섹션을 만든다 = 키보드 길이 살아 있다').toBe(1);
});

test('K1 ② 단독 선택 ＋ ⌘L — 섹션이 «정확히 ＋1», 그 새 섹션에 연결, 연결 «모드»는 안 켜진다', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await selectMany(page, ['sp_solo']);
  await pressCmdL(page);
  const after = await secIds(page);
  expect(after.length - before.length, '★섹션 ＋1').toBe(1);
  expect(after.slice(0, 2), '기존 둘은 그대로').toEqual(before);
  expect(await refRows(page), `★새 섹션 ${after[2]} 에만, sp_solo 하나`).toEqual([{ id: after[2], ids: ['sp_solo'] }]);
  expect(await linking(page), '★연결 모드를 «안» 켠다(⌘＋🔗 와 같다)').toEqual({ body: false, banner: false });
});

test('K2 ★②의 본 단언 — ⌘L 과 ⌘＋🔗 가 ★«같은 일»을 한다(단독)', async ({ page }) => {
  await setup(page);
  const viaKey = await outcome(page, async () => { await selectMany(page, ['sp_solo']); await pressCmdL(page); });
  await setup(page);   // ★같은 장면을 처음부터 다시 세운다
  const viaBtn = await outcome(page, async () => { await clickLinkBtn(page, 'sp_solo', { meta: true }); });
  expect(viaKey, `★두 입구가 ★같은 결과\n  키  =${JSON.stringify(viaKey)}\n  버튼=${JSON.stringify(viaBtn)}`).toEqual(viaBtn);
  // ★그리고 그 «같음»이 ★「둘 다 아무 일도 안 했다」가 ★아님을 못박는다(⛔항등식 방지).
  expect(viaKey.dSections, '★그 결과는 ＋1 이다').toBe(1);
  expect(viaKey.rows, '★연결도 실제로 생겼다').toEqual([['sp_solo']]);
});

test('K3 ② 그룹 — 멤버 ★한 장만 골라도 ⌘L 이 ★그룹 전원을 끌어온다(섹션은 ★1개 · ⌘＋🔗 L4 와 같은 수)', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  /* ⛔한 장만 ★눌렀다 — ★그런데 ★선택은 ★그룹 전원(5)으로 ★번진다(위 selectMany 주석의 ★그 실측).
     ★그 수를 ★★단언에 박는다: ★누른 수 1 ≠ ★선택된 수 5. */
  await selectMany(page, ['sp_f3'], GROUP_N);
  await pressCmdL(page);
  expect((await secIds(page)).length - before.length, '★섹션 ＋1').toBe(1);
  const rows = await refRows(page);
  expect(rows.length, '★연결을 가진 섹션은 ★하나').toBe(1);
  expect(rows[0].ids, `★그룹 ${GROUP_N}장 ★전부가 그 한 섹션에`).toEqual(['sp_f1', 'sp_f2', 'sp_f3', 'sp_f4', 'sp_f5']);
});

/* ★★⚠️K4 — ★이 수(섹션 ★1개)는 ★★«2026-10-07 승인 ⑤»의 계약이다. ★현빈 ③(2026-10-09)이
   ★이것을 ★3개로 뒤집으려 하고 ★답을 ★기다리는 중이다(파일 머리말 ⚠️ 블록).
   ⇒ ★답이 ③ 이면 ★여기와 L5 를 ★⚰️로 ★같이 갱신한다. ⛔그때까지는 ★이것이 ★참값이다. */
test('K4 ② 복수 선택 3장 ＋ ⌘L — 섹션은 ★«1개»(⚠️2026-10-07 ⑤ 계약 · ③ 답 대기 중)·셋 전부가 그 하나에', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await selectMany(page, ['sp_m1', 'sp_m2', 'sp_m3']);
  await pressCmdL(page);
  const after = await secIds(page);
  expect(after.length - before.length, '★섹션 ＋1 (⚠️③ 승인되면 ＋3 으로 ⚰️ 갱신)').toBe(1);
  const rows = await refRows(page);
  expect(rows.length, '★연결 가진 섹션 1개').toBe(1);
  expect(rows[0].id, '★맨 아래(마지막 섹션)').toBe(after[after.length - 1]);
  expect(rows[0].ids, '★셋 전부가 그 하나에').toEqual(['sp_m1', 'sp_m2', 'sp_m3']);
});

/* ★★K3b — ★이 파일에서 ★`_cmdLinkTargets` 의 ★«그룹 번짐»을 ★★재는 ★유일한 자리다.
   ★까닭(실측 2026-10-09): ★그냥 클릭은 ★선택 자체가 ★그룹 전원으로 번진다(js/scratch-pad.js 그 블록은
     ★「★비shift 클릭 시」가 조건이다) ⇒ ★그 장면에서는 `_cmdLinkTargets(sel[0])` 와 ★맨 `sel` 이
     ★★같은 답을 내어 ★★어느 단언도 둘을 ★가르지 못한다(★K3 가 그랬다 — ★변이 M5 가 ★0건이었다).
   ★⇧클릭은 ★그 번짐을 ★안 켠다 ⇒ ★선택은 ★1장인데 ★연결은 ★5장이어야 한다. ★여기서 둘이 ★갈린다.
   ⛔장면을 ★손으로 만들지 않았다 — ★⇧클릭은 ★앱의 ★실제 길이다(더해 고르기). */
test('K3b ② 그룹 — ★⇧클릭으로 ★한 장만 골라도(★선택 1) ⌘L 은 ★그룹 ★전원을 연결한다 (★M5 를 재는 자)', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await clickItem(page, 'sp_f3', { shift: true });     // ★⇧ ⇒ 그룹 공동선택 ★안 켜진다
  const nSel = await page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length);
  expect(nSel, '★전제 — 선택은 ★«1장»이다(⇧ 라서 그룹으로 안 번졌다)').toBe(1);
  await pressCmdL(page);
  expect((await secIds(page)).length - before.length, '★섹션 ＋1').toBe(1);
  const rows = await refRows(page);
  expect(rows.length, '★섹션 하나').toBe(1);
  expect(rows[0].ids.length, `★★연결은 ★${GROUP_N}장 — ★선택(1)보다 ★많다 ⇒ ★제스처가 ★그룹을 번지게 했다`).toBe(GROUP_N);
});

test('K5 ★②의 본 단언 — ⌘L 과 ⌘＋🔗 가 ★«같은 일»을 한다(★복수 선택 · ★여기가 ③ 과 갈리는 자리)', async ({ page }) => {
  await setup(page);
  const viaKey = await outcome(page, async () => {
    await selectMany(page, ['sp_m1', 'sp_m2', 'sp_m3']); await pressCmdL(page);
  });
  await setup(page);
  const viaBtn = await outcome(page, async () => {
    await selectMany(page, ['sp_m1', 'sp_m2', 'sp_m3']); await clickLinkBtn(page, 'sp_m1', { meta: true });
  });
  expect(viaKey, `★두 입구가 ★같은 결과\n  키  =${JSON.stringify(viaKey)}\n  버튼=${JSON.stringify(viaBtn)}`).toEqual(viaBtn);
  expect(viaKey.dSections, '★그 결과는 ＋1 이다(⛔둘 다 0 이 아니다)').toBe(1);
  expect(viaKey.rows, '★한 섹션에 셋').toEqual([['sp_m1', 'sp_m2', 'sp_m3']]);
});

test('K6 ② ★⌘Z «한 걸음» — ⌘L 로 생긴 섹션과 연결이 ★한 번에 사라진다', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await selectMany(page, ['sp_m1', 'sp_m2', 'sp_m3']);
  const r = await expectOneUndoStep(page, async () => { await pressCmdL(page); }, '⌘L — 빈 섹션 ＋ 연결');
  expect(await secIds(page), '★⌘Z 한 번 뒤 섹션이 원래대로').toEqual(before);
  expect(await refRows(page), '★연결도 같이 사라졌다').toEqual([]);
  console.log('[K6] dPos=' + r.dPos + ' undoDPos=' + r.undoDPos + ' undoDLen=' + r.undoDLen + ' top=' + r.topAction);
  await page.keyboard.press('Meta+Shift+z');
  await page.waitForTimeout(350);
  expect((await secIds(page)).length, '★⌘⇧Z 한 번에 섹션이 돌아온다').toBe(before.length + 1);
  expect((await refRows(page)).length, '★연결도 돌아온다').toBe(1);
});

/* ★K7a~K7c 는 ★«지키는 시험»이다 — ★핀에서도 ★초록이라야 한다(⌘L 이 ★없던 판에서도 참).
   ⇒ ⛔이것이 빨강→초록으로 ★바뀌는 것은 ★기대하지 않는다. ★재는 것은 ★«과발동»이다.
   ★★셋으로 ★쪼갰다 — 한 덩어리였을 때는 ★변이 M3·M4 가 ★둘 다 「K7 빨강」으로만 나와
     ★★«어느 가드가 깨졌나»를 ★구분할 수 없었다(실측). ⇒ ★축마다 ★재는 자를 둔다. */
test('K7a ★음성대조 — ⌘ ★없는 `l` 은 아무것도 만들지 않는다', async ({ page }) => {
  await setup(page);
  await selectMany(page, ['sp_m1', 'sp_m2']);
  const b = await secIds(page);
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('l');
  await page.waitForTimeout(300);
  expect(await secIds(page), '★수식어 없는 `l` ⇒ 섹션 0개').toEqual(b);
  expect(await refRows(page), '★연결도 0건').toEqual([]);
});

test('K7b ★음성대조 — ★선택이 ★0 이면 ⌘L 도 아무것도 만들지 않는다', async ({ page }) => {
  await setup(page);
  /* ★선택을 «앱의 길»로 비운다(빈 바닥 클릭). 남으면 아래 전제 단언이 빨강으로 말해 준다
     (⛔클래스를 손으로 떼면 모듈 상태 `_selectedItems` 와 어긋나 ★거짓 장면이 된다). */
  await selectMany(page, ['sp_m1']);
  await page.mouse.click(400, 900);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length), '전제 — 선택이 비었다').toBe(0);
  const b = await secIds(page);
  await pressCmdL(page);
  expect(await secIds(page), '★선택 0 ⇒ 섹션 0개').toEqual(b);
  expect(await refRows(page), '★연결도 0건').toEqual([]);
});

test('K7c ★음성대조 — ★입력란에 포커스면 ⌘L 을 ★안 먹는다(타이핑을 안 가로챈다)', async ({ page }) => {
  await setup(page);
  await selectMany(page, ['sp_m1']);
  const b = await secIds(page);
  await page.evaluate(() => {
    const i = document.createElement('input'); i.id = 'k7-probe'; document.body.appendChild(i); i.focus();
  });
  expect(await page.evaluate(() => document.activeElement?.id), '전제 — 입력란에 포커스').toBe('k7-probe');
  await page.keyboard.press('Meta+l');
  await page.waitForTimeout(300);
  expect(await secIds(page), '★입력란 중 ⌘L ⇒ 섹션 0개').toEqual(b);
  await page.evaluate(() => document.getElementById('k7-probe')?.remove());
});

test('K7d ★음성대조 — ⌘⇧L·⌘⌥L 은 ★안 먹는다(정확 일치 · ★변이 M7 을 재는 자)', async ({ page }) => {
  /* ★왜 이것을 재나 — 제품이 `!e.shiftKey && !e.altKey` 로 ★정확 일치를 ★요구한다(이 레포 관례).
     ★그 줄을 ★무력화해도 ★아무 검사도 빨개지지 ★않았다(★변이 M7 = ★0건) ⇒ ★그 자리를 ★여기서 잠근다.
     ★까닭: ⌘⇧L·⌘⌥L 은 ★다른 기능이 ★나중에 쓸 수 있는 자리다 — ★지금 ★새면 ★그때 ★부딪친다. */
  await setup(page);
  await selectMany(page, ['sp_m1', 'sp_m2']);
  const b = await secIds(page);
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+Shift+l');
  await page.waitForTimeout(300);
  expect(await secIds(page), '★⌘⇧L ⇒ 섹션 0개').toEqual(b);
  await page.keyboard.press('Meta+Alt+l');
  await page.waitForTimeout(300);
  expect(await secIds(page), '★⌘⌥L ⇒ 섹션 0개').toEqual(b);
  expect(await refRows(page), '★연결도 0건').toEqual([]);
});

test('K8 ② ★Ctrl+L 도 ★같이 먹는다 — ★윈도·리눅스 길(★변이 M8 을 재는 자)', async ({ page }) => {
  /* ★★왜 이것을 재나 — 제품 주석이 ★「이 키 길은 ★윈도/리눅스에서도 먹는다」라고 ★주장한다.
     ★그런데 `(e.metaKey || e.ctrlKey)` 를 `e.metaKey` 로 ★좁혀도 ★아무 검사도 빨개지지 ★않았다
     (★변이 M8 = ★0건) ⇒ ★★«내 산문이 ★주장하는데 ★아무도 ★안 재는» 자리였다. ★여기서 잠근다.
     ⚠️이것은 ★맥 헤드리스에서 ★Ctrl 수식어를 ★보내는 것이다 — ★진짜 윈도 실기가 ★아니다(그건 ★안 쟀다). */
  await setup(page);
  const before = await secIds(page);
  await selectMany(page, ['sp_solo']);
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('Control+l');
  await page.waitForTimeout(350);
  const after = await secIds(page);
  expect(after.length - before.length, '★Ctrl+L 로도 섹션 ＋1').toBe(1);
  expect(await refRows(page), `★그 새 섹션에 연결됐다`).toEqual([{ id: after[after.length - 1], ids: ['sp_solo'] }]);
});

/* ══ 양성대조·변이 명부 — ★실측(이 레인 · 2026-10-09 · load 4~11) ════════════════════════
 * ⒜ ★핀 판(기준판 dev `a3556b936f8f` — 이 일 «전») — ★제품을 ★원복해 ★다시 쟀다(⛔HEAD 를 판으로 쓰지 않았다):
 *       python3 <적용기> revert   # sha 가 `git show a3556b93:js/scratchpad-link.js` 와 ★일치함을 확인
 *     ★빨강 **6** / 초록 2  —  빨강 = K1 K2 K3 K3b K4 K5 K6 중 그 판에 있던 것 · 초록 = **K0 · K7a~K7c**
 *     ★★×3 으로 쟀고 ★세 번 ★같은 집합이었다(rc=1 ×3). ⛔1회로는 안 선다(부하 아래 첫 빨강은 운일 수 있다).
 *     ⇒ ★K0(전제)·K7a~K7c(음성대조)는 ★«지키는 시험»이다 — ★핀에서도 초록이라야 증인이 된다.
 *     ⚠️K3b·K7d·K8 은 ★핀 ×3 ★뒤에 더했다 ⇒ ★그 셋의 「핀 빨강」은 ★위 수에 ★안 들어 있다.
 *       대신 ★각각을 ★변이로 ★잠갔다(아래 M5·M7·M8) — ★그것이 ★그 셋의 양성대조다.
 * ⒝ ★변이(이 판에서 한 자리씩 무력화) — 「무엇을 끄면 어느 검사가 빨강인가」· ★전부 ★실측:
 *       M1 ⌘L 분기 통째 제거        → K1 K2 K3 K3b K4 K5 K6   (**7**)
 *       M2 키를 `KeyK` 로           → K1 K2 K3 K3b K4 K5 K6   (**7** · 같은 집합)
 *       M3 입력란 가드 제거          → **K7c 만** (1)
 *       M4 「선택 0」 가드 제거       → **K7b 만** (1)
 *       M5 `_cmdLinkTargets` → 맨 `sel`(그룹 번짐 제거) → **K3b 만** (1)
 *       M7 `⇧·⌥` 정확일치 제거      → **K7d 만** (1)
 *       M8 `metaKey||ctrlKey` → `metaKey`(Ctrl 길 제거) → **K8 만** (1)
 *     ⇒ ★축마다 «재는 자»가 ★정확히 하나씩 있다.
 *     ★★M3·M4 는 ★처음엔 ★둘 다 「K7 빨강」으로만 나왔다(K7 이 ★한 덩어리였다) ⇒ ★★어느 가드가 깨졌는지
 *       ★구분이 안 됐다. ⇒ ★K7 을 ★K7a·K7b·K7c 로 ★쪼갠 뒤 ★다시 쟀고 ★각각 1칸이 됐다.
 *     ★★M5 는 ★처음 ★**0건**이었다 — ★K3 가 그것을 ★안 재고 있었다. 까닭(실측): ★그냥 클릭은
 *       ★선택 자체가 그룹 전원으로 번져(js/scratch-pad.js 「★비shift 클릭 시」) `_cmdLinkTargets(sel[0])` 와
 *       맨 `sel` 이 ★같은 답을 낸다 ⇒ ★★항등식이었다. ⇒ ★⇧클릭(번짐 안 켜짐)으로 ★K3b 를 세워 ★닫았다.
 *     ★★M7·M8 도 ★처음 ★**0건**이었다 — ★★제품 ★주석이 「윈도/리눅스에서도 먹는다」를 ★주장하는데
 *       ★그것을 ★재는 자가 ★없었다(★내 산문이 ★안 재는 것을 ★주장한 자리). ⇒ ★K7d·K8 로 ★닫았다.
 * ⒞ ⛔양성대조 ★0건인 자리(=이 파일이 «안 재는» 것) — ★이름으로 남긴다:
 *     · ★**M6 `e.preventDefault(); e.stopPropagation();` 제거 → 0건.** 까닭: 이 레포에서 ⌘L 을 처리하는
 *       자가 ★달리 없고(2026-10-09 실측 0건), 헤드리스엔 ★주소창이 없어 ★막을 ★기본동작이 없다.
 *       ⇒ ★★«지금은» 안 새지만 ★나중에 ⌘L 을 쓰는 자가 생기면 ★이 칸이 ★조용히 무너진다. ★그때 재라.
 *     · ★**진짜 윈도/리눅스 실기** — 0건. K8 은 ★맥 헤드리스에서 ★Ctrl 수식어를 ★보낸 것이다.
 *     · ★**배포(packaged) Electron 앱** — 0건. ⌘L 이 ★OS·앱 메뉴에 ★먹히나는 ★소스로만 쟀다
 *       (가속기 2개 `CmdOrCtrl+Shift+O`·`CmdOrCtrl+Shift+E` · ⌘L ★0건). ★행위로는 ★안 쟀다.
 *     · ★**섹션이 0개인 캔버스**에서의 ⌘L — 0건(미측정 · cmd-link-new-section ⒞ 와 같은 구멍).
 *     · ★**이미 다른 섹션에 연결된 스크래치**를 ⌘L 로 다시 거는 갈래 — 0건(미측정).
 *     · ★**③(단위마다 한 섹션)** — ★이 파일은 ★안 잰다. ★보류 중이다(머리말 ⚠️ 블록).
 */
