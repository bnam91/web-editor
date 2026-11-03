/* ft-touched-enter-keeps-text.dom.spec.js — J147B 만진 사다리꼴에서 글이 바뀌면 글자 크기를 지키고 사다리꼴이 자라고 준다.
 * 현빈 결정 11-03: 「일단은 글지키기로 가보자 왜냐면 우리는 일반 텍스트블록 움직임이랑 같아야되지않을까」
 * 정책 자리: js/effects-freetransform.js _ftTouchedTextInput 하나.
 * 자 ↔ 양: 네 점 글자(저장 값) ↔ 모양 · 첫 글자 노드 화면 상자 ↔ 글자 크기 · st.H ↔ 글 높이 · .tfh-grid·.tfh-edge ↔ 보라.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const TRAP = [[40, 0], [360, 0], [400, 140], [0, 140]];
/* 아래로 좁아지는 꼴 — 소실선이 위에 있어 네 점이 꼭짓점 쪽으로 수렴한다 */
const NARROW = [[0, 0], [400, 0], [210, 140], [190, 140]];
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, kind, zoom, C) {
  await page.evaluate((z) => window.applyZoom(z), zoom);
  await waitZoomSettled(page, zoom);
  await page.evaluate(async ([kind, C]) => {
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock(kind);
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'k1';
    tb.querySelector('[contenteditable]').textContent = '첫 줄';
    if (C) ft.setFxFreeTransform(tb, C, { history: false, touched: true });
    else ft.resetFxFreeTransform(tb, { history: false });
    window.selectBlock?.(tb.id);
    tb.scrollIntoView({ block: 'center' });
    window.__k = () => {
      const b = document.getElementById('k1');
      const ce = b.querySelector('[contenteditable]');
      /* 섹션 기준 — 입력 중 캔버스가 caret 을 따라 스크롤한다 */
      const o = b.closest('.section-block').getBoundingClientRect();
      const R = (q) => ({ l: q.left - o.left, t: q.top - o.top, r: q.right - o.left, b: q.bottom - o.top, w: q.width, h: q.height });
      const g = document.createRange(); g.selectNodeContents(ce);
      const n = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT).nextNode();
      const f = document.createRange(); f.selectNodeContents(n);
      const st = ft.ftStateOf(b);
      const lines = []; const tw = document.createTreeWalker(ce, NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) { f.selectNodeContents(t); lines.push(+f.getBoundingClientRect().height.toFixed(1)); }
      f.selectNodeContents(n);
      const edge = b.querySelector('.tfh-edge'), grid = b.querySelector('.tfh-grid');
      return { W: st.W, H: st.H, touched: st.touched, C: b.dataset.tfCorners, xf: ce.style.transform, first: R(f.getBoundingClientRect()), lines,
        glyph: R(g.getBoundingClientRect()), edge: edge && R(edge.getBoundingClientRect()), grid: grid && R(grid.getBoundingClientRect()), text: ce.innerText, editing: b.classList.contains('editing') };
    };
  }, [kind, C]);
  await frames(page);
}
const read = async (page) => { await frames(page); return page.evaluate(() => window.__k()); };
const nums = (C) => C.split(',').map(Number);
async function edit(page) {
  const q = await page.locator('#k1').boundingBox();
  await page.mouse.dblclick(q.x + q.width / 2, q.y + q.height / 2);
  await page.waitForFunction(() => document.getElementById('k1').classList.contains('editing'));
  await page.evaluate(() => { const s = getSelection(); s.selectAllChildren(document.querySelector('#k1 [contenteditable]')); s.collapseToEnd(); });
}
function boot(page) { const errs = []; page.on('pageerror', (e) => errs.push(String(e))); return page.setViewportSize({ width: 1400, height: 1200 }).then(() => bootApp(page)).then(() => errs); }

