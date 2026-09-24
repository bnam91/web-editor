/* grid-panel-r1r6.dom.spec.js — 우측 그리드 패널의 «작은 고침 여섯»(R1~R6)이 재어지는 자리.
 * (2026-09-25 · 기준선 4e85266)
 *
 * ★왜 새로 세우나 — 고친 여섯 자리 중 «기존 그물이 재고 있던 것이 0개»였다.
 *   실측(2026-09-25): 여섯을 전부 되돌려도 unit 3190 · DOM 1233 이 «그대로 초록»이다.
 *   grid-cell-panel-handles G2 는 «높이/폭»을, grid-typo D1-b·D5 는 «타이포 값»을 재고,
 *   「안내문이 읽히나」·「요약이 맞는 말을 하나」·「손잡이가 있나(줄 필드 축)」를 재는 자는 없었다.
 *   ⇒ 고치면서 그 자리를 같이 잰다. ⛔이 파일 없이 낸 「고쳤더니 초록」은 판정이 아니다.
 *
 * ★재는 «양» — 여섯 각각 «하나씩». 각 test 머리에 「무엇을 깨뜨리면 빨개지나」를 적어 둔다.
 *   R1 안내문이 56px 고정 라벨에 갇혀 «반도 못 읽히는» 것이 없다
 *   R2 「모든 칸에 걸리는」 테두리 절이 «범위를 말하는 제목»을 갖는다
 *   R3 정렬 단추가 지울 것이 «있을 때만» 예고하고, ★그 예고가 데이터를 안 지운다
 *   R4 글자 아닌 줄의 요약이 «타이포 수»를 세지 않는다 — 두 경로(첫 렌더·제자리 갱신) 모두
 *   R5 「캔버스를 클릭하라」 계열 지시가 어느 상태에서도 «한 줄 이하»다
 *   R6 이미지 줄 폭(%) 손잡이가 있고, 값이 모델·화면에 실제로 닿는다
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   하네스 골격은 tests/dom/grid-cell-panel-handles.dom.spec.js 를 그대로 베꼈다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-panel-r1r6
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

/* ── R1 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: 안내 «문장»을 `.prop-label`(css/editor-props.css:24 · width:56px
 *   overflow:hidden) 안에 넣는 순간. 실측(고치기 전) 「글자는 «캔버스에서 줄을 더블클릭»해
 *   고친다」= 필요폭 193px / 가진 폭 56px ⇒ 약 29%만 읽혔다.
 * ★합격선을 «2배»로 잡은 까닭 — 라벨은 원래 말줄임으로 조금 흘리는 자리다(「모서리 반경(px)」
 *   70/56 = 1.25배가 기준선에 이미 있다). 「가진 폭의 두 배가 넘게 필요하다」= 반도 못 읽는다
 *   = 그건 더 이상 «라벨»이 아니라 «문장»이고, `.prop-label--auto` 나 `.prop-hint` 로 가야 한다. */
test('R1 ★56px 고정 라벨에 «반도 못 읽히는» 말이 갇혀 있지 않다 (전 상태)', async ({ page }) => {
  const errs = await boot(page);
  const bad = await page.evaluate((fx) => {
    const mount = window.__mount;
    const out = [];
    for (const addr of [null, { r: 0, c: 0, li: 1 }, { r: 1, c: 0, li: 1 }, { r: 1, c: 0, li: 2 }]) {
      mount(fx, addr);
      for (const el of document.querySelectorAll('#panel-right .panel-body .prop-label')) {
        const need = el.scrollWidth, have = el.clientWidth;
        if (have > 0 && need > have * 2) out.push({ addr: JSON.stringify(addr), text: el.textContent.trim(), need, have });
      }
    }
    return out;
  }, FIX);
  expect(errs).toEqual([]);
  expect(bad, '★고정폭 라벨(56px) 안에 «반도 안 읽히는» 말이 들어 있다 — ' +
    'css/editor-props.css 의 .prop-label--auto 나 .prop-hint 로 옮겨라').toEqual([]);
});

