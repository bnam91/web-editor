/* grid-row0-cell-style.dom.spec.js — T-178 의 그물.
 * (2026-09-23 · 기준 커밋 6429cec)
 *
 * ★재는 «양»
 *   「그리드 «맨 윗줄(행 0)» 칸 하나에 준 꾸밈이 그 칸에만 머무는가」.
 *   꾸밈 = bg · padding · radius · align · valign (GRID_CELL_FIELDS 에서 lines 를 뺀 것).
 *
 * ★병 (기준 커밋에서 살아 있는 것)
 *   행 0 은 «열 그 자체»다 — dataset.cols[c] 가 열 가중치 + 행 0 콘텐츠를 겸한다.
 *   그래서 patchCell{r:0,c,bg} 는 cols[c].bg 에 쓰이고, 렌더러 폴백
 *   `pick = (k) => (cell[k] !== undefined ? cell[k] : col[k])` 때문에 «자기 값이 없는
 *   아래 행 칸»이 그것을 물려받는다. ★더 고약한 쪽: 아래 행 칸의 «모델»은 null 인 채
 *   «화면»만 칠해진다.
 *
 * ★고칠 «방향»(팀리드 확정 2026-09-23 — 이 그물이 전제하는 것)
 *   ⑴ 줄 내용의 단일 진실원은 «그대로» — 행 0 의 lines 는 cols[c].lines «하나»뿐이다.
 *   ⑵ cols[c] 의 꾸밈 5개 = 「그 열 전체의 기본값」 — 살아 있어야 한다(유용한 기능).
 *   ⑶ 행 0 «칸 하나»의 꾸밈은 cells[0][c] 에 «따로» 저장된다(지금은 저장할 자리가 없다).
 *   ⑷ 렌더러 폴백 cell[k] ?? col[k] 는 «그대로» 둔다.
 *   ⇒ 저장 포맷이 바뀐다(dataset.cells 가 행 0 도 담는다). 마이그레이션은 범위 밖
 *     (현빈 승인 — 기존 저장본 무시).
 *
 * ★가른 축 (한 검사 = 한 축. 빨강이 뭉뚱그려지면 무엇이 고쳐졌는지 못 읽는다)
 *   0a 계측기 — 픽스처가 «두 답이 겹치지 않는» 2행 2열인가
 *   0b 음성대조 — 상관없는 조작(gap)엔 꾸밈 축이 «하나도» 안 움직인다
 *   0c 양성대조 — 행 1 칸에 주면 «그 칸만» 움직인다(자가 살아 있다)
 *   1a 준 칸(0,0)은 변한다                            [기준 커밋: 초록]
 *   1b 같은 열 아래 행(1,0)의 «화면»은 안 변한다       [기준 커밋: ★빨강]
 *   1c 다른 열 아래 행(1,1)은 안 변한다                [기준 커밋: 초록 — 잣대]
 *   1d 같은 행 다른 열(0,1)은 안 변한다                [기준 커밋: 초록 — 잣대]
 *   2a 열 기본값은 산다 — patchCol 은 그 열 «모든 행»을 칠한다 [기준 커밋: 초록, ★죽이면 기능 상실]
 *   2b patchCol → patchCell{r:0} 순서: 칸 값이 «그 칸만» 덮는다  [기준 커밋: ★빨강]
 *   2c patchCell{r:0} → patchCol 순서: 칸 값이 «살아남는다»      [기준 커밋: ★빨강]
 *   3  모델·화면 일치 — 「화면만 칠해지는」 칸이 0개다            [기준 커밋: ★빨강]
 *   4a 행 0 «줄 내용»은 여전히 cols[c].lines 하나뿐(꾸밈 patch 뒤) [기준 커밋: 초록 — 불변식]
 *   4b 행 0 «줄 내용»은 여전히 cols[c].lines 하나뿐(내용 patch 뒤) [기준 커밋: 초록 — 불변식]
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   하네스 골격은 tests/dom/grid-cell-panel-handles.dom.spec.js 를 그대로 베꼈다.
 *
 * 실행: npm run test:dom -- grid-row0-cell-style
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
  import { makeGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  window.__mk = makeGridBlock;
  window.__model = getGridModel;
  window.__ready = true;
</script></body></html>`;

/* ★픽스처 — «최소 2행 2열». 1행짜리로는 「아래 행이 안 변한다」를 «못» 잰다(두 답이 겹친다).
   네 칸의 글자를 전부 다르게 둔다 — 어느 칸을 보고 있는지 헷갈리면 잣대가 흐려진다.
   SENTINEL 은 dataset 안에서 «몇 번» 나오는지를 셀 것이므로 레포 어디에도 없는 글자로 쓴다. */
