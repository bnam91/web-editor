/* insert-seam-undo.dom.spec.js — T-131 «삽입(push-before) → 우측 패널(push-after)» 이음매.
 *
 * ★현빈 2026-09-21 「텍스트 블럭 추가 직후 글자크기 36→20 커밋 → ⌘Z 한 번 → 블럭 자체가
 *   사라짐」 / 「에셋 블럭 추가 직후 프리셋 Tall → ⌘Z 한 번 → 에셋 블럭이 사라짐」
 *   대조: «이미 있던 블럭»의 같은 속성을 바꾸고 ⌘Z 하면 정확히 한 걸음만 되돌아간다.
 *   ⇒ 조건은 «블럭 추가 직후 첫 속성 커밋».
 *
 * ★기전(자세한 건 js/insert-history.js 머리말) — pushHistory 는 «부르는 그 순간»의 캔버스를
 *   찍는다. 삽입은 «전»을, 패널은 «뒤»를 찍으니 「블럭은 있고 값은 옛날」 표본이 한 번도
 *   안 찍힌다 ⇒ ⌘Z 한 번이 둘을 같이 먹는다.
 *   고침 = 삽입 입구가 돌아온 «직후»에 표본을 하나 «더한다»(⛔옮기기가 아니다).
 *
 * ★진짜 js/globals.js + js/history.js + js/insert-history.js 를 크로미움에 얹는다.
 *   (앱은 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉.)
 *   입구는 «모양»만 합성한다(push-before → DOM 쓰기). 진짜 block-factory 는 모듈 그래프가
 *   커서 못 얹는데, 이 스펙이 재는 것은 «이음매의 모양»이지 블럭의 내용이 아니다.
 *   진짜 입구가 그 모양을 유지하는지는 tests/unit/insert-seam-roster.test.mjs 가 잠근다.
 *
 * ★★음성대조 2벌이 이 스펙의 핵심이다 — 「통과를 만들어 내는 검사」가 되지 않도록,
 *   «현재» js/insert-history.js 소스에서 변형본을 «만들어» 돌린다(화석을 베껴 두지 않는다).
 *     N1 = 끝 표본을 안 찍던 «고치기 전(dev)» 모양 ⇒ M1 이 실제로 빨강이 된다
 *     N2 = window.pushHistory 를 설치 시점에 «캡처»한 모양 ⇒ M5 가 실제로 빨강이 된다
 *
 * 실행: npm run test:dom -- insert-seam-undo
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');

const GLOBALS_JS = read('js/globals.js');
const HISTORY_JS = read('js/history.js');
const INSERT_HISTORY_JS = read('js/insert-history.js');

/* ── 음성대조본 ① — 끝 표본을 «안» 찍던 dev 모양 ──────────────────────────
   래퍼는 그대로 두고 «찍는 줄»만 걷는다 ⇒ 재진입/설치 경로는 같고 결과만 dev 와 같아진다. */
