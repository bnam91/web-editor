/* fix5-t419-group-rclick.dom.spec.js — t4-19 ㉯ 그룹 진입 중 멤버 우클릭 「그룹에서 빼기」·「삭제」
 *
 * 현빈 원문(t4-19): 「스크래치패드 그룹의 경우 더블 클릭하면 스크래치패드 그룹안에 진입이 가능해져서
 *   해당 그룹안에서의 스크래치패드 순서나 특정 스크래치 패드 삭제가능하게해줘.」
 * 현빈 261026: 「뺄수도 있고, 삭제를 하면 바로」 ⇒ 빼기(Delete·⊘) 유지 + 삭제 입구(우클릭) 둘 다.
 *
 * 지디 처방: 입구 = 기존 스크래치 우클릭 메뉴(「자산 폴더로 보내기」)에 «진입 중 그 그룹 멤버일 때만» 두 항목.
 *   「그룹에서 빼기」 = 진입 중 Delete 와 같은 길 · 「삭제」 = 확인 묻기 없이 그 한 장 · ⌘Z 한 번에 복구.
 *   ⛔⌘Delete 별칭 없음 · ⛔레이어 패널 무접촉 · ㉮ Delete 키(빼기)는 한 글자도 안 바뀐다(R6 이 잠근다).
 *
 * 판: 98f30b11 + 128 F1 ①② 위에 «판 맞춰» 다시 걸었다(ea371cde 판 사본을 통째로 옮기지 않음).
 *   「1장 남으면 풀기」는 규칙 한 벌 `_dissolveLoneGroup` 안에서 keepLone 인자로만 갈린다(⛔세 번째 사본 없음).
 * 지디 ㉱ ⑷ 「삭제 = 바로 삭제」를 만든다 · ⑶ 「삭제(Delete 키) = 그룹 밖으로 빼기」는 이미 ✅(R6 이 무접촉 잠금).
 *
 * ★㉱ 세 가지는 «레퍼런스에 근거 없음(지디 결정)» — research-t419/REFERENCE-group-ops.md 3장 ⑹⑺ 에 공식 문구 없음:
 *   ① 「삭제」 뒤 그룹 자식 0개 ⇒ 그룹 없앰(+ 진입 모드 나감)   — R5
 *   ② 「삭제」 뒤 그룹 자식 1개 ⇒ 그룹 유지(⚠️✕·⌘X·모드 밖 Delete 의 «1장 남으면 풀기»와 다르다) — R4
 *   ③ ⌘Z 한 번 ⇒ 그룹 소속·전체 수·순서 셋이 전과 같다(빼기·삭제 둘 다) — R2·R3·R4·R5
 *
 * ★사람 길로만 누른다 — 진입 = page.mouse.dblclick · 메뉴 = page.mouse 우클릭 · 항목 = 실제 클릭 · ⌘Z = 키.
 * ★고정 대기 0 — 전부 waitForFunction(조건)으로 기다린다.
 * ★양성대조·변이 실측은 파일 끝 주석.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const T = { timeout: 15000 };

/* 장면 — 그룹1 = sp_a·sp_b·sp_c · 그룹 밖 sp_z · 그룹2 = sp_p·sp_q (6장) */
const LAYOUT = [['sp_a', 40, 60], ['sp_b', 200, 60], ['sp_c', 360, 60], ['sp_z', 40, 260], ['sp_p', 200, 260], ['sp_q', 360, 260]];

/* 화면 가운데 좌표 — ★자리가 멎고(연속 두 번 같은 값) 그 점을 그 장이 받을 때만 돌려준다.
   ⛔한 번 재고 바로 누르면 뒤늦은 스크롤·연결 막대(🔗)에 빗맞는다(실측 깜빡임: 잰 x 749 → 실제 832). */
