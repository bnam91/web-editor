/* frame-inner-select-delete — 안쪽 프레임을 골랐으면 지우기·복사가 안쪽만 잡는다
 * 왜: 안쪽을 누르면 mousedown 이 바깥까지 selected 로 올린다. 모서리를 누르면 그 순간 생긴 손잡이가 mouseup 을 받아 click 이 안 와 둘 다 남고,
 *     입구가 문서 순서 첫 프레임(바깥)을 집어 Delete·⌘X 가 바깥 나무째 지우고 ⌘C·⌘D 가 바깥을 복사했다(앱 깊이 2·3·4 각 3/3).
 * 칸: C 모서리로 고르면 안쪽만 골리고 바깥 표시 없음 · O 안쪽만 잡는다(깊이 × 입구) · S 둘이 골린 상태에서도 안쪽 · N [음성] 바깥만 고르면 나무째
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const FR = '.frame-block:not([data-text-frame])';
const NAMES = ['R', 'A', 'G', 'H'];
const SIZE = [[860, 560], [420, 420], [300, 300], [150, 160]];
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, depth) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ([FR, NAMES, SIZE, depth]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block');
    const out = {}; let p = null;
    for (let i = 0; i < depth; i++) {
      window.deselectAll(); window.selectSection(sec); window._activeFrame = p ? document.getElementById(p) : null;
      const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock();
      const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x));
      window.updateFrameBlock(f.id, { width: SIZE[i][0], height: SIZE[i][1] });
      if (p) { f.style.left = '20px'; f.style.top = '20px'; f.dataset.offsetX = 20; f.dataset.offsetY = 20; }
      window.deselectAll(); window._activeFrame = null;
      out[NAMES[i]] = p = f.id;
    }
    window.clearHistory?.(); document.getElementById(out.R).scrollIntoView({ block: 'center' });
    return out;
  }, [FR, NAMES, SIZE, depth]);
  await waitStableRect(page, '#' + ids.R);
  return { errs, ids };
}
const read = (page) => page.evaluate((FR) => [...document.querySelectorAll('#canvas ' + FR)].map((f) => ({ id: f.id, par: f.parentElement.closest(FR)?.id || null, sel: f.classList.contains('selected') })), FR);
const corner = async (page, id, dbl) => { const b = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.right - 10, r.bottom - 10]; }, id); if (dbl) await page.mouse.dblclick(b[0], b[1]); else await page.mouse.click(b[0], b[1]); await raf(page); };
/* B안(현빈 261107): 맨 바깥은 한 번 클릭 · 그 안은 한 겹씩 더블클릭 진입(옛: 모서리를 차례로 한 번씩 = 드릴인) */
const pickDown = async (page, ids, depth) => { for (const [i, n] of NAMES.slice(0, depth).entries()) await corner(page, ids[n], i > 0); };
/* 붙여넣기는 늦게 붙는다 — 프레임 수가 늘 때까지 기다린다 */
const grew = (page, n) => page.waitForFunction(([FR, n]) => document.querySelectorAll('#canvas ' + FR).length > n, [FR, n]);
const OPS = {
  Delete: { run: (p) => p.keyboard.press('Delete') },
  '⌘X': { run: (p) => p.keyboard.press('Meta+x') },
  '⌘C⌘V': { run: async (p, n) => { await p.keyboard.press('Meta+c'); await p.keyboard.press('Meta+v'); await grew(p, n); }, copy: true },
  '⌘D': { run: async (p, n) => { await p.keyboard.press('Meta+d'); await grew(p, n); }, copy: true },
};
async function expectInnerOnly(page, ids, depth, op, s0) {
  const inner = ids[NAMES[depth - 1]], outer = ids[NAMES[depth - 2]];
  await OPS[op].run(page, s0.length); await raf(page);
  const s1 = await read(page);
  if (OPS[op].copy) {
    const fresh = s1.filter((f) => !s0.some((g) => g.id === f.id));
    expect(fresh.length, '★안쪽 한 개만 복사된다').toBe(1);
    expect(fresh[0].par, '안쪽의 부모 안').toBe(outer);
    expect(s1.filter((f) => s0.some((g) => g.id === f.id)).map((f) => f.id), '원본 그대로').toEqual(s0.map((f) => f.id));
  } else {
    expect(s1.map((f) => f.id), '★안쪽만 지워진다').toEqual(s0.map((f) => f.id).filter((i) => i !== inner));
  }
  await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page);
  expect((await read(page)).map((f) => f.id), '⌘Z 한 번에 처음').toEqual(s0.map((f) => f.id));
}

