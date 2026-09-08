/* 단위 하네스 — [M63] 「캔버스를 밑으로 더 내릴 수 있게」의 두 축.
 * 실행: node --test tests/unit/pan-room-floor.test.js  ·  라이브 userData 무접촉(소스를 «읽기»만).
 *
 * 현빈 원문: 「캔버스의 높이가 더 늘어날수 있다면 더 늘려줘. 밑으로 내리는데 생각보다 한계가 있네」
 * 조사 결론: `#canvas` 에는 height/max-height 가 «없다» — 막고 있던 건 「높이 상한」이 아니라
 *   ⒜ 비포커스 창에서 rAF 가 멈춰 scaler 레이아웃 높이가 0px 에 굳는 결함
 *   ⒝ 세로 «기본 팬 여지»가 한 화면뿐이라 마지막 섹션 아래로 한 화면만 내려가던 것
 *
 * ★이 파일의 전제 — 「검사가 있는데 그 자리를 안 밟는다」를 막는다.
 *   T0(입력 생존)이 «먼저» 서 있다: 잰 자연높이가 0 이거나 섹션이 0 개면 T0 이 먼저 빨개진다.
 *   ⇒ 「0 이 조용히 통과」하는 길을 구조적으로 막는다.
 *
 * ★두 종류를 따로 쓴다(pan-native-scroll.test.js 와 같은 관용구):
 *   A. 동작 — 실제 소스에서 «함수 본문을 뽑아» 가짜 DOM 으로 돌린다(손으로 쓴 모델 아님).
 *   B. 소스 계약 — 「세 자리가 같은 상수를 쓴다」처럼 값만으로는 못 잡는 것.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '../../js/editor.js'), 'utf8');

/* ── 소스에서 «뽑기» ────────────────────────────────────────────────────── */
/* ⛔주석 거르개는 «공용 부품»을 쓴다 — 자기 벌 금지(strip-comments-shared.test.js S-6).
   손으로 쓴 `/\*[\s\S]*?\*\/` 는 `accept="image/*"` 의 `/*` 를 주석 시작으로 읽고
   진짜 코드를 삼켜 「0건 발견 = 통과」를 만든다. */
const { stripComments } = require('./_strip-comments.js');
/** 여는 중괄호부터 균형이 맞는 닫는 중괄호까지 — i 이후 첫 `{` 를 시작으로 본다. */
function balancedFrom(src, i, open = '{', close = '}') {
  let d = 0, started = false;
  for (let k = src.indexOf(open, i); k < src.length; k++) {
    if (src[k] === open) { d++; started = true; }
    else if (src[k] === close) { d--; if (started && d === 0) return src.slice(i, k + 1); }
  }
  assert.fail(`${src.slice(i, i + 60)} … 의 끝 ${close} 를 못 찾음`);
}
function extractFn(name) {
  const i = SRC.indexOf(`function ${name}(`);
  assert.notEqual(i, -1, `${name} 를 소스에서 못 찾음 — 이름이 바뀌었나?`);
  return balancedFrom(SRC, i);
}
/** `window.setPanRoom = (r) => { … };` 같은 화살표 대입에서 «화살표 함수»만 뽑는다. */
function extractArrow(lhs) {
  const i = SRC.indexOf(`${lhs} =`);
  assert.notEqual(i, -1, `${lhs} 를 소스에서 못 찾음`);
  const p = SRC.indexOf('(', i + lhs.length);
  const args = balancedFrom(SRC, p, '(', ')');
  const arrowAt = SRC.indexOf('=>', p + args.length);
  assert.notEqual(arrowAt, -1, `${lhs} 가 화살표 함수가 아니다`);
  return args + ' => ' + balancedFrom(SRC, SRC.indexOf('{', arrowAt));
}
/** `const NAME = <literal>;` 한 줄을 그대로 뽑는다(값을 테스트가 «다시 적지» 않기 위해). */
function extractConstLine(name) {
  const m = new RegExp(`^const ${name} = [^;]+;`, 'm').exec(SRC);
  assert.ok(m, `const ${name} 선언을 못 찾음`);
  return m[0];
}

