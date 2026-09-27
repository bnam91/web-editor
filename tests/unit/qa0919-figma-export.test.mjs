// qa0919-figma-export.test.mjs — 0919 적대적 QA: Figma JSON 도형(크기·그라데이션·가림막) + 렌더러 프레임 그라데이션.
//   원본 소스(_shapeFigmaBlock)를 _slice-block 으로 잘라 가짜 DOM 으로 «실행»한다(모양 말고 행동).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sliceBlock } = require('./_slice-block.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXP = fs.readFileSync(path.join(ROOT, 'js/io/export-figma-json.js'), 'utf8');
const REN = fs.readFileSync(path.join(ROOT, 'figma-renderer/sangpe_to_figma.mjs'), 'utf8');
const SHAPE_SRC = sliceBlock(EXP, 'function _shapeFigmaBlock(');

function load(docById) {
  const document = { getElementById: (id) => docById[id] || null };
  class XMLSerializer { serializeToString(n) { return n.__xml(); } }
  return new Function('document', 'XMLSerializer', `const _REDACT_COVER = '#4a4a4a'; ${SHAPE_SRC}; return _shapeFigmaBlock;`)(document, XMLSerializer);
}
function mkShape({ id = 'shp_1', ds = {}, w = 0, h = 0, frameDs = {}, svgColor = '', grad = null }) {
  const frame = { classList: { contains: (c) => c === 'frame-block' }, dataset: frameDs, style: {} };
  const def = grad && {
    cloneNode() {
      const attrs = { id: grad.id };
      return { setAttribute: (k, v) => { attrs[k] = v; }, __xml: () => `<linearGradient id="${attrs.id}" x1="0" x2="1.5"><stop offset="0%"/></linearGradient>` };
    },
  };
  const svg = { style: { color: svgColor }, querySelector: (s) => (/Gradient/.test(s) ? def : null) };
  const el = {
    id, dataset: ds, style: { position: 'absolute', left: '0', top: '0' }, offsetWidth: w, offsetHeight: h,
    parentElement: frame, querySelector: (s) => (/svg/.test(s) ? svg : null),
  };
  return el;
}

test('0919 ★도형 크기 = 캔버스 실측(래퍼 크기) — 예전엔 style.width 가 없어 늘 75×75(가림막이 14% 만 덮음)', () => {
  const el = mkShape({ ds: { shapeType: 'rectangle', shapeColor: '#ff0000', shapeStrokeWidth: '0' }, w: 300, h: 200 });
  const f = load({ shp_1: el });
  const out = f(el);
  assert.equal(out.width, 300);
  assert.equal(out.height, 200);
  assert.equal(out.color, '#ff0000');
  assert.equal(out.gradientDef, undefined);
});

test('0919 실측 폭이 없으면(다른 페이지 등) 래퍼 dataset 크기, 그것도 없으면 75', () => {
  const el = mkShape({ ds: {}, frameDs: { width: '240', height: '120' } });
  const f = load({});
  assert.deepEqual([f(el).width, f(el).height], [240, 120]);
  const el2 = mkShape({ ds: {} });
  assert.deepEqual([f(el2).width, f(el2).height], [75, 75]);
});

test('0919 ★그라데이션 도형: color 에 CSS 문자열을 싣지 않는다(렌더러에서 검정) — 단색 폴백 + 캔버스 SVG def(id=g)', () => {
  const el = mkShape({ ds: { shapeColor: 'linear-gradient(118deg, #0ef846 -20%, rgba(32,64,255,0.5) 50%, #ffffff 161%)' },
    w: 100, h: 100, svgColor: 'rgb(14, 248, 70)', grad: { id: 'grad-shp_1' } });
  const out = load({ shp_1: el })(el);
  assert.ok(!/gradient/.test(out.color), out.color);
  assert.equal(out.color, 'rgb(14, 248, 70)');
  assert.match(out.gradientDef, /^<linearGradient id="g"/);
});

test('0919 ★가림막: redact 표시 + 불투명 덮개(#4a4a4a), 그라데이션 def 는 싣지 않는다', () => {
  const el = mkShape({ ds: { shapeRedact: 'true', shapeRedactMode: 'mosaic', shapeColor: 'linear-gradient(90deg, #000 0%, #fff 100%)' },
    w: 200, h: 200, grad: { id: 'grad-shp_1' } });
  const out = load({ shp_1: el })(el);
  assert.deepEqual(out.redact, { mode: 'mosaic' });
  assert.equal(out.color, '#4a4a4a');
  assert.equal(out.gradientDef, undefined);
  assert.deepEqual([out.width, out.height], [200, 200]);
});

test('0919 렌더러 소스 가드: 도형 = gradientDef 를 <defs> 로 넣고 url(#g) · 프레임 = 그라데이션이면 «첫 rgba 단색» 대신 set_gradient', () => {
  const shape = REN.slice(REN.indexOf("if (block.type === 'shape')"), REN.indexOf("if (block.type === 'graph')"));
  assert.match(shape, /block\.gradientDef/);
  assert.match(shape, /url\(#g\)/);
  assert.match(shape, /<defs>\$\{gradDef\}<\/defs>/);
  assert.match(shape, /gradient\\s\*\\\(/, '옛 JSON 의 CSS 그라데이션 color 는 회색 폴백');
  const frame = REN.slice(REN.indexOf("if (block.type === 'frame')"), REN.indexOf("if (block.type === 'label-group')"));
  const iGrad = frame.indexOf('_isGradBg');
  const iRgba = frame.indexOf("bgc.match(/rgba?");
  assert.ok(iGrad > 0 && iGrad < iRgba, '그라데이션 판정이 «첫 rgba» 파싱보다 먼저');
  assert.match(frame, /cssGradientToFigmaPaint\(block\.bgGradient, fw, fh\)/);
  assert.match(frame, /run\('set_gradient'/);
});

test('0919 export 소스 가드: 프레임 dataset.width 가 % 면 parseInt 하지 않는다(100% → 100px 사고)', () => {
  const fb = sliceBlock(EXP, 'function _frameBlock(');
  assert.match(fb, /_dsPct/);
  assert.match(fb, /bgGradient/);
});
