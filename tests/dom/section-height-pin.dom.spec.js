/* section-height-pin.dom.spec.js — 0.9.12 ⑦ 섹션 높이 핀 (현빈 Q10·Q13 «추천대로» · 2026-11-12)
 *   결정: 편집 화면에서도 고정 높이(WYSIWYG) · 넘친 블럭은 프레임 안처럼 아래로 쌓여 잘린다 ·
 *         안전장치 「숨은 블럭 N개 [전체 보기] [핀 해제]」 · ⓐ 일부라도 잘린 것 포함 · ⓑ 선택 풀리면 전체 보기 끔 ·
 *         ⓒ 해제 후 minHeight=핀값 · ⓓ 손잡이 더블클릭 = 내용 높이에 맞춤 · ⓔ 배지 safe 정렬 · ⓕ Figma 섹션 바닥에서만 자름
 *
 *   P1 ★자르기·쌓기 — 높이 300 고정 · inner overflow-y clip · 갭 50 그대로(안 줄어듦) · 숨은 블럭이 안 그려진다 · 다음 섹션이 안 밀린다
 *   P1b ★배지 섹션 inner min-height:260 — 핀 100 이면 inner 바닥 = 자르는 선(r1 ③)
 *   P2 ★넘침 갱신 — 섹션 크기가 그대로인 채 글이 늘면 배지 「숨은 블럭 N」이 따라 는다
 *   P2b ★행 안 블럭만 커질 때(행 최소높이 600 · 행 크기 그대로) 숨은 수 갱신(r1 ④)
 *   P2c ★자리(style.top)만 바뀌어 숨는 블럭도 숨은 수 갱신(r2 ③)
 *   P15 관찰 정리 — 핀 섹션만 · 해제·⌘Z 뒤 0(r2 ⑤)
 *   P3 ★전체 보기 — 다 보이고 · 높이 수는 핀 값 · 저장본·PNG 에 pin-peek 없음 · 선택 풀리면 꺼지고 · 선택 중이면 남는다
 *   P3b ★전체 보기 켠 채 h2c PNG·썸네일 입구 — 루트 pin-peek 이 안 샌다(r1 ②) · native PNG 는 P3 가 잰다
 *   P3c ★Delete(클릭 아닌 선택 해제)에도 전체 보기 꺼짐(r2 ④)
 *   P16 ★합치기→핀 해제/손잡이→⌘Z 1번 = 핀만 되돌림(r2 ① · 기록 «변경 전»)
 *   P4 핀 해제 — height 지움 · minHeight=핀값 · 내용만큼 늘어남 · 기록 1
 *   P5 ★바닥 손잡이 — 내용 밑으로 줄임 · 하한 아래패딩+20 · 취소 복원 · 더블클릭 = 내용에 맞춤 · 기록 각 1
 *   P6 드롭 기준 — 보이는 끝 아래로 끌면 «첫 숨은 자식 앞» (undefined = 맨 끝 append 가 아님)
 *   P7 ★상자선택 — 완전히 숨은 블럭을 안 고른다
 *   P8 레이어 클릭 — 숨은 블럭이면 전체 보기를 켜고 고른다(선택 중이라 안 꺼진다)
 *   P9 ★PNG(native) — 높이 300 · 숨은 표식(#ff00aa) 0 픽셀 · 전체 보기 중에도 · 780 도 / 잣대 양성대조: 핀 풀면 표식 > 0
 *   P10 PNG(html2canvas 길 = 웹·썸네일 엔진) — 같은 단언
 *   P11 단독 HTML — 핀 속성·자르기 규칙 · `:not(.pin-peek)` 규칙은 실리고 «전체 보기가 켜는» 규칙은 없다(r2 ②)
 *   P12 Figma JSON — heightPin 300 · 핀 아닌 섹션 0
 *   P13 섹션 합치기 — 핀 섹션을 합쳐도 part 에 고정높이가 안 옮겨진다
 *   P14 ★합치기→분리 왕복 — 핀이 되살아난다(r1 ①)
 *   P17 ★편집→⌘Z→핀→⌘⇧Z = 핀 그대로 · 옛 미래 안 돌아옴(r3)
 *   P18 ★열자마자 핀 → canUndo(r3)
 *   P19 ★합치기→수평만 끌기→⌘Z = 합치기만 풀림 · 바닥 300 그대로(r4 ①)
 *   P20 ★수평 뒤 세로 끌기→⌘Z = 바닥 300 복원 · 합치기 유지(r4 ②)
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

const SECS = `
<div class="section-block" id="pS" data-section="1" data-name="P" style="background:#ffffff;height:300px" data-height-pin="true">
  <div class="section-hitzone"><span class="section-label">P</span></div>
  <div class="section-inner">
    <!-- ★높이는 전부 «고정 px» — 폭·글꼴(인텔 헤드리스 1440 등)과 무관하게 내용 합(≈630) > 핀 300×2 (인텔 1차: 글 길이에 기대던 판이 300 을 못 넘었다) -->
    <div class="gap-block" data-type="gap" id="pGap" style="height:50px"></div>
    <div class="row" id="pRow1"><div class="text-block" id="pT1" style="height:80px;overflow:hidden"><p style="margin:0">보이는 글</p></div></div>
    <div class="row" id="pRowA"><div class="text-block" id="pA" style="height:100px;background:#33aa77"><p style="margin:0">보이는 칸</p></div></div>
    <div class="row" id="pRowV"><div class="text-block" id="pV" style="height:40px;overflow:hidden"><p style="margin:0">보이는 끝</p></div></div>
    <div class="gap-block" data-type="gap" id="pGap2" style="height:60px"></div>
    <div class="row" id="pRowH"><div class="text-block" id="pH" data-layer-name="HIDDEN" style="height:200px;background:#ff00aa"><p style="margin:0">숨은 칸</p></div></div>
    <div class="row" id="pRowT"><div class="text-block" id="pT2" style="height:100px;overflow:hidden"><p style="margin:0">숨은 글</p></div></div>
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
  await installPngStat(page);
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
/* PNG dataURL → { w, h, mark = #ff00aa(±20) 픽셀 수 } — ★진짜 함수로 페이지에 심는다(문자열 eval 금지: 앱 CSP 에 unsafe-eval 없음 · 인텔 2차 P3b EvalError) */
const installPngStat = (page) => page.evaluate(() => {
  window.__pngStat = async (u) => { const im = new Image(); im.src = u; await im.decode();
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let mark = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 255) <= 20 && d[i + 1] <= 20 && Math.abs(d[i + 2] - 170) <= 20) mark++;
    return { w: c.width, h: c.height, mark }; };
});

