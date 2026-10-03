/* icon-overlay.dom.spec.js — 현빈 요청 「아이콘 블럭도 오버레이(플로팅)」(B1, 선례 grid-overlay d9c3525e · prop-shape).
 * 공용 js/overlay-float.js 그대로 — 아이콘은 posElOf 가 «자기 자신». 패널 prop-iconify.js 에 토글(#icn-float-toggle)·X/Y(#icn-x/y-number).
 * 측정(코드 수정 전, 36cbe872): 패널에 토글 없음 / window.OverlayFloat.enterFloat(block) 직접은 아이콘에 맞는다(M0).
 * ★대조 I0(같은 판): 안 띄운 아이콘의 정렬 버튼은 margin auto — 떠 있을 때 정렬이 margin 을 덮지 못하게 한 가드(I3)가 «이 줄을» 잰다.
 * ★양성대조: GD1001_ROOT=<36cbe872 체크아웃> → I1~I4 는 버튼 없음으로 «전제에서 지는» 약한 빨강, I0·M0 은 초록. 변이 둘은 커밋 본문. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SVG = '<svg viewBox="0 0 24 24"><rect x="0" y="0" width="24" height="24" fill="currentColor"/></svg>';

async function setup(page, { rotation = 0, color = '#ff0000' } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(({ svg, rot, color }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="iS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="iR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    const { block } = window.makeIconifyBlock('mdi:star', svg, 80);
    block.id = 'iI'; block.dataset.iconColor = color; block.style.color = color;
    if (rot) { block.dataset.rotation = String(rot); block.style.transform = `rotate(${rot}deg)`; }
    document.getElementById('iR').appendChild(block); window.rebindAll?.();
    window.deselectAll?.(); document.getElementById('iS').scrollIntoView({ block: 'start' });
  }, { svg: SVG, rot: rotation, color });
  await page.waitForTimeout(250);
}
/* 섹션 기준 자리(모델 px — 배율 무관). 회전 땐 AABB 좌상단(눈에 보이는 자리). */
const geo = (page) => page.evaluate(() => { const sec = document.getElementById('iS'), g = document.getElementById('iI');
  const s = sec.getBoundingClientRect(), b = g.getBoundingClientRect(), k = s.width / sec.offsetWidth;
  return { x: Math.round((b.left - s.left) / k), y: Math.round((b.top - s.top) / k), float: g.dataset.overlayBlock === 'true',
           parent: g.parentElement.id || g.parentElement.className, ml: g.style.marginLeft, mr: g.style.marginRight, ox: g.dataset.offsetX, oy: g.dataset.offsetY }; });
async function openPanel(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('iI').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(x, y); await page.waitForTimeout(250);
}
const toggle = async (page) => { await page.click('#icn-float-toggle'); await page.waitForTimeout(250); };
const panelRows = (page) => page.evaluate(() => document.querySelectorAll('#panel-right .prop-row').length);

