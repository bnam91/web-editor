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
  /* ★1012t1M2 — 배율 보간(.15s transform)이 끝난 뒤에 재게 한다: 화면 폭 ÷ 배율 = layout 폭.
     안 기다리면 첫 측정이 보간 중 rect 다(이벨 실측 ⒮ 첫 판 bodyW 351.5/372.3 vs 정착 348.5 — 2/2 빨강). */
  await waitFor(page, () => {
    const q = document.querySelector('#canvas .speech-bubble-block .tb-bubble');
    return !!q && Math.abs(q.getBoundingClientRect().width / ((window.currentZoom || 100) / 100) - q.offsetWidth) < 0.5;
  }, undefined, '배율 보간이 안 끝났다(화면 폭 ÷ 배율 ≠ layout 폭)');
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
    /* ★★★레이아웃 px — ⛔`getBoundingClientRect()` 는 ★★배율(`scale()`)을 ★★먹는다.
       ★실측(★r14 8벌 판): ★배율이 ★★40% 였다 ⇒ ★layout 307px 가 ★화면 ★123px 로 ★보였다
       ⇒ ★★그래서 ★«폭 >300」을 ★★화면 px 로 ★재면 ★★★영영 ★안 선다 */
    bubOffsetW: bub ? bub.offsetWidth : null,
    blkOffsetW: blk ? blk.offsetWidth : null,
    zoom: (() => { try { return Math.round((window.currentZoom ?? 100)); } catch (_) { return null; } })(),
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
  /* ★★★배율에 ★안 매달리는 ★자로 ★기다린다 — ★`offsetWidth` 는 ★★레이아웃 px 다.
     ⛔★앞 판은 ★`getBoundingClientRect().width`(★화면 px)로 ★쟀다 ⇒ ★★r14 의 ★8벌 판에서
       ★★배율이 ★40% 라 ★★★전제가 ★영영 ★안 섰다(★★부하가 ★아니다 — ★load 는 ★더 ★낮았다) */
  /* ★★★«실패할 때만» 이 ★아니라 ★★★«항상» 찍는다 (★지디 판정 2026-10-11).
   *   ★★까닭: ★★배율은 ★★회차마다 ★다르다 — ★1벌 판에서 ★100% · ★8벌 판에서 ★★40% 였다
   *   ⇒ ★★★그 수가 ★로그에 ★★남아야 ★★«누가 ★남겼나»를 ★다음 회차가 ★스스로 ★답한다
   *   ⇒ ★★그리고 ★★★내 spec 은 ★★zoom 을 ★안 만진다(★census: ★배율 만지는 ★160벌에 ★안 든다)
   *     ⇒ ★★★그러니 ★★회차 ★시작 값이 ★40 이면 ★★★남이 ★남긴 것이거나 ★앱의 ★자동 맞춤이다
   *   ⛔★`globalSetup/Teardown` 은 ★안 쓴다 — ★88 레인 ★공유(★TK-L22 와 ★같은 자리) */
  const z0 = await page.evaluate(() => ({
    zoom: window.currentZoom ?? null,
    bubOffsetW: document.querySelector('#canvas .speech-bubble-block .tb-bubble')?.offsetWidth ?? null,
    bubScreenW: Math.round(document.querySelector('#canvas .speech-bubble-block .tb-bubble')
      ?.getBoundingClientRect().width ?? 0),
  })).catch(() => null);
  console.log('    ★★배율·폭(★항상): ' + JSON.stringify(z0));
  try {
    await page.waitForFunction(() => {
      const b = document.querySelector('#canvas .speech-bubble-block .tb-bubble');
      return !!b && b.offsetWidth > 300;
    }, undefined, { timeout: COND_MS });
  } catch (e) {
    /* ★★실패하면 ★★잰 값을 ★전부 ★찍는다 — ★★«왜 ★안 섰나»가 ★로그에 ★남게(지디 ⒜) */
    const m = await page.evaluate(() => {
      const b = document.querySelector('#canvas .speech-bubble-block .tb-bubble');
      const blk = document.querySelector('#canvas .speech-bubble-block');
      return b ? {
        offsetW: b.offsetWidth, screenW: Math.round(b.getBoundingClientRect().width),
        blkOffsetW: blk ? blk.offsetWidth : null, zoom: window.currentZoom ?? null,
        len: (b.textContent || '').length,
      } : null;
    }).catch(() => null);
    throw new Error('★★전제 미달 — ★풍선 ★레이아웃 폭이 ★300 을 ★안 넘었다. ★잰 값: '
      + JSON.stringify(m) + '. ⛔본 단언까지 ★가지 ★못했다', { cause: e });
  }
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
  /* ⛔★화면 px(`bubRect.w`)로 ★걸지 ★마라 — ★★배율 40% 판에서 ★★거짓 빨강이 ★난다(★r14 실측) */
  expect(before.bubOffsetW, `★전제 — ★풍선 ★레이아웃 폭이 ★넓어졌다 `
    + `(잰 값: offsetW ${before.bubOffsetW} · 화면 ${before.bubRect.w} · 배율 ${before.zoom}%)`)
    .toBeGreaterThan(300);
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

