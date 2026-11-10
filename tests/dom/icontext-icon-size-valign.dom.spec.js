/* icontext-icon-size-valign.dom.spec.js — ICONTEXT-ICON-SIZE-POSITION-01 (현빈 0.9.10 QA) ＋ ★ICONTEXT-VALIGN-SLIDER-01(현빈 261110 — 세로 맞춤 3단추 → 슬라이더).
 *   I1 패널: 「아이콘 크기」·「아이콘 세로」(prop-slider·prop-number · 간격 줄과 같은 폭) · 옛 3단추 없음
 *   I2 크기 80 → 아이콘 80×80 · ⌘Z 한 번 = 40
 *   I3 세로 오프셋: 0 = 글 가운데 · 슬라이더 왼끝 = 글 윗변 · 오른끝 = 글 아랫변 · ±3 은 가운데로 붙는다(자석)
 *   V1 슬라이더 끌기 한 번 = ⌘Z 한 번
 *   V2 ★옛 data-itb-valign top/bottom 블럭 — 열면 그대로 · 슬라이더를 «처음 만지는»(등가값 그대로 넣기) 순간 화면이 1:1(안 튐) · 속성이 dy 로 옮겨진다
 *   I4 「방향」 세로 — 세로 줄이 사라지고 오프셋은 안 먹는다(값은 남는다) · 가로로 돌아오면 다시 먹는다
 *   I5 저장 → 다시 열기 유지 · 저장 HTML 에 블럭 --itb-dy(그림은 CSS 규칙 · !important 없음 — h2c-svg-transform H7)
 * ★양성대조: block-factory.js setIconTextDy 를 늘 false 로 하면 I3·V1·V2·I5 빨강 · 템플릿 줄을 빼면 I1 빨강.
 * ⚠️Figma: icon-text 는 GENERIC 폴백(svg·글만 · 아이콘 자리 필드 없음)이라 옛 위·아래 맞춤도 안 실렸다 — 같은 꼴(이 검사 밖 · 보고에 적음). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sI"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60"></div></div>`;
async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  return page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sI'));
    window.addIconTextBlock();
    const b = document.querySelector('#sI .icon-text-block');
    window.updateIconTextBlock(b.id, { text: '첫 줄 글입니다 아주 길게 써서 여러 줄로 감기게 만든다 첫 줄 글입니다 아주 길게 써서 여러 줄로 감기게 만든다 첫 줄 글입니다 아주 길게 써서 여러 줄로' });
    b.style.width = '700px';
    window.clearHistory?.();
    return b.id;
  }, SEC).then(async (id) => {
    /* ★서체가 늦게 오면 글이 다시 감겨 높이가 바뀐다(실측 154↔205px) — 자리를 재는 칸이라 «다 온 뒤»에서 시작한다(고정 대기 0). */
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction((id) => { const t = document.querySelector(`#${id} .itb-text`); const h = t.offsetHeight; const ok = window.__itbH === h; window.__itbH = h; return ok; }, id, { polling: 'raf' });
    return id;
  });
}
async function selectItb(page, id) {
  await page.evaluate(() => window.deselectAll?.());
  const r = await waitStableRect(page, `#${id} .itb-text`); await page.mouse.click(r.cx, r.cy);
  await expect(page.locator('#itb-icon-size-number')).toHaveCount(1, { timeout: 3000 });
}
const geo = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), ic = b.querySelector('.itb-icon'), I = ic.getBoundingClientRect(), T = b.querySelector('.itb-text').getBoundingClientRect(), B = b.getBoundingClientRect();
  const r = Math.round;
  return { w: ic.offsetWidth, h: ic.offsetHeight,   // 캔버스 배율 무관 CSS px
    dTop: r(I.top - T.top), dBot: r(I.bottom - T.bottom), dMid: r((I.top + I.bottom) / 2 - (T.top + T.bottom) / 2), cx: r((I.left + I.right) / 2 - B.left), bw: r(B.width), valign: b.dataset.itbValign ?? null, dy: b.dataset.itbDy ?? null, top: I.top, z: I.height / (ic.offsetHeight || 1),
    mid: ((I.top + I.bottom) / 2 - (T.top + T.bottom) / 2) / (I.height / (ic.offsetHeight || 1)),   // 가운데 기준 아이콘 자리(레이아웃 px · 줌 무관)
    half: Math.max(0, (b.querySelector('.itb-text').offsetHeight - ic.offsetHeight) / 2) };
}, id);

