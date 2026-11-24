/* position-std.dom.spec.js — 표준 Position 절(시트 0.9.14 73행 · 현빈 확정 261124 10:47·10:49·11:03·11:11 · 시안 8910 #mkp-posstd gdragon 0f8d0ca · 계획 handoff/PLAN-position-std-261124 · 지디 GO)
 *   P1 = 부품(js/props/_position-section.js) + 머리 엔드슬롯 [슬라이드 모드][IAL ⊡] + 슬라이드 모드(패널 설정 하나) + 첫 소비자 modal
 *   PS1 흐름 안 모달 — 머리 엔드슬롯 단추 둘(슬라이드 → IAL 순) · 정렬 6·X/Y = 있음 + disabled(숨김 아님 · 툴팁 6-2) · 회전 칸은 씀
 *   PS2 떠 있는 모달 — 정렬 6·X/Y 씀(disabled 0) · X/Y = offsetX/Y
 *   PS3 슬라이드 모드 — 머리 토글 = 회전 슬라이더 줄(옛 숫자 칸·90°·뒤집기 그대로 아래) · 패널 설정이라 다른 모달 골라도 켜진 채 · 다시 누르면 꺼짐
 *   PS4 슬라이더 30 → 저장 키 = 옛 dataset.rotation(키 무변) · 숫자 칸 30 · ⌘Z 한 번 = 0 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, n = 1) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((n) => {
    try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {}
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div><div class="section-inner" id="inner1"></div></div>');
    window.rebindAll?.();
    window.__mdls = [];
    for (let i = 0; i < n; i++) { document.getElementById('sec1').classList.add('selected'); const m = window.addModalBlock?.({}); window.__mdls.push(m && m.block); }
    window.deselectAll?.(); window.selectBlock?.(window.__mdls[0].id); window.showModalProperties?.(window.__mdls[0]); window.clearHistory?.();
  }, n);
  await page.waitForSelector('#mdl-float-toggle');
  return errs;
}
const posSec = (page) => page.evaluate(() => {
  const sec = document.querySelector('#panel-right .prop-section[data-sec="position"]');
  if (!sec) return null;
  const head = [...sec.querySelectorAll(':scope > .prop-sec-head button, :scope > .prop-sec-head label')].filter((b) => b.querySelector('svg') || b.id).map((b) => b.id || b.querySelector('input')?.id || '');
  const al = [...sec.querySelectorAll('[data-float-align]')];
  const x = document.getElementById('mdl-x-number'), y = document.getElementById('mdl-y-number');
  return { head, align: al.length, alignDisabled: al.filter((b) => b.disabled).length, xy: [!!x, !!y], xyDisabled: [x?.disabled, y?.disabled], xTip: x?.closest('[title]')?.getAttribute('title') || x?.title || '',
    rot: !!document.getElementById('mdl-rot-number') && !document.getElementById('mdl-rot-number').disabled, slider: !!document.getElementById('mdl-rot-number-slider') };
});

test('PS1 흐름 안 모달 — 머리 [슬라이드][IAL] · 정렬 6·X/Y = disabled(숨김 아님) + 툴팁 · 회전 씀', async ({ page }) => {
  const errs = await scene(page);
  const r = await posSec(page);
  expect(r, '[전제] Position 절').not.toBeNull();
  expect(r.head.filter((h) => h === 'mdl-rot-slide' || h === 'mdl-float-toggle'), '★머리 엔드슬롯 = 슬라이드 → IAL 순').toEqual(['mdl-rot-slide', 'mdl-float-toggle']);
  expect([r.align, r.alignDisabled], '★정렬 6 = 있음 · 전부 disabled(옛: 없음)').toEqual([6, 6]);
  expect([r.xy, r.xyDisabled], '★X/Y = 있음 · disabled').toEqual([[true, true], [true, true]]);
  expect(r.xTip, '★툴팁 = 흐름이라 못 씀 · IAL 켜면 씀').toMatch(/흐름/);
  expect(r.rot, '회전 칸은 씀').toBe(true);
  expect(errs).toEqual([]);
});

test('PS2 떠 있는 모달 — 정렬 6·X/Y 씀 · X/Y = offsetX/Y', async ({ page }) => {
  const errs = await scene(page);
  await page.click('#mdl-float-toggle');
  await expect.poll(() => posSec(page).then((r) => r && [r.align, r.alignDisabled, r.xyDisabled])).toEqual([6, 0, [false, false]]);
  const v = await page.evaluate(() => { const p = window.__mdls[0].closest('[data-overlay-block="true"]') || window.__mdls[0]; return [String(parseInt(p.dataset.offsetX) || 0), String(parseInt(p.dataset.offsetY) || 0), document.getElementById('mdl-x-number').value, document.getElementById('mdl-y-number').value]; });
  expect([v[2], v[3]], '★X/Y 칸 = offsetX/Y').toEqual([v[0], v[1]]);
  expect(errs).toEqual([]);
});

test('PS3 슬라이드 모드 — 머리 토글 = 슬라이더 줄 · 패널 설정(다른 모달도 켜진 채) · 다시 누르면 꺼짐', async ({ page }) => {
  const errs = await scene(page, 2);
  expect((await posSec(page)).slider, '[전제] 기본 = 숫자 칸만').toBe(false);
  await page.click('#mdl-rot-slide');
  await expect.poll(() => posSec(page).then((r) => r && [r.slider, r.rot])).toEqual([true, true]);
  expect(await page.evaluate(() => document.getElementById('mdl-rot-slide').getAttribute('aria-pressed')), '★토글 켜짐 표시').toBe('true');
  await page.evaluate(() => { window.deselectAll?.(); window.selectBlock?.(window.__mdls[1].id); window.showModalProperties?.(window.__mdls[1]); });
  await expect.poll(() => posSec(page).then((r) => r && r.slider), '★패널 설정 — 다른 모달도 슬라이더').toBe(true);
  await page.click('#mdl-rot-slide');
  await expect.poll(() => posSec(page).then((r) => r && r.slider), '★다시 누르면 꺼짐').toBe(false);
  expect(errs).toEqual([]);
});

test('PS4 슬라이더 30 → 옛 키 dataset.rotation · 숫자 칸 30 · ⌘Z 한 번 = 0', async ({ page }) => {
  const errs = await scene(page);
  const mid = await page.evaluate(() => window.__mdls[0].id);
  await page.click('#mdl-rot-slide');
  await page.waitForSelector('#mdl-rot-number-slider');
  await page.evaluate(() => { const s = document.getElementById('mdl-rot-number-slider'); s.value = '30'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(() => page.evaluate(() => [window.__mdls[0].dataset.rotation, document.getElementById('mdl-rot-number').value])).toEqual(['30', '30']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.rotation || '0', mid), '★⌘Z 한 번 = 0(되돌리기는 블럭 DOM 을 새로 그린다 → id 로 다시 집는다)').toBe('0');
  expect(errs).toEqual([]);
});
