/* handle-size-parity.dom.spec.js — 「모서리 핸들이 어떤건 두껍고 크기도 좀 다르다」 [0921H-handleunify]
 *
 * ★현빈 2026-09-21: 「에셋블럭에 들어가는 모서리 핸들정도가 좋은 거 같아」 ⇒ 기준 = 에셋 블럭 손잡이.
 *   실앱 실측(포트 9516 · 줌 40/100/150 · dpr 2 · 화면 px):
 *     고치기 전 — 에셋 계열 1.5 / 프레임·목업·iconify·이미지편집 1.0 / 그라데이션 1.0 /
 *                 스티커 0.4·1.0·1.5(줌마다 달랐다)
 *     고친 뒤   — 전부 1.5 (스티커 줌40 만 1.4 = 디바이스 픽셀 스냅, 아래 B3 주석)
 *
 * ★이 파일이 «소스 검사»(tests/unit/handle-token-parity.test.mjs)와 다른 것을 잰다:
 *   저쪽은 「같은 토큰을 쓰나」, 이쪽은 「화면에서 같은 굵기로 그려지나」.
 *   증거 — `--ui-handle-border-w` 를 1.5px → 1px 로 되돌리면 저쪽은 «초록»(같은 토큰이니까)인데
 *   이쪽은 «빨강»이 된다. 2026-09-21 에 실제로 돌려 확인했다.
 *
 * ★층이 둘이고 «화면 px» 이 둘의 공통 단위다:
 *   ⑴ 고정층 #ss-handles-overlay — #canvas-scaler «밖». 배율 ×1.
 *   ⑵ 캔버스 안 — .sticker-block 같은 블럭의 자식. 배율 ×scale, 그래서 크기·두께 둘 다
 *      --inv-zoom 을 곱해 화면에서 되돌린다. 탈출한 손잡이(도형·그라데이션)는 ⑴로 옮겨지고
 *      #ss-handles-overlay 오버라이드가 그 곱을 «되돌린다».
 *
 * ⛔회전 0 만 다룬다 — 회전 블럭은 getBoundingClientRect 가 AABB 라 크기가 커 보여 오탐이 난다.
 * ⛔앱을 «안» 띄운다. 정본 패턴 = tests/dom/handle-escape-hittest.dom.spec.js.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js handle-size-parity
 */
const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 고정층에 사는 손잡이들 = 실앱에서 js 가 #ss-handles-overlay 의 «직계 자식»으로 붙이는 것들.
   ⛔이름 목록을 검사가 «단정»하지는 않는다 — 여기 적힌 것은 «표본»이고, 목록이 자라는 것은
     tests/unit/handle-token-parity.test.mjs 가 모양으로 잡는다(거긴 이름을 안 적는다). */
const OVERLAY_HANDLES = [
  'asset-overlay-handle', 'icb-overlay-handle', 'zm-overlay-handle', 'mdl-overlay-handle',
  'tfo-overlay-handle', 'grd-img-overlay-handle', 'canvas-overlay-handle', 'vector-overlay-handle',
  'ss-resize-handle', 'img-corner-handle',
];
/* 경계 부품 — 통일 대상이 «아니다». 같이 재서 「안 변했다」를 증명한다. */
const BOUNDARY = ['asset-radius-handle', 'ss-radius-handle', 'img-edge-handle'];