/* ── 가짜 DOM 환경 — 팬 여지 함수들을 «소스 그대로» 돌린다 ───────────────
 *  ⛔모델 한계(의도적): scaler 의 margin 을 바꿔도 wrap.scrollHeight 는 안 따라 움직인다.
 *    이 파일이 재는 건 «바닥 산술»이지 브라우저 레이아웃이 아니다. 레이아웃은 앱 실측이 맡는다. */
function makeRoomEnv({
  clientW = 1000, clientH = 800,
  scrollW = 3000, scrollH = 20000,
  scrollLeft = 1000, scrollTop = 8000,
  roomX = 0, roomY = 0,
  sections = [1200, 900, 1500],      // ← T0 이 보는 «입력». 비우면 자연높이가 0 이 된다.
  /* ★[검수 H7] scaler 의 «absolute 자식»(scratch-item 등). 예전엔 언제나 [] 여서
     _syncScalerHeight 의 커버 루프를 «한 번도 안 밟았다» — 루프를 통째로 지워도 초록이었다. */
  absChildren = [],
  /* ★[검수 H6] 꼬리 여백. 예전엔 언제나 0 이어서 marginBottom 의 `+ _canvasTailY` 항을
     지워도 초록이었다(0 을 더하나 마나 같으니까). */
  tailY = 0,
  zoom = 40,
} = {}) {
  const wrap = { clientWidth: clientW, clientHeight: clientH, scrollWidth: scrollW, scrollHeight: scrollH, scrollLeft, scrollTop };
  const naturalH = sections.reduce((a, b) => a + b, 0);
  const children = absChildren.map(c => ({
    style: { position: c.position ?? 'absolute' },
    offsetTop: c.top, offsetHeight: c.h,
  }));
  const scaler = {
    style: {},
    children,
    get offsetHeight() {
      const h = this.style.height;
      return (h && h !== '') ? parseFloat(h) : naturalH;   // height 를 비우면 «자연높이»
    },
  };
  const document = { getElementById: id => (id === 'canvas-wrap' ? wrap : id === 'canvas-scaler' ? scaler : null) };

  const factory = new Function(
    'document', 'scaler', 'currentZoom', 'initRoomX', 'initRoomY', 'initTailY', 'getRestingScroll', 'scheduleNotchUpdate',
    `
    let _panRoomX = initRoomX, _panRoomY = initRoomY, _canvasTailY = 0, _panScrollBaseline = null;
    ${extractConstLine('PAN_ROOM_SCREENS_Y')}
    ${extractConstLine('WHEEL_OVER_SCREENS')}
    ${extractFn('_applyPanRoom')}
    ${extractFn('setCanvasTail')}
    ${extractFn('ensurePanRoom')}
    ${extractFn('growPanRoom')}
    ${extractFn('shrinkPanRoom')}
    ${extractFn('absorbWheelResidual')}
    ${extractFn('_syncScalerHeight')}
    const setPanRoom = ${extractArrow('window.setPanRoom')};
    if (initTailY) setCanvasTail(initTailY);            // ← 꼬리도 «소스 함수»로 세운다
    return {
      ensurePanRoom, growPanRoom, shrinkPanRoom, setPanRoom, absorbWheelResidual,
      setCanvasTail, _syncScalerHeight,
      SCREENS: PAN_ROOM_SCREENS_Y,
      room: () => ({ x: _panRoomX, y: _panRoomY }),
      tail: () => _canvasTailY,
    };
    `
  );
  const api = factory(document, scaler, zoom, roomX, roomY, tailY, () => ({ left: 0, top: 0 }), () => {});
  return { wrap, scaler, naturalH, sections, absChildren: children, ...api };
}

/* ★T0 — 「입력이 살아 있다」. 모든 동작 단언 «앞»에 선다.
   왜: 오늘 나온 병들이 전부 «검사가 그 갈래를 한 번도 안 밟았다»였다. 자연높이 0 / 섹션 0 이면
   아래 산술은 「0 == 0」으로 조용히 초록이 된다. 그 길을 여기서 끊는다. */
