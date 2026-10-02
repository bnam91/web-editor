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
/* ★2026-09-21(T-079) 패널 표는 js/panel-dispatch.js 로 이사했다 — history 와 block-edit(selectBlock)
   가 «같은» 표를 쓰게 하려고. history 쪽 배선(그라데이션·스티커 먼저 → 표 → 핸들)은 그대로다. */
const DISPATCH_SRC  = readSrc('js', 'panel-dispatch.js');
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

test('G1 커밋 가드가 grad stop 의 투명도·위치 칸을 «둘 다» 덮는다 (0921 numfield: 목록 → 타입 주도)', () => {
  /* ★이 검사는 원래 `const PN_SEL = '.prop-number, .grad-stop-alpha, .grad-stop-offset'` 라는
       «문자열»을 못 박고 있었다. 0921 numfield 라운드가 회원 판정을 «타입 주도»로 바꾸면서
       그 문자열이 사라졌다 — 지우지 않고 «같은 뜻»을 타입으로 다시 못 박는다.
       (그냥 지우면 grad-stop 회귀 그물이 통째로 사라진다.)
     뜻: ⑴ 두 칸이 여전히 가드 안이다 ⑵ 기존 .prop-number 214칸도 여전히 안이다. */
  const m = /const isPn\s*=\s*\(el\)\s*=>([\s\S]*?);\n/.exec(GUARD_CODE);
  assert.ok(m, 'prop-number-commit-guard.js 의 isPn(회원 판정)을 못 찾았다');
  const JUDGE = m[1];
  assert.match(JUDGE, /el\.type\s*===\s*'number'/,
    "★타입 주도가 사라졌다 — 목록으로 되돌아가면 «목록 밖 새 칸»이 또 조용히 샌다(0921 실측 19칸). "
    + '.prop-number 214칸과 .grad-stop-offset 은 전부 type="number" 라 이 한 줄이 덮는다');
  assert.match(JUDGE, /HTMLInputElement/,
    '<select class="prop-number"> 2곳(editor.js·prop-iconify.js)을 걸러내던 가드가 사라졌다');
  const t = /const PN_TEXT_SEL\s*=\s*'([^']+)'/.exec(GUARD_CODE);
  assert.ok(t, 'type=number 가 아닌 예외 목록(PN_TEXT_SEL)을 못 찾았다');
  assert.match(t[1], /\.grad-stop-alpha\b/,
    '.grad-stop-alpha(type="text")가 가드 밖이면 타이핑 중 즉시 커밋이 재발한다');
  assert.match(JUDGE, /PN_TEXT_SEL/, '예외 목록을 판정에서 안 쓴다 — 상수만 남고 죽었다');
  // ⑵ .grad-stop-offset 은 «목록에 없어도» 타입으로 걸린다 — 그 전제(마크업이 type=number)를 같이 못 박는다
  assert.match(GRADIENT_CODE, /<input type="number" class="grad-stop-offset"/,
    '.grad-stop-offset 이 더는 type="number" 가 아니다 — 타입 주도 판정이 이 칸을 놓친다(「빈값 → 0」 재발)');
});

