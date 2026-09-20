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
 *   I5 ⚠️알려진 한계 — 아이콘 칸(.itb-icon)은 «안» 커진다. 이 검사는 그 사실을 «기록»한다
 *      (CSS 40×40 고정이고 인라인 크기를 쓰는 경로가 레포에 없다 ⇒ 새 표현을 발명하지 않았다.
 *       「아이콘도 같이 커져야 하나」는 현빈 판단 사안으로 보고서에 올린다.)
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

/** 아이콘+텍스트 한 덩이를 «진짜 팩토리»로 올린다. overlay=true 면 오버레이(플로팅) 상태로 둔다. */
async function mount(page, { overlay }) {
  await page.evaluate((overlay) => {
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
    window.beginDragHistory = window.beginDragHistory || (() => ({ arm: () => {} }));
    window.__show(block);
  }, overlay);
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

  test('I5 ⚠️알려진 한계 기록 — 아이콘 칸(.itb-icon)은 «안» 커진다', async ({ page }) => {
    await boot(page);
    await mount(page, { overlay: true });
    const before = await measure(page);
    await dragHandle(page, 'se', 150, 0);
    const after = await measure(page);
    /* ⚠️이건 «바람직하다»는 뜻이 아니라 «지금 이렇다»는 기록이다.
       .itb-icon 은 css/editor-extra.css 에서 40×40 고정이고, 레포 어디에도 이 칸에
       인라인 크기를 쓰는 경로가 없다 ⇒ 새 표현을 발명하지 않았다.
       「아이콘도 같이 커져야 하나」는 현빈 판단 사안으로 보고서에 올렸다.
       ★결정이 「같이 커진다」로 나면 이 검사부터 뒤집어라(그때는 여기가 red 가 맞다). */
    expect(after.iconW, `아이콘 칸 ${before.iconW} → ${after.iconW}`).toBe(before.iconW);
  });
});
