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

test('쉼 위치: 세로는 «콘텐츠 중앙», 범위를 넘지 않게 clamp', () => {
  const e = makeEnv({ ...BASE });
  // ideal = (10000*1 - 800)/2 = 4600, max = 10000-800 = 9200 → 4600
  assert.equal(e.getRestingScroll().top, 4600);
  const small = makeEnv({ ...BASE, scalerH: 500, scrollH: 500 });
  // ideal = (500-800)/2 = -150 → 0 으로 clamp (음수 스크롤은 없다)
  assert.equal(small.getRestingScroll().top, 0);
});

test('쉼 위치: 배율을 반영한다 (transform:scale 은 레이아웃을 안 바꾸므로 직접 곱해야 한다)', () => {
  const e = makeEnv({ ...BASE, zoom: 40 });
  // contentH = 10000*0.4 = 4000 → ideal = (4000-800)/2 = 1600
  assert.equal(e.getRestingScroll().top, 1600);
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
