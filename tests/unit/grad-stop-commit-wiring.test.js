/* grad-stop-commit-wiring.test.js — 0920b «grad-alpha» 원문 게이트 (2026-09-20)
 *
 * ★배경 — 현빈 원문 11번
 *   「grad_8ukztd 우측패널 .grad-stop-alpha 에 커서 올리고 백스페이스 → 바로 0 으로 적용.
 *    그리고 그 블럭을 삭제한 뒤 ⌘Z 하면 되살아나는데 보라색 아웃라인이 안 보여 확인하려면
 *    클릭해 봐야만 안다」
 *
 * ★이 파일이 재는 것 — «배선이 끊기지 않았나»(원문 게이트).
 *   실제 거동(커밋 횟수·포커스·테두리 복원)은 DOM 스펙 두 개가 진짜 키보드/마우스로 잰다:
 *     tests/dom/grad-stop-alpha-commit.dom.spec.js   (A·B)
 *     tests/dom/undo-restore-selection.dom.spec.js   (C)
 *   여기서는 그 DOM 스펙이 «하네스 스텁»에 기대는 전제(원문의 세척 목록 등)와,
 *   «두 곳 대칭»(restoreSnapshot / restoreSnapshotScoped — W5/W6 와 같은 성질)을 지킨다.
 *
 * ⛔주석 거르기는 tests/unit/_strip-comments.js 의 makeStripper «만» 쓴다.
 * ⛔고정 창(slice) 금지 — 함수 몸통은 중괄호를 세어 떼어낸다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeStripper } = require('./_strip-comments');

const ROOT = path.join(__dirname, '..', '..');
const readSrc = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

/** 함수 «몸통»을 중괄호 균형으로 떠낸다 (선례: video-pending-restore-wiring.test.js). */
function extractFn(src, name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  const start = m.index;
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

/** 주석을 걷어낸 «코드만» — includes 가 주석 문구에 속아 초록나는 걸 막는다. */
function codeOnly(src) {
  const strip = makeStripper();
  return src.split('\n').map(strip).join('\n');
}

const GUARD_SRC     = readSrc('js', 'props', 'prop-number-commit-guard.js');
const GRADIENT_SRC  = readSrc('js', 'props', 'prop-gradient.js');
const HISTORY_SRC   = readSrc('js', 'history.js');
const SERIALIZE_SRC = readSrc('js', 'io', 'section-serialize.js');

const GUARD_CODE    = codeOnly(GUARD_SRC);
const GRADIENT_CODE = codeOnly(GRADIENT_SRC);
const HISTORY_CODE  = codeOnly(HISTORY_SRC);

const PUSH_HISTORY_BODY   = codeOnly(extractFn(HISTORY_SRC, 'pushHistory'));
const ENSURE_CKPT_BODY    = codeOnly(extractFn(HISTORY_SRC, 'ensureHistoryCheckpoint'));
const RESTORE_BODY        = codeOnly(extractFn(HISTORY_SRC, 'restoreSnapshot'));
const RESTORE_SCOPED_BODY = codeOnly(extractFn(HISTORY_SRC, 'restoreSnapshotScoped'));
const CAPTURE_SEL_BODY    = codeOnly(extractFn(HISTORY_SRC, '_captureSelection'));
const RESTORE_SEL_BODY    = codeOnly(extractFn(HISTORY_SRC, '_restoreSelection'));

test('G0 ★뗀 몸통들이 비어 있지 않다 (아래 초록이 빈 함수의 초록이 아니다)', () => {
  for (const [name, body] of Object.entries({
    pushHistory: PUSH_HISTORY_BODY, ensureHistoryCheckpoint: ENSURE_CKPT_BODY,
    restoreSnapshot: RESTORE_BODY, restoreSnapshotScoped: RESTORE_SCOPED_BODY,
    _captureSelection: CAPTURE_SEL_BODY, _restoreSelection: RESTORE_SEL_BODY,
  })) {
    assert.ok(body.length > 120, `${name} 몸통이 너무 짧다(${body.length}자) — 추출이 깨졌다`);
  }
});

test('G1 커밋 가드(PN_SEL)가 grad stop 의 투명도·위치 칸을 «둘 다» 덮는다', () => {
  const m = /const PN_SEL\s*=\s*'([^']+)'/.exec(GUARD_CODE);
  assert.ok(m, 'prop-number-commit-guard.js 의 PN_SEL 을 못 찾았다');
  assert.match(m[1], /\.prop-number\b/, '기존 .prop-number 를 잃지 말 것(242개 필드 회귀)');
  assert.match(m[1], /\.grad-stop-alpha\b/, '.grad-stop-alpha 가 가드 밖이면 타이핑 중 즉시 커밋이 재발한다');
  assert.match(m[1], /\.grad-stop-offset\b/, '.grad-stop-offset 이 가드 밖이면 「빈값 → 0」이 재발한다');
});

