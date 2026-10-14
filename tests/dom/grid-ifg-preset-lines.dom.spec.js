/* grid-ifg-preset-lines.dom.spec.js — 1013t2F 인포블럭 «구분선» 프리셋의 선이 우측 패널에서 «진짜로» 켜지고 꺼지나.
 *
 * ★현빈 지적(원문): 「구분선 스타일의 경우, 블럭외곽선 옵션이 들어가있는거니? 윗변과 칼럼로우 중간 구분선들 말야,
 *   이거 우측패널에서 이걸로 조절이 안되네??」 — 프로토(proto/z3.css)는 그 선을 CSS 로 «고정»했다.
 *   ⛔「붙였다」로 닫지 않는다 — 단추를 눌러 선이 사라지나/생기나를 «칸마다 computed border» 로 잰다
 *     (칸 위 변 · 칸 사이 세로 · 바깥 변 각각) + 배선을 끊으면 빨개지나(음성대조).
 *   값·인라인 문자열 축은 tests/unit/grid-cell-border-edges.test.js · grid-ifg-preset.test.js 가 «다른 자»로 잰다.
 *
 *   P0  전제 — 프리셋 없는 새 그리드: 칸 16변 0px · 블럭 4변 0px · dataset 에 cellBorderEdges/ifgPreset 없음
 *   P1  구분선 프리셋 — 칸 위 변 4 · c=1 왼쪽 2 = 1px solid rgb(179,177,174) · 나머지 0 · 블럭 4변 0 · 패널 표시
 *   P2  패널 [위 변] 클릭 → 칸 위 변 0 · 세로 그대로 · 히스토리 1장(되돌리면 P1 표)
 *   P3  패널 [칸 사이] 클릭 → 세로 0 · 위 변 그대로
 *   P4  「블럭 외곽선」과 독립 — 아래·왼·오 켜도 칸 표 무변 · 위 켜면 첫 행 칸 위 변 0(두 겹 방지) · 칸 [위 변] 꺼도 블럭 위 그대로
 *   P5  「모든 칸 테두리」 따름 — 굵기 3 · 색 #ff0000 · 꼴 dashed → 켠 변 전부 그 값 · 끈 변 0 · 패널 가로 넘침 0
 *   P6  저장 왕복 — dataset 왕복 · HTML 왕복(다시 그려도) 칸 표 같음
 *   P7  ★기존 그리드 바이트 무변 — 키 없는 그리드 3종의 칸 style 속성·dataset 이 366fd826 판 출력(고정 픽스처)과 문자열 동일
 *   P8  기본 프리셋 — lines → basic: 칸 선 0 · cellBorderEdges 없음 · 프리셋 단추 기본 active
 *   P9  내보내기 — 캡처 세척 클론에 P1 표 그대로(인라인)
 *   ★N1~N8 음성대조 — boot(page, mutate) 로 서빙 직전 «한 곳»만 비틀어 위 칸이 빨개지는지(= 이 자가 그 배선을 무는지)
 *
 * ⛔앱을 «안» 띄운다(라우트 하네스 · grid-cell-border.dom.spec.js 꼴 그대로) · ⛔waitForTimeout 0 · 픽셀(P10) 안 잰다.
 * ⚠️⌘Z 는 «진짜 history.js» 가 아니라 pushHistory 대역(블럭 dataset 스냅샷)으로 잰다 — 「한 문 = 한 장 · 그 장이 앞 상태를 다 담는다」까지다.
 * 실행(인텔): bash ~/taeyang-098/run-test.sh dom tests/dom/grid-ifg-preset-lines.dom.spec.js --retries=0
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
/* ★P7 기준 — 366fd826 판 grid-block.js 를 유닛 미니 DOM 에서 돌린 출력(2026-10-14 한 번 굽고 고정 · ⛔새 코드로 다시 굽지 마라). */
const BASE = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/grid-cell-border-edges-366fd826.json'), 'utf8'));

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
  import * as IFG from '/js/blocks/grid-infographic.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  import { stripEditorOnlyForCapture } from '/js/io/capture-safety.js';
  window.__strip = stripEditorOnlyForCapture;
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__ifg = IFG;
  /* ⌘Z 대역 — 고치는 문이 «변경 전» 부르는 pushHistory 가 블럭 dataset 한 장을 찍는다. */
  window.__hist = [];
  window.pushHistory = () => { const b = document.querySelector('#host .grid-block'); window.__hist.push(b ? JSON.stringify({ ...b.dataset }) : null); };
  window.__undo = () => {
    const b = document.querySelector('#host .grid-block'); const snap = window.__hist.pop();
    if (!b || !snap) return false;
    for (const k of Object.keys({ ...b.dataset })) delete b.dataset[k];
    Object.assign(b.dataset, JSON.parse(snap)); renderGridBlock(b); return true;
  };
  window.__ready = true;