/* ══ ⒩ ★★«여러 개 고르고 ★정렬» 경로 (현빈 1010t2b ★재부상 · 지디 GO 2026-10-11) ═══════════
 * ★★왜 ★생겼나 — ★위 ⒨ 는 ★★«한 개 고르고 ★정렬 버튼»만 ★잠근다.
 *   ★실측 2026-10-11(★배율 ★40%): ★★그 경로는 ★고쳐져 있었다(nmAlign start→center · ★글자 ★159px)
 *   ★★그런데 ★★«여러 개»를 ★고르고 ★정렬하면 ★★이름이 ★★안 따라왔다(nmAlign ★start · ★글자 ★★0px)
 *   ★까닭: ★`prop-multisel.js` 의 ★`alignFlowBlock` 이 ★`contentEl`·`b` 만 ★쓰고
 *     ★★`.tb-sender-name` 을 ★★한 번도 ★안 봤다 ⇒ ★★그 자를 ★부르게 ★엮었다.
 *
 * ★★«사람 경로»다 — ★선택은 ★`#canvas .selected` 로 ★살고(`prop-multisel.js:356`),
 *   ★패널은 ★`showFlowMultiSelPanel()` 이 ★그리고, ★★그 패널의 ★`.prop-align-btn[data-align]` 을
 *   ★★진짜 ★click 하면 ★`_applyFlowAlign` → ★`alignFlowBlock` 이 ★돈다(:668~669).
 *   ⛔`alignFlowBlock` 을 ★직접 ★부르지 ★않는다 — ★★그러면 ★버튼 배선이 ★안 재진다.
 */
