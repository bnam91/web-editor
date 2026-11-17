/* grid-step — 0.9.13 MOTION-STEP-HIGHLIGHT-01 ③ 신호등(그리드 칸 차례 강조 · 입구 = GIF 버튼 → GIF 패널).
 * G1 그리드 블럭만 고름 → 오른쪽 패널 GIF 단추(관리자) → 효과 = 신호등 셋 · 한 칸 시간(머무름 칸 글) · 지난 칸 칸 · 글자/슬라이드 칸 숨김 ·
 *    미리보기 강조 색(디자인 시스템 primary)이 칸을 옮겨 감
 * G2 GIF 저장 — 프레임마다 getImageData 오염 0 · 프레임 수 = 안내 줄(≤60) · 강조 색 · 폭 = 블럭×2 · 바탕 그림(PNG 내보내기 길) 찍힘 · 찍기 오류(capErr) 없음
 *    (r2: 하네스 electronAPI 가짜가 captureSectionCdp 에 null → base:false 가 err 없이 빠졌다 → 제품은 _stepBase.err 에 까닭을 싣고 · 시험은 진짜 CDP 로 잇는다)
 * G3 저장 — 효과·지난 칸·한 칸 시간이 블럭 dataset 에 · 저장 왕복 뒤 그대로
 * G4 캔버스 재생 — 호버 ▶ · 덮개(#canvas-scaler)에 강조 색 · Esc 끝
 * G5 글자 블럭 GIF 패널은 옛 그대로(신호등 목록·지난 칸 안 보임) · 줄을 고른 그리드엔 GIF 단추 없음
 * 양성대조(예측 · CTL 패치): CTL1 step-motion stepAt `Math.floor(x)` → `0` → G1(안 옮겨 감)·T1 빨강 · CTL2 엔진 _MK.step cls 'grid-block' → 'grid-block-x' → G1 빨강(글자 목록) ·
 *   CTL3 grid-step stepColor → 앱 UI 파랑 '#2d6fe8' → G1·G2 빨강(강조 색 없음) · CTL4 grid-step `if (sec && block.id)` → `if (false)` → G2 빨강(바탕 그림 없음) · CTL5 stepLit 늘 [i] → T2·T3 빨강
 * 셀렉터·전역 대조(제품 소스 grep): #open-anim-btn(_helpers.js animGifBtnHTML · prop-grid.js) · #anim-list .anim-item[data-id] · #anim-slide-dwell-row · #anim-step-past-row · #anim-step-past(index.html) ·
 *   #anim-slide-row · #anim-per-line · #anim-stamp-s0-row · #anim-loop-info · #anim-preview-canvas · .anim-export-btn · #anim-tb-play · #anim-canvas-play(animation-engine.js) ·
 *   window.addSection · selectSection · addGridBlock · selectBlock · addTextBlock · openAnimModal · closeAnimModal · serializeProject · applyProjectData · DesignSystem.getColorVars · __admin(state)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const GREEN = '#00ff00';
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  /* 하네스의 electronAPI 가짜는 «모든 키 = null 주는 함수»라 isNativeCapture 가 참(앱과 같은 native 갈래)인데 captureSectionCdp 가 null 을 줘
     바탕 그림이 빠졌다(MOTION3 아이맥 G2 base:false). ⇒ 앱 main.js capture-section-cdp 와 같은 명령·인자(Page.captureScreenshot · clip scale · captureBeyondViewport · fromSurface)로 잇는다
     (annot-export-show-261022 · export-width-1000-upscale 과 같은 길). */
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real[k]) }); });
  await page.evaluate(async (GREEN) => {
    window.__admin = { state: () => ({ isAdmin: true }) };
    window.DesignSystem.getColorVars = () => ({ primary: GREEN, secondary: '#333333', accent: '#ff6b6b' });   // 강조 색 = 디자인 시스템 primary(지디 결정 ②)
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addGridBlock({ cols: [{ lines: [{ type: 'body', text: '하나' }] }, { lines: [{ type: 'body', text: '둘' }] }, { lines: [{ type: 'body', text: '셋' }] }] });
    window.selectBlock(c.querySelector('.grid-block').id);
  }, GREEN);
  await expect(page.locator('#canvas .grid-block .grd-cell'), '[전제] 칸 3').toHaveCount(3);
  return errs;
}
/** 캔버스에 강조 색(초록)이 있나 + 초록 픽셀 x 가운데 */
const green = (page, sel) => page.evaluate((sel) => {
  const cv = document.querySelector(sel); if (!cv) return null;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, W = cv.width;
  let n = 0, sx = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] > 200 && d[i + 2] < 80) { n++; sx += (i / 4) % W; }
  return { n, cx: n ? Math.round(sx / n / (W / 3)) : -1 };   // cx = 몇 번째 칸 쪽(0·1·2)
}, sel);
async function openOutline(page) {
  await expect(page.locator('#open-anim-btn'), '[전제] 그리드 패널 GIF 단추').toBeVisible();
  await page.click('#open-anim-btn');
  await expect(page.locator('#anim-gif-modal')).toBeVisible();
  await page.click('#anim-list .anim-item[data-id="step-outline"]');
}

