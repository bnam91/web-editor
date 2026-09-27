/* grid-row0-save-undo.dom.spec.js — T-178 이 «저장 포맷»을 바꾸므로 그 두 축을 잠근다.
 * (2026-09-23 · 기준 f724dc1)
 *
 *   R — 저장 → 불러오기 왕복. ★이게 제일 급하다: 깨지면 «사용자 작업이 사라진다».
 *   U — undo/redo. 행 0 꾸밈을 패치한 뒤 ⌘Z 한 번에 되돌아가는가.
 *
 * ★재는 «양» — ⛔「같은 객체인가」가 아니라 «다시 그린 화면이 같은가»다.
 *   칸마다 계산된 CSS(배경·패딩·모서리·세로정렬)와 줄의 text-align, 그리고 글자를 견준다.
 *   객체 비교는 포맷이 바뀌면 당연히 달라진다 — 그건 이 축의 질문이 아니다.
 *
 * ★R 은 «두 갈래»로 잰다. 둘이 갈리면 그 자체가 결함이다.
 *   R1 dataset 왕복  — dataset 을 떠서 «새 블록»에 도로 넣고 renderGridBlock.
 *   R2 HTML 왕복     — outerHTML 을 떠서 도로 심는다(저장본이 실제로 담는 것).
 *      ★R2 는 한 번 더 가른다: 「심자마자 보이는 화면」(= 연 직후) vs 「다시 그린 화면」
 *        (= 첫 조작 뒤). 이 둘이 다르면 사용자는 «건드리는 순간 모양이 바뀌는» 것을 본다.
 *        포맷을 바꾸면 정확히 여기가 갈린다 — getGridModel 이 새 자리를 안 읽으면
 *        저장된 픽셀은 맞는데 다시 그리면 꾸밈이 사라진다.
 *
 * ★U 는 «진짜» js/history.js 를 얹는다 — 하네스를 새로 발명하지 않는다.
 *   골격은 tests/dom/resize-undo-history.dom.spec.js 를 그대로 베꼈다(같은 스텁 목록).
 *   ⚠️그 스펙과 «같은 한계»를 진다: `getSerializedCanvas` 를 raw `canvas.innerHTML` 로 둔다
 *     (실제 앱은 serializeCleanRoot 세척을 한 번 더 거친다). 세척이 dataset 을 건드리면
 *     이 그물은 그것을 «못» 본다 — R2 가 그 반쪽을 따로 받친다.
 *   ⛔이 레포에서 undo 는 전수 4,083건이 ⌘Z 전면 무동작을 «한 건도» 못 잡은 전력이 있다.
 *     그래서 U1 은 「⌘Z 한 번으로 «화면»이 돌아왔나」를 재지, 「historyPos 가 줄었나」를
 *     재지 않는다 — 뒤엣것은 아무것도 안 그려도 참이 된다.
 *
 * ⛔앱을 «안» 띄운다. 제품 변경 0.
 * 실행: npm run test:dom -- grid-row0-save-undo
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
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<script src="/js/design-system.js"></script>
<script type="module">
  import '/js/globals.js';
  import '/js/history.js';
  import { makeGridBlock, renderGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  /* ── history.js 가 기대하는 바깥 세계(최소) — resize-undo-history.dom.spec.js 와 같은 목록 ── */
  const canvas = document.getElementById('canvas');
  window.getSerializedCanvas = () => canvas.innerHTML;
  window.getLastVideoPendingSidecar = () => null;
  window.rebindAll = () => {};
  window.deselectAll = () => {};
  window.applyPageSettings = () => {};
  window.buildLayerPanel = () => {};
  window.scheduleAutoSave = () => {};
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__ready = true;
</script></body></html>`;

const SENTINEL = 'T178-SAVE-c91e';
const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 2, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'h2', text: SENTINEL }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ],
};

/* 「쓸 만큼 다 쓴」 판 — 한 축만 담으면 왕복이 반쪽만 증명된다.
   ⛔행 0 «칸» 꾸밈과 열 기본값을 «둘 다» 건다. 포맷 변경이 노리는 자리가 그 둘의 분리다. */
const SCENARIO = [
  { valign: 'middle' },                                                   // 블록
  { rowGap: 8, colGap: 40 },                                              // 간격
  { patchCol: { index: 0, bg: '#0a7d3b', padding: 12, radius: 6, align: 'right' } },   // 열 기본값
  { patchCell: { r: 0, c: 0, bg: '#7b2ff7', padding: 24, radius: 18, align: 'center', valign: 'bottom' } }, // 행 0 «칸»
  { patchCell: { r: 1, c: 1, bg: '#c02040', padding: 4 } },               // 행 1 칸
  /* ★행 1 «0열» 칸에도 자기 색을 준다 — 이 칸은 열 0 의 기본값을 «이겨야» 한다.
     ⛔이게 없으면 네 칸 중 둘(0행0열·1행0열)이 기준 커밋에서 «같은 색»이 되어(= T-178 그 자체)
       계측기 검사가 병에 오염된다. 이 칸에 자기 값을 주면 고치기 «전에도 뒤에도» 넷이 다르다. */
  { patchCell: { r: 1, c: 0, bg: '#1050c0', padding: 30 } },
];

async function boot(page) {
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
  await page.evaluate(([fx, sc]) => { window.__FIX = fx; window.__SC = sc; }, [FIXTURE, SCENARIO]);
  return errs;
}

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
      out[`${t}.bg`] = cs.backgroundColor;
      out[`${t}.pad`] = cs.paddingTop + '/' + cs.paddingLeft;
      out[`${t}.radius`] = cs.borderTopLeftRadius;
      out[`${t}.justify`] = cs.justifyContent;
      const ln = el.querySelector('[data-line]');
      out[`${t}.align`] = ln ? getComputedStyle(ln).textAlign : '(no-line)';
      out[`${t}.text`] = (el.innerText || '').trim();
    }
    const inner = block.querySelector('.grd-inner');
    if (inner) {
      const ics = getComputedStyle(inner);
      out['inner.cols'] = ics.gridTemplateColumns;
      out['inner.rows'] = ics.gridTemplateRows;
      out['inner.rowGap'] = ics.rowGap;
      out['inner.colGap'] = ics.columnGap;
    } else out['inner.MISSING'] = '1';
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

/* ══════════════════════════════════════════════════════════════════════
 * R0 — 계측기. 시나리오가 «실제로» 화면을 만들었나.
 * ════════════════════════════════════════════════════════════════════ */

test('R0 ★계측기 — 시나리오가 네 칸에 서로 다른 화면을 만든다(재는 자가 살아 있다)', async ({ page }) => {
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
  /* 네 칸이 «서로» 달라야 「어느 칸이 틀어졌나」를 가른다. ⛔배경색으로만 가르면
     기준 커밋에서 T-178 때문에 두 칸이 겹쳐 이 계측기가 병에 오염된다 — 글자로도 같이 가른다. */
  const bgs = ['00', '01', '10', '11'].map(t => r.full[`${t}.bg`]);
  expect(new Set(bgs).size, `★칸 배경이 겹친다(${JSON.stringify(bgs)}) — 왕복이 틀어져도 못 잡는다`).toBe(4);
  const txt = ['00', '01', '10', '11'].map(t => r.full[`${t}.text`]);
  expect(new Set(txt).size, `★칸 글자가 겹친다(${JSON.stringify(txt)})`).toBe(4);
  expect(r.full['00.text'], '★표지 글자가 화면에 없다').toBe(SENTINEL);
  expect(Object.keys(r.bare).length, '★맨 처음 화면을 못 읽었다').toBeGreaterThan(5);
});

/* ══════════════════════════════════════════════════════════════════════
 * R1 — dataset 왕복. 새 블록에 dataset 만 옮겨 담고 다시 그린다.
 * ════════════════════════════════════════════════════════════════════ */

test('R1 ★저장→불러오기(dataset) — 다시 그린 화면이 같다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    for (const p of window.__SC) window.updateGridBlock(block.id, p);
    const before = window.__screen(block);
    /* ★저장본이 담는 것 = dataset 전부. 키 이름을 손으로 안 적는다. */
    const saved = JSON.parse(JSON.stringify({ ...block.dataset }));
    /* ★불러오기 — «새» 블록을 만들고 dataset 을 통째로 갈아 끼운다(남은 키가 없게 먼저 비운다). */
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
    '★dataset 을 그대로 옮겨 다시 그렸는데 «화면»이 달라졌다 — 저장하면 모양이 바뀐다는 뜻이다.\n' +
    `   저장된 키: ${r.savedKeys.join(' · ')}\n` + fmt(d)).toEqual({});
});

/* ══════════════════════════════════════════════════════════════════════
 * R2 — HTML 왕복. 저장본이 «실제로» 담는 것.
 *   ★「심자마자」와 「다시 그린 뒤」를 «따로» 잰다.
 * ════════════════════════════════════════════════════════════════════ */

test('R2-a ★저장→불러오기(HTML) — 심자마자 보이는 화면이 같다(연 직후)', async ({ page }) => {
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
    const re = HOST.querySelector('.grid-block');
    return { before, after: window.__screen(re), htmlLen: html.length };
  }, INSTALL_MEASURE.toString());
  expect(errs).toEqual([]);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [r.before, r.after]);
  expect(d, '★저장본 HTML 을 도로 심었더니 화면이 달라졌다 — 연 직후부터 모양이 다르다.\n' + fmt(d)).toEqual({});
});

test('R2-b ★★저장본을 «다시 그려도» 같다 — 건드리는 순간 모양이 바뀌면 안 된다', async ({ page }) => {
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
    '★저장본을 열자마자 보이던 화면과 «다시 그린» 화면이 다르다.\n' +
    '   사용자는 블록을 건드리는 순간 모양이 바뀌는 것을 본다 — 저장된 픽셀은 맞는데\n' +
    '   getGridModel 이 그 값을 «새 자리에서» 못 읽는다는 뜻이다.\n' + fmt(d1)).toEqual({});
  const d2 = await page.evaluate(([a, b]) => window.__diff(a, b), [r.before, r.redrawn]);
  expect(d2, '★왕복 뒤 다시 그린 화면이 원본과 다르다.\n' + fmt(d2)).toEqual({});
});

/* ══════════════════════════════════════════════════════════════════════
 * U — undo/redo. ★«진짜» js/history.js 로 돈다.
 * ════════════════════════════════════════════════════════════════════ */

/** 판을 깔고(블록 삽입 + 시나리오까지 커밋) 행 0 칸 꾸밈 한 번 → ⌘Z → ⌘⇧Z. */
async function runUndo(page, patch) {
  return page.evaluate(({ install, patch }) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    const ID = block.id;
    window.pushHistory('그리드 추가');
    /* 판 — 열 기본값·블록값까지 깔아 둔다(왕복 때 같이 살아야 한다). */
    for (const p of [{ valign: 'middle' }, { patchCol: { index: 0, bg: '#0a7d3b', padding: 12, align: 'right' } }]) {
      window.updateGridBlock(ID, p);
    }
    const live = () => document.getElementById(ID);
    const s0 = window.__screen(live());
    const pos0 = window.historyPos;
    const res = window.updateGridBlock(ID, { patchCell: { r: 0, c: 0, ...patch } });
    const s1 = window.__screen(live());
    const pos1 = window.historyPos;
    window.undo();
    const sU = window.__screen(live());
    const aliveU = !!live();
    const posU = window.historyPos;
    window.redo();
    const sR = window.__screen(live());
    return { ok: !!(res && res.ok), code: res && res.code, message: res && res.message,
      s0, s1, sU, sR, aliveU, pos0, pos1, posU };
  }, { install: INSTALL_MEASURE.toString(), patch });
}

const UNDO_PATCH = { bg: '#7b2ff7', padding: 24, radius: 18, align: 'center', valign: 'bottom' };

test('U0 ★계측기 — 행 0 칸 패치가 «화면»을 실제로 바꾼다(그래야 되돌릴 것이 있다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await runUndo(page, UNDO_PATCH);
  expect(errs).toEqual([]);
  expect(r.ok, `patchCell{r:0} 이 실패했다 — ${r.code}: ${r.message}`).toBe(true);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [r.s0, r.s1]);
  expect(Object.keys(d).length, '★패치가 화면을 하나도 안 바꿨다 — 되돌릴 것이 없으니 U1 은 공짜 초록이다').toBeGreaterThan(0);
  expect(r.pos1, `★pushHistory 가 «안» 불렸다(historyPos ${r.pos0} → ${r.pos1}) — updateGridBlock 의 push-before 규약이 끊겼다`).toBe(r.pos0 + 1);
});

test('U1 ★★⌘Z 한 번에 «화면»이 패치 직전으로 돌아온다', async ({ page }) => {
  const errs = await boot(page);
  const r = await runUndo(page, UNDO_PATCH);
  expect(errs).toEqual([]);
  expect(r.aliveU, '★⌘Z 뒤 블록이 통째로 사라졌다 — 되돌리기가 «한 칸 더» 먹었다').toBe(true);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [r.s0, r.sU]);
  expect(d,
    '★⌘Z 한 번으로 화면이 패치 직전으로 «안» 돌아왔다.\n' +
    '   ⛔historyPos 가 줄었는지는 안 본다 — 아무것도 안 그려도 그건 참이 된다.\n' +
    `   historyPos: ${r.pos0} →(패치) ${r.pos1} →(⌘Z) ${r.posU}\n` + fmt(d)).toEqual({});
});

test('U2 ★⌘⇧Z 로 다시 패치 상태가 된다(왕복이 닫힌다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await runUndo(page, UNDO_PATCH);
  expect(errs).toEqual([]);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [r.s1, r.sR]);
  expect(d, '★redo 뒤 화면이 패치 직후와 다르다 — 되돌리기 왕복이 안 닫힌다.\n' + fmt(d)).toEqual({});
});

test('U3 ★음성대조 — ⌘Z 를 «안» 하면 화면은 패치 상태 그대로다(U1 이 공짜 초록이 아니다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((install) => {
    eval('(' + install + ')()');
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    const ID = block.id;
    window.pushHistory('그리드 추가');
    window.updateGridBlock(ID, { valign: 'middle' });
    window.updateGridBlock(ID, { patchCol: { index: 0, bg: '#0a7d3b', padding: 12, align: 'right' } });
    const s0 = window.__screen(document.getElementById(ID));
    window.updateGridBlock(ID, { patchCell: { r: 0, c: 0, bg: '#7b2ff7', padding: 24, radius: 18, align: 'center', valign: 'bottom' } });
    return { s0, s1: window.__screen(document.getElementById(ID)) };
  }, INSTALL_MEASURE.toString());
  expect(errs).toEqual([]);
  const d = await page.evaluate(([a, b]) => window.__diff(a, b), [r.s0, r.s1]);
  expect(Object.keys(d).length,
    '★⌘Z 를 안 했는데도 화면이 패치 전과 같다 — U1 의 초록은 헛것이다(계측기가 둘을 못 가른다)').toBeGreaterThan(0);
});