/* ── R2 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: _borderSectionHtml 에서 .prop-section-title 을 지우면.
 * 왜 재나 — 그 슬라이더는 «블록의 모든 칸»에 걸리는데, 바로 아래 「칸 꾸미기 · N행 M열」 절은
 *   「이 칸에만 적용된다」고 적혀 있다. 둘 다 「칸…」으로 시작해 같은 축으로 읽혔다.
 *   ⇒ 이 절은 «범위를 말하는 제목»을 가져야 한다. */
test('R2 ★칸 테두리 절이 «범위(모든 칸)»를 말하는 제목을 갖는다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate((fx) => {
    const mount = window.__mount;
    mount(fx, { r: 0, c: 0, li: 1 });
    const sec = document.getElementById('grd-border-w-slider')?.closest('.prop-section');
    const cellSec = document.getElementById('grd-cell-toggle')?.closest('.prop-section');
    return {
      hasSection: !!sec,
      title: sec?.querySelector('.prop-section-title')?.textContent.trim() ?? null,
      cellTitle: cellSec?.querySelector('.prop-disclosure-title, .prop-section-title')?.textContent.trim() ?? null,
    };
  }, FIX);
  expect(errs).toEqual([]);
  expect(got.hasSection, '★칸 테두리 슬라이더(#grd-border-w-slider)가 절 안에 없다 — 자가 눈이 멀었다').toBe(true);
  expect(got.title, '★테두리 절에 제목이 없다 — 「모든 칸에 걸린다」가 화면에 한 글자도 없으면 ' +
    '바로 아래 「이 칸에만 적용된다」와 같은 축으로 읽힌다').not.toBeNull();
  expect(got.title, `★테두리 절 제목이 «범위»를 말하지 않는다 (지금: ${got.title})`).toMatch(/모든/);
});

/* ── R3 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것 ⑴ 예고 문장을 지우면 · ⑵ «늘» 띄우면(조건을 지우면)
 *   · ⑶ ★판정을 «부작용 있는» _grdStripCellOverride(block, field) 로 하면 — 그리기만 해도
 *     데이터가 지워져 마지막 단언이 빨개진다.
 * 사실 — Layout 의 가로/세로 정렬 단추는 «열을 단일 진실원으로» 만들려고 칸·줄 정렬을 전부
 *   걷는다(설계 그대로 둔다). 고치기 전엔 같은 화면 안내문 9줄 중 이를 예고하는 문장이 0줄이었다. */
test('R3 ★정렬 단추의 파괴를 «지울 게 있을 때만» 예고하고, 그 예고가 데이터를 안 지운다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate((fx) => {
    const mount = window.__mount;
    const hints = () => [...document.querySelectorAll('#panel-right .panel-body .prop-hint')]
      .map(e => e.textContent.trim()).filter(t => /정렬은 지워진다|따로 준 정렬/.test(t));

    mount(fx, { r: 0, c: 0, li: 1 });
    const clean = hints();

    const dirty = JSON.parse(JSON.stringify(fx));
    dirty.cells[1][1].align = 'center';            // 칸 오버라이드 «하나»
    const b = mount(dirty, { r: 0, c: 0, li: 1 });
    const warned = hints();
    const kept1 = window.__model(b).cells[1][1].align ?? null;
    window.__open(b, { r: 0, c: 0, li: 1 });       // 같은 패널을 두 번 더 그려도
    window.__open(b, { r: 0, c: 0, li: 1 });
    const kept3 = window.__model(b).cells[1][1].align ?? null;

    const lineDirty = JSON.parse(JSON.stringify(fx));
    lineDirty.cells[1][0].lines[0].align = 'right';   // «줄» 오버라이드만 있어도
    mount(lineDirty, { r: 0, c: 0, li: 1 });
    const warnedByLine = hints();
    return { clean, warned, kept1, kept3, warnedByLine };
  }, FIX);
  expect(errs).toEqual([]);
  expect(got.clean, '★지울 것이 하나도 없는데 예고가 떴다 — 늘 띄우면 그게 또 소음이 된다').toEqual([]);
  expect(got.warned.length, '★칸에 정렬 오버라이드가 «있는데» 예고가 0줄이다 — ' +
    '정렬 단추 한 번에 말없이 지워진다').toBe(1);
  expect(got.warnedByLine.length, '★«줄» 정렬 오버라이드만 있을 때 예고가 안 뜬다 — ' +
    '그것도 같이 지워지는 대상이다').toBe(1);
  expect(got.kept1, '★★예고를 «그리는» 것만으로 칸의 정렬이 지워졌다 — ' +
    '판정을 부작용 있는 호출로 했다(dryRun 을 빼먹었다)').toBe('center');
  expect(got.kept3, '★패널을 세 번 그렸더니 정렬이 사라졌다 — 같은 병, 더 늦게 드러나는 얼굴').toBe('center');
});

