/* text-dot-over.dom.spec.js — ⑥ 텍스트 위 ★점 찍기(방점) (수지 피드백 ⑥ · 지디 발주 2026-10-08:
 *   「텍스트 위 ★점 찍기(세 글자 선택→점 3개·간격·xy·크기·색상 변경)」)
 *   ⚠️출처는 ★2차다(server-manager 가 전한 요약) — ⛔「원문」이 아니다.
 *
 * ★★기전을 «고르기 전에» 쟀다 (2026-10-08 · 헤드리스 크로미움 프로브 2회, 그려서 센다)
 *   ⒜ CSS `text-emphasis` — 점 개수 ★글자 수 그대로 ✅ · 색 ✅ · over/under ✅
 *      ⛔크기 = ★이산만(filled dot 4×3px · filled circle 8×8 · 문자 '●' 8×8 · '·' 2×2)
 *      ⛔xy 오프셋 ★없음 · ⛔점끼리 간격 ★없음 · `font-size` 로 키우면 ★글자가 같이 줄어든다
 *      ⇒ 발주서의 다섯 손잡이 중 ★둘만 준다. ★못 쓴다.
 *   ⒝ ★글자마다 span ＋ `::before` ＋ 블럭 인라인 CSS 변수(형광펜 정본 규약 그대로)
 *      실측: size 6→14px ✅ · x10/y-8 → 중심이 그만큼 ✅ · gap12 → 점 간격 31→43px 이면서
 *            ★가운데 점 불변(양쪽으로 퍼짐) ✅ · 색 ✅ · ★글자는 안 움직인다(글자 폭 31/31/31 불변)
 *      ⇒ 다섯을 ★다 준다. 이 길로 간다.
 *
 * ★★이 길의 «대가»를 숨기지 않는다 — 글자를 ★고치면(한 span 안에 두 글자가 들어가면) 점 수가 어긋난다.
 *   `text-emphasis` 는 브라우저가 매번 다시 세므로 그 병이 없다. ⇒ ★주고받은 것이다, 공짜가 아니다.
 *   D9 가 「끄고 켜면 다시 맞는다」와 「다시 켜도 겹 span 이 안 쌓인다」를 잠근다.
 *   ★★⚰️2026-10-09 — ★위 문장은 ★그날의 사실로 ★남긴다. ★★그 대가는 ★갚았다(`94e24190`).
 *     ★★무엇이었나 — 「한 span 안에 두 글자가 들어가면 점 수가 어긋난다」가 ★그대로 ★현빈 신고가 됐다:
 *       「점을 적용하고, ★글자를 ★사이에 추가 입력하면 ★하이라이트 기능은 잘 추가가 되는데, ★점은 안된다.」
 *       ★실측(실앱 CDP · 진짜 키 · ★그려서 셈): 'AAA BBB CCC' 의 "BBB" 에 점 → 둘째·셋째 B 사이에 'X'
 *       ⇒ span ★3(B·★"BX"·B) / 점 찍힌 글자 ★4 / ★★그려진 점 ★3.  형광펜은 같은 짓에서 ★"BBXB" 를 덮었다.
 *     ★★무엇으로 갚았나 — `normalizeDotSpans()`(불변식 수립자 ★한 자) ＋ `document` 위임 하나.
 *       「글자가 ★둘 이상 든 ★그 span 하나만」 다시 쪼갠다(전수 아님) · 자리번호 다시 매김 · 캐럿은 «글자 수»로 되살림
 *       · ★IME 조립 중엔 물러서고 `compositionend` 가 받는다 · `paste` 도 듣는다(그 길엔 `input` 이 안 온다).
 *     ★★D9 는 ★이 축을 ★못 쟀다 — 「끄고 켜면 다시 맞는다」는 ★사람이 ★끄고 켤 때의 말이고,
 *       ★글자를 ★치는 동안은 ★아무도 안 껐다. ⇒ ★D14~D18 이 ★그 자리를 잠근다.
 *     ⛔이 문장을 ★지우지 마라 — 「주고받은 것이다」는 ★여전히 참이다(⒝ `text-emphasis` 를 안 고른 까닭이 거기 있다).
 *
 * ★「간격」의 뜻 — ★점끼리 좌우 간격으로 읽었다(xy 가 이미 오프셋이라 그게 아니면 y 와 겹친다).
 *   ⛔이건 ★내 판독이다(발주서가 안 말했다). 지디에게 물었고 답이 오면 바뀔 수 있다.
 *
 * 재는 것
 *   D1 ★개수 — 세 글자(BBB) 선택 → 점 ★3개. ★전제: 선택이 "BBB" · 켜기 전 0개.
 *      ★음성대조: 선택 ★밖(AAA·CCC) 글자엔 점이 ★안 붙는다.
 *   D2 ★무선택 전체 — 글자 전부에. ★공백엔 ★안 찍는다(점 9개 = 'AAABBBCCC').
 *   D3 ★크기 — 패널로 바꾸면 ★그려진 점 지름이 바뀐다(변수를 읽는 게 아니라 ★그림에서 센다).
 *   D4 ★xy — 준 만큼 ★그려진 중심이 옮겨간다.
 *   D5 ★간격 — 점 사이 거리가 늘고 ★글자는 ★안 움직인다(음성대조 — 글자를 밀면 그건 자간이지 점 간격이 아니다).
 *   D6 ★색 — 고른 색이 그려진다 · ★안 고르면 ★글자색을 따라온다(hex 가 안 굳는다).
 *   D7 ★끄기 — 점은 사라지고 ★글자는 ★공백까지 그대로 · 색·크기 칸도 닫힌다.
 *   D8 ★저장 왕복 — serializeProject → ★앱 재기동 → applyProjectData 뒤에도 점이 산다.
 *   D9 ★다시 켜기 — 겹 span 이 ★안 쌓인다(끄고 켜도 점 수가 그대로).
 *   D10 ★배송본 — 단독 HTML CSS 에 `.tb-dot` 규칙이 실리고, 세척이 인라인을 안 걷는다.
 *   D11 ★다른 패널엔 «없다» — showDots 기본 false(모달·그리드·챗 마크업 «바이트 동일»).
 *   D12 ★섹션 맨 윗줄 — 기본 크기의 점은 섹션 «안»에 들어온다(큰 점은 나갈 수 있다).
 *   D13 ★★겹치는 부분 선택 — 이미 점 찍힌 글자를 ★포함해 다시 고르면 겹 span 이 안 생긴다.
 *     (⚠️D12·D13 은 ★머리말 명부에 ★빠져 있었다 — 2026-10-09 에 ★메웠다. ★시험을 더하면 ★여기도 같이 더해라.)
 *
 *   ★★2026-10-09 현빈 「점을 적용하고, ★글자를 ★사이에 추가 입력하면 ★하이라이트 기능은 잘 추가가 되는데,
 *      ★점은 안된다.」 ⇒ 위 머리말이 「이 길의 대가」라 적어 둔 ★그 병이다. ★갚는다.
 *   D14 ★글자 ★사이 끼워넣기 — 점 수가 ★따라온다(1자 ＋ ★이어서 1자 = 캐럿이 살아 있나)
 *   D15 ★★형광펜 ★대조 — ★같은 짓에서 획은 새 글자를 ★덮는다. ★이것이 ★기준선이다
 *       (⛔「점이 형광펜처럼 되게」가 아니다 — ★«누가 효과를 받나»를 ★브라우저가 정하고,
 *        점 쪽은 ★그 뒤에 ★«수»만 맞춘다. ★두 효과가 ★같은 판정을 쓰는지를 ★여기서 견준다.)
 *   D16 ★붙여넣기 — ★`input` 이 ★안 오는 길(앱 paste 핸들러가 preventDefault 뒤 제 손으로 꽂는다)
 *   D17 ★★음성대조 — ★공백을 끼우면 점이 ★안 늘어난다(공백엔 점을 안 찍는다는 규약이 ★살아 있나)
 *   D18 ★한글 IME — ★조립 ★중엔 ★손대지 않고(음성대조) ★확정 뒤에 센다
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 재기동 · 네이티브 메뉴 · 파일로 쓰인 export.html 바이트.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js text-dot-over
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

/* ★★자(측정 창)에 ★여백을 둔다 — 점은 글자칸 «위»로 나가고, 간격·x 를 주면 ★좌우로도 나간다.
   ⛔여백 없이 섹션만 찍으면 D4(y −9)·D5(간격 16)가 ★0건으로 떨어진다 — 2026-10-08 실측으로 겪었다.
     그 0건은 「점이 안 움직였다」가 아니라 ★「내 창 밖으로 갔다」였다(부재를 잴 때 틀리는 건 자가 아니라 ★창이다).
   ★여백 ★없는 판(= 섹션 맨 윗줄)에서 점이 ★실제로 잘리는지는 ★D12 가 따로 잰다 — 여기서 덮지 않는다. */
