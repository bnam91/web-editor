/* bubble-sender-align.dom.spec.js — 1010t2b ★실측 전용 (t1bstar · 지디 ⑶ GO 2026-10-10)
 *
 * ★현빈: 「sb_ts0he_0x61u2c - ★중앙정렬 시켰는데 ★발신자이름은 ★안따라옴」
 *
 * ★★이 파일은 ★★«처방을 ★고르지 ★않는다» — ★지디가 ★고른다. ★★여기서는 ★★세 수를 ★갈라 ★잰다:
 *   ⒤ ★★«글자 정렬»과 ★«풍선 ★자체의 정렬»은 ★다른 것인가
 *   ⒥ ★★말꼬리 SVG 가 ★같이 ★움직이나
 *   ⒦ ★★이름표를 ★★«켠» 상태에서 ★무엇이 ★되나
 *
 * ★★실측으로 ★이미 ★안 것(★`t2b-census.md`) — ★★여기서 ★다시 ★안 센다:
 *   `block-factory.js:2814` — ★`.tb-sender-name` 과 `.tb-bubble` 은 ★★★형제다
 *   `prop-text-wireup-align.js:24` — ★말풍선은 ★★`contentEl`(=`.tb-bubble`)에만 ★정렬을 ★건다
 *   ⇒ ★★그래서 ★★«안 따라온다»는 ★★★미구현이다(⛔깨진 것이 ★아니다)
 *
 * ⛔★고정 대기(`waitForTimeout`)를 ★쓰지 ★않는다 — ★★내 ★래칫 자(`dom-fixed-wait-census`)가 ★막는다.
 *   ★★그리고 ★그게 ★맞다: ★이 파일이 ★★그 자의 ★★첫 ★«새 파일»이다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const COND_MS = 15000;
const SEC = `<div class="section-block" id="bA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>`;

/** ★조건이 ★안 서면 ★★제 이름으로 ★던진다 — ★★«전제 미달»과 ★«본 단언 실패»를 ★가른다 */
async function waitFor(page, fn, arg, what) {
  try { await page.waitForFunction(fn, arg, { timeout: COND_MS }); }
  catch (e) { throw new Error(`★★전제 미달 — ${what}. ⛔본 단언까지 ★가지 ★못했다`, { cause: e }); }
}

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
  await waitFor(page, () => !!document.getElementById('bA'), undefined, '섹션 bA 가 ★안 생겼다');
  await page.evaluate(() => window.addSpeechBubbleBlock?.('left'));
  await waitFor(page, () => {
    const b = document.querySelector('#canvas .speech-bubble-block');
    return !!b && !!b.querySelector('.tb-bubble') && !!b.querySelector('.tb-sender-name');
  }, undefined, '말풍선 블록(.tb-bubble ＋ .tb-sender-name)이 ★안 생겼다');
  /* ★사람이 하는 순서 — ★클릭해서 ★고르면 ★패널이 ★뜬다 */
  await page.evaluate(() => {
    const b = document.querySelector('#canvas .speech-bubble-block');
    b.click(); window.showTextProperties?.(b);
  });
  await waitFor(page, () => !!document.querySelector('.prop-align-btn[data-align="center"]'),
    undefined, '★정렬 단추(.prop-align-btn[data-align=center])가 ★패널에 ★안 떴다');
  return errs;
}

/** ★★한 장면의 ★수를 ★전부 ★뜬다 — ★★«무엇이 ★움직였나»를 ★뒤에서 ★견주려고 */
const probe = (page) => page.evaluate(() => {
  const blk = document.querySelector('#canvas .speech-bubble-block');
  const bub = blk.querySelector('.tb-bubble');
  const nm  = blk.querySelector('.tb-sender-name');
  const svg = blk.querySelector('svg');
  const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect();
    return { l: Math.round(b.left), w: Math.round(b.width), cx: Math.round(b.left + b.width / 2) }; };
  const TA = (e) => (e ? getComputedStyle(e).textAlign : null);
  return {
    blkRect: R(blk), bubRect: R(bub), nmRect: R(nm), svgRect: R(svg),
    blkTA: TA(blk), bubTA: TA(bub), nmTA: TA(nm),
    blkInline: blk.style.textAlign || '', bubInline: bub.style.textAlign || '',
    nmDisplay: nm ? getComputedStyle(nm).display : null,
    nmIsSibling: !!(nm && bub && nm.parentElement === bub.parentElement),
    nmText: nm ? nm.textContent.trim().slice(0, 20) : null,
  };
});

