/* tests/dom 전용 설정 — 렌더러 파일(js/*.js)을 «앱 없이» 크로미움에 띄워 재는 자리.
 * ⛔앱을 안 띄운다: 고디터 인스턴스·MCP 9345 대역 무접촉. e2e 설정과 분리해 둔다. */
const { defineConfig } = require('@playwright/test');
/* ★★[2026-09-27 자원 캡] server-manager 실측 요청으로 «고정»한다 — 러너 설정에 박아야 지속된다.
 *   ⑴ 실측된 해 — 캡이 없으면 playwright 가 CPU 수만큼 워커를 띄워 ★headless chromium 23개가
 *      동시에 돌고 load 가 **222** 까지 갔다(같은 날 3회 재발). 이 맥은 여러 세션이 나눠 쓴다.
 *   ⑵ ⛔`workers` 를 늘려 «전수 시간»을 벌지 마라 — 그 시간은 다른 세션에서 빼 오는 것이다.
 *      환경변수로 열어 두되(`GOEDITOR_DOM_WORKERS`) ★상한 6 으로 «자른다».
 *   ⑶ ★`preserveOutput:'failures-only'` — 통과한 검사의 아티팩트를 «안 남긴다». 손으로
 *      `rm -rf test-results` 하던 것을 구조로 바꾼다(디스크 회수가 «잊히지 않게»).
 *   ⚠️그래서 이 설정 뒤의 「DOM 전수 N분」은 이전 판과 «다른 조건»의 수다 — 비교할 때 밝혀라. */
const _envW = Number(process.env.GOEDITOR_DOM_WORKERS);
const DOM_WORKERS = Math.min(6, Number.isInteger(_envW) && _envW > 0 ? _envW : 4);
module.exports = defineConfig({
  testDir: __dirname,
  timeout: 30000,
  retries: 0,
  workers: DOM_WORKERS,
  preserveOutput: 'failures-only',
  reporter: [['list']],
  use: { browserName: 'chromium', headless: true },
});
