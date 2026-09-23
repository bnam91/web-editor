/* grid-cell-unset-contract — 「칸 꾸밈을 «지운다»」의 계약을 «저장본»에서 잰다.
 * 실행: node --test tests/unit/grid-cell-unset-contract.test.js  ·  라이브 userData 무접촉.
 *
 * ★네 값이 서로 다른 뜻을 가진다 (2026-09-23 T-178 C2 · 팀리드 확정)
 *     null       = 그 키를 «지운다»  → 열 기본값으로 돌아간다
 *     undefined  = 같은 뜻(지움). ★«이미» 되던 길이라 끊지 않는 것이 요점이다
 *     ''         = 「강제로 없앰」    → 값이다. 열 기본값을 무시한다
 *     0          = 「0 이라는 값」    → 값이다. ⛔지움이 아니다
 *     키 없음     = 「안 줬음」        → 무동작
 *
 * ★왜 `null` 에 뜻을 주나 — 「지울 길이 없어서」가 «아니다». `undefined` 로는 이미 됐다.
 *   ⛔그 길은 «같은 프로세스의 JS»에서만 닿는다: MCP·IPC·저장본은 JSON 이라 `undefined` 를
 *     실을 수 없다. `null` 이 그 구멍을 막는다. 그리고 예전의 `null` 은 「값 있음」으로 저장돼
 *     열 기본값이 아니라 «하드 기본»으로 떨어지던 함정이라, 잃는 표현력이 없다.
 *
 * ★★이 파일이 «화면»이 아니라 «저장본»을 재는 까닭
 *   tests/dom/grid-cell-clear-contract.dom.spec.js 가 화면(computed style) 축을 이미 잰다.
 *   여기서는 「dataset 문자열에 그 키가 있나」를 «정체»로 잰다 — 표시는 흉내낼 수 있고
 *   정체는 못 한다. 그리고 ★소스를 비틀 수 있어 «음성대조»(D4)가 여기서만 가능하다.
 *
 * ★★행 0 과 행 1+ 의 «비대칭»도 여기서 잰다 — T-178 이 없앤 것이다.
 *   고치기 «전»에는 같은 「비우기」가 행마다 다르게 동작했다:
 *     행 1+ : `Object.assign` → undefined 가 키를 덮고 JSON.stringify 가 떨군다 ⇒ 지워졌다
 *     행 0  : `_mergeCellIntoCol` 의 `if (cell[k] !== undefined)` 가 건너뛴다 ⇒ «무동작»
 *   저장 자리가 하나(cells)가 되면서 두 행이 같은 코드를 탄다.
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
async function loadModule(mutate) {
  let src = RAW;
  const beforeStub = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n"
  );
  assert.notEqual(src, beforeStub, '소스에서 drag-utils/drag-drop import 2줄을 못 찾음 — 리팩터링됐나?');
  const gcrAlias = path.join(os.tmpdir(), `grid-unset-gcr-${process.pid}-${seq}.mjs`);
  fs.copyFileSync(path.join(__dirname, '../../js/grid-cell-resize.js'), gcrAlias);
  const beforeGcr = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, beforeGcr, "소스에서 grid-cell-resize.js import 를 못 찾음");
  if (mutate) src = mutate(src);
  const aliasPath = path.join(os.tmpdir(), `grid-unset-${process.pid}-${seq++}.mjs`);
  fs.writeFileSync(aliasPath, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(aliasPath).href);
  fs.unlinkSync(aliasPath);
  fs.unlinkSync(gcrAlias);
  return mod;
}

/* ── 변이 — ⛔이름이 아니라 «그 두 줄»을 겨눈다.
     「값이 null/undefined 면 지운다」를 걷어내고 «그냥 얹는» 옛 꼴로 되돌린다. ── */
const N_DROP_DELETE = (src) => {
  const out = src.replace(
    "    if (deco[k] === null || deco[k] === undefined) delete next[k];\n    else next[k] = deco[k];",
    '    next[k] = deco[k];'
  );
  assert.notEqual(out, src, '★변이 닻이 빗나갔다 — _gridApplyCellDeco 의 «지움» 두 줄을 못 찾았다');
  return out;
};

