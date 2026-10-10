/* shape-star-colors.test.mjs — ★b2 의 ★«개별 색» 축 (현빈 2026-10-10 · 1010t1b2 · 지디 ㉡㉣)
 *
 * ★현빈 원문: 「캔버스에서 별모양의 쉐이프블럭을 ★더블클릭하면, ★개별 별모양 블럭을 선택하고
 *               ★색 지정 및 ★모서리 핸들로 크기조절이 ★개별로 가능하게 해줄 것」
 * ★★이 파일은 ★그 중 ★«색»뿐이다 — ★«크기»(`starScales`)는 ★★안 만들었다(지디 판정 ⑧ ★대기).
 * ★★그리고 ★★«더블클릭 진입 모드»도 ★★아직 없다 — ★창이 ★닫혀 ★행위로 못 재기 때문이다.
 *   ⇒ ★★이 파일이 ★재는 것은 ★★«상태 → 칠» ★한 축이다. ⛔«사람이 고를 수 있다»는 ★안 잰다.
 *
 * ★★지디가 ★★필수로 ★건 ★두 칸을 ★여기 세운다:
 *   ㉡ ★★★양성대조 — 「★그 키를 ★일부러 ★안 싣게 하면 ★★색이 ★사라지나」
 *      ⛔없으면 ★★«살아 있다»가 ★★«원래 ★기본값이라 ★같아 보인다»와 ★구분이 ★안 된다
 *   ㉣ ★★옛 바이트 ★보존 — ★미설정이면 ★★fill 을 ★한 번도 ★쓰지 않는다(`starInner` 특례와 같은 규율)
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
const { mkTmpRoot } = require('./_tmproot.js');   /* ★임시 루트의 ★임자 — ★만들기·치우기를 ★그 자가 쥔다 */

const ROOT = path.join(import.meta.dirname, '..', '..');
const M = await (async () => {
  const fs = (await import('node:fs')).default;
  const os = (await import('node:os')).default;
  const { pathToFileURL } = await import('node:url');
  /* ★★임시 루트는 ★★레포의 ★공용 자가 ★만든다 — ★`tests/unit/_tmproot.js` ★`mkTmpRoot`
     ⇒ ★★그 자가 ★pid 우산 ＋ ★죽은 실행 회수 ＋ ★디스크 사전게이트 ＋ ★종료훅을 ★다 쥔다
     ⇒ ★★★그래서 ★부르는 쪽이 ★지울 필요가 ★★없다. ⛔`rmSync` 를 ★여기 ★두지 ★마라 */
  const tmp = mkTmpRoot('gd-star-col-');
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'm.js'));
  const m = await import(pathToFileURL(path.join(tmp, 'm.js')).href);
  /* ⛔★여기 있던 ★`fs.rmSync(tmp, …)` 와 ★그 ★변수경로 가드를 ★★둘 다 ★뺐다(2026-10-10 지디 ⑴⑵).
     ★까닭: ★`mkTmpRoot` 가 ★★치우기를 ★쥔다 ⇒ ★★★지울 일이 ★없으니 ★가드도 ★뜻이 없다.
     ★★«가드를 더하는 것»보다 ★★«지우는 줄을 ★없애는 것»이 ★낫다 — ★지디 ⒝「백업은 더하기다」와 같은 결. */
  return m;
})();
const { starColorList, starColorsAttr, starFillsFor,
        STAR_FILL_ON, STAR_FILL_OFF, STAR_RATING_MAX } = M;
const PANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-shape.js'));

test('C0 ★전제 — ★평점 두 색이 ★서로 다르고 ★분모가 5 다 (⛔재기 전에 단언)', () => {
  assert.notStrictEqual(STAR_FILL_ON, STAR_FILL_OFF, '★두 색이 같으면 ★아래 대조가 ★뜻이 없다');
  assert.strictEqual(STAR_RATING_MAX, 5, `잰 값: ${STAR_RATING_MAX}`);
});