for (const [kind, zoom] of [['body', 100], ['h1', 100], ['body', 40], ['h1', 40]]) {
  test(`K1 만진 사다리꼴 Enter — 글자 크기 그대로, 아래로 자란다(${kind} · 줌 ${zoom})`, async ({ page }) => {
    const errs = await boot(page);
    await scene(page, kind, zoom, TRAP);
    await edit(page);
    const a = await read(page);
    expect(a.touched, '전제: 만진 글상자다').toBe(true);
    await page.keyboard.press('Enter');
    await page.keyboard.type('둘째');
    const b = await read(page);
    await page.keyboard.press('Enter');
    await page.keyboard.type('셋째');
    const c = await read(page);
    console.log(`[K1:${kind}:${zoom}]`, JSON.stringify({ W: [a.W, b.W, c.W], H: [a.H, b.H, c.H], C: [a.C, b.C, c.C], first: [a.first, c.first] }));
    expect(c.text, '전제: 글이 이어 쳐졌다').toMatch(/첫 줄[\s\S]*둘째[\s\S]*셋째/);
    expect(Math.abs(c.W - a.W), `상자 폭이 글자보다 부풀었다 (${a.W} → ${c.W})`).toBeLessThan(1);
    expect(b.H, '다시 안 쟀다').toBeGreaterThan(a.H * 1.5);
    const [ca, cc] = [nums(a.C), nums(c.C)];
    for (const i of [0, 1, 2, 3]) expect(Math.abs(cc[i] - ca[i]), `윗변 네 점 ${i} 이 움직였다`).toBeLessThan(0.02);
    expect(cc[5], '사다리꼴이 아래로 안 자랐다').toBeGreaterThan(ca[5] * 1.5);
    for (const k of ['l', 't', 'w', 'h']) expect(Math.abs(c.first[k] - a.first[k]), `첫 줄 글자 ${k} 가 변했다 — 글자 크기를 못 지켰다`).toBeLessThan(0.5);
    for (const k of ['l', 't', 'r', 'b']) expect(Math.abs(c.grid[k] - c.edge[k]), `격자 ${k} 가 보라와 어긋난다`).toBeLessThan(0.1);
    expect(errs).toEqual([]);
  });
}

test('K2 Backspace 로 줄을 지우면 사다리꼴도 처음 값으로 준다', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, 'body', 100, TRAP);
  await edit(page);
  const a = await read(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째');
  const b = await read(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
  const c = await read(page);
  console.log('[K2]', JSON.stringify({ H: [a.H, b.H, c.H], W: [a.W, b.W, c.W], C: [a.C, b.C, c.C], text: c.text }));
  expect(nums(b.C)[5], '전제: 자랐다').toBeGreaterThan(nums(a.C)[5] * 1.5);
  expect(Math.abs(c.H - a.H), `글 높이가 안 줄었다 ${c.H}`).toBeLessThan(0.5);
  nums(c.C).forEach((v, i) => expect(Math.abs(v - nums(a.C)[i]), `네 점 ${i}: ${c.C} ↔ ${a.C}`).toBeLessThan(0.1));
  expect(errs).toEqual([]);
});

test('K3 일반 텍스트블록과 글자 크기·줄 높이가 같다', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, 'h1', 100, TRAP);
  await edit(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째');
  await page.keyboard.press('Escape');
  const c = await read(page);
  const r = await page.evaluate(async () => {
    const sec = document.querySelector('#canvas .section-block');
    await window.addTextBlock('h1');
    const plain = [...sec.querySelectorAll('.text-block')].filter((t) => t.id !== 'k1').pop();
    const p = plain.querySelector('[contenteditable]'), m = document.querySelector('#k1 [contenteditable]');
    p.innerHTML = m.innerHTML;
    const g = document.createRange(); g.selectNodeContents(p);
    const S = (e) => { const s = getComputedStyle(e); return { fs: s.fontSize, lh: s.lineHeight, ls: s.letterSpacing, ff: s.fontFamily }; };
    return { plainH: g.getBoundingClientRect().height / (window.currentZoom / 100), plainS: S(p), ftS: S(m) };
  });
  console.log('[K3]', JSON.stringify({ ftH: c.H, ...r }));
  expect(r.ftS).toEqual(r.plainS);
  expect(Math.abs(c.H - r.plainH), `글 높이 ${c.H} ↔ 일반 ${r.plainH}`).toBeLessThan(0.5);
  expect(errs).toEqual([]);
});

test('K4 저장 다시 열기 — 네 점·잰 값·행렬이 같다', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, 'body', 100, TRAP);
  await edit(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째 줄이 더 길다');
  await page.keyboard.press('Escape');
  const a = await read(page);
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = window.getSerializedCanvas ? window.getSerializedCanvas() : canvas.innerHTML;
    window.rebindAll?.({});
    window.selectBlock?.('k1');
  });
  await page.waitForFunction(() => window.ftStateOf?.(document.getElementById('k1'))?.measured);
  const b = await read(page);
  console.log('[K4]', JSON.stringify({ W: [a.W, b.W], H: [a.H, b.H], C: [a.C, b.C], xf: [a.xf, b.xf] }));
  expect(b.C).toBe(a.C);
  expect(Math.abs(b.W - a.W)).toBeLessThan(0.5);
  expect(Math.abs(b.H - a.H)).toBeLessThan(0.5);
  expect(b.xf).toBe(a.xf);
  expect(errs).toEqual([]);
});

