/* slide-preview-capture — 0.9.13 199 HBQA-GIF-SLIDEFX-FLASH-01(현빈 9510 QA ☐9 · 미카사 실앱: GIF 단추 직후·효과 고르기 직후 흰 한 장)
 * 원인(코드): 프레임 칸 슬라이드 미리보기도 내보내기와 같은 native 캡처(main.js _captureSectionCdp · Page.captureScreenshot captureBeyondViewport = 창 보기를 잠깐 키워 찍음)를 탔다.
 * 고침: 미리보기(slidePrepare(b, {preview:true}) — GIF 창 미리보기·캔버스 재생·블럭 ▶)는 비네이티브(html2canvas) · 내보내기(_exportSlideGif)는 native 그대로.
 * ⚠️헤드리스엔 native 캡처가 없어 «번쩍» 자체는 못 잰다 → native 찍기 입구(window.electronAPI.captureSectionCdp)를 세는 가짜로 «어느 길을 탔나»를 잰다(번쩍 = 그 입구를 탈 때만 남).
 * V1 GIF 단추(진짜 클릭) → 미리보기가 칸 그림 준비(_sldImgs) · 그 길 = 비네이티브 · native 찍기 입구 0번
 * V2 내보내기 준비(slidePrepare 옵션 없음) = native 길(_sldImgs.native true · 옛 그대로 · 품질 무변) — 헤드리스는 native 찍기가 앞단에서 실패해 입구 수는 못 잼
 * 양성대조: _patches/hbqa-199-CTL.patch(미리보기도 native) ⇒ V1 빨강
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (PNG1) => {
    window.__nat = 0;
    window.__admin?._forceState?.({ ok: true, isAdmin: true });   // [전제] GIF 단추 = 관리자만(«어드민 계정에서만»)
    window.electronAPI = Object.assign(window.electronAPI || {}, { captureSection: async () => PNG1, captureSectionCdp: async () => { window.__nat++; return PNG1; } });   // native 판정(isNativeCapture = captureSection 있음) + native 찍기 입구(captureCloneToCanvas → captureSectionCdp)를 세는 가짜 — 헤드리스엔 둘 다 없다
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll(); window.selectSection(sec); window.addSlideBlock();
    const b = sec.querySelector('.slide-block'); b.id = b.id || 'sP'; window.selectBlock(b.id);
    return b.id;
  }, PNG1);
  const fr = await page.evaluate((id) => window.isFrameSlide(document.getElementById(id)), id);
  expect(fr, '[전제] 새 슬라이드 = 프레임 칸(미리보기가 섹션을 찍는 길)').toBe(true);
  return { errs, id };
}

test('V1 GIF 단추 → 미리보기 그려짐 · native 캡처 입구 0번', async ({ page }) => {
  const { errs, id } = await scene(page);
  await page.waitForSelector('#open-anim-btn');
  await page.click('#open-anim-btn');
  await page.waitForFunction((id) => !!document.getElementById(id)?._sldImgs, id, { timeout: 8000 });   // 미리보기가 칸 그림을 준비했다(캔버스 폭 480 은 index.html 처음 값이라 «그려짐» 표식이 못 된다)
  const n = await page.evaluate(() => window.__nat), path = await page.evaluate((id) => document.getElementById(id)?._sldImgs?.native ?? null, id);
  console.log('[V1 실측]', JSON.stringify({ native: n, path, key: await page.evaluate((id) => (document.getElementById(id)?._sldImgs?.key || '').slice(0, 14), id) }));
  expect([path, n], '★미리보기 = 비네이티브 길(_sldImgs.native false) · native 찍기 입구 0 = 창 번쩍 없음').toEqual([false, 0]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 내보내기 준비(옵션 없음) = native 캡처 그대로', async ({ page }) => {
  const { errs, id } = await scene(page);
  await page.evaluate(async (id) => { await window.slidePrepare(document.getElementById(id)); }, id);
  const path = await page.evaluate((id) => document.getElementById(id)._sldImgs?.native ?? null, id);
  console.log('[V2 실측]', JSON.stringify({ path, err: await page.evaluate((id) => document.getElementById(id)._sldImgs?.err ?? null, id) }));
  expect(path, '★내보내기 = native 길 그대로(헤드리스엔 native 찍기가 끝까지 안 돌아 «길»만 잰다)').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