</script></body></html>`;

/** @param {(src:string, pathname:string)=>string} [mutate]  ★음성대조 전용 — 서빙 직전에 한 군데만 비튼다. */
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
  await page.evaluate((install) => { eval('(' + install + ')()'); }, INSTALL.toString());
  return errs;
}
/** 변이 한 곳 — 닻이 빗나가면 «그 자리에서» 죽는다(조용한 무변이 금지). */
const mut = (file, from, to) => (src, p) => {
  if (p !== file) return src;
  const out = src.replace(from, to);
  if (out === src) throw new Error(`★닻이 빗나갔다 — ${file} :: ${String(from).slice(0, 60)}`);
  return out;
};

/* ── 페이지 안 «재는 자»·«모는 자» 한 벌 ─────────────────────────────── */
const INSTALL = () => {
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  const fmt = (cs, s) => `${cs['border' + s + 'Width']} ${cs['border' + s + 'Style']}${cs['border' + s + 'Width'] === '0px' ? '' : ' ' + cs['border' + s + 'Color']}`;
  /** 칸마다 네 변 + 블럭 자기 네 변. 선이 없으면 「0px none」(색은 안 박는다 — currentColor 를 따라 흔들린다). */
  window.__screen = (block) => {
    const out = {};
    for (const el of block.querySelectorAll(':scope > .grd-inner > .grd-cell')) {
      const cs = getComputedStyle(el);
      for (const s of SIDES) out[`${el.dataset.r}${el.dataset.c}.${s[0]}`] = fmt(cs, s);
    }
    const bs = getComputedStyle(block);
    for (const s of SIDES) out[`B.${s[0]}`] = fmt(bs, s);
    return out;
  };
  window.__lines = () => {
    const ITEMS = [{ title: 'T1', desc: 'D1' }, { title: 'T2', desc: 'D2' }];
    const HOST = document.getElementById('host');
    const PANEL = document.querySelector('#panel-right .panel-body');
    HOST.innerHTML = ''; PANEL.innerHTML = '';
    const { row, block } = window.__mk(window.__ifg.ifgBuildOpts(ITEMS, 2, 2, 'basic'));
    HOST.appendChild(row);
    block.classList.add('selected');
    const pre = window.__screen(block);
    const res = window.__ifg.applyIfgPreset(block, 'lines');
    window.__hist.length = 0;
    window.__open(block, null);
    return { block, pre, res: { ok: !!(res && res.ok), message: res && res.message } };
  };
  window.__panel = () => {
    const q = (s) => document.querySelector('#panel-right .panel-body ' + s);
    const ap = (el) => (el ? el.getAttribute('aria-pressed') : null);
    return {
      modeLines: ap(q('[data-edges-mode="lines"]')), modeBox: ap(q('[data-edges-mode="box"]')),
      top: ap(q('[data-edge="top"]')), vsep: ap(q('[data-edge="vsep"]')),
      ifgActive: [...document.querySelectorAll('#grd-ifg-preset-group [data-ifg-pick]')].filter(b => b.classList.contains('active')).map(b => b.dataset.ifgPick),
      outlineTitle: (q('#grd-outline-group') || {}).getAttribute?.('aria-label') || null,
    };
  };
};

const LINE = '1px solid rgb(179, 177, 174)';
const OFF = '0px none';
/** P1 의 칸 표(2×2 · gap 0 · top,vsep) — 외곽선 꺼짐. */
const P1_TABLE = {
  '00.T': LINE, '00.R': OFF, '00.B': OFF, '00.L': OFF,
  '01.T': LINE, '01.R': OFF, '01.B': OFF, '01.L': LINE,
  '10.T': LINE, '10.R': OFF, '10.B': OFF, '10.L': OFF,
  '11.T': LINE, '11.R': OFF, '11.B': OFF, '11.L': LINE,
  'B.T': OFF, 'B.R': OFF, 'B.B': OFF, 'B.L': OFF,
};
const with_ = (base, over) => ({ ...base, ...over });

/* ══ P0 ══════════════════════════════════════════════════════════════════ */
test('P0 ★전제 — 프리셋 없는 새 그리드는 칸·블럭 변이 전부 0px · 새 키 없음', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const { row, block } = window.__mk({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }], rows: [{ height: 'auto' }, { height: 'auto' }] });
    document.getElementById('host').appendChild(row);
    return { s: window.__screen(block), ds: { ...block.dataset } };
  });
  expect(errs).toEqual([]);
  expect(Object.keys(r.s).length, '★칸 4 × 4변 + 블럭 4변 = 20 칸을 못 쟀다').toBe(20);
  for (const [k, v] of Object.entries(r.s)) expect(v, `★${k}`).toBe(OFF);
  expect(r.ds.cellBorderEdges).toBeUndefined();
  expect(r.ds.ifgPreset).toBeUndefined();
});

/* ══ P1 ══════════════════════════════════════════════════════════════════ */
test('P1 ★구분선 프리셋 — 칸 위 변 · 칸 사이 세로만 #b3b1ae 1px · 바깥 0 · 패널이 그 상태를 말한다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => { const x = window.__lines(); return { ...x, block: undefined, s: window.__screen(x.block), ds: { ...x.block.dataset }, p: window.__panel() }; });
  expect(errs).toEqual([]);
  expect(r.res.ok, `★프리셋 적용 실패 — ${r.res.message}`).toBe(true);
  for (const [k, v] of Object.entries(r.pre)) expect(v, `★전제: 기본 프리셋 그리드의 ${k} 에 선이 있다`).toBe(OFF);
  expect(r.s).toEqual(P1_TABLE);
  expect(r.ds.cellBorderEdges).toBe('top,vsep');
  expect(r.ds.ifgPreset).toBe('lines');
  expect(r.p).toMatchObject({ modeLines: 'true', modeBox: 'false', top: 'true', vsep: 'true', ifgActive: ['lines'] });
});

/* ══ P2·P3 ═══════════════════════════════════════════════════════════════ */
test('P2 ★패널 [위 변] — 누르면 칸 위 변 4개가 사라지고 세로는 그대로 · 히스토리 1장 · 되돌리면 P1', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.__lines(); });
  expect(await page.evaluate(() => window.__panel().top), '★전제: [위 변] 이 켜져 있지 않다').toBe('true');
  await page.click('#grd-border-edges [data-edge="top"]');
  const r = await page.evaluate(() => {
    const b = document.querySelector('#host .grid-block');
    const after = window.__screen(b); const hist = window.__hist.length; const p = window.__panel();
    window.__undo();
    return { after, hist, p, undone: window.__screen(b) };
  });
  expect(errs).toEqual([]);
  expect(r.after).toEqual(with_(P1_TABLE, { '00.T': OFF, '01.T': OFF, '10.T': OFF, '11.T': OFF }));
  expect(r.p.top, '★패널이 [위 변] 끔을 안 말한다').toBe('false');
  expect(r.hist, '★한 번 눌렀는데 히스토리가 한 장이 아니다(⌘Z 가 한 번에 안 돌아간다)').toBe(1);
  expect(r.undone).toEqual(P1_TABLE);
});

test('P3 ★패널 [칸 사이] — 누르면 칸 사이 세로가 사라지고 위 변은 그대로', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.__lines(); });
  expect(await page.evaluate(() => window.__panel().vsep), '★전제: [칸 사이] 가 켜져 있지 않다').toBe('true');
  await page.click('#grd-border-edges [data-edge="vsep"]');
  const r = await page.evaluate(() => ({ s: window.__screen(document.querySelector('#host .grid-block')), p: window.__panel() }));
  expect(errs).toEqual([]);
  expect(r.s).toEqual(with_(P1_TABLE, { '01.L': OFF, '11.L': OFF }));
  expect(r.p.vsep).toBe('false');
  /* 다시 누르면 돌아온다(토글) */
  await page.click('#grd-border-edges [data-edge="vsep"]');
  expect(await page.evaluate(() => window.__screen(document.querySelector('#host .grid-block')))).toEqual(P1_TABLE);
});

/* ══ P4 ══════════════════════════════════════════════════════════════════ */
test('P4 ★「블럭 외곽선」과 독립 — 바깥 변은 블럭 자기 border · 위 변만 두 겹 방지', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.__lines(); });
  for (const sd of ['bottom', 'left', 'right']) await page.click(`#grd-outline-group [data-outline-side="${sd}"]`);
  const a = await page.evaluate(() => window.__screen(document.querySelector('#host .grid-block')));
  expect(a, '★외곽선 아래·왼·오를 켰더니 칸 표가 바뀌었거나 블럭 변이 안 생겼다')
    .toEqual(with_(P1_TABLE, { 'B.B': LINE, 'B.L': LINE, 'B.R': LINE }));
  await page.click('#grd-outline-group [data-outline-side="top"]');
  const b = await page.evaluate(() => window.__screen(document.querySelector('#host .grid-block')));
  expect(b, '★외곽선 위를 켜면 블럭 위 1px · 첫 행 칸 위 변 0(두 겹 방지) · 둘째 행 위 변 그대로')
    .toEqual(with_(P1_TABLE, { 'B.T': LINE, 'B.B': LINE, 'B.L': LINE, 'B.R': LINE, '00.T': OFF, '01.T': OFF }));
  await page.click('#grd-border-edges [data-edge="top"]');
  const c = await page.evaluate(() => window.__screen(document.querySelector('#host .grid-block')));
  expect(c['B.T'], '★칸 [위 변] 을 껐는데 블럭 외곽선 위 변까지 꺼졌다 — 두 축이 엉켰다').toBe(LINE);
  expect([c['10.T'], c['11.T']], '★칸 [위 변] 을 껐는데 행 사이 선이 남았다').toEqual([OFF, OFF]);
  expect(errs).toEqual([]);
});