for (const depth of [2, 3, 4]) {
  test(`C 깊이 ${depth} 모서리 누름 — 안쪽만 골리고 바깥 표시가 없다`, async ({ page }) => {
    const { errs, ids } = await scene(page, depth);
    await pickDown(page, ids, depth);
    const s = await read(page);
    expect(s.filter((f) => f.sel).map((f) => f.id), '★안쪽만').toEqual([ids[NAMES[depth - 1]]]);
    const o = await page.evaluate((id) => getComputedStyle(document.getElementById(id)).outlineStyle, ids[NAMES[depth - 2]]);
    expect(o, '★바깥 테두리').toBe('none');
    expect(errs, errs.join(' | ')).toEqual([]);
  });
  for (const op of Object.keys(OPS)) {
    test(`O 깊이 ${depth} 모서리 누름 ${op} — 안쪽만 · ⌘Z`, async ({ page }) => {
      const { errs, ids } = await scene(page, depth);
      await pickDown(page, ids, depth);
      await expectInnerOnly(page, ids, depth, op, await read(page));
      expect(errs, errs.join(' | ')).toEqual([]);
    });
    test(`S 깊이 ${depth} 바깥·안쪽이 같이 골린 상태 ${op} — 안쪽만`, async ({ page }) => {
      const { errs, ids } = await scene(page, depth);
      await pickDown(page, ids, depth);
      await page.evaluate((id) => document.getElementById(id).classList.add('selected'), ids[NAMES[depth - 2]]);
      await expectInnerOnly(page, ids, depth, op, await read(page));
      expect(errs, errs.join(' | ')).toEqual([]);
    });
  }
}

test('S2 바깥·안쪽 + 다른 프레임 섞임 Delete — 바깥 나무는 남고 고른 둘만', async ({ page }) => {
  const { errs, ids } = await scene(page, 3);
  const other = await page.evaluate(([FR, R]) => { const sec = document.querySelector('.section-block'); window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); return f.id; }, [FR, ids.R]);
  await page.evaluate(([a, g, o]) => [a, g, o].forEach((i) => document.getElementById(i).classList.add('selected')), [ids.A, ids.G, other]);
  const s0 = await read(page);
  await page.keyboard.press('Delete'); await raf(page);
  expect((await read(page)).map((f) => f.id), '★바깥 A 는 남는다').toEqual(s0.map((f) => f.id).filter((i) => i !== ids.G && i !== other));
  expect(errs, errs.join(' | ')).toEqual([]);
});

for (const op of Object.keys(OPS)) {
  test(`N [음성] 바깥만 고름 ${op} — 나무째 · ⌘Z`, async ({ page }) => {
    const { errs, ids } = await scene(page, 3);
    await corner(page, ids.R);
    const s0 = await read(page);
    expect(s0.filter((f) => f.sel).map((f) => f.id), '[전제]').toEqual([ids.R]);
    await OPS[op].run(page, s0.length); await raf(page);
    const s1 = await read(page);
    if (OPS[op].copy) expect(s1.length - s0.length, '나무 셋이 복사된다').toBe(3);
    else expect(s1.length, '나무째 지워진다').toBe(0);
    await page.evaluate(() => window.deselectAll()); await page.keyboard.press('Meta+z'); await raf(page);
    expect((await read(page)).map((f) => f.id), '⌘Z').toEqual(s0.map((f) => f.id));
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
