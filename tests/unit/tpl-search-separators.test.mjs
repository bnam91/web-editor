/* tpl-search-separators.test.mjs — ★★1011t1e: ★★`\` 와 ★`_` 도 ★구분자로
 *
 * ★★현빈 ★원문: 「'demo\event', 'demo_event'  템플릿에 이렇게도 되게해줄수 있을까?
 *                 demo폴더에 event 섹션을 찾기위함이거든?」
 * ★설계·발주 = 지디 · ★고친 자 = t1bstar.
 *
 * ★★★이 묶음은 ★★b3(`&`·`,`·공백 = AND)와 ★★같은 축이고 ★★구분자를 ★★둘 ★더하는 일이다.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ★★★★★지디의 ★발주서는 ★★㉡(★AND 가 ★0건이면 ★«통째 이름»으로 ★다시 찾기)였다.
 *   ★까닭으로 ★★「★`_` 를 ★구분자로 ★쓰면 ★★`banner_event` 를 ★이름으로 ★찾던 ★사람이 ★못 찾는다」를 ★들었다.
 * ★★★그 전제를 ★★★내가 ★쟀고 ★★틀렸다 — ★★★안 깨진다. ★★까닭이 ★★구조에 ★있다:
 *   ★★`X_Y` 를 ★쪼개면 ★★부분이 ★★★둘 다 ★★`X_Y` 의 ★★부분문자열이다.
 *   ★★그리고 ★`tplSearchMatch` 는 ★★`fields.some(f => f.includes(w))` — ★★★부분문자열 ★매칭이다.
 *   ⇒ ★★`banner ∧ event` 가 ★★★이름 ★`banner_event` ★하나로 ★★둘 다 ★만족된다.
 * ⇒ ★★★그러므로 ★★㉡ 의 ★fallback 은 ★★★한 번도 ★★탈 수 ★없다(★그 이름의 벌이 ★있으면 ★AND ★≥1).
 *   ⇒ ★★넣으면 ★★«발동 ★0회»인 ★가지가 ★생긴다 — ★★★장식이고, ★★다음 사람이 ★지우기 ★쉬운 ★줄로 ★본다.
 * ⇒ ★★★그래서 ★★이 묶음은 ★★★«두 설계가 ★같은 답을 ★내는 ★부분»만 ★한다: ★★구분자 ★둘.
 *   ⛔★★㉡ 의 ★fallback 과 ★★«어느 길로 ★찾았나» ★이음새는 ★★★안 넣었다 —
 *     ★★길이 ★하나뿐이면 ★★잴 ★것이 ★없다. ★★그 판정은 ★★지디·현빈 자리다(★b3 의 ★쉼표와 ★같은 꼴).
 *   ⇒ ★★★K8 이 ★★그 ★결정선을 ★지킨다 — ★★누가 ★fallback 을 ★넣으면 ★★알린다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ★★★그리고 ★★대가를 ★이름으로: ★★㉠ 는 ★★«못 찾음»을 ★★안 만들고 ★★★«더 나옴»을 ★만든다(★정밀도).
 *   ★★그건 ★★`&`·`,`·공백이 ★★이미 ★가진 ★성질이다 ⇒ ★★새 병이 ★아니다. ★★K7 이 ★그것을 ★★수로 ★적는다.
 *
 * ⛔★★현빈 ★데이터로 ★잰 수를 ★★여기 ★박지 ★않는다(★지디 ★금지선) — ★★★제 더블을 ★세운다.
 *   ★까닭: ★그가 ★템플릿을 ★더하면 ★그 수가 ★바뀐다 ⇒ ★★검사가 ★★남의 ★손에 ★매인다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
/* ★★걷는 자는 ★★★공용 하나를 ★쓴다 — ⛔손으로 ★정규식을 ★또 ★적지 ★마라(★명부가 ★둘이 ★된다).
   ★★★첫 꼴은 ★손으로 ★적었고 ★★`(?m)`(★파이썬 꼴)을 ★써서 ★★★이 파일이 ★★안 풀렸다(★261011 ★실측:
     ★`node --test` 가 ★★tests 1 / fail 1 ⇒ ★★그 ★「fail 1」은 ★★측정값이 ★아니라 ★★파싱 오류였다). */
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');

