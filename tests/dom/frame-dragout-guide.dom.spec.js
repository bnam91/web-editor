/* frame-dragout-guide — 프레임 안 블럭을 밖으로 끄는 동안 놓을 자리에 파란 가이드가 보인다(t2-09 · 현빈: tb_rwx4l_el1bvrj ⊂ ss_rwx4l_4tphcii).
 * 규칙: 스택 프레임·섹션 = .drop-indicator 선(+스택은 점선 테두리) · 자유 프레임 = ss-drag-over 점선 테두리만(놓는 자리가 좌표라 선 없음).
 * 칸: 자유 안 글자(포인터)·프레임 안 프레임(포인터)·스택 안 글자(H5) × 다른 자유 TF·다른 스택 TS·섹션 흐름 + 다른 종류 + 줌 100%.
 * 음성: 출처 자유 프레임 안 끌기 = 선·테두리 0 · 놓은 뒤·Esc 뒤 남는 가이드 0.
 * 양성대조: 기준판(e7d97f1ec)에서 TF 테두리 칸·프레임 안 프레임 칸 빨강 · _trackOutFrame 의 «지우기 먼저»를 되돌리면 TF 칸 빨강. 장면 준비만 evaluate, 끌기는 진짜 마우스. */
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
    /* ★int-2(t3-06 9d8728c59 뒤): 옛 장면은 K 를 넣을 때 «맨 아래+16» 으로 S 가 420→591 로 저절로 커졌다 — 그 뒤 넣는 다른 종류(아이콘 등)는
       S 세로 가운데(176)에 놓여 tS 글자 프레임(181~239) 밑을 비켜 갔다. t3-06 은 정한 높이 부모를 안 키운다(뜻한 바뀜) → S 420 그대로 →
       아이콘이 90 에 놓여 가운데가 tS 위 → 고르기 더블클릭이 tS 를 잡았다(인텔 실측). ⇒ 옛 장면의 S 크기(591)를 «정해» 준다. 재는 것(밖으로 끄는 가이드)은 그대로. */
    window.updateFrameBlock(S, { height: 591 });
    let X = extra && !extra[3] ? put(S, extra[0], extra[1], ...(extra[2] || [])) : null;
    /* S 가 X 를 다 품게 높이를 정한다 — 옛 장면은 K 의 기본 크기(860×520)로 S 가 저절로 커진 덕에 품었다(t3-05 뒤 80% 라 덜 커져 에셋이 TS 위로 넘쳤다) */
    if (X) { const f = document.getElementById(S), fr0 = f.getBoundingClientRect(), k = fr0.height / f.offsetHeight; const need = Math.ceil((document.getElementById(X).getBoundingClientRect().bottom - fr0.top) / k + parseFloat(getComputedStyle(f).paddingBottom)); if (need > f.offsetHeight) window.updateFrameBlock(S, { height: need }); }
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
const name = (ids) => Object.fromEntries(Object.entries(ids).filter(([, v]) => typeof v === 'string').map(([k, v]) => [v, k]));
/* 지금 보이는 가이드 — 점선 테두리가 붙은 프레임 · 표시선이 든 그릇(프레임 이름 또는 sec) */
const cue = (page, ids) => page.evaluate((nm) => ({
  over: [...document.querySelectorAll('.ss-drag-over')].map((e) => nm[e.id] || e.id),
  ind: [...document.querySelectorAll('.drop-indicator')].map((d) => { const f = d.parentElement.closest('.frame-block:not([data-text-frame])'); return f ? (nm[f.id] || f.id) : 'sec'; }),
}), name(ids));
const box = (page, id) => page.evaluate(({ id, FR }) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); const w = e.closest('.frame-block[data-text-frame]') || e; return { x: r.left + r.width / 2, y: r.top + r.height / 2, sel: e.classList.contains('selected'), par: e.parentElement.closest(FR)?.id || null, pos: w.style.position }; }, { id, FR });
const pick = async (page, id) => { await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; }); for (let i = 0; i < 6; i++) { const q = await box(page, id); if (q.sel) return true; await page.mouse.dblclick(q.x, q.y); /* B안: 자식은 더블클릭으로 진입해 잡힌다 */ await raf(page); } return (await box(page, id)).sel; };
/* 끌어서 «놓기 직전» 가이드를 재고 놓는다 */
async function dragCue(page, ids, from, to, { esc = false } = {}) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / STEPS, from.y + (to.y - from.y) * i / STEPS); await raf(page); }
  const during = await cue(page, ids);
  if (esc) await page.keyboard.press('Escape');
  await page.mouse.up(); await raf(page);
  return { during, after: await cue(page, ids) };
}
const NONE = { over: [], ind: [] };
const WANT = { TF: { over: ['TF'], ind: [] }, TS: { over: ['TS'], ind: ['TS'] }, sec: { over: [], ind: ['sec'] }, N: { over: ['N'], ind: ['N'] } };
const target = (page, s, t) => box(page, t === 'sec' ? s.tSec : s[t]);