const geo = (page) => page.evaluate(() => {
  const P = window.sectionPin, sec = document.getElementById('pS'), inner = sec.querySelector(':scope > .section-inner');
  const pH = document.getElementById('pH').getBoundingClientRect();
  return { h: sec.offsetHeight, ov: getComputedStyle(inner).overflowY, innerBottom: inner.getBoundingClientRect().bottom, cut: P.cutY(sec),
    gapH: document.getElementById('pGap').offsetHeight, pHtop: pH.top, hidden: P.hiddenBlocks(sec).map(b => b.id),
    nextTop: document.getElementById('nS').getBoundingClientRect().top, secBottom: sec.getBoundingClientRect().bottom,
    /* 섹션 사이 간격(#canvas gap = pageSettings.gap · 모델 px) × 화면 배율 — 다음 섹션은 «핀 바닥 + 이 간격»에 와야 한다 */
    gapPx: (parseFloat(getComputedStyle(document.getElementById('canvas')).rowGap) || 0) * (sec.getBoundingClientRect().width / sec.offsetWidth),
    peek: sec.classList.contains('pin-peek'), measure: window.measureSectionHeight(sec), natural: P.naturalHeight(sec) };
});
const badge = (page) => page.evaluate(() => { const b = document.querySelector('#pS > .section-hitzone > .section-height-badge'); return b ? { h: b.dataset.h, red: b.hasAttribute('data-pin-hidden') } : null; });

