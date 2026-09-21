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
<!-- ★z-index 를 준다 — 줌 150% 에서는 #canvas-scaler(860×600 → 1290×900)가 패널을 덮어
     playwright 클릭이 「canvas-scaler intercepts pointer events」로 막힌다(실측). -->
<div id="panel-right" style="position:relative;z-index:10000"><div class="panel-body"><button id="txt-overlay-toggle">오버레이</button></div></div>
<script src="/js/feature-flags.js"></script>
<!-- ★drag-history.js 를 «진짜로» 싣는다(앱 index.html:996) — 2026-09-20 통합(int/0920b)에서
     이 드래그가 T-073 의 «양쪽 끝» 규약으로 바뀌었다. 안 실으면 beginDragHistory 가 undefined 라
     시작 표본이 조용히 사라지고, 검사는 «끝 표본 하나»를 보며 초록이 된다(거짓 초록). -->
<script src="/js/drag-history.js"></script>
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
  /* ★줌을 바꾼 «직후»엔 #canvas-scaler 의 transform 이 도는 중이다(transition .15s).
     그 상태로 오버레이를 켜면 _enterOverlay 가 «도는 중인» rect 로 좌표를 잡아
     offsetX 가 130 이 아니라 236 으로 굳는다(실측) — 화면이 멈춘 뒤에 진행한다. */
  await settle(page);
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
  await settle(page);
}
const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** ★화면이 «멈출 때까지» 기다린다.
 *  css/editor-canvas.css:231 `#canvas-scaler{transition:transform .15s ease}` 때문에 줌을 바꾼
 *  직후엔 scale 이 «도는 중»이다 — 그동안 손잡이는 매 rAF 마다 자리를 옮긴다(실측: se 의
 *  style.left 가 533.75 → 413.3px 로 흘렀다). 그 흐르는 중에 boundingBox 를 읽어 그 좌표로
 *  mousedown 하면 손잡이를 «빗나가» mousemove 가 0회가 되고, 드래그가 조용히 실패해
 *  「폭이 하나도 안 커졌다」로 빨개진다(2026-09-20 이벨류에이터 실측 — 4회 시도 4회 실패).
 *  ⇒ 좌표를 읽기 «전»에 캔버스 rect 가 3프레임 연속 같아질 때까지 기다린다. */
async function settle(page) {
  await page.waitForFunction(() => {
    const r = document.getElementById('canvas-scaler').getBoundingClientRect();
    const now = `${r.width.toFixed(3)}/${r.left.toFixed(3)}`;
    if (window.__settlePrev !== now) { window.__settlePrev = now; window.__settleN = 0; return false; }
    window.__settleN = (window.__settleN || 0) + 1;
    return window.__settleN >= 3;
  }, null, { timeout: 5000, polling: 'raf' });
  await page.evaluate(() => { window.__settlePrev = null; window.__settleN = 0; });
}
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
  await settle(page);   // ★좌표를 읽기 전에 화면을 멈춘다 (settle 주석 참고)
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
  const after = await page.evaluate(() => window.__tf.style.width);
  /* ★2026-09-20 통합(int/0920b) — 드래그는 «양쪽 끝»을 찍는다(T-073, js/drag-history.js).
     ⑴ 첫 표본의 폭 = 드래그 «전» 폭 ⇒ ⌘Z 가 크기를 되돌린다(삽입이 아니라, 이 검사의 원래 뜻).
     ⑵ 끝 표본이 있어야 «뒤»에 오는 push-after 동작과 사이에 빈 칸이 안 생긴다(머리말 ⑴).
     ⛔3개 이상이면 프레임마다 쌓인 것이다(빗장 moved 가 깨졌다). */
  expect(pushes.length, `드래그 한 번에 히스토리가 ${pushes.length}번 쌓였다 — 시작·끝 2번이어야 한다`).toBe(2);
  expect(pushes[0].width, '★첫 표본이 «바뀐 뒤» 상태다 — resize-undo 와 같은 병이다').toBe(before);
  expect(pushes[1].width, '★끝 표본이 드래그 «뒤» 폭이 아니다 — 양쪽 끝이 아니다').toBe(after);
  expect(after, '전제: 드래그로 폭이 실제로 바뀌었다').not.toBe(before);
  expect(pushes[1].label).toMatch(/크기/);
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