test('G2 «빈값 → 0» 패턴이 prop-gradient 의 커밋 경로에 남아 있지 않다', () => {
  // 옛 코드: offIn.addEventListener('change', () => mutate(s => s.offset = …(+offIn.value||0)/100, true))
  assert.ok(!/\+\s*offIn\.value\s*\|\|\s*0/.test(GRADIENT_CODE),
    '`+offIn.value||0` 은 빈 문자열을 0 으로 커밋한다 — 현빈 원문 11번 그대로다');
  // 옛 알파 파서: /\d+/ 부분매치 ⇒ "00" 을 유효값 0 으로 본다
  assert.ok(!/alphaIn\.value\.match\(\/\\d\+\/\)/.test(GRADIENT_CODE),
    'alphaIn.value.match(/\\d+/) 부분매치는 "100" 캐럿 중간 Backspace("00")를 0 으로 커밋한다');
});

test('G3 alpha·offset 파서가 «칸 전체»를 숫자로 볼 때만 통과한다 (앵커 정규식)', () => {
  const m = /const _pct\s*=\s*\(raw\)\s*=>\s*\{([\s\S]*?)\n\s{6}\};/.exec(GRADIENT_CODE);
  assert.ok(m, 'prop-gradient.js 의 _pct 파서를 못 찾았다');
  assert.match(m[1], /\^/, '앵커(^) 없는 정규식은 부분매치로 되돌아간다');
  assert.match(m[1], /\$/, '앵커($) 없는 정규식은 부분매치로 되돌아간다');
  assert.match(m[1], /return null/, '파싱 실패 시 null 로 «미커밋» 을 알려야 한다');
});

