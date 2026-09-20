/* redact-mosaic-killswitch.dom.spec.js — 가림막 「모자이크」 임시 차단(2026-09-20 «0920b-mosaic-off» T-070) 회귀.
 *
 * ★현빈 원문: 「가림막(Redact)에 모자이크가 안됨. 우선 모자이크 버튼의 기능은 막아둘 것(블러만 둘 것)」
 *
 * ★막은 이유(원인은 별도 카드 T-071 «0920b-mosaic-cause»): redact-mosaic.js 의
 *   html2canvas(scope,{useCORS:true,…}) 가 goya-asset:// 이미지를 못 싣는다 — vendor 가 useCORS:true
 *   에서 non-same-origin 이미지에 crossOrigin="anonymous" 를 걸고, 커스텀 스킴은 그 상태로 로드 자체가
 *   실패한다(레포 실측 기록: js/scratch-pad.js:293-294 · js/image-color-adjust.js:268).
 *   ⇒ 사진 위면 «단색 덩어리», 투명 영역이면 _isSuspiciouslyBlank 에 걸려 «영영 회색 #4a4a4a».
 *
 * ★이 스펙이 재는 것 = «차단이 실제로 닫혔는가»(원인 수정이 아니다):
 *   D1 캡처 입구가 막혀 html2canvas 호출이 0회   D2 mouseup·로드후 재캡처도 0회
 *   D3 회색 대신 «블러»로 보인다(computed)        D4 저장 데이터(dataset)는 불변
 *   D5 패널: 모자이크 버튼 disabled, 블러 active  D6 h2c 클론은 여전히 불투명(프라이버시 불변)
 *
 * ★음성대조 — 같은 잣대로 BASE(dev @20e50e3, 고치기 «전»)도 잰다. BASE 실측 출력:
 *     D1-base  { calls: 1, ok: true }                     ← 캡처가 그대로 돈다
 *     D3-base  { bodyOff: false, backdrop: 'none', bg: 'rgb(74, 74, 74)', canvasDisplay: 'block' }
 *     D5-base  { mosaicDisabled: false, mosaicActive: true, blurActive: false }
 *   BASE 가 초록이면 이 검사는 아무것도 안 보고 있는 것이다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(고디터 인스턴스·MCP 9345 대역 무접촉).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js redact-mosaic-killswitch
 */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BASE_REF = '20e50e3';   // 0920b 하네스 기준 브랜치 = 고치기 «전»
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* BASE 측정에서 갈아끼우는 파일 — 이 유닛이 만진 «전부». 나머지는 전부 레포의 진짜 파일이다. */
const SWAP = [
  'js/feature-flags.js',
  'js/effects/redact-mosaic.js',
  'js/props/prop-shape.js',
  'css/editor-blocks.css',
  'css/editor-props.css',
];
const baseSrc = (rel) => execFileSync('git', ['show', `${BASE_REF}:${rel}`], { cwd: REPO, encoding: 'utf8' });

/* ── 하네스 ① 캡처·CSS — 실제 CSS 파일을 얹고, html2canvas 는 «호출 카운터»로 흉내낸다
   (redact-mosaic-mode-switch.dom.spec.js 의 하네스 재사용). */
const CAPTURE_HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<script src="/js/feature-flags.js"></script>
</head><body>
<div class="section-block" id="sec1" style="position:relative;width:300px;height:150px;background:#fff;">
  <div class="shape-block shape-redact" id="shp_1" data-shape-type="rectangle"
       data-shape-redact="true" data-shape-redact-mode="mosaic" data-shape-redact-blur="12"
       style="position:absolute;left:0;top:0;width:100px;height:60px;"></div>
