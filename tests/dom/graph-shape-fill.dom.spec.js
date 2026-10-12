/* graph-shape-fill.dom.spec.js — 1012t1G2 · G3 「SVG 를 그래프 모양으로」: 실루엣 막대 · 차오르는 채움 (태양 098-graph 2026-10-12)
 * 현빈 G2: 「특정 svg를 첨부하면 해당 막대그래프를 그것으로」(예: 강아지·사람 아웃라인) · G3: 「특정 svg를 넣으면 안에 차오르는 그래프」(애니메이션은 뒤에 — 지금은 정적 비율).
 * 고침: js/graph-shape.js(내장 실루엣 · 순수 식 · 소독 · setGraphShape · graphFillModel · 칸 HTML) · drag-utils.js bar-v 분기 앞의 덧 길(_renderGraphShape)
 *   · graph-limits.js 한계 넷 · editor-graph.css 마스크·채움 층 · prop-graph.js Shape 절.
 * 기하는 offsetHeight/offsetWidth(레이아웃 px — 배율과 무관). 픽셀은 요소 스크린샷을 페이지 캔버스로 풀어 «비율 좌표»로 읽는다.
 * 기다림은 전부 조건(waitForFunction · expect.poll · 로케이터 자동 대기) — 고정 대기 0.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-shape-fill.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

/* 판 세우기 — 빈 섹션(흰 바탕)에 세로 막대 그래프 하나(addGraphBlock = 사용자 삽입과 같은 입구). */
async function setup(page, { items = null, extra = {} } = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(({ items, extra }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1" style="background:#ffffff"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sG'); window.selectSection(S); window.addGraphBlock({ chartType: 'bar-v' });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    if (!g) return null;
    if (items) g.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) g.dataset[k] = v;
    if (items || Object.keys(extra).length) window.renderGraph(g);
    window.deselectAll?.();
    return g.id;
  }, { items, extra });
  expect(id, '전제: 그래프 블럭이 만들어졌다').toBeTruthy();
  expect(await ds(page, id, 'chartType'), '전제: 세로 막대다').toBe('bar-v');
  await raf2(page);
  return { errs, id };
}
const ds = (page, id, k) => page.evaluate(([id, k]) => document.getElementById(id).dataset[k] ?? null, [id, k]);
const setDs = (page, id, kv) => page.evaluate(([id, kv]) => { const b = document.getElementById(id); for (const [k, v] of Object.entries(kv)) { if (v == null) delete b.dataset[k]; else b.dataset[k] = typeof v === 'string' ? v : JSON.stringify(v); } window.renderGraph(b); }, [id, kv]);
const shape = (page, id, opts) => page.evaluate(([id, opts]) => window.setGraphShape(id, opts), [id, opts]);
const inner = (page, id) => page.evaluate((id) => document.getElementById(id).innerHTML, id);
const count = (page, id, sel) => page.evaluate(([id, sel]) => document.getElementById(id).querySelectorAll(sel).length, [id, sel]);
/* 상자·채움·트랙의 레이아웃 px(offset 계열) */
const geom = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-shape-box')].map(box => {
  const fill = box.querySelector('.grb-shape-fill'), track = box.querySelector('.grb-shape-track');
  return { boxH: box.offsetHeight, boxW: box.offsetWidth, fillH: fill ? fill.offsetHeight : null, fillAttr: fill ? fill.getAttribute('data-fill') : null,
    trackH: track ? track.offsetHeight : null, trackOp: track ? parseFloat(getComputedStyle(track).opacity) : null };
}), id);
const maskOf = (page, id, sel = '.grb-shape-mask') => page.evaluate(([id, sel]) => [...document.getElementById(id).querySelectorAll(sel)].map(m => { const c = getComputedStyle(m); return (c.maskImage && c.maskImage !== 'none') ? c.maskImage : (c.webkitMaskImage || 'none'); }), [id, sel]);
/* 요소 스크린샷의 «비율 좌표» 픽셀들 — PNG 를 페이지 캔버스로 풀어 읽는다(외부 디코더 0) */
async function pixels(page, locator, pts) {
  const b64 = (await locator.screenshot()).toString('base64');
  return page.evaluate(async ([b64, pts]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    return pts.map(([fx, fy]) => { const d = cx.getImageData(Math.min(cv.width - 1, Math.round(fx * (cv.width - 1))), Math.min(cv.height - 1, Math.round(fy * (cv.height - 1))), 1, 1).data; return [d[0], d[1], d[2]]; });
  }, [b64, pts]);
}
const rgbOf = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const close = (a, b, tol = 6) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

