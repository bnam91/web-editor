/* text-dot-grad-per-glyph — 점 켠 글자도 그라데이션을 «이어서» 탄다 (T4-02-DOT-TEXT-PER-GLYPH-GRADIENT-01)
 * 현빈 2026-11-10(Q-t4-02-DOT-TEXT-GRADIENT): 「PATENA」(tb_rwx4l_atr5nd1) 점 있는 글자도 글자별 그라데이션이 제대로 보이게 — 10-08 «한 색» 절충을 뒤집는다.
 *   ⚰️10-08: .tb-dot 이 positioned 라 부모 background-clip:text 밖 → 첫 스탑 단색(--tb-grad-fb)으로 칠했다.
 *   ★고침: .tb-dot 을 positioned 에서 빼고 점(::before)은 CSS 앵커로 제 글자에 붙인다(css/editor-layout.css .tb-dot).
 * 글자는 초록(#00aa55) → 파랑(#3300ff) 가로 그라데이션 · 점은 빨강(#ff0000)이라 그림에서 셋을 가른다.
 *   P1 ★글자별 그라데이션 — 점✓ 에서 왼쪽 반은 초록·오른쪽 반은 파랑(그라만 켠 판과 같은 갈림) · 기준판 빨강(전부 초록)
 *   P2 점 자리 — 점마다 제 글자 가운데 위(빨강 덩이 중심 x ↔ 글자 span 가운데 ±2px · 6개)
 *   P3 ★화면 = PNG — 앱 PNG 는 클론을 CDP 로 «스크린샷»한다(js/io/export-image.js prepareCloneForCapture · native 갈래).
 *      그 클론을 하네스 화면에 꺼내 찍어 초록·파랑·빨강 픽셀 수를 화면과 견준다(±10%) — fix5-blur-effects B8 과 같은 길
 *   P4 [대조] 그라데이션 없음 — 점 글자 채움 = 글자색(무접촉)
 * ⛔못 재는 것: Electron 의 진짜 captureBeyondViewport 바이트(하네스엔 그 문이 없다) · html2canvas 갈래(웹 — 글자 그라데이션 전체가 원래 단색, 무변).
 * ★양성대조: css/editor-layout.css 의 .tb-dot 을 옛 꼴(position:relative + -webkit-text-fill-color:var(--tb-grad-fb,currentColor))로 되돌리고
 *   js/props/text-block-color.js 의 --tb-grad-fb 쓰기를 되살리면 P1 빨강(오른쪽 파랑 0).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff;padding:80px 0 0 80px"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const GRAD = 'linear-gradient(90deg, #00aa55 0%, #3300ff 100%)';
const WORD = 'PATENA';

async function setup(page, { grad = true } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  const id = await page.evaluate((w) => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    window.addTextBlock('h1', { content: w });
    const f = [...document.querySelectorAll('#canvas .text-block')].filter(e => !before.has(e.id));
    return f.length ? f[f.length - 1].id : null;
  }, WORD);
  await page.evaluate((i) => window.showTextProperties(document.getElementById(i)), id);
  await page.waitForSelector('#txt-dot-btn', { state: 'attached' });
  if (grad) await page.evaluate(([i, g]) => window.applyTextGradient(document.getElementById(i), { css: g }, { commit: true }), [id, GRAD]);
  return { errs, id };
}
const dotOn = async (page, id) => {
  await page.evaluate((i) => window.showTextProperties(document.getElementById(i)), id);
  const b = await page.locator('#txt-dot-btn').first().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(([i, n]) => document.getElementById(i).querySelectorAll('span.tb-dot').length === n, [id, WORD.length]);
  /* 점을 빨강·10px 로 — 글자 픽셀(초록·파랑)과 안 섞이게 */
  await page.evaluate((i) => { const tb = document.getElementById(i); tb.style.setProperty('--tb-dot-color', '#ff0000'); tb.style.setProperty('--tb-dot-size', '10px'); }, id);
};
const clean = (page) => page.evaluate(() => { document.querySelectorAll('#canvas .selected, #canvas .editing').forEach(e => e.classList.remove('selected', 'editing')); });

/* 상자(sel) 를 찍고 초록·파랑·빨강 픽셀을 센다 · 왼/오른 반 · 빨강 열 덩이 중심 */
async function stats(page, sel) {
  const el = await page.$(sel);
  const box = await el.boundingBox();
  const b64 = (await el.screenshot()).toString('base64');
  return page.evaluate(async ([s, bx]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode();
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const k = c.width / bx.width;
    let green = 0, blue = 0, red = 0, gL = 0, gR = 0, bL = 0, bR = 0, minX = c.width, maxX = -1;
    const redCols = new Array(c.width).fill(0);
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      const i = (y * c.width + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 200 && g < 70 && b < 70) { red++; redCols[xx]++; continue; }
      const isG = g > b + 40 && g > r + 40, isB = b > g + 40 && b > r + 40;
      if (isG || isB) { minX = Math.min(minX, xx); maxX = Math.max(maxX, xx); }
      if (isG) green++; if (isB) blue++;
    }
    const mid = (minX + maxX) / 2;
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      const i = (y * c.width + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      if (g > b + 40 && g > r + 40) (xx < mid ? gL++ : gR++);
      if (b > g + 40 && b > r + 40) (xx < mid ? bL++ : bR++);
    }
    const blobs = []; let st = -1, sum = 0, wsum = 0;
    for (let xx = 0; xx <= c.width; xx++) {
      const v = xx < c.width ? redCols[xx] : 0;
      if (v > 0) { if (st < 0) st = xx; sum += v; wsum += v * xx; }
      else if (st >= 0) { blobs.push(+(wsum / sum / k + bx.x).toFixed(1)); st = -1; sum = 0; wsum = 0; }
    }
    return { green, blue, red, gL, gR, bL, bR, blobs };
  }, [b64, box]);
}

