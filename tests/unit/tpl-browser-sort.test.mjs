/* tpl-browser-sort.test.mjs — ★설계 F(b4): ★템플릿 브라우저 ★정렬 옵션
 *
 * ★★찾은 자 = t4quote · ★★고친 자 = t1bstar.
 *
 * ★★★이 묶음의 ★안전판 = ★★F1 — ★★«기본 열쇠는 ★★아무것도 ★안 한다».
 *   ⛔기본 차례가 ★바뀌면 ★★사람 화면이 ★★말없이 ★달라진다.
 *
 * ★★★F1 이 ★★한 번 ★다시 ★써졌다 — ★★★그 전엔 ★★«데이터가 ★협조해야 ★참»이었다 (지디 ⒝ · 2026-10-11)
 *   ★★전: 「★이미 ★createdAt 내림차순인 ★목록은 ★★안 흔든다」
 *        ⇒ ★★기본이 ★`recent` 였고, ★★«배열 차례 == createdAt 차례»일 ★때만 ★★뜻이 ★있었다.
 *        ⇒ ★★그리고 ★★★그 전제를 ★★나는 ★★못 쟀다 ⇒ ★★안전판이 ★★«운»에 ★얹혀 ★있었다.
 *   ★★후: 「★★기본 열쇠로 ★그린 ★차례 == ★★★정렬 자를 ★★안 거친 ★목록 ★차례」
 *        ⇒ ★★기본 열쇠의 ★`cmp` 가 ★★`null` 이라 ★★`sort` 를 ★★아예 ★안 부른다
 *        ⇒ ★★★데이터와 ★★무관하게 ★참/거짓이 ★갈린다. ★★완전히 ★선다.
 *   ⇒ ★★★이 꼴이 ★왜 ★중요한가: ★★«안 바꿨다»를 ★잠그는 자와 ★★«제대로 ★정렬하나»를 ★잠그는 자는
 *     ★★★갈라 둬야 ★한다. ★★G1(`cmp` → `() => 0`)에서 ★★F1 이 ★초록이고 ★F1b 가 ★빨강인 것이 ★그 증거다.
 *
 * ★★★⚠️무엇을 ★쟀고 ★무엇을 ★안 쟀나 — ★★쪼개 ★적는다(⛔지우지 ★않는다 · ★지디 ⒟＋⑵)
 *   ★★★쟀다: ★★`unshift` ★네 자리(★`template-system.js:372·376·1123·1128`
 *     = ★저장 경로 ★둘[섹션·블록] × ★목록 ★둘[전체캐시·색인]) ⇒ ★★배열은 ★최근 추가 ★내림차순.
 *   ★★★안 쟀다 ★셋 — ★★그래서 ★★«createdAt 차례와 ★같다»로는 ★★못 간다:
 *     ⒜ ★옛·이관 데이터가 ★그 자를 ★거쳤나   ⒝ ★`loadTemplates()`(`:202`)의 ★차례 보존
 *     ⒞ ★`createdAt` 이 ★«저장 시각»인가 ★«만든 시각»인가
 *   ⇒ ★★★누가 ★★`recent` 를 ★★기본으로 ★올리려 ★하면 ★★★이 ★셋이 ★★먼저다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments, stripHtmlComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');

/* ★★앱이 ★싣는 ★차례 ★그대로 ★한 `window` 에 ★쌓는다 — ★★`_tpl-sort.js` 는 ★★혼자서는 ★못 돈다
   (★`byCreatedAtDesc` 를 ★`_gallery-sort.js` 에서 ★받는다) ⇒ ★★그 의존을 ★★여기서 ★재현한다. */
let _loadErr = null;
const W = (() => {
  const win = {};
  try {
    for (const rel of ['js/panels/_gallery-sort.js', 'js/panels/_tpl-sort.js']) {
      // eslint-disable-next-line no-new-func
      new Function('window', fs.readFileSync(path.join(ROOT, rel), 'utf8'))(win);
    }
  } catch (e) { _loadErr = e; }
  return win;
})();

/* ★★장면 — ★★«차례와 ★이름이 ★어긋나게» 심는다(t4quote ★P1).
   ⇒ ★★최근순과 ★이름순이 ★★같은 답을 내면 ★★★항등식이라 ★아무것도 ★안 잠근다. */
const SCENE = Object.freeze([
  { id: 'i1', name: '가', createdAt: '2026-10-11T00:00:03Z' },
  { id: 'i2', name: '나', createdAt: '2026-10-11T00:00:01Z' },
  { id: 'i3', name: '다', createdAt: '2026-10-11T00:00:02Z' },
]);
const names = (list) => list.map(t => t.name).join(',');

