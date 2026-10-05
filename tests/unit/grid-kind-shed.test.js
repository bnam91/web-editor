/* U-KINDSHED — 줄 «종류 바꾸기»가 앞 종류의 짐(height 등)을 턴다 (E14 · 2026-10-06 · APPROVED_BY: 지디 E14-E157)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★병명 (실측 · a8f60da1 · 스크래치 하네스 · 10-06)
 *   MCP update_grid_block{patchCell:{lineIndex, type:'body'}} 로 image(height 160 · 크롭 없음) 줄을 글자 줄로 바꾸면
 *   height:160 이 «남고»(dataset 에 저장됨), 이어 type:'gap' 으로 바꾸면 여백이 16 이 아니라 160px 로 그려진다.
 *   0ff05430(E157 부모)에선 둘 다 없었다(height 사라짐 · gap 16px).
 *   까닭: _gridMergeLine 의 청소는 «옛 줄이 읽던 키»만 턴다. E157 이 «크롭 없는 그림 줄은 height 를 그릴 때 무시»로
 *   바꿔서, 옛 image 줄 «이 인스턴스»가 height 를 안 읽는다 → 청소가 남긴다.
 * ★입구: UI 「종류 바꾸기」(prop-grid _GRD_KIND_SHED)는 손으로 턴다 — 닿는 길은 MCP(E26 선례: 사용자 길).
 * ★하네스 = grid-line-typo.test.js 와 같은 import-스텁 기법(실제 소스를 돌린다).
 * 머리표: [새 것] a8f60da1 에서 빨강 · [회귀 지킴] a8f60da1 에서도 초록.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');
const { makeStripper } = require('./_strip-comments.js');

const ROOT = path.join(__dirname, '../..');

/** 소스에서 «주석을 뺀 코드 줄»만. ⛔파일 하나마다 새 stripper(블록 주석 상태를 들고 간다). */
function codeLines(rel) {
  const strip = makeStripper();
  return readSrc(ROOT, rel).split('\n').map(l => strip(l));
}
const codeOf = (rel) => codeLines(rel).join('\n');

/* ── grid-block.js 를 «실물 그대로» 돌린다 (grid-p1.test.js 와 같은 기법) ── */
const srcPath = path.join(ROOT, 'js/blocks/grid-block.js');
let src = readSrc(srcPath);
const STUB = "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n";
{
  const before_ = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, before_, '소스에서 drag-utils/drag-drop import 2줄을 못 찾음 — 리팩터링됐나?');
}
const gcrAliasPath = path.join(os.tmpdir(), `grid-cell-resize-alias-kindshed-${process.pid}.mjs`);
{
  const before_ = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAliasPath).href));
  assert.notEqual(src, before_, "grid-cell-resize.js import 를 못 찾음");
}

function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag, dataset: {}, style: {}, innerHTML: '', children: [],   // G19 — 렌더러가 직계 자식(.grd-children 유무)을 읽는다 · 이 가짜는 자식을 안 붙이므로 늘 빈 목록
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

let gridLineHtml, GRID_ROLES, makeGridBlock, updateGridBlock, getGridModel, gridPreviewLine, gridLineHasText;

before(async () => {
  const aliasPath = path.join(os.tmpdir(), `grid-kindshed-alias-${process.pid}.mjs`);
  fs.copyFileSync(path.join(ROOT, 'js/grid-cell-resize.js'), gcrAliasPath);
  fs.writeFileSync(aliasPath, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(aliasPath).href);
  fs.unlinkSync(aliasPath); fs.unlinkSync(gcrAliasPath);
  ({ gridLineHtml, GRID_ROLES, makeGridBlock, updateGridBlock, getGridModel, gridPreviewLine, gridLineHasText } = mod);
});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWL6z8DwHwAAAP//A3ONEwAAAAZJREFUAwAFCgIByRpMngAAAABJRU5ErkJggg==';
/** 줄 하나짜리 그리드 → MCP 모양 patchCell 로 종류를 차례로 바꾼다. 매 단계 줄 모델을 돌려준다. */
function switchKinds(first, ...steps) {
  const { block } = makeGridBlock({ cols: [{ width: 1, lines: [first] }] });
  const line = () => getGridModel(block).cells[0][0].lines[0];
  const out = [];
  for (const s of steps) {
    const res = updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 0, ...s } });
    assert.ok(res && res.ok, `[전제] patchCell 이 실패했다: ${JSON.stringify(res)}`);
    out.push(line());
  }
  return { block, out };
}
const gapPx = (line) => Number((gridLineHtml(line, 'left', 0, null).match(/height:(\d+)px/) || [])[1]);