test('P1 ★자르기·쌓기 — 300 고정 · inner clip · 갭 안 줄어듦 · 숨은 블럭 안 그려짐 · 다음 섹션 안 밀림', async ({ page }) => {
  const errs = await setup(page);
  const g = await geo(page);
  console.log('  P1:', JSON.stringify(g));
  expect(g.natural, `★전제 — 내용(${g.natural})이 핀 300 의 2배쯤이어야 한다`).toBeGreaterThan(550);
  expect(g.h).toBe(300);
  expect(g.ov, 'inner 가 세로로 안 자른다').toBe('clip');
  expect(Math.abs(g.innerBottom - g.cut), 'inner 바닥 = 자르는 선').toBeLessThanOrEqual(1);
  expect(g.gapH, '★갭이 줄었다(flex-shrink) — 쌓이다 잘리는 게 아니라 찌그러진다').toBe(50);
  expect(g.pHtop, `★전제 — 표식 칸이 완전히 숨는 자리(top ${g.pHtop} · 자르는 선 ${g.cut})`).toBeGreaterThanOrEqual(g.cut);
  expect(g.hidden).toEqual(expect.arrayContaining(['pH', 'pT2']));
  /* 인텔 2차: 40 이 나왔다 = 섹션 간격(gap) 그대로였다 — 옛 단언이 간격을 0 으로 잘못 가정했다. 숨은 내용이 밀면 간격보다 «더» 벌어진다. */
  expect(Math.abs((g.nextTop - g.secBottom) - g.gapPx), `다음 섹션이 숨은 내용에 밀렸다(벌어짐 ${(g.nextTop - g.secBottom).toFixed(1)} · 섹션 간격 ${g.gapPx.toFixed(1)})`).toBeLessThanOrEqual(1);
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
  expect(await page.evaluate(() => window.sectionPin.hiddenBlocks(document.getElementById('pS')).some(b => b.id === 'pT1')), '★전제 — pT1 은 처음엔 보인다').toBe(false);
  await page.evaluate(() => { document.getElementById('pGap').style.height = '400px'; });   // 맨 위 갭을 키워 아래를 전부 밀어낸다(글꼴 무관)
  await expect.poll(async () => (await badge(page)).h, { timeout: 2000 }).not.toBe(b0.h);
  const g = await geo(page);
  expect(g.h, '섹션 높이는 그대로').toBe(300);
  expect(g.hidden.length, `★전제 — 숨은 수가 실제로 늘었다(${n0} → ${g.hidden.length})`).toBeGreaterThan(n0);
  expect(g.hidden).toContain('pT1');
  expect((await badge(page)).h).toContain('숨은 블럭 ' + g.hidden.length);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P2b ★행 안 블럭이 커져(행·섹션 크기 그대로) 아래 블럭이 잘리면 숨은 수·패널 줄이 따라온다 (r1 ④)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    const n = document.getElementById('nS'), inner = n.querySelector(':scope > .section-inner');
    inner.innerHTML = '<div class="row" id="sRow" data-layout="stack" style="min-height:600px;flex-direction:column;align-items:stretch">'
      + '<div class="text-block" id="sA" style="height:100px"><p style="margin:0">A</p></div>'
      + '<div class="text-block" id="sB" style="height:100px"><p style="margin:0">B</p></div></div>';
    n.style.height = '300px'; n.dataset.heightPin = 'true';
  });
  const nb = () => page.evaluate(() => document.querySelector('#nS > .section-hitzone > .section-height-badge')?.dataset.h || '');
  await expect.poll(nb).toContain('📌');
  const before = await page.evaluate(() => ({ hidden: window.sectionPin.hiddenBlocks(document.getElementById('nS')).map(b => b.id), rowH: document.getElementById('sRow').offsetHeight }));
  expect(before.hidden, '★전제 — 처음엔 다 보인다').toEqual([]);
  expect(await nb()).not.toContain('숨은');
  await page.evaluate(() => { document.getElementById('sA').style.height = '250px'; });
  await expect.poll(nb, { timeout: 2000 }).toContain('숨은 블럭 1');
  const after = await page.evaluate(() => ({ hidden: window.sectionPin.hiddenBlocks(document.getElementById('nS')).map(b => b.id), rowH: document.getElementById('sRow').offsetHeight, secH: document.getElementById('nS').offsetHeight }));
  expect(after.rowH, '★전제 — 행 크기 그대로(이 칸은 «행 안» 변화를 잰다)').toBe(before.rowH);
  expect(after.secH).toBe(300);
  expect(after.hidden).toEqual(['sB']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P2c ★블럭 «자리»만 바뀌어(style.top · 크기 그대로) 숨어도 숨은 수가 따라온다 (r2 ③)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    const n = document.getElementById('nS'), inner = n.querySelector(':scope > .section-inner');
    inner.innerHTML = '<div class="row" id="yRow"><div class="text-block" id="yB" style="position:relative;top:0px;height:60px"><p style="margin:0">Y</p></div></div>';
    n.style.height = '300px'; n.dataset.heightPin = 'true';
  });
  const nb = () => page.evaluate(() => document.querySelector('#nS > .section-hitzone > .section-height-badge')?.dataset.h || '');
  await expect.poll(nb).toContain('📌');
  expect(await nb(), '★전제 — 처음엔 다 보인다').not.toContain('숨은');
  const before = await page.evaluate(() => ({ w: document.getElementById('yB').offsetWidth, h: document.getElementById('yB').offsetHeight }));
  await page.evaluate(() => { document.getElementById('yB').style.top = '400px'; });   // prop-text-wireup-position.js 의 Y 칸과 같은 손(style.top)
  await expect.poll(nb, { timeout: 2000 }).toContain('숨은 블럭 1');
  const after = await page.evaluate(() => ({ w: document.getElementById('yB').offsetWidth, h: document.getElementById('yB').offsetHeight }));
  expect(after, '★전제 — 크기는 그대로(이 칸은 «자리»만 잰다)').toEqual(before);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P15 관찰 정리 — 핀 섹션만 관찰 · 해제하면 즉시 0 · ⌘Z 로 DOM 이 갈려도 남지 않는다 (r2 ⑤)', async ({ page }) => {
  const errs = await setup(page);
  const c = () => page.evaluate(() => window.sectionPin._observedCount());
  await expect.poll(c).toBe(1);                                        // pS 하나
  await page.evaluate(() => window.sectionPin.unpin(document.getElementById('pS')));
  expect(await c(), '해제했는데 관찰이 남았다').toBe(0);
  await page.evaluate(() => { window.pushHistory(); window.sectionPin.pin(document.getElementById('nS')); });
  await expect.poll(c).toBe(1);
  await page.evaluate(() => { window.undo(); });                       // DOM 통째 교체 + nS 핀 풀림
  await page.evaluate(() => window.renderSectionHeights());
  expect(await c(), '⌘Z 뒤 떨어진/풀린 섹션 관찰이 남았다').toBe(0);
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
  const r = await page.evaluate(async () => {
    const s = window.getSerializedCanvas();
    const png = await window.__pngStat(await window.exportSection(document.getElementById('pS'), 'png', 860, { returnDataUrl: true }));
    return { savedPeek: /pin-peek/.test(s), savedPin: /data-height-pin="true"/.test(s), png, stillPeek: document.getElementById('pS').classList.contains('pin-peek') };
  });
  expect(r.savedPin).toBe(true);
  expect(r.savedPeek, '저장본(=히스토리 스냅샷)에 pin-peek').toBe(false);
  expect(r.png.h, '전체 보기 중 PNG 높이').toBe(300);
  expect(r.png.mark, '전체 보기 중 PNG 에 숨은 칸이 찍혔다').toBe(0);
  expect(r.stillPeek, '내보내기가 화면 상태를 바꿨다').toBe(true);
  /* ⓑ 선택 중이면 남고, 선택이 풀리면 꺼진다 */
  await page.evaluate(() => document.getElementById('pS').classList.add('selected'));
  const peekAfterClick = (unselect) => page.evaluate(async (unselect) => {
    if (unselect) { window.deselectAll?.(); document.getElementById('pS').classList.remove('selected'); }
    document.body.click();
    await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));   // sweepPeek 은 click «뒤» 한 틱
    return document.getElementById('pS').classList.contains('pin-peek'); }, unselect);
  expect(await peekAfterClick(false), '선택 중인데 꺼졌다').toBe(true);
  expect(await peekAfterClick(true), '선택이 풀렸는데 안 꺼졌다').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P3b ★전체 보기 켠 채 내보내기 — PNG(h2c 길)·썸네일 입구(stripEditorOnlyForCapture 루트)에도 안 샌다 (r1 ②)', async ({ page }) => {
  const errs = await setup(page);
  await page.waitForFunction(() => typeof window.html2canvas === 'function');
  const r = await page.evaluate(async () => {
    const sec = document.getElementById('pS'); window.sectionPin.peek(sec, true);
    const { stripEditorOnlyForCapture } = await import('/js/io/capture-safety.js');
    const c = sec.cloneNode(true); stripEditorOnlyForCapture(c);     // 썸네일(save-load captureThumbnail)이 «첫 섹션 클론»에 부르는 것과 같은 입구
    const h2c = await window.__pngStat(await window.exportSection(sec, 'png', 860, { returnDataUrl: true, forceH2C: true }));
    return { rootPeek: c.classList.contains('pin-peek'), h2c, live: sec.classList.contains('pin-peek') };
  });
  console.log('  P3b:', JSON.stringify(r));
  expect(r.live, '★전제 — 화면은 전체 보기 중').toBe(true);
  expect(r.rootPeek, '썸네일 클론 루트에 pin-peek 이 남았다').toBe(false);
  expect(r.h2c.h, 'h2c PNG 높이').toBe(300);
  expect(r.h2c.mark, 'h2c PNG 에 숨은 칸').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P1b ★배지 섹션(inner 인라인 min-height:260) — 핀 100 이면 inner 도 자르는 선에서 끝난다 (r1 ③)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const n = document.getElementById('nS'), inner = n.querySelector(':scope > .section-inner');
    inner.classList.add('badge-align-center'); inner.style.display = 'flex'; inner.style.alignItems = 'center'; inner.style.minHeight = '260px';   // badge-transform.js 꼴
    inner.innerHTML = '<div class="row"><div class="text-block" id="bA" style="height:80px"><p style="margin:0">배지</p></div></div>';
    n.style.height = '100px'; n.dataset.heightPin = 'true';
    const cut = window.sectionPin.cutY(n), ib = inner.getBoundingClientRect().bottom;
    return { h: n.offsetHeight, cut, innerBottom: ib, minH: getComputedStyle(inner).minHeight };
  });
  console.log('  P1b:', JSON.stringify(r));
  expect(r.h).toBe(100);
  expect(Math.abs(r.innerBottom - r.cut), `inner 바닥 ${r.innerBottom} ≠ 자르는 선 ${r.cut} (min-height ${r.minH})`).toBeLessThanOrEqual(1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P3c ★Delete 로 선택이 풀려도 전체 보기가 꺼진다 (r2 ④ · deselectAll 공용 길)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    window.buildLayerPanel?.();
    [...document.querySelectorAll('.layer-item')].find(i => i.getAttribute('aria-label') === 'HIDDEN 레이어')?.click();
  });
  await expect.poll(() => page.evaluate(() => document.getElementById('pS').classList.contains('pin-peek')), { timeout: 2000 }).toBe(true);
  expect(await page.evaluate(() => document.getElementById('pH')?.classList.contains('selected')), '★전제 — 숨은 칸을 골랐다').toBe(true);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Delete');
  await expect.poll(() => page.evaluate(() => !document.getElementById('pH')), { timeout: 2000 }).toBe(true);   // ★전제 — 실제로 지워졌다
  await expect.poll(() => page.evaluate(() => document.getElementById('pS').classList.contains('pin-peek')), { timeout: 2000 }).toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P16 ★합치기 → 핀 조작 → ⌘Z 한 번 = 핀만 되돌리고 합치기는 남는다 (r2 ① · 기록 «변경 전»)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const tick = () => new Promise(r => setTimeout(r, 30));
    const P = () => document.getElementById('pS');
    const merged = () => !!P().querySelector('.section-merged-part');
    if (!window.mergeSectionInto(P(), document.getElementById('nS'))) return { ok: false };
    await tick();
    const out = { ok: true, m0: merged(), pin0: P().dataset.heightPin ?? null };
    window.sectionPin.unpin(P()); await tick();                       // 핀 조작 ①: 해제
    out.afterUnpin = P().dataset.heightPin ?? null;
    window.undo(); await tick();
    out.u1 = { merged: merged(), pin: P().dataset.heightPin ?? null, height: P().style.height };
    /* 핀 조작 ②: 손잡이 끌기(높이 300 → 200) → ⌘Z */
    const h = P().querySelector(':scope > .section-bottom-handle');
    const k = P().getBoundingClientRect().width / P().offsetWidth, y0 = h.getBoundingClientRect().top + 2;
    h.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientY: y0, bubbles: true, cancelable: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientY: y0 - 100 * k, bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointerup', { clientY: y0 - 100 * k, bubbles: true }));
    await tick();
    out.dragged = P().style.height;
    window.undo(); await tick();
    out.u2 = { merged: merged(), height: P().style.height };
    return out;
  });
  console.log('  P16:', JSON.stringify(r));
  expect(r.ok && r.m0, '★전제 — 합쳤다').toBe(true);
  expect(r.pin0).toBe('true');
  expect(r.afterUnpin, '★전제 — 해제됐다').toBe(null);
  expect(r.u1, '⌘Z 한 번이 합치기까지 풀었다').toEqual({ merged: true, pin: 'true', height: '300px' });
  expect(r.dragged, '★전제 — 손잡이로 줄였다').toBe('200px');
  expect(r.u2, '손잡이 ⌘Z 가 합치기까지 풀었다').toEqual({ merged: true, height: '300px' });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P4 핀 해제 — height 지움 · minHeight=핀값 · 내용만큼 늘어남 · 기록 1', async ({ page }) => {
  const errs = await setup(page);
  const nat = (await geo(page)).natural;
  /* ★기록은 «호출 수»가 아니라 «⌘Z 가 되돌리나»로 잰다 — r3 부터 양쪽 끝(시작·끝 표본)이라 호출 수는 뜻이 없다 */
  const r = await page.evaluate(async () => { const sec = document.getElementById('pS'); window.sectionPin.unpin(sec);
    const out = { height: sec.style.height, min: sec.style.minHeight, pin: sec.dataset.heightPin ?? null, h: sec.offsetHeight };
    window.undo(); await new Promise(r => setTimeout(r, 30));
    const b = document.getElementById('pS'); out.undo = { pin: b.dataset.heightPin ?? null, height: b.style.height };
    return out; });
  expect(r).toEqual({ height: '', min: '300px', pin: null, h: nat, undo: { pin: 'true', height: '300px' } });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P5 ★바닥 손잡이 — 내용 밑으로 줄임 · 하한 · 취소 복원 · 더블클릭 = 내용 높이 · 기록 각 1', async ({ page }) => {
  const errs = await setup(page);
  await page.waitForFunction(() => !!document.querySelector('#pS > .section-bottom-handle'));
  const r = await page.evaluate(() => {
    const sec = document.getElementById('pS'), h = sec.querySelector(':scope > .section-bottom-handle');
    const k = sec.getBoundingClientRect().width / sec.offsetWidth;
    const y0 = h.getBoundingClientRect().top + 2;
    const drag = (dyModel, end) => {
      h.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientY: y0, bubbles: true, cancelable: true }));
      document.dispatchEvent(new PointerEvent('pointermove', { clientY: y0 + dyModel * k, bubbles: true }));
      document.dispatchEvent(new PointerEvent(end, { clientY: y0 + dyModel * k, bubbles: true }));
      return { height: sec.style.height }; };
    const out = {};
    out.shrink = drag(-100, 'pointerup');                       // 300 → 200 (내용 밑)
    out.floor = drag(-5000, 'pointerup');                       // 하한
    out.floorWant = (parseFloat(getComputedStyle(sec).paddingBottom) || 0) + 20;
    sec.style.height = '300px';
    out.cancel = drag(+250, 'pointercancel');                   // 취소 → 300 그대로 · 기록 0
    h.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    out.dbl = { height: sec.style.height, nat: window.sectionPin.naturalHeight(sec), pin: sec.dataset.heightPin, canUndo: window.getHistoryTip().canUndo };
    return out;
  });
  console.log('  P5:', JSON.stringify(r));
  expect(r.shrink).toEqual({ height: '200px' });
  expect(r.floor).toEqual({ height: r.floorWant + 'px' });
  expect(r.cancel).toEqual({ height: '300px' });
  expect(r.dbl.height, '더블클릭 = 내용 높이').toBe(r.dbl.nat + 'px');
  expect(r.dbl.pin, '핀 유지').toBe('true');
  expect(r.dbl.canUndo).toBe(true);   // 기록의 뜻(⌘Z 왕복)은 P16·P17 이 잰다
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
  const r = await page.evaluate(async () => { const st = window.__pngStat, sec = document.getElementById('pS');
    const a = await st(await window.exportSection(sec, 'png', 860, { returnDataUrl: true }));
    const b = await st(await window.exportSection(sec, 'png', 780, { returnDataUrl: true }));
    window.sectionPin.unpin(sec);
    const c = await st(await window.exportSection(sec, 'png', 860, { returnDataUrl: true }));
    return { a, b, c }; });
  console.log('  P9:', JSON.stringify(r));
  expect(r.c.mark, '★잣대 — 핀 풀면 표식이 PNG 에 있어야 한다').toBeGreaterThan(5000);
  expect(r.a).toMatchObject({ w: 860, h: 300, mark: 0 });
  expect(r.b).toMatchObject({ w: 780, h: 300, mark: 0 });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P10 PNG(html2canvas 길 — 웹 PNG·썸네일 엔진) — 높이 300 · 숨은 표식 0', async ({ page }) => {
  const errs = await setup(page);
  await page.waitForFunction(() => typeof window.html2canvas === 'function');
  const r = await page.evaluate(async () => { const st = window.__pngStat, sec = document.getElementById('pS');
    const a = await st(await window.exportSection(sec, 'png', 860, { returnDataUrl: true, forceH2C: true }));
    window.sectionPin.unpin(sec);
    const c = await st(await window.exportSection(sec, 'png', 860, { returnDataUrl: true, forceH2C: true }));
    return { a, c }; });
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
    /* ★blob URL 을 fetch 하지 않는다(인텔 1차: 하네스에서 «Failed to fetch» — exportHTMLFile 이 click 직후 revoke 한다).
       createObjectURL 에 넘어온 «Blob 자체»를 잡아 text() 로 읽는다. */
    const blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { blobs.push(b); return o(b); };
    await window.exportHTMLFile();
    const hb = blobs.filter(b => b && /text\/html/.test(b.type || '')).pop();
    const urls = blobs;
    const html = hb ? await hb.text() : '';
    return { n: urls.length, pin: /data-height-pin="true"/.test(html), rule: /\[data-height-pin="true"\]\s*>\s*\.section-inner/.test(html),
      peekOn: /\.pin-peek\[data-height-pin/.test(html), notPeek: /:not\(\.pin-peek\)\s*>\s*\.section-inner/.test(html),
      livePeekAfter: document.getElementById('pS').classList.contains('pin-peek') };
  });
  console.log('  P11:', JSON.stringify(r));   // 인텔 2차: 어느 칸이 갈렸는지 실값으로 남긴다
  expect(r.n, '★전제 — HTML 이 나왔다').toBeGreaterThan(0);
  expect(r.livePeekAfter, '내보내기가 화면의 전체 보기를 바꿨다').toBe(true);
  /* r2 ② — «전체 보기가 켜는» 규칙은 빠지고, `:not(.pin-peek)`(핀 중 inner min-height:0 · 배지 섹션)은 실려야 한다 */
  expect(r).toMatchObject({ pin: true, rule: true, peekOn: false, notPeek: true });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P12 Figma JSON — heightPin 300 · 핀 아닌 섹션 0', async ({ page }) => {
  const errs = await setup(page);
  /* ★빌더는 라이브 DOM 이 아니라 «저장 문자열»(state.pages[].canvas)을 읽는다 — 제품 호출처(figma-publish.js:196 · export-figma-json.js:189)처럼
     먼저 flushCurrentPage. (인텔 2차: 안 해서 두 섹션이 다 없었다 = undefined 둘) */
  const r = await page.evaluate(() => { window.flushCurrentPage(); const j = window.buildFigmaExportJSON(null);
    const by = (id) => j.sections.find(s => s.id === id);
    return { p: by('pS')?.heightPin, n: by('nS')?.heightPin, ids: j.sections.map(s => s.id) }; });
  console.log('  P12:', JSON.stringify(r));
  expect(r.ids, '★전제 — 두 섹션이 JSON 에 있다').toEqual(expect.arrayContaining(['pS', 'nS']));
  expect({ p: r.p, n: r.n }).toEqual({ p: 300, n: 0 });
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

