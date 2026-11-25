/* l4b-wh-mode.dom.spec.js — L4b(현빈 L-2 확정): W/H 모드 = «이미 있는 모드만» 표준 모드 드롭다운(layoutSizeRowHTML mode 줄)
 *   ① 어노테이션 라벨 너비 — 옛 «자동» 단추(#annot-label-w-auto) → #annot-label-w-mode(고정/자동)
 *   ② 말풍선 크기       — 옛 자동/고정 세그먼트(#bubble-size-group [data-bsz]) → #bubble-size-mode(고정/자동)
 * ★쓰는 키·값 = 옛 판(3cee8003e)과 같다:
 *   어노테이션  자동 = labelWidth 키 지움(옛 단추) · 고정 = 지금 라벨 폭(px, 옛 칸에 그 값을 친 것과 같은 키) · 이력 push-after 한 칸
 *   말풍선      고정 = bubbleSize 'fixed' + bubbleW = ceil(몸통 실폭) · bubbleH = round(몸통 높이)(없을 때만) · 자동 = bubbleSize 만 지움(W/H 남김) · 이력 push-before 한 칸
 * ⛔고정 대기 없음 — expect.poll/waitForFunction 만. ⛔앱 무접촉(_root-harness.bootApp).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js l4b-wh-mode --workers=1 --retries=0 --reporter=line */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); window.__sec = c.querySelector('.section-block');
    window.applyZoom?.(100);
    window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); };
  });
  return errs;
}
const ph = (page) => page.evaluate(() => window.__ph);
const opts = (page, id) => page.evaluate((id) => [...document.getElementById(id).options].map((o) => o.text), id);

test('M1 어노테이션 라벨 너비 — 드롭다운 [고정, 자동] · 고정 = 지금 폭을 labelWidth 로 · 자동 = 키 지움 · 각 ⌘Z 한 칸', async ({ page }) => {
  const errs = await scene(page);
  const id = await page.evaluate(() => {
    const b = window.makeAnnotationBlock({ points: [[200, 160], [500, 160]], text: '라벨 너비 모드' });
    window.__sec.querySelector('.section-inner').appendChild(b); window.bindAnnotationSelect?.(b);
    window.pushHistory('삽입');   // 바탕 표본(push-after 패널 앞의 «삽입» 칸)
    window.showAnnotationProperties(b);
    return b.id;
  });
  const open = () => page.evaluate((id) => window.showAnnotationProperties(document.getElementById(id)), id);
  const ds = () => page.evaluate((id) => document.getElementById(id).dataset.labelWidth ?? null, id);
  expect(await opts(page, 'annot-label-w-mode')).toEqual(['Fixed', 'Hug']);   // ★기대 바뀜(현빈 261125 17:36 크기 모드 영어 · FigCraft)
  expect(await page.evaluate(() => [document.getElementById('annot-label-w-mode').value, document.getElementById('annot-label-w').disabled, document.getElementById('annot-label-w').placeholder]),
    '★전제: 키 없음 = 자동 · 칸 막힘 · «Hug»').toEqual(['auto', true, 'Hug']);
  expect(await page.locator('#annot-label-w-auto').count(), '옛 «자동» 단추 걷음').toBe(0);
  const want = await page.evaluate((id) => { const L = window.ANNOT_LIMITS.labelWidth; const w = Math.round(document.getElementById(id).querySelector('.annot-label').offsetWidth); return String(Math.min(L.max, Math.max(L.min, w))); }, id);
  const p0 = await ph(page);
  await page.selectOption('#annot-label-w-mode', 'fixed');
  await expect.poll(ds, '고정 = 지금 라벨 폭').toBe(want);
  expect(await ph(page) - p0, '이력 한 칸').toBe(1);
  expect(await page.evaluate(() => [document.getElementById('annot-label-w-mode').value, document.getElementById('annot-label-w').disabled, document.getElementById('annot-label-w').value]),
    '고정 = 칸 열림 · 값').toEqual(['fixed', false, want]);
  await page.evaluate(() => window.undo());
  await expect.poll(ds, '★⌘Z 한 번 = 고르기 전(키 없음)').toBe(null);
  await page.evaluate(() => window.redo());
  await expect.poll(ds).toBe(want);
  await open();
  const p1 = await ph(page);
  await page.selectOption('#annot-label-w-mode', 'auto');
  await expect.poll(ds, '자동 = 키 지움(옛 «자동» 단추와 같은 길)').toBe(null);
  expect(await ph(page) - p1, '이력 한 칸').toBe(1);
  await page.evaluate(() => window.undo());
  await expect.poll(ds, '★⌘Z 한 번 = 고정 값으로').toBe(want);
  expect(errs).toEqual([]);
});

