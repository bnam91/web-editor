/* ★에셋 preset 성공판정 — «앱이 실제로 만드는 것»을 세는가.
   실측 근거(2026-09-07, 격리 9370): add_block{type:asset,preset:img2} 가 ok:false/NO_ADD 를
   돌려줬는데 캔버스에는 cvb_6vnmq_tt7ckwb 가 «실제로» 생겼다. 블록 4→6.
   원인: 앱은 img2/img3 을 canvas-block 으로 바꿔 만드는데(js/block-factory.js makePresetRow,
        2026-06-08 NewGrid 봉인) 판정은 `.asset-block` 만 세고 있었다.
   ⛔거짓음성이라 부르는 쪽이 재시도하면 «중복»이 쌓인다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const MAIN = readSrc(ROOT, 'main.js');
const FACTORY = readSrc(ROOT, 'js', 'block-factory.js');

const assetFn = () => {
  const i = MAIN.indexOf('async function _invokeRendererAddAssetBlock');
  assert.ok(i > 0, '_invokeRendererAddAssetBlock 이 없다');
  return MAIN.slice(i, MAIN.indexOf('\n}\n', i));
};

test('P0 ★양성대조 — 앱이 «정말» img2/img3 을 캔버스로 바꾸나(전제부터 확인)', () => {
  const i = FACTORY.indexOf('function makePresetRow');
  const body = FACTORY.slice(i, FACTORY.indexOf('\n}\n', i));
  assert.match(body, /type === 'img2' \|\| type === 'img3'/,
    '앱이 더는 그렇게 안 한다면 이 검사의 «이유»가 사라진 것이다 — 지우지 말고 다시 재라');
  assert.match(body, /makeCanvasBlock/, 'canvas-block 으로 바꾸는 코드가 없다');
});

test('P1 성공판정은 asset «과» canvas 를 같이 센다', () => {
  const body = assetFn();
  assert.match(body, /_ADDED_SEL = '\.asset-block, \.canvas-block'/,
    'preset 이 만드는 두 종류를 다 세야 한다');
  assert.doesNotMatch(body, /querySelectorAll\('\.asset-block'\)/,
    "`.asset-block` 만 세는 자리가 남아 있다 — 거기서 img2/img3 이 다시 거짓음성이 된다");
});

test('P2 바뀌어 만들어진 사실을 «숨기지 않는다»', () => {
  const body = assetFn();
  assert.match(body, /blockType:/, '무슨 블록이 됐는지 안 알려주면 부르는 쪽이 cvb_ 를 보고 놀란다');
});

test('P3 ★변이대조 — 셀렉터를 옛것으로 되돌리면 P1 이 빨개져야 한다', () => {
  const mutated = MAIN.replace(/_ADDED_SEL = '\.asset-block, \.canvas-block'/,
                               "_ADDED_SEL = '.asset-block'");
  const i = mutated.indexOf('async function _invokeRendererAddAssetBlock');
  const body = mutated.slice(i, mutated.indexOf('\n}\n', i));
  assert.doesNotMatch(body, /_ADDED_SEL = '\.asset-block, \.canvas-block'/,
    '변이가 안 먹었다 = P1 은 이 배선을 «안» 보고 있다');
});
