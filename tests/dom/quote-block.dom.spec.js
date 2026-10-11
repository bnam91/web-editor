/* quote-block.dom.spec.js — ★인용구 블럭(QT1) v1 잠금. (2026-10-07 · 레인 gd/quote · base dev 4b36eb56)
 *
 * ★장면은 «앱이 짓는 꼴»로 — 블럭은 ★전부 `window.addQuoteBlock()` 으로 만든다.
 *   ★그 함수가 ★컴포넌트 드롭다운 단추가 부르는 ★바로 그 함수다(index.html:723).
 *   ⛔손으로 DOM 을 짓지 마라 — 「그 꼴이 앱에서 생기나」를 안 재게 된다.
 * ★하네스는 ★정본 `_root-harness.bootApp` 이다(그 파일 :42 · 소비자 157). ⛔제 하네스 금지.
 *
 * ══ ★자 ★셋 — ★「읽히나」는 ★한 자로 안 잡힌다 ═══════════════════════════════
 *   ㉠ «눌렸나»   = 그룹의 ★자연폭(flex 를 잠깐 꺼서 잰다) vs 남는 폭
 *   ㉡ «쪼개졌나» = ★«구별되는 y» 의 수 (Range 를 텍스트 노드에 걸어 센다)
 *   ★㉢ «잘렸나»  = ★기하(오른끝 넘었나) ＋ ★`elementFromPoint(가운데)` 가 ★그 단추를 돌려주나
 * ★★㉢ 이 ★왜 필요한가 — ★실측(2026-10-07 · _probe-qt1-clip · ×3):
 *   `.prop-type-group` ＋ 8단추 ⇒ ㉠ ★0건 · ㉡ ★0건 ★인데 ★`〈 〉` 가 ★+23px 넘쳐
 *   `elementFromPoint` 가 ★`panel-body` 를 돌려줬다 = ★★안 눌린다.
 *   까닭 셋이 겹친다: `min-width:max-content`(안 눌린다) ＋ `white-space:nowrap`(안 쪼개진다)
 *                    ＋ `.prop-row{overflow:hidden}`(★그냥 ★잘린다).
 *   ⛔`scrollWidth > clientWidth` 금지 — `flex:1` 이면 ★항등식이다(쿠폰·padviz 레인 실측).
 *   ⛔`getClientRects().length` 금지 — «줄» 수가 아니라 ★«글자 토막» 수다(nowrap 에서 오탐).
 * ⚠️★전제 — `#panel-right` 의 `.prop-row` 는 ★18줄 중 ★6줄만 clientWidth ★211 이고 ★12줄은 ★0 이다
 *   (숨은 줄). ⇒ ⛔첫 `.prop-row` 를 아무거나 집어 폭을 재지 마라 — ★0 을 재고 ★거짓 초록이 된다.
 *
 * ══ ★양성대조 = ★변이표 (★새 기능은 「없어서 빨강」이라 ★약하다 — 조건만 바꿔 빨강을 만든다) ══
 *   ★`$S/qt1/mutate.sh` 가 ★아래 변이를 ★하나씩 넣고 ★이 파일을 돌린다. ★기대 방향을 ★같이 적는다.
 *   M1 quote-block.js `quoteLines` 의 `.filter(s => s !== '')` 를 ★뺀다      ⇒ ★Q4 빨강 기대
 *   M2 renderQuoteBlock inline 의 `st.preOn ?` 를 ★항상 true 로              ⇒ ★Q3 빨강 기대
 *   M3 `_markEl` 의 `st.markSize` 를 ★`st.fontSize` 로 바꾼다(부호를 글에 묶는다) ⇒ ★Q5 빨강 기대
 *   M4 prop-quote.js 「모양」 줄을 ★`.prop-type-group` 으로 되돌린다          ⇒ ★Q6 빨강 기대
 *   M5 save-load.js 의 `.quote-block` 을 ★직렬화 명부에서 뺀다               ⇒ ★Q7 빨강 기대
 *   ★M6 renderQuoteBlock stack 의 `grid-template-rows` 를 ★`-columns` 로 되돌린다 ⇒ ★Q9 빨강 기대
 *   ★M7 stack 의 `justify-items:${_qtSide(...)}` 를 ★`start` 고정으로            ⇒ ★Q10 빨강 기대
 *   ★N1(음성대조) quote-block.js ★주석 한 줄을 고친다(무해)                  ⇒ ★전부 초록 기대
 *
 * ══ ★★⚰️2026-10-09 — ★★Q4 의 불변식이 ★«죽었다»(⛔뒤집힌 것이 아니다) ════════════
 *   ★옛 문장: 「★stack — 줄마다 부호가 따라붙는다 ⇒ ★★그려진 줄 수 == ★부호 쌍 수」
 *     ★그 까닭 = ★옛 stack 이 ★«줄마다 `.tb-qt-row` 를 내고 그 안에 부호를 한 쌍씩» 두는 꼴이었다.
 *   ★★현빈 2026-10-09: 「★quote 블럭 ★스택모드 — ★지금 ★스택모드 ★이해가 ★틀렸다.
 *     ★3×1 이 스택모드서 ★1×3 으로 바뀌어야 한다(★현재 안 그럼).」
 *   ⇒ ★★그 «꼴 자체»가 틀린 것이었다 ⇒ ★까닭이 죽었으니 ★그 단언도 죽는다.
 *   ★무엇으로 바뀌었나 — stack = ★1열×3행 `[앞부호]/[글]/[뒤부호]` · ★부호는 ★한 쌍.
 *   ★실측(고치기 전 · 좌표로): ★한 줄 글에서 inline 도 stack 도 ★둘 다 ★3열×1행이었다
 *     (조각 cx 329/717/1105 → 675/717/759 — ★간격만 좁아지고 ★축이 ★안 돌았다).
 *   ⛔옛 문장을 ★지우지 마라 — 「★왜 줄마다 부호가 없나」를 묻는 다음 사람에게 ★이 줄이 답이다.
 *   ★살아남은 것 = 「★★빈 줄은 건너뛴다」 ★하나다(M1 이 그 자리를 그대로 잡는다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/quote-block.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

/** 앱 ＋ 섹션 하나. 블럭은 ★앱 함수로 만든다. */
async function setup(page, opts = {}) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((o) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sQ"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll && window.rebindAll();
    window.applyZoom && window.applyZoom(100);
    window.deselectAll && window.deselectAll();
    window.selectSection(document.getElementById('sQ'));
    window.addQuoteBlock(o);                       // ★컴포넌트 드롭다운이 부르는 그 함수
    window.__qt = [...document.querySelectorAll('#sQ .quote-block')].pop();
    window.buildLayerPanel && window.buildLayerPanel();
    window.deselectAll && window.deselectAll();
    window.__qt && window.__qt.scrollIntoView({ block: 'center' });
  }, opts);
  await page.waitForFunction(() => !!window.__qt && window.__qt.isConnected, null, { timeout: 5000 });
  return errs;
}

/** 진짜 클릭으로 블럭을 골라 패널을 연다(사람이 하는 순서 · 공용 루프를 지난다). */
async function openPanel(page) {
  await page.evaluate(() => { window.__qt.dataset.pnl = '1'; });
  const r = await waitStableRect(page, '[data-pnl="1"]');
  await clickAt(page, r.cx, r.cy, { sel: '[data-pnl="1"]' }, { label: 'QT1 블럭 고르기' });
  await page.waitForFunction(() => !!document.getElementById('qt-shape-group'), null, { timeout: 5000 })
    .catch(() => { throw new Error('고르기가 ★인용구 패널을 못 열었다 — 공용 루프(block-drag.js) 합류를 보라'); });
}

/* ── Q1 ★만들어진다 ＋ ★모델이 dataset 에 산다 ───────────────────────────────── */
test('Q1 ★컴포넌트 메뉴 함수로 만들어지고 ★상태가 dataset 에 산다(인라인 style 아님)', async ({ page }) => {
  const errs = await setup(page);
  const m = await page.evaluate(() => {
    const b = window.__qt;
    return {
      cls: b.className, type: b.dataset.type, id: b.id,
      shape: b.dataset.shape, layout: b.dataset.layout,
      markSize: b.dataset.markSize, gap: b.dataset.gap, fontSize: b.dataset.fontSize,
      preOn: b.dataset.preOn, postOn: b.dataset.postOn,
      marks: b.querySelectorAll('.tb-qt-mark').length,
      lines: b.querySelectorAll('.tb-qt-line').length,
      /* ★내보내기 보험 — 글자·부호가 ★`tb-` 접두를 갖나(figma generic 폴백이 그것만 모은다) */
      tbPrefixed: [...b.querySelectorAll('[class^="tb-"]')].length,
    };
  });
  expect(m.cls, '★클래스 = quote-block').toContain('quote-block');
  expect(m.type, '★data-type = quote').toBe('quote');
  expect(m.id.startsWith('qt'), `★id 접두 = qt (실측 ${m.id})`).toBe(true);
  expect(m.shape, '★기본 모양 = curly').toBe('curly');
  expect(m.layout, '★기본 꼴 = inline').toBe('inline');
  /* ★전부 박혀 있어야 한다 — 안 박으면 기본값을 바꿀 때 이미 만든 블럭이 같이 움직인다 */
  for (const k of ['markSize', 'gap', 'fontSize', 'preOn', 'postOn']) {
    expect(m[k], `★dataset.${k} 가 박혀 있다`).toBeTruthy();
  }
  expect(m.marks, '★부호 한 쌍 = 2').toBe(2);
  expect(m.lines, '★글 줄 1').toBe(1);
  expect(m.tbPrefixed, '★tb- 접두 요소 ≥3 (부호 2 ＋ 글 1) — 내보내기 보험').toBeGreaterThanOrEqual(3);
  expect(errs, '★오류 0').toEqual([]);
});

/* ── Q2 ★inline = «3×1 느낌»을 ★블럭이 스스로 낸다 (⛔grid-block 아니다) ──────── */
test('Q2 ★inline 은 제 격자로 3칸을 낸다 — ⛔grid-block 을 쓰지 않는다', async ({ page }) => {
  await setup(page);
  const m = await page.evaluate(() => {
    const b = window.__qt;
    const cs = getComputedStyle(b);
    return {
      display: cs.display,
      cols: cs.gridTemplateColumns.split(' ').filter(Boolean).length,
      /* ⛔그리드 블럭에 ★안 들어가 있다 — 「3×1 그리드로 만들지 마라」의 행위 단언 */
      insideGrid: !!b.closest('.grid-block'),
      hasGridClass: b.classList.contains('grid-block'),
      gridBlocksOnCanvas: document.querySelectorAll('#canvas .grid-block').length,
    };
  });
  expect(m.display, '★display:grid — 제 격자').toBe('grid');
  expect(m.cols, '★칸 셋(부호·글·부호)').toBe(3);
  expect(m.insideGrid, '⛔grid-block 안에 있지 않다').toBe(false);
  expect(m.hasGridClass, '⛔grid-block 클래스가 아니다').toBe(false);
  expect(m.gridBlocksOnCanvas, '⛔그리드 블럭을 만들지 않았다').toBe(0);
});

/* ── Q3 ★앞/뒤 부호를 끄면 ★칸째 빠진다 (⛔빈 칸으로 남지 않는다) ──────────────── */
test('Q3 ★앞·뒤 부호 끄기 — 끈 쪽은 ★칸째 빠지고 글이 그만큼 넓어진다', async ({ page }) => {
  await setup(page);
  const read = () => page.evaluate(() => {
    const b = window.__qt;
    const cs = getComputedStyle(b);
    const body = b.querySelector('.tb-qt-body');
    return {
      cols: cs.gridTemplateColumns.split(' ').filter(Boolean).length,
      marks: [...b.querySelectorAll('.tb-qt-mark')].map(e => e.dataset.qtMark),
      bodyW: body ? Math.round(body.getBoundingClientRect().width) : 0,
    };
  });
  const both = await read();
  expect(both.cols, '★전제 — 둘 다 켜면 3칸').toBe(3);
  expect(both.marks, '★전제 — 부호 둘').toEqual(['pre', 'post']);

  /* 뒤 부호 끄기 */
  await page.evaluate(() => { window.__qt.dataset.postOn = '0'; window.renderQuoteBlock(window.__qt); });
  const noPost = await read();
  expect(noPost.cols, '★뒤를 끄면 ★2칸 — ⛔빈 칸이 남지 않는다').toBe(2);
  expect(noPost.marks, '★앞 부호만 남는다').toEqual(['pre']);

  /* 앞 부호도 끄기 — 부호 0, 1칸 */
  await page.evaluate(() => { window.__qt.dataset.preOn = '0'; window.renderQuoteBlock(window.__qt); });
  const none = await read();
  expect(none.cols, '★둘 다 끄면 1칸').toBe(1);
  expect(none.marks, '★부호 0').toEqual([]);

  /* ══ ★★⚰️2026-10-10 — ★옛 단언 ★둘의 ★까닭이 ★죽었다 (⛔지우지 않고 ★여기 남긴다) ═══════
     ★옛 문장: `expect(noPost.bodyW).toBeGreaterThan(both.bodyW)` ＋ `none.bodyW > noPost.bodyW`
       「★끈 쪽은 ★칸째 빠져 ★글이 ★그만큼 ★넓어진다」(★근거 = 시안 ⒟).
     ★그 까닭 = ★옛 inline 가운데 칸이 ★`minmax(0,1fr)` 이라 ★글 칸이 ★남는 폭을 ★전부 먹었다
       ⇒ ★부호 칸이 빠지면 ★글 칸의 ★실제 폭이 ★그만큼 늘었다.
     ★★그런데 ★바로 그 `1fr` 이 ★현빈 1010t2c2(「간격조절이 안 된다」)의 ★참 원인이었다 —
       ★가운데 칸이 ★남는 폭을 다 먹으면 `column-gap` 이 ★사람 눈의 거리에서 ★★약분된다
       (실측 핀 ★f69c307e: gap 0→40 에서 거리 ★391.6 → ★391.6 = ★0.0px · ★Q16 머리말).
     ⇒ ★가운데 칸을 ★`minmax(0,auto)` 로 갈았다 ⇒ ★글 칸 폭 = ★★글폭이다
       (실측: 짧은 글에서 ★119 → ★119 — ★«안 넓어진다»).
     ★★★그래서 ★«넓어진다»를 ★★«쓸 수 있는 폭이 넓어진다»로 ★다시 적는다 — ★시안 ⒟ 의 뜻은
       ★살아 있고(부호를 끄면 ★글이 더 쓸 수 있다) ★잴 자리만 ★바뀐 것이다.
       ⇒ ★짧은 글로는 ★안 보인다(★글폭이 천장이라) ⇒ ★★긴 글로 잰다.

     ══ ★★⚰️ ★세 칸 (★지디 2026-10-10 요구 — ⛔「문」만 남기고 「까닭」을 잃지 않게) ════════
     ★★⒜ ★누가·언제 — ★판정 ★2026-10-10 ★지디(팀장) · ★근거 = ★현빈 ★`1010t2c2` ★원문
          「그리고 우측 패널에서 슬라이드를 움직여도 ★실제론 ★간격조절이 안되는 ★문제가 있어」
          ⇒ ★현빈이 ★★«문제»라 ★불렀고 ★그 말이 ★시안 메모보다 ★★더 ★새 말이다.
          ⇒ ★지디가 ★★현빈 노트 `p9909` 에 ★올렸다 — ★★그가 ★되돌릴 수 ★있게.
     ★★⒝ ★무엇을 ★놓았나(=★이름) — ★★시안 ⒟ 의 ★「★끈 쪽은 ★칸째 ★빠져 ★글이 ★그만큼 ★넓어진다」
          ⇒ ⛔★그 줄을 ★★«폐기된 선례»로 ★읽지 ★마라 — ★★«글이 ★더 ★쓸 수 있다»는 ★뜻은 ★★살아 있고
            ★★잴 ★자리만 ★옮겼다(★짧은 글 ⇒ ★긴 글). ★★되살릴 ★조건 = ★★현빈이 ★「칸이 ★전폭을 먹어야
            한다」를 ★★다시 ★말하면 — ★그때는 ★★간격 슬라이더를 ★★치워야 ★한다(★둘은 ★동시에 ★참이 ★못 된다).
     ★★⒞ ★되돌리는 ★법(=★자리) — ★★`js/blocks/quote-block.js` `renderQuoteBlock` inline 가지의 ★★두 줄:
          ① 가운데 칸 ★`minmax(0,auto)` → ★`minmax(0,1fr)`   ② ★`justify-content:${_qtSide(st.align)}` ★제거
          ⇒ ★그 둘을 ★되돌리면 ★★Q16 ★하나가 ★빨개지고 ★여기 ⚰️ ★둘을 ★옛 문장으로 ★되돌리면 된다.
          ⇒ ★★그 둘이 ★★«각각» ★지탱하는 자리는 ★양성대조 ★M17·M18 이 ★가렸다(spec 머리말의 그 표).
  */
  const readLong = () => page.evaluate(() => {
    const b = window.__qt;
    const body = b.querySelector('.tb-qt-body');
    return {
      cols: getComputedStyle(b).gridTemplateColumns.trim().split(/\s+/).length,
      bodyW: body ? Math.round(body.getBoundingClientRect().width) : 0,
      lines: b.querySelectorAll('.tb-qt-line').length,
      blockW: Math.round(b.getBoundingClientRect().width),
    };
  });
  /* ★긴 글 — ★가운데 칸이 ★천장(available)에 ★닿아야 ★«쓸 수 있는 폭»이 ★보인다 */
  await page.evaluate(() => {
    const b = window.__qt;
    b.dataset.preOn = '1'; b.dataset.postOn = '1';
    b.dataset.text = '처음 입어도 내 옷 같은 핏 ' .repeat(8);
    window.renderQuoteBlock(b);
  });
  const lBoth = await readLong();
  expect(lBoth.cols, '★전제 — 긴 글에서도 ★둘 다 켜면 3칸').toBe(3);
  expect(lBoth.bodyW < lBoth.blockW, `★전제 — 긴 글의 글 칸이 ★천장에 닿았다(글 칸 ${lBoth.bodyW} < 블럭 ${lBoth.blockW})`).toBe(true);

  await page.evaluate(() => { window.__qt.dataset.postOn = '0'; window.renderQuoteBlock(window.__qt); });
  const lNoPost = await readLong();
  expect(lNoPost.cols, '★뒤를 끄면 2칸(긴 글에서도)').toBe(2);
  expect(lNoPost.bodyW, `★★글이 ★쓸 수 있는 폭이 ★넓어진다 — 뒤 부호를 끈 뒤 (${lBoth.bodyW} → ${lNoPost.bodyW})`)
    .toBeGreaterThan(lBoth.bodyW);

  await page.evaluate(() => { window.__qt.dataset.preOn = '0'; window.renderQuoteBlock(window.__qt); });
  const lNone = await readLong();
  expect(lNone.cols, '★둘 다 끄면 1칸(긴 글에서도)').toBe(1);
  expect(lNone.bodyW, `★★더 넓어진다 — 앞 부호까지 끈 뒤 (${lNoPost.bodyW} → ${lNone.bodyW})`)
    .toBeGreaterThan(lNoPost.bodyW);
});

