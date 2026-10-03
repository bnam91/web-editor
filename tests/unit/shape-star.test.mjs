// shape-star.test.mjs — B2 별 꼭짓점 수. n 꼭짓점 → 2n 좌표 · viewBox(200×190) 안 · n=5 는 옛 문자열 «그대로».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

/* js/*.js 는 브라우저 ESM 이지만 package.json 에 type:module 이 없다 — 선례(bulk-align-targets.test.mjs)대로 임시 폴더에 얹어 싣는다. */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { starPoints, starClipPath, clampStarN, STAR_VB_W, STAR_VB_H } = await (async () => {
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
