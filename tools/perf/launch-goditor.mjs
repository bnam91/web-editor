#!/usr/bin/env node
/* 계측용 goditor 인스턴스 기동기 — macOS/Windows 공용.
 *
 * 왜 별도 기동기가 필요한가: 「anti-throttle 플래그 3개」의 «유무»가 이 계측의 조건 중 하나다.
 *   --disable-background-timer-throttling
 *   --disable-renderer-backgrounding
 *   --disable-backgrounding-occluded-windows
 * 앱 자체는 이 플래그를 «안» 심는다. 즉 QA 가 달고 띄우면 «실사용과 다른 환경»을 재게 된다.
 * ⇒ 이 기동기는 --flags=on|off 로 «같은 앱»을 두 조건으로 띄운다.
 *
 * ⛔user-data-dir 은 반드시 격리 경로. 원본(Application Support/GODITOR)을 그대로 쓰면
 *   현빈의 실제 프로젝트를 계측이 건드린다.
 *
 * 사용:
 *   node tools/perf/launch-goditor.mjs --port=9390 --ud=/tmp/goditor-perf-on  --flags=on
 *   node tools/perf/launch-goditor.mjs --port=9391 --ud=/tmp/goditor-perf-off --flags=off
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const A = Object.fromEntries(process.argv.slice(2).map(s => { const m = /^--([^=]+)(?:=(.*))?$/.exec(s); return m ? [m[1], m[2] ?? true] : [s, true]; }));
const PORT = A.port, UD = A.ud, FLAGS = String(A.flags || 'on') === 'on';
if (!PORT || !UD) { console.error('usage: launch-goditor.mjs --port=9390 --ud=<격리경로> --flags=on|off [--log=path]'); process.exit(1); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
let bin;
try { bin = require('electron'); }            // electron 패키지는 실행파일 «경로»를 export 한다 (OS 무관)
catch (e) { console.error('electron 을 못 찾았다 — 체크아웃에서 npm install 먼저: ' + e.message); process.exit(2); }

/* 'admin' 인자 = package.json 의 dev 스크립트가 쓰는 «개발 빌드» 경로.
   격리 user-data-dir 은 auth.json 이 없어 라이선스 게이트(pages/license.html)에 걸린다 —
   계측은 에디터 화면에서만 성립하므로 dev 스크립트와 «같은» 인자를 쓴다.
   ⚠️패키지 빌드(app.isPackaged)에서는 이 인자만으로 통과하지 않는다(admin.allow + 토큰 필요). */
const args = ['.', 'admin', '--enable-logging', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*', `--user-data-dir=${UD}`];
if (FLAGS) args.push('--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows');
if (A.extra) args.push(...String(A.extra).split(' ').filter(Boolean));

fs.mkdirSync(UD, { recursive: true });
const logPath = A.log || path.join(UD, 'app.log');
const log = fs.openSync(logPath, 'a');
const ch = spawn(bin, args, { cwd: ROOT, detached: true, stdio: ['ignore', log, log] });
ch.unref();
console.log(JSON.stringify({ pid: ch.pid, port: +PORT, flags: FLAGS ? 'on' : 'off', ud: UD, cwd: ROOT, log: logPath, argv: args }, null, 1));