/* ══ P5 ══════════════════════════════════════════════════════════════════ */
test('P5 ★「모든 칸 테두리」 값을 따른다 — 굵기·색·꼴 · 켠 상태 패널 가로 넘침 0', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.__lines(); });
  const r = await page.evaluate(() => {
    const fire = (el, ev) => el.dispatchEvent(new Event(ev, { bubbles: true }));
    const n = document.getElementById('grd-border-w-number'); n.value = '3'; fire(n, 'input'); fire(n, 'change');
    const c = document.getElementById('grd-border-color'); c.value = '#ff0000'; fire(c, 'change');
    const s = document.getElementById('grd-border-style'); s.value = 'dashed'; fire(s, 'change');
    const body = document.querySelector('#panel-right .panel-body');
    const rb = body.getBoundingClientRect();
    const over = [...body.querySelectorAll('*')].filter(el => { const q = el.getBoundingClientRect(); return (q.width || q.height) && q.right > rb.right + 0.5; })
      .map(el => el.id || el.className || el.tagName);
    return { s: window.__screen(document.querySelector('#host .grid-block')), over, rowsShown: !!document.getElementById('grd-border-edges') };
  });
  expect(errs).toEqual([]);
  const L3 = '3px dashed rgb(255, 0, 0)';
  const want = {};
  for (const [k, v] of Object.entries(P1_TABLE)) want[k] = v === LINE ? L3 : v;
  expect(r.s).toEqual(want);
  expect(r.rowsShown, '★전제: 굵기를 바꾼 뒤 선 자리 줄이 사라졌다').toBe(true);
  expect(r.over, '★선 자리 줄을 켠 패널이 가로로 삐져나간다').toEqual([]);
});

