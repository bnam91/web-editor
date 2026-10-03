/* graph-gr-overlay — GR2 축·격자선 · GR3 꺾은선 얹기(bar-v, 지디 2026-10-03) — div 막대 위 오버레이 «하나», 기하 한 곳(_barVPlotGeom)
 * ──────────────────────────────────────────────────────────────────────────────────────
 * 설계 근거: scratchpad reports/GR-DESIGN.md(시제품 gr.spec.js) — 좌표 = «모델 수식 + CSS 앵커» 한 곳(js/drag-utils.js _barVPlotGeom).
 * 시험 이름 ↔ 잰 것
 *   GR2-tog  토글 셋은 따로 — 패널 체크박스를 «클릭»해 축·격자·꺾은선 각각 켜고 끄기, 끄면 dataset 키가 지워지고 오버레이가 없다
 *   GR2-ticks 눈금 — 지디 기대값 표(상단·step·칸수 «셋 다» + 상단/M 단언): 13→14·2·7 · 11→12·2·6 · 4.6→5·1·5 · 55→60·10·6 · 3.5→4·1·4
 *            (+ 100→100·20·5 · 후보 없음 꼴 1→1·1·1)
 *   GR2-agree 축·격자가 켜지면 막대가 깔끔한 상한으로 다시 비율 — 값 4 막대 꼭대기 = 눈금 4 격자선(≤0.5px)
 *   GR2-clip 눈금 글자(두 자리 「12」)가 그래프 블럭 왼쪽 밖으로 안 나간다
 *   GR3-zoom 배율 40·100·200 — 점·선 꼭짓점 vs 막대 꼭대기 오차 ≤0.5 화면px (전제: currentZoom === z 를 먼저 단언)
 *   GR3-b7   B7 설정(간격 36·패딩 24·두께 30·숫자 30) · 라벨 숨김/라벨 40 · 재렌더 없이 폭 변화
 *   GR3-fb   풀블리드 흐름 프레임 안 · GR3-fl 띄운(overlay) 그래프 배율 100·40
 *   GR3-min  값 0·아주 작은 값 — 점은 막대 꼭대기(≤0.5px), 선 꼭짓점은 ≤6.5px(min-height 4px 구간, 코드 주석과 같은 허용치)
 *   GR3-ex   내보내기 — PNG 클론·HTML 에 오버레이가 실리고 좌표가 맞다 · 피그마 JSON 에 켜진 토글만 실린다
 *   GR-W0a   ★셋 다 꺼짐(안 켬) ⇒ innerHTML·style 이 기준판 30984c67 과 바이트 동일(기준판은 git show 로 같은 앱을 한 번 더 띄운다 — G19 W0 꼴)
 *            + 계측기 대조: 같은 판에서 꺾은선만 켜면 «다르다»가 나와야 한다(같다고만 나오는 자가 아님을 같은 시험 안에서)
 *   GR-W0b   패널로 셋 다 켰다가 끈 뒤(키 삭제) ⇒ 기준판과 바이트 동일
 * ⛔못 재는 축: 실앱(Electron) · 피그마 렌더러(sangpe_to_figma, E11) · captureCloneToCanvas(CDP) · 회전한 띄운 그래프. */
const { test, expect } = require('@playwright/test');
const { BASE, bootBase, G_RB, ITEMS, setup, setZoom, openPanel, itemsOf, setDs, MEASURE, meas, ALL_ON } = require('./_graph-gr-harness.js');
/* ────────────────────────── GR2 ────────────────────────── */
const ovState = (page) => page.evaluate(() => {
  const b = document.getElementById('grG');
  return {
    ds: { showAxis: b.dataset.showAxis ?? null, showGrid: b.dataset.showGrid ?? null, showLine: b.dataset.showLine ?? null },
    ov: b.querySelectorAll('.grb-ov').length, ticks: b.querySelectorAll('.grb-ov-tick').length, axis: b.querySelectorAll('.grb-ov-axis').length,
    grid: b.querySelectorAll('.grb-ov-grid').length, line: b.querySelectorAll('.grb-ov-line').length, dots: b.querySelectorAll('.grb-ov-dot').length,
  };
});
async function clickToggle(page, id) {
  const lbl = page.locator(`#${id}`).locator('xpath=..');
  await lbl.click();
  await page.waitForTimeout(80);
}