</div>
<script type="module" src="/js/effects/redact-mosaic.js"></script>
</body></html>`;

async function serve(page, which) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__capture.html') return route.fulfill({ contentType: 'text/html', body: CAPTURE_HARNESS });
    if (url.pathname === '/__panel.html')   return route.fulfill({ contentType: 'text/html', body: PANEL_HARNESS });
    const rel = url.pathname.slice(1);
    if (which === 'base' && SWAP.includes(rel)) {
      return route.fulfill({ contentType: MIME[path.extname(rel)] || 'text/plain', body: baseSrc(rel) });
    }
    const file = path.join(REPO, rel);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
}

async function bootCapture(page, which = 'head') {
  await serve(page, which);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__capture.html`);
  await page.waitForFunction(() => typeof window.captureMosaicSnapshot === 'function');
  await page.evaluate(() => {
    window.__h2c = { calls: 0, queue: [] };
    window.html2canvas = () => new Promise((resolve) => {
      window.__h2c.calls++;
      window.__h2c.queue.push(() => {
        const c = document.createElement('canvas');
        c.width = 100; c.height = 60;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgb(255,0,0)'; ctx.fillRect(0, 0, 100, 60);
        resolve(c);
      });
    });
    window.__flush = async () => {
      while (window.__h2c.queue.length) { window.__h2c.queue.shift()(); await new Promise(r => setTimeout(r, 80)); }
    };
  });
  return errs;
}

/* ── 하네스 ② 속성패널 — redact-toggle-label-clip.dom.spec.js 의 하네스 재사용(실물 240px 폭). */
const PANEL_HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<script src="/js/feature-flags.js"></script></head><body>
<div id="canvas-wrap"><div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div></div>
<div id="panel-right" class="panel"><div class="panel-body"></div></div>
<script type="module">
  import { showShapeProperties } from '/js/props/prop-shape.js';
  window.__open = showShapeProperties;
  window.__ready = true;
</script></body></html>`;

async function bootPanel(page, which = 'head') {
  await serve(page, which);
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__panel.html`);
  await page.waitForFunction(() => window.__ready === true);
  // 이미 «모자이크로 저장된» 블록(레거시)을 올리고 패널을 연다.
  await page.evaluate(() => {
    const b = document.createElement('div');
    b.className = 'shape-block shape-redact';
    b.id = 'shp_legacy';
    b.dataset.shapeType = 'rectangle';
    b.dataset.shapeColor = '#cccccc';
    b.dataset.shapeRedact = 'true';
    b.dataset.shapeRedactMode = 'mosaic';
    b.dataset.shapeRedactBlur = '12';
    b.style.width = '200px'; b.style.height = '120px';
    b.innerHTML = '<svg class="shape-svg" width="200" height="120"><rect width="200" height="120" fill="#ccc"/></svg>';
    document.getElementById('host').appendChild(b);
    window.__block = b;
    window.__open(b);
  });
  return errs;
}

/* ══ ⓪ 입력이 살아 있다 — ⛔없으면 아래가 자가통과한다 ═══════════════════════ */
test('⓪ ★스위치가 실제로 false 로 읽히고, 모자이크 블록이 실재한다', async ({ page }) => {
  const errs = await bootCapture(page);
  const seen = await page.evaluate(() => ({
    flag: window.REDACT_MOSAIC_ENABLED,
    block: !!document.getElementById('shp_1'),
    mode: document.getElementById('shp_1').dataset.shapeRedactMode,
  }));
  expect(seen).toEqual({ flag: false, block: true, mode: 'mosaic' });
  expect(errs).toEqual([]);
});

/* ══ D1 캡처 입구가 막혔다 — html2canvas 0회 ══════════════════════════════ */
test('D1 ★captureMosaicSnapshot = false 이고 html2canvas 호출 0회', async ({ page }) => {
  const errs = await bootCapture(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const ok = await window.captureMosaicSnapshot(b);
    const okReuse = await window.captureMosaicSnapshot(b, { reuseFullRes: true });
    return { ok, okReuse, calls: window.__h2c.calls, cap: window.isMosaicCaptured(b), canvases: b.querySelectorAll('canvas').length };
  });
  expect(out).toEqual({ ok: false, okReuse: false, calls: 0, cap: false, canvases: 0 });
  expect(errs).toEqual([]);
});

