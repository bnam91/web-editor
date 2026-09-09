/* U-MDLSHADOW — 모달블럭의 «그림자 온/오프»가 진짜로 걸리고, 기존 블록은 «안 바뀌는가».
 *   (현빈 발주 2026-09-09: 「쉐도우도 온오프 기능있으면 좋겠다. 모달박스에
 *    — 이 쉐도우 기능은 줌 블럭의 온오프로 작동하는 것과 같음」)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는데
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다.
 *
 * ★이 파일이 막으려는 «두» 가지 사고
 *   ⑴ 「패널에 버튼은 생겼는데 화면은 한 픽셀도 안 변한다」 — dataset 에만 쓰고 렌더가
 *      선언을 안 내는 병. 소스에 문자열이 있나로는 «절대» 안 잡힌다. 그래서 여기서는
 *      renderModalBlock 을 «진짜로 돌려» block.style.cssText 를 읽는다.
 *   ⑵ ★음성대조 — 「그림자를 넣었더니 이미 만들어 둔 모달 전부가 떠 버렸다」.
 *      기본값에서는 선언이 «한 글자도» 안 나와야 한다. S-2 가 그것만 잰다.
 *
 * ⚠️여기는 «렌더 산출물»(block.style.cssText)까지다. 진짜 getComputedStyle 은 이 레포에
 *   jsdom 이 없어 단위검사로는 못 잰다 — 그건 CDP QA 가 실물 Electron 에서 잰다.
 *   이 파일은 그 앞단이다: 렌더가 선언을 안 내면 getComputedStyle 도 볼 것이 없다.
 *
 * ⛔표를 «베끼지» 않는다 — 하네스가 modal-block.js 를 그대로 vm 에 올려 돌린다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { readSrc } = _req('./_srcread.js');
const { loadModalModule, fakeBlock } = _req('./_modal-harness.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const M = loadModalModule();
const SRC_MODAL = stripComments(readSrc(ROOT, 'js/blocks/modal-block.js'));
const SRC_PROP  = readSrc(ROOT, 'js/props/prop-modal.js');

/* ★단계 이름을 이 파일이 «자기 리터럴로» 갖는다 — 일부러다.
   모듈 쪽 표(MODAL_DROP_SHADOWS)를 그대로 빌려 오면, 누가 표를 ['none'] 하나로 줄여도
   이 검사는 «한 바퀴 돌고» 초록이 된다. 계약은 「세 단계가 있다」이므로 잣대는 밖에 있어야 한다. */
const STEPS = ['none', 'soft', 'strong'];

/** dataset 만 든 블록을 렌더하고 cssText 를 돌려준다(저장·로드 왕복본이 받는 모양 그대로). */
function cssOf(ds) {
  const b = fakeBlock(ds);
  M.renderModalBlock(b);
  return String(b.style.cssText || '');
}
/** cssText 에서 box-shadow 선언 «하나»를 뽑는다. 없으면 null. */
function shadowOf(css) {
  const m = String(css).match(/box-shadow\s*:\s*([^;]+);/);
  return m ? m[1].trim() : null;
}

/* ══ S-0 ★「입력이 살아 있다」 — 이 실행에서 세 단계를 «다» 밟았고 값이 서로 달랐다. ══
   ⛔이게 없으면 아래가 전부 0바퀴 자가통과한다(한 단계만 밟고 초록이 되는 것을 막는다). */

test('S-0 ★세 단계를 다 밟았고, 실제로 «서로 다른» box-shadow 가 나왔다', () => {
  // 되돌리면 빨강: 단계를 하나 지우거나, 두 단계에 같은 값을 주면.
  const seen = new Map();
  for (const step of STEPS) seen.set(step, shadowOf(cssOf({ dropShadow: step })));

  assert.equal(seen.size, 3, `밟은 단계가 ${seen.size}개다 — 셋이어야 한다`);

  // «켜는» 두 단계는 반드시 선언이 나와야 한다. null 이면 그 단계는 화면에서 아무 일도 안 한다.
  for (const step of ['soft', 'strong']) {
    assert.ok(seen.get(step),
      `단계 «${step}» 에서 box-shadow 선언이 «안 나왔다»(cssText 에 없다). ` +
      `dataset 에만 쓰고 렌더가 안 그리는 상태다 — 패널 버튼은 눌리는데 화면은 그대로다.`);
  }
  // 그리고 «켜진 값끼리도» 달라야 한다 — 같으면 3단이 사실상 2단이다.
  assert.notEqual(seen.get('soft'), seen.get('strong'),
    `soft 와 strong 이 «같은 값»(${seen.get('soft')})이다 — 단계가 이름만 셋이고 실은 둘이다.`);
  // none 은 «값이 없어야» 한다(S-2 가 그 성질만 따로 깊게 잰다).
  assert.equal(seen.get('none'), null, `단계 «none» 에서 box-shadow 가 나왔다: ${seen.get('none')}`);

  // 모듈의 표도 «같은 세 단계»를 알고 있어야 한다 — 패널이 이 표로 버튼을 찍는다.
  assert.deepEqual(M.MODAL_DEFAULTS.dropShadow, 'none', '기본값이 none 이 아니다');
});

