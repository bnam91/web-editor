/* U-SCRATCHDROPSIZE — 스크래치패드에서 섹션으로 넣을 때 «보이던 크기 그대로»인가.
 *   (현빈 신고 2026-09-20: 「스크래치패드에서 섹션에 들어갈때, 스크래치패드와 다른 크기로
 *    들어가는 이슈」)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★무엇이 결함이었나 (dev@20e50e3, 헤드리스 크로미움 실측)
 *   스크래치 표시폭 220px 짜리가 섹션에 796px(3.62배)로 들어갔다. 비율(440:330)은 지켜지고
 *   «절대 크기»만 커진다 — 신고 문장과 정확히 일치.
 *   원인은 «호출 경계»다: scratch-pad.js 가 commitScratchDropAt 에 naturalWidth/Height 만
 *   넘기고 «표시폭(item.w)»을 안 넘겼다 ⇒ 받는 쪽은 폭을 정할 근거가 없어 CSS
 *   `.asset-block{width:100%}` 에 맡겼고, applyAspectSync 는 그 offsetWidth 를 «읽어»
 *   높이만 계산했다. 캔버스 좌표계 문제가 아니다 — .scratch-item 은 #canvas-scaler 의
 *   자식이라 #canvas 와 «같은 px 공간»이다(줌 보정 불필요).
 *
 * ★이 파일이 막는 «세» 가지 변이
 *   ⑴ 호출자가 width 를 다시 «안» 넘기는 것 (S-1)
 *   ⑵ 받는 쪽 두 분기(insert·newsection) 중 «한쪽만» 고치는 것 (S-2) ← 프로토타입이 놓쳤던 자리
 *   ⑶ 순서 계약(폭 확정 → 높이 계산)이 뒤집히는 것 (S-3)
 *   ⑷ 옵트인이 아니게 되어 자산패널 드롭까지 폭이 박히는 것 (S-4, ★음성대조)
 *
 * ⚠️여기는 «소스 대조»까지다. 진짜 폭·높이 px 는 tests/dom/scratch-drop-size.dom.spec.js 가
 *   크로미움에서 잰다. 그 파일은 `npm test` 스위트에 «안» 들어가므로 변이를 빨갛게 만드는
 *   책임은 이 파일이 진다(같은 규약: modal-variant.dom.spec.js 머리말).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(__dirname, '..', '..');
const SRC = {
  pad:    stripComments(readSrc(ROOT, 'js', 'scratch-pad.js')),
  drop:   stripComments(readSrc(ROOT, 'js', 'canvas-scratch-drop.js')),
  assets: stripComments(readSrc(ROOT, 'js', 'panels', 'assets-panel.js')),
};

/* ── 중괄호를 세어 몸통을 떼어낸다 (고정 창 금지 — 선례 scratch-section-delete.test.js) ── */
function _matchBrace(src, openIdx, label) {
  let depth = 0;
  for (let j = openIdx; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return j; }
  }
  assert.fail(`★"${label}" 의 몸통 끝을 못 찾았다`);
}
function fnBodyByName(src, name, label) {
  const i = src.indexOf('function ' + name + '(');
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = src.indexOf('{', src.indexOf(')', i));
  assert.notStrictEqual(start, -1, `★"${label}" 의 몸통 시작 { 을 못 찾았다`);
  return src.slice(start + 1, _matchBrace(src, start, label));
}

/** `commitScratchDropAt(...)` «호출»의 인자 덩어리를 전부 긁어 온다.
 *  ⚠️선언(`function commitScratchDropAt(`)은 제외한다. 대입/export 는 뒤에 `(` 가 안 와서
 *    자연히 빠진다 — 「앞 글자가 . 이면 호출이 아니다」 같은 판정을 쓰면
 *    `window.commitScratchDropAt?.(…)` 라는 «진짜 호출»을 놓친다(초판이 그랬다). */
function callArgs(src) {
  const out = [];
  const re = /(function\s+)?commitScratchDropAt\s*(\?\.)?\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1]) continue;                 // 선언
    const open = re.lastIndex - 1;
    let depth = 0, j = open;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) break; }
    }
    out.push(src.slice(open + 1, j));
    re.lastIndex = j;
  }
  return out;
}

/* ══ S-1 «보이던 폭»이 호출 경계에서 안 버려진다 ══ */

test('S-1 scratch-pad 의 드롭 커밋이 width 를 넘긴다', () => {
  // ★음성대조: dev@20e50e3 은 naturalWidth/naturalHeight/requireArm 셋만 넘겼다 ⇒ 되돌리면 빨강.
  const calls = callArgs(SRC.pad).filter(a => /requireArm/.test(a));
  assert.equal(calls.length, 1,
    `scratch-pad 의 드롭 커밋 호출이 1건이 아니다(${calls.length}건) — 경로가 늘었으면 이 검사부터 고쳐라`);
  assert.match(calls[0], /\bwidth\s*:/,
    '★드롭 커밋이 width(스크래치 표시폭)를 안 넘긴다 — 받는 쪽이 폭을 정할 근거가 없어 풀폭으로 들어간다');
  assert.match(calls[0], /width\s*:\s*item\.w\b/,
    'width 의 출처가 item.w 가 아니다 — 표시폭은 item.w 한 곳에만 산다');
});