/** ★★제품을 ★★«그대로» 싣는다 — ⛔식을 ★베껴 ★적지 ★않는다(★베끼면 ★항등식이 된다).
 *  ★`_tpl-search.js` 는 ★★고전 스크립트라 ★★`window` 에 ★단다 ⇒ ★★그 꼴로 ★불러온다. */
function loadSearch() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'panels', '_tpl-search.js'), 'utf8');
  const w = {};
  new Function('window', src)(w);
  return w;
}
const W = loadSearch();

/* ★★★제 더블 — ★★이름·폴더·태그가 ★★무엇을 ★가르는지 ★또렷하게.
   ★`banner_event` = ★★«이름에 ★구분자가 ★든» 벌(★회귀 칸의 ★과녁)
   ★`hero`         = ★★폴더·태그로 ★AND 를 ★만족하는 ★★«남의 벌»(★정밀도 칸의 ★과녁) */
const DOUBLE = Object.freeze([
  Object.freeze({ name: 'banner_event', folder: 'DEMO',   category: '전체', tags: [] }),
  Object.freeze({ name: 'event',        folder: 'DEMO',   category: '전체', tags: [] }),
  Object.freeze({ name: 'spacer',       folder: 'DEMO',   category: '전체', tags: [] }),
  Object.freeze({ name: 'event',        folder: '레거시', category: '전체', tags: [] }),
  Object.freeze({ name: 'hero',         folder: 'banner', category: '전체', tags: ['event'] }),
]);
const hit = (q, mode = 'all') =>
  (W.tplSearchFilter(DOUBLE, q, mode) || []).map(t => `${t.name}@${t.folder}`).sort();

test('K0 ★★무회귀 — ★★b3 의 ★`&`·`,`·공백이 ★★그대로 ★AND 다 (★★이 칸이 ★먼저다)', () => {
  /* ★★★전제 — ★★제품을 ★★정말 ★실었나(⛔0건이 ★초록이 ★되지 ★않게) */
  assert.strictEqual(typeof W.tplSearchFilter, 'function', '★`tplSearchFilter` 를 ★못 실었다');
  assert.strictEqual(typeof W.tplSearchTerms, 'function', '★`tplSearchTerms` 를 ★못 실었다');

  /* ★★`,` 가 ★AND 인가 ★OR 인가 — ★★★실측으로 ★박는다(★지디가 ★★OR 일 수 ★있다 ★했다).
     ★★각자 ★하나만 ★품은 ★두 벌에 ★★`a,b` 를 ★물으면 ⇒ ★AND 면 ★0건 · ★OR 면 ★2건 */
  const two = [
    { name: 'alpha', folder: 'f', category: 'c', tags: [] },
    { name: 'beta',  folder: 'f', category: 'c', tags: [] },
  ];
  for (const q of ['alpha,beta', 'alpha&beta', 'alpha beta']) {
    assert.strictEqual((W.tplSearchFilter(two, q, 'all') || []).length, 0,
      `★★`+`${q}` + ` 가 ★★AND 가 ★아니다 — ★★OR 이면 ★2건이 ★나온다. ★★K5 의 ★뜻이 ★바뀐다`);
  }
  /* ★그리고 ★★둘 다 ★품은 ★벌은 ★★걸린다 — ⛔«항상 0건»인 ★자가 ★아님을 ★보인다(★음성대조) */
  const both = [{ name: 'alpha beta', folder: 'f', category: 'c', tags: [] }];
  assert.strictEqual((W.tplSearchFilter(both, 'alpha,beta', 'all') || []).length, 1,
    '★★둘 다 ★품은 ★벌을 ★★못 찾는다 — ★★AND 가 ★★아니라 ★★항상 ★0 인 ★자다');
});

