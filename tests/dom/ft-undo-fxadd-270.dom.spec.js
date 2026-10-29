/* ft-undo-fxadd-270.dom.spec.js — 270(지디 261029 14:59 처방 꼴 ㈏ · 조건 ⑴⑵): 효과를 켠 뒤 ⌘Z 한 번 = «켜기 전 그대로».
 *   병(S6 앱 실측 ×3 · 칸 원문 ×3): 효과 켤 때 이력 칸(push-before)에 ftMeasure :271 의 글칸 style.width(339px)가 «효과 없이» 찍혀
 *     ⌘Z 로 그 칸에 내리면 효과는 빠지고 글칸 폭만 좁게 남았다.
 *   U1 ⑴ 거울 — 켜기 → ⌘Z 한 번 ⇒ 효과 키 없음 ∧ 글칸 박은 폭 없음 ∧ 글칸 화면 폭 = 켜기 전(push 순서를 바꾸니 가장 먼저 깨질 자리).
 *   U2 ⑵ 칸 바이트 — 켠 직후 «꼭대기 칸»(켤 때 push-before · action «효과») 문자열의 그 글상자 .tb-body 에 width 가 없다(고치기 전 = 339px).
 *     칸 읽기 = CDP Runtime.getProperties 로 window.getHistoryTip 의 [[Scopes]] → 모듈 let historyStack(읽기만 · S6 p114snap 꼴).
 *   ⚠️배율 전제: waitZoomSettled(100).
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    sec.querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
    window.selectSection(sec);
    window.addTextBlock('body');
    window.applyZoom?.(100);
    window.__tb = sec.querySelector('.text-block'); window.__tbId = window.__tb.id;
    window.__tb.scrollIntoView({ block: 'center' });
    window.selectBlock(window.__tb.id);
  });
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => !!document.getElementById('txt-fx-add'));
  return errs;
}
const read = (page) => page.evaluate(() => {
  const tb = window.__tb; const ce = tb.querySelector('.tb-body') || tb.querySelector('[contenteditable]');
  return { corners: tb.dataset.tfCorners ?? null, ceW: ce.style.width || '', ceRectW: ce.getBoundingClientRect().width };
});
async function addFt(page) {
  await page.selectOption('#txt-fx-add', 'freetransform');
  await page.waitForFunction(() => !!window.__tb.dataset.tfCorners);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test('U1 ★⑴ 거울 — 효과 켜기 → ⌘Z 한 번 = 켜기 전 그대로(270 · 고치기 전 판 빨강)', async ({ page }) => {
  const errs = await setup(page);
  const before = await read(page);
  expect(before.corners, '전제: 켜기 전에 효과 키가 있다').toBeNull();
  await addFt(page);
  const on = await read(page);
  expect(on.corners, '전제: 효과가 켜지지 않았다').not.toBeNull();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => { window.__tb = document.getElementById(window.__tbId); });   /* 되살림 = 같은 id 의 새 요소 */
  const after = await read(page);
  expect(after.corners, '⌘Z 뒤 효과 키가 남았다').toBeNull();
  expect(after.ceW, `★⌘Z 뒤 글칸 박은 폭이 남았다(${after.ceW}) — 효과는 빠지고 폭만 좁게(270)`).toBe('');
  expect(Math.abs(after.ceRectW - before.ceRectW), `★⌘Z 뒤 글칸 화면 폭 ${after.ceRectW} ≠ 켜기 전 ${before.ceRectW}`).toBeLessThan(0.5);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('U2 ★⑵ 칸 바이트 — 켤 때 push-before 칸의 글칸에 박은 폭이 없다(고치기 전 = 339px)', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => window.__tb.id);
  await addFt(page);
  const cdp = await page.context().newCDPSession(page);
  const fn = await cdp.send('Runtime.evaluate', { expression: 'window.getHistoryTip' });
  const pr = await cdp.send('Runtime.getProperties', { objectId: fn.result.objectId, ownProperties: false });
  const sc = (pr.internalProperties || []).find((p) => p.name === '[[Scopes]]');
  expect(sc, '전제: [[Scopes]] 를 못 읽는다').toBeTruthy();
  const scopes = await cdp.send('Runtime.getProperties', { objectId: sc.value.objectId, ownProperties: true });
  let slot = null;
  for (const s of scopes.result) {
    if (!s.value?.objectId) continue;
    const vars = await cdp.send('Runtime.getProperties', { objectId: s.value.objectId, ownProperties: true });
    const hs = vars.result.find((v) => v.name === 'historyStack'); const hp = vars.result.find((v) => v.name === 'historyPos');
    if (!hs?.value?.objectId) continue;
    const r = await cdp.send('Runtime.callFunctionOn', { objectId: hs.value.objectId, returnByValue: true, arguments: [{ value: hp.value.value }, { value: id }],
      functionDeclaration: `function (pos, id) { const e = this[pos];   /* push-before = 켤 때 칸이 «꼭대기» 다(첫 판은 pos-1 = 텍스트 추가 칸을 읽어 고치기 전 판에서도 초록 · 시험 흠) */ const c = e && typeof e.canvas === 'string' ? e.canvas : '';
        const k = c.indexOf('id="' + id + '"'); if (k < 0) return { pos, has: false, action: e && e.action };
        const s = c.lastIndexOf('<', k); const tbTag = c.slice(s, c.indexOf('>', k) + 1);
        const m = c.slice(k, k + 3000).match(/<div[^>]*class="[^"]*tb-body[^"]*"[^>]*>/);
        return { pos, has: true, action: e.action, tbTag, bodyTag: m ? m[0] : null }; }` });
    slot = r.result.value; break;
  }
  expect(slot, '전제: historyStack 을 못 찾았다').toBeTruthy();
  expect(slot.has, `전제: 켤 때 칸에 그 글상자가 없다(${JSON.stringify(slot)})`).toBe(true);
  expect(slot.action, `전제: 꼭대기 칸이 «효과» 칸이 아니다(${slot.action})`).toBe('효과');
  expect(slot.tbTag, '전제: 켤 때 칸에 벌써 효과 키가 있다(push-before 가 아니다)').not.toMatch(/data-tf-corners/);
  expect(slot.bodyTag, '전제: 칸에서 .tb-body 를 못 찾았다').toBeTruthy();
  expect(slot.bodyTag, `★켤 때 칸의 글칸에 박은 폭이 찍혔다 — ${slot.bodyTag}`).not.toMatch(/width\s*:/);
  expect(errs, `앱 오류: ${errs.join(' | ')}`).toEqual([]);
});
