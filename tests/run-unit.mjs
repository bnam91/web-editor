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
const r = spawnSync(process.execPath, ['--test', `--test-concurrency=${n}`, ...patterns], { stdio: 'inherit' });
process.exit(r.status ?? 1);