const SENTINEL = 'T178-R0C0-a7f3d1';
const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: SENTINEL }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ],
};

/* 주는 값 — 기본값과 «확실히» 다른 것만. 기본과 같은 값을 주면 Δ 가 0 이라 검사가 헛돈다. */
const CELL_BG = '#7b2ff7';      // rgb(123, 47, 247)
const CELL_PAD = 24;
const CELL_RAD = 18;
const COL_BG = '#0a7d3b';       // rgb(10, 125, 59)

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
  await page.evaluate(([fx, sent]) => { window.__FIX = fx; window.__SENT = sent; }, [FIXTURE, SENTINEL]);
  return errs;
}

/* ══ 한 번의 실측 ═══════════════════════════════════════════════════════
 * ops = [ {…updateGridBlock 인자} … ] 를 «차례로» 준다.
 * 돌려주는 것: before/after 스냅샷 전부 + 조작별 ok — ⛔「뒤」만 재지 않는다.
 * ════════════════════════════════════════════════════════════════════ */
async function run(page, ops) {
  return page.evaluate((ops2) => {
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);

    const RC = [[0, 0], [0, 1], [1, 0], [1, 1]];
    const DECOR = ['bg', 'padding', 'radius', 'align', 'valign'];

    function snap() {
      const out = {};
      let m = null;
      try { m = window.__model(block); } catch (e) { out['model.ERR'] = String(e && e.message); }
      for (const [r, c] of RC) {
        const t = `${r}${c}`;
        const el = block.querySelector(`.grd-cell[data-r="${r}"][data-c="${c}"]`);
        if (!el) { out[`css.${t}.MISSING`] = '1'; } else {
          const cs = getComputedStyle(el);
          out[`css.${t}.bg`] = cs.backgroundColor;
          out[`css.${t}.padTop`] = cs.paddingTop;
          out[`css.${t}.padLeft`] = cs.paddingLeft;
          out[`css.${t}.radius`] = cs.borderTopLeftRadius;
          out[`css.${t}.justify`] = cs.justifyContent;
          const ln = el.querySelector('[data-line]');
          out[`css.${t}.textAlign`] = ln ? getComputedStyle(ln).textAlign : '(no-line)';
          out[`css.${t}.text`] = (el.innerText || '').trim();
        }
        const cell = (m && m.cells && m.cells[r] && m.cells[r][c]) || {};
        for (const k of DECOR) out[`model.${t}.${k}`] = JSON.stringify(cell[k] === undefined ? null : cell[k]);
        out[`model.${t}.lineText`] = JSON.stringify(
          (Array.isArray(cell.lines) ? cell.lines : []).map(l => (l && l.text) || '')
        );
      }
      /* ★음성대조 열 — 어떤 조작에도 절대 안 변한다. 여기가 «변했다»고 나오면 비교기가 고장난 것이다. */
      out['__never'] = 'CONSTANT';
      return out;
    }

    /** dataset 전체에서 어떤 글자가 «몇 번» 나오나 — 저장 포맷이 바뀌어도(키 이름이 무엇이든)
     *  「두 군데에 복제됐나」를 잰다. ⛔특정 키(cols/cells)를 이름으로 박으면 새 키로 도망간다. */
    function dsCount(needle) {
      let n = 0;
      const per = {};
      for (const [k, v] of Object.entries(block.dataset)) {
        const s = String(v == null ? '' : v);
        let i = 0, c = 0;
        for (;;) { const j = s.indexOf(needle, i); if (j < 0) break; c++; i = j + needle.length; }
        if (c) per[k] = c;
        n += c;
      }
      return { n, per };
    }

    const before = snap();
    const beforeDs = { cols: block.dataset.cols || '', cells: block.dataset.cells || '' };
    const results = [];
    for (const op of ops2) {
      const res = window.updateGridBlock(block.id, JSON.parse(JSON.stringify(op)));
      results.push({ ok: !!(res && res.ok), code: res && res.code, message: res && res.message });
    }
    const after = snap();

    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    const delta = {};
    for (const k of keys) if (before[k] !== after[k]) delta[k] = `${before[k]} → ${after[k]}`;

    return {
      results, before, after, delta,
      beforeDs,
      ds: { cols: block.dataset.cols || '', cells: block.dataset.cells || '', keys: Object.keys(block.dataset) },
      sentinel: dsCount(window.__SENT),
      dsCountOf: null,
      nCells: block.querySelectorAll('.grd-cell').length,
    };
  }, ops);
}

