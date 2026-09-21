/* bulk-align-section.dom.spec.js — 섹션 «Bulk Align» 이 글자«만» 움직이는가. (T-095)
 *
 * ★왜 DOM 이어야 하나
 *   이 결함은 dataset 으로는 «안 보인다». 옛 코드는 text-block 에 text-align 을 «정확히»
 *   찍었고, 그래서 모델만 보면 초록이다. 틀린 건 화면 좌표다 — 도형·이미지가 제자리였다.
 *   그 「제자리」는 «계산된 rect»에서만 나온다.
 *
 * ★음성대조 (dev 3f39b71 = 고치기 «전», 실앱 9545 실측)
 *   섹션 오른쪽 정렬 후 — text-align:right ✓ / shape L=152 R=152 «불변» / asset L=112 R=112 «불변»
 *   즉 D2·D3 가 빨강. 고친 뒤 실측 — shape R=29, asset R=29 (=좌우패딩 72px·줌 0.4).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(modal-icon-align.dom.spec.js 와 같은 부팅).
 * ⚠️tests/dom 은 `npm test` 스위트에 «안» 들어간다. 변이 책임은 tests/unit/bulk-align-targets.test.mjs 가 진다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js bulk-align-section
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 실앱이 만드는 골격 그대로 — section-inner(패딩 72) > [gap · 글자프레임(100%) · 도형프레임(100px) · row(100%)>이미지(300px)] */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>body{margin:0}#canvas{width:860px}.section-inner{padding:0 72px;width:860px;box-sizing:border-box}</style>
</head><body>
<div id="canvas-wrap"><div id="canvas">
  <div class="section-block" id="sec"><div class="section-inner">
    <div class="gap-block" style="height:20px"></div>
    <div class="frame-block" data-text-frame id="tf"><div class="text-block" id="tb"><div class="tb-h2" contenteditable="true">글자</div></div></div>
    <div class="frame-block" id="sf" style="width:100px;min-height:100px;align-self:center"><div class="shape-block" id="sb" style="width:100px;height:100px;background:#888"></div></div>
    <div class="row" data-layout="stack" id="rw"><div class="asset-block" id="ab" style="width:300px;height:80px;align-self:center;background:#ccc"></div></div>
  </div></div>
</div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script type="module">
  import { collectBulkAlignTargets } from '/js/props/bulk-align-targets.js';
  import { alignFlowBlock } from '/js/props/prop-multisel.js';
  window.__align = (dir) => {
    const sec = document.getElementById('sec');
    collectBulkAlignTargets(sec).forEach(el => alignFlowBlock(el, dir));
  };
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/** 섹션 «콘텐츠 상자» 기준 좌·우 여백(px). 여유가 있는 블록만 이 값이 움직인다. */
async function gaps(page, id) {
  return page.evaluate((bid) => {
    const inner = document.querySelector('.section-inner');
    const cs = getComputedStyle(inner);
    const ir = inner.getBoundingClientRect();
    const L = ir.left + parseFloat(cs.paddingLeft), R = ir.right - parseFloat(cs.paddingRight);
    const r = document.getElementById(bid).getBoundingClientRect();
    return { left: Math.round(r.left - L), right: Math.round(R - r.right) };
  }, id);
}

test.describe('T-095 섹션 Bulk Align', () => {
  test('D1 글자는 text-align 으로 움직인다(회귀 방어)', async ({ page }) => {
    await boot(page);
    for (const dir of ['right', 'center', 'left']) {
      await page.evaluate(d => window.__align(d), dir);
      const ta = await page.evaluate(() => getComputedStyle(document.querySelector('#tb [contenteditable]')).textAlign);
      expect(ta, `${dir} 에서 글자 정렬`).toBe(dir);
    }
  });

  test('D2 ★도형이 같이 움직인다 (옛 결함: 제자리)', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__align('right'));
    const r = await gaps(page, 'sf');
    expect(r.right, '오른쪽 정렬인데 도형이 오른끝에 안 붙었다').toBeLessThanOrEqual(1);
    expect(r.left, '오른쪽 정렬인데 도형 왼쪽 여백이 안 생겼다').toBeGreaterThan(100);

    await page.evaluate(() => window.__align('left'));
    const l = await gaps(page, 'sf');
    expect(l.left, '왼쪽 정렬인데 도형이 왼끝에 안 붙었다').toBeLessThanOrEqual(1);

    await page.evaluate(() => window.__align('center'));
    const c = await gaps(page, 'sf');
    expect(Math.abs(c.left - c.right), '가운데 정렬인데 도형 좌우가 안 맞는다').toBeLessThanOrEqual(1);
  });

  test('D3 ★이미지가 같이 움직인다 — 꽉 찬 row 를 지나 알맹이에 닿는다', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__align('right'));
    const r = await gaps(page, 'ab');
    expect(r.right, '오른쪽 정렬인데 이미지가 오른끝에 안 붙었다').toBeLessThanOrEqual(1);

    await page.evaluate(() => window.__align('left'));
    const l = await gaps(page, 'ab');
    expect(l.left, '왼쪽 정렬인데 이미지가 왼끝에 안 붙었다').toBeLessThanOrEqual(1);

    await page.evaluate(() => window.__align('center'));
    const c = await gaps(page, 'ab');
    expect(Math.abs(c.left - c.right), '가운데 정렬인데 이미지 좌우가 안 맞는다').toBeLessThanOrEqual(1);
  });

  test('D4 꽉 찬 래퍼(row)엔 align-self 를 안 찍는다 — 옮길 여지가 없는 자리', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => window.__align('right'));
    const rowAS = await page.evaluate(() => document.getElementById('rw').style.alignSelf);
    expect(rowAS, 'row 래퍼에 쓸모없는 align-self 가 찍혔다').toBe('');
  });
});
