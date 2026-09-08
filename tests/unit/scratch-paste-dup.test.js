/* scratch-paste-dup.test.js — #16-DUP 「링크된 섹션을 붙여넣으면 스크래치도 같이 복제」의 «원문 게이트»
 * (2026-09-08 신설 · 현빈 발주 「링크체인이 2개가 생겨」)
 *
 * ★짝은 tests/dom/scratch-paste-link.dom.spec.js 다. 나눈 기준은 «못 얹는 파일»이다:
 *   js/scratch-pad.js · js/editor.js 는 ESM(import 문)이라 크로미움에 addScriptTag 로 못 얹는다
 *   ⇒ 그 둘의 «행동»은 DOM 쪽에서 대역으로만 서고, «원문»은 여기가 진다.
 *   그래서 이 파일이 겨누는 것은 «문장이 어디에 있느냐»다:
 *     ① rewire 를 DOM 삽입 «전»에 부르는가        ② 자가 가드를 안 베꼈는가
 *     ③ pushHistory 에 sideEffects 를 실었는가      ④ _createItem 에 7인자를 넘기는가
 *     ⑤ 재인코딩을 안 하는가                        ⑥ 별건(_scratchAddAndSave)을 안 건드렸는가
 *   그리고 «떼어낼 수 있는 것»(sideEffects)은 원문에서 떼어 실제로 돌린다(T-U1-6/6b/7).
 *
 * ⛔주석 거르기는 tests/unit/_strip-comments.js 의 makeStripper «만» 쓴다(자체 구현 금지).
 * ⛔고정 창(slice(i, i±N)) 금지 — 함수 몸통은 중괄호를 세어 떼어낸다.
 *
 * ★안 잰 것 (정직하게)
 *   · ★★js/editor.js 를 «실행»해서 재는 검사는 이 레포에 «0개»다 — tests/dom 의 spec 8개 중
 *     editor.js 를 얹는 것이 0건이고(2026-09-09 실측), editor.js 가 ESM 이라 addScriptTag 로 못 얹는다.
 *     ⇒ editor.js ↔ SPLink 이음매는 «텍스트 단언»이 전부다. 그 한계가 실제로 물린 사고가
 *       T-U1-1 주석에 적혀 있다(인덱스 비교만 있던 판에서 발주 버그가 통째로 통과했다).
 *   · 실앱에서 «로드 중 ⌘V» — _scratchLoaded 가 모듈 사설이라 못 만진다. 「안 쟀다」(지디 실기).
 *   · restoreSnapshot 이 페이지를 바꾼 «뒤» onUndo 가 불리는 실앱 «순서». 「안 쟀다」(지디 실기).
 *   · 사본이 화면에 «보이는가» — 렌더 없이 못 잰다. DOM 쪽 T-DOM-6/7 이 좌표까지만 잰다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(__dirname, '..', '..');
const RAW = {
  editor:  readSrc(ROOT, 'js', 'editor.js'),
  link:    readSrc(ROOT, 'js', 'scratchpad-link.js'),
  scratch: readSrc(ROOT, 'js', 'scratch-pad.js'),
  history: readSrc(ROOT, 'js', 'history.js'),
};
/** 주석을 걷어낸 판 — «문장이 있다/없다»는 전부 이쪽에서 센다(주석 속 금지어에 안 속게). */
const SRC = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, stripComments(v)]));

