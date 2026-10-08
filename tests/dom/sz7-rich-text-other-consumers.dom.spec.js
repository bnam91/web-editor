/* sz7-rich-text-other-consumers.dom.spec.js
 *   ★★`gridLineHtml` 의 ★«나머지 두 소비자»가 ★안 바뀌었음을 ★잠그는 자 (수지⑦ 2026-10-08).
 *
 * ══ ★★왜 이 파일이 생겼나 ══════════════════════════════════════════════
 *   ★발주서는 ★`_esc(line.text)` 가 ★`grid-block.js` 에 ★2건뿐이라는 것만 세고
 *   ★★「⑦ 은 ★그리드에만 걸린다」고 적었다. ★★틀렸다 — ★★«누가 ★그 함수를 ★부르나»를 ★안 셌다:
 *     ⑴ grid-block.js 자신(7) · ⑵ ★`innercard-block.js:61` · ⑶ ★`line-host.js:60`(★BT2 버블·챗)
 *   ⇒ ★`line.textHtml` 길을 열면 ★★그 셋이 ★같이 열린다.
 *   ★지디 판정 ㉮ = ★«그대로 간다»(★같은 줄 모델을 ★같은 렌더러로 ★같이 그리는 것이 ★일관).
 *   ★★단 ★조건 ⒝: ★「★안 바뀐다」를 ★★«말»로 두지 말고 ★★검사로 ★잠가라. ★★이 파일이 ★그 자다.
 *   ⚠️같은 누락을 ★2026-10-03 ★G7 에서 ★한 번 밟았다(★「0줄」이 ★innercard ★18줄) — ★두 번째다.
 *
 * ══ ★★재는 것 — ★«무변» ＋ ★«능력» 을 ★갈라 잰다 ═══════════════════════════
 *   O1 ★innercard — ★`textHtml` 이 ★«없으면» ★옛 평문 경로(`_esc`) ★그대로
 *   O2 ★innercard — ★`textHtml` 을 ★손으로 넣으면 ★★서식으로 그려진다(★★능력이 넓어졌다는 ★증거)
 *   O3 ★BT2 챗 줄 — ★`textHtml` 이 ★없으면 ★평문 경로 그대로
 *   O4 ★BT2 챗 줄 — ★넣으면 ★서식으로 그려진다
 *   ⇒ ★★O2·O4 는 ★«사고»가 ★아니라 ★★«의도된 확장»의 ★기록이다. ⛔말로 적지 않고 ★행위로 적는다.
 *     ★그 수가 ★현빈께 올릴 ★재료다(★「이 확장이 의도된 것인가」를 ★물을 수 있게).
 *   ⚠️★O1·O3 이 ★빨개지면 ★★무회귀가 깨진 것이다 — ★남의 블럭이 ★조용히 달라졌다는 뜻.
 *
 * ⛔못 재는 축: ★그 두 블럭의 ★패널·편집 길(★`textHtml` 을 ★쓰는 입구가 ★아직 ★없다 —
 *   ★그래서 O2·O4 는 ★모델을 ★손으로 세운다. ★그게 ★「★앱에서 ★그 꼴이 ★생기나」의 ★답은 ★아니다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js sz7-rich-text-other-consumers
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const TXT = 'AAABBBCCC';
const RICH = 'AAABBB<b>CCC</b>';

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  await page.waitForTimeout(250);
  return errs;
}

/* ★앱 입구로 넣는다(준비 — 재는 대상이 아니다). */
async function addBlock(page, call, sel) {
  const id = await page.evaluate(([c, s]) => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    // eslint-disable-next-line no-eval
    eval(c);
    const f = [...document.querySelectorAll(`#canvas ${s}`)].filter(e => !before.has(e.id));
    return f.length ? f[f.length - 1].id : null;
  }, [call, sel]);
  await page.waitForTimeout(350);
  return id;
}

/* ══ innercard ════════════════════════════════════════════════════════ */

async function innercardState(page, id) {
  return page.evaluate((i) => {
    const b = document.getElementById(i);
    if (!b) return { err: 'block 없음' };
    return { html: b.innerHTML, shown: b.innerText,
             bTags: b.querySelectorAll('b,strong').length,
             fmt: window._stickerHtmlHasFormatting?.(b.innerHTML) ?? null };
  }, id);
}

test('O1 ★innercard — textHtml 이 없으면 옛 평문 경로 그대로 (★무회귀)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addBlock(page, 'window.addInnerCardBlock?.({})', '.innercard-block');
  expect(id, '★innercard 가 안 들어갔다 — 아래는 아무것도 안 잰다').toBeTruthy();
  await page.evaluate(([i, t]) => {
    const b = document.getElementById(i);
    b.dataset.lines = JSON.stringify([{ type: 'body', text: t }]);   // ⛔textHtml ★없다 = 옛 저장본 꼴
    window.renderInnerCardBlock?.(b);
  }, [id, TXT]);
  await page.waitForTimeout(250);
  const s = await innercardState(page, id);
  console.log('  O1:', JSON.stringify({ shown: s.shown, bTags: s.bTags }));
  expect(s.err).toBeUndefined();
  expect(s.shown, `★평문이 안 보인다. 잰 값 ${JSON.stringify(s)}`).toContain(TXT);
  expect(s.bTags, `★★서식이 ★없는데 ★서식 태그가 생겼다 — ★남의 블럭이 ★조용히 달라졌다. 잰 값 ${JSON.stringify(s)}`).toBe(0);
  expect(errs).toEqual([]);
});

