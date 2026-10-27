/* quote-children.dom.spec.js — ★인용구 «밑»에 ★블럭을 쌓는다 (`1011t1C` · 2026-10-11 현빈 갈래 ★ㄷ)
 *
 * ★현빈 원문 ★둘:
 *   ★노트 `1011t1C`: 「★같은 우측패널 아래 ★타이포그라피 절도 ★텍스트블럭의 것과 ★달라보이는데 ★어떻게 된건지?」
 *   ★구두:         「★★안쪽에 ★텍스트 블럭처럼 ★되면되는거 ★아냐?」 ⇒ ★갈래 ★ㄷ(지디·현빈 판정)
 * ⇒ ★★★이 파일이 ★잠그는 ★참 요구 = ★★«인용구 ★안의 ★텍스트가 ★제 패널을 ★들어 ★밑줄·형광펜·점이 ★온다».
 *   ★그게 ★ㄷ 를 ★고른 ★까닭이고, ★그래서 ★★그 셋을 ★★이름으로 ★단언한다(⛔「절이 있다」로 ★닫지 않는다).
 *
 * ★★선례 = ★G19 그리드(`.grd-children` · `tests/dom/grid-children.dom.spec.js`) ＋ ★G14 서클(`.icb-children`).
 *   ★★자식 ★0개면 ★DOM 이 ★★«이전과 ★바이트 같다» — ★지키는 자가 ★공용 `replaceShellKeepChildren` 다.
 *   ★실측(★옛 저장본 ★5벌 · ⛔읽기만 · ★이 변경 전/후): ★`outerHTML` sha ★★5/5 ★동일 ⇒ ★★마이그레이션 ★불필요.
 *   ⇒ ★★그 축은 ★아래 ★`QC1` 이 ★★합성 표본으로 ★다시 잰다(⛔현빈 데이터를 ★레포에 ★박지 않는다 — ★지디 ⛔).
 *
 * ★★«안쪽 래퍼»(`.qt-inner`)는 ★★자식이 ★있을 때만 ★생긴다 — ★인용구는 ★★블럭 ★자신이 ★`display:grid` 이고
 *   ★칸이 ★정확히 ★3개라(앞부호·글·뒤부호) ★그릇을 ★그 안에 ★넣으면 ★★격자가 ★깨진다. ★`QC2` 가 ★그 축이다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/quote-children.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

/** ★합성 ★옛 저장본 — ★★키 집합은 ★실제 저장본 ★5벌에서 ★★떠낸 것이다(★글자는 ★중립으로 갈았다).
 *  ⛔현빈 ★데이터를 ★그대로 ★박지 ★않는다(★지디 ⛔) — ★★«꼴»만 ★가져왔다. */
const OLD_QUOTE = '<div class="quote-block" id="qtOld" data-type="quote" data-shape="curly" data-layout="inline"'
  + ' data-mark-size="46" data-mark-color="#C9CDD4" data-gap="14" data-pre-on="1" data-post-on="1"'
  + ' data-font-size="21" data-text-color="#1B1D22" data-weight="400" data-align="center"'
  + ' data-mark-dy="0" data-v-align="middle" data-line-height="1.5" data-text="옛 글"></div>';

async function scene(page, sid, inner) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(({ id, html }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="' + id + '"><div class="section-hitzone"></div>'
      + '<div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div>'
      + (html || '') + '</div></div>');
    window.rebindAll && window.rebindAll();
    window.applyZoom && window.applyZoom(100);
    window.deselectAll && window.deselectAll();
    window.selectSection(document.getElementById(id));
  }, { id: sid, html: inner });
  return errs;
}

