/* multisel-sole-block-panel.dom.spec.js — T-091 「⇧클릭이 «범위»를 못 만들면
 * 선택은 «한 개»인데 우측 패널이 «Page» 로 남는다」
 *
 * ★실측 재현 (2026-09-24 · 판 7780267 · 격리앱 포트 9342 · 프로필 <워크트리>/_ud · 줌 100%)
 *   패널은 `#panel-right .panel-body` 의 `.prop-block-name` 으로 읽었다.
 *     ① A 평범 클릭                → 1개 · 「Text Block」  ✅
 *     ② A 를 ⇧클릭(같은 블럭)      → 1개 · 「Page」        ❌
 *     ③ 아래 블럭을 ⇧클릭(범위 성립) → 4개 · 「4개 선택됨」 ✅
 *     ④ 앵커 없이 A 를 ⇧클릭       → 1개 · 「Page」        ❌
 *   ★카드에 적힌 「종류가 다른 블럭」은 «틀린 조건»이었다. 같은 블럭 하나로도 난다.
 *     참 조건은 «범위가 폭 1 로 오그라든다»(②) 와 «앵커가 없다»(④) 둘이다.
 *   ★같은 증상이 타입을 안 가렸다 — 이미지 ⇧클릭도, 도형 ⇧클릭도 「Page」였고,
 *     ⌘클릭으로 둘 → 하나로 줄이면 패널이 「2개 선택됨」으로 굳었다.
 *
 * ★뿌리 — rangeSelectBlocks 는 세 갈래 모두 deselectAll() 로 «패널까지» 비우고 한 개만 다시
 *   고른다. 그 뒤 오는 _updateMultiSelPanel 은 n<=1 에서 «아무 일도 안 했다» ⇒ 빈 패널이 남는다.
 *
 * ★수리 자리 — 호출부(rangeSelectBlocks 29곳)가 «아니라» 패널을 정하는 한 자리.
 *   타입별 표는 새로 짓지 않는다. js/panel-dispatch.js 의 정본 표(openPanelForBlock /
 *   hasPanelForBlock)를 그대로 읽는다 ⇒ 이 검사도 «그 진짜 파일»을 harness 에 얹어 돌린다.
 *
 * ⛔앱을 «안» 띄운다 — 진짜 소스에서 그 함수들을 떠내 실행한다(선례: multisel-mixed-kind).
 * 실행: npx playwright test tests/dom/multisel-sole-block-panel.dom.spec.js --config=tests/dom/playwright.dom.config.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const EDITOR_SRC   = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8');
const DISPATCH_SRC = fs.readFileSync(path.join(REPO, 'js/panel-dispatch.js'), 'utf8');

/* ── 소스에서 «원문»을 떠오는 자리들 — 손으로 베껴 적지 않는다(베끼면 소스가 바뀌어도 초록이다) ── */
function sliceBraces(src, from) {
  let i = src.indexOf('{', from);
  if (i < 0) throw new Error('여는 중괄호를 못 찾았다');
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) return src.slice(src.indexOf('{', from) + 1, i); }
  }
  throw new Error('닫는 중괄호를 못 찾았다');
}
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  return 'function ' + name + '(' + src.slice(src.indexOf('(', m.index) + 1, src.indexOf(')', m.index)) + ') {'
    + sliceBraces(src, src.indexOf(')', m.index)) + '}';
}
/** `const NAME = …;` 한 문장 «통째로». ⚠️값에 세미콜론이 없다는 전제(셋 다 셀렉터 목록이다). */
function declStmt(src, name) {
  const at = src.indexOf(`const ${name} = `);
  if (at < 0) throw new Error(`선언을 못 찾았다: ${name}`);
  const end = src.indexOf(';', at);
  if (end < 0) throw new Error(`선언의 끝을 못 찾았다: ${name}`);
  return src.slice(at, end + 1);
}

