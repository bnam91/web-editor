/* text-stroke-align.dom.spec.js — ★1012t1E1 텍스트 블럭 외곽선 위치(내부 / 가운데 / 외부)
 *
 * ★판정은 dataset 이 아니라 «픽셀»이다: 요소 스크린샷 → 같은 페이지 canvas 로 디코드 → 글자 'H' 왼쪽 세로획을 지나는
 *   가로 한 줄의 색 분류. 기준 = 외곽선 «끈» 같은 블럭의 노랑 시작점 x0(외곽선은 레이아웃을 안 바꾼다).
 *   바깥 = [x0-R, x0) 의 파랑 수 · 안쪽 = [x0, x0+R) 의 파랑 수 (css px 로 환산 · dpr 기록).
 * ★되돌리기·로드는 «HTML 스냅샷» 복원으로 잰다(host.innerHTML) — 필터 정의(#gdsk-svg-defs)는 캔버스 밖이라 안 실린다.
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(text-gradient.dom.spec.js 하네스를 본떴다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/text-stroke-align.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const W = 6;                 // 보이는 외곽선 두께(css px)
const TXT = 'font:900 200px sans-serif;line-height:1;color:#ffcc00;padding:30px;display:inline-block';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>#panel-right{position:fixed;left:0;top:0;width:240px;} #canvas{position:absolute;left:600px;top:0;width:600px;background:#fff;}</style>
</head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host" style="background:#fff">
  <div class="text-block" id="tbS" data-type="heading"><div class="tb-h1" contenteditable="false" style="${TXT}">H</div></div>
  <div class="text-block" id="tbL" data-type="heading"><div class="tb-h1" contenteditable="false" style="${TXT};-webkit-text-stroke:${2 * W}px #0000ff;paint-order:stroke fill">H</div></div>
  <div class="text-block" id="tbG" data-type="heading"><div class="tb-h1" contenteditable="false" style="${TXT};background-image:linear-gradient(#ffcc00,#ffcc00);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;text-shadow:40px 0 0 #ff0000">H</div></div>
  <div class="text-block" id="tbLab" data-type="label"><div class="tb-label" contenteditable="false">라벨</div></div>
</div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script src="/js/text-effect-transform.js"></script>
<script type="module">
  import '/js/props/color-picker.js';
  import '/js/props/text-block-color.js';
  import { showTextProperties } from '/js/props/prop-text.js';
  const host = document.getElementById('host');
  window.__snaps = [host.innerHTML];
  window.pushHistory = () => { window.__snaps.push(host.innerHTML); };
  window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => '';
  window.__text = showTextProperties;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => document.fonts.ready);
  return errs;
}

const select = (page, id) => page.evaluate((i) => window.__text(document.getElementById(i)), id);
const content = (id) => `#${id} .tb-h1`;

/** 요소 스크린샷 한 줄(높이 30%)의 색 분류: B(파랑) Y(노랑) R(빨강) .(흰) ~(그 밖) */
async function rowClasses(page, id) {
  const buf = await page.locator(content(id)).screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const y = Math.round(img.height * 0.30);
    const d = x.getImageData(0, y, img.width, 1).data;
    const cls = [];
    for (let i = 0; i < img.width; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], bb = d[i * 4 + 2];
      cls.push(bb > 180 && r < 90 && g < 90 ? 'B' : (r > 200 && g > 150 && bb < 90 ? 'Y' : (r > 200 && g < 80 && bb < 80 ? 'R' : (r > 230 && g > 230 && bb > 230 ? '.' : '~'))));
    }
    return { cls: cls.join(''), dpr: devicePixelRatio };
  }, buf.toString('base64'));
}

/** x0(기준 노랑 시작) 둘레 바깥/안쪽 파랑 수(css px) */
function bands(row, x0, dpr) {
  const R = Math.round(3 * W * dpr);
  let out = 0, inn = 0;
  for (let i = Math.max(0, x0 - R); i < x0; i++) if (row[i] === 'B') out++;
  for (let i = x0; i < Math.min(row.length, x0 + R); i++) if (row[i] === 'B') inn++;
  return { out: out / dpr, inn: inn / dpr };
}

/** 외곽선 «끈» 상태의 기준 x0 와 세로획 노랑 폭(전제) */
async function baseline(page, id) {
  const r = await rowClasses(page, id);
  const x0 = r.cls.indexOf('Y');
  expect(x0, '전제: 기준에 노랑 글자가 보인다').toBeGreaterThan(0);
  let n = 0; while (r.cls[x0 + n] === 'Y') n++;
  expect(n / r.dpr, `전제: 세로획이 안쪽 띠 두 겹(2×${W})보다 굵다 (dpr ${r.dpr})`).toBeGreaterThan(2 * W + 4);
  return { x0, dpr: r.dpr };
}

