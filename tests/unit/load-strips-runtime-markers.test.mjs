/* load-strips-runtime-markers.test.mjs — C③ 「열기 경로도 런타임 마커를 벗긴다」의 ★구조 게이트
 * (2026-10-09 신설)
 *
 * ★왜 ★구조로 잠그나 — 이 병은 ★«행위»로 재기 어렵다. DOM 쪽 C3c 가 ★한 문
 *   (applyProjectData)만 밟는다. 나머지 두 문(switchPage·deletePage)은 하네스의 electronAPI
 *   가 가짜라 ★끝까지 못 밟는다. 그래서 「세 문이 ★전부 같은 한 벌을 부르나」는 여기가 진다.
 *
 * ★막는 사고(실측된 그 꼴, 2026-10-09):
 *   열기 세 문이 ★갈려 있었다 — switchPage 만 img-editing·sec-bg-editing 을 ★손으로 벗기고
 *   deletePage·applyProjectData 는 ★안 벗겼다. ⇒ ★어느 문으로 열었나에 따라 남는 마커가 달랐다.
 *   그 상태에서 multi-selected 가 샌 파일을 열면 상자선택의 섹션 길이 그 섹션을 ★영구히 건너뛴다.
 *
 * ★기대값의 출처 — ⛔피검 대상에서 ★읽어오지 않는다. 아래 수(3)·금지 낱말은 ★이 파일에 ★손으로
 *   적은 리터럴이다. 그래서 제품 코드를 죽이면 ★빨개진다(기대값이 같이 움직이지 않는다).
 *
 * ★안 잰 것 (정직하게)
 *   · 「벗긴 ★결과」가 화면에서 맞나 — ★여기선 안 잰다. tests/dom/multisel-save-and-copy.dom.spec.js
 *     C3c 가 ★행위로 잰다(applyProjectData 한 문에 대해서만).
 *   · switchPage·deletePage 를 ★실제로 돌린 결과 — ★안 쟀다(하네스 사각지대).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SL = fs.readFileSync(path.join(ROOT, 'js/io/save-load.js'), 'utf8');
const SS = fs.readFileSync(path.join(ROOT, 'js/io/section-serialize.js'), 'utf8');

/** 중괄호를 세어 함수 몸통을 떼어낸다(⛔고정 창 slice 금지). */
function fnBody(src, header) {
  const i = src.indexOf(header);
  assert.notStrictEqual(i, -1, `★헤더를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라: ${header}`);
  let j = src.indexOf('{', i);
  assert.notStrictEqual(j, -1, `★여는 중괄호를 못 찾았다: ${header}`);
  let depth = 0, start = j;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start + 1, j); }
  }
  assert.fail(`★몸통이 안 닫힌다: ${header}`);
}

const LOAD_LINE = 'canvasEl.innerHTML = sanitizeCanvasHtml(';
const STRIP_CALL = 'stripLoadedRuntimeState(canvasEl);';

