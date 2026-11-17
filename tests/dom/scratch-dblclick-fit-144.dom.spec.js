/* scratch-dblclick-fit-144 — 0.9.12 144행 NEW-현빈QA-SCRATCH-DBLCLICK-FIT-SECTION-WIDTH-01 (현빈 261117)
 *   현빈: 스크래치 항목을 더블클릭하면 폭을 섹션 너비로 맞춘다 · 비율 유지.
 *   착수 전 실측(코드): 장 더블클릭 = 그룹이면 그룹 진입(⑦ 2026-10-10) · 그룹 아니면 «아무 일 없음»(scratch-pad.js 주석 그대로) ·
 *     바깥틀 더블클릭(scratchpad-link 당기기)은 .scratch-item 위에선 손을 뗀다 ⇒ 그룹 아닌 장의 더블클릭은 빈자리였다(부딪힘 0).
 *   섹션 너비 = 살아 있는 #canvas 폭(css #canvas width · 레이아웃 px) — 860 을 시험에도 안 적는다.
 * 칸
 *   F1 그룹 아닌 장 더블클릭 → 폭 = #canvas 폭 · 높이/폭 = 그림 비율(1/2) · 왼위 그대로
 *   F2 저장 뒤 다시 열어도(디스크에서 다시 읽기) 그 폭
 *   F3 ⌘Z 한 번 = 원래 폭
 *   F4 [지킴] 그룹 장 더블클릭 = 그룹 진입(옛 동작) · 폭 무변
 * 양성대조: _patches/controls/SFIT-CTL.patch(scratch-pad.js 를 base 로) → F1·F2·F3 빨강 · F4 초록.
 * 안 잰 것: 실앱(일렉트론) 저장 파일 · 여러 장 골라 더블클릭(그 한 장만 맞춘다).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PID = 'proj_sfit144';
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const cur = await page.evaluate(async (pid) => {
    window.applyZoom?.(100);
    const cur = window.state.currentPageId;
    await window.initScratchPad(pid, cur);
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 200; const g = cv.getContext('2d'); g.fillStyle = '#3366cc'; g.fillRect(0, 0, 400, 200);
    const src = cv.toDataURL('image/png');
    await window._scratchAddAndSave(src, 960, 120, 200, undefined, 'sf_a');
    await window._scratchAddAndSave(src, 960, 400, 160, undefined, 'sf_b');
    await window._scratchAddAndSave(src, 1200, 400, 160, undefined, 'sf_c');
    return cur;
  }, PID);
  await page.waitForFunction(() => [...document.querySelectorAll('.scratch-item img')].length === 3 && [...document.querySelectorAll('.scratch-item img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  return { errs, cur };
}
const geo = (page, id) => page.evaluate((id) => { const e = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`);
  const im = e && e.querySelector('img');   // w = 장 폭(style.width = item.w) · 비율은 그려진 그림 상자에서
  return e ? { w: parseFloat(e.style.width), h: im.offsetHeight, iw: im.offsetWidth, x: parseFloat(e.style.left), y: parseFloat(e.style.top), cw: document.getElementById('canvas').offsetWidth } : null; }, id);
/* r2(지디 아이맥 69afd3743 ◑: F1 «860 ← 200» = CTL 과 같은 꼴) — 옛 판은 좌표를 한 번 재고 page.mouse.dblclick 했다(장면 직후 · 장·배율이 아직 움직이면 옛 좌표).
   ⇒ scratch-group-mode(초록) 와 같은 손: 장 locator.dblclick — Playwright 가 «멎었나·그 점이 그 장을 맞히나»를 보고 누른다.
   진단: 창 capture 로 받은 pointerdown/mousedown/dblclick 대상 · 제외 판정 값(대상이 칩·손잡이·✂ 인가) · 그 장 selected 를 F1 실패 메시지에. */