const SEC_PAD = 'background-color:#ffffff;padding:80px 0 0 80px';
const SEC_FLUSH = 'background-color:#ffffff';
const secHtml = (style) => `<div class="section-block" id="sA" data-section="1" data-name="sA" style="${style}"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>`;
const DOT_HEX = '22AA55';            // 글자색(#111 계열)과 ★안 섞이는 색 — 그림에서 점만 골라 센다

async function setup(page, { flush = false } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, secHtml(flush ? SEC_FLUSH : SEC_PAD));
  await page.waitForTimeout(250);
  return errs;
}

const insertText = (page, content = 'AAA BBB CCC') => page.evaluate((t) => {
  const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
  document.getElementById('sA').classList.add('selected');
  window.addTextBlock('body', { content: t });
  const fresh = [...document.querySelectorAll('#canvas .text-block')].filter(e => !before.has(e.id));
  return fresh.length ? fresh[fresh.length - 1].id : null;
}, content);

const openPanel = async (page, id) => {
  await page.evaluate((i) => window.showTextProperties(document.getElementById(i)), id);
  await page.waitForSelector('#txt-style-group', { state: 'attached' });
};

async function clickBtn(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('no box: ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(150);
}
async function typeField(page, sel, v) {
  await page.fill(sel, String(v));
  await page.press(sel, 'Enter');
  await page.waitForTimeout(150);
}

/* 글자칸에 들어가 «끝에서 back 글자 앞»부터 ⇧← len 번으로 고른다. 'AAA BBB CCC' 에서
   (back 4, len 3) = "BBB" · (back 4, len 5) = "A BBB". ★진짜 마우스·키로만 한다. */
async function editAndSelectTail(page, hostSel, back, len) {
  /* ★자리가 «멈춘 뒤»의 좌표로 누른다(_root-harness waitStableRect) — 2026-10-08 실측:
     첫 두르기 뒤(pushHistory·scheduleAutoSave) 자리가 아직 움직이는 사이에 좌표를 재서 누르니
     ★메뉴바를 더블클릭했고 선택이 "File"(inHost:false)이 됐다. ⛔그걸 「선택이 안 된다」로 읽으면
     제품을 엉뚱하게 고친다 — 흔들린 것은 ★자였다. */
  await page.locator(hostSel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, hostSel);
  await page.mouse.dblclick(r.left + r.width - 4, r.top + r.height / 2);
  await page.waitForTimeout(300);
  await page.keyboard.press('End');
  for (let i = 0; i < back; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < len; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
}
const editAndSelectBBB = (page, hostSel) => editAndSelectTail(page, hostSel, 4, 3);
async function assertPremiseSel(page, hostSel, want) {
  const p = await page.evaluate((hs) => {
    const s = getSelection(); const host = document.querySelector(hs);
    return { rc: s.rangeCount, col: s.isCollapsed, str: s.toString(),
             inHost: !!host && host.contains(s.anchorNode) && host.contains(s.focusNode) };
  }, hostSel);
  expect(p, `★전제 — 글자칸 안에 ${JSON.stringify(want)} 가 선택돼 있어야 한다. 잰 값 ${JSON.stringify(p)}`)
    .toEqual({ rc: 1, col: false, str: want, inHost: true });
}
const assertPremiseBBB = (page, hostSel) => assertPremiseSel(page, hostSel, 'BBB');

/* ★글자 ★사이에 캐럿을 둔다 — 'AAA BBB CCC' 에서 (back 5) = ★둘째·셋째 B 사이.
   ⛔선택을 두지 ★않는다(collapsed) — 「사이에 ★추가 입력」이 그 뜻이다.
   ★editAndSelectTail 과 ★같은 길로 들어간다(멈춘 뒤 좌표 · 진짜 더블클릭) — ⇧← 만 안 누른다. */
async function caretBetween(page, hostSel, back) {
  await page.locator(hostSel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, hostSel);
  await page.mouse.dblclick(r.left + r.width - 4, r.top + r.height / 2);
  await page.waitForTimeout(300);
  await page.keyboard.press('End');
  for (let i = 0; i < back; i++) await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(150);
}
/* ★전제 — 캐럿이 ★그 효과 span ★안에 ★collapsed 로, ★글자 수로 ★몇 번째에 있나.
   ⛔「점이 안 늘었다」를 ★캐럿이 ★딴 데 있어서 생긴 일과 ★가르는 자다(자가 흔들린 것을 결함으로 읽지 않게). */
async function assertPremiseCaret(page, hostSel, cls, wantOff) {
  const p = await page.evaluate(({ hs, c }) => {
    const s = getSelection(); const host = document.querySelector(hs); const n = s.focusNode;
    let off = null;
    try { const r = document.createRange(); r.setStart(host, 0); r.setEnd(n, s.focusOffset); off = r.toString().length; } catch (_) {}
    return { col: s.isCollapsed, inHost: !!host && !!n && host.contains(n),
             inSpan: !!(n && n.parentElement && n.parentElement.classList.contains(c)), off };
  }, { hs: hostSel, c: cls });
  expect(p, `★전제 — 캐럿이 span.${cls} 안 ${wantOff}번째 글자 자리에 collapsed 로 있어야 한다. 잰 값 ${JSON.stringify(p)}`)
    .toEqual({ col: true, inHost: true, inSpan: true, off: wantOff });
}
/* 점 찍힌 ★글자들을 이어 돌려준다 — ★span 수와 ★따로 센다(한 span 에 두 글자가 들어가면 둘이 갈린다). */
const dottedChars = (page, id) => page.evaluate((i) => [...document.getElementById(i)
  .querySelectorAll('span.tb-dot')].map(x => x.textContent).join(''), id);
const hlChars = (page, id) => page.evaluate((i) => [...document.getElementById(i)
  .querySelectorAll('span.tb-hl')].map(x => x.textContent).join('|'), id);

/* ★점을 «그려서» 센다 — ⛔span 수를 세는 것은 «견주는 것»이 아니다.
   DOT_HEX 색 덩이만 flood-fill 로 골라 중심·지름을 돌려준다. 글자(#1c1c1e 계열)는 안 걸린다. */
async function paintedDots(page, boxSel) {
  /* ★★찍기 «전»에 ★편집 전용 표시를 걷는다 — 2026-10-08 실측: 고른 블럭의 ★파란 외곽선이
     점 ★가운데를 가로질러(섹션 좌표 y=80 의 한 줄이 rgb(45,111,232)) 한 점이 ★두 덩이로 세어졌다
     (14px 점 → [14×7]＋[12×6]). ⛔그걸 「점이 쪼개졌다」로 읽으면 제품을 엉뚱하게 고친다.
     ★배송본엔 .selected 가 없으니, 「그려진 점」을 재려면 이 표시를 빼고 재는 것이 맞다
     (레포의 stripEditorOnlyForCapture 가 같은 일을 한다). 재고 나서 ★되돌린다. */
  const restore = await page.evaluate(() => {
    const picked = [...document.querySelectorAll('#canvas .selected, #canvas .editing')];
    const ids = picked.map(e => { e.classList.remove('selected', 'editing'); return e.id || ''; });
    return ids;
  });
  const b64 = (await (await page.$(boxSel)).screenshot()).toString('base64');
  await page.evaluate((ids) => ids.forEach(i => { if (i) document.getElementById(i)?.classList.add('selected'); }), restore);
  return page.evaluate(async (s) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const hit = (k) => Math.abs(d[k] - 34) < 40 && Math.abs(d[k + 1] - 170) < 46 && Math.abs(d[k + 2] - 85) < 46;
    const seen = new Uint8Array(c.width * c.height); const pts = [];
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const k = (y * c.width + x) * 4;
      if (!hit(k) || seen[y * c.width + x]) continue;
      const st = [[x, y]]; let n = 0, minx = x, maxx = x, miny = y, maxy = y;
      while (st.length) {
        const [px, py] = st.pop();
        if (px < 0 || py < 0 || px >= c.width || py >= c.height) continue;
        if (seen[py * c.width + px]) continue;
        const kk = (py * c.width + px) * 4; if (!hit(kk)) continue;
        seen[py * c.width + px] = 1; n++;
        minx = Math.min(minx, px); maxx = Math.max(maxx, px);
        miny = Math.min(miny, py); maxy = Math.max(maxy, py);
        st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }
      if (n > 3) pts.push({ cx: Math.round((minx + maxx) / 2), cy: Math.round((miny + maxy) / 2), w: maxx - minx + 1, h: maxy - miny + 1 });
    }
    pts.sort((a, b) => a.cx - b.cx);
    return { pts, canvas: [c.width, c.height] };
  }, b64);
}


