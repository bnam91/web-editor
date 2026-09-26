/* grid-cell-clear-contract.dom.spec.js — 「칸 꾸밈을 «지운다»는 무엇인가」의 계약.
 * (2026-09-23 · 기준 f724dc1 · T-178 딸림)
 *
 * ★네 값이 «서로 다른 뜻»을 가져야 한다. 하나라도 합쳐지면 표현할 수 없는 상태가 생긴다.
 *     null       = 「이 칸의 그 값을 «지운다»」  → 열 기본값으로 돌아간다   ★팀리드 확정(신규 계약)
 *     ''         = 「«강제로» 없앰」            → 열 기본값을 무시하고 하드 기본
 *     0          = 「«0 이라는 값»」            → 열 기본값을 무시하고 0. ⛔지움이 아니다
 *     키 없음     = 「안 줬음」                  → 무동작
 *   ⛔`null` 과 `''` 를 합치면 「열 기본값이 12 인데 이 칸만 여백 0」을 표현할 길이 사라진다.
 *   ⛔`0` 을 지움으로 읽으면 같은 것이 사라진다 — 그래서 O3 가 그 자리를 따로 잠근다.
 *
 * ★★`undefined` 는 «이미» 지움이다 — 이 그물을 짜다 «재서» 알아냈다(2026-09-23).
 *   `Object.assign({}, prev, {bg: undefined})` 가 키를 undefined 로 덮고, 그 뒤 `JSON.stringify`
 *   가 그 키를 통째로 떨군다 ⇒ dataset 에서 «사라진다». 실측으로 확인했다(C5).
 *   ⛔그런데 이 길은 «같은 프로세스 안의 JS»에서만 닿는다 — MCP/IPC 는 JSON 이라
 *     `undefined` 를 실어 보낼 수 없다. ⇒ `null` 에 뜻을 주는 까닭은 「지울 길이 없어서」가
 *     아니라 「JSON 으로 닿는 길이 없어서」다.
 *
 * ⛔측정은 «행 1» 칸에서 한다 — 행 0 은 T-178 이 고쳐지기 전까지 열과 한 몸이라 두 답이 겹친다.
 * ⛔앱을 «안» 띄운다. 제품 변경 0.
 * 실행: npm run test:dom -- grid-cell-clear-contract
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<script src="/js/design-system.js"></script>
<script type="module">
  import { makeGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  window.__mk = makeGridBlock; window.__model = getGridModel; window.__ready = true;
</script></body></html>`;

const row = (a, b) => [{ lines: [{ type: 'body', text: a }] }, { lines: [{ type: 'body', text: b }] }];
const FIX2 = { cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }], cells: [row('R0C0', 'R0C1'), row('R1C0', 'R1C1')] };
/* ★0 축 전용 — 「같은 열의 «두» 칸」이 필요하다. 행 0 은 오염돼 있으니 행 1·2 를 쓴다. */
const FIX3 = { cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }, { height: 'auto' }],
  cells: [row('R0C0', 'R0C1'), row('R1C0', 'R1C1'), row('R2C0', 'R2C1')] };

/* ★L 절 전용 — 대상 칸에 줄이 «둘». 1개짜리로는 「줄이 사라졌나」를 덜 민감하게 잰다
   (1개 → 0개 와 2개 → 0개 를 같은 민감도로 보면 부분 손실을 놓친다). */
const FIXL = { cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: 'R0C0-A' }, { type: 'body', text: 'R0C0-B' }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: 'R1C0-A' }, { type: 'body', text: 'R1C0-B' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ] };

/* 열 기본값과 칸 오버라이드 — 셋(열 기본 · 칸 오버라이드 · 하드 기본)이 «전부 달라야» 가른다. */
const COL_DEFAULT = { bg: '#0a7d3b', padding: 12, radius: 6, align: 'right', valign: 'bottom' };
/* ⛔valign 은 'middle' 이어야 한다 — 'top' 은 블록 기본값과 «같은» flex-start 라
   「하드 기본」과 「칸 오버라이드」가 겹쳐서 valign 축이 아무것도 못 가른다(C0 가 실제로 잡았다). */
