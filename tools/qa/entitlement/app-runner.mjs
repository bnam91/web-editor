/* 앱을 «실제로 띄워» 자격증명 판정을 재는 러너.
 *
 * ★이 하네스의 존재 이유 = 「단위검사가 876개 초록인데 아무도 앱을 안 띄웠다」.
 *   writeAuth 화이트리스트가 서명을 버리는지, 무기한(null) 사용자가 매 실행 튕기는지는
 *   «디스크와 화면»으로만 드러난다. 그래서 이 러너는 세 가지를 «실측»한다:
 *     ⑴ 부팅 후 실제로 로드된 페이지(projects.html = 통과 / license.html = 막힘)
 *     ⑵ 종료 «후» userData/auth.json 의 바이트
 *     ⑶ 그 화면의 스크린샷
 *
 * ⛔현빈 실사용 맥 규약
 *   · `--user-data-dir` 로 «격리 ud». 실제 `~/Library/Application Support/GODITOR` 미접촉.
 *   · Electron 은 `--window-position` 을 **무시한다**(goditor-qa harness §3-c 실측: −2400 을 줘도 36,33).
 *     ⇒ 띄운 «뒤» System Events 로 옮기고, ★옮긴 뒤 `window.screenX` 로 «확인»한다.
 *     ⛔`first process whose unix id is N` 금지 — 죽은 pid 면 «남의 창»을 잡는다(실사고 3회).
 *   · `admin` 인자를 **절대 안 준다** — admin 은 라이선스 게이트를 통째로 우회하므로
 *     붙이는 순간 이 검증 전체가 «아무것도 안 보는» 초록이 된다.
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { waitForPage, connect, httpJson } from './cdp-lite.mjs';

const require_ = createRequire(import.meta.url);

export function electronBin(repoRoot) {
  const p = require_(path.join(repoRoot, 'node_modules', 'electron'));
  if (typeof p !== 'string' || !fs.existsSync(p)) throw new Error('electron 바이너리를 못 찾음: ' + p);
  return p;
}

/** 이름이 Electron/GODITOR 인 프로세스 중 «pid 가 정확히 일치»하는 것의 창만 옮긴다. */
export function moveWindowOffscreen(pid, x = -2400, y = 0) {
  const script = `
tell application "System Events"
  repeat with pname in {"Electron", "GODITOR"}
    repeat with p in (every process whose name is (pname as string))
      if (unix id of p) is ${pid} then
        repeat with w in (every window of p)
          try
            set position of w to {${x}, ${y}}
          end try
        end repeat
      end if
    end repeat
  end repeat
end tell`;
  try { execFileSync('/usr/bin/osascript', ['-e', script], { timeout: 15000 }); return true; }
  catch (e) { return String(e.message || e); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 앱을 한 번 띄우고 재고 끈다.
 * @param {object} o
 *   repoRoot, port, userDataDir, env(추가 env), outDir, label,
 *   waitMs(페이지 대기 상한), settleMs(로드 후 안정화), shot(bool)
 * @returns {Promise<object>} 실측 결과
 */
export async function runOnce(o) {
  const {
    repoRoot, port, userDataDir, env = {}, outDir, label,
    waitMs = 45000, settleMs = 2500, shot = true, afterPage = null,
  } = o;

  fs.mkdirSync(outDir, { recursive: true });
  const logPath = path.join(outDir, `${label}.app.log`);
  const logFd = fs.openSync(logPath, 'a');

  /* ★`binPath` 를 주면 «패키징 빌드»(GODITOR.app/Contents/MacOS/GODITOR)를 그대로 띄운다.
     그때는 앱 경로 인자를 «주지 않는다» — 번들이 자기 asar 를 안다.
     ⚠️패키징 빌드는 `GODITOR_LICENSE_API`·`GODITOR_ENTITLEMENT_PUBKEY` 를 «무시»하도록
       만들어져 있다(E2-b/E2-c). 그게 실제로 그런지가 검증 항목이다. */
  const bin = o.binPath || electronBin(repoRoot);
  /* ⛔★앱 경로는 «절대경로 + 뒤 슬래시»로 준다. `.` 이나 슬래시 없는 경로를 주면
     Node 의 모듈 해석이 `<경로>.js` 를 «먼저» 찾는다 — 공용 scratchpad 에 남의
     `e4.js` 가 있어서 Electron 이 **남의 스크립트를 앱 본체로 로드했다**(2026-09-06 실측).
     증상은 「창이 안 뜬다」뿐이라 원인이 안 보인다. 슬래시 하나가 그걸 막는다. */
  /* ★구분자는 플랫폼 것이다 — 윈도우에서 `C:\repo` 에 `/` 를 붙이면 «섞인 경로»가 된다. */
  const appArg = /[\\/]$/.test(repoRoot) ? repoRoot : repoRoot + path.sep;
  const args = [
    ...(o.binPath ? [] : [appArg]),
    '--enable-logging',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    `--user-data-dir=${userDataDir}`,
    '--window-position=-2400,0',   // Electron 은 무시한다. «선언»으로만 남긴다(preflight --verify 가 본다)
  ];

  const child = spawn(bin, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: ['ignore', logFd, logFd],
  });

  const res = {
    label, pid: child.pid, port, exit: null,
    pageUrl: null, screenX: null, moved: null, authState: null,
    shotPath: null, error: null, consoleErrors: [],
  };

  let cdp = null;
  try {
    /* ★소유권 — 이 포트의 페이지가 «내 체크아웃»에서 온 것인지 대조한다.
       패키징 빌드는 asar 안이라 경로가 다르므로 `pageRoot` 로 따로 준다. */
    const target = await waitForPage(port, {
      repoRoot: o.pageRoot || fs.realpathSync(repoRoot), timeoutMs: waitMs,
    });
    res.pageUrl = target.url;

    /* ★창을 «먼저» 화면 밖으로. 그 다음에 재고 찍는다. */
    res.moved = moveWindowOffscreen(child.pid);

    cdp = await connect(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable', {}, 8000).catch(() => {});
    await sleep(settleMs);

    /* ★옮긴 «뒤» 확인 — 플래그도, osascript 의 성공 여부도 믿지 않는다. */
    res.screenX = await cdp.evalx('window.screenX');

    /* 화면이 다시 바뀌었을 수 있다(license.html → projects.html). 최종 URL 을 다시 읽는다. */
    res.pageUrl = await cdp.evalx('location.href');

    res.authState = await cdp.evalx(
      'window.electronAPI && window.electronAPI.getAuthState ? window.electronAPI.getAuthState() : null'
    ).catch((e) => ({ _evalError: String(e.message) }));

    if (afterPage) res.after = await afterPage(cdp, res);

    if (shot) {
      const f = path.join(outDir, `${label}.png`);
      /* 백그라운드 창은 직전 프레임을 돌려줄 때가 있다 — 한 장 버리고 다시 찍는다. */
      await cdp.shot(path.join(outDir, `.discard-${label}.png`)).catch(() => {});
      await sleep(600);
      await cdp.shot(f);
      try { fs.unlinkSync(path.join(outDir, `.discard-${label}.png`)); } catch (_) {}
      res.shotPath = f;
      /* ★DPR 을 «가정»하지 않는다 — 스크린샷 높이 / innerHeight 로 «잰다». */
      const ih = await cdp.evalx('window.innerHeight');
      res.innerHeight = ih;
    }
  } catch (e) {
    res.error = String(e.message || e);
  } finally {
    try { if (cdp) cdp.close(); } catch (_) {}
    try { child.kill('SIGTERM'); } catch (_) {}
    /* ⛔종료 대기에도 상한. 안 죽으면 SIGKILL. */
    const t0 = Date.now();
    while (child.exitCode === null && child.signalCode === null && Date.now() - t0 < 8000) await sleep(200);
    if (child.exitCode === null && child.signalCode === null) { try { child.kill('SIGKILL'); } catch (_) {} }
    await sleep(500);
    try { fs.closeSync(logFd); } catch (_) {}
    res.exit = child.exitCode;
    /* 포트가 실제로 풀렸는지 — 다음 회차가 «앞 회차»에 붙는 사고를 막는다. */
    let free = false;
    for (let i = 0; i < 20 && !free; i++) {
      try { await httpJson(port, '/json/version', 800); await sleep(300); }
      catch (_) { free = true; }
    }
    res.portFreed = free;
  }
  return res;
}

/** 짧은 도우미 — auth.json 을 «바이트로» 읽는다. */
export function readAuthFile(userDataDir) {
  const p = path.join(userDataDir, 'auth.json');
  if (!fs.existsSync(p)) return null;
  const buf = fs.readFileSync(p);
  return { path: p, bytes: buf.length, sha256: crypto_sha(buf), text: buf.toString('utf8') };
}

function crypto_sha(buf) {
  return require_('node:crypto').createHash('sha256').update(buf).digest('hex').slice(0, 16);
}
