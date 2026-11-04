/* ft-undo-steps-with-cursor.dom.spec.js — FTUNDO 글칸에 커서가 있어도 자유변형 ⌘Z 는 여러 걸음 된다(현빈 6634).
 * 자 ↔ 양: tfCorners ↔ 모양 걸음 · 글칸 innerText ↔ 글 걸음 · document.queryCommandEnabled ↔ 네이티브에 남은 글 · activeElement ↔ 커서 전제.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const C1 = [[20, 0], [395, 0], [395, 124], [0, 124]];
const C2 = [[20, 0], [375, 0], [395, 124], [0, 124]];
const C3 = [[20, 0], [375, 0], [395, 150], [0, 124]];
const str = (C) => C.flat().join(',');
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, ft) {
  await bootApp(page);
  await page.evaluate((z) => window.applyZoom(z), 100);
  await waitZoomSettled(page, 100);
  await page.evaluate(async ([ft, Cs]) => {
    const fx = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('h1');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'm1';
    const ce0 = tb.querySelector('[contenteditable]'); ce0.textContent = '첫 줄'; delete ce0.dataset.isPlaceholder; /* 사람이 친 글과 같은 꼴 */
    window.selectBlock?.('m1');
    tb.scrollIntoView({ block: 'center' });
    if (ft) {
      fx.resetFxFreeTransform(tb, { history: false });
      window.pushHistory('전제');
      for (const C of Cs) { fx.setFxFreeTransform(tb, C, { history: true, touched: true }); window.pushHistory('끌기'); }
    } else {
      const ce = tb.querySelector('[contenteditable]');
      window.pushHistory('전제');
      for (const x of ['rgb(1, 0, 0)', 'rgb(2, 0, 0)']) { ce.style.color = x; window.pushHistory('색'); }
    }
  }, [ft, [C1, C2, C3]]);
  await frames(page);
}
async function edit(page) {
  const q = await page.locator('#m1').boundingBox();
  await page.mouse.dblclick(q.x + q.width / 2, q.y + Math.min(q.height / 2, 30));
  await page.waitForFunction(() => document.getElementById('m1').classList.contains('editing'));
  await page.evaluate(() => { const s = getSelection(); s.selectAllChildren(document.querySelector('#m1 [contenteditable]')); s.collapseToEnd(); });
  await frames(page);
}
const read = async (page) => { await frames(page); return page.evaluate(() => {
  const tb = document.getElementById('m1'), ce = tb.querySelector('[contenteditable]');
  return { C: tb.dataset.tfCorners || '', t: ce.innerText.trim(), col: ce.style.color, cur: !!document.activeElement?.isContentEditable };
}); };
const press = async (page, key) => { await page.keyboard.press(key); return read(page); };

test('M1 커서 있고 친 글 없음 — ⌘Z 마다 모양이 한 걸음씩, ⌘⇧Z 로 돌아온다', async ({ page }) => {
  await scene(page, true);
  await edit(page);
  const a = await read(page);
  expect(a.cur, '전제: 커서가 글칸에 있다').toBe(true);
  expect(a.C).toContain('375');
  const u1 = await press(page, 'Meta+z');
  expect(u1.C).toBe(str(C2));
  const u2 = await press(page, 'Meta+z');
  expect(u2.C).toBe(str(C1));
  const r1 = await press(page, 'Meta+Shift+z');
  expect(r1.C).toBe(str(C2));
  const r2 = await press(page, 'Meta+Shift+z');
  expect(r2.C).toBe(a.C);
  expect(r2.t).toBe('첫 줄');
});

test('M2 친 글이 먼저 되돌아가고 그다음 모양 — 글이 사라지지 않는다', async ({ page }) => {
  await scene(page, true);
  await edit(page);
  await page.keyboard.insertText('x');
  const a = await read(page);
  expect(a.t, '양성: 글을 쳤다').toBe('첫 줄x');
  const u1 = await press(page, 'Meta+z');
  expect(u1.t, '첫 ⌘Z 는 글(네이티브)').toBe('첫 줄');
  expect(u1.cur, '네이티브 되돌리기는 커서를 안 뺀다').toBe(true);
  const u2 = await press(page, 'Meta+z');
  expect(u2.C, '둘째 ⌘Z 는 끌기').toBe(str(C2));
  expect(u2.t).toBe('첫 줄');
});

