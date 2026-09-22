/* handle-center-icon-circle.dom.spec.js — 「아이콘원형 편집 손잡이의 «중심»이 배율마다 어긋난다」 [T-110]
 *
 * ★왜 새로 쓰나 — 옆 파일(handle-size-parity.dom.spec.js)은 이 자리를 «한 번도 안 잰다».
 *   저쪽 하네스는 .img-corner-handle 을 #ss-handles-overlay 의 «직계 자식»으로만 만들고
 *   파일 전체에 icon-circle-block 이 0건이라, 캔버스 «안» 축 오버라이드
 *   (css/editor-blocks.css `.icon-circle-block .img-corner-handle`)가 한 번도 매칭되지 않는다.
 *   그리고 저쪽은 «크기·두께»만 재고 «중심»은 안 잰다.
 *   tests/unit/handle-token-parity.test.mjs H6 은 소스 «글자»만 본다 — 렌더가 없다.
 *
 * ★무엇을 재나 — 손잡이 rect 의 «중심»이 이미지 모서리(=손잡이가 가리키는 점)와 겹치는가.
 *   가리키는 점은 img.getBoundingClientRect() 로 «따로» 잰다(식을 베끼지 않는다).
 *   고치기 «전»(HS=5 고정) 실측 오프셋 — 줌40 (+1.5,+1.5) · 줌100 (−1.5,−1.5) · 줌150 (−4.0,−4.0).
 *   = (3.5 × invZoom − 5) × 줌/100. 크기 축은 CSS 가 --inv-zoom 을 먹는데 절반만 5 로 굳어 갈렸다.
 *
 * ★기준선 = 에셋 블럭 편집 손잡이(고정층 #ss-handles-overlay, enterImageEditMode).
 *   현빈이 고른 그 손잡이다. 같은 검사 안에서 같은 식으로 재서 «기준도 (0,0)»임을 같이 박는다.
 *
 * ⛔앱을 «안» 띄운다. 실제 렌더러 모듈(js/image-handling.js)을 그대로 import 해 쓴다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js handle-center-icon-circle
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };

/* 1×1 투명 PNG — 네트워크 없이 즉시 decode 된다(크기는 style 로 준다). */
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>
  html, body { margin:0; height:100%; }
  #canvas-area { position:relative; height:100%; overflow:visible; }
  /* ⛔transition 을 끈다 — 실 CSS 의 #canvas-scaler 에 transition:transform .15s 가 있어
     배율을 바꾸고 바로 재면 «움직이는 중»을 잰다. 끄는 건 애니메이션뿐, 최종 기하는 같다. */
  #canvas-scaler { transform-origin: 0 0; transition: none !important; }
  #canvas { width:860px; }
  .section-block { position:relative; }
  .section-inner { position:relative; width:860px; padding:80px 0 0 80px; }
  /* 아이콘원형 블럭 — 실앱 구조(.icon-circle-block > .icb-circle > img.icb-img) */
  .icon-circle-block { position:relative; width:200px; height:200px; }
  .icb-circle { position:relative; width:200px; height:200px; border-radius:50%; overflow:hidden; background:#eee; }
  .icb-img { display:block; }
  /* 에셋 블럭(기준선) — .asset-block > img.asset-img */
  .asset-block { position:relative; width:240px; height:160px; margin-top:120px; background:#ddd; }
  .asset-img { display:block; }
  #panel-right { position:fixed; right:0; top:0; width:1px; height:1px; overflow:hidden; }
</style></head><body>
<div id="canvas-area">
  <div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas">
    <div class="section-block"><div class="section-inner">
      <div class="icon-circle-block has-image" id="icb">
        <div class="icb-circle"><img class="icb-img" src="${PX}" style="width:160px;height:120px"></div>
      </div>
      <div class="asset-block" id="ab">
        <img class="asset-img" src="${PX}" style="width:180px;height:100px">
      </div>
    </div></div>
  </div></div></div>
  <div id="ss-handles-overlay"></div>
</div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import '/js/image-handling.js';
  /* 배율은 실앱 applyZoom(js/editor.js)과 «같은 세 가지»를 한다:
     scaler transform · :root --inv-zoom · window.currentZoom.
     ★네 번째 — applyZoom 은 _syncCircleImgHandles 갈고리도 부른다. 여기서도 같이 부른다.
       (그 갈고리가 applyZoom «안»에 실제로 있는지는 B8 이 소스로 따로 못박는다.) */
  window.__setZoom = (z) => {
    document.getElementById('canvas-scaler').style.transform = 'translate(0px, 0px) scale(' + (z / 100) + ')';
    document.documentElement.style.setProperty('--inv-zoom', (100 / z).toFixed(4));
    window.currentZoom = z;
    window._syncCircleImgHandles?.();
  };
  /* 갈고리를 «일부러 안 부르는» 배율 변경 — B8 의 음성대조용(갈고리가 하는 일이 있는지 본다). */
  window.__setZoomNoHook = (z) => {
    document.getElementById('canvas-scaler').style.transform = 'translate(0px, 0px) scale(' + (z / 100) + ')';
    document.documentElement.style.setProperty('--inv-zoom', (100 / z).toFixed(4));
    window.currentZoom = z;
  };
  window.__setZoom(100);
  window.__ready = true;
</script></body></html>`;

/* 실앱 생성 순서(ICB_HANDLES / HANDLES) — DOM 자식 순서가 곧 이 순서다. */
const ORDER = ['tl', 'tc', 'tr', 'rc', 'br', 'bc', 'bl', 'lc'];

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
  await page.waitForFunction(() => typeof window.enterCircleImageEditMode === 'function'
                               && typeof window.enterImageEditMode === 'function');
  return errs;
}

/** 두 편집 모드를 «실제로» 연다 — 하네스가 손잡이를 손으로 만들지 않는다. */
async function enterBoth(page) {
  return page.evaluate(() => {
    const icb = document.getElementById('icb');
    const ab  = document.getElementById('ab');
    icb.dataset.imgW = 160; icb.dataset.imgX = 0; icb.dataset.imgY = 40;
    window.enterCircleImageEditMode(icb);
    window.enterImageEditMode(ab, { noRotate: true, noColorAdjust: true });
    return {
      icbHandles: icb.querySelectorAll('.img-corner-handle, .img-edge-handle').length,
      overlayHandles: document.getElementById('ss-handles-overlay')
        .querySelectorAll('.img-corner-handle, .img-edge-handle').length,
    };
  });
}

/**
 * 배율을 세우고 «중심 오프셋»을 잰다.
 * ★스케일 게이트 — 재기 전에 #canvas-scaler 의 실제 transform 이 z/100 인지 확인한다.
 *   안 걸면 배율이 안 먹은 화면에서 7px 을 2.8px 로(또는 그 반대로) 오독한다.
 */
async function measure(page, zoom, opts = {}) {
  await page.evaluate(([z, noHook]) => (noHook ? window.__setZoomNoHook(z) : window.__setZoom(z)), [zoom, !!opts.noHook]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const out = await page.evaluate(([order]) => {
    const scaler = document.getElementById('canvas-scaler');
    const m = new DOMMatrixReadOnly(getComputedStyle(scaler).transform);
    const scale = m.a;
    const inv = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inv-zoom'));
    /* 손잡이가 «가리켜야 하는 점» — 식을 베끼지 않고 이미지 rect 에서 직접 뽑는다. */
    const anchorsOf = (img) => {
      const r = img.getBoundingClientRect();
      return {
        tl: [r.left, r.top],            tc: [r.left + r.width / 2, r.top],
        tr: [r.right, r.top],           rc: [r.right, r.top + r.height / 2],
        br: [r.right, r.bottom],        bc: [r.left + r.width / 2, r.bottom],
        bl: [r.left, r.bottom],         lc: [r.left, r.top + r.height / 2],
      };
    };
    const read = (rootSel, imgSel) => {
      const root = document.querySelector(rootSel);
      const hs = [...root.querySelectorAll('.img-corner-handle, .img-edge-handle')];
      const a = anchorsOf(document.querySelector(imgSel));
      return hs.map((el, i) => {
        const id = order[i];
        const r = el.getBoundingClientRect();
        return {
          id,
          cls: el.classList.contains('img-corner-handle') ? 'corner' : 'edge',
          w: +r.width.toFixed(3), h: +r.height.toFixed(3),
          dx: +(r.left + r.width / 2 - a[id][0]).toFixed(3),
          dy: +(r.top + r.height / 2 - a[id][1]).toFixed(3),
        };
      });
    };
    return {
      scale, inv, dpr: window.devicePixelRatio,
      icb: read('#icb', '#icb .icb-img'),
      base: read('#ss-handles-overlay', '#ab .asset-img'),
    };
  }, [ORDER]);
  expect(Math.abs(out.scale - zoom / 100),
    `스케일 게이트: #canvas-scaler 가 ${out.scale} — 줌 ${zoom} 이 안 먹었다(이 상태로 재면 크기를 오독한다)`)
    .toBeLessThanOrEqual(0.0001);
  expect(Math.abs(out.inv - 100 / zoom),
    `스케일 게이트: --inv-zoom ${out.inv} ≠ ${100 / zoom}`).toBeLessThanOrEqual(0.0005);
  return out;
}

test.use({ deviceScaleFactor: 2, viewport: { width: 1400, height: 1000 },
           launchOptions: { args: ['--force-device-scale-factor=2'] } });

const ZOOMS = [40, 100, 150];
/* 중심 오프셋 허용치 — 디바이스 픽셀 스냅(dpr 2 → 0.5 CSS px)의 «절반»이 중심에 실린다.
   고치기 전 최소 어긋남이 1.5px 이라 0.3 은 넉넉히 판별력이 있다(양성대조가 이를 증명한다). */
const OFF_TOL = 0.3;
const SIZE_TOL = 1 / 2;   // dpr 2 — 캔버스 «안» 손잡이는 디바이스 픽셀 1개까지 스냅된다

test.describe('T-110 — 아이콘원형 편집 손잡이의 «중심»(dpr 2)', () => {
  test('B7 ★아이콘원형 편집 손잡이는 줌 40/100/150 에서 중심이 (0,0) 이고 크기는 7px 이다', async ({ page }) => {
    const errs = await boot(page);
    const n = await enterBoth(page);
    expect(n.icbHandles, '아이콘원형 편집 손잡이가 8개가 아니다 — 하네스가 늙었나?').toBe(8);
    expect(n.overlayHandles, '기준(에셋) 손잡이가 고정층에 8개가 아니다').toBe(8);

    const bad = [];
    for (const z of ZOOMS) {
      const m = await measure(page, z);
      for (const r of m.icb) {
        if (Math.abs(r.dx) > OFF_TOL || Math.abs(r.dy) > OFF_TOL) {
          bad.push(`줌${z} icon-circle ${r.id}(${r.cls}): 중심 (${r.dx}, ${r.dy}) ≠ (0,0)`);
        }
        if (Math.abs(r.w - 7) > SIZE_TOL || Math.abs(r.h - 7) > SIZE_TOL) {
          bad.push(`줌${z} icon-circle ${r.id}: 크기 ${r.w}×${r.h} ≠ 7`);
        }
      }
      /* 기준선도 같은 식으로 잰다 — «식이 틀려서 둘 다 0 이 아닌» 경우를 배제한다. */
      for (const r of m.base) {
        if (Math.abs(r.dx) > 0.05 || Math.abs(r.dy) > 0.05) {
          bad.push(`줌${z} 기준(asset) ${r.id}: 중심 (${r.dx}, ${r.dy}) ≠ (0,0) — 기준선이 깨졌다`);
        }
        if (Math.abs(r.w - 7) > 0.05) bad.push(`줌${z} 기준(asset) ${r.id}: 크기 ${r.w} ≠ 7`);
      }
    }
    expect(bad, '손잡이 중심이 가리키는 점에서 벗어났다:\n  ' + bad.join('\n  ')).toEqual([]);
    expect(errs, JSON.stringify(errs)).toEqual([]);
  });

  test('B8 ★«배율이 바뀌는 자리»에 묶여 있다 — 갈고리를 빼면 중심이 도로 어긋난다', async ({ page }) => {
    await boot(page);
    await enterBoth(page);
    await measure(page, 100);

    /* ⑴ 음성대조 — 갈고리를 «안» 부르고 배율만 바꾸면 «바꾸기 전» 절반이 남아 어긋나야 한다.
       이게 안 어긋나면 갈고리는 «있으나 마나»고, 이 검사도 의미가 없다. */
    const stale = await measure(page, 150, { noHook: true });
    const worst = Math.max(...stale.icb.map((r) => Math.max(Math.abs(r.dx), Math.abs(r.dy))));
    expect(worst, '갈고리 없이 배율을 바꿨는데 중심이 그대로다 — 이 갈고리는 아무 일도 안 한다')
      .toBeGreaterThan(OFF_TOL);

    /* ⑵ 갈고리를 부르면 같은 배율에서 되돌아온다. */
    const fixed = await measure(page, 150);
    const bad = fixed.icb.filter((r) => Math.abs(r.dx) > OFF_TOL || Math.abs(r.dy) > OFF_TOL);
    expect(bad, '갈고리를 불렀는데도 어긋난다: ' + JSON.stringify(bad)).toEqual([]);

    /* ⑶ 그 갈고리가 실앱의 «배율 바꾸는 자리»(applyZoom)에 실제로 있는가 —
       하네스의 __setZoom 이 applyZoom 을 흉내 낸 것이라, 흉내가 «참»인지는 소스로 확인한다. */
    const editorSrc = fs.readFileSync(path.join(REPO, 'js', 'editor.js'), 'utf8');
    const applyZoomBody = editorSrc.slice(editorSrc.indexOf('function applyZoom('));
    const end = applyZoomBody.indexOf('\n/* ★[perf] transform 쓰기와');
    expect(end, 'applyZoom 본문 끝을 못 찾았다 — 검사가 늙었다').toBeGreaterThan(0);
    expect(applyZoomBody.slice(0, end),
      'js/editor.js applyZoom 이 _syncCircleImgHandles 를 안 부른다 — 배율을 바꿔도 중심이 안 따라온다')
      .toContain('window._syncCircleImgHandles');
    const imgSrc = fs.readFileSync(path.join(REPO, 'js', 'image-handling.js'), 'utf8');
    expect(imgSrc, 'enterCircleImageEditMode 가 갈고리를 안 건다')
      .toContain('window._syncCircleImgHandles = syncHandles');
  });
});