test('K1 ★★★`demo\\event` ⇒ ★★DEMO 폴더의 ★event 를 ★찾는다 (★★고치기 ★전 ★반드시 ★빨강)', () => {
  const got = hit('demo\\event');
  assert.ok(got.length > 0,
    `★★`+`demo\\event` + ` 가 ★★0건이다 — ★★`+`\\` + ` 가 ★★구분자가 ★아니다. ★잰 값: ${JSON.stringify(got)}`);
  assert.ok(got.includes('event@DEMO'),
    `★★DEMO 폴더의 ★`+`event` + ` 가 ★★안 들었다 — ★잰 값: ${JSON.stringify(got)}`);
  /* ★★★그리고 ★★다른 폴더의 ★같은 이름은 ★★★안 든다 — ★★그게 ★★«폴더 ∧ 이름»의 ★뜻이다 */
  assert.ok(!got.includes('event@레거시'),
    `★★레거시의 ★`+`event` + ` 까지 ★들었다 — ★★AND 가 ★★안 선다. ★잰 값: ${JSON.stringify(got)}`);
});

test('K2 ★★★`demo_event` ⇒ ★★K1 과 ★★같은 결과', () => {
  assert.deepStrictEqual(hit('demo_event'), hit('demo\\event'),
    `★★두 구분자가 ★★다른 답을 ★낸다 — ★`+`_` + ` ${JSON.stringify(hit('demo_event'))} vs `
    + `★`+`\\` + ` ${JSON.stringify(hit('demo\\event'))}`);
  assert.ok(hit('demo_event').includes('event@DEMO'), '★`demo_event` 가 ★DEMO 의 ★event 를 ★못 찾는다');
});

test('K3 ★★무회귀 — ★★★`banner_event` 는 ★★여전히 ★이름으로 ★찾아진다 (★★K1 보다 ★중요하다)', () => {
  /* ★★★지디가 ★★「16% 이름 검색이 ★깨진다」로 ★걱정한 ★그 칸.
     ★★구조상 ★안 깨진다: ★`banner` 와 ★`event` 가 ★★둘 다 ★★`banner_event` 의 ★부분문자열이다.
     ⇒ ★★그런데 ★★«구조상»은 ★★★행위가 ★아니다 ⇒ ★★여기서 ★★행위로 ★박는다. */
  const got = hit('banner_event');
  assert.ok(got.includes('banner_event@DEMO'),
    `★★★`+`banner_event` + ` 를 ★★★못 찾는다 — ★★이것이 ★★참 회귀다. ★잰 값: ${JSON.stringify(got)}`);
});

/* ════════════════════════════════════════════════════════════════════════════
   ★★★K7 — ★★★«의도된 ★넓어짐»이다. ⛔버그가 ★아니다.
   ★★`&`·`,`·공백이 ★★★이미 ★가진 ★성질이고 ★★`\`·`_` 가 ★★그 축에 ★들어온 것이다.
   ⇒ ★★★다음 사람이 ★★이것을 ★★«버그»로 ★읽고 ★★되돌릴 ★수 ★있다 ⇒ ★★그래서 ★★자로 ★박는다(★지디 ⑹).

   ★★★현빈 ★참 데이터로 ★잰 ★대가(★출처= ★내가 ★읽어 ★쟀다 · ★읽기만 · ⛔이 수를 ★단언에 ★박지 ★않는다):
     ★`_` 든 이름 ★7개 중 — ★★★잃은 것 ★★0개 · ★★넓어진 것 ★★2개(★`banner_event` 1→4 · ★`banner_a` 1→4) · ★그대로 ★5개
   ⇒ ★★즉 ★★«못 찾음»은 ★★0 이고 ★★«더 나옴»만 ★있다. ★★그게 ★이 설계의 ★대가다.
   ════════════════════════════════════════════════════════════════════════════ */
