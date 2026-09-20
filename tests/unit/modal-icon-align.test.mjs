/* U-MDLICONALIGN — 모달 «아이콘+텍스트»(variant=icon) 프리셋의 «중앙이 서로 맞는가».
 *   (현빈 신고 2026-09-20: 「mdl_ts0he_z6q0otw > 모달에 아이콘+텍스트 프리셋을 했는데
 *    서로 중앙이 안 맞는 문제」)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는데
 *     화면엔 「tests 1 / pass 0 / fail 1」로 «작은 실패»처럼 보인다.
 *
 * ★무엇이 결함이었나 (dev@20e50e3 실측)
 *   `_alignStyles` 가 icon 변형에서만 루트를 `flex-direction:row` 로 눕혔다. 그러면 한 속성
 *   (dataset.vAlign)이 두 가지 뜻을 떠맡는다 — 세로쌓기에서는 「상자 안 위/중앙/아래」인데
 *   icon 에서는 주축이 가로라 그 뜻이 justify-content 로 넘어가고, vAlign 은 남은
 *   align-items(교차축) 즉 «아이콘과 글자가 서로 어떻게 맞느냐» 로 밀려났다.
 *   그리고 vAlign 의 폴백이 'top'(flex-start) ⇒ 24px 아이콘과 61.2px 줄높이가 위 기준으로
 *   붙어 중심이 18.59px 어긋났다(헤드리스 크로미움 실측).
 *
 * ★고친 모양 = «두 축 분리»
 *   ⑴ 루트는 다른 변형과 같은 세로쌓기 → vAlign 이 「상자 안 세로 위치」 한 뜻만 갖는다
 *   ⑵ 가로 배치는 `.mdl-iconrow` 래퍼가 맡는다(align-items:flex-start)
 *   ⑶ 아이콘은 «첫 줄»과 맞게 margin-top 오프셋 — ★공통 머리(_modalIconAttrs)에서 나온다
 *   ⑷ ★아이콘이 줄상자보다 «크면» 반대로 «글자»를 내린다 (2026-09-20 픽스라운드, A-10)
 *      — 초판은 아이콘 쪽만 내려서 96/128px 아이콘에서 17.40/33.40px 어긋남이 되살아났다
 *
 * ⚠️여기는 «렌더 산출물»(cssText·innerHTML)까지다. 진짜 중심 좌표는 jsdom 이 없어 단위로는
 *   못 잰다 — tests/dom/modal-icon-align.dom.spec.js 가 getComputedStyle·rect 로 잰다.
 *   그 파일은 `npm test` 스위트에 «안» 들어가므로, 변이를 빨갛게 만드는 책임은 이 파일이 진다.
 *
 * ⛔표도 문자열도 «베끼지» 않는다 — 하네스가 modal-block.js 를 그대로 vm 에 올려 돌린다.
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

/** dataset 만 든 블록을 «진짜로» 렌더해 산출물을 돌려준다. */
function renderOf(ds) {
  const b = fakeBlock(ds);
  M.renderModalBlock(b);
  return { css: b.style.cssText || '', html: b.innerHTML || '' };
}

/* ══ A-1 ★루트가 더 이상 가로로 눕지 않는다 (두 뜻이 겹치던 자리) ══ */

test('A-1 icon 루트는 세로쌓기다 — flex-direction:row 가 없다', () => {
  // ★음성대조: dev@20e50e3 은 `flex-direction:row` 를 냈다 ⇒ 되돌리면 빨강.
  const { css } = renderOf({ variant: 'icon' });
  assert.match(css, /display:flex/, 'icon 루트가 flex 가 아니다');
  assert.match(css, /flex-direction:column/,
    'icon 루트가 세로쌓기가 아니다 — vAlign 이 다시 두 가지 뜻을 떠맡는다');
  assert.doesNotMatch(css, /flex-direction:row/,
    'icon 루트가 여전히 가로다 — vAlign 이 align-items(교차축)로 밀려나 중심이 어긋난다');
});

test('A-2 vAlign 은 «상자 안 세로 위치» 한 뜻만 갖는다 — justify-content 로 나온다', () => {
  const top    = renderOf({ variant: 'icon', vAlign: 'top' }).css;
  const center = renderOf({ variant: 'icon', vAlign: 'center' }).css;
  const bottom = renderOf({ variant: 'icon', vAlign: 'bottom' }).css;
  assert.match(top,    /justify-content:flex-start/, 'vAlign=top 이 justify-content 로 안 나온다');
  assert.match(center, /justify-content:center/,     'vAlign=center 가 justify-content 로 안 나온다');
  assert.match(bottom, /justify-content:flex-end/,   'vAlign=bottom 이 justify-content 로 안 나온다');
  // ⛔교차축에 vAlign 이 남아 있으면 안 된다 — 남으면 아이콘/글자 정렬이 같이 움직인다
  assert.match(center, /align-items:stretch/,
    'icon 루트의 align-items 가 stretch 가 아니다 — vAlign 이 아직 교차축을 만진다');
});