test('D8 ★섹션 폭 «밖»까지 키울 수 있다 — 현빈 2026-09-20 결정 (이동과 같은 결)', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  const before = await page.evaluate(() => window.__tf.style.width);
  await page.evaluate(() => { window.__pushes = []; });
  await dragHandle(page, 'se', 1400, 900);
  const { width, computed, secW, maxW } = await page.evaluate(() => ({
    width: parseFloat(window.__tf.style.width),
    computed: parseFloat(getComputedStyle(window.__tf).width),     // ★maxWidth:100% 가 안 잘랐나
    secW: document.getElementById('sec').clientWidth,
    maxW: getComputedStyle(window.__tf).maxWidth,
  }));
  /* ★고치기 전엔 여기서 폭이 정확히 섹션 폭(860)에 멈췄다 — maxW = Math.min(secW, room).
     현빈 2026-09-20: 「크기조절도 섹션 폭 밖까지 나갈 수 있어야 한다」 */
  expect(width, `★폭 ${width} 가 섹션 ${secW} 를 못 넘었다 — 상한이 아직 섹션 폭이다`)
    .toBeGreaterThan(secW + 100);
  /* ★두 번째 문 — style.width 만 커지고 maxWidth:100% 가 그대로면 «화면은 안 커진다»
     (_enterOverlay 가 심는 maxWidth:100%, prop-text-wireup-overlay.js:136). */
  expect(maxW, `★maxWidth 가 ${maxW} 라 화면 폭이 섹션에 잘린다 — style.width 만 커졌다`).toBe('none');
  expect(computed, `★화면 폭 ${computed} 가 섹션 ${secW} 에 잘렸다 — maxWidth 를 안 풀었다`)
    .toBeGreaterThan(secW + 100);
  /* ★⌘Z 가 «크기»를 되돌리고 블럭은 살아 있어야 한다 = 히스토리는 첫 DOM 변경 «앞»에 한 번. */
  const pushes = await page.evaluate(() => window.__pushes);
  expect(pushes.length, `섹션 밖까지 끄는 동안 히스토리가 ${pushes.length}번 쌓였다 — 시작·끝 2번이어야 한다`).toBe(2);
  expect(pushes[0].width, '★첫 표본이 «바뀐 뒤» 폭이다 — ⌘Z 가 크기가 아니라 삽입을 되돌린다').toBe(before);
});

test('D16 ★끄고 «다시 켜도» 섹션 폭 밖이 유지된다 (T-068 후속 — 재진입)', async ({ page }) => {
  /* ★왜 이 검사가 뒤늦게 생겼나 — D8 이 「섹션 폭 밖까지 키울 수 있다」를 잠그는데
     «켜기 한 번»으로 끝난다. 이 파일 15검사 중 토글을 두 번 밟는 건 D7 하나뿐이고
     «껐다 다시 켜는» 검사는 하나도 없었다. 그래서 초록인 채로 이 결함이 살아 있었다
     (2026-09-21 실앱 실측: 1449 로 키운 뒤 껐다 켜면 화면만 860 으로 깎이고
      style.width·dataset.width 는 1449 를 들고 있다 = 패널과 화면이 갈라진다).
     ⇒ ★검사 «개수»가 아니라 «검사가 밟는 경로의 길이»를 세어야 공백이 보인다. */
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  await dragHandle(page, 'se', 1400, 900);

  const wide = await page.evaluate(() => ({
    styleW: parseFloat(window.__tf.style.width),
    computed: parseFloat(getComputedStyle(window.__tf).width),
    secW: document.getElementById('sec').clientWidth,
  }));
  /* ★먼저 «무엇이 바뀌었나»를 세운다 — 안 커졌으면 아래 판정이 저절로 참이 된다(무효 측정). */
  expect(wide.computed, '★전제가 안 섰다 — 키우기 자체가 섹션 폭을 못 넘었다(D8 을 먼저 봐라)')
    .toBeGreaterThan(wide.secW + 100);

  await toggleOverlay(page);   // 끄기 — 흐름으로 돌아가면 CSS 가 캡을 다시 건다(D7·현빈 결정)
  await toggleOverlay(page);   // ★다시 켜기

  const back = await page.evaluate(() => ({
    styleW: parseFloat(window.__tf.style.width),
    dsW: window.__tf.dataset.width,
    computed: parseFloat(getComputedStyle(window.__tf).width),
    maxW: getComputedStyle(window.__tf).maxWidth,
    secW: document.getElementById('sec').clientWidth,
  }));
  expect(back.maxW, `★재진입에서 maxWidth 가 ${back.maxW} 로 도로 걸렸다 — 화면이 섹션 폭에 잘린다`)
    .toBe('none');
  expect(back.computed, `★화면 폭 ${back.computed} 가 섹션 ${back.secW} 로 깎였다`)
    .toBeGreaterThan(back.secW + 100);
  /* ★«패널 값 = 화면» 이어야 한다. 이 둘이 갈리는 것이 이 결함의 본체다
     (overlay-float.js _unfreezeWidth 주석: 「갈리면 패널이 옛 값을 보여준다」). */
  expect(Math.round(back.computed), `★패널(dataset.width=${back.dsW})과 화면(${back.computed})이 갈렸다`)
    .toBe(Math.round(back.styleW));
  expect(Math.round(back.styleW), '★재진입에서 사용자가 정한 폭 자체가 바뀌었다')
    .toBe(Math.round(wide.styleW));
});

