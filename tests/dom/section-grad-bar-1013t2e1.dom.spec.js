/* section-grad-bar-1013t2e1 — 섹션 배경 그라데이션의 «캔버스 그라데이션 바» (1013t2E1 👉 뒤).
 *
 * 현빈 원문(👉 뒤): 「적용된거 확인했음, 하지만 캔버스에서는 그라데이션 바가 나타나진 않는지?」
 * 바닥 f62653ce 실측(S7-T8): 섹션에 그라데이션을 주고 골라도 .grad-line-overlay 0 · 같은 피커의 도형은 1(양성대조).
 * 고침: 어댑터 한 칸(js/props/gradient-model.js section-block) + 패널 두 줄(js/props/prop-section.js _syncSecGradLine).
 *
 * B1 그라데이션 섹션을 고르면 바 하나 — 그 섹션 것 · 크기 = 섹션 · 끝 원 둘 · 칩 = 정지점 수 · (음성) 단색 섹션은 0
 * B2 끝 원을 끌면 섹션 각도가 바뀌어 그려지고 패널 스와치가 따라간다 · ⌘Z 한 번 = 끌기 전
 * B3 단색 섹션에 피커로 그라데이션을 주면 «다시 고르지 않아도» 바가 선다 · Solid 로 돌리면 거둔다
 * B4 메시를 켜면 거두고(그리는 것이 메시) 끄면 돌아온다 · 배경 그림이 있으면 안 선다(그림 합성이 주인)
 * B5 고르기를 풀면 거두고, 직렬화본에 바가 안 실린다
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스 · ⛔Electron 아님). ⛔waitForTimeout 금지.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sec = (id, extra = '') => `<div class="section-block" id="${id}" data-section="1" ${extra}><div class="section-hitzone"></div><div class="section-inner" style="padding-left:40px;padding-right:40px"><div class="gap-block" data-type="gap" style="height:240px"></div></div></div>`;
const GR = 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)';
const GRAD_ATTR = `data-bg="${GR}" style="background-image:${GR}"`;
const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const bars = (page) => page.evaluate(() => [...document.querySelectorAll('.grad-line-overlay')].map((o) => {
  const r = o.getBoundingClientRect();
  return { owner: o._gradBlock?.id || null, w: r.width, h: r.height, ends: o.querySelectorAll('[data-grad-handle]').length, chips: o.querySelectorAll('.grad-stop-chip').length };
}));
const secRect = (page, id) => page.evaluate((i) => { const r = document.getElementById(i).getBoundingClientRect(); return { w: r.width, h: r.height }; }, id);

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); },
    sec('gA') + sec('gG', GRAD_ATTR) + sec('gI', `data-bg="${GR}" data-bg-img="${PX}"`));
  await raf2(page);
  return errs;
}
/* 진짜 클릭으로 섹션을 고른다(왼쪽 패딩 띠 = 블럭이 없는 자리) — section-bg-gradient.dom.spec.js 와 같은 꼴 */
async function selectSection(page, id) {
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  await page.mouse.click(b.left + 8, b.cy);
  await page.waitForFunction((i) => document.getElementById(i).classList.contains('selected') && document.getElementById('sec-height-value')?.dataset.secId === i && !!document.getElementById('sec-bg-color'), id, { timeout: 5000 });
  await raf2(page);
}
async function openSwatch(page) {
  const r = await page.evaluate(() => { const e = document.getElementById('sec-bg-color').closest('.prop-color-swatch'); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.click(r.x, r.y);
  await page.waitForFunction(() => { const p = document.querySelector('.goya-cp-popover'); return !!p && !p.hidden; }, null, { timeout: 5000 });
}
async function clickTab(page, name) {
  const r = await page.evaluate((n) => { const t = document.querySelector(`.goya-cp-popover .goya-cp-tab[data-tab="${n}"]`); const b = t.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; return { x, y, hit: document.elementFromPoint(x, y)?.closest('.goya-cp-tab')?.dataset.tab || null }; }, name);
  expect(r.hit, `누르는 점이 ${name} 탭 위가 아니다`).toBe(name);
  await page.mouse.click(r.x, r.y);
  await raf2(page);
}

test('B1 그라데이션 섹션을 고르면 바 하나(그 섹션 · 섹션 크기 · 끝 원 둘 · 칩 둘) — (음성) 단색 섹션은 0', async ({ page }) => {
  const errs = await setup(page);
  expect(await bars(page), '★전제: 아무것도 안 골랐으면 바가 없다').toEqual([]);
  await selectSection(page, 'gA');
  expect(await bars(page), '단색 섹션 = 바 0').toEqual([]);
  await selectSection(page, 'gG');
  await expect.poll(async () => (await bars(page)).length).toBe(1);
  const [b] = await bars(page);
  const s = await secRect(page, 'gG');
  expect({ owner: b.owner, ends: b.ends, chips: b.chips }).toEqual({ owner: 'gG', ends: 2, chips: 2 });
  expect(Math.abs(b.w - s.w) <= 1 && Math.abs(b.h - s.h) <= 1, `바 상자 = 섹션(${b.w}×${b.h} vs ${s.w}×${s.h})`).toBe(true);
  expect(errs).toEqual([]);
});

test('B2 끝 원을 끌면 섹션 각도가 바뀌어 그려지고 스와치가 따라간다 · ⌘Z 한 번 = 끌기 전', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gG');
  await expect.poll(async () => (await bars(page)).length).toBe(1);
  const end = await page.evaluate(() => { const e = document.querySelector('.grad-line-overlay .grad-line-finish').getBoundingClientRect(); const x = e.left + e.width / 2, y = e.top + e.height / 2; return { x, y, hit: document.elementFromPoint(x, y)?.classList.contains('grad-line-finish') }; });
  expect(end.hit, '★전제: 끝 원이 그 자리에서 맨 위다').toBe(true);
  await page.mouse.move(end.x, end.y);
  await page.mouse.down();
  await page.mouse.move(end.x - 60, end.y + 120, { steps: 6 });
  await page.mouse.up();
  const after = await page.evaluate(() => { const s = document.getElementById('gG'); return { bg: s.dataset.bg, img: getComputedStyle(s).backgroundImage, sw: document.getElementById('sec-bg-color')?.closest('.prop-color-swatch')?.style.background || '' }; });
  const deg = Number((/^linear-gradient\((\d+)deg/.exec(after.bg) || [])[1]);
  expect(Number.isFinite(deg) && deg !== 90, `각도가 바뀌었다: ${after.bg}`).toBe(true);
  expect(after.img.startsWith(`linear-gradient(${deg}deg`), '그 값이 섹션에 그려졌다').toBe(true);
  expect(after.sw.startsWith(`linear-gradient(${deg}deg`), '패널 스와치가 따라갔다').toBe(true);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.getElementById('gG').dataset.bg), '⌘Z 한 번 = 끌기 전').toBe(GR);
  expect(errs).toEqual([]);
});