test('K5 ⌘Z ⌘⇧Z — 글과 네 점이 같이 돌아오고 같이 간다', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, 'body', 100, TRAP);
  await page.evaluate(() => { window.pushHistory?.('전제'); });
  await edit(page);
  const a = await read(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째');
  await page.keyboard.press('Escape');
  const b = await read(page);
  expect(nums(b.C)[5], '전제: 자랐다').toBeGreaterThan(nums(a.C)[5] * 1.5);
  const seen = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Meta+z');
    const u = await read(page);
    seen.push({ text: u.text, C: u.C, H: u.H });
    if (!/둘째/.test(u.text) && !/\n/.test(u.text.trim())) break;
  }
  const u = seen[seen.length - 1];
  await page.keyboard.press('Meta+Shift+z');
  const r1 = await read(page);
  console.log('[K5]', JSON.stringify({ a: a.C, b: b.C, seen, r1: { text: r1.text, C: r1.C } }));
  /* 어느 칸이든 글 줄 수와 네 점 높이가 짝이 맞아야 한다 — 글은 돌아왔는데 사다리꼴만 큰 꼴이 없어야 한다 */
  expect(u.text, '전제: ⌘Z 가 첫 줄까지 돌아왔다').not.toMatch(/둘째/);
  expect(u.C).toBe(a.C);
  expect(Math.abs(u.H - a.H)).toBeLessThan(0.5);
  expect(r1.text !== u.text || r1.C !== u.C, '⌘⇧Z 가 안 나아갔다').toBe(true);
  expect(errs).toEqual([]);
});

test('K6 음성 — 글을 안 바꾸는 동작은 네 점을 안 건드린다', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, 'body', 100, TRAP);
  const a = await read(page);
  await edit(page);
  await page.keyboard.press('Escape');
  const b = await read(page);
  await page.evaluate(() => { window.deselectAll?.(); window.selectBlock?.('k1'); });
  const c = await read(page);
  await edit(page);
  await page.keyboard.type('가');
  const d = await read(page);
  await page.keyboard.press('Backspace');
  const e = await read(page);
  console.log('[K6]', JSON.stringify({ C: [a.C, b.C, c.C, d.C, e.C], W: [a.W, d.W, e.W] }));
  expect(b.C).toBe(a.C);
  expect(c.C).toBe(a.C);
  expect(d.W, '양성: 글자를 치면 폭이 는다').toBeGreaterThan(a.W + 1);
  expect(d.C, '양성: 글자를 치면 네 점이 움직인다').not.toBe(a.C);
  nums(e.C).forEach((v, i) => expect(Math.abs(v - nums(a.C)[i]), `되돌린 네 점 ${i}`).toBeLessThan(0.1));
  expect(errs).toEqual([]);
});

test('K7 음성 — 안 만진 글상자는 바탕 네모 그대로 자란다(변형 없음)', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, 'body', 100, null);
  await edit(page);
  const a = await read(page);
  expect(a.touched, '전제: 안 만진 글상자다').toBe(false);
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째');
  const b = await read(page);
  console.log('[K7]', JSON.stringify({ C: [a.C, b.C], H: [a.H, b.H], touched: b.touched }));
  expect(b.touched).toBe(false);
  expect(nums(b.C)[0]).toBe(0);
  expect(nums(b.C)[1]).toBe(0);
  expect(Math.abs(nums(b.C)[5] - b.H), '바탕 네모 높이 = 글 높이').toBeLessThan(0.02);
  expect(errs).toEqual([]);
});

test('K8 소실선을 넘는 꼴 — 네 점을 두고 다시 그린다(던지지 않는다)', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, 'body', 100, TRAP);
  await edit(page);
  const seen = [await read(page)];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.type('줄');
    seen.push(await read(page));
  }
  console.log('[K8]', JSON.stringify(seen.map((v) => ({ H: v.H, C: v.C, lines: v.lines }))));
  /* 이 꼴은 넷째 줄에서 소실선을 넘는다 — 그 칸만 잠근다(그 뒤 값은 회신의 물음) */
  const [prev, stuck] = [seen[2], seen[3]];
  expect(stuck.H, '양성: 글은 다시 쟀다').toBeGreaterThan(prev.H + 1);
  expect(stuck.C, '소실선을 넘은 칸은 네 점이 멈춘다').toBe(prev.C);
  expect(stuck.xf, '다시 그렸다').not.toBe(prev.xf);
  expect(errs).toEqual([]);
});

test('K9 아래로 좁아지는 꼴 — 네 점이 유한하다', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, 'body', 100, NARROW);
  await edit(page);
  const a = await read(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('둘째');
  const b = await read(page);
  console.log('[K9]', JSON.stringify({ C: [a.C, b.C], H: [a.H, b.H], lines: [a.lines, b.lines] }));
  expect(b.H).toBeGreaterThan(a.H * 1.5);
  expect(nums(b.C).every(Number.isFinite)).toBe(true);
  expect(errs).toEqual([]);
});
