/* grid-cell-border.dom.spec.js — T-172 칸 테두리의 «남은 두 축». (2026-09-24 · 기준 7780267)
 *
 * ★이 파일이 맡은 것은 ⑶「저장하고 다시 열어도 있나」와 ⑷의 앞 절반(패널 손잡이가 진짜인가)이다.
 *   ⑴값·⑵화면(인라인 CSS)은 tests/unit/grid-cell-border.test.js 가 «다른 잣대»(문자열 파싱)로 잰다.
 *   여기선 «계산된 스타일»로 잰다 — 같은 것을 두 번 읽는 게 아니라, 브라우저가 실제로 그 선언을
 *   받아들였는지를 본다(오타 난 선언은 인라인 문자열에는 있어도 computed 에는 안 온다).
 *
 *   S0    계측기 — 테두리 «없는» 판에서는 네 변이 0px 다(출발점이 참이다)
 *   S1    저장→불러오기(dataset 왕복) — 화면이 같다
 *   S2-a  저장→불러오기(HTML 왕복) — «심자마자» 보이는 화면이 같다
 *   S2-b  ★그 저장본을 «다시 그려도» 같다 — 건드리는 순간 사라지면 안 된다
 *   S3    우측 패널 손잡이 셋(굵기·색·꼴)이 «실제로» 화면을 바꾼다
 *   ★S4   양성대조 — 테두리를 dataset 이 아니라 «JS 속성»에 두면(= 화면만 되는 구현)
 *          S1·S2 가 빨개진다. ⛔이 대조가 없으면 「저장 축을 쟀다」가 말뿐이다.
 *   ★S5   양성대조 — 패널에서 손잡이 마크업을 빼면 S3 가 빨개진다
 *
 * ⛔앱을 «안» 띄운다. 제품 변경 0. 고디터 인스턴스·MCP 9345 대역 무접촉.
 * 실행: npm run test:dom -- --config=tests/dom/playwright.dom.config.js grid-cell-border
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
<script type="module">
  import { makeGridBlock, renderGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  import { stripEditorOnlyForCapture } from '/js/io/capture-safety.js';
  window.__strip = stripEditorOnlyForCapture;
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__ready = true;
</script></body></html>`;

/** @param {(src:string, pathname:string)=>string} [mutate]  ★양성대조 전용 — 서빙 직전에 한 군데만 비튼다. */
async function boot(page, mutate) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const body = fs.readFileSync(file);
    const ct = MIME[path.extname(file)] || 'text/plain';
    if (mutate) return route.fulfill({ contentType: ct, body: mutate(body.toString('utf8'), url.pathname) });
    return route.fulfill({ contentType: ct, body });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(([fx, sc]) => { window.__FIX = fx; window.__SC = sc; }, [FIXTURE, SCENARIO]);
  return errs;
}

const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'h2', text: 'R0C0' }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ],
};
/* ★간격을 «0 이 아닌 값»으로 둔다 — 겹침 규칙이 안쪽 변을 죽이면 「왕복에서 사라졌다」와
   구분이 안 된다. 네 칸이 네 변을 «다» 들고 있는 판에서 왕복을 잰다. */
const SCENARIO = [
  { rowGap: 10, colGap: 10 },
  { cellBorderWidth: 3, cellBorderColor: '#7b2ff7', cellBorderStyle: 'dashed' },
];

/* ── 페이지 안에 «화면 재는 자»를 한 벌만 심는다 ─────────────────────── */
const INSTALL_MEASURE = () => {
  window.__screen = (block) => {
    if (!block) return { GONE: true };
    const out = {};
    const cells = block.querySelectorAll('.grd-cell');
    out['n'] = String(cells.length);
    for (const el of cells) {
      const t = `${el.dataset.r}${el.dataset.c}`;
      const cs = getComputedStyle(el);
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        out[`${t}.b${side}`] = `${cs['border' + side + 'Width']} ${cs['border' + side + 'Style']} ${cs['border' + side + 'Color']}`;
      }
      out[`${t}.text`] = (el.innerText || '').trim();
    }
    return out;
  };
  window.__diff = (a, b) => {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    const d = {};
    for (const k of keys) if (a[k] !== b[k]) d[k] = `${a[k]} → ${b[k]}`;
    return d;
  };
};
const fmt = (d) => Object.keys(d).length
  ? Object.keys(d).sort().map(k => `      ${k}: ${d[k]}`).join('\n')
  : '      (차이 없음)';