/* ══ P6 ══════════════════════════════════════════════════════════════════ */
test('P6 ★저장 왕복 — dataset 왕복 · HTML 왕복 후 다시 그려도 P1 표', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const { block } = window.__lines();
    const live = window.__screen(block);
    const saved = JSON.parse(JSON.stringify({ ...block.dataset }));
    const html = block.closest('.row').outerHTML;
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row: row2, block: b2 } = window.__mk({});
    HOST.appendChild(row2);
    for (const k of Object.keys({ ...b2.dataset })) delete b2.dataset[k];
    Object.assign(b2.dataset, saved);
    window.__render(b2);
    const viaDs = window.__screen(b2);
    HOST.innerHTML = html;
    const b3 = HOST.querySelector('.grid-block');
    const viaHtml = window.__screen(b3);
    window.__render(b3);
    return { live, viaDs, viaHtml, viaHtmlRe: window.__screen(b3), ds3: { e: b3.dataset.cellBorderEdges, k: b3.dataset.ifgPreset } };
  });
  expect(errs).toEqual([]);
  expect(r.live).toEqual(P1_TABLE);
  expect(r.viaDs, '★dataset 왕복에서 선이 바뀌었다').toEqual(P1_TABLE);
  expect(r.viaHtml, '★HTML 왕복(연 직후)에서 선이 바뀌었다').toEqual(P1_TABLE);
  expect(r.viaHtmlRe, '★HTML 왕복 뒤 «다시 그리니» 선이 바뀌었다').toEqual(P1_TABLE);
  expect(r.ds3).toEqual({ e: 'top,vsep', k: 'lines' });
});

