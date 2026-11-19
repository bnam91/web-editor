/* css-token-parity-p-panels — CSS 토큰 통일 A단계(ty/css-token-a) P 묶음 화면 명부(PLAN-css-token-unify-261118 §5 ②(ii) · §9-5).
 *   틀 = tests/dom/_css-token-parity.js(레인 0). 화면: 상단바 · 좌측 파일 패널(섹션 1 · 글 2 · 프레임 1) · 우측 패널(글 선택 · 프레임 선택).
 *   ★files 에 없는 css 의 바뀐 줄은 틀이 «덮음»을 안 잰다 — 바꾸는 파일은 그 줄이 보이는 화면의 files 에 반드시 넣는다.
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
    window.selectSection(sec); window.addFrameBlock();   // frame-panel-size-shows-applied 와 같은 길 · 글 블록의 text-frame 은 뺀다
    [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].pop().id = 'frP';
    window.deselectAll();
    window.buildLayerPanel();
    window.__pSetup = true;
  }
  document.getElementById('project-id-display').textContent = 'proj_parity';
  document.getElementById('autosave-indicator').style.visibility = 'hidden';
});

// #rp-top-row · #rp-height-total(_panel-shell) 은 우측 패널 맨 위 고정 마크업 — 섹션이 있으면 합계가 찬다.
const RIGHT = ['css/editor-props.css', 'css/panels/_panel-tree.css', 'css/panels/_panel-shell.css', 'css/editor-base.css'];
const SCREENS = [
  { name: '상단바', files: ['css/editor-base.css'], root: '#topbar',
    open: (page) => setup(page) },
  { name: '좌측 파일 패널', files: ['css/panels/_panel-tree.css', 'css/panels/_panel-layer.css'], root: '#panel-left',
    open: async (page) => { await setup(page); await page.evaluate(() => { window.deselectAll(); window.switchToTab('file'); }); } },
  { name: '우측 패널(글 선택)', files: RIGHT, root: '#panel-right',
    open: async (page) => { await setup(page); await page.evaluate(() => window.selectBlock('txP1')); },
    close: (page) => page.evaluate(() => window.deselectAll()) },
  { name: '우측 패널(프레임 선택)', files: RIGHT, root: '#panel-right',
    /* 지혜맥 d6cc250dc: selectBlock('frP') 가 늘 false — js/block-edit.js getBlockById 가 프레임을 «블럭»으로 안 센다(패널 정본 표 밖 · dataset.type 없음 · 두 판 같음).
       ⇒ 프레임 «클릭» 길(js/block-drag.js 프레임 click 의 일반 단일 선택)과 같은 줄을 부른다: 해제 → 섹션·프레임 .selected → _activeFrame → showFrameProperties.
       실패면 진단 JSON 으로 던진다(어느 판인지는 틀이 안 알려 주므로 그 판의 상태를 싣는다). */
    open: async (page) => { await setup(page); await page.evaluate(() => {
      const f = document.getElementById('frP'), sec = f?.closest('.section-block');
      if (f) {
        window.deselectAll?.();
        if (sec) { sec.classList.add('selected'); window.syncLayerActive?.(sec); }
        f.classList.add('selected'); window._activeFrame = f;
        window.highlightBlock?.(f, f._layerItem);
        window.showFrameProperties?.(f);
      }
      const ok = !!f && f.classList.contains('selected') && !!document.querySelector('#panel-right #ss-align-left');
      if (!ok) throw new Error('frP 프레임 패널 전제 실패 ' + JSON.stringify({ frP: !!f, sec: sec?.id || null, sel: !!f?.classList.contains('selected'),
        framePanel: !!document.querySelector('#panel-right #ss-align-left'), panelHead: document.querySelector('#panel-right .panel-body')?.innerText?.slice(0, 40) ?? null,
        showFrameProperties: typeof window.showFrameProperties }));
    }); },
    close: (page) => page.evaluate(() => window.deselectAll()) },
];

test('P-panels — 상단바·좌측·우측(글·프레임) 두 판·두 테마 픽셀 0 · 자 양성대조 > 0 · 덮은 선언 x/y', async ({ browser }) => {
  test.skip(!P.BASE, 'CSS_TOKEN_BASE 없음');
  test.setTimeout(180000);
  const r = await P.check(browser, SCREENS);
  console.log(`[css-token-p-panels] ${JSON.stringify(r.cov)} · 덮개 ${r.overlaySize}`);
});
