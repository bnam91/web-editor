/* section-bg-gradient.dom.spec.js — 1013t2E1 (현빈 「섹션블럭에 배경색을 지정하려는데 왜 그라데이션이 적용이 안되는지?」)
 *
 * 바닥 8d2435c0 실측(진짜 클릭): 섹션 배경 스와치 → 피커의 그라데이션 탭이 disabled
 *   (툴팁 「이 항목은 그라데이션 채우기를 지원하지 않아요」) · 눌러도 섹션 computed background-image = none.
 *   같은 길의 프레임은 됐다. 원인·고침은 js/props/prop-section.js 「배경색 이벤트」 주석.
 * G1  탭이 켜져 있고 누르면 섹션에 그라데이션이 «그려진다»(computed) · 정본 dataset.bg · 패널 스와치
 * G1b 그 적용을 ⌘Z 한 번이 걷는다
 * G2  이미 그라데이션이 든 섹션을 고르면 피커가 그라데이션 탭으로 열리고(열기만 해선 값 불변) hex = 첫 정지점 · 투명도를 치면 «첫 정지점 색»의 단색
 * G3  Solid 탭 = 단색 복귀(그라데이션 잔존 0) · ⌘Z 로 그라데이션이 돌아온다
 * G4  직렬화 왕복(저장→다시 열기 흉내: getSerializedCanvas → 캔버스 교체 → rebindAll)
 * G4c 인라인이 빠지고 dataset 만 남은 섹션도 복원이 다시 그린다
 * G5  배경 그림과 같이 — 불투명 그라데이션이면 그림이 이기고, 그림을 지우면 돌아온다
 * G5b 반투명 정지점이 있으면 그라데이션이 그림 «위» 층(물들임)
 * G6  곁 결함: 그라데이션 섹션의 패널 hex 가 쓰레기 값(rgbToHex(그라데이션 문자열))이 아니고 스와치가 그라데이션이다
 * G7  곁 결함: 그라데이션 섹션에서 투명도를 건드린 뒤 ⌘Z 하면 그라데이션이 돌아온다(잃지 않는다)
 * G8  피커 팝업 안의 투명도가 섹션에 먹는다(바닥 판: 무시됐다)
 * G9  투명(알파 0) 섹션에서 색을 치면 보이게 올라오고, 투명도 0 을 «직접» 친 뒤엔 그대로 둔다
 * G10 외부 API setSectionBg — 그라데이션을 받으면 그리고, 그라데이션 섹션에 단색을 주면 그라데이션을 걷는다
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스 · ⛔Electron 아님 — 파일 저장·실앱 PNG 는 못 잰다).
 * 음성대조(칸 ↔ 무력화한 줄)는 커밋 메시지와 reports/S5-1013t2/E-notes.md 에 수로 적었다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sec = (id, extra = '') => `<div class="section-block" id="${id}" data-section="1" ${extra}><div class="section-hitzone"></div><div class="section-inner" style="padding-left:40px;padding-right:40px"><div class="gap-block" data-type="gap" style="height:240px"></div></div></div>`;
const GR = 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)';
const GR_COMPUTED = 'linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)';
const GRAD_ATTR = `data-bg="${GR}" style="background-image:${GR}"`;
const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const state = (page, id) => page.evaluate((i) => {
  const s = document.getElementById(i); const cs = getComputedStyle(s);
  const sw = document.getElementById('sec-bg-color')?.closest('.prop-color-swatch');
  return { dataBg: s.dataset.bg ?? null, img: cs.backgroundImage, color: cs.backgroundColor, swatch: sw ? sw.style.background : null,
    hex: document.getElementById('sec-bg-hex')?.value ?? null, alpha: document.getElementById('sec-bg-alpha')?.value ?? null };
}, id);
const tabs = (page) => page.evaluate(() => {
  const p = document.querySelector('.goya-cp-popover'); if (!p || p.hidden) return null;
  return Object.fromEntries([...p.querySelectorAll('.goya-cp-tab')].map(t => [t.dataset.tab, { disabled: t.disabled, active: t.classList.contains('active') }]));
});

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); }, sec('gA') + sec('gB') + sec('gG', GRAD_ATTR) + sec('gT', `data-bg="rgba(255,255,255,0)" style="background-color:rgba(255,255,255,0)"`));
  await raf2(page);
  return errs;
}
/** 진짜 클릭으로 섹션을 고른다(왼쪽 패딩 띠 = 블럭이 없는 자리). 전제: 그 섹션이 골라지고 섹션 패널이 떴다. */
async function selectSection(page, id) {
  /* ★자리가 «멈춘 뒤»에 잰다 — bootApp 직후엔 배율 맞추기가 늦게 끝나, 먼저 잰 좌표를 누르면 빗나간다(_root-harness waitStableRect 머리말).
     첫 실행에서 G8 이 이 자리에서 한 번 빗나갔다(재시도 초록) — 그래서 넣었다. */
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  const r = { x: b.left + 8, y: b.cy };
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

/** 패널 칸에 진짜로 쳐 넣고 Enter. */
async function typeField(page, sel, text) {
  await page.locator(sel).click(); await page.keyboard.press('Meta+A'); await page.keyboard.type(text); await page.keyboard.press('Enter'); await raf2(page);
}
/** 포커스를 칸에서 빼고 ⌘Z — 칸에 포커스가 남으면 editor.js 가 ⌘Z 를 돌려보낸다. */
async function undo(page) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf2(page); }
const bgImg = (page, id) => page.evaluate((i) => getComputedStyle(document.getElementById(i)).backgroundImage, id);

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
  await expect.poll(async () => (await state(page, 'gA')).img, { message: '탭은 눌렸는데 섹션에 안 그려졌다' }).toMatch(/^linear-gradient\(/);
  const after = await state(page, 'gA');
  expect(after.dataBg, '정본(dataset.bg)에 그라데이션 CSS').toMatch(/^linear-gradient\(90deg, #ffffff 0%, rgba\(255,255,255,0(\.0+)?\) 100%\)$/);
  expect(after.swatch, '패널 스와치도 그라데이션').toMatch(/linear-gradient\(/);
  expect((await tabs(page)).gradient.active).toBe(true);
  expect(errs).toEqual([]);
});

test('G1b 그라데이션 적용을 ⌘Z 한 번이 걷는다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.pushHistory?.());   // 기준 스냅샷(그라데이션 «전»)
  await applyGradient(page, 'gA');
  await page.keyboard.press('Escape');
  await undo(page);
  await expect.poll(() => bgImg(page, 'gA'), { message: '⌘Z 뒤에도 그라데이션이 남았다 = 확정이 기록에 안 쌓였다' }).toBe('none');
  expect(await page.evaluate(() => document.getElementById('gA').dataset.bg ?? null)).toBe(null);
  expect(errs).toEqual([]);
});

test('G2 그라데이션이 든 섹션 — 피커가 그라데이션 탭으로 열리고(값 불변) hex·투명도는 첫 정지점 기준', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gG');
  const s0 = await state(page, 'gG');
  expect(s0.img, '전제: 그라데이션 섹션').toBe(GR_COMPUTED);
  expect(s0.hex, 'hex = 첫 정지점(Solid 복귀 색)').toBe('FF0000');
  await openSwatch(page);
  expect((await tabs(page)).gradient.active, '피커가 Solid 로 열렸다(시드 없음) — 그라데이션 탭을 누르면 기본값이 사용자 값을 덮는다').toBe(true);
  await clickTab(page, 'gradient');   // 같은 탭 재클릭 = 값 불변
  expect((await state(page, 'gG')).dataBg, '열고 같은 탭을 눌렀을 뿐인데 값이 바뀌었다').toBe(GR);
  await page.keyboard.press('Escape');
  await typeField(page, '#sec-bg-alpha', '90');
  expect((await state(page, 'gG')).dataBg, '투명도를 치면 «첫 정지점 색»의 단색이다').toBe('rgba(255,0,0,0.9)');
  expect(errs).toEqual([]);
});

