/* t13d-10 — 0.9.13 t13D-10 텍스트·갭 캔버스 리사이즈 손잡이 + 우측패널 1120b F2(텍스트 높이 auto 풀기) · 지디 설계 GO 261120
 *   텍스트 «상자» 손잡이(js/overlay-handles.js showTextBoxResizeHandles · data-tbx-dir): 흐름 = 모서리 넷 + 변 넷 · 오버레이 = 옛 모서리(글자 비례) + 변 넷(크기만)
 *   높이 = «최소 높이»(data-fixed-h + min-height · 내용보다 작게 끌면 키 지움 = auto) · 갭 = 아래 변(s) 하나(높이 · 패널 칸 같이)
 * R1 흐름 텍스트 se 끌기 → 폭·높이 커짐 · data-width px · data-fixed-h · s 를 내용보다 위로 끌면 data-fixed-h 없음(auto) · 높이 = 내용
 * R2 갭 s 끌기 +30 → 높이 +30 · 패널 gap-number 같은 값 · ⌘Z 한 번 = 옛 높이
 * R3 옛 저장본 꼴(키 없음) — 고르고 손잡이만 떠도 data-fixed-h·min-height 안 생김(열기만으로 안 씀)
 * R4 오버레이 텍스트 e 변 → 폭만(글자 크기 무변) · 옛 se 모서리는 여전히 글자 비례(글자 커짐)
 * 양성대조: _patches/t13d-10-CTL.patch(흐름 텍스트 상자 손잡이 갈래 걷음 → R1 빨강 · 손잡이 0)
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); sec.id = 'sR'; window.applyZoom?.(100);
    const inner = sec.querySelector('.section-inner'); [...inner.children].forEach((x) => { if (!x.classList.contains('drop-indicator')) x.remove(); });
    const add = (fn) => { const before = new Set([...inner.children]); window.deselectAll(); window.selectSection(sec); fn(); return [...inner.children].find((x) => !before.has(x)); };
    const u1 = add(() => window.addTextBlock('body')); const tf = u1.matches('.frame-block[data-text-frame]') ? u1 : u1.querySelector('.frame-block[data-text-frame]');
    const tb = tf.querySelector('.text-block'); const ed = tb.querySelector('[class^="tb-"]'); if (ed) { ed.textContent = '두 줄 글\n둘째'; delete ed.dataset.isPlaceholder; }
    const gap = add(() => window.addGapBlock(40));
    window.deselectAll(); window.clearHistory?.();
    return { tf: tf.id, tb: tb.id, gap: gap.id };
  });
  await waitZoomSettled(page, 100);
  return { errs, ids };
}
const pick = async (page, id) => { await page.evaluate((id) => { window.selectBlock(id); window.showHandlesFor?.(document.getElementById(id)); document.activeElement?.blur?.(); }, id); await raf(page); };
const hp = (page, dir) => page.evaluate((d) => { const h = document.querySelector(`#ss-handles-overlay [data-tbx-dir="${d}"]`); if (!h || getComputedStyle(h).display === 'none') return null; const q = h.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; }, dir);
async function drag(page, dir, dx, dy) {
  const p = await hp(page, dir); expect(p, `[전제] ${dir} 손잡이`).toBeTruthy();
  const who = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.dataset?.tbxDir || null, p);
  expect(who, `[전제] 누를 점 임자 = ${dir} 손잡이`).toBe(dir);
  await page.mouse.move(p[0], p[1]); await page.mouse.down(); await page.mouse.move(p[0] + dx, p[1] + dy, { steps: 6 }); await page.mouse.up(); await raf(page);
}
const box = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return { w: e.offsetWidth, h: e.offsetHeight, dw: e.dataset.width ?? null, fh: e.dataset.fixedH ?? null, mh: e.style.minHeight }; }, id);

test('R1 흐름 텍스트 se → 폭·높이 · s 위로 내용보다 작게 = auto', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await pick(page, ids.tb);
  const a = await box(page, ids.tf);
  await drag(page, 'se', -120, 60);
  const b = await box(page, ids.tf);
  expect(b.w, `★폭 ${a.w}→${b.w}`).toBeLessThan(a.w - 100);
  expect(b.dw, '★data-width px').toBe(String(b.w));
  expect(b.h, `★높이 ${a.h}→${b.h}`).toBeGreaterThan(a.h + 40);
  expect(b.fh, '★data-fixed-h').toBe(String(b.h));
  await drag(page, 's', 0, -400);
  const c = await box(page, ids.tf);
  expect({ fh: c.fh, mh: c.mh }, '★내용보다 작게 = 키 지움(auto)').toEqual({ fh: null, mh: '' });
  expect(c.h, `★높이 = 내용(${c.h}) · 0 아님`).toBeGreaterThan(10);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R2 갭 s +30 → 높이 · 패널 값 · ⌘Z 한 번', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await pick(page, ids.gap);
  const h0 = (await box(page, ids.gap)).h;
  expect(await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay [data-tbx-dir]').length), '[전제] 갭 손잡이 = 아래 변 하나').toBe(1);
  await drag(page, 's', 0, 30);
  await expect.poll(async () => (await box(page, ids.gap)).h, '★높이 +30').toBe(h0 + 30);
  const nb = await page.evaluate(() => document.getElementById('gap-number')?.value ?? null);
  if (nb !== null) expect(nb, '★패널 숫자 = 높이').toBe(String(h0 + 30));
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await box(page, ids.gap)).h, '★⌘Z 한 번 = 옛 높이').toBe(h0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R3 옛 저장본 꼴(키 없음) — 고르기·손잡이만으로 안 씀', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await pick(page, ids.tb);
  expect(await page.evaluate(() => document.querySelectorAll('#ss-handles-overlay [data-tbx-dir]').length), '[전제] 흐름 텍스트 손잡이 8').toBe(8);
  const b = await box(page, ids.tf);
  expect({ fh: b.fh, mh: b.mh }, '★열기·고르기만으로 높이 키 안 생김').toEqual({ fh: null, mh: '' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R4 오버레이 텍스트 e 변 = 폭만(글자 무변) · se 모서리 = 글자 비례(옛 그대로)', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await page.evaluate((id) => { const tf = document.getElementById(id); const p = window.OverlayFloat.posElOf(tf); window.OverlayFloat.enterFloat(p); p.style.left = '40px'; p.style.top = '40px'; p.dataset.offsetX = '40'; p.dataset.offsetY = '40'; }, ids.tf);
  await pick(page, ids.tb);
  const fs = () => page.evaluate((id) => parseFloat(getComputedStyle(document.getElementById(id).querySelector('[class^="tb-"]')).fontSize), ids.tb);
  const f0 = await fs(), w0 = (await box(page, ids.tf)).w;
  await drag(page, 'e', 80, 0);
  expect((await box(page, ids.tf)).w, '★e 변 = 폭 +80 근처').toBeGreaterThan(w0 + 60);
  expect(await fs(), '★글자 크기 무변(크기만)').toBe(f0);
  const c = await page.evaluate(() => { const h = document.querySelector('#ss-handles-overlay [data-tf-resize-dir="se"]'); const q = h.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(c[0], c[1]); await page.mouse.down(); await page.mouse.move(c[0] + 60, c[1] + 20, { steps: 6 }); await page.mouse.up(); await raf(page);
  expect(await fs(), '★옛 모서리 = 글자 비례(커짐)').toBeGreaterThan(f0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
