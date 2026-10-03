/* grid-width-ui.dom.spec.js — G2-b 「그리드 블럭 자체 너비」 «손» 둘: 우측패널 너비 줄(A) + 떠 있는 그리드의 폭 손잡이(B)
 *   지디 결정 2026-10-04: 모델 그대로(㉠ 떠 있는 것은 굳힌 폭이 정본) · 떠 있으면 «굳힌 폭», 아니면 «키» ·
 *   추가 조건 = 떠 있는 동안 바꾼 폭이 «해제 뒤에도» 남는다(키로 이관).
 * P1 패널 입력(안 떠 있음) → 키·그려진 폭 · P2 패널 입력(떠 있음) → 굳힌 폭(+키) · P3 「100%」 → 키·자동표시 지움(떠 있으면 막힘)
 * H1 손잡이 — 떠 있을 때만 4개 · 화면 7×7(줌 40/100) · 안 떠 있으면 0(대조)
 * H2 손잡이 끌기 → 폭(줌 40·100, 줌 전제 먼저 단언) · 글자 크기 불변 · w 쪽은 오른쪽 끝 고정
 * F1 ★떠 있는 동안 바꾼 폭 → 오버레이 끔 → 폭 그대로 · 키 = 그 폭 · 다시 그려도 그대로
 * U1 ⌘Z 한 걸음(손잡이 · 패널) · S1 저장 왕복(떠 있음/안 떠 있음)
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스, ⛔Electron 아님).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" data-padding-x="40" style="padding-left:40px;padding-right:40px">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:500px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '왼칸 글자' }] }, { width: 1, lines: [{ type: 'body', text: '오른칸 글자' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
    window.deselectAll?.(); document.getElementById('gS').scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(200);
  return errs;
}
async function setZoom(page, z) {
  await page.evaluate((z) => {
    if (typeof window.applyZoom === 'function') window.applyZoom(z);
    else { document.getElementById('canvas-scaler').style.transform = `scale(${z / 100})`; window.currentZoom = z; }
    document.getElementById('gS').scrollIntoView({ block: 'start' });
  }, z);
  await page.waitForTimeout(350);
  /* ★줌 전제 «먼저» — 스케일러 행렬이 정말 그 배율인가(transition 이 끝났나). */
  const sc = await page.evaluate(() => {
    const m = getComputedStyle(document.getElementById('canvas-scaler')).transform;
    const k = m && m !== 'none' ? parseFloat(m.split('(')[1]) : 1;
    return Math.round(k * 1000) / 1000;
  });
  expect(sc, `줌 전제 — 스케일러 배율이 ${z / 100}`).toBe(z / 100);
  return sc;
}
const st = (page) => page.evaluate(() => {
  const g = document.getElementById('gG');
  return { w: g.offsetWidth, css: g.style.width, key: g.dataset.gridWidth ?? null, auto: g.dataset.gridWidthAuto ?? null,
           frozen: g.dataset.overlayFrozenWidth ?? null, float: g.dataset.overlayBlock === 'true',
           x: Number(g.dataset.offsetX ?? NaN), right: Number(g.dataset.offsetX ?? NaN) + g.offsetWidth,
           fs: [...g.querySelectorAll('.grd-line')].map(l => getComputedStyle(l).fontSize) };
});
async function select(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('gG').getBoundingClientRect(); return [r.left + 4, r.top + 4]; });
  await page.mouse.click(x, y); await page.waitForTimeout(250);
}
async function toggleFloat(page) { await page.click('#grd-float-toggle'); await page.waitForTimeout(300); }
async function typeWidth(page, v) {
  await page.click('#grd-width-number', { clickCount: 3 });
  await page.keyboard.type(String(v)); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
}
const handles = (page) => page.evaluate(() => [...document.querySelectorAll('#ss-handles-overlay .grd-overlay-handle')]
  .filter(h => getComputedStyle(h).display !== 'none')
  .map(h => { const r = h.getBoundingClientRect(); return { dir: h.dataset.grdResizeDir, w: +r.width.toFixed(2), h: +r.height.toFixed(2), cx: r.left + r.width / 2, cy: r.top + r.height / 2, cursor: getComputedStyle(h).cursor }; }));
