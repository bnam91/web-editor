/* grid-row0-lines-invariant — T-178 이 새로 세운 «불변식» 둘을 잠근다.
 * 실행: node --test tests/unit/grid-row0-lines-invariant.test.js   ·  라이브 userData 무접촉.
 *
 * ═══ 불변식 ① — dataset.cells[0][*] 에 `lines` 키가 «절대» 없다 ═══════════════
 *   T-178 이 dataset.cells 를 «행 0 포함 전체 R×C»로 넓혔다. 그런데 행 0 의 «줄 내용»은
 *   여전히 cols[c].lines «하나»뿐이어야 한다 — cells[0][c].lines 가 생기는 순간 같은 글자가
 *   두 군데에 앉아 조용히 갈라진다(이 레포의 dataset 단일 진실원 위반).
 *
 *   ★«문을 지났나»가 아니라 «dataset 문자열이 어떤가»를 잰다.
 *     표시(어느 함수를 불렀나)는 흉내낼 수 있지만 정체(저장본에 무엇이 들어갔나)는 못 한다.
 *
 *   새는 길을 «각각 한 번씩» 태운 뒤 매번 잰다:
 *     L1 정규화        — 손으로 심어 둔 옛/깨진 저장본을 읽고 다시 쓰는 길
 *     L2 patchCell{r:0, lines}
 *     L3 cells 통째(update_block{cells}) — API 경계가 «행 0 포함 전체»를 받는다
 *     L4 피커 행 증감  — ⛔여긴 DOM 이다: tests/dom/grid-picker-row0-lines.dom.spec.js 가 잰다
 *                        (이 파일에서 같은 이름으로 «가짜로» 재지 않는다 — 검사처럼 생긴 문장이 된다)
 *     L5 MCP 되받아쓰기 — getGridModel() 로 읽고(행 0 에 lines 가 있다) 그대로 write
 *
 *   ★음성대조 둘 — 「문 안의 한 줄」을 지운 변형본에서 이 검사가 실제로 빨개지는가.
 *     N1 쓰는 문(_gridCellsToDataset)의 `delete c.lines` 를 지운다  → L3·L5 가 빨개져야 한다
 *     N2 읽는 문(_gridCellRows)의 행 0 lines 떼기를 지운다          → L1 이 빨개져야 한다
 *     ⛔한 방향만 재면 「두 문 중 하나만 살아 있어도 초록」인 검사가 된다.
 *
 * ═══ 불변식 ② — 가르는 코드가 «필드 이름을 모른다» ══════════════════════════
 *   patchCell 을 「꾸밈 5개 명부」로 가르면 T-172(테두리) 같은 새 칸 필드가 생길 때마다
 *   그 명부가 따로 늙는다. 그래서 가르는 기준은 「`lines` 인가 아닌가」 «하나»다.
 *   ⇒ GRID_CELL_FIELDS 에 «검사 안에서» 가짜 필드를 끼우고, 가르는 코드를 «한 글자도
 *     안 고친 채» 그 값이 cells[0][0] 에 실리는지 본다.
 *   ⛔「리터럴 배열에 padding 과 radius 가 같이 있으면 빨강」식 grep 검사는 안 만든다 —
 *     그건 «검사처럼 생긴 문장»이지 동작을 재지 않는다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');   // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)

const RAW = readSrc(path.join(__dirname, '../../js/blocks/grid-block.js'));

/* ── 미니 DOM(grid-p1.test.js 와 같은 표면 — 새 하네스를 발명하지 않는다) ── */
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
        contains: (c) => _classes.has(c),
        add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; },
      scrollIntoView() {},
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let seq = 0;
/** grid-block.js 를 «바이트 그대로»(또는 mutate 로 한 군데만 비틀어) 불러온다. */
async function loadModule(mutate) {
  let src = RAW;
  const beforeStub = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n"
  );
  assert.notEqual(src, beforeStub, '소스에서 drag-utils/drag-drop import 2줄을 못 찾음 — 리팩터링됐나?');

  const gcrAlias = path.join(os.tmpdir(), `grid-inv-gcr-${process.pid}-${seq}.mjs`);
  fs.copyFileSync(path.join(__dirname, '../../js/grid-cell-resize.js'), gcrAlias);
  const beforeGcr = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, beforeGcr, '소스에서 grid-cell-resize.js import 를 못 찾음');

  if (mutate) {
    const beforeMut = src;
    src = mutate(src);
    assert.notEqual(src, beforeMut, '★변이가 주입되지 않았다 — 음성대조가 «아무것도 안 바꾼 채» 돌 뻔했다');
  }
  const aliasPath = path.join(os.tmpdir(), `grid-inv-${process.pid}-${seq++}.mjs`);
  fs.writeFileSync(aliasPath, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(aliasPath).href);
  fs.unlinkSync(aliasPath);
  fs.unlinkSync(gcrAlias);
  return mod;
}