/* ── Q4 ★스택 — ★부호는 ★한 쌍 ＋ ★빈 줄은 건너뛴다 ────────────────────────────
   ★★⚰️옛 제목 = 「★스택 — ★줄 수 == 부호 쌍 수 ＋ ★빈 줄은 건너뛴다」.
     ★그 앞 절반은 ★2026-10-09 에 ★까닭이 죽었다(머리말 ⚰️ 절 · 현빈 「스택모드 이해가 틀렸다」).
     ★뒤 절반(빈 줄 건너뛰기)은 ★그대로 ★참이고 ★M1 이 ★여기를 잡는다. */
test('Q4 ★스택 — ★부호는 ★한 쌍(⚰️옛 「줄 수 == 쌍 수」) · ★★빈 줄은 건너뛴다(⛔「/ /」만 뜨지 않는다)', async ({ page }) => {
  /* ★가운데에 ★빈 줄 둘(하나는 공백만)을 섞어 넣는다 — ★그 둘이 ★부호를 받으면 안 된다 */
  await setup(page, { layout: 'stack', shape: 'slash', text: '처음 입어도\n\n내 옷 같은\n   \n핏' });
  const m = await page.evaluate(() => {
    const b = window.__qt;
    const lines = [...b.querySelectorAll('.tb-qt-line')];
    return {
      lines: lines.length,
      pre: b.querySelectorAll('[data-qt-mark="pre"]').length,
      post: b.querySelectorAll('[data-qt-mark="post"]').length,
      texts: lines.map(e => e.textContent),
      oldRows: b.querySelectorAll('.tb-qt-row').length,   /* ⚰️옛 꼴의 자 — ★0 이어야 한다 */
      helper: window.quoteLines(b),
    };
  });
  /* ★원문은 5줄인데 ★둘이 비어 ⇒ ★3줄이어야 한다. ⛔5 면 빈 줄이 ★글줄로 그려진 것이다. */
  expect(m.lines, `★그려진 글줄 = 3 (원문 5줄 중 빈 줄 2 건너뜀) · 실측 ${JSON.stringify(m.texts)}`).toBe(3);
  expect(m.texts, '★빈 줄이 빠진 그 셋').toEqual(['처음 입어도', '내 옷 같은', '핏']);
  expect(m.helper, '★quoteLines 정본도 같은 셋 — ⛔두 벌이 아니다').toEqual(m.texts);
  /* ★★새 불변식 — ★부호는 ★한 쌍이다(★줄 수와 ★무관). ⛔3 이면 ⚰️옛 꼴로 돌아간 것이다. */
  expect(m.pre, `★앞 부호는 ★하나 (⚰️옛 꼴이면 줄 수만큼인 3 이 나온다). 잰 값 ${m.pre}`).toBe(1);
  expect(m.post, `★뒤 부호도 ★하나. 잰 값 ${m.post}`).toBe(1);
  expect(m.oldRows, `★⚰️옛 꼴의 tb-qt-row 가 ★남아 있다. 잰 값 ${m.oldRows}`).toBe(0);
});

/* ── Q5 ★부호 크기·간격은 ★글자 크기와 ★따로 간다 ───────────────────────────── */
test('Q5 ★부호 크기를 키워도 ★글자 크기는 ★안 움직인다(둘이 묶이지 않았다)', async ({ page }) => {
  await setup(page);
  const read = () => page.evaluate(() => {
    const b = window.__qt;
    const mk = b.querySelector('.tb-qt-mark');
    const ln = b.querySelector('.tb-qt-line');
    return {
      markPx: Math.round(parseFloat(getComputedStyle(mk).fontSize)),
      linePx: Math.round(parseFloat(getComputedStyle(ln).fontSize)),
      gapPx: Math.round(parseFloat(getComputedStyle(b).columnGap)),
    };
  });
  const before = await read();
  /* ★단언을 걸기 전에 «바꾸기 전» 값을 쥔다 — ⛔항상 참인 단언을 만들지 않는다 */
  expect(before.markPx, '★전제 — 부호 46px').toBe(46);
  expect(before.linePx, '★전제 — 글 21px').toBe(21);

  await page.evaluate(() => { window.__qt.dataset.markSize = '120'; window.renderQuoteBlock(window.__qt); });
  const big = await read();
  expect(big.markPx, '★부호가 커졌다').toBe(120);
  expect(big.linePx, '★★글자는 ★그대로다 — ⛔부호에 묶이지 않았다').toBe(before.linePx);

  /* 간격도 따로 */
  await page.evaluate(() => { window.__qt.dataset.gap = '48'; window.renderQuoteBlock(window.__qt); });
  const wide = await read();
  expect(wide.gapPx, '★간격이 48').toBe(48);
  expect(wide.linePx, '★글자는 그대로').toBe(before.linePx);
  expect(wide.markPx, '★부호도 그대로(간격과 따로)').toBe(120);
});

/* ── Q6 ★패널 「모양」 8종이 ★211 줄에서 ★읽힌다 — ★자 ★셋을 ★같이 건다 ─────────── */
test('Q6 ★패널 모양 — ★전부 ★닿는다(자 ㉢) · ⛔눌림 0(㉠) · ⛔쪼갬 0(㉡)', async ({ page }) => {
  /* ★★⚰️옛 제목 = 「★패널 모양 ★8종 …」이고 ★단언도 ★`toBe(8)` 이었다.
     ★2026-10-09 ⒝ 로 ★「＋」(부호 직접 더하기) 단추가 ★그 줄에 ★같이 서서 ★9개가 됐다.
     ⇒ ★★수를 ★다시 박지 ★않는다 — ★★«명부에서 끌어온다»(`quoteShapesAll().length + 1`).
        ⛔8 이든 9 든 ★손으로 적으면 ★사용자가 부호를 더하는 ★순간 ★이 칸이 ★거짓이 된다.
     ★살아남은 것 = ★자 셋(닿나·눌렸나·쪼개졌나)과 ★`.prop-align-group` 규약이다 — ★그건 ★그대로다. */
  await setup(page);
  await openPanel(page);

  /* ★전제 — 장면이 틀어지면 ★이 줄이 먼저 빨개진다 */
  const pre = await page.evaluate(() => ({
    panelW: Math.round(document.getElementById('panel-right').getBoundingClientRect().width),
    collapsed: document.body.classList.contains('right-panel-collapsed'),
    /* ★211 인 줄이 ★있나 — ⛔첫 줄을 아무거나 집으면 0 을 잰다(머리말 전제) */
    rows211: [...document.querySelectorAll('#panel-right .prop-row')].filter(r => r.clientWidth === 211).length,
  }));
  expect(pre.collapsed, '★전제 — 패널이 안 접혀 있다').toBe(false);
  expect(pre.panelW, `★전제 — 패널 폭 240 (실측 ${pre.panelW})`).toBe(240);
  expect(pre.rows211, '★전제 — clientWidth 211 인 prop-row 가 있다').toBeGreaterThan(0);

  const m = await page.evaluate(() => {
    const grp = document.getElementById('qt-shape-group');
    const row = grp.closest('.prop-row');
    const cs = getComputedStyle(row);
    const contentRight = row.getBoundingClientRect().right
      - parseFloat(cs.paddingRight || 0) - parseFloat(cs.borderRightWidth || 0);
    /* ★자 ㉠ — 자연폭(flex 를 잠깐 꺼서) */
    const prevFlex = grp.style.flex;
    grp.style.flex = '0 0 auto';
    const natural = Math.round(grp.getBoundingClientRect().width);
    grp.style.flex = prevFlex;
    /* ★자 ㉡ — 구별되는 y (로우 안 모든 텍스트 노드) */
    const splits = [];
    const w = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = (n.textContent || '').trim(); if (!t) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const lines = new Set([...rg.getClientRects()].map(x => Math.round(x.y))).size;
      if (lines > 1) splits.push(t + ':' + lines);
    }
    /* ★자 ㉢ — 기하 ＋ 닿나 */
    const btns = [...grp.children].map(b => {
      const bb = b.getBoundingClientRect();
      const hit = document.elementFromPoint(bb.left + bb.width / 2, bb.top + bb.height / 2);
      const pf = b.style.flex; b.style.flex = '0 0 auto';
      const bn = Math.round(b.getBoundingClientRect().width); b.style.flex = pf;
      return {
        t: b.textContent.trim(), key: b.getAttribute('data-qt-shape'),
        w: Math.round(bb.width), natural: bn,
        overBy: Math.round(bb.right - contentRight),
        reachable: !!hit && (hit === b || b.contains(hit)),
        hitCls: hit ? String(hit.className || hit.tagName) : null,
      };
    });
    return {
      rowW: row.clientWidth, grpClass: grp.className, natural, btnCount: btns.length,
      flexWrap: getComputedStyle(grp).flexWrap,
      btnRows: new Set([...grp.children].map(b => Math.round(b.getBoundingClientRect().y))).size,
      splits, btns,
    };
  });
  console.log('★Q6 자 셋 = ' + JSON.stringify({
    rowW: m.rowW, grpClass: m.grpClass, natural: m.natural, btnRows: m.btnRows,
    over: m.btns.filter(b => b.overBy > 0).map(b => b.t + ':+' + b.overBy),
    unreach: m.btns.filter(b => !b.reachable).map(b => b.t + '→' + b.hitCls),
    splits: m.splits,
  }));

  expect(m.rowW, `★그 줄의 내용폭 = 211 (실측 ${m.rowW})`).toBe(211);
  /* ★★수를 ★명부에서 끌어온다 — ★제품 8종 ＋ ★사용자가 더한 것 ＋ ★「＋」 하나. */
  const wantBtns = await page.evaluate(() => (window.quoteShapesAll ? window.quoteShapesAll().length : 0) + 1);
  expect(wantBtns, '★전제 — 명부를 못 읽었다(quoteShapesAll 이 window 에 없다)').toBeGreaterThan(1);
  expect(m.btnCount, `★모양 단추 = 명부 ${wantBtns - 1}개 ＋ 더하기 1 = ${wantBtns} (실측 ${m.btnCount})`).toBe(wantBtns);
  /* ★「＋」가 ★그 줄의 ★마지막이고 ★`data-qt-shape` 가 ★없다(모양이 아니라 ★행위다) */
  const plus = m.btns[m.btns.length - 1];
  expect(plus.key, `★마지막 단추는 ★모양이 아니라 「＋」여야 한다(key 가 없어야 한다). 잰 값 ${JSON.stringify(plus)}`).toBe(null);
  /* ★꼴이 .prop-align-group 이어야 한다 — ⛔.prop-type-group 으로 되돌리면 8번째가 안 닿는다 */
  expect(m.grpClass, '★`.prop-align-group`(wrap) 이다 — ⛔세그먼트로 되돌리지 마라').toContain('prop-align-group');
  /* ★★자 ㉢ — ★전부 닿는다. ★이것이 M4 변이에서 ★빨개지는 단언이다 */
  const unreach = m.btns.filter(b => !b.reachable);
  expect(unreach.map(b => b.t), `★★모양 단추 ★전부 닿아야 한다 — 안 닿는 것: ${JSON.stringify(unreach)}`).toEqual([]);
  const over = m.btns.filter(b => b.overBy > 0);
  expect(over.map(b => b.t), `★줄 오른끝을 ★넘은 단추 0 — 넘은 것: ${JSON.stringify(over)}`).toEqual([]);
  /* ㉠ 눌림 0 · ㉡ 쪼갬 0 */
  expect(m.btns.filter(b => b.w < b.natural).map(b => b.t), '★눌린 단추 0(자 ㉠)').toEqual([]);
  expect(m.splits, '★쪼개진 글자 0(자 ㉡)').toEqual([]);
  /* ★★⚰️옛 단언 = `expect(m.btnRows).toBe(2)` 「★wrap 으로 ★2줄 — 8종이 155px 에 한 줄로는 안 들어간다(자연폭 252)」.
     ★그 2 는 ★«단추가 8개일 때»의 수였다. ★2026-10-09 ⒝ 로 ★「＋」가 서서 ★3줄(자연폭 284)이 됐고,
     ★사용자가 부호를 ★더 더하면 ★4줄·5줄이 된다. ⇒ ★★수를 박으면 ★쓸수록 ★거짓이 되는 칸이다.
     ★잠가야 하는 것은 ★«줄 수»가 아니라 ★«접힌다»(⛔한 줄에 밀어 넣어 넘치거나 안 닿게 되지 않는다):
       ㉠ `flex-wrap: wrap` 이 ★켜져 있다   ㉡ ★실제로 ★2줄 이상으로 ★접혔다(안 접히면 위 over/unreach 가 잡는다)
     ★위 세 자(닿나·넘나·쪼개지나)가 ★진짜 요구이고 ★이 둘은 ★그 까닭이다. */
  expect(m.flexWrap, `★prop-align-group 이 ★wrap 이어야 한다 (실측 ${m.flexWrap})`).toBe('wrap');
  expect(m.btnRows >= 2, `★실제로 ★접혀야 한다 (실측 ${m.btnRows}줄 · 자연폭 ${m.natural} · 단추 ${m.btnCount}개)`).toBe(true);
});

/* ── Q7 ★로드 경로(rebindAll)를 ★행위로 지난다 — ★save-load 세 자리를 ★한꺼번에 잠근다 ──
   ⚠️★★첫 판은 ★거짓 초록이었다(2026-10-07) — 셀렉터 문자열을 ★이 파일에 ★베껴 와서
     `includes(b)` 를 쟀다. ⇒ ★명부가 ★둘이 되어, save-load.js 에서 `.quote-block` 을 ★빼도
     ★내 사본은 그대로라 ★M5 변이가 ★0건 빨강이었다(=아무것도 안 잠갔다).
   ⇒ ★고친 자 = ★«행위»다. `window.rebindAll()` 을 ★진짜로 불러
     ⑴ id 가 ★붙나(:1393 명부) ⑵ 접두가 ★`qt` 인가(:1418 토큰 · 빠지면 폴백 `tbl`)
     ⑶ ★다시 그려지나(:1427) ★셋을 ★한 번에 잰다. ⛔문자열을 베끼지 마라. */
test('Q7 ★로드 경로 — rebindAll 이 ★id 를 붙이고(qt_) ★다시 그린다(save-load 세 자리)', async ({ page }) => {
  await setup(page, { shape: 'bracket', layout: 'stack', markSize: 70, gap: 30, text: '가\n나' });
  const m = await page.evaluate(() => {
    const b = window.__qt;
    const snap = JSON.stringify({ ...b.dataset });
    /* ★저장본 HTML 에서 막 읽힌 꼴로 되돌린다 — id 없음 · 그림 없음 · 인라인 style 없음.
       ★인라인 style 에만 살던 값이 있으면 ★여기서 죽는다(모델이 dataset 이라는 단언). */
    b.removeAttribute('id');
    b.removeAttribute('style');
    b.innerHTML = '';
    window.rebindAll();                       // ★★진짜 로드 경로
    return {
      id: b.id || '',
      bindKinds: (window.BLOCK_BIND_KINDS || []).includes('quote-block'),
      sameDataset: JSON.stringify({ ...b.dataset }) === snap,
      /* ★「다시 그려졌나」의 자 = ★그려진 ★글줄 수다. ⛔`.tb-qt-row` 로 재지 마라 —
         ★그건 ⚰️옛 stack 꼴의 자여서 ★꼴이 바뀌면 ★0 이 되고, ★그 0 을 「안 그려졌다」로 읽는다. */
      lines: b.querySelectorAll('.tb-qt-line').length,
      pre: b.querySelectorAll('[data-qt-mark="pre"]').length,
      markTxt: (b.querySelector('[data-qt-mark="pre"]') || {}).textContent || '',
      markPx: b.querySelector('.tb-qt-mark')
        ? Math.round(parseFloat(getComputedStyle(b.querySelector('.tb-qt-mark')).fontSize)) : 0,
      /* ★간격의 정본 자리도 ★옮겼다 — stack 은 ★블럭 자신의 `row-gap` 이다(1열×3행이라 ★세로 간격). */
      gapPx: Math.round(parseFloat(getComputedStyle(b).rowGap)) || 0,
    };
  });
  /* ⑴＋⑵ — id 가 붙고 ★접두가 qt. ⛔`.quote-block` 이 명부에서 빠지면 ★빈 id(=빨강),
     ⛔`'qt'` 토큰이 빠지면 ★`tbl_`(=빨강). 둘을 ★한 단언이 ★같이 잡는다. */
  expect(m.id, '★★rebindAll 이 id 를 붙였다 — ⛔빈 id = 직렬화 명부에서 빠졌다').not.toBe('');
  expect(m.id.startsWith('qt_'), `★★id 접두 = qt_ (실측 「${m.id}」 · tbl_ 이면 토큰이 빠진 것)`).toBe(true);
  /* ⑶ — 다시 그려졌다 */
  expect(m.lines, '★★rebindAll 이 ★다시 그렸다 — 글줄 2 (0 이면 재렌더 줄이 빠졌다)').toBe(2);
  expect(m.pre, '★부호는 ★한 쌍이라 ★1 (⚰️옛 꼴이면 줄 수만큼인 2)').toBe(1);
  expect(m.markTxt, '★모양(bracket)이 dataset 에서 되살아났다').toBe('[');
  expect(m.markPx, '★부호 크기 70 이 dataset 에서 되살아났다').toBe(70);
  expect(m.gapPx, '★간격 30 이 dataset 에서 되살아났다').toBe(30);
  expect(m.sameDataset, '★다시 그려도 dataset 이 그대로').toBe(true);
  expect(m.bindKinds, '★BLOCK_BIND_KINDS 명부에 든다').toBe(true);
});

