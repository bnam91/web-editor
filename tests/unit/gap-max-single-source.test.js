/* gap-max-single-source.test.js — 갭블럭 «높이 상한»이 한 곳에서만 산다. (2026-09-09 신설)
 *
 * ⚠️왜: 상한 400 이 «여섯 군데»에 흩어져 있었다 —
 *   패널 슬라이더 max · 숫자칸 max · 커밋 clamp · 키보드 넉지 · 화살표 · MCP 검증.
 *   하나만 올리면 나머지가 조용히 자른다(슬라이더는 1000까지 가는데 숫자칸이 400에서 멈춘다).
 *   ★그리고 그 실패는 «경보가 없다» — 사용자는 「원래 그런가 보다」로 읽는다.
 *
 * ⛔이 검사가 지키지 «않는» 것: 글자 크기 상한 400(editor.js, 텍스트블록)과
 *   프레임의 CSS gap 0~400(block-factory updateFrameBlock). 그건 «다른 값»이다.
 *   여기서 그것까지 잡으면 남의 값을 이 파일이 볼모로 잡는다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { makeStripper } = require('./_strip-comments.js');

function readSrc(rel) {
  const strip = makeStripper();
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').map(strip).join('\n');
}

/** gap-limits.js 의 GAP_MAX 를 «소스에서» 읽는다(ESM 이라 require 가 안 된다). */
function declaredMax() {
  const m = readSrc('js/blocks/gap-limits.js').match(/export const GAP_MAX\s*=\s*(\d+)/);
  assert.ok(m, 'gap-limits.js 에 GAP_MAX 선언이 없다 — 단일 진실원이 사라졌다');
  return Number(m[1]);
}

test('G-1 ★GAP_MAX 는 gap-limits.js 한 곳에서 «선언»된다', () => {
  const max = declaredMax();
  assert.ok(Number.isInteger(max) && max > 0, `GAP_MAX 가 정수가 아니다: ${max}`);
  assert.equal(max, 1000, '현빈 2026-09-09 발주: 갭블럭 높이 상한 1000');
});

test('G-2 ★갭블럭 «높이»를 다루는 자리에 400 이 «직접» 박혀 있지 않다', () => {
  const sites = [
    ['js/props/prop-gap.js', /400/g],
    // editor.js·block-factory.js 는 «갭 아닌» 400 이 있으므로 줄 단위로 좁힌다
  ];
  const bad = [];
  for (const [rel, re] of sites) {
    const src = readSrc(rel);
    const hits = src.match(re) || [];
    if (hits.length) bad.push(`${rel}: 400 이 ${hits.length}건 남아 있다`);
  }
  /* ★양성대조 — 이 방법이 «1 이상»을 낼 수 있나. prop-gap.js 에 400 을 넣은 판을 만들어 세어 본다.
     안 그러면 「0건」이 «파일을 못 읽어서» 난 0 인지 알 수 없다. */
  const probe = readSrc('js/props/prop-gap.js') + '\nconst __probe = 400;\n';
  assert.equal((probe.match(/400/g) || []).length, 1,
    '양성대조 실패 — 이 계수기가 400 을 «못 센다». 아래 「0건」은 측정이 아니다');

  assert.deepEqual(bad, [], `★갭 패널에 상한이 직접 박혀 있다:\n  ${bad.join('\n  ')}`);
});

test('G-3 ★★폴백 리터럴이 GAP_MAX 와 «안 갈라진다» (따로 갱신되면 썩는 자리)', () => {
  const max = declaredMax();
  /* editor.js·block-factory.js 는 ESM import 를 못 쓰는 자리라 `window.GAP_MAX ?? N` 을 쓴다.
     ⇒ N 이 «두 번째 진실원»이 된다. GAP_MAX 만 올리면 폴백은 옛 값으로 남는다 —
       배포마커(DEPLOY_SHA)가 따로 갱신돼 썩던 것과 «같은 모양»이다. 그래서 대조한다. */
  const found = [];
  for (const rel of ['js/editor.js', 'js/block-factory.js']) {
    const src = readSrc(rel);
    for (const m of src.matchAll(/window\.GAP_MAX\s*\?\?\s*(\d+)/g)) found.push({ rel, n: Number(m[1]) });
  }
  assert.ok(found.length >= 3,
    `★폴백을 못 찾았다(${found.length}건) — 배선이 사라졌거나 이 검사가 «훑을 게 없다». 어느 쪽이든 빨강이다`);
  const mismatched = found.filter((f) => f.n !== max).map((f) => `${f.rel}: 폴백 ${f.n} ≠ GAP_MAX ${max}`);
  assert.deepEqual(mismatched, [],
    `★상한이 «두 군데»서 갈렸다:\n  ${mismatched.join('\n  ')}\n  → gap-limits.js 를 고쳤으면 폴백도 같이 고쳐라`);
});

test('G-4 ★손대면 안 되는 400 은 «그대로»다 (남의 값을 볼모로 잡지 않는다)', () => {
  const ed = readSrc('js/editor.js');
  assert.ok(/Math\.min\(400,\s*Math\.max\(4,/.test(ed),
    '텍스트블록 «글자 크기» 상한 400 이 사라졌다 — 갭 작업이 남의 값을 건드렸다');
  const bf = readSrc('js/block-factory.js');
  assert.ok(/_setNum\('gap',\s*partial\.gap,\s*0,\s*400\)/.test(bf),
    '프레임의 CSS gap 상한 0~400 이 사라졌다 — 갭블럭 «높이»와 다른 값이다');
});
