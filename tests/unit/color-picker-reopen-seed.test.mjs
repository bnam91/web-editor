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
  assert.match(cp, /import\s*\{\s*parseGradientStrict\s*\}\s*from\s*'\.\/gradient-model\.js'/);
  const i = cp.indexOf('export function wireColorField');
  assert.ok(i > 0);
  const body = cp.slice(i, cp.indexOf("picker.addEventListener('input'", i));
  assert.match(body, /gradientValue/);
  assert.match(body, /parseGradientStrict\(/, '관대한 parseGradient 로 시드하면 \'to right\'·\'ellipse at …\' 가 잘못 읽힌다(이벨류 high)');
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

/* ── 픽스 라운드(이벨류 high/low) ──
   high: 피커를 «열기만» 해도 블럭 값이 바뀌었다 — seed-gradient 핸들러가 _seedGradientUI 를 emit 기본값으로 불러
         _emitGradientNow(false) → onGradient 가 피커 재직렬화 CSS 로 덮음. 'to right'·'ellipse at top left' 가 망가짐.
   low : 첫 스탑이 완전 투명이면 Solid 복귀가 투명색. */
test('S5 ★seed-gradient 핸들러는 emit:false 로 시드한다(열기만 해선 onGradient 0회)', () => {
  const cp = src('color-picker.js');
  const i = cp.indexOf("pop.addEventListener('goya-cp:seed-gradient'");
  assert.ok(i > 0, '시드 핸들러를 못 찾았다 — 판정 무효');
  const h = cp.slice(i, cp.indexOf('});', i));
  assert.match(h, /_seedGradientUI\(\s*e\.detail\s*,\s*\{\s*emit:\s*false/, '열기만 해도 _emitGradientNow → onGradient 가 블럭 값을 덮는다');
});

test('S6 bindGradientLinePicker 시드도 같은 엄격 파서(배너02·비교·도형 재오픈 시드 기준 통일)', () => {
  const ov = stripComments(readSrc(ROOT, 'js', 'gradient-line-overlay.js'));
  const i = ov.indexOf('function bindGradientLinePicker');
  assert.ok(i > 0);
  const body = ov.slice(i, ov.indexOf('_gradLinePickerWired', i));
  assert.match(body, /parseGradientStrict\(/);
});

import fs from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
async function GM() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-gmstrict-'));
  fs.copyFileSync(path.join(ROOT, 'js', 'props', 'gradient-model.js'), path.join(tmp, 'gradient-model.js'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  return import(pathToFileURL(path.join(tmp, 'gradient-model.js')).href);
}

test('S7 parseGradientStrict — 피커가 못 지키는 문법은 null(시드 안 함), 피커 문법은 통과(양성대조)', async () => {
  const m = await GM();
  assert.equal(typeof m.parseGradientStrict, 'function', 'parseGradientStrict 가 없다');
  const REJECT = [
    'linear-gradient(to right, #ff0000, #0000ff)',                         // 방향 키워드가 색 스탑으로 읽혔다(실앱 재현)
    'radial-gradient(ellipse at top left, #ff0000 0%, #0000ff 100%)',      // 도형·위치 → circle 로 바뀌었다(실앱 재현)
    'radial-gradient(#ff0000 0%, #0000ff 100%)',                           // 기본 ellipse → circle
    'linear-gradient(90deg, red 0%, blue 100%)',                           // 이름색 → _hex6 = #000000
    'linear-gradient(90deg, #f00 0%, #00f 100%)',                          // 3자리 hex → #000000
    'linear-gradient(0.25turn, #ff0000 0%, #0000ff 100%)',                 // turn 단위가 색 스탑
    'linear-gradient(-45deg, #ff0000 0%, #0000ff 100%)',                   // 0~360 밖 → 피커가 0 으로 클램프
    'linear-gradient(#ff0000, #00ff00, #0000ff)',                          // 위치 없는 3스탑 → 가운데가 100% 로
    '#123456', '', 'transparent',
  ];
  for (const c of REJECT) assert.equal(m.parseGradientStrict(c), null, `통과하면 안 된다: ${c}`);
  const ACCEPT = [
    'linear-gradient(45deg, #ff0000 0%, #0000ff 100%)',
    'radial-gradient(circle, rgba(255,0,0,0.500) 0%, #00aa00 50%, #0000ff 100%)',
    'linear-gradient(90deg, rgba(255,255,255,0.000) 0%, #ffffff 100%)',
    'linear-gradient(180deg, #ff0000 -20%, #0000ff 130%)',                 // 캔버스 바 자유 끝점(범위 밖 %)
    'linear-gradient(#ff0000, #0000ff)',                                   // 2스탑 위치 생략 = 0/100 과 같다
  ];
  for (const c of ACCEPT) {
    const g = m.parseGradientStrict(c);
    assert.ok(g && g.stops.length >= 2, `피커 문법인데 거부됐다: ${c}`);
    assert.deepEqual(g, m.parseGradient(c), '엄격 파서는 거르기만 — 모델은 parseGradient 와 같아야 한다');
  }
});

test('S8 Solid 복귀 색 = «보이는» 첫 스탑(투명 첫 스탑이면 다음 스탑, 전부 투명이면 불투명 첫 스탑)', () => {
  const cp = src('color-picker.js');
  const i = cp.indexOf('export function wireColorField');
  const seed = cp.slice(cp.indexOf('if (onGradient && gradientValue)', i), cp.indexOf('if (!picker.dataset.cpModes)', i));
  assert.match(seed, /\.find\(\s*s\s*=>\s*_op\(s\)\s*>\s*0\s*\)/);
  assert.match(seed, /:\s*100\s*;/, '전부 투명이면 알파 100 — 아니면 Solid 복귀가 보이지 않는 색');
});
