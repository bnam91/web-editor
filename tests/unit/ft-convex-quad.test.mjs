/* FT-CONVEX — 141행 ㉯ 자유변형 네 점 «볼록» 판정 + 바꾸는 문이 그것으로 거절하는가 (NEW-현빈QA-FREE-TRANSFORM-HANDLES-OFF-OUTLINE-01)
 *   실행: node tests/run-unit.mjs tests/unit/ft-convex-quad.test.mjs
 *   C1 isConvexQuad 진리표(바탕 네모·사다리꼴·채점판 사본 = 참 / 스샷 나비꼴·오목·겹친 두 점·한 줄·NaN = 거짓)
 *   C2 setFxFreeTransform 이 isConvexQuad 로 «이력 전»에 거절한다(소스 모양) — FTH-CTL2(그 줄 삭제)에서 빨강
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isConvexQuad } from '../../js/fx/homography.js';

test('C1 isConvexQuad 진리표', () => {
  const T = [
    [[[0, 0], [300, 0], [300, 100], [0, 100]], true, '바탕 네모'],
    [[[40, 0], [360, 0], [400, 140], [0, 140]], true, '사다리꼴(u3 TRAP)'],
    [[[0, 0], [295.55, -6.78], [548.6, 160.03], [-70.33, 297.92]], true, '채점판 사본 네 점'],
    [[[0, 0], [0, 100], [300, 100], [300, 0]], true, '거울(반시계) 네모 — 부호 무관'],
    [[[0, 0], [300, 0], [0, 100], [300, 100]], false, '아래 두 점 엇갈린 나비'],
    [[[112, 380], [296, -2], [307, 362], [-80, 374]], false, '스샷 나비꼴'],
    [[[0, 0], [300, 0], [150, 20], [0, 100]], false, '오목(se 안으로)'],
    [[[0, 0], [0, 0], [300, 100], [0, 100]], false, '겹친 두 점'],
    [[[0, 0], [100, 0], [200, 0], [300, 0]], false, '한 줄'],
    [[[0, 0], [NaN, 0], [300, 100], [0, 100]], false, 'NaN'],
  ];
  for (const [C, want, name] of T) assert.equal(isConvexQuad(C), want, name);
});

test('C2 setFxFreeTransform — pushHistory «전»에 isConvexQuad 로 NON_CONVEX 거절', () => {
  const src = fs.readFileSync(new URL('../../js/effects-freetransform.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('export function setFxFreeTransform('));
  const iGuard = body.search(/!isConvexQuad\(C\)\)\s*return\s*\{\s*ok:\s*false,\s*code:\s*'NON_CONVEX'\s*\}/);
  const iHist = body.indexOf("window.pushHistory?.('효과')");
  assert.ok(iGuard > 0, '거절 줄이 있다');
  assert.ok(iHist > iGuard, '거절이 이력보다 앞(빈 걸음 0)');
});
