/* section-bg-gradient.dom.spec.js — 1013t2E1 (현빈 「섹션블럭에 배경색을 지정하려는데 왜 그라데이션이 적용이 안되는지?」)
 *
 * 바닥 8d2435c0 실측(진짜 클릭): 섹션 배경 스와치 → 피커의 그라데이션 탭이 disabled
 *   (툴팁 「이 항목은 그라데이션 채우기를 지원하지 않아요」) · 눌러도 섹션 computed background-image = none.
 *   같은 길의 프레임은 됐다. 원인·고침은 js/props/prop-section.js 「배경색 이벤트」 주석.
 * G1 탭이 켜져 있고 누르면 섹션에 그라데이션이 «그려진다»(computed) · 정본 dataset.bg · 패널 스와치
 * G2 다른 섹션을 골랐다 돌아와도 피커가 그라데이션 탭으로 열리고, 열기만 해선 값이 안 바뀐다
 * G3 Solid 탭 = 단색 복귀(그라데이션 잔존 0)
 * G4 직렬화 왕복(저장→다시 열기 흉내: getSerializedCanvas → 캔버스 교체 → rebindAll) · ⌘Z
 * G5 배경 그림과 같이 — 불투명 그라데이션이면 그림이 이기고, 반투명 정지점이 있으면 그라데이션이 그림 «위» 층
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스 · ⛔Electron 아님 — 파일 저장·PNG 내보내기는 못 잰다).
 * 음성대조 = prop-section.js 의 onGradient 를 빼면 G1 이 빨강(기록은 커밋 메시지).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sec = (id) => `<div class="section-block" id="${id}" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:40px;padding-right:40px"><div class="gap-block" data-type="gap" style="height:240px"></div></div></div>`;
const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const state = (page, id) => page.evaluate((i) => {
  const s = document.getElementById(i); const cs = getComputedStyle(s);
  const sw = document.getElementById('sec-bg-color')?.closest('.prop-color-swatch');
  return { dataBg: s.dataset.bg ?? null, img: cs.backgroundImage, color: cs.backgroundColor, swatch: sw ? sw.style.background : null };
}, id);
const tabs = (page) => page.evaluate(() => {
  const p = document.querySelector('.goya-cp-popover'); if (!p || p.hidden) return null;
  return Object.fromEntries([...p.querySelectorAll('.goya-cp-tab')].map(t => [t.dataset.tab, { disabled: t.disabled, active: t.classList.contains('active') }]));
});

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); }, sec('gA') + sec('gB'));
  await raf2(page);
  return errs;
}
/** 진짜 클릭으로 섹션을 고른다(왼쪽 패딩 띠 = 블럭이 없는 자리). 전제: 그 섹션이 골라지고 섹션 패널이 떴다. */
async function selectSection(page, id) {
  const r = await page.evaluate((i) => { const s = document.getElementById(i); s.scrollIntoView({ block: 'center' }); const b = s.getBoundingClientRect(); return { x: b.left + 8, y: b.top + b.height / 2 }; }, id);
  await page.mouse.click(r.x, r.y);
  await page.waitForFunction((i) => document.getElementById(i).classList.contains('selected') && document.getElementById('sec-height-value')?.dataset.secId === i && !!document.getElementById('sec-bg-color'), id, { timeout: 5000 });
  await raf2(page);
}
/** 진짜 스와치를 진짜 마우스로 — color-picker.js mousedown(capture) 델리게이션 길. 전제: 팝오버가 떴다. */
async function openSwatch(page) {
  const r = await page.evaluate(() => { const e = document.getElementById('sec-bg-color').closest('.prop-color-swatch'); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.click(r.x, r.y);
  await page.waitForFunction(() => { const p = document.querySelector('.goya-cp-popover'); return !!p && !p.hidden; }, null, { timeout: 5000 });
}
/** 탭 단추 한가운데를 누른다. 전제: 그 점의 맨 위 요소가 그 탭이다(가려져 있으면 여기서 죽는다). */
async function clickTab(page, name) {
  const r = await page.evaluate((n) => { const t = document.querySelector(`.goya-cp-popover .goya-cp-tab[data-tab="${n}"]`); const b = t.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; return { x, y, hit: document.elementFromPoint(x, y)?.closest('.goya-cp-tab')?.dataset.tab || null }; }, name);
  expect(r.hit, `누르는 점이 ${name} 탭 위가 아니다`).toBe(name);
  await page.mouse.click(r.x, r.y);
  await raf2(page);
}
async function applyGradient(page, id) {
  await selectSection(page, id);
  await openSwatch(page);
  await clickTab(page, 'gradient');
  await expect.poll(async () => (await state(page, id)).img, { message: '그라데이션 탭을 눌렀는데 섹션에 안 그려졌다' }).toMatch(/^linear-gradient\(/);
}

test('G1 ★섹션 배경 스와치 → 그라데이션 탭이 켜져 있고, 누르면 섹션에 그라데이션이 그려진다', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gA');
  const before = await state(page, 'gA');
  expect(before.img, '전제: 시작은 그라데이션이 아니다').toBe('none');
  await openSwatch(page);
  const t0 = await tabs(page);
  expect(t0.solid.active, '전제: Solid 탭으로 열린다').toBe(true);
  expect(t0.gradient.disabled, '★그라데이션 탭이 잠겨 있다 = 섹션 칸이 «받는다»를 선언하지 않았다').toBe(false);
  await clickTab(page, 'gradient');
  await expect.poll(async () => (await state(page, 'gA')).img).toMatch(/^linear-gradient\(/);
  const after = await state(page, 'gA');
  expect(after.dataBg, '정본(dataset.bg)에 그라데이션 CSS').toMatch(/^linear-gradient\(90deg, #ffffff 0%, rgba\(255,255,255,0(\.0+)?\) 100%\)$/);
  expect(after.swatch, '패널 스와치도 그라데이션').toMatch(/linear-gradient\(/);
  expect((await tabs(page)).gradient.active).toBe(true);
  expect(errs).toEqual([]);
});

test('G2 다른 섹션을 골랐다 돌아오면 그라데이션 탭으로 열리고, 열기만 해선 값이 안 바뀐다', async ({ page }) => {
  const errs = await setup(page);
  await applyGradient(page, 'gA');
  const v0 = (await state(page, 'gA')).dataBg;
  await page.keyboard.press('Escape');
  await selectSection(page, 'gB');
  await selectSection(page, 'gA');
  const re = await state(page, 'gA');
  expect(re.swatch, '재선택한 패널의 스와치가 그라데이션이 아니다').toMatch(/linear-gradient\(/);
  await openSwatch(page);
  const t = await tabs(page);
  expect(t.gradient.active, '재선택 뒤 피커가 Solid 로 열렸다(시드 없음)').toBe(true);
  await clickTab(page, 'gradient');   // 같은 탭 재클릭 = 값 불변
  expect((await state(page, 'gA')).dataBg).toBe(v0);
  expect(errs).toEqual([]);
});

test('G3 Solid 탭 = 단색 복귀 — 그라데이션이 남지 않는다', async ({ page }) => {
  const errs = await setup(page);
  await applyGradient(page, 'gA');
  await clickTab(page, 'solid');
  await expect.poll(async () => (await state(page, 'gA')).img).toBe('none');
  const s = await state(page, 'gA');
  expect(s.dataBg, '정본이 단색으로 돌아왔다').toMatch(/^#[0-9a-f]{6}$/i);
  expect(s.color).toBe('rgb(255, 255, 255)');
  expect(errs).toEqual([]);
});

test('G4 직렬화 왕복(저장→다시 열기 흉내)에도 그라데이션이 남고, ⌘Z 는 그라데이션을 걷는다', async ({ page }) => {
  const errs = await setup(page);
  await applyGradient(page, 'gA');
  const v0 = await state(page, 'gA');
  await page.keyboard.press('Escape');
  // 왕복: 앱의 직렬화본으로 캔버스를 갈아 끼우고 rebindAll(js/io/save-load.js 복원 길)
  const round = await page.evaluate(() => {
    const html = window.getSerializedCanvas();
    const c = document.getElementById('canvas');
    c.innerHTML = html; window.rebindAll?.();
    const s = document.getElementById('gA');
    return { hasAttr: /data-bg="linear-gradient/.test(html), dataBg: s?.dataset.bg ?? null, img: s ? getComputedStyle(s).backgroundImage : null };
  });
  expect(round.hasAttr, '전제: 직렬화본에 data-bg 그라데이션이 실렸다').toBe(true);
  expect(round.dataBg).toBe(v0.dataBg);
  expect(round.img).toBe(v0.img);
  // 인라인이 빠진 길(dataset 만 남은 꼴)에서도 복원이 다시 세운다
  const bare = await page.evaluate(() => { const s = document.getElementById('gA'); s.style.backgroundImage = ''; const none = getComputedStyle(s).backgroundImage; window.rebindAll?.(); return { none, img: getComputedStyle(s).backgroundImage }; });
  expect(bare.none, '전제: 인라인을 걷으면 그라데이션이 사라진다').toBe('none');
  expect(bare.img).toMatch(/^linear-gradient\(/);
  expect(errs).toEqual([]);
});

test('G4b ⌘Z — 그라데이션 적용을 한 번에 되돌린다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.pushHistory?.());   // 기준 스냅샷(그라데이션 «전»)
  await applyGradient(page, 'gA');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => page.evaluate(() => getComputedStyle(document.getElementById('gA')).backgroundImage), { message: '⌘Z 뒤에도 그라데이션이 남았다' }).toBe('none');
  expect(await page.evaluate(() => document.getElementById('gA').dataset.bg ?? null)).toBe(null);
  expect(errs).toEqual([]);
});

test('G5 배경 그림과 같이 — 불투명 그라데이션은 그림에 양보하고, 반투명 정지점이 있으면 그림 위에 물든다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate((px) => {
    const s = document.getElementById('gA');
    const paint = (bg) => { s.dataset.bg = bg; s.dataset.bgImg = px; window.applySectionBg(s); return getComputedStyle(s).backgroundImage; };
    const opaque = paint('linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
    const tint = paint('linear-gradient(90deg, #ff0000 0%, rgba(0,0,255,0.500) 100%)');
    delete s.dataset.bgImg; window.applySectionBg(s);
    return { opaque, tint, back: getComputedStyle(s).backgroundImage, isG: window.isSectionGradient('linear-gradient(#fff, #000), url(a.png)') };
  }, PX);
  expect(r.opaque, '불투명 그라데이션 + 그림 = 그림만').toMatch(/^url\(/);
  expect(r.opaque).not.toMatch(/gradient/);
  expect(r.tint, '반투명 정지점 + 그림 = 그라데이션 층이 위, 그림이 아래').toMatch(/^linear-gradient\(.*\), url\(/);
  expect(r.back, '그림을 지우면 그라데이션이 돌아온다').toMatch(/^linear-gradient\(/);
  expect(r.isG, 'url 이 낀 합성 값은 그라데이션 «값»이 아니다').toBe(false);
  expect(errs).toEqual([]);
});
