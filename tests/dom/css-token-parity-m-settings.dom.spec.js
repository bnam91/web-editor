/* css-token-parity-m-settings — CSS 토큰 통일 A단계(ty/css-token-a) M 묶음 첫 화면 명부(PLAN-css-token-unify-261118 §5 ②(ii) · §9-5).
 *   틀 = tests/dom/_css-token-parity.js(레인 0). 이 파일은 «화면 명부»만 준다:
 *     설정 모달 API·단축키·이스터에그 탭 · 업데이트 내역(release-note) · 섹션 검색 팔레트 · 좌측 에셋 패널(빈 프로젝트).
 *   이 단위들이 바꾸는 줄은 전부 이 화면들 안의 보이는 요소에 걸려야 한다(못 덮으면 틀이 빨강).
 *   돌리기: CSS_TOKEN_BASE=091a2e08e npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/css-token-parity-m-settings.dom.spec.js --workers=1
 *   BASE 없으면 skip(npm 전수에선 안 돈다).
 */
const { test } = require('@playwright/test');
const P = require('./_css-token-parity.js');

const SETTINGS = ['css/settings-modal.css'];
const settingsTab = (tab) => ({
  name: `설정 ${tab}`, files: SETTINGS, root: '#settings-modal .settings-modal-shell',
  /* bootApp 의 electronAPI 는 «아무 이름이나 함수» Proxy 라 electronAPI.higgsfield.status 가 없다 → renderApiPane 이 던진다(지디 261119 지혜맥 실측).
     settings-higgsfield.dom.spec.js 의 가짜(키 없음)를 두 판에 똑같이 끼운다 · 나머지 이름은 원래 Proxy 로 · 두 번 열어도 한 번만 감싼다. */
  open: (page) => page.evaluate((t) => {
    if (!window.__hfMock) {
      const base = window.electronAPI;
      const st = { hasKey: false, masked: '' };
      const hf = { status: async () => st, setKey: async () => ({ ok: true, ...st }), clearKey: async () => ({ ok: true, ...st }) };
      window.electronAPI = new Proxy({}, { get: (_, k) => (k === 'higgsfield' ? hf : base[k]) });
      window.__hfMock = true;
    }
    window.openSettingsModal(t);
  }, tab),
  close: (page) => page.evaluate(() => window.closeSettingsModal()),
});
const SCREENS = [
  settingsTab('api'),
  settingsTab('shortcuts'),
  settingsTab('easter'),
  { name: '업데이트 내역', files: ['css/release-note.css'], root: '#relnote-modal .relnote-shell',
    open: (page) => page.evaluate(() => window._relnoteOpen('0.9.1')),
    close: (page) => page.evaluate(() => document.getElementById('relnote-modal')?.remove()) },
  { name: '섹션 검색', files: ['css/section-search.css'], root: '.section-search-overlay .ss-shell',
    open: (page) => page.evaluate(() => window.openSectionSearch()),
    close: (page) => page.evaluate(() => window.closeSectionSearch()) },
  // 빈 프로젝트 → 액션바 + 빈 트리 안내(buildAssetsPanel 은 동기). 닫기 = 기본 탭 'file' 로.
  { name: '에셋 패널(빈)', files: ['css/assets-panel.css'], root: '#assets-panel-body',
    open: (page) => page.evaluate(() => window.switchToTab('assets')),
    close: (page) => page.evaluate(() => window.switchToTab('file')) },
];

test('M-settings — 설정·업데이트 내역·섹션 검색 두 판·두 테마 픽셀 0 · 자 양성대조 > 0 · 덮은 선언 x/y', async ({ browser }) => {
  test.skip(!P.BASE, 'CSS_TOKEN_BASE 없음');
  test.setTimeout(180000);
  const r = await P.check(browser, SCREENS);
  console.log(`[css-token-m-settings] ${JSON.stringify(r.cov)} · 덮개 ${r.overlaySize}`);
});
