/* U-SCRATCHWIDTHPLAN — 스크래치 표시폭이 «실제로 박을 폭»으로 어떻게 번역되는가.
 *   (현빈 신고 2026-09-20: 「스크래치패드에서 섹션에 들어갈때, 스크래치패드와 다른 크기로
 *    들어가는 이슈」 — 0920b-scratch-modal / T-075)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★이 파일이 있는 이유 (2026-09-20 픽스라운드, 이벨류에이터 지적 ⑤)
 *   옆 파일(scratch-drop-size.test.js)은 «소스 문자열»을 정규식으로 잰다 — 호출 배선이
 *   DOM 없이는 안 보이기 때문이다. 그런데 그것만 있으면 「같은 동작을 다르게 쓰면 빨강,
 *   문자열만 남기고 동작을 깨면 초록」이 된다.
 *   ⇒ 폭 «계산»은 canvas-scratch-drop.js 에서 순수함수(planScratchWidth)로 빼 뒀다.
 *     여기서는 그 함수를 «진짜로 불러» 숫자를 잰다. 소스 대조가 아니다.
 *
 * ★세 밴드 (full = 부모 콘텐츠폭, p = 그 블록이 든 상자의 좌우 패딩 한쪽)
 *   ⑴ want ≤ full          → 그 폭 그대로 (음수마진 0)
 *   ⑵ full < want ≤ full+2p → 그 폭 그대로 + 넘치는 만큼 좌우 대칭 음수마진
 *   ⑶ want > full+2p        → 섹션 전체폭까지만
 *
 * ★음성대조 (이 라운드 «전» 판): ⑵⑶ 이 통째로 「아무 것도 안 함(null)」이었다 ⇒
 *   새 프로젝트 기본(padX 72, 콘텐츠폭 716)에서 앱 자신의 일괄배치 폭 860 이 716 으로
 *   17% 축소돼 들어갔다 — 신고 증상이 가장 흔한 경로에 살아 있었다. 그 판을 되돌리면
 *   아래 P-3·P-4·P-5 가 빨강이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/* package.json 이 "type":"commonjs" 라 .js 를 직접 import 하면 CJS 로 잡힌다
   → 원문을 임시 .mjs 로 복사해 로드한다(선례: gradient-canvas-bar-geometry.test.mjs).
   ⚠️이 모듈은 «꼬리»에서만 window 를 만진다(window.commitScratchDropAt = …) — 빈 객체로 충분하다.
     document 는 함수 «안»에서만 쓴다 ⇒ import 시점엔 안 닿는다. */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'canvas-scratch-drop.js'), 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'csd-'));
const MOD = path.join(TMP, 'canvas-scratch-drop.mjs');
fs.writeFileSync(MOD, SRC);
globalThis.window = globalThis.window || {};
const { planScratchWidth } = await import(pathToFileURL(MOD).href);
fs.rmSync(TMP, { recursive: true, force: true });

/* 현빈 실앱 기본값 — 새 프로젝트 pageSettings.padX = 72, 섹션 폭 860 ⇒ row 콘텐츠폭 716 */
const FULL = 716, PAD = 72, WHOLE = FULL + PAD * 2;   // 860

test('P-0 순수함수가 export 돼 있다 (여기가 비면 이 파일 전체가 뜻이 없다)', () => {
  assert.equal(typeof planScratchWidth, 'function',
    'planScratchWidth 가 export 안 됐다 — 폭 계산이 다시 DOM 안에 묻혔으면 이 검사부터 고쳐라');
});

test('P-1 ⑴밴드 — 콘텐츠폭 안이면 «보이던 폭» 그대로, 음수마진 없음', () => {
  assert.deepEqual(planScratchWidth(220, FULL, PAD), { width: 220, over: 0 });
  assert.deepEqual(planScratchWidth(FULL, FULL, PAD), { width: FULL, over: 0 });
  // 신고 원문의 그 크기 — 220 이 796/716 으로 부풀던 게 이 결함이었다
});

test('P-2 소수점은 반올림한다 — px 는 정수로 박힌다', () => {
  assert.equal(planScratchWidth(220.4, FULL, PAD).width, 220);
  assert.equal(planScratchWidth(220.6, FULL, PAD).width, 221);
});

test('P-3 ★⑵밴드 — 콘텐츠폭을 넘으면 넘치는 만큼 좌우 «대칭»으로 먹는다', () => {
  // 음성대조: 이 라운드 전 판은 여기서 null(아무 것도 안 함) ⇒ 716 으로 축소됐다
  const p = planScratchWidth(760, FULL, PAD);
  assert.equal(p.width, 760, '표시폭을 안 맞췄다');
  assert.equal(p.over, 22, '(760−716)/2 = 22 만큼 한쪽씩 먹어야 한다');
});

test('P-4 ★앱 자신의 일괄배치 폭(860)이 그대로 들어간다 = 풀블리드와 같은 수', () => {
  // scratch-pad.js SCRATCH_PLACE.WIDTH = 860 로 들어온 그림이 이 길로 온다
  const p = planScratchWidth(WHOLE, FULL, PAD);
  assert.equal(p.width, 860);
  assert.equal(p.over, PAD, 'padX 를 통째로 먹으면 곧 풀블리드다(=applyAssetFullBleed 와 같은 수)');
});

test('P-5 ★⑶밴드 — 섹션 전체폭보다 크면 거기까지만 (밖으로 안 삐져나간다)', () => {
  const p = planScratchWidth(2000, FULL, PAD);
  assert.equal(p.width, 860, '섹션 밖으로 나가는 폭은 보이지도 않고 잘리기만 한다');
  assert.equal(p.over, PAD);
});

test('P-6 ★음성대조 — 폭을 정할 근거가 없으면 «아무 것도 안 한다»(옵트인)', () => {
  // 자산패널 드롭은 width 를 안 넘긴다 ⇒ 종전 풀폭 동작이 그대로여야 한다
  for (const bad of [undefined, null, 0, -10, NaN, 'abc', Infinity]) {
    assert.equal(planScratchWidth(bad, FULL, PAD), null, `want=${String(bad)} 인데 폭을 정했다`);
  }
  // 부모를 아직 못 재는 순간(레이아웃 전)에도 손대지 않는다
  assert.equal(planScratchWidth(220, 0, PAD), null);
  assert.equal(planScratchWidth(220, NaN, PAD), null);
});

test('P-7 padX 가 0 이면 ⑵⑶ 밴드가 «없다» — 콘텐츠폭이 곧 한계', () => {
  const p = planScratchWidth(800, FULL, 0);
  assert.equal(p.width, FULL, '먹을 여백이 없는데 넘겼다 — 섹션 밖으로 잘린다');
  assert.equal(p.over, 0);
  assert.equal(planScratchWidth(800, FULL, undefined).width, FULL, 'padX 미지정도 0 과 같아야 한다');
});