test('P17 ★일반 편집 → ⌘Z → 핀 켜기 → ⌘⇧Z = 핀 그대로 · 옛 «미래»가 안 돌아온다 (r3 · redo 꼬리)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const tick = () => new Promise(r => setTimeout(r, 30));
    window.pushHistory('시작');
    document.getElementById('pA').style.height = '111px'; window.pushHistory('일반 편집');   // push-after 꼴 일반 편집
    window.undo(); await tick();
    const afterUndo = document.getElementById('pA').style.height;
    window.sectionPin.pin(document.getElementById('nS')); await tick();
    const tip = window.getHistoryTip();
    window.redo(); await tick();
    return { afterUndo, canRedoAfterPin: tip.pos < tip.len - 1,
      pinAfterRedo: document.getElementById('nS').dataset.heightPin ?? null, pA: document.getElementById('pA').style.height };
  });
  console.log('  P17:', JSON.stringify(r));
  expect(r.afterUndo, '★전제 — ⌘Z 로 편집이 풀렸다').toBe('100px');
  expect(r.canRedoAfterPin, '핀 뒤에도 redo 꼬리가 남았다').toBe(false);
  expect(r.pinAfterRedo, '⌘⇧Z 가 새 핀을 지웠다').toBe('true');
  expect(r.pA, '⌘⇧Z 가 옛 «미래»(111px)를 되살렸다').toBe('100px');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P18 ★열자마자 첫 조작이 핀이어도 Undo 가 켜진다 (r3 · canUndo = 되돌리기 단추가 읽는 값)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    window.clearHistory();                                   // 프로젝트를 막 연 상태(초기 상태 한 칸)
    const t0 = window.getHistoryTip();
    window.sectionPin.pin(document.getElementById('nS'));
    const t1 = window.getHistoryTip();
    return { t0: t0.canUndo, t1: t1.canUndo, action: t1.action };
  });
  /* ⚠️#undo-btn 은 index.html 에 «없다»(history.js _updateUndoRedoBtns 가 찾는 단추 — 데드). 그 단추가 쓰는 값 = historyPos > 0 = canUndo 를 잰다. */
  expect(r.t0, '★전제 — 막 연 상태는 Undo 불가').toBe(false);
  expect(r.t1, '첫 조작 핀 뒤 Undo 가 안 켜진다').toBe(true);
  expect(r.action).toBe('섹션 높이 고정');
  expect(errs, errs.join('\n')).toEqual([]);
});

