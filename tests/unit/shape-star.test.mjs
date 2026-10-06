// shape-star.test.mjs — B2 별 꼭짓점 수. n 꼭짓점 → 2n 좌표 · viewBox(200×190) 안 · n=5 는 옛 문자열 «그대로».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

/* js/*.js 는 브라우저 ESM 이지만 package.json 에 type:module 이 없다 — 선례(bulk-align-targets.test.mjs)대로 임시 폴더에 얹어 싣는다. */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { starPoints, starClipPath, clampStarN, STAR_VB_W, STAR_VB_H,
        starViewBox, starPointsAt, starPointsList, clampStarCount, STAR_COUNT_MAX } = await (async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-star-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'm.js'));
  const m = await import(pathToFileURL(path.join(tmp, 'm.js')).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return m;
})();

const OLD_POINTS = '100,8 122,70 188,70 135,110 155,172 100,132 45,172 65,110 12,70 78,70';
const OLD_CLIP = 'polygon(50% 4.21%, 61% 36.84%, 94% 36.84%, 67.5% 57.89%, 77.5% 90.53%, 50% 69.47%, 22.5% 90.53%, 32.5% 57.89%, 6% 36.84%, 39% 36.84%)';
const pairs = (s) => s.trim().split(/\s+/).map(p => p.split(',').map(Number));

test('n 꼭짓점 → 2n 좌표쌍 (3~12 전수)', () => {
  for (let n = 3; n <= 12; n++) {
    const p = pairs(starPoints(n));
    assert.equal(p.length, 2 * n, `n=${n}`);
    assert.ok(p.every(q => q.length === 2 && q.every(Number.isFinite)), `n=${n} 숫자`);
    assert.equal(starClipPath(n).split(',').length, 2 * n, `clip n=${n}`);
  }
});
test('모든 좌표가 viewBox 안(0..200, 0..190) · clip 은 0..100%', () => {
  for (let n = 3; n <= 12; n++) {
    for (const [x, y] of pairs(starPoints(n))) {
      assert.ok(x >= 0 && x <= STAR_VB_W && y >= 0 && y <= STAR_VB_H, `n=${n} (${x},${y})`);
    }
    for (const v of starClipPath(n).match(/-?[\d.]+(?=%)/g).map(Number)) assert.ok(v >= 0 && v <= 100, `clip n=${n} ${v}`);
  }
});
test('n=5 는 옛 문자열과 바이트 동일(points·clip)', () => {
  assert.equal(starPoints(5), OLD_POINTS);
  assert.equal(starClipPath(5), OLD_CLIP);
  assert.equal(starPoints('5'), OLD_POINTS);
  assert.equal(starPoints(undefined), OLD_POINTS);
});
test('n≠5 는 5 와 다르고, 같은 n 은 늘 같은 값(순수·멱등)', () => {
  for (let n = 3; n <= 12; n++) {
    if (n !== 5) assert.notEqual(starPoints(n), OLD_POINTS);
    assert.equal(starPoints(n), starPoints(n));
  }
});
test('block-factory.js SHAPE_DEFS.star 의 옛 문자열 == starPoints(5) (명부가 둘이라 대조로 잠근다)', () => {
  const bf = fs.readFileSync(path.join(ROOT, 'js/block-factory.js'), 'utf8');
  const m = bf.match(/star:\s*\{[^}]*<polygon points="([^"]+)"/);
  assert.ok(m, 'SHAPE_DEFS.star 를 못 찾았다');
  assert.equal(m[1], starPoints(5));
});
test('범위 밖·비수는 3~12 로 조인다', () => {
  assert.equal(clampStarN(1), 3);
  assert.equal(clampStarN(99), 12);
  assert.equal(clampStarN('abc'), 5);
});

/* ══ 별 «갯수»(현빈 2026-10-06) — 한 블록 안에 별 N개 · 늘리면 블록이 옆으로 넓어진다 ══
 * ★양성대조 = 아래 「count=1 은 바이트 동일」·「오프셋 200·i」 둘 중 하나를 망가뜨리면 빨강이다.
 *   ⛔특례(count===1 → starPoints 그대로)를 지우면 첫 시험이 빨강 · 오프셋을 0 으로 박으면 둘째가 빨강. */
test('갯수: count=1 은 ★옛 한 벌과 바이트 동일(points·viewBox)', () => {
  for (let n = 3; n <= 12; n++) {
    assert.deepEqual(starPointsList(n, 1), [starPoints(n)], `n=${n}`);
    assert.equal(starPointsAt(n, 0), starPoints(n), `n=${n} i=0`);
  }
  assert.equal(starViewBox(1), `0 0 ${STAR_VB_W} ${STAR_VB_H}`);
});
test('갯수: block-factory.js SHAPE_DEFS.star.vb == starViewBox(1) (명부가 둘이라 대조로 잠근다)', () => {
  const bf = fs.readFileSync(path.join(ROOT, 'js/block-factory.js'), 'utf8');
  const m = bf.match(/star:\s*\{\s*vb:\s*'([^']+)'/);
  assert.ok(m, 'SHAPE_DEFS.star.vb 를 못 찾았다');
  assert.equal(m[1], starViewBox(1));
});
test('갯수: count 개 polygon · i 번째는 ★가로로 200·i 만큼만 옮겨졌다(y 는 불변)', () => {
  const pairs = (s) => s.trim().split(/\s+/).map(p => p.split(',').map(Number));
  for (let n = 3; n <= 12; n++) {
    for (const c of [1, 2, 3, 5, 10]) {
      const list = starPointsList(n, c);
      assert.equal(list.length, c, `n=${n} c=${c} 개수`);
      const base = pairs(list[0]);
      for (let i = 0; i < c; i++) {
        const got = pairs(list[i]);
        assert.equal(got.length, 2 * n, `n=${n} c=${c} i=${i} 좌표쌍`);
        got.forEach(([x, y], k) => {
          assert.ok(Math.abs(x - (base[k][0] + STAR_VB_W * i)) < 0.011, `n=${n} i=${i} x[${k}] ${x}`);
          assert.equal(y, base[k][1], `n=${n} i=${i} y[${k}]`);
        });
      }
    }
  }
});
test('갯수: 모든 좌표가 viewBox(0..200·count, 0..190) 안', () => {
  const pairs = (s) => s.trim().split(/\s+/).map(p => p.split(',').map(Number));
  for (let n = 3; n <= 12; n++) {
    for (const c of [1, 2, 5, 10]) {
      const vb = starViewBox(c).split(' ').map(Number);   // [0,0,W,H]
      assert.equal(vb[2], STAR_VB_W * c);
      assert.equal(vb[3], STAR_VB_H);
      for (const pts of starPointsList(n, c)) {
        for (const [x, y] of pairs(pts)) {
          assert.ok(x >= 0 && x <= vb[2], `n=${n} c=${c} x=${x} > ${vb[2]}`);
          assert.ok(y >= 0 && y <= vb[3], `n=${n} c=${c} y=${y}`);
        }
      }
    }
  }
});
test('갯수: 범위 밖·비수는 1~10 으로 조인다 · 순수(같은 입력 같은 값)', () => {
  assert.equal(clampStarCount(0), 1);
  assert.equal(clampStarCount(-3), 1);
  assert.equal(clampStarCount(99), STAR_COUNT_MAX);
  assert.equal(clampStarCount('abc'), 1);
  assert.equal(clampStarCount('4'), 4);
  assert.equal(clampStarCount(2.6), 3);
  assert.deepEqual(starPointsList(7, 3), starPointsList(7, 3));
});
