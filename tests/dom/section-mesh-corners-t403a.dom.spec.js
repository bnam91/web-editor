/* section-mesh-corners-t403a — t4-03 ㉠ 메시 «모서리 점»을 캔버스에서 바로 고친다 (설계서 T403A · 지디 승인 261109).
 *   점 = 그 겹의 중심 · 고른 점의 □ = 반지름 rx·ry · 더블클릭 = 색 · Delete = 그 모서리만 기본 · 스톱은 패널 막대.
 *   저장 = data-bg-mesh-geo(따로 둔 속성) · 모두 기본이면 속성 없음. 파서 왕복·옛 리더는 tests/unit/mesh-geo-t403a.
 * C1 모서리 넷을 하나씩 진짜 마우스로 끌면 그 겹만 바뀐다 · 패널 그 줄 강조 · 해제하면 점이 사라진다
 * C2 패널 → 점: 색 칸을 고치면 점 색이 따라오고, 패널 줄 hover = 점 hover
 * C3 □ 를 끌면 rx·ry 가 바뀐다
 * C4 줌 40% · 스크롤 뒤에도 점 중심이 기대 자리 ±1px
 * C5 끌기 한 번 = ⌘Z 한 걸음 (끌기 둘 = 두 걸음)
 * C6 저장 → 다시 열기: geo·그림 그대로 · 오버레이 0 · data-bg-mesh 무변
 * C7 Delete = 고른 모서리만 기본 · 섹션 안 지워짐 · 모두 기본이면 속성이 사라지고 CSS 가 옛 글자
 * C8 아래 두 점이 섹션 바닥 손잡이와 안 겹친다(점을 띠 위로 비켜 그림)
 * C9 메시를 끄는 네 길(배경색 · setSectionBg · 그라데이션 어댑터 · 메시 단추)이 geo 도 지운다
 * C10 틀린 geo 는 버리고 기본 모서리로 그린다(메시는 4겹 그대로)
 * 하네스 = _root-harness bootApp. ⛔waitForTimeout 금지.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const raf2 = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const MESH = '#ff0080|#7928ca|#00d4ff|#ffdd00';
const K = ['tl', 'tr', 'br', 'bl'];

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    for (let i = 0; i < 2; i++) await window.addSection();
    return [...c.querySelectorAll('.section-block')].map((s) => s.id);
  });
  await raf2(page);
  return { errs, A: ids[0], B: ids[1] };
}
async function pickSection(page, id) {
  await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  const b = await waitStableRect(page, '#' + id);
  await page.mouse.click(b.left + 8, b.cy);
  await page.waitForFunction((i) => document.getElementById(i)?.classList.contains('selected') && document.getElementById('sec-height-value')?.dataset.secId === i, id, { timeout: 8000 });
  await raf2(page);
}
/* 메시를 켠 섹션 = 패널 단추로(앱 길) */
async function meshOn(page, id) {
  await pickSection(page, id);
  await page.locator('#sec-bg-mesh').click();
  await expect.poll(() => page.locator('.mesh-corner-dot').count(), '점 넷').toBe(4);
  await raf2(page);
}
const geoOf = (page, id) => page.evaluate((i) => document.getElementById(i).dataset.bgMeshGeo ?? null, id);
const layers = (page, id) => page.evaluate((i) => document.getElementById(i).style.backgroundImage.split(/, (?=radial)/), id);
const dotPt = (page, k) => page.evaluate((k) => {
  const r = document.querySelector(`.mesh-corner-dot[data-mesh-corner="${k}"]`).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}, k);
const secPt = (page, id, fx, fy) => page.evaluate(([i, fx, fy]) => {
  const r = document.getElementById(i).getBoundingClientRect();
  return { x: r.left + r.width * fx, y: r.top + r.height * fy };
}, [id, fx, fy]);
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

