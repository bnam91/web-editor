/* layout-en.dom.spec.js — 표준 Layout 크기 모드 낱말 영어(현빈 261125 17:36 · 지디 판정 ⓐ 짧은 꼴 + title 긴 꼴 · FigCraft layout_panel.rs)
 *   EN1 드롭다운 옵션 글 = Fixed / Hug / Fill(모달 높이 «최소» = «Min H») · title = Fixed / Hug contents / Fill container / «Hug contents + Min height»
 *   EN2 모드 칸 aria/title = «Width sizing» / «Height sizing»
 *   EN3 모달 높이 Hug 일 때 H 칸 placeholder = «Hug» · 사슬 막힘 까닭 문장 안 모드 낱말 = «(Hug)»
 *   저장 키·값(fixed/fill/full/auto) 무변 — 값 바꾸기는 옛 spec(l4b-wh-mode · grid-width-ui · modal …)이 잰다.
 * 빨강 기대: 8d2c01160 = 한국어(고정/자동/100%/풀폭/최소 · «너비 모드» · placeholder «자동»). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function boot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); });
  return errs;
}
const opts = (page, id) => page.evaluate((id) => [...document.querySelectorAll(`#${id} option`)].map((o) => [o.value, o.textContent.trim(), o.title]), id);
const aria = (page, id) => page.evaluate((id) => { const s = document.getElementById(id); return [s.getAttribute('aria-label'), s.closest('[data-field]')?.getAttribute('title') || '']; }, id);
const T = { fixed: 'Fixed', hug: 'Hug contents', fill: 'Fill container', minh: 'Hug contents + Min height' };

const SITES = [
  ['grid', async (page) => { await page.evaluate(() => { window.addGridBlock?.(); }); }, '.grid-block', 'grd-width-mode', [['fixed', 'Fixed', T.fixed], ['fill', 'Fill', T.fill]], 'Width sizing'],
  ['modal-w', async (page) => { await page.evaluate(() => window.addModalBlock({})); }, '.modal-block', 'mdl-wm', [['full', 'Fill', T.fill], ['fixed', 'Fixed', T.fixed]], 'Width sizing'],
  ['modal-h', async (page) => { await page.evaluate(() => window.addModalBlock({})); }, '.modal-block', 'mdl-hm', [['auto', 'Hug', T.hug], ['fixed', 'Min H', T.minh]], 'Height sizing'],
  ['sticker-text', async (page) => { await page.evaluate(() => window.addStickerBlock({ shape: 'text' })); }, '.sticker-block', 'stk-t-boxw-mode', [['fixed', 'Fixed', T.fixed], ['auto', 'Hug', T.hug]], 'Width sizing'],
  ['annotation', async (page) => { await page.evaluate(() => { const sec = document.querySelector('#canvas .section-block .section-inner');
    const b = window.makeAnnotationBlock({ points: [[200, 160], [500, 160]], text: 'A' }); b.id = 'enA'; sec.appendChild(b); }); }, '.annotation-block', 'annot-label-w-mode', [['fixed', 'Fixed', T.fixed], ['auto', 'Hug', T.hug]], 'Width sizing'],
];

for (const [name, make, cls, id, want, ar] of SITES) {
  test(`EN1·EN2 ${name} — 옵션 글 짧은 꼴 · title 긴 꼴 · aria «${ar}»`, async ({ page }) => {
    const errs = await boot(page);
    await make(page);
    await page.evaluate((cls) => { const b = [...document.querySelectorAll(`#canvas ${cls}`)].pop(); b.id = b.id || 'enB'; window.__enB = b.id; }, cls);
    await page.evaluate(() => { window.deselectAll(); window.selectBlock(window.__enB); if (window.__enB === 'enA') window.showAnnotationProperties(document.getElementById('enA')); });
    await page.waitForSelector(`#${id}`, { state: 'attached' });
    expect(await opts(page, id), `★EN1 ${id} 옵션 [값, 글, title]`).toEqual(want);
    const [al, ti] = await aria(page, id);
    expect(al, `★EN2 ${id} aria`).toBe(ar);
    expect(ti.startsWith(ar), `★EN2 ${id} 칸 title «${ti}»`).toBe(true);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('EN3 모달 높이 Hug — H 칸 placeholder «Hug» · 사슬 막힘 까닭 «(Hug)»', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => { window.addModalBlock({}); const b = [...document.querySelectorAll('#canvas .modal-block')].pop(); b.id = 'enM'; });
  await page.evaluate(() => { window.deselectAll(); window.selectBlock('enM'); });
  await page.waitForSelector('#mdl-hm', { state: 'attached' });
  expect(await page.inputValue('#mdl-hm'), '[전제] auto').toBe('auto');
  expect(await page.evaluate(() => document.querySelector('[data-field="layout-h"] input')?.getAttribute('placeholder')), '★EN3 placeholder').toBe('Hug');
  expect(await page.evaluate(() => document.querySelector('[data-field="layout-h"] input')?.getAttribute('title')), '★EN3 막힌 칸 까닭').toContain('(Hug)');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 지디 판정(남은 목록 · FigCraft 기준): ① 그리드 행 높이 칸 placeholder 자동 → Hug ② 배너02 사슬 까닭 문장 속 자동 → (Hug) */
test('EN4 그리드 행 높이 칸 placeholder «Hug»(· 실측 높이)', async ({ page }) => {
  const errs = await boot(page);
  /* ★장면 고침(탑 게이트 261125 · EN4 7/8 빨강) — 행 높이 칸(.grd-row-h-item)은 행이 2개 이상일 때만 뜬다(prop-grid _rowHeightHtml rows.length < 2 → '') · addGridBlock 기본 1행이라 전제가 안 섰다 → 2행 auto 로 짓는다 */
  await page.evaluate(() => {
    const sec = document.querySelector('#canvas > .section-block');
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }, { height: 'auto' }] });
    g.id = 'enG'; (sec.querySelector('.row') || sec.querySelector('.section-inner')).appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
  });
  await page.evaluate(() => { window.deselectAll(); window.selectBlock('enG'); });
  await page.waitForSelector('.grd-row-h-item', { state: 'attached' });
  const ph = await page.evaluate(() => [...document.querySelectorAll('.grd-row-h-item')].map((i) => i.placeholder));
  expect(ph.length, '[전제] 행 칸 있음').toBeGreaterThan(0);
  for (const p of ph) expect(p, `★EN4 행 placeholder «${p}»`).toMatch(/^Hug( · \d+)?$/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('EN5 배너02 사슬 막힘 까닭 = 문장 한국어 · 모드 낱말 (Hug)', async ({ page }) => {
  const errs = await boot(page);
  const why = await page.evaluate(async () => { const m = await import('./js/props/prop-banner02.js'); return m.BN2_CHAIN_WHY ?? null; });
  const src = why ?? await page.evaluate(async () => (await (await fetch('./js/props/prop-banner02.js')).text()).match(/const BN2_CHAIN_WHY = '([^']*)'/)?.[1] ?? null);
  expect(src, '★EN5 문장 속 모드 낱말').toContain('(Hug)');
  expect(src, '★EN5 «자동» 없음').not.toContain('자동');
  expect(errs, errs.join(' | ')).toEqual([]);
});
