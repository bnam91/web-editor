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
async function launchIsolated({ port, profile, args = [], cwd = process.cwd(), mcpPort } = {}) {
  if (!port || !profile) throw new Error('launchIsolated: port 와 profile 은 필수다');
  /* ★★`GODITOR_MCP_PORT` 를 ★반드시 넘긴다 (261025 · `E2E-HARDCODED-FORBIDDEN-PORT-9345-01`).
         ★안 넘기면 ★앱이 ★★스스로 ★9345 부터 잡는다 — ★그 대역(9345~9365)은 ★남의 실사용
         goditor·클로드앱 커넥터가 ★쓰는 자리라 ★검사가 ★그걸 ★먹는다.
     ★값은 ★CDP 포트 ★바로 뒤를 쓴다(★둘이 ★겹치면 ★안 된다).
     ★★재는 자 = `tests/unit/e2e-launch-passes-mcp-port.test.mjs` ★G1 —
         ⛔그 자는 ★「포트가 ★9345 가 ★아니다」로 ★재지 ★않는다(★그건 ★우연히 통과한다).
         ★★재는 것은 ★★«넘겼는가» ★하나다. */
  const _mcp = String(mcpPort || (Number(port) + 1));
  if (Number(_mcp) >= 9345 && Number(_mcp) <= 9365) {
    throw new Error(`launchIsolated: mcpPort ${_mcp} 가 금지대역 9345~9365 안이다`);
  }
  fs.mkdirSync(profile, { recursive: true });
  const src = path.join(os.homedir(), 'Library', 'Application Support', 'GODITOR', 'auth.json');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(profile, 'auth.json'));
  const app = await _electron.launch({
    args: ['.', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
           '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
           '--disable-backgrounding-occluded-windows', 'admin', ...args],
    cwd,
    env: { ...process.env, GODITOR_MCP_PORT: _mcp },
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

module.exports = { connectApp, launchApp, launchIsolated };