const INSERT_HISTORY_N1 = (() => {
  const line = '              window.pushHistory(LABELS[name] || DEFAULT_LABEL);';
  if (!INSERT_HISTORY_JS.includes(line)) throw new Error('N1 변환이 늙었다 — 끝 표본을 찍는 줄을 못 찾았다');
  const out = INSERT_HISTORY_JS.replace(line, '              /* N1: 끝 표본 없음(dev) */');
  if (/window\.pushHistory\s*\(/.test(out.replace(/^\s*[*/].*$/gm, ''))) {
    throw new Error('N1 변환본에 pushHistory 호출이 남았다');
  }
  return out;
})();

/* ── 음성대조본 ③ — 끝 표본 «갱신»(restamp)만 뺀 모양 ──────────────────────
   M9 가 「지연 쓰기가 있어도 한 번」을 잠그는데, 그게 «실제로 빨강이 될 수 있는지»를 여기서 증명한다.
   ⛔화석을 베끼지 않는다 — 지금 소스에서 그 한 줄만 걷어낸다(늙으면 변환이 «던진다»). */
const INSERT_HISTORY_N3 = (() => {
  const line = '              _scheduleRestamp();';
  if (!INSERT_HISTORY_JS.includes(line)) throw new Error('N3 변환이 늙었다 — 끝 표본 갱신 줄을 못 찾았다');
  return INSERT_HISTORY_JS.replace(line, '              /* N3: 끝 표본 갱신 없음 */');
})();

/* ── 음성대조본 ② — window.pushHistory 를 «설치 시점에 캡처»한 모양 ────────
   js/ai-section-fill.js 의 «의도된 노옵»을 깨뜨리는 바로 그 실수다(규약 ①). */
const INSERT_HISTORY_N2 = (() => {
  let s = INSERT_HISTORY_JS;
  const a = '  var _depth = 0;';
  if (!s.includes(a)) throw new Error('N2 변환이 늙었다 — _depth 선언을 못 찾았다');
  s = s.replace(a, '  var _P = null;   /* N2: 설치 시점 캡처(=버그) */\n' + a);
  const b = '  function install() {';
  if (!s.includes(b)) throw new Error('N2 변환이 늙었다 — install 을 못 찾았다');
  s = s.replace(b, b + '\n    _P = window.pushHistory;');
  const c = "            if (typeof window.pushHistory === 'function') {\n              window.pushHistory(LABELS[name] || DEFAULT_LABEL);";
  if (!s.includes(c)) throw new Error('N2 변환이 늙었다 — 호출 자리를 못 찾았다');
  s = s.replace(c, "            if (typeof _P === 'function') {\n              _P(LABELS[name] || DEFAULT_LABEL);");
  return s;
})();

/* ═══ 하네스 — history.js 가 기대하는 «바깥 세계»의 최소치 + 합성 입구 ═══ */
const HARNESS_JS = `
import './globals.js';
import './history.js';

const canvas = document.getElementById('canvas');
/* ⛔#inner 를 «변수로 붙잡지» 마라 — restoreSnapshot 이 canvas.innerHTML 을 통째로 갈아서
   ⌘Z 한 번이면 붙잡아 둔 노드가 «떨어진 노드»가 된다(실측: undo 뒤 삽입이 화면 밖으로 갔다). */
const inner = () => document.getElementById('inner');
window.getSerializedCanvas = () => canvas.innerHTML;
window.getLastVideoPendingSidecar = () => null;
window.rebindAll = () => {};
window.deselectAll = () => { canvas.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')); };
window.applyPageSettings = () => {};
window.buildLayerPanel = () => {};
window.scheduleAutoSave = () => {};
/* _captureSelection/_restoreSelection 이 «진짜로» 돌게 최소 배선만 준다 */
window.CANVAS_SEL_BLOCKS_AND_SHAPE = '.text-block.selected';
window.syncSection = () => {};
window.highlightBlock = () => {};
window.setBlockAnchor = () => {};
window.openPanelForBlock = (el) => { window.__panelFor = el ? el.id : null; };
window.showHandlesFor = () => {};

/* ── 합성 입구들 — 진짜 입구와 «같은 모양»(push-before → DOM 쓰기) ───────────
   이름을 add*Block 으로 지어 js/insert-history.js 의 MATCH 가 «자동으로» 잡게 한다. */
let _n = 0;
function _mk(id) {
  const d = document.createElement('div');
  d.className = 'text-block';
  d.id = id || ('fb' + (++_n));
  d.dataset.v = '36';
  inner().appendChild(d);
  return d;
}
/* 진짜 입구와 같은 규약: 바꾸기 «전»에 찍고 나서 DOM 을 쓴다 */
window.addFakeBlock  = function (id) { window.pushHistory(); return _mk(id); };
/* 진짜 입구 대다수는 삽입 «끝»에 방금 만든 블럭을 고른다(selectBlock) — 그 모양 */
window.addSelfSelBlock = function (id) { window.pushHistory(); const d = _mk(id); d.classList.add('selected'); return d; };
/* 안쪽에서 불리는 «잎» — 자기 push-before 는 없다(preset row 처럼 한 번에 여러 개 넣는 모양) */
window.addLeafBlock  = function (id) { return _mk(id); };
/* 중첩 입구 — window 경유로 잎을 두 번 부른다(래퍼가 두 번 탄다) */
window.addNestBlock  = function () { window.pushHistory(); window.addLeafBlock('nl1'); window.addLeafBlock('nl2'); };
/* 섹션 미선택 — 힌트만 띄우고 캔버스를 «안» 바꾼다 */
window.addSilentBlock = function () { window.__hint = (window.__hint || 0) + 1; };
/* DOM 을 만진 «뒤» 던지는 입구 */
window.addBoomBlock  = function () { window.pushHistory(); _mk('boom'); throw new Error('입구가 던졌다'); };
/* 규약 ④ 를 깨는 입구 — 돌아온 «뒤» 비동기로 DOM 을 더 바꾼다(정착 안 됨) */
window.addDeferBlock = function () {
  window.pushHistory();
  const d = _mk('defer');
  setTimeout(() => { d.dataset.late = '1'; }, 0);
};

window.__ready = true;
`;

const BODY = `<div id="canvas"><div class="section-block" id="sec"><div class="section-inner" id="inner"></div></div></div>`;

async function boot(page, variant = 'fix') {
  const IH = variant === 'N1' ? INSERT_HISTORY_N1
           : variant === 'N2' ? INSERT_HISTORY_N2
           : variant === 'N3' ? INSERT_HISTORY_N3
           : INSERT_HISTORY_JS;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    const js = (body) => route.fulfill({ contentType: 'application/javascript', body });
    if (u.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        /* ★index.html 과 «같은 순서»로 얹는다 — 클래식(insert-history) 먼저, 모듈 나중.
           클래식은 로드 시점에 window.add* 가 «아직 없어» DOMContentLoaded 를 기다리고,
           모듈(=defer)은 DOMContentLoaded «전»에 전부 돈다. 그 전제 자체가 여기서 재진다. */
        body: `<!doctype html><html><head><meta charset="utf-8">
          <script src="/js/insert-history.js"></script>
          <script type="module" src="/__harness.js"></script>
          </head><body>${BODY}</body></html>`,
      });
    }
    if (u.pathname === '/__harness.js')          return js(HARNESS_JS);
    if (u.pathname === '/globals.js')            return js(GLOBALS_JS);
    if (u.pathname === '/history.js')            return js(HISTORY_JS);
    if (u.pathname === '/js/insert-history.js')  return js(IH);
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  /* 설치가 «실제로» 됐는지 — 부재를 통과로 읽지 않는다 */
  await page.waitForFunction(() => (window.__insertSeamRoster?.() || []).length > 0);
  return errs;
}

