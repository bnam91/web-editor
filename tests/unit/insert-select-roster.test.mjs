/* insert-select-roster — 삽입 «선택 따라가기»(js/insert-select.js) 의 전제가 안 썩게 잠근다.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★왜 있나 (T-084, 2026-09-22)
 *   「배너 안의 한 줄을 고른 채 도구막대로 블럭을 넣으면 파란 테두리가 옛 배너 줄에 남고
 *    새 블럭엔 안 붙는다」 — 1차 고침(4693c0d)은 js/block-edit.js 의 selectBlock 을 고쳤지만,
 *   그건 «selectBlock 을 부르는 입구»에만 닿았다. 실측(9639, 앱 실행) 삽입 입구 41자리 중
 *   12자리가 새 블럭을 아예 안 골랐다. 그래서 입구를 «자동 로스터»로 훑는 자리를 새로 뒀다.
 *   그 고침이 계속 맞으려면 넷이 안 썩어야 한다:
 *     ⒜ 로스터를 «베껴 적지 않는다» — 정본은 js/insert-history.js 하나다.
 *     ⒝ script 순서 — insert-history «다음»이어야 로스터가 채워져 있다.
 *     ⒞ 「무엇이 선택됐나」를 여기서 정하지 않는다 — selectBlock 한 자리에 맡긴다.
 *     ⒟ 동기다 — 미루면 그 사이 사용자의 다음 클릭이 선택을 뺏긴다.
 *
 * ⚠️이 검사는 «소스 문자열»을 본다. 정상적인 리팩터링에도 빨강이 날 수 있다 — 그때는 지우지
 *   말고 js/insert-select.js 머리말의 규약 ①~⑥ 이 여전히 성립하는지 확인한 뒤 패턴을 고쳐라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');

const IS_PATH = 'js/insert-select.js';
const IS   = readSrc(REPO, IS_PATH);
const IS_CODE = stripComments(IS);          // ⛔경고 주석이 검사를 빨갛게 만들지 않게
const INDEX = readSrc(REPO, 'index.html');
const PD   = readSrc(REPO, 'js/panel-dispatch.js');
const BE   = readSrc(REPO, 'js/block-edit.js');
const SER  = readSrc(REPO, 'js/io/section-serialize.js');
const PS   = readSrc(REPO, 'js/props/prop-section.js');

/* ═══ 게이트 U — 로스터를 베껴 적지 않았다 ════════════════════════════════ */

test('U1 ★로스터의 정본은 js/insert-history.js 하나다 — insert-select 는 «받아 쓴다»', () => {
  assert.ok(IS_CODE.includes('window.__insertSeamRoster'),
    'js/insert-select.js 가 __insertSeamRoster 를 안 쓴다 — 로스터를 스스로 세기 시작하면 목록이 둘이 된다');
  /* 스스로 세는 흔적 = 입구 패턴/특례를 여기에 적은 것. 둘이 되는 순간 한쪽이 낡는다. */
  assert.ok(!/\/\^add\[A-Z\]/.test(IS_CODE),
    'js/insert-select.js 안에 입구 이름 패턴(/^add[A-Z].../)이 «또» 있다 — 정본은 insert-history 의 MATCH 다');
  for (const n of ['addSection', 'addPresetRow', 'addTextBlock', 'addAssetBlock']) {
    assert.ok(!IS_CODE.includes(n),
      `js/insert-select.js 가 입구 이름 «${n}» 을 직접 적었다 — 입구별 특례는 여기 있으면 안 된다`);
  }
});

