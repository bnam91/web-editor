/* save-no-target-340 — 저장 대상이 없으면 «실패»로 돌려준다 (시트 340 C · race-004 의 샌 한 길)
 * 왜: bare return(undefined)은 _isSaveFailure 가 못 잡아 저장을 안 했는데 미저장 표시가 꺼졌다.
 * 칸: 대상 없음 = 실패 · [음성] skipped 는 실패 아님 · 그 함수에 bare return 0.
 * 변이: 그 줄을 bare return 으로 되돌리면 빨강. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const vm = require('vm');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');

const SL = readSrc(path.join(__dirname, '..', '..'), 'js/io/save-load.js');
const body = sliceBlock(SL, 'async function _doSaveProjectToFile(', '못 찾았다');
const isFail = vm.runInNewContext(`(${sliceBlock(SL, 'function _isSaveFailure(', '못 찾았다')})`);

test('대상이 없으면 no_target 실패', async () => {
  const fn = vm.runInNewContext(`(${body})`, { activeProjectId: null });
  const r = await fn('{}', {});
  assert.strictEqual(r && r.reason, 'no_target');
  assert.strictEqual(isFail(r), true, '★미저장 표시가 꺼진다');
});
test('[음성] 보호성 skip 은 실패가 아니다', () => {
  assert.strictEqual(isFail({ ok: false, skipped: true }), false);
});
test('그 함수에 bare return 이 없다', () => {
  assert.strictEqual((body.match(/\breturn;/g) || []).length, 0);
});
