/* frame-panel-size-shows-applied.dom.spec.js — 프레임 패널 Size 칸 = «그려진» 크기.
 *   FRAME-WIDTH-FIELD-SHOWS-UNCLAMPED-01 (0.9.12 · 미카사 261112): 섹션 직속 프레임 data-width 860 인데 화면은 716(max-width:100% 로 조여짐) — 칸은 860.
 *   LEGACY-TPL-FRAME-PANEL-HEIGHT-SHOWS-FLOOR-01 (0.9.12 · 미카사 261112): 옛 템플릿 프레임 data-height 100(바닥) · 내용으로 345 — 칸은 100.
 * ★고친 자리 = js/props/prop-frame.js _renderAutoPanel 의 width/height — offsetWidth/offsetHeight 먼저(안 그려졌을 때만 저장값).
 * 양성대조: 그 두 줄을 옛 꼴(parseInt(ss.dataset.width) || … / parseInt(ss.dataset.height) || …)로 되돌리면 W1·H1 빨강(칸 860 · 100).
 * W0 [지킴]: 조여지지 않은 프레임은 칸 = 저장값 = 그려진 값(고침이 멀쩡한 값을 바꾸지 않는다).
 * W2 [폴백]: 안 그려진 프레임(display:none → offset 0)은 칸 = 저장값(0 이나 빈 칸이 아니다).
 *   양성대조: 폴백(`|| parseInt(ss.dataset.width)` · `|| parseInt(ss.dataset.height)`)을 지우면 W2 빨강(780/520 기본값이 뜬다).
 * W3 [U3 평가 F2] 조여진 프레임(저장 860 · 그려진 ~716)의 너비를 «보이는 값 + 4» 로 — 자유배치 자식 폭 비율 ≈ (보이는+4)/보이는.
 *   양성대조: applyWidth 의 옛 폭을 저장값 먼저(parseInt(ss.dataset.width) || ss.offsetWidth)로 되돌리면 W3 빨강(자식 ~16% 더 준다).
 * 장면 = 섹션 안쪽 좌우 패딩 72(실앱 꼴). U3 도입 때 이게 빠져 W1·W3 전제가 안 섰다(r0914meas · 9e64f9f56 부터 빨강).
 *   양성대조(장면이 서고 제품을 잰다): js/props/prop-frame.js 만 9e64f9f56^ 판으로 → W3 빨강(옛 폭 = 저장 860 기준) ·
 *   02126da9d^ 판으로 → W1 빨강(칸 860). 각각 HEAD 로 되돌린다.
 * W4 패딩 제외(full-bleed) 프레임 — 그려진 폭은 그 기능이 정하므로 칸 = «끄면 돌아갈» 저장 폭(860 넘는 그려진 폭을 안 보인다).
 *   양성대조: _shownW 의 fullBleed 갈래를 지우면 W4 빨강(칸 = 그려진 폭).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="sS"><div class="section-hitzone"></div>' +
      /* ★좌우 패딩 72 = 실앱 섹션의 꼴(미카사 860 → 716 · W4 의 calc(100% + 144px) 와 같은 수). ⛔빼면 inner 가 860 이라 «조여진 프레임» 장면이 안 선다
         (r0914meas PROBE-W1: padding 0 · ow 860 — HTML 로 꽂은 섹션은 addSection 의 페이지 padX 를 안 탄다). */
      '<div class="section-inner" data-padding-x="72" style="padding-left:72px;padding-right:72px"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.();
    const S = document.getElementById('sS');
    window.selectSection(S); window.addFrameBlock();
    [...S.querySelectorAll('.frame-block:not([data-text-frame])')].pop().id = 'sF';
    window.deselectAll?.();
  });
  return errs;
}
const field = (page) => page.evaluate(() => {
  const f = document.getElementById('sF');
  window.showFrameProperties(f);
  return { w: document.getElementById('ss-width-num')?.value, h: document.getElementById('ss-height-num')?.value,
    ow: f.offsetWidth, oh: f.offsetHeight, dw: f.dataset.width, dh: f.dataset.height };
});

