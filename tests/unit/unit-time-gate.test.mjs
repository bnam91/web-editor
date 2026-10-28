/* unit-time-gate.test.mjs — ★196 ⑴ tests/unit-time.gate.js 판정(순수 함수)을 합성 JUnit 으로 잰다 (S3 · 261028) · ⛔파일 쓰기 0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
const { fileTimes, judge } = createRequire(import.meta.url)('../unit-time.gate.js');
const ROOT = '/r';
const X = (...c) => `<?xml version="1.0"?><testsuites>${c.map(([f, t]) => `<testcase name="x" time="${t}" classname="test" file="${path.join(ROOT, f)}"/>`).join('')}</testsuites>`;
const R = { tol: 0.5, floor_ms: 1000, files: { 'tests/unit/slow.test.mjs': 2000 } };

test('U1 파일별 합 — 같은 파일 testcase 의 time(초)을 ms 로 더한다', () => {
  const { n, out } = fileTimes(X(['tests/unit/a.test.mjs', '0.2'], ['tests/unit/a.test.mjs', '0.3'], ['tests/unit/b.test.mjs', '1']), ROOT);
  assert.equal(n, 3);
  assert.deepEqual([...out].map(([f, ms]) => [f, Math.round(ms)]), [['tests/unit/a.test.mjs', 500], ['tests/unit/b.test.mjs', 1000]]);
});
test('U2 ★양성 — 명부 파일이 ms×(1+tol) 를 넘으면 느려짐 · 명부 밖이 floor 를 넘으면 새 느림 · 지난 넘음 없으면 «이번만»(빨강 아님)', () => {
  const v = judge(X(['tests/unit/slow.test.mjs', '3.1'], ['tests/unit/new.test.mjs', '1.5']), R, ROOT);
  assert.deepEqual([v.ok, v.slower.length, v.newSlow.length, v.red.length, v.once.length], [true, 1, 1, 0, 2]);
});
test('U5 ★196 ⑶ 한 쌍 — 한 번만 넘김 = 초록(once) / 연속 두 회차 = 빨강(red) · 지난 넘음에 있어도 이번에 안 넘으면 초록', () => {
  const x = X(['tests/unit/slow.test.mjs', '3.1']);
  assert.deepEqual(judge(x, { ...R, last_over: [] }, ROOT).red, [], '한 번 넘김이 빨강이다');
  assert.deepEqual(judge(x, { ...R, last_over: ['tests/unit/slow.test.mjs'] }, ROOT).red, ['tests/unit/slow.test.mjs'], '두 회차 연속이 빨강이 아니다');
  assert.deepEqual(judge(X(['tests/unit/slow.test.mjs', '2.1']), { ...R, last_over: ['tests/unit/slow.test.mjs'] }, ROOT).red, [], '이번엔 안 넘었는데 빨강');
});
test('U3 음성 — 허용 안이면 0 · 빨라지면 «줄여라» 알림만(느려짐 아님)', () => {
  const v = judge(X(['tests/unit/slow.test.mjs', '2.9'], ['tests/unit/new.test.mjs', '0.9']), R, ROOT);
  assert.deepEqual([v.slower.length, v.newSlow.length, v.faster.length], [0, 0, 0]);
  const f = judge(X(['tests/unit/slow.test.mjs', '0.5']), R, ROOT);
  assert.deepEqual([f.slower.length, f.faster.length], [0, 1]);
});
test('U4 ★못 잰다를 통과로 접지 않는다 — 명부 꼴 깨짐 · testcase 0', () => {
  assert.equal(judge(X(['tests/unit/a.test.mjs', '1']), { files: {} }, ROOT).ok, false, 'tol·floor 없는 명부를 받았다');
  assert.equal(judge('<testsuites></testsuites>', R, ROOT).ok, false, 'testcase 0 을 ok 로 받았다');
});
