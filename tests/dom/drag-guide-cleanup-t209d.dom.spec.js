/* drag-guide-cleanup-t209d — 끄는 중 창이 포커스를 잃거나(blur·탭 숨김) Esc 를 누르면 파란 가이드(.drop-indicator · .ss-drag-over · 스마트 가이드)가 걷힌다(t2-09d).
 * 기준판(afc340315) 실측: 포인터 끌기(자유 안 글자 tS · 프레임 안 프레임 K)와 H5 끌기(스택 안 글자 tTS) 모두 blur·숨김 뒤 가이드가 다음 놓기까지 남았다(포인터는 Esc 도).
 * 끌기 결과는 옛 그대로 — 그 일들은 끌기를 끝내지 않는다(그 뒤 손을 떼면 TF 에 든다 · 기록 +1). 창 밖 mouseup·dragend 는 옛부터 onUp 이 끝내고 걷는다(대조로 같이 잰다).
 * H5 길에 합성 mouseup 칸은 없다 — 네이티브 끌기 중엔 mouse 이벤트가 끌기를 끝내지 않는다(실측: 기준판도 무시).
 * 양성대조: block-drag.js 를 afc340315 로 되돌리면 blur·hidden·esc 칸(H5 esc 제외)이 빨강. 장면 준비만 evaluate, 끌기는 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const STEPS = 12;
const FR = '.frame-block:not([data-text-frame])';

async function scene(page, zoom = 40, extra = null) {
  await page.setViewportSize({ width: 1500, height: 1600 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ({ FR, extra }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__sec = sec.id;
    const into = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; };
    const done = () => { window.deselectAll(); window._activeFrame = null; };
    const fr = (par, w, h, l, t) => { into(par); const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; } done(); return f.id; };
    const put = (par, sel, fn, ...a) => { into(par); const b = new Set(sec.querySelectorAll(sel)); window[fn](...a); const e = [...sec.querySelectorAll(sel)].find((x) => !b.has(x)); done(); if (!e.id) e.id = 'k' + Math.random().toString(36).slice(2, 9); return e.id; };
    const S = fr(null, 700, 420); const tS = put(S, '.text-block', 'addTextBlock', 'body');
    const K = fr(S, 220, 90, 440, 300);
    let X = extra && !extra[3] ? put(S, extra[0], extra[1], ...(extra[2] || [])) : null;
    const TS = fr(null, 700, 260); const tTS = put(TS, '.text-block', 'addTextBlock', 'body'); const tTS2 = put(TS, '.text-block', 'addTextBlock', 'body');
    [[tTS, 20], [tTS2, 150]].forEach(([id, t]) => { const w = document.getElementById(id).closest('[data-text-frame]'); w.style.top = t + 'px'; w.dataset.offsetY = t; });   // 나란히면 스택으로 못 바꾼다
    window.__convertFreeLayoutToStack(document.getElementById(TS));
    if (extra?.[3]) X = put(TS, extra[0], extra[1], ...(extra[2] || []));   // 스택 TS 안 흐름 자식
    const TF = fr(null, 700, 300); put(TF, '.text-block', 'addTextBlock', 'body');
    const P = fr(null, 760, 360); const N = fr(P, 400, 200, 20, 20); put(N, '.text-block', 'addTextBlock', 'body');
    window.__convertFreeLayoutToStack(document.getElementById(N));
    const tSec = put(null, '.text-block', 'addTextBlock', 'body');
    return { S, tS, K, X, TS, tTS, tTS2, TF, P, N, tSec };
  }, { FR, extra });
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
  await page.evaluate((z) => window.applyZoom(z), zoom); await waitZoomSettled(page, zoom);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start' }), ids.S); await raf(page);
  return { errs, ...ids };
}
const box = (page, id) => page.evaluate(({ id, FR }) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); const w = e.closest('.frame-block[data-text-frame]') || e; return { x: r.left + r.width / 2, y: r.top + r.height / 2, sel: e.classList.contains('selected'), par: e.parentElement.closest(FR)?.id || null, pos: w.style.position }; }, { id, FR });
const pick = async (page, id) => { await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; }); for (let i = 0; i < 6; i++) { const q = await box(page, id); if (q.sel) return true; await page.mouse.dblclick(q.x, q.y); /* B안: 자식은 더블클릭으로 진입해 잡힌다 */ await raf(page); } return (await box(page, id)).sel; };

