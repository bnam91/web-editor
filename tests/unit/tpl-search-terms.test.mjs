/* tpl-search-terms.test.mjs — ★E＋select(b3): ★★검색이 ★★«모드 × AND» ★두 축으로 ★선다
 *
 * ★★찾은 자 = t4quote (★설계 b3 ＋ ★`tpl-browser-search-mode` 가 ★죽어 있음을 ★자 ★여섯으로 쟀다)
 * ★★고친 자 = t1bstar.
 *
 * ★★이 파일이 ★잠그는 것 — ★정본의 ★★일곱 칸(⒜~⒢) ＋ ★전제 ＋ ★음성대조:
 *   ★T1 ★전제     — ★그 자가 ★`window` 에 ★섰나 ＋ ★★고전 스크립트인가(⛔`export` 금지)
 *   ★⒜ `qna`      ⇒ ★2건
 *   ★⒝ `qna&demo` ⇒ ★1건 (★AND)
 *   ★⒞ `레거시,war` ⇒ ★1건
 *   ★⒟ ★구분자 ★셋이 ★★같은 결과
 *   ★⒠ ★★★엄격 부등호 — ★`|qna&demo| < |qna|` (★★이 칸이 ★`every`→`some` ★무력화에 ★빨개진다)
 *   ★⒡ ★★∅ — ★빈 검색어·구분자만 ⇒ ★`[].every(...) === true` ⇒ ★전체
 *   ★⒢ ★★모드 ★양성대조 — ★「태그」면 ★name 에만 ★있는 낱말이 ★★안 걸린다
 *   ★T9 ★음성대조  — ★위 칸들이 ★★«언제나 ★빨강»이 ★아니다
 *
 * ★★⒠ 와 ⒢ 가 ★이 파일의 ★핵이다 — ★★나머지는 ★★«AND 가 ★안 걸려도» 혹은 ★★«모드가 ★죽어도»
 *   ★★통과할 ★수 ★있다. ★그 둘만이 ★★두 축을 ★★각각 ★잠근다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const SRC_REL = 'js/panels/_tpl-search.js';

/* ★★그 자는 ★★고전 스크립트다 — ⛔`import` 로 ★못 끌어온다.
   ⇒ ★★`window` 를 ★하나 ★만들어 ★그 안에서 ★돌린다(★앱이 ★싣는 ★꼴과 ★같게). */
/* ★★★`try` 로 ★감싼 ★까닭 — ★★261011 에 ★쟀다:
   ★`export` 를 ★넣는 ★변이(M5)를 ★걸면 ★★`new Function` 이 ★★SyntaxError 로 ★터져
   ★★★이 파일이 ★★통째로 ★죽고 ★★T1 의 ★단언은 ★★한 번도 ★안 돈다.
   ⇒ ★★그러면 ★★T1 의 ★`export` 금지 단언은 ★★«항상 ★참»인 ★자가 된다 — ★★아무것도 ★안 잠근다.
   ⇒ ★★그래서 ★★터짐을 ★★여기서 ★받아 ★★T1 이 ★★«까닭을 ★이름 붙여» ★빨개지게 ★한다.
   (★내 교훈: 「★내가 건 단언이 ★«항상 참»이라 ★아무것도 ★안 잠갔다」) */
let _loadErr = null;
const W = (() => {
  try {
    const src = fs.readFileSync(path.join(ROOT, SRC_REL), 'utf8');
    const win = {};
    // eslint-disable-next-line no-new-func
    new Function('window', src)(win);
    return win;
  } catch (e) { _loadErr = e; return {}; }
})();

/* ★★장면 — ★t4quote 가 ★회차52 에서 ★★손으로 ★세워 본 ★그 셋(★`감마` 는 ★겹치지 ★않는 ★대조군).
   ★★`qna` ∩ `solo` = ★0 ⇒ ★★감마가 ★★«AND 가 ★좁힌다»의 ★바닥을 ★만든다. */
