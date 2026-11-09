/* frame-defaults-nested-t305 — 현빈 t3-05: 섹션에 처음 만드는 프레임 = #D9D9D9 · 프레임 안에 만드는 자식 = #FFFFFF ＋ 부모 크기의 80%.
 * 규칙(팀장): 깊이 무관 «섹션 직속이 아니면» #FFFFFF · 크기 = 제 부모 안쪽 상자(clientW/H − padding)의 80%, 반올림.
 * ㉠(t3-07) 그대로: 한 번 클릭(오브젝트 선택) → 다음 형제 = 섹션 직속 = #D9D9D9.
 * 하네스 = df-key-create 꼴(bootApp · 진짜 키·클릭 · rAF·expect.poll). */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const TXT = (id, t) => `<div class="frame-block" id="${id}F" data-text-frame="true" data-bg="transparent" style="background:transparent;width:100%;box-sizing:border-box;"><div class="text-block" id="${id}" data-type="body"><div class="tb-body" contenteditable="false">${t}</div></div></div>`;
const SCENE = `<div class="section-block" id="sH" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inH" style="padding-left: 32px; padding-right: 32px;">
  <div class="gap-block" id="g0" data-type="gap" style="height:30px"></div>
  <div class="row" id="rowO" data-layout="stack"><div class="frame-block" id="OLD" data-free-layout="true" data-bg="#ffffff" data-width="860" data-height="520" style="background:#ffffff;padding:0;width:860px;max-width:100%;margin:0 auto;min-height:520px;height:520px;"></div></div>
  <div class="row" id="rowE" data-layout="stack"><div class="frame-block" id="EF" data-free-layout="true" style="position:relative;width:600px;height:200px;"></div></div>
  <div class="row" id="rowL" data-layout="stack"><div class="frame-block" id="FL" data-full-width="true" style="width:600px;min-height:200px;padding:10px;box-sizing:border-box;">${TXT('k1', '첫째')}</div></div>
  <div class="gap-block" id="gAfter" data-type="gap" style="height:300px"></div></div></div>`;

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.();
  }, SCENE);
  await raf(page);
  return errs;
}
const ids = (page) => page.evaluate((s) => [...document.querySelectorAll('#canvas ' + s)].map((e) => e.id), FR);
const scrollTo = (page, id) => page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
const center = async (page, id) => { await waitStableRect(page, '#' + id); return page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id); };
const emptyPoint = (page, id) => page.evaluate((id) => { const f = document.getElementById(id); const r = f.getBoundingClientRect();
  for (let y = Math.round(r.bottom - 6); y > r.top; y -= 4) for (const x of [Math.round(r.right - 10), Math.round(r.left + 10)]) if (document.elementFromPoint(x, y) === f) return [x, y]; return null; }, id);
async function until(page, ok, act) { for (let i = 0; i < 3 && !(await ok()); i++) { await act(); await raf(page); } expect(await ok(), '[전제] 고르기').toBe(true); }

const FRAME_BTN = async (page) => { const b = await page.evaluate(() => { const e = [...document.querySelectorAll('button[title]')].find((x) => x.title.includes('Frame 추가') && x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await page.mouse.click(...b); };
const HOW = { F: (page) => page.keyboard.press('f'), 'Frame 추가': FRAME_BTN };
/* 하나 만들고 그 id */
async function make(page, how) {
  const before = await ids(page);
  await HOW[how](page);
  await expect.poll(async () => (await ids(page)).length - before.length, `${how}: 하나 생김`).toBe(1);
  return (await ids(page)).find((x) => !before.includes(x));
}
const info = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); const p = e.parentElement.closest('.frame-block:not([data-text-frame])');
  return { bg: e.dataset.bg, css: getComputedStyle(e).backgroundColor, w: e.offsetWidth, h: e.offsetHeight, dw: e.dataset.width, dh: e.dataset.height, parent: p?.id || null }; }, id);