/* P19·P20 공용 — 바닥(minHeight) 300 인 섹션 A 에 B 를 합쳐 내용 > 바닥이 된 판(Codex r4 재현 그대로).
   ★갭이 아니라 «고정 높이 글 블럭»이다 — 합치기는 이음매의 꼬리 갭을 지운다(section-merge.js _lastGap · mergedTailGapH).
     인텔 r4: A 의 유일한 갭(100)이 꼬리로 지워져 합친 내용 = 300 = 바닥 → 전제 실패. */
async function mergedFloorBoard(page) {
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.innerHTML = '<div class="section-block" id="mA" data-section="1" data-name="A" style="background:#fff;min-height:300px"><div class="section-hitzone"><span class="section-label">A</span></div>'
      + '<div class="section-inner"><div class="row"><div class="text-block" id="mAt" style="height:100px;overflow:hidden"><p style="margin:0">A</p></div></div></div></div>'
      + '<div class="section-block" id="mB" data-section="2" data-name="B" style="background:#eee"><div class="section-hitzone"><span class="section-label">B</span></div>'
      + '<div class="section-inner"><div class="row"><div class="text-block" id="mBt" style="height:350px;overflow:hidden"><p style="margin:0">B</p></div></div></div></div>';
    window.rebindAll?.(); window.deselectAll?.(); window.clearHistory();
    window.mergeSectionInto(document.getElementById('mA'), document.getElementById('mB'));
  });
  await page.waitForFunction(() => !!document.querySelector('#mA > .section-bottom-handle') && !!document.querySelector('#mA .section-merged-part'));
  return page.evaluate(() => { const a = document.getElementById('mA'); return { min: a.style.minHeight, h: a.offsetHeight }; });
}
/* 손잡이를 (dx, dyModel) 단계로 끈다 — 단계마다 pointermove 한 번 */
const dragHandle = (page, steps) => page.evaluate((steps) => {
  const a = document.getElementById('mA'), h = a.querySelector(':scope > .section-bottom-handle');
  const k = a.getBoundingClientRect().width / a.offsetWidth, r = h.getBoundingClientRect(), x0 = r.left + 5, y0 = r.top + 2;
  h.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: x0, clientY: y0, bubbles: true, cancelable: true }));
  let x = x0, y = y0;
  for (const [dx, dy] of steps) { x = x0 + dx; y = y0 + dy * k; document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true })); }
  document.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
  return a.style.minHeight;
}, steps);
const undoState = (page) => page.evaluate(async () => { window.undo(); await new Promise(r => setTimeout(r, 40));
  const a = document.getElementById('mA'); return { merged: !!a?.querySelector('.section-merged-part'), min: a?.style.minHeight ?? null, hasB: !!document.getElementById('mB') }; });