test('M0 측정 — 공용 모듈 enterFloat 은 아이콘에 «그대로 맞는다»(패널 배선만 없던 것)', async ({ page }) => {
  await setup(page);
  const g0 = await geo(page);
  await page.evaluate(() => window.OverlayFloat.enterFloat(document.getElementById('iI')));
  const g1 = await geo(page);
  expect(g1.float).toBe(true);
  expect(Math.abs(g1.x - g0.x) + Math.abs(g1.y - g0.y), '모듈 직접 호출 — 자리 점프 없음').toBeLessThanOrEqual(1);
});
test('I0 대조 — 안 띄운 아이콘은 정렬 «가운데» 를 누르면 margin auto', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  await page.click('#icn-align-group [data-align="center"]');
  const g = await geo(page);
  expect({ ml: g.ml, mr: g.mr }).toEqual({ ml: 'auto', mr: 'auto' });
});
test('I1 ★패널 토글 → 섹션 위에 뜬다(자리 그대로 |Δ|≤1) · 다시 누르면 원래 .row 로', async ({ page }) => {
  await setup(page);
  const g0 = await geo(page);
  await openPanel(page);
  expect(await page.isVisible('#icn-float-toggle'), '아이콘 패널에 오버레이 버튼').toBe(true);
  await toggle(page);
  const g1 = await geo(page);
  expect(g1.float).toBe(true);
  expect(Math.abs(g1.x - g0.x) + Math.abs(g1.y - g0.y)).toBeLessThanOrEqual(1);
  await toggle(page);
  const g2 = await geo(page);
  expect({ float: g2.float, parent: g2.parent }).toEqual({ float: false, parent: 'iR' });
  expect(Math.abs(g2.x - g0.x) + Math.abs(g2.y - g0.y)).toBeLessThanOrEqual(1);
});
test('I1b 패널 줄 순증 0(토글은 Size 절 제목에 붙는다) · 떠 있으면 정렬 줄 대신 X/Y 줄', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  expect(await page.isVisible('#icn-float-toggle'), '전제 — 토글이 있다').toBe(true);
  const n0 = await panelRows(page);
  await toggle(page);
  const n1 = await panelRows(page);
  expect(n1 - n0, '토글 전후 .prop-row 수(정렬 줄 -1 숨김 아님·DOM엔 남음 + X/Y 줄 +1 → +1 까지 허용 아님: 숨긴 줄은 DOM 에 남는다)').toBeLessThanOrEqual(1);
  expect(await page.isVisible('#icn-x-number')).toBe(true);
});
test('I2 ★45° 회전한 아이콘도 띄울 때 점프 없음', async ({ page }) => {
  await setup(page, { rotation: 45 });
  const g0 = await geo(page);
  await openPanel(page); await toggle(page);
  const g1 = await geo(page);
  expect(g1.float).toBe(true);
  expect(Math.abs(g1.x - g0.x) + Math.abs(g1.y - g0.y)).toBeLessThanOrEqual(1);
});
test('I3 ★떠 있는 채 패널을 다시 열어도 margin 이 auto 로 덮이지 않는다 · 정렬 줄은 숨는다', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  await page.click('#icn-align-group [data-align="center"]');   // dataset.align 을 심는다(→ 패널 열 때 applyAlign 이 불린다)
  await toggle(page);
  const g0 = await geo(page);
  expect(g0.float).toBe(true);
  await page.evaluate(() => { window.deselectAll?.(); }); await openPanel(page);
  const g1 = await geo(page);
  expect(g1.ml, '재오픈 뒤 marginLeft').not.toBe('auto');
  expect(g1.mr, '재오픈 뒤 marginRight').not.toBe('auto');
  expect(Math.abs(g1.x - g0.x) + Math.abs(g1.y - g0.y), '재오픈이 자리를 안 옮긴다').toBeLessThanOrEqual(1);
  expect(await page.isVisible('#icn-align-group'), '떠 있으면 정렬 줄 숨김').toBe(false);
});
test('I4 ★끌면 움직이고 #icn-x-number 가 따라간다', async ({ page }) => {
  await setup(page);
  await openPanel(page); await toggle(page);
  const g0 = await geo(page);
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('iI').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 6, y + i * 5);
  await page.mouse.up(); await page.waitForTimeout(150);
  const g1 = await geo(page);
  expect(g1.x - g0.x).toBeGreaterThan(20); expect(g1.y - g0.y).toBeGreaterThan(20);
  expect(await page.inputValue('#icn-x-number'), '패널 X 칸').toBe(g1.ox);
  expect(await page.inputValue('#icn-y-number'), '패널 Y 칸').toBe(g1.oy);
});
test('I5 ★저장·다시 열기 뒤에도 떠 있고 자리 그대로, 끌린다', async ({ page }) => {
  await setup(page);
  await openPanel(page); await toggle(page);
  const g0 = await geo(page);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('iS').scrollIntoView({ block: 'start' }));
  const g1 = await geo(page);
  expect({ float: g1.float, x: g1.x, y: g1.y }).toEqual({ float: true, x: g0.x, y: g0.y });
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('iI').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 6, y + i * 5);
  await page.mouse.up(); await page.waitForTimeout(150);
  expect((await geo(page)).x - g1.x).toBeGreaterThan(20);
});
test('I6 ★PNG 내보내기 — 띄운 아이콘이 모델 좌표(offsetX/Y) 자리에 찍힌다', async ({ page }) => {
  await setup(page);
  await openPanel(page); await toggle(page);
  await page.fill('#icn-x-number', '300'); await page.press('#icn-x-number', 'Enter');
  await page.fill('#icn-y-number', '200'); await page.press('#icn-y-number', 'Enter');
  await page.waitForTimeout(200);
  const m = await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const sec = document.getElementById('iS'), g = document.getElementById('iI');
    document.getElementById('__iclone')?.remove();
    const clone = await ex.prepareCloneForCapture(sec, 860, true);
    ex.renderComponentsInClone?.(clone);
    clone.id = '__iclone'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
    return { ox: +g.dataset.offsetX, oy: +g.dataset.offsetY };
  });
  const shot = await page.locator('#__iclone').screenshot({ type: 'png' });
  const bb = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = 1e9, y0 = 1e9, n = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4;
      if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60) { n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); } }
    return { x0, y0, n, w: img.width };
  }, shot.toString('base64'));
  expect(m.ox, '전제 — 패널 X 칸이 모델에 닿았다').toBe(300);
  expect(bb.n, '전제 — 내보낸 그림에 빨간 아이콘이 있다').toBeGreaterThan(1000);
  const k = bb.w / 860;
  expect(Math.abs(bb.x0 / k - m.ox), `PNG 좌측 ${bb.x0 / k} vs 모델 ${m.ox}`).toBeLessThanOrEqual(2);
  expect(Math.abs(bb.y0 / k - m.oy), `PNG 상단 ${bb.y0 / k} vs 모델 ${m.oy}`).toBeLessThanOrEqual(2);
});
test('I7 ★토글 = ⌘Z 한 걸음(되돌리면 원래 .row 로)', async ({ page }) => {
  await setup(page);
  const g0 = await geo(page);
  await openPanel(page); await toggle(page);
  expect((await geo(page)).float).toBe(true);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  const g1 = await geo(page);
  expect({ float: g1.float, parent: g1.parent }).toEqual({ float: false, parent: 'iR' });
  expect(Math.abs(g1.x - g0.x) + Math.abs(g1.y - g0.y)).toBeLessThanOrEqual(1);
});