const FIELDS = ['bg', 'padding', 'radius', 'align', 'valign'];
const OVER = { bg: '#7b2ff7', padding: 24, radius: 18, align: 'center', valign: 'middle' };
const COL_DEFAULT = { bg: '#0a7d3b', padding: 12, radius: 6, align: 'right', valign: 'bottom' };
const FIX = () => ({
  cols: [{ width: 1 }, { width: 1 }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: 'R0C0' }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ],
});

/** dataset.cells[r][c] 에서 그 키가 «있나 / 무엇인가». 「키 없음」과 「null 로 저장됨」을 가른다. */
function stored(block, r, c, k) {
  let cells;
  try { cells = JSON.parse(block.dataset.cells || '[]'); } catch (_) { return '<PARSE_ERROR>'; }
  const cell = (Array.isArray(cells[r]) && cells[r][c]) || {};
  return Object.prototype.hasOwnProperty.call(cell, k) ? JSON.stringify(cell[k]) : '<없음>';
}

/** 열 기본값을 깔고 → 칸에 값을 주고 → `value` 로 되돌린다. 매 지점의 저장본을 돌려준다. */
function unsetProbe(mod, r, k, value) {
  const { makeGridBlock, updateGridBlock } = mod;
  const { block } = makeGridBlock(FIX());
  const ops = [];
  ops.push(updateGridBlock(block.id, { patchCol: { index: 0, ...COL_DEFAULT } }));
  ops.push(updateGridBlock(block.id, { patchCell: { r, c: 0, [k]: OVER[k] } }));
  const over = stored(block, r, 0, k);
  ops.push(updateGridBlock(block.id, { patchCell: { r, c: 0, [k]: value } }));
  return { ok: ops.every(o => o && o.ok), ops, over, after: stored(block, r, 0, k),
    cells: block.dataset.cells, cols: block.dataset.cols };
}

let MOD;
before(async () => { MOD = await loadModule(null); });

/* ══════════════════════════════════════════════════════════════════════════
 * D1 — `null` 은 «지운다». ★행 0 과 행 1+ «둘 다»(비대칭이 사라졌다)
 * ════════════════════════════════════════════════════════════════════════ */

test('D1 ★null 은 그 키를 «지운다» — 다섯 필드 × 행 0/행 1 전부', () => {
  const bad = [];
  for (const r of [0, 1]) {
    for (const k of FIELDS) {
      const p = unsetProbe(MOD, r, k, null);
      if (!p.ok) { bad.push(`r=${r} ${k}: 조작 실패 ${JSON.stringify(p.ops)}`); continue; }
      if (p.over === '<없음>') { bad.push(`r=${r} ${k}: 전제가 깨졌다 — 덮어쓰기가 저장본에 안 남았다`); continue; }
      if (p.after !== '<없음>') bad.push(`r=${r} ${k}: null 을 줬는데 저장본에 ${p.after} 가 남았다 (cells=${p.cells})`);
    }
  }
  assert.deepEqual(bad, [],
    '★null 이 키를 «안» 지웠다 — 남으면 pick(cell[k] !== undefined)이 「값 있음」으로 읽어\n' +
    '  폴백이 안 돌고 열 기본값이 아니라 «하드 기본»으로 떨어진다(옛 함정).\n  ' + bad.join('\n  '));
});

test('D2 ★★행 0 과 행 1+ 가 «같은 답»을 준다 — T-178 이 없앤 비대칭', () => {
  /* 고치기 «전»에는 같은 「비우기」가 행마다 달랐다(행 1+ 는 지워지고, 행 0 은 무동작).
     ⇒ 두 행의 답을 «나란히» 놓고 다른 자리를 세운다. 이름이 아니라 «답»으로 잰다. */
  const diff = [];
  for (const k of FIELDS) {
    for (const v of [null, undefined, '', 0]) {
      const a = unsetProbe(MOD, 0, k, v);
      const b = unsetProbe(MOD, 1, k, v);
      if (!a.ok || !b.ok) { diff.push(`${k} / ${JSON.stringify(v)}: 조작 실패`); continue; }
      if (a.after !== b.after) diff.push(`${k} / ${JSON.stringify(v)}: 행0=${a.after} · 행1=${b.after}`);
    }
  }
  assert.deepEqual(diff, [],
    '★같은 값을 줬는데 «행에 따라» 저장본이 다르다 — 행 0 특례가 살아 있거나 되살아났다.\n' +
    '  (T-178 전: 행 1+ 는 undefined 가 키를 지웠고, 행 0 은 _mergeCellIntoCol 이 건너뛰어 무동작이었다)\n  '
    + diff.join('\n  '));
});