/* ── 변이 둘. ⛔이름이 아니라 «그 한 줄»을 겨눈다.
     ★주입 «성공»을 그 자리에서 본다 — 닻이 빗나가면 변이 없는 사본이 돌아 음성대조가
       «조용히» 초록이 된다(grid-render-gaps.test.js G3 이 이 꼴을 요구한다). ── */
const N1_DROP_WRITE_DELETE = (src) => {
  const out = src.replace('      if (r === 0) delete c.lines;\n', '');
  assert.notEqual(out, src, '★N1 닻이 빗나갔다 — 쓰는 문의 `delete c.lines` 줄을 못 찾았다');
  return out;
};
/* ⛔닻에 «주석»을 넣지 않는다 — 주석 한 줄만 손봐도 닻이 빗나가고, 그러면 변이 없는 사본이
   돌아 음성대조가 조용히 초록이 된다(assert.notEqual 이 막긴 하지만 굳이 그 위험을 안 든다).
   ★코드만으로 유일한지 확인하고 썼다(2026-09-23 실측: 원본 1회 · 주석 걷은 뒤 1회). */
const N2_DROP_READ_STRIP = (src) => {
  const out = src.replace('const { lines: _drop, ...deco } = cell;', 'const deco = cell;');
  assert.notEqual(out, src, '★N2 닻이 빗나갔다 — 읽는 문의 행 0 lines 떼기 줄을 못 찾았다');
  return out;
};

/** dataset.cells 를 «문자열에서» 파싱해 행 0 에 lines 키가 있는지 «정체»로 잰다. */
function row0LinesKeys(block) {
  const raw = block.dataset.cells;
  if (raw === undefined) return { raw: '(unset)', hits: [] };
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { return { raw, hits: [`PARSE_ERROR: ${e.message}`] }; }
  const row0 = Array.isArray(parsed) && Array.isArray(parsed[0]) ? parsed[0] : [];
  const hits = [];
  row0.forEach((cell, c) => {
    if (cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'lines')) {
      hits.push(`cells[0][${c}].lines = ${JSON.stringify(cell.lines)}`);
    }
  });
  return { raw, hits };
}

const SENT = 'INV-ROW0-9c41ab';
const FIX = () => ({
  cols: [{ width: 1 }, { width: 1 }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: SENT }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ],
});

/** 새는 길 넷을 «각각 한 번씩» 태우고, 매번 dataset 문자열을 잰다.
 *  돌려주는 것: [{ path, ok, hits, raw }] — 어느 길이 샜는지 한 줄로 읽힌다. */
