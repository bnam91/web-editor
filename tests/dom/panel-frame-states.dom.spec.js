/* panel-frame-states — 틀(js/props/_panel-frame.js)이 그린 절 머리의 상태들. (right-panel-unify U0 · A-6) 파일럿 = 갭 · 브릿지.
 * S1 hover — 제목 색이 --ui-sec-title-color → --ui-sec-title-color-hover 로 바뀐다 (토큰이 정의돼 있다)
 * S2 키보드 — Tab 으로 절 머리 도달 · :focus-visible 링(outline ≠ none) · Enter/Space 토글 · aria-expanded 반전 · aria-controls == 몸통 id
 * S3 넘침 — 좁은 패널 · 60자 블록 이름 · 긴 special 제목에도 패널·절에 가로 넘침 0 · 제목은 ellipsis
 * S4 겹침 0 — 절 머리 사각형끼리 안 겹치고 패널 안에 있다 · 제목 글자 ≥ --ui-fs-10
 * 양성대조(사람이 돌린다): S1 = editor-base.css 의 --ui-sec-title-color-hover 줄 삭제 → 빨강 ·
 *   S2 = _panel-frame.js 의 panel.addEventListener('keydown' …) 제거 → 빨강 · S3 = 제목 span 의 text-overflow:ellipsis 제거 → 빨강.
 * ⛔화면 px 를 상수와 견주지 않는다(dom-screen-px-census) — 사각형끼리만 비교한다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { addKind } = require('./_block-roster-294.js');

const GAP = { cls: 'gap-block', entry: 'addGapBlock' };
const BRIDGE = { cls: 'bridge-block', entry: 'addBridgeBlock' };

async function open(page, kind) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  const r = await addKind(page, kind);
  expect(r.err, `[전제] ${kind.cls} 넣기`).toBeUndefined();
  await page.evaluate((id) => window.selectBlock(id), r.id);
  await expect(page.locator('#psec-size-head'), '[전제] 틀이 그린 절 머리').toBeVisible();
  return { errs, id: r.id };
}
/** 토큰을 color 로 걸어 본 계산값(var() 사슬을 브라우저가 푼다). */
const tokenColor = (page, name) => page.evaluate((name) => {
  const p = document.createElement('span'); p.style.color = `var(${name})`; document.body.appendChild(p);
  const v = getComputedStyle(p).color; p.remove(); return v;
}, name);
const tokenRaw = (page, name) => page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), name);
const colorOf = (page, sel) => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).color, sel);

test('S1 hover — 제목 색이 hover 토큰으로 바뀐다', async ({ page }) => {
  const { errs } = await open(page, GAP);
  expect(await tokenRaw(page, '--ui-sec-title-color-hover'), '★hover 토큰이 정의돼 있지 않다').not.toBe('');
  const base = await tokenColor(page, '--ui-sec-title-color');
  const hover = await tokenColor(page, '--ui-sec-title-color-hover');
  expect(base, '[전제] 두 토큰 색이 달라야 이 검사가 무엇을 잰다').not.toBe(hover);
  await page.mouse.move(0, 0);
  await expect.poll(() => colorOf(page, '#psec-size-head'), '평소 색').toBe(base);
  await page.hover('#psec-size-head');
  await expect.poll(() => colorOf(page, '#psec-size-head'), 'hover 색').toBe(hover);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S2 키보드 — Tab 도달 · focus-visible 링 · Enter/Space 토글 · aria', async ({ page }) => {
  const { errs } = await open(page, GAP);
  // 패널 맨 앞에 임시 단추를 두고 거기서 Tab — 블록 머리에는 포커스 받을 것이 없으니 다음 칸이 첫 절 머리다
  await page.evaluate(() => { const b = document.createElement('button'); b.id = '__tabstart'; document.querySelector('#panel-right .panel-body').prepend(b); b.focus(); });
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.id), '★Tab 으로 절 머리에 못 간다').toBe('psec-size-head');
  await page.evaluate(() => document.getElementById('__tabstart').remove());
  const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, fv: document.activeElement.matches(':focus-visible') }; });
  expect(ring.fv, '[전제] 키보드 포커스').toBe(true);
  expect(ring.style, '★focus-visible 링이 없다').not.toBe('none');
  const head = page.locator('#psec-size-head');
  await expect(head).toHaveAttribute('aria-controls', 'psec-size-body');
  await expect(page.locator('#psec-size-body'), '★aria-controls 가 가리키는 몸통이 없다').toBeAttached();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#psec-size-body')).toBeHidden();
  await page.keyboard.press(' ');
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#psec-size-body')).toBeVisible();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S3 넘침 — 좁은 패널 · 긴 이름 · 긴 special 제목에도 가로 넘침 0 · 제목 ellipsis', async ({ page }) => {
  const { errs, id } = await open(page, BRIDGE);
  const out = await page.evaluate(async (id) => {
    const { renderPanel, sec } = await import('/js/props/_panel-frame.js');
    const { blockHeaderHTML } = await import('/js/props/_helpers.js');
    document.getElementById('panel-right').style.width = '240px';
    const b = document.getElementById(id);
    const longTitle = '아주 긴 블록 고유 절 제목이 패널 폭을 넘어서는 경우를 봅니다';
    renderPanel(b, { header: blockHeaderHTML({ name: '가'.repeat(60), id: b.id }), sections: [sec('size', '<div class="prop-row"><span class="prop-label">높이</span></div>'), sec('special', '<div class="prop-row">x</div>', { title: longTitle })] });
    const body = document.querySelector('#panel-right .panel-body');
    const over = [body, ...body.querySelectorAll(':scope > .prop-section')].filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.id || e.className);
    const span = document.querySelector('#psec-special-0-head > span');
    return { over, ellipsis: getComputedStyle(span).textOverflow, clipped: span.scrollWidth > span.clientWidth };
  }, id);
  expect(out.clipped, '[전제] 긴 제목이 실제로 잘릴 만큼 길다').toBe(true);
  expect(out.over, '★가로 넘침').toEqual([]);
  expect(out.ellipsis, '★긴 제목이 ellipsis 로 안 접힌다').toBe('ellipsis');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('S4 겹침 0 — 절 머리끼리 안 겹치고 패널 안 · 제목 글자 ≥ --ui-fs-10', async ({ page }) => {
  const { errs } = await open(page, BRIDGE);
  const r = await page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body');
    const P = body.getBoundingClientRect();
    const heads = [...body.querySelectorAll('.prop-section[data-sec] > .prop-sec-head')].map((h) => h.getBoundingClientRect());
    const probe = document.createElement('span'); probe.style.fontSize = 'var(--ui-fs-10)'; document.body.appendChild(probe);
    const minFs = parseFloat(getComputedStyle(probe).fontSize); probe.remove();
    const fs = [...body.querySelectorAll('.prop-section[data-sec] > .prop-sec-head > .prop-section-title')].map((t) => parseFloat(getComputedStyle(t).fontSize));
    const overlap = []; for (let i = 1; i < heads.length; i++) if (heads[i].top < heads[i - 1].bottom - 0.5) overlap.push(i);
    const outside = heads.filter((h) => h.left < P.left - 0.5 || h.right > P.right + 0.5).length;
    return { n: heads.length, overlap, outside, small: fs.filter((v) => v < minFs).length };
  });
  expect(r.n, '[전제] 브릿지 절 셋').toBe(3);
  expect(r.overlap, '★절 머리 겹침').toEqual([]);
  expect(r.outside, '★패널 밖 절 머리').toBe(0);
  expect(r.small, '★--ui-fs-10 보다 작은 제목').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
