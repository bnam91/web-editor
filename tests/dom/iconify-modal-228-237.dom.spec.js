/* iconify-modal-228-237.dom.spec.js — 0.9.13 같은 패널 두 줄(지디 261126 «한 가지에 같이»)
 *   228 ICONIFY-SEARCH-CELL-CLIP-01: Feather «arrow»(결과 적음) → 칸이 열 폭보다 커져 오른쪽으로 넘쳐 잘림(미카사 shots-0913close-3 ICN-04)
 *       까닭: 격자 min-height 200 + 줄이 늘어남(align-content 기본 stretch) → 칸 aspect-ratio 1 이 «높이 = 늘어난 줄» 을 따라 폭이 열보다 커짐.
 *   237 ICONIFY-INSERT-NOSEL-NOOP-01: 아무것도 안 고르고 «삽입» = 조용히 무반응 — 막힌 단추가 «흐린 파랑 + 손가락 커서»라 눌리는 줄 앎.
 *       FigCraft 꼴(~/ref/figcraft crates/ui-egui/src/widgets.rs:1334-1349): 막힌 주 단추 = 회색 바탕(field) + 흐린 글(text_tertiary) · 안 눌림.
 *   네트워크 0 — api.iconify.design 은 page.route 로 가짜(collection · 묶음 몸통 · 낱개 svg).
 * 빨강 기대: f93500071 = A1(228) · B1(237) 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const ARROWS = ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up-left', 'arrow-up-right', 'arrow-down-left', 'arrow-down-right',
  'arrow-down-circle', 'arrow-left-circle', 'arrow-right-circle', 'arrow-up-circle'];
const BODY = '<path fill="none" stroke="currentColor" stroke-width="2" d="M12 19V5m-7 7l7-7l7 7"/>';

async function fakeIconify(page) {
  await page.route('https://api.iconify.design/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/collection') return route.fulfill({ json: { prefix: 'feather', uncategorized: [...ARROWS, 'home', 'star', 'x'] } });
    if (u.pathname.endsWith('.json')) {
      const names = (u.searchParams.get('icons') || '').split(',').filter(Boolean);
      return route.fulfill({ json: { prefix: 'feather', width: 24, height: 24, icons: Object.fromEntries(names.map((n) => [n, { body: BODY }])) } });
    }
    if (u.pathname.endsWith('.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${BODY}</svg>` });
    return route.fulfill({ json: { icons: [] } });
  });
}
async function openFeatherArrow(page) {
  await page.evaluate(() => window.openIconifyModal());
  await page.click('#iconify-modal .iconify-col-btn[data-prefix="feather"]');
  await page.fill('#iconify-search-input', 'arrow');
  await expect.poll(() => page.locator('#iconify-grid .iconify-icon-cell').count(), { message: '[전제] arrow 결과 12칸' }).toBe(ARROWS.length);
}

test('A1 228 결과 적은 검색(arrow 12) = 칸이 격자 안 · 열 폭을 안 넘음 · 정사각', async ({ page }) => {
  const errs = await bootApp(page); await fakeIconify(page);
  await openFeatherArrow(page);
  const g = await page.evaluate(() => {
    const grid = document.getElementById('iconify-grid'); const gr = grid.getBoundingClientRect();
    const cs = getComputedStyle(grid); const inner = gr.right - parseFloat(cs.paddingRight) - (grid.offsetWidth - grid.clientWidth);
    const col = (grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 7 * parseFloat(cs.columnGap)) / 8;
    const cells = [...grid.querySelectorAll('.iconify-icon-cell')].map((c) => c.getBoundingClientRect());
    return { inner, col, maxRight: Math.max(...cells.map((r) => r.right)), maxW: Math.max(...cells.map((r) => r.width)), skew: Math.max(...cells.map((r) => Math.abs(r.width - r.height))), hScroll: grid.scrollWidth - grid.clientWidth };
  });
  expect(g.maxRight, `★칸 오른쪽 끝 ${g.maxRight.toFixed(1)} ≤ 격자 안쪽 ${g.inner.toFixed(1)}`).toBeLessThanOrEqual(g.inner + 0.5);
  expect(g.maxW, `★칸 폭 ${g.maxW.toFixed(1)} ≤ 열 폭 ${g.col.toFixed(1)}`).toBeLessThanOrEqual(g.col + 0.5);
  expect(g.hScroll, '가로 넘침 0').toBeLessThanOrEqual(0);
  expect(g.skew, '정사각(폭≈높이)').toBeLessThan(1.5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B1 237 고른 것 없음 = 삽입 막힘(FigCraft 꼴: 회색 바탕 · 흐린 글 · 손가락 아님) → 고르면 열림 → 삽입', async ({ page }) => {
  const errs = await bootApp(page); await fakeIconify(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const s = await window.addSection(); window.deselectAll(); window.selectSection(s); });
  await openFeatherArrow(page);
  const look = () => page.evaluate(() => { const b = document.getElementById('iconify-insert-btn'); const cs = getComputedStyle(b); return { dis: b.disabled, bg: cs.backgroundColor, color: cs.color, cursor: cs.cursor, op: cs.opacity }; });
  const accent = await page.evaluate(() => { const p = document.createElement('div'); p.style.background = 'var(--ui-accent-primary)'; document.body.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; });
  const off = await look();
  expect(off.dis, '[전제] 고른 것 없음 = disabled').toBe(true);
  expect(off.bg, `★막힌 단추 바탕이 파랑(accent ${accent})이 아님`).not.toBe(accent);
  expect(off.cursor, '★막힌 단추 커서 = 손가락 아님').not.toBe('pointer');
  const n0 = await page.locator('#canvas .icon-block').count();
  await page.click('#iconify-insert-btn', { force: true });
  expect(await page.locator('#canvas .icon-block').count(), '막힌 단추 = 삽입 0').toBe(n0);
  await page.click('#iconify-grid .iconify-icon-cell >> nth=0');
  const on = await look();
  expect(on.dis, '고르면 열림').toBe(false);
  expect(on.bg, '열린 단추 = accent 파랑').toBe(accent);
  expect(on.cursor).toBe('pointer');
  await page.click('#iconify-insert-btn');
  await expect.poll(() => page.locator('#canvas .icon-block').count(), { message: '열린 단추 = 삽입 1' }).toBe(n0 + 1);
  expect(errs, errs.join(' | ')).toEqual([]);
});
