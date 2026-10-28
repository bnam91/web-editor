/* undo-first-edit-selection-228.dom.spec.js — 시트 228(S6 222 곁 관찰 · 지디 «222 와 따로 · 한 쌍»)
 *   증상: 블록을 고른 뒤 «첫» 바꿈(패널 칸 · 바꾼 «뒤» 쌓는 꼴 push-after) → ⌘Z ⇒ 값은 돌아오는데 고름이 풀린다. 일반 블록 공통.
 *   읽은 뿌리(js/history.js): ⌘Z 가 되살리는 고름은 «돌아가는 칸»에 적힌 고름(_restoreSelection(snap.selection))이다 —
 *     첫 바꿈의 돌아가는 칸은 «고르기 전»에 쌓인 칸이라 selection 이 비어 있다. 둘째 바꿈부터는 돌아가는 칸이 고른 채 쌓여 고름이 남는다.
 * 칸(지디 «한 쌍» — 둘 같이)
 *   P1 ★고른 뒤 첫 바꿈(갭 높이 칸) → ⌘Z — 고름·패널(#gap-number)이 남는다
 *   N1 [음성대조] 같은 ⌘Z 뒤 값이 «참으로» 고르기 전 값이다(높이 = 처음 높이 · 꼭대기 = 처음 칸) — 고름을 지키려다 값 되돌림을 깨면 빨강
 *   G1 (지킴) 둘째 바꿈 → ⌘Z — 고름이 남는다(돌아가는 칸이 고른 채 쌓였다 · 고치기 전에도 초록)
 * 고르기 = 갭 실클릭 · 칸 = 실제 입력 + change · ⌘Z = 실제 키. ⛔고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="uS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" id="uG" style="height:80px"></div></div></div>');
    window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.();
    document.getElementById('uS').scrollIntoView({ block: 'center' });
  });
  return errs;
}
const state = (page) => page.evaluate(() => {
  const g = document.getElementById('uG');
  return { h: g ? g.style.height : null, sel: !!(g && g.classList.contains('selected')), panel: !!document.getElementById('gap-number'), tip: window.getHistoryTip?.() };
});
async function pick(page) {
  const r = await waitStableRect(page, '#uG');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(() => state(page).then(s => s.sel && s.panel), '[전제] 갭을 골랐고 패널이 열렸다').toBe(true);
}
async function setH(page, v) {
  await page.fill('#gap-number', String(v));
  await page.dispatchEvent('#gap-number', 'change');
  await expect.poll(() => state(page).then(s => s.h), `[전제] 높이 ${v}`).toBe(v + 'px');
}
async function undo(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
}

test('P1 ★고른 뒤 첫 바꿈 → ⌘Z — 고름·패널이 남는다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  await setH(page, 120);
  await undo(page);
  await expect.poll(() => state(page).then(s => s.h), '[전제] ⌘Z 로 높이가 돌아왔다').toBe('80px');
  const s = await state(page);
  console.log('[P1] ' + JSON.stringify(s));
  expect({ sel: s.sel, panel: s.panel }, `★첫 바꿈 ⌘Z 뒤 고름·패널 ${JSON.stringify(s)}`).toEqual({ sel: true, panel: true });
  expect(errs).toEqual([]);
});

test('N1 [음성대조] 같은 ⌘Z 뒤 값이 참으로 고르기 전 값이다 — 높이 · 꼭대기', async ({ page }) => {
  const errs = await setup(page);
  const tip0 = (await state(page)).tip;
  await pick(page);
  await setH(page, 120);
  await undo(page);
  await expect.poll(() => state(page).then(s => s.h), '⌘Z 로 높이가 처음 값').toBe('80px');
  const s = await state(page);
  console.log('[N1] ' + JSON.stringify({ tip0, s }));
  expect({ pos: s.tip.pos, action: s.tip.action }, '꼭대기 = 고르기 전 처음 칸').toEqual({ pos: tip0.pos, action: tip0.action });
  expect(await page.evaluate(() => document.querySelectorAll('#uS .gap-block').length), '블록 수 그대로').toBe(1);
  expect(errs).toEqual([]);
});

test('G1 (지킴) 둘째 바꿈 → ⌘Z — 고름이 남는다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page);
  await setH(page, 120);
  await setH(page, 160);
  await undo(page);
  await expect.poll(() => state(page).then(s => s.h), '[전제] ⌘Z 로 120').toBe('120px');
  const s = await state(page);
  console.log('[G1] ' + JSON.stringify(s));
  expect({ sel: s.sel, panel: s.panel }).toEqual({ sel: true, panel: true });
  expect(errs).toEqual([]);
});

/* ★③ 음성대조 셋(지디 228 판정 — «모든 ⌘Z» 범위를 자로 막는다) — 고침(⒜ 누른 순간의 고름을 «돌아가는 칸이 비었을 때만»)이 지어내지 않음을 잠근다 */
test('N2 [음성대조] 아무것도 안 고른 채 ⌘Z — 고름 0(⒜ 가 고름을 지어내지 않는다)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { document.getElementById('uG').style.height = '120px'; window.pushHistory?.('코드 편집'); window.deselectAll?.(); });
  expect((await state(page)).sel, '[전제] 아무것도 안 골랐다').toBe(false);
  await undo(page);
  await expect.poll(() => state(page).then(s => s.h), '[전제] ⌘Z 로 80').toBe('80px');
  const s = await state(page);
  console.log('[N2] ' + JSON.stringify(s));
  expect({ sel: s.sel, panel: s.panel, any: await page.evaluate(() => document.querySelectorAll('#canvas .selected').length) }).toEqual({ sel: false, panel: false, any: 0 });
  expect(errs).toEqual([]);
});