test('K0 [전제] 하네스가 렌더러를 돌린다 — 키 없는 gap 은 16px · height 40 gap 은 40px (재는 자가 산다)', () => {
  assert.equal(gapPx({ type: 'gap' }), 16);
  assert.equal(gapPx({ type: 'gap', height: 40 }), 40, '★gap 이 height 를 안 읽는다 — K2 는 아무것도 못 본다');
});

test('K1 [새 것] ★image(h160 · 크롭 없음) → body: 앞 종류의 짐(imgSrc·height)이 «안» 남는다', () => {
  const { block, out: [body] } = switchKinds({ type: 'image', imgSrc: PNG, height: 160 }, { type: 'body', text: '바뀐 줄' });
  assert.equal(body.type, 'body');
  assert.deepEqual(['imgSrc', 'height', 'widthPct'].filter(k => body[k] !== undefined), [],
    `★종류를 바꿨는데 앞 종류의 필드가 남았다: ${JSON.stringify(body)}`);
  assert.doesNotMatch(String(block.dataset.cols) + String(block.dataset.cells), /"height":160/, '★저장본(dataset)에 height 160 이 남았다');
});

test('K2 [새 것] ★image(h160) → body → gap: 여백이 16px(기본)이지 160px 이 아니다', () => {
  const { out: [, gap] } = switchKinds({ type: 'image', imgSrc: PNG, height: 160 }, { type: 'body', text: 'x' }, { type: 'gap' });
  assert.equal(gap.type, 'gap');
  assert.equal(gapPx(gap), 16, `★지운 줄 알았던 그림 높이가 여백으로 되살아났다: ${JSON.stringify(gap)}`);
});

test('K3 [회귀 지킴] 크롭한 image(imgSizePct) → body 도 height 를 턴다', () => {
  const { out: [body] } = switchKinds({ type: 'image', imgSrc: PNG, height: 160, imgSizePct: 80 }, { type: 'body', text: 'x' });
  assert.deepEqual(['imgSrc', 'height', 'imgSizePct'].filter(k => body[k] !== undefined), [], JSON.stringify(body));
});

test('K4 [회귀 지킴] 글자 종류끼리(h2 → body)는 글자·자간을 «안» 지운다', () => {
  const { out: [body] } = switchKinds({ type: 'h2', text: '소중한 제목', letterSpacing: 0 }, { type: 'body' });
  assert.equal(body.text, '소중한 제목');
  assert.equal(body.letterSpacing, 0, '★역할 기본과 같은 값(자간 0)을 «안 읽힌다»로 오판해 지웠다');
});

test('K5 [회귀 지킴] 이번 호출이 «명시»한 키는 안 턴다 — image → gap 에 height 24 를 같이 주면 24', () => {
  const { out: [gap] } = switchKinds({ type: 'image', imgSrc: PNG, height: 160 }, { type: 'gap', height: 24 });
  assert.equal(gapPx(gap), 24);
  assert.equal(gap.imgSrc, undefined, '★gap 이 안 읽는 imgSrc 가 남았다');
});