test('K7 ★★★«의도된 ★넓어짐» — ★★`banner_event` 가 ★★남의 벌도 ★찾는다 (⛔버그가 ★아니다)', () => {
  /* ★★★이 칸은 ★★«고쳐야 할 흠»이 ★아니라 ★★★«대가를 ★기록하는 자»다.
     ★★`&`·`,`·공백이 ★★이미 ★같은 성질을 ★가진다 ⇒ ★★새 병이 ★아니다.
     ⇒ ★★그래서 ★★«나오면 안 된다»가 ★아니라 ★★★«나온다는 것을 ★안다»로 ★건다.
     ⛔이 칸이 ★빨개지면 ★★제품이 ★고장난 ★것이 ★아니라 ★★★이 성질이 ★바뀐 것이다 ⇒ ★★머리말을 ★고쳐라. */
  const got = hit('banner_event');
  assert.ok(got.includes('hero@banner'),
    `★★폴더 `+`banner` + ` ＋ ★태그 `+`event` + ` 인 ★남의 벌이 ★★안 나왔다 — `
    + `★★구분자가 ★★안 섰나? ★잰 값: ${JSON.stringify(got)}`);
  /* ★★그리고 ★★그 성질이 ★★`&` 와 ★★같은지 — ★★«이미 ★있던 성질»임을 ★★한 줄로 ★보인다 */
  assert.deepStrictEqual(hit('banner_event'), hit('banner&event'),
    `★★`+`_` + ` 와 ★`+`&` + ` 가 ★다른 답을 ★낸다 — ★★같은 축이어야 한다. `
    + `★`+`_` + ` ${JSON.stringify(hit('banner_event'))} vs ★`+`&` + ` ${JSON.stringify(hit('banner&event'))}`);
});

test('K4 ★★무회귀 — ★★대소문자는 ★★★이미 ★무관이다(★이 묶음이 ★만든 것이 ★아니다)', () => {
  /* ★★★지디가 ★「★대소문자 ★무관이 ★서야 한다 — ★재서 적어라」 ★했다. ★쟀다:
     ★`tplSearchTerms` 와 ★`tplSearchFields` 가 ★★둘 다 ★★`toLowerCase()` 한다.
     ⇒ ★★★그러니 ★★이 칸은 ★★«새 기능»이 ★아니라 ★★무회귀 칸이다. */
  assert.deepStrictEqual(W.tplSearchTerms('DEMO\\Event'), ['demo', 'event'],
    `★★`+`tplSearchTerms` + ` 가 ★소문자로 ★안 내린다 — ★잰 값: ${JSON.stringify(W.tplSearchTerms('DEMO\\Event'))}`);
  assert.deepStrictEqual(hit('DEMO\\event'), hit('demo\\event'), '★★대문자 폴더명이 ★다른 답을 ★낸다');
  assert.deepStrictEqual(hit('DEMO_EVENT'), hit('demo_event'), '★★전부 ★대문자가 ★다른 답을 ★낸다');
});

test('K5 ★★구분자 ★★다섯이 ★★같은 답이다 — ★`&` · `,` · 공백 · `\\` · `_`', () => {
  /* ★★★«혹은»의 ★뜻 — ★★지디가 ★한 번 ★잘못 읽었고 ★★그 가름을 ★여기 ★적어 ★둔다(★지디 ⑶):
       ★현빈 ★b3 원문: 「★후자는 ★‘레거시’폴더 ★★혹은 ★‘레거시’태그를 ★가진 것들 ★중에서」
       ⇒ ★★그 ★「혹은」은 ★★★«폴더 ★또는 ★태그»다 — ★★★«필드 간 ★OR»이다
       ⇒ ⛔★★«낱말 간 ★OR»이 ★★아니다. ★★낱말 사이는 ★★★AND 다
     ★★구현이 ★★그 꼴이다: ★`terms.every(...)` × ★`fields.some(...)`
       = ★★낱말마다 ★AND · ★★칸 사이는 ★OR  ⇒ ★★K0 가 ★그것을 ★실측으로 ★박는다
     ⇒ ★★★그래서 ★구분자 ★다섯이 ★★«같은 답»인 것이 ★맞다 — ★★★다섯 다 ★★AND 구분자다 */
  const SEPS = ['demo&event', 'demo,event', 'demo event', 'demo\\event', 'demo_event'];
  const answers = SEPS.map(q => JSON.stringify(hit(q)));
  const uniq = [...new Set(answers)];
  assert.strictEqual(uniq.length, 1,
    '★★구분자마다 ★답이 ★다르다 — ★★★왜 ★다른지 ★적어라:\n     '
    + SEPS.map((q, i) => `${q} ⇒ ${answers[i]}`).join('\n     '));
  /* ★★★전제 — ★★그 ★같은 답이 ★★«0건»이 ★아니다(⛔∅ ★== ∅ 로 ★통과하지 ★않게) */
  assert.ok(JSON.parse(answers[0]).length > 0,
    '★★다섯이 ★★같긴 ★한데 ★★전부 ★0건이다 — ★★★∅ 가 ★∅ 와 ★같은 것이고 ★★아무것도 ★안 잠갔다');
});

