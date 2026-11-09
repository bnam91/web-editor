/* grid-circle-align-handles.dom.spec.js — GRID-CIRCLE-LEFT-ALIGN-NW-SW-HANDLE-DEAD-01
 * 현빈QA·지디: 그리드 칸 원형 그림이 «왼쪽 정렬»이면 nw·sw 손잡이가 아예 안 잡힌다(고치기 전 판부터) · 가운데 정렬은 sw 잡힘.
 * 이 검사 = 정렬 3 × 손잡이 4 를 «진짜 마우스»로 잡아 끈다(page.mouse down → move → up · 합성 이벤트 0).
 *   각 칸: 손잡이 중심의 맨 위 요소(elementsFromPoint[0])와 «잡혔나»(모델 height 가 늘었나)를 표로 찍는다 — 원인 실측이 같은 런에서 나온다.
 *   끄는 쪽은 바깥으로(지름을 키우는 쪽): 원 지름은 세로 끌기 dy 만 따른다(규칙 무변경 · 현빈 판단 대기 줄) ⇒ n 은 위로, s 는 아래로.
 * 픽스처: 2열 그리드(왼쪽 칸 = 원 그림 + 아래 글 · 오른쪽 칸 = 글 + 사각 그림) · 섹션 위아래 틈.
 * 양성대조: 고침 커밋의 js 만 7ebe83a72 로 되돌리면 안 잡히던 칸(표의 ✗)이 빨강. 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PX2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGNQSjujlHYGAAf/AqmCyMKsAAAAAElFTkSuQmCC';
const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function setup(page, align) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((align) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [
      { width: 1, lines: [{ type: 'image', imgSrc: window.__PX, imgShape: 'circle', height: 120, align }, { type: 'body', text: '원 아래 글' }] },
      { width: 1, lines: [{ type: 'body', text: '오른쪽 칸 글' }, { type: 'image', imgSrc: window.__PX2, height: 90 }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.(); window.clearHistory?.();
  }, align);
  await raf(page);
  const { cx: x, cy: y } = await waitStableRect(page, '#gG .grd-img-frame.grd-img-circle');
  await page.mouse.click(x, y); await raf(page);
  await page.mouse.click(x, y); await raf(page);
  await page.waitForFunction(() => [...document.querySelectorAll('.grd-img-overlay-handle')].filter(h => h.style.display !== 'none').length === 4, null, { timeout: 10000 });
  return errs;
}
const height = (page) => page.evaluate(() => JSON.parse(document.getElementById('gG').dataset.cols)[0].lines[0].height);
/* 손잡이 중심의 맨 위 요소 — 손잡이 자신이 아니면 «무엇이 덮었나» */
const topAt = (page, dir) => page.evaluate((dir) => {
  const h = document.querySelector(`.grd-img-overlay-handle.${dir}`); const r = h.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2; const t = document.elementsFromPoint(x, y)[0];
  const f = document.querySelector('#gG .grd-img-frame.grd-img-circle').getBoundingClientRect(); const g = document.getElementById('gG').getBoundingClientRect();
  return { x: +x.toFixed(1), y: +y.toFixed(1), top: t === h ? 'HANDLE' : `${t?.tagName}#${t?.id || ''}.${String(t?.className || '').replace(/\s+/g, '.')}`,
    frameL: +f.left.toFixed(1), gridL: +g.left.toFixed(1), frameR: +f.right.toFixed(1), gridR: +g.right.toFixed(1) };
}, dir);
const OUT = { nw: [-12, -24], ne: [12, -24], sw: [-12, 24], se: [12, 24] };

for (const align of ['left', 'center', 'right']) {
  test(`A-${align} 원 ${align} 정렬 — nw·ne·sw·se 넷 다 진짜 마우스로 잡혀 지름이 는다`, async ({ page }) => {
    await page.addInitScript(([a, b]) => { window.__PX = a; window.__PX2 = b; }, [PX, PX2]);
    const errs = await setup(page, align);
    const rows = [];
    for (const dir of ['nw', 'ne', 'sw', 'se']) {
      await page.waitForFunction((d) => { const h = document.querySelector(`.grd-img-overlay-handle.${d}`); return h && h.style.display !== 'none'; }, dir, { timeout: 10000 });
      const at = await topAt(page, dir);
      const h0 = await height(page);
      const [dx, dy] = OUT[dir];
      await page.mouse.move(at.x, at.y); await page.mouse.down();
      for (let i = 1; i <= 3; i++) { await page.mouse.move(at.x + dx * i / 3, at.y + dy * i / 3); await raf(page); }
      await page.mouse.up(); await raf(page);
      const h1 = await height(page);
      rows.push({ align, dir, grabbed: h1 - h0 > 10, h0, h1, ...at });
    }
    console.log(`[A-${align}] ` + JSON.stringify(rows));
    for (const r of rows) expect(r.grabbed, `★${r.align} ${r.dir} 손잡이가 안 잡혔다 — 맨 위 ${r.top} @${r.x},${r.y} (원 왼쪽 ${r.frameL} · 그리드 왼쪽 ${r.gridL} · 원 오른쪽 ${r.frameR} · 그리드 오른쪽 ${r.gridR}) · height ${r.h0}→${r.h1}`).toBe(true);
    expect(errs).toEqual([]);
  });
}
