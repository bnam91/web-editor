/* tpl-browser-two-windows.test.mjs — ★설계 B: ★두 HTML 의 ★`tpl-browser*` id 집합
 *
 * ★★찾은 자 = t4quote · ★★고친 자 = t1bstar · ★B5 = 지디.
 *
 * ★★★이 검사의 ★값 = ★★«새 id 를 ★한쪽 창에만 ★더하면 ★빨강».
 *   ★템플릿 브라우저는 ★★«인라인 패널»과 ★★«별창» ★두 곳에 ★★같은 레이아웃으로 산다.
 *   ⇒ ★b4·b2 처럼 ★마크업을 ★더하는 일이 ★★한쪽만 ★고치는 ★사고를 ★내기 ★쉽다.
 *
 * ★★★명부 갱신 ★이력 — ⛔«수»만 ★고치지 ★않는다. ★★«왜»를 ★같이 ★적는다:
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

const ROOT = path.join(import.meta.dirname, '..', '..');

/* ★★★접두사 — ★★«끝 하이픈 ★없이»다. ★★이 한 글자가 ★★수를 ★가른다:
     ★`tpl-browser`  ⇒ ★맨 `tpl-browser`(★패널 ★뿌리 ★그 자체)를 ★★포함 ⇒ ★공통 ★17
     ★`tpl-browser-` ⇒ ★그 ★뿌리를 ★★빼먹는다        ⇒ ★공통 ★16
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
  'tpl-browser-replace-btn',
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
     ⛔누가 ★`PREFIX` 를 ★`'tpl-browser-'` 로 ★고치면 ★★공통이 ★★14 가 되어 ★B1 이 ★거짓말을 한다 */
  assert.ok(INLINE.has('tpl-browser'),
    '★맨 `tpl-browser`(패널 뿌리)가 ★안 잡혔다 — ★★접두사에 ★끝 하이픈이 ★붙었나?');
  assert.strictEqual(PREFIX, 'tpl-browser', '★★접두사가 바뀌었다 — ★B1 의 17 은 ★이 정의에서만 ★참이다');
});

test('B1 ★공통 = ★★17종이고 ★★명부와 ★★이름까지 ★같다', () => {
  const common = sorted(new Set([...INLINE].filter(i => POPOUT.has(i))));
  assert.deepStrictEqual(common, [...COMMON].sort(),
    `★공통 명부가 ★어긋났다 — ★잰 값(${common.length}): ${common.join(' · ')}`);
  assert.strictEqual(common.length, 17, `★공통이 ★17종이 ★아니다(잰 값: ${common.length})`);
});

test('B2 ★`index.html` ★단독 = ★★정확히 ★`[tpl-browser-popout]` — ★떼어내기는 ★인라인에만', () => {
  const only = sorted(new Set([...INLINE].filter(i => !POPOUT.has(i))));
  assert.deepStrictEqual(only, ['tpl-browser-popout'],
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
  assert.notDeepStrictEqual(onlyWithFake, ['tpl-browser-popout'],
    '★★한쪽에만 ★id 를 ★더했는데 ★B2 의 식이 ★★안 움직였다 — ★★그러면 ★이 검사는 ★★아무것도 ★안 잡는다');
  assert.deepStrictEqual(onlyWithFake, ['tpl-browser-popout', 'tpl-browser-xyz'],
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
