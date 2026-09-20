/* overlay-extend-asset.dom.spec.js — 0920b 현빈 원문 3번(T-052) 중 «에셋» 쪽 회귀 게이트.
 *
 * ★에셋 고유의 함정 = «폭이 % 다». prop-asset.js applyAssetPadX 가 `width: 93.02%` 같은 값을
 *   쓴다. % 는 «부모 기준»이라 흐름(.row, 섹션 본문 폭)에서 섹션 직속 absolute 로 옮기는 순간
 *   기준이 «섹션 전체 폭»으로 바뀌어 블록이 소리 없이 커진다. 그래서 진입할 때 px 로 굳힌다
 *   (텍스트의 dataset.overlayIntroducedWidth 와 같은 규약, 다만 dataset.width 는 타입마다 뜻이
 *   달라 에셋엔 안 쓴다 — js/overlay-float.js _freezeWidth 주석 참고).
 *
 *   A1 진입해도 화면 폭이 그대로다(px 로 굳는다)
 *   A2 [음성대조] 굳히기를 안 하면 폭이 실제로 달라진다 — 이 검사가 허수가 아님을 증명
 *   A3 이탈하면 원래 % 폭이 그대로 돌아온다(우리가 심은 것만 되돌린다)
 *
 * ⛔앱을 «안» 띄운다. 실제 js/overlay-float.js · css/editor-layout.css 를 route 로 먹인다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-extend-asset
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const OVERLAY_FLOAT_JS = fs.readFileSync(path.join(REPO, 'js/overlay-float.js'), 'utf8');
const FRAME_GEOMETRY_JS = fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8');
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');
const LAYOUT_CSS = fs.readFileSync(path.join(REPO, 'css/editor-layout.css'), 'utf8');
/* z-index 판정(A5)은 «실제 규칙끼리의 특이도 싸움»을 재는 것이라 editor-blocks.css 가 필요하다. */
const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');

/* 섹션 800 · 본문(.section-inner) 716 — 실제 앱의 「캔버스 860, 좌우 패딩」 구도와 같은 꼴.
   % 폭이 기준을 바꾸면 눈에 띄게 커진다(93.02% → 666 vs 744). */
const PCT = '93.02%';

/* ★음성대조용 — «고치기 전» CSS 를 만든다. 규칙을 새로 써넣는 게 아니라 실제 파일의 선택자를
   옛 것(속성 하나짜리)으로 되돌려 그대로 먹인다 — 그래야 「특이도 싸움」이 진짜로 재현된다. */
const OLD_ZIDX_SELECTOR = '[data-overlay-block="true"] {';
const NEW_ZIDX_SELECTOR = '.section-block > [data-overlay-block="true"] {';
function blocksCss(oldZIndex) {
  if (!oldZIndex) return BLOCKS_CSS;
  if (!BLOCKS_CSS.includes(NEW_ZIDX_SELECTOR)) {
    throw new Error('★음성대조 치환 앵커를 못 찾음 — editor-blocks.css 의 오버레이 z-index 선택자가 바뀌었으면 여기도 고쳐라');
  }
  return BLOCKS_CSS.replace(NEW_ZIDX_SELECTOR, OLD_ZIDX_SELECTOR)
                   .replace('z-index: 80 !important;', 'z-index: 80;');
}