const SCENE = Object.freeze([
  { id: 'a', name: 'QA 알파', folder: 'QA', category: 'demo',   tags: ['qna'] },
  { id: 'b', name: 'QA 베타', folder: 'QA', category: '레거시', tags: ['war', 'qna'] },
  { id: 'c', name: 'QA 감마', folder: 'QA', category: 'solo',   tags: ['xyz'] },
]);
const ids = (q, mode = 'all') => W.tplSearchFilter(SCENE, q, mode).map(t => t.id).sort().join(',');
const n   = (q, mode = 'all') => W.tplSearchFilter(SCENE, q, mode).length;

test('T1 ★전제 — ★그 자가 ★`window` 에 ★섰나 ＋ ★★고전 스크립트인가', () => {
  /* ★★★이 줄이 ★★진짜 ★계측기다 — ★`export`/`import` 가 ★들어오면 ★★여기서 ★★까닭이 ★이름 붙는다.
     ⛔아래 ★정규식 ★단언은 ★★이 줄 ★없이는 ★★«항상 참»이다(★터짐이 ★먼저 온다) ⇒ ★★둘을 ★같이 ★둔다. */
  assert.strictEqual(_loadErr, null,
    `★★그 자를 ★★고전 스크립트로 ★못 돌렸다 — ★★export·import 가 ★들어왔나? ★잰 값: ${_loadErr && _loadErr.message}`);
  for (const k of ['tplSearchTerms', 'tplSearchFields', 'tplSearchMatch', 'tplSearchFilter']) {
    assert.strictEqual(typeof W[k], 'function', `★window.${k} 가 ★함수가 ★아니다(잰 값: ${typeof W[k]})`);
  }
  /* ★★★이 칸이 ★★별창을 ★지킨다 — ★`pages/template-browser.html` 이 ★★고전 스크립트로 ★싣는다.
     ★★`.mjs` 사본 `node --check` 는 ★★«싣는 꼴»을 ★★못 본다 ⇒ ★★여기서 ★잠근다. */
  const body = stripComments(readSrc(ROOT, 'js', 'panels', '_tpl-search.js'));
  assert.ok(!/^\s*(export|import)\s/m.test(body),
    '★★`export`·`import` 가 ★들어왔다 — ★이 자는 ★`<script src>` 로도 ★실린다 ⇒ ★★별창이 ★죽는다');
});

test('⒜ `qna` ⇒ ★2건 (★알파·베타 — ★둘 다 ★태그에 있다)', () => {
  assert.strictEqual(ids('qna'), 'a,b', `★잰 값: ${ids('qna')}`);
});

test('⒝ `qna&demo` ⇒ ★★1건 — ★★AND 다(★`demo` 는 ★알파의 ★category 에만 있다)', () => {
  assert.strictEqual(ids('qna&demo'), 'a', `★잰 값: ${ids('qna&demo')}`);
});

test('⒞ `레거시,war` ⇒ ★★1건 — ★낱말이 ★★다른 칸에 ★흩어져도 ★걸린다(category ＋ tags)', () => {
  assert.strictEqual(ids('레거시,war'), 'b', `★잰 값: ${ids('레거시,war')}`);
});

test('⒟ ★구분자 ★셋(`&`·`,`·공백)이 ★★같은 결과', () => {
  const a = ids('qna&demo'), b = ids('qna,demo'), c = ids('qna demo');
  assert.strictEqual(a, b, `★\`&\` ${a} vs \`,\` ${b}`);
  assert.strictEqual(b, c, `★\`,\` ${b} vs 공백 ${c}`);
  /* ★★섞어 써도 ★같아야 한다 — ★★정규식이 ★★`[&,\s]+` ★한 벌이라 ★★연달아 와도 ★한 번으로 ★쪼갠다 */
  assert.strictEqual(ids('qna , & demo'), a, `★섞음 ${ids('qna , & demo')} vs ${a}`);
});