const CELL_OVER   = { bg: '#7b2ff7', padding: 24, radius: 18, align: 'center', valign: 'middle' };
const FIELDS = ['bg', 'padding', 'radius', 'align', 'valign'];
/** 각 필드를 «무엇으로 보나» — 화면 한 축씩. */
const AXIS = { bg: 'bg', padding: 'pad', radius: 'rad', align: 'al', valign: 'jus' };

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
  await page.evaluate(([f2, f3, cd, co, fl]) => {
    window.__F2 = f2; window.__F3 = f3; window.__CD = cd; window.__CO = co; window.__FL = fl;
    window.__mount = (fix) => {
      const HOST = document.getElementById('host');
      HOST.innerHTML = '';
      const { row: rw, block } = window.__mk(JSON.parse(JSON.stringify(fix)));
      HOST.appendChild(rw);
      return block;
    };
    window.__read = (b, r, c) => {
      const el = b.querySelector(`.grd-cell[data-r="${r}"][data-c="${c}"]`);
      if (!el) return { GONE: true };
      const cs = getComputedStyle(el);
      const ln = el.querySelector('[data-line]');
      return { bg: cs.backgroundColor, pad: cs.paddingTop, rad: cs.borderTopLeftRadius,
        jus: cs.justifyContent, al: ln ? getComputedStyle(ln).textAlign : '(no-line)' };
    };
    /* ★모델은 「키가 «있나»」까지 본다 — 「null 로 저장됨」과 「지워짐」이 갈려야 한다.
       ⛔`m[k] === undefined` 로만 보면 둘이 같아 보인다(getGridModel 이 두 경우 다 undefined 를
         돌려줄 수 있다). 그래서 «저장본»(dataset.cells)을 직접 본다. */
    window.__stored = (b, r, c) => {
      let cells;
      try { cells = JSON.parse(b.dataset.cells || '[]'); } catch (_) { return { ERR: true }; }
      /* ~~[폐기 · T-178 2026-09-23] `cells[r - 1]` + 「dataset.cells 는 행 1부터」~~
         까닭 — T-178 이 dataset.cells 를 «행 0 포함 전체 R×C»로 바꿨다. 옛 셈으로 읽으면
           r=1 을 물었는데 «행 0»(꾸밈이 하나도 없는 칸)을 읽어, 저장본을 재는 단언이
           전부 `<없음>` 으로 나온다. 실측: patchCell{r:1,c:0,padding:0} 뒤
             dataset.cells = [[{},{}],[{"lines":[…],"padding":0,"radius":0},{"lines":[…]}]]
           ⇒ 값은 «제대로 들어가 있는데» 이 계측기가 다른 칸을 보고 있었다(O1·O2·O3 가 그래서 울었다).
         ⛔이 줄은 «계측기»다 — 재는 양을 바꾸지 않는다. 묻는 칸을 제자리로 돌릴 뿐이다. */
      const cell = (cells[r] && cells[r][c]) || {};           // dataset.cells 는 «행 0 포함» 전체
      const out = {};
      for (const k of ['bg', 'padding', 'radius', 'align', 'valign']) {
        out[k] = Object.prototype.hasOwnProperty.call(cell, k) ? JSON.stringify(cell[k]) : '<없음>';
      }
      return out;
    };
    window.__put = (b, p) => { const x = window.updateGridBlock(b.id, p); return { ok: !!(x && x.ok), code: x && x.code, message: x && x.message }; };
    /** 칸의 «줄»을 본다 — 화면에 그려진 줄 개수와 글자, 그리고 모델. */
    window.__lines = (b, r, c) => {
      const el = b.querySelector(`.grd-cell[data-r="${r}"][data-c="${c}"]`);
      let mdl = 'ERR';
      try { mdl = JSON.stringify(((window.__model(b).cells[r] || [])[c] || {}).lines); } catch (_) {}
      return { n: el ? el.querySelectorAll('[data-line]').length : -1,
        text: el ? (el.innerText || '').trim().replace(/\s+/g, '|') : 'GONE', mdl };
    };
    /** lines 를 «페이지 안에서» 만들어 준다 — undefined 는 인자로 넘기면 직렬화가 떨군다. */
    window.__putLines = (b, r, c, mode) => {
      const p = { r, c };
      if (mode === 'null') p.lines = null;
      else if (mode === 'undef') p.lines = undefined;
      else if (mode === 'empty') p.lines = [];
      else if (mode === 'ok') p.lines = [{ type: 'body', text: 'NEWLINE' }];
      return window.__put(b, { patchCell: p });
    };
  }, [FIX2, FIX3, COL_DEFAULT, CELL_OVER, FIXL]);
  return errs;
}

