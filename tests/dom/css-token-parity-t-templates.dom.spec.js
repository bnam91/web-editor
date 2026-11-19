/* css-token-parity-t-templates — CSS 토큰 통일 A단계(ty/css-token-a) 템플릿 브라우저 화면 명부(PLAN-css-token-unify-261118 §5 ②(ii) · §9-5).
 *   틀 = tests/dom/_css-token-parity.js(레인 0). 화면: 템플릿 브라우저(#tpl-browser · 목록 3장 · 첫 카드 자동 선택 → 미리보기).
 *   bootApp 의 electronAPI 는 전부 null → 목록이 비어 카드·태그·미리보기가 안 뜬다.
 *     ⇒ 두 판에 같은 가짜(목록 3장 · 미리보기 html)를 끼운다: Proxy 로 한 번만 감싸 템플릿 이름 둘만 답하고 나머지는 원래 Proxy 로.
 *     initTemplates() 를 다시 불러 캐시를 그 목록으로 채운다(esweep-fixes · template-no-scratch-link 와 같은 길).
 *   멎음: 여는 길이 opacity 0.2s 전이 + rAF 로 미리보기 축척 → «opacity 1 · 패널 안 애니메이션 0 · 미리보기 축척 섬» 까지 rAF 로 기다린다(고정 대기 없음).
 *     두 번째 테마도 같은 기다림을 지난다(트리 항목 color 전이 0.1s).
 *   못 덮는 줄(«상태를 모는 화면» 필요 · 단위에서 뺐다): .tb-tree-input(폴더 이름 편집) · .tpl-browser-preview-empty(선택 없음) · .tpl-card-drag-ghost(끌기 중).
 *   돌리기: CSS_TOKEN_BASE=091a2e08e npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/css-token-parity-t-templates.dom.spec.js --workers=1
 *   BASE 없으면 skip(npm 전수에선 안 돈다).
 */
const { test } = require('@playwright/test');
const P = require('./_css-token-parity.js');

const IDX = [
  { id: 'tplT1', name: '히어로 배너', category: '히어로', folder: '기본', type: 'section', tags: ['메인', '배너'], _scope: 'personal' },
  { id: 'tplT2', name: '공용 리뷰', category: '리뷰', folder: '공용', type: 'block', tags: ['리뷰'], _scope: 'shared' },
  { id: 'tplT3', name: '상세 설명', category: '상세', folder: '기본', type: 'section', _scope: 'personal' },
];
const CANVAS = '<div class="section-block" style="height:500px;background:#ffffff"><div style="height:120px;background:#2d6fe8"></div></div>';

const open = (page) => page.evaluate(async ([idx, canvas]) => {
  if (!window.__tplMock) {
    const base = window.electronAPI;
    const api = { loadTemplateIndex: async () => idx.map((t) => ({ ...t })), loadTemplateCanvas: async () => canvas };
    window.electronAPI = new Proxy({}, { get: (_, k) => (k in api ? api[k] : base[k]) });
    window.__tplMock = true;
    await window.initTemplates();
    window.openTemplateBrowser();
  }
}, [IDX, CANVAS]).then(() => page.waitForFunction(() => {
  const panel = document.getElementById('tpl-browser');
  const c = document.querySelector('#tpl-browser-preview-canvas .section-block');
  return panel.classList.contains('open') && getComputedStyle(panel).opacity === '1'
    && panel.getAnimations({ subtree: true }).length === 0
    && document.querySelectorAll('#tpl-browser .tb-card').length === 3
    && !!c && c.style.transform.startsWith('scale(');
}, null, { polling: 'raf', timeout: 10000 }));

const SCREENS = [
  { name: '템플릿 브라우저', files: ['css/editor-extra.css'], root: '#tpl-browser', open },
];

test('T-templates — 템플릿 브라우저 두 판·두 테마 픽셀 0 · 자 양성대조 > 0 · 덮은 선언 x/y', async ({ browser }) => {
  test.skip(!P.BASE, 'CSS_TOKEN_BASE 없음');
  test.setTimeout(180000);
  const r = await P.check(browser, SCREENS);
  console.log(`[css-token-t-templates] ${JSON.stringify(r.cov)} · 덮개 ${r.overlaySize}`);
});
