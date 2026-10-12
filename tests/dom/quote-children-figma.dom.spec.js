/* quote-children-figma.dom.spec.js — ★인용구 «밑» 자식이 ★★내보내기에 ★«블럭으로 한 번씩» 나간다 (`1011t1C`)
 *
 * ★★★왜 ★이 파일이 ★필요한가 — ★★«캔버스에선 ★보이는데 ★내보내면 ★사라진다»는 ★★사용자가 ★겪는 ★손실이다.
 *   ★실측(★고치기 전 판 `d898edef`): ★`js/io/export-figma-json.js` 에 ★`quote` ★★0건
 *     ⇒ ★인용구는 ★★GENERIC 폴백으로 ★나가고, ★자식 글자는 ★그 폴백의 ★`[class^="tb-"]` 수집에 ★★섞인다
 *     ⇒ ★★★자식이 ★«블럭»으로는 ★안 나가고 ★글자만 ★껍데기 (0,0)에 ★찍힌다
 *   ⇒ ★G19 가 ★★같은 병을 ★이미 겪었다 — ★`tests/dom/grid-children-figma.dom.spec.js` 의 ★★측정 ★M2 다.
 *     ★★그 파일이 ★적어 뒀다: 「⛔둘 중 하나만 하면 ★글자가 ★«두 번» 나가거나 ★«안» 나간다」
 *   ⇒ ★★★그래서 ★★이 파일도 ★★그 한 쌍을 ★같이 잰다(★한 번만 ★나가나 ＋ ★에셋이 ★빠지지 않나).
 *
 * ★★★그리고 ★★표가 ★★둘이다 — ★`export-figma-json.js` 의 ★`KIDS_SHELL_BY_CLASS` ＋
 *   ★`js/panels/layer-panel-items.js` 의 ★`LAYER_KIDS_BOX_BY_CLASS`. ★★합치지 ★못한 ★까닭은 ★앞 표의 ★머리말에 있다.
 *   ⇒ ★★그 둘이 ★갈리면 ★★이 파일과 ★`quote-children.dom.spec.js` 가 ★★같이 ★빨개져야 한다(★그게 ★그 겹의 ★자다).
 *
 * ★하네스 = ★`_root-harness bootApp`. ★`buildFigmaExportJSON` 은 ★`state.pages[].canvas` ★★직렬본을 읽는다
 *   (★선례 파일과 ★같은 수법 — ⛔제 수법을 ★만들지 ★않았다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/quote-children-figma.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sQF" data-section="1" data-name="QF"><div class="section-hitzone"></div><div class="section-inner">
<div class="row" id="rQ"><div class="quote-block" id="qQ" data-type="quote" data-shape="curly" data-layout="inline"
 data-mark-size="46" data-mark-color="#C9CDD4" data-gap="14" data-pre-on="1" data-post-on="1"
 data-font-size="21" data-text-color="#1B1D22" data-weight="400" data-align="center"
 data-mark-dy="0" data-v-align="middle" data-line-height="1.5" data-text="인용구 본문"></div></div>
<div class="gap-block" data-type="gap" id="gQEnd" style="height:100px"></div></div></div>`;

const KID_TEXT = 'QT-CHILD-TEXT-XYZ';

async function setup(page, withKids) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(({ h, withKids, kidText }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    window.rebindAll && window.rebindAll();
    window.deselectAll && window.deselectAll();
    window.renderQuoteBlock(document.getElementById('qQ'));
    if (withKids) {
      /* ★앱 입구로 — ⛔손으로 ★DOM 을 ★짓지 ★않는다(★선례 파일과 ★같은 꼴) */
      const t = window.addQuoteChild('qQ', 'body');
      const tc = t.block.querySelector('.tb-body');
      tc.textContent = kidText;
      delete tc.dataset.isPlaceholder;
      window.addQuoteChild('qQ', 'image');
    }
  }, { h: SEC, withKids, kidText: KID_TEXT });
  return errs;
}

const exportJson = (page) => page.evaluate(async () => {
  const ps = { bg: '#eeeeee', padX: 0 };
  const { state } = await import('/js/globals.js');
  state.pages = [{ canvas: document.getElementById('canvas').innerHTML, pageSettings: ps }];
  state.pageSettings = ps;
  const json = window.buildFigmaExportJSON(null);
  const box = document.querySelector('#qQ > .qt-children');
  const inner = document.querySelector('#qQ > .qt-inner');
  return {
    json, flat: JSON.stringify(json),
    assetId: box?.querySelector('.asset-block')?.id || null,
    innerH: inner ? inner.offsetHeight : null,
    quoteH: document.getElementById('qQ').offsetHeight,
    boxN: box ? 1 : 0,
  };
});

/** ★모든 블럭을 ★한 줄로 — ★프레임 안·떠 있는 것까지. */
const flatBlocks = (json) => {
  const out = [];
  const walk = (b) => {
    if (!b || typeof b !== 'object') return;
    out.push(b);
    (b.children || []).forEach((c) => walk(c.block || c));
  };
  (json.sections || []).forEach((s) => (s.blocks || []).forEach((b) => walk(b.block || b)));
  return out;
};

