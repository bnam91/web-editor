/* c4-settle-restamp.dom.spec.js — C4 (2026-10-06 · APPROVED_BY: 지디 C4-settle-restamp): 칸 배경 그림을 넣고 ⌘Z 한 번이면 그림이 없어진다
 *
 * 병(실측 10-06 · predict-C4-mech.md): E157 의 «정착»(그림 디코드 뒤 .grd-inner gridTemplateRows 쓰기)이 ⌘Z 기록과 어긋났다.
 *   updateGridBlock → push-before S0(그림 없음) → 모델 커밋 감쌈이 push-after S1(그림) + 2 rAF 뒤 restamp 예약.
 *   디코드가 그 restamp «뒤»에 끝나면 라이브 ≠ S1 → ⌘Z 의 ensureHistoryCheckpoint 가 새 칸을 쌓고 S1(그림 있음)로 «되돌린다».
 *   느린 디코드(500ms · e157 slowDecode 와 같은 수) + 1.5s 기다려 ⌘Z: 29fbe4b6 5/5 실패 · 0ff05430(E157 전) 0/5.
 *   (빠른 디코드에서 7/50 = 이 병의 «빠른 모퉁이» — 3/30 a497e201 + 4/20 feff4d85, feff 둘째 판은 memgate 588MB 거부 = 안 돎.)
 * 처방 ⒜: 디코드 «끝» 갈래(다시 그린 뒤)에서 지금 꼭대기를 restampHistoryTop — 새 칸 0. 누른 포인터가 있으면 안 함.
 * 거울 위험(지디 ㉢): restamp 가 칸을 늘리면 «⌘Z 가 아무것도 안 함»을 «⌘Z 두 번»으로 바꿀 뿐 — S2·S3 이 그걸 잰다.
 * 머리표: [새 것] 고치기 전 빨강 · [거울]/[회귀 지킴] 고치기 전에도 초록 · [전제]. 예측 = reports/I15/FIX25/predict-C4-fix.md. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page, { slow }) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((slow) => {
    if (slow) { const o = HTMLImageElement.prototype.decode; HTMLImageElement.prototype.decode = function () { const p = o.call(this); return p.then((v) => new Promise((r) => setTimeout(() => r(v), 500))); }; }
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sR" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sR-in"></div></div>');
    const { row, block } = window.makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: [{ height: 160 }, { height: 160 }],
    });
    block.id = 'gR'; document.getElementById('sR-in').appendChild(row); window.rebindAll?.(); window.applyZoom?.(100); window.deselectAll?.();
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const x = cv.getContext('2d'); x.fillStyle = '#00aa44'; x.fillRect(0, 0, 400, 300);
    window.__IMG = cv.toDataURL('image/png');
  }, slow);
  await page.waitForTimeout(250);
  return errs;
}
const put = (page, patch) => page.evaluate((p) => window.updateGridBlock('gR', { patchCell: p }), patch);
const state = (page) => page.evaluate(() => {
  const g = document.getElementById('gR'); let cells = []; try { cells = JSON.parse(g.dataset.cells || '[]'); } catch (_) {}
  const c01 = (cells[0] || [])[1] || {}, c10 = (cells[1] || [])[0] || {};
  const el = g.querySelector('.grd-cell[data-r="0"][data-c="1"]');
  return { dataImg: 'bgImg' in c01, screenImg: el ? getComputedStyle(el).backgroundImage !== 'none' : null, bg10: c10.bg ?? null,
    rows: g.querySelector('.grd-inner')?.style.gridTemplateRows || '', len: window.getHistoryTip?.().len ?? null };
});
async function key(page, k) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); await page.waitForTimeout(300); }

test('S0 [전제] 느린 디코드 — 1.5s 뒤 모델에 그림 · 행이 정착(넣은 직후와 트랙이 다르다)', async ({ page }) => {
  const errs = await setup(page, { slow: true });
  const r = await put(page, { r: 0, c: 1, bgImg: await page.evaluate(() => window.__IMG) });
  expect(r && r.ok).toBe(true);
  const a = await state(page);
  await page.waitForTimeout(1500);
  const b = await state(page);
  expect(b.dataImg, '[전제] 그림이 들어갔다').toBe(true);
  expect(b.rows, `[전제] 디코드 뒤 행이 정착했다 (${a.rows} → ${b.rows})`).not.toBe(a.rows);
  expect(errs).toEqual([]);
});

test('S1 [새 것] 느린 디코드 · 1.5s 뒤 ⌘Z 1번 ⇒ 그림 없음(데이터·화면) · ⌘⇧Z 1번 ⇒ 다시 있음', async ({ page }) => {
  const errs = await setup(page, { slow: true });
  await put(page, { r: 0, c: 1, bgImg: await page.evaluate(() => window.__IMG) });
  await page.waitForTimeout(1500);
  await key(page, 'Meta+z');
  const u = await state(page);
  expect([u.dataImg, u.screenImg], `★⌘Z 한 번에 그림이 안 없어졌다 ${JSON.stringify(u)}`).toEqual([false, false]);
  await key(page, 'Meta+Shift+z');
  const r = await state(page);
  expect([r.dataImg, r.screenImg], `★⌘⇧Z 한 번에 그림이 안 돌아왔다 ${JSON.stringify(r)}`).toEqual([true, true]);
  expect(errs).toEqual([]);
});

test('S2 [거울] 느린 디코드 — 정착(restamp)이 기록 칸을 «안» 늘린다', async ({ page }) => {
  const errs = await setup(page, { slow: true });
  await put(page, { r: 0, c: 1, bgImg: await page.evaluate(() => window.__IMG) });
  await page.waitForTimeout(100);
  const a = await state(page);
  await page.waitForTimeout(1500);
  const b = await state(page);
  expect(b.len, `★정착이 기록 칸을 늘렸다 ${a.len} → ${b.len} — ⌘Z 가 두 번 필요해진다`).toBe(a.len);
  expect(errs).toEqual([]);
});

test('S3 [거울] 보통 디코드 · ⌘Z 1번 ⇒ 없음 · ⌘⇧Z 1번 ⇒ 있음', async ({ page }) => {
  const errs = await setup(page, { slow: false });
  await put(page, { r: 0, c: 1, bgImg: await page.evaluate(() => window.__IMG) });
  await page.waitForTimeout(1500);
  await key(page, 'Meta+z');
  expect((await state(page)).dataImg, '★⌘Z 한 번에 그림이 안 없어졌다').toBe(false);
  await key(page, 'Meta+Shift+z');
  expect((await state(page)).dataImg, '★⌘⇧Z 한 번에 그림이 안 돌아왔다').toBe(true);
  expect(errs).toEqual([]);
});

test('S4 [새 것·끼어든 편집] 느린 디코드 · 넣고 곧 다른 칸 색 · 1.5s 뒤 ⌘Z 1번 ⇒ 색만 · 또 1번 ⇒ 그림도', async ({ page }) => {
  const errs = await setup(page, { slow: true });
  await put(page, { r: 0, c: 1, bgImg: await page.evaluate(() => window.__IMG) });
  await page.waitForTimeout(80);
  await put(page, { r: 1, c: 0, bg: '#ff0000' });
  await page.waitForTimeout(1500);
  await key(page, 'Meta+z');
  const u1 = await state(page);
  expect([u1.bg10, u1.dataImg], `★⌘Z 첫 번 = 색만 되돌림(그림은 남음) ${JSON.stringify(u1)}`).toEqual([null, true]);
  await key(page, 'Meta+z');
  expect((await state(page)).dataImg, '★⌘Z 두 번째에 그림이 안 없어졌다').toBe(false);
  expect(errs).toEqual([]);
});
