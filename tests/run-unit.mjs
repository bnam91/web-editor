/* run-unit.mjs — `npm test` 의 ★동시도 한 자리 (2026-10-22 · 지디 GO ⒝1)
 *
 * ⛔`npm test -- --test-concurrency=N` 은 먹지 않는다 — 플래그가 패턴 뒤로 가고 에러도 0줄.
 *   덮으려면 `GOYA_TEST_CONCURRENCY=N npm test`.
 *   실측 261022 · Node 25.8 · 4×400ms: c1 앞 2532ms ↔ c1 뒤 779ms(=기본).
 * ⛔package.json 에 `${…}` 를 쓰지 않는다 — npm 은 run-script 를 npm 의 script-shell 로 부른다 ·
 *   Windows 기본 cmd.exe · .npmrc script-shell 0건(378db829).
 *
 * ★패턴(명부)은 package.json "test" 한 곳에만 있다 — 이 파일은 argv 로 받는다.
 *   ⛔여기에 기본 패턴을 두지 마라(명부가 둘이 된다 · tests/unit/test-dirs-reachable.test.js R-1 이 그 줄을 읽는다).
 * ★node 는 `--test-concurrency=abc` 를 rc 0 으로 받는다(261022 실측 · Node v24.11.1 · 0 · 1.5 도 rc 0 · -1 만 RangeError rc 1).
 *   =0 은 기본(코어 수)으로 돈다(지디 srv v24.10.0 실측 · «없음»과 같은 시간) — «0 = 직렬/제한 없음» 이 아니다.
 *   그래서 여기서 정수를 확인하고 rc 2 로 거절한다. ⛔이 거름을 빼지 마라.
 * ★동시도는 검사 수를 안 바꾼다 — 실측 261022: srv(Node 24.10 · 동시도 2) ↔ Intel(Node 25.8 · 동시도 12)에서
 *   tests/pass/fail/skipped/rc 다섯 수가 전부 같다(4674/4673/0/1/0 · 판 378db829).
 * ★자식 rc 를 그대로 넘긴다 — 삼키면 빨강이 초록으로 둔갑한다(시그널로 죽어 status null 이어도 1).
 * 잠그는 자리: tests/unit/run-unit-wrapper.test.mjs */
import { spawnSync } from 'node:child_process';

const raw = process.env.GOYA_TEST_CONCURRENCY;
/* 변수가 «아예 없을 때»만 기본 2 — 빈 문자열(`GOYA_TEST_CONCURRENCY=`)은 거절 집합이다(Number('') = 0 → 아래에서 rc 2). */
const n = raw === undefined ? 2 : Number(raw);
if (!Number.isInteger(n) || n < 1) {
  process.stderr.write(`[run-unit] GOYA_TEST_CONCURRENCY 는 양의 정수여야 한다 — 받은 값 ${JSON.stringify(raw)}\n`);
  process.exit(2);
}
const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  process.stderr.write('[run-unit] 검사 패턴이 0개다 — package.json "test" 줄에서 패턴을 넘겨라\n');
  process.exit(2);
}
/* ★196 ⑴ — 유닛 파일 시간 래칫의 «재료». GOYA_TEST_JUNIT=<경로> 일 때만 JUnit 보고를 그 파일에 «덧» 쓴다(화면 spec 보고는 그대로).
 *   JUnit testcase 마다 file·time 이 있어 파일별 합을 낼 수 있다(spec·tap 보고엔 파일 묶음이 없다 — 261028 실측 Node 25.8).
 *   ⚠️동기 몸(spawnSync 등)도 time 에 든다 ⇒ --test-timeout 이 못 잡는 «느려짐»도 이 재료로 잡힌다(tests/unit-time.gate.js).
 *   변수가 없으면 아무것도 안 바뀐다(보고 꼴·rc 그대로 — run-unit-wrapper.test.mjs). */
const junit = process.env.GOYA_TEST_JUNIT;
const rep = junit ? ['--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=junit', `--test-reporter-destination=${junit}`] : [];
/* ★196 ⑴(지디 판정 261028) — 비동기 시험 상한 60s. 근거(첫 전수 5c5b94f5 JUnit): 시험 하나 >60s 는 둘뿐이고 둘 다 «동기 몸»
 *   (css-token-lint ② --rev 218.7s spawnSync · renderer-js-parses P1 72.5s execFileSync) ⇒ 이 상한이 못 드는 꼴(196 ⒜ 실측: 동기 몸엔 안 듦) ·
 *   60s 넘는 «비동기» 0 ⇒ 오늘 판에서 빨강 0 이 «전제». ⛔N 을 «지금 최대»(218.7s)로 두지 않는다(항등식).
 *   동기 몸의 느려짐은 이 상한이 아니라 tests/unit-time.gate.js(파일 시간 명부)가 잡는다. 덮어쓰기 = GOYA_TEST_TIMEOUT_MS(양의 정수). */
const rawT = process.env.GOYA_TEST_TIMEOUT_MS;
const tmo = rawT === undefined ? 60000 : Number(rawT);
if (!Number.isInteger(tmo) || tmo < 1) {
  process.stderr.write(`[run-unit] GOYA_TEST_TIMEOUT_MS 는 양의 정수여야 한다 — 받은 값 ${JSON.stringify(rawT)}\n`);
  process.exit(2);
}
const r = spawnSync(process.execPath, ['--test', `--test-concurrency=${n}`, `--test-timeout=${tmo}`, ...rep, ...patterns], { stdio: 'inherit' });
process.exit(r.status ?? 1);
