/* grid-cell-rules.dom.spec.js — 칸 «사이» 괘선이 «진짜 화면»에서 간격 가운데에 서는가
 *
 * 현빈 2026-09-30: 「2*1인 셀이 있으면 각 칼럼 중간에 줄」 ＋ 「로우 간격에도 가로줄」.
 *
 * ★소스 검사(tests/unit/grid-cell-rules.test.mjs)는 «인라인 값»이 맞는지까지만 잽니다.
 *   여기서 재는 것은 그 값이 브라우저에서 «어디에 그려지는가»입니다 — 셋이 다릅니다:
 *     D1 줄의 «가운데»가 두 칸 사이 빈 틈의 «가운데»에 온다 (실제 rect 로).
 *     D2 ⛔줄이 «잘리지 않는다» — 이 방법의 전제는 칸에 overflow:hidden 이 없다는 것이다.
 *        생기면 줄이 칸 안으로 잘려 기능이 «조용히» 죽는다. 그 전제를 여기서 문다.
 *     D3 통짜가 행 간격을 «실제로» 덮어 두 행의 줄이 이어진다(틈 0).
 *     D4 굵기가 간격보다 커도 넘친다 — 넘친 만큼 두 칸을 덮는다(현빈 확정).
 *
 * ★양성대조 — 작업 «직전» 판을 가리키면 넷 다 빨개진다(그 판엔 괘선이 아예 없다):
 *     mkdir -p /tmp/rule-before && git archive 050983db js css | tar -x -C /tmp/rule-before
 *     RULE_BEFORE=/tmp/rule-before npx playwright test \
 *       --config=tests/dom/playwright.dom.config.js grid-cell-rules
 *   ⛔판을 «HEAD» 로 쓰지 마라 — 고친 뒤엔 HEAD 가 곧 고친 판이라 대조가 전부 초록이 된다.
 *   ★실측(050983db 기준) — 일곱 다 빨강. ⚠️단 «단언»이 아니라 «하네스가 안 뜬다»로 빨갛다:
 *     그 판엔 gridRules export 가 없어 모듈 import 가 깨진다. ⇒ 이 대조가 증명하는 것은
 *     「기능이 그 판에 없다」까지다. 「내 단언이 어긋난 값을 잡는다」는 그와 «다른 축»이고,
 *     그건 D3-b(같은 값의 반대 그림)와 D4(깎지 않는다)가 잰다.
 *
 * ⛔앱을 «안» 띄운다 — 렌더러를 ES 모듈로 올려 진짜 CSS·진짜 레이아웃으로 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-cell-rules
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BASE = process.env.RULE_BEFORE || REPO;
if (process.env.RULE_BEFORE) console.warn(`[grid-cell-rules] ★양성대조 모드 — 원본을 ${BASE} 에서 읽는다`);

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };

/* 렌더러가 기대하는 최소 골격 + 앱 CSS. ⛔칸에 overflow 를 «여기서» 주지 않는다 —
   앱 CSS 가 주는지를 재는 것이 D2 다(내가 주면 그 답을 내가 만들어 버린다). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
  <style>* { box-sizing: border-box; } body { margin: 0; } #canvas { width: 900px; }</style>
  <link rel="stylesheet" href="/css/editor-blocks.css">
  </head><body>
  <div id="canvas" style="--inv-zoom:1;"><div class="section-block" id="sec1"><div class="section-inner" id="host"></div></div></div>
  <script type="module">
    import { makeGridBlock, updateGridBlock, getGridModel, gridRules } from '/js/blocks/grid-block.js';
    window.__mk = makeGridBlock;
    window.__up = updateGridBlock;
    window.__model = getGridModel;
    window.__rules = gridRules;
    window.__ready = true;
  </script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: HARNESS });
    const file = path.join(BASE, url.pathname);
    if (!file.startsWith(BASE) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 2열 × rowsN 행 블록을 띄우고 partial 을 먹인 뒤, 칸·줄의 «화면 사각형»을 돌려준다. */
