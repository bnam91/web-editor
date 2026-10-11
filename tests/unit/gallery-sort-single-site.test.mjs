/* gallery-sort-single-site.test.mjs — ★C11: ★AI 갤러리 ★정렬이 ★★«한 자리»이고 ★★시각으로 ★견준다
 *
 * ★★찾은 자 = t4quote(★같은 식이 ★두 곳) · ★고친 자 = t1bstar.
 * ★★이 파일이 ★잠그는 것 ★셋:
 *   ⒜ ★★«한 자리»인가 — ★소비자 ★둘이 ★제 식을 ★★다시 적지 ★않는다
 *   ⒝ ★★«시각»으로 ★견주나 — ★★`.85Z` vs ★`.850066Z` 짝이 ★★시각순으로 ★나온다
 *   ⒞ ★★못 읽는 값은 ★★맨 뒤 — ★실측 ★0건이어도(★지디 조건)
 *
 * ★★★⒝ 가 ★이 파일의 ★핵이다 — ★`Date.parse` ★하나로는 ★★안 고쳐진다(★ms 에서 ★잘려 ★동점이 된다)
 *   ⇒ ★★그 동점을 ★★글자로 ★깨면 ★★어긋난 순서가 ★돌아온다 ⇒ ★★그래서 ★마이크로초 키를 ★쓴다.
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
const SORT_REL = 'js/panels/_gallery-sort.js';

/* ★★그 자는 ★★고전 스크립트다 — ⛔`import` 로 ★못 끌어온다.
   ⇒ ★★`window` 를 ★하나 ★만들어 ★그 안에서 ★돌린다(★앱이 ★싣는 ★꼴과 ★같게). */
const W = (() => {
  const src = fs.readFileSync(path.join(ROOT, SORT_REL), 'utf8');
  const win = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src)(win);
  return win;
})();

test('G1 ★전제 — ★그 자가 ★`window` 에 ★섰나 (⛔없으면 아래가 전부 undefined 비교다)', () => {
  assert.strictEqual(typeof W.galleryByCreatedAtDesc, 'function',
    `★window.galleryByCreatedAtDesc 가 ★함수가 ★아니다(잰 값: ${typeof W.galleryByCreatedAtDesc})`);
  assert.strictEqual(typeof W.galleryCreatedAtKey, 'function', '★키 함수가 ★없다');
  /* ★★고전 스크립트임을 ★★여기서 ★잠근다 — ★`export`/`import` 가 ★들어오면 ★앱이 ★죽는다 */
  const body = stripComments(readSrc(ROOT, 'js', 'panels', '_gallery-sort.js'));
  assert.ok(!/^\s*(export|import)\s/m.test(body),
    '★★`export`·`import` 가 ★들어왔다 — ★이 자는 ★`<script src>` 로 ★실린다 ⇒ ★★앱이 ★죽는다');
});

test('G2 ⒝ ★★★`.85Z` vs `.850066Z` — ★★시각순으로 ★나온다 (★이 결함의 ★본체)', () => {
  /* ★★★id 를 ★★시각과 ★★«거꾸로» 둔다 — ★이것이 ★이 칸의 ★핵이다.
     ★★왜: ★동점이면 ★이 자는 ★`id` 로 ★깬다 ⇒ ★★id 가 ★시각과 ★★같은 방향이면
       ★★★`Date.parse`(ms)만 쓰는 ★틀린 자도 ★★우연히 ★같은 답을 ★낸다 ⇒ ★★이 칸이 ★★아무것도 ★안 잠근다.
     ★★실측(2026-10-11): ★처음엔 ★id 를 ★`a`/`b` 로 두었고 ★★마이크로초를 ★버리는 ★변이가 ★★안 잡혔다.
     ⇒ ★★그래서 ★★이른 쪽에 ★★`z`, ★나중 쪽에 ★★`a` 를 ★준다 ⇒ ★★id 로는 ★★거꾸로 나온다. */
  const A = { id: 'z', createdAt: '2026-05-20T09:00:00.85Z' };      // ★이른 쪽
  const B = { id: 'a', createdAt: '2026-05-20T09:00:00.850066Z' };  // ★나중 쪽
  /* ★전제 — ★★옛 식(글자 비교)은 ★★이 짝을 ★거꾸로 ★본다. ★★그걸 ★먼저 ★보인다 */
  const oldWay = [A, B].slice().sort((x, y) =>
    String(y.createdAt || '').localeCompare(String(x.createdAt || '')));
  assert.strictEqual(oldWay[0].id, 'z',
    '★전제 깨짐 — ★옛 식이 ★이 짝을 ★거꾸로 ★안 본다(⇒ ★이 검사가 ★잴 것이 ★없다)');
  /* ★전제 — ★`Date.parse` ★하나로는 ★★동점이다(★그래서 ★글자 동점깨기로는 ★못 고친다) */
  assert.strictEqual(Date.parse(A.createdAt), Date.parse(B.createdAt),
    '★전제 깨짐 — ★`Date.parse` 가 ★이 둘을 ★가른다(⇒ ★머리말의 ★까닭이 ★틀렸다)');
  /* ★★본 단언 — ★★새 자는 ★★`b`(★더 나중)를 ★앞에 ★둔다 */
  const got = [A, B].slice().sort(W.galleryByCreatedAtDesc).map((x) => x.id);
  assert.deepStrictEqual(got, ['a', 'z'],
    `★★시각순이 ★아니다 (잰 값: ${JSON.stringify(got)}) — ★.850066Z 가 ★.85Z 보다 ★나중이므로 ★먼저 와야 한다`);
  /* ★거꾸로 넣어도 ★같은 답 — ★★비교자가 ★입력 순서에 ★안 매인다 */
  const got2 = [B, A].slice().sort(W.galleryByCreatedAtDesc).map((x) => x.id);
  assert.deepStrictEqual(got2, ['a', 'z'], `★입력 순서가 ★답을 ★바꿨다 (잰 값: ${JSON.stringify(got2)})`);
});