/* ── Q8 ★레이어 패널에 ★제 이름으로 뜬다 (⛔「Asset」 아니다) ───────────────────── */
test('Q8 ★레이어 패널 — 「Quote」로 뜬다(⛔Asset 으로 떨어지지 않는다)', async ({ page }) => {
  await setup(page);
  const m = await page.evaluate(() => {
    window.buildLayerPanel && window.buildLayerPanel();
    const txt = document.getElementById('layer-panel-body')?.textContent || '';
    return { hasQuote: txt.includes('Quote'), asset: (txt.match(/Asset/g) || []).length, len: txt.length };
  });
  expect(m.len, '★전제 — 레이어 패널이 그려졌다').toBeGreaterThan(0);
  expect(m.hasQuote, `★「Quote」가 보인다 (Asset ${m.asset}건)`).toBe(true);
});


/* ══════ 2026-10-09 현빈 — 「★스택모드 이해가 틀렸다 · 3×1 → 1×3」 ══════════════ */

/* 세 조각(앞부호 · 글줄 · 뒤부호)의 ★중심좌표에서 ★구별되는 x 수 = 열 · y 수 = 행.
   ⛔`layout==='stack'` 이라는 ★글자를 읽어 「세로」라 적지 않는다 — ★좌표로 센다.
   ＋ ★격자 트랙 수도 같이 돌려준다(글이 여러 줄이면 ★조각 y 가 ★행보다 많아진다 — 그 둘을 ★가른다). */
const axisOf = (page) => page.evaluate(() => {
  const b = window.__qt;
  const R = (e) => { const r = e.getBoundingClientRect(); return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), l: Math.round(r.left), r: Math.round(r.right) }; };
  const pieces = [
    ...[...b.querySelectorAll('[data-qt-mark="pre"]')].map(e => ({ k: 'pre', ...R(e) })),
    ...[...b.querySelectorAll('.tb-qt-line')].map(e => ({ k: 'line', ...R(e) })),
    ...[...b.querySelectorAll('[data-qt-mark="post"]')].map(e => ({ k: 'post', ...R(e) })),
  ];
  const uniq = (a) => { const o = []; for (const v of a.slice().sort((x, y) => x - y)) if (!o.length || v - o[o.length - 1] > 6) o.push(v); return o; };
  const tracks = (v) => (v && v !== 'none' ? v.trim().split(/\s+/).length : 0);
  const cs = getComputedStyle(b);
  return {
    pieces, colsX: uniq(pieces.map(p => p.cx)), rowsY: uniq(pieces.map(p => p.cy)),
    gridCols: tracks(cs.gridTemplateColumns), gridRows: tracks(cs.gridTemplateRows),
    display: cs.display, justifyItems: cs.justifyItems,
    blockCx: Math.round((b.getBoundingClientRect().left + b.getBoundingClientRect().right) / 2),
    /* ★★블럭 상자 — ★«비율»로 재기 위해서다. ★이 하네스는 ★setup 마다 섹션 배율이 ★달라
       ★블럭 폭이 ★344 / 796 / 835 로 ★움직인다(2026-10-09 프로브 실측).
       ⇒ ⛔setup 을 ★가로지르는 ★절대좌표 비교는 ★무효다 — ★흔들린 것은 ★자다. */
    box: (() => { const r = b.getBoundingClientRect(); return { l: r.left, w: r.width }; })(),
  };
});
/* 조각의 자리를 ★블럭 폭에 대한 ★비율로 — 0 = 왼쪽 모서리 · 0.5 = 중앙 · 1 = 오른쪽 모서리 */
const rat = (a, p, key) => (p[key] - a.box.l) / a.box.w;

test('Q9 ★★축이 돈다 — inline 은 ★3열×1행, stack 은 ★1열×3행 (현빈 「3×1 → 1×3」)', async ({ page }) => {
  /* ★★한 줄 글로 잰다 — ★고치기 전에는 ★여기서 ★둘이 ★똑같이 3×1 이었다(실측 cx 329/717/1105 → 675/717/759).
     ⇒ ★이 칸이 ★그 「현재 안 그럼」을 ★잠근다. ⛔여러 줄로 재면 ★글 덩이가 행을 늘려 ★자가 흐려진다. */
  const e1 = await setup(page, { layout: 'inline', text: '안녕' });
  const i = await axisOf(page);
  expect(i.pieces.length, '★전제 — 조각 셋(앞부호·글·뒤부호)이 다 있다').toBe(3);
  expect(i.colsX.length, `★inline 은 ★3열이어야 한다. 잰 값 ${JSON.stringify(i.colsX)}`).toBe(3);
  expect(i.rowsY.length, `★inline 은 ★1행이어야 한다. 잰 값 ${JSON.stringify(i.rowsY)}`).toBe(1);
  expect(i.gridCols, `★inline 격자 ★열 트랙 = 3. 잰 값 ${i.gridCols}`).toBe(3);
  /* ★음성대조 — inline 에서는 세 조각이 ★가로로 ★안 겹친다(나란히 선다) */
  const ovI = (a, b2) => Math.min(a.r, b2.r) - Math.max(a.l, b2.l);
  expect(ovI(i.pieces[0], i.pieces[1]) <= 0 && ovI(i.pieces[1], i.pieces[2]) <= 0,
    `★inline 은 세 조각이 ★가로로 ★안 겹쳐야 한다. 잰 값 ${JSON.stringify(i.pieces.map(p => [p.l, p.r]))}`).toBe(true);
  expect(e1).toEqual([]);

  const e2 = await setup(page, { layout: 'stack', text: '안녕' });
  const t = await axisOf(page);
  expect(t.pieces.length, '★전제 — 조각 셋이 다 있다(★부호가 한 쌍)').toBe(3);
  /* ★★주 단언 — ★축이 ★돌았다. ★★세 자가 ★다 ★align 과 ★무관해야 한다:
       ㉠ 격자 ★행 트랙 3 · ㉡ 세로 ★차례 · ㉢ 가로로 ★겹친다(inline 은 ★안 겹친다).
     ⛔「세 조각의 ★중심 x 가 하나」로만 재지 ★마라 — ★그건 ★1열이 아니라 ★«가운데 정렬»까지 재는 자다.
       2026-10-09 실측: `justify-items` 를 ★`start` 로 못박은 변이(M7)에서 ★그 자가 ★빨개졌는데
       ★축은 ★제대로 돌아 있었다 ⇒ ★이름(「1열」)과 ★잰 것이 ★어긋났다. ★그래서 ★아래로 갈랐다. */
  expect(t.gridRows, `★stack 격자 ★행 트랙 = 3. 잰 값 ${t.gridRows}`).toBe(3);
  expect(t.pieces.map(p => p.k), '★조각 차례').toEqual(['pre', 'line', 'post']);
  expect(t.pieces[0].cy < t.pieces[1].cy && t.pieces[1].cy < t.pieces[2].cy,
    `★★앞부호 → 글 → 뒤부호 가 ★위에서 아래로. 잰 값 ${JSON.stringify(t.pieces.map(p => p.cy))}`).toBe(true);
  const ov = (a, b2) => Math.min(a.r, b2.r) - Math.max(a.l, b2.l);
  expect(ov(t.pieces[0], t.pieces[1]) > 0 && ov(t.pieces[1], t.pieces[2]) > 0,
    `★★세 조각이 ★가로로 ★겹쳐야 한다(= ★한 열). 잰 값 ${JSON.stringify(t.pieces.map(p => [p.l, p.r]))}`).toBe(true);
  expect(t.rowsY.length, `★★stack 은 ★3행이어야 한다. 잰 값 ${JSON.stringify(t.rowsY)}`).toBe(3);
  /* ㉣ ★중심이 하나 — ★이것은 ★«기본값 align=center 에서만» 참이다 ⇒ ★전제를 ★먼저 단언한다. */
  const dsAlign = await page.evaluate(() => window.__qt.dataset.align);
  expect(dsAlign, '★전제 — 이 칸은 ★기본값(center)에서 잰다').toBe('center');
  expect(t.colsX.length, `★stack 은 ★한 열이다(center 에서 중심 x 가 하나). 잰 값 ${JSON.stringify(t.colsX)}`).toBe(1);
  /* ★★음성대조 — inline 과 ★같으면 ★안 돈 것이다 */
  expect(t.colsX.length === i.colsX.length && t.rowsY.length === i.rowsY.length,
    `★★stack 이 inline 과 ★같은 축이다(=안 돌았다). inline ${i.colsX.length}×${i.rowsY.length} · stack ${t.colsX.length}×${t.rowsY.length}`).toBe(false);
  expect(e2).toEqual([]);
});

test('Q10 ★⒜ 중앙정렬 — ★`align` 칸이 ★이미 한다(새 칸 ★안 만들었다) ＋ ★inline 음성대조', async ({ page }) => {
  /* ★★현빈 ⒜ 「에셋과 텍스트 간 ★중앙정렬 가능하게」 — ★1×3 이 되면 ★부호가 글 ★위아래에 오니
     ★«가로» 중앙이 뜻을 갖는다. ★지금 블럭의 `align`(left/center/right)이 ★그 일을 한다 ⇒ ⛔`valign` 을 ★안 들였다.
     ★세 값으로 ★몰아 본다 — ⛔`justify-items` 라는 ★글자를 읽어 「된다」고 적지 않는다. */
  const got = {};
  for (const align of ['left', 'center', 'right']) {
    const errs = await setup(page, { layout: 'stack', text: '안녕', align });
    got[align] = await axisOf(page);
    expect(errs).toEqual([]);
  }
  /* ★★비율로 잰다 — ⛔절대좌표 금지(위 axisOf 머리말: ★배율이 setup 마다 다르다).
     left → 세 조각의 ★왼쪽 모서리가 ★0 쪽에 모인다 · center → ★중심이 ★0.5 · right → ★오른쪽이 ★1. */
  const near = (a, b2, tol) => Math.abs(a - b2) <= tol;
  const spread = (v) => Math.max(...v) - Math.min(...v);

  const cR = got.center.pieces.map(p => rat(got.center, p, 'cx'));
  expect(spread(cR) <= 0.01, `★★center: 세 조각의 ★중심 비율이 ★같아야 한다. 잰 값 ${JSON.stringify(cR.map(v => +v.toFixed(3)))}`).toBe(true);
  expect(near(cR[0], 0.5, 0.02), `★그 중심이 ★블럭 한가운데(0.5)여야 한다. 잰 값 ${cR[0].toFixed(3)}`).toBe(true);

  /* left — ★왼쪽 ★모서리가 같다 (⛔중심으로 재면 폭 차이로 ★거짓 빨강이 난다) */
  const lR = got.left.pieces.map(p => rat(got.left, p, 'l'));
  expect(spread(lR) <= 0.01, `★★left: 왼쪽 모서리 비율이 ★같아야 한다. 잰 값 ${JSON.stringify(lR.map(v => +v.toFixed(3)))}`).toBe(true);
  expect(near(lR[0], 0, 0.02), `★그 모서리가 ★블럭 왼쪽(0)이어야 한다. 잰 값 ${lR[0].toFixed(3)}`).toBe(true);

  /* right — ★오른쪽 ★모서리가 같다 */
  const rR2 = got.right.pieces.map(p => rat(got.right, p, 'r'));
  expect(spread(rR2) <= 0.01, `★★right: 오른쪽 모서리 비율이 ★같아야 한다. 잰 값 ${JSON.stringify(rR2.map(v => +v.toFixed(3)))}`).toBe(true);
  expect(near(rR2[0], 1, 0.02), `★그 모서리가 ★블럭 오른쪽(1)이어야 한다. 잰 값 ${rR2[0].toFixed(3)}`).toBe(true);

  /* ★★셋이 ★서로 다른 자리다 — ★글의 ★중심 비율이 ★0 → 0.5 → 1 로 ★간다.
     ⛔「칸이 안 먹는다」를 ★이 한 줄이 잡는다(세 값이 같으면 spread 가 0 이 된다). */
  const lineRat = ['left', 'center', 'right'].map(a => rat(got[a], got[a].pieces[1], 'cx'));
  expect(spread(lineRat) >= 0.5,
    `★★align 세 값이 ★같은 자리를 낸다 = ★칸이 ★안 먹는다. 글 중심 비율 ${JSON.stringify(lineRat.map(v => +v.toFixed(3)))}`).toBe(true);

  /* ══ ★★⚰️2026-10-10 — ★inline 음성대조의 ★까닭이 ★죽었다 (⛔문장을 ★지우지 않는다) ════════
     ★옛 문장: 「★inline 에서는 ★부호가 ★안 움직인다(양 끝 칸에 붙어 있고 ★글만 민다)
                ⇒ ⒜ 는 ★stack 의 이야기지 ★inline 을 바꾸는 이야기가 ★아니다」
       ★단언 = `expect(spread(preRat) <= 0.01)`  (앞부호 왼쪽 모서리 비율이 ★align 셋에서 ★같다)
     ★그 까닭 = ★옛 inline 이 ★`auto minmax(0,1fr) auto` ＋ ★`justify-content` ★없음이라
       ★부호가 ★블럭 ★양 끝에 ★박혀 있었다.
     ★★그런데 ★그 «박혀 있음»이 ★현빈 1010t2c2 의 ★참 원인이었다 — ★부호가 끝에 박히면
       ★`column-gap` 이 ★가운데 칸만 좁혀 ★사람 눈의 거리에서 ★★약분된다(핀 f69c307e: 0.0px · Q16).
     ⇒ ★inline 을 ★`minmax(0,auto)` ＋ `justify-content:<align>` 으로 갈았다 ⇒ ★세 조각이 ★★같이 움직인다
       (실측 2026-10-10: 앞부호 왼쪽 비율 ★[0, 0.438, 0.878] — ★옛 단언이 ★여기서 빨개졌다).
     ★★살아남은 요구는 ★둘이고, ★그 둘을 ★아래가 ★다시 잰다:
       ㉠ ★글은 ★움직인다(align 이 ★죽지 않았다) — ★옛 단언 ★그대로 ★유지
       ㉡ ★★«세 조각이 ★한 덩이로» 움직인다 = ★부호가 ★글에 ★붙어 있다
          (⇒ ★그래서 ★간격 슬라이더가 ★뜻을 가진다 · ★이것이 ★새 음성대조다:
             ★부호만 혹은 ★글만 따로 튀면 ★여기서 빨강)

     ══ ★★⚰️ ★세 칸 (★지디 2026-10-10 요구 — ⛔「문」만 남기고 「까닭」을 잃지 않게) ════════
     ★★⒜ ★누가·언제 — ★판정 ★2026-10-10 ★지디(팀장) · ★근거 = ★현빈 ★`1010t2c2` ★원문
          「그리고 우측 패널에서 슬라이드를 움직여도 ★실제론 ★간격조절이 안되는 ★문제가 있어」
          ⇒ ★현빈이 ★★«문제»라 ★불렀고 ★그 말이 ★시안 메모보다 ★★더 ★새 말이다.
          ⇒ ★지디가 ★★현빈 노트 `p9909` 에 ★올렸다 — ★★그가 ★되돌릴 수 ★있게.
     ★★⒝ ★무엇을 ★놓았나(=★이름) — ★★시안 ⒟ 의 ★「★끈 쪽은 ★칸째 ★빠져 ★글이 ★그만큼 ★넓어진다」
          ⇒ ⛔★그 줄을 ★★«폐기된 선례»로 ★읽지 ★마라 — ★★«글이 ★더 ★쓸 수 있다»는 ★뜻은 ★★살아 있고
            ★★잴 ★자리만 ★옮겼다(★짧은 글 ⇒ ★긴 글). ★★되살릴 ★조건 = ★★현빈이 ★「칸이 ★전폭을 먹어야
            한다」를 ★★다시 ★말하면 — ★그때는 ★★간격 슬라이더를 ★★치워야 ★한다(★둘은 ★동시에 ★참이 ★못 된다).
     ★★⒞ ★되돌리는 ★법(=★자리) — ★★`js/blocks/quote-block.js` `renderQuoteBlock` inline 가지의 ★★두 줄:
          ① 가운데 칸 ★`minmax(0,auto)` → ★`minmax(0,1fr)`   ② ★`justify-content:${_qtSide(st.align)}` ★제거
          ⇒ ★그 둘을 ★되돌리면 ★★Q16 ★하나가 ★빨개지고 ★여기 ⚰️ ★둘을 ★옛 문장으로 ★되돌리면 된다.
          ⇒ ★★그 둘이 ★★«각각» ★지탱하는 자리는 ★양성대조 ★M17·M18 이 ★가렸다(spec 머리말의 그 표).
  */
  const inl = {};
  for (const align of ['left', 'center', 'right']) {
    await setup(page, { layout: 'inline', text: '안녕', align });
    inl[align] = await axisOf(page);
  }
  const preRat = ['left', 'center', 'right'].map(a => rat(inl[a], inl[a].pieces[0], 'l'));
  const lineRat2 = ['left', 'center', 'right'].map(a => rat(inl[a], inl[a].pieces[1], 'cx'));
  /* ㉠ 글은 움직인다 — ⚰️옛 판에서도 참이었고 ★그대로 둔다 */
  expect(spread(lineRat2) >= 0.5, `★inline 의 ★글은 ★움직여야 한다(안 움직이면 align 이 죽은 것). 잰 값 ${JSON.stringify(lineRat2.map(v => +v.toFixed(3)))}`).toBe(true);
  /* ㉡ ★새 음성대조 — ★부호도 ★같이 움직이고, ★그 움직인 ★양이 ★글과 ★같다(한 덩이) */
  expect(spread(preRat) >= 0.5,
    `★★inline 의 ★앞부호도 ★글과 ★같이 움직여야 한다(⚰️옛 판에서는 ★0 이었다 — ★그게 gap 을 죽인 꼴이다).`
    + ` 잰 값 ${JSON.stringify(preRat.map(v => +v.toFixed(3)))}`).toBe(true);
  /* ★★«한 덩이»의 자 — ★앞부호↔글 ★거리(비율)가 ★align 셋에서 ★같아야 한다.
     ⛔「둘 다 움직였다」로는 ★모자라다: ★서로 ★다른 양으로 움직이면 ★부호가 ★글에서 ★떨어진다. */
  /* ⚠️⛔★★이 시험의 ★★«마지막 ★진짜 화살표» ★뒤에 ★★진짜 `{` 를 ★두지 ★마라(블록 본문·객체 리터럴·for/if 블록).
     ★까닭 = ★`tools/assert-strength.mjs:199~203` 이 ★본문 시작을 ★«인자 안 ★마지막 화살표 뒤의 ★첫 `{`»로 잡는다
       ⇒ ★그 뒤에 ★블록이 ★하나라도 있으면 ★본문을 ★그 토막으로 읽어 ★★단언 수가 ★0 이 된다.
     ★★실측(2026-10-10 · ★내가 ★두 번 틀렸다 — ★추정 대신 ★`--census` 로 재서 알았다):
       이 칸이 ★「단언 수 ★10→0 · 세기 합 ★40→0」으로 ★그 게이트에 ★빨강이 떴다.
       ⇒ ★제자리에서 ★약해진 것이 ★아니라 ★★«내 코드 꼴»이 ★자를 ★속인 것이다.
       ⚠️틀린 추정 ⑴ 「`.map(a => { … })` 블록 화살표」 — ★for 로 펴도 ★그대로 빨강이었다.
       ⚠️틀린 추정 ⑵ 「메시지 속 `${…}` 의 `{`」 — ★이어붙이기로 바꿔도 ★그대로였다
         (★문자열·템플릿 ★속은 ★그 자가 ★이미 ★blank 로 지운다 ⇒ ★`${}` 는 ★무해하다. ★Q16 이 19 로 세어진 것이 ★그 증거다).
       ✅★참 원인 = ★★«마지막 화살표 뒤의 ★`for (…) {`» ★하나였다.
     ⇒ ★그래서 ★여기를 ★★블록 없는 ★식 화살표로 ★편다. ⛔다음 사람도 ★이 시험 ★끝에 ★블록을 ★붙이지 마라. */
  const gapRat = ['left', 'center', 'right'].map(a => Math.round(((inl[a].pieces[1].l - inl[a].pieces[0].r) / inl[a].box.w) * 10000) / 10000);
  expect(spread(gapRat) <= 0.01,
    `★★부호와 글 사이 ★거리가 ★align 셋에서 ★같아야 한다(= ★한 덩이로 움직인다). 잰 값 ${JSON.stringify(gapRat)}`).toBe(true);
});


