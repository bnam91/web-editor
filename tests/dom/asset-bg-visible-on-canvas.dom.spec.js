/* asset-bg-visible-on-canvas.dom.spec.js — 현빈 2026-10-03 「에셋블럭 우측패널에 컬러 패널이 있는데 색을 골라도 안 바뀐다」.
 *
 * ★병 (실앱 9382 실측, 37ab1c65): 패널 배선은 «맞게» 돈다 — 블럭 인라인 background-color 가 고른 색이 된다.
 *   그런데 빈 에셋의 체커(css/editor-layout.css .asset-block — background 단축의 repeating-conic-gradient)가
 *   background-image 로 «그 위에» 남아, 화면 픽셀은 체커 회색(#d8d8d8/#f0f0f0) 그대로였다.
 *   (가설 ㉠. 블럭 중앙 elementsFromPoint 는 블럭 «하나»뿐 — 자식이 덮는 ㉡ 은 아니었다.)
 * ★옛 그물이 왜 못 잡았나: asset-image-bg-reach.dom.spec.js 는 editor-blocks.css 만 얹는다 —
 *   체커가 사는 editor-layout.css 가 그 하네스엔 «없어서» 거기선 늘 색이 보였다(한 환경에서만 참).
 *   ⇒ 이 시험은 앱 통째(bootApp = index.html 의 CSS 전부)로 «화면 픽셀»을 잰다.
 *
 * ★양성대조 판 = 37ab1c65 (GD1001_ROOT). 실측 명부는 커밋 메시지(빨강: AB1 AB2 AB3 · 초록: AB0 AB4 AB5).
 *   AB3 은 «초기화» 의 현재 규약(B4: dataset=#a0a0a0)을 «화면까지» 적은 것 — 핀에선 체커가 덮어 회색이 안 보여 빨강.
 * ⚠️못 재는 것: 실앱 Electron 의 색 관리(실앱 스샷은 #00ff00 → #71fb48 로 찍힌다) — 여기선 헤드리스 sRGB 로 잰다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

// 왼쪽 절반 불투명 파랑 · 오른쪽 절반 완전 투명 (2×1)
const HALF = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';
const SEC = (inner) => `
<div class="section-block" id="sA" data-section="1" data-name="A" data-bg="#ffffff" style="background-color:#ffffff;">
  <div class="section-hitzone"><span class="section-label">A</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" id="gA" style="height:40px;"></div>
    <div class="row" id="rowA">${inner}</div>
  </div></div>`;
const EMPTY = `<div class="asset-block" id="abA" style="height:300px;"></div>`;
const WITH_IMG = `<div class="asset-block has-image" id="abA" data-img-src="${HALF}" style="height:300px;">
  <div class="asset-img-clip"><img class="asset-img" src="${HALF}" style="width:100%;height:100%;object-fit:fill;image-rendering:pixelated"></div></div>`;

async function setup(page, inner = EMPTY) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await bootApp(page);
  await page.evaluate((html) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.(); }, SEC(inner));
  await page.waitForTimeout(200);
}

/** 화면에서 (x,y) 한 점의 «찍힌» 색 — 스크린샷을 페이지 캔버스로 되읽는다(디코더 없이). */
async function pixelAt(page, x, y) {
  const buf = await page.screenshot({ clip: { x: Math.round(x) - 1, y: Math.round(y) - 1, width: 3, height: 3 } });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, buf.toString('base64'));
}
const near = (a, b, tol = 6) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

/** 마우스를 블럭 밖으로 치운다 — hover 틴트(.asset-block:hover::after)가 픽셀에 섞이지 않게. */
const park = (page) => page.mouse.move(5, 500);

