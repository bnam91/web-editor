/* grid-img-crop.test.js — 그리드 칸 이미지의 «프레임 안 크롭» 세 필드. (2026-09-25 커밋 ②)
 * 실행: node --test tests/unit/grid-img-crop.test.js   ·  라이브 userData 무접촉(소스를 «읽기»만).
 *
 * ★현빈 2026-09-25: 「그리드 칸 이미지는 지금 원본 비율로밖에 안 들어간다. 원하는 부분만
 *   프레임 안에서 보여주고 싶은데 그게 안 된다. 이미지 에셋 블록과 같은 기능을 하길 원한다.」
 *
 * ★이 파일이 재는 것
 *   K0  ★전제 — 세 이름이 «명부»에 있다(없으면 겨냥 patch 가 통째로 거절된다)
 *   K1  받는가 — patchCell{lineIndex, imgSizePct/imgPosX/imgPosY} 가 통과한다
 *   K2  ★효과 — 통과가 아니라 «화면»이 바뀌었나(절대배치로 갈아탔나)
 *   K3  ★무변화 — 셋이 다 없으면 커밋 ① 산출과 «바이트 동일»이다
 *   K4  ★프레임이 없으면 «거절»한다 — 높이 auto 줄엔 잘릴 것이 없다(거짓 성공 봉쇄)
 *   K5  클램프 — 터무니없는 값이 style 로 새지 않는다
 *   K6  ★왕복 — 저장(dataset) → 다시 읽기(getGridModel) → 다시 그리기가 같은 그림을 준다
 *   K7  지우기 — undefined 셋을 주면 cover 로 «되돌아간다»
 *   K8  ★양성대조 — 렌더러에서 크롭 가지를 떼면 K2 가 빨개진다(그 가지가 실재했다)
 *   K9  단위 — 값이 «％»다(px 가 아니다). 프레임 폭이 바뀌어도 저장값은 그대로여야 한다는 계약.
 *
 * ⛔명부를 손으로 적지 않는다 — K0 은 소스에서 뜬다. 「렌더러가 읽는 것 ≡ 명부」는
 *   grid-patchcell-reject.test.js P6 이 이미 «도출»로 지킨다. 여기선 그 셋이 거기 «있는지»만 본다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability

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

let _seq = 0;
async function loadGrid(src = RAW) {
  const STUB = 'const insertAfterSelected = () => {};\n'
    + 'const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n'
    + 'const bindBlock = () => {};\n';
  const before1 = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, before1, '★drag-utils/drag-drop import 2줄을 못 찾았다 — 리팩터링됐나?');
  const tag = `${process.pid}-${++_seq}`;
  const gcr = path.join(os.tmpdir(), `gcr-crop-${tag}.mjs`);
  const before2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcr).href));
  assert.notEqual(src, before2, '★grid-cell-resize.js import 를 못 찾았다');
  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcr);
  const alias = path.join(os.tmpdir(), `grid-crop-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcr);
  return mod;
}

let G;
before(async () => { G = await loadGrid(); });

const PX = 'data:image/png;base64,iVBORw0KGgo=';

/** 2행 그리드. 크롭은 «행 1»(아래 행)에서 잰다 — 행 0 은 열 겸직이라 저장 자리가 다르다(K6 이 둘 다 본다). */
function fixture(mod = G, line = { type: 'image', imgSrc: PX, height: 200 }) {
  const { block: b } = mod.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.ok(b && b.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  mod.updateGridBlock(b.id, { rows: [{ height: 'auto' }, { height: 'auto' }] });
  const r = mod.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lines: [line] } });
  assert.equal(r.ok, true, `★판을 못 깔았다: ${r.message}`);
  return b;
}
/** 이미지 줄 «통째»(프레임 + 안쪽 그림). */
function lineHtml(b) {
  mod_render(b);
  const m = b.innerHTML.match(/<div[^>]*class="grd-img-frame"[^>]*>[\s\S]*?<\/div>/);
  assert.ok(m, '★이미지 줄을 못 찾았다 — 렌더 골격이 바뀌었나?');
  return m[0];
}
let mod_render = (b) => G.renderGridBlock(b);

/* ═══ K0 — 전제 ═══════════════════════════════════════════════════════ */

test('K0 ★전제 — 크롭 세 이름이 줄 명부(GRID_LINE_FIELDS)에 있다', () => {
  const m = RAW.match(/const GRID_LINE_FIELDS = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, '★GRID_LINE_FIELDS 를 못 찾았다 — 이 파일의 겨냥이 빗나갔다');
  const names = [...m[1].matchAll(/'([\w]+)'/g)].map(x => x[1]);
  for (const k of ['imgSizePct', 'imgPosX', 'imgPosY']) {
    assert.ok(names.includes(k),
      `★'${k}' 가 명부에 없다 — 겨냥 patch(patchCell{lineIndex,${k}})가 통째로 거절된다.\n`
      + '  ⇒ 렌더러가 그 필드를 읽기 시작했다면 명부에도 같이 올려라(grid-patchcell-reject P6 이 그걸 도출로 지킨다).');
  }
});

