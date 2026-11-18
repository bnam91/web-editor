/* preview-horizontal — 0.9.12 SECTION-HORIZONTAL-SPREAD-VIEW-IDEATION-01 (현빈 결정 261117) «⇆ 가로» 미리보기
 *   js/preview.js togglePreviewHorizontal · setSectionRowLayout(그릇 하나 · 배치는 CSS .section-row-layout)
 * 칸:
 *   H1 켜면 섹션 x 가 왼→오 증가 · y 같음 / 끄면 처음 자리(세로)로 원복 · 편집 캔버스 섹션 수·스크래치 항목 수 무변
 *   H2 페이지 둘 — 페이지마다 한 줄(그 줄 안 y 같음) · 두 줄은 위아래(뒤 페이지 줄이 아래)
 *   H3 Side by Side 와 배타 — 가로 켠 채 SBS 켜면 가로 꺼짐 · SBS 켠 채 가로 켜면 SBS 꺼짐(본문 다시 보임)
 *   H4 줌 — 가로에서 previewZoomStep(−50) 하면 섹션 화면 폭이 반 · 가로 그대로
 *   H5 Esc 로 나가면 정리 — 단추 꺼짐 · 다시 들어가면 세로
 *   H6 가로에서 섹션 누르면 편집으로 돌아가 그 섹션이 골라진다(같은 페이지)
 *   H7 [r2 · 9500 실측 ◑] 섹션 11개 + 긴 섹션 · 줌 100·50·25 — 첫 섹션 왼끝 ≥ 그릇 왼끝(스크롤 0) · 끝까지 스크롤하면 마지막 섹션이 그릇 안
 *   H8 [r2] 가로 그릇(.preview-page-block) 폭 = 미리보기 창 폭(스크롤바 뺀 clientWidth) — 줌 25 에서도(transform 통째 줄임이면 창의 z 배로 갇힌다)
 *   H10 [r3] 첫·끝 섹션을 각각 그릇 가운데까지 스크롤로 옮길 수 있다(중심 ±2 · 줌 100·25) · 켤 때 = 스크롤 «둘레 여유(창 폭 반)» 에 첫 섹션이 가운데(hz-pan 261118 · 옛 0)
 *   H11 [r3] 스페이스+드래그 → 그릇 scrollLeft 가 끈 만큼(손끝 따라감) · 편집 캔버스 팬으로 안 샘 · 섹션 점프 안 남 / [음성] 스페이스 없이 끌면 scrollLeft 그대로 · 미리보기 그대로
 *   H12 [r4] 위·아래 여유 — 첫 섹션 윗변을 창 세로 가운데까지 내릴 수 있음 · 가장 키 큰 섹션 아랫변을 가운데까지 올릴 수 있음 · 켤 때 첫 화면에 섹션이 보임 · 줌 100·25
 *   H13 [r5] 맥(body.electron-app.is-mac · editor.js 가 거는 판정 그대로)이면 위쪽 바 첫 단추 왼끝 ≥ 편집 #topbar 의 신호등 여백(같은 값) · [음성] 맥 아님·전체화면이면 그 여백 없음
 *   H14 [r5] 위쪽 띠 hover → 바 보임 · 띠·바 벗어나면 잠깐 뒤 숨김 · 바 위에 있으면 숨김 지연을 넘겨도 유지 · 클릭 토글 무변
 *   H15 [r5] 드러난 위쪽 바 computed -webkit-app-region = drag(편집 #topbar 와 같은 규칙) · 단추 no-drag · 숨은 동안엔 drag 아님(위쪽 띠 hover 가 산다) — 실제 창 이동은 헤드리스로 못 잼(9500 손)
 *   H16 [r5] 핀치(ctrlKey+wheel) — 가로·세로 줌 증감 · 하한(가로 10·세로 50)·상한 200 · 가로는 커서 아래 섹션 지점이 줌 뒤에도 제자리(±3) · ctrlKey 없는 wheel 은 줌 무변
 *   H17 [r5] 가로 스크롤러 = #preview-overlay 하나(overflow-x auto · 아래끝 = 창 아래끝) · .preview-page-block overflow visible · 페이지 둘이면 같이 움직임 · 끄면 overlay overflow-x hidden
 *   H18 [r5b] 떠 있는 블럭(z 9999)의 맨 바깥 쌓임 맥락 = #preview-content(position ≠ static · z 0) · 세로·가로 · 잴 블럭 0 이면 빨강 — 스크롤바 hit-test 는 맥 겹침 스크롤바에서 못 재서 버림
 *   H19 [r5] 진입 직후 줌 표시 50% · #preview-content scale(0.5) · 가로 켜도 50 유지(줄 zoom 0.5 · 통째 transform 없음) · 나갔다 다시 들어와도 50
 *   H20 [PREVIEW-HZ-SPACE-PAN-CHOPPY-01 · 현빈 261118] 켠 «처음 자리»에서 스페이스+대각선 끌기(오른쪽 아래로) → 가로·세로 둘 다 손끝을 따라감(옛 판 = 스크롤 0 이라 가로가 막혀 세로만) · 놓으면 끝 자리 그대로(rAF 로 묶어도 마지막 자리 반영)
 *   H9 [r2] 가로 줌 하한 10(50 밑으로 내려간다) · 세로로 돌아가면 50 으로 · 세로 하한은 50 그대로 · 줌 표시 숫자 맞음
 * 양성대조 hz-pan: _patches/PVH-CTL6-start-at-zero.patch(켤 때 scrollLeft = 0 으로 되돌림) → H20·H10 빨강(예측).
 * 양성대조 r5: _patches/PVH-CTL5-r5-off.patch(신호등 여백 · hover · 바 drag · 핀치 · 스크롤러 하나 · 쌓임 가둠 끔) → H13~H18 빨강(실측대로 적음).
 * 양성대조 r4: _patches/PVH-CTL4-no-vertical-room.patch(_hzEdgeRoom 의 위·아래 padding 줄 끔) → H12 빨강.
 * 양성대조 r3: _patches/PVH-CTL3-no-edge-pan.patch(_hzEdgeRoom 본문 return · 스페이스 keydown 처리 끔) → H10·H11 빨강.
 * 양성대조 r2: _patches/PVH-CTL2-zoom-transform.patch(가로도 옛 통째 transform 줌) → srv 실측 H8 만 빨강 · H7 은 초록(헤드리스 1440 창에선 9500 의 음수 x 가 재현 안 됨 — 옛 꼴도 첫 섹션이 그릇 왼끝·끝까지 닿음) · H9 초록(하한은 따로).
 * 양성대조: _patches/PVH-CTL-no-row.patch(setSectionRowLayout 의 class 켜는 한 줄 삭제) → H1·H2·H3·H4 빨강(H3 은 줄 수 단언) · H5·H6 초록.
 * ⛔고정 대기 0 · 자리는 offsetLeft/offsetTop(레이아웃 px · 줌 transform 무관) · 화면 px 는 비율로만.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, { pages = 1 } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async (pages) => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    for (let i = 0; i < 3; i++) await window.addSection();
    window.flushCurrentPage();
    if (pages > 1) window.state.pages.push({ id: 'page_hz2', name: 'Page 2', label: '', pageSettings: { ...window.state.pageSettings }, canvas: window.state.pages[0].canvas });
    const before = { canvasSecs: document.querySelectorAll('#canvas .section-block').length, scratch: document.querySelectorAll('.scratch-item').length };
    window.enterPreview();
    return { before, ids: [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id) };
  }, pages);
  await expect(page.locator('body.preview-mode'), '[전제] 미리보기').toHaveCount(1);
  return { errs, ...r };
}
const pos = (page) => page.evaluate(() => [...document.querySelectorAll('#preview-content .preview-page-block')].map((b) =>
  [...b.querySelectorAll('.preview-page-inner > .section-block')].map((s) => ({ x: s.offsetLeft, y: s.offsetTop }))));
const hz = (page, on) => page.evaluate((on) => window.togglePreviewHorizontal(on), on);
const state = (page) => page.evaluate(() => ({
  hzBtn: !!document.getElementById('preview-hz-btn')?.classList.contains('active'),
  rows: document.querySelectorAll('#preview-content .preview-page-inner.section-row-layout').length,
  sbsBtn: !!document.getElementById('preview-sbs-btn')?.classList.contains('active'),
  content: getComputedStyle(document.getElementById('preview-content')).display,
}));
const incr = (a) => a.every((v, i) => i === 0 || v > a[i - 1]);
const same = (a) => a.every((v) => Math.abs(v - a[0]) < 1);

test('H1 켜면 왼→오 한 줄(x 증가 · y 같음) · 끄면 원복 · 캔버스·스크래치 무변', async ({ page }) => {
  const { errs, before } = await scene(page);
  const [p0] = await pos(page);
  expect({ n: p0.length, yIncr: incr(p0.map((q) => q.y)), xSame: same(p0.map((q) => q.x)) }, '[전제] 세로 셋').toEqual({ n: 3, yIncr: true, xSame: true });
  await hz(page, true);
  const [p1] = await pos(page);
  expect({ xIncr: incr(p1.map((q) => q.x)), ySame: same(p1.map((q) => q.y)), st: await state(page) }, '★가로 한 줄').toEqual({ xIncr: true, ySame: true, st: { hzBtn: true, rows: 1, sbsBtn: false, content: 'block' } });
  await hz(page, false);
  expect(await pos(page), '★끄면 처음 자리').toEqual([p0]);
  expect((await state(page)).rows).toBe(0);
  expect(await page.evaluate(() => ({ canvasSecs: document.querySelectorAll('#canvas .section-block').length, scratch: document.querySelectorAll('.scratch-item').length })), '편집 캔버스·스크래치 무변').toEqual(before);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H2 페이지 둘 — 페이지마다 한 줄 · 두 줄은 위아래', async ({ page }) => {
  const { errs } = await scene(page, { pages: 2 });
  await hz(page, true);
  const rows = await pos(page);
  expect(rows.map((r) => ({ n: r.length, xIncr: incr(r.map((q) => q.x)), ySame: same(r.map((q) => q.y)) })), '★페이지마다 한 줄').toEqual([{ n: 3, xIncr: true, ySame: true }, { n: 3, xIncr: true, ySame: true }]);
  const tops = await page.evaluate(() => [...document.querySelectorAll('#preview-content .preview-page-block')].map((b) => b.offsetTop));
  expect(incr(tops), `★두 줄은 위아래 ${JSON.stringify(tops)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H3 Side by Side 와 배타', async ({ page }) => {
  const { errs } = await scene(page);
  await hz(page, true);
  await page.evaluate(() => window.togglePreviewSideBySide());
  expect(await state(page), '가로 켠 채 SBS → 가로 꺼짐').toEqual({ hzBtn: false, rows: 0, sbsBtn: true, content: 'none' });
  await hz(page, true);
  expect(await state(page), 'SBS 켠 채 가로 → SBS 꺼짐 · 본문 보임').toEqual({ hzBtn: true, rows: 1, sbsBtn: false, content: 'block' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H4 줌 — 가로에서도 먹는다', async ({ page }) => {
  const { errs } = await scene(page);
  await hz(page, true);
  const w = () => page.evaluate(() => document.querySelector('#preview-content .section-block').getBoundingClientRect().width);
  await page.evaluate(() => window.previewZoomStep(100 - parseInt(document.getElementById('preview-zoom-display').textContent)));   // r5 — 기본이 50% 가 됐으니 기준을 100 으로 맞춘 뒤 −50(옛 칸은 «진입 직후 100» 가정)
  const w0 = await w();
  await page.evaluate(() => window.previewZoomStep(-50));
  const ratio = (await w()) / w0;
  expect(ratio, `★화면 폭 비율 ${ratio}`).toBeCloseTo(0.5, 2);
  const [p] = await pos(page);
  expect({ xIncr: incr(p.map((q) => q.x)), ySame: same(p.map((q) => q.y)) }, '가로 그대로').toEqual({ xIncr: true, ySame: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H5 Esc 로 나가면 정리 · 다시 들어가면 세로', async ({ page }) => {
  const { errs } = await scene(page);
  await hz(page, true);
  await page.keyboard.press('Escape');
  await expect(page.locator('body.preview-mode'), '[전제] 나감').toHaveCount(0);
  expect(await page.evaluate(() => document.getElementById('preview-hz-btn').classList.contains('active'))).toBe(false);
  await page.evaluate(() => window.enterPreview());
  expect((await state(page)).rows, '다시 들어가면 세로').toBe(0);
  const [p] = await pos(page);
  expect(incr(p.map((q) => q.y))).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H6 가로에서 섹션 누르면 편집으로 돌아가 그 섹션이 골라진다', async ({ page }) => {
  const { errs, ids } = await scene(page);
  await hz(page, true);
  const c = await page.evaluate(() => { const s = document.querySelectorAll('#preview-content .section-block')[2]; s.scrollIntoView({ block: 'center', inline: 'center' }); const q = s.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2, s.id]; });
  expect(c[2], '[전제] 셋째 섹션 = 캔버스 셋째와 같은 id').toBe(ids[2]);
  await page.mouse.click(c[0], c[1]);
  await expect(page.locator('body.preview-mode'), '★편집으로 돌아감').toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.getSelectedSection()?.id), '★그 섹션이 골라짐').toBe(ids[2]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function longScene(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    for (let i = 0; i < 11; i++) await window.addSection();
    document.querySelectorAll('#canvas .section-block')[3].querySelector('.section-inner').style.minHeight = '2400px';   // 긴 섹션
    window.flushCurrentPage(); window.enterPreview(); window.togglePreviewHorizontal(true);
  });
  return errs;
}
const zoomTo = (page, z) => page.evaluate((z) => { const cur = parseInt(document.getElementById('preview-zoom-display').textContent); window.previewZoomStep(z - cur); return document.getElementById('preview-zoom-display').textContent; }, z);
/* r5 — 가로 스크롤러 = #preview-overlay 하나 · 보이는 창 = overlay 의 client 영역 */
const reach = (page) => page.evaluate(() => {
  const o = document.getElementById('preview-overlay'), ss = [...document.querySelectorAll('#preview-content .preview-page-block')[0].querySelectorAll('.preview-page-inner > .section-block')];
  const O = o.getBoundingClientRect(), left = O.left + o.clientLeft, right = left + o.clientWidth;
  o.scrollLeft = 0;
  const firstGap = ss[0].getBoundingClientRect().left - left;
  o.scrollLeft = o.scrollWidth;
  const L = ss.at(-1).getBoundingClientRect();
  const lastIn = L.left - left >= -1 && right - L.right >= -1;
  o.scrollLeft = 0;
  return { n: ss.length, firstIn: firstGap >= -1, lastIn, overflow: o.scrollWidth > o.clientWidth };
});