async function center(page, id) {
  await page.evaluate((s) => { window.__spPrev = null; document.querySelector('.scratch-item[data-scratch-id="' + s + '"]')
    .scrollIntoView({ block: 'center', inline: 'center' }); }, id);
  const h = await page.waitForFunction((s) => {
    const el = document.querySelector('.scratch-item[data-scratch-id="' + s + '"]');
    const r = el.getBoundingClientRect();
    const c = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    const key = Math.round(c.x) + ',' + Math.round(c.y);
    const same = window.__spPrev === key; window.__spPrev = key;
    return same && el.contains(document.elementFromPoint(c.x, c.y)) ? c : false;
  }, id, T);
  return h.jsonValue();
}
/* ★장면 세우기 깜빡임 손질 — 옛 판은 «그 장이 골라졌나» 하나만 보고 넘어갔다.
   ⇒ 클릭 하나가 빗맞아(⇧ 가 풀린 채 눌림 등) 선택이 «바뀌어도» 다음 줄로 가서, 묶기가 엉뚱한 묶음을 만들 수 있었다.
   ⇒ 지금은 클릭마다 «고른 집합 == 지금까지의 ids» 를 통째로 기다리고, 태스크 한 바퀴 양보한 뒤 다음 손(⇧ 상태가 섞이지 않게). */
async function selectIds(page, ids, ms = T.timeout) {
  await page.mouse.click(300, 900);
  await page.waitForFunction(() => !document.querySelector('.scratch-item.scratch-selected'), null, T);
  await yieldTask(page);
  const selIs = (want) => page.waitForFunction((w) => [...document.querySelectorAll('.scratch-item.scratch-selected')]
    .map((e) => e.dataset.scratchId).sort().join() === w, [...want].sort().join(), { timeout: ms });
  for (let i = 0; i < ids.length; i++) {
    const c = await center(page, ids[i]);
    if (i > 0) await page.keyboard.down('Shift');
    await page.mouse.click(c.x, c.y);
    if (i > 0) await page.keyboard.up('Shift');
    await selIs(ids.slice(0, i + 1));
    await yieldTask(page);
  }
}
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(async ({ px, lay }) => {
    window.applyZoom?.(100);
    const base = 1150;   // 캔버스 오른쪽 여백(scratch-group-mode 장면과 같은 자리)
    for (const [id, x, y] of lay) await window._scratchAddAndSave(px, base + x, y, 140, undefined, id);
  }, { px: PX, lay: LAYOUT });
  await page.waitForFunction((n) => document.querySelectorAll('.scratch-item').length === n, LAYOUT.length, T);
  /* 그림이 다 앉은 뒤(높이 140)에 가운데를 누른다 — 덜 앉으면 «가운데»가 위 가장자리(✕·ID 칩)로 쏠린다(실측 깜빡임) */
  await page.waitForFunction(() => [...document.querySelectorAll('.scratch-item')].every((e) => {
    const im = e.querySelector('img'); return im && im.complete && im.naturalWidth > 0 && e.offsetHeight >= 100; }), null, T);
  for (const ids of [['sp_a', 'sp_b', 'sp_c'], ['sp_p', 'sp_q']]) {
    /* ★장면 세우기만 세 번까지 다시 고른다(⇧클릭이 부하 14~21 에서 빗맞음 · fixC1 R4 실측) — 시험 단언은 다시 안 돈다(retries=0 그대로).
       고르기가 끝내 안 맞으면 마지막 시도의 시간초과가 그대로 빨강이 된다. */
    for (let k = 0; ; k++) {
      try { await selectIds(page, ids, k < 2 ? 5000 : T.timeout); break; } catch (e) { if (k >= 2) throw e; }
    }
    const r = await page.evaluate(() => window._scratchGroupAndAlign?.());
    expect(r && r.ok, '★진짜 묶는 길(⌘G 본체)로 묶였다').toBe(true);
  }
  await page.mouse.click(300, 900);
  await page.waitForFunction(() => !document.querySelector('.scratch-item.scratch-selected'), null, T);
  const s = await st(page);
  expect(s.order, '전제 — 6장 · DOM 순서').toEqual(LAYOUT.map((l) => l[0]));
  expect(s.g.sp_a && s.g.sp_a === s.g.sp_b && s.g.sp_b === s.g.sp_c, '전제 — 그룹1').toBe(true);
  expect(s.g.sp_p && s.g.sp_p === s.g.sp_q && s.g.sp_p !== s.g.sp_a, '전제 — 그룹2(다른 id)').toBe(true);
  expect(s.g.sp_z, '전제 — sp_z 는 그룹 밖').toBeNull();
  return s;
}
const st = (page) => page.evaluate(() => {
  const els = [...document.querySelectorAll('.scratch-item')];
  return {
    order: els.map((e) => e.dataset.scratchId),
    g: Object.fromEntries(els.map((e) => [e.dataset.scratchId, e.dataset.scratchGroup ?? null])),
    mode: window._scratchGroupMode?.() ?? null,
  };
});
/* ★자 = 「그룹 소속·전체 수·순서 셋이 전과 같다」 */
function sameThree(a, b, why) {
  expect(a.order.length, why + ' — 전체 수').toBe(b.order.length);
  expect(a.order, why + ' — 순서').toEqual(b.order);
  expect(a.g, why + ' — 그룹 소속').toEqual(b.g);
}
async function enter(page, id) {
  const c = await center(page, id);
  await page.mouse.dblclick(c.x, c.y);
  await page.waitForFunction((s) => window._scratchGroupMode?.() != null
    && window._scratchGroupMode() === document.querySelector('.scratch-item[data-scratch-id="' + s + '"]').dataset.scratchGroup
    && document.querySelectorAll('.scratch-item.scratch-selected').length === 1, id, T);
  await yieldTask(page);   // 진입이 setTimeout(0) 로 거는 «밖 클릭» 듣개가 걸린 뒤에 다음 손
}
/* ★고정 대기 아님 — 태스크 한 바퀴 양보. 앱이 setTimeout(0) 로 거는 듣개(메뉴 «밖 클릭 닫기» · 모드 «밖 클릭 나가기»)는
   같은 0ms 줄에 먼저 서 있으므로 이 한 바퀴 뒤엔 반드시 걸려 있다. ⛔안 하면 CDP 입력이 그 타이머를 앞질러 메뉴가 안 닫힌다(실측). */
