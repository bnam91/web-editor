/* ★[한 벌 규율 · 2026-09-22] 이 파일은 «playwright 가 앱을 띄워 도는» *.spec.js 용 한 벌이다.
 *   이미 떠 있는 앱에 «CDP 로 붙어» 재는 standalone 검사는 tests/e2e/lib/*.mjs 를 쓴다.
 *   그쪽은 ESM(ws) 이라 이 CJS 파일에서 require 할 수 없다 — 그래서 «두 갈래»지 두 벌이 아니다.
 *   ⛔어느 쪽이든 베껴서 제 폴더에 두지 마라.
 */
const { chromium, _electron } = require('@playwright/test');

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

module.exports = { connectApp, launchApp };
