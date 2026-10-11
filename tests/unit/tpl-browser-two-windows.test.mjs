/* tpl-browser-two-windows.test.mjs — ★설계 B: ★두 HTML 의 ★`tpl-browser*` id 집합
 *
 * ★★찾은 자 = t4quote · ★★고친 자 = t1bstar · ★B5 = 지디.
 *
 * ★★★이 검사의 ★값 = ★★«새 id 를 ★한쪽 창에만 ★더하면 ★빨강».
 *   ★템플릿 브라우저는 ★★«인라인 패널»과 ★★«별창» ★두 곳에 ★★같은 레이아웃으로 산다.
 *   ⇒ ★b4·b2 처럼 ★마크업을 ★더하는 일이 ★★한쪽만 ★고치는 ★사고를 ★내기 ★쉽다.
 *
 * ★★★명부 갱신 ★이력 — ⛔«수»만 ★고치지 ★않는다. ★★«왜»를 ★같이 ★적는다:
 *   ★2026-10-11 ★★17 → ★★★16 — ★★`tpl-browser-replace-btn` 을 ★★★별창에서 ★★뺐다(★지디 ㉠).
 *     ★★★왜 ★다시 ★줄었나: ★★그 단추는 ★★별창에서 ★★★있으나 ★못 쓰는 ★것이었다 —
 *       ★별창엔 ★★`id=\"canvas\"` 가 ★★0건이라 ★★`secN` 이 ★★항상 ★0 ⇒ ★★영영 ★`disabled`.
 *       ★배선도 ★없다(★셔밍 `(tpl)` · ★`preload.js:78` `(id)` ★둘 다 ★`opts` 를 ★안 받는다).
 *     ★★갱신 ★판정(⛔«눈 diff» 아님): ★★지워진 이름 = ★★«이번 ★하나»뿐 · ★★더해진 이름 ★★0
 *       ⇒ ★★★이번엔 ★★«지워짐 0» 이 ★아니다 — ★★★줄이는 ★변경이라 ★★거꾸로 ★단언한다.
 *     ⇒ ★★★그리고 ★★B2 가 ★★같이 ★움직였다 — ★★비대칭이 ★★변했다(★그 id 가 ★★인라인 ★단독이 ★됐다).
 *       ★★★그게 ★이 갱신의 ★가장 ★위험한 칸이었다: ★★지디가 ★★「수를 ★고치기 ★전에 ★★«무엇을
 *       ★세는 ★자인가»를 ★먼저 ★읽어라」라 ★걸었고, ★★읽으니 ★★`B1` 은 ★★★교집합을 ★센다
 *       ⇒ ★★한쪽에서 ★빼면 ★★★«공통»이 ★아니라 ★★«단독»이 ★된다 ⇒ ★★B1·B2·B4 ★★★셋이 ★움직인다.
 *       ★★실측으로 ★★셋이 ★빨개진 ★뒤에 ★★그 ★잰 값으로 ★고쳤다(⛔먼저 ★고치지 ★않았다).
 *   ★2026-10-11 ★★16 → ★★17 — ★★`tpl-browser-replace-btn` ★하나가 ★늘었다(★b2 ⒝ · ★«섹션 변경» 단추).
 *     ★★★또 ★이 검사가 ★제 일을 ★했다 — ★단추를 ★넣자 ★★B1 이 ★빨개졌고 ★그래서 ★여기를 ★고쳤다.
 *     ★★갱신 ★판정(⛔«눈 diff» 아님): ★★지워진 이름 ★★0 · ★★더해진 이름 = ★«이번 변경 ★하나»뿐
 *     ⇒ ★★B2·B3 는 ★★안 건드렸다 — ★★단추를 ★★두 창에 ★★다 ★넣었으니 ★★비대칭이 ★안 변한다
 *   ★2026-10-11 ★★15 → ★★16 — ★★`tpl-browser-sort` ★하나가 ★늘었다(★설계 F · b4 ★정렬 select).
 *     ★★★이 검사가 ★★제 일을 ★했다 — ★F 를 ★넣자 ★★B1 이 ★★빨개졌고, ★그래서 ★★여기를 ★고쳤다.
 *     ★★갱신 ★판정(⛔«눈 diff» 아님 · ★단언으로 ★쟀다):
 *       ★★지워진 이름 ★★0 (★0 이 ★유지되는 ★까닭: ★이번 변경은 ★★id 를 ★★더하기만 했다)
 *       ★★더해진 이름 = ★★«이번 변경 ★하나»뿐 — ★`['tpl-browser-sort']`
 *     ⇒ ★★B2·B3 는 ★★안 건드렸다(★비대칭은 ★그대로) ⇒ ★★그 둘이 ★초록인 것이 ★★특이성의 ★증거다.
 *
 * ★★★★★B5 — ★★«왜 ★비대칭인가» (⛔다음 사람이 ★«흠이다»로 ★고치려 ★들지 ★않게)
 *   ★★두 집합은 ★★같지 ★않다. ★★그리고 ★★그게 ★★맞다:
 *     ★★`tpl-browser-popout`  = ★★떼어내기(인라인 → 별창). ★★★«인라인에만» 있어야 ★맞다 —
 *        ★★별창을 ★★또 ★떼어낼 ★수 ★없다.
 *     ★★`tpl-browser-restore` = ★★되돌리기(별창 → 인라인). ★★★«별창에만» 있어야 ★맞다 —
 *        ★★인라인은 ★★이미 ★제자리다.
 *   ⇒ ★★★그래서 ⛔«두 집합이 ★같다»로 ★걸면 ★★★처음부터 ★거짓이다(★지디가 ★자기 조건을 ★정정했다).
 *   ⇒ ★★대신 ★★«공통 ★명부» ＋ ★★«각 창 ★단독 ★명부» ★★셋을 ★★이름으로 ★잠근다.
 *
 * ⚠️★★접두사 바깥의 ★칸 하나 — ★★`tpl-resize-handle` 은 ★★`index.html` 에만 ★있다.
 *   ★★이 검사의 ★창(=★접두사 ★`tpl-browser`) ★밖이라 ★★여기서 ★안 잰다. ⛔«빠뜨렸다»가 ★아니다.
 *   ★★인라인 패널의 ★크기 조절 손잡이라 ★★별창엔 ★없는 것이 ★맞다(★별창은 ★OS 창이 ★크기를 ★쥔다).
 *   ⇒ ★★적어 두는 ★까닭: ★★이 수를 ★다시 세는 사람이 ★★«16 vs 18»을 ★보고 ★★흠이라 ★읽지 ★않게.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripHtmlComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');

/* ★★★접두사 — ★★«끝 하이픈 ★없이»다. ★★이 한 글자가 ★★수를 ★가른다:
     ★`tpl-browser`  ⇒ ★맨 `tpl-browser`(★패널 ★뿌리 ★그 자체)를 ★★포함 ⇒ ★공통 ★16
     ★`tpl-browser-` ⇒ ★그 ★뿌리를 ★★빼먹는다        ⇒ ★공통 ★15
   ⇒ ★★그래서 ★★정의를 ★★여기 ★한 자리에 ★두고 ★★B0 가 ★그 ★정의를 ★단언한다. */