const overlayKids = [...OVERLAY_HANDLES, ...BOUNDARY]
  .map((c) => `<div class="${c} nw" data-dir="nw" style="left:40px;top:40px"></div>`).join('\n  ');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>
  html, body { margin:0; height:100%; }
  #canvas-area { position:relative; height:100%; }
  /* ⛔transition 을 끈다 — 실 CSS 의 #canvas-scaler 에 transition:transform .15s 가 있어서
     줌을 바꾸고 2프레임만 기다리면 «움직이는 중»을 잰다(실측: 17.5 로 가는 길목의 17.154).
     끄는 것은 애니메이션뿐이고 최종 기하는 그대로다. */
  #canvas-scaler { transform-origin: 0 0; transition: none !important; }
  #canvas { width:860px; }
  .section-block { position:relative; }
  .section-inner { position:relative; width:860px; }
  .stk, .shp, .grd { position:relative; width:160px; height:90px; margin:60px 0 0 60px; background:#eee; }
</style></head><body>
<div id="canvas-area">
  <div id="canvas-scaler"><div id="canvas">
    <div class="section-block"><div class="section-inner">
      <!-- 캔버스 «안»에 남는 손잡이 -->
      <div class="sticker-block selected stk" data-shape="square">
        <div class="sticker-corner-handle" data-corner="tl"></div>
        <div class="sticker-corner-handle" data-corner="tr"></div>
        <div class="sticker-corner-handle" data-corner="bl"></div>
        <div class="sticker-corner-handle" data-corner="br"></div>
      </div>
      <!-- 탈출하는 손잡이 둘 (js/overlay-handles.js 의 HANDLE_ESCAPE_SPECS) -->
      <div class="shape-block selected shp" id="shp" data-shape-type="rectangle">
        <div class="shape-handle nw" data-dir="nw"></div><div class="shape-handle ne" data-dir="ne"></div>
        <div class="shape-handle sw" data-dir="sw"></div><div class="shape-handle se" data-dir="se"></div>
      </div>
      <div class="gradient-block selected grd" id="grd">
        <div class="gradient-corner-handle" data-corner="tl"></div>
        <div class="gradient-corner-handle" data-corner="tr"></div>
        <div class="gradient-corner-handle" data-corner="bl"></div>
        <div class="gradient-corner-handle" data-corner="br"></div>
      </div>
    </div></div>
  </div></div>
  <div id="ss-handles-overlay">
  ${overlayKids}
  </div>
</div>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import '/js/overlay-handles.js';
  /* 줌은 실앱과 «같은 두 곳»에서 정한다 — 스케일러 transform + :root 의 --inv-zoom.
     ★--inv-zoom 을 documentElement 에 거는 것은 js/editor.js 의 applyZoom 과 같은 자리다.
       (그래서 고정층 #ss-handles-overlay 까지 «상속된다» — 이 파일 B4 가 그걸 잰다.) */
  window.__setZoom = (z) => {
    document.getElementById('canvas-scaler').style.transform = 'translate(0px, 0px) scale(' + (z / 100) + ')';
    document.documentElement.style.setProperty('--inv-zoom', (100 / z).toFixed(4));
  };
  window.__setZoom(100);
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  // 탈출층이 도형 4 + 그라데이션 4 를 고정층으로 옮길 때까지 기다린다(안 기다리면 «집»에서 잰다)
  await page.waitForFunction(() => window.__handleEscape && window.__handleEscape.size === 8);
  return errs;
}

/** 모든 손잡이를 훑어 «화면 px» 로 환산한다 — 계측식은 2026-09-21 실앱 측정과 같은 것. */
async function measure(page, zoom) {
  await page.evaluate((z) => window.__setZoom(z), zoom);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(() => {
    const sc = parseFloat((document.getElementById('canvas-scaler').style.transform.match(/scale\(([^)]+)\)/) || [])[1] || '1');
    const ov = document.getElementById('ss-handles-overlay');
    const rows = [];
    for (const el of document.querySelectorAll('[class*="handle"]')) {
      const cn = typeof el.className === 'string' ? el.className : '';
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const inOv = ov.contains(el);
      const k = inOv ? 1 : sc;                        // 고정층은 줌 밖 → 배율 1
      rows.push({
        cls: cn.trim().split(/\s+/)[0],
        dir: el.dataset.dir || el.dataset.corner || '',
        layer: inOv ? 'overlay' : 'inblock',
        w: +r.width.toFixed(3), h: +r.height.toFixed(3),
        bScreen: +(parseFloat(cs.borderTopWidth) * k).toFixed(4),
        radius: cs.borderTopLeftRadius,
        borderColor: cs.borderTopColor,
      });
    }
    return { dpr: window.devicePixelRatio, scale: sc, rows };
  });
}