test('B3 단색 섹션에 피커로 그라데이션을 주면 다시 고르지 않아도 바가 서고, Solid 로 돌리면 거둔다', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gA');
  expect(await bars(page), '★전제: 단색이라 바 0').toEqual([]);
  await openSwatch(page);
  await clickTab(page, 'gradient');
  await expect.poll(() => page.evaluate(() => document.getElementById('gA').dataset.bg || '')).toMatch(/^linear-gradient\(/);
  await expect.poll(async () => (await bars(page)).map((b) => b.owner)).toEqual(['gA']);
  await clickTab(page, 'solid');
  await expect.poll(() => page.evaluate(() => document.getElementById('gA').dataset.bg || '')).not.toMatch(/gradient/);
  await expect.poll(async () => (await bars(page)).length, '단색으로 돌리면 바를 거둔다').toBe(0);
  expect(errs).toEqual([]);
});

test('B4 메시를 켜면 거두고 끄면 돌아온다 · 배경 그림이 있는 섹션엔 안 선다', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gG');
  await expect.poll(async () => (await bars(page)).length).toBe(1);
  await page.click('#panel-right #sec-bg-mesh');
  await expect.poll(() => page.evaluate(() => !!document.getElementById('gG').dataset.bgMesh), '★전제: 메시가 켜졌다').toBe(true);
  await expect.poll(async () => (await bars(page)).length, '메시 = 바 0').toBe(0);
  await page.click('#panel-right #sec-bg-mesh');
  await expect.poll(async () => (await bars(page)).map((b) => b.owner), '메시를 끄면 그라데이션 바가 돌아온다').toEqual(['gG']);
  await selectSection(page, 'gI');
  expect(await page.evaluate(() => document.getElementById('gI').dataset.bg), '★전제: 그림 섹션에도 그라데이션 값이 있다').toBe(GR);
  expect(await bars(page), '그림이 있으면 바 0(그림 합성이 주인)').toEqual([]);
  expect(errs).toEqual([]);
});

test('B5 고르기를 풀면 거두고, 직렬화본에 바가 안 실린다', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gG');
  await expect.poll(async () => (await bars(page)).length).toBe(1);
  const html = await page.evaluate(() => window.getSerializedCanvas());
  expect(/grad-line|grad-stop-chip/.test(html), '직렬화본에 바 0').toBe(false);
  await page.evaluate(() => window.deselectAll());
  await expect.poll(async () => (await bars(page)).length).toBe(0);
  expect(errs).toEqual([]);
});