/** Δ 중 어떤 칸(tag)의 어떤 계열(css./model.)이 움직였나 — 키만 뽑는다. */
const dk = (delta, prefix) => Object.keys(delta).filter(k => k.startsWith(prefix)).sort();
/** 읽기 좋은 Δ 덤프. */
const dump = (delta, prefix) => dk(delta, prefix).map(k => `      ${k}: ${delta[k]}`).join('\n') || '      (없음)';
const allOk = (r) => r.results.every(x => x.ok);
const why = (r) => r.results.map((x, i) => `#${i} ok=${x.ok}${x.ok ? '' : ` ${x.code}: ${x.message}`}`).join(' / ');

/* ══════════════════════════════════════════════════════════════════════
 * 0 — 계측기 자체 점검. 본 측정 «앞»에 선다.
 * ════════════════════════════════════════════════════════════════════ */

test('T178-0a ★계측기 — 픽스처가 «2행 2열»이고 네 칸이 서로 구별된다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, [{ gap: 12 }]);
  expect(errs, '페이지 오류가 났다 — 아래 측정은 전부 헛것이다').toEqual([]);
  expect(r.nCells, '★칸이 4개가 아니다 — 1행짜리 픽스처로는 「아래 행이 안 변한다」를 못 잰다').toBe(4);
  const texts = ['00', '01', '10', '11'].map(t => r.before[`css.${t}.text`]);
  expect(new Set(texts).size,
    `★네 칸의 글자가 겹친다(${JSON.stringify(texts)}) — 어느 칸을 보고 있는지 흐려진다`).toBe(4);
  expect(r.before['css.00.text'], '★행 0 0열에 표지 글자가 안 들어갔다').toBe(SENTINEL);
  // 꾸밈은 전부 «기본값»에서 시작한다 — 시작부터 칠해져 있으면 Δ 가 뜻을 잃는다.
  for (const t of ['00', '01', '10', '11']) {
    expect(r.before[`css.${t}.bg`], `★${t} 칸이 처음부터 칠해져 있다`).toBe('rgba(0, 0, 0, 0)');
    expect(r.before[`css.${t}.padTop`], `★${t} 칸이 처음부터 패딩을 갖고 있다`).toBe('0px');
  }
});

test('T178-0b ★음성대조 — 상관없는 조작(gap)엔 꾸밈 축이 하나도 안 움직인다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, [{ gap: 33 }]);
  expect(errs).toEqual([]);
  expect(allOk(r), `gap 조작이 실패했다 — ${why(r)}`).toBe(true);
  const moved = [...dk(r.delta, 'css.'), ...dk(r.delta, 'model.')];
  expect(moved,
    '★상관없는 조작에 칸 꾸밈이 움직였다 — 이 계측기는 «아무것에나» 반응한다(거짓 빨강 공장).\n' +
    dump(r.delta, '')).toEqual([]);
  expect(r.delta['__never'], '★절대 안 변하는 열이 변했다 — 비교기가 고장났다').toBeUndefined();
});

