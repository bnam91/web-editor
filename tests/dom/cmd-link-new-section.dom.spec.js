/* cmd-link-new-section.dom.spec.js — ⌘(Meta)＋🔗 = «연결된 빈 섹션»이 바로 생긴다
 *
 * 현빈 2026-10-07 시안 승인 ①~⑤ (지디 발주):
 *   ① ⌘ 누른 채 🔗 → 빈 섹션 «하나»를 만들고 그 자리에서 연결(연결 모드 안 켠다)
 *   ② 그냥 🔗 → 지금 동작 그대로(연결 모드)            ← ★이 파일의 L1·L2 가 그걸 «문다»
 *   ③ 새 섹션 높이 = 기본 높이(스크래치 길이에 안 맞춘다)
 *   ④ 그룹이어도 섹션은 «하나» · 그룹 전부가 그 한 섹션에
 *   ⑤ 여러 장을 따로 골랐을 때도 섹션 «하나» · 새 섹션은 캔버스 «맨 아래»
 *
 * ★무엇으로 재나 — 앱 통째로 헤드리스(bootApp = 실제 모듈·실제 마우스·실제 ⌘Z).
 *   ⛔addSection 을 스텁으로 두면 이 일의 «가장 중요한 축»(⌘Z 한 걸음)을 못 잰다 —
 *     그 한 걸음을 깨는 자가 js/insert-history.js 의 «끝 표본»(addSection 을 감싼다)이라,
 *     스텁은 그 래퍼를 지나지 않아 «조용히 초록»이 된다. 그래서 진짜 래퍼 위에서 잰다(L0 ⒜ 가 그 전제를 단언).
 *   ★⌘Z 는 화면이 아니라 «히스토리 스택»으로 잰다(tests/dom/_history-step.js expectOneUndoStep):
 *     A2 「⌘Z 가 구제 칸을 만들지 않았다」가 「두 걸음」을 잡는 자다. 화면만 보면 끝 표본이 빠져도 초록이 된다(DEF-01).
 *
 * ★양성대조 명부는 파일 끝 주석에 있다(무엇을 무력화하면 어느 검사가 빨강인가 — 실측 수).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmd-link-new-section
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* ★장면을 «앱 자신의 입구»로 만든다 — ⛔손으로 쓴 섹션 HTML 을 쓰지 마라(처음엔 그렇게 썼다).
   까닭(실측): 손으로 쓴 .section-inner 엔 페이지 기본 좌우여백이 «없고», ⌘Z 복원의 rebindAll/applyPageSettings 가
   그때 `padding-left/right: 32px` 를 «채워» 넣는다 ⇒ 「복원 뒤 ≠ 조작 전」이 되어 A3 가 빨개진다(내 조치가 만든 빨강 ·
   js/history.js _restampRestored 주석의 «복원은 멱등이 아니다» 그 자리). 앱이 만든 섹션은 처음부터 그 여백을 갖는다.
   ⇒ addSection 으로 둘을 세우고 «그 id 를 받아» 쓴다. */
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

/* 스크래치 일곱 — 단독 1 · 그룹(g_t) 3 · 따로 고를 것 3.
   ★자리는 캔버스 «오른쪽»으로 몰아 둔다 — 섹션 클릭(L2)이 스크래치에 가리지 않아야 한다(가리면 clickAt 가 빨강으로 말해 준다). */
const ITEMS = [
  ['sp_solo', 1500, 80,  undefined],
  ['sp_g1',   1500, 320, 'g_t'],
  ['sp_g2',   1700, 320, 'g_t'],
  ['sp_g3',   1900, 320, 'g_t'],
  ['sp_m1',   1500, 560, undefined],
  ['sp_m2',   1700, 560, undefined],
  ['sp_m3',   1900, 560, undefined],
];

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  const ids = await buildScene(page);
  await page.evaluate(async ({ px, items }) => {
    for (const [id, x, y, g] of items) await window._scratchAddAndSave(px, x, y, 180, g, id);
  }, { px: PX, items: ITEMS });
  // 🔗 손잡이가 «실제로 주입될 때까지» 기다린다 — 산출물로 기다린다(⛔고정 대기 금지)
  await page.waitForFunction(() => document.querySelectorAll('.scratch-item .spl-btn-link').length === 7, null, { timeout: 10000 });
  return ids;
}

const secIds   = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
const refRows  = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block')]
  .map(s => ({ id: s.id, refs: s.dataset.refLinks || '' })).filter(r => r.refs));
const linking  = (page) => page.evaluate(() => ({
  body: document.body.classList.contains('spl-linking'),
  banner: (() => { const b = document.getElementById('spl-banner'); return !!b && b.style.display !== 'none'; })(),
}));