const yieldTask = (page) => page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
/* 우클릭 → 메뉴가 뜰 때까지 → 두 항목 글자 목록 */
async function rclick(page, id) {
  await page.evaluate(() => document.querySelectorAll('.scratch-send-menu').forEach((m) => m.remove()));   // 앞 메뉴가 이웃 장을 덮는다(실측)
  const c = await center(page, id);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.waitForFunction(() => !!document.querySelector('.scratch-send-menu'), null, T);
  await yieldTask(page);
  return page.evaluate(() => [...document.querySelectorAll('.scratch-send-menu [data-scratch-group-act]')]
    .map((b) => b.dataset.scratchGroupAct + ':' + b.textContent));
}
async function pick(page, act) {
  await page.locator('.scratch-send-menu [data-scratch-group-act="' + act + '"]').click();
  await page.waitForFunction(() => !document.querySelector('.scratch-send-menu'), null, T);
}
async function undo(page, until) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(until.fn, until.arg, T);
}
const hasN = { fn: (n) => document.querySelectorAll('.scratch-item').length === n };
const orderIs = { fn: (o) => [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId).join() === o };

test('R1 ★진입 중 그 그룹 멤버 우클릭 → 「그룹에서 빼기」·「삭제」 두 항목(진입한 장 · 다른 멤버 둘 다)', async ({ page }) => {
  await scene(page);
  await enter(page, 'sp_c');
  const onOther = await rclick(page, 'sp_a');
  console.log('[R1] 다른 멤버 ' + JSON.stringify(onOther));
  expect(onOther, '★다른 멤버 우클릭 — 두 항목').toEqual(['detach:그룹에서 빼기', 'delete:삭제']);
  expect((await st(page)).mode, '★우클릭으로 모드가 안 내려간다').toBeTruthy();
  const onSelf = await rclick(page, 'sp_c');
  expect(onSelf, '★진입한 장 우클릭 — 두 항목').toEqual(['detach:그룹에서 빼기', 'delete:삭제']);
  expect(await page.locator('.scratch-send-menu').getByText('자산 폴더로 보내기').count(), '★기존 메뉴에 더했다(새 메뉴 ⛔)').toBe(1);
});