async function dragHandle(page, dir, dxScreen) {
  const h = (await handles(page)).find(x => x.dir === dir);
  expect(h, `손잡이 ${dir} 가 있다`).toBeTruthy();
  await page.mouse.move(h.cx, h.cy); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(h.cx + dxScreen * i / 10, h.cy + 3 * i / 10);
  await page.mouse.up(); await page.waitForTimeout(250);
}

test.setTimeout(120000);

test('P1 패널 너비(안 떠 있음) → 키·그려진 폭 · 다시 그려도 산다 · 범위 밖은 칸이 죈다', async ({ page }) => {
  const errs = await setup(page);
  await select(page);
  expect(await page.isVisible('#grd-width-number'), '그리드 패널에 너비 칸').toBe(true);
  expect(await page.inputValue('#grd-width-number'), '키 없음 = 빈 칸(자동)').toBe('');
  expect(await page.getAttribute('#grd-width-auto', 'class'), '키 없음 = 「100%」 켜짐').toContain('active');
  await typeWidth(page, 420);
  expect(await st(page)).toMatchObject({ w: 420, css: '420px', key: '420', float: false });
  await page.evaluate(() => window.renderGridBlock(document.getElementById('gG')));
  expect((await st(page)).w, '재렌더 뒤에도').toBe(420);
  expect(await page.getAttribute('#grd-width-auto', 'class')).not.toContain('active');
  await typeWidth(page, 9999);
  expect((await st(page)).key, '상한 3000 으로 죈다').toBe('3000');
  await typeWidth(page, 5);
  expect((await st(page)).key, '하한 40 으로 죈다').toBe('40');
  expect(errs).toEqual([]);
});

test('P2 패널 너비(떠 있음) → 굳힌 폭이 바뀐다(+키) · 다시 그려도 그대로', async ({ page }) => {
  const errs = await setup(page);
  await select(page); await toggleFloat(page);
  const s0 = await st(page);
  expect(s0.float, '전제 — 떴다').toBe(true);
  expect(s0.frozen, '전제 — 굳힌 폭 표식이 있다(키 없이 띄움)').toMatch(/^\d+px$/);
  expect(await page.inputValue('#grd-width-number'), '떠 있으면 칸 = 지금 그려진 px').toBe(String(s0.w));
  expect(await page.isDisabled('#grd-width-auto'), '떠 있는 동안 「100%」 는 막힘').toBe(true);
  await typeWidth(page, 500);
  expect(await st(page)).toMatchObject({ w: 500, css: '500px', frozen: '500px', key: '500', float: true });
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.gap = '30'; window.renderGridBlock(g); });
  expect((await st(page)).w, '떠 있는 채 다시 그려도 500').toBe(500);
  expect(errs).toEqual([]);
});

test('P3 「100%(자동)」 → 키·자동 표시를 지우고 100% 로', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.gridWidthAuto = '1'; g.dataset.gridWidth = '333'; window.renderGridBlock(g); });
  await select(page);
  expect((await st(page)).w, '전제 — 333').toBe(333);
  await page.click('#grd-width-auto'); await page.waitForTimeout(250);
  expect(await st(page)).toMatchObject({ css: '100%', key: null, auto: null });
  expect(await page.inputValue('#grd-width-number')).toBe('');
  await typeWidth(page, 300);
  await page.click('#grd-width-number', { clickCount: 3 }); await page.keyboard.press('Backspace'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  expect(await st(page), '비우고 Enter = 자동').toMatchObject({ css: '100%', key: null });
  expect(errs).toEqual([]);
});

