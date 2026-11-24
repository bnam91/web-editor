/* position-std.dom.spec.js — 표준 Position 절(시트 0.9.14 73행 · 현빈 확정 261124 10:47·10:49·11:03·11:11 · 시안 8910 #mkp-posstd gdragon 0f8d0ca · 계획 handoff/PLAN-position-std-261124 · 지디 GO)
 *   P1 = 부품(js/props/_position-section.js) + 머리 엔드슬롯 [슬라이드 모드][IAL ⊡] + 슬라이드 모드(패널 설정 하나) + 첫 소비자 modal
 *   PS1 흐름 안 모달 — 머리 엔드슬롯 단추 둘(슬라이드 → IAL 순) · 정렬 6·X/Y = 있음 + disabled(숨김 아님 · 툴팁 6-2) · 회전 칸은 씀
 *   PS2 떠 있는 모달 — 정렬 6·X/Y 씀(disabled 0) · X/Y = offsetX/Y
 *   PS3 슬라이드 모드 — 머리 토글 = 회전 슬라이더 줄(옛 숫자 칸·90°·뒤집기 그대로 아래) · 패널 설정이라 다른 모달 골라도 켜진 채 · 다시 누르면 꺼짐
 *   PS4 슬라이더 30 → 저장 키 = 옛 dataset.rotation(키 무변) · 숫자 칸 30 · ⌘Z 한 번 = 0 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, n = 1) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((n) => {
    try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {}
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sec1"><div class="section-hitzone"></div><div class="section-inner" id="inner1"></div></div>');
    window.rebindAll?.();
    window.__mdls = [];
    for (let i = 0; i < n; i++) { document.getElementById('sec1').classList.add('selected'); const m = window.addModalBlock?.({}); window.__mdls.push(m && m.block); }
    window.deselectAll?.(); window.selectBlock?.(window.__mdls[0].id); window.showModalProperties?.(window.__mdls[0]); window.clearHistory?.();
  }, n);
  await page.waitForSelector('#mdl-float-toggle');
  return errs;
}
const posSec = (page) => page.evaluate(() => {
  const sec = document.querySelector('#panel-right .prop-section[data-sec="position"]');
  if (!sec) return null;
  const head = [...sec.querySelectorAll(':scope > .prop-sec-head button, :scope > .prop-sec-head label')].filter((b) => b.querySelector('svg') || b.id).map((b) => b.id || b.querySelector('input')?.id || '');
  const al = [...sec.querySelectorAll('[data-float-align]')];
  const x = document.getElementById('mdl-x-number'), y = document.getElementById('mdl-y-number');
  return { head, align: al.length, alignDisabled: al.filter((b) => b.disabled).length, xy: [!!x, !!y], xyDisabled: [x?.disabled, y?.disabled], xTip: x?.closest('[title]')?.getAttribute('title') || x?.title || '',
    rot: !!document.getElementById('mdl-rot-number') && !document.getElementById('mdl-rot-number').disabled, slider: !!document.getElementById('mdl-rot-number-slider') };
});

test('PS1 흐름 안 모달 — 머리 [슬라이드][IAL] · 정렬 6·X/Y = disabled(숨김 아님) + 툴팁 · 회전 씀', async ({ page }) => {
  const errs = await scene(page);
  const r = await posSec(page);
  expect(r, '[전제] Position 절').not.toBeNull();
  expect(r.head.filter((h) => h === 'mdl-rot-slide' || h === 'mdl-float-toggle'), '★머리 엔드슬롯 = 슬라이드 → IAL 순').toEqual(['mdl-rot-slide', 'mdl-float-toggle']);
  expect([r.align, r.alignDisabled], '★정렬 6 = 있음 · 전부 disabled(옛: 없음)').toEqual([6, 6]);
  expect([r.xy, r.xyDisabled], '★X/Y = 있음 · disabled').toEqual([[true, true], [true, true]]);
  expect(r.xTip, '★툴팁 = 흐름이라 못 씀 · IAL 켜면 씀').toMatch(/흐름/);
  expect(r.rot, '회전 칸은 씀').toBe(true);
  expect(errs).toEqual([]);
});

test('PS2 떠 있는 모달 — 정렬 6·X/Y 씀 · X/Y = offsetX/Y', async ({ page }) => {
  const errs = await scene(page);
  await page.click('#mdl-float-toggle');
  await expect.poll(() => posSec(page).then((r) => r && [r.align, r.alignDisabled, r.xyDisabled])).toEqual([6, 0, [false, false]]);
  const v = await page.evaluate(() => { const p = window.__mdls[0].closest('[data-overlay-block="true"]') || window.__mdls[0]; return [String(parseInt(p.dataset.offsetX) || 0), String(parseInt(p.dataset.offsetY) || 0), document.getElementById('mdl-x-number').value, document.getElementById('mdl-y-number').value]; });
  expect([v[2], v[3]], '★X/Y 칸 = offsetX/Y').toEqual([v[0], v[1]]);
  expect(errs).toEqual([]);
});

test('PS3 슬라이드 모드 — 머리 토글 = 슬라이더 줄 · 패널 설정(다른 모달도 켜진 채) · 다시 누르면 꺼짐', async ({ page }) => {
  const errs = await scene(page, 2);
  expect((await posSec(page)).slider, '[전제] 기본 = 숫자 칸만').toBe(false);
  await page.click('#mdl-rot-slide');
  await expect.poll(() => posSec(page).then((r) => r && [r.slider, r.rot])).toEqual([true, true]);
  expect(await page.evaluate(() => document.getElementById('mdl-rot-slide').getAttribute('aria-pressed')), '★토글 켜짐 표시').toBe('true');
  await page.evaluate(() => { window.deselectAll?.(); window.selectBlock?.(window.__mdls[1].id); window.showModalProperties?.(window.__mdls[1]); });
  await expect.poll(() => posSec(page).then((r) => r && r.slider), '★패널 설정 — 다른 모달도 슬라이더').toBe(true);
  await page.click('#mdl-rot-slide');
  await expect.poll(() => posSec(page).then((r) => r && r.slider), '★다시 누르면 꺼짐').toBe(false);
  expect(errs).toEqual([]);
});

test('PS4 슬라이더 30 → 옛 키 dataset.rotation · 숫자 칸 30 · ⌘Z 한 번 = 0', async ({ page }) => {
  const errs = await scene(page);
  const mid = await page.evaluate(() => window.__mdls[0].id);
  await page.click('#mdl-rot-slide');
  await page.waitForSelector('#mdl-rot-number-slider');
  await page.evaluate(() => { const s = document.getElementById('mdl-rot-number-slider'); s.value = '30'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(() => page.evaluate(() => [window.__mdls[0].dataset.rotation, document.getElementById('mdl-rot-number').value])).toEqual(['30', '30']);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.rotation || '0', mid), '★⌘Z 한 번 = 0(되돌리기는 블럭 DOM 을 새로 그린다 → id 로 다시 집는다)').toBe('0');
  expect(errs).toEqual([]);
});

/* ── P2 — 6-2 흐름 안 블럭 정렬·X/Y = disabled(숨김 아님)을 공용 floatPositionRowHTML 한 곳에서 → 소비자 전부 ── */
const KINDS = [
  ['shape', "window.addShapeBlock('rectangle')", '.shape-block', 'shape'],
  ['cert', 'window.addCertBlock()', '.cert-block', 'crt'],
  ['grid', 'window.addGridBlock()', '.grid-block', 'grd'],
  ['iconify', 'window.addIconifyBlock()', '.icon-block', 'icn'],
  ['comparison', 'window.addComparisonBlock()', '.comparison-block', 'cmp'],
  ['text', "window.addTextBlock('body')", '.text-block', 'txt'],
];
async function flowScene(page, add) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (add) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    (0, eval)(add);
  }, add);
  return errs;
}
const flowRead = (page, pfx) => page.evaluate((pfx) => {
  const x = document.getElementById(pfx + '-x-number'), y = document.getElementById(pfx + '-y-number');
  const al = [...document.querySelectorAll('#panel-right [data-float-align]')];
  return { xy: [!!x && x.disabled, !!y && y.disabled], tip: /흐름/.test((x && (x.title || x.closest('[title]')?.title)) || ''), align: [al.length, al.filter((b) => b.disabled).length] };
}, pfx);

