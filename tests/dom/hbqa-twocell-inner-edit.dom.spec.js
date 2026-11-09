/* hbqa-twocell-inner-edit.dom.spec.js — NEW-현빈QA-GRID-TWOCELL-INNER-ROW-EDIT: 중첩(나란히 두 칸) 안 줄을 바깥 줄과 «같은 손»으로 — ⌫ · ⌘↑↓ · 우클릭 이미지 삭제/교체. 깊이 1만. */
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


const SCR = '/private/tmp/claude-501/-Users-a1-wt-srv/1bd4c416-ab55-435e-8650-44d1eab12282/scratchpad/hbcopy/proj.json';
const NP = (id, np) => `#${id} .grd-nested[data-line] [data-npath="${np}"]`;
const OUT = (id, li) => `#${id} .grd-cell[data-r="0"][data-c="0"] > [data-line="${li}"]`;
const col1 = async (page, id) => (await model(page, id)).find(l => l.type === 'duo').cols[1].lines;
const active = (page, id) => page.evaluate((id) => JSON.parse(JSON.stringify(window.grdGetActiveLine(document.getElementById(id)) || null)), id);
async function pick(page, sel) { await clickAt(page, sel); await clickAt(page, sel); }
async function key(page, k) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); }
/** 열 1 = [글자, 빈 사진] — 우클릭 「이미지 추가」(A2 길). 이력은 비운다. */
async function withPhoto(page) {
  const s = await setup(page);
  await rclickMenu(page, INNER1(s.id), '#bcm-grid-img');
  await page.waitForSelector(NP(s.id, '1.1'), { timeout: COND_MS });
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); window.clearHistory?.(); });
  return s;
}
async function rclickOnly(page, sel) { await clickAt(page, sel); await clickAt(page, sel); await clickAt(page, sel, { button: 'right' }); }
const vis = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none'; }, sel);
async function pickFile(page, item) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), clickAt(page, item)]);
  await fc.setFiles(pngFile());
}

test('H1 중첩 이미지 줄 ⌫ → 그 열에서 빠진다 · ⌘Z 한 번 = 복원 · 저장 왕복', async ({ page }) => {
  const { errs, id } = await withPhoto(page);
  const m0 = await model(page, id);
  await pick(page, NP(id, '1.1'));
  expect((await active(page, id)).np, '중첩 줄이 골라졌다').toBe('1.1');
  await key(page, 'Backspace');
  await expect.poll(async () => (await col1(page, id)).length).toBe(1);
  expect((await model(page, id)).length, '바깥 줄 수 그대로').toBe(m0.length);
  expect(await page.evaluate((id) => !!document.getElementById(id), id), '블럭은 남는다').toBe(true);
  const del = await model(page, id);
  await key(page, 'Meta+z');
  await expect.poll(() => model(page, id)).toEqual(m0);
  await key(page, 'Meta+Shift+z');
  await expect.poll(() => model(page, id)).toEqual(del);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction((id) => !!document.getElementById(id), id, { timeout: COND_MS });
  expect(await model(page, id), '저장 → 다시 열기').toEqual(del);
  expect(errs).toEqual([]);
});

test('H2 중첩 줄 ⌘↑/⌘↓ → 그 열 안에서 자리 바꿈 · ⌘Z 한 번', async ({ page }) => {
  const { errs, id } = await withPhoto(page);
  const m0 = await model(page, id);
  const [a, b] = m0[1].cols[1].lines;
  await pick(page, NP(id, '1.1'));
  await key(page, 'Meta+ArrowUp');
  await expect.poll(() => col1(page, id)).toEqual([b, a]);
  expect((await active(page, id)).np, '활성줄이 따라간다').toBe('1.0');
  expect((await model(page, id))[1].cols[0], '옆 열 그대로').toEqual(m0[1].cols[0]);
  const up = await model(page, id);
  await key(page, 'Meta+ArrowUp');   // 맨 위 = 조용히 소비(블럭이 안 움직인다)
  expect(await model(page, id)).toEqual(up);
  await key(page, 'Meta+ArrowDown');
  await expect.poll(() => col1(page, id)).toEqual([a, b]);
  await key(page, 'Meta+z');
  await expect.poll(() => model(page, id)).toEqual(up);
  expect(errs).toEqual([]);
});

test('H3 중첩 이미지 우클릭 「이미지 삭제」 → src 만 비우고 자리는 남는다', async ({ page }) => {
  const { errs, id } = await withPhoto(page);
  const slot = `#${id} .grd-img-empty[data-npath="1.1"]`;
  await waitStableRect(page, slot);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator(slot).dblclick()]);
  await fc.setFiles(pngFile());
  await expect.poll(async () => !!(await col1(page, id))[1].imgSrc).toBe(true);
  const n = (await col1(page, id)).length;
  await rclickOnly(page, NP(id, '1.1'));
  expect(await vis(page, '#bcm-grid-img-del'), '「이미지 삭제」가 보인다').toBe(true);
  expect(await page.textContent('#bcm-grid-img-label')).toBe('이미지 교체');
  await clickAt(page, '#bcm-grid-img-del');
  await expect.poll(async () => (await col1(page, id))[1].imgSrc).toBe('');
  expect((await col1(page, id)).length, '자리(줄)는 남는다').toBe(n);
  await key(page, 'Meta+z');
  await expect.poll(async () => !!(await col1(page, id))[1].imgSrc).toBe(true);
  expect(errs).toEqual([]);
});

