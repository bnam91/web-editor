/* proc-check-no-pgrep-f.test.mjs — ★300 PGREP-F-PROCESS-CHECK-FAILS-BOTH-WAYS-01 · 프로세스 유무를 `pgrep -f` 로 재지 않는다 (261031 · 지디)
 *   ★병: pgrep -f 는 args 전체를 본다 ⇒ 그 글자가 든 셸(미끼)까지 센다(㉠ 거짓양성). 처방 = procs_like(ps -u + 내 pid 제외 + 첫 낱말이 셸·검색 도구면 뺌).
 *   ⚠️자 한계: P1 은 *.sh(tools·scripts·tests)만 · P2·P3 는 procs_like 를 쓰는 두 벌만. ME(내 pid 제외)는 셸 제외와 겹쳐 따로 빨강이 안 선다.
 *   한 쌍: P2 = 미끼 셸에 0(같은 미끼에 pgrep -f 는 ≥1) / P3 = 진짜 프로세스에 ≥1(그 pid). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS = [['bash', 'tests/e2e/run-app.sh'], ['zsh', 'tools/slots/lane-gate/lane-gate.sh']];
const has = (bin) => cp.spawnSync(bin, ['-c', 'exit 0']).status === 0;
const skip = process.platform === 'win32' || !has('bash') || !has('zsh') ? 'bash·zsh·ps 가 있는 맥에서만 잰다' : false;

const PGREP_F = /(^|[\s;&|(])pgrep\s+(-\w+\s+)*-\w*f\b/;
/** 글자 하나에서 `pgrep -f` 를 부르는 줄 수 — 주석(#)을 뗀 줄만 */
const pgrepFLines = (text) => text.split('\n').map((l) => l.replace(/(^|\s)#.*$/, '')).filter((l) => PGREP_F.test(l)).length;
function shFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') shFiles(p, out); }
    else if (e.name.endsWith('.sh')) out.push(p);
  }
  return out;
}
const procsLike = (shell, rel, mark) => {
  const line = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').find((l) => l.startsWith('procs_like() {'));
  assert.ok(line, `${rel} 에 procs_like 줄이 없다`);
  const r = cp.spawnSync(shell, ['-c', `${line}\nprocs_like ${mark}`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split('\n').filter(Boolean);
};
const pgrepF = (mark) => cp.spawnSync('pgrep', ['-f', mark], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
/** 뜰 때까지 기다린 뒤 fn — 그룹째 죽인다(미끼 셸의 sleep 까지) */
async function withProc(cmd, args, mark, fn) {
  const ch = cp.spawn(cmd, args, { detached: true, stdio: 'ignore' });
  try {
    for (let i = 0; i < 100 && !pgrepF(mark).includes(String(ch.pid)); i++) await new Promise((r) => setTimeout(r, 20));
    assert.ok(pgrepF(mark).includes(String(ch.pid)), `★전제: ${mark} 프로세스가 안 떴다(이게 빨강이면 아래는 「안 쟀다」)`);
    return fn(ch.pid);
  } finally { process.kill(-ch.pid); }
}

test('P1 ★레포 *.sh 에 pgrep -f 호출 0 — 양성: 그 꼴 글자는 걸린다 · 주석은 안 걸린다', () => {
  assert.equal(pgrepFLines('for p in $(pgrep -f playwright); do\n'), 1);
  assert.equal(pgrepFLines('n=$(pgrep -lf x)\n'), 1);
  assert.equal(pgrepFLines('# pgrep -f x\npgrep -x node\npgrep -P 1\n'), 0);
  const files = ['tools', 'scripts', 'tests'].flatMap((d) => shFiles(path.join(ROOT, d)));
  const hits = files.filter((f) => pgrepFLines(fs.readFileSync(f, 'utf8')) > 0).map((f) => path.relative(ROOT, f));
  console.log(`  [300] *.sh ${files.length} · pgrep -f 든 파일 ${hits.length}`);
  assert.deepEqual(hits, []);
});
for (const [shell, rel] of SCRIPTS) {
  test(`P2 ★미끼 셸에 0 · 같은 미끼에 pgrep -f 는 걸린다 — ${rel}`, { skip }, async () => {
    const mark = `gd300bait${process.pid}`;
    await withProc('bash', ['-c', `sleep 20; : ${mark}`], mark, (pid) => {
      assert.ok(pgrepF(mark).includes(String(pid)), '★옛 자가 미끼를 안 세면 이 시험은 아무것도 못 가른다');
      assert.deepEqual(procsLike(shell, rel, mark), [], '글자만 든 셸을 프로세스로 셌다');
    });
  });
  test(`P3 ★진짜 프로세스에 ≥1(그 pid) — ${rel}`, { skip }, async () => {
    const mark = `gd300real${process.pid}`;
    await withProc(process.execPath, ['-e', 'setTimeout(()=>{},20000)', mark], mark, (pid) => {
      assert.deepEqual(procsLike(shell, rel, mark), [String(pid)], '진짜 프로세스를 못 셌다');
    });
  });
}
