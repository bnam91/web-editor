/* anim-gif-v2-fx — GIF V2 새 효과 F1 도장 찍기 · F2 흐림→선명 · 블러 휩(현빈 GO 261114 · BRIEF-ty-gif-v2-261114).
 * ★잰다: 실제 모달(window.openAnimModal) · 실제 효과 목록 클릭 · 미리보기 캔버스의 fillText(글·x·그 순간 ctx.filter·알파).
 *   rAF 는 V1 스펙(anim-gif-v1-defects)과 같은 «엔진 것만 손으로» 꼴 — 원하는 시각(ms)의 프레임을 그리게 한다(고정 대기 0).
 *   두 줄 글(P076 꼴 «오늘 주문하면?» / «네!») — 블럭 전체 모드에선 모든 줄이 0ms 에 같이 시작한다.
 * V1 도장 S1 «도장 찍기» 항목이 있다 · 시작(0ms) = 두 줄 모두 흐림(filter blur) · 끝 = 두 줄 선명(none) · 알파 1 · 끝 x = 줄 시작(가운데 정렬 좌끝)
 * V2 흐림 B1 «흐림→선명» 시작 흐림 · 끝 선명
 * V3 휩   W1 «블러 휩» 중간 = 한 줄에 여러 번(잔상) + 본 글이 끝 자리보다 왼쪽 · 끝 = 줄마다 한 번 · 제자리
 * V4 [지킴] V1 «페이드인» 은 옛 길 그대로 — 끝 프레임 두 줄 · filter 없음
 * 양성대조:
 *   · js/animation-engine.js _plan 의 V2 갈래를 지우면(`if (!V2_FX.includes(_animType))` → `if (true)`) V1·V2·V3 빨강(옛 _drawFrame 에 새 효과 갈래 없음 = 글 0) · V4 초록
 *   · js/fx/anim-gif-tracks.js FX.stamp 의 `_blur(ctx, m.blur)` 삭제 → V1(시작 흐림) 빨강
 * 셀렉터 대조(제품 소스 grep): #anim-list .anim-item[data-id](animation-engine.js _buildAnimList `data-id="${a.id}"`) · #anim-preview-canvas(index.html · 엔진 getElementById) · window.openAnimModal(엔진 끝)
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
    const realRaf = window.requestAnimationFrame.bind(window), realCaf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { if ((new Error().stack || '').includes('animation-engine.js')) { window.__cb = cb; return -1; } return realRaf(cb); };
    window.cancelAnimationFrame = (id) => { if (id === -1) window.__cb = null; else realCaf(id); };
    const orig = CanvasRenderingContext2D.prototype.fillText;
    window.__calls = [];
    CanvasRenderingContext2D.prototype.fillText = function (s, x, y, ...rest) {
      if (this.canvas.id === 'anim-preview-canvas') window.__calls.push({ s: String(s), x, y, f: this.filter, a: this.globalAlpha });
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
  await at(page, 0);   // 첫 tick = 시작 시각을 박는다
}
const TWO = '오늘 주문하면?<br>네!';

test('V1 도장 찍기 — 시작 흐림 · 끝 두 줄 선명·제자리', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'stamp');
  const f0 = await at(page, 0);
  expect(f0.length, '[전제] 시작 프레임에 글을 그렸다').toBeGreaterThan(0);
  expect(f0.every((c) => /^blur\(/.test(c.f)), `★시작이 흐리지 않다 ${JSON.stringify(f0.map((c) => c.f))}`).toBe(true);
  const fz = await at(page, 5000);
  expect(fz.map((c) => [c.s, c.f, c.a])).toEqual([['오늘 주문하면?', 'none', 1], ['네!', 'none', 1]]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V2 흐림→선명 — 시작 흐림 · 끝 선명', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'blur-in');
  const f0 = await at(page, 0);
  expect(f0.length > 0 && f0.every((c) => /^blur\(/.test(c.f))).toBe(true);
  const fz = await at(page, 5000);
  expect(fz.map((c) => [c.s, c.f])).toEqual([['오늘 주문하면?', 'none'], ['네!', 'none']]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V3 블러 휩 — 중간 잔상(한 줄에 여러 번) · 본 글은 끝 자리보다 왼쪽 · 끝 = 줄마다 한 번 제자리', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'blur-whip');
  const fm = await at(page, 150);
  const fz = await at(page, 5000);
  expect(fz.map((c) => c.s)).toEqual(['오늘 주문하면?', '네!']);
  const endX = fz.find((c) => c.s === '네!').x;
  const mid = fm.filter((c) => c.s === '네!');
  expect(mid.length, '★중간에 잔상이 없다').toBeGreaterThan(1);
  expect(mid[mid.length - 1].x, '★본 글이 아직 왼쪽에 있어야 한다').toBeLessThan(endX - 1);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('V4 [지킴] V1 페이드인은 옛 길 — 끝 두 줄 · 흐림 없음', async ({ page }) => {
  const errs = await scene(page, TWO);
  await pick(page, 'fade-in');
  const fz = await at(page, 1200);
  expect(fz.map((c) => c.s)).toEqual(['오늘 주문하면?', '네!']);
  expect(fz.every((c) => c.f === 'none')).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
