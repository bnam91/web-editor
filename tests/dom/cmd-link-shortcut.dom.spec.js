/* cmd-link-shortcut.dom.spec.js — ★② ⌘L = «섹션링크» 단축키 ＋ ★③ «단위마다 한 섹션» 일괄
 *
 * 현빈 2026-10-09 (1009t2 ②③ · 지디 발주) — 원문:
 *   ② 「스크래치패드 선택 후 커맨드+링크버튼=링크연결 섹션 나타나는데 → ★커맨드L 단축키로도 되게」
 *   ③ 「스크래치패드 복수 선택 후 섹션링크 단축키(커맨드L) → ★각 스크래치패드
 *      (★그룹설정된 스크래치그룹도 ★하나로 침)와 연결된 섹션 ★일괄 생성」
 *
 * ★★★확정 규칙 (현빈 2026-10-09 · 지디가 받아 적었다) — ★한 줄이다:
 *   ★★「선택 집합에서 ★★그룹 ★하나당 섹션 ★1 ＋ ★★비그룹 패드 ★하나당 섹션 ★1」
 *     그룹 설정된 패드(= 한 그룹)  → 섹션 ★1개   (★K3·K3b)
 *     일반 패드 N개 따로 선택      → 섹션 ★N개   (★K4·K8n)
 *     ★★혼합: 그룹 1 ＋ 일반 2     → 섹션 ★3개   (★합산 · ★K9)
 *
 * ★★★⚰️«누가 무엇을 정했나» — ⛔여기를 틀리게 읽지 마라(한 번 틀리게 적었다):
 *   ★2026-10-07 현빈 승인 ⑤의 ★원문(지디/notes/TODO-hyunbin-20261006.md:237)은
 *     「(가)⌘＋🔗 → 연결된 빈 섹션 ★하나 (높이=기본 · ★★그룹이어도 하나)」 — ★★«그룹» 칸이다.
 *   ⇒ ★★「★따로 고른 ★복수도 ★하나」는 ★그 줄에 ★★없다. ★그 칸은 ★구현할 때 ★지디가 ★넓힌 것이고
 *     ★L5 의 제목이 「⑤」라 적어 ★그것을 ★덮었다.
 *   ⇒ ★★★따라서 ③ 은 ★«현빈 승인 뒤집기»가 ★아니라 ★★«넓혀진 칸 되돌리기»다.
 *   ★★그리고 ★⑤의 «그룹=하나» 칸은 ★★안 바뀐다 — ★K3·K3b·L4 가 ★그것을 ★계속 문다.
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

/* ★★⚰️K4 — ★이 수가 ★2026-10-09 ③ 으로 ★바뀐 자리다. ⛔옛 것을 ★지우지 않고 ★적어 둔다:
     ⚰️옛 단언(2026-10-09 ② 묶음) : `expect(after.length - before.length).toBe(1)` · `rows.length` **1**
                                    · `rows[0].ids` = ['sp_m1','sp_m2','sp_m3'] (★한 섹션에 셋)
     ⚰️옛 수(실측 · 핀 a3556b93 ＋ ②커밋 46d35308) : 따로 고른 3장 → 섹션 ★＋1 · 링크 3 · 연결 가진 섹션 ★1
     ★새 수(현빈 2026-10-09 ③)   : 섹션 ★＋3 · 각 섹션에 ★1개씩
     ★★«누가 정했나» = 머리말 ⚰️ 블록 — ★이것은 ★«현빈 ⑤ 뒤집기»가 ★아니다. */
test('K4 ③ 복수 선택 3장 ＋ ⌘L — 섹션이 ★«정확히 3개»·각자 제 짝 하나씩 (⚰️옛 단언 = ＋1·한 섹션)', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await selectMany(page, ['sp_m1', 'sp_m2', 'sp_m3']);
  await pressCmdL(page);
  const after = await secIds(page);
  expect(after.length - before.length, '★★섹션 ＋★3 (⚰️옛 수 = ＋1)').toBe(3);
  expect(after.slice(0, before.length), '기존 섹션은 그대로(새 것은 전부 맨 아래)').toEqual(before);
  const rows = await refRows(page);
  expect(rows.length, '★연결 가진 섹션 ★3개 (⚰️옛 수 = 1)').toBe(3);
  expect(rows.map(r => r.ids.length), '★각 섹션에 ★하나씩(⛔한 섹션에 셋 몰리지 않았다)').toEqual([1, 1, 1]);
  expect(rows.map(r => r.ids[0]).sort(), '★셋이 ★각자 연결됐다').toEqual(['sp_m1', 'sp_m2', 'sp_m3']);
  expect(rows.map(r => r.id).sort(), '★그 셋이 ★새로 생긴 섹션들이다')
    .toEqual(after.filter(x => !before.includes(x)).sort());
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
  /* ⚰️옛 단언(② 묶음) : `.toBe(1)` · `rows` = [['sp_m1','sp_m2','sp_m3']] (★한 섹션에 셋) */
  expect(viaKey.dSections, '★그 결과는 ★＋3 이다(⚰️옛 수 = ＋1 · ⛔둘 다 0 이 아니다)').toBe(3);
  expect(viaKey.rows.map(r => r.length), '★세 섹션에 ★하나씩').toEqual([1, 1, 1]);
});

