/* grid-gap-clamp.test.js — 「만드는 문」의 `gap` 도 «자르되 말한다». (U-gate, 2026-09-24)
 * 실행: node --test tests/unit/grid-gap-clamp.test.js
 * 기준선: 55f3a1a(origin/dev) · 나무: scratchpad/wt-u-gate · 브랜치 fix/0924-u-gate-gap
 *
 * ★무엇을 닫나
 *   만드는 문의 규칙은 이미 「자르되 말한다」인데(cols 6→4 · rows 6→4) `gap` «하나»만
 *   「저장하고 말한다」로 예외였다. 그 탓에 고치는 문(0~200)으로는 «영영 못 되돌리는 값»이
 *   생겼다 — 만들 수는 있는데 고칠 수는 없는 값. ⇒ 취향이 아니라 «버그 수정»이다
 *   (정상 사용자는 패널 슬라이더 max 때문에 그 값을 만들 수조차 없다 — API 로만 생긴다).
 *
 * ⛔★★조건 «둘»이 이 카드의 본체다. 검사도 그 둘을 각각 든다:
 *   ⑴ «입구에서만» 자른다 — 렌더러(`_gridGaps`)는 «절대» 무접촉.
 *      까닭: 저장본에 200 넘는 gap 이 있으면 렌더러를 좁히는 순간 그 프로젝트의 «보이는 것»이
 *      바뀐다(T-170 함정과 같은 자리). ⇒ ★G2 가 그 자물쇠다 — 큰 gap 이 «있는» 저장본을
 *      고치기 전/후 판으로 각각 그려 «바이트 동일»을 단언한다. G2-b 가 그 자의 양성대조다.
 *   ⑵ 「그런 저장본이 있나」는 ⛔«잴 수 없다» — 현빈 계정은 그리드 블록이 «0건»이라 표본이 0이고
 *      (지디 실측 2026-09-24), 배포판 사용자 저장본엔 손이 안 닿는다.
 *      ⛔★「표본 0」은 «안전하다»가 아니라 «모른다»다. 그래서 ⑴을 «대신» 세운다.
 *
 * ⛔GO 범위는 `gap` «하나»다 — `rowGap`/`colGap` 은 안 건드렸다(G5 가 그걸 잠근다).
 *   까닭: 그 둘은 범위를 벗어나면 «안 써지고» gap 으로 떨어질 뿐이라, 이 카드의 근거
 *   (「못 고치는 값이 생긴다」)가 «성립하지 않는다». 같은 축처럼 보이지만 병이 다르다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const SRC_PATH = path.join(ROOT, 'js', 'blocks', 'grid-block.js');
const RAW = readSrc(SRC_PATH);

/** 고치기 «전» 판의 같은 파일. ⛔파일에 안 쓴다 — 문자열로만 든다. */
const BASE_REV = '55f3a1a';
function baseSrc() {
  try {
    return execFileSync('git', ['show', `${BASE_REV}:js/blocks/grid-block.js`], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    assert.fail(`★기준판(${BASE_REV})의 소스를 못 떴다 — G2/G3 는 아무것도 안 잰다: ${e.message}`);
  }
}

/* ══ 미니 DOM — grid-intake-contract.test.js 와 «같은 표면»(새 하네스를 만들지 않는다) ══ */
function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag, dataset: {}, style: {}, innerHTML: '',
      get id() { return _id; },
      set id(v) { if (_id) registry.delete(_id); _id = v; if (v) registry.set(v, el); },
      get className() { return [..._classes].join(' '); },
      set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      classList: {
        contains: (c) => _classes.has(c), add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; }, scrollIntoView() {},
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let _seq = 0;
async function loadGrid(src = RAW) {
  const STUB = 'const insertAfterSelected = () => {};\n'
    + 'const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n'
    + 'const bindBlock = () => {};\n';
  const b1 = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, b1, '★소스에서 drag-utils/drag-drop import 2줄을 못 찾았다 — 리팩터링됐나?');

  const tag = `${process.pid}-${++_seq}`;
  const gcrAlias = path.join(os.tmpdir(), `gcr-gap-${tag}.mjs`);
  const b2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, b2, '★grid-cell-resize.js import 를 못 찾았다 — 행높이 상한 SSOT 가 끊겼나?');

  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcrAlias);
  const alias = path.join(os.tmpdir(), `grid-gap-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcrAlias);
  return mod;
}

let G, BASE;
before(async () => { G = await loadGrid(); BASE = await loadGrid(baseSrc()); });

/** 만드는 문이 «끝까지» 가게 창을 깐다 — 안 깔면 null 로 조기반환해 거짓 음성이 난다. */
function withSection(fn) {
  const saved = globalThis.window;
  globalThis.window = {
    getSelectedSection: () => ({ dummy: 1 }), pushHistory() {}, buildLayerPanel() {},
    selectBlock() {}, triggerAutoSave() {}, showNoSelectionHint() {},
  };
  try { return fn(); } finally { globalThis.window = saved; }
}
const L = () => [{ type: 'body', text: 'X' }];
const add = (mod, opts) => withSection(() => mod.addGridBlock({ cols: [{ width: 1, lines: L() }], ...opts }));
const ignoredOf = (r) => ((r && r.notApplied) || {}).ignoredProps || [];
const hintOf = (r) => ((r && r.notApplied) || {}).hint || '';

/** «큰 gap 이 이미 들어 있는 저장본»을 그대로 흉내 낸다 — 입구를 «안» 지나는 길이다.
 *  ★이것이 조건 ⑴이 지키려는 바로 그 상태다(저장본 로드 = dataset → renderGridBlock). */
function storedGrid(mod, gap) {
  const el = globalThis.document.createElement('div');
  el.className = 'grid-block';
  el.id = 'grd_stored_' + (++_seq);
  el.dataset.type = 'grid';
  el.dataset.cols = JSON.stringify([{ width: 1, lines: L() }, { width: 1, lines: L() }]);
  el.dataset.gap = String(gap);
  mod.renderGridBlock(el);
  return el;
}

/* ═══════════════════════════════════════════════════════════════════════
   G0 — 자가점검. ⛔이게 빨가면 아래 초록·빨강은 전부 «다른 이유»다
   ═══════════════════════════════════════════════════════════════════════ */

test('G0 ★자가점검 — 기준판이 떠지고, 렌더러가 «큰 gap 을 실제로 그린다»', () => {
  assert.ok(typeof BASE.addGridBlock === 'function', `★기준판(${BASE_REV}) 모듈이 안 떴다 — G2·G3 가 헛것이다`);
  /* ★G2 가 «무언가를» 재려면 렌더러가 그 큰 값을 실제로 산출에 실어야 한다.
     안 실으면 「바이트 동일」이 «둘 다 그 값을 안 쓴다»는 뜻이 되어 아무것도 안 잰다. */
  const el = storedGrid(G, 999);
  assert.match(el.innerHTML, /row-gap:999px/, '★렌더러가 저장본의 큰 gap 을 «안 그린다» — G2 는 아무것도 안 잰다');
  assert.match(el.innerHTML, /column-gap:999px/, '★열 간격 쪽도 안 그린다');
});

/* ═══════════════════════════════════════════════════════════════════════
   G1 — ★입구에서 «자른다», 그리고 «말한다»
   ═══════════════════════════════════════════════════════════════════════ */

test('G1 ★범위 밖 gap 은 한계로 «잘리고», 잘랐다고 말한다', () => {
  const cap = 200;   /* 아래 G1-d 가 이 수를 소스의 GRID_GAP_MAX 와 대조한다 */
  for (const [given, want] of [[999, cap], [1e6, cap], [-5, 0], [201, cap], [-0.4, 0]]) {
    const r = add(G, { gap: given });
    assert.ok(r && r.block, `★gap:${given}: 블록이 안 만들어졌다 — 아래 단언이 «다른 이유»로 움직인다`);
    assert.equal(r.block.dataset.gap, String(want),
      `★gap:${given} 이 ${r.block.dataset.gap} 으로 저장됐다(기대 ${want}) — 안 잘렸거나 엉뚱하게 잘렸다`);
    assert.ok(ignoredOf(r).includes('gap'),
      `★gap:${given} 을 «조용히» 잘랐다 — 자르는 것보다 조용한 게 더 나쁘다. ignoredProps:${JSON.stringify(ignoredOf(r))}`);
    assert.match(hintOf(r), /CLAMPED to/, `★gap:${given}: «잘랐다»고 말하지 않는다: ${hintOf(r)}`);
  }
});

test('G1-b ★음성대조 — 범위 «안»(경계 포함)은 안 잘리고 말도 안 한다', () => {
  for (const v of [0, 1, 24, 199, 200]) {
    const r = add(G, { gap: v });
    assert.equal(r.block.dataset.gap, String(v), `★멀쩡한 gap:${v} 가 ${r.block.dataset.gap} 으로 바뀌었다`);
    assert.ok(!ignoredOf(r).includes('gap'),
      `★멀쩡한 gap:${v} 를 「안 됐다」고 말했다 — 아무 때나 겁주면 이 말은 뜻이 없어진다: ${hintOf(r)}`);
  }
  /* 아예 안 준 경우도 조용해야 한다 */
  const none = add(G, {});
  assert.ok(!ignoredOf(none).includes('gap'), '★gap 을 «안 줬는데» 말을 한다');
  assert.equal(none.block.dataset.gap, '24', '★기본값이 바뀌었다');
});

test('G1-c ★숫자가 «아닌» 값은 기본값으로 떨어지되 — 이제 말은 한다(동작은 기준판 그대로)', () => {
  /* ⛔기대값을 «손으로» 적지 않는다 — 기준판을 같이 돌려 «동작이 같은가»로 잰다.
     한 번 손으로 적었다가 틀렸다: `gap:true` 는 Number(true)=1 이라 «숫자»고,
     `gap:null` 은 0 이라 «범위 안»이다. 둘 다 원래부터 그렇게 동작했다 —
     그걸 「숫자 아님」으로 세면 내 자가 JS 형변환을 모르는 채로 단정하는 것이다. */
  for (const v of ['abc', {}, [1, 2], 'NaN', undefined]) {
    const now = add(G, { gap: v });
    const was = add(BASE, { gap: v });
    assert.equal(now.block.dataset.gap, was.block.dataset.gap,
      `★gap:${JSON.stringify(v)} 의 «동작»이 기준판과 달라졌다(지금 ${now.block.dataset.gap} · 기준 ${was.block.dataset.gap}) — 이 갈래는 그대로여야 한다`);
    if (v === undefined) continue;                       // «안 준 것»과 같다 — 말할 것이 없다
    assert.ok(ignoredOf(now).includes('gap'), `★gap:${JSON.stringify(v)} 를 조용히 삼켰다`);
    assert.match(hintOf(now), /not a number/, `★«왜» 안 먹었는지 안 말한다: ${hintOf(now)}`);
  }
});

test('G1-c2 ★JS 형변환으로 «숫자가 되는» 값은 예전처럼 그 수로 산다 — 말도 안 한다', () => {
  /* ★G1-c 를 한 번 틀리게 만든 자리를 «그대로 잠근다» — 다음 사람이 같은 데서 안 넘어지게. */
  for (const [v, want] of [[true, '1'], [null, '0'], [false, '0'], ['48', '48'], [[7], '7']]) {
    const now = add(G, { gap: v });
    const was = add(BASE, { gap: v });
    assert.equal(now.block.dataset.gap, want, `★gap:${JSON.stringify(v)} → ${now.block.dataset.gap}(기대 ${want})`);
    assert.equal(now.block.dataset.gap, was.block.dataset.gap, `★gap:${JSON.stringify(v)} 의 동작이 기준판과 달라졌다`);
    assert.ok(!ignoredOf(now).includes('gap'), `★범위 «안»인 gap:${JSON.stringify(v)} 에 말을 했다: ${hintOf(now)}`);
  }
});

test('G1-d ★상한을 «손으로» 안 적었다 — 소스의 GRID_GAP_MAX 와 대조한다', () => {
  const m = RAW.match(/export const GRID_GAP_MAX = (\d+);/);
  assert.ok(m, '★GRID_GAP_MAX 선언을 못 찾았다 — G1 이 박아 둔 200 의 출처가 사라졌다');
  assert.equal(Number(m[1]), 200,
    `★상한이 ${m[1]} 로 바뀌었다 — G1 의 기대값(200)을 같이 옮겨라(수를 두 벌로 두면 조용히 갈린다)`);
});

/* ═══════════════════════════════════════════════════════════════════════
   G2 — ★★조건 ⑴의 «자물쇠». 렌더러는 «절대» 안 건드렸다
   큰 gap 이 «이미 들어 있는» 저장본을 고치기 전/후 판으로 각각 그려 바이트로 견준다.
   ⛔이게 빨개지면 남의 프로젝트가 «보이는 것»부터 바뀐다는 뜻이다.

   ★2026-09-27 실화 — 이 자물쇠가 «진짜»를 잡았다. T-230 후속으로 빈 칸에
     `min-height:14px` 를 주면서 `${n}px` 꼴로 만들었더니, 내용이 «있는» 칸까지
     `min-height:0` 이 `0px` 로 바뀌었다. 화면은 한 픽셀도 안 달랐고 주석엔
     「내용이 있는 칸은 0 그대로다」라고 적혀 있었다 — 그런데 산출은 달랐다.
     ⇒ ★바꾸려는 것보다 «넓게» 바뀌었는지는 골든이 말해 준다. 주석은 안 말해 준다.
     ⇒ ⛔그때 「의도된 차이를 면제 목록에 넣자」로 갈 뻔했다. 자가점검을 하나 붙여 보니
       «면제 없이도 같아지게» 고칠 수 있었다 — 자물쇠에 구멍을 안 뚫는 쪽이 있었다.
       ★면제 목록을 만들기 «전»에 「산출을 더 좁힐 수는 없나」부터 물어라.
   ═══════════════════════════════════════════════════════════════════════ */

test('G2 ★★렌더러 무접촉 — 큰 gap 이 «있는» 저장본의 산출이 기준판과 «바이트 동일»이다', () => {
  for (const gap of [999, 201, 1e6, 0, 24]) {
    const now = storedGrid(G, gap).innerHTML;
    const was = storedGrid(BASE, gap).innerHTML;
    assert.equal(now, was,
      `★gap=${gap} 인 저장본의 «그려진 것»이 기준판(${BASE_REV})과 달라졌다.\n`
      + '  ⇒ 입구만 좁히기로 한 약속이 깨졌다 — 남의 프로젝트가 «열자마자» 달라 보인다(T-170 함정).\n'
      + `  지금: ${now.slice(0, 160)}\n  기준: ${was.slice(0, 160)}`);
  }
});


test('G2-b ★양성대조 — 렌더러를 «좁힌» 사본은 같은 저장본을 «다르게» 그린다', async () => {
  /* ⛔G2 의 초록이 「둘 다 그 값을 안 쓴다」로도 날 수 있다. 그래서 «좁히면 달라지는가»를 댄다. */
  const mutated = RAW.replace(
    'const legacy = Number.isFinite(+ds.gap) && ds.gap !== \'\' ? +ds.gap : GRID_DEFAULTS.gap;',
    'const legacy = Number.isFinite(+ds.gap) && ds.gap !== \'\' ? Math.min(GRID_GAP_MAX, +ds.gap) : GRID_DEFAULTS.gap;');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const now = storedGrid(G, 999).innerHTML;
  const narrowed = storedGrid(M, 999).innerHTML;
  assert.notEqual(now, narrowed,
    '★렌더러를 좁혔는데도 산출이 같다 — G2 가 재는 것은 «그 자리»가 아니다(자물쇠가 헐렁하다)');
  assert.match(narrowed, /row-gap:200px/, '★좁힌 사본이 기대한 대로 안 좁혀졌다 — 변이가 엉뚱한 곳에 꽂혔다');
});

/* ═══════════════════════════════════════════════════════════════════════
   G3 — ★양성대조. 고치기 «전» 판은 정말로 «안 잘랐나»
   ═══════════════════════════════════════════════════════════════════════ */

test('G3 ★양성대조 — 기준판은 gap:999 를 «그대로 저장»한다(구멍이 실재했다)', () => {
  const r = add(BASE, { gap: 999 });
  assert.ok(r && r.block, '★기준판에서 블록이 안 만들어졌다 — 이 대조는 아무것도 안 쟀다');
  assert.equal(r.block.dataset.gap, '999',
    '★기준판이 이미 자르고 있다 — 그렇다면 G1 이 재는 것은 «이 고침»이 아니다');
  assert.ok(ignoredOf(r).includes('gap'), '★기준판이 말조차 안 했다면 내 진단(「말은 했고 자르지만 않았다」)이 틀렸다');
  assert.doesNotMatch(hintOf(r), /CLAMPED to/, '★기준판이 이미 «잘랐다»고 말한다 — 그럼 G1 의 문구 단언이 헛것이다');
});

/* ═══════════════════════════════════════════════════════════════════════
   G4 — ★말이 «사실»과 맞나. 옛 문구는 이제 «거짓»이다
   ═══════════════════════════════════════════════════════════════════════ */

test('G4 ★자른 뒤의 말이 사실과 맞는다 — 옛 거짓말이 안 남았다', () => {
  const r = add(G, { gap: 999 });
  const h = hintOf(r);
  assert.match(h, /999/, `★«무엇을» 받았는지 안 말한다: ${h}`);
  assert.match(h, /CLAMPED to 200/, `★«무엇으로» 잘랐는지 안 말한다: ${h}`);
  /* ⛔옛 문구는 이제 거짓이다 — 저장하지 «않는다». 남아 있으면 부르는 쪽을 속인다. */
  assert.doesNotMatch(h, /STORED ANYWAY/,
    `★「그대로 저장했다」는 옛 말이 남았다 — 이제 자르므로 «거짓»이다: ${h}`);
  assert.doesNotMatch(h, /cannot be edited back/,
    `★「못 되돌린다」는 옛 말이 남았다 — 잘랐으므로 이제 되돌릴 수 있다: ${h}`);
});

/* ═══════════════════════════════════════════════════════════════════════
   G5 — ⛔GO 범위 «밖»은 안 건드렸다. rowGap/colGap 동작 불변
   ═══════════════════════════════════════════════════════════════════════ */

test('G5 ⛔rowGap·colGap 은 «안 바뀌었다» — 승인 범위를 안 넘었다', () => {
  for (const k of ['rowGap', 'colGap']) {
    const now = add(G, { [k]: 999 });
    const was = add(BASE, { [k]: 999 });
    assert.equal(now.block.dataset[k], was.block.dataset[k],
      `★'${k}' 의 동작이 바뀌었다(지금 ${now.block.dataset[k]} · 기준 ${was.block.dataset[k]}) — GO 는 gap «하나»였다`);
    assert.equal(now.block.dataset[k], undefined, `★'${k}' 이 범위 밖인데 써졌다 — 기존 동작과 다르다`);
    assert.ok(ignoredOf(now).includes(k), `★'${k}' 이 조용해졌다 — 말은 계속해야 한다`);
    assert.doesNotMatch(hintOf(now), /CLAMPED to/, `★'${k}' 에 «잘랐다»고 말한다 — 안 잘랐다(거짓말이다)`);
  }
});
