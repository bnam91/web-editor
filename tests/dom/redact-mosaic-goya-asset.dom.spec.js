/* redact-mosaic-goya-asset.dom.spec.js — T-071 «0920b-mosaic-cause»: 모자이크가 «안 되던» 진짜 원인.
 *
 * ★「안 된다」의 정체(2026-09-22, 실앱 9646 · 줌 40% 실측):
 *   captureMosaicSnapshot 은 true 를, isMosaicCaptured 도 true 를 돌려주는데,
 *   모자이크 캔버스 16픽셀이 «전부 255,255,255» 였다(밑에 깔린 그림은 red 2048·blue 2048).
 *   ⇒ 「안 불린다」도 「빈 그림(회색)」도 아니고 «그려졌는데 밑그림이 아니라 단색»이다.
 *
 * ★원인 — html2canvas 1.4.1 은 이미지를 «자기가 다시 로드»한다(vendor CacheStorage.loadImage):
 *     useCORS:true  → crossOrigin="anonymous" 를 달고 로드 → goya-asset:// 응답엔 CORS 헤더가
 *                     없어 onerror (실측: crossOrigin 없이는 같은 URL 이 naturalWidth 64 로 뜬다)
 *     useCORS:false → 로드 조건(same-origin/data:/blob:/proxy/useCORS)이 전부 거짓 → «읽지도 않는다»
 *   빠진 자리는 섹션 배경색으로 «불투명»하게 찍혀 _isSuspiciouslyBlank(불투명 5% 미만)를 통과한다
 *   ⇒ 실패가 «성공»으로 보고되고, 회색 안전실패도 패널의 「캡처 실패」 표시도 안 뜬다.
 *
 * ★이 검사가 잠그는 것 — «빈 그림인지»를 눈이 아니라 픽셀·바이트로 잰다:
 *   G1 goya-asset 이미지가 모자이크에 «실제 픽셀»로 실린다(왼쪽=빨강·오른쪽=파랑, 단색 아님)
 *   G1-neg ★음성대조 — 고치기 «전»(BASE_REF) 소스로는 같은 하네스가 «단색»이다
 *   G2 에셋을 못 읽으면 캡처가 «실패»로 끝난다(조용한 단색 네모 금지) + 캔버스 미생성(=회색 안전실패)
 *   G3 background-image 로 깔린 goya-asset 도 실린다
 *   G4 ★라이브 DOM 은 안 바뀐다 — 저장 HTML 에 base64 가 새면 안 된다
 *   G5 ★«data:,»(6자) 함정 — toDataURL 은 0×0 캔버스에서 던지지 않고 6자를 돌려준다
 *
 * ⛔앱을 «안» 띄운다 — 레포의 진짜 파일 + 진짜 html2canvas 만 얹는다. 흉내(mock)로는
 *   «html2canvas 가 무엇을 그리는가»를 증명할 수 없다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js redact-mosaic-goya-asset
 */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 음성대조 기준 = 이 픽스 «직전»의 dev. 여기선 goya-asset 이미지가 캡처에서 통째로 빠진다. */
const BASE_REF = '12865a1';
const SWAP = ['js/effects/redact-mosaic.js', 'js/io/goya-asset-inline.js'];
const baseSrc = (rel) => execFileSync('git', ['show', `${BASE_REF}:${rel}`], { cwd: REPO, encoding: 'utf8' });

const ASSET_URL = 'goya-asset://proj_t071/half.png';

