/* run-unit-wrapper.test.mjs — tests/run-unit.mjs(`npm test` 래퍼)를 «행위로» 잠근다 (2026-10-22 · 지디 GO ⒝1)
 *   실행: node --test tests/unit/run-unit-wrapper.test.mjs
 *
 * ★임시 cwd 에 tests/unit/ 를 짓고 래퍼를 부른다 — ⛔레포 cwd 로 부르면 이 파일 자신을 다시 돈다(재귀).
 *   임시 루트는 ★공용 자 tests/unit/_tmproot.js mkTmpRoot 가 만들고 치운다(pid 우산 · 종료훅 · 죽은 실행 회수) —
 *   ⛔이 파일은 제 손으로 지우지 않는다(tests/unit/tmproot-sole-owner.test.mjs 가 잰다 · 38325fcb Intel 전수 빨강 3 의 까닭).
 * ★자식 env 에서 NODE_TEST_CONTEXT 를 뺀다 — 이 파일이 node --test 아래서 돌 때 그 값이 손자 node --test 로 새면
 *   손자가 «보고 꼴»을 바꾼다. GOYA_TEST_CONCURRENCY 도 칸마다 새로 정한다(바깥 셸 값이 칸을 오염시키지 않게).
 *
 * 칸:
 *   ⒜ 일부러 빨강인 검사 하나 → 래퍼 rc ≠ 0   (변이 대조: `process.exit(r.status ?? 1)` → `process.exit(0)` 사본에서 빨강)
 *   ⒝ GOYA_TEST_CONCURRENCY = abc · 0 · 1.5 · -1 · (빈 문자열) → 칸마다 rc 2   (변이 대조: exit 2 줄 지운 사본 · 빈 문자열을 기본으로 받는 사본에서 빨강)
 *   ⒞ 동시도 = «겹침 수» k — 400ms 쉬는 검사 파일 6 개의 [t0,t1] 구간 최대 동시 겹침을 센다(⛔시간으로 판정 안 함 · 시간은 기록만).
 *      변수 없음 → k = 2 · GOYA_TEST_CONCURRENCY=1 → k = 1 · =3 → k = 3 (2 와 3 도 갈린다).
 *      ★전제 먼저: 여섯 파일이 각각 t1−t0 ≥ 300ms — 안 서면 «전제 미성립»으로 따로 실패(k 빨강 아님).
 *      ★흔들림 방향: 부하는 겹침을 줄이지 늘리지 않는다 — node 가 동시도 c 위로 자식을 띄우지 않으므로 k ≤ c 는 늘 참이고,
 *      부하가 기동을 400ms 넘게 어긋내면 k < c 쪽으로만 샌다(그때는 «겹침이 안 섰다» 빨강). ⇒ k > c 빨강은 부하로는 안 난다.
 *      (변이 대조: 기본 2→1 사본 k=1 빨강 · 2→4 사본 k=4 빨강. 앞 판 «시간 비 0.75» 자는 2→4 사본을 못 잡았다 — 실측 초록.)
 *   ⒟ 패턴 0개 → rc 2   (변이 대조: argv 0 거름 줄을 지운 사본에서 빨강)
 *   ⒠ 빨간 임시 검사 «경로»를 argv 로 → rc ≠ 0   (⒜ 와 거의 같은 칸 · 변이 대조: `process.exit(0)` 사본에서 빨강)
 *   ⚠️Windows cmd 에서 package.json 따옴표가 어떻게 넘어가는지는 ★안 잰다(지금 줄과 같은 처지 · 새 위험 아님). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const WRAPPER = fileURLToPath(new URL('../run-unit.mjs', import.meta.url));
const PATTERNS = ['tests/unit/*.test.mjs'];

const RED = "import test from 'node:test';\nimport assert from 'node:assert';\ntest('일부러 빨강', () => { assert.fail('일부러'); });\n";
const GREEN = "import test from 'node:test';\ntest('초록', () => {});\n";
/* 겹침 자 검사 파일 — 시작에 t0 · 400ms 쉼 · 끝에 t1 을 ★제 이름의 파일 하나에 적는다(파일끼리 쓰기 겹침 없음).
   적는 폴더는 env RUW_OVL_DIR — 잼마다 새 폴더(앞 잼의 기록을 지우지 않고 갈라 둔다). */