/* ★준비 — 글자를 ★가운데로 놓는다. `.section-inner` 는 ★가로를 clip 한다(2026-10-08 실측:
   computed overflow = 'clip visible' = overflow-x:clip · overflow-y:visible).
   ⇒ 맨 왼쪽 글자의 점을 ★왼쪽으로 밀면(음수 x · 간격) 그 안쪽 상자 밖에서 ★잘린다 —
     그래서 «옆으로 옮기는» D4·D5 는 글자에 ★좌우 여유를 주고 잰다. ★그 잘림 자체는 D12 가 적는다.
   ⛔이것은 «재는 대상»이 아니라 ★준비다(선택·여백과 같은 층). */
const centerText = (page, id) => page.evaluate((i) => {
  const ce = document.getElementById(i).querySelector('[contenteditable]');
  ce.style.textAlign = 'center';
}, id);

/* 섹션을 찍는다 — 점은 글자칸 «위»로 나가서 글자칸만 찍으면 ★잘린다(2026-10-08 프로브에서 실제로 0건이 나왔다). */
const BOX = '#sA';

const state = (page, id) => page.evaluate((i) => {
  const tb = document.getElementById(i);
  const ce = tb.querySelector('[contenteditable]') || tb.querySelector('[class^="tb-"]');
  const spans = [...ce.querySelectorAll('span.tb-dot')];
  const before = spans[0] ? getComputedStyle(spans[0], '::before') : null;
  return {
    nSpan: spans.length,
    text: ce.innerText,
    idx: spans.map(s => s.style.getPropertyValue('--tb-dot-i')),
    charRects: [...ce.querySelectorAll('span.tb-dot')].map(s => Math.round(s.getBoundingClientRect().left)),
    vars: ['--tb-dot-color', '--tb-dot-size', '--tb-dot-x', '--tb-dot-y', '--tb-dot-gap']
      .map(v => tb.style.getPropertyValue(v).trim()),
    beforeBg: before ? before.backgroundColor : null,
    active: document.getElementById('txt-dot-btn')?.classList.contains('active') ?? null,
    optsDisp: ['txt-dot-color-row', 'txt-dot-size-row', 'txt-dot-gap-row', 'txt-dot-xy-row']
      .map(k => { const e = document.getElementById(k); return e ? getComputedStyle(e).display : null; }),
  };
}, id);

/* 점 색을 DOT_HEX 로 ★먼저 고정한다 — 그림에서 점을 고르는 ★자가 그 색이다. */
const pickDotColor = (page) => typeField(page, '#txt-dot-color-hex', DOT_HEX);

/* ══════════════════════════════════════════════════════════════════ */

test('D1 ★개수 — BBB 세 글자를 고르면 점 ★3개 (음성대조: 밖엔 0개)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  const host = `#${id} [contenteditable]`;

  const s0 = await state(page, id);
  expect(s0.nSpan, `★전제 — 켜기 전에 이미 점이 있다. 잰 값 ${s0.nSpan}`).toBe(0);
  const p0 = await paintedDots(page, BOX);
  expect(p0.pts.length, `★전제 — 켜기 전에 이미 «그 색» 덩이가 있다(잣대가 죽었다). 잰 값 ${p0.pts.length}`).toBe(0);

  await editAndSelectBBB(page, host);
  await assertPremiseBBB(page, host);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);

  const s1 = await state(page, id);
  const p1 = await paintedDots(page, BOX);
  console.log('  D1:', JSON.stringify({ nSpan: s1.nSpan, idx: s1.idx, painted: p1.pts.length, pts: p1.pts }));
  expect(s1.nSpan, `★점 span 이 3개가 아니다. 잰 값 ${s1.nSpan}`).toBe(3);
  expect(p1.pts.length, `★★그려진 점이 3개가 아니다 — 「만들었다」와 「보인다」는 다르다. 잰 값 ${p1.pts.length}`).toBe(3);

  /* ★음성대조 — 점이 붙은 글자가 ★BBB 뿐이다 */
  const dotted = await page.evaluate((i) => [...document.getElementById(i)
    .querySelectorAll('span.tb-dot')].map(s => s.textContent).join(''), id);
  expect(dotted, `★★선택 «밖»에도 점이 붙었다. 점 달린 글자 = ${JSON.stringify(dotted)}`).toBe('BBB');
  expect(s1.text, '★글자가 바뀌었다').toBe('AAA BBB CCC');
  expect(errs).toEqual([]);
});

test('D2 ★무선택 전체 — 글자 전부에 · ★공백엔 안 찍는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  const saved0 = await page.evaluate(() => !!window.__textSelection?.getSavedTextSelection?.());
  expect(saved0, '★전제 — 저장된 선택이 있다. 이 판에선 D2 가 «전체» 갈래를 안 잰다').toBe(false);

  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);
  const s = await state(page, id);
  const p = await paintedDots(page, BOX);
  const dotted = await page.evaluate((i) => [...document.getElementById(i)
    .querySelectorAll('span.tb-dot')].map(x => x.textContent).join(''), id);
  console.log('  D2:', JSON.stringify({ nSpan: s.nSpan, dotted, painted: p.pts.length, text: s.text }));
  expect(dotted, `★공백에도 점을 찍었거나 글자를 빠뜨렸다. 잰 값 ${JSON.stringify(dotted)}`).toBe('AAABBBCCC');
  expect(s.nSpan).toBe(9);
  expect(p.pts.length, `★그려진 점이 9개가 아니다. 잰 값 ${p.pts.length}`).toBe(9);
  expect(s.text, '★글자가 바뀌었다(공백이 사라졌다면 span 쪼개기가 공백을 먹은 것)').toBe('AAA BBB CCC');
  expect(errs).toEqual([]);
});

