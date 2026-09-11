/* ★「가입이 «안 끝난» 구글 계정은 인증을 «저장하지 않는다»」 — 2026-09-10 지디 발주.
 *
 * 화면 차단(license.html 이 next 면 navigateToProjects 를 안 부름)은 먼저 들어갔다(PR #3).
 * ★그런데 그것만으로는 «반쪽»이다:
 *   writeAuth 는 6필드(email·plan·accessUntil·sessionToken·savedAt·signed)만 담고 `next` 를 «안 담는다».
 *   ⇒ 부팅 판정(authVerdict → entitlement.classify)이 「가입이 안 끝났다」를 알 길이 없다.
 *   ⇒ ★앱을 껐다 켜면 checkAuthAndLoad 가 저장된 인증으로 «그냥» 들여보낸다.
 * ⇒ 그래서 저장 «시점»을 미룬다. ⛔writeAuth·classify 는 한 글자도 안 고친다 — «부르지 않을 뿐».
 *
 * ★★이 검사의 핵심은 «양쪽»이다. 한쪽만 재고 「막았다」고 적으면 양성대조 없는 통과다:
 *   ⑴ next 있으면 저장 «안» 한다
 *   ⑵ next 없으면 «한다»            ← ⛔이걸 안 보면 「전원 재로그인」 사고를 못 잡는다
 *
 * ★재는 방법: 실제 구간을 «떠내서 돌린다».
 *   ⛔소스에 문자열이 있는지만 보는 검사는 「부르는지」를 못 잰다 — 그게 이 버그가 살던 자리다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
/** 주석을 걷는다 — 주석 속 writeAuth 를 «호출»로 세면 안 된다. */
const CODE = MAIN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** 구글 로그인 «성공 경로»의 저장 구간만 떠낸다. */
function segOf(src) {
  const i = src.indexOf('let grec = { email: r.email');
  if (i < 0) return '';
  const j = src.indexOf('return {', i);
  return j < 0 ? '' : src.slice(i, j);
}

/** 그 구간을 «실제로 실행»한다 — writeAuth 가 몇 번 불리는지 센다. */
function run(rNext, src = MAIN) {
  const seg = segOf(src);
  if (!seg) throw new Error('구간을 못 떠냈다 — 하네스가 부서졌다');
  let saved = 0, opened = 0, notified = 0;
  new Function('r', 'v', 'entitlement', '_noteServer', 'writeAuth', 'shell', 'AUTH_API_BASE', 'entKeys', '_notifyGoditorUse', seg)(
    { email: 'x@y.z', token: 't', next: rNext },
    { plan: 'pro', accessUntil: '2027-01-01' },
    { applyServerAnswer: (rec) => ({ clear: false, record: rec, diag: {} }), CONSTANTS: {} },
    () => {}, () => { saved++; }, { openExternal: () => { opened++; } }, 'https://x/', () => ({}),
    () => { notified++; });   // ★2026-09-11 지디 발주 — 이 검사는 그 신호를 재는 게 아니라 스텁만 준다
  return { saved, opened, notified };
}

test('W0 ★「입력이 살아 있다」 — 저장 구간을 실제로 떠냈다', () => {
  const s = segOf(MAIN);
  assert.ok(s.length > 200, `구간을 ${s.length}자밖에 못 떠냈다 — 하네스가 부서졌다(계약이 문 게 아니다)`);
  assert.match(s, /writeAuth/, '떠낸 구간에 writeAuth 가 없다 — 엉뚱한 데를 떴다');
});

test('W1 ★next 가 «있으면» 저장하지 않는다 (앱을 껐다 켜도 못 들어간다)', () => {
  const r = run('/signup/extra');
  assert.equal(r.saved, 0,
    `★가입 미완인데 writeAuth 가 ${r.saved}번 불렸다 — 재시작하면 그냥 들어간다`);
  assert.equal(r.opened, 1, '추가정보 페이지를 안 열었다 — 사용자가 어디서 채우는지 모른다');
  // ★2026-09-11 지디 발주 — 가입 미완은 «로그인 성공»이 아니다. 사용 신호도 같이 안 나가야 한다.
  assert.equal(r.notified, 0, '가입 미완인데 goditor-use 신호가 나갔다 — next 대기엔 보내면 안 된다');
});