test('⒩ ★★여러 개 고르고 ★정렬해도 ★이름표가 ★따라온다 (★다중선택 경로)', async ({ page }) => {
  const errs = await setup(page);
  await showSender(page);
  /* ★둘째 말풍선을 ★하나 ★더 — ★★«여러 개»가 ★참으로 ★서게 */
  await page.evaluate(() => window.addSpeechBubbleBlock?.('left'));
  await waitFor(page, () => document.querySelectorAll('#canvas .speech-bubble-block').length === 2,
    undefined, '★말풍선이 ★2개가 ★안 됐다');
  await page.evaluate(() => {
    document.querySelectorAll('#canvas .speech-bubble-block').forEach((b) => {
      b.classList.add('selected');
      const nm = b.querySelector('.tb-sender-name');
      if (nm) { nm.style.display = ''; nm.textContent = '홍길동'; nm.style.textAlign = ''; }
      const bub = b.querySelector('.tb-bubble');
      if (bub) bub.style.textAlign = '';
    });
    window.showFlowMultiSelPanel?.();
  });
  /* ★★전제 ⑴ — ★★«여러 개»가 ★참으로 ★골라졌나(지디 조건) */
  const selN = await page.evaluate(() => document.querySelectorAll('#canvas .selected').length);
  expect(selN, `★전제 — ★고른 블록이 ★2개여야 한다 (잰 값: ${selN})`).toBe(2);
  /* ★★전제 ⑵ — ★★다중선택 ★패널의 ★정렬 단추가 ★떴나 */
  const btnN = await page.evaluate(() =>
    document.querySelectorAll('.prop-align-btn[data-align="center"]').length);
  expect(btnN, `★전제 — ★정렬 단추가 ★패널에 ★있다 (잰 값: ${btnN})`).toBeGreaterThan(0);

  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .speech-bubble-block')]
    .map((b) => getComputedStyle(b.querySelector('.tb-sender-name')).textAlign));
  /* ★★사람처럼 — ★그 단추를 ★진짜 ★누른다 */
  await page.locator('.prop-align-btn[data-align="center"]').last().click();
  const after = await page.evaluate(() => [...document.querySelectorAll('#canvas .speech-bubble-block')]
    .map((b) => ({
      nmAlign: getComputedStyle(b.querySelector('.tb-sender-name')).textAlign,
      blkInline: b.style.textAlign || '',
    })));
  console.log(`    ★이름 textAlign — ★전 ${JSON.stringify(before)} → ★후 ${JSON.stringify(after.map((x) => x.nmAlign))}`);
  for (const [i, x] of after.entries()) {
    expect(x.nmAlign, `★${i}번 말풍선의 ★이름표가 ★안 따라왔다 (잰 값: ${x.nmAlign})`).toBe('center');
    /* ★⒜/⒝ ★판별자 — ★★블록엔 ★인라인 정렬이 ★안 붙어야 한다(★⒨ 와 ★같은 자) */
    expect(x.blkInline, `★${i}번 블록에 ★인라인 정렬이 ★붙었다 (잰 값: ${x.blkInline})`).toBe('');
  }
  expect(errs, `★pageerror (잰 값: ${JSON.stringify(errs.slice(0, 2))})`).toEqual([]);
});

/* ══ 1012t1M2-a ⒪⒫ — 말꼬리 「—」(가운데)면 이름도 «몸통 위 가운데» (S4 유닛 M · 2026-10-12) ══════════
 * ★재현(9436 · 새로 만든 말풍선 — sb_ts0he_0x61u2c 사본은 없다): 말꼬리 「—」를 누르면 몸통은 블럭 가운데로 가는데
 *   이름은 왼쪽 끝에 남았다 — dLayout(이름 글자 cx − 몸통 상자 cx, layout px) −40 → −337 (zoom 40·100 같은 수).
 * ★판정 자 = dLayout(배율로 나눈 layout px) · |dLayout| ≤ 2 면 «따라왔다». */
const dLayoutProbe = (page) => page.evaluate(() => {
  const b = document.querySelector('#canvas .speech-bubble-block');
  const bub = b.querySelector('.tb-bubble'), nm = b.querySelector('.tb-sender-name');
  const s = (window.currentZoom || 100) / 100;
  const r = document.createRange(); r.selectNodeContents(nm);
  const t = r.getBoundingClientRect(), q = bub.getBoundingClientRect(), br = b.getBoundingClientRect();
  return {
    zoom: window.currentZoom, tail: b.dataset.tail, nmInline: nm.style.textAlign || '',
    nmShown: getComputedStyle(nm).display !== 'none', nmW: t.width,
    dLayout: Math.round((t.left + t.width / 2 - (q.left + q.width / 2)) / s),
    bodyVsBlk: Math.round((q.left + q.width / 2 - (br.left + br.width / 2)) / s),
  };
});

test('⒪ 1012t1M2-a ★말꼬리 「—」 → 이름 글자가 몸통 가운데 위 (|dLayout| ≤ 2)', async ({ page }) => {
  const errs = await setup(page);
  await showSender(page);
  const before = await dLayoutProbe(page);
  await page.locator('#bubble-tail-center').click();   // ★사람 손 — 진짜 클릭
  await waitFor(page, () => document.querySelector('#canvas .speech-bubble-block')?.dataset.tail === 'center',
    undefined, '말꼬리 「—」를 눌렀는데 data-tail 이 center 가 안 됐다');
  const after = await dLayoutProbe(page);
  console.log('    ⒪ ' + JSON.stringify({ before, after }));
  expect(after.nmShown && after.nmW > 0, '★전제 — 이름표가 보이고 글자가 있다').toBe(true);
  expect(Math.abs(after.bodyVsBlk), `★전제 — 몸통이 블럭 가운데로 갔다 (잰 값 ${after.bodyVsBlk})`).toBeLessThanOrEqual(2);
  expect(Math.abs(after.dLayout), `이름이 몸통 가운데에 안 왔다 — dLayout ${before.dLayout} → ${after.dLayout} (zoom ${after.zoom})`)
    .toBeLessThanOrEqual(2);
  expect(errs, `pageerror ${JSON.stringify(errs.slice(0, 2))}`).toEqual([]);
});

