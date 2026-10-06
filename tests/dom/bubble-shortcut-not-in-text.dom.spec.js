/* bubble-shortcut-not-in-text.dom.spec.js — ⑷ 「고른 상태」에서 g 가 말풍선 «안»으로 새지 않는다
 * (현빈 2026-10-06 「말풍선 블럭 선택후 g 누르면 풍선안에 g 가 추가되는 문제 / 진입 후 g 눌려야 되지않겠니?」)
 *
 * ★★이 파일은 ★검사만 든다 — 제품 고침은 ★fx-parity 가 한다(지디 2026-10-06 분담 변경).
 *   그쪽 처방: `_mountLineUi(block, host, addr, { synthetic })` — synthetic=true 면 grdSetActiveLine 을
 *   «안» 쓴다 ⇒ 패널은 그 주소로 «그리고», 단축키가 읽는 활성 줄은 null 로 남는다.
 *   ★그 한 줄이 ⑴버블 g 결함과 ⑵챗에 기본 주소를 넣어도 같은 결함이 안 생기는 것을 ★같이 닫는다.
 *   ⛔그래서 나는 js/blocks/line-host.js ★무접촉이다(내가 한 번 고쳤다가 ★되돌렸다 — c429aab7 → 이 커밋).
 *
 * ★범인(내가 잰 것): contenteditable 도 포커스 도 클래스도 아니다 — «활성 줄»이라는 ★넷째 상태다.
 *   한 번 클릭한 「고른 상태」에서 editing 없음 · .tb-bubble contenteditable="false" ·
 *   activeElement=BODY · isContentEditable=false 인데 grdGetActiveLine 이 {r:0,c:0,li:null} 을 돌려준다.
 *   세운 자리 = js/blocks/line-host.js lnAugmentBubblePanel — «줄 없는 말풍선»의 패널에 「＋ 줄 추가」를
 *   띄우려고 그 기본 주소를 _mountLineUi 에 넘기고, _mountLineUi 가 grdSetActiveLine 으로 «굳힌다».
 *   그래서 lnAddLineToSelected 의 `if (!addr) return false` 가 참이 안 되고 g 가 소진된다.
 *
 * ★양성대조(㉣) = ★synthetic 처리가 ★없는 판 — 지금 이 레인(gd/small3)과 핀 e7444dd3 이 둘 다 그 판이다.
 *   2026-10-06 실측 — 빨강: B1 · B2 · B6 / 초록: B3 · B4 · B5 · B7
 *     B1: dataset.lines "(없음)" → [{"type":"body",…},{"type":"gap","height":16}] · 안내문구 소실 · 갭 블록 +0
 *     B2: Esc 뒤 selected 가 true 로 남는다(줄 선택 풀기로 샌다)
 *     B6: {"speech-bubble":0, text:1, chat:1, table:1, grid:1, step:1, asset:1}
 *   ⇒ ★fx-parity 의 synthetic 줄이 올라오면 B1·B2·B6 이 초록으로 바뀌어야 한다. 그것이 이 파일의 몫이다.
 * ★지키는 검사(그 고침이 ★깨뜨리면 안 되는 것 — 양쪽 판에서 초록이어야 한다):
 *   B3 챗의 메시지 단위 줄 추가 · B4 줄 없는 말풍선 패널의 「줄 추가」 UI · B5 줄을 고른 뒤 g ·
 *   B7 편집 중 g 는 ★글자로 들어간다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="bA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 900 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('bA'));
  }, SEC);
  await page.waitForTimeout(200);
  return errs;
}

/** 블럭을 만들고 «사람이 하는 순서»대로 전부 풀었다가 한 번 클릭해 «고른 상태»로 만든다. */
async function addAndSelect(page, addExpr, sel) {
  await page.evaluate(async (expr) => { await eval(expr); }, addExpr);
  await page.waitForTimeout(350);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.waitForTimeout(120);
  const box = await page.locator('#canvas ' + sel).first().boundingBox();
  expect(box, `${sel} 상자`).not.toBeNull();
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(14, box.height / 2));
  await page.waitForTimeout(250);
  return box;
}

const bubbleState = (page) => page.evaluate(() => {
  const el = document.querySelector('#canvas .speech-bubble-block');
  const b = el?.querySelector('.tb-bubble');
  return {
    selected: !!el?.classList.contains('selected'),
    editing: !!el?.classList.contains('editing'),
    lines: el?.dataset.lines === undefined ? '(없음)' : el.dataset.lines,
    isPlaceholder: b?.dataset.isPlaceholder ?? '(없음)',
    bubbleCE: b?.getAttribute('contenteditable'),
    aeCE: !!document.activeElement?.isContentEditable,
    text: b ? b.innerText : null,
    isPhAttr: b?.dataset.isPlaceholder ?? '(없음)',
    gapBlocks: document.querySelectorAll('#canvas .gap-block').length,
  };
});

