/* grid-img-circle.dom.spec.js — 현빈 2026-10-01 「그리드블럭 우클릭으로 이미지 블럭 넣잖아 — 원형도. 지금은 사각형인데 정원도 필요」
 *   (해석 ⑴ 그리드 «칸 안» 이미지 줄 — 지디가 현빈께 확인 2026-10-01)
 * 줄 필드 imgShape:'circle' — 지름 = height(px, 기본 GRID_IMG_CIRCLE_D 120) · aspect-ratio 1/1 · border-radius 50%.
 * 앱 통째(bootApp) · 우클릭 메뉴·패널 단추는 진짜 마우스.
 * ★대조(같은 판, 조건만 바꿈): C0 — imgShape «없는» 같은 줄은 사각(폭≠높이·반경 0). 계측기가 원/사각을 가른다.
 * ★양성대조 판 7699ea33: C1~C5 빨강은 «메뉴·필드가 없어서» 지는 약한 빨강. C0 초록(지키는 시험 — 사각 산출 무변화).
 * 미측정 · 태양 · 2026-10-01: 원형 줄에서 캔버스 «코너 핸들»로 크기 바꾸기 · 원 안 크롭(이번 범위 밖 — 원에선 안 읽음으로 돌려준다). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
/* ★⑵(10-06 · E157 ⒜) — 2×1 그림. E157 뒤 크롭 없는 사각 줄은 «높이 = 폭 × 그림 비율»이라 1×1(PX)이면 정사각이 되어
   «원이 아닌 사각» 을 «폭≠높이» 로 가를 수 없다(실측 7b017a98 C0: 418×120 → 418×418). 그래서 사각 쪽 장면만 2:1 로 바꾼다. */
const PX2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGNQSjujlHYGAAf/AqmCyMKsAAAAAElFTkSuQmCC';

async function setup(page, { colW = [1, 1], lines = [{ type: 'body', text: 'A' }] } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(([colW, lines]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: colW.map(w => ({ width: w, lines })), rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, [colW, lines]);
  await page.waitForTimeout(200);
}
/* 0행 0열 칸의 그림 프레임 꼴 — 모델 px(배율 무관) */
const frame = (page, nth = 0) => page.evaluate((nth) => {
  const f = document.querySelectorAll('#gG .grd-cell[data-r="0"][data-c="0"] .grd-img-frame')[nth]; if (!f) return null;
  const cs = getComputedStyle(f);
  return { w: Math.round(f.offsetWidth), h: Math.round(f.offsetHeight), radius: cs.borderTopLeftRadius, empty: f.classList.contains('grd-img-empty'),
           fit: f.querySelector('img') ? getComputedStyle(f.querySelector('img')).objectFit : null };
}, nth);

async function rclickCellItem(page, itemId) {
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y, { button: 'right' });
  const it = await page.evaluate((id) => { const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); return { vis: getComputedStyle(el).display, xy: [r.left + 20, r.top + r.height / 2] }; }, itemId);
  return it;
}

