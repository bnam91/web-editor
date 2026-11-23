/* ifg-icon-fit-circle — 0.9.13 t13F-04(인포블럭 아이콘 크기 조절 안 됨 · 안쪽 잘림 · grd_svlkp_9cazksm) · 현빈 261122 · 태양
 *   탐침 실측(고치기 전): 자리표시·내장 아이콘은 뿌리 viewBox 에 둘레 여백(-4.5 -4.5 33 33)이 있어 원(144 · overflow hidden)에 들어가지만,
 *     iconify 로 고른 아이콘은 viewBox 0 0 24 24 그대로라 100% 에서 모서리가 원에 잘렸다. 「아이콘 크기」는 20~100% 로 «줄이기만» 돼(패널 칸 60 → 86px 실측)
 *     100% 가 이미 잘리는 크기라 «키워서 맞추기»가 안 된다 = «크기 조절 안 됨»으로 보임.
 *   고침: js/blocks/grid-ifg-icon-pick.js ifgCommitIcon — 고른 svg 뿌리 viewBox 에 자리표시와 같은 여백(ifgPadViewBox) ⇒ 100% = 원 안에 다 듦.
 * F1 정사각 아이콘(2..22 꽉 찬 사각 · iconify 꼴)을 고르개 커밋 길로 → 원 가장자리 안쪽 띠(반지름 0.90~0.97)에 아이콘 잉크 0
 * F2 [지킴] 「아이콘 크기」 50 → 그림 폭 = 원의 절반(조절은 그대로 산다)
 * 양성대조: _patches/info-icon-CTL.patch(커밋 길의 여백 한 줄 되돌림) ⇒ F1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SQ = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v20H2z"/></svg>';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (SQ) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); sec.id = 'sG'; sec.style.backgroundColor = '#ffffff'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec);
    const b = window.addInfographicBlock(); window.deselectAll();
    const fr = b.querySelector('.grd-img-circle'); const t = window.ifgIconPickTarget(b, fr);
    window.ifgCommitIcon(b, t, { name: 'test:square', svg: SQ });   // 고르개 «더 찾기»(iconify)가 넘기는 꼴 그대로
    return b.id;
  }, SQ);
  await waitZoomSettled(page, 100);
  await page.waitForFunction((id) => { const im = document.querySelector(`#${id} .grd-img-circle img`); return !!im && im.complete && im.naturalWidth > 0; }, id, { polling: 100, timeout: 5000 });
  return { errs, id };
}
/* 첫 원을 진짜 화면에서 찍어(CDP) 페이지 캔버스로 읽고, 가장자리 안쪽 띠의 어두운 점 수를 센다 */
async function ringInk(page, id) {
  const loc = page.locator(`#${id} .grd-img-circle`).first();
  await loc.scrollIntoViewIfNeeded(); await raf(page);
  const png = (await loc.screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height).data;
    const R = cv.width / 2; let ink = 0, all = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const r = Math.hypot(x + 0.5 - R, y + 0.5 - R) / R;
      if (r < 0.90 || r > 0.97) continue;
      all++; const i = (y * cv.width + x) * 4; if (d[i] + d[i + 1] + d[i + 2] < 200) ink++;
    }
    return { ink, all, w: cv.width };
  }, png);
}

test('F1 고른 정사각 아이콘 — 원 가장자리 띠에 잉크 0(안 잘림)', async ({ page }) => {
  const { errs, id } = await scene(page);
  const r = await ringInk(page, id);
  const vb = await page.evaluate((id) => { const s = document.querySelector(`#${id} .grd-img-circle img`).getAttribute('src'); return /viewBox="([^"]+)"/.exec(decodeURIComponent(escape(atob(s.split(',')[1]))))?.[1]; }, id);
  console.log('[F1 실측]', JSON.stringify({ ...r, vb }));
  expect(r.all, '[전제] 띠 점이 있다').toBeGreaterThan(100);
  expect(r.ink, `★원 가장자리 띠에 아이콘 잉크(잘린 모서리) ${r.ink}/${r.all}`).toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F2 [지킴] 「아이콘 크기」 50 → 그림 폭 = 원의 절반', async ({ page }) => {
  const { errs, id } = await scene(page);
  await page.evaluate((id) => window.applyIfgIconScale(document.getElementById(id), 50), id); await raf(page);
  const r = await page.evaluate((id) => { const f = document.querySelector(`#${id} .grd-img-circle`), im = f.querySelector('img'); return { f: f.offsetWidth, im: im.offsetWidth }; }, id);
  console.log('[F2 실측]', JSON.stringify(r));
  expect(Math.abs(r.im - r.f / 2) <= 1, `★50% = 원의 절반 (${r.im}/${r.f})`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