test('U2 ★index.html — insert-select 는 «정확히 한 개», 플레인, insert-history «다음»', () => {
  const tags = [...INDEX.matchAll(/<script([^>]*)src="js\/insert-select\.js"[^>]*>/g)];
  assert.equal(tags.length, 1, `script 태그가 ${tags.length}개다 — 조용히 빠지면 고침이 통째로 없는 것과 같다`);
  assert.ok(!/type\s*=\s*"module"/.test(tags[0][0]),
    `insert-select 는 플레인 스크립트여야 한다(module 이면 실행 순서가 바뀐다): ${tags[0][0]}`);
  const iHist = INDEX.indexOf('src="js/insert-history.js"');
  const iSel  = INDEX.indexOf('src="js/insert-select.js"');
  assert.ok(iHist !== -1, 'js/insert-history.js script 태그가 없다 — 로스터 정본이 사라졌다');
  assert.ok(iSel > iHist,
    'js/insert-select.js 가 js/insert-history.js «앞»에 있다 — __insertSeamRoster 가 아직 없어 «0자리»로 조용히 설치된다');
});

/* ═══ 게이트 V — 「무엇이 선택됐나」를 여기서 정하지 않는다 ═══════════════ */

test('V1 ★선택 클래스를 «직접» 붙이지 않는다 — 정본은 selectBlock 한 자리다', () => {
  /* 직접 붙이면 T-084 1차 고침이 모은 «표시 두 벌»(배너 줄·그리드 줄·레이어 .active)이
     이 파일 안에서 되살아난다. clearSelectionMarks 를 «또» 부르는 것도 같은 병이다. */
  assert.ok(!/classList\.add\(\s*['"]selected/.test(IS_CODE),
    'js/insert-select.js 가 .selected 를 직접 붙인다 — window.selectBlock 에 맡겨라');
  assert.ok(!IS_CODE.includes('clearSelectionMarks'),
    'js/insert-select.js 가 해제를 직접 한다 — selectBlock 안에서 이미 한다(두 번 하면 어긋난다)');
  assert.ok(IS_CODE.includes('window.selectBlock'),
    'js/insert-select.js 가 window.selectBlock 을 안 부른다 — 그럼 고침이 통째로 없다');
});

test('V2 ★「블럭인가」 판정을 베껴 적지 않는다 — getBlockById 에 묻는다', () => {
  assert.ok(IS_CODE.includes('window.getBlockById'),
    'js/insert-select.js 가 getBlockById 를 안 쓴다 — 판정을 베끼면 «고를 수 있다고 보고 selectBlock 은 false» 가 된다');
  assert.ok(!/dataset\.type/.test(IS_CODE),
    'js/insert-select.js 가 dataset.type 으로 «직접» 판정한다 — 그 조건은 getBlockById 의 것이고 실제로 어긋난 적이 있다(asset/icon-text/label-group)');
});

test('V3 ★동기다 — 선택 옮기기를 미루지 않는다 (규약 ⑥)', () => {
  for (const pat of ['setTimeout', 'requestAnimationFrame', 'queueMicrotask', 'Promise', 'async ', 'await ']) {
    assert.ok(!IS_CODE.includes(pat),
      `js/insert-select.js 가 «${pat}» 로 선택을 미룬다 — 그 사이 사용자의 다음 클릭이 선택을 뺏는다`);
  }
});

test('V4 ★깊이 0 에서만 고른다 (규약 ③ — 조립자가 N번 불러도 한 번)', () => {
  assert.ok(/_depth\s*===\s*0/.test(IS_CODE),
    'js/insert-select.js 에 깊이 0 판정이 없다 — AI 섹션 채우기가 블럭마다 패널을 깜빡이게 한다');
});

/* ═══ 게이트 W — 이 고침이 «저장·내보내기»에 새지 않는 근거 ═══════════════ */

test('W1 ★.selected 는 직렬화에서 벗겨진다 — 선택을 더 붙여도 배송본은 그대로', () => {
  /* 이게 깨지면 「삽입할 때마다 .selected 가 하나씩 더 붙는다」가 곧바로 저장본 오염이 된다.
     행동 축은 tests/dom/export-deliverable-leak.dom.spec.js 가 따로 잰다. */
  const m = /const RUNTIME_MARKER_CLS = \[([\s\S]*?)\];/.exec(SER);
  assert.ok(m, 'js/io/section-serialize.js 의 RUNTIME_MARKER_CLS 를 못 찾았다 — 이 검사가 늙었다');
  assert.ok(/(^|[^-\w])'selected'/.test(m[1]),
    "RUNTIME_MARKER_CLS 에 'selected' 가 없다 — 삽입 선택이 저장·내보내기로 샌다");
});

/* ═══ 게이트 X — 「블럭인가」 판정의 정본이 «표 하나»다 ═══════════════════ */

test('X1 ★panel-dispatch 의 판정은 «같은 표»를 읽는다 (사본 금지)', () => {
  assert.equal([...PD.matchAll(/_PANEL_BY_CLASS\s*=\s*\[/g)].length, 1,
    'js/panel-dispatch.js 에 패널 표가 둘이다 — 하나가 낡는다(T-079 가 그 병이었다)');
  const fn = /function hasPanelForBlock\(el\)\s*\{([\s\S]*?)\n\}/.exec(PD);
  assert.ok(fn, 'js/panel-dispatch.js 에 hasPanelForBlock 이 없다 — getBlockById 가 기대는 자리다');
  assert.ok(fn[1].includes('_PANEL_BY_CLASS'),
    'hasPanelForBlock 이 표를 안 읽는다 — 클래스 목록을 따로 적었으면 지우고 표를 읽어라');
});

test('X2 ★getBlockById 는 dataset.type «만»으로 판정하지 않는다 (asset/icon-text/label-group)', () => {
  const fn = /function getBlockById\(id\)\s*\{([\s\S]*?)\n\}/.exec(BE);
  assert.ok(fn, 'js/block-edit.js 의 getBlockById 를 못 찾았다 — 이 검사가 늙었다');
  assert.ok(fn[1].includes('hasPanelForBlock'),
    'getBlockById 가 dataset.type 만 본다 — dataset.type 이 «없는» 블럭 셋(.asset-block·.icon-text-block·.label-group-block)이 영영 선택되지 않는다(2026-09-22 실측)');
});

/* ═══ 게이트 Y — 늦게 도착한 섹션 패널이 «더 최신 선택»을 덮지 않는다 ═══════
 * showSectionProperties 는 async 다(await _presetsReady). 삽입 입구 둘
 * (addDeviceMockupBlock · addPresetRow)이 selectSection 을 부르고 동기로 돌아간 뒤
 * 선택이 새 블럭으로 옮겨가는데, 늦게 도착한 섹션 패널이 그걸 덮었다
 * (실측 9639 2026-09-22: 동기 시점 패널 = mkp_… → +50ms = sec_…).
 * ⇒ 「부를 때는 선택돼 있었는데 기다리는 사이 아니게 됐으면» 접는다. */
test('Y1 ★showSectionProperties 는 await «전»에 선택을 기억하고 «뒤»에 접는다', () => {
  const m = /async function showSectionProperties\(sec\)\s*\{([\s\S]*?)\n\}/.exec(PS);
  assert.ok(m, 'js/props/prop-section.js 의 showSectionProperties 를 못 찾았다 — 이 검사가 늙었다');
  const body = m[1];
  const iCap  = body.indexOf('const _wasSelected');
  const iAwt  = body.indexOf('await _presetsReady');
  const iBail = body.indexOf("if (_wasSelected && !sec.classList.contains('selected')) return;");
  assert.ok(iCap  !== -1, '선택 기억(_wasSelected)이 없다 — 늦게 온 섹션 패널이 새 블럭 패널을 덮는다');
  assert.ok(iAwt  !== -1, 'await _presetsReady 를 못 찾았다 — 이 검사가 늙었다');
  assert.ok(iBail !== -1, '늦게 온 렌더를 접는 줄이 없다');
  assert.ok(iCap < iAwt,  '선택을 await «뒤»에 기억하면 항상 최신값이라 아무것도 못 막는다');
  assert.ok(iAwt < iBail, '접는 판정이 await «앞»에 있으면 기다리는 사이의 변화를 못 본다');
});