/* ═══ K1·K2 — 받는가 / «화면»이 바뀌었나 ══════════════════════════════ */

test('K1 크롭 세 값이 겨냥 patch 로 들어간다', () => {
  const b = fixture();
  for (const [k, v] of [['imgSizePct', 160], ['imgPosX', -22.5], ['imgPosY', -10]]) {
    const r = G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lineIndex: 0, [k]: v } });
    assert.equal(r.ok, true, `★'${k}' 가 거절됐다 — ${r.message}`);
  }
});

test('K2 ★효과 — 통과가 아니라 «화면»이 절대배치로 갈아탄다', () => {
  const b = fixture();
  G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lineIndex: 0, imgSizePct: 160, imgPosX: -22.5, imgPosY: -10 } });
  const html = lineHtml(b);
  assert.match(html, /class="grd-img-frame"[^>]*position:relative;overflow:hidden;/,
    '★프레임이 «자르는 그릇»이 안 됐다 — position:relative;overflow:hidden 이 없으면 넘친 그림이 이웃 칸을 덮는다');
  assert.match(html, /position:absolute;left:-22\.5%;top:-10%;width:160%;height:auto;/,
    `★안쪽 그림이 크롭 값대로 안 놓였다.\n  실제 산출: ${html}`);
  assert.doesNotMatch(html, /object-fit/,
    '★크롭 경로인데 object-fit 이 남아 있다 — 두 기전이 겹치면 어느 쪽이 그리는지 알 수 없다');
});

/* ═══ K3 — 무변화 ═════════════════════════════════════════════════════ */

test('K3 ★무변화 — 크롭이 «하나도» 없으면 커밋 ① 산출과 바이트 동일이다', () => {
  const b = fixture();
  const html = lineHtml(b);
  assert.equal(html,
    `<div data-r="1" data-c="0" data-line="0" class="grd-img-frame" style="width:100%;height:200px;">`
    + `<img class="grd-img" src="${PX}" draggable="false" style="display:block;width:100%;height:100%;object-fit:cover;">`
    + `</div>`,
    '★크롭을 «안 준» 줄의 산출이 바뀌었다 — 그러면 기존 저장본의 그림이 통째로 달라진다');
});

/* ═══ K4 — 프레임이 없으면 거절 ═══════════════════════════════════════ */

test('K4 ★높이가 auto 면 거절한다 — 잘릴 것이 없는데 ok:true 를 주면 거짓 성공이다', () => {
  const b = fixture(G, { type: 'image', imgSrc: PX });          // height 없음
  const before = b.dataset.cells;
  const r = G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lineIndex: 0, imgPosX: -20 } });
  assert.equal(r.ok, false,
    '★프레임이 없는 줄에 크롭을 받아 줬다 — 저장은 되는데 화면은 그대로인 «거짓 성공»이다');
  assert.equal(r.code, 'INVALID');
  assert.equal(b.dataset.cells, before,
    '★거절했다고 «말만» 하고 데이터는 이미 건드렸다 — 부분 적용을 남기면 거절이 아니다');
});

/* ═══ K5 — 클램프 ═════════════════════════════════════════════════════ */

test('K5 클램프 — 터무니없는 값이 style 로 새지 않는다', () => {
  const b = fixture(G, { type: 'image', imgSrc: PX, height: 200, imgSizePct: 99999, imgPosX: -99999, imgPosY: 99999 });
  const html = lineHtml(b);
  assert.match(html, /width:1000%/, `★폭 상한(GRID_IMG_SIZE_MAX)이 안 걸렸다: ${html}`);
  assert.match(html, /left:-900%/, `★가로 하한(-GRID_IMG_POS_LIMIT)이 안 걸렸다: ${html}`);
  assert.match(html, /top:900%/, `★세로 상한(GRID_IMG_POS_LIMIT)이 안 걸렸다: ${html}`);
});

test('K5-b 숫자가 아닌 값은 «기본값»으로 떨어진다 — style 속성에 글자가 새지 않는다', () => {
  const b = fixture(G, { type: 'image', imgSrc: PX, height: 200, imgSizePct: 'zzz', imgPosX: 30 });
  const html = lineHtml(b);
  assert.doesNotMatch(html, /zzz/, `★모르는 값이 style 로 샜다: ${html}`);
  assert.match(html, /width:100%/, '★숫자가 아닌 폭이 기본값 100 으로 안 떨어졌다');
  assert.match(html, /left:30%/, '★같은 줄의 멀쩡한 값까지 같이 죽었다');
});

/* ═══ K6 — 왕복 ═══════════════════════════════════════════════════════ */