test('⒫ 1012t1M2-a ★정렬 단추 left 를 먼저 눌러 둔 뒤 말꼬리 「—」 → 인라인 잔재가 안 이긴다', async ({ page }) => {
  const errs = await setup(page);
  await showSender(page);
  await page.evaluate(() => document.querySelector('.prop-align-btn[data-align="left"]').click());
  await waitFor(page, () => document.querySelector('#canvas .speech-bubble-block .tb-sender-name')?.style.textAlign === 'left',
    undefined, '★전제 — 정렬 left 뒤 이름표 인라인 textAlign 이 left 가 안 됐다');
  await page.locator('#bubble-tail-center').click();
  await waitFor(page, () => document.querySelector('#canvas .speech-bubble-block')?.dataset.tail === 'center',
    undefined, '말꼬리 「—」를 눌렀는데 data-tail 이 center 가 안 됐다');
  const after = await dLayoutProbe(page);
  console.log('    ⒫ ' + JSON.stringify(after));
  expect(after.nmInline, '말꼬리를 바꿨는데 이름표 인라인 textAlign 이 남았다').toBe('');
  expect(Math.abs(after.dLayout), `이름이 몸통 가운데에 안 왔다 — dLayout ${after.dLayout}`).toBeLessThanOrEqual(2);
  expect(errs, `pageerror ${JSON.stringify(errs.slice(0, 2))}`).toEqual([]);
});

/* ══ 1012t1M2-b ⒬⒭⒮⒯ — 정렬 단추 center = 이름이 «몸통 위 가운데» (S4 유닛 M · 2026-10-12) ══════════
 * ★재현(9436 · 새 말풍선): 정렬 단추 center 뒤 dLayout 좁은 풍선 −40 → +287 · 넓은 −244 → +83 · 말꼬리 right +40 → −287
 *   (zoom 40·100 같은 수) — 이름은 «블럭» 가운데로 갔고 몸통은 제자리였다.
 * ★고침: 이름표가 보일 때만 블럭을 한 열 grid(fit-content(80%))로 — 이름과 몸통이 같은 폭의 열을 쓴다.
 * ★⒮ 가 «이름을 끈 말풍선은 그대로»와 «이름을 켜도 몸통·말꼬리 가로 자리가 그대로»를 잰다. */
const geom = (page) => page.evaluate(() => {
  const b = document.querySelector('#canvas .speech-bubble-block');
  const s = (window.currentZoom || 100) / 100, br = b.getBoundingClientRect();
  const q = b.querySelector('.tb-bubble').getBoundingClientRect();
  const v = b.querySelector('svg.tb-bubble-tail').getBoundingClientRect();
  const r1 = (x) => Math.round(x * 10) / 10;
  return {
    display: getComputedStyle(b).display, tail: b.dataset.tail, show: b.dataset.showSender,
    bodyL: r1((q.left - br.left) / s), bodyW: r1(q.width / s), svgL: r1((v.left - br.left) / s), svgW: r1(v.width / s),
  };
});
async function setTail(page, dir) {
  await page.locator(`#bubble-tail-${dir}`).click();
  await waitFor(page, (d) => document.querySelector('#canvas .speech-bubble-block')?.dataset.tail === d, dir,
    `말꼬리 ${dir} 를 눌렀는데 data-tail 이 안 바뀌었다`);
}

