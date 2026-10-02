/* group-drop-clip.dom.spec.js — 「블럭을 그룹으로 끌어 넣으면 화면에서 사라진다」 (T-088)
 *
 * ★실앱 실측(2026-09-21, 9543 · 줌 100%):
 *   섹션에 제목 + ⌘G 그룹(height:120px)을 두고 제목을 그룹 위로 끌어 놓으면
 *   제목이 그룹의 «자식»이 되어 top:148px 에 쌓인다. 그런데 .frame-block 은
 *   `overflow:hidden`(css/editor-blocks.css:11) 이고 그룹 높이는 120px 그대로라
 *   제목이 밑변 너머로 밀려 «안 보인다». 저장·재로드해도 값은 그대로 남아 있었다
 *   (= 데이터 소실이 아니라 «잘림»이다 — 이 검사가 재는 축도 잘림이다).
 *
 * ★이 검사는 «자르는 성질» 자체를 진짜 브라우저 레이아웃으로 잰다 —
 *   growFrameToFitChildren 이 없으면(또는 안 불리면) 자식의 아래끝이 프레임 밑변을 넘는다.
 *
 * ⛔앱을 «안» 띄운다 — js/frame-geometry.js 를 ES 모듈로 올려 진짜 CSS 로 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js group-drop-clip
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';

/* 앱 규약을 그대로 옮긴다 — .frame-block 의 overflow:hidden 이 이 결함의 «자르는 쪽»이다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; }
  .section-inner { position:relative; width:860px; }
  .frame-block { position:relative; width:100%; max-width:100%; overflow:hidden;
                 display:flex; flex-direction:column; min-height:60px; }
</style>
<script type="module">
  import { growFrameToFitChildren, absChildrenBottom, frameFitHeight } from '/frame-geometry.js';
  window.growFrameToFitChildren = growFrameToFitChildren;
  window.absChildrenBottom = absChildrenBottom;
  window.frameFitHeight = frameFitHeight;
  window.__ready = true;
</script>
</head><body>
  <div class="section-inner" id="inner">
    <div class="frame-block" id="grp" data-group="true" data-free-layout="true"
         data-height="120" style="width:100%;height:120px;min-height:120px;padding:0;">
      <div class="frame-block" data-text-frame="true" id="c1"
           style="position:absolute;left:0px;top:0px;width:400px;height:58px;"></div>
      <div class="frame-block" data-text-frame="true" id="c2"
           style="position:absolute;left:0px;top:74px;width:400px;height:58px;"></div>
      <!-- 밖에서 끌어 넣어 맨 아래로 쌓인 제목 — 드롭 경로가 정하는 top 값 그대로(실측 148px) -->
      <div class="frame-block" data-text-frame="true" id="dropped"
           style="position:absolute;left:0px;top:148px;width:400px;height:166px;"></div>
    </div>
  </div>
</body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({ contentType: 'text/html', body: HARNESS });
    }
    if (url.pathname === '/frame-geometry.js') {
      return route.fulfill({
        contentType: 'application/javascript',
        body: fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8'),
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

const measure = () => {
  const g = document.getElementById('grp');
  const d = document.getElementById('dropped');
  const gr = g.getBoundingClientRect();
  const dr = d.getBoundingClientRect();
  return {
    grpBottom: Math.round(gr.bottom),
    dropBottom: Math.round(dr.bottom),
    clipped: Math.round(dr.bottom) > Math.round(gr.bottom),
    styleH: g.style.height,
    minH: g.style.minHeight,
    dsH: g.dataset.height,
  };
};

test('음성대조 — 고침을 안 부르면 끌어 넣은 블럭이 그룹 밑변 너머로 잘린다', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(measure);
  expect(before.clipped).toBe(true);           // 148 + 166 = 314 > 120
  expect(before.dropBottom - before.grpBottom).toBe(194);
});

test('고침 — growFrameToFitChildren 뒤엔 잘리지 않고 세 값이 함께 간다', async ({ page }) => {
  await boot(page);
  const grown = await page.evaluate(() => window.growFrameToFitChildren(document.getElementById('grp')));
  expect(grown).toBe(1);
  const after = await page.evaluate(measure);
  expect(after.clipped).toBe(false);
  expect(after.styleH).toBe('314px');
  expect(after.minH).toBe('314px');            // 재로드·리사이즈 규약(block-drag:394)과 같은 세 값
  expect(after.dsH).toBe('314');               // ★빠지면 undo/redo·재로드가 120 으로 되돌린다
});

test('넓히기만 한다 — 이미 충분히 큰 프레임은 줄이지 않는다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const g = document.getElementById('grp');
    g.style.height = '900px'; g.style.minHeight = '900px'; g.dataset.height = '900';
  });
  const grown = await page.evaluate(() => window.growFrameToFitChildren(document.getElementById('grp')));
  expect(grown).toBe(0);
  const after = await page.evaluate(measure);
  expect(after.styleH).toBe('900px');
  expect(after.dsH).toBe('900');
});

test('자유배치 프레임이 아니면 손대지 않는다', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { delete document.getElementById('grp').dataset.freeLayout; });
  const grown = await page.evaluate(() => window.growFrameToFitChildren(document.getElementById('grp')));
  expect(grown).toBe(0);
  expect((await page.evaluate(measure)).styleH).toBe('120px');
});