test('I1 패널 — 아이콘 크기·세로 줄 · 기존 클래스·폭 · 옛 3단추 없음', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  const p = await page.evaluate(() => {
    const w = (sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().width ?? -1);
    return { sCls: document.getElementById('itb-icon-size-slider').className, nCls: document.getElementById('itb-icon-size-number').className,
      sameW: w('#itb-icon-size-slider') === w('#itb-gap-slider') && w('#itb-icon-size-number') === w('#itb-gap-number'),
      dyCls: [document.getElementById('itb-dy-slider')?.className, document.getElementById('itb-dy-number')?.className],
      dySameW: w('#itb-dy-slider') === w('#itb-gap-slider') && w('#itb-dy-number') === w('#itb-gap-number'),
      dyVal: document.getElementById('itb-dy-number')?.value, oldGroup: !!document.getElementById('itb-valign-group'), val: document.getElementById('itb-icon-size-number').value };
  });
  expect(p).toEqual({ sCls: 'prop-slider', nCls: 'prop-number', sameW: true, dyCls: ['prop-slider', 'prop-number'], dySameW: true, dyVal: '0', oldGroup: false, val: '40' });
});

test('I2 크기 80 → 80×80 · ⌘Z 한 번 = 40', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  await page.fill('#itb-icon-size-number', '80');
  await page.dispatchEvent('#itb-icon-size-number', 'change');
  await expect.poll(async () => { const g = await geo(page, id); return [g.w, g.h]; }).toEqual([80, 80]);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => { const g = await geo(page, id); return [g.w, g.h]; }).toEqual([40, 40]);
});

/* 슬라이더를 사람처럼: 값 넣고 input(끄는 중) → change(놓음) */
const slide = (page, v) => page.evaluate((v) => { const sl = document.getElementById('itb-dy-slider'); sl.value = String(v); sl.dispatchEvent(new Event('input', { bubbles: true })); sl.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const range = (page) => page.evaluate(() => { const sl = document.getElementById('itb-dy-slider'); sl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return [Number(sl.min), Number(sl.max)]; });   // 손 닿는 순간 다시 잰 끝

test('I3 세로 오프셋 — 0 = 글 가운데 · 왼끝 = 글 윗변 · 오른끝 = 글 아랫변 · ±3 자석', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  await expect.poll(async () => (await geo(page, id)).dTop, '[전제] 가운데 — 여러 줄이라 아이콘이 글 위보다 아래').toBeGreaterThan(10);
  expect(Math.abs((await geo(page, id)).dMid), '[전제] 가운데 = 글 가운데').toBeLessThanOrEqual(1);
  const [mn, mx] = await range(page);
  const half = (await geo(page, id)).half;
  expect([mn, mx], '끝 = ±max(60, 글 기준 빈 높이 절반)').toEqual([-Math.max(60, Math.ceil(half)), Math.max(60, Math.ceil(half))]);
  for (const v of [mn, -25, 25, mx]) {
    await slide(page, v);
    await expect.poll(async () => Math.abs((await geo(page, id)).mid - v), `${v} → 가운데에서 ${v}px`).toBeLessThanOrEqual(0.6);
  }
  if (half >= 60) {   // 빈 높이가 넉넉하면 끝 = 글 윗변·아랫변
    await slide(page, mn); expect(Math.abs((await geo(page, id)).mid + half), '왼끝 = 글 윗변').toBeLessThanOrEqual(1);
  }
  await slide(page, 2);
  await expect.poll(async () => (await geo(page, id)).dy, '±3 은 가운데로(속성 없음 = 옛 바이트)').toBe(null);
  expect(Math.abs((await geo(page, id)).dMid)).toBeLessThanOrEqual(1);
  expect(await page.evaluate((id) => document.querySelector(`#${id} .itb-icon`).getAttribute('style'), id), '가운데면 인라인 transform 도 없다').toBe(null);
});

test('V1 슬라이더 놓기 한 번 = ⌘Z 한 번', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  await slide(page, -20);
  await expect.poll(async () => (await geo(page, id)).dy).toBe('-20');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await geo(page, id)).dy, '⌘Z 한 번 = 가운데').toBe(null);
});

