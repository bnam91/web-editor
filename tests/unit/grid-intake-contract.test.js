/* grid-intake-contract.test.js — 그리드 «입구 계약». (U-gate, 2026-09-24)
 * 실행: node --test tests/unit/grid-intake-contract.test.js
 * 기준선: 7780267 (origin/dev) · 나무: scratchpad/wt-u-gate · 브랜치 fix/0924-u-gate
 *
 * ★무엇을 닫는가 — 카드 넷이 «같은 병»이다(단위 U-33)
 *   T-170  열 입구(cols/patchCol)에 문지기가 0건 · 이미지 상한이 그 문에서 안 걸린다
 *          ＋ ㈑ 칸 «가로» 정렬의 명부 밖 값이 style 속성으로 «그대로 새 나간다»
 *   T-175  같은 잘못된 값을 도구는 거절하고 렌더러는 관용한다 — 무엇이 옳은 값인지 아무도 모른다
 *   T-176  행·열을 줄이면 잘린 칸이 사라지는데 «도구»는 아무 말이 없다 (⛔동작은 안 바꾼다)
 *   T-180  칸 «세로» 정렬에 명부 밖 값을 주면 조용히 위로 붙는데 「됐습니다」로 돌아온다
 *
 * ★이 파일이 재지 «않는» 것 — tests/unit/grid-render-gaps.test.js 의 X* 축이 이미 잰다
 *   (모르는 «칸 필드» · 명부 밖 align/valign 값을 네 문이 거절하거나 말하는가).
 *   ⛔그래서 여기서 그것을 되풀이하지 않는다. 여기는 «그 파일이 안 재는 넷»이다:
 *     U1  이미지 상한이 네 문에서 «같은 자»로 걸리나 (＋ 새 값/이미 있던 값 가르기)
 *     U2  파괴적 교체를 «도구»가 말하나 — 그리고 «동작은 한 바이트도 안 바뀌었나»
 *     U3  ★T-175 의 본질 — 「문이 받아 주는 값」과 「렌더러가 뜻을 주는 값」이 «같은 집합»인가
 *     U4  `applied` 가 「안 됐다」고 한 값을 들고 있지 않나 (같은 답 안의 자기모순)
 *     U5  ★네 문이 정말 «한 함수»를 지나나 — 그 함수 하나를 떼면 넷이 «같이» 뚫리나
 *
 * ★재는 «양» — 「API 가 ok 를 줬다」가 아니라 «그려진 것»과 «저장된 것»이다.
 *   U3 는 이름이나 상수를 안 읽는다. 값을 실제로 넣고 «화면이 달라지는가»로 잰다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const SRC_PATH = path.join(ROOT, 'js', 'blocks', 'grid-block.js');
const RAW = readSrc(SRC_PATH);

/* ══ 미니 DOM — grid-patchcell-reject.test.js 와 «같은 표면»(새 하네스를 만들지 않는다) ══ */
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
  const before1 = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, before1, '★소스에서 drag-utils/drag-drop import 2줄을 못 찾았다 — 리팩터링됐나?');

  const tag = `${process.pid}-${++_seq}`;
  const gcrAlias = path.join(os.tmpdir(), `gcr-ic-${tag}.mjs`);
  const before2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, before2, '★grid-cell-resize.js import 를 못 찾았다 — 행높이 상한 SSOT 가 끊겼나?');

  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcrAlias);
  const alias = path.join(os.tmpdir(), `grid-ic-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcrAlias);
  return mod;
}

let G;
before(async () => { G = await loadGrid(); });

/** 2×2 그리드. 네 칸 모두 줄이 하나씩 있다(잘림이 «실제로 뭔가를 잃게» 만들려고). */
function fixture(mod = G) {
  const { block: b } = mod.makeGridBlock({
    cols: [{ width: 1, lines: [{ type: 'body', text: 'R0C0' }] },
           { width: 1, lines: [{ type: 'body', text: 'R0C1' }] }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [[{ lines: [{ type: 'body', text: 'R0C0' }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
            [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }]],
  });
  assert.ok(b && b.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  return b;
}
const snap = (b) => JSON.stringify({ cols: b.dataset.cols, rows: b.dataset.rows, cells: b.dataset.cells });

/** 길이 n 의 가짜 dataURL — grid-line-add.test.mjs 와 같은 수법(앞머리는 진짜 모양). */
function fakeDataUrl(n) {
  const head = 'data:image/png;base64,';
  return head + 'A'.repeat(Math.max(0, n - head.length));
}

/** 「칸 (0,0) 에 이 꾸밈/줄을 싣는」 네 가지 길. grid-render-gaps.test.js 의 WRITE_PATHS 와 같은 얼개. */
const SEED = () => [{ type: 'body', text: 'R0C0' }];
const WRITE_PATHS = [
  { key: 'patchCell', send: (m, b, f) => m.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, ...f } }) },
  { key: 'patchCol', send: (m, b, f) => m.updateGridBlock(b.id, { patchCol: { index: 0, ...f } }) },
  { key: 'cols', send: (m, b, f) => m.updateGridBlock(b.id, { cols: [{ width: 1, lines: SEED(), ...f }, { width: 1, lines: [] }] }) },
  { key: 'cells', send: (m, b, f) => m.updateGridBlock(b.id, { cells: [[{ lines: SEED(), ...f }, { lines: [] }]] }) },
];

/* 한 «줄»의 여는 태그 — 주소로 집는다(DOM 순서를 추측하지 않는다). */
function lineTagAt(b, r, c, li) {
  const needle = ` data-r="${r}" data-c="${c}" data-line="${li}"`;
  const at = b.innerHTML.indexOf(needle);
  if (at < 0) return null;
  const open = b.innerHTML.lastIndexOf('<', at);
  const close = b.innerHTML.indexOf('>', at);
  return (open >= 0 && close > open) ? b.innerHTML.slice(open, close + 1) : null;
}
function cellTagAt(b, r, c) {
  const m = b.innerHTML.match(new RegExp(`<div class="grd-cell[^"]*" data-r="${r}" data-c="${c}"[^>]*>`));
  return m ? m[0] : null;
}
const cssOf = (tag, prop) => {
  const m = tag && tag.match(new RegExp(`(?:^|[;"])${prop}:([^;"]*)`));
  return m ? m[1] : null;
};

