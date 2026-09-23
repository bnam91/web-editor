/* grid-cell-empty-value.dom.spec.js — 「칸 꾸밈 필드에 `''`(또는 0)을 주면 «무엇이 되나»」.
 * (2026-09-23 · 기준 f724dc1)
 *
 * ★왜 있나 — 칸 손잡이(패널)를 만들면 「비우기 = 값을 지운다」를 `''` 로 보내고 싶어진다.
 *   그런데 이 레포에서 `''` 는 «지우기»가 아니다. 플래너가 «소스 독해»로만 세운 표가 있어
 *   그것을 «돌려서» 확인한다 — 표가 틀리면 여기가 운다.
 *     bg:''       → 배경 없음
 *     padding:''  → 0
 *     radius:''   → 0
 *     align:''    → 'left' «강제»
 *     valign:''   → 블록값 «강제»
 *   ★뒤의 둘은 「없음」이 아니라 «다른 값»이라 위험하다.
 *
 * ★★그리고 소스 독해가 «안» 말한 축을 하나 더 잰다 — 「열 기본값이 있을 때」.
 *   `pick = (k) => (cell[k] !== undefined ? cell[k] : col[k])` 는 `''` 를 «값 있음»으로 읽는다.
 *   ⇒ `''` 는 열 기본값으로 «되돌아가지 않는다». 다섯 필드 모두 열 기본값을 «무시»하고
 *     각자의 하드 기본으로 떨어진다. 패널이 「비우기」를 `''` 로 구현하면 사용자는
 *     「열 기본값으로 돌아갈 줄 알았는데 아니다」를 만난다.
 *   ⇒ 「지우기」는 `''` 가 아니라 «키 삭제»여야 한다. 이 파일은 그 판정을 위한 «수치»다.
 *
 * ⛔측정은 «행 1» 칸에서 한다 — 행 0 은 T-178 이 고쳐지기 전까지 열과 한 몸이라
 *   두 답이 겹친다. 행 1 칸은 지금도 cells 에 따로 저장되는 깨끗한 자다.
 *
 * ⛔앱을 «안» 띄운다. 제품 변경 0.
 * 실행: npm run test:dom -- grid-cell-empty-value
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
  window.__mk = makeGridBlock; window.__model = getGridModel; window.__ready = true;
</script></body></html>`;

const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [{ lines: [{ type: 'body', text: 'R0C0' }] }, { lines: [{ type: 'body', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ],
};

/* 열 «기본값» — 하드 기본과 «확실히 다른» 값만 고른다. 같으면 두 답이 겹쳐 아무것도 못 가른다. */
const COL_DEFAULT = { bg: '#0a7d3b', padding: 12, radius: 6, align: 'right', valign: 'bottom' };
const BLOCK_VALIGN = 'middle';    // 블록 기본값 — valign:'' 이 여기로 떨어지는지 보려고 일부러 다르게

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

/** 한 판: 블록 valign 을 세우고 → (선택)열 0 에 기본값을 깔고 → 행 1 칸에 patch 를 준다.
 *  세 자리를 잰다: 열0행1(대상) · 열1행1(열 기본값이 «없는» 대조군). */
async function probe(page, { withColDefault, patch }) {
  return page.evaluate(({ withColDefault, patch, colDefault, blockValign }) => {
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    const ops = [];
    const put = (p) => { const r = window.updateGridBlock(block.id, p); ops.push({ p, ok: !!(r && r.ok), code: r && r.code, message: r && r.message }); };
    put({ valign: blockValign });
    if (withColDefault) put({ patchCol: { index: 0, ...colDefault } });
    const read = (r, c) => {
      const el = block.querySelector(`.grd-cell[data-r="${r}"][data-c="${c}"]`);
      if (!el) return { MISSING: true };
      const cs = getComputedStyle(el);
      const ln = el.querySelector('[data-line]');
      return {
        bg: cs.backgroundColor, padding: cs.paddingTop, radius: cs.borderTopLeftRadius,
        valign: cs.justifyContent, align: ln ? getComputedStyle(ln).textAlign : '(no-line)',
      };
    };
    const before = { target: read(1, 0), control: read(1, 1) };
    if (patch) put({ patchCell: { r: 1, c: 0, ...patch } });
    const after = { target: read(1, 0), control: read(1, 1) };
    let model = null;
    try { model = (window.__model(block).cells[1] || [])[0] || {}; } catch (_) {}
    return { ops, before, after, model: JSON.stringify(model && { bg: model.bg, padding: model.padding, radius: model.radius, align: model.align, valign: model.valign }) };
  }, { withColDefault, patch, colDefault: COL_DEFAULT, blockValign: BLOCK_VALIGN });
}

const okAll = (r) => r.ops.every(o => o.ok);
const whyOps = (r) => r.ops.map(o => `${JSON.stringify(o.p)} → ok=${o.ok}${o.ok ? '' : ` ${o.code}: ${o.message}`}`).join('\n      ');

/* ══ 0 — 계측기 ═══════════════════════════════════════════════════════ */