for (const old of ['top', 'bottom']) {
  test(`V2 ★옛 data-itb-valign=${old} — 열면 그대로 · 슬라이더 첫 손(등가값)에 1:1 · 속성이 dy 로 옮겨진다`, async ({ page }) => {
    const id = await setup(page);
    await page.evaluate(([id, old]) => { document.getElementById(id).dataset.itbValign = old; }, [id, old]);   // 옛 판 저장본과 같은 속성(3단추 시절)
    const g0 = await geo(page, id);
    expect(old === 'top' ? g0.dTop : g0.dBot, `[전제] 옛 ${old} = 글 ${old === 'top' ? '윗변' : '아랫변'}`).toBe(0);
    await selectItb(page, id);
    /* 손이 닿는 순간(pointerdown) 패널이 화면 자리를 다시 잰다 — 그 값에서 출발 = 첫 손 */
    const shown = await page.evaluate(() => { const sl = document.getElementById('itb-dy-slider'); sl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return Number(sl.value); });
    expect(shown, '패널은 그 자리의 등가 오프셋을 보인다(0 이 아니다)').not.toBe(0);
    expect((await geo(page, id)).valign, '패널을 여는 것만으론 안 바뀐다').toBe(old);
    const gA = await geo(page, id);   // ★바로 «앞» 자리(글은 패널 연 뒤에도 다시 감길 수 있다 — 비교는 첫 손 직전·직후)
    expect(old === 'top' ? gA.dTop : gA.dBot, '[전제] 첫 손 직전에도 옛 자리').toBe(0);
    await slide(page, shown);   // 첫 손 = 보이는 값 그대로
    await expect.poll(async () => (await geo(page, id)).valign, '옛 속성은 걷힌다').toBe(null);
    const g1 = await geo(page, id);
    expect(g1.dy, 'dy 로 옮겨졌다').toBe(String(shown));
    expect(Math.abs(g1.top - gA.top) / gA.z, `★안 튐 1:1 — 아이콘 윗변 차 ${g1.top - gA.top}`).toBeLessThanOrEqual(0.5);
  });
}

