/* redact-mosaic-zoom-crop.dom.spec.js — T-061 픽스 라운드: «줌 100% 미만에서 모자이크가 영영 회색».
 *
 * ★원인(2026-09-19 실측 9502, 줌 41%): html2canvas 1.4.1 은 복제 iframe 안에서 scope 의
 *   getBoundingClientRect(조상 transform:scale 적용된 «화면» 크기)로 렌더한다 — 섹션 353×157 을
 *   찍으면 706×314(=화면 크기×dpr2). 그런데 redact-mosaic.js 는 크롭 좌표를 줌 배율로 «나눴다»
 *   (a82c035 의 «원본 크기로 렌더» 전제) → 크롭이 블록보다 2.5배 크고 어긋나 거의 투명 →
 *   _isSuspiciouslyBlank 가 실패 판정 → 회색 유지.
 *
 * ⛔앱을 «안» 띄운다. 대신 ★진짜 html2canvas(vendor/html2canvas/html2canvas.min.js)를 얹는다 —
 *   흉내(mock)로는 «렌더 좌표계가 무엇인가»를 증명할 수 없기 때문.
 *   하네스: #canvas-scaler(transform:scale(z)) 안의 섹션, 밑에 왼쪽 빨강/오른쪽 파랑 반반,
 *   그 경계 위에 모자이크 도형. 캡처 성공 + 모자이크 왼쪽 끝 픽셀=빨강, 오른쪽 끝=파랑이면
 *   «그 자리»를 찍은 것이다(엉뚱한 자리·빈 자리면 실패/색 불일치).
 * 양성대조: 옛 코드(÷줌)로는 Z1(40%) 이 빨강 — 커밋 전 dev 소스로 돌려 확인(testEvidence 참고).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const H2C_SRC = fs.readFileSync(path.join(REPO, 'vendor/html2canvas/html2canvas.min.js'), 'utf8');

function harness(scale) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#fff}
  #canvas-wrap{position:relative;width:1400px;height:1400px;overflow:hidden}
  #canvas-scaler{position:absolute;left:37px;top:23px;width:860px;transform-origin:0 0;transform:scale(${scale})}
  .section-block{position:relative;width:860px;height:400px;background:#eee}
  .under{position:absolute;top:0;height:400px;width:430px}
  </style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler">
  <div class="section-block" id="sec0" style="height:300px;background:#ccc"></div>
  <div class="section-block" id="sec1">
    <div class="under" style="left:0;background:rgb(255,0,0)"></div>
    <div class="under" style="left:430px;background:rgb(0,0,255)"></div>
    <div class="shape-block shape-redact" id="shp_1" data-shape-redact="true" data-shape-redact-mode="mosaic"
         data-shape-redact-blur="2" style="position:absolute;left:230px;top:100px;width:400px;height:200px;"></div>
  </div>
</div></div>
</body></html>`;
}

async function boot(page, scale) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: harness(scale) });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.addScriptTag({ content: H2C_SRC });
  await page.evaluate((z) => { window.currentZoom = z; }, scale * 100);
  /* ★모듈을 «파일 URL»로 얹는다 — addScriptTag({content}) 로 얹으면 redact-mosaic.js 의
     상대 import(../io/goya-asset-inline.js)가 «문서 URL» 기준으로 풀려 404 가 난다
     (2026-09-22, T-071 에서 import 가 생기며 드러났다). 아래 route 가 레포의 진짜 파일을 준다. */
  await page.addScriptTag({ url: '/js/effects/redact-mosaic.js', type: 'module' });
  await page.waitForFunction(() => typeof window.captureMosaicSnapshot === 'function' && typeof window.html2canvas === 'function');
  return errs;
}