test('G3 ⒞ ★★못 읽는 값은 ★★맨 뒤 — ★실측 0건이어도 ★자리를 ★둔다', () => {
  const ok = { id: 'ok', createdAt: '2026-05-20T09:00:00.000Z' };
  for (const bad of [{ id: 'x' }, { id: 'y', createdAt: '' }, { id: 'z', createdAt: '어제' }]) {
    /* ★★★두 입력 ★순서를 ★다 ★본다 — ★★엔진이 ★`cmp(a,b)` 를 ★어느 짝으로 ★부를지 ★★안 정해져 있다.
       ★★실측(2026-10-11): ★한 쪽만 ★보니 ★★`ka === null` 가지가 ★★한 번도 ★안 불렸고
         ⇒ ★★그 가지를 ★뒤집는 ★변이가 ★★안 잡혔다. ⇒ ★★두 짝을 ★다 ★건다. */
    for (const pair of [[bad, ok], [ok, bad]]) {
      const got = pair.slice().sort(W.galleryByCreatedAtDesc).map((x) => x.id);
      assert.deepStrictEqual(got, ['ok', bad.id],
        `★못 읽는 값이 ★맨 뒤가 ★아니다 — 넣은 값 ${JSON.stringify(bad.createdAt)}`
        + ` · 넣은 순서 ${JSON.stringify(pair.map((x) => x.id))} · 잰 값 ${JSON.stringify(got)}`);
    }
    assert.strictEqual(W.galleryCreatedAtKey(bad.createdAt), null,
      `★키가 ★null 이 ★아니다 (잰 값: ${W.galleryCreatedAtKey(bad.createdAt)})`);
  }
  /* ★★음성대조 — ★읽히는 값은 ★★null 이 ★아니어야 한다(⛔없으면 ★«언제나 null»과 ★구분이 ★안 된다) */
  assert.notStrictEqual(W.galleryCreatedAtKey(ok.createdAt), null,
    '★★읽히는 값도 ★null 이다 ⇒ ★이 자는 ★«언제나 못 읽는다»다');
});