for (const zoom of [40, 100]) for (const [src, t] of [['tS', 'TF'], ['tS', 'TS'], ['tS', 'sec'], ['tS', 'N'], ['K', 'TF'], ['K', 'TS'], ['K', 'sec']]) {
  if (zoom === 100 && !(src === 'tS' && t === 'TF')) continue;
  test(`줌 ${zoom}% · ${src === 'K' ? '프레임 안 프레임' : '자유 안 글자'} → ${t}: 놓기 직전 가이드, 놓은 뒤 남지 않는다`, async ({ page }) => {
    const s = await scene(page, zoom);
    expect(await pick(page, s[src]), '[전제] 고르기').toBe(true);
    const r = await dragCue(page, s, await box(page, s[src]), await target(page, s, t));
    expect(r.during, '끄는 동안').toEqual(WANT[t]);
    expect(r.after, '놓은 뒤').toEqual(NONE);
    const b = await box(page, s[src]);
    expect(b.par, '놓은 자리').toBe(t === 'sec' ? null : s[t]);
    if (t === 'TF') expect(b.pos, 'TF 안 좌표').toBe('absolute');
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
for (const t of ['TS', 'TF']) {
  test(`스택 안 글자(H5) → ${t}: ${t === 'TF' ? '테두리만, 흐름 선 없음' : '선 + 테두리'}`, async ({ page }) => {
    const s = await scene(page);
    expect(await pick(page, s.tTS), '[전제] 고르기').toBe(true);
    const to = t === 'TS' ? { ...(await box(page, s.tTS2)), y: (await box(page, s.tTS2)).y + 4 } : await box(page, s.TF);
    const r = await dragCue(page, s, await box(page, s.tTS), to);
    expect(r.during, '끄는 동안').toEqual(WANT[t]);
    expect(r.after, '놓은 뒤').toEqual(NONE);
    expect((await box(page, s.tTS)).par).toBe(s[t]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('Esc 로 그친 H5 끌기 뒤에 가이드가 남지 않는다', async ({ page }) => {
  const s = await scene(page);
  expect(await pick(page, s.tTS)).toBe(true);
  const r = await dragCue(page, s, await box(page, s.tTS), await box(page, s.TF), { esc: true });
  expect(r.during, '[전제] 끄는 동안').toEqual(WANT.TF);
  expect(r.after).toEqual(NONE);
});
for (const src of ['tS', 'K']) {
  test(`음성 — ${src === 'K' ? '프레임 안 프레임' : '자유 안 글자'}를 출처 자유 프레임 안에서 끌면 선도 테두리도 없다`, async ({ page }) => {
    const s = await scene(page);
    expect(await pick(page, s[src])).toBe(true);
    const a = await box(page, s[src]);
    const r = await dragCue(page, s, a, { x: a.x + (src === 'K' ? -60 : 30), y: a.y + 20 });
    expect(r.during).toEqual(NONE); expect(r.after).toEqual(NONE);
    expect((await box(page, s[src])).par).toBe(s.S);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
/* 다른 종류 — 자유 S 안에서 포인터로 끌어 TF·TS 로(글자와 같은 칸) */
const KINDS = [['에셋', ['.asset-block', 'addAssetBlock']], ['아이콘', ['.icon-circle-block', 'addIconCircleBlock']],
  ['그리드', ['.grid-block', 'addGridBlock', [{}]]], ['스텝', ['.step-block', 'addStepBlock']], ['도형', ['.shape-block', 'addShapeBlock', ['rectangle']]],
  ['스택 안 그리드(H5)', ['.grid-block', 'addGridBlock', [{}], 'TS']]];
for (const [kn, extra] of KINDS) for (const t of extra[3] ? ['TF'] : ['TF', 'TS']) {   // 스택 안 그리드 → 섹션 흐름 선은 프레임 밖(섹션·블럭 H5) 길이라 이 표에 안 넣는다
  test(`다른 종류 ${kn} → ${t}`, async ({ page }) => {
    const s = await scene(page, 40, extra);
    expect(await pick(page, s.X), '[전제] 고르기').toBe(true);
    /* 그리드 가운데는 칸 사이 틈(grd-gutter)이라 안 잡힌다 — 첫 칸을 잡는다 · 도형은 제 래퍼 프레임째 옮겨진다 */
    const from = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + 12, y: r.top + 12 }; }, s.X);
    const who = kn === '도형' ? await page.evaluate((id) => document.getElementById(id).closest('.frame-block').id, s.X) : s.X;
    const r = await dragCue(page, s, kn.includes('그리드') ? from : await box(page, s.X), await target(page, s, t));
    expect(r.during).toEqual(WANT[t]); expect(r.after).toEqual(NONE);
    expect((await box(page, who)).par).toBe(t === 'sec' ? null : s[t]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