const EXPECT = '3px dashed rgb(123, 47, 247)';
/* ★「테두리 없음」은 «0px none» 이다 — 색까지 박지 않는다.
   실측(2026-09-24): 선이 없을 때 border-*-color 는 currentColor 를 따라 rgb(224, 224, 224) 로 온다.
   그 색을 상수로 박으면 «글자색을 바꾸는 남의 커밋»이 이 검사를 빨갛게 만든다 —
   이 파일이 묻는 것은 색이 아니라 「선이 있나 없나」다. */
const NO_BORDER = /^0px none /;
const SIDES = ['bTop', 'bRight', 'bBottom', 'bLeft'];
const TAGS = ['00', '01', '10', '11'];

/* ══════════════════════════════════════════════════════════════════════
 * S0 — 계측기.
 * ════════════════════════════════════════════════════════════════════ */
test('S0 ★계측기 — 테두리 없는 판은 0px, 준 뒤엔 네 칸 네 변이 «다» 그 값이다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    const bare = window.__screen(block);
    const ops = window.__SC.map(p => { const x = window.updateGridBlock(block.id, p); return { ok: !!(x && x.ok), code: x && x.code, message: x && x.message }; });
    return { ops, bare, full: window.__screen(block) };
  }, INSTALL_MEASURE.toString());
  expect(errs).toEqual([]);
  expect(r.ops.every(o => o.ok), `시나리오가 실패했다: ${JSON.stringify(r.ops)}`).toBe(true);
  expect(r.full['n'], '★칸이 4개가 아니다').toBe('4');
  for (const t of TAGS) for (const s of SIDES) {
    expect(r.bare[`${t}.${s}`], `★테두리를 «안 줬는데» 칸 ${t} 의 ${s} 에 선이 있다 — 출발점이 참이 아니다`).toMatch(NO_BORDER);
    expect(r.full[`${t}.${s}`], `★칸 ${t} 의 ${s} 에 테두리가 안 왔다 — 브라우저가 그 선언을 «안 받아들였다»`).toBe(EXPECT);
  }
});

/* ══════════════════════════════════════════════════════════════════════
 * S1 — dataset 왕복.
 * ════════════════════════════════════════════════════════════════════ */
test('S1 ★저장→불러오기(dataset) — 다시 그린 화면이 같다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    for (const p of window.__SC) window.updateGridBlock(block.id, p);
    const before = window.__screen(block);
    const saved = JSON.parse(JSON.stringify({ ...block.dataset }));   // ★저장본이 담는 것 = dataset 전부
    const { row: row2, block: block2 } = window.__mk({});
    HOST.appendChild(row2);
    for (const k of Object.keys({ ...block2.dataset })) delete block2.dataset[k];
    Object.assign(block2.dataset, saved);
    window.__render(block2);
    return { savedKeys: Object.keys(saved).sort(), before, after: window.__screen(block2) };
  }, INSTALL_MEASURE.toString());
  expect(errs).toEqual([]);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [r.before, r.after]);
  expect(d,
    '★dataset 을 그대로 옮겨 다시 그렸는데 «화면»이 달라졌다 — 저장하면 테두리가 사라진다는 뜻이다.\n' +
    `   저장된 키: ${r.savedKeys.join(' · ')}\n` + fmt(d)).toEqual({});
  expect(r.savedKeys, '★테두리 세 키가 dataset 에 없다 — 저장본이 그 값을 안 담는다')
    .toEqual(expect.arrayContaining(['cellBorderWidth', 'cellBorderColor', 'cellBorderStyle']));
});

/* ══════════════════════════════════════════════════════════════════════
 * S2 — HTML 왕복. 저장본이 «실제로» 담는 것.
 * ════════════════════════════════════════════════════════════════════ */
test('S2-a ★저장→불러오기(HTML) — 심자마자 보이는 화면이 같다(연 직후)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    for (const p of window.__SC) window.updateGridBlock(block.id, p);
    const before = window.__screen(block);
    const html = row.outerHTML;
    HOST.innerHTML = '';
    HOST.innerHTML = html;                       // 저장본을 도로 심는다 — 다시 그리지 «않는다»
    return { before, after: window.__screen(HOST.querySelector('.grid-block')) };
  }, INSTALL_MEASURE.toString());
  expect(errs).toEqual([]);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [r.before, r.after]);
  expect(d, '★저장본 HTML 을 도로 심었더니 화면이 달라졌다 — 연 직후부터 테두리가 다르다.\n' + fmt(d)).toEqual({});
});