const V3 = [{ label: '가', value: 25 }, { label: '나', value: 50 }, { label: '다', value: 100 }];
const DIRTY = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="80" onload="window.__pwn=1">'
  + '<script>window.__pwn=2</script><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml" onclick="window.__pwn=3">x</div></foreignObject>'
  + '<image href="http://evil.example/a.png" width="10" height="10"/><a href="http://evil.example/"><rect x="0" y="0" width="40" height="80"/></a>'
  + '<use xlink:href="http://evil.example/x.svg#a"/><path d="M0 0H40V80H0Z" style="fill:url(http://evil.example/p)" onmouseover="window.__pwn=4"/></svg>';

test('B0 무변 — 키가 없으면 옛 세로 막대 그대로 · 모양을 켰다 끄면(키 삭제) 바이트가 같다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const n = (await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items).length, id));
  expect(n, '전제: 기본 항목이 있다').toBeGreaterThan(0);
  expect(await ds(page, id, 'barShape'), '전제: 모양 키 없음').toBeNull();
  const html0 = await inner(page, id);
  expect(await count(page, id, '.grb-shape-box'), '키 없음: 모양 상자 0').toBe(0);
  expect(await count(page, id, '.grb-bar-fill'), '키 없음: 막대 = 항목 수').toBe(n);
  expect(html0.includes('--grb-shape'), '키 없음: 마스크 변수 0').toBe(false);
  expect(await shape(page, id, { shape: 'person' })).toEqual({ ok: true, shape: 'person' });
  expect(await count(page, id, '.grb-shape-box'), '전제: 켜졌다(상자 = 항목 수)').toBe(n);
  expect(await inner(page, id), '전제: 켜진 동안은 바이트가 다르다').not.toBe(html0);
  expect(await shape(page, id, { shape: null })).toEqual({ ok: true, shape: null });
  expect(await page.evaluate((id) => Object.keys(document.getElementById(id).dataset).filter(k => /shape|fillMax|fillDir|trackColor|segGap/i.test(k)), id), '끄면 키를 지운다(빈 글자 0)').toEqual([]);
  expect(await inner(page, id), '껐다: 처음과 바이트 동일').toBe(html0);
  /* 빈 글자로 꺼도 같다 */
  await shape(page, id, { shape: 'drop' });
  expect(await shape(page, id, { shape: '' })).toEqual({ ok: true, shape: null });
  expect(await inner(page, id)).toBe(html0);
  /* 모르는 이름은 거절 · 무변 */
  expect(await shape(page, id, { shape: 'unicorn' })).toEqual({ ok: false, code: 'UNKNOWN_SHAPE' });
  expect(await inner(page, id)).toBe(html0);
  expect(errs).toEqual([]);
});

test('B1 소독 — script · on* · foreignObject · 외부 주소가 든 SVG 를 넣어도 저장되는 글자엔 넷 다 없다', async ({ page }) => {
  const { errs, id } = await setup(page, { items: V3 });
  for (const needle of ['<script', 'onload=', 'foreignObject', 'http://']) expect(DIRTY.includes(needle), `전제: 입력에 ${needle} 가 실제로 있다`).toBe(true);
  expect(await shape(page, id, { svg: DIRTY })).toEqual({ ok: true, shape: 'custom' });
  await raf2(page);
  const svg = await ds(page, id, 'shapeSvg');
  expect(typeof svg === 'string' && svg.startsWith('<svg'), '전제: 정규화된 글자가 실렸다').toBe(true);
  expect(await ds(page, id, 'barShape')).toBe('custom');
  for (const needle of ['<script', 'onload=', 'foreignObject', 'http://', 'https://', 'onclick', 'onmouseover', '<image', '<a ', 'xlink', 'evil.example', 'url(']) expect(svg.includes(needle), `저장 글자에 ${needle} 없음`).toBe(false);
  expect(svg, '크기는 width/height 에서 viewBox 로').toContain('viewBox="0 0 40 80"');
  expect(svg, '그리는 요소는 남는다(a 의 자식 · path)').toMatch(/<rect[^>]*width="40"[^>]*>/);
  expect(svg).toMatch(/<path d="M0 0H40V80H0Z"/);
  expect(await page.evaluate(() => window.__pwn), '스크립트는 한 줄도 안 돌았다').toBeUndefined();
  const blockHtml = await page.evaluate((id) => document.getElementById(id).outerHTML, id);
  for (const needle of ['<script', 'onload=', 'evil.example']) expect(blockHtml.includes(needle), `블럭 전체에도 ${needle} 없음`).toBe(false);
  /* 거절 꼴 — 무변 */
  const before = await page.evaluate((id) => JSON.stringify({ ...document.getElementById(id).dataset }), id);
  expect(await shape(page, id, { svg: '<div>not svg</div>' })).toEqual({ ok: false, code: 'NOT_SVG' });
  expect(await shape(page, id, { svg: '<svg><path d="M0 0H1V1Z"/></svg>' })).toEqual({ ok: false, code: 'NO_SIZE' });
  expect(await shape(page, id, { svg: '<svg viewBox="0 0 10 10"><script>1</script></svg>' })).toEqual({ ok: false, code: 'EMPTY' });
  expect(await page.evaluate((id) => JSON.stringify({ ...document.getElementById(id).dataset }), id), '거절은 dataset 을 안 건드린다').toBe(before);
  expect(errs).toEqual([]);
});