const OVL = (name) => "import test from 'node:test';\nimport fs from 'node:fs';\n"
  + `test('${name}', async () => { const t0 = Date.now(); await new Promise((r) => setTimeout(r, 400)); `
  + `fs.writeFileSync(process.env.RUW_OVL_DIR + '/${name}.json', JSON.stringify({ pid: process.pid, t0, t1: Date.now() })); });\n`;
const OVL_N = 6;
/* 구간들의 최대 동시 겹침 수 — 같은 시각이면 «끝»을 먼저 센다(맞닿음은 겹침 아님) */
function maxOverlap(iv) {
  const ev = iv.flatMap(({ t0, t1 }) => [[t0, 1], [t1, -1]]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let k = 0, max = 0; for (const [, d] of ev) { k += d; if (k > max) max = k; } return max;
}

function withTmp(files, fn) {
  const dir = mkTmpRoot('run-unit-wrapper-');   // 치우기는 _tmproot 가 쥔다
  fs.mkdirSync(path.join(dir, 'tests', 'unit'), { recursive: true });
  for (const [name, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'tests', 'unit', name), src);
  return fn(dir);
}
function runWrapper(cwd, { conc, args = PATTERNS, extraEnv = {} } = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  delete env.GOYA_TEST_CONCURRENCY;
  if (conc !== undefined) env.GOYA_TEST_CONCURRENCY = conc;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [WRAPPER, ...args], { cwd, env, encoding: 'utf8', timeout: 60000 });
  return { rc: r.status, signal: r.signal, ms: Date.now() - t0, out: r.stdout || '', err: r.stderr || '' };
}

test('⒜ 일부러 빨강인 검사 → 래퍼 rc ≠ 0 (자식 rc 를 삼키지 않는다)', () => {
  withTmp({ 'red.test.mjs': RED }, (dir) => {
    const r = runWrapper(dir);
    /* 양성대조 — 그 빨강이 «정말 돌았나»: 돌지 않은 0 건 런과 가르지 못하면 rc 단언은 검사처럼 생긴 문장이다 */
    assert.match(r.out, /일부러 빨강/, `빨간 검사가 안 돌았다 — 이 칸은 아무것도 안 쟀다\n${r.out}\n${r.err}`);
    assert.notEqual(r.rc, 0, `빨간 검사가 있는데 래퍼 rc = ${r.rc} — 빨강이 초록으로 둔갑했다`);
  });
});

/* ⒝ 거절 집합(지디) = {abc · 0 · 1.5 · 음수 · 빈 문자열} — 칸마다 이름을 단다. 변수가 «아예 없을 때»만 기본 2 다.
   -1 은 node 가 스스로 막지만(RangeError) 그 막음은 버전에 달렸다 ⇒ 래퍼가 먼저 막는다.
   =0 은 node 에선 rc 0 · 기본(코어 수)으로 돈다(지디 srv v24.10.0 실측) ⇒ «0 = 직렬/제한 없음» 으로 읽히면 부하 문제를 그대로 얻는다. */
for (const [label, bad] of [['abc', 'abc'], ['0', '0'], ['1.5', '1.5'], ['-1', '-1'], ['빈 문자열', '']]) {
  test(`⒝ GOYA_TEST_CONCURRENCY=${label} → rc 2 ＋ stderr 한 줄 (⛔조용한 무시)`, () => {
    withTmp({ 'green.test.mjs': GREEN }, (dir) => {
      const r = runWrapper(dir, { conc: bad });
      assert.equal(r.rc, 2, `GOYA_TEST_CONCURRENCY=${JSON.stringify(bad)} → rc ${r.rc} (2 여야)\n${r.err}`);
      assert.match(r.err, /\[run-unit\]/, `GOYA_TEST_CONCURRENCY=${JSON.stringify(bad)} → stderr 에 까닭 한 줄이 없다`);
    });
  });
}

