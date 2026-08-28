/* 진입점 «해석기» 하네스 — js/version-history-ui.js resolveVersionHistoryTarget
 * 실행: node --test "tests/unit/*.test.js"
 *
 * ★이 유닛이 지키는 문장:
 *   「어느 프로젝트인지 못 정하면 «못 정한다»고 말한다 — 아무거나 열지 않는다」
 *   복구 도구가 «엉뚱한 프로젝트의 과거»를 보여주면 사용자는 그걸 믿고 되돌린다. 그게 최악이다.
 *
 * ★변이 스윕 대비: 「폴백을 넣으면(=아무거나 고르면) 빨강이 되는가」를 EN-NEG 가 직접 잰다.
 *   초록 테스트를 아무리 많이 붙여도 그 문장은 안 재진다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/** 브라우저 IIFE 를 가짜 window 에 얹는다(로드 시점엔 document 를 안 건드린다). */
function load(win) {
  const src = fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8');
  new Function('window', src)(win);
  return win;
}

test('EN1 활성 프로젝트가 있으면 그걸 «그대로» 고른다', () => {
  const win = load({ activeProjectId: 'proj_1', openTabs: [{ id: 'proj_1', name: '세이프본' }, { id: 'proj_2', name: '다른것' }] });
  const t = win.resolveVersionHistoryTarget();
  assert.equal(t.ok, true);
  assert.equal(t.projectId, 'proj_1');
  assert.equal(t.projectName, '세이프본');
});

test('EN2 ★활성 프로젝트가 없으면 «못 정한다»고 답한다 — 아무거나 고르지 않는다', () => {
  // ⚠️탭이 «열려 있어도» 활성이 아니면 고르면 안 된다. 「탭이 하나뿐이니 그거겠지」가 딱 그 폴백이다.
  const win = load({ activeProjectId: null, openTabs: [{ id: 'proj_9', name: '열려있지만 활성아님' }] });
  const t = win.resolveVersionHistoryTarget();
  assert.equal(t.ok, false, '★탭이 하나라고 그걸 고르면, 복구 도구가 엉뚱한 과거를 보여준다');
  assert.equal(t.reason, 'no_active_project');
  assert.ok(!t.projectId, '★projectId 를 넘기면 호출측이 그걸로 연다');
});

test('EN3 ★거부할 땐 «이유»와 «대안»을 말한다 — 이유 없는 거부가 제일 나쁘다', () => {
  const win = load({ activeProjectId: null });
  const t = win.resolveVersionHistoryTarget();
  assert.ok(/열린 프로젝트가 없습니다/.test(t.message), '왜 안 되는지');
  assert.ok(/🕐/.test(t.message), '★대신 뭘 하면 되는지(갤러리 카드의 🕐)를 알려줘야 한다');
});

test('EN4 이름을 못 찾아도 «id 로» 연다 — 이름은 표시용이지 신원이 아니다', () => {
  const win = load({ activeProjectId: 'proj_7', openTabs: null });
  const t = win.resolveVersionHistoryTarget();
  assert.equal(t.ok, true);
  assert.equal(t.projectId, 'proj_7');
  assert.equal(t.projectName, '');
});

test('EN5 openTabs 가 이상해도 던지지 않는다', () => {
  for (const tabs of [undefined, null, 'x', 42, [null, {}, { id: 'proj_1' }]]) {
    const win = load({ activeProjectId: 'proj_1', openTabs: tabs });
    const t = win.resolveVersionHistoryTarget();
    assert.equal(t.ok, true, `tabs=${JSON.stringify(tabs)}`);
    assert.equal(t.projectId, 'proj_1');
  }
});

test('EN6 ★세 진입점이 «한 함수»를 지난다 — 중복 구현이 생기면 규칙이 갈린다', () => {
  const root = path.join(__dirname, '../..');
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const set = fs.readFileSync(path.join(root, 'js/settings/settings-modal.js'), 'utf8');
  const gal = fs.readFileSync(path.join(root, 'pages/projects.html'), 'utf8');
  // 상단바 배지 · 설정 탭 → 해석기 경유
  assert.match(idx, /onclick="openVersionHistoryHere\(\)"/, '★배지가 자체 로직으로 프로젝트를 고르면 안 된다');
  assert.ok(!/activeProjectId/.test(idx.slice(idx.indexOf('vhist-topbar-badge'), idx.indexOf('vhist-topbar-badge') + 400)),
    '★배지 onclick 이 직접 activeProjectId 를 읽으면 그게 두 번째 구현이다');
  assert.match(set, /resolveVersionHistoryTarget\(\)/, '★설정 탭도 해석기를 써야 한다');
  // 갤러리 카드는 «자기 id» 를 안다 — 해석기가 필요 없고, 써서도 안 된다(활성 탭을 열게 된다)
  assert.match(gal, /window\.openVersionHistory\(\{ projectId: id/,
    '★카드는 «그 카드의» 프로젝트를 열어야 한다 — 해석기를 쓰면 엉뚱한 걸 연다');
});

test('EN7 ★설정 탭은 «비활성»을 disabled 로 한다 — hidden 은 display 클래스에 진다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/settings/settings-modal.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function renderVersionPane'), src.indexOf('function renderPerfPane'));
  assert.match(fn, /btn\.disabled = true/, '★disabled 로 해야 computed 로 판정할 수 있다');
  assert.ok(!/\.hidden\s*=/.test(fn), '★이 앱에서 hidden 속성이 display 클래스에 져 「죽은 버튼」이 나간 전례가 있다');
  assert.ok(!/style\.display\s*=\s*['"]none/.test(fn), '숨기지 말고 «왜 못 쓰는지»를 보여줘야 한다');
  assert.match(fn, /closeSettingsModal/, '★모달 위에 모달을 겹치지 않는다 — 설정을 닫고 연다');
  assert.match(fn, /target\.message/, '비활성일 때 이유를 화면에 쓴다');
});

test('EN8 ★설정 탭은 새 CSS 를 만들지 않는다 — 공용 클래스만(디자인 게이트)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/settings/settings-modal.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function renderVersionPane'), src.indexOf('function renderPerfPane'));
  const classes = [...fn.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean);
  const foreign = [...new Set(classes)].filter(c => !/^settings-/.test(c));
  assert.deepEqual(foreign, [], `★공용(.settings-*) 밖 클래스가 섞였다: ${foreign.join(', ')}`);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(fn), '★색 리터럴 0 — 토큰만 쓴다');
});