function runLeakPaths(mod) {
  const { makeGridBlock, updateGridBlock, getGridModel } = mod;
  const out = [];
  const rec = (name, block, extra) => {
    const { raw, hits } = row0LinesKeys(block);
    out.push({ path: name, hits, raw, ...extra });
  };

  /* L1 정규화 — 손으로 «옛/깨진» 저장본(행 0 에 lines 가 든 cells)을 심고 읽고 다시 쓴다. */
  {
    const { block } = makeGridBlock(FIX());
    block.dataset.cells = JSON.stringify([
      [{ lines: [{ type: 'body', text: 'GHOST-0' }], bg: '#111111' }, { lines: [] }],
      [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [] }],
    ]);
    const r = updateGridBlock(block.id, { rows: [{ height: 'auto' }, { height: 'auto' }] });
    rec('L1 정규화', block, { ok: r.ok, ghost: JSON.stringify(block.dataset.cells).includes('GHOST-0') });
  }

  /* L2 patchCell{r:0, lines} — 행 0 의 «줄 내용»은 cols 로만 간다. */
  {
    const { block } = makeGridBlock(FIX());
    const r = updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'body', text: 'L2-NEW' }] } });
    rec('L2 patchCell{r:0,lines}', block, {
      ok: r.ok,
      inCols: String(block.dataset.cols).includes('L2-NEW'),
    });
  }

  /* L3 cells 통째 — API 경계는 «행 0 포함 전체»를 받는다(행 0 에 lines 가 들어 있다). */
  {
    const { block } = makeGridBlock(FIX());
    const r = updateGridBlock(block.id, {
      cells: [
        [{ lines: [{ type: 'body', text: 'L3-R0' }], bg: '#222222' }, { lines: [] }],
        [{ lines: [{ type: 'body', text: 'L3-R1' }] }, { lines: [] }],
      ],
    });
    rec('L3 cells 통째', block, {
      ok: r.ok,
      inCols: String(block.dataset.cols).includes('L3-R0'),
      deco: (JSON.parse(block.dataset.cells)[0][0] || {}).bg,
    });
  }

  /* L5 MCP 되받아쓰기 — 읽은 모델(행 0 에 lines 가 있다)을 그대로 다시 쓴다. */
  {
    const { block } = makeGridBlock(FIX());
    updateGridBlock(block.id, { patchCell: { r: 0, c: 0, bg: '#333333' } });
    const model = getGridModel(block);
    assert.ok(Array.isArray(model.cells[0][0].lines) && model.cells[0][0].lines.length,
      '★전제 — 읽은 모델의 행 0 에는 lines 가 «있어야» 한다(없으면 L5 가 아무것도 안 태운다)');
    const r = updateGridBlock(block.id, { cells: model.cells });
    rec('L5 MCP 되받아쓰기', block, {
      ok: r.ok,
      inCols: String(block.dataset.cols).includes(SENT),
      deco: (JSON.parse(block.dataset.cells)[0][0] || {}).bg,
    });
  }
  return out;
}

const fmt = (rows) => rows.map(r => `      ${r.path}: hits=${JSON.stringify(r.hits)} raw=${r.raw}`).join('\n');

let MOD;
before(async () => { MOD = await loadModule(null); });

/* ══════════════════════════════════════════════════════════════════════════
 * 불변식 ① — dataset.cells[0][*] 에 lines 키가 없다
 * ════════════════════════════════════════════════════════════════════════ */

test('I1 ★새는 길 넷을 각각 태워도 dataset.cells[0][*] 에 lines 키가 «하나도» 없다', () => {
  const rows = runLeakPaths(MOD);
  assert.equal(rows.length, 4, '★네 길을 다 안 태웠다 — 계측기가 줄었다');
  for (const r of rows) assert.equal(r.ok, true, `★${r.path} 조작 자체가 실패했다 — 아래 판정이 헛것이다`);
  const leaked = rows.filter(r => r.hits.length);
  assert.deepEqual(leaked.map(r => r.path), [],
    '★행 0 칸에 `lines` 키가 저장됐다 — 행 0 줄 내용이 cols 와 cells 두 군데에 앉는다.\n' + fmt(rows));
});