test('D1-base ★음성대조 — dev @20e50e3 에선 캡처가 그대로 돈다(calls ≥ 1)', async ({ page }) => {
  const errs = await bootCapture(page, 'base');
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const p = window.captureMosaicSnapshot(b);
    await window.__flush();
    return { ok: await p, calls: window.__h2c.calls };
  });
  console.log('  D1-base:', out);
  expect(out.calls, '★BASE 에서도 호출이 0이면 이 검사는 아무것도 안 보고 있다').toBeGreaterThanOrEqual(1);
  expect(out.ok).toBe(true);
  expect(errs).toEqual([]);
});

/* ══ D2 자동 재캡처 경로(mouseup 디바운스 · 로드 후 일괄)도 0회 ══════════════ */
test('D2 ★mouseup 도, captureMosaicsAfterLoad 도 html2canvas 를 부르지 않는다', async ({ page }) => {
  const errs = await bootCapture(page);
  const out = await page.evaluate(async () => {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));   // 디바운스 120ms 보다 넉넉히
    const afterMouseup = window.__h2c.calls;
    window.captureMosaicsAfterLoad(document);
    await new Promise(r => setTimeout(r, 400));
    return { afterMouseup, afterLoad: window.__h2c.calls };
  });
  expect(out).toEqual({ afterMouseup: 0, afterLoad: 0 });
  expect(errs).toEqual([]);
});

/* ══ D3 회색(#4a4a4a) 대신 «블러»로 보인다 ══════════════════════════════════ */
const look = (page) => page.evaluate(() => {
  const b = document.getElementById('shp_1');
  const cs = getComputedStyle(b);
  const canvas = document.createElement('canvas');
  canvas.className = 'redact-mosaic-canvas';
  b.appendChild(canvas);
  const cd = getComputedStyle(canvas).display;
  canvas.remove();
  return {
    bodyOff: document.body.classList.contains('redact-mosaic-off'),
    backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
    bg: cs.backgroundColor,
    canvasDisplay: cd,
  };
});

test('D3 ★body.redact-mosaic-off + backdrop-filter 에 blur( 포함 + 캔버스 숨김', async ({ page }) => {
  const errs = await bootCapture(page);
  const m = await look(page);
  console.log('  D3-head:', m);
  expect(m.bodyOff).toBe(true);
  expect(m.backdrop).toContain('blur(');
  expect(m.bg, '회색 불투명이 아니라 근투명이어야 backdrop-filter 가 보인다').not.toBe('rgb(74, 74, 74)');
  expect(m.canvasDisplay).toBe('none');
  expect(errs).toEqual([]);
});

test('D3-base ★음성대조 — dev @20e50e3 에선 불투명 회색 + backdrop none', async ({ page }) => {
  const errs = await bootCapture(page, 'base');
  const m = await look(page);
  console.log('  D3-base:', m);
  expect(m.bodyOff).toBe(false);
  expect(m.backdrop).toBe('none');
  expect(m.bg).toBe('rgb(74, 74, 74)');
  expect(m.canvasDisplay).toBe('block');
  expect(errs).toEqual([]);
});

/* ══ D4 저장 데이터 불변 — 되돌리기가 «플래그 한 줄»이려면 데이터를 지우면 안 된다 ══ */
test('D4 ★dataset.shapeRedactMode 는 여전히 mosaic (데이터 보존)', async ({ page }) => {
  const errs = await bootCapture(page);
  const out = await page.evaluate(async () => {
    const b = document.getElementById('shp_1');
    const before = [...b.attributes].map(a => `${a.name}=${a.value}`).sort();
    await window.captureMosaicSnapshot(b);
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    return { mode: b.dataset.shapeRedactMode, same: JSON.stringify(before) === JSON.stringify([...b.attributes].map(a => `${a.name}=${a.value}`).sort()) };
  });
  expect(out).toEqual({ mode: 'mosaic', same: true });
  expect(errs).toEqual([]);
});

