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
 * ★★⑵-B③(2026-10-06) — ★«다른 행»(챗의 옆 메시지)도 ★열렸다. ★선행이 섰기 때문이다:
 *   9b4fc2b0 모델 입구에 `opts.noHistory` ＋ `*BlockRaw` 두 벌 · d617c266 그리드가 쓸 ★㉣ 꼴 확정
 *   ⇒ ★이력 꼴 = 문1 Raw(noHistory 없음) ＋ 문2 래퍼＋noHistory ⇒ 스택 ＋1 · ⌘Z 한 번(M6 가 잠근다)
 *   ★버블은 ★행이 하나라 ⌘←/→ 가 ★SKIP 이다(M4c) — ⛔FAIL 이 아니다.
 * ~~⛔옛 한계(이제 거짓) — «다른 행»으로는 못 옮긴다:~~
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

test('M4 ★★⌘→ 로 줄이 «옆 메시지»로 간다 — ★출발에서 빠지고 도착의 끝에 붙는다 (⑵-B③)', async ({ page }) => {
  /* ★★⛔이 칸은 ★뒤집힌 검사다 — 앞 판에서는 「★아직 못 한다 ＋ 토스트」를 쟀다.
   *   까닭: 한 제스처가 ★두 문으로 나가야 하는데 모델 입구에 ★`opts.noHistory` 가 없었다.
   *   ⇒ ★선행(9b4fc2b0: opts.noHistory ＋ `*BlockRaw` 두 벌)이 서고, ★㉣ 꼴이 확정된 뒤 ★열렸다.
   *   ⇒ ★★「그때 뒤집히는 검사」를 ★미리 이름으로 적어 둔 그 둘이 ★이것과 M5 다(앞 커밋글). */
  const errs = await fresh(page);
  const ch = await mkChat(page);
  await pickLine(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]');
  expect([await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)], '전제: 출발 [A,B,C] · 도착 []')
    .toEqual([['A', 'B', 'C'], []]);
  await page.keyboard.press('Meta+ArrowRight');
  await page.waitForTimeout(280);
  expect([await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)],
    '★⌘→ — A 가 둘째 메시지 «끝»으로 간다').toEqual([['B', 'C'], ['A']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M4b ★메시지의 끝에서 ⌘← 는 «조용히 소진»한다 — 블럭 이동으로 새지 않는다', async ({ page }) => {
  /* ★그리드의 EDGE 와 ★같은 뜻이다 — 「맨 왼쪽에서 ⌘←」가 갑자기 «블럭 이동»이 되지 않게. */
  const errs = await fresh(page);
  const ch = await mkChat(page);
  const idx0 = await page.evaluate((id) => [...document.querySelectorAll('#sM .section-inner > *')]
    .indexOf(document.getElementById(id).closest('#sM .section-inner > *')), ch);
  await pickLine(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]');
  await page.keyboard.press('Meta+ArrowLeft');          // 메시지 0 에서 왼쪽 = 없는 메시지(-1)
  await page.waitForTimeout(260);
  const idx1 = await page.evaluate((id) => [...document.querySelectorAll('#sM .section-inner > *')]
    .indexOf(document.getElementById(id).closest('#sM .section-inner > *')), ch);
  expect([await chatTexts(page, ch, 0), `자리 ${idx0} → ${idx1}`],
    '★데이터가 바뀌거나 블럭이 움직였다 — 끝에서는 아무 일도 없어야 한다')
    .toEqual([['A', 'B', 'C'], `자리 ${idx0} → ${idx0}`]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M4c ★버블에서 ⌘←/→ 는 ★SKIP — ⛔실패가 아니라 «해당 없음»이다(행이 하나)', async ({ page }) => {
  /* ⛔「조용히 아무 일 없음」을 ★여기서는 ★맞는 동작으로 둔다 — ★뜻이 없는 손짓이다(지디 승인).
     ★그래서 ★토스트도 안 띄운다. ★데이터·자리가 불변임을 ★값으로 잰다. */
  const errs = await fresh(page);
  const sb = await mkBubble(page);
  const toasts = [];
  await page.exposeFunction('__tapB', (t) => toasts.push(String(t)));
  await page.evaluate(() => { const o = window.showToast; window.showToast = (t) => { window.__tapB(t); return o?.(t); }; });
  await pickLine(page, sb, '.ln-row[data-ln="0"]');
  await page.keyboard.press('Meta+ArrowRight');
  await page.waitForTimeout(260);
  expect([await bubbleTexts(page, sb), toasts], '★버블은 아무 일도 없고 ★말도 안 한다(뜻 없는 손짓)')
    .toEqual([['A', 'B', 'C'], []]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M5 ★★손잡이를 끌어 «다른 메시지» 위에 놓으면 그 메시지로 간다 (⑵-B③)', async ({ page }) => {
  /* ★M4(⌘→)와 ★다른 길이다 — ⌘←/→ 는 editor.js, 손잡이 끌기는 host.moveLine 을 탄다.
     ⇒ ★두 길을 ★따로 잰다(앞 판에서 ★이 갈림을 ★0 빨강이 가르쳐 줬다). */
  const errs = await fresh(page);
  const ch = await mkChat(page);
  await pickLine(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]');
  const g = await gripRect(page);
  const other = await waitStableRect(page, `#${ch} .chb-btext[data-msg-idx="1"]`);
  await page.mouse.move(g.cx, g.cy);
  await page.mouse.down();
  await page.mouse.move(g.cx + 8, g.cy);
  await page.mouse.move(other.cx, other.cy);
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect([await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)],
    '★끌어 놓은 메시지로 갔다').toEqual([['B', 'C'], ['A']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M6 ★★다른 메시지로 옮겨도 ⌘Z 가 «한 번» — ㉣ 꼴(문1 Raw · 문2 래퍼＋noHistory)', async ({ page }) => {
  /* ★★이 칸이 ⑵-B③ 의 ★본 단언이다 — ⛔「된다」만으로는 닫히지 않는다.
   *   ★두 문으로 나가므로 ★스택이 ★한 칸이어야 하고 ⌘Z 한 번에 ★둘 다 돌아와야 한다.
   *   ⛔문1 을 일반 입구로 보내면 래퍼 끝 표본이 ★「출발에서만 뺀 반쪽」을 남긴다(ln-nohistory N2 가 그 꼴을 잠근다).
   *   ★세 갈래를 갈라 적는다 — ㉠안 먹음 ㉡★반쪽(A 가 어느 메시지에도 없다) ㉢원래로. */
  const errs = await fresh(page);
  const ch = await mkChat(page);
  const before = [await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)];
  const stack0 = await page.evaluate(() => (window.historyStack || []).length);
  await pickLine(page, ch, '.ln-row[data-ln-m="0"][data-ln="0"]');
  await page.keyboard.press('Meta+ArrowRight');
  await page.waitForTimeout(280);
  const mid = [await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)];
  const stack1 = await page.evaluate(() => (window.historyStack || []).length);
  expect(`옮긴 뒤 ${JSON.stringify(mid)} · 스택 ＋${stack1 - stack0}`)
    .toBe(`옮긴 뒤 ${JSON.stringify([['B', 'C'], ['A']])} · 스택 ＋1`);

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  const read = async () => [await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)];
  let after = mid;
  for (let i = 0; i < 40 && JSON.stringify(after) === JSON.stringify(mid); i++) {
    await page.waitForTimeout(100);
    after = await read();
  }
  const lost = !after.flat().includes('A');
  expect(`먹었나=${JSON.stringify(after) !== JSON.stringify(mid)} · A가사라짐=${lost} · 값=${JSON.stringify(after)}`)
    .toBe(`먹었나=true · A가사라짐=false · 값=${JSON.stringify(before)}`);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('M7 ★★도착 메시지가 «꽉 찼으면» 옮기지 않는다 — ★상한을 «먼저» 본다(출발 줄이 안 사라진다)', async ({ page }) => {
  /* ★★⛔이 칸이 ★왜 생겼나 — ★양성대조가 ★0 빨강이었다. 「상한을 먼저 본다」 가드를 `if (false)` 로
   *   ★확실히 껐는데 ★아무 검사도 안 빨개졌다 ⇒ ★변이가 약한 게 아니라 ★«재는 자»가 없었다.
   *   ⇒ ★「0 빨강이면 ⑴변이가 약한가 ⑵★다른 축이 있는가 ★둘 다 물어라」 — ★⑵였다.
   * ★무엇을 잠그나 — `grdMoveLineToCell` 머리말의 그 규약: 「★상한은 «먼저» 본다 —
   *   거절되는 순간 줄이 ★어느 행에도 없어서는 안 된다」. ⇒ ★문1 이 ★아예 안 나가야 한다.
   *   ⇒ 재는 값 셋: ㉠거절 코드 LIMIT ㉡★토스트로 말한다 ㉢★데이터가 ★한 글자도 안 바뀐다. */
  const errs = await fresh(page);
  const ch = await page.evaluate(() => {
    window.addChatBlock({ messages: [{ text: 'm1', align: 'left' }, { text: 'm2', align: 'right' }] });
    const b = document.querySelector('.chat-block');
    const max = window.MAX_CELL_LINES || 20;
    window.updateChatBlock(b.id, { editMessage: { index: 0, lines: [{ type: 'body', text: 'A' }, { type: 'body', text: 'B' }] } });
    /* ★도착 메시지를 ★상한까지 채운다 — ★「꽉 찼다」는 장면이 ★실제로 선다. */
    window.updateChatBlock(b.id, { editMessage: { index: 1, lines: Array.from({ length: max }, (_, i) => ({ type: 'body', text: 'f' + i })) } });
    return b.id;
  });
  const before = [await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)];
  /* ★전제 — 도착이 ★정말 꽉 찼다. ⛔안 차 있으면 이 검사가 「상한」을 안 재고 그냥 성공을 잰다. */
  const max = await page.evaluate(() => window.MAX_CELL_LINES || 20);
  expect([before[0].length, before[1].length], `전제: 출발 2줄 · 도착 ★상한(${max})줄`).toEqual([2, max]);

  const toasts = [];
  await page.exposeFunction('__tapL', (t) => toasts.push(String(t)));
  await page.evaluate(() => { const o = window.showToast; window.showToast = (t) => { window.__tapL(t); return o?.(t); }; });
  const res = await page.evaluate((id) => {
    const b = document.getElementById(id);
    const H = window.lnHostFor(b);
    const r = H.moveLine({ r: 0, c: 0 }, 0, { r: 1, c: 0 }, null);
    return r ? { ok: r.ok, code: r.code } : null;
  }, ch);
  await page.waitForTimeout(160);
  const after = [await chatTexts(page, ch, 0), await chatTexts(page, ch, 1)];
  /* ★잰 값을 단언에 찍는다 — 빨강일 때 「무엇이 일어났나」가 보이게. */
  expect(`코드=${res && res.code} · 말했나=${toasts.some(t => t.includes('최대'))} · 데이터불변=${JSON.stringify(after) === JSON.stringify(before)}`)
    .toBe('코드=LIMIT · 말했나=true · 데이터불변=true');
  expect(errs, errs.join(' | ')).toEqual([]);
});