test('B1 ★고른 상태(편집 진입 전)에서 g → 말풍선은 그대로 · 전역 갭 블록이 생긴다', async ({ page }) => {
  await setup(page);
  await addAndSelect(page, "window.addSpeechBubbleBlock('left')", '.speech-bubble-block');

  const before = await bubbleState(page);
  // ★전제 단언 — 「고른 상태」가 실제로 섰고, 편집 중이 «아니다»(편집 중이면 이 검사는 아무것도 안 잰다)
  expect(before.selected, '고른 상태').toBe(true);
  expect(before.editing, 'editing 클래스').toBe(false);
  expect(before.bubbleCE, '.tb-bubble contenteditable').toBe('false');
  expect(before.aeCE, 'activeElement.isContentEditable').toBe(false);
  expect(before.lines, '시작 dataset.lines').toBe('(없음)');
  expect(before.isPlaceholder, '시작 data-is-placeholder').toBe('true');

  await page.keyboard.press('g');
  await page.waitForTimeout(300);
  const after = await bubbleState(page);
  expect(after.lines, `g 뒤 dataset.lines (잰 값: ${after.lines})`).toBe('(없음)');
  expect(after.isPlaceholder, '안내문구 유지').toBe('true');
  expect(after.gapBlocks - before.gapBlocks, '전역 갭 블록 증가').toBe(1);
});

test('B2 ★고른 상태에서 Esc → 블럭 선택이 풀린다(「줄 선택 풀기」로 새지 않는다)', async ({ page }) => {
  await setup(page);
  await addAndSelect(page, "window.addSpeechBubbleBlock('left')", '.speech-bubble-block');
  expect((await bubbleState(page)).selected).toBe(true);   // ★전제 단언

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  expect((await bubbleState(page)).selected, 'Esc 뒤 selected').toBe(false);
});

test('B3 ★지키는 검사 — 챗은 「메시지만 고른 상태」에서 g 가 그 메시지에 여백 줄을 넣는다', async ({ page }) => {
  await setup(page);
  await addAndSelect(page, 'window.addChatBlock()', '.chat-block');
  // 사람이 메시지를 골라 활성 줄(li:null)을 세운다 — 챗의 D10 설계대로
  const ok = await page.evaluate(() => {
    const el = document.querySelector('#canvas .chat-block');
    if (!window.grdSetActiveLine && !window.lnChatHost) return false;
    window.showChatProperties?.(el);
    window.grdSetActiveLine?.(el, { r: 0, c: 0, li: null });
    return JSON.stringify(window.grdGetActiveLine?.(el)) === '{"r":0,"c":0,"li":null}';
  });
  expect(ok, '★전제 — 챗에 활성 줄(메시지 단위)이 섰다').toBe(true);

  await page.keyboard.press('g');
  await page.waitForTimeout(350);
  const msgs = await page.evaluate(() => {
    try { return JSON.parse(document.querySelector('#canvas .chat-block').dataset.messages || '[]'); } catch (_) { return []; }
  });
  const lines = msgs[0] && Array.isArray(msgs[0].lines) ? msgs[0].lines : null;
  expect(lines, `0번 메시지 lines (잰 값: ${JSON.stringify(msgs[0] && msgs[0].lines)})`).not.toBeNull();
  expect(lines.some(l => l && l.type === 'gap'), '여백 줄이 들어갔다').toBe(true);
});

test('B4 ★지키는 검사 — 줄 없는 말풍선의 패널에 「줄 추가」 UI 가 그대로 뜬다', async ({ page }) => {
  await setup(page);
  await addAndSelect(page, "window.addSpeechBubbleBlock('left')", '.speech-bubble-block');
  const ui = await page.evaluate(() => {
    const el = document.querySelector('#canvas .speech-bubble-block');
    window.showTextProperties?.(el);
    return {
      linePanel: !!document.getElementById('ln-line-panel'),
      addKindSel: document.querySelectorAll('#ln-line-panel select, #ln-line-panel .prop-btn, #ln-line-panel button').length,
      /* ★패널의 «기본 주소»는 그대로 선다 — 고친 것은 «단축키가 그것을 읽는 것»뿐이다 */
      activeLine: JSON.stringify(window.grdGetActiveLine?.(el) ?? null),
    };
  });
  expect(ui.linePanel, '줄 패널이 붙었다').toBe(true);
  expect(ui.addKindSel, `줄 추가 컨트롤 수 (잰 값: ${ui.addKindSel})`).toBeGreaterThan(0);
  expect(ui.activeLine, '패널 기본 주소는 유지').toBe('{"r":0,"c":0,"li":null}');
});