/* ★--force-device-scale-factor 를 «반드시» 준다 — 이게 없으면 Playwright 의 deviceScaleFactor
   만으로는 «레이아웃» 쪽 배율이 안 바뀌어 크로미움이 border-width 를 정수 CSS px 로 깎는다.
   그러면 1.0px 과 1.5px 이 «둘 다 1px» 로 보여 오늘 고친 결함이 검사에 «안 보인다»(실측: 빈 검사였다).
   이 인자를 주면 실앱(Electron, dpr 2)과 값이 똑같아진다 — 검증: 줌 40 에서
   calc(1.5px × 2.5) = 3.75 → 3.5px(= 7 디바이스 픽셀), 실앱 9516 실측과 같은 수다.
   ⛔launchOptions 는 describe «안»에서 못 쓴다(워커가 갈린다) — 그래서 파일 최상위다. */
test.use({ deviceScaleFactor: 2, viewport: { width: 1280, height: 900 },
           launchOptions: { args: ['--force-device-scale-factor=2'] } });

const ZOOMS = [40, 100, 150];
const BASE_CLS = 'asset-overlay-handle';   // ★기준 — 현빈이 고른 에셋 블럭 모서리 손잡이

/* 캔버스 «안»에 그려지는 손잡이는 «디바이스 픽셀 스냅»을 피할 수 없다.
   크로미움은 border-width 를 정수 디바이스 픽셀로 스냅한다 — 실측(dpr 2, 줌 40):
   선언 calc(1.5px × 2.5) = 3.75px → 3.5px(=7 디바이스 픽셀)로 스냅 → 화면 1.4px.
   그래서 «디바이스 픽셀 1개»를 허용 상한으로 둔다. 고정층은 스냅이 없어 0.05px 로 조인다.
   ⛔이 여유를 층 구분 없이 주면 고치기 «전»의 1.0px(=디바이스 2px 차)도 통과한다 — 안 된다. */
const tol = (layer, dpr) => (layer === 'overlay' ? 0.05 : 1 / dpr);