/* ── R4 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: _grdSummaryText 의 gridLineHasText 갈래를 지우면 — ★두 경로 모두.
 *   «첫 렌더»(_grdLineBarHtml)만 고치고 «제자리 갱신»(_grdRefreshSummary)을 놔두면 아래
 *   ⑵ 가 빨개진다(타이포를 한 번 만지면 옛 문구가 돌아온다).
 * 사실 — 이미지 줄엔 타이포 필드가 뜻이 없다(옆 [↺ 기본] 단추도 그래서 disabled 다). */
test('R4 ★글자 아닌 줄의 요약이 «타이포 수»를 세지 않는다 — 첫 렌더·제자리 갱신 둘 다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate((fx) => {
    const mount = window.__mount;
    const sum = () => document.getElementById('grd-line-summary')?.textContent.trim() ?? null;
    const R = {};
    mount(fx, { r: 0, c: 0, li: 1 }); R.text = sum();
    mount(fx, { r: 1, c: 0, li: 1 }); R.image = sum();
    R.imageResetDisabled = document.getElementById('grd-line-reset')?.disabled ?? null;
    mount(fx, { r: 1, c: 0, li: 2 }); R.gap = sum();

    return R;
  }, FIX);
  expect(errs).toEqual([]);
  expect(got.text, '★글자 줄의 요약이 바뀌었다 — 이 고침은 «글자 아닌 줄»만 건드린다').toMatch(/직접 지정 \d+ · 역할 기본 \d+/);
  expect(got.imageResetDisabled, '★[↺ 기본]이 이미지 줄에서 안 꺼져 있다 — 자가 보는 전제가 무너졌다').toBe(true);
  expect(got.image, `★이미지 줄 요약이 타이포 수를 센다 (${got.image})`).not.toMatch(/직접 지정|역할 기본/);
  expect(got.gap, `★갭 줄 요약이 타이포 수를 센다 (${got.gap})`).not.toMatch(/직접 지정|역할 기본/);
  expect(got.image, '★이미지 줄이라는 말이 요약에 없다').toMatch(/그림 줄/);
  expect(got.gap, '★갭 줄이라는 말이 요약에 없다').toMatch(/여백 줄/);
  /* ⚠️«제자리 갱신»(_grdRefreshSummary)은 모듈 밖에서 못 부른다 — export 가 아니다.
     ⛔그래서 여기서 그것을 «부른 척»하지 않는다(안 재고 초록인 문장은 검사가 아니다).
       그 경로는 아래 R4-src 가 «문구 조립 자리가 하나인가»로 대신 못박는다. */
});