function assertInputAlive(e) {
  assert.ok(e.sections.length >= 1, 'T0: 섹션이 0 개다 — 아래 단언은 «빈 캔버스»를 재는 셈이라 무의미하다');
  assert.ok(e.naturalH > 0, 'T0: 잰 캔버스 자연높이가 0 이다 — 이 상태로 통과한 검사는 통과가 아니다');
  assert.ok(e.wrap.clientHeight > 0, 'T0: 뷰포트 높이가 0 이다 — 여지 산술이 전부 0 이 된다');
}

/* ══ T0. 입력 생존 ══════════════════════════════════════════════════════ */

test('T0 입력 생존 — 잰 자연높이 > 0 · 섹션 ≥ 1 · _syncScalerHeight 가 «0 아닌» 높이를 쓴다', () => {
  const e = makeRoomEnv();
  assertInputAlive(e);
  e._syncScalerHeight();
  const written = parseFloat(e.scaler.style.height);
  assert.ok(written > 0, `_syncScalerHeight 가 ${e.scaler.style.height} 를 썼다 — 0px 이면 한 픽셀도 못 내려간다`);
  assert.equal(written, Math.round(e.naturalH * 0.4), '자연높이 × 배율이어야 스크롤 범위가 줌과 동기된다');
});

test('T0 양성대조 — 섹션을 비우면 T0 «자신이» 먼저 빨개진다 (0 이 조용히 통과하지 않는다)', () => {
  const empty = makeRoomEnv({ sections: [] });
  assert.throws(() => assertInputAlive(empty), /T0: 섹션이 0 개다/);
  // 섹션은 «있는데» 잰 높이가 0 인 경우 — 배경 창에서 실제로 걸리던 모양이다(로드 중 측정).
  const flat = makeRoomEnv({ sections: [0, 0] });
  assert.throws(() => assertInputAlive(flat), /T0: 잰 캔버스 자연높이가 0/);
  empty._syncScalerHeight();
  assert.equal(empty.scaler.style.height, '0px',
    '이게 배경 창에서 실제로 굳던 값이다 — T0 가 없으면 이 상태로도 아래 검사들이 초록이 된다');
});

/* ══ T1. ⒜ ResizeObserver 디바운스가 rAF 가 «아니다» ════════════════════
   ★grep 이 아니라 «rAF 를 멈춘 상태»에서 돌린다 — 비포커스 창이 정확히 그 상태다. */

function runResizeObserverBlock({ raf, timerMode }) {
  const i = SRC.indexOf('const ro = new ResizeObserver(');
  assert.notEqual(i, -1, 'ResizeObserver 디바운스 블록을 못 찾음');
  const start = SRC.lastIndexOf('(() => {', i);
  const end = SRC.indexOf('})();', i) + '})();'.length;
  const block = SRC.slice(start, end);

  let roCb = null, rafCalls = 0, syncCalls = 0;
  const timers = [], delays = [];
  function FakeRO(cb) { roCb = cb; }
  FakeRO.prototype.observe = function () {};
  const document = { getElementById: id => (id === 'canvas' ? { id: 'canvas' } : null) };
  const requestAnimationFrame = (fn) => { rafCalls++; if (raf === 'run') timers.push(fn); return 1; };
  /* ★[검수 H5] 지연값을 «받아서 기록»한다. 예전엔 `(fn) => …` 라 두 번째 인자를 통째로 버렸고,
     디바운스를 5000ms 로 바꿔도 조용히 초록이었다 — 「호출만 세고 인자를 안 본다」. */
  const setTimeout_ = (fn, ms) => { delays.push(ms); if (timerMode === 'run') timers.push(fn); return timers.length || 1; };
  const _syncScalerHeight = () => { syncCalls++; };

  new Function('document', 'ResizeObserver', 'requestAnimationFrame', 'setTimeout', '_syncScalerHeight', block)(
    document, FakeRO, requestAnimationFrame, setTimeout_, _syncScalerHeight
  );
  assert.ok(roCb, 'ResizeObserver 콜백이 등록되지 않았다 — 블록 추출이 빗나갔다');
  return { fire: () => roCb(), flush: () => { while (timers.length) timers.shift()(); },
           counts: () => ({ rafCalls, syncCalls, delays: delays.slice() }) };
}

