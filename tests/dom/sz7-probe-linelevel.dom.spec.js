/* sz7-probe-linelevel.dom.spec.js — ★① 측정: ★「형광펜·점이 ★«줄 전체»로는 ★지금 ★되나」
 *   ★지디 2026-10-08 지시: 「★누구도 안 쟀다 · ★5분 측정이 ★범위를 가른다 · ★그것부터」
 *
 * ★★무엇을 재나 — ⒜ ★그리드 줄 패널에 ★그 단추가 ★있나 ⒝ ★다른 블럭엔 ★있나(★자가 보는가)
 *   ⛔「★없다」를 ★«내 자가 못 본다»와 ★구분해야 한다 ⇒ ★★교차 대조를 ★같이 세운다:
 *     ★텍스트블럭 패널(`p:'txt'`)은 ★`showUnderline:true`·`showDots:true` 를 ★준다
 *       (`js/props/prop-text-template.js:161·164`) ⇒ ★★거기엔 ★있어야 한다.
 *     ★★거기서 ★보이고 ★그리드에서 ★안 보이면 ⇒ ★★«진짜 없다»다.
 *     ★★거기서도 ★안 보이면 ⇒ ★★«내 자가 못 본다»다(★측정 실패 — 결론 금지).
 *
 * ★소스가 미리 말한 것(★행위로 다시 재는 중): `js/props/prop-grid.js:2849` ★`showHighlight: false`
 *   ＋ `showDots`·`showUnderline` 을 ★아예 ★안 넘긴다(기본 false) ⇒ ★셋 다 ★없을 것.
 *   ⚠️그 `showHighlight:false` 는 ★★«빠뜨린 것이 아니다» — ★그 자리 주석이 ★까닭을 적어 뒀고
 *     ★`tests/unit/grid-line-typo.test.js` ★U1-c 가 ★그 한 줄을 ★지키고 있다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js sz7-probe-linelevel
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';

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

/** 패널에 그 id 들이 ★있나 — ★`document` 전체에서 센다(패널은 캔버스 밖이다). */
const btns = (page, p) => page.evaluate((pre) => {
  const q = (n) => !!document.getElementById(`${pre}${n}`);
  return { bold: q('bold-btn'), italic: q('italic-btn'), strike: q('strike-btn'),
           underline: q('underline-btn'), highlight: q('highlight-btn'), dot: q('dot-btn') };
}, p);

test('P2 ★★① 측정 — 그리드 «줄» 패널에 형광펜·점·밑줄 단추가 있나 (＋교차대조)', async ({ page }) => {
  const errs = await setup(page);

  /* ══ ⒝ ★먼저 ★교차대조 — ★텍스트블럭 패널엔 ★있어야 한다(★자가 보는가) ══ */
  const txtId = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addTextBlock?.('body');
    const f = [...document.querySelectorAll('#canvas .text-block')].filter(e => !before.has(e.id));
    return f.length ? f[f.length - 1].id : null;
  });
  expect(txtId, '★전제 — 텍스트블럭이 안 들어갔다. ★교차대조를 못 세우면 아래 「없다」는 ★결론이 못 된다').toBeTruthy();
  await page.evaluate((i) => { window.showTextProperties?.(document.getElementById(i)); }, txtId);
  await page.waitForTimeout(350);
  const T = await btns(page, 'txt-');
  console.log('  P2 텍스트블럭(txt-):', JSON.stringify(T));
  expect(T.bold, `★전제 — 텍스트 패널에 ★B 조차 없다(패널이 안 떴다). 잰 값 ${JSON.stringify(T)}`).toBe(true);
  /* ★★이 셋이 ★여기서 ★보여야 ★내 자가 ★«그 단추를 볼 수 있다»가 참이 된다 */
  expect(T.highlight, `★★교차대조 실패 — 형광펜을 ★켜는 패널에서도 ★안 보인다 ⇒ ★내 자가 ★못 본다(★측정 실패). 잰 값 ${JSON.stringify(T)}`).toBe(true);
  expect(T.dot, `★★교차대조 실패 — 점을 ★켜는 패널에서도 ★안 보인다 ⇒ ★내 자가 ★못 본다. 잰 값 ${JSON.stringify(T)}`).toBe(true);
  expect(T.underline, `★★교차대조 실패 — 밑줄을 ★켜는 패널에서도 ★안 보인다 ⇒ ★내 자가 ★못 본다. 잰 값 ${JSON.stringify(T)}`).toBe(true);

  /* ══ ⒜ ★그리드 ★줄 패널 — ★사람 순서로 ★줄에 들어간다 ══ */
  const gid = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addGridBlock?.({});
    const f = [...document.querySelectorAll('#canvas .grid-block')].filter(e => !before.has(e.id));
    return f.length ? f[f.length - 1].id : null;
  });
  expect(gid, '★그리드가 안 들어갔다').toBeTruthy();
  await page.waitForTimeout(300);
  const sel = `#${gid} .grd-line`;
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);          // ★앱의 그 제스처 = 줄 편집 ＋ 줄 선택
  await page.waitForTimeout(450);
  /* ★전제 — ★줄이 ★실제로 ★«선택»됐나(패널이 ★그 줄을 보고 있나) */
  const ce = await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel);
  expect(ce, '★전제 — 줄 편집에 못 들어갔다 ⇒ 패널이 그 줄을 안 본다').toBe('true');
  const G = await btns(page, 'grd-typo-');
  console.log('  P2 그리드 줄(grd-typo-):', JSON.stringify(G));
  expect(G.bold, `★전제 — 그리드 줄 패널에 ★B 조차 없다(패널이 안 떴다) ⇒ 아래 「없다」가 ★공짜가 된다. 잰 값 ${JSON.stringify(G)}`).toBe(true);

  /* ══ ★★측정 결과 — ★2026-10-08 ★그대로 적는다 ══
     ⛔「그래야 한다」가 아니다. ★결정(현빈 「다 하자」)이 ★구현되면 ★이 단언을 ★뒤집어라. */
  expect(G.highlight, `★★형광펜 단추가 ★그리드 줄 패널에 ★생겼다 — ★구현됐으면 ★이 단언을 뒤집어라. 잰 값 ${JSON.stringify(G)}`).toBe(false);
  expect(G.dot, `★★점 단추가 ★생겼다 — ★구현됐으면 ★뒤집어라. 잰 값 ${JSON.stringify(G)}`).toBe(false);
  expect(G.underline, `★★밑줄 단추가 ★생겼다 — ★구현됐으면 ★뒤집어라. 잰 값 ${JSON.stringify(G)}`).toBe(false);
  expect(errs).toEqual([]);
});
