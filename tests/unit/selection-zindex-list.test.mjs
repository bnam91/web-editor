/* U-SELZ — 「바깥으로 그리는 선택 아웃라인」은 «반드시» z-index 목록에 있어야 한다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  CSS 소스만 읽는다.
 *
 * ★[M57] 현빈 2026-09-06: 「두 블럭이 맞닿는 부분에 밑에 로고에셋이 카드블럭의
 *   아랫아웃라인을 덮어버려 가려버린다」(cvb_ts0he_v77tmhv ↔ ab_ts0he_x0cekgk).
 *   실측: 카드 bottom 349.1 = 로고 top 349.1(간격 0). 카드는 outline-offset «+2.5px»(바깥)라
 *   아웃라인이 349~354 를 차지하는데 둘 다 z-index:auto → DOM 뒤인 로고가 위에 그려진다.
 *   픽셀 실측 파랑우세: 가리는 이웃이 없는 «위» 변 97 vs 문제의 «아래» 변 42 → 수정 후 97.
 *
 * ★이 검사가 지키는 «규칙»: 아웃라인을 바깥에 그리면 이웃이 덮을 수 있다.
 *   안쪽에 그리면 제 상자 안이라 이웃과 만나지 않는다. ⇒ «바깥 ⇒ z-index 필요» 는 함의다.
 *   ⛔값이 아니라 «함의»를 검사한다 — 새 블록이 바깥 아웃라인을 갖고 목록에 이름을 안 올리면
 *     그 순간 빨강이 된다. 목록으로 관리되는 규칙은 «새 블록이 생길 때 빠지기» 때문이다
 *     (이 파일에서만 세 번째 누락이다: 텍스트프레임 래퍼 · .cvb-card-ph 포인터이벤트 · 이번).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const CSS = ['css/editor-blocks.css', 'css/editor-layout.css', 'css/editor-extra.css']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** `.foo.selected { ... }` 형태의 규칙을 블록이름 → 선언 으로 모은다. */
function selectedRules() {
  const out = {};
  for (const m of CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const body = m[2];
    if (!/outline\s*:/.test(body)) continue;
    const ow = body.match(/outline\s*:\s*([^;]+)/);
    if (!ow || /none|transparent/.test(ow[1])) continue;
    const off = (body.match(/outline-offset\s*:\s*([^;]+)/) || [, '0'])[1].trim();
    for (const sel of m[1].split(',')) {
      const mm = sel.trim().match(/^\.([a-z0-9-]+)\.selected$/);
      if (mm && !(mm[1] in out)) out[mm[1]] = { off, outline: ow[1].trim() };
    }
  }
  return out;
}
/** z-index 2 이상을 받는 `.foo.selected` 블록 이름 집합. */
function zSet() {
  const s = new Set();
  for (const m of CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!/z-index\s*:\s*[2-9]/.test(m[2])) continue;
    for (const sel of m[1].split(',')) {
      const mm = sel.trim().match(/^\.([a-z0-9-]+)\.selected$/);
      if (mm) s.add(mm[1]);
    }
  }
  return s;
}
const isOutward = off => !/^\s*calc\(\s*-/.test(off) && !/^\s*-/.test(off);

const RULES = selectedRules();
const Z = zSet();

test('★M57 — «바깥»으로 그리는 선택 아웃라인은 전부 z-index 목록에 있다', () => {
  const bad = Object.entries(RULES)
    .filter(([blk, r]) => isOutward(r.off) && !Z.has(blk))
    .map(([blk, r]) => `${blk} (offset: ${r.off})`);
  assert.deepEqual(bad, [],
    '바깥 아웃라인인데 z-index 가 없다 — 맞닿은 이웃이 «덮어버린다»(현빈 2026-09-06 제보 그 자체)');
});

test('★기준선 — 바깥으로 그리는 블록이 «실재한다»(검사가 빈 집합을 통과하고 있지 않다)', () => {
  const outward = Object.entries(RULES).filter(([, r]) => isOutward(r.off)).map(([b]) => b);
  assert.ok(outward.length >= 3,
    `바깥 아웃라인 블록이 ${outward.length}개다 — 0이면 위 검사가 «아무것도 안 보고» 통과한다`);
  assert.ok(outward.includes('canvas-block'), 'canvas-block 이 바깥 목록에 없다 — 전제가 바뀌었다');
});

test('★안쪽으로 그리는 블록은 구조적으로 안전하다(참고 — 개수 고정으로 변화를 감지)', () => {
  const inward = Object.entries(RULES).filter(([, r]) => !isOutward(r.off)).length;
  assert.ok(inward >= 20, `안쪽 블록이 ${inward}개 — 크게 줄었다면 방향 정책이 바뀐 것이다`);
});
