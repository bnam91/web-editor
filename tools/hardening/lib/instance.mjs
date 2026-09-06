/* ═══════════════════════════════════════════════════════════════════════════
   instance.mjs — 격리 인스턴스 기동·화면밖 이동·«내 pid 만» 정리.
   ───────────────────────────────────────────────────────────────────────────
   ⛔여기 있는 규칙은 편의가 아니라 «규약»이다. 셋 다 실사고에서 나왔다.
   ⑴ --window-position 은 «무시된다»(2026-09-05 실측: -2400 을 줬는데 36,33 에 떴다).
      → AppleScript 로 «띄운 뒤» 옮기고, ★CDP 로 window.screenX 를 «읽어» 확인한다.
        set position 은 실패해도 조용하다. 읽는 것 말고 확인할 방법이 없다.
   ⑵ `first process whose unix id is N` 은 «남의 창»을 잡는다(2026-09-06 3회 실사고,
      현빈님 codecast 앱이 화면 밖으로 밀렸고 원위치를 아무도 몰라 복구 불가였다).
      → 이름으로 «돌면서» unix id 를 직접 대조한다.
   ⑶ 정리는 «내가 spawn 한 pid» 만. ⛔패턴 매칭 일괄 kill 금지.
═══════════════════════════════════════════════════════════════════════════ */
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HarnessError, waitFor, sleep, withDeadline } from './deadline.mjs';
import { portAlive, attachPage, assertPageOwnership, evalJs } from './cdp.mjs';

export const OFFSCREEN_X = -2400;
export const OFFSCREEN_Y = 0;

/** 이 하네스가 쓰는 포트 대역 — goditor-qa SKILL.md·harness.md 와 같은 값. */
export const PORT_RANGE = [9350, 9399];
/** ⛔절대 건드리지 않는 포트: 9334=현빈 데모, 9340=남의 인스턴스, 9345+=내장 MCP */
export const FORBIDDEN_PORTS = new Set([9334, 9340]);

