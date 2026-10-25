/* ★[한 벌 규율 · 2026-09-22] 이 파일은 «playwright 가 앱을 띄워 도는» *.spec.js 용 한 벌이다.
 *   이미 떠 있는 앱에 «CDP 로 붙어» 재는 standalone 검사는 tests/e2e/lib/*.mjs 를 쓴다.
 *   그쪽은 ESM(ws) 이라 이 CJS 파일에서 require 할 수 없다 — 그래서 «두 갈래»지 두 벌이 아니다.
 *   ⛔어느 쪽이든 베껴서 제 폴더에 두지 마라.
 */
const { chromium, _electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * 개발 중: 실행 중인 앱(9334)에 CDP 연결
 * CI: Electron 직접 실행
 */
async function connectApp() {
  if (process.env.GD_E2E_ATTACH_CDP) return attachEditor();   // ★opt-in 갈래(run-app.sh) · 안 주면 아래 옛 길 그대로
  const port = process.env.ELECTRON_DEBUG_PORT || '9334';
  const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
  const context = browser.contexts()[0];
  const pages = context.pages();
  // 에디터 페이지 찾기 (index.html)
  const editorPage = pages.find(p => p.url().includes('index.html')) || pages[0];
  return { browser, context, page: editorPage };
}

async function launchApp() {
  const app = await _electron.launch({
    args: ['.', '--enable-logging', '--remote-debugging-port=9334', 'admin'],
    cwd: process.cwd(),
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

/* ★[2026-09-22] «격리 프로필»로 띄우는 한 벌 — ⛔launchApp() 을 검사에 쓰지 마라.
 *   그쪽은 포트 9334 하드코딩 + «공용 프로필»이라, 검사가 현빈 실계정(~/Library/Application
 *   Support/GODITOR)에 붙어 그 계정에 프로젝트를 만든다. 실제로 그런 사고가 났다(2026-09-22).
 * ⇒ 여기서는 포트와 userData 를 «받아서» 띄우고, 띄운 «직후» app.getPath('userData') 가
 *   그 프로필인지 확인한다. 아니면 «즉시 끄고 던진다» — 늦게 아는 것보다 낫다.
 * ★로그인 게이트 — 이 맥의 auth.json 을 «격리 프로필에만» 복사한다(원본은 안 건드린다).
 * ⚠️tests/e2e/13-undo-family.spec.js 는 이것이 생기기 «전»에 쓰여 같은 일을 제 안에 갖고 있다.
 *   그 파일은 «재는 양»이 걸린 게이트라 여기서 손대지 않는다 — 다시 쓸 때 이 함수로 들여라. */
/* ★[S6-T7 ③ · 2026-10-25] E2E-HARDCODED-FORBIDDEN-PORT-9345-01 — _electron.launch 가 GODITOR_MCP_PORT 를 «넘기게» 한다.
 *   안 넘기면 앱(main.js)이 MCP 를 스스로 9345 부터 잡는다(금지대역). 값은 «부르는 쪽»이 정한다 · 띠 9610~9629 밖이면 띄우기 전에 던진다.
 *   재는 자 = tests/unit/e2e-launch-mcp-port.test.js (launchIsolated 가로채기 ＋ tests/e2e 의 launch 자리 전수). */
const MCP_BAND = [9610, 9629];
function mcpPortEnv(mcpPort) {
  const n = Number(mcpPort);
  if (!Number.isInteger(n) || n < MCP_BAND[0] || n > MCP_BAND[1]) {
    throw new Error(`GODITOR_MCP_PORT 를 띠 ${MCP_BAND[0]}~${MCP_BAND[1]} 안에서 줘라 (받음: ${mcpPort}) — 안 주면 앱이 9345 를 잡는다`);
  }
  return { ...process.env, GODITOR_MCP_PORT: String(n) };
}

async function launchIsolated({ port, profile, mcpPort, args = [], cwd = process.cwd() }) {
  if (!port || !profile) throw new Error('launchIsolated: port 와 profile 은 필수다');
  const env = mcpPortEnv(mcpPort);   // ★프로필·자격증명을 만지기 «전»에 거른다
  fs.mkdirSync(profile, { recursive: true });
  const src = path.join(os.homedir(), 'Library', 'Application Support', 'GODITOR', 'auth.json');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(profile, 'auth.json'));
  const app = await _electron.launch({
    args: ['.', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
           '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
           '--disable-backgrounding-occluded-windows', 'admin', ...args],
    cwd,
    env,
  });
  const root = await app.evaluate(({ app }) => app.getPath('userData'));
  /* ★★macOS 는 /var ↔ /private/var · /tmp ↔ /private/tmp 가 ★심링크다 — ★같은 자리인데 ★문자열이 다르다.
   *   ⛔path.resolve 는 ★심링크를 ★안 푼다 ⇒ ★격리가 맞는데도 ★여기서 던졌다
   *   (2026-10-14 실측: userData=/private/var/folders/… vs 기대 /var/folders/… ⇒ D0 ★빨강 ＋ ★나머지 5칸이 ★안 돌았다).
   *   ⇒ ★양쪽을 ★realpath 로 ★풀어 견준다. ★★가드 ★약화가 ★아니다 — ★«같은 자리»를 ★같다고 재는 것이고,
   *     ★진짜 다른 자리(현빈 실계정)는 ★여전히 ★다르게 나온다(★양성대조로 쟀다). */
  const _real = (q) => { try { return fs.realpathSync(q); } catch { return path.resolve(q); } };
  if (_real(root) !== _real(profile)) {
    await app.close().catch(() => {});
    throw new Error(`★프로필 격리 실패 — userData=${root} (기대: ${profile}). 현빈 실계정일 수 있어 즉시 껐다.`);
  }
  return app;
}

/* ★[S6-T6 · 2026-10-25] «applane 이 띄운 격리 앱»에 붙는 opt-in 갈래 — tests/e2e/run-app.sh 가 env 셋을 준다.
 *   GD_E2E_ATTACH_CDP=<포트> · GD_E2E_ATTACH_UDATA=<절대 udata> · GD_E2E_ATTACH_TREE=<절대 레인>
 *   ⛔안 주면 아무것도 안 바뀐다(connectApp 옛 길 · 12/13/14 의 launch 길 그대로).
 * ⛔붙기 «전에» 그 포트의 주인이 «이 레인 · 이 udata 의 applane 앱»인지 잰다 — 아니면 소켓 하나 안 열고 던진다.
 *   (CDP Browser.getBrowserCommandLine 은 --enable-automation 이 있어야 돼서 안 쓴다 → lsof/ps 로 잰다.)
 * ⚠️connectOverCDP 의 browser.close() 는 «끊기만» 한다 — 앱은 applane down 까지 산다. */
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

function _run(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { return String((e && e.stdout) || ''); }   // lsof 는 «없음»을 rc 1 로 준다 ⇒ 빈 출력으로 읽는다
}

function assertIsolatedCdp(port, udata, tree) {
  const fail = (m) => { throw new Error(`★격리 CDP 가드 거절 — ${m} (port=${port} udata=${udata} tree=${tree})`); };
  const home = os.homedir();
  // (a) 띠 — 9614..9617 정수만
  const p = Number(port);
  if (!/^\d+$/.test(String(port)) || p < 9614 || p > 9617) fail('포트가 9614..9617 정수가 아니다');
  // (b) udata — 절대 · ~/.gd-work/udata- 접두 · 현빈 실계정 아님
  if (!udata || !path.isAbsolute(udata)) fail('udata 가 절대경로가 아니다');
  if (!udata.startsWith(path.join(home, '.gd-work') + '/udata-')) fail('udata 가 ~/.gd-work/udata- 로 시작하지 않는다');
  let realUd; try { realUd = fs.realpathSync(udata); } catch { fail('udata 가 없다'); }
  const realDefault = (() => { const d = path.join(home, 'Library', 'Application Support', 'GODITOR');
    try { return fs.realpathSync(d); } catch { return d; } })();
  if (realUd === realDefault) fail('udata 가 현빈 실계정(GODITOR)이다');
  if (!tree || !path.isAbsolute(tree)) fail('tree 가 절대경로가 아니다');
  let realTree; try { realTree = fs.realpathSync(tree); } catch { fail('tree 가 없다'); }
  // (c) LISTEN 주인 — 정확히 pid 1개
  const pids = _run('lsof', ['-nP', '-t', `-iTCP:${p}`, '-sTCP:LISTEN']).split('\n').map(s => s.trim()).filter(Boolean);
  const uniq = [...new Set(pids)];
  if (uniq.length !== 1) fail(`LISTEN pid 가 1개가 아니다: [${uniq.join(',')}]`);
  const pid = uniq[0];
  // (d) 그 pid 의 인자 — --user-data-dir= 토큰 정확히 1개 = 이 udata · --remote-debugging-port=<port>
  const toks = _run('ps', ['-ww', '-o', 'args=', '-p', pid]).trim().split(/\s+/).filter(Boolean);
  const udToks = toks.filter(t => t.startsWith('--user-data-dir='));
  if (udToks.length !== 1) fail(`pid ${pid} 의 --user-data-dir= 토큰이 ${udToks.length}개다`);
  if (udToks[0] !== `--user-data-dir=${udata}`) fail(`pid ${pid} 의 udata 불일치: ${udToks[0]}`);
  if (!toks.includes(`--remote-debugging-port=${p}`)) fail(`pid ${pid} 에 --remote-debugging-port=${p} 가 없다`);
  // (e) cwd — 이 레인
  const cwdLine = _run('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn']).split('\n').find(l => l.startsWith('n'));
  const cwd = cwdLine ? cwdLine.slice(1) : '';
  let realCwd = cwd; try { realCwd = fs.realpathSync(cwd); } catch {}
  if (!cwd || realCwd !== realTree) fail(`pid ${pid} 의 cwd 불일치: ${cwd || '(못 읽음)'}`);
  // (f) applane 장부 — tree|port|*|udata 줄 + 살아 있는 .pid
  const st = path.join(home, '.gd-work', 'applane');
  let metas = []; try { metas = fs.readdirSync(st).filter(f => f.endsWith('.meta')); } catch {}
  const _rp = (q) => { try { return fs.realpathSync(q); } catch { return q; } };
  const owned = metas.some(f => {
    let line = ''; try { line = fs.readFileSync(path.join(st, f), 'utf8').split('\n')[0]; } catch { return false; }
    const [mt, mc, , mu] = line.split('|');
    if (_rp(mt || '') !== realTree || mc !== String(p) || mu !== udata) return false;
    let lp; try { lp = Number(fs.readFileSync(path.join(st, f.replace(/\.meta$/, '.pid')), 'utf8').trim()); } catch { return false; }
    try { process.kill(lp, 0); return true; } catch { return false; }
  });
  if (!owned) fail('applane 장부(~/.gd-work/applane/*.meta + 살아 있는 .pid)에 이 레인·포트·udata 가 없다');
  console.log(`[attach] guard ok port=${p} pid=${pid} udata=${udata} cwd=${cwd}`);
  return { pid: Number(pid), udata, cwd };
}

function _attachEnv() {
  const port = process.env.GD_E2E_ATTACH_CDP;
  const udata = process.env.GD_E2E_ATTACH_UDATA;
  const tree = process.env.GD_E2E_ATTACH_TREE;
  if (!udata || !tree) throw new Error('★GD_E2E_ATTACH_CDP 를 줬으면 GD_E2E_ATTACH_UDATA · GD_E2E_ATTACH_TREE 도 필수다');
  return { port, udata, tree };
}

/* 앱 페이지 고르기 — index.html 우선 · 그다음 projects.html · 아직 없으면 «뜨기를» 기다린다. URL 은 전부 로그. */
async function pickAppPage(context) {
  const RE = /(index|projects)\.html/;
  console.log(`[attach] pages=${JSON.stringify(context.pages().map(p => p.url()))}`);
  const pick = () => { const ps = context.pages();
    return ps.find(p => p.url().includes('index.html')) || ps.find(p => p.url().includes('projects.html')); };
  let page = pick();
  if (!page) {
    if (!context.pages().length) await context.waitForEvent('page', { timeout: 20000 });
    page = await Promise.any(context.pages().map(p => p.waitForURL(RE, { timeout: 20000 }).then(() => p)));
  }
  console.log(`[attach] picked=${page.url()}`);
  return page;
}

async function _attach() {
  const { port, udata, tree } = _attachEnv();
  const g = assertIsolatedCdp(port, udata, tree);   // ⛔가드 «먼저» — 통과 전엔 소켓 0
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  const page = await pickAppPage(context);
  return { browser, context, page, g };
}

/* 01–05·99 용 — connectApp 가 이리 온다. 에디터(addSection)까지 세워서 돌려준다. */
async function attachEditor() {
  const { browser, context, page } = await _attach();
  await page.waitForLoadState('domcontentloaded');
  if (page.url().includes('projects.html')) {
    await page.click('#btn-new');
    await page.waitForURL(/index\.html\?project=/, { timeout: 20000 });
  }
  await page.waitForFunction(() => typeof window.addSection === 'function', null, { timeout: 20000 });
  return { browser, context, page };
}

/* 12/13/14 용 — _electron app 자리를 «흉내»만 낸다(firstWindow · close). #btn-new 는 spec 이 누른다.
 *   ★index.html 에 붙었으면(워커 재시작 재접속) projects.html 로 돌려 spec 갈래가 «새 프로젝트»를 만들게 한다.
 *   ★배경 억제 — launch 길의 --disable-*-backgrounding 을 applane 은 안 준다 ⇒ 여기서 CDP 로 메운다
 *     (12 는 원래 이 둘을 안 보냈다 — 배관 차이 · 13/14 는 제 안에서 또 보낸다 · 무해). */
async function attachIsolated() {
  const { browser, page, g } = await _attach();
  await page.waitForLoadState('domcontentloaded');
  if (page.url().includes('index.html')) {
    await page.goto(pathToFileURL(path.join(g.cwd, 'pages', 'projects.html')).href);
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  await cdp.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});
  return { browser, page, app: { firstWindow: async () => page, close: () => browser.close() } };
}

module.exports = { connectApp, launchApp, launchIsolated, mcpPortEnv, assertIsolatedCdp, attachEditor, attachIsolated };