/** 열 기본값 → 칸 오버라이드 → (주어진 값으로) 되돌리기. 세 지점의 화면·저장본을 돌려준다. */
async function clearProbe(page, field, mode) {
  return page.evaluate(({ field, mode }) => {
    const b = window.__mount(window.__F2);
    const ops = [];
    ops.push(window.__put(b, { patchCol: { index: 0, ...window.__CD } }));
    const colOnly = window.__read(b, 1, 0);
    ops.push(window.__put(b, { patchCell: { r: 1, c: 0, [field]: window.__CO[field] } }));
    const over = window.__read(b, 1, 0);
    /* ★`undefined` 는 페이지 «안»에서 만든다 — 인자로 넘기면 직렬화가 키를 떨군다(다른 것을 재게 된다). */
    const patch = { r: 1, c: 0 };
    if (mode === 'null') patch[field] = null;
    else if (mode === 'empty') patch[field] = '';
    else if (mode === 'undef') patch[field] = undefined;
    else if (mode === 'zero') patch[field] = 0;
    // mode === 'absent' 면 키를 아예 안 넣는다
    ops.push(window.__put(b, { patchCell: patch }));
    return { ops, colOnly, over, after: window.__read(b, 1, 0), stored: window.__stored(b, 1, 0) };
  }, { field, mode });
}

const okAll = (r) => r.ops.every(o => o.ok);
const why = (r) => r.ops.map((o, i) => `#${i} ok=${o.ok}${o.ok ? '' : ` ${o.code}: ${o.message}`}`).join(' / ');
const J = (o) => JSON.stringify(o);

/* ══════════════════════════════════════════════════════════════════════
 * C0 — 계측기. 세 자리(열 기본 · 칸 오버라이드 · 하드 기본)가 «전부 다른가».
 * ════════════════════════════════════════════════════════════════════ */