test('⒠ ★★★AND 가 ★★진짜 ★좁히나 — ★★엄격 부등호 `|qna&demo| < |qna|`', () => {
  const few = n('qna&demo'), many = n('qna');
  /* ★★바닥을 ★★먼저 ★단언한다 — ⛔`0 < 0` 이 ★★거짓이라 ★★«장면이 ★죽어도» 빨개지지만,
     ★★그 빨강은 ★★«AND 가 ★깨졌다»와 ★★구분이 ★안 된다 ⇒ ★★분모를 ★따로 ★잠근다.
     (★★내 교훈: ★「★검사는 ★제 ★전제를 ★단언해야 한다」) */
  assert.ok(many >= 2, `★전제가 ★섰나 — \`qna\` 가 ★2건 이상이어야 한다(잰 값: ${many})`);
  assert.ok(few >= 1,  `★전제가 ★섰나 — \`qna&demo\` 가 ★1건 이상이어야 한다(잰 값: ${few})`);
  assert.ok(few < many,
    `★★AND 가 ★안 걸렸다 — |qna&demo|=${few} 가 |qna|=${many} 보다 ★작아야 한다`);
});

test('⒡ ★★∅ — ★빈 검색어·★구분자만 ⇒ ★`[].every(...) === true` ⇒ ★★전체가 ★보인다', () => {
  /* ★★★먼저 ★★`[].every` ★그 자체를 ★단언한다 — ★★이것이 ★★내 명부의 ★«∅ 자리»다.
     ⛔「전체가 보인다」만 재면 ★★«빠른 길»이 ★★그 답을 ★대신 내 주고 ★★`every` 는 ★안 재진다. */
  assert.strictEqual([].every(() => false), true, '★`[].every` 가 ★true 가 ★아니다(★자가 ★깨졌다)');
  assert.strictEqual(W.tplSearchMatch(SCENE[2], [], 'all'), true,
    '★★낱말 ★0개인데 ★★안 맞았다 — ★`every` 의 ★∅ 자리가 ★죽었다');
  for (const q of ['', '   ', '&', ',,', ' & , ', null, undefined]) {
    assert.deepStrictEqual(W.tplSearchTerms(q), [], `★\`${String(q)}\` 가 ★[] 가 ★아니다(잰 값: ${JSON.stringify(W.tplSearchTerms(q))})`);
    assert.strictEqual(n(q), SCENE.length, `★\`${String(q)}\` 에서 ★전체(${SCENE.length})가 ★안 나왔다(잰 값: ${n(q)})`);
  }
});

test('⒢ ★★★모드 ★양성대조 — ★「태그」면 ★name 에만 ★있는 낱말이 ★★안 걸린다', () => {
  /* ★★`알파` 는 ★★name 에만 ★있다(tags=['qna']) ⇒ ★★모드가 ★살아 있으면 ★★태그 모드에서 ★0건. */
  assert.strictEqual(n('알파', 'all'), 1, `★전제 — ★전체 모드에서는 ★1건이어야 한다(잰 값: ${n('알파', 'all')})`);
  assert.strictEqual(n('알파', 'tag'), 0,
    `★★모드가 ★죽었다 — ★태그 모드인데 ★name 의 낱말이 ★걸렸다(잰 값: ${n('알파', 'tag')})`);
  /* ★★★반대 방향도 ★잰다 — ★★한 방향만 재면 ★★«항상 0 을 ★내는 자»와 ★구분이 ★안 된다 */
  assert.strictEqual(ids('qna', 'tag'), 'a,b', `★태그 모드에서 ★태그 낱말은 ★걸려야 한다(잰 값: ${ids('qna', 'tag')})`);
  /* ★★「파일명」 모드 — ★`qna` 는 ★★어느 name 에도 ★없다 ⇒ ★0건 */
  assert.strictEqual(n('qna', 'name'), 0, `★파일명 모드에서 ★태그 낱말이 ★걸렸다(잰 값: ${n('qna', 'name')})`);
  assert.strictEqual(ids('알파', 'name'), 'a', `★파일명 모드에서 ★name 낱말은 ★걸려야 한다(잰 값: ${ids('알파', 'name')})`);
  /* ★★못 아는 모드는 ★★'all' 과 ★같다 — ★★옛 동작을 ★★기본으로 ★둔다 */
  assert.strictEqual(ids('qna', 'nonsense-mode'), ids('qna', 'all'), '★모르는 모드가 ★all 과 ★안 같다');
});

