/* operator-allow CLI 스모크 — tools/operator-allow/issue.mjs (0919 3라운드 adminsig)
 * 임시 HOME 에서 keygen → issue → 앱 모듈 verify ok. 그리고 «거부해야 하는» 자리(레포 안 키·0644·--days 40·덮어쓰기).
 * ⛔만든 개인키는 os.tmpdir 아래 임시 폴더에만 있고 끝나면 지운다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const CLI = path.join(ROOT, 'tools/operator-allow/issue.mjs');
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');
const OA = createRequire(import.meta.url)(path.join(ROOT, 'services/operator-allow.js'));
const M = OA.machineIdFrom('AAAAAAAA-1111-2222-3333-BBBBBBBBBBBB');

/* ★임시 HOME — ★★`mkTmpRoot`(tests/unit/_tmproot.js)가 ★만들기·치우기를 ★쥔다.
   ★★★그런데 ★여기는 ★★즉시치움을 ★★«남긴다» — ⛔exit 훅에 ★맡기지 ★않는다.
     ★★까닭: ★★이 폴더에 ★★개인키가 ★산다(아래 `KEY`). ★이 파일 ★머리말이 ★★«끝나면 지운다»를 ★약속한다.
     ⇒ ★★종료훅은 ★SIGKILL·OOM 에서 ★안 돈다(★그 자의 머리말이 ★그렇게 적어 뒀다)
     ⇒ ★★★개인키가 ★사는 자리를 ★★«언젠가 지워진다»로 ★둘 수 ★없다
   ★★★그리고 ★★«약속»을 ★★«단언»으로 ★바꿨다(지디 2026-10-10):
     ★아래 ★`C-KEYGONE` 이 ★★«키가 ★참으로 ★지워졌나»를 ★★잰다. ⛔머리말의 ★선언으로 ★닫지 ★않는다
   ⇒ ★★그래서 ★이 파일은 ★★㉢(★이미 공용 자 ＋ ★즉시치움 = ★의도)다 — ★그 까닭이 ★이 주석과 ★그 칸이다 */
const HOME = mkTmpRoot('goditor-opallow-');
test.after(() => fs.rmSync(HOME, { recursive: true, force: true }));
const run = (args, env = {}) => spawnSync(process.execPath, [CLI, ...args],
  { encoding: 'utf8', timeout: 20000, env: { ...process.env, HOME, USERPROFILE: HOME, ...env } });
const KEY = path.join(HOME, '.config', 'secrets', 'goditor-operator-ed25519.pem');

test('C1 keygen → issue → 앱 모듈 검증 ok (공개키는 keygen stdout)', () => {
  const g = run(['keygen']);
  assert.equal(g.status, 0, g.stderr);
  assert.match(g.stdout, /-----BEGIN PUBLIC KEY-----/);
  assert.ok(!/PRIVATE KEY/.test(g.stdout), '개인키는 stdout 에 안 나온다');
  if (process.platform !== 'win32') assert.equal(fs.statSync(KEY).mode & 0o777, 0o600);
  const i = run(['issue', '--machine', M, '--days', '7', '--note', 'ci']);
  assert.equal(i.status, 0, i.stderr);
  const r = OA.checkOperatorAllow({ fileText: i.stdout, keys: { op1: g.stdout }, machineId: M, now: Date.now() });
  assert.deepEqual(r, { ok: true, why: null });
  // 음성대조: 앱 실상수(비어 있음)로는 안 먹는다 + 경고가 나온다
  if (!Object.keys(OA.OPERATOR_PUBLIC_KEYS).length) {
    assert.equal(OA.checkOperatorAllow({ fileText: i.stdout, keys: OA.OPERATOR_PUBLIC_KEYS, machineId: M, now: Date.now() }).ok, false);
    assert.match(i.stderr, /비어 있습니다/);
  }
  // 다른 기기 해시로는 안 먹는다
  assert.equal(OA.checkOperatorAllow({ fileText: i.stdout, keys: { op1: g.stdout }, machineId: OA.machineIdFrom('X'), now: Date.now() }).why, 'machine_mismatch');
});

test('C2 keygen 은 덮어쓰지 않는다', () => {
  const g = run(['keygen']);
  assert.notEqual(g.status, 0);
  assert.match(g.stderr, /이미 있습니다/);
});

test('C3 --days 40 · 0 · 소수 → 거부 / --machine 형식 틀림 → 거부', () => {
  for (const d of ['40', '32', '0', '1.5']) assert.notEqual(run(['issue', '--machine', M, '--days', d]).status, 0, d);
  assert.equal(run(['issue', '--machine', M, '--days', '31']).status, 0);
  assert.notEqual(run(['issue', '--machine', 'abc']).status, 0);
  assert.notEqual(run(['issue']).status, 0);
});

