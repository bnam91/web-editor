/* grid-picker-row0-lines.dom.spec.js — T-178 불변식의 «다섯째 새는 길»: 우측 패널의 4×4 피커.
 *
 * ★왜 따로 서 있나
 *   나머지 네 길(정규화 · patchCell{r:0,lines} · cells 통째 · MCP 되받아쓰기)은
 *   tests/unit/grid-row0-lines-invariant.test.js 가 Node 에서 잰다. 피커는 «패널 DOM»이라
 *   거기서 못 잰다. ⛔그 파일에서 「피커도 쟀다」고 «흉내»를 내면 검사처럼 생긴 문장이 된다.
 *   ⇒ 진짜 피커 칸을 «눌러» 재는 자리는 여기다.
 *
 * ★재는 «양»
 *   피커로 행을 늘리고/줄인 «뒤» dataset.cells 문자열에 `cells[0][*].lines` 키가 있나.
 *   ⛔「어느 함수를 지났나」가 아니라 «저장본이 어떻게 생겼나»를 잰다 — 표시는 흉내낼 수
 *     있고 정체는 못 한다.
 *
 * ★같이 재는 것(반대 방향) — 「없앴다」가 「다 지웠다」로 통과하면 안 된다
 *   ⑴ 행 0 의 «줄 내용»은 화면에 그대로 있다(cols[].lines 가 갖는다)
 *   ⑵ 행 «인덱스»가 한 칸 밀리지 않았다 — 2행 내용이 3행으로 이사하면 화면은 멀쩡해 보이는데
 *     데이터가 손상된 것이다(이 커밋이 읽는 문과 피커를 «같은 커밋»에 옮긴 까닭).
 *   ⑶ 행 0 «칸 꾸밈»은 행을 1로 줄였다 늘려도 살아 있다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   하네스 골격은 tests/dom/grid-cell-panel-handles.dom.spec.js 를 그대로 베꼈다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-picker-row0-lines
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
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__update = updateGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__ready = true;
</script></body></html>`;

/* 표지 글자 — 레포 어디에도 없는 것. dataset 안에서 «몇 번» 나오는지를 셀 것이다. */
const S00 = 'PICK-R0C0-4e1b7a';
const S10 = 'PICK-R1C0-9d2f05';

const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: S00 }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: S10 }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ],
};

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
  await page.evaluate((fx) => { window.__FIX = fx; }, FIXTURE);
  return errs;
}

/** 블록을 세우고 패널을 연 뒤, 각본(script)을 차례로 실행한다.
 *  각본 항목 = [nCols, nRows] (피커 칸 클릭) 또는 { patch: {…updateGridBlock 인자} }. */
