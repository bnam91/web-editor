/* shape-star-two-colors.dom.spec.js — ③ ★별점의 ★★«두 색»을 ★★사람이 ★고르고 ★★살아남나
 *   (현빈 2026-10-11 「★주황/회색인데 ★각각 내가 ★다른 색으로 ★빨강/회색 , ★파랑/연파랑
 *    ★이런식으로 하고 싶을 수도 있으니 ★★내가 컨트롤 가능하게 해달라는것」)
 *
 * ★★왜 ★★«spec»이 되었나(지디 GO 2026-10-11) — ★★나는 ★이것을 ★탐침으로 ★먼저 ★쟀고,
 *   ★★그러면 ★★«사람 경로»와 ★★«왕복»이 ★★상시 감시 ★★밖에 ★남는다 ⇒ ★★다음 사람이 ★그 둘을
 *   ★★깨도 ★★아무도 ★모른다. ★★그 둘이 ★★이 기능의 ★★참 과녁이므로 ★★여기로 ★올렸다.
 *
 * ★★★⛔native `<input type="color">` 에 ★기대지 ★마라 — ★★헤드리스에서 ★그것은 ★★OS 대화창이고
 *   ★Playwright 가 ★못 ★연다. ⇒ ★★★«사람 경로»는 ★★`-hex` ★글자칸이다(★진짜 ★타이핑).
 *   ★근거: ★`wireColorField`(js/props/color-picker.js:1263)가 ★★native 와 ★hex 칸을 ★★한 자에서 ★같이 ★쥔다
 *     ⇒ ★hex 칸을 ★치면 ★같은 ★`onApply`·`onCommit` 이 ★돈다. ⇒ ★★값 주입이 ★아니다.
 *
 * ★★평점을 ★★`3` 으로 ★박는다 — ★★첫 측정에서 ★★평점 ★5 로 ★재어 ★★빈 별이 ★0칸이었고
 *   ⇒ ★★«빈 색이 ★칠로 ★나오나»를 ★★아예 ★못 쟀다(★내 흠 · 지디 조건 ⒝).
 *   ⇒ ★★3 이면 ★★두 색이 ★★같이 ★보인다(★채운 3 ＋ ★빈 2).
 *
 * ★★모든 칸이 ★★자기 전제를 ★단언한다(지디 조건 ⒜) — ★★첫 측정에서 ★챗 대조가 ★★`null` 이었고
 *   ★★그건 ★★«죽은 대조»였다(0건이 초록). ⇒ ★★`n > 0` 을 ★★먼저 ★걸고 ★값을 ★본다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const ON_PIN = '#ff0000';          /* ★사람이 ★고른 ★채운 색 — ★기본(주황)과 ★★다른 값이어야 ★뜻이 선다 */
const OFF_PIN = '#add8e6';         /* ★사람이 ★고른 ★빈 색 — ★기본(#d6d6d6)과 ★★다르다 */
const RATING = 3;                  /* ★지디 조건 ⒝ — ★두 색이 ★같이 ★보이는 판 */
const SEC = `<div class="section-block" id="sA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>`;

async function openStarPanel(page) {
  await page.setViewportSize({ width: 1500, height: 950 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('sA'));
    window.addShapeBlock?.('star');
  }, SEC);
  await page.waitForFunction(() => !!document.querySelector('#canvas .shape-block'));
  await page.evaluate(() => window.showShapeProperties?.(document.querySelector('#canvas .shape-block')));
  /* ★★패널이 ★그려졌음을 ★먼저 ★기다린다 — ⛔이 줄을 ★빼면 ★토글을 ★30s ★기다리다 ★죽는다(★실측) */
  await page.waitForFunction(() => !!document.getElementById('shape-star-count-num'));
  await page.locator('#shape-star-rating-toggle').click();
  await page.waitForFunction(() => !!document.getElementById('shape-star-fill-on-hex'));
  return errs;
}