test('C0 대조 — imgShape 없는 이미지 줄(height 120)은 사각: 폭≠높이 · 반경 0', async ({ page }) => {
  /* ★⑵ 장면 바꿈(10-06 · E157 ⒜) — 옛 장면이 잠근 것(한 줄): «imgShape 없는 줄은 원으로 안 바뀐다(정원 강제 없음 · 반경 0)».
     옛 장면(1×1 · height 120)은 E157 전 cover 로 418×120 이었고, 지금은 비율로 418×418 이라 «폭≠높이» 가 못 선다.
     새 장면(2×1)이 같은 것을 잠그는지: 폭≠높이 · 반경 0 · 높이 = 폭 × ½(그림 비율 — 원이면 폭=높이로 강제됐을 것). 옛 단언 «h = 120» 은 E157 규칙이 이긴다(지운 단언 1 · 이름: f.h toBe 120). */
  await setup(page, { lines: [{ type: 'image', imgSrc: PX2, height: 120 }] });
  /* [전제] 장면의 그림이 정말 2:1 이다(픽스처가 1:1 로 돌아가면 «폭≠높이»가 아무것도 못 잰다 — 지디 ③) */
  expect(await page.evaluate(() => { const i = document.querySelector('#gG .grd-img-frame img'); return i ? [i.naturalWidth, i.naturalHeight] : null; }), '[전제] 2:1 그림').toEqual([2, 1]);
  const f = await frame(page);
  expect(f.w).toBeGreaterThan(f.h);
  expect(Math.abs(f.h - f.w / 2), `높이 = 폭 × ½(E157 비율) ${JSON.stringify(f)}`).toBeLessThanOrEqual(1);
  expect(f.radius).toBe('0px');
});
test('C1 ★칸 우클릭 「원형 이미지 추가」 → 빈 원 슬롯(지름 120 · 정원 · 반경 50%)', async ({ page }) => {
  await setup(page);
  const it = await rclickCellItem(page, 'bcm-grid-img-circle');
  expect(it?.vis, '그리드 칸 우클릭 메뉴에 「원형 이미지 추가」').toBe('flex');
  await page.mouse.click(it.xy[0], it.xy[1]); await page.waitForTimeout(200);
  const f = await frame(page);
  expect(f).toMatchObject({ w: 120, h: 120, radius: '50%', empty: true });
});
test('C2 ★그림이 든 원 — 정원 안에 cover 로 채운다', async ({ page }) => {
  await setup(page, { lines: [{ type: 'image', imgSrc: PX, imgShape: 'circle', height: 90 }] });
  expect(await frame(page)).toMatchObject({ w: 90, h: 90, radius: '50%', empty: false, fit: 'cover' });
});
test('C3 ★칸이 지름보다 좁아도 «정원» — 칸 폭으로 줄되 폭=높이', async ({ page }) => {
  await setup(page, { colW: [1, 20], lines: [{ type: 'image', imgSrc: PX, imgShape: 'circle', height: 300 }] });
  const f = await frame(page);
  expect(f.w).toBeLessThan(300);                // 칸이 좁아 줄었다(전제)
  expect(Math.abs(f.w - f.h)).toBeLessThanOrEqual(1);
});
test('C4 ★이미지 줄 위 우클릭 «사각으로 바꾸기» → 사각 · ⌘Z 로 원 · 다시 우클릭 «원형으로 바꾸기» · 원일 땐 패널 폭(%)·반경 칸이 숨고 높이는 «지름»', async ({ page }) => {
  /* ★⑵ 장면 바꿈(10-06 · E157 ⒜) — 옛 장면이 잠근 것: «사각으로 바꾸면 원이 풀린다(반경 0 · 폭>높이)». 1×1 이면 E157 뒤 사각이 정사각(폭=높이)이라 못 가른다 → 2×1. 원 쪽 단언(100×100 · 50%)은 그대로. */
  await setup(page, { lines: [{ type: 'image', imgSrc: PX2, imgShape: 'circle', height: 100 }] });
  expect(await page.evaluate(() => { const i = document.querySelector('#gG .grd-img-frame img'); return i ? [i.naturalWidth, i.naturalHeight] : null; }), '[전제] 2:1 그림(C4c)').toEqual([2, 1]);
  const [x, y] = await page.evaluate(() => { const r = document.querySelector('#gG .grd-img-frame').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  /* 패널 — 캔버스에서 그 줄을 고른다(첫 클릭 = 블럭, 두 번째 = 그 칸의 줄). ⛔패널엔 모양 단추가 «없다»(grid-img-crop P1 · 현빈 2026-09-25) */
  await page.mouse.click(x, y); await page.waitForTimeout(200);
  await page.mouse.click(x, y); await page.waitForTimeout(250);
  const p0 = await page.evaluate(() => ({ wpVis: document.getElementById('grd-img-width-pct')?.closest('.prop-row').style.display,
    radVis: document.getElementById('grd-img-radius')?.closest('.prop-row').style.display,
    hLabel: document.getElementById('grd-img-height')?.closest('.prop-row').querySelector('.prop-label').textContent }));
  expect(p0).toEqual({ wpVis: 'none', radVis: 'none', hLabel: '지름(px)' });
  const menu = async () => { await page.mouse.click(x, y, { button: 'right' }); return page.evaluate(() => { const el = document.getElementById('bcm-grid-img-circle'); const r = el.getBoundingClientRect();
    return { vis: getComputedStyle(el).display, label: el.textContent.trim(), xy: [r.left + 20, r.top + r.height / 2] }; }); };
  let m = await menu();
  expect(m).toMatchObject({ vis: 'flex', label: '사각으로 바꾸기' });
  await page.mouse.click(m.xy[0], m.xy[1]); await page.waitForTimeout(200);
  let f = await frame(page);
  expect(f.radius).toBe('0px'); expect(f.w).toBeGreaterThan(f.h);
  expect(await page.evaluate(() => Object.keys(JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[0])), '사각으로 = 0열 그 줄에서 키가 «빠진다»(null 이 남지 않는다)').not.toContain('imgShape');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  expect(await frame(page)).toMatchObject({ w: 100, h: 100, radius: '50%' });
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250);
  m = await menu();
  expect(m.label).toBe('원형으로 바꾸기');
  await page.mouse.click(m.xy[0], m.xy[1]); await page.waitForTimeout(200);
  expect(await frame(page)).toMatchObject({ w: 100, h: 100, radius: '50%' });
});
test('C5 ★저장·다시 열기 뒤에도 원(imgShape 가 저장본에 실린다)', async ({ page }) => {
  await setup(page, { lines: [{ type: 'image', imgSrc: PX, imgShape: 'circle', height: 80 }] });
  const snap = await page.evaluate(() => window.serializeProject());
  expect(snap).toContain('imgShape');
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(300);
  expect(await frame(page)).toMatchObject({ w: 80, h: 80, radius: '50%' });
});
