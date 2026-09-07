/* tests/dom 전용 설정 — 렌더러 파일(js/*.js)을 «앱 없이» 크로미움에 띄워 재는 자리.
 * ⛔앱을 안 띄운다: 고디터 인스턴스·MCP 9345 대역 무접촉. e2e 설정과 분리해 둔다. */
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30000,
  retries: 0,
  reporter: [['list']],
  use: { browserName: 'chromium', headless: true },
});
