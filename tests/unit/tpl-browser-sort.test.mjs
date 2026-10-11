/* tpl-browser-sort.test.mjs — ★설계 F(b4): ★템플릿 브라우저 ★정렬 옵션
 *
 * ★★찾은 자 = t4quote · ★★고친 자 = t1bstar.
 *
 * ★★★이 묶음의 ★안전판 = ★★F1 — ★★«기본값이 ★지금과 ★같다».
 *   ⛔기본 차례가 ★바뀌면 ★★사람 화면이 ★★말없이 ★달라진다.
 *
 * ★★★그리고 ★★F1 에 ★★내가 ★못 잠근 ★칸이 ★★하나 ★있다 — ★★적어 둔다(⛔숨기지 ★않는다):
 *   ★지금 차례 = ★`loadTemplates()` 의 ★★배열 순서(★`saveAsTemplate` 가 ★`unshift` 한다).
 *   ★새 기본값 = ★★`createdAt` ★내림차순.
 *   ⇒ ★★이 둘은 ★★«모든 레코드의 ★createdAt 차례가 ★삽입 차례와 ★같을 때만» ★★일치한다.
 *   ⇒ ★★★실데이터에서 ★그 둘이 ★어긋나는 레코드가 ★있는지는 ★★내가 ★★못 쟀다
 *      (★t4quote 는 ★46건 ★전부에 ★`createdAt` 이 ★있다고 ★쟀고, ★★«차례가 ★같은가»는 ★★따로다).
 *   ⇒ ★★그래서 ★F1 은 ★★«이미 ★createdAt 내림차순인 ★목록은 ★★안 흔든다»를 ★잠그고,
 *      ★★F1b 가 ★★그 단언이 ★★«항상 참»이 ★아님을 ★증명한다.
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

test('F1 ★★기본값이 ★★«지금과 ★같다» — ★이미 ★createdAt 내림차순인 ★목록을 ★★안 흔든다', () => {
  /* ★`saveAsTemplate` 가 ★`unshift` 하므로 ★배열 순서는 ★«최근 추가가 ★앞»이다 ⇒ ★그 꼴을 ★만든다 */
  const asStored = [
    { id: 'a', name: '세번째저장', createdAt: '2026-10-11T00:00:03Z' },
    { id: 'b', name: '두번째저장', createdAt: '2026-10-11T00:00:02Z' },
    { id: 'c', name: '첫번째저장', createdAt: '2026-10-11T00:00:01Z' },
  ];
  const before = JSON.stringify(asStored);
  const after = W.tplSortApply(asStored, W.tplSortDefault);
  assert.strictEqual(JSON.stringify(after), before, `★기본 정렬이 ★차례를 ★바꿨다 — ★잰 값: ${names(after)}`);
  /* ⛔제자리 정렬이 ★아니어야 한다 — ★부르는 쪽 배열을 ★안 흔든다 */
  assert.strictEqual(JSON.stringify(asStored), before, '★★원본 배열이 ★흔들렸다(★제자리 정렬을 했다)');
  assert.notStrictEqual(after, asStored, '★★같은 배열 객체를 ★돌려줬다 — ★사본이어야 한다');
});

test('F1b ★★F1 이 ★★«항상 참»이 ★아님 — ★차례가 ★어긋난 ★목록은 ★★실제로 ★다시 세운다', () => {
  /* ★★★F1 은 ★★«이미 ★정렬된 ★목록»을 ★먹였다 ⇒ ★★`cmp` 가 ★★죽어도 ★초록일 수 ★있다.
     ⇒ ★★그래서 ★★어긋난 목록으로 ★★한 번 ★더 ★잰다 — ★★이것이 ★F1 의 ★음성대조다. */
  const out = names(W.tplSortApply(SCENE, 'recent'));
  assert.notStrictEqual(out, names(SCENE), '★★어긋난 목록인데 ★차례가 ★안 바뀌었다 — ★`cmp` 가 ★죽었나');
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
    const upto = seg.slice(0, seg.indexOf('</select>')).replace(/<!--[\s\S]*?-->/g, '');
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
     ⇒ ★★조용히 ★틀린 차례. ⇒ ★★그 길을 ★막았음을 ★여기서 ★잠근다. */
  assert.strictEqual(names(W.tplSortApply(SCENE, 'nonsense')), names(W.tplSortApply(SCENE, 'recent')),
    '★모르는 열쇠가 ★기본값과 ★다른 답을 냈다');
  assert.strictEqual(names(W.tplSortApply(SCENE, undefined)), names(W.tplSortApply(SCENE, 'recent')));
  assert.deepStrictEqual(W.tplSortApply(null, 'recent'), [], '★`null` 목록이 ★[] 가 ★아니다');
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
