/* 단위 하네스 — 팬 «위치의 단일 진실»과 팬 경로의 «높이 동기 분리».
 * 실행: node tests/unit/pan-native-scroll.test.js  ·  라이브 userData 무접촉(소스를 «읽기»만).
 *
 * ★왜 이 파일이 있나 — 실측(GEN-canvas-c1 §5-3, GEN-canvas-c2-status §13)에서
 *   ⑴ 팬 스텝마다 도는 _syncScalerHeight 는 «정의상 낭비»이고
 *   ⑵ 「캔버스가 얼마나 밀렸나」가 scroll 과 panOffset «두 곳»에 나뉘어 살아서
 *      panOffset 만 보는 코드(노치·resetPanOffset)가 진실의 절반만 본다
 *   는 것이 드러났다. 이 두 계약을 «기계»로 못 박는다.
 *
 * ★두 종류를 «따로» 쓴다:
 *   A. 동작 테스트 — 실제 소스에서 함수 본문을 «뽑아» 가짜 DOM 으로 돌린다(손으로 쓴 모델 아님).
 *   B. 소스 계약 테스트 — 「팬 경로가 sync 를 안 부른다」처럼 «호출 그래프»는 A 로 못 잰다.
 *      ⇒ 실제 소스 텍스트에 대한 단언으로 못 박는다. 되돌리면 «빨강»이 된다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '../../js/editor.js'), 'utf8');

/* ── 소스에서 함수 본문 «뽑기» (중괄호 균형으로 끝을 찾는다) ─────────────── */
/** 주석을 걷어낸다 — 계약 단언은 «코드»를 봐야 한다(주석의 낱말에 걸리면 오탐이다). */
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

function extractFn(src, name) {
  const head = `function ${name}(`;
  const i = src.indexOf(head);
  assert.notEqual(i, -1, `${name} 를 소스에서 못 찾음 — 이름이 바뀌었나?`);
  let d = 0, started = false;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') { d++; started = true; }
    else if (src[k] === '}') { d--; if (started && d === 0) return src.slice(i, k + 1); }
  }
  assert.fail(`${name} 의 끝 중괄호를 못 찾음`);
}

/** 가짜 DOM 으로 getRestingScroll/getPanPosition 을 «실제 소스 그대로» 돌린다. */
function makeEnv({ scalerH, clientH, clientW, scrollH, scrollW, zoom, panX, panY, scrollTop, scrollLeft }) {
  const wrap = { clientHeight: clientH, clientWidth: clientW, scrollHeight: scrollH, scrollWidth: scrollW, scrollTop, scrollLeft };
  const scaler = { offsetHeight: scalerH };
  const document = { getElementById: id => (id === 'canvas-wrap' ? wrap : id === 'canvas-scaler' ? scaler : null) };
  const factory = new Function('document', 'currentZoom', 'panOffsetX', 'panOffsetY', `
    ${extractFn(SRC, 'getRestingScroll')}
    ${extractFn(SRC, 'getPanPosition')}
    return { getRestingScroll, getPanPosition };
  `);
  return { wrap, ...factory(document, zoom, panX, panY) };
}

const BASE = { scalerH: 10000, clientH: 800, clientW: 1000, scrollH: 10000, scrollW: 1000,
               zoom: 100, panX: 0, panY: 0, scrollTop: 0, scrollLeft: 0 };

/* ══ A. 동작 ═════════════════════════════════════════════════════════════ */

test('쉼 위치 = «스크롤 범위의 한가운데» (팬 여지가 대칭이라 곧 콘텐츠 중앙)', () => {
  const e = makeEnv({ ...BASE });
  assert.equal(e.getRestingScroll().top, 4600);           // (10000-800)/2
  const small = makeEnv({ ...BASE, scalerH: 500, scrollH: 500 });
  assert.equal(small.getRestingScroll().top, 0);          // 범위 0 → 0 (음수 스크롤은 없다)
});

