/* frame-default-bg-efefef — NEW-현빈QA-FRAME-DEFAULT-BG-EFEFEF-01(0.9.11 · 현빈 ⓑ): 섹션에 바로 넣는 새 프레임 기본 배경 #D9D9D9 → #EFEFEF.
 *   E1 섹션 직속 새 프레임 = #EFEFEF(data-bg · 칠한 색) · 기준판 빨강(#D9D9D9)
 *   N1 [대조] 프레임 안 새 프레임 = #FFFFFF 그대로 · 테두리 기본은 이 발주 밖(안 바꿈)
 * 넣는 꼴 = _t904-judge.js add(섹션 고르기 · _activeFrame 으로 안/밖). 진짜 키·버튼 길은 frame-defaults-nested-t305 가 잰다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SCENE = `<div class="section-block" id="sH" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inH">
  <div class="row" id="rowE" data-layout="stack"><div class="frame-block" id="EF" data-free-layout="true" style="position:relative;width:600px;height:200px;"></div></div></div>`;

test('E1·N1 새 프레임 기본 배경 — 섹션 직속 #EFEFEF · 프레임 안 #FFFFFF', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    const sec = document.getElementById('sH'), FR = '.frame-block:not([data-text-frame])';
    const add = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par; const b = new Set(sec.querySelectorAll(FR));
      window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window._activeFrame = null;
      return { bg: f.dataset.bg, css: getComputedStyle(f).backgroundColor, inEF: f.parentElement.closest(FR)?.id || null }; };
    return { top: add(null), nested: add(document.getElementById('EF')) };
  }, SCENE);
  expect(r.top, '★섹션 직속 새 프레임 기본 배경이 #EFEFEF 가 아니다').toEqual({ bg: '#EFEFEF', css: 'rgb(239, 239, 239)', inEF: null });
  expect(r.nested, '[대조] 프레임 안은 #FFFFFF 그대로').toEqual({ bg: '#FFFFFF', css: 'rgb(255, 255, 255)', inEF: 'EF' });
  expect(errs, errs.join(' | ')).toEqual([]);
});
