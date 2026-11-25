/* undo-check-push-after — 체크박스 패널 칸(prop-zoom.js bindCheck)이 «바꾼 뒤» 찍는가 (0.9.14 80행 UNDO-CHECK-PUSH-BEFORE-01)
 *
 * ★병(미카사 0913-d 실앱 ⑥ · 탑 probe A/B 261124): bindCheck 가 «찍고 나서» 바꿨다(push-before).
 *   앞 칸이 push-after 면 그 찍기는 꼭대기와 같은 상태라 js/history.js 무변화 차단에 먹힌다 ⇒ 켬이 자기 칸을 못 갖는다.
 *   예: 줌 «테두리 켬 → 굵기 14 → ⌘Z» 한 번에 off/6 까지 간다(켬까지 같이 사라짐).
 * ★재는 것 — bindCheck 를 쓰는 «세 자리 전부»(zm-bd-on · zm-shadow-on · zm-tx-on):
 *   U1 켬 → 다른 칸 바꿈 → ⌘Z = 다른 칸만 되돌림(켬은 남음) → ⌘Z 한 번 더 = 끔
 *   U2 켬이 «마지막 동작»일 때 ⌘Z 한 걸음(_history-step: 끝 표본 · 구제 없음 · 되돌림)
 *   C0 대조 — 같은 블럭 숫자 칸(bindPair · 이미 push-after)은 U2 와 같은 잣대로 초록이어야 한다(잣대가 이 장면에서 도는지)
 * 빨강 기대: 8f184e346(고치기 전) = U1·U2 셋 다 빨강 · C0 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const fillChange = (page, sel, v) => page.evaluate(([sel, v]) => { const n = document.querySelector(sel); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec);
    window.addZoomBlock(); const b = sec.querySelector('.zoom-block'); b.id = b.id || 'zmU';
    window.deselectAll(); window.selectBlock?.(b.id); window.showZoomProperties?.(b); window.clearHistory?.();
    return b.id;
  });
  await page.waitForSelector('#zm-bd-on', { state: 'attached' });
  return { errs, id };
}
const ds = (page, id, keys) => page.evaluate(([id, keys]) => { const b = document.getElementById(id); return keys.map((k) => b.dataset[k] ?? null); }, [id, keys]);
const undo = async (page) => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page); };

/* [체크 id, 저장 키, 뒤따르는 칸(push-after 숫자 칸), 그 칸 저장 키, 넣을 값] */
const CASES = [
  ['zm-bd-on',     'bd',     '#zm-bdw-num',  'bdw',   '14'],   // 티켓 예 그대로
  ['zm-shadow-on', 'shadow', '#zm-maxop-num', 'maxop', '37'],
  ['zm-tx-on',     'tx',     '#zm-txs-num',  'txs',   '41'],
];

for (const [chk, key, field, fkey, val] of CASES) {
  test(`U1 ${chk} — 켬 → ${fkey} ${val} → ⌘Z = ${fkey} 만 되돌림(켬 남음) → ⌘Z = 끔`, async ({ page }) => {
    const { errs, id } = await scene(page);
    const s0 = await ds(page, id, [key, fkey]);
    await page.check('#' + chk); await raf(page);
    const s1 = await ds(page, id, [key, fkey]);
    await page.waitForSelector(field, { state: 'attached' });
    await fillChange(page, field, val); await raf(page);
    const s2 = await ds(page, id, [key, fkey]);
    await undo(page);
    const u1 = await ds(page, id, [key, fkey]);
    await undo(page);
    const u2 = await ds(page, id, [key, fkey]);
    console.log(`[U1 ${chk} 실측]`, JSON.stringify({ s0, s1, s2, u1, u2 }));
    expect(s0[0] === 'on', '★전제 — 새 블럭은 꺼진 채 시작').toBe(false);
    expect(s2, '★전제 — 켬 + 값 들어감').toEqual(['on', val]);
    expect(u1, `★⌘Z 한 번 = ${fkey} 만 되돌림 · 켬은 남는다(push-before 면 끔까지 같이 간다)`).toEqual(['on', s1[1]]);
    expect(u2, '★⌘Z 두 번 = 켜기 전').toEqual(s0);
    expect(errs, errs.join(' | ')).toEqual([]);
  });

  test(`U2 ${chk} — 켬이 마지막 동작 · ⌘Z 한 걸음(끝 표본)`, async ({ page }) => {
    const { errs } = await scene(page);
    await fillChange(page, '#zm-curve-num', '120'); await raf(page);   // 앞 칸 = push-after 편집(병이 서는 조건)
    await expectOneUndoStep(page, async () => { await page.check('#' + chk); }, `${chk} 켬`);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('C0 대조 — 숫자 칸(bindPair · push-after)은 같은 잣대로 초록', async ({ page }) => {
  const { errs } = await scene(page);
  await fillChange(page, '#zm-curve-num', '120'); await raf(page);
  await expectOneUndoStep(page, async () => { await fillChange(page, '#zm-maxop-num', '37'); }, 'maxop 숫자 칸');
  expect(errs, errs.join(' | ')).toEqual([]);
});