test('C0 ★계측기 — 열 기본값·칸 오버라이드·하드 기본이 필드마다 «서로 다르다»', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const b = window.__mount(window.__F2);
    window.__put(b, { patchCol: { index: 0, ...window.__CD } });
    const colOnly = window.__read(b, 1, 0);
    const hard = window.__read(b, 1, 1);          // 열 1 = 기본값 없는 대조군
    window.__put(b, { patchCell: { r: 1, c: 0, ...window.__CO } });
    return { colOnly, hard, over: window.__read(b, 1, 0) };
  });
  expect(errs).toEqual([]);
  const bad = [];
  for (const f of FIELDS) {
    const a = AXIS[f];
    if (r.colOnly[a] === r.hard[a]) bad.push(`${f}: 열기본(${r.colOnly[a]}) === 하드기본(${r.hard[a]})`);
    if (r.colOnly[a] === r.over[a]) bad.push(`${f}: 열기본(${r.colOnly[a]}) === 칸오버라이드(${r.over[a]})`);
    if (r.hard[a] === r.over[a]) bad.push(`${f}: 하드기본(${r.hard[a]}) === 칸오버라이드(${r.over[a]})`);
  }
  expect(bad, '★두 답이 겹친다 — 그 필드는 이 파일에서 아무것도 못 가른다. 값을 다시 골라라.\n' +
    bad.map(s => '      ' + s).join('\n')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
 * ㈎ C1 — `null` = 「지운다」. ★기준 커밋에서 «빨강»(아직 안 고쳐졌다).
 * ════════════════════════════════════════════════════════════════════ */

for (const f of FIELDS) {
  test(`C1-${f} ★null 은 «지운다» — 열 기본값으로 돌아간다`, async ({ page }) => {
    const errs = await boot(page);
    const r = await clearProbe(page, f, 'null');
    const a = AXIS[f];
    expect(errs).toEqual([]);
    expect(okAll(r), `조작이 실패했다 — ${why(r)}`).toBe(true);
    // 전제 — 오버라이드가 실제로 먹었다(안 먹었으면 아래는 공짜 초록이다).
    expect(r.over[a], `★칸 오버라이드가 안 먹었다 — ${f} 는 이 검사로 못 잰다`).not.toBe(r.colOnly[a]);
    // 본 단언 ⑴ 화면 — 덮어쓰기 «전»과 바이트 동일.
    expect(r.after[a],
      `★${f}:null 이 «지우지» 않았다.\n` +
      `   열 기본값만: ${r.colOnly[a]}\n   칸 덮어쓴 뒤: ${r.over[a]}\n   null 준 뒤  : ${r.after[a]}\n` +
      `   ⇒ null 은 「이 칸의 그 값을 지운다」여야 한다 — 열 기본값으로 돌아가야 한다.\n` +
      `   ⛔지금은 null 이 «값»으로 저장돼 하드 기본으로 떨어진다(저장본: ${r.stored[f]}).`).toBe(r.colOnly[a]);
    // 본 단언 ⑵ 저장본 — 키가 «없어야» 한다. null 로 남으면 폴백이 안 돈다.
    expect(r.stored[f],
      `★${f} 가 저장본에 ${r.stored[f]} 로 남았다 — «지움»은 키를 없애는 것이다.\n` +
      `   저장본 전체: ${J(r.stored)}\n` +
      '   ⛔null 을 남기면 pick(cell[k] !== undefined) 이 «값 있음»으로 읽어 폴백이 안 돈다.').toBe('<없음>');
  });
}

test('C2 ★짝 — null(지움)과 \'\'(강제 없음)이 «갈린다»', async ({ page }) => {
  const errs = await boot(page);
  const rows = [];
  for (const f of FIELDS) {
    const a = AXIS[f];
    const rn = await clearProbe(page, f, 'null');
    const re = await clearProbe(page, f, 'empty');
    rows.push({ f, col: rn.colOnly[a], hard: null, nul: rn.after[a], emp: re.after[a] });
  }
  expect(errs).toEqual([]);
  const same = rows.filter(x => x.nul === x.emp).map(x => `${x.f}: null→${x.nul} · ''→${x.emp} (열 기본값 ${x.col})`);
  expect(same,
    '★null 과 \'\' 가 «같은 결과»다 — 둘이 합쳐지면 「열 기본값이 있는데 이 칸만 강제로 없앰」을\n' +
    '   표현할 길이 사라진다.\n' + same.map(s => '      ' + s).join('\n')).toEqual([]);
  // 그리고 '' 쪽은 «여전히» 열 기본값이 아니어야 한다(강제 없음).
  const leaked = rows.filter(x => x.emp === x.col).map(x => `${x.f}: ''→${x.emp} = 열 기본값`);
  expect(leaked,
    '★\'\' 가 열 기본값으로 돌아갔다 — 「강제로 없앰」이 사라졌다.\n' + leaked.map(s => '      ' + s).join('\n')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
 * ㈐ C3·C4·C5 — 「안 줬음」과 「undefined」. ★C5 는 «재서» 알아낸 현 동작이다.
 * ════════════════════════════════════════════════════════════════════ */

test('C3 ★키를 아예 «안» 준 patch 는 무동작이다(안 줬음)', async ({ page }) => {
  const errs = await boot(page);
  const bad = [];
  for (const f of FIELDS) {
    const r = await clearProbe(page, f, 'absent');
    const a = AXIS[f];
    if (!okAll(r)) bad.push(`${f}: 조작 실패 — ${why(r)}`);
    if (r.after[a] !== r.over[a]) bad.push(`${f}: 안 줬는데 ${r.over[a]} → ${r.after[a]} 로 변했다`);
  }
  expect(errs).toEqual([]);
  expect(bad, '★키를 안 준 patch 가 값을 건드렸다 — 「안 줬음」이 무동작이 아니다.\n' +
    bad.map(s => '      ' + s).join('\n')).toEqual([]);
});

/* ★★C5 — 이 그물을 짜다 «재서» 알아낸 것(2026-09-23). 문서에 없던 길이다.
 *   `patchCell{k: undefined}` 는 `Object.assign` 이 키를 undefined 로 덮고 `JSON.stringify` 가
 *   그것을 떨궈서 «이미» 지움으로 동작한다. 그래서 여기는 기준 커밋에서도 «초록»이다.
 *   ⛔이 길은 «같은 프로세스의 JS»에서만 닿는다 — MCP/IPC(JSON)는 undefined 를 못 싣는다.
 *     ⇒ `null` 에 뜻을 주는 까닭은 「지울 길이 없어서」가 아니라 「JSON 으로 닿는 길이 없어서」다.
 *   ★여기를 잠가 두는 값: T-178 수정이 patchCell 의 병합 방식을 손대면서 이 길을 «조용히»
 *     끊을 수 있다. 그러면 패널이 지금 쓰고 있을지도 모르는 통로가 사라진다. */
test('C5 ★undefined 는 «이미» 지움이다 — 고치면서 이 길을 끊지 마라', async ({ page }) => {
  const errs = await boot(page);
  const bad = [];
  const stored = {};
  for (const f of FIELDS) {
    const r = await clearProbe(page, f, 'undef');
    const a = AXIS[f];
    stored[f] = r.stored[f];
    if (!okAll(r)) bad.push(`${f}: 조작 실패 — ${why(r)}`);
    if (r.after[a] !== r.colOnly[a]) bad.push(`${f}: undefined 로 덮었는데 열 기본값(${r.colOnly[a]})이 아니라 ${r.after[a]}`);
    if (r.stored[f] !== '<없음>') bad.push(`${f}: 저장본에 ${r.stored[f]} 가 남았다`);
  }
  expect(errs).toEqual([]);
  expect(bad,
    '★undefined 로 덮는 「지움」 통로가 끊겼다(기준 커밋에서는 «되던» 길이다).\n' +
    `   저장본: ${J(stored)}\n` + bad.map(s => '      ' + s).join('\n')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
 * ⑴ O — 숫자 `0`. ⛔지움이 «아니다».
 *   O1 열 기본값이 «없으면» 화면으론 못 가른다 — 그래서 «모델»로 잰다.
 *   O2 열 기본값이 «있으면» 화면으로도 갈린다 — 그게 「여백 0 강제」다.
 *   O3 0 은 지움이 아니다 — null 계약을 넣다가 falsy 를 통째로 지움으로 읽으면 여기가 운다.
 * ════════════════════════════════════════════════════════════════════ */

test('O1 ★0 축(열 기본값 없음) — 화면은 «같고» 저장본은 «갈린다»', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const b = window.__mount(window.__F2);
    const op = window.__put(b, { patchCell: { r: 1, c: 0, padding: 0, radius: 0 } });
    return { op, given: window.__read(b, 1, 0), notGiven: window.__read(b, 1, 1),
      sGiven: window.__stored(b, 1, 0), sNot: window.__stored(b, 1, 1) };
  });
  expect(errs).toEqual([]);
  expect(r.op.ok, `patchCell{padding:0} 이 거절됐다 — ${r.op.code}: ${r.op.message}`).toBe(true);
  // 화면은 같다 — Number(0)||0 과 Number(undefined)||0 이 둘 다 0 이라서.
  expect(r.given.pad, '★전제가 깨졌다 — 열 기본값이 없는데 0 을 준 칸의 화면이 0px 이 아니다').toBe('0px');
  expect(r.notGiven.pad).toBe('0px');
  // ★저장본은 갈려야 한다. 안 갈리면 「0 을 명시했다」를 기록할 곳이 없다.
  expect(r.sGiven.padding,
    `★0 을 줬는데 저장본에 안 남았다(${r.sGiven.padding}) — 「0 으로 강제」를 기록할 곳이 없다.\n` +
    `   준 칸: ${J(r.sGiven)}\n   안 준 칸: ${J(r.sNot)}`).toBe('0');
  expect(r.sNot.padding, '★안 준 칸에 padding 이 생겼다').toBe('<없음>');
  expect(r.sGiven.padding === r.sNot.padding,
    '★「0 을 명시했다」와 「안 줬다」가 저장본에서 «안» 갈린다 — 화면도 같으니 구별할 길이 0개다').toBe(false);
});

test('O2 ★★열 기본값이 깔린 열에서 「여백 0 강제」가 된다 — 같은 열 두 칸이 갈린다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const b = window.__mount(window.__F3);           // ★3행 — 행 0 을 피하고도 같은 열 두 칸을 쓴다
    const ops = [];
    ops.push(window.__put(b, { patchCol: { index: 0, padding: 12, radius: 6 } }));
    ops.push(window.__put(b, { patchCell: { r: 1, c: 0, padding: 0, radius: 0 } }));
    return { ops, zero: window.__read(b, 1, 0), untouched: window.__read(b, 2, 0),
      sZero: window.__stored(b, 1, 0) };
  });
  expect(errs).toEqual([]);
  expect(r.ops.every(o => o.ok), `조작이 실패했다: ${J(r.ops)}`).toBe(true);
  expect(r.untouched.pad, '★전제가 깨졌다 — 안 건드린 칸에 열 기본값 12px 이 안 왔다').toBe('12px');
  expect(r.zero.pad,
    `★열 기본값 12px 인 열에서 「여백 0」을 못 준다(나온 값 ${r.zero.pad}).\n` +
    '   ⇒ 0 이 「지움」으로 읽혀 열 기본값으로 되돌아간 것이다. 0 은 «값»이다.').toBe('0px');
  expect(r.zero.rad, '★모서리 0 도 같은 자리다').toBe('0px');
  expect(r.sZero.padding, `★0 이 저장본에 안 남았다 — ${J(r.sZero)}`).toBe('0');
});

test('O3 ★0 은 «지움»이 아니다 — falsy 를 통째로 지움으로 읽으면 여기가 운다', async ({ page }) => {
  const errs = await boot(page);
  const bad = [];
  for (const f of ['padding', 'radius']) {
    const r = await clearProbe(page, f, 'zero');
    const a = AXIS[f];
    if (!okAll(r)) { bad.push(`${f}: 조작 실패 — ${why(r)}`); continue; }
    if (r.after[a] === r.colOnly[a]) bad.push(`${f}: 0 을 줬는데 열 기본값(${r.colOnly[a]})으로 돌아갔다 — 지움으로 읽혔다`);
    if (r.after[a] !== '0px') bad.push(`${f}: 0 을 줬는데 화면이 ${r.after[a]} 다`);
    if (r.stored[f] !== '0') bad.push(`${f}: 저장본이 ${r.stored[f]} 다(0 이어야 한다)`);
  }
  expect(errs).toEqual([]);
  expect(bad,
    '★숫자 0 이 「지움」으로 읽혔다. null 계약을 넣으면서 falsy 를 통째로 지움으로 다루면 이렇게 된다.\n' +
    '   ⇒ 「지움」은 «null 하나»(그리고 이미 되는 undefined)뿐이다.\n' +
    bad.map(s => '      ' + s).join('\n')).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
 * L — ★`lines` 는 이 계약의 «예외»인가. (팀리드 2026-09-23 요청)
 *
 *   ~~[폐기 · 2026-09-26] 「이 레포엔 이미 «명시된 규칙»이 있다 — `patchCell{lines: []}` 는
 *     거절된다: EMPTY_CELL_LINES 「cell lines cannot be emptied — remove the row/column
 *     instead」. ⇒ 「patchCell 로 칸의 줄을 비우지 못한다」가 정해진 규칙이다」~~
 *   ★★2026-09-26 현빈 지시로 «칸 하나 비우기»가 허용됐다 — 「여전히 빈칸으로 두고 싶은데
 *     마지막 남은 줄은 삭제할 수 없다고 하네?」 ＋ 범위 확정 「②칸 하나만」.
 *     ⛔블럭의 «마지막 내용 칸»은 여전히 못 비운다(현빈 「②칸 하나만」) (`_gridRejectAllCellsEmpty`).
 *     까닭 전부는 js/blocks/grid-block.js 의 그 두 머리말에 있다.
 *   ★★그런데 ★이 절(L)의 «묻는 것»은 한 글자도 안 바뀐다.★ 이 절이 재는 것은 「비우기를
 *     막느냐」가 아니라 «같은 결과를 내는 입력 셋이 «한 정책»으로 다뤄지느냐»다:
 *       `lines:[]`   → 「비운다」  (허용 · 저장본 `{"lines":[]}`)
 *       `lines:null` → «모양 위반» (거절 LINES_NOT_ARRAY · 저장본이 `{"lines":null}` 이 되면
 *                       「비웠다」와 「모양이 깨졌다」가 한 글자도 안 갈린다)
 *     ⇒ 정책이 여전히 하나다. 갈린 것은 «어느 쪽으로 닫나»뿐이다.
 *   ⛔그래서 L1·L2 를 «걷지 않았다» — 걷으면 `lines:undefined` 로 칸을 날리는 옆문이 다시 열린다.
 *
 * ★실측(2026-09-23, 기준 f724dc1) — 옆문이 «둘» 열려 있다:
 *     행 1 `lines: []`        → ok:false EMPTY_CELL_LINES · 내용 보존   ← 가드 작동
 *       ★2026-09-26 재측정 — 같은 입력이 이제 `ok:true` · 줄 0개(=「비운다」)다. 그것이 기능이다.
 *     행 1 `lines: null`      → ok:true  · 줄 2개 → 0개 «내용 사라짐»   ⛔저장본 {"lines":null}
 *     행 1 `lines: undefined` → ok:true  · 줄 2개 → 0개 «내용 사라짐»   ⛔저장본 {} (키 삭제)
 *     행 0 `lines: null`      → ok:true  · 내용 «보존»(_mergeCellIntoCol 이 Array.isArray 로 거른다)
 *   ⇒ `undefined` 쪽이 특히 나쁘다 — C5 가 잠근 「undefined = 지움」 통로가 `lines` 에도
 *     그대로 걸려 칸 내용을 통째로 날린다. 키가 사라지면 `_gridExtraRows` 가 `lines: []` 로
 *     정규화해서 «빈 칸»이 된다.
 *
 * ⛔새 계약(`null` = 그 키를 지운다)을 «모든 키»에 똑같이 걸면 `lines` 도 지워진다 —
 *   그러면 이 옆문이 «설계»가 된다. 그래서 여기서 못 박는다: 꾸밈 5개와 `lines` 는 규칙이 다르다.
 * ★L1·L2 는 「거절해라」도 「무시해라」도 강요하지 않는다 — «내용이 사라지지 않는다»만 잰다.
 *   둘 중 어느 쪽으로 닫든 초록이 된다.
 * ════════════════════════════════════════════════════════════════════ */

/* ★L0 계측기 — 제목이 «조건»을 말하고 있었다(「lines:[] 는 거절되며」). 계약이 뒤집히면
   제목째 거짓이 되므로 제목도 같이 바꾼다(2026-09-26). */
test('L0 ★계측기 — 정상 lines 는 바뀌고, lines:[] 는 «비우고», lines:null 은 거절된다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const b = window.__mount(window.__FL);
    const before = window.__lines(b, 1, 0);
    const okRes = window.__putLines(b, 1, 0, 'ok');
    const afterOk = window.__lines(b, 1, 0);
    const b2 = window.__mount(window.__FL);
    const emptyRes = window.__putLines(b2, 1, 0, 'empty');
    const afterEmpty = window.__lines(b2, 1, 0);
    /* ★모양 계약 — «다른 블록»에서 잰다(위 b2 는 이미 비어 있어 「내용 보존」을 못 잰다). */
    const b3 = window.__mount(window.__FL);
    const nullRes = window.__putLines(b3, 1, 0, 'null');
    return { before, okRes, afterOk, emptyRes, afterEmpty,
      nullRes, afterNull: window.__lines(b3, 1, 0) };
  });
  expect(errs).toEqual([]);
  expect(r.before.n, '★픽스처의 그 칸에 줄이 2개여야 한다 — 1개면 「줄이 사라졌나」를 덜 민감하게 잰다').toBe(2);
  expect(r.okRes.ok, '★정상 lines 교체가 실패했다 — 이 절은 아무것도 못 잰다').toBe(true);
  expect(r.afterOk.text, '★정상 교체가 화면에 안 왔다').toBe('NEWLINE');
  /* ~~[폐기 · 2026-09-26] 「lines:[] 는 ok:false EMPTY_CELL_LINES 이고 내용이 2줄 그대로 남는다」~~
     ★이제 «비운다»가 기능이다. ⇒ 이 절의 근거는 「비우기 금지」가 아니라 «모양 계약»으로
       옮겨졌고, 그 자리는 바로 아래 `nullRes` 가 잰다(안 재면 L1·L2 가 근거 없는 절이 된다). */
  expect(r.emptyRes.ok, '★lines:[] 로 «비우기»가 안 된다 — 현빈 요구가 막혀 있다').toBe(true);
  expect(r.afterEmpty.n, '★ok:true 인데 줄이 안 비었다').toBe(0);
  expect(r.nullRes.ok, '★lines:null 이 통과했다 — 「비웠다」와 「모양이 깨졌다」가 안 갈린다').toBe(false);
  expect(r.nullRes.code).toBe('LINES_NOT_ARRAY');
  expect(r.afterNull.n, '★거절됐는데 내용이 사라졌다').toBe(2);
});