test('I2 ★잃지도 않았다 — 행 0 줄은 cols 에 살아 있고, 행 0 꾸밈은 cells 에 살아 있다', () => {
  /* ⛔「행 0 에 lines 가 없다」는 «다 지워 버려도» 초록이다. 반대 방향을 같이 묻는다. */
  const rows = runLeakPaths(MOD);
  const by = Object.fromEntries(rows.map(r => [r.path.split(' ')[0], r]));
  assert.equal(by.L2.inCols, true, '★patchCell{r:0,lines} 가 준 줄이 cols 에 없다 — 내용이 사라졌다');
  assert.equal(by.L3.inCols, true, '★cells 통째로 준 행 0 줄이 cols 에 없다 — 내용이 사라졌다');
  assert.equal(by.L5.inCols, true, '★되받아쓰기가 행 0 줄을 지웠다 — 라운드트립이 내용을 먹는다');
  assert.equal(by.L3.deco, '#222222', '★행 0 «꾸밈»이 cells[0][0] 에 안 남았다');
  assert.equal(by.L5.deco, '#333333', '★되받아쓰기 뒤 행 0 꾸밈이 사라졌다');
  assert.equal(by.L1.ghost, false, '★행 0 에 심어 둔 유령 줄이 저장본에 그대로 남았다(정규화가 안 됐다)');
});

test('I3 ★음성대조 N1 — «쓰는 문»의 delete 한 줄을 지우면 I1 이 빨개진다', async () => {
  const mod = await loadModule(N1_DROP_WRITE_DELETE);
  const rows = runLeakPaths(mod);
  const leaked = rows.filter(r => r.hits.length).map(r => r.path);
  assert.ok(leaked.length > 0,
    '★쓰는 문의 `delete c.lines` 를 지웠는데도 I1 이 초록이다 — 이 검사는 그 줄을 «안 재고 있다».\n' + fmt(rows));
  /* 어느 길이 우는지도 못 박는다 — 「아무거나 하나」로 두면 다음에 길이 바뀌어도 안 보인다.
     ⚠️L1 은 «안» 운다: 읽는 문이 먼저 행 0 lines 를 떼므로 쓰는 문에 그 값이 도착하지 않는다.
       ⇒ 두 문이 막는 길이 «다르다». 그래서 음성대조도 둘(I3·I4)이다. */
  assert.deepEqual(leaked.sort(), ['L2 patchCell{r:0,lines}', 'L3 cells 통째', 'L5 MCP 되받아쓰기'],
    '★우는 길이 바뀌었다 — 쓰는 문이 막던 길이 다른 데로 옮겨갔다는 뜻이다.\n' + fmt(rows));
});

/** 저장본에 «유령 행 0 줄»을 심어 두고 모델을 읽는다 — 화면이 어느 쪽을 믿는가. */
function readGhostRow0(mod) {
  const { makeGridBlock, getGridModel } = mod;
  const { block } = makeGridBlock(FIX());
  const cur = JSON.parse(block.dataset.cells);
  cur[0][0] = { ...cur[0][0], lines: [{ type: 'body', text: 'GHOST-MODEL' }] };
  block.dataset.cells = JSON.stringify(cur);      // ⛔문을 안 거치고 «손으로» 심는다(옛 파일·손수정 모사)
  const m = getGridModel(block);
  return (m.cells[0][0].lines || []).map(l => l && l.text).join('|');
}

test('I4 ★음성대조 N2 — «읽는 문»의 행 0 lines 떼기를 지우면, 저장본의 유령 줄이 모델을 덮는다', () => {
  /* ★N2 가 막는 것은 «dataset» 이 아니라 «모델/화면»이다 — 쓰는 문이 먼저 떼 주므로 I1 은
       N2 만으로는 안 운다. 그러니 재는 양을 바꾼다: 「읽을 때 어느 쪽을 믿는가」.
     ⛔이걸 I1 과 같은 자로 재면 「둘 중 하나만 살아 있어도 초록」인 검사가 된다
       (gate_fails_both_ways — 한 방향만 재는 게이트). */
  assert.equal(readGhostRow0(MOD), SENT,
    '★온전한 코드에서도 유령 줄이 모델을 덮었다 — 읽는 문이 이미 죽어 있다');
});

