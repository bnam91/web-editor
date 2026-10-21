/* template-id-collision.test.mjs — ★C: ★`tpl_` ★id 가 ★★같은 ms 에 ★★겹치지 ★않는다
 *
 * ★★찾은 자 = t4quote(★실측: ★같은 ms 에 ★둘 저장 ⇒ ★★`.tb-card.selected` 가 ★★2개가 된다)
 * ★★고친 자 = t1bstar · ★★꼴은 ★★이 파일의 ★선례(★옛 `btpl_` 줄)에서 ★가져왔다 — ★지어낸 것 ★0
 *
 * ★★★단언의 ★꼴 — ★t4quote 조건 ★그대로:
 *   ⛔★★실제로 ★같은 ms 를 ★맞추려 ★하지 ★마라 — ★★불안정하다(★기계·부하에 ★딸린다)
 *   ⇒ ★★`Date.now` 를 ★★가짜로 ★고정해 ★★두 번 ★부른다 ⇒ ★★id 가 ★★달라야 ★한다
 *
 * ★★이 파일은 ★`type="module"`(★`index.html:1051`)이라 ★★ESM 이다 — ★★그러나 ★★import 하면
 *   ★★DOM 을 ★건드린다. ⇒ ★★그래서 ★★그 함수 ★하나만 ★떼어 ★★돌린다(★소스에서 ★뽑아 ★eval).
 *   ⚠️★★그 꼴의 ★한계: ★★«그 함수가 ★★참으로 ★그 자리에서 ★불리나»는 ★★아래 ★소스 단언이 ★잰다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const RAW = readSrc(ROOT, 'js', 'panels', 'template-system.js');
const SRC = stripComments(RAW);

/** ★그 함수 ★하나만 ★떼어 ★★돌릴 수 있게 ★만든다 */
function mkFn() {
  const m = /function _mkTplId\(prefix\)\s*\{[\s\S]*?\n\}/.exec(SRC);
  assert.ok(m, '★전제 깨짐 — ★`_mkTplId` 를 ★소스에서 ★못 찾았다');
  // 떠낸 판은 같은 모듈의 다른 최상위 이름을 못 본다 — ReferenceError 면 빠진 이름을 찍는다(duplicate-zoom 하네스와 같은 꼴).
  const named = (e) => {
    const x = (e instanceof ReferenceError) ? ((/^(\S+) is not defined/.exec(e.message) || [])[1]) : null;
    return x ? new Error(`떠낸 판에 «${x}» 가 없다 — 이 시험의 new Function 인자(스텁 명부)에 더해라 (${e.message})`) : e;
  };
  let f;
  // eslint-disable-next-line no-new-func
  try { f = new Function(`${m[0]}; return _mkTplId;`)(); } catch (e) { throw named(e); }
  return (...a) => { try { return f(...a); } catch (e) { throw named(e); } };
}

test('C1 ★★★같은 ms 를 ★가짜로 ★고정해도 ★id 가 ★다르다 (★t4quote 조건 — ⛔경쟁을 ★맞추지 ★않는다)', () => {
  const mk = mkFn();
  const real = Date.now;
  try {
    Date.now = () => 1775018641878;            /* ★★고정 — ★★«같은 ms»를 ★확정으로 ★만든다 */
    const a = mk('tpl_');
    const b = mk('tpl_');
    /* ★전제 — ★★그 고정이 ★★참으로 ★먹었나(⛔안 먹으면 ★이 칸은 ★«안 쟀다»다) */
    assert.ok(a.startsWith('tpl_1775018641878'),
      `★전제 깨짐 — ★고정한 ms 가 ★id 에 ★안 들어갔다 (잰 값: ${a})`);
    assert.ok(b.startsWith('tpl_1775018641878'), `★전제 깨짐 — 둘째도 (잰 값: ${b})`);
    /* ★★본 단언 */
    assert.notStrictEqual(a, b,
      `★★같은 ms 에서 ★id 가 ★★같다 (잰 값: ${a}) — ★★겹치면 ★.tb-card.selected 가 ★★둘이 된다(t4quote 실측)`);
    /* ★★그리고 ★★많이 ★불러도 ★겹치지 ★않나 — ★★«두 번»만으로는 ★약하다 */
    Date.now = () => 1775018641878;
    const many = new Set(Array.from({ length: 200 }, () => mk('tpl_')));
    assert.strictEqual(many.size, 200,
      `★★200번 중 ★★${200 - many.size}건이 ★겹쳤다 — ★꼬리가 ★너무 ★짧다`);
  } finally { Date.now = real; }
});

test('C2 ★`_safeSeg` 를 ★지나도 ★★살아남나 — ★★id 는 ★파일명이 ★된다(main.js:4281)', () => {
  const mk = mkFn();
  const id = mk('tpl_');
  /* ★★`main.js:1838` 의 ★그 식 ★그대로 — ⛔내가 ★새로 ★짓지 ★않았다 */
  const safeSeg = (s) => {
    const v = String(s || '').replace(/[^\w.-]/g, '_');
    return (v === '' || /^\.+$/.test(v)) ? '_' : v;
  };
  assert.strictEqual(safeSeg(id), id,
    `★★세척이 ★id 를 ★바꿨다 — ★원본 ${id} · ★세척 ${safeSeg(id)}\n`
    + '  ⇒ ★★그러면 ★★두 id 가 ★★같은 파일명으로 ★무너질 수 ★있다');
});

test('C3 ★★«한 자리»인가 — ★★두 자리가 ★★제 식을 ★다시 적지 ★않는다', () => {
  /* ★★★주석을 ★뗀 뒤에 ★센다 — ★★이 파일 ★머리말이 ★★옛 꼴을 ★★글자로 ★품는다
     (★안 떼면 ★★내 주석이 ★측정값이 ★된다 — ★내 교훈) */
  const direct = (SRC.match(/'b?tpl_'\s*\+\s*Date\.now/g) || []).length;
  assert.strictEqual(direct, 0,
    `★★id 식을 ★직접 적은 자리가 ★${direct}곳 ★있다 — ★★명부가 ★둘이 된다`);
  const calls = (SRC.match(/_mkTplId\(/g) || []).length;
  assert.strictEqual(calls, 3,
    `★★_mkTplId 가 ★${calls}번 ★나온다 — ★정의 ★1 ＋ ★호출 ★2 = ★3 이어야 한다`);
  assert.match(SRC, /const id\s+=\s+_mkTplId\('tpl_'\)/, '★★섹션 템플릿이 ★그 자를 ★안 쓴다');
  assert.match(SRC, /const id\s*=\s*_mkTplId\('btpl_'\)/, '★★블록 템플릿이 ★그 자를 ★안 쓴다');
  /* ★★꼬리가 ★참으로 ★붙나 — ★★그 함수 ★본문을 ★이름으로 */
  assert.match(SRC, /Math\.random\(\)\.toString\(36\)\.slice\(2, 4\)|Math\.random\(\)\.toString\(36\)\.slice\(2, 6\)/,
    '★★무작위 ★꼬리가 ★없다 — ★★그러면 ★같은 ms 에서 ★겹친다');
});
