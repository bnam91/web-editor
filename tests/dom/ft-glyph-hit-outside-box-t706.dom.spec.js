/* ft-glyph-hit-outside-box-t706.dom.spec.js — t7-06 자유변형 글자가 «그림보다 훨씬 큰» 자리에서 클릭을 먹던 것
 *
 * 시트 111행: 「t7-06 | 특정 블록(tb_ts0he_qg5wypv, ab_ts0he_cvtvnr1) 간 Cmd+G 그룹핑 불가 오류 수정」
 * 미카사 앱 실측(261026 · 저장본 proj_1792823705838 사본):
 *   핀 ca702d40 ×3 — ab 가운데의 임자 = tb_ts0he_qg5wypv(글자칸 tb-body · 화면 히트 상자 2340×960)
 *     ⇒ tb 클릭 → ab ⌘클릭이 tb 를 «끔» ⇒ ⌘G 「그룹으로 묶을 블록을 먼저 선택하세요.」
 *   고친 판 ×3(새 udata) — ab 가운데의 임자 = ab · ⌘G 「2개를 그룹으로 묶었어요」.
 * 장면: 그 저장본의 네 점(152.91,39.3 · 387.25,-37.17 · 392.4,489.77 · 67.93,271.54)을 본문 글상자에 그대로 건다.
 * 칸
 *   P0  전제 — 글자칸 화면 상자가 .text-block 상자보다 크다(원근이 히트 영역을 키운 장면이다)
 *   (합성 장면의 «밖 격자» 칸은 뺐다 — 핀에서도 초록이라 양성대조가 안 섰다 · 261026)
 *   A0/A/G  원 장면(저장본의 그 섹션 HTML) — A0 전제 · A ab 가운데 임자 = ab · G tb 클릭→ab ⌘클릭→⌘G = 한 그룹
 *   I   .text-block 상자 안 가운데 클릭 → 그 tb 가 골라진다 · 더블클릭 → 편집(.editing) · 편집 중엔 글자칸이 마우스를 받는다
 * 양성대조: GD1001_ROOT=<핀 ca702d40 사본> ⇒ A·G 빨강(ab 가운데를 tb 글자칸이 먹는다).
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const C = [[152.91, 39.3], [387.25, -37.17], [392.4, 489.77], [67.93, 271.54]];

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((C) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    sec.querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
    window.selectSection(sec);
    window.addTextBlock('body', { content: '온풍기 맥스 자유변형' });
    window.applyZoom?.(40);
    window.__tb = sec.querySelector('.text-block');
    window.deselectAll?.();
    window.setFxFreeTransform(window.__tb, C, { touched: true });
    window.__tb.scrollIntoView({ block: 'center' });
  }, C);
  await page.waitForFunction(() => getComputedStyle(window.__tb.querySelector('[class^="tb-"]')).transform.startsWith('matrix3d'));
  return errs;
}
const boxes = (page) => page.evaluate(() => {
  const ce = window.__tb.querySelector('[class^="tb-"]');
  const a = window.__tb.getBoundingClientRect(), b = ce.getBoundingClientRect();
  return { tb: [a.left, a.top, a.right, a.bottom], ce: [b.left, b.top, b.right, b.bottom] };
});

test('P0 전제 — 글자칸 화면 상자가 .text-block 상자보다 크다', async ({ page }) => {
  const errs = await setup(page);
  const { tb, ce } = await boxes(page);
  /* ★119 ㉡(S3 · 글자칸 폭을 글자에 박음) 뒤 원근이 키운 몫이 줄었다 — 넓이비 >2 → 1.60(실측 45441 / 28308).
     그래도 글자칸 상자가 .text-block 보다 «크다» ⇒ t7-06 막이(pointer-events:none)는 여전히 필요하다 · 전제는 «크다»로 잰다. */
  expect((ce[2] - ce[0]) * (ce[3] - ce[1])).toBeGreaterThan(1 * (tb[2] - tb[0]) * (tb[3] - tb[1]));
  expect(errs).toEqual([]);
});