test('G3 Solid 탭 = 단색 복귀(그라데이션 잔존 0) · ⌘Z 로 그라데이션이 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.pushHistory?.());
  await selectSection(page, 'gG');
  await openSwatch(page);
  await clickTab(page, 'solid');
  await expect.poll(() => bgImg(page, 'gG')).toBe('none');
  const s = await state(page, 'gG');
  expect(s.dataBg, '정본이 첫 정지점 단색').toBe('#ff0000');
  expect(s.color).toBe('rgb(255, 0, 0)');
  await page.keyboard.press('Escape');
  await undo(page);
  await expect.poll(() => bgImg(page, 'gG'), { message: '⌘Z 로 그라데이션이 안 돌아왔다' }).toBe(GR_COMPUTED);
  expect(errs).toEqual([]);
});

test('G4 직렬화 왕복(저장→다시 열기 흉내)에도 그라데이션이 남는다', async ({ page }) => {
  const errs = await setup(page);
  const round = await page.evaluate(() => {
    const html = window.getSerializedCanvas();
    const c = document.getElementById('canvas');
    c.innerHTML = html; window.rebindAll?.();
    const s = document.getElementById('gG');
    return { hasAttr: /data-bg="linear-gradient/.test(html), dataBg: s?.dataset.bg ?? null, img: s ? getComputedStyle(s).backgroundImage : null };
  });
  expect(round.hasAttr, '전제: 직렬화본에 data-bg 그라데이션이 실렸다').toBe(true);
  expect(round.dataBg).toBe(GR);
  expect(round.img).toBe(GR_COMPUTED);
  // 다시 연 뒤에도 패널이 그라데이션으로 읽는다
  await selectSection(page, 'gG');
  expect((await state(page, 'gG')).swatch).toMatch(/^linear-gradient\(/);
  expect(errs).toEqual([]);
});

test('G4c 인라인이 빠지고 dataset 만 남은 섹션도 복원(rebindAll)이 다시 그린다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => { const s = document.getElementById('gG'); s.style.backgroundImage = ''; const none = getComputedStyle(s).backgroundImage; window.rebindAll?.(); return { none, img: getComputedStyle(s).backgroundImage }; });
  expect(r.none, '전제: 인라인을 걷으면 그라데이션이 사라진다').toBe('none');
  expect(r.img).toBe(GR_COMPUTED);
  expect(errs).toEqual([]);
});

test('G5 배경 그림과 같이 — 불투명 그라데이션은 그림에 양보하고, 그림을 지우면 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(([px, gr]) => {
    const s = document.getElementById('gA');
    s.dataset.bg = gr; s.dataset.bgImg = px; window.applySectionBg(s);
    const withImg = getComputedStyle(s).backgroundImage;
    delete s.dataset.bgImg; window.applySectionBg(s);
    return { withImg, back: getComputedStyle(s).backgroundImage, isG: window.isSectionGradient('linear-gradient(#fff, #000), url(a.png)') };
  }, [PX, GR]);
  expect(r.withImg, '불투명 그라데이션 + 그림 = 그림만').toMatch(/^url\(/);
  expect(r.withImg).not.toMatch(/gradient/);
  expect(r.back, '그림을 지우면 그라데이션이 돌아온다').toBe(GR_COMPUTED);
  expect(r.isG, 'url 이 낀 합성 값은 그라데이션 «값»이 아니다').toBe(false);
  expect(errs).toEqual([]);
});