test('GR2-tog 토글 셋은 따로 — 클릭으로 축·격자·꺾은선 각각, 끄면 키가 지워지고 오버레이가 없다', async ({ page }) => {
  const errs = await setup(page);
  await openPanel(page);
  for (const id of ['grb-show-axis', 'grb-show-grid', 'grb-show-line']) {
    expect(await page.locator('#' + id).count(), `전제: bar-v 패널에 #${id} 토글이 있다`).toBe(1);
  }
  expect(await ovState(page), '처음엔 키도 오버레이도 없다').toEqual({ ds: { showAxis: null, showGrid: null, showLine: null }, ov: 0, ticks: 0, axis: 0, grid: 0, line: 0, dots: 0 });
  await clickToggle(page, 'grb-show-axis');
  let s = await ovState(page);
  expect(s.ds).toEqual({ showAxis: '1', showGrid: null, showLine: null });
  expect([s.ov, s.axis, s.grid, s.line, s.dots], '축만: 축선·눈금, 격자·선 없음').toEqual([1, 1, 0, 0, 0]);
  expect(s.ticks).toBeGreaterThanOrEqual(5);
  await clickToggle(page, 'grb-show-axis'); await clickToggle(page, 'grb-show-grid');
  s = await ovState(page);
  expect(s.ds).toEqual({ showAxis: null, showGrid: '1', showLine: null });
  expect([s.ov, s.axis, s.ticks, s.line, s.dots], '격자만: 눈금 글자·선 없음').toEqual([1, 0, 0, 0, 0]);
  expect(s.grid).toBeGreaterThanOrEqual(5);
  await clickToggle(page, 'grb-show-grid'); await clickToggle(page, 'grb-show-line');
  s = await ovState(page);
  expect(s.ds).toEqual({ showAxis: null, showGrid: null, showLine: '1' });
  expect([s.ov, s.axis, s.ticks, s.grid, s.line, s.dots], '꺾은선만: 선 1·점 5').toEqual([1, 0, 0, 0, 1, 5]);
  await clickToggle(page, 'grb-show-line');
  expect(await ovState(page), '다 끄면 처음 꼴').toEqual({ ds: { showAxis: null, showGrid: null, showLine: null }, ov: 0, ticks: 0, axis: 0, grid: 0, line: 0, dots: 0 });
  // 다른 타입 패널엔 토글이 없다
  await page.evaluate(() => { const b = document.getElementById('grG'); b.dataset.chartType = 'bar-pair'; window.renderGraph(b); window.showGraphProperties(b); });
  expect(await page.locator('#grb-show-axis, #grb-show-grid, #grb-show-line').count(), 'bar-pair 엔 토글 없음(E13)').toBe(0);
  expect(errs).toEqual([]);
});

const tickTexts = (page) => page.evaluate(() => [...document.querySelectorAll('#grG .grb-ov-tick')].map(t => t.textContent));
/* [최댓값 M, 상단, step, 칸수] — 지디 판정 표 그대로(앞 다섯). 상단/M 은 시험이 계산해 «기대 상단/M» 과 같은지 따로 단언한다. */
for (const [mx, top, step, cnt] of [
  [13, 14, 2, 7], [11, 12, 2, 6], [4.6, 5, 1, 5], [55, 60, 10, 6], [3.5, 4, 1, 4],
  [100, 100, 20, 5], [1, 1, 1, 1],
]) {
  test(`GR2-ticks 최댓값 ${mx} → 상단 ${top} · step ${step} · ${cnt}칸`, async ({ page }) => {
    await setup(page, { items: [{ label: 'a', value: mx / 2 }, { label: 'b', value: mx }], extra: { showAxis: '1' } });
    const t = (await tickTexts(page)).map(Number);
    expect(t.length, '전제: 눈금이 그려졌다').toBeGreaterThanOrEqual(2);
    expect(t[0], '0 에서 시작').toBe(0);
    expect(t[t.length - 1], '상단').toBe(top);
    expect(t.length - 1, '칸수').toBe(cnt);
    expect(t[1] - t[0], 'step').toBe(step);
    expect(t.every((v, i) => v === i * step), `등간격 ${t}`).toBe(true);
    expect(+(t[t.length - 1] / mx).toFixed(4), '상단/M').toBe(+(top / mx).toFixed(4));
    // 막대도 같은 상단으로 — 최댓값 막대 높이 = M/상단
    const h = await page.evaluate(() => document.querySelectorAll('#grG .grb-bar-fill')[1].style.height);
    expect(h, '최댓값 막대 높이 = M/상단').toBe(+((mx / top) * 100).toFixed(2) + '%');
  });
}

