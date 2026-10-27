/* eyedropper-frame-t707.dom.spec.js — t7-07 프레임을 고른 채 i(스포이드) → 프레임이 아니라 섹션 색이 바뀌던 것
 *
 * 시트 112행 원문: 「t7-07 | 프레임 블록 선택 후 I 키 입력 시 프레임이 아닌 섹션 색상이 변경되는 오류 수정」
 * 장면: 섹션 → 툴바 Frame(addFrameBlock · 같은 함수) → 프레임을 진짜 마우스로 클릭해 고른다 → i.
 *   스포이드 창(EyeDropper)은 OS 창이라 헤드리스·앱 둘 다 못 누른다 ⇒ window.EyeDropper 를 «고른 색을 돌려주는» 대역으로 둔다
 *   (그 뒤 길 — 대상 고르기·칠하기·이력 — 은 제품 그대로).
 * 칸
 *   P0  전제 — 프레임이 골라졌다(.selected) · 섹션 배경과 프레임 배경을 찍어 둔다 · 대역이 섰다
 *   F   i → 프레임 dataset.bg = 고른 색 · computed 배경 = 그 색 · 섹션 dataset.bg·배경 그대로 · 이력 「프레임 배경 추출」 한 칸
 *   S   섹션만 고르고 i → 섹션이 바뀐다(옛 길 무회귀)
 * 양성대조: GD1001_ROOT=<핀 ca702d40 사본> ⇒ F 빨강(섹션이 바뀌고 프레임 그대로).
 * ⛔고정 대기 없음 — waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PICK = '#12ab34';

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((pick) => {
    window.EyeDropper = class { open() { window.__eyeOpened = (window.__eyeOpened || 0) + 1; return Promise.resolve({ sRGBHex: pick }); } };
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    window.addFrameBlock();
    window.__sec = sec;
    window.__fr = [...sec.querySelectorAll('.frame-block')].find((f) => f.dataset.textFrame !== 'true');
    window.deselectAll?.();
    window.__fr.scrollIntoView({ block: 'center' });
  }, PICK);
  await page.waitForFunction(() => !!window.__fr && window.__fr.getBoundingClientRect().height > 0);
  return errs;
}
const snap = (page) => page.evaluate(() => ({
  frSel: window.__fr.classList.contains('selected'), secSel: window.__sec.classList.contains('selected'),
  frBg: window.__fr.dataset.bg ?? null, frCss: getComputedStyle(window.__fr).backgroundColor,
  secBg: window.__sec.dataset.bg ?? null, secCss: getComputedStyle(window.__sec).backgroundColor,
  opened: window.__eyeOpened || 0, hist: window.historyIndex ?? window.__histPos ?? null,
}));
async function clickFrame(page) {
  const p = await page.evaluate(() => { const r = window.__fr.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const e = document.elementFromPoint(x, y); return { x, y, mine: !!(e && e.closest('.frame-block') === window.__fr) }; });
  expect(p.mine, '전제: 프레임 가운데의 임자가 그 프레임').toBe(true);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => window.__fr.classList.contains('selected'));
}

test('P0 전제 — 프레임이 골라지고 대역 스포이드가 섰다', async ({ page }) => {
  const errs = await setup(page);
  await clickFrame(page);
  const s = await snap(page);
  expect(s.frSel).toBe(true);
  expect(await page.evaluate(() => typeof window.EyeDropper)).toBe('function');
  expect(errs).toEqual([]);
});

test('F 프레임 고르고 i → 프레임이 바뀌고 섹션은 그대로', async ({ page }) => {
  const errs = await setup(page);
  await clickFrame(page);
  const s0 = await snap(page);
  await page.keyboard.press('i');
  await page.waitForFunction(() => (window.__eyeOpened || 0) >= 1);
  await page.waitForFunction((pick) => window.__fr.dataset.bg === pick || window.__sec.dataset.bg === pick, PICK);
  const s1 = await snap(page);
  expect({ frBg: s1.frBg, frCss: s1.frCss }).toEqual({ frBg: PICK, frCss: 'rgb(18, 171, 52)' });
  expect({ secBg: s1.secBg, secCss: s1.secCss }).toEqual({ secBg: s0.secBg, secCss: s0.secCss });
  expect(errs).toEqual([]);
});

test('S 섹션만 고르고 i → 섹션이 바뀐다(옛 길)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.deselectAll?.(); window.selectSection(window.__sec); });
  await page.waitForFunction(() => window.__sec.classList.contains('selected') && !document.querySelector('.frame-block.selected'));
  await page.keyboard.press('i');
  await page.waitForFunction((pick) => window.__sec.dataset.bg === pick, PICK);
  const s1 = await snap(page);
  expect(s1.secCss).toBe('rgb(18, 171, 52)');
  expect(errs).toEqual([]);
});