test('F0 ★전제 — ★두 자가 ★섰나 ＋ ★★의존이 ★이어졌나', () => {
  assert.strictEqual(_loadErr, null, `★못 돌렸다: ${_loadErr && _loadErr.message}`);
  for (const k of ['TPL_SORTS', 'tplSortApply', 'tplSortOptionsHtml', 'tplSortDefault']) {
    assert.strictEqual(typeof W[k] !== 'undefined', true, `★window.${k} 가 ★없다`);
  }
  assert.strictEqual(typeof W.byCreatedAtDesc, 'function', '★`byCreatedAtDesc` 가 ★없다 — ★의존이 ★끊겼다');
  /* ★★★별칭이 ★★«복제»가 ★아니라 ★★«같은 자»인가 — ⛔아니면 ★명부가 ★둘이 된다 */
  assert.strictEqual(W.byCreatedAtDesc, W.galleryByCreatedAtDesc,
    '★★중립 이름과 ★옛 이름이 ★★다른 함수를 ★가리킨다 — ★★식이 ★두 벌이 ★됐다');
  /* ★P1 — ★★장면이 ★★어긋나게 ★심겼나(⛔이게 ★거짓이면 ★F2·F3 는 ★항등식이다) */
  assert.notStrictEqual(names(W.tplSortApply(SCENE, 'recent')), names(W.tplSortApply(SCENE, 'name')),
    '★★최근순과 ★이름순이 ★★같은 답이다 — ★★장면을 ★어긋나게 ★심어야 한다');
});

test('F1 ★★기본 열쇠로 ★그린 ★차례 == ★★★정렬 자를 ★안 거친 ★목록 ★차례 (⛔데이터와 ★무관하게)', () => {
  /* ★★★일부러 ★★«어긋난» 목록을 ★먹인다 — ★`createdAt` 차례와 ★배열 차례가 ★★다르다.
     ⇒ ★★옛 F1 은 ★★«이미 정렬된» 목록을 ★먹여 ★★데이터의 ★협조를 ★구했다.
       ★★이 꼴은 ★★협조를 ★★안 구한다: ★★어긋났든 ★말든 ★★한 칸도 ★안 움직여야 ★한다. */
  const before = JSON.stringify(SCENE);
  const after = W.tplSortApply(SCENE, W.tplSortDefault);
  assert.strictEqual(JSON.stringify(after), before,
    `★★기본 열쇠가 ★차례를 ★바꿨다 — ★잰 값: ${names(after)} (★먹인 것: ${names(SCENE)})`);
  /* ★★★그리고 ★★이 목록은 ★★«정렬하면 ★달라지는» 목록이어야 ★한다 —
     ⛔안 그러면 ★★위 단언은 ★★«무엇을 해도 참»이 ★된다(★전제를 ★여기서 ★단언한다). */
  assert.notStrictEqual(names(W.tplSortApply(SCENE, 'recent')), names(SCENE),
    '★전제 — ★먹인 목록이 ★★«정렬하면 ★달라지는» 것이어야 ★한다. ⛔아니면 ★F1 은 ★항등식이다');
  /* ⛔제자리 정렬이 ★아니고 ★★사본이다 */
  assert.strictEqual(JSON.stringify(SCENE), before, '★★원본 배열이 ★흔들렸다');
  assert.notStrictEqual(after, SCENE, '★★같은 배열 객체를 ★돌려줬다');
});

test('F1a ★★기본 열쇠는 ★★★`sort` 를 ★★아예 ★안 부른다 — ⛔«안정 정렬에 ★기댄다»가 ★아니다', () => {
  /* ★★★`cmp: null` 인가를 ★★명부에서 ★직접 ★잰다.
     ★★까닭: ★`() => 0` 으로 ★두면 ★★«엔진이 ★안정 정렬이라» 같은 차례가 ★나온다 —
       ★★그러면 ★F1 의 ★뜻이 ★★다시 ★★«무언가의 ★협조»에 ★매달린다.
     ⇒ ★★★그래서 ★★«안 부른다»를 ★★구조로 ★잠근다. */
  assert.strictEqual(W.TPL_SORTS[W.tplSortDefault].cmp, null,
    `★★기본 열쇠의 ★cmp 가 ★null 이 ★아니다(잰 값: ${typeof W.TPL_SORTS[W.tplSortDefault].cmp})`);
  /* ★★★행위로도 ★한 번 — ★`Array.prototype.sort` 를 ★★감시해 ★★«불렸나»를 ★센다 */
  const orig = Array.prototype.sort;
  let calls = 0;
  // eslint-disable-next-line no-extend-native
  Array.prototype.sort = function (...a) { calls++; return orig.apply(this, a); };
  try {
    W.tplSortApply(SCENE, W.tplSortDefault);
    assert.strictEqual(calls, 0, `★★기본 열쇠인데 ★sort 가 ★${calls}번 ★불렸다`);
    W.tplSortApply(SCENE, 'recent');
    assert.ok(calls > 0, '★★전제 — ★`recent` 에서는 ★sort 가 ★불려야 한다(⛔감시자가 ★죽었나)');
  } finally {
    // eslint-disable-next-line no-extend-native
    Array.prototype.sort = orig;
  }
});