/* ══════ 2026-10-09 현빈 ⒝ — 「에셋에 ★프리셋이 있는데 ★별도로 ★사용자가 추가 가능하게」 ══════
   ★저장 자리 = `DesignSystem` 의 ★`quoteShapes`(정본 `meta.quoteShapes` · 작업 캐시 localStorage) —
   ★`textStyleHistory` 와 ★같은 자리·★같은 길이다(⛔새 저장 기계를 안 만들었다).
   ⛔`colorVars` 꼴은 ★안 베꼈다 — 그쪽은 「meta 에 없으면 ★직전 프로젝트 것이 남는다」는
     ★결함을 `design-system.js` 가 ★스스로 적어 뒀다. ★Q13 이 ★그 병이 ★안 옮았음을 잰다. */

/** 가짜 Electron meta 저장소 — C6(text-style-recent) 의 그 꼴 그대로. */
const fakeMeta = (page, pid) => page.evaluate((p) => {
  window.activeProjectId = p;
  window.__metaStore = {};
  window.electronAPI = {
    loadProjectMeta: async () => window.__metaStore,
    saveProjectMeta: async (_pid, patch) => { Object.assign(window.__metaStore, patch); return true; },
  };
}, pid);
const clearShapeCache = (page) => page.evaluate(() => {
  try { localStorage.removeItem('we_quote_shapes_v1'); } catch (_) {}
});

test('Q11 ★사용자 부호 더하기 — ★한 명부에 들고 ★블럭에 입히면 ★그 글자가 그려진다', async ({ page }) => {
  const errs = await setup(page, { text: '안녕' });
  const before = await page.evaluate(() => ({
    all: window.quoteShapesAll().length,
    user: window.quoteUserShapes().length,
  }));
  expect(before.user, '★전제 — 시작은 사용자 부호 0건이어야 한다').toBe(0);

  const m = await page.evaluate(() => {
    const list = window.DesignSystem.addQuoteShape({ pre: '<<', post: '>>' });
    const all = window.quoteShapesAll();
    const made = all.find(s => s.key === list[0].key);
    /* ★블럭에 입혀 ★그려 본다 — ⛔명부에 들었다는 것만으로 ★닫지 않는다 */
    window.__qt.dataset.shape = made.key;
    window.renderQuoteBlock(window.__qt);
    const marks = [...window.__qt.querySelectorAll('[data-qt-mark]')].map(e => e.textContent);
    return {
      userN: window.quoteUserShapes().length, allN: all.length,
      key: made.key, label: made.label, user: made.user === true,
      marks,
      /* ★제품 8종이 ★앞이고 ★사용자 것이 ★뒤 */
      tail: all[all.length - 1].key,
      builtinsIntact: window.QUOTE_SHAPE_KEYS.every((k, i) => all[i].key === k),
    };
  });
  console.log('  Q11:', JSON.stringify(m));
  expect(m.userN, '★사용자 부호 1건').toBe(1);
  expect(m.allN, `★한 명부 = 제품 ${before.all} ＋ 1`).toBe(before.all + 1);
  expect(m.key.startsWith('u_'), `★키는 ★u_ 접두여야 한다(제품 8종과 ★안 겹치게). 잰 값 ${m.key}`).toBe(true);
  expect(m.builtinsIntact, '★제품 8종이 ★앞 차례 그대로').toBe(true);
  expect(m.tail, '★사용자 것이 ★뒤에 붙는다').toBe(m.key);
  expect(m.label, `★label 은 ★짓는다(pre + ' ' + post). 잰 값 ${JSON.stringify(m.label)}`).toBe('<< >>');
  expect(m.user, '★사용자 것이라는 표가 선다(패널이 ×를 달 자리)').toBe(true);
  /* ★★주 단언 — ★그려진 글자가 ★내가 더한 그것이다 */
  expect(m.marks, `★★그려진 부호가 내가 더한 것이어야 한다. 잰 값 ${JSON.stringify(m.marks)}`).toEqual(['<<', '>>']);
  expect(errs).toEqual([]);
});

test('Q12 ★★저장 왕복 — ★meta 에 실리고 ★캐시를 비워도 ★다시 열면 산다 (⛔localStorage 단독이면 빨강)', async ({ page }) => {
  /* ★★이 칸이 ★«왜 localStorage 단독을 안 쓰나»를 ★잠근다 — 그 까닭은 ★「앱 닫고 열면 사라진다」다.
     ★C6(text-style-recent) 와 ★같은 꼴: ⒜ meta 에 실렸나 ⒝ ★캐시를 비우고 ★전제 단언 ⒞ meta 에서만 복원.
   * ★★⚠️이 칸은 ★«한 환경에서만» 참일 수 있다 — ★여기서는 `window.electronAPI` 를 ★가짜로 ★덮는다.
   *   ★실앱에서는 ★그 자리가 ★★frozen 이다(2026-10-09 실측: `Object.isFrozen(window.electronAPI) === true` ·
   *   `writable:false, configurable:false` ⇒ ★대입이 ★조용히 ★안 먹는다). ⇒ ★이 하네스의 초록만으로는 ★못 닫는다.
   * ★★그래서 ★실기로 ★메웠다(2026-10-09 · CDP 9432 · 진짜 마우스·키 · ★가짜 없이 ★진짜 IPC 로):
   *   「＋」→ `<< >>` 입력 → 「더하기」 ⇒ 단추 8→9 · 블럭에 `<<`/`>>` 가 ★그려졌고,
   *   ★디스크의 `…/projects/p-live/proj_meta.json`(1,683B)에 ★`quoteShapes` 가 ★실렸다.
   *   ★그 파일의 ★기존 칸 ★일곱(name·type·createdAt·updatedAt·marketRef·listMetaV·thumbnail)이 ★그대로였다
   *   ⇒ ★`_mergeProjectMeta` 의 ★patch-only 가 ★실제로 돈다(남의 필드를 ★안 덮었다).
   *   그 뒤 ★캐시를 비우고 `restoreQuoteShapesFromMeta` ⇒ ★되살아났다. */
  const errs = await setup(page);
  await fakeMeta(page, 'p-q12');
  await page.evaluate(() => window.DesignSystem.addQuoteShape({ pre: '◆', post: '◆' }));
  await page.waitForTimeout(120);

  const saved = await page.evaluate(() => window.__metaStore.quoteShapes || null);
  expect(Array.isArray(saved) && saved.length, '★저장본(meta)에 ★안 실렸다 — localStorage 단독이면 여기서 죽는다').toBeTruthy();
  expect(saved[0].pre, '★meta 에 실린 그 부호').toBe('◆');

  const after = await page.evaluate(async () => {
    try { localStorage.removeItem('we_quote_shapes_v1'); } catch (_) {}
    const emptied = window.quoteUserShapes().length;
    await window.DesignSystem.restoreQuoteShapesFromMeta('p-q12');
    return { emptied, restored: window.quoteUserShapes().map(r => r.pre + r.post) };
  });
  console.log('  Q12:', JSON.stringify(after));
  expect(after.emptied, '★전제 — 캐시를 비웠는데 ★안 비었다').toBe(0);
  expect(after.restored, '★★다시 열었더니 ★사용자 부호가 ★사라졌다').toEqual(['◆◆']);
  expect(errs).toEqual([]);
});

test('Q13 ★★음성대조 셋 — ⛔제품 8종은 못 지운다 · ⛔meta 없으면 ★빈 목록 · ★잃는 자리를 ★이름으로 적는다', async ({ page }) => {
  const errs = await setup(page);
  await fakeMeta(page, 'p-q13');

  /* ㉠ ★제품 8종은 ★못 지운다 — `removeQuoteShape` 에 제품 키를 줘도 ★명부가 안 줄어든다 */
  const guard = await page.evaluate(() => {
    const before = window.quoteShapesAll().length;
    window.DesignSystem.removeQuoteShape('curly');
    window.DesignSystem.removeQuoteShape('slash');
    return { before, after: window.quoteShapesAll().length, keys: window.QUOTE_SHAPE_KEYS.length };
  });
  expect(guard.after, `★★제품 부호가 ★지워졌다. ${guard.before} → ${guard.after}`).toBe(guard.before);

  /* ㉡ ★meta 에 ★없으면 ★빈 목록 — ⛔`colorVars` 가 앓는 「직전 프로젝트 것이 남는다」를 ★안 물려받는다 */
  const carry = await page.evaluate(async () => {
    window.DesignSystem.addQuoteShape({ pre: '※', post: '※' });      // p-q13 의 부호
    const mine = window.quoteUserShapes().length;
    window.__metaStore = {};                                          // ★다른 프로젝트 = meta 에 quoteShapes 가 없다
    await window.DesignSystem.restoreQuoteShapesFromMeta('p-other');
    return { mine, afterOpenOther: window.quoteUserShapes().map(r => r.pre) };
  });
  expect(carry.mine, '★전제 — 내 프로젝트엔 1건이 있었다').toBe(1);
  expect(carry.afterOpenOther, '★★다른 프로젝트를 열었는데 ★앞 프로젝트 부호가 ★남았다').toEqual([]);

  /* ㉢ ★★잃는 자리 — ★사용자 부호를 쓰던 블럭을 ★그 부호가 ★없는 판에서 열면 ★기본값으로 떨어진다.
        ⛔이건 ★「고쳤다」가 아니라 ★「재서 적었다」다. ★v1 의 ★알려진 한계이고 ★여기가 그 이름이다.
        ★고치려면 ★블럭이 ★제 글자를 ★자기 dataset 에 들고 있어야 한다(= ★새 키 둘) — ★지디 판정 대기. */
  const lost = await page.evaluate(async () => {
    const list = window.DesignSystem.addQuoteShape({ pre: '◀', post: '▶' });
    window.__qt.dataset.shape = list[0].key;
    window.renderQuoteBlock(window.__qt);
    const withShape = [...window.__qt.querySelectorAll('[data-qt-mark]')].map(e => e.textContent);
    window.__metaStore = {};                                          // ★부호를 잃은 판
    await window.DesignSystem.restoreQuoteShapesFromMeta('p-lost');
    window.renderQuoteBlock(window.__qt);
    return {
      withShape,
      afterLoss: [...window.__qt.querySelectorAll('[data-qt-mark]')].map(e => e.textContent),
      keyStillOnBlock: window.__qt.dataset.shape,
      fallback: [window.QUOTE_SHAPES[0].pre, window.QUOTE_SHAPES[0].post],
    };
  });
  console.log('  Q13 ㉢ 잃는 자리:', JSON.stringify(lost));
  expect(lost.withShape, '★전제 — 더한 부호가 그려지고 있었다').toEqual(['◀', '▶']);
  expect(lost.keyStillOnBlock.startsWith('u_'), '★블럭은 ★제 키를 ★그대로 들고 있다(데이터는 안 날아갔다)').toBe(true);
  expect(lost.afterLoss, `★★부호를 잃으면 ★기본값으로 떨어진다 — ★v1 의 ★알려진 한계. 잰 값 ${JSON.stringify(lost.afterLoss)}`)
    .toEqual(lost.fallback);
  expect(errs).toEqual([]);
});