const ST = (page, id) => page.evaluate(({ id, FR }) => {
  const e = document.getElementById(id); const w = e.closest('.frame-block[data-text-frame]') || e;
  return { cue: document.querySelectorAll('.drop-indicator, .ss-drag-over, .smart-guide, .smart-guide-label').length,
    drg: document.querySelectorAll('.dragging').length,
    par: e.parentElement.closest(FR)?.id || 'sec', pos: w.style.position, l: w.style.left, t: w.style.top, h: historyStack.length, hp: historyPos };
}, { id, FR });
const ENDS = {
  blur: (p) => p.evaluate(() => window.dispatchEvent(new Event('blur'))),
  hidden: (p) => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }),
  esc: (p) => p.keyboard.press('Escape'),
  upOut: (p) => p.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: -40, clientY: -40 }))),
  realUpOut: async (p) => { await p.mouse.move(-30, 800); await p.mouse.up(); },
  dragend: (p) => p.evaluate(() => { const dt = new DataTransfer(); dt.dropEffect = 'none'; (document.querySelector('.dragging') || document).dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); }),
};
/* 그 일 뒤 «끌기가 이어지는가»(옛 동작) — 이어지면 손을 떼야 TF 에 든다. 아니면 그 일이 놓기(창 밖 = 포인터가 정한 자리)다. */
const GOES_ON = { blur: true, hidden: true, esc: true, upOut: false, realUpOut: false, dragend: false };
const CELLS = [];
for (const src of ['tS', 'K']) for (const end of Object.keys(ENDS)) CELLS.push([src, end]);
for (const end of ['blur', 'hidden', 'esc', 'dragend']) CELLS.push(['tTS', end]);
/* 옛 동작(기준판 실측) — 놓인 자리. TF = 커서 아래 자유 프레임 · sec = 섹션 흐름 · start = 그대로 */
const LAND = { tS: { upOut: 'TF', realUpOut: 'sec', dragend: 'TF' }, K: { upOut: 'sec', realUpOut: 'sec', dragend: 'TF' }, tTS: { esc: 'start', dragend: 'start' } };
const SRC = { tS: '자유 안 글자(포인터)', K: '프레임 안 프레임(포인터)', tTS: '스택 안 글자(H5)' };

for (const [src, end] of CELLS) {
  test(`${SRC[src]} · ${end}: 가이드 0, 끌기 결과는 옛 그대로`, async ({ page }) => {
    const s = await scene(page);
    expect(await pick(page, s[src]), '[전제] 고르기').toBe(true);
    const pre = await ST(page, s[src]);
    const from = await box(page, s[src]), to = await box(page, s.TF);
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / STEPS, from.y + (to.y - from.y) * i / STEPS); await raf(page); }
    const dur = await ST(page, s[src]);
    expect(dur.cue, '[전제] 끄는 동안 가이드').toBeGreaterThan(0);
    await ENDS[end](page); await raf(page);
    const aft = await ST(page, s[src]);
    expect(aft.cue, `${end} 뒤 가이드`).toBe(0);
    const goesOn = GOES_ON[end] && !(src === 'tTS' && end === 'esc');   // H5 Esc 는 브라우저가 끌기를 거둔다(dragend)
    if (goesOn) {
      expect({ ...aft, cue: 0, drg: 0 }, `${end} 은 끌기를 끝내지 않는다 — 자리·기록 그대로`).toEqual({ ...dur, cue: 0, drg: 0 });
      expect(aft.h, '기록 그대로').toBe(pre.h);
      if (src !== 'tTS') {   // 다음 움직임이 가이드를 다시 그린다(끌기가 이어진다)
        await page.mouse.move(to.x + 4, to.y + 2); await raf(page);
        expect((await ST(page, s[src])).cue, '다시 움직이면 가이드').toBeGreaterThan(0);
      }
      await page.mouse.up(); await raf(page);
      const fin = await ST(page, s[src]);
      expect(fin.par, '떼면 TF 에 든다(옛 그대로)').toBe(s.TF);
      expect(fin.cue + fin.drg, '놓은 뒤 가이드').toBe(0);
    } else {
      if (end !== 'realUpOut') await page.mouse.up(); await raf(page);
      const fin = await ST(page, s[src]);
      const land = LAND[src][end];
      expect(fin.par, `놓인 자리(옛 그대로: ${land})`).toBe(land === 'start' ? pre.par : land === 'sec' ? 'sec' : s.TF);
      if (land === 'start') expect([fin.pos, fin.l, fin.t, fin.h], '그대로 · 기록 그대로').toEqual([pre.pos, pre.l, pre.t, pre.h]);
      expect(fin.cue + fin.drg, '놓은 뒤 가이드').toBe(0);
    }
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
/* 대조 — 그냥 놓으면 TF 에 들고 가이드가 걷힌다(기록 +1) */
for (const src of ['tS', 'K', 'tTS']) {
  test(`대조 · ${SRC[src]} 그냥 놓기`, async ({ page }) => {
    const s = await scene(page);
    expect(await pick(page, s[src])).toBe(true);
    const pre = await ST(page, s[src]);
    const from = await box(page, s[src]), to = await box(page, s.TF);
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / STEPS, from.y + (to.y - from.y) * i / STEPS); await raf(page); }
    expect((await ST(page, s[src])).cue).toBeGreaterThan(0);
    await page.mouse.up(); await raf(page);
    const fin = await ST(page, s[src]);
    expect(fin.par).toBe(s.TF); expect(fin.cue + fin.drg).toBe(0);
    if (src !== 'tTS') expect(fin.h).toBe(pre.h + 1);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