/* 브라우저 안에서 도는 시나리오. 이름 하나를 받아 결과 객체를 돌려준다. */
const SCENARIO = async (which) => {
  const inner = () => document.getElementById('inner');   // ⛔붙잡지 않는다(위 하네스 주석)
  const reset = () => { inner().innerHTML = ''; window.clearHistory(); };
  const len = () => window.historyStack.length;
  const alive = (id) => !!document.getElementById(id);
  const vOf = (id) => document.getElementById(id)?.dataset.v ?? null;
  const topAction = () => window.historyStack[window.historyPos]?.action ?? null;

  if (which === 'roster') {
    const r = window.__insertSeamRoster();
    return { roster: r, allWrapped: r.every(n => window[n] && window[n].__insertSeamWrapped === true),
             depth: window.__insertSeamDepth() };
  }

  if (which === 'M1') {
    reset();
    window.addFakeBlock('b1');
    const afterInsert = { len: len(), pos: window.historyPos, action: topAction() };
    /* 우측 패널 커밋(push-after) — 값을 «먼저» 바꾸고 «뒤»에 찍는다 */
    document.getElementById('b1').dataset.v = '20';
    window.pushHistory('글자크기');
    const afterCommit = { len: len(), pos: window.historyPos };
    window.undo();
    const undo1 = { alive: alive('b1'), v: vOf('b1') };
    window.undo();
    const undo2 = { alive: alive('b1') };
    window.redo();
    const redo1 = { alive: alive('b1'), v: vOf('b1') };
    window.redo();
    const redo2 = { alive: alive('b1'), v: vOf('b1') };
    return { afterInsert, afterCommit, undo1, undo2, redo1, redo2 };
  }

  if (which === 'M2') {
    reset();
    const base = len();
    window.addFakeBlock('m2');
    const afterInsert = { len: len(), delta: len() - base };
    const steps = [];
    for (let i = 0; i < 3 && alive('m2'); i++) { window.undo(); steps.push(alive('m2')); }
    return { afterInsert, undosToVanish: steps.length, steps };
  }

  if (which === 'M3') {
    reset();
    const b0 = len();
    window.addNestBlock();
    const nested = { delta: len() - b0, action: topAction(), depth: window.__insertSeamDepth() };
    /* 대조 — 같은 잎 둘을 «따로» 부르면 표본이 둘이다(깊이 가드가 하는 일이 이것) */
    reset();
    const b1 = len();
    window.addLeafBlock('f1');
    window.addLeafBlock('f2');
    const flat = { delta: len() - b1 };
    return { nested, flat };
  }

  if (which === 'M4') {
    reset();
    const b = len();
    window.addSilentBlock();
    return { delta: len() - b, hint: window.__hint, kids: inner().children.length };
  }

  if (which === 'M5') {
    reset();
    const b = len();
    /* js/ai-section-fill.js:425-426 과 «같은 모양» — 노옵으로 갈아끼운 뒤 입구를 N번 부른다 */
    const origPush = window.pushHistory;
    window.pushHistory = () => {};
    try { window.addFakeBlock('a1'); window.addFakeBlock('a2'); window.addFakeBlock('a3'); }
    finally { window.pushHistory = origPush; }
    return { delta: len() - b, kids: inner().children.length };
  }

  if (which === 'M6') {
    reset();
    const b = len();
    let threw = null;
    try { window.addBoomBlock(); } catch (e) { threw = String(e && e.message); }
    const afterBoom = { delta: len() - b, depth: window.__insertSeamDepth(), threw, alive: alive('boom') };
    const b2 = len();
    window.addFakeBlock('after');
    return { afterBoom, nextDelta: len() - b2 };
  }

  if (which === 'M7') {
    reset();
    /* 진짜 입구처럼 «삽입 끝에 방금 만든 블럭을 고른다» ⇒ 끝 표본이 그 선택까지 담는다 */
    window.addSelfSelBlock('s1');
    const afterInsert = { len: len(), selInSnap: !!window.historyStack[window.historyPos]?.selection };
    window.undo();
    const u1 = { alive: alive('s1') };
    window.redo();
    const r1 = { alive: alive('s1'),
                 selected: !!document.querySelector('#s1.selected'),
                 panelFor: window.__panelFor };
    return { afterInsert, u1, r1 };
  }

  if (which === 'M8') {
    reset();
    window.addFakeBlock('d1');
    /* 삭제 경로와 같은 모양: ensure → remove → deselect → push */
    window.ensureHistoryCheckpoint('삭제 전');
    document.getElementById('d1').remove();
    window.deselectAll();
    window.pushHistory('삭제');
    const afterDel = { alive: alive('d1'), len: len() };
    window.undo();
    return { afterDel, undo1: { alive: alive('d1') } };
  }

  if (which === 'M9') {
    /* ★규약 ④ 를 «깨는» 입구를 실제로 돌려, 「삽입만 하고 ⌘Z」가 두 번이 되는 것을 본다.
       = tests/unit/insert-seam-roster.test.mjs B3 이 왜 빨강이어야 하는지의 양성대조. */
    reset();
    window.addDeferBlock();
    await new Promise(r => setTimeout(r, 20));   // 비동기 쓰기가 «정착»하게 둔다
    const steps = [];
    for (let i = 0; i < 3 && alive('defer'); i++) { window.undo(); steps.push(alive('defer')); }
    const defer = { undosToVanish: steps.length };
    /* 대조 — 정착이 끝난 입구는 한 번이다 */
    reset();
    window.addFakeBlock('ok');
    await new Promise(r => setTimeout(r, 20));
    const s2 = [];
    for (let i = 0; i < 3 && alive('ok'); i++) { window.undo(); s2.push(alive('ok')); }
    return { defer, settled: { undosToVanish: s2.length } };
  }

  throw new Error('모르는 시나리오: ' + which);
};