/* 🔗 손잡이를 «진짜 마우스»로 누른다. ★요소 지정 클릭이라 playwright 가 «무엇을 맞혔나»를 스스로 검사한다
   (가려져 있으면 던진다) — 좌표 클릭의 꾸밈 위험이 없다. */
async function clickLinkBtn(page, sid, { meta = false } = {}) {
  await page.evaluate((s) => document.querySelector('.scratch-item[data-scratch-id="' + s + '"]')
    .scrollIntoView({ block: 'center', inline: 'center' }), sid);
  const btn = page.locator('.scratch-item[data-scratch-id="' + sid + '"] .spl-btn-link');
  await expect(btn, `전제 — ${sid} 에 🔗 손잡이가 있다(미연결 항목)`).toHaveCount(1);
  await btn.click(meta ? { modifiers: ['Meta'] } : {});
  await page.waitForTimeout(250);
}
/* 스크래치 항목 자체를 누른다(선택용). shift 로 더한다. */
async function clickItem(page, sid, { shift = false } = {}) {
  await page.evaluate((s) => document.querySelector('.scratch-item[data-scratch-id="' + s + '"]')
    .scrollIntoView({ block: 'center', inline: 'center' }), sid);
  const el = page.locator('.scratch-item[data-scratch-id="' + sid + '"]');
  /* ⛔고정 좌표(90,150)로 누르지 마라 — 배율이 100% 가 아니면 상자가 작아져 그 점이 상자 «밖»이 되고
     playwright 가 「canvas-wrap intercepts pointer events」로 던진다(실측). 가운데는 늘 상자 안이다
     (손잡이 클러스터는 위 4px 에만 있다). */
  await el.click({ modifiers: shift ? ['Shift'] : [] });
  await page.waitForTimeout(120);
}

test('L0 전제 — 장면이 서고, ⌘Z 한 걸음을 깰 «그 래퍼»가 실제로 붙어 있다', async ({ page }) => {
  const ids = await setup(page);
  // ⒜ ★이 일의 ⑷(히스토리) 전제: window.addSection 은 js/insert-history.js 가 감싸 «끝 표본»을 더 쌓는다.
  //    이게 거짓이면 아래 L6 의 초록은 「안 재고 있다」와 구분이 안 된다.
  expect(await page.evaluate(() => window.__insertSeamRoster().includes('addSection')), '⒜ addSection 이 삽입 래퍼 명부에 있다').toBe(true);
  expect(ids.length, '⒝ 섹션 둘').toBe(2);
  expect(await secIds(page), '⒝ 그 둘이 캔버스에').toEqual(ids);
  expect(await refRows(page), '⒞ 아직 연결 0건').toEqual([]);
  expect(await page.evaluate(() => typeof window.SPLink?.linkToNewSection), '⒟ 새 입구가 있다').toBe('function');
});

test('L1 ★②무변 — ⌘ «없이» 🔗 를 누르면 연결 «모드»가 켜지고 섹션은 0개 생긴다', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await clickLinkBtn(page, 'sp_solo');                       // ⌘ 없음
  expect(await linking(page), '연결 모드 ON(배너 포함)').toEqual({ body: true, banner: true });
  expect(await secIds(page), '★섹션은 «0개» 생겼다').toEqual(before);
  expect(await refRows(page), '아직 연결도 0건').toEqual([]);
});

test('L2 ★②무변 — 그 연결 모드에서 섹션을 누르면 «그 섹션»에 연결된다(섹션 증가 0)', async ({ page }) => {
  const ids = await setup(page);
  const before = await secIds(page);
  await clickLinkBtn(page, 'sp_solo');
  const pt = await page.evaluate((a) => { const r = document.getElementById(a).getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; }, ids[0]);
  const hit = await page.evaluate(([x, y, a]) => { const e = document.elementFromPoint(x, y); return { id: e?.id || '', inA: !!e?.closest('#' + a) }; }, [pt[0], pt[1], ids[0]]);
  expect(hit.inA, `첫 섹션을 맞혔다(맞힌 요소=${hit.id})`).toBe(true);
  await page.mouse.click(pt[0], pt[1]);
  await page.waitForTimeout(250);
  expect(await secIds(page), '★섹션 증가 0').toEqual(before);
  expect(await refRows(page), '첫 섹션에 연결됐다').toEqual([{ id: ids[0], refs: 'sp_solo:0' }]);
  expect(await linking(page), '모드는 끝났다').toEqual({ body: false, banner: false });
});

