/* ft-reset-push-order-270.test.mjs — 270(지디 261029 14:59 처방 꼴 ㈏): 효과 켤 때 이력 칸(push-before)이 «켜기 전» 바이트여야 한다.
 *   병(S6 실측 · 칸 원문 ×3): resetFxFreeTransform 이 ftMeasure(:271 — 글칸 style.width = ceil(W) · 119 ㉡) «뒤»에 setFxFreeTransform 의
 *     push-before 를 불러, 그 칸에 «효과 없이 글칸 폭 339px» 가 찍혔다 ⇒ ⌘Z 로 그 칸에 내리면 효과는 빠지고 좁은 폭만 남는다.
 *   처방 ㈏: push 를 재기(ftMeasure) «앞»으로 · setFx 는 history:false(두 번 쌓지 않음). ⛔119(:271)·되살림 길·274 닻 손 0.
 *   앱 행위(⌘Z 한 번 = 켜기 전 · 칸 바이트)는 tests/dom/ft-undo-fxadd-270.dom.spec.js 가 잰다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readSrc } from './_srcread.js';
const { sliceBlock } = createRequire(import.meta.url)('./_slice-block.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readSrc(path.join(ROOT, 'js', 'effects-freetransform.js'));

test('R1 ★resetFxFreeTransform 은 재기(ftMeasure) «앞»에 이력을 쌓는다(효과 켤 때 칸 = 켜기 전 바이트)', () => {
  assert.ok(SRC.includes('export function resetFxFreeTransform('), '전제: resetFxFreeTransform 정의가 없다');
  const body = sliceBlock(SRC, 'export function resetFxFreeTransform(', 'effects-freetransform.js resetFxFreeTransform');
  const iPush = body.indexOf('pushHistory');
  const iMeasure = body.indexOf('ftMeasure(');
  assert.ok(iMeasure >= 0, '전제: resetFxFreeTransform 이 ftMeasure 를 안 부른다(꼴이 바뀌었다 — 이 검사를 다시 읽어라)');
  assert.ok(iPush >= 0, '★resetFxFreeTransform 이 제 손으로 이력을 안 쌓는다 — setFx 의 push-before 가 재기 «뒤»에 찍힌다(270)');
  assert.ok(iPush < iMeasure, '★이력이 재기 «뒤»에 쌓인다 — 칸에 :271 글칸 폭이 효과 없이 찍힌다(270)');
});

test('R2 setFxFreeTransform 은 history:false 로 — 한 제스처 한 칸(두 번 쌓지 않는다)', () => {
  const body = sliceBlock(SRC, 'export function resetFxFreeTransform(', 'effects-freetransform.js resetFxFreeTransform');
  assert.match(body, /setFxFreeTransform\([^)]*\{\s*history:\s*false\b/, '★reset 이 setFx 에 history:false 를 안 넘긴다 — 칸이 둘 쌓인다');
});