/** 블럭을 «진짜 클릭»으로 고르고, 우측 패널의 배경색 칸이 섰는지 전제로 확인한다. */
async function selectAndFindField(page) {
  const r = await waitStableRect(page, '#abA');
  await page.mouse.click(r.cx, r.cy);
  await page.waitForTimeout(300);
  const f = await page.evaluate(() => { const h = document.getElementById('asset-bg-hex'); const sw = document.getElementById('asset-bg-color')?.closest('.prop-color-swatch');
    if (!h || !sw) return null; h.scrollIntoView({ block: 'center' }); const a = h.getBoundingClientRect(), b = sw.getBoundingClientRect();
    return { hex: [a.left + a.width / 2, a.top + a.height / 2, a.width], sw: [b.left + b.width / 2, b.top + b.height / 2, b.width] }; });
  expect(f, '전제 — 우측 패널에 배경색 칸(asset-bg)이 있다').not.toBeNull();
  expect(f.hex[2], '전제 — hex 칸이 화면에 보인다').toBeGreaterThan(0);
  return { r, f };
}
async function typeHex(page, f, hex) {
  await page.mouse.click(f.hex[0], f.hex[1]);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(hex);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
}
const centre = async (page) => { const r = await waitStableRect(page, '#abA'); return [r.cx, r.cy]; };
const bgOf = (page) => page.evaluate(() => { const e = document.getElementById('abA'); const cs = getComputedStyle(e); return { ds: e.dataset.bgColor ?? null, bgc: cs.backgroundColor, bgi: cs.backgroundImage, has: e.classList.contains('has-image') }; });

test('AB0 전제·계측기 — 색을 안 고른 빈 에셋은 체커가 «화면에» 보인다(이 자가 체커를 본다)', async ({ page }) => {
  await setup(page);
  expect(await page.evaluate(() => !!document.getElementById('abA')), '전제 — 블럭이 있다').toBe(true);
  const b = await bgOf(page);
  expect(b.has, '전제 — 빈 에셋(이미지 없음)').toBe(false);
  expect(b.bgi, '빈 에셋은 체커').toContain('repeating-conic-gradient');
  await park(page);
  const [x, y] = await centre(page);
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [x, y]);
  expect(top, '전제 — 중앙의 맨 위가 블럭 자신').toBe('abA');
  const px = await pixelAt(page, x, y);
  expect(near(px, [0xd8, 0xd8, 0xd8]) || near(px, [0xf0, 0xf0, 0xf0]), `체커 회색이어야 — 찍힌 ${px}`).toBe(true);
});

test('AB1 ★hex 로 고른 색이 빈 에셋 «화면»에 칠해진다(체커가 덮지 않는다)', async ({ page }) => {
  await setup(page);
  const { f } = await selectAndFindField(page);
  await typeHex(page, f, 'FF0000');
  const b = await bgOf(page);
  expect(b.ds, '전제 — 패널이 색을 받았다(배선)').toBe('#ff0000');
  expect(b.bgc).toBe('rgb(255, 0, 0)');
  expect(b.bgi, '색이 있으면 체커를 걷는다').toBe('none');
  await park(page);
  const [x, y] = await centre(page);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [x, y]), '중앙 맨 위 = 블럭').toBe('abA');
  const px = await pixelAt(page, x, y);
  expect(near(px, [255, 0, 0]), `중앙 픽셀 = 고른 색 — 찍힌 ${px}`).toBe(true);
});

test('AB2 ★색 팝업의 스펙트럼을 «진짜 클릭»해 고른 색이 화면에 칠해진다', async ({ page }) => {
  await setup(page);
  const { f } = await selectAndFindField(page);
  await page.mouse.click(f.sw[0], f.sw[1]);
  await page.waitForTimeout(300);
  const sp = await page.evaluate(() => { const s = document.querySelector('.goya-cp-popover .goya-cp-spectrum'); if (!s) return null; const r = s.getBoundingClientRect(); return [r.right - 4, r.top + 4, r.width]; });
  expect(sp, '전제 — 색 팝업의 스펙트럼이 떴다').not.toBeNull();
  expect(sp[2]).toBeGreaterThan(0);
  await page.mouse.click(sp[0], sp[1]);
  await page.waitForTimeout(250);
  const picked = await page.evaluate(() => document.getElementById('asset-bg-color').value);
  expect(picked, '전제 — 스펙트럼이 색을 냈다(회색 기본값 아님)').not.toBe('#a0a0a0');
  await page.evaluate(() => document.querySelector('.goya-cp-popover [data-action=close]')?.click());
  const want = [1, 3, 5].map(i => parseInt(picked.slice(i, i + 2), 16));
  const b = await bgOf(page);
  expect(b.bgi).toBe('none');
  await park(page);
  const [x, y] = await centre(page);
  const px = await pixelAt(page, x, y);
  expect(near(px, want), `중앙 픽셀 = 고른 ${picked} — 찍힌 ${px}`).toBe(true);
});

