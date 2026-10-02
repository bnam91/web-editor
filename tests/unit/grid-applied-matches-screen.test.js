/* grid-applied-matches-screen.test.js — 「적용 목록」이 «화면과 같은 말을 하는가». (T-122)
 * 실행: node --test tests/unit/grid-applied-matches-screen.test.js
 *
 * ★무엇이 문제였나 (2026-09-22 실측)
 *   `update_block{patchCell:{r,c,lineIndex,imgSrc}}` 를 «글자 줄»에 주면 `ok:true` 가 오고
 *   `applied.patchCell.imgSrc` 에 보낸 값이 그대로 담겨 돌아왔다. 화면엔 글자 그대로고 그림 0개다.
 *   이름 검사(grid-patchcell-reject.test.js 가 지키는 것)는 «이름»만 본다 — `imgSrc` 는 명부에
 *   있으니 통과하고, 렌더러는 `line.type === 'image'` 일 때만 그 값을 읽는다. 이름은 맞고
 *   «줄 종류»가 어긋난 자리 — 2026-09-09 에 막은 거짓 성공의 2세대다.
 *   `cells` 통째 경로는 더 셌다: `applied.cells = partial.cells` 라 «입력을 그대로 메아리»쳤다.
 *   행이 배열이 아니어도, 셀 키가 통째로 버려져도, 보낸 것이 그대로 「적용됐다」로 돌아왔다.
 *
 * ★★이 파일이 재는 것 — 「돌려준 값」이 «아니라» 「돌려준 값과 화면이 일치하는가」다.
 *   돌려준 값만 재면 검사도 같은 거짓말을 그대로 믿는다. 그래서 단언의 «반대쪽»은 늘
 *   `b.innerHTML`(렌더러가 실제로 뱉은 것)이다.
 *     본 단언   A1·A2    — 안 그려질 값은 «적용» 목록에 없다(줄 patch)
 *     ★교차검사 A3·A4    — `applied.cells` 의 «잎» 하나하나가 화면에 실제로 닿는가
 *                          (그 잎을 빼면 화면이 달라져야 한다 — 안 달라지면 «담아만 둔» 값이다)
 *     음성대조  A5~A7    — 멀쩡한 것은 통과하고 «실제로 그려진다»(전부 거절하면 초록이 되는 검사 방지)
 *     양성대조  A8·A9    — 관문을 «뺀» 사본은 구멍이 살아나고, 이 검사가 그걸 «빨갛게» 잡는다
 *
 * ⛔「줄 종류별 필드표」를 이 파일에도, 구현에도 «손으로» 적지 않는다 — 그 표는 렌더러와 따로 늙는다.
 *   구현은 렌더러를 돌려 «민감도»로 재고(_gridLineFieldIsRead), 이 검사는 화면을 돌려 «민감도»로 잰다.
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

const IMG_URL = 'https://example.com/t122-probe.png';

/* ── 미니 DOM (grid-patchcell-reject.test.js 와 «같은 표면») ── */
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

