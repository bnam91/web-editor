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
/* ★1010t2a ⑴ — ★«자리 통일»의 ★분모. ★★주석은 ★뗀다(★주석의 예시가 ★측정값이 되는 것 방지) */
const CHATPANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-chat.js'));
const CHATBLOCK = stripComments(readSrc(ROOT, 'js', 'blocks', 'chat-block.js'));

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

test('C8 ★★★별점 색의 ★«자리»가 ★하나다 — ★패널 ★미리보기 ★둘이 ★상수를 ★읽는다 (1010t2a ⑴ · 지디 ⒝)', () => {
  /* ★★★왜 ★이 칸이 ★생겼나 — ★t3frame 의 ★실측이 ★찾았다:
   *   ★별점 주황이 ★★다섯 자리에 ★흩어져 ★있었고, ★그중 ★★★둘(★패널 미리보기)은
   *   ★★`R4`(shape-star-rating.test.mjs)가 ★★안 보는 자리였다
   *   ⇒ ★★★즉 ★★«반쪽만 고치면 ★조용히 ★남는» 자리였다. ★★이 칸이 ★그 분모를 ★메운다
   * ★★그리고 ★★★«값 통일»이 ★아니라 ★★«자리 통일»이다 — ★`#f59e0b` 설은 ★기각됐다(★css 의 ★qa·todo 색이었다)
   *
   * ⛔★★★검사 파일의 ★손으로 ★박힌 값은 ★★건드리지 ★않는다 — ★★★그게 ★★이 자의 ★«독립된 눈»이다:
   *   ★`R4` 는 ★`chat-block.js` 의 ★삼항에서 ★정규식으로 ★뽑아 ★상수와 ★견준다
   *   ★`tests/dom/shape-star-b1b3.dom.spec.js` 는 ★`'#ff8a00'` 을 ★손으로 ★적어 ★화면 칠을 ★잰다
   *   ⇒ ★★★그 둘을 ★상수를 ★읽게 ★고치면 ★★★항등식이 ★되어 ★아무것도 ★안 잠근다(★지디 경고) */
  const LIT = () => /#ff8a00|#d6d6d6/gi;

  /* ⒜ ★★상수를 ★읽어야 ★하는 자리 — ★리터럴이 ★0 이어야 ★한다 */
  const MUST_IMPORT = { 'js/props/prop-shape.js': PANEL, 'js/props/prop-chat.js': CHATPANEL };
  for (const [name, src] of Object.entries(MUST_IMPORT)) {
    const hits = src.match(LIT()) || [];
    assert.deepEqual(hits, [],
      `★★${name} 에 ★별점 색이 ★손으로 ★박혀 ★있다(★${hits.length}건: ${JSON.stringify(hits)}) — `
      + '★★`STAR_FILL_ON` 을 ★읽어라. ⛔여기에 ★값을 ★다시 ★적으면 ★자리가 ★또 ★갈린다');
    assert.match(src, /STAR_FILL_ON/,
      `★★${name} 이 ★`.concat('STAR_FILL_ON 을 ★안 읽는다 — ★★미리보기 색의 ★출처가 ★사라졌다'));
  }

  /* ⒝ ★★★`chat-block.js:134` 는 ★★★«일부러» ★리터럴이다 — ⛔합치지 ★마라
   *   ★★★판정 ★2026-10-10 (★지디): ★★★③ 은 ★★합치지 ★않는다. ★★④⑤ 만 ★합쳤다
   *   ★★까닭 — ★★«구조 통일»은 ★★목적이 ★아니라 ★★수단이다. ★★참 목적은 ★★★«조용히 ★갈리지 ★않는다»:
   *     ⒤ ★`R4`(`shape-star-rating.test.mjs`)가 ★★«두 ★소스의 ★값 ★대조»를 ★한다 —
   *        ★챗이 ★★«따로» ★박았기 ★때문에 ★★참 ★대조다
   *     ⒥ ★★그래서 ★상수만 ★고치고 ★챗을 ★안 고치면 ★★R4 가 ★★빨개진다
   *        ⇒ ★★★«조용히 ★갈리는 일»이 ★★이미 ★★불가능하다 ⇒ ★★합치기가 ★★살 ★것이 ★없다
   *     ⒦ ★★그런데 ★★상수로 ★바꾸면 ★R4 는 ★★«챗이 ★그 상수를 ★참조하나»로 ★떨어진다
   *        ⇒ ★★★엄격히 ★★약하다(★값을 ★안 잠근다) ⇒ ★★★순손실이다
   *     ⒧ ★★반면 ★★④⑤ 는 ★★★R4 의 ★★분모 ★밖이었다 ⇒ ★★거기엔 ★합칠 ★값이 ★있었다
   *   ★★★한 줄: ★★★«합칠 ★값은 ★★«잠기지 ★않은 ★자리»에만 ★있다»
   *   ⇒ ★★그리고 ★★★챗 색을 ★«행위»로 ★재는 자는 ★★★0 이다(★실측: ★`chb-stars` 를 ★보는
   *      ★DOM spec ★0벌 · ★유닛 ★0벌) ⇒ ★★R4 를 ★놓으면 ★★이어받을 자가 ★★없다
   *
   * ★★★정정 (2026-10-11 · 지디) — ★위 「★이어받을 자가 ★없다」는 ★★거짓이었다.
   *   ⚠️★★위 줄을 ⛔지우지 ★않는다 — ★★그것이 ★2026-10-10 판정의 ★근거 문장이었으므로
   *      ★★«무엇이 ★틀렸는지»가 ★보여야 ★한다(지디 지시).
   *   ★참값: ★★이어받을 자가 ★★있다 — ★`tests/dom/bt-bubble-chat.dom.spec.js` 의 ★`BT-CLOCK` 이
   *      ★`innerHTML` 을 ★`toEqual` ★전체 동치로 견주고 ★그 장면에 ★`stars: 4` 가 박혀 있어
   *      ★★«그 값»을 ★잠근다. ★실측(DOM 1벌): ★양성 `#ff8a00`→`#ff8a01` ★빨강 ·
   *      ★★음성(이 장면이 안 타는 갈래) ★초록 ⇒ ⛔«무엇을 고쳐도 빨강»이 ★아니다.
   *   ★★단 ★엄격히 ★약하다 — ★골든은 ★제품에서 ★파생된 fixture 라
   *      ★누가 ★상수를 바꾸고 ★골든을 ★다시 뜨면 ★두 소스가 ★같이 움직여 ★★대조가 ★조용해진다.
   *      ⇒ ★그 자리를 막는 것은 ★★골든 갱신 ★규율이다(지워진 줄 0 · added 전부 이번 id · ⛔눈 diff 금지).
   *      ⇒ ★★R4 보다 ★약하고 ★«참조하나»보다 ★세다. ★그 이어받을 자 = ★★`C9`(이 파일 ★아래).
   *   ★★★그리고 ★★«두어라»의 ★★까닭이 ★바뀌었다(지디 판정 2026-10-11):
   *      ★옛 까닭 = 「이어받을 자가 ★없다 ⇒ ★순손실」          ⇐ ★★거짓
   *      ★★새 까닭 = 「★★이득이 ★★아직 ★오지 ★않았다」 —
   *        ★③ 의 ★이득(값 변경이 ★한 자리에서 끝난다)은 ★★⑷(★회색/주황 ★고르기)가 ★들어와
   *        ★★챗의 ★리터럴이 ★더 이상 ★정본이 ★아니게 ★될 때 ★생긴다.
   *        ⇒ ★★그때까지 ③ 만 ★떼어 하면 ★★비용(★R4 → ★C9 로 ★잠금이 ★내려간다)만 ★물고 ★이득이 ★없다.
   *      ⇒ ★★★그래서 ★판정은 ★★그대로 ★«두어라»다. ★★③ 은 ★★⑷ 와 ★«한 묶음»에서 ★판정한다.
   *   ⇒ ★★그래서 ★★아래는 ★★그 닻이 ★★살아 있는지 ★★지킨다 — ⛔«옮겨라»가 ★아니라 ★★«두어라»다 */
  const anchor = CHATBLOCK.match(/\?\s*'(#[0-9a-fA-F]{6})'\s*:\s*'(#[0-9a-fA-F]{6})'/);
  assert.ok(anchor,
    '★★`chat-block.js` 의 ★삼항 ★닻이 ★사라졌다 — ★★`R4` 가 ★대조할 ★정본을 ★잃는다.\n'
    + '  ⛔★그 자리를 ★★상수로 ★바꾸지 ★마라 — ★★판정 2026-10-10(지디): ★★합치지 ★않는다.\n'
    + '  ★까닭: ★★그 ★리터럴이 ★★«두 소스 값 대조»를 ★가능하게 ★한다. ★상수로 바꾸면 ★참조 단언으로 ★떨어진다.\n'
    + '  ★그리고 ★★챗 색을 ★«행위»로 ★재는 자가 ★★0 이다 ⇒ ★★R4 를 ★놓으면 ★이어받을 자가 ★없다.\n'
    /* ★★★정정(2026-10-11 · 지디) — ★★바로 ★위 ★한 줄은 ★★거짓이다. ⛔지우지 ★않고 ★그어 둔다.
       ★★여기엔 ★★«무엇이 ★틀렸나 ＋ ★참값 ＋ ★이어받을 자»만 ★적는다 —
       ★★긴 ★까닭은 ★★이 파일 ★머리말의 ★정정 절에 ★★한 벌로만 ★둔다.
       ⛔양쪽에 ★★같은 ★설명을 ★★베끼면 ★★명부가 ★둘이 된다(★내 교훈). */
    + '  ★★★정정(2026-10-11): ★바로 ★위 ★한 줄은 ★★거짓이다 — ★★이어받을 자가 ★★있다.\n'
    + '    ★`BT-CLOCK`(tests/dom/bt-bubble-chat.dom.spec.js)이 ★`stars: 4` 장면의 ★`innerHTML` 을\n'
    + '    ★`toEqual` 로 견뎌 ★★그 값을 ★잠근다(★실측 DOM 1벌: ★양성 ★빨강 · ★★음성 ★초록).\n'
    + '    ★그 ★이어받을 자 = ★★`C9`(이 파일) — ★★단 ★골든은 ★제품 파생이라 ★R4 보다 ★★약하다.\n'
    + '    ⇒ ★★그래도 ★판정은 ★«두어라» — ★까닭이 ★★«순손실»에서 ★★«이득이 ★아직 ★없다»로 ★바뀌었다.\n'
    + '  ⇒ ★★합치고 싶으면 ★★먼저 ★`chb-stars` 의 ★color 를 ★★DOM 에서 ★재는 자를 ★세워라');
  assert.strictEqual(anchor[1], STAR_FILL_ON, `★닻의 ★채운 색이 ★상수와 ★다르다 (잰 값: ${anchor[1]})`);
  assert.strictEqual(anchor[2], STAR_FILL_OFF, `★닻의 ★빈 색이 ★상수와 ★다르다 (잰 값: ${anchor[2]})`);

  /* ⒞ ★★양성대조 — ★★이 자가 ★참으로 ★리터럴을 ★잡나(⛔«0건»이 ★«안 걸어봤다»인지 ★가른다)
   *   ★★글자는 ★조립한다 — ★★이 파일이 ★제 자의 ★입력이 ★되지 ★않게 */
  const FAKE = 'style="color:' + '#ff' + '8a00"';
  assert.equal((FAKE.match(LIT()) || []).length, 1,
    '★양성대조 실패 — ★심어 놓은 ★리터럴을 ★못 잡는다 ⇒ ★★위 ★«0건»은 ★★«안 쟀다»다');
  /* ⒟ ★음성대조 — ★상수를 ★읽는 꼴은 ★걸리면 ★안 된다 */
  assert.equal(('style="color:${STAR_FILL' + '_ON}"').match(LIT()), null,
    '★음성대조 실패 — ★상수를 ★읽는 줄을 ★위반으로 ★센다 ⇒ ★★고친 자리가 ★전부 ★빨개진다');
});

