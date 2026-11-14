/* label-shape.test.mjs — js/util/label-shape.js (B1 라벨 모양 변수 · 261114) · 글을 읽어 export 만 걷고 돌린다
 *   S1 normalize — 종류 5 밖·틀린 색·범위 밖 반경 → 안전값 · 테두리는 색이 있어야
 *   S2 shapeStyle — 종류별 반경·clip-path(알약 999px · 타원 50% · 둥근 네모 N px · 태그/리본 다각형)
 *   S3 이름 — CSS 변수 이름 꼴만(따옴표·괄호·공백·세미콜론 거절) · 그 밖은 선언 0
 *   S4 refStyle — 변수 참조 + 대체값 = 지금 값(변수 없는 내보내기에서도 같은 꼴)
 *   S5 bind/unbind — 칸에 data-label-shape·참조 · 끊으면 지금 값 그대로 박고 표식 뗌(가짜 칸)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const src = readSrc(REPO, 'js/util/label-shape.js');
assert.doesNotMatch(src, /^\s*import\s/m, '★전제: 순수 모듈');
const names = [...src.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
const M = new Function(src.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();

test('S1 normalize', () => {
  assert.deepEqual(M.normalizeLabelShape({}), { kind: 'pill', radius: 8, bg: '#111111', color: '#ffffff', borderColor: '', borderWidth: 0 });
  assert.deepEqual(M.normalizeLabelShape({ kind: 'blob', radius: 999, bg: 'red;x', color: 'url(x)', borderColor: '#000', borderWidth: 9 }),
    { kind: 'pill', radius: 60, bg: '#111111', color: '#ffffff', borderColor: '#000', borderWidth: 6 });
  assert.equal(M.normalizeLabelShape({ borderWidth: 2 }).borderWidth, 0, '테두리 색이 없으면 두께 0');
  assert.equal(M.normalizeLabelShape({ bg: 'rgba(0, 0, 0, 0.5)' }).bg, 'rgba(0, 0, 0, 0.5)');
});

test('S2 shapeStyle 종류별', () => {
  assert.equal(M.shapeStyle({ kind: 'pill' }).radius, '999px');
  assert.equal(M.shapeStyle({ kind: 'ellipse' }).radius, '50%');
  assert.equal(M.shapeStyle({ kind: 'round', radius: 6 }).radius, '6px');
  assert.match(M.shapeStyle({ kind: 'tag' }).clip, /^polygon\(/);
  assert.match(M.shapeStyle({ kind: 'ribbon' }).clip, /^polygon\(/);
  assert.equal(M.shapeStyle({ kind: 'pill' }).clip, 'none');
  assert.equal(M.shapeStyle({ borderColor: '#123456', borderWidth: 1.5 }).border, '1.5px solid #123456');
});

test('S3 이름', () => {
  for (const ok of ['brand', 'Badge_1', 'oval-2']) assert.equal(M.isLabelShapeName(ok), true, ok);
  for (const bad of ['', 'a b', 'x)', 'x;y', '"q"', 'a'.repeat(33), null]) assert.equal(M.isLabelShapeName(bad), false, String(bad));
  assert.deepEqual(M.labelShapeVarDecls('x;}body{', { kind: 'pill' }), []);
  assert.deepEqual(M.labelShapeVarDecls('oval', { kind: 'ellipse', bg: '#ff0000' }).map(([k]) => k),
    ['--lshape-oval-bg', '--lshape-oval-color', '--lshape-oval-radius', '--lshape-oval-clip', '--lshape-oval-border']);
});

test('S4 refStyle — 참조 + 지금 값 대체', () => {
  const r = M.refStyle('oval', { kind: 'ellipse', bg: '#ff0000', color: '#00ff00' });
  assert.equal(r.backgroundColor, 'var(--lshape-oval-bg, #ff0000)');
  assert.equal(r.borderRadius, 'var(--lshape-oval-radius, 50%)');
  assert.equal(r.clipPath, 'var(--lshape-oval-clip, none)');
});

test('S5 bind / unbind', () => {
  const item = { style: {}, dataset: {} };
  assert.equal(M.bindLabelItem(item, 'bad name', {}), false);
  assert.equal(M.bindLabelItem(item, 'oval', { kind: 'ellipse', bg: '#ff0000', color: '#ffffff' }), true);
  assert.equal(item.dataset.labelShape, 'oval');
  assert.equal(item.style.backgroundColor, 'var(--lshape-oval-bg, #ff0000)');
  assert.deepEqual([item.dataset.bg, item.dataset.radius], ['#ff0000', '50%']);
  M.unbindLabelItem(item, { kind: 'ellipse', bg: '#ff0000', color: '#ffffff' });
  assert.equal(item.dataset.labelShape, undefined);
  assert.deepEqual([item.style.backgroundColor, item.style.borderRadius, item.style.clipPath], ['#ff0000', '50%', '']);
});