test('D17 ★음성대조 — 도장을 지우면 재진입에서 «다시» 깎인다 (D16 이 그 차이를 본다)', async ({ page }) => {
  /* D16 의 초록이 «고쳐서»인지 «원래 안 깎여서»인지 가른다.
     고침의 전부는 「overlayFreeWidth 도장을 해제 때 안 지우고, 진입 때 그걸 보고 캡을 다시 푼다」이다.
     ⇒ 도장을 손으로 지우면 옛 동작이 되살아나야 한다. 안 되살아나면 D16 은 «검사처럼 생긴 문장»이다. */
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  await dragHandle(page, 'se', 1400, 900);
  await toggleOverlay(page);   // 끄기

  const stamped = await page.evaluate(() => window.__tf.dataset.overlayFreeWidth || '');
  expect(stamped, '★해제 뒤 도장이 안 남아 있다 — 고침의 절반(도장 유지)이 사라졌다').toBe('true');

  await page.evaluate(() => { delete window.__tf.dataset.overlayFreeWidth; });  // ★옛 상태 재현
  await toggleOverlay(page);   // 다시 켜기

  const cut = await page.evaluate(() => ({
    computed: parseFloat(getComputedStyle(window.__tf).width),
    maxW: getComputedStyle(window.__tf).maxWidth,
    styleW: parseFloat(window.__tf.style.width),
    secW: document.getElementById('sec').clientWidth,
  }));
  expect(cut.computed, '★도장을 지웠는데도 안 깎인다 — D16 의 초록은 «고쳐서»가 아니라 «원래 그래서»다')
    .toBeLessThanOrEqual(cut.secW + 1);
  /* ★그리고 그때 «갈라짐»이 실제로 생긴다 — 이게 결함의 모습이다 */
  expect(cut.styleW, '★옛 상태에서 style.width 는 큰 값을 그대로 들고 있어야 한다(갈라짐)')
    .toBeGreaterThan(cut.secW + 100);
});

test('D9 ★줌 40%(현빈 실사용) 에서도 끄는 만큼만 커진다 — 스케일 보정', async ({ page }) => {
  await boot(page);
  await mount(page, { zoom: 40 });
  await select(page);
  await toggleOverlay(page);
  /* ★이 검사의 «뜻»은 스케일 보정 하나다 ⇒ 섹션 오른쪽 여유가 상한이 되어버리면
     무엇을 쟀는지 흐려진다(본문이 섹션보다 좁아 left 가 130 이라 여유가 730 뿐이다).
     블럭을 왼쪽 끝에 붙여 여유를 섹션 폭 전부로 만든 뒤 «끄는 만큼»만 잰다. */
  await page.evaluate(() => { window.__tf.dataset.offsetX = '0'; window.__tf.style.left = '0px'; });
  await raf(page);
  const b = await sizes(page);
  await dragHandle(page, 'se', 80, 40);   // 화면 80px = 문서 200px
  const a = await sizes(page);
  const grew = a.width - b.width;
  /* 보정이 빠지면 문서 80px 만 커진다(=화면 32px). 보정이 있으면 문서 ≈200px. */
  expect(grew, `줌 40% 에서 ${grew.toFixed(1)}px 밖에 안 커졌다 — _canvasScaleNow 보정이 빠졌다`).toBeGreaterThan(150);
  const kW = a.width / b.width, kF = a.fs / b.fs;
  expect(Math.abs(kW - kF) / kW, '줌에서 상자와 글자가 갈라졌다').toBeLessThan(0.01);
});