/* ═══════════════════════════════════════════════════════════════════════
   U0 — 자가점검. ⛔이게 빨가면 아래는 전부 «다른 이유»로 초록일 수 있다
   ═══════════════════════════════════════════════════════════════════════ */

test('U0 ★자가점검 — 판이 깔리고, 상한이 실재하고, 네 길이 «다 닿는다»', () => {
  assert.ok(Number.isFinite(G.GRID_IMG_MAX_CHARS) && G.GRID_IMG_MAX_CHARS > 1000,
    `★이미지 상한을 못 읽었다(${G.GRID_IMG_MAX_CHARS}) — U1 은 아무것도 안 잰다`);
  for (const p of WRITE_PATHS) {
    const b = fixture();
    const res = p.send(G, b, { bg: '#123456' });
    assert.equal(res.ok, true, `★'${p.key}' 길이 애초에 안 닿는다: ${res.message}`);
    assert.match(cellTagAt(b, 0, 0), /background:#123456/,
      `★'${p.key}' 로 준 값이 칸에 안 그려진다 — 이 길로 재는 단언은 전부 헛것이다`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   U1 — T-170 ⑶ 이미지 상한. «네 문이 같은 자로 재는가»
   고치기 전: patchCell «한 문»만 쟀다. cols/patchCol/cells 는 20만 자를 그대로 삼켰다.
   ═══════════════════════════════════════════════════════════════════════ */

test('U1 ★네 문이 «같은 자»로 이미지 상한을 잰다 — 그리고 거절 뒤 저장본이 안 변했다', () => {
  const big = fakeDataUrl(G.GRID_IMG_MAX_CHARS + 1);
  for (const p of WRITE_PATHS) {
    const b = fixture();
    const before = snap(b);
    const res = p.send(G, b, { lines: [{ type: 'image', imgSrc: big }] });
    assert.equal(res.ok, false,
      `★'${p.key}' 가 ${big.length}자 이미지를 그대로 받았다 — 그 프로젝트는 무거워져 사람 쪽으로 온다`);
    assert.equal(res.code, 'TOO_LARGE', `★'${p.key}' 가 «다른 이유»로 거절했다: ${res.message}`);
    assert.equal(snap(b), before,
      `★'${p.key}': 거절했다고 «말만» 하고 저장본은 이미 커졌다 — 거절이 부분 적용을 남기면 거절이 아니다`);
    assert.doesNotMatch(b.innerHTML, new RegExp(big.slice(0, 60)),
      `★'${p.key}': 거절했는데 화면에는 그려졌다`);
  }
});

test('U1-b ★음성대조 — 상한 «아래» 이미지는 네 문 다 통과하고 실제로 그려진다', () => {
  const small = fakeDataUrl(1024);
  for (const p of WRITE_PATHS) {
    const b = fixture();
    const res = p.send(G, b, { lines: [{ type: 'image', imgSrc: small, height: 120 }] });
    assert.equal(res.ok, true, `★'${p.key}' 가 멀쩡한 1KB 이미지를 막았다: ${res.message}`);
    assert.match(b.innerHTML, /<img[^>]*class="grd-img"/,
      `★'${p.key}' 로 넣은 작은 이미지가 «안 그려진다» — 통과가 곧 반영은 아니다`);
  }
});

test('U1-c ★양성대조 — 상한 검사를 «뺀» 사본은 cols 로 20만 자를 그대로 삼킨다', async () => {
  const mutated = RAW.replace(
    /if \(!trusted && typeof v === 'string' && v\.length > GRID_IMG_MAX_CHARS\) oversize\.push\(\{ where, v, addr \}\);/,
    '');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const b = fixture(M);
  const big = fakeDataUrl(M.GRID_IMG_MAX_CHARS + 1);
  const res = M.updateGridBlock(b.id, { cols: [{ width: 1, lines: [{ type: 'image', imgSrc: big }] }, { width: 1, lines: [] }] });
  assert.equal(res.ok, true, '★상한 검사를 뺐는데도 거절된다 — U1 이 재는 것은 «이 검사»가 아니다');
  assert.ok(b.dataset.cols.length > M.GRID_IMG_MAX_CHARS,
    '★통과는 했는데 저장본이 안 커졌다 — 그렇다면 구멍의 모양이 내 진단과 다르다');
});

test('U1-d ★「새로 들여오는 것」과 「그 칸에 이미 있던 것」을 가른다', () => {
  const big = fakeDataUrl(G.GRID_IMG_MAX_CHARS + 1);
  const b = fixture();
  /* 사람이 파일 대화상자로 고른 길(trusted) — 바이트로 이미 걸렀으므로 캡을 건너뛴다 */
  const put = G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lines: [{ type: 'image', imgSrc: big }] } }, { trusted: true });
  assert.equal(put.ok, true, `★UI 입구(trusted)가 막혔다 — 0920b 회귀다: ${put.message}`);

  /* ㈎ «그 칸»을 지나가기만 하는 되쓰기는 안 막힌다(자기 그림에 자기가 막히면 안 된다) */
  const pass = G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0,
    lines: [{ type: 'image', imgSrc: big }, { type: 'body', text: '설명' }] } });
  assert.equal(pass.ok, true,
    `★그 칸에 «이미 있던» 그림을 그대로 되보냈는데 막혔다 — 정상 왕복(read→고쳐→되쓰기)이 죽는다: ${pass.message}`);
  assert.equal(G.getGridModel(b).cells[1][0].lines.length, 2, '★통과했다면서 줄이 안 늘었다');

  /* ㈏ «다른 칸»으로 베끼는 것은 막힌다 — IPC 문자열을 새로 싣는 것이라 캡의 명분에 걸린다 */
  const copy = G.updateGridBlock(b.id, { patchCell: { r: 1, c: 1, lines: [{ type: 'image', imgSrc: big }] } });
  assert.equal(copy.ok, false,
    '★큰 그림을 다른 칸으로 «베끼는» 길이 열렸다 — 「블록 어딘가에 있으면 통과」로 넓힌 것이다');
  assert.equal(copy.code, 'TOO_LARGE');
});