for (const r of [0, 1]) {
  test(`K6[행 ${r}] ★왕복 — 저장 → 다시 읽기 → 다시 그리기가 같은 그림을 준다`, () => {
    const { block: b } = G.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
    G.updateGridBlock(b.id, { rows: [{ height: 'auto' }, { height: 'auto' }] });
    G.updateGridBlock(b.id, { patchCell: { r, c: 0, lines: [{ type: 'image', imgSrc: PX, height: 200 }] } });
    const ok = G.updateGridBlock(b.id, { patchCell: { r, c: 0, lineIndex: 0, imgSizePct: 137.5, imgPosX: -12.5, imgPosY: -7.5 } });
    assert.equal(ok.ok, true, `★행 ${r} 에서 크롭이 거절됐다 — ${ok.message}`);
    G.renderGridBlock(b);
    const drawn = b.innerHTML;

    /* 저장 = dataset 두 벌(행 0 은 cols, 행 1+ 는 cells). 그걸 «새 블록»에 옮겨 심는다 —
       제품의 「다시 열기」가 하는 일이 정확히 이것이다(renderGridBlock 이 모델에서 다시 그린다). */
    const { block: b2 } = G.makeGridBlock({ cols: [{ width: 1, lines: [] }] });
    b2.dataset.cols = b.dataset.cols;
    b2.dataset.rows = b.dataset.rows;
    b2.dataset.cells = b.dataset.cells;
    G.renderGridBlock(b2);

    const model = G.getGridModel(b2).cells[r][0].lines[0];
    assert.deepEqual(
      { s: model.imgSizePct, x: model.imgPosX, y: model.imgPosY },
      { s: 137.5, x: -12.5, y: -7.5 },
      `★행 ${r} — 다시 읽은 모델에 크롭이 없다(저장을 못 지났다)`);
    const norm = (h) => h.replace(/id="[^"]*"/g, 'id="_"');
    assert.equal(norm(b2.innerHTML), norm(drawn),
      `★행 ${r} — 다시 그린 화면이 저장 전과 다르다`);
  });
}

/* ═══ K7 — 지우기 ═════════════════════════════════════════════════════ */

test('K7 지우기 — 셋을 undefined 로 주면 cover 로 «되돌아간다»', () => {
  const b = fixture();
  G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lineIndex: 0, imgSizePct: 160, imgPosX: -20, imgPosY: -10 } });
  assert.match(lineHtml(b), /position:absolute/, '★전제가 깨졌다 — 크롭이 애초에 안 걸렸다');
  const lines = G.getGridModel(b).cells[1][0].lines.map(l => {
    const { imgSizePct, imgPosX, imgPosY, ...rest } = l;   // 패널 「크롭 초기화」와 같은 뜻
    return rest;
  });
  const r = G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lines } });
  assert.equal(r.ok, true, `★되돌리기가 거절됐다 — ${r.message}`);
  const html = lineHtml(b);
  assert.match(html, /object-fit:cover/, `★cover 로 안 돌아갔다: ${html}`);
  assert.doesNotMatch(html, /position:absolute/, '★절대배치가 남아 있다');
  assert.doesNotMatch(html, /overflow:hidden/, '★크롭이 없는데 프레임이 계속 «자르는 그릇»이다');
});

/* ═══ K8 — 양성대조 ═══════════════════════════════════════════════════ */

test('K8 ★양성대조 — 렌더러에서 크롭 가지를 떼면 K2 가 빨개진다(그 가지가 실재했다)', async () => {
  const mutated = RAW.replace(
    'const cropped  = h > 0 && (cropSize !== null || cropX !== null || cropY !== null);',
    'const cropped  = false;');
  assert.notEqual(mutated, RAW, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const M = await loadGrid(mutated);
  const b = fixture(M);
  const r = M.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lineIndex: 0, imgSizePct: 160, imgPosX: -22.5 } });
  M.renderGridBlock(b);
  assert.doesNotMatch(b.innerHTML, /position:absolute/,
    '★가지를 뗐는데도 절대배치가 나온다 — K2 가 재는 것은 «그 가지»가 아니다');
  assert.equal(r.ok, false,
    '★가지를 뗐는데 ok:true 다 — 그렇다면 K4 의 «거짓 성공 봉쇄»는 이 가지와 무관하게 초록이었다');
});

/* ═══ K9 — 단위 계약 ══════════════════════════════════════════════════ */

test('K9 ★단위 — 저장값은 «％»다. px 를 뜻하는 글자가 크롭 셋에서 안 나온다', () => {
  const b = fixture();
  G.updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lineIndex: 0, imgSizePct: 160, imgPosX: -22.5, imgPosY: -10 } });
  const html = lineHtml(b);
  const inner = html.match(/<img[^>]*>/)[0];
  const crop = inner.match(/(left|top|width):[^;]*/g) || [];
  assert.equal(crop.length, 3, `★크롭 세 선언을 못 찾았다: ${inner}`);
  for (const d of crop) {
    assert.match(d, /%$/,
      `★'${d}' 가 ％가 아니다 — 칸 폭은 «열 가중치»로 늘었다 줄었다 하고 내보내기는 860→780 으로\n`
      + '  바꾼다(js/io/export-image.js syncImageBoxesToCaptureWidth). px 로 두면 그때마다 크롭이 어긋난다.');
  }
  /* 높이만은 auto 다 — 그림 비율을 지키는 축이라 ％로 못박으면 그림이 찌그러진다. */
  assert.match(inner, /height:auto/, '★안쪽 그림의 높이가 auto 가 아니다 — 비율이 깨진다');
});