/* ══ P7 ══════════════════════════════════════════════════════════════════ */
test('P7 ★기존 그리드 바이트 무변 — 키 없는 그리드 3종의 칸 style 속성·dataset 이 366fd826 판과 문자열 동일', async ({ page }) => {
  const errs = await boot(page);
  /* 픽스처 html 에서 칸 style 속성을 칸마다 뽑는다(노드 쪽 — 페이지 코드와 다른 자). */
  const want = {};
  for (const k of ['plain', 'box1', 'mix']) {
    want[k] = {};
    for (const m of BASE[k].html.matchAll(/<div class="grd-cell[^"]*" data-r="(\d)" data-c="(\d)" style="([^"]*)"/g)) want[k][m[1] + m[2]] = m[3];
    expect(Object.keys(want[k]).length, `★전제: 픽스처 ${k} 에서 칸 4개를 못 뽑았다`).toBe(4);
  }
  expect(want.box1['11'], '★전제: 픽스처 box1 에 네 변 선이 없다').toContain('border-right:1px solid #333333');
  const got = await page.evaluate(() => {
    const FIX = (mt) => ({
      cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: [{ height: 'auto' }, { height: 'auto' }],
      cells: [[{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'h3', text: 'B', ...(mt ? { marginTop: 12 } : {}) }] }],
              [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }]],
    });
    const HOST = document.getElementById('host');
    const shot = (b) => ({ cells: Object.fromEntries([...b.querySelectorAll('.grd-cell')].map(el => [el.dataset.r + el.dataset.c, el.getAttribute('style')])), ds: { ...b.dataset } });
    const U = window.updateGridBlock;
    const out = {};
    { HOST.innerHTML = ''; const { row, block } = window.__mk(FIX()); HOST.appendChild(row); out.plain = shot(block); }
    { HOST.innerHTML = ''; const { row, block } = window.__mk(FIX()); HOST.appendChild(row); U(block.id, { gap: 0 });
      U(block.id, { cellBorderWidth: 1, cellBorderColor: '#333333', cellBorderStyle: 'solid' }); out.box1 = shot(block); }
    { HOST.innerHTML = ''; const { row, block } = window.__mk(FIX(true)); HOST.appendChild(row); U(block.id, { gap: 12 });
      U(block.id, { cellBorderWidth: 2, cellBorderColor: '#123456', cellBorderStyle: 'dashed' });
      U(block.id, { blockOutline: 'top,bottom' }); U(block.id, { colRuleOn: '1', rowRuleOn: '1' }); out.mix = shot(block); }
    return out;
  });
  expect(errs).toEqual([]);
  for (const k of ['plain', 'box1', 'mix']) {
    expect(got[k].cells, `★${k}: 칸 style 속성이 366fd826 판과 다르다`).toEqual(want[k]);
    expect(got[k].ds, `★${k}: dataset 이 366fd826 판과 다르다`).toEqual(BASE[k].ds);
  }
});

