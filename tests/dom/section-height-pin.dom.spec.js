/* section-height-pin.dom.spec.js — 0.9.12 ⑦ 섹션 높이 핀 (현빈 Q10·Q13 «추천대로» · 2026-11-12)
 *   결정: 편집 화면에서도 고정 높이(WYSIWYG) · 넘친 블럭은 프레임 안처럼 아래로 쌓여 잘린다 ·
 *         안전장치 「숨은 블럭 N개 [전체 보기] [핀 해제]」 · ⓐ 일부라도 잘린 것 포함 · ⓑ 선택 풀리면 전체 보기 끔 ·
 *         ⓒ 해제 후 minHeight=핀값 · ⓓ 손잡이 더블클릭 = 내용 높이에 맞춤 · ⓔ 배지 safe 정렬 · ⓕ Figma 섹션 바닥에서만 자름
 *
 *   P1 ★자르기·쌓기 — 높이 300 고정 · inner overflow-y clip · 갭 50 그대로(안 줄어듦) · 숨은 블럭이 안 그려진다 · 다음 섹션이 안 밀린다
 *   P2 ★넘침 갱신 — 섹션 크기가 그대로인 채 글이 늘면 배지 「숨은 블럭 N」이 따라 는다
 *   P3 ★전체 보기 — 다 보이고 · 높이 수는 핀 값 · 저장본·PNG 에 pin-peek 없음 · 선택 풀리면 꺼지고 · 선택 중이면 남는다
 *   P4 핀 해제 — height 지움 · minHeight=핀값 · 내용만큼 늘어남 · 기록 1
 *   P5 ★바닥 손잡이 — 내용 밑으로 줄임 · 하한 아래패딩+20 · 취소 복원 · 더블클릭 = 내용에 맞춤 · 기록 각 1
 *   P6 드롭 기준 — 보이는 끝 아래로 끌면 «첫 숨은 자식 앞» (undefined = 맨 끝 append 가 아님)
 *   P7 ★상자선택 — 완전히 숨은 블럭을 안 고른다
 *   P8 레이어 클릭 — 숨은 블럭이면 전체 보기를 켜고 고른다(선택 중이라 안 꺼진다)
 *   P9 ★PNG(native) — 높이 300 · 숨은 표식(#ff00aa) 0 픽셀 · 전체 보기 중에도 · 780 도 / 잣대 양성대조: 핀 풀면 표식 > 0
 *   P10 PNG(html2canvas 길 = 웹·썸네일 엔진) — 같은 단언
 *   P11 단독 HTML — 핀 속성·자르기 규칙이 실리고 pin-peek 은 없다
 *   P12 Figma JSON — heightPin 300 · 핀 아닌 섹션 0
 *   P13 섹션 합치기 — 핀 섹션을 합쳐도 part 에 고정높이가 안 옮겨진다
 *   P14 ★합치기→분리 왕복 — 핀이 되살아난다(r1 ①)
 *   R1 ★저장→닫기→다시 열기 — 새 앱 인스턴스에 저장본을 실어도 핀·자르기·숨은 수가 그대로 · pin-peek 은 안 실림
 *   R2 ⌘Z — 핀 켜기 한 번이 ⌘Z 한 번으로 풀린다
 *   U1 ★우측 패널 — 📌 켬/끔 · 「숨은 블럭 N개」 줄은 N>0 때만 · 전체 보기/핀 해제 버튼 · 새 prop-hint 0
 *
 * ★양성대조(고침 한 줄씩 되돌리면 빨강 · 기대):
 *   css/editor-layout.css 핀 규칙 6줄 삭제 → P1(overflow·갭)·P9·P10·R1 빨강 / flex-shrink 줄만 → P1 갭 빨강
 *   js/section-pin.js watch() 몸 비움 → P2 빨강
 *   section-serialize RUNTIME_MARKER_CLS 'pin-peek' 줄 → P3 저장본·R1 빨강 / capture-safety 줄 → P3 PNG·P9 전체보기 칸 빨강
 *   section-bottom-handle.js 핀 분기 → P5 빨강 · section-drag.js 핀 분기 → P6 빨강 · scratch-pad.js visibleRect → P7 빨강
 *   layer-panel-items.js revealFor 줄 → P8 빨강 · export-figma-json heightPin → P12 빨강 · section-merge.js height 줄 → P13 빨강
 *   prop-section.js 📌·줄 → U1 빨강
 * 실행: NODE_PRESERVE_SYMLINKS=1 node --preserve-symlinks-main node_modules/@playwright/test/cli.js test \
 *        --config=tests/dom/playwright.dom.config.js --retries=0 --workers=1 tests/dom/section-height-pin.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const LONG = '고디터 섹션 높이 고정 검사용 본문입니다. 줄이 여러 개가 되도록 길게 씁니다. '.repeat(3);
const SECS = `
<div class="section-block" id="pS" data-section="1" data-name="P" style="background:#ffffff;height:300px" data-height-pin="true">
  <div class="section-hitzone"><span class="section-label">P</span></div>
  <div class="section-inner">
    <div class="gap-block" data-type="gap" id="pGap" style="height:50px"></div>
    <div class="row" id="pRow1"><div class="text-block" id="pT1"><p style="margin:0;font-size:16px;line-height:1.5">${LONG}</p></div></div>
    <div class="row" id="pRowA"><div class="text-block" id="pA" style="height:150px;background:#33aa77"><p style="margin:0">보이는 칸</p></div></div>
    <div class="row" id="pRowH"><div class="text-block" id="pH" data-layer-name="HIDDEN" style="height:120px;background:#ff00aa"><p style="margin:0">숨은 칸</p></div></div>
    <div class="row" id="pRowT"><div class="text-block" id="pT2"><p style="margin:0">숨은 글</p></div></div>
  </div>
</div>
<div class="section-block" id="nS" data-section="2" data-name="N" style="background:#eeeeee">
  <div class="section-hitzone"><span class="section-label">N</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" style="height:1200px"></div></div>
</div>`;

const frames = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
const badgeReady = (page) => page.waitForFunction(() => !!document.querySelector('#pS > .section-hitzone > .section-height-badge')?.dataset.h?.includes('📌'));

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('pS').scrollIntoView({ block: 'start' });
    window.__push = 0; const op = window.pushHistory; window.pushHistory = function () { window.__push++; return op?.apply(this, arguments); };
  }, SECS);
  await badgeReady(page);
  await page.evaluate(() => { const wrap = document.getElementById('canvas-wrap');
    wrap.scrollLeft += document.getElementById('canvas').getBoundingClientRect().left - (wrap.getBoundingClientRect().left + 200); });
  await frames(page);
  return errs;
}

/* 실앱 PNG = main.js 'capture-section-cdp' 흉내(checker-asset-tone 과 같은 손) */
async function installCdpCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height }) =>
    (await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: 1 }, captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => {
    const old = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : old[k]) });
  });
}
/* PNG dataURL → { w, h, mark = #ff00aa(±20) 픽셀 수 } */
const PNG_STAT = `async (u) => { const im = new Image(); im.src = u; await im.decode();
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let mark = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 255) <= 20 && d[i + 1] <= 20 && Math.abs(d[i + 2] - 170) <= 20) mark++;
  return { w: c.width, h: c.height, mark }; }`;

