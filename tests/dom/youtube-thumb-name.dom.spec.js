/* youtube-thumb-name — «ytb_» 이스터에그(현빈 261123 · 0.9.14 탭 47행 ytb_t1-01 원문 → 0.9.13 GO) 의 끄기·지킴 칸 (켜기·⌘Z·저장 = youtube-thumb-preset T1~T3)
 * N1 ★기존 섹션(최소 높이 600) 이름 ytb_ → 켜짐(핀 484) → 저장·다시 열기 → 접두어 뗌 → 꺼짐 · 높이 = «켜기 전» 그대로(최소 600 · 핀 없음)
 * N2 ★옛 메뉴로 만든 썸네일(이름 무관)은 엉뚱한 이름 바꾸기로 안 꺼진다(앞 이름이 ytb_ 였을 때만 끔)
 * N3 ★설정 › 이스터에그에서 끄면(isEasterEggEnabled('youtubeThumb') = false) 이름을 바꿔도 무동작
 * N4 ★관리자 아님 = 이름을 바꿔도 무동작(지디 261123 «관리자만» · 옛 메뉴 입구와 같은 animGifVisible)
 * 양성대조: _patches/ytb-CTL.patch(layer-panel.js 의 applyYoutubeThumbName 부름 걷음) ⇒ N1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const info = (page, id) => page.evaluate((id) => { const s = document.getElementById(id); return s && { thumb: s.dataset.thumb ?? null, pin: s.dataset.heightPin ?? null, styleH: s.style.height, minH: s.style.minHeight, prev: s.dataset.thumbPrev ?? null }; }, id);
async function rename(page, id, name) {
  await page.evaluate(() => window.buildLayerPanel?.());
  const nm = page.locator(`.layer-section[data-sec-id="${id}"] .layer-section-name`).first();
  await nm.scrollIntoViewIfNeeded(); await nm.dblclick();
  await page.keyboard.press('Meta+a'); await page.keyboard.type(name); await page.keyboard.press('Enter');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function scene(page, admin = true) { await page.setViewportSize({ width: 1500, height: 1100 }); const e = await bootApp(page); if (admin) await page.evaluate(() => { window.__admin = { state: () => ({ isAdmin: true }) }; }); return e; }

test('N1 기존 섹션 ytb_ 켬 → 저장·다시 열기 → 접두어 뗌 = 켜기 전 높이로', async ({ page, browser }) => {
  const errs = await scene(page);
  const id = await page.evaluate(() => { const s = window.addSection(); s.id = 'sN1'; s.style.minHeight = '600px'; window.renderSectionHeights?.(); return s.id; });
  const before = await info(page, id);
  await rename(page, id, 'ytb_썸네일');
  const on = await info(page, id);
  const saved = await page.evaluate(() => window.getSerializedCanvas());
  await page.close();
  const ctx = await browser.newContext(); const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 1500, height: 1100 });
  const errs2 = await bootApp(p2);
  await p2.evaluate((html) => { window.__admin = { state: () => ({ isAdmin: true }) }; const c = document.getElementById('canvas'); c.innerHTML = html; window.rebindAll?.(); window.deselectAll?.(); }, saved);
  await rename(p2, id, '보통 섹션');
  const off = await info(p2, id);
  console.log('[N1 실측]', JSON.stringify({ before, on, off }));
  expect([before.thumb, before.minH], '[전제] 처음 = 썸네일 아님 · 최소 600').toEqual([null, '600px']);
  expect([on.thumb, on.pin, on.styleH, on.minH], '★ytb_ = 켬(핀 484 · 최소 높이 걷음)').toEqual(['youtube', 'true', '484px', '']);
  expect([off.thumb, off.pin, off.styleH, off.minH, off.prev], '★다시 연 뒤 접두어 뗌 = 꺼짐 · 켜기 전 높이(최소 600 · 핀 없음) · 기억 칸 걷힘').toEqual([null, null, '', '600px', null]);
  await ctx.close();
  expect([...errs, ...errs2], [...errs, ...errs2].join('\n')).toEqual([]);
});

test('N2 옛 메뉴로 만든 썸네일은 엉뚱한 이름 바꾸기로 안 꺼진다', async ({ page }) => {
  const errs = await scene(page);
  const id = await page.evaluate(() => { const s = window.addYoutubeThumbSection(); s.id = 'sN2'; return s.id; });
  await rename(page, id, '표지');
  const r = await info(page, id);
  expect([r.thumb, r.pin, r.styleH], '★앞 이름이 ytb_ 가 아니었으면 끄지 않는다').toEqual(['youtube', 'true', '484px']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N3 설정에서 이스터에그를 끄면 ytb_ 이름이어도 무동작', async ({ page }) => {
  const errs = await scene(page);
  const id = await page.evaluate(() => { const o = window.isEasterEggEnabled; window.isEasterEggEnabled = (k) => (k === 'youtubeThumb' ? false : (o ? o(k) : true)); const s = window.addSection(); s.id = 'sN3'; return s.id; });
  await rename(page, id, 'ytb_썸네일');
  const r = await info(page, id);
  expect([r.thumb, r.pin], '★이스터에그 꺼짐 = 이름만 바뀌고 썸네일 아님').toEqual([null, null]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N4 관리자 아님 = ytb_ 이름이어도 무동작', async ({ page }) => {
  const errs = await scene(page, false);
  const id = await page.evaluate(() => { window.__admin = { state: () => ({ isAdmin: false }) }; const s = window.addSection(); s.id = 'sN4'; return s.id; });
  await rename(page, id, 'ytb_썸네일');
  const r = await info(page, id);
  expect([r.thumb, r.pin], '★관리자 아님 = 이름만 바뀌고 썸네일 아님').toEqual([null, null]);
  expect(errs, errs.join('\n')).toEqual([]);
});