/* ══════ 2026-10-09 현빈 ④ — 「★quote 블럭 ★SVG 높이(y값) ★슬라이드로 우측에서 조절
          ＋ 텍스트와 ★수직·수평 정렬」 (티켓 `1009t2-④` · 레인 gd/cpnpreset) ═════════
 *
 * ★★이 티켓은 ★«두 조각»이고 ★둘이 ★다른 결함이다 — ★Q14 가 ⒜, ★Q15 가 ⒝ 다.
 *   ⇒ ★커밋도 ★갈랐다(⒜ `d5b967eb` · ⒝ 는 ★이 커밋) — ★⒜ 하나만으로도 요구 하나가 닫힌다.
 *
 * ══ ★⒜ ★«수평(가로) 정렬» = ★모델은 ★돈다 · ★★패널에 ★칸이 ★없다 ═════════════
 *   ★★이 자리를 ★한 번 ★잘못 닫았다 — `prop-quote.js` 의 `align` 8건이 ★전부
 *     ★CSS 클래스명(`prop-align-btn` 1 · `prop-align-group` 3 ＋ 주석 4)이고 ★그것은
 *     ★«모양 단추 줄»의 클래스지 ★정렬과 ★무관하다. ⇒ ★낱말로 닫으면 ★「이미 있다」가 된다.
 *   ★★그래서 ★«행위로» 쟀다(핀 `a3556b936f8f` · `_probe-qt4-y` P2 · 패널을 ★진짜 클릭으로 열고
 *     ★조종칸 ★전수 명부를 떴다 · 2026-10-09):
 *       `[data-al]` **0** · `[data-align]` **0** · `[data-qt-align],#qt-align-group` **0**
 *       `.prop-label` 전수 = ★[모양 · 부호 크기 · 부호 색 · 간격 · 꼴 · 부호 켜기 · 내용 ·
 *                             글자 크기 · 글자 색] ⇒ ★★「정렬」이 ★없다
 *       `input[type=range]` 전수 = [qt-marksize · qt-gap · qt-fontsize] ⇒ ★y 칸도 ★없다
 *   ★모델은 ★이미 돈다 — ★그 자리를 ★Q10 이 ★벌써 잠갔다(stack·inline 둘 다 · 비율 자).
 *     ★내 손으로 ★다시 쟀다(P1 · `dataset.align` 을 손으로): ★inline 글줄 비율 ★0 / 0.5 / 1
 *     ⚠️그리고 ★자의 ★한계를 ★같이 쟀다 — ★stack 에서는 ★글덩이가 ★제 폭으로 줄어 ★`slack=0`
 *       ⇒ ★«글줄이 제 칸 안에서 어디냐» 자가 ★null 을 낸다. ★stack 은 ★블럭 폭 대비 ★비율(`rat`)로 재야 한다.
 *   ⇒ ★★Q14 가 ★재는 것은 ★«모델»이 아니라 ★★«패널에 그 칸이 서서 ★사람이 ★눌러 ★모델에 닿는가»다.
 *
 * ══ ★⒝ ★«SVG 높이(y값)» — ★★이 블럭에 ★SVG 는 ★0건이다 ══════════════════════
 *   ★★현빈이 ★「SVG」라 부른 것은 ★★«부호 글리프»다. ★실측(P3 · 핀):
 *       블럭 안 `svg` **0** · `img` **0** · 부호 = ★`SPAN` · textContent `“`
 *       `transform: none` · `position: static` · `top: auto` · `vertical-align: baseline`
 *     ⇒ ★v1 이 ★부호를 ★«글꼴 글리프»로 ★일부러 고른 것이다(`quote-block.js` 머리말
 *        「★v1 부호 = 글꼴 글리프 8종만 (⛔SVG·이미지 아니다)」 — 까닭은 ★피그마 내보내기).
 *     ⇒ ⛔「SVG 가 없으니 못 한다」로 ★닫지 않는다. ★y 를 ★움직일 자리는 ★있다.
 *   ★★어느 자가 ★무엇을 움직이나 — ★★«축이 도니까» ★따로 쟀다(P4 · 핀 · inline·stack 둘 다):
 *     ┌ 자 ────────────────┬ inline ─────────────┬ stack ──────────────────────┐
 *     │ 격자 `align-items` │ ★먹는다 (−26.5/0/+26.5) │ ★★전부 −76.6 = ★★안 움직인다 │
 *     │ 부호 `translateY`  │ ★먹는다 (±17.4)      │ ★먹는다 (±18.7)              │
 *     └────────────────────┴─────────────────────┴──────────────────────────────┘
 *     ⇒ ★`vAlign`(세로 정렬)은 ★★inline ★에서만 뜻이 있다 — ★stack 은 ★1열×3행이라
 *       ★세로가 ★«차례»(앞부호/글/뒤부호)로 ★이미 정해져 ★밀 ★틈(slack)이 ★없다.
 *       ⇒ ★★패널도 ★그대로 — ★stack 에서는 ★그 줄을 ★내지 않고 ★까닭을 ★글로 적는다.
 *       ⛔「칸은 있는데 눌러도 ★조용히 아무 일 없음」을 ★만들지 않는다.
 *     ⇒ ★`markDy`(부호 y)는 ★★두 꼴 ★모두에서 먹는다 ⇒ ★★항상 ★낸다. ★이것이 현빈의 「y값 슬라이드」다.
 *   ⚠️★★절대 px 로 ★재지 마라 — ★이 하네스는 ★setup 마다 ★섹션 배율이 달라(위 `axisOf` 머리말:
 *     블럭 폭 344/796/835) ★`translateY(20px)` 이 ★화면에선 ★17.4px 로 왔다. ⇒ ★판정은
 *     ㉠ ★`getComputedStyle(…).transform` 의 ★행렬(그 요소 ★자신의 CSS px · ★조상 배율과 무관)
 *     ㉡ ★방향·단조성(내려갔나) ★둘로. ⛔화면 px 의 ★절대값을 ★기대값으로 박지 마라.
 *
 * ══ ★양성대조 = ★변이표 (★새 기능은 「없어서 빨강」이라 ★약하다) ═══════════════
 *   ★M12 `prop-quote.js` 의 ★정렬 줄(`qt-align-group`)을 ★뺀다          ⇒ ★Q14 빨강 기대
 *   ★M13 정렬 단추 배선(`[data-al]` 핸들러)만 ★뺀다(줄은 ★남긴다)       ⇒ ★Q14 ★주 단언만 빨강 기대
 *        ★★이것이 ★진짜 양성대조다 — ★칸이 ★서 있는데 ★안 닿는 자리를 ★잡나
 *   ★M14 `_markEl` 의 `translateY` 를 ★뺀다                             ⇒ ★Q15 빨강 기대
 *   ★M15 `vAlign` 을 `'middle'` 상수로 ★고정(칸은 ★남긴다)              ⇒ ★Q15 ★세로 단언만 빨강 기대
 *   ★N2(음성대조) `prop-quote.js` ★주석 한 줄을 고친다(무해)             ⇒ ★전부 초록 기대
 * ══════════════════════════════════════════════════════════════════════════ */

/** 패널 조종칸 ★전수 명부 — ⛔「없다」를 ★낱말로 세지 않는다(위 머리말의 그 까닭). */
const panelCensus = (page) => page.evaluate(() => {
  const p = document.getElementById('panel-right') || document.body;
  return {
    alignGroup: p.querySelectorAll('#qt-align-group').length,
    alignBtns: [...p.querySelectorAll('#qt-align-group [data-al]')].map(e => e.getAttribute('data-al')),
    valignGroup: p.querySelectorAll('#qt-valign-group').length,
    valignBtns: [...p.querySelectorAll('#qt-valign-group [data-qv]')].map(e => e.getAttribute('data-qv')),
    markDySlider: p.querySelectorAll('#qt-markdy-slider').length,
    markDyNumber: p.querySelectorAll('#qt-markdy-number').length,
    labels: [...p.querySelectorAll('.prop-label')].map(e => e.textContent.trim()),
    sliders: [...p.querySelectorAll('input[type=range]')].map(e => e.id),
  };
});

/** 부호·글의 ★세로 자리 ＋ ★부호가 ★제 CSS 로 ★얼마나 밀렸나(★배율과 무관한 자). */
const vOf = (page) => page.evaluate(() => {
  const b = window.__qt;
  const pre = b.querySelector('[data-qt-mark="pre"]');
  const body = b.querySelector('.tb-qt-body');
  const R = (e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; };
  const h = b.getBoundingClientRect().height || 1;
  /* ★`matrix(a,b,c,d,tx,ty)` 의 ★ty — ★그 요소 ★자신의 CSS px 다(조상 scale 과 ★무관). */
  const m = getComputedStyle(pre).transform;
  const ty = m && m !== 'none' ? Number(m.replace(/^matrix\(|\)$/g, '').split(',')[5]) : 0;
  return {
    cssTy: Number.isFinite(ty) ? ty : 0,
    markDy: b.dataset.markDy ?? '(없다)',
    vAlign: b.dataset.vAlign ?? '(없다)',
    blockAlignItems: getComputedStyle(b).alignItems,
    /* ★비율 — ★블럭 높이에 대한 ★부호/글 중심. ⛔절대 px 금지(배율이 setup 마다 다르다). */
    markRat: (R(pre) - b.getBoundingClientRect().top) / h,
    bodyRat: (R(body) - b.getBoundingClientRect().top) / h,
  };
});

/* ── Q14 ★⒜ ★패널에 «수평 정렬» 칸이 ★서고 ★눌러서 ★모델에 닿는다 ───────────── */
test('Q14 ★★⒜ 패널 «정렬» 칸 — ★서 있고(명부) ★닿고(자 ㉢) ★눌러서 ★모델을 움직인다(inline·stack)', async ({ page }) => {
  const errs = await setup(page, { text: '안녕' });
  await openPanel(page);

  /* ★★전제 ★셋 — ⛔이것부터 세운다(「패널이 안 열렸다」를 「칸이 없다」로 읽지 않게). */
  const pre0 = await page.evaluate(() => ({
    panel: !!document.getElementById('qt-shape-group'),
    align: window.__qt.dataset.align,
    type: window.__qt.dataset.type,
  }));
  expect(pre0.panel, '★전제: ★인용구 패널이 열렸다(qt-shape-group)').toBe(true);
  expect(pre0.type, '★전제: 이 블럭은 quote 다').toBe('quote');
  expect(pre0.align, '★전제: ★기본 정렬 = center (모델이 그 칸을 ★이미 갖고 있다)').toBe('center');

  /* ㉠ ★명부 — ★칸이 ★서 있나. ⛔낱말 grep 이 아니라 ★조종칸 전수다. */
  const c = await panelCensus(page);
  expect(c.alignGroup, `★★«정렬» 줄(#qt-align-group)이 ★패널에 ★있어야 한다.\n` +
    `  ⚰️핀 a3556b936f8f 실측 = ★0 (그래서 이 검사가 생겼다)\n` +
    `  잰 조종칸 명부: 라벨 ${JSON.stringify(c.labels)} · 슬라이더 ${JSON.stringify(c.sliders)}`).toBe(1);
  expect(c.alignBtns, '★단추 ★셋 = left/center/right ★그 순서').toEqual(['left', 'center', 'right']);
  expect(c.labels.includes('정렬'), `★사람이 읽는 라벨 「정렬」이 있어야 한다. 잰 명부 ${JSON.stringify(c.labels)}`).toBe(true);

  /* ㉡ ★자 ㉢ «닿나» — Q6 과 ★같은 자(기하 ＋ elementFromPoint). ⛔「있다」≠「닿는다」 */
  const reach = await page.evaluate(() => {
    const g = document.getElementById('qt-align-group');
    const row = g.closest('.prop-row');
    const rowR = row.getBoundingClientRect();
    return [...g.querySelectorAll('[data-al]')].map(btn => {
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        al: btn.getAttribute('data-al'),
        over: Math.max(0, Math.round(r.right - rowR.right)),
        reached: !!(hit && (hit === btn || btn.contains(hit) || hit.closest('[data-al]') === btn)),
        w: Math.round(r.width), h: Math.round(r.height),
      };
    });
  });
  for (const r of reach) {
    expect(r.over, `★단추 ${r.al} 가 줄 오른끝을 ★${r.over}px 넘쳤다 — ★잘려서 ★안 눌린다`).toBe(0);
    expect(r.reached, `★단추 ${r.al} 의 ★가운데를 ★elementFromPoint 가 ★그 단추로 ★안 돌려줬다 ⇒ ★안 눌린다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
    expect(r.w > 0 && r.h > 0, `★단추 ${r.al} 의 ★면적이 ★0 이다(${r.w}×${r.h}) — ★규칙이 아니라 ★면적 문제다`).toBe(true);
  }

  /* ㉢ ★★«불리나 ＋ 맞는 갈래인가» — ★진짜 클릭으로. ★inline·stack ★둘 다. */
  for (const layout of ['inline', 'stack']) {
    await setup(page, { layout, text: '안녕' });
    await openPanel(page);
    const seen = {};
    for (const al of ['right', 'left', 'center']) {     /* ⛔기본값 center 를 ★먼저 누르지 않는다(안 움직여도 통과한다) */
      const r = await page.evaluate((a) => {
        const btn = document.querySelector(`#qt-align-group [data-al="${a}"]`);
        const b = btn.getBoundingClientRect();
        return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 };
      }, al);
      await clickAt(page, r.cx, r.cy, { sel: '[data-al]' }, { label: `Q14 정렬 ${al}(${layout})` });
      const a = await axisOf(page);
      seen[al] = { ds: await page.evaluate(() => window.__qt.dataset.align), lineRat: rat(a, a.pieces.find(p => p.k === 'line'), 'cx') };
    }
    for (const al of ['left', 'center', 'right']) {
      expect(seen[al].ds, `★[${layout}] ★단추 ${al} 를 ★눌렀는데 ★모델(dataset.align)이 ★안 바뀌었다 — ★칸은 섰는데 ★배선이 없다. 잰 값 ${seen[al].ds}`).toBe(al);
    }
    /* ★★그려지기까지 갔나 — ★세 자리가 ★서로 다르다(⛔모델만 바뀌고 렌더가 안 따라오면 여기서 빨강). */
    const v = ['left', 'center', 'right'].map(a2 => seen[a2].lineRat);
    expect(Math.max(...v) - Math.min(...v) >= 0.3,
      `★[${layout}] ★세 값이 ★같은 자리를 낸다 = ★눌러도 ★안 그려진다. 글 중심 비율 ${JSON.stringify(v.map(x => +x.toFixed(3)))}`).toBe(true);
    expect(v[0] < v[1] && v[1] < v[2],
      `★[${layout}] ★왼→가운데→오른 ★순서가 ★단조로워야 한다(갈래가 ★섞였다). 잰 값 ${JSON.stringify(v.map(x => +x.toFixed(3)))}`).toBe(true);
  }

  /* ㉣ ★active 가 ★모델을 비춘다 — ★다시 열어도(reopen) ★하나만 켜져 있다. */
  const act = await page.evaluate(() => {
    window.showQuoteProperties(window.__qt);
    const on = [...document.querySelectorAll('#qt-align-group [data-al]')].filter(b => b.classList.contains('active'));
    return { n: on.length, which: on.map(b => b.getAttribute('data-al')), ds: window.__qt.dataset.align };
  });
  expect(act.n, `★active 는 ★정확히 ★하나여야 한다. 잰 값 ${JSON.stringify(act)}`).toBe(1);
  expect(act.which[0], '★켜진 단추가 ★모델과 ★같아야 한다').toBe(act.ds);

  /* ★★음성대조 — ★모양 단추를 눌러도 ★정렬은 ★안 바뀐다(두 줄이 ★같은 클래스를 쓴다). */
  const neg = await page.evaluate(() => {
    const before = window.__qt.dataset.align;
    document.querySelector('#qt-shape-group [data-qt-shape="slash"]').click();
    return { before, after: window.__qt.dataset.align, shape: window.__qt.dataset.shape };
  });
  expect(neg.shape, '★음성대조 전제: 모양 단추는 ★제 일을 했다').toBe('slash');
  expect(neg.after, `★★모양 단추가 ★정렬을 ★건드렸다(${neg.before} → ${neg.after}) — ★`
    + `prop-align-btn 은 ★정렬 전용 클래스가 ★아니다`).toBe(neg.before);

  expect(errs).toEqual([]);
});