test('I4 방향 세로 — 세로 줄 없음 · 오프셋 안 먹음(값은 남음) · 가로로 돌아오면 다시 먹음', async ({ page }) => {
  const id = await setup(page);
  await selectItb(page, id);
  await slide(page, -30);
  await expect.poll(async () => Math.abs((await geo(page, id)).mid + 30)).toBeLessThanOrEqual(0.6);
  const mn = -30;
  await page.click('#itb-dir-group [data-dir="vertical"]');
  await expect(page.locator('#itb-dy-slider')).toHaveCount(0);
  const tr = await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .itb-icon`)).transform, id);
  expect(tr, '세로 방향에선 오프셋 안 먹음').toBe('none');
  const g = await geo(page, id);
  expect(Math.abs(g.cx - g.bw / 2), '세로 방향 기본 = 가운데').toBeLessThanOrEqual(1);
  expect(g.dy, '값은 남는다').toBe(String(mn));
  await page.click('#itb-dir-group [data-dir="horizontal"]');
  await expect(page.locator('#itb-dy-number')).toHaveValue(String(mn));
  await expect.poll(async () => Math.abs((await geo(page, id)).mid + 30), '가로로 돌아오면 다시 먹는다').toBeLessThanOrEqual(0.6);
});

test('I5 저장 → 다시 열기 유지 · 저장 HTML 에 --itb-dy', async ({ page }) => {
  const id = await setup(page);
  await page.evaluate((id) => { const b = document.getElementById(id); window.setIconTextIconSize(b, 64); window.setIconTextDy(b, 25); }, id);
  const before = await geo(page, id);
  const snap = await page.evaluate(() => window.serializeProject());
  expect(snap, '저장 HTML 에 블럭 CSS 변수 --itb-dy(오프셋의 정본 · 그림은 editor-extra.css 규칙)').toMatch(/--itb-dy:\s*25px/);
  await bootApp(page);
  await page.evaluate((d) => { document.getElementById('canvas').innerHTML = ''; window.applyProjectData(JSON.parse(d)); }, snap);
  await expect.poll(async () => { const g = await geo(page, id); return [g.w, g.h, g.dy, g.dMid]; }).toEqual([64, 64, '25', before.dMid]);
});

/* ★I6 PNG 내보내기(html2canvas 길 · h2c-svg-transform 과 같은 길) — 아이콘 세로 자리가 화면과 같다. 가로 방향 = 오프셋 실림 · 세로 방향 = 오프셋 안 먹음(I4) — 둘 다 화면 = PNG.
   아이콘을 빨강으로 칠해(검사만) 내보낸 그림의 빨강 윗변과 화면의 아이콘 윗변(섹션 기준 · 레이아웃 px)을 견준다. */
async function pngIconTop(page, id) {
  return page.evaluate(async (id) => {
    const ex = await import('/js/io/export-image.js');
    const b = document.getElementById(id), sec = b.closest('.section-block'), ic = b.querySelector('.itb-icon');
    const z = sec.getBoundingClientRect().width / sec.offsetWidth;
    const live = (ic.getBoundingClientRect().top - sec.getBoundingClientRect().top) / z;
    const w = sec.offsetWidth;
    const clone = await ex.prepareCloneForCapture(sec, w, false);
    const cv = (await ex.captureCloneToCanvas(clone, w, '#ffffff', false, sec)).canvas;   // { canvas, imgTimedOut, native }
    clone.remove?.();
    const k = cv.width / w, d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let y0 = 1e9, n = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60) { n++; if (y < y0) y0 = y; } }
    return { live: Math.round(live * 10) / 10, png: Math.round((y0 / k) * 10) / 10, n };
  }, id);
}
for (const dir of ['horizontal', 'vertical']) {
  test(`I6 PNG(html2canvas) — ${dir} · 오프셋 +30 · 아이콘 윗변 화면 = PNG`, async ({ page }) => {
    const id = await setup(page);
    await page.evaluate(([id, dir]) => { const b = document.getElementById(id); b.querySelector('.itb-icon').style.background = '#ff0000'; if (dir === 'vertical') window.setIconTextDirection?.(b, 'vertical'); window.setIconTextDy(b, 30); }, [id, dir]);
    await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
    const g = await geo(page, id);
    if (dir === 'horizontal') expect(Math.abs(g.mid - 30), '[전제] 화면에 +30').toBeLessThanOrEqual(0.6);
    else expect(await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .itb-icon`)).transform, id), '[전제] 세로 방향 = 오프셋 안 먹음(I4)').toBe('none');
    const p = await pngIconTop(page, id);
    console.log(`[I6 ${dir}] ` + JSON.stringify(p));
    expect(p.n, '[전제] PNG 에 빨간 아이콘').toBeGreaterThan(200);
    expect(Math.abs(p.png - p.live), `${dir} — PNG 아이콘 윗변 ${p.png} vs 화면 ${p.live}`).toBeLessThanOrEqual(1.5);
  });
}
