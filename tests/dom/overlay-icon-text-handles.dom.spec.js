/* overlay-icon-text-handles.dom.spec.js — 「아이콘+텍스트 블럭도 오버레이 모서리 핸들을 받는가」.
 *
 * ★신고 (2026-09-20 최종 통합 라운드, QA medium)
 *   .icon-text-block 은 오버레이 «토글»은 켜지는데 모서리 핸들이 «0개»다.
 *
 * ★기전 — 문이 둘이다(T-068 이 텍스트에서 이미 밟은 그 모양)
 *   ⑴ js/overlay-handles.js showHandlesFor 의 마지막 갈래가
 *      `.text-block || .speech-bubble-block` 뿐이라 .icon-text-block 은 아무 갈래에도 안 걸린다.
 *      (그 갈래의 주석은 「말풍선·아이콘텍스트도 같은 토글을 타므로 자동으로 걸린다」고
 *       적혀 있었지만 아이콘텍스트는 .text-block 이 «아니다» — 주석이 사실과 달랐다.)
 *   ⑵ js/block-drag.js 의 isIconText 클릭 핸들러가 showHandlesFor 를 «아예 안 부른다»
 *      (isText 는 947행, zoom 은 1598행, modal 은 1959행에 같은 입구가 있다).
 *   ⇒ 한쪽만 고치면 「레이어패널로 고르면 나오는데 클릭하면 안 나온다」가 된다.
 *
 * ★패널은 왜 토글을 주나 — .icon-text-block 의 클릭 핸들러가 showTextProperties 를 부르고
 *   (block-drag.js), 그 패널이 wireOverlaySection 을 배선한다. 토글은 tb 클래스를 안 가린다.
 *
 * ★무엇을 재나
 *   I1 ★오버레이를 켜면 모서리 핸들이 4개 붙는다 (고치기 전 0)
 *   I2 ★se 를 끌면 폭이 커지고 «글자도 비례로» 커진다 (현빈 결정 A안: 「글자도 같이 커지는 게 맞아」)
 *   I3 음성대조 — 오버레이가 «아닌» 아이콘텍스트에는 안 붙는다 (흐름 블럭은 부모가 폭을 정한다)
 *   I4 가드 — 오버레이를 «끄면» 핸들이 스스로 걷힌다
 *   I5 ★아이콘 칸(.itb-icon)도 «글자와 같은 배율»로 커진다 (현빈 2026-09-21 「같이커져야지」)
 *      — 2026-09-20 까지 이 자리는 「안 커진다」는 «한계 기록»이었다. 결정이 나와 뒤집었다.
 *   I6 ★⌘Z 는 «크기만» 되돌린다 — 드래그 한 번에 히스토리 표본이 두 벌(시작·끝) 남는다
 *   I7 ★하한 — 잔뜩 줄여도 폭은 TFO_MIN_W 밑으로 안 가고 아이콘도 0 이나 음수가 안 된다
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(text-overlay-resize.dom.spec.js 와 같은 부팅).
 * ⚠️변이 책임은 tests/unit/overlay-icon-text-handles.test.mjs 가 진다(tests/dom 은 `npm test` 밖).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-icon-text-handles
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<link rel="stylesheet" href="/css/editor-extra.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block" id="sec" style="width:860px;min-height:600px">
      <div class="section-inner" id="host" style="width:600px;margin:0 auto"></div>
    </div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<script src="/js/feature-flags.js"></script>
<script src="/js/drag-history.js"></script>
<script type="module">
  import '/js/block-factory.js';                    // window.makeIconTextBlock
  import { showHandlesFor } from '/js/overlay-handles.js';
  window.currentZoom = 100;
  window.__show = showHandlesFor;
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

const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** 줌(transform)의 «transition .15s» 가 멈출 때까지 기다린다.
 *  ⛔raf 두 번으로 갈음하면 안 된다 — 도는 중인 rect 로 손잡이 좌표가 잡혀 마우스다운이
 *    빗나가고(실측: 줌 40% 에서 인라인 크기가 한 건도 안 붙었다) 검사가 «고침 탓»으로
 *    빨개진다. 형제 spec(text-overlay-resize.dom.spec.js settle)과 같은 술어다. */
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

