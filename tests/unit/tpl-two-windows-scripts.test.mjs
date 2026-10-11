/* tpl-two-windows-scripts.test.mjs — ★★두 창이 ★싣는 ★스크립트 ★★집합 (지디 요청 · 2026-10-11)
 *
 * ★★★왜 ★생겼나 — ★★«두 창» 병의 ★★★새 갈래를 ★실물로 ★밟았다(261011):
 *   ★`pages/template-browser.html` 이 ★★`_gallery-sort.js` 를 ★★★0건 싣고 ★있었다.
 *   ★★C11 부터 ★그랬는데 ★★그때는 ★별창이 ★그 자를 ★★안 써서 ★★증상이 ★없었다.
 *   ⇒ ★★설계 F 를 ★그대로 ★넣으면 ★★★별창의 ★기본 정렬이 ★던지고 ★★카드 그리기가 ★통째로 ★죽었다.
 *
 * ★★★그리고 ★★`tpl-browser-two-windows.test.mjs`(설계 B)로는 ★★★이게 ★안 잡힌다:
 *   ★★B 는 ★★«id 집합»으로 ★재고 ★★이건 ★★«의존»으로 ★났다. ★★★같은 자로는 ★안 잡힌다.
 *   ⇒ ★★그래서 ★★«자»를 ★하나 ★더 ★둔다 — ★★축이 ★다르다.
 *
 * ★★★명부를 ★★손으로 ★적지 ★않는다(지디 ⛔):
 *   ★★두 HTML 에서 ★★`<script src>` 를 ★★★뽑아 ★★«파일 이름 집합»으로 ★견준다.
 *   ★★★«파일 이름»으로 ★견주는 ★까닭: ★경로가 ★다르고(★`js/…` vs ★`../js/…`) ★꼴도 ★다르다
 *     (★인라인은 ★`type="module"` 을 ★쓰고 ★★별창은 ★★안 쓴다) ⇒ ★★★이름만이 ★견줄 수 ★있는 축이다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc, } = require('./_srcread.js');
const { stripHtmlComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');

/** ★한 HTML 이 ★싣는 ★스크립트의 ★★«파일 이름» 집합.
 *  ★★★주석을 ★★먼저 ★걷는다 — ★★261011 에 ★★같은 꼴로 ★★네 번 ★속았다:
 *    ★게이트가 ★★«내가 ★주석에 ★적은 ★예시»를 ★★측정값으로 ★읽었다.
 *    ⇒ ★★이 파일 ★머리말에도 ★★`_gallery-sort.js` 가 ★★글자로 ★있다 ⇒ ★★걷지 ★않으면
 *      ★★★«주석에 ★있으니 ★실린다»가 ★된다. ⇒ ★★공용 `stripHtmlComments` 로 ★걷는다. */
function scriptsFrom(htmlText) {
  const html = stripHtmlComments(String(htmlText));
  const out = new Set();
  for (const m of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
    out.add(m[1].split('/').pop());
  }
  return out;
}
const scriptsOf = (...rel) => scriptsFrom(readSrc(ROOT, ...rel));

/* ★★★두 창이 ★★«공유하는» 자들만 ★견준다 — ★★전수를 ★견주면 ★★★거짓 빨강이 ★쏟아진다:
     ★인라인은 ★앱 ★전체(★에디터·패널·그리기 …)를 ★싣고 ★★별창은 ★★템플릿 브라우저만 ★싣는다.
   ⇒ ★★★과녁 = ★★«별창이 ★★싣는 ★것»이다. ★★그 집합이 ★★인라인에 ★★다 ★있어야 ★한다
     (★★별창은 ★★인라인의 ★★부분집합이어야 ★한다 — ★★같은 자를 ★★«그대로» 싣는 설계니까).
   ⇒ ★★★이 방향이 ★★곧 ★★이번 결함의 ★★반대 방향도 ★잡는다(★아래 S2 가 ★그 칸이다). */
const INLINE = scriptsOf('index.html');
const POPOUT = scriptsOf('pages', 'template-browser.html');

