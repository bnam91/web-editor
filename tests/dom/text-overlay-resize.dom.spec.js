/* text-overlay-resize.dom.spec.js — 오버레이(플로팅) 텍스트 모서리 핸들의 «진짜 끝». (0920b)
 *
 * ★왜 필요한가
 *   현빈 2026-09-20: 「오버레이 버튼 활성화 시키면 오버레이된 텍스트 블럭에 모서리 핸들이 필요하다」
 *   ⇒ 재야 할 것은 «소스에 문자열이 있나»가 아니라 «사람이 보는 것이 바뀌었나»다.
 *     그래서 여기서는 핸들을 «세고», 진짜 마우스로 «끌고», getComputedStyle 로 «잰다».
 *
 * ★★이 파일은 «변이를 잡는 그물이 아니다» — tests/dom 은 playwright 라 node --test 스위트에
 *   안 들어간다. 변이 책임은 tests/unit/text-overlay-resize.test.mjs 가 진다(modal-resize 와 같은 분업).
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   (modal-resize.dom.spec.js 의 page.route 하네스를 그대로 쓴다.)
 * ⚠️css/editor-base.css + editor-canvas.css 를 «같이» 얹는다 — 앞엣것이 없으면 --ui-sel-overlay
 *   토큰이 안 살고, 뒤엣것이 없으면 .section-block 의 position:relative 가 없어 absolute
 *   오버레이의 기준상자가 통째로 어긋난다(계획 단계에서 실제로 물렸다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js text-overlay-resize
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 실제 캔버스와 같은 모양 — 오버레이 손잡이 층은 #canvas-scaler «밖»이다(줌에 안 곱해진다). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block" id="sec" style="width:860px;min-height:600px">
      <!-- ★본문 폭을 섹션보다 좁게 둔다 — 실제 section-inner 는 좌우 패딩이 있어 항상 그렇다.
           같게 두면 오버레이 텍스트가 «처음부터» 상한(섹션 폭)이라 「커지나」를 못 잰다. -->
      <div class="section-inner" id="host" style="width:600px;margin:0 auto"></div>
    </div>
    <div id="assethost"></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<!-- ★오버레이 토글 «버튼»을 진짜로 둔다 — wireOverlaySection 이 이 id 를 찾는다.
     스텁으로 _enterOverlay 를 흉내내면 「토글이 실제로 손잡이를 띄운다」는 이 검사의 전제가 사라진다. -->
<div id="panel-right"><div class="panel-body"><button id="txt-overlay-toggle">오버레이</button></div></div>
<script src="/js/feature-flags.js"></script>
<script type="module">
  import '/js/block-factory.js';                       // window.makeTextBlock / window._makeTextFrame
  import { showHandlesFor } from '/js/overlay-handles.js';
  import { wireOverlaySection } from '/js/props/prop-text-wireup-overlay.js';
  window.currentZoom = 100;                            // _zoom() 의 기본값(40)에 안 기대게 명시
  window.__show = showHandlesFor;
  window.__wire = wireOverlaySection;
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
  return errs;
}

/** 텍스트 한 덩이를 캔버스에 «진짜 팩토리»로 올린다. 아직 오버레이가 아니다(음성대조용). */
async function mount(page, { zoom = 100 } = {}) {
  await page.evaluate((zoom) => {
    document.getElementById('canvas-scaler').style.transform = `scale(${zoom / 100})`;
    window.currentZoom = zoom;
    const tf = window._makeTextFrame();
    const { block: tb } = window.makeTextBlock('body');
    const content = tb.querySelector('[class^="tb-"]');
    content.textContent = '오버레이 텍스트 크기 조절';
    content.style.fontSize = '20px';
    delete content.dataset.isPlaceholder;
    tf.appendChild(tb);
    document.getElementById('host').appendChild(tf);
    window.__tf = tf; window.__tb = tb; window.__content = content;
    window.__wire({ tb });                 // 패널의 오버레이 버튼 배선(진짜 경로)
    window.__pushes = [];
    window.pushHistory = (label) => window.__pushes.push({ label, width: window.__tf.style.width });
  }, zoom);
}

/** 실제 앱과 같은 경로 — .selected 를 붙이고 showHandlesFor 를 부른다(클릭·레이어패널이 하는 일). */
async function select(page) {
  await page.evaluate(() => { window.__tb.classList.add('selected'); window.__show(window.__tb); });
  await raf(page);
}
/** 패널의 오버레이 버튼을 «진짜로» 누른다. */
async function toggleOverlay(page) {
  await page.click('#txt-overlay-toggle');
  await raf(page);
}
const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const handleCount = (page) => page.evaluate(() =>
  document.querySelectorAll('#ss-handles-overlay .tfo-overlay-handle').length);