/* ══ S-2 ★받는 쪽 «두» 분기 모두 — 한쪽만 고치면 반쪽 수정 ══ */

test('S-2 ★insert·newsection 두 분기 모두 폭 적용 헬퍼를 부른다', () => {
  const body = fnBodyByName(SRC.drop, 'commitScratchDropAt', 'commitScratchDropAt');
  assert.match(body, /const\s+applyScratchWidth\s*=/,
    '폭 적용 헬퍼(applyScratchWidth)가 없다');

  // 분기 몸통을 «잘라» 각각 센다 — 전체에 1건만 있어도 초록이 되면 반쪽 수정을 못 잡는다
  const iIns = body.indexOf(`decision.kind === 'insert'`);
  const iBg  = body.indexOf(`decision.kind === 'sectionbg'`);
  const iNew = body.indexOf(`decision.kind === 'newsection'`);
  assert.ok(iIns > -1 && iBg > iIns && iNew > iBg, '분기 순서가 바뀌었다 — 이 검사부터 고쳐라');
  const insertBranch = body.slice(iIns, iBg);
  const newsecBranch = body.slice(iNew);

  assert.match(insertBranch, /applyScratchWidth\s*\(/,
    '★insert 분기(기존 섹션에 끼워넣기)가 폭을 안 쓴다');
  assert.match(newsecBranch, /applyScratchWidth\s*\(/,
    '★newsection 분기(캔버스 빈 곳 드롭)가 폭을 안 쓴다 — 섹션 안은 맞는데 빈 곳은 여전히 커지는 반쪽 수정');
});

test('S-3 ★순서 계약: 폭 확정이 «높이 계산보다 앞»이다', () => {
  /* applyAspectSync 는 높이를 block.offsetWidth 에서 «읽어» 계산한다 ⇒ 폭이 먼저여야 한다.
     뒤집히면 폭만 바뀌고 높이는 풀폭 기준으로 남아 비율이 깨진다. */
  const body = fnBodyByName(SRC.drop, 'commitScratchDropAt', 'commitScratchDropAt');
  assert.match(body, /block\.offsetWidth/,
    'applyAspectSync 가 offsetWidth 를 안 읽는다 — 순서 계약의 전제가 바뀌었으면 이 검사부터 고쳐라');
  for (const [label, branch] of [
    ['insert', body.slice(body.indexOf(`decision.kind === 'insert'`), body.indexOf(`decision.kind === 'sectionbg'`))],
    ['newsection', body.slice(body.indexOf(`decision.kind === 'newsection'`))],
  ]) {
    const w = branch.indexOf('applyScratchWidth(');
    const a = branch.indexOf('applyAspectSync(');
    assert.ok(w > -1 && a > -1, `${label} 분기에 두 호출이 다 있어야 한다`);
    assert.ok(w < a,
      `★${label}: 폭 적용이 높이 계산 «뒤»로 갔다 — 높이가 풀폭 기준으로 남아 비율이 깨진다`);
  }
});

/* ══ S-4 ★음성대조 — 옵트인 계약 ══ */

test('S-4 ★음성대조: 자산패널→캔버스 드롭은 width 를 «안» 넘긴다', () => {
  /* 자산패널에는 넘길 «표시폭»이 없다(패널 썸네일은 캔버스 px 가 아니다).
     이 경로의 풀폭 동작이 «안 바뀌는 게» 계약이다. width 를 넘기는 순간 빨강. */
  const calls = callArgs(SRC.assets);
  assert.ok(calls.length >= 1, '자산패널의 commitScratchDropAt 호출을 못 찾았다 — 이 검사부터 고쳐라');
  for (const a of calls) {
    assert.doesNotMatch(a, /\bwidth\s*:/,
      '★자산패널 드롭이 width 를 넘긴다 — 옵트인 계약이 깨졌다(이 경로는 풀폭이 정답)');
  }
});

test('S-5 폭을 px 로 잠그면 usePadx 표식도 같이 찍는다 — 패널이 거짓말 안 하게', () => {
  const body = fnBodyByName(SRC.drop, 'commitScratchDropAt', 'commitScratchDropAt');
  const i = body.indexOf('const applyScratchWidth');
  const helper = body.slice(i, body.indexOf('const applyAspectSync'));
  assert.match(helper, /parentElement/,
    '부모 clientWidth 로 «재지» 않는다 — 860 같은 리터럴을 새로 적으면 섹션 padX 를 못 따라간다');
  assert.doesNotMatch(helper, /\b860\b/, '★폭 리터럴 860 을 새로 적었다 — 부모에서 재라');
  assert.match(helper, /dataset\.usePadx\s*=\s*'false'/,
    'usePadx 표식을 안 찍는다 — 우측패널의 「좌우여백 제외」가 화면과 다른 말을 한다');
  assert.match(helper, /alignSelf/,
    'alignSelf 를 안 준다 — px 폭 블록이 왼쪽에 붙는다(prop-asset.applyW 와 같은 관용구여야 한다)');
});