const PREFIX = 'tpl-browser';

/* ★★공통 ★명부 — ★★이름으로 ★박는다(⛔«수»로 ★걸지 ★마라 · t4quote ★B1).
   ★★이것이 ★★«둘째 명부»이긴 ★하다 — ★★그런데 ★★그게 ★이 검사의 ★★«잠그는 ★자»다:
     ★HTML 이 ★참값이고 ★★이 배열은 ★★«그 참값이 ★★바뀌면 ★빨개지는 ★자»다.
   ⇒ ★★파생시켜 ★하나로 ★만들면 ★★항등식이 되어 ★★아무것도 ★안 잠근다. */
const COMMON = Object.freeze([
  'tpl-browser',
  'tpl-browser-cards',
  'tpl-browser-close',
  'tpl-browser-insert-btn',
  'tpl-browser-layout',
  'tpl-browser-preview-area',
  'tpl-browser-preview-canvas',
  'tpl-browser-preview-cat',
  'tpl-browser-preview-empty',
  'tpl-browser-preview-footer',
  'tpl-browser-preview-name',
  'tpl-browser-search',
  'tpl-browser-search-mode',
  'tpl-browser-sort',
  'tpl-browser-tag-chips',
  'tpl-browser-tree',
]);

const idsOf = (...rel) => {
  const html = readSrc(ROOT, ...rel);
  const out = new Set();
  for (const m of html.matchAll(/id="([-\w]+)"/g)) {
    if (m[1].startsWith(PREFIX)) out.add(m[1]);
  }
  return out;
};
const INLINE = idsOf('index.html');
const POPOUT = idsOf('pages', 'template-browser.html');
const sorted = (s) => [...s].sort();