const SRC = SCENARIO.toString();
const run = (page, which) => page.evaluate(
  ({ src, which }) => eval('(' + src + ')')(which), { src: SRC, which });

/* ═══════════════════════════════════════════════════════════════════════════
   설치 — 부재를 통과로 읽지 않는다
═══════════════════════════════════════════════════════════════════════════ */
test('M0 ★DOMContentLoaded 설치가 합성 입구를 «전부» 감쌌다(런타임 클로버 감지)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'roster');
  expect(errs).toEqual([]);
  expect(r.roster.sort()).toEqual(
    ['addBoomBlock', 'addDeferBlock', 'addFakeBlock', 'addLeafBlock', 'addNestBlock',
     'addSelfSelBlock', 'addSilentBlock']);
  expect(r.allWrapped, '로스터 전부가 __insertSeamWrapped 여야 한다').toBe(true);
  expect(r.depth, '한가할 땐 깊이 0').toBe(0);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M1 — 현빈 재현 그대로: 삽입 직후 «첫» 속성 커밋 → ⌘Z
═══════════════════════════════════════════════════════════════════════════ */
test('M1 ★삽입 → 패널 커밋 → ⌘Z = 블럭은 있고 «값만» 옛날 / 한 번 더 = 블럭 없음', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M1');
  expect(errs).toEqual([]);
  /* 삽입의 push-before 는 «빈 캔버스»를 찍는데 clearHistory 가 이미 같은 걸 찍어 뒀다
     ⇒ 무변화 차단이 버린다. 남는 건 «끝 표본» 하나다. */
  expect(r.afterInsert.len, '빈 캔버스 + 끝 표본 = 2칸').toBe(2);
  expect(r.afterInsert.action, '되돌리기 툴팁에 맞는 말이 뜬다').toBe('블럭 추가');
  expect(r.afterCommit.len).toBe(3);
  expect(r.undo1.alive, '★⌘Z 한 번에 블럭이 사라지면 안 된다 — 현빈 제보가 그 모양이었다').toBe(true);
  expect(r.undo1.v, '값만 옛날로').toBe('36');
  expect(r.undo2.alive, '한 번 더 누르면 삽입이 취소된다').toBe(false);
  expect(r.redo1.alive).toBe(true);
  expect(r.redo1.v).toBe('36');
  expect(r.redo2.v, '⇧⌘Z 두 번이면 값까지 돌아온다').toBe('20');
});

