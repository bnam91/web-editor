/* overlay-zindex-hittest.dom.spec.js — 현빈 실측: "오버레이 텍스트를 클릭하려고 해도 쉽게
 * 잘 안 된다".
 *
 * ★근본원인(재현 확정): .frame-block[data-text-frame="true"][data-overlay-block="true"]는
 *   position:absolute만 받고 z-index가 없었다(기본 auto). 섹션 본문 흐름 콘텐츠(.tb-body 등)
 *   와 화면에서 겹치면, 스태킹 순서가 DOM 순서/다른 규칙에 밀려 오버레이가 «아래로» 깔릴 수
 *   있었다 — 실측: elementFromPoint를 오버레이 자기 중심 좌표에서 불러도 밑에 깔린 .tb-body가
 *   돌아옴(클릭이 오버레이가 아니라 흐름 텍스트로 감).
 *
 * ★고침: css/editor-blocks.css에 .frame-block[data-text-frame="true"][data-overlay-block="true"]
 *   { z-index: 80; } 추가 — 이 레포의 기존 z-index 관례(섹션 콘텐츠 위 80 · 선택 아웃라인 90 ·
 *   리사이즈 핸들 9990대)를 그대로 따른다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 실제 editor-blocks.css를 그대로
 *   로드해서 진짜 elementFromPoint로 겹친 자리에서 «어느 엘리먼트가 잡히는지» 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-zindex-hittest
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${BLOCKS_CSS}</style>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; }
            .section-block { position: relative; width: 800px; height: 600px; background: #fff; }
            .section-inner { position: relative; }
            .tb-body { position: relative; width: 700px; height: 400px; }
          </style>
          </head><body>
          <div class="section-block" id="sec1">
            <div class="section-inner">
              <!-- ★실제 QA 프로젝트 구조와 같은 순서(현빈 실측 재현) — 흐름 본문 텍스트가
                   오버레이보다 «DOM 뒤»에 오는 경우도 있다(섹션 배치 순서에 따라 달라짐). -->
              <div class="text-block" id="body1"><div class="tb-body" id="tbbody1">본문 텍스트</div></div>
            </div>
            <!-- 오버레이는 섹션 직접 자식(재부모 규약) — DOM순서상 «뒤»지만 z-index 없이는
                 반드시 위에 그려진다는 보장이 없다(실측 결함). -->
            <div class="frame-block" data-text-frame="true" data-overlay-block="true" id="tf1"
                 style="position:absolute; left:100px; top:100px; width:200px; height:60px; background:rgba(0,0,255,0.15);">
              <div class="tb-h2" id="ovtxt">오버레이 텍스트</div>
            </div>
          </div>
          </body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
}

test('전제 — 오버레이와 본문 텍스트가 화면에서 실제로 겹친다', async ({ page }) => {
  await boot(page);
  const overlap = await page.evaluate(() => {
    const ov = document.getElementById('tf1').getBoundingClientRect();
    const body = document.getElementById('tbbody1').getBoundingClientRect();
    return ov.left < body.right && ov.right > body.left && ov.top < body.bottom && ov.bottom > body.top;
  });
  expect(overlap, '테스트 전제가 안 맞다 — 오버레이와 본문이 화면에서 안 겹친다').toBe(true);
});

test('Z1 ★핵심 — 오버레이 중심 좌표에서 elementFromPoint가 오버레이(또는 그 자식)를 돌려준다', async ({ page }) => {
  await boot(page);
  const hit = await page.evaluate(() => {
    const r = document.getElementById('tf1').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const el = document.elementFromPoint(cx, cy);
    return { isOverlayOrChild: !!el.closest('#tf1'), tag: el.tagName, id: el.id, cls: el.className };
  });
  expect(hit.isOverlayOrChild, `오버레이 중심을 클릭했는데 ${hit.tag}#${hit.id}.${hit.cls}가 잡혔다 — 오버레이가 아래에 깔려 있다는 뜻`).toBe(true);
});

test('Z2 computed z-index가 실제로 80이다', async ({ page }) => {
  await boot(page);
  const z = await page.evaluate(() => getComputedStyle(document.getElementById('tf1')).zIndex);
  expect(z, `.frame-block[data-overlay-block="true"]의 z-index가 80이 아니다: ${z}`).toBe('80');
});

test('Z3 [양성대조] z-index 규칙을 빼면 Z1이 실패할 수 있다(겹친 상태에서 오버레이가 안 잡힘)', async ({ page }) => {
  // ★이 검사가 실제로 그 결함을 겨눈다는 증거 — .frame-block 본문 z-index만 없애고
  //   본문 텍스트 쪽에 명시적으로 더 높은 z-index를 줘서 "회귀했던 상태"를 흉내낸다.
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><body>
          <style>
            .section-block { position: relative; width: 800px; height: 600px; }
            .tb-body { position: relative; z-index: 5; width: 700px; height: 400px; }
          </style>
          <div class="section-block">
            <div class="text-block"><div class="tb-body" id="tbbody1">본문 텍스트</div></div>
            <div data-overlay-block="true" id="tf1"
                 style="position:absolute; left:100px; top:100px; width:200px; height:60px;">
              <div id="ovtxt">오버레이 텍스트</div>
            </div>
          </div>
          </body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  const hit = await page.evaluate(() => {
    const r = document.getElementById('tf1').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const el = document.elementFromPoint(cx, cy);
    return !!el.closest('#tf1');
  });
  expect(hit, '양성대조가 재현 안 됨 — z-index 없이도 오버레이가 항상 잡힌다면 Z1이 이 결함을 못 본다는 뜻').toBe(false);
});