test('K6 ★★0건 판 — ★★없는 이름은 ★★0건이고 ★★조용히 ★실패하지 ★않는다', () => {
  assert.deepStrictEqual(hit('없는폴더\\없는섹션'), [], '★없는 것이 ★★0건이 ★아니다');
  assert.deepStrictEqual(hit('zzz_qqq'), [], '★없는 것이 ★★0건이 ★아니다');
  /* ★★★구분자만 ★넣으면 ★★«전체»여야 한다 — ★★`filter(Boolean)` 이 ★빈 토막을 ★버리고
     ★★`terms` 가 ★∅ 면 ★★`every` 가 ★참이라 ★★전체가 ★보인다(★b3 정본의 ★마지막 절). */
  assert.deepStrictEqual(W.tplSearchTerms('\\_&, '), [], `★구분자만 ★넣었는데 ★토막이 ★남는다`);
  assert.strictEqual(hit('\\_&, ').length, DOUBLE.length,
    '★★구분자만 ★넣었을 때 ★★전체가 ★★안 보인다 — ★★`∅ ⇒ 전체` 가 ★깨졌다');
});

test('K8 ★★★결정선 — ★★㉡(0건이면 ★통째로)는 ★★★안 넣었다. ★★누가 ★넣으면 ★이 칸이 ★알린다', () => {
  /* ★★★왜 ★검사로 ★두나 — ★★머리말에 ★「★안 넣었다」를 ★적어도 ★★아무도 ★안 읽는다.
     ⇒ ★★★들어오면 ★★스스로 ★빨개지는 ★자로 ★둔다.
     ★★이 칸이 ★빨개지면 ★★제품이 ★고장난 ★것이 ★아니다 — ★★★결정이 ★바뀌었다는 ★뜻이다.
     ⇒ ★★그때 ★할 일: ★★★«어느 길로 ★찾았나» 이음새를 ★세우고, ★★fallback 이 ★★실제로 ★타는 ★판을
       ★★★하나라도 ★찾아 ★검사로 ★박아라. ⛔못 찾으면 ★★그 가지는 ★★«발동 0회»다. */
  const src = fs.readFileSync(path.join(ROOT, 'js', 'panels', '_tpl-search.js'), 'utf8');
  const bare = stripComments(src);
  /* ★★★주석을 ★걷고 ★본다 — ★★★이 파일의 ★머리말이 ★★`fallback` 이라는 ★낱말을 ★★쓴다(★위).
     ⛔안 걷으면 ★★내 산문이 ★★이 단언의 ★입력이 ★된다. */
  assert.ok(!/fallback/i.test(bare),
    '★★제품에 ★★`fallback` 이 ★들어왔다 — ★★㉡ 가 ★섰다. ★★위 ★머리말의 ★★할 일을 ★따르라');
  /* ★★★그리고 ★★«길이 ★하나»임을 ★★식으로 — ★`tplSearchFilter` 가 ★★한 번만 ★거른다 */
  const filterBody = bare.match(/function tplSearchFilter[\s\S]*?\n\}/);
  assert.ok(filterBody, '★`tplSearchFilter` 를 ★못 찾았다');
  assert.strictEqual((filterBody[0].match(/\.filter\(/g) || []).length, 1,
    `★★`+`tplSearchFilter` + ` 가 ★★거르기를 ★★두 번 ★한다 — ★★★두 길이 ★생겼나? `
    + `★잰 값: ${filterBody[0].trim()}`);
});