test('★쉼 위치는 «실제 scrollHeight» 로만 구한다 — 배율을 다시 곱하지 않는다', () => {
  // scaler.offsetHeight 는 _syncScalerHeight 가 «이미 배율을 곱해» 넣은 값이다.
  // 거기에 또 곱하면 배율이 두 번 걸린다(옛 공식의 버그). 같은 scrollHeight 면
  // 배율이 달라도 쉼 위치는 같아야 한다.
  const a = makeEnv({ ...BASE, zoom: 100 }).getRestingScroll().top;
  const b = makeEnv({ ...BASE, zoom: 40 }).getRestingScroll().top;
  assert.equal(a, b, '배율이 쉼 위치를 «직접» 바꾸면 이중 배율이 되살아난 것이다');
});

test('쉼 위치: 가로는 «범위의 한가운데». 범위가 0 이면 0 (현행 동작과 동일)', () => {
  assert.equal(makeEnv({ ...BASE }).getRestingScroll().left, 0);
  assert.equal(makeEnv({ ...BASE, scrollW: 3000 }).getRestingScroll().left, 1000); // (3000-1000)/2
});

test('★단일 진실: 스크롤로 민 것도 «팬 변위»에 잡힌다 (panOffset 만 보면 못 잡는다)', () => {
  const rest = makeEnv({ ...BASE }).getRestingScroll();      // top 4600
  const e = makeEnv({ ...BASE, scrollTop: rest.top - 300 }); // 쉼 위치보다 300 위로 스크롤
  // 콘텐츠가 «아래»로 300 내려간 것과 같다 → +300
  assert.equal(e.getPanPosition().y, 300);
  assert.equal(e.getPanPosition().x, 0);
});

test('★단일 진실: transform 잔여와 스크롤 성분이 «더해진다»', () => {
  const rest = makeEnv({ ...BASE }).getRestingScroll();
  const e = makeEnv({ ...BASE, scrollTop: rest.top - 300, panY: 50 });
  assert.equal(e.getPanPosition().y, 350);
});

test('★단일 진실: 쉼 위치에 있고 잔여가 0 이면 변위 0 (=「가운데」)', () => {
  const rest = makeEnv({ ...BASE }).getRestingScroll();
  const e = makeEnv({ ...BASE, scrollTop: rest.top, scrollLeft: rest.left });
  assert.deepEqual(e.getPanPosition(), { x: 0, y: 0 });
});

test('가로: 스크롤 성분이 x 변위에 잡힌다', () => {
  const e = makeEnv({ ...BASE, scrollW: 3000, scrollLeft: 1000 - 200 }); // 쉼 1000 에서 200 왼쪽
  assert.equal(e.getPanPosition().x, 200);
});

/* ══ B. 소스 계약 (호출 그래프 — 동작 테스트로는 못 잡는다) ═══════════════ */