/* ═══════════════════════════════════════════════════════════════════════
   U2 — T-176 파괴적 교체. ⛔동작은 «한 바이트도» 안 바꾼다. 도구가 «말하게»만 한다
   ═══════════════════════════════════════════════════════════════════════ */

const shrinkRows = (m, b) => m.updateGridBlock(b.id, { rows: [{ height: 'auto' }] });
const shrinkCols = (m, b) => m.updateGridBlock(b.id, { cols: [{ width: 1, lines: SEED() }] });

test('U2 ★행·열을 줄이면 도구가 «파괴적 교체»라고 말한다 — 무엇이 없어졌는지까지', () => {
  for (const [axis, shrink] of [['rows', shrinkRows], ['cols', shrinkCols]]) {
    const b = fixture();
    const res = shrink(G, b);
    assert.equal(res.ok, true, `★${axis} 줄이기가 거절됐다 — 이 카드는 동작을 바꾸지 않는다: ${res.message}`);
    assert.ok(res.destructive, `★${axis} 를 줄였는데 도구가 아무 말도 안 한다(화면 쪽은 이미 말한다)`);
    assert.ok(res.destructive.droppedCells.length > 0,
      `★${axis}: 잘린 칸이 «있는데» 0건으로 셌다 — 모델을 «바꾼 뒤»에 재고 있다`);
    assert.match(res.hint, /DESTRUCTIVE REPLACE/, `★${axis}: hint 에 그 말이 안 실렸다`);
    assert.match(res.hint, /undo|⌘Z/, `★${axis}: 「되돌릴 수 있다」를 안 말한다 — 그게 이 안내의 절반이다`);
  }
});

test('U2-b ★음성대조 — 늘리거나 «그대로»면 아무 말도 안 한다(아무 때나 겁주지 않는다)', () => {
  const grow = G.updateGridBlock(fixture().id, { rows: [{ height: 'auto' }, { height: 'auto' }, { height: 'auto' }] });
  assert.equal(grow.destructive, undefined, '★늘렸는데 «파괴적»이라고 한다 — 그러면 이 쪽지는 아무 뜻이 없다');
  const same = G.updateGridBlock(fixture().id, { rows: [{ height: 'auto' }, { height: 40 }] });
  assert.equal(same.destructive, undefined, '★행 수가 그대로인데 «파괴적»이라고 한다');
  const deco = G.updateGridBlock(fixture().id, { patchCell: { r: 0, c: 0, bg: '#eee' } });
  assert.equal(deco.destructive, undefined, '★칸 꾸밈을 바꿨을 뿐인데 «파괴적»이라고 한다');
});