test('C1 ★미설정 = ★null = ★«전부 물려받음» — ⛔색으로 바꾸지 않는다', () => {
  for (const v of [undefined, null, '', '   ']) {
    assert.strictEqual(starColorList(v, 5), null, `★${JSON.stringify(v)} 가 null 이 아니다`);
  }
  /* ★★칸이 ★전부 비면 ★미설정과 ★같다 — ⛔"," 나 ",,," 가 ★«설정»으로 보이면 ★옛 바이트가 깨진다 */
  for (const v of [',', ',,', ',,,,', ' , , ']) {
    assert.strictEqual(starColorList(v, 5), null, `★${JSON.stringify(v)} 가 ★미설정으로 안 접혔다`);
  }
});

test('C2 ★index 로 ★꽂힌다 · ★빈 칸은 ★물려받는다 · ★길이는 ★갯수다', () => {
  const l = starColorList('#ff0000,,#00ff00', 5);
  assert.deepStrictEqual(l, ['#ff0000', null, '#00ff00', null, null], `잰 값: ${JSON.stringify(l)}`);
  assert.strictEqual(starColorList('#ff0000', 3).length, 3, '★길이가 갯수를 안 따른다');
  /* ★갯수보다 ★목록이 길면 ★잘린다 — ⛔안 자르면 ★없는 별의 색이 ★남는다 */
  assert.strictEqual(starColorList('#a,#b,#c,#d', 2).length, 2, '★갯수 2 인데 길이가 2 가 아니다');
});

test('C3 ★왕복 — ★목록 → 문자열 → ★목록이 ★제자리로 온다', () => {
  for (const l of [['#ff0000', null, '#00ff00', null, null], [null, '#111111', null], ['#abcdef']]) {
    const attr = starColorsAttr(l);
    const back = starColorList(attr, l.length);
    assert.deepStrictEqual(back, l, `★왕복이 깨졌다 — ${JSON.stringify(l)} → ${JSON.stringify(attr)} → ${JSON.stringify(back)}`);
  }
  /* ★전부 비면 ★null = ★«키를 지우라» — ★옛 바이트 보존의 입구다 */
  assert.strictEqual(starColorsAttr([null, null, null]), null, '★전부 빈 목록이 null 이 아니다');
  assert.strictEqual(starColorsAttr([]), null, '★빈 목록이 null 이 아니다');
  /* ★꼬리 빈 칸은 ★버린다 — ★같은 뜻이면 ★짧은 쪽이 정본(직렬화가 흔들리지 않게) */
  assert.strictEqual(starColorsAttr(['#a', null, null]), '#a', `잰 값: ${starColorsAttr(['#a', null, null])}`);
});

test('C4 ★★★㉣ ★옛 바이트 보존 — ★둘 다 미설정이면 ★칠을 ★한 번도 안 한다', () => {
  assert.strictEqual(starFillsFor({ count: 5 }), null, '★미설정인데 칠 배열이 나왔다');
  assert.strictEqual(starFillsFor({ rating: undefined, colors: undefined, count: 5 }), null,
    '★undefined 둘인데 칠 배열이 나왔다');
  assert.strictEqual(starFillsFor({ rating: '', colors: '', count: 5 }), null,
    '★빈 문자열 둘인데 칠 배열이 나왔다');
  assert.strictEqual(starFillsFor({ colors: ',,,', count: 5 }), null,
    '★빈 칸만 든 목록인데 칠 배열이 나왔다');
});