test('B2 마스크 — 계산된 mask-image 가 비 base64 data URI · 실루엣 안은 채움색, 상자 귀퉁이는 섹션 바탕', async ({ page }) => {
  const { errs, id } = await setup(page, { items: [{ label: '가', value: 100 }, { label: '나', value: 100 }] });
  await shape(page, id, { shape: 'person' });
  await raf2(page);
  const g = await geom(page, id);
  expect(g.length, '전제: 상자 2').toBe(2);
  expect(g[0].boxW, '전제: 상자에 폭이 있다').toBeGreaterThan(0);
  expect(g[0].boxH, '전제: 상자에 높이가 있다').toBeGreaterThan(0);
  expect(Math.abs(g[0].boxW / g[0].boxH - 76 / 240), '상자 비 = viewBox 비').toBeLessThan(0.02);
  const masks = await maskOf(page, id);
  expect(masks.length).toBe(2);
  for (const m of masks) { expect(m.startsWith('url("data:image/svg+xml,'), m.slice(0, 60)).toBe(true); expect(m.includes(';base64')).toBe(false); }
  /* 마스크 변수는 블럭 줄에 «한 번» — 항목이 사본을 공유한다 */
  expect(await page.evaluate((id) => { const g = document.getElementById(id); return [(g.innerHTML.match(/--grb-shape:/g) || []).length, g.querySelector('.grb-bars-v').style.getPropertyValue('--grb-shape').startsWith('url(')]; }, id)).toEqual([1, true]);
  const colors = await page.evaluate((id) => { const g = document.getElementById(id); return { fill: getComputedStyle(g.querySelector('.grb-shape-fill')).backgroundColor, sec: getComputedStyle(document.getElementById('sG')).backgroundColor }; }, id);
  const fillRgb = rgbOf(colors.fill), secRgb = rgbOf(colors.sec);
  expect(close(fillRgb, secRgb, 40), '전제: 채움색과 바탕색이 구별된다').toBe(false);
  /* 사람 실루엣(76×240): 머리 가운데 (0.5, 0.09) · 몸통 가운데 (0.5, 0.42) 는 안 · 왼쪽 위 귀퉁이 (0.03, 0.02) · 머리 옆 (0.95, 0.09) · 다리 사이 틈 아래 바깥 (0.03, 0.9) 은 밖 */
  const box = page.locator(`#${id} .grb-shape-box`).first();
  const px = await pixels(page, box, [[0.5, 0.09], [0.5, 0.42], [0.03, 0.02], [0.95, 0.09], [0.03, 0.9]]);
  expect(close(px[0], fillRgb), `머리 안 = 채움색: ${px[0]} vs ${fillRgb}`).toBe(true);
  expect(close(px[1], fillRgb), `몸통 안 = 채움색: ${px[1]} vs ${fillRgb}`).toBe(true);
  expect(close(px[2], secRgb), `귀퉁이 = 바탕: ${px[2]} vs ${secRgb}`).toBe(true);
  expect(close(px[3], secRgb), `머리 옆 = 바탕: ${px[3]} vs ${secRgb}`).toBe(true);
  expect(close(px[4], secRgb), `다리 바깥 = 바탕: ${px[4]} vs ${secRgb}`).toBe(true);
  expect(errs).toEqual([]);
});

