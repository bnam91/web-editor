/* gradient-cascade-vocab — 「cascade(같은 자리 겹침 방지)」가 레포의 선례 어휘와 ★같은 수를
 * 쓰는가(발명 금지 게이트). 1017t1 G1(그라데이션 2번째가 1번째 «정확히 위»에 생기는 문제) 고침의 짝.
 *
 * ★무엇을 잠그나
 *   CV-0 전제 — 선례 둘(zoom-block.js · sticker-block.js)이 «실제로» `40 + (n % 8) * 24` 꼴을 쓴다.
 *     (없으면 여기서 멈춘다 — 선례 자체가 바뀌었는데 베낀 쪽만 남으면 ★비교 기준이 사라진다)
 *   CV-1 양성 — gradient-block.js 도 ★같은 식(40 + (n % 8) * 24)을 쓴다(⛔다른 수를 지어내지 않는다)
 *   CV-2 음성대조 — 식을 `* 32` 로 바꾼 변형본에서 CV-1 이 실제로 빨강
 *   CV-3 G7 비석 — 「1 - s.offset」 반전이 ★코드로 0건 ＋ 비석 문구 3요소(「왜 뒤집혀 있었나」·
 *     날짜·「기존 저장본」)가 있다. 음성대조 — 비석을 지운 변형본에서 빨강.
 *
 * ⛔앱 0 · 네트워크 0 — 소스 문자열만 잰다(선례 tests/unit/block-add-noselection-hint.test.mjs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');

const ZOOM = readSrc(REPO, 'js/blocks/zoom-block.js');
const STICKER = readSrc(REPO, 'js/blocks/sticker-block.js');
const GRADIENT = readSrc(REPO, 'js/blocks/gradient-block.js');

const CASCADE_RE = /40 \+ \(n % 8\) \* 24/;

test('CV-0 전제 — 선례 둘(zoom-block.js · sticker-block.js)이 실제로 그 식을 쓴다', () => {
  assert.ok(CASCADE_RE.test(ZOOM), 'zoom-block.js 에서 cascade 식(40 + (n % 8) * 24)을 못 찾았다 — 선례가 바뀌었다');
  assert.ok(CASCADE_RE.test(STICKER), 'sticker-block.js 에서 cascade 식을 못 찾았다 — 선례가 바뀌었다');
});

test('CV-1 양성 — gradient-block.js 가 같은 식을 쓴다(다른 수를 지어내지 않는다)', () => {
  assert.ok(CASCADE_RE.test(GRADIENT), 'gradient-block.js 의 addGradientBlock 이 cascade 식(40 + (n % 8) * 24)을 안 쓴다');
  // ★★.gradient-block 길이로 n 을 센다는 것도 같이 — 선례의 「형제 개수」어휘
  assert.ok(/sec\.querySelectorAll\('\.gradient-block'\)\.length/.test(GRADIENT), 'n 을 .gradient-block 형제 개수로 세지 않는다 — 선례와 다른 집계');
});

test('CV-2 음성대조 — 식을 * 32 로 바꾼 변형본에서 CV-1 이 실제로 빨강', () => {
  const needle = '40 + (n % 8) * 24, cy = 40 + (n % 8) * 24;';
  assert.ok(GRADIENT.includes(needle), 'CV-2 변환이 늙었다 — cascade 대입식을 못 찾았다');
  const mutated = GRADIENT.replace(needle, '40 + (n % 8) * 32, cy = 40 + (n % 8) * 32;');
  assert.equal(CASCADE_RE.test(mutated), false, '변형본(×32)에서도 ×24 패턴이 매치되면 음성대조가 안 산 것');
});

test('CV-3 G7 비석 — 「1 - s.offset」반전이 코드로 0건 + 비석 문구 3요소', () => {
  assert.equal(/1\s*-\s*s\.offset/.test(GRADIENT), false, 'radial 반전(1 - s.offset)이 코드에 남아 있다 — G7 되돌림 사고');
  assert.ok(GRADIENT.includes('왜 뒤집혀 있었나'), 'G7 비석에 「왜 뒤집혀 있었나」가 없다');
  assert.ok(GRADIENT.includes('2026-10-17'), 'G7 비석에 고친 날짜가 없다');
  assert.ok(GRADIENT.includes('기존 저장본'), 'G7 비석에 「기존 저장본」 경고가 없다');
});

test('CV-3-n 음성대조 — 비석을 지운 변형본에서 CV-3 이 빨강', () => {
  const tombstoneNeedle = GRADIENT.slice(GRADIENT.indexOf('/* ★1017t1 G7'), GRADIENT.indexOf('*/', GRADIENT.indexOf('/* ★1017t1 G7')) + 2);
  assert.ok(tombstoneNeedle.includes('왜 뒤집혀 있었나'), 'CV-3-n 변환이 늙었다 — G7 비석 블록을 못 찾았다');
  const mutated = GRADIENT.replace(tombstoneNeedle, '/* 비석 지움(음성대조) */');
  assert.equal(mutated.includes('왜 뒤집혀 있었나'), false, '비석을 지운 변형본에서도 문구가 남아 있으면 음성대조가 안 산 것');
});