test('GR2-agree 축·격자 켜면 막대가 깔끔한 상한으로 — 값 4 막대 꼭대기 = 눈금 4 격자선(≤0.5px), 다 끄면 예전 상한', async ({ page }) => {
  await setup(page, { items: ITEMS, extra: { showGrid: '1' } });
  await setZoom(page, 100);
  const r = await page.evaluate(() => {
    const b = document.getElementById('grG');
    const svg = b.querySelector('.grb-ov-svg'); const ctm = svg.getScreenCTM();
    const lines = [...b.querySelectorAll('.grb-ov-grid')].map(l => { const p = svg.createSVGPoint(); p.x = 0; p.y = +l.getAttribute('y1'); return p.matrixTransform(ctm).y; });
    const f = b.querySelectorAll('.grb-bar-fill')[3].getBoundingClientRect();   // 값 4
    const f2 = b.querySelectorAll('.grb-bar-fill')[1];                             // 값 4.6
    return { nLines: lines.length, y4: lines[4], barTop: f.top, pct46: f2.style.height };
  });
  expect(r.nLines, '전제: 0~5 격자선 6줄').toBe(6);
  expect(Math.abs(r.barTop - r.y4), `값 4 막대 꼭대기 ${r.barTop} vs 격자 4 ${r.y4}`).toBeLessThanOrEqual(0.5);
  expect(r.pct46, '4.6/5 = 92%').toBe('92%');
  await setDs(page, { showGrid: null, showLine: '1' });
  expect(await page.evaluate(() => document.querySelectorAll('#grG .grb-bar-fill')[1].style.height), '꺾은선만이면 예전 상한(4.6 = 100%)').toBe('100%');
});

test('GR2-clip 두 자리 눈금(「12」)이 그래프 블럭 왼쪽 밖으로 안 나간다 — 패딩 0·간격 8', async ({ page }) => {
  await setup(page, { items: [{ label: 'a', value: 11 }, { label: 'b', value: 6 }], extra: { showAxis: '1', vPadX: '0', vItemGap: '8' } });
  await setZoom(page, 100);
  const r = await page.evaluate(() => {
    const b = document.getElementById('grG'); const br = b.getBoundingClientRect();
    const t = [...b.querySelectorAll('.grb-ov-tick')]; const last = t[t.length - 1];
    return { text: last.textContent, tickL: Math.min(...t.map(e => e.getBoundingClientRect().left)), blockL: br.left, contentL: br.left + parseFloat(getComputedStyle(b).paddingLeft) };
  });
  expect(r.text).toBe('12');
  expect(r.tickL, `눈금 글자 왼쪽 ${r.tickL} ≥ 블럭 내용 왼쪽 ${r.contentL}`).toBeGreaterThanOrEqual(r.contentL - 0.5);
});

/* ────────────────────────── GR3 기하 ────────────────────────── */
for (const z of [40, 100, 200]) {
  test(`GR3-zoom 배율 ${z}% — 점·선 꼭짓점 vs 막대 꼭대기 ≤0.5 화면px (축·격자·선 모두 켬)`, async ({ page }) => {
    const errs = await setup(page, { extra: ALL_ON });
    await setZoom(page, z);
    const sc = await page.evaluate(() => { const s = document.getElementById('canvas-scaler'); return s ? getComputedStyle(s).transform : null; });
    expect(sc, '전제: 캔버스가 정말 그 배율로 그려진다').toBe(z === 100 ? 'matrix(1, 0, 0, 1, 0, 0)' : `matrix(${z / 100}, 0, 0, ${z / 100}, 0, 0)`);
    const m = await meas(page);
    expect(m.ok, JSON.stringify(m)).toBe(true);
    expect(m.maxDot, '점').toBeLessThanOrEqual(0.5);
    expect(m.maxLine, '선 꼭짓점').toBeLessThanOrEqual(0.5);
    expect(errs).toEqual([]);
  });
}

