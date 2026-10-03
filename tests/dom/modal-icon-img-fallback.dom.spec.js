/* modal-icon-img-fallback.dom.spec.js — 모달 아이콘이 «<img> 폴백»일 때 상자 안에 드는가.
 *   (B5, 2026-10-03: 모달에 아이콘을 넣으니 깨진다 — proj_1786077501267 의 mdl_ts0he_o9gwfer)
 *
 * ★측정(36cbe872, 고치기 전, 실제 proj.json 을 applyProjectData 로 얹어 잼 — 배율 0.4 환경이라 아래는 «화면 px»):
 *   · data-icon-svg = `<img src="https://api.iconify.design/material-symbols/warning-rounded.svg" width="64" height="64" style="display:block;">`
 *     — 인라인 svg 가 아니라 <img> 폴백이다(iconify 응답을 못 받았을 때의 꼴이 그대로 저장됨).
 *   · .mdl-icon 상자 24px(화면 9.6) 인데 그 안 img 는 64px(화면 25.6) — .mdl-icon svg 규칙만 있고 img 규칙이 없어 상자를 넘친다.
 *     (api.iconify.design 은 시험에서 page.route 로 막혀 naturalWidth=0 — 그래도 width 속성 64 가 박스를 정한다.)
 * ★외부 네트워크 의존 0 — api.iconify.design 은 page.route 로 «고정 svg» 를 돌려준다(naturalWidth>0 이 전제 단언).
 * ★양성대조: GD1001_ROOT=<36cbe872 체크아웃> 으로 돌리면 I1·I2·I3 이 빨강이어야 한다(I0 전제는 초록). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const IMG = '<img src="https://api.iconify.design/material-symbols/warning-rounded.svg" width="64" height="64" style="display:block;">';
const WIDE = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24"><rect width="48" height="24" fill="#c00"/></svg>';   // 2:1 — contain 이 «찌그러뜨리지 않는지» 가른다

async function setup(page, iconSvg) {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.route('https://api.iconify.design/**', r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: WIDE }));
  await bootApp(page);
  await page.evaluate(([svg]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sA" data-section="1" data-name="sA"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>');
    const { row, block } = window.makeModalBlock({ variant: 'icon-stack', text: '자칫 잘못했다가\n고가의 옷 버릴 수 있습니다.', iconSize: 24, wMode: 'full' });
    block.id = 'mdlI'; block.dataset.iconSvg = svg; document.getElementById('inA').appendChild(row);
    window.renderModalBlock(block); window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('mdlI').scrollIntoView({ block: 'center' });
  }, [iconSvg]);
  await page.waitForFunction(() => { const i = document.querySelector('#mdlI .mdl-icon img'); return !i || i.complete; });
  await page.waitForTimeout(200);
}
const measure = (page) => page.evaluate(() => {
  const ic = document.querySelector('#mdlI .mdl-icon'), img = ic.querySelector('img'), b = document.getElementById('mdlI');
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  return { box: R(ic), img: img && R(img), natural: img && img.naturalWidth, fit: img && getComputedStyle(img).objectFit, blockH: b.offsetHeight, boxCssW: ic.offsetWidth, imgOffW: img && img.offsetWidth, imgOffH: img && img.offsetHeight };
});

test('I0 전제: 폴백 <img> 가 실제로 그려졌고(naturalWidth>0) 상자는 24px 이다', async ({ page }) => {
  await setup(page, IMG);
  const m = await measure(page);
  expect(m.img).not.toBeNull();             // <img> 폴백이다(인라인 svg 가 아니다)
  expect(m.natural).toBeGreaterThan(0);     // 고정 svg 가 실제로 로드됐다 — 「안 그려져서 초록」을 막는다
  expect(m.boxCssW).toBe(24);
});

test('I1 img 사각형이 .mdl-icon 상자 안에 든다(넘치지 않는다)', async ({ page }) => {
  await setup(page, IMG);
  const m = await measure(page);
  const e = 0.5;
  expect(m.img.l).toBeGreaterThanOrEqual(m.box.l - e); expect(m.img.t).toBeGreaterThanOrEqual(m.box.t - e);
  expect(m.img.r).toBeLessThanOrEqual(m.box.r + e);    expect(m.img.b).toBeLessThanOrEqual(m.box.b + e);
});

test('I2 상자(24)가 블록 높이를 키우지 않는다 — 인라인 svg 아이콘과 같은 블록 높이', async ({ page }) => {
  await setup(page, IMG);
  const withImg = (await measure(page)).blockH;
  await setup(page, '<svg width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>');
  const withSvg = (await measure(page)).blockH;
  expect(withImg).toBe(withSvg);
});

test('I3 비정방 이미지는 찌그러지지 않는다(object-fit: contain)', async ({ page }) => {
  await setup(page, IMG);
  const m = await measure(page);
  expect(m.fit).toBe('contain');
});
