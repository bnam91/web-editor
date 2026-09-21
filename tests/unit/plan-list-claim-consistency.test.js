/* plan-list-claim-consistency.test.js — [T-064] 「목록에 안 뜬다」고 «말하는 문장»이
 * 실제 목록 동작과 어긋나 있으면 빨개진다.
 *
 * ★무엇이 있었나 (실측 2026-09-22, 격리 9630 실앱 · admin · 기준 12865a1):
 *   ·  디스크: prof-T064/projects/plan_1790021811697/ 1개
 *   ·  projects:list → 1건 ["plan_1790021811697:planning"] · 카드 1개 · 배지 "📋 기획"
 *   ·  카드 클릭 → planning.html?project=plan_1790021811697 (관리자 화면까지 떴다)
 *   ·  이름변경 ok · 삭제 ok(휴지통 30일) · 되살리기 ok → 다시 카드 1개
 *   ⇒ 목록 결함(T-064)은 fbc0532 로 «이미» 고쳐져 있었다.
 *   그런데 화면은 아직 옛말을 하고 있었다 — New Plan 단추 툴팁이
 *   「준비 중 — 만든 기획 프로젝트가 아직 프로젝트 목록에 뜨지 않습니다」,
 *   createPlanningProject 의 console.warn 이 「(T-064 해결 전까지)」.
 *   둘 다 «고쳐진 결함을 아직 있다고» 말한다.
 *
 * ★왜 검사로 잠그나: 이건 오타가 아니라 «검사처럼 생긴 문장»이다. 관리자는 단추를 누르기 전에
 *   툴팁부터 읽는다 — 거기서 「목록에 안 뜬다」를 읽으면 고쳐진 것을 다시 조사한다(같은 조사 두 번).
 *   문구는 사람이 고치는 것이고, 사람은 «동작이 바뀐 날» 문구를 같이 안 고친다.
 *
 * ★★두 방향으로 실패한다(게이트가 한쪽만 재면 반쪽이다):
 *   ⑴ 목록이 plan_ 을 «싣는데» 화면이 「안 뜬다」고 말하면 → 빨강 (C2)
 *   ⑵ 목록이 plan_ 을 다시 «안 싣게» 되면 → 이 검사의 전제가 깨졌으니 빨강 (C1)
 *      (조용히 초록으로 남으면, 결함이 되살아난 날 이 검사가 「문구 잘 맞네」라고 안심을 준다.)
 *
 * ⛔주석은 안 센다 — 주석은 «옛 증상을 기록하는 자리»고 그건 지우면 안 된다.
 *   재는 것은 «사용자·관리자 눈에 닿는 문자열» 둘뿐이다: 단추 title, createPlanningProject 의 console.warn.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const MAIN_SRC = readSrc(REPO, 'main.js');
const PAGE = 'pages/projects.html';
const HTML = readSrc(REPO, PAGE);

/* main.js 의 «진짜» 판정 함수를 떼어내 실행한다 — 문자열로 「plan 이 적혀 있나」를 보지 않는다.
 * (list-plan-projects.test.js 와 같은 수법. 이름이 바뀌면 시끄럽게 던진다.) */
function realIsListableProjectId() {
  const src = sliceBlock(MAIN_SRC, 'function _isListableProjectId(',
    '검사가 «대상을 놓친» 것이지 통과가 아니다');
  return new Function(src + '\n; return _isListableProjectId;')();
}

/* ── 재는 자리 둘 ─────────────────────────────────────────────────────────
 * 화면에 닿는 문자열만 뽑는다. 못 뽑으면 «없다»가 아니라 던진다(자리가 바뀐 것). */
function newPlanButtonTitle(html) {
  const m = html.match(/<button id="btn-new-planning"[^>]*>/);
  if (!m) throw new Error(`★${PAGE} 에 #btn-new-planning 단추가 없다 — 자리가 바뀌었으면 이 검사도 같이 고쳐라`);
  const t = m[0].match(/title="([^"]*)"/);
  if (!t) throw new Error('★#btn-new-planning 에 title 툴팁이 없다 — 이유를 말하지 않는 비활성 단추는 이 팀 규율 위반이다');
  return t[1];
}