/* ══ D5 패널 — 모자이크 버튼 disabled, 블러 active ═══════════════════════════ */
const panelState = (page) => page.evaluate(() => {
  const seg = document.getElementById('shape-redact-mode-seg');
  const q = (m) => seg.querySelector(`[data-mode="${m}"]`);
  const mos = q('mosaic'), blu = q('blur');
  return {
    mosaicExists: !!mos,
    mosaicDisabled: !!mos && mos.disabled,
    mosaicActive: !!mos && mos.classList.contains('active'),
    blurActive: !!blu && blu.classList.contains('active'),
    blurDisabled: !!blu && blu.disabled,
    mosaicCursor: mos ? getComputedStyle(mos).cursor : null,
    // 모자이크 전용 UI(새로고침 버튼)는 안 그려져야 한다 — 누를 수 없는 버튼을 남기지 않는다.
    refreshBtn: !!document.getElementById('shape-redact-mosaic-refresh'),
    dataMode: window.__block.dataset.shapeRedactMode,
  };
});

test('D5 ★모자이크 버튼은 «남아 있되» disabled, 블러가 active — dataset 은 그대로 mosaic', async ({ page }) => {
  const errs = await bootPanel(page);
  const st = await panelState(page);
  console.log('  D5-head:', st);
  expect(st.mosaicExists, '⛔버튼을 지우면 안 된다(현빈: 「기능은 막아둘 것」)').toBe(true);
  expect(st.mosaicDisabled).toBe(true);
  expect(st.mosaicActive).toBe(false);
  expect(st.blurActive).toBe(true);
  expect(st.blurDisabled).toBe(false);
  expect(st.mosaicCursor, '비활성 표시 CSS(.prop-align-btn:disabled)가 안 걸렸다').toBe('not-allowed');
  expect(st.refreshBtn).toBe(false);
  expect(st.dataMode, '★패널을 여는 것만으로 데이터가 바뀌면 안 된다').toBe('mosaic');
  expect(errs).toEqual([]);
});

test('D5-base ★음성대조 — dev @20e50e3 에선 모자이크가 눌리고 active 다', async ({ page }) => {
  const errs = await bootPanel(page, 'base');
  const st = await panelState(page);
  console.log('  D5-base:', st);
  expect(st.mosaicDisabled).toBe(false);
  expect(st.mosaicActive).toBe(true);
  expect(st.blurActive).toBe(false);
  expect(errs).toEqual([]);
});

test('D5-b ★비활성 버튼을 «실제로 클릭»해도 모드가 안 바뀐다(우회 경로 포함)', async ({ page }) => {
  const errs = await bootPanel(page);
  const out = await page.evaluate(() => {
    const mos = document.querySelector('#shape-redact-mode-seg [data-mode="mosaic"]');
    mos.click();                                   // 브라우저가 막는 경로
    mos.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 강제 디스패치(우회)
    const b = window.__block;
    return { mode: b.dataset.shapeRedactMode, blurVar: b.style.getPropertyValue('--redact-blur') };
  });
  // ⚠️dataset 은 «그대로 mosaic» — 클릭이 아무 일도 안 했다는 뜻이다(blur 로 굳히지도 않는다).
  expect(out.mode).toBe('mosaic');
  // 패널이 열릴 때 방어 동기화로 --redact-blur 를 채운다 → 블러가 실제로 보인다.
  expect(out.blurVar).toBe('12px');
  expect(errs).toEqual([]);
});

/* ══ D6 프라이버시 불변 — h2c 클론은 여전히 «불투명»이다 ═════════════════════ */
test('D6 ★capture-safety 의 neutralizeRedactForH2C 가 클론을 불투명 #4a4a4a 로 덮는다', async ({ page }) => {
  const errs = await bootCapture(page);
  const out = await page.evaluate(async () => {
    const { neutralizeRedactForH2C } = await import('/js/io/capture-safety.js');
    const clone = document.getElementById('sec1').cloneNode(true);
    clone.style.position = 'absolute'; clone.style.left = '-9999px';
    document.body.appendChild(clone);
    neutralizeRedactForH2C(clone);
    const el = clone.querySelector('.shape-redact');
    const cs = getComputedStyle(el);
    const r = { bg: cs.backgroundColor, backdrop: cs.backdropFilter || cs.webkitBackdropFilter };
    clone.remove();
    return r;
  });
  console.log('  D6:', out);
  expect(out.bg, '★클론이 근투명이면 export 경로로 원본이 샌다').toBe('rgb(74, 74, 74)');
  expect(out.backdrop).toBe('none');
  expect(errs).toEqual([]);
});
