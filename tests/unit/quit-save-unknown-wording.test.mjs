/* H4-b — 「실패했다」와 「모른다」를 «화면 문구»에서 가른다.
 *
 * 왜: 종료 시 상한(3s)에 걸린 것은 «저장 실패의 증거가 아니다». 큰 프로젝트는 상한 뒤에
 *   성공으로 끝날 수 있다(실측: 현빈 userData 의 103MB proj.json 은 직렬화만 543ms,
 *   여기에 IPC + 쓰기가 더 붙는다 — 느린 볼륨·저사양에서 3s 를 넘길 수 있다).
 *   그런 사용자에게 「저장하지 못했습니다」로 «단정»하면 우리가 모르는 것을 사실로 읽어 주는 것이다.
 *   같은 원칙이 E3-b ㉮(검증 안 된 accessUntil 을 사실처럼 보여주지 않는다)에도 걸려 있다.
 * ⛔이건 «문구»만의 문제다 — 비상 사본·마커는 두 경우 다 남는다(그것도 여기서 검사한다).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const guard = require('../../main/quit/save-guard.js');

const saved = (emergencyPath = '/tmp/e/p-1.json') => ({ record: { emergencyPath, emergencyError: null } });
const out = (reason) => ({ reason, projectName: '무릎이 편한 하루', error: null });

/* ── «모른다» 쪽 — 실패로 단정하면 안 된다 ─────────────────────────────── */
for (const reason of ['unconfirmed', 'no-response', 'no-result']) {
  test(`U-H4B-1 ${reason} → 「확인하지 못했다」이지 「실패했다」가 아니다`, () => {
    const t = guard.failureText(out(reason), saved());
    assert.ok(/확인하지 못/.test(t.title), `title 이 「확인하지 못」을 안 담았다: ${t.title}`);
    assert.ok(/확인하지 못/.test(t.message), `message 가 「확인하지 못」을 안 담았다: ${t.message}`);
    /* ★핵심 단언 — 「저장하지 못했습니다」로 «단정»하지 않는다.
       ⚠️'못했' 로 넓게 잡으면 「확인하지 못했습니다」가 걸린다(금지가 설명까지 막는 자리). */
    assert.ok(!/저장하지 못했/.test(t.message), `모르는 상태를 실패로 단정했다: ${t.message}`);
    assert.ok(!/저장하지 못한 채/.test(t.title), `모르는 상태를 실패로 단정했다: ${t.title}`);
    /* 「끝났을 수도 있다」를 사용자에게 알린다 */
    assert.ok(/끝났을 수도/.test(t.detail), `detail 에 「끝났을 수도」가 없다: ${t.detail}`);
  });
}

/* ── «실패했다» 쪽 — 여기는 단정해도 된다(증거가 있다) ──────────────────── */
for (const reason of ['save-failed', 'exception', 'rejected', 'quota', 'corrupt_snapshot', 'send-failed']) {
  test(`U-H4B-2 ${reason} → 실패로 «단정»한다(증거가 있으니 흐리면 안 된다)`, () => {
    const t = guard.failureText(out(reason), saved());
    assert.ok(/저장하지 못/.test(t.message), `실패를 흐렸다: ${t.message}`);
    assert.ok(!/끝났을 수도/.test(t.detail), `실패인데 「끝났을 수도」로 흐렸다: ${t.detail}`);
  });
}

/* ── ⛔문구가 갈려도 «안전 장치»는 두 경우 다 그대로다 ─────────────────── */
test('U-H4B-3 모르는 쪽에서도 비상 사본 안내가 그대로 나온다 — 문구만 바꿨지 동작은 안 바꿨다', () => {
  const t = guard.failureText(out('no-response'), saved('/tmp/e/p-9.json'));
  assert.ok(t.detail.includes('/tmp/e/p-9.json'), '비상 사본 경로가 안내에서 빠졌다');
  assert.ok(/비상 사본/.test(t.detail));
});

test('U-H4B-4 비상 사본도 못 만들었으면 «모르는» 쪽에서도 그 경고가 그대로 뜬다', () => {
  const t = guard.failureText(out('no-response'), { record: { emergencyPath: null, emergencyError: 'EACCES' } });
  assert.ok(/비상 사본도 만들지 못했/.test(t.detail), `경고가 사라졌다: ${t.detail}`);
});

/* ── 모르는 이유 목록이 «WHY 표와 어긋나면» 잡는다 ─────────────────────── */
test('U-H4B-5 모르는 이유 3종이 전부 WHY 표에 설명을 갖고 있다', () => {
  for (const reason of ['unconfirmed', 'no-response', 'no-result']) {
    const t = guard.failureText(out(reason), saved());
    assert.ok(!/저장에 실패했습니다\. \(/.test(t.detail),
      `${reason} 이 WHY 표에 없어 폴백 문구로 떨어졌다 — 그 폴백은 「실패」로 단정한다`);
  }
});
