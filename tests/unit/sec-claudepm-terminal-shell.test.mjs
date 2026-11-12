/* sec-claudepm-terminal-shell — SEC-MALICIOUS-PROJECT-FILE-SANDBOX-01 ① (지디 발주 261112 · Codex 정적 감사 ①)
 *   main/claude-pm/ipc.js spawnClaudeTerminal 은 폴더 경로를 `cd "<경로>" && claude` 셸 문자열에 «큰따옴표로» 보간한다
 *   (큰따옴표만 \" 로 막는다). 큰따옴표 안에서도 $( ) 와 백틱은 셸이 «실행»한다. (인텔 c323ee3df: 실행 확인 — 표식 생김)
 *
 * ★★«알려진 결함» 꼴이다 — 레포 관례(tests/dom/grid-save-export-axes E4 의 test.fail · tests/unit/grid-picked-image-entrances 의
 *   KNOWN_GAP)를 node:test 에 맞춰: 이 칸들은 «지금 결함이 있다»를 단언해 «초록»이다(단위 전수를 빨강으로 두어 다른 빨강을 가리지 않게).
 *   ⇒ ①을 고치는 날 K1·K2 가 «예상 밖으로» 빨개진다 = 고쳐졌다는 알림. 그때 KNOWN_SHELL_INJECTION 을 false 로 바꿔라(단언이 뒤집혀 «안전»을 지킨다).
 *   ⛔test.todo / skip 으로 두지 않는다 — 안 도는 칸은 고쳐졌는지도 되돌아왔는지도 모른다(win-portability ③-3 «skip 은 초록이 아니다»).
 *
 * ★자 둘:
 *   K1 [모든 플랫폼] 소스의 템플릿을 «그대로» 떼어(손으로 베끼지 않는다) 경로 `…/d$(touch 표식)` 로 명령 문자열을 만들고,
 *      POSIX 셸 따옴표 규칙으로 «$( ) 나 백틱이 실행되는 자리(따옴표 밖·큰따옴표 안)에 있나»를 읽는다 — 셸을 안 띄워 윈도우에서도 돈다.
 *   K2 [POSIX 에서 더 세게] 같은 명령(claude→true)을 /bin/sh -c 로 실제로 돌려 임시 루트에 표식이 생기나 본다(해: 표식 파일 하나).
 *      윈도우엔 /bin/sh 가 없고 제품 길도 darwin 갈래뿐이라 K2 는 POSIX 에서만 «덧붙인다»(K1 은 어디서나 돈다 — 건너뛰는 칸 0).
 *   조건(감사): admin 실행 인자 + main 관리자 판정을 통과해야 렌더러가 부를 수 있다 — 이 칸은 «통과했다면» 실행된다를 잰다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { mkTmpRoot } = createRequire(import.meta.url)('./_tmproot.js');

/* ★①을 고치면 false 로 — 그 뒤로 K1·K2 는 «실행되지 않는다»를 지킨다 */
const KNOWN_SHELL_INJECTION = true;

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'main', 'claude-pm', 'ipc.js'), 'utf8').replace(/\r\n/g, '\n');
const TPL_RE = /const cmd = (`cd "\$\{expanded\.replace\(\/"\/g, '\\\\"'\)\}" && claude`);/;

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
const buildCmd = (evil) => new Function('expanded', `return ${SRC.match(TPL_RE)[1]};`)(evil);   // ★소스의 템플릿 그대로

test('R0 [전제] spawnClaudeTerminal 의 «cd "${경로}" && claude» 템플릿 줄을 소스에서 찾는다', () => {
  assert.match(SRC, TPL_RE, '그 줄이 없다 — ①을 고쳐 꼴이 바뀌었다면 K1·K2 를 새 꼴(인자 배열·작은따옴표 이스케이프)을 재는 칸으로 바꿔라');
});

test('R0b [자 양성·음성대조] 해석기가 큰따옴표 안 $( ) 는 «실행», 작은따옴표 안은 «글자»로 읽는다', () => {
  assert.equal(hasLiveSubstitution('cd "/x$(id)" && true'), true);
  assert.equal(hasLiveSubstitution('cd "/x`id`" && true'), true);
  assert.equal(hasLiveSubstitution("cd '/x$(id)' && true"), false);
  assert.equal(hasLiveSubstitution('cd "/x\\$(id)" && true'), false);
});

test(`K1 ${KNOWN_SHELL_INJECTION ? '★알려진 결함 ① — 폴더 이름의 $( ) 가 «실행되는 자리»에 들어간다(고치면 이 칸이 빨개진다)' : '폴더 이름의 $( ) 가 실행되는 자리에 안 들어간다'}`, () => {
  const cmd = buildCmd('/tmp/proj/d$(touch PWNED)');
  assert.equal(hasLiveSubstitution(cmd), KNOWN_SHELL_INJECTION,
    KNOWN_SHELL_INJECTION ? `★예상 밖 — 더는 실행 자리가 아니다(①이 고쳐졌나?) → KNOWN_SHELL_INJECTION=false 로 뒤집어라 · 명령: ${cmd}`
                          : `★폴더 이름 속 $( ) 가 셸에서 실행된다 · 명령: ${cmd}`);
});

/* K2 는 /bin/sh 가 있는 곳에서만 «만든다»(건너뛰는 칸이 아니라 없는 칸 — 윈도우의 축은 K1 이 잰다 · 제품 길도 darwin 갈래뿐). */
if (fs.existsSync('/bin/sh')) test(`K2 ${KNOWN_SHELL_INJECTION ? '★알려진 결함 ① — 실제 /bin/sh 에서 표식이 생긴다' : '실제 /bin/sh 에서 표식이 안 생긴다'} (POSIX 에서 더 세게)`, () => {
  const dir = mkTmpRoot('sec-shell-');
  const mark = path.join(dir, 'PWNED');
  const cmd = buildCmd(path.join(dir, `d$(touch ${mark})`)).replace(/&& claude$/, '&& true');
  spawnSync('/bin/sh', ['-c', cmd], { stdio: 'ignore' });
  assert.equal(fs.existsSync(mark), KNOWN_SHELL_INJECTION,
    KNOWN_SHELL_INJECTION ? `★예상 밖 — 표식이 안 생겼다(①이 고쳐졌나?) → KNOWN_SHELL_INJECTION=false · 명령: ${cmd}`
                          : `★폴더 이름 속 $( ) 가 실행됐다 — 표식 ${mark} · 명령: ${cmd}`);
});