/* ══ C9 ★★«R4 의 ★이어받을 자» — ★★골든이 ★챗 별색의 ★«값»을 ★잠근다 ════════════════════
 * ★★왜 ★이 칸이 ★생겼나(2026-10-11):
 *   ★나는 ★C8 에 ★「★챗 색을 ★행위로 재는 자 ★0 ⇒ ★★R4 를 놓으면 ★★이어받을 자가 ★없다」라 ★적었다.
 *   ★★앞 문장은 ★참이었고 ★★뒤 ★추론이 ★★거짓이었다 — ★내가 ★틀렸다.
 *   ★실측(지디 GO · DOM 1벌 2026-10-11):
 *     ★`tests/dom/bt-bubble-chat.dom.spec.js` 의 ★`BT-CLOCK` 이 ★`innerHTML` 을 ★`toEqual` ★전체 동치로 견주고,
 *     ★그 장면의 ★`LOCK_MSGS[0]` 에 ★★`stars: 4` 가 ★박혀 있다.
 *     ⇒ ★양성대조 `#ff8a00`→`#ff8a01` ★★빨강 · ★★음성대조(★이 장면이 ★안 타는 갈래) ★★초록
 *     ⇒ ★★즉 ★★«그 값»을 ★정말 ★잠그고 ★★«무엇을 고쳐도 빨강»은 ★아니다.
 *
 * ★★그래서 ★이 칸은 ★그 ★잠금을 ★★«유닛»으로 ★끌어온다 — ★★DOM 을 ★안 돌리고도 ★매 회차 ★재게.
 *   ★★두 소스 = ⑴ ★`js/shape-star.js` 의 ★상수 ⑵ ★★골든 ★fixture 의 ★바이트
 *   ⇒ ★★챗이 ★리터럴을 ★놓아도(③ 상수화) ★★«값 대조»는 ★★살아남는다.
 *
 * ⚠️★★이 자의 ★★한계를 ★적는다(⛔«R4 와 ★같다»고 ★주장하지 ★않는다):
 *   ★골든은 ★★제품에서 ★파생된 ★fixture 다 ⇒ ★★누가 ★상수를 ★바꾸고 ★`BT_CHAT_GOLDEN=update` 로
 *     ★골든을 ★★다시 뜨면 ★★두 소스가 ★★같이 ★움직여 ★★이 대조가 ★조용해진다.
 *   ⇒ ★★그 자리를 ★막는 것은 ★★골든 갱신 ★규율이다(지디: ★«지워진 줄 0 · added 전부 이번 id» · ⛔눈 diff 금지).
 *   ⇒ ★★R4(★사람이 ★따로 ★박은 ★리터럴)보다 ★★엄격히 ★약하다. ★★그래도 ★«참조하나»보다는 ★세다. */