test.describe('0921H-handleunify — 손잡이 크기·두께 (dpr 2, 회전 0)', () => {
  test('B1 ★기준(.asset-overlay-handle)은 줌 세 점에서 7px / 1.5px 로 한결같다', async ({ page }) => {
    const errs = await boot(page);
    for (const z of ZOOMS) {
      const m = await measure(page, z);
      const base = m.rows.filter((r) => r.cls === BASE_CLS);
      expect(base.length, `줌 ${z}: 기준 손잡이를 못 찾았다 — 하네스가 늙었나?`).toBeGreaterThan(0);
      for (const b of base) {
        expect(b.layer).toBe('overlay');
        expect(Math.abs(b.w - 7), `줌 ${z}: 기준 크기 ${b.w}`).toBeLessThanOrEqual(0.05);
        expect(Math.abs(b.bScreen - 1.5), `줌 ${z}: 기준 두께 ${b.bScreen}`).toBeLessThanOrEqual(0.05);
      }
    }
    expect(errs, JSON.stringify(errs)).toEqual([]);
  });

  test('B2 ★모든 블럭 모서리 손잡이가 «기준과 같은» 크기·두께로 그려진다 (줌 40/100/150)', async ({ page }) => {
    const errs = await boot(page);
    const bad = [];
    const seen = new Set();
    for (const z of ZOOMS) {
      const m = await measure(page, z);
      const base = m.rows.find((r) => r.cls === BASE_CLS);
      expect(base, `줌 ${z}: 기준 없음`).toBeTruthy();
      for (const r of m.rows) {
        if (r.radius !== '1px') continue;          // 사각 모서리 손잡이만 — 원형(반경/가장자리)은 경계 부품
        seen.add(r.cls);
        const t = tol(r.layer, m.dpr);
        if (Math.abs(r.w - base.w) > t) bad.push(`줌${z} ${r.cls}${r.dir ? '.' + r.dir : ''}(${r.layer}) 크기 ${r.w} ≠ 기준 ${base.w} (허용 ${t})`);
        if (Math.abs(r.bScreen - base.bScreen) > t) bad.push(`줌${z} ${r.cls}${r.dir ? '.' + r.dir : ''}(${r.layer}) 두께 ${r.bScreen} ≠ 기준 ${base.bScreen} (허용 ${t})`);
      }
    }
    /* 판별력 — 표본이 실제로 여럿 잡혔는지 본다. 하나만 잡히면 위 루프는 «자기 자신»만 잰 것이다. */
    expect(seen.size, `잡힌 사각 손잡이 종류 ${[...seen]} — 표본이 너무 적다`).toBeGreaterThanOrEqual(10);
    expect(seen.has('sticker-corner-handle'), '캔버스 «안» 표본(스티커)이 빠졌다 — 가장 크게 갈렸던 자리다').toBe(true);
    expect(seen.has('gradient-corner-handle'), '탈출 표본(그라데이션)이 빠졌다').toBe(true);
    expect(bad, '손잡이 크기·두께가 기준과 갈렸다:\n  ' + bad.join('\n  ')).toEqual([]);
    expect(errs, JSON.stringify(errs)).toEqual([]);
  });

  test('B3 ★네 모서리는 서로 같다 — 한 모서리만 재면 나머지 셋이 샌다', async ({ page }) => {
    await boot(page);
    for (const z of ZOOMS) {
      const m = await measure(page, z);
      for (const cls of ['sticker-corner-handle', 'shape-handle', 'gradient-corner-handle']) {
        const g = m.rows.filter((r) => r.cls === cls);
        expect(g.length, `줌 ${z} ${cls}: 네 모서리가 아니다(${g.length})`).toBe(4);
        expect(new Set(g.map((r) => r.dir)).size, `${cls}: 방향 표식이 겹친다`).toBe(4);
        expect(new Set(g.map((r) => r.w)).size, `줌 ${z} ${cls}: 모서리마다 크기가 다르다 ${g.map((r) => r.w)}`).toBe(1);
        expect(new Set(g.map((r) => r.bScreen)).size, `줌 ${z} ${cls}: 모서리마다 두께가 다르다 ${g.map((r) => r.bScreen)}`).toBe(1);
      }
    }
  });

  test('B4 ★탈출한 손잡이는 «고정층 값»이다 — --inv-zoom 이 :root 상속으로 따라오는 자리', async ({ page }) => {
    await boot(page);
    for (const z of ZOOMS) {
      const m = await measure(page, z);
      for (const cls of ['shape-handle', 'gradient-corner-handle']) {
        for (const r of m.rows.filter((x) => x.cls === cls)) {
          expect(r.layer, `줌 ${z} ${cls}: 탈출층에 있어야 한다`).toBe('overlay');
          /* 고정층이므로 배율 1 → 선언값이 곧 화면값이고 스냅이 없다. 오버라이드를 빼면
             줌 40 에서 1.5 × 2.5 = 3.75 가 되어 여기서 빨강이 난다(2026-09-21 실제로 확인). */
          expect(Math.abs(r.bScreen - 1.5), `줌 ${z} ${cls}: 두께 ${r.bScreen}`).toBeLessThanOrEqual(0.05);
          expect(Math.abs(r.w - 7), `줌 ${z} ${cls}: 크기 ${r.w}`).toBeLessThanOrEqual(0.05);
        }
      }
    }
  });

  test('B5 ⚠️경계 — 반경 손잡이는 원형 그대로, .img-edge-handle 은 «안 건드린다»(현빈 확인 대기)', async ({ page }) => {
    await boot(page);
    for (const z of ZOOMS) {
      const m = await measure(page, z);
      for (const cls of ['asset-radius-handle', 'ss-radius-handle']) {
        const r = m.rows.find((x) => x.cls === cls);
        expect(r, `${cls} 없음`).toBeTruthy();
        expect(r.radius, `${cls}: 반경 손잡이는 «원형»이다 — 모양은 2026-09-21 경계로 안 건드린다`).toBe('50%');
        expect(Math.abs(r.bScreen - 1.5), `${cls}: 두께 ${r.bScreen}`).toBeLessThanOrEqual(0.05);
        expect(Math.abs(r.w - 7)).toBeLessThanOrEqual(0.05);
      }
      const edge = m.rows.find((x) => x.cls === 'img-edge-handle');
      expect(edge, 'img-edge-handle 없음').toBeTruthy();
      expect(edge.radius, '.img-edge-handle 은 흰색 원형 그대로여야 한다').toBe('50%');
      /* ⚠️1.0px 흰 테두리 = 고치기 «전» 그대로다. 현빈 확인 전까지 «임의로 바꾸지 마라».
         이 단정이 초록이라는 것은 통일 패치가 여기를 «안 건드렸다»는 증거다. */
      expect(Math.abs(edge.bScreen - 1.0), `img-edge-handle 두께 ${edge.bScreen} — 임의로 바뀌었다`).toBeLessThanOrEqual(0.05);
      expect(edge.borderColor.replace(/\s/g, ''), 'img-edge-handle 은 흰 테두리다').toBe('rgb(255,255,255)');
    }
  });
});