test('L3 ⌘＋🔗 단독 — 섹션이 «정확히 ＋1», 그 새 섹션에 연결, 연결 모드는 «안» 켜진다', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await clickLinkBtn(page, 'sp_solo', { meta: true });
  const after = await secIds(page);
  expect(after.length - before.length, '★섹션 ＋1(개수)').toBe(1);
  expect(after.slice(0, 2), '기존 둘은 그대로').toEqual(before);
  const newId = after[2];
  expect(await refRows(page), `★refLinks 가 새 섹션 ${newId} 에만, 그 id 하나`).toEqual([{ id: newId, refs: 'sp_solo:0' }]);
  expect(await linking(page), '★연결 모드를 «안» 켠다').toEqual({ body: false, banner: false });
});

test('L4 ④그룹 3장 — 한 장만 ⌘＋🔗 해도 섹션은 «하나»(＋1)·그룹 «전부»(3개)가 그 섹션에', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await clickLinkBtn(page, 'sp_g2', { meta: true });          // ⛔고르지 않았다 — 그룹으로 번져야 한다
  const after = await secIds(page);
  expect(after.length - before.length, '★섹션 ＋1').toBe(1);
  const rows = await refRows(page);
  expect(rows.length, '★연결을 가진 섹션은 «하나»').toBe(1);
  expect(rows[0].id).toBe(after[2]);
  const ids = rows[0].refs.split(',').map(t => t.split(':')[0]).sort();
  expect(ids, '★개수까지 — 그룹 셋 전부').toEqual(['sp_g1', 'sp_g2', 'sp_g3']);
});

test('L5 ⑤따로 고른 3장 — 섹션 «하나»(＋1)에 셋 전부, 새 섹션은 «맨 아래»', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  await clickItem(page, 'sp_m1');
  await clickItem(page, 'sp_m2', { shift: true });
  await clickItem(page, 'sp_m3', { shift: true });
  expect(await page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length), '전제 — 셋이 골라졌다').toBe(3);
  await clickLinkBtn(page, 'sp_m1', { meta: true });
  const after = await secIds(page);
  expect(after.length - before.length, '★섹션 ＋1').toBe(1);
  const rows = await refRows(page);
  expect(rows.length, '★섹션 하나').toBe(1);
  expect(rows[0].id, '★맨 아래(마지막 섹션)').toBe(after[after.length - 1]);
  const ids = rows[0].refs.split(',').map(t => t.split(':')[0]).sort();
  expect(ids, '★셋 전부').toEqual(['sp_m1', 'sp_m2', 'sp_m3']);
});

test('L6 ★⌘Z «한 걸음» — 섹션도 연결도 같이 사라진다(히스토리 스택으로 잰다)', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  const r = await expectOneUndoStep(page, async () => {
    await clickLinkBtn(page, 'sp_g2', { meta: true });
  }, '⌘＋🔗 = 빈 섹션 ＋ 연결');
  // ★스택 단언(A0~A3)은 헬퍼가 했다. 여기서는 «눈에 보이는 결과»를 같은 자로 한 번 더 못박는다.
  expect(await secIds(page), '★⌘Z 한 번 뒤 섹션이 원래대로').toEqual(before);
  expect(await refRows(page), '★연결도 같이 사라졌다').toEqual([]);
  console.log('[L6] dPos=' + r.dPos + ' undoDPos=' + r.undoDPos + ' undoDLen=' + r.undoDLen + ' top=' + r.topAction);
  // ⌘⇧Z 로 되돌아오나 — 한 걸음의 «뒷면»
  await page.keyboard.press('Meta+Shift+z');
  await page.waitForTimeout(300);
  expect((await secIds(page)).length, '★⌘⇧Z 한 번에 섹션이 돌아온다').toBe(before.length + 1);
  expect((await refRows(page)).length, '★연결도 돌아온다').toBe(1);
});

test('L7 ⑤자리 — 섹션이 «골라져» 있어도 새 섹션은 맨 아래(⛔addSection 기본은 「고른 섹션 다음」이다)', async ({ page }) => {
  const ids = await setup(page);
  await page.evaluate((a) => window.selectSection?.(document.getElementById(a)), ids[0]);
  expect(await page.evaluate((a) => !!document.querySelector('#canvas .section-block.selected#' + a), ids[0]), '전제 — 첫 섹션이 골라졌다').toBe(true);
  await clickLinkBtn(page, 'sp_solo', { meta: true });
  const after = await secIds(page);
  expect(after.length, '섹션 ＋1').toBe(3);
  expect(after.slice(0, 2), '★첫 섹션 «다음»에 끼지 않았다').toEqual(ids);
  expect((await refRows(page))[0].id, '★연결은 맨 아래 새 섹션에').toBe(after[2]);
});

