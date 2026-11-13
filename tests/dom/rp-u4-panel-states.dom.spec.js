/* rp-u4-panel-states — U4(right-panel-unify) 블록의 패널 상태(A-7): 넘침 · 키보드 포커스. (panel-frame-states.dom.spec.js 의 U4 판 — 그 파일은 U0 소유라 따로 둔다)
 * 대상 = asset · shape · zoom · icon-circle (§5 U4 · 지디 지정 최소 넷).
 * N1 넘침 — 패널 240px · 블록 이름 60자에서 패널 몸통과 모든 절의 가로 넘침 0 (scrollWidth ≤ clientWidth).
 *   ★내장 양성대조 N1p: 같은 패널 첫 절 몸통에 폭 600px 줄을 심으면 같은 자가 그 절을 넘침으로 잡는다.
 * F1 키보드 — 패널 맨 앞 임시 단추에서 Tab 한 번 = 첫 절 머리 · :focus-visible 링(outline ≠ none) · Enter 로 접힘(aria-expanded false · 몸통 숨김) · Space 로 다시 펼침.
 *   ★내장 양성대조 F1p: 첫 절 머리의 tabindex 를 떼면 Tab 이 그 머리에 «안» 간다 — 자가 tabindex 를 보고 있다.
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

test('F1 키보드 — Tab 이 첫 절 머리에 닿고 링이 보이고 Enter/Space 로 접고 편다 (asset · shape · zoom · icon-circle)', async ({ page }) => {
  const { errs, roster } = await scene(page);
  for (const cls of KINDS) {
    await openLong(page, roster, cls);
    const f = await tabFromStart(page);
    expect(f.isFirstHead, `★${cls}: Tab 이 첫 절 머리에 안 간다(간 곳 ${f.id})`).toBe(true);
    expect(f.fv, `[전제] ${cls}: 키보드 포커스`).toBe(true);
    expect(f.outline, `★${cls}: focus-visible 링이 없다`).not.toBe('none');
    const head = page.locator(`#${f.id}`);
    const bodyId = await head.getAttribute('aria-controls');
    await expect(head).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(head, `★${cls}: Enter 로 안 접힌다`).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`#${bodyId}`)).toBeHidden();
    await page.keyboard.press(' ');
    await expect(head, `★${cls}: Space 로 안 펴진다`).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${bodyId}`)).toBeVisible();
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F1p ★양성대조 — 첫 절 머리의 tabindex 를 떼면 Tab 이 그 머리에 안 간다', async ({ page }) => {
  const { roster } = await scene(page);
  await openLong(page, roster, 'zoom-block');
  expect((await tabFromStart(page)).isFirstHead, '[전제] 떼기 전엔 닿는다').toBe(true);
  await page.evaluate((sel) => document.querySelector(sel).removeAttribute('tabindex'), HEAD);
  expect((await tabFromStart(page)).isFirstHead, '★자가 tabindex 를 안 본다').toBe(false);
});
