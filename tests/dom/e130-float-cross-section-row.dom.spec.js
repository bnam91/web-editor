/* e130-float-cross-section-row.dom.spec.js — E130: 아이콘 블럭·서클을 띄운 채 «다른 섹션»으로 옮겼다 끄면 원래 섹션에 빈 행이 남던 것
 *
 * 머리표(지디 규율): [새 것] d1f642ff 에서 빨강 · [회귀 지킴] d1f642ff 에서도 초록 · [전제] 재기 위한 조건.
 * 실측(BUNDLE-C/e130.json · REAL b1-cross): 옮겨 끈 뒤 원래 행 자식 0 · 원래 섹션 빈 행 1.
 * 고침 = overlay-float.js exitFloat «다른 섹션» 갈래에서 옛 overlayReturnParent 가 .row 이고 요소 자식이 없으면 지운다.
 * 길: 블럭 클릭(clickAt) → 패널 띄우기 토글 클릭 → 진짜 마우스로 끌어 다른 섹션 위 → 다시 골라 토글 클릭. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const KINDS = [
  { name: '아이콘 블럭', make: `(() => { const { row, block } = window.makeIconifyBlock('mdi:star', '<svg viewBox="0 0 24 24"><rect width="24" height="24" fill="currentColor"/></svg>', 64); return { row, block }; })()`, toggle: 'icn-float-toggle' },
  { name: '아이콘 서클', make: `(() => { const r = window.makeIconCircleBlock ? window.makeIconCircleBlock() : null; return r; })()`, toggle: 'icb-float-toggle' },
];

async function setup(page, kind, { withSibling = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1300 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(([make, withSibling]) => {
    /* 하네스 electronAPI 는 모든 호출이 null 함수 — 아이콘 패널이 부르는 svgPresets.list 만 «빈 목록»으로(icon-preset-empty-hint 선례). */
    const base = window.electronAPI; window.electronAPI = new Proxy({}, { get: (_, k) => (k === 'svgPresets' ? { list: async () => [] } : base[k]) });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sA" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sA-in"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="gap-block" data-type="gap" style="height:220px"></div></div></div><div class="section-block" id="sB" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sB-in"><div class="gap-block" data-type="gap" style="height:260px"></div></div></div>');
    const made = eval(make);
    if (!made) return null;
    const { row, block } = made;
    if (withSibling) { const { block: t } = window.makeIconifyBlock('mdi:circle', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>', 48); t.id = 'tbSib'; row.appendChild(t); }
    document.getElementById('sA-in').insertBefore(row, document.getElementById('sA-in').lastElementChild);   // 띄우면 서클이 240 으로 커져(하네스 실측) 섹션 A 밖으로 넘치지 않게 아래 여백을 둔다
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').scrollIntoView({ block: 'start' });
    return { block: block.id, row: row.id };
  }, [kind.make, withSibling]);
  expect(ids, `[전제] ${kind.name} 를 만들었다`).toBeTruthy();
  await page.waitForTimeout(300);
  return { errs, ...ids };
}
async function pickAndToggle(page, id, toggle, label) {
  const p = await page.evaluate((id) => { const b = document.getElementById(id); const e = b.querySelector('.icb-circle') || b; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await clickAt(page, p[0], p[1], { sel: `[id="${id}"]` }, { label: label + ' 고르기' });
  await expect.poll(() => page.evaluate((t) => !!document.getElementById(t), toggle), { message: `[전제] 패널 토글 #${toggle}` }).toBe(true);
  const b = await page.locator('#' + toggle).boundingBox();
  await clickAt(page, b.x + b.width / 2, b.y + b.height / 2, { sel: `[id="${toggle}"]` }, { label });
  await page.waitForTimeout(300);
}
const emptyRows = (page, sec) => page.evaluate((sec) => [...document.querySelectorAll(`#${sec} .row`)].filter(r => ![...r.children].some(k => !k.classList.contains('drop-indicator'))).length, sec);

for (const kind of KINDS) {
  test(`X1 [새 것] ${kind.name} — 띄워 다른 섹션으로 옮겨 끄면 원래 섹션에 빈 행 0`, async ({ page }) => {
    const { errs, block, row } = await setup(page, kind);
    await pickAndToggle(page, block, kind.toggle, '띄우기 켬');
    expect(await page.evaluate((id) => document.getElementById(id).dataset.overlayBlock, block), '[전제] 떴다').toBe('true');
    const a = await page.evaluate((id) => { const b = document.getElementById(id); const e = b.querySelector('.icb-circle') || b; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, block);
    const t = await page.evaluate(() => { const r = document.getElementById('sB').getBoundingClientRect(); return [r.top + 80]; });
    await page.mouse.move(a[0], a[1]); await page.mouse.down();
    for (let i = 1; i <= 14; i++) await page.mouse.move(a[0], a[1] + (t[0] - a[1]) * i / 14);
    await page.mouse.up(); await page.waitForTimeout(300);
    expect(await page.evaluate((id) => document.getElementById(id).closest('.section-block').id, block), '[전제] 다른 섹션(sB)으로 옮겨졌다').toBe('sB');
    await pickAndToggle(page, block, kind.toggle, '띄우기 끔');
    expect(await page.evaluate((id) => document.getElementById(id).dataset.overlayBlock ?? null, block), '[전제] 꺼졌다').toBe(null);
    expect(await emptyRows(page, 'sA'), '★원래 섹션 빈 행').toBe(0);
    expect(await page.evaluate((r) => !!document.getElementById(r), row), '원래 행이 치워졌다').toBe(false);
    expect(errs).toEqual([]);
  });

  test(`G1 [회귀 지킴] ${kind.name} — 같은 섹션 안에서 켰다 끄면 원래 행으로 돌아간다`, async ({ page }) => {
    const { errs, block, row } = await setup(page, kind);
    await pickAndToggle(page, block, kind.toggle, '띄우기 켬');
    await pickAndToggle(page, block, kind.toggle, '띄우기 끔');
    expect(await page.evaluate(([b, r]) => document.getElementById(b).parentElement?.id === r, [block, row]), '원래 행 안').toBe(true);
    expect(await emptyRows(page, 'sA')).toBe(0);
    expect(errs).toEqual([]);
  });
}

test('G2 [회귀 지킴] 다른 블럭이 같이 든 행은 다른 섹션 갈래에서도 안 지운다', async ({ page }) => {
  const kind = KINDS[0];
  const { errs, block, row } = await setup(page, kind, { withSibling: true });
  await pickAndToggle(page, block, kind.toggle, '띄우기 켬');
  const a = await page.evaluate((id) => { const b = document.getElementById(id); const e = b.querySelector('.icb-circle') || b; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, block);
  const t = await page.evaluate(() => document.getElementById('sB').getBoundingClientRect().top + 80);
  await page.mouse.move(a[0], a[1]); await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(a[0], a[1] + (t - a[1]) * i / 14);
  await page.mouse.up(); await page.waitForTimeout(300);
  expect(await page.evaluate((id) => document.getElementById(id).closest('.section-block').id, block), '[전제] sB 로 옮겨짐').toBe('sB');
  await pickAndToggle(page, block, kind.toggle, '띄우기 끔');
  expect(await page.evaluate((r) => !!document.getElementById(r) && !!document.getElementById('tbSib'), row), '형제가 든 행은 그대로').toBe(true);
  expect(errs).toEqual([]);
});
