/* grid-divider-handle.test.mjs — 구분선 줄의 «굵기·색 손잡이»와 «잡을 데» (현빈 2026-09-30)
 * 실행: node --test tests/unit/grid-divider-handle.test.mjs
 *
 * ★카드 원문: 「grd_owr55_gql6n0n — 구분선을 추가했는데 구분선 줄이 선택이 안 돼서
 *   구분선 너비 수정을 할 수가 없다」. 둘로 갈린다:
 *     ㈎ 못 «고른다»  → 잡을 데가 1px  ⇒ 면적을 준다(css/editor-blocks.css)
 *     ㈏ 못 «고친다»  → 패널에 칸이 없다 ⇒ 굵기·색 칸을 낸다(js/props/prop-grid.js)
 *   ㈎ 의 «실제 효과»는 브라우저가 아니면 못 잰다 ⇒ tests/dom/grid-divider-hitarea.dom.spec.js.
 *   이 파일은 ㈏ 의 배선과, ㈎ 의 «DOM 픽스처가 렌더러와 같은 꼴인지»를 묶는다.
 *
 * ★D1 이 이 파일의 핵심이다 — DOM 검사는 «손으로 적은 픽스처»를 쓴다. 렌더러가 바뀌면
 *   그 픽스처가 조용히 낡아 「재는 것 없이 초록」이 된다. 그 끈을 여기서 묶는다.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const GRID_SRC_PATH = path.join(ROOT, 'js', 'blocks', 'grid-block.js');
const GRID_SRC = fs.readFileSync(GRID_SRC_PATH, 'utf8');
const PROP_SRC = fs.readFileSync(path.join(ROOT, 'js', 'props', 'prop-grid.js'), 'utf8');
const CSS_SRC = fs.readFileSync(path.join(ROOT, 'css', 'editor-blocks.css'), 'utf8');
const DOM_SPEC = fs.readFileSync(path.join(ROOT, 'tests', 'dom', 'grid-divider-hitarea.dom.spec.js'), 'utf8');

/* ── 미니 DOM — tests/unit/grid-render-gaps.test.js 와 «같은 표면»(베끼는 것이 관례다) ── */
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
        contains: (c) => _classes.has(c), add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; }, scrollIntoView() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let G;
before(async () => {
  let src = GRID_SRC;
  const STUB = 'const insertAfterSelected = () => {};\n'
    + 'const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n'
    + 'const bindBlock = () => {};\n';
  const b1 = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, b1, '★drag-utils/drag-drop import 2줄을 못 찾았다 — 아래 단언이 전부 «다른 이유»로 초록이 된다');
  const tag = `${process.pid}-dv`;
  const gcrAlias = path.join(os.tmpdir(), `gcr-dv-${tag}.mjs`);
  /* ★공용 sanitizer(수지⑦ 2026-10-08) — ★그리드가 ★세 번째 소비자가 되며 ★새 import 가 생겼다.
     ★위 gcr 별칭과 ★같은 스코프에 둔다 — ⛔안쪽 함수에 선언하면 ★바깥 `unlinkSync` 에서
       ★`ReferenceError` 가 난다(★2026-10-08 에 ★내가 ★그렇게 ★5파일을 깼다). */
  const srtAlias = path.join(os.tmpdir(), `srt-dv-${tag}.mjs`);
  const b2 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(src, b2, '★grid-cell-resize.js import 를 못 찾았다');
  const beforeSrt = src;
  src = src.replace("from '../util/sanitize-rich-text.js'", 'from ' + JSON.stringify(pathToFileURL(srtAlias).href));
  assert.notEqual(src, beforeSrt, '★sanitize-rich-text.js import 를 못 찾았다 — 부분 서식 공용 모듈이 끊겼나?');
  fs.copyFileSync(path.join(ROOT, 'js', 'util', 'sanitize-rich-text.js'), srtAlias);
  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcrAlias);
  const alias = path.join(os.tmpdir(), `grid-dv-${tag}.mjs`);
  fs.writeFileSync(alias, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  G = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcrAlias); fs.unlinkSync(srtAlias);
});

