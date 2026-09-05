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
function makeEnv({ scalerH, clientH, clientW, scrollH, scrollW, zoom, panX, panY, scrollTop, scrollLeft, canvasTailY = 0 }) {
  const wrap = { clientHeight: clientH, clientWidth: clientW, scrollHeight: scrollH, scrollWidth: scrollW, scrollTop, scrollLeft };
  const scaler = { offsetHeight: scalerH };
  const document = { getElementById: id => (id === 'canvas-wrap' ? wrap : id === 'canvas-scaler' ? scaler : null) };
  // [FIX-⑴] 꼬리 여백은 «아래쪽에만» 붙어 스크롤 범위를 비대칭으로 만든다 → 쉼 위치가 그 값을 본다.
  const factory = new Function('document', 'currentZoom', 'panOffsetX', 'panOffsetY', '_canvasTailY', `
    ${extractFn(SRC, 'getRestingScroll')}
    ${extractFn(SRC, 'getPanPosition')}
    return { getRestingScroll, getPanPosition };
  `);
  return { wrap, ...factory(document, zoom, panX, panY, canvasTailY) };
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

/* ══ G. N-1 노치 · R3/R5 회귀 핀 ═══════════════════════════════════════ */

test('★N-1 계약: 노치는 «가로 전용»이고 panOffset 이 아니라 실효 변위를 본다', () => {
  const body = stripComments(extractFn(SRC, 'updateNotchPosition'));
  assert.ok(!/panOffsetY/.test(body),
    '세로까지 보면 휠로 문서만 내려도 노치바가 상시로 뜬다(세로는 스크롤바가 알린다)');
  assert.ok(!/panOffsetX/.test(body),
    'panOffset 만 보면 팬이 스크롤로 간 뒤엔 «항상 가운데»라고 거짓말한다');
  assert.ok(/_notchOffX\s*\(\)/.test(body), '실효 변위(getPanPosition().x)를 써야 한다');
  const off = stripComments(SRC.slice(SRC.indexOf('const _notchOffX'), SRC.indexOf('const _notchOffX') + 120));
  assert.ok(/getPanPosition\(\)\.x/.test(off));
});

test('★R3 핀: zoomStep 의 앵커 식이 wrap.scrollLeft 를 «계속» 쓴다', () => {
  // S2 로 가로 스크롤 범위가 «생겼다». 이 식이 scrollLeft 를 안 보면 줌 앵커가 어긋난다.
  const body = stripComments(extractFn(SRC, 'zoomStep'));
  assert.ok(/wrap\.scrollLeft/.test(body),
    '가로 범위가 생긴 뒤엔 scrollLeft 가 앵커 계산의 일부다 — 빼면 커서 아래 지점이 안 고정된다');
});

test('★R5 핀: scrollTop 을 «자기 목적»으로 쓰는 곳은 «상대» 이동이어야 한다', () => {
  // 팬이 scrollTop 을 쓰게 됐으므로, 절대 위치를 가정하는 코드가 있으면 팬 상태와 충돌한다.
  // 아래 넷은 전부 «현재값 기준 상대» 이동이라 안전하다 — 그 성질을 못 박는다.
  const files = {
    'js/section-search.js': [/wrap\.scrollTop\s*\+=/, /wrap\.scrollLeft\s*\+=/],
    'js/inspector.js': [/wrap\.scrollTop\s*\+\s*delta/],
  };
  for (const [rel, pats] of Object.entries(files)) {
    const src = stripComments(fs.readFileSync(path.join(__dirname, '../../', rel), 'utf8'));
    for (const re of pats) {
      assert.ok(re.test(src), `${rel}: «상대» 이동 형태가 사라졌다 — 절대 대입으로 바뀌면 팬 위치를 덮어쓴다 (${re})`);
    }
  }
  // editor.js 의 부드러운 스크롤도 «시작값 기준»이어야 한다
  assert.ok(/const startTop = wrap\.scrollTop/.test(stripComments(SRC)),
    'editor.js 부드러운 스크롤이 시작값을 안 잡으면 팬 위치를 무시하고 튄다');
});

/* ══ H. P-A1 — 쓸데없는 속성 쓰기 제거(자동저장 방아쇠 줄이기) ═══════════ */

test('★P-A1 계약: deselectAll 이 «값이 같으면» contenteditable 을 안 쓴다', () => {
  const body = stripComments(extractFn(SRC, 'deselectAll'));
  assert.ok(!/setAttribute\('contenteditable'/.test(body),
    "직접 setAttribute 하면 값이 같아도 mutation 이 나고, autoSaveObserver 가 그걸 «편집»으로 센다");
  assert.ok(/_setAttrIfChanged\(/.test(body), '변화가 있을 때만 쓰는 헬퍼를 써야 한다');
  const h = stripComments(extractFn(SRC, '_setAttrIfChanged'));
  assert.ok(/getAttribute\(name\)\s*!==\s*value/.test(h), '기존 값과 비교해야 의미가 있다');
});

/* ══ I. P-A2 — 제스처 중 자동저장 «연기»(취소 아님) ══════════════════════ */
const SL = fs.readFileSync(path.join(__dirname, '../../js/io/save-load.js'), 'utf8');

test('★P-A2 계약: 유예는 «취소»가 아니라 «연기»다 — 보류분을 기억했다 다시 건다', () => {
  const d = stripComments(extractFn(SL, 'deferAutoSave'));
  const r = stripComments(extractFn(SL, 'resumeAutoSave'));
  assert.ok(/_autoSavePending\s*=\s*true/.test(d),
    '걸려 있던 예약을 해제하면서 «있었다는 사실»을 기억해야 한다 — 안 그러면 그 편집이 저장 안 된다');
  assert.ok(/_autoSavePending[\s\S]{0,80}scheduleAutoSave\s*\(/.test(r),
    'resume 이 보류분을 다시 걸어야 «연기»다. 안 걸면 «취소»가 되고 그건 데이터 손실이다');
  const sch = stripComments(SL.slice(SL.indexOf('function scheduleAutoSave'), SL.indexOf('function scheduleAutoSave') + 700));
  assert.ok(/_autoSaveDeferred[\s\S]{0,120}_autoSavePending\s*=\s*true/.test(sch),
    '유예 중에 들어온 요청도 «기억»해야 한다');
});

test('★P-A2 계약: 고착 방지 — 재개 경로가 «여럿»이다 (고착 = 저장이 영영 안 됨)', () => {
  const d = stripComments(extractFn(SL, 'deferAutoSave'));
  assert.ok(/_autoSaveDeferGuard\s*=\s*setTimeout/.test(d),
    '안전망 타임아웃이 없으면 mouseup 을 못 받는 경로에서 «영구 유예»가 된다');
  assert.ok(/addEventListener\('blur'[\s\S]{0,80}resumeAutoSave/.test(stripComments(SL)),
    '창 포커스를 잃는 경로에서도 재개돼야 한다');
  const ed = stripComments(SRC);
  assert.ok(/resumeAutoSave\?\.\(\)/.test(ed), '팬 종료 경로가 재개를 불러야 한다');
  const upIdx = ed.indexOf("window.addEventListener('mouseup'");
  assert.ok(/resumeAutoSave/.test(ed.slice(upIdx, upIdx + 900)), 'mouseup 에서 재개해야 한다');
  // ★keyup 리스너가 여럿이라 «스페이스를 보는» 블록을 찾아야 한다(첫 번째를 집으면 오탐).
  // ★앵커는 «그 블록에만» 있는 문장이어야 한다 — `panMode = false;` 는 선언부에도 있어
  //   첫 일치가 엉뚱한 데를 가리켰다(이 테스트가 그렇게 한 번 헛돌았다).
  const kuIdx = ed.indexOf("classList.remove('pan-mode', 'panning')");
  assert.ok(kuIdx > 0, '팬 모드 해제 블록을 못 찾음');
  assert.ok(/resumeAutoSave/.test(ed.slice(kuIdx, kuIdx + 400)),
    '스페이스를 떼는 경로에서도 재개해야 한다(마우스를 창 밖에서 떼는 경우)');
});

test('★P-A2 계약: 유예를 «스페이스»와 «mousedown» «둘 다»에서 건다', () => {
  const ed = stripComments(SRC);
  const dnIdx = ed.indexOf("canvasWrap.addEventListener('mousedown'");
  assert.ok(/deferAutoSave\?\.\(\)/.test(ed.slice(dnIdx, dnIdx + 700)),
    '팬 mousedown 이 유예를 걸어야 90MB 직렬화가 팬 도중에 안 터진다');
  // ★mousedown «만» 걸면, 스페이스와 클릭이 거의 동시일 때 mousedown 이 panMode=false 로
  //   early return 해 유예가 안 걸린다(실측: 유효 회차인데 defer 0회 → 1983ms 정지).
  const spIdx = ed.indexOf("canvasWrap.classList.add('pan-mode')");
  assert.ok(spIdx > 0, '팬 모드 진입 지점을 못 찾음');
  assert.ok(/deferAutoSave\?\.\(\)/.test(ed.slice(spIdx, spIdx + 400)),
    '스페이스(팬 시작 신호) 시점에도 걸어야 순서 경합에 안 진다');
});

/* ══ J. P-A1″ — «편집이 아닌 것»의 단일 목록 ════════════════════════════ */

test('★P-A1″ 계약: 목록이 «한 곳»에 있고 저장·감시가 «같은 상수»를 본다', () => {
  assert.ok(/export const NON_CONTENT_UI_SELECTOR/.test(SL), '목록은 하나의 상수여야 한다');
  // 목록 리터럴이 «두 번» 나오면 두 벌이 된 것이다 — 한쪽이 반드시 뒤처진다.
  // ★주석에도 클래스명이 적혀 있으니 «코드»만 세야 한다(이 단언이 그렇게 한 번 헛돌았다).
  const occurrences = (stripComments(SL).match(/\.ab-rotate-zone/g) || []).length;
  assert.equal(occurrences, 1,
    `save-load.js 안에 목록이 ${occurrences}벌 있다 — 상수 하나만 남겨야 둘이 안 갈린다`);
  assert.ok(/querySelectorAll\(NON_CONTENT_UI_SELECTOR\)/.test(SL),
    'serializeProject 가 상수를 써야 한다');
  const f = stripComments(extractFn(SL, '_isNonContentUiMutation'));
  assert.ok(/NON_CONTENT_UI_SELECTOR/.test(f), '감시 필터도 «같은» 상수를 봐야 한다');
});

test('★P-A1″ 계약: 필터는 «childList» 이고 «전부» UI 장식일 때만 무시한다', () => {
  const f = stripComments(extractFn(SL, '_isNonContentUiMutation'));
  assert.ok(/m\.type\s*!==\s*'childList'/.test(f),
    '속성·characterData 까지 무시하면 진짜 편집을 놓친다');
  assert.ok(/\.every\(/.test(f),
    '★some 이 아니라 every — 하나라도 «진짜 콘텐츠»가 섞이면 그건 편집이다');
  assert.ok(/nodes\.length/.test(f), '빈 mutation 을 «UI 장식»으로 오인하면 안 된다');
});

test('★P-A1″ 계약: 자동저장 감시가 그 필터를 실제로 «쓴다»', () => {
  const i = SL.indexOf('const autoSaveObserver');
  assert.notEqual(i, -1);
  const body = stripComments(SL.slice(i, i + 1400));
  assert.ok(/_isNonContentUiMutation\(m\)/.test(body), '감시 콜백이 필터를 호출해야 한다');
});


/* ══ E. FIX-canvas-eval3 ⑴ — marginBottom «한 칸 두 주인»을 소유자로 끊는다 ══ */

test('★FIX-⑴ 계약: #canvas-scaler 의 margin 을 쓰는 코드는 _applyPanRoom «하나»뿐', () => {
  /* 결함의 뿌리는 「한 CSS 속성을 두 기능이 공유」였다 — 팬 여지와 꼬리 여백이 같은
     marginBottom 을 각자 썼고, 나중에 쓴 쪽이 앞 쪽을 지웠다(배율 변경마다 여지 856px 증발).
     ⇒ 소유자를 «한 함수»로 못 박는다. 다른 데서 다시 쓰면 여기서 빨강이 된다. */
  const clean = stripComments(SRC);
  const RE = /(?:scaler|scalerEl)\.style\.margin/g;
  const all = clean.match(RE) || [];
  const owner = stripComments(extractFn(SRC, '_applyPanRoom')).match(RE) || [];
  assert.equal(owner.length, 4, '_applyPanRoom 이 네 margin 을 «전부» 쓴다');
  assert.equal(all.length, owner.length,
    'scaler 의 margin 을 _applyPanRoom «밖»에서 쓰는 코드가 생겼다 — 한 칸을 두 주인이 쓰면 서로 지운다');
});

test('★FIX-⑴ 계약: 꼬리 여백은 «값»(_canvasTailY)이고 소유자가 팬 여지와 «합쳐» 쓴다', () => {
  const owner = stripComments(extractFn(SRC, '_applyPanRoom'));
  assert.ok(/marginBottom\s*=\s*\(_panRoomY\s*\+\s*_canvasTailY\)/.test(owner),
    '아래 여백 = 팬 여지 + 꼬리 ⇒ marginBottom ≥ _panRoomY 가 «정의상» 참이 된다');
  for (const fn of ['resetCanvasTail']) {
    const body = stripComments(extractFn(SRC, fn));
    assert.ok(!/style\.margin/.test(body), `${fn} 이 DOM 을 직접 지우면 팬 여지를 같이 지운다`);
    assert.ok(/setCanvasTail\s*\(\s*0\s*\)/.test(body), '꼬리 «값»만 0 으로 내려야 한다');
  }
  // 꼬리를 «주는» 쪽(selectSection)도 margin 을 직접 쓰면 안 된다 — 위 소유자 테스트가 잡지만
  // 실패했을 때 원인을 바로 알 수 있게 여기서도 이름으로 못 박는다.
  const sel = stripComments(extractFn(SRC, 'selectSection'));
  assert.ok(/setCanvasTail\s*\(/.test(sel) && !/scalerEl\.style\.margin/.test(sel),
    'selectSection 의 꼬리 계산은 setCanvasTail 을 거쳐야 한다');
});

test('★FIX-⑴ 동작: 꼬리 여백이 있으면 쉼 세로가 그 절반만큼 올라간다(비대칭 보정)', () => {
  assert.equal(makeEnv({ ...BASE }).getRestingScroll().top, 4600);   // 꼬리 0 = 옛 식과 동일
  // 꼬리 856 이 «아래에만» 붙으면 범위가 856 늘지만 참 중앙은 그대로다
  const e = makeEnv({ ...BASE, scrollH: 10000 + 856, canvasTailY: 856 });
  assert.equal(e.getRestingScroll().top, 4600, '꼬리 몫을 안 빼면 428px 아래로 어긋난다(실측값)');
});

test('★FIX-⑴/탭 계약: 탭 뷰상태가 «팬 여지»를 같이 저장·복원한다', () => {
  const TS = fs.readFileSync(path.join(__dirname, '../../js/tab-system.js'), 'utf8');
  const clean = stripComments(TS);
  assert.ok(/panRoom:\s*window\.getPanRoom/.test(clean),
    'scrollTop 은 «저장 시점의 여백»을 전제한 절대 좌표다 — 여지도 같이 저장해야 한다');
  assert.ok(/window\.setPanRoom\s*\(\s*panRoom\s*\)/.test(clean), '복원도 있어야 한다');
  const setIdx = clean.indexOf('window.setPanRoom(panRoom)');
  const scrollIdx = clean.indexOf('wrap.scrollTop = scrollTop');
  assert.ok(setIdx !== -1 && scrollIdx !== -1 && setIdx < scrollIdx,
    '좌표를 세우기 «전»에 그 좌표가 전제한 여지부터 세워야 한다');
  assert.ok(/window\.setPanRoom\s*=/.test(SRC), 'editor.js 가 setPanRoom 을 노출해야 한다');
});