/* ══ K6/K7 — «표가 정말 렌더러에서 파생되나»(지디 조건 ㉢) · 비용(태양 조건) ══════════════════════════
 * 테스트 대역: 같은 소스를 한 번 더 얹되 렌더러의 «빈 그림 틀» 모드에서 height 를 «안 읽게» 한 줄만 바꾼다.
 * 파생이면 → 대역의 image 표에서 height 가 빠지고 K1 의 길이 다시 빨개진다. 손으로 적은 표면 → 그대로 초록(거짓 파생).
 * ★대역은 이 파일 안에서만 산다(제품 소스 무변). 표 함수가 없는 판(a8f60da1)에선 K6·K7 은 [전제]에서 멈춘다. */
const EMPTY_FRAME_H = 'const ph = h > 0 ? h : 180;';
async function loadVariant(tag, edit) {
  let v = src;
  if (edit) { const b = v; v = edit(v); assert.notEqual(v, b, `[전제] 대역 «${tag}» 닻을 못 찾았다`); }
  v += '\nexport { _gridTypeCanRead as __typeCanRead };\n';
  const gcr2 = path.join(os.tmpdir(), `gcr-kindshed-${tag}-${process.pid}.mjs`);
  const ali = path.join(os.tmpdir(), `grid-kindshed-${tag}-${process.pid}.mjs`);
  fs.copyFileSync(path.join(ROOT, 'js/grid-cell-resize.js'), gcr2);
  fs.writeFileSync(ali, v.replace(pathToFileURL(gcrAliasPath).href, pathToFileURL(gcr2).href));
  try { return await import(pathToFileURL(ali).href); } finally { fs.unlinkSync(ali); fs.unlinkSync(gcr2); }
}
const hasTable = () => src.includes('function _gridTypeCanRead(');

test('K6 ★파생 증명 — 렌더러의 «빈 틀 높이» 모드를 끈 대역에선 image 표에서 height 가 빠지고 K1 길이 빨개진다', async () => {
  assert.ok(hasTable(), '[전제] 종류 표(_gridTypeCanRead)가 없는 판 — 이 검사는 고친 판 전용');
  const real = await loadVariant('real');
  const dbl = await loadVariant('noEmptyH', s => s.replace(EMPTY_FRAME_H, 'const ph = 180;'));
  assert.equal(real.__typeCanRead('image', 'height'), true, '[전제] 진짜 렌더러에선 image 가 height 를 읽을 수 있다');
  assert.equal(dbl.__typeCanRead('image', 'height'), false, '★렌더러 모드를 껐는데 표가 안 바뀌었다 — 표가 렌더러에서 파생된 게 아니다');
  assert.equal(dbl.__typeCanRead('image', 'radius'), true, '[음성대조] 끈 모드와 무관한 키(radius)는 그대로');
  const { block } = dbl.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', imgSrc: PNG, height: 160 }] }] });
  dbl.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 0, type: 'body', text: 'x' } });
  assert.equal(dbl.getGridModel(block).cells[0][0].lines[0].height, 160, '★대역에서도 height 가 털렸다 — K1 이 표 말고 다른 것 때문에 초록이다');
});

test('K7 비용 — 종류별 첫 부름(표 뜨기)과 두 번째(기억) ms 를 찍는다 · 첫 부름 > 20ms 면 빨강(태양 문턱)', async () => {
  assert.ok(hasTable(), '[전제] 종류 표가 없는 판');
  const fresh = await loadVariant('cost');
  const rows = [];
  for (const T of ['image', 'gap', 'divider', 'body', 'h1', 'h2', 'h3', 'caption', 'label', 'text']) {
    const t0 = performance.now(); fresh.__typeCanRead(T, 'height'); const t1 = performance.now();
    fresh.__typeCanRead(T, 'height'); const t2 = performance.now();
    rows.push({ T, first: +(t1 - t0).toFixed(2), cached: +(t2 - t1).toFixed(3) });
  }
  console.log('K7-COST', JSON.stringify(rows));
  assert.deepEqual(rows.filter(r => r.first > 20).map(r => r.T), [], '★첫 부름이 20ms 를 넘는 종류가 있다 — 커밋 전에 멈추고 보고');
});