test('U2-c ★양성대조 — 쪽지를 «뗀» 사본은 같은 호출에서 아무 말 없이 지나간다', async () => {
  const mutated = RAW.replace(/\n  if \(_destructive\) \{\n[\s\S]*?\n  \}\n/, '\n');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const res = shrinkRows(M, fixture(M));
  assert.equal(res.ok, true);
  assert.equal(res.destructive, undefined,
    '★쪽지 붙이는 코드를 뗐는데도 쪽지가 있다 — U2 가 재는 것은 «그 코드»가 아니다');
});

test('U2-d ★★동작 불변 — 쪽지가 붙어도 잘림은 «바이트 동일»이다(이 카드는 동작을 안 바꾼다)', async () => {
  const mutated = RAW.replace(/\n  if \(_destructive\) \{\n[\s\S]*?\n  \}\n/, '\n');
  assert.notEqual(mutated, RAW, '★변이가 주입되지 않았다');
  const M = await loadGrid(mutated);
  for (const shrink of [shrinkRows, shrinkCols]) {
    const a = fixture(G); shrink(G, a);
    const c = fixture(M); shrink(M, c);
    assert.equal(snap(a), snap(c),
      '★쪽지를 붙이면서 «저장본»이 달라졌다 — 이 카드는 「줄여도 남긴다」로 바꾸는 일이 아니다');
    assert.equal(a.innerHTML, c.innerHTML, '★쪽지를 붙이면서 «화면»이 달라졌다');
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   U3 — ★T-175 의 본질. 「문이 받아 주는 값」과 「렌더러가 뜻을 주는 값」이 «같은 집합»인가
   ⛔상수도 이름도 안 읽는다. 값을 실제로 넣고 «화면이 달라지는가»로만 잰다.
     받아 준 값 → 저마다 «다른 화면»을 만든다(진짜 뜻이 있다)
     안 받아 준 값 → «안 준 것»과 같은 화면이 된다(뜻이 없다 = 관용이 아니라 무시였다)
   ═══════════════════════════════════════════════════════════════════════ */

/* 명부 «안»일 법한 것 ＋ 오타 ＋ 프로토타입 이름 ＋ 진짜 CSS 인데 명부 밖인 것. */
const ALIGN_PROBES = ['left', 'center', 'right', 'centre', 'Center', 'justify', 'constructor', 'toString', 'start'];
const VALIGN_PROBES = ['top', 'middle', 'bottom', 'center', 'centre', 'constructor', 'valueOf', 'baseline'];

/** 이 값을 «칸»에 주면 ⑴ 받아 줬나 ⑵ 화면의 그 속성이 무엇이 됐나. */
function probeCell(field, v, prop) {
  const b = fixture();
  const res = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, [field]: v } });
  const tag = field === 'align' ? lineTagAt(b, 0, 0, 0) : cellTagAt(b, 0, 0);
  return { taken: res.ok === true && !(res.ignoredProps || []).some(p => p.endsWith(`.${field}`)), drawn: cssOf(tag, prop) };
}
function probeAbsent(field, prop) {
  const b = fixture();
  const tag = field === 'align' ? lineTagAt(b, 0, 0, 0) : cellTagAt(b, 0, 0);
  return cssOf(tag, prop);
}

for (const [field, prop, probes] of [['align', 'text-align', ALIGN_PROBES], ['valign', 'justify-content', VALIGN_PROBES]]) {
  test(`U3-${field} ★받아 준 값은 «저마다 다른 화면»을 만들고, 안 받아 준 값은 «안 준 것»과 같다`, () => {
    const none = probeAbsent(field, prop);
    const taken = [], refused = [];
    for (const v of probes) {
      const r = probeCell(field, v, prop);
      (r.taken ? taken : refused).push({ v, drawn: r.drawn });
    }
    assert.ok(taken.length >= 2, `★받아 준 값이 ${taken.length}개뿐이다 — 문이 통째로 닫혔나?`);
    assert.ok(refused.length >= 2, `★거절된 값이 ${refused.length}개뿐이다 — 이 축은 아무것도 안 쟀다`);

    /* ⑴ 받아 준 값은 «저마다» 다른 화면이어야 한다 — 같으면 그 중 하나는 뜻이 없는데 받아 준 것이다 */
    const drawnSet = new Set(taken.map(t => t.drawn));
    assert.equal(drawnSet.size, taken.length,
      `★받아 준 값 ${taken.map(t => `${t.v}→${t.drawn}`).join(', ')} 중 «같은 화면»이 있다 —\n`
      + '  뜻이 없는 값을 받아 주고 있다(= 도구는 ok, 화면은 그대로 = 거짓 성공)');

    /* ⑵ 거절한 값은 «안 준 것»과 같은 화면이어야 한다 — 다르면 명부 밖 값이 화면까지 새 나간 것이다 */
    const leaked = refused.filter(r => r.drawn !== none);
    assert.deepEqual(leaked.map(r => `${r.v}→${r.drawn}`), [],
      `★거절한 값이 화면 CSS 로는 «그대로 나갔다»(안 준 것은 ${prop}:${none}).\n`
      + '  ⇒ 도구는 「안 된다」고 하는데 렌더러는 그 값을 style 속성에 싣고 있다 —\n'
      + '     그게 T-175 가 말한 「도구는 거절, 렌더러는 관용」이고 T-170 ㈑ 의 «새 나감»이다');
  });
}

