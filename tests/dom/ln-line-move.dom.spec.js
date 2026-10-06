/* ln-line-move.dom.spec.js — ★⑵-B② 「버블·챗도 줄을 ★끌어 옮기고 ⌘↑/↓ 로 옮긴다」
 *   (현빈 2026-10-06 「그리드블럭에 줄추가하는 것 처럼 ★핸들이 있어서 드래그로 옮길 수도 있고
 *    그런데 이게 똑같지 않니 구조가?」 · 지디 판정 ㉠ · GO)
 *
 * ★무엇이었나 — 「넣기·지우기」는 버블·챗에 ★먹는데(line-host.js ⌫·T·G·Esc) ★«옮기기»만 꺼져 있었다:
 *   ㉠ 끄는 손잡이가 그리드 주소 `[data-r][data-c][data-line]` 로 줄을 찾았다 — 버블·챗 줄은 그 주소를
 *      ★고의로 안 찍는다(line-host.js 머리말 · 시험 T7) ⇒ 손잡이가 못 섰다.
 *   ㉡ ⌘↑/↓ 게이트(editor.js `_gridActiveOuterLine`)가 `.grid-block.selected` ★하나만 찾았다.
 * ⇒ ⑵-B① 에서 묻는 길을 ★계약 다섯 칸으로 모았고, ②에서 버블·챗 주인이 그것을 구현한다.
 *   ⛔`showGridLineGrip` 을 ★복사하지 않았다 — 같은 손잡이가 주인만 바꿔 쓴다.
 *
 * ⛔이 판의 ★한계(까닭을 붙여 적는다) — ★«다른 행»으로는 아직 못 옮긴다:
 *   한 제스처가 ★두 문으로 나가야 하는데 `updateChatBlock`·`updateSpeechBubbleBlock` 에 ★`opts.noHistory` 가 ★없다
 *   (실측: 그 낱말 0건. 그리드는 `updateGridBlock` 이 그것을 봐서 grdMoveLineToCell 이 둘째 문을 끈다).
 *   ⇒ 그냥 두 문을 보내면 ★⌘Z 가 두 칸이 된다(한 제스처 = 이력 한 칸 규약 위반) ⇒ ★모델 입구 선행 작업이다.
 *   ★버블은 ★행이 하나라 「다른 행」이 ★해당 없다 — ⛔FAIL 이 아니라 ★SKIP 이다(M3 가 그것을 적는다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/ln-line-move.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sM"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left:60px;padding-right:60px;" data-padding-x="60"></div></div>`;

async function fresh(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sM'));
  }, SEC);
  return errs;
}
/** 줄 셋을 가진 버블. ★모델 문으로 세운다(사람 손짓은 아래에서 쓴다). */
const mkBubble = (page) => page.evaluate(() => {
  window.addSpeechBubbleBlock('left');
  const b = [...document.querySelectorAll('.speech-bubble-block')].pop();
  window.updateSpeechBubbleBlock(b.id, { lines: [
    { type: 'body', text: 'A' }, { type: 'body', text: 'B' }, { type: 'body', text: 'C' }] });
  return b.id;
});
/** 메시지 둘, 첫 메시지에 줄 셋. */
const mkChat = (page) => page.evaluate(() => {
  window.addChatBlock({ messages: [{ text: 'm1', align: 'left' }, { text: 'm2', align: 'right' }] });
  const b = document.querySelector('.chat-block');
  window.updateChatBlock(b.id, { editMessage: { index: 0, lines: [
    { type: 'body', text: 'A' }, { type: 'body', text: 'B' }, { type: 'body', text: 'C' }] } });
  return b.id;
});
const bubbleTexts = (page, id) => page.evaluate((id) =>
  JSON.parse(document.getElementById(id).dataset.lines).map(l => l.text), id);
const chatTexts = (page, id, m) => page.evaluate(({ id, m }) =>
  (JSON.parse(document.getElementById(id).dataset.messages)[m].lines || []).map(l => l.text), { id, m });
