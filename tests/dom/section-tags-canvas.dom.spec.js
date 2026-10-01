/* section-tags-canvas.dom.spec.js — D2 (2026-10-01 현빈) 「템플릿 태그가 캔버스에 라벨로 뜬다」
 * ★양성대조 판 = 7699ea33 → T1 빨강이어야 한다 (T2·T3 은 옛 판에서도 초록 — 지키는 것을 재는 시험).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./_root-harness.js');

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css"><link rel="stylesheet" href="/css/editor-extra.css"></head><body>
<div id="canvas"><div class="section-block selected" id="s1" data-tags="hero,cta">
  <div class="section-hitzone"><span class="section-label">Section 01</span></div>
  <div class="section-inner"></div></div></div>
<div class="tb-card"><span class="section-tag-chip" id="cardChip">hero</span></div>
<script type="module">
  const T = await import('/js/panels/template-system.js').catch(e => (window.__err = String(e), {}));
  (T.renderSectionTags || window.renderSectionTags)?.(document.getElementById('s1'));
  window.__ready = true;
</script></body></html>`;

test('T1 ★캔버스 섹션 머리에 태그 칩이 «안 보인다»', async ({ page }) => {
  await boot(page, PAGE);
  const r = await page.evaluate(() => {
    const g = document.querySelector('#s1 .section-hitzone > .section-tags');
    return { rendered: !!g, chips: g ? g.querySelectorAll('.section-tag-chip').length : 0,
             display: g ? getComputedStyle(g).display : null, err: window.__err || null };
  });
  expect(r.err).toBeNull();
  expect(r.rendered, '전제 — renderSectionTags 가 칩을 그렸다(그려야 숨김을 잴 수 있다)').toBe(true);
  expect(r.chips).toBe(2);
  expect(r.display, '★캔버스에 라벨로 샌다').toBe('none');
});

test('T2 태그 데이터(dataset.tags)는 그대로', async ({ page }) => {
  await boot(page, PAGE);
  expect(await page.evaluate(() => document.getElementById('s1').dataset.tags)).toBe('hero,cta');
});

test('T3 템플릿 브라우저 카드의 같은 클래스 칩은 보인다', async ({ page }) => {
  await boot(page, PAGE);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('cardChip')).display)).not.toBe('none');
});