for (const [name, add, , pfx] of KINDS) {
  test(`PS5 흐름 안 ${name} — X/Y·정렬 6 = 있음 + disabled + 툴팁(6-2)`, async ({ page }) => {
    const errs = await flowScene(page, add);
    await expect.poll(() => flowRead(page, pfx), `★${name} 흐름 = X/Y disabled · 정렬 6 disabled(옛: 없음 또는 씀)`).toEqual({ xy: [true, true], tip: true, align: [6, 6] });
    expect(errs).toEqual([]);
  });
}

test('PS6 흐름 안 에셋 — X/Y disabled + 툴팁 · 정렬 = 흐름용 가로 3칸(씀 · S1-4 그대로) · 부모 기준 6칸 없음', async ({ page }) => {
  const errs = await flowScene(page, "window.addAssetBlock('standard')");
  await expect.poll(() => flowRead(page, 'asset').then((r) => ({ xy: r.xy, tip: r.tip, six: r.align[0] }))).toEqual({ xy: [true, true], tip: true, six: 0 });
  expect(await page.evaluate(() => [...document.querySelectorAll('#asset-align-group [data-align]')].map((b) => b.disabled)), '★흐름용 3칸은 씀').toEqual([false, false, false]);
  expect(errs).toEqual([]);
});

