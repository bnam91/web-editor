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
 *   ★N1(음성대조) quote-block.js ★주석 한 줄을 고친다(무해)                  ⇒ ★전부 초록 기대
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

/* ── Q4 ★스택 — ★줄 수 == 부호 쌍 수 ＋ ★빈 줄은 건너뛴다 (지디가 못박은 단언) ──── */
test('Q4 ★스택 — ★줄 수 == 부호 쌍 수 · ★★빈 줄은 건너뛴다(⛔「/ /」만 뜨지 않는다)', async ({ page }) => {
  /* ★가운데에 ★빈 줄 둘(하나는 공백만)을 섞어 넣는다 — ★그 둘이 ★부호를 받으면 안 된다 */
  await setup(page, { layout: 'stack', shape: 'slash', text: '처음 입어도\n\n내 옷 같은\n   \n핏' });
  const m = await page.evaluate(() => {
    const b = window.__qt;
    const rows = [...b.querySelectorAll('.tb-qt-row')];
    return {
      rows: rows.length,
      lines: b.querySelectorAll('.tb-qt-line').length,
      pre: b.querySelectorAll('[data-qt-mark="pre"]').length,
      post: b.querySelectorAll('[data-qt-mark="post"]').length,
      texts: rows.map(r => r.querySelector('.tb-qt-line').textContent),
      /* ★줄마다 ★부호가 ★정확히 한 쌍인가 */
      perRow: rows.map(r => ({
        pre: r.querySelectorAll('[data-qt-mark="pre"]').length,
        post: r.querySelectorAll('[data-qt-mark="post"]').length,
      })),
      helper: window.quoteLines(b),
    };
  });
  /* ★원문은 5줄인데 ★둘이 비어 ⇒ ★3줄이어야 한다. ⛔5 면 빈 줄이 부호를 받은 것이다. */
  expect(m.rows, `★그려진 줄 = 3 (원문 5줄 중 빈 줄 2 건너뜀) · 실측 ${JSON.stringify(m.texts)}`).toBe(3);
  expect(m.texts, '★빈 줄이 빠진 그 셋').toEqual(['처음 입어도', '내 옷 같은', '핏']);
  expect(m.helper, '★quoteLines 정본도 같은 셋 — ⛔두 벌이 아니다').toEqual(m.texts);
  /* ★★불변식 — 줄 수 == 부호 쌍 수 */
  expect(m.pre, '★앞 부호 수 == 줄 수').toBe(m.rows);
  expect(m.post, '★뒤 부호 수 == 줄 수').toBe(m.rows);
  for (const [i, p] of m.perRow.entries()) {
    expect(p, `★${i}번째 줄에 부호가 ★정확히 한 쌍`).toEqual({ pre: 1, post: 1 });
  }
  /* ⛔글자가 없는 줄에 부호만 뜬 것이 ★0건 */
  expect(m.lines, '★글 줄 수 == 그려진 줄 수').toBe(m.rows);
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
      rows: b.querySelectorAll('.tb-qt-row').length,
      pre: b.querySelectorAll('[data-qt-mark="pre"]').length,
      markTxt: (b.querySelector('[data-qt-mark="pre"]') || {}).textContent || '',
      markPx: b.querySelector('.tb-qt-mark')
        ? Math.round(parseFloat(getComputedStyle(b.querySelector('.tb-qt-mark')).fontSize)) : 0,
      gapPx: b.querySelector('.tb-qt-row')
        ? Math.round(parseFloat(getComputedStyle(b.querySelector('.tb-qt-row')).columnGap)) : 0,
    };
  });
  /* ⑴＋⑵ — id 가 붙고 ★접두가 qt. ⛔`.quote-block` 이 명부에서 빠지면 ★빈 id(=빨강),
     ⛔`'qt'` 토큰이 빠지면 ★`tbl_`(=빨강). 둘을 ★한 단언이 ★같이 잡는다. */
  expect(m.id, '★★rebindAll 이 id 를 붙였다 — ⛔빈 id = 직렬화 명부에서 빠졌다').not.toBe('');
  expect(m.id.startsWith('qt_'), `★★id 접두 = qt_ (실측 「${m.id}」 · tbl_ 이면 토큰이 빠진 것)`).toBe(true);
  /* ⑶ — 다시 그려졌다 */
  expect(m.rows, '★★rebindAll 이 ★다시 그렸다 — 스택 2줄 (0 이면 재렌더 줄이 빠졌다)').toBe(2);
  expect(m.pre, '★부호도 2').toBe(2);
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
