/* redact-zindex-stacking.dom.spec.js — T-027 진짜 근본원인: 캡처/굽기 버그가 아니라
 * 순수 z-index 충돌이었다(fix-mosaic-precapture-exposure 실측+확정, 2026-09-15).
 *
 * ★배경
 *   .text-block(css/editor-layout.css)은 «무조건» z-index:2. .shape-block은 «선택돼
 *   있을 때만»(.shape-block.selected) z-index:2를 받는다. 라이브 에디터에서 방금 만든/
 *   만지는 redact 도형은 보통 selected 상태라 동률→DOM 순서로 이겨서 "안전해 보였다".
 *   export(prepareCloneForCapture)가 clone에서 .selected를 정당하게 벗겨내면 redact
 *   도형이 z-index:auto로 떨어져 텍스트블록의 무조건 2가 이긴다 — 실측: 텍스트블록 위에
 *   얹은 redact를 export하면 주민등록번호 전체가 단순 threshold 처리만으로 복원됨(픽셀
 *   히스토그램에 원문 색 ~26% 혼합 확인).
 *
 * ★고침: css/editor-blocks.css .shape-block.shape-redact 에 선택 여부 무관 z-index:3
 *   !important 부여(blur/mosaic 공용 베이스 규칙이라 두 모드 다 적용).
 *
 * ★이 테스트가 재는 것: «캡처 메커니즘»이 아니라 «CSS 계산값 자체» — 실제 CSS 파일을
 *   그대로 로드해 getComputedStyle 로 잰다(가짜 스타일 없음). export가 .selected 를
 *   벗겨낸 뒤의 상태(비선택)를 재현하는 게 핵심 — 그게 실제로 샜던 조건이다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 실제 CSS 파일만 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js redact-zindex
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.css': 'text/css', '.html': 'text/html' };

const LAYOUT_CSS = fs.readFileSync(path.join(REPO, 'css/editor-layout.css'), 'utf8');
const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${LAYOUT_CSS}</style>
          <style>${BLOCKS_CSS}</style>
          </head><body>
          <div class="section-block" style="position:relative;width:400px;height:200px;">
            <div class="text-block" id="txt1" style="position:relative;">민감 텍스트 900101-1234567</div>
            <div class="shape-block shape-redact" id="shp1" data-shape-type="rect"
                 data-shape-redact-mode="mosaic"
                 style="position:absolute;left:0;top:0;width:200px;height:60px;"></div>
          </div>
          </body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  return errs;
}

test('Z1 ★핵심 회귀 게이트 — 선택 «해제된»(export 재현 조건) redact 도형이 text-block보다 z-index가 높다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const shp = document.getElementById('shp1');
    const txt = document.getElementById('txt1');
    // ★export의 prepareCloneForCapture가 .selected 를 벗겨내는 것과 같은 조건 — shp1은
    //   처음부터 .selected 를 «안」 준다(export 직전 clone 상태 재현).
    return {
      shpZ: getComputedStyle(shp).zIndex,
      txtZ: getComputedStyle(txt).zIndex,
    };
  });
  expect(out.txtZ, '★전제 확인 — .text-block 은 항상 z-index 2 여야 한다(이 값이 바뀌면 이 테스트 자체를 다시 겨냥해야 한다)').toBe('2');
  const shpN = Number(out.shpZ), txtN = Number(out.txtZ);
  expect(Number.isFinite(shpN), `★.shape-block.shape-redact 의 z-index 가 숫자가 아니다("${out.shpZ}") — auto 로 떨어지면 텍스트에 진다`).toBe(true);
  expect(shpN, '★회귀 — 선택 해제된(export 조건) redact 도형이 text-block(2)보다 z-index 가 낮거나 같다. 이게 바로 export PNG 에서 텍스트가 가림막을 이기고 비치던 원인이다').toBeGreaterThan(txtN);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('Z2 ★선택된 상태에서도(라이브 편집 중 흔한 상태) 여전히 이긴다 — 회귀 없음 확인', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    document.getElementById('shp1').classList.add('selected');
    const shp = document.getElementById('shp1');
    const txt = document.getElementById('txt1');
    return { shpZ: getComputedStyle(shp).zIndex, txtZ: getComputedStyle(txt).zIndex };
  });
  expect(Number(out.shpZ)).toBeGreaterThan(Number(out.txtZ));
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('Z3 ★blur 모드(모자이크 아닌 쪽)도 같은 공용 .shape-redact 규칙을 받는다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const shp = document.getElementById('shp1');
    shp.removeAttribute('data-shape-redact-mode'); // blur는 이 속성이 없다(기본 모드)
    const txt = document.getElementById('txt1');
    return { shpZ: getComputedStyle(shp).zIndex, txtZ: getComputedStyle(txt).zIndex };
  });
  expect(Number(out.shpZ), 'blur 모드 redact 가 text-block 을 안 이긴다').toBeGreaterThan(Number(out.txtZ));
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