/* ══ A-3 가로 배치는 «래퍼»가 맡는다 ══ */

test('A-3 icon 은 .mdl-iconrow 로 감싸고, icon-stack 은 «안» 감싼다', () => {
  const icon  = renderOf({ variant: 'icon' }).html;
  const stack = renderOf({ variant: 'icon-stack' }).html;
  assert.match(icon, /class="mdl-iconrow"/, 'icon 에 가로 래퍼가 없다 — 아이콘과 글자가 세로로 쌓인다');
  assert.match(icon, /flex-direction:row/,  '래퍼가 가로가 아니다');
  assert.match(icon, /align-items:flex-start/,
    '래퍼가 flex-start 가 아니다 — 여러 줄에서 아이콘이 문단 한가운데로 내려간다');
  assert.doesNotMatch(stack, /mdl-iconrow/,
    'icon-stack 까지 감쌌다 — 기존 icon-stack 전부의 생김새가 달라진다(별도 승인 사안)');
});

test('A-4 Text>정렬(좌/중/우)이 «아이콘 행»에 먹는다 — 래퍼 justify-content', () => {
  // ⛔래퍼에서 justify-content 를 빼면 아이콘 행이 정렬 버튼을 무시한다 ⇒ 여기서 빨강.
  const rowCss = html => (html.match(/class="mdl-iconrow" style="([^"]*)"/) || [])[1] || '';
  assert.match(rowCss(renderOf({ variant: 'icon', align: 'left'   }).html), /justify-content:flex-start/);
  assert.match(rowCss(renderOf({ variant: 'icon', align: 'center' }).html), /justify-content:center/);
  assert.match(rowCss(renderOf({ variant: 'icon', align: 'right'  }).html), /justify-content:flex-end/);
});

/* ══ A-5 아이콘이 «첫 줄»과 맞는 오프셋 ══ */

const slotStyle = html => (html.match(/class="mdl-icon"[^>]*style="([^"]*)"/) || [])[1] || '';
const mt = html => {
  const m = slotStyle(html).match(/margin-top:([\d.]+)px/);
  return m ? parseFloat(m[1]) : 0;
};
/* ★«글자 쪽» 오프셋 — 아이콘이 줄상자보다 클 때 내려가는 건 글자다(픽스라운드) */
const textStyle = html => (html.match(/class="tb-mdl-text"[^>]*style="([^"]*)"/) || [])[1] || '';
const tmt = html => {
  const m = textStyle(html).match(/margin-top:([\d.]+)px/);
  return m ? parseFloat(m[1]) : 0;
};

test('A-5 오프셋 = (fontSize × lineHeight − iconSize) / 2 — 줄간격을 «따라간다»', () => {
  // 기본값: (36 × 1.7 − 24) / 2 = 18.6
  assert.equal(mt(renderOf({ variant: 'icon' }).html).toFixed(2), '18.60',
    '기본값 아이콘 오프셋이 18.6px 이 아니다 — 첫 줄 중심과 안 맞는다');
  // 줄간격을 바꾸면 따라와야 한다(= 1.7 을 두 번째로 적어 두면 여기서 빨강)
  assert.equal(mt(renderOf({ variant: 'icon', lineHeight: '1.2' }).html).toFixed(2), '9.60');
  // 글자가 아이콘보다 작으면 «아이콘은» 안 내린다(음수 금지 — 아래 A-10 이 반대 갈래를 잰다)
  assert.equal(mt(renderOf({ variant: 'icon', fontSize: '12', lineHeight: '1' }).html), 0,
    '글자가 아이콘보다 작은데 아이콘을 내렸다');
});

/* ══ A-10 ★반대 갈래 — 아이콘이 «줄상자보다 클 때» (2026-09-20 픽스라운드) ══
     초판은 아이콘 쪽만 내렸다(max(0, …)) ⇒ 아이콘 > 줄상자면 오프셋이 0 으로 깎이고
     원 신고 증상이 그대로 돌아왔다. 기본 36×1.7 = 61.2px 이므로 62px 부터 어긋나는데,
     모달 «자기 패널»의 아이콘 슬라이더 최대가 96, 아이콘블럭 패널은 512 까지 간다
     (prop-modal.js / prop-iconify.js:46) ⇒ 슬라이더 한 번 끝까지 밀면 다시 어긋났다.
     실앱 9389 실측 음성대조: 96px → +17.40 / 128px → +33.40 (원 신고 18.59 와 같은 크기). */
