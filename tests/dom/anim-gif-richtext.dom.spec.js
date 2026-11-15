/* anim-gif-richtext — RICHTEXT-EFFECTS-01(현빈: «글로우 텍스트 효과 입혔는데 gif 에서는 안 보이는데? … 되게 해줘야지») 부분 꾸밈이 GIF 미리보기에 «실제로» 그려진다.
 * ★잰다: 실제 텍스트 블럭 · 실제 모달(window.openAnimModal) · 실제 효과 목록 클릭 · 미리보기 캔버스의 fillText(글·그 순간 font·fillStyle) + 캔버스 픽셀.
 *   rAF 는 anim-gif-v2-fx 와 같은 «엔진 것만 손으로» 꼴(scene 을 그대로 옮김 · 고정 대기 0).
 * C2 R1 글자색 — span color 빨강 → 그 조각 fillStyle #ff0000 · 캔버스에 빨강 픽셀 · 나머지 조각은 블럭 색(V1 fade-in · V2 stamp)
 *    R2 굵기·기울임·크기 — <b> · <i> · span font-size 1.5배 → 그 조각 font 에 bold/700 · italic · 1.5배 px
 * 양성대조(예측): js/animation-engine.js _runStyle 첫 줄에 `return null;` → R1·R2 빨강(단위 E8 은 srv 실측 빨강)
 * C3 R3 밑줄(파랑) · 취소선(청록) · 배경색(초록) · 형광펜 span.tb-hl(자홍 --tb-hl-color) → 캔버스에 그 색 픽셀 · 형광 띠는 글자 아래쪽 절반에(--tb-hl-h 40%)
 *   양성대조(예측): js/fx/anim-gif-text.js fillStyled 의 `if (p.st) _decor(ctx, p, px, baseline, env, false);` 삭제 → R3 밑줄·배경·형광 빨강(단위 T13 srv)
 *   셀렉터: .tb-hl(prop-text-wireup-text-edit.js HL_CLASS) · --tb-hl-color/-h/-y(css/editor-layout.css .tb-hl)
 * C4 R4 범위 글로우 span.tb-glow(자홍 --tb-glow-color · k 1) → 캔버스에 자홍빛 번짐 · 블럭 전체 그림자(글 요소 text-shadow 초록) → 초록빛 번짐
 *   양성대조(예측): js/fx/anim-gif-text.js fillStyled 의 `if (p.st && p.st.shadows) _shadows(…)` 줄 삭제 → R4 빨강(단위 T14·E10 도)
 *   셀렉터: .tb-glow(prop-text-wireup-text-edit.js GLOW_CLASS) · --tb-glow-color/-k(css/editor-layout.css .tb-glow)
 * C5 R5 방점 span.tb-dot(글자마다 · 빨강 6px) → 캔버스에 빨강 점 · 글자 가운데 줄보다 위 · 방점 없는 글엔 빨강 0
 *   양성대조(예측): js/fx/anim-gif-text.js _decor 의 `if (st.dot) {` → `if (false) {` → R5 빨강(단위 T15·E11 도)
 *   셀렉터: .tb-dot(prop-text-wireup-text-edit.js DOT_CLASS) · --tb-dot-color/-size(css/editor-layout.css .tb-dot::before)
 * C6 R6 슬롯머신 — 숫자 «5» 의 방점(파랑)이 끝 프레임에 다 보인다: 같은 방점을 fade-in 으로 그린 픽셀 수(기준)의 80% 이상(멈춘 자리는 줄 띠로 안 자름) · 빨강 «원» 조각 유지
 *   양성대조(예측): 두 슬롯(엔진 V1 `if (r.frac) { ctx.save(); … clip` · 줄별 `const roll = r.frac > 0`)을 «늘 자름»으로 → R6 빨강(단위 T16·E12 도)
 * ⑫ R7 글자 그라데이션(글 요소 background-clip:text · 90deg 빨강→파랑) → 캔버스 글이 왼쪽 빨강빛·오른쪽 파랑빛(빨강 픽셀 평균 x < 파랑 픽셀 평균 x)
 *   양성대조(예측): js/fx/anim-gif-tracks.js withGradFill 첫 줄 `return style;` → R7 빨강(파랑 0 — 첫 스탑 단색) · 단위 T17·E13 도
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

/** 미리보기 캔버스에서 색 [r,g,b] (±tol) 픽셀 — 개수와 y 범위. */
const colorPixels = (page, rgb, tol = 40) => page.evaluate(([rgb, tol]) => {
  const cv = document.getElementById('anim-preview-canvas');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0, y0 = Infinity, y1 = -1;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - rgb[0]) <= tol && Math.abs(d[i + 1] - rgb[1]) <= tol && Math.abs(d[i + 2] - rgb[2]) <= tol) { n++; const y = Math.floor(i / 4 / cv.width); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { n, y0, y1 };
}, [rgb, tol]);

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