test('L0 ★양성대조 — 두 파일을 «실제로» 읽고 있다(아래 수가 못 읽어서 나온 것이 아니다)', () => {
  assert.ok(SL.length > 10000, `★save-load.js 가 ${SL.length}자 — 못 읽었다`);
  assert.ok(SS.length > 5000, `★section-serialize.js 가 ${SS.length}자 — 못 읽었다`);
  assert.ok(SL.includes(LOAD_LINE), '★열기 줄 자체를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
});

test('L1 ★★열기 문이 «전부» 세척을 부른다 — 하나도 빠지지 않는다', () => {
  /* 열기 줄의 자리를 모두 모은다. 각 줄 «뒤»에 세척 호출이 와야 한다.
     ★판정을 「개수가 같다」로 하지 않는다 — 그러면 한 문이 두 번 부르고 다른 문이 0번
       불러도 통과한다. ★문마다 «그 뒤 200자 안»에 호출이 있는지로 센다. */
  const sites = [];
  for (let i = SL.indexOf(LOAD_LINE); i !== -1; i = SL.indexOf(LOAD_LINE, i + 1)) sites.push(i);

  // ★전제 — 이 수는 이 파일에 손으로 적은 리터럴이다(⛔제품에서 읽어오지 않는다).
  assert.ok(sites.length >= 3,
    `★열기 문이 ${sites.length}개뿐이다 — 3개(switchPage·deletePage·applyProjectData)를 기대했다. `
    + '문이 줄었으면 이 검사부터 고쳐라(줄어든 것이 맞는지 먼저 재라).');

  const missing = sites.filter(i => !SL.slice(i, i + 200).includes(STRIP_CALL));
  assert.deepStrictEqual(missing, [],
    `★세척을 안 부르는 열기 문이 ${missing.length}개 있다(문자 자리: ${missing.join(', ')}) — `
    + '그 문으로 열면 저장물에 샌 런타임 마커가 라이브 DOM 에 그대로 남는다. '
    + 'multi-selected 가 남으면 상자선택의 섹션 길(js/scratch-pad.js)이 그 섹션을 영구히 건너뛴다.');
});

test('L2 ★★명부를 «베끼지» 않는다 — 세척 한 벌에 클래스 이름이 손으로 적혀 있지 않다', () => {
  const body = fnBody(SL, 'function stripLoadedRuntimeState(root)');
  /* ⛔이 낱말들은 section-serialize.js 의 RUNTIME_MARKER_CLS 가 쥔다. 여기 적으면 넷째 명부다.
     (라벨 둘은 마커가 아니라 «요소 제거» 대상이라 예외 — 그 둘은 여기가 정본이다.) */
  const BANNED = ['multi-selected', 'img-editing', 'sec-bg-editing', 'cell-selected',
    'group-selected', 'row-active', 'dragging', 'hovered', 'line-selected'];
  const copied = BANNED.filter(w => body.includes(w));
  assert.deepStrictEqual(copied, [],
    `★세척 한 벌이 마커 이름을 손으로 들고 있다: ${copied.join(', ')} — `
    + 'section-serialize.js 의 RUNTIME_MARKER_CLS 에서 파생해야 한다(window.runtimeMarkers). '
    + '여기 적으면 그 목록이 늘어난 날 조용히 갈린다.');

  assert.ok(body.includes('window.runtimeMarkers'),
    '★단일 진실원(window.runtimeMarkers)에서 파생하지 않는다 — 목록을 어디선가 베끼고 있다는 뜻이다.');
});

test('L3 ★파생의 «짝»이 실재한다 — section-serialize.js 가 그 한 벌을 실제로 내놓는다', () => {
  assert.ok(SS.includes('window.runtimeMarkers = {'),
    '★section-serialize.js 가 window.runtimeMarkers 를 안 내놓는다 — L2 의 파생이 런타임에 터진다.');
  assert.ok(SS.includes('stripRuntimeMarkers'),
    '★stripRuntimeMarkers 가 없다 — save-load.js 가 부르는 이름이 사라졌다.');
  /* ★그 목록이 multi-selected 를 «실제로» 쥐고 있나 — C③ 의 본문이다.
     ⛔이 기대값은 이 파일의 리터럴이다(제품의 배열을 파싱해 «자기 자신»과 견주지 않는다 — 그러면 항등식이다). */
  const i = SS.indexOf('RUNTIME_MARKER_CLS = [');
  assert.notStrictEqual(i, -1, '★RUNTIME_MARKER_CLS 선언을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const arr = SS.slice(i, SS.indexOf('];', i));
  assert.ok(arr.includes("'multi-selected'"),
    '★RUNTIME_MARKER_CLS 에서 multi-selected 가 빠졌다 — 저장물·undo 스냅샷에 다시 샌다(C③ 본문).');
  /* ★음성대조 — 이 자(목록 안을 보는 것)가 «아무 낱말이나» 참이라고 하지 않는다. */
  assert.ok(!arr.includes("'definitely-not-a-marker'"),
    '★이 자가 목록에 없는 낱말도 참이라 한다 — 창(slice)이 잘못 잡혔다는 뜻이다.');
});
