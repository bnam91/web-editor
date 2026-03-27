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
