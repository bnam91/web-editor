/* touch-guard.test.mjs — ★307 TOUCH-GUARD-MISSES-NEW-ENTRIES-STRUCTURALLY-01 · tools/touch-guard.py 가 «이름» 집합 차를 실제로 내나 (S6 · 261031 · 지디 NINEINTEL ⑥)
 * ★왜: 무접촉 가드 ㉢ 가 mtime 창만 봐 «런 전 값» 이 없었다 ⇒ 새 항목을 구조로 놓쳤다 · 자가 한 맥의 레인 폴더에만 살았다.
 * ★자: python 으로 도구를 불러 rc·글을 본다. ⛔임시 나무에만 쓴다 — 라이브 거절 칸도 TOUCH_GUARD_FORBID 로 임시 자리를 가리킨다(자가 죽어도 라이브에 안 쓰게).
 * ⚠️자 한계를 TG1 이 값으로 잠근다: 심링크 안 따라감 · 내용 안 봄(크기·mtime 그대로면 0건) · 나무 하나 · 앞뒤 두 점.
 * ★python 이 없는 맥(release-win.yml npm test)은 이름 있는 SKIP — TG6 이 python 을 숨긴 판에서 그 SKIP 이 실제로 나는지 잰다.
 * ★부르는 자 = tools/slots/touch-guard-slot.sh — TG5 가 그 슬롯이 이 도구를 실제로 부르는지 행위로 잰다(부름 줄을 끄면 빨강). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const TOOL = path.join(ROOT, 'tools', 'touch-guard.py');
const SLOT = path.join(ROOT, 'tools', 'slots', 'touch-guard-slot.sh');
const SELF = fileURLToPath(import.meta.url);
const PY = ['python3', 'python'].find((c) => spawnSync(c, ['--version'], { encoding: 'utf8' }).status === 0);
const NO_PY = '⚠️python 없음 — touch-guard 를 못 잰다(통과 아님 · 이 맥의 이름 있는 건너뜀)';
const py = { skip: PY ? false : NO_PY };
const ENV = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
const tg = (args, env = ENV) => { const r = spawnSync(PY, ['-I', TOOL, ...args], { encoding: 'utf8', env }); return { rc: r.status, out: String(r.stdout) + String(r.stderr) }; };
function scene() {
  const tmp = mkTmpRoot('touch-guard-');
  const tree = path.join(tmp, 'tree');
  fs.mkdirSync(path.join(tree, 'd'), { recursive: true });
  fs.writeFileSync(path.join(tree, 'd', 'f.txt'), 'x');
  return { tmp, tree, snap: path.join(tmp, 'before.json') };
}

test('TG1 ★한 쌍 — selftest: 음성 0건 · 양성 ⒜더하기 ⒝지우기 ⒞수 그대로 이름만 ⒞깊이 · 한계 둘 값', py, () => {
  const r = tg(['selftest', mkTmpRoot('touch-guard-self-')]);
  assert.equal(r.rc, 0, r.out);
  assert.match(r.out, /BAD 0/);
  assert.doesNotMatch(r.out, /^BAD /m, r.out);
  assert.match(r.out, /^OK {2}음성 아무것도 안 바꿈 · 변경 0건/m);
  assert.match(r.out, /^OK {2}양성⒜ .*더해짐 \['new\.txt'\]/m);
  assert.match(r.out, /^OK {2}양성⒝ .*지워짐 \['new\.txt'\]/m);
  assert.match(r.out, /^OK {2}양성⒞ 수 그대로 .*⒥다름 ⒦같음/m);
  /* ★⒞깊이 — 맨 위 폴더 mtime 도 수도 같은데 이름으로만 잡힌다(mtime 만 · 수만 보는 자가 놓치는 칸) */
  assert.match(r.out, /^OK {2}양성⒞깊이 .*변경 있음 .*⒤같음 ⒥다름 ⒦같음/m);
  assert.match(r.out, /^OK {2}한계 내용만 .*변경 0건/m);
});
test('TG2 ★CLI — 런 앞뒤: 안 바꾸면 rc 0 · 새 항목은 rc 1 ＋ 그 이름', py, () => {
  const s = scene();
  assert.equal(tg(['snap', s.tree, s.snap]).rc, 0);
  const clean = tg(['diff', s.tree, s.snap]);
  assert.equal(clean.rc, 0, clean.out);
  fs.writeFileSync(path.join(s.tree, 'd', 'new-entry.txt'), 'y');
  const dirty = tg(['diff', s.tree, s.snap]);
  assert.equal(dirty.rc, 1, dirty.out);
  assert.match(dirty.out, /더해짐 1\n {2}d\/new-entry\.txt/);
});
test('TG3 rc 2 = 못 쟀다(0 이라 말하지 않는다) — 나무 안에 찍기 · 덮어쓰기 · 다른 나무 · 못 읽는 폴더', py, (t) => {
  const s = scene();
  assert.equal(tg(['snap', s.tree, path.join(s.tree, 'in.json')]).rc, 2);
  assert.equal(fs.existsSync(path.join(s.tree, 'in.json')), false, '나무 안에 썼다');
  assert.equal(tg(['snap', s.tree, s.snap]).rc, 0);
  assert.equal(tg(['snap', s.tree, s.snap]).rc, 2, '찍은 값을 덮어썼다');
  const other = path.join(s.tmp, 'other'); fs.mkdirSync(other);
  assert.equal(tg(['diff', other, s.snap]).rc, 2);
  if (process.platform === 'win32' || process.getuid?.() === 0) return t.diagnostic('chmod 칸 안 잼(win32 · root)');
  const locked = path.join(s.tree, 'locked'); fs.mkdirSync(locked); fs.chmodSync(locked, 0o000);
  try {
    assert.equal(tg(['diff', s.tree, s.snap]).rc, 2, '못 읽는 폴더를 0 이나 변경으로 말했다');
  } finally { fs.chmodSync(locked, 0o755); }
});
test('TG4 ★라이브 거절 — selftest 는 금지 자리 아래에 임시 나무를 안 만든다(TOUCH_GUARD_FORBID 로 임시 자리를 가리켜 잰다)', py, () => {
  const forbid = mkTmpRoot('touch-guard-forbid-');
  const r = tg(['selftest', forbid], { ...ENV, TOUCH_GUARD_FORBID: forbid });
  assert.match(r.out, /라이브 안에 임시 나무를 못 만든다/, `거절이 아니다(도구가 없어도 rc≠0 이라 rc 로는 못 가른다 · 첫 판 흠) · ${r.out}`);
  assert.deepEqual(fs.readdirSync(forbid), [], `금지 자리에 썼다 · ${r.out}`);
});
const BASH = spawnSync('bash', ['--version'], { encoding: 'utf8' }).status === 0;
test('TG5 ★부르는 자 — 슬롯이 런 앞뒤로 도구를 부른다: 명령 rc 를 돌려주고 · 새 항목은 rc 6 ＋ 이름', { skip: PY && BASH ? false : NO_PY }, () => {
  const s = scene();
  const run = (name, ...cmd) => {
    const r = spawnSync('bash', [SLOT, ...cmd], { encoding: 'utf8', env: { ...ENV, SLOT_TREE: s.tree, SLOT_OUT: path.join(s.tmp, name) } });
    return { rc: r.status, out: String(r.stdout) + String(r.stderr) };
  };
  const passthrough = run('a', process.execPath, '-e', 'process.exit(3)');
  assert.equal(passthrough.rc, 3, `명령 rc 를 안 돌려줬다 · ${passthrough.out}`);
  assert.match(passthrough.out, /더해짐 0/, '슬롯이 런 뒤 diff 를 안 불렀다');
  const dirty = run('b', process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(path.join(s.tree, 'd', 'by-run.txt'))}, 'z')`);
  assert.equal(dirty.rc, 6, `런이 나무에 쓴 것을 슬롯이 못 봤다 · ${dirty.out}`);
  assert.match(dirty.out, /d\/by-run\.txt/);
});
/* ★python 을 숨기면 빨강이 아니라 이름 있는 SKIP. 자식은 이 칸을 다시 안 돈다. */
test('TG6 ★python 숨긴 판 — TG1~TG5 가 이름 있는 SKIP 으로 간다(rc 0 · fail 0)', { skip: !PY || process.env.TG307_CHILD === '1' ? '자식 판 또는 python 없음' : false }, () => {
  const { NODE_TEST_CONTEXT: _nested, ...env } = process.env;   // 자식은 --test 안 쓴 맨 실행(node:test 재귀 금지 경고 회피)
  const r = spawnSync(process.execPath, [SELF], { encoding: 'utf8', env: { ...env, PATH: path.join(path.sep, 'no-such-path-307'), Path: path.join(path.sep, 'no-such-path-307'), TG307_CHILD: '1' } });
  const out = String(r.stdout) + String(r.stderr);
  assert.equal(r.status, 0, out);
  assert.ok(out.includes(NO_PY), `★이름 있는 SKIP 글이 안 나왔다 · ${out}`);
  assert.match(out, /skipped 6/, out);
  assert.match(out, /fail 0/, out);
});
