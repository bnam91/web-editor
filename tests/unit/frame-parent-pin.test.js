/* ★프레임 «안»에 넣기 — 배선 검사.
   실측 근거(2026-09-07): _activeFrame 을 핸들러 «밖»에서 세우면 삽입 시점엔 이미 없다.
   앱의 add* 핸들러가 자기 안에서 selectSection → deselectAll(js/editor.js) 을 부르고
   deselectAll 이 window._activeFrame 에 null 을 넣기 때문이다(text·asset·divider 3/3 실패).
   ⇒ 「핀(널 대입 무시 접근자)」과 「finally 의 pin:false 원복」 둘 다가 정본이다.
   ⛔이 검사는 «부르지 않아도 초록»이면 안 된다 — 아래 F4 가 그 자리를 지킨다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
/* ⛔날 것으로 읽지 않는다 — CRLF 체크아웃에서 «자르기가 던져» 이 파일이 통째로 안 돈다
     (win-portability ①-3 이 이 자리를 지킨다. 오늘 또 걸렸다). */
const { readSrc } = require('./_srcread.js');

const ROOT = path.join(__dirname, '..', '..');
const MAIN = readSrc(ROOT, 'main.js');
const SRV  = readSrc(ROOT, 'main', 'claude-pm', 'mcp-server.js');

test('F1 setActiveFrame 은 «핀»(널 대입 무시 접근자)을 깐다 — 보통 대입이면 deselectAll 이 지운다', () => {
  const fn = MAIN.slice(MAIN.indexOf('async function _invokeRendererSetActiveFrame'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /Object\.defineProperty\(window, '_activeFrame'/,
    '핀이 없다 — 보통 대입은 deselectAll 에 지워진다');
  assert.match(body, /set\(v\)\s*\{\s*if \(v == null\) return;/,
    '널 대입을 «무시»해야 핀이다');
});

test('F2 핀은 «걷는 길»이 있다 — pin:false 가 접근자를 delete 한다', () => {
  const fn = MAIN.slice(MAIN.indexOf('async function _invokeRendererSetActiveFrame'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(MAIN, /_invokeRendererSetActiveFrame\(\{ frameId, pin = true \} = \{\}\)/,
    'pin 인자가 없으면 원복 경로가 없다');
  assert.match(body, /delete window\._activeFrame/, '접근자를 걷는 코드가 없다');
});

test('F3 finally 는 «pin:false» 로 푼다 — 그냥 prev 를 세우면 핀이 다시 깔려 앱이 갇힌다', () => {
  const i = SRV.indexOf('const _withParent');
  assert.ok(i > 0, '_withParent 가 없다');
  const w = SRV.slice(i, i + 3000);
  const fin = w.slice(w.indexOf('} finally {'));
  assert.match(fin, /setActiveFrame\(\{ frameId: set\.prev \|\| null, pin: false \}\)/,
    'finally 가 pin:false 로 안 푼다 — 사람 클릭이 계속 그 프레임으로 빨려 들어간다');
});

test('F4 ★변이대조 — 핀 줄을 지우면 F1 이 «빨개져야» 한다(안 부르면 초록인 검사 금지)', () => {
  const mutated = MAIN.replace(/Object\.defineProperty\(window, '_activeFrame'/g, 'window._activeFrame = (');
  const fn = mutated.slice(mutated.indexOf('async function _invokeRendererSetActiveFrame'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.doesNotMatch(body, /Object\.defineProperty\(window, '_activeFrame'/,
    '변이가 안 먹었다 = F1 은 이 배선을 «안» 보고 있다');
});
