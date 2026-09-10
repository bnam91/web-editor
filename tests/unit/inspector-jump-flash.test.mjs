/* U-INSPFLASH — 인스펙터 «사용된 곳으로 이동」의 강조 표시가 남지 않는다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스에서 함수를 잘라 «가짜 DOM»에서 돌린다.
 *
 * ★[M59] 현빈 2026-09-06: 「옮겨다니면서 어디에 해당 블럭들이 있는지 알수 있는데
 *   캔버스의 파란색 볼드 아웃라인이 시간지나면 사라져야되는데 계속 남아있는 버그」
 *
 * 원인: 지우기 타이머가 «하나»(jumpToElement._t2)뿐이었다.
 *   1.7초(320+1400) 안에 다음 항목을 누르면 `clearTimeout(_t2)` 가 «앞 블록의 지우기»를
 *   취소한다 → 지나온 블록마다 .insp-jump-flash 가 «영구히» 남는다.
 *   ★6개를 훑는 것이 이 기능의 «정상 사용»이라 사실상 항상 재현된다.
 *
 * ⛔이 검사는 «타이머 개수»를 세지 않는다 — 「연속 점프 뒤 강조가 몇 개 남는가」라는
 *   «관찰 가능한 결과»로 잰다. 구현을 바꿔도(타이머든 querySelector든) 계약은 그대로다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = fs.readFileSync(path.join(ROOT, 'js/inspector.js'), 'utf8');

/** 아주 작은 DOM 대역 — classList · querySelectorAll · «스크롤하는 #canvas-wrap» 이 필요하다.
 *  ★2026-09-09 확장: 지우기가 `scrollend` 뒤로 옮겨져서, wrap 이 «실제로 구르고 멈추는» 것까지
 *    흉내내야 이 검사가 그 갈래를 «밟는다». 안 그러면 검사가 새 코드를 안 지나간다. */
function makeEnv({ scrollMs = 600 } = {}) {
  const all = [];
  let top = 0;
  const mk = (cls = '') => {
    const set = new Set(cls ? cls.split(' ') : []);
    top += 500;                                   // 요소마다 «다른 위치» — 그래야 스크롤이 일어난다
    const myTop = top;
    const el = {
      id: 'blk_' + all.length,
      classList: {
        add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c),
      },
      _set: set,
      // 화면 좌표 = 문서 위치 − 현재 스크롤
      getBoundingClientRect: () => ({ top: myTop - wrap.scrollTop, height: 10 }),
      closest: () => null,
    };
    all.push(el);
    return el;
  };

  const endListeners = new Set();
  const wrap = {
    scrollTop: 0, scrollHeight: 20000, clientHeight: 800,
    getBoundingClientRect: () => ({ top: 0, height: 800 }),
    addEventListener: (t, fn) => { assert.equal(t, 'scrollend', `예상 못 한 이벤트: ${t}`); endListeners.add(fn); },
    removeEventListener: (t, fn) => { endListeners.delete(fn); },
    /* smooth 스크롤 흉내 — 즉시 도착하지 않고 scrollMs 뒤에 «멈춤»을 알린다.
       ⛔여기서 곧바로 scrollend 를 쏘면 「스크롤 중」이라는 상태가 사라져 검사가 무의미해진다. */
    scrollTo: ({ top: t }) => {
      const from = wrap.scrollTop;
      wrap._pending = _setT(() => {
        wrap.scrollTop = t;
        if (t !== from) [...endListeners].forEach(fn => fn());
      }, scrollMs);
    },
  };
  let _setT = () => 0;                            // fakeTimers 가 주입한다

  const document = {
    getElementById: id => (id === 'canvas-wrap' ? wrap : null),
    querySelectorAll: sel => {
      assert.equal(sel, '.insp-jump-flash', `예상 못 한 셀렉터: ${sel}`);
      return all.filter(e => e._set.has('insp-jump-flash'));
    },
  };
  const window = { selectSection: () => {}, selectBlock: () => true };
  return {
    mk, document, window, wrap, all,
    useTimers: setT => { _setT = setT; },
    flashed: () => all.filter(e => e._set.has('insp-jump-flash')),
  };
}

