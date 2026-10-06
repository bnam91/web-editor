/* fx-seeded-random — 공용 씨앗 난수(js/fx/seeded-random.js FxSeed.mulberry32)가 «지디 파티클 시안»과 같은 수열을 내는가.
 *
 * ★왜 있나 (2026-10-06): 이펙트 소비자 둘(글로우 · 파티클)과 시안이 «같은 seed = 같은 그림»이려면 PRNG 가 한 알고리즘이어야 한다.
 *   대조해 보니 seed 0 만 갈렸다(옛 판이 0 을 바꿔치기). 기대값은 «시안의 함수»(goditor-effects-particles.html:395 mulberry32)로
 *   뽑아 «글자로» 박았다 — 피검 구현에서 뽑으면 항등식이라 아무것도 안 잠근다.
 * ⛔앱 0 · 네트워크 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

function load() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/seeded-random.js'), ctx);
  assert.equal(typeof ctx.FxSeed?.mulberry32, 'function', '★전제: FxSeed 를 실제로 실었다');
  return ctx.FxSeed;
}

// 시안 함수로 뽑은 첫 셋(2026-10-06 node 로 계산)
const VECTORS = {
  0:          [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197],
  1:          [0.6270739405881613, 0.002735721180215478, 0.5274470399599522],
  12345:      [0.9797282677609473, 0.3067522644996643, 0.484205421525985],
  4294967295: [0.8964226141106337, 0.189478256739676, 0.7156526781618595],
};

for (const [seed, want] of Object.entries(VECTORS)) {
  test(`R${seed} — seed ${seed} 의 첫 세 값이 시안과 같다`, () => {
    const r = load().mulberry32(Number(seed));
    assert.deepEqual([r(), r(), r()], want);
  });
}

test('R-new — newSeed 는 0 이 아닌 32비트 정수(만들 때만 부른다)', () => {
  const S = load();
  for (let i = 0; i < 50; i++) { const s = S.newSeed(); assert.ok(Number.isInteger(s) && s > 0 && s <= 0xFFFFFFFF, String(s)); }
});