async function captureAndProbe(page) {
  return page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const ok = await window.captureMosaicSnapshot(b);
    const c = b.querySelector(':scope > canvas.redact-mosaic-canvas');
    if (!c) return { ok, cap: window.isMosaicCaptured(b), canvas: null };
    const ctx = c.getContext('2d');
    const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
    const midY = Math.floor(c.height / 2);
    // 전 픽셀 알파(투명 구멍 = 원본 노출 후보) 확인
    const all = ctx.getImageData(0, 0, c.width, c.height).data;
    let transparent = 0;
    for (let i = 3; i < all.length; i += 4) if (all[i] < 250) transparent++;
    return { ok, cap: window.isMosaicCaptured(b), canvas: [c.width, c.height], left: px(0, midY), right: px(c.width - 1, midY), transparent };
  });
}

const isRed = (p) => p[0] > 200 && p[1] < 60 && p[2] < 60 && p[3] > 250;
const isBlue = (p) => p[2] > 200 && p[0] < 60 && p[1] < 60 && p[3] > 250;

for (const [id, scale] of [['Z1 ★줌 40%(신규 기본값)', 0.4], ['Z2 줌 100%', 1], ['Z3 줌 150%', 1.5], ['Z4 줌 41%(평가 실측 배율)', 0.41]]) {
  test(`${id} — 모자이크가 «그 자리»를 찍는다(왼쪽=빨강, 오른쪽=파랑, 투명 구멍 0)`, async ({ page }) => {
    const errs = await boot(page, scale);
    const out = await captureAndProbe(page);
    expect(out.ok, `★${scale * 100}% 줌에서 캡처가 실패했다(회색 유지) — 크롭 좌표계 불일치 의심`).toBe(true);
    expect(out.cap).toBe(true);
    expect(isRed(out.left), `왼쪽 끝 픽셀이 밑의 빨강이 아니다: ${JSON.stringify(out.left)}`).toBe(true);
    expect(isBlue(out.right), `오른쪽 끝 픽셀이 밑의 파랑이 아니다: ${JSON.stringify(out.right)}`).toBe(true);
    expect(out.transparent, '★모자이크 캔버스에 투명 픽셀(원본이 비칠 구멍)이 있다').toBe(0);
    expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  });
}

test('Z5 html2canvas 에 넘기는 크롭 = 화면(줌 적용) 좌표 그대로, scale=1', async ({ page }) => {
  const errs = await boot(page, 0.4);
  const out = await page.evaluate(async () => {
    const real = window.html2canvas;
    let seen = null;
    window.html2canvas = (scope, opts) => { seen = { ...opts, ignoreElements: undefined }; return real(scope, opts); };
    const b = document.getElementById('shp_1');
    await window.captureMosaicSnapshot(b);
    const r = b.getBoundingClientRect();
    const s = b.closest('.section-block').getBoundingClientRect();
    return { seen, want: { x: r.left - s.left, y: r.top - s.top, width: Math.round(r.width), height: Math.round(r.height) } };
  });
  expect(out.seen.x).toBeCloseTo(out.want.x, 3);
  expect(out.seen.y).toBeCloseTo(out.want.y, 3);
  expect(out.seen.width).toBe(out.want.width);
  expect(out.seen.height).toBe(out.want.height);
  expect(out.seen.scale).toBe(1);
  expect(errs).toEqual([]);
});

test('Z6 ★칸 수는 줌과 무관 — 400×200 가림막·강도 2(칸 19px)면 줌 40/100/150/200% 모두 21×11칸(0918 리뷰: 전엔 40%=8×4, 200%=42×21 → export 칸 < 16px)', async ({ page }) => {
  const seen = {};
  for (const scale of [0.4, 1, 1.5, 2]) {
    const errs = await boot(page, scale);
    const out = await captureAndProbe(page);
    expect(out.ok, `줌 ${scale * 100}% 캡처 실패`).toBe(true);
    const bpx = await page.evaluate(() => window.mosaicBlockPxFromSlider('2'));
    seen[scale] = out.canvas;
    expect(out.canvas, `줌 ${scale * 100}%`).toEqual([Math.round(400 / bpx), Math.round(200 / bpx)]);
    // 캔버스 기준 칸 크기가 하한(16px) 이상
    expect(400 / out.canvas[0]).toBeGreaterThanOrEqual(16);
    expect(errs).toEqual([]);
  }
});