test('T178-0c ★양성대조 — «행 1» 칸에 주면 그 칸만 변한다 (자가 살아 있다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, [{ patchCell: { r: 1, c: 0, bg: CELL_BG, padding: CELL_PAD, radius: CELL_RAD } }]);
  expect(errs).toEqual([]);
  expect(allOk(r), `patchCell{r:1} 이 실패했다 — ${why(r)}`).toBe(true);
  // 준 칸은 변했다.
  expect(r.after['css.10.bg']).toBe('rgb(123, 47, 247)');
  expect(r.after['css.10.padTop']).toBe('24px');
  expect(r.after['css.10.radius']).toBe('18px');
  // 나머지 «세» 칸은 css·model 어느 쪽도 안 변했다.
  const leaked = [...dk(r.delta, 'css.00'), ...dk(r.delta, 'css.01'), ...dk(r.delta, 'css.11'),
    ...dk(r.delta, 'model.00'), ...dk(r.delta, 'model.01'), ...dk(r.delta, 'model.11')];
  expect(leaked,
    '★행 1 칸에 준 값이 다른 칸으로 샜다 — 이 그물의 잣대가 죽었다(행 1 은 원래 칸별 저장이다).\n' +
    dump(r.delta, 'css.') + '\n' + dump(r.delta, 'model.')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
 * 1 — 본 단언. 0행 0열 «한 칸»에만 꾸밈을 준다.
 * ════════════════════════════════════════════════════════════════════ */

const ROW0_PATCH = [{ patchCell: { r: 0, c: 0, bg: CELL_BG, padding: CELL_PAD, radius: CELL_RAD } }];

test('T178-1a 준 칸(0행 0열)은 실제로 변한다 — 전제', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, ROW0_PATCH);
  expect(errs).toEqual([]);
  expect(allOk(r), `patchCell{r:0} 이 실패했다 — ${why(r)}`).toBe(true);
  expect(r.after['css.00.bg'], '★준 칸조차 안 변했다 — 아래 단언들이 전부 헛것이다').toBe('rgb(123, 47, 247)');
  expect(r.after['css.00.padTop']).toBe('24px');
  expect(r.after['css.00.radius']).toBe('18px');
  // 모델에도 근거가 남아야 한다 — 화면만 칠해지면 그것도 병이다(T178-3 의 반대 방향).
  expect(r.after['model.00.bg'], '★화면은 칠해졌는데 «모델»엔 근거가 없다').toBe(JSON.stringify(CELL_BG));
});

test('T178-1b ★★같은 열 «아래 행»(1행 0열)의 화면은 안 변한다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, ROW0_PATCH);
  expect(errs).toEqual([]);
  expect(allOk(r), `patchCell{r:0} 이 실패했다 — ${why(r)}`).toBe(true);
  expect(dk(r.delta, 'css.10'),
    '★0행 0열 «한 칸»에만 값을 줬는데 «1행 0열»의 화면이 따라 변했다 (T-178 본체).\n' +
    dump(r.delta, 'css.10') + '\n' +
    '   까닭: 행 0 = 열 그 자체(cols[c]) + 렌더러 폴백 cell[k] ?? col[k].\n' +
    '   ⇒ 행 0 칸의 꾸밈이 «칸» 자리(cells[0][c])에 저장되어야 한다.').toEqual([]);
});

test('T178-1c 다른 열 아래 행(1행 1열)은 안 변한다 — 잣대', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, ROW0_PATCH);
  expect(errs).toEqual([]);
  expect(dk(r.delta, 'css.11'),
    '★다른 «열»까지 변했다 — 이 그물의 잣대가 죽었다(0행 0열 patch 가 1열에 닿을 길이 없다).\n' +
    dump(r.delta, 'css.11')).toEqual([]);
  expect(dk(r.delta, 'model.11'), '★다른 열의 모델까지 변했다\n' + dump(r.delta, 'model.11')).toEqual([]);
});

test('T178-1d 같은 행 다른 열(0행 1열)은 안 변한다 — 잣대', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, ROW0_PATCH);
  expect(errs).toEqual([]);
  expect(dk(r.delta, 'css.01'),
    '★같은 행의 «다른 열»까지 변했다 — 칸 patch 가 행 통째로 샌다.\n' + dump(r.delta, 'css.01')).toEqual([]);
  expect(dk(r.delta, 'model.01'), '★같은 행 다른 열의 모델까지 변했다\n' + dump(r.delta, 'model.01')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
 * 2 — ★열 기본값이 «여전히 산다». 1b 만 고치고 여기가 죽으면 기능이 사라진 것이다.
 * ════════════════════════════════════════════════════════════════════ */

test('T178-2a ★★열 기본값은 산다 — patchCol 은 그 열 «모든 행»을 칠한다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, [{ patchCol: { index: 0, bg: COL_BG, padding: 12, radius: 6 } }]);
  expect(errs).toEqual([]);
  expect(allOk(r), `patchCol 이 실패했다 — ${why(r)}`).toBe(true);
  const GREEN = 'rgb(10, 125, 59)';
  expect(r.after['css.00.bg'],
    '★열 기본값이 «행 0» 에 안 닿는다 — 열 단위 꾸밈 기능이 죽었다').toBe(GREEN);
  expect(r.after['css.10.bg'],
    '★★열 기본값이 «행 1» 에 안 닿는다 — T-178 을 고치다 폴백(cell[k] ?? col[k])을 ' +
    '없애면 여기가 죽는다. 「열 전체 기본값」은 지켜야 할 기능이다').toBe(GREEN);
  expect(r.after['css.00.padTop']).toBe('12px');
  expect(r.after['css.10.padTop']).toBe('12px');
  expect(r.after['css.00.radius']).toBe('6px');
  expect(r.after['css.10.radius']).toBe('6px');
  // 그리고 «다른 열»은 안 물든다.
  expect([...dk(r.delta, 'css.01'), ...dk(r.delta, 'css.11')],
    '★열 0 에 준 값이 열 1 까지 칠했다\n' + dump(r.delta, 'css.01') + '\n' + dump(r.delta, 'css.11')).toEqual([]);
});