/* ══ S-1 (M1) — 값을 바꾸면 실제 box-shadow 가 바뀐다 ══ */

test('S-1 세 단계가 «서로 다른» cssText 를 만든다 (none 만 선언 없음)', () => {
  const csses = STEPS.map((s) => cssOf({ dropShadow: s }));
  assert.equal(new Set(csses).size, 3,
    'cssText 셋이 서로 다르지 않다 — 단계가 화면에 반영되지 않는다');

  // 켜는 단계는 «강하게»가 더 짙어야 한다(어휘가 값과 어긋나면 사람이 못 읽는다).
  const alpha = (s) => parseFloat((String(s).match(/rgba\([^)]*?,\s*([\d.]+)\s*\)/) || [])[1] || '0');
  assert.ok(alpha(shadowOf(csses[2])) > alpha(shadowOf(csses[1])),
    `strong(${shadowOf(csses[2])}) 이 soft(${shadowOf(csses[1])}) 보다 «안 짙다» — 어휘와 값이 어긋난다`);
});

test('S-1b 그림자는 다른 선언을 «밀어내지 않는다» — 같이 낸다', () => {
  const css = cssOf({ dropShadow: 'strong', radius: '12', borderW: '2', variant: 'icon-stack' });
  assert.match(css, /box-shadow:/, 'box-shadow 가 없다');
  assert.match(css, /border-radius:12px/, 'border-radius 가 사라졌다 — 새 선언이 앞을 밀어냈다');
  assert.match(css, /border:2px/, 'border 가 사라졌다');
  /* ★_alignStyles 는 «맨 뒤»라는 계약을 갖는다(icon-stack 의 text-align:center 가 이겨야 한다).
     box-shadow 를 그 뒤에 끼우면 그 계약이 깨진다. 순서를 여기서 못박는다. */
  assert.ok(css.indexOf('box-shadow:') < css.lastIndexOf('text-align:center'),
    'box-shadow 가 _alignStyles 출력 «뒤»에 붙었다 — icon-stack 의 정렬 계약이 깨진다');
});

/* ══ S-2 (M2) ★음성대조 — 기본값에서는 그림자가 «안 걸린다» ══ */

test('S-2 ★음성대조: 기본값·키없음·잘못된 값 — 어느 쪽도 box-shadow 를 안 낸다', () => {
  // 되돌리면 빨강: MODAL_DEFAULTS.dropShadow 를 'soft' 로 켜거나, none 에도 선언을 내면.

  // ⑴ 「이미 만들어 둔 모달」 = 저장본에 dropShadow 키가 «아예 없다»
  const legacy = cssOf({ variant: 'plain' });
  assert.equal(shadowOf(legacy), null,
    `dropShadow 키가 «없는» 기존 블록에 그림자가 걸렸다: ${shadowOf(legacy)} — ` +
    `이 한 줄이 빨강이면 사용자가 만들어 둔 모달 «전부»의 생김새가 바뀐 것이다.`);
  assert.doesNotMatch(legacy, /shadow/i, '기존 블록의 cssText 에 shadow 라는 말 자체가 새로 생겼다');

  // ⑵ 명시적 'none'
  assert.equal(shadowOf(cssOf({ dropShadow: 'none' })), null, "'none' 인데 선언이 나왔다");
  assert.doesNotMatch(cssOf({ dropShadow: 'none' }), /box-shadow/,
    "'none' 에 `box-shadow:none` 을 냈다 — 바깥 CSS 가 영영 못 이기게 된다");

  // ⑶ 표 밖의 값(손으로 고친 저장본)도 «없음»으로 착지
  for (const bad of ['ON', 'huge', '', '1', 'true', undefined]) {
    assert.equal(shadowOf(cssOf({ dropShadow: bad })), null,
      `표 밖의 값 «${String(bad)}» 이 그림자를 켰다 — 착지점이 none 이 아니다`);
  }

  // ⑷ ★새로 만드는 블록도 «기본은 꺼짐». 전 변형에서.
  for (const v of M.MODAL_VARIANTS) {
    const { block } = M.makeModalBlock({ variant: v });
    assert.equal(block.dataset.dropShadow, 'none', `변형 «${v}» 의 기본 그림자가 none 이 아니다`);
    M.renderModalBlock(block);
    assert.equal(shadowOf(block.style.cssText), null,
      `변형 «${v}» 를 새로 만들었더니 그림자가 걸려 있다`);
  }
});

/* ══ S-3 (M3) ★저장→로드 왕복에서 값이 살아남는다 ══ */

