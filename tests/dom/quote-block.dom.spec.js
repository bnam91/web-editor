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
  expect(noPost.bodyW, `★글 칸이 ★넓어진다 (${both.bodyW} → ${noPost.bodyW})`).toBeGreaterThan(both.bodyW);

  /* 앞 부호도 끄기 — 부호 0, 1칸 */
  await page.evaluate(() => { window.__qt.dataset.preOn = '0'; window.renderQuoteBlock(window.__qt); });
  const none = await read();
  expect(none.cols, '★둘 다 끄면 1칸').toBe(1);
  expect(none.marks, '★부호 0').toEqual([]);
  expect(none.bodyW, `★글 칸이 ★더 넓어진다 (${noPost.bodyW} → ${none.bodyW})`).toBeGreaterThan(noPost.bodyW);
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
test('Q6 ★패널 모양 8종 — ★전부 ★닿는다(자 ㉢) · ⛔눌림 0(㉠) · ⛔쪼갬 0(㉡)', async ({ page }) => {
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
  expect(m.btnCount, '★모양 단추 8개').toBe(8);
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
  /* ★2줄로 접혔다 — 8종이 155px 에 한 줄로는 안 들어간다(자연폭 252) */
  expect(m.btnRows, `★wrap 으로 ★2줄 (실측 ${m.btnRows}줄 · 자연폭 ${m.natural})`).toBe(2);
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

  /* ★★음성대조 — ★inline 에서는 ★부호가 ★안 움직인다(양 끝 칸에 붙어 있고 ★글만 민다).
     ⇒ ⒜ 는 ★stack 의 이야기지 ★inline 을 바꾸는 이야기가 ★아니다. */
  const inl = {};
  for (const align of ['left', 'center', 'right']) {
    await setup(page, { layout: 'inline', text: '안녕', align });
    inl[align] = await axisOf(page);
  }
  const preRat = ['left', 'center', 'right'].map(a => rat(inl[a], inl[a].pieces[0], 'l'));
  const lineRat2 = ['left', 'center', 'right'].map(a => rat(inl[a], inl[a].pieces[1], 'cx'));
  expect(spread(preRat) <= 0.01, `★inline 의 ★앞부호는 ★안 움직여야 한다(왼쪽 모서리 비율). 잰 값 ${JSON.stringify(preRat.map(v => +v.toFixed(3)))}`).toBe(true);
  expect(spread(lineRat2) >= 0.5, `★inline 의 ★글은 ★움직여야 한다(안 움직이면 align 이 죽은 것). 잰 값 ${JSON.stringify(lineRat2.map(v => +v.toFixed(3)))}`).toBe(true);
});
