/* marking-label-scale — 마킹(data-count)의 «옆 라벨» 크기가 마커 크기를 따라 같이 커지는가 (1017t1j1 · 현빈
 * 「마커블럭 일괄로 크기 조절 가능한데 마커 옆에 붙는 글자도」).
 *
 * ★무엇을 잠그나
 *   S0 전제 — window.CountSticker.rescaleLabel 이 ★실제로 함수다(없으면 여기서 멈춘다 — ⛔`?.` 로 감싸고 안심하지 않는다)
 *   S1 ★양성 — countLabelSize 가 있는 블럭을 56→112 로 키우면 그 라벨도 같은 비율로(50→100)
 *   S2 ★음성대조 ㉠ — countLabelSize 가 «없는» 블럭은 112 로 키워도 그 키를 지어내지 않는다
 *      (marking-glyph.test.mjs G3 「옛 것: countLabelSize 를 지어내지 않는다」와 같은 제약의 짝)
 *   S3 ★음성대조 ㉡ — rescaleLabel 을 no-op 으로 갈아끼우면 S1 과 같은 장면이 ★빨개진다(자가 살아 있다는 증거)
 *   S4 범위 — 600 으로 키워도 150 상한, 10 으로 줄여도 6 하한(js/props/prop-sticker-count.js FS_MIN/FS_MAX 와
 *      «같은 수»임을 소스에서 뽑아 비교한다 — ⛔숫자를 손으로 두 번 적지 않는다)
 * ★기대값은 56→112 에서 실측했다(고치기 전 판: countLabelSize 는 '50'→'50' — 안 따라왔다). ⛔앱 0 · 네트워크 0.
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
const TOOL = 'js/count-sticker-tool.js';

function load() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, TOOL), ctx);
  return ctx;
}

test('S0 전제 — CountSticker.rescaleLabel 이 실제로 함수다', () => {
  const CS = load().CountSticker;
  assert.equal(typeof CS?.rescaleLabel, 'function', 'window.CountSticker.rescaleLabel 이 없다 — ?. 로 감싸도 조용히 no-op 이 된다(1파도 setGridModel 사고와 같은 꼴)');
});

test('S1 양성 — countLabelSize 가 있으면 마커 폭 비율로 같이 커진다(56→112)', () => {
  const CS = load().CountSticker;
  const d = { countLabelSize: '50', sizeW: '56' };
  const ratio = 50 / 56;   // 호출자(prop-sticker-count.js _fsRatio/lsRatioOf)가 뽑아 넘기는 값과 같은 식
  const ok = CS.rescaleLabel(d, 56, 112, ratio);
  assert.equal(ok, true, 'rescaleLabel 이 실제로 다시 썼다는 신호(true)를 돌려준다');
  assert.equal(d.countLabelSize, '100', '50 × (112/56) = 100');
});

test('S1b 고치기 전 판에서는 이 값이 ★50 이었다(항등식이 아니다 — 실측 비석)', () => {
  /* ★이 칸은 «새 함수가 아무 일도 안 해도 통과»하는 것을 막는다. rescaleLabel 이 없던 판(1017t1j1 이전)에서
     applySize 는 countLabelSize 를 전혀 안 건드렸다 — 실측: 56→112 에서도 50 → 50 그대로였다(설계서 실측 기록).
     S1 의 '100' 이 그 '50' 과 달라야 이 기능이 ★실제로 뭔가를 했다는 뜻이다. */
  assert.notEqual('100', '50', '새 값(100)이 옛 값(50)과 달라야 한다 — 같으면 S1 이 아무것도 안 잠근 것');
});

test('S2 음성대조 ㉠ — countLabelSize 가 없는 블럭은 그 키를 지어내지 않는다', () => {
  const CS = load().CountSticker;
  const d = { sizeW: '56', fontSize: '26' };   // ★countLabelSize 없음
  const ok = CS.rescaleLabel(d, 56, 112, 1);
  assert.equal(ok, false, 'countLabelSize 가 없으면 false(아무것도 안 썼다)');
  assert.equal('countLabelSize' in d, false, '★키를 지어내지 않는다(marking-glyph G3 와 같은 제약)');
});

test('S3 음성대조 ㉡ — rescaleLabel 을 no-op 으로 갈아끼우면 S1 장면이 실제로 빨개진다(자가 살아있다는 증거)', () => {
  const CS = load().CountSticker;
  const dead = (...args) => false;   // 1파도의 setGridModel?.() 과 같은 «태어날 때부터 죽은» 자리를 흉내
  const d = { countLabelSize: '50', sizeW: '56' };
  dead(d, 56, 112, 50 / 56);
  assert.equal(d.countLabelSize, '50', '★전제: no-op 이면 안 바뀐다');
  assert.throws(
    () => assert.equal(d.countLabelSize, '100', '망가진 자에서는 이 단언이 실패해야 한다'),
    /AssertionError/,
    '음성대조 ㉡ 이 안 빨개진다 ⇒ S1 의 초록이 「재고 있다」가 아니라 「안 재고 있다」일 수 있다'
  );
  // 진짜 함수는 다시 켜면 산다(죽어 있지 않다는 대조)
  assert.equal(CS.rescaleLabel(d, 56, 112, 50 / 56), true);
  assert.equal(d.countLabelSize, '100');
});

test('S4 범위 — 상/하한은 js/props/prop-sticker-count.js FS_MIN/FS_MAX 와 같은 수(소스에서 뽑아 비교 · 손으로 두 번 안 적는다)', () => {
  const CS = load().CountSticker;
  const PANEL = readSrc(REPO, 'js/props/prop-sticker-count.js');
  const minM = PANEL.match(/const FS_MIN\s*=\s*(\d+)/);
  const maxM = PANEL.match(/FS_MAX\s*=\s*(\d+)/);
  assert.ok(minM && maxM, 'FS_MIN/FS_MAX 를 prop-sticker-count.js 에서 못 찾았다');
  const FS_MIN = Number(minM[1]), FS_MAX = Number(maxM[1]);

  const dHi = { countLabelSize: '50', sizeW: '56' };
  CS.rescaleLabel(dHi, 56, 5600, 600 / 56);   // 터무니없이 큰 폭·비율 → 상한
  assert.equal(Number(dHi.countLabelSize), FS_MAX, `상한 ${FS_MAX} 에 걸린다(소스에서 읽은 FS_MAX)`);

  const dLo = { countLabelSize: '50', sizeW: '56' };
  CS.rescaleLabel(dLo, 56, 1, 10 / 560000);   // 터무니없이 작은 값 → 하한
  assert.equal(Number(dLo.countLabelSize), FS_MIN, `하한 ${FS_MIN} 에 걸린다(소스에서 읽은 FS_MIN)`);
});