test('B0 ★전제 — ★★접두사 ★정의가 ★★이 수를 ★가른다 ＋ ★두 창이 ★★비지 ★않았다', () => {
  /* ⛔«0건 ∩ 0건 = 일치»로 ★★전부 ★초록이 되는 ★꼴을 ★막는다 — ★★∅ 는 ★양방향이다 */
  assert.ok(INLINE.size > 0, '★index.html 에서 ★한 건도 ★못 긁었다 — ★자가 ★깨졌다');
  assert.ok(POPOUT.size > 0, '★별창에서 ★한 건도 ★못 긁었다 — ★자가 ★깨졌다');
  /* ★★★접두사에 ★끝 하이픈을 ★붙이면 ★★뿌리가 ★빠진다는 것을 ★★여기서 ★잠근다 —
     ⛔누가 ★`PREFIX` 를 ★`'tpl-browser-'` 로 ★고치면 ★★공통이 ★★13 이 되어 ★B1 이 ★거짓말을 한다 */
  assert.ok(INLINE.has('tpl-browser'),
    '★맨 `tpl-browser`(패널 뿌리)가 ★안 잡혔다 — ★★접두사에 ★끝 하이픈이 ★붙었나?');
  assert.strictEqual(PREFIX, 'tpl-browser', '★★접두사가 바뀌었다 — ★B1 의 16 은 ★이 정의에서만 ★참이다');
});

test('B1 ★공통 = ★★16종이고 ★★명부와 ★★이름까지 ★같다', () => {
  const common = sorted(new Set([...INLINE].filter(i => POPOUT.has(i))));
  assert.deepStrictEqual(common, [...COMMON].sort(),
    `★공통 명부가 ★어긋났다 — ★잰 값(${common.length}): ${common.join(' · ')}`);
  assert.strictEqual(common.length, 16, `★공통이 ★16종이 ★아니다(잰 값: ${common.length})`);
});

test('B2 ★`index.html` ★단독 = ★★`[popout, replace-btn]` ★둘 — ★떼어내기 ＋ ★★교체 단추', () => {
  /* ★★★261011 ★하나 → ★둘이 ★됐다. ★★까닭이 ★★둘로 ★다르다 ⇒ ★★한 줄로 ★묶지 ★않는다:
       ★`tpl-browser-popout`      ★★구조상 ★인라인에만 ★맞다(★별창을 ★또 ★떼어낼 수 ★없다)
       ★`tpl-browser-replace-btn` ★★★지금 ★배선이 ★인라인에만 ★있다 — ★★«구조»가 ★아니라 ★★«미완»이다
     ⇒ ★★★그러니 ★이 둘을 ★★같은 꼴로 ★읽지 ★마라. ★★뒤의 것은 ★★㉡ 가 ★서면 ★★움직인다.
       ★★그 ★«움직일 ★조건»을 ★★★B8 이 ★★행위로 ★잰다(⛔주석으로 ★두지 ★않는다). */
  const only = sorted(new Set([...INLINE].filter(i => !POPOUT.has(i))));
  assert.deepStrictEqual(only, ['tpl-browser-popout', 'tpl-browser-replace-btn'],
    `★index.html 단독이 ★어긋났다 — ★잰 값: ${only.join(' · ') || '(없음)'}`);
});

