/* collab-reasons-single — 협업 reason 문장 표가 «한 벌»(js/collab/reasons.js)이고, 소비자 셋이 «실제로» 그 표를 거치는가.
 *
 * ★왜 있나 (2026-10-06, 지디 발주 TWO ⒜ E1)
 *   표가 두 벌이었다 — pages/projects.html collabReasonText(9 갈래) · js/settings/settings-modal.js reasonText(13 갈래),
 *   겹침 5 → 합집합 17. 편집기(sync.js)는 둘 다 못 읽어서 실패를 말하지 못했다.
 *   ⇒ 합쳤다. 그리고 «합친 것을 잰다»: 소비자마다 «그 함수를 실제로 돌려» 공용 표의 문장이 나오는지 본다.
 *
 * ★양성대조(합격 기준): reasons.js 의 text() 를 「reason 을 그대로 돌려준다」로 무력화하면
 *   C1·C2·C3 «셋 다» 빨강이어야 한다(소비자 수 = 3). 기대 문장은 이 파일에 «글자로» 박았다 —
 *   reasons.js 에서 파싱하면 피검 대상과 같은 소스라 무력화해도 같이 바뀌어 «항상 참»이 된다.
 *
 * ⚠️settings-modal 의 협업 탭은 지금 MVP 문(현빈 08-28) 뒤라 화면으로는 못 연다 ⇒ 그 소비자는
 *   «함수 본문을 잘라 vm 에서 돌리는» 방식으로 잰다(소스 문자열 «일치»가 아니라 «실행» 결과를 본다).
 * ⛔네트워크 0 · 앱 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const REASONS = readSrc(REPO, 'js/collab/reasons.js');
const PROJECTS = readSrc(REPO, 'pages/projects.html');
const SETTINGS = readSrc(REPO, 'js/settings/settings-modal.js');
const NOTIFY = readSrc(REPO, 'js/collab/notify.js');

/* 기대 문장 — «글자로» 박는다(위 ★양성대조 까닭). 셋 다 옛 두 표에 실제로 있던 문장이다:
 *   not_signed_in = 두 표 공통 · self_invite = settings 표에만 · server = projects 표에만 */
const WANT = {
  not_signed_in: '로그인이 필요합니다.',
  self_invite:   '자기 자신은 초대할 수 없습니다.',
  server503:     '서버 오류(503) — 잠시 뒤 다시 시도해 주세요.',
};

