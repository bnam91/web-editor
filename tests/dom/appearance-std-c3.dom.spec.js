/* appearance-std-c3.dom.spec.js — 표준 Appearance A4(Opacity 칸) C3: label-group · row · mockup · text · slide · zoom · annotation
 *   칸 = Appearance 절 «Opacity» (0~100 %) · 입력 → window.setBlockOpacity(block, v) · change = 잘라 + 이력 1 · 처음 값 = readBlockOpacity ?? 100
 *   계약(갈래 E 몫)은 여기서 가짜로 끼운다(appearance-std-parts 와 같은 꼴). page 는 블럭이 아니라 칸 없음(음성 짝).
 *   ⛔옛 코드(기준판 P 1baa53b8f)에서는 칸 없음 = 빨강이어야 한다(재현 빨강).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/appearance-std-c3.dom.spec.js --workers=1 --retries=0 --reporter=line */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = c.querySelector('.section-block'); window.__secEl = () => sec;
    window.__op = [];
    window.setBlockOpacity = (b, v) => { window.__op.push(v); if (v >= 100) { delete b.dataset.opacity; b.style.opacity = ''; } else { b.dataset.opacity = String(v); b.style.opacity = String(v / 100); } };
    window.readBlockOpacity = (b) => (b.dataset.opacity == null ? 100 : +b.dataset.opacity);
    window.__ph = 0; const o = window.pushHistory; window.pushHistory = (...a) => { window.__ph++; return o?.(...a); };
  });
  return errs;
}

const V = [
  { name: 'label-group', op: 'lg-opacity', make: `return add('label-group-block', () => window.addLabelGroupBlock());`, open: 'showLabelGroupProperties' },
  { name: 'row', op: 'row-opacity', make: `const r = document.createElement('div'); r.className = 'row'; r.id = 'rowA3'; r.dataset.layout = 'stack'; r.innerHTML = '<div class="col"><div class="text-block">A</div></div>'; sec.querySelector('.section-inner').appendChild(r); return r;`, open: 'showRowProperties' },
  { name: 'mockup', op: 'mkp-opacity', make: `return add('mockup-block', () => window.addMockupBlock());`, open: 'showMockupProperties' },
  { name: 'text', op: 'txt-opacity', make: `return add('text-block', () => window.addTextBlock('body'));`, open: 'showTextProperties' },
  { name: 'slide', op: 'sld-opacity', make: `return add('slide-block', () => window.addSlideBlock());`, open: 'showSlideProperties' },
  { name: 'zoom', op: 'zm-opacity', make: `return add('zoom-block', () => window.addZoomBlock());`, open: 'showZoomProperties' },
  { name: 'annotation', op: 'annot-label-opacity', make: `const b = window.makeAnnotationBlock({ points: [[200, 160], [500, 160]], text: '라벨' }); sec.querySelector('.section-inner').appendChild(b); window.bindAnnotationSelect?.(b); return b;`, open: 'showAnnotationProperties' },
];

const run = (page, v) => page.evaluate(async (v) => {
  const sec = window.__secEl();
  const add = (cls, fn) => { window.deselectAll?.(); window.selectSection(sec); const b0 = new Set(sec.querySelectorAll('.' + cls)); fn(); const f = [...sec.querySelectorAll('.' + cls)].find((x) => !b0.has(x)); if (!f) throw new Error('새 ' + cls + ' 없음'); return f; };
  const b = await (new Function('add', 'sec', v.make))(add, sec);
  b.dataset.opacity = '70';   // 처음 값 = readBlockOpacity
  window[v.open](b);
  const n = document.getElementById(v.op);
  if (!n) return { found: false };
  const out = { found: true, inAppearance: !!n.closest('#psec-appearance'), label: n.closest('.ui-s2-cell')?.querySelector('span')?.textContent ?? null, first: n.value, scrub: !!document.getElementById(v.op + '-scrub') };
  window.__op = []; window.__ph = 0;
  n.value = '40'; n.dispatchEvent(new Event('input', { bubbles: true }));
  out.live = [window.__op.slice(), window.__ph];
  n.value = '150'; n.dispatchEvent(new Event('change', { bubbles: true }));
  out.commit = [b.dataset.opacity ?? null, window.__ph];
  return out;
}, v);

for (const v of V) {
  test(`AC3 [${v.name}] Appearance «Opacity» 칸 #${v.op} · 처음 값 = readBlockOpacity · 입력 = setBlockOpacity 바로 · change 150 → 100(키 지움) + 이력 1`, async ({ page }) => {
    const errs = await scene(page);
    const o = await run(page, v);
    expect(o.found, `${v.name}: Opacity 칸 없음`).toBe(true);
    expect([o.inAppearance, o.label, o.first, o.scrub]).toEqual([true, 'Opacity', '70', true]);
    expect(o.live, '입력 = 바로 그림 · 이력 0').toEqual([[40], 0]);
    expect(o.commit, 'change = 0~100 으로 잘라 + 이력 1').toEqual([null, 1]);
    expect(errs).toEqual([]);
  });
}

test('AC3 [page] 음성 짝 — Page 는 블럭이 아니라 Opacity 칸 없음', async ({ page }) => {
  const errs = await scene(page);
  const n = await page.evaluate(() => { window.deselectAll?.(); window.showPageProperties(); return document.querySelectorAll('#panel-right .panel-body [id$="-opacity"]').length; });
  expect(n).toBe(0);
  expect(errs).toEqual([]);
});