test('M2 말풍선 크기 — 드롭다운 [고정, 자동] · 고정 = bubbleSize fixed + W/H 씨앗 · 자동 = bubbleSize 만 지움 · 각 ⌘Z 한 칸', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { window.selectSection(window.__sec); window.addSpeechBubbleBlock('left'); window.__sb = window.__sec.querySelector('.speech-bubble-block'); });
  await page.waitForFunction(() => !!window.__sb?.querySelector('.tb-bubble'));
  const id = await page.evaluate(() => window.__sb.id);
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.waitForFunction(() => !!document.getElementById('bubble-size-mode'));
  const ds = () => page.evaluate((id) => { const d = document.getElementById(id).dataset; return { size: d.bubbleSize ?? null, w: d.bubbleW ?? null, h: d.bubbleH ?? null }; }, id);
  expect(await opts(page, 'bubble-size-mode')).toEqual(['Fixed', 'Hug']);   // ★기대 바뀜(현빈 261125 17:36 크기 모드 영어)
  expect(await page.locator('#bubble-size-group').count(), '옛 세그먼트 걷음').toBe(0);
  expect(await page.evaluate(() => ['bubble-w-number', 'bubble-h-number'].map((i) => `${document.getElementById(i).disabled}:${document.getElementById(i).placeholder}`)), '★전제: 자동 = 두 칸 막힘 «Hug»').toEqual(['true:Hug', 'true:Hug']);
  expect(await ds()).toEqual({ size: null, w: null, h: null });
  /* 옛 _setSize 씨앗 자 그대로(올림 실폭 · 반올림 높이) */
  const seed = await page.evaluate((id) => { const b = document.getElementById(id).querySelector('.tb-bubble'); const cs = getComputedStyle(b); const w = parseFloat(cs.width) || 0;
    const ew = cs.boxSizing === 'border-box' ? w : ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((a, k) => a + (parseFloat(cs[k]) || 0), w);
    return { w: String(Math.ceil(ew)), h: String(Math.round(b.offsetHeight)) }; }, id);
  const p0 = await ph(page);
  await page.selectOption('#bubble-size-mode', 'fixed');
  await expect.poll(ds, '고정 = 옛 «고정» 단추와 같은 키').toEqual({ size: 'fixed', ...seed });
  expect(await ph(page) - p0, '이력 한 칸').toBe(1);
  await page.waitForFunction(() => document.getElementById('bubble-size-mode')?.value === 'fixed');
  expect(await page.evaluate(() => ['bubble-w-number', 'bubble-h-number'].map((i) => `${document.getElementById(i).disabled}:${document.getElementById(i).value}`)), '고정 = 두 칸 열림 · 값').toEqual([`false:${seed.w}`, `false:${seed.h}`]);
  await page.evaluate(() => window.undo());
  await expect.poll(ds, '★⌘Z 한 번 = 고르기 전').toEqual({ size: null, w: null, h: null });
  await page.evaluate(() => window.redo());
  await expect.poll(ds).toEqual({ size: 'fixed', ...seed });
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.waitForFunction(() => document.getElementById('bubble-size-mode')?.value === 'fixed');
  const p1 = await ph(page);
  await page.selectOption('#bubble-size-mode', 'auto');
  await expect.poll(ds, '자동 = bubbleSize 만 지움(W/H 는 옛 판처럼 남는다)').toEqual({ size: null, ...seed });
  expect(await ph(page) - p1, '이력 한 칸').toBe(1);
  expect(await page.evaluate((id) => document.getElementById(id).querySelector('.tb-bubble').style.width, id), '자동 = 인라인 너비 걷힘').toBe('');
  await page.evaluate(() => window.undo());
  await expect.poll(ds, '★⌘Z 한 번 = 고정으로').toEqual({ size: 'fixed', ...seed });
  expect(errs).toEqual([]);
});