/* 하네스 — 현빈 기본 줌 40%(#canvas-scaler transform:scale) 안의 섹션.
   섹션 전면에 goya-asset 이미지 1장(왼쪽 절반 빨강 / 오른쪽 절반 파랑),
   그 경계를 물고 모자이크 가림막 하나. ⇒ 모자이크 왼쪽 끝=빨강·오른쪽 끝=파랑이면
   «그 이미지를, 그 자리로» 찍은 것이다. 단색이면 이미지가 통째로 빠진 것이다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#fff}
  #canvas-wrap{position:relative;width:1200px;height:900px;overflow:hidden}
  #canvas-scaler{position:absolute;left:20px;top:20px;width:860px;transform-origin:0 0;transform:scale(0.4)}
  .section-block{position:relative;width:860px;height:400px;background:#ffffff}
  #ph{position:absolute;left:0;top:0;width:860px;height:400px;object-fit:fill}
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler">
  <div class="section-block" id="sec1">
    <img id="ph" src="${ASSET_URL}">
    <div class="shape-block shape-redact" id="shp_1" data-shape-type="rectangle"
         data-shape-redact="true" data-shape-redact-mode="mosaic" data-shape-redact-blur="2"
         style="position:absolute;left:300px;top:100px;width:200px;height:200px;"></div>
  </div>
</div></div>
</body></html>`;

async function boot(page, { which = 'head', readerFails = false, bgMode = false } = {}) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const rel = url.pathname.slice(1);
    if (which === 'base' && SWAP.includes(rel)) {
      return route.fulfill({ contentType: MIME[path.extname(rel)] || 'text/plain', body: baseSrc(rel) });
    }
    const file = path.join(REPO, rel);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.addScriptTag({ url: '/vendor/html2canvas/html2canvas.min.js' });
  await page.evaluate(({ fails, bg, assetUrl }) => {
    window.currentZoom = 40;
    // 왼쪽 절반 빨강 / 오른쪽 절반 파랑 — «에셋의 진짜 바이트»는 data: URI 로만 존재한다.
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = 'rgb(255,0,0)'; x.fillRect(0, 0, 32, 64);
    x.fillStyle = 'rgb(0,0,255)'; x.fillRect(32, 0, 32, 64);
    window.__ASSET_DATA_URI = c.toDataURL('image/png');
    window.__readerCalls = [];
    // preload.js 의 assets:readAsDataUri IPC 흉내 — «앱 밖»에서 goya-asset 을 풀 수 있는 유일한 문.
    window.electronAPI = {
      assetsReadAsDataUri: async ({ projectId, filename }) => {
        window.__readerCalls.push(`${projectId}/${filename}`);
        if (fails) return { ok: false, error: 'T071 probe — 일부러 실패' };
        return { ok: true, dataUri: window.__ASSET_DATA_URI };
      },
    };
    if (bg) {
      // G3 — <img> 대신 섹션의 background-image 로 같은 에셋을 깐다.
      document.getElementById('ph').remove();
      const sec = document.getElementById('sec1');
      // ⚠️세 줄은 block-factory.js setSectionBgImage 와 «같은 값»이어야 한다 — 픽셀 크기로
      //   background-size 를 주면 html2canvas 가 조상 transform:scale 을 안 먹어 «엉뚱한 자리»가
      //   찍힌다(2026-09-22 실측: 줌 40%에서 크롭 전체가 빨강). 제품은 cover 라 그 축이 없다.
      sec.style.backgroundImage = `url("${assetUrl}")`;
      sec.style.backgroundSize = 'cover';
      sec.style.backgroundPosition = 'center';
      sec.style.backgroundRepeat = 'no-repeat';
    }
  }, { fails: readerFails, bg: bgMode, assetUrl: ASSET_URL });
  await page.addScriptTag({ url: '/js/effects/redact-mosaic.js', type: 'module' });
  await page.waitForFunction(() => typeof window.captureMosaicSnapshot === 'function' && typeof window.html2canvas === 'function');
  return errs;
}

/* 캡처하고 «픽셀·바이트»로 잰다 — 「흐려 보인다」 같은 눈 판정은 쓰지 않는다. */
async function captureAndProbe(page) {
  return page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const ok = await window.captureMosaicSnapshot(b);
    const c = b.querySelector(':scope > canvas.redact-mosaic-canvas');
    const base = { ok, cap: window.isMosaicCaptured(b), readerCalls: window.__readerCalls.slice(), canvas: null };
    if (!c) return base;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let red = 0, blue = 0, opaque = 0;
    const uniq = new Set();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 8) opaque++;
      uniq.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      if (d[i] > 180 && d[i + 1] < 70 && d[i + 2] < 70) red++;
      if (d[i + 2] > 180 && d[i] < 70 && d[i + 1] < 70) blue++;
    }
    const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
    const midY = Math.floor(c.height / 2);
    // ★「빈 그림」을 «바이트»로도 잰다 — toDataURL 은 0×0 캔버스에서 던지지 않고 "data:,"(6자)를 준다.
    let dataUrlLen = -1;
    try { dataUrlLen = c.toDataURL('image/png').length; } catch (_) { dataUrlLen = -2; }
    return {
      ...base,
      canvas: [c.width, c.height],
      total: c.width * c.height, red, blue, opaque, uniqueColors: uniq.size,
      left: px(0, midY), right: px(c.width - 1, midY), dataUrlLen,
      liveImgSrc: document.getElementById('ph')?.getAttribute('src') ?? null,
      liveSecBg: document.getElementById('sec1').style.backgroundImage,
    };
  });
}

const isRed = (p) => p[0] > 180 && p[1] < 70 && p[2] < 70 && p[3] > 250;
const isBlue = (p) => p[2] > 180 && p[0] < 70 && p[1] < 70 && p[3] > 250;