const gripCount = (page) => page.evaluate(() => document.querySelectorAll('.grd-line-grip').length);
/** 블럭을 고르고 그 줄을 «사람처럼» 고른다(두 번째 클릭) → 손잡이가 선다. */
async function pickLine(page, id, rowSel) {
  await page.evaluate(() => window.deselectAll?.());
  const inner = await waitStableRect(page, `#${id} ${rowSel}`);
  await page.mouse.click(inner.cx, inner.cy); await page.waitForTimeout(140);   // ①블럭
  await page.mouse.click(inner.cx, inner.cy); await page.waitForTimeout(160);   // ②그 줄
}
async function gripRect(page) {
  const r = await waitStableRect(page, '.grd-line-grip');
  return r;
}

test('M0 ★전제 — 버블·챗에 줄이 섰고, 줄을 고르면 ★손잡이가 «뜬다»(⑵-B② 가 섰다)', async ({ page }) => {
  const errs = await fresh(page);
  const sb = await mkBubble(page);
  expect(await bubbleTexts(page, sb), '전제: 버블 줄 셋').toEqual(['A', 'B', 'C']);
  expect(await gripCount(page), '전제: 고르기 «전»엔 손잡이가 0개').toBe(0);
  await pickLine(page, sb, '.ln-row[data-ln="0"]');
  expect(await gripCount(page), '★줄을 골랐는데 손잡이가 안 뜬다').toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M1 ★버블 — 손잡이를 끌어 [0] 을 맨 아래로 옮기면 순서가 바뀐다', async ({ page }) => {
  const errs = await fresh(page);
  const sb = await mkBubble(page);
  await pickLine(page, sb, '.ln-row[data-ln="0"]');
  const g = await gripRect(page);
  const last = await waitStableRect(page, `#${sb} .ln-row[data-ln="2"]`);
  await page.mouse.move(g.cx, g.cy);
  await page.mouse.down();
  await page.mouse.move(g.cx + 8, g.cy);                        // 임계 넘기기
  await page.mouse.move(last.cx, last.top + last.height - 2);   // 마지막 줄 «아래쪽 절반»
  await page.mouse.up();
  await page.waitForTimeout(260);
  expect(await bubbleTexts(page, sb), '★끌어 옮긴 결과').toEqual(['B', 'C', 'A']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M2 ★챗 — 같은 메시지 안에서 ⌘↓ 로 한 칸 내려간다 · ★옆 메시지는 그대로', async ({ page }) => {
  const errs = await fresh(page);
  const ch = await mkChat(page);
  await pickLine(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]');
  const before2 = await chatTexts(page, ch, 1);
  await page.keyboard.press('Meta+ArrowDown');
  await page.waitForTimeout(260);
  expect(await chatTexts(page, ch, 0), '★⌘↓ 한 번 = 한 칸 아래').toEqual(['B', 'A', 'C']);
  expect(await chatTexts(page, ch, 1), '★옆 메시지는 안 건드린다').toEqual(before2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M2b ★행의 끝에서는 «조용히 소진»한다 — ⌘↑ 가 «블럭 이동»으로 새지 않는다', async ({ page }) => {
  const errs = await fresh(page);
  const sb = await mkBubble(page);
  const rowBefore = await page.evaluate((id) => [...document.querySelectorAll('#sM .section-inner > *')]
    .indexOf(document.getElementById(id).closest('#sM .section-inner > *')), sb);
  await pickLine(page, sb, '.ln-row[data-ln="0"]');
  await page.keyboard.press('Meta+ArrowUp');
  await page.waitForTimeout(240);
  const rowAfter = await page.evaluate((id) => [...document.querySelectorAll('#sM .section-inner > *')]
    .indexOf(document.getElementById(id).closest('#sM .section-inner > *')), sb);
  expect(await bubbleTexts(page, sb), '★맨 위 줄에서 ⌘↑ — 줄 차례가 바뀌면 안 된다').toEqual(['A', 'B', 'C']);
  expect(`자리 ${rowBefore} → ${rowAfter}`, '★★⌘↑ 가 «블럭 이동»으로 새었다 — 사용자에겐 갑자기 딴 일이 일어난다')
    .toBe(`자리 ${rowBefore} → ${rowBefore}`);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M3 ★⌘Z 한 걸음 — 끌기도, ⌘↓ 도 한 번에 되돌아간다(한 제스처 = 이력 한 칸)', async ({ page }) => {
  const errs = await fresh(page);
  const ch = await mkChat(page);
  await pickLine(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]');
  const s0 = await chatTexts(page, ch, 0);
  await page.keyboard.press('Meta+ArrowDown');
  await page.waitForTimeout(260);
  const s1 = await chatTexts(page, ch, 0);
  expect(s1, '전제: ⌘↓ 가 데이터를 바꿨다').not.toEqual(s0);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(300);
  expect(await chatTexts(page, ch, 0), '★⌘Z 한 번 = 바로 앞').toEqual(s0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M4 ⛔★«다른 행»은 아직 못 옮긴다 — 데이터가 안 바뀌고 ★사람에게 말한다(조용한 무동작 금지)', async ({ page }) => {
  /* ★까닭은 이 파일 머리말 — 모델 입구에 opts.noHistory 가 없어 ⌘Z 가 두 칸이 된다.
     ★버블은 행이 하나라 ★해당 없다(SKIP) · ★챗은 뜻이 서는 손짓이라 ★토스트로 말한다. */
  const errs = await fresh(page);
  const ch = await mkChat(page);
  await pickLine(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]');
  const b0 = await chatTexts(page, ch, 0), b1 = await chatTexts(page, ch, 1);
  const toasts = [];
  await page.exposeFunction('__tap', (t) => toasts.push(String(t)));
  await page.evaluate(() => { const o = window.showToast; window.showToast = (t) => { window.__tap(t); return o?.(t); }; });
  await page.keyboard.press('Meta+ArrowRight');
  await page.waitForTimeout(260);
  expect([await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)], '★데이터가 바뀌었다 — 아직 못 하는 일이다').toEqual([b0, b1]);
  expect(toasts.some(t => t.includes('옆 메시지')), `★조용히 아무 일도 안 했다 — 말해야 한다(잰 토스트: ${JSON.stringify(toasts)})`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M5 ⛔★손잡이를 끌어 «다른 메시지» 위에 놓아도 안 옮겨진다 — ★M4 와 «다른 길»이다', async ({ page }) => {
  /* ★★왜 M4 와 따로 재나 — ★두 손짓이 ★다른 가드를 탄다(실측으로 알았다):
   *   ⌘←/→   → editor.js `moveGridLineAcrossCells` 의 가드           ← ★M4 가 잠근다
   *   손잡이 끌기 → line-host.js `host.moveLine` 의 CROSS_ROW 가드      ← ★여기가 잠근다
   *   ⛔M4 만 두면 ★후자를 ★아무도 안 잰다 — 실측: 그 가드를 `{ok:true}` 로 무력화해도 ★0 빨강이었다.
   *     ⇒ 「양성대조가 ★한 축만 덮는다」를 ★그 0 빨강이 가르쳐 줬다. ★그래서 이 칸을 더했다. */
  const errs = await fresh(page);
  const ch = await mkChat(page);
  await pickLine(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]');
  const b0 = await chatTexts(page, ch, 0), b1 = await chatTexts(page, ch, 1);
  const toasts = [];
  await page.exposeFunction('__tap2', (t) => toasts.push(String(t)));
  await page.evaluate(() => { const o = window.showToast; window.showToast = (t) => { window.__tap2(t); return o?.(t); }; });
  const g = await gripRect(page);
  const other = await waitStableRect(page, `#${ch} .chb-btext[data-msg-idx="1"]`);
  await page.mouse.move(g.cx, g.cy);
  await page.mouse.down();
  await page.mouse.move(g.cx + 8, g.cy);                 // 임계 넘기기
  await page.mouse.move(other.cx, other.cy);             // ★둘째 메시지 위
  await page.mouse.up();
  await page.waitForTimeout(280);
  expect([await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)],
    '★다른 메시지로 옮겨졌다 — 아직 못 하는 일이다(이력이 두 칸이 된다)').toEqual([b0, b1]);
  expect(toasts.some(t => t.includes('다른 메시지')),
    `★조용히 아무 일도 안 했다 — 말해야 한다(잰 토스트: ${JSON.stringify(toasts)})`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
