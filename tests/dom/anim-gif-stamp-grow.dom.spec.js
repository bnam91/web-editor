/* anim-gif-stamp-grow — NEW-현빈QA-GIF-CANVAS-STAMP-CLIPPED-BY-FRAME-01 2판(현빈 재QA 261116 «시작 크기를 줄이란 게 아니었어 · GIF 에서 시작 크기를 조절 · 커지면 블럭 높이도 커지게»).
 *   실제 텍스트 블럭 · 실제 모달 · 진짜 «도장 찍기» 클릭 · 진짜 «도장 시작» 슬라이더 · 진짜 ⌘Z.
 * G1 도장 고름 + 시작 크기 4배 → 블럭 높이 ≥ 글자 × 4(블럭이 늘어 담는다) · 늘어난 px = 패널 «블럭 높이 +Npx» 와 같음 · data-anim-gif-grow = N/2 · data-anim-stamp-s0 4 ·
 *    캔버스 보기 덮개 높이 = 늘어난 블럭 × 2(화면 = GIF 와 같은 캔버스) · ⌘Z 한 번 = 시작 크기 바꿈 전(높이·키) · 다른 효과(fade-in) 고르면 원래 높이·늘림 키 0 · pageerror 0
 * 양성대조(예측 · CTL): js/animation-engine.js _fitStampHeight 의 `const g = need > h0 ? Math.ceil((need - h0) / 2) : 0;` → `const g = 0;` → G1 빨강(높이 안 늘어남)
 * 셀렉터·전역 대조(제품 소스 grep): #anim-gif-modal · .anim-item[data-id](animation-engine.js _buildAnimList) · #anim-stamp-s0 · #anim-stamp-grow(index.html GIF 옵션) · #anim-canvas-play(_startCanvasPlay) ·
 *   window.openAnimModal · window.closeAnimModal · window.playAnimOnCanvas · window.addSection · window.selectSection · window.addTextBlock
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('G1 도장 시작 크기 4배 → 블럭이 늘어 담는다 · 패널 px · 화면 캔버스 = 블럭 · ⌘Z 한 걸음 · 다른 효과면 원래대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const base = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    tb.id = tb.id || 'tbStamp';
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.textContent = '네!';
    window.deselectAll?.();
    window.openAnimModal(tb);
    return { id: tb.id, h0: tb.offsetHeight, fs: parseFloat(getComputedStyle(ce).fontSize) };
  });
  const st = () => page.evaluate((id) => { const t = document.getElementById(id);
    return { h: t.offsetHeight, grow: t.dataset.animGifGrow ?? null, s0: t.dataset.animStampS0 ?? null, fx: t.dataset.animFx ?? null, note: document.getElementById('anim-stamp-grow')?.textContent ?? '' }; }, base.id);
  await page.click('#anim-gif-modal .anim-item[data-id="stamp"]');
  const h1 = (await st()).h;
  await page.evaluate(() => { const s = document.getElementById('anim-stamp-s0'); s.value = '4'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  const r = await st();
  expect(r.fx, '[전제] 고른 효과가 블럭에').toBe('stamp');
  expect(r.h, `★블럭이 안 늘었다 — 높이 ${base.h0} → ${r.h} · 글자 ${base.fs}px × 4`).toBeGreaterThanOrEqual(Math.ceil(base.fs * 4));
  expect([r.s0, Number(r.grow) * 2, r.note.includes(`+${r.h - base.h0}px`)], `늘림 기록·패널 표시 — ${JSON.stringify(r)}`).toEqual(['4', r.h - base.h0, true]);
  await page.click('#anim-gif-modal .anim-play-canvas-btn');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  expect(await page.evaluate(() => document.getElementById('anim-canvas-play').height), '화면 캔버스 = 늘어난 블럭 × 2(GIF 저장과 같은 셈)').toBe(r.h * 2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(0);
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await st()).h, { message: '★⌘Z 한 번에 시작 크기 바꿈 전 높이로 안 돌아왔다' }).toBe(h1);
  expect((await st()).s0, '⌘Z — 시작 크기 키도').toBe(null);
  await page.evaluate((id) => window.openAnimModal(document.getElementById(id)), base.id);
  await page.click('#anim-gif-modal .anim-item[data-id="fade-in"]');
  const back = await st();
  expect([back.h, back.grow, back.note], '다른 효과 = 원래 높이 · 늘림 0').toEqual([base.h0, null, '']);
  expect(errs, errs.join(' | ')).toEqual([]);
});