test('S2-b ★★저장본을 «다시 그려도» 같다 — 건드리는 순간 사라지면 안 된다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    for (const p of window.__SC) window.updateGridBlock(block.id, p);
    const before = window.__screen(block);
    const html = row.outerHTML;
    HOST.innerHTML = '';
    HOST.innerHTML = html;
    const re = HOST.querySelector('.grid-block');
    const opened = window.__screen(re);
    window.__render(re);                          // 첫 조작이 일으키는 재렌더
    return { before, opened, redrawn: window.__screen(re) };
  }, INSTALL_MEASURE.toString());
  expect(errs).toEqual([]);
  const d1 = await page.evaluate(([a, b]) => window.__diff(a, b), [r.opened, r.redrawn]);
  expect(d1,
    '★저장본을 열자마자 보이던 화면과 «다시 그린» 화면이 다르다 — 저장된 픽셀은 맞는데\n' +
    '   렌더러가 그 값을 «dataset 에서» 못 읽는다는 뜻이다.\n' + fmt(d1)).toEqual({});
  const d2 = await page.evaluate(([a, b]) => window.__diff(a, b), [r.before, r.redrawn]);
  expect(d2, '★왕복 뒤 다시 그린 화면이 원본과 다르다.\n' + fmt(d2)).toEqual({});
});

/* ══════════════════════════════════════════════════════════════════════
 * S3 — 우측 패널 손잡이. ★「있나」가 아니라 «눌러서 화면이 바뀌나»로 잰다.
 *   ⚠️굵기 0 에서는 색·꼴 줄이 «일부러» 없다(죽은 컨트롤 + 패널 길이). 그래서 순서가 있다:
 *      굵기를 먼저 올리면 패널이 다시 그려지고 그때 색·꼴이 나온다.
 *   ★S7 이 그 «켠 상태»의 패널을 따로 잰다 — 이 숨김이 만든 사각지대를 같은 패치에서 받친다.
 * ════════════════════════════════════════════════════════════════════ */
const PANEL_DRIVE = () => {
  const fire = (el, ev) => el.dispatchEvent(new Event(ev, { bubbles: true }));
  window.__mount = () => {
    const HOST = document.getElementById('host');
    const PANEL = document.querySelector('#panel-right .panel-body');
    HOST.innerHTML = ''; PANEL.innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    block.classList.add('selected');
    window.__open(block, null);
    return block;
  };
  window.__setW = (v) => {
    const el = document.getElementById('grd-border-w-number');
    if (!el) return false;
    el.value = String(v); fire(el, 'input'); fire(el, 'change');   // ★change 가 패널을 다시 그린다
    return true;
  };
  window.__drive = () => {
    const block = window.__mount();
    const found = {};
    const grab = (id) => { const el = document.getElementById(id); found[id] = !!el; return el; };
    const screen = () => window.__screen(document.querySelector('#host .grid-block'));

    const before = screen();
    found['grd-border-w-number'] = !!document.getElementById('grd-border-w-number');
    /* ★굵기 0 일 때 색·꼴이 «없는 것»도 이 판의 사실이다 — 같이 적어 둔다. */
    const offHasColor = !!document.getElementById('grd-border-color');
    window.__setW(4);
    const afterW = screen();

    const pick = grab('grd-border-color');
    if (pick) { pick.value = '#00aa44'; fire(pick, 'change'); }
    const afterC = screen();

    const sel = grab('grd-border-style');
    if (sel) { sel.value = 'dotted'; fire(sel, 'change'); }
    const afterS = screen();
    return { found, offHasColor, before, afterW, afterC, afterS, id: block.id };
  };
};

test('S3 ★패널 — 굵기·색·꼴 손잡이가 «실제로» 화면을 바꾼다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(([m, d]) => { eval('(' + m + ')()'); eval('(' + d + ')()'); return window.__drive(); },
    [INSTALL_MEASURE.toString(), PANEL_DRIVE.toString()]);
  expect(errs).toEqual([]);
  expect(r.found, '★패널에 테두리 손잡이 셋이 다 있어야 한다(색·꼴은 굵기를 올린 뒤)')
    .toEqual({ 'grd-border-w-number': true, 'grd-border-color': true, 'grd-border-style': true });
  expect(r.offHasColor, '★굵기 0 인데 색 손잡이가 있다 — 죽은 컨트롤을 내고 있다(설계와 다르다)').toBe(false);
  expect(r.before['00.bTop'], '★패널을 열자마자 테두리가 있다 — 기본값이 0 이 아니다').toMatch(NO_BORDER);
  expect(r.afterW['00.bTop'], '★굵기 손잡이를 움직였는데 화면이 그대로다').toContain('4px');
  expect(r.afterC['00.bTop'], '★색 손잡이를 움직였는데 화면이 그대로다').toContain('rgb(0, 170, 68)');
  expect(r.afterS['00.bTop'], '★꼴 손잡이를 움직였는데 화면이 그대로다 — 「dotted 로 골랐는데 실선」이 그 갈래다').toContain('dotted');
});