test('G1 ★goya-asset 이미지가 모자이크에 «실제 픽셀»로 실린다 (줌 40%, 왼쪽=빨강·오른쪽=파랑)', async ({ page }) => {
  const errs = await boot(page);
  const out = await captureAndProbe(page);
  expect(out.ok, '캡처가 실패했다(회색 유지)').toBe(true);
  expect(out.cap).toBe(true);
  expect(out.canvas, '모자이크 캔버스가 없다').not.toBeNull();
  expect(out.readerCalls, '★에셋 리더(assets:readAsDataUri)가 안 불렸다 — 인라인 경로를 안 탔다').toEqual(['proj_t071/half.png']);
  expect(out.uniqueColors, `★단색이다(=이미지가 캡처에서 빠졌다). 색 ${out.uniqueColors}종`).toBeGreaterThan(1);
  expect(out.red, '밑의 빨강이 한 픽셀도 없다').toBeGreaterThan(0);
  expect(out.blue, '밑의 파랑이 한 픽셀도 없다').toBeGreaterThan(0);
  expect(isRed(out.left), `왼쪽 끝 픽셀이 빨강이 아니다: ${JSON.stringify(out.left)}`).toBe(true);
  expect(isBlue(out.right), `오른쪽 끝 픽셀이 파랑이 아니다: ${JSON.stringify(out.right)}`).toBe(true);
  expect(out.opaque, '★투명 픽셀(원본이 비칠 구멍)이 있다').toBe(out.total);
  expect(out.dataUrlLen, '★toDataURL 이 "data:,"(6자) — 0×0 캔버스 함정').toBeGreaterThan(64);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G1-neg ★음성대조 — 고치기 «전»(dev ' + BASE_REF + ') 소스로는 같은 하네스가 «단색»이다', async ({ page }) => {
  const errs = await boot(page, { which: 'base' });
  const out = await captureAndProbe(page);
  // 옛 코드도 «성공»을 돌려준다 — 그게 이 결함이 8번을 고쳤는데도 안 잡힌 까닭이다.
  expect(out.ok, '옛 코드가 실패를 돌려줬다면 이 음성대조는 다른 것을 재고 있다').toBe(true);
  expect(out.readerCalls, '옛 코드엔 에셋 인라인 경로 자체가 없다').toEqual([]);
  expect(out.uniqueColors, `★옛 코드인데 색이 여러 개다 — 하네스가 결함을 재현 못 하고 있다(색 ${out.uniqueColors}종)`).toBe(1);
  expect(out.red, '★옛 코드인데 빨강이 있다').toBe(0);
  expect(out.blue, '★옛 코드인데 파랑이 있다').toBe(0);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G2 ★에셋을 못 읽으면 «실패»로 끝난다 — 조용한 단색 네모 금지(회색 안전실패로 남는다)', async ({ page }) => {
  const errs = await boot(page, { readerFails: true });
  const out = await captureAndProbe(page);
  expect(out.ok, '★못 읽었는데 «성공»을 돌려줬다 — 이게 이 카드의 원래 결함이다').toBe(false);
  expect(out.cap, '★«캡처됨» 표시가 붙었다 — export 안전실패가 빠진다').toBe(false);
  expect(out.canvas, '★캔버스가 생겼다 — 못 찍었으면 이전 상태(회색 안전실패)를 그대로 둬야 한다').toBeNull();
  expect(out.readerCalls.length, '리더는 불렸어야 한다(실패로)').toBeGreaterThan(0);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G3 background-image 로 깔린 goya-asset 도 모자이크에 실린다', async ({ page }) => {
  const errs = await boot(page, { bgMode: true });
  const out = await captureAndProbe(page);
  expect(out.ok).toBe(true);
  expect(out.readerCalls).toEqual(['proj_t071/half.png']);
  expect(out.uniqueColors, `★단색이다(배경 경로가 안 실렸다). 색 ${out.uniqueColors}종`).toBeGreaterThan(1);
  expect(isRed(out.left), `왼쪽 끝: ${JSON.stringify(out.left)}`).toBe(true);
  expect(isBlue(out.right), `오른쪽 끝: ${JSON.stringify(out.right)}`).toBe(true);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('G4 ★라이브 DOM 은 한 글자도 안 바뀐다 — 저장 HTML 에 base64 가 새면 안 된다', async ({ page }) => {
  const errs = await boot(page);
  const out = await captureAndProbe(page);
  expect(out.ok).toBe(true);
  expect(out.liveImgSrc, '★라이브 img 의 src 가 data: 로 바뀌었다 — 저장본이 base64 로 부푼다').toBe(ASSET_URL);
  const leaked = await page.evaluate(() => document.getElementById('sec1').outerHTML.indexOf('data:image'));
  expect(leaked, '★섹션 HTML 안에 data:image 가 들어갔다(직렬화 누수)').toBe(-1);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
