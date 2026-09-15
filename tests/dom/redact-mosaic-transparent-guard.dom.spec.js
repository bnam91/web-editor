/* redact-mosaic-transparent-guard.dom.spec.js — T-027 후속: html2canvas가 «완전 투명»
 * 캡처를 돌려줄 때(export 중 오프스크린 clone이 DOM에 떠 있는 특정 맥락에서 실측된 실패
 * 모드, fix-mosaic-precapture-exposure 조사) 그걸 그대로 신뢰해 "캡처됨"으로 마킹하지
 * 않는지 — 신뢰하면 기존 정상 스냅샷/안전실패 회색을 빈 비트맵이 덮어써 export PNG에
 * 원본이 그대로 노출되는 사고로 이어진다(2026-09-15).
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. redact-mosaic.js 만 얹고
 *   window.html2canvas 는 이 파일이 직접 흉내낸다(template-marker-leak.dom.spec.js 와
 *   같은 하네스 패턴).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js redact-mosaic-transparent
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript' };

const MOSAIC_SRC = fs.readFileSync(path.join(REPO, 'js/effects/redact-mosaic.js'), 'utf8');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div class="section-block" id="sec1" style="position:relative;width:300px;height:150px;">
  <div class="shape-block shape-redact" id="shp_1" data-shape-redact-mode="mosaic"
       style="position:absolute;left:0;top:0;width:100px;height:60px;"></div>
</div>
</body></html>`;

async function boot(page, { transparent }) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.addScriptTag({ content: MOSAIC_SRC, type: 'module' });
  // html2canvas를 흉내낸다 — transparent=true면 "완전 투명" 캔버스(실측된 실패 모드),
  // false면 실제로 내용이 찍힌 정상 캔버스를 돌려준다.
  await page.evaluate((transparent) => {
    window.html2canvas = async (_scope, _opts) => {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 60;
      const ctx = c.getContext('2d');
      if (!transparent) {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 100, 60); // 알파 있는 내용 — "정상 캡처"
      }
      // transparent=true면 아무것도 안 그린다 — 기본이 전부 알파 0인 빈 캔버스.
      return c;
    };
  }, transparent);
  return errs;
}

test('G1 ★정상 캡처(내용 있음)는 캡처됨으로 마킹되고 캔버스가 갱신된다 — 양성대조', async ({ page }) => {
  const errs = await boot(page, { transparent: false });
  const out = await page.evaluate(async () => {
    const block = document.getElementById('shp_1');
    const ok = await window.captureMosaicSnapshot(block);
    return { ok, captured: window.isMosaicCaptured(block) };
  });
  expect(out.ok, '★정상(불투명) 캡처인데 실패로 판정됐다').toBe(true);
  expect(out.captured, '★정상 캡처인데 isMosaicCaptured 가 false 다').toBe(true);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G2 ★완전 투명 캡처는 "실패"로 취급 — 캡처됨으로 마킹하지 않는다(2026-09-15 export 누수 방지)', async ({ page }) => {
  const errs = await boot(page, { transparent: true });
  const out = await page.evaluate(async () => {
    const block = document.getElementById('shp_1');
    const ok = await window.captureMosaicSnapshot(block);
    return { ok, captured: window.isMosaicCaptured(block) };
  });
  expect(out.ok, '★완전 투명 캡처를 "성공"으로 잘못 판정했다 — export 시 그대로 신뢰되면 원본이 샌다').toBe(false);
  expect(out.captured, '★완전 투명 캡처인데도 isMosaicCaptured 가 true 로 마킹됐다').toBe(false);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G3 ★기존 정상 캡처가 있는 상태에서 재캡처가 투명하게 실패해도, 기존 캔버스(마지막 정상 스냅샷)가 그대로 남는다', async ({ page }) => {
  // 1차는 정상 캡처 → 2차(재캡처)만 투명하게 만들어 "export 중 재캡처가 망가지는" 시나리오를 재현.
  const errs = await boot(page, { transparent: false });
  const out = await page.evaluate(async () => {
    const block = document.getElementById('shp_1');
    await window.captureMosaicSnapshot(block); // 1차 — 정상
    const canvasBefore = block.querySelector('canvas.redact-mosaic-canvas');
    const dataBefore = canvasBefore.toDataURL();

    // 2차 재캡처만 투명하게 흉내낸다(reuseFullRes 안 쓰고 실제 재호출 경로 그대로).
    window.html2canvas = async () => {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 60; // 완전 투명 — 아무것도 안 그림
      return c;
    };
    const ok2 = await window.captureMosaicSnapshot(block);
    const canvasAfter = block.querySelector('canvas.redact-mosaic-canvas');
    const dataAfter = canvasAfter.toDataURL();
    return { ok2, unchanged: dataBefore === dataAfter, stillCaptured: window.isMosaicCaptured(block) };
  });
  expect(out.ok2, '★재캡처(투명) 자체는 실패로 보고돼야 한다').toBe(false);
  expect(out.unchanged, '★재캡처가 투명하게 실패했는데 기존 정상 캔버스 내용이 바뀌었다 — export가 이 빈 내용을 쓸 위험').toBe(true);
  expect(out.stillCaptured, '★재캡처 실패로 isMosaicCaptured 가 꺼지면 안 된다(1차 캡처는 여전히 유효)').toBe(true);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