function freshWindow() {
  const ctx = { console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(REASONS, ctx, { filename: 'js/collab/reasons.js' });
  assert.equal(typeof ctx.CollabReasons?.text, 'function', '★전제: reasons.js 를 실제로 실었다(CollabReasons.text)');
  return ctx;
}

function cut(src, startMarker, endMarker) {
  const i = src.indexOf(startMarker);
  assert.ok(i >= 0, `잘라낼 시작을 못 찾았다: ${startMarker}`);
  const j = src.indexOf(endMarker, i);
  assert.ok(j > i, `잘라낼 끝을 못 찾았다: ${endMarker}`);
  return src.slice(i, j + endMarker.length);
}

test('C1 — 목록 화면(projects.html) collabReasonText 가 공용 표를 거친다', () => {
  const ctx = freshWindow();
  const fn = cut(PROJECTS, 'function collabReasonText(reason, r) {', '\n}');
  vm.runInContext(fn + '\nwindow.__c1 = collabReasonText;', ctx);
  assert.equal(ctx.__c1('not_signed_in'), WANT.not_signed_in);
  assert.equal(ctx.__c1('self_invite'), WANT.self_invite, '옛 settings 표에만 있던 갈래가 목록에서도 나온다(합집합)');
  assert.equal(ctx.__c1('server', { status: 503 }), WANT.server503);
});

test('C2 — 환경설정(settings-modal.js) reasonText 가 공용 표를 거친다', () => {
  const ctx = freshWindow();
  const line = cut(SETTINGS, 'const reasonText = (r) =>', ';');
  vm.runInContext(line + '\nwindow.__c2 = reasonText;', ctx);
  assert.equal(ctx.__c2('not_signed_in'), WANT.not_signed_in);
  assert.equal(ctx.__c2('self_invite'), WANT.self_invite);
  assert.equal(ctx.__c2('server'), '서버 오류(5xx) — 잠시 뒤 다시 시도해 주세요.', '옛 projects 표에만 있던 갈래가 설정에서도 나온다(합집합)');
});

test('C3 — 편집기(collab/notify.js) textFor 가 공용 표를 거친다', () => {
  const ctx = freshWindow();
  vm.runInContext(NOTIFY, ctx, { filename: 'js/collab/notify.js' });
  assert.equal(typeof ctx.collabNotify?.textFor, 'function', '★전제: notify.js 를 실제로 실었다');
  assert.equal(ctx.collabNotify.textFor({ type: 'pull_error', reason: 'not_signed_in' }), WANT.not_signed_in);
  assert.equal(ctx.collabNotify.textFor({ type: 'pull_error', reason: 'server', detail: { status: 503 } }), WANT.server503);
});

test('C4 — 모르는 reason 은 «원문 그대로»(삼키지 않는다)', () => {
  const ctx = freshWindow();
  assert.equal(ctx.CollabReasons.text('zz_new_reason'), 'zz_new_reason');
  assert.equal(ctx.CollabReasons.text('zz_new_reason', { status: 429 }), 'zz_new_reason (429)');
  assert.notEqual(ctx.CollabReasons.text('zz_new_reason'), '알 수 없는 오류');
});

test('C5 — 표가 «한 벌»이다: 옛 두 자리에 갈래 표가 다시 자라지 않는다', () => {
  /* 옛 꼴 둘: projects 의 `case 'not_signed_in':` · settings 의 `not_signed_in: '…'` */
  assert.doesNotMatch(PROJECTS, /case\s+'not_signed_in'/, 'projects.html 에 지역 갈래 표가 다시 생겼다');
  assert.doesNotMatch(SETTINGS, /\bnot_signed_in\s*:\s*'/, 'settings-modal.js 에 지역 갈래 표가 다시 생겼다');
});

test('C6 — 합집합 17 갈래가 공용 표에 있다(이름으로 센다 · 정의 자리 = CollabReasons.keys + 함수 갈래 2)', () => {
  const ctx = freshWindow();
  const have = new Set([...ctx.CollabReasons.keys(), 'server', 'bad_response']);
  const OLD_UNION = ['already_member', 'bad_response', 'id_collision', 'invalid_session', 'no_project_factory',
    'not_a_member', 'not_deployed', 'not_linked', 'not_signed_in', 'offline', 'ref_not_saved', 'save_failed',
    'section_too_large', 'self_invite', 'server', 'too_large', 'unavailable'];
  assert.equal(OLD_UNION.length, 17);
  const missing = OLD_UNION.filter(k => !have.has(k));
  assert.deepEqual(missing, [], `옛 두 표의 식구가 빠졌다: ${missing.join(',')}`);
});

test('C7 — 두 화면이 reasons.js 를 «feature-flags.js 바로 뒤»에 싣는다(소비자보다 먼저)', () => {
  const INDEX = readSrc(REPO, 'index.html');
  for (const [name, src, ff, rs] of [
    ['index.html', INDEX, '<script src="js/feature-flags.js"></script>', '<script src="js/collab/reasons.js"></script>'],
    ['pages/projects.html', PROJECTS, '<script src="../js/feature-flags.js"></script>', '<script src="../js/collab/reasons.js"></script>'],
  ]) {
    const a = src.indexOf(ff), b = src.indexOf(rs);
    assert.ok(a >= 0 && b > a, `${name}: reasons.js 가 feature-flags.js 뒤에 없다`);
  }
  const INDEX_SET = readSrc(REPO, 'index.html');
  assert.ok(INDEX_SET.indexOf('js/collab/reasons.js') < INDEX_SET.indexOf('js/settings/settings-modal.js'), 'index: settings-modal 보다 먼저');
  assert.ok(INDEX_SET.indexOf('js/collab/reasons.js') < INDEX_SET.indexOf('js/collab/notify.js'), 'index: notify 보다 먼저');
  assert.ok(PROJECTS.indexOf('js/collab/reasons.js') < PROJECTS.indexOf('function collabReasonText'), 'projects: 인라인 소비자보다 먼저');
});
