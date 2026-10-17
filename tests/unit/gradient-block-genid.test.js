/* gradient-block-genid — G10(261018). 다른 블럭(annotation/banner02/chat/comparison/coupon/canvas/
 * innercard/iconify/modal/grid …)은 block.id 를 genId(prefix) 로 만든다 — genId 안에 actorId 조각이
 * 들어가 협업에서 «누가 만들었는지» 출처가 산다(js/drag-utils.js:76 genId). gradient-block.js 만
 * `Math.random().toString(36)` 을 직접 불러 actorId 가 안 들어갔다(annotation-block.js:9-13 이
 * 적어 둔 같은 병의 또 다른 자리). G10 은 makeGradientBlock 의 block.id 를 genId('grad') 로 바꾼다.
 *
 * ⛔앱 0 · 네트워크 0 — 소스 문자열만 잰다(선례 gradient-cascade-vocab.test.mjs 와 같은 방식).
 *
 * GID-1 양성 — gradient-block.js 가 block.id 를 genId('grad') 로 만든다.
 * GID-2 음성대조 — `Math.random().toString(36)` 으로 되돌린 변형본에서 GID-1 이 실제로 빨강.
 * GID-3 접두 레지스트리 — grad_ 가 js/canvas-state.js PFX 명부에 이미 있다(접두를 바꾸지 않았다는 증거).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readSrc } = require('./_srcread.js');

const REPO = path.join(__dirname, '..', '..');
const GRADIENT = readSrc(REPO, 'js', 'blocks', 'gradient-block.js');
const CANVAS_STATE = readSrc(REPO, 'js', 'canvas-state.js');

const GENID_RE = /block\.id\s*=\s*genId\(\s*['"]grad['"]\s*\)/;
const RAW_RANDOM_RE = /block\.id\s*=\s*['"]grad_['"]\s*\+\s*Math\.random\(\)/;

test('GID-1 양성 — makeGradientBlock 의 block.id 가 genId(\'grad\') 다', () => {
  assert.ok(GENID_RE.test(GRADIENT), "gradient-block.js 에서 block.id = genId('grad') 패턴을 못 찾았다");
  assert.ok(!RAW_RANDOM_RE.test(GRADIENT), "gradient-block.js 가 여전히 block.id = 'grad_' + Math.random() 직접호출을 쓴다");
});

test('GID-2 음성대조 — Math.random 직접호출 변형본에서는 GID-1 양성 판정이 빨강이다', () => {
  const reverted = GRADIENT.replace(GENID_RE, "block.id = 'grad_' + Math.random().toString(36).slice(2, 8)");
  assert.notStrictEqual(reverted, GRADIENT, '전제: 치환이 실제로 소스를 바꿨다(정규식이 안 맞으면 no-op 이 되어 대조가 죽는다)');
  assert.ok(!GENID_RE.test(reverted), 'Math.random 되돌린 판에서는 genId 패턴이 없어야 한다(대조가 선다)');
});

test('GID-3 접두 레지스트리 — grad_ 가 js/canvas-state.js PFX 명부에 있다(접두를 안 바꿨다)', () => {
  assert.ok(/grad_:\s*['"]gradient['"]/.test(CANVAS_STATE), 'canvas-state.js PFX 명부에서 grad_: \'gradient\' 를 못 찾았다');
});