test('N3 [음성대조] 지운 블록 ⌘Z — 돌아가는 칸의 고름(지운 그 블록)이 이긴다 · 누를 때 고른 다른 블록이 아니다(0920b)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { document.querySelector('#uS .section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" data-type="gap" id="uG2" style="height:60px"></div>'); window.rebindAll?.(); window.clearHistory?.(); });
  await pick(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete');
  await expect.poll(() => page.evaluate(() => !!document.getElementById('uG')), '[전제] uG 지움').toBe(false);
  const r2 = await waitStableRect(page, '#uG2');
  await page.mouse.click(r2.cx, r2.cy);
  await expect.poll(() => page.evaluate(() => document.getElementById('uG2').classList.contains('selected')), '[전제] 누르기 전 uG2 를 골랐다').toBe(true);
  await undo(page);
  await expect.poll(() => page.evaluate(() => !!document.getElementById('uG')), '[전제] ⌘Z 로 uG 돌아옴').toBe(true);
  const s = await page.evaluate(() => ({ g: document.getElementById('uG').classList.contains('selected'), g2: document.getElementById('uG2').classList.contains('selected') }));
  console.log('[N3] ' + JSON.stringify(s));
  expect(s, '지운 그 블록이 골라지고 다른 블록은 아니다').toEqual({ g: true, g2: false });
  expect(errs).toEqual([]);
});

test('N4 [음성대조] 고른 블록을 ⌘Z 가 지우면(만들기 되돌림) — 아무것도 안 고른다', async ({ page }) => {
  const errs = await setup(page);
  /* 갭 추가 = 앱 입구 addGapBlock(만들기 «전» 한 칸을 쌓는다) — 코드로 끼운 블록은 ⌘Z 첫머리 체크포인트가 못 잡았다(하네스 ×1 · len 1 그대로) */
  const id = await page.evaluate(() => { window.selectSection?.(document.getElementById('uS')); const before = new Set([...document.querySelectorAll('#uS .gap-block')].map(e => e.id));
    window.addGapBlock(60); const g = [...document.querySelectorAll('#uS .gap-block')].find(e => !before.has(e.id)); return g ? g.id : null; });
  expect(id, '[전제] 갭이 하나 더 생겼다').not.toBe(null);
  const r3 = await waitStableRect(page, '#' + id);
  await page.mouse.click(r3.cx, r3.cy);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id)?.classList.contains('selected'), id), '[전제] 새 블록을 골랐다').toBe(true);
  await undo(page);
  await expect.poll(() => page.evaluate((id) => !!document.getElementById(id), id), '[전제] ⌘Z 로 새 블록 사라짐').toBe(false);
  const n = await page.evaluate(() => document.querySelectorAll('#canvas .selected').length);
  console.log('[N4] ' + JSON.stringify({ id, selected: n }));
  expect(n).toBe(0);
  expect(errs).toEqual([]);
});

/* ★블록 종 더(지디 «싸게 둘셋») — 만들기 = 앱 입구 · 고르기 = 실클릭 · 첫 바꿈 = 패널 숫자 칸 change · ⌘Z ⇒ 고름·칸 남음 + 값이 처음 값(한 쌍) */
/*   잰 값(6f30a34d ×3): 아이콘 서클 = 고치기 전 빨강 ×3(228 꼴) · 구분선 = 고치기 전에도 초록 ×3 — 이 장면에선 돌아가는 칸이 이미 고른 채 쌓인다(까닭 안 잼) ⇒ 구분선 칸은 «지킴» 몫 */
for (const K of [
  { name: '구분선', add: 'addDividerBlock', sel: '.divider-block', field: '#dvd-weight-number', v: 7 },
  { name: '아이콘 서클', add: 'addIconCircleBlock', sel: '.icon-circle-block', field: '#icb-size-number', v: 300 },
]) {
  test(`P2-${K.name} ★고른 뒤 첫 바꿈 → ⌘Z — 고름·패널 남음 · 값은 처음 값`, async ({ page }) => {
    const errs = await setup(page);
    const id = await page.evaluate((K) => { window.selectSection?.(document.getElementById('uS')); const before = new Set([...document.querySelectorAll(K.sel)].map(e => e.id));
      window[K.add](); const b = [...document.querySelectorAll(K.sel)].find(e => !before.has(e.id)); window.deselectAll?.(); return b ? b.id : null; }, K);
    expect(id, `[전제] ${K.name} 생김`).not.toBe(null);
    const r = await waitStableRect(page, '#' + id);
    await page.mouse.click(r.cx, r.cy);
    await expect.poll(() => page.evaluate(([id, f]) => document.getElementById(id)?.classList.contains('selected') && !!document.querySelector(f), [id, K.field]), '[전제] 골랐고 칸이 섰다').toBe(true);
    const v0 = await page.inputValue(K.field);
    await page.fill(K.field, String(K.v));
    await page.dispatchEvent(K.field, 'change');
    await expect.poll(() => page.evaluate(() => window.getHistoryTip().pos), '[전제] 바꿈이 쌓였다').toBeGreaterThan(0);
    await undo(page);
    await expect.poll(async () => (await page.$(K.field)) ? page.inputValue(K.field) : null, '★⌘Z 뒤 칸이 남고 값은 처음 값').toBe(v0);
    const sel = await page.evaluate((id) => document.getElementById(id)?.classList.contains('selected'), id);
    console.log(`[P2-${K.name}] ` + JSON.stringify({ id, v0, sel }));
    expect(sel, '★고름 남음').toBe(true);
    expect(errs).toEqual([]);
  });
}
