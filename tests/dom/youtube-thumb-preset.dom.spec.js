/* youtube-thumb-preset.dom.spec.js — t13C-03 ② 유튜브 썸네일 프리셋 입구(관리자만) (261119 · 태양)
 *   꼴(현빈 Q1·Q2·Q3·Q8 권장안): 컴포넌트 메뉴 «YouTube 썸네일» 한 줄 → 새 섹션 + 높이 484 핀 + data-thumb="youtube".
 *   노출 = feature-flags.js animGifVisible(true, __admin.state()) — Slides 와 같은 판정(모르면 «아님»).
 *
 *   T1 ★관리자 아님 = 입구 숨김 · 관리자 = 보임 → 한 번 → 섹션 +1 · 핀 484 · 표시 · 패널 기본 1280 / JPG
 *   T2 ★⌘Z 한 번에 썸네일 섹션째 사라진다
 *   T3 ★저장→새 앱에 싣기 — 핀 484·표시 그대로
 *   T4 «지키는» 칸 — 보통 섹션 추가(+)는 표시·핀 없음 · 패널 기본 860 / PNG
 *
 * ★양성대조: _patches/yt-thumb-2-gate.patch (js/block-factory.js syncYoutubeThumbMenu 가 늘 보이게) ⇒ T1 «관리자 아닌데 보인다» 빨강.
 * 실행: NODE_PRESERVE_SYMLINKS=1 node --preserve-symlinks-main node_modules/@playwright/test/cli.js test \
 *        --config=tests/dom/playwright.dom.config.js --retries=0 --workers=1 tests/dom/youtube-thumb-preset.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SECS = '#canvas .section-block:not([data-ghost])';
const menu = (page) => page.click('#fp-component-dropdown .fp-dropdown-trigger');
const thumbInfo = (page) => page.evaluate(() => {
  const s = document.querySelector('#canvas .section-block[data-thumb]');
  return s && { thumb: s.dataset.thumb, pin: s.dataset.heightPin ?? null, h: s.offsetHeight, styleH: s.style.height };
});
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  return bootApp(page);
}
async function addThumbAsAdmin(page) {
  await page.evaluate(() => { window.__admin = { state: () => ({ isAdmin: true }) }; });
  await menu(page);
  await expect(page.locator('#fp-add-yt-thumb'), '[전제] 관리자 = 입구 보임').toBeVisible();
  await page.click('#fp-add-yt-thumb');
  await expect.poll(() => thumbInfo(page), { message: '썸네일 섹션이 안 생겼다' }).not.toBeNull();
}

test('T1 ★관리자만 보임 · 한 번 → 섹션 +1 · 핀 484 · 표시 · 패널 기본 1280/JPG', async ({ page }) => {
  const errs = await scene(page);
  await menu(page);
  await expect(page.locator('#fp-add-yt-thumb'), '★관리자 아닌데 YouTube 썸네일 입구가 보인다').toBeHidden();
  await menu(page);   // 닫기
  const n0 = await page.locator(SECS).count();
  await addThumbAsAdmin(page);
  await expect(page.locator(SECS), '섹션 +1').toHaveCount(n0 + 1);
  await expect(page.locator('#canvas .section-block[data-thumb]'), '썸네일 섹션은 한 장').toHaveCount(1);
  expect(await thumbInfo(page)).toEqual({ thumb: 'youtube', pin: 'true', h: 484, styleH: '484px' });
  await expect.poll(() => page.evaluate(() => ({
    w: document.getElementById('sec-export-width')?.value ?? null, f: document.getElementById('sec-export-format')?.value ?? null,
    sel: document.querySelector('#canvas .section-block.selected')?.dataset.thumb ?? null,
  })), { message: '새 썸네일 섹션이 골라지고 패널 기본이 1280 / JPG' }).toEqual({ w: '1280', f: 'jpg', sel: 'youtube' });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('T2 ★⌘Z 한 번에 썸네일 섹션째 사라진다', async ({ page }) => {
  const errs = await scene(page);
  const n0 = await page.locator(SECS).count();
  await addThumbAsAdmin(page);
  await expect(page.locator(SECS)).toHaveCount(n0 + 1);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));   // 규약 ⑤ 끝 표본 갱신(한 프레임 뒤) 지나서
  await page.evaluate(() => window.undo());
  await expect(page.locator(SECS), '⌘Z 한 번 뒤 섹션 수').toHaveCount(n0);
  await expect(page.locator('#canvas .section-block[data-thumb]'), '⌘Z 한 번 뒤 썸네일이 남았다').toHaveCount(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('T3 ★저장→새 앱에 싣기 — 핀 484·표시 그대로', async ({ page, browser }) => {
  const errs = await scene(page);
  await addThumbAsAdmin(page);
  const saved = await page.evaluate(() => window.getSerializedCanvas());
  expect(saved, '저장본에 표시').toContain('data-thumb="youtube"');
  await page.close();
  const ctx = await browser.newContext(); const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 1500, height: 1100 });
  const errs2 = await bootApp(p2);
  await p2.evaluate((html) => { const c = document.getElementById('canvas'); c.innerHTML = html; window.rebindAll?.(); window.deselectAll?.(); }, saved);
  expect(await thumbInfo(p2)).toEqual({ thumb: 'youtube', pin: 'true', h: 484, styleH: '484px' });
  await ctx.close();
  expect([...errs, ...errs2], [...errs, ...errs2].join('\n')).toEqual([]);
});

test('T4 지키는 칸 — 보통 섹션 추가는 표시·핀 없음 · 패널 기본 860/PNG', async ({ page }) => {
  const errs = await scene(page);
  const id = await page.evaluate(() => {
    window.__admin = { state: () => ({ isAdmin: true }) };
    return window.addSection()?.id ?? null;
  });
  expect(id, '[전제] addSection 이 새 섹션을 돌려준다').toBeTruthy();
  await expect.poll(() => page.evaluate((id) => {
    const s = document.getElementById(id);
    return { thumb: s?.dataset.thumb ?? null, pin: s?.dataset.heightPin ?? null, styleH: s?.style.height ?? null,
      sel: s?.classList.contains('selected') ?? false,
      w: document.getElementById('sec-export-width')?.value ?? null, f: document.getElementById('sec-export-format')?.value ?? null };
  }, id)).toEqual({ thumb: null, pin: null, styleH: '', sel: true, w: '860', f: 'png' });
  expect(errs, errs.join('\n')).toEqual([]);
});