export function electronBinary(checkoutDir) {
  const cands = [
    path.join(checkoutDir, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
    path.join(os.homedir(), 'web-editor/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),
  ];
  for (const c of cands) { try { if (fs.statSync(c).isFile()) return fs.realpathSync(c); } catch (_) {} }
  throw new HarnessError('Electron 바이너리를 못 찾음', { tried: cands });
}

const exec = (cmd, args, timeout = 15000) => withDeadline(new Promise((res, rej) =>
  execFile(cmd, args, { timeout }, (e, so, se) => e ? rej(new Error(`${e.message} ${se}`)) : res(so))
), timeout + 2000, `exec ${cmd}`);

/** ★pid 를 «이름으로 돌면서 대조»해 옮긴다 — 술어로 고르면 남의 창을 잡는다. */
async function moveOffscreenApplescript(pid) {
  const script = `
tell application "System Events"
  set moved to 0
  repeat with p in (every process whose name is "Electron")
    if (unix id of p) is ${pid} then
      repeat with w in (every window of p)
        try
          set position of w to {${OFFSCREEN_X}, ${OFFSCREEN_Y}}
          set moved to moved + 1
        end try
      end repeat
    end if
  end repeat
  return moved
end tell`;
  try { return Number(String(await exec('osascript', ['-e', script])).trim()) || 0; }
  catch (e) { return -1; }   // 접근권한 등 — 아래 screenX 검증이 진짜 판정이다
}

/**
 * 격리 인스턴스를 띄운다.
 * @param checkoutDir  «내» 체크아웃(사본). 여기가 곧 페이지 소유권의 기대값이 된다.
 * @param userDataDir  «내» ud. ⛔원본 Application Support/GODITOR 금지 — 여기서 막는다.
 */
export async function launch({
  checkoutDir, userDataDir, port,
  projectId = null, admin = true, extraArgs = [],
  bootTimeout = 60000, requireOffscreen = true, env = {}, onAttach = [],
} = {}) {
  if (!checkoutDir || !userDataDir || !port) throw new HarnessError('launch: checkoutDir·userDataDir·port 필수');
  if (FORBIDDEN_PORTS.has(port)) throw new HarnessError(`⛔포트 ${port} 는 남의 것이다(9334=현빈 데모 / 9340=남의 인스턴스)`);
  if (port < PORT_RANGE[0] || port > PORT_RANGE[1]) throw new HarnessError(`포트 ${port} 가 대역 ${PORT_RANGE.join('~')} 밖`);
  const udReal = path.resolve(userDataDir);
  if (udReal.includes('Application Support/GODITOR') || udReal.includes('Application Support/Goya')) {
    throw new HarnessError(`⛔원본 userData 를 대상으로 지정했다: ${udReal}`);
  }
  if (await portAlive(port, 1500)) throw new HarnessError(`포트 ${port} 가 이미 점유돼 있다 — preflight 를 먼저 돌려라`);

  fs.mkdirSync(udReal, { recursive: true });
  const bin = electronBinary(checkoutDir);
  const args = [
    '-arm64', bin, path.resolve(checkoutDir),
    `--user-data-dir=${udReal}`,
    `--remote-debugging-port=${port}`,
    // ★anti-throttle 3플래그 — 없으면 rAF 가 «안 흐르고» 타이머 기능이 버그처럼 보인다(가짜 초록 함정①)
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--remote-allow-origins=*',
    ...extraArgs,
  ];
  if (admin) args.push('admin');

  const child = spawn('arch', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  const stdout = [], stderr = [];
  child.stdout.on('data', d => stdout.push(d.toString()));
  child.stderr.on('data', d => stderr.push(d.toString()));
  let exited = null;
  child.on('exit', (code, sig) => { exited = { code, sig, at: Date.now() }; });

  const inst = {
    pid: child.pid, port, checkoutDir: path.resolve(checkoutDir), userDataDir: udReal,
    child, stdout, stderr, get exited() { return exited; },
    launchedAt: Date.now(), offscreen: null, screenX: null,
    onAttach: [], attachErrors: [],
  };
  if (Array.isArray(onAttach)) inst.onAttach.push(...onAttach);

  try {
    await waitFor(() => portAlive(port, 1500),
      { timeout: bootTimeout, interval: 300, label: `인스턴스 기동 대기 (port=${port})` });
  } catch (e) {
    await teardown(inst, { reason: 'boot-timeout' });
    throw new HarnessError(`인스턴스가 안 떴다 (port=${port})`,
      { pid: child.pid, exited, stderr: stderr.join('').slice(-2000) });
  }

  // ★띄운 «뒤» 옮기고, 옮겼는지 «읽어서» 확인한다.
  await sleep(700);
  inst.movedWindows = await moveOffscreenApplescript(child.pid);
  if (projectId) await openProject(inst, projectId);
  else await attachAndVerify(inst, { match: 'projects.html' });

  if (requireOffscreen && !(inst.screenX <= OFFSCREEN_X + 200)) {
    await teardown(inst, { reason: 'offscreen-failed' });
    throw new HarnessError(
      `★창이 화면 밖으로 «안» 갔다 (screenX=${inst.screenX}) — 현빈 실사용 PC 라 여기서 멈춘다. ` +
      `AppleScript 자동화 권한을 확인하라(moved=${inst.movedWindows})`,
      { screenX: inst.screenX, movedWindows: inst.movedWindows });
  }
  return inst;
}

/**
 * 붙어서 소유권·화면밖을 «실측»한다. conn 은 inst.conn 에 남는다.
 * ★★onAttach 훅이 «왜» 필요한가 (자체 실기 2026-09-06):
 *   `Page.addScriptToEvaluateOnNewDocument` 는 «세션» 것이다. 여기서 옛 conn 을 닫으면
 *   그 세션이 떨어지면서 등록도 같이 사라진다. 그래서 「리로드에도 산다」고 믿고 심어 둔
 *   토스트 수집기가 navigate 뒤 «없었고», corrupt 시나리오가 「토스트 0건」을 냈다.
 *   그건 「토스트가 없다」가 아니라 「내 자가 그 자리에 없었다」였다.
 *   ⇒ 붙을 때마다 다시 심는다. 훅은 실패해도 계측을 안 죽인다(대신 inst.attachErrors 에 남는다).
 */
export async function attachAndVerify(inst, { match = '', timeout = 30000 } = {}) {
  if (inst.conn && !inst.conn.closed) { try { inst.conn.close(); } catch (_) {} }
  const conn = await attachPage(inst.port, { match, timeout });
  inst.conn = conn;
  inst.href = await assertPageOwnership(conn, inst.checkoutDir);   // ★프로세스 소유권과 «다른» 검사
  inst.screenX = await evalJs(conn, 'window.screenX');
  inst.dpr = await evalJs(conn, 'window.devicePixelRatio');        // ⛔DPR 을 가정하지 마라
  inst.innerHeight = await evalJs(conn, 'window.innerHeight');
  inst.offscreen = inst.screenX <= OFFSCREEN_X + 200;
  for (const fn of (inst.onAttach || [])) {
    try { await fn(conn, inst); }
    catch (e) { (inst.attachErrors ||= []).push(`${fn.name || 'onAttach'}: ${e.message}`); }
  }
  return conn;
}

/** 프로젝트를 연다 — 앱 자신의 경로(index.html?project=id)를 그대로 탄다. */
export async function openProject(inst, projectId, { timeout = 120000 } = {}) {
  const conn = inst.conn && !inst.conn.closed ? inst.conn : await attachPage(inst.port, { match: '', timeout: 30000 });
  await conn.send('Page.navigate',
    { url: `file://${inst.checkoutDir}/index.html?project=${encodeURIComponent(projectId)}` });
  // ⛔rAF 대기 금지(창이 죽어 있을 수 있다). «상태 폴링»으로만.
  await waitFor(async () => {
    try {
      const c2 = await attachAndVerify(inst, { match: `project=${projectId}`, timeout: 5000 });
      return await evalJs(c2, 'typeof window.triggerAutoSave === "function" && !!document.getElementById("canvas")');
    } catch (_) { return false; }
  }, { timeout, interval: 500, label: `프로젝트 로드 대기 (${projectId})` });
  inst.movedWindows = await moveOffscreenApplescript(inst.pid);   // 리로드하면 창이 다시 안으로 온다
  await attachAndVerify(inst, { match: `project=${projectId}`, timeout: 15000 });
  return inst.conn;
}

/** ★«내가 띄운 pid» 만 정리한다. 남의 인스턴스는 보고만 한다. */
export async function teardown(inst, { reason = 'done', graceMs = 4000 } = {}) {
  if (!inst || !inst.pid) return { killed: false, reason: 'no-pid' };
  try { inst.conn && inst.conn.close(); } catch (_) {}
  if (inst.exited) return { killed: false, pid: inst.pid, reason: 'already-exited',
    exited: inst.exited, portGone: !(await portAlive(inst.port, 1500)) };
  try { process.kill(inst.pid, 'SIGTERM'); } catch (_) {}
  const gone = await waitFor(() => (inst.exited ? true : null), { timeout: graceMs, interval: 100, label: 'SIGTERM 대기' })
    .then(() => true).catch(() => false);
  if (!gone) {
    try { process.kill(inst.pid, 'SIGKILL'); } catch (_) {}
    await sleep(400);
  }
  const portGone = !(await portAlive(inst.port, 1500));
  return { killed: true, reason, sigkill: !gone, portGone, pid: inst.pid };
}

/** 메인 프로세스가 «스스로 말한 것» — 복구·저장 실패 등은 여기에만 남는 경우가 많다. */
export function mainLogLines(inst, { patterns = [/projects:load/, /복구/, /손상/, /저장/, /Error/i, /crash/i, /gone/i], max = 60 } = {}) {
  const all = (inst.stdout.join('') + inst.stderr.join('')).split('\n');
  return all.filter(l => patterns.some(p => p.test(l))).slice(-max);
}

/** 원본 무접촉 후검 — 내 pid 가 원본 ud 를 안 건드렸다는 «자기 증거». */
export function originClean(inst) {
  const bad = [];
  const ud = inst.userDataDir;
  if (ud.includes('Application Support/GODITOR')) bad.push(ud);
  return { clean: bad.length === 0, offenders: bad, userDataDir: ud };
}