/* ══ P8 ══════════════════════════════════════════════════════════════════ */
test('P8 ★기본 프리셋 — 패널 [기본] 클릭 → 칸 선 0 · 선 자리 키 지움 · 기본 active', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.__lines(); });
  expect(await page.evaluate(() => window.__panel().ifgActive), '★전제: 인포그래픽 절이 구분선을 안 말한다').toEqual(['lines']);
  await page.click('#grd-ifg-preset-group [data-ifg-pick="basic"]');
  const r = await page.evaluate(() => {
    const b = document.querySelector('#host .grid-block');
    return { s: window.__screen(b), ds: { ...b.dataset }, p: window.__panel(), hist: window.__hist.length };
  });
  expect(errs).toEqual([]);
  for (const [k, v] of Object.entries(r.s)) expect(v, `★기본 프리셋인데 ${k} 에 선`).toBe(OFF);
  expect(r.ds.cellBorderEdges).toBeUndefined();
  expect(r.ds.cellBorderWidth).toBe('0');
  expect([r.ds.rowGap, r.ds.colGap]).toEqual(['44', '24']);
  expect(r.p.ifgActive).toEqual(['basic']);
  expect(r.hist, '★프리셋 한 번에 히스토리가 한 장이 아니다').toBe(1);
});

/* ══ P9 ══════════════════════════════════════════════════════════════════ */
test('P9 ★내보내기 — 캡처 세척 클론의 칸 선이 화면(P1)과 같다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const { block } = window.__lines();
    const SEC = block.closest('.section-block');
    const clone = SEC.cloneNode(true);
    window.__strip(clone);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
    document.body.appendChild(clone);
    const cb = clone.querySelector('.grid-block');
    const out = { live: window.__screen(block), clone: window.__screen(cb), stripped: !cb.classList.contains('selected') };
    clone.remove();
    return out;
  });
  expect(errs).toEqual([]);
  expect(r.stripped, '★세척이 안 돌았다(.selected 그대로) — 아래 초록은 아무것도 증명 못 한다').toBe(true);
  expect(r.live).toEqual(P1_TABLE);
  expect(r.clone).toEqual(P1_TABLE);
});

/* ══ 음성대조 — 배선을 «한 곳» 끊으면 위 칸이 빨개지는가 ═══════════════════════════════
 *   각 대조는 «끊긴 판에서 무엇이 보이나»를 단언한다(= 그 칸이 빨개진다는 증거). 끊긴 판이 우연히 초록이면 이 대조가 빨강.
 * ════════════════════════════════════════════════════════════════════════════════════ */
const GB = '/js/blocks/grid-block.js', PG = '/js/props/prop-grid.js', IF = '/js/blocks/grid-infographic.js';

test('N1 ★음성대조 — 렌더의 선 자리 갈래를 지우면(늘 네 변) P1 이 빨개진다', async ({ page }) => {
  const errs = await boot(page, mut(GB, '  if (bd.edges) return _gridCellEdgesCss(bd, line, r, c);', ''));
  const s = await page.evaluate(() => window.__screen(window.__lines().block));
  expect(errs).toEqual([]);
  expect(s['00.R'], '★갈래를 지웠는데 (0,0) 오른쪽이 0 — P1 은 그 갈래를 안 잰다').not.toBe(OFF);
  expect(s).not.toEqual(P1_TABLE);
});

test('N2 ★음성대조 — 패널 [위 변]/[칸 사이] 클릭 배선을 끊으면 P2 가 빨개진다(위 변이 그대로)', async ({ page }) => {
  const errs = await boot(page, mut(PG, "propPanel.querySelectorAll('[data-edge]').forEach(", "propPanel.querySelectorAll('[data-edge-x]').forEach("));
  await page.evaluate(() => { window.__lines(); });
  expect(await page.evaluate(() => window.__panel().top), '★전제: 단추는 보인다').toBe('true');
  await page.click('#grd-border-edges [data-edge="top"]');
  const s = await page.evaluate(() => window.__screen(document.querySelector('#host .grid-block')));
  expect(errs).toEqual([]);
  expect(s['00.T'], '★배선을 끊었는데 위 변이 꺼졌다 — P2 가 단추가 아닌 딴 길을 잰다').toBe(LINE);
});