/* ── 중괄호를 세어 함수 몸통을 떼어내는 부품 (고정 창 금지) ────────────────── */
function _matchBrace(src, openIdx, label) {
  let depth = 0;
  for (let j = openIdx; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return j; }
  }
  assert.fail(`★"${label}" 의 몸통 끝을 못 찾았다`);
}
/** `function name(...)` 형태 — 헤더 뒤 첫 { 부터. */
function fnBody(src, header, label) {
  const i = src.indexOf(header);
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = src.indexOf('{', i + header.length - 1);
  assert.notStrictEqual(start, -1, `★"${label}" 의 몸통 시작 { 을 못 찾았다`);
  return src.slice(start + 1, _matchBrace(src, start, label));
}
/** `x = (…) => {` 형태 — ★인자 구조분해의 { 를 몸통으로 오인하지 않게 `=> {` 부터 센다. */
function arrowBody(src, needle, label) {
  const i = src.indexOf(needle);
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const a = src.indexOf('=> {', i);
  assert.notStrictEqual(a, -1, `★"${label}" 의 화살표 몸통을 못 찾았다`);
  const start = src.indexOf('{', a);
  return src.slice(start + 1, _matchBrace(src, start, label));
}
/** `name(` 호출의 «최상위» 인자 목록. 중첩 괄호를 세므로 `(it.x || 0) + dx` 가 안 쪼개진다. */
function callArgs(src, callee, label) {
  const i = src.indexOf(callee + '(');
  assert.notStrictEqual(i, -1, `★"${label}" 에서 ${callee}( 호출을 못 찾았다`);
  let depth = 0, j = i + callee.length, args = [''];
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '(') { depth++; if (depth === 1) continue; }
    else if (c === ')') { depth--; if (depth === 0) break; }
    else if (c === ',' && depth === 1) { args.push(''); continue; }
    args[args.length - 1] += c;
  }
  return args.map((s) => s.trim());
}

const PASTE = fnBody(SRC.editor, 'function pasteClipboard()', 'pasteClipboard');
const REWIRE = fnBody(SRC.link, 'function rewireClonedSection(el)', 'rewireClonedSection');
const DUP = arrowBody(SRC.scratch, 'window._scratchDuplicateItem =', '_scratchDuplicateItem');
const RESTORE = arrowBody(SRC.scratch, 'window._scratchRestoreItem =', '_scratchRestoreItem');
const ADDSAVE = arrowBody(SRC.scratch, 'window._scratchAddAndSave =', '_scratchAddAndSave');