test('U3-c ★양성대조 — 정렬 명부를 «표 없이» 되돌린 사본에선 오타가 화면으로 새 나간다', async () => {
  const mutated = RAW.replace(
    'const _gridAlign = (lineAlign, colAlign) =>\n  _gridEnum(_GRID_ALIGN, lineAlign) || _gridEnum(_GRID_ALIGN, colAlign) || \'left\';',
    "const _gridAlign = (lineAlign, colAlign) => lineAlign || colAlign || 'left';");
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const b = fixture(M);
  /* ⛔입구가 아니라 «렌더러»를 잰다 — 입구를 지나지 않고 저장본에서 바로 그리는 길로 넣는다.
     (저장본 로드가 정확히 이 길이다: dataset → renderGridBlock) */
  b.dataset.cells = JSON.stringify([[{ align: 'centre' }, {}], [{}, {}]]);
  M.renderGridBlock(b);
  assert.equal(cssOf(lineTagAt(b, 0, 0, 0), 'text-align'), 'centre',
    '★표를 없앴는데도 오타가 안 샌다 — U3-align 이 재는 것은 «그 표»가 아니다');
});

test('U3-d ★프로토타입 이름도 «표 밖»이다 — align:\'constructor\' 가 style 속성으로 안 샌다', () => {
  const b = fixture();
  b.dataset.cells = JSON.stringify([[{ align: 'constructor', valign: 'constructor' }, {}], [{}, {}]]);
  G.renderGridBlock(b);
  const line = lineTagAt(b, 0, 0, 0), cell = cellTagAt(b, 0, 0);
  assert.doesNotMatch(String(line) + String(cell), /function|Object|\[native code\]/,
    '★프로토타입에서 «참인 값»을 꺼내 style 속성에 실었다 — 표를 둬도 남는 구멍이 여기다');
  assert.equal(cssOf(line, 'text-align'), 'left', '★모르는 이름이 왼쪽으로 안 떨어졌다');
});

/* ═══════════════════════════════════════════════════════════════════════
   U4 — 같은 답 «안»의 자기모순. 「안 됐다」고 한 값이 `applied` 에 들어 있으면 안 된다
   ═══════════════════════════════════════════════════════════════════════ */

