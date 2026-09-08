/* harness-sanity.test.js — «이 실행이 유효한가»를 먼저 묻는다. (2026-09-09 신설)
 *
 * ⚠️왜: worktree 는 .git 만 공유하고 untracked(node_modules)는 «안» 따라온다.
 *   그 상태로 돌리면 실행이 «멈추지» 않고 **「1885 tests / 5 fail」처럼 그럴듯한 작은 실패**로 나온다.
 *   ⇒ 사람이 그걸 「dev 가 빨갛다」로 읽는다. 실제로는 **「못 잰 5」**다.
 *   ★오늘 하루 이 함정에 세 번 걸렸다(지디 2회 · 툴매니저 1회). 매번 「수치가 이상하다」를 눈치채서 살았다 —
 *     눈치가 안전장치가 되면 안 된다.
 *
 * ★이 검사가 지키는 것은 «제품»이 아니라 «측정의 유효성»이다.
 *   빨개지면 그 실행의 «어떤 수치도» 쓰면 안 된다 — 통과/실패 수, 커버리지, 회귀 비교 전부.
 *
 * ⛔「fail 0」과 「tests N」을 같이 보라는 규율의 기계판이다. 그 규율은 사람이 지켰고, 세 번 다 아슬아슬했다.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

test('H-1 ★★node_modules 가 있다 — 없으면 이 실행의 «모든 수치»가 무효다', () => {
  const nm = path.join(ROOT, 'node_modules');
  assert.ok(fs.existsSync(nm),
    '★node_modules 가 없다 — 검사가 «못 도는» 것이지 «빨간» 것이 아니다.\n' +
    '  이 실행의 tests/pass/fail 수를 «쓰지 마라». worktree 라면 본 체크아웃의 것을 심볼릭 링크해라:\n' +
    '    ln -sfn /Users/a1/web-editor-merge/node_modules <worktree>/node_modules');
});

test('H-2 ★검사가 «실제로 의존하는» 것이 풀린다 (폴더만 있고 속이 빈 경우를 가른다)', () => {
  /* ⛔`existsSync` 만 보면 «빈 폴더»를 통과시킨다. 진짜로 해석되는지 본다. */
  const need = ['@playwright/test'];   // dom 스위트가 이걸로 돈다
  const missing = [];
  for (const m of need) {
    try { require.resolve(m, { paths: [ROOT] }); } catch (_) { missing.push(m); }
  }
  assert.deepEqual(missing, [],
    `★의존 모듈이 안 풀린다: ${missing.join(', ')} — 이 실행의 수치는 무효다`);
});

test('H-3 ★양성대조 — 이 판정법이 «없는 것»을 실제로 잡아낸다', () => {
  /* 이 셋이 없으면 H-1·H-2 는 「늘 초록인 문장」이다. 있지도 않은 모듈로 잣대를 시험한다. */
  let caught = false;
  try { require.resolve('__이_모듈은_없다_ZZZ__', { paths: [ROOT] }); } catch (_) { caught = true; }
  assert.ok(caught, '★없는 모듈이 «풀렸다» — 이 판정법은 아무것도 안 지킨다');
  assert.ok(!fs.existsSync(path.join(ROOT, '__없는폴더_ZZZ__')),
    '★없는 폴더가 «있다»고 나온다 — existsSync 판정이 죽었다');
});