test('G5b 반투명 정지점이 있는 그라데이션 + 그림 = 그라데이션이 그림 «위» 층(물들임)', async ({ page }) => {
  const errs = await setup(page);
  const img = await page.evaluate((px) => {
    const s = document.getElementById('gA');
    s.dataset.bg = 'linear-gradient(90deg, #ff0000 0%, rgba(0,0,255,0.500) 100%)'; s.dataset.bgImg = px; window.applySectionBg(s);
    return getComputedStyle(s).backgroundImage;
  }, PX);
  expect(img).toMatch(/^linear-gradient\(.*\), url\(/);
  expect(errs).toEqual([]);
});

test('G6 곁 결함 — 그라데이션 섹션의 패널: 스와치가 그라데이션이고 hex 가 쓰레기 값이 아니다', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gG');
  const s = await state(page, 'gG');
  expect(s.swatch, '스와치가 그라데이션이 아니다').toMatch(/^linear-gradient\(/);
  expect(s.hex, '바닥 판은 rgbToHex(그라데이션 문자열) = 5A0000 을 냈다').not.toBe('5A0000');
  expect(s.hex).toMatch(/^[0-9A-F]{6}$/);
  expect(s.alpha).toBe('100');
  expect(s.dataBg, '고르기만 해선 값 불변').toBe(GR);
  expect(errs).toEqual([]);
});

test('G7 곁 결함 — 그라데이션 섹션에서 투명도를 건드려도 ⌘Z 로 그라데이션이 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.pushHistory?.());
  await selectSection(page, 'gG');
  await typeField(page, '#sec-bg-alpha', '90');
  expect((await state(page, 'gG')).img, '전제: 투명도 입력 = 단색 전환(공용 배선 규약 — 프레임과 같다)').toBe('none');
  await undo(page);
  await expect.poll(() => bgImg(page, 'gG'), { message: '투명도를 건드렸더니 그라데이션을 영영 잃었다' }).toBe(GR_COMPUTED);
  expect(await page.evaluate(() => document.getElementById('gG').dataset.bg)).toBe(GR);
  expect(errs).toEqual([]);
});

