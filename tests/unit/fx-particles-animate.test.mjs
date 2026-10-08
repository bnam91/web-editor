/* fx-particles-animate — 섹션 배경 파티클의 «움직임»(js/fx/particles-animate.js)을 ★불러서 잰다.
 *
 * ★★이 파일이 ★재는 것 = ★★«셈»이다(어긋남·각도). ⛔«움직이나»는 ★DOM 수트 몫이다
 *   (tests/dom/fx-particles-anim.dom.spec.js — ★앱에서 ★진짜 층을 ★놓고 잰다).
 *
 * ★★⛔프레임을 ★기다리지 않는다 — ★`step(tMs)` 가 ★시각을 ★받는다.
 *   ★까닭: ★부하는 ★느리게만이 아니라 ★★«틀리게»도 만든다. ★고정 대기 위에 선 검사는 ★값을 ★잃는다
 *   (2026-10-07 팀 실측). ⇒ ★시각을 ★손으로 넣어 ★결정적으로 잰다.
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다):
 *   · ★루프가 ★정말 도나 · ★다시 그린 뒤 ★깨어나나 ⇒ ★DOM 수트
 *   · ★`prefers-reduced-motion` ⇒ ★★v1.5 ⑵ ★미착수
 *   · ★뷰포트 컬링 ⇒ ★★v1.5 ⑶ ★미착수 (★지금 루프는 ★안 보이는 섹션도 ★돈다)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/** ★창 대역 — ⛔DOM 을 ★안 만든다. ★이 파일은 ★셈만 잰다. */
function load() {
  const ctx = { console, Math, Number, Object, String, WeakMap,
                requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
                setTimeout: () => 0, clearTimeout: () => {}, document: null };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/fx/particles-animate.js'), ctx, { filename: 'particles-animate.js' });
  return ctx.ParticlesAnim;
}

test('A0 ★전제 — 움직이개가 실렸고 ★손잡이가 다 있다', () => {
  const A = load();
  assert.ok(A, '★ParticlesAnim 이 창에 없다');
  for (const k of ['offsetY', 'angleAt', 'scan', 'step', 'start', 'stop', 'kick']) {
    assert.equal(typeof A[k], 'function', `★${k} 가 함수가 아니다`);
  }
});

test('A1 ★★`speed` 가 0 이면 ★어긋남이 ★언제나 0 — ★옛 저장본이 ★안 움직인다', () => {
  const A = load();
  /* ★시각을 ★여럿으로 — ⛔한 점만 보면 ★「그 순간만 0」과 ★구분이 안 된다 */
  for (const t of [0, 0.5, 1, 7, 123.456, -3]) {
    assert.equal(A.offsetY(t, 100, 1.2, 0, 420), 0, `★t=${t} 에서 0 이 아니다`);
  }

  /* ★★⚠️2026-10-09 — ★위 줄만으로는 ★★«가드를 안 잠근다».
     ★무력화 대조에서 ★`if (!(speed > 0)) return 0;` 를 ★떼었는데 ★★아무 자도 ★안 빨개졌다.
     ★까닭: ★상자 ★안의 y0 는 ★감싸기 셈이 ★speed 0 에서 ★저절로 0 을 낸다
       (raw = y0+MARGIN · span = H+2·MARGIN ⇒ y0+MARGIN < span 이면 ★나눈 나머지가 ★제자리).
     ⇒ ★★가드가 ★갈라 주는 ★유일한 입력은 ★★«상자 밖의 y0» 다.
     ★그런 y0 가 ★어디서 오나: ★섹션 크기가 ★줄어든 뒤 ★낡은 `data-fxp` 가 ★남아 있을 때.
       ⇒ ★그때 ★speed 0 인 알맹이가 ★★«튄다». ★그게 ★이 가드가 ★막는 것이다. */
  for (const y0 of [420 + 100, 1000, -500]) {
    assert.equal(A.offsetY(5, y0, 1.2, 0, 420), 0,
      `★★상자 밖 y0=${y0} 에서 ★speed 0 인데 ★움직였다 — ★낡은 꼬리표가 알맹이를 ★튀게 한다`);
  }
  /* ★★음성대조 — ★같은 자가 ★speed 가 있으면 ★0 이 ★아니어야 한다(⛔늘 0 을 내는 자는 죽은 자다) */
  const moved = A.offsetY(1, 100, 1.2, 58, 420);
  assert.notEqual(moved, 0, '★★speed 를 줬는데도 0 이다 — 이 자는 아무것도 안 재고 있다');
});