test('R2 ★「삭제」 = 확인 없이 그 한 장 바로 지움 · ⌘Z 한 번 = 소속·전체 수·순서 복구', async ({ page }) => {
  const before = await scene(page);
  let dialogs = 0; page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await enter(page, 'sp_c');
  await rclick(page, 'sp_b');
  await pick(page, 'delete');
  await page.waitForFunction(() => !document.querySelector('.scratch-item[data-scratch-id="sp_b"]'), null, T);
  const a = await st(page);
  console.log('[R2] 후 ' + JSON.stringify(a));
  expect(dialogs, '★확인 묻기 0').toBe(0);
  expect(a.order, '★sp_b 만 사라졌다 — 6 → 5').toEqual(['sp_a', 'sp_c', 'sp_z', 'sp_p', 'sp_q']);
  expect(a.g.sp_a && a.g.sp_a === a.g.sp_c && a.g.sp_a === before.g.sp_a, '★남은 둘은 같은 그룹 그대로').toBe(true);
  expect(a.mode, '★모드 유지(이어서 지울 수 있다)').toBe(before.g.sp_a);
  await undo(page, { ...hasN, arg: 6 });
  await page.waitForFunction(orderIs.fn, before.order.join(), T);
  sameThree(await st(page), before, '★⌘Z 1');
});

test('R3 ★「그룹에서 빼기」 = 진입 중 Delete 와 같은 결과 · ⌘Z 한 번 복구', async ({ page }) => {
  const before = await scene(page);
  await enter(page, 'sp_c');
  await rclick(page, 'sp_b');
  await pick(page, 'detach');
  await page.waitForFunction(() => document.querySelector('.scratch-item[data-scratch-id="sp_b"]').dataset.scratchGroup == null, null, T);
  const viaMenu = await st(page);
  await undo(page, { fn: (g) => document.querySelector('.scratch-item[data-scratch-id="sp_b"]').dataset.scratchGroup === g, arg: before.g.sp_b });
  sameThree(await st(page), before, '★빼기 ⌘Z 1');
  /* 같은 일을 Delete 로 — 진입 → sp_b 클릭(단독 선택) → Delete */
  await enter(page, 'sp_c');
  const c = await center(page, 'sp_b');
  await page.mouse.click(c.x, c.y);
  await page.waitForFunction(() => [...document.querySelectorAll('.scratch-item.scratch-selected')].map((e) => e.dataset.scratchId).join() === 'sp_b', null, T);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => document.querySelector('.scratch-item[data-scratch-id="sp_b"]').dataset.scratchGroup == null, null, T);
  const viaKey = await st(page);
  console.log('[R3] 메뉴 ' + JSON.stringify(viaMenu) + ' / 키 ' + JSON.stringify(viaKey));
  sameThree(viaMenu, viaKey, '★메뉴 빼기 = Delete 빼기');
  expect(viaMenu.order.length, '★지우지 않는다 — 6장').toBe(6);
});

