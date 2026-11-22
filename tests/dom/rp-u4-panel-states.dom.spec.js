/* rp-u4-panel-states — U4(right-panel-unify) 블록의 패널 상태(A-7): 넘침 · 키보드 포커스. (panel-frame-states.dom.spec.js 의 U4 판 — 그 파일은 U0 소유라 따로 둔다)
 * 대상 = asset · shape · zoom · icon-circle (§5 U4 · 지디 지정 최소 넷).
 * N1 넘침 — 패널 240px · 블록 이름 60자에서 패널 몸통과 모든 절의 가로 넘침 0 (scrollWidth ≤ clientWidth).
 *   ★내장 양성대조 N1p: 같은 패널 첫 절 몸통에 폭 600px 줄을 심으면 같은 자가 그 절을 넘침으로 잡는다.
 * F1 ★기대 바뀜(패널 재설계 1차 · 표준 절 접기 없음) — Tab 이 절 머리에 «안» 간다 · 머리를 눌러도 몸이 그대로 · aria-expanded 없음.
 *   ★내장 양성대조 F1p: 첫 절 머리에 tabindex=0 을 붙이면 Tab 이 그 머리에 간다 — 자가 tabindex 를 보고 있다.
 * ⛔화면 px 를 상수와 견주지 않는다 — 요소의 scroll/client 폭끼리만 비교한다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { rosterOf, addKind } = require('./_block-roster-294.js');

const KINDS = ['asset-block', 'shape-block', 'zoom-block', 'icon-circle-block'];
const HEAD = '#panel-right .panel-body > .prop-section[data-sec] > .prop-sec-head > .prop-section-title';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec; });
  return { errs, roster: await rosterOf(page) };
}
/** 블록을 넣고(앱 입구) 이름을 60자로 바꾼 뒤 그 패널을 연다. */
async function openLong(page, roster, cls) {
  const kind = roster.find((r) => r.cls === cls);
  expect(kind?.entry, `[전제] ${cls} 입구`).toBeTruthy();
  const r = await addKind(page, kind);
  expect(r.err, `[전제] ${cls} 넣기`).toBeUndefined();
  await page.evaluate((id) => { document.getElementById(id).dataset.layerName = '가'.repeat(60); window.selectBlock(id); }, r.id);
  await expect(page.locator(HEAD).first(), `[전제] ${cls} 패널이 틀로 그려졌다`).toBeAttached();
  return r.id;
}
const overflowOf = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  return [body, ...body.querySelectorAll(':scope > .prop-section')].filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.id || e.className);
});

test('N1 넘침 — 240px 패널 · 60자 이름에서 가로 넘침 0 (asset · shape · zoom · icon-circle)', async ({ page }) => {
  const { errs, roster } = await scene(page);
  await page.evaluate(() => { document.getElementById('panel-right').style.width = '240px'; });
  const out = {};
  for (const cls of KINDS) {
    await openLong(page, roster, cls);
    expect(await page.evaluate(() => document.getElementById('panel-right').getBoundingClientRect().width), '[전제] 패널 폭 240').toBeLessThanOrEqual(240.5);
    out[cls] = await overflowOf(page);
  }
  console.log('[N1] ' + JSON.stringify(out));
  expect(out, '★가로 넘침이 있는 절').toEqual(Object.fromEntries(KINDS.map((k) => [k, []])));
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('N1p ★양성대조 — 폭 600px 줄을 심으면 같은 자가 넘침을 잡는다', async ({ page }) => {
  const { roster } = await scene(page);
  await page.evaluate(() => { document.getElementById('panel-right').style.width = '240px'; });
  await openLong(page, roster, 'shape-block');
  expect(await overflowOf(page), '[전제] 심기 전엔 0').toEqual([]);
  await page.evaluate(() => { const b = document.querySelector('#panel-right .prop-section[data-sec] > .prop-sec-body'); const d = document.createElement('div'); d.style.cssText = 'width:600px;white-space:nowrap'; d.textContent = 'x'; b.appendChild(d); });
  expect((await overflowOf(page)).length, '★자가 넘침을 못 본다').toBeGreaterThan(0);
});

/** 패널 맨 앞에 임시 단추를 두고 Tab — 블록 머리에는 포커스 받을 것이 없으니 다음 칸이 첫 절 머리다(panel-frame-states S2 와 같은 꼴). */
async function tabFromStart(page) {
  await page.evaluate(() => { const b = document.createElement('button'); b.id = '__tabstart'; document.querySelector('#panel-right .panel-body').prepend(b); b.focus(); });
  await page.keyboard.press('Tab');
  const r = await page.evaluate((sel) => { const a = document.activeElement; const first = document.querySelector(sel);
    return { isFirstHead: !!first && a === first, id: a?.id || null, fv: a?.matches(':focus-visible') || false, outline: a ? getComputedStyle(a).outlineStyle : null }; }, HEAD);
  await page.evaluate(() => document.getElementById('__tabstart')?.remove());
  return r;
}

test('F1 접기 없음 — Tab 이 절 머리에 안 가고 눌러도 몸이 그대로 (asset · shape · zoom · icon-circle)', async ({ page }) => {
  const { errs, roster } = await scene(page);
  for (const cls of KINDS) {
    await openLong(page, roster, cls);
    /* ★기대 바뀜(패널 재설계 1차) — 옛 판은 Tab 이 첫 절 머리에 닿고 Enter/Space 로 접고 폈다 */
    expect((await tabFromStart(page)).isFirstHead, `★${cls}: Tab 이 절 머리에 간다(누를 것이 아닌데)`).toBe(false);
    const head = page.locator(HEAD).first();
    expect(await head.getAttribute('aria-expanded'), `★${cls}: aria-expanded 가 남았다`).toBeNull();
    const body = page.locator('#panel-right .panel-body > .prop-section[data-sec] > .prop-sec-body').first();
    await head.click();
    await expect(body, `★${cls}: 머리를 누르니 몸이 숨었다`).toBeVisible();
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F1p ★양성대조 — 첫 절 머리에 tabindex=0 을 붙이면 Tab 이 그 머리에 간다', async ({ page }) => {
  const { roster } = await scene(page);
  await openLong(page, roster, 'zoom-block');
  expect((await tabFromStart(page)).isFirstHead, '[전제] 붙이기 전엔 안 닿는다').toBe(false);
  await page.evaluate((sel) => document.querySelector(sel).setAttribute('tabindex', '0'), HEAD);
  expect((await tabFromStart(page)).isFirstHead, '★자가 tabindex 를 안 본다').toBe(true);
});
