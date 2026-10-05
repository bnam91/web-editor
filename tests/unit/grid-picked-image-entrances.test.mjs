/* grid-picked-image-entrances.test.mjs — E91: 그리드 «파일창 입구»의 그림 값은 grdPickedImageSrc 한 벌에서만 읽는다 (2026-10-06 lane-esweep)
 * 까닭: 입구마다 readAsDataURL 을 따로 두면 그 입구만 data URL 통째(≈700KB PNG → 직렬화 +2,468,328자 · 실측 10-05)로 돌아온다.
 * 자 = 세 파일 안 readAsDataURL 글자 수(주석 뺌 · 이 꼴만 — 「전수」라 주장하지 않는다).
 * ★알려진 틈(이름으로): block-drag.js 빈 슬롯 더블클릭 입구(grdImageFileOk 바로 뒤 readAsDataURL) — lane-drag 몫(태양이 넘김 · window.grdPickedImageSrc 한 줄).
 *   그 레인이 고치면 0 이 된다 — 그때 KNOWN_GAP_BLOCK_DRAG 를 0 으로(≤ 라 고쳐도 초록 · 0 으로 바꿔 «되돌아옴»을 잡게).
 * 곁(범위 밖 · 이름만): block-drag.js Icon Text 아이콘 이미지 입구도 readAsDataURL(그리드 아님 — 이 자가 세지 않는다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sliceBlock } from './_slice-block.js';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const KNOWN_GAP_BLOCK_DRAG = 1;

test('E91 ★prop-grid.js 의 readAsDataURL 은 grdPickedImageSrc 안 «하나»뿐', () => {
  const src = read('js/props/prop-grid.js');
  const body = sliceBlock(src, 'export async function grdPickedImageSrc(file) {', '공용 함수');   // ⛔꼬리 문자열로 끝을 찾지 않는다(slice-block-shared SB-16)
  const inBody = (body.match(/readAsDataURL\(/g) || []).length;
  const total = (src.match(/readAsDataURL\(/g) || []).length;
  assert.equal(inBody, 1, '[전제] 공용 함수 안에 하나');
  assert.equal(total - inBody, 0, `공용 함수 밖 readAsDataURL ${total - inBody}곳 — 입구는 grdPickedImageSrc 를 불러라`);
});
test('E91 ★block-factory.js(오른클릭 교체)는 readAsDataURL 0 — grdPickedImageSrc 를 부른다', () => {
  const src = read('js/block-factory.js');
  assert.equal((src.match(/readAsDataURL\(/g) || []).length, 0);
  assert.ok(/window\.grdPickedImageSrc\(file\)/.test(src), '[전제] 오른클릭 교체가 공용 함수를 부른다');
});
test('E91 알려진 틈 — block-drag.js 빈 슬롯 더블클릭(grdImageFileOk 뒤 readAsDataURL) ≤ 1 (lane-drag 몫)', () => {
  const src = read('js/block-drag.js');
  const gated = [...src.matchAll(/grdImageFileOk\?\.\(file\)\)[\s\S]{0,400}?readAsDataURL\(/g)].length;
  assert.ok(gated <= KNOWN_GAP_BLOCK_DRAG, `그리드 입구 data URL ${gated}곳 — 알려진 틈은 ${KNOWN_GAP_BLOCK_DRAG}(빈 슬롯 더블클릭)뿐`);
});
