/* inspector-assetclear.test.mjs — T4-ASSETCLEAR: 인스펙터 «이미지» 줄 «비우기» (현빈 확정 ⒜ · 2026-10-22)
 *
 * 현빈 확정 ⒜: «이미지만 비움 · 블록 유지». 범위 = 인스펙터 «이미지» 줄만.
 *   ⛔«텍스트» 줄엔 안 단다 — js/inspector.js 선례 주석 «★★「텍스트」는 ★지디가 넓힌 범위다 — ⛔현빈은 ★이미지만 말했다».
 *
 * ★처방은 «있는 걸 부른다» — 이미지 빼기의 정의 자리는 js/image-handling.js clearAssetImage 하나다.
 *   ⛔손으로 DOM(.has-image · data-img-src · .asset-img)을 지우는 새 길을 만들지 않는다.
 * ★왜 깃발인가 — clearAssetImage 는 부를 때마다 pushHistory 한다(push-before). N 번 부르면 ⌘Z 가 N 걸음이다
 *   (tests/dom/inspector-assetclear.dom.spec.js C0 이 실측 대조). history.js 의 _historyPaused 는 모듈 안 let 이라 밖에서 못 멈춘다
 *   ⇒ 일괄 함수가 pushHistory 를 «한 번» 찍고, 블럭마다는 모듈 깃발 _assetClearBatch 를 켠 채 부른다(그때만 이력·패널·토스트를 건너뛴다).
 *   ★서명 `function clearAssetImage(ab)` 은 그대로다 — 그걸 닻으로 읽는 검사(image-redact U5)가 있다.
 * ★단추는 «이미지» 줄 «밑» 한 줄(clearRow)이다 — 머리 넷의 꼴(inspector-t17 I5)과 statRow 서명(inspector-t17 T1)을 안 건드린다.
 * 행위(사람 순서 · ⌘Z · 다시 열기)는 DOM spec 이 잰다. 여기는 소스 꼴.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const { sliceBlock, sliceCall } = require('./_slice-block.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const INSP = stripComments(readSrc(ROOT, 'js', 'inspector.js'));
const IH = stripComments(readSrc(ROOT, 'js', 'image-handling.js'));

const rowLine = (label) => INSP.split('\n').find(l => l.includes(`statRow('`) && l.includes(`'${label}'`));

const lines = INSP.split('\n');
const rowIdx = (label) => lines.findIndex(l => l.includes(`statRow('`) && l.includes(`'${label}'`));
const nextCode = (i) => { for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return lines[j]; return ''; };

test('A1 «이미지» 줄 바로 밑에 비우기 줄(clearRow 같은 key)이 붙는다', () => {
  const i = rowIdx('이미지');
  assert.ok(i >= 0, '전제: «이미지» statRow 줄이 있다');
  assert.match(lines[i], /statRow\('assetBlocks'/, '전제: «이미지» 줄은 assetBlocks 를 센다');
  assert.match(nextCode(i), /\$\{clearRow\('assetBlocks'\)\}/, '«이미지» 줄 다음 줄 = clearRow(assetBlocks)');
  const fn = sliceBlock(INSP, 'const clearRow = (', '비우기 줄');
  assert.match(fn, /data-insp-clear="\$\{key\}"/, '단추 표식 data-insp-clear');
  assert.match(fn, /_jumpTargets\[key\]/, '그 줄이 «센 것»(_jumpTargets[key])을 읽는다 — 목록 두 벌 ⛔');
  assert.match(fn, /has-image/, '비울 것 = .has-image 수');
  assert.match(fn, /if\s*\(\s*!n\s*\)\s*return\s*''/, '비울 것 0 이면 단추 0');
});

test('A2 ⑷ 음성대조 — «텍스트» 줄 밑엔 비우기 줄이 없다 (고치기 전에도 초록이 맞다)', () => {
  const i = rowIdx('텍스트');
  assert.ok(i >= 0, '전제: «텍스트» statRow 줄이 있다');
  assert.doesNotMatch(lines[i], /clear/i, '«텍스트» 줄에 비우기 0');
  assert.doesNotMatch(nextCode(i), /clearRow\('textBlocks'\)/, '«텍스트» 줄 밑에 clearRow(textBlocks) 0');
});

test('A2b 비우기 줄을 부르는 자리는 «이미지»(assetBlocks) 하나뿐', () => {
  const calls = [...INSP.matchAll(/\$\{clearRow\('([A-Za-z]+)'\)\}/g)].map(m => m[1]);
  assert.deepStrictEqual(calls, ['assetBlocks']);
});

test('A3 비우기 클릭은 점프보다 «먼저» 갈린다 — 같은 문서 위임 안 · 정의 자리를 부른다', () => {
  const body = sliceCall(INSP, "document.addEventListener('click'", '인스펙터 클릭 위임');
  const iClear = body.indexOf('[data-insp-clear]');
  const iJump = body.indexOf("closest?.('.insp-jump')");
  assert.ok(iClear >= 0, '위임 안에 비우기 갈래가 있다');
  assert.ok(iJump >= 0, '전제: 점프 갈래');
  assert.ok(iClear < iJump, '비우기 갈래가 점프 갈래보다 먼저');
  assert.match(body, /window\.clearAssetImages\(/, '비우기는 정의 자리(window.clearAssetImages)를 부른다');
});

test('A4 일괄 함수 clearAssetImages — pushHistory 는 한 번 · 깃발 켠 채 블럭마다 clearAssetImage · finally 로 끈다', () => {
  const fn = sliceBlock(IH, 'function clearAssetImages(', '이미지 일괄 비우기');
  assert.strictEqual((fn.match(/\bpushHistory\(/g) || []).length, 1, 'pushHistory 1 번');
  const iPush = fn.indexOf('pushHistory(');
  const iOn = fn.indexOf('_assetClearBatch = true');
  const iCall = fn.search(/clearAssetImage\(ab\)/);
  assert.ok(iPush >= 0 && iOn > iPush && iCall > iOn, 'pushHistory → 깃발 켬 → clearAssetImage(ab) 순(push-before)');
  assert.match(fn, /finally\s*\{\s*_assetClearBatch\s*=\s*false/, '깃발은 finally 에서 끈다');
  assert.match(fn, /has-image/, '이미지 든 것(.has-image)만 고른다');
  assert.doesNotMatch(fn, /classList\.remove\('has-image'\)|delete\s+\w+\.dataset\.imgSrc|\.innerHTML\s*=/, '⛔손으로 DOM 을 지우지 않는다 — clearAssetImage 가 지운다');
  assert.ok(fn.indexOf('exitImageEditMode') >= 0 && fn.indexOf('exitImageEditMode') < iPush, '편집 모드는 pushHistory 전에 닫는다');
  assert.match(IH, /window\.clearAssetImages\s*=\s*clearAssetImages/, '창 노출');
});

test('A5 clearAssetImage — 서명 그대로(ab) · 깃발일 때만 이력·패널·토스트를 건너뛴다 · 지우는 몸 그대로', () => {
  assert.ok(IH.includes('function clearAssetImage(ab) {'), '서명 그대로(image-redact U5 의 닻)');
  const fn = sliceBlock(IH, 'function clearAssetImage(', '이미지 비우기');
  assert.ok(fn.startsWith('function clearAssetImage(ab)'), '전제: 뜬 덩이 = clearAssetImage 자신(clearAssetImages 아님)');
  assert.match(fn, /const batch = _assetClearBatch/, '깃발을 읽는다');
  assert.match(fn, /if\s*\(\s*!batch\s*\)\s*pushHistory\(\)/, 'pushHistory 는 !batch 일 때만');
  assert.match(fn, /if\s*\(\s*batch\s*\)\s*return;\s*showAssetProperties\(ab\)/, '패널·토스트는 !batch 일 때만');
  for (const must of ["classList.remove('has-image')", 'delete ab.dataset.imgSrc', 'applyRedact(ab, 0)', 'restoreAssetCollab(ab, prevCollab2)']) {
    assert.ok(fn.includes(must), `지우는 몸 그대로: ${must}`);
  }
});