async function pick(page, script, prePatch) {
  return page.evaluate(([picks2, prePatch2]) => {
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    document.querySelector('#panel-right .panel-body').innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    block.classList.add('selected');
    if (prePatch2) window.__update(block.id, JSON.parse(JSON.stringify(prePatch2)));
    window.__open(block);

    const steps = [];
    for (const step of picks2) {
      if (!Array.isArray(step)) {
        const res = window.__update(block.id, JSON.parse(JSON.stringify(step.patch)));
        steps.push({ pick: `patch ${JSON.stringify(step.patch)}`, found: !!(res && res.ok),
          cells: block.dataset.cells ?? '(unset)', rows: block.dataset.rows ?? '(unset)' });
        continue;
      }
      const [c, r] = step;
      const cellEl = document.querySelector(`#grd-grid-picker .grid-picker-cell[data-r="${r}"][data-c="${c}"]`);
      if (!cellEl) { steps.push({ pick: `${c}x${r}`, found: false }); continue; }
      cellEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      steps.push({ pick: `${c}x${r}`, found: true, cells: block.dataset.cells ?? '(unset)', rows: block.dataset.rows ?? '(unset)' });
    }

    /* 저장본에서 «행 0 에 lines 키가 있나»를 정체로 잰다. */
    const raw = block.dataset.cells;
    const hits = [];
    if (raw !== undefined) {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { hits.push('PARSE_ERROR: ' + e.message); }
      const row0 = (parsed && Array.isArray(parsed[0])) ? parsed[0] : [];
      row0.forEach((cell, c) => {
        if (cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'lines')) {
          hits.push(`cells[0][${c}].lines = ${JSON.stringify(cell.lines)}`);
        }
      });
    }
    /* dataset 전체에서 표지 글자가 «몇 번» / «어느 키»에 있나 — 키 이름을 안 박는다. */
    const countIn = (needle) => {
      const per = {}; let n = 0;
      for (const [k, v] of Object.entries(block.dataset)) {
        const s = String(v == null ? '' : v);
        let i = 0, c = 0;
        for (;;) { const j = s.indexOf(needle, i); if (j < 0) break; c++; i = j + needle.length; }
        if (c) per[k] = c; n += c;
      }
      return { n, per };
    };
    const model = window.__model(block);
    const textAt = (r, c) => {
      const el = block.querySelector(`.grd-cell[data-r="${r}"][data-c="${c}"]`);
      return el ? (el.innerText || '').trim() : '(no-cell)';
    };
    return {
      steps, hits,
      ds: { cols: block.dataset.cols || '', cells: raw ?? '(unset)', rows: block.dataset.rows ?? '(unset)' },
      s00: countIn(S_00), s10: countIn(S_10),
      rowsLen: model.rows.length,
      text00: textAt(0, 0), text10: textAt(1, 0), text20: textAt(2, 0), text30: textAt(3, 0),
      bg00: (model.cells[0] && model.cells[0][0] || {}).bg ?? null,
    };
  }, [script, prePatch || null]);
}

/* page.evaluate 안에서 쓸 표지 글자를 페이지 쪽에 심는다(문자열 리터럴 중복을 피한다). */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(([a, b]) => { window.S_00 = a; window.S_10 = b; }, [S00, S10]);
});

test('P0 ★계측기 — 피커 칸이 실제로 눌리고, 누르기 전 픽스처가 2행이다', async ({ page }) => {
  const errs = await boot(page);
  const r = await pick(page, [[2, 2]]);
  expect(errs, '페이지 오류가 났다 — 아래 측정은 전부 헛것이다').toEqual([]);
  expect(r.steps.map(s => s.found), '★피커 칸을 못 찾았다 — 패널이 안 열렸거나 선택자가 죽었다').toEqual([true]);
  expect(r.rowsLen, '★2×2 를 눌렀는데 2행이 아니다').toBe(2);
  expect(r.text00, '★행 0 0열의 글자가 화면에 없다').toBe(S00);
});

test('P1 ★★행을 늘려도 dataset.cells[0][*] 에 lines 키가 «하나도» 없다 (새는 길 ④ — 피커)', async ({ page }) => {
  const errs = await boot(page);
  const r = await pick(page, [[2, 3], [2, 4]]);   // 2행 → 3행 → 4행
  expect(errs).toEqual([]);
  expect(r.hits,
    '★피커로 행을 늘렸더니 행 0 칸에 `lines` 키가 생겼다 — 행 0 줄 내용이 cols 와 cells 두 군데에 앉는다.\n' +
    `   dataset.cells = ${r.ds.cells}`).toEqual([]);
  expect(r.s00.n,
    `★행 0 줄 내용이 dataset 안에 ${r.s00.n} 번 있다 — ${JSON.stringify(r.s00.per)}`).toBe(1);
  expect(Object.keys(r.s00.per), '★행 0 줄 내용이 dataset.cols 가 아닌 곳에 있다').toEqual(['cols']);
});