test('P1 ★점 켠 글자도 그라데이션이 이어진다 — 왼쪽 초록 · 오른쪽 파랑(그라만 켠 판과 같은 갈림)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const sel = '#canvas #sA';   /* ★섹션째 — 점은 글자 상자 «위»에 그려져 글자 상자만 찍으면 잘린다 */
  await clean(page);
  const only = await stats(page, sel);
  expect(only.blue, `★전제 — 그라만 켠 판에 파랑이 없다(그라데이션이 안 걸렸다) ${JSON.stringify(only)}`).toBeGreaterThan(200);
  expect(only.bR / only.blue, '★전제 — 그라만 켠 판의 파랑이 오른쪽에 몰려 있지 않다').toBeGreaterThan(0.7);
  await dotOn(page, id);
  await clean(page);
  const dot = await stats(page, sel);
  console.log(`  P1 gradOnly=${JSON.stringify(only)} gradDot=${JSON.stringify(dot)}`);
  expect(dot.blue / only.blue, `★★점 켠 글자에 파랑이 없다 — 첫 스탑 단색(10-08 절충)으로 칠해졌다 ${dot.blue}/${only.blue}`).toBeGreaterThan(0.8);
  expect(dot.green / only.green, `점 켠 글자의 초록이 줄었다 ${dot.green}/${only.green}`).toBeGreaterThan(0.8);
  expect(dot.bR / dot.blue, '★파랑이 오른쪽에 몰려야 한다 — 글자마다 램프가 다시 시작하면 반반이 된다').toBeGreaterThan(0.7);
  expect(dot.gL / dot.green, '★초록이 왼쪽에 몰려야 한다').toBeGreaterThan(0.7);
  expect(dot.red, '★전제 — 점(빨강)이 안 그려졌다').toBeGreaterThan(50);
  expect(errs).toEqual([]);
});

test('P2 점 자리 — 점마다 제 글자 가운데 위 (6개)', async ({ page }) => {
  const { id } = await setup(page);
  await dotOn(page, id);
  await clean(page);
  const centers = await page.evaluate((i) => [...document.getElementById(i).querySelectorAll('span.tb-dot')]
    .map(s => { const r = s.getBoundingClientRect(); return +(r.left + r.width / 2).toFixed(1); }), id);
  const st = await stats(page, '#canvas #sA');
  console.log(`  P2 centers=${JSON.stringify(centers)} blobs=${JSON.stringify(st.blobs)}`);
  expect(st.blobs.length, `★점 덩이가 ${WORD.length}개가 아니다 — 앵커가 안 잡혀 한 자리에 몰렸나`).toBe(WORD.length);
  st.blobs.forEach((bx, k) => expect(Math.abs(bx - centers[k]), `점 ${k} 중심 ${bx} ↔ 글자 가운데 ${centers[k]}`).toBeLessThanOrEqual(2));
});

test('P3 ★화면 = PNG(네이티브 클론) — 초록·파랑·빨강 픽셀이 같다', async ({ page }) => {
  const { id } = await setup(page);
  await dotOn(page, id);
  await clean(page);
  const screen = await stats(page, '#canvas #sA');
  await page.evaluate(async (i) => {
    const X = await import('/js/io/export-image.js');
    const sec = document.getElementById(i).closest('.section-block');
    const clone = await X.prepareCloneForCapture(sec, sec.offsetWidth, true);
    clone.dataset.tClone = '1';
    clone.style.top = '0px'; clone.style.zIndex = '2147483000';
  }, id);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const png = await stats(page, '[data-t-clone="1"]');
  console.log(`  P3 screen=${JSON.stringify(screen)} png=${JSON.stringify(png)}`);
  for (const k of ['green', 'blue', 'red']) {
    expect(Math.abs(png[k] - screen[k]) / Math.max(1, screen[k]), `★PNG 클론의 ${k} ${png[k]} ↔ 화면 ${screen[k]}`).toBeLessThanOrEqual(0.1);
  }
  expect(png.blue, '★PNG 클론에 파랑이 없다 — 내보내기에서 단색이 됐다').toBeGreaterThan(200);
});

test('P4 [대조] 그라데이션 없음 — 점 글자 채움 = 글자색 · 점은 그대로', async ({ page }) => {
  const { id } = await setup(page, { grad: false });
  await dotOn(page, id);
  const v = await page.evaluate((i) => { const sp = document.getElementById(i).querySelector('span.tb-dot'); const cs = getComputedStyle(sp);
    return { fill: cs.webkitTextFillColor, color: cs.color, pos: cs.position, anchor: cs.anchorName }; }, id);
  expect(v.fill).toBe(v.color);
  expect(v.pos, '★점 span 이 positioned 면 부모 그라데이션 밖으로 나간다').toBe('static');
  expect(v.anchor).toBe('--tb-dot');
});