const PARTS = [
  declStmt(EDITOR_SRC, 'SECTION_BLOCK_TYPE_SEL'),
  declStmt(EDITOR_SRC, 'FLOW_BLOCK_SEL_SELECTED'),
  declStmt(EDITOR_SRC, 'SIBLING_MULTI_SEL'),
  extractFn(EDITOR_SRC, '_isInFreeLayout'),
  extractFn(EDITOR_SRC, '_isFlowMultiSelUnit'),
  extractFn(EDITOR_SRC, '_countFlowMultiSel'),
  extractFn(EDITOR_SRC, '_restoreFreeLayoutFrameSelected'),
  extractFn(EDITOR_SRC, '_updateFreeLayoutMultiSelPanel'),
  extractFn(EDITOR_SRC, '_updateMultiSelPanel'),
  extractFn(EDITOR_SRC, '_getBlockLayerItem'),
  extractFn(EDITOR_SRC, '_toSibling'),
  extractFn(EDITOR_SRC, '_selectSibling'),
  extractFn(EDITOR_SRC, 'rangeSelectBlocks'),
  extractFn(EDITOR_SRC, 'toggleBlockSelect'),
];
/* ★_openSoleBlockPanel 은 «고친 뒤에만» 있는 함수다. 없으면 «빈 자리»로 둔다 —
   그래야 고치기 «전» 소스에서도 harness 가 서지 않고 «검사가 빨개진다»(양성대조). */
const HAS_SOLE = /function\s+_openSoleBlockPanel\s*\(/.test(EDITOR_SRC);
if (HAS_SOLE) PARTS.push(extractFn(EDITOR_SRC, '_openSoleBlockPanel'));

/* 떠온 조각들을 «한 스코프»에 세운다. _lastClickedBlock(앵커)은 여기 산다. */
const BUILD = `
  const canvasEl = document.getElementById('canvas');
  const propPanel = document.getElementById('propPanel');
  let _lastClickedBlock = null;
  ${HAS_SOLE ? '' : 'function _openSoleBlockPanel() { return false; }'}
  ${PARTS.join('\n')}
  window.deselectAll = () => {                       /* 정본과 같은 «두 가지»만 한다 */
    canvasEl.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    _lastClickedBlock = null;                        /* js/editor.js deselectAll */
  };
  window.syncSection = () => {};
  return {
    range:  (id, secId) => rangeSelectBlocks(document.getElementById(id), document.getElementById(secId)),
    toggle: (id, secId) => toggleBlockSelect(document.getElementById(id), document.getElementById(secId)),
    setAnchor: (id) => { _lastClickedBlock = id ? document.getElementById(id) : null; },
    getAnchor: () => _lastClickedBlock && _lastClickedBlock.id,
  };
`;

/* 실앱과 «같은 골격» — ⇧클릭의 단위는 section-inner 의 직속 자식들이다.
   (실측 트리: section-inner > [gap, frame[tf] > text, frame[tf] > text, asset, frame[free] > shape]) */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
  <div id="canvas">
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1">
        <div class="frame-block" data-text-frame="true" id="tfA"><div class="text-block" id="tbA">AAA</div></div>
        <div class="frame-block" data-text-frame="true" id="tfB"><div class="text-block" id="tbB">BBB</div></div>
        <div class="asset-block" id="img1"></div>
        <div class="frame-block" data-free-layout="true" id="shpWrap">
          <div class="shape-block" id="shp1" style="position:absolute;left:0;top:0"></div>
        </div>
        <!-- 표에 «없는» 타입의 대표 — 그룹 프레임(컨테이너). 일부러 표에 안 넣은 것이다.
             ★안에 글자를 하나 둔다 — 「부모가 달라 Path 2 로 떨어지는」 갈래를 재려면 필요하다. -->
        <div class="frame-block" data-group="true" id="grp1">
          <div class="frame-block" data-text-frame="true" id="tfC"><div class="text-block" id="tbC">CCC</div></div>
        </div>
      </div>
    </div>
  </div>
  <div id="propPanel"></div>
  <script>window.__ready = true;</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS }));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  /* ★패널 표는 «진짜 파일»을 얹는다 — 사본을 만들면 표가 갈라진다(T-079 가 그 병이었다). */
  await page.addScriptTag({ content: DISPATCH_SRC });
  await page.evaluate(() => {
    /* 표가 부르는 패널 함수들을 «기록»으로 바꾼다. 이름이 아니라 «무엇이 불렸나»를 잰다. */
    window.__calls = [];
    for (const k of ['showTextProperties', 'showAssetProperties', 'showShapeProperties', 'showFrameProperties']) {
      window[k] = (el) => window.__calls.push(k + '#' + (el && el.id));
    }
    window.showFlowMultiSelPanel = () => window.__calls.push('multi');
    window.hasFreeLayoutMultiSel = () => false;   // 실측: 한 개만 골라진 판이라 false
  });
  const api = await page.evaluateHandle((src) => new Function(src)(), BUILD);
  return { errs, api };
}
/** 조작 한 번 — «기록을 비우고» 부르고, setTimeout(…,0) 이 돌 틈을 준다. */
async function act(page, api, fn) {
  await page.evaluate(() => { window.__calls = []; });
  await page.evaluate(([h, f]) => h[f.op](f.a, f.b), [api, fn]);
  await page.waitForTimeout(20);
  return page.evaluate(() => ({
    calls: window.__calls.slice(),
    selected: [...document.querySelectorAll('#canvas .selected')].map(e => e.id),
    panelHTML: document.getElementById('propPanel').innerHTML,
  }));
}

