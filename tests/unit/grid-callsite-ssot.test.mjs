/* 단위 하네스 — «호출부가 상수를 리터럴로 덮지 않는가»를 소스 문자열로 지킨다.
 *
 * ★왜 이 파일이 따로 있나 (적대검수 T1)
 * grid-cell-resize.test.mjs 에 「상한/최소폭은 «상수 한 곳»에서 온다 — 호출부 리터럴로 갈라지지
 * 않는다」는 이름의 테스트를 넣어놨는데, 본문이 «모듈 내부»만 봤다. 실제 결함은 호출부
 * (overlay-handles.js) 에 있었고, 결함을 그대로 되살려도 434/434 초록이었다 — 검수자가
 * 변이(리터럴 복원)로 실증했다. 값을 부르는 쪽을 안 보면 SSOT 는 지켜지지 않는다.
 *
 * ⚠️이 파일은 «동작»이 아니라 «소스 문자열»을 단언한다. 정상적인 리팩터링에도 빨강이 날 수 있다 —
 *   그때는 이 파일을 지우지 말고, 「그 상수가 여전히 한 곳에서 오는가」를 확인한 뒤 패턴을 고쳐라.
 *   선례: grid-p1.test.js 가 같은 방식으로 import 2줄의 존재를 지킨다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8');

/* 주석을 걷어낸다 — 주석에 적힌 옛 리터럴(설명문)을 결함으로 세면 오탐이다.
 * (이 레포의 design-gate 가 예전에 정확히 그 오탐을 냈다.) */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

test('★행 높이: overlay-handles 의 resizeRowHeight 호출이 min/max 를 «넘기지 않는다»', () => {
  const src = stripComments(read('js/overlay-handles.js'));
  const calls = [...src.matchAll(/resizeRowHeight\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(calls.length > 0, 'resizeRowHeight 호출을 못 찾았다 — 리팩터링됐나? 패턴을 갱신하라');
  for (const args of calls) {
    const n = args.split(',').length;
    assert.equal(n, 2,
      `resizeRowHeight(${args}) — 인자가 ${n}개다. min/max 를 넘기면 모듈 기본값(ROW_H_MIN/ROW_H_MAX)이 죽는다. ` +
      `패널은 4000, 드래그는 2000 으로 갈렸던 실제 결함이다.`);
  }
});

test('★열 최소폭: overlay-handles 의 resizeColBoundary 호출이 minPx 를 «넘기지 않는다»', () => {
  const src = stripComments(read('js/overlay-handles.js'));
  const calls = [...src.matchAll(/resizeColBoundary\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(calls.length > 0, 'resizeColBoundary 호출을 못 찾았다 — 패턴을 갱신하라');
  for (const args of calls) {
    const n = args.split(',').length;
    assert.equal(n, 4,
      `resizeColBoundary(${args}) — 인자가 ${n}개다. 5번째(minPx)를 넘기면 COL_MIN_PX 가 죽는다.`);
  }
});

test('★행 높이 상한 4000 은 «상수 밖»에 리터럴로 남아 있지 않다', () => {
  // 상수 정의 파일 자신은 제외. 나머지에서 행 높이 문맥의 4000 이 보이면 SSOT 가 깨진 것이다.
  const targets = ['js/blocks/grid-block.js', 'js/props/prop-grid.js', 'js/overlay-handles.js'];
  for (const rel of targets) {
    const src = stripComments(read(rel));
    assert.equal(/\b4000\b/.test(src), false,
      `${rel} 에 리터럴 4000 이 남아 있다 — ROW_H_MAX 를 import 해서 써라`);
    assert.equal(/\b2000\b/.test(src), false,
      `${rel} 에 리터럴 2000 이 남아 있다 — 드래그 상한이 혼자 절반이던 결함의 재발이다`);
  }
});

test('★피커 격자 폭은 CSS 가 아니라 상수에서 온다(축 하드코딩 방지)', () => {
  const src = stripComments(read('js/props/_helpers.js'));
  assert.match(src, /gridTemplateColumns/,
    'buildGridPicker 가 격자 열 수를 직접 정하지 않는다 — CSS 의 repeat(4,1fr) 이 「한 변 4」를 따로 알게 된다');
  // 행 루프가 행 상한(MAXR)을 쓰는지 — MAX(열 상한)로 돌면 alive 와 어긋난다(적대검수 G1)
  assert.match(src, /for\s*\(\s*let\s+r\s*=\s*1;\s*r\s*<=\s*MAXR/,
    '행 루프 상한이 MAXR 이 아니다 — 열 상한(MAX)으로 돌면 「살아있다는데 셀이 없는」 조합이 생긴다');
});