const GOLDENS = ['bt-chat-render-golden.json', 'bt2-chat-render-golden.json'];

/** ★골든 ★JSON ★어디에 ★묻혀 있든 ★`chb-stars` 묶음의 ★색 차례를 ★뽑는다.
 *  ★★꼴을 ★손으로 ★가정하지 ★않는다 — ★bt2 는 ★장면별 ★키로 ★한 겹 ★더 ★깊다(★실측). */
function starGroups(fixture) {
  const fs = require('node:fs');
  const raw = fs.readFileSync(path.join(ROOT, 'tests', 'dom', 'fixtures', fixture), 'utf8');
  const out = [];
  for (const blk of raw.match(/chb-stars[\s\S]*?(?=<\\\/div>|<\/div>)/g) || []) {
    const cols = [...blk.matchAll(/color:(#[0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase());
    if (cols.length) out.push(cols);
  }
  return out;
}

test('C9 ★★★골든이 ★챗 별색 ★«값»을 ★잠근다 — ★★R4 를 놓아도 ★이어받을 자가 ★있다 (실측 2026-10-11)', () => {
  const groups = GOLDENS.flatMap(starGroups);
  /* ⒜ ★★전제 — ⛔«0 묶음»에서 ★아래가 ★전부 ★참이 되면 ★★«안 쟀다»다 */
  assert.ok(groups.length >= 2,
    `★전제 미달 — ★골든에서 ★별 묶음을 ★${groups.length}개 ★찾았다(2개 이상이어야)\\n`
    + '  ⇒ ★골든 꼴이 ★바뀌었거나 ★`stars` 가 ★든 장면이 ★빠졌다 ⇒ ★★이 칸은 ★«안 쟀다»다');
  /* ⒝ ★★본 단언 — ★★거기 쓰인 색은 ★★내 두 상수 ★뿐이다(★★값 ★대조) */
  const seen = [...new Set(groups.flat())].sort();
  const mine = [STAR_FILL_ON, STAR_FILL_OFF].map((c) => c.toLowerCase()).sort();
  assert.deepEqual(seen, mine,
    `★★골든의 ★별 색이 ★상수와 ★다르다 — ★★챗과 ★별이 ★갈렸다\\n`
    + `  ★골든: ${seen.join(' ')}\\n  ★상수: ${mine.join(' ')}\\n`
    + '  ⇒ ★★상수를 ★고쳤으면 ★★골든도 ★같이 떠야 한다(★갱신 판정: ★지워진 줄 0 · added 전부 이번 id)\\n'
    + '  ⇒ ★★골든만 ★틀렸으면 ★★제품이 ★조용히 ★갈린 것이다');
  /* ⒞ ★★★«채운 쪽»에 ★그 색이 ★있나 — ⛔이게 없으면 ⒝ 는 ★★«전부 ★빈 별»인 판에서도 ★초록이다
     ★★즉 ⒝ 만으로는 ★★`STAR_FILL_ON` 을 ★★안 잠근다(★내 교훈: ★항상 참인 단언은 ★0을 잠근다) */
  const onFirst = groups.filter((g) => g[0] === STAR_FILL_ON.toLowerCase());
  assert.ok(onFirst.length >= 1,
    `★★«채운 별»이 ★★한 묶음도 ★없다 — ★★그러면 ★위 ⒝ 는 ★`
    + `★«빈 별 색»만으로도 ★참이 된다(잰 묶음: ${JSON.stringify(groups)})`);
  /* ⒟ ★★평점의 ★꼴까지 — ★★«채운 것들 ★뒤에 ★빈 것들»이어야 한다(★섞이면 ★차례가 ★깨진 것) */
  for (const g of groups) {
    const firstOff = g.indexOf(STAR_FILL_OFF.toLowerCase());
    if (firstOff === -1) continue;
    assert.ok(g.slice(firstOff).every((c) => c === STAR_FILL_OFF.toLowerCase()),
      `★★빈 별 ★뒤에 ★채운 별이 ★다시 ★나온다 — ★평점 차례가 ★깨졌다 (잰 값: ${g.join(' ')})`);
  }
  console.log(`    ★골든 ${GOLDENS.length}벌 · ★별 묶음 ${groups.length}개 · ★쓰인 색 ${seen.join(' ')}`
    + ` · ★채운 묶음 ${onFirst.length}개`);
});