test('B3 ★별창 ★단독 = ★★정확히 ★`[tpl-browser-restore]` — ★되돌리기는 ★별창에만', () => {
  const only = sorted(new Set([...POPOUT].filter(i => !INLINE.has(i))));
  assert.deepStrictEqual(only, ['tpl-browser-restore'],
    `★별창 단독이 ★어긋났다 — ★잰 값: ${only.join(' · ') || '(없음)'}`);
});

test('B4 ★★★이 검사의 ★값 — ★★«한쪽에만 ★더하면 ★빨강»이 ★★실제로 ★성립하나', () => {
  /* ★★★무력화를 ★★«손으로 ★파일을 ★고치지 ★않고» ★★여기서 ★모의한다 —
     ★B2·B3 가 ★쓰는 ★그 식에 ★★가짜 id 를 ★하나 ★넣어 ★★판정이 ★뒤집히나를 ★잰다.
     ⇒ ★★이로써 ★★B2 의 ★`deepStrictEqual` 이 ★★«항상 참»이 ★아님을 ★★이 파일 ★안에서 ★증명한다.
     (★내 교훈: ★「내가 건 단언이 ★«항상 참»이라 ★아무것도 ★안 잠갔다」) */
  const fakeInline = new Set([...INLINE, 'tpl-browser-xyz']);
  const onlyWithFake = sorted(new Set([...fakeInline].filter(i => !POPOUT.has(i))));
  assert.notDeepStrictEqual(onlyWithFake, ['tpl-browser-popout', 'tpl-browser-replace-btn'],
    '★★한쪽에만 ★id 를 ★더했는데 ★B2 의 식이 ★★안 움직였다 — ★★그러면 ★이 검사는 ★★아무것도 ★안 잡는다');
  assert.deepStrictEqual(onlyWithFake, ['tpl-browser-popout', 'tpl-browser-replace-btn', 'tpl-browser-xyz'],
    `★잰 값: ${onlyWithFake.join(' · ')}`);
  /* ★★반대쪽도 — ★별창에만 ★더해도 ★B3 가 ★움직여야 한다 */
  const fakePopout = new Set([...POPOUT, 'tpl-browser-zzz']);
  const popoutOnlyWithFake = sorted(new Set([...fakePopout].filter(i => !INLINE.has(i))));
  assert.notDeepStrictEqual(popoutOnlyWithFake, ['tpl-browser-restore'],
    '★★별창에만 ★더했는데 ★B3 의 식이 ★★안 움직였다');
});