/* ── Q15 ★⒝ ★부호 y 슬라이더 ＋ ★수직 정렬 ───────────────────────────────────── */
test('Q15 ★★⒝ 부호 ★y 슬라이더(두 꼴 ★모두) ＋ ★세로 정렬(★inline · ★stack 은 ★칸째 없다)', async ({ page }) => {
  const errs = await setup(page, { text: '안녕' });
  await openPanel(page);

  /* ★★전제 — ⒝ 의 「SVG」는 ★글자다. ★그 사실을 ★검사가 ★들고 있어야 한다. */
  const pre0 = await page.evaluate(() => {
    const b = window.__qt;
    const pre = b.querySelector('[data-qt-mark="pre"]');
    return { svg: b.querySelectorAll('svg').length, img: b.querySelectorAll('img').length, tag: pre.tagName, txt: pre.textContent };
  });
  expect(pre0.svg, '★전제: ★이 블럭에 ★SVG 는 ★0건이다(현빈이 「SVG」라 부른 것 = ★글리프)').toBe(0);
  expect(pre0.img, '★전제: 이미지도 ★0건').toBe(0);
  expect(pre0.tag, '★전제: 부호는 ★SPAN(글자)이다').toBe('SPAN');

  /* ㉠ ★명부 — ★y 슬라이더가 ★«쌍»으로 서 있나(`_pairRow` 꼴). */
  const c = await panelCensus(page);
  expect(c.markDySlider, `★★부호 ★y 슬라이더(#qt-markdy-slider)가 ★있어야 한다.\n` +
    `  ⚰️핀 a3556b936f8f 실측 = ★0 · 그때 슬라이더 전수 = [qt-marksize · qt-gap · qt-fontsize]\n` +
    `  지금 잰 슬라이더 명부: ${JSON.stringify(c.sliders)}`).toBe(1);
  expect(c.markDyNumber, '★숫자칸도 ★같이 있어야 한다(이 패널의 ★슬라이더＋숫자 «쌍» 관례)').toBe(1);

  /* ㉡ ★★슬라이더를 ★움직이면 ★부호가 ★내려간다 — ★inline·stack ★둘 다(P4 실측대로). */
  for (const layout of ['inline', 'stack']) {
    await setup(page, { layout, text: '안녕' });
    await openPanel(page);
    const got = {};
    for (const val of [-30, 0, 30]) {
      got[val] = await page.evaluate((v) => {
        const s = document.getElementById('qt-markdy-slider');
        s.value = String(v);
        s.dispatchEvent(new Event('input', { bubbles: true }));   /* ★슬라이더의 ★진짜 경로 */
        return null;
      }, val).then(() => vOf(page));
      const n = await page.evaluate(() => document.getElementById('qt-markdy-number').value);
      expect(Number(n), `★[${layout}] ★숫자칸이 ★슬라이더를 ★따라와야 한다(«쌍»). 잰 값 ${n}`).toBe(val);
    }
    for (const val of [-30, 0, 30]) {
      expect(got[val].markDy, `★[${layout}] ★모델(dataset.markDy)에 ★안 써졌다. 잰 값 ${got[val].markDy}`).toBe(String(val));
      /* ★★배율과 ★무관한 자 — ★그 요소 ★자신의 CSS px. ⛔화면 px 절대값 금지. */
      expect(got[val].cssTy, `★[${layout}] ★부호의 ★제 CSS 이동(translateY)이 ★${val}px 이어야 한다. 잰 값 ${got[val].cssTy}`).toBe(val);
    }
    /* ★방향·단조 — ★실제로 ★내려가나(⛔CSS 만 보고 닫지 않는다). */
    expect(got[-30].markRat < got[0].markRat && got[0].markRat < got[30].markRat,
      `★[${layout}] ★y 를 키우면 ★부호가 ★아래로 ★내려가야 한다. 잰 비율 ` +
      `${JSON.stringify([got[-30].markRat, got[0].markRat, got[30].markRat].map(x => +x.toFixed(3)))}`).toBe(true);
    /* ★★음성대조 — ★글은 ★안 움직인다(부호 ★만 미는 칸이다). */
    const bodyMove = Math.max(got[-30].bodyRat, got[0].bodyRat, got[30].bodyRat)
                   - Math.min(got[-30].bodyRat, got[0].bodyRat, got[30].bodyRat);
    expect(bodyMove <= 0.02, `★[${layout}] ★y 칸이 ★글까지 움직였다 — ★부호 ★만 밀어야 한다. 글 중심 비율 폭 ${bodyMove.toFixed(3)}`).toBe(true);
  }

  /* ㉢ ★★세로 정렬 — ★inline 에서 ★칸이 서고 ★부호가 ★위/가운데/아래로 간다. */
  await setup(page, { layout: 'inline', text: '안녕' });
  await openPanel(page);
  const ci = await panelCensus(page);
  expect(ci.valignGroup, `★★inline 에서 ★«세로 정렬» 줄(#qt-valign-group)이 ★있어야 한다.\n` +
    `  ⚰️핀 실측 = ★0 · 그때 라벨 전수 = [모양·부호 크기·부호 색·간격·꼴·부호 켜기·내용·글자 크기·글자 색]\n` +
    `  지금 잰 라벨: ${JSON.stringify(ci.labels)}`).toBe(1);
  expect(ci.valignBtns, '★단추 ★셋 = top/middle/bottom ★그 순서').toEqual(['top', 'middle', 'bottom']);

  const vseen = {};
  for (const qv of ['top', 'bottom', 'middle']) {   /* ⛔기본값 middle 을 ★먼저 누르지 않는다 */
    const r = await page.evaluate((k) => {
      const b2 = document.querySelector(`#qt-valign-group [data-qv="${k}"]`).getBoundingClientRect();
      return { cx: b2.left + b2.width / 2, cy: b2.top + b2.height / 2 };
    }, qv);
    await clickAt(page, r.cx, r.cy, { sel: '[data-qv]' }, { label: `Q15 세로정렬 ${qv}` });
    vseen[qv] = await vOf(page);
  }
  for (const qv of ['top', 'middle', 'bottom']) {
    expect(vseen[qv].vAlign, `★단추 ${qv} 를 ★눌렀는데 ★모델(dataset.vAlign)이 ★안 바뀌었다. 잰 값 ${vseen[qv].vAlign}`).toBe(qv);
  }
  /* ★부호가 ★위 → 가운데 → 아래 ★순서로 ★내려간다(★글 세 줄이라 ★틈이 있다). */
  await setup(page, { layout: 'inline', text: '한 줄\n두 줄\n세 줄' });
  await openPanel(page);
  const vr = {};
  for (const qv of ['top', 'middle', 'bottom']) {
    await page.evaluate((k) => document.querySelector(`#qt-valign-group [data-qv="${k}"]`).click(), qv);
    vr[qv] = await vOf(page);
  }
  const vv = [vr.top.markRat, vr.middle.markRat, vr.bottom.markRat];
  expect(vv[0] < vv[1] && vv[1] < vv[2],
    `★세로 정렬 ★세 값이 ★위→가운데→아래로 ★가야 한다. 잰 부호 비율 ${JSON.stringify(vv.map(x => +x.toFixed(3)))}`).toBe(true);
  expect(Math.max(...vv) - Math.min(...vv) >= 0.3,
    `★세 값이 ★같은 자리다 = ★세로 칸이 ★안 먹는다. 잰 값 ${JSON.stringify(vv.map(x => +x.toFixed(3)))}`).toBe(true);
  expect(vr.top.blockAlignItems, '★inline 격자의 align-items 가 ★start 로 가야 한다').toBe('start');
  expect(vr.bottom.blockAlignItems, '★… end 로').toBe('end');

  /* ㉣ ★★stack — ★그 줄을 ★내지 ★않는다. ★★«칸은 있는데 조용히 아무 일 없음»을 ★막는 자리다.
     ★까닭은 ★실측이다(P4 · 핀): stack 에서 `align-items` 를 start/center/end 로 ★몰아도
     ★부호 중심이 ★−76.6 으로 ★세 번 ★같았다 = ★★안 움직인다(1열×3행이라 ★밀 틈이 없다). */
  await setup(page, { layout: 'stack', text: '안녕' });
  await openPanel(page);
  const cs2 = await panelCensus(page);
  expect(cs2.valignGroup, `★★stack 에서는 ★«세로 정렬» 줄이 ★없어야 한다 — ★눌러도 ★안 움직이는 칸을 ★내지 않는다(P4 실측). 잰 값 ${cs2.valignGroup}`).toBe(0);
  expect(cs2.markDySlider, '★★그런데 ★y 슬라이더는 ★stack 에도 ★있어야 한다(P4: translateY 는 ★두 꼴 모두 먹는다)').toBe(1);
  const hint = await page.evaluate(() => [...document.querySelectorAll('#panel-right .prop-hint')].map(e => e.textContent).join(' '));
  expect(/세로/.test(hint), `★★그 자리에 ★까닭이 ★글로 적혀 있어야 한다(⛔없는 칸을 ★말 없이 ★지우지 않는다). 잰 안내문 「${hint.slice(0, 200)}」`).toBe(true);

  /* ㉤ ★왕복 — ★두 칸이 ★저장 왕복(rebindAll 재렌더)을 ★산다. */
  const rt = await page.evaluate(() => {
    const b = window.__qt;
    b.dataset.markDy = '18'; b.dataset.vAlign = 'top'; b.dataset.layout = 'inline';
    const html = b.outerHTML;
    const host = b.closest('.row');
    host.innerHTML = html;
    window.rebindAll && window.rebindAll();
    const nb = host.querySelector('.quote-block');
    window.__qt = nb;
    return { markDy: nb.dataset.markDy, vAlign: nb.dataset.vAlign, ty: getComputedStyle(nb.querySelector('[data-qt-mark="pre"]')).transform };
  });
  expect(rt.markDy, '★왕복 뒤에도 markDy 가 산다').toBe('18');
  expect(rt.vAlign, '★왕복 뒤에도 vAlign 이 산다').toBe('top');
  expect(/matrix\(1, 0, 0, 1, 0, 18\)/.test(rt.ty), `★왕복 뒤 ★다시 그려져 ★부호가 ★18px 밀려 있어야 한다. 잰 값 ${rt.ty}`).toBe(true);

  expect(errs).toEqual([]);
});

/* ══════ 2026-10-10 현빈 1010t2c2 — 「★우측 패널에서 ★슬라이드를 움직여도 ★실제론 ★간격조절이 ★안 된다」 ══════
   ★★먼저 ★세 갈래로 ★갈라 쟀다(탐침 원본 = ~/.gd-work/t4quote/run-logs/, 핀 f69c307e):
     ① ★닿는가   ✅ — `.prop-slider` 상자는 ★3px(css/editor-props.css:69)인데 ★손잡이 그림은 ★12px(:75).
                      ★dy 를 비껴 가며 ★전수로 쟀다: ★먹는 dy = [-6..+5] ⇒ ★눌리는 띠 ≈ ★12px. ⇒ ⛔면적 ★아니다.
     ② ★불리는가 ✅ — 진짜 끌기로 ★슬라이더 ★4개 전수: input ★12회·change ★1회 · dataset ＋ computed ★둘 다 따라왔다.
     ③ ★맞는 갈래 ⛔ — ★★여기가 끊긴다. ★gap 0→80 이 ★사람 눈의 거리를 ★157→164(7px)만 바꿨고
                      ★연속도 아니었다(0=20 · 40=60=80).
   ★★까닭 = ★★항등식이다. inline 격자는 `auto minmax(0,1fr) auto` 이고 ★블럭이 ★섹션 폭 ★전부를 먹는다
     ⇒ ★부호는 ★양 끝에 ★박히고 `column-gap` 은 ★★«가운데 칸만» 좁힌다. 글이 ★가운데면
        거리 = gap + (블럭폭 − 2·부호폭 − 2·gap − 글폭)/2 = (블럭폭 − 2·부호폭 − 글폭)/2
        ⇒ ★★gap 이 ★약분돼 ★사라진다. ★실측이 그 식을 확인했다(gap 0: 0+(819.56−글폭)/2 · gap 80: 80+(659.56−글폭)/2 = ★같다).
   ★★대조(같은 판 · ★조건만 바꿨다): align=left ★0→34 ✅ · stack ★14→48 ✅ · ★align=center ⛔.
     ⇒ ★★c2 는 ★★«inline ＋ 가운데 정렬(= ★제품 ★기본값)에서만» 나는 ★해당 없음이었다.
   ⛔「먹통」으로 적지 마라 — ★핸들러는 ★돌고 있었다. */

/** ★블럭의 ★배율 — ★섹션 transform 때문에 ★화면 px ≠ CSS px 다(axisOf 머리말의 그 까닭).
 *  ★offsetWidth 는 ★transform 을 ★안 받는다 ⇒ ★둘의 비가 ★배율이다. */
const QT_GEO = `(() => {
  const b = window.__qt;
  const r = b.getBoundingClientRect();
  const scale = b.offsetWidth ? (r.width / b.offsetWidth) : 1;
  const pre = b.querySelector('[data-qt-mark="pre"]');
  const post = b.querySelector('[data-qt-mark="post"]');
  const line = b.querySelector('.tb-qt-line');
  const R = (e) => e.getBoundingClientRect();
  const cs = getComputedStyle(b);
  return {
    scale,
    /* ★사람이 보는 ★거리를 ★CSS px 로 되돌린다 — ⛔화면 px 를 ★gap 과 ★바로 견주지 마라 */
    dPre: (pre && line) ? (R(line).left - R(pre).right) / scale : null,
    dPost: (post && line) ? (R(post).left - R(line).right) / scale : null,
    dPreV: (pre && line) ? (R(line).top - R(pre).bottom) / scale : null,
    colGap: cs.columnGap, rowGap: cs.rowGap,
    gridCols: cs.gridTemplateColumns.trim().split(/\\s+/).length,
    preL: R(pre).left, lineCx: (R(line).left + R(line).right) / 2, blockL: r.left, blockW: r.width,
  };
})()`;

test('Q16 ★★간격 슬라이더가 ★그림을 바꾼다 — ★inline ＋ ★가운데 정렬(★제품 기본값)에서도 (현빈 1010t2c2)', async ({ page }) => {
  const errs = await setup(page, { text: '안녕' });

  /* ★★전제를 ★먼저 ★단언한다 — ★이 칸의 이름이 「inline ＋ 가운데」이므로.
     ⛔전제가 깨지면 ★본 단언까지 ★못 갔다는 것을 ★여기서 찍는다(AND 를 ★한 덩이로 찍지 않는다). */
  const pre = await page.evaluate(() => ({
    layout: window.__qt.dataset.layout, align: window.__qt.dataset.align,
    preOn: window.__qt.dataset.preOn, postOn: window.__qt.dataset.postOn,
    marks: window.__qt.querySelectorAll('.tb-qt-mark').length,
    lines: window.__qt.querySelectorAll('.tb-qt-line').length,
  }));
  expect(pre.layout, '★전제 ㉠ — 꼴 = inline(기본값)').toBe('inline');
  expect(pre.align, '★전제 ㉡ — 정렬 = center(기본값 · ★이 칸이 재는 ★그 조건)').toBe('center');
  expect(pre.preOn, '★전제 ㉢ — 앞 부호 켜짐').toBe('1');
  expect(pre.postOn, '★전제 ㉣ — 뒤 부호 켜짐').toBe('1');
  expect(pre.marks, '★전제 ㉤ — 부호 둘이 ★그려졌다').toBe(2);
  expect(pre.lines, '★전제 ㉥ — 글줄 하나').toBe(1);

  /* ── ㉠ ★모델 → ★그림 : gap 을 키우면 ★사람 눈의 거리가 ★그만큼 벌어진다 ───────────── */
  const at = {};
  for (const g of [0, 40, 80]) {
    at[g] = await page.evaluate((code) => { return eval(code); },
      `(() => { window.__qt.dataset.gap = '${g}'; window.renderQuoteBlock(window.__qt); return ${QT_GEO}; })()`);
  }
  expect(at[0].scale > 0, `★전제 ㉦ — 배율을 쟀다 (실측 ${at[0].scale})`).toBe(true);
  expect(at[80].colGap, '★전제 ㉧ — computed column-gap 은 ★이미 따라왔다(② 갈래는 ★살아 있다)').toBe('80px');

  /* ★★주 단언 — ★거리 ★차이가 ★gap ★차이와 ★같아야 한다(CSS px · ±2px).
     ★핀 f69c307e 실측 = ★0→80 에서 ★거리 차 ★+17.5 CSS px(화면 7px / 배율 0.4) ⇒ ★여기서 ★빨강이다. */
  const d40 = at[40].dPre - at[0].dPre;
  const d80 = at[80].dPre - at[0].dPre;
  expect(Math.abs(d40 - 40) <= 2,
    `★★gap 0→40 이 ★앞부호↔글 거리를 ★40px 벌려야 한다. 잰 값 ${d40.toFixed(1)}px`
    + ` (거리 ${at[0].dPre.toFixed(1)} → ${at[40].dPre.toFixed(1)} · 배율 ${at[40].scale.toFixed(3)})`).toBe(true);
  expect(Math.abs(d80 - 80) <= 2,
    `★★gap 0→80 이 ★앞부호↔글 거리를 ★80px 벌려야 한다. 잰 값 ${d80.toFixed(1)}px`
    + ` (거리 ${at[0].dPre.toFixed(1)} → ${at[80].dPre.toFixed(1)} · ⚰️핀 f69c307e 에서는 ★+17.5 였다)`).toBe(true);
  /* ★뒤쪽도 ★같이 — ★한쪽만 고치면 ★부호가 ★짝이 안 맞는다 */
  const p80 = at[80].dPost - at[0].dPost;
  expect(Math.abs(p80 - 80) <= 2,
    `★★글↔뒤부호도 ★80px 벌어져야 한다. 잰 값 ${p80.toFixed(1)}px (${at[0].dPost.toFixed(1)} → ${at[80].dPost.toFixed(1)})`).toBe(true);
  /* ★★연속인가 — ⛔계단이면 ★「움직이는데 안 바뀐다」가 ★남아 있다(핀에서는 0=20·40=60=80 이었다) */
  expect(d40 > 2 && d80 > d40 + 2,
    `★★단조로워야 한다(0 < 40 < 80). 잰 거리 ${[at[0].dPre, at[40].dPre, at[80].dPre].map(v => v.toFixed(1)).join(' → ')}`).toBe(true);
  /* ★3칸 격자는 ★그대로 — ⛔고치면서 ★꼴을 ★바꾸지 않았다(Q2·Q9 와 ★한 쌍) */
  expect(at[80].gridCols, `★inline 열 트랙은 ★그대로 3 이어야 한다. 잰 값 ${at[80].gridCols}`).toBe(3);

  /* ── ㉡ ★★음성대조 — ★`markDy`(부호 y)는 ★가로 거리를 ★안 건드린다 ────────────────
     ★이 줄이 없으면 ★「아무 수나 키우면 거리가 벌어진다」는 자가 ★통과한다. */
  const negBefore = await page.evaluate((code) => eval(code), QT_GEO);
  const negAfter = await page.evaluate((code) => eval(code),
    `(() => { window.__qt.dataset.markDy = '40'; window.renderQuoteBlock(window.__qt); return ${QT_GEO}; })()`);
  expect(Math.abs(negAfter.dPre - negBefore.dPre) <= 2,
    `★★음성대조 — ★부호 y 는 ★가로 거리를 ★안 바꿔야 한다. 잰 값 ${negBefore.dPre.toFixed(1)} → ${negAfter.dPre.toFixed(1)}`).toBe(true);
  await page.evaluate(() => { window.__qt.dataset.markDy = '0'; window.renderQuoteBlock(window.__qt); });

  /* ── ㉢ ★패널 → ★모델 → ★그림 : ★사람이 하는 순서로 ★진짜 슬라이더를 ★끈다 ──────────
     ⛔dataset 을 손으로 박는 것만으로 ★닫지 마라 — 현빈이 ★만진 것은 ★슬라이더다. */
  await openPanel(page);
  const s0 = await page.evaluate((code) => {
    window.__qt.dataset.gap = '0'; window.renderQuoteBlock(window.__qt); window.showQuoteProperties(window.__qt);
    return eval(code);
  }, QT_GEO);
  const sld = await page.evaluate(() => {
    const s = document.getElementById('qt-gap-slider');
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.left + 6, y: r.top + r.height / 2, right: r.right - 4, min: s.min, max: s.max, value: s.value };
  });
  expect(sld, '★전제 — `#qt-gap-slider` 가 패널에 ★있다').not.toBe(null);
  expect(sld.value, '★전제 — 끌기 ★전 슬라이더 값 = 0').toBe('0');
  await page.mouse.move(sld.x, sld.y);
  await page.mouse.down();
  await page.mouse.move(sld.right, sld.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('qt-gap-slider')?.value === '80', null, { timeout: 3000 })
    .catch(() => { throw new Error('★끌었는데 ★슬라이더 값이 ★최대(80)로 ★안 갔다 — ★① 닿는가 갈래가 ★깨졌다'); });
  const s1 = await page.evaluate((code) => eval(code), QT_GEO);
  const sd = s1.dPre - s0.dPre;
  expect(Math.abs(sd - 80) <= 3,
    `★★슬라이더를 ★끝까지 끌었더니 ★거리가 ★80px 벌어져야 한다. 잰 값 ${sd.toFixed(1)}px`
    + ` (${s0.dPre.toFixed(1)} → ${s1.dPre.toFixed(1)} · dataset ${await page.evaluate(() => window.__qt.dataset.gap)})`).toBe(true);

  /* ── ㉣ ★stack 도 ★같이 잠근다 — ★여기는 ★핀에서도 ★먹었다(14→48 화면 = ★배율 적용 전) ── */
  await setup(page, { layout: 'stack', text: '안녕' });
  const v0 = await page.evaluate((code) => eval(code),
    `(() => { window.__qt.dataset.gap = '0'; window.renderQuoteBlock(window.__qt); return ${QT_GEO}; })()`);
  const v80 = await page.evaluate((code) => eval(code),
    `(() => { window.__qt.dataset.gap = '80'; window.renderQuoteBlock(window.__qt); return ${QT_GEO}; })()`);
  const vd = v80.dPreV - v0.dPreV;
  expect(Math.abs(vd - 80) <= 2,
    `★stack 에서 ★부호↔글 ★세로 거리가 ★80px 벌어져야 한다. 잰 값 ${vd.toFixed(1)}px (${v0.dPreV.toFixed(1)} → ${v80.dPreV.toFixed(1)})`).toBe(true);

  expect(errs, '★오류 0').toEqual([]);
});