/* ⛔playwright 의 evaluate 는 인자를 «하나»만 넘긴다 — 셋을 그냥 나열하면 첫 칸에 배열이
   통째로 들어와 `partials is not iterable` 로 죽는다(처음에 그렇게 썼다). 한 벌로 받아 푼다. */
function build([colsN, rowsN, partials]) {
  const host = document.getElementById('host');
  host.innerHTML = '';
  const { row, block } = window.__mk({ cols: Array.from({ length: colsN }, () => ({ width: 1, lines: [] })) });
  host.appendChild(row);
  if (rowsN > 1) window.__up(block.id, { rows: Array.from({ length: rowsN }, () => ({ height: 'auto' })) });
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < colsN; c++) {
      window.__up(block.id, { patchCell: { r, c, lines: [{ type: 'body', text: 'C' + r + c }] } });
    }
  }
  const fails = [];
  for (const p of partials) {
    const res = window.__up(block.id, p);
    if (!res || res.ok === false) fails.push(JSON.stringify(p) + ' -> ' + JSON.stringify(res));
  }
  const R = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, r: b.right, b2: b.bottom }; };
  const cell = (r, c) => block.querySelector(`.grd-cell[data-r="${r}"][data-c="${c}"]`);
  const rule = (r, c, cls) => cell(r, c) && cell(r, c).querySelector(':scope > .' + cls);
  const out = { fails, cells: {}, crule: {}, rrule: {}, overflow: {} };
  for (let r = 0; r < rowsN; r++) {
    for (let c = 0; c < colsN; c++) {
      const k = r + ',' + c;
      out.cells[k] = R(cell(r, c));
      out.overflow[k] = getComputedStyle(cell(r, c)).overflow;
      const cr = rule(r, c, 'grd-crule'); if (cr) out.crule[k] = R(cr);
      const rr = rule(r, c, 'grd-rrule'); if (rr) out.rrule[k] = R(rr);
    }
  }
  out.innerOverflow = getComputedStyle(block.querySelector('.grd-inner')).overflow;
  return out;
}

test('D1 ★줄의 «가운데»가 두 칸 사이 빈 틈의 가운데에 온다 (실제 rect 로)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(build, [2, 1, [{ colGap: 24 }, { colRuleOn: '1', colRuleWidth: 2 }]]);
  expect(errs).toEqual([]);
  expect(r.fails, `★값을 못 먹였다: ${r.fails.join(' | ')}`).toEqual([]);
  const left = r.cells['0,0'], right = r.cells['0,1'], rule = r.crule['0,0'];
  expect(rule, '★세로줄이 그려지지 않았다').toBeTruthy();
  // 틈의 가운데 = 왼쪽 칸 오른끝과 오른쪽 칸 왼끝의 중점
  const gapMid = (left.r + right.x) / 2;
  const ruleMid = rule.x + rule.w / 2;
  expect(Math.abs(ruleMid - gapMid), `★줄 가운데(${ruleMid}) 가 틈 가운데(${gapMid}) 에서 벗어났다`).toBeLessThanOrEqual(0.6);
  expect(Math.round(rule.w)).toBe(2);
  // 칸 높이 전체(들여쓰기 0)
  expect(Math.round(rule.y)).toBe(Math.round(left.y));
  expect(Math.round(rule.b2)).toBe(Math.round(left.b2));
});

test('D2 ⛔줄이 «잘리지 않는다» — 칸·안쪽에 overflow:hidden 이 없다(이 방법의 전제)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(build, [2, 1, [{ colGap: 24 }, { colRuleOn: '1', colRuleWidth: 2 }]]);
  expect(errs).toEqual([]);
  /* 전제 — 잘리면 아래 「밖으로 나갔다」가 성립할 수 없다. 어느 쪽이 깨졌는지 구분해 말한다. */
  expect(r.overflow['0,0'], '★칸에 overflow:hidden 이 생겼다 — 내민 줄이 잘려 기능이 «조용히» 죽는다').toBe('visible');
  expect(r.innerOverflow, '★.grd-inner 에 overflow:hidden 이 생겼다 — 같은 까닭으로 줄이 잘린다').toBe('visible');
  // 그리고 실제로 칸 «밖»에 있다(잘렸으면 rect 가 칸 안으로 눌린다)
  expect(r.crule['0,0'].x).toBeGreaterThan(r.cells['0,0'].r - 0.01);
});