/* ═══════════════════════════════════════════════════════════════════════════
   0920b 픽스 라운드 — 이벨류에이터 실측 3건을 «그물»로 바꾼다.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 화면에 «실제로 보이는» 손잡이 수 — 편집 중에는 display:none 으로 숨긴다(파괴가 아니라). */
const visibleHandleCount = (page) => page.evaluate(() =>
  [...document.querySelectorAll('#ss-handles-overlay .tfo-overlay-handle')]
    .filter(h => getComputedStyle(h).display !== 'none').length);

/** 말풍선 한 덩이. 본문 `.tb-bubble` 은 인라인 font-size 가 «없다»(CSS 28px) — 그게 함정이다. */
async function mountBubble(page) {
  await page.evaluate(() => {
    const tf = window._makeTextFrame();
    const { block: tb } = window.makeSpeechBubbleBlock('left');
    const bubble = tb.querySelector('.tb-bubble');
    bubble.textContent = '말풍선 크기 조절';
    delete bubble.dataset.isPlaceholder;
    const sender = tb.querySelector('.tb-sender-name');
    sender.style.display = '';                  // 이름표를 켜 둔다(둘 다 커져야 한다)
    tf.appendChild(tb);
    document.getElementById('host').appendChild(tf);
    window.__tf = tf; window.__tb = tb; window.__content = bubble; window.__sender = sender;
    window.__wire({ tb });
    window.__pushes = [];
    window.pushHistory = (label) => window.__pushes.push({ label });
  });
}

test('D10 ★음성대조 — 글자 편집을 끝내면 손잡이가 «스스로» 돌아온다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  expect(await visibleHandleCount(page), '전제: 오버레이를 켜면 4개').toBe(4);

  /* 편집 진입 — block-drag.js:909 가 하는 것과 «같은 표식»을 단다. */
  await page.evaluate(() => {
    window.__tb.classList.add('editing');
    window.__content.setAttribute('contenteditable', 'true');
  });
  await raf(page);
  expect(await visibleHandleCount(page), '편집 중인데 손잡이가 보인다 — 글자 선택과 겹친다').toBe(0);

  /* 편집 종료(Escape 가 하는 일). ★클릭을 «다시 하지 않는다» — 그게 이 검사의 핵심이다. */
  await page.evaluate(() => {
    window.__tb.classList.remove('editing');
    window.__content.setAttribute('contenteditable', 'false');
  });
  await raf(page); await raf(page);
  const st = await page.evaluate(() => ({
    editing: window.__tb.classList.contains('editing'),
    selected: window.__tb.classList.contains('selected'),
  }));
  expect(st, '전제: 편집은 끝났고 블럭은 여전히 선택돼 있다').toEqual({ editing: false, selected: true });
  /* ★고치기 전엔 여기서 0 이었다 — rAF 가드가 hide…() 로 «파괴»하고 멈춰서
     _tfoResizeEl 이 null 이 되고, 편집이 끝나도 다시 부르는 자리가 없었다.
     보라 아웃라인만 남고 모서리 점이 사라진 「선택돼 있는데 손잡이만 없는」 상태. */
  expect(await visibleHandleCount(page), '★편집을 끝냈는데 손잡이가 안 돌아왔다 — 파괴형 가드다').toBe(4);
  expect(errs).toEqual([]);
});

test('D11 ★말풍선 — «본문» 글자가 폭과 같은 비율로 커진다 (이름표만 커지면 빨강)', async ({ page }) => {
  await boot(page);
  await mountBubble(page);
  await select(page);
  await toggleOverlay(page);
  const b = await page.evaluate(() => ({
    w: parseFloat(getComputedStyle(window.__tf).width),
    bubble: parseFloat(getComputedStyle(window.__content).fontSize),
    sender: parseFloat(getComputedStyle(window.__sender).fontSize),
  }));
  expect(b.bubble, '전제: 본문은 CSS 28px (인라인 font-size 가 없다 = 이 버그의 자리)').toBeGreaterThan(20);
  await dragHandle(page, 'se', 100, 60);
  const a = await page.evaluate(() => ({
    w: parseFloat(getComputedStyle(window.__tf).width),
    bubble: parseFloat(getComputedStyle(window.__content).fontSize),
    sender: parseFloat(getComputedStyle(window.__sender).fontSize),
  }));
  const kW = a.w / b.w;
  expect(kW, `전제: 폭이 커졌다 (${b.w} → ${a.w})`).toBeGreaterThan(1.05);
  /* ★고치기 전엔 `querySelector('[class^="tb-"]')`(단수)가 «첫» tb- 요소인 이름표를 집어
     이름표만 커지고 본문 28px 은 그대로였다 — 「상자만 커지는」 증상. */
  expect(Math.abs(a.bubble / b.bubble - kW) / kW,
    `★말풍선 «본문» 글자가 안 따라왔다 — 폭×${kW.toFixed(3)} / 본문×${(a.bubble / b.bubble).toFixed(3)}`)
    .toBeLessThan(0.01);
  expect(Math.abs(a.sender / b.sender - kW) / kW,
    `이름표가 본문과 다른 배율로 갔다 — 한 블록에 두 배율이 된다`).toBeLessThan(0.01);
});