const look = (page) => page.evaluate(() => {
  const b = document.querySelector('#canvas .shape-block');
  return {
    dsOn: b.dataset.starFillOn ?? null, dsOff: b.dataset.starFillOff ?? null,
    fills: [...b.querySelectorAll('svg polygon')].map((p) => p.getAttribute('fill')),
    preview: document.getElementById('shape-star-rating-preview')?.style.color || null,
  };
});

/** ★사람처럼 — ★hex 칸을 ★누르고 ★치고 ★Enter. ⛔`dataset` 에 ★직접 ★쓰지 ★않는다 */
async function typeHex(page, idPrefix, hex) {
  const el = page.locator(`#${idPrefix}-hex`);
  await expect(el, `★전제 — ★${idPrefix} 글자칸이 ★화면에 ★있다`).toBeVisible();
  await el.click();
  await el.fill(hex.replace('#', '').toUpperCase());
  await el.press('Enter');
}

test('X1 ★★사람 경로 — ★hex 칸을 ★치면 ★두 색이 ★★데이터·칠·미리보기에 ★같이 ★선다', async ({ page }) => {
  const errs = await openStarPanel(page);
  const base = await look(page);
  /* ★전제 ⒜ — ★처음엔 ★두 키가 ★★없다(★옛 저장본과 ★바이트 ★같다) */
  expect(base.dsOn, '★전제 — ★처음엔 ★채운 색 키가 ★없다').toBeNull();
  expect(base.dsOff, '★전제 — ★처음엔 ★빈 색 키가 ★없다').toBeNull();
  /* ★전제 ⒝ — ★★별이 ★★5개 ★그려져 있다(⛔0개면 ★아래 ★칠 단언이 ★전부 ★빈 배열로 ★참이 된다) */
  expect(base.fills.length, `★전제 — ★별 polygon 수 (잰 값: ${base.fills.length})`).toBe(5);

  await page.locator('#shape-star-rating-num').fill(String(RATING));
  await page.locator('#shape-star-rating-num').press('Enter');
  await typeHex(page, 'shape-star-fill-on', ON_PIN);
  await typeHex(page, 'shape-star-fill-off', OFF_PIN);
  const got = await look(page);

  expect(got.dsOn, `★채운 색이 ★데이터에 ★안 섰다 (잰 값: ${got.dsOn})`).toBe(ON_PIN);
  expect(got.dsOff, `★빈 색이 ★데이터에 ★안 섰다 (잰 값: ${got.dsOff})`).toBe(OFF_PIN);
  /* ★★두 색이 ★★같이 ★보이는 판 — ★채운 3 ＋ ★빈 2 */
  expect(got.fills, `★칠 (잰 값: ${JSON.stringify(got.fills)})`)
    .toEqual([ON_PIN, ON_PIN, ON_PIN, OFF_PIN, OFF_PIN]);
  /* ★미리보기도 ★같은 자에서 ★파생되나 — ★rgb 로 ★계산되어 ★온다 */
  expect(got.preview, `★미리보기 색 (잰 값: ${got.preview})`).toBe('rgb(255, 0, 0)');
  expect(errs, `★pageerror (잰 값: ${JSON.stringify(errs.slice(0, 2))})`).toEqual([]);
});