test('T9 ★★음성대조 — ★위 칸들이 ★★«언제나 ★빨강»이 ★아니다', () => {
  /* ★★★하나라도 ★걸리는 ★장면이 ★있어야 ★자가 ★산 것이다 — ⛔전부 0 을 내는 자도 ★⒢ 를 ★통과한다 */
  assert.ok(n('qna') > 0 && n('', 'tag') > 0 && n('war', 'tag') > 0,
    `★자가 ★아무것도 ★못 찾는다 — qna=${n('qna')} · 빈값/tag=${n('', 'tag')} · war/tag=${n('war', 'tag')}`);
  /* ★★그리고 ★★«전부 ★찾는 자»도 ★아니다 */
  assert.strictEqual(n('없는낱말'), 0, `★없는 낱말이 ★걸렸다(잰 값: ${n('없는낱말')})`);
  assert.ok(n('qna') < SCENE.length, `★qna 가 ★전체를 ★다 집었다(${n('qna')}/${SCENE.length})`);
});

test('T11 ★★두 창이 ★★같은 자를 ★싣나 — ⛔한 쪽만 ★싣면 ★별창이 ★★죽는다', () => {
  /* ★★★순서를 ★★단언하지 ★않는다 — ★C11 에서 ★쟀다: ★참조는 ★★부를 때 ★풀리므로
     ★★순서를 ★뒤집어도 ★안 깨진다 ⇒ ★★그걸 ★잠그면 ★★거짓 단언이다(★항상 참인 자).
     ★★잠글 수 ★있는 ★참값은 ★★«두 창에 ★★있나» ★하나다 — ★★없으면 ★★그 창에서 ★★throw 다. */
  for (const rel of [['index.html'], ['pages', 'template-browser.html']]) {
    const html = readSrc(ROOT, ...rel);
    assert.ok(/_tpl-search\.js/.test(html),
      `★${rel.join('/')} 가 ★\`_tpl-search.js\` 를 ★안 싣는다 — ★그 창에서 ★\`tplSearchFilter\` 가 ★undefined 다`);
    assert.ok(/panels\/template-browser\.js/.test(html), `★전제 — ★${rel.join('/')} 가 ★소비자를 ★안 싣는다`);
  }
});

test('T10 ★★소비자가 ★제 식을 ★다시 적지 ★않는다 — ★★«한 자리»인가', () => {
  const tb = stripComments(readSrc(ROOT, 'js', 'panels', 'template-browser.js'));
  /* ★★옛 꼴(★낱말 ★하나를 ★넷에 ★OR)이 ★남아 있으면 ★★명부가 ★둘이 된다 */
  assert.ok(!/_browserSearchQ\.toLowerCase\(\)/.test(tb),
    '★옛 검색식(`_browserSearchQ.toLowerCase()`)이 ★남아 있다 — ★★식이 ★두 자리에 산다');
  assert.ok(/window\.tplSearchFilter\(/.test(tb), '★소비자가 ★`tplSearchFilter` 를 ★안 부른다');
  /* ★★그리고 ★★그 select 를 ★★실제로 ★읽나 — ★★이것이 ★«살렸다»의 ★증거다 */
  assert.ok(/tpl-browser-search-mode/.test(tb),
    '★★`tpl-browser-search-mode` 를 ★읽는 JS 가 ★없다 — ★★그 칸이 ★아직 ★죽어 있다');
});
