/* frame-drop-keeps-block-365 — 프레임 drop 의 row 경로가 블럭을 지우지 않는다(365 · S3 J294L · 데이터 손실).
 * 끌어 놓기 전후 수는 진짜 마우스 HTML5 끌기로 잰다. 저장본은 serializeProject → applyProjectData 왕복. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const LOST_6 = ['chat-block', 'coupon-block', 'quote-block', 'radial-block', 'laurel-block', 'qa-block'];

const open = async (page) => { await page.setViewportSize({ width: 1500, height: 1400 }); await bootApp(page); await page.evaluate(() => window.applyZoom(40)); await waitZoomSettled(page, 40); };
const rosterOf = (page) => page.evaluate(() => { const adds = Object.keys(window).filter((k) => /^add.*Block$/.test(k)); const flat = (s) => s.replace(/-/g, '').toLowerCase(); return window.SECTION_BLOCK_TYPE_SEL.split(', ').map((s) => s.slice(1)).map((cls) => ({ cls, entry: adds.find((a) => a.toLowerCase() === 'add' + flat(cls).replace(/block$/, '') + 'block') || (cls === 'icon-block' ? 'addIconifyBlock' : null) })); });
/* host: section = 블럭이 섹션 직속 · stack = 위 스택 프레임 안(prop-frame.js 스택 전환과 같은 칸) */
const scene = (page, kinds, host) => page.evaluate(async ({ kinds, host, FR }) => {
  document.querySelector('.smp-close')?.click();   // 앞 종이 띄운 고르기 창 — 남으면 다음 끌기를 가린다
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop();
  const addFrame = (h) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].pop(); window.updateFrameBlock(f.id, { width: 700, height: h }); return f; };
  let S = null; if (host === 'stack') { S = addFrame(300); delete S.dataset.freeLayout; delete S.dataset.height; S.dataset.fullWidth = 'true'; S.style.height = ''; S.style.minHeight = ''; }
  const F = addFrame(400);
  const ids = []; for (const { cls, entry } of kinds) { window.deselectAll(); window.selectSection(sec); window._activeFrame = S; const b = new Set(sec.querySelectorAll('.' + cls)); await window[entry](); const k = [...sec.querySelectorAll('.' + cls)].find((x) => !b.has(x)); if (!k.id) k.id = 'blk_' + Math.random().toString(36).slice(2, 9); ids.push(k.id); }
  window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); F.scrollIntoView({ block: 'center' });
  return { ids, free: F.id, stack: S?.id || null };
}, { kinds, host, FR });
const center = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const STEPS = 12;
async function dragTo(page, from, to) { await page.mouse.move(from[0], from[1]); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from[0] + (to[0] - from[0]) * i / STEPS, from[1] + (to[1] - from[1]) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
async function dropOnFree(page, s, id) {
  const fromStack = s.stack && await page.evaluate(([a, b]) => document.getElementById(a).contains(document.getElementById(b)), [s.stack, id]);
  if (fromStack) { const r = await page.evaluate((a) => { const b = document.getElementById(a).getBoundingClientRect(); return [b.left + 6, b.top + 6]; }, s.stack); await page.mouse.click(r[0], r[1]); await raf(page); }
  const from = await center(page, id); await page.mouse.click(from[0], from[1]); await raf(page);
  await dragTo(page, await center(page, id), await center(page, s.free));
}
const count = (page, cls) => page.evaluate((cls) => document.querySelectorAll('#canvas .' + cls).length, cls);
const reopen = async (page) => { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await raf(page); };
const where = (page, id, free) => page.evaluate(([id, free]) => { const e = document.getElementById(id), f = document.getElementById(free); return e && { inFree: f.contains(e), abs: e.style.position === 'absolute', w: e.offsetWidth, h: e.offsetHeight, l: parseInt(e.style.left), t: parseInt(e.style.top) }; }, [id, free]);

for (const host of ['section', 'stack']) {
  test(`33종 어느 것도 자유 프레임에 놓아 사라지지 않고 빠졌던 6종은 안에 든다 — ${host}`, async ({ page }) => {
    test.setTimeout(240000); await open(page);
    const roster = await rosterOf(page);
    expect(roster.length, '정본 33종').toBe(33);
    expect(roster.filter((r) => !r.entry).map((r) => r.cls), '입구 없음').toEqual([]);
    const bad = [];
    for (const kind of roster) {
      const s = await scene(page, [kind], host); await raf(page);
      const n0 = await count(page, kind.cls), id = s.ids[0];
      await dropOnFree(page, s, id);
      const n1 = await count(page, kind.cls), w = await where(page, id, s.free);
      await reopen(page);
      const n2 = await count(page, kind.cls);
      if (n1 !== n0 || n2 !== n0 || (LOST_6.includes(kind.cls) && !(w && w.inFree && w.abs && w.w > 0 && w.h > 0))) bad.push(`${kind.cls} ${n0}→${n1}→${n2} ${JSON.stringify(w)}`);
    }
    expect(bad).toEqual([]);
  });
}
const kindsOf = async (page, names) => (await rosterOf(page)).filter((r) => names.includes(r.cls)).sort((a, b) => names.indexOf(a.cls) - names.indexOf(b.cls));
test('빠졌던 6종 — 놓은 뒤 ⌘Z 로 나오고 ⇧⌘Z 로 들어가며 저장 왕복에도 프레임 안에 있다', async ({ page }) => {
  test.setTimeout(120000); await open(page);
  for (const kind of await kindsOf(page, LOST_6)) {
    const s = await scene(page, [kind], 'section'); await raf(page); const id = s.ids[0];
    await dropOnFree(page, s, id);
    const seen = () => page.evaluate(([c, f]) => [document.querySelectorAll('#canvas .' + c).length, document.getElementById(f).querySelectorAll('.' + c).length], [kind.cls, s.free]);
    expect(await seen(), `${kind.cls} 안에 듦`).toEqual([1, 1]);
    await page.keyboard.press('Meta+z'); await raf(page);
    expect(await seen(), `${kind.cls} ⌘Z`).toEqual([1, 0]);
    await page.keyboard.press('Meta+Shift+z'); await raf(page);
    expect(await seen(), `${kind.cls} ⇧⌘Z`).toEqual([1, 1]);
    await reopen(page);
    expect(await seen(), `${kind.cls} 저장 왕복`).toEqual([1, 1]);
  }
});
test('한 row 의 둘(자산+채팅) 다 안에 든다', async ({ page }) => {
  await open(page);
  const s = await scene(page, await kindsOf(page, ['asset-block', 'chat-block']), 'section'); await raf(page);
  const [as, ch] = s.ids;
  await page.evaluate(([as, ch]) => { const row = document.getElementById(as).closest('.row'), r2 = document.getElementById(ch).closest('.row'); row.appendChild(document.getElementById(ch)); r2.remove(); }, [as, ch]); await raf(page);
  await dropOnFree(page, s, as);
  expect([(await where(page, as, s.free))?.inFree, (await where(page, ch, s.free))?.inFree]).toEqual([true, true]);
});
test('옮길 것을 못 찾으면 row 가 제자리에 남는다', async ({ page }) => {
  await open(page);
  const s = await scene(page, await kindsOf(page, ['chat-block']), 'section'); await raf(page);
  const id = s.ids[0];
  const p = await center(page, id);
  await page.evaluate((id) => { const e = document.getElementById(id); e.className = 'x-unknown'; }, id);
  await dragTo(page, p, await center(page, s.free));
  expect(await page.evaluate(([id, f]) => { const e = document.getElementById(id); return [!!e?.isConnected, !!document.getElementById(f).contains(e), !!e?.closest('.row')]; }, [id, s.free]), '제자리').toEqual([true, false, true]);
});
test('명부 밖 알맹이가 row 에 남으면 row 를 안 지운다', async ({ page }) => {
  await open(page);
  const s = await scene(page, await kindsOf(page, ['chat-block']), 'section'); await raf(page);
  const id = s.ids[0];
  await page.evaluate((id) => { const x = document.createElement('div'); x.id = 'tmp_extra'; x.className = 'future-block'; x.textContent = 'x'; document.getElementById(id).closest('.row').appendChild(x); }, id);
  await dropOnFree(page, s, id);
  expect((await where(page, id, s.free))?.inFree, '채팅은 옮김').toBe(true);
  expect(await page.evaluate(() => !!document.getElementById('tmp_extra')?.isConnected), '명부 밖 알맹이 생존').toBe(true);
});
test('음성 — 자산은 고침 전처럼 자유 프레임에 absolute 로, 채팅은 스택 프레임에 row 째 흐름으로 든다', async ({ page }) => {
  await open(page);
  const s = await scene(page, await kindsOf(page, ['asset-block']), 'section'); await raf(page);
  await dropOnFree(page, s, s.ids[0]);
  const a = await where(page, s.ids[0], s.free);
  expect([a.inFree, a.abs]).toEqual([true, true]);
  const t = await scene(page, await kindsOf(page, ['chat-block']), 'stack'); await raf(page);
  const before = await page.evaluate((id) => document.getElementById(id).closest('.row').id, t.ids[0]);
  const from = await center(page, t.ids[0]);
  await page.mouse.click(from[0], from[1]); await raf(page);
  await dragTo(page, from, [from[0] + 8, from[1] + 8]);
  expect(await page.evaluate(([id, st, row]) => { const e = document.getElementById(id); return [document.getElementById(st).contains(e), e.style.position === 'absolute', e.closest('.row').id === row]; }, [t.ids[0], t.stack, before]), '흐름 그대로').toEqual([true, false, true]);
});
