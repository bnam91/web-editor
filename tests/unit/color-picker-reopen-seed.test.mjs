/* color-picker-reopen-seed — T-059 2라운드: «재오픈 시드»를 모든 그라데이션 필드가 wireColorField(gradientValue)로 받는다.
 *
 * 실앱 9503 실측(수정 전 int/0918-requests @6c1442c):
 *   프레임 ss-bg · 에셋 asset-bg · 비교 cmp-c0Bg(featured 아닌 칼럼) — 그라데이션 → 다른 블럭 → 재선택 → 피커 = Solid 탭,
 *   그라데이션 탭 = «지금 색 100%→0%» 기본값이 사용자 그라데이션을 덮음(기록 1). Solid 복귀 = #ffffff/#000000.
 *   배너02 bn2-bg — 탭은 맞게 열렸지만(bindGradientLinePicker 부수효과) Solid 복귀 = 폴백 #f3f4f6.
 * 동작은 tests/dom/color-picker-tab-apply.dom.spec.js T12~T12h 가 잰다. 여기는 «배선 자리» 핀.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceCall } from './_slice-block.js';
import { stripComments } from './_strip-comments.js';
import { readSrc } from './_srcread.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (f) => stripComments(readSrc(ROOT, 'js', 'props', f));

const FIELDS = [
  { file: 'prop-frame.js',      call: "wireColorField('ss-bg'",             idp: /idPrefix:\s*'ss-bg'/ },
  { file: 'prop-asset.js',      call: "wireColorField('asset-bg'",          idp: /idPrefix:\s*'asset-bg'/ },
  { file: 'prop-banner02.js',   call: "wireColorField('bn2-bg'",            idp: /idPrefix:\s*'bn2-bg'/ },
  { file: 'prop-comparison.js', call: "wireColorField('cmp-c' + idx + 'Bg'", idp: /idPrefix:\s*'cmp-c'\s*\+\s*idx\s*\+\s*'Bg'/ },
];

test('A0 ★양성대조 — 네 필드가 실제로 렌더되고 onGradient 를 받는다(전제부터)', () => {
  for (const f of FIELDS) {
    const s = src(f.file);
    assert.match(s, f.idp, `${f.file}: 필드 자체가 없다 — 판정 무효`);
    assert.match(sliceCall(s, f.call, f.file), /onGradient\s*:/, `${f.file}: onGradient 가 없으면 그라데이션 필드가 아니다`);
  }
});

test('S1 네 필드 모두 wireColorField 에 gradientValue(블럭의 지금 값)를 넘긴다', () => {
  for (const f of FIELDS) {
    const call = sliceCall(src(f.file), f.call, f.file);
    assert.match(call, /gradientValue\s*:/, `${f.file}: gradientValue 가 없으면 재선택 후 피커가 Solid 로 열리고 그라데이션 탭이 사용자 값을 덮는다`);
  }
});

test('S2 프레임·에셋 스와치는 그라데이션을 그라데이션으로 보여 준다(colorFieldHTML gradientCss)', () => {
  assert.match(src('prop-frame.js'), /colorFieldHTML\(\{\s*idPrefix:\s*'ss-bg'[^}]*gradientCss:/);
  assert.match(src('prop-asset.js'), /colorFieldHTML\(\{\s*idPrefix:\s*'asset-bg'[^}]*gradientCss:/);
});

test('S3 wireColorField 가 gradientValue 로 시드·첫 스탑 색을 채우고, 호출측 cpGradient 는 존중한다', () => {
  const cp = src('color-picker.js');
  assert.match(cp, /import\s*\{\s*parseGradient\s*\}\s*from\s*'\.\/gradient-model\.js'/);
  const i = cp.indexOf('export function wireColorField');
  assert.ok(i > 0);
  const body = cp.slice(i, cp.indexOf("picker.addEventListener('input'", i));
  assert.match(body, /gradientValue/);
  assert.match(body, /parseGradient\(/);
  assert.match(body, /if\s*\(\s*!picker\.dataset\.cpGradient\s*\)/, '도형처럼 호출측이 먼저 채운 시드를 덮으면 안 된다');
  assert.match(body, /picker\.value\s*=\s*fh/, 'Solid 복귀 색 = 첫 스탑 — picker.value 를 안 채우면 호출측 폴백(#ffffff 등)이 칠해진다');
  // ⛔시드 단계에서 문서를 건드리면 «열기만 해도» 값이 바뀐다
  const seed = body.slice(body.indexOf('if (onGradient && gradientValue)'), body.indexOf('if (!picker.dataset.cpModes)'));
  assert.ok(seed.length > 100, '시드 구간을 못 떠냈다');
  assert.doesNotMatch(seed, /onApply\s*\?*\.?\(|onGradient\s*\(|onCommit\s*\?*\.?\(/);
});

test('S4 gradient-model 은 import 가 없다(color-picker ↔ gradient-model 순환 위험 0)', () => {
  assert.doesNotMatch(readSrc(ROOT, 'js', 'props', 'gradient-model.js'), /^\s*import\s/m);
});
