/* ★326 — 섹션 바닥 손잡이 띠가 글자 끝·선 스티커를 먹지 않는다(닿으면 띠가 섹션 아래로 비킨다).
   한 쌍: Y1·Y2 = 닿으면 임자가 그 블럭 / Y0 = 안 닿으면 임자가 손잡이(옛 자리). Y3 = 비켜도 끌린다 · 비키는 일이 저장 글자를 안 바꾼다.
   ★Y4 = ★안 닫힌 것을 잠근다: 마우스를 안 움직이고 읽는 임자(w2d06d O5 softClick 의 전제 칸)는 섹션이 골라져 있으면 ★여전히 손잡이다.
     ⛔Y4 가 초록이라고 «O5 닫혔다» 로 읽지 마라 · 이 칸이 빨개지면(비킴이 움직임 없이도 서면) 그때 O5 를 다시 재라.
   ⚠️장면 준비만 evaluate — 임자·클릭·끌기는 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const raf2 = (p) => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const ownerAt = (p, x, y) => p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return { handle: !!e?.closest('.section-bottom-handle'), text: !!e?.closest('.text-block'), sticker: !!e?.closest('.sticker-block') }; }, [x, y]);
const hover = async (p, x, y) => { await p.mouse.move(x, y - 40); await raf2(p); await p.mouse.move(x, y); await raf2(p); };

/* 섹션 하나 · 100% · touch 면 아래 Gap 을 없애 글자 바닥이 섹션 바닥에 닿는다 */
async function scene(page, touch) {
  await page.setViewportSize({ width: 1500, height: 950 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async (touch) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    await window.addSection();
    window.applyZoom?.(100);
    const sec = [...c.querySelectorAll('.section-block')].pop();
    if (touch) [...sec.querySelectorAll('.gap-block')].pop().remove();
    window.sectionBottomHandleSweep?.();
    sec.scrollIntoView({ block: 'center' });
    return { id: sec.id };
  }, touch);
  await raf2(page);
  return { errs, id: r.id };
}
const rectOf = async (page, sel) => { const q = await waitStableRect(page, sel); return { x: q.left + q.width / 2, top: q.top, bottom: q.top + q.height, h: q.height }; };
/* 선 스티커(형광펜 B)를 앱 입구로 넣고 몸통 가운데가 띠(바닥 −4)에 오게 놓는다 · 몸통 점(.sticker-hlb-line) 을 돌려준다 */
async function lineStickerInBand(page, id) {
  const sid = await page.evaluate(async (i) => { const sec = document.getElementById(i); window.selectSection?.(sec); sec.classList.add('selected'); const before = new Set([...sec.querySelectorAll('.sticker-block')]); window.addStickerBlock({ shape: 'highlightB' }); const el = [...sec.querySelectorAll('.sticker-block')].find(e => !before.has(e)); return el.id; }, id);
  await raf2(page);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  return page.evaluate(([i, sid]) => { window.deselectAll?.(); const sec = document.getElementById(i), el = document.getElementById(sid); const line = el.querySelector('.sticker-hlb-line') || el; const s = sec.getBoundingClientRect(), q = line.getBoundingClientRect(); el.style.top = (parseFloat(el.style.top || 0) + (s.bottom - 4 - (q.top + q.height / 2))) + 'px'; const m = line.getBoundingClientRect(); return { sid, x: m.left + m.width / 2, y: m.top + m.height / 2 }; }, [id, sid]);
}

test('Y0 (음성) 글자가 안 닿으면 손잡이는 제 자리 · 그 자리 임자가 손잡이', async ({ page }) => {
  const { errs, id } = await scene(page, false);
  const b = await rectOf(page, '#' + id);
  await hover(page, b.x, b.bottom - 4);
  expect(await ownerAt(page, b.x, b.bottom - 4)).toMatchObject({ handle: true });
  expect(await page.evaluate((i) => document.querySelector(`#${i} > .section-bottom-handle`).classList.contains('sbh-out'), id)).toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Y1 글자 바닥이 닿으면 글자 끝 아래를 눌러도 임자는 글자 칸 · 손잡이는 비킨다', async ({ page }) => {
  const { errs, id } = await scene(page, true);
  const b = await rectOf(page, `#${id} .text-block`);
  const s = await rectOf(page, '#' + id);
  expect(Math.abs(b.bottom - s.bottom), '전제: 글자 바닥 = 섹션 바닥').toBeLessThan(1);
  await hover(page, b.x, b.bottom - 4);
  expect(await ownerAt(page, b.x, b.bottom - 4)).toMatchObject({ handle: false, text: true });
  expect(await page.evaluate((i) => document.querySelector(`#${i} > .section-bottom-handle`).classList.contains('sbh-out'), id)).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Y2 선 스티커가 띠에 있으면 마우스 올린 뒤 임자는 스티커 · 클릭하면 스티커가 골라진다', async ({ page }) => {
  const { errs, id } = await scene(page, false);
  const m = await lineStickerInBand(page, id);
  await raf2(page);
  await hover(page, m.x, m.y);
  expect(await ownerAt(page, m.x, m.y)).toMatchObject({ handle: false, sticker: true });
  await page.mouse.click(m.x, m.y); await raf2(page);
  expect(await page.evaluate((i) => document.getElementById(i).classList.contains('selected'), m.sid)).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Y4 (안 닫힌 칸) 마우스 안 움직이고 읽으면 · 섹션 선택이면 선 스티커 자리 임자는 여전히 손잡이', async ({ page }) => {
  const { errs, id } = await scene(page, false);
  const m = await lineStickerInBand(page, id);
  await page.evaluate((i) => document.getElementById(i).classList.add('selected'), id);
  await raf2(page);
  expect(await ownerAt(page, m.x, m.y)).toMatchObject({ handle: true, sticker: false });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('Y3 비켜도 끌린다(min-height) · 비키는 일이 저장 글자를 안 바꾼다', async ({ page }) => {
  const { errs, id } = await scene(page, true);
  const s0 = await rectOf(page, '#' + id);
  const ser0 = await page.evaluate(() => window.getSerializedCanvas());
  await hover(page, s0.x, s0.bottom - 4);
  expect(await page.evaluate(() => window.getSerializedCanvas()), '비키기만 했는데 저장 글자가 바뀌면 ⌘Z 가 한 칸 먹는다(321)').toBe(ser0);
  const h = await page.evaluate((i) => { const q = document.querySelector(`#${i} > .section-bottom-handle`).getBoundingClientRect(); return { y: q.top + q.height / 2 }; }, id);
  expect(h.y, '전제: 손잡이가 섹션 아래').toBeGreaterThan(s0.bottom);
  await page.mouse.move(s0.x, h.y); await raf2(page);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(s0.x, h.y + 60 * i / 6);
  await page.mouse.up(); await raf2(page);
  expect(await page.evaluate((i) => document.getElementById(i).style.minHeight, id)).toMatch(/^\d+px$/);
  expect(errs, errs.join(' | ')).toEqual([]);
});