/* ══════════════════════════════════════════════════════════════════════════
 * D3 — `undefined` 도 지움. ★«이미» 되던 길이라 끊지 않는 것이 요점이다
 * ════════════════════════════════════════════════════════════════════════ */

test('D3 ★undefined 도 지운다 — 고치면서 이 길을 끊지 마라', () => {
  const bad = [];
  for (const r of [0, 1]) {
    for (const k of FIELDS) {
      const p = unsetProbe(MOD, r, k, undefined);
      if (!p.ok) { bad.push(`r=${r} ${k}: 조작 실패`); continue; }
      if (p.after !== '<없음>') bad.push(`r=${r} ${k}: undefined 를 줬는데 ${p.after} 가 남았다`);
    }
  }
  assert.deepEqual(bad, [],
    '★undefined 로 덮는 「지움」 통로가 끊겼다 — 행 1+ 에서는 T-178 «이전»부터 되던 길이다.\n  ' +
    bad.join('\n  '));
});

/* ══════════════════════════════════════════════════════════════════════════
 * D4 — `''` 와 `0` 은 «값»이다. ⛔falsy 를 통째로 지움으로 읽으면 여기가 운다
 * ════════════════════════════════════════════════════════════════════════ */

test("D4 ★'' 와 0 은 «지움이 아니다» — 저장본에 그대로 남는다", () => {
  const bad = [];
  for (const r of [0, 1]) {
    for (const k of FIELDS) {
      const e = unsetProbe(MOD, r, k, '');
      if (e.after !== '""') bad.push(`r=${r} ${k}: '' 를 줬는데 저장본이 ${e.after} 다`);
    }
    for (const k of ['padding', 'radius']) {
      const z = unsetProbe(MOD, r, k, 0);
      if (z.after !== '0') bad.push(`r=${r} ${k}: 0 을 줬는데 저장본이 ${z.after} 다`);
    }
  }
  assert.deepEqual(bad, [],
    "★'' 나 0 이 「지움」으로 읽혔다. falsy 를 통째로 지움으로 다루면 이렇게 된다.\n" +
    '  ⇒ 「열 기본값이 12px 인 열에서 이 칸만 여백 0」을 표현할 길이 사라진다.\n  ' + bad.join('\n  '));
});

/* ══════════════════════════════════════════════════════════════════════════
 * D5 — 음성대조. 「지움」 두 줄을 걷어낸 변형본에서 D1 이 실제로 빨개지는가
 * ════════════════════════════════════════════════════════════════════════ */

test('D5 ★음성대조 — 「지움」 두 줄을 걷어내면 D1 이 빨개진다', async () => {
  const mod = await loadModule(N_DROP_DELETE);
  const leaked = [];
  for (const r of [0, 1]) {
    for (const k of FIELDS) {
      const p = unsetProbe(mod, r, k, null);
      if (p.after !== '<없음>') leaked.push(`r=${r} ${k}: ${p.after}`);
    }
  }
  assert.ok(leaked.length > 0,
    '★_gridApplyCellDeco 의 「지움」 두 줄을 걷어냈는데도 D1 이 초록이다 — 이 검사는 그 줄을 «안 재고 있다».');
  /* 어느 자리가 우는지도 못 박는다 — 「아무거나 하나」로 두면 다음에 자리가 바뀌어도 안 보인다.
     ★열 자리(행 0/1 × 다섯 필드) «전부»가 울어야 한다: 그 두 줄이 유일한 지움 길이기 때문이다. */
  assert.equal(leaked.length, 10,
    `★우는 자리가 10개가 아니라 ${leaked.length}개다 — 지움 길이 다른 데로 갈라졌다는 뜻이다.\n  ` +
    leaked.join('\n  '));
  // 그리고 변형본에서 «null 이 값으로 저장»되는 것까지 이름으로 못박는다(옛 함정의 모양).
  assert.equal(leaked.every(s => s.endsWith('null')), true,
    `★변형본이 null 을 «값으로 저장»하지 않았다 — 음성대조가 다른 것을 재고 있다.\n  ${leaked.join('\n  ')}`);
});