/* ══════ QF1 ★자식 글자는 ★★«정확히 ★한 번» — ★그것도 ★`type:'text'` 블럭으로 ══════ */
test('QF1 ★★인용구 ★자식 글자가 ★★«정확히 ★한 번» ★나간다 — ★`type:text` 블럭으로(★껍데기 texts 엔 ★없다)', async ({ page }) => {
  const errs = await setup(page, true);
  const r = await exportJson(page);
  /* ★★전제 — ★장면이 ★섰나. ⛔0 이면 ★«안 나갔다»가 아니라 ★«안 쟀다»다 */
  expect(r.boxN, `★전제 ㉠ — ★그릇이 ★섰다. 잰 값 ${r.boxN}`).toBe(1);
  expect(r.assetId, '★전제 ㉡ — ★에셋 자식의 ★id 를 ★잡았다').not.toBeNull();
  expect(r.json && Array.isArray(r.json.sections) && r.json.sections.length >= 1,
    `★전제 ㉢ — ★JSON 에 ★섹션이 ★있다. 잰 꼴 ${typeof r.json}`).toBe(true);

  /* ★★주 단언 ⑴ — ★그 글자가 ★★JSON 전체에서 ★★정확히 ★한 번 */
  const hits = (r.flat.match(new RegExp(KID_TEXT, 'g')) || []).length;
  expect(hits,
    `★★자식 글자가 ★★JSON 전체에서 ★★정확히 ★한 번 ★나와야 한다 —`
    + ` ★★두 번이면 ★껍데기에도 ★섞였고(★G19 의 ★M2 꼴), ★0이면 ★★아예 ★안 나갔다. 잰 값 ${hits}`).toBe(1);
  /* ★★주 단언 ⑵ — ★그 ★한 번이 ★★`type:'text'` ★블럭이다(⛔껍데기의 ★`texts` 가 ★아니다) */
  const blocks = flatBlocks(r.json);
  /* ⚠️★필드 이름은 ★`content` 다 — ★`text` 가 ★아니다(★실측: `export-figma-json.js` 의 ★`type:'text'` 정의 자리).
     ★★내가 ★처음 ★`b.text` 로 ★썼고 ★★그래서 ★★거짓 빨강이 ★났다 ⇒ ★★정의 자리를 ★읽어 ★고쳤다.
     ★두 꼴을 ★같이 본다 — ★`:777` 의 ★비교표 칸은 ★`text` 를 ★쓴다(★한 파일에 ★두 꼴이다). */
  const textOf = (b) => String(b.content ?? b.text ?? '');
  const textBlock = blocks.find((b) => b.type === 'text' && textOf(b).includes(KID_TEXT));
  expect(!!textBlock,
    `★★그 ★한 번이 ★★`+'`type:text`'+` ★블럭이어야 한다. 잰 블럭 종류 ${JSON.stringify(blocks.map((b) => b.type))}`
    + ` · 잰 글 ${JSON.stringify(blocks.map(textOf))}`).toBe(true);
  /* ★★주 단언 ⑶ — ★★껍데기(GENERIC)의 ★`texts` 에는 ★★없다 */
  const shell = blocks.find((b) => b.id === 'qQ');
  const inShellTexts = JSON.stringify((shell && shell.texts) || []).includes(KID_TEXT);
  expect(inShellTexts,
    `★★★껍데기의 ★`+'`texts`'+` 에는 ★★없어야 한다(⛔있으면 ★(0,0)에 ★한 번 ★더 찍힌다).`
    + ` 잰 껍데기 ${JSON.stringify(shell && shell.texts)}`).toBe(false);
  /* ★★주 단언 ⑷ — ★★껍데기 높이 = ★★«안쪽 래퍼» 높이(⛔상자 높이가 ★아니다 — ★자식이 ★들어 있다) */
  expect(shell && shell.height, `★★껍데기 높이는 ★`+'`.qt-inner`'+` 높이(${r.innerH})여야 한다 —`
    + ` ⛔상자 높이(${r.quoteH})를 ★쓰면 ★Figma 에서 ★자식이 ★두 번 ★쌓인다. 잰 값 ${shell && shell.height}`).toBe(r.innerH);

  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ QF2 ★에셋 자식이 ★빠지지 ★않는다 ══════════════════════════════════ */
test('QF2 ★★에셋 자식이 ★빠지지 ★않는다 — ★그 id 의 ★`type:image` 블럭이 ★인용구 ★뒤에 ★온다', async ({ page }) => {
  const errs = await setup(page, true);
  const r = await exportJson(page);
  const blocks = flatBlocks(r.json);
  const ids = blocks.map((b) => b.id || '');
  const iQuote = ids.indexOf('qQ');
  const iAsset = ids.indexOf(r.assetId);
  console.log('★QF2 잰 것 = ' + JSON.stringify({ assetId: r.assetId, ids, types: blocks.map((b) => b.type) }));
  expect(iQuote >= 0, `★전제 — ★인용구 껍데기가 ★JSON 에 ★있다. 잰 id ${JSON.stringify(ids)}`).toBe(true);
  expect(iAsset >= 0,
    `★★에셋 자식(${r.assetId})이 ★★블럭으로 ★나가야 한다 — ⛔빠지면 ★사용자가 ★그림을 ★잃는다. 잰 id ${JSON.stringify(ids)}`).toBe(true);
  expect(iAsset > iQuote,
    `★★에셋 자식은 ★인용구 ★«뒤»에 ★와야 한다(★흐름 순서). 잰 자리 인용구 ${iQuote} · 에셋 ${iAsset}`).toBe(true);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ QF0 ★★지키는 시험 — ★자식 ★0개면 ★★옛 출력과 ★같다 ══════════════ */
test('QF0 ★★지키는 시험 — ★자식 ★0개 인용구: ★껍데기 높이 = ★상자 높이 · ★그릇 ★0 (★옛 출력 ★그대로)', async ({ page }) => {
  const errs = await setup(page, false);
  const r = await exportJson(page);
  expect(r.boxN, '★전제 — ★그릇이 ★없다').toBe(0);
  expect(r.innerH, '★전제 — ★안쪽 래퍼도 ★없다').toBeNull();
  const blocks = flatBlocks(r.json);
  const shell = blocks.find((b) => b.id === 'qQ');
  expect(!!shell, `★인용구가 ★JSON 에 ★있다. 잰 id ${JSON.stringify(blocks.map((b) => b.id))}`).toBe(true);
  /* ★★자식이 ★없으면 ★★껍데기 높이 = ★상자 높이 — ★★«옛 출력과 ★같다»의 ★그 축이다 */
  expect(shell.height,
    `★★자식 ★0개면 ★껍데기 높이 = ★상자 높이(${r.quoteH}) 다 — ★★옛 출력 ★그대로. 잰 값 ${shell.height}`).toBe(r.quoteH);
  /* ★★음성대조 — ★본문 글자는 ★★여전히 ★껍데기에 ★있다(⛔내 변경이 ★본문을 ★끄지 ★않았다) */
  expect(JSON.stringify(shell.texts || []).includes('인용구 본문'),
    `★★★음성대조 — ★인용구 ★본문은 ★★여전히 ★껍데기에 ★실린다. 잰 값 ${JSON.stringify(shell.texts)}`).toBe(true);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});

/* ══════ QF3 ★★조건 ⑷ — ★PNG·HTML 은 ★«캔버스 클론» 길이다. ★자식이 ★클론에 ★드나 ══════ */
test('QF3 ★★PNG·HTML 길 — ★자식이 ★★«캔버스 클론»에 ★든다 (★내보내기 ★두 길의 ★나머지)', async ({ page }) => {
  const errs = await setup(page, true);
  const r = await page.evaluate((kidText) => {
    /* ★PNG·HTML 은 ★캔버스를 ★★클론해 ★찍는다 — ★그 길의 ★참값은 ★★«클론에 ★그 글자가 ★드나»다.
       ⛔내보내기 함수를 ★★부르지 ★않는다(★파일을 ★쓴다) — ★★그 길이 ★읽는 ★것과 ★같은 것을 ★잰다. */
    const canvas = document.getElementById('canvas');
    const clone = canvas.cloneNode(true);
    const q = clone.querySelector('#qQ');
    return {
      cloneHasKid: (clone.textContent || '').includes(kidText),
      cloneBox: q ? q.querySelectorAll(':scope > .qt-children').length : -1,
      cloneInner: q ? q.querySelectorAll(':scope > .qt-inner').length : -1,
      cloneKidEls: q ? q.querySelectorAll(':scope > .qt-children > *').length : -1,
      liveHasKid: (canvas.textContent || '').includes(kidText),
    };
  }, KID_TEXT);
  console.log('★QF3 잰 것 = ' + JSON.stringify(r));
  expect(r.liveHasKid, '★전제 — ★살아 있는 캔버스에 ★그 글자가 ★있다').toBe(true);
  expect(r.cloneHasKid,
    `★★★클론에도 ★그 글자가 ★있어야 한다 — ★PNG·HTML 은 ★클론을 ★찍는다. 잰 값 ${JSON.stringify(r)}`).toBe(true);
  expect({ box: r.cloneBox, inner: r.cloneInner },
    `★★클론에 ★그릇과 ★래퍼가 ★★그대로 ★있다. 잰 값 ${JSON.stringify(r)}`).toEqual({ box: 1, inner: 1 });
  expect(r.cloneKidEls >= 2,
    `★★클론의 ★그릇에 ★자식이 ★★둘(★글자 ＋ ★에셋) ★있다. 잰 값 ${r.cloneKidEls}`).toBe(true);
  expect(errs.map((e) => String(e)), '★오류 0').toEqual([]);
});