test('W2 ★[양성대조] next 가 «없으면» 저장한다 — 기존 회원을 막으면 «전원 재로그인» 사고다', () => {
  const r = run('');
  assert.equal(r.saved, 1, `★기존 회원인데 writeAuth 가 ${r.saved}번 — 다음에 자동 로그인이 깨진다`);
  assert.equal(r.opened, 0, '기존 회원인데 브라우저를 열었다');
  assert.equal(r.notified, 1, '★진짜 로그인 성공인데 goditor-use 신호가 안 나갔다 — writeAuth 와 짝이 깨졌다');
});

test('W2b [양성대조] next 키가 «아예 없어도» 저장한다 (서버가 필드를 안 줄 때)', () => {
  const r = run(undefined);
  assert.equal(r.saved, 1, 'next 필드가 없는데 저장을 안 했다 — 옛 서버 응답에서 잠긴다');
  assert.equal(r.notified, 1, 'next 필드가 없는데 goditor-use 신호가 안 나갔다');
});

test('W3 ★writeAuth «함수 자체»는 안 고쳤다 — 6필드 그대로', () => {
  const i = MAIN.indexOf('function writeAuth(record)');
  assert.ok(i > 0, 'writeAuth 정의를 못 찾았다');
  const body = MAIN.slice(i, i + 900);
  for (const k of ['email:', 'plan:', 'accessUntil:', 'sessionToken:', 'savedAt:']) {
    assert.ok(body.includes(k), `writeAuth 에서 ${k} 가 사라졌다 — 저장 «형식»을 건드렸다`);
  }
});

test('W4 ★부팅 판정은 «저장본»만 본다 — 손대지 않았다', () => {
  assert.match(MAIN, /function authVerdict\(record, now\)\s*\{\s*return entitlement\.classify\(/,
    '★authVerdict 를 고쳤다 — 부팅 판정에 손대면 «이미 저장된» 인증이 죽는다');
  assert.ok(!/classify\([^)]*next/.test(CODE),
    '★classify 에 next 를 넘긴다 — 그건 저장 형식·판정 변경이다. 금지선이다');
});

test('W5 ★[⑷ 핵심] 남의 길의 writeAuth 는 «그대로 남아 있다»', () => {
  const calls = (CODE.match(/writeAuth\s*\(/g) || []).length;
  assert.ok(calls >= 5,
    `★writeAuth 호출이 ${calls}개뿐이다 — 다른 로그인 경로를 지웠을 수 있다(전원 재로그인 사고)`);
});

test('W6 [변이] 저장 미루기를 되돌리면 W1 이 «실제로» 빨개진다', () => {
  /* ★else 블록 «안쪽»(writeAuth 바로 뒤에 뭐가 있는지)에 앵커를 걸지 않는다 —
     그러면 그 안에 문장이 하나 늘 때마다(예: 이 신호 호출) 이 검사 자체가 부서진다.
     대신 «조건»을 죽여 else 가 항상 타게 만든다 — 안쪽 내용이 뭐든 이걸로 충분하다. */
  const mutated = MAIN.replace('if (r.next) {', 'if (false && r.next) {');
  assert.notEqual(mutated, MAIN, '★하네스가 부서졌다 — 변이 앵커를 못 찾았다');
  const r = run('/signup/extra', mutated);
  assert.ok(r.saved > 0,
    '★저장 미루기를 지웠는데도 «안» 저장된다 — 이 검사는 아무것도 안 지킨다');
});

test('W7 ★화면 차단(PR #3)이 «여전히» 살아 있다 — 둘이 짝이다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pages/license.html'), 'utf8');
  const i = html.indexOf('if (result && result.ok) {');
  assert.ok(i > 0, '성공 분기를 못 찾았다');
  const branch = html.slice(i, i + 900);
  assert.match(branch, /if \(result\.next\)[\s\S]{0,400}return;/,
    '★화면 차단이 사라졌다 — 저장만 막으면 그 자리에선 그냥 넘어간다');
  /* ★재시도 수단 — dev 판은 «별도 버튼 대신» googleBtn 재활성화로 푼다(설계 주석에 명시).
       ⇒ 그 재활성화가 «성공 분기보다 앞»에 있어야 눌릴 수 있다. 그것만 못박는다. */
  const reEnable = html.indexOf('btn.disabled = false;');
  assert.ok(reEnable > 0 && reEnable < i,
    '★googleBtn 재활성화가 성공 분기 «뒤»에 있다 — 그러면 다시 누를 수단이 없다');
});