test('V0-a ★계측기 — 열 기본값이 실제로 «먹고», 대조군 열에는 «안» 먹는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, { withColDefault: true, patch: null });
  expect(errs).toEqual([]);
  expect(okAll(r), `판을 못 깔았다:\n      ${whyOps(r)}`).toBe(true);
  expect(r.after.target).toEqual({
    bg: 'rgb(10, 125, 59)', padding: '12px', radius: '6px', valign: 'flex-end', align: 'right',
  });
  // 대조군(열 1)은 열 기본값이 «없는» 자리 = 하드 기본. 블록 valign 만 받는다.
  expect(r.after.control).toEqual({
    bg: 'rgba(0, 0, 0, 0)', padding: '0px', radius: '0px', valign: 'center', align: 'left',
  });
});

test('V0-b ★음성대조 — 열 기본값을 «안» 깔면 대상 칸도 하드 기본이다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, { withColDefault: false, patch: null });
  expect(errs).toEqual([]);
  expect(r.after.target).toEqual(r.after.control);
});

/* ══ 1 — 플래너의 표를 «돌려서» 확인한다 (열 기본값 «없음») ═══════════
 *   여기서 나오는 값이 곧 「각 필드의 하드 기본」이다. */

const TABLE = [
  { k: 'bg', v: '', axis: 'bg', want: 'rgba(0, 0, 0, 0)', ko: '배경 없음' },
  { k: 'padding', v: '', axis: 'padding', want: '0px', ko: '0' },
  { k: 'radius', v: '', axis: 'radius', want: '0px', ko: '0' },
  { k: 'align', v: '', axis: 'align', want: 'left', ko: "'left' 강제" },
  { k: 'valign', v: '', axis: 'valign', want: 'center', ko: `블록값(${BLOCK_VALIGN}) 강제` },
];

for (const { k, v, axis, want, ko } of TABLE) {
  test(`V1-${k} 표 확인 — 열 기본값이 «없을» 때 ${k}:'' → ${ko}`, async ({ page }) => {
    const errs = await boot(page);
    const r = await probe(page, { withColDefault: false, patch: { [k]: v } });
    expect(errs).toEqual([]);
    expect(okAll(r), `patchCell{${k}:''} 이 거절됐다:\n      ${whyOps(r)}`).toBe(true);
    expect(r.after.target[axis],
      `★플래너 표와 다르다 — ${k}:'' 는 「${ko}」여야 하는데 '${r.after.target[axis]}' 가 나왔다.\n` +
      `   표가 «소스 독해»로만 세워졌다는 뜻이다. 표를 고쳐라.`).toBe(want);
  });
}

/* ══ 2 — ★★소스 독해가 «안» 말한 축: 열 기본값이 «있을» 때 ═══════════
 *   `''` 가 「지우기(열 기본값 복귀)」인가, 아니면 「하드 기본으로 떨어짐」인가. */

for (const { k, v, axis, ko } of TABLE) {
  test(`V2-${k} ★${k}:'' 는 «열 기본값으로 안 돌아간다» — 하드 기본으로 떨어진다`, async ({ page }) => {
    const errs = await boot(page);
    const r = await probe(page, { withColDefault: true, patch: { [k]: v } });
    expect(errs).toEqual([]);
    expect(okAll(r), `판을 못 깔았다:\n      ${whyOps(r)}`).toBe(true);
    const colVal = r.before.target[axis];        // 열 기본값이 그리던 값
    const hardVal = r.after.control[axis];       // 기본값 없는 대조군이 그리는 값
    expect(colVal, `★전제가 안 선다 — 열 기본값과 하드 기본이 «같은 값»이라 두 답이 겹친다(${axis})`).not.toBe(hardVal);
    expect(r.after.target[axis],
      `★${k}:'' 가 «열 기본값으로 되돌아갔다».\n` +
      `   열 기본값='${colVal}' · 하드 기본='${hardVal}' · 나온 값='${r.after.target[axis]}'\n` +
      '   ⇒ 이 파일이 적어 둔 위험(「빈 문자열은 지우기가 아니다」)이 사라졌다는 뜻이다.\n' +
      '     좋은 변화일 수 있지만 «패널이 그 전제 위에 서 있으므로» 표를 다시 쓰고 알려라.').toBe(hardVal);
  });
}