const geo = (page) => page.evaluate(() => {
  const P = window.sectionPin, sec = document.getElementById('pS'), inner = sec.querySelector(':scope > .section-inner');
  const pH = document.getElementById('pH').getBoundingClientRect();
  return { h: sec.offsetHeight, ov: getComputedStyle(inner).overflowY, innerBottom: inner.getBoundingClientRect().bottom, cut: P.cutY(sec),
    gapH: document.getElementById('pGap').offsetHeight, pHtop: pH.top, hidden: P.hiddenBlocks(sec).map(b => b.id),
    nextTop: document.getElementById('nS').getBoundingClientRect().top, secBottom: sec.getBoundingClientRect().bottom,
    peek: sec.classList.contains('pin-peek'), measure: window.measureSectionHeight(sec), natural: P.naturalHeight(sec) };
});
const badge = (page) => page.evaluate(() => { const b = document.querySelector('#pS > .section-hitzone > .section-height-badge'); return b ? { h: b.dataset.h, red: b.hasAttribute('data-pin-hidden') } : null; });

test('P1 ★자르기·쌓기 — 300 고정 · inner clip · 갭 안 줄어듦 · 숨은 블럭 안 그려짐 · 다음 섹션 안 밀림', async ({ page }) => {
  const errs = await setup(page);
  const g = await geo(page);
  console.log('  P1:', JSON.stringify(g));
  expect(g.natural, '★전제 — 내용이 핀보다 커야 한다').toBeGreaterThan(400);
  expect(g.h).toBe(300);
  expect(g.ov, 'inner 가 세로로 안 자른다').toBe('clip');
  expect(Math.abs(g.innerBottom - g.cut), 'inner 바닥 = 자르는 선').toBeLessThanOrEqual(1);
  expect(g.gapH, '★갭이 줄었다(flex-shrink) — 쌓이다 잘리는 게 아니라 찌그러진다').toBe(50);
  expect(g.pHtop, '★전제 — 표식 칸이 완전히 숨는 자리').toBeGreaterThanOrEqual(g.cut);
  expect(g.hidden).toEqual(expect.arrayContaining(['pH', 'pT2']));
  expect(Math.abs(g.nextTop - g.secBottom), '다음 섹션이 숨은 내용에 밀렸다').toBeLessThanOrEqual(1);
  const paint = await page.evaluate(() => { const r = document.getElementById('pH').getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2; const el = document.elementFromPoint(x, y);
    return { inView: y > 0 && y < innerHeight && x > 0 && x < innerWidth, hitsHidden: !!el && document.getElementById('pH').contains(el) }; });
  expect(paint.inView, '★전제 — 숨은 칸 자리가 화면 안').toBe(true);
  expect(paint.hitsHidden, '숨은 칸이 그 자리에서 잡힌다(안 잘렸다)').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P2 ★넘침 갱신 — 섹션 크기 그대로, 글이 늘면 배지 숨은 수가 는다', async ({ page }) => {
  const errs = await setup(page);
  const n0 = (await geo(page)).hidden.length;
  const b0 = await badge(page);
  expect(b0 && b0.h, '배지').toContain('📌 · 숨은 블럭 ' + n0);
  expect(b0.red).toBe(true);
  await page.evaluate(() => { document.querySelector('#pT1 p').textContent += ' 더'.repeat(400); });
  await expect.poll(async () => (await badge(page)).h, { timeout: 2000 }).not.toBe(b0.h);
  const g = await geo(page);
  expect(g.h, '섹션 높이는 그대로').toBe(300);
  expect(g.hidden.length, '★전제 — 숨은 수가 실제로 늘었다').toBeGreaterThan(n0);
  expect((await badge(page)).h).toContain('숨은 블럭 ' + g.hidden.length);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P3 ★전체 보기 — 다 보임 · 높이 수=핀 · 저장본·PNG 에 안 남음 · 선택 풀리면 꺼짐', async ({ page }) => {
  const errs = await setup(page);
  await installCdpCapture(page);
  await page.evaluate(() => window.sectionPin.peek(document.getElementById('pS'), true));
  const g = await geo(page);
  expect(g.peek).toBe(true);
  expect(g.h, '전체 보기인데 안 늘어났다').toBeGreaterThan(300);
  expect(g.measure, '높이 수는 핀 값').toBe(300);
  const r = await page.evaluate(async (STAT) => {
    const s = window.getSerializedCanvas();
    const png = await eval(STAT)(await window.exportSection(document.getElementById('pS'), 'png', 860, { returnDataUrl: true }));
    return { savedPeek: /pin-peek/.test(s), savedPin: /data-height-pin="true"/.test(s), png, stillPeek: document.getElementById('pS').classList.contains('pin-peek') };
  }, PNG_STAT);
  expect(r.savedPin).toBe(true);
  expect(r.savedPeek, '저장본(=히스토리 스냅샷)에 pin-peek').toBe(false);
  expect(r.png.h, '전체 보기 중 PNG 높이').toBe(300);
  expect(r.png.mark, '전체 보기 중 PNG 에 숨은 칸이 찍혔다').toBe(0);
  expect(r.stillPeek, '내보내기가 화면 상태를 바꿨다').toBe(true);
  /* ⓑ 선택 중이면 남고, 선택이 풀리면 꺼진다 */
  await page.evaluate(() => document.getElementById('pS').classList.add('selected'));
  const peekAfterClick = (fn) => page.evaluate(async (src) => { eval(src)(); document.body.click();
    await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));   // sweepPeek 은 click «뒤» 한 틱
    return document.getElementById('pS').classList.contains('pin-peek'); }, fn);
  expect(await peekAfterClick('() => {}'), '선택 중인데 꺼졌다').toBe(true);
  expect(await peekAfterClick("() => { window.deselectAll?.(); document.getElementById('pS').classList.remove('selected'); }"), '선택이 풀렸는데 안 꺼졌다').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P4 핀 해제 — height 지움 · minHeight=핀값 · 내용만큼 늘어남 · 기록 1', async ({ page }) => {
  const errs = await setup(page);
  const nat = (await geo(page)).natural;
  const r = await page.evaluate(() => { const sec = document.getElementById('pS'); window.__push = 0; window.sectionPin.unpin(sec);
    return { height: sec.style.height, min: sec.style.minHeight, pin: sec.dataset.heightPin ?? null, h: sec.offsetHeight, push: window.__push }; });
  expect(r).toEqual({ height: '', min: '300px', pin: null, h: nat, push: 1 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P5 ★바닥 손잡이 — 내용 밑으로 줄임 · 하한 · 취소 복원 · 더블클릭 = 내용 높이 · 기록 각 1', async ({ page }) => {
  const errs = await setup(page);
  await page.waitForFunction(() => !!document.querySelector('#pS > .section-bottom-handle'));
  const r = await page.evaluate(() => {
    const sec = document.getElementById('pS'), h = sec.querySelector(':scope > .section-bottom-handle');
    const k = sec.getBoundingClientRect().width / sec.offsetWidth;
    const y0 = h.getBoundingClientRect().top + 2;
    const drag = (dyModel, end) => { window.__push = 0;
      h.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientY: y0, bubbles: true, cancelable: true }));
      document.dispatchEvent(new PointerEvent('pointermove', { clientY: y0 + dyModel * k, bubbles: true }));
      document.dispatchEvent(new PointerEvent(end, { clientY: y0 + dyModel * k, bubbles: true }));
      return { height: sec.style.height, push: window.__push }; };
    const out = {};
    out.shrink = drag(-100, 'pointerup');                       // 300 → 200 (내용 밑)
    out.floor = drag(-5000, 'pointerup');                       // 하한
    out.floorWant = (parseFloat(getComputedStyle(sec).paddingBottom) || 0) + 20;
    sec.style.height = '300px';
    out.cancel = drag(+250, 'pointercancel');                   // 취소 → 300 그대로 · 기록 0
    window.__push = 0;
    h.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    out.dbl = { height: sec.style.height, push: window.__push, nat: window.sectionPin.naturalHeight(sec), pin: sec.dataset.heightPin };
    return out;
  });
  console.log('  P5:', JSON.stringify(r));
  expect(r.shrink).toEqual({ height: '200px', push: 1 });
  expect(r.floor).toEqual({ height: r.floorWant + 'px', push: 1 });
  expect(r.cancel).toEqual({ height: '300px', push: 0 });
  expect(r.dbl.height, '더블클릭 = 내용 높이').toBe(r.dbl.nat + 'px');
  expect(r.dbl.pin, '핀 유지').toBe('true');
  expect(r.dbl.push).toBe(1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P6 드롭 기준 — 보이는 끝 아래로 끌면 첫 숨은 자식 앞', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('pS'), inner = sec.querySelector(':scope > .section-inner');
    const cut = window.sectionPin.cutY(sec);
    const kids = [...inner.children];
    const firstHidden = kids.find(c => c.getBoundingClientRect().top >= cut);
    const below = window.getDragAfterElement(inner, cut + 40);
    const aTop = document.getElementById('pRowA').getBoundingClientRect().top;
    const inVis = window.getDragAfterElement(inner, aTop + 1);
    return { firstHidden: firstHidden?.id, below: below?.id ?? null, inVis: inVis?.id ?? null };
  });
  expect(r.firstHidden, '★전제').toBeTruthy();
  expect(r.below, '보이는 끝 아래 — 맨 끝(append)으로 빠진다').toBe(r.firstHidden);
  expect(r.inVis, '보이는 자리 안은 평소대로').toBe('pRowA');
  expect(errs, errs.join('\n')).toEqual([]);
});

