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
  zoom = 40,
} = {}) {
  const wrap = { clientWidth: clientW, clientHeight: clientH, scrollWidth: scrollW, scrollHeight: scrollH, scrollLeft, scrollTop };
  const naturalH = sections.reduce((a, b) => a + b, 0);
  const scaler = {
    style: {},
    children: [],
    get offsetHeight() {
      const h = this.style.height;
      return (h && h !== '') ? parseFloat(h) : naturalH;   // height 를 비우면 «자연높이»
    },
  };
  const document = { getElementById: id => (id === 'canvas-wrap' ? wrap : id === 'canvas-scaler' ? scaler : null) };

  const factory = new Function(
    'document', 'scaler', 'currentZoom', 'initRoomX', 'initRoomY', 'getRestingScroll', 'scheduleNotchUpdate',
    `
    let _panRoomX = initRoomX, _panRoomY = initRoomY, _canvasTailY = 0, _panScrollBaseline = null;
    ${extractConstLine('PAN_ROOM_SCREENS_Y')}
    ${extractFn('_applyPanRoom')}
    ${extractFn('ensurePanRoom')}
    ${extractFn('growPanRoom')}
    ${extractFn('shrinkPanRoom')}
    ${extractFn('_syncScalerHeight')}
    const setPanRoom = ${extractArrow('window.setPanRoom')};
    return {
      ensurePanRoom, growPanRoom, shrinkPanRoom, setPanRoom, _syncScalerHeight,
      SCREENS: PAN_ROOM_SCREENS_Y,
      room: () => ({ x: _panRoomX, y: _panRoomY }),
    };
    `
  );
  const api = factory(document, scaler, zoom, roomX, roomY, () => ({ left: 0, top: 0 }), () => {});
  return { wrap, scaler, naturalH, sections, ...api };
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
  const timers = [];
  function FakeRO(cb) { roCb = cb; }
  FakeRO.prototype.observe = function () {};
  const document = { getElementById: id => (id === 'canvas' ? { id: 'canvas' } : null) };
  const requestAnimationFrame = (fn) => { rafCalls++; if (raf === 'run') timers.push(fn); return 1; };
  const setTimeout_ = (fn) => { if (timerMode === 'run') timers.push(fn); return timers.length || 1; };
  const _syncScalerHeight = () => { syncCalls++; };

  new Function('document', 'ResizeObserver', 'requestAnimationFrame', 'setTimeout', '_syncScalerHeight', block)(
    document, FakeRO, requestAnimationFrame, setTimeout_, _syncScalerHeight
  );
  assert.ok(roCb, 'ResizeObserver 콜백이 등록되지 않았다 — 블록 추출이 빗나갔다');
  return { fire: () => roCb(), flush: () => { while (timers.length) timers.shift()(); },
           counts: () => ({ rafCalls, syncCalls }) };
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

/* ══ T3. 진동 없음 ══════════════════════════════════════════════════════ */

test('T3 — ensure → shrink → ensure 를 돌려도 값이 «안 흔들린다»', () => {
  const e = makeRoomEnv({ roomX: 0, roomY: 0 });
  assertInputAlive(e);
  const seen = [];
  e.ensurePanRoom(); seen.push(e.room().y);
  e.shrinkPanRoom(); seen.push(e.room().y);
  e.ensurePanRoom(); seen.push(e.room().y);
  e.shrinkPanRoom(); seen.push(e.room().y);
  const floor = e.wrap.clientHeight * e.SCREENS;
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

test('T4 — 기본 바닥이 휠 상한을 «먹지 않는다» (기본 < cap 이어야 휠이 더 갈 여지를 갖는다)', () => {
  const screens = Number(/=\s*(\d+)\s*;/.exec(extractConstLine('PAN_ROOM_SCREENS_Y'))[1]);
  const over = Number(/=\s*(\d+)\s*;/.exec(extractConstLine('WHEEL_OVER_SCREENS'))[1]);
  const cap = 1 + over;   // absorbWheelResidual: cap = client + client*WHEEL_OVER_SCREENS
  assert.ok(screens < cap,
    `기본 여지 ${screens}화면이 휠 상한 ${cap}화면 이상이다 — absorbWheelResidual 의 cur >= cap 가 즉시 참이 돼 휠이 아예 안 밀린다`);
});