test('D3 ★통짜는 행 간격을 «실제로» 덮는다 — 두 행의 줄이 틈 없이 이어진다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(build, [2, 2, [{ rowGap: 20 }, { colRuleOn: '1', colRuleSpan: 'through' }]]);
  expect(errs).toEqual([]);
  expect(r.fails).toEqual([]);
  const top = r.crule['0,0'], bot = r.crule['1,0'];
  expect(top && bot, '★두 행에 줄이 다 안 그려졌다').toBeTruthy();
  expect(Math.abs(bot.y - top.b2), `★두 행의 줄이 안 이어진다 — 틈 ${bot.y - top.b2}px`).toBeLessThanOrEqual(0.6);
  // 블럭 밖으로는 안 삐친다
  expect(Math.round(top.y)).toBe(Math.round(r.cells['0,0'].y));
  expect(Math.round(bot.b2)).toBe(Math.round(r.cells['1,0'].b2));
});

test('D3-b ★끊김은 «안» 이어진다 — 행 간격만큼 벌어진다(같은 값의 반대 그림)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(build, [2, 2, [{ rowGap: 20 }, { colRuleOn: '1', colRuleSpan: 'cell' }]]);
  expect(errs).toEqual([]);
  const gap = r.crule['1,0'].y - r.crule['0,0'].b2;
  expect(Math.abs(gap - 20), `★끊김인데 틈이 행 간격(20)이 아니다 — ${gap}px`).toBeLessThanOrEqual(0.6);
});

test('D4 ★굵기가 간격보다 커도 넘친다 — 넘친 만큼 두 칸을 덮는다 (현빈 확정)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(build, [2, 1, [{ colGap: 4 }, { colRuleOn: '1', colRuleWidth: 20 }]]);
  expect(errs).toEqual([]);
  expect(r.fails).toEqual([]);
  const left = r.cells['0,0'], right = r.cells['0,1'], rule = r.crule['0,0'];
  expect(Math.round(rule.w), '★굵기를 «조용히» 깎았다').toBe(20);
  // 20 > 4 이므로 줄이 양쪽 칸 안으로 8px 씩 들어간다
  expect(rule.x).toBeLessThan(left.r - 1);
  expect(rule.r).toBeGreaterThan(right.x + 1);
  // 그래도 가운데는 여전히 틈의 가운데다
  expect(Math.abs((rule.x + rule.w / 2) - (left.r + right.x) / 2)).toBeLessThanOrEqual(0.6);
});

test('D5 ★가로줄도 같은 자리에 — 행 간격의 가운데', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(build, [2, 2, [{ rowGap: 16 }, { rowRuleOn: '1', rowRuleWidth: 4 }]]);
  expect(errs).toEqual([]);
  expect(r.fails).toEqual([]);
  const up = r.cells['0,0'], down = r.cells['1,0'], rule = r.rrule['0,0'];
  expect(rule, '★가로줄이 안 그려졌다').toBeTruthy();
  const gapMid = (up.b2 + down.y) / 2;
  expect(Math.abs((rule.y + rule.h / 2) - gapMid), '★가로줄이 행 간격 가운데에 안 선다').toBeLessThanOrEqual(0.6);
  expect(Math.round(rule.h)).toBe(4);
});

test('D6 ★들여쓰기가 «화면에서» 줄을 짧게 만든다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(build, [2, 1, [{ colRuleOn: '1', colRuleInset: 16 }]]);
  expect(errs).toEqual([]);
  const cell = r.cells['0,0'], rule = r.crule['0,0'];
  expect(Math.round(rule.y - cell.y), '★위쪽 들여쓰기가 화면에 안 나타난다').toBe(16);
  expect(Math.round(cell.b2 - rule.b2), '★아래쪽 들여쓰기가 화면에 안 나타난다').toBe(16);
});
