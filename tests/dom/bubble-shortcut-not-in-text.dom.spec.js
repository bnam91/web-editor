/* bubble-shortcut-not-in-text.dom.spec.js — ⑷ 「고른 상태」에서 g 가 말풍선 «안»으로 새지 않는다
 * (현빈 2026-10-06 「말풍선 블럭 선택후 g 누르면 풍선안에 g 가 추가되는 문제 / 진입 후 g 눌려야 되지않겠니?」)
 *
 * ★범인은 contenteditable 도 포커스도 아니었다 — «활성 줄»이라는 넷째 상태다.
 *   lnAugmentBubblePanel 이 «줄 없는 말풍선»의 패널에 「＋ 줄 추가」를 띄우려고 {r:0,c:0,li:null} 을
 *   세우는데, 단축키(lnAddLineToSelected)가 그 주소를 «사람이 고른 줄»로 읽었다.
 *
 * ★양성대조 판 = e7444dd3(고치기 전) → `GD1001_ROOT=<그 판 체크아웃> ...` 로 돌리면
 *   ★빨강: B1(dataset.lines 불변 · 안내문구 유지 · 갭 +1) · B2(Esc 가 블럭 선택을 푼다).
 *   2026-10-06 실측(그 판): 한 번 클릭 뒤 g → dataset.lines "(없음)" → [body, gap],
 *     data-is-placeholder "true" → (없음), 캔버스 .gap-block 추가 0.
 *   ★지키는 검사(옛 판에서도 초록이어야 한다): B3(챗의 메시지 단위 줄 추가) · B4(버블 줄바 「＋」) ·
 *     B5(줄을 고른 뒤 g) · B6(6종 전수) · B7(편집 중엔 단축키가 «안» 먹는다).
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

test('B7 ★지키는 검사 — 편집에 «진입한 뒤»엔 단축키가 안 먹는다(글자 자리로 간다)', async ({ page }) => {
  await setup(page);
  const box = await addAndSelect(page, "window.addSpeechBubbleBlock('left')", '.speech-bubble-block');
  await page.mouse.dblclick(box.x + box.width / 2, box.y + 12);
  await page.waitForTimeout(300);
  const st = await bubbleState(page);
  // ★전제 단언 — 편집에 «실제로» 들어갔다
  expect(st.editing, 'editing 클래스').toBe(true);
  expect(st.bubbleCE, '.tb-bubble contenteditable').toBe('true');
  expect(st.aeCE, 'activeElement.isContentEditable').toBe(true);

  const gapsBefore = st.gapBlocks;
  await page.keyboard.press('g');
  await page.waitForTimeout(300);
  const after = await bubbleState(page);
  expect(after.gapBlocks, '편집 중 g 는 갭 블록을 만들지 않는다').toBe(gapsBefore);
  expect(after.lines, '편집 중 g 는 줄을 만들지 않는다').toBe('(없음)');
  /* ⛔「글자 g 가 실제로 들어간다」는 이 하네스로 ★못 잰다 — Playwright 가 contenteditable 안에
     커서(selection)를 놓지 않아 입력이 일어나지 않는다(2026-10-06 실측: html 불변).
     여기선 «단축키가 안 먹는다»까지만 잠근다. 글자 입력은 실앱 확인 몫 — 보고 명부에 적었다. */
});
