/* frame-stack-convert-keeps-text — 자유배치 → 스택 변환에서 한 줄 글자가 «좁아져 여러 줄»이 되지 않는다 (수지④ 스택 · 2026-10-08 지디 배정 T3).
 *
 * 수지 원문(현빈 4018 전달): 「자유배치모드에서 텍스트 블럭을 넣은뒤 스택모드로 변경하면, 한줄이던 텍스트블럭의 가로너비가 줄어들며 높이가 달라지게 된다.」
 * 재현(3141ccec · 패널 「스택」 단추 진짜 클릭): 글자 둘 다 폭 860 → 100px · 1줄 → 3줄 · 높이 58 → 173.
 * 장면: 앱 함수(addFrameBlock · addTextBlock)로 짓고 글자 자리(left/top)만 둔다 — 앱의 자식 끌기가 쓰는 꼴.
 *   ⚠️두 글자를 «다른 행»에 둔다(겹치면 변환이 alert 로 멈춘다 — 다중 자식 행은 이 판 밖).
 * 머리표: ST1 [새 것] 고치기 전 판에서 빨강 · ST2 [지킴] px 폭 글자는 그 폭 그대로(고치기 전에도 초록이어야 — 음성대조).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, widths) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  return page.evaluate((widths) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sST" data-section="1"><div class="section-hitzone"><span class="section-label">sST</span></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sST');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    const kids = widths.map((w, i) => {
      window.deselectAll?.(); window._activeFrame = fr;
      const t = made('.text-block', () => window.addTextBlock('body'));
      const ed = t.querySelector('[contenteditable]') || t.querySelector('[class^="tb-"]'); if (ed) ed.textContent = '한 줄 텍스트 ' + (i + 1);
      const tu = t.closest('.frame-block[data-text-frame]') || t;
      tu.style.left = (60 + i * 200) + 'px'; tu.style.top = (40 + i * 120) + 'px';
      if (w) tu.style.width = w;
      return { tb: t.id, tu: tu.id };
    });
    fr.style.height = '400px'; fr.style.minHeight = '400px';
    window.deselectAll?.(); window._activeFrame = null; window.buildLayerPanel?.();
    return { fr: fr.id, kids };
  }, widths);
}
const measure = (page, ids) => page.evaluate((ids) => ids.kids.map(k => {
  const tu = document.getElementById(k.tu), tb = document.getElementById(k.tb);
  const ed = tb.querySelector('[contenteditable]') || tb.querySelector('[class^="tb-"]') || tb;
  const lh = parseFloat(getComputedStyle(ed).lineHeight) || 1;
  return { w: tu.offsetWidth, h: tu.offsetHeight, lines: Math.round(ed.offsetHeight / lh), styleW: tu.style.width, pos: tu.style.position };
}), ids);
async function toStack(page, ids) {
  page.on('dialog', d => { throw new Error('변환이 대화창을 띄웠다: ' + d.message()); });
  const r = await page.evaluate((id) => { const e = document.getElementById(id).getBoundingClientRect(); return { x: e.left + e.width * 0.85, y: e.top + e.height * 0.85 }; }, ids.fr);
  await page.mouse.click(r.x, r.y);
  await page.waitForSelector('#ss-to-stack-btn', { timeout: 5000 });
  await page.click('#ss-to-stack-btn');
  await page.waitForFunction((id) => document.getElementById(id).dataset.freeLayout !== 'true', ids.fr, { timeout: 5000 });
}

test('ST1 ★한 줄 글자(폭 100%)를 스택으로 바꿔도 — 폭이 줄지 않고 한 줄 그대로', async ({ page }) => {
  const ids = await scene(page, [null, null]);
  const b = await measure(page, ids);
  expect(b.map(x => [x.pos, x.styleW, x.lines]), '[전제] 자유배치의 한 줄 글자 둘(폭 100%)').toEqual([['absolute', '100%', 1], ['absolute', '100%', 1]]);
  await toStack(page, ids);
  const a = await measure(page, ids);
  expect(a.map(x => x.pos), '[전제] 스택으로 바뀌었다(absolute 아님)').toEqual(['', '']);
  for (let i = 0; i < a.length; i++) {
    expect(a[i].lines, `글자 ${i + 1} 이 여러 줄이 됐다 — 폭 ${b[i].w}→${a[i].w} (style ${a[i].styleW}) · 높이 ${b[i].h}→${a[i].h}`).toBe(1);
    expect(a[i].w, `글자 ${i + 1} 폭이 줄었다 — ${b[i].w}→${a[i].w}`).toBeGreaterThanOrEqual(b[i].w - 2);
  }
});

test('ST2 [지킴·음성대조] px 폭 글자(300px)는 스택으로 바꿔도 그 폭 그대로', async ({ page }) => {
  const ids = await scene(page, ['300px', '300px']);
  const b = await measure(page, ids);
  expect(b.map(x => x.w), '[전제] 폭 300').toEqual([300, 300]);
  await toStack(page, ids);
  const a = await measure(page, ids);
  expect(a.map(x => x.w), `px 폭이 바뀌었다 — ${a.map(x => x.styleW)}`).toEqual([300, 300]);
});