test('AB3 「초기화」의 현재 규약을 «화면까지» 적는다 — dataset=#a0a0a0(B4 규약) ⇒ 이제 회색 판이 보인다(체커 아님 · ❓결정 대기)', async ({ page }) => {
  /* ❓지디/현빈 결정 대기 (2026-10-03 A1): 「초기화」는 setHex('#a0a0a0') 로 기본 회색을 «다시 쓴다» —
     asset-bg-api-reset B4 가 「현재 규약 고정」으로 잠근 약속이다(그 하네스엔 editor-layout.css 가 없어 회색이 «보인다»고 믿었다).
     핀에선 체커가 그 회색을 덮어 사용자 눈엔 «체커로 돌아왔다». 이 수정(색이 있으면 체커를 걷는다) 뒤엔 회색 판이 보인다.
     ⛔여기서 체커를 기대하도록 바꾸지 마라 — 그건 B4 규약을 뒤집는 결정이라 이 레인 소관이 아니다.
     규약이 「초기화 = 빈 값(체커)」로 바뀌면 이 시험의 기대(#a0a0a0 · 회색)를 체커로 뒤집고 B4 도 같이 고친다. */
  await setup(page);
  const { f } = await selectAndFindField(page);
  await typeHex(page, f, '00AA00');
  const c = await page.evaluate(() => { const b = document.getElementById('asset-bg-clear'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(c[0], c[1]);
  await page.waitForTimeout(200);
  const b = await bgOf(page);
  expect(b.ds, '전제 — 초기화가 고른 색을 걷었다(B4 규약 = 기본 회색)').toBe('#a0a0a0');
  await park(page);
  const [x, y] = await centre(page);
  const px = await pixelAt(page, x, y);
  expect(near(px, [0xa0, 0xa0, 0xa0]), `현재 규약의 화면 = 회색 #a0a0a0 — 찍힌 ${px}`).toBe(true);
});

test('AB4 불투명도 0(보이는 색 없음)이면 체커를 그대로 둔다 — 빈 칸이 «투명하게 사라지지» 않는다', async ({ page }) => {
  await setup(page);
  const { f } = await selectAndFindField(page);
  await typeHex(page, f, 'FF0000');
  const a = await page.evaluate(() => { const e = document.getElementById('asset-bg-alpha'); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(a[0], a[1]);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('0');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const b = await bgOf(page);
  expect(b.ds, '전제 — 알파 0 이 실렸다').toMatch(/,0\)$/);
  expect(b.bgi).toContain('repeating-conic-gradient');
});

test('AB5 이미지가 있으면 배경색은 그림의 투명한 곳으로 비친다(이미 되던 것 — 지키기)', async ({ page }) => {
  await setup(page, WITH_IMG);
  const { f } = await selectAndFindField(page);
  await typeHex(page, f, '00FF00');
  await park(page);
  const r = await waitStableRect(page, '#abA');
  const left = await pixelAt(page, r.left + r.width * 0.25, r.cy);
  const right = await pixelAt(page, r.left + r.width * 0.75, r.cy);
  expect(near(left, [0, 0, 255], 20), `왼쪽 = 그림(파랑) — 찍힌 ${left}`).toBe(true);
  expect(near(right, [0, 255, 0]), `오른쪽 = 비친 배경색 — 찍힌 ${right}`).toBe(true);
});