for (const z of [40, 100]) {
  test(`⒬⒯ 1012t1M2-b ★정렬 center(말꼬리 left · 배율 ${z}%) → |dLayout| ≤ 2 · 몸통은 제자리`, async ({ page }) => {
    const errs = await setup(page);
    await page.evaluate((z) => window.applyZoom?.(z), z);
    await expect.poll(() => page.evaluate(() => window.currentZoom), { message: `전제 — 배율 ${z}` }).toBe(z);
    /* ★스케일러 transform 은 .15s 보간이 있다 — 화면 폭 ÷ 배율 = layout 폭이 될 때까지 기다린다
       (안 기다리면 보간 중 rect 로 재어 bodyW 가 374.7 → 366 처럼 흔들렸다 · 1차 런 실측) */
    await expect.poll(() => page.evaluate(() => {
      const q = document.querySelector('#canvas .speech-bubble-block .tb-bubble');
      return Math.abs(q.getBoundingClientRect().width / ((window.currentZoom || 100) / 100) - q.offsetWidth) < 0.5;
    }), { message: `전제 — 배율 ${z} 보간이 끝났다` }).toBe(true);
    await showSender(page);
    const g0 = await geom(page), d0 = await dLayoutProbe(page);
    await clickCenter(page);
    await waitFor(page, () => document.querySelector('#canvas .speech-bubble-block')?.dataset.senderAlign === 'center',
      undefined, '정렬 center 뒤 블럭 표식 data-sender-align 이 center 가 안 됐다');
    const g1 = await geom(page), d1 = await dLayoutProbe(page);
    console.log(`    ⒬@${z} ` + JSON.stringify({ d: `${d0.dLayout}→${d1.dLayout}`, g0, g1 }));
    expect(d1.zoom, `전제 — 배율 ${z}`).toBe(z);
    expect(Math.abs(d1.dLayout), `이름이 몸통 가운데에 안 왔다 — dLayout ${d0.dLayout} → ${d1.dLayout}`).toBeLessThanOrEqual(2);
    expect(Math.abs(g1.bodyL - g0.bodyL), `몸통이 움직였다 — bodyL ${g0.bodyL} → ${g1.bodyL}`).toBeLessThanOrEqual(0.5);
    expect(errs).toEqual([]);
  });
}

test('⒭ 1012t1M2-b ★말꼬리 right + 정렬 center → |dLayout| ≤ 2', async ({ page }) => {
  const errs = await setup(page);
  await showSender(page);
  await setTail(page, 'right');
  await clickCenter(page);
  const d = await dLayoutProbe(page);
  console.log('    ⒭ ' + JSON.stringify(d));
  expect(d.tail).toBe('right');
  expect(Math.abs(d.dLayout), `이름이 몸통 가운데에 안 왔다 — dLayout ${d.dLayout}`).toBeLessThanOrEqual(2);
  expect(errs).toEqual([]);
});

test('⒮ 1012t1M2-b ★불변 — 이름 끈 말풍선은 옛 꼴(display:block) · 이름을 켜도 몸통·말꼬리 가로 자리 그대로 (left/right/center)', async ({ page }) => {
  const errs = await setup(page);
  const rows = [];
  for (const dir of ['left', 'right', 'center']) {
    await setTail(page, dir);
    const off = await geom(page);
    await showSender(page);
    const on = await geom(page);
    rows.push({ dir, off, on });
    /* 이름 다시 끄기 — 다음 판의 «끈» 측정을 위해 */
    await page.evaluate(() => {
      const t = document.getElementById('bubble-show-sender');
      t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await waitFor(page, () => document.querySelector('#canvas .speech-bubble-block')?.dataset.showSender === 'false',
      undefined, '이름표를 다시 껐는데 data-show-sender 가 false 가 안 됐다');
  }
  console.log('    ⒮ ' + JSON.stringify(rows));
  for (const { dir, off, on } of rows) {
    expect(off.show, `전제(${dir}) — 끈 판`).toBe('false');
    expect(off.display, `(${dir}) 이름을 끈 말풍선의 블럭이 옛 꼴(display:block)이 아니다 — 새 규칙이 끈 판까지 번졌다`).toBe('block');
    expect(on.show, `전제(${dir}) — 켠 판`).toBe('true');
    for (const k of ['bodyL', 'bodyW', 'svgL', 'svgW']) {
      expect(Math.abs(on[k] - off[k]), `(${dir}) 이름을 켜니 ${k} 가 바뀌었다 — ${off[k]} → ${on[k]}`).toBeLessThanOrEqual(0.5);
    }
  }
  expect(errs).toEqual([]);
});
