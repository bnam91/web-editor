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

/** 아주 작은 DOM 대역 — classList 와 querySelectorAll('.insp-jump-flash') 만 있으면 된다. */
function makeEnv() {
  const all = [];
  const mk = (cls = '') => {
    const set = new Set(cls ? cls.split(' ') : []);
    const el = {
      classList: {
        add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c),
      },
      _set: set,
      getBoundingClientRect: () => ({ top: 0, height: 10 }),
      closest: () => null,
    };
    all.push(el);
    return el;
  };
  const document = {
    querySelectorAll: sel => {
      assert.equal(sel, '.insp-jump-flash', `예상 못 한 셀렉터: ${sel}`);
      return all.filter(e => e._set.has('insp-jump-flash'));
    },
  };
  return { mk, document, all, flashed: () => all.filter(e => e._set.has('insp-jump-flash')) };
}

/** jumpToElement 의 «강조 부분»만 소스에서 잘라 같은 realm 에서 평가한다.
 *  ⛔처음엔 시작점을 `lastIndexOf('/*', i)`(앞의 주석)로 잡았다. 신구현엔 그 자리에 주석이
 *    있지만 «옛 구현엔 없어» 한참 앞의 «엉뚱한 코드»를 잘라왔다 — 자기검사가 이걸 잡았다.
 *    ⇒ 주석 같은 «있을 수도 없을 수도 있는 것»을 기준점으로 삼지 마라. 코드 자체를 앵커로. */
function buildJump(src) {
  const anchors = ['const _clearFlash', 'clearTimeout(jumpToElement._t);']
    .map(a => src.indexOf(a)).filter(i => i !== -1);
  assert.ok(anchors.length, '강조 구간을 못 찾음 — 리팩터링됐나?');
  const i = Math.min(...anchors);
  const j = src.indexOf('\n}', src.indexOf('clearTimeout(jumpToElement._t);'));
  assert.ok(j > i, '구간의 끝을 못 찾음');
  return new Function('document', 'setTimeout', 'clearTimeout', 'jumpToElement', 'el',
    src.slice(i, j).replace(/\/\*[\s\S]*?\*\//g, ''));
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

function run(src, { gapMs }) {
  const env = makeEnv();
  const T = fakeTimers();
  const jump = buildJump(src);
  const holder = {};
  const a = env.mk(), b = env.mk(), c = env.mk();
  for (const el of [a, b, c]) {
    jump(env.document, T.setT, T.clearT, holder, el);
    T.advance(gapMs);
  }
  T.advance(5000);                 // 충분히 기다린다
  return env.flashed().length;
}

test('★M59 — 연속으로 «빠르게» 옮겨 다녀도 강조가 «하나도» 안 남는다', () => {
  // 간격 400ms = 강조가 붙기(320ms) 직후 다음 클릭 — 현빈이 겪은 조건
  assert.equal(run(SRC, { gapMs: 400 }), 0,
    '지나온 블록에 파란 볼드 아웃라인이 남았다 — 현빈 2026-09-06 제보 그 자체다');
});

test('★M59 — 천천히 옮겨 다녀도 안 남는다(회귀 방지)', () => {
  assert.equal(run(SRC, { gapMs: 2500 }), 0, '느린 간격에서도 강조가 남는다');
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