test('I4-b ★음성대조 N2 의 «대조» — 변형본에서는 유령 줄이 실제로 모델을 덮는다', async () => {
  const mod = await loadModule(N2_DROP_READ_STRIP);
  assert.equal(readGhostRow0(mod), 'GHOST-MODEL',
    '★읽는 문의 행 0 lines 떼기를 지웠는데도 모델이 안 바뀐다 — I4 는 그 줄을 «안 재고 있다»');
});

/* ══════════════════════════════════════════════════════════════════════════
 * 불변식 ② — 가르는 코드가 «필드 이름을 모른다»
 * ════════════════════════════════════════════════════════════════════════ */

test('I5 ★명부 무지 증명 — GRID_CELL_FIELDS 에 가짜 필드를 끼우면, 가르는 코드를 «한 글자도 안 고친 채» 그 값이 칸에 실린다', async () => {
  /* ★비트는 것은 «명부 한 줄»뿐이다 — `const { lines, ...deco } = cellPatch` 는 그대로다.
     ⇒ 이 검사가 초록이면 「새 칸 필드(T-172 테두리 등)가 생겨도 가르는 코드는 안 고쳐도 된다」가
       실제로 참이다. 손-명부를 다시 만들면 여기가 빨개진다. */
  const DECL = "const GRID_CELL_FIELDS = new Set(['lines', 'align', 'valign', 'bg', 'padding', 'radius']);";
  assert.ok(RAW.includes(DECL), '★GRID_CELL_FIELDS 선언을 못 찾았다 — 이 검사의 겨냥이 빗나갔다');
  const mod = await loadModule((src) => {
    const out = src.replace(
      DECL,
      "const GRID_CELL_FIELDS = new Set(['lines', 'align', 'valign', 'bg', 'padding', 'radius', '__probe']);"
    );
    assert.notEqual(out, src, '★명부 닻이 빗나갔다 — GRID_CELL_FIELDS 선언을 못 바꿨다');
    return out;
  });
  const { makeGridBlock, updateGridBlock } = mod;
  const { block } = makeGridBlock(FIX());

  const r = updateGridBlock(block.id, { patchCell: { r: 0, c: 0, __probe: 'x' } });
  assert.equal(r.ok, true, `★가짜 «칸» 필드가 거절됐다 — ${r.code}: ${r.message}`);
  const saved = JSON.parse(block.dataset.cells);
  assert.equal(saved[0][0].__probe, 'x',
    '★명부에만 더한 새 «칸» 필드가 cells[0][0] 에 안 실렸다 — 가르는 코드가 필드 이름을 «알고» 있다.\n' +
    `   dataset.cells = ${block.dataset.cells}\n` +
    '   ⇒ 손-명부(예: [\'align\',\'valign\',\'bg\',\'padding\',\'radius\'].forEach)가 어딘가 다시 생겼다.');
  assert.ok(!String(block.dataset.cols).includes('__probe'),
    '★새 칸 필드가 cols(=열 기본값)로 샜다 — T-178 이 고친 겸직이 돌아왔다');

  /* ★같은 검사 안의 음성대조 — `lines` 는 «이름으로» 집히므로 cols 로 가고 cells 엔 없다. */
  const r2 = updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'body', text: 'PROBE-LINE' }] } });
  assert.equal(r2.ok, true, `★lines patch 가 실패했다 — ${r2.code}: ${r2.message}`);
  assert.ok(String(block.dataset.cols).includes('PROBE-LINE'),
    '★행 0 의 줄이 cols 로 안 갔다 — 단일 진실원이 옮겨갔다');
  const saved2 = JSON.parse(block.dataset.cells);
  assert.equal(Object.prototype.hasOwnProperty.call(saved2[0][0], 'lines'), false,
    `★행 0 칸에 lines 키가 생겼다 — ${block.dataset.cells}`);
  assert.equal(saved2[0][0].__probe, 'x', '★뒤이은 lines patch 가 앞서 준 칸 값을 지웠다');
});