test('R4-src ★요약 문구가 «한 곳»에서만 온다 (두 벌이면 새로고침 때 옛 문구가 돌아온다)', () => {
  const src = fs.readFileSync(path.join(REPO, 'js/props/prop-grid.js'), 'utf8');
  /* 「직접 지정 … 역할 기본」 템플릿 리터럴이 «몇 군데»서 조립되나.
     고치기 전엔 둘이었다 — _grdLineBarHtml 과 _grdRefreshSummary. */
  const n = (src.match(/직접 지정 \$\{/g) || []).length;
  expect(n, `★요약 문구를 조립하는 자리가 ${n}곳이다 — 한 곳(_grdSummaryText)이어야 한다. ` +
    '두 벌이면 한쪽만 고쳐도 검사가 초록이고, 타이포를 만지는 순간 옛 문구가 돌아온다').toBe(1);
  expect(/function _grdSummaryText\(/.test(src), '★_grdSummaryText 가 없다').toBe(true);
  /* 제자리 갱신이 그 한 곳을 «실제로» 쓰나 — 이름만 있고 안 쓰면 두 벌과 같다. */
  const refresh = src.slice(src.indexOf('function _grdRefreshSummary('));
  expect(/_grdSummaryText\(/.test(refresh.slice(0, 600)),
    '★_grdRefreshSummary 가 _grdSummaryText 를 안 쓴다 — 제자리 갱신에서 옛 문구가 돌아온다').toBe(true);
});

/* ── R5 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: 「캔버스를 클릭/더블클릭하라」 문장을 한 상태에 두 줄 이상 두면.
 * 고치기 전 실측 — 블록만 선택한 상태에서 «세 줄»이 서로를 모른 채 같은 말을 했다:
 *   ⑴ _grdLineBarHtml 의 !anyHit ⑵ _grdTypoSectionsHtml 의 !hit ⑶ 패널 맨 끝 절. */
test('R5 ★「캔버스를 눌러라」 지시가 어느 상태에서도 «한 줄 이하»다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate((fx) => {
    const mount = window.__mount;
    /* «지시»만 센다 — 「…하면 …된다」 꼴로 캔버스 조작을 시키는 문장.
       상태를 알리는 말(「글자 줄을 고르면 여기 뜬다」)은 지시가 아니다. */
    const count = () => [...document.querySelectorAll('#panel-right .panel-body .prop-hint, #panel-right .panel-body .prop-label')]
      .map(e => e.textContent.trim())
      .filter(t => /(클릭|누르면|더블클릭)/.test(t) && /(칸|줄|글자|캔버스)/.test(t));
    const R = {};
    for (const [name, addr] of [['blockOnly', null], ['textLine', { r: 0, c: 0, li: 1 }],
                                ['imageLine', { r: 1, c: 0, li: 1 }], ['gapLine', { r: 1, c: 0, li: 2 }]]) {
      mount(fx, addr); R[name] = count();
    }
    return R;
  }, FIX);
  expect(errs).toEqual([]);
  for (const [state, lines] of Object.entries(got)) {
    expect(lines.length, `★«${state}» 상태에서 같은 지시가 ${lines.length}줄이다 — 한 자리에 모아라.\n` +
      lines.map(t => '     · ' + t).join('\n')).toBeLessThanOrEqual(1);
  }
  expect(got.blockOnly.length, '★칸/줄을 아직 안 고른 상태에 «어떻게 고르는지»가 한 줄도 없다 — ' +
    '합치다가 통째로 잃었다').toBe(1);
});

/* ── R6 ────────────────────────────────────────────────────────────────────
 * 깨뜨리면 빨개지는 것: _grdImageSectionHtml 의 폭(%) 칸이나 그 numWire 한 줄을 지우면.
 * 사실 — `widthPct` 는 모델(grid-block.js GRID_LINE_FIELDS)·렌더러(_gridLineHtml)가 «이미»
 *   읽는데 패널에 그 값을 주는 손잡이가 0개였다. 캔버스 코너 드래그가 유일한 경로였고,
 *   그래서 「그림이 칸 안에서 안 움직인다」(폭 100%면 렌더러의 wp<100 가드로 정렬이 죽는다)를
 *   패널에서 풀 길이 없었다.
 * ⛔저장 포맷은 안 바뀐다 — 새 필드가 아니라 «이미 명부에 있는 이름»이다. */