/* ═══════════════════════════════════════════════════════════════════════════
   M2 — 삽입만 하고 ⌘Z 는 «여전히 한 번»이다 (주장 ④ 를 «잰다»)
═══════════════════════════════════════════════════════════════════════════ */
test('M2 ★삽입만 하고 ⌘Z = 한 번 (끝 표본을 더했다고 두 번이 되지 않는다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M2');
  expect(errs).toEqual([]);
  expect(r.afterInsert.delta, '삽입 1회 = 항목 1칸(push-before 는 무변화라 버려진다)').toBe(1);
  expect(r.undosToVanish, '⌘Z 한 번이면 사라진다').toBe(1);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M3 — 중첩은 «바깥 하나»만 (규약 ③)
═══════════════════════════════════════════════════════════════════════════ */
test('M3 ★중첩 입구는 끝 표본을 한 번만 찍는다 (평평하게 부르면 두 번이라는 대조와 함께)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M3');
  expect(errs).toEqual([]);
  expect(r.nested.delta, '중첩 1회 = 1칸').toBe(1);
  expect(r.nested.action, '바깥 입구의 라벨이 남는다').toBe('블럭 추가');
  expect(r.nested.depth, '돌아온 뒤 깊이는 0').toBe(0);
  expect(r.flat.delta, '★대조 — 깊이 가드가 없었다면 이 수가 중첩에도 났다').toBe(2);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M4 — 조용히 취소된 삽입엔 «새 게이트가 필요 없다»를 문장이 아니라 수로
