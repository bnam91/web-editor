/* redact-mosaic-killswitch.test.js — 가림막 「모자이크」 임시 차단(2026-09-20 «0920b-mosaic-off» T-070) 정적 회귀.
 *
 * ★현빈 원문: 「가림막(Redact)에 모자이크가 안됨. 우선 모자이크 버튼의 기능은 막아둘 것(블러만 둘 것)」
 *
 * ★이 검사가 지키는 것 — «차단이 실제로 닫혀 있는가»를 소스로 고정한다.
 *   ⒜ 스위치가 단일 원본(js/feature-flags.js)에 있고, «되살리는 조건»이 주석에 적혀 있다.
 *   ⒝ 패널이 그 스위치를 읽고, 모자이크 버튼이 disabled + 안내 title 이다(⛔버튼 삭제 아님).
 *   ⒞ 버튼 class 는 여전히 «템플릿 표현식 하나» — redact-mode-seg-markup.test.js:38 과 충돌 금지.
 *   ⒟ 회색 대신 블러로 보이는 CSS 오버라이드와, 비활성 버튼 표시 CSS 가 실재한다.
 *   ⒠ 게이트 비교가 `=== false` 다 — undefined(플래그 미주입 하네스)는 «켜짐»이어야 기존 DOM 스펙 5개가
 *      수정 0건으로 초록이다.
 *
 * 음성대조(dev @20e50e3): U1~U5 전부 빨강이다 — 그 커밋엔 REDACT_MOSAIC_ENABLED 자체가 없다.
 *   실측 출력: `REDACT_MOSAIC_ENABLED` grep 0건 / `body.redact-mosaic-off` 0건 / `.prop-align-btn:disabled` 0건.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeStripper } = require('./_strip-comments.js');

const REPO = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const codeOnly = (src) => { const strip = makeStripper(); return src.split('\n').map(strip).join('\n'); };

const FLAGS_RAW = read('js/feature-flags.js');
const FLAGS     = codeOnly(FLAGS_RAW);
const SHAPE     = codeOnly(read('js/props/prop-shape.js'));
const MOSAIC    = codeOnly(read('js/effects/redact-mosaic.js'));
const FACTORY   = codeOnly(read('js/block-factory.js'));
const BLOCKS_CSS = read('css/editor-blocks.css');
const PROPS_CSS  = read('css/editor-props.css');

test('U1 ★킬스위치가 단일 원본(js/feature-flags.js)에 false 로 있고, 되살리는 조건이 주석에 있다', () => {
  assert.match(FLAGS, /w\.REDACT_MOSAIC_ENABLED\s*=\s*false\s*;/,
    'feature-flags.js 에 REDACT_MOSAIC_ENABLED = false 가 없다 — 스위치의 단일 원본이 비었다');
  // ⛔주석은 «있는 척»이 아니라 되살리는 절차를 담아야 한다(막은 이유 + 되살리는 조건 + 카드).
  assert.match(FLAGS_RAW, /되살리는 조건/, '막아 둔 이유만 있고 «되살리는 조건»이 없다');
  assert.match(FLAGS_RAW, /0920b-mosaic-cause/, '원인 카드 번호가 주석에 없다 — 나중에 누가 무엇을 확인하고 켜야 하는지 모른다');
  assert.match(FLAGS_RAW, /goya-asset/, '막은 이유(캡처가 goya-asset 이미지를 못 싣는다)가 주석에 없다');
  // ⚠️데이터는 안 지웠다 — 그 사실이 주석에 남아야 되살릴 때 헷갈리지 않는다.
  assert.match(FLAGS_RAW, /shapeRedactMode="mosaic"|데이터는 아무것도 안 지웠다/, '데이터 보존 사실이 주석에 없다');
});

test('U2 ★패널이 스위치를 읽고, 모자이크 버튼은 «지워지지 않고» disabled + 안내 title', () => {
  assert.match(SHAPE, /window\.REDACT_MOSAIC_ENABLED\s*!==\s*false/,
    'prop-shape.js 가 킬스위치를 안 읽는다(또는 === false 로 뒤집어 읽는다)');
  const m = SHAPE.match(/<button\b[^>]*data-mode="mosaic"[^>]*>/);
  assert.ok(m, 'data-mode="mosaic" 버튼을 못 찾았다 — ⛔버튼을 지우면 안 된다(현빈: 「기능은 막아둘 것」)');
  assert.match(m[0], /\$\{mosaicOK \? '' : ' disabled/,
    `모자이크 버튼에 조건부 disabled 가 없다: ${m[0]}`);
  assert.match(m[0], /일시적으로 꺼져 있습니다/, '왜 못 누르는지 알려주는 title 이 없다');
  // blur 버튼은 «절대» 비활성이 아니다 — 블러만 남기는 게 이 유닛의 전부다.
  const mb = SHAPE.match(/<button\b[^>]*data-mode="blur"[^>]*>/);
  assert.ok(mb, 'data-mode="blur" 버튼이 없다');
  assert.ok(!/\sdisabled/.test(mb[0]), `블러 버튼까지 비활성이다: ${mb[0]}`);
});

test('U3 ★seg 버튼 class 는 여전히 «템플릿 표현식 하나» (redact-mode-seg-markup.test.js:38 과 충돌 금지)', () => {
  const seg = SHAPE.match(/<div\s+class="([^"]*)"\s+id="shape-redact-mode-seg">([\s\S]*?)<\/div>/);
  assert.ok(seg, 'shape-redact-mode-seg 컨테이너를 못 찾았다');
  const btns = [...seg[2].matchAll(/<button\b[^>]*>/g)].map(x => x[0]);
  assert.equal(btns.length, 2, `방식 버튼이 2개가 아니다(${btns.length}) — 삭제 금지`);
  for (const b of btns) {
    assert.match(b, /class="prop-align-btn(\$\{[^}]*\})?"/,
      `class 에 정적 클래스를 더했다 — 기존 초록 테스트가 깨진다: ${b}`);
  }
});

test('U4 ★CSS — 회색 대신 블러로 보이는 오버라이드 2규칙 + 비활성 버튼 표시', () => {
  assert.match(BLOCKS_CSS, /^body\.redact-mosaic-off \.shape-block\.shape-redact\[data-shape-redact-mode="mosaic"\]\s*\{/m,
    'body.redact-mosaic-off 의 블러 오버라이드가 없다 — 레거시 모자이크 블록이 회색 덩어리로 남는다');
  assert.match(BLOCKS_CSS, /^body\.redact-mosaic-off [^\n]*canvas\.redact-mosaic-canvas\s*\{/m,
    '차단 중에 모자이크 캔버스를 감추는 규칙이 없다');
  assert.match(PROPS_CSS, /^\.prop-align-btn:disabled\s*\{/m,
    '.prop-align-btn:disabled 가 없다 — 「비활성인데 눌릴 것처럼」 보인다');
});

test('U5 ★게이트 비교는 === false — undefined 는 «켜짐»(기존 DOM 스펙 5개 수정 0건)', () => {
  assert.match(MOSAIC, /window\.REDACT_MOSAIC_ENABLED\s*===\s*false/,
    'redact-mosaic.js 의 게이트가 === false 비교가 아니다(undefined 를 «꺼짐»으로 읽으면 기존 스펙이 전부 깨진다)');
  // 문은 «하나» — 캡처 입구에서 막는다.
  assert.match(MOSAIC, /export function captureMosaicSnapshot\(block, opts\) \{\s*\n\s*if \(mosaicDisabled\(\)\)/,
    'captureMosaicSnapshot 첫 줄 게이트가 없다 — 호출처마다 막으면 새 호출처에서 샌다');
  assert.match(MOSAIC, /export function wireMosaicAutoRefresh\(\) \{\s*\n\s*if \(mosaicDisabled\(\)\)/,
    'mouseup 자동 재캡처 리스너 게이트가 없다');
  assert.match(MOSAIC, /export function captureMosaicsAfterLoad\(root\) \{\s*\n\s*if \(mosaicDisabled\(\)\)/,
    '로드 후 일괄 캡처 게이트가 없다');
  assert.match(MOSAIC, /document\.body\?\.classList\.add\('redact-mosaic-off'\)/,
    'body.redact-mosaic-off 를 모듈이 스스로 붙이지 않는다(CSS 오버라이드가 영영 안 걸린다)');
  // ⛔export 안전실패 경로엔 게이트를 걸지 않는다 — 막으면 오히려 원본이 샐 수 있다.
  const fin = MOSAIC.match(/export async function finalizeMosaicForClone\([\s\S]*?\n\}/);
  assert.ok(fin, 'finalizeMosaicForClone 를 못 찾았다');
  assert.ok(!/mosaicDisabled\(\)/.test(fin[0]),
    '⛔finalizeMosaicForClone 에 킬스위치가 걸렸다 — export 안전실패(회색)가 안 돌면 원본이 샌다');
});

test('U6 ★goditor-api 는 조용히 blur 로 바꾸지 않고 DISABLED 로 거절한다(오류 삼키기 금지)', () => {
  assert.match(FACTORY, /window\.REDACT_MOSAIC_ENABLED === false[\s\S]{0,400}code: 'DISABLED'/,
    "applyShapeProps 가 mosaic 요청을 DISABLED 로 거절하지 않는다 — 호출자는 «걸렸다»고 믿는다");
});