test('G8 피커 팝업 안의 투명도가 섹션에 먹는다', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gA');
  await openSwatch(page);
  await page.locator('.goya-cp-popover .goya-cp-alpha-input').click();
  await page.keyboard.press('Meta+A'); await page.keyboard.type('40'); await page.keyboard.press('Tab'); await raf2(page);
  const s = await state(page, 'gA');
  expect(s.dataBg).toBe('rgba(255,255,255,0.4)');
  expect(s.alpha, '패널의 투명도 칸도 따라온다').toBe('40');
  expect(errs).toEqual([]);
});

test('G9 투명(알파 0) 섹션 — 색을 치면 보이게 올라오고, 투명도 0 을 직접 친 뒤엔 그대로 둔다', async ({ page }) => {
  const errs = await setup(page);
  await selectSection(page, 'gT');
  expect((await state(page, 'gT')).alpha, '전제: 투명 섹션').toBe('0');
  await typeField(page, '#sec-bg-hex', 'FF0000');
  expect((await state(page, 'gT')).dataBg, '고른 색이 안 보인다(알파 0 그대로)').toBe('#ff0000');
  await typeField(page, '#sec-bg-alpha', '0');
  await typeField(page, '#sec-bg-hex', '0000FF');
  expect((await state(page, 'gT')).dataBg, '사용자가 직접 친 투명도 0 을 덮었다').toBe('rgba(0,0,255,0)');
  expect(errs).toEqual([]);
});

test('G10 setSectionBg(외부 API) — 그라데이션을 받으면 그리고, 그라데이션 섹션에 단색을 주면 그라데이션을 걷는다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate((gr) => {
    const a = document.getElementById('gA'), g = document.getElementById('gG');
    window.setSectionBg(a, gr); window.setSectionBg(g, '#00ff00');
    const cs = (e) => ({ img: getComputedStyle(e).backgroundImage, color: getComputedStyle(e).backgroundColor, dataBg: e.dataset.bg });
    return { a: cs(a), g: cs(g) };
  }, GR);
  expect(r.a.img, '그라데이션을 줬는데 안 그려졌다').toBe(GR_COMPUTED);
  expect(r.g.img, '단색을 줬는데 옛 그라데이션이 그 위에 남았다').toBe('none');
  expect(r.g.color).toBe('rgb(0, 255, 0)');
  expect(errs).toEqual([]);
});