/** 구분선 줄 하나를 «진짜 렌더러»로 그려 그 여는 태그를 돌려준다. */
function renderDivider(line) {
  const { block: b } = G.makeGridBlock({ cols: [{ width: 1, lines: [] }] });
  G.updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'divider', ...line }] } });
  const needle = ' data-r="0" data-c="0" data-line="0"';
  const at = b.innerHTML.indexOf(needle);
  assert.ok(at >= 0, '★구분선 줄이 화면에 안 그려졌다 — 렌더러의 divider 가지가 사라졌나?');
  const open = b.innerHTML.lastIndexOf('<', at);
  const close = b.innerHTML.indexOf('>', at);
  return b.innerHTML.slice(open, close + 1);
}

test('D1 ★DOM 검사의 픽스처가 «렌더러가 내는 꼴»과 같다 (픽스처가 낡으면 그쪽이 재는 것 없이 초록이 된다)', () => {
  const tag = renderDivider({ height: 1, color: '#e0e0e0' });
  // 렌더러 쪽 — 이 셋이 DOM 픽스처의 «구분 표식»이다
  assert.match(tag, /class="grd-divider"/, `★렌더러가 grd-divider 클래스를 안 낸다 — 본 것: ${tag}`);
  assert.match(tag, /height:1px;/, `★굵기가 인라인이 아니다 — 본 것: ${tag}`);
  assert.match(tag, /margin-block:8px;/, `★세로 여백이 인라인 margin-block 이 아니다 — 본 것: ${tag}`);
  // DOM 픽스처 쪽 — 같은 셋을 들고 있나
  assert.match(DOM_SPEC, /class="grd-divider"/,
    '★DOM 픽스처에 grd-divider 가 없다 — 그쪽은 이제 다른 것을 재고 있다');
  assert.match(DOM_SPEC, /margin-block:8px/,
    '★DOM 픽스처의 세로 여백이 렌더러와 다르다 — 잡을 데(±7px)의 전제가 깨진다');
  assert.match(DOM_SPEC, /height:1px/,
    '★DOM 픽스처의 굵기가 1px 이 아니다 — 「1px 이라 손이 안 닿는다」는 증상을 안 재고 있다');
});

test('D2 ★굵기·색의 한계가 «상수»에서 온다 — 패널과 렌더러가 같은 수를 본다', () => {
  assert.equal(G.GRID_DIVIDER_H_MIN, 1);
  assert.equal(G.GRID_DIVIDER_H_MAX, 40);
  assert.equal(G.GRID_DIVIDER_DEFAULT_COLOR, '#e0e0e0');
  // 패널이 그 상수를 «import 해서» 쓴다 — 손으로 다시 적으면 두 벌이 된다
  assert.match(PROP_SRC, /GRID_DIVIDER_H_MIN, GRID_DIVIDER_H_MAX, GRID_DIVIDER_DEFAULT_COLOR/,
    '★prop-grid.js 가 구분선 상수를 import 하지 않는다 — 한계가 두 곳에 적힌다');
  for (const k of ['GRID_DIVIDER_H_MIN', 'GRID_DIVIDER_H_MAX', 'GRID_DIVIDER_DEFAULT_COLOR']) {
    assert.ok(PROP_SRC.includes(k), `★패널이 ${k} 를 안 쓴다`);
  }
});