test('G4 ⒜ ★★«한 자리»인가 — ★소비자 ★둘이 ★식을 ★다시 적지 ★않는다 ＋ ★★싣는 순서', () => {
  const CONSUMERS = ['ai-image-gallery.js', 'assets-panel.js'];
  for (const f of CONSUMERS) {
    const body = stripComments(readSrc(ROOT, 'js', 'panels', f));
    const dup = (body.match(/localeCompare\(String\(a\.createdAt/g) || []).length;
    assert.strictEqual(dup, 0,
      `★★${f} 가 ★그 식을 ★★다시 ★적었다 (잰 값: ${dup}곳) — ★★명부가 ★둘이 된다`);
    assert.match(body, /sort\(\s*window\.galleryByCreatedAtDesc\s*\)/,
      `★★${f} 가 ★그 자를 ★★안 쓴다`);
  }
  /* ★★★싣는 ★순서 — ⚠️★★이것은 ★★«방어»이고 ★★«정확성의 ★요구»가 ★아니다.
     ★★실측(2026-10-11 · 지디가 ★물어 ★내가 ★쟀다):
       ★소비자를 ★★먼저 ★싣고 ★그 자를 ★★나중에 ★실어도 ★★안 깨진다 —
       ★그 참조는 ★★«부를 때» ★풀리고(★`sort(window.…)` 가 ★★render 함수 ★안에 있다)
       ★★두 script 는 ★★어느 render 보다 ★먼저 ★다 ★실린다.
     ⇒ ★★그래서 ★★이 단언은 ★★«지금 깨지는 것»을 ★막는 자가 ★아니라
       ★★★«앞으로 ★적재 중에 ★정렬하는 소비자가 ★생기면»을 ★막는 ★싼 자다. ★그 값으로 ★둔다.
     ⛔«이것이 ★없으면 ★앱이 ★죽는다»로 ★읽지 ★마라 — ★★그건 ★★거짓이다. */
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = (s) => html.indexOf(s);
  const helper = at('js/panels/_gallery-sort.js');
  assert.ok(helper > 0, '★★`index.html` 이 ★그 자를 ★★아예 ★안 싣는다 ⇒ ★★부를 때도 ★undefined 다');
  for (const f of CONSUMERS) {
    const c = at('js/panels/' + f);
    assert.ok(c > 0, `★★index.html 이 ★${f} 를 ★안 싣는다`);
    assert.ok(helper < c,
      `★★싣는 ★순서가 ★뒤집혔다 — ★그 자(${helper}) 가 ★${f}(${c}) ★뒤에 ★있다`);
  }
});

test('G5 ★★★«그 자가 ★없으면 ★조용히 ★틀린다» — ★`sort(undefined)` 는 ★★안 던진다 (★참 ★실패 꼴)', () => {
  /* ★★★지디가 ★물은 ★칸: ★«앱이 ★실제로 ★뜨나 · ★소비자가 ★그것을 ★찾나».
     ★★내가 ★쟀고 ★★답이 ★두 갈래다:
       ⑴ ★싣는 ★순서는 ★★상관 없다(★G4 의 ★그 주석) — ★참조가 ★«부를 때» ★풀린다
       ⑵ ★★★그런데 ★★참으로 ★없을 때가 ★★더 ★나쁘다: ★`Array.prototype.sort(undefined)` 는
          ★★★던지지 ★않고 ★★«기본 ★문자열 ★비교»로 ★떨어진다 ⇒ ★★조용히 ★틀린 순서가 ★나온다
     ⇒ ★★그래서 ★★그 ★조용한 꼴을 ★★여기서 ★이름으로 ★잠근다. */
  const A = { id: 'z', createdAt: '2026-05-20T09:00:00.85Z' };
  const B = { id: 'a', createdAt: '2026-05-20T09:00:00.850066Z' };
  /* ★전제 — ★★`sort(undefined)` 가 ★★안 던진다(⛔던지면 ★이 칸의 ★까닭이 ★틀렸다) */
  let threw = null;
  let bad;
  try { bad = [A, B].slice().sort(undefined).map((x) => x.id); }
  catch (e) { threw = String(e); }
  assert.strictEqual(threw, null,
    `★전제 깨짐 — ★`.concat(`sort(undefined) 가 ★던졌다(${threw}) ⇒ ★조용한 실패가 ★아니다`));
  /* ★★그 기본 비교는 ★★우리가 ★원하는 순서가 ★★아니다 — ★★그게 ★이 칸의 ★본 단언 */
  const good = [A, B].slice().sort(W.galleryByCreatedAtDesc).map((x) => x.id);
  assert.deepStrictEqual(good, ['a', 'z'], `★전제 — ★제 자의 ★답 (잰 값: ${JSON.stringify(good)})`);
  assert.notDeepStrictEqual(bad, good,
    `★★`.concat(`sort(undefined) 가 ★제 자와 ★같은 답을 ★낸다 (잰 값: ${JSON.stringify(bad)})\n`)
    + '  ⇒ ★★그러면 ★★«그 자가 ★사라져도» ★아무도 ★모른다 ⇒ ★★이 칸이 ★뜻을 ★잃는다');
  /* ★★그리고 ★소비자가 ★★그 이름을 ★참으로 ★부르나 — ★G4 와 ★겹치지 ★않게 ★«이름»만 */
  for (const f of ['ai-image-gallery.js', 'assets-panel.js']) {
    const body = stripComments(readSrc(ROOT, 'js', 'panels', f));
    assert.match(body, /window\.galleryByCreatedAtDesc/,
      `★★${f} 가 ★그 이름을 ★안 부른다 ⇒ ★★`.concat(`sort(undefined) 로 ★조용히 ★떨어진다`));
  }
});