/** jumpToElement 를 «함수 통째로» 소스에서 잘라 같은 realm 에서 평가한다.
 *  ⛔처음엔 시작점을 `lastIndexOf('/*', i)`(앞의 주석)로 잡았다. 신구현엔 그 자리에 주석이
 *    있지만 «옛 구현엔 없어» 한참 앞의 «엉뚱한 코드»를 잘라왔다 — 자기검사가 이걸 잡았다.
 *    ⇒ 주석 같은 «있을 수도 없을 수도 있는 것»을 기준점으로 삼지 마라. 코드 자체를 앵커로.
 *  ★2026-09-09: 「강조 부분만」 잘라오던 것을 «함수 전체»로 넓혔다. 지우기가 scrollend 로
 *    옮겨지면서 강조 로직이 함수 앞머리의 wrap·willScroll 에 «의존»하게 됐는데, 조각만
 *    잘라오면 그 갈래를 못 밟는다(실제로 ReferenceError 로 터졌다 — 검사가 먼저 알려줬다). */
function buildJump(src) {
  const i = src.indexOf('function jumpToElement');
  assert.ok(i >= 0, 'jumpToElement 를 못 찾음 — 리팩터링됐나?');
  let d = 0, started = false, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') { d++; started = true; }
    else if (src[j] === '}') { d--; if (started && d === 0) break; }
  }
  assert.ok(j < src.length, '함수의 끝을 못 찾음');
  const body = src.slice(i, j + 1).replace(/\/\*[\s\S]*?\*\//g, '');
  /* «공장»을 돌려준다 — 호출자가 가짜 환경을 넣어 jumpToElement 를 얻는다.
     함수 자체를 돌려주므로 jumpToElement._t 같은 상태가 «실제와 같은 자리»에 쌓인다. */
  return new Function('document', 'window', 'setTimeout', 'clearTimeout',
    `${body}; return jumpToElement;`);
}

/** 가짜 타이머 — 큐를 우리가 굴린다. */
function fakeTimers() {
  let now = 0, id = 0;
  const q = new Map();
  const setT = (fn, ms) => { const k = ++id; q.set(k, { fn, at: now + (ms || 0) }); return k; };
  const clearT = k => q.delete(k);
  const advance = ms => {
    const target = now + ms;
    for (;;) {
      const due = [...q.entries()].filter(([, v]) => v.at <= target).sort((a, b) => a[1].at - b[1].at);
      if (!due.length) break;
      const [k, v] = due[0];
      q.delete(k); now = v.at; v.fn();
    }
    now = target;
  };
  return { setT, clearT, advance };
}

function run(src, { gapMs, scrollMs = 600, n = 3, settleMs = 8000 }) {
  const env = makeEnv({ scrollMs });
  const T = fakeTimers();
  env.useTimers(T.setT);
  const jump = buildJump(src)(env.document, env.window, T.setT, T.clearT);
  const els = Array.from({ length: n }, () => env.mk());
  const peak = [];
  for (const el of els) {
    jump(el);
    peak.push(env.flashed().length);
    T.advance(gapMs);
  }
  T.advance(settleMs);             // 충분히 기다린다
  return { left: env.flashed().length, peak: Math.max(...peak), env, T, jump, els };
}

test('★M59 — 연속으로 «빠르게» 옮겨 다녀도 강조가 «하나도» 안 남는다', () => {
  // 간격 400ms = 강조가 붙기(옛 판 320ms) 직후 다음 클릭 — 현빈이 겪은 조건
  const r = run(SRC, { gapMs: 400 });
  assert.equal(r.left, 0, '지나온 블록에 파란 볼드 아웃라인이 남았다 — 현빈 2026-09-06 제보 그 자체다');
  assert.equal(r.peak, 1, `훑는 도중 강조가 동시에 ${r.peak}개 켜졌다 — 한 번에 «하나»여야 한다`);
});