test('G1 GIF 패널 = 신호등 셋 · 칸 · 미리보기 강조가 칸을 옮겨 감', async ({ page }) => {
  const errs = await scene(page);
  await expect(page.locator('#open-anim-btn'), '[전제] 그리드 패널 GIF 단추').toBeVisible();
  await page.click('#open-anim-btn');
  expect(await page.evaluate(() => [...document.querySelectorAll('#anim-list .anim-item')].map((e) => e.dataset.id)), '★효과 목록이 신호등이 아니다').toEqual(['step-fill', 'step-outline', 'step-pop']);
  await expect(page.locator('#anim-slide-dwell-row'), '한 칸 시간 칸').toBeVisible();
  await expect(page.locator('#anim-slide-dwell-row .anim-opt-label')).toHaveText('한 칸 시간');
  await expect(page.locator('#anim-step-past-row'), '지난 칸 칸').toBeVisible();
  await expect(page.locator('#anim-slide-row'), '슬라이드 방향 칸 숨김').toBeHidden();
  await expect(page.locator('#anim-stamp-s0-row'), '글자 칸 숨김').toBeHidden();
  await expect(page.locator('#anim-per-line')).toBeHidden();
  await expect(page.locator('#anim-loop-info')).toContainText('상한 60');
  await page.click('#anim-list .anim-item[data-id="step-outline"]');
  await expect.poll(async () => (await green(page, '#anim-preview-canvas'))?.n, { timeout: 15000, message: '★미리보기에 강조 색(primary)이 없다' }).toBeGreaterThan(0);
  const seen = new Set();
  await expect.poll(async () => { const g = await green(page, '#anim-preview-canvas'); if (g && g.n) seen.add(g.cx); return seen.size; },
    { timeout: 15000, message: '★강조가 칸을 옮겨 가지 않는다' }).toBeGreaterThanOrEqual(2);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G2 GIF 저장 — 오염 0 · ≤60 · 강조 색 · 폭 · 바탕 그림', async ({ page }) => {
  const errs = await scene(page);
  await openOutline(page);
  await expect.poll(async () => (await green(page, '#anim-preview-canvas'))?.n, { timeout: 15000 }).toBeGreaterThan(0);
  await page.evaluate(() => {
    window.__gif = { frames: 0, err: null, green: false, w: 0 };
    window.__realGIF = window.GIF;
    window.GIF = class {
      constructor(o) { this.o = o; this.h = {}; window.__gif.w = o.width; }
      addFrame(ctx) {
        try {   // 진짜 gif.js copy:true 와 같은 읽기 — 오염된 캔버스면 SecurityError
          const d = ctx.getImageData(0, 0, this.o.width, this.o.height).data; window.__gif.frames++;
          if (!window.__gif.green) for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] > 200 && d[i + 2] < 80) { window.__gif.green = true; break; }
        } catch (e) { window.__gif.err = String(e); throw e; }
      }
      on(ev, f) { this.h[ev] = f; }
      render() { this.h.finished?.(new Blob(['GIF89a'], { type: 'image/gif' })); }
    };
  });
  const want = Number((await page.textContent('#anim-loop-info')).match(/GIF (\d+)프레임/)[1]);
  await page.click('.anim-export-btn');
  await expect.poll(() => page.evaluate(() => window.__gif.frames), { message: '[전제] 프레임이 쌓였다' }).toBe(want);
  const g = await page.evaluate(() => { window.GIF = window.__realGIF; const b = document.querySelector('#canvas .grid-block');
    return { ...window.__gif, bw: b.offsetWidth, base: !!(b._stepBase && b._stepBase.base && b._stepBase.base.width > 0), cells: b._stepBase?.cells?.length, capErr: b._stepBase?.err ?? null }; });
  expect([g.err, g.green, g.frames <= 60, g.w, g.base, g.cells, g.capErr], `★GIF 저장 — ${JSON.stringify(g)}`).toEqual([null, true, true, Math.max(320, Math.round(g.bw * 2)), true, 3, null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G3 저장 — dataset · 저장 왕복', async ({ page }) => {
  const errs = await scene(page);
  await page.click('#open-anim-btn');
  await page.click('#anim-list .anim-item[data-id="step-pop"]');
  await page.selectOption('#anim-step-past', 'stack');
  await page.evaluate(() => window.closeAnimModal());
  const keys = () => page.evaluate(() => { const b = document.querySelector('#canvas .grid-block'); return b && { fx: b.dataset.animFx, step: JSON.parse(b.dataset.animStep || '{}') }; });
  expect(await keys(), '★블럭에 저장').toEqual({ fx: 'step-pop', step: { past: 'stack' } });
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  await expect.poll(keys, { message: '★저장 왕복 뒤 다르다' }).toEqual({ fx: 'step-pop', step: { past: 'stack' } });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G4 캔버스 재생 — 호버 ▶ · 덮개에 강조 색 · Esc 끝', async ({ page }) => {
  const errs = await scene(page);
  await openOutline(page);
  await page.evaluate(() => window.closeAnimModal());
  const box = await page.locator('#canvas .grid-block').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#anim-tb-play'), '[전제] 효과 고른 그리드에 올리면 ▶').toBeVisible();
  await page.click('#anim-tb-play');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  expect(await page.evaluate(() => document.getElementById('anim-canvas-play').parentElement.id), '덮개 = 캔버스 층').toBe('canvas-scaler');
  await expect.poll(async () => (await green(page, '#anim-canvas-play'))?.n, { timeout: 15000, message: '★덮개에 강조 색이 없다' }).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('G5 글자 블럭 GIF 패널 옛 그대로 · 줄 고른 그리드엔 GIF 단추 없음', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { window.selectSection(document.querySelector('#canvas .section-block')); window.addTextBlock('body'); const tb = [...document.querySelectorAll('#canvas .text-block')].pop(); (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body')).textContent = '네!'; window.openAnimModal(tb); });
  const ids = await page.evaluate(() => [...document.querySelectorAll('#anim-list .anim-item')].map((e) => e.dataset.id));
  expect(ids.includes('slide-up') && !ids.includes('step-fill'), `글자 블럭 = 글자 효과 — ${ids}`).toBe(true);
  await expect(page.locator('#anim-step-past-row'), '글자 블럭엔 지난 칸 숨김').toBeHidden();
  await expect(page.locator('#anim-per-line'), '글자 블럭엔 줄마다 칸 보임').toBeVisible();
  await page.evaluate(() => window.closeAnimModal());
  await page.evaluate(() => { const g = document.querySelector('#canvas .grid-block'); window.showGridProperties(g, { r: 0, c: 0, li: 0 }); });
  await expect(page.locator('#open-anim-btn'), '줄을 고르면 GIF 단추 없음').toHaveCount(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
