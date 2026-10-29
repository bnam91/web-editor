/* sync-body-cap-196.test.mjs — ★196 «동기 몸» 칸(지디 261029 · S3 실측 ×3 · Node v25.8.0 인텔)
 *   러너 상한(시험 옵션 { timeout } · --test-timeout)은 동기 몸(spawnSync·바쁜 대기)에 «안 든다» — 마감 뒤 타이머로 돌아갈 때만 집행.
 *   (실측: 옵션 1000 · 몸 spawnSync sleep 3 ⇒ 초록 ×3 / 플래그 1000 · 같은 몸 ⇒ 초록 ×3 / 양성 = 옵션 1000 · await setTimeout 3000 ⇒ 빨강 ×3)
 *   ⇒ 동기 몸을 빨갛게 하는 것은 «그 호출 제 timeout ＋ 결과 단언» 뿐 — 이 파일은 그 한 쌍(T3 · T3N)을 잠근다.
 *   ⛔러너 상한이 «안 든다» 쪽(3s 몸)은 여기 안 넣었다 — 파일 합이 UNIT_SLOW floor(2000ms)를 넘는다. 그 수는 S3 보고(261029)에.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('T3 ★양성 — spawnSync 제 timeout 은 긴 동기 몸을 끊는다(ETIMEDOUT · SIGTERM)', () => {
  const r = spawnSync('sleep', ['2'], { timeout: 300 });
  assert.deepEqual([r.error?.code, r.signal], ['ETIMEDOUT', 'SIGTERM'], '제 상한이 동기 몸을 못 끊었다');
});

test('T3N 음성 — 같은 상한 안에 끝나는 몸은 안 끊는다', () => {
  const r = spawnSync('sleep', ['0.05'], { timeout: 300 });
  assert.deepEqual([r.error?.code, r.signal, r.status], [undefined, null, 0], '상한 안 몸을 끊었다(늘 빨강 자)');
});
