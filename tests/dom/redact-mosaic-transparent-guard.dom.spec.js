/* redact-mosaic-transparent-guard.dom.spec.js — T-027 후속: html2canvas가 «완전 투명»
 * 캡처를 돌려줄 때(export 중 오프스크린 clone이 DOM에 떠 있는 특정 맥락에서 실측된 실패
 * 모드, fix-mosaic-precapture-exposure 조사) 그걸 그대로 신뢰해 "캡처됨"으로 마킹하지
 * 않는지 — 신뢰하면 기존 정상 스냅샷/안전실패 회색을 빈 비트맵이 덮어써 export PNG에
 * 원본이 그대로 노출되는 사고로 이어진다(2026-09-15).
 *
 * ★2차수정(a1-a3 코드리뷰 지적, G4/G5): 1차 방어는 "완전 투명"만 걸러 (1) 다운샘플
 * 평균으로 옅게 뭉개진 «부분» 누수를 놓치고 (2) 읽기 실패(CORS 오염 등)를 "투명 아님"
 * (=신뢰)으로 기본값 잡아 실패열림이었다. _isSuspiciouslyBlank 로 이름을 바꾸고
 * (1)불투명 픽셀 5% 미만이면 의심 + 작은 캔버스는 다운샘플 없이 전체 픽셀 확인,
 * (2)읽기 실패는 "의심스러움"(실패닫힘)으로 고쳤다 — G4/G5 가 이 둘을 잰다.
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
  /* ★모듈을 «파일 URL»로 얹는다 — addScriptTag({content}) 로 얹으면 redact-mosaic.js 의
     상대 import(../io/goya-asset-inline.js)가 «문서 URL» 기준으로 풀려 404 가 난다
     (2026-09-22, T-071 에서 import 가 생기며 드러났다). 아래 route 가 레포의 진짜 파일을 준다. */
  await page.addScriptTag({ url: '/js/effects/redact-mosaic.js', type: 'module' });
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

test('G4 ★부분 누수(대부분 투명+일부만 찍힘)도 "성공"으로 신뢰하지 않는다 — 다운샘플 평균에 옅게 뭉개져 통과하던 구멍(a1-a3 지적①)', async ({ page }) => {
  const errs = await boot(page, { transparent: false });
  const out = await page.evaluate(async () => {
    // html2canvas가 "블록 크기(100×60) 전체"를 돌려주되, 그중 2%(약 120px)만 내용이 있고
    // 나머지는 완전 투명한 경우를 흉내낸다 — 다운샘플(특히 평균/블렌딩)로 스무딩되면
    // "옅게 뭉개진 알파"가 예전 문턱(>8, 아무 픽셀 하나)을 통과해버릴 수 있었다.
    window.html2canvas = async () => {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 60;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 4, 30); // 100×60=6000px 중 120px ≈ 2% 만 불투명
      return c;
    };
    const block = document.getElementById('shp_1');
    const ok = await window.captureMosaicSnapshot(block);
    return { ok, captured: window.isMosaicCaptured(block) };
  });
  expect(out.ok, '★불투명 픽셀이 5% 미만(약 2%)인 부분 캡처를 "성공"으로 잘못 신뢰했다').toBe(false);
  expect(out.captured, '★부분 누수 캡처인데도 isMosaicCaptured 가 true 로 마킹됐다').toBe(false);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G5 ★캔버스 읽기 실패(예: CORS 오염)는 "투명 아님"(신뢰)이 아니라 "의심스러움"(실패닫힘)으로 취급한다(a1-a3 지적②)', async ({ page }) => {
  const errs = await boot(page, { transparent: false });
  const out = await page.evaluate(async () => {
    // getImageData 가 던지는 상황(SecurityError 등)을 직접 흉내낸다 — 진짜 cross-origin
    // 이미지 없이도 "읽기 실패" 분기 자체를 검증할 수 있다.
    window.html2canvas = async () => {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 60;
      const realGetContext = c.getContext.bind(c);
      c.getContext = (type, ...rest) => {
        const ctx = realGetContext(type, ...rest);
        if (type === '2d') {
          ctx.getImageData = () => { throw new Error('SecurityError: tainted canvas (simulated)'); };
        }
        return ctx;
      };
      return c;
    };
    const block = document.getElementById('shp_1');
    const ok = await window.captureMosaicSnapshot(block);
    return { ok, captured: window.isMosaicCaptured(block) };
  });
  expect(out.ok, '★읽기 실패(오염된 캔버스)를 "성공"으로 잘못 신뢰했다 — 예전엔 catch에서 false(투명 아님)를 돌려줘 이 캡처가 실제로 투명 버그 결과여도 걸러내지 못했다').toBe(false);
  expect(out.captured, '★읽기 실패 캡처인데도 isMosaicCaptured 가 true 로 마킹됐다').toBe(false);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