test('T178-2b ★patchCol 뒤 patchCell{r:0} — 칸 값은 «그 칸만» 덮는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, [
    { patchCol: { index: 0, bg: COL_BG } },
    { patchCell: { r: 0, c: 0, bg: CELL_BG } },
  ]);
  expect(errs).toEqual([]);
  expect(allOk(r), `조작이 실패했다 — ${why(r)}`).toBe(true);
  expect(r.after['css.00.bg'], '★행 0 칸에 준 색이 안 들어갔다').toBe('rgb(123, 47, 247)');
  expect(r.after['css.10.bg'],
    '★행 0 «칸»에 준 색이 그 열의 «기본값»을 덮어써서 아래 행까지 바뀌었다.\n' +
    `   1행 0열: ${r.before['css.10.bg']} → ${r.after['css.10.bg']} (열 기본값 ${COL_BG} 이어야 한다)\n` +
    '   ⇒ 칸 꾸밈과 열 기본값은 «다른 자리»에 저장되어야 한다.').toBe('rgb(10, 125, 59)');
});

test('T178-2c ★patchCell{r:0} 뒤 patchCol — 칸 값은 살아남는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, [
    { patchCell: { r: 0, c: 0, bg: CELL_BG } },
    { patchCol: { index: 0, bg: COL_BG } },
  ]);
  expect(errs).toEqual([]);
  expect(allOk(r), `조작이 실패했다 — ${why(r)}`).toBe(true);
  expect(r.after['css.10.bg'], '★열 기본값이 아래 행에 안 닿는다').toBe('rgb(10, 125, 59)');
  expect(r.after['css.00.bg'],
    '★행 0 «칸»에 준 색이 뒤이은 열 기본값에 «지워졌다».\n' +
    `   0행 0열: ${r.after['css.00.bg']} (칸 값 ${CELL_BG} 이어야 한다 — 폴백은 cell[k] ?? col[k])\n` +
    '   ⇒ 기준 커밋에선 둘이 «같은 자리»(cols[0].bg)라 나중 것이 앞 것을 지운다.').toBe('rgb(123, 47, 247)');
});

/* ══════════════════════════════════════════════════════════════════════
 * 3 — 모델·화면 일치. 「화면만 칠해지는」 상태가 다시 못 나오게 잠근다.
 *   양방향으로 묻는다: 화면이 변했으면 모델도 / 모델이 변했으면 화면도.
 * ════════════════════════════════════════════════════════════════════ */