test('★M59 — 천천히 옮겨 다녀도 안 남는다(회귀 방지)', () => {
  assert.equal(run(SRC, { gapMs: 2500 }).left, 0, '느린 간격에서도 강조가 남는다');
});

test('★M59 — 6개를 «정상 사용»대로 훑어도(200ms) 안 남는다', () => {
  // 현빈이 실제로 하는 동작: 목록을 죽 훑는다. 이 리듬이 이 기능의 «정상 사용»이다.
  const r = run(SRC, { gapMs: 200, n: 6 });
  assert.equal(r.left, 0, '빠르게 훑은 뒤 강조가 남았다');
  assert.equal(r.peak, 1, '동시에 둘 이상 켜졌다');
});

/* ══════════ 2026-09-09 신설 — 「표시가 «보이는가»」 ══════════
   M59 는 「안 남는가」만 봤다. 그런데 현빈의 다음 제보는 정반대였다:
   「아웃라인이 «생겼다 안 생겼다» 한다」 = 애초에 «안 뜨는» 경우가 있었다.
   ⇒ 「안 남는다」와 「제때 뜬다」를 «둘 다» 못박지 않으면 한쪽을 고칠 때 다른 쪽이 깨진다. */

test('★즉시 부착 — 클릭한 «그 순간» 강조가 붙는다(스크롤을 기다리지 않는다)', () => {
  const env = makeEnv({ scrollMs: 600 });
  const T = fakeTimers();
  env.useTimers(T.setT);
  const jump = buildJump(SRC)(env.document, env.window, T.setT, T.clearT);
  const el = env.mk();
  jump(el);
  assert.equal(env.flashed().length, 1,
    '★클릭 직후 강조가 «없다» — 선지연을 두면 200~300ms 로 훑을 때 붙기 전에 지워진다(앱 실측 1/12)');
  assert.ok(el.classList.contains('insp-jump-flash'), '강조가 «그 요소»에 안 붙었다');
});

test('★스크롤이 «멈춘 뒤»부터 센다 — 구르는 동안 꺼지지 않는다', () => {
  const SCROLL = 2000;                       // 긴 점프: 정착까지 2초
  const env = makeEnv({ scrollMs: SCROLL });
  const T = fakeTimers();
  env.useTimers(T.setT);
  const jump = buildJump(SRC)(env.document, env.window, T.setT, T.clearT);
  jump(env.mk());

  T.advance(SCROLL - 50);                    // 아직 구르는 중
  assert.equal(env.flashed().length, 1,
    '★도착하기 «전»에 강조가 꺼졌다 — 긴 점프에서 「어디로 갔는지」를 못 본다');
  T.advance(50 + 1399);                      // 멈춘 직후 ~1.4초
  assert.equal(env.flashed().length, 1, '멈춘 뒤 1.4초가 되기 전에 꺼졌다');
  T.advance(1000);
  assert.equal(env.flashed().length, 0, '멈춘 뒤 한참 지났는데도 강조가 «남는다»');
});

