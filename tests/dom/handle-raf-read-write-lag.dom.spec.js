/* handle-raf-read-write-lag — 프레임 핸들 rAF 가 읽기를 다 끝낸 뒤 쓴다 (손 밀림 · 시트 t9-03)
 * 왜: 핸들 하나 쓸 때마다 다음 읽기가 강제 레이아웃을 냈다. rAF 한 번에 약 15회, 405 프레임 판 크기 핸들 손 밀림의 큰 몫(앱 값은 회신).
 * 칸: 핸들 쓰기 뒤 같은 rAF 안 프레임 읽기 0 · [음성] 핸들 자리가 프레임 네 귀와 맞다(값은 그대로) · [음성] 회전한 프레임도 맞다.
 * 변이: 읽고 바로 쓰는 옛 꼴로 되돌리면 첫 칸 빨강 · 음성 둘 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const FR = '.frame-block:not([data-text-frame])';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function scene(page, rot) {
  await page.setViewportSize({ width: 1500, height: 1000 }); const errs = await bootApp(page);
  const id = await page.evaluate(async ([FR, rot]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((x) => x.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].pop(); window.updateFrameBlock(f.id, { width: 500, height: 300 }); if (rot) window.updateFrameBlock(f.id, { rotateDeg: rot }); window.deselectAll(); return f.id; }, [FR, rot]);
  await raf(page);
  for (let i = 0; i < 4; i++) {
    const b = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; }, id);
    await page.mouse.click(b[0], b[1]); await raf(page); await page.waitForTimeout(150);
    if (await page.evaluate(() => [...document.querySelectorAll('.ss-resize-handle')].some((h) => h.style.left))) break;
  }
  await page.waitForFunction(() => [...document.querySelectorAll('.ss-resize-handle')].some((h) => h.style.left), null, { timeout: 5000 });
  return { id, errs };
}
test('핸들 쓰기 뒤 같은 rAF 안에 프레임을 다시 안 읽는다', async ({ page }) => {
  const { id } = await scene(page, 0);
  /* 프레임을 프레임마다 늘려 핸들 값이 바뀌게 한다 · 프레임 읽기마다 핸들 style 을 찍는다.
     한 rAF 안에 찍힌 값이 여럿이면 «쓰고 다시 읽었다»는 뜻이다(옛 꼴 ≥ 8 · 고친 꼴은 앞뒤 둘까지 · 뒤 하나는 선택 오버레이의 읽기). */
  const r = await page.evaluate(async (id) => { const f = document.getElementById(id); const hs = [...document.querySelectorAll('.ss-resize-handle,.ss-radius-handle,.ss-rotate-handle')]; const sig = () => hs.map((h) => h.getAttribute('style')).join('|');
    const oR = Element.prototype.getBoundingClientRect; let cur = new Set(); let reads = 0; Element.prototype.getBoundingClientRect = function () { if (this === f) { cur.add(sig()); reads++; } return oR.call(this); };
    const per = []; for (let i = 0; i < 4; i++) { f.style.width = 500 + 7 * (i + 1) + 'px'; cur = new Set(); reads = 0; await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); per.push([cur.size, reads]); }
    Element.prototype.getBoundingClientRect = oR; return { per, handles: hs.length }; }, id);
  expect(r.handles, '[전제] 핸들 여럿').toBeGreaterThan(3);
  for (const [, reads] of r.per) expect(reads, '[전제] 그 사이 프레임을 읽었다').toBeGreaterThan(3);
  expect(Math.max(...r.per.map((x) => x[0])), `쓰고 다시 읽기 ${JSON.stringify(r.per)}`).toBeLessThanOrEqual(3);
});
for (const [name, rot] of [['[음성] 핸들 자리가 프레임 네 귀', 0], ['[음성] 회전한 프레임도 핸들이 돈 네 귀', 30]]) {
  test(name, async ({ page }) => {
    const { id, errs } = await scene(page, rot);
    const v = await page.evaluate(([id, rot]) => { const f = document.getElementById(id); const r = f.getBoundingClientRect(); const h = {}; document.querySelectorAll('.ss-resize-handle').forEach((e) => { h[e.dataset.dir] = [parseFloat(e.style.left) + 3.5, parseFloat(e.style.top) + 3.5]; }); return { r: [r.left, r.top, r.right, r.bottom], h, cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, rot, w: f.offsetWidth, ht: f.offsetHeight }; }, [id, rot]);
    expect(Object.keys(v.h).length, '[전제] 핸들').toBeGreaterThan(0);
    if (!rot) { for (const [d, [x, y]] of Object.entries(v.h)) { expect(x).toBeCloseTo(d.includes('w') ? v.r[0] : v.r[2], 0); expect(y).toBeCloseTo(d.includes('n') ? v.r[1] : v.r[3], 0); } }
    else { for (const [x, y] of Object.values(v.h)) { const dist = Math.hypot(x - v.cx, y - v.cy); expect(dist).toBeGreaterThan(50); } }
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