test('② ⇧클릭이 «같은 블럭»이라 범위가 폭1 로 오그라들어도 그 블럭 패널이 뜬다', async ({ page }) => {
  const { errs, api } = await boot(page);
  await page.evaluate((h) => h.setAnchor('tbA'), api);         // ① 평범 클릭이 남긴 앵커
  const r = await act(page, api, { op: 'range', a: 'tbA', b: 'sec1' });
  expect(r.selected, '선택이 그 글자 하나로 안 끝났다').toEqual(['sec1', 'tbA'].filter(id => r.selected.includes(id)));
  expect(r.selected).toContain('tbA');
  expect(r.calls, '선택은 1개인데 아무 패널도 안 열렸다 — 직전 deselectAll 이 띄운 «Page» 가 남는다')
    .toEqual(['showTextProperties#tbA']);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('④ 앵커가 «없어도» — 선택도 생기고(기능 유지) 그 블럭 패널도 뜬다', async ({ page }) => {
  const { errs, api } = await boot(page);
  await page.evaluate((h) => h.setAnchor(null), api);          // 빈 캔버스 클릭이 앵커를 지운 뒤
  const r = await act(page, api, { op: 'range', a: 'tbA', b: 'sec1' });
  /* ★「범위를 못 만들면 아무것도 안 하고 돌아간다」로 고치면 여기가 깨진다 —
       실측(포트 9342): ④ 직전 selected=[] → 직후 [sec, tbA]. 그 폴백이 «유일한» 선택 경로다. */
  expect(r.selected, '앵커가 없다고 선택조차 안 됐다 — 기능이 줄었다').toContain('tbA');
  expect(r.calls, '④ 에서 패널이 안 열렸다').toEqual(['showTextProperties#tbA']);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('③ 회귀 — 범위가 «성립»하면 종전대로 멀티선택 패널이다(블럭 패널이 끼어들면 안 된다)', async ({ page }) => {
  const { errs, api } = await boot(page);
  await page.evaluate((h) => h.setAnchor('tbA'), api);
  const r = await act(page, api, { op: 'range', a: 'img1', b: 'sec1' });
  expect(r.selected, '범위가 안 잡혔다').toEqual(expect.arrayContaining(['tbA', 'tbB', 'img1']));
  expect(r.calls, '범위가 성립했는데 단일 블럭 패널로 샜다').toEqual(['multi']);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('⑥ 타입을 안 가린다 — 이미지 ⇧클릭(같은 블럭)은 Asset 패널이다', async ({ page }) => {
  const { api } = await boot(page);
  await page.evaluate((h) => h.setAnchor('img1'), api);
  const r = await act(page, api, { op: 'range', a: 'img1', b: 'sec1' });
  expect(r.calls, '표를 안 읽고 «글자 패널»로 떨어지면 조용한 데이터 손실이다(T-079)')
    .toEqual(['showAssetProperties#img1']);
});

test('⑧ 자유배치도 같다 — 도형 ⇧클릭(같은 블럭)은 도형 패널이다', async ({ page }) => {
  const { api } = await boot(page);
  await page.evaluate((h) => h.setAnchor('shp1'), api);       // 실측 ⑦→⑧ 과 같은 차례
  const r = await act(page, api, { op: 'range', a: 'shp1', b: 'sec1' });
  /* 도형은 래퍼(.frame-block)와 알맹이(.shape-block)가 «한 몸»으로 켜진다.
     래퍼는 표에 없어서 저절로 빠지고 «한 블럭»이 남는다 — 그게 hasPanelForBlock 으로 세는 이유다. */
  expect(r.calls).toEqual(['showShapeProperties#shp1']);
});

test('⑩ ⌘클릭으로 둘 → 하나로 줄여도 패널이 «2개 선택됨» 으로 굳지 않는다', async ({ page }) => {
  const { api } = await boot(page);
  await page.evaluate((h) => { h.toggle('tbA', 'sec1'); h.toggle('img1', 'sec1'); }, api);
  await page.waitForTimeout(20);
  const r = await act(page, api, { op: 'toggle', a: 'img1', b: 'sec1' });
  expect(r.selected, '하나만 남지 않았다').toEqual(['tbA']);
  expect(r.calls, '선택은 하나인데 「2개 선택됨」이 그대로 남는다').toEqual(['showTextProperties#tbA']);
});

test('폴백 규약 — 표에 «없는» 타입이면 패널을 안 건드린다(엉뚱한 패널보다 «그대로»가 낫다)', async ({ page }) => {
  const { api } = await boot(page);
  await page.evaluate((h) => h.setAnchor('grp1'), api);
  const r = await act(page, api, { op: 'range', a: 'grp1', b: 'sec1' });
  expect(r.selected, '그룹 프레임이 안 골라졌다').toContain('grp1');
  expect(r.calls, '표에 없는 타입인데 아무 패널이나 열었다 — 엉뚱한 패널의 값이 «실제로 먹는다»')
    .toEqual([]);
});

test('음성대조 — 정본 표(openPanelForBlock)를 «부수면» ② 가 빨개진다(이 검사는 진짜 라우팅을 잰다)', async ({ page }) => {
  const { api } = await boot(page);
  await page.evaluate(() => { window.openPanelForBlock = () => false; });   // 표를 «정체»로 끊는다
  await page.evaluate((h) => h.setAnchor('tbA'), api);
  const r = await act(page, api, { op: 'range', a: 'tbA', b: 'sec1' });
  expect(r.calls, '표를 끊었는데도 패널이 열렸다 — 이 검사는 다른 것을 재고 있다').toEqual([]);
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★2026-09-24 — _updateMultiSelPanel 을 부르는 자리는 «넷»이다(판 7780267 전수:
     js/editor.js:1134 · :1187 · :1216 · :1229. 그 함수는 window 에 안 붙어 있어
     부를 수 있는 파일이 js/editor.js 하나뿐이다).
   위 검사들이 밟은 것은 셋 — :1134(⌘클릭 toggleBlockSelect) · :1187(Path 1 같은 부모) ·
   :1229(끝 폴백, 앵커 없음). ⇒ 남은 :1216(Path 2 — 부모가 달라 «섹션 전수»로 떨어지는 갈래)을
   여기서 «따로» 밟는다. 넷을 다 밟아야 「함수 안에 넣으면 네 자리 모두에 듣는다」가
   읽기가 아니라 실측이 된다.
   ═══════════════════════════════════════════════════════════════════════════ */
test('Path2 ★부모가 달라 «섹션 전수» 갈래로 떨어져도, 한 블럭이면 그 블럭 패널이다', async ({ page }) => {
  const { errs, api } = await boot(page);
  /* 앵커 = 그룹 프레임(section-inner 의 자식) · 대상 = 그 «안»의 글자
     ⇒ 대상의 단위(tfC)는 grp1 의 자식이고 앵커는 inner1 의 자식이라 Path 1 의
        `anchor.parentElement === parent` 가 깨진다. */
  await page.evaluate((h) => h.setAnchor('grp1'), api);
  const r = await act(page, api, { op: 'range', a: 'tbC', b: 'sec1' });
  expect(r.selected, 'Path 2 가 범위를 안 잡았다 — 이 검사가 그 갈래를 못 밟고 있다')
    .toEqual(expect.arrayContaining(['grp1', 'tbC']));
  /* 고른 «단위»는 둘로 보이지만 패널을 가진 블럭은 글자 하나뿐이다(그룹 프레임은 표에 없다). */
  expect(r.calls, 'Path 2 갈래에서만 패널이 안 열린다 — 갈래마다 따로 고치면 이런 구멍이 남는다')
    .toEqual(['showTextProperties#tbC']);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
