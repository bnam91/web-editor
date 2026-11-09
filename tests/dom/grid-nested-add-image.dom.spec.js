/* grid-nested-add-image.dom.spec.js — 1109t1A2 (현빈 「나란히 두칸으로 나누기 후에 추가된 줄에 이미지 원형이미지나, 이미지 추가가
 *   가능하게 해줄것 마찬가지 우측패널로 추가될 수 있게」).
 * ★병: 중첩 열 안 줄에서 우클릭 「이미지 추가」가 «바깥 칸»(duo 줄 다음)에 넣었다(_gridCellAddrAt 이 closest('[data-line]')
 *   로 품은 duo 줄을 집음) · 패널엔 추가 손잡이가 없었다 · 빈 슬롯 더블클릭이 [data-line] 만 받았다.
 *   N1 우클릭 이미지 추가 → 그 열에 빈 사진(대조: 바깥 줄은 바깥 칸) · N2 원형 · N3 패널 select(중첩 종류 없음)
 *   N4 빈 슬롯 더블클릭 + 파일 → IMG · N5 ⌘Z 한 번 = 직전 모델 · N6 저장 왕복 + HTML 내보내기
 * 실행: tests/dom/playwright.dom.config.js grid-nested-add-image */
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const COND_MS = 15000;
const frames2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
async function clickAt(page, sel, opts) { const r = await waitStableRect(page, sel); await page.mouse.click(r.cx, r.cy, opts); await frames2(page); return r; }

/** 8×8 빨강 PNG — 진짜 파일로 쓴다(setInputFiles 는 디스크 파일을 받는다). */
function pngFile() {
  const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(8, 0); ihdr.writeUInt32BE(8, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.concat(Array.from({ length: 8 }, () => Buffer.concat([Buffer.from([0]), Buffer.from(Array(8).fill([255, 0, 0]).flat())])));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  const f = path.join(test.info().outputDir, 'n4.png');
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, png);
  return f;
}