test('G4 change 에서 파싱 실패면 칸을 모델값으로 되돌린다 (표시-모델 괴리 방지)', () => {
  assert.match(GRADIENT_CODE, /alphaIn\.addEventListener\('change'[^\n]*_resync\(alphaIn/,
    'alpha change 경로에 표시 복원(_resync)이 없다');
  assert.match(GRADIENT_CODE, /offIn\.addEventListener\('change'[^\n]*_resync\(offIn/,
    'offset change 경로에 표시 복원(_resync)이 없다');
});

test('G5 buildList 가 재생성 «전후»로 포커스를 보존한다 (다음 Backspace 가 블럭을 지우지 않게)', () => {
  const body = codeOnly(GRADIENT_SRC.slice(GRADIENT_SRC.indexOf('const buildList ='), GRADIENT_SRC.indexOf('// 바 빈 영역 클릭')));
  assert.ok(body.length > 200, 'buildList 구간 추출이 깨졌다');
  assert.match(body, /document\.activeElement/, '재생성 전 포커스를 적어두지 않는다');
  assert.match(body, /\.focus\(/, '재생성 후 포커스를 되돌리지 않는다 — activeElement 가 BODY 로 남으면 Backspace 가 캔버스 삭제로 샌다');
  assert.match(body, /setSelectionRange/, '캐럿 복원이 없다');
});

test('G6 히스토리 항목 리터럴 «셋 다»에 selection 키가 있다', () => {
  assert.match(PUSH_HISTORY_BODY, /selection:\s*_captureSelection\(\)/, 'pushHistory 항목에 selection 이 없다');
  assert.match(ENSURE_CKPT_BODY,  /selection:\s*_captureSelection\(\)/, 'ensureHistoryCheckpoint 항목에 selection 이 없다');
  assert.match(codeOnly(extractFn(HISTORY_SRC, 'clearHistory')), /selection:\s*_captureSelection\(\)/, 'clearHistory 초기 항목에 selection 이 없다');
});

test('G7 ★두 복원 경로가 «대칭»이다 — 한쪽만 고치면 협업 켠 사람만 증상이 남는다 (W5/W6 성질)', () => {
  assert.match(RESTORE_BODY,        /_restoreSelection\(/, 'restoreSnapshot 에 재선택 호출이 없다');
  assert.match(RESTORE_SCOPED_BODY, /_restoreSelection\(/, 'restoreSnapshotScoped 에 재선택 호출이 없다(협업 스코프 undo 비대칭)');
  // 순서 — 마지막 deselectAll «뒤»여야 한다(앞에 두면 deselectAll 이 도로 지운다)
  for (const [name, body] of [['restoreSnapshot', RESTORE_BODY], ['restoreSnapshotScoped', RESTORE_SCOPED_BODY]]) {
    assert.ok(body.lastIndexOf('deselectAll()') < body.indexOf('_restoreSelection('),
      `${name}: _restoreSelection 이 마지막 deselectAll 보다 앞에 있다 — 선택이 도로 지워진다`);
  }
});

test('G8 «캔버스 무변화 + 선택만 바뀜» 갈래가 ensureHistoryCheckpoint 에 있다', () => {
  // 삭제 경로는 선택이 세척돼 canvas 문자열이 안 변한다 ⇒ 새 항목이 안 생긴다.
  // 그 자리에서 맨 위 항목의 selection 을 갱신하지 않으면 되돌아갈 자리에 선택 정보가 없다.
  assert.match(ENSURE_CKPT_BODY, /else if[\s\S]*historyStack\[historyPos\]\.selection\s*=/,
    'else 갈래에서 맨 위 항목의 selection 을 갱신하지 않는다');
});

test('G9 재선택 디스패치가 그라데이션·스티커를 «먼저» 본다 (selectBlock 은 분기가 없다)', () => {
  const gi = RESTORE_SEL_BODY.indexOf('_selectGradient');
  const si = RESTORE_SEL_BODY.indexOf('_selectSticker');
  const bi = RESTORE_SEL_BODY.indexOf('selectBlock');
  assert.ok(gi > -1 && si > -1 && bi > -1, '세 진입점이 모두 있어야 한다');
  assert.ok(gi < bi && si < bi, 'selectBlock 이 앞에 오면 그라데이션이 showTextProperties 로 떨어진다');
  assert.match(RESTORE_SEL_BODY, /contains\(el\)/, '복원된 캔버스에 그 id 가 실제로 있을 때만 골라야 한다');
});

test('G10 ★DOM 스펙의 «세척 스텁» 전제가 원문에 그대로 있다 (스텁이 조용히 낡지 않게)', () => {
  // tests/dom/undo-restore-selection.dom.spec.js 가 흉내내는 두 자리
  const code = codeOnly(SERIALIZE_SRC);
  assert.match(code, /RUNTIME_MARKER_CLS\s*=\s*\[[\s\S]*?'selected'/,
    "section-serialize.js 의 RUNTIME_MARKER_CLS 에서 'selected' 가 사라졌다 — 스냅샷 세척 전제가 바뀌었다");
  assert.match(code, /\.gradient-corner-handle/,
    'section-serialize.js 가 .gradient-corner-handle 을 더 이상 제거하지 않는다 — 스텁 전제가 바뀌었다');
});