test('S-3 ★왕복: dataset 에 살고, 재렌더 두 번을 견디고, 「dataset 만 든 블록」에서도 그려진다', () => {
  // 되돌리면 빨강: makeModalBlock 이 dropShadow 를 안 박거나, 렌더가 dataset 을 안 보면.
  const { block } = M.makeModalBlock({ dropShadow: 'strong' });
  assert.equal(block.dataset.dropShadow, 'strong', 'makeModalBlock 이 dropShadow 를 dataset 에 안 박았다');

  /* ★저장·로드 흉내 — save-load.js 는 outerHTML 을 저장하고 로드 뒤 renderModalBlock 을 부른다
     (js/io/save-load.js:1106). 살아남는 것은 «dataset 뿐»이다. 그 모양 그대로 재현한다.
     ⛔인라인 style 로 배선했다면 여기서 죽는다 — 그게 이 검사의 존재 이유다. */
  const reloaded = fakeBlock({ ...block.dataset });
  M.renderModalBlock(reloaded);
  const after1 = shadowOf(reloaded.style.cssText);
  M.renderModalBlock(reloaded);                       // ★재렌더 한 번 더
  const after2 = shadowOf(reloaded.style.cssText);

  assert.ok(after1, '왕복 뒤 그림자가 증발했다 — dataset 에 안 살고 있다');
  assert.equal(after1, after2, '재렌더에서 그림자가 달라졌다(또는 죽었다)');
  assert.equal(after1, shadowOf(cssOf({ dropShadow: 'strong' })), '왕복 뒤 값이 «strong» 이 아니다');

  // 복제(dataset 통째 복사)에서도 같아야 한다 — 레이어 패널 복제가 그 경로다.
  const clone = fakeBlock({ ...reloaded.dataset });
  M.renderModalBlock(clone);
  assert.equal(shadowOf(clone.style.cssText), after1, '복제본의 그림자가 원본과 다르다');
});

/* ══ S-4 — 패널이 «같은 표»를 보고, 같은 곳에 쓴다 ══ */

test('S-4 패널(prop-modal.js)에 3단 라디오가 있고, 배선이 dataset 에 쓰고 재렌더한다', () => {
  // 되돌리면 빨강: 버튼을 지우거나, rerender 를 빼거나, 표를 리터럴로 베끼면.
  assert.match(SRC_PROP, /id="mdl-drop-group"/, '패널에 #mdl-drop-group 이 없다');

  const vals = [...SRC_PROP.matchAll(/data-val="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(vals, STEPS,
    `패널 버튼의 값이 ${JSON.stringify(vals)} 다 — 줌과 «같은 세 단계»(${JSON.stringify(STEPS)})여야 한다`);

  // 표를 «빌려 쓴다» — 패널이 자기 배열을 갖고 있으면 표가 늘어도 안 따라온다.
  assert.match(SRC_PROP, /MODAL_DROP_SHADOWS[\s\S]{0,200}from '\.\.\/blocks\/modal-block\.js'/,
    'prop-modal.js 가 MODAL_DROP_SHADOWS 를 안 빌려 온다 — 단계 표가 두 벌이 된다');

  const wiring = stripComments(SRC_PROP);
  assert.match(wiring, /#mdl-drop-group \.prop-align-btn/, '그림자 버튼 배선이 없다');
  assert.match(wiring, /block\.dataset\.dropShadow = next/, '배선이 dataset.dropShadow 에 안 쓴다');
  /* ★rerender() 가 «반드시» 있어야 한다 — 줌과 갈리는 단 하나의 지점이다.
     줌은 CSS 파일이 칠해서 재렌더가 필요 없지만, 모달은 renderModalBlock 이 cssText 를
     다시 짜야 box-shadow 가 나온다. 이 한 줄이 빠지면 「눌리는데 안 먹는」 상태가 된다. */
  const handler = wiring.slice(wiring.indexOf('#mdl-drop-group .prop-align-btn'));
  assert.match(handler.slice(0, 600), /rerender\(\);/,
    '그림자 배선에 rerender() 가 없다 — dataset 만 바뀌고 화면은 그대로다');
  // ⛔인라인 style 직접 박기 금지(재렌더에서 조용히 죽는 자리)
  assert.doesNotMatch(wiring, /style\.boxShadow/,
    'style.boxShadow 로 직접 박았다 — cssText 통째 교체(재렌더)에서 조용히 죽는다');
});

/* ══ S-5 — 값 표가 «한 벌»이다 ══ */

test('S-5 그림자 값 표도, 내는 자리도 «하나»다', () => {
  // 되돌리면 빨강: cssText 에 box-shadow 를 두 번째로 내면(두 자리가 갈라진다).
  const emits = [...SRC_MODAL.matchAll(/`box-shadow:/g)].length;
  assert.equal(emits, 1,
    `modal-block.js 가 box-shadow 를 ${emits} 군데서 낸다 — 한 자리여야 한다(갈라지면 한쪽만 고쳐진다)`);

  /* ★값은 mockup-block.js 의 shadows 표와 «같은 수»여야 한다 — 이 레포에서 「도형 그림자」는
     어디서나 같은 세 수를 뜻한다. 넷째 벌이 생기면 여기서 빨강. */
  const mock = stripComments(readSrc(ROOT, 'js/blocks/mockup-block.js'));
  for (const step of ['soft', 'strong']) {
    const mine = shadowOf(cssOf({ dropShadow: step }));
    const norm = (s) => String(s).replace(/\s+/g, '');
    assert.ok(norm(mock).includes(norm(mine)),
      `단계 «${step}» 의 값(${mine})이 mockup-block.js 의 표에 없다 — 그림자 값이 넷째 벌이 됐다`);
  }
});