/* ── P3 — 회전 소비자(vector · icon-circle · mockup): 머리 슬라이드 토글 · 켜면 슬라이더 줄(같은 숫자 칸) · 옛 회전 id 그대로 ── */
const ROT_KINDS = [
  ['vector', 'window.addVectorBlock(\'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>\', { w: 80, h: 80 })', 'vb', 'vb-rotate-deg'],
  ['icon-circle', 'window.addIconCircleBlock()', 'icb', 'icb-rot-number'],
  ['mockup', 'window.addMockupBlock()', 'mkp', 'mkp-rot-number'],
];
for (const [name, add, pfx, num] of ROT_KINDS) {
  test(`PS7 ${name} — 머리 슬라이드 토글 · 켜면 슬라이더 줄 → 옛 회전 칸(${num})`, async ({ page }) => {
    const errs = await flowScene(page, add);
    await expect.poll(() => page.evaluate((p) => !!document.getElementById(p + '-rot-slide'), pfx), `★${name} 머리 슬라이드 토글`).toBe(true);
    await page.evaluate(() => { try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {} });
    await page.click(`#${pfx}-rot-slide`);
    await expect.poll(() => page.evaluate((n) => [!!document.getElementById(n + '-slider'), !!document.getElementById(n)], num), '★슬라이더 줄 + 옛 숫자 칸').toEqual([true, true]);
    await page.evaluate((n) => { const s = document.getElementById(n + '-slider'); s.value = '20'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, num);
    await expect.poll(() => page.evaluate((n) => document.getElementById(n).value, num), '★슬라이더 → 숫자 칸').toBe('20');
    await page.evaluate(() => { try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {} });
    expect(errs).toEqual([]);
  });
}

/* ── P3b — shape · frame · iconify(90° 단추 4 그대로 · 지디 261124) · sticker 텍스트/아이콘: 슬라이더 → 옛 숫자 칸 → 옛 저장 키(dataset) ── */
const ROT_KINDS_B = [
  ['shape', "window.addShapeBlock('rectangle')", 'shape', 'shape-rot-num', 'shapeRotation'],
  ['frame', 'window.addFrameBlock()', 'ss', 'ss-rotate-deg', 'rotateDeg'],
  ['iconify', 'window.addIconifyBlock()', 'icn', 'icn-rot-number', 'rotation'],
  ['sticker-text', "window.addStickerBlock({ shape: 'text' })", 'stk-t', 'stk-t-rot-num', 'rotation'],
  ['sticker-icon', "window.addStickerBlock({ shape: 'icon' })", 'stk-icon', 'stk-icon-rot-num', 'rotation'],
];
for (const [name, add, pfx, num, key] of ROT_KINDS_B) {
  test(`PS8 ${name} — 머리 슬라이드 토글 · 슬라이더 20 → ${num} → dataset.${key}`, async ({ page }) => {
    const errs = await flowScene(page, add);
    await page.evaluate(() => { try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {} });
    await expect.poll(() => page.evaluate((p) => !!document.getElementById(p + '-rot-slide'), pfx), `★${name} 머리 슬라이드 토글`).toBe(true);
    expect(await page.evaluate((n) => !!document.getElementById(n + '-slider'), num), '끔 = 슬라이더 줄 0').toBe(false);
    await page.click(`#${pfx}-rot-slide`);
    await expect.poll(() => page.evaluate((n) => [!!document.getElementById(n + '-slider'), !!document.getElementById(n)], num), '★슬라이더 줄 + 옛 숫자 칸').toEqual([true, true]);
    await page.evaluate((n) => { const s = document.getElementById(n + '-slider'); s.value = '20'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); }, num);
    await expect.poll(() => page.evaluate((n) => document.getElementById(n)?.value, num), '★슬라이더 → 숫자 칸').toBe('20');
    await expect.poll(() => page.evaluate((k) => [...document.querySelectorAll('#canvas *')].some((e) => e.dataset && e.dataset[k] === '20'), key), `★옛 저장 키 dataset.${key} = 20`).toBe(true);
    await page.evaluate(() => { try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {} });
    expect(errs).toEqual([]);
  });
}
test('PS9 iconify — 90° 단추 4 그대로 · 단추 누르면 슬라이드 슬라이더도 따라간다', async ({ page }) => {
  const errs = await flowScene(page, 'window.addIconifyBlock()');
  await page.evaluate(() => { try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {} });
  await expect(page.locator('#icn-rot-slide')).toHaveCount(1);
  await page.click('#icn-rot-slide');
  await expect.poll(() => page.evaluate(() => [document.querySelectorAll('#icn-rotation-group [data-deg]').length, !!document.getElementById('icn-rot-number-slider')])).toEqual([4, true]);
  await page.click('#icn-rotation-group [data-deg="90"]');
  await expect.poll(() => page.evaluate(() => [document.getElementById('icn-rot-number').value, document.getElementById('icn-rot-number-slider').value])).toEqual(['90', '90']);
  await page.evaluate(() => { try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {} });
  expect(errs).toEqual([]);
});