test('A-10 ★아이콘이 줄상자보다 크면 «글자»를 내린다 — 음성대조 96px:17.40 / 128px:33.40', () => {
  const big = renderOf({ variant: 'icon', iconSize: '96' }).html;
  assert.equal(mt(big), 0, '아이콘이 더 큰데 아이콘을 또 내렸다');
  assert.equal(tmt(big).toFixed(2), '17.40',
    '★글자를 안 내렸다 — 아이콘 96px 에서 중심이 17.40px 어긋난 채로 남는다');
  assert.equal(tmt(renderOf({ variant: 'icon', iconSize: '128' }).html).toFixed(2), '33.40');
  // 줄간격을 키우면 다시 «아이콘» 쪽이 내려간다 — 두 갈래가 같은 표(_mdlLineBox)에서 나온다
  const wide = renderOf({ variant: 'icon', iconSize: '96', lineHeight: '4' }).html; // 36×4 = 144
  assert.equal(tmt(wide), 0, '줄상자가 더 큰데 글자를 내렸다');
  assert.equal(mt(wide).toFixed(2), '24.00', '(144 − 96)/2 = 24');
});

test('A-11 두 오프셋은 «동시에» 켜지지 않는다 — 한쪽만 내려야 중심이 맞는다', () => {
  for (const ds of [{}, { iconSize: '96' }, { iconSize: '12' }, { fontSize: '12', lineHeight: '1' },
                    { raster: '1', iconSrc: 'goya-asset://x.png', iconSize: '96' }]) {
    const html = renderOf(Object.assign({ variant: 'icon' }, ds)).html;
    assert.ok(mt(html) === 0 || tmt(html) === 0,
      `아이콘·글자를 둘 다 내렸다(${JSON.stringify(ds)}: icon ${mt(html)} / text ${tmt(html)})`);
  }
});

test('A-12 ★음성대조: icon-stack 은 글자도 «안» 내린다', () => {
  assert.equal(tmt(renderOf({ variant: 'icon-stack', iconSize: '96' }).html), 0,
    'icon-stack 글자에 margin-top 이 붙었다 — 이미 만들어 둔 블록 전부가 내려간다');
  // plain 변형도 무영향 (래퍼가 없으니 오프셋이 낄 자리도 없다)
  assert.equal(tmt(renderOf({ variant: 'plain', iconSize: '96' }).html), 0);
});

test('A-6 ★오프셋은 «공통 머리»에서 나온다 — 래스터 분기도 같이 받는다', () => {
  /* _modalIconHtml 은 return 이 둘(래스터 <img> · 벡터 <svg>)이다.
     분기에 각각 적으면 한쪽만 고쳐진다 — 이 파일이 막는 자리다. */
  const vec = renderOf({ variant: 'icon' }).html;
  const ras = renderOf({ variant: 'icon', raster: '1', iconSrc: 'goya-asset://x.png' }).html;
  assert.ok(mt(vec) > 0, '벡터 분기에 오프셋이 없다');
  assert.ok(mt(ras) > 0, '★래스터(PNG) 아이콘에 오프셋이 없다 — 한 분기만 고쳤다');
  assert.equal(mt(vec), mt(ras), '두 분기의 오프셋이 다르다 — 표가 두 벌이 됐다');
  // 소스 래칫: margin-top 리터럴은 _modalIconAttrs «안»에만 있어야 한다
  const attrsFn = (SRC_MODAL.match(/function _modalIconAttrs[\s\S]*?\n}/) || [''])[0];
  const htmlFn  = (SRC_MODAL.match(/function _modalIconHtml[\s\S]*?\n}/) || [''])[0];
  assert.match(attrsFn, /margin-top/, '_modalIconAttrs(공통 머리)에 오프셋이 없다');
  assert.doesNotMatch(htmlFn, /margin-top/,
    '_modalIconHtml 분기에 margin-top 을 직접 적었다 — 두 분기가 갈라질 자리다');
});

test('A-7 ★음성대조: icon-stack 아이콘에는 오프셋을 «안» 얹는다', () => {
  const stack = renderOf({ variant: 'icon-stack' }).html;
  assert.equal(mt(stack), 0,
    'icon-stack 아이콘에 margin-top 이 붙었다 — 이미 만들어 둔 블록 전부가 내려간다');
});

/* ══ A-8 icon-stack 의 «생김새»는 바이트 단위로 그대로다 (래칫) ══ */

test('A-8 icon-stack 의 정렬 선언은 종전 그대로', () => {
  const { css } = renderOf({ variant: 'icon-stack' });
  assert.ok(css.endsWith('display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:9px;text-align:center;'),
    `icon-stack 의 _alignStyles 출력이 달라졌다 — 기존 블록 전부의 생김새가 움직인다\n실제: ${css}`);
});

/* ══ A-9 _alignStyles 는 여전히 cssText 의 «맨 뒤» (기존 계약 재확인) ══ */

