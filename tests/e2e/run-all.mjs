/* run-all.mjs — small5 카드 검사를 차례로 돌리고 한 장으로 적는다.
 *
 * ★여기 «있는 것»만 담는다 (2026-09-22 저장소로 들일 때 지디 지시)
 *   check-t085 · check-t093 · check-t097 · check-t099 — 넷.
 * ⛔check-t064(duplicate-planning) · check-t080(success-notice) 은 «일부러» 안 들였다.
 *   그 둘의 빨간 줄은 결함이 아니라 «현빈 결정 대기»다 —
 *     · t080 = ⌘G 가 «성공»했을 때 「몇 개를 묶었다」고 알릴 것인가 (지금은 실패 때만 알린다)
 *     · t064 = 기획 모드를 켤 것인가 (PLAN_MODE_ENABLED=false 의 딸림)
 *   결정 안 난 것을 검사로 들이면 «늘 빨간 판»이 서고, 다음 사람이 그 빨강을 «배경»으로 읽어
 *   진짜 빨강이 났을 때 못 본다.
 *   ★두 파일은 scratchpad/eval-small5/ 에 그대로 있다 — 현빈 결정이 나면 그때 들인다.
 *
 * 쓰는 법:  npm run test:cdp:small5 -- [port]     (저장소 뿌리에서 · 기본 9531)
 *           = node tests/e2e/run-all.mjs [port]
 *   앱은 «격리 프로필»로 띄운 뒤에 돌린다:
 *     electron . --remote-debugging-port=<port> --remote-allow-origins='*' \
 *                --user-data-dir=<격리폴더> --disable-renderer-backgrounding \
 *                --disable-background-timer-throttling --disable-backgrounding-occluded-windows admin
 *   ★띄운 «직후» 로그에서 「[projects] 뿌리=…」가 격리폴더인지 확인해라.
 *     ~/Library/Application Support/GODITOR 면 현빈 실계정이다 — 즉시 끄고 다시 띄운다.
 *   ★끝나면 끈다:  pkill -9 -f -- '--user-data-dir=<네 프로필 절대경로>'  → 그 폴더째 삭제.
 *     ★★⛔«프로필 이름만»으로 잡지 마라(`pkill -9 -f 'ud-9533'`) — 그 문자열이 «너를 띄운 셸의
 *       명령줄»에도 들어 있으면 «검사 자신»이 같이 죽는다. 2026-09-22 실측: 되돌리기 e2e 가
 *       세 판을 그렇게 날렸고, 그 exit 144(SIGTERM)를 「빨강마다 멈춘다」로 잘못 읽고 있었다.
 *       `--user-data-dir=` 는 «앱만» 갖는 인자라 남의 앱도, 너 자신도 안 걸린다.
 *     ⛔포트 «접두사»로 잡지 마라 — `pkill -f 'remote-debugging-port=953'` 이 9533·9534 와
 *       «함께 9535» 를 죽여 다른 워커의 계측을 끊었다(2026-09-22 실측). 프로필 경로는
 *       «네 실행에만» 있으므로 그 사고가 «구조적으로» 안 난다.
 *
 * 판정 읽는 법:
 *   pass=false  → 그 카드가 «아직 그대로»다(고쳐야 할 자리).
 *   pass=null   → «못 잼». ⛔통과로 읽지 마라.
 *   …/control-… · …/instrument-positive · …/neighbor 는 «검사가 멀쩡한지»를 재는 줄이다.
 *     이 줄들이 초록이어야 위의 빨강을 믿을 수 있다.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.argv[2] || '9531';
const FILES = ['check-t085.mjs', 'check-t093.mjs', 'check-t097.mjs', 'check-t099.mjs'];

/* ⛔목록에 «없는 파일»을 부르면 그 카드가 조용히 사라진다 — 「못 잼」이 「통과」로 새는 길이다.
   그래서 돌기 «전»에 전부 있는지 보고, 하나라도 없으면 «판을 세우지 않고» 터진다. */
const _missing = FILES.filter((f) => !existsSync(path.join(HERE, f)));
if (_missing.length) {
  console.error('★검사 파일이 없다: ' + _missing.join(', ') + '\n'
    + '  FILES 목록과 이 폴더가 어긋났다. 지우거나 옮겼으면 FILES 를 «같이» 고쳐라 —\n'
    + '  «없어서 안 센 것»과 «있는데 통과한 것»은 다른 말이다.');
  process.exit(2);
}

const run = (f) => new Promise((res) => {
  const p = spawn(process.execPath, [path.join(HERE, f), PORT], { cwd: HERE });
  let out = '', err = '';
  p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => err += d);
  p.on('close', (code) => res({ f, code, out, err }));
});

const rows = [];
for (const f of FILES) {
  const r = await run(f);
  let parsed = null;
  try { parsed = JSON.parse(r.out.slice(r.out.indexOf('{'))); } catch (_) {}
  if (!parsed) { rows.push({ card: f, id: '(터짐)', pass: 'ERROR', note: (r.err || r.out).trim().split('\n').slice(-3).join(' | ') }); continue; }
  for (const c of parsed.checks) rows.push({ card: parsed.card, id: c.id, pass: c.pass, note: c.note });
}

const sym = (p) => p === true ? '초록' : p === false ? '★빨강' : p === null ? '못잼' : String(p);
console.log('\n포트 ' + PORT + ' 에서 잰 결과\n' + '─'.repeat(100));
for (const r of rows) console.log(sym(r.pass).padEnd(6), r.id.padEnd(34), r.note);
console.log('─'.repeat(100));
const red = rows.filter(r => r.pass === false).length;
const green = rows.filter(r => r.pass === true).length;
const unknown = rows.filter(r => r.pass === null).length;
console.log(`빨강 ${red} · 초록 ${green} · 못잼 ${unknown} · 줄 ${rows.length}`);