/* ── 프레임 예외(현빈 261121 · 261124 14:13 (나)): 흐름 안에서도 X/Y «씀» = translate 덧 이동 · 6-2 disabled 는 다른 블럭만 ── */
test('PS10 흐름 안 프레임 — X/Y 씀(disabled 아님) · X 15 → dataset.translateX 15 · 옛 id ss-pos-x/y', async ({ page }) => {
  const errs = await flowScene(page, 'window.addFrameBlock()');
  await expect.poll(() => page.evaluate(() => ['ss-pos-x', 'ss-pos-y'].map((id) => document.getElementById(id)?.disabled))).toEqual([false, false]);
  await page.evaluate(() => { const x = document.getElementById('ss-pos-x'); x.value = '15'; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#canvas *')].some((e) => e.dataset && e.dataset.translateX === '15')), '★흐름 프레임 X = translate 덧 이동').toBe(true);
  expect(errs).toEqual([]);
});

/* ── zoom(지디 261124 ②): 슬라이드 모드가 옛 «회전 슬라이더 남김»의 뜻을 가져감 · 캔버스 회전 핫존 → 숫자 칸·슬라이더 동기 유지 ── */
test('PS11 zoom — 슬라이더 20 → zm-rot-num → dataset.rot · 캔버스 회전 핫존을 끌면 숫자 칸·슬라이더가 같은 값으로 따라온다', async ({ page }) => {
  const errs = await flowScene(page, 'window.addZoomBlock()');
  await page.evaluate(() => { try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {} });
  await expect(page.locator('#zm-rot-slide')).toHaveCount(1);
  await page.click('#zm-rot-slide');
  await expect(page.locator('#zm-rot-num-slider')).toHaveCount(1);
  await page.evaluate(() => { const s = document.getElementById('zm-rot-num-slider'); s.value = '20'; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect.poll(() => page.evaluate(() => [document.getElementById('zm-rot-num')?.value, [...document.querySelectorAll('#canvas *')].some((e) => e.dataset && e.dataset.rot === '20')])).toEqual(['20', true]);
  /* 핫존 끌기 — 좌표는 자리 굳은 뒤(waitStableRect 대신 rect 두 번 같을 때까지) */
  const h = page.locator('.zm-rotate-handle').first();
  await expect(h).toHaveCount(1);
  let prev = null;
  await expect.poll(async () => { const b = await h.boundingBox(); const same = prev && b && Math.abs(b.x - prev.x) < 0.5 && Math.abs(b.y - prev.y) < 0.5; prev = b; return !!same; }).toBe(true);
  const hb = await h.boundingBox();
  const c = await page.evaluate(() => { const z = [...document.querySelectorAll('#canvas *')].find((e) => e.dataset && e.dataset.rot === '20'); const r = z.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const sx = hb.x + hb.width / 2, sy = hb.y + hb.height / 2, rad = Math.hypot(sx - c.x, sy - c.y), a0 = Math.atan2(sy - c.y, sx - c.x);
  await page.mouse.move(sx, sy); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 4); await page.mouse.move(c.x + rad * Math.cos(a), c.y + rad * Math.sin(a)); }
  const v = await page.evaluate(() => [document.getElementById('zm-rot-num')?.value, document.getElementById('zm-rot-num-slider')?.value]);   // ★끄는 «동안»(놓기 전) — 놓은 뒤 패널 다시 그림이 덮어 주는 것과 가른다
  await page.mouse.up();
  expect(v[0], '★핫존이 회전을 바꿨다').not.toBe('20');
  expect(v[1], '★슬라이더가 숫자 칸과 같은 값으로 따라왔다').toBe(v[0]);
  await page.evaluate(() => { try { localStorage.removeItem('goditor.rotSlideMode'); } catch (_) {} });
  expect(errs).toEqual([]);
});