/** 섹션 + Grid + 줄 우클릭 + 진짜 「나란히 두 칸」 ⇒ 칸(0,0) = [body, duo] (grid-nested-outer-select 와 같은 세움) */
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await expect.poll(() => page.evaluate(() => !!window.getSelectedSection?.())).toBe(true);
  await page.evaluate(() => window.applyZoom?.(100));
  await page.waitForFunction(() => {
    const S = document.getElementById('canvas-scaler');
    if (!S || S.getAnimations().length) return false;
    const m = /^matrix\(([^,]+),/.exec(getComputedStyle(S).transform);
    return !!m && Math.abs(Number(m[1]) - 1) < 1e-3;
  }, null, { timeout: COND_MS });
  await page.click('#fp-grid-btn');
  await page.waitForFunction(() => !!document.querySelector('#canvas .grid-block'), null, { timeout: COND_MS });
  const id = await page.evaluate(() => {
    const b = document.querySelector('#canvas .grid-block');
    b.scrollIntoView({ block: 'center' });
    window.deselectAll?.(); document.activeElement?.blur?.();
    return b.id;
  });
  const l0 = `#${id} .grd-cell[data-r="0"][data-c="0"] [data-line="0"]`;
  await clickAt(page, l0); await clickAt(page, l0);
  await clickAt(page, l0, { button: 'right' });
  await clickAt(page, '#bcm-grid-nested');
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .grd-nested[data-line] [data-npath="1.0"]`), id, { timeout: COND_MS });
  const m = await model(page, id);
  expect(m.map(l => l.type), '[전제] 칸(0,0) = [body, duo]').toEqual(['body', 'duo']);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); window.clearHistory?.(); });
  return { errs, id };
}

const model = (page, id) => page.evaluate((id) => JSON.parse(JSON.stringify(window.getGridModel(document.getElementById(id)).cells[0][0].lines)), id);
const INNER1 = (id) => `#${id} .grd-nested[data-line="1"] [data-npath="1.0"]`;

async function rclickMenu(page, sel, item) {
  await clickAt(page, sel); await clickAt(page, sel);
  await clickAt(page, sel, { button: 'right' });
  await clickAt(page, item);
}

test('N1 열 1 안 줄 우클릭 「이미지 추가」 → 그 열에 빈 사진 · 대조: 바깥 줄은 바깥 칸', async ({ page }) => {
  const { errs, id } = await setup(page);
  const before = await model(page, id);
  const n1 = before[1].cols[1].lines.length;
  await rclickMenu(page, INNER1(id), '#bcm-grid-img');
  await expect.poll(async () => (await model(page, id))[1].cols[1].lines.length).toBe(n1 + 1);
  const after = await model(page, id);
  expect(after.length, '바깥 줄 수 그대로').toBe(before.length);
  expect(after[1].cols[1].lines[1], '누른 줄 «다음»에 빈 사진').toEqual({ type: 'image', imgSrc: '' });
  expect(after[1].cols[0], '옆 열 그대로').toEqual(before[1].cols[0]);
  await expect.poll(() => page.evaluate((id) => !!document.querySelector(`#${id} .grd-img-empty[data-npath="1.1"]`), id)).toBe(true);
  // 대조 — 바깥 줄(0) 우클릭은 바깥 칸에 넣는다
  await rclickMenu(page, `#${id} .grd-cell[data-r="0"][data-c="0"] [data-line="0"]`, '#bcm-grid-img');
  await expect.poll(async () => (await model(page, id)).map(l => l.type)).toEqual(['body', 'image', 'duo']);
  expect(errs).toEqual([]);
});

test('N2 열 1 안 줄 우클릭 「원형 이미지 추가」 → 그 열에 원 슬롯', async ({ page }) => {
  const { errs, id } = await setup(page);
  const before = await model(page, id);
  await rclickMenu(page, INNER1(id), '#bcm-grid-img-circle');
  await expect.poll(async () => (await model(page, id))[1].cols[1].lines.length).toBe(before[1].cols[1].lines.length + 1);
  const after = await model(page, id);
  const D = await page.evaluate(() => window.grdNewLineSpec('circle').height);
  expect(D, '원 지름 = 기본값(양수)').toBeGreaterThan(0);
  expect(after[1].cols[1].lines[1]).toEqual({ type: 'image', imgSrc: '', imgShape: 'circle', height: D });
  expect(after.length).toBe(before.length);
  expect(errs).toEqual([]);
});

test('N3 안 줄 고르기 → 패널 「+ 줄 추가」 select 로 사진·원이 그 열에 · 중첩 종류는 없다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await clickAt(page, INNER1(id)); await clickAt(page, INNER1(id));
  await page.waitForSelector('#grd-nest-hint #grd-line-add-kind', { timeout: COND_MS });
  const opts = await page.$$eval('#grd-line-add-kind option', os => os.map(o => o.value));
  expect(opts).toContain('photo'); expect(opts).toContain('circle');
  expect(opts, '★중첩 종류를 select 에 넣지 않는다(E12/E13)').not.toContain('duo');
  const before = await model(page, id);
  await page.selectOption('#grd-line-add-kind', 'photo');
  await expect.poll(async () => (await model(page, id))[1].cols[1].lines.length).toBe(before[1].cols[1].lines.length + 1);
  let m = await model(page, id);
  expect(m[1].cols[1].lines[1]).toEqual({ type: 'image', imgSrc: '' });
  expect(m.length).toBe(before.length);
  // 다시 그려진 패널(활성 줄 = 새 사진 1.1)에서 원 추가 → 그 다음
  await page.waitForSelector('#grd-nest-hint #grd-line-add-kind', { timeout: COND_MS });
  await page.selectOption('#grd-line-add-kind', 'circle');
  await expect.poll(async () => (await model(page, id))[1].cols[1].lines.length).toBe(before[1].cols[1].lines.length + 2);
  m = await model(page, id);
  expect(m[1].cols[1].lines[2].imgShape).toBe('circle');
  expect(m.length).toBe(before.length);
  expect(errs).toEqual([]);
});