/* P4 — 슬라이더: 끄는 동안 매 틱 쓰고(applyGridOwnWidth) 양쪽 끝 표본을 찍는다. 이웃(push-after)과 ⌘Z 가 갈라지나. */
test('P4 슬라이더 → 폭(끄는 동안 반영) · 뒤에 push-after 동작 → ⌘Z 한 번은 그 동작만 · 두 번째가 슬라이더', async ({ page }) => {
  const errs = await setup(page);
  await select(page);
  const va0 = await page.evaluate(() => document.getElementById('gG').dataset.valign ?? null);
  await page.evaluate(() => {
    const sl = document.getElementById('grd-width-slider');
    for (const v of [600, 560, 520]) { sl.value = String(v); sl.dispatchEvent(new Event('input', { bubbles: true })); }
    sl.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(200);
  expect(await st(page)).toMatchObject({ w: 520, css: '520px', key: '520' });
  expect(await page.inputValue('#grd-width-number'), '패널 칸도 520').toBe('520');
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.valign = 'center'; window.renderGridBlock(g); window.pushHistory('세로 정렬'); });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  const u1 = await page.evaluate(() => ({ w: document.getElementById('gG').offsetWidth, va: document.getElementById('gG').dataset.valign ?? null }));
  expect(u1, '⌘Z 한 번 = 정렬만').toEqual({ w: 520, va: va0 });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await st(page), '⌘Z 두 번 = 슬라이더 전(자동)').toMatchObject({ css: '100%', key: null });
  expect(errs).toEqual([]);
});

test('H1 손잡이 — 떠 있을 때만 4개 · 화면 7×7(줌 40/100) · ew-resize · 안 떠 있으면 0(대조)', async ({ page }) => {
  const errs = await setup(page);
  for (const z of [40, 100]) {
    await setZoom(page, z);
    await select(page);
    expect((await handles(page)).length, `줌 ${z} 안 떠 있음 = 0`).toBe(0);
  }
  await toggleFloat(page);
  for (const z of [40, 100]) {
    await setZoom(page, z);
    await select(page);
    const hs = await handles(page);
    expect(hs.map(h => h.dir).sort(), `줌 ${z} 네 모서리`).toEqual(['ne', 'nw', 'se', 'sw']);
    for (const h of hs) expect({ w: h.w, h: h.h, cursor: h.cursor }, `줌 ${z} ${h.dir} 화면 크기 고정`).toEqual({ w: 7, h: 7, cursor: 'ew-resize' });
    /* 자리 — se 손잡이 중심 = 블럭 오른쪽 아래 꼭지점 */
    const r = await page.evaluate(() => { const b = document.getElementById('gG').getBoundingClientRect(); return { r: b.right, b: b.bottom }; });
    const se = hs.find(h => h.dir === 'se');
    expect(Math.abs(se.cx - r.r) + Math.abs(se.cy - r.b), `줌 ${z} se 가 꼭지점에`).toBeLessThan(1.5);
  }
  await toggleFloat(page);
  await page.waitForTimeout(100);
  expect((await handles(page)).length, '오버레이를 끄면 걷힌다').toBe(0);
  expect(errs).toEqual([]);
});

for (const z of [40, 100]) {
  test(`H2 손잡이 끌기 → 폭만 바뀐다 · 줌 ${z}`, async ({ page }) => {
    const errs = await setup(page);
    await select(page); await toggleFloat(page);
    const sc = await setZoom(page, z);
    await select(page);
    const s0 = await st(page);
    await dragHandle(page, 'se', 60);
    const s1 = await st(page);
    expect(s1.w - s0.w, `se +60화면px = +${60 / sc} 캔버스px`).toBeGreaterThanOrEqual(Math.round(60 / sc) - 2);
    expect(s1.w - s0.w).toBeLessThanOrEqual(Math.round(60 / sc) + 2);
    expect(s1, '굳힌 폭 + 키 둘 다').toMatchObject({ css: s1.w + 'px', frozen: s1.w + 'px', key: String(s1.w), float: true });
    expect(s1.x, 'e 쪽 = 왼쪽 끝 제자리').toBe(s0.x);
    expect(s1.fs, '글자 크기 불변(텍스트 손잡이와 다르다)').toEqual(s0.fs);
    await dragHandle(page, 'nw', 40);
    const s2 = await st(page);
    expect(s1.w - s2.w, 'nw 안쪽 +40화면px = 좁아진다').toBeGreaterThanOrEqual(Math.round(40 / sc) - 2);
    expect(Math.abs(s2.right - s1.right), 'w 쪽 = 오른쪽 끝 제자리').toBeLessThanOrEqual(1);
    await dragHandle(page, 'sw', 5000);
    expect((await st(page)).w, '하한 40').toBe(40);
    expect(errs).toEqual([]);
  });
}