test('⒞ 동시도 = 겹침 수 k — 변수 없음 k=2 · c1 k=1 · c3 k=3 (전제: 여섯 파일 각 ≥300ms)', (t) => {
  const files = Object.fromEntries(Array.from({ length: OVL_N }, (_, i) => [`o${i + 1}.test.mjs`, OVL(`o${i + 1}`)]));
  withTmp(files, (dir) => {
    const measure = (conc) => {
      const ovl = path.join(dir, `ovl-${conc ?? 'none'}`); fs.mkdirSync(ovl);   // 잼마다 새 폴더 — 지우지 않고 갈라 둔다
      const r = runWrapper(dir, { conc, extraEnv: { RUW_OVL_DIR: ovl } });
      const iv = fs.readdirSync(ovl).map((f) => JSON.parse(fs.readFileSync(path.join(ovl, f), 'utf8')));
      return { ...r, iv, k: maxOverlap(iv) };
    };
    const runs = { '변수 없음': measure(undefined), c1: measure('1'), c3: measure('3') };
    t.diagnostic(Object.entries(runs).map(([k, r]) => `${k}: k=${r.k} · ${r.ms}ms(기록만) · 구간 ${r.iv.map((x) => x.t1 - x.t0).join('/')}`).join(' | '));
    /* ★전제 — 여섯이 다 돌았고 각각 ≥300ms 걸렸나(안 서면 k 를 못 재는 판) */
    for (const [name, r] of Object.entries(runs)) {
      assert.equal(r.rc, 0, `전제 미성립(${name}): 초록 검사 여섯인데 rc ${r.rc}\n${r.out}\n${r.err}`);
      assert.equal(r.iv.length, OVL_N, `전제 미성립(${name}): 구간 ${r.iv.length}/${OVL_N} — 다 돌지 않았다`);
      for (const x of r.iv) assert.ok(x.t1 - x.t0 >= 300, `전제 미성립(${name}): 한 파일 구간 ${x.t1 - x.t0}ms < 300 — 이 판에선 k 를 못 잰다`);
    }
    /* ★k — 전제가 선 뒤에만 */
    assert.equal(runs['변수 없음'].k, 2, `변수 없음 → 겹침 k=${runs['변수 없음'].k} (2 여야 · 1 이면 겹침이 안 섰다/기본이 1 로 샜다 · 3 이상이면 기본이 2 보다 크게 샜다)`);
    assert.equal(runs.c1.k, 1, `GOYA_TEST_CONCURRENCY=1 → 겹침 k=${runs.c1.k} (1 이어야 · 동시도 1 이 안 먹었다)`);
    assert.equal(runs.c3.k, 3, `GOYA_TEST_CONCURRENCY=3 → 겹침 k=${runs.c3.k} (3 이어야)`);
  });
});

/* ⒠ 는 ⒜ 와 ★거의 같은 칸이다 — 둘 다 «빨강이 래퍼를 지나 rc 로 나오나»를 잰다. 다른 점 하나: ⒜ 는 glob 패턴을 넘기고(npm test 꼴),
   ⒠ 는 ★그 파일 경로 하나를 argv 로 넘긴다(패턴 펼침과 상관없이 rc 통과만). 변이 짝은 둘 다 `process.exit(0)` 사본. */
test('⒠ 빨간 임시 검사 경로를 argv 로 → 래퍼 rc ≠ 0 (rc 를 삼키지 않는다)', () => {
  withTmp({}, (dir) => {
    const rel = path.join('tests', 'unit', 'red-e.test.mjs'); const abs = path.join(dir, rel);
    fs.writeFileSync(abs, RED);   // 거두기는 임시 루트째 _tmproot 가 쥔다(⛔제 손 지움 · tmproot-sole-owner)
    const r = runWrapper(dir, { args: [rel] });
    assert.match(r.out, /일부러 빨강/, `빨간 검사가 안 돌았다 — 이 칸은 아무것도 안 쟀다\n${r.out}\n${r.err}`);
    assert.notEqual(r.rc, 0, `빨간 검사 경로를 넘겼는데 래퍼 rc = ${r.rc} — 빨강이 래퍼에서 삼켜졌다`);
  });
});

test('⒟ 패턴 0개 → rc 2 ＋ stderr 한 줄 (래퍼 안에 기본 패턴을 두지 않는다)', () => {
  withTmp({ 'green.test.mjs': GREEN }, (dir) => {
    const r = runWrapper(dir, { args: [] });
    assert.equal(r.rc, 2, `패턴 0개 → rc ${r.rc} (2 여야)\n${r.out}\n${r.err}`);
    assert.match(r.err, /\[run-unit\]/, '패턴 0개 → stderr 에 까닭 한 줄이 없다');
  });
});