test('L8 ③빈 섹션·기본 높이 — 글자 블럭 0 · gap 둘 · 높이가 스크래치 길이와 «무관»', async ({ page }) => {
  await setup(page);
  const before = await secIds(page);
  // 스크래치를 «길게» 키운다 — 높이를 거기에 맞추면 이 검사가 빨개진다
  await page.evaluate(() => { const el = document.querySelector('.scratch-item[data-scratch-id="sp_solo"]'); el.style.width = '400px'; });
  await clickLinkBtn(page, 'sp_solo', { meta: true });
  /* ★자기 전제를 단언한다 — ⛔없으면 이 검사가 «장면 섹션»을 재고 초록이 된다(실측: ⌘ 분기를 무력화한
     변이 M1·M2 에서 L8 만 초록이었다 — 장면 섹션도 skipDefaultBlock 꼴이라 글자 0·gap 둘이 그대로 맞았다). */
  const after = await secIds(page);
  expect(after.length - before.length, '전제 — 새 섹션이 생겼다(＋1)').toBe(1);
  const got = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')];
    const s = secs[secs.length - 1];
    const sc = document.querySelector('.scratch-item[data-scratch-id="sp_solo"]').getBoundingClientRect();
    return { text: s.querySelectorAll('.text-block').length, gaps: s.querySelectorAll('.gap-block').length,
             gapH: [...s.querySelectorAll('.gap-block')].map(g => Math.round(g.getBoundingClientRect().height / (window.currentZoom / 100))),
             scratchH: Math.round(sc.height) };
  });
  expect(got.text, '★빈 섹션 — 글자 블럭 0개').toBe(0);
  expect(got.gaps, 'gap 둘(기본)').toBe(2);
  expect(got.gapH, '★기본 높이 100+100 — 스크래치 길이(' + got.scratchH + ') 와 무관').toEqual([100, 100]);
});

/* ══ 양성대조 명부 — ★실측(2026-10-07 · 이 레인) ═══════════════════════════════════════
 * ⒜ ★핀 판(기준판 dev `2866df63` — 이 일 «전») : 빨강 **7** / 초록 2
 *       mkdir -p /tmp/cmdlink-before && git archive 2866df63 | tar -x -C /tmp/cmdlink-before
 *       GD1001_ROOT=/tmp/cmdlink-before npx playwright test --config=tests/dom/playwright.dom.config.js cmd-link-new-section
 *     빨강 = L0 L3 L4 L5 L6 L7 L8   초록 = **L1 L2**
 *     ⇒ ★L1·L2 는 «지키는 시험»이다 — 옛 판에서도 초록이라야 「②를 안 바꿨다」의 증인이 된다.
 *        ⛔HEAD 를 판으로 쓰지 마라(고친 뒤엔 HEAD 가 곧 고친 판이라 전부 초록이 된다).
 * ⒝ ★변이(이 판에서 한 자리씩 무력화) — 「무엇을 끄면 어느 검사가 빨강인가」:
 *       M1 ⌘ 분기 무력화            → L3 L4 L5 L6 L7 L8  (6)
 *       M2 `fn(e)` → `fn()` (이벤트 안 넘김) → L3 L4 L5 L6 L7 L8  (6 · ★재측정)
 *       M3 pushHistory 노옵 억제 제거 → **L6 만** (1)
 *       M4 afterId(자리 못박기) 제거  → **L7 만** (1)
 *       M5 그룹 번지기 제거           → **L4 만** (1)
 *       M6 skipDefaultBlock 제거      → **L8 만** (1)
 *       M7 끝 표본 제거               → **L6 만** (1)
 *     ⇒ 축마다 «재는 자»가 적어도 하나 있다. 0건인 칸은 아래 ⒞.
 *     ★L8 의 역사 — 첫 측정에서 M1·M2 가 L8 을 ★안 빨갛게 했다. 까닭 = L8 이 «자기 전제»(새 섹션이 생겼다)를
 *       안 단언해 «장면 섹션»을 재고 있었다(장면 섹션도 skipDefaultBlock 꼴이라 글자 0·gap 둘이 그대로 맞았다).
 *       ⇒ 전제를 더한 뒤 M1·M2 ★둘 다 다시 쟀고 둘 다 6칸이다. ⛔「같은 꼴이니 같을 것」으로 적지 않았다.
 * ⒞ ⛔양성대조 0건인 자리(=이 파일이 «안 재는» 것) — 이름으로 남긴다:
 *     · 새 섹션을 «id 차집합»으로 집는 것 vs `sections[length-1]` — afterId 가 늘 맨 아래를 주므로 두 꼴이
 *       같은 답을 낸다 ⇒ ★어느 검사도 안 가른다(굳히기일 뿐 잰 것이 아니다).
 *     · ghost 섹션([data-ghost])을 afterId 명부에서 뺀 것 — 이 장면엔 ghost 가 없다 ⇒ 0건.
 *     · 이미 «다른 섹션에» 연결된 그룹 멤버가 끌려와 «옮겨지는» 갈래 — 0건(미측정).
 *     · 섹션이 «0개»인 캔버스에서의 ⌘＋🔗 — 0건(미측정).
 */