test('M3 ⌘Z 뒤 저장본 — 되돌린 네 점만 있고 편집 표식·손잡이가 안 샌다', async ({ page }) => {
  await scene(page, true);
  await edit(page);
  await press(page, 'Meta+z');
  await press(page, 'Meta+z');
  const r = await page.evaluate(() => {
    const d = document.createElement('div'); d.innerHTML = window.getSerializedCanvas();
    const t = d.querySelector('.text-block[data-tf-corners]');
    return { C: t.dataset.tfCorners, editing: t.classList.contains('editing'), handles: d.querySelectorAll('.tfh-handle,.tfh-layer').length, text: t.querySelector('.tb-h1').textContent };
  });
  expect(r).toEqual({ C: str(C1), editing: false, handles: 0, text: '첫 줄' });
});

test('M4 음성 — 안 건 글칸의 ⌘Z 는 옛 문 그대로 앱 이력을 안 탄다, 포커스를 빼면 탄다', async ({ page }) => {
  await scene(page, false);
  await edit(page);
  const a = await read(page);
  expect(a.cur).toBe(true);
  const n = await press(page, 'Meta+z');
  expect(n.col).toBe(a.col);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur?.());
  const y = await press(page, 'Meta+z');
  expect(y.col, '양성: 포커스 없으면 한 걸음 간다').toBe('rgb(1, 0, 0)');
});

const C4 = [[30, 0], [375, 0], [395, 150], [0, 124]];
const shape = (page) => page.evaluate(async (C) => { const fx = await import('/js/effects-freetransform.js'); fx.setFxFreeTransform(document.getElementById('m1'), C, { history: true, touched: true }); window.pushHistory('끌기'); }, C4);

test('M5 앞 편집에서 친 글은 묵은 네이티브로 먼저 안 간다 — 첫 ⌘Z 가 모양, 글이 지워졌다 되살아나지 않는다', async ({ page }) => {
  await scene(page, true);
  await edit(page);
  await page.keyboard.insertText('y');
  await page.keyboard.press('Escape');
  await frames(page);
  await shape(page);
  await edit(page);
  const a = await read(page);
  expect(await page.evaluate(() => document.queryCommandEnabled('undo')), '전제: 네이티브가 앞 글을 들고 있다').toBe(true);
  expect(a.t).toBe('첫 줄y');
  const u1 = await press(page, 'Meta+z');
  expect(u1.C, '첫 ⌘Z 는 뒤에 한 끌기').not.toBe(a.C);
  expect(u1.t).toBe('첫 줄y');
});

test('M6 옆 글상자에서 친 글이 스택에 있어도 첫 ⌘Z 가 먹통이 아니다', async ({ page }) => {
  await scene(page, true);
  await page.evaluate(async () => { await window.addTextBlock('h2'); const tb = [...document.querySelectorAll('#canvas .text-block')].find((t) => t.id !== 'm1'); tb.id = 'v1'; const ce = tb.querySelector('[contenteditable]'); ce.textContent = '옆글'; delete ce.dataset.isPlaceholder; window.selectBlock?.('v1'); window.pushHistory('옆'); });
  await frames(page);
  const q = await page.locator('#v1').boundingBox();
  await page.mouse.dblclick(q.x + q.width / 2, q.y + q.height / 2);
  await page.waitForFunction(() => document.getElementById('v1').classList.contains('editing'));
  await page.keyboard.insertText('q');
  await page.keyboard.press('Escape');
  await frames(page);
  await shape(page);
  await edit(page);
  const a = await read(page);
  expect(await page.evaluate(() => document.queryCommandEnabled('undo')), '전제: 네이티브가 옆 글을 들고 있다').toBe(true);
  const u1 = await press(page, 'Meta+z');
  expect(u1.C).not.toBe(a.C);
});

test('M7 커서 둔 채 글 치고 손잡이를 끈 뒤 — 첫 ⌘Z 가 끌기, 글이 지워졌다 되살아나지 않는다', async ({ page }) => {
  await scene(page, true);
  await edit(page);
  await page.keyboard.insertText('x');
  const h = await page.locator('#m1 .tfh-handle[data-tfh="ne"]').boundingBox();
  const cx = h.x + h.width / 2, cy = h.y + h.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 7, cy); await frames(page); await page.mouse.move(cx - 15, cy); await frames(page); await page.mouse.up(); await frames(page);
  const a = await read(page);
  expect(a.cur, '전제: 커서가 그대로다').toBe(true);
  expect(a.t).toBe('첫 줄x');
  const seen = [];
  for (let i = 0; i < 3; i++) seen.push(await press(page, 'Meta+z'));
  const texts = seen.map((r) => r.t);
  expect(texts.indexOf('첫 줄') === -1 || !texts.slice(texts.indexOf('첫 줄')).includes('첫 줄x'), `글 순서 ${texts.join(' → ')}`).toBe(true);
  expect(seen[0].C, '첫 ⌘Z 는 끌기').not.toBe(a.C);
});