test('X2 ★★왕복 — ★저장했다 ★다시 열면 ★두 색이 ★★칠까지 ★돌아온다', async ({ page }) => {
  await openStarPanel(page);
  await page.locator('#shape-star-rating-num').fill(String(RATING));
  await page.locator('#shape-star-rating-num').press('Enter');
  await typeHex(page, 'shape-star-fill-on', ON_PIN);
  await typeHex(page, 'shape-star-fill-off', OFF_PIN);
  const before = await look(page);
  /* ★전제 — ★저장 ★전에 ★두 색이 ★★참으로 ★칠에 ★있다(⛔없으면 ★왕복이 ★«없던 것»을 ★잰다) */
  expect(before.fills, '★전제 — ★저장 전 ★칠').toEqual([ON_PIN, ON_PIN, ON_PIN, OFF_PIN, OFF_PIN]);

  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    const out = window.serializeSectionClone ? window.serializeSectionClone(sec) : sec.outerHTML;
    return typeof out === 'string' ? out : (out && out.outerHTML) || '';
  });
  /* ★전제 — ★저장본이 ★★글자이고 ★비지 ★않았다 */
  expect(typeof saved, '★전제 — ★저장본이 ★문자열').toBe('string');
  expect(saved.length, `★전제 — ★저장본 길이 (잰 값: ${saved.length})`).toBeGreaterThan(100);
  expect(saved, '★저장본에 ★채운 색 키가 ★없다').toContain('star-fill-on');
  expect(saved, '★저장본에 ★빈 색 키가 ★없다').toContain('star-fill-off');

  const after = await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
    const b = document.querySelector('#canvas .shape-block');
    return { dsOn: b.dataset.starFillOn ?? null, dsOff: b.dataset.starFillOff ?? null,
      fills: [...b.querySelectorAll('svg polygon')].map((p) => p.getAttribute('fill')) };
  }, saved);
  expect(after.dsOn, '★불러온 뒤 ★채운 색 키').toBe(ON_PIN);
  expect(after.dsOff, '★불러온 뒤 ★빈 색 키').toBe(OFF_PIN);
  /* ★★★«다시 쓰일 때»로 ★잰다 — ⛔키만 ★보고 ★닫지 ★않는다(★내 교훈: ★손실 판정은 ★꺼낼 때) */
  expect(after.fills, `★불러온 뒤 ★칠 (잰 값: ${JSON.stringify(after.fills)})`)
    .toEqual([ON_PIN, ON_PIN, ON_PIN, OFF_PIN, OFF_PIN]);
});

test('X3 ★★음성대조 — ★챗 별점 색은 ★★그대로다 (지디 판정: ★쉐이프만 ★간다)', async ({ page }) => {
  await openStarPanel(page);
  await typeHex(page, 'shape-star-fill-on', ON_PIN);
  const chat = await page.evaluate(() => {
    /* ⛔섹션 선택이 ★풀려 있으면 ★블록이 ★안 생긴다 — ★★먼저 ★고른다(★실측으로 ★찾은 ★죽은 대조의 ★까닭) */
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.querySelector('#canvas .section-block'));
    window.addChatBlock?.({ messages: [{ text: '별', align: 'left', stars: 4 }] });
    const blk = document.querySelector('#canvas .chat-block');
    if (!blk) return { n: 0, colors: [] };
    window.renderChatBlock?.(blk);
    const sp = [...blk.querySelectorAll('.chb-stars span')];
    return { n: sp.length, colors: sp.map((x) => x.style.color) };
  });
  /* ★★전제 ⒜ — ★★대조가 ★살아 있나. ⛔`n === 0` 이면 ★아래는 ★★«안 쟀다»다 */
  expect(chat.n, `★★음성대조가 ★죽었다 — ★챗 별 span 이 ★0개다 (잰 값: ${JSON.stringify(chat)})`).toBe(5);
  /* ★★쉐이프에서 ★빨강을 ★골랐는데 ★챗은 ★★기본 두 색 ★그대로여야 ★한다 */
  expect(chat.colors.slice(0, 4), `★챗 ★채운 별 색 (잰 값: ${JSON.stringify(chat.colors)})`)
    .toEqual(['rgb(255, 138, 0)', 'rgb(255, 138, 0)', 'rgb(255, 138, 0)', 'rgb(255, 138, 0)']);
  expect(chat.colors[4], `★챗 ★빈 별 색 (잰 값: ${chat.colors[4]})`).toBe('rgb(214, 214, 214)');
});