test('B5 ★비대칭의 ★★까닭이 ★★이 파일에 ★★글자로 ★있나 — ⛔다음 사람이 ★«흠»으로 ★고치지 ★않게', () => {
  /* ★★★주석을 ★★검사가 ★잰다 — ★★「썩지 ★않게 ★쓰는 ★설계가 ★나중 ★점검보다 ★낫다」.
     ★★이 파일의 ★머리말이 ★★지워지면 ★★이 칸이 ★빨개진다. */
  const me = readSrc(ROOT, 'tests', 'unit', 'tpl-browser-two-windows.test.mjs');
  /* ★★★★★첫 꼴은 ★★«항등식»이었다 — ★★쓰면서 ★쟀고 ★고쳤다(261011):
       ★찾는 ★낱말이 ★★이 파일에 ★★두 번 ★산다 — ⑴ ★머리말(★잠그려는 ★그 글) ⑵ ★★아래 ★단언의 ★★낱말 ★그 자체.
       ⇒ ★★머리말을 ★지우면 ★★낱말도 ★같이 ★지워져 ★★`includes` 가 ★★다시 ★참이 된다 ⇒ ★★★영원히 ★초록.
       ⇒ ★★그래서 ★★«머리말 ★구역»만 ★잘라서 ★본다 — ★★단언의 ★낱말은 ★★그 구역 ★밖이다.
     (★내 명부: ★「기대값을 ★«피검 대상과 ★같은 소스»에서 ★파싱하면 ★값을 ★못 잠근다」) */
  const cut = me.indexOf('import test');
  assert.ok(cut > 0, '★머리말 구역을 ★못 갈랐다 — ★`import test` 가 ★없다');
  const head = me.slice(0, cut);
  for (const [needle, why] of [
    ['tpl-browser-popout', '★떼어내기 id 가 ★머리말에 ★없다'],
    ['tpl-browser-restore', '★되돌리기 id 가 ★머리말에 ★없다'],
    ['또 ★떼어낼 ★수 ★없다', '★★«별창을 또 떼어낼 수 없다»는 ★까닭 줄이 ★없다'],
    ['이미 ★제자리다', '★★«인라인은 이미 제자리다»는 ★까닭 줄이 ★없다'],
    ['tpl-resize-handle', '★★접두사 ★밖의 ★칸(★`tpl-resize-handle`)을 ★적어 둔 줄이 ★없다'],
  ]) {
    assert.ok(head.includes(needle), why);
  }
});

test('B6 ★★그 둘을 ★★묶는 ★자가 ★★각각 ★있나 — ★★«id 만 ★있고 ★죽은 칸»을 ★막는다', () => {
  /* ★★★E 에서 ★쟀다: ★`tpl-browser-search-mode` 는 ★★2026-04-04 부터 ★★마크업만 ★있고
     ★★읽는 JS 가 ★0건이었다 ⇒ ★★«보이고 ★눌리는데 ★아무 일도 ★안 나는» 칸.
     ⇒ ★★비대칭 ★id ★둘도 ★★같은 병에 ★걸릴 수 ★있다 ⇒ ★★묶는 자를 ★★여기서 ★잰다.
     ⚠️★★`-restore` 는 ★★JS 파일에 ★★없다 — ★★별창의 ★인라인 스크립트가 ★묶는다(t4quote 실측)
        ⇒ ★★그래서 ★★찾는 ★자리가 ★★둘로 ★갈린다. ⛔한 자리만 ★보면 ★거짓 0 이 된다. */
  /* ★★★«있나»가 ★아니라 ★★«묶나»를 ★잰다 — ★★`includes('<id>')` 는 ★★★«항상 참»이다:
       ★그 id 의 ★마크업 ★그 자체가 ★같은 파일에 ★있다(★별창 `:58` 이 ★버튼, `:219` 가 ★묶는 줄).
     ⇒ ★★그래서 ★★`getElementById('<id>')` ★꼴을 ★찾는다 — ★★마크업 줄은 ★안 걸린다.
     (★첫 꼴이 ★실제로 ★그 함정이었다 — ★★쓰면서 ★쟀고 ★고쳤다) */
  const bound = (src, id) => new RegExp(`getElementById\\(['"]${id}['"]\\)`).test(src);
  const js = readSrc(ROOT, 'js', 'panels', 'template-browser.js');
  assert.ok(bound(js, 'tpl-browser-popout'),
    '★`tpl-browser-popout` 을 ★★묶는 JS 가 ★없다 — ★떼어내기가 ★죽었다(⛔마크업만 있는 꼴)');
  const popoutHtml = readSrc(ROOT, 'pages', 'template-browser.html');
  assert.ok(bound(popoutHtml, 'tpl-browser-restore'),
    '★★별창 ★인라인 스크립트가 ★`tpl-browser-restore` 를 ★안 묶는다 — ★되돌리기가 ★죽었다');
  /* ★★음성대조 — ★★이 자가 ★★«아무 id 나 ★묶였다»고 ★하지 ★않는다 */
  assert.ok(!bound(js, 'tpl-browser-restore'),
    '★`-restore` 가 ★JS 파일에서 ★묶였다 — ★t4quote 실측(★인라인 스크립트가 묶는다)과 ★다르다 ⇒ ★자를 ★다시 재라');
  assert.ok(!bound(popoutHtml, 'tpl-browser-xyz'), '★★없는 id 가 ★묶였다 — ★자가 ★거짓 양성이다');
});