test('GR3-b7 B7 설정·라벨 숨김/크기·항목 8개 간격 80·재렌더 없는 폭 변화에서도 ≤0.5px', async ({ page }) => {
  await setup(page, { extra: { ...ALL_ON, vItemGap: '36', vPadX: '24', vBarThickness: '30', vPctSize: '30' } });
  await setZoom(page, 100);
  let m = await meas(page); expect(m.ok).toBe(true);
  expect([m.maxDot, m.maxLine].every(v => v <= 0.5), `B7 설정 ${m.maxDot}/${m.maxLine}`).toBe(true);
  await setDs(page, { showVLabel: '0', labelSize: '40' });
  m = await meas(page); expect([m.maxDot, m.maxLine].every(v => v <= 0.5), `값 라벨 숨김·라벨 40 ${m.maxDot}/${m.maxLine}`).toBe(true);
  await page.evaluate(() => { const b = document.getElementById('grG'); delete b.dataset.showVLabel; delete b.dataset.labelSize; b.dataset.items = JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ label: 'L' + i, value: (i * 7) % 11 + 1 }))); b.dataset.vItemGap = '80'; window.renderGraph(b); });
  m = await meas(page); expect([m.maxDot, m.maxLine].every(v => v <= 0.5), `항목 8·간격 80(% 쪽) ${m.maxDot}/${m.maxLine}`).toBe(true);
  const w0 = await page.evaluate(() => document.getElementById('grG').getBoundingClientRect().width);
  await page.evaluate(() => { document.querySelector('#grS').style.width = '560px'; document.querySelector('#grS .section-inner').style.width = '560px'; });
  await page.waitForTimeout(80);
  const w1 = await page.evaluate(() => document.getElementById('grG').getBoundingClientRect().width);
  expect(w1, '전제: 폭이 실제로 줄었다').toBeLessThan(w0 - 100);
  m = await meas(page); expect([m.maxDot, m.maxLine].every(v => v <= 0.5), `재렌더 없이 폭 ${w0}→${w1} ${m.maxDot}/${m.maxLine}`).toBe(true);
});

test('GR3-fb 풀블리드 흐름 프레임 안(섹션 패딩 40) ≤0.5px', async ({ page }) => {
  await setup(page, { extra: ALL_ON, padX: 40 });
  await setZoom(page, 100);
  const info = await page.evaluate(() => {
    const g = document.getElementById('grG'); const row = g.closest('.row');
    const fr = window.makeFrameBlock({ fullWidth: true, bg: '#22224a' });
    document.querySelector('#grS .section-inner').appendChild(fr);
    fr.appendChild(row); fr.dataset.fullBleed = 'true';
    window.applyBlockFullBleed(fr); window.renderGraph(g);
    return { inFrame: !!g.closest('.frame-block'), frameW: fr.getBoundingClientRect().width, secW: document.getElementById('grS').getBoundingClientRect().width };
  });
  expect(info.inFrame, '전제: 그래프가 풀블리드 프레임 안').toBe(true);
  const m = await meas(page);
  expect(m.ok).toBe(true);
  expect([m.maxDot, m.maxLine].every(v => v <= 0.5), JSON.stringify({ info, d: m.maxDot, l: m.maxLine })).toBe(true);
});

test('GR3-fl 띄운(overlay) 그래프 — 배율 100·40 ≤0.5px', async ({ page }) => {
  await setup(page, { extra: ALL_ON });
  await setZoom(page, 100);
  const ok = await page.evaluate(() => {
    const g = document.getElementById('grG'); window.OverlayFloat.enterFloat(window.OverlayFloat.posElOf(g));
    g.style.left = '120px'; g.style.top = '80px';
    return getComputedStyle(window.OverlayFloat.posElOf(g)).position;
  });
  expect(ok, '전제: 정말 떴다').toBe('absolute');
  let m = await meas(page); expect([m.maxDot, m.maxLine].every(v => v <= 0.5), `띄움 100 ${m.maxDot}/${m.maxLine}`).toBe(true);
  await setZoom(page, 40);
  m = await meas(page); expect([m.maxDot, m.maxLine].every(v => v <= 0.5), `띄움 40 ${m.maxDot}/${m.maxLine}`).toBe(true);
});