/* model(캔버스) 좌표 ↔ 화면 — marquee-sections-blocks 와 같은 손 */
const toScreen = (page, mx, my) => page.evaluate(([mx, my]) => {
  const sc = document.getElementById('canvas-scaler'); const r = sc.getBoundingClientRect();
  const m = sc.style.transform?.match(/scale\(([^)]+)\)/); const k = m ? parseFloat(m[1]) : 1;
  const c = document.getElementById('canvas').getBoundingClientRect();
  return [r.left + mx * k, r.top + my * k, (c.left - r.left) / k, (c.top - r.top) / k, k];
}, [mx, my]);

test('P7 ★상자선택 — 완전히 숨은 블럭을 안 고른다', async ({ page }) => {
  const errs = await setup(page);
  const box = await page.evaluate(() => { const sc = document.getElementById('canvas-scaler').getBoundingClientRect();
    const m = document.getElementById('canvas-scaler').style.transform?.match(/scale\(([^)]+)\)/); const k = m ? parseFloat(m[1]) : 1;
    const r = document.getElementById('pH').getBoundingClientRect(); return { top: (r.top - sc.top) / k, bottom: (r.bottom - sc.top) / k, right: (r.right - sc.left) / k }; });
  const [, , cx0] = await toScreen(page, 0, 0);
  const sx = cx0 - 60;
  const [x0, y0] = await toScreen(page, sx, box.top - 8);
  const [x1, y1] = await toScreen(page, box.right + 10, box.bottom + 8);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10);
  const during = await page.evaluate(() => ({ box: document.querySelectorAll('.scratch-marquee').length, hit: [...document.querySelectorAll('#canvas .marquee-hit')].map(e => e.id) }));
  await page.mouse.up(); await frames(page);
  const selected = await page.evaluate(() => [...document.querySelectorAll('#canvas .selected, #canvas .multi-selected')].map(e => e.id));
  console.log('  P7:', JSON.stringify({ during, selected }));
  expect(during.box, '★전제 — 상자가 떴다').toBe(1);
  expect(during.hit).not.toContain('pH');
  expect(selected).not.toContain('pH');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P8 레이어 클릭 — 숨은 블럭이면 전체 보기 켜고 고른다(그대로 남는다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    window.buildLayerPanel?.();
    const item = [...document.querySelectorAll('.layer-item')].find(i => i.getAttribute('aria-label') === 'HIDDEN 레이어');
    if (!item) return { found: false };
    item.click();
    await new Promise(r => setTimeout(r, 60));
    return { found: true, peek: document.getElementById('pS').classList.contains('pin-peek'), sel: document.getElementById('pH').classList.contains('selected') };
  });
  expect(r.found, '★전제 — 레이어 항목').toBe(true);
  expect(r.sel).toBe(true);
  expect(r.peek, '숨은 블럭을 골랐는데 안 보인다').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P9 ★PNG(native) — 높이 300 · 숨은 표식 0 · 780 도 / 잣대: 핀 풀면 표식이 찍힌다', async ({ page }) => {
  const errs = await setup(page);
  await installCdpCapture(page);
  const r = await page.evaluate(async (STAT) => { const st = eval(STAT), sec = document.getElementById('pS');
    const a = await st(await window.exportSection(sec, 'png', 860, { returnDataUrl: true }));
    const b = await st(await window.exportSection(sec, 'png', 780, { returnDataUrl: true }));
    window.sectionPin.unpin(sec);
    const c = await st(await window.exportSection(sec, 'png', 860, { returnDataUrl: true }));
    return { a, b, c }; }, PNG_STAT);
  console.log('  P9:', JSON.stringify(r));
  expect(r.c.mark, '★잣대 — 핀 풀면 표식이 PNG 에 있어야 한다').toBeGreaterThan(5000);
  expect(r.a).toMatchObject({ w: 860, h: 300, mark: 0 });
  expect(r.b).toMatchObject({ w: 780, h: 300, mark: 0 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P10 PNG(html2canvas 길 — 웹 PNG·썸네일 엔진) — 높이 300 · 숨은 표식 0', async ({ page }) => {
  const errs = await setup(page);
  await page.waitForFunction(() => typeof window.html2canvas === 'function');
  const r = await page.evaluate(async (STAT) => { const st = eval(STAT), sec = document.getElementById('pS');
    const a = await st(await window.exportSection(sec, 'png', 860, { returnDataUrl: true, forceH2C: true }));
    window.sectionPin.unpin(sec);
    const c = await st(await window.exportSection(sec, 'png', 860, { returnDataUrl: true, forceH2C: true }));
    return { a, c }; }, PNG_STAT);
  console.log('  P10:', JSON.stringify(r));
  expect(r.c.mark, '★잣대 — 핀 풀면 표식이 찍혀야 한다').toBeGreaterThan(5000);
  expect(r.a.h).toBe(300);
  expect(r.a.mark, 'html2canvas 가 inner 자르기를 안 따랐다').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P11 단독 HTML — 핀 속성·자르기 규칙이 실리고 pin-peek 은 없다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    window.sectionPin.peek(document.getElementById('pS'), true);
    const urls = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { const u = o(b); urls.push(u); return u; }; URL.revokeObjectURL = () => {};
    await window.exportHTMLFile();
    const html = urls.length ? await (await fetch(urls[urls.length - 1])).text() : '';
    return { n: urls.length, pin: /data-height-pin="true"/.test(html), rule: /\[data-height-pin="true"\]\s*>\s*\.section-inner/.test(html), peek: /pin-peek/.test(html) };
  });
  expect(r.n, '★전제 — HTML 이 나왔다').toBeGreaterThan(0);
  expect(r).toMatchObject({ pin: true, rule: true, peek: false });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P12 Figma JSON — heightPin 300 · 핀 아닌 섹션 0', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => { const j = window.buildFigmaExportJSON();
    const by = (id) => j.sections.find(s => s.id === id); return { p: by('pS')?.heightPin, n: by('nS')?.heightPin }; });
  expect(r).toEqual({ p: 300, n: 0 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P13 섹션 합치기 — 핀 섹션을 합쳐도 part 에 고정높이가 안 옮겨진다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const p = document.getElementById('pS'), n = document.getElementById('nS');
    n.style.height = '400px'; n.dataset.heightPin = 'true';   // 아래(원본) 섹션도 핀
    const ok = window.mergeSectionInto(p, n);
    const part = p.querySelector('.section-merged-part');
    return { ok, part: !!part, h: part?.style.height ?? null, pin: part?.dataset.heightPin ?? null };
  });
  expect(r.ok).toBe(true);
  expect(r.part).toBe(true);
  expect(r.h, 'part 에 고정높이가 옮겨졌다').toBe('');
  expect(r.pin).toBe(null);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P14 ★합치기→분리 왕복 — 핀이 안 풀린다(잠든 data-pin-h 가 저장본에 실리고 분리 때 되살아난다 · Codex r1 P1-①)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const p = document.getElementById('pS'), n = document.getElementById('nS');
    n.style.height = '600px'; n.dataset.heightPin = 'true';          // 원본(아래) = 핀 600 · 내용 1200
    const contentH = (() => { const s = n.style.height, a = n.dataset.heightPin; n.style.height = ''; delete n.dataset.heightPin; const h = n.offsetHeight; n.style.height = s; n.dataset.heightPin = a; return h; })();
    if (!window.mergeSectionInto(p, n)) return { merged: false };
    const part = p.querySelector('.section-merged-part');
    const mid = { pinH: part.dataset.pinH ?? null, partH: part.getBoundingClientRect().height / (p.getBoundingClientRect().width / p.offsetWidth),
      saved: /data-pin-h="600"/.test(window.getSerializedCanvas()) };
    window.splitMergedPart(part);
    const back = [...document.querySelectorAll('#canvas > .section-block')].find(s => s !== p);
    return { merged: true, contentH, mid, back: back ? { height: back.style.height, pin: back.dataset.heightPin ?? null, pinH: back.dataset.pinH ?? null, h: back.offsetHeight } : null };
  });
  console.log('  P14:', JSON.stringify(r));
  expect(r.merged).toBe(true);
  expect(r.mid.pinH, '합친 part 에 핀 높이를 보관 안 했다').toBe('600');
  expect(r.mid.saved, '저장본에 잠든 핀이 없다 — 저장→열기→분리에서 잃는다').toBe(true);
  expect(r.mid.partH, '합친 상태에서 part 가 핀 600 에 고정됐다(내용 갭 1200 이 다 보여야)').toBeGreaterThanOrEqual(1199);
  expect(r.back).toEqual({ height: '600px', pin: 'true', pinH: null, h: 600 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R1 ★저장→닫기→다시 열기 — 새 앱에 저장본을 실어도 핀·자르기·숨은 수 그대로 · pin-peek 은 안 실림', async ({ page, browser }) => {
  const errs = await setup(page);
  const before = await geo(page);
  const saved = await page.evaluate(() => { window.sectionPin.peek(document.getElementById('pS'), true); return window.getSerializedCanvas(); });
  await page.close();
  const ctx = await browser.newContext(); const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 1700, height: 1100 });
  const errs2 = await bootApp(p2);
  await p2.evaluate((html) => { const c = document.getElementById('canvas'); c.innerHTML = html; window.rebindAll?.(); window.deselectAll?.(); }, saved);
  await badgeReady(p2);
  const after = await geo(p2);
  console.log('  R1:', JSON.stringify({ before: before.hidden, after: after.hidden }));
  expect(after.peek, '전체 보기가 저장본으로 실렸다').toBe(false);
  expect(after.h).toBe(300);
  expect(after.ov).toBe('clip');
  expect(after.hidden).toEqual(before.hidden);
  expect((await badge(p2))?.h).toContain('숨은 블럭 ' + before.hidden.length);
  await ctx.close();
  expect([...errs, ...errs2], [...errs, ...errs2].join('\n')).toEqual([]);
});