═══════════════════════════════════════════════════════════════════════════ */
test('M4 ★섹션 미선택(힌트만) 입구는 항목을 «0칸» 만든다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M4');
  expect(errs).toEqual([]);
  expect(r.hint, '입구는 실제로 불렸다(안 불린 걸 0칸으로 읽지 않는다)').toBe(1);
  expect(r.kids, '캔버스가 안 바뀌었다').toBe(0);
  expect(r.delta, '무변화 차단이 끝 표본을 버린다').toBe(0);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M5 — ai-section-fill 의 «의도된» 묶음 롤백 (규약 ①)
═══════════════════════════════════════════════════════════════════════════ */
test('M5 ★window.pushHistory 가 노옵인 동안의 삽입 3회 = 항목 0칸', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M5');
  expect(errs).toEqual([]);
  expect(r.kids, '블럭은 실제로 3개 생겼다').toBe(3);
  expect(r.delta, '★끝 표본이 «부를 때» 읽으면 노옵을 탄다 ⇒ 0칸').toBe(0);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M6 — 입구가 던져도 표본은 남고, 깊이는 샌 채로 안 남는다 (규약 ②)
═══════════════════════════════════════════════════════════════════════════ */
test('M6 ★입구가 DOM 을 만진 «뒤» 던져도 예외는 전파되고 깊이는 0으로 돌아온다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M6');
  expect(errs).toEqual([]);
  expect(r.afterBoom.threw, '예외를 삼키지 않는다').toBe('입구가 던졌다');
  expect(r.afterBoom.alive, '반쪽이라도 DOM 은 남아 있다').toBe(true);
  expect(r.afterBoom.delta, '그 반쪽 상태를 찍어 둔다(라이브를 못 찍은 칸보다 낫다)').toBe(1);
  expect(r.afterBoom.depth, '★깊이가 새면 다음 삽입이 영영 안 찍힌다').toBe(0);
  expect(r.nextDelta, '다음 삽입은 정확히 한 칸').toBe(1);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M7 — 선택 복원 (0920b grad-alpha C 규약을 안 깬다)
═══════════════════════════════════════════════════════════════════════════ */
test('M7 ★삽입 → ⌘Z → ⇧⌘Z 면 블럭이 되살아나고 선택도 복원된다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M7');
  expect(errs).toEqual([]);
  expect(r.afterInsert.selInSnap, '끝 표본이 «방금 고른 블럭»까지 담는다').toBe(true);
  expect(r.u1.alive).toBe(false);
  expect(r.r1.alive).toBe(true);
  expect(r.r1.selected, '_restoreSelection 이 성립한다').toBe(true);
  expect(r.r1.panelFor, '클릭 경로와 «같은» 입구로 패널까지').toBe('s1');
});

