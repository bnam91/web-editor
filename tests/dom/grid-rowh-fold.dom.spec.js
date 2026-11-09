/* grid-rowh-fold.dom.spec.js — t2-06(0.9.11_t2 · 현빈 「기본 상태를 접힘」): 그리드 패널 「행 높이」 를 접이식 절로.
 *   R1 4×4 기본 접힘(머리 보임 · 몸 숨김 · 칸 4개는 DOM 에 있음) · R2 머리 클릭 = 펼침 · R3 값 입력+Enter 커밋 · 다시 그려도 펼침 유지
 *   R4 다른 그리드 블록은 접힌 채 시작 · R5 1행이면 머리 없음 · R6 접힘/펼침의 컨트롤 수 같음(지운 게 아니라 접은 것)
 *   하네스는 tests/dom/grid-panel-fold.dom.spec.js 를 그대로 베꼈다. 클릭·입력은 page.mouse/keyboard(사람 손 길).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script>window.openIconifyModal = (cb) => cb({ svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', size: 64 });</script>
<script type="module">
  import { makeGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock; window.__model = getGridModel; window.__open = showGridProperties;
  window.__ready = true;
</script></body></html>`;

function installMount(page) {
  return page.addInitScript(() => {
    window.__mount = (fx, addr) => {
      const HOST = document.getElementById('host');
      HOST.innerHTML = ''; document.querySelector('#panel-right .panel-body').innerHTML = '';
      const { row, block } = window.__mk(JSON.parse(JSON.stringify(fx)));
      HOST.appendChild(row); block.classList.add('selected');
      window.__b = block; window.__open(block, addr);
      return block;
    };
  });
}

async function boot(page) {
  await installMount(page);
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.setViewportSize({ width: 1280, height: 900 });
  return errs;
}

const fx = (n) => ({
  cols: [0, 1, 2, 3].map(() => ({ width: 1, lines: [] })),
  rows: Array.from({ length: n }, () => ({ height: 'auto' })),
  cells: Array.from({ length: n }, (_, r) => [0, 1, 2, 3].map((c) => ({ lines: [{ type: 'body', text: `${r}${c}` }] }))),
});
const probe = (page) => page.evaluate(() => {
  const head = document.getElementById('grd-rowh-toggle');
  const body = document.getElementById('grd-rowh-body');
  const panel = document.querySelector('#panel-right .panel-body');
  return {
    headText: head ? head.textContent.trim() : null,
    headVisible: !!(head && head.getBoundingClientRect().height > 0),
    bodyDisplay: body ? getComputedStyle(body).display : null,
    itemN: document.querySelectorAll('#grd-rowh-body .grd-rowh-list .grd-rowh-item-row .grd-row-h-item').length,
    controlN: panel.querySelectorAll('input,select,textarea,button').length,
  };
});
const clickHead = async (page) => {
  const loc = page.locator('#grd-rowh-toggle');
  await loc.scrollIntoViewIfNeeded();
  const r = await loc.boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
};

test('R1 4×4 — 기본 접힘: 머리는 보이고 몸은 숨고, 행 높이 칸 4개는 DOM 에 있다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((f) => window.__mount(f, null), fx(4));
  const p = await probe(page);
  expect(errs).toEqual([]);
  expect(p.headText, '★「행 높이」 접이식 머리가 없다').toContain('행 높이 (4행)');
  expect(p.headVisible).toBe(true);
  expect(p.bodyDisplay, '★기본이 펼침이다 — 발주는 «기본 접힘»').toBe('none');
  expect(p.itemN, '★접었더니 칸이 DOM 에서 빠졌다').toBe(4);
});

test('R2 머리를 누르면 펼쳐지고, 다시 누르면 접힌다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((f) => window.__mount(f, null), fx(4));
  await clickHead(page);
  expect((await probe(page)).bodyDisplay).toBe('block');
  await expect(page.locator('.grd-row-h-item[data-ri="3"]')).toBeVisible();
  await clickHead(page);
  expect((await probe(page)).bodyDisplay).toBe('none');
  expect(errs).toEqual([]);
});

test('R3 펼쳐 값을 넣고 Enter → 그 행 높이가 커밋되고, 패널을 다시 그려도 펼침이 남는다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((f) => window.__mount(f, null), fx(4));
  await clickHead(page);
  const inp = page.locator('.grd-row-h-item[data-ri="1"]');
  const r = await inp.boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await page.keyboard.type('120');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.__b.dataset.rows)[1].height)).toBe(120);
  await page.evaluate(() => window.__open(window.__b, null));   // 패널 다시 그리기(블록 다시 고름과 같은 길)
  const p = await probe(page);
  expect(p.bodyDisplay, '★다시 그렸더니 접혔다 — 열림 상태가 블록에 안 붙었다').toBe('block');
  expect(await page.locator('.grd-row-h-item[data-ri="1"]').inputValue()).toBe('120');
  expect(errs).toEqual([]);
});

test('R4 한 블록에서 펼쳐도 다른 그리드 블록은 접힌 채 시작한다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((f) => { window.__mount(f, null); window.__b1 = window.__b; }, fx(4));
  await clickHead(page);
  expect((await probe(page)).bodyDisplay).toBe('block');
  const r = await page.evaluate((f) => {
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(f)));
    document.getElementById('host').appendChild(row);
    window.__open(block, null);
    const second = document.getElementById('grd-rowh-body').style.display;
    window.__open(window.__b1, null);
    return { second, firstAgain: document.getElementById('grd-rowh-body').style.display };
  }, fx(3));
  expect(r.second, '★다른 블록이 펼친 채 시작했다').toBe('none');
  expect(r.firstAgain, '★처음 블록의 펼침이 사라졌다').toBe('block');
  expect(errs).toEqual([]);
});

test('R5 1행 그리드는 「행 높이」 머리가 없다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((f) => window.__mount(f, null), fx(1));
  const p = await probe(page);
  expect(p.headText).toBe(null);
  expect(p.itemN).toBe(0);
  expect(errs).toEqual([]);
});

test('R6 접힘/펼침의 패널 컨트롤 수가 같다 — 지운 게 아니라 접은 것', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate((f) => window.__mount(f, null), fx(4));
  const folded = await probe(page);
  await clickHead(page);
  const open = await probe(page);
  console.log(`[R6] controlN folded ${folded.controlN} · open ${open.controlN} · rowh items ${folded.itemN}/${open.itemN}`);
  expect([folded.bodyDisplay, open.bodyDisplay]).toEqual(['none', 'block']);
  expect(open.controlN).toBe(folded.controlN);
  expect(open.itemN).toBe(folded.itemN);
  expect(errs).toEqual([]);
});
