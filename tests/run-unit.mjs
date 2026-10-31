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
 * ★303 ⑶ «취소 0 인가» 를 묻는다 — 파일째 시간 초과는 fail 이 아니라 cancelled 로 세어 «fail 0» 인 채 검사가 빠진다(수는 런마다 움직인다 ⇒ 수를 믿지 말고 0 을 묻는다).
 *   취소 수 = JUnit 끝의 `<!-- cancelled N -->` · 이름 = failure type. ⛔fail 과 섞지 않는다. N>0 이면 rc 1 · 못 읽고 자식 rc 0 이면 rc 3(못 잰다 ≠ 통과 · unit-time.gate 와 같은 뜻).
 *   상한이 어디까지 드는지의 판별 수치는 tests/unit-time.gate.js 머리말이 정본이다(여기 안 적는다).
 * 잠그는 자리: tests/unit/run-unit-wrapper.test.mjs */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { mkTmpRoot } = createRequire(import.meta.url)('./unit/_tmproot.js');   // 치우기는 공용 자가 쥔다(tmproot-sole-owner)

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
 *   ⚠️동기 몸(spawnSync 등)도 time 에 든다 ⇒ --test-timeout 이 못 잡는 판(판별로 다르다 · 아래 ★196 ⑴)의 «느려짐»도 이 재료로 잡힌다(tests/unit-time.gate.js).
 *   변수가 없으면 아무것도 안 바뀐다(보고 꼴·rc 그대로 — run-unit-wrapper.test.mjs). */
const junit = process.env.GOYA_TEST_JUNIT || path.join(mkTmpRoot('run-unit-'), 'u.xml');
/* 변수가 없을 때도 취소 수를 읽으려 JUnit 을 임시 파일에 덧쓴다 · 화면 보고는 node 기본 꼴 그대로(TTY = spec · 아니면 tap · node 23+ = spec — ⒡ 가 맨 node --test 와 견준다). */
const dflt = process.env.GOYA_TEST_JUNIT || process.stdout.isTTY || Number(process.versions.node.split('.')[0]) >= 23 ? 'spec' : 'tap';
const rep = [`--test-reporter=${dflt}`, '--test-reporter-destination=stdout', '--test-reporter=junit', `--test-reporter-destination=${junit}`];
/* ★196 ⑴(지디 판정 261028 · 값은 ★303 ⑵ 가 아래 명부로 갈음) — 그때 비동기 시험 상한 60s. 근거(첫 전수 5c5b94f5 JUnit): 시험 하나 >60s 는 둘뿐이고 둘 다 «동기 몸»
 *   (css-token-lint ② --rev 218.7s spawnSync · renderer-js-parses P1 72.5s execFileSync). ★판별로 다르다 — 판별 값의 정본 = tests/unit-time.gate.js 머리말 «★왜» 줄. 여기 남긴 것은 ★v25.8.0 실측(261031 S6 2×2 · 양성 섰다) 하나뿐: 동기 몸엔 ★안 듦 · ★비동기는 든다.
 *   60s 넘는 «비동기» 0 ⇒ v25.8.0 에서 빨강 0 이 «전제». ⛔N 을 «지금 최대»(218.7s)로 두지 않는다(항등식).
 *   동기 몸의 느려짐은 이 상한이 아니라 tests/unit-time.gate.js(파일 시간 명부)가 잡는다. 덮어쓰기 = GOYA_TEST_TIMEOUT_MS(양의 정수). */
const rawT = process.env.GOYA_TEST_TIMEOUT_MS;
/* ★303 ⑵ — 기본 상한 = 명부에서 끈다: 가장 느린 «파일 한 벌의 벽시계»(모듈 로드 포함) × (1+tol). ⛔여기 수를 손으로 박지 않는다(박아 두면 썩는다).
 *   상한은 «안 끝남» 을 잡고 «느림» 은 unit-time.gate.js 래칫이 잡는다. ⛔쪼개기(그 파일만 가르기)는 첫 처방이 아니다 — 모듈 로드가 조각마다 다시 든다.
 *   명부를 못 읽으면 rc 3(못 잰다 ≠ 기본값으로 통과). */
