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
 * ⚠️★★미확정 — ★★«사람이 ★타이핑해도 ★그 폭이 ★되나»는 ★★안 쟀다(★지디 지적 2026-10-10).
 *   ★⒧ 는 ★글을 ★★`textContent` 로 ★심는다 ⇒ ★★★«앱에서 ★그 꼴이 ★생기나»를 ★★안 밟았다
 *   ⇒ ★★그래서 ★★«풍선 폭 >300」을 ★★전제로 ★걸었다 — ★★그 전제가 ★그 빈 칸을 ★★덮지는 ★못한다
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
  /* ★★★상자가 아니라 ★«글자»가 ★움직였나 — ★Range 로 ★글리프의 ★실제 자리를 ★잰다.
     ⛔상자(rect)만 보면 ★«넓은 풍선 안에서 ★글자가 ★가운데로 간 것»을 ★★놓친다(★좁은 판에서 ★내가 놓쳤다) */
  const textRect = (e) => {
    if (!e || !e.firstChild) return null;
    const r = document.createRange();
    try { r.selectNodeContents(e); } catch (_) { return null; }
    const b = r.getBoundingClientRect();
    if (!b || !b.width) return null;
    return { l: Math.round(b.left), w: Math.round(b.width), cx: Math.round(b.left + b.width / 2) };
  };
  return {
    blkRect: R(blk), bubRect: R(bub), nmRect: R(nm), svgRect: R(svg),
    blkTA: TA(blk), bubTA: TA(bub), nmTA: TA(nm),
    blkInline: blk.style.textAlign || '', bubInline: bub.style.textAlign || '',
    nmDisplay: nm ? getComputedStyle(nm).display : null,
    nmIsSibling: !!(nm && bub && nm.parentElement === bub.parentElement),
    nmText: nm ? nm.textContent.trim().slice(0, 20) : null,
    bubTextRect: textRect(bub), nmTextRect: textRect(nm),
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
  /* ★★★좁은 판의 ★«글자» — ★★앞 회차에 ★내가 ★안 쟀다(★상자만 ★봤다 · 지디 ⑸ 지적) */
  console.log('    ⒤ ★★풍선 ★글자(Range): ' + JSON.stringify(d('bubTextRect')));
  console.log('    ⒤ ★★이름표 ★글자(Range): ' + JSON.stringify(d('nmTextRect')));
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


/* ══ ★★★⒧ ★★«넓은 풍선» 판 — ★★★지디 ⑴⑵ (2026-10-10 21:1x) ═══════════════════════
 * ★★왜 ★이 판이 ★필요한가 — ★★★현빈의 ★낱말이 ★내 ★앞 수를 ★반증한다:
 *   ★그는 ★「★중앙정렬 시켰는데 ★★이름표는 ★안따라옴」이라 ★썼다
 *   ⇒ ★★★즉 ★★«무엇인가는 ★따라왔다» ⇒ ★★그의 판에서는 ★★★본문이 ★진짜로 ★움직였다
 *   ⇒ ★★그런데 ★내 ★앞 판은 ★★«아무것도 ★안 움직였다»였다(★풍선 폭 155 · ★블록 403)
 *   ⇒ ★★★그러면 ★★★내 기준판이 ★★«그의 장면»이 ★아니었다
 * ★★그래서 ★★★저장본 없이 ★★그 조건을 ★★만든다 — ★★긴 글로 ★풍선을 ★넓힌다
 * ⚠️★★정직하게: ★글은 ★★`textContent` 로 ★★심는다(⛔제품 길인 ★타이핑이 ★아니다)
 *   ⇒ ★★그래서 ★★★«풍선이 ★참으로 ★넓어졌나»를 ★★조건으로 ★먼저 ★기다린다 — ★그게 ★이 판의 ★전제다 */
const LONG = '이것은 말풍선의 본문이 블록 폭에 가까워지도록 충분히 길게 넣은 글이다. 중앙정렬이 글자에 보이는지 잰다.';

async function widen(page) {
  await page.evaluate((t) => {
    const b = document.querySelector('#canvas .speech-bubble-block .tb-bubble');
    b.textContent = t;
    b.dataset.isPlaceholder = 'false';
  }, LONG);
  await waitFor(page, () => {
    const b = document.querySelector('#canvas .speech-bubble-block .tb-bubble');
    return !!b && b.getBoundingClientRect().width > 300;
  }, undefined, '긴 글을 넣었는데 ★풍선 폭이 ★300 을 ★안 넘었다(★이 판의 ★전제다)');
}

test('⒧ ★★넓은 풍선 — ★★★«글자»가 ★움직이나 (★★좁은 판과 ★나란히 본다)', async ({ page }) => {
  await setup(page);
  await showSender(page);
  await widen(page);
  const before = await probe(page);
  await clickCenter(page);
  const after = await probe(page);
  const d = (k) => ({ before: before[k], after: after[k] });
  console.log('    ⒧ ★풍선 ★상자: ' + JSON.stringify(d('bubRect')));
  console.log('    ⒧ ★★풍선 ★글자(Range): ' + JSON.stringify(d('bubTextRect')));
  console.log('    ⒧ ★이름표 ★상자: ' + JSON.stringify(d('nmRect')));
  console.log('    ⒧ ★★이름표 ★글자(Range): ' + JSON.stringify(d('nmTextRect')));
  console.log('    ⒧ ★계산값: ' + JSON.stringify({ bub: d('bubTA'), nm: d('nmTA') }));
  expect(after.bubInline, '★전제 — ★눌린 뒤 ★`.tb-bubble` 인라인이 ★center').toBe('center');
  expect(before.bubRect.w, `★전제 — ★풍선이 ★넓어졌다 (잰 값: ${before.bubRect.w})`).toBeGreaterThan(300);
});

/* ══ ★★★⒨ ★처방을 ★잠근다 — ★★⒝(★이름표에 ★따로) ★판정 2026-10-10(지디) ═══════════════
 * ★★처방: ★`applyBubbleSenderAlign`(★`js/props/prop-text-wireup-align.js`) ★한 자리
 *   ⇒ ★★호출자 ★둘: ⒜ ★그 파일의 ★정렬 단추 ⒝ ★`prop-page.js` 의 ★쪽 전체 ★일괄 정렬
 *   ⇒ ★★★사본을 ★두지 ★않았다 — ★★그 규칙이 ★★두 자리에 ★있었다(★실측)
 *
 * ★★★⒥ ★음성대조의 ★★참 꼴 — ⛔«말꼬리는 ★안 움직인다»로 ★걸 수 ★없다:
 *   ★★실측(★⒥ 칸): ★고치기 ★전에도 ★★말꼬리가 ★움직였다(★svg cx ★546 → ★558)
 *   ⇒ ★★그건 ★★`.tb-bubble` ★자신의 ★정렬이 ★레이아웃을 ★바꿔서다 — ★★내 처방과 ★무관하다
 *   ⇒ ★★★그래서 ★★«움직임»으로는 ★⒜ 와 ⒝ 를 ★못 가른다
 *   ⇒ ★★★참 ★판별자 = ★★★«블록(`tb`)에 ★인라인 ★textAlign 이 ★붙었나»
 *        ⒜(★블록에 걸기)면 ★★붙는다 · ★★⒝(★이름표에 걸기)면 ★★안 붙는다
 *   ⇒ ★★★즉 ★누가 ★나중에 ★⒜ 로 ★바꾸면 ★★이 칸이 ★빨개진다 ⇒ ★★판정이 ★★구조로 ★남는다 */
test('⒨ ★처방 — ★이름표가 ★따라오고, ★★블록엔 ★★인라인 정렬이 ★★안 붙는다 (★⒜/⒝ 판별자)', async ({ page }) => {
  await setup(page);
  await showSender(page);
  await widen(page);
  const before = await probe(page);
  await clickCenter(page);
  const after = await probe(page);
  /* ★★제 상자 기준 — ⛔절대 cx 는 ★판 밀림에 ★속는다(★이 파일 머리말) */
  const rel = (p) => (p.nmTextRect && p.nmRect ? p.nmTextRect.cx - p.nmRect.cx : null);
  console.log('    ⒨ ★이름표 ★글자(★제 상자 기준): ' + JSON.stringify({ before: rel(before), after: rel(after) }));
  console.log('    ⒨ ★이름표 계산값: ' + JSON.stringify({ before: before.nmTA, after: after.nmTA }));
  console.log('    ⒨ ★블록 ★인라인: ' + JSON.stringify({ before: before.blkInline, after: after.blkInline }));
  console.log('    ⒨ ★말꼬리 cx: ' + JSON.stringify({ before: before.svgRect, after: after.svgRect }));

  /* ⒜ ★★본 단언 — ★이름표가 ★따라온다 */
  expect(after.nmTA, '★★이름표가 ★안 따라왔다 — ★★`applyBubbleSenderAlign` 이 ★안 불렸거나 ★죽었다').toBe('center');
  const r0 = rel(before), r1 = rel(after);
  expect(Math.abs(r1), `★★이름표 ★글자가 ★제 상자 ★가운데로 ★안 왔다 (★전 ${r0} → ★후 ${r1})`)
    .toBeLessThan(Math.abs(r0));

  /* ⒝ ★★★음성대조 = ★★판별자 — ★★블록엔 ★인라인 정렬이 ★★붙지 ★않는다(⛔그게 ⒜ 다) */
  expect(after.blkInline, '★★블록에 ★인라인 ★textAlign 이 ★붙었다 — ★★그건 ★⒜(블록에 걸기)다. '
    + '★★판정 2026-10-10(지디)은 ★★⒝(이름표에 따로)다: ★★⒜ 는 ★말꼬리까지 ★움직여 '
    + '★★★현빈이 ★요청하지 ★않은 ★변화를 ★만든다').toBe('');
  expect(after.blkTA, '★★블록의 ★계산값이 ★center 가 ★됐다 — ★★위와 ★같은 까닭').not.toBe('center');
});