test('H4 중첩 이미지 우클릭 「이미지 교체」 → 파일창 → 그 줄에 src (줄 수 그대로) · 글자 줄 「이미지 추가」는 빈 슬롯(바깥과 같다)', async ({ page }) => {
  const { errs, id } = await withPhoto(page);
  const n = (await col1(page, id)).length;
  await rclickOnly(page, NP(id, '1.1'));
  expect(await page.textContent('#bcm-grid-img-label')).toBe('이미지 교체');
  await pickFile(page, '#bcm-grid-img');
  await expect.poll(async () => !!(await col1(page, id))[1].imgSrc).toBe(true);
  expect((await col1(page, id)).length).toBe(n);
  expect((await model(page, id)).length, '바깥 줄 수 그대로').toBe(2);
  await rclickOnly(page, NP(id, '1.0'));
  expect(await page.textContent('#bcm-grid-img-label')).toBe('이미지 추가');
  expect(await vis(page, '#bcm-grid-img-del'), '글자 줄엔 「이미지 삭제」 없음').toBe(false);
  expect(errs).toEqual([]);
});

test('H5 대조 — 바깥 줄 ⌫ · ⌘↑ · 「이미지 교체」 파일창은 그대로', async ({ page }) => {
  const { errs, id } = await setup(page);
  await rclickMenu(page, OUT(id, 0), '#bcm-grid-img');   // 바깥 [body, image, duo]
  await expect.poll(async () => (await model(page, id)).map(l => l.type)).toEqual(['body', 'image', 'duo']);
  await rclickOnly(page, OUT(id, 1));
  expect(await page.textContent('#bcm-grid-img-label')).toBe('이미지 교체');
  await pickFile(page, '#bcm-grid-img');
  await expect.poll(async () => !!(await model(page, id))[1].imgSrc).toBe(true);
  await pick(page, OUT(id, 1));
  await key(page, 'Meta+ArrowUp');
  await expect.poll(async () => (await model(page, id)).map(l => l.type)).toEqual(['image', 'body', 'duo']);
  await pick(page, OUT(id, 0));
  await key(page, 'Backspace');
  await expect.poll(async () => (await model(page, id)).map(l => l.type)).toEqual(['body', 'duo']);
  expect(errs).toEqual([]);
});

test('H6 현빈 문서 사본 — 왼쪽 열 빈 원 하나 ⌫ → 모델이 하나 준다', async ({ page }) => {
  test.skip(!fs.existsSync(SCR), '현빈 문서 사본 없음');
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(fs.readFileSync(SCR, 'utf8')));
  const id = 'grd_rwx4l_kcoz5xe';
  await page.waitForFunction((id) => !!document.getElementById(id), id, { timeout: COND_MS });
  await page.evaluate((id) => { window.applyZoom?.(100); document.getElementById(id).scrollIntoView({ block: 'center' }); window.deselectAll?.(); window.clearHistory?.(); }, id);
  const left = async () => (await model(page, id))[0].cols[0].lines;
  const L0 = await left();
  const right0 = (await model(page, id))[0].cols[1];
  expect(L0[1], '[전제] 0.1 = 빈 원').toMatchObject({ type: 'image', imgSrc: '', imgShape: 'circle' });
  const c01 = `#${id} [data-npath="0.1"]`;
  await page.waitForFunction(() => { const S = document.getElementById('canvas-scaler'); return !!S && !S.getAnimations().length; }, null, { timeout: COND_MS });
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), c01);
  const r = await waitStableRect(page, c01);
  await page.mouse.dblclick(r.cx, r.cy); await frames2(page);   // 현빈 손: 그리드에 더블클릭으로 들어가서
  await clickAt(page, c01);                                     // 그 원을 누른다
  const dbg = await page.evaluate(([id, x, y]) => { const e = document.elementFromPoint(x, y); return { at: e && (e.className + '|' + (e.dataset?.npath || '')), sel: [...document.querySelectorAll('.selected')].map(x => x.id || x.className), act: window.grdGetActiveLine(document.getElementById(id)), z: getComputedStyle(document.getElementById('canvas-scaler')).transform }; }, [id, r.cx, r.cy]);
  expect((await active(page, id))?.np, JSON.stringify(dbg)).toBe('0.1');
  await key(page, 'Backspace');
  await expect.poll(async () => (await left()).length).toBe(L0.length - 1);
  expect(await left()).toEqual(L0.filter((_, i) => i !== 1));
  expect((await model(page, id))[0].cols[1], '오른쪽 열 그대로').toEqual(right0);
  expect(errs).toEqual([]);
});
