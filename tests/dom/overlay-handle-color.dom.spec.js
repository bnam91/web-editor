/* overlay-handle-color.dom.spec.js — 「오버레이 테두리와 모서리 핸들이 «한 색»인가」
 *
 * 현빈 2026-09-21: 「오버레이 하면 아웃라인이 보라인데 모서리 핸들은 파랑이다.
 *                   스티커는 보라 핸들까지 되어 있으니 색을 맞춰줘」
 *
 * ★단위검사(tests/unit/overlay-handle-sel-variant.test.mjs)는 «규칙이 적혀 있는가»까지만 본다.
 *   여기서 재는 것은 «진짜 크로미움이 그 규칙을 이겨서 실제로 보라를 칠하는가»다 —
 *   CSS 는 문자열로는 맞는데 특이성·순서에 져서 안 걸리는 일이 흔하다(그게 이 레포의 상습 자리다).
 *   ★판정은 리터럴이 아니라 «테두리(SVG stroke)와 같은 값인가»로 한다 — 토큰이 바뀌면 둘이 같이 바뀐다.
 *
 * ⛔앱을 «안» 띄운다 — shape-ellipse-selection-outline.dom.spec.js 의 부트를 그대로 쓴다.
 * 실행: npm run test:dom -- overlay-handle-color
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0;background:#fff">
<div id="canvas-scaler" style="transform: scale(0.4); transform-origin: 0 0; --inv-zoom: 2.5;">
  <div id="canvas" style="width:860px">
    <div class="section-block"><div class="section-inner" id="host" style="width:860px;position:relative"></div></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import '/js/selection-overlay.js';
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
  await page.waitForFunction(() => document.body.classList.contains('sel-ov'));
  return errs;
}

/** 오버레이(플로팅) 켠 도형 하나 + 그 손잡이들.
 *  ★표식(data-sel-variant='sticker')은 js/overlay-float.js enterFloat 이 찍는 그 값이다.
 *    손잡이 쪽 표식은 js/overlay-handles.js syncHandleSelVariant 가 옮겨 찍는다 —
 *    여기서는 그 «결과 DOM»을 손으로 세워 CSS 만 시험한다(배선은 단위검사가 본다). */
async function mount(page, { overlay }) {
  await page.evaluate(({ overlay }) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const ov = document.getElementById('ss-handles-overlay');
    ov.querySelectorAll('div').forEach(e => e.remove());

    const ss = document.createElement('div');
    ss.className = 'frame-block';
    ss.setAttribute('style', 'width:100px;height:100px;min-height:100px;margin:0 auto;position:relative;');
    const sb = document.createElement('div');
    sb.className = 'shape-block selected';
    sb.dataset.type = 'shape'; sb.dataset.shapeType = 'rectangle';
    sb.innerHTML = '<svg class="shape-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="#ccc"></rect></svg>';
    if (overlay) { ss.dataset.overlayBlock = 'true'; ss.dataset.selVariant = 'sticker'; sb.dataset.selVariant = 'sticker'; }
    for (const dir of ['nw', 'ne', 'sw', 'se']) {   // block-drag.js _addShapeHandles 와 같은 꼴
      const h = document.createElement('div');
      h.className = `shape-handle ${dir}`;
      sb.appendChild(h);
    }
    ss.appendChild(sb); host.appendChild(ss);
    ss.classList.add('selected');

    // 에셋 계열 — 고정층에 붙고, overlay-handles.js 가 표식을 «옮겨 찍은» 상태를 재현한다
    /* ★자리를 «떼어» 놓는다 — 둘 다 position:absolute 인데 top/left 를 안 주면 같은 자리에 포개지고,
       z-index 가 다르니(리사이즈 9992 > 반경 1001) hover 가 언제나 리사이즈 쪽에만 간다(실측으로 물렸다). */
    const spots = { 'asset-overlay-handle nw': [400, 40], 'asset-radius-handle nw': [440, 40] };
    for (const [cls, attr] of [['asset-overlay-handle nw', 'assetResizeDir'], ['asset-radius-handle nw', 'assetRadiusDir']]) {
      const h = document.createElement('div');
      h.className = cls;
      h.dataset[attr] = 'nw';
      h.style.left = spots[cls][0] + 'px';
      h.style.top  = spots[cls][1] + 'px';
      if (overlay) h.dataset.selVariant = 'sticker';
      ov.appendChild(h);
    }
    window.__sb = sb; window.__ss = ss;
  }, { overlay });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const colors = (page) => page.evaluate(() => {
  const g = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).borderColor : null; };
  const p = document.querySelector('#ss-handles-overlay .ss-sel-layer path');
  return {
    stroke: p ? getComputedStyle(p).stroke : null,
    pathCls: p ? p.getAttribute('class') : null,
    shape: g('.shape-handle'),
    assetResize: g('.asset-overlay-handle'),
    assetRadius: g('.asset-radius-handle'),
    token: getComputedStyle(document.documentElement).getPropertyValue('--ui-sel-overlay').trim(),
    sel: getComputedStyle(document.documentElement).getPropertyValue('--sel-color').trim(),
  };
});

