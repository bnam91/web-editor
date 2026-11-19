/* cmp-t13c-11-row-del-quiet.dom.spec.js — t13C-11 비교 블럭 우측 패널 행 삭제 «×»(.cmp-row-del) 강조 낮추기.
 *
 * ★고침(prop-comparison.js colSection): .cmp-row-del 에서 .prop-btn-danger 를 뺐다 ⇒ 공용 .prop-btn 꼴(이웃 「+ 이미지」 단추와 같은 토큰).
 *   새 색·새 클래스·새 CSS 0. 칼럼 삭제(.cmp-col-del)·그림 비우기(.cmp-row-img-clear)는 범위 밖(그대로 danger).
 * ⛔고정 대기 0.
 *
 * 양성대조: _patches/t13c-11-ctl-row-del-danger.patch(.prop-btn-danger 되살림) → C1 의 «색·테두리·배경 = 이웃 .prop-btn» 단언이 빨강.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-t13c-11-row-del-quiet
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const MAKE = `window.addComparisonBlock({ cols: [
  { title: 'A', rows: [{type:'image',text:'',imgSrc:'',imgFit:'cover'},{type:'text',text:'a1'}] },
  { title: 'B', rows: [{type:'text',text:'b0'},{type:'text',text:'b1'}] }], featured: 1 });`;

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

test('C1 행 삭제 × = 공용 .prop-btn 꼴(danger 아님) · 눌리면 그 행 하나 빠지고 ⌘Z 한 번 복구', async ({ page }) => {
  const errs = await setup(page);
  const rc = await waitStableRect(page, `#sB .comparison-block .cmp-row[data-col-idx="1"][data-row-idx="1"]`);
  await page.mouse.click(rc.cx, rc.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected')
    && document.querySelectorAll('#panel-right .cmp-row-del').length === 4, null, { timeout: 3000 });

  const st = await page.evaluate(() => {
    const pick = e => { const s = getComputedStyle(e); return { color: s.color, bg: s.backgroundColor, border: s.borderTopColor }; };
    const dels = [...document.querySelectorAll('#panel-right .cmp-row-del')];
    const ref = document.querySelector('#panel-right .cmp-row-img');   // 같은 줄 무리의 이웃 .prop-btn(「+ 이미지」)
    return { danger: dels.map(e => e.classList.contains('prop-btn-danger')), dels: dels.map(pick), ref: pick(ref), refDanger: ref.classList.contains('prop-btn-danger') };
  });
  expect(st.refDanger, '전제 — 기준 단추는 danger 가 아니다').toBe(false);
  expect(st.danger, '.cmp-row-del 에 .prop-btn-danger 0').toEqual([false, false, false, false]);
  for (const d of st.dels) expect(d, '× 의 색·배경·테두리 = 이웃 .prop-btn').toEqual(st.ref);

  const before = await page.evaluate(() => window.getComparisonCols(document.getElementById(window.__bid).dataset)[1].rows.map(r => r.text));
  expect(before, '전제').toEqual(['b0', 'b1']);
  await page.locator('#panel-right .cmp-row-del[data-col="1"][data-idx="0"]').click();
  await expect.poll(() => page.evaluate(() => window.getComparisonCols(document.getElementById(window.__bid).dataset)[1].rows.map(r => r.text)),
    { timeout: 3000, message: '× = 그 행 하나만 빠진다' }).toEqual(['b1']);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => window.getComparisonCols(document.querySelector('#sB .comparison-block').dataset)[1].rows.map(r => r.text)),
    { timeout: 3000, message: '⌘Z 한 번 → 되돌아온다' }).toEqual(['b0', 'b1']);
  expect(errs, errs.join('\n')).toEqual([]);
});
