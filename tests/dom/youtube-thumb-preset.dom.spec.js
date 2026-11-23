/* youtube-thumb-preset.dom.spec.js — t13C-03 ② 유튜브 썸네일 프리셋 입구 — ★261123 입구 = 섹션 이름 «ytb_» 이스터에그(아래 ★기대 바뀜) (261119 · 태양)
 *   꼴(현빈 Q1·Q2·Q3·Q8 권장안 · 261123 입구 바뀜): 섹션 이름을 «ytb_» 로 시작하게 → 핀 484 + data-thumb="youtube"(addYoutubeThumbSection 과 같은 표시).
 *   게이트 = 다른 이스터에그와 같은 isEasterEggEnabled('youtubeThumb')(기본 켬) · 옛 메뉴 입구 #fp-add-yt-thumb 은 걷었다.
 *
 *   T1 ★메뉴 입구 없음(관리자여도) · 이름 ytb_ → 핀 484 · 표시 · 패널 기본 1280 / JPG
 *   T2 ★⌘Z 한 번에 «이름 + 썸네일»이 같이 되돌아간다
 *   T3 ★저장→새 앱에 싣기 — 핀 484·표시 그대로
 *   T4 «지키는» 칸 — 보통 섹션 추가(+)는 표시·핀 없음 · 패널 기본 860 / PNG
 *   끄기(접두어 떼기 = 켜기 전 높이로) · 옛 메뉴 썸네일 지킴 · 설정에서 끄면 무동작 = tests/dom/youtube-thumb-name.dom.spec.js
 *
 * ★양성대조: _patches/ytb-CTL.patch (layer-panel.js 의 applyYoutubeThumbName 부름 걷음) ⇒ T1·T2·T3 빨강.
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
/* ★기대 바뀜(현빈 261123 «ytb_» 이스터에그 · 0.9.14 탭 47행 ytb_t1-01 → 0.9.13): 입구 = 컴포넌트 메뉴 «YouTube 썸네일» → 섹션(레이어) 이름 «ytb_» 접두어.
 *   메뉴 항목 #fp-add-yt-thumb 은 걷었다(관리자여도 없음). 사람 길 = 레이어 패널 섹션 이름 두 번 눌러 고쳐 Enter.
 * ★양성대조: _patches/ytb-CTL.patch(layer-panel.js 의 applyYoutubeThumbName 부름 걷음) ⇒ T1·T2·T3 빨강. */
async function renameSection(page, secId, name) {
  await page.evaluate(() => window.buildLayerPanel?.());
  const nm = page.locator(`.layer-section[data-sec-id="${secId}"] .layer-section-name`).first();
  await nm.scrollIntoViewIfNeeded(); await nm.dblclick();
  await page.keyboard.press('Meta+a'); await page.keyboard.type(name); await page.keyboard.press('Enter');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function addThumbByName(page) {
  const id = await page.evaluate(() => { window.__admin = { state: () => ({ isAdmin: true }) }; window.deselectAll?.(); const s = window.addSection(); s.id = s.id || 'secYt'; return s.id; });   // 관리자만(지디 261123)
  await renameSection(page, id, 'ytb_썸네일');
  await expect.poll(() => thumbInfo(page), { message: '이름 ytb_ 로 바꿨는데 썸네일 섹션이 안 됐다' }).not.toBeNull();
  return id;
}

test('T1 ★메뉴 입구 없음(관리자여도) · 섹션 이름 ytb_ → 핀 484 · 표시 · 패널 기본 1280/JPG', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { window.__admin = { state: () => ({ isAdmin: true }) }; });
  await menu(page);
  expect(await page.locator('#fp-add-yt-thumb').count(), '★컴포넌트 메뉴에 YouTube 썸네일 입구가 남아 있다(이스터에그로만)').toBe(0);
  await menu(page);   // 닫기
  const n0 = await page.locator(SECS).count();
  const id = await addThumbByName(page);
  await expect(page.locator(SECS), '섹션 +1(addSection 한 번 · 이름 바꾸기는 섹션을 안 늘림)').toHaveCount(n0 + 1);
  await expect(page.locator('#canvas .section-block[data-thumb]'), '썸네일 섹션은 한 장').toHaveCount(1);
  expect(await thumbInfo(page)).toEqual({ thumb: 'youtube', pin: 'true', h: 484, styleH: '484px' });
  await page.evaluate((id) => window.selectSection?.(document.getElementById(id)), id);
  await expect.poll(() => page.evaluate(() => ({
    w: document.getElementById('sec-export-width')?.value ?? null, f: document.getElementById('sec-export-format')?.value ?? null,
  })), { message: '썸네일 섹션 패널 기본이 1280 / JPG' }).toEqual({ w: '1280', f: 'jpg' });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('T2 ★⌘Z 한 번에 «이름 + 썸네일»이 같이 되돌아간다', async ({ page }) => {
  const errs = await scene(page);
  const id = await addThumbByName(page);
  await page.evaluate(() => window.undo());
  const u = await page.evaluate((id) => { const s = document.getElementById(id); return { thumb: s?.dataset.thumb ?? null, name: s?.dataset.name ?? null, pin: s?.dataset.heightPin ?? null }; }, id);
  expect(u.thumb, '⌘Z 한 번 뒤 썸네일 표시가 남았다').toBe(null);
  expect(/^ytb_/i.test(u.name || ''), '⌘Z 한 번 뒤 이름도 옛것').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('T3 ★저장→새 앱에 싣기 — 핀 484·표시 그대로', async ({ page, browser }) => {
  const errs = await scene(page);
  await addThumbByName(page);
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