test('N3 ★음성대조 — [칸 사이] 단추가 엉뚱한 자리(top)를 가리키면 P3 이 빨개진다', async ({ page }) => {
  const errs = await boot(page, mut(PG, "${edge('vsep', '칸 사이',", "${edge('top', '칸 사이',"));
  await page.evaluate(() => { window.__lines(); });
  await page.click('#grd-border-edges button:nth-of-type(2)');
  const s = await page.evaluate(() => window.__screen(document.querySelector('#host .grid-block')));
  expect(errs).toEqual([]);
  expect([s['01.L'], s['11.L']], '★[칸 사이] 가 위 변을 겨눴는데 세로가 꺼졌다 — P3 가 그 배선을 안 문다').toEqual([LINE, LINE]);
});

test('N4 ★음성대조 — 외곽선 겹침 규칙을 끄면 P4 의 첫 행 위 변이 빨개진다(두 겹)', async ({ page }) => {
  const errs = await boot(page, mut(GB, 'cellBorder.topShared = _gridBlockOutline(block).on.top && !_gridBlockBg(block).on;', 'cellBorder.topShared = false;'));
  await page.evaluate(() => { window.__lines(); });
  await page.click('#grd-outline-group [data-outline-side="top"]');
  const s = await page.evaluate(() => window.__screen(document.querySelector('#host .grid-block')));
  expect(errs).toEqual([]);
  expect([s['B.T'], s['00.T']], '★겹침 규칙을 껐는데 첫 행 위 변이 0 — P4 가 그 규칙을 안 잰다').toEqual([LINE, LINE]);
});

test('N5 ★음성대조 — 선 자리를 dataset 아닌 JS 속성에 두면 화면은 초록인데 P6 왕복이 빨개진다', async ({ page }) => {
  const m1 = mut(GB, '  const eNorm = _gridNormEdges(ds.cellBorderEdges);', '  const eNorm = _gridNormEdges(block && block.__edges);');
  const m2 = mut(GB, '  Object.assign(block.dataset, next);\n', '  Object.assign(block.dataset, next);\n  if (next.cellBorderEdges !== undefined) block.__edges = next.cellBorderEdges;\n');
  const errs = await boot(page, (src, p) => m2(m1(src, p), p));
  const r = await page.evaluate(() => {
    const { block } = window.__lines();
    const live = window.__screen(block);
    const saved = JSON.parse(JSON.stringify({ ...block.dataset }));
    const HOST = document.getElementById('host'); HOST.innerHTML = '';
    const { row, block: b2 } = window.__mk({}); HOST.appendChild(row);
    for (const k of Object.keys({ ...b2.dataset })) delete b2.dataset[k];
    Object.assign(b2.dataset, saved); window.__render(b2);
    return { live, after: window.__screen(b2) };
  });
  expect(errs).toEqual([]);
  expect(r.live, '★변형본에서 «살아 있는» 화면마저 틀렸다 — 그러면 이 대조는 저장 축을 안 겨눈다').toEqual(P1_TABLE);
  expect(r.after, '★JS 속성에 둔 판인데 왕복 뒤에도 같다 — P6 은 저장 축을 안 잰다').not.toEqual(P1_TABLE);
});

test('N6 ★음성대조 — 선 자리 갈래를 «키 없음»에도 태우면 P7(바이트 무변)·P0 이 빨개진다', async ({ page }) => {
  const errs = await boot(page, mut(GB, '  if (bd.edges) return _gridCellEdgesCss(bd, line, r, c);', '  return _gridCellEdgesCss({ ...bd, edges: bd.edges || [] }, line, r, c);'));
  const st = await page.evaluate(() => {
    const HOST = document.getElementById('host'); HOST.innerHTML = '';
    const { row, block } = window.__mk({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }], rows: [{ height: 'auto' }, { height: 'auto' }] });
    HOST.appendChild(row);
    window.updateGridBlock(block.id, { gap: 0 });
    window.updateGridBlock(block.id, { cellBorderWidth: 1, cellBorderColor: '#333333', cellBorderStyle: 'solid' });
    return block.querySelector('.grd-cell[data-r="1"][data-c="1"]').getAttribute('style');
  });
  expect(errs).toEqual([]);
  expect(st, '★키 없는 그리드가 옛 네 변 식을 잃지 않았다 — P7 이 이 갈래를 안 문다').not.toContain('border-right:1px solid #333333');
});