/* ★색은 «명시»한다 — Stroke 기본색은 검정(STROKE_DEFAULTS.color '#000000')이고 이 줄 분류는 파랑(B)만 센다.
 *   (색을 안 정하면 외곽선은 그려져도 검정이라 바깥/안쪽 파랑 수가 0 이 된다 — 2d08bab7 의 S3~S8 빨강이 그것.)
 *   패널의 색 칸(native picker input)으로 넣고, 글자칸 data-stroke-color 가 파랑이 됐음을 전제로 단언한다. */
const BLUE = '#0000ff';
async function panelSet(page, { on, w, color, align }) {
  if (on !== undefined) await page.evaluate((v) => {
    const c = document.getElementById('txt-stroke-on'); c.checked = v; c.dispatchEvent(new Event('change', { bubbles: true }));
  }, on);
  if (w !== undefined) await page.evaluate((v) => {
    const n = document.getElementById('txt-stroke-w-number'); n.value = String(v);
    n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
  }, w);
  if (color !== undefined) {
    await page.evaluate((v) => {
      const p = document.getElementById('txt-stroke-color-color'); p.value = v;
      p.dispatchEvent(new Event('input', { bubbles: true })); p.dispatchEvent(new Event('change', { bubbles: true }));
    }, color);
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.tb-h1')].map(e => e.dataset.strokeColor)), '전제: 패널 색 칸이 글자칸 색을 바꿨다').toContain(color);
  }
  if (align !== undefined) await page.locator('#txt-stroke-align').selectOption(align);
}