test('★S0 계약: _applyScalerTransform 은 «높이 동기»를 부르지 않는다', () => {
  const body = stripComments(extractFn(SRC, '_applyScalerTransform'));
  assert.ok(/scaler\.style\.transform\s*=/.test(body), 'transform 을 쓰긴 해야 한다');
  assert.ok(!/_syncScalerHeight\s*\(/.test(body),
    '팬 스텝마다 도는 함수다 — 여기서 _syncScalerHeight 를 부르면 스텝당 강제 레이아웃 2회가 돌아온다');
});

test('★S0 계약: 배율·콘텐츠가 바뀌는 경로는 «동기하는» 쪽을 부른다', () => {
  for (const fn of ['applyZoom', 'resetPanOffset', 'zoomStep']) {
    const body = stripComments(extractFn(SRC, fn));
    assert.ok(/_applyScalerTransformAndSync\s*\(/.test(body),
      `${fn} 은 배율/콘텐츠를 바꾼다 — 높이 동기 없이는 scrollHeight 가 어긋난다`);
  }
});

test('★S1\' 계약: resetPanOffset 은 쉼 위치 공식을 «자기 손으로» 다시 계산하지 않는다', () => {
  const body = stripComments(extractFn(SRC, 'resetPanOffset'));
  assert.ok(/getRestingScroll\s*\(/.test(body), 'getRestingScroll() 을 써야 진실이 한 벌이다');
  assert.ok(!/idealScrollTop/.test(body),
    '옛 공식이 남아 있다 — getRestingScroll 과 갈리면 「가운데」 판정이 두 벌이 된다');
});

test('★S1\' 계약: getPanPosition 은 scroll «과» panOffset 을 «둘 다» 본다', () => {
  const body = stripComments(extractFn(SRC, 'getPanPosition'));
  assert.ok(/scrollLeft/.test(body) && /scrollTop/.test(body), '스크롤 성분을 봐야 한다');
  assert.ok(/panOffsetX/.test(body) && /panOffsetY/.test(body), 'transform 잔여 성분을 봐야 한다');
  assert.ok(/getRestingScroll\s*\(/.test(body), '쉼 위치 기준이 있어야 변위가 정의된다');
});

test('단일 진실 함수가 window 로 노출된다 (탭 뷰상태·하네스가 쓴다)', () => {
  assert.ok(/window\.getPanPosition\s*=/.test(SRC));
  assert.ok(/window\.getRestingScroll\s*=/.test(SRC));
});

/* ── 요약(러너가 읽는 형식) ─────────────────────────────────────────────── */
process.on('exit', () => {});


/* ══ C. S2 — 팬 여지(pan room) ═══════════════════════════════════════════ */

test('★S2 계약: 팬 mousemove 는 scaler.style.transform 을 «쓰지 않는다»', () => {
  // 성립 조건이다 — 스크롤 컨테이너 안에서 transform 을 쓰면 그 프레임 표시목록이
  // 통째로 다시 기록된다(실측 Paint 27ms → 165ms, 축·거리 무관).
  const i = SRC.indexOf("window.addEventListener('mousemove'");
  assert.notEqual(i, -1, '팬 mousemove 핸들러를 못 찾음');
  const body = stripComments(SRC.slice(i, SRC.indexOf("window.addEventListener('mouseup'", i)));
  assert.ok(!/_applyScalerTransform\s*\(/.test(body),
    '팬 중 transform 을 쓰면 개선이 통째로 사라진다');
  assert.ok(!/scaler\.style\.transform/.test(body), '직접 쓰기도 금지');
  assert.ok(/scrollLeft\s*=/.test(body) && /scrollTop\s*=/.test(body),
    '이동은 네이티브 스크롤로 해야 한다');
});

test('★S2 계약: 팬은 «절대 델타»로 매 프레임 재계산한다 (증분 += 금지)', () => {
  const i = SRC.indexOf("window.addEventListener('mousemove'");
  const body = stripComments(SRC.slice(i, SRC.indexOf("window.addEventListener('mouseup'", i)));
  assert.ok(/e\.clientX\s*-\s*panStart\.x/.test(body), '절대 델타여야 누적 오차가 안 생긴다');
  assert.ok(!/scrollLeft\s*\+=/.test(body) && !/scrollTop\s*\+=/.test(body),
    '증분이면 끝에 닿았다 되돌아올 때 손이 미끄러진 것처럼 느껴진다');
});

test('★S2 계약: 여지 축소는 «현재 위치가 요구하는 만큼»까지만 (clamp 튐 방지)', () => {
  const body = stripComments(extractFn(SRC, 'shrinkPanRoom'));
  assert.ok(/Math\.min\([^)]*scrollLeft/.test(body) || /scrollLeft\)/.test(body),
    '앞쪽 여백은 scrollLeft 이하로 못 줄인다 — 안 그러면 놓는 순간 캔버스가 튄다');
  assert.ok(/scrollLeft\s*=\s*sl\s*-\s*cutX/.test(body), '줄인 만큼 스크롤도 같이 줄여야 그림이 안 움직인다');
});

test('★S2 계약: 여지 확장은 «같은 프레임에» 스크롤을 보정한다', () => {
  for (const fn of ['ensurePanRoom', 'growPanRoom']) {
    const body = stripComments(extractFn(SRC, fn));
    assert.ok(/scrollLeft\s*=/.test(body) && /scrollTop\s*=/.test(body),
      `${fn}: 앞쪽 여백이 늘면 콘텐츠가 밀린다 — 같은 프레임에 스크롤 보정이 없으면 그림이 튄다`);
  }
});

test('★S2 계약: 가로 여지가 성립하려면 flex-shrink:0 이 있어야 한다', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../css/editor-canvas.css'), 'utf8');
  const scaler = css.slice(css.indexOf('#canvas-scaler {'));
  assert.ok(/flex-shrink:\s*0/.test(scaler.slice(0, 300)),
    'flex 자식은 기본 flex-shrink:1 이라 폭을 키워도 도로 줄어든다(실측 2768 요청 → 874)');
  // ★규칙 «블록»을 잘라서 본다 — 고정 길이 창은 주석이 길어지면 빗나간다(이 테스트가 그렇게 한 번 헛돌았다).
  const wrapRule = css.slice(css.indexOf('#canvas-wrap {'), css.indexOf('}', css.indexOf('#canvas-wrap {')));
  assert.ok(/justify-content:\s*flex-start/.test(wrapRule),
    'justify-content:center 면 왼쪽 넘침이 스크롤로 안 닿는다');
  assert.ok(/scrollbar:horizontal[\s\S]{0,40}height:\s*0/.test(css),
    '가로 스크롤바는 숨긴다(현빈 결정)');
});

/* ══ D. P-R2 — 팬 놓을 때 블록이 선택되는 것 막기 ═══════════════════════ */

test('★P-R2 계약: 팬 mouseup 이 «다음 click 한 번»을 삼키도록 표시한다', () => {
  const i = SRC.indexOf("window.addEventListener('mouseup'");
  assert.notEqual(i, -1);
  const body = stripComments(SRC.slice(i, i + 900));
  assert.ok(/_swallowPanClick\s*=\s*true/.test(body),
    '팬으로 끝난 제스처는 뒤따르는 click 을 삼켜야 한다(현빈: 「선택은 의도 아님」)');
  assert.ok(/setTimeout\(/.test(body),
    '타이머로 풀지 않으면 팬 뒤 «영원히» 다음 클릭을 잡아먹는다');
});

test('★P-R2 계약: click 삼키기는 «한 번»만이고 캔버스 안에서만', () => {
  const i = SRC.indexOf("window.addEventListener('click'");
  assert.notEqual(i, -1, '팬용 click 캡처 리스너를 못 찾음');
  const body = stripComments(SRC.slice(i, i + 700));
  assert.ok(/_swallowPanClick\s*=\s*false/.test(body), '한 번 쓰면 즉시 내려야 한다');
  assert.ok(/canvasWrap\.contains\(/.test(body), '캔버스 밖 클릭까지 삼키면 안 된다');
  assert.ok(/stopPropagation\(\)/.test(body) && /preventDefault\(\)/.test(body));
  assert.ok(/,\s*true\s*\)\s*;?\s*$/m.test(SRC.slice(i, i + 800)) || /}, true\)/.test(SRC.slice(i, i + 800)),
    '캡처 단계여야 앱의 다른 click 핸들러보다 «먼저» 본다');
});

/* ══ E. 이득비(gain) — 커서 1px = 캔버스 1px ═══════════════════════════ */

test('★이득비 계약: 여지를 늘린 뒤 기준점을 «되맞추지» 않는다 (그러면 잔여를 잃는다)', () => {
  const i = SRC.indexOf("window.addEventListener('mousemove'");
  const body = stripComments(SRC.slice(i, SRC.indexOf("window.addEventListener('mouseup'", i)));
  // 되맞추기(= scrollStart.left 를 «현재 스크롤 + wantDX» 로 덮어쓰기)가 있으면 이득비가 1 미만이 된다.
  assert.ok(!/scrollStart\.left\s*=\s*canvasWrap\.scrollLeft\s*\+/.test(body),
    '기준점을 되맞추면 그 프레임 잔여를 잃는다 — 실측 300px 끌면 290px(이득비 0.967)');
  assert.ok(!/scrollStart\.top\s*=\s*canvasWrap\.scrollTop\s*\+/.test(body), '세로도 같다');
  assert.ok(/scrollStart\.left\s*\+=\s*growPanRoom\('x'\)/.test(body),
    '여지 확장이 스크롤에 더한 만큼 기준점도 «같이» 옮겨야 불변식이 유지된다');
  assert.ok(/scrollStart\.top\s*\+=\s*growPanRoom\('y'\)/.test(body), '세로도 같다');
});

test('★이득비 계약: growPanRoom 은 «더한 보정량»을 돌려준다', () => {
  const body = stripComments(extractFn(SRC, 'growPanRoom'));
  assert.ok(/return\s+d\s*;/.test(body) && /const d\s*=/.test(body),
    '호출자가 기준점을 같이 옮기려면 보정량을 알아야 한다');
  assert.ok(/return 0\s*;/.test(body), '요소가 없을 때도 «수»를 돌려줘야 += 가 NaN 이 안 된다');
});

/* ══ F. P-W1 — 휠/트랙패드 «잔여» ═══════════════════════════════════════ */

test('★P-W1 계약: 휠 잔여 경로가 transform 을 «안» 쓴다', () => {
  const i = SRC.indexOf("const resX = e.deltaX");
  assert.notEqual(i, -1, '휠 잔여 계산부를 못 찾음');
  const body = stripComments(SRC.slice(i, i + 900));
  assert.ok(!/_applyScalerTransform\s*\(/.test(body),
    '잔여를 transform 으로 쓰면 ⑴그 프레임 전면 재기록 ⑵`.panning` 이 없어 0.15s 보간이 켜진 채 돈다');
  assert.ok(!/panOffsetX\s*-=|panOffsetY\s*-=/.test(body), '잔여를 panOffset 에 넣지 않는다');
  assert.ok(/absorbWheelResidual\('x'/.test(body) && /absorbWheelResidual\('y'/.test(body),
    '잔여는 «여지»로 흡수한다(S2 와 같은 수단)');
});

test('★P-W1 계약: 여지 상한이 «있다» — 원래 버그(무한 누적)가 실재했다', () => {
  const body = stripComments(extractFn(SRC, 'absorbWheelResidual'));
  assert.ok(/WHEEL_OVER_SCREENS/.test(body) && /cap/.test(body),
    '상한이 없으면 0ab2f72 가 고친 「콘텐츠 끝 지나 끝없이 스크롤」이 되살아난다');
  assert.ok(/if \(cur >= cap\) return 0/.test(body), '상한에 닿으면 더 늘리지 않는다');
});

test('★P-W1 계약: 휠은 mouseup 이 없으므로 «정착 시» 여지를 되돌린다', () => {
  const body = stripComments(extractFn(SRC, 'scheduleWheelSettle'));
  assert.ok(/clearTimeout/.test(body) && /setTimeout/.test(body), '제스처가 이어지면 미뤄야 한다');
  assert.ok(/shrinkPanRoom\s*\(/.test(body),
    '안 되돌리면 여지가 상한까지 쌓인 채 남아 «다음 제스처가 아예 안 움직인다»(실측 이동 0)');
  const wheel = stripComments(SRC.slice(SRC.indexOf("const resX = e.deltaX"), SRC.indexOf("const resX = e.deltaX") + 900));
  assert.ok(/scheduleWheelSettle\s*\(/.test(wheel), '휠 경로가 실제로 예약해야 한다');
});

test('★P-W1 계약: 여지 «축소»의 안전조건이 «둘» 다 있다 (앞쪽·뒤쪽)', () => {
  const body = stripComments(extractFn(SRC, 'shrinkPanRoom'));
  assert.ok(/maxL\s*-\s*wrap\.scrollLeft/.test(body),
    '뒤쪽 조건이 없으면 끝까지 민 상태에서 되돌릴 때 브라우저가 clamp 해 다음 제스처가 죽는다');
  assert.ok(/maxT\s*-\s*wrap\.scrollTop/.test(body), '세로도 같다');
  assert.ok(/wrap\.scrollLeft/.test(body) && /wrap\.scrollTop/.test(body), '앞쪽 조건도 있어야 한다');
});
