/* ft-box-hugs-glyph.dom.spec.js — 119 FT-BOX-RESERVES-ALIGN-GUTTER-01 ㉡ 「자유변형 상자가 가운데 정렬 들여쓰기를 폭으로 삼지 않게 · 글자를 딱 감싼다」
 *
 * ★현빈 확정 ㉡(저장본 영향 감수 · 지디 발주 (31)).
 * ★잰 값(S3 실앱 8608bb13 ×3 · h1 「짧은 글」 가운데 정렬 → 패널 「자유변형」): 글자 285.51 · 상자 501 · 글자 좌우 빈 띠 107.75 / 107.75.
 *   (27) 134 실측: 다시 열면 상자 폭 527.17 → 432.62 (재는 폭이 바뀌어 들여쓰기 OX 가 달라짐 — 같은 뿌리).
 * ★처방 — js/effects-freetransform.js ftMeasure: 줄바꿈은 «재는 폭»에서 정한 채 글자칸 폭을 글자 폭으로 박고 OX 를 다시 잰다.
 *
 * ★칸
 *   P  전제 — 가운데 정렬 글상자에 자유변형이 켜졌다(네 점 있음)
 *   B1 가운데 정렬 ⇒ 글자와 상자 좌·우 빈 띠 ≤ 1px
 *   B2 (지키는 칸) 왼쪽 정렬도 ≤ 1px
 *   B3 저장→다시 열기(getSerializedCanvas → innerHTML → rebindAll) 뒤 상자 폭이 같다(±0.5) · 빈 띠 ≤ 1px
 *   B4 두 줄(가운데) ⇒ 줄 수 그대로 · 가장 긴 줄 기준 빈 띠 ≤ 1px
 *   B5 ✕(효과 끄기) ⇒ 글자칸 인라인 폭이 비고(켜기 전 바이트) 상자 폭도 빈다
 * ⛔고정 대기 0 — 조건 대기만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page, { center = true, text = '짧은 글' } = {}) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (text) => {
    await window.addSection();
    window.addTextBlock('h1');
    const sec = [...document.querySelectorAll('#canvas .section-block')].pop();
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1');
    ce.innerHTML = text;
    window.deselectAll?.();
    return tb.id;
  }, text);
  const r = await waitStableRect(page, '#' + id);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForFunction((id) => document.getElementById(id)?.classList.contains('selected') && !!document.querySelector('#panel-right .prop-align-btn[data-align="center"]'), id, { timeout: 3000 });
  if (center) {
    await page.click('#panel-right .prop-align-btn[data-align="center"]');
    await page.waitForFunction((id) => (document.getElementById(id).querySelector('[contenteditable]') || document.getElementById(id).querySelector('.tb-h1')).style.textAlign === 'center', id, { timeout: 3000 });
  }
  const sel = await page.evaluate(() => document.querySelector('#panel-right select[id$="-fx-add"]')?.id || null);
  expect(sel, 'P 전제: 효과 추가 목록').not.toBeNull();
  await page.selectOption('#' + sel, 'freetransform');
  await page.waitForFunction((id) => !!document.getElementById(id).dataset.tfCorners, id, { timeout: 3000 });
  return { errs, id };
}

/** 글자(가장 긴 줄 포함 글자 묶음)와 상자(.text-block)의 좌·우 빈 띠 — 레이아웃 px */
const M = (page, id) => page.evaluate((id) => {
  const tb = document.getElementById(id);
  const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-h1');
  const z = tb.getBoundingClientRect().width / tb.offsetWidth || 1;
  const rg = document.createRange(); rg.selectNodeContents(ce);
  const g = rg.getBoundingClientRect(), t = tb.getBoundingClientRect();
  const lines = new Set([...rg.getClientRects()].map((q) => Math.round(q.top))).size;
  return { left: (g.left - t.left) / z, right: (t.right - g.right) / z, boxW: t.width / z, lines, ceW: ce.style.width, tbW: tb.style.width };
}, id);

test('P·B1 ★가운데 정렬 — 상자가 글자를 감싼다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const m = await M(page, id);
  expect(m.left, `B1 왼쪽 빈 띠 ${m.left}`).toBeLessThanOrEqual(1);
  expect(m.right, `B1 오른쪽 빈 띠 ${m.right}`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('B2 왼쪽 정렬도 감싼다(지키는 칸)', async ({ page }) => {
  const { errs, id } = await setup(page, { center: false });
  const m = await M(page, id);
  expect(m.left, `B2 왼쪽 빈 띠 ${m.left}`).toBeLessThanOrEqual(1);
  expect(m.right, `B2 오른쪽 빈 띠 ${m.right}`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('B3 ★저장→다시 열기 뒤 상자 폭이 같다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const m0 = await M(page, id);
  await page.evaluate(() => { const h = window.getSerializedCanvas(); document.getElementById('canvas').innerHTML = h; window.rebindAll?.(); });
  await page.waitForFunction((id) => { const tb = document.getElementById(id); return !!tb && !!tb.style.width; }, id, { timeout: 3000 });
  await waitStableRect(page, '#' + id);
  const m1 = await M(page, id);
  expect(Math.abs(m1.boxW - m0.boxW), `B3 상자 폭 ${m0.boxW} → ${m1.boxW}`).toBeLessThanOrEqual(0.5);
  expect(m1.left, `B3 왼쪽 빈 띠 ${m1.left}`).toBeLessThanOrEqual(1);
  expect(m1.right, `B3 오른쪽 빈 띠 ${m1.right}`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('B4 두 줄 — 줄 수 그대로 · 가장 긴 줄 기준으로 감싼다', async ({ page }) => {
  const { errs, id } = await setup(page, { text: '첫째 줄은 조금 길게<br>둘째' });
  const m = await M(page, id);
  expect(m.lines, 'B4 줄 수').toBe(2);
  expect(m.left, `B4 왼쪽 빈 띠 ${m.left}`).toBeLessThanOrEqual(1);
  expect(m.right, `B4 오른쪽 빈 띠 ${m.right}`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('B5 ✕ — 글자칸 폭이 비고 상자 폭도 빈다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await page.waitForFunction(() => !!document.querySelector('#panel-right [id$="-fxft-del"]'), null, { timeout: 3000 });
  await page.click('#panel-right [id$="-fxft-del"]');
  await page.waitForFunction((id) => !document.getElementById(id).dataset.tfCorners, id, { timeout: 3000 });
  const m = await M(page, id);
  expect([m.ceW, m.tbW], 'B5 인라인 폭 둘 다 빈 값').toEqual(['', '']);
  expect(errs).toEqual([]);
});