test('GR3-min 값 0·아주 작은 값 — 점 ≤0.5px, 선 꼭짓점 ≤6.5px(min-height 4px 구간)', async ({ page }) => {
  await setup(page, { items: [{ label: 'a', value: 0 }, { label: 'b', value: 1 }, { label: 'c', value: 100 }, { label: 'd', value: 50 }], extra: { showLine: '1' } });
  await setZoom(page, 100);
  const m = await meas(page);
  expect(m.ok).toBe(true);
  expect(m.maxDot, '점은 막대 꼭대기와 같은 식(0값 6px · 그 밖 max(pct%,4px))').toBeLessThanOrEqual(0.5);
  expect(m.maxLine, '선 꼭짓점 허용치(코드 주석 _barVPlotGeom)').toBeLessThanOrEqual(6.5);
  expect(m.rows[2].line, '큰 값은 정확').toBeLessThanOrEqual(0.5);
});

test('GR3-ex 내보내기 — PNG 클론(860·780)·HTML 에 오버레이가 실리고 맞다, 피그마 JSON 은 켜진 토글만', async ({ page }) => {
  const errs = await setup(page, { extra: ALL_ON });
  await setZoom(page, 40);
  for (const w of [860, 780]) {
    const r = await page.evaluate(async ([w, MEASURE_SRC]) => {
      const MEASURE = eval(MEASURE_SRC);
      const ex = await import('/js/io/export-image.js');
      document.getElementById('__grclone')?.remove();
      const clone = await ex.prepareCloneForCapture(document.getElementById('grS'), w, true);
      ex.renderComponentsInClone(clone);
      clone.id = '__grclone'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.zIndex = '2147483647';
      return MEASURE(clone.querySelector('.graph-block'));
    }, [w, MEASURE.toString()]);
    expect(r.ok, `PNG 클론 ${w} 오버레이 ${JSON.stringify(r)}`).toBe(true);
    expect([r.maxDot, r.maxLine].every(v => v <= 0.5), `PNG 클론 ${w} ${r.maxDot}/${r.maxLine}`).toBe(true);
  }
  await page.evaluate(() => document.getElementById('__grclone')?.remove());
  const html = await page.evaluate(async () => {
    let captured = null; const orig = URL.createObjectURL;
    URL.createObjectURL = (b) => { captured = b; return orig.call(URL, b); };
    HTMLAnchorElement.prototype.click = function () {};
    await window.exportHTMLFile(); URL.createObjectURL = orig;
    return captured ? await captured.text() : null;
  });
  expect(html, '전제: HTML 본문을 잡았다').toBeTruthy();
  const p2 = await page.context().newPage(); await p2.setViewportSize({ width: 1200, height: 1000 }); await p2.setContent(html, { waitUntil: 'load' });
  const hm = await p2.evaluate(MEASURE, '.graph-block');
  const hTicks = await p2.evaluate(() => document.querySelectorAll('.grb-ov-tick').length);
  await p2.close();
  expect(hm.ok, `HTML 배송본 오버레이 ${JSON.stringify(hm)}`).toBe(true);
  expect([hm.maxDot, hm.maxLine].every(v => v <= 0.5), `HTML ${hm.maxDot}/${hm.maxLine}`).toBe(true);
  expect(hTicks, 'HTML 눈금').toBe(6);
  const fj = await page.evaluate(() => {
    window.applyProjectData(JSON.parse(window.serializeProject()));   // 섹션이 잡히는 꼴(GR-DESIGN: 저장 왕복 한 번 뒤)
    const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.type === 'graph') return o; for (const v of Object.values(o)) { const r = find(v); if (r) return r; } return null; };
    const on = find(window.buildFigmaExportJSON());
    const b = document.getElementById('grG'); delete b.dataset.showAxis; delete b.dataset.showGrid; delete b.dataset.showLine; window.renderGraph(b);
    window.applyProjectData(JSON.parse(window.serializeProject()));
    const off = find(window.buildFigmaExportJSON());
    return { on: on && { a: on.showAxis, g: on.showGrid, l: on.showLine }, offKeys: off && Object.keys(off) };
  });
  expect(fj.on, '켜진 그래프 = 세 플래그').toEqual({ a: true, g: true, l: true });
  expect(fj.offKeys.filter(k => /^show/.test(k)), '꺼진 그래프 = 키 없음(예전 JSON 과 같다)').toEqual([]);
  expect(errs).toEqual([]);
});