function harness({ oldZIndex = false } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>${LAYOUT_CSS}</style>
    <style>${blocksCss(oldZIndex)}</style>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; }
      .section-block { position: relative; width: 800px; height: 500px; background: #fff; }
      .section-inner { position: relative; width: 716px; margin: 0 auto; }
    </style>
    </head><body>
    <div class="section-block" id="sec1">
      <div class="section-inner" id="inner1">
        <div class="row" id="row0">
          <div class="asset-block" id="ab1" style="width:${PCT};align-self:center;height:200px;background:#ddd;"></div>
        </div>
        <!-- ★풀블리드(applyAssetFullBleed) — 음수 마진으로 섹션 패딩을 침범하는 실제 규약 -->
        <div class="row" id="row1">
          <div class="asset-block" id="ab2"
               style="width:calc(100% + 84px);margin-left:-42px;margin-right:-42px;height:120px;background:#ccc;"></div>
        </div>
      </div>
    </div>
    <script>
      window.currentZoom = 100;
      window.pushHistory = () => {};
      window.scheduleAutoSave = () => {};
      window.triggerAutoSave = () => {};
      window.buildLayerPanel = () => {};
      window._findSectionAt = () => null;
      window.genId = (p) => p + '_' + Math.random().toString(36).slice(2, 8);
    </script>
    <script type="module" src="/overlay-float.js"></script>
    </body></html>`;
}

async function boot(page, opts = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: harness(opts) });
    if (url.pathname === '/overlay-float.js') return route.fulfill({ contentType: 'application/javascript', body: OVERLAY_FLOAT_JS });
    if (url.pathname === '/frame-geometry.js') return route.fulfill({ contentType: 'application/javascript', body: FRAME_GEOMETRY_JS });
    if (url.pathname === '/shape-frame.js') return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => !!window.OverlayFloat);
  return errs;
}

test('A0 전제 — posElOf(.asset-block) 는 «자기 자신»이고, 폭이 실제로 % 로 잡혀 있다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    return { same: window.OverlayFloat.posElOf(ab) === ab, w: ab.style.width, px: Math.round(ab.getBoundingClientRect().width) };
  });
  expect(r.same).toBe(true);
  expect(r.w).toContain('%');
  expect(r.px, '전제가 안 맞다 — 본문(716) 기준 폭이 아니다').toBeGreaterThan(600);
});

test('A1 ★진입 — 화면 폭이 그대로 유지된다(% → px 고정)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    const before = Math.round(ab.getBoundingClientRect().width);
    window.OverlayFloat.enterFloat(ab);
    const after = Math.round(ab.getBoundingClientRect().width);
    return {
      before, after,
      parentId: ab.parentElement.id,
      overlay: ab.dataset.overlayBlock,
      styleW: ab.style.width,
      prevW: ab.dataset.overlayPrevWidth,
      introduced: ab.dataset.overlayIntroducedWidth,
      // ⛔dataset.width 는 타입마다 뜻이 다르다 — 에셋엔 심지 않는다
      dsWidth: ab.dataset.width ?? null,
      variant: ab.dataset.selVariant,
    };
  });
  expect(errs, `페이지 에러: ${errs.join(' | ')}`).toEqual([]);
  expect(r.parentId).toBe('sec1');
  expect(r.overlay).toBe('true');
  expect(Math.abs(r.after - r.before), `진입하면서 폭이 ${r.before}→${r.after} 로 바뀌었다`).toBeLessThanOrEqual(1);
  expect(r.styleW).toMatch(/^\d+px$/);
  expect(r.prevW, '원래 % 폭을 안 적어 뒀다 — 이탈할 때 되돌릴 수 없다').toBe('93.02%');
  expect(r.introduced).toBe('true');
  expect(r.dsWidth, 'dataset.width 를 심었다 — 에셋에선 다른 뜻으로 읽힌다').toBe(null);
  expect(r.variant, '보라 아웃라인용 selVariant 가 없다').toBe('sticker');
});

test('A2 [음성대조] 폭을 안 굳히고 그냥 띄우면 실제로 폭이 달라진다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    const sec = document.getElementById('sec1');
    const before = Math.round(ab.getBoundingClientRect().width);
    // ★고치기 «전» 동작 재현 — 폭 고정 없이 absolute + 섹션 직속으로만 옮긴다
    sec.appendChild(ab);
    ab.style.position = 'absolute';
    ab.style.left = '0px'; ab.style.top = '0px';
    return { before, after: Math.round(ab.getBoundingClientRect().width) };
  });
  expect(Math.abs(r.after - r.before),
    `양성대조가 재현 안 됐다(${r.before}→${r.after}) — 폭 고정이 없어도 폭이 안 변한다면 A1 은 아무것도 안 보는 검사다`)
    .toBeGreaterThan(10);
});

test('A3 ★이탈 — 원래 % 폭이 그대로 돌아온다(우리가 심은 것만 되돌린다)', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    const before = Math.round(ab.getBoundingClientRect().width);
    window.OverlayFloat.enterFloat(ab);
    window.OverlayFloat.exitFloat(ab);
    return {
      before, after: Math.round(ab.getBoundingClientRect().width),
      parentId: ab.parentElement.id,
      styleW: ab.style.width,
      position: ab.style.position,
      introduced: ab.dataset.overlayIntroducedWidth ?? null,
      prevW: ab.dataset.overlayPrevWidth ?? null,
      variant: ab.dataset.selVariant ?? null,
    };
  });
  expect(r.parentId).toBe('row0');
  expect(r.styleW, '원래 % 폭이 안 돌아왔다').toBe('93.02%');
  expect(r.position).toBe('');
  expect(r.after).toBe(r.before);
  expect(r.introduced).toBe(null);
  expect(r.prevW).toBe(null);
  expect(r.variant).toBe(null);
});

test('A4 ★풀블리드(음수 마진) 에셋 — 진입해도 화면 «가로 자리»가 그대로다', async ({ page }) => {
  /* ★2026-09-20 라이브 실측(포트 9503, 줌 40%)에서 잡은 결함 — 진입만 했는데 x 가 545→516 으로
     뛰었다(-29 화면px = margin-left -72 로컬px). absolute 의 left 는 이미 «보이던 자리»를 담는데
     음수 마진이 그 위에 한 번 더 걸린다. 띄우는 동안만 마진을 걷어낸다. */
  await boot(page);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab2');
    const b = ab.getBoundingClientRect();
    window.OverlayFloat.enterFloat(ab);
    const a = ab.getBoundingClientRect();
    return { bx: Math.round(b.x), ax: Math.round(a.x), bw: Math.round(b.width), aw: Math.round(a.width),
             ml: ab.style.marginLeft, prevL: ab.dataset.overlayPrevMarginL };
  });
  expect(Math.abs(r.ax - r.bx), `진입하면서 가로로 ${r.bx}→${r.ax} 뛰었다`).toBeLessThanOrEqual(1);
  expect(Math.abs(r.aw - r.bw), '폭까지 바뀌었다').toBeLessThanOrEqual(1);
  expect(r.ml, '음수 마진을 안 걷어냈다').toBe('0px');
  expect(r.prevL, '원래 마진을 안 적어 뒀다 — 이탈할 때 되돌릴 수 없다').toBe('-42px');
});

test('A4-b ★이탈 — 음수 마진이 그대로 되돌아온다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab2');
    const b = ab.getBoundingClientRect();
    window.OverlayFloat.enterFloat(ab);
    window.OverlayFloat.exitFloat(ab);
    const a = ab.getBoundingClientRect();
    return { bx: Math.round(b.x), ax: Math.round(a.x), ml: ab.style.marginLeft, mr: ab.style.marginRight,
             flag: ab.dataset.overlayIntroducedMargin ?? null };
  });
  expect(r.ml).toBe('-42px');
  expect(r.mr).toBe('-42px');
  expect(r.flag).toBe(null);
  expect(r.ax).toBe(r.bx);
});

test('A4-c [음성대조] 마진을 안 걷어내면 실제로 좌로 뛴다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab2');
    const sec = document.getElementById('sec1');
    const b = ab.getBoundingClientRect();
    const secR = sec.getBoundingClientRect();
    const x = Math.round(b.left - secR.left), y = Math.round(b.top - secR.top);
    // ★고치기 «전» 동작 — 마진을 그대로 둔 채 absolute 로만 옮긴다
    ab.style.width = Math.round(ab.offsetWidth) + 'px';
    sec.appendChild(ab);
    ab.style.position = 'absolute';
    ab.style.left = x + 'px'; ab.style.top = y + 'px';
    return { bx: Math.round(b.x), ax: Math.round(ab.getBoundingClientRect().x) };
  });
  expect(Math.abs(r.ax - r.bx),
    `양성대조가 재현 안 됐다(${r.bx}→${r.ax}) — 마진을 안 걷어내도 안 뛴다면 A4 는 허수다`).toBeGreaterThan(10);
});

test('A5 ★선택해도 z-index 가 80 이다 — 선택 규칙(.asset-block.selected{z-index:2})에 안 진다', async ({ page }) => {
  /* ★같은 라이브 실측에서 잡은 두 번째 결함 — 에셋은 posEl 이 .asset-block «자신»이라
     고르는 순간 특이도 (0,2,0) 짜리 선택 규칙이 속성 하나짜리(0,1,0)를 이겼다. */
  await boot(page);
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    window.OverlayFloat.enterFloat(ab);
    const z0 = getComputedStyle(ab).zIndex;
    ab.classList.add('selected');
    return { unselected: z0, selected: getComputedStyle(ab).zIndex };
  });
  expect(r.unselected).toBe('80');
  expect(r.selected, '선택하면 z-index 가 떨어진다 — 본문 밑으로 다시 깔린다').toBe('80');
});

test('A5-b [음성대조] 옛 선택자(속성 하나)였다면 선택 시 실제로 2 로 떨어진다', async ({ page }) => {
  await boot(page, { oldZIndex: true });   // 실제 CSS 의 선택자만 옛 것으로 되돌려 먹인다
  const r = await page.evaluate(() => {
    const ab = document.getElementById('ab1');
    window.OverlayFloat.enterFloat(ab);
    const z0 = getComputedStyle(ab).zIndex;
    ab.classList.add('selected');
    return { unselected: z0, selected: getComputedStyle(ab).zIndex };
  });
  expect(r.unselected, '전제: 선택 전에는 옛 선택자도 80 이었다').toBe('80');
  expect(r.selected,
    '양성대조가 재현 안 됐다 — 옛 선택자로도 80 이면 A5 는 특이도를 안 보고 있다').toBe('2');
});
