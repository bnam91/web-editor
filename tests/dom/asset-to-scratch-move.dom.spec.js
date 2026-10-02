/* asset-to-scratch-move.dom.spec.js — C1 (현빈 2026-10-01) 에셋을 끌어 «섹션 밖»에 놓으면 스크래치패드로 «이동»(효과 유지).
 * 앱 통째로 헤드리스(bootApp) — 진짜 마우스로 HTML5 드래그, 진짜 마우스로 스크래치 항목을 다시 섹션에 끌어 넣는다.
 * ★양성대조 판 = 7699ea33 → 빨강이어야 할 것: M1 M2 M3. M5(섹션 안 끌기·우클릭 복사는 그대로)는 지키는 시험.
 *   ⚠️미측정(DOM): «스크래치 → 캔버스 넣기» 를 ⌘Z 로 되살린 항목이 fx 를 지니는가 — 그 되돌리기 자체가 이 하네스에서
 *     일관되지 않았다(이동 기능 없이도: 넣은 뒤 항목이 남고 ⌘Z 가 넣은 에셋을 안 지움 — 기존 동작, 별건). 코드는 고쳤다
 *     (restoreInfo 를 _pickScratch 로 — fx 포함), 그 «목록 파생»은 단위 K2 가 잰다. 태양 · 2026-10-01.
 *   저장 칸이 fx 를 담는지는 단위 시험 tests/unit/scratch-item-keys.test.mjs 가 잰다(이 하네스는 프로젝트 미로드라 저장 키가 없다).
 * ⚠️이 하네스 밖: 스크래치 IndexedDB 의 재기동 뒤 영속(프로젝트 미로드라 저장 키가 없다) — 미측정 · 태양 · 2026-10-01.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SEC = `
<div class="section-block" id="sM" data-section="1" data-name="M" data-bg="#ffffff" style="background-color:#ffffff;">
  <div class="section-hitzone"><span class="section-label">M</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" id="gM1" style="height:40px;"></div>
    <div class="row" id="rowFx"><div class="asset-block has-image" id="abFx" data-img-src="${PX}" data-fit="contain" data-img-x="12" data-img-y="-8" data-img-w="140" data-img-position="10% 20%" data-img-rotate="90" data-overlay="true" data-rotation="15"
         style="height:220px;border-radius:24px;transform:rotate(15deg);">
      <div class="asset-img-clip"><img class="asset-img" src="${PX}" draggable="false" data-adj-exposure="20" data-adj-saturation="-30" style="object-fit:contain;object-position:10% 20%;width:140%;"></div>
      <button class="asset-overlay-clear" title="이미지 제거">✕</button>
      <div class="asset-overlay" style="background:rgba(0,0,0,0.4);"><span class="ov-note">오버레이 글자</span></div>
      <div class="asset-grain" data-grain-intensity="35" style="opacity:0.35;"></div>
    </div></div>
    <div class="gap-block" data-type="gap" id="gM2" style="height:300px;"></div>
  </div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate((html) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); document.getElementById('sM').scrollIntoView({ block: 'start' }); }, SEC);
  await page.waitForTimeout(300);
}
const fxOf = (page, id) => page.evaluate((id) => { const ab = document.getElementById(id) || document.querySelector(id); return ab ? window.captureAssetFx(ab) : null; }, id);
/* 섹션 밖 바닥 한 점 — 캔버스 왼쪽 회색 */
const floorPt = (page) => page.evaluate(() => { const w = document.getElementById('canvas-wrap').getBoundingClientRect(); const s = document.getElementById('sM').getBoundingClientRect(); return [Math.round((w.left + s.left) / 2), Math.round(s.top + 120)]; });
async function dragAssetOut(page) {
  const [x0, y0] = await page.evaluate(() => { const r = document.getElementById('abFx').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const [x1, y1] = await floorPt(page);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12);
  await page.mouse.up();
  await page.waitForTimeout(200);
}
/* 스크래치의 마지막 항목을 진짜 마우스로 섹션에 끌어 넣고, 새로 생긴 에셋의 효과를 돌려준다.
   스크래치 → 캔버스 넣기는 «같은 자리 위 잠깐 머묾»(canvas-scratch-drop.js ARM_DELAY_MS)이 있어야 들어간다 — 스치기 오드롭 방지 */
async function reinsertLastScratch(page) {
  // 항목은 «왼쪽 위 모서리 근처»를 잡는다 — 가운데는 섹션과 겹칠 수 있다(겹치면 섹션이 눌린다)
  const item = await page.evaluate(() => { const els = [...document.querySelectorAll('.scratch-item')]; const el = els[els.length - 1]; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return [r.left + 14, r.top + 14]; });
  const tgt = await page.evaluate(() => { const r = document.getElementById('gM2').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(item[0], item[1]); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(item[0] + (tgt[0] - item[0]) * i / 12, item[1] + (tgt[1] - item[1]) * i / 12);
  await page.waitForTimeout(700);
  await page.mouse.move(tgt[0] + 2, tgt[1] + 2);
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(300);
  return page.evaluate(() => { const abs = [...document.querySelectorAll('#sM .asset-block')]; return abs.length ? window.captureAssetFx(abs[abs.length - 1]) : null; });
}
const scratchItems = (page) => page.evaluate(() => [...document.querySelectorAll('.scratch-item')].length);

test('M1 ★에셋을 섹션 밖에 놓으면 «이동» — 블럭은 빠지고 스크래치 항목이 하나 생긴다(빈 row 도 안 남는다)', async ({ page }) => {
  await setup(page);
  const before = await scratchItems(page);
  await dragAssetOut(page);
  const r = await page.evaluate(() => ({ ab: !!document.getElementById('abFx'), row: !!document.getElementById('rowFx') }));
  expect(await scratchItems(page)).toBe(before + 1);
  expect(r).toEqual({ ab: false, row: false });
});

test('M2 ★효과가 같이 간다 — 다시 섹션에 끌어 넣으면 크롭·맞춤·회전·모서리·오버레이·그레인·색보정이 그대로', async ({ page }) => {
  await setup(page);
  const fx0 = await fxOf(page, 'abFx');
  await dragAssetOut(page);
  const back = await reinsertLastScratch(page);
  expect(back, '다시 넣은 에셋').not.toBeNull();
  expect(back.ds).toEqual(fx0.ds);
  expect(back.radius).toBe(fx0.radius);
  expect(back.img.ds).toEqual(fx0.img.ds);
  expect(back.img.style).toBe(fx0.img.style);
  expect(back.overlay).toEqual(fx0.overlay);
  expect(back.grain).toEqual(fx0.grain);
  expect(await page.evaluate(() => { const abs = [...document.querySelectorAll('#sM .asset-block')]; return getComputedStyle(abs[abs.length - 1].querySelector('.asset-img')).filter; }), '색보정 필터가 다시 걸렸다').toContain('url(');
});

test('M3 ⌘Z 한 번 = 이동 한 번 — 블럭이 돌아오고 스크래치 항목은 사라진다', async ({ page }) => {
  await setup(page);
  const before = await scratchItems(page);
  await dragAssetOut(page);
  expect(await scratchItems(page), '전제 — 옮겨졌다').toBe(before + 1);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => !!document.getElementById('abFx'))).toBe(true);
  expect(await scratchItems(page)).toBe(before);
});

test('M5 지키는 시험 — 섹션 «안»으로 끄는 건 스크래치로 안 간다 · 우클릭 「스크래치로 보내기」는 여전히 복사', async ({ page }) => {
  await setup(page);
  const before = await scratchItems(page);
  const [x0, y0] = await page.evaluate(() => { const r = document.getElementById('abFx').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const [x1, y1] = await page.evaluate(() => { const r = document.getElementById('gM2').getBoundingClientRect(); return [r.left + r.width / 2, r.top + 40]; });
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10);
  await page.mouse.up(); await page.waitForTimeout(200);
  expect(await scratchItems(page)).toBe(before);
  expect(await page.evaluate(() => !!document.getElementById('abFx'))).toBe(true);
  // 우클릭 「스크래치로 보내기」 — 복사(블럭이 남는다)
  const [rx, ry] = await page.evaluate(() => { const r = document.getElementById('abFx').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(rx, ry, { button: 'right' });
  const it = await page.evaluate(() => { const el = document.getElementById('bcm-send-to-scratch'); const r = el.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; });
  await page.mouse.click(it[0], it[1]);
  await page.waitForTimeout(300);
  expect(await scratchItems(page)).toBe(before + 1);
  expect(await page.evaluate(() => !!document.getElementById('abFx')), '복사 — 블럭은 남는다').toBe(true);
});