const boxOf = (page) => page.evaluate(() => {
  const r = window.__tf.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
});
const sizes = (page) => page.evaluate(() => ({
  width: parseFloat(getComputedStyle(window.__tf).width),
  fs: parseFloat(getComputedStyle(window.__content).fontSize),
  styleHeight: window.__tf.style.height,
  dsWidth: window.__tf.dataset.width || '',
}));

/** 핸들을 «진짜 마우스»로 끈다. dx/dy 는 화면px. */
async function dragHandle(page, dir, dx, dy) {
  const box = await page.locator(`#ss-handles-overlay .tfo-overlay-handle.${dir}`).boundingBox();
  expect(box, `${dir} 핸들이 화면에 없다`).not.toBeNull();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
  await raf(page);
}

test('D1 ★음성대조 — 오버레이 «전»엔 0개, 켜면 4개', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await select(page);
  /* ★이게 오늘의 증상이다 — 고치기 전에는 «켠 뒤에도» 0 이었다. */
  expect(await handleCount(page), '흐름(비오버레이) 텍스트에 손잡이가 붙었다 — 대조가 성립 안 한다').toBe(0);
  await toggleOverlay(page);
  expect(await page.evaluate(() => window.__tf.dataset.overlayBlock), '전제: 토글이 실제로 오버레이를 켰다').toBe('true');
  expect(await handleCount(page), '오버레이를 켰는데 모서리 점이 안 생겼다').toBe(4);
  expect(errs).toEqual([]);
});

test('D2 ★핸들 테두리색 = 아웃라인과 «한 색»(보라 --ui-sel-overlay)', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  const { hc, token } = await page.evaluate(() => {
    const h = document.querySelector('#ss-handles-overlay .tfo-overlay-handle');
    const probe = document.createElement('div');
    probe.style.color = 'var(--ui-sel-overlay)';
    document.body.appendChild(probe);
    const token = getComputedStyle(probe).color;
    probe.remove();
    return { hc: getComputedStyle(h).borderTopColor, token };
  });
  expect(token, '전제: --ui-sel-overlay 토큰이 살아 있다').not.toBe('');
  expect(hc, `핸들이 보라가 아니다(${hc} vs ${token}) — 한 블록에 두 색이 된다`).toBe(token);
});

test('D3 ★se 를 (+100,+60) 끌면 «폭과 글자가 같은 비율»로 커진다 (±1%)', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  const b = await sizes(page);
  await dragHandle(page, 'se', 100, 60);
  const a = await sizes(page);
  expect(a.width, `폭이 안 커졌다 (${b.width} → ${a.width})`).toBeGreaterThan(b.width + 20);
  const kW = a.width / b.width, kF = a.fs / b.fs;
  expect(Math.abs(kW - kF) / kW, `상자와 글자가 갈라졌다 — 폭×${kW.toFixed(3)} / 글자×${kF.toFixed(3)}`).toBeLessThan(0.01);
  expect(a.styleHeight, '★tf 에 height 를 썼다 — overflow:hidden 이라 줄일 때 글자가 잘린다').toBe('');
  expect(a.dsWidth, 'dataset.width 가 같이 안 갔다 — 저장본이 옛 폭으로 되살아난다').toBe(String(Math.round(a.width)));
});

test('D4 ★nw 를 끌면 «se 코너가 안 움직인다» (끄는 코너가 손끝을 따라온다)', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  const b = await boxOf(page);
  await dragHandle(page, 'nw', -80, -40);
  const a = await boxOf(page);
  expect(a.w, '전제: nw 를 바깥으로 끌면 커진다').toBeGreaterThan(b.w + 10);
  expect(Math.abs(a.right - b.right), `se 의 x 가 움직였다 (${b.right} → ${a.right})`).toBeLessThan(2);
  expect(Math.abs(a.bottom - b.bottom), `se 의 y 가 움직였다 (${b.bottom} → ${a.bottom})`).toBeLessThan(2);
});

test('D5 ★히스토리는 «첫 변경 앞»에 한 번만 — ⌘Z 가 크기를 되돌린다(삽입이 아니라)', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  const before = await page.evaluate(() => window.__tf.style.width);
  await page.evaluate(() => { window.__pushes = []; });   // 토글이 쌓은 것은 세지 않는다
  await dragHandle(page, 'se', 90, 50);
  const pushes = await page.evaluate(() => window.__pushes);
  expect(pushes.length, `드래그 한 번에 히스토리가 ${pushes.length}번 쌓였다 — 1이어야 한다`).toBe(1);
  /* ★쌓인 «순간»의 폭이 드래그 «전» 폭이다 = pushHistory 가 첫 DOM 변경보다 먼저 왔다.
     뒤에 오면 스냅샷이 이미 바뀐 상태라 ⌘Z 가 크기가 아니라 그 앞 사건(삽입)을 되돌린다. */
  expect(pushes[0].width, '★히스토리가 «바뀐 뒤» 상태를 찍었다 — resize-undo 와 같은 병이다').toBe(before);
  expect(pushes[0].label).toMatch(/크기/);
});