// ══════════════════════════════════════════════════════════════════
test('T-U1-0 ★양성대조 — 네 파일을 «실제로» 읽고 있다 (아래의 「0건」이 못 읽어서가 아니다)', () => {
  assert.match(SRC.editor,  /function pasteClipboard\(\)/,             '★editor.js 를 못 읽고 있다');
  assert.match(SRC.link,    /function rewireClonedSection\s*\(/,       '★scratchpad-link.js 를 못 읽고 있다');
  assert.match(SRC.scratch, /window\._scratchDuplicateItem\s*=/,       '★scratch-pad.js 를 못 읽고 있다');
  assert.match(SRC.history, /sideEffects\?\.onUndo\?\.\(\)/,           '★history.js 를 못 읽고 있다');
  // ★주석 거르개가 실제로 걷어냈는가 — 안 걷어내면 아래 「금지어 0건」이 주석에 걸려 거짓 빨강이 난다
  assert.ok(RAW.link.includes('⛔`curSecId === sec.id` 자가 가드'.slice(1)) || RAW.link.includes('자가 가드'),
    '★원문에 자가 가드 «금지 주석»이 있어야 이 검사의 대조가 성립한다');
  assert.ok(!REWIRE.includes('자가 가드'), '★주석 거르개가 안 돌고 있다 — 몸통에 주석 문장이 남아 있다');
});

/* ★★T-U1-1 이 «문장 전체»를 박는 이유 — 인덱스 비교만으로는 발주 버그가 통째로 되살아난다.
 *
 * 2026-09-09 적대 검수가 실측으로 잡았고 Generator 가 재현했다. 이 «한 줄»만 바꾸면
 *   js/editor.js:1588
 *     원문 : _spl = window.SPLink?.rewireClonedSection?.(el) || null;
 *     변이A: _spl = window.SPLink?.rewireClonedSection?.(el.cloneNode(true)) || null;   (sha 52d36a3bd0de → 4c53b38f637b)
 *     변이B: queueMicrotask(() => { window.SPLink?.rewireClonedSection?.(el); });        (sha 52d36a3bd0de → 313bcb8e035a)
 * 전수가 «둘 다» 초록이었다 — npm test 1835 pass/0 fail · npm run test:dom 62 passed. 빨간 검사 ★0건.
 *
 * 변이A 가 실앱에서 하는 일(도달 조건 없음 — 링크된 섹션 ⌘C→⌘V 하면 «매번», ⌘D 도 같다):
 *   ⑴ rewire 가 «버려질 사본»을 받는다 → holder 는 여전히 살아있는 원본이라 truthy
 *   ⑵ _scratchDuplicateItem 이 «진짜로» 돈다 — ScratchPadDB 에 레코드가 생기고 이미지가 붙는다
 *   ⑶ 새 토큰은 «버려질 사본»에 적힌다 ⇒ 삽입되는 el 의 data-ref-links 는 sp_a:0 그대로
 *   ⇒ 현빈이 신고한 「링크체인 2개」 100% 재현 + 주인 없는 유령 이미지가 붙여넣기마다 한 장씩.
 *      ★고치기 «전»보다 나쁘다.
 * 변이B 는 텍스트 «순서»가 안 바뀐 채 «실행»만 삽입 뒤로 밀린다 = 계획서가 「제일 나쁜 종류」라 부른 판.
 *   ⚠️§Q6 의 「레이아웃이 아직 안 앉았다」가 다음 사람을 정확히 «비동기로 미루기» 쪽으로 유혹한다.
 *
 * 왜 셋이 다 못 잡았나 — 같은 방향으로 비어 있었다:
 *   ⑴ tests/dom 전수가 editor.js 에 «장님»이다(아래 한계 참조)
 *   ⑵ 인덱스 비교는 호출 «자리»만 본다 — 변이A 는 idx(rewireClonedSection)=3310 이 한 글자도 안 움직인다
 *   ⑶ T-U1-2 는 꼬리 pushHistory 만 본다 — 그 줄은 안 건드렸으니 통과
 *
 * ⛔그러니 「지나치게 빡빡하다」며 이 문장 단언을 인덱스 비교로 «되돌리지 마라».
 *   되돌리면 위 두 변이가 다시 통과하고, 그때 뚫리는 것은 스타일이 아니라 «발주 버그 그 자체»다.
 *   문장을 정당하게 바꿔야 한다면(예: 이름 변경) 이 단언의 기대 문자열을 같이 고치고,
 *   ★그 뒤 위 변이A·B 를 «직접 쳐서» 여전히 빨간지 확인해라. 그게 이 검사가 사는 조건이다.
 *
 * ★한계(명시) — 이건 «텍스트»를 본다. js/editor.js 를 «실행»해서 재는 검사는 이 레포에 0개다.
 *   근거(2026-09-09 실측): tests/dom 의 spec 8개 중 editor.js 를 얹는 것은 0건이다
 *   — modal-resize 는 소스를 «문자열로» 읽을 뿐이고, pad-hint 는 진짜 index.html 에서
 *     <script> 를 전부 걷어낸 뒤 필요한 모듈만 다시 얹는다(주석이 「editor.js 가 …줄줄이 넘어졌다」로
 *     그 이유를 적어 뒀다). editor.js 가 ESM 이라 addScriptTag 로 못 얹는 것이 근본 원인이다.
 *   ⇒ editor.js ↔ SPLink «이음매»에 대해 지금 가능한 최강이 이 텍스트 단언이다.
 *     ⛔「검사가 있으니 됐다」로 읽지 마라 — 실행 경로는 지디 실기(§6)가 진다. */
test('T-U1-1 ★★순서 — rewireClonedSection 은 DOM 삽입 «전»에 «el 그대로·동기로» 불린다', () => {
  /* ★본문 단언이 맨 앞 — 문장 전체를 박는다. 인자(el)·동기 호출·대입까지 한 덩어리로 봐야
     el.cloneNode(true) 나 queueMicrotask 감싸기가 걸린다(인덱스 비교는 둘 다 통과시켰다). */
  assert.ok(PASTE.includes('_spl = window.SPLink?.rewireClonedSection?.(el) || null;'),
    '★호출 «문장»이 바뀌었다 — 인자가 el 이 아니거나(el.cloneNode(true) 등) 콜백으로 감쌌으면 '
    + '(queueMicrotask/setTimeout/rAF) 삽입 «전» 판정이 죽는다. 그러면 사본은 만들어지는데 '
    + '새 토큰이 «버려질 객체»에 적히거나 삽입 뒤에 적혀서, 발주 버그(링크체인 2개)가 100% 되살아나고 '
    + '주인 없는 유령 이미지까지 쌓인다. 위 주석의 변이A/B 를 보라.');
  const iRewire = PASTE.indexOf('rewireClonedSection');
  const iAfter  = PASTE.indexOf('refSection.after(el)');
  const iAppend = PASTE.indexOf('canvasEl.appendChild(el)');
  assert.notStrictEqual(iRewire, -1, '★pasteClipboard 가 rewireClonedSection 을 «아예» 안 부른다');
  assert.ok(iRewire < iAfter,
    `★rewireClonedSection 호출이 refSection.after(el) «뒤»에 있다(${iRewire} > ${iAfter}) — `
    + '삽입 뒤에 부르면 sectionIdOf 가 사본 자신을 찾아 복제를 건너뛴다. '
    + '그 실패는 «사용자의 선택 상태»에 따라 갈려 손으로 눌러 보면 대체로 고쳐져 보인다.');
  assert.ok(iRewire < iAppend,
    `★rewireClonedSection 호출이 canvasEl.appendChild(el) «뒤»에 있다(${iRewire} > ${iAppend})`);
  // 전제(나중) — 두 삽입문이 실재해야 위 비교가 뜻을 갖는다
  assert.notStrictEqual(iAfter, -1, '★refSection.after(el) 을 못 찾았다 — 삽입 문이 바뀌었으면 이 검사부터 고쳐라');
  assert.notStrictEqual(iAppend, -1, '★canvasEl.appendChild(el) 을 못 찾았다');
});

test('T-U1-1b ⛔자가 가드 금지 — rewireClonedSection 몸통에 `=== sec.id` / `=== target.id` 가 0건', () => {
  for (const bad of ['=== sec.id', '=== target.id', '=== el.id']) {
    assert.ok(!REWIRE.includes(bad),
      `★addLink 의 관용구(${bad})를 여기 베꼈다 — 그 가드는 「대상 섹션이 이미 DOM 에 있다」를 전제한다. `
      + '여긴 정반대(분리 상태)라 사본이 자기 자신을 찾아 복제를 «건너뛴다».');
  }
  // 양성대조 — 이 needle 로 «1 이상»이 나오는 곳이 실제로 있다(0건이 「없는 문자열」이라서가 아니다)
  assert.ok(fnBody(SRC.link, 'function addLink(sectionId, scratchId)', 'addLink').includes('=== target.id'),
    '★addLink 에 그 관용구가 있어야 이 금지선의 대조가 성립한다');
});

test('T-U1-2 ★undo 배선 — 섹션 경로의 pushHistory("붙여넣기") 가 «둘째 인자»를 받는다', () => {
  const NEEDLE = "pushHistory('붙여넣기'";
  const first = PASTE.indexOf(NEEDLE);
  const last  = PASTE.lastIndexOf(NEEDLE);
  const tail  = PASTE.slice(last, last + 90);
  // ★본문 단언이 앞 — 이게 빨개지면 「undo 가 사본 이미지를 고아로 남긴다」는 뜻이다
  assert.match(tail, /pushHistory\('붙여넣기',\s*_spl\?\.sideEffects/,
    '★꼬리 pushHistory 가 sideEffects 를 안 싣는다 — 복사는 «이미지를 만드는» 조작이라 '
    + '캔버스 스냅샷만으론 undo 가 성립하지 않는다. ⌘Z 가 섹션만 지우고 사본 이미지가 고아로 남는다. '
    + `본 것: ${JSON.stringify(tail.split('\n')[0])}`);
  // ★멀티블록 분기는 «안» 건드린다(섹션이 안 들어오는 경로다)
  assert.match(PASTE.slice(first, first + 40), /pushHistory\('붙여넣기'\);/,
    '★멀티블록 분기의 pushHistory 를 건드렸다 — 그 경로엔 섹션이 안 들어온다(무접촉)');
  // 전제(나중)
  assert.ok(first !== -1 && last !== first, '★pushHistory("붙여넣기") 가 두 자리(멀티블록·꼬리)에 있어야 한다');
});

test('T-U1-3 ★7인자 — 두 신설 함수가 _createItem 에 linkDy 까지 «일곱» 개를 넘긴다', () => {
  const a = callArgs(DUP, '_createItem', '_scratchDuplicateItem');
  const b = callArgs(RESTORE, '_createItem', '_scratchRestoreItem');
  assert.strictEqual(a.length, 7, `★_scratchDuplicateItem 의 _createItem 인자가 ${a.length}개다: ${a.join(' | ')}`);
  assert.strictEqual(b.length, 7, `★_scratchRestoreItem 의 _createItem 인자가 ${b.length}개다: ${b.join(' | ')}`);
  assert.match(a[6], /linkDy/, '★7번째(linkDyArg)가 linkDy 가 아니다 — 앵커를 안 베끼면 undo 사이 섹션이 움직였을 때 이미지가 튄다');
  assert.match(b[6], /linkDy/, '★_scratchRestoreItem 의 7번째가 linkDy 가 아니다');
  assert.match(a[5], /^undefined$/, '★g(그룹)를 복제하고 있다 — 사본이 원본 그룹에 들어가면 _scratchUngroup 이 «둘의» 링크를 다 끊는다');
});

test('T-U1-3b ⛔별건 무접촉 — _scratchAddAndSave 는 오늘과 «동일»하다 (linkDy 누락은 BL-SPL-01)', () => {
  const args = callArgs(ADDSAVE, '_createItem', '_scratchAddAndSave');
  assert.deepStrictEqual(args, ['src', 'x', 'y', 'w', 'id', 'g'],
    '★_scratchAddAndSave 를 건드렸다 — 이 단위는 여기 «한 글자도» 안 댄다(지디 지시). '
    + 'linkDy 누락은 별건(BL-SPL-01)이고, 같이 고치면 그 회귀가 이 단위의 것으로 섞인다.');
  assert.match(ADDSAVE, /await _saveScratch\(\);/, '★_scratchAddAndSave 의 저장 문이 바뀌었다');
});

test('T-U1-4 ⛔형식 불변 — refLinks 파싱(lastIndexOf) 과 _write 조립을 안 건드렸다', () => {
  assert.ok(SRC.link.includes("const i = tok.lastIndexOf(':');"),
    "★_parse 의 lastIndexOf(':') 가 사라졌다 — indexOf 로 바꾸면 id 에 ':' 가 있을 때 토큰이 깨진다");
  const w = fnBody(SRC.link, 'function _write(sec, arr)', '_write');
  assert.ok(w.includes("l.scratchId + ':' + (l.collapsed ? '1' : '0')"),
    '★_write 의 토큰 조립이 바뀌었다 — collapsed 플래그가 죽으면 사본의 접힘 상태가 유실된다');
  assert.ok(w.includes(".join(',')"), '★_write 의 구분자(,)가 바뀌었다');
});

test('T-U1-5 ⛔재인코딩 금지 — 세 몸통에 toDataURL/_srcToPngDataUrl/assetsSaveCanvasImage 가 0건', () => {
  const BAD = ['toDataURL', '_srcToPngDataUrl', 'assetsSaveCanvasImage'];
  for (const [name, body] of [['_scratchDuplicateItem', DUP], ['_scratchRestoreItem', RESTORE], ['rewireClonedSection', REWIRE]]) {
    for (const b of BAD) {
      assert.ok(!body.includes(b),
        `★${name} 이 ${b} 를 쓴다 = 픽셀을 새로 만든다 ⇒ sha256 이 달라져 dedup 이 깨지고 디스크가 «진짜로» 2배가 된다. `
        + 'src 문자열을 그대로 공유해야 같은 파일을 가리킨다.');
    }
  }
  assert.ok(DUP.includes('const src = it.src;'), '★_scratchDuplicateItem 이 src 를 «그대로» 넘기는 문이 사라졌다');
  // 양성대조 — 이 needle 들은 이 레포에 «실재»한다(0건이 「없는 문자열」이라서가 아니다)
  for (const b of BAD) assert.ok(SRC.scratch.includes(b) || SRC.editor.includes(b), `★대조 실패 — ${b} 가 레포에 없다`);
});

/* ── T-U1-6/6b/7 : sideEffects 를 «원문에서 떼어» 실제로 돌린다 ────────────────
 * 하네스는 rewireClonedSection 이 «부르는» 최상위 선언을 원문에서 같이 싣는다
 * (_parse/_write/_num/_item/_curPageId + STACK_GAP). sectionIdOf 만 대역이다 —
 * 그건 document 를 훑는 문이라 노드엔 없다. 그 «행동»은 DOM 쪽 T-DOM-1/2 가 진다. */
function buildHarness() {
  const gap = SRC.link.match(/const STACK_GAP = (\d+);/);
  assert.ok(gap, '★STACK_GAP 상수를 못 찾았다 — 새 간격 상수를 만들지 마라(기존 것을 쓴다)');
  const src = [
    "const ATTR = 'refLinks';",
    `const STACK_GAP = ${gap[1]};`,
    'function _parse(sec) {' + fnBody(SRC.link, 'function _parse(sec)', '_parse') + '}',
    'function _write(sec, arr) {' + fnBody(SRC.link, 'function _write(sec, arr)', '_write') + '}',
    'function _num(v) {' + fnBody(SRC.link, 'function _num(v)', '_num') + '}',
    'function _item(id) {' + fnBody(SRC.link, 'function _item(id)', '_item') + '}',
    'function _curPageId() {' + fnBody(SRC.link, 'function _curPageId()', '_curPageId') + '}',
    'function rewireClonedSection(el) {' + REWIRE + '}',
    'return { rewireClonedSection, STACK_GAP };',
  ].join('\n');
  return new Function('window', 'console', 'sectionIdOf', src);
}

/** 노드용 «섹션» 대역 — _parse/_write 가 보는 면(dataset)만 세운다. */
function mkSec(id, refLinks) {
  return {
    id,
    dataset: refLinks ? { refLinks } : {},
    classList: { contains: (c) => c === 'section-block' },
    querySelectorAll: () => [],
  };
}
/** 노드용 ScratchPadDB 대역 + 호출 원장. */
function mkWorld({ heldBy = 'sec_orig', items = [{ id: 'sp_a', src: 'goya-asset://a', x: 100, y: 20, w: 80, linkDy: 7 }] } = {}) {
  const db = items.map((i) => Object.assign({}, i));
  const log = { removed: [], restored: [], warns: [] };
  let seq = 0;
  const win = {
    state: { currentPageId: 'p1' },
    _scratchItemById: (id) => db.find((s) => s.id === id) || null,
    _scratchSaveSoon: () => {},
    _scratchDuplicateItem: (srcId, { dx = 0, dy = 0 } = {}) => {
      const it = db.find((s) => s.id === srcId);
      if (!it) return { ok: false, code: 'NO_SOURCE' };
      const rec = { id: 'sp_d' + (++seq), src: it.src, x: it.x + dx, y: it.y + dy, w: it.w, linkDy: it.linkDy };
      db.push(rec);
      return { ok: true, item: Object.assign({}, rec) };
    },
    _scratchRestoreItem: (rec) => { log.restored.push(rec); db.push(Object.assign({}, rec)); return { ok: true }; },
    _scratchRemoveById: (id) => {
      log.removed.push(id);
      const k = db.findIndex((s) => s.id === id);
      if (k < 0) return false;
      db.splice(k, 1);
      return true;
    },
  };
  const con = { warn: (...a) => log.warns.push(a.join(' ')) };
  const holder = () => heldBy;
  return { win, con, holder, db, log };
}

test('T-U1-6 ★SE 를 «떼어» 돌린다 — onUndo 는 이번에 만든 id 를 전부 지우고 onRedo 는 되살린다', () => {
  const H = buildHarness();
  const W = mkWorld();
  const M = H(W.win, W.con, W.holder);
  const sec = mkSec('sec_copy', 'sp_a:0');
  const out = M.rewireClonedSection(sec);
  assert.strictEqual(out.dups.length, 1, '★복제가 안 일어났다 — 원본이 아직 쥐고 있으면 복제해야 한다');
  const madeIds = out.dups.map((d) => d.id);
  assert.strictEqual(W.db.length, 2);

  out.sideEffects.onUndo();
  assert.deepStrictEqual(W.log.removed, madeIds,
    `★onUndo 가 만든 id 를 안 지운다 — 사본 이미지가 주인 없이 남는다(고아). 지운 것: ${W.log.removed.join(',') || '(없음)'}`);
  assert.strictEqual(W.db.length, 1, '★onUndo 뒤 항목 수가 붙여넣기 전으로 안 돌아왔다');

  out.sideEffects.onRedo();
  assert.strictEqual(W.db.length, 2, '★onRedo 가 사본을 안 되살린다');
  // ★토큰도 새 id 로 바뀌었다 — 이게 「이미지 1 : 섹션 1」을 만든다
  assert.strictEqual(sec.dataset.refLinks, madeIds[0] + ':0');
});

test('T-U1-6b ★★id 불변식 — onRedo 가 되살리는 id 집합 == onUndo 가 지운 집합 (새 id 를 뽑으면 refLinks 가 死참조)', () => {
  const H = buildHarness();
  const W = mkWorld();
  const M = H(W.win, W.con, W.holder);
  const out = M.rewireClonedSection(mkSec('sec_copy', 'sp_a:0,sp_b:1'));
  // sp_b 는 db 에 없어 NO_SOURCE → 사본 1개만 생긴다(그 갈래도 같이 확인)
  out.sideEffects.onUndo();
  out.sideEffects.onRedo();
  assert.deepStrictEqual(
    W.log.restored.map((r) => r.id).sort(), W.log.removed.slice().sort(),
    '★redo 로 되살아난 id 가 undo 로 지운 id 와 다르다 — 캔버스 스냅샷의 refLinks 토큰이 그 id 를 부른다. 링크가 죽는다.');
  assert.ok(W.log.restored.every((r) => 'linkDy' in r), '★복원 레코드에 linkDy 가 안 실렸다');
  // ★원문 쪽 못: _scratchRestoreItem 은 id 를 «새로 뽑지 않는다»
  assert.ok(!RESTORE.includes('_genScratchId'),
    '★_scratchRestoreItem 이 _genScratchId 를 부른다 — 복원은 «기록된 id 그대로»여야 한다');
  assert.strictEqual(callArgs(RESTORE, '_createItem', '_scratchRestoreItem')[4], 'rec.id',
    '★_createItem 의 5번째(idArg)가 rec.id 가 아니다 — id 가 바뀌면 redo 뒤 링크가 죽는다');
});

test('T-U1-7 ★페이지 가드 — 다른 페이지에서 불리면 «지우지 않고» 경고한다', () => {
  const H = buildHarness();
  const W = mkWorld();
  const M = H(W.win, W.con, W.holder);
  const out = M.rewireClonedSection(mkSec('sec_copy', 'sp_a:0'));
  W.win.state.currentPageId = 'p2';                       // restoreSnapshot 이 페이지를 바꾼 뒤다
  out.sideEffects.onUndo();
  assert.deepStrictEqual(W.log.removed, [],
    '★다른 페이지인데 지웠다 — ScratchPadDB 는 페이지별 키라 못 찾고 조용히 false 가 난다. '
    + '모르는 상태에서 «지우는» 쪽은 되돌릴 수 없다(안 지우면 고아 하나가 남을 뿐).');
  assert.ok(W.log.warns.some((w) => w.includes('페이지가 다르다')),
    `★건너뛰고 «조용»했다 — 비정상 갈래는 소리를 내야 한다. 경고: ${JSON.stringify(W.log.warns)}`);
  W.win.state.currentPageId = 'p1';                       // 돌아오면 실제로 돌아야 한다(가드가 «막기만» 하면 안 된다)
  out.sideEffects.onUndo();
  assert.strictEqual(W.log.removed.length, 1);
});

test('T-U1-8 ★⌘D 도 «같은 문» — duplicateSelected 섹션 분기가 copySelected(); pasteClipboard(); 그대로', () => {
  const body = fnBody(SRC.editor, 'function duplicateSelected()', 'duplicateSelected');
  const i = body.indexOf('if (selSection) {');
  assert.notStrictEqual(i, -1, '★duplicateSelected 의 섹션 분기를 못 찾았다');
  const branch = body.slice(i, _matchBrace(body, body.indexOf('{', i), '섹션 분기') + 1);
  assert.match(branch, /copySelected\(\);\s*pasteClipboard\(\);/,
    '★⌘D 가 자기 복제 경로를 따로 갖게 됐다 — 그러면 이번 처방이 ⌘D 를 «안» 고친다');
});

test('T-U1-9 ★「로드 전」 갈래의 근거 — _loadScratch 는 첫 await «보다 앞»에서 _scratchItems 를 비운다', () => {
  const body = fnBody(SRC.scratch, 'async function _loadScratch(projectId, pageId)', '_loadScratch');
  const iClear = body.indexOf('_scratchItems = [];');
  const iAwait = body.indexOf('await ');
  assert.ok(iClear !== -1 && iAwait !== -1, '★_loadScratch 의 비움/await 문을 못 찾았다');
  assert.ok(iClear < iAwait,
    `★비움이 첫 await «뒤»로 갔다(${iClear} > ${iAwait}) — 그러면 로드 구간의 _scratchItemById 가 `
    + '«옛 아이템»을 돌려주고, 붙여넣기가 그 유령을 복제한다. 지금은 null 이라 토큰이 그대로 남는다.');
  /* ⚠️_scratchItemById 는 «중괄호가 없는» 한 줄 화살표다 — fnBody 로 떼면 다음 함수의 몸통을 집는다
     (실제로 그렇게 집혀 「_saveSoonTimer …」를 재고 있었다: 계측기가 엉뚱한 것을 잰 자리). 줄로 잰다. */
  assert.match(SRC.scratch, /window\._scratchItemById = id => _scratchItems\.find\([^\n]*\|\| null;/,
    '★_scratchItemById 가 「못 찾으면 null」이 아니게 됐다 — 그러면 로드 전 갈래가 NO_SOURCE 로 안 떨어진다');
});

test('T-U1-10 ★「N>1 은 오늘 없다」 — MULTI_SEL 에 .section-block 이 0건 · copySelected 는 querySelector(단수)', () => {
  const m = SRC.editor.match(/const MULTI_SEL = ([\s\S]*?);\n/);
  assert.ok(m, '★MULTI_SEL 선언을 못 찾았다');
  assert.ok(!m[1].includes('.section-block'),
    '★MULTI_SEL 에 .section-block 이 들어왔다 = 섹션 다중복사가 열렸다는 뜻이다. '
    + 'rewireClonedSection 은 이미 «섹션 집합»을 훑지만, copySelected/pasteClipboard 가 섹션을 N개 담게 되면 '
    + 'N>1 갈래를 «실제로» 재는 검사를 여기 세워야 한다(지금은 안 도는 갈래라 안 세웠다).');
  assert.ok(m[1].includes('.text-block.selected'), '★대조 실패 — MULTI_SEL 을 제대로 못 읽고 있다');
  const cs = fnBody(SRC.editor, 'function copySelected()', 'copySelected');
  assert.ok(cs.includes("document.querySelector('.section-block.selected')"),
    '★copySelected 가 섹션을 querySelectorAll(복수)로 담기 시작했다 — 위와 같은 이유로 검사를 늘려야 한다');
});