for (const [nick, mode, ko] of [['L1', 'null', 'null'], ['L2', 'undef', 'undefined']]) {
  test(`${nick} ★행 1 칸에 lines:${ko} 를 줘도 «내용이 사라지지 않는다»`, async ({ page }) => {
    const errs = await boot(page);
    const r = await page.evaluate((mode) => {
      const b = window.__mount(window.__FL);
      const before = window.__lines(b, 1, 0);
      const res = window.__putLines(b, 1, 0, mode);
      return { before, res, after: window.__lines(b, 1, 0), raw: b.dataset.cells || '<없음>' };
    }, mode);
    expect(errs).toEqual([]);
    expect(r.before.n, '★전제 — 시작할 때 줄이 2개여야 한다').toBe(2);
    expect({ n: r.after.n, text: r.after.text },
      `★lines:${ko} 가 칸의 줄을 «지웠다». ok=${r.res.ok} code=${r.res.code || '(없음)'}\n` +
      `   전: ${r.before.n}줄 "${r.before.text}"\n   후: ${r.after.n}줄 "${r.after.text}"\n` +
      `   저장본: ${r.raw}\n` +
      '   ⛔`lines:[]`(칸 하나 비우기)는 2026-09-26 부터 «허용»이고(단 블럭의 마지막 내용 칸은\n' +
      '     여전히 거절), `lines:null` 은 «모양 위반»이다 —\n' +
      '     모양 위반이 ok:true 로 칸을 날리면 저장본이 {"lines":null} 이 되어\n' +
      '     「비웠다」와 「모양이 깨졌다」가 한 글자도 안 갈린다.\n' +
      '   ⇒ 닫는 길은 둘 중 아무거나: ⑴같은 코드로 «거절»하거나 ⑵배열이 아니면 «무시»하거나.\n' +
      `   ⛔새 계약(null = 그 키를 지운다)을 모든 키에 똑같이 걸면 이 옆문이 «설계»가 된다.`)
      .toEqual({ n: r.before.n, text: r.before.text });
  });
}