test('H7 섹션 11 + 긴 섹션 · 줌 100·50·25 — 첫 섹션이 스크롤 0 에 보이고 끝까지 닿는다', async ({ page }) => {
  const errs = await longScene(page);
  for (const z of [100, 50, 25]) {
    expect(await zoomTo(page, z), `[전제] 줌 표시 ${z}`).toBe(z + '%');
    expect(await reach(page), `★줌 ${z}%`).toEqual({ n: 11, firstIn: true, lastIn: true, overflow: true });
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H8 가로 그릇 폭 = 미리보기 창 폭 — 줌 25 에서도', async ({ page }) => {
  const errs = await longScene(page);
  const gap = () => page.evaluate(() => { const o = document.getElementById('preview-overlay'), b = document.querySelector('#preview-content .preview-page-block'); return Math.abs(b.getBoundingClientRect().width - o.clientWidth); });
  for (const z of [100, 25]) {
    await zoomTo(page, z);
    expect(await gap(), `★줌 ${z}% 그릇 폭 − 창 폭`).toBeLessThanOrEqual(1);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H9 가로 줌 하한 10 · 세로로 돌아가면 50 · 세로 하한 50 그대로', async ({ page }) => {
  const errs = await longScene(page);
  const disp = () => page.evaluate(() => document.getElementById('preview-zoom-display').textContent);
  await page.evaluate(() => window.previewZoomStep(-500));
  expect(await disp(), '★가로 하한 10%').toBe('10%');
  await hz(page, false);
  expect({ d: await disp(), t: await page.evaluate(() => document.getElementById('preview-content').style.transform) }, '세로로 돌아가면 50 · 통째 transform').toEqual({ d: '50%', t: 'scale(0.5)' });
  await page.evaluate(() => window.previewZoomStep(-500));
  expect(await disp(), '세로 하한 50 그대로').toBe('50%');
  expect(errs, errs.join(' | ')).toEqual([]);
});

const centerGap = (page, which) => page.evaluate((which) => {
  const o = document.getElementById('preview-overlay'), ss = [...document.querySelectorAll('#preview-content .preview-page-block')[0].querySelectorAll('.preview-page-inner > .section-block')], sec = which === 'first' ? ss[0] : ss.at(-1);
  const off = () => { const O = o.getBoundingClientRect(), S = sec.getBoundingClientRect(); return (S.left + S.width / 2) - (O.left + o.clientLeft + o.clientWidth / 2); };
  o.scrollLeft += off();
  return Math.abs(off());
}, which);

test('H10 첫·끝 섹션을 그릇 가운데까지 — 줌 100·25 · 켤 때 첫 섹션이 가운데', async ({ page }) => {
  const errs = await longScene(page);
  const init = await page.evaluate(() => { const o = document.getElementById('preview-overlay'), S = document.querySelector('#preview-content .preview-page-inner > .section-block').getBoundingClientRect(), O = o.getBoundingClientRect(); return { sl: o.scrollLeft, gap: Math.abs((S.left + S.width / 2) - (O.left + o.clientLeft + o.clientWidth / 2)) }; });
  /* PREVIEW-HZ-SPACE-PAN-CHOPPY-01(현빈 261118) — 옛 «켤 때 스크롤 0»(= 왼쪽 끝 · 왼쪽으로 못 끎)을 «둘레 여유 = 창 폭 반»으로 바꾼 제품 변경. 가운데 단언은 그대로. */
  expect(init.sl, '켤 때 왼쪽으로도 끌 여유 = 창 폭 반').toBe(await page.evaluate(() => Math.round(document.getElementById('preview-overlay').clientWidth / 2)));
  expect(init.gap, '★켤 때 첫 섹션이 그릇 가운데').toBeLessThanOrEqual(2);
  for (const z of [100, 25]) {
    await zoomTo(page, z);
    expect(await centerGap(page, 'first'), `★줌 ${z}% 첫 섹션 가운데까지`).toBeLessThanOrEqual(2);
    expect(await centerGap(page, 'last'), `★줌 ${z}% 끝 섹션 가운데까지`).toBeLessThanOrEqual(2);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H11 스페이스+드래그 = 가로 팬 · 편집 캔버스로 안 샘 / 스페이스 없이 끌면 그대로', async ({ page }) => {
  const errs = await longScene(page);
  const sl = () => page.evaluate(() => document.getElementById('preview-overlay').scrollLeft);
  await page.evaluate(() => { document.getElementById('preview-overlay').scrollLeft = 1000; window.getSelection()?.removeAllRanges(); });
  const s0 = await sl();
  expect(s0, '[전제] 가로 스크롤 1000 에 섰다(스크롤러 = #preview-overlay)').toBe(1000);
  /* 누르는 자리(화면 px · 마우스 목표) — 스크롤 값 단언(1000) 뒤에 잰다: dom-screen-px-census Z3 은 «화면 px 줄 + 3줄 안 두 자리 수»를 문턱으로 본다(스크롤 값 1000 은 문턱이 아니다 · 자리를 떼어 오탐을 없앰) */
  const c = await page.evaluate(() => { const o = document.getElementById('preview-overlay'), O = o.getBoundingClientRect(); return [O.left + o.clientWidth / 2, O.top + o.clientHeight / 2]; });
  // r5b — 스페이스 팬을 «먼저»(앞 칸의 그냥 끌기가 남긴 글 선택 위에서 누르면 맥은 선택 끌기가 시작돼 팬이 안 온다 · 아이맥 0 의 공산) · 진단을 메시지에
  await page.mouse.move(c[0], c[1]);
  await page.keyboard.down('Space');
  const leak = await page.evaluate(() => ({ pan: document.getElementById('canvas-wrap').classList.contains('pan-mode'), grab: document.getElementById('preview-overlay').classList.contains('pv-pan-mode') }));
  await page.mouse.down();
  const mid0 = await page.evaluate(() => document.getElementById('preview-overlay').classList.contains('pv-panning'));
  await page.mouse.move(c[0] - 200, c[1], { steps: 8 });
  const mid1 = await sl();
  await page.mouse.up();
  await page.keyboard.up('Space');
  expect(leak, '★스페이스 = 미리보기 손바닥 · 편집 캔버스 팬 모드 안 켜짐').toEqual({ pan: false, grab: true });
  const s1 = await sl();
  const diag = await page.evaluate(() => { const o = document.getElementById('preview-overlay'); return { ox: getComputedStyle(o).overflowX, sw: o.scrollWidth, cw: o.clientWidth }; });
  expect(s1 - s0, `★끈 만큼(왼쪽으로 200 → 스크롤 +200) · 진단 ${JSON.stringify({ panningAtDown: mid0, beforeUp: mid1, after: s1, ...diag })}`).toBe(200);
  expect(await page.locator('body.preview-mode').count(), '팬 끝 click 이 섹션 점프로 안 샘').toBe(1);
  // [음성] 스페이스 없이 끌기 — 스크롤 그대로 · 점프 없음
  const s2 = await sl();
  await page.mouse.move(c[0], c[1]); await page.mouse.down(); await page.mouse.move(c[0] - 150, c[1], { steps: 6 }); await page.mouse.up();
  expect({ d: (await sl()) - s2, preview: await page.locator('body.preview-mode').count() }, '[음성] 스페이스 없이 = 안 움직임 · 미리보기 그대로(점프 안 남)').toEqual({ d: 0, preview: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});
/* r5c — r5b 에서 H11 을 갈아 끼울 때 «H11 머리 ~ 다음 test(» 를 잘라 이 자(H12 가 쓰는 vGap)까지 같이 날렸다 — 되살림(내용 r4 그대로) */
test('H20 처음 자리에서 대각선 스페이스 끌기 — 가로·세로 둘 다 따라감', async ({ page }) => {
  const errs = await longScene(page);
  const sc = () => page.evaluate(() => { const o = document.getElementById('preview-overlay'); return [o.scrollLeft, o.scrollTop]; });
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  const s0 = await sc();   // 켠 그대로(손대지 않음)
  const c = await page.evaluate(() => { const o = document.getElementById('preview-overlay'), O = o.getBoundingClientRect(); return [O.left + o.clientWidth / 2, O.top + o.clientHeight / 2]; });
  await page.mouse.move(c[0], c[1]);
  await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(c[0] + 150, c[1] + 100, { steps: 10 });   // 오른쪽 아래로 끌면 내용이 따라와 스크롤은 왼쪽·위로
  await page.mouse.up();
  await page.keyboard.up('Space');
  const s1 = await sc();
  expect([s0[0] - s1[0], s0[1] - s1[1]], `★가로·세로 둘 다 끈 만큼(처음 ${s0} → ${s1})`).toEqual([150, 100]);
  expect(await page.locator('body.preview-mode').count()).toBe(1);
  expect(errs, errs.join(' | ')).toEqual([]);
});
const vGap = (page, which) => page.evaluate((which) => {
  const o = document.getElementById('preview-overlay'), ss = [...document.querySelectorAll('#preview-content .preview-page-inner > .section-block')];
  const tall = ss.reduce((a, b) => (b.offsetHeight > a.offsetHeight ? b : a));
  const y = () => { const O = o.getBoundingClientRect(), S = (which === 'top' ? ss[0] : tall).getBoundingClientRect(); return (which === 'top' ? S.top : S.bottom) - (O.top + o.clientHeight / 2); };
  o.scrollTop += y();
  return Math.abs(y());
}, which);

test('H12 위·아래 여유 — 첫 섹션 윗변·키 큰 섹션 아랫변을 창 가운데까지 · 켤 때 섹션 보임 · 줌 100·25', async ({ page }) => {
  const errs = await longScene(page);
  const seen = await page.evaluate(() => { const o = document.getElementById('preview-overlay'), O = o.getBoundingClientRect(), S = document.querySelector('#preview-content .section-block').getBoundingClientRect(); return S.top < O.top + o.clientHeight && S.bottom > O.top; });
  expect(seen, '★켤 때 첫 화면에 섹션이 보인다(빈 화면 아님)').toBe(true);
  for (const z of [100, 25]) {
    await zoomTo(page, z);
    expect(await vGap(page, 'top'), `★줌 ${z}% 첫 섹션 윗변 → 가운데`).toBeLessThanOrEqual(2);
    expect(await vGap(page, 'bottom'), `★줌 ${z}% 키 큰 섹션 아랫변 → 가운데`).toBeLessThanOrEqual(2);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H13 맥이면 위쪽 바 첫 단추가 신호등 자리 밖 · 맥 아님/전체화면이면 여백 없음', async ({ page }) => {
  const errs = await longScene(page);
  const probe = (cls) => page.evaluate((cls) => {
    document.body.classList.remove('electron-app', 'is-mac', 'fullscreen'); cls.forEach((c) => document.body.classList.add(c));
    const tb = document.getElementById('preview-topbar'); tb.classList.add('visible');
    const first = tb.querySelector('.preview-tb-left > button');
    const lights = parseFloat(getComputedStyle(document.getElementById('topbar')).paddingLeft);   // 편집 툴바가 비켜 두는 신호등 자리(같은 규칙)
    const x = first.getBoundingClientRect().left - tb.getBoundingClientRect().left;
    return { clear: x >= lights - 0.5, pad: getComputedStyle(tb).paddingLeft === getComputedStyle(document.getElementById('topbar')).paddingLeft };
  }, cls);
  expect(await probe(['electron-app', 'is-mac']), '★맥 — 첫 단추 ≥ 신호등 자리 · 편집 툴바와 같은 여백').toEqual({ clear: true, pad: true });
  expect((await probe(['electron-app'])).pad, '[음성] 맥 아님 — 신호등 여백 안 씀').toBe(false);
  expect((await probe(['electron-app', 'is-mac', 'fullscreen'])).pad, '[음성] 전체화면 — 신호등 여백 안 씀').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H14 위쪽 띠 hover → 바 보임 · 벗어나면 잠깐 뒤 숨김 · 바 위면 유지 · 클릭 토글 무변', async ({ page }) => {
  const errs = await longScene(page);
  const vis = () => page.evaluate(() => document.getElementById('preview-topbar').classList.contains('visible'));
  expect(await vis(), '[전제] 처음엔 숨김').toBe(false);
  await page.mouse.move(700, 400); await page.mouse.move(700, 6);
  await expect.poll(vis, '★위쪽 띠 hover → 보임').toBe(true);
  await page.mouse.move(700, 400);
  await expect.poll(vis, '★벗어나면 잠깐 뒤 숨김').toBe(false);
  // 바 위에 머물면 숨김 지연을 넘겨도 유지
  await page.mouse.move(700, 6);
  await expect.poll(vis).toBe(true);
  const c = await page.evaluate(() => { const q = document.getElementById('preview-zoom-display').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(c[0], c[1]);
  const t0 = await page.evaluate(() => performance.now());
  await page.waitForFunction((t0) => performance.now() > t0 + 1500, t0);   // 숨김 지연(700)의 두 배 넘게 바 위에 머문다(조건 대기)
  expect(await vis(), '★바 위에 있으면 유지').toBe(true);
  // 클릭 토글 무변 — 본문 클릭 = 숨김, 다시 클릭 = 보임(hover 와 무관하게 유지)
  await page.mouse.move(700, 500); await page.mouse.click(700, 500);
  expect(await vis(), '클릭 → 숨김(토글)').toBe(false);
  await page.mouse.click(700, 500);
  expect(await vis(), '다시 클릭 → 보임').toBe(true);
  const t1 = await page.evaluate(() => performance.now());
  await page.waitForFunction((t1) => performance.now() > t1 + 1500, t1);
  expect(await vis(), '클릭으로 연 것은 hover 가 안 닫는다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H15 드러난 위쪽 바 = 창 끌기(drag) · 단추 no-drag · 숨은 동안엔 drag 아님 · hover 공존', async ({ page }) => {
  const errs = await longScene(page);
  const region = () => page.evaluate(() => {
    const tb = document.getElementById('preview-topbar'), ar = (el) => getComputedStyle(el).getPropertyValue('-webkit-app-region') || getComputedStyle(el).webkitAppRegion || '';
    return { bar: ar(tb), btns: [...tb.querySelectorAll('button')].map(ar).every((v) => v === 'no-drag'), editor: ar(document.getElementById('topbar')) };
  });
  const hidden = await region();
  expect(hidden.editor, '[전제] 편집 #topbar = drag(이 브라우저가 app-region 을 읽는다)').toBe('drag');
  expect(hidden.bar, '숨은 동안 = drag 아님').not.toBe('drag');
  await page.mouse.move(700, 400); await page.mouse.move(700, 6);
  await expect.poll(() => page.evaluate(() => document.getElementById('preview-topbar').classList.contains('visible')), '★hover 공존 — 숨은 바도 위쪽 띠 hover 로 뜬다').toBe(true);
  expect(await region(), '★드러난 바 = drag · 단추 no-drag').toEqual({ bar: 'drag', btns: true, editor: 'drag' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

const pinch = (page, dy, x, y, ctrl = true) => page.evaluate(([dy, x, y, ctrl]) => {
  document.getElementById('preview-overlay').dispatchEvent(new WheelEvent('wheel', { deltaY: dy, ctrlKey: ctrl, clientX: x, clientY: y, bubbles: true, cancelable: true }));
}, [dy, x, y, ctrl]);
const zd = (page) => page.evaluate(() => parseInt(document.getElementById('preview-zoom-display').textContent));
/* 한 스로틀 틱(16ms)에 한 노치씩 — 틱마다 노치 상한이 있어 한꺼번에 쏘면 덜 간다(편집 핀치와 같은 셈). 줌이 더 안 바뀔 때까지(끝 = 하한/상한). */
async function pinchTo(page, dy, x, y) {
  for (let i = 0; i < 60; i++) {
    const before = await zd(page);
    await pinch(page, dy, x, y);
    const moved = await page.waitForFunction((b) => parseInt(document.getElementById('preview-zoom-display').textContent) !== b, before, { timeout: 400 }).then(() => true, () => false);
    if (!moved) return before;
  }
  return zd(page);
}

test('H16 핀치 줌 — 가로·세로 증감 · 하한·상한 · 가로 커서 아래 제자리 · ctrlKey 없는 wheel 은 무변', async ({ page }) => {
  const errs = await longScene(page);
  // 가로 — 다섯째 섹션을 그릇 가운데로 두고 그 섹션 안 한 점을 손가락 자리로
  const at = await page.evaluate(() => {
    const o = document.getElementById('preview-overlay'), s = document.querySelectorAll('#preview-content .preview-page-inner > .section-block')[4];
    const off = () => { const O = o.getBoundingClientRect(), S = s.getBoundingClientRect(); return (S.left + S.width / 2) - (O.left + o.clientLeft + o.clientWidth / 2); };
    o.scrollLeft += off();
    const S = s.getBoundingClientRect(), z = parseInt(document.getElementById('preview-zoom-display').textContent) / 100;
    const x = S.left + S.width * 0.3, y = Math.max(S.top, 0) + 40;
    window.__pin = { ux: (x - S.left) / z, vy: (y - S.top) / z };
    return { x, y };
  });
  const z0 = await zd(page);
  await pinch(page, -100, at.x, at.y);
  await expect.poll(() => zd(page), '★가로 핀치 아웃(확대) → 줌 증가').toBeGreaterThan(z0);
  const drift = await page.evaluate(([x, y]) => {
    const s = document.querySelectorAll('#preview-content .preview-page-inner > .section-block')[4], S = s.getBoundingClientRect(), z = parseInt(document.getElementById('preview-zoom-display').textContent) / 100;
    return Math.max(Math.abs(S.left + window.__pin.ux * z - x), Math.abs(S.top + window.__pin.vy * z - y));
  }, [at.x, at.y]);
  expect(drift, `★가로 커서 아래 섹션 지점이 제자리(${drift.toFixed(1)}px)`).toBeLessThanOrEqual(3);
  const z1 = await zd(page);
  await pinch(page, 100, at.x, at.y, false);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await zd(page), '[음성] ctrlKey 없는 wheel = 줌 무변').toBe(z1);
  expect(await pinchTo(page, 100, at.x, at.y), '★가로 하한 10').toBe(10);
  expect(await pinchTo(page, -100, at.x, at.y), '★상한 200').toBe(200);
  // 세로
  await hz(page, false);
  expect(await pinchTo(page, 100, 700, 400), '★세로 하한 50').toBe(50);
  await pinch(page, -100, 700, 400);
  await expect.poll(() => zd(page), '★세로 핀치 → 줌 증가').toBeGreaterThan(50);
  expect(await page.evaluate(() => document.getElementById('preview-content').style.transform), '세로는 종전 방식(통째 transform)').toMatch(/^scale\(/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H17 가로 스크롤러 = 미리보기 창 하나 · 줄은 overflow visible · 페이지 둘이 같이 움직임 · 끄면 원복', async ({ page }) => {
  const { errs } = await scene(page, { pages: 2 });
  await hz(page, true);
  const r = await page.evaluate(() => {
    const o = document.getElementById('preview-overlay'), blocks = [...document.querySelectorAll('#preview-content .preview-page-block')];
    const firsts = () => blocks.map((b) => b.querySelector('.preview-page-inner > .section-block').getBoundingClientRect().left);
    const a = firsts(); o.scrollLeft = 300; const b = firsts(); const moved = o.scrollLeft;
    return { ox: getComputedStyle(o).overflowX, bottomGap: Math.abs(o.getBoundingClientRect().bottom - window.innerHeight), scrolls: o.scrollWidth > o.clientWidth,
      blocks: blocks.map((x) => getComputedStyle(x).overflowX), together: b.every((v, i) => Math.abs((a[i] - v) - moved) < 1) && moved > 0 };
  });
  expect(r, '★스크롤러 = overlay · 아래끝 = 창 아래끝 · 줄 visible · 두 줄 함께').toEqual({ ox: 'auto', bottomGap: 0, scrolls: true, blocks: ['visible', 'visible'], together: true });
  await hz(page, false);
  expect(await page.evaluate(() => ({ ox: getComputedStyle(document.getElementById('preview-overlay')).overflowX, sl: document.getElementById('preview-overlay').scrollLeft })), '끄면 원복').toEqual({ ox: 'hidden', sl: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('H18 섹션 그릇이 쌓임 맥락 — 떠 있는 블럭(z 높음)도 #preview-content(z 0) 안에 갇힌다 · 세로·가로', async ({ page }) => {
  /* r5b — 스크롤바 자리 hit-test 는 버림: 맥 겹침 스크롤바(아이맥 헤드리스도 이 꼴 → 옛 탐침 0)는 hit 대상이 아니라 밑 섹션이 잡히고,
     고침(쌓임 가둠)은 «그리는 순서»를 바꿀 뿐 hit 를 안 바꾼다 ⇒ DOM hit 로는 못 잰다. 대신 «쌓임 사슬»을 잰다:
     떠 있는 블럭마다 #preview-overlay 바로 밑의 쌓임 맥락이 #preview-content(position ≠ static · z-index 0)인가. 잴 블럭이 0 이면 빨강(거짓 초록 금지). */
  await page.setViewportSize({ width: 1440, height: 900 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove());
    for (let i = 0; i < 6; i++) await window.addSection();
    window.flushCurrentPage(); window.enterPreview();
    document.querySelectorAll('#preview-content .section-block').forEach((s) => { const d = document.createElement('div'); d.className = 'zz-float'; d.style.cssText = 'position:absolute;inset:0;z-index:9999'; s.appendChild(d); });
  });
  const chain = () => page.evaluate(() => {
    const o = document.getElementById('preview-overlay');
    const isCtx = (el) => { const cs = getComputedStyle(el); return (cs.position !== 'static' && cs.zIndex !== 'auto') || cs.isolation === 'isolate' || cs.transform !== 'none' || parseFloat(cs.opacity) < 1; };
    const tops = [...document.querySelectorAll('#preview-content .zz-float')].map((f) => { let top = null; for (let el = f.parentElement; el && el !== o; el = el.parentElement) if (isCtx(el)) top = el; return top; });
    const pc = getComputedStyle(document.getElementById('preview-content'));
    return { n: tops.length, allInContent: tops.length > 0 && tops.every((t) => t?.id === 'preview-content'), z: pc.zIndex, positioned: pc.position !== 'static' };
  });
  const v = await chain();
  expect(v, '★세로 — 떠 있는 블럭 6 의 맨 바깥 쌓임 맥락 = #preview-content(z 0)').toEqual({ n: 6, allInContent: true, z: '0', positioned: true });
  await hz(page, true);
  expect(await chain(), '★가로 — 같은 가둠').toEqual({ n: 6, allInContent: true, z: '0', positioned: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('H19 기본 배율 50% — 진입 직후 · 가로 켜도 유지 · 다시 들어와도 50', async ({ page }) => {
  const { errs } = await scene(page);
  const st = () => page.evaluate(() => ({ d: document.getElementById('preview-zoom-display').textContent, t: document.getElementById('preview-content').style.transform, z: document.querySelector('#preview-content .preview-page-inner').style.zoom }));
  expect(await st(), '★진입 직후 50% · 통째 scale(0.5)').toEqual({ d: '50%', t: 'scale(0.5)', z: '' });
  await hz(page, true);
  expect(await st(), '★가로 켜도 50 · 줄 zoom 0.5 · 통째 transform 없음').toEqual({ d: '50%', t: '', z: '0.5' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.enterPreview());
  expect((await st()).d, '다시 들어와도 50%').toBe('50%');
  expect(errs, errs.join(' | ')).toEqual([]);
});