/** '#9966ff' → 'rgb(153, 102, 255)' — 토큰 값을 computed 와 같은 표기로 만든다. */
function toRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})` : hex;
}

test('H1 ★오버레이면 테두리와 세 손잡이 계열이 «같은 색»이다 (한 블록에 두 색이 없다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, { overlay: true });
  const c = await colors(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  expect(c.pathCls, '테두리가 오버레이(보라) 갈래로 안 그려졌다 — 전제가 깨졌다').toContain('ss-sel-path--sticker');
  const want = toRgb(c.token);
  expect(c.stroke, `테두리 색이 토큰과 다르다: ${c.stroke}`).toBe(want);
  expect(c.shape, `도형 손잡이가 테두리와 다른 색이다: ${c.shape} vs ${c.stroke}`).toBe(want);
  expect(c.assetResize, `에셋 리사이즈 손잡이가 다른 색이다: ${c.assetResize}`).toBe(want);
  expect(c.assetRadius, `에셋 반경 손잡이가 다른 색이다: ${c.assetRadius}`).toBe(want);
});

test('H2 ★[음성대조] 오버레이가 아니면 셋 다 «종전 파랑» 그대로다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page, { overlay: false });
  const c = await colors(page);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  const blue = toRgb(c.sel);
  expect(c.pathCls, '비오버레이인데 보라 갈래로 그려졌다').not.toContain('sticker');
  expect(c.stroke, `비오버레이 테두리가 파랑이 아니다: ${c.stroke}`).toBe(blue);
  expect(c.shape, `★비오버레이 도형 손잡이가 파랑이 아니다(${c.shape}) — 평상시 선택까지 보라가 됐다`).toBe(blue);
  expect(c.assetResize, `★비오버레이 에셋 손잡이가 파랑이 아니다: ${c.assetResize}`).toBe(blue);
  expect(c.assetRadius, `★비오버레이 에셋 반경 손잡이가 파랑이 아니다: ${c.assetRadius}`).toBe(blue);
  expect(blue).not.toBe(toRgb(c.token));   // 두 색이 애초에 다르다는 것부터(검사가 헛돌지 않게)
});

test('H3 ★반경 손잡이는 hover 채움까지 같은 색 — 누르려고 갖다 대는 순간만 파랑이면 같은 병이다', async ({ page }) => {
  await boot(page);
  await mount(page, { overlay: true });
  const got = await page.evaluate(() => {
    const h = document.querySelector('.asset-radius-handle');
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(got.x, got.y);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.asset-radius-handle')).backgroundColor);
  const token = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-sel-overlay').trim());
  expect(bg, `hover 채움이 보라가 아니다: ${bg}`).toBe(toRgb(token));
});

test('H4 ★[음성대조] 리사이즈 손잡이는 hover 에 «없던 채움»이 생기지 않는다 (규칙을 넓게 걸지 않았다)', async ({ page }) => {
  await boot(page);
  await mount(page, { overlay: true });
  const got = await page.evaluate(() => {
    const h = document.querySelector('.asset-overlay-handle');
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(got.x, got.y);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.asset-overlay-handle')).backgroundColor);
  expect(bg, `리사이즈 손잡이의 hover 채움이 흰색이 아니다: ${bg} — 넓게 건 규칙이 없던 색을 만들었다`)
    .toBe('rgb(255, 255, 255)');
});