test('S1 텍스트 블럭에 Stroke 절이 뜨고 위치 = 내부/가운데/외부 · 라벨엔 없다', async ({ page }) => {
  const errs = await boot(page);
  await select(page, 'tbS');
  await expect(page.locator('#txt-stroke-section')).toBeVisible();
  const opts = await page.locator('#txt-stroke-align option').evaluateAll(os => os.map(o => [o.value, o.textContent.trim()]));
  expect(opts).toEqual([['inside', '내부'], ['center', '가운데'], ['outside', '외부']]);
  // 이웃 순서: Fill(…) 다음, Shadow 앞
  const order = await page.evaluate(() => {
    const s = document.getElementById('txt-stroke-section'), sh = document.getElementById('txt-shadow-section');
    return !!(s.compareDocumentPosition(sh) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order, 'Stroke 절이 Shadow 절 앞').toBe(true);
  await select(page, 'tbLab');
  await expect(page.locator('#txt-shadow-section'), '전제: 라벨 패널이 그려졌다').toHaveCount(1);
  await expect(page.locator('#txt-stroke-section')).toHaveCount(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 레거시(API) 외곽선 = 외부 · 보이는 W/2 로 «해석만» — style 문자열 무변화', async ({ page }) => {
  const errs = await boot(page);
  const before = await page.locator(content('tbL')).getAttribute('style');
  expect(before, '전제: 레거시 인라인 외곽선').toContain('-webkit-text-stroke');
  await select(page, 'tbL');
  await expect(page.locator('#txt-stroke-on')).toBeChecked();
  await expect(page.locator('#txt-stroke-w-number')).toHaveValue(String(W));
  await expect(page.locator('#txt-stroke-align')).toHaveValue('outside');
  expect(await page.locator(content('tbL')).getAttribute('style')).toBe(before);
  expect(await page.locator(content('tbL')).evaluate(el => Object.keys(el.dataset).filter(k => k.startsWith('stroke')))).toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S3 외부 — 바깥 ≈W · 안쪽 0', async ({ page }) => {
  const errs = await boot(page);
  const { x0, dpr } = await baseline(page, 'tbS');
  await select(page, 'tbS');
  await panelSet(page, { on: true, w: W, color: BLUE, align: 'outside' });
  await expect.poll(() => page.locator(content('tbS')).evaluate(el => el.dataset.strokeAlign)).toBe('outside');
  const b = bands((await rowClasses(page, 'tbS')).cls, x0, dpr);
  expect(b.out).toBeGreaterThanOrEqual(W - 2); expect(b.out).toBeLessThanOrEqual(W + 2);
  expect(b.inn).toBeLessThanOrEqual(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S4 가운데 — 바깥 ≈W/2 · 안쪽 ≈W/2', async ({ page }) => {
  const errs = await boot(page);
  const { x0, dpr } = await baseline(page, 'tbS');
  await select(page, 'tbS');
  await panelSet(page, { on: true, w: W, color: BLUE, align: 'center' });
  await expect.poll(() => page.locator(content('tbS')).evaluate(el => el.dataset.strokeAlign)).toBe('center');
  const b = bands((await rowClasses(page, 'tbS')).cls, x0, dpr);
  expect(b.out).toBeGreaterThanOrEqual(W / 2 - 2); expect(b.out).toBeLessThanOrEqual(W / 2 + 2);
  expect(b.inn).toBeGreaterThanOrEqual(W / 2 - 2); expect(b.inn).toBeLessThanOrEqual(W / 2 + 2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S5 내부 — 바깥 0 · 안쪽 ≈W · 필터 정의 1개', async ({ page }) => {
  const errs = await boot(page);
  const { x0, dpr } = await baseline(page, 'tbS');
  await select(page, 'tbS');
  await panelSet(page, { on: true, w: W, color: BLUE, align: 'inside' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#gdsk-svg-defs filter').length)).toBe(1);
  expect(await page.locator(content('tbS')).evaluate(el => getComputedStyle(el).webkitTextStrokeWidth)).toBe('0px');
  const b = bands((await rowClasses(page, 'tbS')).cls, x0, dpr);
  expect(b.out).toBeLessThanOrEqual(1);
  expect(b.inn).toBeGreaterThanOrEqual(W - 2); expect(b.inn).toBeLessThanOrEqual(W + 2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S6 레거시를 패널에서 같은 값(외부·W)으로 다시 쓰면 픽셀이 같다', async ({ page }) => {
  const errs = await boot(page);
  const r0 = await rowClasses(page, 'tbL');
  expect(r0.cls.includes('B'), '전제: 레거시 외곽선이 보인다').toBe(true);
  await select(page, 'tbL');
  await panelSet(page, { w: W });
  await expect.poll(() => page.locator(content('tbL')).evaluate(el => el.dataset.strokeAlign)).toBe('outside');
  expect(await page.locator(content('tbL')).evaluate(el => el.style.getPropertyValue('-webkit-text-stroke-width'))).toBe(`${2 * W}px`);
  const r1 = await rowClasses(page, 'tbL');
  expect(r1.cls).toBe(r0.cls);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S7 재동기 — 정의를 지우고 스냅샷을 복원(undo·로드)해도 내부 띠가 돌아온다', async ({ page }) => {
  const errs = await boot(page);
  const { x0, dpr } = await baseline(page, 'tbS');
  await select(page, 'tbS');
  await panelSet(page, { on: true, w: W, color: BLUE, align: 'inside' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#gdsk-svg-defs filter').length)).toBe(1);
  await page.evaluate(() => {
    const host = document.getElementById('host');
    const saved = host.innerHTML;
    document.getElementById('gdsk-svg-defs').remove();
    host.innerHTML = '';
    host.innerHTML = saved;
  });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#gdsk-svg-defs filter').length)).toBe(1);
  const b = bands((await rowClasses(page, 'tbS')).cls, x0, dpr);
  expect(b.inn).toBeGreaterThanOrEqual(W - 2);
  expect(b.out).toBeLessThanOrEqual(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S8 그라데이션 글자 + 그림자(.tgs) + 내부 — 안쪽 띠 ∧ 그림자 둘 다 보인다', async ({ page }) => {
  const errs = await boot(page);
  const { x0, dpr } = await baseline(page, 'tbG');
  const r0 = await rowClasses(page, 'tbG');
  expect(r0.cls.includes('R'), '전제: 그림자가 보인다').toBe(true);
  await select(page, 'tbG');
  await panelSet(page, { on: true, w: W, color: BLUE, align: 'inside' });
  await expect.poll(() => page.locator(content('tbG')).evaluate(el => el.classList.contains('tgs'))).toBe(true);
  const filt = await page.locator(content('tbG')).evaluate(el => getComputedStyle(el).filter);
  expect(filt).toContain('gdsk-in-');
  const r1 = await rowClasses(page, 'tbG');
  const b = bands(r1.cls, x0, dpr);
  expect(b.inn).toBeGreaterThanOrEqual(W - 2);
  expect(b.out).toBeLessThanOrEqual(1);
  expect(r1.cls.includes('R'), '그림자가 사라졌다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
