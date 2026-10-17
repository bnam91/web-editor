/* gradient-resolve-stops-nan — G6(261018). _resolveStops 자체의 `|| 0` 이 NaN 과 참 0 을 못 가려,
 * MCP/임포트로 들어온 쓰레기 stop(offset·alpha 가 숫자가 아님)이 「완전 투명」으로 떨어지는 자리
 * (js/props/prop-gradient.js:132~135 가 「별도 카드」로 미뤄 둔 자리 — 입력단 _clamp01 은 이 경로를
 * 안 거친다, 여긴 block.dataset.gradStops 를 직접 심는 MCP/임포트 경로다).
 *
 * ★무엇을 잠그나
 *   NS-1 양성 — {offset:'abc', alpha:'xyz', color:'#ff0000'} 같은 쓰레기 stop 이 섞여도
 *     alpha 가 0(완전 투명)으로 떨어지지 않는다(기본값 GRADIENT_DEFAULTS.startAlpha = 1 로 간다).
 *   NS-2 음성대조 — `Number.isFinite` 가드를 지우고 옛 `|| 0` 판으로 되돌리면 NS-1 이 실제로 빨강
 *     (소스 패치 후 동적 import 로 ★실행해 재현 — 소스 문자열 추측이 아니라 실제로 돈 값).
 *   NS-3 전제 — 멀쩟한 숫자 stop 은 그대로 보존(회귀 없음).
 *
 * gradient-block.js 는 ESM 이지만 import 가 0개이고 top-level 에서 window.* 에 자기 함수를 심는다
 * (브라우저 전역 노출 패턴) — 테스트에서 돌리려면 돌 window 를 global 에 심어야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const SRC_PATH = path.join(REPO, 'js', 'blocks', 'gradient-block.js');

async function loadResolveStops(sourceOverride) {
  const src = sourceOverride ?? fs.readFileSync(SRC_PATH, 'utf8');
  const tmp = path.join(os.tmpdir(), `grad-block-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, src);
  global.window = global.window && global.window.__isTestStub ? global.window : (global.window = {}, global.window.__isTestStub = true, global.window);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    return { _resolveStops: mod._resolveStops, GRADIENT_DEFAULTS: mod.GRADIENT_DEFAULTS };
  } finally {
    fs.unlinkSync(tmp);
  }
}

const fakeBlock = (gradStops) => ({ dataset: { gradStops: JSON.stringify(gradStops) } });

test('NS-1 양성 — 쓰레기 alpha/offset(NaN)이 섞인 stop 이 완전 투명(0)으로 안 떨어진다', async () => {
  const { _resolveStops, GRADIENT_DEFAULTS } = await loadResolveStops();
  const block = fakeBlock([
    { color: '#ff0000', alpha: 1, offset: 0 },
    { color: '#00ff00', alpha: 'xyz', offset: 'abc' }, // 쓰레기 — MCP/임포트로 들어온 값 흉내
  ]);
  const stops = _resolveStops(block);
  const junk = stops.find(s => s.color === '#00ff00');
  assert.ok(junk, '전제: 쓰레기 stop 이 결과에 있다');
  assert.notStrictEqual(junk.alpha, 0, 'alpha 가 0(완전 투명)으로 떨어지면 안 된다 — NaN 방어가 빠졌다');
  assert.strictEqual(junk.alpha, GRADIENT_DEFAULTS.startAlpha, 'alpha 기본값은 GRADIENT_DEFAULTS.startAlpha 다(지어낸 수 아님)');
  assert.strictEqual(junk.offset, 0, 'offset 기본값은 0 이다');
});

test('NS-2 음성대조 — Number.isFinite 가드를 지우고 옛 `|| 0` 판으로 되돌리면 NS-1 이 빨강이다', async () => {
  const origSrc = fs.readFileSync(SRC_PATH, 'utf8');
  const guardRe = /alpha: Number\.isFinite\(pa\) \? Math\.max\(0, Math\.min\(1, pa\)\) : GRADIENT_DEFAULTS\.startAlpha,\n\s*offset: Number\.isFinite\(po\) \? Math\.max\(0, Math\.min\(1, po\)\) : 0,/;
  assert.ok(guardRe.test(origSrc), '전제: 지금 소스가 Number.isFinite 가드 꼴이다(음성대조 기준판이 바뀌면 여기부터 고쳐라)');
  const revertedBody = "alpha: Math.max(0, Math.min(1, pa)) || 0,\n              offset: Math.max(0, Math.min(1, po)) || 0,";
  const revertedSrc = origSrc.replace(guardRe, revertedBody);
  assert.notStrictEqual(revertedSrc, origSrc, '전제: 치환이 실제로 소스를 바꿨다');

  const { _resolveStops } = await loadResolveStops(revertedSrc);
  const block = fakeBlock([
    { color: '#ff0000', alpha: 1, offset: 0 },
    { color: '#00ff00', alpha: 'xyz', offset: 'abc' },
  ]);
  const stops = _resolveStops(block);
  const junk = stops.find(s => s.color === '#00ff00');
  assert.strictEqual(junk.alpha, 0, '음성대조: 옛 `|| 0` 판에서는 쓰레기 alpha 가 실제로 0(완전 투명)으로 떨어져야 한다');
});

test('NS-3 전제 — 멀쩡한 숫자 stop 은 값이 그대로 보존된다(회귀 없음)', async () => {
  const { _resolveStops } = await loadResolveStops();
  const block = fakeBlock([
    { color: '#111111', alpha: 0.3, offset: 0 },
    { color: '#222222', alpha: 0.9, offset: 1 },
  ]);
  const stops = _resolveStops(block);
  assert.strictEqual(stops.find(s => s.color === '#111111').alpha, 0.3);
  assert.strictEqual(stops.find(s => s.color === '#222222').alpha, 0.9);
});