/* ────────────────────────── GR-W0 ────────────────────────── */
const W0_CASES = [
  ['기본', {}, ITEMS],
  ['B7 키 전부', { vItemGap: '36', vPadX: '24', vBarThickness: '30', vPctSize: '30', vBarColor: '#ff8800' }, ITEMS],
  ['항목 단색·0값·라벨색·값 숨김', { labelColor: '#cccccc', showVLabel: '0', chartHeight: '300', labelSize: '18' }, [{ label: 'a', value: 0 }, { label: 'b', value: 7, color: '#00aa00' }, { label: 'c<b>', value: 3 }]],
];
const SNAP = () => {
  const out = {};
  for (const [name, extra, items] of window.__W0) {
    const b = document.getElementById('grG');
    for (const k of Object.keys(b.dataset)) if (!['type', 'chartType', 'preset'].includes(k)) delete b.dataset[k];
    b.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) b.dataset[k] = v;
    window.renderGraph(b);
    out[name] = { html: b.innerHTML, style: b.getAttribute('style') };
  }
  return out;
};
test('GR-W0a ★셋 다 꺼짐(안 켬) ⇒ 기준판 30984c67 과 innerHTML·style 바이트 동일(세 판) — 지키는 시험(핀에서도 초록)', async ({ browser }) => {
  const pCur = await browser.newPage(), pBase = await browser.newPage();
  const e1 = await setup(pCur), e2 = await setup(pBase, { boot: bootBase });
  for (const p of [pCur, pBase]) await p.evaluate((c) => { window.__W0 = c; }, W0_CASES);
  const base = await pBase.evaluate(SNAP);
  const cur = await pCur.evaluate(SNAP);
  expect(Object.keys(base).length, '전제: 기준판에서 세 판을 떴다').toBe(3);
  expect(base['기본'].html, '전제: 기준판 bar-v 를 정말 그렸다').toContain('grb-bars-v');
  for (const k of Object.keys(base)) expect(cur[k], `«${k}» 이 기준판과 다르다`).toEqual(base[k]);
  // 계측기 대조 — 같은 SNAP 이 «다름»을 보는가(오버레이 기능이 있는 판에서만 뜻이 있다: 핀엔 키를 읽는 코드가 없어 같게 나온다)
  const onHtml = await pCur.evaluate(() => { const b = document.getElementById('grG'); b.dataset.showLine = '1'; window.renderGraph(b); const h = b.innerHTML; delete b.dataset.showLine; window.renderGraph(b); return h; });
  const lastK = W0_CASES[W0_CASES.length - 1][0];
  if (onHtml.includes('grb-ov')) expect(onHtml, '대조: 켜면 기준판과 달라야 한다').not.toBe(base[lastK].html);
  expect(e1).toEqual([]); expect(e2).toEqual([]);
  await pCur.close(); await pBase.close();
});

test('GR-W0b ★패널로 셋 다 켰다가 끈 뒤 ⇒ 기준판과 바이트 동일(키가 지워진다)', async ({ browser }) => {
  const pCur = await browser.newPage(), pBase = await browser.newPage();
  const e1 = await setup(pCur), e2 = await setup(pBase, { boot: bootBase });
  const last = W0_CASES.slice(-1);
  for (const p of [pCur, pBase]) await p.evaluate((c) => { window.__W0 = c; }, last);
  const base = await pBase.evaluate(SNAP);
  await pCur.evaluate(SNAP);
  await pCur.evaluate(() => window.showGraphProperties(document.getElementById('grG')));
  expect(await pCur.locator('#grb-show-axis, #grb-show-grid, #grb-show-line').count(), '전제: 토글 셋이 패널에 있다').toBe(3);
  for (const id of ['grb-show-axis', 'grb-show-grid', 'grb-show-line']) { await clickToggle(pCur, id); }
  expect(await pCur.evaluate(() => document.querySelectorAll('#grG .grb-ov').length), '전제: 켜졌다').toBe(1);
  for (const id of ['grb-show-axis', 'grb-show-grid', 'grb-show-line']) { await clickToggle(pCur, id); }
  const after = await pCur.evaluate(() => ({ html: document.getElementById('grG').innerHTML, style: document.getElementById('grG').getAttribute('style') }));
  expect(after, '켰다 끈 뒤도 기준판과 바이트 동일').toEqual(base[last[0][0]]);
  expect(e1).toEqual([]); expect(e2).toEqual([]);
  await pCur.close(); await pBase.close();
});