test('L3 ★행 0 은 지금 «면역»이다 — 고치면서 이 면역을 잃지 마라', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const out = {};
    for (const mode of ['null', 'undef']) {
      const b = window.__mount(window.__FL);
      const before = window.__lines(b, 0, 0);
      const res = window.__putLines(b, 0, 0, mode);
      out[mode] = { before, res, after: window.__lines(b, 0, 0) };
    }
    return out;
  });
  expect(errs).toEqual([]);
  const bad = [];
  for (const mode of ['null', 'undef']) {
    const x = r[mode];
    if (x.before.n !== 2) bad.push(`${mode}: 전제 깨짐 — 시작 줄 수 ${x.before.n}`);
    if (x.after.n !== x.before.n || x.after.text !== x.before.text) {
      bad.push(`${mode}: ${x.before.n}줄 "${x.before.text}" → ${x.after.n}줄 "${x.after.text}" (ok=${x.res.ok})`);
    }
  }
  expect(bad,
    '★행 0 의 줄이 lines:null/undefined 로 사라졌다.\n' +
    '   기준 커밋에서 행 0 이 «안» 사라지는 까닭: 행 0 의 lines 는 `_mergeCellIntoCol` 을 지나고\n' +
    '   거기서 `if (Array.isArray(cell.lines))` 가 배열 아닌 것을 «거른다».\n' +
    '   ⛔T-178 이 행 0 을 `cells` 로 옮기면서 lines 까지 `Object.assign` 경로로 보내면\n' +
    '     이 면역이 «조용히» 사라진다 — 행 0 의 줄 내용은 cols[c].lines 에 남아야 한다(T178-4a/4b).\n' +
    bad.map(s2 => '      ' + s2).join('\n')).toEqual([]);
});