/* ═══════════════════════════════════════════════════════════════════════════
   현빈 결정 2026-09-20 — 「오버레이 텍스트의 «크기조절»도 섹션 폭 밖까지 나갈 수 있어야 한다」
   이동(탄성 클램프 + 마그네틱 캐치, prop-text-wireup-overlay.js:86~:106)과 «같은 결».
   ═══════════════════════════════════════════════════════════════════════════ */

/* ★기대값을 «독립으로» 다시 센다 — 원본 _elasticAxis 를 import 하면 원본이 틀려도 늘 초록이다
   (tests/dom/overlay-drag-elastic-resist.dom.spec.js:32 가 쓰는 것과 같은 수법·같은 상수). */
const RESIST_ZONE_SCREEN_PX = 40;
const MAGNET_ZONE_SCREEN_PX = 10;
const RESIST_FACTOR = 0.35;
/** 경계를 over(로컬px) 만큼 넘었을 때 «실제로» 넘어가는 양. zone 도 로컬px. */
function expectedOver(over, zone) {
  const magnet = zone * (MAGNET_ZONE_SCREEN_PX / RESIST_ZONE_SCREEN_PX);
  if (over <= 0) return over;
  if (over <= magnet) return 0;                                   // 마그네틱 캐치 — 턱에 걸림
  if (over <= zone) return (over - magnet) * RESIST_FACTOR;       // 탄성 저항
  return (zone - magnet) * RESIST_FACTOR + (over - zone);         // 턱을 넘으면 1:1 자유
}

/** 블럭을 섹션 왼쪽 끝에 붙여 «남는 폭 = 섹션 폭»으로 만든다(경계를 한 곳으로 고정). */
async function pinLeft(page) {
  await page.evaluate(() => { window.__tf.dataset.offsetX = '0'; window.__tf.style.left = '0px'; });
  await raf(page); await raf(page);
}

/** 「오른쪽 끝이 섹션 경계를 over(화면px) 넘도록」 se 를 끌 때 필요한 마우스 dx(화면px).
 *  ★배율 k 는 «마우스 델타를 상자 대각선에 투영»해 구하므로(overlay-handles.js) 폭 증가분이
 *    dx 와 1:1 이 아니다 — W²/(W²+H²) 만큼만 폭에 실린다. 그 몫을 되돌려 dx 를 구한다. */
async function dxForOvershoot(page, overScreen) {
  return page.evaluate((overScreen) => {
    const tf = window.__tf, sec = document.getElementById('sec');
    const scale = parseFloat(document.getElementById('canvas-scaler').style.transform.match(/scale\(([^)]+)\)/)[1]);
    const W = Math.max(1, Math.round(tf.offsetWidth)), H = Math.max(1, Math.round(tf.offsetHeight));
    const left = Number(tf.dataset.offsetX) || 0;
    const bound = Math.max(60, sec.clientWidth - left, W);   // 상한(로컬) = 섹션 안에 남는 폭
    const rawW = bound + overScreen / scale;                 // 저항이 «없었다면» 나왔을 폭
    return { dx: (rawW - W) * (W * W + H * H) / (W * W) * scale, bound, W, H, scale };
  }, overScreen);
}

/** 섹션 오른쪽 경계를 실제로 넘어간 양(화면px). */
const overshootScreen = (page) => page.evaluate(() =>
  window.__tf.getBoundingClientRect().right - document.getElementById('sec').getBoundingClientRect().right);

