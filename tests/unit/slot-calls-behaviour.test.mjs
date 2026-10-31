/* slot-calls-behaviour.test.mjs — ★315 CALLER-COUNT-GATE-BLIND-TO-PYTHON-SLOTS-01 · 슬롯이 제 게이트를 «실제로» 부르고 rc 가 따라오나 (S7 · 261031 · 지디 G117)
 *   ★왜: gate-callers.test.mjs 는 부름 «글» 을 센다 — 같은 게이트를 다른 슬롯도 부르면 한 슬롯을 꺼도 못 본다(dom-run-complete 실측).
 *   자: 슬롯을 임시 나무에 옮기고 게이트 자리에 가짜를 둔다(레포·.slot-out 에 안 쓴다 · unit-time --record 가 레포 명부를 못 건드린다). 선례 = nameset-judge N9 · touch-guard TG5.
 *   한 쌍: S1~S4 = 가짜 rc 0·1 을 슬롯 rc 가 따라오고 부름이 찍힌다 · 부름 줄을 끄면 그 칸이 빨강(회신에 실측).
 *   S0 = tools/slots/*.sh 가 다 어느 칸에 든다 — 새 슬롯은 칸 없이 못 들어온다 · S5 = 맨 npx 0.
 *   ⚠️자 한계: 가짜 게이트라 진짜 게이트의 판정은 안 잰다(그것은 각 게이트의 자가 잰다) · dom-red-pair·touch-guard 는 N9·TG5 몫. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const NO_BASH = spawnSync('bash', ['-c', 'true']).status === 0 ? false : '⚠️bash 없음 — 슬롯 행위를 못 잰다(통과 아님)';
const OTHERS = { 'dom-red-pair-slot.sh': 'nameset-judge N9', 'touch-guard-slot.sh': 'touch-guard TG5' };
const COVERED = ['dom-flaky-roster-slot.sh', 'dom-run-complete-slot.sh', 'dom-precondition-split-slot.sh', 'unit-time-slot.sh'];
const STUB = "const n = require('path').basename(__filename); require('fs').appendFileSync(process.env.STUB_MARK, [n, ...process.argv.slice(2)].join(' ') + '\\n'); process.exit(Number(process.env['RC_' + n.split('.')[0].replace(/-/g, '_')] || 0));\n";
const JUNIT = "require('fs').writeFileSync(process.env.GOYA_TEST_JUNIT, '<x/>');\n";

function go(slot, gates, { args = [], env = {} } = {}) {
  const dir = fs.realpathSync(mkTmpRoot('slot-calls-'));
  fs.mkdirSync(path.join(dir, 'tools', 'slots'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'tools', 'slots', slot), path.join(dir, 'tools', 'slots', slot));
  for (const g of gates) { fs.mkdirSync(path.dirname(path.join(dir, g)), { recursive: true }); fs.writeFileSync(path.join(dir, g), STUB); }
  fs.writeFileSync(path.join(dir, 'r.cjs'), JUNIT);
  fs.writeFileSync(path.join(dir, 'in.log'), 'x\n');
  const mark = path.join(dir, 'mark.txt'); fs.writeFileSync(mark, '');
  const r = spawnSync('bash', [path.join('tools', 'slots', slot), ...args], { cwd: dir, encoding: 'utf8',
    env: { ...process.env, SLOT_OUT: 'out', STUB_MARK: mark, SLOT_LOG: '', SLOT_RUNNER: 'node r.cjs', SLOT_GATE: '', ...env } });
  return { rc: r.status, out: String(r.stdout) + String(r.stderr), calls: fs.readFileSync(mark, 'utf8').trim().split('\n').filter(Boolean) };
}

test('S0 ★슬롯이 다 어느 칸에 든다 — 새 슬롯은 칸 없이 못 들어온다', () => {
  const have = fs.readdirSync(path.join(ROOT, 'tools', 'slots')).filter((f) => f.endsWith('.sh')).sort();
  assert.deepEqual(have, [...COVERED, ...Object.keys(OTHERS)].sort());
});
test('S5 슬롯 실행 줄에 맨 npx 가 없다(COMMON · --no-install 은 된다)', () => {
  const bad = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l) && /\bnpx\b/.test(l) && !/npx --no-install/.test(l));
  assert.equal(bad('npx playwright test').length, 1, '자 양성');
  assert.equal(bad('npx --no-install x\n# npx y').length, 0, '자 음성');
  const hits = fs.readdirSync(path.join(ROOT, 'tools', 'slots')).filter((f) => f.endsWith('.sh')).flatMap((f) => bad(fs.readFileSync(path.join(ROOT, 'tools', 'slots', f), 'utf8')).map((l) => `${f}: ${l}`));
  assert.deepEqual(hits, []);
});
test('S1 dom-flaky-roster — 게이트를 부르고 rc 가 따라온다', { skip: NO_BASH }, () => {
  const G = ['tests/dom/flaky-roster.gate.js'], env = { SLOT_LOG: 'in.log' };
  const ok = go('dom-flaky-roster-slot.sh', G, { env });
  assert.equal(ok.rc, 0, ok.out); assert.deepEqual(ok.calls, ['flaky-roster.gate.js in.log']);
  assert.equal(go('dom-flaky-roster-slot.sh', G, { env: { ...env, RC_flaky_roster: '1' } }).rc, 1);
});
test('S2 dom-run-complete — 게이트를 부르고 rc 가 따라온다', { skip: NO_BASH }, () => {
  const G = ['tests/dom/run-complete.gate.js'];
  const ok = go('dom-run-complete-slot.sh', G);
  assert.equal(ok.rc, 0, ok.out); assert.deepEqual(ok.calls, ['run-complete.gate.js out/run.log']);
  assert.equal(go('dom-run-complete-slot.sh', G, { env: { RC_run_complete: '1' } }).rc, 1);
});
test('S3 dom-precondition-split — 둘 다 부르고 rc 는 하나라도 ≠0 이면 ≠0', { skip: NO_BASH }, () => {
  const G = ['tests/dom/run-complete.gate.js', 'tests/dom/precondition-split.gate.js'], args = ['in.log'];
  const ok = go('dom-precondition-split-slot.sh', G, { args });
  assert.equal(ok.rc, 0, ok.out); assert.deepEqual(ok.calls, ['run-complete.gate.js in.log', 'precondition-split.gate.js in.log']);
  assert.equal(go('dom-precondition-split-slot.sh', G, { args, env: { RC_precondition_split: '1' } }).rc, 1);
  assert.equal(go('dom-precondition-split-slot.sh', G, { args, env: { RC_run_complete: '1' } }).rc, 1, 'run-complete 빨강이 rc 에 안 든다');
});
test('S4 unit-time — 두 회차를 부르고(첫째 --record) rc 는 둘째를 따라온다', { skip: NO_BASH }, () => {
  const G = ['tests/unit-time.gate.js'];
  const ok = go('unit-time-slot.sh', G);
  assert.equal(ok.rc, 0, ok.out);
  assert.deepEqual(ok.calls.map((c) => c.replace(/\S*\/out\//, 'out/').replace(/^unit-time\.gate\.js /, '')), ['out/u1.xml --record', 'out/u2.xml']);
  assert.equal(go('unit-time-slot.sh', G, { env: { RC_unit_time: '1' } }).rc, 1);
});