test('W1 data-width 가 상한을 넘어 조여진 프레임 — 너비 칸 = 그려진 너비', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const f = document.getElementById('sF'); f.dataset.width = '860'; f.style.width = '860px'; });
  const r = await field(page);
  expect(r.ow, `전제: 섹션 안쪽 폭에 조여졌다(그려진 ${r.ow})`).toBeLessThan(860);
  expect(r.dw, '전제: 저장값은 860 그대로').toBe('860');
  expect(r.w, '칸 = 그려진 너비').toBe(String(r.ow));
  expect(errs).toEqual([]);
});

test('H1 옛 템플릿 꼴(data-height = 바닥 · 내용으로 자람) — 높이 칸 = 그려진 높이', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => {
    const f = document.getElementById('sF');
    f.dataset.height = '100'; f.style.height = ''; f.style.minHeight = '100px';
    f.insertAdjacentHTML('beforeend', '<div id="sTall" style="position:static;height:345px"></div>');
  });
  const r = await field(page);
  expect(r.oh, `전제: 내용으로 자랐다(그려진 ${r.oh})`).toBeGreaterThan(100);
  expect(r.dh, '전제: 저장값은 바닥 100').toBe('100');
  expect(r.h, '칸 = 그려진 높이').toBe(String(r.oh));
  expect(errs).toEqual([]);
});

test('W0 [지킴] 조여지지 않은 프레임 — 칸 = 저장값 = 그려진 값', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const f = document.getElementById('sF'); f.dataset.width = '400'; f.style.width = '400px'; f.dataset.height = '300'; f.style.height = '300px'; f.style.minHeight = '300px'; });
  const r = await field(page);
  expect([r.ow, r.oh], '전제: 그려진 값 = 저장값').toEqual([400, 300]);
  expect([r.w, r.h]).toEqual(['400', '300']);
  expect(errs).toEqual([]);
});

test('W2 [폴백] 안 그려진 프레임 — 칸 = 저장값', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const f = document.getElementById('sF'); f.dataset.width = '640'; f.dataset.height = '360'; f.style.display = 'none'; });
  const r = await field(page);
  expect([r.ow, r.oh], '전제: 안 그려졌다(offset 0)').toEqual([0, 0]);
  expect([r.w, r.h], '칸 = 저장값(기본값 780/520 아님)').toEqual(['640', '360']);
  expect(errs).toEqual([]);
});

test('W3 [F2] 조여진 프레임 너비를 보이는 값+4 로 — 자식 폭은 그 비율로(저장 860 기준이 아니다)', async ({ page }) => {
  const errs = await scene(page);
  const r = await page.evaluate(() => {
    const f = document.getElementById('sF'); f.dataset.width = '860'; f.style.width = '860px';
    f.insertAdjacentHTML('beforeend', '<div id="sC" style="position:absolute;left:10px;top:10px;width:200px;height:40px"></div>');
    window.showFrameProperties(f);
    const n = document.getElementById('ss-width-num'); const shown = parseInt(n.value, 10);
    n.value = String(shown + 4); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true }));
    return { shown, child: parseInt(document.getElementById('sC').style.width, 10), free: f.dataset.freeLayout };
  });
  expect(r.free, '전제: 자유배치 프레임(자식 비율 갈래)').toBe('true');
  expect(r.shown, '전제: 조여져 보인다').toBeLessThan(860);
  const want = Math.round(200 * (r.shown + 4) / r.shown);
  expect(Math.abs(r.child - want), `자식 폭 ${r.child} — 기대 ${want} (저장 860 기준이면 ${Math.round(200 * (r.shown + 4) / 860)})`).toBeLessThanOrEqual(1);
  expect(errs).toEqual([]);
});

test('W4 패딩 제외 프레임 — 칸 = 저장 폭(그려진 폭은 패딩 제외가 정한다)', async ({ page }) => {
  const errs = await scene(page);
  const r = await page.evaluate(() => {
    const f = document.getElementById('sF'); f.dataset.width = '640'; f.style.width = 'calc(100% + 144px)'; f.style.maxWidth = 'none'; f.dataset.fullBleed = 'true';
    window.showFrameProperties(f);
    return { w: document.getElementById('ss-width-num').value, ow: f.offsetWidth };
  });
  expect(r.ow, '전제: 그려진 폭 ≠ 저장 폭').not.toBe(640);
  expect(r.w).toBe('640');
  expect(errs).toEqual([]);
});