test('S0 ★전제 — ★두 창에서 ★★스크립트를 ★★뽑았나 (⛔∅ 는 ★양방향이다)', () => {
  assert.ok(INLINE.size > 0, '★index.html 에서 ★스크립트를 ★★한 건도 ★못 뽑았다 — ★자가 ★깨졌다');
  assert.ok(POPOUT.size > 0, '★별창에서 ★스크립트를 ★★한 건도 ★못 뽑았다 — ★자가 ★깨졌다');
  /* ★★★주석을 ★걷는 자가 ★★살아 있나 — ★★양성·음성을 ★★둘 다 ★댄다.
     ★★★첫 꼴은 ★★항등식이었다(261011): ★이 `.mjs` 파일을 ★먹여 ★★«`_gallery-sort.js` 가 ★안 세어진다»를
       ★쟀는데 — ★★`.mjs` 엔 ★★`<script src>` 가 ★★애초에 ★★0건이다 ⇒ ★★★무엇을 해도 ★참.
     ⇒ ★★그래서 ★★«주석에 든 ★script 태그»를 ★★손으로 ★만들어 ★먹인다. */
  assert.deepStrictEqual([...scriptsFrom('<!-- <script src="x/ghost.js"></script> -->')], [],
    '★★주석 안의 ★script 가 ★★세어졌다 — ★걷어내기가 ★죽었다(★거짓 양성)');
  assert.deepStrictEqual([...scriptsFrom('<script src="x/real.js"></script>')], ['real.js'],
    '★★진짜 ★script 가 ★★안 세어졌다 — ★★걷어내기가 ★★너무 ★많이 ★먹는다(★거짓 음성)');
  assert.deepStrictEqual([...scriptsFrom('<!-- a --><script src="b/keep.js"></script><!-- c -->')], ['keep.js'],
    '★★주석에 ★둘러싸인 ★진짜 ★script 를 ★놓쳤다');
});

test('S1 ★★별창이 ★싣는 ★자는 ★★전부 ★인라인에도 ★있다 — ★★«한쪽만 ★싣기»를 ★잡는다', () => {
  const onlyPopout = [...POPOUT].filter(f => !INLINE.has(f)).sort();
  assert.deepStrictEqual(onlyPopout, [],
    `★★별창만 ★싣는 자가 ★있다: ${onlyPopout.join(' · ')} — ★★인라인에선 ★그 기능이 ★죽는다`);
});

test('S2 ★★★템플릿 브라우저가 ★쓰는 ★자는 ★★두 창에 ★★다 ★있다 (★★이번 결함의 ★그 칸)', () => {
  /* ★★★과녁을 ★★«이름 접두사»로 ★조인다 — ★★템플릿 브라우저 ★식구만.
     ⛔앱 전체를 ★★별창에 ★요구하지 ★않는다(★별창은 ★그 패널만 ★띄운다). */
  const FAMILY = [...INLINE].filter(f => /^_tpl-|^template-browser\.js$|^_gallery-sort\.js$/.test(f)).sort();
  assert.ok(FAMILY.length >= 4,
    `★전제 — ★식구가 ★4 이상이어야 한다(잰 값 ${FAMILY.length}: ${FAMILY.join(' · ')})`);
  const missing = FAMILY.filter(f => !POPOUT.has(f)).sort();
  assert.deepStrictEqual(missing, [],
    `★★★별창이 ★안 싣는 식구: ${missing.join(' · ')} — ★★그 창에서 ★그 자의 window.* 가 ★undefined 다`);
});