test('D3 ★크기 — 패널로 바꾸면 «그려진 지름»이 바뀐다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);

  /* ★★전제 — 「패널 칸의 ★처음 값」이 ★CSS 기본값(--tb-dot-size)에서 ★파생한다.
     ⛔둘 다 ★런타임에서 읽어 견준다(시험에 맨 숫자를 안 적는다 — 그러면 이 검사가 ★둘째 명부가 된다).
     이게 없으면 prop-text.js 의 바닥값이 CSS 와 조용히 갈려도 아무도 안 본다. */
  const derive = await page.evaluate(() => ({
    panel: document.getElementById('txt-dot-size-num').value,
    css: getComputedStyle(document.querySelector('.text-block')).getPropertyValue('--tb-dot-size').trim(),
  }));
  console.log('  D3 파생:', JSON.stringify(derive));
  expect(derive.panel + 'px', `★패널 첫 값이 CSS 기본값에서 안 왔다 — 명부가 둘이다. 잰 값 패널 ${derive.panel} / CSS ${derive.css}`)
    .toBe(derive.css);

  await typeField(page, '#txt-dot-size-num', 4);
  const v4 = await state(page, id);
  expect(v4.vars[1], `★전제 — 4 를 넣었는데 변수가 4px 가 아니다. 잰 값 ${v4.vars[1]}`).toBe('4px');
  const small = await paintedDots(page, BOX);

  await typeField(page, '#txt-dot-size-num', 14);
  const v14 = await state(page, id);
  expect(v14.vars[1], `★전제 — 14 를 넣었는데 변수가 14px 가 아니다. 잰 값 ${v14.vars[1]}`).toBe('14px');
  const big = await paintedDots(page, BOX);

  console.log('  D3:', JSON.stringify({ small: small.pts, big: big.pts }));
  expect(small.pts.length, `★작은 쪽에서 점이 3개가 아니다. 잰 값 ${small.pts.length}`).toBe(3);
  expect(big.pts.length, `★큰 쪽에서 점이 3개가 아니다. 잰 값 ${big.pts.length}`).toBe(3);
  const sw = small.pts[0].w, bw = big.pts[0].w;
  expect(bw, `★크기를 4→14 로 올렸는데 «그려진 지름»이 안 커졌다. 잰 값 ${sw}px → ${bw}px`).toBeGreaterThan(sw + 5);
  // 슬라이더와 숫자칸이 같은 값(명부 둘 방지)
  expect(await page.inputValue('#txt-dot-size')).toBe('14');
  expect(errs).toEqual([]);
});

test('D4 ★xy — 준 만큼 «그려진 중심»이 옮겨간다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'ABC');
  await centerText(page, id);                         // ★준비 — 좌우 여유(까닭은 centerText 머리말)
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);
  await typeField(page, '#txt-dot-size-num', 8);

  const base = await paintedDots(page, BOX);
  expect(base.pts.length, `★전제 — 옮기기 전에 점이 3개가 아니다. 잰 값 ${base.pts.length}`).toBe(3);

  await typeField(page, '#txt-dot-x', 12);
  await typeField(page, '#txt-dot-y', -9);
  const v = await state(page, id);
  expect([v.vars[2], v.vars[3]], `★전제 — 넣은 값이 변수에 안 들어갔다. 잰 값 ${JSON.stringify([v.vars[2], v.vars[3]])}`).toEqual(['12px', '-9px']);
  const moved = await paintedDots(page, BOX);
  console.log('  D4:', JSON.stringify({ base: base.pts.map(p => [p.cx, p.cy]), moved: moved.pts.map(p => [p.cx, p.cy]) }));
  expect(moved.pts.length, `★옮긴 뒤 점이 3개가 아니다(화면 밖으로 나갔나). 잰 값 ${moved.pts.length}`).toBe(3);
  for (let i = 0; i < 3; i++) {
    const dx = moved.pts[i].cx - base.pts[i].cx, dy = moved.pts[i].cy - base.pts[i].cy;
    expect(Math.abs(dx - 12), `★${i + 1}번째 점의 x 이동이 12 가 아니다. 잰 값 ${dx}`).toBeLessThanOrEqual(2);
    expect(Math.abs(dy - (-9)), `★${i + 1}번째 점의 y 이동이 -9 가 아니다. 잰 값 ${dy}`).toBeLessThanOrEqual(2);
  }
  expect(errs).toEqual([]);
});

test('D5 ★간격 — 점 사이가 벌어지고 ★글자는 안 움직인다 (음성대조)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'ABC');
  await centerText(page, id);                         // ★준비 — 좌우 여유(까닭은 centerText 머리말)
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);
  await typeField(page, '#txt-dot-size-num', 8);

  const b = await paintedDots(page, BOX);
  const bChars = (await state(page, id)).charRects;
  expect(b.pts.length, `★전제 — 벌리기 전에 점이 3개가 아니다. 잰 값 ${b.pts.length}`).toBe(3);
  const gap0 = b.pts[2].cx - b.pts[0].cx;

  await typeField(page, '#txt-dot-gap-num', 16);
  const v = await state(page, id);
  expect(v.vars[4], `★전제 — 16 을 넣었는데 변수가 16px 가 아니다. 잰 값 ${v.vars[4]}`).toBe('16px');
  const a = await paintedDots(page, BOX);
  const aChars = v.charRects;
  console.log('  D5:', JSON.stringify({ gap0, bChars, aChars, pts0: b.pts.map(p => p.cx), pts1: a.pts.map(p => p.cx) }));
  /* ⛔수를 ★먼저 단언한다 — 옛 판은 a.pts[2] 를 먼저 읽어 TypeError 로 죽었고, 그러면 ★잰 값이 안 찍힌다
     (조사가 증거를 지우는 꼴). */
  expect(a.pts.length, `★벌린 뒤 점이 3개가 아니다(겹쳐 붙었나 · 창 밖으로 갔나). 잰 값 ${a.pts.length} · x들 ${JSON.stringify(a.pts.map(p => p.cx))}`).toBe(3);
  const gap1 = a.pts[2].cx - a.pts[0].cx;
  expect(gap1 - gap0, `★간격 16 을 줬는데 양 끝 점 거리가 32 만큼 안 늘었다. 잰 값 ${gap0} → ${gap1}`).toBeGreaterThanOrEqual(28);
  /* ★★음성대조 — ★글자는 안 움직인다. 글자가 밀리면 그건 «자간»이지 «점 간격»이 아니다. */
  expect(aChars, `★★점 간격을 줬는데 ★글자가 움직였다. 잰 값 전 ${JSON.stringify(bChars)} → 후 ${JSON.stringify(aChars)}`).toEqual(bChars);
  /* ★가운데 점은 제자리 — 한쪽으로 쏠리면 「퍼뜨리기」가 아니라 「밀기」다 */
  expect(Math.abs(a.pts[1].cx - b.pts[1].cx), `★가운데 점이 움직였다 — 양쪽으로 퍼지는 것이 아니다. 잰 값 ${a.pts[1].cx - b.pts[1].cx}`).toBeLessThanOrEqual(2);
  expect(errs).toEqual([]);
});

