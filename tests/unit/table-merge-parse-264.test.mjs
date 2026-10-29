/* table-merge-parse-264.test.mjs — 264 TABLE-HEADER-MERGE-GARBAGE-INPUT-SILENTLY-CLEARS (지디 12:2x 처방 · S7 · 261029)
 *
 * ★병(참 자리 · 지디 ①): js/props/prop-table.js 의 _parseMergesStr 가 꼴 틀린 토큰(abc)을 말없이 버려 [] 를 만들고,
 *   _applyMergeInput 이 그 [] 를 updateTableBlock 에 넘긴다 → js/block-factory.js «[] = explicit clear» → 있던 머리 병합이 지워진다.
 *   ⇒ abc 가 «지우기»로 둔갑한다(앱 ×3 · S7 261029 08:1x · L2 실측).
 * ★처방(지디 ③): «꼴 틀린 토큰»과 «빈 입력»을 가른다.
 *   · 파싱 실패(abc) ⇒ 적용 안 함 — updateTableBlock 을 안 부르고 console.warn + 패널 재렌더(원복) = 범위 밖 0:99 의 실패 길과 같은 꼴.
 *     ⚠️토스트는 «0» — 지금 실패 길(범위 밖)도 토스트가 없다(콘솔·원복뿐) ⇒ 토스트를 새로 넣는 것은 «새 행위»라 안 넣었다(지디 판정 거리).
 *   · 빈 값 / 지우기 단추 ⇒ 지금처럼 [] = explicit clear(설계 · ⛔죽이지 않는다).
 *   · ⑷ «0:2,abc»(부분 실패) ⇒ ★전부 거절(맞는 토큰만 살리면 «말없이 바꾼다» 꼴이 남는다 · 태양 권고 · 이 판정을 여기에 박는다).
 * 자: 제품 소스에서 두 덩이를 ★이름 닻으로 떠(readSrc · sliceBlock — 매개변수 든 서명 닻 0 · anchor-signature-ratchet)
 *   가짜 window.updateTableBlock · showTableProperties · console.warn 위에서 돌린다(앱 0).
 * 한 쌍: 고치기 전(refs/gd-pin/266 = 20e734fc) T1·T4 빨강 · 고친 뒤 초록 · T2·T3·T5 는 앞뒤 다 초록(지킴). */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readSrc } from './_srcread.js';
const { sliceBlock } = createRequire(import.meta.url)('./_slice-block.js');

const ROOT = process.env.GD1001_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readSrc(ROOT, 'js/props/prop-table.js');
const PARSE = sliceBlock(SRC, 'const _parseMergesStr');
const APPLY = sliceBlock(SRC, 'const _applyMergeInput');

/** 두 덩이를 가짜 위에서 묶어 «입력 한 번»을 돌리고, updateTableBlock 이 무엇을 받았나를 돌려준다 */
function runInput(raw) {
  const calls = [], warns = [], rerenders = [];
  const win = { updateTableBlock: (id, patch) => { calls.push(patch); return { ok: true }; } };
  const con = { warn: (...a) => warns.push(a.join(' ')) };
  const body = `${PARSE}\n${APPLY}\n_applyMergeInput(raw);`;
  new Function('window', 'console', 'block', 'showTableProperties', 'raw', body)(win, con, { id: 'tbl_x' }, () => rerenders.push(1), raw);
  return { calls, warns, rerenders: rerenders.length };
}

test('T0 전제 — 두 덩이를 떴고 둘 다 함수 몸을 품는다', () => {
  assert.ok(PARSE && /=>\s*\{/.test(PARSE), `_parseMergesStr 를 못 떴다: ${String(PARSE).slice(0, 80)}`);
  assert.ok(APPLY && /updateTableBlock/.test(APPLY), `_applyMergeInput 를 못 떴다: ${String(APPLY).slice(0, 80)}`);
  const ok = runInput('0:2');
  assert.deepEqual(ok.calls, [{ mergedHeaderCols: [[0, 2]] }], '맞는 입력 0:2 가 그대로 안 넘어간다 — 자가 눈멀었다');
});

test('T1 [새 것] «abc»(꼴 틀림) ⇒ updateTableBlock 을 안 부른다(있던 병합을 안 지운다) · 콘솔 한 줄 · 패널 재렌더(원복)', () => {
  const r = runInput('abc');
  assert.deepEqual(r.calls, [], `꼴 틀린 입력이 적용으로 넘어갔다 = 지우기로 둔갑 ${JSON.stringify(r.calls)}`);
  assert.equal(r.warns.length, 1, `알림(콘솔) 한 줄이 없다 ${JSON.stringify(r.warns)}`);
  assert.equal(r.rerenders, 1, '패널 재렌더(입력 원복)가 없다');
});

test('T2 [지킴] 빈 값(지우기 단추와 같은 길) ⇒ [] = explicit clear 그대로', () => {
  assert.deepEqual(runInput('').calls, [{ mergedHeaderCols: [] }]);
  assert.deepEqual(runInput('   ').calls, [{ mergedHeaderCols: [] }], '공백만 = 빈 값');
});

test('T3 [지킴] «0:99»(꼴 맞고 범위 밖) ⇒ 그대로 넘긴다(범위 검증·ok:false 는 updateTableBlock 몫)', () => {
  assert.deepEqual(runInput('0:99').calls, [{ mergedHeaderCols: [[0, 99]] }]);
});

test('T4 [새 것 · ⑷ 판정 = 전부 거절] «0:2,abc» ⇒ 아무것도 안 넘긴다(맞는 토큰만 살리지 않는다)', () => {
  const r = runInput('0:2,abc');
  assert.deepEqual(r.calls, [], `부분 실패가 «맞는 것만» 적용됐다 ${JSON.stringify(r.calls)}`);
  assert.equal(r.warns.length, 1);
});

test('T5 [지킴] 여러 토큰 · 공백 · 빈 조각 «0:2, 3:2,» ⇒ [[0,2],[3,2]]', () => {
  assert.deepEqual(runInput('0:2, 3:2,').calls, [{ mergedHeaderCols: [[0, 2], [3, 2]] }]);
});