test('A-9 icon 의 정렬 선언도 cssText 맨 뒤에 있다', () => {
  const { css } = renderOf({ variant: 'icon', dropShadow: 'strong', radius: '12' });
  assert.ok(css.indexOf('box-shadow:') < css.lastIndexOf('justify-content:'),
    'box-shadow 가 정렬 선언 «뒤»로 갔다 — _alignStyles 맨뒤 계약이 깨졌다');
  assert.ok(css.endsWith(';'), 'cssText 가 세미콜론으로 안 끝난다');
});

/* ══ A-13 ★«재렌더 없이» 크기가 바뀌는 두 번째 문 (2026-09-20 픽스라운드) ══
     아이콘 크기를 바꾸는 문이 둘이다:
       ⑴ 모달 자기 패널(#mdl-isize-…, 12~96) → dataset → renderModalBlock ✅ (위 A-5·A-10)
       ⑵ ★아이콘블럭 패널(#icn-size-…, 16~512) → 슬롯 «인라인 스타일»을 직접 고친다.
          그 패널이 슬롯 노드를 붙들고 있어 재렌더를 못 한다 ⇒ 글자 쪽 오프셋이 옛 크기로 남았다.
     실앱 9389 실측 음성대조(이 함수가 없을 때): 96→128 에서 16px, 96→512 에서 208px 어긋남. */
test('A-13 ★세션 중 크기 변경 — 재렌더 없이 두 마진을 현재 크기로 다시 바른다', () => {
  const mk = (iconW, ds = {}) => {
    const icon = { style: { width: iconW } };
    const text = { style: {} };
    const row = { querySelector: (sel) => (sel.includes('mdl-icon') ? icon : text) };
    const block = {
      dataset: Object.assign({ variant: 'icon' }, ds),
      querySelector: (sel) => (sel.includes('mdl-iconrow') ? row : null),
    };
    return { block, icon, text };
  };

  // 아이콘이 줄상자(36×1.7=61.2)보다 큼 → «글자»가 내려간다
  const big = mk('128px');
  assert.equal(M.syncModalIconFirstLineOffset(big.block), true);
  assert.equal(big.text.style.marginTop, '33.4px', '글자 오프셋이 새 크기를 안 따라갔다');
  assert.equal(big.icon.style.marginTop, '', '아이콘에 옛 오프셋이 남았다');

  // 다시 작게 → 방향이 «뒤집힌다». 한쪽을 비우지 않으면 둘 다 내려가 더 어긋난다
  const small = mk('40px');
  small.text.style.marginTop = '33.4px';          // 직전 세션이 남긴 값
  M.syncModalIconFirstLineOffset(small.block);
  assert.equal(small.icon.style.marginTop, '10.6px');
  assert.equal(small.text.style.marginTop, '', '★옛 글자 오프셋을 안 지웠다 — 둘 다 내려간다');

  // ★크기는 «슬롯의 인라인 width»가 진실이다(세션 중 dataset 은 뒤늦게 따라온다)
  const stale = mk('300px', { iconSize: '96' });
  M.syncModalIconFirstLineOffset(stale.block);
  assert.equal(stale.text.style.marginTop, '119.4px', 'dataset(옛 96)을 보고 계산했다');

  // icon 이 아닌 변형·래퍼 없음은 손대지 않는다
  const stack = mk('128px');
  stack.block.dataset.variant = 'icon-stack';
  assert.equal(M.syncModalIconFirstLineOffset(stack.block), false);
  assert.equal(stack.text.style.marginTop, undefined);
});

test('A-14 ★무한 고리 방지 — 값이 같으면 «안 쓴다»(감시자 안에서 불린다)', () => {
  /* 이 함수는 MutationObserver 콜백에서 불린다. 같은 값이라도 쓰면 속성 변경 기록이 또 나서
     감시자가 자기 자신을 영원히 깨운다. 쓰기 횟수를 세어 «두 번째 호출은 0회»를 확인한다. */
  let writes = 0;
  const mkCounted = () => {
    let v = '';
    return { style: { width: '128px', get marginTop() { return v; }, set marginTop(x) { writes++; v = x; } } };
  };
  const icon = mkCounted(), text = mkCounted();
  const row = { querySelector: (sel) => (sel.includes('mdl-icon') ? icon : text) };
  const block = { dataset: { variant: 'icon' }, querySelector: () => row };
  M.syncModalIconFirstLineOffset(block);
  const first = writes;
  assert.ok(first > 0, '첫 호출이 아무 것도 안 썼다');
  M.syncModalIconFirstLineOffset(block);
  assert.equal(writes, first, '★같은 값을 또 썼다 — 감시자가 자기 자신을 깨우는 무한 고리가 된다');
});