test('U4 ★「안 됐다」고 한 값은 applied 에 없다 — 통째 교체 두 문에서', () => {
  for (const key of ['cols', 'cells']) {
    const b = fixture();
    const res = key === 'cols'
      ? G.updateGridBlock(b.id, { cols: [{ width: 1, lines: SEED(), valign: 'center', gdtProbe: 'x' }, { width: 1, lines: [] }] })
      : G.updateGridBlock(b.id, { cells: [[{ lines: SEED(), valign: 'center', gdtProbe: 'x' }, { lines: [] }]] });
    assert.equal(res.ok, true, `★'${key}': 통째 교체는 «거절»이 아니라 «보고»여야 한다 — 정상 왕복이 죽는다`);
    assert.ok(Array.isArray(res.ignoredProps) && res.ignoredProps.length >= 2,
      `★'${key}': 모르는 값·모르는 이름을 «조용히» 삼켰다 — ignoredProps:${JSON.stringify(res.ignoredProps)}`);
    const appliedStr = JSON.stringify(res.applied || {});
    assert.doesNotMatch(appliedStr, /"valign":"center"/,
      `★'${key}': 「안 먹었다」고 해 놓고 applied 엔 그 값을 담아 돌려줬다 — 한 답 안의 자기모순이다`);
    assert.doesNotMatch(appliedStr, /gdtProbe/, `★'${key}': 모르는 이름이 applied 에 그대로 메아리쳤다`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   U5 — ★★「문 하나를 지나게 모았나」를 «행위»로 잰다
   ⛔`_gridIntake` 라는 «이름»을 세지 않는다. 그 함수 하나를 무력화했을 때
     네 문이 «같이» 뚫리는가로 잰다 — 그게 「한 곳에 모였다」의 유일한 증거다.
   ═══════════════════════════════════════════════════════════════════════ */

test('U5 ★★양성대조 — 계약 함수 «하나»를 무력화하면 네 문이 «같이» 뚫린다', async () => {
  const mutated = RAW.replace(
    /function _gridIntake\(partial, ctx, drops\) \{/,
    'function _gridIntake(partial, ctx, drops) { if (partial) return null;');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);

  const holes = [];
  const big = fakeDataUrl(M.GRID_IMG_MAX_CHARS + 1);
  for (const p of WRITE_PATHS) {
    const b1 = fixture(M);
    if (p.send(M, b1, { lines: [{ type: 'image', imgSrc: big }] }).ok === true) holes.push(`${p.key}:이미지상한`);
    const b2 = fixture(M);
    const r2 = p.send(M, b2, { valign: 'center' });
    if (r2.ok === true && !(r2.ignoredProps || []).some(x => x.endsWith('.valign'))) holes.push(`${p.key}:모르는값`);
  }
  assert.equal(holes.length, WRITE_PATHS.length * 2,
    `★한 함수를 뗐는데 «일부 문만» 뚫렸다(${holes.length}/${WRITE_PATHS.length * 2}: ${holes.join(', ')}).\n`
    + '  ⇒ 계약이 아직 «여러 자리»에 흩어져 있다는 뜻이다 — 문이 하나 더 생기면 또 빠진다');

  /* 음성대조: 안 건드린 원본에선 같은 여덟 자리가 «전부» 막힌다 */
  const still = [];
  for (const p of WRITE_PATHS) {
    const b1 = fixture();
    if (p.send(G, b1, { lines: [{ type: 'image', imgSrc: big }] }).ok === true) still.push(`${p.key}:이미지상한`);
    const b2 = fixture();
    const r2 = p.send(G, b2, { valign: 'center' });
    if (r2.ok === true && !(r2.ignoredProps || []).some(x => x.endsWith('.valign'))) still.push(`${p.key}:모르는값`);
  }
  assert.deepEqual(still, [], `★원본에도 구멍이 남아 있다: ${still.join(', ')}`);
});

/* ═══════════════════════════════════════════════════════════════════════
   U6 — «만드는 문»(add_grid_block) 도 자원 가드를 지난다
   ⚠️★여기서 닫히는 것은 «자원 가드 하나»뿐이다 — add 쪽은 부분 적용을 «보고할 칸»이 없다
     (돌려주는 것이 {row, block} 이다). 「모르는 값을 말해 준다」 축은 이 문에서 «안 닫혔다».
     ⛔조용히 버리는 쪽으로 때우지 않았다. 그건 반환 규약을 바꾸는 별건이다.
   ═══════════════════════════════════════════════════════════════════════ */

test('U6 ★만드는 문도 이미지 상한을 지난다 — 20만 자를 «처음부터» 심을 수 없다', () => {
  const big = fakeDataUrl(G.GRID_IMG_MAX_CHARS + 1);
  const r = G.addGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', imgSrc: big }] }] });
  assert.ok(r && r.ok === false, '★만드는 문이 20만 자를 그대로 받았다 — 고치는 문 넷만 막으면 여기로 들어온다');
  assert.equal(r.code, 'TOO_LARGE');
});

test('U6-b ★음성대조 — 작은 이미지는 «상한»에 안 걸린다(이 가드가 통째 거절이 아니다)', () => {
  /* ⛔여기서 «만들어졌는가»는 안 잰다 — 이 미니 DOM 엔 선택된 섹션이 없어 addGridBlock 이
     어차피 null 로 끝난다. 재는 것은 「TOO_LARGE 로 막히지는 않는다」 하나다. */
  const r = G.addGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', imgSrc: fakeDataUrl(1024) }] }] });
  assert.ok(!(r && r.code === 'TOO_LARGE'),
    '★1KB 이미지가 상한에 걸렸다 — 이 가드는 «크기»가 아니라 아무거나 막고 있다');
});

test('U7 ★줄 개수 상한도 네 문이 «같이» 잰다 — 자원 가드는 통째 교체 문에서도 «거절»이다', () => {
  const tooMany = Array.from({ length: 21 }, () => ({ type: 'body', text: 'y' }));
  for (const p of WRITE_PATHS) {
    if (p.key === 'patchCell') continue;   // 이 문은 옛날부터 쟀다 — 대조군으로 아래에서 따로 본다
    const b = fixture();
    const before = snap(b);
    const res = p.send(G, b, { lines: tooMany });
    assert.equal(res.ok, false, `★'${p.key}' 가 21줄을 그대로 받았다 — 「+ 줄 추가」 무한증식과 같은 자리다`);
    assert.equal(res.code, 'TOO_MANY_LINES', `★'${p.key}' 가 «다른 이유»로 거절했다: ${res.message}`);
    assert.equal(snap(b), before, `★'${p.key}': 거절했다면서 저장본은 이미 늘었다`);
  }
  const ctrl = G.updateGridBlock(fixture().id, { patchCell: { r: 0, c: 0, lines: tooMany } });
  assert.equal(ctrl.code, 'TOO_MANY_LINES', '★대조군(patchCell)마저 안 잰다 — 이 축 자체가 죽었다');
  /* 음성대조 — 상한 «안»(20줄)은 네 문 다 통과한다 */
  const ok20 = Array.from({ length: 20 }, () => ({ type: 'body', text: 'y' }));
  for (const p of WRITE_PATHS) {
    const r = p.send(G, fixture(), { lines: ok20 });
    assert.equal(r.ok, true, `★'${p.key}' 가 상한 «안»인 20줄을 막았다: ${r.message}`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════
   U8 — ★⑵ 아는 이름인데 모르는 «값». ⛔셋 중 제일 나쁘다: «옛 값까지 죽인다»
   실측(기준 7780267, 행 0·행 1 둘 다): patchCell{bg:'linear-gradient(…)'} → ok:true ·
     applied 에 그대로 실려 돌아오고 · 화면은 배경 없음 · ★있던 #00ff00 이 사라졌다.
     대조로 line.color:'초록색' 은 ok:false 였다 — 같은 「모르는 값」인데 방향이 반대였다.
   ★잣대는 «렌더러가 이미 쓰는 그 정규식»이다. 새로 만들지 않았다.
   ═══════════════════════════════════════════════════════════════════════ */

const BAD_BG = 'linear-gradient(90deg,#f00,#00f)';

test('U8 ★모르는 «값»이 «있던 값을 죽이는» 것을 막는다 — 행 0·행 1 둘 다', () => {
  for (const r of [0, 1]) {
    const b = fixture();
    assert.equal(G.updateGridBlock(b.id, { patchCell: { r, c: 0, bg: '#00ff00' } }).ok, true, '★전제가 안 깔린다');
    const was = cssOf(cellTagAt(b, r, 0), 'background');
    assert.equal(was, '#00ff00', '★멀쩡한 배경이 애초에 안 들어갔다 — 아래 단언은 헛것이다');

    const res = G.updateGridBlock(b.id, { patchCell: { r, c: 0, bg: BAD_BG } });
    assert.equal(res.ok, false, `★r=${r}: 렌더러가 «안 받는» 값을 도구가 받았다 — 화면엔 안 그려지는데 ok 다`);
    assert.doesNotMatch(JSON.stringify(res.applied || {}), /linear-gradient/,
      `★r=${r}: 안 그려질 값을 applied 에 실어 돌려줬다`);
    assert.equal(cssOf(cellTagAt(b, r, 0), 'background'), was,
      `★r=${r}: ★★있던 배경이 죽었다 — 이 카드에서 유일한 «데이터 손실» 갈래다`);
  }
});

test('U8-b ★같은 잣대가 «줄» 축에도 같은 답을 한다 — 색·글꼴', () => {
  const bad = [
    ['color', '초록색'],
    ['fontFamily', 'Noto; color:red'],   // ⛔세미콜론 — 렌더러 _GRID_FONT_RE 가 막는 자리
    ['bg', BAD_BG],
  ];
  for (const [k, v] of bad) {
    const res = G.updateGridBlock(fixture().id, { patchCell: { r: 0, c: 0, lineIndex: 0, [k]: v } });
    assert.equal(res.ok, false, `★줄의 '${k}' 에 렌더러가 안 받는 값을 줬는데 통과했다`);
  }
});

test('U8-c ★음성대조 — 렌더러가 «받는» 색·글꼴 꼴은 네 문 다 통과하고 실제로 그려진다', () => {
  /* ⛔hex 만 재면 var() 칩(color-var-chips.js)이 막혀도 모른다 — 그 넷을 다 밟는다. */
  for (const v of ['#123456', 'rgba(1,2,3,0.5)', 'transparent', 'var(--color-brand, #ff0000)']) {
    for (const p of WRITE_PATHS) {
      const b = fixture();
      const res = p.send(G, b, { bg: v });
      assert.equal(res.ok, true, `★'${p.key}' 가 멀쩡한 bg:'${v}' 를 막았다: ${res.message}`);
      assert.ok(!(res.ignoredProps || []).some(x => x.endsWith('.bg')),
        `★'${p.key}' 가 멀쩡한 bg:'${v}' 를 「안 됐다」고 했다`);
      if (v !== 'transparent') {
        assert.ok(String(cellTagAt(b, 0, 0)).includes(`background:${v}`),
          `★'${p.key}': bg:'${v}' 를 통과시켰는데 «안 그려진다»`);
      }
    }
  }
  const ff = G.updateGridBlock(fixture().id, { patchCell: { r: 0, c: 0, lineIndex: 0, fontFamily: 'Noto Sans KR, 맑은 고딕' } });
  assert.equal(ff.ok, true, `★멀쩡한 글꼴 이름을 막았다: ${ff.message}`);
});

test('U8-d ★양성대조 — 값 잣대를 «뺀» 사본은 gradient 를 받고 옛 배경을 죽인다', async () => {
  const mutated = RAW.replace(/\n  for \(const k of Object\.keys\(GRID_VALUE_TESTS\)\) \{\n[\s\S]*?\n  \}\n/, '\n');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const b = fixture(M);
  M.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, bg: '#00ff00' } });
  const res = M.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, bg: BAD_BG } });
  assert.equal(res.ok, true, '★잣대를 뺐는데도 거절된다 — U8 이 재는 것은 «그 잣대»가 아니다');
  assert.equal(cssOf(cellTagAt(b, 1, 0), 'background'), null,
    '★통과했는데 배경이 «안» 죽었다 — 그렇다면 데이터 손실의 모양이 내 진단과 다르다');
});

/* ═══════════════════════════════════════════════════════════════════════
   U9 — ★⑶ 한계를 넘긴 값. ⛔막지 «않는다» — 자르되 «잘랐다»고 말한다
   ★왜 ⑵ 와 처방이 다른가: ⑵는 「부른 쪽이 원한 적 없는 결과」라 되돌릴 근거가 있고,
     ⑶은 「한계가 원래 그렇다」라 막으면 그건 «동작 변경»이다(T-176 과 같은 갈래).
   ═══════════════════════════════════════════════════════════════════════ */

const deepDuo = (n, leaf) => (n === 0 ? { type: 'body', text: leaf }
  : { type: 'duo', cols: [{ width: 1, lines: [deepDuo(n - 1, leaf)] }] });

test('U9 ★한계를 넘긴 중첩은 «그대로 잘리되» 도구가 잘랐다고 말한다', () => {
  const b1 = fixture();
  const r1 = G.updateGridBlock(b1.id, { patchCell: { r: 0, c: 0, lines: [deepDuo(3, '깊이3')] } });
  assert.equal(r1.ok, true, '★거절했다 — 이 갈래는 «동작을 바꾸지 않는다»(자르는 것이 정해진 동작이다)');
  assert.doesNotMatch(b1.innerHTML, /깊이3/, '★한계를 넘긴 중첩이 그려졌다 — 동작이 바뀌었다');
  assert.ok((r1.ignoredProps || []).length > 0, '★조용히 사라졌다 — ok:true 인데 화면엔 없고 아무 말도 없다');
  assert.match(r1.hint, /nested grid renders/, `★«무엇이» 잘렸는지 안 말한다: ${r1.hint}`);

  const b2 = fixture();
  const four = { type: 'duo', cols: [1, 2, 3, 4].map(i => ({ width: 1, lines: [{ type: 'body', text: '열' + i }] })) };
  const r2 = G.updateGridBlock(b2.id, { patchCell: { r: 0, c: 0, lines: [four] } });
  assert.equal(r2.ok, true, '★거절했다 — 동작을 바꾸면 안 된다');
  assert.equal((b2.innerHTML.match(/grd-nested-col/g) || []).length, 3, '★그려진 중첩 열 수가 달라졌다 — 동작이 바뀌었다');
  assert.ok((r2.ignoredProps || []).some(p => /cols\[3/.test(p)),
    `★넷째 열이 «말없이» 잘렸다 — ignoredProps:${JSON.stringify(r2.ignoredProps)}`);
});

test('U9-b ★음성대조 — 한계 «안»의 중첩은 아무 말도 안 듣고 그려진다', () => {
  const b = fixture();
  const ok = { type: 'duo', cols: [1, 2, 3].map(i => ({ width: 1, lines: [{ type: 'body', text: '열' + i }] })) };
  const res = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [deepDuo(2, '깊이2')] } });
  assert.equal(res.ignoredProps, undefined, `★한계 «안»인 2단계를 「잘렸다」고 했다: ${res.hint}`);
  assert.match(b.innerHTML, /깊이2/, '★한계 안인데 안 그려진다');
  const r2 = G.updateGridBlock(fixture().id, { patchCell: { r: 0, c: 0, lines: [ok] } });
  assert.equal(r2.ignoredProps, undefined, `★한계 «안»인 3열을 「잘렸다」고 했다: ${r2.hint}`);
});