test('C1 모서리 넷을 하나씩 끌면 그 겹만 바뀌고 패널 줄이 강조된다 · 해제하면 점이 사라진다', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  const TO = { tl: [0.4, 0.3], tr: [0.6, 0.35], br: [0.7, 0.6], bl: [0.25, 0.55] };
  for (const [n, k] of K.entries()) {
    const before = await layers(page, A);
    await drag(page, await dotPt(page, k), await secPt(page, A, ...TO[k]));
    const g = (await geoOf(page, A)).split('|')[n].split(' ').map(Number);
    expect(near(g[0], TO[k][0] * 100) && near(g[1], TO[k][1] * 100), `${k} geo = ${g}`).toBe(true);
    const after = await layers(page, A);
    after.forEach((l, j) => {
      if (j === n) expect(l, `${k} 겹이 바뀌었다`).toMatch(/^radial-gradient\(100% 100% at \d/);
      else expect(l, `${K[j]} 겹은 그대로`).toBe(before[j]);
    });
    expect(await page.evaluate((k) => document.querySelector(`.sec-mesh-stops[data-corner="${k}"]`).classList.contains('is-mesh-active'), k), `패널 ${k} 줄 강조`).toBe(true);
    expect(await page.evaluate((i) => document.getElementById(i).classList.contains('selected'), A), '섹션 선택 그대로').toBe(true);
  }
  await page.evaluate(() => window.deselectAll?.());
  await expect.poll(() => page.locator('.mesh-corner-overlay').count(), '해제 = 점 없음').toBe(0);
  expect(errs).toEqual([]);
});

test('C2 패널 색 칸 → 점 색 · 패널 줄 hover → 점 hover', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  await page.fill('#sec-mesh-tr-hex', '00FF00');
  await page.press('#sec-mesh-tr-hex', 'Enter');
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.mesh-corner-dot[data-mesh-corner="tr"]')).backgroundColor)).toBe('rgb(0, 255, 0)');
  await page.hover('.sec-mesh-stops[data-corner="bl"]');
  await expect.poll(() => page.evaluate(() => document.querySelector('.mesh-corner-dot[data-mesh-corner="bl"]').classList.contains('is-hover'))).toBe(true);
  expect(errs).toEqual([]);
});

test('C3 고른 점의 □ 를 끌면 반지름 rx·ry 가 바뀐다', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  await drag(page, await dotPt(page, 'tl'), await secPt(page, A, 0.3, 0.3));
  const rad = await page.evaluate(() => { const r = document.querySelector('.mesh-corner-rad').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const sr = await page.evaluate((i) => document.getElementById(i).getBoundingClientRect().toJSON(), A);
  await drag(page, rad, { x: rad.x - sr.width * 0.2, y: rad.y + sr.height * 0.1 });
  const g = (await geoOf(page, A)).split('|')[0].split(' ').map(Number);
  expect(g[2] < 100 && g[3] > 100, `rx 줄고 ry 늘었다 ${g}`).toBe(true);
  expect((await layers(page, A))[0]).toMatch(new RegExp(`^radial-gradient\\(${g[2]}% ${g[3]}% at ${g[0]}% ${g[1]}%`));
  expect(errs).toEqual([]);
});

test('C4 줌 40% · 스크롤 뒤에도 점 중심이 기대 자리 ±1px', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  await drag(page, await dotPt(page, 'tl'), await secPt(page, A, 0.4, 0.3));
  const at100 = await dotPt(page, 'tl');
  await page.evaluate(() => window.applyZoom(40));
  await page.evaluate(() => { const w = document.getElementById('canvas-wrap'); w.scrollTop += 37; w.scrollLeft += 11; });
  await page.waitForFunction(() => { const s = document.getElementById('canvas-scaler'); return Math.abs(s.getBoundingClientRect().width / s.offsetWidth - 0.4) < 0.001; });
  await raf2(page); await raf2(page);
  const g = (await geoOf(page, A)).split('|')[0].split(' ').map(Number);
  const exp = await secPt(page, A, g[0] / 100, g[1] / 100);
  const got = await dotPt(page, 'tl');
  expect(near(got.x, exp.x, 1) && near(got.y, exp.y, 1), `점 ${got.x},${got.y} · 기대 ${exp.x},${exp.y}`).toBe(true);
  expect(Math.hypot(got.x - at100.x, got.y - at100.y) > 5, '줌 뒤 다시 그렸다').toBe(true);
  expect(near(got.r.width, at100.r.width, 1.5), `점 크기 화면 px 그대로 ${got.r.width} vs ${at100.r.width}`).toBe(true);
  expect(errs).toEqual([]);
});