test('T1 ⒜ — rAF 를 «절대 안 부르는» 상태에서도 _syncScalerHeight 가 불린다 (비포커스 창)', () => {
  // raf:'stop' = requestAnimationFrame 이 콜백을 영영 실행하지 않는다 = 가려진 창의 실제 동작.
  const h = runResizeObserverBlock({ raf: 'stop', timerMode: 'run' });
  h.fire();
  h.flush();
  const { rafCalls, syncCalls } = h.counts();
  assert.equal(syncCalls, 1,
    'rAF 가 멈춘 창에서 높이 동기가 «한 번도» 안 돌았다 ⇒ scaler.style.height 가 낡은 값에 굳는다 ' +
    '(:345 가 이미 「이 앱은 비포커스 창에서 rAF 가 멈춘다」고 적어 뒀다 — 그 관용구를 쓸 것)');
  assert.equal(rafCalls, 0, '디바운스에 rAF 가 남아 있다');
  /* ★[검수 H5] «언제» 도는지까지 못 박는다. 0 이 아니면 그 시간 동안 scrollHeight 가 낡은 채로
     남아, 로드 직후 스크롤·탭복원이 «옛 좌표계»를 본다. 「한 태스크에 한 번」(:344)이 뜻하는 값은 0 이다. */
  assert.deepEqual(h.counts().delays, [0],
    `디바운스 지연이 ${JSON.stringify(h.counts().delays)} 다 — 0 이어야 한다(5000 같은 값이 조용히 지나가던 구멍)`);
});

test('T1 ⒜ — 디바운스는 살아 있다 (한 태스크에 여러 번 울려도 동기는 한 번)', () => {
  const h = runResizeObserverBlock({ raf: 'stop', timerMode: 'run' });
  h.fire(); h.fire(); h.fire();
  h.flush();
  assert.equal(h.counts().syncCalls, 1, '디바운스가 풀리면 리사이즈 폭풍마다 강제 레이아웃이 돈다');
  h.fire(); h.flush();
  assert.equal(h.counts().syncCalls, 2, '한 번 소진한 뒤엔 «다음» 리사이즈를 다시 받아야 한다');
});