test('N7 ★음성대조 — 프리셋이 테두리 네 키를 안 실으면 P1 이 빨개진다', async ({ page }) => {
  const errs = await boot(page, mut(IF, '    ...P.border, ifgPreset: presetKey,', '    ifgPreset: presetKey,'));
  const s = await page.evaluate(() => window.__screen(window.__lines().block));
  expect(errs).toEqual([]);
  expect(s['00.T'], '★네 키를 뺐는데 위 변이 있다 — P1 이 데이터 경로를 안 잰다').toBe(OFF);
});

test('N8 ★음성대조 — 프로토 방식(CSS 고정 선 · 데이터 0)이면 선은 «보이는데» 패널에 손잡이가 없다(현빈 지적 재현)', async ({ page }) => {
  const PROTO_CSS = '.grid-block[data-ifg-preset=\\"lines\\"] .grd-cell{border-top:1px solid #b3b1ae}'
    + '.grid-block[data-ifg-preset=\\"lines\\"] .grd-cell:not([data-c=\\"0\\"]){border-left:1px solid #b3b1ae}';
  const m1 = mut(IF, '    ...P.border, ifgPreset: presetKey,', '    ifgPreset: presetKey,');
  const m2 = (src, p) => (p === IF ? src + `\ndocument.head.insertAdjacentHTML('beforeend', "<style>${PROTO_CSS}</style>");\n` : src);
  const errs = await boot(page, (src, p) => m2(m1(src, p), p));
  const r = await page.evaluate(() => { const x = window.__lines(); return { s: window.__screen(x.block), p: window.__panel() }; });
  expect(errs).toEqual([]);
  expect([r.s['00.T'], r.s['01.L']], '★전제: 프로토 CSS 선이 안 보인다 — 이 대조는 「보이는데 못 고친다」를 못 만든다').toEqual([LINE, LINE]);
  expect([r.p.top, r.p.vsep, r.p.modeLines], '★CSS 고정 판인데 패널에 선 자리 손잡이가 있다 — P1 의 패널 단언이 그 차이를 안 문다').toEqual([null, null, null]);
});

/* 이벨 D-1(6ab24cdf) — [위 변]/[칸 사이] 단추는 켜짐·꺼짐의 계산 스타일이 같았다(.prop-btn-sm 에 .active 꼴 없음).
   눌러서 선이 사라졌는데 단추는 그대로라 «지금 켜져 있나»를 못 읽었다. 켜짐 = 바로 위 「구분선」(눌린 prop-type-btn)과 같은 바탕, 꺼짐 = 다른 바탕. */
test('P11 ★[위 변] 단추 상태가 «보인다» — 켜짐 바탕 = 눌린 「구분선」 단추 바탕 · 끄면 바뀐다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.__lines(); });
  const bg = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).backgroundColor : null; }, sel);
  const TOP = '#grd-border-edges [data-edge="top"]';
  const MODE_ON = '#grd-border-edges-mode [data-edges-mode="lines"]';
  expect(await page.evaluate(() => window.__panel().top), '★전제: [위 변] 이 켜져 있다').toBe('true');
  const pressed = await bg(MODE_ON);
  expect(pressed, '★전제: 눌린 「구분선」 단추가 있다').toBeTruthy();
  const onBg = await bg(TOP);
  expect(onBg, '켜짐 = 눌린 단추와 같은 바탕').toBe(pressed);
  await page.click(TOP);
  await expect.poll(() => page.evaluate(() => window.__panel().top)).toBe('false');
  const offBg = await bg(TOP);
  expect(offBg, `꺼짐 바탕 ${offBg} 이 켜짐 ${onBg} 과 달라야 한다`).not.toBe(onBg);
  expect(errs).toEqual([]);
});