test('P19 ★합치기 → 손잡이를 «수평으로만» 끌고 놓기 → 바닥 그대로 · ⌘Z = 합치기만 풀림 (r4 ①)', async ({ page }) => {
  const errs = await setup(page);
  const b = await mergedFloorBoard(page);
  expect(b.min, '★전제 — 바닥 300').toBe('300px');
  expect(b.h, `★전제 — 합친 뒤 내용(${b.h})이 바닥 300 보다 확실히 크다(≈450 기대)`).toBeGreaterThan(400);
  const after = await dragHandle(page, [[40, 0], [80, 0]]);
  expect(after, '수평 끌기가 바닥을 지웠다').toBe('300px');
  const u = await undoState(page);
  console.log('  P19:', JSON.stringify({ b, after, u }));
  expect(u, '⌘Z 한 번 = 합치기 풀기(바닥 300 은 그대로)').toEqual({ merged: false, min: '300px', hasB: true });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P20 ★수평 첫 틱 뒤 세로로 끌기 → ⌘Z = 바닥 300 복원(빈 값 아님) · 합치기 유지 (r4 ②)', async ({ page }) => {
  const errs = await setup(page);
  const b = await mergedFloorBoard(page);
  expect(b.min, '★전제 — 바닥 300').toBe('300px');
  const after = await dragHandle(page, [[40, 0], [40, -10]]);       // 수평 → 위로 10(모델 px) = 내용보다 낮아 바닥을 «없앤다»
  expect(after, '★전제 — 세로 끌기가 바닥을 바꿨다').not.toBe('300px');
  const u = await undoState(page);
  console.log('  P20:', JSON.stringify({ b, after, u }));
  expect(u, '⌘Z 가 원래 바닥 300 을 못 되살렸다(또는 합치기까지 풀었다)').toEqual({ merged: true, min: '300px', hasB: false });
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
