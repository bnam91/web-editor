/* grid-panel-0912.dom.spec.js — 0.9.12 t2-01·t2-02·t2-05 (그리드 우측 패널 «간격·안내문») 를 재는 자리.
 * 하네스(boot·installMount·FIX)는 grid-panel-r1r6.dom.spec.js 를 그대로 베꼈다 — 앱 «안» 띄움, 레포 파일만 크로미움에 얹는다.
 * ★합격선은 매직넘버가 아니다 — «같은 패널 안의 표준 자리»를 같이 재서 견준다(.prop-row margin · .prop-section-title padding-top).
 * 양성대조: 각 test 머리의 «되돌리면 빨개지는 것» 한 줄만 되돌리면 그 test 가 빨개진다.
 * 실행: … playwright.dom.config.js grid-panel-0912
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

/* 갈래를 전부 담는다 — 글자 줄 여럿 · 이미지 줄 · 갭 줄 · 「정렬 오버라이드가 걸린 칸」. */
const IMG_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const FIX = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: 'A0' }, { type: 'h2', text: 'A1' }] }, { lines: [{ type: 'body', text: 'B0' }] }],
    [{ lines: [{ type: 'body', text: 'C0' }, { type: 'image', imgSrc: IMG_SRC, height: 40 }, { type: 'gap', height: 20 }] },
     { lines: [{ type: 'body', text: 'D0' }] }],
  ],
};
const A_TEXT = { r: 0, c: 0, li: 1 };
const A_IMG  = { r: 1, c: 0, li: 1 };
const A_GAP  = { r: 1, c: 0, li: 2 };

/** 블록을 새로 심고 패널을 연다 — 매번 새로(앞 조작이 다음에 새지 않게).
 *  ⛔page.evaluate 에 «문자열»을 넘기지 마라 — 그건 표현식으로 평가되고 두 번째 인자(arg)가
 *    통째로 무시된다(첫 판이 그래서 여섯 건 전부 undefined 를 돌려받았다). 진짜 함수를 넘긴다. */
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

/* ── t2-01 ── 구분선 줄의 「선 색」↔「줄 정렬」 세로 간격이 다른 행 사이 간격과 같다.
 * 되돌리면 빨개지는 것: prop-grid.js 「선 색」 prop-row 에 style="margin-bottom:0;" 을 다시 붙이면(간격 0 ≠ 6). */
test('t2-01 구분선 줄 — 선 색·줄 정렬 간격 = 굵기·너비 간격(표준 .prop-row)', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(() => {
    const fx = { cols: [{ width: 1, lines: [] }], rows: [{ height: 'auto' }],
      cells: [[{ lines: [{ type: 'h2', text: '제목' }, { type: 'divider' }, { type: 'body', text: '본문' }] }]] };
    window.__mount(fx, { r: 0, c: 0, li: 1 });
    const row = (id) => document.getElementById(id)?.closest('.prop-row')?.getBoundingClientRect() || null;
    const h = row('grd-divider-h'), w = row('grd-divider-w'), color = row('grd-divider-color'), align = row('grd-line-align');
    return { ok: !!(h && w && color && align), std: w && h ? Math.round(w.top - h.bottom) : null,
      gap: color && align ? Math.round(align.top - color.bottom) : null };
  });
  expect(errs).toEqual([]);
  expect(got.ok, '전제 — 굵기·너비·선 색·줄 정렬 네 행이 다 떴다').toBe(true);
  expect(got.std, '전제 — 표준 행 간격이 0 이 아니다(자가 0=0 초록 금지)').toBeGreaterThan(0);
  expect(got.gap, `선 색→줄 정렬 간격 ${got.gap}px ≠ 표준 ${got.std}px`).toBe(got.std);
});

/* ── t2-02 ── 「＋ 블럭 넣기」 절: 위 구분선(절 border-top) → 드롭다운 행 사이 여백 = 제목 있는 절의 구분선 → 제목 여백.
 * 되돌리면 빨개지는 것: #grd-kids-section 의 padding-top 을 빼면(0 ≠ 8). */
