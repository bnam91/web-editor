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
  assert.ok(!/🕐/.test(t.message) || !/갤러리/.test(t.message),
    '★갤러리 카드 아이콘은 «없어졌다»(현빈 시연 피드백) — 없는 길을 대안으로 안내하면 안 된다');
  assert.ok(/프로젝트를 연/.test(t.message), '★대신 뭘 하면 되는지를 알려줘야 한다 — 이유 없는 거부가 제일 나쁘다');
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

test('EN6 ★두 진입점이 «한 함수»를 지난다 — 중복 구현이 생기면 규칙이 갈린다', () => {
  /* ⚠️2026-08-28 현빈 시연 피드백으로 진입점이 «셋 → 둘»이 됐다.
   *   갤러리 카드 🕐 제거 · 설정 탭은 버튼 없이 목록을 바로 그린다.
   *   ⇒ 남은 둘(상단바 배지 · 설정 탭)이 여전히 «한 함수»(resolveVersionHistoryTarget)를 지나야 한다. */
  const root = path.join(__dirname, '../..');
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const set = fs.readFileSync(path.join(root, 'js/settings/settings-modal.js'), 'utf8');
  assert.match(idx, /onclick="openVersionHistoryHere\(\)"/, '★배지가 자체 로직으로 프로젝트를 고르면 안 된다');
  assert.ok(!/activeProjectId/.test(idx.slice(idx.indexOf('vhist-topbar-badge'), idx.indexOf('vhist-topbar-badge') + 400)),
    '★배지 onclick 이 직접 activeProjectId 를 읽으면 그게 두 번째 구현이다');
  assert.match(set, /resolveVersionHistoryTarget\(\)/, '★설정 탭도 해석기를 써야 한다');
});

test('EN6b ★갤러리 카드에 버전 기록 진입점이 «없다» (현빈 시연 피드백)', () => {
  const gal = fs.readFileSync(path.join(__dirname, '../../pages/projects.html'), 'utf8');
  assert.ok(!/card-history/.test(gal), '★카드 아이콘이 되살아났다 — 입구는 에디터 안으로 통일했다');
  assert.ok(!/openVersionHistoryUI/.test(gal), '★카드용 진입 함수가 남아 있다(죽은 배선)');
  assert.ok(!/openVersionHistory\(/.test(gal), '★갤러리에서 버전 기록을 여는 경로가 남아 있다');
});

test('EN6c ★리스트 뷰 예약폭이 «버튼 개수»와 맞는다 — 아이콘을 뺐으면 폭도 뺀다', () => {
  const gal = fs.readFileSync(path.join(__dirname, '../../pages/projects.html'), 'utf8');
  const m = /#project-grid\.is-list \.card-body \{[\s\S]*?padding:\s*6px\s+(\d+)px/.exec(gal);
  assert.ok(m, '리스트 뷰 .card-body 예약폭을 못 찾았다');
  const px = Number(m[1]);
  // 최대 버튼 3개(공유 조건부 + 복제 + 삭제): 3×22 + 2×4 + 10 = 84 (실측으로 확인한 값)
  assert.ok(px >= 80 && px <= 92,
    `★예약폭 ${px}px — 버튼 4개 시절(110px) 값이 남아 있으면 반대로 «빈 여백»이 뜬다`);
});

test('EN7 ★설정 탭은 «목록을 직접» 그린다 — 「열기」 버튼을 한 번 더 누르게 하지 않는다', () => {
  /* 현빈: 「환경설정에서 버전기록 > 버전기록 열기 버튼을 굳이 눌러야 보여야될 이유가 뭐야」
   * 버튼이 있던 이유는 「모달 위 모달을 피한다」였는데 그건 구현 사정이지 쓰는 사람 사정이 아니다. */
  const src = fs.readFileSync(path.join(__dirname, '../../js/settings/settings-modal.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function renderVersionPane'), src.indexOf('function _escapeHtml'));
  assert.ok(!/버전 기록 열기/.test(fn), '★「열기」 버튼이 되살아났다 — 클릭을 하나 더 시키는 거래는 무효다');
  assert.ok(!/closeSettingsModal/.test(fn), '★설정을 닫고 모달을 여는 옛 경로가 남아 있다');
  assert.match(fn, /mountVersionHistory/, '★페인 안에 목록을 마운트해야 한다');
  assert.match(fn, /vhist-list/, '목록 컨테이너를 만들어야 한다');
});

test('EN7b ★목록 렌더는 «한 구현»이다 — 설정 탭이 자기 행을 따로 그리지 않는다', () => {
  /* 행 안에 파괴적 동작(「이 버전으로 교체」)이 있다. 두 벌이 되면 안전판·거부 경로가 갈린다. */
  const src = fs.readFileSync(path.join(__dirname, '../../js/settings/settings-modal.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function renderVersionPane'), src.indexOf('function _escapeHtml'));
  for (const dup of ['vhist-row', 'data-vh-restore', 'data-vh-open', 'data-vh-detail', 'buildRows']) {
    assert.ok(!fn.includes(dup), `★설정 탭이 «${dup}» 를 직접 만든다 — 두 번째 구현이다`);
  }
  const ui = fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8');
  assert.match(ui, /window\.mountVersionHistory = mountVersionHistory/, '공용 마운트가 노출돼야 한다');
  assert.equal((ui.match(/function _rowHtml/g) || []).length, 1, '★행 렌더가 두 벌이면 안 된다');
});

test('EN7c ★비활성(열린 프로젝트 없음)일 때 «이유»를 보여준다 — 빈 화면을 내지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/settings/settings-modal.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function renderVersionPane'), src.indexOf('function _escapeHtml'));
  assert.match(fn, /target\.message/, '왜 못 쓰는지를 화면에 써야 한다');
  assert.ok(!/\.hidden\s*=/.test(fn), '★hidden 은 display 클래스에 진다(팀 교훈)');
});

test('EN8 ★설정 탭은 새 CSS 를 만들지 않는다 — 공용/전용 어휘만(디자인 게이트)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/settings/settings-modal.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function renderVersionPane'), src.indexOf('function _escapeHtml'));
  const classes = [...fn.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean);
  // 설정 안이므로 .settings-* 우선. .vhist-* 는 «목록을 마운트하는 훅»이라 재사용이 맞다.
  const foreign = [...new Set(classes)].filter(c => !/^(settings-|vhist-)/.test(c));
  assert.deepEqual(foreign, [], `★공용/전용 밖 클래스가 섞였다: ${foreign.join(', ')}`);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(fn), '★색 리터럴 0 — 토큰만 쓴다');
});