test('R3 밑줄·취소선·배경색·형광펜 — 캔버스에 그 색 장식', async ({ page }) => {
  const errs = await scene(page, '<u style="text-decoration-color: rgb(0, 0, 255)">밑줄</u> <s style="text-decoration-color: rgb(0, 200, 200)">취소</s> '
    + '<span style="background-color: rgb(0, 255, 0)">배경</span> <span class="tb-hl" style="--tb-hl-color: rgb(255, 0, 255); --tb-hl-h: 40%; --tb-hl-y: 0px">형광</span>');
  await pick(page, 'fade-in');
  const f = await at(page, 5000);
  expect(f.map((c) => c.s).join(''), '[전제] 글').toContain('형광');
  const blue = await colorPixels(page, [0, 0, 255]), cyan = await colorPixels(page, [0, 200, 200]), green = await colorPixels(page, [0, 255, 0]), mag = await colorPixels(page, [255, 0, 255]);
  expect(blue.n, '★밑줄(파랑) 0').toBeGreaterThan(10);
  expect(cyan.n, '★취소선(청록) 0').toBeGreaterThan(10);
  expect(green.n, '★배경색(초록) 0').toBeGreaterThan(100);
  expect(mag.n, '★형광펜(자홍) 0').toBeGreaterThan(50);
  expect(mag.y1 - mag.y0, '형광 띠 높이 < 배경 상자 높이(아래 40%)').toBeLessThan(green.y1 - green.y0);
  expect(mag.y1, '형광 띠는 상자 아래쪽에 붙는다').toBeGreaterThanOrEqual(green.y1 - 3);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/** 색이 «기운» 픽셀 수 — pred(r,g,b). 흰 바탕 위 번짐은 옅으니 색 차이로 센다. */
const huePixels = (page, kind) => page.evaluate((kind) => {
  const cv = document.getElementById('anim-preview-canvas');
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (kind === 'magenta' ? r - g > 40 && b - g > 40 : g - r > 40 && g - b > 40) n++;
  }
  return n;
}, kind);

test('R4 글로우·그림자 — 범위 글로우 span.tb-glow 자홍 번짐 · 블럭 전체 text-shadow 초록 번짐', async ({ page }) => {
  const errs = await scene(page, '평글 <span class="tb-glow" style="--tb-glow-color: rgb(255, 0, 255); --tb-glow-k: 1">글로우</span>');
  await pick(page, 'fade-in');
  await at(page, 5000);
  expect(await huePixels(page, 'magenta'), '★범위 글로우 번짐 0').toBeGreaterThan(200);
  expect(await huePixels(page, 'green'), '[지킴] 블럭 그림자 안 켰는데 초록').toBe(0);
  await page.evaluate(() => { window.closeAnimModal(); window.__tb.querySelector('[contenteditable]').style.textShadow = 'rgb(0, 200, 0) 0px 0px 8px'; window.openAnimModal(window.__tb); });
  await pick(page, 'fade-in');
  await at(page, 5000);
  expect(await huePixels(page, 'green'), '★블럭 전체 그림자 번짐 0').toBeGreaterThan(200);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R5 방점 — 글자마다 span.tb-dot 빨강 점이 글자 위에', async ({ page }) => {
  const dot = (ch) => `<span class="tb-dot" style="--tb-dot-color: rgb(255, 0, 0); --tb-dot-size: 6px">${ch}</span>`;
  const errs = await scene(page, `${dot('방')}${dot('점')} 평글`);
  await pick(page, 'fade-in');
  const f = await at(page, 5000);
  const ch = f.find((c) => c.s === '방');
  expect(ch, `[전제] «방» 한 조각 ${JSON.stringify(f.map((c) => c.s))}`).toBeTruthy();
  const red = await colorPixels(page, [255, 0, 0], 60);
  expect(red.n, '★방점 빨강 0').toBeGreaterThan(10);
  expect(red.y1, '점은 글자 가운데 줄보다 위').toBeLessThan(ch.y);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R6 슬롯머신 — 멈춘 숫자의 방점이 끝 프레임에 «다 보인다»(같은 방점을 fade-in 으로 그린 픽셀 수와 견줌) · 빨강 조각 유지', async ({ page }) => {
  const errs = await scene(page, '할인 12,34<span class="tb-dot" style="--tb-dot-color: rgb(0, 0, 255); --tb-dot-size: 6px">5</span><span style="color: rgb(255, 0, 0)">원</span>');
  /* 문턱을 고정 수(> 10)로 두면 미리보기 배율에서 방점 하나(지름 몇 px)의 순색 픽셀이 8 이라 고친 판도 빨강이었다(아이맥 f33c65318+C6 · R5 는 방점 둘이라 통과).
     ⇒ 같은 블럭·같은 방점을 잘림 없는 fade-in 으로 먼저 그려 «기준 수»를 재고, 슬롯 끝 프레임이 그 수에 가까운지 본다(잘리면 0 근처). */
  await pick(page, 'fade-in');
  await at(page, 5000);
  const ref = (await colorPixels(page, [0, 0, 255], 60)).n;
  expect(ref, '[전제] fade-in 으로 그린 방점 픽셀(기준)').toBeGreaterThan(0);
  await page.evaluate(() => { window.closeAnimModal(); window.openAnimModal(window.__tb); });
  await pick(page, 'slot-machine');
  const f = await at(page, 5000);
  expect(f.some((c) => c.s === '원' && c.fill === '#ff0000'), `★빨강 조각 ${JSON.stringify(f.map((c) => [c.s, c.fill]))}`).toBe(true);
  const n = (await colorPixels(page, [0, 0, 255], 60)).n;
  expect(n, `★멈춘 숫자의 방점이 잘렸다(슬롯 ${n} · 기준 fade-in ${ref})`).toBeGreaterThanOrEqual(Math.ceil(ref * 0.8));
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R7 글자 그라데이션 — 90deg 빨강→파랑: 글 왼쪽 빨강빛 · 오른쪽 파랑빛', async ({ page }) => {
  const errs = await scene(page, '그라데이션 글자 확인');
  await page.evaluate(() => {
    window.closeAnimModal();
    const ce = window.__tb.querySelector('[contenteditable]') || window.__tb.querySelector('.tb-body');
    Object.assign(ce.style, { backgroundImage: 'linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)', webkitBackgroundClip: 'text', backgroundClip: 'text', webkitTextFillColor: 'transparent', color: 'rgb(255, 0, 0)' });
    window.openAnimModal(window.__tb);
  });
  await pick(page, 'fade-in');
  await at(page, 5000);
  const m = await page.evaluate(() => {
    const cv = document.getElementById('anim-preview-canvas');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let rn = 0, rx = 0, bn = 0, bx = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], b = d[i + 2], x = (i / 4) % cv.width;
      if (r - b > 80) { rn++; rx += x; } else if (b - r > 80) { bn++; bx += x; }
    }
    return { rn, bn, rx: rx / (rn || 1), bx: bx / (bn || 1) };
  });
  expect(m.rn, `빨강빛 ${JSON.stringify(m)}`).toBeGreaterThan(30);
  expect(m.bn, `★파랑빛 0 = 그라데이션이 안 실렸다 ${JSON.stringify(m)}`).toBeGreaterThan(30);
  expect(m.rx, '빨강은 왼쪽 · 파랑은 오른쪽').toBeLessThan(m.bx);
  expect(errs, errs.join(' | ')).toEqual([]);
});