/* ════════════════════════════════════════════════════════════════════════════
   ★★★B7·B8 — ★★«있나»와 ★★«쓸 수 ★있나»는 ★★★다른 축이다 (★지디 · 261011)

   ★★이 회차에 ★★내 검사들이 ★★★전부 ★첫 축만 ★쟀다:
     ★B1 ★★«두 창에 ★다 ★있나»  ★★17 ⇒ ★초록
     ★S  ★★«스크립트가 ★실리나»  ★★6/6 ⇒ ★초록
     ★H5 ★★«단추가 ★Shift+Enter 와 ★같은 일을 ★하나» ⇒ ★초록
   ⇒ ★★★그런데 ★★별창의 ★그 단추는 ★★★영영 ★`disabled` 였다. ★★★어느 칸도 ★안 잡았다.
     ★까닭: ★★H5 는 ★★`index.html` 장면에서만 ★돈다 — ★★별창 장면이 ★★★없었다.
     ⇒ ★★★「있다」를 ★★N번 ★재도 ★★「쓸 수 있다」는 ★★0번 ★잰 것이다.
   (★내 명부: ★「★검사가 ★«한 환경에서만» ★참이면 ★그 초록은 ★«안 재고 있다»와 ★구분 안 된다」)

   ★★★⛔⛔아래 ★셋은 ★★★주석을 ★★걷고 ★잰다. ★★까닭 — ★★내가 ★★여기서 ★밟았다(261011):
     ★★나는 ★별창 html 에 ★★«왜 ★단추를 ★뺐나»를 ★주석으로 ★적고, ★설명하려고
     ★★`id="canvas"` 와 ★`window.insertTemplate = async (tpl)` 를 ★★★그대로 ★인용했다. ★★그 결과:
     ⑴ ★`hasCanvas(별창)` 이 ★★★`true` 가 ★됐다 — ★★주석 ★한 줄 때문에(★실측 ★`:104` ★1건 · ★걷으면 ★0건)
        ⇒ ★★★B7 의 ★★핵 단언이 ★★죽었다. ★★단추를 ★다시 ★넣어도 ★★«캔버스가 ★있다»로 ★통과한다.
        ⇒ ★★★그리고 ★내 ★첫 ★무력화가 ★★그걸 ★★못 봤다 — ★★빨강이 ★★★다른 단언(★명부)에서 ★나왔다.
           ★★「빨강이 ★났다」를 ★★«내가 ★겨눈 ★단언이 ★물었다»로 ★읽으면 ★★★이런 것이 ★숨는다.
     ⑵ ★`insertTemplate` ★서명을 ★★`match` 로 ★찾으니 ★★★`:108`(★내 주석)이 ★먼저 ★걸렸다 —
        ★★진짜 코드는 ★★`:207` 이다. ⇒ ★★★㉡ 가 ★서서 ★진짜를 ★늘려도 ★★B8 이 ★★초록일 ★참이었다.
   ⇒ ★★★처방: ★★걷는다 ＋ ★★«일치가 ★딱 ★하나인가»도 ★단언한다 ＋ ★★핵 단언을 ★★양성대조로 ★깨운다.
   (★내 명부: ★「★주석은 ★«소스 파싱 게이트»의 ★입력 — ★예시로 적은 ★필드명이 ★측정값이 됐다」)
   ════════════════════════════════════════════════════════════════════════════ */
const bare = (src) => stripHtmlComments(String(src));
/** ★그 창의 ★html 에 ★★«교체 단추»가 ★그려지나 (★★주석은 ★안 센다). */
const rendersReplace = (src) => /id="tpl-browser-replace-btn"/.test(bare(src));
/** ★그 창의 ★html 에 ★★`#canvas` 가 ★있나 — ★★교체가 ★★«무엇을» 바꿀 ★자리다 (★★주석은 ★안 센다). */
const hasCanvas = (src) => /id="canvas"/.test(bare(src));