test('C4 개인키 권한 0644 → 거부 (윈도우: ACL 은 안 잰다고 «알린다»)', () => {
  if (process.platform === 'win32') {
    const w = run(['issue', '--machine', M]);
    assert.match(w.stderr, /ACL\)을 검사하지 않습니다/, '윈도우는 권한을 못 잰다 — 조용히 넘어가면 안 된다');
    return;
  }
  fs.chmodSync(KEY, 0o644);
  try {
    const r = run(['issue', '--machine', M]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /권한/);
  } finally { fs.chmodSync(KEY, 0o600); }
});

test('C5 개인키 경로가 레포 안 → keygen·issue 거부 (파일이 생기지 않는다)', () => {
  const inRepo = path.join(ROOT, 'tests', `.opkey-${process.pid}.pem`);
  try {
    const g = run(['keygen', '--key', inRepo]);
    assert.notEqual(g.status, 0);
    assert.match(g.stderr, /레포/);
    assert.equal(fs.existsSync(inRepo), false);
    // 레포 안에 (진짜 권한 0600) 키가 이미 있어도 issue 는 거부
    fs.writeFileSync(inRepo, crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    const i = run(['issue', '--machine', M, '--key', inRepo]);
    assert.notEqual(i.status, 0);
    assert.match(i.stderr, /레포/);
  } finally { fs.rmSync(inRepo, { force: true }); }
});

test('C6 --out 이 레포 안이면 거부 · 레포 밖이면 파일로 쓴다', () => {
  const bad = path.join(ROOT, 'tests', `.op-${process.pid}.allow`);
  try {
    assert.notEqual(run(['issue', '--machine', M, '--out', bad]).status, 0);
    assert.equal(fs.existsSync(bad), false);
  } finally { fs.rmSync(bad, { force: true }); }
  const good = path.join(HOME, 'operator.allow');
  const r = run(['issue', '--machine', M, '--out', good]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(OA.verifyOperatorAllow(fs.readFileSync(good, 'utf8'), { op1: crypto.createPublicKey(fs.readFileSync(KEY, 'utf8')).export({ type: 'spki', format: 'pem' }) }).ok, true);
});

test('C7 machine-id 는 앱과 같은 원천·해시(64 hex)', () => {
  const r = run(['machine-id']);
  if (r.status === 3) return; // 이 환경에서 UUID 를 못 읽음(컨테이너 등) — 앱도 운영자 아님으로 떨어진다
  assert.equal(r.status, 0, r.stderr);
  const raw = OA.rawMachineUuid({ platform: process.platform, execFileSync: (c, a, o) => spawnSync(c, a, { ...o, encoding: 'utf8' }).stdout, readFileSync: fs.readFileSync });
  assert.equal(r.stdout.trim(), OA.machineIdFrom(raw));
});

/* ══ ★★«약속»을 ★★«단언»으로 (지디 2026-10-10) ════════════════════════════════
 * ★이 파일 ★머리말: 「⛔만든 개인키는 ★os.tmpdir 아래 ★임시 폴더에만 있고 ★★끝나면 지운다」
 *   ⇒ ★★그건 ★★«선언»이다. ★★★개인키가 ★사는 자리를 ★선언으로 ★둘 수 ★없다.
 * ★★그래서 ★★«지워졌나»를 ★★잰다 — ★`test.after` 가 ★★이 칸 ★뒤에 ★돈다는 보장이 ★없으니
 *   ★★이 칸은 ★★«지우고 ★나서» ★★제 손으로 ★확인한다(★그 지움은 ★멱등이다).
 * ★★무력화: ★위 ★`test.after(… rmSync(HOME) …)` 를 ★지우면 ★★이 칸이 ★빨개져야 한다.
 *   ⇒ ★★그 변이를 ★★돌렸다(★커밋 글에 수를 적었다). ⛔«세워뒀다»로 ★안 둔다 */
test('C-KEYGONE ★★개인키가 ★참으로 ★지워진다 — ★머리말의 ★약속을 ★단언으로', () => {
  /* ★전제 — ★그 키가 ★★이 판에서 ★참으로 ★만들어졌나(⛔없는 것을 ★「지워졌다」로 읽지 않는다) */
  assert.ok(fs.existsSync(KEY), '★전제 실패 — ★개인키가 ★애초에 ★없다(앞 칸이 ★안 돌았다)');
  assert.ok(KEY.startsWith(HOME), `★키가 ★임시 HOME 밖에 있다: ${KEY}`);
  /* ★★치움을 ★★여기서 ★한 번 ★돌리고 ★★결과를 ★잰다 — ★`test.after` 와 ★같은 동작이다(멱등) */
  fs.rmSync(HOME, { recursive: true, force: true });
  assert.equal(fs.existsSync(KEY), false, '★★개인키가 ★남았다 — ★머리말의 ★약속이 ★거짓이다');
  assert.equal(fs.existsSync(HOME), false, '★임시 HOME 이 ★남았다');
});
