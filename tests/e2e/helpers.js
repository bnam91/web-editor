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
async function launchIsolated({ port, profile, args = [], cwd = process.cwd() }) {
  if (!port || !profile) throw new Error('launchIsolated: port 와 profile 은 필수다');
  fs.mkdirSync(profile, { recursive: true });
  const src = path.join(os.homedir(), 'Library', 'Application Support', 'GODITOR', 'auth.json');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(profile, 'auth.json'));
  const app = await _electron.launch({
    args: ['.', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
           '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
           '--disable-backgrounding-occluded-windows', 'admin', ...args],
    cwd,
  });
  const root = await app.evaluate(({ app }) => app.getPath('userData'));
  if (path.resolve(root) !== path.resolve(profile)) {
    await app.close().catch(() => {});
    throw new Error(`★프로필 격리 실패 — userData=${root} (기대: ${profile}). 현빈 실계정일 수 있어 즉시 껐다.`);
  }
  return app;
}

module.exports = { connectApp, launchApp, launchIsolated };
