/* shape-ellipse.test.mjs — 1013t2A1 원 «갯수·간격·원마다 색·이너 그림자» 순수 모듈 (js/shape-ellipse.js)
 * 현빈 원문: 「Ellipse 블럭 : 별모양 블럭처럼 갯수 선택하면 늘릴 수 있고, 각 원 모양마다 각각의 색을
 *            입력할 수 있다. 살짝 이너 그림자 느낌도 줄 수 있다.」
 * 이 파일이 재는 것 = «상태 → SVG 글자» 한 축. 패널·캔버스·저장 왕복은 tests/dom/shape-ellipse-multi.dom.spec.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire as _cr } from 'node:module';
const { mkTmpRoot } = _cr(import.meta.url)('./_tmproot.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { E, S } = await (async () => {
  const tmp = mkTmpRoot('gd-ellipse-');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  /* shape-ellipse.js 가 './shape-star.js' 를 import 한다 ⇒ 같은 이름으로 나란히 둔다 */
  fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'shape-star.js'));
  fs.copyFileSync(path.join(ROOT, 'js/shape-ellipse.js'), path.join(tmp, 'shape-ellipse.js'));
  const E = await import(pathToFileURL(path.join(tmp, 'shape-ellipse.js')).href);
  const S = await import(pathToFileURL(path.join(tmp, 'shape-star.js')).href);
  return { E, S };
})();

const count = (s, re) => (s.match(re) || []).length;

test('U0 전제 — 모듈이 실렸고 그리개가 문자열을 낸다 (⛔재기 전에 단언)', () => {
  assert.equal(typeof E.ellipseInnerSVG, 'function');
  assert.equal(typeof E.ellipseInnerSVG({ sw: 0 }), 'string');
  assert.ok(E.ellipseInnerSVG({ sw: 0 }).length > 0);
});

test('U1 옛 바이트 — count≤1 · 그림자 없음이면 옛 _shapeInnerSVG(ellipse) 글자 그대로', () => {
  for (const sw of [0, 3, 7, 20]) {
    const r = Math.max(0, 50 - sw / 2);
    const want = `<ellipse cx="50" cy="50" rx="${r}" ry="${r}"/>`;
    assert.equal(E.ellipseInnerSVG({ sw }), want, `sw=${sw}`);
    /* 개별 색 키가 남아 있어도 count=1 이면 무시(가역 — 다시 늘리면 돌아온다) */
    assert.equal(E.ellipseInnerSVG({ sw, count: 1, colors: '#ff0000', gap: 40 }), want, `sw=${sw} colors 무시`);
  }
  for (const g of [undefined, -50, 0, 20, 100]) assert.equal(E.ellipseViewBox(1, g), '0 0 100 100', `gap=${g}`);
  assert.equal(E.ellipseViewBox(undefined, undefined), '0 0 100 100');
});

test('U2 갯수 범위가 별과 같다 (1~10 · 같은 상수)', () => {
  assert.equal(E.ELLIPSE_COUNT_MIN, S.STAR_COUNT_MIN);
  assert.equal(E.ELLIPSE_COUNT_MAX, S.STAR_COUNT_MAX);
  assert.equal(E.ELLIPSE_COUNT_MIN, 1);
  assert.equal(E.ELLIPSE_COUNT_MAX, 10);
  assert.equal(E.clampEllipseCount(0), 1);
  assert.equal(E.clampEllipseCount(11), 10);
  assert.equal(E.clampEllipseCount('x'), 1);
  assert.equal(E.clampEllipseCount('6'), 6);
});

test('U3 배치 — count 6 · gap 20 ⇒ 원 6개 · cx 50,170,290,… · vbW 700', () => {
  const svg = E.ellipseInnerSVG({ sw: 0, count: 6, gap: 20 });
  assert.equal(count(svg, /<ellipse /g), 6);
  const cxs = [...svg.matchAll(/cx="([\d.-]+)"/g)].map(m => Number(m[1]));
  assert.deepEqual(cxs, [50, 170, 290, 410, 530, 650]);
  assert.equal(E.ellipseViewBoxWidth(6, 20), 700);
  assert.equal(E.ellipseViewBox(6, 20), '0 0 700 100');
  /* 키 없음 = 기본 간격(20) */
  assert.equal(E.ellipseViewBox(6, undefined), '0 0 700 100');
  /* 음수 간격 — 겹치는 줄 */
  assert.equal(E.ellipseViewBoxWidth(3, -50), 200);
});

test('U4 원마다 색 — 지정한 칸만 fill · 빈 칸은 물려받기 · count 1 이면 0', () => {
  const svg = E.ellipseInnerSVG({ sw: 0, count: 3, colors: '#ffffff,,#000000' });
  const els = svg.match(/<ellipse [^>]*\/>/g);
  assert.equal(els.length, 3);
  assert.match(els[0], /fill="#ffffff"/);
  assert.match(els[0], /data-ell-own="1"/);
  assert.doesNotMatch(els[1], /fill=/);
  assert.doesNotMatch(els[1], /data-ell-own/);
  assert.match(els[2], /fill="#000000"/);
  assert.equal(count(E.ellipseInnerSVG({ sw: 0, count: 1, colors: '#ffffff,,#000000' }), /fill=/g), 0);
  /* 따옴표가 섞인 값은 속성으로 안 들어간다 */
  assert.equal(count(E.ellipseInnerSVG({ sw: 0, count: 2, colors: '#fff" onload="x' }), /onload/g), 0);
  /* 쓰기 — 전부 비면 null(키를 지우라는 뜻) · 꼬리 빈칸은 버린다 */
  assert.equal(E.ellipseColorsAttr([null, null]), null);
  assert.equal(E.ellipseColorsAttr(['#a', null, '#c', null]), '#a,,#c');
});

test('U5 이너 그림자 — filter 1개 · blur · 원마다 url · 꺼지면 0', () => {
  const svg = E.ellipseInnerSVG({ sw: 0, count: 4, shadow: 35, id: 'X' });
  assert.equal(count(svg, /<filter id="eish-X"/g), 1);
  assert.equal(count(svg, /<feGaussianBlur /g), 1);
  assert.equal(count(svg, /filter="url\(#eish-X\)"/g), 4);
  assert.match(svg, /flood-opacity="0.21"/);   // 35/100·0.6
  /* count 1 이어도 그림자는 켜진다(한 원) */
  const one = E.ellipseInnerSVG({ sw: 0, shadow: 80, id: 'Y' });
  assert.equal(count(one, /filter="url\(#eish-Y\)"/g), 1);
  assert.match(one, /flood-opacity="0.48"/);
  for (const off of [null, undefined, 0, '', '0']) {
    assert.equal(count(E.ellipseInnerSVG({ sw: 0, count: 3, shadow: off, id: 'Z' }), /filter/g), 0, `shadow=${off}`);
  }
  assert.equal(E.clampEllipseShadow(150), 100);
  assert.equal(E.clampEllipseShadow(-3), null);
});

test('U6 폭 — 원 하나의 비를 지키는 W·vb\'/vb', () => {
  assert.equal(E.ellipseFrameWidthFor(100, 1, 20, 6, 20), 700);
  assert.equal(E.ellipseFrameWidthFor(700, 6, 20, 1, 20), 100);
  assert.equal(E.ellipseFrameWidthFor(160, 1, undefined, 3, -50), 320);
  assert.equal(E.ellipseFrameWidthFor(0, 1, 20, 6, 20), null);
});