/* ══════════════════════════════════════════════════════════════════════════
 * D6 — 「비우기 → 저장 → 다시 그리기」. ★이 레포의 저장은 canvasEl.innerHTML 통째다.
 *   ⇒ dataset 에 «글자»로 없는 것은 파일에 안 들어간다. 「세션 안에선 완벽한데 저장하면
 *     되돌아가는」 고침(평가자 N4 가 잡은 갈래)을 이 축이 «모델·렌더»에서 받친다.
 *   ⛔「내 코드가 dataset 에 썼나」가 아니라 «dataset 만 물려받아 다시 세운 블록»이 같은 HTML 을
 *     내는가로 잰다 — 표시는 흉내낼 수 있고 정체는 못 한다.
 *   ⚠️못 재는 것: 진짜 파일 왕복(save-load.js 의 innerHTML 파싱)은 DOM 이 필요하다.
 *     그쪽 축은 tests/dom/grid-row0-save-undo.dom.spec.js 의 R1·R2-a·R2-b 가 «패치» 경우로 잰다.
 *     여기는 그 짝인 «비우기» 경우다.
 * ════════════════════════════════════════════════════════════════════════ */

test('D6 ★비우기 → 저장 → 다시 그리기 = «열 기본값만» 걸린 모양과 바이트 동일', () => {
  const { makeGridBlock, updateGridBlock, renderGridBlock } = MOD;
  /** dataset «만» 물려받은 새 블록을 세워 다시 그린다(저장→로드 왕복의 모사). */
  const reloadHtml = (src) => {
    const fresh = globalThis.document.createElement('div');
    fresh.className = 'grid-block';
    for (const k of Object.keys(src.dataset)) fresh.dataset[k] = src.dataset[k];
    renderGridBlock(fresh);
    return fresh.innerHTML;
  };
  const bad = [];
  for (const r of [0, 1]) {
    // ㈎ 열 기본값«만» 걸린 기준 모양
    const base = makeGridBlock(FIX()).block;
    updateGridBlock(base.id, { patchCol: { index: 0, ...COL_DEFAULT } });
    const want = reloadHtml(base);

    // ㈏ 칸에 값을 준 뒤 다섯 필드를 «전부» 비운다
    const b = makeGridBlock(FIX()).block;
    updateGridBlock(b.id, { patchCol: { index: 0, ...COL_DEFAULT } });
    updateGridBlock(b.id, { patchCell: { r, c: 0, ...OVER } });
    if (reloadHtml(b) === want) { bad.push(`r=${r}: 전제가 깨졌다 — 칸에 값을 줬는데 화면이 안 바뀌었다`); continue; }
    const clearPatch = { r, c: 0 };
    for (const k of FIELDS) clearPatch[k] = null;
    const res = updateGridBlock(b.id, { patchCell: clearPatch });
    if (!res.ok) { bad.push(`r=${r}: 비우기가 거절됐다 — ${res.code}: ${res.message}`); continue; }

    const got = reloadHtml(b);
    if (got !== want) {
      bad.push(`r=${r}: 비우고 다시 그렸더니 «열 기본값만» 걸린 모양과 다르다\n`
        + `      기대: ${want.slice(0, 240)}\n      실제: ${got.slice(0, 240)}`);
    }
    // 저장본에도 그 칸의 꾸밈 키가 «하나도» 없어야 한다(글자로 남으면 파일에 실린다).
    for (const k of FIELDS) {
      const v = stored(b, r, 0, k);
      if (v !== '<없음>') bad.push(`r=${r} ${k}: 비웠는데 저장본에 ${v} 가 남았다 — 파일에 실린다`);
    }
  }
  assert.deepEqual(bad, [],
    '★「비우기」가 저장·재렌더를 못 건넌다.\n'
    + '  ⇒ 사용자는 파일을 열면 맞게 보다가 «블록을 건드리는 순간» 모양이 바뀌는 것을 본다(작업 손실).\n  '
    + bad.join('\n  '));
});