test('D6 ★색 — 고른 색이 그려진다 · 안 고르면 ★글자색을 따라온다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  await typeField(page, '#txt-dot-size-num', 8);

  /* 안 고른 상태 — 인라인이 ★없고, 글자색을 바꾸면 점이 따라온다 */
  const d0 = await state(page, id);
  expect(d0.vars[0], `★색을 고르지도 않았는데 hex 가 굳었다 — 글자색을 바꿔도 안 따라온다. 잰 값 ${d0.vars[0]}`).toBe('');
  const followed = await page.evaluate((i) => {
    const ce = document.getElementById(i).querySelector('[contenteditable]');
    const was = ce.style.color;
    ce.style.color = 'rgb(0, 0, 255)';
    const v = getComputedStyle(ce.querySelector('span.tb-dot'), '::before').backgroundColor;
    ce.style.color = was;
    return v;
  }, id);
  expect(followed, `★글자색을 바꿨는데 점이 안 따라온다. 잰 값 ${followed}`).toBe('rgb(0, 0, 255)');

  await pickDotColor(page);
  const d1 = await state(page, id);
  const p = await paintedDots(page, BOX);
  console.log('  D6:', JSON.stringify({ var: d1.vars[0], beforeBg: d1.beforeBg, painted: p.pts.length }));
  expect(d1.vars[0].toLowerCase(), `★고른 색이 변수에 안 들어갔다. 잰 값 ${d1.vars[0]}`).toBe('#22aa55');
  expect(d1.beforeBg, `★고른 색이 ::before 에 안 걸렸다. 잰 값 ${d1.beforeBg}`).toBe('rgb(34, 170, 85)');
  expect(p.pts.length, `★★고른 색이 ★안 그려진다. 잰 값 ${p.pts.length}`).toBe(3);
  expect(errs).toEqual([]);
});

test('D7 ★끄기 — 점은 사라지고 글자는 «공백까지» 그대로 · 칸도 닫힌다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  const on = await state(page, id);
  expect(on.nSpan, `★전제 — 안 켜졌다. 잰 값 ${on.nSpan}`).toBe(9);
  expect(on.optsDisp, `★켰는데 칸이 안 열렸다. 잰 값 ${JSON.stringify(on.optsDisp)}`).toEqual(['flex', 'flex', 'flex', 'flex']);

  await clickBtn(page, '#txt-dot-btn');
  const off = await state(page, id);
  const p = await paintedDots(page, BOX);
  console.log('  D7:', JSON.stringify({ nSpan: off.nSpan, text: off.text, painted: p.pts.length, opts: off.optsDisp }));
  expect(off.nSpan, `★꺼도 점 span 이 남는다. 잰 값 ${off.nSpan}`).toBe(0);
  expect(off.text, '★끄면서 글자(또는 공백)가 바뀌었다').toBe('AAA BBB CCC');
  expect(off.active).toBe(false);
  expect(off.optsDisp, `★껐는데 칸이 남아 있다. 잰 값 ${JSON.stringify(off.optsDisp)}`).toEqual(['none', 'none', 'none', 'none']);
  /* ★쪼갠 글자가 ★다시 하나로 합쳐졌나 — 안 합치면 다음에 켤 때 토막이 쌓인다 */
  const nodes = await page.evaluate((i) => {
    const ce = document.getElementById(i).querySelector('[contenteditable]');
    const w = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT); let n = 0;
    while (w.nextNode()) n++;
    return n;
  }, id);
  expect(nodes, `★끄고 난 뒤 텍스트 노드가 ${nodes}개다 — normalize() 가 안 돌아 토막이 남았다`).toBe(1);
  expect(errs).toEqual([]);
});

test('D8 ★저장 왕복 — 저장 → 앱 재기동 → 다시 열기 뒤에도 점이 산다', async ({ page }) => {
  await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);
  await typeField(page, '#txt-dot-size-num', 9);
  await typeField(page, '#txt-dot-gap-num', 6);

  const before = await state(page, id);
  expect(before.nSpan, `★전제 — 저장 전에 점이 없다. 잰 값 ${before.nSpan}`).toBe(3);

  const snap = await page.evaluate(() => window.serializeProject());
  expect(/tb-dot/.test(snap), '★저장본에 점 span 이 ★안 실렸다').toBe(true);
  expect(/--tb-dot-size/.test(snap), '★저장본에 점 «설정»이 ★안 실렸다 — 다시 열면 기본값으로 돌아간다').toBe(true);

  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForTimeout(400);

  const after = await page.evaluate((i) => {
    const tb = document.getElementById(i);
    if (!tb) return { err: 'tb 가 다시 안 생겼다' };
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('[class^="tb-"]');
    const spans = [...ce.querySelectorAll('span.tb-dot')];
    return { n: spans.length, text: ce.innerText,
             bg: spans[0] ? getComputedStyle(spans[0], '::before').backgroundColor : null,
             size: spans[0] ? getComputedStyle(spans[0], '::before').width : null,
             idx: spans.map(s => s.style.getPropertyValue('--tb-dot-i')) };
  }, id);
  console.log('  D8:', JSON.stringify(after));
  expect(after.err).toBeUndefined();
  expect(after.n, `★다시 연 뒤 점이 사라졌다. 잰 값 ${after.n}`).toBe(3);
  expect(after.bg, `★다시 연 뒤 고른 색이 사라졌다. 잰 값 ${after.bg}`).toBe('rgb(34, 170, 85)');
  expect(after.size, `★다시 연 뒤 크기가 사라졌다. 잰 값 ${after.size}`).toBe('9px');
  expect(after.text).toBe('ABC');
});

test('D9 ★다시 켜기 — 겹 span 이 안 쌓인다 (끄고 켜도 점 수가 그대로)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  const a = await state(page, id);
  expect(a.nSpan, `★전제 — 처음에 3개가 아니다. 잰 값 ${a.nSpan}`).toBe(3);
  for (let i = 0; i < 3; i++) { await clickBtn(page, '#txt-dot-btn'); await clickBtn(page, '#txt-dot-btn'); }
  const b = await state(page, id);
  const nested = await page.evaluate((i) => document.getElementById(i)
    .querySelectorAll('span.tb-dot span.tb-dot').length, id);
  console.log('  D9:', JSON.stringify({ n: b.nSpan, nested, idx: b.idx, text: b.text }));
  expect(b.nSpan, `★끄고 켜기를 3번 돌았더니 점 수가 달라졌다. 잰 값 ${b.nSpan}`).toBe(3);
  expect(nested, `★점 span 이 ★겹쳐 쌓였다. 잰 값 ${nested}`).toBe(0);
  expect(b.text, '★글자가 바뀌었다').toBe('ABC');
  expect(errs).toEqual([]);
});

test('D10 ★배송본 — 단독 HTML CSS 에 .tb-dot 규칙이 실리고 세척이 인라인을 안 걷는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);
  await typeField(page, '#txt-dot-size-num', 9);

  const r = await page.evaluate(async (i) => {
    const cssMod = await import('../../js/io/export-css-collect.js');
    const css = cssMod.collectCanvasCss(document.getElementById('sA'), document);
    const capMod = await import('../../js/io/capture-safety.js');
    const clone = document.getElementById('canvas').cloneNode(true);
    capMod.stripEditorOnlyForCapture(clone);
    const tb = clone.querySelector('#' + i);
    return {
      rule: /\.tb-dot\s*\{/.test(css),
      beforeRule: /\.tb-dot::before/.test(css),
      varDecl: (css.match(/--tb-dot-/g) || []).length,
      cssLen: css.length,
      cloneSpans: tb ? tb.querySelectorAll('span.tb-dot').length : -1,
      cloneInline: tb ? (tb.getAttribute('style') || '') : null,
    };
  }, id);
  console.log('  D10:', JSON.stringify(r));
  expect(r.rule, '★배송본 CSS 에 .tb-dot 규칙이 없다 — 내보내면 점이 사라진다').toBe(true);
  expect(r.beforeRule, '★::before 규칙이 안 실렸다 — 점을 그리는 자가 그것이다').toBe(true);
  expect(r.varDecl, '★--tb-dot-* 기본값이 안 실렸다 — 안 고른 블럭의 점이 배송본에서 안 보인다').toBeGreaterThan(0);
  expect(r.cloneSpans, `★세척이 점 span 을 걷어냈다. 잰 값 ${r.cloneSpans}`).toBe(3);
  expect(r.cloneInline, `★세척이 점 설정 인라인을 걷어냈다. 잰 값 ${r.cloneInline}`).toContain('--tb-dot-color');
  expect(errs).toEqual([]);
});