test('U9-c ★★동작 불변 — 말을 붙여도 «잘린 결과»는 바이트 동일이다', async () => {
  const mutated = RAW.replace(
    /\n      _gridInspectNested\(ln, `\$\{where\}\.lines\[\$\{i\}\]`, 0, drops\);.*\n/,
    '\n');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  for (const payload of [deepDuo(3, '깊이3'),
    { type: 'duo', cols: [1, 2, 3, 4].map(i => ({ width: 1, lines: [{ type: 'body', text: '열' + i }] })) }]) {
    const a = fixture(G); G.updateGridBlock(a.id, { patchCell: { r: 0, c: 0, lines: [payload] } });
    const c = fixture(M); M.updateGridBlock(c.id, { patchCell: { r: 0, c: 0, lines: [payload] } });
    assert.equal(a.innerHTML, c.innerHTML, '★말을 붙이면서 «화면»이 달라졌다 — 이 갈래는 동작을 안 바꾼다');
    assert.equal(snap(a), snap(c), '★말을 붙이면서 «저장본»이 달라졌다');
  }
  const res = M.updateGridBlock(fixture(M).id, { patchCell: { r: 0, c: 0, lines: [deepDuo(3, '깊이3')] } });
  assert.ok(!(res.ignoredProps || []).some(p => /cols/.test(p)) || res.ok === true,
    '★변이본이 여전히 그 말을 한다 — U9 가 재는 것은 «그 보고»가 아니다');
});