test('B7 ★★★«교체 단추를 ★그리는 창»은 ★★반드시 ★★`#canvas` 를 ★가진다 (★★«쓸 수 있나» 축)', () => {
  const WINDOWS = [
    ['index.html', readSrc(ROOT, 'index.html')],
    ['pages/template-browser.html', readSrc(ROOT, 'pages', 'template-browser.html')],
  ];
  assert.strictEqual(WINDOWS.length, 2, '★창이 ★둘이 ★아니다');
  /* ★★★전제 — ★★«그리는 창»이 ★★적어도 ★하나 ★있어야 ★★이 칸이 ★뜻을 ★가진다(★∅ 는 ★양방향이다) */
  const drawn = WINDOWS.filter(([, src]) => rendersReplace(src)).map(([n]) => n);
  assert.deepStrictEqual(drawn, ['index.html'],
    `★★«그리는 창» 명부가 ★어긋났다 — ★잰 값: ${drawn.join(' · ') || '(없음)'}`);

  /* ★★★양성대조 — ★★위 ★명부 단언이 ★먼저 ★물면 ★★아래 ★핵 단언은 ★★한 번도 ★안 돈다.
     ⇒ ★★«단추는 ★그리는데 ★캔버스는 ★없는» 창을 ★손으로 ★만들어 ★여기서 ★먹인다.
     ★★그리고 ★★«주석에 ★적힌 ★캔버스»도 ★같이 — ★★그게 ★내가 ★실제로 ★낸 ★꼴이다. */
  const FAKE_NO_CANVAS = '<button id="tpl-browser-replace-btn">↻</button>';
  assert.ok(rendersReplace(FAKE_NO_CANVAS), '★★가짜에서 ★단추를 ★못 봤다 — ★자가 ★죽었다');
  assert.ok(!hasCanvas(FAKE_NO_CANVAS), '★★캔버스 없는 ★가짜를 ★«있다»로 ★읽는다');
  const FAKE_CANVAS_IN_COMMENT =
    '<!-- ★까닭: ★이 창엔 id="canvas" 가 ★없다 --><button id="tpl-browser-replace-btn">↻</button>';
  assert.ok(!hasCanvas(FAKE_CANVAS_IN_COMMENT),
    '★★★주석 안의 ★`id="canvas"` 를 ★★«있다»로 ★읽는다 — ★★주석을 ★안 걷고 ★있다(★★내가 ★낸 ★그 흠이다)');
  assert.ok(hasCanvas('<div id="canvas"></div>'), '★★참 캔버스를 ★못 봤다 — ★거짓 음성');

  for (const [name, src] of WINDOWS) {
    if (!rendersReplace(src)) continue;
    assert.ok(hasCanvas(src),
      `★★★${name} 이 ★교체 단추를 ★그리는데 ★★\`#canvas\` 가 ★없다 — ` +
      '★★`_syncInsertBtn` 의 ★`secN` 이 ★★항상 ★0 이 되어 ★★영영 ★`disabled` 다. ' +
      '★★그리지 ★말거나 ★★캔버스를 ★주어라.');
  }
});