test('B5 ★지키는 검사 — 줄이 이미 있고 그 줄을 고른 뒤 g → 그 줄 다음에 여백 줄(D10 그대로)', async ({ page }) => {
  await setup(page);
  await addAndSelect(page, "window.addSpeechBubbleBlock('left')", '.speech-bubble-block');
  const seeded = await page.evaluate(() => {
    const el = document.querySelector('#canvas .speech-bubble-block');
    window.updateSpeechBubbleBlock?.(el.id, { lines: [{ type: 'body', text: '첫 줄' }] });
    window.showTextProperties?.(el);
    window.grdSetActiveLine?.(el, { r: 0, c: 0, li: 0 });
    let n = 0; try { n = JSON.parse(el.dataset.lines || '[]').length; } catch (_) {}
    return { n, act: JSON.stringify(window.grdGetActiveLine?.(el) ?? null) };
  });
  expect(seeded.n, '★전제 — 줄이 1개 섰다').toBe(1);
  expect(seeded.act, '★전제 — 0번 줄을 골랐다').toBe('{"r":0,"c":0,"li":0}');

  await page.keyboard.press('g');
  await page.waitForTimeout(350);
  const lines = await page.evaluate(() => {
    try { return JSON.parse(document.querySelector('#canvas .speech-bubble-block').dataset.lines || '[]'); } catch (_) { return []; }
  });
  expect(lines.length, `g 뒤 줄 수 (잰 값: ${JSON.stringify(lines)})`).toBe(2);
  expect(lines[1] && lines[1].type, '1번 줄 종류').toBe('gap');
});

test('B6 ★전수 — 7종 모두 고른 상태에서 g 는 「전역 갭 블록 +1」이다', async ({ page }) => {
  const CASES = [
    ['speech-bubble', "window.addSpeechBubbleBlock('left')", '.speech-bubble-block'],
    ['text',          "window.addTextBlock('body')",         '.text-block:not(.speech-bubble-block)'],
    ['chat',          'window.addChatBlock()',               '.chat-block'],
    ['table',         'window.addTableBlock()',              '.table-block'],
    ['grid',          'window.addGridBlock()',               '.grid-block'],
    ['step',          'window.addStepBlock?.()',             '.step-block'],
    ['asset',         'window.addAssetBlock()',              '.asset-block'],
  ];
  const got = {};
  for (const [name, expr, sel] of CASES) {
    await setup(page);
    await addAndSelect(page, expr, sel);
    const before = await page.evaluate(() => document.querySelectorAll('#canvas .gap-block').length);
    await page.keyboard.press('g');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.querySelectorAll('#canvas .gap-block').length);
    got[name] = after - before;
  }
  expect(got, `잰 값: ${JSON.stringify(got)}`).toEqual(Object.fromEntries(CASES.map(([n]) => [n, 1])));
});

test('B7 ★지키는 검사 — 편집에 «진입한 뒤»엔 g 가 ★글자로 들어간다(단축키로 안 샌다)', async ({ page }) => {
  await setup(page);
  const box = await addAndSelect(page, "window.addSpeechBubbleBlock('left')", '.speech-bubble-block');
  await page.mouse.dblclick(box.x + box.width / 2, box.y + 12);
  await page.waitForTimeout(350);
  const st = await bubbleState(page);
  // ★전제 단언 — 편집에 «실제로» 들어갔고 커서가 말풍선 안에 있다
  expect(st.editing, 'editing 클래스').toBe(true);
  expect(st.bubbleCE, '.tb-bubble contenteditable').toBe('true');
  expect(st.aeCE, 'activeElement.isContentEditable').toBe(true);
  const caret = await page.evaluate(() => {
    const b = document.querySelector('#canvas .speech-bubble-block .tb-bubble');
    const sel = window.getSelection();
    return { inBubble: !!(sel && sel.anchorNode && b.contains(sel.anchorNode)), ranges: sel ? sel.rangeCount : -1 };
  });
  expect(caret, `커서 자리 (잰 값: ${JSON.stringify(caret)})`).toEqual({ inBubble: true, ranges: 1 });

  const gapsBefore = st.gapBlocks;
  await page.keyboard.press('g');
  await page.waitForTimeout(300);
  const after = await bubbleState(page);
  /* ★㉢ 지디 요구 — 「편집 중 g → 글자 g 가 들어간다」. ★지금 정상인 것을 안 깨뜨렸다는 단언이다.
     ★실측 2026-10-06: 더블클릭은 안내문구를 통째로 고른 상태로 들어가므로 g 가 그것을 «덮는다»
       ⇒ 본문이 "말풍선 텍스트를 입력하세요" → "g". (앞서 「하네스로 못 잰다」고 적었던 것은 ★틀렸다
       — 내가 innerHTML 앞 320자만 보고 본문을 놓쳤다. 글자는 들어간다.) */
  expect(after.text, `편집 중 g 뒤 본문 (잰 값: ${JSON.stringify(after.text)} · 앞 ${JSON.stringify(st.text)})`).toContain('g');
  expect(after.text, '안내문구가 글자로 굳지 않았다').not.toBe(st.text);
  // ★그리고 단축키로는 ★안 샌다 — 갭 블록도 줄도 안 생긴다
  expect(after.gapBlocks, '편집 중 g 는 갭 블록을 만들지 않는다').toBe(gapsBefore);
  expect(after.lines, '편집 중 g 는 줄을 만들지 않는다').toBe('(없음)');
});