/* ══════════════════════════════════════════════════════════════════════
 * S7 — ★짝 검사. 굵기 0 에서 색·꼴을 숨긴 탓에 남의 패널 델타 게이트
 *   (grid-cell-panel-handles.dom.spec.js G2)는 «켠 상태»를 영영 안 잰다.
 *   그 사각지대를 «같은 패치에서» 여기서 받는다 — 켠 뒤에도 패널이 가로로 안 삐져나가고,
 *   색칸이 눌려 사라지지 않는가.
 * ════════════════════════════════════════════════════════════════════ */
test('S7 ★짝 검사 — 테두리를 «켠» 패널도 가로로 안 삐져나간다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(([m, d]) => {
    eval('(' + m + ')()'); eval('(' + d + ')()');
    const body = document.querySelector('#panel-right .panel-body');
    const measure = () => {
      const rb = body.getBoundingClientRect();
      const over = [...body.querySelectorAll('*')].filter(el => {
        const q = el.getBoundingClientRect();
        return (q.width || q.height) && q.right > rb.right + 0.5;
      }).map(el => el.id || el.className || el.tagName);
      const sw = document.querySelector('#panel-right .panel-body .prop-color-swatch');
      const hex = document.getElementById('grd-border-color-hex');
      const selEl = document.getElementById('grd-border-style');
      const w = (el) => (el ? Math.round(el.getBoundingClientRect().width) : -1);
      return { overflowRight: over.length, over: over.slice(0, 5),
               scrollW: body.scrollWidth, clientW: body.clientWidth,
               swatchW: w(sw), hexW: w(hex), selW: w(selEl) };
    };
    window.__mount();
    const off = measure();
    window.__setW(6);
    return { off, on: measure() };
  }, [INSTALL_MEASURE.toString(), PANEL_DRIVE.toString()]);
  expect(errs).toEqual([]);
  expect(r.off.overflowRight, `★테두리를 «끈» 상태에서 이미 삐져나간다 — 이 검사는 내 변경을 안 겨눈다: ${JSON.stringify(r.off.over)}`).toBe(0);
  expect(r.on.overflowRight, `★테두리를 켰더니 패널 밖으로 나간 요소가 있다: ${JSON.stringify(r.on.over)}`).toBe(0);
  expect(r.on.scrollW, '★켠 뒤 패널에 가로 스크롤이 생겼다').toBeLessThanOrEqual(r.on.clientW);
  for (const [k, ko] of [['swatchW', '색칸'], ['hexW', 'hex 입력'], ['selW', '선 꼴 고르개']]) {
    expect(r.on[k], `★${ko} 가 안 보인다(폭 ${r.on[k]}) — 켠 상태 패널이 «있기만» 하고 못 쓴다`).toBeGreaterThan(14);
  }
});

/* ══════════════════════════════════════════════════════════════════════
 * S6 — 내보내기. ★PNG 캡처는 «라이브 DOM 이 아니라 세척한 클론»을 찍는다
 *   (js/io/export-image.js prepareCloneForCapture → stripEditorOnlyForCapture → CDP).
 *   그래서 「화면엔 있는데 내보낸 그림엔 없다」가 날 수 있는 자리는 «그 세척»이다.
 *   여기선 그 세척 한 벌을 실제로 돌려, 테두리가 살아남는지 본다.
 *   ⛔이 검사는 «픽셀»을 안 잰다 — 픽셀은 앱을 띄워 captureSectionCdp 로 따로 쟀다(보고 참조).
 *     여기서 「픽셀도 쟀다」고 말하지 않는다.
 * ════════════════════════════════════════════════════════════════════ */
test('S6 ★내보내기 — 캡처용 세척을 거친 클론에도 테두리가 남는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    const SEC = HOST.closest('.section-block');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    for (const p of window.__SC) window.updateGridBlock(block.id, p);
    block.classList.add('selected');                 // ★세척이 «실제로 돌았나»를 볼 증인
    const live = window.__screen(block);

    const clone = SEC.cloneNode(true);
    window.__strip(clone);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
    document.body.appendChild(clone);                // ⛔#canvas «밖» — 실제 캡처와 같은 자리
    const cb = clone.querySelector('.grid-block');
    const out = { live, clone: window.__screen(cb), stripped: !cb.classList.contains('selected') };
    clone.remove();
    return out;
  }, INSTALL_MEASURE.toString());
  expect(errs).toEqual([]);
  expect(r.stripped, '★세척이 «안 돌았다» — .selected 가 그대로다. 그러면 아래 초록은 아무것도 증명 못 한다').toBe(true);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [r.live, r.clone]);
  expect(d,
    '★내보내기용으로 세척한 클론의 테두리가 화면과 다르다 — 「화면엔 있는데 그림엔 없다」가 된다.\n' + fmt(d)).toEqual({});
  for (const t of TAGS) for (const sd of SIDES) {
    expect(r.clone[`${t}.${sd}`], `★클론의 칸 ${t} ${sd} 에 선이 없다`).toBe(EXPECT);
  }
});