/** 아이콘+텍스트 한 덩이를 «진짜 팩토리»로 올린다. overlay=true 면 오버레이(플로팅) 상태로 둔다. */
async function mount(page, { overlay, zoom = 100 }) {
  await page.evaluate(({ overlay, zoom }) => {
    /* 캔버스 줌 — _canvasScaleNow 가 #canvas-scaler 의 transform 을 읽는다(현빈 실사용 40%). */
    document.getElementById('canvas-scaler').style.transform = `scale(${zoom / 100})`;
    window.currentZoom = zoom;
    const { row, block } = window.makeIconTextBlock();
    document.getElementById('host').appendChild(row);
    window.__itb = block;
    /* 오버레이 진입 자체는 prop-text-wireup-overlay 가 하는 일이라 여기선 «결과 상태»만 만든다
       — 이 검사의 관심사는 「그 상태에서 손잡이가 붙나」이지 「토글이 도나」가 아니다
       (토글 배선은 tests/dom/text-overlay-resize 가 진짜 버튼으로 잰다). */
    if (overlay) {
      block.dataset.overlayBlock = 'true';
      block.style.position = 'absolute';
      block.style.left = '80px'; block.dataset.offsetX = '80';
      block.style.top  = '40px'; block.dataset.offsetY = '40';
      block.style.width = '300px';
    }
    block.classList.add('selected');
    window.__pushes = [];
    window.pushHistory = (label) => window.__pushes.push(label);
    window.__arms = 0;
    window.beginDragHistory = () => ({ arm: () => { window.__arms++; } });
    window.__show(block);
  }, { overlay, zoom });
  await settle(page);
  await raf(page);
}

const handleCount = (page) => page.evaluate(() =>
  document.querySelectorAll('#ss-handles-overlay .tfo-overlay-handle').length);

const measure = (page) => page.evaluate(() => {
  const b = window.__itb;
  const t = b.querySelector(':scope > .itb-text');
  const i = b.querySelector(':scope > .itb-icon');
  return {
    w: Math.round(b.getBoundingClientRect().width),
    fs: +parseFloat(getComputedStyle(t).fontSize).toFixed(1),
    iconW: Math.round(i.getBoundingClientRect().width),
    iconH: Math.round(i.getBoundingClientRect().height),
    svgW: +(i.querySelector('svg')?.getBoundingClientRect().width || 0).toFixed(1),
  };
});

