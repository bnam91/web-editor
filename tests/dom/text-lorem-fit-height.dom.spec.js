/* text-lorem-fit-height — 0.9.13 t13E-08(더미 글 = 높이에 맞춰 양만 · 상자 높이 고정) · t13E-09(늘렸다 줄이면 안 줄어듦) · 현빈 261122 · 태양
 *   실측(고치기 전 · 탐침 261123): 높이는 «최소 높이»(data-fixed-h + min-height · t13D-10)라 더미 글이 넘치면 상자가 글을 따라 커졌다(208 → 864 · 1글 → 208).
 *     넘친 채로 아래 변을 위로 끌면 «내용보다 작게 못 줄임»(설계 ②)이라 그대로(1497 → 1497) = t13E-09 의 모습.
 *   고침: js/props/prop-text-wireup-lorem.js fillLoremFit — 높이를 정한 상자면 그 높이에 들어가는 만큼만(개수 = 상한 · 한 조각도 넘치면 낱말로).
 * L1 높이 정한 상자 — 문장 12 채우기 → 상자 높이 그대로 · 글이 상자 안(넘침 0) · 문장 < 12 · 다시 문장 1 → 높이 그대로
 * L2 한 줄 상자(100 · 본문 한 줄 ≈ 83 실측) + 문단 4 → 낱말로 줄여 넘침 0 · 높이 그대로
 * L3 [지킴] 높이 안 정한(auto) 상자 → 옛 동작: 문장 3 = 마침표 3 · 상자가 글을 따라 커짐
 * L4 t13E-09 — 채운 뒤 아래 변을 위로 40 끌면 줄어든다(글이 상자 안이라)
 * 양성대조: _patches/text-height-CTL.patch(배선을 옛 fillLorem 으로) ⇒ L1·L2·L4 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, fixedH) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (fixedH) => {
    window.__admin = { ...(window.__admin || {}), state: () => ({ isAdmin: true }) };   // [전제] 상자 손잡이(L4) = 관리자만(t13E-10)
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); sec.id = 'sH'; sec.style.minHeight = '900px'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body');
    const tf = sec.querySelector('.frame-block[data-text-frame]'), tb = tf.querySelector('.text-block');
    if (fixedH) { tf.dataset.fixedH = String(fixedH); tf.style.minHeight = fixedH + 'px'; }   // 손잡이가 쓰는 두 키 그대로(t13D-10 _onTextBoxResizeMouseDown)
    window.selectBlock(tb.id); window.showTextProperties?.(tb);
    return { tf: tf.id, tb: tb.id };
  }, fixedH);
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => !!document.getElementById('txt-lorem-run'), null, { polling: 100, timeout: 5000 });
  return { errs, ids };
}
async function fill(page, unit, count) {
  await page.selectOption('#txt-lorem-unit', unit);
  await page.fill('#txt-lorem-count', String(count));
  await page.click('#txt-lorem-run'); await raf(page);
}
const measure = (page, ids) => page.evaluate((ids) => {
  const f = document.getElementById(ids.tf), b = document.getElementById(ids.tb), mh = f.style.minHeight; f.style.minHeight = ''; const content = f.offsetHeight; f.style.minHeight = mh;
  const t = b.textContent || ''; return { h: f.offsetHeight, content, fh: f.dataset.fixedH ?? null, dots: (t.match(/\./g) || []).length, len: t.trim().length };
}, ids);

test('L1 높이 정한 상자 — 문장 12 → 높이 그대로 · 넘침 0 · 문장 1 → 그대로', async ({ page }) => {
  const { errs, ids } = await scene(page, 200);
  await fill(page, 'sentence', 12);
  const a = await measure(page, ids);
  await fill(page, 'sentence', 1);
  const b = await measure(page, ids);
  console.log('[L1 실측]', JSON.stringify({ a, b }));
  expect([a.h, b.h], '★상자 높이 = 정한 200 그대로(글 따라 안 늘고 안 줄음)').toEqual([200, 200]);
  expect(a.content <= 200 && a.len > 0, `★글이 상자 안(내용 ${a.content}px)`).toBe(true);
  expect(a.dots < 12, `★들어가는 만큼만(문장 ${a.dots} · 한 문장도 넘치면 낱말로 = 마침표 0)`).toBe(true);   // 본문 한 줄 ≈ 83px(실측) — 200 = 두 줄
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L2 한 줄 상자 + 문단 4 → 낱말로 줄여 넘침 0', async ({ page }) => {
  const { errs, ids } = await scene(page, 100);
  await fill(page, 'paragraph', 4);
  const a = await measure(page, ids);
  console.log('[L2 실측]', JSON.stringify(a));
  expect(a.h, '★높이 그대로').toBe(100);
  expect(a.content <= 100 && a.len > 0, `★넘침 0 · 글 있음(내용 ${a.content}px)`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L3 [지킴] auto 상자 → 옛 동작(문장 3 = 마침표 3 · 상자가 글을 따름)', async ({ page }) => {
  const { errs, ids } = await scene(page, 0);
  const a0 = await measure(page, ids);
  await fill(page, 'sentence', 3);
  const a = await measure(page, ids);
  console.log('[L3 실측]', JSON.stringify({ a0, a }));
  expect({ dots: a.dots, fh: a.fh }, '★개수 그대로 · 높이 키 안 생김').toEqual({ dots: 3, fh: null });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('L4 t13E-09 — 채운 뒤 아래 변을 위로 끌면 줄어든다', async ({ page }) => {
  const { errs, ids } = await scene(page, 240);
  await fill(page, 'paragraph', 4);
  await page.evaluate((id) => { window.selectBlock(id); window.showHandlesFor?.(document.getElementById(id)); document.activeElement?.blur?.(); }, ids.tb); await raf(page);
  const a = await measure(page, ids);
  const p = await page.evaluate(() => { const h = document.querySelector('#ss-handles-overlay [data-tbx-dir="s"]'); if (!h) return null; const r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  expect(p, '[전제] 아래 변 손잡이').toBeTruthy();
  await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.move(p[0], p[1] - 40, { steps: 6 }); await page.mouse.up(); await raf(page);
  const b = await measure(page, ids);
  console.log('[L4 실측]', JSON.stringify({ a, b }));
  expect(b.h < a.h, `★줄어듦 ${a.h} → ${b.h}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