test('B3 저장 왕복 — 소독기를 지나 다시 꽂아도 마스크·SVG 글자가 같고 · 저장 길목의 base64 정규식에 안 걸린다', async ({ page }) => {
  const { errs, id } = await setup(page, { items: V3 });
  expect(await shape(page, id, { svg: DIRTY })).toEqual({ ok: true, shape: 'custom' });
  await shape(page, id, { index: 1, shape: 'bottle' });
  await raf2(page);
  const m0 = await maskOf(page, id);
  expect(m0.length === 3 && m0.every(m => m.startsWith('url("data:image/svg+xml,')), '전제: 마스크 셋이 섰다').toBe(true);
  expect(m0[1], '전제: 1번 칸은 다른 모양').not.toBe(m0[0]);
  const r = await page.evaluate((id) => {
    const g = document.getElementById(id); const row = g.parentElement;
    const before = { inner: g.innerHTML, svg: g.dataset.shapeSvg, items: g.dataset.items };
    const raw = row.outerHTML;
    const html = window.sanitizeCanvasHtml(raw);
    const saved = window.getSerializedCanvas();
    row.insertAdjacentHTML('afterend', html); row.remove(); window.rebindAll?.();
    const n = document.getElementById(id);
    const RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*/g;   // js/io/asset-externalize.js DATA_URI_RE 와 같은 식
    const same = n.innerHTML === before.inner;
    window.renderGraph(n);
    return { sanitizedSame: html === raw, kept: same, svg: n.dataset.shapeSvg === before.svg, items: n.dataset.items === before.items, rerender: n.innerHTML === before.inner,
      reHit: (raw.match(RE) || []).length, reHitSaved: (saved.match(RE) || []).length, inSaved: saved.includes('--grb-shape:') && saved.includes('data-bar-shape="custom"'), hasData: raw.includes('data:image/svg+xml,') };
  }, id);
  expect(r).toEqual({ sanitizedSame: true, kept: true, svg: true, items: true, rerender: true, reHit: 0, reHitSaved: 0, inSaved: true, hasData: true });
  await raf2(page);
  expect(await maskOf(page, id), '다시 꽂은 뒤 계산된 마스크가 같다').toEqual(m0);
  expect(errs).toEqual([]);
});

test('B4 한도 — 정규화 글자가 SHAPE_SVG_MAX 를 한 자 넘으면 TOO_LARGE(무변) · 정확히 한도는 통과', async ({ page }) => {
  const { errs, id } = await setup(page, { items: V3 });
  const r = await page.evaluate((id) => {
    const MAX = window.GRAPH_LIMITS.SHAPE_SVG_MAX, GS = window.GRAPH_SHAPE;
    const mk = (k) => '<svg viewBox="0 0 10 10"><path id="' + 'a'.repeat(k) + '" d="M0 0H10V10H0Z"/></svg>';
    const base = GS.sanitizeShapeSvg(mk(1));
    const k = MAX - base.svg.length + 1;
    const exact = GS.sanitizeShapeSvg(mk(k)), over = GS.sanitizeShapeSvg(mk(k + 1));
    const g = document.getElementById(id);
    const snap = () => JSON.stringify({ ...g.dataset }) + g.innerHTML;
    const s0 = snap();
    const rOver = window.setGraphShape(id, { svg: mk(k + 1) });
    const unchanged = snap() === s0;
    const rExact = window.setGraphShape(id, { svg: mk(k) });
    return { MAX, baseOk: base.ok, exactLen: exact.ok ? exact.svg.length : -1, over, rOver, unchanged, rExact, stored: (g.dataset.shapeSvg || '').length, boxes: g.querySelectorAll('.grb-shape-box.grb-shape-on').length };
  }, id);
  expect(r.MAX, '전제: 한도 상수가 있다').toBeGreaterThan(1000);
  expect(r.baseOk, '전제: 기본 꼴은 통과한다').toBe(true);
  expect(r.exactLen, '전제: 길이를 정확히 한도에 맞췄다').toBe(r.MAX);
  expect(r.over).toEqual({ ok: false, code: 'TOO_LARGE' });
  expect(r.rOver).toEqual({ ok: false, code: 'TOO_LARGE' });
  expect(r.unchanged, '거절은 dataset·그림을 안 건드린다').toBe(true);
  expect(r.rExact).toEqual({ ok: true, shape: 'custom' });
  expect(r.stored).toBe(r.MAX);
  expect(r.boxes, '한도 글자로도 그려진다').toBe(3);
  expect(errs).toEqual([]);
});
