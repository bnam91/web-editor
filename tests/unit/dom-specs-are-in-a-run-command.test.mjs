/* dom-specs-are-in-a-run-command — ★★`tests/dom/*` 가 ★★«어떤 명령으로도 ★안 돌던» 구멍을 ★막는다.
 *   (2026-10-24 · 지디 · ★★★내가 ★그 구멍에 ★빠진 ★뒤에 ★세운다)
 *
 * ★★★왜 생겼나(★실측 · ★안 꾸민다):
 *   ★261024 에 ★`js/io/capture-safety.js` 한 줄을 고쳤다. ⇒ ★★`tests/dom/thumbnail-strip-parity.dom.spec.js`
 *     의 ★기대값(`annotation: false`)이 ★★거짓이 ★됐다.
 *   ★★그런데 ★`npm test` 의 ★글롭이 ★★`tests/unit/*` ★뿐이라 ★★그 빨강이 ★★★안 ★보였다.
 *   ⇒ ★★★지디가 ★`fail 0` 을 ★★네 번 ★보고하는 ★동안 ★★그 축은 ★★★0 회 ★쟀다.
 *   ★★증명 : ★옛 기대값으로 ★되돌려 ★돌리니 ★★`T1` 이 ★★rc 1 · 1 failed (★261024 실측).
 *   ⇒ ★★교훈 「★`npm test` 통과가 ★«검사 ★전부 ★통과»가 ★아니다」를 ★★★제가 ★밟았다.
 *
 * ★★이 자가 ★막는 것 : ★★★«어떤 ★npm 명령으로도 ★안 ★돌는 ★spec 이 ★생기는 ★것».
 *   ⛔이 자는 ★★그 spec 들을 ★★돌리지 ★않는다(★playwright 는 ★`node --test` 밖이다).
 *     ⇒ ★★★«돌 ★길이 ★있나»만 ★잰다. ★★그게 ★이 자가 ★정직하게 ★잴 수 ★있는 ★전부다.
 *   ★★★돌리는 것은 ★사람·게이트의 몫 : ★★`npm run test:all` (= `npm test && npm run test:dom`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('D1 ★`tests/dom/*.dom.spec.js` 를 ★도는 ★npm 명령이 ★★있다', () => {
  const s = PKG.scripts || {};
  assert.ok(s['test:dom'], '⛔`test:dom` 이 없다 — ★DOM 검사를 ★도는 길이 ★사라졌다');
  assert.match(s['test:dom'], /playwright/, '⛔`test:dom` 이 playwright 를 안 부른다');
  assert.match(s['test:dom'], /tests\/dom\//, '⛔`test:dom` 이 tests/dom 설정을 안 가리킨다');
});

test('D2 ★★★«한 번에 ★둘 다» 도는 ★명령이 ★있다 — ★`test:all`', () => {
  const s = PKG.scripts || {};
  assert.ok(s['test:all'], '⛔`test:all` 이 없다 — ★261024 의 그 구멍이 ★다시 열렸다');
  assert.match(s['test:all'], /npm (run )?test\b/, '⛔`test:all` 이 단위를 안 부른다');
  assert.match(s['test:all'], /test:dom/, '⛔`test:all` 이 ★DOM 을 안 부른다 — ★그게 ★구멍의 ★몸통이었다');
});

test('D3 ★★`npm test` 는 ★★`tests/dom` 을 ★★안 ★돈다 — ★★★그 사실을 ★★못박는다(★사실 단언)', () => {
  /* ⛔이것은 ★「고쳐야 할 것」이 ★아니다 — ★`node --test` 가 ★playwright spec 을 ★못 돈다.
     ★★이 단언의 뜻 : ★★★«그러니 ★`npm test` 초록을 ★«전부 초록»으로 ★읽지 ★마라».
     ★★만약 ★누가 ★글롭을 ★넓혀 ★여기가 ★빨개지면 ⇒ ★★그때 ★이 칸을 ★★뜻을 ★뒤집어 ★다시 적어라(⛔지우지 마라). */
  assert.ok(!/tests\/dom/.test(PKG.scripts.test),
    '★`npm test` 가 이제 tests/dom 을 가리킨다 — ★이 칸의 뜻이 바뀌었다. ★뒤집어 다시 적어라');
});

test('D4 ★★★음성대조 — ★이 자가 ★★«항상 참»이 ★아니다', () => {
  /* ★261004 교훈: ★내가 건 단언이 ★«항상 참»이라 ★아무것도 안 잠근 일이 있었다.
     ⇒ ★여기선 ★«없는 이름»으로 ★자가 ★죽지 않았음을 ★보인다. */
  const s = PKG.scripts || {};
  assert.equal(s['test:zz-no-such'], undefined, '★자가 죽었다 — 없는 스크립트가 있다고 나온다');
  assert.ok(!/test:zz-no-such/.test(s['test:all'] || ''), '★자가 죽었다');
});

test('D5 ★★분모 — ★`tests/dom` 에 ★spec 이 ★★실제로 ★있다(★0 이면 ★이 자가 ★무의미하다)', (t) => {
  const dir = path.join(ROOT, 'tests', 'dom');
  const specs = fs.readdirSync(dir).filter((n) => /\.dom\.spec\.js$/.test(n));
  assert.ok(specs.length > 0, '⛔tests/dom 에 spec 이 0 개다 — ★이 자가 ★재는 것이 ★없다');
  t.diagnostic(`tests/dom spec 수 = ${specs.length}`);
});