test('T1 ⒜ 소스 계약 — 디바운스 자리에 requestAnimationFrame 이 없다', () => {
  const i = SRC.indexOf('const ro = new ResizeObserver(');
  const block = stripComments(SRC.slice(SRC.lastIndexOf('(() => {', i), SRC.indexOf('})();', i)));
  assert.ok(!/requestAnimationFrame/.test(block), '비포커스 창에서 멈추는 시계다 — :345 · :3146 과 같이 setTimeout 이어야 한다');
  assert.ok(/setTimeout\(/.test(block));
});

/* ══ T1b. ★[검수 H1] 이음매 — «_syncScalerHeight 를 통해» 여지가 확보된다 ══
   왜 따로 세우나: T2·T3 은 ensurePanRoom 을 «직접» 부른다. 그래서 _syncScalerHeight 끝의
   `ensurePanRoom()` 한 줄을 지워도 전부 초록이었다 — 실제로는 로드·줌·리사이즈가 «전부»
   이 이음매를 타므로 기능이 통째로 안 도는(room={0,0}, marginBottom=undefined) 변이인데도.
   ⇒ 「이음매를 단언 하나로만 지켰다」를 끊는다: 아래는 ensurePanRoom 을 «부르지 않는다». */

test('T1b ★이음매 — _syncScalerHeight 만 불러도 여지가 확보되고 DOM 까지 써진다', () => {
  const e = makeRoomEnv({ roomX: 0, roomY: 0 });
  assertInputAlive(e);
  assert.deepEqual(e.room(), { x: 0, y: 0 }, '전제: 아직 여지가 «없다»(없는 데서 생겨야 이음매를 잰 것이다)');
  assert.equal(e.scaler.style.marginBottom, undefined, '전제: DOM 도 아직 안 써졌다');

  e._syncScalerHeight();                       // ★ensurePanRoom 을 직접 부르지 않는다

  assert.equal(e.room().y, e.wrap.clientHeight * e.SCREENS,
    '_syncScalerHeight 가 ensurePanRoom 을 안 부르면 여지가 0 인 채로 남는다 — 로드·줌·리사이즈가 전부 이 자리를 탄다');
  assert.equal(e.room().x, e.wrap.clientWidth);
  assert.equal(e.scaler.style.marginBottom, '1600px',
    'marginBottom 이 undefined 면 이음매가 끊긴 것이다(여지가 «값»으로만 있고 DOM 에 안 갔다)');
  assert.equal(e.scaler.style.marginTop, '1600px');
});

test('T1b ★이음매 — 배율이 바뀌어 높이를 다시 재도 여지는 «유지»된다 (no-op 이어야 한다)', () => {
  const e = makeRoomEnv({ roomX: 0, roomY: 0 });
  assertInputAlive(e);
  e._syncScalerHeight();
  const after1 = e.room();
  e._syncScalerHeight();
  assert.deepEqual(e.room(), after1, '두 번째 호출이 여지를 흔들면 줌 스텝마다 캔버스가 튄다');
});

/* ══ T2. ⒝ 세 자리가 «같은 바닥»을 본다 ═════════════════════════════════ */

test('T2 소스 계약 — 세 자리(ensure · shrink · setPanRoom)가 «같은 상수»를 쓴다', () => {
  for (const [name, body] of [
    ['ensurePanRoom', stripComments(extractFn('ensurePanRoom'))],
    ['shrinkPanRoom', stripComments(extractFn('shrinkPanRoom'))],
    ['window.setPanRoom', stripComments(extractArrow('window.setPanRoom'))],
  ]) {
    assert.ok(/PAN_ROOM_SCREENS_Y/.test(body),
      `${name} 이 바닥을 «자기 관행»으로 쓴다 — 셋이 갈리면 shrink 가 바닥 밑으로 깎고 다음 줌이 도로 밀어 올려 진동한다`);
  }
  assert.match(extractConstLine('PAN_ROOM_SCREENS_Y'), /=\s*2\s*;/, '기본 여지는 아래위 각 2화면');
});

/* ★[검수 H2] ensurePanRoom 의 가드는 `_panRoomX >= needX && _panRoomY >= needY` 다.
   예전 격자는 «언제나 roomX:0, roomY:0» 에서 시작해 두 항이 늘 «같이» 거짓이었다
   ⇒ `&&` 를 `||` 로 바꿔도 결과가 같아서 초록이었다. 「한 축만 충분한」 칸이 0칸이었던 것이다.
   ⇒ 네 칸으로 «둘 다/한쪽만/반대쪽만/둘 다» 를 전부 지나가게 한다. 기대값은 «리터럴»이다
     (식을 손으로 다시 적으면 식이 바뀔 때 기대값도 같이 움직여 아무것도 못 잡는다).
   격자 전제: clientW=1000 · clientH=800 ⇒ 가로 바닥 1000 · 세로 바닥 800×2=1600. */
const ENSURE_GRID = [
  { name: '둘 다 부족',   roomX: 0,    roomY: 0,    wantX: 1000, wantY: 1600 },
  { name: '★X 만 충분',  roomX: 3000, roomY: 800,  wantX: 3000, wantY: 1600 },
  { name: '★Y 만 충분',  roomX: 100,  roomY: 5000, wantX: 1000, wantY: 5000 },
  { name: '둘 다 충분',   roomX: 3000, roomY: 5000, wantX: 3000, wantY: 5000 },
];

test('T2 ⒝ ensurePanRoom 격자 — 「한 축만 충분한」 칸을 실제로 지나간다 (가드가 && 인가)', () => {
  // ★입력 생존: 「한 축만 충분한」 칸이 «있는가». 없으면 아래 루프는 && 와 || 를 구별 못 한다.
  const mixed = ENSURE_GRID.filter(g => (g.roomX >= 1000) !== (g.roomY >= 1600));
  assert.ok(mixed.length >= 2,
    `격자에 «한 축만 충분한» 칸이 ${mixed.length}칸뿐이다 — 이 칸이 없으면 && → || 변이가 조용히 통과한다`);

  for (const g of ENSURE_GRID) {
    const e = makeRoomEnv({ roomX: g.roomX, roomY: g.roomY });
    assertInputAlive(e);
    e.ensurePanRoom();
    assert.equal(e.room().x, g.wantX, `${g.name}: 가로`);
    assert.equal(e.room().y, g.wantY, `${g.name}: 세로`);
  }
});

test('T2 ⒝ ensurePanRoom — 세로 바닥이 clientHeight × PAN_ROOM_SCREENS_Y 와 «정확히 같다»', () => {
  const e = makeRoomEnv({ roomX: 0, roomY: 0 });
  assertInputAlive(e);
  e.ensurePanRoom();
  // ★assert.equal 이다(≥ 아니다) — ≥ 면 바닥을 까먹고 800 으로 돌아가도 «초록»이 된다.
  assert.equal(e.room().y, e.wrap.clientHeight * e.SCREENS, 'ensurePanRoom 의 바닥');
  assert.equal(e.room().y, 1600);
  assert.equal(e.room().x, e.wrap.clientWidth, '가로는 한 화면 그대로 (이번 변경 대상 아님)');
});

test('T2 ⒝ shrinkPanRoom — 회수 하한도 «정확히» 같은 바닥이다', () => {
  const e = makeRoomEnv({ roomX: 1000, roomY: 1600 });
  assertInputAlive(e);
  e.growPanRoom('y');                                   // 휠이 끝에 닿아 한 화면 더 늘린 상태
  assert.equal(e.room().y, 2400, '전제: 늘어나긴 해야 한다');
  e.shrinkPanRoom();                                    // 정착 — 여기서 «어디까지» 깎느냐가 쟁점
  assert.equal(e.room().y, e.wrap.clientHeight * e.SCREENS, 'shrinkPanRoom 의 하한');
  assert.equal(e.room().y, 1600);
});

test('T2 ⒝ setPanRoom — 탭 복원의 하한도 «정확히» 같은 바닥이다', () => {
  const e = makeRoomEnv({ roomX: 1000, roomY: 1600 });
  assertInputAlive(e);
  e.setPanRoom({ x: 1000, y: 500 });                    // 옛 탭이 저장한 «한 화면» 값
  assert.equal(e.room().y, e.wrap.clientHeight * e.SCREENS, 'setPanRoom 의 복원 하한');
  assert.equal(e.room().y, 1600);
});

test('T2 ⒝ 스크롤 범위 — 바닥이 2화면이면 «마지막 섹션 아래»가 한 화면 더 열린다', () => {
  const e = makeRoomEnv({ roomX: 0, roomY: 0 });
  assertInputAlive(e);
  e.ensurePanRoom();
  // marginBottom 은 소유자(_applyPanRoom)가 쓴 «식» 그대로여야 한다: _panRoomY + _canvasTailY.
  assert.equal(e.scaler.style.marginBottom, '1600px',
    '마지막 섹션 아래 여백이 곧 「밑으로 얼마나 더 내려가나」다 — 856px 창이면 856 → 1712 가 된다');
  assert.equal(e.scaler.style.marginTop, '1600px', '위아래 대칭이 깨지면 쉼 위치(가운데)가 어긋난다');
});

test('T2 ⒝ ★[검수 H6] marginBottom 의 «식» — 꼬리 여백(_canvasTailY)이 살아 있다', () => {
  const e = makeRoomEnv({ roomX: 0, roomY: 0, tailY: 600 });
  assertInputAlive(e);
  // ★입력 생존: 꼬리가 0 이면 `+ _canvasTailY` 를 지워도 티가 안 난다(0 을 더하나 마나 같다).
  assert.ok(e.tail() > 0, `꼬리가 ${e.tail()} 이다 — 0 이면 이 검사는 그 항을 «안 밟는다»`);

  e.ensurePanRoom();
  assert.equal(e.scaler.style.marginTop, '1600px', '위쪽은 꼬리를 «안» 받는다 — 대칭이 깨지면 쉼 위치가 어긋난다');
  assert.equal(e.scaler.style.marginBottom, '2200px',
    'marginBottom = _panRoomY + _canvasTailY 라는 «식»이다. 1600 이 나오면 꼬리 항이 사라진 것 ' +
    '= [FIX-⑴] 이 막아 둔 「한 칸을 두 주인이 쓴다」로 되돌아간다');
  // 소유자 단일성: 꼬리를 바꾸면 marginBottom «만» 따라 움직인다.
  e.setCanvasTail(0);
  assert.equal(e.scaler.style.marginBottom, '1600px');
  assert.equal(e.scaler.style.marginTop, '1600px');
});

test('T0 ★[검수 H7] scaler 의 absolute 자식이 캔버스보다 아래면 높이가 «그 바닥»까지 잡힌다', () => {
  const e = makeRoomEnv({ absChildren: [{ top: 5000, h: 400 }] });   // scratch-item 등
  assertInputAlive(e);
  // ★입력 생존 둘 — 예전엔 children 이 «언제나 []» 라 커버 루프를 통째로 지워도 초록이었다.
  assert.ok(e.absChildren.length >= 1, '자식이 0 개면 _syncScalerHeight 의 커버 루프를 한 번도 안 밟는다');
  const childBottom = 5000 + 400;
  assert.ok(childBottom > e.naturalH,
    `자식 바닥 ${childBottom} 이 자연높이 ${e.naturalH} 보다 «아래»여야 루프가 의미를 갖는다`);

  e._syncScalerHeight();
  assert.equal(e.scaler.style.height, '2160px',
    '5400 × 0.4 = 2160. 1440px(=3600×0.4)이면 커버 루프가 사라진 것 — 자식이 스크롤 범위 밖으로 잘린다');
});

test('T0 ★[검수 H7] absolute 가 «아닌» 자식은 세지 않는다 (루프의 판정도 밟는다)', () => {
  const e = makeRoomEnv({ absChildren: [{ top: 5000, h: 400, position: 'static' }] });
  assertInputAlive(e);
  assert.ok(e.absChildren.length >= 1);
  e._syncScalerHeight();
  assert.equal(e.scaler.style.height, '1440px',
    'static 자식까지 세면 flow 콘텐츠를 «두 번» 세는 셈이 된다');
});

/* ══ T3. 진동 없음 ══════════════════════════════════════════════════════ */

test('T3 — ensure → shrink → ensure 를 돌려도 값이 «안 흔들린다»', () => {
  const e = makeRoomEnv({ roomX: 0, roomY: 0 });
  assertInputAlive(e);
  const seen = [];
  e.ensurePanRoom(); seen.push(e.room().y);
  e.shrinkPanRoom(); seen.push(e.room().y);
  e.ensurePanRoom(); seen.push(e.room().y);
  e.shrinkPanRoom(); seen.push(e.room().y);
  /* ⚠️[검수 지적] floor 를 «소스 상수»에서 뽑으므로 상수가 3 으로 바뀌면 기대값도 같이 움직인다
     ⇒ T3 «혼자서는» 상수 변경을 못 잡는다. 그 닻은 T2 의 리터럴(1600 · `= 2` 단언)이 맡는다.
     ⛔T2 의 리터럴을 지우면 이 검사가 «조용히» 풀린다 — 둘은 한 짝이다. */
  const floor = e.wrap.clientHeight * e.SCREENS;
  assert.equal(floor, 1600, '닻: 이 값이 T2 의 리터럴과 같아야 짝이 성립한다');
  assert.deepEqual(seen, [floor, floor, floor, floor],
    `여지가 ${seen.join(' → ')} 로 흔들린다 — 세 자리 중 일부만 고친 상태다(shrink 가 바닥 밑으로 깎고 ensure 가 도로 밀어 올린다)`);
});

test('T3 — 늘렸다 정착시키는 왕복도 «제자리»로 돌아온다 (스크롤도 같이)', () => {
  const e = makeRoomEnv({ roomX: 1000, roomY: 1600 });
  assertInputAlive(e);
  const st0 = e.wrap.scrollTop;
  e.growPanRoom('y');
  e.shrinkPanRoom();
  assert.equal(e.room().y, e.wrap.clientHeight * e.SCREENS);
  assert.equal(e.wrap.scrollTop, st0, '깎은 만큼 스크롤을 같이 안 내리면 놓는 순간 캔버스가 «툭» 튄다');
});

/* ══ T4. 휠 상한은 «그대로» ═════════════════════════════════════════════ */

test('T4 — WHEEL_OVER_SCREENS 는 3 그대로다 (0ab2f72 회귀 핀)', () => {
  assert.match(extractConstLine('WHEEL_OVER_SCREENS'), /=\s*3\s*;/,
    '0ab2f72(2026-06-14)가 고친 「빈 공간으로 끝없이 스크롤」을 막는 값이다 — 이번 작업 범위 밖');
});

/* ★[검수 H3·H4] 예전 T4 는 «리터럴 둘»만 읽고 `cap = 1 + over` 를 손으로 다시 적었다.
   ⇒ absorbWheelResidual 을 «한 번도 안 돌렸고», cap 산식을 `client*OVER`(3화면)로 깎거나
     `client + client*10`(11화면 = 0ab2f72 회귀)으로 부풀려도 둘 다 조용히 통과했다.
   ⛔검사가 산식을 다시 적으면 «사용처»가 바뀌어도 통과한다. ⇒ 도달 화면 수를 «실행 결과»로 잰다. */
function runWheelToCap(e, axis = 'y') {
  const client = axis === 'x' ? e.wrap.clientWidth : e.wrap.clientHeight;
  const first = e.absorbWheelResidual(axis, 600);
  assert.ok(first > 0,
    '★입력 생존: 첫 흡수가 0 이다 — 이미 상한이면 아래 루프가 어떤 갈래도 안 밟는다');
  let guard = 0;
  while (e.absorbWheelResidual(axis, 600) > 0) {
    if (++guard > 5000) assert.fail('상한이 없다 — 여지가 끝없이 자란다(0ab2f72 가 고친 바로 그 병)');
  }
  assert.equal(e.absorbWheelResidual(axis, 600), 0, '상한에 닿으면 더 안 늘어야 한다');
  return (axis === 'x' ? e.room().x : e.room().y) / client;   // 도달 «화면 수»
}

test('T4 ⒞ 휠 상한 — absorbWheelResidual 을 «실제로 돌려» 도달 화면 수를 잰다', () => {
  const e = makeRoomEnv({ roomX: 1000, roomY: 1600 });
  assertInputAlive(e);
  const reached = runWheelToCap(e, 'y');
  // ★리터럴이다. 산식을 다시 적지 않는다 — cap 을 client*OVER 로 깎으면 3, +client*10 이면 11 이 나온다.
  assert.equal(reached, 4,
    `휠이 도달하는 화면 수가 ${reached} 다. 4 여야 한다 — 3 이면 「생각보다 한계가 있네」가 다시 돌아오고, ` +
    '그보다 크면 0ab2f72 가 고친 「빈 공간으로 끝없이 스크롤」이 되살아난다');
});

test('T4 ⒞ 휠 상한 — 기본 바닥이 상한을 «먹지 않는다» (실행으로 잰 값끼리 비교)', () => {
  const e = makeRoomEnv({ roomX: 0, roomY: 0 });
  assertInputAlive(e);
  e.ensurePanRoom();
  const floorScreens = e.room().y / e.wrap.clientHeight;
  const reached = runWheelToCap(e, 'y');
  assert.ok(floorScreens < reached,
    `기본 여지 ${floorScreens}화면이 휠 도달 ${reached}화면 이상이다 — cur >= cap 가 즉시 참이 돼 휠이 아예 안 밀린다`);
});