test('I 상자 안 가운데 클릭 → 골라짐 · 더블클릭 → 편집 · 편집 중엔 글자칸이 마우스를 받는다', async ({ page }) => {
  const errs = await setup(page);
  const p = await page.evaluate(() => { const a = window.__tb.getBoundingClientRect(); return [a.left + a.width / 2, a.top + a.height / 2]; });
  await page.mouse.click(p[0], p[1]);
  await page.waitForFunction(() => window.__tb.classList.contains('selected'));
  await page.mouse.dblclick(p[0], p[1]);
  await page.waitForFunction(() => window.__tb.classList.contains('editing'));
  const pe = await page.evaluate(() => getComputedStyle(window.__tb.querySelector('[class^="tb-"]')).pointerEvents);
  expect(pe).not.toBe('none');
  expect(errs).toEqual([]);
});

/* ── 원 장면 — 저장본 proj_1792823705838 의 그 섹션 HTML(4.7KB · tests/dom/fixtures/t706-section.html) ── */
const fs = require('fs');
const path = require('path');
const SEC_HTML = fs.readFileSync(path.join(__dirname, 'fixtures', 't706-section.html'), 'utf8');
async function setupOrig(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
    window.applyZoom?.(40);
    window.watchAllFxFreeTransform?.(document);
    window.deselectAll?.();
    document.getElementById('ab_ts0he_cvtvnr1').scrollIntoView({ block: 'center' });
  }, SEC_HTML);
  await page.waitForFunction(() => { const ce = document.querySelector('#tb_ts0he_qg5wypv [class^="tb-"]'); return !!ce && getComputedStyle(ce).transform.startsWith('matrix3d'); });
  return errs;
}
const owner = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h ? (h.closest('.text-block,.asset-block')?.id || h.id || h.className.toString().slice(0, 20)) : null; }, id);

test('A0 전제(원 장면) — 두 블럭이 섰고 tb 는 자유변형 중 · 글자칸 화면 상자가 tb 상자보다 크다', async ({ page }) => {
  const errs = await setupOrig(page);
  const r = await page.evaluate(() => { const tb = document.getElementById('tb_ts0he_qg5wypv'); const ce = tb.querySelector('[class^="tb-"]'); const a = tb.getBoundingClientRect(), b = ce.getBoundingClientRect(); return { ab: !!document.getElementById('ab_ts0he_cvtvnr1'), ratio: (b.width * b.height) / (a.width * a.height) }; });
  expect(r.ab).toBe(true);
  expect(r.ratio).toBeGreaterThan(1);   /* ★119 ㉡ 뒤 2.x → 1.60(실측) — 위 P0 주석과 같은 까닭 */
  expect(errs).toEqual([]);
});

test('A 원 장면 — ab 가운데의 임자가 ab 다(전엔 tb 글자칸이 먹었다)', async ({ page }) => {
  const errs = await setupOrig(page);
  expect(await owner(page, 'ab_ts0he_cvtvnr1')).toBe('ab_ts0he_cvtvnr1');
  expect(await owner(page, 'tb_ts0he_qg5wypv')).toBe('tb_ts0he_qg5wypv');
  expect(errs).toEqual([]);
});

test('G 원 장면 — tb 클릭 → ab ⌘클릭 → ⌘G = 두 블럭이 한 그룹', async ({ page }) => {
  const errs = await setupOrig(page);
  const pt = (id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  const t = await pt('tb_ts0he_qg5wypv'), a = await pt('ab_ts0he_cvtvnr1');
  await page.mouse.click(t[0], t[1]);
  await page.waitForFunction(() => document.getElementById('tb_ts0he_qg5wypv').classList.contains('selected'));
  await page.keyboard.down('Meta'); await page.mouse.click(a[0], a[1]); await page.keyboard.up('Meta');
  await page.waitForFunction(() => document.getElementById('ab_ts0he_cvtvnr1').classList.contains('selected'));
  await page.keyboard.press('Meta+g');
  await page.waitForFunction(() => { const g1 = document.getElementById('tb_ts0he_qg5wypv').closest('.frame-block:not([data-text-frame])'), g2 = document.getElementById('ab_ts0he_cvtvnr1').closest('.frame-block:not([data-text-frame])'); return !!g1 && g1 === g2; });
  expect(errs).toEqual([]);
});