/* ══════ QC1 ★★자식 ★0개면 ★★바이트가 ★안 바뀐다 (★옛 저장본 ★무변화) ══════════ */
test('QC1 ★★자식 ★0개 — ★로드가 ★DOM 을 ★★한 글자도 ★안 바꾼다 (★옛 저장본 ★무변화 · 마이그레이션 0)', async ({ page }) => {
  const errs = await scene(page, 'qcA', '<div class="row" data-layout="stack">' + OLD_QUOTE + '</div>');
  const r = await page.evaluate(() => {
    const el = document.getElementById('qtOld');
    const before = el.outerHTML;
    window.renderQuoteBlock(el);                     /* ★로드·편집·rebindAll 이 ★부르는 ★그 자 */
    const mid = el.outerHTML;
    window.renderQuoteBlock(el);                     /* ★★멱등인가 — ★협업·undo 가 ★여러 번 ★지나간다 */
    return {
      before, mid, after: el.outerHTML,
      kidsBox: el.querySelectorAll(':scope > .qt-children').length,
      inner: el.querySelectorAll(':scope > .qt-inner').length,
      childEls: el.childElementCount,
      display: getComputedStyle(el).display,
      marks: el.querySelectorAll('.tb-qt-mark').length,
      lines: [...el.querySelectorAll('.tb-qt-line')].map((e) => e.textContent),
    };
  });
  /* ★★전제 — ★그 블럭이 ★정말 ★그려졌나. ⛔0 이면 ★«안 바뀌었다»가 ★아니라 ★«안 쟀다»다 */
  expect(r.lines, `★전제 — ★옛 글이 ★그려졌다. 잰 값 ${JSON.stringify(r.lines)}`).toEqual(['옛 글']);
  expect(r.marks, '★전제 — ★부호가 ★한 쌍이다').toBe(2);
  /* ★★주 단언 ⑴ — ★★그릇도 ★래퍼도 ★★안 생긴다 */
  expect({ kidsBox: r.kidsBox, inner: r.inner, childEls: r.childEls },
    `★★자식 ★0개면 ★그릇·래퍼가 ★★0 이고 ★직계자식은 ★3(앞부호·글·뒤부호)이다. 잰 값 ${JSON.stringify(r)}`)
    .toEqual({ kidsBox: 0, inner: 0, childEls: 3 });
  /* ★★주 단언 ⑵ — ★★블럭 ★자신이 ★여전히 ★격자다(★옛 꼴) */
  expect(r.display, `★★블럭 ★자신이 ★`+'`grid`'+` 다 — ⛔흐름으로 ★바꾸지 ★않았다. 잰 값 ${r.display}`).toBe('grid');
  /* ★★주 단언 ⑶ — ★★멱등: ★두 번 ★그려도 ★같다 */
  expect(r.after === r.mid,
    `★★멱등이어야 한다 — ★협업·undo 가 ★같은 DOM 을 ★여러 번 ★지나간다. ★길이 ${r.mid.length} vs ${r.after.length}`).toBe(true);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ QC2 ★★자식을 넣으면 ★산다 ＋ ★격자가 ★안 깨진다 ＋ ★레이어에 ★뜬다 ══════ */
test('QC2 ★★인용구 «밑»에 ★텍스트를 넣는다 — ★★렌더가 ★안 지운다 · ★격자는 ★`qt-inner` 로 · ★레이어에 ★뜬다', async ({ page }) => {
  const errs = await scene(page, 'qcB', '');
  /* ★★사람이 ★하는 ★순서 — ★만들기 → ★진짜 클릭으로 ★고르기 → ★패널 → ★고르기 */
  await page.evaluate(() => {
    window.addQuoteBlock({ text: '안녕' });
    window.__q = [...document.querySelectorAll('#qcB .quote-block')].pop();
    window.buildLayerPanel && window.buildLayerPanel();
    window.deselectAll && window.deselectAll();
    if (window.__q) window.__q.dataset.pq = '1';
  });
  const r = await waitStableRect(page, '[data-pq="1"]');
  await clickAt(page, r.cx, r.cy, { sel: '[data-pq="1"]' }, { label: 'QC2 인용구 고르기' });
  await page.waitForFunction(() => !!document.getElementById('qt-shape-group'), null, { timeout: 5000 })
    .catch(() => { throw new Error('★고르기가 ★인용구 패널을 ★못 열었다'); });

  /* ★★전제 — ★★1012t1H6: 패널의 select 입구는 ★걷혔고(0개), ★입구 함수·종류 명부 정본은 ★살아 있다
     (자식을 가진 저장본이 열려야 한다 · 이 검사는 함수를 ★직접 부른다) */
  const pre = await page.evaluate(() => ({
    sel: document.querySelectorAll('#qt-kid-add-kind').length,
    roster: window.QUOTE_CHILD_KINDS || null,
    fn: typeof window.addQuoteChild,
    box: window.quoteKidsBox ? (window.quoteKidsBox(window.__q) ? 1 : 0) : '(window 에 없다)',
  }));
  expect(pre.sel, `★전제 ㉠ — ★패널에 「＋ 블럭 넣기」 칸이 ★0개다(1012t1H6). 잰 값 ${pre.sel}`).toBe(0);
  expect(pre.roster, '★전제 ㉡ — ★종류 ★정본(`QUOTE_CHILD_KINDS`)이 ★`window` 에 ★있다').not.toBeNull();
  expect(pre.fn, '★전제 ㉢ — ★`window.addQuoteChild` 가 ★살아 있다').toBe('function');
  expect(pre.box, '★전제 ㉣ — ★아직 ★그릇이 ★없다').toBe(0);

  /* ★★입구 함수를 ★직접 ★부른다(window 판 = 삽입 래퍼가 감싼 것) */
  await page.evaluate(() => window.addQuoteChild(window.__q, 'body'));
  await page.waitForFunction(() => (window.quoteKids?.(window.__q) || []).length === 1, null, { timeout: 5000 })
    .catch(() => { throw new Error('★「＋ 텍스트」가 ★자식을 ★넣지 못했다 — ★`addQuoteChild` 배선을 보라'); });

  const after = await page.evaluate(() => {
    const q = window.__q;
    const kids = window.quoteKids(q);
    const kid = kids[0];
    return {
      kidsN: kids.length,
      kidIsTextFrame: kid?.dataset.textFrame === 'true',
      hasTextBlock: !!kid?.querySelector('.text-block'),
      inner: q.querySelectorAll(':scope > .qt-inner').length,
      box: q.querySelectorAll(':scope > .qt-children').length,
      blockDisplay: getComputedStyle(q).display,
      innerDisplay: (() => { const i = q.querySelector(':scope > .qt-inner'); return i ? getComputedStyle(i).display : null; })(),
      innerCols: (() => { const i = q.querySelector(':scope > .qt-inner'); return i ? getComputedStyle(i).gridTemplateColumns.split(' ').length : null; })(),
      marks: q.querySelectorAll('.tb-qt-mark').length,
      lines: [...q.querySelectorAll('.tb-qt-line')].map((e) => e.textContent),
      /* ★★레이어에 ★뜨나 — ★표 한 자리(`LAYER_KIDS_BOX_BY_CLASS`)가 ★인용구를 ★들어야 한다 */
      layerKidRows: document.querySelectorAll('#layer-panel .layer-row-children .layer-item, #panel-left .layer-row-children .layer-item').length,
    };
  });
  console.log('★QC2 잰 것 = ' + JSON.stringify(after));

  /* ★★주 단언 ⑴ — ★★자식이 ★살아 있다(★렌더가 ★안 지웠다) */
  expect(after.kidsN, `★★자식이 ★1개 ★살아 있어야 한다 — ★`+'`renderQuoteBlock`'+`이 ★`+'`innerHTML=\'\'`'+`로 ★지우던 ★그 병이다. 잰 값 ${after.kidsN}`).toBe(1);
  /* ★★주 단언 ⑵ — ★★글자 블럭은 ★★글자 래퍼(text-frame)째 ★온다(★G19 ★K1 과 ★같은 계약) */
  expect(after.kidIsTextFrame, `★★글자 블럭은 ★★text-frame 째 ★들어온다(★그래야 ★텍스트 패널 길을 ★그대로 탄다). 잰 값 ${after.kidIsTextFrame}`).toBe(true);
  expect(after.hasTextBlock, '★그 안에 ★`.text-block` 이 ★있다').toBe(true);
  /* ★★주 단언 ⑶ — ★★격자가 ★`qt-inner` 로 ★내려갔고 ★칸은 ★★여전히 ★3개다 */
  expect({ inner: after.inner, box: after.box, blockDisplay: after.blockDisplay, innerDisplay: after.innerDisplay },
    `★★자식이 ★있으면 ★블럭은 ★흐름 · ★격자는 ★`+'`qt-inner`'+` 다. 잰 값 ${JSON.stringify(after)}`)
    .toEqual({ inner: 1, box: 1, blockDisplay: 'block', innerDisplay: 'grid' });
  expect(after.innerCols,
    `★★격자 칸이 ★★3개 그대로다 — ⛔그릇이 ★격자에 ★네 번째 칸으로 ★끼면 ★칸이 ★어긋난다. 잰 값 ${after.innerCols}`).toBe(3);
  /* ★★음성대조 — ★부호와 ★글은 ★★그대로다(⛔자식을 넣느라 ★본문을 ★잃지 ★않았다) */
  expect({ marks: after.marks, lines: after.lines },
    `★★★음성대조 — ★부호 ★한 쌍과 ★글이 ★그대로여야 한다. 잰 값 ${JSON.stringify(after)}`)
    .toEqual({ marks: 2, lines: ['안녕'] });
  /* ★★레이어 — ★자식 줄이 ★뜬다 */
  expect(after.layerKidRows >= 1,
    `★★레이어 패널에 ★자식 줄이 ★떠야 한다(★표 `+'`LAYER_KIDS_BOX_BY_CLASS`'+` 가 ★인용구를 ★든다). 잰 값 ${after.layerKidRows}`).toBe(true);

  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ QC3 ★★★ㄷ 를 고른 ★까닭 — ★안의 ★텍스트가 ★밑줄·형광펜·점을 ★들고 온다 ══════ */
test('QC3 ★★★인용구 ★안의 ★텍스트를 고르면 ★★밑줄(U)·형광펜(H)·점이 ★온다 — ★★ㄷ 를 고른 ★까닭 (현빈)', async ({ page }) => {
  const errs = await scene(page, 'qcC', '');
  await page.evaluate(() => {
    window.addQuoteBlock({ text: '안녕' });
    window.__q = [...document.querySelectorAll('#qcC .quote-block')].pop();
    window.buildLayerPanel && window.buildLayerPanel();
    window.deselectAll && window.deselectAll();
    window.__q.dataset.pq = '1';
  });
  const r = await waitStableRect(page, '[data-pq="1"]');
  await clickAt(page, r.cx, r.cy, { sel: '[data-pq="1"]' }, { label: 'QC3 인용구 고르기' });
  await page.waitForFunction(() => !!document.getElementById('qt-shape-group'), null, { timeout: 5000 });

  /* ★★전제 — ★★인용구 ★제 패널엔 ★그 셋이 ★★없다(★`Q18` 이 ★그것을 ★이름으로 잠근다) */
  const qPanel = await page.evaluate(() => ({
    u: document.querySelectorAll('#qt-typo-underline-btn').length,
    h: document.querySelectorAll('#qt-typo-highlight-btn').length,
    d: document.querySelectorAll('#qt-typo-dot-btn').length,
  }));
  /* ⚰️1012t1H5 현빈 「[B I S] 이것도 왜이리 적니?」 — 이제 인용구 제 패널에도 U·H·점이 «블럭 전체»용으로 선다(Q18 이 14칸으로 잠근다).
     ⇒ 옛 전제 «0 이다»는 뒤집혔다. 이 시험의 주 단언(안의 텍스트가 «부분 서식»용 U·H·점을 들고 온다)은 그대로 남는다. */
  expect(qPanel, `★인용구 제 패널의 U·H·점(1012t1H5 뒤 = 1씩). 잰 값 ${JSON.stringify(qPanel)}`)
    .toEqual({ u: 1, h: 1, d: 1 });

  await page.evaluate(() => window.addQuoteChild(window.__q, 'body'));   /* 1012t1H6: select 입구 걷힘 → 같은 window 판 함수 */
  await page.waitForFunction(() => (window.quoteKids?.(window.__q) || []).length === 1, null, { timeout: 5000 });
  /* ★★넣으면 ★새 블럭이 ★★스스로 골라진다 — ★삽입 래퍼(`js/insert-select.js`)가 ★그 일을 한다.
     ⇒ ★그 래퍼가 ★★`addQuoteChild` 를 ★감싸는지도 ★★이 줄이 ★같이 잰다(★로스터 `EXTRA`). */
  await page.waitForFunction(() => !!document.querySelector('#qcC .qt-children .text-block.selected'), null, { timeout: 5000 })
    .catch(() => { throw new Error('★넣은 ★텍스트가 ★스스로 ★골라지지 ★않았다 — ★`insert-history.js` 의 ★`EXTRA` 로스터를 보라'); });

  const tPanel = await page.evaluate(() => ({
    u: document.querySelectorAll('#txt-underline-btn').length,
    h: document.querySelectorAll('#txt-highlight-btn').length,
    d: document.querySelectorAll('#txt-dot-btn').length,
    titles: [...document.querySelectorAll('#panel-right .prop-section-title')].map((e) => e.textContent.trim()),
    selectedIsKid: !!document.querySelector('#qcC .qt-children .text-block.selected'),
  }));
  console.log('★QC3 잰 것 = ' + JSON.stringify(tPanel));

  /* ★★★주 단언 — ★그 셋이 ★★온다. ★★이게 ★`1011t1C` ★ㄷ 의 ★전부다 */
  expect({ u: tPanel.u, h: tPanel.h, d: tPanel.d },
    `★★★인용구 ★안의 ★텍스트를 고르면 ★★밑줄(U)·형광펜(H)·점이 ★★«다시 만들 것 없이» ★와야 한다 —`
    + ` ★그게 ★현빈이 ★ㄷ 를 ★고른 ★까닭이다. 잰 값 ${JSON.stringify(tPanel)}`).toEqual({ u: 1, h: 1, d: 1 });
  expect(tPanel.selectedIsKid, '★고른 것이 ★그 자식 텍스트다').toBe(true);
  expect(tPanel.titles.includes('Typography'),
    `★그 패널에 ★Typography 절이 ★있다. 잰 제목 ${JSON.stringify(tPanel.titles)}`).toBe(true);

  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});