test('F1n ★★★F1 의 ★음성대조 — ★기본 열쇠에 ★비교자를 ★억지로 ★끼우면 ★★그 단언이 ★★깨진다', () => {
  /* ★★★지디 ⒞ 가 ★요구한 칸. ⛔파일을 ★고치지 ★않고 ★★여기서 ★모의한다.
     ★★`tplSortApply` 의 ★식을 ★★그대로 ★흉내내면서 ★`cmp` 만 ★끼운다 ⇒
       ★★«기본 열쇠에 ★비교자가 ★들어가면 ★차례가 ★움직인다»를 ★★이 파일 안에서 ★증명한다. */
  const forced = SCENE.slice().sort(W.TPL_SORTS.recent.cmp);
  assert.notStrictEqual(names(forced), names(SCENE),
    '★★비교자를 ★끼웠는데 ★차례가 ★안 움직였다 — ★★그러면 ★F1 은 ★★아무것도 ★안 잠근다');
  assert.strictEqual(names(forced), '가,다,나', `★잰 값: ${names(forced)}`);
});

test('F1b ★`recent` 는 ★★참말 ★다시 세운다 — ★★«기본과 ★다르다»가 ★★행위로 ★선다', () => {
  /* ★★★전엔 ★이 칸이 ★«F1 이 ★항상 참이 ★아님»을 ★맡았다. ★★이제 ★F1 이 ★제 전제를 ★스스로 ★단언하므로
     ★★여기선 ★★«고르는 칸이 ★실제로 ★일하나»만 ★잰다 — ★★둘을 ★갈라 둔다(지디 ⑸). */
  const out = names(W.tplSortApply(SCENE, 'recent'));
  assert.notStrictEqual(out, names(SCENE), '★★`recent` 가 ★차례를 ★안 바꿨다 — ★`cmp` 가 ★죽었나');
  assert.strictEqual(out, '가,다,나', `★잰 값: ${out}`);
});

test('F2 ★`recent` ⇒ ★★가,다,나', () => {
  assert.strictEqual(names(W.tplSortApply(SCENE, 'recent')), '가,다,나');
});

test('F3 ★`name` ⇒ ★★가,나,다 — ★★F2 와 ★★달라야 한다', () => {
  assert.strictEqual(names(W.tplSortApply(SCENE, 'name')), '가,나,다');
  assert.notStrictEqual(names(W.tplSortApply(SCENE, 'name')), names(W.tplSortApply(SCENE, 'recent')),
    '★★두 열쇠가 ★★같은 답이다');
});

