/* modal-bg-image.test.mjs — 10171a5 「모달블럭에 배경 이미지 입힐 수 있게 해줘」 (현빈 2026-10-17)
 *
 * ★착수 전 실측(Planner) — 모달엔 배경이 «색» 하나뿐이었다:
 *   `grep -n "bgImg|bgSize|bgPos|bgRotate|bgLayer" js/blocks/modal-block.js` → rc=1 n=0
 *   `grep -n "bgImg|bgSize|bgPos|bgRotate|배경이미지" js/props/prop-modal.js` → rc=1 n=0
 *   ⇒ ★이 검사가 생기기 전엔 ★「모달에 배경이미지가 되나」를 재는 검사 자체가 ★0건이었다.
 *
 * ★★이 파일이 잠그는 것 — renderModalBlock 의 cssText 조립:
 *   ㉠ 전제 — js/frame-bg.js 가 실제로 ★frameBgSize/frameBgPos/FRAME_BG_SIZE_DEFAULT 를 내놓는다
 *   ㉡ dataset.bgImg 를 넣고 ★2회 렌더해도 background-image 가 ★살아 있다
 *      (1회만 재면 「cssText 통째 교체가 그림을 지운다」는 ★그 병을 못 잡는다 — 모달 회전이
 *       같은 cssText 통째 교체에서 지워졌던 선례, modal-block.js:591~600 머리말).
 *   ㉢ dataset.bgSize 를 ★안 주면 frame-bg.js 의 FRAME_BG_SIZE_DEFAULT(='cover')로 떨어진다
 *      (⛔문자열 'cover' 를 이 파일에 직접 박지 않는다 — ★그 출처에서 읽는다)
 *   ㉣ dataset.bg(색)와 dataset.bgImg 가 ★같이 있어도 ★둘 다 산다(단축 속성이 이미지를 안 지운다)
 *
 * ★음성대조(⒞ 무력화) — 아래 셋 중 하나를 깨면 이 파일이 ★빨개져야 한다:
 *   변이 A: cssText 조립에서 `_bgImageStyles(block)` 호출을 지운다        ⇒ ㉡ 빨강
 *   변이 B: `_bgImageStyles` 를 `background:` 단축 «앞»으로 옮긴다         ⇒ ㉡·㉣ 빨강(순서가 계약)
 *   변이 C: `frameBgSize` 를 안 쓰고 리터럴 'cover' 로 바꾼다               ⇒ frame-bg-roster A1 빨강(이 파일 밖)
 *   ⇒ 실측 결과는 Generator 보고에 ⒞ 칸으로 적는다(⛔「통과」를 손으로 적지 않는다).
 *
 * 실행: node --test tests/unit/modal-bg-image.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { loadModalModule, fakeBlock } = createRequire(import.meta.url)('./_modal-harness.js');

test('전제 — frame-bg.js 다리가 산다(frameBgSize/frameBgPos/FRAME_BG_SIZE_DEFAULT)', () => {
  const M = loadModalModule();
  assert.equal(typeof M.frameBgSize, 'function', '★전제 — frameBgSize 가 없으면 이 파일의 나머지는 뜻이 없다');
  assert.equal(typeof M.frameBgPos, 'function');
  assert.equal(typeof M.FRAME_BG_SIZE_DEFAULT, 'string');
  assert.equal(typeof M.renderModalBlock, 'function');
});

test('㉡ dataset.bgImg → cssText 에 background-image 가 실리고, ★2회 렌더해도 살아있다(cssText 통째 교체 선례)', () => {
  const M = loadModalModule();
  const b = fakeBlock({ bgImg: 'data:image/png;base64,AAAA' });
  M.renderModalBlock(b);
  const css1 = b.style.cssText;
  assert.match(css1, /background-image:url\("data:image\/png;base64,AAAA"\)/, '1회 렌더 — 이미지가 실렸다');
  M.renderModalBlock(b);
  const css2 = b.style.cssText;
  assert.match(css2, /background-image:url\("data:image\/png;base64,AAAA"\)/,
    '★2회 렌더 — cssText 가 통째로 다시 조립돼도 그림이 안 지워진다(회전이 지워졌던 그 병이 여기도 있을 수 있다)');
});

test('㉢ dataset.bgSize 없음 → frame-bg.js 의 FRAME_BG_SIZE_DEFAULT 로 떨어진다(⛔리터럴을 이 자리에 박지 않는다)', () => {
  const M = loadModalModule();
  const b = fakeBlock({ bgImg: 'data:image/png;base64,AAAA' });
  M.renderModalBlock(b);
  assert.match(b.style.cssText, new RegExp(`background-size:${M.FRAME_BG_SIZE_DEFAULT}`),
    `★기본값은 frame-bg.js 가 정본이다(FRAME_BG_SIZE_DEFAULT='${M.FRAME_BG_SIZE_DEFAULT}')`);
});

test('dataset.bgSize 지정 → frameBgSize 가 읽어 그대로 그려진다(contain · "120px 80px")', () => {
  const M = loadModalModule();
  for (const size of ['contain', '120px 80px']) {
    const b = fakeBlock({ bgImg: 'data:image/png;base64,AAAA', bgSize: size });
    M.renderModalBlock(b);
    assert.match(b.style.cssText, new RegExp(`background-size:${size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
});

test('dataset.bgPos 지정 → frameBgPos 가 읽는다(기본 center)', () => {
  const M = loadModalModule();
  const b0 = fakeBlock({ bgImg: 'data:image/png;base64,AAAA' });
  M.renderModalBlock(b0);
  assert.match(b0.style.cssText, /background-position:center/, '★기본값 center');
  const b1 = fakeBlock({ bgImg: 'data:image/png;base64,AAAA', bgPos: '20% 80%' });
  M.renderModalBlock(b1);
  assert.match(b1.style.cssText, /background-position:20% 80%/);
});

test('㉣ dataset.bg(색) ＋ dataset.bgImg 가 같이 있어도 ★둘 다 산다(background 단축이 이미지를 안 지운다)', () => {
  const M = loadModalModule();
  const b = fakeBlock({ bg: '#ff0000', bgImg: 'data:image/png;base64,AAAA' });
  M.renderModalBlock(b);
  assert.match(b.style.cssText, /background:#ff0000;/, '★색이 살아있다');
  assert.match(b.style.cssText, /background-image:url\("data:image\/png;base64,AAAA"\)/, '★그림도 살아있다');
});

/* ⚠️이 하네스의 `style` 은 ★진짜 CSSStyleDeclaration 이 아니라 ★평 JS 객체다(_modal-harness.js mkEl) —
 *   `cssText` 는 ★그냥 ★문자열이라, background 단축이 background-image 를 ★실제로 되돌리는 ★브라우저 동작은
 *   ★이 자로는 ★재현되지 않는다(⛔거짓양성 위험 — 자가 살았는지 먼저 쟀다: 아래 「순서」 단언이 바로 그 확인이다).
 *   ⇒ ★★대신 ★★«문자열 순서»로 그 계약을 직접 잠근다 — `background:` 단축이 ★★언제나
 *     `background-image:` 보다 ★앞에 와야 한다(브라우저에서 뒤가 이기는 것과 같은 뜻). */
test('★순서 계약 — cssText 안에서 `background:${bg}` 단축이 `background-image:` 보다 ★앞에 온다', () => {
  const M = loadModalModule();
  const b = fakeBlock({ bg: '#ff0000', bgImg: 'data:image/png;base64,AAAA' });
  M.renderModalBlock(b);
  const iShort = b.style.cssText.indexOf('background:#ff0000;');
  const iImg = b.style.cssText.indexOf('background-image:');
  assert.ok(iShort >= 0 && iImg >= 0, '★전제 — 둘 다 cssText 안에 있다');
  assert.ok(iShort < iImg,
    `★단축이 ★이미지보다 ★뒤에 오면 ★실제 브라우저에서 background-image 가 지워진다(순서가 계약) — short=${iShort} img=${iImg}`);
});

test('음성대조 — dataset.bgImg 가 없으면 background-image 자체가 안 뜬다(그림자·유리와 같은 규약 · 옛 모달 바이트 불변)', () => {
  const M = loadModalModule();
  const b = fakeBlock({});
  M.renderModalBlock(b);
  assert.doesNotMatch(b.style.cssText, /background-image/, '★키가 없으면 흔적도 없다');
});