async function dbl(page, id) {
  await page.evaluate(() => {
    window.__sfit = [];
    const tag = (e) => (e && e.nodeType === 1) ? (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? e.tagName).split(' ')[0] : String(e);
    for (const t of ['pointerdown', 'mousedown', 'dblclick']) window.addEventListener(t, (e) => {
      const it = e.target?.closest?.('.scratch-item');
      window.__sfit.push([t, Math.round(e.clientX), Math.round(e.clientY), tag(e.target), it?.dataset.scratchId ?? null,
        !!e.target?.closest?.('.scratch-id-chip, .scratch-resize, .scratch-slice-btn'), e.defaultPrevented]);
    }, true);
  });
  await page.locator(`.scratch-item[data-scratch-id="${id}"]`).dblclick();
}
const sfitDiag = (page, id) => page.evaluate((id) => ({ ev: window.__sfit, sel: !!document.querySelector(`.scratch-item.scratch-selected[data-scratch-id="${id}"]`),
  mode: window._scratchGroupMode?.() ?? null, group: document.querySelector(`.scratch-item[data-scratch-id="${id}"]`)?.dataset.scratchGroup ?? null }), id);
const reread = (page, cur) => page.evaluate(async ([pid, cur]) => { await window.initScratchPad(pid, 'page_other'); await window.initScratchPad(pid, cur); }, [PID, cur]);

test('F1·F2·F3 그룹 아닌 장 더블클릭 = 폭이 섹션 너비 · 비율 유지 · 다시 열어도 · ⌘Z 한 번 = 원래 폭', async ({ page }) => {
  const { errs, cur } = await setup(page);
  const g0 = await geo(page, 'sf_a');
  expect([g0.w, g0.cw > g0.w], '[전제] 처음 폭 200 · 섹션 너비가 더 넓다').toEqual([200, true]);
  await dbl(page, 'sf_a');
  const d1 = await sfitDiag(page, 'sf_a');   // dblclick() 가 끝나면 사건은 다 지나갔다
  console.log('[SFIT-DIAG] ' + JSON.stringify(d1));
  await expect.poll(async () => (await geo(page, 'sf_a')).w, `F1 — 더블클릭 뒤 폭 = #canvas 폭 · 진단 ${JSON.stringify(d1)}`).toBe(g0.cw);
  const g1 = await geo(page, 'sf_a');
  expect(Math.abs(g1.iw - g1.w) <= 2 && Math.abs(g1.h / g1.iw - 0.5) < 0.01, `F1 — 그림이 새 폭으로 그려지고 비율 유지(높이/폭 = 1/2) · ${JSON.stringify(g1)}`).toBe(true);
  expect([g1.x, g1.y], 'F1 — 왼위 그대로').toEqual([g0.x, g0.y]);
  await expect.poll(async () => { await reread(page, cur); return (await geo(page, 'sf_a'))?.w; }, 'F2 — 디스크에서 다시 읽어도 그 폭').toBe(g0.cw);
  await page.mouse.click(300, 900);   // 캔버스 포커스(입력칸 밖)
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await geo(page, 'sf_a')).w, 'F3 — ⌘Z 한 번 = 원래 폭').toBe(200);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('F4 [지킴] 그룹 장 더블클릭 = 그룹 진입(옛 동작) · 폭 무변', async ({ page }) => {
  const { errs } = await setup(page);
  for (const [i, id] of ['sf_b', 'sf_c'].entries()) {
    await page.locator(`.scratch-item[data-scratch-id="${id}"]`).click({ modifiers: i ? ['Shift'] : [] });
    await page.waitForFunction((id) => !!document.querySelector(`.scratch-item.scratch-selected[data-scratch-id="${id}"]`), id, { timeout: 15000 });
  }
  await page.evaluate(() => window._scratchGroupAndAlign?.());
  await page.waitForFunction(() => [...document.querySelectorAll('.scratch-item')].filter((e) => e.dataset.scratchGroup).length === 2, null, { timeout: 15000 });
  await page.mouse.click(300, 900);
  await page.waitForFunction(() => !document.querySelector('.scratch-item.scratch-selected'), null, { timeout: 15000 });
  const w0 = (await geo(page, 'sf_b')).w;
  await dbl(page, 'sf_b');
  await expect.poll(() => page.evaluate(() => window._scratchGroupMode?.() ?? null), 'F4 — 그룹 진입').not.toBe(null);
  expect((await geo(page, 'sf_b')).w, 'F4 — 그룹 장 폭 무변').toBe(w0);
  expect(errs, errs.join('\n')).toEqual([]);
});