test('O2 ★innercard — textHtml 을 넣으면 서식으로 그려진다 (★능력이 넓어졌다는 ★증거)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addBlock(page, 'window.addInnerCardBlock?.({})', '.innercard-block');
  expect(id).toBeTruthy();
  await page.evaluate(([i, t, h]) => {
    const b = document.getElementById(i);
    b.dataset.lines = JSON.stringify([{ type: 'body', text: t, textHtml: h }]);
    window.renderInnerCardBlock?.(b);
  }, [id, TXT, RICH]);
  await page.waitForTimeout(250);
  const s = await innercardState(page, id);
  console.log('  O2:', JSON.stringify({ shown: s.shown, bTags: s.bTags, fmt: s.fmt }));
  /* ★★이 칸이 ★초록이면 ★★«확장이 ★innercard 에도 닿았다»가 ★사실로 기록된다.
     ⛔빨개지면 ★「막혔다」가 아니라 ★★«내 ㉮ 판정의 전제가 틀렸다» — ★지디에게 보고해라. */
  expect(s.bTags, `★★innercard 가 ★textHtml 을 ★안 읽는다 — ★㉮ 판정의 전제(셋이 같이 열린다)가 ★틀렸다. 잰 값 ${JSON.stringify(s)}`).toBeGreaterThan(0);
  expect(s.shown, `★글자가 바뀌었다. 잰 값 ${s.shown}`).toContain(TXT);
  expect(errs).toEqual([]);
});

/* ══ BT2 — 챗 버블 줄 (line-host) ══════════════════════════════════════ */

async function chatState(page, id) {
  return page.evaluate((i) => {
    const b = document.getElementById(i);
    if (!b) return { err: 'block 없음' };
    const row = b.querySelector('.ln-row');
    return { hasRow: !!row, html: row ? row.innerHTML : null,
             shown: row ? row.innerText : null,
             bTags: row ? row.querySelectorAll('b,strong').length : -1 };
  }, id);
}

test('O3 ★BT2 챗 줄 — textHtml 이 없으면 평문 경로 그대로 (★무회귀)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addBlock(page, `window.addChatBlock?.({ messages: [{ align: 'left', lines: [{ type: 'body', text: '${TXT}' }] }] })`, '.chat-block');
  expect(id, '★챗 블럭이 안 들어갔다').toBeTruthy();
  const s = await chatState(page, id);
  console.log('  O3:', JSON.stringify({ hasRow: s.hasRow, shown: s.shown, bTags: s.bTags }));
  expect(s.err).toBeUndefined();
  /* ★전제 — ★줄 경로로 그려졌나(★`.ln-row` 가 ★line-host 의 그 자리다).
     ⛔없으면 ★평문 `chb-btext` 갈래로 간 것이고 ★이 검사는 ★엉뚱한 것을 잰다. */
  expect(s.hasRow, `★전제 — ★`+'`.ln-row`'+` 가 없다 ⇒ ★줄 경로(line-host)로 안 그려졌다. 잰 값 ${JSON.stringify(s)}`).toBe(true);
  expect(s.shown, `★평문이 안 보인다. 잰 값 ${JSON.stringify(s)}`).toContain(TXT);
  expect(s.bTags, `★★서식이 ★없는데 ★서식 태그가 생겼다 — ★BT2 가 ★조용히 달라졌다. 잰 값 ${JSON.stringify(s)}`).toBe(0);
  expect(errs).toEqual([]);
});

test('O4 ★BT2 챗 줄 — textHtml 을 넣으면 서식으로 그려진다 (★능력 기록)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addBlock(page, `window.addChatBlock?.({ messages: [{ align: 'left', lines: [{ type: 'body', text: '${TXT}', textHtml: '${RICH}' }] }] })`, '.chat-block');
  expect(id).toBeTruthy();
  const s = await chatState(page, id);
  console.log('  O4:', JSON.stringify({ hasRow: s.hasRow, shown: s.shown, bTags: s.bTags }));
  expect(s.hasRow, `★전제 — ★`+'`.ln-row`'+` 가 없다. 잰 값 ${JSON.stringify(s)}`).toBe(true);
  expect(s.bTags, `★★BT2 가 ★textHtml 을 ★안 읽는다 — ★㉮ 판정의 전제가 ★틀렸다(또는 ★입구가 lines 를 걸렀다). 잰 값 ${JSON.stringify(s)}`).toBeGreaterThan(0);
  expect(s.shown, `★글자가 바뀌었다. 잰 값 ${s.shown}`).toContain(TXT);
  expect(errs).toEqual([]);
});
