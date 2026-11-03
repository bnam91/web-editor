/* bracket-reorder-units-j4468b.dom.spec.js — ⌘[ ⌘] 이동 단위 세 구멍 (J4468B · 지디 판정)
 * F  행 위 형제가 프레임이면 한 번에 건너뛰었다(containerItems 에 frame-block 없음).
 * T  글자·말풍선은 단위(.row)가 없어 조용히 안 먹었다.
 * S  스택 안 자식을 골라도 프레임 갈래가 먼저 먹어 프레임이 옮겨졌다 · 중첩 프레임은 스택 밖으로 튀었다.
 * 자: 진짜 클릭·진짜 키 · 값 = 부모 안 형제 index. 겹침(Z)은 겹친 점의 임자.
 * 양성대조: 칸마다 그 고침만 되돌리면 그 칸이 빨강(커밋 메시지) · 맨판 GD1001_ROOT 로도 빨강.
 * ⛔고정 대기 없음. ⛔앱 무접촉(_root-harness.bootApp). 저장 뒤 다시 열기는 앱 런(J4468B) 값.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const ADD = { table: ['addTableBlock', 'table-block'], divider: ['addDividerBlock', 'divider-block'], chat: ['addChatBlock', 'chat-block'], text: ['addTextBlock', 'text-block'], speech: ['addSpeechBubbleBlock', 'speech-bubble-block'] };
// names 를 차례로 넣고 ids 를 돌려준다. stack 이면 그 행들을 흐름 프레임(_convertFreeLayoutToStack 끝 꼴)에 옮긴다
async function scene(page, names, { stack = false } = {}) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  await bootApp(page);
  return page.evaluate(async ([names, ADD, stack]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'), inner = sec.querySelector(':scope > .section-inner');
    const ids = [];
    for (const n of names) {
      const [fn, cls] = ADD[n];
      window.deselectAll(); window._activeFrame = null; window.selectSection(sec);
      const before = new Set(sec.querySelectorAll('.' + cls));
      await window[fn]();
      const e = [...sec.querySelectorAll('.' + cls)].find((x) => !before.has(x));
      if (!e.id) e.id = 'k' + Math.random().toString(36).slice(2, 9);
      ids.push(e.id);
    }
    let frame = null;
    if (stack) {
      window.deselectAll(); window._activeFrame = null; window.selectSection(sec);
      const old = new Set(sec.querySelectorAll('.frame-block'));
      window.addFrameBlock({});
      const f = [...sec.querySelectorAll('.frame-block')].find((x) => !old.has(x));
      delete f.dataset.freeLayout; delete f.dataset.height; f.dataset.fullWidth = 'true';
      f.style.removeProperty('height'); f.style.removeProperty('min-height'); f.style.width = '100%'; f.style.position = '';
      for (const id of ids) { const b = document.getElementById(id); f.appendChild(b.closest('.row') || b.closest('.frame-block[data-text-frame]') || b); }
      inner.insertBefore(f, inner.lastElementChild);
      frame = f.id;
    }
    window.deselectAll(); window._activeFrame = null;
    return { ids, frame };
  }, [names, ADD, stack]);
}
const unitIdx = (page, id) => page.evaluate((id) => { const e = document.getElementById(id), u = e.closest('.row') || e.closest('.frame-block[data-text-frame]') || e; return [...u.parentElement.children].indexOf(u); }, id);
const twoFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const clickOn = async (page, id) => {
  const loc = page.locator('#' + id);
  await loc.scrollIntoViewIfNeeded();
  const r = await loc.boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await twoFrames(page);
};
const pick = async (page, id) => { await clickOn(page, id); await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), id); };
const press = async (page, key, read, to) => { await page.keyboard.press(key); await expect.poll(read, `${key} 뒤`).toBe(to); };

test('F1 행 위가 프레임이면 ⌘[ 한 번에 그 프레임 위로만 간다 · ⌘Z 로 돌아온다', async ({ page }) => {
  const { ids: [x] } = await scene(page, ['table']);
  const fr = await page.evaluate((id) => { const s = document.getElementById(id).closest('.section-block'), r = document.getElementById(id).closest('.row'); window.deselectAll(); window._activeFrame = null; window.selectSection(s); const old = new Set(s.querySelectorAll('.frame-block')); window.addFrameBlock({}); const f = [...s.querySelectorAll('.frame-block')].find((q) => !old.has(q)); f.dataset.fullWidth = 'true'; delete f.dataset.freeLayout; f.style.height = '40px'; f.style.minHeight = '40px'; f.style.position = ''; r.before(f); window.deselectAll(); window._activeFrame = null; return f.id; }, x);
  await pick(page, x);
  const seq = () => page.evaluate(([x, fr]) => { const u = document.getElementById(x).closest('.row'), f = document.getElementById(fr); return [...u.parentElement.children].indexOf(u) - [...u.parentElement.children].indexOf(f); }, [x, fr]);
  expect(await seq(), '전제: 행이 프레임 바로 아래').toBe(1);
  await press(page, 'Meta+BracketLeft', seq, -1);
  await press(page, 'Meta+z', seq, 1);
});

test('F2 음성 — 형제가 행뿐이면 한 칸씩 그대로', async ({ page }) => {
  const { ids: [a, x] } = await scene(page, ['divider', 'table']);
  await pick(page, x);
  const gap = () => page.evaluate(([a, x]) => { const u = document.getElementById(x).closest('.row'), v = document.getElementById(a).closest('.row'), k = [...u.parentElement.children]; return k.indexOf(u) - k.indexOf(v); }, [a, x]);
  await press(page, 'Meta+BracketLeft', gap, -1);
});

test('Z1 겹침 순서 — 자유 프레임 안 겹친 둘은 ⌘[ 로 임자가 바뀌고 ⌘Z 로 돌아온다', async ({ page }) => {
  await scene(page, []);
  const ids = await page.evaluate(async () => { const s = document.querySelector('.section-block'); window.selectSection(s); window.addFrameBlock({}); const F = [...s.querySelectorAll('.frame-block')].pop(); const mk = async () => { window._activeFrame = F; const before = new Set(F.querySelectorAll('.text-block')); window.addTextBlock(); const t = [...F.querySelectorAll('.text-block')].find((x) => !before.has(x)); if (!t.id) t.id = 'k' + Math.random().toString(36).slice(2, 9); const w = t.closest('.frame-block[data-text-frame]'); w.style.position = 'absolute'; w.style.left = '40px'; w.style.top = '40px'; return t.id; }; const a = await mk(), b = await mk(); window.deselectAll(); window._activeFrame = null; return [a, b]; });
  // 점은 그때그때 잰다 — 패널로 고르면 캔버스가 스크롤된다. 두 글상자는 left·top 이 같다
  const owner = () => page.evaluate(([a, b]) => { const q = document.getElementById(a).getBoundingClientRect(), t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2), w = t?.closest('.frame-block[data-text-frame]') || t; return w?.querySelector?.('#' + a) ? 'a' : w?.querySelector?.('#' + b) ? 'b' : t?.className?.toString().slice(0, 20); }, ids);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), ids[1]);
  await twoFrames(page);
  const top = await owner(), other = top === 'a' ? 'b' : 'a', topId = ids[top === 'a' ? 0 : 1];
  expect(['a', 'b'], '전제: 겹친 점의 임자가 둘 중 하나').toContain(top);
  await page.evaluate((id) => { window.buildLayerPanel?.(); document.getElementById(id)._layerItem.click(); }, topId);   // 겹친 자식은 레이어 패널로 고른다
  await page.waitForFunction((id) => document.getElementById(id).classList.contains('selected'), topId);
  await press(page, 'Meta+BracketLeft', owner, other);
  await press(page, 'Meta+z', owner, top);
});

for (const kind of ['text', 'speech']) {
  test(`T1 ${kind} — 섹션 직속 글상자가 일반 블럭처럼 ⌘[ ⌘] 로 옮겨지고 ⌘Z 로 돌아온다`, async ({ page }) => {
    const { ids: [, x] } = await scene(page, ['divider', kind, 'divider']);
    await pick(page, x);
    const read = () => unitIdx(page, x), i0 = await read();
    await press(page, 'Meta+BracketLeft', read, i0 - 1);
    await press(page, 'Meta+z', read, i0);
    await pick(page, x);
    await press(page, 'Meta+BracketRight', read, i0 + 1);
    expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), x)).toBe(true);
  });
}

test('T2 음성 — 글자 편집 중이면 ⌘[ 가 순서를 안 바꾼다', async ({ page }) => {
  const { ids: [, x] } = await scene(page, ['divider', 'text', 'divider']);
  await pick(page, x);
  const i0 = await unitIdx(page, x), r = await page.locator('#' + x).boundingBox();
  await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForFunction((id) => document.getElementById(id).querySelector('[contenteditable="true"]'), x);
  await page.keyboard.press('Meta+BracketLeft');
  await twoFrames(page);
  expect(await unitIdx(page, x)).toBe(i0);
});

const fIdx = (page, f) => page.evaluate((f) => { const e = document.getElementById(f); return [...e.parentElement.children].indexOf(e); }, f);
for (const kind of ['table', 'chat', 'text']) {
  test(`S1 ${kind} — 스택 안 자식을 고르면 자식이 옮겨지고 프레임은 그대로 · ⌘Z`, async ({ page }) => {
    const { ids: [, x], frame } = await scene(page, ['divider', kind, 'divider'], { stack: true });
    const f0 = await fIdx(page, frame);
    await clickOn(page, x);   // 첫 클릭 = 프레임
    await pick(page, x);      // 둘째 = 자식
    const read = () => unitIdx(page, x), i0 = await read();
    await press(page, 'Meta+BracketLeft', read, i0 - 1);
    expect(await fIdx(page, frame), '프레임이 같이 옮겨졌다').toBe(f0);
    await press(page, 'Meta+BracketRight', read, i0);
    await press(page, 'Meta+BracketRight', read, i0 + 1);
    await press(page, 'Meta+z', read, i0);
    expect(await fIdx(page, frame)).toBe(f0);
  });
}

test('S2 프레임만 골랐으면 프레임이 옮겨진다', async ({ page }) => {
  const { ids: [x], frame } = await scene(page, ['divider'], { stack: true });
  await clickOn(page, x);
  await page.waitForFunction((f) => document.getElementById(f).classList.contains('selected'), frame);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), x), '전제: 자식은 안 골랐다').toBe(false);
  const read = () => fIdx(page, frame), f0 = await read();
  await press(page, 'Meta+BracketLeft', read, f0 - 1);
});

test('S3 자식을 골랐다가 레이어 패널에서 프레임을 고르면 프레임이 옮겨진다', async ({ page }) => {
  const { ids: [, x], frame } = await scene(page, ['divider', 'table', 'divider'], { stack: true });
  await clickOn(page, x); await pick(page, x);
  await page.evaluate((f) => { window.buildLayerPanel?.(); document.getElementById(f)._layerItem.click(); }, frame);
  await twoFrames(page);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), x), '전제: 자식 선택이 풀렸다').toBe(false);
  const read = () => fIdx(page, frame), f0 = await read(), i0 = await unitIdx(page, x);
  await press(page, 'Meta+BracketLeft', read, f0 - 1);
  expect(await unitIdx(page, x)).toBe(i0);
});

test('S4 중첩 프레임을 고르면 스택 안에서만 옮겨지고 밖으로 안 튄다', async ({ page }) => {
  const { ids: [a, b], frame } = await scene(page, ['divider', 'divider'], { stack: true });
  const inner = await page.evaluate(([a, frame]) => { const F = document.getElementById(frame), s = F.closest('.section-block'); window.deselectAll(); window._activeFrame = null; window.selectSection(s); const old = new Set(s.querySelectorAll('.frame-block')); window.addFrameBlock({}); const n = [...s.querySelectorAll('.frame-block')].find((q) => !old.has(q)); delete n.dataset.freeLayout; n.dataset.fullWidth = 'true'; n.style.height = '60px'; n.style.minHeight = '60px'; n.style.position = ''; n.style.background = '#ccd'; document.getElementById(a).closest('.row').after(n); window.deselectAll(); window._activeFrame = null; return n.id; }, [a, frame]);
  await page.evaluate(([n]) => { window.deselectAll(); window.buildLayerPanel?.(); document.getElementById(n)._layerItem.click(); }, [inner]);
  await twoFrames(page);
  expect(await page.evaluate((n) => window._activeFrame?.id === n && document.getElementById(n).classList.contains('selected'), inner), '전제: 중첩 프레임이 골라졌다').toBe(true);
  const read = () => page.evaluate(([n, F]) => { const e = document.getElementById(n); return e.parentElement.id === F ? [...e.parentElement.children].indexOf(e) : 'OUT'; }, [inner, frame]), i0 = await read();
  await press(page, 'Meta+BracketRight', read, i0 + 1);
  await press(page, 'Meta+BracketLeft', read, i0);
});

test('S5 자식을 골랐다가 프레임 빈 자리를 누르면 프레임이 옮겨진다', async ({ page }) => {
  const { ids: [x], frame } = await scene(page, ['divider'], { stack: true });
  await page.evaluate((f) => { document.getElementById(f).style.padding = '40px'; }, frame);
  await clickOn(page, x); await pick(page, x);
  const r = await page.locator('#' + frame).boundingBox();
  await page.mouse.click(r.x + 12, r.y + 12);
  await twoFrames(page);
  const st = await page.evaluate(([x, f]) => [document.getElementById(x).classList.contains('selected'), document.getElementById(f).classList.contains('selected')], [x, frame]);
  expect(st, '전제: 자식 선택이 풀리고 프레임만 남았다').toEqual([false, true]);
  const read = () => fIdx(page, frame), f0 = await read();
  await press(page, 'Meta+BracketLeft', read, f0 - 1);
});