/* ══ 2-b — `null` 은 «지운다». ★★2026-09-23 T-178 C2 에서 «뒤집힌» 축이다 ══════
 *
 * ~~[폐기 · T-178 C2 2026-09-23] 「V2b-<k> ★<k>:null 도 열 기본값으로 «안» 돌아간다」
 *   = `expect(r.after.target[axis]).toBe(hardVal)`~~
 *   그 단언이 적어 둔 «자기 파기 조건»이 그대로 일어났다:
 *     「pick() 이 null 을 「값 없음」으로 읽기 시작했다는 뜻이다. 표를 다시 쓰고 알려라.」
 *   ⇒ 표를 다시 썼고, 알린다.
 *
 * ★무엇이 바뀌었나 — `patchCell` 의 값이 `null` 이면 그 «키를 지운다»(새 계약, 팀리드 확정).
 *   ⛔`pick` 표현식은 한 글자도 안 바뀌었다 — 지워진 키는 pick 에 `undefined` 로 보이니
 *     폴백(`cell[k] !== undefined ? cell[k] : col[k]`)이 그대로 돌아 열 기본값이 나온다.
 *     즉 「pick 이 null 을 읽기 시작한」 것이 아니라 «null 이 pick 에 닿기 전에 지워진다».
 * ★왜 뒤집었나 — 예전의 `null` 은 «함정»이었다. 「값 있음」으로 저장돼 열 기본값이 아니라
 *   «하드 기본»으로 떨어져서 아무도 의미 있게 못 썼다. 그 자리에 뜻을 준 것이라 잃은 표현력이 없다.
 *   그리고 `undefined` 는 «이미» 지움이었지만 JSON(MCP·IPC·저장본)이 그걸 못 싣는다 —
 *   `null` 이 그 구멍을 막는다.
 * ⛔`''` 는 «안» 바뀌었다(V2 가 그대로 초록이다) — 「강제로 없앰」은 여전히 살아 있다.
 *   둘이 갈린다는 것을 grid-cell-clear-contract.dom.spec.js 의 C2 가 따로 잠근다. */

for (const { k, axis, ko } of TABLE) {
  test(`V2b-${k} ★${k}:null 은 «지운다» — 열 기본값으로 돌아간다`, async ({ page }) => {
    const errs = await boot(page);
    const r = await probe(page, { withColDefault: true, patch: { [k]: null } });
    expect(errs).toEqual([]);
    expect(okAll(r), `patchCell{${k}:null} 이 거절됐다:\n      ${whyOps(r)}`).toBe(true);
    const colVal = r.before.target[axis];
    const hardVal = r.after.control[axis];
    expect(colVal, `★전제가 안 선다 — 열 기본값과 하드 기본이 같다(${axis})`).not.toBe(hardVal);
    expect(r.after.target[axis],
      `★${k}:null 이 «지우지» 않았다 — 열 기본값='${colVal}' · 하드 기본='${hardVal}' · ` +
      `나온 값='${r.after.target[axis]}'.\n` +
      '   null 은 「그 키를 지운다」여야 한다(= 열 기본값으로 되돌림).\n' +
      `   ⛔'${hardVal}' 이 나왔다면 null 이 «값»으로 저장돼 폴백이 안 돈 것이다 — 옛 함정이 돌아왔다.`)
      .toBe(colVal);
  });
}

/* ══ 3 — 그럼 「지우기」는 무엇인가: 키를 «빼면» 열 기본값으로 돌아온다 ══ */

test('V3 ★키를 빼면(undefined) 열 기본값으로 «돌아온다» — 「지우기」의 올바른 모양', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((cfg) => {
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    const ops = [];
    const put = (p) => { const x = window.updateGridBlock(block.id, p); ops.push({ p, ok: !!(x && x.ok), code: x && x.code, message: x && x.message }); };
    const read = () => {
      const el = block.querySelector('.grd-cell[data-r="1"][data-c="0"]');
      const cs = getComputedStyle(el);
      const ln = el.querySelector('[data-line]');
      return { bg: cs.backgroundColor, padding: cs.paddingTop, radius: cs.borderTopLeftRadius,
        valign: cs.justifyContent, align: ln ? getComputedStyle(ln).textAlign : '(no-line)' };
    };
    put({ valign: cfg.blockValign });
    put({ patchCol: { index: 0, ...cfg.colDefault } });
    const colOnly = read();
    put({ patchCell: { r: 1, c: 0, bg: '#7b2ff7', padding: 24, radius: 18, align: 'center', valign: 'top' } });
    const overridden = read();
    /* 「지우기」 = cells 를 통째로 다시 써서 그 칸의 키를 «없앤다»(patchCell 은 merge 라 못 지운다). */
    const full = window.__model(block).cells.map(rw => rw.map(c => ({ lines: c.lines })));
    put({ cells: full });
    const cleared = read();
    return { ops, colOnly, overridden, cleared };
  }, { colDefault: COL_DEFAULT, blockValign: BLOCK_VALIGN });
  expect(errs).toEqual([]);
  expect(r.ops.every(o => o.ok), `판을 못 깔았다:\n      ${r.ops.map(o => `${JSON.stringify(o.p).slice(0, 90)} → ok=${o.ok} ${o.code || ''} ${o.message || ''}`).join('\n      ')}`).toBe(true);
  expect(r.overridden, '★칸 오버라이드가 안 먹었다 — 전제가 안 선다').not.toEqual(r.colOnly);
  expect(r.cleared,
    '★키를 «없앴는데»도 열 기본값으로 안 돌아왔다.\n' +
    `   열 기본값만: ${JSON.stringify(r.colOnly)}\n` +
    `   덮어쓴 뒤  : ${JSON.stringify(r.overridden)}\n` +
    `   지운 뒤    : ${JSON.stringify(r.cleared)}\n` +
    '   ⇒ 「지우기」가 아예 불가능하다면 패널 손잡이에 「기본값으로」 단추를 못 단다.').toEqual(r.colOnly);
});