test('A2 ★떨어진다 — ★시간이 가면 ★아래로, 그리고 ★상자를 지나면 ★위로 되돌아온다', () => {
  const A = load();
  const H = 420, y0 = 10, vj = 1, speed = 100;
  const yAt = (t) => y0 + A.offsetY(t, y0, vj, speed, H);

  /* ⒜ ★아래로 — ★이른 구간에서 ★단조 증가 */
  const a = yAt(0), b = yAt(1), c = yAt(2);
  assert.ok(b > a, `★1초 뒤가 ★안 내려갔다 (${a} → ${b})`);
  assert.ok(c > b, `★2초 뒤가 ★안 내려갔다 (${b} → ${c})`);
  assert.ok(Math.abs((b - a) - speed) < 0.001, `★1초에 ★${speed} 만큼 안 갔다 (${b - a})`);

  /* ⒝ ★감싸기 — ★한 바퀴(span) 뒤엔 ★제자리 */
  const span = H + 2 * A.MARGIN;
  assert.ok(Math.abs(yAt(span / speed) - a) < 0.001, '★한 바퀴 뒤 제자리가 아니다');

  /* ⒞ ★★언제나 ★상자 ＋ 여유 ★안에 있다 — ⛔영영 사라지지 않는다 */
  for (let t = 0; t < 40; t += 0.37) {
    const y = yAt(t);
    assert.ok(y >= -A.MARGIN - 0.001 && y <= H + A.MARGIN + 0.001, `★t=${t} 에서 ★상자 밖이다 (y=${y})`);
  }
});

test('A3 ★알맹이마다 ★다르게 떨어진다 — ★치우침(vj)이 ★먹는다', () => {
  const A = load();
  const fast = A.offsetY(1, 0, 1.4, 100, 420);
  const slow = A.offsetY(1, 0, 0.6, 100, 420);
  assert.notEqual(fast, slow, '★치우침이 달라도 ★같이 떨어진다 — 기계처럼 보인다');
  assert.ok(fast > slow, `★큰 치우침이 ★더 안 갔다 (${fast} vs ${slow})`);
});

test('A4 ★★`spin` 이 0 이면 ★처음 각 그대로 — ★`rot`(무작위 각)을 ★안 덮는다', () => {
  const A = load();
  for (const t of [0, 1, 9.5]) {
    assert.equal(A.angleAt(t, 213.2, 0, 1), 213.2, `★t=${t} 에서 처음 각이 바뀌었다`);
  }
  /* ★★음성대조 — spin 이 있으면 ★돌아야 한다 */
  assert.notEqual(A.angleAt(1, 213.2, 190, 1), 213.2, '★spin 을 줬는데 안 돈다');
});

test('A5 ★회전 방향이 ★갈린다 — ★한쪽은 늘고 ★한쪽은 준다', () => {
  const A = load();
  const cw  = A.angleAt(1, 0, 190, 1);
  const ccw = A.angleAt(1, 0, 190, -1);
  assert.equal(cw, 190, '★+1 방향이 ★+spin 이 아니다');
  assert.equal(ccw, -190, '★−1 방향이 ★−spin 이 아니다');
  assert.notEqual(cw, ccw, '★두 방향이 ★같다 — 전부 같은 쪽으로 돈다');
});

test('A6 ★★`scan` 은 ★문서가 없으면 ★빈 명부 — ⛔터지지 않는다', () => {
  const A = load();
  /* ⚠️⛔`deepEqual(…, [])` 를 쓰지 마라 — ★vm 안의 Array 는 ★이 realm 의 Array 가 ★아니라
     ★내용이 같아도 ★프로토타입에서 ★빨개진다(2026-10-09 실측: 빈 배열끼리 ★불일치가 났다).
     ⇒ ★★길이로 잰다. ★이것은 ★제품의 흠이 아니라 ★★내 자의 흠이었다. */
  assert.equal(A.scan(null).length, 0, '★문서가 없는데 안 비었다');
  assert.equal(A.step(1000, null), 0, '★문서가 없는데 ★움직인 수가 0 이 아니다');
});
