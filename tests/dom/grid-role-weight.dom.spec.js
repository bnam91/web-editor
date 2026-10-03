/* grid-role-weight.dom.spec.js — G7 (현빈 「왜 폰트가 다른지. 레귤러, 세미볼드로 해야 맞음」 · 지디 결정 2026-10-03 = 그리드 역할 굵기를 텍스트 블럭 체계에 맞춘다)
 *   W1 역할별 computed font-weight 가 텍스트 블럭(.tb-h1/.tb-h2/.tb-h3/.tb-body)과 같다 — 수를 손으로 안 적고 «같은 화면의 텍스트 블럭»에서 읽어 대조한다.
 *   W3 패널 미리보기(gridPreviewLine — prop-grid 연속 input) 도 같은 굵기 — 「패널에선 굵은데 캔버스는 얇다」가 없나.
 *   W2(지키는 시험) 줄에 weight 필드가 있으면 그게 이긴다 — 수지맥 grd_q5xww8x 꼴(body · weight "600" · 36px).
 * 양성대조: GD1001_ROOT=<604602cd> 에서 W1 빨강(h1 800·h2 700·h3 700), W2 초록.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./_root-harness.js');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css"><link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-layout.css"><link rel="stylesheet" href="/css/editor-blocks.css">
</head><body><div id="canvas"><div class="section-block" id="sec1" style="width:860px;background-color:#ffffff"><div class="section-inner" id="host">
<div class="text-block" data-type="heading"><div class="tb-h1">H1</div></div>
<div class="text-block" data-type="heading"><div class="tb-h2">H2</div></div>
<div class="text-block" data-type="heading"><div class="tb-h3">H3</div></div>
<div class="text-block" data-type="body"><div class="tb-body">BODY</div></div>
</div></div></div>
<script type="module">
  import '/js/globals.js';
  import { makeGridBlock, gridPreviewLine } from '/js/blocks/grid-block.js';
  window.__mk = makeGridBlock; window.__prev = gridPreviewLine; window.__ready = true;
</script></body></html>`;

async function plant(page, lines) {
  return page.evaluate((ls) => {
    const { row, block } = window.__mk({ cols: [{ width: 1 }] });
    document.getElementById('host').appendChild(row);
    const r = window.updateGridBlock(block.id, { cells: [[{ lines: ls }]] });
    return { ok: !!(r && r.ok), w: [...block.querySelectorAll('.grd-line')].map(l => [l.textContent, getComputedStyle(l).fontWeight]) };
  }, lines);
}

test('W1 역할 굵기 = 텍스트 블럭 굵기 (h1·h2·h3·body)', async ({ page }) => {
  const errs = await boot(page, HARNESS);
  const tb = await page.evaluate(() => Object.fromEntries(['h1', 'h2', 'h3', 'body'].map(k => [k, getComputedStyle(document.querySelector('.tb-' + k)).fontWeight])));
  const g = await plant(page, ['h1', 'h2', 'h3', 'body'].map(t => ({ type: t, text: 'G' + t })));
  expect(errs).toEqual([]);
  expect(g.ok).toBe(true);
  expect(tb, '전제 — 텍스트 블럭 체계(Regular·SemiBold·Bold)가 읽혔다').toEqual({ h1: '700', h2: '600', h3: '600', body: '400' });
  expect(Object.fromEntries(g.w.map(([t, w]) => [t.slice(1), w]))).toEqual(tb);
});

test('W2 (지키는 시험) 줄 weight 필드가 역할을 이긴다 — 수지맥 grd_q5xww8x 꼴', async ({ page }) => {
  await boot(page, HARNESS);
  const g = await plant(page, [{ type: 'body', text: '생산물 배상 책임 보험', fontSize: 36, weight: '600', fontFamily: "'Pretendard', sans-serif", color: '#000000', lineHeight: 1.2 },
                               { type: 'h1', text: 'H1-400', weight: '400' }]);
  expect(g.ok).toBe(true);
  expect(g.w).toEqual([['생산물 배상 책임 보험', '600'], ['H1-400', '400']]);
});

test('W3 패널 미리보기(gridPreviewLine)도 캔버스 렌더와 같은 굵기', async ({ page }) => {
  await boot(page, HARNESS);
  const g = await plant(page, [{ type: 'h1', text: 'a' }, { type: 'h2', text: 'b' }, { type: 'h3', text: 'c' }]);
  expect(g.ok).toBe(true);
  const r = await page.evaluate(() => {
    const b = document.querySelector('.grid-block');
    const ok = [0, 1, 2].map(li => window.__prev(b, 0, 0, li, { text: 'P' + li }));
    return { ok, w: [...b.querySelectorAll('.grd-line')].map(l => [l.textContent, getComputedStyle(l).fontWeight]) };
  });
  expect(r.ok).toEqual([true, true, true]);
  expect(r.w).toEqual([['P0', g.w[0][1]], ['P1', g.w[1][1]], ['P2', g.w[2][1]]]);
});