test('S3 ★★의존이 ★★«부르는 쪽»과 ★같이 ★실리나 — ★`_tpl-sort.js` → `_gallery-sort.js`', () => {
  /* ★★★이름 집합만으로는 ★★«왜 ★필요한가»를 ★모른다 ⇒ ★★의존을 ★★소스에서 ★★뽑아 ★잰다.
     ⇒ ★★그래야 ★★식구가 ★늘 때 ★★이 칸이 ★★따라 ★자란다(⛔손 명부가 ★아니다). */
  const src = readSrc(ROOT, 'js', 'panels', '_tpl-sort.js');
  /* ★★★낱말 경계를 ★★건다 — ⛔부분 문자열로 ★재지 ★마라.
     ★★★261011 ★실측: ★`/byCreatedAtDesc/` 는 ★★`byCreatedAtDescX` 에도 ★★걸린다 ⇒
       ★★이름을 ★바꿔 ★★의존을 ★★죽이는 ★변이(P5)가 ★★아무 칸도 ★★빨갛게 ★못 했다.
     ⇒ ★★또 ★한 번 ★★«빨강이 ★안 나는 것»이 ★★«내 자가 ★느슨하다»의 ★신호였다. */
  const needsGallery = /\bbyCreatedAtDesc\b/.test(src);
  assert.ok(needsGallery,
    '★전제 — ★`_tpl-sort.js` 가 ★`byCreatedAtDesc` 를 ★부른다(★이 전제가 ★거짓이면 ★아래가 ★뜻이 ★없다)');
  for (const [nm, set] of [['index.html', INLINE], ['별창', POPOUT]]) {
    assert.ok(set.has('_tpl-sort.js'), `★${nm} 가 _tpl-sort.js 를 ★안 싣는다`);
    assert.ok(set.has('_gallery-sort.js'),
      `★★${nm} 가 _gallery-sort.js 를 ★안 싣는다 — _tpl-sort.js 가 ★★거기서 ★비교자를 ★받는다 ⇒ ★★던진다`);
  }
});

test('S4 ★★★의도된 ★비대칭 — ★★까닭을 ★글자로 ★남겼나 (★B5 꼴)', () => {
  /* ★★인라인이 ★★더 ★많이 ★싣는 것은 ★★정상이다 — ★★그게 ★★흠이 ★아님을 ★★적어 둔다.
     ★★그리고 ★★그 줄을 ★★이 칸이 ★잰다 ⇒ ★★누가 ★지우면 ★빨개진다.
     ★★★단언문 ★자체가 ★★이 파일에 ★살아 ★★항등식이 ★되는 것을 ★막는다 ⇒ ★★★구역을 ★갈라 ★본다
       (★★261011 ★B5 에서 ★★그 함정을 ★밟았다).
     ★★★가르는 ★자리 = ★★«이 칸(S4) ★앞»이다. ⛔`import test` ★앞이 ★★아니다 —
       ★★★첫 꼴이 ★거기서 ★갈라 ★빨개졌다: ★까닭 줄 ★하나가 ★★`INLINE` 정의 ★옆(=★import 뒤)에 ★살아
       ★★구역 ★밖으로 ★떨어졌다. ⇒ ★★★제품이 ★아니라 ★★★자의 ★«창»이 ★틀렸다(★오늘 ★세 번째 ★꼴).
     ⇒ ★★«S4 앞»으로 ★자르면 ★★까닭 줄 ★둘을 ★다 ★품고 ★★단언의 ★낱말은 ★★여전히 ★밖이다. */
  const me = readSrc(ROOT, 'tests', 'unit', 'tpl-two-windows-scripts.test.mjs');
  const cut = me.indexOf("test('S4");
  assert.ok(cut > 0, '★이 칸(S4) 앞 구역을 ★못 갈랐다');
  /* ★★★그리고 ★★그 구역이 ★★단언의 ★낱말을 ★★안 품는지를 ★★여기서 ★단언한다 —
     ⛔안 그러면 ★★이 칸이 ★★또 ★항등식으로 ★돌아간다 */
  assert.ok(!me.slice(0, cut).includes('★★«파일 이름으로 ★견주는 ★까닭»이 ★없다'),
    '★★구역이 ★★단언의 ★낱말까지 ★품었다 — ★★항등식이 ★된다');
  const head = me.slice(0, cut);
  for (const [needle, why] of [
    ['별창은 ★★템플릿 브라우저만 ★싣는다', '★★«인라인이 ★더 ★많이 ★싣는 것이 ★정상»이라는 ★까닭 줄이 ★없다'],
    ['이름만이 ★견줄 수 ★있는 축이다', '★★«파일 이름으로 ★견주는 ★까닭»이 ★없다'],
  ]) {
    assert.ok(head.includes(needle), why);
  }
  /* ★★그리고 ★★그 비대칭이 ★★실제로 ★있나 — ⛔«없는 비대칭»에 ★까닭을 ★적어 두면 ★★썩은 ★주석이다 */
  assert.ok(INLINE.size > POPOUT.size,
    `★★인라인이 ★더 ★많이 ★싣지 ★않는다(인라인 ${INLINE.size} · 별창 ${POPOUT.size}) ⇒ ★★머리말의 ★그 까닭이 ★썩었다`);
});