test('R2 ⌘Z — 핀 켜기 한 번이 ⌘Z 한 번으로 풀린다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const sec = () => document.getElementById('nS');
    window.pushHistory();                                  // 시작 표본
    window.sectionPin.pin(sec());
    const pinned = sec().dataset.heightPin === 'true';
    window.undo();
    await new Promise(r => setTimeout(r, 50));
    return { pinned, after: sec().dataset.heightPin ?? null, height: sec().style.height };
  });
  expect(r).toEqual({ pinned: true, after: null, height: '' });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('U1 ★우측 패널 — 📌 · 「숨은 블럭 N개」 줄(N>0 때만) · 전체 보기 · 핀 해제 · 새 prop-hint 0', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const sec = document.getElementById('pS');
    sec.classList.add('selected');
    await window.showSectionProperties(sec);
    const q = (id) => document.getElementById(id);
    const vis = (el) => !!el && getComputedStyle(el).display !== 'none';
    const hintsOn = document.querySelectorAll('#right-panel .prop-hint, .prop-hint').length;
    const s0 = { pressed: q('sec-pin-btn')?.getAttribute('aria-pressed'), row: vis(q('sec-pin-hidden-row')),
      n: q('sec-pin-hidden-row')?.querySelector('.sec-pin-hidden-n')?.textContent, want: window.sectionPin.hiddenBlocks(sec).length,
      rowText: q('sec-pin-hidden-row')?.innerText.replace(/\s+/g, ' ').trim(), rowHints: q('sec-pin-hidden-row')?.querySelectorAll('.prop-hint').length };
    q('sec-pin-peek-btn').click(); await new Promise(r => setTimeout(r, 30));
    const s1 = { peek: sec.classList.contains('pin-peek') };
    q('sec-pin-off-btn').click(); await new Promise(r => setTimeout(r, 30));
    const s2 = { pinned: window.sectionPin.isPinned(sec), pressed: q('sec-pin-btn')?.getAttribute('aria-pressed'), row: vis(q('sec-pin-hidden-row')) };
    const hintsOff = document.querySelectorAll('.prop-hint').length;
    q('sec-pin-btn').click(); await new Promise(r => setTimeout(r, 30));
    const s3 = { pinned: window.sectionPin.isPinned(sec), height: sec.style.height, h: sec.offsetHeight, pressed: q('sec-pin-btn')?.getAttribute('aria-pressed'), row: vis(q('sec-pin-hidden-row')) };
    return { s0, s1, s2, s3, hintsOn, hintsOff };
  });
  console.log('  U1:', JSON.stringify(r));
  expect(r.s0.pressed).toBe('true');
  expect(r.s0.row, '숨은 블럭이 있는데 줄이 안 보인다').toBe(true);
  expect(r.s0.n).toBe(String(r.s0.want));
  expect(r.s0.rowText).toBe(`숨은 블럭 ${r.s0.want}개 전체 보기 핀 해제`);
  expect(r.s0.rowHints, '안전장치 줄에 prop-hint').toBe(0);
  expect(r.s1.peek).toBe(true);
  expect(r.s2).toEqual({ pinned: false, pressed: 'false', row: false });
  expect(r.hintsOn, '핀 상태에 따라 prop-hint 수가 바뀐다(새 안내 문구)').toBe(r.hintsOff);
  expect(r.s3.pinned).toBe(true);
  expect(r.s3.height, '📌 = 지금 높이로 고정').toBe(r.s3.h + 'px');
  expect(r.s3.row, '내용이 다 들어가는데 줄이 보인다').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});