/** 소스(그대로 또는 «변이본»)를 실제 모듈로 얹는다. 브라우저 전용 import 둘만 스텁. */
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
  const gcrAlias = path.join(os.tmpdir(), `gcr-ams-${tag}.mjs`);
  const before2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, before2, '★grid-cell-resize.js import 를 못 찾았다 — 행높이 상한 SSOT 가 끊겼나?');

  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcrAlias);
  const alias = path.join(os.tmpdir(), `grid-ams-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcrAlias);
  return mod;
}

let G;
before(async () => { G = await loadGrid(); });

/** 2행 2열, 두 칸에 «글자 줄» 하나씩. (카드의 재현 ① 그대로) */
function fixture(mod = G) {
  const { block: b } = mod.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.ok(b && b.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  mod.updateGridBlock(b.id, { rows: [{ height: 'auto' }, { height: 'auto' }] });
  mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'text', text: 'AAA' }] } });
  mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 1, lines: [{ type: 'text', text: 'BBB' }] } });
  return b;
}

/* ── 화면을 «재는» 자들 — 단언의 반대쪽은 늘 여기서 온다 ── */
const imgCount = (b) => (b.innerHTML.match(/class="grd-img"/g) || []).length;
const snap = (b) => JSON.stringify({ cols: b.dataset.cols, cells: b.dataset.cells, rows: b.dataset.rows });

/* ═══ 본 단언 — 안 그려질 값은 «적용» 목록에 없다 ════════════════════════ */

test('A1 ★글자 줄에 그림 주소만 — «됐다»가 오지 않고, 화면도 그대로다', () => {
  const b = fixture();
  const before = snap(b);
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, imgSrc: IMG_URL } });

  assert.equal(r.ok, false,
    '★ok:true 를 돌려줬다 — 적용된 것이 «하나도 없는» 호출이다(아래 화면 단언이 그 증거다)');
  assert.equal(r.code, 'INVALID');
  assert.match(r.message, /type:'text'/, '★«왜» 안 됐는지(줄 종류)를 안 말한다 — 부르는 쪽이 다음에 뭘 할지 모른다');
  assert.match(r.message, /type:'image'/, '★«무엇을 하라»까지 말해야 한다(줄 종류를 같이 바꿔라)');

  // ★반대쪽 — 화면. 「거절했다」는 말이 아니라 «안 그려졌다»가 증거다.
  assert.equal(imgCount(b), 0, '★거절해 놓고 그림이 그려졌다 — 진단이 틀렸다');
  assert.equal(snap(b), before, '★거절했다고 «말만» 하고 데이터는 이미 건드렸다 — 부분 적용이 남으면 거절이 아니다');
});

test('A2 ★부분 적용 — 된 것만 applied 에 담고, 안 된 것은 까닭과 함께 따로 돌려준다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 1, lineIndex: 0, text: 'B2', imgSrc: IMG_URL } });

  assert.equal(r.ok, true, `★통째로 실패시켰다 — text 는 «실제로» 그려졌다: ${r.message}`);
  assert.equal(r.applied.patchCell.text, 'B2');
  assert.ok(!('imgSrc' in r.applied.patchCell),
    '★안 그려진 값이 «적용» 목록에 담겨 돌아왔다 — 시킨 쪽은 됐다고 믿고 넘어간다');
  assert.deepEqual(r.ignoredProps, ['patchCell.imgSrc'],
    '★안 된 것을 «이름»으로 돌려주지 않았다 — 목록에서 빼기만 하면 조용히 사라진 것과 같다');
  assert.match(r.hint, /type:'text'/, '★«왜» 안 됐는지가 없다');

  // ★반대쪽 — 화면. applied 가 말한 것은 있고, 뺀 것은 없어야 한다.
  assert.match(b.innerHTML, /B2/, '★applied 는 text 를 «적용했다»는데 화면에 없다');
  assert.equal(imgCount(b), 0, '★적용 목록에서 뺀 값이 화면엔 그려졌다 — 이번엔 반대로 거짓말한 것이다');
  assert.doesNotMatch(b.innerHTML, new RegExp(IMG_URL.replace(/[./]/g, '\\$&')),
    '★applied 에서 뺀 주소가 화면에 나온다');
});

/* ═══ ★★교차검사 — applied 의 «잎»이 화면에 실제로 닿는가 ═══════════════ */

/** 객체 안 «스칼라 잎»의 경로들. ⛔`type` 은 뺀다 — 그건 값이 아니라 «가지를 고르는 손잡이»고,
 *  지우면 모르는 값처럼 글자 가지로 떨어져 «둔감»해 보인다(거짓 고발). 구현도 같은 이유로 안 잰다. */
function leafPaths(v, at = [], out = []) {
  if (Array.isArray(v)) { v.forEach((x, i) => leafPaths(x, at.concat(i), out)); return out; }
  if (v && typeof v === 'object') { Object.keys(v).forEach(k => leafPaths(v[k], at.concat(k), out)); return out; }
  if (at[at.length - 1] !== 'type') out.push(at);
  return out;
}
function withoutLeaf(obj, at) {
  const c = JSON.parse(JSON.stringify(obj));
  let o = c;
  for (let i = 0; i < at.length - 1; i++) o = o[at[i]];
  const last = at[at.length - 1];
  if (Array.isArray(o)) o.splice(last, 1); else delete o[last];
  return c;
}

/** ★이 파일의 심장 — `applied.cells` 가 «화면을 설명»하는지 화면으로 검산한다.
 *  ⑴재현: applied.cells 를 그대로 다시 써 넣으면 «같은 화면»이 나와야 한다(빠뜨린 게 없다).
 *  ⑵민감도: 잎 하나를 빼면 화면이 «달라져야» 한다 — 안 달라지면 화면이 그 값과 무관한데
 *    «적용했다»고 담아 둔 것이다. 바로 이 카드의 병이다.
 *  ⚠️탐침값이 «기본값과 같으면» ⑵가 거짓으로 빨개진다 — 그래서 아래 payload 는 전부 비-기본값이다. */
function assertAppliedCellsMatchScreen(mod, b, applied) {
  assert.ok(Array.isArray(applied.cells), '★applied.cells 가 없다 — 검산할 주장 자체가 없다');
  const base = b.innerHTML;
  const keep = { cols: b.dataset.cols, cells: b.dataset.cells, rows: b.dataset.rows };
  const restore = () => { Object.assign(b.dataset, keep); mod.renderGridBlock(b); };

  const again = mod.updateGridBlock(b.id, { cells: applied.cells });
  assert.equal(again.ok, true, `★applied.cells 를 그대로 되돌려줬더니 거절당했다: ${again.message}`);
  assert.equal(b.innerHTML, base,
    '★applied.cells 를 «그대로» 다시 써 넣었더니 화면이 달라졌다 — applied 가 화면을 설명하지 못한다');
  restore();

  const leaves = leafPaths(applied.cells);
  assert.ok(leaves.length >= 1, '★applied.cells 의 잎이 0개다 — 이 교차검사는 아무것도 안 쟀다');
  for (const at of leaves) {
    const r = mod.updateGridBlock(b.id, { cells: withoutLeaf(applied.cells, at) });
    assert.equal(r.ok, true, `★탐침이 거절당했다(cells.${at.join('.')}) — 이 교차검사가 아무것도 못 쟀다: ${r.message}`);
    const changed = b.innerHTML !== base;
    restore();
    assert.equal(b.innerHTML, base, '★탐침 뒤 복구가 안 됐다 — 뒤 단언이 엉뚱한 상태를 잰다');
    assert.ok(changed,
      `★applied.cells 의 «${at.join('.')}» 를 빼도 화면이 한 글자도 안 바뀐다 — `
      + '화면이 그 값과 무관한데 «적용했다»고 담아 돌려준 것이다');
  }
}

test('A3 ★모양이 안 맞는 표 — 버려진 키는 applied 에 없고, 남은 것은 전부 화면에 닿는다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, {
    cells: [[{ lines: [{ type: 'text', text: 'KEEP' }] }, { bogusField: 1, width: 50 }]],
  });

  assert.equal(r.ok, true, `★통째로 실패시켰다 — KEEP 은 «실제로» 그려졌다: ${r.message}`);
  assert.doesNotMatch(JSON.stringify(r.applied), /bogusField/,
    '★렌더러가 안 읽는 셀 키가 «적용» 목록에 담겨 돌아왔다');
  assert.doesNotMatch(JSON.stringify(r.applied), /"width"/,
    '★width 는 «열» 속성이라 셀로 주면 버려진다 — 그런데 적용됐다고 돌아왔다');
  assert.deepEqual(r.ignoredProps, ['cells[0][1].bogusField', 'cells[0][1].width']);
  assert.match(r.hint, /patchCol/, '★width 를 «어디로 보내라»까지 말해야 한다');

  assert.match(b.innerHTML, /KEEP/, '★적용됐다는 값이 화면에 없다');
  assertAppliedCellsMatchScreen(G, b, r.applied);
});

test('A4 ★표 안의 «글자 줄»에 그림 주소 — applied 에서 빠지고 화면 그림은 0개다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, {
    cells: [[{ lines: [{ type: 'text', text: 'DDD', imgSrc: IMG_URL }] }, { lines: [] }],
            [{ lines: [] }, { lines: [] }]],
  });

  assert.equal(r.ok, true, `★통째로 실패시켰다 — DDD 는 그려졌다: ${r.message}`);
  assert.doesNotMatch(JSON.stringify(r.applied), /t122-probe/,
    '★줄 종류와 안 맞는 그림 주소가 «적용» 목록에 담겨 돌아왔다 — 이 카드의 병 그 자체다');
  assert.deepEqual(r.ignoredProps, ['cells[0][0].lines[0].imgSrc']);

  assert.equal(imgCount(b), 0, '★적용 목록에서 뺐는데 화면엔 그려졌다 — 반대로 거짓말한 것이다');
  assert.match(b.innerHTML, /DDD/, '★적용됐다는 글자가 화면에 없다');
  assertAppliedCellsMatchScreen(G, b, r.applied);
});

/* ═══ 음성대조 — 멀쩡한 것까지 막거나 빼지는 않는가 ═════════════════════ */

test('A5 ★음성대조 — 줄 종류를 같이 바꾸면 통과하고 «실제로 그려진다»', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, type: 'image', imgSrc: IMG_URL } });

  assert.equal(r.ok, true, `★멀쩡한 요청을 막았다 — 그물이 너무 넓다: ${r.message}`);
  assert.equal(r.applied.patchCell.imgSrc, IMG_URL, '★그려지는 값을 applied 에서 빼 버렸다');
  assert.equal(r.ignoredProps, undefined, '★안 된 것이 없는데 «안 됐다» 목록이 붙었다');
  assert.equal(imgCount(b), 1, '★통과시켰는데 «안 그려진다» — 통과가 곧 반영은 아니다');
  assert.match(b.innerHTML, new RegExp(IMG_URL.replace(/[./]/g, '\\$&')), '★그 주소가 화면에 없다');
});

test('A6 ★음성대조 — 평범한 줄 patch 는 예전 그대로다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, text: 'A1★', fontSize: 44, color: '#112233' } });

  assert.equal(r.ok, true, `★멀쩡한 줄 필드를 막았다: ${r.message}`);
  assert.deepEqual(r.applied.patchCell, { r: 0, c: 0, lineIndex: 0, text: 'A1★', fontSize: 44, color: '#112233' },
    '★그려지는 값이 applied 에서 사라졌다');
  assert.equal(r.ignoredProps, undefined);
  assert.match(b.innerHTML, /font-size:44px/, '★통과시켰는데 안 그려진다');
  assert.match(b.innerHTML, /#112233/);
});

test('A7 ★음성대조 — 멀쩡한 표는 「안 됐다」가 하나도 없다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, {
    cells: [[{ lines: [{ type: 'text', text: 'P' }] }, { lines: [{ type: 'text', text: 'Q' }] }],
            [{ lines: [{ type: 'text', text: 'R' }] }, { lines: [{ type: 'text', text: 'S' }] }]],
  });
  assert.equal(r.ok, true, `★멀쩡한 표를 막았다: ${r.message}`);
  assert.equal(r.ignoredProps, undefined, `★멀쩡한 값을 「안 됐다」고 돌려줬다: ${r.hint}`);
  for (const t of ['P', 'Q', 'R', 'S']) assert.match(b.innerHTML, new RegExp(t), `★${t} 가 화면에 없다`);
  assertAppliedCellsMatchScreen(G, b, r.applied);
});

/* ═══ ★양성대조 — 구멍이 «실재했나», 그리고 이 검사가 그걸 «잡나» ═══════ */

test('A8 ★양성대조 — 줄 종류 관문을 «뺀» 사본은 ok:true + applied 에 imgSrc, 화면은 그림 0개', async () => {
  const mutated = RAW.replace(
    'unreadLine = _gridUnreadLineFields(mergedLine, keys);',
    'unreadLine = [];');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const b = fixture(M);

  const r = M.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, imgSrc: IMG_URL } });
  assert.equal(r.ok, true, '★관문을 뺐는데도 거절된다 — A1 이 재는 것은 «이 관문»이 아니다');
  assert.match(JSON.stringify(r.applied), /t122-probe/,
    '★applied 가 그 값을 안 돌려준다 — 그렇다면 거짓 성공의 모양이 내 진단과 다르다');
  assert.equal(imgCount(b), 0,
    '★화면에 실제로 그려진다 — 그러면 이건 «거짓 성공»이 아니라 그냥 내 진단이 틀린 것이다');
});

test('A9 ★양성대조 — applied.cells 를 «입력 메아리»로 되돌린 사본은 A3·A4 의 교차검사가 잡는다', async () => {
  const mutated = RAW.replace(
    'if (appliedCellsPending) applied.cells = _gridRenderedCells(getGridModel(block).cells);',
    'if (appliedCellsPending) applied.cells = partial.cells;');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const b = fixture(M);

  const r = M.updateGridBlock(b.id, {
    cells: [[{ lines: [{ type: 'text', text: 'DDD', imgSrc: IMG_URL }] }, { lines: [] }],
            [{ lines: [] }, { lines: [] }]],
  });
  assert.match(JSON.stringify(r.applied), /t122-probe/,
    '★메아리로 되돌렸는데도 applied 가 깨끗하다 — A4 의 단언이 «다른 이유»로 초록일 수 있다');
  assert.equal(imgCount(b), 0, '★화면엔 그림이 0개다 — 메아리가 «안 그려진 것»을 담아 돌려준 것이 맞다');

  // ★그리고 교차검사가 실제로 «빨개지는가» — 검사가 이 거짓말을 잡는다는 증거.
  assert.throws(() => assertAppliedCellsMatchScreen(M, b, r.applied), /한 글자도 안 바뀐다/,
    '★교차검사가 메아리를 통과시킨다 — 그러면 A3·A4 는 이 결함을 못 잡는다');
});