test('t2-02 블럭 넣기 드롭다운 — 위 구분선과의 여백 = 다른 절(.prop-section-title)과 같다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate((fx) => {
    window.__mount(fx, null);                       // 블럭 단위 선택 — 이 절이 뜨는 상태
    const sec = document.getElementById('grd-kids-section');
    const sel = document.getElementById('grd-kid-add-kind');
    const t = document.querySelector('#panel-right .panel-body .prop-section + .prop-section > .prop-section-title');
    if (!sec || !sel || !t) return { ok: false };
    const titled = t.parentElement.getBoundingClientRect().top;
    return { ok: true, border: getComputedStyle(sec).borderTopWidth,
      std: Math.round(t.getBoundingClientRect().top + parseFloat(getComputedStyle(t).paddingTop) - titled),
      gap: Math.round(sel.closest('.prop-row').getBoundingClientRect().top - sec.getBoundingClientRect().top) };
  }, FIX);
  expect(errs).toEqual([]);
  expect(got.ok, '전제 — 블럭 넣기 절·드롭다운·비교할 제목 절이 다 떴다').toBe(true);
  expect(got.border, '전제 — 블럭 넣기 절 위에 구분선이 있다').toBe('1px');
  expect(got.std, '전제 — 표준 여백이 0 이 아니다').toBeGreaterThan(0);
  expect(got.gap, `구분선→드롭다운 ${got.gap}px ≠ 표준 ${got.std}px`).toBe(got.std);
});

/* ── t2-05 ── 그리드 패널의 안내 3개가 어느 상태에서도 안 뜨고, 그 자리에 «빈 절»(여백만 남은 .prop-section)도 안 남는다.
 *   ★기능 유지 — 블럭 단위 선택에서 「＋ 블럭 넣기」·정렬 단추, 글자 줄 선택에서 Typography 크기 칸이 그대로 뜬다.
 * 되돌리면 빨개지는 것: prop-grid.js 의 세 문구 중 하나를 되살리면(문구 단언) ·
 *   그리드 noHitHint 만 '' 로 두고 _grdLineBarHtml 의 `H.noHitHint &&` 를 빼면(빈 절 단언). */
const T205 = /칸·줄에 따로 준 정렬은 지워진다|글자 줄을 고르면 여기 뜬다|칸을 한 번 더 누르면 줄 편집/;
test('t2-05 안내 3개 제거 — 문구 0 · 빈 절 0 · 손잡이는 그대로', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate((fx) => {
    const dirty = JSON.parse(JSON.stringify(fx));
    dirty.cells[1][1].align = 'center';              // 옛 「따로 준 정렬」 예고가 뜨던 조건
    dirty.cells[1][0].lines[0].align = 'right';
    const body = () => document.querySelector('#panel-right .panel-body');
    const R = {};
    for (const [name, f, addr] of [['block', fx, null], ['blockDirty', dirty, null], ['text', fx, { r: 0, c: 0, li: 1 }],
                                    ['image', fx, { r: 1, c: 0, li: 1 }], ['gap', fx, { r: 1, c: 0, li: 2 }], ['dirtyText', dirty, { r: 0, c: 0, li: 1 }]]) {
      window.__mount(f, addr);
      R[name] = {
        hints: [...body().querySelectorAll('.prop-hint')].map(e => e.textContent.trim()),
        empty: [...body().querySelectorAll('.prop-section')].filter(s => !s.children.length).length,
        has: ['grd-kid-add-kind', 'grd-valign-group', 'grd-typo-size-number'].filter(id => document.getElementById(id)),
      };
    }
    return R;
  }, FIX);
  expect(errs).toEqual([]);
  for (const [state, r] of Object.entries(got)) {
    expect(r.hints.filter(t => T205.test(t)), `«${state}» 지운 안내가 떴다`).toEqual([]);
    expect(r.empty, `«${state}» 안내만 빠지고 빈 절(여백)이 남았다`).toBe(0);
  }
  expect(got.block.has, '블럭 선택 — 블럭 넣기·세로 정렬 손잡이는 그대로').toEqual(expect.arrayContaining(['grd-kid-add-kind', 'grd-valign-group']));
  expect(got.text.has, '글자 줄 선택 — Typography 크기 칸은 그대로').toContain('grd-typo-size-number');
});