/* ══════════════════════════════════════════════════════════════════════
 * ★양성대조 — 기능을 빼면 위 검사가 빨개지는가.
 * ════════════════════════════════════════════════════════════════════ */

/** ★「화면에만 되고 저장은 안 되는」 구현을 만든다 — 테두리를 dataset 이 아니라 «JS 속성»에 둔다.
 *  이 레포가 실제로 당한 갈래다(저장 포맷을 바꾸면 그물 16/16 초록인데 저장하면 사라졌다). */
const MUT_SCREEN_ONLY = (src, pathname) => {
  if (pathname !== '/js/blocks/grid-block.js') return src;
  let out = src.replace('  const ds = (block && block.dataset) || {};\n  const wRaw = ds.cellBorderWidth;',
                        '  const ds = (block && block.__bd) || {};\n  const wRaw = ds.cellBorderWidth;');
  if (out === src) throw new Error('★S4 닻①이 빗나갔다 — _gridCellBorder 의 dataset 읽는 두 줄을 못 찾았다');
  const mid = out;
  out = out.replace('  Object.assign(block.dataset, next);',
                    '  Object.assign(block.dataset, next);\n  block.__bd = Object.assign({}, block.__bd, next);');
  if (out === mid) throw new Error('★S4 닻②가 빗나갔다 — updateGridBlock 의 dataset 커밋 줄을 못 찾았다');
  return out;
};

test('S4 ★양성대조 — 테두리를 dataset 아닌 «JS 속성»에 두면 S0 은 초록인데 S1·S2 가 빨개진다', async ({ page }) => {
  const errs = await boot(page, MUT_SCREEN_ONLY);
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    for (const p of window.__SC) window.updateGridBlock(block.id, p);
    const live = window.__screen(block);
    const saved = JSON.parse(JSON.stringify({ ...block.dataset }));
    const { row: row2, block: block2 } = window.__mk({});
    HOST.appendChild(row2);
    for (const k of Object.keys({ ...block2.dataset })) delete block2.dataset[k];
    Object.assign(block2.dataset, saved);
    window.__render(block2);
    return { live, after: window.__screen(block2) };
  }, INSTALL_MEASURE.toString());
  expect(errs).toEqual([]);
  /* ★화면 축은 «그대로 초록»이다 — 그래서 ⑵만 재면 이 결함을 한 건도 못 잡는다. */
  expect(r.live['00.bTop'], '★변형본에서 «살아 있는» 화면마저 안 그려졌다 — 그러면 이 대조는 저장 축을 안 겨눈 것이다').toBe(EXPECT);
  expect(r.after['00.bTop'], '★저장을 안 하는 구현인데 왕복 뒤에도 테두리가 살아 있다 — S1 은 그 축을 «안 재고 있다»')
    .toMatch(NO_BORDER);
});

const MUT_NO_PANEL = (src, pathname) => {
  if (pathname !== '/js/props/prop-grid.js') return src;
  const out = src.replace('    ${_borderSectionHtml(_cellBorder)}\n', '');
  if (out === src) throw new Error('★S5 닻이 빗나갔다 — 패널의 테두리 절 호출을 못 찾았다');
  return out;
};

test('S5 ★양성대조 — 패널에서 손잡이 마크업을 빼면 S3 가 빨개진다', async ({ page }) => {
  const errs = await boot(page, MUT_NO_PANEL);
  const r = await page.evaluate(([m, d]) => { eval('(' + m + ')()'); eval('(' + d + ')()'); return window.__drive(); },
    [INSTALL_MEASURE.toString(), PANEL_DRIVE.toString()]);
  expect(errs).toEqual([]);
  expect(Object.values(r.found).some(Boolean),
    '★패널 호출을 뺐는데 손잡이가 여전히 잡힌다 — S3 는 그 마크업을 «안 재고 있다»').toBe(false);
  expect(r.afterS['00.bTop'], '★손잡이가 없는데 화면이 바뀌었다 — S3 가 «딴 데서» 온 초록을 읽고 있다').toMatch(NO_BORDER);
});