/* ══════ 2026-10-10 현빈 1010t2c1-① — 「★텍스트를 ★캔버스에서 ★수정 바로 할수 있게 해주고」 ══════
   ★★v1 은 ★이것을 ★«없는 것»으로 ★이름까지 적어 뒀다 — `quote-block.js:71`
     「v1 에 없는 것 … ★인라인 더블클릭 편집(★글은 우측 패널로 넣는다)」
   ⇒ ★이 칸은 ★★그 결정을 ★뒤집은 것을 ★잠근다. ★근거는 ★현빈 원문 ★하나다.
   ★★핀 실측(f69c307e · 고치기 전): 글줄 가운데를 ★진짜 더블클릭 ⇒
     `blockCE=null · lineCE=null · activeInBlock=false · selInBlock=false · 콘솔오류 0`
     = ★★«아무 일도 안 난다»(⛔먹통이 아니라 ★그 길이 ★없었다).
   ★선례 = ★모달(block-drag.js `_modalEndEdit`) — ★dataset 이 진실인 블럭의 ★그 규율 한 벌.
   ★★편집 host 는 ★`.tb-qt-body` ★하나다(줄마다 열면 ★엔터로 줄 나누기가 막힌다). */
test('Q17 ★★캔버스에서 ★글을 ★바로 고친다 — ★더블클릭 ⇒ ★타이핑 ⇒ ★dataset 커밋 ＋ ★패널 동기 (현빈 1010t2c1-①)', async ({ page }) => {
  const errs = await setup(page, { text: '안녕' });
  await openPanel(page);                         /* ★사람이 하는 순서 — ★고르고(패널 열고) ★나서 더블클릭 */

  /* ★전제 — ⛔편집이 ★이미 열려 있으면 ★이 칸은 ★아무것도 안 잰다 */
  const pre = await page.evaluate(() => ({
    panel: !!document.getElementById('qt-shape-group'),
    selected: window.__qt.classList.contains('selected'),
    ce: window.__qt.querySelectorAll('[contenteditable="true"]').length,
    body: !!window.__qt.querySelector('.tb-qt-body'),
    text: window.__qt.dataset.text,
    taVal: document.getElementById('qt-text')?.value ?? null,
  }));
  expect(pre.panel, '★전제 ㉠ — 인용구 패널이 열렸다').toBe(true);
  expect(pre.selected, '★전제 ㉡ — 블럭이 ★고른 상태다(사람이 하는 순서)').toBe(true);
  expect(pre.ce, '★전제 ㉢ — ★편집이 ★아직 안 열렸다(contenteditable=true 0건)').toBe(0);
  expect(pre.body, '★전제 ㉣ — 글덩이(.tb-qt-body)가 ★그려져 있다').toBe(true);
  expect(pre.text, '★전제 ㉤ — 지금 글 = 「안녕」').toBe('안녕');
  expect(pre.taVal, '★전제 ㉥ — 패널 textarea 도 「안녕」').toBe('안녕');

  /* ── ㉠ ★더블클릭이 ★편집을 ★연다 ────────────────────────────────────────── */
  const lr = await waitStableRect(page, '#sQ .quote-block .tb-qt-line');
  await page.mouse.dblclick(lr.cx, lr.cy);
  const open = await page.evaluate(() => {
    const b = window.__qt;
    const body = b.querySelector('.tb-qt-body');
    return {
      bodyCE: body?.getAttribute('contenteditable') ?? null,
      editing: b.classList.contains('editing'),
      activeIsBody: document.activeElement === body,
      /* ⛔편집은 ★한 자리만 열려야 한다 — ★줄마다 열리면 ★엔터로 줄 나누기가 막힌다 */
      ceCount: b.querySelectorAll('[contenteditable="true"]').length,
      markCE: [...b.querySelectorAll('.tb-qt-mark')].map(e => e.getAttribute('contenteditable')),
      draggable: body?.getAttribute('draggable') ?? null,
    };
  });
  expect(open.bodyCE, `★★더블클릭이 ★글덩이를 ★편집으로 열어야 한다(⚰️핀 f69c307e 실측 = ★null). 잰 값 ${open.bodyCE}`).toBe('true');
  expect(open.activeIsBody, '★★포커스가 ★그 글덩이에 가 있다(⚰️핀 실측 = ★false)').toBe(true);
  expect(open.editing, '★`editing` 클래스 — 드래그·삭제키 가드가 이걸 본다').toBe(true);
  expect(open.ceCount, `★편집은 ★한 자리만 열린다. 잰 값 ${open.ceCount}`).toBe(1);
  expect(open.draggable, '★`draggable=false` — ⛔안 끄면 글자 드래그 선택이 ★블록 드래그가 된다').toBe('false');
  /* ★★음성대조 — ★부호는 ★편집 대상이 ★아니다 */
  expect(open.markCE.filter(v => v === 'true'), `★★부호(.tb-qt-mark)는 ★편집이 ★안 열려야 한다. 잰 값 ${JSON.stringify(open.markCE)}`).toEqual([]);

  /* ── ㉡ ★타이핑이 ★dataset 에 ★커밋된다 ＋ ★패널이 ★따라온다 ───────────────── */
  await page.evaluate(() => {
    const body = window.__qt.querySelector('.tb-qt-body');
    const sel = window.getSelection(); sel.removeAllRanges();
    const r = document.createRange(); r.selectNodeContents(body); sel.addRange(r);   // ★다 지우고 새로 쓴다
  });
  await page.keyboard.insertText('처음 입어도');
  await page.evaluate(() => window.__qt.querySelector('.tb-qt-body').blur());        // ★떠난다 = 커밋
  await page.waitForFunction(() => window.__qt.dataset.text === '처음 입어도', null, { timeout: 3000 })
    .catch(() => { throw new Error('★타이핑 뒤 ★blur 가 ★dataset.text 에 ★커밋하지 않았다'); });
  const after = await page.evaluate(() => {
    const b = window.__qt;
    return {
      ds: b.dataset.text,
      drawn: [...b.querySelectorAll('.tb-qt-line')].map(e => e.textContent),
      ce: b.querySelectorAll('[contenteditable="true"]').length,
      editing: b.classList.contains('editing'),
      taVal: document.getElementById('qt-text')?.value ?? null,
      marks: b.querySelectorAll('.tb-qt-mark').length,
    };
  });
  expect(after.ds, '★★글이 ★dataset 에 산다(⛔DOM 에만 남지 않는다)').toBe('처음 입어도');
  expect(after.drawn, '★★다시 그려졌다').toEqual(['처음 입어도']);
  expect(after.ce, '★편집이 ★닫혔다').toBe(0);
  expect(after.editing, '★`editing` 이 ★떨어졌다').toBe(false);
  expect(after.marks, '★부호는 ★그대로 한 쌍').toBe(2);
  expect(after.taVal, `★★우측 패널 ★textarea 도 ★따라와야 한다(⛔캔버스와 ★갈리면 ★다음에 패널로 고칠 때 ★되돌아간다). 잰 값 「${after.taVal}」`).toBe('처음 입어도');

  /* ── ㉢ ★엔터가 ★줄을 나눈다 (v1 모델 = ★글은 한 덩이 · 렌더가 쪼갠다) ──────── */
  const lr2 = await waitStableRect(page, '#sQ .quote-block .tb-qt-line');
  await page.mouse.dblclick(lr2.cx, lr2.cy);
  await page.waitForFunction(() => window.__qt.querySelector('.tb-qt-body')?.getAttribute('contenteditable') === 'true', null, { timeout: 3000 });
  await page.evaluate(() => {
    const body = window.__qt.querySelector('.tb-qt-body');
    const sel = window.getSelection(); sel.removeAllRanges();
    const r = document.createRange(); r.selectNodeContents(body); sel.addRange(r);
  });
  await page.keyboard.insertText('가');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('나');
  await page.evaluate(() => window.__qt.querySelector('.tb-qt-body').blur());
  await page.waitForFunction(() => (window.__qt.querySelectorAll('.tb-qt-line').length === 2), null, { timeout: 3000 })
    .catch(() => { throw new Error('★엔터로 나눈 글이 ★두 줄로 ★안 그려졌다'); });
  const two = await page.evaluate(() => ({
    ds: window.__qt.dataset.text,
    drawn: [...window.__qt.querySelectorAll('.tb-qt-line')].map(e => e.textContent),
    pre: window.__qt.querySelectorAll('[data-qt-mark="pre"]').length,
  }));
  expect(two.ds.includes('\n'), `★★dataset 에 ★줄바꿈이 ★한 덩이로 들어갔다. 잰 값 ${JSON.stringify(two.ds)}`).toBe(true);
  expect(two.drawn, '★두 줄로 그려졌다').toEqual(['가', '나']);
  expect(two.pre, '★부호는 ★한 쌍 그대로(줄 수와 ★무관 — Q4 의 그 불변식)').toBe(1);

  /* ── ㉣ ★★안내문구 ★지뢰 — ★손 안 대고 나가면 ★데이터로 굳지 ★않는다 ──────────
     ⛔이 줄이 없으면 ★더블클릭만 해도 ★안내문구가 ★본문이 되는 블럭이 ★영영 남는다(모달의 그 규약). */
  await setup(page, {});                                   /* 글 없는 새 블럭 = 안내문구 */
  const ph0 = await page.evaluate(() => ({
    ds: window.__qt.dataset.text ?? null,
    isPh: !!window.__qt.querySelector('[data-is-placeholder="true"]'),
    drawn: window.__qt.querySelector('.tb-qt-line')?.textContent ?? null,
  }));
  expect(ph0.isPh, '★전제 — 지금 ★안내문구를 그리고 있다').toBe(true);
  const lr3 = await waitStableRect(page, '#sQ .quote-block .tb-qt-line');
  await page.mouse.dblclick(lr3.cx, lr3.cy);
  await page.waitForFunction(() => window.__qt.querySelector('.tb-qt-body')?.getAttribute('contenteditable') === 'true', null, { timeout: 3000 });
  await page.evaluate(() => window.__qt.querySelector('.tb-qt-body').blur());
  await page.waitForFunction(() => window.__qt.querySelectorAll('[contenteditable="true"]').length === 0, null, { timeout: 3000 });
  const ph1 = await page.evaluate(() => ({
    ds: window.__qt.dataset.text ?? '',
    isPh: !!window.__qt.querySelector('[data-is-placeholder="true"]'),
    drawn: window.__qt.querySelector('.tb-qt-line')?.textContent ?? null,
  }));
  expect(ph1.ds, `★★안내문구가 ★데이터로 ★굳지 않았다(dataset.text 가 ★빈 채). 잰 값 ${JSON.stringify(ph1.ds)}`).toBe('');
  expect(ph1.isPh, '★여전히 ★안내문구 표식을 ★달고 그려진다').toBe(true);
  expect(ph1.drawn, '★그려진 글자는 ★그 안내문구 그대로').toBe(ph0.drawn);

  /* ★★㉣-2 — ★★«손은 댔는데 ★같은 글자»(앞뒤 공백만 더함)도 ★굳지 ★않는다.
     ★★왜 이 칸이 ★따로 필요한가 — ★★㉣-1 은 ★`text === before` ★하나로 ★통과한다(★실측으로 알았다:
       `_quoteEndEdit` 의 ★`isPh` 를 ★`false` 로 못박은 ★변이 ★M16 에서 ★㉣-1 이 ★초록이었다).
     ⇒ ★★`isPh` 가 ★★«유일한 자»인 장면은 ★여기다 — ★글자는 ★달라졌는데(공백) ★뜻은 ★그 안내문구다.
     ⛔이 줄이 없으면 ★안내문구 지뢰 가드가 ★아무 검사에도 ★안 걸린다(=★지키는 자가 없다). */
  const lr4 = await waitStableRect(page, '#sQ .quote-block .tb-qt-line');
  await page.mouse.dblclick(lr4.cx, lr4.cy);
  await page.waitForFunction(() => window.__qt.querySelector('.tb-qt-body')?.getAttribute('contenteditable') === 'true', null, { timeout: 3000 });
  const phTxt = await page.evaluate(() => window.__qt.querySelector('.tb-qt-line').textContent);
  await page.evaluate(() => {
    const body = window.__qt.querySelector('.tb-qt-body');
    const sel = window.getSelection(); sel.removeAllRanges();
    const r = document.createRange(); r.selectNodeContents(body); sel.addRange(r);
  });
  await page.keyboard.insertText('  ' + phTxt + '  ');          /* ★같은 글자 ＋ 앞뒤 공백 */
  await page.evaluate(() => window.__qt.querySelector('.tb-qt-body').blur());
  await page.waitForFunction(() => window.__qt.querySelectorAll('[contenteditable="true"]').length === 0, null, { timeout: 3000 });
  const ph2 = await page.evaluate(() => ({
    ds: window.__qt.dataset.text ?? '',
    isPh: !!window.__qt.querySelector('[data-is-placeholder="true"]'),
  }));
  expect(ph2.ds, `★★«공백만 더한 안내문구»도 ★데이터로 ★굳지 않는다. 잰 값 ${JSON.stringify(ph2.ds)}`).toBe('');
  expect(ph2.isPh, '★★여전히 ★안내문구다 — ⛔표식이 떨어지면 ★그 블럭은 ★영영 「본문이 안내문구인」 블럭이 된다').toBe(true);

  /* ★★이 마지막 줄은 ★«자»를 위한 꼴이기도 하다 — `tools/assert-strength.mjs:199~203` 이
     ★본문을 ★«마지막 ★진짜 화살표 뒤의 첫 `{`»부터로 읽어서, ★시험 끝에 ★블록·객체 리터럴이 서면
     ★이 시험의 ★단언이 ★★0건으로 세어진다(★실측 2026-10-10: 이 칸이 ★n=0 이었다 ⇒ ★게이트가 ★안 재고 있었다).
     ⇒ ★마지막 화살표를 ★★«블록 없는 식»으로 두면 ★그 자가 ★시험 ★전체를 ★본다.
     ★그리고 ★`String(e)` 는 ★덤이 아니다 — ★빨강이 났을 때 ★오류 ★꼴을 ★메시지에 ★읽히게 한다.
     ★까닭 전문은 ★Q10 의 그 머리말에 있다. */
  expect(errs.map(e => String(e)), '★오류 0').toEqual([]);
});

/* ══════ 2026-10-10 현빈 1010t2c1-② — 「우측에서는 ★타이포그래피 ★동적으로 ★다른 텍스트블럭처럼 수정되게해줘」 ══════
   ★★«다른 텍스트블럭»이 ★무엇인가를 ★먼저 ★이름으로 찾았다 — ⛔내가 항목을 ★지어내지 않았다:
     ★정본 = `js/props/_typo-section.js` 의 ★`buildTypographySectionHtml`(＋`buildFillSectionHtml`)
       — 머리말 :1 「Typography·Fill 절의 «마크업»이 사는 ★단 하나의 자리」 · ★소비자 ★13파일
       · `tests/unit/typo-section-ssot.test.mjs` 가 ★그 정본을 쓰는지 잠근다.
   ★★N 의 출처 — ⛔소스 낱말 grep 이 ★아니다(`id="${p}-…"` 는 ★48건인데 ★줄·그릇이 섞여 거짓양이다).
     ✅앱에서 ★블럭을 ★만들어 ★고르고 `#panel-right` ★그 절 안의 `input/select/button` 을 ★전수로 셌다
       (`~/.gd-work/t4quote/run-logs/probe-typo-01.log`):
         ㉠ ★텍스트블럭(p=`txt`)  Typography ★34(보임 11 · 숨음 23) ＋ Fill ★6
         ㉡ ★모달(p=`mdl-typo` · ★dataset 이 진실 = ★인용구와 ★같은 꼴) ★11 ＋ ★6
         ㉢ ★그때의 ★인용구 — Typography/Fill 절이 ★★0(절 제목 전수 = ["인용구(쉼표)","글"]) · «글» 절 ★5칸
   ★★기준판 = ★㉡ 모달이다 — ㉠의 ★숨은 23칸은 ★부분 서식(선택한 글자만)을 ★전제하고, ★이 블럭의 글은
     ★`textContent` ★평문으로 dataset 에 살아 ★원리적으로 ★부분 서식이 ★안 된다(모달과 ★같은 한계).
   ★★모달 11 중 ★★하나(★형광펜 H)를 ★★일부러 ★안 켰다 — ★까닭을 ★이름으로:
     ★형광펜 ★색의 명부가 ★이미 ★둘(`modal-block.js:326` ＋ `modal-frameify.js:42`)이고
     `tests/unit/modal-frameify-gates.test.mjs` ★G1 이 ★그 둘만 대조한다 ⇒ ★세 번째 사본은 ★그 게이트 ★밖이다.
     ⇒ ★그래서 ★★«10 ＋ 안 켠 1»을 ★이 칸이 ★그대로 ★잠근다(⛔「전부」라 적지 않는다). */
