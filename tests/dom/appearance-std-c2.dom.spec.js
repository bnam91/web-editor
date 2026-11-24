/* appearance-std-c2.dom.spec.js — 표준 Appearance A4(Opacity 칸) · C2 갈래 아홉 패널(정본 시안 8910 #mkp-appstd · PLAN-appearance-layout-std-261124 A4 · 탑 C2 발주 261124)
 *   sticker(글·기본·형광펜) · simple-card · canvas · innercard · coupon · laurel · step · iconify · cert
 *   AC1 칸 = `${prefix}-opacity` 하나(부품 data-field="appearance-opacity" 안) · 계약 없으면 100 · Appearance 절에 슬라이더 0
 *       laurel·step·iconify·cert·sticker(글 밖) = Opacity 만 새 절(모서리 칸·모서리 따로 단추 0 · 탑 판정 ①)
 *   AC2 40 → window.setBlockOpacity(그 블럭, 40)(계약 = 갈래 E · 여기선 시험이 가짜로 끼운다) · 이력 1
 *   양성대조(CTL) = 제품 파일 9 를 P 머리(1baa53b8f)로 되돌림 → AC1·AC2 전부 빨강(칸 없음).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/appearance-std-c2.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* [이름, 넣기(+필요하면 패널 열기), 블럭 클래스, 접두, 모서리 칸 있나] */
const CASES = [
  ['sticker(글)', "window.addStickerBlock({ shape: 'text' })", 'sticker-block', 'stk-t', true],
  ['sticker(기본)', 'window.addStickerBlock()', 'sticker-block', 'stk', false],
  ['sticker(형광펜)', "window.addStickerBlock({ shape: 'highlight' })", 'sticker-block', 'stk', false],
  ['simple-card', 'window.addCanvasBlock()', 'canvas-block', 'cvb', true],
  ['canvas', "window.addCanvasBlock(); { const b = [...document.querySelectorAll('#canvas .canvas-block')].pop(); delete b.dataset.cardMode; window.showCanvasProperties(b); }", 'canvas-block', 'cvb', true],
  ['innercard', 'window.addInnerCardBlock()', 'innercard-block', 'icd', true],
  ['coupon', 'window.addCouponBlock()', 'coupon-block', 'cpn', true],
  ['laurel', 'window.addLaurelBlock()', 'laurel-block', 'lrl', false],
  ['step', 'window.addStepBlock()', 'step-block', 'stb', false],
  ['iconify', "window.addIconifyBlock('', '', 64)", 'icon-block', 'icn', false],
  ['cert', 'window.addCertBlock()', 'cert-block', 'crt', false],
];

async function scene(page, add, prefix) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (add) => {
    window.__op = [];   // 갈래 E 계약 가짜 — 100 이면 키 지움(계약 그대로)
    window.setBlockOpacity = (b, v) => { window.__op.push([b, v]); if (v >= 100) delete b.dataset.opacity; else b.dataset.opacity = String(v); };
    window.readBlockOpacity = (b) => (b.dataset.opacity != null ? Number(b.dataset.opacity) : 100);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    (0, eval)(add);
  }, add);
  await expect(page.locator(`#${prefix}-opacity`), `[전제] ${prefix}-opacity 칸`).toHaveCount(1);
  return errs;
}

for (const [name, add, cls, p, hasRadius] of CASES) {
  test(`AC1 ${name} — Opacity 칸(부품 안 · 100) · Appearance 절 슬라이더 0 · 모서리 ${hasRadius ? '있음' : '없음'}`, async ({ page }) => {
    const errs = await scene(page, add, p);
    const o = await page.evaluate((p) => {
      const n = document.getElementById(`${p}-opacity`);
      const sec = n?.closest('.prop-section[data-sec="appearance"]');
      return {
        inPart: !!n?.closest('[data-part="appearance"] [data-field="appearance-opacity"]'),
        v: n?.value,
        slider: sec ? sec.querySelectorAll('input[type=range]').length : -1,
        radius: !!sec?.querySelector('[data-field="appearance-radius"]'),
        eye: !!sec?.querySelector(`#${p}-app-eye[aria-disabled="true"]`),
      };
    }, p);
    expect(o).toEqual({ inPart: true, v: '100', slider: 0, radius: hasRadius, eye: true });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`AC2 ${name} — 40 → setBlockOpacity(그 블럭, 40) · 이력 1`, async ({ page }) => {
    const errs = await scene(page, add, p);
    const r = await page.evaluate(([p, cls]) => {
      let ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { ph++; return o?.(...a); };
      const n = document.getElementById(`${p}-opacity`);
      n.value = '40'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
      const last = window.__op[window.__op.length - 1];
      const blk = [...document.querySelectorAll(`#canvas .${cls}`)].pop();
      return { v: last?.[1], same: last?.[0] === blk, key: blk?.dataset.opacity ?? null, ph };
    }, [p, cls]);
    expect(r).toEqual({ v: 40, same: true, key: '40', ph: 1 });
    expect(errs, errs.join('\n')).toEqual([]);
  });
}