/** 손잡이 하나를 «진짜 마우스»로 끈다. */
async function dragHandle(page, dir, dx, dy) {
  const box = await page.locator(`#ss-handles-overlay .tfo-overlay-handle.${dir}`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
  await page.mouse.up();
  await raf(page);
}

test.describe('아이콘+텍스트 블럭의 오버레이 모서리 핸들', () => {
  test('I1 ★오버레이면 모서리 핸들이 4개 붙는다 (고치기 전 0)', async ({ page }) => {
    const errs = await boot(page);
    await mount(page, { overlay: true });
    expect(await handleCount(page), '모서리 핸들이 0개다 — showHandlesFor 에 갈래가 없다').toBe(4);
    expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  });

  test('I2 ★se 를 끌면 폭과 «글자»가 같이 커진다 (현빈 결정 A안)', async ({ page }) => {
    await boot(page);
    await mount(page, { overlay: true });
    const before = await measure(page);
    await dragHandle(page, 'se', 150, 0);
    const after = await measure(page);
    expect(after.w, `폭 ${before.w} → ${after.w}`).toBeGreaterThan(before.w + 100);
    expect(after.fs, `글자 ${before.fs} → ${after.fs} — 폭만 커지고 글자는 그대로다(A안 위반)`)
      .toBeGreaterThan(before.fs);
    // 비례가 «대충 맞나» — 폭 배율과 글자 배율이 같은 방향·같은 자릿수
    const kw = after.w / before.w, kf = after.fs / before.fs;
    expect(Math.abs(kf - kw), `폭 배율 ${kw.toFixed(2)} vs 글자 배율 ${kf.toFixed(2)}`).toBeLessThan(0.25);
  });

  test('I3 음성대조 — 오버레이가 «아닌» 아이콘텍스트에는 안 붙는다', async ({ page }) => {
    await boot(page);
    await mount(page, { overlay: false });
    expect(await handleCount(page), '흐름(오토레이아웃) 블럭에 손잡이가 붙었다').toBe(0);
  });

  test('I4 가드 — 오버레이를 끄면 손잡이가 스스로 걷힌다', async ({ page }) => {
    await boot(page);
    await mount(page, { overlay: true });
    expect(await handleCount(page)).toBe(4);
    await page.evaluate(() => { delete window.__itb.dataset.overlayBlock; });
    await raf(page); await raf(page);
    expect(await handleCount(page), 'rAF 감시가 오버레이 해제를 못 알아챘다').toBe(0);
  });

  test('I5 ★아이콘 칸(.itb-icon)도 «글자와 같은 배율»로 커진다 (현빈 2026-09-21 결정)', async ({ page }) => {
    await boot(page);
    await mount(page, { overlay: true });
    const before = await measure(page);
    await dragHandle(page, 'se', 150, 0);
    const after = await measure(page);
    /* ★2026-09-20 까지 이 검사는 「아이콘은 안 커진다」를 «기록»하고 있었다(당시 주석:
       「결정이 «같이 커진다»로 나면 이 검사부터 뒤집어라」). 2026-09-21 현빈 결정
       「아이콘+텍스트 키울때 같이커져야지」로 뒤집는다. */
    expect(after.iconW, `아이콘 칸 ${before.iconW} → ${after.iconW} — 40×40 고정에 갇혔다`)
      .toBeGreaterThan(before.iconW);
    const kw = after.w / before.w;
    const ki = after.iconW / before.iconW;
    const kf = after.fs / before.fs;
    /* 회귀 기준 = 「글자·아이콘 배율 일치(오차 <1%)」. 둘 다 같은 k 를 곱하므로
       남는 차이는 px 반올림뿐이다(40px 칸의 1px ≈ 0.3%). */
    expect(Math.abs(ki - kf) / kf, `아이콘 배율 ${ki.toFixed(3)} vs 글자 배율 ${kf.toFixed(3)}`)
      .toBeLessThan(0.01);
    expect(Math.abs(ki - kw), `아이콘 배율 ${ki.toFixed(3)} vs 폭 배율 ${kw.toFixed(3)}`)
      .toBeLessThan(0.25);
    // 정사각 유지 — aspect-ratio 를 인라인 크기가 깨뜨리지 않는다
    expect(after.iconH, `아이콘 ${after.iconW}×${after.iconH} — 정사각이 깨졌다`).toBe(after.iconW);
    // 아이콘 «속» 그림(placeholder SVG)도 같이 커진다 — 안 그러면 큰 상자에 좁쌀 하나
    expect(after.svgW, `아이콘 속 SVG ${before.svgW} → ${after.svgW}`).toBeGreaterThan(before.svgW);
  });

  test('I6 ★⌘Z 는 «크기만» — 드래그가 시작·끝 표본을 두 벌 남긴다', async ({ page }) => {
    await boot(page);
    await mount(page, { overlay: true });
    await dragHandle(page, 'se', 150, 0);
    /* 시작 표본은 beginDragHistory().arm 이, 끝 표본은 pushHistory 가 찍는다.
       한 벌만 남으면 ⌘Z 가 «블럭 삽입»까지 먹는다(형제 유닛 0920b-resize-undo 가 잡은 병).
       이 하네스는 진짜 히스토리 대신 호출을 «센다» — 실제 되돌리기는 앱 실측으로 본다. */
    const pushes = await page.evaluate(() => window.__pushes.slice());
    const arms = await page.evaluate(() => window.__arms || 0);
    expect(pushes, `pushHistory 호출: ${JSON.stringify(pushes)}`).toContain('오버레이 텍스트 크기');
    expect(arms, '시작 표본(arm)이 0 — ⌘Z 가 크기가 아니라 삽입을 되돌린다').toBeGreaterThan(0);
  });

  test('I7 ★하한 — 잔뜩 줄여도 폭·아이콘이 0 이나 음수가 안 된다', async ({ page }) => {
    await boot(page);
    await mount(page, { overlay: true });
    await dragHandle(page, 'se', -600, -600);
    const after = await measure(page);
    expect(after.w, `폭 ${after.w}`).toBeGreaterThanOrEqual(20);
    expect(after.iconW, `아이콘 ${after.iconW}`).toBeGreaterThan(0);
    expect(after.fs, `글자 ${after.fs}`).toBeGreaterThan(0);
  });

  test('I8 ★줌 40%(현빈 실사용) 에서도 아이콘 배율이 글자와 같다 — 스케일 보정', async ({ page }) => {
    await boot(page);
    await mount(page, { overlay: true, zoom: 40 });
    const before = await measure(page);
    await dragHandle(page, 'se', 60, 0);   // 화면 60px = 문서 150px
    const after = await measure(page);
    /* ⚠️여기가 이 고침의 «함정»이다 — 아이콘 시작 크기를 getBoundingClientRect 로 재면
       줌이 곱해진 «화면 px»(40×0.4=16)을 시작값으로 잡아 첫 프레임에 칸이 쪼그라든다.
       그래서 스냅샷은 레이아웃 px 인 offsetWidth 로 잰다. 이 검사가 그 선택을 지킨다. */
    expect(after.iconW, `줌 40% — 아이콘 ${before.iconW} → ${after.iconW}`).toBeGreaterThan(before.iconW);
    const ki = after.iconW / before.iconW, kf = after.fs / before.fs;
    expect(Math.abs(ki - kf) / kf, `아이콘 ${ki.toFixed(3)} vs 글자 ${kf.toFixed(3)}`).toBeLessThan(0.02);
  });
});