test('B8 ★★★㉡ 의 ★«풀 ★조건»을 ★★행위로 ★잰다 — ★IPC·셔밍이 ★`opts` 를 ★받으면 ★★★빨개진다', () => {
  /* ★★★왜 ★주석이 ★아니라 ★검사인가 — ★★「★㉡ 가 ★서면 ★B7 을 ★바꿔라」를 ★주석에 ★적으면
     ★★★아무도 ★안 읽는다. ⇒ ★★조건이 ★섰을 때 ★★스스로 ★빨개지는 ★자로 ★둔다.
     (★내 명부: ★「★규칙은 ★«재는 자»가 ★있어야 ★집행된다」 ＋ ★「★막아둔 ★까닭이 ★먼저 ★죽고 ★문만 ★남는다」)
     ★★이 칸이 ★빨개지면 ★★제품이 ★고장난 ★것이 ★아니다 — ★★★㉡ 가 ★섰다는 ★뜻이다.
     ⇒ ★그때: ★별창 html 에 ★단추를 ★다시 ★넣고 ★★B1 16→17 · ★B2 를 ★하나로 ★되돌리고
       ★★별창 ★장면의 ★H5 를 ★세운 ★뒤 ★★이 칸의 ★기대값을 ★고쳐라. */
  const preload = readSrc(ROOT, 'preload.js');
  /* ★★★걷는다 — ⛔안 걷으면 ★내 주석의 ★인용 서명이 ★먼저 ★걸린다(★실측 `:108` vs ★참 `:207`) */
  const shim = bare(readSrc(ROOT, 'pages', 'template-browser.html'));

  /** ★인자 ★수 — ★★`null`=★못 찾았다 · ★★`-1`=★일치가 ★둘 이상(★어느 것이 ★참인지 ★모른다) */
  const arity = (src, re) => {
    const all = [...String(src).matchAll(new RegExp(re.source, 'g'))];
    if (all.length === 0) return null;
    if (all.length > 1) return -1;
    const inner = all[0][1].trim();
    return inner === '' ? 0 : inner.split(',').length;
  };
  const IPC_RE  = /insertTemplateInMain\s*:\s*\(([^)]*)\)/;
  const SHIM_RE = /window\.insertTemplate\s*=\s*async\s*\(([^)]*)\)/;
  const ipcArity = arity(preload, IPC_RE);
  const shimArity = arity(shim, SHIM_RE);

  assert.notStrictEqual(ipcArity, null,
    '★`preload.js` 에서 ★`insertTemplateInMain` 서명을 ★못 찾았다 — ★이름이 ★바뀌었나? ★이 칸을 ★다시 ★맞춰라');
  assert.notStrictEqual(shimArity, null,
    '★별창 ★셔밍의 ★`window.insertTemplate` 서명을 ★못 찾았다 — ★이 칸을 ★다시 ★맞춰라');
  assert.notStrictEqual(ipcArity, -1, '★`insertTemplateInMain` 일치가 ★둘 이상이다 — ★어느 것이 ★참 서명인가');
  assert.notStrictEqual(shimArity, -1, '★셔밍 ★`insertTemplate` 일치가 ★둘 이상이다 — ★걷기가 ★안 먹었나');

  assert.strictEqual(ipcArity, 1,
    `★★★preload.js 의 insertTemplateInMain 이 ★인자 ${ipcArity}개를 ★받는다(★1 이었다) ⇒ ` +
    '★★★㉡ 가 ★섰다 ⇒ ★별창 ★교체를 ★다시 ★켜고 ★B1·B2·B7 을 ★같이 ★고쳐라');
  assert.strictEqual(shimArity, 1,
    `★★★별창 ★셔밍의 ★insertTemplate 이 ★인자 ${shimArity}개를 ★받는다(★1 이었다) ⇒ ★★★㉡ 가 ★섰다`);

  /* ★★양성대조 — ★★«늘어남»을 ★실제로 ★보나 (⛔「지금 1 이다」는 ★정규식이 ★죽었는지 ★못 가린다) */
  assert.strictEqual(arity('insertTemplateInMain:(id, opts) => 0,', IPC_RE), 2,
    '★★늘어난 ★서명에서 ★2 를 ★못 셌다 — ★★이 자는 ★★㉡ 를 ★못 알아본다');
  /* ★★음성대조 — ★이름이 ★다르면 ★`null`(★«0개»가 ★아니다) */
  assert.strictEqual(arity('insertTemplateSomewhereElse:(id) => 0,', IPC_RE), null,
    '★★다른 이름에 ★걸렸다 — ★거짓 양성');
});