function planModeOffWarning(html) {
  const body = sliceBlock(html, 'async function createPlanningProject()',
    '★createPlanningProject 가 사라졌거나 모양이 바뀌었다');
  const m = body.match(/console\.warn\((['"])([\s\S]*?)\1\)/);
  if (!m) throw new Error('★createPlanningProject 의 «꺼져 있다» 안내(console.warn)가 사라졌다 — 조용히 아무 일도 안 하면 눌린 줄 안다');
  return m[2];
}

/** 「기획 프로젝트가 목록에 안 뜬다」는 뜻의 주장을 찾아낸다. */
function claimsPlanIsNotListed(s) {
  const hits = [];
  if (/목록에\s*(아직\s*)?(안|못)\s*(뜨|보이|나오)/.test(s) || /목록에[^.]{0,12}뜨지\s*않/.test(s)) hits.push('「목록에 안 뜬다」');
  if (/T-064\s*(해결|고침|수정)?\s*(전|이전)/.test(s)) hits.push('「T-064 해결 전」');
  return hits;
}

/* ══ C1 — 전제: 목록은 정말 plan_<숫자> 를 싣는다 (반대 방향 감시) ══ */
test('C1 ★전제 — main.js _isListableProjectId 가 plan_<숫자> 를 «받는다»', () => {
  const f = realIsListableProjectId();
  assert.equal(f('plan_1790021811697'), true,
    '★목록이 기획(plan_*)을 다시 안 싣는다 — T-064 가 되살아났다. '
    + '이 검사(C2)는 「화면 문구가 동작과 맞나」를 재는 것이라, 동작이 뒤집히면 «전제»부터 다시 봐야 한다.');
  assert.equal(f('proj_123'), true, '일반 프로젝트까지 막혔다(넓히다 옛 길을 막았다)');
});

/* ══ C2 — 본체: 화면이 「목록에 안 뜬다」고 말하지 않는다 ══ */
test('C2 ★New Plan 단추 툴팁이 «고쳐진 결함»을 아직 있다고 말하지 않는다', () => {
  const title = newPlanButtonTitle(HTML);
  const bad = claimsPlanIsNotListed(title);
  assert.deepStrictEqual(bad, [],
    `★단추 툴팁이 ${bad.join('·')} 라고 말한다: "${title}"\n`
    + '  실측(2026-09-22 9630)은 그 반대다 — 기획 카드가 목록에 뜨고 📋 기획 배지·열기·이름변경·삭제가 된다.\n'
    + '  ⇒ 꺼 둔 «진짜 이유»(현빈 지시 2026-09-21)를 적어라. 이유가 바뀌면 문구도 같이 바뀐다.');
  assert.ok(title.length > 0, '툴팁이 비었다 — 「왜 못 쓰나」를 관리자에게 알리는 자리다');
});

test('C3 ★createPlanningProject 의 «꺼져 있다» 안내도 같은 말을 한다', () => {
  const warn = planModeOffWarning(HTML);
  const bad = claimsPlanIsNotListed(warn);
  assert.deepStrictEqual(bad, [],
    `★console.warn 이 ${bad.join('·')} 라고 말한다: "${warn}"\n`
    + '  툴팁만 고치고 여기를 놔두면, 콘솔을 보는 사람만 옛말을 읽는다(입구가 둘이면 둘 다 고친다).');
  assert.match(warn, /PLAN_MODE_ENABLED/,
    '★꺼진 «자리»를 안 말한다 — 「비활성입니다」만으론 어디를 봐야 켜는지 모른다');
});

/* ══ C4 — 음성대조: 고침을 되돌린 «변형본»에서 판정기가 실제로 빨개지나 ══ */
test('C4 ★음성대조 — 옛 문구를 되박은 변형본은 C2·C3 가 «잡아낸다»', () => {
  const revertedTitle = '준비 중 — 만든 기획 프로젝트가 아직 프로젝트 목록에 뜨지 않습니다';
  const revertedWarn = '[projects] 기획모드는 아직 비활성입니다 (T-064 해결 전까지). 프로젝트를 만들지 않습니다.';

  assert.notDeepStrictEqual(claimsPlanIsNotListed(revertedTitle), [],
    '★판정기가 옛 툴팁을 못 잡는다 — 이 검사는 «아무것도 안 재는» 초록이다');
  assert.notDeepStrictEqual(claimsPlanIsNotListed(revertedWarn), [],
    '★판정기가 옛 console.warn 을 못 잡는다');

  // 변형본을 «진짜 파일에» 되박아도 같은 자리에서 잡히는지 — 뽑아내기(추출)까지 같이 검증한다.
  const mutated = HTML
    .replace(/(<button id="btn-new-planning"[^>]*title=")[^"]*(")/, `$1${revertedTitle}$2`);
  assert.notDeepStrictEqual(claimsPlanIsNotListed(newPlanButtonTitle(mutated)), [],
    '★변형본을 넣었는데 추출·판정이 «통과»했다 — 추출이 엉뚱한 자리를 보고 있다');

  // 양성대조 — 지금 파일은 깨끗하다(변형이 «있을 때만» 빨개진다는 뜻).
  assert.deepStrictEqual(claimsPlanIsNotListed(newPlanButtonTitle(HTML)), [],
    '양성대조 실패 — 현재 파일이 이미 더럽다');
});