test('C5 끌기 한 번 = ⌘Z 한 걸음 (끌기 둘 = 두 걸음 · 메시는 켜진 채)', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  await drag(page, await dotPt(page, 'tl'), await secPt(page, A, 0.4, 0.3));
  const g1 = await geoOf(page, A);
  await drag(page, await dotPt(page, 'br'), await secPt(page, A, 0.7, 0.6));
  const g2 = await geoOf(page, A);
  expect(g2).not.toBe(g1);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => geoOf(page, A), '⌘Z 한 번 = 둘째 끌기 전').toBe(g1);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => geoOf(page, A), '⌘Z 두 번 = 첫 끌기 전(속성 없음)').toBe(null);
  expect(await page.evaluate((i) => document.getElementById(i).dataset.bgMesh, A), '메시는 켜진 채').toBeTruthy();
  expect(errs).toEqual([]);
});

test('C6 저장 → 다시 열기: geo 와 그림이 같고 오버레이는 0 · data-bg-mesh 는 무변', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  const spec0 = await page.evaluate((i) => document.getElementById(i).dataset.bgMesh, A);
  await drag(page, await dotPt(page, 'tl'), await secPt(page, A, 0.4, 0.3));
  const geo0 = await geoOf(page, A);
  const img0 = (await layers(page, A)).join(', ');
  const r = await page.evaluate(async (id) => {
    const html = String(window.getSerializedCanvas());
    const c = document.getElementById('canvas');
    c.innerHTML = html.replace(/style="[^"]*"/g, '');
    await window.rebindAll?.();
    const s = document.getElementById(id);
    return { html, geo: s.dataset.bgMeshGeo, mesh: s.dataset.bgMesh, img: s.style.backgroundImage };
  }, A);
  expect(r.html).toContain(`data-bg-mesh-geo="${geo0}"`);
  expect(r.html).toContain(`data-bg-mesh="${spec0}"`);
  expect(r.html.includes('mesh-corner'), '오버레이 클래스 0').toBe(false);
  expect(r.geo).toBe(geo0);
  expect(r.mesh).toBe(spec0);
  expect(r.img, '같은 그림').toBe(img0);
  expect(errs).toEqual([]);
});

test('C7 Delete = 고른 모서리만 기본 · 섹션 그대로 · 모두 기본이면 속성 없음 + 옛 CSS 글자', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  const img0 = (await layers(page, A)).join(', ');
  const n0 = await page.locator('#canvas .section-block').count();
  await drag(page, await dotPt(page, 'tl'), await secPt(page, A, 0.4, 0.3));
  await drag(page, await dotPt(page, 'tr'), await secPt(page, A, 0.6, 0.3));
  await page.keyboard.press('Delete');
  const g = await geoOf(page, A);
  expect(g.split('|')[1], '고른 TR 만 기본').toBe('100 0 100 100');
  expect(g.split('|')[0], 'TL 은 그대로').not.toBe('0 0 100 100');
  expect(await page.locator('#canvas .section-block').count(), '섹션 수 그대로').toBe(n0);
  await page.mouse.click((await dotPt(page, 'tl')).x, (await dotPt(page, 'tl')).y);
  await page.keyboard.press('Backspace');
  expect(await geoOf(page, A), '모두 기본 = 속성 없음').toBe(null);
  expect((await layers(page, A)).join(', '), '옛 CSS 글자 그대로').toBe(img0);
  expect(img0).toContain('farthest-side');
  expect(await page.locator('#canvas .section-block').count()).toBe(n0);
  expect(errs).toEqual([]);
});