test('D11 ★다른 패널엔 «없다» — showDots 기본 false (모달 DOM 에 안 생긴다)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  const inText = await page.evaluate(() => !!document.getElementById('txt-dot-btn'));
  expect(inText, '★텍스트 패널에 점 단추가 없다 — 아래 음성대조가 공짜로 참이 된다').toBe(true);

  const mdl = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addModalBlock?.({});
    const fresh = [...document.querySelectorAll('#canvas .modal-block')].filter(e => !before.has(e.id));
    const el = fresh[fresh.length - 1];
    if (!el) return { err: 'modal-block 이 안 들어갔다' };
    window.showModalProperties?.(el);
    return { has: !!document.getElementById('mdl-typo-dot-btn'),
             hasStrike: !!document.getElementById('mdl-typo-strike-btn') };
  });
  console.log('  D11:', JSON.stringify(mdl));
  expect(mdl.err).toBeUndefined();
  expect(mdl.hasStrike, '★전제 — 모달 타이포 절이 안 열렸다').toBe(true);
  expect(mdl.has, '★모달에도 점 단추가 생겼다 — showDots 기본값이 false 가 아니다(공유 골든이 갈린다)').toBe(false);
  expect(errs).toEqual([]);
});

test('D12 ★섹션 맨 윗줄 — 기본 크기의 점은 섹션 «안»에 들어온다 (큰 점은 나갈 수 있다 — 재서 적는다)', async ({ page }) => {
  /* ★★왜 이 시험이 있나 — 점은 글자 ★위에 그려지므로, 글자가 섹션 ★맨 윗줄이면 섹션 밖으로 나가 ★잘릴 수 있다.
     2026-10-08 실측에서 ★실제로 겪었다: 여백 없는 섹션에서 크기 14px 점이 ★6px 로 잘려 그려졌다(w12 h6).
     ⇒ ★기본 크기에서는 안 잘린다를 ★지킨다. 큰 크기의 잘림은 ★사실로 적고 지디 판정에 올린다
       (⛔「안 잘린다」로 넓히지 마라 — 지금은 거짓이다). */
  const errs = await setup(page, { flush: true });     // ★여백 ★없는 섹션 = 사람이 맨 위에 글을 놓은 그 판
  const id = await insertText(page, 'ABC');
  await openPanel(page, id);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);

  const measure = async (size) => {
    if (size != null) await typeField(page, '#txt-dot-size-num', size);
    const got = await paintedDots(page, BOX);
    const want = await page.evaluate(() => parseInt(getComputedStyle(document.querySelector('span.tb-dot'), '::before').width, 10));
    return { want, drawn: got.pts.map(p => [p.w, p.h]), n: got.pts.length };
  };

  const def = await measure(null);                      // ★기본 = CSS 가 정한 값(시험에 숫자를 안 적는다)
  console.log('  D12 기본:', JSON.stringify(def));
  expect(def.n, `★기본 크기에서 점이 3개가 아니다. 잰 값 ${def.n}`).toBe(3);
  for (const [w, h] of def.drawn) {
    expect(h, `★★기본 크기 점이 ★잘려 그려진다(섹션 맨 윗줄) — 요청 ${def.want}px, 그려진 ${w}×${h}`).toBeGreaterThanOrEqual(def.want - 1);
  }

  const big = await measure(20);
  const clipped = big.drawn.some(([, h]) => h < big.want - 1);
  console.log(`  D12 큰 점(20px): 요청 ${big.want}px · 그려진 ${JSON.stringify(big.drawn)} · ★잘림 ${clipped ? '있다' : '없다'}`);
  /* ⛔여기서 「잘림 없다」를 단언하지 «않는다» — 재서 ★적는 자리다(지디 판정 대기).
     ★다만 점이 ★아예 사라지지는 않는다는 것은 지킨다(그러면 「눌렀는데 아무 일 없음」이 된다). */
  expect(big.n, `★큰 점이 아예 안 그려졌다. 잰 값 ${big.n}`).toBe(3);

  /* ★가로 잘림 — `.section-inner` 는 ★가로를 clip 한다. 맨 왼쪽 글자의 점을 왼쪽으로 밀면 사라진다.
     ★그 «사실»을 적는다(고치는 축이 아니다 — 안쪽 상자를 넓히는 일은 섹션 담당이고 지디가 쥐고 있다). */
  const ovf = await page.evaluate(() => getComputedStyle(document.querySelector('#sA .section-inner')).overflow);
  await typeField(page, '#txt-dot-size-num', 6);
  const before = (await paintedDots(page, BOX)).pts.length;
  await typeField(page, '#txt-dot-x', -30);
  const after = (await paintedDots(page, BOX)).pts.length;
  console.log(`  D12 가로: section-inner overflow = ${JSON.stringify(ovf)} · x 0 → −30 에서 점 ${before} → ${after}개`);
  expect(ovf, `★전제 — section-inner 의 overflow 가 바뀌었다. 잰 값 ${ovf}`).toContain('clip');
  expect(before, `★전제 — 밀기 전에 3개가 아니다. 잰 값 ${before}`).toBe(3);
  /* ⛔「after === 3」도 「after < 3」도 단언하지 «않는다» — 안쪽 상자 폭과 글자 위치에 달렸다.
     ★단언하는 것은 ★하나다: 「왼쪽으로 밀면 ★더 늘지는 않는다」(= 잘리거나 그대로). */
  expect(after, `★왼쪽으로 밀었는데 점이 ★늘었다 — 셈이 틀렸다. 잰 값 ${before} → ${after}`).toBeLessThanOrEqual(before);
  expect(errs).toEqual([]);
});

test('D13 ★★겹치는 부분 선택 — 이미 점 찍힌 글자를 ★포함해 다시 고르면 겹 span 이 안 생긴다', async ({ page }) => {
  /* ★★왜 이 시험이 ★따로 있나 — 2026-10-08 ★양성대조 ⒞ 에서 드러났다:
     `_dotWrapRange` 의 「꺼낸 조각 안 옛 점 걷기」를 ★끄고 전수를 돌렸더니 ★rc=0, ★한 건도 안 빨개졌다.
     ⇒ D9(끄고 켜기)는 그 축을 ★못 잰다 — 끄는 갈래가 _dotStripAll 로 ★먼저 다 걷어서 조각에 옛 점이 없다.
     그 가드가 ★실제로 쓰이는 길은 ★「이미 점 찍힌 글자를 포함해 ★부분 선택으로 다시 두르기」 ★하나다.
     ⛔「아무도 안 빨개지니 죽은 코드다」로 읽고 지우지 마라 — 길이 ★있고 시험이 ★없었던 것이다. */
  const errs = await setup(page);
  const id = await insertText(page);                 // 'AAA BBB CCC'
  await openPanel(page, id);
  const host = `#${id} [contenteditable]`;

  await editAndSelectTail(page, host, 4, 3);         // "BBB"
  await assertPremiseSel(page, host, 'BBB');
  await clickBtn(page, '#txt-dot-btn');
  const first = await state(page, id);
  expect(first.nSpan, `★전제 — 첫 두르기에서 3개가 아니다. 잰 값 ${first.nSpan}`).toBe(3);

  /* ★겹치게 다시 고른다 — "A BBB"(앞 글자 하나 ＋ 공백 ＋ 이미 점 찍힌 BBB) */
  await editAndSelectTail(page, host, 4, 5);
  await assertPremiseSel(page, host, 'A BBB');
  await clickBtn(page, '#txt-dot-btn');

  const got = await state(page, id);
  const nested = await page.evaluate((i) => document.getElementById(i)
    .querySelectorAll('span.tb-dot span.tb-dot').length, id);
  const dotted = await page.evaluate((i) => [...document.getElementById(i)
    .querySelectorAll('span.tb-dot')].map(x => x.textContent).join(''), id);
  console.log('  D13:', JSON.stringify({ nSpan: got.nSpan, nested, dotted, idx: got.idx, text: got.text }));
  expect(nested, `★★점 span 이 ★겹쳐 쌓였다 — 옛 점을 안 걷고 다시 둘렀다. 잰 값 ${nested}`).toBe(0);
  expect(dotted, `★점 달린 글자가 'ABBB' 가 아니다(겹침이면 글자가 두 번 세어진다). 잰 값 ${JSON.stringify(dotted)}`).toBe('ABBB');
  expect(got.nSpan, `★점 span 수가 글자 수와 다르다. 잰 값 ${got.nSpan}`).toBe(4);
  /* ★자리번호도 ★다시 매겨졌다 — 4개면 −1.5 … 1.5 (안 매기면 간격이 통째로 밀린다) */
  expect(got.idx, `★자리번호가 4개짜리로 다시 안 매겨졌다. 잰 값 ${JSON.stringify(got.idx)}`).toEqual(['-1.5', '-0.5', '0.5', '1.5']);
  expect(got.text, '★글자가 바뀌었다').toBe('AAA BBB CCC');
  expect(errs).toEqual([]);
});