test('F1 ★떠 있는 동안 바꾼 폭 → 오버레이 끔 → 폭 그대로 · 키 = 그 폭 · 다시 그려도 그대로', async ({ page }) => {
  const errs = await setup(page);
  await select(page); await toggleFloat(page);
  await dragHandle(page, 'se', -150);
  const s1 = await st(page);
  expect(s1.float).toBe(true);
  await select(page); await toggleFloat(page);
  const s2 = await st(page);
  expect(s2, '끈 직후').toMatchObject({ float: false, w: s1.w, css: s1.w + 'px', key: String(s1.w), frozen: null });
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.gap = '30'; window.renderGridBlock(g); });
  expect((await st(page)).w, '흐름에서 다시 그려도').toBe(s1.w);
  /* 대조 — 폭을 «안» 바꾸고 띄웠다 끄면 옛 동작(100%, 키 없음) 그대로 */
  await select(page); await page.click('#grd-width-auto'); await page.waitForTimeout(200);
  await select(page); await toggleFloat(page); await select(page); await toggleFloat(page);
  expect(await st(page), '대조 — 안 바꾸면 100% · 키 없음').toMatchObject({ float: false, css: '100%', key: null });
  expect(errs).toEqual([]);
});

/* F0 — «문»으로 잰다(UI 없이): 떠 있는 동안 기존 쓰는 문(updateGridBlock{width})을 부르고 → exitFloat.
   기준판(ebb13f39)에선 이게 «이관이 안 된다»는 측정이다: 떠 있는 동안 화면 불변(렌더가 키를 안 봄) → 끈 직후 100%(style) ·
   키는 px = 두 명부 → 다음 렌더에서 폭이 튄다. 이 판에선 셋 다 한 값이어야 한다. 수치는 console 로도 남긴다(보고서용). */
test('F0 ★문 수준 — 떠 있는 동안 updateGridBlock{width} → 보인다 · exitFloat 뒤 style=키=그 폭 · 다시 그려도 그대로', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const g = document.getElementById('gG');
    window.OverlayFloat.enterFloat(g);
    const w0 = g.offsetWidth;
    window.updateGridBlock('gG', { width: 300 });
    const during = { w: g.offsetWidth, css: g.style.width, key: g.dataset.gridWidth ?? null };
    window.OverlayFloat.exitFloat(g);
    const after = { w: g.offsetWidth, css: g.style.width, key: g.dataset.gridWidth ?? null };
    window.renderGridBlock(g);
    const rerender = { w: g.offsetWidth, css: g.style.width };
    return { w0, during, after, rerender };
  });
  console.log('F0', JSON.stringify(r));
  expect(r.w0, '전제 — 띄운 폭은 300 이 아니다').not.toBe(300);
  expect(r.during, '떠 있는 동안 — 보인다').toMatchObject({ w: 300, css: '300px', key: '300' });
  expect(r.after, '끈 직후 — style·키·그려진 폭이 한 값').toMatchObject({ w: 300, css: '300px', key: '300' });
  expect(r.rerender, '다시 그려도 그대로(튀지 않는다)').toMatchObject({ w: 300, css: '300px' });
  expect(errs).toEqual([]);
});