test('F4 ★★★함정 — ★`_browserSort` 가 ★`_browserFilter` ★«밖»에 ★산다(★폴더를 골라도 ★정렬이 ★산다)', () => {
  const src = stripComments(readSrc(ROOT, 'js', 'panels', 'template-browser.js'));
  /* ★★★트리 클릭이 ★`_browserFilter` 를 ★★통째로 ★갈아친다 — ★그 줄들을 ★먼저 ★센다(★전제) */
  const replaces = (src.match(/_browserFilter\s*=\s*\{/g) || []).length;
  assert.ok(replaces >= 3,
    `★전제 — _browserFilter 를 ★통째로 ★갈아치는 줄이 ★3 이상이어야 한다(잰 값: ${replaces})`);
  /* ★★★그러니 ★`_browserSort` 는 ★★그 객체 ★안에 ★있어선 ★안 된다 */
  assert.ok(/let\s+_browserSort\s*=/.test(src), '★`_browserSort` 가 ★제 변수로 ★없다');
  assert.ok(!/_browserFilter\s*=\s*\{[^}]*sort/i.test(src),
    '★★`_browserFilter` ★안에 ★정렬이 ★들어갔다 — ★★폴더를 ★고를 때마다 ★정렬이 ★초기화된다');
  /* ★★정렬 리스너가 ★`_browserFilter` 를 ★★안 건드리나 */
  const i = src.indexOf("getElementById('tpl-browser-sort')");
  assert.ok(i > 0, '★정렬 select 를 ★묶는 자가 ★없다');
  const handler = src.slice(i, i + 320);
  assert.ok(!handler.includes('_browserFilter'),
    '★★정렬 핸들러가 ★`_browserFilter` 를 ★건드린다');
});

test('F5 ★★두 창이 ★★같은 명부에서 ★그린다 ＋ ★★의존을 ★★둘 다 ★싣는다', () => {
  const inline = readSrc(ROOT, 'index.html');
  const popout = readSrc(ROOT, 'pages', 'template-browser.html');
  for (const [nm, html] of [['index.html', inline], ['별창', popout]]) {
    assert.ok(/id="tpl-browser-sort"/.test(html), `★${nm} 에 ★정렬 select 가 ★없다`);
    /* ★★★`<option>` 을 ★마크업에 ★★손으로 ★적지 ★않았나 — ★적으면 ★★명부가 ★둘이 된다
       ★★★⚠️HTML ★주석을 ★★먼저 ★걷어낸다 — ★★이 자가 ★처음엔 ★★«내 주석»을 ★잡아 ★빨개졌다(261011):
         ★그 select 안의 ★주석이 ★★글자 그대로 ★`<option>` 을 ★품고 ★있다.
       ⇒ ★★내 교훈 「★주석은 ★«소스 파싱 게이트»의 ★입력」 — ★★오늘 ★★세 번째다.
         ⇒ ★★그러니 ★★게이트는 ★★«산문»이 ★아니라 ★★«마크업»을 ★재야 한다. */
    const seg = html.slice(html.indexOf('id="tpl-browser-sort"'));
    const upto = stripHtmlComments(seg.slice(0, seg.indexOf('</select>')));
    assert.ok(!/<option/.test(upto),
      `★${nm} 의 ★정렬 select 에 option 이 ★박혀 있다 — ★★명부에서 ★그려야 한다`);
    /* ★★★의존 — ★★`_tpl-sort.js` 는 ★혼자 ★못 돈다. ⛔한 창에서 빠지면 ★그 창의 ★기본 정렬이 ★던진다 */
    for (const dep of ['_gallery-sort.js', '_tpl-sort.js']) {
      assert.ok(html.includes(dep), `★${nm} 가 ★${dep} 를 ★안 싣는다`);
    }
  }
});

test('F6 ★`createdAt` ★없는 레코드는 ★★맨 뒤 — ★실데이터 ★0건이어도 ★칸을 ★둔다', () => {
  const mixed = [
    { id: 'x', name: '없는것', createdAt: null },
    { id: 'y', name: '있는것', createdAt: '2026-10-11T00:00:01Z' },
    { id: 'z', name: '빈칸' },
  ];
  const out = W.tplSortApply(mixed, 'recent');
  assert.strictEqual(out[0].name, '있는것', `★맨 앞이 createdAt 있는 것이어야 한다(잰 값: ${out[0].name})`);
  assert.deepStrictEqual(out.slice(1).map(t => t.name).sort(), ['빈칸', '없는것'],
    `★못 읽는 것들이 ★맨 뒤가 ★아니다 — ★잰 값: ${out.map(t => t.name).join(',')}`);
});

test('F7 ★못 아는 ★열쇠는 ★★기본값으로 — ⛔`sort(undefined)` 로 ★★떨어지지 ★않는다', () => {
  /* ★★C11 에서 ★쟀다: ★`sort(undefined)` 는 ★★던지지 ★않고 ★★기본 ★문자열 비교로 ★간다
     ⇒ ★★조용히 ★틀린 차례. ⇒ ★★그 길을 ★막았음을 ★여기서 ★잠근다.
     ★★★⚠️이 칸은 ★★한 번 ★빨개졌다(261011) — ★★★내가 ★기대값을 ★★`'recent'` 로 ★★손으로 ★박았고,
       ★★지디 ⒝ 로 ★★기본 열쇠가 ★★`'default'` 가 ★되자 ★★그 박은 값이 ★★거짓이 ★됐다.
     ⇒ ★★★그래서 ★★«기본»을 ★★이름으로 ★가리킨다(`W.tplSortDefault`) — ⛔열쇠를 ★손으로 ★박지 ★마라.
       (★내 명부: ★「★출력·단언에 ★«결론»을 ★손으로 ★박지 ★마라 — ★명부가 ★참값이다」) */
  const base = names(W.tplSortApply(SCENE, W.tplSortDefault));
  for (const bad of ['nonsense', undefined, null, '', 0, {}]) {
    assert.strictEqual(names(W.tplSortApply(SCENE, bad)), base,
      `★모르는 열쇠 ${JSON.stringify(bad)} 가 ★기본값과 ★다른 답을 냈다`);
  }
  /* ★★★전제 — ★★«기본»과 ★«고르는 칸»이 ★★서로 ★다른 답을 ★내야 ★이 칸에 ★뜻이 ★있다.
     ⛔둘이 ★같으면 ★★위 ★루프는 ★★무엇이 ★와도 ★참이다. */
  assert.notStrictEqual(names(W.tplSortApply(SCENE, 'recent')), base,
    '★전제 — ★`recent` 가 ★기본과 ★같은 답이다 ⇒ ★★이 칸이 ★항등식이 ★된다');
  assert.deepStrictEqual(W.tplSortApply(null, 'recent'), [], '★`null` 목록이 ★[] 가 ★아니다');
  assert.deepStrictEqual(W.tplSortApply(undefined, W.tplSortDefault), [], '★`undefined` 목록이 ★[] 가 ★아니다');
});

test('F10 ★★제품이 ★★손으로 ★적은 ★기본 열쇠 ★글자 == ★★명부의 ★`tplSortDefault`', () => {
  /* ★★★이 칸은 ★★제품 주석이 ★★«검사가 ★잠근다»고 ★★약속한 ★그 칸이다.
     ★★★261011 — ★★그 약속을 ★적고 ★★★단언은 ★안 썼다. ★★그 사이 ★지디 ⒝ 로 ★기본이 ★바뀌자
     ★★제품의 ★세 자리(`let _browserSort` · ★열 때 ★폴백 · ★리스너 ★폴백)가 ★★★전부 ★거짓이 ★됐고
     ★★★아무 검사도 ★★빨개지지 ★않았다. ⇒ ★★«약속한 ★단언»은 ★★쓰기 전까진 ★★없는 것이다.
     (★내 명부: ★「★적는 것 ≠ ★갖다 대는 것」 · ★「★규칙은 ★재는 자가 ★있어야 ★집행된다」) */
  const src = stripComments(readSrc(ROOT, 'js', 'panels', 'template-browser.js'));
  const lits = [...src.matchAll(/_browserSort\s*=\s*(?:[^;]*\|\|\s*)?'([a-z]+)'/g)].map(m => m[1]);
  assert.ok(lits.length >= 3, `★기본 열쇠를 ★글자로 ★적은 자리가 ★3 미만이다(잰 값: ${lits.length})`);
  for (const l of new Set(lits)) {
    assert.ok(W.TPL_SORTS[l], `★제품이 ★적은 ★열쇠 '${l}' 가 ★★명부에 ★없다`);
    assert.strictEqual(l, W.tplSortDefault,
      `★★제품의 ★글자 '${l}' 가 ★★명부의 ★기본('${W.tplSortDefault}')과 ★다르다 — ★★세 자리를 ★같이 ★고쳐라`);
  }
});

test('F8 ★★`<option>` 이 ★★명부에서 ★★그려지나 — ★★열쇠·라벨이 ★★명부와 ★같다', () => {
  const html = W.tplSortOptionsHtml(W.tplSortDefault);
  const keys = Object.keys(W.TPL_SORTS);
  assert.strictEqual((html.match(/<option/g) || []).length, keys.length,
    `★option 수가 ★명부와 ★다르다 — ★잰 값: ${html}`);
  for (const k of keys) {
    assert.ok(html.includes(`value="${k}"`), `★열쇠 ${k} 의 ★option 이 ★없다`);
    assert.ok(html.includes(W.TPL_SORTS[k].label), `★라벨 「${W.TPL_SORTS[k].label}」 이 ★없다`);
  }
  /* ★★★고른 칸이 ★★하나뿐인가 — ⛔둘이면 ★브라우저가 ★마지막 것을 ★고른다 */
  assert.strictEqual((html.match(/ selected/g) || []).length, 1, `★selected 가 ★하나가 ★아니다: ${html}`);
  assert.ok(html.includes(`value="${W.tplSortDefault}" selected`), '★기본값이 ★안 골라져 있다');
});

test('F9 ★★고전 스크립트인가 — ⛔`export` 가 ★들어오면 ★별창이 ★죽는다', () => {
  for (const rel of ['_tpl-sort.js', '_gallery-sort.js']) {
    const body = stripComments(readSrc(ROOT, 'js', 'panels', rel));
    assert.ok(!/^\s*(export|import)\s/m.test(body), `★${rel} 에 ★export·import 가 ★들어왔다`);
  }
});