/* ═══════════════════════════════════════════════════════════════════════════
   M8 — 삭제 왕복 (⑥-② 「같은 자리다」를 논증이 아니라 측정으로)
═══════════════════════════════════════════════════════════════════════════ */
test('M8 ★삽입 → 삭제 → ⌘Z 한 번이면 블럭이 돌아온다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M8');
  expect(errs).toEqual([]);
  expect(r.afterDel.alive).toBe(false);
  expect(r.undo1.alive, '삭제 복원선이 끝 표본으로 옮겨가도 ⌘Z 횟수는 그대로').toBe(true);
});

/* ═══════════════════════════════════════════════════════════════════════════
   M9 — ★지연 쓰기가 있어도 ⌘Z 는 «한 번»이다 (restampHistoryTop 의 근거)
   ──────────────────────────────────────────────────────────────────────────
   ⚠️이 검사는 «뒤집혔다». 처음엔 「지연 쓰기가 있으면 두 번이 된다」를 양성대조로 잠갔는데,
     그건 «고치기 전»의 참이었다 — 실앱 전수 스윕(2026-09-21)에서 그 두 번이 다섯 입구에서
     실제로 났고(addSection·addBanner02Block·addCanvasBlock·addComparisonBlock·텍스트 스티커),
     js/history.js restampHistoryTop + js/insert-history.js _scheduleRestamp 로 닫았다.
   ⇒ 이제 계약은 「지연 쓰기가 있어도 한 번」이다. 「두 번」을 잠그고 있으면 고침이 «검사를 깬다».
   ★«두 번»이 될 수 있다는 증명은 N3(음성대조)에 있다 — 여기서 잃지 않는다.
═══════════════════════════════════════════════════════════════════════════ */
test('M9 ★돌아온 뒤 DOM 을 더 바꾸는 입구도 ⌘Z 는 «한 번»이다 (끝 표본 갱신)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'M9');
  expect(errs).toEqual([]);
  expect(r.settled.undosToVanish, '정착한 입구는 한 번').toBe(1);
  expect(r.defer.undosToVanish,
    '★지연 쓰기가 있어도 한 번이어야 한다 — 끝 표본을 «한 프레임 뒤 값»으로 다시 찍기 때문이다. ' +
    '두 번이 나오면 restampHistoryTop 이 안 도는 것이다(seq 불일치·타이밍·노출 누락을 봐라)').toBe(1);
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★음성대조 — 「이 검사가 실제로 빨강이 될 수 있는가」
═══════════════════════════════════════════════════════════════════════════ */
test('N1 ★[음성대조] 끝 표본을 뺀 «고치기 전» 모양이면 M1 의 첫 ⌘Z 에 블럭이 사라진다', async ({ page }) => {
  const errs = await boot(page, 'N1');
  const r = await run(page, 'M1');
  expect(errs).toEqual([]);
  expect(r.afterInsert.len, 'dev 모양: 삽입해도 칸이 안 는다').toBe(1);
  expect(r.undo1.alive, '★현빈이 본 그 증상 — 값이 아니라 블럭이 사라진다').toBe(false);
});

test('N2 ★[음성대조] window.pushHistory 를 «캡처»하면 M5 가 0칸이 아니라 3칸이 된다', async ({ page }) => {
  const errs = await boot(page, 'N2');
  const r = await run(page, 'M5');
  expect(errs).toEqual([]);
  expect(r.kids).toBe(3);
  expect(r.delta, '★캡처하면 ai-section-fill 의 «한 번의 ⌘Z 로 전체 롤백»이 깨진다').toBe(3);
});

test('N3 ★[음성대조] 끝 표본 «갱신»을 빼면 지연 쓰기 입구가 ⌘Z 두 번이 된다', async ({ page }) => {
  const errs = await boot(page, 'N3');
  const r = await run(page, 'M9');
  expect(errs).toEqual([]);
  expect(r.settled.undosToVanish, '정착한 입구는 갱신이 없어도 한 번').toBe(1);
  expect(r.defer.undosToVanish,
    '★갱신을 빼면 «먹통 한 칸»이 실제로 돌아온다 — M9 의 초록이 «검사처럼 생긴 문장»이 아님을 여기서 증명한다').toBe(2);
});