test('Q18 ★★타이포그래피 절 — ★정본에서 나오고(명부) ★닿고 ★눌러서 ★모델과 ★그림을 움직인다 (현빈 1010t2c1-②)', async ({ page }) => {
  const errs = await setup(page, { text: '안녕' });
  await openPanel(page);

  /* ── ㉠ ★명부 — ★절이 ★섰나 ＋ ★조종칸 ★전수 ───────────────────────────────── */
  const cen = await page.evaluate(() => {
    const p = document.getElementById('panel-right');
    const titles = [...p.querySelectorAll('.prop-section-title')].map(e => e.textContent.trim());
    const sec = [...p.querySelectorAll('.prop-section')]
      .find(s => (s.querySelector('.prop-section-title')?.textContent || '').trim() === 'Typography') || null;
    const ids = sec ? [...sec.querySelectorAll('input, select, button')].map(e => e.id) : [];
    return {
      titles, has: !!sec, ids,
      /* ⛔한 값에 ★조종칸이 ★둘이면 ★어느 쪽이 참인지 ★사람이 못 안다 — ★옛 쌍은 ★치웠다 */
      oldFsSlider: p.querySelectorAll('#qt-fontsize-slider, #qt-fontsize-number').length,
      hlBtn: p.querySelectorAll('#qt-typo-highlight-btn').length,
      ulBtn: p.querySelectorAll('#qt-typo-underline-btn').length,
      dotBtn: p.querySelectorAll('#qt-typo-dot-btn').length,
      sizeMin: document.getElementById('qt-typo-size-number')?.min ?? null,
      sizeMax: document.getElementById('qt-typo-size-number')?.max ?? null,
      sizeVal: document.getElementById('qt-typo-size-number')?.value ?? null,
      weightVal: document.getElementById('qt-typo-font-weight')?.value ?? null,
    };
  });
  expect(cen.has, `★★Typography 절이 ★패널에 ★있어야 한다(⚰️핀 f69c307e 실측 = ★0 · 절 제목 ["인용구(쉼표)","글"]). 잰 제목 ${JSON.stringify(cen.titles)}`).toBe(true);
  /* ★모달에 있고 ★인용구에 없던 ★그 항목들 — ★하나씩 ★이름으로 */
  for (const id of ['qt-typo-font-trigger', 'qt-typo-font-search', 'qt-typo-font-noonnu',
    'qt-typo-font-weight', 'qt-typo-size-number', 'qt-typo-bold-btn', 'qt-typo-italic-btn',
    'qt-typo-strike-btn', 'qt-typo-lh-number', 'qt-typo-ls-number']) {
    expect(cen.ids.includes(id), `★조종칸 ★${id} 가 ★있어야 한다. 잰 전수 ${JSON.stringify(cen.ids)}`).toBe(true);
  }
  expect(cen.ids.length, `★조종칸 ★10개(모달 11 − ★안 켠 형광펜 1). 잰 값 ${cen.ids.length} · ${JSON.stringify(cen.ids)}`).toBe(10);
  /* ★★안 켠 것도 ★이름으로 잠근다 — ⛔「눌러도 조용히 아무 일 없음」을 ★만들지 않는다 */
  expect(cen.hlBtn, '★형광펜(H)은 ★안 켠다 — 색 명부가 이미 둘이다(G1 이 그 둘만 대조)').toBe(0);
  expect(cen.ulBtn, '★밑줄(U)도 ★안 켠다 — 부분 서식 전제').toBe(0);
  expect(cen.dotBtn, '★점도 ★안 켠다 — 부분 서식 전제').toBe(0);
  expect(cen.oldFsSlider, `★옛 «글자 크기» 쌍은 ★치웠다(한 값에 칸 둘 금지). 잰 값 ${cen.oldFsSlider}`).toBe(0);
  /* ★범위가 ★QUOTE_LIMITS ★한 표에서 왔나 — ⛔리터럴이면 여기서 갈린다 */
  const lim = await page.evaluate(() => window.QUOTE_LIMITS.fontSize);
  expect([cen.sizeMin, cen.sizeMax], `★크기 범위는 ★QUOTE_LIMITS 에서 온다(${JSON.stringify(lim)})`).toEqual([String(lim.min), String(lim.max)]);
  expect(cen.sizeVal, '★크기 칸이 ★지금 값을 비춘다').toBe('21');
  expect(cen.weightVal, '★굵기 select 가 ★모델(weight=400)을 비춘다').toBe('400');

  /* ── ㉡ ★닿나 (자 ㉢ — Q6·Q14 와 ★같은 자) ────────────────────────────────── */
  const reach = await page.evaluate(() => {
    const out = [];
    for (const id of ['qt-typo-font-trigger', 'qt-typo-font-weight', 'qt-typo-size-number',
      'qt-typo-bold-btn', 'qt-typo-italic-btn', 'qt-typo-strike-btn', 'qt-typo-lh-number', 'qt-typo-ls-number']) {
      const el = document.getElementById(id);
      if (!el) { out.push({ id, missing: true }); continue; }
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      out.push({ id, w: Math.round(r.width), h: Math.round(r.height),
        reached: !!(hit && (hit === el || el.contains(hit) || hit.closest(`#${id}`) === el)) });
    }
    return out;
  });
  for (const r of reach) {
    expect(r.missing, `★${r.id} 가 ★없다`).toBeUndefined();
    expect(r.w > 0 && r.h > 0, `★${r.id} 의 ★면적이 ★0 이다(${r.w}×${r.h}) — ★규칙이 아니라 ★면적 문제다`).toBe(true);
    expect(r.reached, `★${r.id} 의 ★가운데를 ★elementFromPoint 가 ★그것으로 ★안 돌려줬다 ⇒ ★안 눌린다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  }

  /* ── ㉢ ★★불리나 ＋ ★맞는 갈래인가 — ★모델 ＋ ★그려진 CSS 를 ★같이 잰다 ──────── */
  const lineCss = () => page.evaluate(() => {
    const l = window.__qt.querySelector('.tb-qt-line');
    const m = window.__qt.querySelector('.tb-qt-mark');
    const cs = getComputedStyle(l), ms = getComputedStyle(m);
    return {
      weight: cs.fontWeight, style: cs.fontStyle, deco: cs.textDecorationLine,
      lh: cs.lineHeight, ls: cs.letterSpacing, size: cs.fontSize, family: cs.fontFamily,
      markWeight: ms.fontWeight,                 /* ★음성대조용 — 부호는 ★안 따라와야 한다 */
      ds: { ...window.__qt.dataset },
    };
  });
  const base = await lineCss();
  expect(base.weight, '★전제 — 지금 굵기 400').toBe('400');
  expect(base.style, '★전제 — 기울임 아님').toBe('normal');
  expect(base.deco, '★전제 — 취소선 아님').toBe('none');

  /* ★B — ★진짜 클릭 */
  /* ⚠️★`{sel:'#id'}` 를 ★쓰면 안 된다 — `_click-at.js:22` 가 ★`#id` 꼴일 때만 ★«맞힌 요소 자체»의 id 를 본다.
     ★이 단추들은 ★속에 ★`<b>`·`<i>`·`<s>` 를 품어 ★맞히는 것이 ★그 자식이다(실측 2026-10-10: 「맞힌 요소 «»」).
     ⇒ ★`[id="…"]` 꼴로 주면 ★`closest` 갈래로 가서 ★조상까지 ★본다. */
  const clickId = async (id) => {
    const r = await page.evaluate((i) => { const b = document.getElementById(i).getBoundingClientRect(); return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; }, id);
    await clickAt(page, r.cx, r.cy, { sel: `[id="${id}"]` }, { label: `Q18 ${id}` });
  };
  await clickId('qt-typo-bold-btn');
  const b1 = await lineCss();
  expect(b1.ds.bold, '★B 가 ★모델에 썼다').toBe('1');
  expect(b1.weight, `★★B 가 ★그려졌다(700). 잰 값 ${b1.weight}`).toBe('700');
  expect(b1.markWeight, `★★음성대조 — ★부호 굵기는 ★안 따라온다. 잰 값 ${b1.markWeight} (전 ${base.markWeight})`).toBe(base.markWeight);
  await clickId('qt-typo-bold-btn');                       /* 다시 눌러 끈다 */
  const b2 = await lineCss();
  expect(b2.ds.bold, '★다시 누르면 ★키가 ★지워진다(모델 한 표로 떨어진다)').toBe(undefined);
  expect(b2.weight, '★★끄면 ★400 으로 돌아온다 — ⛔켜기만 되면 ★반쪽이다').toBe('400');

  /* ★I · ★S */
  await clickId('qt-typo-italic-btn');
  const i1 = await lineCss();
  expect(i1.ds.italic, '★I 가 ★모델에 썼다').toBe('1');
  expect(i1.style, `★★기울임이 ★그려졌다. 잰 값 ${i1.style}`).toBe('italic');
  await clickId('qt-typo-strike-btn');
  const s1 = await lineCss();
  expect(s1.ds.strike, '★S 가 ★모델에 썼다').toBe('1');
  expect(/line-through/.test(s1.deco), `★★취소선이 ★그려졌다. 잰 값 ${s1.deco}`).toBe(true);

  /* ★굵기 select — ★`weight` ★그 키에 써야 한다(⛔`fontWeight` 라는 둘째 키를 만들면 여기서 빨강) */
  await page.evaluate(() => {
    const s = document.getElementById('qt-typo-font-weight');
    s.value = '700'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const w1 = await lineCss();
  expect(w1.ds.weight, `★굵기 select 가 ★`+'`weight`'+`★그 키에 썼다. 잰 dataset ${JSON.stringify({ weight: w1.ds.weight, fontWeight: w1.ds.fontWeight })}`).toBe('700');
  expect(w1.ds.fontWeight, '⛔둘째 키(`fontWeight`)를 ★만들지 않았다').toBe(undefined);
  expect(w1.weight, '★그려졌다').toBe('700');

  /* ★크기 · ★줄간격 · ★자간 — ★숫자칸은 ★change 로 커밋한다(prop-number-commit-guard 규약) */
  const setNum = async (id, v) => page.evaluate(({ i, val }) => {
    const n = document.getElementById(i);
    n.value = String(val); n.dispatchEvent(new Event('change', { bubbles: true }));
  }, { i: id, val: v });
  await setNum('qt-typo-size-number', 48);
  await setNum('qt-typo-lh-number', 2);
  await setNum('qt-typo-ls-number', 5);
  const n1 = await lineCss();
  expect(n1.ds.fontSize, '★크기가 ★모델에 썼다').toBe('48');
  expect(n1.size, `★크기가 ★그려졌다. 잰 값 ${n1.size}`).toBe('48px');
  expect(n1.ds.lineHeight, '★줄간격이 ★모델에 썼다').toBe('2');
  expect(Math.round(parseFloat(n1.lh)), `★★줄간격 2 = ★크기 48 의 ★두 배(96px)로 ★그려졌다. 잰 값 ${n1.lh}`).toBe(96);
  expect(n1.ds.letterSpacing, '★자간이 ★모델에 썼다').toBe('5');
  expect(n1.ls, `★자간이 ★그려졌다. 잰 값 ${n1.ls}`).toBe('5px');
  /* ★한도 밖은 ★표에 맞춰 ★접힌다(⛔칸이 보이는 범위와 ★실제가 갈리지 않는다) */
  await setNum('qt-typo-size-number', 9999);
  const n2 = await page.evaluate(() => ({ ds: window.__qt.dataset.fontSize, shown: document.getElementById('qt-typo-size-number').value }));
  const lim2 = await page.evaluate(() => window.QUOTE_LIMITS.fontSize.max);
  expect(n2.ds, `★한도(${lim2})로 접힌다`).toBe(String(lim2));
  expect(n2.shown, '★★칸에도 ★되썼다 — ⛔보이는 값과 ★실제가 갈리지 않는다').toBe(String(lim2));

  /* ★글꼴 — ★위젯이 ★배선됐나(★누르면 ★목록이 열린다) ＋ ★고르면 ★모델·그림에 닿나 */
  await clickId('qt-typo-font-trigger');
  const dd = await page.evaluate(() => {
    const d = document.getElementById('qt-typo-font-dropdown');
    return { shown: d ? getComputedStyle(d).display : null, items: d ? d.querySelectorAll('.font-picker-list *').length : 0 };
  });
  expect(dd.shown, `★★글꼴 ★목록이 ★열려야 한다(⛔안 열리면 ★wireFontPicker 가 ★안 돌았다). 잰 값 ${dd.shown}`).not.toBe('none');
  expect(dd.items > 0, `★목록에 ★항목이 ★있다. 잰 값 ${dd.items}`).toBe(true);
  /* ⚠️★고르기는 ★`mousedown` 이다(`_font-picker.js:175` — `_fpList.addEventListener('mousedown', …)`).
     ⇒ ⛔`el.click()` 로는 ★안 걸린다(실측 2026-10-10: dataset.fontFamily 가 ★빈 채였다).
     ⇒ ★진짜 마우스로 ★그 항목을 ★누른다(= ★사람이 하는 순서). */
  const item = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#qt-typo-font-dropdown .font-item')]
      .find(e => /Inter/.test(e.dataset.value || ''));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    el.scrollIntoView({ block: 'nearest' });
    const r2 = el.getBoundingClientRect();
    return { cx: r2.left + Math.min(40, r2.width / 3), cy: r2.top + r2.height / 2, val: el.dataset.value, h: Math.round(r.height) };
  });
  expect(item, '★전제 — 목록에서 ★`.font-item[data-value*=Inter]` 를 찾았다').not.toBe(null);
  await clickAt(page, item.cx, item.cy, { sel: '.font-item' }, { label: 'Q18 글꼴 Inter' });
  await page.waitForFunction(() => /Inter/.test(window.__qt.dataset.fontFamily || ''), null, { timeout: 3000 })
    .catch(() => { throw new Error('★글꼴을 ★골랐는데 ★모델(dataset.fontFamily)이 ★안 바뀌었다 — ★배선(onPick)을 보라'); });
  const picked = await page.evaluate(() => ({
    ds: window.__qt.dataset.fontFamily || '',
    family: getComputedStyle(window.__qt.querySelector('.tb-qt-line')).fontFamily,
  }));
  expect(/Inter/.test(picked.ds), `★★고른 글꼴이 ★모델에 썼다. 잰 값 「${picked.ds}」`).toBe(true);
  expect(/Inter/.test(picked.family), `★★그려졌다. 잰 값 「${picked.family}」`).toBe(true);

  /* ── ㉣ ★왕복 — ★새 키 ★전부가 ★저장 왕복(rebindAll 재렌더)을 ★산다 ───────────── */
  const rt = await page.evaluate(() => {
    const b = window.__qt;
    const snap = { fontFamily: b.dataset.fontFamily, weight: b.dataset.weight, fontSize: b.dataset.fontSize,
      lineHeight: b.dataset.lineHeight, letterSpacing: b.dataset.letterSpacing,
      italic: b.dataset.italic, strike: b.dataset.strike };
    const host = b.closest('.row');
    host.innerHTML = b.outerHTML;
    window.rebindAll && window.rebindAll();
    const nb = host.querySelector('.quote-block');
    window.__qt = nb;
    const cs = getComputedStyle(nb.querySelector('.tb-qt-line'));
    return { snap, now: { fontFamily: nb.dataset.fontFamily, weight: nb.dataset.weight, fontSize: nb.dataset.fontSize,
      lineHeight: nb.dataset.lineHeight, letterSpacing: nb.dataset.letterSpacing,
      italic: nb.dataset.italic, strike: nb.dataset.strike },
      css: { weight: cs.fontWeight, style: cs.fontStyle, ls: cs.letterSpacing, size: cs.fontSize } };
  });
  expect(rt.now, `★★왕복 뒤에도 ★일곱 칸이 ★그대로다. 전 ${JSON.stringify(rt.snap)} / 후 ${JSON.stringify(rt.now)}`).toEqual(rt.snap);
  expect(rt.css.weight, '★왕복 뒤 ★다시 그려져 ★굵기가 산다').toBe('700');
  expect(rt.css.style, '★기울임도 산다').toBe('italic');
  expect(rt.css.ls, '★자간도 산다').toBe('5px');

  /* ★★이 마지막 줄은 ★«자»를 위한 꼴이기도 하다 — `tools/assert-strength.mjs:199~203` 이
     ★본문을 ★«마지막 ★진짜 화살표 뒤의 첫 `{`»부터로 읽어서, ★시험 끝에 ★블록·객체 리터럴이 서면
     ★이 시험의 ★단언이 ★★0건으로 세어진다(★실측 2026-10-10: 이 칸이 ★n=0 이었다 ⇒ ★게이트가 ★안 재고 있었다).
     ⇒ ★마지막 화살표를 ★★«블록 없는 식»으로 두면 ★그 자가 ★시험 ★전체를 ★본다.
     ★그리고 ★`String(e)` 는 ★덤이 아니다 — ★빨강이 났을 때 ★오류 ★꼴을 ★메시지에 ★읽히게 한다.
     ★까닭 전문은 ★Q10 의 그 머리말에 있다. */
  expect(errs.map(e => String(e)), '★오류 0').toEqual([]);
});