/* ══════════════ 2026-10-09 현빈 — 「글자를 사이에 추가 입력」 ══════════════ */

test('D14 ★글자 ★사이 끼워넣기 — 점 수가 ★따라온다 (＋이어서 한 자 = 캐럿이 살아 있나)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);                 // 'AAA BBB CCC'
  await openPanel(page, id);
  await centerText(page, id);
  const host = `#${id} [contenteditable]`;

  await editAndSelectTail(page, host, 4, 3);         // "BBB"
  await assertPremiseBBB(page, host);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);          // ★켠 ★뒤에 — 색 칸은 꺼져 있으면 display:none 이다

  const s0 = await state(page, id);
  const p0 = await paintedDots(page, BOX);
  expect(s0.nSpan, `★전제 — 켜자마자 span 이 3개가 아니다. 잰 값 ${s0.nSpan}`).toBe(3);
  expect(p0.pts.length, `★전제 — ★그려진 점이 3개가 아니다. 잰 값 ${p0.pts.length}`).toBe(3);

  /* 'AAA BB|B CCC' — 둘째·셋째 B ★사이 */
  await caretBetween(page, host, 5);
  await assertPremiseCaret(page, host, 'tb-dot', 6);

  await page.keyboard.type('X');
  await page.waitForTimeout(250);
  const s1 = await state(page, id);
  const d1 = await dottedChars(page, id);
  const p1 = await paintedDots(page, BOX);
  console.log('  D14 한 자:', JSON.stringify({ text: s1.text, nSpan: s1.nSpan, dotted: d1, painted: p1.pts.length, idx: s1.idx }));
  /* ★★★«그려진 점» 을 ★맨 앞에 둔다 — ★이 칸의 ★주 단언이다(현빈이 ★본 것이 ★이것이다).
     ⛔뒤에 두면 ★무력화 대조의 ★빨강이 ★앞의 span·글자 단언에서 ★먼저 터져 ★«그린 자»가
     ★제 몫을 하는 것을 ★한 번도 ★못 본다(2026-10-09 M1 에서 ★실제로 그랬다 — ★순서를 고쳤다). */
  expect(p1.pts.length, `★★★그려진 점이 4개가 아니다 — ★이것이 현빈이 본 것이다. 잰 값 ${p1.pts.length}`).toBe(4);
  expect(s1.text, `★글자가 'AAA BBXB CCC' 가 아니다. 잰 값 ${JSON.stringify(s1.text)}`).toBe('AAA BBXB CCC');
  expect(d1, `★점 달린 글자가 'BBXB' 가 아니다 — 끼운 글자가 점을 ★못 받았다. 잰 값 ${JSON.stringify(d1)}`).toBe('BBXB');
  expect(s1.nSpan, `★점 span 수가 글자 수(4)와 다르다 — 한 span 에 두 글자가 들었다. 잰 값 ${s1.nSpan}`).toBe(4);
  expect(s1.idx, `★자리번호가 4개짜리로 다시 안 매겨졌다(안 매기면 간격이 통째로 밀린다). 잰 값 ${JSON.stringify(s1.idx)}`)
    .toEqual(['-1.5', '-0.5', '0.5', '1.5']);

  /* ★이어서 한 자 더 — ★캐럿이 ★그 자리에 살아 있어야 'Y' 가 ★X 뒤로 간다.
     ⛔span 을 쪼개면 캐럿이 들었던 ★텍스트 노드가 ★없어진다 ⇒ 되살리지 않으면 'Y' 가 ★딴 데 간다. */
  await page.keyboard.type('Y');
  await page.waitForTimeout(250);
  const s2 = await state(page, id);
  const d2 = await dottedChars(page, id);
  const p2 = await paintedDots(page, BOX);
  console.log('  D14 이어서:', JSON.stringify({ text: s2.text, nSpan: s2.nSpan, dotted: d2, painted: p2.pts.length }));
  expect(p2.pts.length, `★그려진 점이 5개가 아니다. 잰 값 ${p2.pts.length}`).toBe(5);
  expect(s2.text, `★이어 친 글자가 ★제자리에 안 갔다(캐럿이 안 살았다). 잰 값 ${JSON.stringify(s2.text)}`).toBe('AAA BBXYB CCC');
  expect(d2, `★점 달린 글자가 'BBXYB' 가 아니다. 잰 값 ${JSON.stringify(d2)}`).toBe('BBXYB');
  expect(s2.nSpan, `★점 span 수가 5가 아니다. 잰 값 ${s2.nSpan}`).toBe(5);
  expect(errs).toEqual([]);
});

test('D15 ★★형광펜 ★대조 — 같은 짓에서 획은 ★새 글자를 덮는다 (★기준선)', async ({ page }) => {
  /* ★★이 칸이 ★점 spec 에 사는 까닭 — ★D14 의 ★기대값이 ★어디서 왔나를 ★여기가 적는다.
     현빈의 말이 「★하이라이트는 잘 되는데 점은 안된다」였다 ⇒ ★형광펜이 ★참값의 출처다.
     ⛔형광펜 쪽이 ★바뀌면 ★이 칸이 빨개진다 — 그때 ★점의 기대값도 ★다시 봐야 한다는 뜻이다. */
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  const host = `#${id} [contenteditable]`;

  await editAndSelectTail(page, host, 4, 3);
  await assertPremiseBBB(page, host);
  await clickBtn(page, '#txt-highlight-btn');

  const h0 = await hlChars(page, id);
  expect(h0, `★전제 — 획이 "BBB" 하나가 아니다. 잰 값 ${JSON.stringify(h0)}`).toBe('BBB');

  await caretBetween(page, host, 5);
  await assertPremiseCaret(page, host, 'tb-hl', 6);
  await page.keyboard.type('X');
  await page.waitForTimeout(250);

  const h1 = await hlChars(page, id);
  const nHl = await page.evaluate((i) => document.getElementById(i).querySelectorAll('span.tb-hl').length, id);
  const text = await page.evaluate((i) => document.getElementById(i).querySelector('[contenteditable]').innerText, id);
  console.log('  D15:', JSON.stringify({ text, nHl, hl: h1 }));
  expect(text, `★글자가 'AAA BBXB CCC' 가 아니다. 잰 값 ${JSON.stringify(text)}`).toBe('AAA BBXB CCC');
  expect(nHl, `★획 span 이 ★하나가 아니다 — 형광펜 쪽 꼴이 바뀌었다. 잰 값 ${nHl}`).toBe(1);
  expect(h1, `★획이 새 글자를 ★안 덮는다 — ★기준선이 무너졌다(점의 기대값도 다시 봐야 한다). 잰 값 ${JSON.stringify(h1)}`).toBe('BBXB');
  expect(errs).toEqual([]);
});

