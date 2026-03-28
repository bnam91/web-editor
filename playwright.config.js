const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 1,
  use: {
    // 개발 중: 실행 중인 앱에 CDP로 연결
    // CI: _electron.launch() 사용 (각 테스트 파일에서 처리)
  },
  reporter: [['list'], ['json', { outputFile: 'tests/e2e/results.json' }]],
});
