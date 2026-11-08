/* grid-bg-radius-shadow.dom.spec.js — GRID-BG-RADIUS-SHADOW-01 (현빈 0.9.10 QA): 그리드 «블럭 배경»을 켜면 모서리(코너) + 그림자.
 *   ★칸마다가 아니라 그리드 전체 바깥 상자(.grd-bg) 하나에. 그림자 칸 = 에셋 Effects 절 그대로(fxSectionHtml · 그림자 하나만 고를 수 있다).
 *   S1 패널: 배경 켜면 「코너」 슬라이더(prop-slider·prop-number) + Effects 절(추가 목록 = 그림자 하나) · 배경 끄면 둘 다 없다
 *   S2 코너 + 그림자 → .grd-bg 에만 border-radius·box-shadow · 블럭·칸엔 filter/box-shadow 0 · 화면 픽셀: 그림자 자리 어둡다 · 모서리 밖은 흰 바탕
 *   S3 PNG 내보내기 클론에서도 같은 픽셀(모서리 둥긂 · 그림자)
 *   S4 저장→다시 열기 유지 · ⌘Z 한 번 = 그림자 추가 전
 * ★양성대조: grid-block.js _gridBlockBgHtml 의 radius·box-shadow 두 줄을 빼면 S2·S3·S4 빨강 · effects-shadow supports 의 grid 가지를 빼면 S1 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const BG = '#2f3d57';
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1" style="background:#ffffff"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:80px;padding-right:80px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="gR" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:120px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g);
    window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.applyZoom?.(100);
    g.scrollIntoView({ block: 'center' }); window.clearHistory?.();
  });
  await page.waitForTimeout(300);
  return errs;
}
const upd = async (page, partial) => { const r = await page.evaluate((p) => window.updateGridBlock('gG', p), partial); expect(r && r.ok, JSON.stringify(r)).toBe(true); };
const shadowOn = (page) => page.evaluate(() => window.setFxShadow(document.getElementById('gG'), { state: 'on', x: 0, y: 12, blur: 0, op: 100, color: '#000000' }));
const styles = (page) => page.evaluate(() => {
  const g = document.getElementById('gG'); const b = g.querySelector(':scope > .grd-bg');
  const cs = b && getComputedStyle(b);
  return { radius: cs?.borderTopLeftRadius ?? null, shadow: cs?.boxShadow ?? null, blockFilter: g.style.filter || '', blockShadow: getComputedStyle(g).boxShadow,
    cellFx: [...g.querySelectorAll('.grd-cell')].some(c => getComputedStyle(c).boxShadow !== 'none' || getComputedStyle(c).filter !== 'none') };
});
/** 뷰포트 사각형(.grd-bg) */
const bgRect = (page) => page.evaluate(() => { const r = document.querySelector('#gG > .grd-bg').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
/** 스크린샷 버퍼에서 점들의 색 — 'dark'(R,G,B<90) / 'white'(>235) / 'other'. sx = 이미지 px / CSS px */
async function colorsIn(page, buf, pts, sx = 1) {
  return page.evaluate(async ([b64, pts, sx]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    return pts.map(([X, Y]) => { const d = x.getImageData(Math.round(X * sx), Math.round(Y * sx), 1, 1).data;
      return d[0] < 90 && d[1] < 90 && d[2] < 110 ? 'dark' : (d[0] > 235 && d[1] > 235 && d[2] > 235 ? 'white' : 'other'); });
  }, [buf.toString('base64'), pts, sx]);
}
/* 재는 점(상자 기준): 모서리 바깥 꼭짓점(1,1) · 그림자 띠(아래 변 밖 6px · 가로 가운데) · 그림자 없는 위 변 밖 6px · 상자 가운데 */
const probe = (R) => [[R.l + 2, R.t + 2], [R.l + R.w / 2, R.b + 6], [R.l + R.w / 2, R.t - 6], [R.l + R.w / 2, R.t + R.h / 2]];

test('S1 패널 — 배경 켜면 「코너」 + Effects(그림자 하나) · 끄면 없다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { window.selectBlock?.(document.getElementById('gG')); window.showGridProperties(document.getElementById('gG')); });
  expect(await page.evaluate(() => !!document.getElementById('grd-bbg-radius-slider') || !!document.getElementById('grdbb-fx-section'))).toBe(false);
  await upd(page, { blockBg: { on: true, color: BG } });
  await page.evaluate(() => window.showGridProperties(document.getElementById('gG')));
  const p = await page.evaluate(() => ({
    slider: document.getElementById('grd-bbg-radius-slider')?.className, num: document.getElementById('grd-bbg-radius-num')?.className,
    max: document.getElementById('grd-bbg-radius-slider')?.max,
    opts: [...(document.querySelectorAll('#grdbb-fx-add option') || [])].map(o => o.value).filter(Boolean),
    sameAsOpacity: (() => { const a = document.getElementById('grd-bbg-radius-slider'), b = document.getElementById('grd-bbg-op-slider'); return !!a && !!b && a.getBoundingClientRect().width === b.getBoundingClientRect().width; })(),
  }));
  expect(p).toEqual({ slider: 'prop-slider', num: 'prop-number', max: '80', opts: ['shadow'], sameAsOpacity: true });
  await page.selectOption('#grdbb-fx-add', 'shadow');
  await expect.poll(() => page.evaluate(() => !!document.getElementById('grdbb-fxsh-card'))).toBe(true);
  expect((await styles(page)).shadow).not.toBe('none');
});

test('S2 화면 — 코너·그림자는 배경 상자에만 · 픽셀', async ({ page }) => {
  await setup(page);
  await upd(page, { blockBg: { on: true, color: BG, radius: 24, padX: 20, padY: 20 } });
  await shadowOn(page);
  await page.evaluate(() => window.deselectAll?.());
  const s = await styles(page);
  expect(s.radius).toBe('24px');
  expect(s.shadow).toContain('12px');
  expect([s.blockFilter, s.blockShadow, s.cellFx], '블럭·칸엔 효과 없음').toEqual(['', 'none', false]);
  const R = await bgRect(page);
  expect(await colorsIn(page, await page.screenshot(), probe(R))).toEqual(['white', 'dark', 'white', 'dark']);
});

test('S3 PNG 내보내기 클론 — 같은 모서리·그림자', async ({ page }) => {
  await setup(page);
  await upd(page, { blockBg: { on: true, color: BG, radius: 24, padX: 20, padY: 20 } });
  await shadowOn(page);
  await page.evaluate(() => window.deselectAll?.());
  const p = await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const clone = await ex.prepareCloneForCapture(document.getElementById('gS'), 860, true);
    ex.renderComponentsInClone(clone);
    clone.id = '__clone'; Object.assign(clone.style, { position: 'fixed', zIndex: '2147483647', top: '0px', left: '0px', background: '#ffffff' });
    const B = clone.querySelector('.grid-block > .grd-bg'); const r = B.getBoundingClientRect(); const cr = clone.getBoundingClientRect();
    return { l: r.left - cr.left, t: r.top - cr.top, r: r.right - cr.left, b: r.bottom - cr.top, w: r.width, h: r.height, cw: cr.width };
  });
  await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());
  const shot = await page.locator('#__clone').screenshot({ type: 'png' });
  const sx = await page.evaluate(async ([b64, cw]) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); return i.width / cw; }, [shot.toString('base64'), p.cw]);
  const got = await colorsIn(page, shot, probe(p), sx);
  await page.evaluate(() => document.getElementById('__clone')?.remove());
  expect(got).toEqual(['white', 'dark', 'white', 'dark']);
});

test('S4 저장→다시 열기 유지 · ⌘Z 한 번 = 그림자 추가 전', async ({ page }) => {
  await setup(page);
  await upd(page, { blockBg: { on: true, color: BG, radius: 24 } });
  await shadowOn(page);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  const s = await styles(page);
  expect([s.radius, s.shadow.includes('12px')]).toEqual(['24px', true]);
  // ⌘Z — 새 판에서 다시 한 번 그림자를 켜고 되돌린다
  await page.evaluate(() => { window.setFxShadow(document.getElementById('gG'), { state: 'none' }, { history: false }); window.clearHistory?.(); });
  await shadowOn(page);
  expect((await styles(page)).shadow).not.toBe('none');
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await styles(page)).shadow).toBe('none');
  expect((await styles(page)).radius, '코너는 그대로').toBe('24px');
});
