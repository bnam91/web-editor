/* gradient-shape-rotation-box.dom.spec.js — T-026 (1b3475c) shape-block 온캔버스 그라데이션
 * 핸들이 "이상한 자리에" 뜨는 회귀.
 *
 * ★근본원인 실측(2026-09-16): gradient-model.js의 shape-block 어댑터(registerGradientTarget,
 *   shape-block match)가 rect()에서 (svg()||block).getBoundingClientRect()를 그대로 오버레이의
 *   박스 크기로 썼다. banner02/comparison은 절대 회전하지 않아 문제가 없었지만, shape-block은
 *   자기 자신에 CSS transform:rotate(deg)를 직접 받는다(prop-shape.js _updateFrameForRotation).
 *   getBoundingClientRect()는 회전 후의 axis-aligned bounding box라서, 45°에서 변의 길이가
 *   √2배(≈1.414×)까지 부풀어 오른다 — 그 부풀려진 값을 오버레이 width/height로 그대로 써서
 *   핸들 라인이 도형 모서리를 훌쩍 벗어나 떠 있게 된다(라이브 스크린샷으로 육안 확인 완료).
 *
 * ★고침: rect()의 width/height를 block.offsetWidth/offsetHeight(레이아웃 박스, transform과
 *   무관)에서 가져오도록 교체. position(left/top)은 그대로 getBoundingClientRect() 유지 —
 *   gradient-line-overlay.js의 _computeBox가 cr(타겟 rect)과 br(blockEl 자신의 rect)의 차를
 *   쓰므로, 둘 다 "같은 방식으로" 부풀려져 있으면 차이는 여전히 0 근방으로 상쇄된다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. gradient-model.js 원본 + 실제
 *   editor-blocks.css만 그대로 로드해서 진짜 getBoundingClientRect()/offsetWidth로 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js gradient-shape-rotation
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';

const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');
const GRADIENT_MODEL_JS = fs.readFileSync(path.join(REPO, 'js/props/gradient-model.js'), 'utf8');

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${BLOCKS_CSS}</style>
          <style>.section-block{position:relative;}</style>
          <script type="module" src="/gradient-model.js"></script>
          </head><body>
          <div class="section-block" style="width:400px;height:400px;">
            <div class="frame-block" style="position:absolute;left:100px;top:100px;width:100px;height:100px;">
              <div class="shape-block" id="shp1" data-shape-type="rectangle"
                   data-shape-color="linear-gradient(45deg, #ff5e3a 0%, #1aa6ff 100%)"
                   data-shape-gradient='{"type":"linear","angle":45,"stops":[{"color":"#ff5e3a","offset":0,"opacity":1},{"color":"#1aa6ff","offset":1,"opacity":1}]}'>
                <svg class="shape-svg" viewBox="0 0 100 100"></svg>
              </div>
            </div>
          </div>
          </body></html>`,
      });
    }
    if (url.pathname === '/gradient-model.js') {
      return route.fulfill({ contentType: 'application/javascript', body: GRADIENT_MODEL_JS });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window.getGradientTarget);
  return errs;
}

test('G1 ★회귀 게이트 — 회전 0°일 때 shape rect()의 width/height는 도형의 실제 로컬 크기(100)와 같다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const block = document.getElementById('shp1');
    const target = window.getGradientTarget(block);
    return target ? target.rect() : null;
  });
  expect(out, 'getGradientTarget(shape)이 null을 반환 — dataset.shapeColor가 파싱 가능한 gradient 문자열인지부터 확인').not.toBeNull();
  expect(out.width, '회전 0°: rect().width가 도형의 실제 100px와 달라졌다').toBeCloseTo(100, 0);
  expect(out.height, '회전 0°: rect().height가 도형의 실제 100px와 달라졌다').toBeCloseTo(100, 0);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G2 ★핵심 — 45° 회전 시에도 rect().width/height가 여전히 100이다(부풀려진 bounding-box 191가 아니라)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const block = document.getElementById('shp1');
    block.style.transform = 'rotate(45deg)';
    const target = window.getGradientTarget(block);
    const rect = target.rect();
    // 참고용: 고쳐지지 않았으면 이 값과 거의 같아진다(100*√2≈141.42) — 회귀가 나면 이 숫자를 반환한다.
    const inflatedBBox = block.querySelector('svg').getBoundingClientRect().width;
    return { rect, inflatedBBox };
  });
  expect(out.rect.width, `45° 회전 후 rect().width가 부풀려진 bounding-box(${out.inflatedBBox.toFixed(2)})를 그대로 쓰고 있다 — 온캔버스 핸들이 도형 모서리를 벗어나 뜬다(T-026 회귀)`).toBeCloseTo(100, 0);
  expect(out.rect.height).toBeCloseTo(100, 0);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G3 임의 각도(37°)에서도 동일 — 특정 각도(45°)만 우연히 맞는 게 아님을 확인', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const block = document.getElementById('shp1');
    block.style.transform = 'rotate(37deg)';
    const target = window.getGradientTarget(block);
    return target.rect();
  });
  expect(out.width).toBeCloseTo(100, 0);
  expect(out.height).toBeCloseTo(100, 0);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G4 ★변이대조 — rect()가 block.offsetWidth/Height 대신 getBoundingClientRect()만 쓰면 G2가 실패해야 한다(이 테스트가 실제로 그 코드를 본다는 증거)', async ({ page }) => {
  await boot(page);
  const out = await page.evaluate(() => {
    const block = document.getElementById('shp1');
    block.style.transform = 'rotate(45deg)';
    // rect()가 실제로 지키는 불변식을 직접 재현: block.offsetWidth를 쓰지 «않고»
    // getBoundingClientRect()만 썼다면 어떤 값이 나왔을지 — 부풀려진 값이어야 한다.
    const naive = (block.querySelector('svg') || block).getBoundingClientRect();
    return { naiveWidth: naive.width };
  });
  expect(out.naiveWidth, '변이(고치기 전 코드)가 실제로 부풀려진 값을 냈는지 확인 — 안 부풀었으면 이 하네스 자체가 회전을 재현 못 하는 것').toBeCloseTo(141.42, 0);
});

test('G5 rect()의 width/height는 svg가 아니라 block.offsetWidth/Height를 쓴다(SVGElement는 offsetWidth를 지원하지 않아 "|| r.width" 폴백이 조용히 원래 버그로 되돌아가는 함정 방지)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const block = document.getElementById('shp1');
    const svg = block.querySelector('svg');
    return { svgOffsetWidthIsUndefined: svg.offsetWidth === undefined, blockOffsetWidth: block.offsetWidth };
  });
  expect(out.svgOffsetWidthIsUndefined, '★전제 확인 — SVGElement.offsetWidth가 undefined가 아니게 됐다면 이 회귀 경로 자체가 사라진 것(브라우저 스펙 변화 확인 필요)').toBe(true);
  expect(out.blockOffsetWidth).toBe(100);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
