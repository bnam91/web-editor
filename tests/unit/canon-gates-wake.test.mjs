/* canon-gates-wake.test.mjs — ★314 CANON-GATE-ONLY-IN-FULL-RUN-MISSES-THE-CLOSER-01 · 파일을 집어 부른 사람도 정본 게이트를 깨우나 (S7 · 261031 · 지디 G117)
 *   ★평소 꼴 = node tests/run-unit.mjs <파일> · 자는 tests/run-unit.mjs canonGates.
 *   자: run-unit.mjs 를 임시 나무에 옮겨 가짜 게이트로 돌린다(레포 파일에 심지 않는다).
 *   한 쌍: W1 양성 = 다른 파일에 심고 평소 꼴 ⇒ 게이트 빨강 · W2 음성 = 안 심으면 rc 0 · W3 전수 꼴(패턴에 *)엔 안 얹는다 ·
 *   W4 명부에 없는 파일 ⇒ rc 3 · W5 진짜 명부의 파일이 다 있다 · W6 레포 뿌리 밖 cwd 엔 안 얹는다.
 *   ★W3 은 화면 글자를 안 센다(322): 러너 보고 꼴이 node 판·TTY 로 갈려(run-unit.mjs dflt) v22 tap 은 이름을 두 줄에 찍는다 ⇒ 자식 JUnit 을 센다 · 세기 전에 그 글이 JUnit 인지 단언한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const GATE = "import test from 'node:test';\nimport assert from 'node:assert';\nimport fs from 'node:fs';\n"
  + "test('가짜 게이트', () => { assert.equal(fs.readFileSync('tests/unit/own.test.mjs', 'utf8').includes('심음'), false); });\n";
const OWN = "import test from 'node:test';\ntest('내 파일', () => {});\n";

function tree({ own = OWN, roster = ['tests/unit/gate.test.mjs'] } = {}) {
  const dir = fs.realpathSync(mkTmpRoot('canon-gates-'));
  fs.mkdirSync(path.join(dir, 'tests', 'unit'), { recursive: true });
  for (const f of ['tests/run-unit.mjs', 'tests/unit/_tmproot.js', 'tests/unit/UNIT_SLOW.json']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'tests/unit/CANON_GATES.json'), JSON.stringify({ gates: roster }));
  fs.writeFileSync(path.join(dir, 'tests/unit/gate.test.mjs'), GATE);
  fs.writeFileSync(path.join(dir, 'tests/unit/own.test.mjs'), own);
  return dir;
}
function run(cwd, wrapper, args, extraEnv) {
  const env = { ...process.env, ...extraEnv }; delete env.NODE_TEST_CONTEXT; if (!extraEnv) delete env.GOYA_TEST_JUNIT;
  const r = spawnSync(process.execPath, [wrapper, ...args], { cwd, env, encoding: 'utf8' });
  return { rc: r.status, out: r.stdout + r.stderr };
}
const inTree = (dir, args) => run(dir, path.join(dir, 'tests/run-unit.mjs'), args);

test('W1 양성 — 다른 파일에 심고 평소 꼴 ⇒ 게이트가 깨어 빨강', () => {
  const r = inTree(tree({ own: OWN + '// 심음\n' }), ['tests/unit/own.test.mjs']);
  assert.equal(r.rc, 1, r.out);
  assert.match(r.out, /정본 게이트 1 벌/);
  assert.match(r.out, /가짜 게이트/);
});
test('W2 음성 — 안 심으면 평소 꼴 rc 0 · 게이트는 돌았다', () => {
  const r = inTree(tree(), ['tests/unit/own.test.mjs']);
  assert.equal(r.rc, 0, r.out);
  assert.match(r.out, /가짜 게이트/);
});
test('W3 전수 꼴(패턴에 *)엔 안 얹는다 — 두 번 안 돈다', () => {
  const dir = tree();
  const junit = path.join(dir, 'w3.xml');
  const r = run(dir, path.join(dir, 'tests/run-unit.mjs'), ['tests/unit/*.test.mjs'], { GOYA_TEST_JUNIT: junit });
  assert.equal(r.rc, 0, r.out);
  assert.doesNotMatch(r.out, /정본 게이트/);
  const xml = fs.readFileSync(junit, 'utf8');
  const cases = (name) => (xml.match(new RegExp(`<testcase name="${name}"`, 'g')) || []).length;
  assert.equal(cases('내 파일'), 1, `★전제: 센 글이 JUnit 시험 줄이 아니다 — 아래 수는 뜻이 없다\n${xml}`);
  assert.equal(cases('가짜 게이트'), 1, xml);
});
test('W4 명부에 없는 파일 ⇒ rc 3 (못 잰다 ≠ 통과)', () => {
  const r = inTree(tree({ roster: ['tests/unit/없음.test.mjs'] }), ['tests/unit/own.test.mjs']);
  assert.equal(r.rc, 3, r.out);
  assert.match(r.out, /정본 게이트 명부/);
});
test('W5 진짜 명부 — 파일이 다 있고 비지 않았다', () => {
  const { gates } = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/unit/CANON_GATES.json'), 'utf8'));
  assert.ok(gates.length > 0);
  for (const g of gates) assert.ok(fs.existsSync(path.join(ROOT, g)), g);
});
test('W6 레포 뿌리 밖 cwd 엔 안 얹는다', () => {
  const dir = tree();
  const r = run(dir, path.join(ROOT, 'tests/run-unit.mjs'), ['tests/unit/own.test.mjs']);
  assert.equal(r.rc, 0, r.out);
  assert.doesNotMatch(r.out, /정본 게이트/);
});
