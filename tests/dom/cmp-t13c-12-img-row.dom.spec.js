/* cmp-t13c-12-img-row.dom.spec.js — t13C-12 비교 블럭 우측 패널 이미지 행 «+ 이미지 / 꽉 채우기 / 원본 비율» 줄 깨짐.
 *
 * ★뿌리(prop-comparison.js colSection): 이미지 행 body = .prop-row 두 줄(「+ 이미지」 줄 · 꽉 채우기/원본 비율 줄)인데
 *   그걸 바깥 .prop-row(display:flex · overflow:hidden)로 한 번 더 쌌다 ⇒ 두 줄이 한 줄로 눌리고 잘렸다.
 * ★고침: 바깥 래퍼를 뺐다(두 줄이 .cmp-row-edit 바로 아래 형제).
 * ⛔고정 대기 0.
 *
 * 양성대조: _patches/t13c-12-ctl-nested-row.patch(바깥 .prop-row 래퍼 되살림) → B1 의 «중첩 0»·«두 줄» 단언이 빨강.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-t13c-12-img-row
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const MAKE = `window.addComparisonBlock({ cols: [
  { title: 'A', rows: [{type:'image',text:'',imgSrc:'',imgFit:'cover'},{type:'text',text:'a1'}] },
  { title: 'B', rows: [{type:'image',text:'',imgSrc:'${PX}',imgFit:'cover'},{type:'text',text:'b1'}] }], featured: 1 });`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([mk, sec]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    (0, eval)(mk);
    window.__blk = [...document.querySelectorAll('#sB .comparison-block')].pop();
    window.__bid = window.__blk?.id;
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [MAKE, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected && !window.__blk.classList.contains('selected'), null, { timeout: 5000 });
  return errs;
}

test('B1 이미지 행 — 「+ 이미지/교체」 줄과 「꽉 채우기·원본 비율」 줄이 중첩 없이 두 줄로 놓이고 잘리지 않는다', async ({ page }) => {
  const errs = await setup(page);
  const rc = await waitStableRect(page, `#sB .comparison-block .cmp-row[data-col-idx="0"][data-row-idx="1"]`);
  await page.mouse.click(rc.cx, rc.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected')
    && document.querySelectorAll('#panel-right .cmp-row-img').length === 2, null, { timeout: 3000 });

  const geo = await page.evaluate(() => [0, 1].map(col => {
    const img = document.querySelector(`#panel-right .cmp-row-img[data-col="${col}"][data-idx="0"]`);
    const fits = [...document.querySelectorAll(`#panel-right .cmp-row-fit[data-col="${col}"][data-idx="0"]`)];
    const edit = img.closest('.cmp-row-edit');
    const r = e => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width }; };
    return {
      label: img.textContent.trim(),
      nested: [img, ...fits].map(e => !!e.closest('.prop-row').parentElement.closest('.prop-row')),
      img: r(img), fits: fits.map(r), edit: r(edit),
    };
  }));
  expect(geo.map(g => g.label), '전제 — 빈 칸 「+ 이미지」 · 그림 칸 「교체」').toEqual(['+ 이미지', '교체']);
  for (const g of geo) {
    expect(g.nested, `.prop-row 안에 .prop-row 0 (${g.label})`).toEqual([false, false, false]);
    expect(g.fits.length, '꽉 채우기·원본 비율 두 단추').toBe(2);
    for (const f of g.fits) {
      expect(f.t, `맞춤 단추가 이미지 단추 «아래 줄» (${g.label})`).toBeGreaterThanOrEqual(g.img.b - 0.5);
      expect(f.w, `맞춤 단추가 눌리지 않았다 (${g.label})`).toBeGreaterThan(20);
      expect(f.r, `맞춤 단추가 행 편집 칸 밖으로 안 잘렸다 (${g.label})`).toBeLessThanOrEqual(g.edit.r + 0.5);
    }
    expect(g.img.w, `이미지 단추가 줄 폭을 쓴다 (${g.label})`).toBeGreaterThan((g.edit.r - g.edit.l) * 0.5);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});