test('R4 ㉱ 「삭제」 뒤 자식 1개 ⇒ 그룹 유지(지디 결정) · ⌘Z 한 번 복구', async ({ page }) => {
  const before = await scene(page);
  await enter(page, 'sp_p');
  await rclick(page, 'sp_q');
  await pick(page, 'delete');
  await page.waitForFunction(() => !document.querySelector('.scratch-item[data-scratch-id="sp_q"]'), null, T);
  const a = await st(page);
  console.log('[R4] ' + JSON.stringify(a));
  expect(a.g.sp_p, '★★남은 1장이 그룹을 그대로 쥔다(⚠️✕·⌘X 길은 여기서 푼다)').toBe(before.g.sp_p);
  expect(a.mode, '★모드도 그대로').toBe(before.g.sp_p);
  await undo(page, { ...hasN, arg: 6 });
  await page.waitForFunction(orderIs.fn, before.order.join(), T);
  sameThree(await st(page), before, '★⌘Z 1');
});

test('R5 ㉱ 「삭제」 뒤 자식 0개 ⇒ 그룹 없앰 + 모드 나감 · ⌘Z 한 번 = 직전(1장 그룹) 복구', async ({ page }) => {
  const before = await scene(page);
  await enter(page, 'sp_p');
  await rclick(page, 'sp_q');
  await pick(page, 'delete');
  await page.waitForFunction(() => !document.querySelector('.scratch-item[data-scratch-id="sp_q"]'), null, T);
  const mid = await st(page);
  await rclick(page, 'sp_p');
  await pick(page, 'delete');
  await page.waitForFunction(() => !document.querySelector('.scratch-item[data-scratch-id="sp_p"]'), null, T);
  const a = await st(page);
  console.log('[R5] ' + JSON.stringify(a));
  expect(Object.values(a.g).filter((g) => g === before.g.sp_p).length, '★★그룹2 를 쥔 장 0 — 그룹 없음').toBe(0);
  expect(a.mode, '★모드 나감').toBeNull();
  expect(a.order.length, '6 → 4').toBe(4);
  await undo(page, { ...hasN, arg: 5 });
  await page.waitForFunction(orderIs.fn, mid.order.join(), T);
  sameThree(await st(page), mid, '★⌘Z 1 — 1장 그룹 상태로');
  await undo(page, { ...hasN, arg: 6 });
  await page.waitForFunction(orderIs.fn, before.order.join(), T);
  sameThree(await st(page), before, '★⌘Z 2 — 처음 그대로');
});

test('R6 ㉮ 진입 중 Delete 는 그대로 «빼기» — 전체 수 불변 · 그룹 수 −1(무접촉 잠금)', async ({ page }) => {
  const before = await scene(page);
  await enter(page, 'sp_c');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => document.querySelector('.scratch-item[data-scratch-id="sp_c"]').dataset.scratchGroup == null, null, T);
  const a = await st(page);
  const n = (s) => Object.values(s.g).filter((g) => g === before.g.sp_a).length;
  expect(a.order.length, '★전체 수 불변 6').toBe(6);
  expect(n(a), '★그룹1 수 3 → 2').toBe(n(before) - 1);
});

test('R7 음성대조 — 그룹 아닌 장 · 모드 밖 그룹 장 · 다른 그룹 장에는 두 항목이 안 뜬다', async ({ page }) => {
  await scene(page);
  expect(await rclick(page, 'sp_a'), '★모드 밖 그룹 장 — 0').toEqual([]);
  await page.mouse.click(300, 900);
  await enter(page, 'sp_c');
  expect(await rclick(page, 'sp_p'), '★진입 중 다른 그룹 장 — 0').toEqual([]);
  await page.mouse.click(300, 900);
  await enter(page, 'sp_c');
  expect(await rclick(page, 'sp_z'), '★진입 중 그룹 아닌 장 — 0').toEqual([]);
  expect((await st(page)).mode, '★밖 장 우클릭은 모드를 내린다(옛 capture 그대로)').toBeNull();
});