test('C5 ★★★㉡ ★양성대조 — ★그 키를 ★«안 싣으면» ★★색이 ★참으로 ★사라진다', () => {
  /* ★★지디 ㉡ 의 그 칸이다. ⛔이게 없으면 ★«살아 있다»와 ★«기본값이라 같아 보인다»가 ★구분 안 된다.
     ★꼴: ★같은 count 에서 ★★키를 ★싣고 / ★안 싣고 ★두 번 재어 ★★둘이 ★달라야 한다. */
  const WITH = starFillsFor({ colors: '#ff0000,,#00ff00', count: 5 });
  const WITHOUT = starFillsFor({ colors: undefined, count: 5 });
  assert.notDeepStrictEqual(WITH, WITHOUT,
    '★★키를 안 실었는데도 ★같은 칠이 나왔다 — ★이 검사는 ★아무것도 안 재고 있다');
  assert.strictEqual(WITHOUT, null, '★키 없을 때가 ★null 이 아니다');
  assert.strictEqual(WITH[0], '#ff0000', `★0번 별 (잰 값: ${WITH[0]})`);
  assert.strictEqual(WITH[2], '#00ff00', `★2번 별 (잰 값: ${WITH[2]})`);
  assert.strictEqual(WITH[1], null, '★1번 별은 ★물려받아야 한다');
  /* ★★그리고 ★평점 쪽도 ★같은 자로 — ★키를 빼면 ★평점 칠이 ★사라지나 */
  const R_WITH = starFillsFor({ rating: 3, count: 5 });
  const R_WITHOUT = starFillsFor({ rating: undefined, count: 5 });
  assert.notDeepStrictEqual(R_WITH, R_WITHOUT, '★평점 키를 빼도 ★같은 칠이다');
  assert.strictEqual(R_WITHOUT, null, '★평점 키 없을 때가 null 이 아니다');
});

test('C6 ★우선순위 — ★개별 색 ＞ ★평점 ＞ ★물려받기 (★내 기본값 · 지디 판정 대기)', () => {
  /* ★평점 3 이면 0·1·2 가 ★채운 색, 3·4 가 ★빈 색. ★거기에 ★1번만 ★개별 색을 준다. */
  const f = starFillsFor({ rating: 3, colors: ',#123456', count: 5 });
  assert.strictEqual(f[0], STAR_FILL_ON,  `★0번은 평점 채운 색 (잰 값: ${f[0]})`);
  assert.strictEqual(f[1], '#123456',     `★1번은 ★개별 색이 ★이긴다 (잰 값: ${f[1]})`);
  assert.strictEqual(f[2], STAR_FILL_ON,  `★2번은 평점 채운 색 (잰 값: ${f[2]})`);
  assert.strictEqual(f[3], STAR_FILL_OFF, `★3번은 평점 빈 색 (잰 값: ${f[3]})`);
  assert.strictEqual(f[4], STAR_FILL_OFF, `★4번은 평점 빈 색 (잰 값: ${f[4]})`);
  /* ★★둘이 ★다른 dataset 에 ★따로 산다 ⇒ ★★어느 쪽도 ★남의 데이터를 ★지우지 않는다 = ★가역
     ⇒ ★개별 색을 ★빼면 ★평점 칠이 ★그 자리에 ★돌아온다 */
  const back = starFillsFor({ rating: 3, colors: undefined, count: 5 });
  assert.strictEqual(back[1], STAR_FILL_ON,
    '★개별 색을 빼도 ★평점 칠이 ★돌아오지 않는다 — ★가역이 ★깨졌다');
});

test('C7 ★칠의 ★임자가 ★하나다 — ★패널은 ★`starFillsFor` ★하나만 부른다(⛔섞지 않는다)', () => {
  const owner = (PANEL.match(/starFillsFor\(/g) || []).length;
  assert.strictEqual(owner, 1, `★starFillsFor 호출이 ★${owner} 번이다 — ★하나여야 한다`);
  /* ★★평점 칠을 ★패널이 ★따로 부르면 ★순서 의존이 생긴다 — ★그 길이 ★없어야 한다 */
  const direct = (PANEL.match(/starRatingFills\(/g) || []).length;
  assert.strictEqual(direct, 0,
    `★패널이 ★starRatingFills 를 ★직접 ★${direct} 번 부른다 — ★칠은 ★starFillsFor ★한 자로만`);
});
