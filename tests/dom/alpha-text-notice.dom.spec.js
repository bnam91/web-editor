/* alpha-text-notice.dom.spec.js — 불투명도 글자 칸이 -1 을 1% 로 먹던 값(옛 파서 /(\d+)/ 가 부호를 버렸다)의 자 · 시트 239·276 꼴.
 * 칸 = wireColorField(#dvd-alpha) · 글자 #txt-color-alpha · 그라데이션 .grad-stop-alpha · 그림자 #txt-shadow-color-alpha · 페이지 #page-bg-alpha-input · 색 팝업 알파.
 * ⛔이 자가 안 재는 것: wireColorField 를 쓰는 다른 패널 색 칸 전수(같은 함수다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const toast = (page) => page.evaluate(() => { const t = document.getElementById('editor-toast'); return t && t.classList.contains('show') ? t.textContent : null; });
const put = async (page, sel, v) => { const i = page.locator(sel).first(); await i.click(); await i.press('ControlOrMeta+a'); if (v) await page.keyboard.type(v); else await page.keyboard.press('Backspace'); await page.keyboard.press('Enter'); await page.evaluate(() => document.activeElement?.blur?.()); };
const hideToast = (page) => page.evaluate(() => document.getElementById('editor-toast')?.classList.remove('show'));

async function boot(page, add, cls) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ add, cls }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec); await window[add]();
    window.__b = sec.querySelector('.' + cls); window.selectBlock(window.__b.id);
  }, { add, cls });
  return errs;
}

const FIELDS = [
  { name: '#dvd-alpha', add: 'addDividerBlock', cls: 'divider-block', sel: '#dvd-alpha', model: (p) => p.evaluate(() => window.__b.dataset.lineColor), full: '#cccccc', at: (n) => `rgba(204,204,204,${n})` },
  { name: '#txt-color-alpha', add: 'addTextBlock', cls: 'text-block', sel: '#txt-color-alpha', model: (p) => p.evaluate(() => { const c = document.getElementById('txt-color-alpha').closest('.prop-color-field').querySelector('.prop-color-swatch').style.background; return c.match(/^rgba\(.*,\s*([\d.]+)\)$/)?.[1] ?? '1'; }), full: '1', at: (n) => String(n) },
  { name: '.grad-stop-alpha', add: 'addGradientBlock', cls: 'gradient-block', sel: '.grad-stop-alpha', model: (p) => p.evaluate(() => window.__b.dataset.gradStartAlpha), full: '1', at: (n) => String(n) },
];

for (const f of FIELDS) {
  test.describe(f.name, () => {
    test.beforeEach(async ({ page }) => {
      page.__errs = await boot(page, f.add, f.cls);
      await expect(page.locator(f.sel).first(), '[전제] 칸이 보인다').toBeVisible();
      await expect.poll(() => f.model(page), { message: '[전제] 처음 값' }).toBe(f.full);
    });
    test('-1 은 1% 가 아니다 — 0 으로 죄고 말한다', async ({ page }) => {
      await put(page, f.sel, '-1');
      await expect.poll(() => f.model(page)).toBe(f.at(0));
      await expect.poll(() => toast(page), { timeout: 2500 }).toContain('입력 -1 → 적용 0');
      expect(page.__errs).toEqual([]);
    });
    test('abc 는 안 먹고 말한다', async ({ page }) => {
      await put(page, f.sel, 'abc');
      await expect.poll(() => toast(page), { timeout: 2500 }).toContain('「abc」');
      expect(await f.model(page)).toBe(f.full);
      await expect(page.locator(f.sel).first()).toHaveValue('100');
      expect(page.__errs).toEqual([]);
    });
    test('[음성] 50 · 빈 칸엔 말이 없다', async ({ page }) => {
      await put(page, f.sel, '50');
      await expect.poll(() => f.model(page)).toBe(f.at(0.5));
      expect(await toast(page)).toBeNull();
      await put(page, f.sel, '');
      await expect(page.locator(f.sel).first()).toHaveValue('50');
      expect(await toast(page)).toBeNull();
      expect(page.__errs).toEqual([]);
    });
  });
}

test('#dvd-alpha [음성] 「50%」 는 전처럼 50 · 말 없음, 1.5 → 2 는 말한다', async ({ page }) => {
  const errs = await boot(page, 'addDividerBlock', 'divider-block');
  const line = () => page.evaluate(() => window.__b.dataset.lineColor);
  await put(page, '#dvd-alpha', '50%');
  await expect.poll(line).toBe('rgba(204,204,204,0.5)');
  expect(await toast(page)).toBeNull();
  await put(page, '#dvd-alpha', '1.5');
  await expect.poll(line).toBe('rgba(204,204,204,0.02)');
  await expect.poll(() => toast(page), { timeout: 2500 }).toContain('입력 1.5 → 적용 2');
  await hideToast(page);
  await put(page, '#dvd-alpha', '150');
  await expect.poll(line).toBe('#cccccc');
  await expect.poll(() => toast(page), { timeout: 2500 }).toContain('입력 150 → 적용 100');
  expect(errs).toEqual([]);
});

for (const [name, open, sel] of [
  ['그림자 #txt-shadow-color-alpha', async (p) => { await boot(p, 'addTextBlock', 'text-block'); await p.locator('#txt-fx-add').selectOption('shadow'); }, '#txt-shadow-color-alpha'],   /* ★t4-01 — 그림자는 Effects 목록에서 */
  ['페이지 #page-bg-alpha-input', async (p) => { await boot(p, 'addDividerBlock', 'divider-block'); await p.evaluate(() => { window.switchToTab('inspector'); if (!document.getElementById('design-system-panel').classList.contains('open')) window.DesignSystem.togglePanel(); }); if (!(await p.locator('#page-bg-alpha-input').isVisible())) await p.locator('.ds-section-label', { hasText: '캔버스' }).click(); }, '#page-bg-alpha-input'],
  ['색 팝업 알파', async (p) => { await boot(p, 'addDividerBlock', 'divider-block'); await p.locator('#dvd-color').click(); }, '.goya-cp-alpha-input'],
]) {
  test(`${name} — -1 은 0 으로 죄고 말한다 · abc 는 말한다`, async ({ page }) => {
    await open(page);
    await expect(page.locator(sel).first(), '[전제] 칸이 보인다').toBeVisible();
    await put(page, sel, '-1');
    await expect.poll(() => toast(page), { timeout: 2500 }).toContain('입력 -1 → 적용 0');
    await expect(page.locator(sel).first()).toHaveValue('0');
    await hideToast(page);
    await put(page, sel, 'abc');
    await expect.poll(() => toast(page), { timeout: 2500 }).toContain('「abc」');
    await expect(page.locator(sel).first()).toHaveValue('0');
  });
}