/* ══ 양성대조·변이 (판 98f30b11 + F1 ①② · 실측 수는 보고 S6-FIX5 에) ═══════════════════
 *   양성대조 GD1001_ROOT=<바닥 98f30b11 git archive> : 실측 ×1 R1~R5 빨강(두 항목 0) · R6·R7 초록(옛 동작 그대로가 맞다)
 *   변이 M-DEL  (메뉴의 「삭제」 항목 줄 제거)              : 실측 ×1 R1·R2·R4·R5 빨강
 *   변이 M-KEEP (keepLone 인자를 false 로 · ㉱ 무력화)      : 실측 ×1 R4·R5 빨강(1장 남으면 풀리고 모드도 나간다)
 *   변이 M-ORD  (⌘Z 의 _applyScratchOrder 줄 제거)          : 실측 ×1 R2 빨강(가운데 장 sp_b 가 맨 뒤로)
 *     R4·R5 는 초록이 맞다 — 지우는 장(sp_q·sp_p)이 이미 맨 뒤 쪽이라 맨 뒤에 되살려도 순서가 같다(순서를 잡는 칸은 R2 하나).
 */

/* ★적대 검수(abbc769f) 1 — redo 도 처음 「삭제」와 같은 처분: 2장 그룹에서 「삭제」 → ⌘Z → ⌘⇧Z 뒤에도 남은 1장이 그룹·모드를 쥔다.
   옛(abbc769f): redo 가 `_scratchRemoveById` 를 keepLone 없이 불러 1장 그룹을 풀고 모드도 나갔다. */
test('R8 ㉱ redo — 「삭제」 ⌘Z ⌘⇧Z 뒤 상태 = 처음 「삭제」 직후와 같다(남은 1장 그룹·모드 유지)', async ({ page }) => {
  const before = await scene(page);
  await enter(page, 'sp_p');
  await rclick(page, 'sp_q');
  await pick(page, 'delete');
  await page.waitForFunction(() => !document.querySelector('.scratch-item[data-scratch-id="sp_q"]'), null, T);
  const a = await st(page);
  await undo(page, { ...hasN, arg: 6 });
  await page.waitForFunction(orderIs.fn, before.order.join(), T);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+Shift+z');
  await page.waitForFunction(() => !document.querySelector('.scratch-item[data-scratch-id="sp_q"]'), null, T);
  const r = await st(page);
  console.log('[R8] 삭제 ' + JSON.stringify(a) + ' / redo ' + JSON.stringify(r));
  sameThree(r, a, '★redo = 처음 「삭제」');
  expect(r.mode, '★redo 뒤에도 모드 그대로').toBe(a.mode);
});

/* ★적대 검수 2 — 메뉴가 열린 채 모드가 나가면(Esc) 그 메뉴의 「삭제」는 아무 일도 안 한다(누르는 그때 다시 본다).
   옛(abbc769f): 모드 밖인데 keepLone 으로 지워 1장 그룹이 남았다. */
test('R9 열린 채 남은 메뉴 — Esc 로 모드가 나간 뒤 「삭제」 = 무변(장·소속·순서·이력 칸 그대로)', async ({ page }) => {
  const before = await scene(page);
  await enter(page, 'sp_p');
  const items = await rclick(page, 'sp_q');
  expect(items.length, '전제: 진입 중 두 항목').toBe(2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window._scratchGroupMode?.() == null, null, T);
  const hist0 = await page.evaluate(() => JSON.stringify(window.getHistoryTip?.() ?? null));
  expect(await page.locator('.scratch-send-menu [data-scratch-group-act="delete"]').count(), '전제: 메뉴는 아직 열려 있다').toBe(1);
  await pick(page, 'delete');
  await yieldTask(page);
  const a = await st(page);
  console.log('[R9] ' + JSON.stringify(a));
  sameThree(a, before, '★모드 밖 낡은 메뉴 「삭제」 = 무변');
  expect(await page.evaluate(() => JSON.stringify(window.getHistoryTip?.() ?? null)), '★이력 칸 0').toBe(hist0);
});