test('C8 아래 두 점은 섹션 바닥 손잡이와 안 겹친다 — 겹치던 자리는 손잡이가 받는다', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  for (const k of ['bl', 'br']) {
    const r = await page.evaluate((k) => {
      const d = document.querySelector(`.mesh-corner-dot[data-mesh-corner="${k}"]`).getBoundingClientRect();
      const h = document.querySelector('.section-block.selected > .section-bottom-handle').getBoundingClientRect();
      const x = Math.max(h.left + 1, Math.min(h.right - 1, d.left + d.width / 2));
      const hit = document.elementFromPoint(x, h.top + h.height / 2);
      return { gap: h.top - d.bottom, hit: hit?.className || '', dot: d.toJSON(), handle: h.toJSON() };
    }, k);
    expect(r.gap >= 0, `${k} 점 아래 끝이 손잡이 띠 위 (gap ${r.gap}) ${JSON.stringify(r)}`).toBe(true);
    expect(r.hit, `${k} 점 아래 띠 = 손잡이`).toContain('section-bottom-handle');
  }
  expect(errs).toEqual([]);
});

test('C9 메시를 끄는 네 길이 geo 도 지운다 (지우기 전엔 있었다)', async ({ page }) => {
  const { errs, A } = await setup(page);
  const GEO = '40 30 100 100|100 0 100 100|100 100 100 100|0 100 100 100';
  const seed = () => page.evaluate(([i, m, g]) => { const s = document.getElementById(i); s.dataset.bgMesh = m; s.dataset.bgMeshGeo = g; window.applySectionBg(s); }, [A, MESH, GEO]);
  const paths = {
    panelColor: async () => { await pickSection(page, A); await page.fill('#sec-bg-hex', '123456'); await page.press('#sec-bg-hex', 'Enter'); },
    setSectionBg: () => page.evaluate((i) => window.setSectionBg(i, '#abcdef'), A),
    /* 어댑터는 메시가 켜져 있으면 안 잡힌다(get = '') ⇒ 그라데이션일 때 잡아 둔 바(옛 바)가 메시 뒤에 set 하는 길 */
    gradAdapter: () => page.evaluate((i) => window.__t403Grad.set('linear-gradient(90deg, #000000 0%, #ffffff 100%)', false), A),
    meshButtonOff: async () => { await pickSection(page, A); await page.locator('#sec-bg-mesh').click(); },
  };
  await page.evaluate((i) => { const s = document.getElementById(i); s.dataset.bg = 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)'; window.applySectionBg(s); window.__t403Grad = window.getGradientTarget(s); }, A);
  expect(await page.evaluate(() => !!window.__t403Grad), '전제: 그라데이션 어댑터를 잡았다').toBe(true);
  for (const [name, fn] of Object.entries(paths)) {
    await seed();
    expect(await geoOf(page, A), `${name}: 전에는 있었다`).toBe(GEO);
    await fn();
    await expect.poll(() => geoOf(page, A), `${name}: geo 지움`).toBe(null);
    expect(await page.evaluate((i) => document.getElementById(i).dataset.bgMesh ?? null, A), `${name}: 메시 꺼짐`).toBe(null);
  }
  /* 켤 때도 지운다(고아 geo) */
  await page.evaluate(([i, g]) => { document.getElementById(i).dataset.bgMeshGeo = g; }, [A, GEO]);
  await pickSection(page, A);
  await page.locator('#sec-bg-mesh').click();
  await expect.poll(() => geoOf(page, A), '켤 때도 고아 geo 지움').toBe(null);
  expect(errs).toEqual([]);
});

test('C10 틀린 geo 는 버리고 기본 모서리로 그린다 (메시는 4겹 그대로)', async ({ page }) => {
  const { errs, A } = await setup(page);
  await meshOn(page, A);
  const img0 = (await layers(page, A)).join(', ');
  for (const bad of ['abc', '150 0 100 100|100 0 100 100|100 100 100 100|0 100 100 100', '0 0 100 100|100 0 100 100|100 100 100 100']) {
    await page.evaluate(([i, g]) => { const s = document.getElementById(i); s.dataset.bgMeshGeo = g; window.applySectionBg(s); }, [A, bad]);
    expect((await layers(page, A)).join(', '), `틀린 geo ${bad} = 기본 그림`).toBe(img0);
  }
  /* 양성대조: 옳은 geo 는 그림을 바꾼다 */
  await page.evaluate((i) => { const s = document.getElementById(i); s.dataset.bgMeshGeo = '40 30 100 100|100 0 100 100|100 100 100 100|0 100 100 100'; window.applySectionBg(s); }, A);
  expect((await layers(page, A)).join(', ')).not.toBe(img0);
  expect(errs).toEqual([]);
});