test('D16 ★붙여넣기 — `input` 이 안 오는 길에서도 점 수가 따라온다', async ({ page }) => {
  /* ★★2026-10-09 실측: 글자칸의 paste 핸들러(js/block-drag.js)가 `preventDefault()` 뒤
     ★제 손으로 텍스트 노드를 꽂는다 ⇒ ★`input` 이벤트가 ★오지 않는다.
     고치기 전 잰 값: 점 span 에 'PQ' 를 붙여 span 이 ★'가PQ' — 글자 7 / ★그려진 점 5.
     ⇒ 위임이 ★`paste` 도 ★듣는다(버블이라 꽂기 ★뒤에 돈다). */
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await centerText(page, id);
  const host = `#${id} [contenteditable]`;

  await editAndSelectTail(page, host, 4, 3);
  await assertPremiseBBB(page, host);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);          // ★켠 ★뒤에 — 색 칸은 꺼져 있으면 display:none 이다
  const s0 = await state(page, id);
  expect(s0.nSpan, `★전제 — 켜자마자 3개가 아니다. 잰 값 ${s0.nSpan}`).toBe(3);

  await caretBetween(page, host, 5);
  await assertPremiseCaret(page, host, 'tb-dot', 6);
  /* ★앱의 paste 핸들러를 ★그대로 탄다 — ⛔DOM 을 내 손으로 고치지 않는다. */
  await page.evaluate((i) => {
    const ce = document.getElementById(i).querySelector('[contenteditable]');
    const dt = new DataTransfer(); dt.setData('text/plain', 'PQ');
    ce.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, id);
  await page.waitForTimeout(300);

  const s1 = await state(page, id);
  const d1 = await dottedChars(page, id);
  const p1 = await paintedDots(page, BOX);
  console.log('  D16:', JSON.stringify({ text: s1.text, nSpan: s1.nSpan, dotted: d1, painted: p1.pts.length }));
  expect(p1.pts.length, `★그려진 점이 5개가 아니다. 잰 값 ${p1.pts.length}`).toBe(5);
  expect(s1.text, `★붙여넣은 글자가 제자리에 안 갔다. 잰 값 ${JSON.stringify(s1.text)}`).toBe('AAA BBPQB CCC');
  expect(d1, `★점 달린 글자가 'BBPQB' 가 아니다. 잰 값 ${JSON.stringify(d1)}`).toBe('BBPQB');
  expect(s1.nSpan, `★점 span 수가 5가 아니다 — 붙여넣기는 input 이벤트가 안 온다. 잰 값 ${s1.nSpan}`).toBe(5);
  expect(errs).toEqual([]);
});

test('D17 ★★음성대조 — ★공백을 끼우면 점이 ★안 늘어난다', async ({ page }) => {
  /* ★이 칸이 없으면 ★「끼운 글자마다 무조건 두른다」로 고쳐도 ★초록이 난다 —
     그러면 ★D2 의 「공백엔 안 찍는다」와 ★조용히 갈린다(쪼개는 자가 ★한 벌인지를 여기서 잰다). */
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await centerText(page, id);
  const host = `#${id} [contenteditable]`;

  await editAndSelectTail(page, host, 4, 3);
  await assertPremiseBBB(page, host);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);          // ★켠 ★뒤에 — 색 칸은 꺼져 있으면 display:none 이다
  const s0 = await state(page, id);
  expect(s0.nSpan, `★전제 — 켜자마자 3개가 아니다. 잰 값 ${s0.nSpan}`).toBe(3);

  await caretBetween(page, host, 5);
  await assertPremiseCaret(page, host, 'tb-dot', 6);
  await page.keyboard.type(' ');
  await page.waitForTimeout(250);

  const s1 = await state(page, id);
  const d1 = await dottedChars(page, id);
  const p1 = await paintedDots(page, BOX);
  console.log('  D17:', JSON.stringify({ text: JSON.stringify(s1.text), nSpan: s1.nSpan, dotted: d1, painted: p1.pts.length }));
  expect(d1, `★공백에 점이 찍혔다(점 달린 글자에 공백이 들었다). 잰 값 ${JSON.stringify(d1)}`).toBe('BBB');
  expect(s1.nSpan, `★점 span 수가 ★3에서 변했다 — 공백이 span 을 하나 더 만들었다. 잰 값 ${s1.nSpan}`).toBe(3);
  expect(p1.pts.length, `★그려진 점이 3개가 아니다. 잰 값 ${p1.pts.length}`).toBe(3);
  expect(errs).toEqual([]);
});

test('D18 ★한글 IME — ★조립 중엔 손대지 않고(음성대조) ★확정 뒤에 센다', async ({ page }) => {
  /* ★조립 중에 span 을 쪼개면 ★조립이 깨진다(글자가 토막난다) ⇒ `isComposing` 이면 ★물러선다.
     ★그러면 ★조립 중 한 칸은 ★«틀린 채»가 ★맞다 — ★그걸 ★음성대조로 ★박아 둔다
     (안 박아 두면 다음 사람이 「조립 중에도 맞춰야 한다」로 읽고 ★IME 를 깬다). */
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await centerText(page, id);
  const host = `#${id} [contenteditable]`;

  await editAndSelectTail(page, host, 4, 3);
  await assertPremiseBBB(page, host);
  await clickBtn(page, '#txt-dot-btn');
  await pickDotColor(page);          // ★켠 ★뒤에 — 색 칸은 꺼져 있으면 display:none 이다
  const s0 = await state(page, id);
  expect(s0.nSpan, `★전제 — 켜자마자 3개가 아니다. 잰 값 ${s0.nSpan}`).toBe(3);

  await caretBetween(page, host, 5);
  await assertPremiseCaret(page, host, 'tb-dot', 6);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'ㄱ', selectionStart: 1, selectionEnd: 1 });
  await page.waitForTimeout(250);
  const mid = await state(page, id);
  const dMid = await dottedChars(page, id);
  console.log('  D18 조립중:', JSON.stringify({ text: mid.text, nSpan: mid.nSpan, dotted: dMid }));
  expect(mid.text, `★전제 — 조립 글자가 ★그 자리에 안 들어갔다. 잰 값 ${JSON.stringify(mid.text)}`).toBe('AAA BBㄱB CCC');
  expect(mid.nSpan, `★★조립 ★중에 span 을 쪼갰다 — IME 가 깨진다. 잰 값 ${mid.nSpan}`).toBe(3);
  expect(dMid, `★조립 중 span 이 'BBㄱB' 로 안 남았다(한 span 에 조립 글자가 든 채여야 한다). 잰 값 ${JSON.stringify(dMid)}`).toBe('BBㄱB');

  await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 });
  await page.waitForTimeout(150);
  await cdp.send('Input.insertText', { text: '가' });
  await page.waitForTimeout(350);

  const s1 = await state(page, id);
  const d1 = await dottedChars(page, id);
  const p1 = await paintedDots(page, BOX);
  console.log('  D18 확정:', JSON.stringify({ text: s1.text, nSpan: s1.nSpan, dotted: d1, painted: p1.pts.length }));
  expect(p1.pts.length, `★그려진 점이 4개가 아니다 — compositionend 를 안 들으면 3이다. 잰 값 ${p1.pts.length}`).toBe(4);
  expect(s1.text, `★확정된 글자가 제자리에 안 갔다. 잰 값 ${JSON.stringify(s1.text)}`).toBe('AAA BB가B CCC');
  expect(d1, `★점 달린 글자가 'BB가B' 가 아니다. 잰 값 ${JSON.stringify(d1)}`).toBe('BB가B');
  expect(s1.nSpan, `★확정 뒤에도 점 span 이 4개가 아니다 — compositionend 를 안 듣는다. 잰 값 ${s1.nSpan}`).toBe(4);
  expect(errs).toEqual([]);
});
