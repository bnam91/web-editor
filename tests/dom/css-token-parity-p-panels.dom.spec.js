/* css-token-parity-p-panels — CSS 토큰 통일 A단계(ty/css-token-a) P 묶음 화면 명부(PLAN-css-token-unify-261118 §5 ②(ii) · §9-5).
 *   틀 = tests/dom/_css-token-parity.js(레인 0). 화면: 상단바 · 좌측 파일 패널(섹션 1 · 글 2) · 우측 패널(글 선택).
 *   ★두 판을 «같게» 만드는 장면 고정(둘 다 같은 함수 · 페이지마다 한 번):
 *     블록 id 는 Math.random(genId) · 프로젝트 id 는 'proj_'+Date.now() → 고정 id 로 바꾸고 #project-id-display 글을 고정.
 *     #autosave-indicator 는 편집 뒤 타이머로 «저장됨»을 2.5초 띄운다 → visibility:hidden(이 줄들은 단위에서 뺐다).
 *   돌리기: CSS_TOKEN_BASE=091a2e08e npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/css-token-parity-p-panels.dom.spec.js --workers=1
 *   BASE 없으면 skip(npm 전수에선 안 돈다).
 */
const { test } = require('@playwright/test');
const P = require('./_css-token-parity.js');

const setup = (page) => page.evaluate(() => {
  if (!window.__pSetup) {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection({ skipDefaultBlock: true, paddingY: 20 });
    const sec = c.querySelector('.section-block');
    sec.id = 'secP';
    window.selectSection(sec); window.addTextBlock('h1');
    window.selectSection(sec); window.addTextBlock('body');
    [...sec.querySelectorAll('.text-block')].forEach((t, i) => { t.id = `txP${i + 1}`; });
    window.deselectAll();
    window.buildLayerPanel();
    window.__pSetup = true;
  }
  document.getElementById('project-id-display').textContent = 'proj_parity';
  document.getElementById('autosave-indicator').style.visibility = 'hidden';
});

const SCREENS = [
  { name: '상단바', files: ['css/editor-base.css'], root: '#topbar',
    open: (page) => setup(page) },
  { name: '좌측 파일 패널', files: ['css/panels/_panel-tree.css', 'css/panels/_panel-layer.css'], root: '#panel-left',
    open: async (page) => { await setup(page); await page.evaluate(() => { window.deselectAll(); window.switchToTab('file'); }); } },
  { name: '우측 패널(글 선택)', files: ['css/editor-props.css', 'css/panels/_panel-tree.css', 'css/editor-base.css'], root: '#panel-right',
    open: async (page) => { await setup(page); await page.evaluate(() => window.selectBlock('txP1')); },
    close: (page) => page.evaluate(() => window.deselectAll()) },
];

test('P-panels — 상단바·좌측·우측(글) 두 판·두 테마 픽셀 0 · 자 양성대조 > 0 · 덮은 선언 x/y', async ({ browser }) => {
  test.skip(!P.BASE, 'CSS_TOKEN_BASE 없음');
  test.setTimeout(180000);
  const r = await P.check(browser, SCREENS);
  console.log(`[css-token-p-panels] ${JSON.stringify(r.cov)} · 덮개 ${r.overlaySize}`);
});