test('U1 ⌘Z 한 걸음 — 손잡이 끌기 한 번 · 패널 입력 한 번', async ({ page }) => {
  const errs = await setup(page);
  await select(page); await toggleFloat(page);
  const s0 = await st(page);
  await dragHandle(page, 'se', 80);
  expect((await st(page)).w).toBeGreaterThan(s0.w);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await st(page), '⌘Z 한 번 = 끌기 전 폭(떠 있는 채)').toMatchObject({ w: s0.w, float: true, key: null });
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(300);
  expect((await st(page)).w, '⌘⇧Z = 다시').toBeGreaterThan(s0.w);
  /* 패널 — 안 떠 있는 판 */
  await select(page); await toggleFloat(page);
  await select(page); await page.click('#grd-width-auto'); await page.waitForTimeout(200);
  const p0 = await st(page);
  expect(p0.key, '전제 — 자동').toBe(null);
  await select(page); await typeWidth(page, 380);
  expect((await st(page)).w).toBe(380);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await st(page), '⌘Z 한 번 = 입력 전').toMatchObject({ css: '100%', key: null });
  expect(errs).toEqual([]);
});

/* U2 — 끝 표본(onUp pushHistory)을 «이웃»으로 잰다. U1 만으로는 못 본다: ⌘Z 하나만 누르면 끝 표본이 없어도 되돌아간다(M8 변이 실측 초록).
   drag-history.js ⑴: 끌기 «뒤»에 push-after 동작이 오면, 끝 표본이 없을 때 ⌘Z 한 번이 둘을 같이 먹는다. */
test('U2 손잡이 끌기 → (push-after 동작) → ⌘Z 한 번은 그 동작만 · 두 번째가 끌기', async ({ page }) => {
  const errs = await setup(page);
  await select(page); await toggleFloat(page);
  const s0 = await st(page);
  const va0 = await page.evaluate(() => document.getElementById('gG').dataset.valign ?? null);
  expect(va0, '전제 — 바꿀 정렬과 다르다').not.toBe('center');
  await dragHandle(page, 'se', 80);
  const s1 = await st(page);
  expect(s1.w, '전제 — 넓어졌다').toBeGreaterThan(s0.w);
  /* push-after 이웃 — 우측패널 대다수의 꼴(바꾸고 «뒤»에 찍는다) */
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.valign = 'center'; window.renderGridBlock(g); window.pushHistory('세로 정렬'); });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  const u1 = await page.evaluate(() => ({ w: document.getElementById('gG').offsetWidth, va: document.getElementById('gG').dataset.valign ?? null }));
  expect(u1, '⌘Z 한 번 = 정렬만 되돌림 · 폭은 끌린 그대로').toEqual({ w: s1.w, va: va0 });
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect((await st(page)).w, '⌘Z 두 번 = 끌기 전').toBe(s0.w);
  expect(errs).toEqual([]);
});

test('S1 저장 왕복 — 떠 있음(굳힌 폭+키) · 안 떠 있음(키) 모두 산다', async ({ page }) => {
  const errs = await setup(page);
  await select(page); await toggleFloat(page); await select(page);
  await typeWidth(page, 455);
  const r = await page.evaluate(() => {
    const { block: k } = window.makeGridBlock({}); k.id = 'gK'; document.getElementById('gR').after(k);
    window.updateGridBlock('gK', { width: 512 });
    const s = window.getSerializedCanvas();
    const c = document.getElementById('canvas'); c.innerHTML = s; window.rebindAll();
    const g = document.getElementById('gG'), kk = document.getElementById('gK');
    window.renderGridBlock(g); window.renderGridBlock(kk);
    return { gw: g.offsetWidth, gf: g.dataset.overlayBlock, gkey: g.dataset.gridWidth, gfrozen: g.dataset.overlayFrozenWidth, kw: kk.offsetWidth, kkey: kk.dataset.gridWidth };
  });
  expect(r).toEqual({ gw: 455, gf: 'true', gkey: '455', gfrozen: '455px', kw: 512, kkey: '512' });
  expect(errs).toEqual([]);
});
