#!/usr/bin/env node
/* 창을 화면 밖(-2400,0)으로 밀고 screenX 로 «확인»한다.
 * 기동 직후 바로 부른다 — 현빈 실사용 맥에서 창이 앞에 떠 있는 시간을 최소화한다.
 *
 * ★실측(2026-09-06, Electron/Chrome 146): 이 앱의 CDP 브라우저 엔드포인트에는
 *   Browser 도메인이 «없다» — `Browser.getWindowForTarget` 이 -32601 로 떨어진다.
 *   스크래치패드의 옛 movewin.js 는 응답을 «출력만» 하고 확인을 안 해서 「됐다」로 보였다.
 *   ⇒ CDP 를 먼저 시도하고, 실패하면 OS 창 관리자로 내려간다(맥=osascript, 윈도우=user32).
 *
 * 사용: node tools/perf/move-window.mjs --port=9390 [--left=-2400] */
import { execFileSync } from 'node:child_process';
import { connect, moveWindowOffscreen, sleep } from './cdp-lite.mjs';

const A = Object.fromEntries(process.argv.slice(2).map(s => { const m = /^--([^=]+)(?:=(.*))?$/.exec(s); return m ? [m[1], m[2] ?? true] : [s, true]; }));
const PORT = A.port; const LEFT = +(A.left ?? -2400); const MATCH = A.match || '';
if (!PORT) { console.error('usage: move-window.mjs --port=9390 [--left=-2400] [--match=index.html]'); process.exit(1); }

function pidForPort(port) {
  if (process.platform === 'win32') {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      `(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*--remote-debugging-port=${port}*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object -First 1).ProcessId`
    ], { encoding: 'utf8' }).trim();
    return out ? +out : null;
  }
  const out = execFileSync('bash', ['-c',
    `ps -eo pid=,command= | grep -E "MacOS/(Electron|GODITOR)" | grep -v Helper | grep -- "--remote-debugging-port=${port}" | awk '{print $1}' | head -1`
  ], { encoding: 'utf8' }).trim();
  return out ? +out : null;
}

function osMove(pid, left, top) {
  if (process.platform === 'darwin') {
    execFileSync('osascript', ['-e',
      `tell application "System Events" to tell (first process whose unix id is ${pid}) to set position of window 1 to {${left}, ${top}}`
    ], { encoding: 'utf8' });
    return 'osascript';
  }
  if (process.platform === 'win32') {
    // MoveWindow(hWnd, X, Y, nWidth, nHeight, bRepaint) — 크기는 현재 값을 유지한다.
    execFileSync('powershell', ['-NoProfile', '-Command', `
$sig='[DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int t,bool r);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
public struct RECT { public int Left, Top, Right, Bottom; }';
$u=Add-Type -MemberDefinition $sig -Name U -Namespace W -PassThru;
$h=(Get-Process -Id ${pid}).MainWindowHandle;
$r=New-Object W.U+RECT; [void]$u::GetWindowRect($h,[ref]$r);
[void]$u::MoveWindow($h, ${left}, ${top}, ($r.Right-$r.Left), ($r.Bottom-$r.Top), $true)`
    ], { encoding: 'utf8' });
    return 'user32.MoveWindow';
  }
  throw new Error('지원 안 하는 플랫폼: ' + process.platform);
}

const tried = [];
let mv = await moveWindowOffscreen(PORT, LEFT, 0, MATCH);
tried.push({ how: 'CDP Browser.setWindowBounds', ok: mv.ok, error: mv.error });
let pos = await (async () => { const c = await connect(PORT, MATCH); const p = await c.ev('({sx:screenX,sy:screenY,vis:document.visibilityState,focus:document.hasFocus(),url:location.href})'); c.close(); return p; })();

if (pos.sx > LEFT + 100) {
  const pid = pidForPort(PORT);
  if (!pid) { console.error('⛔포트 ' + PORT + ' 의 메인 프로세스를 못 찾았다'); }
  else {
    try { tried.push({ how: osMove(pid, LEFT, 0), ok: true, pid }); }
    catch (e) { tried.push({ how: 'OS 창관리자', ok: false, err: e.message.slice(0, 200) }); }
    await sleep(400);
    const c = await connect(PORT, MATCH); pos = await c.ev('({sx:screenX,sy:screenY,vis:document.visibilityState,focus:document.hasFocus(),url:location.href})'); c.close();
  }
}
const ok = pos.sx <= LEFT + 100;
console.log(JSON.stringify({ tried, pos, offscreen: ok }, null, 1));
if (!ok) console.error('⛔창이 아직 화면 안이다 — 현빈이 PC 를 쓰는 중이면 계측을 멈추고 물어라');
process.exit(ok ? 0 : 1);