/** ★이름표를 ★★«켠다» — ★★기본이 `display:none` 이라 ★★이게 ★⒦ 의 ★전제다 */
async function showSender(page) {
  await waitFor(page, () => !!document.getElementById('bubble-show-sender'),
    undefined, '발신자 토글(#bubble-show-sender)이 ★패널에 ★없다');
  await page.evaluate(() => {
    const t = document.getElementById('bubble-show-sender');
    if (!t.checked) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await waitFor(page, () => {
    const nm = document.querySelector('#canvas .speech-bubble-block .tb-sender-name');
    return !!nm && getComputedStyle(nm).display !== 'none';
  }, undefined, '★이름표를 ★켰는데 ★여전히 ★안 보인다');
}

async function clickCenter(page) {
  await page.evaluate(() => document.querySelector('.prop-align-btn[data-align="center"]').click());
  await waitFor(page, () => {
    const b = document.querySelector('#canvas .speech-bubble-block .tb-bubble');
    return !!b && b.style.textAlign === 'center';
  }, undefined, '중앙정렬을 ★눌렀는데 ★`.tb-bubble` 의 ★인라인 textAlign 이 ★center 가 ★안 됐다');
}

test('⒦ ★전제 — ★이름표를 ★켜면 ★보이고, ★★`.tb-bubble` 의 ★형제다 (★구조)', async ({ page }) => {
  await setup(page);
  await showSender(page);
  const p = await probe(page);
  console.log('    ⒦ ' + JSON.stringify({ nmDisplay: p.nmDisplay, nmIsSibling: p.nmIsSibling, nmText: p.nmText }));
  expect(p.nmDisplay, '★이름표가 ★안 보인다 — ★★이 수들이 ★뜻을 ★잃는다').not.toBe('none');
  expect(p.nmIsSibling, '★★`.tb-sender-name` 이 ★`.tb-bubble` 의 ★형제가 ★아니다 — ★★census 의 ★뿌리가 ★틀렸다').toBe(true);
});

test('⒤ ★★«글자 정렬» vs ★«풍선 자체» — ★중앙정렬 뒤 ★무엇이 ★움직이나', async ({ page }) => {
  await setup(page);
  await showSender(page);
  const before = await probe(page);
  await clickCenter(page);
  const after = await probe(page);
  const d = (k) => ({ before: before[k], after: after[k] });
  console.log('    ⒤ ★인라인: ' + JSON.stringify({ bub: d('bubInline'), blk: d('blkInline') }));
  console.log('    ⒤ ★계산값 textAlign: ' + JSON.stringify({ bub: d('bubTA'), nm: d('nmTA'), blk: d('blkTA') }));
  console.log('    ⒤ ★풍선 자리(cx): ' + JSON.stringify(d('bubRect')));
  console.log('    ⒤ ★이름표 자리(cx): ' + JSON.stringify(d('nmRect')));
  /* ⛔★여기서 ★«옳다/틀렸다»를 ★안 적는다 — ★★수만 ★올린다(지디 ⒡) */
  expect(after.bubInline, '★전제 — ★눌린 뒤 ★`.tb-bubble` 인라인이 ★center').toBe('center');
});

test('⒥ ★말꼬리 SVG 가 ★같이 ★움직이나', async ({ page }) => {
  await setup(page);
  await showSender(page);
  const before = await probe(page);
  await clickCenter(page);
  const after = await probe(page);
  console.log('    ⒥ ★svg 자리: ' + JSON.stringify({ before: before.svgRect, after: after.svgRect }));
  console.log('    ⒥ ★블록 자리: ' + JSON.stringify({ before: before.blkRect, after: after.blkRect }));
  expect(before.svgRect, '★전제 — ★말꼬리 SVG 가 ★있다').not.toBeNull();
});