test('D12 ★경계에서 이동 쪽과 «같은» 곡선 — 마그네틱 캐치 → 0.35 저항 → 자유', async ({ page }) => {
  /* 세 구간을 한 검사에서 잰다. 고치기 전(하드 클램프)엔 셋 다 «정확히 섹션 폭»이라 빨강. */
  const probes = [
    { over: 5,  what: '캐치 구간(<10화면px) — 턱에 걸려 경계에 딱 붙어야 한다' },
    { over: 25, what: '탄성 구간(10~40) — 넘은 만큼의 0.35배만 나가야 한다' },
    { over: 80, what: '자유 구간(>40) — 턱을 넘으면 1:1 로 나간다' },
  ];
  for (const p of probes) {
    await boot(page);
    await mount(page);
    await select(page);
    await toggleOverlay(page);
    await pinLeft(page);
    const geo = await dxForOvershoot(page, p.over);
    await dragHandle(page, 'se', geo.dx, 0);
    const w = await page.evaluate(() => parseFloat(window.__tf.style.width));
    const zone = RESIST_ZONE_SCREEN_PX / geo.scale;
    const want = geo.bound + expectedOver(p.over / geo.scale, zone);
    expect(Math.abs(w - want),
      `★${p.what} — 상한 ${geo.bound} 를 ${p.over}화면px 넘겼는데 폭이 ${w} 다(기대 ${want.toFixed(2)})`)
      .toBeLessThan(1.5);
  }
});

test('D13 ★줌 40/100/150 — 저항의 «손맛»이 화면px 기준으로 같다', async ({ page }) => {
  /* zone 을 로컬 상수로 고정하면 줌 40% 에서 저항이 화면 16px 로 쪼그라든다(이동 쪽이 2026-09-16l
     에 실제로 밟은 병) — 여기도 같은 병을 막는다. 같은 «화면» 오버슛엔 같은 «화면» 결과. */
  const got = [];
  for (const zoom of [40, 100, 150]) {
    await boot(page);
    await mount(page, { zoom });
    await select(page);
    await toggleOverlay(page);
    await pinLeft(page);
    const geo = await dxForOvershoot(page, 25);        // 화면 25px 오버슛 = 탄성 구간 한복판
    await dragHandle(page, 'se', geo.dx, 0);
    got.push({ zoom, over: await overshootScreen(page), scale: geo.scale });
  }
  /* 기대: 화면 25px 넘겼으니 (25-10)*0.35 = 5.25 화면px 만 실제로 나간다 — 줌과 무관. */
  for (const g of got) {
    expect(Math.abs(g.over - 5.25),
      `줌 ${g.zoom}% 에서 실제 오버슛이 ${g.over.toFixed(2)}화면px 다 — 줌마다 손맛이 다르다(기대 5.25)`)
      .toBeLessThan(1.2);
  }
  const spread = Math.max(...got.map(g => g.over)) - Math.min(...got.map(g => g.over));
  expect(spread, `줌에 따라 오버슛이 ${spread.toFixed(2)}화면px 나 벌어졌다 — 화면px 환산이 안 됐다`)
    .toBeLessThan(1.2);
});

test('D14 ★하한은 «그대로 하드» — 아무리 안쪽으로 끌어도 60 아래로 안 내려간다', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  await pinLeft(page);
  await dragHandle(page, 'se', -2000, -1200);
  const w = await page.evaluate(() => parseFloat(window.__tf.style.width));
  /* ★상한만 탄성으로 풀었다 — 하한에까지 탄성을 태우면 글자가 무한히 작아진다(현빈: 하한은 유지). */
  expect(w, `하한이 무너져 폭이 ${w} 가 됐다 — 60 이어야 한다`).toBe(60);
});

test('D15 ★sw 로 끌면 «왼쪽»으로도 섹션 밖까지 나간다 (반대편도 같은 규약)', async ({ page }) => {
  await boot(page);
  await mount(page);
  await select(page);
  await toggleOverlay(page);
  await pinLeft(page);
  const right0 = await page.evaluate(() => Number(window.__tf.dataset.offsetX) + window.__tf.offsetWidth);
  await dragHandle(page, 'sw', -900, 600);
  const r = await page.evaluate(() => ({
    left: Number(window.__tf.dataset.offsetX),
    w: parseFloat(window.__tf.style.width),
  }));
  expect(r.left, `★sw 로 끌었는데 왼쪽이 ${r.left} 에 멈췄다 — 섹션 왼쪽 밖으로 못 나간다`).toBeLessThan(-100);
  expect(Math.abs(r.left + r.w - right0), 'sw 를 끌었는데 오른쪽(맞은편)이 움직였다').toBeLessThan(2);
});