/** N1 의 상태(열 1 = [body, 빈 사진]) 를 만들고 그 슬롯을 더블클릭 + 파일 → IMG */
async function fillNested(page, id) {
  await rclickMenu(page, INNER1(id), '#bcm-grid-img');
  const slot = `#${id} .grd-img-empty[data-npath="1.1"]`;
  await page.waitForSelector(slot, { timeout: COND_MS });
  await waitStableRect(page, slot);
  // 누르는 순간 슬롯을 다시 찾는다 — 사이에 다시 그려지면 옛 좌표 더블클릭이 파일창을 못 연다(1109t1A2 평가: 66회 중 1회 흔들림)
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator(slot).dblclick()]);
  await fc.setFiles(pngFile());
  await page.waitForFunction((id) => !!document.querySelector(`#${id} [data-npath="1.1"] img, #${id} img[data-npath="1.1"]`)
    || !!(window.getGridModel(document.getElementById(id)).cells[0][0].lines[1].cols[1].lines[1].imgSrc), id, { timeout: COND_MS });
}

test('N4 중첩 빈 슬롯 더블클릭 + 파일 → 그 열에 그림', async ({ page }) => {
  const { errs, id } = await setup(page);
  await fillNested(page, id);
  const m = await model(page, id);
  expect(m[1].cols[1].lines[1].imgSrc, '그림 src').toBeTruthy();
  expect(m.length, '바깥 줄 수 그대로').toBe(2);
  const hasImg = await page.evaluate((id) => {
    const col = document.querySelector(`#${id} [data-npath="1.1"]`);
    return !!col && !col.classList.contains('grd-img-empty') && (col.tagName === 'IMG' || !!col.querySelector('img'));
  }, id);
  expect(hasImg, '캔버스에 IMG').toBe(true);
  expect(errs).toEqual([]);
});

test('N5 ⌘Z 한 번 = 직전 모델 (우클릭 추가 · 슬롯 채우기 각각)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const m0 = await model(page, id);
  await rclickMenu(page, INNER1(id), '#bcm-grid-img');
  await expect.poll(async () => (await model(page, id))[1].cols[1].lines.length).toBe(m0[1].cols[1].lines.length + 1);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => model(page, id)).toEqual(m0);
  // 채우기 — 새로 추가 → (기록 기준) → 채우기 → ⌘Z 한 번 = 빈 슬롯
  await fillNested(page, id);
  const filled = await model(page, id);
  const empty = JSON.parse(JSON.stringify(filled)); empty[1].cols[1].lines[1] = { type: 'image', imgSrc: '' };
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => {
    const b = document.querySelector('#canvas .grid-block');
    return b ? JSON.parse(JSON.stringify(window.getGridModel(b).cells[0][0].lines)) : null;
  })).toEqual(empty);
  expect(errs).toEqual([]);
});

test('N6 저장 왕복이 src 를 지키고 · HTML 내보내기에 빈 슬롯 없이 그림이 남는다', async ({ page }) => {
  const { id } = await setup(page);
  await fillNested(page, id);
  const src = (await model(page, id))[1].cols[1].lines[1].imgSrc;
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction((id) => !!document.getElementById(id), id, { timeout: COND_MS });
  expect((await model(page, id))[1].cols[1].lines[1].imgSrc, '저장 왕복 src').toBe(src);
  const html = await page.evaluate(async () => {
    let out = null;
    const oc = URL.createObjectURL; URL.createObjectURL = (b) => { out = b; return 'blob:none'; };
    const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; }
    return out ? await out.text() : null;
  });
  expect(html, 'HTML 산출물').toBeTruthy();
  expect(html).not.toContain('grd-img-empty');
  const page2 = await page.context().newPage();
  await page2.setContent(html);
  const n = await page2.evaluate(() => document.querySelectorAll('.grd-nested img').length);
  await page2.close();
  expect(n, '내보낸 HTML 의 중첩 칸에 그림').toBeGreaterThan(0);
});