function capFromRoster() {
  try {
    const { files, tol } = JSON.parse(fs.readFileSync(new URL('./unit/UNIT_SLOW.json', import.meta.url), 'utf8'));
    return Math.ceil(Math.max(...Object.values(files)) * (1 + tol));
  } catch (e) {
    process.stderr.write(`[run-unit] ⛔상한 명부(tests/unit/UNIT_SLOW.json)를 못 읽었다 — ${e.message}\n`);
    process.exit(3);
  }
}
const tmo = rawT === undefined ? capFromRoster() : Number(rawT);
if (rawT === undefined && (!Number.isInteger(tmo) || tmo < 1)) {
  process.stderr.write(`[run-unit] ⛔상한 명부(tests/unit/UNIT_SLOW.json)에서 낸 값이 양의 정수가 아니다 — ${tmo}\n`);
  process.exit(3);
}
if (!Number.isInteger(tmo) || tmo < 1) {
  process.stderr.write(`[run-unit] GOYA_TEST_TIMEOUT_MS 는 양의 정수여야 한다 — 받은 값 ${JSON.stringify(rawT)}\n`);
  process.exit(2);
}
/* ★314 CANON-GATE-ONLY-IN-FULL-RUN-MISSES-THE-CLOSER-01 — «정본 한 자리» 게이트는 레포를 훑어야 잰다 ⇒ 제 파일만 돌리면 안 깨어난다.
 *   ⇒ 파일을 집어 부를 때(패턴에 * 없음) 명부 tests/unit/CANON_GATES.json 을 같이 돌린다. 전수(패턴에 *)엔 이미 든다 · 레포 뿌리 밖 cwd(사본·임시 나무)엔 안 얹는다.
 *   명부를 못 읽거나 든 파일이 없으면 rc 3(못 잰다 ≠ 통과). ★평소 꼴 = node tests/run-unit.mjs <파일> 하나(⛔맨 node --test 금지 · 지디 261031). ⚠️자 한계: 맨 node --test <파일> 은 이 줄을 안 지난다 · 명부는 손으로 세웠다(분모 미확정 · 그 파일 note).
 *   잠그는 자리: tests/unit/canon-gates-wake.test.mjs */
function canonGates() {
  const repo = fs.realpathSync(fileURLToPath(new URL('..', import.meta.url)));
  if (patterns.some((x) => x.includes('*')) || fs.realpathSync(process.cwd()) !== repo) return [];
  try {
    const { gates } = JSON.parse(fs.readFileSync(new URL('./unit/CANON_GATES.json', import.meta.url), 'utf8'));
    for (const g of gates) fs.accessSync(path.join(repo, g));
    const named = new Set(patterns.map((x) => path.relative(repo, path.resolve(x))));
    return gates.filter((g) => !named.has(g));
  } catch (e) {
    process.stderr.write(`[run-unit] ⛔정본 게이트 명부(tests/unit/CANON_GATES.json)를 못 읽었다 — ${e.message}\n`);
    process.exit(3);
  }
}
const gates = canonGates();
if (gates.length) process.stdout.write(`[run-unit] 정본 게이트 ${gates.length} 벌을 같이 돈다 (tests/unit/CANON_GATES.json)\n`);
const r = spawnSync(process.execPath, ['--test', `--test-concurrency=${n}`, `--test-timeout=${tmo}`, ...rep, ...patterns, ...gates], { stdio: 'inherit' });
let xml = '';
try { xml = fs.readFileSync(junit, 'utf8'); } catch { /* 없음 = 못 잼 — 아래에서 가른다 */ }
const c = /<!-- cancelled (\d+) -->/.exec(xml);
if (!c) {
  process.stdout.write('[run-unit] ⛔취소 수를 못 읽었다(JUnit 끝 줄 없음)\n');
  if (r.status === 0) process.exit(3);
} else {
  const names = [...xml.matchAll(/<testcase name="([^"]*)"[^>]*>\s*<failure type="(?:testTimeoutFailure|cancelledByParent)"/g)].map((m) => m[1]);
  process.stdout.write(`[run-unit] 취소 ${c[1]}${names.length ? ` · ${names.join(' · ')}` : ''}\n`);
  if (Number(c[1]) > 0) process.exit(r.status || 1);
}
process.exit(r.status ?? 1);
