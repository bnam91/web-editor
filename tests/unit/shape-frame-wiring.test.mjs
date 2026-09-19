/* shape-frame-wiring.test.mjs — 0918 shape A안 배선 검사(소스 텍스트).
 *
 * ① 신규 도형 기본 테두리: 채움 도형(rectangle/ellipse/polygon/star)=0, line/arrow=3
 *    — makeShapeBlock 을 잘라 vm 에서 «실행»해 dataset·svg style·inner 세 곳을 잰다.
 * ② «넣을 자리»를 고르는 지점이 _activeFrame 을 resolveInsertFrame 없이 읽지 않는다(명부).
 *    ⚠️명부다 — 새 add 함수가 _activeFrame 을 직접 읽으면 여기 추가할 것.
 *       가능하면 add 함수는 _insertToFlowFrame / insertAfterSelected 를 타게 한다(자동 보호).
 * ③ 로드 정규화: migrateColsFromDOM 이 ejectShapeFrameIntruders 를 부른다.
 * ④ 도형 프레임 자손 검색 판정(querySelector('.shape-block'))이 0개 남는다.
 * ⑤ export-figma-json 이 strokeWidth 0 을 보존한다.
 * ⑥ ⌘G/⌘⌥G flow 분기 도형 가로 위치 원점 = 새 프레임 ss 의 패딩 상자(ss 삽입 «뒤»에 잰다) — 섹션여백 72px 밀림 방지.
 * ⑦ 죽은 셀렉터 data-shape-frame 이 js/ 전체에 0건(shape-frame.js 의 ⛔경고 주석 한 줄만 예외).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { readSrc } from './_srcread.js';
import { sliceBlock } from './_slice-block.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BF = readSrc(ROOT, 'js/block-factory.js');
const DU = readSrc(ROOT, 'js/drag-utils.js');
const ED = readSrc(ROOT, 'js/editor.js');
const SL = readSrc(ROOT, 'js/io/save-load.js');

function runMakeShape(type) {
  const defs = sliceBlock(BF, 'const SHAPE_DEFS = {');
  const inner = sliceBlock(BF, 'function _shapeInnerSVG(type, strokeWidth)');
  const make = sliceBlock(BF, "function makeShapeBlock(type = 'rectangle')");
  const fakeEl = () => ({ dataset: {}, style: {}, className: '', innerHTML: '', id: '' });
  const ctx = { document: { createElement: fakeEl }, genId: (p) => p + '_x', window: {} };
  vm.createContext(ctx);
  vm.runInContext(`${defs}\n${inner}\n${make}\nthis.__out = makeShapeBlock(${JSON.stringify(type)});`, ctx);
  return ctx.__out.block;
}

test('① 신규 채움 도형은 기본 테두리 0 — dataset·svg stroke-width·inner geometry 가 일치', () => {
  for (const t of ['rectangle', 'ellipse', 'polygon', 'star']) {
    const b = runMakeShape(t);
    assert.equal(b.dataset.shapeStrokeWidth, '0', `${t} dataset`);
    assert.match(b.innerHTML, /stroke-width:0;/, `${t} svg style`);
  }
  // rectangle: sw=0 이면 inset 없음(풀폭 100)
  assert.match(runMakeShape('rectangle').innerHTML, /<rect x="0" y="0" width="100" height="100"/);
  assert.match(runMakeShape('ellipse').innerHTML, /rx="50" ry="50"/);
});

test('① 음성대조 — line/arrow 는 선 자체가 stroke 라 3 유지(0이면 안 보이는 선)', () => {
  for (const t of ['line', 'arrow']) {
    const b = runMakeShape(t);
    assert.equal(b.dataset.shapeStrokeWidth, '3', `${t} dataset`);
    assert.match(b.innerHTML, /stroke-width:3;/, `${t} svg style`);
  }
});

test('① updateShapeBlock 이 채움→선 타입 전환 시 sw 0 을 3 으로 올린다', () => {
  const body = sliceBlock(BF, 'if (SHAPE_DEFS_REF && SHAPE_DEFS_REF[partial.shapeType]) {');
  assert.match(body, /if \(!def\.fill && sw <= 0\) \{[\s\S]*?sw = 3;/);
});

test('② 삽입 지점은 _activeFrame 을 resolveInsertFrame 으로만 읽는다', () => {
  const sites = [
    ['_insertToFlowFrame', sliceBlock(BF, 'function _insertToFlowFrame(makeBlockFn, opts = {})')],
    ['addFrameBlock', sliceBlock(BF, 'function addFrameBlock(opts = {})')],
    ['addShapeBlock', sliceBlock(BF, "function addShapeBlock(type = 'rectangle')")],
    ['addJokerBlock', sliceBlock(BF, 'function addJokerBlock(opts = {})')],
    ['insertAfterSelected', sliceBlock(DU, 'function insertAfterSelected(section, el)')],
  ];
  for (const [name, body] of sites) {
    // «읽기» = 쓰기(`window._activeFrame = …`)·해석(`resolveInsertFrame(window._activeFrame)`)·
    //   임시 저장(`const prevActiveSS = window._activeFrame;` — 복원용) 을 뺀 나머지 참조.
    const reads = body.split('\n').filter(l =>
      /window\._activeFrame/.test(l)
      && !/^\s*\/\//.test(l)
      && !/window\._activeFrame\s*=[^=]/.test(l)
      && !/resolveInsertFrame\(window\._activeFrame\)/.test(l)
      && !/const prevActiveSS = window\._activeFrame;/.test(l));
    assert.deepEqual(reads, [], `${name}: resolveInsertFrame 없이 _activeFrame 을 읽는다`);
    assert.ok(/resolveInsertFrame\(/.test(body), `${name}: resolveInsertFrame 을 안 쓴다`);
  }
  // addTextBlock / addBlankTextBlock 두 자리 — 같은 한 줄
  assert.equal((BF.match(/const activeSS = resolveInsertFrame\(window\._activeFrame\);/g) || []).length, 2);
  assert.equal((BF.match(/const activeSS = window\._activeFrame;/g) || []).length, 0);
  // addGapBlock 의 freeLayout 판정
  assert.ok(BF.includes("resolveInsertFrame(window._activeFrame)?.dataset.freeLayout !== 'true' && _insertToFlowFrame("));
  // 붙여넣기 freeLayout 대상 3후보 전부 해석
  const paste = sliceBlock(ED, 'function pasteClipboard()');
  assert.ok(/_flFrame\(window\._activeFrame\)/.test(paste));
  assert.ok(!/window\._activeFrame\?\.dataset\?\.freeLayout \? window\._activeFrame/.test(paste), '옛 직접 읽기가 남았다');
  assert.ok(/anchor = anchorUnitOf\(anchor\)/.test(paste), 'multi-block 앵커 정규화 누락');
});

test('② ⌘D·MCP move/gap 이 도형을 «래퍼째» 단위로 본다', () => {
  assert.ok(/const _shpWrap = shapeFrameOf\(selBlock\);/.test(ED));
  assert.ok(/absWrapper\?\.parentElement\?\.closest\('\.frame-block\[data-free-layout\]'\)/.test(ED),
    '⌘D parentFrame 을 parentElement 부터 찾지 않는다 — 래퍼 자신이 매칭된다');
  assert.ok(!/\.frame-block\[data-shape-frame\]'\)\s*\|\|/.test(sliceBlock(ED, 'function duplicateSelected()')), '죽은 data-shape-frame 셀렉터로 되돌아갔다');
  const mv = sliceBlock(ED, 'function _resolveBlockMoveUnit(el)');
  assert.ok(/if \(shapeFrameOf\(el\)\) return anchorUnitOf\(el\);/.test(mv));
  const gap = sliceBlock(ED, 'function insertGapAfterBlock(blockId, height)');
  assert.ok(/anchorUnitOf\(block\)\.after\(gb\)/.test(gap));
});

test('③ 로드 정규화 — migrateColsFromDOM «끝»에서 ejectShapeFrameIntruders 호출', () => {
  const body = sliceBlock(SL, 'function migrateColsFromDOM(canvasEl)');
  const i = body.indexOf('ejectShapeFrameIntruders(canvasEl)');
  assert.ok(i > 0, '호출 없음');
  // text-frame 래핑(마지막 단계)보다 뒤
  assert.ok(i > body.lastIndexOf("tf.dataset.textFrame = 'true'"), 'text-frame 래핑보다 먼저 불린다 — 이동 단위 미완성');
});

test('④ 도형 프레임 «자손 검색» 판정이 남지 않는다', () => {
  for (const f of ['js/block-drag.js', 'js/props/prop-frame.js', 'js/panels/layer-panel-items.js']) {
    const src = readSrc(ROOT, f);
    assert.equal((src.match(/querySelector\('\.shape-block'\)/g) || []).length, 0, `${f}: 자손 검색`);
    assert.ok(/_isShapeFrameEl\(/.test(src), `${f}: SSOT(isShapeFrame) 미사용`);
  }
  // bindFrameDropZone 은 «이벤트 시점» 판정
  const bd = readSrc(ROOT, 'js/block-drag.js');
  assert.ok(/const isShapeFrame = \(\) => _isShapeFrameEl\(ss\);/.test(bd));
  assert.equal((bd.match(/if \(isShapeFrame\) /g) || []).length, 0, '바인딩 시점 상수 판정이 남았다');
});

test('⑤ export-figma-json — strokeWidth 0 보존', () => {
  const src = readSrc(ROOT, 'js/io/export-figma-json.js');
  assert.ok(!/strokeWidth: parseInt\(el\.dataset\.shapeStrokeWidth\) \|\| 1/.test(src));
  const expr = src.match(/strokeWidth: (\(\(\) => \{ const n = parseInt\(el\.dataset\.shapeStrokeWidth\);[^\n]*\}\)\(\)),/);
  assert.ok(expr, '보존식 없음');
  const f = (v) => vm.runInNewContext(expr[1], { el: { dataset: { shapeStrokeWidth: v } } });
  assert.equal(f('0'), 0);
  assert.equal(f('5'), 5);
  assert.equal(f(undefined), 1);
});

test('⑥ ⌘G/⌘⌥G(wrapSelectedBlocksInFrame) — 도형은 래퍼째 한 단위, 부모 판정은 parentElement 부터', () => {
  const body = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');
  assert.ok(!/data-shape-frame/.test(body), '죽은 셀렉터 data-shape-frame 이 남았다');
  assert.ok(/selected\.map\(el => shapeFrameOf\(el\) \|\| el\)/.test(body), 'shape-block → 래퍼 정규화 없음');
  assert.ok(!/selected\[0\]\.closest\('\.frame-block\[data-free-layout\]'\)/.test(body), '자기 자신을 잡는 closest');
  assert.ok(/b\.parentElement\?\.closest\('\.frame-block\[data-free-layout\]'\)/.test(body));
  // T-057 2라운드: 섹션 좌우여백(section-inner 인라인 padding)만큼 도형이 밀리던 원점
  assert.ok(!/_innerRect\.left/.test(body), 'section-inner 테두리 상자(패딩 포함) 기준 원점이 남았다');
  assert.ok(/ss\.getBoundingClientRect\(\)/.test(body), '원점을 새 프레임 ss 기준으로 잡지 않는다');
  assert.ok(/ss\.clientLeft/.test(body), 'ss 테두리(clientLeft) 보정 없음');
  const iIns = body.indexOf('rows[0].before(ss)');
  const iMeasure = body.indexOf('ss.getBoundingClientRect()');
  const iMove = body.indexOf('ss.appendChild(block)');
  assert.ok(iIns > 0 && iMeasure > iIns, '도형 위치 측정이 ss 삽입보다 앞에 있다');
  assert.ok(iMove > iMeasure, '도형 위치 측정이 블록 이동보다 뒤에 있다');
});

test('⑦ 죽은 셀렉터 data-shape-frame — js/ 전체 0건(⛔경고 주석만 예외)', () => {
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (!line.includes('data-shape-frame')) return;
        const rel = path.relative(ROOT, p);
        if (rel === path.join('js', 'shape-frame.js') && /⛔data-shape-frame 속성을 새로 찍지 마라/.test(line)) return;
        hits.push(`${rel}:${i + 1}`);
      });
    }
  };
  walk(path.join(ROOT, 'js'));
  assert.deepEqual(hits, [], '죽은 셀렉터가 다시 생겼다: ' + hits.join(', '));
});
