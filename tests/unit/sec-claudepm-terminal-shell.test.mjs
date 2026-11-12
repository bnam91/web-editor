/* sec-claudepm-terminal-shell — SEC-CLAUDEPM-SHELL-INTERP-01 (Codex 감사 ① · 현빈 GO 261112)
 *   옛 결함: spawnClaudeTerminal 이 폴더 경로를 `cd "<경로>" && claude` 셸 문자열에 «큰따옴표로» 넣었다 →
 *     큰따옴표 안 $( )·백틱이 실행됐다(인텔 c323ee3df: 표식 생김 · 이 파일의 옛 «알려진 결함» 꼴이 그걸 단언했다).
 *   고침(main/claude-pm/ipc.js _terminalLaunch): darwin = 작은따옴표 + osascript argv · win32/linux = cwd + 고정 인자.
 *   ★진짜 _terminalLaunch 를 플랫폼마다 부른다(셸을 안 띄우는 K1 은 어디서나 · 실제 /bin/sh 로 도는 K2 는 POSIX 에서만 «만든다» — skip 아님).
 *   R1 [양성대조 · 자] 옛 꼴 문자열은 해석기가 «실행 자리»로 잡는다 — 해석기가 죽어서 K1 이 초록인 게 아니다.
 *   가드 되돌림: ipc.js 의 darwin sh 를 큰따옴표 꼴로 되돌리면 K1·K2 빨강 · cwd 대신 문자열 보간으로 되돌리면 K1w 빨강. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { mkTmpRoot } = require('./_tmproot.js');
const { _terminalLaunch } = require('../../main/claude-pm/ipc.js');

/** POSIX sh 따옴표 규칙으로 «명령 치환이 살아 있는 자리»에 $( 또는 ` 가 있나. */
function hasLiveSubstitution(cmd) {
  let q = null;                                   // null | "'" | '"'
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q === "'") { if (c === "'") q = null; continue; }          // 작은따옴표 안 = 전부 글자
    if (c === '\\') { i++; continue; }                               // 따옴표 밖·큰따옴표 안의 \ 는 다음 글자를 글자로
    if (c === "'" && q === null) { q = "'"; continue; }
    if (c === '"') { q = q === '"' ? null : '"'; continue; }
    if (c === '`' || (c === '$' && cmd[i + 1] === '(')) return true;  // 따옴표 밖 · 큰따옴표 안 = 실행
  }
  return false;
}
const EVIL = "/tmp/proj/it's d$(touch PWNED)`id`";

test('R0 [전제] ipc.js 가 _terminalLaunch 를 내보낸다', () => {
  assert.equal(typeof _terminalLaunch, 'function');
});

test('R0b [자 음성·양성] 해석기가 큰따옴표 안 $( ) 는 «실행», 작은따옴표 안은 «글자»로 읽는다', () => {
  assert.equal(hasLiveSubstitution('cd "/x$(id)" && true'), true);
  assert.equal(hasLiveSubstitution('cd "/x`id`" && true'), true);
  assert.equal(hasLiveSubstitution("cd '/x$(id)' && true"), false);
  assert.equal(hasLiveSubstitution('cd "/x\\$(id)" && true'), false);
});

test('R1 [양성대조 · 자] 옛 꼴(`cd "${경로}" && claude` · 큰따옴표만 이스케이프)은 실행 자리로 잡힌다', () => {
  const old = `cd "${EVIL.replace(/"/g, '\\"')}" && claude`;
  assert.equal(hasLiveSubstitution(old), true);
});

test('K1 darwin — 폴더 이름의 $( )·백틱·작은따옴표가 실행 자리에 안 들어간다 · 경로는 osascript 의 마지막 argv 하나뿐', () => {
  const L = _terminalLaunch('darwin', EVIL);
  assert.equal(L.cmd, 'osascript');
  assert.equal(hasLiveSubstitution(L.sh), false, `★실행 자리 — ${L.sh}`);
  assert.equal(L.args[L.args.length - 1], L.sh, 'sh 는 argv 로 넘긴다');
  assert.ok(L.args.slice(0, -1).every((a) => !a.includes('PWNED')), '★AppleScript 문장 안에 경로가 들어갔다');
});

test('K1w win32·linux — 경로는 cwd 로만, 명령 인자에 안 들어간다', () => {
  for (const p of ['win32', 'linux']) {
    const L = _terminalLaunch(p, EVIL);
    assert.equal(L.opts.cwd, EVIL, p);
    assert.ok(L.args.every((a) => !a.includes('PWNED') && !a.includes('/tmp/proj')), `★${p} 인자에 경로가 들어갔다: ${JSON.stringify(L.args)}`);
  }
});

/* K2 는 /bin/sh 가 있는 곳에서만 «만든다»(없는 칸 · win-portability ③-3). 진짜 폴더(이름에 $( )·백틱·' ·공백)를 만들고
   darwin 이 Terminal 에 줄 그 문자열을 실제 sh 로 돌린다(claude → pwd) — 표식 0 + 그 폴더로 «들어갔다»(정상 경로). */
if (fs.existsSync('/bin/sh')) test('K2 실제 /bin/sh — 표식이 안 생기고, 이상한 이름의 폴더로 정상 진입한다 (POSIX)', () => {
  const root = mkTmpRoot('sec-shell-');
  const dir = path.join(root, "it's d$(touch PWNED)`touch PWNED2` x");
  fs.mkdirSync(dir);
  const sh = _terminalLaunch('darwin', dir).sh.replace(/&& claude$/, '&& pwd -P');
  const r = spawnSync('/bin/sh', ['-c', sh], { cwd: root, encoding: 'utf8' });
  for (const m of ['PWNED', 'PWNED2']) {
    assert.equal(fs.existsSync(path.join(root, m)) || fs.existsSync(path.join(dir, m)), false, `★폴더 이름 속 명령이 실행됐다 — ${m} · ${sh}`);
  }
  assert.equal(r.stdout.trim(), fs.realpathSync(dir), `정상 진입 실패 · ${r.stderr}`);
});