test('T178-3 ★모델·화면 일치 — 「모델은 그대로인데 화면만 칠해진」 칸이 0개다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, ROW0_PATCH);
  expect(errs).toEqual([]);
  expect(allOk(r), `patchCell{r:0} 이 실패했다 — ${why(r)}`).toBe(true);

  /* 꾸밈 축만 본다 — 글자(text)·정렬 파생물이 아니라 bg/padding/radius/align/valign. */
  const DECOR = ['bg', 'padding', 'radius', 'align', 'valign'];
  const cssKeysOf = (t) => [`css.${t}.bg`, `css.${t}.padTop`, `css.${t}.padLeft`, `css.${t}.radius`,
    `css.${t}.justify`, `css.${t}.textAlign`];
  const screenOnly = [];   // 화면은 변했는데 모델은 그대로 — T-178 의 «더 고약한 쪽»
  const modelOnly = [];    // 모델은 변했는데 화면은 그대로 — 반대 방향의 거짓말
  for (const t of ['00', '01', '10', '11']) {
    const cssMoved = cssKeysOf(t).filter(k => r.delta[k]);
    const mdlMoved = DECOR.map(k => `model.${t}.${k}`).filter(k => r.delta[k]);
    if (cssMoved.length && !mdlMoved.length) screenOnly.push(`${t}칸 [${cssMoved.map(k => `${k}: ${r.delta[k]}`).join(' · ')}]`);
    if (mdlMoved.length && !cssMoved.length) modelOnly.push(`${t}칸 [${mdlMoved.map(k => `${k}: ${r.delta[k]}`).join(' · ')}]`);
  }
  expect(screenOnly,
    '★«모델은 null 인 채 화면만 칠해진» 칸이 있다. 저장본을 봐도 왜 칠해졌는지 안 보인다 —\n' +
    '   「없다」가 「안 칠해졌다」를 뜻하지 않는 자리다.\n' +
    screenOnly.map(s => '      ' + s).join('\n')).toEqual([]);
  expect(modelOnly,
    '★모델엔 값이 들어갔는데 화면이 안 따라왔다 — 반대 방향의 거짓말.\n' +
    modelOnly.map(s => '      ' + s).join('\n')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
 * 4 — 행 0 의 «줄 내용»은 여전히 cols[c].lines «하나»뿐이다(단일 진실원 불변식).
 *   ★저장 포맷이 바뀌어도(cells 가 행 0 을 담게 되어도) 이건 안 바뀐다.
 *   ⛔키 이름을 박지 않는다 — dataset 전체에서 표지 글자가 «몇 번» 나오나로 잰다.
 * ════════════════════════════════════════════════════════════════════ */

test('T178-4a ★행 0 줄 내용은 한 군데뿐 — 꾸밈 patch 는 내용을 복제하지 않는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, ROW0_PATCH);
  expect(errs).toEqual([]);
  expect(allOk(r), `patchCell{r:0} 이 실패했다 — ${why(r)}`).toBe(true);
  expect(r.sentinel.n,
    `★행 0 의 줄 내용이 dataset 안에 ${r.sentinel.n} 번 있다 — 단일 진실원이 깨졌다.\n` +
    `   어디에: ${JSON.stringify(r.sentinel.per)}\n` +
    '   ⇒ 두 값이 어긋나는 전형적 2-소스 버그 자리다. 꾸밈 5개만 칸 자리로 옮기고 ' +
    'lines 는 cols[c] 에 남겨야 한다.').toBe(1);
  expect(Object.keys(r.sentinel.per),
    '★행 0 줄 내용이 dataset.cols 가 아닌 곳에 있다').toEqual(['cols']);
  // 화면에도 그대로 있다 — 「한 군데뿐」이 「사라졌다」로 통과하면 안 된다.
  expect(r.after['css.00.text'], '★행 0 칸의 글자가 화면에서 사라졌다').toBe(SENTINEL);
  expect(r.after['model.00.lineText'], '★모델에서 행 0 칸의 글자가 사라졌다').toBe(JSON.stringify([SENTINEL]));
});

test('T178-4b ★행 0 «내용»을 고쳐도 한 군데뿐', async ({ page }) => {
  const errs = await boot(page);
  const NEW = 'T178-EDITED-b52c9e';
  const r = await run(page, [
    { patchCell: { r: 0, c: 0, bg: CELL_BG } },
    { patchCell: { r: 0, c: 0, lineIndex: 0, text: NEW } },
  ]);
  expect(errs).toEqual([]);
  expect(allOk(r), `조작이 실패했다 — ${why(r)}`).toBe(true);
  const cnt = await page.evaluate((needle) => {
    const block = document.querySelector('.grid-block');
    let n = 0; const per = {};
    for (const [k, v] of Object.entries(block.dataset)) {
      const s = String(v == null ? '' : v);
      let i = 0, c = 0;
      for (;;) { const j = s.indexOf(needle, i); if (j < 0) break; c++; i = j + needle.length; }
      if (c) per[k] = c; n += c;
    }
    return { n, per, old: JSON.stringify(block.dataset.cols || '').includes('a7f3d1') };
  }, NEW);
  expect(cnt.n,
    `★고친 내용이 dataset 안에 ${cnt.n} 번 있다 — ${JSON.stringify(cnt.per)}`).toBe(1);
  expect(Object.keys(cnt.per), '★행 0 줄 내용이 dataset.cols 가 아닌 곳에 있다').toEqual(['cols']);
  expect(cnt.old, '★옛 글자가 어딘가에 남았다 — 두 벌이 생겼다').toBe(false);
  expect(r.after['css.00.text'], '★고친 글자가 화면에 안 보인다').toBe(NEW);
  // 그리고 내용을 고쳐도 «다른 행»은 그대로다.
  expect(r.after['css.10.text'], '★행 0 의 글자 수정이 행 1 까지 갔다').toBe('R1C0');
});