test('D3 ★한계가 실제로 «먹는다» — 상·하한 밖 값은 렌더러가 잘라낸다', () => {
  assert.match(renderDivider({ height: 999 }), /height:40px;/, '★상한을 안 자른다');
  assert.match(renderDivider({ height: 0 }), /height:1px;/, '★0 이 하한으로 안 떨어진다');
  assert.match(renderDivider({}), /background:#e0e0e0;/, '★색이 없을 때 기본색이 안 나온다');
  assert.match(renderDivider({ color: '#123456' }), /background:#123456;/, '★준 색이 안 나온다');
});

test('D4 ★패널에 굵기·색 칸이 «구분선 줄일 때만» 난다', () => {
  for (const id of ['grd-divider-h', 'grd-divider-color', 'grd-divider-hex']) {
    assert.ok(PROP_SRC.includes(id), `★패널에 ${id} 칸이 없다 — 「너비 수정을 할 수가 없다」가 그대로다`);
  }
  // 조건 — isDivider 로만 난다(갭 줄의 높이 칸과 같은 꼴)
  assert.match(PROP_SRC, /const isDivider = \(line\.type \|\| 'body'\) === 'divider';/,
    '★isDivider 판정이 사라졌거나 꼴이 바뀌었다');
  assert.match(PROP_SRC, /\$\{isDivider \? `<div class="prop-row">/,
    '★굵기·색 칸이 isDivider 에 매여 있지 않다 — 모든 줄에 엉뚱한 칸이 난다');
});

test('D5 ⛔배선이 «글자 줄 가드»보다 앞에 있다 — 구분선은 글자 줄이 아니다', () => {
  const iWire = PROP_SRC.indexOf("getElementById('grd-divider-h')");
  const iGuard = PROP_SRC.indexOf("if (!gridLineHasText(hit.line)) return;");
  assert.ok(iWire > 0 && iGuard > 0, '★두 자리 중 하나를 못 찾았다 — 이 단언이 낡았다');
  assert.ok(iWire < iGuard,
    '★구분선 배선이 gridLineHasText 가드 «뒤»에 있다 — 그러면 영영 배선되지 않는다'
    + '(갭 높이 칸이 같은 이유로 가드 앞에 있다).');
});

test('D6 ⛔새 «필드»를 만들지 않았다 — height·color 는 이미 명부에 있다', () => {
  const m = GRID_SRC.match(/const GRID_LINE_FIELDS = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, '★GRID_LINE_FIELDS 를 못 찾았다 — 이 단언이 낡았다');
  const fields = [...new Set([...m[1].matchAll(/'([\w]+)'/g)].map(x => x[1]))];
  assert.ok(fields.includes('height'), '★height 가 명부에 없다');
  assert.ok(fields.includes('color'), '★color 가 명부에 없다');
  // 배선이 그 둘 «말고는» 안 보낸다
  const wired = [...PROP_SRC.matchAll(/gridPreviewLine\(block, r, c, li, \{ (\w+)/g)].map(x => x[1]);
  for (const k of wired) {
    assert.ok(fields.includes(k), `★배선이 명부에 없는 필드 '${k}' 를 보낸다 — 렌더러가 조용히 버린다`);
  }
});

test('D7 ★«잡을 데»가 에디터 안에만 있다 — 내보내기 산출물은 한 픽셀도 안 바뀐다', () => {
  const rule = CSS_SRC.match(/^#canvas \.grid-block \.grd-divider::after \{/m);
  assert.ok(rule, '★구분선 잡을 데 규칙이 없거나 #canvas 로 한정돼 있지 않다 — 내보내기로 샌다');
  assert.match(CSS_SRC, /^#canvas \.grid-block \.grd-divider \{ position: relative; \}$/m,
    '★잡을 데의 기준(position:relative)이 없다 — ::after 가 엉뚱한 조상에 붙는다');
  // ⛔배경을 주지 않는다 — 주면 «보이는 띠»가 되어 캡처에 섞인다
  const at = CSS_SRC.indexOf('#canvas .grid-block .grd-divider::after {');
  const body = CSS_SRC.slice(at, CSS_SRC.indexOf('}', at));
  assert.ok(!/background/.test(body), `★잡을 데에 배경이 있다 — 투명해야 한다. 본 것: ${body}`);
});