test('R6 ★이미지 줄 폭(%) 손잡이가 있고, 그 값이 모델·화면에 실제로 닿는다', async ({ page }) => {
  const errs = await boot(page);
  const got = await page.evaluate(async (fx) => {
    const mount = window.__mount;
    const b = mount(fx, { r: 1, c: 0, li: 1 });
    const el = document.getElementById('grd-img-width-pct');
    if (!el) return { field: false };
    const imgEl = () => window.__b.querySelector('[data-r="1"][data-c="0"][data-line="1"]');
    const R = {
      field: true, min: el.min, max: el.max, placeholder: el.placeholder,
      beforeModel: window.__model(b).cells[1][0].lines[1].widthPct ?? null,
      beforeCss: imgEl()?.style.width ?? null,
    };
    el.value = '40'; el.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    R.afterModel = window.__model(window.__b).cells[1][0].lines[1].widthPct ?? null;
    R.afterCss = imgEl()?.style.width ?? null;

    // 하한 클램프 — 칸의 min 속성(숫자칸 규약의 정본)과 핸들러가 같은 수를 쓴다
    const b2 = mount(fx, { r: 1, c: 0, li: 1 });
    const el2 = document.getElementById('grd-img-width-pct');
    el2.value = '1'; el2.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
    R.clampLow = window.__model(window.__b).cells[1][0].lines[1].widthPct ?? null;
    void b2;

    // 글자 줄엔 이 칸이 없다(Image 절 자체가 안 뜬다)
    mount(fx, { r: 0, c: 0, li: 1 });
    R.onTextLine = !!document.getElementById('grd-img-width-pct');
    return R;
  }, FIX);
  expect(errs).toEqual([]);
  expect(got.field, '★이미지 줄에 폭(%) 손잡이가 없다 — widthPct 는 모델·렌더러가 읽는데 ' +
    '패널엔 그 값을 줄 데가 0개다(캔버스 코너 드래그가 유일한 경로)').toBe(true);
  expect(got.beforeCss, '★전제 — 폭을 안 준 그림은 100%로 그려진다').toBe('100%');
  expect(got.afterModel, '★폭(%)에 40 을 넣었는데 모델에 안 닿았다').toBe(40);
  expect(got.afterCss, '★폭(%)에 40 을 넣었는데 화면이 안 따라왔다').toBe('40%');
  expect(got.onTextLine, '★글자 줄에도 폭(%)이 떴다 — Image 절은 이미지 줄에만 뜬다').toBe(false);
  expect(got.clampLow, '★하한 아래 값이 그대로 들어갔다').toBe(Number(got.min));
  expect(got.max, '★상한이 100 이 아니다').toBe('100');
  expect(got.placeholder, '★placeholder 가 «역할 기본값»(100)이 아니다 — 빈 칸의 뜻이 화면에 없으면 ' +
    '숫자칸 가드가 빈 값을 «지우는 중»으로 보고 커밋을 막는다').toBe('100');
});

test('R6-src ★폭(%)의 하한이 «캔버스 드래그와 같은 상수»에서 온다 (손으로 적은 5 가 아니다)', () => {
  const src = fs.readFileSync(path.join(REPO, 'js/props/prop-grid.js'), 'utf8');
  expect(/import\s*\{[^}]*IMG_MIN_PCT[^}]*\}\s*from\s*'\.\.\/grid-cell-resize\.js'/.test(src),
    '★IMG_MIN_PCT 를 js/grid-cell-resize.js 에서 안 가져온다 — 손으로 적은 수는 따로 늙는다').toBe(true);
  expect(/min="\$\{IMG_MIN_PCT\}"/.test(src), '★폭(%) 칸의 min 이 상수가 아니다').toBe(true);
  expect(/numWire\('grd-img-width-pct',\s*'widthPct',\s*IMG_MIN_PCT,\s*100\)/.test(src),
    '★폭(%) 배선이 없거나 상수를 안 쓴다').toBe(true);
  /* ⛔저장 포맷 무변경 — 새 필드를 만들지 않았다는 못. */
  const block = fs.readFileSync(path.join(REPO, 'js/blocks/grid-block.js'), 'utf8');
  expect(/'widthPct',?/.test(block), '★widthPct 가 GRID_LINE_FIELDS 에 없다 — ' +
    '그러면 이건 «새 필드»이고 저장 포맷이 바뀐 것이다').toBe(true);
});

void A_TEXT; void A_IMG; void A_GAP;
