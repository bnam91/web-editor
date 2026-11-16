/* poly-round-twin — 꼭짓점 둥글기(roundPolyPoints) «두 벌» 잠금 · 현빈 QA 261116 톱니 끝 곡률 · 별 꼭짓점 곡률.
 *   같은 몸통이 js/blocks/burst-geometry.js · js/shape-star.js 두 곳에 있다 — 둘 다 단위가 «파일 하나만» 싣는다
 *   (burst-geometry.test 는 import 0 을 단언 · shape-star 시험들은 임시폴더에 그 파일만 복사해 import). 그래서 import 로 못 묶고 여기서 같은 출력으로 묶는다.
 * R1 두 벌 = 같은 점(여러 모양·둥글기) · R2 0/빈값/null = 받은 점 그대로(옛 바이트) · R3 50 = 꼭짓점마다 7점 · 볼록 꼭짓점이 안쪽으로
 * R4 톱니: burstPoints round 0 = 옛 48점 문자열 · 50 = 336점 · 끝 반지름 < 50 · R5 별: starPoints/starClipPath/starPointsList round 0 = 옛 문자열 · 40 = 점 70 · 끝이 안쪽
 * 양성대조(예측 · CTL): shape-star.js roundPolyPoints 의 `const u = s / ROUND_SEG` → `const u = s / ROUND_SEG / 2` → R1 빨강(두 벌 갈림) · R5 는 초록 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mkTmpRoot } from './_tmproot.js';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const ROOT = path.join(import.meta.dirname, '..', '..');
const bsrc = readSrc(ROOT, 'js/blocks/burst-geometry.js');
const bnames = [...bsrc.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
const B = new Function(bsrc.replace(/\bexport\s+/g, '') + `\n;return { ${bnames.join(', ')} };`)();   // burst-geometry.test 와 같은 싣기
const tmp = mkTmpRoot('gd-poly-round-');
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'm.js'));
const S = await import(pathToFileURL(path.join(tmp, 'm.js')).href);

const SHAPES = {
  tri: [[0, 0], [100, 0], [50, 80]],
  star5: S.starPoints(5).split(' ').map((q) => q.split(',').map(Number)),
  burst: B.burstPoints({ teeth: 12, depth: 20 }).split(' ').map((q) => q.split(',').map(Number)),
};
const rOf = (pts, cx, cy) => Math.max(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy)));

test('R1 두 벌 = 같은 점', () => {
  for (const [k, pts] of Object.entries(SHAPES)) for (const r of [1, 25, 50, 100]) assert.deepEqual(S.roundPolyPoints(pts, r), B.roundPolyPoints(pts, r), `★${k} round ${r} 두 벌이 갈렸다`);
});

test('R2 0 · 빈값 · null · 이상한 값 = 그대로', () => {
  for (const r of [0, '', null, undefined, 'x', -5]) assert.equal(S.roundPolyPoints(SHAPES.tri, r), SHAPES.tri, `round ${r}`);
});

test('R3 50 = 꼭짓점마다 7점 · 볼록 꼭짓점이 안쪽으로', () => {
  const out = S.roundPolyPoints(SHAPES.tri, 50);
  assert.equal(out.length, 3 * 7);
  assert.ok(!out.some(([x, y]) => (x === 0 && y === 0) || (x === 100 && y === 0)), '꼭짓점 자체는 안 남는다');
});

test('R4 톱니 — round 0 = 옛 문자열 · 50 = 336점 · 끝 반지름 < 50', () => {
  const old = B.burstPoints({ teeth: 24, depth: 14 });
  assert.equal(B.burstPoints({ teeth: 24, depth: 14, round: 0 }), old);
  assert.equal(old.split(' ').length, 48);
  const p = B.burstPoints({ teeth: 24, depth: 14, round: 50 }).split(' ').map((q) => q.split(',').map(Number));
  assert.equal(p.length, 336);
  assert.ok(rOf(p, 50, 50) < 49.5, `끝 반지름 ${rOf(p, 50, 50)}`);
});

test('R5 별 — round 0 = 옛 문자열(점·clip·여러 별) · 40 = 점 70 · 끝이 안쪽', () => {
  assert.equal(S.starPoints(5, null, 0), S.starPoints(5));
  assert.equal(S.starClipPath(5, null, 0), S.starClipPath(5));
  assert.deepEqual(S.starPointsList(5, 3, 20, 50, null, 0), S.starPointsList(5, 3, 20, 50, null));
  const p = S.starPoints(5, null, 40).split(' ').map((q) => q.split(',').map(Number));
  assert.equal(p.length, 70);
  assert.ok(rOf(p, 100, 98.66) < rOf(SHAPES.star5, 100, 98.66) - 1, '끝이 안쪽으로');
  assert.match(S.starClipPath(5, null, 40), /^polygon\(/);
  assert.equal(S.starClipPath(5, null, 40).split(',').length, 70, 'clip 도 같은 점 수');
  assert.equal(S.starPointsList(5, 2, 20, null, null, 40)[0], S.starPoints(5, null, 40), '여러 별 첫 별 = 한 별');
});