/* ── dpr 1 축 — 이 맥은 dpr 2 다. 윈도우·외부모니터는 dpr 1 이고 거기선 스냅이 두 배 거칠다.
     ★dpr 1 에서 «기준과의 절대 비교»는 판별력이 없다 — 크로미움이 1.0px 과 1.5px 을 둘 다
       1px 로 깎아 고치기 «전»도 통과한다(실측). 그래서 이 축에서는 «다른 질문»을 던진다:
       한 손잡이가 «줌에 따라» 굵기가 달라지는가. 그건 스냅으로 못 감춘다.
       고치기 전 스티커: 0.4 / 1.0 / 1.5 → 최대/최소 3.75배. 고친 뒤: 스냅 폭(≤1.6배) 안.
     ⛔launchOptions 는 파일 최상위 test.use 에 묶여 있어(dsf 2) 여기서는 브라우저를 따로 띄운다. ── */
test('B6 dpr 1 — 한 손잡이가 «줌마다» 굵어지지 않는다(스냅 폭 안)', async () => {
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1280, height: 900 } });
    await boot(page);
    const byCls = new Map();
    for (const z of ZOOMS) {
      const m = await measure(page, z);
      expect(m.dpr, 'dpr 1 로 안 떴다 — 이 테스트가 dpr 2 를 두 번 재고 있다').toBe(1);
      for (const r of m.rows.filter((x) => x.radius === '1px')) {
        if (!byCls.has(r.cls)) byCls.set(r.cls, []);
        byCls.get(r.cls).push({ z, b: r.bScreen, w: r.w });
      }
    }
    expect(byCls.size, '표본이 너무 적다').toBeGreaterThanOrEqual(10);
    const bad = [];
    for (const [cls, xs] of byCls) {
      const bs = xs.map((x) => x.b);
      const ratio = Math.max(...bs) / Math.min(...bs);
      /* 1.6 = 디바이스 픽셀 스냅만으로 생길 수 있는 폭(1px↔1.5px). 그보다 크면 «축이 갈린» 것이다. */
      if (ratio > 1.6) bad.push(`${cls}: 줌별 두께 ${xs.map((x) => x.z + '→' + x.b).join(' ')} (최대/최소 ${ratio.toFixed(2)}배)`);
      const ws = xs.map((x) => x.w);
      if (Math.max(...ws) / Math.min(...ws) > 1.1) bad.push(`${cls}: 줌별 크기 ${xs.map((x) => x.z + '→' + x.w).join(' ')}`);
    }
    expect(bad, 'dpr 1 에서 손잡이가 줌마다 갈린다:\n  ' + bad.join('\n  ')).toEqual([]);
  } finally { await browser.close(); }
});
