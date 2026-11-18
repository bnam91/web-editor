/* css-token-parity-frame — 레인 0 틀 자체 점검(PLAN-css-token-unify-261118 §5 ②(ii)).
 *   부팅 직후 늘 보이는 #topbar 한 화면으로 _css-token-parity.check 의 길을 끝까지 돈다:
 *   «찍는지» 단언 · 두 판 픽셀 · 다른 테마 한 번 더 · 덮은 선언 x/y · 자 양성대조(opacity .98 → 차 > 0).
 *   돌리기: CSS_TOKEN_BASE=<sha> npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/css-token-parity-frame.dom.spec.js --workers=1
 *   BASE 없으면 skip(npm 전수에선 안 돈다 — 레인 단위에서만).
 *   레인 spec 은 이 꼴로 자기 묶음 화면 명부(SCREENS)만 바꿔 쓴다. 화면 open 이 «토글»이면 close 도 준다(두 테마 두 번 연다).
 */
const { test } = require('@playwright/test');
const P = require('./_css-token-parity.js');

const SCREENS = [{ name: '상단바', files: ['css/editor-canvas.css'], root: '#topbar', open: async () => {} }];

test('F0 틀 — 상단바 두 판·두 테마 픽셀 0 · 자 양성대조 > 0 · 덮은 선언 셈', async ({ browser }) => {
  test.skip(!P.BASE, 'CSS_TOKEN_BASE 없음');
  test.setTimeout(120000);
  const r = await P.check(browser, SCREENS);
  console.log(`[css-token-frame] ${JSON.stringify(r.cov)} · 덮개 ${r.overlaySize}`);
});