/* 부모 안쪽 상자의 80% — 만들기 «전»에 잰다(흐름 부모는 자식이 들면 자란다) */
const want80 = (page, id) => page.evaluate((id) => { const f = document.getElementById(id); const cs = getComputedStyle(f);
  return { w: Math.round((f.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.8), h: Math.round((f.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) * 0.8) }; }, id);
const enter = async (page, id) => { await scrollTo(page, id);
  await until(page, () => page.evaluate((id) => window._enteredFrame?.id === id && !document.querySelector(`#${id} .selected`), id), async () => { const p = await emptyPoint(page, id); await page.mouse.dblclick(...p); }); };
const section = (page) => page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window.selectSection(document.getElementById('sH')); });
const GRAY = { bg: '#D9D9D9', css: 'rgb(217, 217, 217)' };
const WHITE = { bg: '#FFFFFF', css: 'rgb(255, 255, 255)' };
const expect80 = (r, w, tag) => { expect(Math.abs(r.w - w.w), `${tag} 폭 ${r.w} ≈ ${w.w}`).toBeLessThanOrEqual(1); expect(Math.abs(r.h - w.h), `${tag} 높이 ${r.h} ≈ ${w.h}`).toBeLessThanOrEqual(1); };

for (const how of Object.keys(HOW)) {
  test(`${how} · 섹션 선택 → #D9D9D9 · 860×520 그대로`, async ({ page }) => {
    const errs = await scene(page);
    await section(page);
    const r = await info(page, await make(page, how));
    expect(r, JSON.stringify(r)).toMatchObject({ ...GRAY, parent: null, dw: '860', dh: '520' });
    expect(errs, errs.join(' | ')).toEqual([]);
  });
  for (const host of ['EF', 'FL']) test(`${how} · ${host}(${host === 'EF' ? '자유배치' : '흐름·padding 10'}) 더블클릭 진입 → 자식 #FFFFFF · 부모 80%`, async ({ page }) => {
    const errs = await scene(page);
    await enter(page, host);
    const w = await want80(page, host);
    const r = await info(page, await make(page, how));
    expect(r, JSON.stringify(r)).toMatchObject({ ...WHITE, parent: host, dw: String(w.w), dh: String(w.h) });
    expect80(r, w, host);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('깊이 3 — 자식 프레임에 들어가 F → #FFFFFF · 그 자식의 80%', async ({ page }) => {
  const errs = await scene(page);
  await enter(page, 'EF');
  const c = await make(page, 'F');
  await enter(page, c);
  const w = await want80(page, c);
  const r = await info(page, await make(page, 'F'));
  expect(r, JSON.stringify(r)).toMatchObject({ ...WHITE, parent: c });
  expect80(r, w, 'depth3');
  expect(w, '부모가 480×160(=600×200 의 80%)').toEqual({ w: 384, h: 128 });
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('㉠ — 프레임 한 번 클릭 → F = 다음 형제(섹션 직속) = #D9D9D9', async ({ page }) => {
  const errs = await scene(page);
  await scrollTo(page, 'EF');
  await until(page, () => page.evaluate(() => document.getElementById('EF').classList.contains('selected') && window._enteredFrame?.id !== 'EF'),
    async () => { const p = await center(page, 'EF'); await page.mouse.click(...p); });
  const id = await make(page, 'F');
  const r = await info(page, id);
  expect(r, JSON.stringify(r)).toMatchObject({ ...GRAY, parent: null, dw: '860', dh: '520' });
  expect(await page.evaluate((id) => { let u = document.getElementById(id); while (u.parentElement.id !== 'inH') u = u.parentElement; return u.previousElementSibling?.id; }, id), '다음 형제').toBe('rowE');
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('⌘Z 한 번 — 자식 프레임이 사라지고 직렬이 그대로', async ({ page }) => {
  const errs = await scene(page);
  await enter(page, 'EF');
  const s0 = await page.evaluate(() => window.getSerializedCanvas());
  await make(page, 'F');
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => window.getSerializedCanvas()), '⌘Z 한 번 뒤 직렬 = 전').toBe(s0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('저장 → 다시 열기 — 새 프레임 색·크기 유지 · 옛 프레임(#ffffff 860×520) 그대로', async ({ page }) => {
  const errs = await scene(page);
  await section(page);
  const a = await make(page, 'F');
  await enter(page, 'EF');
  const b = await make(page, 'F');
  const pick = () => Promise.all([a, b, 'OLD'].map((id) => info(page, id)));
  const s0 = await pick();
  expect(s0[2], '[전제] 옛 프레임').toMatchObject({ bg: '#ffffff', css: 'rgb(255, 255, 255)', dw: '860', dh: '520' });
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
  await expect.poll(() => page.evaluate(() => !!document.getElementById('OLD'))).toBe(true);
  await raf(page);
  expect(await pick()).toEqual(s0);
  expect(s0[0]).toMatchObject(GRAY);
  expect(s0[1]).toMatchObject({ ...WHITE, w: 480, h: 160 });
  expect(errs, errs.join(' | ')).toEqual([]);
});
