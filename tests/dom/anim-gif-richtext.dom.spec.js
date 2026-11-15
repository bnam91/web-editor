/* anim-gif-richtext — RICHTEXT-EFFECTS-01(현빈: «글로우 텍스트 효과 입혔는데 gif 에서는 안 보이는데? … 되게 해줘야지») 부분 꾸밈이 GIF 미리보기에 «실제로» 그려진다.
 * ★잰다: 실제 텍스트 블럭 · 실제 모달(window.openAnimModal) · 실제 효과 목록 클릭 · 미리보기 캔버스의 fillText(글·그 순간 font·fillStyle) + 캔버스 픽셀.
 *   rAF 는 anim-gif-v2-fx 와 같은 «엔진 것만 손으로» 꼴(scene 을 그대로 옮김 · 고정 대기 0).
 * C2 R1 글자색 — span color 빨강 → 그 조각 fillStyle #ff0000 · 캔버스에 빨강 픽셀 · 나머지 조각은 블럭 색(V1 fade-in · V2 stamp)
 *    R2 굵기·기울임·크기 — <b> · <i> · span font-size 1.5배 → 그 조각 font 에 bold/700 · italic · 1.5배 px
 * 양성대조(예측): js/animation-engine.js _runStyle 첫 줄에 `return null;` → R1·R2 빨강(단위 E8 은 srv 실측 빨강)
 * 셀렉터·전역 대조(제품 소스 grep): window.addSection · window.selectSection(editor.js:5271) · window.addTextBlock · .text-block [contenteditable] ·
 *   #anim-list .anim-item[data-id](animation-engine.js _buildAnimList) · #anim-preview-canvas(index.html) · window.openAnimModal(엔진 끝) — 전부 anim-gif-v2-fx 가 이미 쓰는 것
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, html) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    window.selectSection(sec);
    window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.innerHTML = html;
    ce.style.textAlign = 'center';
    window.__tb = tb;
    const realRaf = window.requestAnimationFrame.bind(window), realCaf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { if ((new Error().stack || '').includes('animation-engine.js')) { window.__cb = cb; return -1; } return realRaf(cb); };
    window.cancelAnimationFrame = (id) => { if (id === -1) window.__cb = null; else realCaf(id); };
    const orig = CanvasRenderingContext2D.prototype.fillText;
    window.__calls = [];
    CanvasRenderingContext2D.prototype.fillText = function (s, x, y, ...rest) {
      if (this.canvas.id === 'anim-preview-canvas') window.__calls.push({ s: String(s), x, y, font: this.font, fill: String(this.fillStyle) });
      return orig.call(this, s, x, y, ...rest);
    };
    window.__at = (ms) => { window.__calls = []; const cb = window.__cb; window.__cb = null; cb(1000 + ms); return window.__calls; };
    window.openAnimModal(tb);
  }, html);
  return errs;
}
async function at(page, ms) {
  await page.waitForFunction(() => typeof window.__cb === 'function', null, { timeout: 5000 });
  return page.evaluate((ms) => window.__at(ms), ms);
}
async function pick(page, id) {
  await expect(page.locator(`#anim-list .anim-item[data-id="${id}"]`), `[전제] 목록에 ${id}`).toHaveCount(1);
  await page.click(`#anim-list .anim-item[data-id="${id}"]`);
  await at(page, 0);
}
/** 미리보기 캔버스에서 «빨강» 픽셀 수(r>200 · g,b<70). */
const redPixels = (page) => page.evaluate(() => {
  const cv = document.getElementById('anim-preview-canvas');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 70 && d[i + 2] < 70) n++;
  return n;
});

for (const fx of ['fade-in', 'stamp']) {
  test(`R1 글자색 — 빨강 조각만 빨강 · 캔버스 빨강 픽셀(${fx})`, async ({ page }) => {
    const errs = await scene(page, '평글 <span style="color: rgb(255, 0, 0)">빨강</span> 끝');
    await pick(page, fx);
    const f = await at(page, 5000);
    const red = f.filter((c) => c.s.includes('빨강'));
    expect(red.length, `[전제] «빨강» 조각을 그렸다 ${JSON.stringify(f)}`).toBeGreaterThan(0);
    expect(red.every((c) => c.fill === '#ff0000'), `★빨강 조각 색 ${JSON.stringify(red)}`).toBe(true);
    expect(f.filter((c) => !c.s.includes('빨강') && c.s.trim()).every((c) => c.fill !== '#ff0000'), '나머지는 블럭 색').toBe(true);
    expect(await redPixels(page), '★캔버스에 빨강 픽셀 0').toBeGreaterThan(30);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}

test('R2 굵기·기울임·크기 — <b> · <i> · span font-size 1.5배 → 조각 font', async ({ page }) => {
  const errs = await scene(page, '평 <b>굵게</b> <i>기울</i> <span style="font-size: 1.5em">크게</span>');
  await pick(page, 'fade-in');
  const f = await at(page, 5000);
  const by = (s) => f.find((c) => c.s === s);
  for (const s of ['굵게', '기울', '크게']) expect(by(s), `[전제] «${s}» 가 한 조각 ${JSON.stringify(f.map((c) => c.s))}`).toBeTruthy();
  const px = (c) => parseFloat(/([\d.]+)px/.exec(c.font)[1]);
  expect(by('굵게').font, '★굵기').toMatch(/\b(bold|700)\b/);
  expect(by('기울').font, '★기울임').toMatch(/\bitalic\b/);
  const base = f.find((c) => c.s.startsWith('평'));
  expect(Math.abs(px(by('크게')) / px(base) - 1.5), `★크기 ${by('크게').font} vs ${base.font}`).toBeLessThan(0.05);
  expect(errs, errs.join(' | ')).toEqual([]);
});