/* ★P2 는 «줄였다» 늘리는 각본이다 — 늘리기만으로는 인덱스 어긋남이 «안 보인다».
 *   실측(2026-09-23): 피커 루프를 옛 인덱스(`for r=1 … curCells[r-1]`)로 되돌려 봤더니
 *   «늘리기»에서는 4개 검사가 그대로 초록이었다. 까닭 — 옛 루프는 새 포맷 위에서
 *   nextCells[i] = curCells[i] 가 되어 인덱스는 맞고 «마지막 행 하나»만 떨어뜨리는데,
 *   늘릴 때 그 마지막 행은 어차피 비어 있(거나 기본 내용이)다.
 *   ⇒ 가르는 자리는 «줄일 때»다: 남겨야 할 마지막 행에 내용이 있는 채로 줄여야 한다.
 *   ⛔이 문단을 지우지 마라 — 「늘리기로도 충분하다」는 판단이 실제로 틀렸던 기록이다. */
test('P2 ★★행이 «한 칸 밀리지» 않았다 — 4행으로 늘렸다 2행으로 줄여도 1행 내용이 산다', async ({ page }) => {
  const errs = await boot(page);
  const r = await pick(page, [
    [2, 4],                                   // 2행 → 4행
    { patch: { patchCell: { r: 3, c: 0, lines: [{ type: 'body', text: 'ROW3' }] } } },
    [2, 2],                                   // 4행 → 2행 (1행 내용은 살아야 한다)
  ]);
  expect(errs).toEqual([]);
  expect(r.steps.map(s => s.found), `각본이 끝까지 안 돌았다 — ${JSON.stringify(r.steps)}`).toEqual([true, true, true]);
  expect(r.rowsLen).toBe(2);
  expect(r.text00, '★행 0 의 글자가 바뀌었다').toBe(S00);
  expect(r.text10,
    '★★1행 내용이 «1행에» 없다 — 읽는 문(_gridCellRows)과 피커의 인덱스가 어긋났다.\n' +
    '   화면은 멀쩡해 보이는데 행이 통째로 한 칸 이사한 «데이터 손상»이다.\n' +
    `   단계별 dataset.cells: ${JSON.stringify(r.steps.map(s => s.cells))}`).toBe(S10);
  expect(r.s10.n, `★1행 내용이 dataset 안에 ${r.s10.n} 번 있다 — ${JSON.stringify(r.s10.per)}`).toBe(1);
  expect(r.hits, '★그 와중에 행 0 칸에 lines 키가 생겼다').toEqual([]);
});

test('P2-b ★늘리기만 해도 인덱스는 안 밀린다 (P2 의 짝 — 이쪽은 «잣대»다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await pick(page, [[2, 4]]);
  expect(errs).toEqual([]);
  expect(r.rowsLen).toBe(4);
  expect(r.text00).toBe(S00);
  expect(r.text10, `★늘리기에서 1행 내용이 밀렸다 — dataset.cells = ${r.ds.cells}`).toBe(S10);
});

test('P3 ★1행으로 줄였다 늘려도 «행 0 칸 꾸밈»은 살아 있다', async ({ page }) => {
  const errs = await boot(page);
  // 먼저 행 0 «칸»에 배경을 준다 → 1행으로 줄임 → 다시 2행.
  const r = await pick(page, [[2, 1], [2, 2]], { patchCell: { r: 0, c: 0, bg: '#7b2ff7' } });
  expect(errs).toEqual([]);
  expect(r.steps.map(s => s.found)).toEqual([true, true]);
  expect(r.bg00,
    '★행 0 칸에 준 꾸밈이 행 수를 줄였다 늘리는 사이 사라졌다.\n' +
    `   단계별 dataset.cells: ${JSON.stringify(r.steps.map(s => s.cells))}`).toBe('#7b2ff7');
  expect(r.hits, '★그 와중에 행 0 칸에 lines 키가 생겼다').toEqual([]);
  expect(r.text00, '★행 0 의 줄 내용이 사라졌다').toBe(S00);
});