test('G1b ★스피너 휴리스틱은 «스피너가 있는 칸»에만 탄다 (2026-09-20 통합 라운드)', () => {
  /* ★증상: 투명도 칸(.grad-stop-alpha, type="text", width 34px)의 오른쪽을 눌러 캐럿만
       옮겨도 즉시 커밋 → 리스트 재생성 → 포커스 BODY → 다음 Backspace 가 «블럭»을 지운다.
     ★뿌리: 「webkit 인라인 스피너는 우측 18px」이라는 전제로 만든 선커밋 휴리스틱이,
       스피너가 «아예 없는» text 칸에서도 돌았다. 34px 칸에서 18px 은 절반이 넘는다.
     ⛔18 을 더 작은 수로 바꾸는 식으로 고치지 마라 — 좁은 number 칸에서 진짜 스피너를 놓친다.
       전제가 「스피너가 있다」이므로 그 «전제»를 검사해야 한다. */
  const i = GUARD_CODE.indexOf("addEventListener('mousedown'");
  assert.ok(i > 0, '스피너 선커밋 mousedown 핸들러를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const body = GUARD_CODE.slice(i, GUARD_CODE.indexOf('}, true);', i));
  assert.match(body, /el\.type\s*!==\s*'number'/,
    '★스피너 휴리스틱이 type 을 안 본다 — 스피너 없는 text 칸(.grad-stop-alpha)에서 캐럿 클릭이 커밋된다');
  const gate = body.indexOf("el.type !== 'number'");
  const heur = body.indexOf('clientWidth');
  assert.ok(gate > 0 && heur > gate,
    '★type 게이트가 18px 휴리스틱 «뒤»에 있다 — 먼저 걸러야 뜻이 산다');
  // 그리고 «그 휴리스틱 자체»는 살아 있어야 한다(number 칸의 선커밋 규약)
  assert.match(body, /clientWidth\s*-\s*e\.offsetX/, '★스피너 선커밋 규약이 통째로 사라졌다');
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

test('G9 재선택 디스패치가 그라데이션·스티커를 «먼저» 보고, selectBlock 에 기대지 않는다', () => {
  const gi = RESTORE_SEL_BODY.indexOf('_selectGradient');
  const si = RESTORE_SEL_BODY.indexOf('_selectSticker');
  assert.ok(gi > -1 && si > -1, '«선택+핸들+패널»을 한 벌로 처리하는 두 진입점이 모두 있어야 한다');
  const pi = RESTORE_SEL_BODY.indexOf('openPanelForBlock');
  assert.ok(pi > -1, '공용 패널 표 진입점(openPanelForBlock)을 안 쓴다');
  assert.ok(gi < pi && si < pi, '표가 앞에 오면 그라데이션이 일반 경로로 떨어진다');
  /* ★window.selectBlock 으로 흘리면 안 된다 — js/block-edit.js 의 getBlockById 가
     `!!el.dataset.type` 를 요구하는데 asset-block·icon-text-block·label-group-block 은
     data-type 속성이 «없어»(실측) 아무 일도 안 일어난다. 현빈 원문의 「클릭해봐야 안다」가
     이미지 블럭에서 그대로 남는다. */
  assert.ok(!/selectBlock\s*\?*\.?\(/.test(RESTORE_SEL_BODY),
    '_restoreSelection 이 selectBlock 을 쓰면 data-type 없는 타입에서 조용히 실패한다');
  assert.match(codeOnly(extractFn(require('fs').readFileSync(path.join(ROOT, 'js', 'block-edit.js'), 'utf8'), 'getBlockById')),
    /dataset\??\.type/, '전제가 바뀌었다: getBlockById 가 더는 data-type 을 요구하지 않는다면 위 회피는 재검토 대상');
  assert.match(RESTORE_SEL_BODY, /contains\(el\)/, '복원된 캔버스에 그 id 가 실제로 있을 때만 골라야 한다');
});

test('G9b 패널 표가 «실제 클릭 경로»(block-drag.js)와 같은 함수를 가리킨다', () => {
  /* 1차 구현의 두 번째 구멍: 복원 뒤 보라 테두리는 보이는데 우측 패널이 Page/Text 로 어긋났다.
     클릭 경로가 타입마다 다른 show*Properties 를 부르기 때문이다. 표가 그 이름을 그대로
     가리키는지(=오타·유실이 없는지) 양쪽에서 잰다. */
  const DRAG_CODE = codeOnly(readSrc('js', 'block-drag.js'));
  const TABLE = codeOnly(DISPATCH_SRC.slice(
    DISPATCH_SRC.indexOf('const _PANEL_BY_CLASS'), DISPATCH_SRC.indexOf('function openPanelForBlock')));
  assert.ok(TABLE.length > 400, '_PANEL_BY_CLASS 추출이 깨졌다');
  const PAIRS = [
    ['asset-block', 'showAssetProperties'], ['gap-block', 'showGapProperties'],
    ['icon-circle-block', 'showIconCircleProperties'], ['table-block', 'showTableProperties'],
    ['label-group-block', 'showLabelGroupProperties'], ['graph-block', 'showGraphProperties'],
    ['divider-block', 'showDividerProperties'], ['bridge-block', 'showBridgeProperties'],
    ['grid-block', 'showGridProperties'], ['qa-block', 'showQAProperties'],
    ['infocard-block', 'showInfoCardProperties'], ['innercard-block', 'showInnerCardProperties'],
    ['modal-block', 'showModalProperties'], ['joker-block', 'showJokerProperties'],
    ['canvas-block', 'showCanvasProperties'], ['banner02-block', 'showBanner02Properties'],
    ['comparison-block', 'showComparisonProperties'], ['vector-block', 'showVectorProperties'],
    ['icon-block', 'showIconifyProperties'], ['mockup-block', 'showMockupProperties'],
    ['step-block', 'showStepProperties'], ['chat-block', 'showChatProperties'],
    ['laurel-block', 'showLaurelProperties'], ['zoom-block', 'showZoomProperties'],
    ['shape-block', 'showShapeProperties'], ['text-block', 'showTextProperties'],
    ['icon-text-block', 'showTextProperties'],
  ];
  /** 표의 «한 줄»(여러 줄짜리 항목 포함)만 떼어낸다 — 옆 항목으로 새서 거짓 그린이 나지 않게. */
  const entryOf = (cls) => {
    const i = TABLE.indexOf("['" + cls + "'");
    assert.ok(i > -1, `_PANEL_BY_CLASS 에 ${cls} 항목이 없다`);
    const j = TABLE.indexOf("\n  ['", i + 1);
    return TABLE.slice(i, j === -1 ? TABLE.length : j);
  };
  for (const [cls, fn] of PAIRS) {
    assert.ok(entryOf(cls).includes(fn), `_PANEL_BY_CLASS 에 ${cls} → ${fn} 배선이 없다 — 복원 뒤 패널이 어긋난다`);
    assert.ok(DRAG_CODE.includes(fn), `${fn} 이 block-drag.js 의 클릭 경로에 없다 — 표가 실재하지 않는 이름을 가리킨다`);
  }
  // .text-block 을 겸하는 타입(버블·라이너)이 있으므로 text-block 은 «맨 뒤»여야 한다
  const idxText = TABLE.indexOf("['text-block'");
  for (const [cls] of PAIRS) if (cls !== 'text-block') {
    assert.ok(TABLE.indexOf("['" + cls + "'") < idxText, `${cls} 가 text-block 보다 뒤에 있다 — 먼저 맞는 것이 이기므로 가려진다`);
  }
});

test('G9c 복원이 모서리 핸들도 «클릭 경로와 같은 입구»로 붙인다', () => {
  assert.match(RESTORE_SEL_BODY, /showHandlesFor/,
    '핸들을 안 붙이면 복원된 블럭이 «클릭했을 때와 다른» 상태가 된다(모서리 점 0개)');
});

test('G9d 행 핸들러가 클로저 인덱스를 «그대로» 쓰지 않는다 (정렬 뒤 엉뚱한 stop 덮어쓰기)', () => {
  /* 가드가 합성 input 으로 먼저 커밋(=정렬)하고 그 뒤 원래 change 가 같은 i 로 한 번 더 쓴다.
     보정표를 안 거치면 건드리지도 않은 이웃 stop 의 위치가 덮어써진다(조용한 데이터 손상). */
  assert.ok(!/STOP\(\)\[i\]/.test(GRADIENT_CODE),
    'STOP()[i] 직접 접근이 남아 있다 — 정렬로 줄 순서가 바뀌면 다른 stop 에 쓴다');
  assert.ok(!/arr\.splice\(i\s*,/.test(GRADIENT_CODE),
    'delBtn 이 보정 없이 splice(i) 한다 — 정렬 뒤엔 다른 stop 이 지워진다');
  assert.match(GRADIENT_CODE, /_modelIdxFor\(i,\s*row\)/, '보정표(_modelIdxFor) 경유가 없다');
});

test('G9e 누르고 있는 동안 재생성을 유예한다 + Enter 뒤 포커스를 되돌린다', () => {
  assert.match(GRADIENT_CODE, /_holdRebuild/, '×(stop 삭제) 버튼이 mouseup 전에 재생성으로 사라진다');
  assert.match(GRADIENT_CODE, /_deferredStops/, '유예한 재생성을 나중에 그리지 않는다');
  assert.match(GRADIENT_CODE, /alphaIn\.addEventListener\('keydown'/,
    'Enter 뒤 포커스 되돌리기 배선이 없다 — 가드의 blur 로 BODY 가 되면 다음 Backspace 가 블럭을 지운다');
  assert.match(GRADIENT_CODE, /offIn\.addEventListener\('keydown'/, '위치 칸도 같은 길이다');
});

test('G10 ★DOM 스펙의 «세척 스텁» 전제가 원문에 그대로 있다 (스텁이 조용히 낡지 않게)', () => {
  // tests/dom/undo-restore-selection.dom.spec.js 가 흉내내는 두 자리
  const code = codeOnly(SERIALIZE_SRC);
  assert.match(code, /RUNTIME_MARKER_CLS\s*=\s*\[[\s\S]*?'selected'/,
    "section-serialize.js 의 RUNTIME_MARKER_CLS 에서 'selected' 가 사라졌다 — 스냅샷 세척 전제가 바뀌었다");
  assert.match(code, /\.gradient-corner-handle/,
    'section-serialize.js 가 .gradient-corner-handle 을 더 이상 제거하지 않는다 — 스텁 전제가 바뀌었다');
});