test('K6 ② ★⌘Z «한 걸음» — ⌘L 로 생긴 섹션과 연결이 ★한 번에 사라진다', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await selectMany(page, ['sp_m1', 'sp_m2', 'sp_m3']);
  /* ⚰️옛 수(② 묶음) : 섹션 ＋1 이 한 걸음 · ⌘⇧Z 로 `before.length + 1` · 연결 1 */
  const r = await expectOneUndoStep(page, async () => { await pressCmdL(page); }, '⌘L 일괄 — 빈 섹션 3 ＋ 연결 3');
  expect(await secIds(page), '★⌘Z ★한 번 뒤 섹션이 원래대로(★3개가 ★같이 사라졌다)').toEqual(before);
  expect(await refRows(page), '★연결도 같이 사라졌다').toEqual([]);
  console.log('[K6] dPos=' + r.dPos + ' undoDPos=' + r.undoDPos + ' undoDLen=' + r.undoDLen + ' top=' + r.topAction);
  await page.keyboard.press('Meta+Shift+z');
  await page.waitForTimeout(350);
  expect((await secIds(page)).length, '★⌘⇧Z ★한 번에 ★3개가 돌아온다').toBe(before.length + 3);
  expect((await refRows(page)).length, '★연결도 셋 다 돌아온다').toBe(3);
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

/* ★★★K9 — ★지디가 ★이 수를 ★직접 ★요구했다(2026-10-09): 「★그룹 1 ＋ 일반 2 ⇒ ★섹션 ★몇 · ★링크 ★몇」.
   ★확정 규칙의 ★«합산» 칸이다 — ★그룹은 ★1, 일반은 ★각 1 ⇒ ★3개.
   ★장면 만들기 = ★첫 장은 ★그냥 클릭(일반 m1) · ★나머지는 ⇧ ⇒ ★그룹으로 ★안 번진다(선택 ★3장).
     ⛔순서를 ★바꿔 그룹 멤버를 ★먼저 ★그냥 클릭하면 ★선택이 ★5장으로 ★번져 ★다른 장면이 된다. */
test('K9 ③ ★★혼합 — 일반 2 ＋ 그룹 1장(⇧) = ★단위 3 ⇒ 섹션 ★«3개» · 링크 ★1·1·5', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await selectMany(page, ['sp_m1', 'sp_m2', 'sp_f1'], 3);
  const after0 = await secIds(page);
  expect(after0, '전제 — 아직 섹션 안 생겼다').toEqual(before);
  await pressCmdL(page);
  const after = await secIds(page);
  expect(after.length - before.length, '★★섹션 ★＋3 (⛔7개가 아니다 — 그룹은 ★하나로 친다)').toBe(3);
  const rows = await refRows(page);
  expect(rows.length, '★연결 가진 섹션 ★3개').toBe(3);
  expect(rows.map(r => r.ids.length).sort((a, b) => a - b),
    `★링크 수 = 1·1·${GROUP_N} (★그룹 단위가 ★전원을 끌어왔다)`).toEqual([1, 1, GROUP_N]);
  const all = rows.flatMap(r => r.ids).sort();
  expect(all.length, `★총 링크 = 2 ＋ ${GROUP_N}`).toBe(2 + GROUP_N);
  expect(all.includes('sp_m1') && all.includes('sp_m2'), '★일반 둘 다 연결됐다').toBe(true);
  expect(all.filter(x => x.startsWith('sp_f')).length, `★그룹 ${GROUP_N}장 전원`).toBe(GROUP_N);
  /* ★잰 값을 ★찍는다 — ⛔「통과」만으로는 ★수가 보고에 안 남는다(지디가 ★이 수를 ★요구했다). */
  console.log('[K9 혼합] 선택=3(일반2＋그룹멤버1) → 섹션 ＋' + (after.length - before.length)
    + ' · 링크 총 ' + all.length + ' · 섹션별 ' + JSON.stringify(rows.map(r => r.ids.length))
    + ' · 링크 명부 ' + JSON.stringify(all));
});

test('K8n ③ ★수는 «단위 수»를 따른다 — 일반 1·2·3 단위에서 섹션 수가 ★그 수다', async ({ page }) => {
  for (const [sel, units] of [[['sp_m1'], 1], [['sp_m1', 'sp_m2'], 2], [['sp_m1', 'sp_m2', 'sp_m3'], 3]]) {
    await setup(page);
    const before = await secIds(page);
    await selectMany(page, sel);
    await pressCmdL(page);
    const d = (await secIds(page)).length - before.length;
    expect(d, `★단위 ${units} ⇒ 섹션 ${units}개 (잰 값 ${d})`).toBe(units);
    expect((await refRows(page)).length, `★연결 가진 섹션도 ${units}개`).toBe(units);
  }
});

