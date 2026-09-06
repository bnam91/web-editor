/* ═══════════════════════════════════════════════════════════════════════════
   deadline.mjs — ⛔이 하네스의 «모든» 대기는 여기를 통과한다.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 파일 하나를 통째로 이것에 쓰나 (PLAN §5 H7 ⑵ⓑ · 골 §5.2)
     2026-09-06 검사 하나가 «무한 대기»해서 1시간 반을 날렸다. 원인은 하네스가
     잘라 넣은 코드의 의존 함수를 안 실어서 HTTP 응답이 영영 안 끝난 것이었다
     (tests/unit/google-login-loopback.test.mjs 의 자수 주석 참조).
     ⛔빨간 실패가 아니라 «매달림»이라 로그로는 「도는 중」과 구분이 안 된다 —
       빨간 실패보다 «나쁘다». 그래서 상한 없는 await 를 이 하네스는 금지한다.

   ★종료코드 규약 — 「못 쟀다」와 「없다」를 절대 섞지 않는다
     0 PASS           판정했고 통과
     1 FAIL           판정했고 불통과 (실제 결함)
     3 HARNESS_ERROR  «판정 자체가 성립 안 함» (상한 초과 · sanity 미달 · 대상 미타격)
   ⛔3 을 1 로 접지 마라. 접는 순간 「도구가 고장난 것」이 「제품이 멀쩡한 것」으로 읽힌다.
═══════════════════════════════════════════════════════════════════════════ */

export const EXIT = { PASS: 0, FAIL: 1, HARNESS_ERROR: 3 };

/** 판정이 «성립하지 않는» 상황. 절대 FAIL 로 접지 않는다. */
export class HarnessError extends Error {
  constructor(msg, detail) {
    super(msg);
    this.name = 'HarnessError';
    this.harness = true;
    this.detail = detail || {};
  }
}

/** 판정이 성립했고 «불통과». */
export class JudgeFail extends Error {
  constructor(msg, detail) {
    super(msg);
    this.name = 'JudgeFail';
    this.judgeFail = true;
    this.detail = detail || {};
  }
}

const nowMs = () => Number(process.hrtime.bigint() / 1000000n);

/** 상한이 «반드시» 있는 sleep. ⛔이 하네스에서 setTimeout 직접 사용 금지. */
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * 프라미스에 상한을 씌운다. 초과하면 HarnessError(=exit 3).
 * ⚠️타임아웃돼도 «원래 프라미스는 계속 돈다» — 밖에서 자원을 정리해야 한다.
 */
export function withDeadline(promise, ms, label) {
  if (!Number.isFinite(ms) || ms <= 0) throw new HarnessError(`withDeadline: 상한이 없다 (${label})`);
  let t;
  const started = nowMs();
  const timer = new Promise((_, rej) => {
    t = setTimeout(() => rej(new HarnessError(
      `상한 초과: ${label} (${ms}ms)`, { label, timeoutMs: ms, elapsedMs: nowMs() - started })), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

/**
 * 조건이 참이 될 때까지 «상한 안에서» 폴링한다.
 * ★fn 은 truthy 를 돌려주면 그 값이 결과가 된다(값을 같이 받으려고 boolean 이 아니다).
 * ★fn 이 던지면 «폴링 계속»(대상이 아직 안 떴을 수 있다). 마지막 예외는 detail 에 남긴다.
 */
export async function waitFor(fn, { timeout, interval = 100, label = 'waitFor' } = {}) {
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new HarnessError(`waitFor: 상한이 없다 (${label}) — ⛔상한 없는 대기 금지`);
  }
  const deadline = nowMs() + timeout;
  let lastErr = null, polls = 0;
  for (;;) {
    polls++;
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) { lastErr = e; }
    if (nowMs() >= deadline) {
      throw new HarnessError(`상한 초과: ${label} (${timeout}ms, ${polls}회 폴링)`,
        { label, timeoutMs: timeout, polls, lastError: lastErr && lastErr.message });
    }
    await sleep(Math.min(interval, Math.max(1, deadline - nowMs())));
  }
}

/**
 * ★«상한 안에 안 일어나는 것»을 재는 반대쪽 도구.
 *   행(hang) 판정처럼 「기한 안에 응답이 «없어야» 정상」인 자리에 쓴다.
 *   → { happened:boolean, ms } 를 돌려줄 뿐 던지지 않는다(둘 다 정당한 결과라서).
 */
export async function didHappenWithin(fn, { timeout, interval = 100 } = {}) {
  if (!Number.isFinite(timeout) || timeout <= 0) throw new HarnessError('didHappenWithin: 상한이 없다');
  const t0 = nowMs(), deadline = t0 + timeout;
  for (;;) {
    try { if (await fn()) return { happened: true, ms: nowMs() - t0 }; } catch (_) {}
    if (nowMs() >= deadline) return { happened: false, ms: nowMs() - t0 };
    await sleep(Math.min(interval, Math.max(1, deadline - nowMs())));
  }
}

/** 프로세스 전체 상한 — 무슨 일이 있어도 이 시간엔 죽는다(cron/무인 실행 안전핀). */
export function armGlobalDeadline(ms, label = 'harness') {
  const t = setTimeout(() => {
    process.stderr.write(`[HARNESS_ERROR] 전역 상한 초과: ${label} (${ms}ms) — 강제 종료\n`);
    process.exit(EXIT.HARNESS_ERROR);
  }, ms);
  t.unref();
  return () => clearTimeout(t);
}