test('★스크롤이 «아예 안 일어나는» 경우에도 반드시 꺼진다(scrollend 가 영영 안 온다)', () => {
  const env = makeEnv({ scrollMs: 600 });
  const T = fakeTimers();
  env.useTimers(T.setT);
  const jump = buildJump(SRC)(env.document, env.window, T.setT, T.clearT);
  const el = env.mk();
  // 이미 «그 자리»에 있게 만든다 ⇒ wantTop === scrollTop ⇒ 스크롤 없음
  env.wrap.scrollTop = 105;                  // el.top 500, center 395 ⇒ wantTop 105
  jump(el);
  assert.equal(env.flashed().length, 1, '강조가 안 붙었다');

  /* ★«언제» 꺼지는지까지 못박는다. 「6초 뒤에 없다」로만 재면 폴백(2.5초)에 기대는 구현도
     초록이 되어, 이미 화면 안인 대상에서 강조가 3.9초씩 붙박이로 남는 것을 못 본다. */
  T.advance(1399);
  assert.equal(env.flashed().length, 1, '멈춤을 기다릴 것도 없는데 1.4초 전에 꺼졌다');
  T.advance(2);
  assert.equal(env.flashed().length, 0,
    '★스크롤이 없는데도 «멈추기를» 기다린다 — 폴백(2.5초)까지 강조가 붙박이로 남는다');

  T.advance(6000);
  assert.equal(env.flashed().length, 0,
    '★스크롤이 없으면 scrollend 가 «영영» 안 온다 — 폴백이 없으면 강조가 영구히 남는다');
});

test('★자기검사 — 스크롤 대역이 «실제로 구른다»(이 검사가 그 갈래를 밟는가)', () => {
  /* ⛔가짜 wrap 이 scrollend 를 «안 쏘면» 위 두 검사는 폴백 타이머만 보고 초록이 된다.
     그러면 scrollend 갈래를 통째로 지워도 안 걸린다. 대역이 진짜인지 여기서 확인한다. */
  const env = makeEnv({ scrollMs: 500 });
  const T = fakeTimers();
  env.useTimers(T.setT);
  let ended = 0;
  env.wrap.addEventListener('scrollend', () => ended++);
  env.wrap.scrollTo({ top: 4000 });
  assert.equal(ended, 0, '스크롤 시작과 «동시에» 멈춤이 왔다 — 구르는 상태가 없다');
  T.advance(500);
  assert.equal(ended, 1, '가짜 wrap 이 scrollend 를 안 쏜다 — 위 검사들이 그 갈래를 못 밟는다');
  assert.equal(env.wrap.scrollTop, 4000, '스크롤 위치가 안 바뀐다');
});

test('★자기검사 — 이 검사가 «옛 구현»에서 실제로 빨강인가(검출력 증명)', () => {
  /* ⛔옛 구현을 «정규식으로 재구성»하려다 두 번 틀렸다:
       ⑴ 시작 앵커를 「앞의 주석」으로 잡아 엉뚱한 코드를 잘랐다.
       ⑵ 치환 정규식이 `clearTimeout` 두 줄까지 삼켜, «결함의 핵심»이 빠진 코드를
          「옛 구현」이라 부르고 돌렸다 — 그래서 「옛 구현인데 안 남는다」가 나왔다.
     ⇒ 재현을 «추측»하지 말고 6461a28 의 원문을 그대로 박는다. 이게 진짜 옛 코드다. */
  const OLD_BODY = `
    clearTimeout(jumpToElement._t);
    clearTimeout(jumpToElement._t2);
    jumpToElement._t = setTimeout(() => {
      el.classList.add('insp-jump-flash');
      jumpToElement._t2 = setTimeout(() => el.classList.remove('insp-jump-flash'), 1400);
    }, 320);`;
  const oldJump = new Function('document', 'setTimeout', 'clearTimeout', 'jumpToElement', 'el', OLD_BODY);

  const env = makeEnv();
  const T = fakeTimers();
  const holder = {};
  for (const el of [env.mk(), env.mk(), env.mk()]) {
    oldJump(env.document, T.setT, T.clearT, holder, el);
    T.advance(400);              // 강조가 붙은(320ms) 직후 다음 클릭 — 현빈이 겪은 조건
  }
  T.advance(5000);
  assert.ok(env.flashed().length >= 2,
    `옛 구현인데 남은 강조가 ${env.flashed().length}개다 — 검사가 «그 결함을 못 보는» 것이다`);
});