test('D6 ★회전 45° — 손잡이가 «회전된 진짜 코너»에 붙는다', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  await page.evaluate(() => {
    window.__tf.dataset.rotation = '45';
    window.__tf.style.transform = 'rotate(45deg)';
    window.__tf.style.transformOrigin = 'center center';
  });
  await raf(page);
  const d = await page.evaluate(() => {
    const el = window.__tf, r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const th = 45 * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
    const out = [];
    for (const dir of ['nw', 'ne', 'sw', 'se']) {
      const lx = (dir.includes('w') ? -1 : 1) * el.offsetWidth / 2;
      const ly = (dir.includes('n') ? -1 : 1) * el.offsetHeight / 2;
      const ex = cx + lx * cos - ly * sin, ey = cy + lx * sin + ly * cos;
      const h = document.querySelector(`#ss-handles-overlay .tfo-overlay-handle.${dir}`);
      const hr = h.getBoundingClientRect();
      out.push({ dir, dx: Math.abs(hr.left + hr.width / 2 - ex), dy: Math.abs(hr.top + hr.height / 2 - ey) });
    }
    return out;
  });
  const LIM = 1 + 1 / (await page.evaluate(() => window.devicePixelRatio || 1));
  for (const c of d) {
    expect(c.dx, `${c.dir} 의 x 가 ${c.dx.toFixed(2)}px 어긋났다 — 회전 AABB 모서리에 붙었다`).toBeLessThan(LIM);
    expect(c.dy, `${c.dir} 의 y 가 ${c.dy.toFixed(2)}px 어긋났다`).toBeLessThan(LIM);
  }
});

test('D7 ★오버레이를 끄면 손잡이가 사라지고, 사용자가 정한 폭은 «남는다»', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  await dragHandle(page, 'se', 100, 60);
  const resized = await sizes(page);
  await toggleOverlay(page);                       // 해제
  await raf(page); await raf(page);
  expect(await handleCount(page), '오버레이를 껐는데 손잡이가 남았다').toBe(0);
  const after = await page.evaluate(() => ({
    w: window.__tf.style.width, h: window.__tf.style.height, ov: window.__tf.dataset.overlayBlock || '',
  }));
  expect(after.ov, '전제: 해제됐다').toBe('');
  expect(after.h, 'height 잔재가 남았다').toBe('');
  expect(after.w, `★해제하면서 사용자가 정한 폭이 증발했다(${resized.width}px → "${after.w}") — overlayIntroducedWidth 도장을 안 뗐다`)
    .toBe(Math.round(resized.width) + 'px');
});

test('D8 ★계속 끌어도 폭은 섹션 폭을 «안 넘는다»', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  await dragHandle(page, 'se', 1400, 900);
  const { width, secW } = await page.evaluate(() => ({
    width: parseFloat(getComputedStyle(window.__tf).width),
    secW: document.getElementById('sec').clientWidth,
  }));
  expect(width, `폭 ${width} 가 섹션 ${secW} 를 넘었다 — maxWidth:100% 와 어긋나 「손잡이는 가는데 상자는 안 큰다」가 된다`)
    .toBeLessThanOrEqual(secW + 0.5);
});

test('D9 ★줌 40%(현빈 실사용) 에서도 끄는 만큼만 커진다 — 스케일 보정', async ({ page }) => {
  await boot(page);
  await mount(page, { zoom: 40 });
  await select(page);
  await toggleOverlay(page);
  const b = await sizes(page);
  await dragHandle(page, 'se', 80, 40);   // 화면 80px = 문서 200px
  const a = await sizes(page);
  const grew = a.width - b.width;
  /* 보정이 빠지면 문서 80px 만 커진다(=화면 32px). 보정이 있으면 문서 ≈200px. */
  expect(grew, `줌 40% 에서 ${grew.toFixed(1)}px 밖에 안 커졌다 — _canvasScaleNow 보정이 빠졌다`).toBeGreaterThan(150);
  const kW = a.width / b.width, kF = a.fs / b.fs;
  expect(Math.abs(kW - kF) / kW, '줌에서 상자와 글자가 갈라졌다').toBeLessThan(0.01);
});
