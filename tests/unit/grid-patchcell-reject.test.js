/* grid-patchcell-reject.test.js — `patchCell` 의 «거짓 성공» 봉쇄. (지디 결정 ⑴, 조건 ①~④)
 * 실행: node --test tests/unit/grid-patchcell-reject.test.js
 *
 * ★무엇이 문제였나
 *   `update_block{patchCell:{r,c,...}}` 은 나머지 키를 «아무거나» 받아 그대로 병합하고
 *   `applied.patchCell` 에 되돌려줬다. 렌더러가 «안 읽는» 이름을 줘도 `ok:true` 다.
 *   ⇒ 제1원칙 위반 그 자체 — 「우리가 뭘 했나」는 성공인데 「세상이 어떻게 됐나」는 그대로다.
 *   그리고 r≥1 은 `Object.assign` 이라 그 쓰레기가 «파일에 남고», r===0 은 `_mergeCellIntoCol` 이
 *   조용히 버린다. 두 경로가 다르게 틀리는데 «부르는 쪽엔 둘 다 ok:true» 로 보인다.
 *
 * ★이 파일이 재는 것 넷 (지디 조건 ③)
 *   본 단언   P1·P2   — 모르는 필드를 «막는다»
 *   ★효과판정 P3      — 막힌 뒤 dataset 이 «안 변했다». `ok:false` 는 증거가 아니다
 *   양성대조  P4      — 검증기를 «뺀» 사본은 ok:true 를 주고 화면은 그대로다(구멍이 실재했다)
 *   음성대조  P5      — 멀쩡한 필드는 통과하고 «실제로 그려진다»
 *   ★도출     P6~P8   — 명부를 손으로 안 적고 «렌더러가 읽는 것»에서 뽑아 대조 + 그 도출의 양성대조
 *   안내      P9~P11  — 거절이 «무엇을 하라»까지 말한다(조건 ①)
 *   변이      P12     — 거절 호출을 떼면 P1 이 빨강이 된다
 *
 * ⛔조건 ②: 「어느 필드가 줄 필드인가」를 이 파일이 «손으로» 적지 않는다.
 *   P6·P7 이 `_gridLineHtml`·`renderGridBlock` 을 파싱해 «렌더러가 읽는 것»을 뽑고 상수와 맞춘다.
 *   ★생성이 아니라 «대조»인 이유: 생성하면 증인이 둘에서 하나로 준다 — 상수가 틀리면
 *     설명도 자신 있게 같이 틀리고 아무 검사도 안 빨개진다.
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

/* ── 미니 DOM (grid-p1.test.js 와 같은 표면) ── */
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
  const gcrAlias = path.join(os.tmpdir(), `gcr-pcr-${tag}.mjs`);
  const before2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, before2, '★grid-cell-resize.js import 를 못 찾았다 — 행높이 상한 SSOT 가 끊겼나?');

  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcrAlias);
  const alias = path.join(os.tmpdir(), `grid-pcr-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcrAlias);
  return mod;
}

let G;   // 원본 모듈
before(async () => { G = await loadGrid(); });

/** 2행짜리 그리드를 만들고 두 셀에 줄을 채워 둔다. */
function fixture(mod = G) {
  /* ⛔makeGridBlock 은 «{ block }» 을 돌려준다 — 그대로 쓰면 b.id 가 undefined 라
     모든 호출이 'blockId required'/NOT_FOUND 로 떨어지고, `ok:false` 만 보는 단언은
     «다른 이유»로 초록이 된다(초판에서 P2 가 실제로 그렇게 통과했다). */
  const { block: b } = mod.makeGridBlock({
    cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  });
  assert.ok(b && b.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  mod.updateGridBlock(b.id, { rows: [{ height: 'auto' }, { height: 'auto' }] });
  mod.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'h2', text: 'A' }] } });
  mod.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lines: [{ type: 'body', text: 'B' }] } });
  return b;
}
const snap = (b) => JSON.stringify({ cols: b.dataset.cols, cells: b.dataset.cells });

/* ═══ 본 단언 ═══════════════════════════════════════════════════════════ */

test('P1 ★줄 patch — 렌더러가 «안 읽는» 이름은 거절된다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, colour: '#f00' } });
  assert.equal(r.ok, false, '★모르는 필드가 «통과»했다 — ok:true 를 주고 화면은 그대로인 거짓 성공이다');
  assert.equal(r.code, 'INVALID');
});

test('P2 ★셀 patch — 셀에도 «안 읽는» 이름은 거절된다 (r≥1 은 파일에 쓰레기가 남는 자리)', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, shadow: '0 0 4px' } });
  assert.equal(r.ok, false, '★r≥1 은 Object.assign 이라 이게 통과하면 «저장 파일»에 영구히 남는다');
});

test('P3 ★★효과 판정 — 거절 뒤 dataset 이 «안 변했다» (ok:false 는 증거가 아니다)', () => {
  const b = fixture();
  const before = snap(b);
  G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, shadow: '0 0 4px' } });
  G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, colour: '#f00' } });
  assert.equal(snap(b), before,
    '★거절했다고 «말만» 하고 데이터는 이미 건드렸다 — 거절이 부분 적용을 남기면 거절이 아니다');
});

/* ═══ 양성대조 — 구멍이 «실재했나» ═══════════════════════════════════════ */

test('P4 ★양성대조 — 검증기를 «뺀» 사본은 ok:true 를 주고 화면은 그대로다', async () => {
  const mutated = RAW.replace(
    /const _reject = _gridRejectUnknownCellFields\(rest, lineIndex !== undefined\);\n\s*if \(_reject\) return _reject;\n/,
    '');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const b = fixture(M);
  const r = M.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, shadow: '0 0 4px' } });
  assert.equal(r.ok, true, '★검증기를 뺐는데도 거절된다 — P1~P3 이 재는 것은 «이 검증기»가 아니다');
  assert.match(JSON.stringify(r.applied), /shadow/,
    '★applied 가 그 필드를 되돌려주지 «않는다» — 그렇다면 거짓 성공의 모양이 내 진단과 다르다');
  M.renderGridBlock(b);
  assert.doesNotMatch(b.innerHTML, /shadow/,
    '★화면에 실제로 나온다 — 그러면 이건 «거짓 성공»이 아니라 그냥 미구현 필드다(진단이 틀렸다)');
});

/* ═══ 음성대조 — 멀쩡한 것까지 막지는 않는가 ═════════════════════════════ */

test('P5 ★음성대조 — 렌더러가 읽는 필드는 통과하고 «실제로 그려진다»', () => {
  const b = fixture();
  const r1 = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, fontSize: 44, color: '#112233' } });
  assert.equal(r1.ok, true, `★멀쩡한 줄 필드를 막았다 — ${r1.message}`);
  const r2 = G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, bg: '#eeeeee', padding: 12 } });
  assert.equal(r2.ok, true, `★멀쩡한 셀 필드를 막았다 — ${r2.message}`);
  G.renderGridBlock(b);
  assert.match(b.innerHTML, /font-size:44px/, '★통과시켰는데 «안 그려진다» — 통과가 곧 반영은 아니다');
  assert.match(b.innerHTML, /background:#eeeeee/, '★셀 bg 가 안 그려진다');
});

test('P5b ★음성대조 — `lines` 안의 «줄 필드»는 셀 patch 로도 들어간다(중첩은 안 훑는다)', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 1, lines: [{ type: 'body', text: 'Z', fontSize: 20 }] } });
  assert.equal(r.ok, true, `★lines 안쪽까지 검사해 막아 버렸다 — 그건 다른 문(cells 검증)의 일이다: ${r.message}`);
});

/* ═══ ★도출 — 명부를 손으로 적지 않는다 (지디 조건 ②) ═══════════════════ */

/** 소스에서 함수 본문을 «중괄호 균형»으로 잘라온다. */
function fnBody(src, name) {
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `★${name} 이 없다 — 도출이 겨누는 대상이 사라졌다`);
  let d = 0;
  const st = src.indexOf('{', i);
  for (let j = st; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(st, j + 1); }
  }
  assert.fail(`★${name} 의 본문을 못 닫았다`);
}
const uniq = (a) => [...new Set(a)].sort();

/** 소스에 «선언된» 명부 상수를 읽는다. ⛔모듈에서 못 가져온다(export 아님). */
function declaredSet(src, name) {
  const m = src.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  assert.ok(m, `★${name} 상수를 못 찾았다 — 이름이 바뀌었거나 사라졌다`);
  return uniq([...m[1].matchAll(/'([\w]+)'/g)].map(x => x[1]));
}

test('P6 ★도출 — GRID_LINE_FIELDS 가 «_gridLineHtml 이 읽는 것» 그대로다', () => {
  const read = uniq([...fnBody(RAW, '_gridLineHtml').matchAll(/\bline\.([A-Za-z_]\w*)/g)].map(m => m[1]));
  assert.ok(read.length >= 20, `★도출이 ${read.length}개만 뽑았다 — 파싱이 깨졌고 아래 대조는 무의미하다`);
  assert.deepEqual(declaredSet(RAW, 'GRID_LINE_FIELDS'), read,
    '★상수와 «렌더러가 실제로 읽는 것»이 어긋났다.\n' +
    '  ⇒ 렌더러가 새 필드를 읽기 시작했다면 상수에 더해라(안 그러면 멀쩡한 요청이 거절된다).\n' +
    '  ⇒ 렌더러가 안 읽게 됐다면 상수에서 빼라(안 그러면 거짓 성공이 그 자리로 돌아온다).');
});

test('P7 ★도출 — GRID_CELL_FIELDS 가 «renderGridBlock 이 셀에서 읽는 것» 그대로다', () => {
  const body = fnBody(RAW, 'renderGridBlock');
  const picked = [...body.matchAll(/pick\('([\w]+)'\)/g)].map(m => m[1]);
  const direct = [...body.matchAll(/\bcell\.([A-Za-z_]\w*)/g)].map(m => m[1]);
  const read = uniq([...picked, ...direct]);
  assert.ok(picked.length >= 3, `★pick(...) 를 ${picked.length}개만 찾았다 — 파싱이 깨졌다`);
  assert.deepEqual(declaredSet(RAW, 'GRID_CELL_FIELDS'), read,
    '★상수와 «렌더러가 셀에서 읽는 것»이 어긋났다 — pick(...) 이 늘었거나 줄었다');
});

test('P8 ★양성대조 — 렌더러가 «새 필드»를 읽기 시작하면 도출이 잡는가', () => {
  const mutated = RAW.replace('const align = line.align', 'const zz = line.brandNewThing; const align = line.align');
  assert.notEqual(mutated, RAW, '★변이가 주입되지 않았다');
  const read = uniq([...fnBody(mutated, '_gridLineHtml').matchAll(/\bline\.([A-Za-z_]\w*)/g)].map(m => m[1]));
  assert.ok(read.includes('brandNewThing'),
    '★새로 읽기 시작한 필드를 «못 뽑는다» — P6 의 초록은 「목록이 늘 그대로」라는 뜻일 뿐이다');
});

/* ═══ 안내 — 「무엇을 하라」까지 말하는가 (지디 조건 ①) ═══════════════════ */

test('P9 ★줄 필드를 «셀»에 주면 lineIndex 를 알려 준다 (그 반대도)', () => {
  const b = fixture();
  const a = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, fontSize: 30 } });
  assert.equal(a.ok, false);
  assert.match(a.message, /lineIndex/,
    '★「모르는 필드」로만 끝난다 — fontSize 는 «있는» 필드고 자리만 틀렸다. 그 자리를 알려 줘야 한다');
  assert.match(a.message, /lines:\[/, '★두 번째 길(lines 배열로 주기)을 안 알려 준다');

  const c = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, padding: 8 } });
  assert.equal(c.ok, false);
  assert.match(c.message, /drop lineIndex/,
    '★셀 필드를 줄에 준 경우에 «lineIndex 를 빼라»고 안 말한다');
});

test('P10 ★열 속성(width)은 patchCol 로 보낸다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, width: 2 } });
  assert.equal(r.ok, false, '★width 는 셀이 아니라 «열» 속성이다 — 셀로 주면 조용히 버려진다');
  assert.match(r.message, /patchCol/, '★어디로 가라고 안 알려 준다');
});

test('P11 ★오타는 «되돌려» 준다 (did you mean)', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 0, fontSiez: 20 } });
  assert.equal(r.ok, false);
  assert.match(r.message, /did you mean 'fontSize'/,
    '★가까운 이름을 안 알려 준다 — 거절이 「틀렸다」로 끝나면 부르는 쪽은 다음에 뭘 할지 모른다');
});

test('P12 ★거절이 «왜 조용했는지»를 말한다', () => {
  const b = fixture();
  const r = G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, nonsenseKey: 1 } });
  assert.match(r.message, /ok:true and changed nothing/,
    '★「이게 예전엔 성공으로 보였다」를 안 말한다 — 그걸 알아야 옛 스크립트를 의심한다');
  assert.match(r.message, /Allowed here:/, '★쓸 수 있는 것이 무엇인지 안 알려 준다');
});