/* ══ 양성대조·변이 명부 — ★실측(이 레인 · 2026-10-09 · load 5~9 · ⛔전부 ★행위로) ═══════════
 * ⒜ ★판을 ★둘 두고 ★각각 쟀다 — ⛔HEAD 를 판으로 쓰지 않았다(고친 뒤엔 HEAD 가 곧 고친 판이다):
 *     ㉠ ★핀 `a3556b936f8f` (②③ ★둘 다 없다) : ★빨강 **11** / 초록 13
 *        빨강 = K1 K2 K3 K3b K4 K5 K6 K8 K8n K9 ＋ L5
 *        초록 = **K0 · K7a~K7d** ＋ L0~L4 L6~L8   ⇒ ★그 다섯이 «지키는 시험»이다
 *     ㉡ ★②커밋 `46d35308` (★③ ★만 없다) : ★빨강 **6** / 초록 18 · ★★×3 ★같은 집합 · rc=1 ×3
 *        빨강 = **K4 K5 K6 K8n K9** ＋ L5   ⇒ ★★이것이 ③ 을 ★«따로» 재는 자다(②와 ★안 섞인다)
 *     ⇒ ③ 적용 뒤 : **24 passed · rc=0 ×3** (★이 티켓 ★첫 rc=0)
 *     ★원복도 쟀다 — 핀 판으로 갈아끼운 뒤 sha 가 `git show a3556b93:` 와 ★일치함을 확인하고 돌렸다.
 * ⒝ ★변이 — 「무엇을 끄면 어느 검사가 빨강인가」· ★★0건 ★없다:
 *       N1 그룹 접기 무력화(`key` 를 `'#'+id` 로) → K3 K3b L4 L6        (4)
 *       N2 ★«버튼만» 옛 꼴로(`linkToNewSection`)  → **K5 L5**            (2)
 *       N3 ★«⌘L 만» 옛 꼴로                      → K4 K5 K6 K8n K9      (5)
 *       N4 히스토리 노옵 제거                      → K6 L6                (2)
 *       N5 끝 표본 제거                           → K6 L6                (2)
 *       N6 한 단위에서 ★첫 장만 연결               → K3 K3b K9 L4         (4)
 *       N7 ★중복 접기(`seen`) 제거                 → K3 K3b L4 L6         (4)
 *     ★★N2 가 ★이 설계의 ★증인이다 — ★«버튼만» 되돌리면 ★K5(두 입구 대조)와 ★L5 가 ★같이 빨개진다
 *       ⇒ ★★「입구 둘이 ★조용히 갈린다」를 ★실제로 ★잡는다. ★«정본 하나»가 ★말이 아니라 ★재어졌다.
 *     ★★N7 은 ★내 ★예상이 ★틀린 자리다 — 「중복 입력이 없으니 0건」이라 ★생각했는데 ★4칸이 물었다.
 *       까닭: `seen` 이 ★없으면 ★그룹 5장이 ★5단위가 된다(멤버마다 한 번씩 돈다) ⇒ ★★그 한 줄이
 *       「★그룹 = 하나」를 ★떠받치는 자였다. ⛔예상으로 0건을 적지 말고 ★돌려 보라는 ★실례.
 * ⒞ ⛔양성대조 ★0건인 자리(=이 파일이 «안 재는» 것) — ★이름으로 남긴다:
 *     · ★**M6 `e.preventDefault(); e.stopPropagation();` 제거 → 0건**(②에서 쟀다). 까닭: 이 레포에서
 *       ⌘L 을 처리하는 자가 ★달리 없고(실측 0건), 헤드리스엔 ★주소창이 없어 ★막을 기본동작이 없다.
 *       ⇒ ★나중에 ⌘L 을 쓰는 자가 생기면 ★이 칸이 ★조용히 무너진다. ★그때 재라.
 *     · ★**새 섹션의 «순서»** — 0건. `_mkLinkedSection` 이 tail 을 ★매번 다시 읽어 ★받은 순서로 쌓이는데,
 *       K4·K9 는 ★정렬해서 견주므로 ★순서를 ★안 잠근다. ⇒ ★순서가 요구가 되면 ★그때 자를 세워라.
 *     · ★**진짜 윈도/리눅스 실기** 0건(K8 은 맥 헤드리스에서 Ctrl 수식어) · ★**배포 Electron** 0건.
 *     · ★**섹션 0개 캔버스**에서의 ⌘L · ★**이미 다른 섹션에 연결된 스크래치**를 다시 거는 갈래 — 0건.
 *     · ★**그룹 ★둘 이상**을 한 번에 고른 경우(그룹A＋그룹B ⇒ 2단위) — ★0건(미측정). ★규칙상 2개일 참인데
 *       ★장면에 그룹이 ★하나뿐이라 ★안 쟀다. ⇒ ★★「합산」의 ★그 칸은 ★«일반＋그룹»만 쟀다(K9).
 */
