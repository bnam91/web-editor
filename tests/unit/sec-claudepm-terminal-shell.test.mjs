/* sec-claudepm-terminal-shell — SEC-MALICIOUS-PROJECT-FILE-SANDBOX-01 ① «재현» (지디 발주 261112 · Codex 정적 감사 ①)
 *   main/claude-pm/ipc.js spawnClaudeTerminal 은 폴더 경로를 `cd "<경로>" && claude` 셸 문자열에 «큰따옴표로» 보간한다
 *   (큰따옴표만 \" 로 막는다). 큰따옴표 안에서도 $( ) 와 백틱은 셸이 «실행»한다.
 *   ★자 = 그 줄의 템플릿을 «소스에서 그대로» 떼어(손으로 베끼지 않는다) 경로 `<tmp>/d$(touch <표식>)` 로 명령을 만들고,
 *     `&& claude` 만 `&& true` 로 바꿔 /bin/sh -c 로 돌린다(실앱은 osascript → Terminal 의 셸 — 같은 확장 규칙).
 *   ⛔해 없음: 하는 일은 임시 루트 안 «표식 파일 하나 만들기» 뿐 · 앱·osascript·claude 는 안 띄운다.
 *   ★지금(aded4a28a) 빨강 = 결함 재현 · 고친 뒤(경로를 셸 문자열에 안 넣음 · cwd/인자 배열) 초록.
 *   ⚠️고침이 «그 줄 자체를 없애면» R0 이 «못 찾았다»로 빨강 — 그때는 이 칸을 새 꼴(인자 배열)을 재는 칸으로 바꿔라(재현 칸의 수명).
 *   조건(감사): admin 실행 인자 + main 관리자 판정을 통과해야 렌더러가 부를 수 있다 — 이 칸은 «통과했다면» 실행된다를 잰다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'main', 'claude-pm', 'ipc.js'), 'utf8');

test('R0 [전제] spawnClaudeTerminal 의 «cd "${경로}" && claude» 템플릿 줄을 소스에서 찾는다', () => {
  assert.match(SRC, /const cmd = `cd "\$\{expanded\.replace\(\/"\/g, '\\\\"'\)\}" && claude`;/,
    '그 줄이 없다 — 고쳤다면 이 재현 칸을 새 꼴을 재는 칸으로 바꿔라');
});

test('R1 ★폴더 이름의 $( ) 가 셸에서 실행되지 않는다', { skip: process.platform === 'win32' && 'POSIX sh 전용' }, () => {
  const m = SRC.match(/const cmd = (`cd "\$\{expanded\.replace\(\/"\/g, '\\\\"'\)\}" && claude`);/);
  assert.ok(m, 'R0 전제 실패');
  const build = new Function('expanded', `return ${m[1]};`);      // ★소스의 템플릿 그대로
  const dir = mkTmpRoot('sec-shell-');
  const mark = path.join(dir, 'PWNED');
  const evil = path.join(dir, `d$(touch ${mark})`);
  const cmd = build(evil).replace(/&& claude$/, '&& true');
  spawnSync('/bin/sh', ['-c', cmd], { stdio: 'ignore' });
  assert.equal(fs.existsSync(mark), false, `★폴더 이름 속 $( ) 가 실행됐다 — 표식 ${mark} 생김 · 명령: ${cmd}`);
});
