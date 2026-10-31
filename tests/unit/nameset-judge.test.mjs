/* nameset-judge.test.mjs — ★310 tools/nameset-judge.py 가 규칙을 «실제로» 집행하나 (S3 · 261031 · 지디 APPINTEL-130537)
 * ★왜: 판정 자가 한 맥의 레인 폴더에만 살았다 ⇒ «그 규칙을 어긴 spec» 이 빨개지는지 재는 자가 0 이었다. 찾았다 ≠ 집행한다.
 * ★자: 손 로그·손 spec(임시 뿌리) → python 으로 도구를 불러 rc·첫 줄을 본다.
 *   규칙 ㉮ `★전제` 가 든 첫 실패 문구는 기대 빨강으로 안 센다 · 규칙 ㉯ `--red` 문구는 spec 원문에 있고 전제 줄과 안 섞인다.
 * ⚠️자 한계를 N8 로 잠근다(집행 안 하는 칸): 옛 꼴 `[전제]` 를 문구와 다른 줄에 두면 도구는 «통과» 한다 · 새 전제 줄이 `★전제:` 로 시작하는지는 아무도 안 잰다.
 * ⛔python 이 없으면 건너뛰지 않고 빨강 — 건너뛰면 «안 재고 있다» 와 구분이 안 된다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const TOOL = path.join(import.meta.dirname, '..', '..', 'tools', 'nameset-judge.py');
const PY = ['python3', 'python'].find((c) => spawnSync(c, ['--version'], { encoding: 'utf8' }).status === 0);
const SPEC = 'tests/dom/z.dom.spec.js';
const SRC = [
  "expect(a, '★전제: 장면이 안 섰다').toBe(1);",
  "expect(b, '주 단언 문구').toBe(1);",
  "expect(c, '섞인 문구 ★전제').toBe(1);",
  "const m = '따로 둔 문구';",
  'expect(d, `[전제] ${m}`).toBe(1);',
].join('\n');
const LOG = (err) => `  1) ${SPEC}:1:1 › M1 제목\n\n    Error: ${err}\n\n  1 failed\n    ${SPEC}:1:1 › M1 제목\n`;

function judge(log, args, root) {
  assert.ok(PY, '★전제: python3 또는 python 이 있다');
  const tmp = mkTmpRoot('nameset-judge-');
  fs.mkdirSync(path.join(tmp, 'tests', 'dom'), { recursive: true });
  fs.writeFileSync(path.join(tmp, SPEC), SRC);
  const f = path.join(tmp, 'run.log');
  fs.writeFileSync(f, log);
  const r = spawnSync(PY, [TOOL, f, ...args, '--root', root ?? tmp], { encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' } });
  return { rc: r.status, out: String(r.stdout) + String(r.stderr) };
}

test('N1 음성 — 규칙을 지키면 통과(rc 0)', () => {
  const r = judge(LOG('주 단언 문구 값'), ['--red', 'M1=주 단언 문구']);
  assert.equal(r.rc, 0, r.out);
  assert.match(r.out, /^통과/);
});
test('N2 ★㉮ 양성 — 첫 실패가 ★전제 면 기대 빨강으로 안 센다', () => {
  const r = judge(LOG('★전제: 장면이 안 섰다'), ['--red', 'M1=주 단언 문구']);
  assert.equal(r.rc, 1, r.out);
  assert.match(r.out, /⛔전제 빨강/);
});
test('N3 ★㉯ 양성 — 문구가 전제 줄과 섞이면 빨강', () => {
  const r = judge(LOG('섞인 문구'), ['--red', 'M1=섞인 문구']);
  assert.equal(r.rc, 1, r.out);
  assert.match(r.out, /⛔문구 출처 안 섬/);
});
test('N4 ★㉯ 양성 — 문구가 spec 원문에 0 줄(낡음)이면 빨강', () => {
  const r = judge(LOG('없는 문구 zz'), ['--red', 'M1=없는 문구 zz']);
  assert.equal(r.rc, 1, r.out);
  assert.match(r.out, /⛔문구 출처 안 섬/);
});
test('N5 ★㉯ 양성 — 기대 문구 없는 --red 는 조용히 통과 못 한다', () => {
  const r = judge(LOG('주 단언 문구 값'), ['--red', 'M1']);
  assert.equal(r.rc, 1, r.out);
  assert.match(r.out, /⛔RED 에 기대 문구 없음/);
});
test('N6 ★㉯ 양성 — spec 원문을 못 읽으면 통과 못 한다', () => {
  const r = judge(LOG('주 단언 문구 값'), ['--red', 'M1=주 단언 문구'], path.join(path.sep, 'no-such-root-310'));
  assert.equal(r.rc, 1, r.out);
  assert.match(r.out, /⛔문구 출처 안 섬/);
});
test('N7 못 읽음은 rc 2 — 이름 0 · 요약 수 ≠ 이름 줄 수', () => {
  assert.equal(judge('아무 것도 없다\n', ['--green', 'M1']).rc, 2);
  assert.equal(judge(`  2 failed\n    ${SPEC}:1:1 › M1 제목\n`, ['--green', 'M1']).rc, 2);
});
test('N8 ⚠️자 한계 잠금(집행 안 함) — 옛 꼴 [전제] · 문구가 다른 줄이면 «통과» 한다. 고쳐지면 이 칸을 뒤집어라', () => {
  const r = judge(LOG('[전제] 따로 둔 문구'), ['--red', 'M1=따로 둔 문구']);
  assert.equal(r.rc, 0, r.out);
});
